import { BUILDINGS, DWELLINGS } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { rainAt } from '../clock';
import { findPath } from '../path';
import { buildingById, dropWorker, FP, housing, Phase, playerKeep, population, unitById, type Building, type GameState, type PlayerState, type Unit } from '../state';
import { weatherOf } from '../weather';
import { findBed, move } from './workers';

/**
 * Zaraza i magowie.
 *
 * Skąd się bierze: niepochowane zwłoki w osadzie (po bitwie, po napadzie wilków), głód, ciasnota w chatach, spanie pod
 * gołym niebem, zima — i trochę z samej liczby ludzi (im większa osada, tym łatwiej). Raz na miesiąc gry osada losuje,
 * czy zaraza wybucha; siedziby magów, chatka maga i studnie zmniejszają tę szansę.
 *
 * Jak idzie: chory najpierw się wylęga (pracuje dalej, ale już zaraża tych obok — przy ognisku, w karczmie, przy robocie),
 * potem leży w gorączce w swojej chacie albo na słomie. Leżący nie pracuje (jego warsztat, pole czy kopalnia stoją),
 * zaraża śpiących pod tym samym dachem i może umrzeć. Bez magów umiera mniej więcej co trzeci chory, a do tego stają
 * warsztaty i pola, więc przychodzi głód. Kto przechoruje, długo jest odporny — dlatego zaraza w końcu sama wygasa,
 * a śmierć nie bierze ostatnich ludzi osady (`RULES.minPeasants`), żeby dało się ją odbudować.
 *
 * Magowie (pracownicy chatki maga i siedzib zakonów) chodzą do chorych:
 * - Bractwo Źródła leczy najlepiej: chory prawie na pewno przeżyje i szybciej wstaje;
 * - chatka maga (jeden wędrowny mag) leczy wolniej i słabiej, ale bez niej jest najgorzej;
 * - Zakon Płomienia pali niepochowane zwłoki (źródło zarazy) i wypala zarazę z chat (przez dobę nikt się w nich nie zaraża),
 *   gorączkę zbija słabiej.
 * Oba zakony razem czarują szybciej (współpracują), ale gdy ich siedziby stoją blisko siebie, kłótnie psują nastroje.
 * Magowie sami nie chorują.
 */

export type MageKind = 'water' | 'hut' | 'fire';
const KIND_OF = new Map<number, MageKind>();
BUILDINGS.forEach((d, i) => {
  if (d.id === 'mageWater') KIND_OF.set(i, 'water');
  else if (d.id === 'mageFire') KIND_OF.set(i, 'fire');
  else if (d.id === 'mageHut') KIND_OF.set(i, 'hut');
});
const WELL = BUILDINGS.findIndex((d) => d.id === 'well');

/** Rodzaj maga dla budynku (undefined = to nie siedziba magów) */
export const mageKindOf = (type: number): MageKind | undefined => KIND_OF.get(type);

/** Czy chłop jest magiem (pracuje w chatce maga albo w siedzibie zakonu) */
export function mageOf(g: GameState, u: Unit): MageKind | undefined {
  if (!u.job || u.enlist) return undefined; // rekrut w drodze do siedziby na szkolenie bojowe to jeszcze nie mag-uzdrowiciel
  const b = buildingById(g, u.job);
  return b ? KIND_OF.get(b.type) : undefined;
}

/** Leży w gorączce (nie tylko się wylęga) */
export const feverish = (g: GameState, u: Unit): boolean => !!u.sick && g.tick >= (u.sickFrom ?? 0);

/** Ilu ludzi gracza jest teraz chorych (z wylęgającymi) i ilu z nich leży */
export function sickCount(g: GameState, player: number): { sick: number; bed: number } {
  let sick = 0, bed = 0;
  for (const u of g.units) if (u.owner === player && u.sick) { sick++; if (g.tick >= (u.sickFrom ?? 0)) bed++; }
  return { sick, bed };
}

/** Działające siedziby magów gracza (gotowe, z magiem) według rodzaju */
export function magesOf(g: GameState, player: number): Record<MageKind, Building[]> {
  const out: Record<MageKind, Building[]> = { water: [], hut: [], fire: [] };
  for (const b of g.buildings) {
    if (b.owner !== player || b.build || b.ruined || b.off) continue;
    const k = KIND_OF.get(b.type);
    if (k && b.worker) out[k].push(b);
  }
  return out;
}

/** Oba zakony stoją blisko siebie: kłótnie pod oknami (składnik popularności) */
export function ordersQuarrel(g: GameState, player: number): boolean {
  const m = magesOf(g, player), r = RULES.mages.quarrelRange;
  return m.fire.some((f) => m.water.some((w) => Math.max(Math.abs(f.x - w.x), Math.abs(f.y - w.y)) < r));
}

/** Szansa wybuchu zarazy w tym miesiącu (na 100 000) i jej składniki — do testów i podpowiedzi */
export function plagueRisk(g: GameState, p: PlayerState): number {
  const R = RULES.plague;
  const pop = population(g, p.id);
  const lvl = R.levelRisk[Math.max(0, Math.min(R.levelRisk.length - 1, p.level))] ?? 100;
  let risk = pop * R.riskPerHead;
  const keep = playerKeep(g, p.id);
  if (keep) {
    let n = 0;
    const kx = keep.x + 5, ky = keep.y + 5, reach = RULES.buildRadius + 4;
    for (const c of g.corpses) {
      if (c.taken || g.tick - c.at < R.corpseAge) continue;
      if (Math.max(Math.abs((c.px >> 8) - kx), Math.abs((c.py >> 8) - ky)) <= reach) n++;
    }
    risk += Math.min(n, 12) * R.riskCorpse;
  }
  risk += (p.famine ?? 0) * R.riskFamine;
  if (pop > housing(g, p.id)) risk += R.riskCrowd;
  risk += Math.min(p.rough ?? 0, 20) * R.riskRough;
  if (weatherOf(g, rainAt(g.tick)).chill >= 1) risk = (risk * R.winterRisk) / 100;
  const m = magesOf(g, p.id);
  if (m.water.length) risk = (risk * R.guardWater) / 100;
  if (m.fire.length) risk = (risk * R.guardFire) / 100;
  if (m.hut.length) risk = (risk * R.guardHut) / 100;
  if (g.buildings.some((b) => b.owner === p.id && b.type === WELL && !b.build && !b.ruined)) risk = (risk * R.guardWell) / 100;
  return Math.floor((risk * lvl) / 100);
}

const between = (g: GameState, [a, b]: readonly [number, number]): number => a + g.rng.int(b - a + 1);

/** Zaraża chłopa: najpierw się wylęga, potem leży w gorączce */
function infect(g: GameState, u: Unit): void {
  const R = RULES.plague;
  u.sickFrom = g.tick + between(g, R.incubate);
  u.sick = u.sickFrom + between(g, R.fever);
  u.care = undefined;
}

const susceptible = (g: GameState, u: Unit): boolean => !u.sick && (u.immune ?? 0) <= g.tick && !mageOf(g, u);

/** Zaraza wybucha w osadzie gracza: choruje kilku ludzi naraz (wybranych losowo z ziarna meczu) */
export function startPlague(g: GameState, player: number, count?: number): number {
  const p = g.players[player];
  if (!p) return 0;
  const pool = g.units.filter((u) => u.owner === player && susceptible(g, u));
  let n = Math.min(pool.length, count ?? 1 + Math.floor(population(g, player) / RULES.plague.firstPer));
  const sick = n;
  while (n-- > 0) {
    const u = pool.splice(g.rng.int(pool.length), 1)[0]!;
    infect(g, u);
  }
  if (sick && !p.plague) { p.plague = g.tick; p.plagueDead = 0; p.plagueOver = undefined; }
  return sick;
}

const tileOf = (g: GameState, px: number, py: number): number => (py >> 8) * g.map.width + (px >> 8);

/** Gdzie chory teraz jest: w chacie (pole drzwi) albo tam, gdzie leży czy stoi */
function spotOf(g: GameState, u: Unit): { tile: number; house?: Building } {
  if (u.home && (u.phase === Phase.Sleeping || u.phase === Phase.Resting)) {
    const b = buildingById(g, u.home);
    if (b && b.door >= 0) return { tile: b.door, house: b };
  }
  return { tile: tileOf(g, u.px, u.py) };
}

const cheb = (w: number, a: number, b: number): number => {
  const ax = a % w, bx = b % w;
  return Math.max(Math.abs(ax - bx), Math.abs((a - ax) / w - (b - bx) / w));
};

/** Śmierć z zarazy: ciało zostaje (przy drzwiach chaty albo na posłaniu), grabarz je zabierze, a mag Płomienia spali */
function dieOfPlague(g: GameState, u: Unit, p: PlayerState): void {
  const i = g.units.indexOf(u);
  if (i < 0) return;
  const at = spotOf(g, u), w = g.map.width;
  const x = at.house ? (at.tile % w) * FP + FP / 2 : u.px, y = at.house ? Math.floor(at.tile / w) * FP + FP / 2 : u.py;
  dropWorker(g, u.id);
  g.units.splice(i, 1);
  g.corpses.push({ id: u.id, owner: u.owner, kind: -1, px: x, py: y, at: g.tick, taken: false });
  p.stats.lost++;
  p.plagueDead = (p.plagueDead ?? 0) + 1;
  p.popularity = Math.max(0, p.popularity + RULES.plague.deathPenalty);
}

function recover(g: GameState, u: Unit): void {
  u.sick = undefined; u.sickFrom = undefined; u.care = undefined;
  u.immune = g.tick + RULES.plague.immuneTicks;
  if (u.phase === Phase.Sleeping || u.phase === Phase.ToSleep) {
    // wstaje z posłania; wieczorem i w nocy zwykły rozkład dnia i tak położy go z powrotem spać
    u.home = 0; u.target = 0; u.path = []; u.timer = 0;
    u.phase = u.job ? Phase.Returning : Phase.Idle;
  }
}

/** Co `every` ticków: zarażanie, zgony, zdrowienie, koniec zarazy; raz na miesiąc los, czy wybucha nowa */
function plagueTick(g: GameState): void {
  const R = RULES.plague, w = g.map.width;
  const chill = weatherOf(g, rainAt(g.tick)).chill >= 1;
  for (const p of g.players) {
    if (p.defeated) continue;
    const mine = g.units.filter((u) => u.owner === p.id);
    const sources = mine.filter((u) => u.sick);
    if (sources.length) {
      // zarażanie: każdy zdrowy (bez odporności) od każdego chorego obok siebie
      const src = sources.map((s) => ({ s, at: spotOf(g, s), bed: feverish(g, s) }));
      for (const o of mine) {
        if (!susceptible(g, o)) continue;
        const here = spotOf(g, o);
        let chance = 0, outside = 0;
        for (const { at, bed } of src) {
          if (at.house && at.house.clean && at.house.clean > g.tick) continue; // chata wypalona przez maga Płomienia
          if (at.house && at.house.quarantine && here.house !== at.house) continue; // kwarantanna: zaraza nie wychodzi za drzwi
          if (bed && at.house) {
            if (here.house === at.house) chance += R.spreadHome;
            else if (cheb(w, here.tile, at.tile) <= 1) outside += R.spreadDoor;
          } else if (cheb(w, here.tile, at.tile) <= 1 && !(here.house && here.house !== at.house)) outside += bed ? R.spreadNear : R.spreadCarrier;
        }
        // na dworze w tłumie zaraża się wolniej niż pod jednym dachem: tłum przy ognisku dokłada najwyżej `spreadCrowdMax`
        chance += Math.min(outside, R.spreadCrowdMax);
        if (chance > 0 && g.rng.int(10000) < Math.min(chance, 6000)) infect(g, o);
      }
      // gorączka: zgony, zdrowienie
      let alive = population(g, p.id);
      for (const u of sources) {
        if (!g.units.includes(u)) continue;
        if (mageOf(g, u)) { u.sick = undefined; u.sickFrom = undefined; u.care = undefined; continue; } // mag leczy się sam
        if (g.tick >= u.sick!) { recover(g, u); continue; }
        if (!feverish(g, u)) continue;
        let d: number = R.death;
        if (p.hungry) d = (d * R.deathHungry) / 100;
        if (!u.home) d = (d * R.deathRough) / 100;
        if (chill) d = (d * R.deathWinter) / 100;
        d = (d * (100 - (u.care ?? 0))) / 100;
        if (alive > RULES.minPeasants && g.rng.int(10000) < d) { dieOfPlague(g, u, p); alive--; }
      }
    }
    if (p.plague && !g.units.some((u) => u.owner === p.id && u.sick)) {
      // po zarazie chaty same się otwierają
      for (const b of g.buildings) if (b.owner === p.id && b.quarantine) b.quarantine = undefined;
      p.plagueOver = { tick: g.tick, dead: p.plagueDead ?? 0 };
      p.plague = undefined; p.plagueDead = undefined;
      p.plagueCalm = g.tick + R.calmTicks;
    }
    // raz na miesiąc gry: czy wybucha nowa zaraza
    if (g.tick % RULES.monthTicks === 50 && !p.plague && g.tick >= R.graceTicks && g.tick >= (p.plagueCalm ?? 0) && population(g, p.id) >= R.minPop) {
      const risk = plagueRisk(g, p);
      if (risk > 0 && g.rng.int(100000) < risk) startPlague(g, p.id);
    }
  }
}

/** Chata, którą wolno zamknąć na kwarantannę (zwykła chata gracza, gotowa) */
export const canQuarantine = (b: Building): boolean => DWELLINGS.has(BUILDINGS[b.type]!.id) && !b.build && !b.ruined;

/**
 * Kwarantanna chaty: w środku leżą tylko chorzy (inni chorzy idą tu najpierw), zdrowi domownicy szukają łóżka gdzie indziej
 * (w ciasnej osadzie — pod gołym niebem), a zaraza nie wychodzi za drzwi. Magowie dalej wchodzą i leczą.
 * Ludzie nie lubią zamkniętych chat (składnik popularności `quarantine`). Po wygaśnięciu zarazy chaty same się otwierają.
 */
export function setQuarantine(g: GameState, player: number, id: number, on: boolean): boolean {
  const b = buildingById(g, id);
  if (!b || b.owner !== player || !canQuarantine(b)) return false;
  b.quarantine = on || undefined;
  if (!on) return true;
  // zdrowi wychodzą z zamkniętej chaty i szukają innego posłania (śpiący, odpoczywający i ci w drodze do niej)
  for (const u of g.units) {
    if (u.owner !== player || u.sick || u.home !== b.id) continue;
    const asleep = u.phase === Phase.Sleeping || u.phase === Phase.ToSleep;
    u.home = 0; u.target = 0; u.path = []; u.timer = 0;
    u.phase = asleep ? Phase.ToSleep : u.job ? Phase.Returning : Phase.Idle;
    if (asleep) findBed(g, u);
  }
  return true;
}

// ---------------------------------------------------------------- magowie przy pracy

/** Zadania maga (w polu `batches`, którego magowie nie używają): leczy chorego, pali zwłoki, wypala chatę */
const HEAL = 1, BURN = 2, CLEANSE = 3;

/** Mag czeka przy swojej siedzibie: każdy na swoim polu przed drzwiami (nie stoją jeden na drugim) */
function vigilSpot(g: GameState, b: Building, u: Unit): (t: number) => boolean {
  const w = g.map.width, dx0 = b.door % w, dy0 = (b.door - dx0) / w;
  return (t) => {
    const x = t % w, y = (t - x) / w, d = Math.max(Math.abs(x - dx0), Math.abs(y - dy0));
    return d >= 1 && d <= 2 && (t + u.id) % 4 === 0 && !g.occupancy[t];
  };
}

function taken(g: GameState, kind: number, id: number, me: Unit): boolean {
  return g.units.some((o) => o !== me && o.owner === me.owner && (o.phase === Phase.ToPatient || o.phase === Phase.Healing) && o.batches === kind && o.target === id);
}

/** Następne zadanie maga: najbliższy cel, którym nikt jeszcze się nie zajmuje */
function pickTask(g: GameState, u: Unit, kind: MageKind): { task: number; id: number; tile: number } | null {
  const w = g.map.width, here = tileOf(g, u.px, u.py), reach = RULES.mages.reach;
  let best: { task: number; id: number; tile: number } | null = null, bd = Infinity;
  const consider = (task: number, id: number, tile: number, bias: number): void => {
    const d = cheb(w, here, tile) + bias;
    if (d - bias > reach || d >= bd || taken(g, task, id, u)) return;
    bd = d; best = { task, id, tile };
  };
  if (kind === 'fire') {
    // najpierw zwłoki (z nich bierze się zaraza), potem chaty z gorączkującymi
    for (const c of g.corpses) if (!c.taken && g.tick - c.at > 60) consider(BURN, c.id, tileOf(g, c.px, c.py), 0);
  }
  for (const s of g.units) {
    if (s.owner !== u.owner || !feverish(g, s)) continue;
    const at = spotOf(g, s);
    if (kind === 'fire') {
      if (at.house) { if (!(at.house.clean && at.house.clean > g.tick)) consider(CLEANSE, at.house.id, at.tile, 6); }
      else if ((s.care ?? 0) < RULES.mages.fire.care) consider(HEAL, s.id, at.tile, 6);
    } else if ((s.care ?? 0) < RULES.mages[kind].care) consider(HEAL, s.id, at.tile, 0);
  }
  return best;
}

/** Pole, z którego mag czaruje: drzwi chaty, przy zwłokach albo przy leżącym */
function castGoal(g: GameState, u: Unit): ((t: number) => boolean) | null {
  const w = g.map.width;
  if (u.batches === CLEANSE) {
    const b = buildingById(g, u.target);
    return b && !b.ruined && b.door >= 0 ? (t) => t === b.door : null;
  }
  if (u.batches === BURN) {
    const c = g.corpses.find((x) => x.id === u.target && !x.taken);
    if (!c) return null;
    const ct = tileOf(g, c.px, c.py);
    return (t) => cheb(w, t, ct) <= 1;
  }
  const s = unitById(g, u.target);
  if (!s || !feverish(g, s)) return null;
  const at = spotOf(g, s);
  if (at.house) return (t) => t === at.tile;
  if (s.path.length) return null; // dopiero idzie na posłanie: mag poczeka
  return (t) => cheb(w, t, at.tile) <= 1;
}

/** Skutek czaru */
function cast(g: GameState, u: Unit, kind: MageKind): void {
  const M = RULES.mages;
  const treat = (s: Unit, k: MageKind): void => {
    if (!feverish(g, s)) return;
    const r = M[k];
    s.care = Math.max(s.care ?? 0, r.care);
    s.sick = Math.min(s.sick!, Math.max(s.sickFrom ?? 0, g.tick) + r.feverLeft);
  };
  if (u.batches === BURN) {
    const i = g.corpses.findIndex((x) => x.id === u.target && !x.taken);
    if (i >= 0) g.corpses.splice(i, 1);
    return;
  }
  if (u.batches === CLEANSE) {
    const b = buildingById(g, u.target);
    if (!b) return;
    b.clean = g.tick + M.cleanTicks;
    for (const s of g.units) if (s.owner === u.owner && s.home === b.id && s.phase === Phase.Sleeping) treat(s, 'fire');
    return;
  }
  const s = unitById(g, u.target);
  if (!s) return;
  const at = spotOf(g, s);
  // przy chacie leczy wszystkich leżących w środku
  if (at.house) { for (const o of g.units) if (o.owner === u.owner && o.home === at.house.id && o.phase === Phase.Sleeping) treat(o, kind); }
  else treat(s, kind);
}

function mageStep(g: GameState, u: Unit, b: Building, kind: MageKind, fast: boolean): void {
  if (u.phase !== Phase.Vigil && u.phase !== Phase.ToPatient && u.phase !== Phase.Healing) {
    // świeżo przyjęty do siedziby (albo po wczytaniu): rzuca to, co robił, i zaczyna czuwać
    u.phase = Phase.Vigil; u.path = []; u.timer = 0; u.target = 0; u.batches = 0; u.carryRes = -1; u.carryAmt = 0; u.home = 0;
  }
  if (u.phase === Phase.Healing) {
    if (--u.timer > 0) return;
    cast(g, u, kind);
    u.phase = Phase.Vigil; u.target = 0; u.batches = 0; u.path = [];
    return;
  }
  if (u.path.length) { move(g, u); return; }
  if (u.wait > 0) { u.wait--; return; }
  const here = tileOf(g, u.px, u.py);
  if (u.phase === Phase.ToPatient) {
    const goal = castGoal(g, u);
    if (!goal) { u.phase = Phase.Vigil; u.target = 0; u.batches = 0; return; }
    if (goal(here)) {
      const c = RULES.mages[kind].cast;
      u.phase = Phase.Healing; u.timer = fast ? Math.ceil((c * RULES.mages.together) / 100) : c;
      return;
    }
    const path = findPath(g, here, goal, 3000, u.owner, -1, 0, true);
    if (path && path.length) u.path = path;
    else { u.phase = Phase.Vigil; u.target = 0; u.batches = 0; u.wait = 40; }
    return;
  }
  // czuwa: co chwilę rozgląda się za robotą, a bez niej wraca pod swoją siedzibę
  if ((g.tick + u.id) % 10 === 0) {
    const t = pickTask(g, u, kind);
    if (t) { u.phase = Phase.ToPatient; u.batches = t.task; u.target = t.id; return; }
  }
  if (b.door < 0) return;
  const spot = vigilSpot(g, b, u);
  if (spot(here) || (g.tick + u.id) % 30 !== 0) return;
  const path = findPath(g, here, spot, 3000, u.owner, -1, 0, true);
  if (path && path.length) u.path = path;
  else u.wait = 60;
}

/** Zaraza (co kilka ticków) i magowie (co tick) */
export function plagueSystem(g: GameState): void {
  if (g.tick % RULES.plague.every === 0) plagueTick(g);
  const both = new Map<number, boolean>();
  for (const u of g.units) {
    if (!u.job || u.enlist) continue;
    const b = buildingById(g, u.job);
    const kind = b ? KIND_OF.get(b.type) : undefined;
    if (!b || !kind || b.build) continue;
    let fast = both.get(u.owner);
    if (fast === undefined) { const m = magesOf(g, u.owner); fast = !!m.water.length && !!m.fire.length; both.set(u.owner, fast); }
    mageStep(g, u, b, kind, fast);
  }
}

import { resIndex } from '../../data/resources';
import { GUARD } from '../../data/units';
import { RULES } from '../../data/rules';
import { findPath } from '../path';
import { BUILDINGS, footprint } from '../../data/buildings';
import { RESOURCE_DEFS, RESOURCES } from '../../data/resources';
import { Phase, playerKeep, population, type Building, type GameState, type PlayerState, type Unit } from '../state';
import { FOOD_VALUE, foodTotal } from './economy';

/**
 * Bunt głodowy.
 * Gdy w osadzie brakuje jedzenia przez kilka posiłków z rzędu (licznik `famine` liczy economySystem), część chłopów
 * rzuca robotę i staje tłumem pod bramą twierdzy. Ich warsztaty, pola i kopalnie stoją, a bunt psuje nastroje.
 * Bez straży miejskiej buntuje się połowa ludzi, ze strażą około jednej trzeciej (pilnuje porządku jak straż
 * Starego Obozu). Bunt mija, gdy ludzie znów się najedzą: większe racje i straż gaszą go szybciej.
 * Buntownicy nie odchodzą z osady jak zwykli głodni (migrationSystem) — zostają i domagają się chleba.
 * Buntownik zostaje przy swoim zajęciu (`job`), więc po buncie wraca prosto do roboty.
 */
const EVERY = 10;
/** Tłum staje w pierścieniu 1–3 pól od bramy twierdzy (każdy w swoim miejscu, żeby nie stali jeden na drugim) */
const RING = 3;

export function famineLimit(): number {
  return RULES.revoltMeals;
}

/** Ilu ludzi gracza stoi teraz w tłumie pod bramą */
export function rioters(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player && u.riot) n++;
  return n;
}

/** Ile porcji jedzenia kosztuje „Rozdaj chleb” (po kilka na każdego buntownika) */
export function doleCost(g: GameState, player: number): number {
  return rioters(g, player) * RULES.dolePortions;
}

/** Kolejność rozdawania: najpierw chleb (o niego krzyczą), potem jabłka, ryby na końcu */
const DOLE_ORDER = (['bread', 'apples', 'fish'] as const).map((r) => ({ i: resIndex(r), v: FOOD_VALUE[r] ?? 1 }));

/** Bunt się kończy: wszyscy wracają do roboty, rozkaz dla straży znika */
function endRevolt(g: GameState, p: PlayerState): void {
  p.revolt = undefined;
  p.quell = undefined;
  p.revoltSince = undefined;
  p.raidAt = undefined;
  p.raids = undefined;
  for (const u of g.units) if (u.owner === p.id && u.riot) calmDown(u);
}

/**
 * „Rozdaj chleb” z okna twierdzy: jednorazowo ze spichlerzy idzie po kilka porcji na każdego buntownika
 * (chleb pierwszy). Tłum od razu się rozchodzi, głód z rzędu znika, a popularność trochę rośnie.
 * Gdy jedzenia nie starczy na wszystkich, nic się nie dzieje (przycisk jest wtedy wyszarzony).
 */
export function dole(g: GameState, player: number): boolean {
  const p = g.players[player];
  if (!p || !p.revolt) return false;
  let need = doleCost(g, player);
  if (!need || foodTotal(p) < need) return false;
  for (const { i, v } of DOLE_ORDER) {
    if (need <= 0) break;
    const take = Math.min(p.res[i]!, Math.ceil(need / v));
    p.res[i]! -= take;
    need -= take * v;
  }
  p.famine = undefined;
  p.popularity = Math.min(RULES.maxPopularity, p.popularity + RULES.dolePopularity);
  endRevolt(g, p);
  return true;
}

/**
 * „Rozpędź tłum”: straż miejska idzie pod bramę i rozgania buntowników po kolei (każdy strażnik co chwilę jednego).
 * Popularność spada od razu, a głód nie mija — gdy dalej nie ma jedzenia, tłum zbierze się znów po kilku posiłkach.
 * Bez straży rozkaz nic nie robi.
 */
export function quell(g: GameState, player: number): boolean {
  const p = g.players[player];
  if (!p || !p.revolt || p.quell || !guardsOf(g, player).length) return false;
  p.quell = true;
  p.popularity = Math.max(0, p.popularity + RULES.quellPenalty);
  p.famine = Math.min(p.famine ?? 0, famineLimit() - RULES.quellMargin) || undefined;
  return true;
}

/** Żywi strażnicy miejscy gracza (bez straży kopalni) */
function guardsOf(g: GameState, player: number): GameState['soldiers'] {
  return g.soldiers.filter((s) => s.owner === player && s.kind === GUARD && !s.camp && s.hp > 0);
}

/** Tyle ticków rozpędzony buntownik ucieka w popłochu */
const FLEE = 80;
/** Tyle ticków płonie spichlerz podpalony przez tłum (jak pożar od ciosu wroga, fire.ts) */
const RIOT_FIRE = 600;
/** Najdalej tyle pól od bramy tłum idzie na napad */
const RAID_RANGE = 40;

const GRANARY = new Set(['granary', 'granaryBig']);
const STORE = new Set(['stockpile', 'barn']);

/** Pola tuż przy ścianie budynku */
function besideOf(g: GameState, b: Building): (t: number) => boolean {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width;
  return (t) => {
    const x = t % w, y = (t - x) / w;
    return Math.max(Math.max(b.x - x, 0, x - (b.x + fp.w - 1)), Math.max(b.y - y, 0, y - (b.y + fp.h - 1))) === 1;
  };
}

/** Cel napadu: najbliższy bramie skład (kind 1) albo spichlerz (kind 2) gracza — gotowy, cały, niepłonący */
function raidTarget(g: GameState, p: PlayerState, kind: number, door: [number, number]): Building | undefined {
  const ids = kind === 2 ? GRANARY : STORE;
  let best: Building | undefined, bd = RAID_RANGE * RAID_RANGE;
  for (const b of g.buildings) {
    if (b.owner !== p.id || b.build || b.ruined || b.fire || !ids.has(BUILDINGS[b.type]!.id)) continue;
    const d = (b.x - door[0]) ** 2 + (b.y - door[1]) ** 2;
    if (d < bd || (d === bd && best && b.id < best.id)) { bd = d; best = b; }
  }
  return best;
}

/** Co zrobili, gdy doszli: rozkradli część towaru ze składu (i zboża ze stodoły) albo podpalili spichlerz (część jedzenia w dym) */
function strike(g: GameState, p: PlayerState, b: Building): void {
  const id = BUILDINGS[b.type]!.id;
  if (GRANARY.has(id)) {
    b.fire = Math.max(b.fire ?? 0, RIOT_FIRE);
    RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === 'granary') p.res[i]! -= Math.floor(p.res[i]! * RULES.riotBurn); });
    p.lastRaid = { tick: g.tick, building: b.id, kind: 2 };
  } else {
    RESOURCES.forEach((r, i) => { const s = RESOURCE_DEFS[r].store; if (s === 'stockpile' || s === 'grain') p.res[i]! -= Math.floor(p.res[i]! * RULES.riotLoot); });
    p.lastRaid = { tick: g.tick, building: b.id, kind: 1 };
  }
}

/**
 * Długi bunt: co jakiś czas kilku buntowników odłącza się od tłumu i idzie na napad — na zmianę rozkrada skład
 * i podpala spichlerz. Kto doszedł, robi swoje i wraca pod bramę. Gdy celu nie ma (brak składu albo spichlerza),
 * idą na ten drugi; gdy nie ma żadnego, tłum tylko krzyczy pod bramą.
 */
function raids(g: GameState, p: PlayerState): void {
  const w = g.map.width;
  const raiders = g.units.filter((u) => u.owner === p.id && u.riot && u.raid);
  // w drodze albo na miejscu
  let struck = false;
  for (const u of raiders) {
    const b = g.buildings.find((x) => x.id === u.raid);
    if (!b || b.ruined) { u.raid = undefined; u.target = 0; u.path = []; continue; }
    if (u.path.length) continue;
    const here = (u.py >> 8) * w + (u.px >> 8);
    if (besideOf(g, b)(here)) {
      if (!struck && !(p.lastRaid && p.lastRaid.building === b.id && p.lastRaid.tick >= (p.raidAt ?? 0) - RULES.riotRaidEvery)) strike(g, p, b);
      struck = true;
      u.raid = undefined; u.target = 0; // z powrotem pod bramę
      continue;
    }
    const path = findPath(g, here, besideOf(g, b), 3000, p.id, -1, 0, true);
    if (path && path.length) u.path = path;
    else { u.raid = undefined; u.target = 0; } // nie dojdzie: wraca do tłumu
  }
  if (raiders.length || g.tick < (p.raidAt ?? Infinity)) return;
  const keep = playerKeep(g, p.id);
  if (!keep || keep.door < 0) return;
  const door: [number, number] = [keep.door % w, Math.floor(keep.door / w)];
  const n = p.raids ?? 0;
  const kind = n % 2 === 0 ? 1 : 2;
  const b = raidTarget(g, p, kind, door) ?? raidTarget(g, p, 3 - kind, door);
  p.raids = n + 1;
  p.raidAt = g.tick + RULES.riotRaidEvery;
  if (!b) return;
  const crowd = g.units.filter((u) => u.owner === p.id && u.riot && !u.raid).sort((a, c) => a.id - c.id);
  // na napad idzie najwyżej pół tłumu (reszta dalej krzyczy pod bramą), ale zawsze ktoś
  const go = crowd.slice(0, Math.min(RULES.riotRaiders, Math.max(1, Math.floor(crowd.length / 2))));
  for (const u of go) { u.raid = b.id; u.path = []; u.wait = 0; u.target = 0; }
}

/** Strażnik rozgania buntowników w tym promieniu (w polach) */
const QUELL_REACH = 2;

function calmDown(u: Unit): void {
  u.riot = undefined;
  u.raid = undefined;
  u.path = []; u.timer = 0; u.target = 0; u.wait = 0;
  u.phase = u.job ? Phase.Returning : Phase.Idle;
}

/** Kto może dołączyć do buntu: nie niesie towaru, nie gasi pożaru, nie idzie do wojska i nie śpi */
function canJoin(u: Unit, player: number): boolean {
  return u.owner === player && !u.riot && !u.enlist && !u.bucket && u.carryRes < 0
    && u.phase !== Phase.Sleeping && u.phase !== Phase.ToSleep && u.phase !== Phase.ToCorpse && u.phase !== Phase.Burying;
}

export function unrestSystem(g: GameState): void {
  if (g.tick % EVERY !== 0) return;
  const w = g.map.width;
  for (const p of g.players) {
    if (!p.revolt && (p.famine ?? 0) >= famineLimit()) { p.revolt = true; p.revoltSince = g.tick; p.raidAt = g.tick + RULES.riotRaidAfter; }
    else if (p.revolt && !p.famine) endRevolt(g, p);
    if (!p.revolt) continue;
    // straż rozpędza tłum: każdy strażnik przy tłumie odsyła jednego buntownika obok siebie do roboty (z guzem: −5 zdrowia);
    // nikt nowy nie dołącza, a gdy pod bramą nikogo nie zostanie, bunt się kończy
    if (p.quell) {
      for (const s of guardsOf(g, p.id)) {
        const u = g.units.find((x) => x.owner === p.id && x.riot && Math.max(Math.abs((x.px >> 8) - (s.px >> 8)), Math.abs((x.py >> 8) - (s.py >> 8))) <= QUELL_REACH);
        if (!u) continue;
        u.hp = Math.max(5, (u.hp ?? 30) - 5);
        calmDown(u);
        u.fled = g.tick + FLEE; // ucieka w popłochu (szybszy krok, ręce nad głową), potem wraca do roboty
      }
      if (!rioters(g, p.id) || !guardsOf(g, p.id).length) endRevolt(g, p);
      continue;
    }
    const keep = playerKeep(g, p.id);
    if (!keep || keep.door < 0) continue;
    const dx0 = keep.door % w, dy0 = (keep.door - dx0) / w;
    const share = (p.guards ?? 0) > 0 ? RULES.revoltShareGuarded : RULES.revoltShare;
    const want = Math.ceil(population(g, p.id) * share);
    let have = 0;
    for (const u of g.units) if (u.owner === p.id && u.riot) have++;
    // najpierw dołączają ci, którzy pracują (pusty brzuch, pusty warsztat), potem bezrobotni
    const cands = g.units.filter((u) => canJoin(u, p.id)).sort((a, b) => (b.job ? 1 : 0) - (a.job ? 1 : 0) || a.id - b.id);
    for (const u of cands) {
      if (have >= want) break;
      u.riot = 1; u.phase = Phase.Riot; u.timer = 0; u.target = 0; u.wait = 0; u.path = [];
      have++;
    }
    raids(g, p);
    // buntownicy bez miejsca w tłumie szukają drogi pod bramę
    for (const u of g.units) {
      if (u.owner !== p.id || !u.riot || u.raid || u.path.length || u.wait > 0) continue;
      const here = (u.py >> 8) * w + (u.px >> 8);
      const spot = (t: number): boolean => {
        const x = t % w, y = (t - x) / w, d = Math.max(Math.abs(x - dx0), Math.abs(y - dy0));
        return d >= 1 && d <= RING && (t + u.id) % 3 === 0;
      };
      if (spot(here) || u.target === 1) { u.target = 1; continue; }
      const path = findPath(g, here, spot, 3000, p.id, -1, 0, true);
      if (path && path.length) { u.path = path; u.target = 1; }
      else { u.target = 1; u.wait = 60; } // nie dojdzie (np. za murem): stoi tam, gdzie stoi
    }
  }
}

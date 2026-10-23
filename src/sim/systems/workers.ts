import { buildingById } from '../state';
import { BUILDINGS, footprint, type ProductionDef } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, resIndex, type StoreKind } from '../../data/resources';
import { RULES } from '../../data/rules';
import { Terrain } from '../../data/terrain';
import { findPath, walkable } from '../path';
import { clockAt, hourStarts, rainAt } from '../clock';
import { FP, Phase, playerKeep, storeRoom, type Building, type GameState, type Unit } from '../state';
import { CAMP_HOLD, campOf, holdTotal, putInHold } from './minecamp';
import { mineWalkTicks } from '../../data/minewalk';
import { plantSapling } from './forestry';

const RETRY_TICKS = 20;
/** Ile ticków chłop układa jedno pole drogi */
export const PAVE_TICKS = 40;
const HOUSE = BUILDINGS.findIndex((b) => b.id === 'house');
const TAVERN = BUILDINGS.findIndex((b) => b.id === 'tavern');
/** Wieczór i sen: tych ludzi nikt nie wyciąga do roboty (inaczej wstawaliby w nocy i kładli się od nowa) */
const OREMINE = BUILDINGS.findIndex((b) => b.id === 'oremine');
/**
 * Co wychodzi z jednego kursu w kopalni (losowane z ziarna meczu, więc u wszystkich graczy tak samo): wagi i ilości.
 * Ruda (waluta gry, jak w Gothicu; w kodzie 'gold') jest rzadka. Górnicy noszą wszystko: kamień i żelazo do składu,
 * rudę do skarbca w zamku (albo całość pod barak, skąd jedzie wozem). Suma wag = 100.
 * Kurs jest długi (15 s), a urobek z niego większy: górnicy dłużej siedzą w sztolni, więc w środku widać ich więcej naraz.
 */
export const MINE_YIELDS: { res: 'stone' | 'iron' | 'gold'; weight: number; amount: number }[] = [
  { res: 'stone', weight: 58, amount: 10 },
  { res: 'iron', weight: 34, amount: 7 },
  { res: 'gold', weight: 8, amount: 6 },
];
/** Ilu górników powinna mieć kopalnia przy danej liczbie mieszkańców: 1 + po jednym na każde `per`, najwyżej `max` */
export function crewWanted(def: { crew?: { per: number; max: number } }, pop: number): number {
  if (!def.crew) return 1;
  return Math.max(1, Math.min(def.crew.max, 1 + Math.floor(pop / def.crew.per)));
}
/** Wszyscy pracujący w budynku: brygadzista i reszta załogi */
export const crewOf = (b: Building): number[] => (b.worker ? [b.worker, ...(b.crew ?? [])] : [...(b.crew ?? [])]);

const OFF_DUTY = new Set<Phase>([Phase.ToEvening, Phase.Evening, Phase.ToSleep, Phase.Sleeping]);
/** Zajęcia, które chłop z pustymi rękami rzuca wieczorem (resztę kończy: niesie ładunek do składu, dokańcza wyrób) */
const AFTER_HOURS = new Set<Phase>([Phase.Idle, Phase.Returning, Phase.ToInputStore, Phase.Repairing, Phase.ToRepair, Phase.ToFetch, Phase.Paving, Phase.ToPave, Phase.ToRoadFetch, Phase.ToRubble, Phase.ToRest, Phase.ToPlant]);

/** Do której godziny (po północy) chłop siedzi wieczorem przy ogniu albo w karczmie; 0 = idzie spać o zwykłej porze */
export function nightOwl(u: { id: number }): number {
  return u.id % 7 === 3 ? 3 : u.id % 4 === 1 ? 1 : 0;
}

/** Pora dnia dla rytmu ludzi: praca, wieczór przy ogniu, sen */
export function dayPart(tick: number): 'work' | 'evening' | 'sleep' {
  const { hour } = clockAt(tick);
  if (hour >= RULES.sleepHour || hour < RULES.wakeHour) return 'sleep';
  if (hour >= RULES.eveningHour) return 'evening';
  return 'work';
}

/** Miejsca wieczorne gracza: karczmy z karczmarzem i obozowiska z ogniskiem (drzwi) */
function eveningDoors(g: GameState, owner: number, tavern: boolean): Set<number> {
  const doors = new Set<number>();
  for (const b of g.buildings) {
    if (b.owner !== owner || b.door < 0 || b.build) continue;
    if (tavern ? b.type === TAVERN && b.worker : BUILDINGS[b.type]!.idleSlots) doors.add(b.door);
  }
  return doors;
}

/**
 * Łóżko na noc: wolne miejsce w chacie (albo w twierdzy), a gdy wszystkie zajęte — słomiane posłanie na ziemi
 * obok obozowiska albo twierdzy. Zwraca true, gdy znalazł nocleg.
 */
function findBed(g: GameState, u: Unit): void {
  const used = new Map<number, number>();
  const mats = new Set<number>();
  for (const o of g.units) {
    if (o === u || o.owner !== u.owner || (o.phase !== Phase.ToSleep && o.phase !== Phase.Sleeping)) continue;
    if (o.home) used.set(o.home, (used.get(o.home) ?? 0) + 1);
    else if (o.target) mats.add(o.target - 1);
  }
  // górnik kopalni z barakiem: nocuje w baraku przy kopalni (prycze dla załogi), a nie wraca do wioski
  const bunk = u.job ? campOf(g, buildingById(g, u.job)) : undefined;
  if (bunk && (used.get(bunk.id) ?? 0) < (BUILDINGS[bunk.type]!.beds ?? 0)) { u.home = bunk.id; u.target = 0; return; }
  let best: Building | undefined, bd = Infinity;
  for (const b of g.buildings) {
    const cap = BUILDINGS[b.type]!.housing ?? 0;
    if (b.owner !== u.owner || !cap || b.door < 0 || b.build || (used.get(b.id) ?? 0) >= cap) continue;
    const d = Math.abs((b.door % g.map.width) * FP - u.px) + Math.abs(Math.floor(b.door / g.map.width) * FP - u.py);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) { u.home = best.id; u.target = 0; return; }
  // pod gołym niebem: najbliższe wolne pole trawy wokół ogniska (albo twierdzy), każdy na swoim posłaniu
  u.home = 0; u.target = 0;
  const w = g.map.width, h = g.map.height;
  const camp = g.buildings.find((b) => b.owner === u.owner && b.door >= 0 && !b.build && BUILDINGS[b.type]!.idleSlots) ?? playerKeep(g, u.owner);
  if (!camp || camp.door < 0) return;
  const cx = camp.door % w, cy = Math.floor(camp.door / w);
  for (let r = 1; r < 9; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const t = y * w + x;
        if (mats.has(t) || g.occupancy[t] || g.roads[t] || g.roadPlan[t] || g.map.tiles[t] !== Terrain.Grass || !walkable(g, t, u.owner)) continue;
        u.target = t + 1;
        return;
      }
}

/**
 * Rytm dnia: wieczorem do ogniska albo karczmy, nocą spać, o świcie do pracy. Sprawdzane tylko wtedy, gdy chłop
 * nic nie niesie i stoi między zajęciami (wolny w obozowisku albo pracownik wracający do swojej roboty).
 * Zwraca true, gdy zmienił zajęcie.
 */
/** Wilk bliżej niż tyle pól budzi śpiącego pod gołym niebem */
const WOLF_WAKE = 7;
/** Schronienie przed wilkami: najbliższy budynek z dachem do spania (chata, twierdza), choćby było ciasno */
function nearestShelter(g: GameState, u: Unit): Building | undefined {
  let best: Building | undefined, bd = Infinity;
  for (const b of g.buildings) {
    if (b.owner !== u.owner || !BUILDINGS[b.type]!.housing || b.door < 0 || b.build) continue;
    const d = Math.abs((b.door % g.map.width) * FP - u.px) + Math.abs(Math.floor(b.door / g.map.width) * FP - u.py);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function routine(g: GameState, u: Unit, part: 'work' | 'evening' | 'sleep'): boolean {
  if (u.phase === Phase.Sleeping) {
    // wilk przy posłaniu: zrywa się i ucieka pod najbliższy dach (tam śpi dalej, choćby na ciasno)
    if (!u.home && g.wolves.some((w) => !w.leaving && (w.px - u.px) ** 2 + (w.py - u.py) ** 2 < (WOLF_WAKE * FP) ** 2)) {
      const shelter = nearestShelter(g, u);
      if (shelter) { u.home = shelter.id; u.target = 0; u.phase = Phase.ToSleep; u.path = []; return false; }
    }
    if (part === 'sleep') return true;
    u.home = 0; u.target = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; u.path = [];
    return true;
  }
  if (u.phase === Phase.ToSleep) return false;
  if (u.phase === Phase.Evening || u.phase === Phase.ToEvening) {
    if (part === 'evening') return false;
    // nocne marki: co czwarty siedzi przy ogniu do pierwszej, co siódmy do trzeciej (reszta idzie spać o 22)
    if (part === 'sleep') { const owl = nightOwl(u), { hour } = clockAt(g.tick); if (owl && (hour >= RULES.sleepHour || hour < owl)) return false; }
    if (part === 'sleep') { u.phase = Phase.ToSleep; u.path = []; findBed(g, u); return true; }
    u.target = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; u.path = [];
    return true;
  }
  if (part === 'work' || u.carryRes >= 0 || u.path.length) return false;
  // po fajrancie każdy kończy zajęcie, w którym nie ma nic w rękach: czekanie pod pustym składem, budowę, układanie drogi
  if (!AFTER_HOURS.has(u.phase)) return false;
  u.target = 0; u.timer = 0;
  if (part === 'sleep') { u.phase = Phase.ToSleep; findBed(g, u); return true; }
  u.phase = Phase.ToEvening; u.target = 0;
  return true;
}
/** Znacznik „niesie ciało” w polu carryRes (poza listą surowców) */
export const CORPSE = RESOURCES.length;

function tileOf(g: GameState, u: Unit): number {
  return (u.py >> 8) * g.map.width + (u.px >> 8);
}

function storeDoors(g: GameState, owner: number, kind: StoreKind): Set<number> {
  const doors = new Set<number>();
  for (const b of g.buildings)
    if (b.owner === owner && b.door >= 0 && BUILDINGS[b.type]!.stores?.includes(kind)) doors.add(b.door);
  return doors;
}

/** Dokąd jednostka zmierza w obecnej fazie. null = nigdzie nie idzie. */
function goalFor(g: GameState, u: Unit, job: Building | undefined, prod: ProductionDef | undefined): ((t: number) => boolean) | null {
  switch (u.phase) {
    case Phase.Idle: {
      // inżynier bez zajęcia czeka przy swoim cechu
      if (job) return job.door >= 0 ? (t) => t === job.door : null;
      // bezrobotni czekają w obozowisku przy ognisku, a gdy go nie ma, pod twierdzą
      // każde obozowisko ma ograniczoną liczbę miejsc: idą tylko tam, gdzie jeszcze jest miejsce
      const camps = g.buildings.filter((b) => b.owner === u.owner && b.door >= 0 && BUILDINGS[b.type]!.idleSlots);
      if (camps.length) {
        const w = g.map.width;
        const used = new Map<number, number>();
        for (const o of g.units) {
          if (o === u || o.owner !== u.owner || o.job || o.phase !== Phase.Idle) continue;
          const at = o.path.length ? o.path[o.path.length - 1]! : (o.py >> 8) * w + (o.px >> 8);
          used.set(at, (used.get(at) ?? 0) + 1);
        }
        const doors = new Set<number>();
        for (const b of camps) if ((used.get(b.door) ?? 0) < BUILDINGS[b.type]!.idleSlots!) doors.add(b.door);
        // już stoi przy ognisku, na którym jest: zostaje (nie liczy sam siebie, więc „pełne” go nie wygania)
        if (!doors.size) {
          // przy ogniskach brak miejsc: kopacz czeka pod chatą (każdy pod inną, po kolei według id), a bez chat — przy ognisku
          const houses = g.buildings.filter((b) => b.owner === u.owner && b.door >= 0 && !b.build && BUILDINGS[b.type]!.housing && BUILDINGS[b.type]!.id !== 'keep');
          if (houses.length) { const d = houses[u.id % houses.length]!.door; return (t) => t === d; }
          for (const b of camps) doors.add(b.door);
        }
        return (t) => doors.has(t);
      }
      const keep = playerKeep(g, u.owner);
      return keep && keep.door >= 0 ? (t) => t === keep.door : null;
    }
    case Phase.Returning:
      // wolny chłop z ciałem na ramieniu niesie je na cmentarz, a gdy go nie ma — do obozowiska
      if (!job && u.carryRes === CORPSE) {
        const doors = new Set<number>();
        for (const b of g.buildings) if (b.owner === u.owner && b.door >= 0 && BUILDINGS[b.type]!.id === 'cemetery') doors.add(b.door);
        if (!doors.size) for (const b of g.buildings) if (b.owner === u.owner && b.door >= 0 && BUILDINGS[b.type]!.idleSlots) doors.add(b.door);
        return doors.size ? (t) => doors.has(t) : null;
      }
      return job ? (t) => t === job.door : null;
    case Phase.ToHome:
      return job ? (t) => t === job.door : null;
    case Phase.ToInputStore: {
      const kind = prod?.input ? RESOURCE_DEFS[prod.input.res].store : null;
      if (!kind) return null;
      const doors = storeDoors(g, u.owner, kind);
      return (t) => doors.has(t);
    }
    case Phase.ToStore: {
      // górnik z barakiem: urobek zostaje pod barakiem (do zamku zawiezie go wóz), o ile jest tam miejsce
      const camp = campOf(g, job);
      if (camp && u.carryRes >= 0 && holdTotal(camp) < CAMP_HOLD) return (t) => t === camp.door;
      const kind = u.carryRes >= 0 ? RESOURCE_DEFS[RESOURCES[u.carryRes]!].store : null;
      if (!kind) {
        // ruda (waluta) nie leży w składzie: górnik niesie ją do skarbca w zamku
        if (u.carryRes < 0) return null;
        const keep = playerKeep(g, u.owner);
        return keep && keep.door >= 0 ? (t) => t === keep.door : null;
      }
      const doors = storeDoors(g, u.owner, kind);
      return (t) => doors.has(t);
    }
    case Phase.ToLight: {
      const target = buildingById(g, u.target);
      return target ? (t) => t === target.door : null;
    }
    case Phase.ToRubble: {
      const r = g.rubble.find((x) => x.id === u.target);
      if (!r) return null;
      const w = g.map.width;
      return (t) => { const x = t % w, y = (t - x) / w; return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; };
    }
    case Phase.ToRepair: {
      const b = buildingById(g, u.target);
      if (!b) return null;
      if (b.door >= 0 && !b.build) return (t) => t === b.door;
      // plac budowy (i umocnienia bez wejścia): wystarczy stanąć tuż obok działki
      const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width;
      return (t) => { const x = t % w, y = (t - x) / w; const dx = Math.max(b.x - x, 0, x - (b.x + fp.w - 1)), dy = Math.max(b.y - y, 0, y - (b.y + fp.h - 1)); return Math.max(dx, dy) === 1; };
    }
    case Phase.ToFetch: {
      // po materiał na budowę: do najbliższego składu, w którym leży ten surowiec
      const res = u.timer - 1;
      const kind = res >= 0 ? RESOURCE_DEFS[RESOURCES[res]!].store : null;
      if (!kind || !g.buildings.some((x) => x.id === u.target)) return null;
      const doors = storeDoors(g, u.owner, kind);
      return doors.size ? (t) => doors.has(t) : null;
    }
    case Phase.ToCorpse: {
      const c = g.corpses.find((x) => x.id === u.target);
      if (!c) return null;
      const ct = (c.py >> 8) * g.map.width + (c.px >> 8);
      return (t) => t === ct;
    }
    case Phase.ToPave: {
      const t = u.target - 1;
      return t >= 0 && g.roadPlan[t] ? (x) => x === t : null;
    }
    case Phase.ToPlant: {
      // leśniczy idzie na pole, które ma obsadzić (gdy ktoś je zajął po drodze — wraca)
      const t = u.target - 1;
      return t >= 0 && g.map.tiles[t] === Terrain.Grass && !g.occupancy[t] && !g.reserved[t] ? (x) => x === t : null;
    }
    case Phase.ToRoadFetch: {
      // po materiał na drogę: najbliższe drzwi składu, który trzyma ten surowiec
      const t = u.target - 1, res = u.timer - 1;
      const kind = res >= 0 ? RESOURCE_DEFS[RESOURCES[res]!].store : undefined;
      if (t < 0 || !g.roadPlan[t] || !kind) return null;
      const doors = storeDoors(g, u.owner, kind);
      return doors.size ? (x) => doors.has(x) : null;
    }
    case Phase.ToEvening: {
      // karczmarz zostaje wieczorem u siebie i nalewa
      if (job && job.type === TAVERN && job.door >= 0) return (t) => t === job.door;
      // załoga kopalni z barakiem: wieczór przy ognisku pod barakiem
      const camp = campOf(g, job);
      if (camp) return (t) => t === camp.door;
      // co drugi idzie do karczmy (o ile jest i ma karczmarza), reszta siada przy ognisku; bez nich — pod twierdzę
      let doors = u.id % 2 === 0 ? eveningDoors(g, u.owner, true) : new Set<number>();
      if (!doors.size) doors = eveningDoors(g, u.owner, false);
      if (!doors.size) { const keep = playerKeep(g, u.owner); if (keep && keep.door >= 0) doors.add(keep.door); }
      return doors.size ? (t) => doors.has(t) : null;
    }
    case Phase.ToSleep: {
      if (u.home) { const b = buildingById(g, u.home); return b && b.door >= 0 ? (t) => t === b.door : null; }
      const mat = u.target - 1;
      return mat >= 0 ? (t) => t === mat : null;
    }
    case Phase.ToRest: {
      const restCamp = campOf(g, job);
      if (restCamp) return (t) => t === restCamp.door;
      const doors = new Set<number>();
      for (const b of g.buildings) if (b.owner === u.owner && b.door >= 0 && b.type === HOUSE) doors.add(b.door);
      return doors.size ? (t) => doors.has(t) : null;
    }
    case Phase.ToSite: {
      const site = prod?.site;
      if (site === undefined || site === 'home') return null;
      if (site === 'shore') {
        // brzeg: wolne pole, które sąsiaduje z wodą
        const w = g.map.width, h = g.map.height;
        return (t) => {
          if (g.occupancy[t] !== 0) return false;
          const x = t % w, y = (t - x) / w;
          return (x > 0 && g.map.tiles[t - 1] === Terrain.Water) || (x < w - 1 && g.map.tiles[t + 1] === Terrain.Water) ||
            (y > 0 && g.map.tiles[t - w] === Terrain.Water) || (y < h - 1 && g.map.tiles[t + w] === Terrain.Water);
        };
      }
      return (t) => g.map.tiles[t] === site && g.occupancy[t] === 0;
    }
    default:
      return null;
  }
}

function beginCycle(u: Unit, prod: ProductionDef): void {
  // z przyniesionego pnia zostały jeszcze partie do pocięcia: najpierw one, potem następne drzewo
  if (u.batches > 0 && prod.processTicks) { u.phase = Phase.Working; u.timer = prod.processTicks; return; }
  if (prod.input) u.phase = Phase.ToInputStore;
  else if (prod.site !== 'home') u.phase = Phase.ToSite;
  else { u.phase = Phase.Working; u.timer = prod.workTicks; }
}

function arrive(g: GameState, u: Unit, prod: ProductionDef | undefined): void {
  const p = g.players[u.owner]!;
  switch (u.phase) {
    case Phase.Returning:
      if (u.carryRes === CORPSE) { u.carryRes = -1; u.carryAmt = 0; }
      if (prod) beginCycle(u, prod); else u.phase = Phase.Idle;
      // kopalnia: kopanie zaczyna się dopiero przy skale — doliczamy drogę sztolnią do przodka i z powrotem do wrót
      if ((u.phase as Phase) === Phase.Working && u.job) {
        const mine = buildingById(g, u.job);
        if (mine && mine.type === OREMINE) u.timer += 2 * mineWalkTicks(Math.max(0, crewOf(mine).indexOf(u.id)));
      }
      break;
    case Phase.ToInputStore: {
      const inp = prod?.input;
      if (!inp) { u.phase = Phase.Returning; break; }
      const i = resIndex(inp.res);
      if (p.res[i]! >= inp.amount) {
        p.res[i]! -= inp.amount;
        u.carryRes = i; u.carryAmt = inp.amount; u.phase = Phase.ToHome;
      } else u.wait = RETRY_TICKS; // brak surowca: czeka przy magazynie
      break;
    }
    case Phase.ToHome:
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = Phase.Working; u.timer = (prod?.input ? prod.workTicks : prod?.processTicks) ?? prod?.workTicks ?? 0;
      break;
    case Phase.ToSite:
      u.phase = Phase.WorkingSite; u.timer = prod?.workTicks ?? 0;
      break;
    case Phase.ToPlant:
      u.phase = Phase.Planting; u.timer = RULES.plantTicks;
      break;
    case Phase.ToStore:
      if (u.carryRes >= 0 && u.job) {
        // przy baraku górników: odkłada urobek pod barakiem; nadmiar (pełny barak) niesie dalej do wioski
        const mine = buildingById(g, u.job), camp = campOf(g, mine);
        if (camp && camp.door === tileOf(g, u)) {
          const put = putInHold(camp, u.carryRes, u.carryAmt);
          p.stats.gathered += put;
          if (mine && put) mine.made = (mine.made ?? 0) + put;
          u.carryAmt -= put;
          if (u.carryAmt > 0) { u.wait = RETRY_TICKS; break; } // pełno pod barakiem: następna próba pójdzie już do składu
          u.carryRes = -1;
          u.phase = Phase.Returning;
          if (++u.trips >= RULES.restEvery) { u.trips = 0; u.phase = Phase.ToRest; }
          break;
        }
      }
      if (u.carryRes >= 0) {
        // oddaje tyle, ile się zmieści; z resztą czeka przy składzie, aż zwolni się miejsce
        // zboże w spichlerzu najwyżej do połowy (storeRoom), żeby zostało miejsce na jedzenie
        const free = Math.min(u.carryAmt, storeRoom(g, u.owner, u.carryRes));
        const put = Math.max(0, Math.min(u.carryAmt, free));
        p.res[u.carryRes]! += put;
        p.stats.gathered += put;
        u.carryAmt -= put;
        // licznik warsztatu: towar z własnej produkcji (okno budynku pokazuje, ile zrobił i ile przepadło)
        const shopB = u.job ? buildingById(g, u.job) : undefined;
        const shop = shopB && prod && (resIndex(prod.output.res) === u.carryRes || shopB.type === OREMINE) ? shopB : undefined;
        if (shop && put) shop.made = (shop.made ?? 0) + put;
        // skład pełny: chwilę czeka, a gdy dalej nie ma miejsca, zostawia ładunek i wraca do pracy (nie stoi w nieskończoność)
        if (u.carryAmt > 0 && ++u.timer < 6) { u.wait = RETRY_TICKS; break; }
        if (shop && u.carryAmt > 0) shop.lost = (shop.lost ?? 0) + u.carryAmt;
        u.timer = 0;
      }
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      // co kilka dostaw idzie posiedzieć w chacie, o ile jakaś stoi
      if (++u.trips >= RULES.restEvery && (g.buildings.some((b) => b.owner === u.owner && b.type === HOUSE) || !!campOf(g, u.job ? buildingById(g, u.job) : undefined))) { u.trips = 0; u.phase = Phase.ToRest; }
      break;
    case Phase.ToRubble: {
      const i = g.rubble.findIndex((x) => x.id === u.target);
      const r = g.rubble[i];
      u.target = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      const load = r?.loads.pop();
      if (!r || !load) break;
      if (load[0] >= 0) { u.carryRes = load[0]; u.carryAmt = load[1]; u.phase = Phase.ToStore; }
      if (!r.loads.length) {
        // ostatni ładunek zabrany: działka jest znowu wolna
        for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) g.reserved[ty * g.map.width + tx]!--;
        g.rubble.splice(i, 1);
      }
      break;
    }
    case Phase.ToLight: {
      const target = buildingById(g, u.target);
      if (target) target.lit = true;
      u.target = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      break;
    }
    case Phase.ToFetch:
      // bierze ładunek ze składu (zapłacony już przy stawianiu budynku) i niesie go na plac
      u.carryRes = u.timer - 1; u.carryAmt = 1; u.timer = 0;
      u.phase = Phase.ToRepair;
      break;
    case Phase.ToPave:
      // przyniesiony materiał idzie w drogę
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = Phase.Paving; u.timer = PAVE_TICKS;
      break;
    case Phase.ToRoadFetch:
      // bierze ze składu deski albo kamień (zapłacone już przy stawianiu drogi) i niesie na pole
      u.carryRes = u.timer - 1; u.carryAmt = 1; u.timer = 0;
      u.phase = Phase.ToPave;
      break;
    case Phase.ToRepair: {
      // przyniesiony materiał kładzie obok budowy, potem bierze się do roboty
      if (u.carryRes >= 0) {
        const b = buildingById(g, u.target);
        if (b && b.build && b.loads) b.delivered = (b.delivered ?? 0) + 1;
        u.carryRes = -1; u.carryAmt = 0;
      }
      u.phase = Phase.Repairing;
      break;
    }
    case Phase.ToCorpse: {
      // grabarz bierze ciało na ramię i niesie je na cmentarz
      g.corpses = g.corpses.filter((x) => x.id !== u.target);
      u.target = 0;
      u.carryRes = CORPSE; u.carryAmt = 1;
      u.phase = Phase.Returning;
      break;
    }
    case Phase.ToEvening:
      u.phase = Phase.Evening;
      break;
    case Phase.ToSleep:
      u.phase = Phase.Sleeping;
      break;
    case Phase.ToRest: {
      const here = tileOf(g, u);
      const restCamp = campOf(g, u.job ? buildingById(g, u.job) : undefined);
      const house = restCamp && restCamp.door === here ? restCamp : g.buildings.find((b) => b.owner === u.owner && b.type === HOUSE && b.door === here);
      if (house) { u.home = house.id; u.phase = Phase.Resting; u.timer = RULES.restTicks; }
      else u.phase = u.job ? Phase.Returning : Phase.Idle;
      break;
    }
    default:
      break;
  }
}

function move(g: GameState, u: Unit): void {
  const next = u.path[0]!;
  if (!walkable(g, next, u.owner)) { u.path = []; return; } // ktoś postawił budynek na drodze
  const w = g.map.width;
  const nx = next % w, ny = (next - nx) / w;
  const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2;
  const dx = tx - u.px, dy = ty - u.py;
  const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
  // uciekający przed wrogiem biegnie co sił (ok. 1,7 raza szybciej)
  const speed = Math.round((base * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, u)]!]!) * ((u.fled ?? 0) > g.tick ? 170 : 100)) / 10000);
  u.px += Math.max(-speed, Math.min(speed, dx));
  u.py += Math.max(-speed, Math.min(speed, dy));
  if (u.px === tx && u.py === ty) u.path.shift();
}

/** Przydziela bezrobotnych do budynków bez pracownika i prowadzi chłopów przez cykl pracy. */
export function workerSystem(g: GameState): void {
  const byId = new Map<number, Building>();
  for (const b of g.buildings) byId.set(b.id, b);

  for (const b of g.buildings) {
    if (b.worker !== 0 || b.build || b.off || !(BUILDINGS[b.type]!.production || BUILDINGS[b.type]!.staff)) continue;
    // najpierw ktoś, kto nic nie robi; budowniczego, latarnika czy tragarza gruzu zabieramy dopiero, gdy nie ma innych,
    // a nikogo z ładunkiem w rękach. Stare zadanie (target) się kasuje, żeby nie blokowało go później.
    const u = g.units.find((x) => x.owner === b.owner && x.job === 0 && x.phase === Phase.Idle && x.carryRes < 0)
      ?? g.units.find((x) => x.owner === b.owner && x.job === 0 && x.carryRes < 0 && x.phase !== Phase.ToCorpse && !OFF_DUTY.has(x.phase));
    if (!u) continue;
    u.job = b.id; u.phase = Phase.Returning; u.path = []; u.wait = 0; u.target = 0;
    b.worker = u.id;
  }
  // kopalnia i cech inżynierów: załoga rośnie z wioską (więcej mieszkańców = więcej ludzi w pracy) i maleje, gdy wioska się kurczy
  if (g.tick % 10 === 0) {
    const pop = new Map<number, number>();
    for (const u of g.units) pop.set(u.owner, (pop.get(u.owner) ?? 0) + 1);
    for (const b of g.buildings) {
      const def = BUILDINGS[b.type]!;
      if (!def.crew || b.build || b.off || b.ruined || !b.worker) continue;
      const want = crewWanted(def, pop.get(b.owner) ?? 0);
      b.crew ??= [];
      // załoga bez brygadzisty nie zostaje (worker zwalnia się np. przy śmierci) — awans pierwszego z załogi robi dropWorker
      while (b.crew.length + 1 > want) {
        const id = b.crew.pop()!;
        const u = g.units.find((x) => x.id === id);
        if (u) { u.job = 0; u.phase = Phase.Idle; u.path = []; u.carryRes = -1; u.carryAmt = 0; u.timer = 0; u.target = 0; }
      }
      if (b.crew.length + 1 < want) {
        const u = g.units.find((x) => x.owner === b.owner && x.job === 0 && x.phase === Phase.Idle && x.carryRes < 0);
        if (u) { u.job = b.id; u.phase = Phase.Returning; u.path = []; u.wait = 0; u.target = 0; b.crew.push(u.id); }
      }
      if (!b.crew.length) delete b.crew;
    }
  }

  const part = dayPart(g.tick);
  // o trzeciej w nocy liczymy, kto śpi pod gołym niebem; w deszczu marzną (tracą trochę zdrowia, ale nie umierają)
  if (hourStarts(g.tick, 3)) {
    const wet = rainAt(g.tick) > 0.3;
    for (const p of g.players) { p.rough = 0; p.cold = 0; }
    for (const u of g.units) {
      if (u.phase !== Phase.Sleeping || u.home) continue;
      const p = g.players[u.owner];
      if (!p) continue;
      p.rough = (p.rough ?? 0) + 1;
      if (wet) { p.cold = (p.cold ?? 0) + 1; u.hp = Math.max(10, (u.hp ?? 30) - 8); }
    }
  }
  for (const u of g.units) {
    if (u.wait > 0) { u.wait--; continue; }
    // rekrut idzie do koszar (prowadzi go enlistSystem): tylko krok, bez pracy, wieczoru i snu
    if (u.enlist) { if (u.path.length) move(g, u); continue; }
    // gasi pożar (prowadzi go fireSystem): tylko krok
    if (u.bucket) { if (u.path.length) move(g, u); continue; }
    if (!u.path.length && routine(g, u, part) && (u.phase === Phase.Sleeping || u.phase === Phase.Evening)) continue;
    if (u.phase === Phase.Evening || u.phase === Phase.Sleeping) continue;
    const job = u.job ? byId.get(u.job) : undefined;
    const prod = job ? BUILDINGS[job.type]!.production : undefined;

    if (u.phase === Phase.Paving) {
      // układa drogę: po chwili pole jest gotowe (chyba że plan zdjęto w trakcie)
      if (--u.timer > 0) continue;
      const t = u.target - 1;
      if (t >= 0 && g.roadPlan[t]) { g.roads[t] = g.roadPlan[t]!; g.roadPlan[t] = 0; }
      u.target = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      continue;
    }
    if (u.phase === Phase.Planting) {
      // sadzi drzewko: po chwili na polu zostaje sadzonka, a leśniczy wraca pod chatę po następną
      if (--u.timer > 0) continue;
      plantSapling(g, u);
      u.target = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      continue;
    }
    if (u.phase === Phase.Resting) {
      if (--u.timer <= 0) { u.home = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; }
      continue;
    }
    if (u.phase === Phase.Working || u.phase === Phase.WorkingSite) {
      if (--u.timer > 0 || !prod) continue;
      if (u.phase === Phase.WorkingSite && prod.site === Terrain.Forest) {
        // ścięte drzewo znika: pole lasu zamienia się w polanę, na której można budować
        const tile = tileOf(g, u);
        if (g.map.tiles[tile] === Terrain.Forest) { g.map.tiles[tile] = Terrain.Grass; g.cut.push(tile); }
      } else if (u.phase === Phase.WorkingSite && (prod.site === Terrain.Stone || prod.site === Terrain.Iron)) {
        // złoże się zużywa: po kilku wydobyciach pole jest puste i zostaje zwykła ziemia
        const tile = tileOf(g, u);
        if (g.map.tiles[tile] === prod.site && ++g.wear[tile]! >= RULES.depositYields) { g.map.tiles[tile] = Terrain.Grass; g.cut.push(tile); }
      }
      u.carryRes = resIndex(prod.output.res);
      u.carryAmt = prod.output.amount;
      if (job && job.type === OREMINE) {
        // kopalnia: z jednego kursu wychodzi kamień, żelazo albo (rzadko) ruda — losowane z ziarna meczu
        let roll = g.rng.int(100);
        let pick = MINE_YIELDS[0]!;
        for (const y of MINE_YIELDS) { pick = y; if ((roll -= y.weight) < 0) break; }
        u.carryRes = resIndex(pick.res); u.carryAmt = pick.amount;
      }
      // z lasu drwal niesie kłodę najpierw do chaty, tam robi deski i dopiero je odnosi do składu
      if (u.phase === Phase.WorkingSite && prod.processTicks) { u.phase = Phase.ToHome; u.batches = prod.batches ?? 1; }
      else { u.phase = Phase.ToStore; if (u.batches > 0) u.batches--; }
      continue;
    }
    if (u.path.length) { move(g, u); continue; }
    // wróg pod kopalnią: górnik czeka w ukryciu (pod barakiem albo w zamku), aż alarm minie (minecamp.ts, mineThreats)
    if (job && job.type === OREMINE && u.phase === Phase.Returning && (job.threat ?? 0) > g.tick) { u.wait = 10; continue; }

    const goal = goalFor(g, u, job, prod);
    if (!goal) {
      if (u.phase === Phase.ToRoadFetch) {
        // skład zniknął: droga i tak powstanie, chłop idzie prosto na pole (plan zdjęty: wraca)
        const t = u.target - 1;
        u.timer = 0;
        if (t >= 0 && g.roadPlan[t]) u.phase = Phase.ToPave;
        else { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; }
        continue;
      }
      if (u.phase === Phase.ToPave && u.carryRes >= 0) { u.carryRes = -1; u.carryAmt = 0; } // plan zdjęty po drodze: materiał zostaje
      if (u.phase === Phase.ToFetch) {
        // skład zniknął albo budowa: ładunek liczy się jako przyniesiony, żeby budowa nie stanęła
        const b = buildingById(g, u.target);
        if (b && b.build && b.loads) b.delivered = (b.delivered ?? 0) + 1;
        u.timer = 0;
        u.phase = b && b.build ? Phase.ToRepair : u.job ? Phase.Returning : Phase.Idle;
        if (!b || !b.build) u.target = 0;
        continue;
      }
      if (u.phase === Phase.ToSleep || u.phase === Phase.ToEvening) {
        // nie ma dokąd iść (chata zniknęła, brak ogniska): kładzie się albo siada tam, gdzie stoi
        if (u.phase === Phase.ToSleep && u.home) { findBed(g, u); if (!u.home && !u.target) u.target = tileOf(g, u) + 1; continue; }
        if (u.phase === Phase.ToSleep && !u.target) u.target = tileOf(g, u) + 1;
        u.phase = u.phase === Phase.ToSleep ? Phase.Sleeping : Phase.Evening;
        continue;
      }
      if (u.phase === Phase.ToRest || u.phase === Phase.ToLight || u.phase === Phase.ToRubble || u.phase === Phase.ToCorpse || u.phase === Phase.ToRepair || u.phase === Phase.ToPave || u.phase === Phase.ToPlant) {
        if (u.phase === Phase.ToRepair && u.carryRes >= 0) { u.carryRes = -1; u.carryAmt = 0; } // budowa skończona po drodze: materiał zostaje
        u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0;
      }
      continue;
    }
    const here = tileOf(g, u);
    if (goal(here)) { arrive(g, u, prod); continue; }
    const path = findPath(g, here, goal, 900, u.owner, -1, 0, true);
    if (path && path.length) u.path = path;
    else if (!path && (u.phase === Phase.ToSleep || u.phase === Phase.ToEvening)) {
      // nie da się dojść (np. zamknięty w murach): śpi albo siedzi tam, gdzie stoi
      if (u.phase === Phase.ToSleep) { u.home = 0; u.target = here + 1; u.phase = Phase.Sleeping; } else u.phase = Phase.Evening;
    } else if (!path && u.phase === Phase.ToPlant) {
      // pole nieosiągalne (np. za wodą): chata je zapamiętuje, leśniczy wraca i wybierze inne
      if (job) { (job.miss ??= []).push(u.target - 1); if (job.miss.length > 8) job.miss.shift(); }
      u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; u.wait = RETRY_TICKS;
    }
    else if (!path && (u.phase === Phase.ToPave || u.phase === Phase.ToRoadFetch)) { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; u.timer = 0; u.carryRes = -1; u.carryAmt = 0; u.wait = RETRY_TICKS; } // pole drogi albo skład nieosiągalne
    else u.wait = RETRY_TICKS;
  }
}

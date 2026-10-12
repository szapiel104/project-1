import { BUILDINGS, buildingIndex } from '../data/buildings';
import type { MAP_PRESETS } from '../data/maps';
import { RESOURCES, RESOURCE_DEFS, resIndex, type ResourceId, type StoreKind } from '../data/resources';
import { RULES } from '../data/rules';
import { generateMap, type GameMap } from './map';
import { Rng } from './rng';
import { addBuilding } from './systems/placement';
import { spawnPeasant } from './systems/population';

/** Częstotliwość symulacji. Render interpoluje między tickami. */
export const TICKS_PER_SECOND = 10;
/** Stały przecinek pozycji jednostek: 256 = jedno pole */
export const FP = 256;

export interface PlayerState {
  id: number;
  team: number;
  /** Zasoby, indeksy jak w RESOURCES */
  res: Int32Array;
  popularity: number;
  /** Ostatnia miesięczna zmiana popularności (do interfejsu) */
  popDelta: number;
  rations: number;
  tax: number;
}

export interface Building {
  id: number;
  /** Indeks w BUILDINGS */
  type: number;
  owner: number;
  x: number;
  y: number;
  /** Obrót co 90°: 0 = wejście od dołu mapy, 1 = z prawej, 2 = od góry, 3 = z lewej */
  rot: number;
  /** Pole, z którego chłopi wchodzą do budynku */
  door: number;
  /** Id pracującego chłopa albo 0 */
  worker: number;
  /** Czy pochodnia przy budynku jest zapalona (zapalają ją ludzie o zmierzchu, gaśnie o świcie) */
  lit: boolean;
}

/** Gruz po rozebranym budynku. Leży na działce, dopóki ludzie nie wyniosą wszystkich ładunków. */
export interface Rubble {
  id: number;
  owner: number;
  /** Typ rozebranego budynku (dla wyglądu gruzu) */
  type: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pozostałe ładunki: [indeks surowca albo -1 dla bezwartościowego gruzu, ilość] */
  loads: [number, number][];
  /** Ile ładunków było na początku (żeby stos malał na oczach) */
  total: number;
}

export const enum Phase {
  Idle = 0,
  /** Wraca do swojego budynku, żeby zacząć cykl pracy */
  Returning = 1,
  ToInputStore = 2,
  ToHome = 3,
  Working = 4,
  ToSite = 5,
  WorkingSite = 6,
  ToStore = 7,
  /** Idzie odpocząć do chaty */
  ToRest = 8,
  Resting = 9,
  /** Idzie zapalić pochodnię przy budynku `target` */
  ToLight = 10,
  /** Idzie po ładunek gruzu z rozbiórki `target` */
  ToRubble = 11,
  /** Grabarz idzie po ciało poległego `target` */
  ToCorpse = 12,
}

export interface Unit {
  id: number;
  owner: number;
  /** Pozycja w stałym przecinku (środek pola = pole * 256 + 128) */
  px: number;
  py: number;
  path: number[];
  /** Id budynku, w którym pracuje, albo 0 */
  job: number;
  phase: Phase;
  timer: number;
  /** Ile ticków czeka przed kolejną próbą znalezienia drogi */
  wait: number;
  /** Indeks niesionego surowca albo -1 */
  carryRes: number;
  carryAmt: number;
  /** Ile partii towaru zostało jeszcze do zrobienia z przyniesionego surowca */
  batches: number;
  /** Dostawy od ostatniego odpoczynku */
  trips: number;
  /** Id chaty, w której właśnie odpoczywa, albo 0 */
  home: number;
  /** Id budynku, przy którym ma zapalić pochodnię, albo 0 */
  target: number;
}

/** Żołnierz: osobno od chłopów, bo nie pracuje, nie mieszka i nie liczy się do ludności osady */
export interface Soldier {
  id: number;
  owner: number;
  /** Indeks w data/units.ts */
  kind: number;
  px: number;
  py: number;
  path: number[];
  hp: number;
  /** Pole, na które ma dojść, albo -1 */
  goal: number;
  wait: number;
  /** Id wroga, z którym walczy, albo 0 */
  target: number;
  /** Ticki do następnego ciosu */
  cd: number;
}

/** Ciało poległego: leży, aż zabierze je grabarz z cmentarza */
export interface Corpse {
  id: number;
  owner: number;
  kind: number;
  px: number;
  py: number;
  /** Tick śmierci (do rozkładu w wyglądzie) */
  at: number;
  /** Grabarz już po nie idzie */
  taken: boolean;
}

export interface GameState {
  tick: number;
  map: GameMap;
  rng: Rng;
  players: PlayerState[];
  buildings: Building[];
  units: Unit[];
  soldiers: Soldier[];
  corpses: Corpse[];
  /** Id budynku na polu albo 0 */
  occupancy: Int32Array;
  /** Ile wejść do budynków leży na polu (takiego pola nie wolno zabudować) */
  reserved: Uint8Array;
  /** Pola lasu wycięte przez drwali, w kolejności wycinki (dla zapisu gry i renderera) */
  cut: number[];
  /** Ile razy wydobyto już surowiec z danego pola złoża */
  wear: Uint8Array;
  /** Drogi na polach: 0 brak, 1 piaskowa, 2 kamienna */
  roads: Uint8Array;
  rubble: Rubble[];
  nextId: number;
}

export function createGame(seed: number, preset: keyof typeof MAP_PRESETS = '1v1'): GameState {
  const map = generateMap(seed, preset);
  const size = map.width * map.height;
  const g: GameState = {
    tick: 0, map, rng: new Rng(seed), players: [], buildings: [], units: [], soldiers: [], corpses: [],
    occupancy: new Int32Array(size), reserved: new Uint8Array(size), cut: [], wear: new Uint8Array(size), roads: new Uint8Array(size), rubble: [], nextId: 1,
  };
  const keep = buildingIndex('keep');
  const starts = [...map.starts].sort((a, b) => a.player - b.player);
  for (const s of starts) {
    const res = new Int32Array(RESOURCES.length);
    for (const [k, v] of Object.entries(RULES.startResources)) res[resIndex(k as ResourceId)] = v;
    g.players.push({
      id: s.player, team: s.team, res, popularity: RULES.startPopularity, popDelta: 0,
      rations: RULES.defaultRations, tax: RULES.defaultTax,
    });
    addBuilding(g, keep, s.player, s.x - 1, s.y - 1);
    placeNear(g, buildingIndex('barn'), s.player, s.x, s.y);
    placeNear(g, CAMP, s.player, s.x, s.y);
    for (let i = 0; i < RULES.startPeasants; i++) spawnPeasant(g, s.player);
  }
  return g;
}

const CAMP = buildingIndex('camp');

/** Stawia budynek startowy na pierwszym wolnym miejscu przy twierdzy (stała kolejność szukania). */
function placeNear(g: GameState, type: number, player: number, cx: number, cy: number): void {
  const def = BUILDINGS[type]!;
  const w = g.map.width;
  for (let r = 3; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        let free = true;
        // z wolnym pasem dookoła, żeby nic nie zatkało przejść
        for (let ty = y - 1; ty <= y + def.h && free; ty++)
          for (let tx = x - 1; tx <= x + def.w; tx++) {
            const t = ty * w + tx;
            if (tx < 0 || ty < 0 || tx >= w || ty >= g.map.height || g.map.tiles[t] !== 0 || g.occupancy[t] !== 0 || g.reserved[t] !== 0) { free = false; break; }
          }
        if (free) { addBuilding(g, type, player, x, y); return; }
      }
}

/** Miejsca dla bezrobotnych we wszystkich obozowiskach gracza. */
export function idleSlots(g: GameState, player: number): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === player) n += BUILDINGS[b.type]!.idleSlots ?? 0;
  return n;
}

export function idleCount(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player && u.job === 0) n++;
  return n;
}

export function playerKeep(g: GameState, player: number): Building | undefined {
  return g.buildings.find((b) => b.owner === player && b.type === 0);
}

export function housing(g: GameState, player: number): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === player) n += BUILDINGS[b.type]!.housing ?? 0;
  return n;
}

/** Łączna pojemność składów albo spichlerzy gracza. */
export function storeCapacity(g: GameState, player: number, kind: StoreKind): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === player) n += BUILDINGS[b.type]!.capacity?.[kind] ?? 0;
  return n;
}

/** Ile surowców danego rodzaju gracz ma teraz w składach albo spichlerzach. */
export function storeUsed(p: PlayerState, kind: StoreKind): number {
  let n = 0;
  for (let i = 0; i < RESOURCES.length; i++) if (RESOURCE_DEFS[RESOURCES[i]!].store === kind) n += p.res[i]!;
  return n;
}

export function population(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player) n++;
  return n;
}

/** Skrót całego stanu (FNV‑1a). Klienci porównują go, żeby wykryć rozjazd symulacji. */
export function stateHash(g: GameState): number {
  let h = 0x811c9dc5;
  const add = (v: number): void => {
    for (let i = 0; i < 4; i++) { h ^= (v >>> (i * 8)) & 255; h = Math.imul(h, 0x01000193); }
  };
  add(g.tick); add(g.rng.state); add(g.nextId); add(g.cut.length);
  for (let i = 0; i < g.map.tiles.length; i++) { h ^= g.map.tiles[i]!; h = Math.imul(h, 0x01000193); }
  for (let i = 0; i < g.wear.length; i++) if (g.wear[i]) { add(i); add(g.wear[i]!); }
  for (let i = 0; i < g.roads.length; i++) if (g.roads[i]) { add(i); add(g.roads[i]! + 100); }
  for (const r of g.rubble) { add(r.id); add(r.owner); add(r.x); add(r.y); add(r.loads.length); for (const [a, b] of r.loads) { add(a + 1); add(b); } }
  for (const p of g.players) {
    add(p.id); add(p.popularity); add(p.popDelta); add(p.rations); add(p.tax);
    for (let i = 0; i < p.res.length; i++) add(p.res[i]!);
  }
  for (const b of g.buildings) { add(b.id); add(b.type); add(b.owner); add(b.x); add(b.y); add(b.door); add(b.worker); add(b.lit ? 1 : 0); add(b.rot); }
  for (const u of g.units) {
    add(u.id); add(u.owner); add(u.px); add(u.py); add(u.job); add(u.phase); add(u.timer); add(u.wait);
    add(u.carryRes); add(u.carryAmt); add(u.trips); add(u.home); add(u.batches); add(u.target); add(u.path.length);
    for (const t of u.path) add(t);
  }
  for (const s of g.soldiers) { add(s.id); add(s.owner); add(s.kind); add(s.px); add(s.py); add(s.hp); add(s.goal + 1); add(s.wait); add(s.target); add(s.cd); add(s.path.length); for (const t of s.path) add(t); }
  for (const c of g.corpses) { add(c.id); add(c.px); add(c.py); add(c.at); add(c.taken ? 1 : 0); }
  return h >>> 0;
}

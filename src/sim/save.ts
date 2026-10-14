import { BUILDINGS, footprint } from '../data/buildings';
import type { MapPresetId } from '../data/maps';
import { MAP_PRESETS } from '../data/maps';
import { RESOURCES } from '../data/resources';
import { generateMap } from './map';
import { Rng } from './rng';
import { openWalk } from './systems/placement';
import type { Building, Corpse, Traveler, Wolf, GameState, March, PlayerState, Rubble, Soldier, Unit } from './state';

/** Zmieniamy przy każdej zmianie kształtu stanu; stary zapis jest wtedy odrzucany zamiast psuć grę. */
export const SAVE_VERSION = 20;

export interface SaveData {
  v: number;
  /** Liczba typów budynków i surowców w chwili zapisu: inna lista = zapis nieważny */
  shape: string;
  seed: number;
  preset: MapPresetId;
  tick: number;
  rng: number;
  nextId: number;
  cut: number[];
  /** Zużycie złóż jako pary [pole, liczba wydobyć] */
  wear: [number, number][];
  roads: [number, number][];
  roadPlan?: [number, number][];
  rubble: Rubble[];
  players: (Omit<PlayerState, 'res'> & { res: number[] })[];
  buildings: Building[];
  units: Unit[];
  soldiers: Soldier[];
  corpses: Corpse[];
  travelers?: Traveler[];
  wolves?: Wolf[];
  marches?: March[];
}

const shape = (): string => `${BUILDINGS.length}/${RESOURCES.length}`;
/** Zapis z gry, w której było mniej rodzajów budynków (nowe dopisujemy tylko na końcu listy), nadal się wczyta */
function shapeOk(s: string): boolean {
  const [b, r] = String(s).split('/').map(Number);
  return r === RESOURCES.length && Number.isInteger(b) && b! > 0 && b! <= BUILDINGS.length;
}

/** Zapis gry jako zwykłe dane (JSON). Mapy nie zapisujemy: odtwarza się z ziarna. */
export function serialize(g: GameState, preset: MapPresetId): SaveData {
  return {
    v: SAVE_VERSION, shape: shape(), seed: g.map.seed, preset, tick: g.tick, rng: g.rng.state, nextId: g.nextId, cut: [...g.cut], wear: [...g.wear].flatMap((n, i) => (n ? [[i, n] as [number, number]] : [])),
    roads: [...g.roads].flatMap((n, i) => (n ? [[i, n] as [number, number]] : [])),
    roadPlan: [...g.roadPlan].flatMap((n, i) => (n ? [[i, n] as [number, number]] : [])),
    rubble: g.rubble.map((r) => ({ ...r, loads: r.loads.map((l) => [...l] as [number, number]) })),
    players: g.players.map((p) => ({ ...p, res: [...p.res], stats: { ...p.stats } })),
    buildings: g.buildings.map((b) => ({ ...b })),
    units: g.units.map((u) => ({ ...u, path: [...u.path] })),
    soldiers: g.soldiers.map((x) => ({ ...x, path: [...x.path], ...(x.slot ? { slot: [...x.slot] as [number, number] } : {}) })),
    marches: (g.marches ?? []).map((m) => ({ ...m, path: [...m.path] })),
    corpses: g.corpses.map((c) => ({ ...c })),
    travelers: g.travelers.map((t) => ({ ...t, path: [...t.path] })),
    wolves: g.wolves.map((w) => ({ ...w, path: [...w.path] })),
  };
}

/** Odtwarza grę z zapisu. Zwraca null, gdy zapis jest z innej wersji albo uszkodzony. */
export function deserialize(d: SaveData): GameState | null {
  try {
    if (d.v !== SAVE_VERSION || !shapeOk(d.shape) || !(d.preset in MAP_PRESETS)) return null;
    const map = generateMap(d.seed, d.preset);
    const size = map.width * map.height;
    const g: GameState = {
      tick: d.tick, map, rng: new Rng(d.rng, true), nextId: d.nextId,
      players: d.players.map((p) => ({ ...p, res: Int32Array.from(p.res), stats: { ...p.stats } })),
      buildings: d.buildings.map((b) => ({ ...b })),
      units: d.units.map((u) => ({ ...u, path: [...u.path] })),
      soldiers: (d.soldiers ?? []).map((x) => ({ ...x, path: [...x.path] })),
      marches: (d.marches ?? []).map((m) => ({ ...m, path: [...m.path] })),
      corpses: (d.corpses ?? []).map((c) => ({ ...c })),
      travelers: (d.travelers ?? []).map((t) => ({ ...t, path: [...t.path] })),
      wolves: (d.wolves ?? []).map((w) => ({ ...w, path: [...w.path] })),
      occupancy: new Int32Array(size), gates: new Uint8Array(size), walls: new Uint8Array(size), reserved: new Uint8Array(size), cut: [...d.cut], wear: new Uint8Array(size), roads: new Uint8Array(size), roadPlan: new Uint8Array(size),
      rubble: d.rubble.map((r) => ({ ...r, loads: r.loads.map((l) => [...l] as [number, number]) })),
    };
    for (const r of g.rubble) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g.reserved[y * map.width + x]!++;
    for (const [t, n] of d.wear) g.wear[t] = n;
    for (const [t, n] of d.roads) g.roads[t] = n;
    for (const [t, n] of d.roadPlan ?? []) g.roadPlan[t] = n;
    for (const t of g.cut) map.tiles[t] = 0; // wycięty las to łąka
    for (const b of g.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) return null;
      const fp = footprint(def, b.rot);
      for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) g.occupancy[y * map.width + x] = b.id;
      if (b.door >= 0) g.reserved[b.door]!++;
      if (def.gate && !b.shut) g.gates[b.y * map.width + b.x] = b.owner + 1;
      openWalk(g, b);
    }
    return g;
  } catch {
    return null;
  }
}

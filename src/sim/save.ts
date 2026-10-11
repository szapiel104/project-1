import { BUILDINGS } from '../data/buildings';
import type { MapPresetId } from '../data/maps';
import { MAP_PRESETS } from '../data/maps';
import { RESOURCES } from '../data/resources';
import { generateMap } from './map';
import { Rng } from './rng';
import type { Building, GameState, PlayerState, Unit } from './state';

/** Zmieniamy przy każdej zmianie kształtu stanu; stary zapis jest wtedy odrzucany zamiast psuć grę. */
export const SAVE_VERSION = 2;

export interface SaveData {
  v: number;
  /** Liczba typów budynków i surowców w chwili zapisu: inna lista = zapis nieważny */
  shape: string;
  seed: number;
  preset: MapPresetId;
  tick: number;
  rng: number;
  nextId: number;
  players: (Omit<PlayerState, 'res'> & { res: number[] })[];
  buildings: Building[];
  units: Unit[];
}

const shape = (): string => `${BUILDINGS.length}/${RESOURCES.length}`;

/** Zapis gry jako zwykłe dane (JSON). Mapy nie zapisujemy: odtwarza się z ziarna. */
export function serialize(g: GameState, preset: MapPresetId): SaveData {
  return {
    v: SAVE_VERSION, shape: shape(), seed: g.map.seed, preset, tick: g.tick, rng: g.rng.state, nextId: g.nextId,
    players: g.players.map((p) => ({ ...p, res: [...p.res] })),
    buildings: g.buildings.map((b) => ({ ...b })),
    units: g.units.map((u) => ({ ...u, path: [...u.path] })),
  };
}

/** Odtwarza grę z zapisu. Zwraca null, gdy zapis jest z innej wersji albo uszkodzony. */
export function deserialize(d: SaveData): GameState | null {
  try {
    if (d.v !== SAVE_VERSION || d.shape !== shape() || !(d.preset in MAP_PRESETS)) return null;
    const map = generateMap(d.seed, d.preset);
    const size = map.width * map.height;
    const g: GameState = {
      tick: d.tick, map, rng: new Rng(d.rng, true), nextId: d.nextId,
      players: d.players.map((p) => ({ ...p, res: Int32Array.from(p.res) })),
      buildings: d.buildings.map((b) => ({ ...b })),
      units: d.units.map((u) => ({ ...u, path: [...u.path] })),
      occupancy: new Int32Array(size), reserved: new Uint8Array(size),
    };
    for (const b of g.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) return null;
      for (let y = b.y; y < b.y + def.h; y++) for (let x = b.x; x < b.x + def.w; x++) g.occupancy[y * map.width + x] = b.id;
      if (b.door >= 0) g.reserved[b.door]!++;
    }
    return g;
  } catch {
    return null;
  }
}

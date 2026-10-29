/**
 * Modele z Blendera, po których chodzi się w spacerze i w których pracują ludzie (wyniesione z scene.ts, 24.10.2026):
 * zamek, karczma, chaty, kopalnia i jej wnętrze — podłogi, przeszkody, miejsca siedzące i stanowiska pracy.
 */
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { KEEP_SIZE } from '../data/keep';
import { mineRoutes, type MineRoute } from './minepath';
import { model } from './modelstore';

export const KEEP_MODEL = model('keep');
export const OREMINE_MODEL = model('mine');
export const MINECAMP_MODEL = model('minecamp');
export const TAVERN_MODEL = model('tavern');
export const HOUSE_MODEL = model('house');
export const SHACK_MODEL = model('shack');
export const TENT_MODEL = model('tent');
export const SHACKL_MODEL = model('shackl');
export const BARN_MODEL = model('barn');
export const ORCHARD_MODEL = model('orchard');
export const FARM_MODEL = model('farm');
export const CAMP_MODEL = model('camp');
export const RAM_MODEL = model('ram');
export const FIELDTENT_MODEL = model('fieldtent');
/** Miejsca modlitwy przed kapliczką (układ modelu: środek działki, przód = +z): trzy przy klęczniku, potem dwa rzędy stojących */
export const SHRINE_SPOTS: [number, number][] = [[-0.2, 0.5], [0.2, 0.5], [0, 0.52], [-0.35, 0.8], [0.35, 0.8], [0, 0.82], [-0.18, 1.05], [0.18, 1.05]];
export const CAMP_SEATS = (CAMP_MODEL as unknown as { seats: [number, number, number][] }).seats;

/** Pola zamku, po których się chodzi (dy * 3 + dx): sala donżonu, koszary, dziedziniec, brama; posadzka na tej wysokości */
/** Przeszkody w zamku (ściany pomieszczeń, kraty, sprzęty) z modelu z Blendera: prostokąty x0, x1, z0, z1 względem środka */
export const KEEP_SOLID = (KEEP_MODEL as unknown as { solid: [number, number, number, number, number, number][] }).solid;
export const KEEP_FLOOR = (KEEP_MODEL as unknown as { floorY: number }).floorY;
export const KEEP_WALL = (KEEP_MODEL as unknown as { wallY: number }).wallY;
export const KEEP_HALF = KEEP_SIZE / 2;
/** Karczma z Blendera: miejsca dla gości (x, z, obrót), posadzka izby, obszar do chodzenia i przeszkody */
/** Budynek z Blendera, do którego wchodzi się spacerem: prostokąty podłogi, przeszkody na swojej wysokości, wysokość posadzki */
export interface WalkModel { floorY: number; open: [number, number, number, number][]; solid: [number, number, number, number, number, number][] }
export const TAVERN = TAVERN_MODEL as unknown as WalkModel & { seats: [number, number, number][] };
export const WALK_MODELS: Record<string, WalkModel> = { tavern: TAVERN, house: HOUSE_MODEL as unknown as WalkModel, shack: SHACK_MODEL as unknown as WalkModel, tent: TENT_MODEL as unknown as WalkModel, shackL: SHACKL_MODEL as unknown as WalkModel, barn: BARN_MODEL as unknown as WalkModel, orchard: ORCHARD_MODEL as unknown as WalkModel, farm: FARM_MODEL as unknown as WalkModel, oremine: OREMINE_MODEL as unknown as WalkModel, minecamp: MINECAMP_MODEL as unknown as WalkModel, fieldTent: FIELDTENT_MODEL as unknown as WalkModel };
/** Kopalnia: miejsca pracy górników w grocie (x, z w układzie modelu, kierunek twarzy) — z tools/models/mine.py */
export const MINE_SPOTS = (OREMINE_MODEL as unknown as { spots: [number, number, number][] }).spots;
export const OREMINE_T = BUILDINGS.findIndex((d) => d.id === 'oremine');
export const OREMINE_WALK = WALK_MODELS.oremine;
/** Wnętrze kopalni (osobna lokacja): sale do chodzenia, przeszkody, latarnie, miejsca górników, wejście i strefa wyjścia */
export type Rect = [number, number, number, number];
export const MINE_LEVEL = model('minelevel') as unknown as {
  rooms: Rect[]; solid: Rect[]; spots: [number, number, number][]; entry: [number, number, number]; exit: Rect;
  /** Niższy poziom (posadzka na y = low): sale, przeszkody, przodki; szyb z drabiną w otworze `hole` */
  rooms2: Rect[]; solid2: Rect[]; spots2: [number, number, number][]; low: number; hole: Rect; down: [number, number]; up: [number, number];
};
/** Przodki obu poziomów na przemian (x, y posadzki, z, kierunek): mała załoga kopie i na górze, i na dole */
export const MINE_LEVEL_SPOTS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  const up = MINE_LEVEL.spots, low = MINE_LEVEL.spots2 ?? [];
  for (let i = 0; i < Math.max(up.length, low.length); i++) {
    if (up[i]) out.push([up[i]![0], 0, up[i]![1], up[i]![2]]);
    if (low[i]) out.push([low[i]![0], MINE_LEVEL.low, low[i]![1], low[i]![2]]);
  }
  return out;
})();
/** Drogi kopaczy od wrót sztolni do każdego przodka (liczone raz, przy pierwszym wejściu do sztolni) */
let MINE_ROUTES: MineRoute[] | null = null;
export const mineRoute = (i: number): MineRoute => (MINE_ROUTES ??= mineRoutes(MINE_LEVEL, MINE_LEVEL_SPOTS))[i]!;
/** Kopalnia: ile trwa samo kopanie przy skale (droga sztolnią dochodzi osobno, data/minewalk.ts — jak liczy symulacja) */
export const OREMINE_PROD = BUILDINGS[OREMINE_T]?.production;
export const inRect = (r: Rect, x: number, z: number): boolean => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
/** Gdzie w świecie stoi wnętrze kopalni: głęboko pod mapą (od dołu terenu nie widać, a strop zasłania niebo) */
export const MINE_AT = new THREE.Vector3(0, -80, 0);
export const TAVERN_SEATS = TAVERN.seats;
/** Obrys budynku z modelu (ściany, sprzęty i wnętrze): poza nim, na podwórku działki, chodzi się jak po łące */
export const footCache = new Map<WalkModel, [number, number, number, number]>();
export function walkFoot(m: WalkModel): [number, number, number, number] {
  let f = footCache.get(m);
  if (!f) {
    f = [Infinity, -Infinity, Infinity, -Infinity];
    for (const r of [...m.open, ...m.solid.filter((b) => b[4] < 0.3)]) { f[0] = Math.min(f[0], r[0]); f[1] = Math.max(f[1], r[1]); f[2] = Math.min(f[2], r[2]); f[3] = Math.max(f[3], r[3]); }
    footCache.set(m, f);
  }
  return f;
}
export const TAVERN_FLOOR = TAVERN.floorY;

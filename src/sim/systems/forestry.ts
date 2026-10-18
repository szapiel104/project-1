import { BUILDINGS, buildingIndex, workArea } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { Terrain } from '../../data/terrain';
import { seasonAt } from '../weather';
import { FP, Phase, type Building, type GameState, type Sapling } from '../state';

/**
 * Leśnictwo: leśniczy z chaty sadzi młode drzewka na wolnej łące w swoim terenie pracy, a drzewka rosną w las.
 *
 * - Sadzi tylko poza zimą (zmarznięta ziemia) i najwyżej `RULES.foresterSaplings` rosnących naraz na chatę.
 * - Wybiera pole blisko chaty i najchętniej przy lesie, więc las rośnie od skraju, a poręby zarastają z powrotem.
 *   Nie sadzi na drogach, ścieżkach leśnych, tuż przy budynkach i wejściach (żeby nie zarosnąć osady).
 * - Pole z drzewkiem jest zarezerwowane (nie da się na nim budować). Gdy ktoś położy na nim drogę, drzewko ginie.
 * - Po `RULES.saplingTicks` (zimą wzrost stoi) pole staje się zwykłym lasem: drwal może je ściąć, a renderer
 *   dostaje wpis w dzienniku lasu (`g.cut`, wpis ujemny = odrosło).
 */
const FORESTER = buildingIndex('forester');

const tileOf = (g: GameState, u: { px: number; py: number }): number => (u.py >> 8) * g.map.width + (u.px >> 8);

export function forestSystem(g: GameState): void {
  growSaplings(g);
  if (g.tick % 10 === 0) sendForesters(g);
}

function growSaplings(g: GameState): void {
  const list = g.saplings;
  if (!list?.length) return;
  const winter = seasonAt(g.tick, g.seasonShift ?? 0) === 'winter';
  let keep = 0;
  for (const s of list) {
    const t = s.t;
    if (g.map.tiles[t] !== Terrain.Grass || g.occupancy[t] || g.roads[t] || g.roadPlan[t]) {
      // na polu stanęła droga albo coś innego: drzewko przepada, pole wolne
      g.reserved[t] = Math.max(0, g.reserved[t]! - 1);
      continue;
    }
    if (!winter) s.age++;
    if (s.age >= RULES.saplingTicks) {
      g.reserved[t] = Math.max(0, g.reserved[t]! - 1);
      g.map.tiles[t] = Terrain.Forest;
      g.cut.push(~t);
      continue;
    }
    list[keep++] = s;
  }
  list.length = keep;
}

/** Wolny leśniczy stojący pod chatą dostaje następne pole do obsadzenia */
function sendForesters(g: GameState): void {
  if (FORESTER < 0) return;
  if (seasonAt(g.tick, g.seasonShift ?? 0) === 'winter') return;
  let planned: Set<number> | undefined;
  for (const b of g.buildings) {
    if (b.type !== FORESTER || b.build || b.off || !b.worker || b.door < 0) continue;
    const u = g.units.find((x) => x.id === b.worker);
    if (!u || u.phase !== Phase.Idle || u.path.length || u.wait > 0 || tileOf(g, u) !== b.door) continue;
    const growing = (g.saplings ?? []).reduce((n, s) => n + (s.by === b.id ? 1 : 0), 0);
    if (growing >= RULES.foresterSaplings) continue;
    planned ??= new Set(g.units.filter((x) => x.phase === Phase.ToPlant || x.phase === Phase.Planting).map((x) => x.target - 1));
    const t = plantSpot(g, b, planned);
    if (t < 0) continue;
    planned.add(t);
    u.target = t + 1;
    u.phase = Phase.ToPlant;
  }
}

/** Pole do obsadzenia w terenie chaty albo -1: blisko chaty, najchętniej przy lesie; deterministycznie (ta sama kolejność u wszystkich) */
export function plantSpot(g: GameState, b: Building, planned: Set<number>): number {
  const a = workArea(b);
  if (!a) return -1;
  const { width: w, height: h, tiles } = g.map;
  const young = new Set((g.saplings ?? []).map((s) => s.t));
  const def = BUILDINGS[b.type]!;
  const fw = b.rot % 2 ? def.h : def.w, fh = b.rot % 2 ? def.w : def.h;
  const cx2 = 2 * b.x + fw - 1, cy2 = 2 * b.y + fh - 1; // środek działki ×2 (bez ułamków)
  let best = -1, bestScore = Infinity;
  for (let y = Math.max(1, a.y0); y <= Math.min(h - 2, a.y1); y++)
    for (let x = Math.max(1, a.x0); x <= Math.min(w - 2, a.x1); x++) {
      const t = y * w + x;
      if (tiles[t] !== Terrain.Grass || g.occupancy[t] || g.reserved[t] || g.roads[t] || g.roadPlan[t] || g.map.trails?.[t] || planned.has(t) || b.miss?.includes(t)) continue;
      let forest = 0, bad = false;
      for (let dy = -1; dy <= 1 && !bad; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = t + dy * w + dx;
          // tuż przy budynku, wejściu, drodze albo wodzie nie sadzi: osada i brzegi zostają wolne
          if (g.occupancy[n] || (g.reserved[n] && !young.has(n)) || g.roads[n] || g.roadPlan[n] || tiles[n] === Terrain.Water || tiles[n] === Terrain.Ford) { bad = true; break; }
          if (tiles[n] === Terrain.Forest || young.has(n) || planned.has(n)) forest++;
        }
      if (bad) continue;
      const d = Math.max(Math.abs(2 * x - cx2), Math.abs(2 * y - cy2));
      const score = d * 2 - forest * 3;
      if (score < bestScore) { bestScore = score; best = t; }
    }
  return best;
}

/** Leśniczy skończył sadzić: na polu zostaje młode drzewko (o ile pole wciąż jest wolne) */
export function plantSapling(g: GameState, u: { owner: number; job: number; target: number; px: number; py: number }): void {
  const t = u.target - 1;
  if (t < 0 || g.map.tiles[t] !== Terrain.Grass || g.occupancy[t] || g.reserved[t] || g.roads[t] || g.roadPlan[t]) return;
  const s: Sapling = { t, owner: u.owner, by: u.job, age: 0 };
  (g.saplings ??= []).push(s);
  g.reserved[t]!++;
}

/** Wzrost drzewka 0..1 (do wyglądu) */
export const saplingGrowth = (s: Sapling): number => Math.min(1, s.age / RULES.saplingTicks);
/** Pozycja środka pola w stałym przecinku (pomocnik do testów) */
export const tileCenter = (g: GameState, t: number): [number, number] => [(t % g.map.width) * FP + FP / 2, Math.floor(t / g.map.width) * FP + FP / 2];

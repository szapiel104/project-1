import { RULES } from '../data/rules';
import { TERRAIN, Terrain } from '../data/terrain';
import type { GameState } from './state';

let dist = new Int32Array(0);
let prev = new Int32Array(0);
let mark = new Int32Array(0);
let generation = 0;

/** Czy po polu da się przejść (teren i brak budynku). */
/** Gracz -2 = wilk: chodzi też przez las */
export const WOLF = -2;
/** Wartość w g.gates: pole zajęte przez budowlę, ale przechodnie dla każdego gracza (korona muru kamiennego, drabina) */
export const OPEN_ALL = 255;
const WALK = new Uint8Array(256);
for (const k of Object.keys(TERRAIN)) WALK[Number(k)] = TERRAIN[Number(k) as Terrain].walkable ? 1 : 0;
export function walkable(g: GameState, tile: number, player = -1): boolean {
  if (player === WOLF) return g.occupancy[tile] === 0 && (TERRAIN[g.map.tiles[tile] as Terrain].walkable || g.map.tiles[tile] === Terrain.Forest);
  // brama przepuszcza tylko swoich
  return (g.occupancy[tile] === 0 || (player >= 0 && (g.gates[tile] === player + 1 || g.gates[tile] === OPEN_ALL))) && TERRAIN[g.map.tiles[tile] as Terrain].walkable;
}

/** Najtańszy możliwy krok prosto i po skosie (po najlepszej drodze) — dolne oszacowanie dla A* */
const STEP_MIN = Math.min(...RULES.roadPathCost.map((c) => Math.round((10 * c) / 100)));
const DIAG_MIN = Math.min(...RULES.roadPathCost.map((c) => Math.round((14 * c) / 100)));
/** Liczniki do okna wydajności: ile razy szukano drogi, ile pól przejrzano, ile razy bez skutku */
export const pathStats = { calls: 0, expanded: 0, failed: 0, wasted: 0 };
const BIT_X = (dx: number): number => (dx > 0 ? 2 : 8), BIT_Y = (dy: number): number => (dy > 0 ? 4 : 1);
/** Czy krok z pola o (dx, dy) przechodzi przez ścianę (w zamku). Po skosie: żadna z czterech krawędzi przy narożniku nie może być ścianą. */
export function wallBetween(g: GameState, tile: number, dx: number, dy: number): boolean {
  const w = g.map.width, W = g.walls;
  // krawędź zapisana jest po obu stronach (albo tylko po stronie zamku, gdy sąsiad leży poza nim)
  const orth = (t: number, ox: number, oy: number): number => (ox ? (W[t]! & BIT_X(ox)) | (W[t + ox]! & BIT_X(-ox)) : (W[t]! & BIT_Y(oy)) | (W[t + oy * w]! & BIT_Y(-oy)));
  if (!dy) return orth(tile, dx, 0) !== 0;
  if (!dx) return orth(tile, 0, dy) !== 0;
  return (orth(tile, dx, 0) | orth(tile + dx, 0, dy) | orth(tile, 0, dy) | orth(tile + dy * w, dx, 0)) !== 0;
}

/**
 * Najkrótsza droga (Dijkstra, 8 kierunków, bez ścinania narożników) od pola `from`
 * do najbliższego pola spełniającego `isGoal`. Zwraca listę pól bez startu albo null.
 * Remisy rozstrzyga numer pola, więc wynik jest identyczny u każdego gracza.
 */
export function findPath(g: GameState, from: number, isGoal: (tile: number) => boolean, maxCost = 900, player = -1, target = -1, reach = 0): number[] | null {
  pathStats.calls++;
  const e0 = pathStats.expanded;
  const { width: w, height: h } = g.map;
  // Gdy cel to jedno znane pole, szukamy A* (dolne oszacowanie: najtańszy krok po najlepszej drodze), zamiast rozlewać
  // się po całej mapie we wszystkie strony. Oszacowanie nigdy nie przecenia, więc droga jest nadal najkrótsza.
  const tx = target >= 0 ? target % w : 0, ty = target >= 0 ? (target - tx) / w : 0;
  const est = target < 0 ? (_t: number): number => 0 : (t: number): number => {
    const x = t % w, y = (t - x) / w;
    const ax = Math.max(0, Math.abs(x - tx) - reach), ay = Math.max(0, Math.abs(y - ty) - reach);
    const lo = ax < ay ? ax : ay, hi = ax < ay ? ay : ax;
    return STEP_MIN * (hi - lo) + DIAG_MIN * lo;
  };
  const size = w * h;
  if (dist.length < size) { dist = new Int32Array(size); prev = new Int32Array(size); mark = new Int32Array(size); }
  generation++;
  const heap: number[] = [];
  const push = (key: number): void => {
    let i = heap.length;
    heap.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]! <= key) break;
      heap[i] = heap[p]!; i = p;
    }
    heap[i] = key;
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    const n = heap.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && heap[c + 1]! < heap[c]!) c++;
        if (heap[c]! >= last) break;
        heap[i] = heap[c]!; i = c;
      }
      heap[i] = last;
    }
    return top;
  };

  // walkable() wpisane na miejscu (to najczęściej wołana funkcja w całej symulacji)
  const occ = g.occupancy, tiles = g.map.tiles, gates = g.gates, gate = player + 1, wolf = player === WOLF;
  const ok = (t: number): boolean => {
    const tt = tiles[t]!;
    if (wolf) return occ[t] === 0 && (WALK[tt] === 1 || tt === Terrain.Forest);
    return (occ[t] === 0 || (player >= 0 && (gates[t] === gate || gates[t] === OPEN_ALL))) && WALK[tt] === 1;
  };
  const K = 1 << 20; // klucz = koszt * K + pole (do 1024 x 1024 pól; koszt najwyżej kilka tysięcy, więc mieści się w liczbie)
  dist[from] = 0; mark[from] = generation; prev[from] = -1;
  push(est(from) * K + from);
  while (heap.length) {
    const key = pop();
    const tile = key % K;
    const cost = dist[tile]!;
    if ((key - tile) / K > cost + est(tile)) continue; // nieaktualny wpis
    pathStats.expanded++;
    if (isGoal(tile)) {
      const path: number[] = [];
      for (let t = tile; t !== from; t = prev[t]!) path.push(t);
      return path.reverse();
    }
    if (cost >= maxCost) continue;
    const x = tile % w, y = (tile - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nt = ny * w + nx;
        if (!ok(nt)) continue;
        if (dx && dy && (!ok(y * w + nx) || !ok(ny * w + x))) continue;
        if ((g.walls[tile] || g.walls[nt] || g.walls[y * w + nx] || g.walls[ny * w + x]) && wallBetween(g, tile, dx, dy)) continue;
        // po drodze idzie się taniej, więc ścieżka chętnie nią prowadzi
        const nc = cost + Math.round(((dx && dy ? 14 : 10) * RULES.roadPathCost[g.roads[nt]!]!) / 100);
        if (mark[nt] === generation && dist[nt]! <= nc) continue;
        mark[nt] = generation; dist[nt] = nc; prev[nt] = tile;
        push((nc + est(nt)) * K + nt);
      }
    }
  }
  pathStats.failed++; pathStats.wasted += pathStats.expanded - e0;
  return null;
}

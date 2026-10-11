import { TERRAIN, Terrain } from '../data/terrain';
import type { GameState } from './state';

let dist = new Int32Array(0);
let prev = new Int32Array(0);
let mark = new Int32Array(0);
let generation = 0;

/** Czy po polu da się przejść (teren i brak budynku). */
export function walkable(g: GameState, tile: number): boolean {
  return g.occupancy[tile] === 0 && TERRAIN[g.map.tiles[tile] as Terrain].walkable;
}

/**
 * Najkrótsza droga (Dijkstra, 8 kierunków, bez ścinania narożników) od pola `from`
 * do najbliższego pola spełniającego `isGoal`. Zwraca listę pól bez startu albo null.
 * Remisy rozstrzyga numer pola, więc wynik jest identyczny u każdego gracza.
 */
export function findPath(g: GameState, from: number, isGoal: (tile: number) => boolean, maxCost = 900): number[] | null {
  const { width: w, height: h } = g.map;
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

  const K = 65536; // klucz = koszt * K + pole (mapy mają najwyżej 256 x 256 pól)
  dist[from] = 0; mark[from] = generation; prev[from] = -1;
  push(from);
  while (heap.length) {
    const key = pop();
    const tile = key % K;
    const cost = (key - tile) / K;
    if (cost > dist[tile]!) continue;
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
        if (!walkable(g, nt)) continue;
        if (dx && dy && (!walkable(g, y * w + nx) || !walkable(g, ny * w + x))) continue;
        const nc = cost + (dx && dy ? 14 : 10);
        if (mark[nt] === generation && dist[nt]! <= nc) continue;
        mark[nt] = generation; dist[nt] = nc; prev[nt] = tile;
        push(nc * K + nt);
      }
    }
  }
  return null;
}

import { BUILDINGS, type BuildingDef } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { RULES } from '../../data/rules';
import { TERRAIN, Terrain } from '../../data/terrain';
import { Phase, playerKeep, type Building, type GameState } from '../state';

/** Powód, dla którego nie da się budować (klucz tłumaczenia), albo null gdy wolno. */
export type PlaceError =
  | 'place.outside' | 'place.terrain' | 'place.occupied' | 'place.far'
  | 'place.cost' | 'place.needTerrain' | 'place.noAccess' | 'place.blocks' | 'place.unknown';

export function canAfford(g: GameState, player: number, def: BuildingDef): boolean {
  const p = g.players[player];
  if (!p) return false;
  for (const [k, v] of Object.entries(def.cost)) if (p.res[resIndex(k as ResourceId)]! < v) return false;
  return true;
}

/** Wolne pole przy budynku, którym wchodzą chłopi. Szuka od środka dolnej krawędzi dookoła. */
export function findDoor(g: GameState, x: number, y: number, w: number, h: number): number {
  const { width, height } = g.map;
  const ring: [number, number][] = [];
  for (let i = 0; i < w; i++) ring.push([x + ((i + (w >> 1)) % w), y + h]);
  for (let i = h - 1; i >= 0; i--) ring.push([x + w, y + i]);
  for (let i = w - 1; i >= 0; i--) ring.push([x + i, y - 1]);
  for (let i = 0; i < h; i++) ring.push([x - 1, y + i]);
  for (const [tx, ty] of ring) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    const t = ty * width + tx;
    if (g.occupancy[t] === 0 && TERRAIN[g.map.tiles[t] as Terrain].walkable) return t;
  }
  return -1;
}

let seen = new Uint8Array(0);
let queue = new Int32Array(0);

/**
 * Czy budynek w tym miejscu odciąłby drogę: po postawieniu z wejścia twierdzy musi dać się dojść
 * do wejścia każdego budynku gracza (także nowego) i do każdego jego chłopa.
 */
function wouldBlock(g: GameState, player: number, x: number, y: number, w: number, h: number): boolean {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return false;
  const { width, height } = g.map;
  const size = width * height;
  if (seen.length < size) { seen = new Uint8Array(size); queue = new Int32Array(size); }
  seen.fill(0, 0, size);
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g.occupancy[ty * width + tx] = -1;
  const door = findDoor(g, x, y, w, h);
  let head = 0, tail = 0;
  if (g.occupancy[keep.door] === 0) { queue[tail++] = keep.door; seen[keep.door] = 1; }
  while (head < tail) {
    const t = queue[head++]!;
    const cx = t % width, cy = (t - cx) / width;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nt = ny * width + nx;
      if (seen[nt] || g.occupancy[nt] !== 0 || !TERRAIN[g.map.tiles[nt] as Terrain].walkable) continue;
      seen[nt] = 1; queue[tail++] = nt;
    }
  }
  let blocked = door < 0 || !seen[door];
  if (!blocked) for (const b of g.buildings) if (b.owner === player && b.door >= 0 && !seen[b.door]) { blocked = true; break; }
  if (!blocked) for (const u of g.units) {
    if (u.owner !== player) continue;
    const ux = u.px >> 8, uy = u.py >> 8;
    if (ux >= x && ux < x + w && uy >= y && uy < y + h) continue; // stoi na działce: wyjdzie sam
    if (!seen[uy * width + ux]) { blocked = true; break; }
  }
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g.occupancy[ty * width + tx] = 0;
  return blocked;
}

export function canPlace(g: GameState, player: number, type: number, x: number, y: number, checkCost = true): PlaceError | null {
  const def = BUILDINGS[type];
  if (!def || !def.buildable || !g.players[player]) return 'place.unknown';
  const { width, height } = g.map;
  if (x < 0 || y < 0 || x + def.w > width || y + def.h > height) return 'place.outside';
  for (let ty = y; ty < y + def.h; ty++) {
    for (let tx = x; tx < x + def.w; tx++) {
      const t = ty * width + tx;
      if (!TERRAIN[g.map.tiles[t] as Terrain].buildable) return 'place.terrain';
      if (g.occupancy[t] !== 0 || g.reserved[t] !== 0) return 'place.occupied';
    }
  }
  const keep = playerKeep(g, player);
  if (!keep) return 'place.far';
  const cx = x + (def.w >> 1), cy = y + (def.h >> 1);
  if (Math.max(Math.abs(cx - (keep.x + 1)), Math.abs(cy - (keep.y + 1))) > RULES.buildRadius) return 'place.far';
  if (def.needsTerrain) {
    const r = def.needsTerrain.radius;
    let found = false;
    for (let ty = Math.max(0, cy - r); ty <= Math.min(height - 1, cy + r) && !found; ty++)
      for (let tx = Math.max(0, cx - r); tx <= Math.min(width - 1, cx + r); tx++)
        if (g.map.tiles[ty * width + tx] === def.needsTerrain.terrain) { found = true; break; }
    if (!found) return 'place.needTerrain';
  }
  if (findDoor(g, x, y, def.w, def.h) < 0) return 'place.noAccess';
  if (wouldBlock(g, player, x, y, def.w, def.h)) return 'place.blocks';
  if (checkCost && !canAfford(g, player, def)) return 'place.cost';
  return null;
}

/** Wstawia budynek do stanu bez sprawdzania kosztów (używane też dla twierdzy startowej). */
export function addBuilding(g: GameState, type: number, owner: number, x: number, y: number): Building {
  const def = BUILDINGS[type]!;
  const door = findDoor(g, x, y, def.w, def.h);
  const b: Building = { id: g.nextId++, type, owner, x, y, door, worker: 0 };
  for (let ty = y; ty < y + def.h; ty++)
    for (let tx = x; tx < x + def.w; tx++) g.occupancy[ty * g.map.width + tx] = b.id;
  if (door >= 0) g.reserved[door]!++;
  g.buildings.push(b);
  return b;
}

export function placeBuilding(g: GameState, player: number, type: number, x: number, y: number): boolean {
  if (canPlace(g, player, type, x, y) !== null) return false;
  const def = BUILDINGS[type]!;
  const p = g.players[player]!;
  for (const [k, v] of Object.entries(def.cost)) p.res[resIndex(k as ResourceId)]! -= v;
  addBuilding(g, type, player, x, y);
  return true;
}

export function demolish(g: GameState, player: number, id: number): boolean {
  const i = g.buildings.findIndex((b) => b.id === id);
  const b = g.buildings[i];
  if (!b || b.owner !== player) return false;
  const def = BUILDINGS[b.type]!;
  if (!def.buildable) return false;
  for (let ty = b.y; ty < b.y + def.h; ty++)
    for (let tx = b.x; tx < b.x + def.w; tx++) g.occupancy[ty * g.map.width + tx] = 0;
  if (b.door >= 0) g.reserved[b.door]!--;
  g.buildings.splice(i, 1);
  for (const u of g.units) {
    if (u.job === id) { u.job = 0; u.phase = Phase.Idle; u.path = []; u.carryRes = -1; u.carryAmt = 0; u.timer = 0; u.home = 0; u.batches = 0; }
    else if (u.home === id) { u.home = 0; u.timer = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; }
  }
  const p = g.players[player]!;
  for (const [k, v] of Object.entries(def.cost))
    p.res[resIndex(k as ResourceId)]! += Math.floor((v * RULES.refundPercent) / 100);
  return true;
}

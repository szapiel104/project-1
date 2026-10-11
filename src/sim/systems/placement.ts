import { BUILDINGS, footprint, type BuildingDef } from '../../data/buildings';
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

/**
 * Wolne pole przy budynku, którym wchodzą chłopi. Najpierw szuka od frontu (strona zależy od obrotu),
 * od środka krawędzi, a gdy front jest zastawiony, po kolei na pozostałych bokach.
 */
export function findDoor(g: GameState, x: number, y: number, w: number, h: number, rot = 0): number {
  const { width, height } = g.map;
  const mid = (n: number, i: number): number => (i + (n >> 1)) % n;
  const sides: [number, number][][] = [
    Array.from({ length: w }, (_, i) => [x + mid(w, i), y + h] as [number, number]),
    Array.from({ length: h }, (_, i) => [x + w, y + mid(h, i)] as [number, number]),
    Array.from({ length: w }, (_, i) => [x + mid(w, i), y - 1] as [number, number]),
    Array.from({ length: h }, (_, i) => [x - 1, y + mid(h, i)] as [number, number]),
  ];
  for (let k = 0; k < 4; k++)
    for (const [tx, ty] of sides[(rot + k) % 4]!) {
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
function wouldBlock(g: GameState, player: number, x: number, y: number, w: number, h: number, rot: number): boolean {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return false;
  const { width, height } = g.map;
  const size = width * height;
  if (seen.length < size) { seen = new Uint8Array(size); queue = new Int32Array(size); }
  seen.fill(0, 0, size);
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g.occupancy[ty * width + tx] = -1;
  const door = findDoor(g, x, y, w, h, rot);
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

export function canPlace(g: GameState, player: number, type: number, x: number, y: number, checkCost = true, rot = 0): PlaceError | null {
  const def = BUILDINGS[type];
  if (!def || !def.buildable || !g.players[player]) return 'place.unknown';
  const { w: fw, h: fh } = footprint(def, rot);
  const { width, height } = g.map;
  if (x < 0 || y < 0 || x + fw > width || y + fh > height) return 'place.outside';
  if (def.road) {
    // droga: wystarczy wolne pole, po którym da się chodzić; nie blokuje i nie potrzebuje wejścia
    const t = y * width + x;
    if (!TERRAIN[g.map.tiles[t] as Terrain].walkable) return 'place.terrain';
    if (g.occupancy[t] !== 0 || g.roads[t] === def.road) return 'place.occupied';
    const k = playerKeep(g, player);
    if (!k || Math.max(Math.abs(x - (k.x + 1)), Math.abs(y - (k.y + 1))) > RULES.buildRadius + 10) return 'place.far';
    if (checkCost && !canAfford(g, player, def)) return 'place.cost';
    return null;
  }
  for (let ty = y; ty < y + fh; ty++) {
    for (let tx = x; tx < x + fw; tx++) {
      const t = ty * width + tx;
      if (!TERRAIN[g.map.tiles[t] as Terrain].buildable) return 'place.terrain';
      if (g.occupancy[t] !== 0 || g.reserved[t] !== 0) return 'place.occupied';
    }
  }
  const keep = playerKeep(g, player);
  if (!keep) return 'place.far';
  const cx = x + (fw >> 1), cy = y + (fh >> 1);
  if (Math.max(Math.abs(cx - (keep.x + 1)), Math.abs(cy - (keep.y + 1))) > RULES.buildRadius) return 'place.far';
  if (def.needsTerrain) {
    const r = def.needsTerrain.radius;
    let found = false;
    for (let ty = Math.max(0, cy - r); ty <= Math.min(height - 1, cy + r) && !found; ty++)
      for (let tx = Math.max(0, cx - r); tx <= Math.min(width - 1, cx + r); tx++)
        if (g.map.tiles[ty * width + tx] === def.needsTerrain.terrain) { found = true; break; }
    if (!found) return 'place.needTerrain';
  }
  if (findDoor(g, x, y, fw, fh, rot) < 0) return 'place.noAccess';
  if (wouldBlock(g, player, x, y, fw, fh, rot)) return 'place.blocks';
  if (checkCost && !canAfford(g, player, def)) return 'place.cost';
  return null;
}

/** Wstawia budynek do stanu bez sprawdzania kosztów (używane też dla twierdzy startowej). */
export function addBuilding(g: GameState, type: number, owner: number, x: number, y: number, rot = 0): Building {
  const def = BUILDINGS[type]!;
  const fp = footprint(def, rot);
  const door = findDoor(g, x, y, fp.w, fp.h, rot);
  const b: Building = { id: g.nextId++, type, owner, x, y, rot, door, worker: 0, lit: false };
  for (let ty = y; ty < y + fp.h; ty++)
    for (let tx = x; tx < x + fp.w; tx++) { g.occupancy[ty * g.map.width + tx] = b.id; g.roads[ty * g.map.width + tx] = 0; } // budynek zastępuje drogę pod sobą
  if (door >= 0) g.reserved[door]!++;
  g.buildings.push(b);
  return b;
}

export function placeBuilding(g: GameState, player: number, type: number, x: number, y: number, rot = 0): boolean {
  if (canPlace(g, player, type, x, y, true, rot) !== null) return false;
  const def = BUILDINGS[type]!;
  const p = g.players[player]!;
  for (const [k, v] of Object.entries(def.cost)) p.res[resIndex(k as ResourceId)]! -= v;
  if (def.road) { g.roads[y * g.map.width + x] = def.road; return true; }
  addBuilding(g, type, player, x, y, rot);
  return true;
}

export function demolish(g: GameState, player: number, id: number): boolean {
  const i = g.buildings.findIndex((b) => b.id === id);
  const b = g.buildings[i];
  if (!b || b.owner !== player) return false;
  const def = BUILDINGS[b.type]!;
  if (!def.buildable) return false;
  const fp = footprint(def, b.rot);
  for (let ty = b.y; ty < b.y + fp.h; ty++)
    for (let tx = b.x; tx < b.x + fp.w; tx++) g.occupancy[ty * g.map.width + tx] = 0;
  if (b.door >= 0) g.reserved[b.door]!--;
  g.buildings.splice(i, 1);
  for (const u of g.units) {
    if (u.job === id) { u.job = 0; u.phase = Phase.Idle; u.path = []; u.carryRes = -1; u.carryAmt = 0; u.timer = 0; u.home = 0; u.batches = 0; }
    if (u.target === id) { u.target = 0; if (u.phase === Phase.ToLight) u.phase = u.job ? Phase.Returning : Phase.Idle; }
    if (u.job === id) continue;
    else if (u.home === id) { u.home = 0; u.timer = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; }
  }
  // Zwrot połowy kosztu nie wpada od razu: leży w gruzie i wraca do składu ładunek po ładunku
  const loads: [number, number][] = [];
  for (const [k, v] of Object.entries(def.cost)) {
    let left = Math.floor((v * RULES.refundPercent) / 100);
    while (left > 0) { const n = Math.min(left, RULES.rubbleLoad); loads.push([resIndex(k as ResourceId), n]); left -= n; }
  }
  if (!loads.length) loads.push([-1, 0]); // nawet bezwartościowy gruz trzeba raz wynieść
  g.rubble.push({ id: g.nextId++, owner: player, type: b.type, x: b.x, y: b.y, w: fp.w, h: fp.h, loads, total: loads.length });
  // na gruzie nie da się budować, ale można po nim przejść
  for (let ty = b.y; ty < b.y + fp.h; ty++)
    for (let tx = b.x; tx < b.x + fp.w; tx++) g.reserved[ty * g.map.width + tx]!++;
  return true;
}

/** Usuwa drogę z pola (od razu, bez gruzu). */
export function removeRoad(g: GameState, player: number, x: number, y: number): boolean {
  if (!g.players[player] || x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return false;
  const t = y * g.map.width + x;
  if (!g.roads[t]) return false;
  g.roads[t] = 0;
  return true;
}

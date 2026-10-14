import { BUILDINGS, footprint, type BuildingDef } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { RULES } from '../../data/rules';
import { TERRAIN, Terrain } from '../../data/terrain';
import { KEEP_BED, KEEP_CELLS } from '../../data/keep';
import { keepCenter, Phase, playerKeep, type Building, type GameState } from '../state';

/** Powód, dla którego nie da się budować (klucz tłumaczenia), albo null gdy wolno. */
export type PlaceError =
  | 'place.outside' | 'place.terrain' | 'place.occupied' | 'place.far'
  | 'place.cost' | 'place.needTerrain' | 'place.noAccess' | 'place.blocks' | 'place.enemy' | 'place.unknown';

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

let seen = new Uint8Array(0), before = new Uint8Array(0);
let queue = new Int32Array(0);

/**
 * Czy budynek w tym miejscu odciąłby drogę: po postawieniu z wejścia twierdzy musi dać się dojść
 * do wejścia każdego budynku gracza (także nowego) i do każdego jego chłopa.
 */
const WALL_BIT = [2, 8, 4, 1];
/** Zalewanie od drzwi twierdzy: które pola są osiągalne pieszo. */
function flood(g: GameState, start: number, out: Uint8Array, player: number): void {
  const { width, height } = g.map;
  out.fill(0, 0, width * height);
  let head = 0, tail = 0;
  if (g.occupancy[start] === 0 || g.gates[start] === player + 1) { queue[tail++] = start; out[start] = 1; }
  while (head < tail) {
    const t = queue[head++]!;
    const cx = t % width, cy = (t - cx) / width;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if ((g.walls[t]! & WALL_BIT[d]!) || (g.walls[ny * width + nx]! & WALL_BIT[d ^ 1]!)) continue; // ściana w zamku (z obu stron)
      const nt = ny * width + nx;
      if (out[nt] || (g.occupancy[nt] !== 0 && g.gates[nt] !== player + 1) || !TERRAIN[g.map.tiles[nt] as Terrain].walkable) continue;
      out[nt] = 1; queue[tail++] = nt;
    }
  }
}

/**
 * Czy nowy budynek odetnie coś, do czego dziś da się dojść. Liczy się tylko różnica przed/po:
 * to, co już było odcięte (np. ludzie w środku budynków), nie blokuje budowy.
 */
function wouldBlock(g: GameState, player: number, x: number, y: number, w: number, h: number, rot: number, needDoor = true, passable = false): boolean {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return false;
  const { width, height } = g.map;
  const size = width * height;
  if (seen.length < size) { seen = new Uint8Array(size); before = new Uint8Array(size); queue = new Int32Array(size); }
  flood(g, keep.door, before, player);
  if (!passable) for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g.occupancy[ty * width + tx] = -1;
  const door = findDoor(g, x, y, w, h, rot);
  flood(g, keep.door, seen, player);
  const lost = (t: number): boolean => before[t] === 1 && seen[t] === 0;
  let blocked = needDoor && (door < 0 || !seen[door]);
  if (!blocked) for (const b of g.buildings) if (b.owner === player && b.door >= 0 && lost(b.door)) { blocked = true; break; }
  if (!blocked) for (const u of g.units) {
    if (u.owner !== player) continue;
    const ux = u.px >> 8, uy = u.py >> 8;
    if (ux >= x && ux < x + w && uy >= y && uy < y + h) continue; // stoi na działce: wyjdzie sam
    if (lost(uy * width + ux)) { blocked = true; break; }
  }
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) g.occupancy[ty * width + tx] = 0;
  return blocked;
}

/** Ile pól od działki nie wolno budować, gdy stoi tam wrogie wojsko */
export const ENEMY_BUILD_GAP = 8;
/** Czy przy działce stoją wrodzy żołnierze (pod nosem wroga nikt nie postawi budynku — ani gracz, ani bot) */
export function enemyNear(g: GameState, player: number, x: number, y: number, w: number, h: number): boolean {
  const team = g.players[player]?.team;
  for (const s of g.soldiers) {
    if (s.hp <= 0 || g.players[s.owner]?.team === team) continue;
    const sx = s.px >> 8, sy = s.py >> 8;
    const dx = Math.max(x - sx, 0, sx - (x + w - 1)), dy = Math.max(y - sy, 0, sy - (y + h - 1));
    if (Math.max(dx, dy) <= ENEMY_BUILD_GAP) return true;
  }
  return false;
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
    if (g.occupancy[t] !== 0 || g.roads[t] === def.road || g.roadPlan[t] === def.road) return 'place.occupied';
    const k = playerKeep(g, player);
    if (!k || Math.max(Math.abs(x - keepCenter(k)[0]), Math.abs(y - keepCenter(k)[1])) > RULES.buildRadius + 10) return 'place.far';
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
  const [kx, ky] = keepCenter(keep);
  if (Math.max(Math.abs(cx - kx), Math.abs(cy - ky)) > RULES.buildRadius) return 'place.far';
  if (def.needsTerrain) {
    const r = def.needsTerrain.radius;
    let found = false;
    for (let ty = Math.max(0, cy - r); ty <= Math.min(height - 1, cy + r) && !found; ty++)
      for (let tx = Math.max(0, cx - r); tx <= Math.min(width - 1, cx + r); tx++)
        if (g.map.tiles[ty * width + tx] === def.needsTerrain.terrain) { found = true; break; }
    if (!found) return 'place.needTerrain';
  }
  if (!def.wall && !def.gate && findDoor(g, x, y, fw, fh, rot) < 0) return 'place.noAccess';
  if (enemyNear(g, player, x, y, fw, fh)) return 'place.enemy';
  if (wouldBlock(g, player, x, y, fw, fh, rot, !def.wall && !def.gate, !!def.gate)) return 'place.blocks';
  if (checkCost && !canAfford(g, player, def)) return 'place.cost';
  return null;
}

/** Zamek: pola dziedzińca i sal są przechodnie dla właściciela, a między pomieszczeniami stoją ściany (wejście tylko bramą) */
export function openWalk(g: GameState, b: Building): void {
  if (BUILDINGS[b.type]!.id !== 'keep') return;
  const w = g.map.width;
  for (const c of KEEP_CELLS) { const t = (b.y + c.dy) * w + b.x + c.dx; g.gates[t] = b.owner + 1; g.walls[t] = c.walls; }
}

/** Wstawia budynek do stanu bez sprawdzania kosztów (używane też dla twierdzy startowej). */
export function addBuilding(g: GameState, type: number, owner: number, x: number, y: number, rot = 0): Building {
  const def = BUILDINGS[type]!;
  const fp = footprint(def, rot);
  // umocnienia nie mają wejścia; brama sama jest przejściem
  // zamek: mieszkańcy idą przez bramę do koszar; inne budynki mają wejście tuż przy ścianie
  const door = def.wall || def.gate ? -1 : def.id === 'keep' ? (y + KEEP_BED[1]) * g.map.width + x + KEEP_BED[0] : findDoor(g, x, y, fp.w, fp.h, rot);
  const b: Building = { id: g.nextId++, type, owner, x, y, rot, door, worker: 0, lit: false, hp: maxHp(type), build: 0 };
  for (let ty = y; ty < y + fp.h; ty++)
    for (let tx = x; tx < x + fp.w; tx++) { g.occupancy[ty * g.map.width + tx] = b.id; g.roads[ty * g.map.width + tx] = 0; g.roadPlan[ty * g.map.width + tx] = 0; } // budynek zastępuje drogę pod sobą
  if (door >= 0) g.reserved[door]!++;
  if (def.gate) { b.gateOpen = true; b.shut = false; g.gates[y * g.map.width + x] = owner + 1; }
  openWalk(g, b);
  g.buildings.push(b);
  return b;
}

/** Ile pracy wymaga postawienie budynku (rośnie z wielkością działki) */
export function buildWork(type: number): number {
  const def = BUILDINGS[type]!;
  return Math.min(1800, def.w * def.h * 60);
}

/**
 * Ile ładunków materiału robotnicy muszą przynieść ze składu na plac budowy: jeden ładunek na każde 8 sztuk kosztu
 * (deski, kamień, żelazo), od 1 do 6. Materiał jest już zapłacony przy stawianiu — noszenie to praca, nie koszt.
 */
export function siteLoads(type: number): number {
  const c = BUILDINGS[type]!.cost as Record<string, number>;
  const sum = (c.wood ?? 0) + (c.stone ?? 0) + (c.iron ?? 0);
  return sum <= 0 ? 0 : Math.max(1, Math.min(6, Math.ceil(sum / 8)));
}
/** Przygotowuje plac budowy: tyle pracy i tyle ładunków do przyniesienia */
export function startSite(b: Building, loadsFactor = 1): void {
  b.build = buildWork(b.type);
  b.loads = Math.ceil(siteLoads(b.type) * loadsFactor);
  b.delivered = 0;
  b.haul = b.loads;
}

/**
 * Zniszczenie przez wroga albo wilki: budynek nie znika, tylko zamienia się w ruinę do odbudowy
 * (robotnicy i inżynierowie odbudowują ją jak budowę). Wyłom w murze da się przejść, dopóki go nie załatają.
 * Twierdza nadal pada naprawdę — to koniec gracza.
 */
export function ruin(g: GameState, b: Building): void {
  const def = BUILDINGS[b.type]!;
  if (def.id === 'keep') { demolish(g, b.owner, b.id, true); return; }
  startSite(b, 0.5); // odbudowa ruiny: część materiału leży w gruzie
  b.hp = maxHp(b.type);
  b.ruined = true;
  if (b.worker) { const u = g.units.find((x) => x.id === b.worker); if (u) { u.job = 0; u.phase = Phase.Idle; u.path = []; u.carryRes = -1; u.carryAmt = 0; } b.worker = 0; }
  if (def.wall || def.gate) {
    const fp = footprint(def, b.rot);
    for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) { g.occupancy[y * g.map.width + x] = 0; g.gates[y * g.map.width + x] = 0; g.walls[y * g.map.width + x] = 0; }
  }
}

/** Koniec odbudowy ruiny: mur znów zamyka przejście (o ile nikt na nim akurat nie stoi) */
export function restore(g: GameState, b: Building): boolean {
  const def = BUILDINGS[b.type]!;
  if (def.wall || def.gate) {
    const fp = footprint(def, b.rot), w = g.map.width;
    for (const u of g.units) { const x = u.px >> 8, y = u.py >> 8; if (x >= b.x && x < b.x + fp.w && y >= b.y && y < b.y + fp.h) return false; }
    for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) g.occupancy[y * w + x] = b.id;
    if (def.gate) g.gates[b.y * w + b.x] = b.owner + 1;
  }
  b.ruined = false;
  return true;
}

export function placeBuilding(g: GameState, player: number, type: number, x: number, y: number, rot = 0): boolean {
  if (canPlace(g, player, type, x, y, true, rot) !== null) return false;
  const def = BUILDINGS[type]!;
  const p = g.players[player]!;
  for (const [k, v] of Object.entries(def.cost)) p.res[resIndex(k as ResourceId)]! -= v;
  if (def.road) {
    // droga powstaje dopiero, gdy chłop ją ułoży; w trybie deweloperskim od razu
    const t = y * g.map.width + x;
    if (p.dev && p.instantBuild !== false) { g.roads[t] = def.road; g.roadPlan[t] = 0; }
    else g.roadPlan[t] = def.road;
    return true;
  }
  const b = addBuilding(g, type, player, x, y, rot);
  // budowa trwa: robotnicy z obozowiska przychodzą i stawiają budynek (pochodnia stoi od razu)
  if (b && def.id !== 'torch' && !(p.dev && p.instantBuild !== false)) startSite(b);
  p.stats.built++;
  return true;
}

/** Wytrzymałość budynku: twierdza dużo, reszta według wielkości działki */
export function maxHp(type: number): number {
  const def = BUILDINGS[type]!;
  return def.hp ?? def.w * def.h * 40;
}

/** `destroyed` = zburzony przez wroga: bez zwrotu kosztu i bez sprawdzania, czy wolno go rozebrać */
export function demolish(g: GameState, player: number, id: number, destroyed = false): boolean {
  const i = g.buildings.findIndex((b) => b.id === id);
  const b = g.buildings[i];
  if (!b || (!destroyed && b.owner !== player)) return false;
  const def = BUILDINGS[b.type]!;
  if (!def.buildable && !destroyed) return false;
  const fp = footprint(def, b.rot);
  for (let ty = b.y; ty < b.y + fp.h; ty++)
    for (let tx = b.x; tx < b.x + fp.w; tx++) { g.occupancy[ty * g.map.width + tx] = 0; g.gates[ty * g.map.width + tx] = 0; g.walls[ty * g.map.width + tx] = 0; }
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
  if (!destroyed) for (const [k, v] of Object.entries(def.cost)) {
    let left = Math.floor((v * RULES.refundPercent) / 100);
    while (left > 0) { const n = Math.min(left, RULES.rubbleLoad); loads.push([resIndex(k as ResourceId), n]); left -= n; }
  }
  if (!loads.length) loads.push([-1, 0]); // nawet bezwartościowy gruz trzeba raz wynieść
  g.rubble.push({ id: g.nextId++, owner: b.owner, type: b.type, x: b.x, y: b.y, w: fp.w, h: fp.h, loads, total: loads.length });
  // na gruzie nie da się budować, ale można po nim przejść
  for (let ty = b.y; ty < b.y + fp.h; ty++)
    for (let tx = b.x; tx < b.x + fp.w; tx++) g.reserved[ty * g.map.width + tx]!++;
  return true;
}

/** Usuwa drogę z pola (od razu, bez gruzu). */
export function removeRoad(g: GameState, player: number, x: number, y: number): boolean {
  if (!g.players[player] || x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return false;
  const t = y * g.map.width + x;
  // zaplanowana, jeszcze nieułożona droga: znika plan (koszt przepada jak przy rozbiórce)
  if (g.roadPlan[t]) { g.roadPlan[t] = 0; return true; }
  if (!g.roads[t]) return false;
  g.roads[t] = 0;
  return true;
}

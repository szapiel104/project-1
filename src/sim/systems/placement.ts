import { releaseCrew } from '../state';
import { mineNear } from './minecamp';
import { BUILDINGS, brazierHost, footprint, isTower, type BuildingDef } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { RULES } from '../../data/rules';
import { TERRAIN, Terrain } from '../../data/terrain';
import { KEEP_BED, KEEP_CELLS } from '../../data/keep';
import { FP, inForecourt, Phase, playerKeep, type Building, type GameState } from '../state';

/** Powód, dla którego nie da się budować (klucz tłumaczenia), albo null gdy wolno. */
export type PlaceError =
  | 'place.outside' | 'place.terrain' | 'place.occupied' | 'place.far'
  | 'place.cost' | 'place.needTerrain' | 'place.noAccess' | 'place.blocks' | 'place.enemy' | 'place.enemyLand' | 'place.forecourt' | 'place.ladder' | 'place.brazier' | 'place.brazierTaken' | 'place.needRock' | 'place.needMine' | 'place.needs' | 'place.unknown';

/** Te budynki zawsze kosztują tyle samo (stawia się ich dużo naraz: linie, drogi, drobne dodatki) */
const FLAT = new Set(['torch', 'palisade', 'gate', 'stoneWall', 'stoneGate', 'ladder', 'brazier', 'well']);
const flatCost = (def: BuildingDef): boolean => !!def.road || !!def.line || !!def.addon || FLAT.has(def.id);

/** Etap osady według liczby ludzi (0 wioska, 1 osada, 2 gród, 3 miasto) */
export function tierFor(pop: number): number {
  let t = 0;
  RULES.tiers.forEach((n, i) => { if (pop >= n) t = i; });
  return t;
}

/** Ile kosztuje następny budynek tego rodzaju: każdy już postawiony (także w budowie, bez ruin) podnosi cenę o RULES.costStep % */
export function buildCost(g: GameState, player: number, type: number): Partial<Record<ResourceId, number>> {
  const def = BUILDINGS[type]!;
  if (flatCost(def)) return def.cost;
  let n = 0;
  for (const b of g.buildings) if (b.owner === player && b.type === type && !b.ruined) n++;
  const pct = 100 + Math.min(RULES.costStepMax, n * RULES.costStep);
  if (pct === 100) return def.cost;
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [k, v] of Object.entries(def.cost) as [ResourceId, number][]) out[k] = Math.ceil((v * pct) / 100);
  return out;
}

export function canAfford(g: GameState, player: number, def: BuildingDef): boolean {
  const p = g.players[player];
  if (!p) return false;
  for (const [k, v] of Object.entries(buildCost(g, player, BUILDINGS.indexOf(def))) as [ResourceId, number][]) if (p.res[resIndex(k)]! < v) return false;
  return true;
}

/**
 * Drzewko budowy: czego brakuje, żeby postawić budynek (null = nic, wolno). `need` = id wymaganego budynku,
 * `building` = gracz już go stawia, ale budowa jeszcze trwa (liczy się tylko gotowy, nie zburzony).
 */
export function missingRequirement(g: GameState, player: number, def: BuildingDef): { need: string; building: boolean; tier?: number } | null {
  const p = g.players[player];
  // etap osady: budynek z wyższego etapu czeka, aż osada urośnie (tryb deweloperski bez ograniczeń)
  if (def.tier && p && !p.dev && (p.tier ?? 0) < def.tier) return { need: '', building: false, tier: def.tier };
  if (!def.requires) return null;
  let building = false;
  for (const b of g.buildings) {
    if (b.owner !== player || b.ruined || BUILDINGS[b.type]!.id !== def.requires) continue;
    if (b.build === 0) return null;
    building = true;
  }
  return { need: def.requires, building };
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

/** Pola tuż za tylnym bokiem działki (naprzeciw wejścia): tam kopalnia wchodzi w zbocze */
export function backTiles(g: GameState, x: number, y: number, w: number, h: number, rot = 0): number[] {
  const { width, height } = g.map;
  const back = (rot + 2) % 4; // 0 = wejście od +y, więc tył to -y; dalej zgodnie z findDoor
  const cells: [number, number][] = back === 0 ? Array.from({ length: w }, (_, i) => [x + i, y + h])
    : back === 1 ? Array.from({ length: h }, (_, i) => [x + w, y + i])
    : back === 2 ? Array.from({ length: w }, (_, i) => [x + i, y - 1])
    : Array.from({ length: h }, (_, i) => [x - 1, y + i]);
  return cells.filter(([tx, ty]) => tx >= 0 && ty >= 0 && tx < width && ty < height).map(([tx, ty]) => ty * width + tx);
}

/** Czy za budynkiem jest skała: większość pól przy tylnym boku to góry (krawędź masywu bywa poszarpana, więc nie wymagamy wszystkich) */
export function rockBehind(g: GameState, x: number, y: number, w: number, h: number, rot = 0): boolean {
  const back = backTiles(g, x, y, w, h, rot);
  const span = rot % 2 ? h : w;
  if (back.length < span) return false; // tył wystaje poza mapę
  let rock = 0;
  for (const t of back) if (g.map.tiles[t] === Terrain.Mountain) rock++;
  return rock * 2 > span;
}

let seen = new Uint8Array(0), before = new Uint8Array(0), beforeKey = '';
let batch = false;
/** Wiele sprawdzeń miejsca pod rząd bez zmian w stanie (bot szuka miejsca): wspólne zalanie „przed” */
export function placementBatch<T>(fn: () => T): T {
  batch = true; beforeKey = '';
  try { return fn(); } finally { batch = false; beforeKey = ''; }
}
let queue = new Int32Array(0);

/**
 * Czy budynek w tym miejscu odciąłby drogę: po postawieniu z wejścia twierdzy musi dać się dojść
 * do wejścia każdego budynku gracza (także nowego) i do każdego jego chłopa.
 */
const WALL_BIT = [2, 8, 4, 1];
/** Zalewanie od drzwi twierdzy: które pola są osiągalne pieszo. */
/** Czy po terenie da się chodzić — raz na mapę (woda i góry się nie zmieniają, wycięty las był i jest przechodni) */
const walkCache = new WeakMap<object, Uint8Array>();
function terrainWalk(g: GameState): Uint8Array {
  let a = walkCache.get(g.map);
  if (!a) { a = new Uint8Array(g.map.tiles.length); for (let i = 0; i < a.length; i++) a[i] = TERRAIN[g.map.tiles[i] as Terrain].walkable ? 1 : 0; walkCache.set(g.map, a); }
  return a;
}
function flood(g: GameState, start: number, out: Uint8Array, player: number): void {
  const { width, height } = g.map;
  const tw = terrainWalk(g), occ = g.occupancy, gates = g.gates, walls = g.walls, me = player + 1;
  out.fill(0, 0, width * height);
  let head = 0, tail = 0;
  if (g.occupancy[start] === 0 || g.gates[start] === player + 1) { queue[tail++] = start; out[start] = 1; }
  while (head < tail) {
    const t = queue[head++]!;
    const cx = t % width, cy = (t - cx) / width;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nt = ny * width + nx;
      if (out[nt] || (occ[nt] !== 0 && gates[nt] !== me) || !tw[nt]) continue;
      if ((walls[t]! & WALL_BIT[d]!) || (walls[nt]! & WALL_BIT[d ^ 1]!)) continue; // ściana w zamku (z obu stron)
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
  if (seen.length < size) { seen = new Uint8Array(size); before = new Uint8Array(size); queue = new Int32Array(size); beforeKey = ''; }
  // „przed” jest takie samo dla wszystkich miejsc sprawdzanych w tym samym ticku (bot sprawdza ich dziesiątki naraz)
  // (tylko w paczce sprawdzeń bota — poza nią stan mógł się zmienić w tym samym ticku, więc liczymy od nowa)
  const key = batch ? `${g.tick}:${player}:${g.nextId}:${keep.door}` : '';
  if (!key || key !== beforeKey) { flood(g, keep.door, before, player); beforeKey = key; }
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

/** Ile pól wokół każdego budynku wroga należy do niego: tam nie postawisz nic swojego, dopóki budynek stoi */
export const ENEMY_LAND = 6;
/** Czy prostokąt (x..x+w-1, y..y+h-1) leży na ziemi wroga: w pasie ENEMY_LAND wokół jego budynku (zburzony i ruina się nie liczą) */
export function enemyLand(g: GameState, player: number, x: number, y: number, w: number, h: number): boolean {
  const team = g.players[player]?.team;
  for (const b of g.buildings) {
    if (b.ruined || g.players[b.owner]?.team === team) continue;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    const dx = Math.max(b.x - (x + w - 1), 0, x - (b.x + fp.w - 1)), dy = Math.max(b.y - (y + h - 1), 0, y - (b.y + fp.h - 1));
    if (Math.max(dx, dy) <= ENEMY_LAND) return true;
  }
  return false;
}

/** Czy na tym jednym polu wolno budować (siatka w trybie budowy): teren, wolne pole, nie plac przed bramą, poza ziemią wroga */
export function tileBuildable(g: GameState, player: number, x: number, y: number): boolean {
  const { width, height } = g.map;
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const t = y * width + x;
  if (!TERRAIN[g.map.tiles[t] as Terrain].buildable || g.occupancy[t] !== 0 || g.reserved[t] !== 0 || inForecourt(g, x, y)) return false;
  if (!playerKeep(g, player)) return false;
  return !enemyLand(g, player, x, y, 1, 1);
}

export function canPlace(g: GameState, player: number, type: number, x: number, y: number, checkCost = true, rot = 0): PlaceError | null {
  const def = BUILDINGS[type];
  if (!def || !def.buildable || def.legacy || !g.players[player]) return 'place.unknown';
  if (missingRequirement(g, player, def)) return 'place.needs';
  const { w: fw, h: fh } = footprint(def, rot);
  const { width, height } = g.map;
  if (x < 0 || y < 0 || x + fw > width || y + fh > height) return 'place.outside';
  if (def.road) {
    // droga: wystarczy wolne pole, po którym da się chodzić; nie blokuje i nie potrzebuje wejścia
    const t = y * width + x;
    if (!TERRAIN[g.map.tiles[t] as Terrain].walkable) return 'place.terrain';
    if (g.occupancy[t] !== 0 || g.roads[t] === def.road || g.roadPlan[t] === def.road) return 'place.occupied';
    if (!playerKeep(g, player)) return 'place.far';
    if (enemyLand(g, player, x, y, 1, 1)) return 'place.enemyLand';
    if (checkCost && !canAfford(g, player, def)) return 'place.cost';
    return null;
  }
  // koksownik: wyposaża stojący już własny mur kamienny albo kamienną wieżę (nie zajmuje pola)
  if (def.addon) {
    const host = brazierHostAt(g, player, x, y);
    if (!host) return 'place.brazier';
    if (host.brazier) return 'place.brazierTaken';
    if (checkCost && !canAfford(g, player, def)) return 'place.cost';
    return null;
  }
  // brama, wieża albo mur kamienny na istniejącym własnym murze: zastępuje przęsła pod sobą
  const over = wallsUnder(g, player, type, x, y, fw, fh);
  const overTiles = new Set<number>();
  if (over) for (const o of over) overTiles.add(o.y * width + o.x);
  for (let ty = y; ty < y + fh; ty++) {
    for (let tx = x; tx < x + fw; tx++) {
      const t = ty * width + tx;
      if (!TERRAIN[g.map.tiles[t] as Terrain].buildable) return 'place.terrain';
      if (overTiles.has(t)) continue;
      if (g.occupancy[t] !== 0 || g.reserved[t] !== 0) return 'place.occupied';
      if (inForecourt(g, tx, ty)) return 'place.forecourt';
    }
  }
  if (def.id === 'ladder' && ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
    const id = g.occupancy[(y + dy!) * width + x + dx!];
    const o = id ? g.buildings.find((b) => b.id === id) : undefined;
    return !!o && o.owner === player && BUILDINGS[o.type]!.id === 'stoneWall';
  })) return 'place.ladder';
  // budować można na całej mapie (wróg co najwyżej zburzy), ale nie na ziemi wroga — przy jego budynkach
  if (!playerKeep(g, player)) return 'place.far';
  const cx = x + (fw >> 1), cy = y + (fh >> 1);
  if (enemyLand(g, player, x, y, fw, fh)) return 'place.enemyLand';
  if (def.needsTerrain) {
    const r = def.needsTerrain.radius;
    let found = false;
    for (let ty = Math.max(0, cy - r); ty <= Math.min(height - 1, cy + r) && !found; ty++)
      for (let tx = Math.max(0, cx - r); tx <= Math.min(width - 1, cx + r); tx++)
        if (g.map.tiles[ty * width + tx] === def.needsTerrain.terrain) { found = true; break; }
    if (!found) return 'place.needTerrain';
  }
  if (def.needsRock && !rockBehind(g, x, y, fw, fh, rot)) return 'place.needRock';
  if (def.id === 'minecamp' && !mineNear(g, player, x, y, fw, fh)) return 'place.needMine';
  if (!def.wall && !def.gate && findDoor(g, x, y, fw, fh, rot) < 0) return 'place.noAccess';
  if (enemyNear(g, player, x, y, fw, fh)) return 'place.enemy';
  if (!over && wouldBlock(g, player, x, y, fw, fh, rot, !def.wall && !def.gate, !!def.gate || def.id === 'ladder')) return 'place.blocks';
  if (checkCost && !canAfford(g, player, def)) return 'place.cost';
  return null;
}

/**
 * Przęsła własnego muru (częstokół, mur kamienny) pod działką, na które wolno postawić bramę, wieżę strażniczą
 * albo mur kamienny (ten tylko na częstokół — zamiana bali na kamień). Wszystkie zajęte pola działki muszą być
 * takimi przęsłami i musi być choć jedno; inaczej undefined (zwykłe stawianie na wolnym polu).
 */
export function wallsUnder(g: GameState, player: number, type: number, x: number, y: number, w: number, h: number): Building[] | undefined {
  const def = BUILDINGS[type]!;
  if (!(def.gate || isTower(def.id) || def.id === 'stoneWall')) return undefined;
  const W = g.map.width;
  const out: Building[] = [];
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= g.map.height) return undefined;
    if (g.occupancy[ty * W + tx] === 0) continue;
    const b = g.buildings.find((o) => o.x === tx && o.y === ty && BUILDINGS[o.type]!.line === true);
    if (!b || b.owner !== player || b.ruined || (def.id === 'stoneWall' && b.type === type)) return undefined;
    out.push(b);
  }
  return out.length ? out : undefined;
}

/** Własny, gotowy mur kamienny albo kamienna wieża na polu (x, y), na której można postawić koksownik */
export function brazierHostAt(g: GameState, player: number, x: number, y: number): Building | undefined {
  if (x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return undefined;
  const id = g.occupancy[y * g.map.width + x];
  const b = id ? g.buildings.find((o) => o.id === id) : undefined;
  if (!b || b.owner !== player || b.ruined || b.build || !brazierHost(BUILDINGS[b.type]!.id)) return undefined;
  return b;
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
  // odbudowa nie jest za darmo: zanim ktokolwiek chwyci za młotek, pan płaci połowę kosztu budynku (systems/army.ts)
  b.unpaid = rebuildCost(b.type).length > 0 || undefined;
  b.salvage = undefined;
  b.brazier = undefined; // koksownik spada razem z murem
  releaseCrew(g, b);
  if (def.wall || def.gate) {
    const fp = footprint(def, b.rot);
    for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) { g.occupancy[y * g.map.width + x] = 0; g.gates[y * g.map.width + x] = 0; g.walls[y * g.map.width + x] = 0; }
  }
}

/** Koszt odbudowy ruiny: połowa kosztu budynku (w górę) — drewno, kamień, żelazo i ruda */
export function rebuildCost(type: number): [ResourceId, number][] {
  const out: [ResourceId, number][] = [];
  for (const [k, v] of Object.entries(BUILDINGS[type]!.cost)) { const n = Math.ceil((v as number) / 2); if (n > 0) out.push([k as ResourceId, n]); }
  return out;
}

/** Czego brakuje graczowi do zapłaty za odbudowę (puste = stać go) */
export function rebuildShort(g: GameState, b: Building): [ResourceId, number][] {
  const p = g.players[b.owner];
  if (!p) return [];
  return rebuildCost(b.type).filter(([k, v]) => p.res[resIndex(k)]! < v).map(([k, v]) => [k, v - p.res[resIndex(k)]!]);
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
  b.ruined = false; b.unpaid = undefined; b.salvage = undefined;
  return true;
}

export function placeBuilding(g: GameState, player: number, type: number, x: number, y: number, rot = 0): boolean {
  if (canPlace(g, player, type, x, y, true, rot) !== null) return false;
  const def = BUILDINGS[type]!;
  const p = g.players[player]!;
  for (const [k, v] of Object.entries(buildCost(g, player, type)) as [ResourceId, number][]) p.res[resIndex(k)]! -= v;
  if (def.addon) { brazierHostAt(g, player, x, y)!.brazier = 1; return true; }
  if (def.road) {
    // droga powstaje dopiero, gdy chłop ją ułoży; w trybie deweloperskim od razu
    const t = y * g.map.width + x;
    if (p.dev && p.instantBuild !== false) { g.roads[t] = def.road; g.roadPlan[t] = 0; }
    else g.roadPlan[t] = def.road;
    return true;
  }
  // brama / wieża / mur kamienny w miejscu przęseł muru: przęsła znikają bez gruzu (materiał idzie na nowe)
  const fpo = footprint(def, rot);
  for (const o of wallsUnder(g, player, type, x, y, fpo.w, fpo.h) ?? []) {
    const t = o.y * g.map.width + o.x;
    g.occupancy[t] = 0; g.gates[t] = 0;
    g.buildings.splice(g.buildings.indexOf(o), 1);
    for (const u of g.units) if (u.target === o.id) { u.target = 0; u.path = []; }
  }
  const b = addBuilding(g, type, player, x, y, rot);
  // żołnierze stojący na działce schodzą z niej na najbliższe wolne pole (zamiast stać w środku ścian)
  if (b) {
    const fp = footprint(def, rot), W = g.map.width;
    for (const s of g.soldiers) {
      const sx = s.px >> 8, sy = s.py >> 8;
      if (s.up || sx < x || sy < y || sx >= x + fp.w || sy >= y + fp.h) continue;
      let best = -1, bd = Infinity;
      for (let ty = y - 1; ty <= y + fp.h; ty++) for (let tx = x - 1; tx <= x + fp.w; tx++) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= g.map.height) continue;
        const t = ty * W + tx;
        if (g.occupancy[t] !== 0 || !TERRAIN[g.map.tiles[t] as Terrain].walkable) continue;
        const d = Math.abs(tx - sx) + Math.abs(ty - sy);
        if (d < bd) { bd = d; best = t; }
      }
      if (best >= 0) { s.px = (best % W) * FP + FP / 2; s.py = Math.floor(best / W) * FP + FP / 2; s.path = []; if (s.goal >= 0 && g.occupancy[s.goal] !== 0) s.goal = best; }
    }
  }
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
  // Zwrot połowy kosztu nie wpada od razu: leży w gruzie i wraca do składu ładunek po ładunku.
  // Porzucona ruina nie zwraca nic (zostaje sam gruz) — inaczej ruina byłaby darmowym źródłem surowców.
  const loads: [number, number][] = [];
  if (!destroyed && !b.ruined) for (const [k, v] of Object.entries(def.cost)) {
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

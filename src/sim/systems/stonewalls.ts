import { BUILDINGS, TOWERS, buildingIndex, footprint } from '../../data/buildings';
import { WALL_TOP } from '../../data/keep';
import { OPEN_ALL, walkable } from '../path';
import type { Building, GameState } from '../state';
import { buildingById } from '../state';

/**
 * Mur kamienny jak w Twierdzy: korona muru to zwykły teren, tylko wysoko. Wchodzi się i schodzi tylko po drabinach,
 * które stawia gracz — kto dojdzie do drabiny (także wróg, gdy stoi od zewnątrz), ten wejdzie; z ziemi na mur ani z muru
 * na ziemię poza drabiną nie da się przejść. Łucznik na murze ma bit WALL_TOP: strzela dalej, wręcz go nie dosięgną.
 *
 * Wieże (Michał 28.10.2026, jak w Twierdzy 2): pomost to też teren, tylko wysoko — każde pole wieży ma bit WALL_TOP.
 * Wchodzi się drabiną drewnianej wieży albo drzwiami kamiennej (od frontu), z przyległego muru kamiennego albo po
 * drabinie gracza przystawionej z boku. Na wieżę wchodzą tylko swoi (jak przez bramę). Każdy żołnierz staje na swoim
 * polu, więc im mniejsza wieża, tym mniej się zmieści; stojący na niej strzela dalej (wysokość + premia wieży).
 */
const STONE = buildingIndex('stoneWall');
/** Bity ścian pola: 1 = ku -y, 2 = ku +x, 4 = ku +y, 8 = ku -x (jak w zamku) */
const SIDES: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];

/** Typy wież (pomost, na który się wchodzi) */
export const TOWER_TYPES: ReadonlySet<number> = new Set(Object.keys(TOWERS).map((id) => buildingIndex(id)).filter((i) => i >= 0));

/** Korona muru kamiennego albo pomost gotowej wieży: wysoki teren, z którym sąsiedni mur się łączy */
const isStone = (g: GameState, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return false;
  const id = g.occupancy[y * g.map.width + x];
  if (!id) return false;
  const b = buildingById(g, id);
  return !!b && (b.type === STONE || (TOWER_TYPES.has(b.type) && !b.build && !b.ruined));
};

/** Wieża, na której pomoście leży pole (pole ma bit WALL_TOP i należy do gotowej wieży); undefined = nie wieża */
export function towerUnder(g: GameState, tile: number): Building | undefined {
  if (!(g.walls[tile]! & WALL_TOP)) return undefined;
  const id = g.occupancy[tile];
  if (!id) return undefined;
  const b = buildingById(g, id);
  return b && TOWER_TYPES.has(b.type) && !b.build && !b.ruined ? b : undefined;
}

/**
 * Wejście na wieżę: pole przed nią i pole pomostu tuż za nim. Najpierw front (drabina, drzwi; rot 0 = od +y); gdy przed
 * frontem stoi mur albo budynek, wejście przechodzi na pierwszy wolny bok (prawy, tył, lewy), żeby wieża wciśnięta
 * w narożnik muru nie była odcięta od ziemi.
 */
export function towerEntry(g: GameState, b: Building): [number, number] {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width, h = g.map.height, r = ((b.rot % 4) + 4) % 4;
  const side = (k: number): [number, number] => {
    const [ox, oy, ix, iy] = k === 0 ? [b.x + (fp.w >> 1), b.y + fp.h, b.x + (fp.w >> 1), b.y + fp.h - 1]
      : k === 1 ? [b.x + fp.w, b.y + (fp.h >> 1), b.x + fp.w - 1, b.y + (fp.h >> 1)]
      : k === 2 ? [b.x + (fp.w >> 1), b.y - 1, b.x + (fp.w >> 1), b.y]
      : [b.x - 1, b.y + (fp.h >> 1), b.x, b.y + (fp.h >> 1)];
    return [ox < 0 || oy < 0 || ox >= w || oy >= h ? -1 : oy * w + ox, iy * w + ix];
  };
  for (let k = 0; k < 4; k++) {
    const e = side((r + k) % 4);
    if (e[0] >= 0 && walkable(g, e[0])) return e;
  }
  return side(r);
}

/** Pola pomostu wieży */
export function towerTiles(g: GameState, b: Building): number[] {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width, out: number[] = [];
  for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) out.push(y * w + x);
  return out;
}

const LADDER = buildingIndex('ladder');
const isLadder = (g: GameState, x: number, y: number, owner: number): boolean => {
  if (x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return false;
  const id = g.occupancy[y * g.map.width + x];
  const b = id ? buildingById(g, id) : undefined;
  return !!b && b.type === LADDER && b.owner === owner && !b.build && !b.ruined;
};

/** Boki pola muru (bity jak SIDES: 1 = -y, 2 = +x, 4 = +y, 8 = -x), przy których stoi gotowa drabina gracza */
export function ladderSides(g: GameState, b: Building): number {
  let m = 0;
  for (const [dx, dy, bit] of SIDES) if (isLadder(g, b.x + dx, b.y + dy, b.owner)) m |= bit;
  return m;
}

/** Ustawia przechodniość korony murów (co tick: mur mógł powstać, zostać zburzony albo dostać sąsiada) */
export function stoneWallSystem(g: GameState): void {
  const w = g.map.width;
  for (const b of g.buildings) {
    if (b.type !== STONE) continue;
    const t = b.y * w + b.x;
    if (b.build || b.ruined) { g.gates[t] = 0; g.walls[t] = 0; continue; }
    g.gates[t] = OPEN_ALL;
    const ladders = ladderSides(g, b);
    let bits = WALL_TOP;
    for (const [dx, dy, bit] of SIDES) if (!(ladders & bit) && !isStone(g, b.x + dx, b.y + dy)) bits |= bit;
    g.walls[t] = bits;
  }
  // pomosty wież: wysoki teren tylko dla swoich, wejście od frontu (drabina albo drzwi), z muru i z drabiny gracza
  for (const b of g.buildings) {
    if (!TOWER_TYPES.has(b.type)) continue;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    const live = !b.build && !b.ruined;
    const [door, inner] = live ? towerEntry(g, b) : [-1, -1];
    for (let y = b.y; y < b.y + fp.h; y++)
      for (let x = b.x; x < b.x + fp.w; x++) {
        const t = y * w + x;
        if (!live) { g.gates[t] = 0; g.walls[t] = 0; continue; }
        g.gates[t] = b.owner + 1;
        let bits = WALL_TOP;
        for (const [dx, dy, bit] of SIDES) {
          const nx = x + dx, ny = y + dy;
          if (nx >= b.x && ny >= b.y && nx < b.x + fp.w && ny < b.y + fp.h) continue; // wnętrze pomostu
          if (t === inner && door >= 0 && ny * w + nx === door) continue;              // wejście
          if (isStone(g, nx, ny) || isLadder(g, nx, ny, b.owner)) continue;            // mur obok, drabina gracza
          bits |= bit;
        }
        g.walls[t] = bits;
      }
  }
  // drabina: pole u stóp jest przechodnie dla każdego — postawiona od zewnątrz posłuży też wrogowi
  for (const b of g.buildings) {
    if (b.type !== LADDER) continue;
    g.gates[b.y * w + b.x] = b.build || b.ruined ? 0 : OPEN_ALL;
  }
}

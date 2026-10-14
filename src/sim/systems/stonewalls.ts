import { buildingIndex } from '../../data/buildings';
import { WALL_TOP } from '../../data/keep';
import { OPEN_ALL } from '../path';
import type { Building, GameState } from '../state';
import { buildingById } from '../state';

/**
 * Mur kamienny jak w Twierdzy: korona muru to zwykły teren, tylko wysoko. Wchodzi się i schodzi tylko po drabinach,
 * które stawia gracz — kto dojdzie do drabiny (także wróg, gdy stoi od zewnątrz), ten wejdzie; z ziemi na mur ani z muru
 * na ziemię poza drabiną nie da się przejść. Łucznik na murze ma bit WALL_TOP: strzela dalej, wręcz go nie dosięgną.
 */
const STONE = buildingIndex('stoneWall');
/** Bity ścian pola: 1 = ku -y, 2 = ku +x, 4 = ku +y, 8 = ku -x (jak w zamku) */
const SIDES: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];

const isStone = (g: GameState, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= g.map.width || y >= g.map.height) return false;
  const id = g.occupancy[y * g.map.width + x];
  if (!id) return false;
  const b = buildingById(g, id);
  return !!b && b.type === STONE;
};

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
  // drabina: pole u stóp jest przechodnie dla każdego — postawiona od zewnątrz posłuży też wrogowi
  for (const b of g.buildings) {
    if (b.type !== LADDER) continue;
    g.gates[b.y * w + b.x] = b.build || b.ruined ? 0 : OPEN_ALL;
  }
}

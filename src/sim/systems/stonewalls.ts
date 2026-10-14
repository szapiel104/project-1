import { buildingIndex } from '../../data/buildings';
import { WALL_TOP } from '../../data/keep';
import type { Building, GameState } from '../state';
import { buildingById, keepCenter, playerKeep } from '../state';

/**
 * Mur kamienny jak w Twierdzy: korona muru to zwykły teren, tylko wysoko. Chodzą po niej wszyscy właściciela
 * (wróg nie — jak przez zamkniętą bramę), wchodzi się i schodzi tylko po drabinach; z ziemi na mur ani z muru
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

/**
 * Po której stronie pola muru stoi drabina (indeks w SIDES) albo -1. Drabina stoi od strony twierdzy, na wolnym polu
 * przed murem, na co czwartym polu i na każdym końcu muru — ten sam wynik liczy scena, żeby drabina była tam, gdzie przejście.
 */
export function ladderSide(g: GameState, b: Building): number {
  const keep = playerKeep(g, b.owner);
  let n = 0;
  for (const [dx, dy] of SIDES) if (isStone(g, b.x + dx, b.y + dy)) n++;
  if (n >= 2 && (b.x * 7 + b.y * 13) % 4 !== 0) return -1;
  const [kx, ky] = keep ? keepCenter(keep) : [b.x, b.y + 10];
  let best = -1, bd = 0;
  for (let i = 0; i < 4; i++) {
    const [dx, dy] = SIDES[i]!;
    const x = b.x + dx, y = b.y + dy;
    if (x < 0 || y < 0 || x >= g.map.width || y >= g.map.height || g.occupancy[y * g.map.width + x] !== 0) continue;
    const d = dx * (kx - b.x) + dy * (ky - b.y);
    if (d > bd) { bd = d; best = i; }
  }
  return best;
}

/** Ustawia przechodniość korony murów (co tick: mur mógł powstać, zostać zburzony albo dostać sąsiada) */
export function stoneWallSystem(g: GameState): void {
  const w = g.map.width;
  for (const b of g.buildings) {
    if (b.type !== STONE) continue;
    const t = b.y * w + b.x;
    if (b.build || b.ruined) { g.gates[t] = 0; g.walls[t] = 0; continue; }
    g.gates[t] = b.owner + 1;
    const ladder = ladderSide(g, b);
    let bits = WALL_TOP;
    for (let i = 0; i < 4; i++) {
      const [dx, dy, bit] = SIDES[i]!;
      if (i !== ladder && !isStone(g, b.x + dx, b.y + dy)) bits |= bit;
    }
    g.walls[t] = bits;
  }
}

import { expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { Terrain } from '../src/data/terrain';
import { createGame } from '../src/sim/state';

it('mapa deweloperska: mur (kamienny i z bali) z czterema bramami wokół miasta bez dziur na kamieniach i w lesie (dziura tylko w wodzie i górach)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = createGame(seed, '1v1', 2, true);
    const W = g.map.width;
    const walls = g.buildings.filter((b) => b.owner === 0 && (BUILDINGS[b.type]!.line || BUILDINGS[b.type]!.gate));
    if (!walls.length) continue;
    const ids = (id: string): number => g.buildings.filter((b) => b.owner === 0 && BUILDINGS[b.type]!.id === id).length;
    expect(ids('stoneWall'), `seed ${seed}`).toBeGreaterThan(10);
    expect(ids('palisade'), `seed ${seed}`).toBeGreaterThan(10);
    expect(ids('gate'), `seed ${seed}`).toBe(4);
    expect(ids('ladder'), `seed ${seed}`).toBeGreaterThan(0);
    const xs = walls.map((b) => b.x), ys = walls.map((b) => b.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) {
      const t = y * W + x;
      const tile = g.map.tiles[t]!;
      // pole obwodu: albo stoi na nim coś (mur, brama, wieża, inny budynek), albo to woda/góra
      expect(g.occupancy[t] !== 0 || tile === Terrain.Water || tile === Terrain.Mountain, `seed ${seed} (${x},${y}) teren ${tile}`).toBe(true);
    }
  }
});

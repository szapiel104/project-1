import { expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { Terrain } from '../src/data/terrain';
import { createGame } from '../src/sim/state';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';

it('palisada przechodzi przez las i skały: drzewo ścięte, kamień rozbity; wody nie przejdzie', () => {
  const g = createGame(5, '1v1', 1, true);
  for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  const pal = buildingIndex('palisade'), house = buildingIndex('house'), W = g.map.width;
  // wolne pole przy twierdzy, na którym zmieniamy teren
  let spot = -1;
  for (let r = 12; r < 24 && spot < 0; r++) for (let d = -r; d <= r && spot < 0; d++) {
    const x = keep.x + d, y = keep.y + r;
    if (canPlace(g, 0, pal, x, y) === null && canPlace(g, 0, pal, x + 1, y) === null && canPlace(g, 0, pal, x + 2, y) === null) spot = y * W + x;
  }
  expect(spot).toBeGreaterThanOrEqual(0);
  const x = spot % W, y = Math.floor(spot / W);
  g.map.tiles[spot] = Terrain.Forest;
  g.map.tiles[spot + 1] = Terrain.Stone;
  g.map.tiles[spot + 2] = Terrain.Water;
  expect(canPlace(g, 0, house, x, y)).not.toBe(null); // zwykły budynek nie stanie w lesie
  const cut = g.cut.length;
  expect(placeBuilding(g, 0, pal, x, y)).toBe(true);
  expect(placeBuilding(g, 0, pal, x + 1, y)).toBe(true);
  expect(g.map.tiles[spot]).toBe(Terrain.Grass);
  expect(g.map.tiles[spot + 1]).toBe(Terrain.Grass);
  expect(g.cut.slice(cut)).toEqual([spot, spot + 1]);
  expect(canPlace(g, 0, pal, x + 2, y)).toBe('place.terrain');
});

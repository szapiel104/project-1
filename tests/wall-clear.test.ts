import { expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { Terrain } from '../src/data/terrain';
import { createGame } from '../src/sim/state';
import { canPlace } from '../src/sim/systems/placement';

it('gracz nie stawia muru w lesie, na skałach ani w wodzie — las trzeba najpierw wyciąć', () => {
  const g = createGame(5, '1v1', 1, true);
  for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  const pal = buildingIndex('palisade'), W = g.map.width;
  let spot = -1;
  for (let r = 12; r < 24 && spot < 0; r++) for (let d = -r; d <= r && spot < 0; d++) {
    const x = keep.x + d, y = keep.y + r;
    if ([0, 1, 2].every((k) => canPlace(g, 0, pal, x + k, y) === null)) spot = y * W + x;
  }
  expect(spot).toBeGreaterThanOrEqual(0);
  const x = spot % W, y = Math.floor(spot / W);
  g.map.tiles[spot] = Terrain.Forest;
  g.map.tiles[spot + 1] = Terrain.Stone;
  g.map.tiles[spot + 2] = Terrain.Water;
  for (let k = 0; k < 3; k++) expect(canPlace(g, 0, pal, x + k, y)).toBe('place.terrain');
});

import { expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { createGame } from '../src/sim/state';

it('tryb deweloperski: mury miasta kamienne, drewniane albo mieszane', () => {
  const kinds = (walls: 'mix' | 'stone' | 'wood'): Set<string> => {
    const g = createGame(6, '1v1', 1, true, undefined, true, walls);
    return new Set(g.buildings.filter((b) => b.owner === 0).map((b) => BUILDINGS[b.type]!.id));
  };
  const stone = kinds('stone'), wood = kinds('wood'), mix = kinds('mix');
  expect(stone.has('stoneWall') && !stone.has('palisade')).toBe(true);
  expect(wood.has('palisade') && !wood.has('stoneWall')).toBe(true);
  expect(mix.has('palisade') && mix.has('stoneWall')).toBe(true);
});

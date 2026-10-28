import { expect, it } from 'vitest';
import { BUILDINGS, buildingIndex, DWELLINGS } from '../src/data/buildings';
import { createGame, housing } from '../src/sim/state';
import { placeBuilding, canPlace } from '../src/sim/systems/placement';
import { canQuarantine } from '../src/sim/systems/plague';
import { henCount, yardAnimal } from '../src/render/yardanimals';

it('rudera i namiot: tańsze od chaty, mniej łóżek, liczą się do mieszkań', () => {
  const house = BUILDINGS[buildingIndex('house')]!, shack = BUILDINGS[buildingIndex('shack')]!, tent = BUILDINGS[buildingIndex('tent')]!;
  expect(shack.housing).toBe(4);
  expect(tent.housing).toBe(2);
  expect(shack.cost.wood!).toBeLessThan(house.cost.wood!);
  expect(tent.cost.wood!).toBeLessThan(shack.cost.wood!);
  for (const id of ['house', 'shack', 'tent']) expect(DWELLINGS.has(id)).toBe(true);

  const g = createGame(3, '1v1', 1, false);
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  const before = housing(g, 0);
  const t = buildingIndex('tent');
  let placed = false;
  for (let r = 8; r < 30 && !placed; r++) for (let d = -r; d <= r && !placed; d++) {
    if (canPlace(g, 0, t, keep.x + d, keep.y + r) === null) placed = placeBuilding(g, 0, t, keep.x + d, keep.y + r);
  }
  expect(placed).toBe(true);
  const b = g.buildings.find((x) => x.type === t)!;
  b.build = 0;
  expect(housing(g, 0)).toBe(before + 2);
  expect(canQuarantine(b)).toBe(true);
});

it('każda chata chowa jeden rodzaj zwierząt (kury albo świnia albo nic), namiot nic', () => {
  const kinds = { hens: 0, pig: 0, none: 0 };
  let animals = 0;
  for (let id = 1; id <= 200; id++) {
    const k = yardAnimal('house', id);
    kinds[k]++;
    animals += k === 'hens' ? henCount(id) : k === 'pig' ? 1 : 0;
    expect(yardAnimal('tent', id)).toBe('none');
    expect(yardAnimal('shack', id)).not.toBe('pig');
  }
  // wszystkie trzy warianty występują, a średnio wychodzi niecałe jedno zwierzę na chatę (wcześniej 2–3 kury plus świnie)
  expect(kinds.hens).toBeGreaterThan(40);
  expect(kinds.pig).toBeGreaterThan(30);
  expect(kinds.none).toBeGreaterThan(30);
  expect(animals / 200).toBeLessThan(1);
});

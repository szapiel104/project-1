import { expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { UNITS } from '../src/data/units';
import { createGame, FP } from '../src/sim/state';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';
import { garrisonRoom, orderGarrison } from '../src/sim/systems/army';
import { step } from '../src/sim/step';

it('kamienna wieża: staje na palisadzie, mieści sześciu łuczników, wchodzą na górę', () => {
  const g = createGame(5, '1v1', 1, true);
  for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  const pal = buildingIndex('palisade'), tower = buildingIndex('stoneTower');
  expect(garrisonRoom('stoneTower')).toBe(6);
  let x = -1, y = -1;
  for (let r = 12; r < 30 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++) {
    const tx = keep.x + d, ty = keep.y + r;
    if ([0, 1, 2, 3].every((k) => canPlace(g, 0, pal, tx + k, ty) === null && g.map.tiles[ty * g.map.width + tx + k] === 0) && [1, 2].every((k) => canPlace(g, 0, pal, tx + k, ty - 1) === null && g.map.tiles[(ty - 1) * g.map.width + tx + k] === 0)) { x = tx; y = ty; }
  }
  expect(x).toBeGreaterThanOrEqual(0);
  for (let k = 0; k < 4; k++) expect(placeBuilding(g, 0, pal, x + k, y)).toBe(true);
  // wieża 2×2 na dwóch przęsłach palisady
  expect(canPlace(g, 0, tower, x + 1, y - 1)).toBe(null);
  expect(placeBuilding(g, 0, tower, x + 1, y - 1)).toBe(true);
  const t = g.buildings.find((b) => b.type === tower)!;
  expect(g.buildings.filter((b) => b.x >= x + 1 && b.x <= x + 2 && (b.y === y || b.y === y - 1)).map((b) => BUILDINGS[b.type]!.id)).toEqual(['stoneTower']);
  t.build = 0; // gotowa
  // ośmiu łuczników obok: sześciu dostaje miejsce na wieży
  const archer = UNITS.findIndex((u) => u.id === 'archer');
  const ids: number[] = [];
  for (let k = 0; k < 8; k++) {
    const id = g.nextId++;
    ids.push(id);
    g.soldiers.push({ id, owner: 0, kind: archer, px: (x + 1 + (k % 4)) * FP + 128, py: (y - 3) * FP + 128, path: [], hp: UNITS[archer]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
  }
  orderGarrison(g, 0, ids, t.id);
  expect(g.soldiers.filter((s) => s.post === t.id).length).toBe(6);
  for (let i = 0; i < 400; i++) step(g, []);
  expect(g.soldiers.filter((s) => s.post === t.id && s.up).length).toBe(6);
});

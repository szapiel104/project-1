import { expect, it } from 'vitest';
import { RESOURCES, resIndex } from '../src/data/resources';
import { UNITS } from '../src/data/units';
import { addPeasants, emptyScene, placeReady } from '../src/sim/emptyscene';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';

it('chłop z kilofem: koszary szkolą go za samą rudę, bez broni ze zbrojowni (2.11.2026)', () => {
  const g = createGame(11, '1v1', 2, false); emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W), p = g.players[0]!;
  for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
  p.res[resIndex('gold')] = 10;
  const bar = placeReady(g, 'barracks', hx + 5, hy + 5)!;
  addPeasants(g, 2);
  step(g, [{ type: 'train', player: 0, building: bar, unit: 'levy' }]);
  expect(p.res[resIndex('gold')]).toBe(5);
  for (let i = 0; i < 1200 && !g.soldiers.some((s) => s.owner === 0 && UNITS[s.kind]!.id === 'levy'); i++) step(g, []);
  expect(g.soldiers.some((s) => s.owner === 0 && UNITS[s.kind]!.id === 'levy')).toBe(true);
});

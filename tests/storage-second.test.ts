import { expect, it } from 'vitest';
import { RESOURCES, resIndex } from '../src/data/resources';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, storeCapacity, storeUsed } from '../src/sim/state';
import { step } from '../src/sim/step';
it('nowy spichlerz: magazynier wnosi do niego stosy spod pełnego (30.10.2026)', () => {
  const g = createGame(11, '1v1', 2, false); emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W), p = g.players[0]!;
  for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
  placeReady(g, 'granary', hx + 4, hy + 4);
  placeReady(g, 'orchard', hx - 4, hy + 6); placeReady(g, 'orchard', hx - 8, hy + 6);
  p.res[resIndex('bread')] = storeCapacity(g, 0, 'granary'); p.rations = 0;
  addPeasants(g, 3); setHour(g, 6);
  const t = () => { p.popularity = 80; step(g, []); };
  for (let i = 0; i < 2500 && (g.piles?.length ?? 0) < 2; i++) t();
  placeReady(g, 'granary', hx + 9, hy + 4);
  for (let i = 0; i < 2000; i++) t();
  expect(g.piles?.length ?? 0).toBe(0);
}, 120000);
it('zapasy startowe mieszczą się w spichlerzu z zapasem miejsca, także na łatwym (30.10.2026)', () => {
  for (const level of [0, 1, 2, 3]) {
    const g = createGame(5, '1v1', level, false);
    for (const p of g.players) expect(storeUsed(p, 'granary')).toBeLessThanOrEqual(storeCapacity(g, p.id, 'granary') * 0.9);
  }
});

import { expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';

it('warsztat liczy, ile oddał do składu (okno budynku pokazuje to i tempo)', () => {
  const g = createGame(7, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width;
  const hx = k.door % W, hy = Math.floor(k.door / W);
  const p = g.players[0]!;
  p.res = p.res.map(() => 0);
  p.res[resIndex('flour')] = 40;
  const id = placeReady(g, 'bakery', hx - 1, hy + 5)!;
  placeReady(g, 'granary', hx + 3, hy + 5);
  placeReady(g, 'stockpile', hx - 4, hy + 5); // mąka leży w składzie
  addPeasants(g, 2);
  setHour(g, 7);
  for (let i = 0; i < 1500; i++) step(g, []);
  const b = g.buildings.find((x) => x.id === id)!;
  expect(b.made ?? 0).toBeGreaterThan(0);
  expect((b.made ?? 0) % 10).toBe(0); // chleb po 10 z jednego cyklu
  expect(b.lost ?? 0).toBe(0);
});

import { expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { addPeasants, emptyScene, placeReady } from '../src/sim/emptyscene';
import { clockAt } from '../src/sim/clock';
import { createGame, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { monthlyForecast } from '../src/sim/systems/economy';

function run(): GameState {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W);
  placeReady(g, 'shrine', hx + 5, hy + 6);
  placeReady(g, 'house', hx - 6, hy + 8);
  placeReady(g, 'house', hx + 9, hy + 12);
  addPeasants(g, 8);
  for (let i = 0; i < 50; i++) step(g, []);
  // dzień święta, tuż przed 16:00
  const feast = RULES.faith.feastEvery;
  while (!(clockAt(g.tick).day === feast && clockAt(g.tick).hour >= 15.9)) g.tick++;
  return g;
}

it('w dzień święta kaznodzieja prowadzi procesję przez osadę, a po niej ludzie wracają do pracy', () => {
  const g = run();
  let seen = 0;
  for (let i = 0; i < 1200; i++) { step(g, []); seen = Math.max(seen, g.processions?.[0]?.members.length ?? 0); }
  expect(seen).toBeGreaterThan(2);
  expect(g.processions?.length ?? 0).toBe(0);
  expect(g.units.some((u) => u.procession)).toBe(false);
  expect(g.players[0]!.processionDay).toBe(RULES.faith.feastEvery);
  const g2 = run();
  for (let i = 0; i < 1200; i++) step(g2, []);
  expect(stateHash(g2)).toBe(stateHash(g));
}, 60000);

it('pogrzeb bez kapliczki psuje nastroje w najbliższym rozliczeniu', () => {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const p = g.players[0]!;
  p.lastFuneral = g.tick;
  expect(monthlyForecast(g, p).parts.find((x) => x.key === 'funeral')?.value).toBe(-1);
  g.tick += RULES.monthTicks + 1;
  expect(monthlyForecast(g, p).parts.find((x) => x.key === 'funeral')?.value).toBe(0);
});

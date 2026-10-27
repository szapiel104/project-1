// Mapa z wątku (mapworker.ts) przechodzi przez structuredClone; po przywróceniu prototypu Rng ma być tą samą grą
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { Rng } from '../src/sim/rng';
import { step } from '../src/sim/step';
import { createGameAsync } from '../src/sim/mapthread';

describe('mapa w osobnym wątku', () => {
  it('stan po przejściu przez wątek gra tak samo jak policzony na miejscu', () => {
    const a = createGame(777, '2v2', 2, false, undefined, true, 'mix');
    const b = structuredClone(createGame(777, '2v2', 2, false, undefined, true, 'mix'));
    Object.setPrototypeOf(b.rng, Rng.prototype);
    for (let i = 0; i < 200; i++) { step(a, []); step(b, []); }
    expect(b.rng.state).toBe(a.rng.state);
    expect(b.units.length).toBe(a.units.length);
    expect(JSON.stringify(b.buildings)).toBe(JSON.stringify(a.buildings));
  });
  it('bez Workera (Node) liczy się w wątku głównym', async () => {
    const g = await createGameAsync(5, '1v1', 2, false, 'mix');
    expect(g.map.width).toBe(createGame(5, '1v1', 2, false, undefined, true, 'mix').map.width);
  });
});

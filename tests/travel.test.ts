import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { serialize, deserialize } from '../src/sim/save';

describe('wędrowcy', () => {
  it('nowi chłopi przychodzą spoza mapy i stają się mieszkańcami', () => {
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    g.units = g.units.filter((u) => u.owner !== 0); // pusta osada: muszą przyjść nowi
    const before = 0;
    let seen = false;
    for (let i = 0; i < 6000; i++) { step(g, []); if (g.travelers.some((t) => !t.leaving)) seen = true; }
    expect(seen).toBe(true);
    expect(g.units.filter((u) => u.owner === 0).length).toBeGreaterThan(before);
    const back = deserialize(serialize(g, '1v1'));
    expect(back?.travelers.length).toBe(g.travelers.length);
  });
});

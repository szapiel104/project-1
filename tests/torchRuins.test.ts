import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { clockAt } from '../src/sim/clock';

describe('pochodnie', () => {
  it('gruz po zburzonym budynku nie ma zapalonej pochodni', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) p.bot = false;
    const b = g.buildings.find((x) => x.owner === 0 && x.door >= 0 && x.type !== 0)!;
    let n = 0;
    while (clockAt(g.tick).hour < 22 && n++ < 20000) step(g, []);
    for (let i = 0; i < 10; i++) step(g, []);
    b.ruined = true;
    for (let i = 0; i < 10; i++) step(g, []);
    expect(b.lit).toBe(false);
  });
});

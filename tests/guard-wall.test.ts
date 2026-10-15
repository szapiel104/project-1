import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { GUARD } from '../src/data/units';
import { WALL_TOP } from '../src/data/keep';

describe('wartownicy na murach', () => {
  it('dwóch strażników wchodzi na boczne mury twierdzy i po nich chodzi', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) p.bot = false;
    const W = g.map.width;
    let seen = 0;
    for (let i = 0; i < 3000; i++) {
      step(g, []);
      const onWall = g.soldiers.filter((s) => s.owner === 0 && s.kind === GUARD && (g.walls[(s.py >> 8) * W + (s.px >> 8)]! & WALL_TOP)).length;
      seen = Math.max(seen, onWall);
    }
    expect(seen).toBe(2);
  });
});

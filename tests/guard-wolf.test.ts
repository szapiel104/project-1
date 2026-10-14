import { describe, expect, it } from 'vitest';
import { UNITS } from '../src/data/units';
import { FP, createGame } from '../src/sim/state';
import { walkable } from '../src/sim/path';
import { step } from '../src/sim/step';
import { clockAt } from '../src/sim/clock';

describe('strażnicy i wilki', () => {
  it('strażnik zauważa wilka w osadzie, rusza na niego i go bije', () => {
    const g = createGame(4, '1v1', 2);
    for (const p of g.players) p.bot = false;
    for (let i = 0; i < 400 && !g.soldiers.some((s) => s.owner === 0 && UNITS[s.kind]!.guard); i++) step(g, []);
    // noc: wilki polują od zmierzchu
    for (let i = 0; i < 8000 && clockAt(g.tick).hour < 20.6; i++) step(g, []);
    const guard = g.soldiers.find((s) => s.owner === 0 && UNITS[s.kind]!.guard)!;
    expect(guard).toBeTruthy();
    const W = g.map.width, gx = guard.px >> 8, gy = guard.py >> 8;
    let spot = -1;
    for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8], [6, 6], [-6, -6]] as const) {
      const t = (gy + dy) * W + gx + dx;
      if (walkable(g, t, 0)) { spot = t; break; }
    }
    expect(spot).toBeGreaterThan(0);
    const wolf = { id: g.nextId++, px: (spot % W) * FP + FP / 2, py: Math.floor(spot / W) * FP + FP / 2, hp: 45, path: [] as number[], target: 0, cd: 0, leaving: false };
    g.wolves.push(wolf);
    // strażnik sam podejmuje pościg (nie czeka, aż wilk go ugryzie)
    let hunted = false;
    for (let i = 0; i < 60; i++) { step(g, []); if (guard.hunt === wolf.id) { hunted = true; break; } }
    expect(hunted).toBe(true);
    for (let i = 0; i < 400 && g.wolves.includes(wolf); i++) step(g, []);
    expect(wolf.hp).toBeLessThan(45);
  });
});

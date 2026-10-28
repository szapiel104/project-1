import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { FP, createGame, playerKeep, keepFront, type Soldier } from '../src/sim/state';
import { walkable } from '../src/sim/path';
import { step } from '../src/sim/step';
import { clearBandits } from '../src/sim/systems/bandits';

describe('łucznicy i wilki', () => {
  it('łucznik strzela do wilka w zasięgu: widać strzał (shot), wilk dostaje dopiero, gdy strzała doleci', () => {
    const g = clearBandits(createGame(7));
    for (const p of g.players) p.bot = false;
    const W = g.map.width;
    const [kx, ky] = keepFront(playerKeep(g, 0)!);
    let ax = kx, ay = ky + 2;
    for (let r = 2; r < 10 && !walkable(g, ay * W + ax, 0); r++) ay = ky + r;
    const s: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: ax * FP + 128, py: ay * FP + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    g.soldiers.push(s);
    let wx = ax + 4;
    for (let d = 4; d > 1 && !walkable(g, ay * W + wx, 0); d--) wx = ax + d - 1;
    const wolf = { id: g.nextId++, px: wx * FP + 128, py: ay * FP + 128, hp: 45, path: [] as number[], target: 0, cd: 0, leaving: false };
    g.wolves.push(wolf);
    let shotAt = -1;
    for (let i = 0; i < 60 && shotAt < 0; i++) { step(g, []); if (g.missiles?.some((m) => m.wolf && m.to === wolf.id)) shotAt = g.tick; }
    expect(shotAt).toBeGreaterThan(0);
    expect(s.shot).toBe(shotAt);
    expect(s.hitWolf).toBe(wolf.id);
    const hp = wolf.hp;
    for (let i = 0; i < 8; i++) step(g, []);
    expect(wolf.hp).toBeLessThan(hp);
  });
});

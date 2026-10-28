import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { createGame, FP, playerKeep, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { clearBandits } from '../src/sim/systems/bandits';

/** Wolne pole w odległości około `r` od twierdzy gracza `owner` */
function freeNear(g: GameState, owner: number, r: number): number {
  const k = playerKeep(g, owner)!, W = g.map.width;
  for (let d = r; d < r + 30; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    const x = k.x + dx, y = k.y + dy, t = y * W + x;
    if (x > 0 && y > 0 && x < W - 1 && y < g.map.height - 1 && !g.occupancy[t] && walkable(g, t, owner)) return t;
  }
  throw new Error('brak pola');
}

describe('rozkaz ruchu po rozkazie „bij tego chłopa”', () => {
  it('łucznicy zapominają chłopa i stoją tam, gdzie ich wysłano (nie wracają pod jego zamek)', () => {
    const g = clearBandits(createGame(7));
    for (const p of g.players) { p.bot = false; p.guards = 0; }
    g.soldiers = [];
    const W = g.map.width;
    // wrogi chłop przy swojej twierdzy, nasi łucznicy obok
    const victim = g.units.find((u) => u.owner === 1)!;
    const near = freeNear(g, 1, 6);
    const archers: Soldier[] = [];
    for (let i = 0; i < 3; i++) {
      const s: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: (near % W) * FP + FP / 2, py: Math.floor(near / W) * FP + FP / 2, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 };
      g.soldiers.push(s); archers.push(s);
    }
    const ids = archers.map((s) => s.id);
    step(g, [{ type: 'attack', player: 0, ids, target: victim.id }]);
    expect(archers.every((s) => s.prey === victim.id)).toBe(true);
    // ucieczka na drugi koniec mapy: pod własną twierdzę
    const away = freeNear(g, 0, 4);
    step(g, [{ type: 'move', player: 0, ids, x: away % W, y: Math.floor(away / W) }]);
    expect(archers.every((s) => !s.prey)).toBe(true);
    for (let i = 0; i < 2500; i++) step(g, []);
    const ax = away % W, ay = Math.floor(away / W);
    for (const s of archers) {
      const d = Math.max(Math.abs((s.px >> 8) - ax), Math.abs((s.py >> 8) - ay));
      expect(d).toBeLessThan(6);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { decaySystem } from '../src/sim/systems/decay';
import { demolish, ruin } from '../src/sim/systems/placement';
import { walkable } from '../src/sim/path';
import { placeReady } from '../src/sim/emptyscene';
import { createGame, playerKeep, type Building, type GameState } from '../src/sim/state';

function run(g: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) { g.tick++; decaySystem(g); }
}

/** Chata gracza 0 na wolnym miejscu kilkanaście pól od twierdzy */
function house(g: GameState): Building {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = 12; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = keep.x + dx, y0 = keep.y + dy;
    let ok = x0 > 1 && y0 > 1 && x0 + 4 < W - 1 && y0 + 4 < g.map.height - 1;
    for (let y = y0; ok && y < y0 + 4; y++) for (let x = x0; ok && x < x0 + 4; x++) if (!walkable(g, y * W + x, 0) || g.occupancy[y * W + x]) ok = false;
    if (!ok) continue;
    const id = placeReady(g, 'house', x0, y0, 0, 0);
    if (id) return g.buildings.find((b) => b.id === id)!;
  }
  throw new Error('brak miejsca');
}

describe('rozpad porzuconych ruin i gruzu', () => {
  it('ruina bez pracy przez 5 minut znika bez gruzu, a działka jest wolna', () => {
    const g = createGame(7);
    const b = house(g);
    ruin(g, b);
    g.units = []; g.soldiers = [];
    run(g, RULES.decayTicks - 10);
    expect(g.buildings.includes(b)).toBe(true);
    run(g, 20);
    expect(g.buildings.includes(b)).toBe(false);
    expect(g.rubble.some((r) => r.x === b.x && r.y === b.y)).toBe(false);
    expect(g.occupancy[b.y * g.map.width + b.x]).toBe(0);
  });

  it('gruz, którego nikt nie wynosi, znika po 5 minutach i zwalnia pola', () => {
    const g = createGame(7);
    const b = house(g);
    demolish(g, b.owner, b.id);
    g.units = [];
    const r = g.rubble[g.rubble.length - 1]!;
    const t = r.y * g.map.width + r.x;
    expect(g.reserved[t]).toBeGreaterThan(0);
    run(g, RULES.decayTicks + 10);
    expect(g.rubble.includes(r)).toBe(false);
    expect(g.reserved[t]).toBe(0);
  });
});

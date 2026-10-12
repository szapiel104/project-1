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

describe('budowa', () => {
  it('nowy budynek najpierw stoi w budowie, robotnicy go kończą', async () => {
    const { placeBuilding } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let placed = false;
    for (let r = 4; r < 14 && !placed; r++) for (let d = -r; d <= r && !placed; d++) placed = placeBuilding(g, 0, buildingIndex('house'), keep.x + d, keep.y + r);
    const b = g.buildings[g.buildings.length - 1]!;
    expect(b.build).toBeGreaterThan(0);
    for (let i = 0; i < 2000 && b.build; i++) step(g, []);
    expect(b.build).toBe(0);
  });
});

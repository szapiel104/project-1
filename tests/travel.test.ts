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

describe('palisada i brama', () => {
  it('brama przepuszcza swoich, a obcych nie; palisada nie potrzebuje wejścia', async () => {
    const { placeBuilding } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { walkable } = await import('../src/sim/path');
    const g = createGame(5, '1v1', 2);
    const keep = g.buildings[0]!;
    let x = 0, y = 0;
    const { canPlace: cp } = await import('../src/sim/systems/placement');
    for (let r = 4; r < 15 && !x; r++) for (let d = -r; d <= r && !x; d++) if (cp(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r) === null && cp(g, 0, buildingIndex('gate'), keep.x + d, keep.y + r + 1) === null) { x = keep.x + d; y = keep.y + r; }
    const { canPlace } = await import('../src/sim/systems/placement');
    expect(canPlace(g, 0, buildingIndex('palisade'), x, y)).toBe(null);
    expect(placeBuilding(g, 0, buildingIndex('palisade'), x, y)).toBe(true);
    expect(canPlace(g, 0, buildingIndex('gate'), x, y + 1)).toBe(null);
    expect(placeBuilding(g, 0, buildingIndex('gate'), x, y + 1)).toBe(true);
    const w = g.map.width;
    expect(walkable(g, y * w + x, 0)).toBe(false);
    expect(walkable(g, (y + 1) * w + x, 0)).toBe(true);
    expect(walkable(g, (y + 1) * w + x, 1)).toBe(false);
    const back = deserialize(serialize(g, '1v1'))!;
    expect(walkable(back, (y + 1) * w + x, 0)).toBe(true);
  });
});

describe('wilki', () => {
  it('nocą przychodzi wataha, o świcie znika; gra pokojowa jest bez wilków', () => {
    const g = createGame(9, '1v1', 2);
    for (const p of g.players) p.bot = false;
    let most = 0;
    for (let i = 0; i < 2400 * 4; i++) { step(g, []); most = Math.max(most, g.wolves.length); }
    expect(most).toBeGreaterThan(1);
    expect(g.wolves.length).toBe(0); // po świcie
    const calm = createGame(9, '1v1', 0);
    for (const p of calm.players) p.bot = false;
    for (let i = 0; i < 2400 * 4; i++) step(calm, []);
    expect(calm.wolves.length + calm.players[0]!.stats.lost).toBe(0);
  });
});

describe('budowa palisady', () => {
  it('robotnicy stawiają też umocnienia bez wejścia', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let b = null as null | (typeof g.buildings)[number];
    for (let r = 4; r < 15 && !b; r++) for (let d = -r; d <= r && !b; d++) if (canPlace(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r) === null) { placeBuilding(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r); b = g.buildings[g.buildings.length - 1]!; }
    for (let i = 0; i < 1500 && b!.build; i++) step(g, []);
    expect(b!.build).toBe(0);
  });
});

describe('tryb deweloperski', () => {
  it('stawia budynki od razu gotowe i daje zapasy', () => {
    const g = createGame(5, '1v1', 1, true);
    expect(g.buildings.filter((b) => b.owner === 0).length).toBeGreaterThan(8);
    expect(g.buildings.every((b) => !b.build)).toBe(true);
    expect(g.players[0]!.dev).toBe(true);
  });
});

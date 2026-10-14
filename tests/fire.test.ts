import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { createGame } from '../src/sim/state';
import { canPlace } from '../src/sim/systems/placement';
import { step } from '../src/sim/step';
import { maxHp } from '../src/sim/systems/placement';

describe('pożary', () => {
  it('ludzie gaszą płonący budynek wodą ze studni', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    // studnia blisko twierdzy
    let placed = false;
    for (let r = 4; r < 20 && !placed; r++) for (let dx = -r; dx <= r && !placed; dx++) {
      const x = keep.x + dx, y = keep.y + r;
      if (canPlace(g, 0, buildingIndex('well'), x, y, false) === null) { step(g, [{ type: 'build', player: 0, building: 'well', x, y }]); placed = true; }
    }
    expect(placed).toBe(true);
    for (let i = 0; i < 20; i++) step(g, []);
    const house = g.buildings.find((b) => b.owner === 0 && b.type === buildingIndex('house') && !b.build)!;
    const max = maxHp(house.type);
    step(g, []);
    house.hp = Math.floor(max * 0.5); // świeży cios: zajmuje się ogniem
    step(g, []);
    expect(house.fire ?? 0).toBeGreaterThan(0);
    let crew = 0;
    for (let i = 0; i < 40; i++) { step(g, []); crew = Math.max(crew, g.units.filter((u) => u.bucket && u.fireAt === house.id).length); }
    expect(crew).toBeGreaterThan(0);
    let t = 0;
    for (; t < 500 && (house.fire ?? 0) > 0; t++) step(g, []);
    // ugaszony wyraźnie szybciej niż sam by się wypalił (600 ticków)
    expect(house.fire ?? 0).toBe(0);
    expect(t).toBeLessThan(500);
    step(g, []);
    expect(g.units.some((u) => u.bucket)).toBe(false); // po ugaszeniu wracają do swoich zajęć
  });
});

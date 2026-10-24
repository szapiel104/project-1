import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { createGame, playerKeep, population } from '../src/sim/state';
import { step } from '../src/sim/step';
import { buildCost, canPlace, missingRequirement, tierFor } from '../src/sim/systems/placement';
import { spawnPeasant } from '../src/sim/systems/population';

const game = () => { const g = createGame(5); for (const p of g.players) p.bot = false; const p = g.players[0]!; p.res[resIndex('wood')] = 2000; p.res[resIndex('stone')] = 2000; p.res[resIndex('gold')] = 2000; return g; };
function place(g: ReturnType<typeof game>, id: string): boolean {
  const k = playerKeep(g, 0)!, type = buildingIndex(id);
  for (let r = 7; r < 26; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (canPlace(g, 0, type, k.x + dx, k.y + dy, false) === null) { step(g, [{ type: 'build', player: 0, building: id, x: k.x + dx, y: k.y + dy }]); return true; }
  return false;
}

describe('tempo gry', () => {
  it('etapy osady: późne budynki czekają na większą osadę, a etap już nie spada', () => {
    const g = game();
    expect(tierFor(0)).toBe(0); expect(tierFor(RULES.tiers[1]!)).toBe(1); expect(tierFor(RULES.tiers[3]!)).toBe(3);
    expect(missingRequirement(g, 0, BUILDINGS[buildingIndex('smithy')]!)?.tier).toBe(2);
    expect(missingRequirement(g, 0, BUILDINGS[buildingIndex('house')]!)).toBeNull();
    expect(place(g, 'smithy')).toBe(false);
    while (population(g, 0) < RULES.tiers[2]!) spawnPeasant(g, 0);
    for (let i = 0; i < 200; i++) step(g, []);
    expect(g.players[0]!.tier).toBe(2);
    expect(place(g, 'smithy')).toBe(true);
    g.units = g.units.filter((u) => u.owner !== 0).concat(g.units.filter((u) => u.owner === 0).slice(0, 5));
    for (let i = 0; i < 200; i++) step(g, []);
    expect(g.players[0]!.tier).toBe(2);
  });

  it('każdy następny taki sam budynek drożeje, linie i drogi nie', () => {
    const g = game();
    const H = buildingIndex('house'), base = BUILDINGS[H]!.cost.wood!;
    expect(buildCost(g, 0, H).wood).toBe(base);
    const w0 = g.players[0]!.res[resIndex('wood')]!;
    expect(place(g, 'house')).toBe(true);
    expect(g.players[0]!.res[resIndex('wood')]).toBe(w0 - base);
    expect(buildCost(g, 0, H).wood).toBe(Math.ceil(base * 1.1));
    for (let i = 0; i < 12; i++) place(g, 'house');
    expect(buildCost(g, 0, H).wood).toBe(Math.ceil((base * (100 + RULES.costStepMax)) / 100));
    expect(buildCost(g, 0, buildingIndex('palisade'))).toEqual(BUILDINGS[buildingIndex('palisade')]!.cost);
  });
});

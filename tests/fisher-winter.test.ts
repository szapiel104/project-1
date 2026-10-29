import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { createGame } from '../src/sim/state';
import { shiftToSeason } from '../src/sim/weather';
import { FISH_WINTER, siteTicks } from '../src/sim/systems/workers';

describe('rybak zimą', () => {
  it('zimą łowi dwa razy dłużej (lód przy brzegu), drwal bez zmian', () => {
    const g = createGame(3);
    const fisher = BUILDINGS.find((b) => b.id === 'fisher')!.production!;
    const wood = BUILDINGS.find((b) => b.id === 'woodcutter')!.production!;
    g.seasonShift = shiftToSeason(g.tick, 'summer');
    expect(siteTicks(g, fisher)).toBe(fisher.workTicks);
    g.seasonShift = shiftToSeason(g.tick, 'winter');
    expect(siteTicks(g, fisher)).toBe(fisher.workTicks * FISH_WINTER);
    expect(siteTicks(g, wood)).toBe(wood.workTicks);
  });
});

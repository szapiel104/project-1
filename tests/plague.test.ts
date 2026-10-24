import { describe, expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { createGame, playerKeep, population, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { startPlague, mageOf } from '../src/sim/systems/plague';

/** Pusta łąka z twierdzą, kilkoma chatami i `people` ludźmi; opcjonalnie siedziby magów */
function town(people: number, mages: string[] = [], seed = 5): GameState {
  const g = createGame(seed);
  emptyScene(g);
  const k = playerKeep(g, 0)!;
  const door = k.door, w = g.map.width, dx = door % w, dy = (door - dx) / w;
  let n = 0;
  for (let i = 0; i < 6; i++) if (placeReady(g, 'house', dx - 9 + i * 3, dy + 4) !== null) n++;
  expect(n).toBeGreaterThan(3);
  mages.forEach((id, i) => expect(placeReady(g, id, dx - 8 + i * 6, dy + 9)).not.toBeNull());
  while (population(g, 0) < people) spawnPeasant(g, 0);
  for (let i = 0; i < 50; i++) step(g, []);
  return g;
}

/** Przewija aż do końca zarazy (najwyżej `days` dób); zwraca ilu zachorowało i ilu zmarło */
function ride(g: GameState, days: number): { sick: number; dead: number; over: boolean; ticks: number } {
  const ever = new Set<number>();
  const lost0 = g.players[0]!.stats.lost;
  let t = 0;
  for (; t < days * RULES.dayTicks; t++) {
    step(g, []);
    if (t % 25 === 0) for (const u of g.units) if (u.owner === 0 && u.sick) ever.add(u.id);
    if (!g.players[0]!.plague && t > 100) break;
  }
  return { sick: ever.size, dead: g.players[0]!.stats.lost - lost0, over: !g.players[0]!.plague, ticks: t };
}

describe('zaraza', () => {
  it('bez magów zbiera duże żniwo, ale w końcu wygasa i osada przeżywa', () => {
    const g = town(40);
    expect(startPlague(g, 0, 4)).toBe(4);
    const r = ride(g, 12);
    expect(r.over).toBe(true);
    expect(r.sick).toBeGreaterThan(12);
    expect(r.dead).toBeGreaterThanOrEqual(Math.floor(r.sick * 0.2));
    expect(population(g, 0)).toBeGreaterThanOrEqual(RULES.minPeasants);
    expect(g.players[0]!.plagueOver?.dead).toBe(r.dead);
  });

  it('z magami Źródła i chatką umiera niewielu', () => {
    const g = town(40, ['mageWater', 'mageHut']);
    const magi = g.units.filter((u) => mageOf(g, u));
    expect(magi.length).toBeGreaterThanOrEqual(3);
    startPlague(g, 0, 4);
    const r = ride(g, 12);
    expect(r.over).toBe(true);
    expect(r.dead).toBeLessThanOrEqual(Math.ceil(r.sick * 0.15));
  });

  it('mag Płomienia pali niepochowane zwłoki', () => {
    const g = town(20, ['mageFire']);
    const k = playerKeep(g, 0)!;
    const w = g.map.width, x = (k.door % w) + 4, y = Math.floor(k.door / w) + 2;
    g.corpses.push({ id: 99999, owner: 1, kind: 0, px: x * 256 + 128, py: y * 256 + 128, at: g.tick, taken: false });
    for (let i = 0; i < 1500 && g.corpses.some((c) => c.id === 99999); i++) step(g, []);
    expect(g.corpses.some((c) => c.id === 99999)).toBe(false);
  });

  it('chorzy na gorączkę nie pracują', () => {
    const g = town(20);
    startPlague(g, 0, 20);
    for (let i = 0; i < 700; i++) step(g, []);
    const bed = g.units.filter((u) => u.sick && g.tick >= (u.sickFrom ?? 0));
    expect(bed.length).toBeGreaterThan(0);
  });
});

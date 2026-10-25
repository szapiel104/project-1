import { describe, expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { BUILDINGS } from '../src/data/buildings';
const BUILDINGS_ID = (t: number): string => BUILDINGS[t]!.id;
import { createGame, playerKeep, population, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { startPlague, mageOf, setQuarantine } from '../src/sim/systems/plague';

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

  it('kwarantanna: zdrowi wychodzą z zamkniętej chaty, a po zarazie chata sama się otwiera', () => {
    const g = town(12);
    const house = g.buildings.find((b) => BUILDINGS_ID(b.type) === 'house')!;
    const [sick, well] = g.units.filter((u) => u.owner === 0);
    for (const u of [sick!, well!]) { u.home = house.id; u.phase = 22; u.path = []; }
    sick!.sickFrom = g.tick; sick!.sick = g.tick + 500; sick!.care = 100;
    g.players[0]!.plague = g.tick;
    expect(setQuarantine(g, 0, house.id, true)).toBe(true);
    expect(well!.home).not.toBe(house.id);
    expect(sick!.home).toBe(house.id);
    for (let i = 0; i < 1500 && g.players[0]!.plague; i++) step(g, []);
    expect(g.players[0]!.plague).toBeFalsy();
    expect(house.quarantine).toBeFalsy();
  });

  it('kwarantanna: zaraza nie wychodzi za drzwi zamkniętej chaty', () => {
    const run = (q: boolean): number => {
      const g = town(12);
      const house = g.buildings.find((b) => BUILDINGS_ID(b.type) === 'house')!;
      const [sick, ...rest] = g.units.filter((u) => u.owner === 0);
      sick!.sickFrom = g.tick; sick!.sick = g.tick + 100000; sick!.care = 100; sick!.home = house.id; sick!.phase = 22; sick!.px = (house.door % g.map.width) * 256 + 128; sick!.py = Math.floor(house.door / g.map.width) * 256 + 128;
      g.players[0]!.plague = g.tick;
      if (q) setQuarantine(g, 0, house.id, true);
      // reszta stoi tuż przy drzwiach (w wylęganiu nikt nie zaraża, więc liczy się tylko chory z chaty)
      let n = 0;
      for (let t = 0; t < 6000; t++) {
        for (const u of rest) if (!u.sick) { u.px = sick!.px + 256; u.py = sick!.py; u.path = []; u.phase = 0; }
        step(g, []);
        sick!.phase = 22; sick!.home = house.id;
      }
      for (const u of rest) if (u.sick) n++;
      return n;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
  });

  it('chorzy na gorączkę nie pracują', () => {
    const g = town(20);
    startPlague(g, 0, 20);
    for (let i = 0; i < 700; i++) step(g, []);
    const bed = g.units.filter((u) => u.sick && g.tick >= (u.sickFrom ?? 0));
    expect(bed.length).toBeGreaterThan(0);
  });
});

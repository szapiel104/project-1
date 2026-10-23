import { describe, expect, it } from 'vitest';
import { resIndex, RESOURCES, RESOURCE_DEFS } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { createGame, Phase, playerKeep, population, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { spawnPeasant } from '../src/sim/systems/population';
import { deserialize, serialize } from '../src/sim/save';

const run = (g: GameState, ticks: number): void => { for (let i = 0; i < ticks; i++) step(g, []); };

/** Gra bez botów, z większą osadą i bez jedzenia w spichlerzu */
function hungryGame(seed = 11, people = 20): GameState {
  const g = createGame(seed);
  for (const p of g.players) p.bot = false;
  const p = g.players[0]!;
  while (population(g, 0) < people) spawnPeasant(g, 0);
  RESOURCES.forEach((id, i) => { if (RESOURCE_DEFS[id].food) p.res[i] = 0; });
  return g;
}
const rioters = (g: GameState): number => g.units.filter((u) => u.owner === 0 && u.riot).length;
/** Do pełnych spichlerzy: zmieści się nawet przy dużych racjach */
const feed = (g: GameState): void => { g.players[0]!.res[resIndex('bread')] = 5000; };

describe('bunt głodowy', () => {
  it('po kilku pustych posiłkach część ludzi rzuca robotę i staje pod bramą', () => {
    const g = hungryGame();
    run(g, RULES.monthTicks * (RULES.revoltMeals - 1));
    expect(g.players[0]!.revolt).toBeFalsy();
    run(g, RULES.monthTicks * 4);
    const p = g.players[0]!;
    expect(p.revolt).toBe(true);
    expect(rioters(g)).toBeGreaterThan(0);
    for (const u of g.units) if (u.riot) expect(u.phase).toBe(Phase.Riot);
    // po chwili tłum stoi blisko bramy twierdzy
    run(g, 400);
    const door = playerKeep(g, 0)!.door, w = g.map.width;
    const dx = door % w, dy = (door - dx) / w;
    const near = g.units.filter((u) => u.riot && Math.max(Math.abs((u.px >> 8) - dx), Math.abs((u.py >> 8) - dy)) <= 3);
    expect(near.length).toBeGreaterThan(0);
    // bunt odbija się na popularności
    expect(p.popDelta).toBeLessThanOrEqual(RULES.revoltPenalty);
  });

  it('buntownicy zostają w osadzie, choć reszta głodnych odchodzi', () => {
    const g = hungryGame(12, 24);
    run(g, RULES.monthTicks * (RULES.revoltMeals + 2));
    const ids = g.units.filter((u) => u.riot).map((u) => u.id);
    expect(ids.length).toBeGreaterThan(0);
    run(g, RULES.monthTicks * 6);
    const left = new Set(g.units.map((u) => u.id));
    for (const id of ids) expect(left.has(id)).toBe(true);
  });

  it('straż miejska ogranicza bunt do mniejszej części ludzi', () => {
    const a = hungryGame(13, 24), b = hungryGame(13, 24);
    a.players[0]!.guards = 0; b.players[0]!.guards = 6;
    run(a, RULES.monthTicks * RULES.revoltMeals + 20);
    run(b, RULES.monthTicks * RULES.revoltMeals + 20);
    expect(a.players[0]!.revolt).toBe(true);
    expect(b.players[0]!.revolt).toBe(true);
    expect(rioters(b)).toBeLessThan(rioters(a));
  });

  it('gdy ludzie się najedzą, tłum się rozchodzi i wraca do roboty', () => {
    const g = hungryGame(14);
    run(g, RULES.monthTicks * (RULES.revoltMeals + 1));
    expect(g.players[0]!.revolt).toBe(true);
    feed(g);
    run(g, RULES.monthTicks * (RULES.revoltMeals + 3));
    expect(g.players[0]!.revolt).toBeFalsy();
    expect(rioters(g)).toBe(0);
    expect(g.units.some((u) => u.phase === Phase.Riot)).toBe(false);
  });

  it('większe racje gaszą bunt szybciej niż zwykłe', () => {
    const slow = hungryGame(15), fast = hungryGame(15);
    for (const g of [slow, fast]) { run(g, RULES.monthTicks * 12); feed(g); g.players[0]!.guards = 0; }
    slow.players[0]!.rations = 2; fast.players[0]!.rations = 4;
    const until = (g: GameState): number => { let n = 0; while (g.players[0]!.revolt && n < 20000) { step(g, []); n++; } return n; };
    expect(until(fast)).toBeLessThan(until(slow));
  });

  it('bunt przeżywa zapis i wczytanie gry', () => {
    const g = hungryGame(16);
    run(g, RULES.monthTicks * (RULES.revoltMeals + 1));
    const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(stateHash(back)).toBe(stateHash(g));
    expect(back.players[0]!.revolt).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { resIndex, RESOURCES, RESOURCE_DEFS } from '../src/data/resources';
import { BUILDINGS } from '../src/data/buildings';
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

describe('bunt — rozdaj chleb i rozpędzenie przez straż', () => {
  const riot = (seed: number): GameState => {
    const g = hungryGame(seed, 24);
    run(g, RULES.monthTicks * RULES.revoltMeals + 20);
    expect(g.players[0]!.revolt).toBe(true);
    return g;
  };

  it('„Rozdaj chleb” od razu rozpędza tłum, bierze chleb pierwszy i podnosi popularność', () => {
    const g = riot(21);
    const p = g.players[0]!, n = rioters(g), BREAD = resIndex('bread'), APPLES = resIndex('apples');
    p.res[BREAD] = 1000; p.res[APPLES] = 50;
    const pop = p.popularity;
    step(g, [{ type: 'dole', player: 0 }]);
    expect(p.revolt).toBeFalsy();
    expect(rioters(g)).toBe(0);
    expect(p.famine ?? 0).toBe(0);
    expect(p.res[BREAD]).toBe(1000 - (n * RULES.dolePortions) / 2);
    expect(p.res[APPLES]).toBe(50);
    expect(p.popularity).toBeGreaterThan(pop);
  });

  it('bez jedzenia na wszystkich „Rozdaj chleb” nic nie robi', () => {
    const g = riot(22);
    const p = g.players[0]!;
    p.res[resIndex('apples')] = 1;
    step(g, [{ type: 'dole', player: 0 }]);
    expect(p.revolt).toBe(true);
    expect(p.res[resIndex('apples')]).toBe(1);
  });

  it('straż rozpędza tłum siłą: popularność spada od razu, a pod bramą robi się pusto', () => {
    const g = riot(23);
    const p = g.players[0]!;
    expect(g.soldiers.some((s) => s.owner === 0 && s.hp > 0)).toBe(true);
    const pop = p.popularity;
    step(g, [{ type: 'quell', player: 0 }]);
    expect(p.quell).toBe(true);
    expect(p.popularity).toBe(Math.max(0, pop + RULES.quellPenalty));
    for (let i = 0; i < 3000 && p.revolt; i++) step(g, []);
    expect(p.revolt).toBeFalsy();
    expect(p.quell).toBeFalsy();
    expect(rioters(g)).toBe(0);
    // głód nie minął: zostaje tuż pod progiem buntu
    expect(p.famine ?? 0).toBeLessThan(RULES.revoltMeals);
  });

  it('rozkazy w zapisie i hashu stanu', () => {
    const g = riot(24);
    step(g, [{ type: 'quell', player: 0 }]);
    const h = stateHash(g);
    const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(back.players[0]!.quell).toBe(true);
    expect(stateHash(back)).toBe(h);
  });
});

describe('długi bunt — napady tłumu', () => {
  const riot = (seed: number): GameState => {
    const g = hungryGame(seed, 24);
    run(g, RULES.monthTicks * RULES.revoltMeals + 20);
    expect(g.players[0]!.revolt).toBe(true);
    return g;
  };
  const kindOf = (g: GameState, id: number): string => BUILDINGS[g.buildings.find((b) => b.id === id)!.type]!.id;

  it('najpierw rozkradają skład, potem podpalają spichlerz', () => {
    const g = riot(31);
    const p = g.players[0]!, WOOD = resIndex('wood');
    p.res[WOOD] = 100;
    for (let i = 0; i < RULES.riotRaidAfter + 1500 && !p.lastRaid; i++) step(g, []);
    expect(p.lastRaid?.kind).toBe(1);
    expect(['stockpile', 'barn']).toContain(kindOf(g, p.lastRaid!.building));
    expect(p.res[WOOD]).toBe(100 - Math.floor(100 * RULES.riotLoot));
    const first = p.lastRaid!.tick;
    for (let i = 0; i < RULES.riotRaidEvery + 1500 && p.lastRaid!.tick === first; i++) step(g, []);
    expect(p.lastRaid?.kind).toBe(2);
    const granary = g.buildings.find((b) => b.id === p.lastRaid!.building)!;
    expect(BUILDINGS[granary.type]!.id).toMatch(/^granary/);
    expect(granary.fire ?? 0).toBeGreaterThan(0);
  });

  it('przed czasem nie ma napadu, a po „Rozdaj chleb” licznik napadów znika', () => {
    const g = riot(32);
    const p = g.players[0]!;
    run(g, RULES.riotRaidAfter - 100);
    expect(p.lastRaid).toBeUndefined();
    p.res[resIndex('bread')] = 1000;
    step(g, [{ type: 'dole', player: 0 }]);
    expect(p.raidAt).toBeUndefined();
    expect(g.units.some((u) => u.raid)).toBe(false);
  });

  it('rozpędzeni przez straż uciekają w popłochu', () => {
    const g = riot(33);
    step(g, [{ type: 'quell', player: 0 }]);
    let fled = false;
    for (let i = 0; i < 3000 && !fled; i++) { step(g, []); fled = g.units.some((u) => u.owner === 0 && !u.riot && (u.fled ?? 0) > g.tick); }
    expect(fled).toBe(true);
  });
});

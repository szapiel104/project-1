import { describe, expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { createGame, FP, playerKeep, stateHash } from '../src/sim/state';
import { deserialize, serialize } from '../src/sim/save';
import { step } from '../src/sim/step';
import { UNITS } from '../src/data/units';

/** 2 na 2: gracze 0 i 2 w jednej drużynie, 1 i 3 w drugiej (wszyscy bez botów, żeby nic nie ruszało się samo) */
function game(): ReturnType<typeof createGame> {
  const g = createGame(7, '2v2', 2, false, [0, 1, 2, 3]);
  for (const p of g.players) p.bot = false;
  return g;
}

describe('wóz z surowcami dla sojusznika', () => {
  it('odejmuje towar nadawcy od razu i dowozi go sojusznikowi', () => {
    const g = game();
    const wood = resIndex('wood');
    const a = g.players[0]!, b = g.players[2]!;
    expect(a.team).toBe(b.team);
    const a0 = a.res[wood]!, b0 = b.res[wood]!;
    step(g, [{ type: 'send', player: 0, to: 2, res: wood, amount: 30 }]);
    expect(a.res[wood]).toBe(a0 - 30);
    expect(g.caravans?.length).toBe(1);
    for (let i = 0; i < 6000 && g.caravans!.length; i++) step(g, []);
    expect(g.caravans!.length).toBe(0);
    expect(b.res[wood]).toBe(b0 + 30);
    expect(g.caravanLog?.at(-1)?.captured).toBe(false);
  });

  it('nie wysyła wrogowi, więcej niż ma ani ponad limit wozów', () => {
    const g = game();
    const gold = resIndex('gold');
    step(g, [{ type: 'send', player: 0, to: 1, res: gold, amount: 10 }]);
    expect(g.caravans?.length ?? 0).toBe(0);
    const have = g.players[0]!.res[gold]!;
    step(g, [{ type: 'send', player: 0, to: 2, res: gold, amount: have + 500 }]);
    expect(g.players[0]!.res[gold]).toBe(Math.max(0, have - 100));
  });

  it('żołnierz wroga przechwytuje wóz i towar trafia do jego pana', () => {
    const g = game();
    const wood = resIndex('wood');
    step(g, [{ type: 'send', player: 0, to: 2, res: wood, amount: 20 }]);
    for (let i = 0; i < 40; i++) step(g, []);
    const c = g.caravans![0]!;
    const before = g.players[1]!.res[wood]!;
    // wrogi włócznik staje przy wozie
    const keep = playerKeep(g, 1)!;
    g.soldiers.push({ id: g.nextId++, owner: 1, kind: UNITS.findIndex((u) => !u.range && !u.guard && !u.ram), px: c.px, py: c.py + FP / 2, path: [], hp: 100, goal: -1, wait: 0, target: 0 } as unknown as (typeof g.soldiers)[number]);
    void keep;
    for (let i = 0; i < 10; i++) step(g, []);
    expect(g.caravans!.length).toBe(0);
    expect(g.players[1]!.res[wood]).toBeGreaterThan(before);
    expect(g.caravanLog?.at(-1)?.captured).toBe(true);
  });

  it('zapis i odczyt zachowuje wóz w drodze (ten sam skrót stanu)', () => {
    const g = game();
    step(g, [{ type: 'send', player: 0, to: 2, res: resIndex('wood'), amount: 5 }]);
    expect(g.caravans?.length).toBe(1);
    const s = serialize(g, '2v2');
    const h = deserialize(JSON.parse(JSON.stringify(s)))!;
    expect(stateHash(h)).toBe(stateHash(g));
  });
});

describe('kooperacja przeciw botom', () => {
  it('boty drużyny przeciwnej są wzmocnione, sojusznicy-ludzie nie', () => {
    const g = createGame(7, '2v2', 2, false, [0, 2], true, 'mix', true);
    const wood = resIndex('wood');
    const normal = createGame(7, '2v2', 2, false, [0, 2]);
    expect(g.players[0]!.boost).toBeUndefined();
    expect(g.players[2]!.boost).toBeUndefined();
    expect(g.players[1]!.boost).toBe(1.75);
    expect(g.players[3]!.boost).toBe(1.75);
    expect(g.players[1]!.res[wood]).toBeGreaterThan(normal.players[1]!.res[wood]!);
    expect(g.units.filter((u) => u.owner === 1).length).toBeGreaterThan(normal.units.filter((u) => u.owner === 1).length);
  });
});

describe('znaczniki dla botów-sojuszników', () => {
  it('bot w drużynie wysyła wojsko na znacznik „atakuj tutaj”', () => {
    const g = createGame(7, '2v2', 2, false, [0]);
    const bot = g.players[2]!;
    expect(bot.bot).toBe(true);
    const keep = playerKeep(g, 2)!;
    for (let i = 0; i < 3; i++) g.soldiers.push({ id: g.nextId++, owner: 2, kind: 0, px: (keep.x + 5) * FP, py: (keep.y + 14) * FP, path: [], hp: 100, goal: -1, wait: 0, target: 0 } as unknown as (typeof g.soldiers)[number]);
    step(g, [{ type: 'signal', player: 0, kind: 0, x: keep.x + 20, y: keep.y + 20 }]);
    expect(bot.call).toBeDefined();
    for (let i = 0; i < 60; i++) step(g, []);
    expect(bot.call).toBeUndefined();
    expect(g.soldiers.filter((s) => s.owner === 2).some((s) => s.goal >= 0 || s.path.length > 0)).toBe(true);
  });
});

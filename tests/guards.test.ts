import { describe, expect, it } from 'vitest';
import { GUARD } from '../src/data/units';
import { resIndex } from '../src/data/resources';
import { clockAt } from '../src/sim/clock';
import { createGame, Phase, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { monthlyForecast } from '../src/sim/systems/economy';

const at = (g: GameState, h0: number, h1: number): void => { while (!(clockAt(g.tick).hour >= h0 && clockAt(g.tick).hour < h1)) step(g, []); };
const guards = (g: GameState, owner = 0) => g.soldiers.filter((s) => s.owner === owner && s.kind === GUARD);

describe('straż miejska', () => {
  it('na start zamek wystawia sześciu strażników, za dnia dwóch stoi przy bramie, reszta obchodzi', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    for (let i = 0; i < 300; i++) step(g, []);
    expect(guards(g).length).toBe(6);
    const keep = playerKeep(g, 0)!;
    const near = guards(g).filter((s) => Math.abs((s.px >> 8) - keep.x) < 6 && Math.abs((s.py >> 8) - keep.y) < 7);
    expect(near.length).toBeGreaterThanOrEqual(2);
  });

  it('nocą obchodzą osadę (każdy chodzi), nie słuchają rozkazów gracza', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    at(g, 23, 23.5);
    const before = guards(g).map((s) => [s.px, s.py]);
    for (let i = 0; i < 120; i++) step(g, []);
    const moved = guards(g).filter((s, i) => s.px !== before[i]![0] || s.py !== before[i]![1]).length;
    expect(moved).toBeGreaterThanOrEqual(4);
    const s = guards(g)[0]!;
    step(g, [{ type: 'stance', player: 0, ids: [s.id], stance: 2 }]);
    expect(s.stance).not.toBe(2);
  });

  it('poległego zastępuje rekrut: wolny chłop płaci włócznię i żołd i szkoli się w twierdzy, nie od razu', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    const p = g.players[0]!;
    p.res[resIndex('spear')] = 3; p.res[resIndex('gold')] = 100;
    for (let i = 0; i < 50; i++) step(g, []);
    const dead = guards(g)[0]!;
    g.soldiers.splice(g.soldiers.indexOf(dead), 1);
    const peasants = g.units.filter((u) => u.owner === 0).length;
    for (let i = 0; i < 400; i++) step(g, []);
    expect(guards(g).length).toBe(5); // szkoli się
    expect(p.guardReady).toBeGreaterThan(0);
    expect(p.res[resIndex('spear')]).toBe(2);
    expect(g.units.filter((u) => u.owner === 0).length).toBe(peasants - 1);
    for (let i = 0; i < 900; i++) step(g, []);
    expect(guards(g).length).toBe(6);
  });

  it('bez włóczni i złota albo z wrogiem pod zamkiem nikt nie zostaje strażnikiem', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    const p = g.players[0]!;
    for (let i = 0; i < 50; i++) step(g, []);
    g.soldiers.splice(g.soldiers.indexOf(guards(g)[0]!), 1);
    p.res[resIndex('spear')] = 0;
    for (let i = 0; i < 1500; i++) step(g, []);
    expect(guards(g).length).toBe(5);
    // jest broń, ale wróg stoi tuż pod twierdzą (i nie da się go ruszyć)
    p.res[resIndex('spear')] = 3; p.res[resIndex('gold')] = 100;
    const keep = playerKeep(g, 0)!;
    g.soldiers.push({ id: g.nextId++, owner: 1, kind: 0, px: (keep.x + 6) * 256 + 128, py: (keep.y - 6) * 256 + 128, path: [], hp: 99999, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 });
    for (let i = 0; i < 1500; i++) step(g, []);
    expect(p.guardReady ?? 0).toBe(0);
  });

  it('strażnik nie goni wroga na pół mapy: za osadą zawraca na obchód', () => {
    const g = createGame(5);
    for (const p of g.players) { p.bot = false; }
    for (let i = 0; i < 30; i++) step(g, []);
    const s = guards(g)[1]!;
    const keep = playerKeep(g, 0)!;
    s.px = (keep.x + 30) * 256 + 128; s.py = (keep.y + 1) * 256 + 128; s.path = []; s.goal = -1; s.target = 0;
    for (let i = 0; i < 10; i++) step(g, []);
    expect(s.goal).toBeGreaterThanOrEqual(0);
    const gx = s.goal % g.map.width;
    expect(Math.abs(gx - keep.x)).toBeLessThan(20);
  });
});

describe('spanie pod gołym niebem', () => {
  it('kto spał na słomie, ten narzeka: popularność spada, w deszczu jeszcze bardziej', () => {
    const g = createGame(5);
    for (const p of g.players) { p.bot = false; p.guards = 0; }
    at(g, 23, 23.5);
    for (const u of g.units) if (u.owner === 0) { u.phase = Phase.Sleeping; u.home = 0; u.target = (u.py >> 8) * g.map.width + (u.px >> 8) + 1; }
    at(g, 3.5, 4);
    expect(g.players[0]!.rough).toBeGreaterThan(0);
    const parts = monthlyForecast(g, g.players[0]!).parts;
    expect(parts.find((x) => x.key === 'rough')!.value).toBeLessThan(0);
  });
});

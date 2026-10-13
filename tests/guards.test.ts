import { describe, expect, it } from 'vitest';
import { GUARD } from '../src/data/units';
import { clockAt } from '../src/sim/clock';
import { createGame, Phase, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { monthlyForecast } from '../src/sim/systems/economy';

const at = (g: GameState, h0: number, h1: number): void => { while (!(clockAt(g.tick).hour >= h0 && clockAt(g.tick).hour < h1)) step(g, []); };
const guards = (g: GameState, owner = 0) => g.soldiers.filter((s) => s.owner === owner && s.kind === GUARD);

describe('straż miejska', () => {
  it('na start zamek wystawia sześciu strażników, za dnia część stoi na posterunkach przy twierdzy', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    for (let i = 0; i < 300; i++) step(g, []);
    expect(guards(g).length).toBe(6);
    const keep = playerKeep(g, 0)!;
    const near = guards(g).filter((s) => Math.abs((s.px >> 8) - keep.x) < 6 && Math.abs((s.py >> 8) - keep.y) < 7);
    expect(near.length).toBeGreaterThanOrEqual(3);
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

  it('poległego strażnika zastępuje wolny chłop', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    for (let i = 0; i < 50; i++) step(g, []);
    const peasants = g.units.filter((u) => u.owner === 0).length;
    const dead = guards(g)[0]!;
    g.soldiers.splice(g.soldiers.indexOf(dead), 1);
    expect(guards(g).length).toBe(5);
    for (let i = 0; i < 700; i++) step(g, []);
    expect(guards(g).length).toBe(6);
    expect(g.units.filter((u) => u.owner === 0).length).toBeLessThanOrEqual(peasants);
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

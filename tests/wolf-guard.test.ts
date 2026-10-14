import { describe, expect, it } from 'vitest';
import { GUARD } from '../src/data/units';
import { clockAt } from '../src/sim/clock';
import { createGame, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';

const at = (g: GameState, h0: number, h1: number): void => { while (!(clockAt(g.tick).hour >= h0 && clockAt(g.tick).hour < h1)) step(g, []); };

describe('wilki i straż', () => {
  it('strażnik, który zobaczy wilka, rzuca obchód, biegnie i go ubija; zabity wilk zostaje na ziemi', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    at(g, 23, 23.5);
    for (let i = 0; i < 50; i++) step(g, []);
    const guard = g.soldiers.find((s) => s.owner === 0 && s.kind === GUARD)!;
    // nocne wilki z zegara nie przeszkadzają: zostaje tylko nasz
    g.wolves = [{ id: 99999, px: guard.px + 7 * 256, py: guard.py, hp: 45, path: [], target: 0, cd: 0, leaving: false }];
    step(g, []);
    expect(guard.hunt).toBe(99999);
    let dead = false;
    for (let i = 0; i < 600 && !dead; i++) { step(g, []); dead = !g.wolves.some((w) => w.id === 99999); }
    expect(dead).toBe(true);
    // zabity (nie uciekł do lasu): ciało wilka na ziemi
    expect(g.corpses.some((c) => c.id === 99999 && c.kind === -2)).toBe(true);
  });

  it('jeden wilk nie wybija tłumu: przy kilku chłopach obok ginie najwyżej jeden, a wilk ucieka albo pada', () => {
    const g = createGame(5);
    for (const p of g.players) { p.bot = false; p.guards = 0; }
    g.soldiers = g.soldiers.filter((s) => s.kind !== GUARD);
    at(g, 20.6, 21);
    const people = g.units.filter((u) => u.owner === 0).slice(0, 6);
    // wieczór: ludzie jeszcze nie śpią (śpiących w chacie wilk nie widzi); stoją na placu przed bramą (zawsze wolny)
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const c = { px: (keep.x + 5) * 256 + 128, py: (keep.y + 12) * 256 + 128 };
    for (const u of people) { u.px = c.px; u.py = c.py; u.path = []; }
    g.wolves = [{ id: 99998, px: c.px + 2 * 256, py: c.py, hp: 45, path: [], target: 0, cd: 0, leaving: false }];
    const before = g.units.length;
    for (let i = 0; i < 400; i++) { step(g, []); g.wolves = g.wolves.filter((w) => w.id === 99998); }
    expect(before - g.units.length).toBeLessThanOrEqual(1);
    const w = g.wolves.find((x) => x.id === 99998);
    expect(!w || w.leaving).toBe(true);
  });
});

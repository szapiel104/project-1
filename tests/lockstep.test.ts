import { describe, expect, it, vi } from 'vitest';

// zamiast Supabase: wspólna „szyna” w pamięci, wiadomości trafiają do wszystkich poza nadawcą
const bus: ((m: unknown) => void)[] = [];
vi.mock('../src/net/supa', () => ({
  gameChannel: (_room: string, onMsg: (m: unknown) => void) => {
    bus.push(onMsg);
    return { send: (m: unknown) => { for (const f of bus) if (f !== onMsg) f(structuredClone(m)); }, close: () => {}, ready: Promise.resolve() };
  },
}));

import { DELAY, Lockstep, TURN } from '../src/net/lockstep';
import { createGame, stateHash } from '../src/sim/state';
import { step, type Command } from '../src/sim/step';

describe('lockstep', () => {
  it('dwie przeglądarki liczą ten sam stan przy poleceniach z obu stron', () => {
    bus.length = 0;
    const a = new Lockstep('r', 0, [0, 1]);
    const b = new Lockstep('r', 1, [0, 1]);
    const ga = createGame(42, '1v1', 1, false);
    const gb = createGame(42, '1v1', 1, false);
    for (const g of [ga, gb]) for (const p of [0, 1]) g.players[p]!.bot = false;
    const tick = (ls: Lockstep, g: typeof ga, own: Command[]): boolean => {
      if (g.tick % TURN === 0) {
        const turn = g.tick / TURN;
        if (!ls.canRun(turn)) return false;
        step(g, ls.beginTurn(turn, own, stateHash(g)));
      } else step(g, []);
      return true;
    };
    for (let i = 0; i < 400; i++) {
      // gość „oszukuje” numerem gracza — lockstep i tak przypisze polecenie jemu
      const ownA: Command[] = i === 0 ? [{ type: 'setTax', player: 0, level: 3 }] : [];
      const ownB: Command[] = i === 0 ? [{ type: 'setTax', player: 0, level: 0 }] : [];
      expect(tick(a, ga, ownA)).toBe(true);
      expect(tick(b, gb, ownB)).toBe(true);
    }
    expect(stateHash(ga)).toBe(stateHash(gb));
    expect(ga.players[0]!.tax).toBe(3);
    expect(ga.players[1]!.tax).toBe(0);
    expect(a.desync || b.desync).toBe(false);
  });

  it('bez poleceń przeciwnika gra czeka', () => {
    bus.length = 0;
    const a = new Lockstep('r', 0, [0, 1]);
    for (let t = 0; t < DELAY; t++) { expect(a.canRun(t)).toBe(true); a.beginTurn(t, [], 0); }
    expect(a.canRun(DELAY)).toBe(false);
  });
});

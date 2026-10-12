import { describe, expect, it } from 'vitest';

// zamiast Supabase: wspólna „szyna” w pamięci, wiadomości trafiają do wszystkich poza nadawcą
const bus: ((m: unknown) => void)[] = [];
const link = () => {
  let mine: ((m: unknown) => void) | null = null;
  return {
    send: (m: unknown) => { for (const f of bus) if (f !== mine) f(structuredClone(m)); },
    on: (f: (m: unknown) => void) => { mine = f; bus.push(f); return () => { bus.splice(bus.indexOf(f), 1); }; },
  };
};

import { DELAY, Lockstep, TURN } from '../src/net/lockstep';
import { createGame, stateHash } from '../src/sim/state';
import { step, type Command } from '../src/sim/step';

describe('lockstep', () => {
  it('dwie przeglądarki liczą ten sam stan przy poleceniach z obu stron', () => {
    bus.length = 0;
    const a = new Lockstep(link() as never, 0, [0, 1]);
    const b = new Lockstep(link() as never, 1, [0, 1]);
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
    const a = new Lockstep(link() as never, 0, [0, 1]);
    for (let t = 0; t < DELAY; t++) { expect(a.canRun(t)).toBe(true); a.beginTurn(t, [], 0); }
    expect(a.canRun(DELAY)).toBe(false);
  });

  it('po wyjściu gracza reszta czeka na jego wysłane tury, potem gra dalej', () => {
    bus.length = 0;
    const a = new Lockstep(link() as never, 0, [0, 1, 2]);
    const b = new Lockstep(link() as never, 1, [0, 1, 2]);
    const c = new Lockstep(link() as never, 2, [0, 1, 2]);
    for (let t = 0; t < 3; t++) for (const x of [a, b, c]) { expect(x.canRun(t)).toBe(true); x.beginTurn(t, [], 0); }
    c.close(); // c wysłał polecenia do tury 4
    for (const t of [3, 4]) for (const x of [a, b]) { expect(x.canRun(t)).toBe(true); x.beginTurn(t, [], 0); }
    expect(a.canRun(5)).toBe(true);
    expect(a.left).toEqual([2]);
  });
});

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
import { deserialize, serialize } from '../src/sim/save';
import { packState, unpackState } from '../src/net/rejoin';

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
    for (const t of [3, 4]) for (const x of [a, b]) { expect(x.canRun(t)).toBe(true); expect(x.beginTurn(t, [], 0)).toEqual([]); }
    expect(a.canRun(5)).toBe(true);
    // w turze 5 obaj dostają kapitulację gracza 2
    expect(a.beginTurn(5, [], 0)).toEqual([{ type: 'surrender', player: 2 }]);
    expect(b.beginTurn(5, [], 0)).toEqual([{ type: 'surrender', player: 2 }]);
    expect(a.left).toEqual([2]);
  });
});

describe('wyjście z meczu', () => {
  it('1 na 1: kto wyjdzie, przegrywa', () => {
    const g = createGame(7, '1v1', 2, false, [0, 1]);
    step(g, [{ type: 'surrender', player: 1 }]);
    expect(g.players[1]!.defeated).toBe(true);
  });
  it('2 na 2: zamek gracza, który wyszedł, zostaje, dopóki jest sojusznik', () => {
    const g = createGame(7, '2v2', 2, false, [0, 1, 2, 3]);
    step(g, [{ type: 'surrender', player: 1 }]);
    expect(g.players[1]!.defeated).toBe(false);
    expect(g.players[1]!.left).toBe(true);
    step(g, [{ type: 'surrender', player: 3 }]); // drugi z tej samej drużyny też wyszedł
    expect(g.players[3]!.defeated).toBe(true);
  });
});

describe('zerwane połączenie', () => {
  it('gracz, który zamilkł, zostaje ogłoszony jako wychodzący i u wszystkich w tej samej turze jego zamek przejmuje bot', () => {
    bus.length = 0;
    const a = new Lockstep(link() as never, 0, [0, 1, 2]);
    const b = new Lockstep(link() as never, 1, [0, 1, 2]);
    const c = new Lockstep(link() as never, 2, [0, 1, 2]);
    for (let t = 0; t < 3; t++) for (const x of [a, b, c]) x.beginTurn(t, [], 0);
    // c znika bez pożegnania: wysłał polecenia do tury 4
    for (const t of [3, 4]) for (const x of [a, b]) { expect(x.canRun(t)).toBe(true); x.beginTurn(t, [], 0); }
    expect(a.canRun(5)).toBe(false);
    expect(a.missing(5)).toEqual([2]);
    a.drop(2); // a czekał za długo
    expect(a.canRun(5) && b.canRun(5)).toBe(true);
    expect(a.beginTurn(5, [], 0)).toEqual([{ type: 'leave', player: 2 }]);
    expect(b.beginTurn(5, [], 0)).toEqual([{ type: 'leave', player: 2 }]);
    // c żył, tylko jego polecenia nie dochodziły: dowiaduje się, że go odcięto, i musi wrócić do meczu od nowa
    expect(c.kicked).toBe(true);
  });
});

describe('powrót do meczu', () => {
  it('rozłączony gracz: bot przejmuje zamek, po powrocie oddaje go człowiekowi', () => {
    const g = createGame(7, '2v2', 2, false, [0, 1, 2, 3]);
    step(g, [{ type: 'leave', player: 2 }]);
    expect(g.players[2]!.bot).toBe(true);
    expect(g.players[2]!.away).toBe(true);
    expect(g.players[2]!.defeated).toBe(false);
    step(g, [{ type: 'rejoin', player: 0, who: 2 }]);
    expect(g.players[2]!.bot).toBe(false);
    expect(g.players[2]!.away).toBe(false);
    // po poddaniu nie ma powrotu
    step(g, [{ type: 'surrender', player: 3 }, { type: 'rejoin', player: 0, who: 3 }]);
    expect(g.players[3]!.left).toBe(true);
    expect(g.players[3]!.bot).toBe(false);
  });

  it('po odświeżeniu strony gracz wraca: dostaje stan gry od prowadzącego i dalej wszyscy liczą to samo', async () => {
    bus.length = 0;
    const humans = [0, 1, 2];
    const a = new Lockstep(link() as never, 0, humans);
    const b = new Lockstep(link() as never, 1, humans);
    let c = new Lockstep(link() as never, 2, humans);
    const ga = createGame(9, '2v2', 1, false, humans);
    const gb = createGame(9, '2v2', 1, false, humans);
    let gc = createGame(9, '2v2', 1, false, humans);
    const pend = new Map<Lockstep, Command[]>();
    let sent: { to: number; turn: number; save: unknown; net: ReturnType<Lockstep['exportNet']> } | null = null;
    const tick = (ls: Lockstep, g: typeof ga): boolean => {
      if (g.tick % TURN === 0) {
        const turn = g.tick / TURN;
        if (!ls.canRun(turn)) return false;
        const cmds = ls.beginTurn(turn, pend.get(ls) ?? [], stateHash(g));
        pend.set(ls, []);
        step(g, cmds);
        // prowadzący przesyła stan po wykonaniu polecenia powrotu
        for (const x of cmds) if (x.type === 'rejoin' && x.player === ls.me) sent = { to: x.who, turn, save: JSON.parse(JSON.stringify(serialize(g, '2v2'))), net: structuredClone(ls.exportNet(turn)) };
      } else step(g, []);
      return true;
    };
    for (let i = 0; i < 300; i++) { tick(a, ga); tick(b, gb); tick(c, gc); }
    expect(stateHash(ga)).toBe(stateHash(gc));
    // c odświeża stronę: żegna się bez poddania
    c.close(false);
    for (let i = 0; i < 200; i++) { tick(a, ga); tick(b, gb); }
    expect(ga.players[2]!.bot).toBe(true);
    expect(stateHash(ga)).toBe(stateHash(gb));
    // c wraca: nowy lockstep słucha od razu, prowadzący (a) wydaje polecenie powrotu
    c = new Lockstep(link() as never, 2, humans);
    expect(a.leader()).toBe(0);
    const now = Math.floor(ga.tick / TURN);
    expect(a.canTakeBack(2, now)).toBe(true);
    pend.set(a, [{ type: 'rejoin', player: 0, who: 2 }]);
    for (let i = 0; i < 40 && !sent; i++) { tick(a, ga); tick(b, gb); }
    expect(sent).not.toBeNull();
    // stan leci przez pakowanie (gzip + base64 w kawałkach), jak w grze
    const parts = await packState(sent!.save as never, sent!.net);
    const got = await unpackState(parts);
    gc = deserialize(got.save)!;
    c.resume(sent!.turn, got.net);
    expect(gc.players[2]!.bot).toBe(false);
    // dalej gramy we trzech: c wydaje polecenie, wszyscy liczą to samo
    pend.set(c, [{ type: 'setTax', player: 2, level: 3 }]);
    for (let i = 0; i < 400; i++) {
      // c może być kilka ticków za resztą — gra, dopóki ma polecenia
      tick(a, ga); tick(b, gb); tick(c, gc);
    }
    for (let i = 0; i < 20 && gc.tick < ga.tick; i++) tick(c, gc);
    expect(gc.tick).toBe(ga.tick);
    expect(stateHash(gc)).toBe(stateHash(ga));
    expect(stateHash(gb)).toBe(stateHash(ga));
    expect(ga.players[2]!.tax).toBe(3);
    expect(a.back).toEqual([2]);
    expect(a.desync || b.desync || c.desync).toBe(false);
  });
});

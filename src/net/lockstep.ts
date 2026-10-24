import type { Command } from '../sim/step';
import type { NetMsg, RoomLink } from './supa';

/**
 * Gra przez sieć bez serwera gry: każdy gracz liczy tę samą, deterministyczną symulację.
 * Czas dzieli się na tury po TURN ticków. Polecenia wydane w turze n wykonują się w turze n + DELAY u wszystkich naraz,
 * więc gra rusza dalej dopiero, gdy ma polecenia na daną turę od każdego gracza (choćby puste).
 * Skrót stanu z początku tury leci razem z poleceniami — gdy u kogoś wyjdzie inny, gra wie o rozjeździe.
 *
 * Wyjście z meczu:
 * - poddanie (przycisk, wyjście do menu) — gracz przegrywa (`surrender`);
 * - zerwane połączenie, zamknięta albo odświeżona karta — zamkiem rządzi bot (`leave`), a gracz może wrócić:
 *   jeden z grających (`leader`) wydaje polecenie `rejoin`, po jego wykonaniu przesyła wracającemu stan gry
 *   i polecenia na kolejne tury (`exportNet`), a wracający wznawia od tego miejsca (`resume`).
 */
export const TURN = 5;
export const DELAY = 2;

/** Stan lockstepu przesyłany wracającemu graczowi razem z zapisem gry */
export interface NetSnapshot {
  /** Polecenia na kolejne tury: [tura, gracz, polecenia] */
  inbox: [number, number, Command[]][];
  /** Gracze poza meczem: [gracz, ostatnia tura z poleceniami] */
  gone: [number, number][];
  /** Ci z `gone`, którzy się poddali (reszta to zerwane połączenia) */
  gives: number[];
  /** Gracze, którzy właśnie wrócili: do tej tury nie czekamy na ich polecenia */
  quiet: [number, number][];
  lastFrom: [number, number][];
}

export class Lockstep {
  private inbox = new Map<number, Map<number, Command[]>>();
  private myHash = new Map<number, number>();
  /** Gracze, którzy wyszli: numer ostatniej tury, na którą zdążyli wysłać polecenia */
  private gone = new Map<number, number>();
  /** Wyszli, bo się poddali (bez tego: zerwane połączenie, zamkiem rządzi bot) */
  private gives = new Set<number>();
  /** Wrócił do meczu: do tej tury jego polecenia są puste (nie zdążył ich wysłać) */
  private quiet = new Map<number, number>();
  private off: () => void;
  private lastSent = DELAY - 1;
  /** Ostatnia tura, na którą przyszły polecenia od danego gracza */
  private lastFrom = new Map<number, number>();
  waitingSince = 0;
  desync = false;
  /** Ktoś wyszedł (do komunikatu na ekranie) */
  left: number[] = [];
  /** Ktoś wrócił do meczu (do komunikatu na ekranie) */
  back: number[] = [];
  /** Inni uznali mnie za rozłączonego (długo nie dochodziły moje polecenia) — trzeba wrócić do meczu od nowa */
  kicked = false;

  constructor(private link: Pick<RoomLink, 'send' | 'on'>, readonly me: number, readonly players: number[]) {
    this.off = link.on((m) => this.receive(m));
  }

  private receive(m: NetMsg): void {
    if (m.k === 'bye') {
      if (m.from === this.me) { this.kicked = true; return; }
      if (this.players.includes(m.from) && !this.gone.has(m.from)) { this.gone.set(m.from, m.last); if (m.give) this.gives.add(m.from); this.left.push(m.from); }
      return;
    }
    if (m.k !== 'turn' || !this.players.includes(m.from) || m.from === this.me) return;
    // po wyjściu gracza jego spóźnione polecenia nie wchodzą do gry (u jednych by doszły, u innych nie)
    const gone = this.gone.get(m.from);
    if (gone !== undefined && m.turn > gone) return;
    let t = this.inbox.get(m.turn);
    if (!t) { t = new Map(); this.inbox.set(m.turn, t); }
    // gracz może wydawać polecenia tylko sobie
    t.set(m.from, (m.cmds ?? []).map((c) => ({ ...c, player: m.from }) as Command));
    this.lastFrom.set(m.from, Math.max(this.lastFrom.get(m.from) ?? 0, m.turn));
    if (m.hashTurn !== undefined && m.hash !== undefined) {
      const mine = this.myHash.get(m.hashTurn);
      if (mine !== undefined && mine !== m.hash) this.desync = true;
    }
  }

  send(m: NetMsg): void { this.link.send(m); }

  /** Czy polecenia gracza na tę turę są już niepotrzebne albo z góry puste */
  private free(p: number, turn: number): boolean {
    return p === this.me || (this.gone.has(p) && turn > this.gone.get(p)!) || (this.quiet.get(p) ?? -1) >= turn;
  }

  /** Na kogo czekamy w tej turze (gracze, od których brakuje poleceń) */
  missing(turn: number): number[] {
    if (turn < DELAY) return [];
    const t = this.inbox.get(turn);
    return this.players.filter((p) => !t?.has(p) && !this.free(p, turn));
  }

  /**
   * Gracz zamilkł (zerwane połączenie, zamknięta karta bez pożegnania): ogłaszamy jego wyjście w jego imieniu.
   * Ostatnia tura to ta, na którą przyszły od niego polecenia — dostali je wszyscy, więc u każdego wypada tak samo.
   * Jego zamkiem rządzi potem bot, a on sam może wrócić do meczu.
   */
  drop(p: number): void {
    if (this.gone.has(p) || p === this.me || !this.players.includes(p)) return;
    const last = Math.max(this.lastFrom.get(p) ?? DELAY - 1, this.quiet.get(p) ?? -1);
    this.gone.set(p, last); this.left.push(p);
    this.link.send({ k: 'bye', from: p, last });
  }

  /** Czy można zacząć turę (mamy polecenia od wszystkich, którzy na nią jeszcze grają) */
  canRun(turn: number): boolean {
    if (turn < DELAY) return true;
    const t = this.inbox.get(turn);
    return this.players.every((p) => t?.has(p) || this.free(p, turn));
  }

  /** Czy gracz wyszedł przez zerwane połączenie (nie poddał się) — tylko taki może wrócić */
  isAway(p: number): boolean { return this.gone.has(p) && !this.gives.has(p); }

  /**
   * Czy w turze `turn` można już wydać polecenie powrotu gracza `p`: jego wyjście (bot przejmuje zamek) musi być
   * w grze wcześniej niż powrót, inaczej u wszystkich wyszłoby odwrotnie.
   */
  canTakeBack(p: number, turn: number): boolean { return this.isAway(p) && turn + DELAY > this.gone.get(p)! + 1; }

  /** Kto z grających odpowiada wracającym (przesyła im stan gry): gracz o najniższym numerze, który jest w meczu */
  leader(): number { return this.players.filter((p) => !this.gone.has(p)).sort((a, b) => a - b)[0] ?? this.me; }

  /** Gracz wrócił do meczu w turze `turn` (polecenie `rejoin`): jego polecenia wejdą od tury turn + DELAY + 1 */
  private takeBack(p: number, turn: number): void {
    if (!this.gone.has(p) || this.gives.has(p)) return;
    this.gone.delete(p);
    this.quiet.set(p, turn + DELAY);
    this.lastFrom.set(p, turn + DELAY);
    this.back.push(p);
  }

  /**
   * Początek tury: wysyła własne polecenia na turę + DELAY (z bieżącym skrótem stanu) i zwraca polecenia wszystkich na tę turę
   * w stałej kolejności graczy, żeby każdy wykonał je identycznie.
   */
  beginTurn(turn: number, own: Command[], hash: number): Command[] {
    const target = turn + DELAY;
    const mine = own.map((c) => ({ ...c, player: this.me }) as Command);
    let t = this.inbox.get(target);
    if (!t) { t = new Map(); this.inbox.set(target, t); }
    t.set(this.me, mine);
    this.myHash.set(turn, hash);
    this.link.send({ k: 'turn', turn: target, from: this.me, cmds: mine, hash, hashTurn: turn });
    this.lastSent = target;
    const now = this.inbox.get(turn);
    this.inbox.delete(turn);
    this.myHash.delete(turn - 20);
    const out: Command[] = [];
    for (const p of [...this.players].sort((a, b) => a - b)) {
      out.push(...(now?.get(p) ?? []));
      // gracz, który wyszedł, odpada w pierwszej turze po swoich ostatnich poleceniach — u wszystkich w tej samej turze:
      // po poddaniu przegrywa, po zerwanym połączeniu jego zamkiem rządzi bot
      if (this.gone.get(p) === turn - 1) out.push(this.gives.has(p) ? { type: 'surrender', player: p } : { type: 'leave', player: p });
    }
    for (const c of out) if (c.type === 'rejoin') this.takeBack(c.who, turn);
    return out;
  }

  /** Stan lockstepu tuż po turze `turn` — dla wracającego gracza (polecenia na kolejne tury i kto jest poza meczem) */
  exportNet(turn: number): NetSnapshot {
    const inbox: [number, number, Command[]][] = [];
    for (const [t, m] of this.inbox) if (t > turn) for (const [p, cmds] of m) inbox.push([t, p, cmds]);
    return { inbox, gone: [...this.gone], gives: [...this.gives], quiet: [...this.quiet], lastFrom: [...this.lastFrom] };
  }

  /**
   * Wracający gracz: gra wczytana ze stanu po turze `turn`. Polecenia, które zdążyły przyjść kanałem w czasie czekania,
   * zostają; resztę uzupełnia przesłany stan. Na tury do turn + DELAY moje polecenia są puste (nikt ich nie wysłał).
   */
  resume(turn: number, s: NetSnapshot): void {
    for (const t of [...this.inbox.keys()]) if (t <= turn) this.inbox.delete(t);
    for (const [t, p, cmds] of s.inbox) {
      if (t <= turn || p === this.me) continue;
      let m = this.inbox.get(t);
      if (!m) { m = new Map(); this.inbox.set(t, m); }
      if (!m.has(p)) m.set(p, cmds);
    }
    for (let t = turn + 1; t <= turn + DELAY; t++) {
      let m = this.inbox.get(t);
      if (!m) { m = new Map(); this.inbox.set(t, m); }
      m.set(this.me, []);
    }
    this.gone = new Map(s.gone.filter(([p]) => p !== this.me));
    this.gives = new Set(s.gives);
    this.quiet = new Map(s.quiet.filter(([p]) => p !== this.me));
    for (const [p, t] of s.lastFrom) this.lastFrom.set(p, Math.max(this.lastFrom.get(p) ?? 0, t));
    this.lastSent = turn + DELAY;
    this.kicked = false;
  }

  /**
   * Wyjście z meczu: inni czekają jeszcze na już wysłane tury, potem grają dalej bez nas.
   * `give` = poddanie (porażka); bez niego (zamknięta karta) zamkiem rządzi bot i można wrócić.
   */
  close(give = true): void { this.link.send({ k: 'bye', from: this.me, last: this.lastSent, give }); this.off(); }
}

import type { Command } from '../sim/step';
import type { NetMsg, RoomLink } from './supa';

/**
 * Gra przez sieć bez serwera gry: każdy gracz liczy tę samą, deterministyczną symulację.
 * Czas dzieli się na tury po TURN ticków. Polecenia wydane w turze n wykonują się w turze n + DELAY u wszystkich naraz,
 * więc gra rusza dalej dopiero, gdy ma polecenia na daną turę od każdego gracza (choćby puste).
 * Skrót stanu z początku tury leci razem z poleceniami — gdy u kogoś wyjdzie inny, gra wie o rozjeździe.
 */
export const TURN = 5;
export const DELAY = 2;

export class Lockstep {
  private inbox = new Map<number, Map<number, Command[]>>();
  private myHash = new Map<number, number>();
  /** Gracze, którzy wyszli: numer ostatniej tury, na którą zdążyli wysłać polecenia */
  private gone = new Map<number, number>();
  private off: () => void;
  private lastSent = DELAY - 1;
  /** Ostatnia tura, na którą przyszły polecenia od danego gracza */
  private lastFrom = new Map<number, number>();
  waitingSince = 0;
  desync = false;
  /** Ktoś wyszedł (do komunikatu na ekranie) */
  left: number[] = [];

  constructor(private link: Pick<RoomLink, 'send' | 'on'>, readonly me: number, readonly players: number[]) {
    this.off = link.on((m) => this.receive(m));
  }

  private receive(m: NetMsg): void {
    if (m.k === 'bye') { if (this.players.includes(m.from) && m.from !== this.me && !this.gone.has(m.from)) { this.gone.set(m.from, m.last); this.left.push(m.from); } return; }
    if (m.k !== 'turn' || !this.players.includes(m.from) || m.from === this.me) return;
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

  /** Na kogo czekamy w tej turze (gracze, od których brakuje poleceń) */
  missing(turn: number): number[] {
    if (turn < DELAY) return [];
    const t = this.inbox.get(turn);
    return this.players.filter((p) => p !== this.me && !t?.has(p) && !(this.gone.has(p) && turn > this.gone.get(p)!));
  }

  /**
   * Gracz zamilkł (zerwane połączenie, zamknięta karta bez pożegnania): ogłaszamy jego wyjście w jego imieniu.
   * Ostatnia tura to ta, na którą przyszły od niego polecenia — dostali je wszyscy, więc u każdego wypada tak samo.
   */
  drop(p: number): void {
    if (this.gone.has(p) || p === this.me || !this.players.includes(p)) return;
    const last = this.lastFrom.get(p) ?? DELAY - 1;
    this.gone.set(p, last); this.left.push(p);
    this.link.send({ k: 'bye', from: p, last });
  }

  /** Czy można zacząć turę (mamy polecenia od wszystkich, którzy na nią jeszcze grają) */
  canRun(turn: number): boolean {
    if (turn < DELAY) return true;
    const t = this.inbox.get(turn);
    return this.players.every((p) => p === this.me || t?.has(p) || (this.gone.has(p) && turn > this.gone.get(p)!));
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
      // gracz, który wyszedł, poddaje się w pierwszej turze po swoich ostatnich poleceniach — u wszystkich w tej samej turze
      if (this.gone.get(p) === turn - 1) out.push({ type: 'surrender', player: p });
    }
    return out;
  }

  /** Wyjście z meczu: inni czekają jeszcze na już wysłane tury, potem grają dalej bez nas */
  close(): void { this.link.send({ k: 'bye', from: this.me, last: this.lastSent }); this.off(); }
}

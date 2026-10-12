import type { Command } from '../sim/step';
import { gameChannel, type NetMsg } from './supa';

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
  private chan: ReturnType<typeof gameChannel>;
  waitingSince = 0;
  desync = false;
  peerLeft = false;
  onStart: () => void = () => {};
  onPeer: () => void = () => {};

  constructor(roomId: string, readonly me: number, readonly players: number[]) {
    this.chan = gameChannel(roomId, (m) => this.receive(m));
  }
  get ready(): Promise<void> { return this.chan.ready; }

  private receive(m: NetMsg): void {
    if (m.k === 'start') { this.onStart(); return; }
    if (m.k === 'hello') { this.onPeer(); return; }
    if (m.k === 'bye') { this.peerLeft = true; return; }
    if (m.k !== 'turn' || !this.players.includes(m.from) || m.from === this.me) return;
    let t = this.inbox.get(m.turn);
    if (!t) { t = new Map(); this.inbox.set(m.turn, t); }
    // gracz może wydawać polecenia tylko sobie
    t.set(m.from, (m.cmds ?? []).map((c) => ({ ...c, player: m.from }) as Command));
    if (m.hashTurn !== undefined && m.hash !== undefined) {
      const mine = this.myHash.get(m.hashTurn);
      if (mine !== undefined && mine !== m.hash) this.desync = true;
    }
  }

  send(m: NetMsg): void { this.chan.send(m); }

  /** Czy można zacząć turę (mamy polecenia od wszystkich) */
  canRun(turn: number): boolean {
    if (turn < DELAY) return true;
    const t = this.inbox.get(turn);
    return this.players.every((p) => p === this.me || t?.has(p));
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
    this.chan.send({ k: 'turn', turn: target, from: this.me, cmds: mine, hash, hashTurn: turn });
    const now = this.inbox.get(turn);
    this.inbox.delete(turn);
    this.myHash.delete(turn - 20);
    const out: Command[] = [];
    for (const p of [...this.players].sort((a, b) => a - b)) out.push(...(now?.get(p) ?? []));
    return out;
  }

  close(): void { this.chan.send({ k: 'bye', from: this.me }); this.chan.close(); }
}

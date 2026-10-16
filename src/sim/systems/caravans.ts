import { RULES } from '../../data/rules';
import { RESOURCE_DEFS, RESOURCES } from '../../data/resources';
import { findPath } from '../path';
import { FP, keepCenter, playerKeep, storeCapacity, storeUsed, type Caravan, type GameState } from '../state';

/**
 * Wysyłanie surowców sojusznikowi (gra drużynowa). Nadawca oddaje towar od razu, z bramy jego zamku wyjeżdża
 * chłop z dwukółką i jedzie pod zamek odbiorcy; tam towar trafia do składów odbiorcy (do ich pojemności).
 * Wóz jest bezbronny: gdy dopadnie go żołnierz wroga, towar przejmuje właściciel tego żołnierza.
 */

/** Co można wysłać (wszystko, co leży w składach, spichlerzach i zbrojowni, oraz złoto) */
export const SENDABLE = RESOURCES.map((_, i) => i);
/** Najwięcej sztuk na jeden wóz */
export const CARAVAN_MAX = 100;
/** Najwięcej wozów w drodze od jednego gracza naraz */
export const CARAVANS_PER_PLAYER = 3;
/** Wóz jedzie trochę wolniej niż pieszy */
const SPEED = Math.round(RULES.unitSpeed * 0.8);
/** Z jakiej odległości (w polach) żołnierz wroga przechwytuje wóz */
const GRAB = 1.3;

/** Pola pod zamkiem odbiorcy, do których wóz może dojechać (najpierw tuż przy zamku, gdy mur nie puszcza — dalej) */
function routeTo(g: GameState, from: number, to: number, owner: number): number[] | null {
  const k = playerKeep(g, to);
  if (!k) return null;
  const w = g.map.width;
  const [cx, cy] = keepCenter(k);
  for (const r of [8, 22]) {
    const near = (t: number): boolean => { const x = t % w, y = (t - x) / w; return Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r; };
    const p = findPath(g, from, near, 8000, owner, cy * w + cx, r, true);
    if (p) return p;
  }
  return null;
}

/** Polecenie „wyślij sojusznikowi”: sprawdza wszystko (polecenia przychodzą z sieci) i wysyła wóz albo nic nie robi */
export function sendCaravan(g: GameState, player: number, to: number, res: number, amount: number): boolean {
  const p = g.players[player], q = g.players[to];
  if (!p || !q || player === to || p.team !== q.team || p.defeated || q.defeated || q.left) return false;
  if (!Number.isInteger(res) || res < 0 || res >= RESOURCES.length || !Number.isInteger(amount) || amount < 1) return false;
  const caravans = (g.caravans ??= []);
  if (caravans.filter((c) => c.owner === player).length >= CARAVANS_PER_PLAYER) return false;
  const n = Math.min(amount, CARAVAN_MAX, p.res[res]!);
  if (n < 1) return false;
  const home = playerKeep(g, player);
  if (!home || home.door < 0) return false;
  const path = routeTo(g, home.door, to, player);
  if (!path) return false;
  p.res[res]! -= n;
  const w = g.map.width, x = home.door % w, y = (home.door - x) / w;
  caravans.push({ id: g.nextId++, owner: player, to, res, amount: n, px: x * FP + FP / 2, py: y * FP + FP / 2, tx: 0, ty: 0, path: path.reverse() });
  return true;
}

/** Towar trafia do gracza (do wolnego miejsca w jego składach; złoto bez limitu). Zwraca, ile się zmieściło. */
function deliver(g: GameState, player: number, res: number, amount: number): number {
  const p = g.players[player];
  if (!p) return 0;
  const kind = RESOURCE_DEFS[RESOURCES[res]!].store;
  const room = kind ? Math.max(0, storeCapacity(g, player, kind) - storeUsed(p, kind)) : amount;
  const n = Math.min(amount, room);
  p.res[res]! += n;
  return n;
}

function note(g: GameState, c: Caravan, captured: boolean, by: number, amount: number): void {
  const log = (g.caravanLog ??= []);
  log.push({ id: c.id, owner: c.owner, to: c.to, res: c.res, amount, tick: g.tick, captured, by });
  if (log.length > 16) log.splice(0, log.length - 16);
}

export function caravanSystem(g: GameState): void {
  const list = g.caravans;
  if (!list || !list.length) return;
  const w = g.map.width;
  const grab2 = (GRAB * FP) ** 2;
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i]!;
    // przechwycenie: najbliższy żołnierz wroga (każdy, kto nie jest z drużyny nadawcy) w zasięgu ręki
    if (g.tick % 5 === 0) {
      const team = g.players[c.owner]?.team;
      const thief = g.soldiers.find((s) => g.players[s.owner]?.team !== team && s.hp > 0 && (s.px - c.px) ** 2 + (s.py - c.py) ** 2 <= grab2);
      if (thief) {
        const got = deliver(g, thief.owner, c.res, c.amount);
        note(g, c, true, thief.owner, got);
        list.splice(i, 1);
        continue;
      }
    }
    if (!c.path.length) {
      // dojechał: odbiorca odpadł albo wyszedł → towar wraca do nadawcy
      const q = g.players[c.to];
      const who = q && !q.defeated && !q.left ? c.to : c.owner;
      const got = deliver(g, who, c.res, c.amount);
      note(g, c, false, who, got);
      list.splice(i, 1);
      continue;
    }
    const n = c.path[c.path.length - 1]!;
    const x = n % w;
    const tx = x * FP + FP / 2, ty = ((n - x) / w) * FP + FP / 2;
    c.px += Math.max(-SPEED, Math.min(SPEED, tx - c.px));
    c.py += Math.max(-SPEED, Math.min(SPEED, ty - c.py));
    c.tx = tx; c.ty = ty;
    if (c.px === tx && c.py === ty) c.path.pop();
  }
}

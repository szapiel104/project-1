/**
 * Złodzieje nocą (Michał 13.11.2026). Gdy ludzie są niezadowoleni (popularność poniżej THRESHOLD), w nocy z lasu na skraju
 * mapy przychodzi złodziej, zakrada się pod drzwi najbogatszego magazynu, chwilę grzebie i wynosi część towaru
 * (najwięcej tego, czego tam leży najwięcej). Straż na obchodzie i żołnierze gracza, którzy go wypatrzą, rzucają się
 * za nim w pościg; złapany oddaje łup do magazynu. Kto ucieknie za skraj mapy, ten przepadł z towarem.
 * Mur i zamknięta brama go zatrzymują (chodzi jak wilk, `WOLF` w path.ts), więc dobrze obwarowana osada śpi spokojniej.
 *
 * Losowanie z własnego skrótu (ziarno mapy, gracz, dzień) — główne `g.rng` zostaje nietknięte. Bot ma to samo.
 */
import { BUILDINGS } from '../../data/buildings';
import { UNITS } from '../../data/units';
import { clockAt, hourStarts } from '../clock';
import { findPath, walkable, WOLF } from '../path';
import { FP, type Building, type GameState } from '../state';
import { depositAt, withdrawAt } from './stock';

/** Poniżej tej popularności w nocy mogą przyjść złodzieje (przy 20 i mniej — dwóch) */
export const THIEF_THRESHOLD = 40;
/** O tej godzinie złodziej wychodzi z lasu */
const SPAWN_HOUR = 21;
/** Krok (stały przecinek na tick) — trochę szybszy od chłopa, cichy */
const SPEED = 34;
/** Ile ticków grzebie przy drzwiach magazynu */
const STEAL_TICKS = 60;
/** Z tylu pól straż albo żołnierz go wypatrzy i rusza w pościg; z tylu go łapie */
const SPOT = 7, CATCH = 1.5;
/** Najwięcej, ile wyniesie naraz (towar w workach) */
const LOOT = 25;

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Magazyn, w którym leży najwięcej towaru (cel złodzieja) */
function richestStore(g: GameState, owner: number): Building | undefined {
  let best: Building | undefined, most = 0;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.door < 0 || b.build || b.ruined || !BUILDINGS[b.type]!.stores?.length) continue;
    const sum = (b.stock ?? []).reduce((a, v) => a + v, 0);
    if (sum > most) { most = sum; best = b; }
  }
  return best;
}

/** Najbliższe pole skraju mapy, po którym da się chodzić (wejście i ucieczka złodzieja) */
function edgeNear(g: GameState, x: number, y: number): number {
  const { width: w, height: h } = g.map;
  const d = [y, h - 1 - y, x, w - 1 - x];
  const side = d.indexOf(Math.min(...d));
  for (let k = 0; k < 40; k++) {
    for (const s of [k, -k]) {
      const tx = side < 2 ? Math.max(1, Math.min(w - 2, x + s)) : side === 2 ? 1 : w - 2;
      const ty = side < 2 ? (side === 0 ? 1 : h - 2) : Math.max(1, Math.min(h - 2, y + s));
      const t = ty * w + tx;
      if (walkable(g, t, WOLF)) return t;
    }
  }
  return -1;
}

const tileOf = (g: GameState, t: { px: number; py: number }): number => (t.py >> 8) * g.map.width + (t.px >> 8);

export function thiefSystem(g: GameState): void {
  const { width } = g.map;
  const clock = clockAt(g.tick);
  if (clock.day >= 2 && g.tick > 0 && hourStarts(g.tick, SPAWN_HOUR)) {
    for (const p of g.players) {
      if (p.level === 0 || p.popularity >= THIEF_THRESHOLD) continue;
      // im niższa popularność, tym pewniejsza wizyta: przy 39 rzadko, przy 0 co noc
      if (hash(g.map.seed >>> 0, p.id, clock.day) > (THIEF_THRESHOLD - p.popularity) / THIEF_THRESHOLD) continue;
      const store = richestStore(g, p.id);
      if (!store) continue;
      const sx = store.door % width, sy = (store.door - sx) / width;
      const from = edgeNear(g, sx, sy);
      if (from < 0) continue;
      const n = p.popularity <= 20 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const fx = from % width, fy = (from - fx) / width;
        (g.thieves ??= []).push({ id: g.nextId++, owner: p.id, px: fx * FP + FP / 2 + i * 70, py: fy * FP + FP / 2, path: [], phase: 0, store: store.id, timer: 0 });
      }
    }
  }
  const list = g.thieves;
  if (!list?.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const th = list[i]!;
    const p = g.players[th.owner];
    const store = g.buildings.find((b) => b.id === th.store && !b.ruined);
    const here = tileOf(g, th);
    // straż i żołnierze gracza: kto go wypatrzy, goni go; kto dobiegnie, łapie
    let caught = false;
    for (const s of g.soldiers) {
      if (s.owner !== th.owner || s.up || UNITS[s.kind]!.ram) continue;
      const d2 = ((s.px - th.px) / FP) ** 2 + ((s.py - th.py) / FP) ** 2;
      if (d2 <= CATCH * CATCH) { caught = true; break; }
      if (d2 <= SPOT * SPOT && !s.target && !s.hunt && !s.prey && (g.tick + s.id) % 10 === 0) { s.goal = here; s.path = []; s.wait = 0; s.slot = undefined; th.chased = 1; }
    }
    if (caught) {
      // łup wraca do magazynu (albo do zapasów, gdy magazynu już nie ma)
      if (p && th.res !== undefined && th.amt) { p.res[th.res]! += th.amt; if (store) depositAt(g, store, th.res, th.amt); }
      if (p) p.lastThief = { tick: g.tick, kind: 1, x: th.px >> 8, y: th.py >> 8, res: th.res ?? -1, amt: th.amt ?? 0 };
      list.splice(i, 1);
      continue;
    }
    // świt: kto nie zdążył, ucieka z pustymi rękami
    if (th.phase === 0 && clock.hour >= 6.5 && clock.hour < 20) { th.phase = 2; th.path = []; }
    if (th.phase === 0 && !store) { th.phase = 2; th.path = []; }
    if (th.phase === 0 && store) {
      const dx = store.door % width, dy = (store.door - dx) / width;
      if (Math.max(Math.abs((th.px >> 8) - dx), Math.abs((th.py >> 8) - dy)) <= 1) { th.phase = 1; th.timer = STEAL_TICKS; th.path = []; }
      else if (!th.path.length && (g.tick + th.id) % 15 === 0) {
        th.path = findPath(g, here, (t) => Math.abs((t % width) - dx) <= 1 && Math.abs(Math.floor(t / width) - dy) <= 1, 4000, WOLF) ?? [];
        // mur bez wejścia: nie ma drogi do magazynu — rezygnuje i wraca do lasu
        if (!th.path.length) { th.phase = 2; }
      }
    }
    if (th.phase === 1) {
      if (--th.timer > 0) continue;
      // wynosi to, czego w magazynie leży najwięcej
      const stock = store?.stock ?? [];
      let res = -1, most = 0;
      stock.forEach((v, r) => { if (v > most) { most = v; res = r; } });
      if (p && store && res >= 0) {
        const amt = withdrawAt(store, res, Math.min(LOOT, Math.max(1, Math.ceil(most / 4))));
        p.res[res] = Math.max(0, p.res[res]! - amt);
        th.res = res; th.amt = amt;
      }
      th.phase = 2; th.path = [];
    }
    if (th.phase === 2 && !th.path.length && (g.tick + th.id) % 10 === 0) {
      const out = edgeNear(g, th.px >> 8, th.py >> 8);
      th.path = out >= 0 ? findPath(g, here, (t) => t === out, 4000, WOLF, out) ?? [] : [];
      const x = th.px >> 8, y = th.py >> 8;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= g.map.height - 2 || (!th.path.length && out < 0)) {
        // zniknął w lesie: z łupem przepadł (gracz dostaje wiadomość tylko, gdy coś zginęło)
        if (p && th.amt) p.lastThief = { tick: g.tick, kind: 0, x, y, res: th.res ?? -1, amt: th.amt };
        list.splice(i, 1);
        continue;
      }
    }
    const next = th.path[0];
    if (next === undefined) continue;
    if (!walkable(g, next, WOLF)) { th.path = []; continue; }
    const tx = (next % width) * FP + FP / 2, ty = Math.floor(next / width) * FP + FP / 2;
    th.px += Math.max(-SPEED, Math.min(SPEED, tx - th.px));
    th.py += Math.max(-SPEED, Math.min(SPEED, ty - th.py));
    if (th.px === tx && th.py === ty) th.path.shift();
  }
}

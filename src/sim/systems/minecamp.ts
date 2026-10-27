import { BUILDINGS, footprint } from '../../data/buildings';
import { spareKeeper } from './storage';
import { RESOURCES, resIndex, type ResourceId } from '../../data/resources';
import { GUARD, UNITS } from '../../data/units';
import { findPath, walkable } from '../path';
import { FP, Phase, playerKeep, type Building, type GameState, type Soldier } from '../state';
import { routeTo } from './caravans';

/**
 * Obóz przy kopalni (jak w Gothic): barak górników stoi przy kopalni. Załoga tej kopalni nocuje w nim i siedzi wieczorem
 * przy jego ognisku (workers.ts), a urobek odkłada pod barakiem zamiast nosić go do wioski. Gdy uzbiera się ładunek,
 * z baraku do zamku rusza wóz pod eskortą dwóch strażników kopalni; dopóki strażnicy żyją i idą przy wozie, wróg nie może
 * go przechwycić (caravans.ts) — musi ich najpierw pokonać. Strażników barak werbuje sam z wolnych chłopów (włócznia i żołd).
 */
export const MINE_T = BUILDINGS.findIndex((b) => b.id === 'oremine');
export const CAMP_T = BUILDINGS.findIndex((b) => b.id === 'minecamp');
/** Jak daleko od kopalni (od środka do środka, w polach) może stać jej barak */
export const CAMP_RANGE = 10;
/** Ile urobku mieści się pod barakiem */
export const CAMP_HOLD = 60;
/** Od tylu sztuk wóz rusza od razu; mniej — dopiero gdy długo żaden nie jechał */
export const CART_LOAD = 24;
const CART_EVERY = 2400;
/** Ilu strażników ma obóz i ile trwa szkolenie rekruta */
export const CAMP_GUARDS = 2;
const TRAIN = 600;
/** Uzbrojenie rekruta straży kopalni: jak u straży miejskiej (guards.ts, GUARD_COST) — osobna stała, żeby nie wiązać modułów w koło */
const GUARD_COST: Partial<Record<ResourceId, number>> = { spear: 1, gold: 8 };

const center = (b: Building): [number, number] => {
  const fp = footprint(BUILDINGS[b.type]!, b.rot);
  return [b.x + fp.w / 2, b.y + fp.h / 2];
};
const ready = (b: Building | undefined): boolean => !!b && !b.build && !b.ruined;

/** Barak, który obsługuje daną kopalnię: najbliższy gotowy barak tego samego gracza w zasięgu */
export function campOf(g: GameState, mine: Building | undefined): Building | undefined {
  if (!mine || mine.type !== MINE_T || CAMP_T < 0) return undefined;
  const [mx, my] = center(mine);
  let best: Building | undefined, bd = Infinity;
  for (const b of g.buildings) {
    if (b.type !== CAMP_T || b.owner !== mine.owner || !ready(b) || b.door < 0) continue;
    const [cx, cy] = center(b);
    const d = Math.max(Math.abs(cx - mx), Math.abs(cy - my));
    if (d <= CAMP_RANGE && d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Czy w pobliżu działki (x, y, w×h) stoi własna kopalnia — warunek postawienia baraku */
export function mineNear(g: GameState, player: number, x: number, y: number, w: number, h: number): boolean {
  const cx = x + w / 2, cy = y + h / 2;
  return g.buildings.some((b) => b.type === MINE_T && b.owner === player && !b.ruined && Math.max(Math.abs(center(b)[0] - cx), Math.abs(center(b)[1] - cy)) <= CAMP_RANGE);
}

export const holdTotal = (b: Building): number => (b.hold ?? []).reduce((a, n) => a + n, 0);

/** Odkłada urobek pod barakiem; zwraca, ile się zmieściło */
export function putInHold(b: Building, res: number, amount: number): number {
  const n = Math.max(0, Math.min(amount, CAMP_HOLD - holdTotal(b)));
  if (!n) return 0;
  b.hold ??= new Array(RESOURCES.length).fill(0);
  while (b.hold.length < RESOURCES.length) b.hold.push(0);
  b.hold[res] = (b.hold[res] ?? 0) + n;
  return n;
}

/** Dwa pola przy drzwiach baraku, na których stoją strażnicy, gdy nie eskortują */
function posts(g: GameState, b: Building): number[] {
  const w = g.map.width, dx = b.door % w, dy = (b.door - dx) / w;
  const out: number[] = [];
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [0, -1]] as const) {
    const t = (dy + oy) * w + dx + ox;
    if (dx + ox < 1 || dy + oy < 1 || dx + ox >= w - 1 || dy + oy >= g.map.height - 1) continue;
    if (g.occupancy[t] === 0 && walkable(g, t, b.owner)) out.push(t);
    if (out.length >= CAMP_GUARDS) break;
  }
  return out.length ? out : [b.door];
}

/** Jak blisko kopalni (pola, od środka) musi podejść wróg, żeby załoga uciekła, i ile ticków alarm trwa po jego odejściu */
export const THREAT_RANGE = 7;
const THREAT_HOLD = 150;

/**
 * Wróg pod kopalnią (jak napad na Starą Kopalnię): górnicy rzucają kilofy i uciekają pod barak (bez baraku — do zamku),
 * a wracają do roboty dopiero, gdy wroga nie ma w pobliżu przez chwilę (workers.ts czeka, dopóki trwa `threat`).
 */
export function mineThreats(g: GameState): void {
  if (MINE_T < 0 || g.tick % 10 !== 0) return;
  const R = THREAT_RANGE * FP;
  for (const b of g.buildings) {
    if (b.type !== MINE_T || !ready(b)) continue;
    const myTeam = g.players[b.owner]?.team ?? -1;
    const [cx, cy] = center(b);
    const mx = cx * FP, my = cy * FP;
    const foe = g.soldiers.some((s) => s.hp > 0 && s.owner !== b.owner && (g.players[s.owner]?.team ?? -2) !== myTeam && Math.max(Math.abs(s.px - mx), Math.abs(s.py - my)) <= R);
    if (!foe) { if (b.threat && g.tick >= b.threat) delete b.threat; continue; }
    b.threat = g.tick + THREAT_HOLD;
    const shelter = campOf(g, b) ?? playerKeep(g, b.owner);
    if (!shelter || shelter.door < 0) continue;
    const w = g.map.width;
    for (const id of b.worker ? [b.worker, ...(b.crew ?? [])] : b.crew ?? []) {
      const u = g.units.find((x) => x.id === id);
      // ucieka ten, kto jest w sztolni albo do niej idzie; niosący urobek dokańczają drogę do składu
      if (!u || (u.phase !== Phase.Working && u.phase !== Phase.Returning)) continue;
      if (u.phase === Phase.Returning && u.path.length && (u.fled ?? 0) > g.tick) continue; // już biegnie w ukrycie
      const from = (u.py >> 8) * w + (u.px >> 8);
      if (from === shelter.door) continue;
      const path = findPath(g, from, (t) => t === shelter.door, 1400, u.owner, shelter.door);
      if (!path || !path.length) continue;
      u.phase = Phase.Returning; u.timer = 0; u.target = 0; u.path = path; u.wait = 0;
      u.fled = g.tick + 400;
    }
  }
}

export function campSystem(g: GameState): void {
  mineThreats(g);
  if (CAMP_T < 0 || g.tick % 5 !== 0) return;
  const camps = g.buildings.filter((b) => b.type === CAMP_T);
  const alive = new Set(camps.filter(ready).map((b) => b.id));
  // barak zburzony albo w ruinie: jego strażnicy dołączają do straży miejskiej, a urobek przepada
  for (const s of g.soldiers) if (s.camp && !alive.has(s.camp)) delete s.camp;
  for (const b of camps) if (!ready(b) && b.hold) delete b.hold;
  for (const b of camps) {
    if (!ready(b) || b.door < 0) continue;
    const p = g.players[b.owner];
    if (!p || p.defeated) continue;
    const mine = g.soldiers.filter((s) => s.camp === b.id && s.hp > 0).sort((a, c) => a.id - c.id);
    // werbunek: wolny chłop z obozowiska idzie na szkolenie (włócznia i żołd jak u straży miejskiej), jeden naraz
    if (b.recruitAt) {
      if (g.tick >= b.recruitAt) {
        b.recruitAt = 0;
        const w = g.map.width, t = posts(g, b)[0]!;
        const s: Soldier = { id: g.nextId++, owner: b.owner, kind: GUARD, px: (t % w) * FP + FP / 2, py: Math.floor(t / w) * FP + FP / 2, path: [], hp: UNITS[GUARD]!.hp, goal: -1, wait: 0, target: 0, cd: 0, camp: b.id };
        g.soldiers.push(s);
        mine.push(s);
      }
    } else if (mine.length < CAMP_GUARDS) {
      const pay = Object.entries(GUARD_COST).every(([r, n]) => p.res[resIndex(r as ResourceId)]! >= n!);
      // nikogo przy ognisku: rekrutem zostaje wolny magazynier (rezerwa, storage.ts)
      if (pay && !g.units.some((u) => u.owner === b.owner && u.job === 0 && u.phase === Phase.Idle && u.carryRes < 0 && !u.path.length)) spareKeeper(g, b.owner);
      const ui = g.units.findIndex((u) => u.owner === b.owner && u.job === 0 && u.phase === Phase.Idle && u.carryRes < 0 && !u.path.length);
      if (ui >= 0 && pay) {
        for (const [r, n] of Object.entries(GUARD_COST)) p.res[resIndex(r as ResourceId)]! -= n!;
        g.units.splice(ui, 1);
        b.recruitAt = g.tick + TRAIN;
      }
    }
    // wóz z urobkiem do zamku, gdy uzbierał się ładunek (albo długo nic nie jechało) i żaden wóz z tego baraku nie jest w drodze
    const total = holdTotal(b);
    const busy = (g.caravans ?? []).some((c) => c.camp === b.id);
    if (!busy && total > 0 && (total >= CART_LOAD || g.tick - (b.cartAt ?? 0) >= CART_EVERY)) {
      const keep = playerKeep(g, b.owner);
      const path = keep ? routeTo(g, b.door, b.owner, b.owner) : null;
      if (path) {
        const items = (b.hold ?? []).map((n, r) => [r, n] as [number, number]).filter(([, n]) => n > 0);
        const [first, ...rest] = items;
        const w = g.map.width, x = b.door % w, y = (b.door - x) / w;
        const escort = mine.map((s) => s.id);
        (g.caravans ??= []).push({ id: g.nextId++, owner: b.owner, to: b.owner, res: first![0], amount: first![1], px: x * FP + FP / 2, py: y * FP + FP / 2, tx: 0, ty: 0, path: path.reverse(), more: rest, camp: b.id, escort });
        b.hold = new Array(RESOURCES.length).fill(0);
        b.cartAt = g.tick;
      }
    }
    // strażnicy bez zadania (nie eskortują, nie walczą): stoją przy drzwiach baraku
    const escorting = new Set<number>();
    for (const c of g.caravans ?? []) if (c.camp === b.id) for (const e of c.escort ?? []) escorting.add(e);
    const stand = posts(g, b);
    mine.forEach((s, i) => {
      if (escorting.has(s.id) || s.target || s.path.length || s.goal >= 0 || s.hunt) return;
      const t = stand[i % stand.length]!;
      const here = (s.py >> 8) * g.map.width + (s.px >> 8);
      s.stance = 1; s.hold = t; s.amove = false;
      if (here !== t) s.goal = t;
    });
  }
}

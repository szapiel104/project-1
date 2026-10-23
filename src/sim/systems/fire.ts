import { buildingById } from '../state';
import { BUILDINGS, buildingIndex, footprint } from '../../data/buildings';
import { findPath, walkable } from '../path';
import { FP, Phase, type Building, type GameState, type Unit } from '../state';
import { maxHp } from './placement';

/**
 * Pożary i gaszenie.
 * Budynek mocno uszkodzony świeżym ciosem (poniżej 60% wytrzymałości) zajmuje się ogniem. Płonący traci powoli
 * wytrzymałość (ale ogień sam go nie zburzy: zostawia 15%), a pożar gaśnie sam po minucie, chyba że wróg dalej bije.
 * Ludzie gaszą: wolni chłopi (i inżynier z cechu) biegną do najbliższej studni — studnia albo podwórze cechu
 * inżynierów — czerpią wodę, niosą wiadro do ognia i wylewają; każde wiadro skraca pożar. Potem inżynier naprawia.
 */
const WELL = buildingIndex('well');
const ENGINEERS = buildingIndex('engineers');
/** Tyle ticków płonie świeżo podpalony budynek (bez gaszenia) */
const BURN = 600;
/** Każde wiadro wody skraca pożar o tyle ticków */
const SPLASH = 160;
/** Najwyżej tylu ludzi gasi jeden pożar */
const CREW = 4;
/** Studnia dalej niż tyle pól od pożaru się nie przyda */
const WELL_RANGE = 40;
/** Czerpanie wody i wylanie trwa po tyle ticków */
export const DRAW = 15;

const tileOf = (g: GameState, u: { px: number; py: number }): number => (u.py >> 8) * g.map.width + (u.px >> 8);
const center = (b: Building): [number, number] => { const fp = footprint(BUILDINGS[b.type]!, b.rot); return [b.x + fp.w / 2, b.y + fp.h / 2]; };
/** Pola przy ścianie budynku (sąsiadujące z działką) — tam staje człowiek z wiadrem albo przy studni */
function beside(g: GameState, b: Building): (t: number) => boolean {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width;
  return (t) => {
    const x = t % w, y = (t - x) / w;
    const dx = Math.max(b.x - x, 0, x - (b.x + fp.w - 1)), dy = Math.max(b.y - y, 0, y - (b.y + fp.h - 1));
    return Math.max(dx, dy) === 1;
  };
}
function nearestWell(g: GameState, owner: number, fire: Building): Building | undefined {
  const [fx, fy] = center(fire);
  let best: Building | undefined, bd = WELL_RANGE * WELL_RANGE;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.build || b.ruined || (b.type !== WELL && b.type !== ENGINEERS)) continue;
    const [x, y] = center(b), d = (x - fx) ** 2 + (y - fy) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
/** Miejsce dla gaszącego przy `goal`: wolne pola wokół, najbliższe `other` (drugiemu końcowi trasy), kolejne osoby obok siebie */
function slotFor(g: GameState, u: Unit, goal: Building, other: Building): number {
  const fp = footprint(BUILDINGS[goal.type]!, goal.rot), w = g.map.width, h = g.map.height;
  const [ox, oy] = center(other);
  const tiles: number[] = [];
  for (let y = goal.y - 1; y <= goal.y + fp.h; y++) for (let x = goal.x - 1; x <= goal.x + fp.w; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (x >= goal.x && x < goal.x + fp.w && y >= goal.y && y < goal.y + fp.h) continue;
    const t = y * w + x;
    if (walkable(g, t, u.owner)) tiles.push(t);
  }
  if (!tiles.length) return -1;
  const d = (t: number): number => { const x = t % w, y = (t - x) / w; return (x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2; };
  tiles.sort((a, b) => d(a) - d(b) || a - b);
  const crew = g.units.filter((x) => x.bucket && x.fireAt === u.fireAt && (x.bucket === 1 ? x.target : x.fireAt) === goal.id && x.bucket === u.bucket).map((x) => x.id).sort((a, b) => a - b);
  const rank = Math.max(0, crew.indexOf(u.id));
  return tiles[rank % tiles.length]!;
}
function release(u: Unit): void {
  u.bucket = 0; u.fireAt = 0; u.target = 0; u.path = []; u.timer = 0;
  u.phase = u.job ? Phase.Returning : Phase.Idle;
}

export function fireSystem(g: GameState): void {
  // zapłon i palenie się
  for (const b of g.buildings) {
    const max = maxHp(b.type), def = BUILDINGS[b.type]!;
    const hit = b.hpWas !== undefined && b.hp < b.hpWas;
    b.hpWas = b.hp;
    if (def.road || b.build || b.ruined || b.type === WELL) { b.fire = 0; continue; }
    if (hit && b.hp < max * 0.6) b.fire = Math.max(b.fire ?? 0, BURN);
    if (!b.fire) continue;
    b.fire--;
    if (g.tick % 10 === 0 && b.hp > max * 0.15) { b.hp = Math.max(Math.ceil(max * 0.15), b.hp - 1); b.hpWas = b.hp; } // to nie cios wroga: nie rozpala ognia na nowo
  }
  if (g.tick % 5 === 0) {
    // kto gasi: do każdego pożaru najwyżej CREW ludzi, najpierw wolni chłopi, potem inżynier z cechu
    for (const b of g.buildings) {
      if (!b.fire) continue;
      const well = nearestWell(g, b.owner, b);
      if (!well) continue;
      const busy = g.units.filter((u) => u.bucket && u.fireAt === b.id).length;
      if (busy >= CREW) continue;
      const [fx, fy] = center(b);
      const cands = g.units.filter((u) => u.owner === b.owner && !u.bucket && !u.enlist && !u.riot && u.carryRes < 0 && u.phase !== Phase.Sleeping && u.phase !== Phase.ToSleep
        && (u.job === 0 ? u.phase === Phase.Idle || u.phase === Phase.Evening || u.phase === Phase.ToEvening : buildingById(g, u.job)?.type === ENGINEERS)
        && Math.hypot(u.px / FP - fx, u.py / FP - fy) < 30);
      cands.sort((a, c) => Math.hypot(a.px / FP - fx, a.py / FP - fy) - Math.hypot(c.px / FP - fx, c.py / FP - fy));
      for (const u of cands.slice(0, CREW - busy)) { u.bucket = 1; u.fireAt = b.id; u.target = well.id; u.path = []; u.timer = 0; u.wait = 0; }
    }
  }
  // biegną do studni, czerpią, niosą, wylewają, wracają po następne wiadro, aż ogień zgaśnie
  for (const u of g.units) {
    if (!u.bucket) continue;
    const fire = buildingById(g, u.fireAt);
    if (!fire || !fire.fire) { release(u); continue; }
    if (u.wait > 0) continue;
    if (u.path.length) continue; // krok robi system ludzi
    const goal = u.bucket === 1 ? buildingById(g, u.target) : fire;
    if (!goal) { release(u); continue; }
    // każdy z ekipy ma własne miejsce: pola przy studni / przy ogniu od strony drugiego końca, po kolei wg id
    const other = u.bucket === 1 ? fire : buildingById(g, u.target) ?? fire;
    const slot = slotFor(g, u, goal, other);
    const here = tileOf(g, u);
    const at = beside(g, goal);
    if (slot >= 0 ? here !== slot : !at(here)) {
      const path = (slot >= 0 ? findPath(g, here, (t) => t === slot, 3000, u.owner, slot) : undefined) ?? findPath(g, here, at, 3000, u.owner);
      if (!path || !path.length) { if (at(here)) { u.path = []; } else { release(u); continue; } }
      else { u.path = path; continue; }
    }
    // na miejscu: chwila przy studni (czerpie) albo przy ogniu (wylewa)
    if (++u.timer < DRAW) continue;
    u.timer = 0;
    if (u.bucket === 1) { u.bucket = 2; continue; }
    fire.fire = Math.max(0, (fire.fire ?? 0) - SPLASH);
    u.bucket = 1;
    const well = nearestWell(g, u.owner, fire);
    if (!well) { release(u); continue; }
    u.target = well.id;
  }
}

import { BUILDINGS } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { GUARD, UNITS } from '../../data/units';
import { walkable } from '../path';
import { FP, keepCenter, keepFront, Phase, playerKeep, type GameState, type Soldier } from '../state';
import { dayPart } from './workers';

/** Ilu strażników miejskich pilnuje osady */
export const GUARDS = 6;
/** Ile ticków trwa szkolenie rekruta straży w twierdzy (ok. półtorej minuty przy tempie 1×) */
export const GUARD_TRAIN_TICKS = 900;
/** Co kosztuje uzbrojenie rekruta (jak włócznika): włócznia ze składu i żołd */
export const GUARD_COST: Partial<Record<ResourceId, number>> = { spear: 1, gold: 8 };
/** W tej odległości od twierdzy wróg albo wilk wstrzymuje werbunek i szkolenie */
const DANGER = 14;

/** Wróg (żołnierz innej drużyny) albo wilk blisko twierdzy */
function danger(g: GameState, owner: number, keep: { x: number; y: number }): boolean {
  const team = g.players[owner]?.team;
  const [kx, ky] = keepCenter(keep);
  const near = (px: number, py: number): boolean => Math.max(Math.abs((px >> 8) - kx), Math.abs((py >> 8) - ky)) <= DANGER;
  for (const s of g.soldiers) if (s.hp > 0 && g.players[s.owner]?.team !== team && near(s.px, s.py)) return true;
  for (const w of g.wolves) if (w.hp > 0 && !w.leaving && near(w.px, w.py)) return true;
  return false;
}

/** Najbliższe wolne pole, po którym da się chodzić (szukanie po coraz większych kwadratach) */
function snap(g: GameState, owner: number, x: number, y: number): number {
  const { width: w, height: h } = g.map;
  for (let r = 0; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx, ty = Math.round(y) + dy;
        if (tx < 1 || ty < 1 || tx >= w - 1 || ty >= h - 1) continue;
        const t = ty * w + tx;
        if (g.occupancy[t] === 0 && walkable(g, t, owner)) return t;
      }
  return -1;
}

/** Na tyle pól za ostatnie zabudowania strażnik może gonić wroga; dalej zawraca na obchód */
export const GUARD_LEASH = 6;

/** Prostokąt osady: wszystkie budynki gracza i pole zapasu dookoła */
function townRect(g: GameState, owner: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.ruined) continue;
    const d = BUILDINGS[b.type]!;
    const w = b.rot % 2 ? d.h : d.w, h = b.rot % 2 ? d.w : d.h;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + w); y1 = Math.max(y1, b.y + h);
  }
  return x0 === Infinity ? null : { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
}

/** Trasa obchodu: osiem punktów na obwodzie osady (prostokąt wokół budynków gracza, pole dalej) */
function beatRoute(g: GameState, owner: number): number[] {
  const r = townRect(g, owner);
  if (!r) return [];
  const { x0, y0, x1, y1 } = r;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const pts: [number, number][] = [[x0, y0], [mx, y0], [x1, y0], [x1, my], [x1, y1], [mx, y1], [x0, y1], [x0, my]];
  return pts.map(([x, y]) => snap(g, owner, x, y)).filter((t) => t >= 0);
}

/** Posterunki za dnia: po bokach drzwi twierdzy, dalej od niej o kilka pól */
function posts(g: GameState, owner: number): number[] {
  const keep = playerKeep(g, owner);
  if (!keep) return [];
  const [dx, dy] = keepFront(keep);
  return [[-1, 0], [1, 0], [-2, 1], [2, 1]].map(([ox, oy]) => snap(g, owner, dx + ox!, dy + oy!)).filter((t) => t >= 0);
}

const newGuard = (g: GameState, owner: number, px: number, py: number): Soldier =>
  ({ id: g.nextId++, owner, kind: GUARD, px, py, path: [], hp: UNITS[GUARD]!.hp, goal: -1, wait: 0, target: 0, cd: 0, beat: 0 });

/**
 * Straż miejska jak w Gothicu: sześciu strażników z zamku. Za dnia dwóch stoi przy bramie twierdzy,
 * reszta obchodzi osadę; wieczorem i nocą obchodzą ją wszyscy (z pochodniami), po drodze biją wilki i wrogów.
 * Gdy strażnik zginie, po chwili jego miejsce zajmuje wolny chłop z obozowiska.
 */
export function guardSystem(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const part = dayPart(g.tick);
  for (const p of g.players) {
    if (p.defeated) continue;
    const keep = playerKeep(g, p.id);
    if (!keep) continue;
    const mine = g.soldiers.filter((s) => s.owner === p.id && s.kind === GUARD).sort((a, b) => a.id - b.id);
    // pierwsza straż przychodzi z zamku za darmo
    if (p.guards === undefined) {
      p.guards = GUARDS;
      const w = g.map.width, [kx, ky] = keepFront(keep);
      for (let i = mine.length; i < p.guards; i++) {
        const t = snap(g, p.id, kx + (i % 3) - 1, ky + 1 + Math.floor(i / 3));
        if (t < 0) break;
        const s = newGuard(g, p.id, (t % w) * FP + FP / 2, Math.floor(t / w) * FP + FP / 2);
        s.beat = i;
        g.soldiers.push(s);
        mine.push(s);
      }
    }
    // poległego zastępuje rekrut: wolny chłop idzie do twierdzy, dostaje włócznię i żołd, szkoli się półtorej minuty.
    // Jeden naraz; przy wrogu albo wilku pod zamkiem werbunek stoi, a szkolenie się przeciąga.
    const threat = danger(g, p.id, keep);
    if (p.guardReady) {
      if (threat) p.guardReady++;
      else if (g.tick >= p.guardReady) {
        p.guardReady = 0;
        const w = g.map.width, [fx, fy] = keepFront(keep), t = snap(g, p.id, fx, fy);
        if (t >= 0) {
          const s = newGuard(g, p.id, (t % w) * FP + FP / 2, Math.floor(t / w) * FP + FP / 2);
          s.beat = mine.length;
          g.soldiers.push(s);
          mine.push(s);
        }
      }
    } else if (mine.length < p.guards && part === 'work' && !threat) {
      const ui = g.units.findIndex((u) => u.owner === p.id && u.job === 0 && u.phase === Phase.Idle && u.carryRes < 0 && !u.path.length);
      const pay = Object.entries(GUARD_COST).every(([r, n]) => p.res[resIndex(r as ResourceId)]! >= n!);
      if (ui >= 0 && pay) {
        for (const [r, n] of Object.entries(GUARD_COST)) p.res[resIndex(r as ResourceId)]! -= n!;
        g.units.splice(ui, 1); // rekrut jest w twierdzy na szkoleniu
        p.guardReady = g.tick + GUARD_TRAIN_TICKS;
      }
    }
    if (!mine.length) continue;
    const route = beatRoute(g, p.id);
    const stand = posts(g, p.id);
    const town = townRect(g, p.id);
    mine.forEach((s, i) => {
      // za daleko od osady (pogoń za wilkiem albo wrogiem): rzuca pościg i wraca na najbliższy punkt obchodu
      if (town && route.length) {
        const sx = s.px >> 8, sy = s.py >> 8;
        const out = Math.max(town.x0 - sx, 0, sx - town.x1, town.y0 - sy, 0, sy - town.y1);
        if (out > GUARD_LEASH) {
          const w = g.map.width;
          let best = route[0]!, bd = Infinity;
          for (const t of route) { const d = Math.abs((t % w) - sx) + Math.abs(Math.floor(t / w) - sy); if (d < bd) { bd = d; best = t; } }
          if (s.goal !== best) { s.target = 0; s.hunt = 0; s.prey = 0; s.amove = false; s.stance = 0; s.hold = -1; s.goal = best; s.path = []; }
          return;
        }
      }
      // w walce albo w drodze: nie przeszkadzamy
      if (s.target || s.path.length || s.goal >= 0 || s.hunt) return;
      const here = (s.py >> 8) * g.map.width + (s.px >> 8);
      // za dnia tylko dwóch stoi przy bramie twierdzy, reszta obchodzi osadę (nocą obchodzą wszyscy)
      const onPost = part === 'work' && i < 2 && stand.length;
      if (onPost) {
        const t = stand[i % stand.length]!;
        s.stance = 1; s.hold = t; s.amove = false;
        if (here !== t) s.goal = t;
        return;
      }
      if (!route.length) return;
      // obchód: kolejny punkt na obwodzie; każdy zaczyna od innego, idą w tę samą stronę
      s.stance = 0; s.hold = -1; s.amove = true;
      const k = ((s.beat ?? i) + 1) % route.length;
      s.beat = k;
      s.goal = route[k]!;
    });
  }
}

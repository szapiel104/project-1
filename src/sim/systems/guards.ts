import { BUILDINGS } from '../../data/buildings';
import { GUARD, UNITS } from '../../data/units';
import { walkable } from '../path';
import { FP, Phase, playerKeep, type GameState, type Soldier } from '../state';
import { dayPart } from './workers';

/** Ilu strażników miejskich pilnuje osady */
export const GUARDS = 6;
/** Co ile ticków wolny chłop może zostać nowym strażnikiem w miejsce poległego */
const REPLACE_TICKS = 300;

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

/** Trasa obchodu: osiem punktów na obwodzie osady (prostokąt wokół budynków gracza, pole dalej) */
function beatRoute(g: GameState, owner: number): number[] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.ruined) continue;
    const d = BUILDINGS[b.type]!;
    const w = b.rot % 2 ? d.h : d.w, h = b.rot % 2 ? d.w : d.h;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + w); y1 = Math.max(y1, b.y + h);
  }
  if (x0 === Infinity) return [];
  x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const pts: [number, number][] = [[x0, y0], [mx, y0], [x1, y0], [x1, my], [x1, y1], [mx, y1], [x0, y1], [x0, my]];
  return pts.map(([x, y]) => snap(g, owner, x, y)).filter((t) => t >= 0);
}

/** Posterunki za dnia: po bokach drzwi twierdzy, dalej od niej o kilka pól */
function posts(g: GameState, owner: number): number[] {
  const keep = playerKeep(g, owner);
  if (!keep || keep.door < 0) return [];
  const w = g.map.width, dx = keep.door % w, dy = Math.floor(keep.door / w);
  return [[-1, 1], [1, 1], [-2, 2], [2, 2]].map(([ox, oy]) => snap(g, owner, dx + ox!, dy + oy!)).filter((t) => t >= 0);
}

const newGuard = (g: GameState, owner: number, px: number, py: number): Soldier =>
  ({ id: g.nextId++, owner, kind: GUARD, px, py, path: [], hp: UNITS[GUARD]!.hp, goal: -1, wait: 0, target: 0, cd: 0, beat: 0 });

/**
 * Straż miejska jak w Gothicu: sześciu strażników z zamku. Za dnia połowa stoi na posterunkach przy twierdzy,
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
      const w = g.map.width, kx = keep.door >= 0 ? keep.door % w : keep.x + 1, ky = keep.door >= 0 ? Math.floor(keep.door / w) : keep.y + 3;
      for (let i = mine.length; i < p.guards; i++) {
        const t = snap(g, p.id, kx + (i % 3) - 1, ky + 1 + Math.floor(i / 3));
        if (t < 0) break;
        const s = newGuard(g, p.id, (t % w) * FP + FP / 2, Math.floor(t / w) * FP + FP / 2);
        s.beat = i;
        g.soldiers.push(s);
        mine.push(s);
      }
    }
    // poległego zastępuje wolny chłop (za dnia, nie częściej niż co kilkadziesiąt sekund)
    if (mine.length < p.guards && part === 'work' && g.tick % REPLACE_TICKS === 0) {
      const ui = g.units.findIndex((u) => u.owner === p.id && u.job === 0 && u.phase === Phase.Idle && u.carryRes < 0 && !u.path.length);
      if (ui >= 0) {
        const u = g.units[ui]!;
        g.units.splice(ui, 1);
        const s = newGuard(g, p.id, u.px, u.py);
        s.beat = mine.length;
        g.soldiers.push(s);
        mine.push(s);
      }
    }
    if (!mine.length) continue;
    const route = beatRoute(g, p.id);
    const stand = posts(g, p.id);
    mine.forEach((s, i) => {
      // w walce albo w drodze: nie przeszkadzamy
      if (s.target || s.path.length || s.goal >= 0 || s.hunt) return;
      const here = (s.py >> 8) * g.map.width + (s.px >> 8);
      const onPost = part === 'work' && i % 2 === 0 && stand.length;
      if (onPost) {
        const t = stand[(i >> 1) % stand.length]!;
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

/**
 * Dzika zwierzyna w symulacji (Michał 12.11.2026: myśliwy poluje na zwierzęta i przynosi mięso).
 *
 * Wcześniej jelenie, dziki, lisy i zające żyły tylko w obrazie (render/fauna.ts). Żeby myśliwy mógł na nie polować tak samo
 * u wszystkich graczy, stada są teraz częścią stanu gry: rodzą się z ziarna mapy przy pierwszym ticku, pasą się wokół
 * swojego miejsca, uciekają przed ludźmi i żołnierzami, a ubite znikają i z czasem nowe przychodzą z krańców mapy. Obraz tylko je rysuje.
 *
 * Losowanie z własnego skrótu (ziarno mapy, id zwierzęcia, tick) — główne `g.rng` zostaje nietknięte.
 */
import { Terrain } from '../../data/terrain';
import { FP, type Beast, type GameState } from '../state';

/** Gatunki zwierzyny (indeks = Beast.sp; ta sama kolejność w render/fauna.ts) */
export const GAME_SPECIES = ['deer', 'boar', 'rabbit', 'fox', 'camel'] as const;
export type GameSpecies = typeof GAME_SPECIES[number];
/** Mięso z ubitej sztuki, oprawiane w chacie partiami po 4 (lis i wielbłąd: nie poluje się na nie) */
export const GAME_MEAT: Record<GameSpecies, number> = { deer: 12, boar: 16, rabbit: 4, fox: 0, camel: 0 };
/** Skóry z ubitej sztuki (zając za mały na skórę do składu) */
export const GAME_HIDE: Record<GameSpecies, number> = { deer: 2, boar: 1, rabbit: 0, fox: 0, camel: 0 };
/** stada: [gatunek, ile stad, najmniej, najwięcej] na krainę */
const HERDS: Record<string, [GameSpecies, number, number, number][]> = {
  desert: [['camel', 7, 2, 4], ['fox', 2, 1, 1]],
  meadow: [['deer', 9, 3, 6], ['boar', 5, 2, 4], ['fox', 4, 1, 1], ['rabbit', 7, 1, 3]],
  highland: [['deer', 8, 2, 5], ['boar', 5, 2, 4], ['fox', 3, 1, 1], ['rabbit', 4, 1, 2]],
  steppe: [['deer', 5, 2, 4], ['fox', 4, 1, 1], ['rabbit', 8, 1, 3]],
  north: [['deer', 4, 2, 3], ['fox', 3, 1, 1], ['rabbit', 3, 1, 2]],
};
/** Ucieczka przed ludźmi (pola); myśliwy podchodzi bliżej, zanim zwierzę go zauważy */
const FLEE = 6, FLEE_HUNTER = 2.5;
/** Prędkość w polach na tick (10 ticków na sekundę): marsz i ucieczka */
const WALK: Record<GameSpecies, number> = { deer: 0.07, boar: 0.045, rabbit: 0.035, fox: 0.06, camel: 0.055 };
const RUN: Record<GameSpecies, number> = { deer: 0.34, boar: 0.28, rabbit: 0.4, fox: 0.36, camel: 0.26 };
/** Jak daleko od chaty myśliwy szuka zwierzyny (pola) */
export const HUNT_RANGE = 40;
/** Ubita sztuka leży tyle ticków (myśliwy ją oprawia), potem znika */
export const CARCASS_TICKS = 600;
/** Co tyle ticków stado może dostać nową sztukę, gdy jest mniejsze niż na początku */
const REGROW_TICKS = 1800;

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Czy zwierzę może stanąć na polu (trawa; jeleń, dzik i lis także las; bez budynków) */
export function beastCan(g: GameState, sp: number, x: number, y: number): boolean {
  const { width, height } = g.map;
  if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
  const t = (y | 0) * width + (x | 0), tile = g.map.tiles[t];
  if (g.occupancy[t] !== 0) return false;
  const s = GAME_SPECIES[sp]!;
  return tile === Terrain.Grass || ((s === 'deer' || s === 'boar' || s === 'fox') && tile === Terrain.Forest);
}

function spawn(g: GameState): void {
  const { width, height } = g.map, seed = g.map.seed >>> 0;
  const keeps = g.buildings.filter((b) => b.type === 0 || b.door >= 0).map((b) => [b.x, b.y]);
  let n = 0;
  for (const [sp, herds, lo, hi] of HERDS[g.map.biome ?? 'meadow'] ?? []) {
    const spi = GAME_SPECIES.indexOf(sp);
    for (let k = 0; k < herds; k++) {
      // miejsce stada: losowe pole, daleko od osad (18 pól), na swoim terenie
      for (let tries = 0; tries < 60; tries++) {
        const hx = 4 + hash(seed, n, tries * 2) * (width - 8), hy = 4 + hash(seed, n, tries * 2 + 1) * (height - 8);
        if (!beastCan(g, spi, hx, hy) || keeps.some(([x, y]) => (x! - hx) ** 2 + (y! - hy) ** 2 < 18 * 18)) continue;
        const cnt = lo + Math.floor(hash(seed, n, 999) * (hi - lo + 1));
        const herd = n;
        for (let i = 0; i < cnt; i++) {
          const x = hx + (hash(seed, n, 100 + i) - 0.5) * 3, y = hy + (hash(seed, n, 200 + i) - 0.5) * 3;
          if (beastCan(g, spi, x, y)) g.beasts!.push({ id: g.nextId++, sp: spi, herd, px: Math.round(x * FP), py: Math.round(y * FP), hx: Math.round(hx * FP), hy: Math.round(hy * FP), hp: 1, tx: Math.round(x * FP), ty: Math.round(y * FP), state: 0, until: 0, size: cnt });
        }
        break;
      }
      n++;
    }
  }
}

export function wildGameSystem(g: GameState): void {
  if (!g.beasts) { g.beasts = []; spawn(g); }
  const list = g.beasts;
  if (!list.length) return;
  const tick = g.tick, seed = g.map.seed >>> 0;
  // ludzie na mapie (pola): chłopi, żołnierze, wędrowcy — myśliwi przy pracy liczą się z mniejszym zasięgiem
  const people: [number, number, number][] = [];
  for (const u of g.units) people.push([u.px / FP, u.py / FP, u.hunting ? FLEE_HUNTER : FLEE]);
  for (const s of g.soldiers) people.push([s.px / FP, s.py / FP, FLEE]);
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]!;
    // truchło znika po CARCASS_TICKS, ale wpis zostaje: pamięta stado, więc wybite do nogi stado też się odrodzi
    if (b.hp <= 0) { if (!b.gone && tick - (b.dead ?? tick) > CARCASS_TICKS) b.gone = 1; continue; }
    const sp = GAME_SPECIES[b.sp]!;
    const x = b.px / FP, y = b.py / FP;
    // najbliższy człowiek w zasięgu: ucieczka w przeciwną stronę
    let fx = 0, fy = 0, scared = false;
    for (const [px, py, r] of people) {
      const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
      if (d2 < r * r) { const d = Math.sqrt(d2) || 0.01; fx += dx / d; fy += dy / d; scared = true; }
    }
    if (scared) {
      const l = Math.hypot(fx, fy) || 1;
      b.tx = Math.round((x + (fx / l) * 8) * FP); b.ty = Math.round((y + (fy / l) * 8) * FP);
      b.state = 2; b.until = tick + 40;
    } else if (tick >= b.until) {
      // na zmianę: pasie się w miejscu albo idzie kawałek, nie dalej niż 7 pól od miejsca stada
      const r = hash(seed, b.id, tick);
      if (b.state !== 0 || r < 0.5) { b.state = 0; b.until = tick + 60 + Math.floor(hash(seed, b.id, tick + 1) * 140); }
      else {
        const a = hash(seed, b.id, tick + 2) * Math.PI * 2, d = 1 + hash(seed, b.id, tick + 3) * 6;
        b.tx = Math.round((b.hx / FP + Math.cos(a) * d) * FP); b.ty = Math.round((b.hy / FP + Math.sin(a) * d) * FP);
        b.state = 1; b.until = tick + 200;
      }
    }
    if (b.state === 0) continue;
    const dx = b.tx / FP - x, dy = b.ty / FP - y, d = Math.hypot(dx, dy);
    const v = b.state === 2 ? RUN[sp] : WALK[sp];
    if (d < v) { if (b.state === 1) { b.state = 0; b.until = tick + 60; } continue; }
    const nx = x + (dx / d) * v, ny = y + (dy / d) * v;
    if (beastCan(g, b.sp, nx, ny)) { b.px = Math.round(nx * FP); b.py = Math.round(ny * FP); }
    else if (beastCan(g, b.sp, nx, y)) b.px = Math.round(nx * FP);
    else if (beastCan(g, b.sp, x, ny)) b.py = Math.round(ny * FP);
    else {
      // przeszkoda (woda, budynek, skała): krok w bok i po chwili znów w stronę stada — tak obchodzi zawady po drodze z krańca mapy
      const a = Math.atan2(dy, dx) + (hash(seed, b.id, tick + 5) < 0.5 ? 1 : -1) * Math.PI / 2;
      b.tx = Math.round((x + Math.cos(a) * 4) * FP); b.ty = Math.round((y + Math.sin(a) * 4) * FP);
      b.state = 1; b.until = tick + 40;
    }
  }
  // nowe sztuki (Michał 12.11.2026: „nie z niczego, tylko z mapy przychodzą”): co REGROW_TICKS każde przetrzebione stado
  // dostaje jedną sztukę, która wchodzi z najbliższego skraju mapy i idzie do swojego stada
  if (tick % REGROW_TICKS === 0 && tick > 0) {
    const done = new Set<number>();
    for (const b of list) {
      if (!b.gone || done.has(b.herd)) continue;
      done.add(b.herd);
      const at = entry(g, b, tick);
      if (!at) continue;
      const [ex, ey] = at, d = Math.hypot(b.hx / FP - ex, b.hy / FP - ey);
      // nowe id: obraz traktuje ją jak nowe zwierzę (bez upadku i doganiania starego miejsca)
      Object.assign(b, { id: g.nextId++, px: Math.round(ex * FP), py: Math.round(ey * FP), tx: b.hx, ty: b.hy, state: 1, until: tick + Math.ceil(d / WALK[GAME_SPECIES[b.sp]!]) + 100, hp: 1, dead: undefined, gone: undefined });
    }
  }
}

/**
 * Skąd przychodzi nowa sztuka: z czterech skrajów mapy na wysokości stada (najbliższy pierwszy, z lekkim rozrzutem)
 * idziemy od krawędzi do środka, aż trafimy na pole, po którym zwierzę może chodzić (na krańcach zwykle są góry).
 */
function entry(g: GameState, b: Beast, tick: number): [number, number] | null {
  const { width: W, height: H } = g.map, seed = g.map.seed >>> 0;
  const hx = b.hx / FP, hy = b.hy / FP;
  const jx = (hash(seed, b.herd, tick) - 0.5) * 16, jy = (hash(seed, b.herd, tick + 7) - 0.5) * 16;
  const clampY = (v: number): number => Math.min(H - 3, Math.max(2, v)), clampX = (v: number): number => Math.min(W - 3, Math.max(2, v));
  // [start x, start y, krok x, krok y, odległość skraju od stada]
  const sides: [number, number, number, number, number][] = [
    [1.5, clampY(hy + jy), 1, 0, hx], [W - 1.5, clampY(hy + jy), -1, 0, W - hx],
    [clampX(hx + jx), 1.5, 0, 1, hy], [clampX(hx + jx), H - 1.5, 0, -1, H - hy],
  ];
  sides.sort((p, q) => p[4] - q[4]);
  for (const [sx, sy, dx, dy, dist] of sides)
    for (let k = 0; k < Math.min(60, dist); k++) {
      const x = sx + dx * k, y = sy + dy * k;
      if (beastCan(g, b.sp, x, y)) return [x, y];
    }
  return null;
}

/** Najbliższa żywa zwierzyna z mięsem w zasięgu (pola) od punktu; nie ta, na którą już poluje inny myśliwy */
export function nearestGame(g: GameState, x: number, y: number, range: number, except = 0): Beast | undefined {
  let best: Beast | undefined, bd = range * range;
  const taken = new Set<number>();
  for (const u of g.units) if (u.hunting && u.hunting !== except) taken.add(u.hunting);
  for (const b of g.beasts ?? []) {
    if (b.hp <= 0 || GAME_MEAT[GAME_SPECIES[b.sp]!] <= 0 || taken.has(b.id)) continue;
    const d = (b.px / FP - x) ** 2 + (b.py / FP - y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

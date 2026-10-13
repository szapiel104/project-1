import { buildingIndex } from '../../data/buildings';
import { type ResourceId, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { UNITS, unitIndex } from '../../data/units';
import { findPath, walkable } from '../path';
import { hash2 } from '../rng';
import { FP, Phase, type Building, type Corpse, type GameState, type March, type Soldier, type Unit } from '../state';
import { BUILDINGS, footprint, workArea } from '../../data/buildings';
import { buildWork, enemyNear, maxHp, restore, ruin } from './placement';
import { dayPart } from './workers';
import { RESOURCES, RESOURCE_DEFS } from '../../data/resources';
import type { UnitDef } from '../../data/units';

const BARRACKS = buildingIndex('barracks');
const RETRY = 15;
/** Ilu żołnierzy można poprowadzić jednym rozkazem (ochrona przed złośliwą komendą z sieci) */
const MAX_ORDER = 200;

/** Kolejne pola wokół punktu, od najbliższych: tak ustawia się oddział, żeby nie stali jeden na drugim. */
const SPIRAL: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r <= 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push([dx, dy]);
  // w obrębie pierścienia najpierw bliżej środka (odległość euklidesowa), remis rozstrzyga kolejność wpisu
  return out.map((p, i) => [p, i] as const).sort((a, b) => a[0][0] ** 2 + a[0][1] ** 2 - (b[0][0] ** 2 + b[0][1] ** 2) || a[1] - b[1]).map(([p]) => p);
})();

/** Wolne pola wokół celu dla `count` żołnierzy (deterministycznie). */
function formation(g: GameState, center: number, count: number): number[] {
  const w = g.map.width, h = g.map.height;
  const cx = center % w, cy = (center - cx) / w;
  const out: number[] = [];
  for (const [dx, dy] of SPIRAL) {
    if (out.length >= count) break;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const t = y * w + x;
    if (walkable(g, t)) out.push(t);
  }
  return out;
}

/** Szkolenie: wolny chłop dostaje broń ze składu i za złoto staje się żołnierzem przy koszarach. */
export function train(g: GameState, player: number, barracksId: number, unit: string): boolean {
  const kind = unitIndex(unit);
  const def = UNITS[kind];
  const p = g.players[player];
  const b = g.buildings.find((x) => x.id === barracksId);
  if (!def || def.guard || !p || !b || b.owner !== player || b.type !== BARRACKS || b.door < 0) return false;
  for (const [res, amount] of Object.entries(def.cost)) if (p.res[resIndex(res as ResourceId)]! < amount!) return false;
  const pi = g.units.findIndex((u) => u.owner === player && u.job === 0);
  if (pi < 0) return false;
  for (const [res, amount] of Object.entries(def.cost)) p.res[resIndex(res as ResourceId)]! -= amount!;
  g.units.splice(pi, 1);
  const w = g.map.width;
  const x = b.door % w, y = (b.door - x) / w;
  // nowi żołnierze ustawiają się w szyku przed koszarami
  const here = g.soldiers.filter((s) => s.owner === player).length;
  const spots = formation(g, b.door, here % 25 + 1);
  const s: Soldier = { id: g.nextId++, owner: player, kind, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: def.hp, goal: spots[spots.length - 1] ?? -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  p.stats.trained++;
  return true;
}

/** Rozkaz ataku: zaznaczeni idą na wskazanego wroga (żołnierza albo budynek). */
export function orderAttack(g: GameState, player: number, ids: readonly number[], target: number): void {
  // wrogi chłop: żołnierze gonią go, aż padnie albo schowa się na dobre
  const peasant = g.units.find((u) => u.id === target);
  if (peasant) {
    if (team(g, peasant.owner) === team(g, player)) return;
    for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.prey = peasant.id; s.target = 0; s.goal = -1; s.path = []; s.wait = 0; s.hold = -1; s.amove = false; s.slot = undefined; s.wounded = 0; }
    return;
  }
  const wolf = g.wolves.find((w) => w.id === target);
  if (wolf) {
    // polowanie na wilka: idą za nim, aż go dopadną albo ucieknie do lasu
    for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.hunt = wolf.id; s.target = 0; s.goal = (wolf.py >> 8) * g.map.width + (wolf.px >> 8); s.path = []; s.wait = 0; s.slot = undefined; s.wounded = 0; }
    return;
  }
  const foeSoldier = g.soldiers.find((s) => s.id === target);
  const foeBuilding = foeSoldier ? undefined : g.buildings.find((b) => b.id === target);
  const owner = foeSoldier?.owner ?? foeBuilding?.owner;
  if (owner === undefined || team(g, owner) === team(g, player)) return;
  for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.target = target; s.goal = -1; s.path = []; s.wait = 0; s.hold = -1; s.slot = undefined; s.wounded = 0; }
}

/** Kierunki szyku co 45°: 0 = twarzą na +y, dalej tak jak kąt obrotu figur (kąt = numer × 45°) */
export const DIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

/** Najbliższy z 8 kierunków dla wektora (same liczby całkowite, bez sin/cos — wynik taki sam w każdej przeglądarce); -1 dla zera */
export function octant(dx: number, dy: number): number {
  if (!dx && !dy) return -1;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax * 5 < ay * 2) return dy > 0 ? 0 : 4;
  if (ay * 5 < ax * 2) return dx > 0 ? 2 : 6;
  if (dx > 0) return dy > 0 ? 1 : 3;
  return dy > 0 ? 7 : 5;
}

/** Formacje: 0 linia (szeroko, 1–3 szeregi), 1 blok (kwadrat), 2 luźno (co drugie pole, mniej strat od strzał) */
export const FORMS = 3;
export interface MoveOpts { face?: number; form?: number; width?: number; amove?: boolean }

/**
 * Plan szyku: które pole dostaje który żołnierz. Wręcz z przodu, łucznicy z tyłu.
 * Najbliżsi czoła idą do pierwszego szeregu, w szeregu kolejność z boku na bok, więc oddział nie krzyżuje się w marszu.
 * Czysta funkcja — z niej korzysta też podgląd szyku w przeglądarce.
 */
export function planFormation(g: GameState, player: number, ids: readonly number[], target: number, opts: MoveOpts = {}): { spots: Map<number, number>; slots: Map<number, [number, number]>; face: number; form: number } {
  const w = g.map.width, h = g.map.height;
  const chosen = g.soldiers.filter((s) => s.owner === player && ids.includes(s.id)).slice(0, MAX_ORDER);
  const n = chosen.length;
  const cx = target % w, cy = (target - cx) / w;
  let face = Number.isInteger(opts.face) && opts.face! >= 0 && opts.face! < 8 ? opts.face! : -1;
  if (face < 0 && n) {
    // bez wskazanego kierunku: twarzą w stronę marszu
    let mx = 0, my = 0;
    for (const s of chosen) { mx += s.px >> 8; my += s.py >> 8; }
    face = octant(cx - Math.floor(mx / n), cy - Math.floor(my / n));
    if (face < 0) face = chosen[0]!.face ?? 0;
  }
  if (face < 0) face = 0;
  const form = Number.isInteger(opts.form) && opts.form! >= 0 && opts.form! < FORMS ? opts.form! : 0;
  const spots = new Map<number, number>();
  const slots = new Map<number, [number, number]>();
  if (!n) return { spots, slots, face, form };
  const space = form === 2 ? 2 : 1;
  let cols = form === 1 ? Math.ceil(Math.sqrt(n)) : form === 2 ? Math.ceil(Math.sqrt(n * 2)) : Math.ceil(n / (n <= 6 ? 1 : n <= 16 ? 2 : 3));
  if (Number.isInteger(opts.width) && opts.width! > 0) cols = opts.width!;
  cols = Math.max(1, Math.min(n, cols));
  const [fx, fy] = DIRS[face]!;
  const rx = -fy, ry = fx;
  const fwd = (s: Soldier): number => (s.px >> 8) * fx + (s.py >> 8) * fy;
  const side = (s: Soldier): number => (s.px >> 8) * rx + (s.py >> 8) * ry;
  const byFront = (a: Soldier, b: Soldier): number => fwd(b) - fwd(a) || a.id - b.id;
  const melee = chosen.filter((s) => !UNITS[s.kind]!.range).sort(byFront);
  const ranged = chosen.filter((s) => !!UNITS[s.kind]!.range).sort(byFront);
  const order = [...melee, ...ranged];
  const rows = Math.ceil(n / cols);
  const used = new Set<number>();
  for (let k = 0; k < rows; k++) {
    const row = order.slice(k * cols, (k + 1) * cols).sort((a, b) => side(a) - side(b) || a.id - b.id);
    const back = (k - ((rows - 1) >> 1)) * space;
    row.forEach((s, c) => {
      const off = (c - ((row.length - 1) >> 1)) * space;
      slots.set(s.id, [off, back]);
      const x = cx + rx * off - fx * back, y = cy + ry * off - fy * back;
      let t = x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1;
      if (t < 0 || used.has(t) || !walkable(g, t, player)) {
        // pole zajęte albo nieprzechodnie (drzewo, woda, budynek): najbliższe wolne obok
        t = -1;
        const bx = Math.max(0, Math.min(w - 1, x)), by = Math.max(0, Math.min(h - 1, y));
        for (const [dx, dy] of SPIRAL) {
          const ax = bx + dx, ay = by + dy;
          if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
          const q = ay * w + ax;
          if (!used.has(q) && walkable(g, q, player)) { t = q; break; }
        }
      }
      if (t >= 0) { used.add(t); spots.set(s.id, t); }
    });
  }
  return { spots, slots, face, form };
}

/** Od ilu pól marsz idzie zwartym szykiem (bliżej każdy idzie wprost na swoje miejsce) */
const MARCH_MIN = 4;

/** Rozkaz marszu: zaznaczeni żołnierze idą w szyku na wskazane miejsce i stają twarzą w podanym kierunku. */
export function orderMove(g: GameState, player: number, ids: readonly number[], target: number, opts: MoveOpts = {}): void {
  if (!Number.isInteger(target) || target < 0 || target >= g.map.tiles.length) return;
  const { spots, slots, face } = planFormation(g, player, ids, target, opts);
  if (!spots.size) return;
  const grp = g.nextId++;
  // oddział idzie razem: wszyscy tempem najwolniejszego
  let slow = Infinity, fast = 0;
  const members: Soldier[] = [];
  for (const s of g.soldiers) if (spots.has(s.id) && s.owner === player) { const v = UNITS[s.kind]!.speed; slow = Math.min(slow, v); fast = Math.max(fast, v); members.push(s); }
  // zwarty szyk: punkt prowadzący idzie jedną drogą od środka oddziału, każdy trzyma swoje miejsce obok niego
  const march = members.length >= 2 ? planMarch(g, player, members, target, grp, slow) : undefined;
  if (march) (g.marches ??= []).push(march);
  for (const s of g.soldiers) {
    const spot = spots.get(s.id);
    if (spot === undefined || s.owner !== player) continue;
    leavePost(g, s);
    s.goal = spot; s.hold = spot; s.face = face; s.grp = grp;
    s.path = []; s.wait = 0; s.target = 0; s.hunt = 0;
    s.amove = !!opts.amove;
    s.pace = slow < fast ? slow : undefined;
    s.slot = march ? slots.get(s.id) : undefined;
    s.wounded = 0;
  }
}

/** Droga punktu prowadzącego: od żołnierza najbliżej środka oddziału do celu; null, gdy blisko albo nie ma drogi */
function planMarch(g: GameState, player: number, members: Soldier[], target: number, grp: number, pace: number): March | undefined {
  const W = g.map.width;
  let mx = 0, my = 0;
  for (const s of members) { mx += s.px >> 8; my += s.py >> 8; }
  mx = Math.floor(mx / members.length); my = Math.floor(my / members.length);
  let start = -1, best = Infinity;
  for (const s of members) {
    if (s.up) continue;
    const t = tileOf(g, s), d = Math.max(Math.abs((t % W) - mx), Math.abs(Math.floor(t / W) - my));
    if (d < best) { best = d; start = t; }
  }
  if (start < 0) return undefined;
  const sx = start % W, sy = (start - sx) / W, tx = target % W, ty = (target - tx) / W;
  if (Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) < MARCH_MIN || !walkable(g, target, player)) return undefined;
  const path = findPath(g, start, (t) => t === target, 4000, player);
  if (!path || !path.length) return undefined;
  const dir = octant(tx - sx, ty - sy);
  return { grp, owner: player, path, px: sx * FP + FP / 2, py: sy * FP + FP / 2, dir: dir < 0 ? 0 : dir, pace, stall: 0, lag: 0 };
}

/** Maruder dalej niż tyle pól od swojego miejsca zatrzymuje oddział */
const LAG = 1.5 * FP;
/** Po tylu tickach czekania bez poprawy utknięty maruder idzie sam, a oddział rusza dalej */
const STALL = 40;

/** Miejsce żołnierza w szyku w tej chwili; gdy wypada na drzewie, wodzie albo murze, idzie za punktem prowadzącym */
function slotPoint(g: GameState, m: March, s: Soldier): [number, number, boolean] {
  const [fx, fy] = DIRS[m.dir]!, rx = -fy, ry = fx;
  const [off, back] = s.slot!;
  const x = m.px + (rx * off - fx * back) * FP, y = m.py + (ry * off - fy * back) * FP;
  const tx = x >> 8, ty = y >> 8;
  if (tx >= 0 && ty >= 0 && tx < g.map.width && ty < g.map.height && walkable(g, ty * g.map.width + tx, s.owner)) return [x, y, true];
  return [m.px, m.py, false];
}

/** Odłącza od zwartego szyku: dalej idzie sam swoją drogą na swoje miejsce */
function dropOut(s: Soldier): void { s.slot = undefined; s.path = []; }

/**
 * Zwarte marsze: punkt prowadzący idzie drogą tempem najwolniejszego, ale czeka, gdy ktoś został w tyle albo walczy
 * (atak w marszu). Na końcu drogi każdy dochodzi sam na swoje miejsce w szyku i obraca się we wskazanym kierunku.
 */
function marchSystem(g: GameState): Map<number, March> {
  const live = new Map<number, March>();
  if (!g.marches?.length) return live;
  const members = new Map<number, Soldier[]>();
  for (const s of g.soldiers) if (s.slot && s.grp && s.goal >= 0 && s.hp > 0) { let l = members.get(s.grp); if (!l) { l = []; members.set(s.grp, l); } l.push(s); }
  g.marches = g.marches.filter((m) => {
    const list = members.get(m.grp);
    if (!list) return false;
    let fight = false, lag = 0;
    for (const s of list) {
      if (s.target) { fight = true; continue; }
      const [x, y, own] = slotPoint(g, m, s);
      const d = Math.max(Math.abs(s.px - x), Math.abs(s.py - y));
      const allow = own ? LAG : LAG + (Math.abs(s.slot![0]) + Math.abs(s.slot![1])) * FP;
      if (d > allow) lag += d;
    }
    if (fight || lag) {
      // czeka; liczy tylko czekanie bez postępu, żeby nie zostawić tych, którzy po prostu dochodzą z daleka
      m.stall = lag && lag >= m.lag ? m.stall + 1 : fight ? m.stall : 0;
      m.lag = lag;
      if (m.stall > STALL) {
        for (const s of list) {
          if (s.target) continue;
          const [x, y, own] = slotPoint(g, m, s);
          const allow = own ? LAG : LAG + (Math.abs(s.slot![0]) + Math.abs(s.slot![1])) * FP;
          if (Math.max(Math.abs(s.px - x), Math.abs(s.py - y)) > allow) dropOut(s);
        }
        m.stall = 0; m.lag = 0;
      }
      live.set(m.grp, m);
      return true;
    }
    m.stall = 0; m.lag = 0;
    const next = m.path[0];
    if (next === undefined || !walkable(g, next, m.owner)) { for (const s of list) dropOut(s); return false; }
    const W = g.map.width, nx = next % W, ny = (next - nx) / W;
    const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2, dx = tx - m.px, dy = ty - m.py;
    const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
    const speed = Math.round((base * m.pace * (100 + RULES.roadSpeedBonus[g.roads[(m.py >> 8) * W + (m.px >> 8)]!]!)) / 10000);
    m.px += Math.max(-speed, Math.min(speed, dx));
    m.py += Math.max(-speed, Math.min(speed, dy));
    if (m.px === tx && m.py === ty) m.path.shift();
    // punkt prowadzący doszedł: każdy dochodzi sam na swoje miejsce w szyku
    if (!m.path.length) { for (const s of list) dropOut(s); return false; }
    live.set(m.grp, m);
    return true;
  });
  return live;
}

/** Krok żołnierza w zwartym szyku: wprost do swojego miejsca obok punktu prowadzącego, omijając przeszkody bokiem */
function marchStep(g: GameState, s: Soldier, m: March): void {
  const [x, y] = slotPoint(g, m, s);
  const dx = x - s.px, dy = y - s.py;
  if (!dx && !dy) { s.path = []; return; }
  const W = g.map.width;
  const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
  // własnym tempem (szybszy dogania), punkt prowadzący idzie tempem najwolniejszego
  const speed = Math.round((base * UNITS[s.kind]!.speed * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
  const sx = Math.max(-speed, Math.min(speed, dx)), sy = Math.max(-speed, Math.min(speed, dy));
  const free = (px: number, py: number): boolean => walkable(g, (py >> 8) * W + (px >> 8), s.owner);
  let moved = true;
  if (free(s.px + sx, s.py + sy)) { s.px += sx; s.py += sy; }
  else if (sx && free(s.px + sx, s.py)) s.px += sx;
  else if (sy && free(s.px, s.py + sy)) s.py += sy;
  else moved = false;
  // „droga” to tylko pole przed nim w kierunku marszu (żeby wygląd wiedział, że idzie i dokąd patrzy)
  const [fx, fy] = DIRS[m.dir]!, ax = Math.max(0, Math.min(W - 1, (x >> 8) + fx)), ay = Math.max(0, Math.min(g.map.height - 1, (y >> 8) + fy));
  s.path = moved ? [ay * W + ax] : [];
  if (moved) s.run = Math.min(RUN_MAX, (s.run ?? 0) + 1);
}

/** Ranny (tyle procent zdrowia albo mniej) cofa się za szyk i idzie leczyć się do twierdzy */
const WOUNDED = 30;
/** Wraca do oddziału, gdy ma tyle procent zdrowia */
const HEALED = 90;
/** Przy własnej twierdzy co tyle ticków odzyskuje punkt zdrowia */
const HEAL_EVERY = 15;
const KEEP = buildingIndex('keep');

/** Ranny wycofuje się: 4 pola za szyk (od wroga), bez walki; stamtąd idzie do twierdzy */
function retreat(g: GameState, s: Soldier, byId: Map<number, Soldier>): void {
  const W = g.map.width, here = tileOf(g, s), x = here % W, y = (here - x) / W;
  const foe = byId.get(s.target);
  let away = foe ? octant((s.px >> 8) - (foe.px >> 8), (s.py >> 8) - (foe.py >> 8)) : -1;
  if (away < 0 && s.face !== undefined) away = (s.face + 4) % 8;
  const [ax, ay] = away >= 0 ? DIRS[away]! : [0, 0];
  const bx = Math.max(0, Math.min(W - 1, x + ax * 4)), by = Math.max(0, Math.min(g.map.height - 1, y + ay * 4));
  let rear = -1;
  for (const [dx, dy] of SPIRAL) {
    const qx = bx + dx, qy = by + dy;
    if (qx < 0 || qy < 0 || qx >= W || qy >= g.map.height) continue;
    if (walkable(g, qy * W + qx, s.owner)) { rear = qy * W + qx; break; }
  }
  s.wounded = 1; s.target = 0; s.amove = false; s.prey = 0; s.hunt = 0; s.slot = undefined; s.pace = undefined; s.wait = 0; s.path = [];
  s.goal = rear;
}

/** Postawa oddziału: atak, obrona albo stój. Pilnowane pole to miejsce w szyku albo to, na którym stoi. */
export function orderStance(g: GameState, player: number, ids: readonly number[], stance: number): void {
  if (!Number.isInteger(stance) || stance < 0 || stance > 2) return;
  for (const s of g.soldiers) {
    if (s.owner !== player || !ids.includes(s.id)) continue;
    s.stance = stance;
    s.hold = s.goal >= 0 ? s.goal : tileOf(g, s);
  }
}

/** Schodzi z wieży na wolne pole obok niej */
function leavePost(g: GameState, s: Soldier): void {
  if (s.up) {
    const tower = g.buildings.find((b) => b.id === s.post);
    const spot = tower ? besideTower(g, tower) : -1;
    if (spot >= 0) { s.px = (spot % g.map.width) * FP + FP / 2; s.py = Math.floor(spot / g.map.width) * FP + FP / 2; }
  }
  s.up = false; s.post = 0;
}

function besideTower(g: GameState, b: Building): number {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width;
  for (let y = b.y - 1; y <= b.y + fp.h; y++)
    for (let x = b.x - 1; x <= b.x + fp.w; x++) {
      if (x >= b.x && x < b.x + fp.w && y >= b.y && y < b.y + fp.h) continue;
      if (x < 0 || y < 0 || x >= w || y >= g.map.height) continue;
      if (walkable(g, y * w + x, b.owner)) return y * w + x;
    }
  return -1;
}

/** Wszyscy z wieży schodzą na ziemię obok niej */
export function orderDismount(g: GameState, player: number, towerId: number): void {
  for (const s of g.soldiers) if (s.owner === player && s.post === towerId) { leavePost(g, s); s.goal = -1; s.path = []; s.target = 0; s.slot = undefined; }
}

/** Łucznicy wchodzą na wieżę strażniczą (najwyżej czterech); inni żołnierze stają przy niej */
export function orderGarrison(g: GameState, player: number, ids: readonly number[], towerId: number): void {
  const tower = g.buildings.find((b) => b.id === towerId);
  if (!tower || tower.owner !== player || BUILDINGS[tower.type]!.id !== 'watchtower' || tower.build) return;
  let room = 4 - g.soldiers.filter((s) => s.post === towerId).length;
  const spot = besideTower(g, tower);
  for (const s of g.soldiers) {
    if (s.owner !== player || !ids.includes(s.id) || s.post === towerId) continue;
    const ranged = !!UNITS[s.kind]!.range;
    if (ranged && room > 0) { leavePost(g, s); s.post = towerId; room--; }
    s.goal = spot; s.path = []; s.wait = 0; s.target = 0; s.hunt = 0; s.slot = undefined; s.wounded = 0;
  }
}

function tileOf(g: GameState, s: Soldier): number {
  return (s.py >> 8) * g.map.width + (s.px >> 8);
}

function step(g: GameState, s: Soldier): void {
  const next = s.path[0]!;
  if (!walkable(g, next, s.owner)) { s.path = []; return; }
  const w = g.map.width;
  const nx = next % w, ny = (next - nx) / w;
  const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2;
  const dx = tx - s.px, dy = ty - s.py;
  const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
  const speed = Math.round((base * (s.goal >= 0 && s.pace ? s.pace : UNITS[s.kind]!.speed) * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
  s.px += Math.max(-speed, Math.min(speed, dx));
  s.py += Math.max(-speed, Math.min(speed, dy));
  if (s.px === tx && s.py === ty) s.path.shift();
  s.run = Math.min(RUN_MAX, (s.run ?? 0) + 1);
}

/** Ile ticków marszu daje pełny rozbieg do szarży; po zatrzymaniu rozbieg gaśnie w kilka ticków */
const RUN_MAX = 40, CHARGE_RUN = 15;

/** W którą stronę patrzy żołnierz (0–7): na tego, z kim walczy, w stronę marszu albo w kierunek szyku; -1 = nie wiadomo */
function facingOf(g: GameState, s: Soldier, byId: Map<number, Soldier>): number {
  const t = s.target ? byId.get(s.target) : undefined;
  if (t) return octant(t.px - s.px, t.py - s.py);
  const next = s.path[0];
  if (next !== undefined) { const w = g.map.width, nx = next % w, ny = (next - nx) / w; return octant(nx * FP + FP / 2 - s.px, ny * FP + FP / 2 - s.py); }
  return s.face ?? -1;
}

/**
 * Obrażenia ciosu albo strzały z uwzględnieniem, skąd przychodzą: z boku o 30% mocniej, w plecy o 60%;
 * tarcza z przodu łapie połowę strzały; szarża po rozbiegu podwaja pierwszy cios włócznika.
 */
export function hitDamage(g: GameState, s: Soldier, foe: Soldier, byId: Map<number, Soldier>, ranged: boolean): number {
  const def = UNITS[s.kind]!, fdef = UNITS[foe.kind]!;
  let dmg = def.attack * 100;
  const look = facingOf(g, foe, byId);
  if (look >= 0) {
    const from = octant(s.px - foe.px, s.py - foe.py);
    const d = from < 0 ? 0 : Math.min(Math.abs(from - look), 8 - Math.abs(from - look));
    if (d === 2) dmg = (dmg * 130) / 100;
    else if (d >= 3) dmg = (dmg * 160) / 100;
    else if (ranged && fdef.shield) dmg = dmg / 2;
  }
  if (!ranged && def.charge && (s.run ?? 0) >= CHARGE_RUN) dmg = (dmg * def.charge) / 100;
  return Math.max(1, Math.round(dmg / 100));
}

/** Czy strzała trafia: im dalej, tym częściej chybia; z wieży celniej (losowanie z numeru strzelca i chwili, takie samo u każdego gracza) */
export function arrowHits(g: GameState, s: Soldier, dist: number): boolean {
  const chance = Math.max(30, Math.min(95, 100 - Math.round((dist * 8) / FP) + (s.up ? 20 : 0)));
  return hash2(s.id, g.tick, 0x5eed) % 100 < chance;
}

let budget = 10;

/** Jeden krok w stronę celu: sąsiednie przechodnie pole (bez ścinania rogów), wolne, najbliżej celu; -1 gdy brak */
function greedy(g: GameState, from: number, to: number, taken: Set<number>, player: number): number {
  const w = g.map.width, h = g.map.height;
  const fx = from % w, fy = (from - fx) / w, tx = to % w, ty = (to - tx) / w;
  let best = -1, bd = (fx - tx) ** 2 + (fy - ty) ** 2;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = fx + dx, y = fy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const t = y * w + x;
      if (t === to || taken.has(t) || !walkable(g, t, player)) continue;
      if (dx && dy && (!walkable(g, fy * w + x, player) || !walkable(g, y * w + fx, player))) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
  return best;
}

const team = (g: GameState, player: number): number => g.players[player]?.team ?? player;
/** Odległość w stałym przecinku (metryka szachowa, wystarcza do walki wręcz) */
const gap = (a: Soldier, b: Soldier): number => Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));

/**
 * Ruch i walka. Żołnierz z rozkazem marszu idzie, nie oglądając się na wroga.
 * Stojący wypatruje najbliższego wroga w zasięgu wzroku, podchodzi i bije co kilka ticków. Martwi znikają.
 */
export function armySystem(g: GameState): void {
  const byId = new Map<number, Soldier>();
  for (const s of g.soldiers) byId.set(s.id, s);
  // pola zajęte przez stojących albo docelowe pola maszerujących: nikt nie staje na drugim
  const taken = new Set<number>();
  for (const s of g.soldiers) taken.add(s.path.length ? s.path[s.path.length - 1]! : tileOf(g, s));
  // siatka kubełków 8×8 pól: szukanie wroga patrzy tylko na sąsiednie kubełki, nie na całą armię
  const W = g.map.width, CELL = 8, cw = Math.ceil(W / CELL);
  const grid = new Map<number, Soldier[]>();
  const standing = new Map<number, number>();
  for (const o of g.soldiers) {
    const t = tileOf(g, o), x = t % W, y = (t - x) / W;
    const k = Math.floor(y / CELL) * cw + Math.floor(x / CELL);
    let list = grid.get(k); if (!list) { list = []; grid.set(k, list); } list.push(o);
    if (!o.path.length) standing.set(t, (standing.get(t) ?? 0) + 1);
  }
  // limit drogi szukanej na tick: przy setkach żołnierzy reszta poczeka chwilę, gra się nie zatnie
  budget = 10;
  const marches = marchSystem(g);
  const keeps = new Map<number, Building>();
  for (const b of g.buildings) if (b.type === KEEP && !b.ruined) keeps.set(b.owner, b);
  for (const s of g.soldiers) {
    if (s.hp <= 0) continue;
    if (s.cd > 0) s.cd--;
    s.hitting = 0;
    if (!s.path.length && s.run) s.run = Math.max(0, s.run - 3); // stoi: rozbieg gaśnie
    const def = UNITS[s.kind]!;
    // przy własnej twierdzy rany powoli się goją; wyleczony ranny wraca na swoje miejsce w szyku
    const keep = keeps.get(s.owner);
    if (s.hp < def.hp && !def.guard && keep && g.tick % HEAL_EVERY === 0 && !s.up && rectGap(g, tileOf(g, s), keep) <= 3) s.hp++;
    if (s.wounded === 2 && s.hp * 100 >= def.hp * HEALED) { s.wounded = 0; if ((s.hold ?? -1) >= 0) { s.goal = s.hold!; s.path = []; } }
    // wieża: łucznik przy niej wchodzi na górę; gdy wieżę zniszczą, spada na ziemię
    if (s.post) {
      const tower = g.buildings.find((b) => b.id === s.post);
      if (!tower || tower.ruined) { s.up = false; s.post = 0; }
      else if (!s.up && s.goal < 0 && !s.path.length && rectGap(g, tileOf(g, s), tower) <= 1) {
        const fp = footprint(BUILDINGS[tower.type]!, tower.rot);
        s.up = true; s.px = tower.x * FP + (fp.w * FP) / 2; s.py = tower.y * FP + (fp.h * FP) / 2;
      }
    }
    const range = def.range ? def.range + (s.up ? 3 : 0) : 0;
    // obrona i „stój”: bez celu pilnuje miejsca, w którym stoi (np. po rozkazie ataku albo po szkoleniu)
    const stance = s.stance ?? 0;
    if (stance && s.goal < 0 && !s.target && !s.path.length && (s.hold ?? -1) < 0) s.hold = tileOf(g, s);
    // ciężko ranny w walce cofa się za szyk (nie w postawie „stój”, nie z wieży, nie strażnik miejski)
    if (!s.wounded && s.target && !def.guard && !s.up && !s.post && stance !== 2 && s.hp * 100 <= def.hp * WOUNDED) retreat(g, s, byId);
    // jak daleko od pilnowanego pola wolno mu odejść za wrogiem
    const leash = stance === 1 ? 6 : stance === 2 ? 0 : Infinity;
    const tooFar = (t: number): boolean => {
      if (!stance || (s.hold ?? -1) < 0 || s.post || s.amove) return false;
      const hx = s.hold! % W, hy = (s.hold! - hx) / W, x = t % W, y = (t - x) / W;
      return Math.max(Math.abs(hx - x), Math.abs(hy - y)) > leash + (range || 1);
    };
    // walka: tylko gdy nie maszeruje na rozkaz (albo maszeruje z rozkazem „atak w marszu”)
    if (!s.wounded && (s.goal < 0 || s.amove)) {
      // rozkaz ataku na budynek ma pierwszeństwo przed szukaniem żołnierzy
      if (s.target && !byId.has(s.target) && g.buildings.some((b) => b.id === s.target && !b.ruined) && siege(g, s, def, taken)) continue;
      let foe = s.target ? byId.get(s.target) : undefined;
      if (!foe || foe.hp <= 0 || gap(s, foe) > 40 * FP) {
        foe = undefined;
        let best = (def.sight + (s.up ? 3 : 0)) * FP + 1;
        const t = tileOf(g, s), x = t % W, y = (t - x) / W;
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        for (let gy = cy - 1; gy <= cy + 1; gy++)
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            for (const o of grid.get(gy * cw + gx) ?? []) {
              if (o.hp <= 0 || team(g, o.owner) === team(g, s.owner) || (o.up && !range)) continue; // na wieżę wręcz nie sięgnie
              const d = gap(s, o);
              if (d < best || (d === best && foe && o.id < foe.id)) { best = d; foe = o; }
            }
          }
        s.target = foe ? foe.id : 0;
        // ranny na widok wroga od razu ustępuje, zanim dostanie kolejny cios
        if (foe && !def.guard && !s.up && !s.post && stance !== 2 && s.hp * 100 <= def.hp * WOUNDED) { retreat(g, s, byId); continue; }
      }
      if (foe) {
        // atak w marszu: na widok wroga przerywa marsz (drogę do celu odnajdzie po walce)
        if (s.amove && s.goal >= 0 && (s.path.length > 1 || s.slot)) s.path = [];
        if (gap(s, foe) <= (range ? range * FP : FP + FP / 2) && !s.path.length) {
          if (s.cd === 0) {
            s.cd = def.cooldown;
            // strzała może chybić; chybiona spada w kłąb walki i może zranić swojego, który stoi tuż przy celu
            let hit: Soldier | undefined = foe;
            if (range && !arrowHits(g, s, gap(s, foe))) {
              hit = undefined;
              for (const o of g.soldiers) if (o !== foe && o.hp > 0 && team(g, o.owner) === team(g, s.owner) && gap(o, foe) <= FP + FP / 4 && hash2(o.id, g.tick, 0xf1e) % 100 < 35) { hit = o; break; }
            }
            if (hit) {
              const dmg = hit === foe ? hitDamage(g, s, foe, byId, !!range) : Math.max(1, def.attack >> 1);
              hit.hp -= dmg;
              if (hit.hp <= 0) { if (team(g, hit.owner) !== team(g, s.owner)) g.players[s.owner]!.stats.kills++; g.players[hit.owner]!.stats.lost++; }
            }
            s.run = 0;
          }
          continue;
        }
        if (s.up) continue; // z wieży nie schodzi za wrogiem
        if (stance === 2 || tooFar(tileOf(g, foe))) { s.target = 0; foe = undefined; }
      }
      if (foe) {
        // podchodzi na wolne pole obok wroga (nie tam, gdzie stoi już ktoś inny); drogę odświeża co kilka ticków
        // bez szukania drogi: krok na sąsiednie wolne pole najbliżej wroga (tanie nawet przy setkach walczących)
        if (!s.path.length) {
          const next = greedy(g, tileOf(g, s), tileOf(g, foe), taken, s.owner);
          if (next >= 0) { s.path = [next]; taken.add(next); }
        }
        if (s.path.length) step(g, s);
        continue;
      }
      // brak wrogich żołnierzy: atakuje wrogich chłopów (łucznik z daleka); każdy zabity obniża popularność ich pana
      {
        let best = (def.sight + (s.up ? 3 : 0)) ** 2 + 0.1, prey: Unit | undefined;
        // chłop wskazany rozkazem: ten jest pierwszy, choćby był daleko (dopóki żyje)
        const ordered = s.prey ? g.units.find((u) => u.id === s.prey) : undefined;
        if (s.prey && !ordered) s.prey = 0;
        if (ordered) { prey = ordered; best = ((ordered.px - s.px) / FP) ** 2 + ((ordered.py - s.py) / FP) ** 2; }
        else for (const u of g.units) {
          if (team(g, u.owner) === team(g, s.owner)) continue;
          const dx = (u.px - s.px) / FP, dy = (u.py - s.py) / FP, d = dx * dx + dy * dy;
          if (d < best) { best = d; prey = u; }
        }
        if (prey && prey !== ordered && (stance === 2 || tooFar((prey.py >> 8) * W + (prey.px >> 8))) && (prey.px - s.px) ** 2 + (prey.py - s.py) ** 2 > ((range || 1.5) * FP) ** 2) prey = undefined;
        if (prey) {
          const reach = range ? range : 1.5;
          if (best <= reach * reach) {
            s.path = [];
            s.hitting = prey.id;
            if (s.cd === 0) {
              s.cd = def.cooldown;
              prey.hp = (prey.hp ?? 30) - def.attack;
              prey.wait = Math.max(prey.wait, 6);
              if (prey.hp <= 0) { killPeasant(g, prey, s.owner); s.prey = 0; }
              else peasantReacts(g, prey, s, !!range);
            }
            continue;
          }
          if (!s.up && !s.path.length) { const next = greedy(g, tileOf(g, s), (prey.py >> 8) * W + (prey.px >> 8), taken, s.owner); if (next >= 0) { s.path = [next]; taken.add(next); } }
          if (s.path.length) { step(g, s); continue; }
        }
      }
      // brak wrogich żołnierzy w pobliżu: bierze się za najbliższy wrogi budynek
      if (!s.up && !range && !stance && !s.amove && siege(g, s, def, taken)) continue; // obrona i „stój” nie idą same na budynki; łucznicy sami nie strzelają w budynki, tylko na rozkaz
    }
    if (s.up) continue;
    // zwarty szyk w marszu: trzyma swoje miejsce obok punktu prowadzącego
    const march = s.slot && s.grp && s.goal >= 0 ? marches.get(s.grp) : undefined;
    if (march) { marchStep(g, s, march); continue; }
    if (s.wait > 0) { s.wait--; continue; }
    if (s.path.length) { step(g, s); continue; }
    if (s.goal < 0) {
      const here = tileOf(g, s);
      // ranny za szykiem: do twierdzy rusza dopiero, gdy wroga nie widać (żeby nie wpaść na niego po drodze);
      // gdy wróg podchodzi blisko, cofa się dalej
      if (s.wounded === 1) {
        let near: Soldier | undefined, best = def.sight * FP + 1;
        const x = here % W, y = (here - x) / W, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++)
          for (const o of grid.get(gy * cw + gx) ?? []) if (o.hp > 0 && team(g, o.owner) !== team(g, s.owner) && gap(s, o) < best) { best = gap(s, o); near = o; }
        if (near && best <= 3 * FP) { s.target = near.id; retreat(g, s, byId); }
        else if (!near) { s.wounded = 2; const spot = keep ? besideTower(g, keep) : -1; if (spot >= 0 && rectGap(g, here, keep!) > 2) s.goal = spot; }
        else s.wait = 10;
        continue;
      }
      // obrona: po walce wraca na swoje miejsce w szyku (ranny najpierw się leczy)
      if (stance && !s.wounded && (s.hold ?? -1) >= 0 && here !== s.hold && !s.target && !s.post) { s.goal = s.hold!; continue; }
      // stoi na polu razem z kimś: odsuwa się na najbliższe wolne
      if ((standing.get(here) ?? 0) > 1) {
        const free = formation(g, here, 9).find((t) => !taken.has(t) && t !== here);
        if (free !== undefined) { const n = greedy(g, here, free, taken, s.owner); if (n >= 0) { s.path = [n]; taken.add(n); standing.set(here, standing.get(here)! - 1); } }
      }
      continue;
    }
    const here = tileOf(g, s);
    if (here === s.goal) {
      s.goal = -1; s.amove = false; s.pace = undefined; s.slot = undefined;
      continue;
    }
    const goal = s.goal;
    if (budget <= 0) continue; // ruszy w następnym ticku
    budget--;
    const path = findPath(g, here, (t) => t === goal, 2400, s.owner);
    if (path && path.length) s.path = path;
    else if (!path) {
      // droga zamknięta (palisada, brama): bierze na cel najbliższe wrogie umocnienie i je rozbija
      let best = Infinity, wall: Building | undefined;
      for (const o of g.buildings) {
        const d = BUILDINGS[o.type]!;
        if (!(d.wall || d.gate) || o.ruined || team(g, o.owner) === team(g, s.owner)) continue;
        const dist = Math.abs(o.x - (here % g.map.width)) + Math.abs(o.y - Math.floor(here / g.map.width));
        if (dist < best) { best = dist; wall = o; }
      }
      if (wall) { s.target = wall.id; s.goal = -1; }
      else { s.goal = -1; s.wait = RETRY; } // cel nieosiągalny i nie ma czego rozbijać: nie szukamy drogi co tick
    }
    else { s.goal = -1; s.wait = RETRY; }
  }
  // polegli zostają na polu jako ciała, aż zabierze je grabarz
  if (g.soldiers.some((s) => s.hp <= 0)) {
    for (const s of g.soldiers) if (s.hp <= 0) g.corpses.push({ id: s.id, owner: s.owner, kind: s.kind, px: s.px, py: s.py, at: g.tick, taken: false });
    g.soldiers = g.soldiers.filter((s) => s.hp > 0);
  }
  lookout(g);
  graveSystem(g);
  repairSystem(g);
}

const CEMETERY = buildingIndex('cemetery');
/** Ciało nieodebrane przez tak długo rozkłada się do końca i znika samo */
const ROT_TICKS = 6000;

/** Grabarz z cmentarza idzie po najbliższe ciało w swoim terenie pracy (kwadrat wokół cmentarza), zabiera je i wraca. */
function graveSystem(g: GameState): void {
  if (g.corpses.some((c) => g.tick - c.at > ROT_TICKS && !c.taken)) g.corpses = g.corpses.filter((c) => c.taken || g.tick - c.at <= ROT_TICKS);
  if (g.tick % 10 !== 0) return;
  // wolni chłopi z obozowiska sprzątają ciała na swojej ziemi (najwyżej dwóch naraz na gracza)
  for (const p of g.players) {
    const busy = g.units.filter((u) => u.owner === p.id && u.job === 0 && (u.phase === Phase.ToCorpse || u.carryRes >= 0)).length;
    if (busy >= 2) continue;
    const u = g.units.find((x) => x.owner === p.id && x.job === 0 && x.phase === Phase.Idle && !x.path.length && x.carryRes < 0);
    const keep = g.buildings.find((b) => b.owner === p.id && b.type === 0);
    if (!u || !keep) continue;
    const c = g.corpses.find((x) => !x.taken && Math.abs((x.px >> 8) - keep.x) + Math.abs((x.py >> 8) - keep.y) < 30);
    if (!c) continue;
    c.taken = true; u.target = c.id; u.phase = Phase.ToCorpse;
  }
  for (const b of g.buildings) {
    if (b.type !== CEMETERY || !b.worker) continue;
    const u = g.units.find((x) => x.id === b.worker);
    if (!u || u.phase !== Phase.Idle || u.path.length) continue;
    const a = workArea(b);
    let best: Corpse | undefined, bd = Infinity;
    for (const c of g.corpses) {
      if (c.taken) continue;
      const cx = c.px >> 8, cy = c.py >> 8;
      if (a && (cx < a.x0 || cx > a.x1 || cy < a.y0 || cy > a.y1)) continue; // poza terenem: pole bitwy u wroga nie jego sprawa
      const d = Math.abs(c.px - u.px) + Math.abs(c.py - u.py);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) continue;
    best.taken = true;
    u.target = best.id;
    u.phase = Phase.ToCorpse;
  }
}

/** Odległość pola od działki budynku (0 = na działce, 1 = tuż obok) */
function rectGap(g: GameState, t: number, b: Building): number {
  const w = g.map.width, x = t % w, y = (t - x) / w;
  const fp = footprint(BUILDINGS[b.type]!, b.rot);
  return Math.max(b.x - x, 0, x - (b.x + fp.w - 1), b.y - y, 0, y - (b.y + fp.h - 1));
}

/** Oblężenie: podchodzi pod najbliższy wrogi budynek i bije w niego. Zburzona twierdza = gracz odpada. */
function siege(g: GameState, s: Soldier, def: UnitDef, taken: Set<number>): boolean {
  if (s.wait > 0) return false; // odpoczywa po nieudanym podejściu
  const here = tileOf(g, s);
  let b = s.target ? g.buildings.find((x) => x.id === s.target) : undefined;
  if (!b || b.ruined || team(g, b.owner) === team(g, s.owner)) {
    b = undefined;
    let best = def.sight + 1;
    for (const o of g.buildings) {
      if (team(g, o.owner) === team(g, s.owner) || BUILDINGS[o.type]!.road || o.ruined) continue;
      const d = rectGap(g, here, o);
      if (d < best) { best = d; b = o; }
    }
    s.target = b ? b.id : 0;
  }
  if (!b) return false;
  const reach = def.range ? def.range + (s.up ? 3 : 0) : 1;
  if (rectGap(g, here, b) <= reach && !s.path.length) {
    if (s.cd === 0) {
      b.hp -= def.attack;
      s.cd = def.cooldown;
      if (b.hp <= 0) {
        const keep = BUILDINGS[b.type]!.id === 'keep';
        const owner = g.players[b.owner];
        ruin(g, b);
        g.players[s.owner]!.stats.razed++;
        s.target = 0;
        if (keep && owner) owner.defeated = true;
      }
    }
    return true;
  }
  if (!s.path.length && budget > 0) {
    budget--;
    const target = b;
    const path = findPath(g, here, (t) => rectGap(g, t, target) <= reach && rectGap(g, t, target) >= 1 && (t === here || !taken.has(t)), 600, s.owner);
    s.path = path ?? [];
    if (s.path.length) taken.add(s.path[s.path.length - 1]!);
    // nie da się podejść (zajęte miejsca, zamknięte przejście): odpuszcza ten cel na chwilę, zamiast szukać drogi co tick
    else { s.target = 0; s.wait = RETRY; return false; }
  }
  if (s.path.length) step(g, s);
  return true;
}

const ENGINEERS = buildingIndex('engineers');
/** Plac budowy albo ruina, przy której stoi wrogie wojsko */
function siteUnderThreat(g: GameState, b: Building): boolean {
  const fp = footprint(BUILDINGS[b.type]!, b.rot);
  return enemyNear(g, b.owner, b.x, b.y, fp.w, fp.h);
}
/** Zajęcia, które pracownik może rzucić, żeby iść na budowę */
const DROPPABLE = new Set<Phase>([Phase.Idle, Phase.Returning, Phase.Working, Phase.ToSite, Phase.WorkingSite, Phase.ToInputStore, Phase.ToRest, Phase.Resting]);

/** Surowiec, który niesie się na plac jako n-ty ładunek (na zmianę deski, kamień, żelazo — według kosztu budynku) */
function siteRes(b: Building, n: number): number {
  const c = BUILDINGS[b.type]!.cost as Record<string, number>;
  const list = (['wood', 'stone', 'iron'] as const).filter((k) => (c[k] ?? 0) > 0);
  return list.length ? resIndex(list[n % list.length] as ResourceId) : -1;
}
/** Czy gracz ma skład, z którego da się wziąć ten surowiec */
function hasStoreFor(g: GameState, owner: number, res: number): boolean {
  const kind = RESOURCE_DEFS[RESOURCES[res]!].store;
  return !!kind && g.buildings.some((x) => x.owner === owner && x.door >= 0 && !x.build && BUILDINGS[x.type]!.stores?.includes(kind));
}
/**
 * Robotnik idzie po materiał: bierze kolejny ładunek z puli do przyniesienia. Bez składu na ten surowiec
 * ładunek liczy się od razu jako przyniesiony (nie ma skąd nosić, budowa nie może stanąć).
 */
function sendForMaterial(g: GameState, u: Unit, b: Building): boolean {
  if (!(b.haul ?? 0)) return false;
  const n = (b.loads ?? 0) - b.haul!;
  b.haul!--;
  const res = siteRes(b, n);
  if (res < 0 || !hasStoreFor(g, b.owner, res)) { b.delivered = (b.delivered ?? 0) + 1; return false; }
  u.target = b.id; u.phase = Phase.ToFetch; u.path = []; u.timer = res + 1; u.wait = 0;
  return true;
}

/** Inżynier z cechu naprawia uszkodzone budynki swojego gracza (najbliższy pierwszy). */
function repairSystem(g: GameState): void {
  if (g.tick % 10 !== 0) return;
  for (const u of g.units) {
    if (u.phase === Phase.Repairing) {
      const b = g.buildings.find((x) => x.id === u.target);
      // budowa: każdy robotnik dokłada swoją część, ostatni kończy
      if (b && b.build > 0) {
        // pod okiem wrogiego wojska nikt nie buduje ani nie odbudowuje — robota stoi
        if (siteUnderThreat(g, b)) continue;
        // materiał: tyle pracy, na ile starcza tego, co leży na placu; gdy brak — idzie po kolejny ładunek do składu
        const L = b.loads ?? 0;
        if (L > 0) {
          const work = buildWork(b.type), done = work - b.build;
          if (done * L >= work * (b.delivered ?? 0)) {
            if (sendForMaterial(g, u, b)) continue;
            if (done * L >= work * (b.delivered ?? 0)) continue; // inni już niosą — czeka na materiał
          }
        }
        b.build = Math.max(0, b.build - 12); if (!b.build && b.ruined && !restore(g, b)) b.build = 1; continue;
      }
      if (b && !u.job) { u.target = 0; u.phase = Phase.Idle; continue; }
      if (!b || b.hp >= maxHp(b.type)) { u.target = 0; u.phase = Phase.Returning; continue; }
      b.hp = Math.min(maxHp(b.type), b.hp + 15);
    }
  }
  // do każdego placu budowy przychodzi do trzech wolnych chłopów z młotkami
  for (const b of g.buildings) {
    if (!b.build) continue; // budowa rusza dopiero, gdy robotnicy dojdą na plac
    if (siteUnderThreat(g, b)) continue; // ruina pod wrogimi włóczniami czeka, aż wróg odejdzie
    // ładunki „zgubione” po drodze (niosący dostał inną pracę albo zginął) wracają do puli do przyniesienia
    if (b.loads) {
      let inFlight = 0;
      for (const u of g.units) if (u.target === b.id && (u.phase === Phase.ToFetch || (u.phase === Phase.ToRepair && u.carryRes >= 0))) inFlight++;
      const missing = b.loads - (b.delivered ?? 0) - (b.haul ?? 0) - inFlight;
      if (missing > 0) b.haul = (b.haul ?? 0) + missing;
    }
    let crew = 0;
    for (const u of g.units) if (u.target === b.id && (u.phase === Phase.ToRepair || u.phase === Phase.Repairing || u.phase === Phase.ToFetch)) crew++;
    // wieczorem i nocą nikt nie zaczyna budowy, rano wrócą
    if (dayPart(g.tick) !== 'work') continue;
    while (crew < 3) {
      const u = g.units.find((x) => x.owner === b.owner && x.job === 0 && x.phase === Phase.Idle && x.carryRes < 0);
      if (!u) break;
      // najpierw do składu po materiał (o ile jest jeszcze co nosić), potem na plac
      if (!sendForMaterial(g, u, b)) { u.target = b.id; u.phase = Phase.ToRepair; u.path = []; }
      crew++;
    }
    // brak wolnych chłopów: do dwóch pracowników rzuca robotę (drwal w lesie, kamieniarz w kamieniołomie, ktoś w warsztacie
    // albo na odpoczynku), byle nie mieli nic w rękach — budują, a potem wracają do siebie
    while (crew < 2) {
      // te zajęcia nie używają celu, więc stary cel (np. po przerwanym zapalaniu pochodni) nie blokuje
      const u = g.units.find((x) => x.owner === b.owner && x.job !== 0 && x.carryRes < 0 && DROPPABLE.has(x.phase));
      if (!u) break;
      if (!sendForMaterial(g, u, b)) { u.target = b.id; u.phase = Phase.ToRepair; u.path = []; u.timer = 0; u.wait = 0; }
      crew++;
    }
  }
  for (const guild of g.buildings) {
    if (guild.type !== ENGINEERS || !guild.worker) continue;
    const u = g.units.find((x) => x.id === guild.worker);
    if (!u || u.phase !== Phase.Idle || u.path.length) continue;
    let best: Building | undefined, bd = Infinity;
    for (const b of g.buildings) {
      if (b.owner !== guild.owner || b.hp >= maxHp(b.type) || b.build) continue;
      const d = Math.abs(b.x - guild.x) + Math.abs(b.y - guild.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { u.target = best.id; u.phase = Phase.ToRepair; }
  }
}

/**
 * Chłop pod ciosem, jak kopacz w Gothicu: co trzeci (zawsze ten sam, losowo z numeru) staje i oddaje
 * — kijem czy kilofem, ale słabo; reszta rzuca robotę i ucieka pod swój zamek albo do obozowiska.
 */
/** Ten chłop staje do walki (sześciu na dziesięciu, zawsze ci sami); reszta ucieka */
export const isBrave = (id: number): boolean => hash2(id, 7, 0xbad) % 100 < 60;
/** Czym się bije chłop: kilof noszony na plecach albo drewniana maczuga u pasa (zawsze to samo dla danej osoby) */
export const peasantWeapon = (id: number): 'pick' | 'club' => (hash2(id, 9, 0x77) & 1 ? 'pick' : 'club');

/**
 * Chłopi się rozglądają (co pół sekundy): na widok wrogiego żołnierza w promieniu 5 pól tchórz od razu ucieka,
 * a odważny staje twarzą do wroga i gdy ten podejdzie, okłada go (z marnym skutkiem). Śpiący pod dachem nic nie widzą.
 */
function lookout(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const R = 5 * FP;
  for (const u of g.units) {
    u.foe = 0;
    if (u.phase === Phase.Sleeping || u.phase === Phase.Resting) continue;
    let best: Soldier | undefined, bd = R + 1;
    for (const s of g.soldiers) {
      if (s.hp <= 0 || s.up || team(g, s.owner) === team(g, u.owner)) continue;
      const d = Math.max(Math.abs(s.px - u.px), Math.abs(s.py - u.py));
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) continue;
    if (!isBrave(u.id)) { peasantReacts(g, u, best, true); continue; }
    // odważny: stoi i patrzy na wroga; z bliska bije kijem (rzadko i słabo)
    u.foe = best.id;
    if (bd <= FP * 2.5) u.wait = Math.max(u.wait, 6);
    if (bd <= FP + FP / 2 && hash2(u.id, g.tick, 0xc1b) % 100 < 30) best.hp -= peasantWeapon(u.id) === 'pick' ? 3 : 2; // kilof boli trochę bardziej niż maczuga
  }
}

function peasantReacts(g: GameState, u: Unit, attacker: Soldier, ranged: boolean): void {
  const brave = isBrave(u.id);
  if (brave && !ranged && Math.max(Math.abs(u.px - attacker.px), Math.abs(u.py - attacker.py)) <= FP + FP / 2) {
    if (hash2(u.id, g.tick, 0xc1b) % 100 < 60) attacker.hp -= peasantWeapon(u.id) === 'pick' ? 3 : 2; // znikome obrażenia
    u.wait = Math.max(u.wait, 8); // stoi i się broni
    return;
  }
  if ((u.fled ?? 0) > g.tick) return; // już ucieka, nie szuka nowej drogi
  // najpierw biegiem w przeciwną stronę niż napastnik (kilka pól), potem pod swój dach
  const w = g.map.width, ux = u.px >> 8, uy = u.py >> 8;
  const ax = (u.px - attacker.px) / FP, ay = (u.py - attacker.py) / FP, len = Math.hypot(ax, ay) || 1;
  let away = -1;
  for (let k = 9; k >= 4 && away < 0; k--)
    for (const turn of [0, 0.5, -0.5, 1, -1]) {
      const c = Math.cos(turn), sn = Math.sin(turn);
      const dx = ((ax * c - ay * sn) / len) * k, dy = ((ax * sn + ay * c) / len) * k;
      const x = Math.round(ux + dx), y = Math.round(uy + dy);
      if (x < 0 || y < 0 || x >= w || y >= g.map.height) continue;
      if (walkable(g, y * w + x, u.owner)) { away = y * w + x; break; }
    }
  const keep = g.buildings.find((b) => b.owner === u.owner && BUILDINGS[b.type]!.id === 'keep' && b.door >= 0);
  const camp = g.buildings.find((b) => b.owner === u.owner && b.door >= 0 && BUILDINGS[b.type]!.idleSlots);
  const dest = away >= 0 ? away : keep?.door ?? camp?.door;
  if (dest === undefined) return;
  const path = findPath(g, uy * w + ux, (t) => t === dest, 900, u.owner);
  if (!path || !path.length) return;
  // rzuca, co niósł, przerywa pracę i biegnie; po dobiegnięciu wraca do swoich zajęć (praca albo obozowisko pod dachem)
  u.carryRes = -1; u.carryAmt = 0; u.timer = 0; u.target = 0;
  u.phase = u.job ? Phase.Returning : Phase.Idle;
  u.path = path; u.wait = 0;
  u.fled = g.tick + 50;
}

/** Śmierć chłopa z ręki wroga: ciało zostaje, zwalnia się jego praca, a ludzie tracą zaufanie do pana */
function killPeasant(g: GameState, u: Unit, killer: number): void {
  const i = g.units.indexOf(u);
  if (i < 0) return;
  for (const b of g.buildings) if (b.worker === u.id) b.worker = 0;
  g.units.splice(i, 1);
  g.corpses.push({ id: u.id, owner: u.owner, kind: -1, px: u.px, py: u.py, at: g.tick, taken: false });
  const p = g.players[u.owner];
  if (p) { p.stats.lost++; p.popularity = Math.max(0, p.popularity - 2); }
  const k = g.players[killer];
  if (k) k.stats.kills++;
}

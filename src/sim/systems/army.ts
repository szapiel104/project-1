import { buildingById, unitById, dropWorker, storeCapacity, storeUsed } from '../state';
import { WALL_TOP } from '../../data/keep';
import { buildingIndex } from '../../data/buildings';
import { type ResourceId, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { UNITS, unitIndex } from '../../data/units';
import { findPath, walkable, wallBetween } from '../path';
import { hash2 } from '../rng';
import { FP, Phase, type Building, type Corpse, type GameState, type March, type QueuedMove, type Soldier, type Unit, keepCenter } from '../state';
import { BUILDINGS, TOWERS, footprint, isTower, towerBonus, workArea } from '../../data/buildings';
import { buildWork, demolish, enemyNear, maxHp, rebuildCost, restore, ruin } from './placement';
import { crewOf, dayPart } from './workers';
import { robbed } from './bandits';
import { RESOURCES, RESOURCE_DEFS } from '../../data/resources';

/** Żołnierz stoi wysoko: na wieży albo na murach zamku (dalej widzi i strzela, wręcz go nie dosięgną) */
export const high = (g: GameState, s: { up?: boolean; px: number; py: number }): boolean => !!s.up || (g.walls[(s.py >> 8) * g.map.width + (s.px >> 8)]! & WALL_TOP) !== 0;
import { nearStandard, STANDARD_BONUS } from './standards';
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

/** Szkolenie: wolny chłop dostaje broń ze składu i za rudę staje się żołnierzem przy koszarach. */
export function train(g: GameState, player: number, barracksId: number, unit: string): boolean {
  const kind = unitIndex(unit);
  const def = UNITS[kind];
  const p = g.players[player];
  const b = buildingById(g, barracksId);
  if (!def || def.guard || def.bandit || !p || !b || b.owner !== player || b.type !== BARRACKS || b.door < 0) return false;
  for (const [res, amount] of Object.entries(def.cost)) if (p.res[resIndex(res as ResourceId)]! < amount!) return false;
  // wolny chłop (najlepiej ten, co siedzi przy ognisku) idzie do koszar; w środku dostaje broń i wychodzi żołnierzem
  const free = g.units.filter((u) => u.owner === player && u.job === 0 && !u.enlist && !u.riot && u.carryRes < 0);
  if (!free.length) return false;
  const pick = free.find((u) => u.phase === Phase.Idle) ?? free[0]!;
  for (const [res, amount] of Object.entries(def.cost)) p.res[resIndex(res as ResourceId)]! -= amount!;
  const path = findPath(g, tileOf2(g, pick), (t) => t === b.door, 4000, player, b.door);
  if (!path) {
    // nie dojdzie (zamknięty, odcięty): od razu w koszarach, jak dawniej
    g.units.splice(g.units.indexOf(pick), 1);
    (b.enlistQ ??= []).push({ k: kind, at: g.tick + ENLIST_TICKS });
  } else {
    pick.enlist = kind + 1; pick.job = b.id; pick.phase = Phase.ToEnlist; pick.path = path; pick.wait = 0; pick.target = 0; pick.timer = 0;
  }
  p.stats.trained++;
  return true;
}

/** Tyle ticków rekrut jest w koszarach (dostaje broń i zbroję), zanim wyjdzie */
const ENLIST_TICKS = 20;
const tileOf2 = (g: GameState, u: { px: number; py: number }): number => (u.py >> 8) * g.map.width + (u.px >> 8);

/** Punkt zbiórki koszar: dla jednego rodzaju jednostki albo dla wszystkich (kind < 0); tile < 0 = bez flagi */
export function setRally(g: GameState, player: number, barracksId: number, kind: number, tile: number): void {
  const b = buildingById(g, barracksId);
  if (!b || b.owner !== player || b.type !== BARRACKS) return;
  if (tile >= g.map.tiles.length || !Number.isInteger(tile)) return;
  const r = b.rally ?? UNITS.map(() => -1);
  if (kind < 0) for (let i = 0; i < r.length; i++) r[i] = tile < 0 ? -1 : tile;
  else if (kind < r.length) r[kind] = tile < 0 ? -1 : tile;
  b.rally = r;
}

/** Rekruci: dochodzą do koszar i znikają w środku; po chwili wychodzą w zbroi i idą na punkt zbiórki (albo stają przed koszarami) */
export function enlistSystem(g: GameState): void {
  for (let i = g.units.length - 1; i >= 0; i--) {
    const u = g.units[i]!;
    if (!u.enlist) continue;
    const b = g.buildings.find((x) => x.id === u.job && x.type === BARRACKS);
    if (!b || b.door < 0) { u.enlist = 0; u.job = 0; u.phase = Phase.Idle; u.path = []; continue; }
    // ktoś go zawrócił (ucieczka przed wrogiem): po chwili idzie dalej do koszar
    if (u.phase !== Phase.ToEnlist && !u.path.length) u.phase = Phase.ToEnlist;
    if (u.phase === Phase.ToEnlist && !u.path.length) {
      if (tileOf2(g, u) === b.door) {
        g.units.splice(i, 1);
        (b.enlistQ ??= []).push({ k: u.enlist - 1, at: g.tick + ENLIST_TICKS });
      } else {
        const path = findPath(g, tileOf2(g, u), (t) => t === b.door, 4000, u.owner, b.door);
        if (path && path.length) u.path = path; else { g.units.splice(i, 1); (b.enlistQ ??= []).push({ k: u.enlist - 1, at: g.tick + ENLIST_TICKS }); }
      }
    }
  }
  for (const b of g.buildings) {
    if (!b.enlistQ?.length || b.door < 0) continue;
    const ready = b.enlistQ.filter((q) => q.at <= g.tick);
    if (!ready.length) continue;
    b.enlistQ = b.enlistQ.filter((q) => q.at > g.tick);
    const w = g.map.width, x = b.door % w, y = (b.door - x) / w;
    for (const q of ready) {
      const def = UNITS[q.k]!;
      const rally = b.rally?.[q.k] ?? -1;
      // na punkt zbiórki (koło innych, którzy już tam stoją) albo w szyku przed koszarami
      const at = rally >= 0 ? rally : b.door;
      const near = g.soldiers.filter((s) => s.owner === b.owner && (s.goal >= 0 ? s.goal : tileOf2(g, s)) !== -1 && Math.abs(((s.goal >= 0 ? s.goal : tileOf2(g, s)) % w) - (at % w)) <= 4 && Math.abs(Math.floor((s.goal >= 0 ? s.goal : tileOf2(g, s)) / w) - Math.floor(at / w)) <= 4).length;
      const spots = formation(g, at, near + 1);
      const s: Soldier = { id: g.nextId++, owner: b.owner, kind: q.k, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: def.hp, goal: spots[spots.length - 1] ?? -1, wait: 0, target: 0, cd: 0 };
      g.soldiers.push(s);
    }
  }
}

/** Rozkaz ataku: zaznaczeni idą na wskazanego wroga (żołnierza albo budynek). */
export function orderAttack(g: GameState, player: number, ids: readonly number[], target: number): void {
  // wrogi chłop: żołnierze gonią go, aż padnie albo schowa się na dobre
  const peasant = unitById(g, target);
  if (peasant) {
    if (team(g, peasant.owner) === team(g, player)) return;
    for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.prey = peasant.id; s.target = 0; s.siegeOf = 0; s.goal = -1; s.path = []; s.wait = 0; s.hold = -1; s.amove = false; s.slot = undefined; s.wounded = 0; }
    return;
  }
  const wolf = g.wolves.find((w) => w.id === target);
  if (wolf) {
    // polowanie na wilka: idą za nim, aż go dopadną albo ucieknie do lasu
    for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.hunt = wolf.id; s.target = 0; s.siegeOf = 0; s.goal = (wolf.py >> 8) * g.map.width + (wolf.px >> 8); s.path = []; s.wait = 0; s.slot = undefined; s.wounded = 0; }
    return;
  }
  const foeSoldier = g.soldiers.find((s) => s.id === target);
  const foeBuilding = foeSoldier ? undefined : buildingById(g, target);
  const owner = foeSoldier?.owner ?? foeBuilding?.owner;
  if (owner === undefined || team(g, owner) === team(g, player)) return;
  for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.target = target; s.siegeOf = 0; s.goal = -1; s.path = []; s.wait = 0; s.hold = -1; s.slot = undefined; s.wounded = 0; }
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
export const FORMS = 4;
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
  let cols = form === 1 || form === 3 ? Math.ceil(Math.sqrt(n)) : form === 2 ? Math.ceil(Math.sqrt(n * 2)) : Math.ceil(n / (n <= 6 ? 1 : n <= 16 ? 2 : 3));
  if (Number.isInteger(opts.width) && opts.width! > 0) cols = opts.width!;
  cols = Math.max(1, Math.min(n, cols));
  const [fx, fy] = DIRS[face]!;
  const rx = -fy, ry = fx;
  const fwd = (s: Soldier): number => (s.px >> 8) * fx + (s.py >> 8) * fy;
  const side = (s: Soldier): number => (s.px >> 8) * rx + (s.py >> 8) * ry;
  const byFront = (a: Soldier, b: Soldier): number => fwd(b) - fwd(a) || a.id - b.id;
  const melee = chosen.filter((s) => !UNITS[s.kind]!.range).sort(byFront);
  const ranged = chosen.filter((s) => !!UNITS[s.kind]!.range).sort(byFront);
  // rozkaz na ziemi: nikt nie dostaje miejsca na koronie muru (zamku albo kamiennego) — inaczej część oddziału
  // szła schodami na mur; na mur idzie się, wskazując miejsce na murze
  const onWall = (g.walls[target]! & WALL_TOP) !== 0;
  const offTop = (t: number): boolean => !onWall && (g.walls[t]! & WALL_TOP) !== 0;
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
      if (t < 0 || used.has(t) || !walkable(g, t, player) || offTop(t)) {
        // pole zajęte albo nieprzechodnie (drzewo, woda, budynek): najbliższe wolne obok
        t = -1;
        const bx = Math.max(0, Math.min(w - 1, x)), by = Math.max(0, Math.min(h - 1, y));
        for (const [dx, dy] of SPIRAL) {
          const ax = bx + dx, ay = by + dy;
          if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
          const q = ay * w + ax;
          if (!used.has(q) && walkable(g, q, player) && !offTop(q)) { t = q; break; }
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
/** Zwraca numer nowego rozkazu (grp) albo 0, gdy nikt nie dostał miejsca */
export function orderMove(g: GameState, player: number, ids: readonly number[], target: number, opts: MoveOpts = {}): number {
  if (!Number.isInteger(target) || target < 0 || target >= g.map.tiles.length) return 0;
  const { spots, slots, face } = planFormation(g, player, ids, target, opts);
  if (!spots.size) return 0;
  const grp = g.nextId++;
  // oddział idzie razem: wszyscy tempem najwolniejszego
  let slow = Infinity, fast = 0;
  const members: Soldier[] = [];
  for (const s of g.soldiers) if (spots.has(s.id) && s.owner === player) { const v = UNITS[s.kind]!.speed; slow = Math.min(slow, v); fast = Math.max(fast, v); members.push(s); }
  // zwarty szyk: punkt prowadzący idzie jedną drogą od środka oddziału, każdy trzyma swoje miejsce obok niego
  const march = members.length >= 2 ? planMarch(g, player, members, target, grp, slow, slots) : undefined;
  if (march) (g.marches ??= []).push(march);
  for (const s of g.soldiers) {
    const spot = spots.get(s.id);
    if (spot === undefined || s.owner !== player) continue;
    leavePost(g, s);
    s.goal = spot; s.hold = spot; s.face = face; s.grp = grp;
    s.path = []; s.wait = 0; s.target = 0; s.hunt = 0; s.siegeOf = 0;
    s.amove = !!opts.amove;
    s.pace = slow < fast ? slow : undefined;
    s.slot = march ? slots.get(s.id) : undefined;
    s.tight = opts.form === 3 ? true : undefined;
    s.wounded = 0;
  }
  return grp;
}

// ---- kolejka rozkazów (Shift + prawy klik) i patrol ----

/** Najwięcej punktów w jednej kolejce (dłuższa lista z sieci jest przycinana) */
export const QUEUE_MAX = 12;

const toStep = (tile: number, opts: MoveOpts): QueuedMove => ({ tile, face: opts.face, form: opts.form, width: opts.width, amove: opts.amove || undefined });

/** Wspólny rozkaz zaznaczonych: numer grp, gdy wszyscy żywi należą do jednego, inaczej 0 */
function sharedGrp(g: GameState, player: number, ids: readonly number[]): number {
  const want = new Set(ids);
  let grp = -1;
  for (const s of g.soldiers) {
    if (!want.has(s.id) || s.owner !== player || s.hp <= 0) continue;
    const k = s.grp ?? 0;
    if (grp < 0) grp = k; else if (grp !== k) return 0;
  }
  return grp > 0 ? grp : 0;
}

/** Zaznaczeni wypadają z kolejek i patroli (nowy zwykły rozkaz, atak, wejście na wieżę) */
export function clearOrders(g: GameState, player: number, ids: readonly number[]): void {
  if (!g.orders?.length) return;
  const want = new Set(ids);
  const grps = new Set<number>();
  for (const s of g.soldiers) if (want.has(s.id) && s.owner === player && s.grp) grps.add(s.grp);
  if (!grps.size) return;
  // zostali w kolejce tylko ci z oddziału, których nie ruszono: dostają osobny numer, kolejka idzie z nimi dalej
  for (const q of g.orders) {
    if (q.owner !== player || !grps.has(q.grp)) continue;
    const rest = g.soldiers.filter((s) => s.grp === q.grp && s.owner === player && !want.has(s.id));
    if (!rest.length) { q.steps = []; continue; }
    const grp = g.nextId++;
    for (const s of rest) s.grp = grp;
    for (const m of g.marches ?? []) if (m.grp === q.grp) m.grp = grp;
    q.grp = grp;
  }
  for (const s of g.soldiers) if (want.has(s.id) && s.owner === player && s.grp && grps.has(s.grp)) s.grp = g.nextId++;
  g.orders = g.orders.filter((q) => q.steps.length);
}

/** Shift + prawy klik: punkt dopisany na koniec kolejki. Gdy oddział stoi bez rozkazu, rusza od razu. */
export function queueMove(g: GameState, player: number, ids: readonly number[], target: number, opts: MoveOpts = {}): void {
  if (!Number.isInteger(target) || target < 0 || target >= g.map.tiles.length) return;
  const grp = sharedGrp(g, player, ids);
  const q = grp ? g.orders?.find((o) => o.owner === player && o.grp === grp) : undefined;
  if (q) {
    // dopisanie punktu do patrolu zamienia go w zwykłą kolejkę: punkty obchodu po kolei, a na końcu nowy
    if (q.patrol) q.patrol = undefined;
    if (q.steps.length < QUEUE_MAX) q.steps.push(toStep(target, opts));
    return;
  }
  const busy = grp > 0 && g.soldiers.some((s) => s.grp === grp && s.owner === player && s.hp > 0 && (s.goal >= 0 || s.path.length > 0));
  if (busy) { (g.orders ??= []).push({ grp, owner: player, steps: [toStep(target, opts)] }); return; }
  clearOrders(g, player, ids);
  orderMove(g, player, ids, target, opts);
}

/** Patrol: oddział chodzi w kółko po punktach, a na końcu wraca tam, skąd wyszedł (przy jednym punkcie: tam i z powrotem).
 *  Domyślnie z walką: bije każdego wroga, którego spotka na obchodzie. */
export function orderPatrol(g: GameState, player: number, ids: readonly number[], points: readonly number[], opts: MoveOpts = {}): void {
  const pts = points.filter((t) => Number.isInteger(t) && t >= 0 && t < g.map.tiles.length).slice(0, QUEUE_MAX - 1);
  if (!pts.length) return;
  const want = new Set(ids);
  const list = g.soldiers.filter((s) => want.has(s.id) && s.owner === player && s.hp > 0 && !s.up);
  if (!list.length) return;
  // punkt powrotu: środek oddziału (gdzie stoi albo dokąd właśnie idzie)
  const W = g.map.width;
  let sx = 0, sy = 0;
  for (const s of list) { const t = s.goal >= 0 ? s.goal : tileOf(g, s); sx += t % W; sy += Math.floor(t / W); }
  const home = Math.round(sy / list.length) * W + Math.round(sx / list.length);
  clearOrders(g, player, ids);
  const o = { ...opts, amove: opts.amove ?? true };
  const grp = orderMove(g, player, list.map((s) => s.id), pts[0]!, o);
  if (!grp) return;
  // kolejka obraca się: po wykonaniu punkt idzie na koniec, więc po pierwszym punkcie przychodzi drugi… potem dom i znów pierwszy
  const steps = [...pts.slice(1), home, pts[0]!].map((t) => toStep(t, { form: o.form, amove: o.amove }));
  (g.orders ??= []).push({ grp, owner: player, steps, patrol: true });
}

/** Kolejki: gdy cały oddział doszedł (nikt nie idzie i nie walczy), rusza do następnego punktu */
function ordersSystem(g: GameState): void {
  if (!g.orders?.length) return;
  const byGrp = new Map<number, Soldier[]>();
  for (const s of g.soldiers) if (s.grp && s.hp > 0) { let l = byGrp.get(s.grp); if (!l) { l = []; byGrp.set(s.grp, l); } l.push(s); }
  g.orders = g.orders.filter((q) => {
    const team = (byGrp.get(q.grp) ?? []).filter((s) => s.owner === q.owner);
    if (!team.length) return false;
    // ranni idą się leczyć i nie wstrzymują oddziału; na wieży nie schodzą z posterunku
    const fit = team.filter((s) => !s.wounded && !s.up && !s.post);
    if (!fit.length) return false;
    if (fit.some((s) => s.goal >= 0 || s.path.length > 0 || s.target)) return true;
    const next = q.steps.shift();
    if (next === undefined) return false;
    const grp = orderMove(g, q.owner, fit.map((s) => s.id), next.tile, { face: next.face, form: next.form, width: next.width, amove: next.amove });
    if (!grp) return false;
    q.grp = grp;
    if (q.patrol) q.steps.push(next);
    return q.steps.length > 0 || q.patrol === true;
  });
}

/** Droga punktu prowadzącego: od żołnierza najbliżej środka oddziału do celu; null, gdy blisko albo nie ma drogi */
function planMarch(g: GameState, player: number, members: Soldier[], target: number, grp: number, pace: number, slots: Map<number, [number, number]>): March | undefined {
  const W = g.map.width, H = g.map.height;
  let mx = 0, my = 0, n = 0;
  for (const s of members) { if (s.up) continue; mx += s.px; my += s.py; n++; }
  if (!n) return undefined;
  mx = Math.floor(mx / n); my = Math.floor(my / n);
  // oddział rozsiany (np. wokół twierdzy, na murach i przy bramach): środek wypada w zamku albo za murem,
  // więc zwarty szyk szedłby przez mury — wtedy każdy idzie sam swoją drogą (przez bramę)
  const spread = Math.max(6, Math.sqrt(n) * 1.6) * FP;
  for (const s of members) if (!s.up && Math.max(Math.abs(s.px - mx), Math.abs(s.py - my)) > spread) return undefined;
  const tx = target % W, ty = (target - tx) / W;
  const dir0 = octant(tx - (mx >> 8), ty - (my >> 8));
  const dir = dir0 < 0 ? 0 : dir0;
  if (Math.max(Math.abs(tx - (mx >> 8)), Math.abs(ty - (my >> 8))) < MARCH_MIN || !walkable(g, target, player)) return undefined;
  // punkt prowadzący stawiamy tak, żeby środek szyku wypadł na środku oddziału: nikt nie cofa się, żeby ustawić się
  // za żołnierzem z przodu (wcześniej szyk rósł do tyłu od jednego żołnierza i cały oddział najpierw się cofał)
  const [fx, fy] = DIRS[dir]!, rx = -fy, ry = fx;
  let ox = 0, oy = 0, k = 0;
  for (const s of members) { const sl = slots.get(s.id); if (!sl || s.up) continue; ox += rx * sl[0] - fx * sl[1]; oy += ry * sl[0] - fy * sl[1]; k++; }
  const lx = k ? mx - Math.round((ox / k) * FP) : mx, ly = k ? my - Math.round((oy / k) * FP) : my;
  const bx = Math.max(0, Math.min(W - 1, lx >> 8)), by = Math.max(0, Math.min(H - 1, ly >> 8));
  let start = -1;
  for (const [dx, dy] of SPIRAL) {
    const ax = bx + dx, ay = by + dy;
    if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
    if (walkable(g, ay * W + ax, player)) { start = ay * W + ax; break; }
  }
  if (start < 0) return undefined;
  // punkt prowadzący nie rusza z wnętrza budynku (dziedziniec i sale zamku są przechodnie dla właściciela)
  if (g.occupancy[start] !== 0 || g.walls[start]) return undefined;
  const path = findPath(g, start, (t) => t === target, 4000, player, target);
  if (!path || !path.length) return undefined;
  const sx = start % W, sy = (start - sx) / W;
  // kręta droga (mury, brama, budynki w osadzie): zwarty szyk by się zakleszczał i czekał na maruderów —
  // wtedy każdy idzie sam swoją drogą; szyk trzyma się tylko w otwartym terenie
  if (path.length > Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) * 1.35 + 3) return undefined;
  return { grp, owner: player, path, px: sx * FP + FP / 2, py: sy * FP + FP / 2, dir, pace, stall: 0, lag: 0 };
}

/** Maruder dalej niż tyle pól od swojego miejsca zatrzymuje oddział */
const LAG = 1.5 * FP;
/** Zbiórka na starcie: najwyżej tyle ticków czekania, potem oddział rusza */
const STALL = 40;
/** Maruder dalej niż tyle od miejsca w szyku przez LOST_TICKS ticków odłącza się i idzie sam */
const FAR_LAG = 4 * FP, LOST_TICKS = 30;

/** Miejsce żołnierza w szyku w tej chwili; gdy wypada na drzewie, wodzie albo murze, idzie za punktem prowadzącym */
function slotPoint(g: GameState, m: March, s: Soldier): [number, number, boolean] {
  const [fx, fy] = DIRS[m.dir]!, rx = -fy, ry = fx;
  const [off, back] = s.slot!;
  const x = m.px + (rx * off - fx * back) * FP, y = m.py + (ry * off - fy * back) * FP;
  const tx = x >> 8, ty = y >> 8;
  // miejsce na koronie muru (szyk idzie wzdłuż muru) nie jest miejscem w szyku: ktoś wchodził po drabinie na mur,
  // szedł nim i nie miał jak zejść po drugiej stronie
  const W = g.map.width, lead = (m.py >> 8) * W + (m.px >> 8), top = (t: number): boolean => (g.walls[t]! & WALL_TOP) !== 0;
  if (tx >= 0 && ty >= 0 && tx < W && ty < g.map.height && walkable(g, ty * W + tx, s.owner) && (top(lead) || !top(ty * W + tx))) return [x, y, true];
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
    // walka (atak w marszu): cały oddział staje, dopóki trwa
    if (fight) { live.set(m.grp, m); return true; }
    // zbiórka na starcie: czeka, aż wszyscy staną w szyku (najwyżej ok. 4 s), potem rusza i już nie staje dla maruderów
    if (!m.go) {
      if (lag && m.stall++ < STALL) { live.set(m.grp, m); return true; }
      m.go = true; m.stall = 0;
    }
    // w drodze: maruderzy doganiają (idą szybciej), czoło tylko trochę zwalnia; kto długo jest daleko (las, mur), idzie sam
    if (lag) {
      for (const s of list) {
        const [x, y] = slotPoint(g, m, s);
        if (Math.max(Math.abs(s.px - x), Math.abs(s.py - y)) > FAR_LAG) { s.lost = (s.lost ?? 0) + 1; if (s.lost > LOST_TICKS) { s.lost = 0; dropOut(s); } }
        else s.lost = 0;
      }
    }
    const next = m.path[0];
    if (next === undefined || !walkable(g, next, m.owner)) { for (const s of list) dropOut(s); return false; }
    const W = g.map.width, nx = next % W, ny = (next - nx) / W;
    const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2, dx = tx - m.px, dy = ty - m.py;
    const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
    const speed = Math.round((base * m.pace * (lag ? 0.8 : 1) * (100 + RULES.roadSpeedBonus[g.roads[(m.py >> 8) * W + (m.px >> 8)]!]!)) / 10000);
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
  // daleko od swojego miejsca: przyspiesza, żeby dogonić (czoło na nikogo nie czeka)
  const catchUp = Math.max(Math.abs(dx), Math.abs(dy)) > FP / 2 ? 1.35 : 1;
  const speed = Math.round((base * UNITS[s.kind]!.speed * catchUp * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
  const sx = Math.max(-speed, Math.min(speed, dx)), sy = Math.max(-speed, Math.min(speed, dy));
  // krok wolny: pole przechodnie i bez ściany między polami (sale zamku, mury) — inaczej szyk przechodził przez ściany
  const here = (s.py >> 8) * W + (s.px >> 8);
  const free = (px: number, py: number): boolean => {
    const t = (py >> 8) * W + (px >> 8);
    if (t === here) return true;
    if (!walkable(g, t, s.owner)) return false;
    if ((g.walls[t]! & WALL_TOP) && !(g.walls[here]! & WALL_TOP)) return false; // w marszu nikt nie wchodzi z ziemi na mur
    const ddx = (px >> 8) - (s.px >> 8), ddy = (py >> 8) - (s.py >> 8);
    if (Math.abs(ddx) > 1 || Math.abs(ddy) > 1) return false;
    if (ddx && ddy && (!walkable(g, here + ddx, s.owner) || !walkable(g, here + ddy * W, s.owner))) return false;
    return !((g.walls[here] || g.walls[t] || g.walls[here + ddx] || g.walls[here + ddy * W]) && wallBetween(g, here, ddx, ddy));
  };
  let moved = true;
  if (free(s.px + sx, s.py + sy)) { s.px += sx; s.py += sy; }
  else if (sx && free(s.px + sx, s.py)) s.px += sx;
  else if (sy && free(s.px, s.py + sy)) s.py += sy;
  else moved = false;
  // zablokowany (budynek, mur, drzewo na drodze do miejsca w szyku): nie wstrzymuje oddziału, idzie sam swoją drogą
  if (!moved) { dropOut(s); return; }
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
/** W namiocie polowym z medykiem co tyle ticków (dwa razy szybciej niż pod twierdzą) */
const TENT_HEAL_EVERY = 7;
const KEEP = buildingIndex('keep');
const FIELD_TENT = buildingIndex('fieldTent');

/** Miejsca leczenia gracza: twierdza i namioty polowe z medykiem (gotowe, włączone, nie zburzone) */
function healers(g: GameState): Map<number, Building[]> {
  const m = new Map<number, Building[]>();
  for (const b of g.buildings) {
    if (b.ruined) continue;
    if (b.type === KEEP || (b.type === FIELD_TENT && b.worker && !b.build && !b.off)) {
      let l = m.get(b.owner); if (!l) { l = []; m.set(b.owner, l); } l.push(b);
    }
  }
  return m;
}

/** Najbliższe miejsce leczenia od pola `t` (twierdza albo namiot z medykiem) */
function nearestHealer(g: GameState, list: Building[] | undefined, t: number): Building | undefined {
  let best: Building | undefined, d = Infinity;
  for (const b of list ?? []) { const k = rectGap(g, t, b); if (k < d) { d = k; best = b; } }
  return best;
}

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
  s.wounded = 1; s.target = 0; s.siegeOf = 0; s.amove = false; s.prey = 0; s.hunt = 0; s.slot = undefined; s.pace = undefined; s.wait = 0; s.path = [];
  s.goal = rear;
}

/** Ranny rusza do najbliższego miejsca leczenia: twierdzy albo namiotu polowego z medykiem */
function goHeal(g: GameState, s: Soldier, list: Building[] | undefined, here: number): void {
  const h = nearestHealer(g, list, here);
  const spot = h ? besideTower(g, h) : -1;
  if (spot >= 0 && rectGap(g, here, h!) > 2) { s.goal = spot; s.path = []; }
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
    const tower = buildingById(g, s.post);
    const spot = tower ? besideTower(g, tower) : -1;
    if (spot >= 0) { s.px = (spot % g.map.width) * FP + FP / 2; s.py = Math.floor(spot / g.map.width) * FP + FP / 2; }
  }
  s.up = false; s.post = 0;
}

function besideTower(g: GameState, b: Building): number {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), w = g.map.width;
  // najpierw ziemia: korona muru kamiennego obok wieży też jest „przechodnia”, ale schodzący lądowali wtedy na murze
  // (i dalej szli po nim zamiast przez bramę); mur tylko wtedy, gdy na ziemi obok nie ma miejsca
  for (const top of [false, true])
    for (let y = b.y - 1; y <= b.y + fp.h; y++)
      for (let x = b.x - 1; x <= b.x + fp.w; x++) {
        if (x >= b.x && x < b.x + fp.w && y >= b.y && y < b.y + fp.h) continue;
        if (x < 0 || y < 0 || x >= w || y >= g.map.height) continue;
        const t = y * w + x;
        if (((g.walls[t]! & WALL_TOP) !== 0) !== top) continue;
        if (walkable(g, t, b.owner)) return t;
      }
  return -1;
}

/** Wszyscy z wieży schodzą na ziemię obok niej */
export function orderDismount(g: GameState, player: number, towerId: number): void {
  for (const s of g.soldiers) if (s.owner === player && s.post === towerId) { leavePost(g, s); s.goal = -1; s.path = []; s.target = 0; s.slot = undefined; }
}

/** Ilu łuczników zmieści się na budynku: wieża strażnicza 4, pole muru kamiennego 2 (wchodzą po drabinie) */
export const garrisonRoom = (id: string): number => TOWERS[id]?.room ?? 0;

/** Łucznicy wchodzą na wieżę strażniczą albo mur kamienny; inni żołnierze stają przy nim */
export function orderGarrison(g: GameState, player: number, ids: readonly number[], towerId: number): void {
  const tower = buildingById(g, towerId);
  if (!tower || tower.owner !== player || !garrisonRoom(BUILDINGS[tower.type]!.id) || tower.build) return;
  let room = garrisonRoom(BUILDINGS[tower.type]!.id) - g.soldiers.filter((s) => s.post === towerId).length;
  const spot = besideTower(g, tower);
  for (const s of g.soldiers) {
    if (s.owner !== player || !ids.includes(s.id) || s.post === towerId) continue;
    const ranged = !!UNITS[s.kind]!.range;
    if (ranged && room > 0) { leavePost(g, s); s.post = towerId; room--; }
    s.goal = spot; s.path = []; s.wait = 0; s.target = 0; s.hunt = 0; s.siegeOf = 0; s.slot = undefined; s.wounded = 0;
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
  // strażnik w pogoni za wilkiem biegnie (o 40% szybciej) — widać, że rusza na pomoc
  const run = s.hunt && UNITS[s.kind]!.guard ? 1.4 : 1;
  const speed = Math.round((base * (s.goal >= 0 && s.pace ? s.pace : UNITS[s.kind]!.speed) * run * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
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
 * tarcza z przodu łapie połowę strzały; szarża po rozbiegu podwaja pierwszy cios włócznika; zbroja zjada część ciosu.
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
  // duch oddziału: przy swoim chorążym żołnierz bije mocniej
  if (nearStandard(g, s)) dmg = (dmg * (100 + STANDARD_BONUS)) / 100;
  // taran pod daszkiem ze skór: strzały ledwo go drasną, toporem i włócznią rąbie się go powoli
  if (fdef.ram) dmg = ranged ? dmg / 6 : dmg / 2;
  // ognista strzała (łucznik na murze albo wieży przy koksowniku): rani mocniej
  if (ranged && fireArrow(g, s)) dmg = (dmg * (100 + FIRE_BONUS)) / 100;
  // zbroja (kolczuga zbrojnego): cios wręcz słabszy o armor %, strzała o półtora raza tyle (najwyżej 75%)
  if (fdef.armor) dmg = (dmg * (100 - (ranged ? Math.min(75, (fdef.armor * 3) >> 1) : fdef.armor))) / 100;
  return Math.max(1, Math.round(dmg / 100));
}

/** O ile procent mocniej rani ognista strzała */
export const FIRE_BONUS = 50;
/** Z jak daleka (w polach, od brzegu budynku z koksownikiem) łucznik sięga do żaru */
export const FIRE_REACH = 2;

/**
 * Czy łucznik strzela ognistą strzałą: stoi wysoko (mur, wieża) najwyżej FIRE_REACH pól od własnego muru albo wieży
 * z koksownikiem. Liczy to symulacja przy strzale i obrazek (płonąca strzała), więc wynik jest taki sam u każdego gracza.
 */
export function fireArrow(g: GameState, s: Soldier): boolean {
  if (!UNITS[s.kind]!.range || !high(g, s)) return false;
  const x = s.px >> 8, y = s.py >> 8;
  for (const b of g.buildings) {
    if (!b.brazier || b.ruined || b.build || b.owner !== s.owner) continue;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    const dx = Math.max(b.x - x, x - (b.x + fp.w - 1), 0), dy = Math.max(b.y - y, y - (b.y + fp.h - 1), 0);
    if (Math.max(dx, dy) <= FIRE_REACH) return true;
  }
  return false;
}

/** Czy strzała trafia: im dalej, tym częściej chybia; z wieży celniej (losowanie z numeru strzelca i chwili, takie samo u każdego gracza) */
export function arrowHits(g: GameState, s: Soldier, dist: number): boolean {
  const chance = Math.max(30, Math.min(95, 100 - Math.round((dist * 8) / FP) + (high(g, s) ? 20 : 0)));
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
      // ściany zamku i brzegi muru: krok wprost nie przechodzi przez ścianę ani z ziemi na koronę muru
      if ((g.walls[from] || g.walls[t] || g.walls[fy * w + x] || g.walls[y * w + fx]) && wallBetween(g, from, dx, dy)) continue;
      if ((g.walls[t]! & WALL_TOP) && !(g.walls[from]! & WALL_TOP)) continue;
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
/** Nieosiągalne cele marszu (gracz, cel, okolica startu) → do kiedy nie szukać drogi; osobno dla każdej gry */
const DEAD_TTL = 40;
const deadMaps = new WeakMap<GameState, Map<string, number>>();
function deadEnds(g: GameState): Map<string, number> {
  let m = deadMaps.get(g);
  if (!m) { m = new Map(); deadMaps.set(g, m); }
  if (g.tick % 200 === 0) for (const [k, t] of m) if (t <= g.tick) m.delete(k);
  return m;
}

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
  ordersSystem(g);
  const marches = marchSystem(g);
  const heals = healers(g);
  for (const s of g.soldiers) {
    if (s.hp <= 0) continue;
    if (s.cd > 0) s.cd--;
    s.hitting = 0;
    if (!s.path.length && s.run) s.run = Math.max(0, s.run - 3); // stoi: rozbieg gaśnie
    const def = UNITS[s.kind]!;
    // przy własnej twierdzy rany powoli się goją, w namiocie polowym z medykiem dwa razy szybciej;
    // wyleczony ranny wraca na swoje miejsce w szyku
    const healList = heals.get(s.owner);
    if (s.hp < def.hp && !def.guard && !s.up && healList && (g.tick % TENT_HEAL_EVERY === 0 || g.tick % HEAL_EVERY === 0)) {
      const here = tileOf(g, s);
      let rate = 0;
      for (const b of healList) if (rectGap(g, here, b) <= 3) { const r = b.type === KEEP ? HEAL_EVERY : TENT_HEAL_EVERY; if (!rate || r < rate) rate = r; }
      if (rate && g.tick % rate === 0) s.hp++;
    }
    if (s.wounded === 2 && s.hp * 100 >= def.hp * HEALED) { s.wounded = 0; if ((s.hold ?? -1) >= 0) { s.goal = s.hold!; s.path = []; } }
    // wieża: łucznik przy niej wchodzi na górę; gdy wieżę zniszczą, spada na ziemię
    if (s.post) {
      const tower = buildingById(g, s.post);
      if (!tower || tower.ruined) { s.up = false; s.post = 0; }
      else if (!s.up && s.goal < 0 && !s.path.length && rectGap(g, tileOf(g, s), tower) <= 1) {
        const fp = footprint(BUILDINGS[tower.type]!, tower.rot);
        s.up = true; s.px = tower.x * FP + (fp.w * FP) / 2; s.py = tower.y * FP + (fp.h * FP) / 2;
      }
    }
    const postAt = s.up && s.post ? buildingById(g, s.post) : undefined;
    const range = def.range ? def.range + (high(g, s) ? 3 : 0) + (postAt ? towerBonus(BUILDINGS[postAt.type]!.id) : 0) : 0;
    // obrona i „stój”: bez celu pilnuje miejsca, w którym stoi (np. po rozkazie ataku albo po szkoleniu)
    const stance = s.stance ?? 0;
    if (stance && s.goal < 0 && !s.target && !s.path.length && (s.hold ?? -1) < 0) s.hold = tileOf(g, s);
    // ciężko ranny w walce cofa się za szyk (nie w postawie „stój”, nie z wieży, nie strażnik miejski)
    if (!s.wounded && s.target && !def.guard && !def.ram && !def.sapper && !def.bandit && !s.up && !s.post && stance !== 2 && s.hp * 100 <= def.hp * WOUNDED) retreat(g, s, byId);
    // jak daleko od pilnowanego pola wolno mu odejść za wrogiem
    const leash = stance === 1 ? 6 : stance === 2 ? 0 : Infinity;
    const tooFar = (t: number): boolean => {
      if (!stance || (s.hold ?? -1) < 0 || s.post || s.amove) return false;
      const hx = s.hold! % W, hy = (s.hold! - hx) / W, x = t % W, y = (t - x) / W;
      return Math.max(Math.abs(hx - x), Math.abs(hy - y)) > leash + (range || 1);
    };
    // najbliższy wróg w zasięgu wzroku, którego da się dosięgnąć (na wieżę wręcz nie sięgnie, na mur tylko z muru)
    const nearestFoe = (s: Soldier, range: number): Soldier | undefined => {
      let foe: Soldier | undefined, best = (def.sight + (high(g, s) ? 3 : 0)) * FP + 1;
      const t = tileOf(g, s), x = t % W, y = (t - x) / W;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let gy = cy - 1; gy <= cy + 1; gy++)
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          for (const o of grid.get(gy * cw + gx) ?? []) {
            if (o.hp <= 0 || team(g, o.owner) === team(g, s.owner) || (high(g, o) && !range && (o.up || !high(g, s)))) continue;
            if (o.id === s.skip && g.tick < (s.skipUntil ?? 0)) continue; // do tego wroga nie ma przejścia (za murem): na razie inny cel
            const d = gap(s, o);
            if (d < best || (d === best && foe && o.id < foe.id)) { best = d; foe = o; }
          }
        }
      return foe;
    };
    // przywraca oblegany budynek jako cel, jeśli jeszcze stoi i jest wrogi
    const resumeSiege = (s: Soldier): boolean => {
      if (!s.siegeOf) return false;
      const b = buildingById(g, s.siegeOf);
      s.siegeOf = 0;
      if (!b || b.ruined || team(g, b.owner) === team(g, s.owner)) return false;
      s.target = b.id;
      return true;
    };
    // taran: nie walczy z ludźmi, tylko podjeżdża pod najbliższą wrogą bramę, mur albo zamek i bije w nie belką
    if (def.ram) {
      if ((s.goal < 0 || s.amove) && siege(g, s, def, taken)) continue;
    } else if (def.sapper) {
      // saper nie walczy: rozbiera wrogie ruiny i znosi łup do twierdzy (rozkaz marszu ma pierwszeństwo)
      if (s.goal < 0 && salvageStep(g, s)) continue;
    } else
    // walka: tylko gdy nie maszeruje na rozkaz (albo maszeruje z rozkazem „atak w marszu”)
    if (!s.wounded && (s.goal < 0 || s.amove)) {
      // po walce (albo gdy wróg okazał się nieosiągalny) wraca do oblężenia
      if (!s.target) resumeSiege(s);
      // oblega budynek (z rozkazu albo sam): wrogi żołnierz w zasięgu wzroku ma pierwszeństwo przed zamkiem.
      // Budynek zapamiętany, po walce wraca do niego. Wroga na murze/wieży, którego wręcz nie dosięgnie, pomija.
      if (s.target && !byId.has(s.target) && g.buildings.some((b) => b.id === s.target && !b.ruined)) {
        const foe = nearestFoe(s, range);
        if (foe) { s.siegeOf = s.target; s.target = foe.id; s.path = []; }
        else if (siege(g, s, def, taken)) continue;
      }
      let foe = s.target ? byId.get(s.target) : undefined;
      if (!foe || foe.hp <= 0 || gap(s, foe) > 40 * FP) {
        foe = nearestFoe(s, range);
        s.target = foe ? foe.id : 0;
        // nikogo do bicia: wraca do budynku, który oblegał przed walką
        if (!foe && resumeSiege(s) && siege(g, s, def, taken)) continue;
        // ranny na widok wroga od razu ustępuje, zanim dostanie kolejny cios
        if (foe && !def.guard && !def.bandit && !s.up && !s.post && stance !== 2 && s.hp * 100 <= def.hp * WOUNDED) { retreat(g, s, byId); continue; }
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
              if (hit.hp <= 0) { const k = g.players[s.owner], l = g.players[hit.owner]; if (k && team(g, hit.owner) !== team(g, s.owner)) k.stats.kills++; if (l) l.stats.lost++; } // zbóje nie mają pana: nikt im nie liczy
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
          else if (budget > 0) {
            // krok wprost się nie da (mur, budynek): kawałek prawdziwej drogi do wroga; bez drogi — wróg nieosiągalny,
            // bierze inny cel albo rozbija mur (dawniej stał pod murem i patrzył na strażnika w środku bez końca)
            budget--;
            const ft = tileOf(g, foe), fx = ft % W, fy = (ft - fx) / W;
            // z ziemi nie podchodzi do wroga po koronie muru (wchodził po drabinie nad wilka za murem i nie miał jak zejść)
            const low = !high(g, s);
            const p = findPath(g, tileOf(g, s), (t) => Math.max(Math.abs((t % W) - fx), Math.abs(Math.floor(t / W) - fy)) <= 1 && !(low && (g.walls[t]! & WALL_TOP)), 1500, s.owner, ft, 1);
            if (p && p.length) s.path = p.slice(0, 8);
            else { s.skip = foe.id; s.skipUntil = g.tick + 150; s.target = 0; }
          }
        }
        if (s.path.length) step(g, s);
        continue;
      }
      // brak wrogich żołnierzy: atakuje wrogich chłopów (łucznik z daleka); każdy zabity obniża popularność ich pana
      {
        let best = (def.sight + (high(g, s) ? 3 : 0)) ** 2 + 0.1, prey: Unit | undefined;
        // chłop wskazany rozkazem: ten jest pierwszy, choćby był daleko (dopóki żyje)
        const ordered = s.prey ? unitById(g, s.prey) : undefined;
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
              if (prey.hp <= 0) { robbed(g, s, prey); killPeasant(g, prey, s.owner); s.prey = 0; }
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
        else if (!near) { s.wounded = 2; goHeal(g, s, healList, here); }
        else s.wait = 10;
        continue;
      }
      // ranny stoi z dala od leczenia (namiot zwinięty, medyk odszedł, doszedł nie tam): idzie do najbliższego miejsca
      if (s.wounded === 2 && g.tick % 20 === s.id % 20) {
        const h = nearestHealer(g, healList, here);
        if (h && rectGap(g, here, h) > 3) { goHeal(g, s, healList, here); continue; }
      }
      // obrona: po walce wraca na swoje miejsce w szyku (ranny najpierw się leczy)
      if (stance && !s.wounded && (s.hold ?? -1) >= 0 && here !== s.hold && !s.target && !s.post) { s.goal = s.hold!; continue; }
      // stoi na polu razem z kimś: odsuwa się na najbliższe wolne
      if ((standing.get(here) ?? 0) > 1) {
        const free = formation(g, here, 9).find((t) => !taken.has(t) && t !== here && (!(g.walls[t]! & WALL_TOP) || (g.walls[here]! & WALL_TOP) !== 0));
        if (free !== undefined) { const n = greedy(g, here, free, taken, s.owner); if (n >= 0) { s.path = [n]; taken.add(n); standing.set(here, standing.get(here)! - 1); } }
      }
      continue;
    }
    const here = tileOf(g, s);
    if (here === s.goal) {
      s.goal = -1; s.amove = false; s.pace = undefined; s.slot = undefined;
      continue;
    }
    // cel zabudowany (np. punkt obchodu, na którym stanął sad): najbliższe wolne pole obok, inaczej szukanie drogi
    // przeszukiwało całą mapę co kilkanaście ticków (zacięcia przy 4 na 4)
    if (!walkable(g, s.goal, s.owner)) {
      const gx = s.goal % W, gy = (s.goal - gx) / W;
      let alt = -1;
      for (const [dx, dy] of SPIRAL) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 4) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= W || y >= g.map.height) continue;
        if (walkable(g, y * W + x, s.owner) && ((g.walls[s.goal]! & WALL_TOP) || !(g.walls[y * W + x]! & WALL_TOP))) { alt = y * W + x; break; }
      }
      if (alt < 0) { s.goal = -1; continue; }
      s.goal = alt;
      if (here === alt) { s.goal = -1; continue; }
    }
    const goal = s.goal;
    if (budget <= 0) continue; // ruszy w następnym ticku
    budget--;
    // ten sam nieosiągalny cel z tej samej okolicy (np. cały oddział pod zamkniętym zamkiem): nie przeszukujemy mapy
    // od nowa dla każdego żołnierza — pamiętamy porażkę przez chwilę (to samo u każdego gracza, bo zależy tylko od stanu)
    const deadKey = `${s.owner}:${goal}:${(here % W) >> 3}:${Math.floor(here / W) >> 3}`;
    const deadUntil = deadEnds(g).get(deadKey);
    const path = deadUntil !== undefined && deadUntil > g.tick ? null : findPath(g, here, (t) => t === goal, 2400, s.owner, goal);
    if (!path && !(deadUntil !== undefined && deadUntil > g.tick)) deadEnds(g).set(deadKey, g.tick + DEAD_TTL);
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
    for (const s of g.soldiers) if (s.hp <= 0 && !UNITS[s.kind]!.ram) g.corpses.push({ id: s.id, owner: s.owner, kind: s.kind, px: s.px, py: s.py, at: g.tick, taken: false }); // rozbity taran nie zostawia ciała
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
    const c = g.corpses.find((x) => !x.taken && Math.abs((x.px >> 8) - keepCenter(keep)[0]) + Math.abs((x.py >> 8) - keepCenter(keep)[1]) < 34);
    if (!c) continue;
    c.taken = true; u.target = c.id; u.phase = Phase.ToCorpse;
  }
  for (const b of g.buildings) {
    if (b.type !== CEMETERY || !b.worker) continue;
    const u = unitById(g, b.worker);
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
  let b = s.target ? buildingById(g, s.target) : undefined;
  if (!b || b.ruined || team(g, b.owner) === team(g, s.owner)) {
    b = undefined;
    let best = def.sight + 1;
    for (const o of g.buildings) {
      if (team(g, o.owner) === team(g, s.owner) || BUILDINGS[o.type]!.road || o.ruined) continue;
      // taran woli umocnienia: brama, mur, wieża i zamek są dla niego „bliżej” o 5 pól
      const od = BUILDINGS[o.type]!;
      const d = rectGap(g, here, o) - (def.ram && (od.wall || od.gate || o.type === KEEP) ? 5 : 0);
      if (d < best) { best = d; b = o; }
    }
    s.target = b ? b.id : 0;
  }
  if (!b) return false;
  const reach = def.range ? def.range + (high(g, s) ? 3 : 0) : 1;
  if (rectGap(g, here, b) <= reach && !s.path.length) {
    if (s.cd === 0) {
      b.hp -= def.attack;
      s.cd = def.cooldown;
      if (b.hp <= 0) {
        const keep = BUILDINGS[b.type]!.id === 'keep';
        const owner = g.players[b.owner];
        ruin(g, b);
        const razer = g.players[s.owner]; if (razer) razer.stats.razed++;
        s.target = 0;
        if (keep && owner) owner.defeated = true;
      }
    }
    return true;
  }
  if (!s.path.length && budget > 0) {
    budget--;
    const target = b;
    const low = !(g.walls[here]! & WALL_TOP);
    const path = findPath(g, here, (t) => rectGap(g, t, target) <= reach && rectGap(g, t, target) >= 1 && (t === here || !taken.has(t)) && !(low && (g.walls[t]! & WALL_TOP)), 600, s.owner);
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
  payRebuilds(g);
  for (const u of g.units) {
    if (u.phase === Phase.Repairing) {
      const b = buildingById(g, u.target);
      // ruina jeszcze niezapłacona: robotnik odchodzi, dopóki pan nie zapłaci za odbudowę
      if (b && b.unpaid) { u.target = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; continue; }
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
        // inżynier z cechu zna fach: buduje i odbudowuje dwa razy szybciej niż chłop z młotkiem
        b.build = Math.max(0, b.build - (isEngineer(g, u) ? ENGINEER_BUILD : 12)); if (!b.build && b.ruined && !restore(g, b)) b.build = 1; continue;
      }
      if (b && !u.job) { u.target = 0; u.phase = Phase.Idle; continue; }
      if (!b || b.hp >= maxHp(b.type)) { u.target = 0; u.phase = Phase.Returning; continue; }
      // pod okiem wroga nikt nie łata murów — inżynier wraca do cechu i czeka, aż wróg odejdzie
      if (siteUnderThreat(g, b)) { u.target = 0; u.phase = Phase.Returning; continue; }
      b.hp = Math.min(maxHp(b.type), b.hp + REPAIR_HP);
    }
  }
  // do każdego placu budowy przychodzi do trzech wolnych chłopów z młotkami
  for (const b of g.buildings) {
    if (!b.build) continue; // budowa rusza dopiero, gdy robotnicy dojdą na plac
    if (b.unpaid) continue; // ruina czeka, aż pan zapłaci za odbudowę
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
  engineerOrders(g);
}

/**
 * Zapłata za odbudowę ruin: z zapasów gracza schodzi połowa kosztu budynku, dopiero wtedy robotnicy i inżynierowie
 * biorą się do roboty. Najpierw umocnienia (mury, bramy, wieże), potem reszta; na co nie starcza, czeka.
 */
function payRebuilds(g: GameState): void {
  const due = g.buildings.filter((b) => b.ruined && b.unpaid);
  if (!due.length) return;
  const rank = (b: Building): number => { const d = BUILDINGS[b.type]!; return d.wall || d.gate || d.line || isTower(d.id) ? 0 : 1; };
  due.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  for (const b of due) {
    const p = g.players[b.owner];
    if (!p || p.defeated) continue;
    const cost = rebuildCost(b.type);
    if (cost.some(([k, v]) => p.res[resIndex(k)]! < v)) continue;
    for (const [k, v] of cost) p.res[resIndex(k)]! -= v;
    b.unpaid = undefined;
  }
}

/** Ile ticków saper rąbie i podważa ruinę, zanim wyniesie jeden ładunek */
export const SALVAGE_TICKS = 50;
/** Z jak daleka (w polach) od ostatniej ruiny saper sam szuka następnej */
const SALVAGE_SEEK = 12;

/** Wroga ruina, którą ten saper może rozbierać (nie twierdza, nie droga) */
function salvageable(g: GameState, s: Soldier, b: Building | undefined): b is Building {
  return !!b && !!b.ruined && team(g, b.owner) !== team(g, s.owner) && !BUILDINGS[b.type]!.road && b.type !== KEEP;
}
/** Co leży w ruinie do wyniesienia: połowa drewna, kamienia i żelaza z kosztu budynku, w ładunkach po RULES.rubbleLoad */
export function salvageLoads(type: number): [number, number][] {
  const out: [number, number][] = [];
  const c = BUILDINGS[type]!.cost as Record<string, number>;
  for (const k of ['wood', 'stone', 'iron'] as const) {
    let left = Math.floor((c[k] ?? 0) / 2);
    while (left > 0) { const n = Math.min(left, RULES.rubbleLoad); out.push([resIndex(k), n]); left -= n; }
  }
  return out;
}

/**
 * Saper: idzie pod wrogą ruinę (z rozkazu albo sam, gdy jakaś jest w pobliżu), rąbie ją, wynosi ładunek do własnej
 * twierdzy i wraca po następny. Gdy ruina jest pusta, zostaje po niej tylko bezwartościowy gruz — wróg musi go wynieść
 * i postawić budynek od nowa, za pełną cenę. Zwraca true, gdy saper miał co robić w tym ticku.
 */
function salvageStep(g: GameState, s: Soldier): boolean {
  if (s.wait > 0) return false;
  const here = tileOf(g, s), W = g.map.width;
  // 1. niesie łup: pod mur albo do bramy własnej twierdzy; tam łup trafia do składu (co się nie mieści, przepada)
  if (s.loot) {
    const keep = g.buildings.find((b) => b.owner === s.owner && b.type === KEEP);
    if (!keep) { s.loot = 0; s.lootN = 0; return false; }
    if (rectGap(g, here, keep) <= 1 && !s.path.length) {
      const p = g.players[s.owner], res = s.loot - 1;
      if (p) {
        const kind = RESOURCE_DEFS[RESOURCES[res]!].store;
        const room = kind ? Math.max(0, storeCapacity(g, s.owner, kind) - storeUsed(p, kind)) : Infinity;
        const n = Math.min(s.lootN ?? 0, room);
        p.res[res]! += n;
        p.stats.gathered += n;
      }
      s.loot = 0; s.lootN = 0;
      return true;
    }
    if (!s.path.length) {
      if (budget <= 0) return true;
      budget--;
      const path = findPath(g, here, (t) => rectGap(g, t, keep) <= 1, 4000, s.owner);
      if (path && path.length) s.path = path; else { s.wait = RETRY; return true; }
    }
    step(g, s);
    return true;
  }
  // 2. cel: ruina z rozkazu, a bez niej najbliższa wroga ruina koło poprzedniej (albo koło sapera)
  let b = s.target ? buildingById(g, s.target) : undefined;
  if (!salvageable(g, s, b)) {
    b = undefined;
    const from = s.dig ?? here, fx = from % W, fy = (from - fx) / W;
    let best = Infinity;
    for (const o of g.buildings) {
      if (!salvageable(g, s, o)) continue;
      const fp = footprint(BUILDINGS[o.type]!, o.rot);
      const d = Math.max(o.x - fx, 0, fx - (o.x + fp.w - 1), o.y - fy, 0, fy - (o.y + fp.h - 1));
      if (d <= Math.max(SALVAGE_SEEK, UNITS[s.kind]!.sight) && (d < best || (d === best && b && o.id < b.id))) { best = d; b = o; }
    }
    s.target = b ? b.id : 0;
    if (!b) { s.cd = 0; return false; }
  }
  s.dig = b.y * W + b.x;
  // 3. pod ruiną: rąbie; po SALVAGE_TICKS bierze jeden ładunek i niesie go do twierdzy
  if (rectGap(g, here, b) <= 1 && !s.path.length) {
    b.salvage ??= salvageLoads(b.type);
    if (s.cd === 0) s.cd = SALVAGE_TICKS;
    else if (s.cd === 1) {
      const load = b.salvage.shift();
      if (load) { s.loot = load[0] + 1; s.lootN = load[1]; }
      // ruina rozebrana do gołej ziemi: znika z mapy, zostaje tylko gruz do wyniesienia przez wroga
      if (!b.salvage.length) {
        const razer = g.players[s.owner]; if (razer) razer.stats.razed++;
        demolish(g, b.owner, b.id, true);
        s.target = 0;
      }
    }
    return true;
  }
  if (!s.path.length) {
    if (budget <= 0) return true;
    budget--;
    const target = b;
    const path = findPath(g, here, (t) => rectGap(g, t, target) <= 1, 2400, s.owner);
    if (path && path.length) s.path = path; else { s.target = 0; s.wait = RETRY; return true; }
  }
  step(g, s);
  return true;
}

/** Ile wytrzymałości łata inżynier na raz (co 10 ticków) */
export const REPAIR_HP = 15;
/** O ile skraca budowę jeden inżynier na raz (chłop: 12) */
export const ENGINEER_BUILD = 24;
const isEngineer = (g: GameState, u: Unit): boolean => !!u.job && buildingById(g, u.job)?.type === ENGINEERS;
/** Kolejność robót cechu: 0 = ruina do odbudowy, 1 = umocnienia i twierdza, 2 = reszta, 3 = pomoc przy nowej budowie */
function engineerRank(b: Building): number {
  const d = BUILDINGS[b.type]!;
  if (b.build) return b.ruined ? 0 : 3;
  return d.wall || d.gate || d.line || d.id === 'keep' || isTower(d.id) ? 1 : 2;
}
/** Co inżynier z cechu mógłby teraz robić przy tym budynku (ruina, uszkodzenie, nowa budowa) — bez wroga obok */
export function engineerJob(g: GameState, guild: Building, b: Building): boolean {
  if (b.owner !== guild.owner || b.id === guild.id || BUILDINGS[b.type]!.road) return false;
  if (!b.build && b.hp >= maxHp(b.type)) return false;
  if (b.unpaid) return false; // ruina bez zapłaty za odbudowę: nie ma z czego jej stawiać
  return !siteUnderThreat(g, b);
}
/**
 * Wolni inżynierowie z cechu biorą roboty w całej osadzie, każdy inną: najpierw ruiny (odbudowa), potem uszkodzone
 * mury, bramy, wieże i twierdza, potem reszta (najbardziej rozbite i najbliższe cechu pierwsze), a gdy nic nie trzeba łatać — pomagają przy nowej budowie.
 */
function engineerOrders(g: GameState): void {
  const taken = new Set<number>();
  for (const u of g.units) if ((u.phase === Phase.ToRepair || u.phase === Phase.Repairing || u.phase === Phase.ToFetch) && isEngineer(g, u)) taken.add(u.target);
  // nocą i wieczorem nie zaczynają nowych robót (pożar gasi osobny system)
  if (dayPart(g.tick) !== 'work') return;
  for (const guild of g.buildings) {
    if (guild.type !== ENGINEERS || !guild.worker || guild.build || guild.ruined || guild.off) continue;
    const free = crewOf(guild).map((id) => unitById(g, id)).filter((u): u is Unit => !!u && u.phase === Phase.Idle && !u.path.length && !u.bucket && u.carryRes < 0);
    if (!free.length) continue;
    const jobs = g.buildings.filter((b) => !taken.has(b.id) && engineerJob(g, guild, b));
    if (!jobs.length) continue;
    const [gx, gy] = [guild.x, guild.y];
    jobs.sort((a, b) => engineerRank(a) - engineerRank(b) || a.hp * maxHp(b.type) - b.hp * maxHp(a.type) || (Math.abs(a.x - gx) + Math.abs(a.y - gy)) - (Math.abs(b.x - gx) + Math.abs(b.y - gy)) || a.id - b.id);
    for (const u of free) {
      const b = jobs.shift();
      if (!b) break;
      taken.add(b.id);
      u.target = b.id; u.path = []; u.wait = 0; u.timer = 0;
      if (!(b.build && sendForMaterial(g, u, b))) u.phase = Phase.ToRepair;
    }
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
  const R = 5 * FP, NEAR = FP + FP / 2;
  const dead: [Unit, number][] = [];
  for (const u of g.units) {
    u.foe = 0; u.foeU = 0;
    if (u.phase === Phase.Sleeping || u.phase === Phase.Resting) continue;
    let best: Soldier | undefined, bd = R + 1;
    for (const s of g.soldiers) {
      if (s.hp <= 0 || s.up || team(g, s.owner) === team(g, u.owner) || UNITS[s.kind]!.ram) continue;
      const d = Math.max(Math.abs(s.px - u.px), Math.abs(s.py - u.py));
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) {
      // wrogi chłop tuż obok (np. drwale dwóch panów w tym samym lesie): odważny staje i okłada go kilofem albo maczugą
      if (!isBrave(u.id)) continue;
      let foe: Unit | undefined, fd = NEAR + 1;
      for (const o of g.units) {
        if (o === u || o.phase === Phase.Sleeping || o.phase === Phase.Resting || team(g, o.owner) === team(g, u.owner)) continue;
        const d = Math.max(Math.abs(o.px - u.px), Math.abs(o.py - u.py));
        if (d < fd) { fd = d; foe = o; }
      }
      if (!foe) continue;
      u.foeU = foe.id;
      u.wait = Math.max(u.wait, 6);
      if (hash2(u.id, g.tick, 0xc1b) % 100 < 35) {
        foe.hp = (foe.hp ?? 30) - (peasantWeapon(u.id) === 'pick' ? 3 : 2);
        foe.wait = Math.max(foe.wait, 6);
        if (foe.hp <= 0 && !dead.some(([x]) => x === foe)) dead.push([foe, u.owner]);
      }
      continue;
    }
    if (!isBrave(u.id)) { peasantReacts(g, u, best, true); continue; }
    // odważny: stoi i patrzy na wroga; z bliska bije kijem (rzadko i słabo)
    u.foe = best.id;
    // staje tylko tuż przy wrogu (i wtedy się bije); wróg stojący obok, np. pod murem, nie zatrzymuje mu pracy na zawsze
    if (bd <= FP + FP / 2) u.wait = Math.max(u.wait, 6);
    if (bd <= FP + FP / 2 && hash2(u.id, g.tick, 0xc1b) % 100 < 30) best.hp -= peasantWeapon(u.id) === 'pick' ? 3 : 2; // kilof boli trochę bardziej niż maczuga
  }
  for (const [u, killer] of dead) killPeasant(g, u, killer);
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
  const path = findPath(g, uy * w + ux, (t) => t === dest, 900, u.owner, dest);
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
  dropWorker(g, u.id);
  g.units.splice(i, 1);
  g.corpses.push({ id: u.id, owner: u.owner, kind: -1, px: u.px, py: u.py, at: g.tick, taken: false });
  const p = g.players[u.owner];
  if (p) { p.stats.lost++; p.popularity = Math.max(0, p.popularity - 2); }
  const k = g.players[killer];
  if (k) k.stats.kills++;
}

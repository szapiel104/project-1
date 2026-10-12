import { buildingIndex } from '../../data/buildings';
import { type ResourceId, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { UNITS, unitIndex } from '../../data/units';
import { findPath, walkable } from '../path';
import { FP, Phase, type Building, type Corpse, type GameState, type Soldier } from '../state';
import { BUILDINGS, footprint } from '../../data/buildings';
import { demolish, maxHp } from './placement';
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
  if (!def || !p || !b || b.owner !== player || b.type !== BARRACKS || b.door < 0) return false;
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
  return true;
}

/** Rozkaz ataku: zaznaczeni idą na wskazanego wroga (żołnierza albo budynek). */
export function orderAttack(g: GameState, player: number, ids: readonly number[], target: number): void {
  const foeSoldier = g.soldiers.find((s) => s.id === target);
  const foeBuilding = foeSoldier ? undefined : g.buildings.find((b) => b.id === target);
  const owner = foeSoldier?.owner ?? foeBuilding?.owner;
  if (owner === undefined || team(g, owner) === team(g, player)) return;
  for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.target = target; s.goal = -1; s.path = []; s.wait = 0; }
}

/** Rozkaz marszu: zaznaczeni żołnierze idą w szyku na wskazane miejsce. */
export function orderMove(g: GameState, player: number, ids: readonly number[], target: number): void {
  if (!Number.isInteger(target) || target < 0 || target >= g.map.tiles.length) return;
  const chosen = g.soldiers.filter((s) => s.owner === player && ids.includes(s.id)).slice(0, MAX_ORDER);
  const spots = formation(g, target, chosen.length);
  chosen.forEach((s, i) => { s.goal = spots[i] ?? -1; s.path = []; s.wait = 0; s.target = 0; });
}

function tileOf(g: GameState, s: Soldier): number {
  return (s.py >> 8) * g.map.width + (s.px >> 8);
}

function step(g: GameState, s: Soldier): void {
  const next = s.path[0]!;
  if (!walkable(g, next)) { s.path = []; return; }
  const w = g.map.width;
  const nx = next % w, ny = (next - nx) / w;
  const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2;
  const dx = tx - s.px, dy = ty - s.py;
  const base = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
  const speed = Math.round((base * UNITS[s.kind]!.speed * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
  s.px += Math.max(-speed, Math.min(speed, dx));
  s.py += Math.max(-speed, Math.min(speed, dy));
  if (s.px === tx && s.py === ty) s.path.shift();
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
  for (const s of g.soldiers) {
    if (s.hp <= 0) continue;
    if (s.cd > 0) s.cd--;
    const def = UNITS[s.kind]!;
    // walka: tylko gdy nie maszeruje na rozkaz
    if (s.goal < 0) {
      // rozkaz ataku na budynek ma pierwszeństwo przed szukaniem żołnierzy
      if (s.target && !byId.has(s.target) && g.buildings.some((b) => b.id === s.target) && siege(g, s, def, taken)) continue;
      let foe = s.target ? byId.get(s.target) : undefined;
      if (!foe || foe.hp <= 0 || gap(s, foe) > 40 * FP) {
        foe = undefined;
        let best = def.sight * FP + 1;
        for (const o of g.soldiers) {
          if (o.hp <= 0 || team(g, o.owner) === team(g, s.owner)) continue;
          const d = gap(s, o);
          if (d < best) { best = d; foe = o; }
        }
        s.target = foe ? foe.id : 0;
      }
      if (foe) {
        if (gap(s, foe) <= FP + FP / 2 && !s.path.length) {
          if (s.cd === 0) { foe.hp -= def.attack; s.cd = def.cooldown; }
          continue;
        }
        // podchodzi na wolne pole obok wroga (nie tam, gdzie stoi już ktoś inny); drogę odświeża co kilka ticków
        if (!s.path.length || g.tick % 8 === s.id % 8) {
          const ft = tileOf(g, foe), w = g.map.width;
          const fx = ft % w, fy = (ft - fx) / w;
          const mine = tileOf(g, s);
          const near = (t: number): boolean => { const x = t % w, y = (t - x) / w; return Math.max(Math.abs(x - fx), Math.abs(y - fy)) === 1 && (t === mine || !taken.has(t)); };
          const path = near(mine) ? [] : findPath(g, mine, near, 600);
          s.path = path ?? [];
          if (s.path.length) taken.add(s.path[s.path.length - 1]!);
        }
        if (s.path.length) step(g, s);
        continue;
      }
      // brak wrogich żołnierzy w pobliżu: bierze się za najbliższy wrogi budynek
      if (siege(g, s, def, taken)) continue;
    }
    if (s.wait > 0) { s.wait--; continue; }
    if (s.path.length) { step(g, s); continue; }
    if (s.goal < 0) {
      // stoi na polu razem z kimś: odsuwa się na najbliższe wolne
      const here = tileOf(g, s);
      if (g.soldiers.some((o) => o !== s && o.hp > 0 && !o.path.length && tileOf(g, o) === here && o.id < s.id)) {
        const free = formation(g, here, 9).find((t) => !taken.has(t));
        if (free !== undefined) { s.path = findPath(g, here, (t) => t === free, 60) ?? []; taken.add(free); }
      }
      continue;
    }
    const here = tileOf(g, s);
    if (here === s.goal) { s.goal = -1; continue; }
    const goal = s.goal;
    const path = findPath(g, here, (t) => t === goal, 2400);
    if (path && path.length) s.path = path;
    else { s.goal = -1; s.wait = RETRY; }
  }
  // polegli zostają na polu jako ciała, aż zabierze je grabarz
  if (g.soldiers.some((s) => s.hp <= 0)) {
    for (const s of g.soldiers) if (s.hp <= 0) g.corpses.push({ id: s.id, owner: s.owner, kind: s.kind, px: s.px, py: s.py, at: g.tick, taken: false });
    g.soldiers = g.soldiers.filter((s) => s.hp > 0);
  }
  graveSystem(g);
  repairSystem(g);
}

const CEMETERY = buildingIndex('cemetery');
/** Ciało nieodebrane przez tak długo rozkłada się do końca i znika samo */
const ROT_TICKS = 6000;

/** Grabarz z cmentarza idzie po najbliższe ciało, zabiera je i wraca. */
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
    let best: Corpse | undefined, bd = Infinity;
    for (const c of g.corpses) {
      if (c.taken) continue;
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
  const here = tileOf(g, s);
  let b = s.target ? g.buildings.find((x) => x.id === s.target) : undefined;
  if (!b || team(g, b.owner) === team(g, s.owner)) {
    b = undefined;
    let best = def.sight + 1;
    for (const o of g.buildings) {
      if (team(g, o.owner) === team(g, s.owner) || BUILDINGS[o.type]!.road) continue;
      const d = rectGap(g, here, o);
      if (d < best) { best = d; b = o; }
    }
    s.target = b ? b.id : 0;
  }
  if (!b) return false;
  if (rectGap(g, here, b) <= 1 && !s.path.length) {
    if (s.cd === 0) {
      b.hp -= def.attack;
      s.cd = def.cooldown;
      if (b.hp <= 0) {
        const keep = BUILDINGS[b.type]!.id === 'keep';
        const owner = g.players[b.owner];
        demolish(g, b.owner, b.id, true);
        s.target = 0;
        if (keep && owner) owner.defeated = true;
      }
    }
    return true;
  }
  if (!s.path.length || g.tick % 8 === s.id % 8) {
    const target = b;
    const path = findPath(g, here, (t) => rectGap(g, t, target) === 1 && (t === here || !taken.has(t)), 600);
    s.path = path ?? [];
    if (s.path.length) taken.add(s.path[s.path.length - 1]!);
  }
  if (s.path.length) step(g, s);
  return true;
}

const ENGINEERS = buildingIndex('engineers');

/** Inżynier z cechu naprawia uszkodzone budynki swojego gracza (najbliższy pierwszy). */
function repairSystem(g: GameState): void {
  if (g.tick % 10 !== 0) return;
  for (const u of g.units) {
    if (u.phase === Phase.Repairing) {
      const b = g.buildings.find((x) => x.id === u.target);
      if (!b || b.hp >= maxHp(b.type)) { u.target = 0; u.phase = Phase.Returning; continue; }
      b.hp = Math.min(maxHp(b.type), b.hp + 15);
    }
  }
  for (const guild of g.buildings) {
    if (guild.type !== ENGINEERS || !guild.worker) continue;
    const u = g.units.find((x) => x.id === guild.worker);
    if (!u || u.phase !== Phase.Idle || u.path.length) continue;
    let best: Building | undefined, bd = Infinity;
    for (const b of g.buildings) {
      if (b.owner !== guild.owner || b.hp >= maxHp(b.type) || b.door < 0) continue;
      const d = Math.abs(b.x - guild.x) + Math.abs(b.y - guild.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { u.target = best.id; u.phase = Phase.ToRepair; }
  }
}

import { buildingIndex } from '../../data/buildings';
import { type ResourceId, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { UNITS, unitIndex } from '../../data/units';
import { findPath, walkable } from '../path';
import { FP, type GameState, type Soldier } from '../state';

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
  for (const s of g.soldiers) {
    if (s.hp <= 0) continue;
    if (s.cd > 0) s.cd--;
    const def = UNITS[s.kind]!;
    // walka: tylko gdy nie maszeruje na rozkaz
    if (s.goal < 0) {
      let foe = s.target ? byId.get(s.target) : undefined;
      if (!foe || foe.hp <= 0 || gap(s, foe) > (def.sight + 2) * FP) {
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
        if (gap(s, foe) <= FP + FP / 4) {
          s.path = [];
          if (s.cd === 0) { foe.hp -= def.attack; s.cd = def.cooldown; }
          continue;
        }
        // podchodzi do wroga; drogę odświeża co kilka ticków, bo wróg się rusza
        if (!s.path.length || g.tick % 8 === s.id % 8) {
          const ft = tileOf(g, foe);
          const path = findPath(g, tileOf(g, s), (t) => t === ft, 600);
          s.path = path ?? [];
        }
        if (s.path.length) step(g, s);
        continue;
      }
    }
    if (s.wait > 0) { s.wait--; continue; }
    if (s.path.length) { step(g, s); continue; }
    if (s.goal < 0) continue;
    const here = tileOf(g, s);
    if (here === s.goal) { s.goal = -1; continue; }
    const goal = s.goal;
    const path = findPath(g, here, (t) => t === goal, 2400);
    if (path && path.length) s.path = path;
    else { s.goal = -1; s.wait = RETRY; }
  }
  // polegli schodzą z pola bitwy
  if (g.soldiers.some((s) => s.hp <= 0)) g.soldiers = g.soldiers.filter((s) => s.hp > 0);
}

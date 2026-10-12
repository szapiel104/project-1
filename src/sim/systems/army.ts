import { buildingIndex } from '../../data/buildings';
import { type ResourceId, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { UNITS, unitIndex } from '../../data/units';
import { findPath, walkable } from '../path';
import { FP, Phase, type Building, type Corpse, type GameState, type Soldier } from '../state';
import { BUILDINGS, footprint } from '../../data/buildings';
import { maxHp, restore, ruin } from './placement';
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
  p.stats.trained++;
  return true;
}

/** Rozkaz ataku: zaznaczeni idą na wskazanego wroga (żołnierza albo budynek). */
export function orderAttack(g: GameState, player: number, ids: readonly number[], target: number): void {
  const wolf = g.wolves.find((w) => w.id === target);
  if (wolf) {
    // polowanie na wilka: idą za nim, aż go dopadną albo ucieknie do lasu
    for (const s of g.soldiers) if (s.owner === player && ids.includes(s.id)) { s.hunt = wolf.id; s.target = 0; s.goal = (wolf.py >> 8) * g.map.width + (wolf.px >> 8); s.path = []; s.wait = 0; }
    return;
  }
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
  chosen.forEach((s, i) => { leavePost(g, s); s.goal = spots[i] ?? -1; s.path = []; s.wait = 0; s.target = 0; });
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
    s.goal = spot; s.path = []; s.wait = 0; s.target = 0; s.hunt = 0;
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
  const speed = Math.round((base * UNITS[s.kind]!.speed * (100 + RULES.roadSpeedBonus[g.roads[tileOf(g, s)]!]!)) / 10000);
  s.px += Math.max(-speed, Math.min(speed, dx));
  s.py += Math.max(-speed, Math.min(speed, dy));
  if (s.px === tx && s.py === ty) s.path.shift();
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
  for (const s of g.soldiers) {
    if (s.hp <= 0) continue;
    if (s.cd > 0) s.cd--;
    const def = UNITS[s.kind]!;
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
    // walka: tylko gdy nie maszeruje na rozkaz
    if (s.goal < 0) {
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
      }
      if (foe) {
        if (gap(s, foe) <= (range ? range * FP : FP + FP / 2) && !s.path.length) {
          if (s.cd === 0) {
            foe.hp -= def.attack; s.cd = def.cooldown;
            if (foe.hp <= 0) { g.players[s.owner]!.stats.kills++; g.players[foe.owner]!.stats.lost++; }
          }
          continue;
        }
        if (s.up) continue; // z wieży nie schodzi za wrogiem
        // podchodzi na wolne pole obok wroga (nie tam, gdzie stoi już ktoś inny); drogę odświeża co kilka ticków
        // bez szukania drogi: krok na sąsiednie wolne pole najbliżej wroga (tanie nawet przy setkach walczących)
        if (!s.path.length) {
          const next = greedy(g, tileOf(g, s), tileOf(g, foe), taken, s.owner);
          if (next >= 0) { s.path = [next]; taken.add(next); }
        }
        if (s.path.length) step(g, s);
        continue;
      }
      // brak wrogich żołnierzy w pobliżu: bierze się za najbliższy wrogi budynek
      if (!s.up && !range && siege(g, s, def, taken)) continue; // łucznicy sami nie strzelają w budynki, tylko na rozkaz
    }
    if (s.up) continue;
    if (s.wait > 0) { s.wait--; continue; }
    if (s.path.length) { step(g, s); continue; }
    if (s.goal < 0) {
      // stoi na polu razem z kimś: odsuwa się na najbliższe wolne
      const here = tileOf(g, s);
      if ((standing.get(here) ?? 0) > 1) {
        const free = formation(g, here, 9).find((t) => !taken.has(t) && t !== here);
        if (free !== undefined) { const n = greedy(g, here, free, taken, s.owner); if (n >= 0) { s.path = [n]; taken.add(n); standing.set(here, standing.get(here)! - 1); } }
      }
      continue;
    }
    const here = tileOf(g, s);
    if (here === s.goal) { s.goal = -1; continue; }
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

/** Inżynier z cechu naprawia uszkodzone budynki swojego gracza (najbliższy pierwszy). */
function repairSystem(g: GameState): void {
  if (g.tick % 10 !== 0) return;
  for (const u of g.units) {
    if (u.phase === Phase.Repairing) {
      const b = g.buildings.find((x) => x.id === u.target);
      // budowa: każdy robotnik dokłada swoją część, ostatni kończy
      if (b && b.build > 0) { b.build = Math.max(0, b.build - 12); if (!b.build && b.ruined && !restore(g, b)) b.build = 1; continue; }
      if (b && !u.job) { u.target = 0; u.phase = Phase.Idle; continue; }
      if (!b || b.hp >= maxHp(b.type)) { u.target = 0; u.phase = Phase.Returning; continue; }
      b.hp = Math.min(maxHp(b.type), b.hp + 15);
    }
  }
  // do każdego placu budowy przychodzi do trzech wolnych chłopów z młotkami
  for (const b of g.buildings) {
    if (!b.build) continue; // budowa rusza dopiero, gdy robotnicy dojdą na plac
    let crew = 0;
    for (const u of g.units) if (u.target === b.id && (u.phase === Phase.ToRepair || u.phase === Phase.Repairing)) crew++;
    while (crew < 3) {
      const u = g.units.find((x) => x.owner === b.owner && x.job === 0 && x.phase === Phase.Idle && x.target === 0 && x.carryRes < 0);
      if (!u) break;
      u.target = b.id; u.phase = Phase.ToRepair; u.path = []; crew++;
    }
    // nikt wolny nie przyszedł: jeden pracownik rzuca swoją robotę (bez ładunku w rękach), buduje i potem wraca
    if (crew === 0) {
      const u = g.units.find((x) => x.owner === b.owner && x.job !== 0 && x.target === 0 && x.carryRes < 0 &&
        (x.phase === Phase.Working || x.phase === Phase.Returning || x.phase === Phase.Idle));
      if (u) { u.target = b.id; u.phase = Phase.ToRepair; u.path = []; u.timer = 0; }
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

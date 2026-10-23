import { dropWorker } from '../state';
import { RULES } from '../../data/rules';
import { findPath } from '../path';
import { FP, Phase, housing, idleCount, idleSlots, playerKeep, population, type GameState, type Unit } from '../state';

export function spawnPeasant(g: GameState, player: number): Unit | null {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return null;
  const w = g.map.width;
  const x = keep.door % w, y = (keep.door - x) / w;
  const u: Unit = {
    id: g.nextId++, owner: player, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [],
    job: 0, phase: Phase.Idle, timer: 0, wait: 0, carryRes: -1, carryAmt: 0, trips: 0, home: 0, batches: 0, target: 0,
  };
  g.units.push(u);
  return u;
}

function removePeasant(g: GameState, player: number): void {
  // najpierw odchodzą bezrobotni, potem najmłodsi stażem; buntownicy spod bramy zostają i domagają się chleba
  let pick = -1;
  for (let i = g.units.length - 1; i >= 0; i--) {
    const u = g.units[i]!;
    if (u.owner !== player || u.riot) continue;
    if (u.job === 0) { pick = i; break; }
    if (pick < 0) pick = i;
  }
  const u = g.units[pick];
  if (!u) return;
  dropWorker(g, u.id);
  g.units.splice(pick, 1);
  // odchodzi pieszo do najbliższego brzegu mapy i dalej w las
  const { width: w, height: h } = g.map;
  const from = (u.py >> 8) * w + (u.px >> 8);
  const edge = (t: number): boolean => { const x = t % w, y = (t - x) / w; return x === 0 || y === 0 || x === w - 1 || y === h - 1; };
  const path = findPath(g, from, edge, 4000, player, -1, 0, true) ?? [];
  g.travelers.push({ id: u.id, owner: player, px: u.px, py: u.py, tx: u.px, ty: u.py, leaving: true, path: path.slice().reverse() });
}

/** Nowy chłop wychodzi z lasu przy brzegu mapy najbliższym twierdzy i idzie do jej bramy. */
function arrive(g: GameState, player: number): void {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return;
  const { width: w, height: h } = g.map;
  // brzeg najbliższy twierdzy, potem szukamy drogi od bramy do niego i idziemy nią w odwrotną stronę
  const edge = (t: number): boolean => { const x = t % w, y = (t - x) / w; return x === 0 || y === 0 || x === w - 1 || y === h - 1; };
  const path = findPath(g, keep.door, edge, 4000, player, -1, 0, true);
  if (!path || !path.length) { spawnPeasant(g, player); return; }
  const start = path[path.length - 1]!;
  const sx = start % w, sy = (start - sx) / w;
  // zaczyna kilka pól za mapą, w lesie
  const ox = sx === 0 ? -3 : sx === w - 1 ? 3 : 0, oy = sy === 0 ? -3 : sy === h - 1 ? 3 : 0;
  // przechowujemy od końca: ostatni element to najbliższe pole (krok zdejmuje go z tablicy)
  g.travelers.push({ id: g.nextId++, owner: player, px: (sx + ox) * FP + FP / 2, py: (sy + oy) * FP + FP / 2, tx: 0, ty: 0, leaving: false, path: [keep.door, ...path] });
}

/** Ruch wędrowców: idą swoją drogą pole po polu; odchodzący znikają w lesie, przychodzący stają się chłopami. */
export function travelSystem(g: GameState): void {
  const w = g.map.width, h = g.map.height;
  for (let i = g.travelers.length - 1; i >= 0; i--) {
    const t = g.travelers[i]!;
    let tx: number, ty: number;
    if (t.path.length) { const n = t.path[t.path.length - 1]!; const x = n % w; tx = x * FP + FP / 2; ty = ((n - x) / w) * FP + FP / 2; }
    else if (t.leaving) {
      // po dojściu do brzegu jeszcze kilka pól prosto w las
      const x = t.px >> 8, y = t.py >> 8;
      if (x < -3 || y < -3 || x > w + 2 || y > h + 2) { g.travelers.splice(i, 1); continue; }
      tx = t.px + (x <= 0 ? -FP : x >= w - 1 ? FP : 0); ty = t.py + (y <= 0 ? -FP : y >= h - 1 ? FP : 0);
      if (tx === t.px && ty === t.py) { g.travelers.splice(i, 1); continue; }
    } else {
      g.travelers.splice(i, 1);
      spawnPeasant(g, t.owner);
      continue;
    }
    const dx = tx - t.px, dy = ty - t.py;
    const sp = RULES.unitSpeed;
    t.px += Math.max(-sp, Math.min(sp, dx));
    t.py += Math.max(-sp, Math.min(sp, dy));
    t.tx = tx; t.ty = ty;
    if (t.px === tx && t.py === ty && t.path.length) t.path.pop();
  }
}

/** Przy dobrej popularności przybywa chłopów (do liczby miejsc), przy złej odchodzą. */
export function migrationSystem(g: GameState): void {
  if (g.tick % RULES.migrationTicks !== 0) return;
  for (const p of g.players) {
    const pop = population(g, p.id);
    if (pop < RULES.minPeasants) arrive(g, p.id);
    // głód: póki nie ma co jeść, ludzie odchodzą (i nikt nowy nie przyjdzie) — bez względu na popularność;
    // gdy jedzenie wróci, odchodzenie od razu ustaje
    else if (p.hungry) { if (pop > RULES.minPeasants) removePeasant(g, p.id); }
    else if (p.popularity >= RULES.migrationThreshold) {
      // nowi przychodzą tylko wtedy, gdy jest dla nich dach w chacie i wolne miejsce w obozowisku
      if (pop < housing(g, p.id) && idleCount(g, p.id) < idleSlots(g, p.id)) arrive(g, p.id);
    }
    else if (pop > RULES.minPeasants) removePeasant(g, p.id);
  }
}

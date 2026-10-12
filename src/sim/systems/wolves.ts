import { RULES } from '../../data/rules';
import { clockAt } from '../clock';
import { findPath, walkable } from '../path';
import { FP, type GameState, type Wolf } from '../state';

/**
 * Wilki: nocą z lasu za mapą wychodzi wataha i poluje na ludzi poza osadą. Palisada je zatrzymuje,
 * żołnierze z nimi walczą. O świcie ocalałe wracają do lasu. Gra pokojowa (poziom 0) ich nie ma.
 */
const SPEED = 30;
const SIGHT = 9;
const BITE = 14; // ticki między ugryzieniami

function edgeOut(g: GameState, w: Wolf): number {
  const { width, height } = g.map;
  const x = w.px >> 8, y = w.py >> 8;
  const dl = x, dr = width - 1 - x, dt = y, db = height - 1 - y;
  const m = Math.min(dl, dr, dt, db);
  return m === dl ? y * width : m === dr ? y * width + width - 1 : m === dt ? x : (height - 1) * width + x;
}

export function wolfSystem(g: GameState): void {
  const { width, height } = g.map;
  const clock = clockAt(g.tick);
  const peaceful = g.players[0]?.level === 0;
  // nowa wataha: raz na noc (około 22:00), co drugą noc, od trzeciego dnia
  if (!peaceful && clock.day >= 3 && clock.day % 2 === 1 && (g.tick + (RULES.startHour * RULES.dayTicks) / 24) % RULES.dayTicks === Math.floor((22 / 24) * RULES.dayTicks)) {
    const side = g.rng.int(4);
    const along = 4 + g.rng.int((side < 2 ? width : height) - 8);
    const tile = side === 0 ? along : side === 1 ? (height - 1) * width + along : side === 2 ? along * width : along * width + width - 1;
    const size = 2 + g.rng.int(3);
    for (let i = 0; i < size; i++) {
      const x = tile % width, y = (tile - x) / width;
      g.wolves.push({ id: g.nextId++, px: x * FP + FP / 2 + (i - 1) * 60, py: y * FP + FP / 2, hp: 45, path: [], target: 0, cd: 0, leaving: false });
    }
  }
  if (!g.wolves.length) return;
  const day = !clock.night;
  for (const w of g.wolves) {
    if (w.cd > 0) w.cd--;
    const here = (w.py >> 8) * width + (w.px >> 8);
    if (day && !w.leaving) { w.leaving = true; w.path = []; w.target = 0; }
    if (w.leaving) {
      const x = w.px >> 8, y = w.py >> 8;
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) { w.hp = 0; continue; } // zniknął w lesie
      if (!w.path.length && (g.tick + w.id) % 20 === 0) { const out = edgeOut(g, w); w.path = findPath(g, here, (t) => t === out, 3000) ?? []; }
    } else {
      // ofiara: najbliższy człowiek albo żołnierz w zasięgu wzroku
      let best = SIGHT * SIGHT, prey = 0, px = 0, py = 0;
      for (const u of g.units) { const dx = (u.px - w.px) / FP, dy = (u.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; prey = u.id; px = u.px; py = u.py; } }
      for (const s of g.soldiers) { const dx = (s.px - w.px) / FP, dy = (s.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; prey = s.id; px = s.px; py = s.py; } }
      w.target = prey;
      if (prey && best <= 1.2) {
        w.path = [];
        if (w.cd === 0) {
          w.cd = BITE;
          const ui = g.units.findIndex((u) => u.id === prey);
          if (ui >= 0) {
            // chłop nie ma czym się bronić: wilk go zagryza
            const u = g.units[ui]!;
            if (u.job) { const b = g.buildings.find((x) => x.id === u.job); if (b) b.worker = 0; }
            for (const b of g.buildings) if (b.worker === u.id) b.worker = 0;
            g.units.splice(ui, 1);
            const p = g.players[u.owner];
            if (p) { p.stats.lost++; p.wolfKills = (p.wolfKills ?? 0) + 1; }
          } else { const s = g.soldiers.find((x) => x.id === prey); if (s) s.hp -= 7; }
        }
        continue;
      }
      if (!w.path.length && (g.tick + w.id) % 15 === 0) {
        if (prey) { const t = (py >> 8) * width + (px >> 8); w.path = findPath(g, here, (x) => Math.abs((x % width) - (t % width)) <= 1 && Math.abs(Math.floor(x / width) - Math.floor(t / width)) <= 1, 500) ?? []; }
        else {
          // węszy w stronę najbliższej osady
          const keep = g.buildings.find((b) => b.type === 0);
          if (keep) { const t = (keep.y + 4) * width + keep.x + 1; w.path = findPath(g, here, (x) => Math.abs((x % width) - (t % width)) <= 6 && Math.abs(Math.floor(x / width) - Math.floor(t / width)) <= 6, 1500) ?? []; }
        }
      }
    }
    // krok
    const next = w.path[0];
    if (next === undefined) continue;
    if (!walkable(g, next)) { w.path = []; continue; }
    const tx = (next % width) * FP + FP / 2, ty = Math.floor(next / width) * FP + FP / 2;
    w.px += Math.max(-SPEED, Math.min(SPEED, tx - w.px));
    w.py += Math.max(-SPEED, Math.min(SPEED, ty - w.py));
    if (w.px === tx && w.py === ty) w.path.shift();
  }
  // żołnierze bronią się i gonią wilki w pobliżu
  for (const s of g.soldiers) {
    let best = 36, wolf: Wolf | undefined;
    for (const w of g.wolves) { if (w.hp <= 0) continue; const dx = (s.px - w.px) / FP, dy = (s.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; wolf = w; } }
    if (!wolf) continue;
    if (best <= 2.2) { if ((g.tick + s.id) % 12 === 0) wolf.hp -= 9; }
    else if (s.goal < 0 && !s.target && !s.path.length) s.goal = (wolf.py >> 8) * width + (wolf.px >> 8);
  }
  g.wolves = g.wolves.filter((w) => w.hp > 0);
}

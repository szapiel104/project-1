import { buildingById, dropWorker } from '../state';
import { ARROW_TICKS, high, isBrave, peasantWeapon, spellTicks } from './army';
import { hash2 } from '../rng';
import { clockAt, hourStarts } from '../clock';
import { WOLF, findPath, walkable } from '../path';
import { BUILDINGS } from '../../data/buildings';
import { UNITS } from '../../data/units';
import { FP, Phase, type GameState, type Wolf } from '../state';
import { ruin } from './placement';

/**
 * Wilki: nocą z lasu za mapą wychodzi wataha i poluje na ludzi poza osadą. Palisada je zatrzymuje,
 * żołnierze z nimi walczą. O świcie ocalałe wracają do lasu. Gra pokojowa (poziom 0) ich nie ma.
 */
const SPEED = 30;
const SIGHT = 9;
const BITE = 20; // ticki między ugryzieniami
/** Wilk gryzie mocno, ale nie zabija tłumu: chłop wytrzymuje cztery ugryzienia, a po zabiciu wilk długo pożera ofiarę */
const PEASANT_HP = 30, WOLF_BITE = 8, SOLDIER_BITE = 5, EAT = 300;
/** Zdrowie wilka (pasek nad nim); ranny poniżej FLEE_HP ucieka do lasu */
export const WOLF_HP = 45;
const FLEE_HP = 15;
/** Chłop broni się kijem albo narzędziem: słabo, ale kilku razem przegoni wilka */
const PEASANT_HIT = 4, PEASANT_CD = 20;
/** Strażnik miejski widzi wilka z tylu pól i od razu biegnie go ubić */
const GUARD_SIGHT = 12;

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
  // nowa wataha: co noc od drugiego dnia, o zmierzchu (ok. 19:45), kiedy ludzie siedzą jeszcze przy ogniskach;
  // wychodzi z lasu na skraju mapy najbliżej osady jednego z graczy, żeby zdążyła dojść przed snem i do świtu
  if (!peaceful && clock.day >= 2 && g.tick > 0 && hourStarts(g.tick, 19.75)) {
    const keeps = g.buildings.filter((b) => b.type === 0);
    const k = keeps.length ? keeps[g.rng.int(keeps.length)]! : undefined;
    let side = g.rng.int(4);
    let along = 4 + g.rng.int((side < 2 ? width : height) - 8);
    if (k) {
      const d = [k.y, height - 1 - k.y, k.x, width - 1 - k.x];
      side = d.indexOf(Math.min(...d));
      const c = side < 2 ? k.x : k.y, lim = (side < 2 ? width : height) - 5;
      along = Math.max(4, Math.min(lim, c - 8 + g.rng.int(17)));
    }
    const tile = side === 0 ? along : side === 1 ? (height - 1) * width + along : side === 2 ? along * width : along * width + width - 1;
    const size = 2 + g.rng.int(2);
    for (let i = 0; i < size; i++) {
      const x = tile % width, y = (tile - x) / width;
      g.wolves.push({ id: g.nextId++, px: x * FP + FP / 2 + (i - 1) * 60, py: y * FP + FP / 2, hp: WOLF_HP, path: [], target: 0, cd: 0, leaving: false });
    }
  }
  if (!g.wolves.length) return;
  // wilki polują od zmierzchu do wczesnego ranka (rano łapią tych, co pierwsi wyszli do pracy)
  const day = clock.hour >= 6.5 && clock.hour < 19.5;
  /** Wilki, które zniknęły w lesie (nie zginęły): po nich nie zostaje ciało */
  const gone = new Set<number>();
  for (const w of g.wolves) {
    if (w.cd > 0) w.cd--;
    const here = (w.py >> 8) * width + (w.px >> 8);
    if (day && !w.leaving) { w.leaving = true; w.path = []; w.target = 0; }
    // w pełnym dniu maruder, który nie znalazł drogi do lasu, i tak znika w zaroślach
    if (day && clock.hour >= 8.5) { w.hp = 0; gone.add(w.id); continue; }
    // ciężko ranny ucieka do lasu
    if (!w.leaving && w.hp > 0 && w.hp <= FLEE_HP) { w.leaving = true; w.path = []; w.target = 0; w.gnaw = 0; }
    if (w.leaving) {
      const x = w.px >> 8, y = w.py >> 8;
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) { w.hp = 0; gone.add(w.id); continue; } // zniknął w lesie
      if (!w.path.length && (g.tick + w.id) % 20 === 0) { const out = edgeOut(g, w); w.path = findPath(g, here, (t) => t === out, 3000, WOLF, out) ?? []; }
    } else {
      // ofiara: najbliższy człowiek albo żołnierz w zasięgu wzroku
      let best = SIGHT * SIGHT, prey = 0;
      for (const u of g.units) { if (u.phase === Phase.Sleeping && u.home) continue; const dx = (u.px - w.px) / FP, dy = (u.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; prey = u.id; } }
      for (const s of g.soldiers) { if (high(g, s)) continue; const dx = (s.px - w.px) / FP, dy = (s.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; prey = s.id; } }
      w.target = prey;
      // gryzie z sąsiedniego pola, także po skosie (d² = 2): wcześniej wilk po skosie od śpiącego nie gryzł, nie znajdował drogi i wracał do lasu
      if (prey && best <= 2.1) {
        w.path = [];
        if (w.cd === 0) {
          w.cd = BITE;
          const ui = g.units.findIndex((u) => u.id === prey);
          if (ui >= 0 && (g.units[ui]!.hp ?? PEASANT_HP) - WOLF_BITE > 0) {
            // ugryziony: traci zdrowie, staje i odgania wilka (patrz niżej)
            const u = g.units[ui]!;
            u.hp = (u.hp ?? PEASANT_HP) - WOLF_BITE;
            u.wait = 20; u.path = [];
          } else if (ui >= 0) {
            // trzecie ugryzienie zabija; ciało zostaje, zabierze je grabarz albo wolny chłop
            const u = g.units[ui]!;
            g.corpses.push({ id: u.id, owner: u.owner, kind: -1, px: u.px, py: u.py, at: g.tick, taken: false });
            dropWorker(g, u.id);
            g.units.splice(ui, 1);
            const p = g.players[u.owner];
            if (p) { p.stats.lost++; p.wolfKills = (p.wolfKills ?? 0) + 1; }
            w.cd = EAT; // pożera ofiarę, długo nie poluje
          } else { const s = g.soldiers.find((x) => x.id === prey); if (s) s.hp -= SOLDIER_BITE; }
        }
        continue;
      }
      // obgryza palisadę, przy której stoi
      if (w.gnaw) {
        const wall = buildingById(g, w.gnaw);
        if (!wall) w.gnaw = 0;
        else if (Math.max(Math.abs((w.px >> 8) - wall.x), Math.abs((w.py >> 8) - wall.y)) <= 1 && !w.path.length) {
          if (w.cd === 0) { w.cd = BITE; wall.hp -= 6; if (wall.hp <= 0) { ruin(g, wall); w.gnaw = 0; } }
          continue;
        }
      }
      if (!w.path.length && (g.tick + w.id) % 15 === 0) {
        // poluje na najbliższego człowieka na całej mapie, do którego da się dojść (drwale, rybacy, ci za murem)
        const cands: { d: number; t: number }[] = [];
        for (const u of g.units) if (!(u.phase === Phase.Sleeping && u.home)) cands.push({ d: (u.px - w.px) ** 2 + (u.py - w.py) ** 2, t: (u.py >> 8) * width + (u.px >> 8) });
        for (const v of g.soldiers) if (!high(g, v) && !UNITS[v.kind]!.ram) cands.push({ d: (v.px - w.px) ** 2 + (v.py - w.py) ** 2, t: (v.py >> 8) * width + (v.px >> 8) });
        cands.sort((a, b) => a.d - b.d);
        const near = (t: number) => (x: number): boolean => Math.abs((x % width) - (t % width)) <= 1 && Math.abs(Math.floor(x / width) - Math.floor(t / width)) <= 1;
        for (const c of cands.slice(0, 3)) { const p = findPath(g, here, near(c.t), 3000, WOLF); if (p && p.length) { w.path = p; w.gnaw = 0; break; } }
        if (!w.path.length && cands.length) {
          // wszyscy za palisadą: wataha podchodzi pod najbliższy kawałek muru i go przegryza
          let bestWall: (typeof g.buildings)[number] | undefined, bd = Infinity;
          for (const o of g.buildings) {
            const d = BUILDINGS[o.type]!;
            if (!(d.line || d.gate) || o.ruined) continue;
            const dist = (o.x - (w.px >> 8)) ** 2 + (o.y - (w.py >> 8)) ** 2;
            if (dist < bd) { bd = dist; bestWall = o; }
          }
          if (bestWall) {
            const wall = bestWall;
            const p = findPath(g, here, (x) => Math.max(Math.abs((x % width) - wall.x), Math.abs(Math.floor(x / width) - wall.y)) === 1, 3000, WOLF);
            w.gnaw = wall.id;
            w.path = p ?? [];
          } else { w.leaving = true; w.target = 0; } // wszyscy schowani w zamku, a muru do przegryzienia nie ma: wilk wraca do lasu
        }
      }
    }
    // krok
    const next = w.path[0];
    if (next === undefined) continue;
    if (!walkable(g, next, WOLF)) { w.path = []; continue; }
    const tx = (next % width) * FP + FP / 2, ty = Math.floor(next / width) * FP + FP / 2;
    w.px += Math.max(-SPEED, Math.min(SPEED, tx - w.px));
    w.py += Math.max(-SPEED, Math.min(SPEED, ty - w.py));
    if (w.px === tx && w.py === ty) w.path.shift();
  }
  // chłopi z wilkiem tuż obok odganiają go czym mają pod ręką
  for (const u of g.units) {
    if ((g.tick + u.id) % PEASANT_CD !== 0) continue;
    for (const w of g.wolves) {
      if (w.hp <= 0 || w.leaving) continue;
      const dx = (u.px - w.px) / FP, dy = (u.py - w.py) / FP;
      // odważni (sześciu na dziesięciu) biją kilofem albo maczugą, tchórze tylko machają rękami
      if (dx * dx + dy * dy <= 2.2) { w.hp -= isBrave(u.id) ? (peasantWeapon(u.id) === 'pick' ? PEASANT_HIT + 2 : PEASANT_HIT + 1) : 1; u.wait = Math.max(u.wait, 10); break; }
    }
  }
  // żołnierze bronią się i gonią wilki w pobliżu
  for (const s of g.soldiers) {
    // strażnik miejski: wilk w zasięgu wzroku — rzuca obchód i biegnie go ubić (także uciekającego)
    if (UNITS[s.kind]!.guard && !s.hunt && !s.target && !s.up) {
      let bd = GUARD_SIGHT * GUARD_SIGHT, near: Wolf | undefined;
      for (const w of g.wolves) { if (w.hp <= 0) continue; const d = ((s.px - w.px) / FP) ** 2 + ((s.py - w.py) / FP) ** 2; if (d < bd) { bd = d; near = w; } }
      if (near) { s.hunt = near.id; s.amove = false; s.stance = 0; s.hold = -1; s.slot = undefined; s.goal = (near.py >> 8) * width + (near.px >> 8); s.path = []; }
    }
    if (s.hunt) {
      const prey = g.wolves.find((w) => w.id === s.hunt && w.hp > 0);
      if (!prey) s.hunt = 0;
      else if ((g.tick + s.id) % 15 === 0 && ((s.px - prey.px) / FP) ** 2 + ((s.py - prey.py) / FP) ** 2 > 2.2) { s.goal = (prey.py >> 8) * width + (prey.px >> 8); s.path = []; }
    }
    const def = UNITS[s.kind]!;
    const reach = def.range ? (def.range + (high(g, s) ? 3 : 0)) ** 2 : 2.2;
    // strażnik miejski wypatruje wilków dalej (12 pól) i rzuca obchód, żeby je przegonić; zwykły żołnierz — 6 pól
    const alert = def.guard ? 144 : 36;
    let best = Math.max(alert, reach), wolf: Wolf | undefined;
    // uciekającego rannego wilka strażnik też dobija (pościg kończy smycz obchodu w guards.ts)
    for (const w of g.wolves) { if (w.hp <= 0) continue; const dx = (s.px - w.px) / FP, dy = (s.py - w.py) / FP, d = dx * dx + dy * dy; if (d < best) { best = d; wolf = w; } }
    if (!wolf) continue;
    if (best <= reach && def.range) {
      // łucznik i mag: strzelają do każdego wilka w zasięgu (gdziekolwiek wilk napada — u nas, u wroga, na wojsko),
      // strzała leci jak do ludzi i rani dopiero, gdy doleci; nie przerywa strzelania do wrogich żołnierzy i chłopów
      if (s.shot === g.tick || s.hitting || (s.target && !s.hunt && g.soldiers.some((o) => o.id === s.target))) continue;
      s.hitWolf = wolf.id;
      if (s.cd === 0) {
        s.cd = def.cooldown + hash2(s.id, g.tick, 0x3017) % 4;
        s.shot = g.tick;
        const far = Math.max(Math.abs(wolf.px - s.px), Math.abs(wolf.py - s.py));
        (g.missiles ??= []).push({ to: wolf.id, wolf: true, dmg: def.attack, at: g.tick + (def.magic ? spellTicks(far) : ARROW_TICKS), from: s.id, by: s.owner, ...(def.magic ? { magic: true } : {}) });
      }
      continue;
    }
    if (best <= reach) { if ((g.tick + s.id) % def.cooldown === 0) wolf.hp -= def.attack; }
    else if (def.guard && !s.target && !s.hunt) {
      // strażnik: pościg za wilkiem (obchód czeka, aż wilk padnie albo ucieknie za osadę)
      s.hunt = wolf.id; s.goal = (wolf.py >> 8) * width + (wolf.px >> 8); s.path = []; s.wait = 0;
    }
    else if (!s.up && s.goal < 0 && !s.target && !s.path.length) s.goal = (wolf.py >> 8) * width + (wolf.px >> 8);
  }
  // zabity wilk zostaje na ziemi (rodzaj -2); zabierze go grabarz albo zgnije, obsiądą go kruki
  for (const w of g.wolves) if (w.hp <= 0 && !gone.has(w.id)) g.corpses.push({ id: w.id, owner: -1, kind: -2, px: w.px, py: w.py, at: g.tick, taken: false });
  g.wolves = g.wolves.filter((w) => w.hp > 0);
}

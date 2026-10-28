import { buildingIndex } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import { WALL_TOP } from '../../data/keep';
import { walkable } from '../path';
import { buildingById, FP, type GameState, type Soldier } from '../state';

/**
 * Drabiny oblężnicze jak w Twierdzy (Michał 28.10.2026). Przystawia je drabiniarz (jednostka z koszar, bez broni):
 * niesie jedną drabinę szturmową ze zbrojowni (robi je cieśla), na rozkaz (prawy klik na wrogim murze) albo sam,
 * gdy wrogi mur kamienny jest blisko, podchodzi pod niego i przez chwilę ją stawia. Potem biegnie po następną do
 * zamku albo do namiotu polowego i bierze ją ze zbrojowni (jeśli jest). Drabina otwiera ten bok muru dla każdego
 * (jak drabina gracza) — po niej wchodzi wojsko — aż obrońcy z korony ją zepchną, mur padnie albo sama się przewróci.
 * Bot szkoli drabiniarzy i używa ich tak samo.
 */

/** Strony muru: 0 = -y, 1 = +x, 2 = +y, 3 = -x — [dx, dy, bit ściany pola] (bity jak w stonewalls.ts) */
export const LADDER_SIDES: readonly [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
/** Ile ticków trwa przystawienie drabiny */
export const PLANT_TICKS = 30;
/** Ile wytrzyma spychania (każdy obrońca na koronie przy drabinie zdejmuje 1 na tick, gdy nikt po niej nie wchodzi) */
const LADDER_HP = 60;
/** Po tylu tickach drabina sama się przewraca */
const LADDER_LIFE = 6000;
const STONE = buildingIndex('stoneWall');
const LADDER_RES = resIndex('ladder');
/** Czy gracz ma w zbrojowni drabinę szturmową */
export const hasLadder = (g: GameState, player: number): boolean => (g.players[player]?.res[LADDER_RES] ?? 0) >= 1;

const isStoneWall = (g: GameState, t: number): boolean => {
  const b = g.occupancy[t] ? buildingById(g, g.occupancy[t]) : undefined;
  return !!b && b.type === STONE && !b.build && !b.ruined;
};
const team = (g: GameState, p: number): number => g.players[p]?.team ?? p;

/** Pole korony muru kamiennego, na które da się przystawić drabinę (do celu stojącego na tym polu) */
export const climbableWall = (g: GameState, t: number): boolean => (g.walls[t]! & WALL_TOP) !== 0 && isStoneWall(g, t);

/** Boki muru otwarte przez drabiny oblężnicze: pole muru → maska bitów (stonewalls.ts zdejmuje te ściany) */
export function ladderMasks(g: GameState): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of g.siegeLadders ?? []) {
    const side = LADDER_SIDES.findIndex(([dx, dy]) => dx === l.dx && dy === l.dy);
    if (side >= 0) m.set(l.wall, (m.get(l.wall) ?? 0) | LADDER_SIDES[side]![2]);
  }
  return m;
}

/**
 * Gdzie przystawić drabinę do pola muru `wall`: bok z wolnym polem ziemi u stóp, najbliżej żołnierza.
 * Zwraca ładunek pola rozkazu (wall * 4 + strona) albo -1.
 */
export function ladderSpot(g: GameState, s: Soldier, wall: number): number {
  const w = g.map.width, x = wall % w, y = (wall - x) / w, sx = s.px >> 8, sy = s.py >> 8;
  let best = -1, bd = Infinity;
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = LADDER_SIDES[k]!, fx = x + dx, fy = y + dy;
    if (fx < 0 || fy < 0 || fx >= w || fy >= g.map.height) continue;
    const ft = fy * w + fx;
    if (g.walls[ft] || !walkable(g, ft, s.owner)) continue;
    const d = Math.abs(fx - sx) + Math.abs(fy - sy);
    if (d < bd) { bd = d; best = wall * 4 + k; }
  }
  return best;
}

/** Pole u stóp drabiny z ładunku `wall * 4 + strona` */
export function ladderFoot(g: GameState, code: number): number {
  const wall = code >> 2, [dx, dy] = LADDER_SIDES[code & 3]!, w = g.map.width;
  return wall + dy * w + dx;
}

/**
 * Żołnierz przystawiający drabinę: stoi u stóp muru i liczy ticki; po PLANT_TICKS drabina stoi.
 * Zwraca true, gdy w tym ticku tylko stawiał drabinę (nic innego nie robi).
 */
export function plantStep(g: GameState, s: Soldier): boolean {
  if (s.ladder === undefined) return false;
  const code = s.ladder, wall = code >> 2, foot = ladderFoot(g, code);
  const here = (s.py >> 8) * g.map.width + (s.px >> 8);
  if (!isStoneWall(g, wall)) { s.ladder = undefined; s.ladderT = undefined; return false; }
  if (here !== foot) {
    // nie doszedł (droga zamknięta albo dostał inny rozkaz): rezygnuje
    if (s.goal !== foot) { s.ladder = undefined; s.ladderT = undefined; }
    return false;
  }
  const [dx, dy] = LADDER_SIDES[code & 3]!;
  const list = (g.siegeLadders ??= []);
  if (list.some((l) => l.wall === wall && l.dx === dx && l.dy === dy)) { s.ladder = undefined; s.ladderT = undefined; return false; }
  s.ladderT = (s.ladderT ?? 0) + 1;
  s.path = []; s.goal = -1;
  if (s.ladderT >= PLANT_TICKS) {
    // drabinę niesie drabiniarz (wziął ją ze zbrojowni); bez niej nie ma czego przystawić
    if (s.noLadder) { s.ladder = undefined; s.ladderT = undefined; return false; }
    s.noLadder = true;
    // drabina oparta o mur: (dx, dy) w drabinie to kierunek od muru do stóp
    list.push({ id: g.nextId++, owner: s.owner, wall, dx, dy, at: g.tick, hp: LADDER_HP });
    s.ladder = undefined; s.ladderT = undefined;
    // stoi pod murem przodem do niego, gotów wejść
    s.px = (foot % g.map.width) * FP + FP / 2; s.py = Math.floor(foot / g.map.width) * FP + FP / 2;
  }
  return true;
}

const KEEP = 0;
const TENT = buildingIndex('fieldTent');
/** Skąd drabiniarz bierze nową drabinę: najbliższy własny zamek albo gotowy namiot polowy (pole przed wejściem) */
function supplyDoor(g: GameState, s: Soldier): number {
  const w = g.map.width, sx = s.px >> 8, sy = s.py >> 8;
  let best = -1, bd = Infinity;
  for (const b of g.buildings) {
    if (b.owner !== s.owner || b.build || b.ruined || (b.type !== KEEP && b.type !== TENT) || b.door < 0) continue;
    const dx = (b.door % w) - sx, dy = Math.floor(b.door / w) - sy, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = b.door; }
  }
  return best;
}
/** Najbliższe pole wrogiego muru kamiennego w promieniu R pól, pod które da się podejść z drabiną (kod rozkazu albo -1) */
function wallNear(g: GameState, s: Soldier, R: number): number {
  const w = g.map.width, h = g.map.height, sx = s.px >> 8, sy = s.py >> 8;
  const my = team(g, s.owner);
  let best = -1, bd = Infinity;
  for (let y = Math.max(0, sy - R); y <= Math.min(h - 1, sy + R); y++)
    for (let x = Math.max(0, sx - R); x <= Math.min(w - 1, sx + R); x++) {
      const t = y * w + x;
      if (!climbableWall(g, t)) continue;
      const b = buildingById(g, g.occupancy[t]);
      if (!b || team(g, b.owner) === my) continue;
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d >= bd) continue;
      const code = ladderSpot(g, s, t);
      if (code < 0) continue;
      // przy tym boku już stoi drabina: wystarczy jedna
      const [dx, dy] = LADDER_SIDES[code & 3]!;
      if ((g.siegeLadders ?? []).some((l) => l.wall === t && l.dx === dx && l.dy === dy)) continue;
      bd = d; best = code;
    }
  return best;
}

/**
 * Drabiniarz co tick (gdy akurat nie stawia drabiny): bez drabiny biegnie po nową do zamku albo namiotu polowego;
 * z drabiną idzie pod wrogi mur wskazany rozkazem albo sam, gdy taki mur jest blisko. Nie walczy.
 * Zwraca true, gdy w tym ticku tylko czeka (np. na drabinę w zbrojowni).
 */
export function ladderStep(g: GameState, s: Soldier): boolean {
  if (s.ladder !== undefined) return false;
  const w = g.map.width, here = (s.py >> 8) * w + (s.px >> 8);
  // drabiniarz nie walczy: cel-żołnierz to tylko kierunek (idzie tam, ale nie bije)
  const tb = s.target ? buildingById(g, s.target) : undefined;
  if (s.target && !tb) s.target = 0;
  if (s.noLadder) {
    const door = supplyDoor(g, s);
    if (door < 0) return false;
    const near = Math.max(Math.abs((door % w) - (here % w)), Math.abs(Math.floor(door / w) - Math.floor(here / w))) <= 1;
    if (near) {
      const p = g.players[s.owner];
      if (p && p.res[LADDER_RES]! >= 1) { p.res[LADDER_RES]!--; s.noLadder = undefined; s.goal = -1; s.path = []; }
      return true;
    }
    if (s.goal < 0 && !s.path.length) s.goal = door;
    return false;
  }
  // rozkaz: prawy klik na wrogim murze kamiennym (rozkaz ataku na budynek)
  if (tb && tb.type === STONE && !tb.build && !tb.ruined && team(g, tb.owner) !== team(g, s.owner)) {
    const t = tb.y * w + tb.x;
    const code = ladderSpot(g, s, t);
    s.target = 0;
    if (code >= 0) { s.ladder = code; s.ladderT = 0; s.goal = ladderFoot(g, code); s.path = []; }
    return false;
  }
  if (tb) s.target = 0;
  // sam: wrogi mur w pobliżu (stoi w miejscu albo idzie z rozkazem „atak w marszu”), co 10 ticków
  if ((s.goal < 0 || s.amove) && (g.tick + s.id) % 10 === 0) {
    const code = wallNear(g, s, 7);
    if (code >= 0) { s.ladder = code; s.ladderT = 0; s.goal = ladderFoot(g, code); s.path = []; s.amove = false; s.slot = undefined; }
  }
  return false;
}

/** Co tick: obrońcy na koronie spychają drabiny, przy których nikt nie wchodzi; drabina pada z murem albo ze starości */
export function siegeLadderSystem(g: GameState): void {
  const list = g.siegeLadders;
  if (!list?.length) return;
  const w = g.map.width;
  const on = new Map<number, Soldier[]>();
  for (const s of g.soldiers) if (s.hp > 0) { const t = (s.py >> 8) * w + (s.px >> 8); let l = on.get(t); if (!l) { l = []; on.set(t, l); } l.push(s); }
  g.siegeLadders = list.filter((l) => {
    if (!isStoneWall(g, l.wall) || g.tick - l.at > LADDER_LIFE) return false;
    const b = buildingById(g, g.occupancy[l.wall]);
    const foot = l.wall + l.dy * w + l.dx;
    // ktoś właśnie po niej wchodzi albo stoi u jej stóp z wrogiej strony: nie da się jej zepchnąć
    if (!b) return true;
    const busy = (on.get(foot) ?? []).some((s) => team(g, s.owner) !== team(g, b.owner)) || (on.get(l.wall) ?? []).some((s) => s.climbTo === foot);
    if (busy) return true;
    const defenders = (on.get(l.wall) ?? []).filter((s) => team(g, s.owner) === team(g, b.owner)).length;
    l.hp -= defenders;
    return l.hp > 0;
  });
}

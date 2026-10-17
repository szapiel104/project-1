/**
 * Drogi kopaczy w sztolni (osobna lokacja kopalni, model `minelevel`): od wrót do przodka i z powrotem.
 * Liczone raz z sal i przeszkód modelu: siatka co 0,15 m, A* po wolnych polach, potem prostowanie drogi
 * (punkt widzi punkt bez przeszkody). Przodki na dolnym poziomie dochodzą przez szyb z drabiną.
 * Tylko wygląd — symulacja zna jedynie czas pracy z dojściem (`walkTicks` kopalni).
 */
export type Rect = [number, number, number, number];
type P = [number, number];

export interface MineLevelData {
  rooms: Rect[]; solid: Rect[]; entry: [number, number, number]; exit: Rect;
  rooms2?: Rect[]; solid2?: Rect[]; low?: number; hole?: Rect; down?: [number, number]; up?: [number, number];
}

/** Droga do jednego przodka: odcinek na górze (od wrót), opcjonalnie drabina i odcinek na dole */
export interface MineRoute {
  top: P[];
  low?: P[];
  /** Długości odcinków w metrach */
  topLen: number;
  lowLen: number;
}

/** Ile trwa zejście albo wejście po drabinie (s) */
export const CLIMB_S = 1.8;
/** Zwykły krok kopacza w sztolni (m/s) i najszybszy, gdy przodek leży daleko, a czas dojścia jest stały */
export const MINE_WALK = 1.35;
const MINE_WALK_MAX = 2.6;

const CELL = 0.15;
const PAD = 0.1;

class Grid {
  x0: number; z0: number; w: number; h: number; free: Uint8Array;
  constructor(rooms: Rect[], solid: Rect[]) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of rooms) { x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[1]); z0 = Math.min(z0, r[2]); z1 = Math.max(z1, r[3]); }
    this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil((x1 - x0) / CELL) + 1; this.h = Math.ceil((z1 - z0) / CELL) + 1;
    this.free = new Uint8Array(this.w * this.h);
    const inside = (x: number, z: number): boolean => rooms.some((r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]);
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const x = x0 + i * CELL, z = z0 + j * CELL;
        let ok = inside(x, z) && inside(x - PAD, z) && inside(x + PAD, z) && inside(x, z - PAD) && inside(x, z + PAD);
        if (ok) for (const s of solid) if (x > s[0] - PAD && x < s[1] + PAD && z > s[2] - PAD && z < s[3] + PAD) { ok = false; break; }
        this.free[j * this.w + i] = ok ? 1 : 0;
      }
  }
  cell(x: number, z: number): number {
    const i = Math.round((x - this.x0) / CELL), j = Math.round((z - this.z0) / CELL);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  pos(c: number): P { return [this.x0 + (c % this.w) * CELL, this.z0 + Math.floor(c / this.w) * CELL]; }
  /** Najbliższe wolne pole (punkt może leżeć tuż przy ścianie albo przy przeszkodzie) */
  nearestFree(x: number, z: number): number {
    let best = -1, bd = Infinity;
    for (let c = 0; c < this.free.length; c++) {
      if (!this.free[c]) continue;
      const [px, pz] = this.pos(c), d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  /** Wolne pole osiągalne z `from`, najbliższe punktu `b` */
  nearestReachable(from: number, b: P): number {
    const seen = new Uint8Array(this.free.length), q = [from];
    seen[from] = 1;
    let best = from, bd = Infinity;
    while (q.length) {
      const c = q.pop()!, [x, z] = this.pos(c), d = (x - b[0]) ** 2 + (z - b[1]) ** 2;
      if (d < bd) { bd = d; best = c; }
      const ci = c % this.w, cj = (c - ci) / this.w;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = ci + di, nj = cj + dj, nc = nj * this.w + ni;
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h || seen[nc] || !this.free[nc]) continue;
        seen[nc] = 1; q.push(nc);
      }
    }
    return best;
  }
  /** Prosta z a do b nie wchodzi na zajęte pole */
  clear(a: P, b: P): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.5)));
    for (let k = 0; k <= n; k++) {
      const c = this.cell(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
      if (c < 0 || !this.free[c]) return false;
    }
    return true;
  }
  /** A* po polach (8 sąsiadów, bez ścinania rogów) */
  search(from: number, to: number): number[] | null {
    const { w, h } = this;
    const gs = new Float32Array(w * h).fill(Infinity), came = new Int32Array(w * h).fill(-1);
    const done = new Uint8Array(w * h);
    const open: number[] = [from];
    gs[from] = 0;
    const [tx, tz] = this.pos(to);
    const hf = (c: number): number => { const [x, z] = this.pos(c); return Math.hypot(x - tx, z - tz); };
    while (open.length) {
      let bi = 0, bf = Infinity;
      for (let i = 0; i < open.length; i++) { const f = gs[open[i]!]! + hf(open[i]!); if (f < bf) { bf = f; bi = i; } }
      const c = open[bi]!;
      open[bi] = open[open.length - 1]!; open.pop();
      if (c === to) break;
      if (done[c]) continue;
      done[c] = 1;
      const ci = c % w, cj = (c - ci) / w;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const nc = nj * w + ni;
          if (!this.free[nc] || done[nc]) continue;
          if (di && dj && (!this.free[cj * w + ni] || !this.free[nj * w + ci])) continue;
          const ng = gs[c]! + (di && dj ? Math.SQRT2 : 1) * CELL;
          if (ng < gs[nc]!) { gs[nc] = ng; came[nc] = c; open.push(nc); }
        }
    }
    if (from !== to && came[to]! < 0) return null;
    const out: number[] = [to];
    for (let c = to; c !== from; ) { c = came[c]!; out.push(c); }
    return out.reverse();
  }
  /** Droga z punktu do punktu: krańce dokładne, środek po wolnych polach, wyprostowana */
  route(a: P, b: P): P[] {
    const ca = this.free[this.cell(a[0], a[1])] ? this.cell(a[0], a[1]) : this.nearestFree(a[0], a[1]);
    const cb = this.free[this.cell(b[0], b[1])] ? this.cell(b[0], b[1]) : this.nearestFree(b[0], b[1]);
    let cells = ca >= 0 && cb >= 0 ? this.search(ca, cb) : null;
    // cel w zaułku, do którego nie da się dojść: idzie najbliżej, jak się da, i ostatni krok robi przy samej skale
    if (!cells && ca >= 0) { const near = this.nearestReachable(ca, b); cells = this.search(ca, near); }
    const raw: P[] = [a, ...(cells ?? []).map((c) => this.pos(c)), b];
    // prostowanie: z każdego punktu skok do najdalszego widocznego
    const out: P[] = [raw[0]!];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.clear(raw[i]!, raw[j]!)) j--;
      out.push(raw[j]!);
      i = j;
    }
    return out;
  }
}

const length = (pts: P[]): number => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]); return s; };

/** Wrota sztolni: skąd kopacz wchodzi i gdzie znika, wychodząc (środek strefy wyjścia) */
export function mineGate(m: MineLevelData): P { return [(m.exit[0] + m.exit[1]) / 2, (m.exit[2] + m.exit[3]) / 2]; }

/** Drogi do przodków w kolejności `spots` (x, y posadzki, z, kierunek): y ≠ 0 = dolny poziom */
export function mineRoutes(m: MineLevelData, spots: [number, number, number, number][]): MineRoute[] {
  const top = new Grid(m.rooms, m.solid);
  const low = m.rooms2?.length ? new Grid(m.rooms2, m.solid2 ?? []) : null;
  const gate = mineGate(m);
  const hole: P | null = m.hole ? [(m.hole[0] + m.hole[1]) / 2, (m.hole[2] + m.hole[3]) / 2] : null;
  return spots.map(([x, y, z]) => {
    if (y !== 0 && low && hole && m.down) {
      const a = top.route(gate, hole), b = low.route([hole[0], hole[1] + 0.12], [x, z]);
      return { top: a, low: b, topLen: length(a), lowLen: length(b) };
    }
    const a = top.route(gate, [x, z]);
    return { top: a, topLen: length(a), lowLen: 0 };
  });
}

/** Ile sekund trwa przejście drogą w stałym czasie dojścia `budget` (s): zwykłym krokiem, a gdy daleko — szybciej */
export function routeTime(r: MineRoute, budget: number): { walk: number; speed: number } {
  const climb = r.low ? CLIMB_S : 0, len = r.topLen + r.lowLen;
  const speed = Math.min(MINE_WALK_MAX, Math.max(MINE_WALK, len / Math.max(0.5, budget - climb)));
  return { walk: len / speed + climb, speed };
}

export interface MineWalkPose { x: number; y: number; z: number; yaw: number; climbing: boolean; moving: boolean }

const along = (pts: P[], d: number): { x: number; z: number; yaw: number } => {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === pts.length - 1) {
      const k = l ? Math.min(1, d / l) : 1;
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= l;
  }
  const p = pts[pts.length - 1]!;
  return { x: p[0], z: p[1], yaw: 0 };
};

/**
 * Gdzie jest kopacz po `t` sekundach drogi od wrót do przodka (0 = we wrotach). Ten sam wzór służy powrotowi:
 * wtedy `t` liczy się wstecz (od przodka do wrót), a kierunek twarzy odwraca się o pół obrotu.
 */
export function poseOnRoute(r: MineRoute, speed: number, t: number, low: number, hole: Rect | undefined, back: boolean): MineWalkPose {
  const d = t * speed;
  const flip = back ? Math.PI : 0;
  if (d <= r.topLen || !r.low) {
    const p = along(r.top, Math.min(d, r.topLen));
    return { x: p.x, y: 0, z: p.z, yaw: p.yaw + flip, climbing: false, moving: d < r.topLen - 1e-6 };
  }
  const tc = t - r.topLen / speed;
  if (tc < CLIMB_S && hole) {
    // na drabinie w szybie: twarzą do szczebli, krok po kroku w dół (wracający — w górę)
    const k = tc / CLIMB_S, e = k * k * (3 - 2 * k);
    return { x: (hole[0] + hole[1]) / 2, y: low * e, z: (hole[2] + hole[3]) / 2 + 0.12, yaw: 0, climbing: true, moving: true };
  }
  const p = along(r.low, Math.min((tc - CLIMB_S) * speed, r.lowLen));
  return { x: p.x, y: low, z: p.z, yaw: p.yaw + flip, climbing: false, moving: (tc - CLIMB_S) * speed < r.lowLen - 1e-6 };
}

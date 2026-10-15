import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

/**
 * Rachunki dalekiej wersji budynku bez three.js (działają w osobnym wątku przeglądarki i w testach):
 * spawanie wierzchołków, upraszczanie meshoptimizerem poziom po poziomie, płaskie normalne i tekstura z położenia.
 */

/** Jedna siatka do uproszczenia: trójkąty po kolei (bez indeksów), kolor (cień × barwa względem wzorca), numer materiału */
export interface BucketData { pos: Float32Array; col: Float32Array; member: Uint8Array; k: number }
export interface GeoData { P: Float32Array; N: Float32Array; C: Float32Array; UV: Float32Array }
export interface LevelData { geos: (GeoData | null)[]; tris: number; error: number }

/** Waga różnicy koloru (cień w zagłębieniach z Blendera) przy upraszczaniu: plamy cienia nie rozmywają się */
const COLOR_WEIGHT = 0.06;

export const coreReady: Promise<void> = MS.supported ? MS.ready : Promise.reject(new Error('brak WebAssembly'));

/**
 * Każdy kolejny poziom powstaje z poprzedniego (szybciej niż od zera), z błędem `steps[i]` względem poprzedniego;
 * błąd poziomu względem pełnego modelu to suma kroków (ostrożne oszacowanie).
 */
export function simplifyAll(buckets: BucketData[], steps: number[]): LevelData[] {
  const welded = buckets.map(weld);
  const cur = welded.map((w) => (w ? w.idx : null));
  const acc = buckets.map(() => 0);
  const out: LevelData[] = [];
  for (const step of steps) {
    const geos: (GeoData | null)[] = [];
    let tris = 0, error = 0;
    welded.forEach((w, i) => {
      const idx = cur[i];
      if (!w || !idx || idx.length < 3) { geos.push(null); cur[i] = null; return; }
      const [res, err] = MS.simplifyWithAttributes(idx, w.vp, 3, w.vc, 3, [COLOR_WEIGHT, COLOR_WEIGHT, COLOR_WEIGHT], null, 0, step, ['ErrorAbsolute', 'Prune']);
      acc[i] = acc[i]! + err;
      cur[i] = res;
      if (res.length < 3) { geos.push(null); return; }
      geos.push(unweld(res, w.vp, w.vc, buckets[i]!.k));
      tris += res.length / 3;
      error = Math.max(error, acc[i]!);
    });
    out.push({ geos, tris, error });
  }
  return out;
}

/** Wierzchołek = (położenie, materiał); kolor uśredniony z rogów trójkątów, które się w nim spotykają */
function weld(b: BucketData): { vp: Float32Array; vc: Float32Array; idx: Uint32Array } | null {
  const n = b.pos.length / 3;
  if (n < 3) return null;
  const remap = MS.generatePositionRemap(b.pos, 3);
  const single = b.member.every((m) => m === b.member[0]);
  const ids = single ? null : new Map<number, number>();
  const slot = single ? new Int32Array(n).fill(-1) : null;
  const idx = new Uint32Array(n);
  const vp = new Float32Array(n * 3), vc = new Float32Array(n * 3), w = new Float32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = remap[i]!;
    let id: number;
    if (slot) { id = slot[r]!; if (id < 0) { id = count++; slot[r] = id; vp[id * 3] = b.pos[i * 3]!; vp[id * 3 + 1] = b.pos[i * 3 + 1]!; vp[id * 3 + 2] = b.pos[i * 3 + 2]!; } }
    else {
      const key = r * 256 + b.member[i]!;
      const hit = ids!.get(key);
      if (hit === undefined) { id = count++; ids!.set(key, id); vp[id * 3] = b.pos[i * 3]!; vp[id * 3 + 1] = b.pos[i * 3 + 1]!; vp[id * 3 + 2] = b.pos[i * 3 + 2]!; } else id = hit;
    }
    vc[id * 3] = vc[id * 3]! + b.col[i * 3]!; vc[id * 3 + 1] = vc[id * 3 + 1]! + b.col[i * 3 + 1]!; vc[id * 3 + 2] = vc[id * 3 + 2]! + b.col[i * 3 + 2]!;
    w[id] = w[id]! + 1;
    idx[i] = id;
  }
  for (let i = 0; i < count; i++) { const k = w[i]!; vc[i * 3] = vc[i * 3]! / k; vc[i * 3 + 1] = vc[i * 3 + 1]! / k; vc[i * 3 + 2] = vc[i * 3 + 2]! / k; }
  return { vp: vp.slice(0, count * 3), vc: vc.slice(0, count * 3), idx };
}

/** Trójkąty z indeksów → osobne wierzchołki, płaskie normalne, tekstura rzutowana na płaszczyznę ściany (jak w Blenderze) */
function unweld(idx: Uint32Array, vp: Float32Array, vc: Float32Array, k: number): GeoData {
  const n = idx.length;
  const P = new Float32Array(n * 3), C = new Float32Array(n * 3), UV = new Float32Array(n * 2), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = idx[i]!;
    P[i * 3] = vp[s * 3]!; P[i * 3 + 1] = vp[s * 3 + 1]!; P[i * 3 + 2] = vp[s * 3 + 2]!;
    C[i * 3] = vc[s * 3]!; C[i * 3 + 1] = vc[s * 3 + 1]!; C[i * 3 + 2] = vc[s * 3 + 2]!;
  }
  for (let t = 0; t < n; t += 3) {
    const ax = P[t * 3]!, ay = P[t * 3 + 1]!, az = P[t * 3 + 2]!;
    const e1x = P[t * 3 + 3]! - ax, e1y = P[t * 3 + 4]! - ay, e1z = P[t * 3 + 5]! - az;
    const e2x = P[t * 3 + 6]! - ax, e2y = P[t * 3 + 7]! - ay, e2z = P[t * 3 + 8]! - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const X = Math.abs(nx), Y = Math.abs(ny), Z = Math.abs(nz);
    for (let v = t; v < t + 3; v++) {
      const x = P[v * 3]!, y = P[v * 3 + 1]!, z = P[v * 3 + 2]!;
      const top = Y >= X && Y >= Z, side = !top && X >= Z;
      UV[v * 2] = (top ? x : side ? z : x) * k;
      UV[v * 2 + 1] = (top ? z : y) * k;
      N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz;
    }
  }
  return { P, N, C, UV };
}

import * as THREE from 'three';

/**
 * Tekstury postaci rysowane w kodzie (zdjęć skóry, wełny czy kutego żelaza nie mamy, a z kontenera serwisy z teksturami
 * są zablokowane). Każda tekstura jest szara (barwę daje kolor ubrania, skóry, pancerza z modelu i gry) i ma swoją
 * mapę normalnych liczoną z tej samej „wysokości”, więc splot, ziarno i rysy łapią światło z bliska.
 *
 * - wool:    gruba wełna/len — splot nitek, meszek, przetarcia, plamy brudu
 * - leather: skóra — ziarno komórkowe, zagniecenia, rysy, ciemniejsze przetarte miejsca
 * - metal:   kute żelazo — wgniecenia od młota, rysy w różnych kierunkach, ciemny nalot
 * - skin:    skóra człowieka — delikatne plamki i pory (bardzo słabo, żeby twarze nie były brudne)
 */
export type CharTex = 'wool' | 'leather' | 'metal' | 'skin';

const N = 512;
const cache = new Map<CharTex, { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture }>();

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** Szum wartości z kilku oktaw, zawijany (tekstura się powtarza bez szwu) */
function fbm(seed: number, cellsList: number[], weights: number[]): Float32Array {
  const out = new Float32Array(N * N);
  cellsList.forEach((cells, o) => {
    const r = rng(seed + cells * 977);
    const v = new Float32Array(cells * cells);
    for (let i = 0; i < v.length; i++) v[i] = r();
    const w = weights[o]!;
    for (let y = 0; y < N; y++) {
      const fy = (y / N) * cells, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % cells;
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * cells, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % cells;
        const a = v[y0 * cells + x0]! * (1 - sx) + v[y0 * cells + x1]! * sx;
        const b = v[y1 * cells + x0]! * (1 - sx) + v[y1 * cells + x1]! * sx;
        out[y * N + x]! += (a * (1 - sy) + b * sy) * w;
      }
    }
  });
  return out;
}

/** Komórki (Worley): odległość do najbliższego punktu — ziarno skóry, wgniecenia od młota */
function cells(seed: number, count: number): Float32Array {
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) pts.push([r() * N, r() * N]);
  const grid = Math.ceil(Math.sqrt(count)), cs = N / grid;
  const buckets: [number, number][][] = Array.from({ length: grid * grid }, () => []);
  for (const p of pts) buckets[Math.min(grid - 1, Math.floor(p[1] / cs)) * grid + Math.min(grid - 1, Math.floor(p[0] / cs))]!.push(p);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
      let best = 1e9;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const bx = (gx + dx + grid) % grid, by = (gy + dy + grid) % grid;
          for (const [px, py] of buckets[by * grid + bx]!) {
            let ddx = Math.abs(px - x), ddy = Math.abs(py - y);
            if (ddx > N / 2) ddx = N - ddx;
            if (ddy > N / 2) ddy = N - ddy;
            const d = ddx * ddx + ddy * ddy;
            if (d < best) best = d;
          }
        }
      out[y * N + x] = Math.sqrt(best) / cs;
    }
  return out;
}

/** Rysy: cienkie, krótkie linie wbite w wysokość (ujemne) */
function scratches(h: Float32Array, seed: number, count: number, len: number, depth: number, dir?: number): void {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    let x = r() * N, y = r() * N;
    const a = dir !== undefined ? dir + (r() - 0.5) * 0.5 : r() * Math.PI;
    const l = len * (0.4 + r());
    const d = depth * (0.4 + r() * 0.6);
    for (let t = 0; t < l; t++) {
      x += Math.cos(a); y += Math.sin(a);
      const xi = ((Math.round(x) % N) + N) % N, yi = ((Math.round(y) % N) + N) % N;
      h[yi * N + xi]! -= d;
    }
  }
}

function heightOf(kind: CharTex): { h: Float32Array; albedo: Float32Array } {
  const h = new Float32Array(N * N), a = new Float32Array(N * N);
  if (kind === 'wool') {
    // ręcznie tkana wełna: nitki nierównej grubości (zgrubienia), splot płócienny, meszek, wyciągnięte włókna, brud
    const fuzz = fbm(11, [16, 48, 160], [0.5, 0.3, 0.2]);
    const dirt = fbm(12, [4, 9, 20], [0.55, 0.3, 0.15]);
    const slub = fbm(13, [32, 96], [0.6, 0.4]);
    const T = 8, cols = N / T;
    const r = rng(14);
    const colW = Array.from({ length: cols }, () => 0.75 + r() * 0.5), rowW = Array.from({ length: cols }, () => 0.75 + r() * 0.5);
    const colB = Array.from({ length: cols }, () => (r() - 0.5) * 0.1), rowB = Array.from({ length: cols }, () => (r() - 0.5) * 0.1);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const cx = Math.floor(x / T), cy = Math.floor(y / T);
        const over = (cx + cy) % 2 === 0;
        const u = (x % T) / T, v = (y % T) / T;
        const tw = colW[cx]! * (0.8 + slub[i]! * 0.4), th = rowW[cy]! * (0.8 + slub[(i + N * 7) % (N * N)]! * 0.4);
        const warp = Math.pow(Math.max(0, Math.sin(u * Math.PI)), 1 / tw), weft = Math.pow(Math.max(0, Math.sin(v * Math.PI)), 1 / th);
        const w = over ? warp * 0.85 + weft * 0.15 : weft * 0.85 + warp * 0.15;
        h[i] = w * 0.6 + slub[i]! * 0.2 + fuzz[i]! * 0.3;
        const worn = dirt[i]! > 0.6 ? (dirt[i]! - 0.6) * 1.3 : 0;
        a[i] = 0.8 + w * 0.06 + (over ? colB[cx]! : rowB[cy]!) + (fuzz[i]! - 0.5) * 0.16 - worn;
      }
    scratches(a, 15, 900, 7, -0.08);   // wyciągnięte, jaśniejsze włókna
    scratches(h, 16, 900, 7, -0.25);
  } else if (kind === 'leather') {
    const c = cells(21, 2600);
    const big = fbm(22, [5, 12, 30], [0.5, 0.3, 0.2]);
    for (let i = 0; i < N * N; i++) {
      const g = Math.min(1, c[i]! * 1.3);
      h[i] = g * 0.3 + big[i]! * 0.5;
      a[i] = 0.8 + g * 0.05 + (big[i]! - 0.5) * 0.28;
    }
    scratches(h, 23, 160, 24, 0.2);
    scratches(a, 24, 120, 20, -0.12); // jaśniejsze, wytarte rysy
    // zagniecenia: długie, miękkie fałdy
    const fold = fbm(25, [3, 7], [0.7, 0.3]);
    for (let i = 0; i < N * N; i++) { const f = Math.abs(fold[i]! - 0.5) < 0.03 ? 1 : 0; h[i]! -= f * 0.3; a[i]! -= f * 0.08; }
  } else if (kind === 'metal') {
    const dents = cells(31, 420);
    const tarn = fbm(32, [4, 10, 28, 90], [0.45, 0.3, 0.15, 0.1]);
    for (let i = 0; i < N * N; i++) {
      const d = Math.min(1, dents[i]!);
      h[i] = d * d * 0.6 + tarn[i]! * 0.15;
      a[i] = 0.78 - (tarn[i]! > 0.55 ? (tarn[i]! - 0.55) * 1.4 : 0) + d * 0.05;   // ciemny nalot w zagłębieniach
    }
    scratches(h, 33, 420, 14, 0.12);
    scratches(a, 34, 300, 12, -0.08); // świeże rysy jaśniejsze
  } else {
    const mott = fbm(41, [6, 20, 70, 220], [0.4, 0.3, 0.2, 0.1]);
    for (let i = 0; i < N * N; i++) { h[i] = mott[i]! * 0.4; a[i] = 0.97 + (mott[i]! - 0.5) * 0.08; }
  }
  return { h, albedo: a };
}

function toCanvas(fill: (px: Uint8ClampedArray) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Szara tekstura i mapa normalnych dla rodzaju materiału postaci (liczone raz, potem z pamięci) */
export function charTexture(kind: CharTex): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } | null {
  if (typeof document === 'undefined') return null;
  const have = cache.get(kind);
  if (have) return have;
  const { h, albedo } = heightOf(kind);
  const strength = kind === 'wool' ? 2.2 : kind === 'leather' ? 2.6 : kind === 'metal' ? 3.2 : 0.8;
  const mapCanvas = toCanvas((px) => {
    for (let i = 0; i < N * N; i++) { const v = Math.max(0, Math.min(255, Math.round(albedo[i]! * 255))); px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  });
  const nCanvas = toCanvas((px) => {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const l = h[y * N + ((x - 1 + N) % N)]!, r = h[y * N + ((x + 1) % N)]!;
        const u = h[((y - 1 + N) % N) * N + x]!, d = h[((y + 1) % N) * N + x]!;
        let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
        const i = (y * N + x) * 4;
        px[i] = Math.round((nx * 0.5 + 0.5) * 255); px[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); px[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); px[i + 3] = 255;
      }
  });
  const make = (c: HTMLCanvasElement): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const out = { map: make(mapCanvas), normalMap: make(nCanvas) };
  cache.set(kind, out);
  return out;
}

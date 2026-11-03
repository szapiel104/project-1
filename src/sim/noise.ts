import { hash2 } from './rng';

const FP = 256; // stały przecinek: 8 bitów części ułamkowej

/** Szum wartościowy z interpolacją dwuliniową, w całości na liczbach całkowitych. Wynik 0..255. */
export function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = Math.floor(((x - gx * cell) * FP) / cell);
  const fy = Math.floor(((y - gy * cell) * FP) / cell);
  // wygładzenie 3t^2 - 2t^3 w stałym przecinku
  const sx = Math.floor((fx * fx * (3 * FP - 2 * fx)) / (FP * FP));
  const sy = Math.floor((fy * fy * (3 * FP - 2 * fy)) / (FP * FP));
  const a = hash2(gx, gy, seed) & 255;
  const b = hash2(gx + 1, gy, seed) & 255;
  const c = hash2(gx, gy + 1, seed) & 255;
  const d = hash2(gx + 1, gy + 1, seed) & 255;
  const top = a * (FP - sx) + b * sx;
  const bot = c * (FP - sx) + d * sx;
  return Math.floor((top * (FP - sy) + bot * sy) / (FP * FP));
}

/**
 * Szum symetryczny środkowo (generator 8): suma szumu w punkcie i w punkcie odbitym (obrót o 180°), z zachowaną siłą
 * plam. Wcześniej druga połowa mapy była kopią pierwszej i na linii środka plamy lasu i jezior urywały się prosto
 * („szew” przez całą mapę). Wynik 0..255, jak `valueNoise`.
 */
export function symNoise(x: number, y: number, w: number, h: number, f: (x: number, y: number) => number): number {
  const v = 128 + (((f(x, y) + f(w - 1 - x, h - 1 - y) - 256) * 181) >> 8);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

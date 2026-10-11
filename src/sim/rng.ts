/**
 * Deterministyczny generator liczb losowych (mulberry32) na 32-bitowych liczbach całkowitych.
 * W symulacji NIE wolno używać Math.random — tylko tego generatora z ziarnem meczu.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Liczba całkowita 0..2^32-1 */
  nextU32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Liczba całkowita z przedziału [0, n) */
  int(n: number): number {
    return this.nextU32() % n;
  }

  get state(): number {
    return this.s;
  }
}

/** Hash dwóch współrzędnych i ziarna do 32 bitów — do szumu na siatce. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Zamiana tekstu (np. wpisanego ziarna) na liczbę 32-bitową (FNV-1a). */
export function seedFromText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

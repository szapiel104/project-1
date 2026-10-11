import * as THREE from 'three';

type Kind = 'bricks' | 'planks' | 'thatch' | 'plaster' | 'tiles' | 'grass';
const cache = new Map<Kind, THREE.CanvasTexture>();

/** Prosty generator liczb do wzorów (tylko wygląd, nie symulacja). */
function noise(seed: number): () => number {
  let s = seed;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const gray = (v: number): string => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

const PAINT: Record<Kind, (c: CanvasRenderingContext2D, n: number, r: () => number) => void> = {
  bricks(c, n, r) {
    c.fillStyle = gray(0.62); c.fillRect(0, 0, n, n); // fuga
    const rows = 4, h = n / rows, w = n / 2;
    for (let y = 0; y < rows; y++)
      for (let x = -1; x < 2; x++) {
        c.fillStyle = gray(0.82 + r() * 0.18);
        c.fillRect(x * w + (y % 2 ? w / 2 : 0) + 2, y * h + 2, w - 4, h - 4);
      }
  },
  planks(c, n, r) {
    const boards = 4, w = n / boards;
    for (let i = 0; i < boards; i++) {
      c.fillStyle = gray(0.8 + r() * 0.2); c.fillRect(i * w, 0, w, n);
      c.fillStyle = gray(0.6); c.fillRect(i * w, 0, 2, n);
      for (let k = 0; k < 5; k++) { c.fillStyle = gray(0.7 + r() * 0.1); c.fillRect(i * w + 3 + r() * (w - 6), r() * n, 1, 8 + r() * 18); }
    }
  },
  thatch(c, n, r) {
    c.fillStyle = gray(0.85); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 260; i++) { c.fillStyle = gray(0.68 + r() * 0.32); c.fillRect(r() * n, r() * n, 1.5, 6 + r() * 12); }
    for (let y = 0; y < 4; y++) { c.fillStyle = gray(0.62); c.fillRect(0, (y * n) / 4, n, 2); }
  },
  plaster(c, n, r) {
    c.fillStyle = gray(0.95); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 90; i++) { c.fillStyle = gray(0.84 + r() * 0.14); c.fillRect(r() * n, r() * n, 2 + r() * 5, 2 + r() * 4); }
  },
  tiles(c, n, r) {
    const rows = 4, h = n / rows, w = n / 4;
    for (let y = 0; y < rows; y++)
      for (let x = -1; x < 5; x++) {
        c.fillStyle = gray(0.78 + r() * 0.22);
        c.fillRect(x * w + (y % 2 ? w / 2 : 0) + 1, y * h, w - 2, h - 2);
        c.fillStyle = gray(0.58); c.fillRect(x * w + (y % 2 ? w / 2 : 0), y * h + h - 3, w, 3);
      }
  },
  grass(c, n, r) {
    c.fillStyle = gray(0.92); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 420; i++) { c.fillStyle = gray(0.8 + r() * 0.2); c.fillRect(r() * n, r() * n, 1.5, 2 + r() * 4); }
  },
};

/**
 * Tekstury rysowane kodem, w odcieniach szarości: kolor nadaje materiał, tekstura tylko wzór.
 * Dzięki temu jeden wzór cegieł służy jasnemu i ciemnemu kamieniowi oraz barwom drużyn.
 */
export function pattern(kind: Kind): THREE.Texture | null {
  let t = cache.get(kind);
  if (t) return t;
  if (typeof document === 'undefined') return null;
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  PAINT[kind](ctx, n, noise(kind.length * 7919));
  t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(kind, t);
  return t;
}

import * as THREE from 'three';

type Kind = 'bricks' | 'planks' | 'thatch' | 'plaster' | 'tiles' | 'grass' | 'leaves' | 'needles' | 'bark' | 'soil' | 'window' | 'water';
const cache = new Map<Kind, THREE.CanvasTexture>();

/** Prosty generator liczb do wzorów (tylko wygląd, nie symulacja). */
function noise(seed: number): () => number {
  let s = seed;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const gray = (v: number): string => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

const PAINT: Record<Kind, (c: CanvasRenderingContext2D, n: number, r: () => number) => void> = {
  bricks(c, n, r) {
    // ciosany kamień: nierówne bloki, ciemna fuga, jasna górna krawędź i cień u dołu każdego bloku
    c.fillStyle = gray(0.45); c.fillRect(0, 0, n, n);
    const rows = 4, h = n / rows;
    for (let y = 0; y < rows; y++) {
      let x = y % 2 ? -n * 0.18 : 0;
      while (x < n) {
        const w = n * (0.28 + r() * 0.22);
        const tone = 0.74 + r() * 0.24;
        c.fillStyle = gray(tone); c.fillRect(x + 1.5, y * h + 1.5, w - 3, h - 3);
        c.fillStyle = gray(tone + 0.1); c.fillRect(x + 1.5, y * h + 1.5, w - 3, 2);
        c.fillStyle = gray(tone - 0.14); c.fillRect(x + 1.5, y * h + h - 3.5, w - 3, 2);
        for (let k = 0; k < 3; k++) { c.fillStyle = gray(tone - 0.08 + r() * 0.12); c.fillRect(x + 3 + r() * (w - 8), y * h + 4 + r() * (h - 9), 2, 1.5); }
        x += w;
      }
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
    // gonty: zaokrąglone dachówki w przesuniętych rzędach z cieniem pod każdym rzędem
    c.fillStyle = gray(0.5); c.fillRect(0, 0, n, n);
    const rows = 5, h = n / rows, w = n / 5;
    for (let y = rows; y >= 0; y--)
      for (let x = -1; x < 6; x++) {
        const px = x * w + (y % 2 ? w / 2 : 0), py = y * h;
        c.fillStyle = gray(0.74 + r() * 0.26);
        c.beginPath(); c.moveTo(px + 0.5, py - h * 0.4); c.lineTo(px + w - 0.5, py - h * 0.4); c.lineTo(px + w - 0.5, py + h * 0.55); c.arc(px + w / 2, py + h * 0.55, w / 2 - 0.5, 0, Math.PI); c.closePath(); c.fill();
      }
  },
  grass(c, n, r) {
    c.fillStyle = gray(0.86); c.fillRect(0, 0, n, n);
    // plamy jaśniejszej i ciemniejszej darni, potem pojedyncze źdźbła
    for (let i = 0; i < 26; i++) { c.fillStyle = gray(0.78 + r() * 0.2); c.beginPath(); c.arc(r() * n, r() * n, 5 + r() * 12, 0, 6.3); c.fill(); }
    for (let i = 0; i < 900; i++) {
      c.strokeStyle = gray(0.66 + r() * 0.34); c.lineWidth = 1;
      const x = r() * n, y = r() * n;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); c.stroke();
    }
  },
  leaves(c, n, r) {
    c.fillStyle = gray(0.7); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 420; i++) { c.fillStyle = gray(0.62 + r() * 0.38); c.beginPath(); c.ellipse(r() * n, r() * n, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, 6.3); c.fill(); }
  },
  needles(c, n, r) {
    c.fillStyle = gray(0.72); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 700; i++) {
      c.strokeStyle = gray(0.58 + r() * 0.42); c.lineWidth = 1.2;
      const x = r() * n, y = r() * n;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 5, y + 4 + r() * 7); c.stroke();
    }
  },
  bark(c, n, r) {
    c.fillStyle = gray(0.8); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) { c.fillStyle = gray(0.55 + r() * 0.4); c.fillRect(r() * n, r() * n, 2 + r() * 3, 10 + r() * 30); }
  },
  window(c, n) {
    // ciemna szyba w drewnianej ramie ze szprosami
    c.fillStyle = gray(0.95); c.fillRect(0, 0, n, n);
    c.fillStyle = gray(0.22); c.fillRect(n * 0.12, n * 0.12, n * 0.76, n * 0.76);
    c.fillStyle = gray(0.4); c.fillRect(n * 0.16, n * 0.16, n * 0.3, n * 0.3);
    c.fillStyle = gray(0.95); c.fillRect(n * 0.46, n * 0.12, n * 0.08, n * 0.76); c.fillRect(n * 0.12, n * 0.46, n * 0.76, n * 0.08);
  },
  water(c, n, r) {
    // drobne fale: jasne łuki na ciemniejszym tle
    c.fillStyle = gray(0.5); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 150; i++) {
      c.strokeStyle = gray(0.55 + r() * 0.45); c.lineWidth = 1 + r() * 1.5;
      const x = r() * n, y = r() * n, w = 6 + r() * 16;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y - 2 - r() * 3, x + w, y); c.stroke();
    }
  },
  soil(c, n, r) {
    c.fillStyle = gray(0.85); c.fillRect(0, 0, n, n);
    for (let i = 0; i < 500; i++) { c.fillStyle = gray(0.65 + r() * 0.35); c.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 2); }
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
  const n = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // wzory były rysowane dla 64 px (trawa i liście dla 128/256): skalujemy rysunek, a nie rozmywamy gotowy obraz
  const base = kind === 'grass' ? 256 : ['leaves', 'needles', 'bark', 'soil', 'window', 'water'].includes(kind) ? 128 : 64;
  ctx.save();
  ctx.scale(n / base, n / base);
  PAINT[kind](ctx, base, noise(kind.length * 7919));
  ctx.restore();
  if (kind !== 'window') grain(ctx, n, kind.length * 31);
  t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(kind, t);
  return t;
}

const bumps = new Map<Kind, THREE.CanvasTexture>();
/** Ta sama tekstura jako mapa wypukłości: jasne miejsca wystają, fugi i szpary są wgłębione. */
export function bump(kind: Kind): THREE.Texture | null {
  let b = bumps.get(kind);
  if (b) return b;
  const src = pattern(kind);
  if (!src) return null;
  b = new THREE.CanvasTexture(src.image as HTMLCanvasElement);
  b.wrapS = b.wrapT = THREE.RepeatWrapping;
  bumps.set(kind, b);
  return b;
}

/**
 * Ziarno powierzchni: kilka oktaw płynnego szumu nałożone na gotowy wzór, piksel po pikselu.
 * Daje nierówny, „ręczny” materiał zamiast płaskich plam koloru. Szum zawija się na krawędziach, więc tekstura się kafelkuje.
 */
function grain(ctx: CanvasRenderingContext2D, n: number, seed: number): void {
  const img = ctx.getImageData(0, 0, n, n);
  const d = img.data;
  const lattice = (cells: number): Float32Array => {
    const r = noise(seed + cells * 131);
    const a = new Float32Array(cells * cells);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return a;
  };
  const octaves = [8, 24, 72, 200].map((cells) => ({ cells, v: lattice(cells) }));
  const weights = [0.42, 0.28, 0.2, 0.1];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let k = 0;
      for (let o = 0; o < octaves.length; o++) {
        const { cells, v } = octaves[o]!;
        const fx = (x / n) * cells, fy = (y / n) * cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
        const top = v[y0 * cells + x0]! * (1 - sx) + v[y0 * cells + x1]! * sx;
        const bot = v[y1 * cells + x0]! * (1 - sx) + v[y1 * cells + x1]! * sx;
        k += (top * (1 - sy) + bot * sy) * weights[o]!;
      }
      const m = 0.72 + k * 0.56;
      const i = (y * n + x) * 4;
      d[i] = Math.min(255, d[i]! * m); d[i + 1] = Math.min(255, d[i + 1]! * m); d[i + 2] = Math.min(255, d[i + 2]! * m);
    }
  }
  ctx.putImageData(img, 0, 0);
}

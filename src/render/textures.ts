import * as THREE from 'three';

type Kind = 'bricks' | 'planks' | 'thatch' | 'plaster' | 'tiles' | 'grass' | 'leaves' | 'needles' | 'bark' | 'soil' | 'window' | 'water' | 'ashlar' | 'cobble';
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
  ashlar(c, n, r) {
    // Mur twierdzy rysowany od razu w pełnej rozdzielczości: ciosy różnej długości, głęboka fuga,
    // każdy kamień z własnym odcieniem, jasną górną krawędzią, cieniem u dołu, wyszczerbieniami i rysami
    c.fillStyle = gray(0.44); c.fillRect(0, 0, n, n);
    const rows = 6, h = n / rows, gap = n * 0.008;
    for (let y = 0; y < rows; y++) {
      let x = -r() * n * 0.12;
      while (x < n) {
        const w = n * (0.14 + r() * 0.2);
        const tone = 0.8 + r() * 0.2;
        const bx = x + gap, by = y * h + gap, bw = w - gap * 2, bh = h - gap * 2;
        c.fillStyle = gray(tone); c.fillRect(bx, by, bw, bh);
        // wypukłość kamienia: jaśniejszy środek, ciemniejące brzegi
        const g1 = c.createLinearGradient(0, by, 0, by + bh);
        g1.addColorStop(0, 'rgba(255,255,255,0.22)'); g1.addColorStop(0.18, 'rgba(255,255,255,0)'); g1.addColorStop(0.8, 'rgba(0,0,0,0)'); g1.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = g1; c.fillRect(bx, by, bw, bh);
        const g2 = c.createLinearGradient(bx, 0, bx + bw, 0);
        g2.addColorStop(0, 'rgba(255,255,255,0.14)'); g2.addColorStop(0.12, 'rgba(255,255,255,0)'); g2.addColorStop(0.9, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.2)');
        c.fillStyle = g2; c.fillRect(bx, by, bw, bh);
        // dziobata powierzchnia po dłucie
        for (let k = 0; k < 26; k++) { c.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.1})`; c.fillRect(bx + r() * bw, by + r() * bh, 1 + r() * n * 0.006, 1 + r() * n * 0.004); }
        // wyszczerbiony narożnik
        if (r() > 0.55) { c.fillStyle = gray(0.44); c.beginPath(); const cx = r() > 0.5 ? bx : bx + bw, cy = r() > 0.5 ? by : by + bh; c.arc(cx, cy, n * (0.006 + r() * 0.01), 0, 6.3); c.fill(); }
        // rysa
        if (r() > 0.75) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); let px = bx + r() * bw, py = by; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * bw * 0.15; py += bh / 4; c.lineTo(px, py); } c.stroke(); }
        x += w;
      }
    }
    // zacieki pod koroną muru
    for (let k = 0; k < 14; k++) { const sx = r() * n, len = n * (0.15 + r() * 0.3); const gr = c.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(sx, 0, n * (0.01 + r() * 0.02), len); }
  },
  cobble(c, n, r) {
    // Rzymska kostka: drobne, obłe kamienie ułożone ciasno w lekko falujących rzędach,
    // każdy trochę inny w rozmiarze, odcieniu i obrocie, wypukły, z ziemią w szczelinach
    c.fillStyle = gray(0.24); c.fillRect(0, 0, n, n);
    const rows = 15, s = n / rows;
    for (let y = -1; y <= rows; y++) {
      for (let x = -1; x <= rows; x++) {
        // rząd faluje i jest przesunięty o pół kamienia względem sąsiedniego
        const cx = (x + 0.5 + (y % 2 ? 0.5 : 0)) * s + (r() - 0.5) * s * 0.14;
        const cy = (y + 0.5) * s + Math.sin(((x + (y % 2 ? 0.5 : 0)) / rows) * Math.PI * 4) * s * 0.16 + (r() - 0.5) * s * 0.12;
        const w = s * (0.8 + r() * 0.16), h = s * (0.74 + r() * 0.18), rot = (r() - 0.5) * 0.5;
        const tone = 0.62 + r() * 0.34;
        for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]] as const) {
          if (cx + ox < -s || cx + ox > n + s || cy + oy < -s || cy + oy > n + s) continue;
          c.save();
          c.translate(cx + ox, cy + oy); c.rotate(rot);
          const rad = Math.min(w, h) * 0.32;
          c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, rad);
          // wypukłość: światło z lewej góry, cień u dołu po prawej
          const gr = c.createRadialGradient(-w * 0.18, -h * 0.2, s * 0.05, 0, 0, Math.max(w, h) * 0.62);
          gr.addColorStop(0, gray(tone + 0.14)); gr.addColorStop(0.55, gray(tone)); gr.addColorStop(1, gray(tone - 0.3));
          c.fillStyle = gr; c.fill();
          c.clip();
          // powierzchnia kamienia: ziarno, jaśniejsze i ciemniejsze plamy, czasem rysa albo odprysk
          for (let k = 0; k < 28; k++) { c.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.1})`; c.fillRect((r() - 0.5) * w, (r() - 0.5) * h, s * (0.01 + r() * 0.05), s * (0.01 + r() * 0.035)); }
          for (let k = 0; k < 3; k++) { const br = s * (0.08 + r() * 0.16), bx = (r() - 0.5) * w * 0.8, by = (r() - 0.5) * h * 0.8; const gb = c.createRadialGradient(bx, by, 0, bx, by, br); gb.addColorStop(0, `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.12)`); gb.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gb; c.fillRect(bx - br, by - br, br * 2, br * 2); }
          if (r() > 0.7) { c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = Math.max(1, s * 0.012); c.beginPath(); c.moveTo((r() - 0.5) * w, -h / 2); c.lineTo((r() - 0.5) * w * 0.6, (r() - 0.5) * h * 0.4); c.lineTo((r() - 0.5) * w, h / 2); c.stroke(); }
          c.restore();
        }
      }
    }
  },
  water(c, n) {
    // gładka tafla: same miękkie plamy z szumu (dokłada je ziarno), bez rysowanych kresek
    c.fillStyle = gray(0.6); c.fillRect(0, 0, n, n);
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
  // bruk w 2048 px na komputerach (1024 na telefonach), mur twierdzy 1024, reszta 512
  const phone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const n = kind === 'cobble' ? (phone ? 1024 : 2048) : kind === 'ashlar' ? 1024 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // wzory były rysowane dla 64 px (trawa i liście dla 128/256): skalujemy rysunek, a nie rozmywamy gotowy obraz
  const base = kind === 'ashlar' ? 1024 : kind === 'cobble' ? n : kind === 'grass' ? 256 : ['leaves', 'needles', 'bark', 'soil', 'window', 'water'].includes(kind) ? 128 : 64;
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

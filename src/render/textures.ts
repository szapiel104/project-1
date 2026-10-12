import * as THREE from 'three';
import { TEST } from '../testmode';

export type Kind = 'bricks' | 'planks' | 'thatch' | 'plaster' | 'tiles' | 'grass' | 'leaves' | 'needles' | 'bark' | 'soil' | 'window' | 'water' | 'ashlar' | 'cobble' | 'rock';
const cache = new Map<Kind, THREE.CanvasTexture>();

/** Prosty generator liczb do wzorów (tylko wygląd, nie symulacja). */
function noise(seed: number): () => number {
  let s = seed;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const gray = (v: number): string => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

/** Wszystkie rodzaje tekstur (do wczytywania z paskiem postępu). */
export const KINDS = (): Kind[] => Object.keys(PAINT) as Kind[];

const PAINT: Record<Kind, (c: CanvasRenderingContext2D, n: number, r: () => number) => void> = {
  rock(c, n, r) {
    // surowa skała: plamy jaśniejszego i ciemniejszego kamienia, drobne ziarno, pęknięcia i odrobina porostu
    c.fillStyle = gray(0.7); c.fillRect(0, 0, n, n);
    for (let k = 0; k < 40; k++) {
      c.fillStyle = gray(0.55 + r() * 0.35);
      c.beginPath(); c.ellipse(r() * n, r() * n, 4 + r() * 16, 3 + r() * 10, r() * 3, 0, Math.PI * 2); c.fill();
    }
    for (let k = 0; k < 900; k++) { c.fillStyle = gray(0.4 + r() * 0.6); c.fillRect(r() * n, r() * n, 1, 1); }
    c.strokeStyle = gray(0.32); c.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      let x = r() * n, y = r() * n;
      c.beginPath(); c.moveTo(x, y);
      for (let s2 = 0; s2 < 5; s2++) { x += (r() - 0.5) * 22; y += (r() - 0.3) * 18; c.lineTo(x, y); }
      c.stroke();
    }
    for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(120,140,70,0.35)'; c.beginPath(); c.arc(r() * n, r() * n, 2 + r() * 5, 0, Math.PI * 2); c.fill(); }
  },
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
    // rysowane w pełnej rozdzielczości: drobna, gęsta darń zamiast grubych kresek
    const k = n / 256;
    c.fillStyle = gray(0.84); c.fillRect(0, 0, n, n);
    // miękkie plamy jaśniejszej i ciemniejszej darni (zawijane na brzegach, żeby nie było szwów)
    for (let i = 0; i < 40; i++) {
      const x = r() * n, y = r() * n, rad = (10 + r() * 28) * k, v = 0.74 + r() * 0.22;
      for (const [ox, oy] of [[0, 0], [-n, 0], [n, 0], [0, -n], [0, n]] as const) {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, `rgba(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0},0.55)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    // gęste, cienkie źdźbła w kępkach, lekko pochylone w jedną stronę
    c.lineCap = 'round';
    for (let t = 0; t < 2600; t++) {
      const cx = r() * n, cy = r() * n, blades = 6 + (r() * 10 | 0), lean = (r() - 0.3) * 2;
      for (let i = 0; i < blades; i++) {
        const x = cx + (r() - 0.5) * 6 * k, y = cy + (r() - 0.5) * 6 * k, len = (2.5 + r() * 5) * k;
        c.strokeStyle = gray(0.6 + r() * 0.42); c.lineWidth = (0.35 + r() * 0.35) * k;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * len * 0.2, y - len * 0.6, x + lean * len * 0.5 + (r() - 0.5) * k, y - len); c.stroke();
      }
    }
    // drobne listki koniczyny i ciemne szczeliny między kępami
    for (let i = 0; i < 1400; i++) { c.fillStyle = gray(r() < 0.5 ? 0.55 + r() * 0.1 : 0.95); c.beginPath(); c.arc(r() * n, r() * n, (0.4 + r() * 0.6) * k, 0, 6.3); c.fill(); }
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
    // Bruk w rysunkowym stylu: drobne, prostokątne kamienie o zaokrąglonych rogach, w rzędach różnej długości,
    // jasny piaskowiec z refleksem u góry i cieniem u dołu, ciemne szczeliny i mech wyrastający ze spoin.
    c.fillStyle = 'rgb(58,60,32)'; c.fillRect(0, 0, n, n);
    const rows = 12, s = n / rows, gap = s * 0.07;
    const wrap = (draw: (ox: number, oy: number) => void, x: number, y: number, ext: number): void => {
      for (const ox of [0, n, -n]) for (const oy of [0, n, -n]) {
        if (x + ox < -ext || x + ox > n + ext || y + oy < -ext || y + oy > n + ext) continue;
        draw(ox, oy);
      }
    };
    const stone = (x: number, y: number, w: number, h: number): void => {
      const base = 0.82 + r() * 0.18, warm = r() * 14;
      const col = (k: number): string => `rgb(${Math.round((228 + warm) * base * k)},${Math.round(208 * base * k)},${Math.round((182 - warm) * base * k)})`;
      const rad = Math.min(w, h) * 0.28;
      const specks = Array.from({ length: 10 }, () => [r() * w, r() * h, s * (0.012 + r() * 0.02)] as const);
      wrap((ox, oy) => {
        const X = x + ox + gap / 2, Y = y + oy + gap / 2, W = w - gap, H = h - gap;
        // cień od spodu, potem bryła, refleks i ciemniejszy dół
        c.fillStyle = col(0.62); c.beginPath(); c.roundRect(X, Y + gap * 0.5, W, H, rad); c.fill();
        c.fillStyle = col(1); c.beginPath(); c.roundRect(X, Y, W, H - gap * 0.4, rad); c.fill();
        c.fillStyle = col(1.08); c.beginPath(); c.roundRect(X + W * 0.06, Y + H * 0.07, W * 0.7, H * 0.38, rad * 0.9); c.fill();
        c.fillStyle = col(0.86); c.beginPath(); c.roundRect(X + W * 0.35, Y + H * 0.55, W * 0.58, H * 0.36, rad * 0.7); c.fill();
        c.fillStyle = col(0.78);
        for (const [sx, sy, sr] of specks) { c.beginPath(); c.arc(X + sx * 0.9 + W * 0.05, Y + sy * 0.85 + H * 0.05, sr, 0, Math.PI * 2); c.fill(); }
      }, x, y, w + s);
    };
    // rzędy kamieni różnej długości, przesunięte względem siebie
    for (let row = 0; row < rows; row++) {
      const x0 = -r() * s;
      let x = x0;
      while (x < x0 + n - 1) {
        // rząd ma dokładnie szerokość tekstury, żeby po zawinięciu kamienie nie nachodziły na siebie
        let w = s * (0.9 + r() * 1.1);
        if (x0 + n - x - w < s * 0.8) w = x0 + n - x;
        if (r() < 0.18 && row < rows - 1) {
          // czasem dwa kamienie postawione pionowo w jednym miejscu
          stone(x, row * s, w * 0.5, s); stone(x + w * 0.5, row * s, w * 0.5, s);
        } else stone(x, row * s, w, s);
        x += w;
      }
    }
    // mech w spoinach: nieregularne kępy wyrastające ze szczelin i zachodzące na krawędzie kamieni
    for (let k = 0; k < 30; k++) {
      let x = r() * n, y = Math.round(r() * rows) * s;
      const horizontal = r() < 0.6;
      const len = 2 + Math.floor(r() * 7);
      for (let j = 0; j < len; j++) {
        const blobs = Array.from({ length: 3 }, () => [(r() - 0.5) * s * 0.12, (r() - 0.5) * s * 0.12, s * (0.025 + r() * 0.06)] as const);
        wrap((ox, oy) => {
          for (const [bx, by, br] of blobs) { c.fillStyle = 'rgb(70,96,18)'; c.beginPath(); c.arc(x + ox + bx, y + oy + by + br * 0.3, br * 1.15, 0, Math.PI * 2); c.fill(); }
          for (const [bx, by, br] of blobs) { c.fillStyle = 'rgb(140,178,38)'; c.beginPath(); c.arc(x + ox + bx, y + oy + by, br, 0, Math.PI * 2); c.fill(); }
          for (const [bx, by, br] of blobs) { c.fillStyle = 'rgba(200,226,90,0.8)'; c.beginPath(); c.arc(x + ox + bx - br * 0.3, y + oy + by - br * 0.35, br * 0.35, 0, Math.PI * 2); c.fill(); }
        }, x, y, s);
        if (horizontal) { x += s * (0.05 + r() * 0.1); y += (r() - 0.5) * s * 0.05; } else { y += s * (0.05 + r() * 0.1); x += (r() - 0.5) * s * 0.05; }
      }
      // pojedyncze kropki mchu obok kępy
      for (let j = 0; j < 4; j++) { const dx = x + (r() - 0.5) * s * 0.5, dy = y + (r() - 0.5) * s * 0.3, dr = s * (0.012 + r() * 0.02); wrap((ox, oy) => { c.fillStyle = 'rgb(140,178,38)'; c.beginPath(); c.arc(dx + ox, dy + oy, dr, 0, Math.PI * 2); c.fill(); }, dx, dy, s); }
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
/** Rysuje teksturę od zera (wolne: ziarno liczone piksel po pikselu). */
const size = (kind: Kind): number => (TEST ? 256 : kind === 'cobble' || kind === 'ashlar' || kind === 'grass' ? 2048 : 1024);
function paint(kind: Kind, n: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // wzory były rysowane dla 64 px (trawa i liście dla 128/256): skalujemy rysunek, a nie rozmywamy gotowy obraz
  const base = kind === 'ashlar' ? 1024 : kind === 'cobble' || kind === 'grass' ? n : ['leaves', 'needles', 'bark', 'soil', 'window', 'water', 'rock'].includes(kind) ? 128 : 64;
  ctx.save();
  ctx.scale(n / base, n / base);
  PAINT[kind](ctx, base, noise(kind.length * 7919));
  ctx.restore();
  if (kind !== 'window') grain(ctx, n, kind.length * 31);
  return canvas;
}

// --- pamięć gotowych tekstur w przeglądarce (IndexedDB): drugie wejście nie rysuje ich od nowa ---
const stored = new Map<Kind, HTMLCanvasElement>();
const DB = 'project1-tex';
/** Klucz zmienia się razem z kodem rysującym, więc po zmianie wyglądu tekstura rysuje się na nowo */
function keyOf(kind: Kind, n: number): string {
  const src = String(PAINT[kind]) + String(grain);
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  return `${kind}-${n}-${(h >>> 0).toString(36)}`;
}
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('t');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
let dbp: Promise<IDBDatabase | null> | null = null;
const db = (): Promise<IDBDatabase | null> => (dbp ??= TEST ? Promise.resolve(null) : openDb());
function remember(kind: Kind, n: number, canvas: HTMLCanvasElement): void {
  canvas.toBlob(async (blob) => {
    const d = await db();
    if (!blob || !d) return;
    try { d.transaction('t', 'readwrite').objectStore('t').put(blob, keyOf(kind, n)); } catch { /* brak miejsca: trudno */ }
  }, 'image/png');
}
/** Wczytuje zapamiętaną teksturę, jeśli jest; zwraca true, gdy nie trzeba jej rysować */
export async function restore(kind: Kind): Promise<boolean> {
  const n = size(kind);
  const d = await db();
  if (!d) return false;
  const blob = await new Promise<Blob | undefined>((ok) => {
    try { const rq = d.transaction('t').objectStore('t').get(keyOf(kind, n)); rq.onsuccess = () => ok(rq.result as Blob | undefined); rq.onerror = () => ok(undefined); } catch { ok(undefined); }
  });
  if (!blob) return false;
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = c.height = n;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    stored.set(kind, c);
    return true;
  } catch { return false; }
}

export function pattern(kind: Kind): THREE.Texture | null {
  let t = cache.get(kind);
  if (t) return t;
  if (typeof document === 'undefined') return null;
  // bruk w 2048 px, mur twierdzy 1024, reszta 512
  // tylko komputery: wysoka rozdzielczość wszędzie (bruk, mur, trawa 2048, reszta 1024)
  const n = size(kind);
  const canvas = stored.get(kind) ?? paint(kind, n);
  if (!canvas) return null;
  if (!stored.has(kind)) remember(kind, n, canvas);
  t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
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
  // przy dużych teksturach dochodzi najdrobniejsza oktawa: ziarno widać też z bliska
  const cellsList = n >= 1024 ? [8, 24, 72, 200, 480] : [8, 24, 72, 200];
  const octaves = cellsList.map((cells) => ({ cells, v: lattice(cells) }));
  const weights = n >= 1024 ? [0.4, 0.26, 0.18, 0.1, 0.06] : [0.42, 0.28, 0.2, 0.1];
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

import * as THREE from 'three';
import { TEST } from '../testmode';

export type Kind = 'bricks' | 'planks' | 'thatch' | 'plaster' | 'tiles' | 'grass' | 'leaves' | 'needles' | 'bark' | 'soil' | 'window' | 'water' | 'ashlar' | 'cobble' | 'rock' | 'dressed' | 'organic' | 'slate' | 'burlap' | 'wool' | 'iron' | 'mail';
const cache = new Map<Kind, THREE.CanvasTexture>();

/** Prosty generator liczb do wzorów (tylko wygląd, nie symulacja). */
function noise(seed: number): () => number {
  let s = seed;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const gray = (v: number): string => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

/** Wszystkie rodzaje tekstur (do wczytywania z paskiem postępu). */
export const KINDS = (): Kind[] => Object.keys(PAINT) as Kind[];

/**
 * Mur z dużych, ciosanych bloków: powierzchnia jak w kamieniołomie (ślady dłuta, plamy, żyłki) na całym murze,
 * każdy blok we własnym odcieniu, cienka, cofnięta fuga z jasną krawędzią pod spodem i z rzadka obtłuczony róg.
 */
function masonry(c: CanvasRenderingContext2D, n: number, r: () => number, rows: number): void {
  PAINT.dressed(c, n, r);
  const h = n / rows, joint = n * 0.007;
  for (let y = 0; y < rows; y++) {
    let x = -r() * n * 0.25;
    while (x < n) {
      const w = n * (0.3 + r() * 0.28);
      // odcień bloku: lekko jaśniejszy albo ciemniejszy, raz cieplejszy
      const lite = r() > 0.5;
      c.fillStyle = `rgba(${lite ? '255,250,240' : '40,30,20'},${0.04 + r() * 0.1})`;
      c.fillRect(x, y * h, w, h);
      // wypukłość: delikatny cień u dołu bloku i światło u góry
      const g1 = c.createLinearGradient(0, y * h, 0, y * h + h);
      g1.addColorStop(0, 'rgba(255,255,255,0.12)'); g1.addColorStop(0.12, 'rgba(255,255,255,0)'); g1.addColorStop(0.85, 'rgba(0,0,0,0)'); g1.addColorStop(1, 'rgba(0,0,0,0.18)');
      c.fillStyle = g1; c.fillRect(x, y * h, w, h);
      // pionowa fuga
      c.fillStyle = 'rgba(45,38,30,0.75)'; c.fillRect(x - joint / 2, y * h, joint, h);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + joint / 2, y * h, joint * 0.5, h);
      // obtłuczony róg
      if (r() > 0.7) { c.fillStyle = 'rgba(70,60,48,0.5)'; c.beginPath(); c.arc(r() > 0.5 ? x : x + w, y * h + (r() > 0.5 ? 0 : h), n * (0.01 + r() * 0.012), 0, 6.3); c.fill(); }
      x += w;
    }
    // pozioma fuga
    c.fillStyle = 'rgba(45,38,30,0.8)'; c.fillRect(0, y * h - joint / 2, n, joint);
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(0, y * h + joint / 2, n, joint * 0.5);
  }
}

type Painted = Exclude<Kind, 'wool' | 'iron' | 'mail'>;
/** Zdjęciowe tekstury postaci bez własnego rysunku: w trybie testowym zastępuje je podobny wzór z kodu */
const PAINT_AS: Record<Exclude<Kind, Painted>, Painted> = { wool: 'burlap', iron: 'rock', mail: 'rock' };
const painter = (k: Kind): Painted => (k in PAINT_AS ? PAINT_AS[k as Exclude<Kind, Painted>] : (k as Painted));
const PAINT: Record<Painted, (c: CanvasRenderingContext2D, n: number, r: () => number) => void> = {
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
  bricks(c, n, r) { masonry(c, n, r, 3); },
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
  ashlar(c, n, r) { masonry(c, n, r, 4); },
  dressed(c, n, r) {
    // Świeżo ciosany kamień (bloki w kamieniołomie): jedna gładka płaszczyzna bez fug — plamy piaskowca,
    // pasma ukośnych śladów dłuta, drobne dziobki po szpicaku, cienkie żyłki
    c.fillStyle = gray(0.84); c.fillRect(0, 0, n, n);
    // duże, miękkie plamy jaśniejszego i ciemniejszego kamienia
    for (let k = 0; k < 46; k++) {
      const x = r() * n, y = r() * n, rad = n * (0.05 + r() * 0.16);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      const lite = r() > 0.5;
      g.addColorStop(0, `rgba(${lite ? '255,255,255' : '40,32,24'},${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // ślady dłuta: pasma równoległych, krótkich kresek pod jednym kątem
    for (let band = 0; band < 34; band++) {
      const bx = r() * n, by = r() * n, ang = (r() > 0.5 ? 1 : -1) * (0.45 + r() * 0.35), len = n * (0.02 + r() * 0.03), step = n * 0.006;
      const cnt = 8 + Math.floor(r() * 14);
      c.lineWidth = n * 0.0016;
      for (let k = 0; k < cnt; k++) {
        const ox = bx + Math.cos(ang + Math.PI / 2) * k * step, oy = by + Math.sin(ang + Math.PI / 2) * k * step;
        c.strokeStyle = `rgba(${k % 2 ? '0,0,0' : '255,255,255'},${0.06 + r() * 0.08})`;
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len); c.stroke();
      }
    }
    // dziobki po szpicaku
    for (let k = 0; k < 900; k++) { const sz = n * (0.0015 + r() * 0.003); c.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.14})`; c.fillRect(r() * n, r() * n, sz, sz * (0.6 + r() * 0.8)); }
    for (let k = 0; k < 500; k++) { const sz = n * (0.001 + r() * 0.002); c.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.15})`; c.fillRect(r() * n, r() * n, sz, sz); }
    // cienkie żyłki w kamieniu
    for (let k = 0; k < 5; k++) {
      c.strokeStyle = `rgba(90,70,50,${0.12 + r() * 0.1})`; c.lineWidth = n * 0.0012;
      c.beginPath(); let x = r() * n, y = r() * n; c.moveTo(x, y);
      for (let s2 = 0; s2 < 12; s2++) { x += (r() - 0.3) * n * 0.05; y += (r() - 0.5) * n * 0.03; c.lineTo(x, y); }
      c.stroke();
    }
  },
  organic(c, n, r) {
    // Skórka owoców, chleba i ryb: miękkie plamy, gęste drobne kropki i krótkie żyłki — żywność nie jest gładkim plastikiem
    c.fillStyle = gray(0.86); c.fillRect(0, 0, n, n);
    for (let k = 0; k < 60; k++) {
      const x = r() * n, y = r() * n, rad = n * (0.04 + r() * 0.12);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${r() > 0.5 ? '255,255,255' : '50,35,20'},${0.08 + r() * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 1400; k++) { const sz = n * (0.002 + r() * 0.004); c.fillStyle = `rgba(${r() > 0.35 ? '60,40,20' : '255,250,230'},${0.12 + r() * 0.2})`; c.beginPath(); c.arc(r() * n, r() * n, sz, 0, 6.3); c.fill(); }
    c.lineWidth = n * 0.002;
    for (let k = 0; k < 80; k++) { c.strokeStyle = `rgba(70,45,25,${0.08 + r() * 0.1})`; c.beginPath(); const x = r() * n, y = r() * n; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * n * 0.06, y + (r() - 0.5) * n * 0.03); c.stroke(); }
  },
  slate(c, n, r) {
    // Dach z kamiennych płytek (łupek): rzędy nierównych płytek zachodzących na siebie, każda z zaokrąglonym
    // dolnym brzegiem, własnym odcieniem, ziarnem kamienia, cieniem pod spodem i czasem odpryskiem albo mchem
    c.fillStyle = gray(0.18); c.fillRect(0, 0, n, n);
    const rows = 9, h = n / rows;
    for (let y = -1; y <= rows; y++) {
      let x = -r() * n * 0.08 + (y % 2 ? n * 0.045 : 0);
      while (x < n) {
        const w = n * (0.07 + r() * 0.05);
        const top = y * h - h * 0.45, bot = y * h + h * (0.88 + r() * 0.1);
        const tone = 0.55 + r() * 0.3;
        c.save();
        c.beginPath();
        c.moveTo(x + 2, top); c.lineTo(x + w - 2, top);
        c.lineTo(x + w - 2 - r() * 2, bot - w * 0.22);
        c.quadraticCurveTo(x + w / 2, bot + w * 0.08, x + 2 + r() * 2, bot - w * 0.22);
        c.closePath();
        c.fillStyle = gray(tone); c.fill();
        c.clip();
        // ziarno i pasma w kamieniu
        for (let k = 0; k < 14; k++) { c.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.07})`; c.fillRect(x + r() * w, top + r() * (bot - top), n * (0.002 + r() * 0.008), n * (0.001 + r() * 0.003)); }
        const gl = c.createLinearGradient(0, top, 0, bot);
        gl.addColorStop(0, 'rgba(0,0,0,0.35)'); gl.addColorStop(0.45, 'rgba(0,0,0,0)'); gl.addColorStop(0.85, 'rgba(255,255,255,0.08)'); gl.addColorStop(1, 'rgba(0,0,0,0.25)');
        c.fillStyle = gl; c.fillRect(x, top, w, bot - top);
        // mech w szczelinach u dołu płytki
        if (r() > 0.82) { c.fillStyle = 'rgba(70,90,40,0.35)'; c.beginPath(); c.arc(x + r() * w, bot - h * 0.1, n * (0.006 + r() * 0.01), 0, 6.3); c.fill(); }
        c.restore();
        // cień rzucany przez płytkę na rząd niżej
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 3, bot - 1, w - 6, n * 0.006);
        x += w;
      }
    }
  },
  burlap(c, n, r) {
    // zapasowy wzór płótna workowego (gdy zdjęcie się nie wczyta): gęsty splot nici
    c.fillStyle = gray(0.8); c.fillRect(0, 0, n, n);
    const s = n / 32;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { c.fillStyle = gray((x + y) % 2 ? 0.7 + r() * 0.1 : 0.88 + r() * 0.08); c.fillRect(x * s, y * s, s * 0.9, s * 0.9); }
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
const size = (kind: Kind): number => (TEST ? 256 : kind === 'cobble' || kind === 'ashlar' || kind === 'bricks' || kind === 'dressed' || kind === 'slate' || kind === 'grass' ? 2048 : 1024);
function paint(kind: Kind, n: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // wzory były rysowane dla 64 px (trawa i liście dla 128/256): skalujemy rysunek, a nie rozmywamy gotowy obraz
  const base = kind === 'ashlar' || kind === 'bricks' || kind === 'dressed' || kind === 'slate' ? 1024 : kind === 'cobble' || kind === 'grass' ? n : ['leaves', 'needles', 'bark', 'soil', 'window', 'water', 'rock', 'organic'].includes(kind) ? 128 : 64;
  ctx.save();
  ctx.scale(n / base, n / base);
  PAINT[painter(kind)](ctx, base, noise(kind.length * 7919));
  ctx.restore();
  if (kind !== 'window') grain(ctx, n, kind.length * 31);
  return canvas;
}

// --- pamięć gotowych tekstur w przeglądarce (IndexedDB): drugie wejście nie rysuje ich od nowa ---
const stored = new Map<Kind, HTMLCanvasElement>();
const DB = 'project1-tex';
/** Klucz zmienia się razem z kodem rysującym, więc po zmianie wyglądu tekstura rysuje się na nowo */
function keyOf(kind: Kind, n: number): string {
  const src = String(PAINT[painter(kind)]) + String(grain);
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

/**
 * Zdjęciowe tekstury CC0 (ambientCG, Poly Haven) — w odcieniach szarości,
 * żeby barwę nadawał materiał, plus mapy normalnych dające prawdziwą rzeźbę: bruk, deski, tynk.
 */
const PHOTO: Partial<Record<Kind, string>> = { cobble: 'cobble', planks: 'planks', plaster: 'plaster', thatch: 'thatch', slate: 'slate', ashlar: 'ashlar', bricks: 'bricks', burlap: 'burlap', grass: 'grass', soil: 'soil', rock: 'rock', bark: 'bark', wool: 'wool', iron: 'iron', mail: 'mail' };
const photoBase = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const normals = new Map<Kind, THREE.Texture>();
const loading: Promise<void>[] = [];
/** Wczytuje zdjęciową teksturę i zapamiętuje, kiedy dojdzie (albo się nie uda) — patrz texturesReady */
const loadPhoto = (url: string): THREE.Texture => {
  let done = (): void => {};
  loading.push(new Promise<void>((r) => { done = r; }));
  return new THREE.TextureLoader().load(url, () => done(), undefined, () => done());
};
/** Obietnica spełniona, gdy wszystkie dotąd zamówione tekstury zdjęciowe są już wczytane */
export const texturesReady = (): Promise<void> => Promise.all(loading).then(() => undefined);
const photos = new Map<Kind, THREE.Texture>();
/** Mapa normalnych dla zdjęciowej tekstury (albo null, gdy wzór jest rysowany w kodzie) */
export function normal(kind: Kind): THREE.Texture | null {
  const f = PHOTO[kind];
  if (!f || typeof document === 'undefined' || TEST) return null;
  let n = normals.get(kind);
  if (!n) {
    n = loadPhoto(`${photoBase()}${f}_n.jpg`);
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.anisotropy = 8;
    normals.set(kind, n);
  }
  return n;
}

export function pattern(kind: Kind): THREE.Texture | null {
  let t = cache.get(kind);
  if (t) return t;
  if (typeof document === 'undefined') return null;
  const photo = PHOTO[kind];
  if (photo && !TEST) {
    let pt = photos.get(kind);
    if (!pt) {
      pt = loadPhoto(`${photoBase()}${photo}.jpg`);
      pt.wrapS = pt.wrapT = THREE.RepeatWrapping;
      pt.colorSpace = THREE.SRGBColorSpace;
      pt.anisotropy = 16;
      photos.set(kind, pt);
    }
    return pt;
  }
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
  if (PHOTO[kind] && !TEST) return null; // zdjęciowe mają mapę normalnych
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

const grays = new Map<Kind, THREE.CanvasTexture>();
/**
 * Szara wersja tekstury (jasność średnio ok. 0,9, w przestrzeni liniowej): sam splot, słoje albo ziarno, bez barwy.
 * Do rzeczy, których kolor daje gra (ubrania w barwach pana, suknie, pranie) — zdjęciowa juta zabarwiłaby je na brązowo.
 * Wypełnia się, gdy wczyta się zdjęcie (albo od razu, gdy wzór jest rysowany w kodzie).
 */
export function grayPattern(kind: Kind, max = 512): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const have = grays.get(kind);
  if (have) return have;
  const src = pattern(kind);
  if (!src) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) { ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, 4, 4); }
  const out = new THREE.CanvasTexture(canvas);
  out.wrapS = out.wrapT = THREE.RepeatWrapping;
  out.colorSpace = THREE.NoColorSpace;
  out.anisotropy = 8;
  grays.set(kind, out);
  const fill = (): boolean => {
    const img = src.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if (!ctx || !img || !img.width) return false;
    const n = Math.min(max, img.width);
    canvas.width = canvas.height = n;
    ctx.drawImage(img, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n), px = d.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i]! * 0.3 + px[i + 1]! * 0.59 + px[i + 2]! * 0.11;
    const mean = Math.max(1, sum / (px.length / 4));
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i]! * 0.3 + px[i + 1]! * 0.59 + px[i + 2]! * 0.11) / mean;
      const v = Math.max(0, Math.min(255, Math.round((0.9 + (l - 1) * 0.8) * 255)));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    out.needsUpdate = true;
    return true;
  };
  if (!fill()) { const iv = setInterval(() => { if (fill()) clearInterval(iv); }, 250); setTimeout(() => clearInterval(iv), 30000); }
  return out;
}

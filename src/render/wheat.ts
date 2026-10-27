import * as THREE from 'three';

/**
 * Zboże na zagonach farmy. Każda kępa to dwie skrzyżowane karty z teksturą malowaną raz na płótnie:
 * źdźbła z kolankami, liście, kłosy z ziarnami ułożonymi w dwa rzędy i długimi ośćmi. Tło przezroczyste
 * (alphaTest), więc z bliska widać pojedyncze ziarna i ości, a nie gołe stożki.
 * Atlas: 4 kolumny × 1 rząd, w każdej inna kępa (3–4 źdźbła), żeby rzędy nie wyglądały jak powielone.
 */

const COLS = 4;
const CW = 128, CH = 512;

function earTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = CW * COLS;
  c.height = CH;
  const ctx = c.getContext('2d')!;
  let s = 0x51f15e;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  for (let col = 0; col < COLS; col++) {
    const ox = col * CW;
    const stalks = 3 + (col % 2);
    for (let k = 0; k < stalks; k++) {
      const x0 = ox + CW * (0.5 + (k - (stalks - 1) / 2) * 0.16 + (rnd() - 0.5) * 0.06);
      const top = CH * (0.06 + rnd() * 0.12);
      const lean = (rnd() - 0.5) * CW * 0.28;
      const earLen = CH * (0.2 + rnd() * 0.05);
      const xt = x0 + lean, yt = top + earLen; // podstawa kłosa
      const light = 42 + rnd() * 14;

      // źdźbło: lekko wygięte, u dołu zielonkawe, wyżej słomkowe
      const g = ctx.createLinearGradient(0, CH, 0, yt);
      g.addColorStop(0, `hsl(62, 30%, ${light - 18}%)`);
      g.addColorStop(0.5, `hsl(46, 45%, ${light}%)`);
      g.addColorStop(1, `hsl(44, 50%, ${light + 8}%)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, CH);
      ctx.quadraticCurveTo(x0 + lean * 0.2, CH * 0.6, xt, yt);
      ctx.stroke();
      // kolanka (zgrubienia) na źdźble
      for (const t of [0.3, 0.55]) {
        const y = CH - (CH - yt) * t;
        const x = x0 + (xt - x0) * t * t;
        ctx.fillStyle = `hsl(42, 40%, ${light - 10}%)`;
        ctx.fillRect(x - 2.4, y - 1.5, 4.8, 3);
      }
      // liść odchodzący od dołu źdźbła
      const ly = CH * (0.72 + rnd() * 0.12), side = rnd() < 0.5 ? -1 : 1;
      ctx.fillStyle = `hsl(${55 + rnd() * 12}, 32%, ${light - 12}%)`;
      ctx.beginPath();
      ctx.moveTo(x0, ly);
      ctx.quadraticCurveTo(x0 + side * CW * 0.22, ly - CH * 0.1, x0 + side * CW * 0.3, ly - CH * 0.02);
      ctx.quadraticCurveTo(x0 + side * CW * 0.16, ly - CH * 0.05, x0, ly + 6);
      ctx.fill();

      // kłos: ziarna naprzemiennie w dwóch rzędach, od dołu ku czubkowi coraz mniejsze
      const grains = 11;
      const dx = (xt - (x0 + lean * 0.9)) / earLen; // nachylenie kłosa wzdłuż linii
      for (let i = 0; i < grains; i++) {
        const t = i / (grains - 1);
        const y = yt - t * earLen;
        const x = xt - dx * t * earLen + lean * 0.1 * t;
        const sz = 1 - t * 0.45;
        for (const sd of [-1, 1]) {
          const gx = x + sd * 4.2 * sz, gy = y + (sd > 0 ? 3 : 0);
          // ość z ziarna, długa, lekko rozchylona
          ctx.strokeStyle = `hsla(45, 45%, ${light + 18}%, 0.95)`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(gx, gy - 4);
          ctx.lineTo(gx + sd * (5 + t * 4) + lean * 0.05, gy - 34 - t * 10);
          ctx.stroke();
          // ziarno z plewą: ciemniejszy brzeg, jaśniejszy środek
          ctx.fillStyle = `hsl(${40 + rnd() * 6}, 55%, ${light - 4 + rnd() * 6}%)`;
          ctx.beginPath();
          ctx.ellipse(gx, gy, 4.6 * sz, 7.4 * sz, sd * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(48, 60%, ${light + 22}%, 0.85)`;
          ctx.beginPath();
          ctx.ellipse(gx - sd * 0.8, gy - 1, 1.8 * sz, 4.4 * sz, sd * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

export const wheatMat = new THREE.MeshStandardMaterial({
  map: earTexture(),
  vertexColors: true,
  alphaTest: 0.45,
  side: THREE.DoubleSide,
  roughness: 0.85,
});

/** Cień kart zboża z tą samą przezroczystością co tekstura (bez tego rzucałyby kwadratowe plamy). */
export const wheatDepthMat = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  map: wheatMat.map,
  alphaTest: 0.45,
  side: THREE.DoubleSide,
});

const rows = new Map<number, THREE.BufferGeometry>();

/** Jeden rząd zboża długości 1,78 (skalowany w x do długości zagonu): ok. 100 kęp po dwie skrzyżowane karty. */
export function wheatRow(variant: number): THREE.BufferGeometry {
  const v = variant % 3;
  const hit = rows.get(v);
  if (hit) return hit;
  const P: number[] = [], U: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  let r = 1234 + v * 977;
  const rnd = (): number => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let x = -0.86; x <= 0.86; x += 0.05)
    for (const lane of [-0.08, 0, 0.08]) {
      const px = x + (rnd() - 0.5) * 0.04, pz = lane + (rnd() - 0.5) * 0.05;
      const h = 0.36 + rnd() * 0.14, w = 0.1 + rnd() * 0.03;
      const col = Math.floor(rnd() * COLS), u0 = col / COLS, u1 = (col + 1) / COLS;
      const shade = 0.86 + rnd() * 0.22;
      const a0 = rnd() * Math.PI;
      const tip = (rnd() - 0.5) * 0.06; // czubek lekko przechylony
      for (const a of [a0, a0 + Math.PI / 2]) {
        const cx = Math.cos(a) * w / 2, cz = Math.sin(a) * w / 2;
        const b = P.length / 3;
        P.push(px - cx, 0, pz - cz, px + cx, 0, pz + cz, px + cx + tip, h, pz + cz, px - cx + tip, h, pz - cz);
        U.push(u0, 0, u1, 0, u1, 1, u0, 1);
        // normalne w górę, jak w kępach trawy: obie strony karty oświetlone tak samo
        for (let i = 0; i < 4; i++) N.push(0, 1, 0);
        // u dołu przyciemnione (cień w łanie), u góry pełne światło
        C.push(shade * 0.55, shade * 0.55, shade * 0.5, shade * 0.55, shade * 0.55, shade * 0.5, shade, shade, shade, shade, shade, shade);
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I);
  rows.set(v, geo);
  return geo;
}

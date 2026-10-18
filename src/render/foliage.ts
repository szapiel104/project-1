import * as THREE from 'three';
import { model } from './modelstore';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
const TREES = model('trees');

/**
 * Drzewa z Blendera (tools/models/trees.py) i tekstury kart korony: gałąź świerka z igłami i kępa liści,
 * rysowane raz na płótnie z przezroczystym tłem (przezroczystość tnie alphaTest w materiale korony).
 */
type Packed = { pos: string; nrm: string; col: string; uv: string; idx: string };
const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function treeGeo(name: 'pineTrunk' | 'pineCrown' | 'pineShadow' | 'leafTrunk' | 'leafCrown' | 'leafShadow' | 'fern' | 'deadwood'): THREE.BufferGeometry {
  return packedGeo((TREES as unknown as Record<string, Packed>)[name]!);
}

function packedGeo(m: Packed): THREE.BufferGeometry {
  const pos = b64(m.pos), nrm = b64(m.nrm), col = b64(m.col), uv = b64(m.uv), idx = b64(m.idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.buffer.slice(pos.byteOffset, pos.byteOffset + pos.byteLength)), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength)), 3, true));
  const lin = new Float32Array(col.length);
  for (let i = 0; i < col.length; i++) { const c = col[i]! / 255; lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  g.setAttribute('color', new THREE.BufferAttribute(lin, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv.buffer.slice(uv.byteOffset, uv.byteOffset + uv.byteLength)), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)), 1));
  g.computeBoundingSphere();
  return g;
}

function rng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const cache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  cache.set(key, tex);
  return tex;
}

/**
 * Gałąź świerka (u wzdłuż gałęzi od pnia ku końcowi, v w poprzek): gałązka środkowa, boczne odnogi skierowane do końca,
 * na nich gęste, krótkie igły w kilku odcieniach zieleni; końce jaśniejsze (młode przyrosty).
 */
export function needleTexture(): THREE.Texture {
  return canvasTex('needles', 512, 256, (c) => {
    const r = rng(5);
    const W = 512, H = 256, cy = H / 2;
    const needle = (x: number, y: number, a: number, len: number, col: string): void => {
      c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    };
    // jasne, mało nasycone: barwę daje instancja (kolor drzewa) i pora roku, tekstura niesie rysunek i jasność
    const green = (k: number): string => { const l = 48 + k * 32 + r() * 10; return `hsl(${95 + r() * 25}, ${14 + r() * 12}%, ${l}%)`; };
    // obrys gałęzi: szeroka przy pniu, zwęża się ku końcowi (wierzchołek u = 1)
    const half = (u: number): number => (H * 0.46) * (1 - u * 0.55) * Math.min(1, u * 6 + 0.35);
    // boczne odnogi
    for (let i = 0; i < 26; i++) {
      const u = 0.04 + (i / 26) * 0.92, x = u * W;
      for (const sgn of [-1, 1]) {
        const hw = half(u) * (0.75 + r() * 0.3);
        const ex = x + hw * 0.55, ey = cy + sgn * hw;
        c.strokeStyle = '#4a3a24'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, cy); c.lineTo(ex, ey); c.stroke();
        // igły wzdłuż odnogi, po obu stronach
        const steps = Math.ceil(hw / 4);
        for (let s = 0; s < steps; s++) {
          const t = s / steps, px = x + (ex - x) * t, py = cy + (ey - cy) * t;
          const base = Math.atan2(ey - cy, ex - x);
          const len = 9 + r() * 6;
          needle(px, py, base - 0.9 + (r() - 0.5) * 0.3, len, green(u * 0.6 + t * 0.5));
          needle(px, py, base + 0.9 + (r() - 0.5) * 0.3, len, green(u * 0.6 + t * 0.5));
        }
      }
    }
    // gałązka środkowa z igłami
    c.strokeStyle = '#3d2f1e'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, cy); c.lineTo(W * 0.98, cy); c.stroke();
    for (let x = 0; x < W * 0.98; x += 3) {
      const u = x / W;
      needle(x, cy, -1.2 + (r() - 0.5) * 0.4, 12, green(u * 0.7));
      needle(x, cy, 1.2 + (r() - 0.5) * 0.4, 12, green(u * 0.7));
    }
  });
}

/** Kępa liści: kilkadziesiąt jajowatych liści z nerwem, na kilku gałązkach, w odcieniach zieleni; brzegi przezroczyste */
export function leafTexture(): THREE.Texture {
  return canvasTex('leaves', 256, 256, (c) => {
    const r = rng(9);
    const S = 256, cx = S / 2, cy = S / 2;
    // gałązki rozchodzące się od środka
    c.strokeStyle = '#4b3a26'; c.lineWidth = 3;
    const twigs: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r() * 0.5, L = S * (0.32 + r() * 0.1);
      const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
      twigs.push([ex, ey]);
    }
    const leaf = (x: number, y: number, a: number, s: number): void => {
      c.save(); c.translate(x, y); c.rotate(a);
      const l = 55 + r() * 30;
      c.fillStyle = `hsl(${80 + r() * 30}, ${18 + r() * 14}%, ${l}%)`;
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(s * 0.35, -s * 0.42, s * 0.85, -s * 0.3, s, 0);
      c.bezierCurveTo(s * 0.85, s * 0.3, s * 0.35, s * 0.42, 0, 0);
      c.fill();
      c.strokeStyle = `hsla(80, 30%, ${l + 14}%, 0.6)`; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.95, 0); c.stroke();
      c.restore();
    };
    // liście gęsto w kole, rzadziej przy brzegu (kępa ma postrzępiony obrys)
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.4;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      leaf(x, y, a + (r() - 0.5) * 1.6, 18 + r() * 14);
    }
  });
}

/** Paproć (karta stojąca): pióro z listkami po obu stronach osadki, łukiem opadające */
export function fernTexture(): THREE.Texture {
  return canvasTex('fern', 256, 256, (c) => {
    const r = rng(3);
    const S = 256;
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.42 + (r() - 0.5) * 0.15;
      const L = S * (0.62 + r() * 0.2);
      let x = S / 2, y = S - 4;
      const steps = 22;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const ang = a + t * t * (a < -Math.PI / 2 ? -0.9 : 0.9) * 0.6;
        const nx = x + Math.cos(ang) * (L / steps), ny = y + Math.sin(ang) * (L / steps);
        c.strokeStyle = '#3f5a22'; c.lineWidth = 2.5 * (1 - t) + 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(nx, ny); c.stroke();
        const pl = (1 - t) * 26 + 4;
        for (const sg of [-1, 1]) {
          const pa = ang + sg * 1.2;
          c.fillStyle = `hsl(${92 + r() * 18}, 45%, ${24 + t * 14 + r() * 6}%)`;
          c.beginPath(); c.ellipse(nx + Math.cos(pa) * pl / 2, ny + Math.sin(pa) * pl / 2, pl / 2, 3.2, pa, 0, Math.PI * 2); c.fill();
        }
        x = nx; y = ny;
      }
    }
  });
}

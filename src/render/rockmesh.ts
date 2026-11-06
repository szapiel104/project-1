import * as THREE from 'three';

/**
 * Gęsta siatka skały (Michał 3.11.2026: „zbocza, tekstury rozjechane, góry to dziwne piki”).
 *
 * Plansza ma jeden wierzchołek na pole (ok. 3 m), więc zbocze góry albo urwisko to jeden pasek wielkich trójkątów:
 * tekstura rozciąga się po nim, a kontur jest kanciasty. Pola skały (góry na krańcach i skała wewnątrz mapy) rysujemy
 * więc osobno, w siatce 4×4 na pole, z wyrzeźbioną powierzchnią: żebra, żleby i półki z szumu grzbietowego, a normalne
 * liczone z prawdziwej, drobnej powierzchni — światło i rzut tekstury z trzech stron (shader ziemi) pracują na
 * szczegółach, a nie na płaskich płatach.
 *
 * Krawędzie: na brzegu pola, które graniczy z polem bez skały (i na brzegu mapy), rzeźba schodzi do zera, a wysokość
 * idzie dokładnie po krawędzi zwykłej siatki — siatki stykają się bez szpar. `disp` daje tę samą rzeźbę, żeby drzewa,
 * strumienie i mgła stały na prawdziwej powierzchni (terrain.ts → heightAt).
 */
export interface RockSource {
  w: number; h: number; ox: number; oz: number;
  /** Czy pole jest skałą (rysowane tu, a nie na planszy) */
  rock(tx: number, ty: number): boolean;
  /** Wysokość narożnika zwykłej siatki */
  corner(cx: number, cy: number): number;
  /** Kolor, udziały warstw (4) i piasek w narożnikach — jak na planszy */
  col: Float32Array; splat: Float32Array; sand: Float32Array;
  /** Szum 2D −1..1 */
  noise(x: number, y: number): number;
  /** Normalne narożników zwykłej siatki (3 na narożnik) — przy brzegu skały światło jak na sąsiednim polu */
  nor?: Float32Array;
}

/** 0 na brzegu pola skały, które graniczy z polem bez skały (albo z brzegiem mapy), 1 od ok. 0,7 pola w głąb */
export function rockMask(s: RockSource, fx: number, fy: number): number {
  const { w, h } = s;
  const isRock = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && s.rock(x, y);
  const tx = Math.floor(fx), ty = Math.floor(fy);
  if (!isRock(tx, ty)) return 0;
  let near = 2;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    if (isRock(tx + dx, ty + dy)) continue;
    const bx = Math.max(tx + dx - fx, 0, fx - (tx + dx + 1)), by = Math.max(ty + dy - fy, 0, fy - (ty + dy + 1));
    near = Math.min(near, Math.hypot(bx, by));
  }
  const k = Math.min(1, near / 0.7);
  return k * k * (3 - 2 * k);
}

/** Ile kawałków na bok pola */
const N = 4;

/** Rzeźba skały w punkcie (pola, ułamkowo): 0 poza skałą i na jej brzegu */
export function rockDisplacer(s: RockSource): (fx: number, fy: number) => number {
  const { w, h } = s;
  const isRock = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && s.rock(x, y);
  const base = (fx0: number, fy0: number): number => {
    // poza planszą (normalna z różnic na brzegu x = 0 albo y = 0) bierzemy brzeg: wcześniej indeks −1 dawał NaN w normalnej
    // i skała przy krawędzi mapy rysowała się czarną kreską (Michał 6.11.2026: „czarna kreska na krańcu mapy”)
    const fx = Math.max(0, Math.min(w, fx0)), fy = Math.max(0, Math.min(h, fy0));
    const ix = Math.min(w - 1, Math.floor(fx)), iy = Math.min(h - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
    if (tx + ty <= 1) { const a = s.corner(ix, iy); return a + (s.corner(ix + 1, iy) - a) * tx + (s.corner(ix, iy + 1) - a) * ty; }
    const d = s.corner(ix + 1, iy + 1);
    return d + (s.corner(ix, iy + 1) - d) * (1 - tx) + (s.corner(ix + 1, iy) - d) * (1 - ty);
  };
  const ridged = (x: number, y: number): number => {
    let v = 0, a = 0.55, f = 1, sum = 0;
    for (let o = 0; o < 4; o++) { const n = 1 - Math.abs(s.noise(x * f, y * f)); v += n * n * a; sum += a; a *= 0.5; f *= 2.1; }
    return v / sum;
  };
  return (fx, fy) => {
    const tx = Math.floor(fx), ty = Math.floor(fy);
    if (!isRock(tx, ty)) return 0;
    // odległość do najbliższego pola bez skały (w polach): na jego brzegu rzeźba = 0
    let near = 2;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (isRock(tx + dx, ty + dy)) continue;
      const bx = Math.max(tx + dx - fx, 0, fx - (tx + dx + 1)), by = Math.max(ty + dy - fy, 0, fy - (ty + dy + 1));
      near = Math.min(near, Math.hypot(bx, by));
    }
    const mask = near >= 0.7 ? 1 : near <= 0 ? 0 : (near / 0.7) * (near / 0.7) * (3 - 2 * (near / 0.7));
    if (mask <= 0) return 0;
    const hb = base(fx, fy);
    const amp = Math.max(0.22, Math.min(1.25, 0.2 + (hb - 0.6) * 0.09));
    // żebra i żleby (grzbietowy) + duże wybrzuszenia, żeby ściana nie była równą płytą
    const r = ridged(fx / 1.7 + 11.3, fy / 1.7 - 4.1);
    const big = s.noise(fx / 5.5 - 2.7, fy / 5.5 + 8.9);
    return mask * amp * ((r - 0.45) * 1.7 + big * 0.5);
  };
}

/** Siatka skały: wszystkie pola skały w 4×4 kawałkach (indeksowana), z kolorem, warstwami i piaskiem jak plansza */
export function buildRockGeometry(s: RockSource, disp: (fx: number, fy: number) => number): THREE.BufferGeometry | null {
  const { w, h, ox, oz } = s;
  const tiles: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (s.rock(x, y)) tiles.push(y * w + x);
  if (!tiles.length) return null;
  const V = (N + 1) * (N + 1);
  const pos = new Float32Array(tiles.length * V * 3), nor = new Float32Array(tiles.length * V * 3), col = new Float32Array(tiles.length * V * 3);
  const uv = new Float32Array(tiles.length * V * 2), spl = new Float32Array(tiles.length * V * 4), snd = new Float32Array(tiles.length * V);
  const idx = new Uint32Array(tiles.length * N * N * 6);
  const base = (fx0: number, fy0: number): number => {
    // poza planszą (normalna z różnic na brzegu x = 0 albo y = 0) bierzemy brzeg: wcześniej indeks −1 dawał NaN w normalnej
    // i skała przy krawędzi mapy rysowała się czarną kreską (Michał 6.11.2026: „czarna kreska na krańcu mapy”)
    const fx = Math.max(0, Math.min(w, fx0)), fy = Math.max(0, Math.min(h, fy0));
    const ix = Math.min(w - 1, Math.floor(fx)), iy = Math.min(h - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
    if (tx + ty <= 1) { const a = s.corner(ix, iy); return a + (s.corner(ix + 1, iy) - a) * tx + (s.corner(ix, iy + 1) - a) * ty; }
    const d = s.corner(ix + 1, iy + 1);
    return d + (s.corner(ix, iy + 1) - d) * (1 - tx) + (s.corner(ix + 1, iy) - d) * (1 - ty);
  };
  // wysokość wewnątrz pola: ten sam podział trójkątów co plansza (na krawędzi liniowo, więc szwy się zgadzają)
  const H = (fx: number, fy: number): number => base(fx, fy) + disp(fx, fy);
  const lerpC = (arr: Float32Array, stride: number, k: number, fx: number, fy: number): number => {
    const ix = Math.min(w - 1, Math.floor(fx)), iy = Math.min(h - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
    const at = (cx: number, cy: number): number => arr[(cy * (w + 1) + cx) * stride + k]!;
    return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
  };
  const e = 0.03;
  const nv = new THREE.Vector3();
  let v = 0, ii = 0;
  for (const t of tiles) {
    const tx = t % w, ty = (t - tx) / w, v0 = v;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const fx = tx + i / N, fy = ty + j / N;
      const d = disp(fx, fy), hy = base(fx, fy) + d;
      pos[v * 3] = fx + ox; pos[v * 3 + 1] = hy; pos[v * 3 + 2] = fy + oz;
      nv.set(H(fx - e, fy) - H(fx + e, fy), 2 * e, H(fx, fy - e) - H(fx, fy + e)).normalize();
      // przy brzegu z polem bez skały normalna przechodzi w normalną zwykłej siatki: shader rozstrzyga skała/piach
      // po stromiźnie, więc inna normalna po dwóch stronach krawędzi dawała prostą, ostrą granicę (Michał 3.11.2026)
      if (s.nor) {
        const m = rockMask(s, fx, fy);
        if (m < 1) {
          const cx = lerpC(s.nor, 3, 0, fx, fy), cy = lerpC(s.nor, 3, 1, fx, fy), cz = lerpC(s.nor, 3, 2, fx, fy);
          nv.set(cx + (nv.x - cx) * m, cy + (nv.y - cy) * m, cz + (nv.z - cz) * m).normalize();
        }
      }
      nor[v * 3] = nv.x; nor[v * 3 + 1] = nv.y; nor[v * 3 + 2] = nv.z;
      // żleby ciemniejsze, żebra jaśniejsze (cień w zagłębieniach jak w prawdziwej skale)
      const ao = Math.max(0.72, Math.min(1.12, 1 + d * 0.35));
      for (let k = 0; k < 3; k++) col[v * 3 + k] = lerpC(s.col, 3, k, fx, fy) * ao;
      for (let k = 0; k < 4; k++) spl[v * 4 + k] = lerpC(s.splat, 4, k, fx, fy);
      // bez wymuszania skały na całe pole: na krawędzi pola byłby skok (schodki skała/piach, Michał 3.11.2026);
      // skałę na stromych ścianach daje sam shader ziemi (stromizna), a płaskie półki zostają piachem albo trawą
      snd[v] = lerpC(s.sand, 1, 0, fx, fy);
      uv[v * 2] = fx / 5; uv[v * 2 + 1] = fy / 5;
      v++;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = v0 + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      // ta sama przekątna co na planszy (b–c), żeby obrys przy krawędzi pola był identyczny
      idx[ii++] = a; idx[ii++] = c; idx[ii++] = b;
      idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  geo.setAttribute('sand', new THREE.BufferAttribute(snd, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

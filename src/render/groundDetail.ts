import * as THREE from 'three';

/**
 * Gęstsza siatka terenu przy kamerze (docs/webgpu.md, punkt 4; Michał 3.11.2026: „rób siatkę”).
 *
 * Plansza ma jeden wierzchołek na pole (ok. 3 m): pagórek to kilka płaskich trójkątów, a jego obrys w spacerze
 * i na zboczach jest kanciasty. Wokół kamery rysujemy więc łatę N×N pól w siatce S×S na pole z gładką powierzchnią
 * (Catmull–Rom przez narożniki planszy — przechodzi dokładnie przez nie, więc brzegi wody, działki i wykopy zostają
 * na miejscu; przycięta do wysokości narożników pola, żeby nie wybrzuszać się ponad płaskie działki). Pod łatą pola
 * planszy nie są rysowane (indeks planszy je pomija).
 *
 * Szwy: przy brzegu łaty i przy skale (osobna siatka z rockmesh.ts) gładkość wygasa do zwykłych trójkątów planszy, więc
 * krawędzie wypadają dokładnie na krawędziach planszy i nic się nie rozchodzi. Kolor, udziały warstw i piasek
 * w łacie biorą się z bieżącej planszy (z wydeptaniem, wykopami i wyrównaniem działek), więc łata odświeża się po
 * każdej zmianie planszy (najwyżej raz na 2 s) i gdy kamera odjedzie o kilka pól.
 */
export interface DetailSource {
  w: number; h: number; ox: number; oz: number;
  /** Geometria planszy: 6 wierzchołków na pole, kolejność narożników (0,0) (0,1) (1,0) (1,0) (0,1) (1,1) */
  geo: THREE.BufferGeometry;
  /** Pola skały (osobna siatka) — łata ich nie rysuje i przy nich nie wygładza */
  rock(tx: number, ty: number): boolean;
}

/** Bok łaty w polach i podział pola */
const N = 64, S = 3;
/** Na ilu polach przy brzegu łaty gładkość wygasa do zwykłej planszy */
const RAMP = 4;
/** O ile pól musi się przesunąć kamera, żeby łata pojechała za nią */
const STEP = 8;

export class GroundDetail {
  readonly mesh: THREE.Mesh;
  private readonly src: DetailSource;
  private x0 = -1e9;
  private y0 = -1e9;
  private nx = 0;
  private ny = 0;
  private vers = '';
  private dirtyAt = 0;
  private readonly baseIdx: THREE.BufferAttribute;
  private readonly V = (N * S + 1) * (N * S + 1);
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly col: Float32Array;
  private readonly spl: Float32Array;
  private readonly snd: Float32Array;
  private readonly uvs: Float32Array;
  private readonly idx: Uint32Array;
  /** Wysokości narożników łaty z zapasem 1 pola na boki (do Catmulla–Roma): (N+3)² */
  private readonly hc = new Float32Array((N + 4) * (N + 4));
  /** Pola łaty przy skale (bez wygładzania) */
  private readonly nr = new Uint8Array(N * N);

  constructor(src: DetailSource, material: THREE.Material | THREE.Material[]) {
    this.src = src;
    const V = this.V;
    this.pos = new Float32Array(V * 3); this.nor = new Float32Array(V * 3); this.col = new Float32Array(V * 3);
    this.spl = new Float32Array(V * 4); this.snd = new Float32Array(V); this.uvs = new Float32Array(V * 2);
    this.idx = new Uint32Array(N * N * S * S * 6);
    const g = new THREE.BufferGeometry();
    const dyn = (a: Float32Array, n: number): THREE.BufferAttribute => new THREE.BufferAttribute(a, n);
    g.setAttribute('position', dyn(this.pos, 3));
    g.setAttribute('normal', dyn(this.nor, 3));
    g.setAttribute('color', dyn(this.col, 3));
    g.setAttribute('uv', dyn(this.uvs, 2));
    g.setAttribute('splat', dyn(this.spl, 4));
    g.setAttribute('sand', dyn(this.snd, 1));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1));
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // plansza z indeksem: łatwo pominąć pola pod łatą (indeks przebudowywany, gdy łata się przesunie)
    const { w, h, geo } = src;
    const bi = new Uint32Array(w * h * 6);
    for (let i = 0; i < bi.length; i++) bi[i] = i;
    this.baseIdx = new THREE.BufferAttribute(bi, 1);
    geo.setIndex(this.baseIdx);
    geo.setDrawRange(0, bi.length);
  }

  /** Klikanie w teren: promień ma trafiać w całą planszę (także pod łatą), więc liczony bez indeksu */
  raycastWhole(mesh: THREE.Mesh, raycaster: THREE.Raycaster, out: THREE.Intersection[]): void {
    const g = mesh.geometry, idx = g.index, dr = { start: g.drawRange.start, count: g.drawRange.count };
    g.index = null; g.setDrawRange(0, Infinity);
    try { THREE.Mesh.prototype.raycast.call(mesh, raycaster, out); } finally { g.index = idx; g.setDrawRange(dr.start, dr.count); }
  }

  // --- dane planszy w narożnikach (bieżące: z wydeptaniem, wykopami, wyrównaniem) ---
  /** Numer wierzchołka planszy dla narożnika (cx, cy), z pola, które nie jest skałą (skała ma pole zwinięte) */
  private vtx(cx: number, cy: number): number {
    const { w, h } = this.src;
    let best = -1;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const tx = cx - dx, ty = cy - dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      const slot = dx === 0 ? (dy === 0 ? 0 : 1) : dy === 0 ? 2 : 5;
      const v = (ty * w + tx) * 6 + slot;
      if (!this.src.rock(tx, ty)) return v;
      if (best < 0) best = v;
    }
    return best;
  }

  private cornerH(cx: number, cy: number): number {
    const { w, h } = this.src;
    const v = this.vtx(Math.max(0, Math.min(w, cx)), Math.max(0, Math.min(h, cy)));
    return (this.src.geo.getAttribute('position') as THREE.BufferAttribute).array[v * 3 + 1] as number;
  }

  private hcAt(cx: number, cy: number): number { return this.hc[(cy - this.y0 + 1) * (N + 4) + (cx - this.x0 + 1)]!; }

  /** Czy pole lub któryś sąsiad to skała (tam bez wygładzania — szew z siatką skały) */
  private nearRock(tx: number, ty: number): boolean {
    const { w, h } = this.src;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < w && y < h && this.src.rock(x, y)) return true;
    }
    return false;
  }

  /** Wysokość łaty w punkcie (pola, ułamkowo; wewnątrz łaty) */
  private surf(fx: number, fy: number): number {
    const { w, h } = this.src;
    const ix = Math.min(w - 1, Math.floor(fx)), iy = Math.min(h - 1, Math.floor(fy));
    const tx = fx - ix, ty = fy - iy;
    const a = this.hcAt(ix, iy), b = this.hcAt(ix + 1, iy), c = this.hcAt(ix, iy + 1), d = this.hcAt(ix + 1, iy + 1);
    // zwykła plansza: dwa trójkąty z przekątną (1,0)–(0,1)
    const lin = tx + ty <= 1 ? a + (b - a) * tx + (c - a) * ty : d + (c - d) * (1 - tx) + (b - d) * (1 - ty);
    const edge = Math.min(fx - this.x0, this.x0 + this.nx - fx, fy - this.y0, this.y0 + this.ny - fy);
    let k = Math.max(0, Math.min(1, edge / RAMP));
    k = k * k * (3 - 2 * k);
    if (k <= 0 || this.nr[Math.min(this.ny - 1, Math.max(0, iy - this.y0)) * N + Math.min(this.nx - 1, Math.max(0, ix - this.x0))]) return lin;
    // Catmull–Rom w obu kierunkach przez 4×4 narożniki
    const wx = cr(tx), wy = cr(ty);
    let s = 0;
    for (let j = 0; j < 4; j++) {
      const yy = Math.max(this.y0 - 1, Math.min(this.y0 + this.ny + 1, iy - 1 + j));
      let r = 0;
      for (let i = 0; i < 4; i++) {
        const xx = Math.max(this.x0 - 1, Math.min(this.x0 + this.nx + 1, ix - 1 + i));
        r += wx[i]! * this.hcAt(xx, yy);
      }
      s += wy[j]! * r;
    }
    // bez wybrzuszeń ponad narożniki pola (płaska działka zostaje płaska)
    s = Math.max(Math.min(a, b, c, d), Math.min(Math.max(a, b, c, d), s));
    return lin + (s - lin) * k;
  }

  /** Wysokość terenu, jaką widać w łacie (null poza łatą i na skale) — dla ludzi i rzeczy stawianych w trakcie gry */
  heightAt(fx: number, fy: number): number | null {
    if (!this.mesh.visible || fx < this.x0 || fy < this.y0 || fx > this.x0 + this.nx || fy > this.y0 + this.ny) return null;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    if (tx >= 0 && ty >= 0 && tx < this.src.w && ty < this.src.h && this.src.rock(tx, ty)) return null;
    return this.surf(fx, fy);
  }

  /** Co klatkę: środek widoku w polach. Przebudowa, gdy kamera odjechała albo zmieniła się plansza */
  update(cx: number, cy: number, now: number): void {
    const { w, h, geo } = this.src;
    const gx = Math.max(0, Math.min(Math.max(0, w - N), Math.round(cx - N / 2)));
    const gy = Math.max(0, Math.min(Math.max(0, h - N), Math.round(cy - N / 2)));
    const moved = Math.abs(gx - this.x0) >= STEP || Math.abs(gy - this.y0) >= STEP;
    const v = ['position', 'color', 'splat', 'sand'].map((n) => (geo.getAttribute(n) as THREE.BufferAttribute).version).join(',');
    const changed = v !== this.vers;
    if (!moved && !(changed && now - this.dirtyAt > 2000)) return;
    if (moved) { this.x0 = gx; this.y0 = gy; }
    this.vers = v;
    this.dirtyAt = now;
    this.rebuild(moved);
  }

  private rebuild(moved: boolean): void {
    const { w, h, ox, oz, geo } = this.src;
    const nx = this.nx = Math.min(N, w), ny = this.ny = Math.min(N, h);
    const x0 = this.x0, y0 = this.y0;
    for (let j = -1; j <= ny + 2; j++) for (let i = -1; i <= nx + 2; i++) this.hc[(j + 1) * (N + 4) + (i + 1)] = this.cornerH(x0 + i, y0 + j);
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) this.nr[ty * N + tx] = this.nearRock(x0 + tx, y0 + ty) ? 1 : 0;
    const cA = (geo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    const sA = (geo.getAttribute('splat') as THREE.BufferAttribute).array as Float32Array;
    const dA = (geo.getAttribute('sand') as THREE.BufferAttribute).array as Float32Array;
    const GX = nx * S + 1, GY = ny * S + 1;
    const pos = this.pos, nor = this.nor, col = this.col, spl = this.spl, snd = this.snd, uvs = this.uvs;
    // wysokości siatki
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const fx = x0 + i / S, fy = y0 + j / S, v = j * GX + i;
      pos[v * 3] = fx + ox; pos[v * 3 + 1] = this.surf(fx, fy); pos[v * 3 + 2] = fy + oz;
      uvs[v * 2] = fx / 5; uvs[v * 2 + 1] = fy / 5;
    }
    // normalne z siatki, kolor i warstwy dwuliniowo z narożników planszy
    const hAt = (i: number, j: number): number => pos[(Math.max(0, Math.min(GY - 1, j)) * GX + Math.max(0, Math.min(GX - 1, i))) * 3 + 1]!;
    const n = new THREE.Vector3();
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const v = j * GX + i;
      n.set((hAt(i - 1, j) - hAt(i + 1, j)) * S / 2, 1, (hAt(i, j - 1) - hAt(i, j + 1)) * S / 2).normalize();
      nor[v * 3] = n.x; nor[v * 3 + 1] = n.y; nor[v * 3 + 2] = n.z;
      const fx = x0 + i / S, fy = y0 + j / S;
      const ix = Math.min(w - 1, Math.floor(fx)), iy = Math.min(h - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
      const v00 = this.vtx(ix, iy), v10 = this.vtx(ix + 1, iy), v01 = this.vtx(ix, iy + 1), v11 = this.vtx(ix + 1, iy + 1);
      const k00 = (1 - tx) * (1 - ty), k10 = tx * (1 - ty), k01 = (1 - tx) * ty, k11 = tx * ty;
      for (let c = 0; c < 3; c++) col[v * 3 + c] = cA[v00 * 3 + c]! * k00 + cA[v10 * 3 + c]! * k10 + cA[v01 * 3 + c]! * k01 + cA[v11 * 3 + c]! * k11;
      for (let c = 0; c < 4; c++) spl[v * 4 + c] = sA[v00 * 4 + c]! * k00 + sA[v10 * 4 + c]! * k10 + sA[v01 * 4 + c]! * k01 + sA[v11 * 4 + c]! * k11;
      snd[v] = dA[v00]! * k00 + dA[v10]! * k10 + dA[v01]! * k01 + dA[v11]! * k11;
    }
    // trójkąty łaty (bez pól skały), ta sama przekątna co na planszy
    let ii = 0;
    const idx = this.idx;
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
      if (this.src.rock(x0 + tx, y0 + ty)) continue;
      for (let sj = 0; sj < S; sj++) for (let si = 0; si < S; si++) {
        const a = (ty * S + sj) * GX + tx * S + si, b = a + 1, c = a + GX, d = c + 1;
        idx[ii++] = a; idx[ii++] = c; idx[ii++] = b;
        idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
      }
    }
    const g = this.mesh.geometry;
    for (const name of ['position', 'normal', 'color', 'uv', 'splat', 'sand']) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      a.clearUpdateRanges(); a.addUpdateRange(0, GX * GY * a.itemSize); a.needsUpdate = true;
    }
    g.index!.clearUpdateRanges(); g.index!.addUpdateRange(0, ii); g.index!.needsUpdate = true;
    g.setDrawRange(0, ii);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + nx / 2 + ox, 0, y0 + ny / 2 + oz), Math.hypot(nx, ny));
    this.mesh.visible = true;
    // plansza: pola pod łatą pomijamy (tylko gdy łata się przesunęła)
    if (moved) {
      const bi = this.baseIdx.array as Uint32Array;
      let k = 0;
      for (let ty = 0; ty < h; ty++) {
        const inY = ty >= y0 && ty < y0 + ny;
        for (let tx = 0; tx < w; tx++) {
          if (inY && tx >= x0 && tx < x0 + nx) continue;
          const o = (ty * w + tx) * 6;
          for (let q = 0; q < 6; q++) bi[k++] = o + q;
        }
      }
      this.baseIdx.clearUpdateRanges(); this.baseIdx.addUpdateRange(0, k); this.baseIdx.needsUpdate = true;
      geo.setDrawRange(0, k);
    }
  }
}

/** Wagi Catmulla–Roma dla czterech punktów (t w polu między drugim a trzecim) */
function cr(t: number): [number, number, number, number] {
  const t2 = t * t, t3 = t2 * t;
  return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2];
}

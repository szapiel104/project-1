import * as THREE from 'three';
import { TEST } from '../testmode';
import { createNoise2D } from 'simplex-noise';
import { rng } from './craft';
import { TERRAIN, Terrain } from '../data/terrain';
import type { GameMap } from '../sim/map';
import { hash2 } from '../sim/rng';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelFactory } from './models';
import { bump, pattern } from './textures';

const HEIGHT_SCALE = 0.03;
export const HAZE = 0xcfc9b4;

/** Wysokość pola w świecie 3D. Woda leży poniżej zera, góry wyrastają stromo. */
function tileHeight(map: GameMap, x: number, y: number, waterLevel: number): number {
  const cx = Math.min(map.width - 1, Math.max(0, x));
  const cy = Math.min(map.height - 1, Math.max(0, y));
  const e = map.elevation[cy * map.width + cx]!;
  const t = map.tiles[cy * map.width + cx] as Terrain;
  if (t === Terrain.Mountain) return 1.3 + (e - 170) * 0.15;
  const h = (e - waterLevel) * HEIGHT_SCALE;
  if (t === Terrain.Water) return Math.min(h, -0.25);
  // ląd w większości płaski: łagodne falowanie, a wyraźne pagórki tylko tam, gdzie teren jest naprawdę wysoko
  const d = e - waterLevel;
  return 0.12 + Math.max(0, d) * 0.004 + Math.max(0, d - 120) * HEIGHT_SCALE;
}

export interface TerrainView {
  group: THREE.Group;
  ground: THREE.Mesh;
  /** Wysokość terenu w dowolnym punkcie (współrzędne w polach, mogą być ułamkowe) */
  heightAt(x: number, y: number): number;
  /** Przechyla drzewa na polu podczas ścinania (0 = stoi, 1 = leży) */
  fell(tile: number, k: number): void;
  /** Usuwa drzewa z pola i zostawia pniaki */
  clear(tile: number): void;
  /** Odbudowuje nawierzchnię dróg z tablicy pól (0 brak, 1 piasek, 2 bruk) */
  setRoads(roads: Uint8Array, materials: THREE.Material[]): void;
  /** Animacje otoczenia: fale i ryby */
  animate(time: number): void;
  /** Mokro po deszczu: 0 sucho, 1 błoto i połyskujące drogi */
  setWet(k: number): void;
  dispose(): void;
}

/** Buduje widok mapy: podłoże, wodę, drzewa, skały i góry na horyzoncie. Tylko czyta stan. */
export function buildTerrain(map: GameMap, models: ModelFactory, waterLevel: number): TerrainView {
  const group = new THREE.Group();
  const { width: w, height: h } = map;
  const ox = -w / 2;
  const oz = -h / 2;

  // wysokości narożników = średnia z czterech sąsiednich pól
  const corners = new Float32Array((w + 1) * (h + 1));
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++)
      corners[y * (w + 1) + x] =
        (tileHeight(map, x - 1, y - 1, waterLevel) + tileHeight(map, x, y - 1, waterLevel) +
          tileHeight(map, x - 1, y, waterLevel) + tileHeight(map, x, y, waterLevel)) / 4;
  const corner = (x: number, y: number): number => corners[y * (w + 1) + x]!;

  // Kolor i normalna liczone w narożnikach i dzielone przez sąsiednie pola: teren przechodzi płynnie,
  // bez widocznej szachownicy. Kolor narożnika to średnia z czterech pól dookoła plus łagodne plamy.
  const snow = new THREE.Color(0xf2efe6);
  const tmp = new THREE.Color();
  const cornerCol = new Float32Array((w + 1) * (h + 1) * 3);
  const cornerNor = new Float32Array((w + 1) * (h + 1) * 3);
  const tileColor = (x: number, y: number): THREE.Color =>
    tmp.setHex(TERRAIN[map.tiles[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as Terrain].color);
  const nv = new THREE.Vector3();
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      let r = 0, g = 0, b = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) { const c = tileColor(x + dx, y + dy); r += c.r; g += c.g; b += c.b; }
      const patch = 0.9 + ((hash2(x >> 2, y >> 2, map.seed) & 63) / 63) * 0.12 + ((hash2(x, y, map.seed ^ 0x55) & 15) / 15) * 0.06;
      tmp.setRGB((r / 4) * patch, (g / 4) * patch, (b / 4) * patch);
      const hh = corner(x, y);
      if (hh > 3) {
        // skała: ciemniejsze i jaśniejsze warstwy, powyżej nierównej linii śniegu biało
        const strata = 0.82 + ((hash2(x >> 1, Math.round(hh * 2.2), map.seed ^ 0x99) & 31) / 31) * 0.3;
        tmp.setRGB(0.47 * strata, 0.45 * strata, 0.43 * strata);
        const line = 8.5 + ((hash2(x >> 2, y >> 2, map.seed ^ 0x4d) & 63) / 63) * 3;
        tmp.lerp(snow, Math.max(0, Math.min(1, (hh - line) / 1.6)));
      }
      const i = (y * (w + 1) + x) * 3;
      cornerCol[i] = tmp.r; cornerCol[i + 1] = tmp.g; cornerCol[i + 2] = tmp.b;
      nv.set(corner(Math.max(0, x - 1), y) - corner(Math.min(w, x + 1), y), 2, corner(x, Math.max(0, y - 1)) - corner(x, Math.min(h, y + 1))).normalize();
      cornerNor[i] = nv.x; cornerNor[i + 1] = nv.y; cornerNor[i + 2] = nv.z;
    }
  }
  const pos = new Float32Array(w * h * 18);
  const col = new Float32Array(w * h * 18);
  const nor = new Float32Array(w * h * 18);
  const uv = new Float32Array(w * h * 12);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const quad = [[x, y], [x, y + 1], [x + 1, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const;
      quad.forEach(([qx, qy], k) => {
        const ci = (qy * (w + 1) + qx) * 3, o = p + k * 3;
        pos[o] = qx + ox; pos[o + 1] = corner(qx, qy); pos[o + 2] = qy + oz;
        col[o] = cornerCol[ci]!; col[o + 1] = cornerCol[ci + 1]!; col[o + 2] = cornerCol[ci + 2]!;
        nor[o] = cornerNor[ci]!; nor[o + 1] = cornerNor[ci + 1]!; nor[o + 2] = cornerNor[ci + 2]!;
        // wzór trawy powtarza się co 5 pól, więc nie widać siatki
        uv[(o / 3) * 2] = qx / 5; uv[(o / 3) * 2 + 1] = qy / 5;
      });
      p += 18;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: pattern('grass'), bumpMap: bump('grass'), bumpScale: 0.7 }));
  ground.receiveShadow = true;
  ground.castShadow = true; // góry i pagórki też rzucają cień
  group.add(ground);

  // Woda: dwie warstwy drobnych fal przesuwające się w różne strony, lekko przejrzysta, z połyskiem słońca
  const ripples = bump('water')?.clone() ?? null;
  if (ripples) { ripples.repeat.set(w / 14, h / 14); ripples.needsUpdate = true; }
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2c6f8f, transparent: true, opacity: 0.86, roughness: 0.22, metalness: 0.3, bumpMap: ripples, bumpScale: 0.7,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, h), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.08;
  water.receiveShadow = true;
  group.add(water);
  // jaśniejsza płycizna przy brzegu: druga, niższa tafla o cieplejszej barwie prześwituje przez wodę
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x6fae9a, roughness: 1 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = -0.32;
  group.add(shallow);

  // Ryby: pływają po małych okręgach tuż pod powierzchnią, co jakiś czas któraś wyskakuje
  const waterTiles: number[] = [];
  for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === Terrain.Water) waterTiles.push(i);
  const fishCount = Math.min(90, Math.floor(waterTiles.length / 5));
  const fishGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(0.09, 1).scale(0.55, 0.75, 1.9),
    new THREE.ConeGeometry(0.07, 0.14, 4).toNonIndexed().rotateX(-Math.PI / 2).translate(0, 0, -0.2),
  ]);
  const fishMesh = fishCount && fishGeo ? new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4, flatShading: true }), fishCount) : null;
  const fish: { x: number; z: number; r: number; speed: number; phase: number }[] = [];
  if (fishMesh) {
    const fc = new THREE.Color();
    for (let i = 0; i < fishCount; i++) {
      const rr = hash2(i * 31, i * 17 + 5, map.seed ^ 0x1f123bb5);
      const tile = waterTiles[rr % waterTiles.length]!;
      fish.push({ x: (tile % w) + 0.5 + ox, z: Math.floor(tile / w) + 0.5 + oz, r: 0.25 + ((rr >>> 8) & 15) / 40, speed: 0.6 + ((rr >>> 12) & 15) / 20, phase: ((rr >>> 16) & 255) / 40 });
      fishMesh.setColorAt(i, fc.setHex((rr >>> 24) % 4 === 0 ? 0xe08a3c : 0xb9c9d4));
    }
    group.add(fishMesh);
  }
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fe = new THREE.Euler();
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3(1, 1, 1);
  const animate = (time: number): void => {
    if (ripples) ripples.offset.set(time * 0.006, time * 0.009);
    if (!fishMesh) return;
    fish.forEach((f, i) => {
      const a = time * f.speed + f.phase;
      // skok: przez krótki ułamek cyklu ryba wyskakuje łukiem nad wodę
      const cycle = (time * 0.11 + f.phase) % 1;
      const jump = cycle < 0.06 ? Math.sin((cycle / 0.06) * Math.PI) : 0;
      fp.set(f.x + Math.cos(a) * f.r, -0.16 + jump * 0.42, f.z + Math.sin(a) * f.r);
      fq.setFromEuler(fe.set(jump ? Math.cos((cycle / 0.06) * Math.PI) * -0.9 : 0, -a, 0, 'YXZ'));
      fishMesh.setMatrixAt(i, fm.compose(fp, fq, fs));
    });
    fishMesh.instanceMatrix.needsUpdate = true;
  };

  // Za mapą teren ciągnie się dalej tą samą siatką i teksturą: brzeg planszy przechodzi płynnie w puszczę.
  // Góry przy krawędzi opadają łagodnie na zewnątrz, woda się kończy, a dalej są niskie pagórki pod lasem.
  const D = TEST ? 6 : 56;
  const floorCol = new THREE.Color(0x46612a);
  const outerH = (X: number, Y: number): number => {
    if (X >= 0 && X <= w && Y >= 0 && Y <= h) return corner(X, Y);
    const cx = Math.max(0, Math.min(w, X)), cy = Math.max(0, Math.min(h, Y));
    const d = Math.max(Math.abs(X - cx), Math.abs(Y - cy));
    const base = Math.max(0.12, corner(cx, cy));
    const fade = Math.max(0, 1 - d / 9);
    const hills = (Math.sin(X * 0.19 + map.seed) + Math.cos(Y * 0.23 - map.seed) + 2) * 0.25 * Math.min(1, d / 5);
    return 0.12 + (base - 0.12) * fade * fade * (3 - 2 * fade) + hills;
  };
  {
    const W2 = w + 2 * D, H2 = h + 2 * D;
    const hs = new Float32Array((W2 + 1) * (H2 + 1));
    const cs = new Float32Array((W2 + 1) * (H2 + 1) * 3);
    const c3 = new THREE.Color();
    for (let j = 0; j <= H2; j++)
      for (let i = 0; i <= W2; i++) {
        const X = i - D, Y = j - D;
        const k = j * (W2 + 1) + i;
        hs[k] = outerH(X, Y);
        const cx = Math.max(0, Math.min(w, X)), cy = Math.max(0, Math.min(h, Y));
        const d = Math.max(Math.abs(X - cx), Math.abs(Y - cy));
        const ci = (cy * (w + 1) + cx) * 3;
        c3.setRGB(cornerCol[ci]!, cornerCol[ci + 1]!, cornerCol[ci + 2]!);
        if (corner(cx, cy) < 0) c3.copy(floorCol); // za jeziorem przy brzegu od razu ląd
        const patch = 0.92 + ((hash2(X >> 2, Y >> 2, map.seed) & 63) / 63) * 0.12;
        c3.lerp(tmp.copy(floorCol).multiplyScalar(patch), Math.min(1, d / 10));
        cs[k * 3] = c3.r; cs[k * 3 + 1] = c3.g; cs[k * 3 + 2] = c3.b;
      }
    const hAt = (i: number, j: number): number => hs[Math.max(0, Math.min(H2, j)) * (W2 + 1) + Math.max(0, Math.min(W2, i))]!;
    const P: number[] = [], C: number[] = [], N: number[] = [], U: number[] = [];
    const nv2 = new THREE.Vector3();
    for (let j = 0; j < H2; j++)
      for (let i = 0; i < W2; i++) {
        const X = i - D, Y = j - D;
        if (X >= 0 && X < w && Y >= 0 && Y < h) continue; // plansza ma własną siatkę
        for (const [qi, qj] of [[i, j], [i, j + 1], [i + 1, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]] as const) {
          const X2 = qi - D, Y2 = qj - D;
          const inside = X2 >= 0 && X2 <= w && Y2 >= 0 && Y2 <= h;
          const k = qj * (W2 + 1) + qi;
          P.push(X2 + ox, hs[k]!, Y2 + oz);
          if (inside) {
            const ci = (Y2 * (w + 1) + X2) * 3;
            C.push(cornerCol[ci]!, cornerCol[ci + 1]!, cornerCol[ci + 2]!);
            N.push(cornerNor[ci]!, cornerNor[ci + 1]!, cornerNor[ci + 2]!);
          } else {
            C.push(cs[k * 3]!, cs[k * 3 + 1]!, cs[k * 3 + 2]!);
            nv2.set(hAt(qi - 1, qj) - hAt(qi + 1, qj), 2, hAt(qi, qj - 1) - hAt(qi, qj + 1)).normalize();
            N.push(nv2.x, nv2.y, nv2.z);
          }
          U.push(X2 / 5, Y2 / 5);
        }
      }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    og.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    og.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    og.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    const outer = new THREE.Mesh(og, ground.material);
    outer.receiveShadow = true;
    outer.castShadow = true;
    group.add(outer);
    // daleko za lasem płaska ciemna równina, którą i tak zakrywa mgła
    const far = new THREE.Mesh(new THREE.PlaneGeometry(W2 + 600, H2 + 600), new THREE.MeshStandardMaterial({ color: 0x2c3a1c, roughness: 1 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.2;
    group.add(far);
  }

  const yAxis = new THREE.Vector3(0, 1, 0);
  const heightAt = (fx: number, fy: number): number => {
    const x = Math.max(0, Math.min(w - 1.001, fx)), y = Math.max(0, Math.min(h - 1.001, fy));
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    const top = corner(ix, iy) * (1 - tx) + corner(ix + 1, iy) * tx;
    const bot = corner(ix, iy + 1) * (1 - tx) + corner(ix + 1, iy + 1) * tx;
    return top * (1 - ty) + bot * ty;
  };

  // obiekty na polach: jedna siatka instancjonowana na rodzaj
  type Item = { m: THREE.Matrix4; shade: number; tile: number; pos: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
  const pines: Item[] = [], leafy: Item[] = [], rocks: Item[] = [], ores: Item[] = [], tufts: Item[] = [];
  const bushes: Item[] = [], pebbles: Item[] = [], flowers: Item[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const put = (list: Item[], x: number, y: number, n: number, scaleBase: number, spread = 0.7): void => {
    const r = hash2(x * 7 + n, y * 13 - n, map.seed ^ 0xabcdef);
    const jx = ((r & 255) / 255 - 0.5) * spread;
    const jz = (((r >>> 8) & 255) / 255 - 0.5) * spread;
    const s = scaleBase * (0.75 + (((r >>> 16) & 255) / 255) * 0.6);
    q.setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI * 2);
    const pos = new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x + 0.5 + jx, y + 0.5 + jz), y + 0.5 + jz + oz);
    // drzewa w prawdziwej skali względem ludzi: wyraźnie wyższe od chłopa (korona nad głową), trochę szersze
    const tree = list === pines || list === leafy;
    const scale = tree ? new THREE.Vector3(s * 1.25, s * 1.6 * (0.9 + ((r >>> 12) & 15) / 60), s * 1.25) : new THREE.Vector3(s, s * (0.9 + ((r >>> 12) & 15) / 60), s);
    m.compose(pos, q, scale);
    list.push({ m: m.clone(), shade: 0.8 + (((r >>> 20) & 15) / 15) * 0.4, tile: y * w + x, pos, q: q.clone(), s: scale });
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y * w + x] as Terrain;
      const r = hash2(x, y, map.seed);
      if (t === Terrain.Forest) {
        // las mieszany o różnym wieku: większość zwykłych drzew, sporo młodych, czasem stary olbrzym
        const age = (r >>> 11) % 20;
        const size = age === 0 ? 2.1 : age < 3 ? 1.5 : age < 8 ? 0.6 : 1;
        put((r >>> 3) % 4 === 0 ? leafy : pines, x, y, 0, size, age === 0 ? 0.2 : 0.7);
        if ((r & 1) && age !== 0) put((r >>> 5) % 4 === 0 ? leafy : pines, x, y, 1, age < 8 ? 0.5 : 0.8);
        if ((r >>> 17) % 5 === 0) put(bushes, x, y, 4, 0.8, 0.9);
      } else if (t === Terrain.Stone) { put(rocks, x, y, 0, 1.1); if ((r >>> 6) & 1) put(pebbles, x, y, 5, 0.5, 0.9); }
      else if (t === Terrain.Iron) put(ores, x, y, 0, 1);
      else if (t === Terrain.Grass) {
        // łąka: gęste kępy trawy, kwiaty, pojedyncze krzewy, kamyki i z rzadka większy głaz
        if ((r >>> 7) % 2 === 0) { put(tufts, x, y, 2, 1, 0.9); if ((r >>> 9) & 1) put(tufts, x, y, 3, 0.8, 0.9); if ((r >>> 10) & 1) put(tufts, x, y, 6, 1.2, 0.9); }
        if ((r >>> 13) % 9 === 0) { put(flowers, x, y, 7, 1, 0.9); put(flowers, x, y, 8, 0.9, 0.9); if ((r >>> 4) & 1) put(flowers, x, y, 9, 1.1, 0.9); }
        if ((r >>> 16) % 23 === 0) put(bushes, x, y, 4, 0.9 + ((r >>> 20) & 7) / 14, 0.6);
        if ((r >>> 19) % 31 === 0) put(pebbles, x, y, 5, 0.35 + ((r >>> 24) & 7) / 20, 0.8);
        if ((r >>> 21) % 173 === 0) put(pebbles, x, y, 10, 1.5, 0.4);
      }
    }
  }
  const tint = new THREE.Color();
  /**
   * Roślinność i kamienie w kawałkach 40×40 pól: każdy kawałek to osobna siatka z własną sferą ograniczającą,
   * więc karta graficzna pomija to, czego nie widać (także w cieniach). Na dużych mapach to kilkukrotnie mniej trójkątów.
   * Na zewnątrz zachowuje się jak jedna siatka instancji (indeksy jak w liście).
   */
  type Inst = { setMatrixAt(i: number, m: THREE.Matrix4): void; setColorAt(i: number, c: THREE.Color): void; instanceMatrix: { needsUpdate: boolean } };
  const CHUNK = 40;
  const instanced = (g: THREE.BufferGeometry, color: number, list: Item[], tex?: Parameters<typeof pattern>[0], shadow = true): Inst | null => {
    if (!list.length) return null;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: 1.2 });
    const buckets = new Map<number, number[]>();
    list.forEach((it, i) => {
      const k = Math.floor((it.pos.x + 512) / CHUNK) * 4096 + Math.floor((it.pos.z + 512) / CHUNK);
      let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); } b.push(i);
    });
    const where: [THREE.InstancedMesh, number][] = new Array(list.length);
    const dirty = new Set<THREE.InstancedMesh>();
    for (const idx of buckets.values()) {
      const mesh = new THREE.InstancedMesh(g, mat, idx.length);
      idx.forEach((i, j) => { const it = list[i]!; mesh.setMatrixAt(j, it.m); mesh.setColorAt(j, tint.setHex(color).multiplyScalar(it.shade)); where[i] = [mesh, j]; });
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 3; // zapas na ścinane, przechylające się drzewa
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    const flag = { get needsUpdate() { return dirty.size > 0; }, set needsUpdate(v: boolean) { if (v) { for (const m of dirty) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } dirty.clear(); } } };
    return {
      setMatrixAt(i, m) { const w = where[i]; if (w) { w[0].setMatrixAt(w[1], m); dirty.add(w[0]); } },
      setColorAt(i, c) { const w = where[i]; if (w) { w[0].setColorAt(w[1], c); dirty.add(w[0]); flag.needsUpdate = true; } },
      instanceMatrix: flag,
    };
  };
  // drzewa zapamiętujemy według pola, żeby drwal mógł je ściąć
  const trees = new Map<number, { meshes: Inst[]; index: number; item: Item }[]>();
  const stumpItems: Item[] = [];
  const stumpOf = new Map<Item, number>();
  const plant = (list: Item[], trunk: Inst | null, crown: Inst | null, stump = true): void => {
    list.forEach((item, index) => {
      const here = trees.get(item.tile) ?? [];
      here.push({ meshes: [trunk, crown].filter((x): x is Inst => !!x), index, item });
      trees.set(item.tile, here);
      if (stump) { stumpOf.set(item, stumpItems.length); stumpItems.push(item); }
    });
  };
  plant(pines, instanced(models.treeTrunk(), 0x6b4a2e, pines, 'bark'), instanced(models.treeCrown(), 0x3c7a3a, pines, 'needles'));
  plant(leafy, instanced(models.leafTrunk(), 0x7a5a3a, leafy, 'bark'), instanced(models.leafCrown(), 0x6fa33d, leafy, 'leaves'));
  // Puszcza za krawędzią mapy: nikt tam nie dojdzie ani nie zetnie drzew (to tylko tło).
  // Im dalej, tym drzewa większe i ciemniejsze, a resztę gasi mgła.
  {
    const near: { pine: Item[]; leaf: Item[] } = { pine: [], leaf: [] };
    const far: { pine: Item[]; leaf: Item[] } = { pine: [], leaf: [] };
    const step = D > 40 ? 1.7 : 2.2;
    const e3 = new THREE.Euler();
    for (let gz = -h / 2 - D; gz < h / 2 + D; gz += step)
      for (let gx = -w / 2 - D; gx < w / 2 + D; gx += step) {
        const r = hash2(Math.round(gx * 10), Math.round(gz * 10), map.seed ^ 0x7f4a7c15);
        const px = gx + ((r & 255) / 255 - 0.5) * step * 0.9;
        const pz = gz + (((r >>> 8) & 255) / 255 - 0.5) * step * 0.9;
        const dist = Math.max(Math.abs(px) - w / 2, Math.abs(pz) - h / 2);
        if (dist < 0.9) continue;
        const groundY = outerH(Math.round(px - ox), Math.round(pz - oz));
        if (groundY > 2.2) continue; // na zboczach gór za mapą bez drzew
        const k = Math.min(1, dist / D);
        const size = (1.25 + k * 1.6) * (0.8 + ((r >>> 16) & 255) / 255 * 0.5);
        const leafTree = (r >>> 24) % 4 === 0;
        const pos = new THREE.Vector3(px, groundY - 0.05, pz);
        const qq = new THREE.Quaternion().setFromEuler(e3.set(0, ((r >>> 4) & 63) / 10, 0));
        const sc = new THREE.Vector3(size * 1.25, size * 1.6 * (leafTree ? 1 : 1.15), size * 1.25);
        const item = { m: new THREE.Matrix4().compose(pos, qq, sc), shade: (1 - k * 0.7) * (0.82 + ((r >>> 12) & 15) / 60), tile: -1, pos, q: qq, s: sc } as Item;
        const bucket = dist < 9 ? near : far;
        (leafTree ? bucket.leaf : bucket.pine).push(item);
      }
    instanced(models.treeTrunk(), 0x6b4a2e, near.pine, 'bark');
    instanced(models.treeCrown(), 0x3c7a3a, near.pine, 'needles');
    instanced(models.leafTrunk(), 0x7a5a3a, near.leaf, 'bark');
    instanced(models.leafCrown(), 0x5f9a38, near.leaf, 'leaves');
    instanced(models.treeTrunk(), 0x5a3e26, far.pine, undefined, false);
    instanced(models.treeCrown(), 0x35703a, far.pine, 'needles', false);
    instanced(models.leafTrunk(), 0x5a3e26, far.leaf, undefined, false);
    instanced(models.leafCrown(), 0x55903a, far.leaf, 'leaves', false);
  }
  // drobna roślinność i kamienie też są przypisane do pól, żeby znikały pod budynkami i drogami
  plant(bushes, instanced(models.bush(), 0x4f8a36, bushes, 'leaves'), null, false);
  plant(pebbles, instanced(models.rock(), 0xb8b3a6, pebbles, 'rock'), null, false);
  plant(tufts, instanced(models.tuft(), 0x7fae45, tufts, undefined, false), null, false);
  {
    const mesh = instanced(models.flower(), 0xffffff, flowers, undefined, false);
    const palette = [0xf4f1e6, 0xf2d24a, 0xb07ad6, 0xe8687a, 0x7fb2e6];
    if (mesh) { flowers.forEach((it, i) => mesh.setColorAt(i, tint.setHex(palette[(it.tile * 7 + i) % palette.length]!))); mesh.instanceMatrix.needsUpdate = true; }
    plant(flowers, mesh, null, false);
  }
  // skały i rudy też znikają, gdy złoże się wyczerpie (bez pniaka)
  plant(rocks, instanced(models.rock(), 0xc4bfb1, rocks, 'rock'), null, false);
  plant(ores, instanced(models.rock(), 0xa05a36, ores, 'rock'), null, false);
  const stumps = instanced(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 7).translate(0, 0.07, 0), 0x8a6a45, stumpItems, 'bark', false);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  if (stumps) { stumpItems.forEach((_, i) => stumps.setMatrixAt(i, zero)); stumps.instanceMatrix.needsUpdate = true; }
  const tilt = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const fell = (tile: number, k: number): void => {
    for (const t of trees.get(tile) ?? []) {
      tilt.copy(t.item.q).multiply(q.setFromAxisAngle(xAxis, Math.min(1, k) * 1.45));
      m.compose(t.item.pos, tilt, t.item.s);
      for (const mesh of t.meshes) { mesh.setMatrixAt(t.index, m); mesh.instanceMatrix.needsUpdate = true; }
    }
  };
  const clear = (tile: number): void => {
    for (const t of trees.get(tile) ?? []) {
      for (const mesh of t.meshes) { mesh.setMatrixAt(t.index, zero); mesh.instanceMatrix.needsUpdate = true; }
      const si = stumpOf.get(t.item);
      if (stumps && si !== undefined) { stumps.setMatrixAt(si, m.compose(t.item.pos, t.item.q, t.item.s)); stumps.instanceMatrix.needsUpdate = true; }
    }
    trees.delete(tile);
  };


  // Drogi. Kamienna to równe pola bruku. Piaskowa to wydeptana ścieżka: każde pole dostaje miękką,
  // nieregularną plamę większą od pola, a sąsiednie plamy zlewają się w jeden trakt o poszarpanych brzegach.
  const roadMeshes: THREE.Mesh[] = [];
  // Rów: płytki, wykopany szpadlem pas wilgotnej ziemi przy bruku. Od strony trawy krawędź jest nierówna
  // (kolejne wbicia szpadla, grudki, zwisające źdźbła) i przechodzi w przezroczystość, więc rów nie wygląda jak listwa.
  /** Rowy wzdłuż bruku wyłączone (Michał: „wywal z drogi te rowy”) */
  const SHOW_DITCH = false as boolean;
  let ditchMat: THREE.MeshStandardMaterial | null = null;
  const ditchMaterial = (): THREE.MeshStandardMaterial => {
    if (ditchMat) return ditchMat;
    const W = 1024, H = 256;
    const rnd = (i: number, salt: number): number => (hash2(i, salt, 0x5eed) & 0xffff) / 0xffff;
    // linia krawędzi od strony trawy: odcinki po jednym wbiciu szpadla, każdy lekko pochylony i na innej głębokości
    const edge = new Float32Array(W);
    {
      let x = 0, k = 0;
      const cuts: { x0: number; len: number; a: number; b: number }[] = [];
      while (x < W) { const len = 52 + rnd(k, 1) * 60; cuts.push({ x0: x, len, a: 0.6 + rnd(k, 2) * 0.22, b: 0.6 + rnd(k, 3) * 0.22 }); x += len; k++; }
      const last = cuts[cuts.length - 1]!; last.b = cuts[0]!.a; // zawija się bez skoku
      for (const c of cuts) for (let i = 0; i < c.len && c.x0 + i < W; i++) {
        const t = i / c.len;
        edge[Math.floor(c.x0 + i)] = c.a + (c.b - c.a) * t + Math.sin(t * Math.PI) * 0.03 + (rnd(c.x0 + i, 4) - 0.5) * 0.025;
      }
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = y / (H - 1), e = edge[x]!;
        const i = (y * W + x) * 4;
        if (v > e + 0.04) { img.data[i + 3] = 0; continue; }
        // głębia: najciemniej w jednej trzeciej szerokości, jaśniej przy bruku i przy skarpie od trawy
        const depth = Math.sin(Math.min(1, v / e) * Math.PI);
        const damp = Math.max(0, 1 - Math.abs(v / e - 0.38) * 3.2);
        const n = (rnd(x * 131 + y, 5) - 0.5) * 18;
        let r = 128 - depth * 34 - damp * 16 + n, g = 102 - depth * 30 - damp * 14 + n * 0.85, b = 72 - depth * 24 - damp * 10 + n * 0.7;
        if (v < 0.07) { r *= 0.78; g *= 0.78; b *= 0.78; } // cień pod krawędzią kostki
        if (v > e - 0.06) { const k = (v - (e - 0.06)) / 0.06; r += 22 * k; g += 18 * k; b += 12 * k; } // świeżo odcięta skarpa
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
        img.data[i + 3] = v > e ? Math.round(255 * (1 - (v - e) / 0.04)) : 255;
      }
    c.putImageData(img, 0, 0);
    // grudki ziemi i kamyczki na dnie, rysowane też przy krawędziach tekstury, żeby się zawijały
    const dot = (x: number, y: number, rx: number, ry: number, fill: string): void => {
      for (const ox of [0, W, -W]) { c.fillStyle = fill; c.beginPath(); c.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
    };
    for (let k = 0; k < 120; k++) {
      const x = rnd(k, 6) * W, e = edge[Math.floor(x)]!, y = (0.1 + rnd(k, 7) * (e - 0.15)) * H;
      const rr = 3 + rnd(k, 8) * 7;
      dot(x, y + rr * 0.4, rr, rr * 0.7, 'rgba(40,28,16,0.45)');
      dot(x, y, rr, rr * 0.7, rnd(k, 9) < 0.3 ? 'rgb(150,146,136)' : 'rgb(124,98,66)');
      dot(x - rr * 0.3, y - rr * 0.25, rr * 0.4, rr * 0.3, 'rgba(255,240,210,0.35)');
    }
    // źdźbła trawy zwisające z krawędzi do rowu
    c.lineCap = 'round';
    for (let k = 0; k < 160; k++) {
      const x = rnd(k, 10) * W, y = edge[Math.floor(x)]! * H;
      const len = 8 + rnd(k, 11) * 18, lean = (rnd(k, 12) - 0.5) * 16;
      for (const ox of [0, W, -W]) {
        c.strokeStyle = rnd(k, 13) < 0.5 ? 'rgb(96,140,48)' : 'rgb(120,162,60)';
        c.lineWidth = 2.2 + rnd(k, 14) * 1.6;
        c.beginPath(); c.moveTo(x + ox, y + 2); c.quadraticCurveTo(x + ox + lean * 0.3, y - len * 0.6, x + ox + lean, y - len); c.stroke();
      }
    }
    const color = new THREE.CanvasTexture(cv);
    color.wrapS = THREE.RepeatWrapping;
    color.colorSpace = THREE.SRGBColorSpace;
    color.anisotropy = 16;
    ditchMat = new THREE.MeshStandardMaterial({ map: color, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3 });
    return ditchMat;
  };
  const pathNoise = createNoise2D(rng(map.seed ^ 0x51a7));
  let sandMat: THREE.MeshStandardMaterial | null = null;
  const sandMaterial = (): THREE.MeshStandardMaterial => {
    if (!sandMat) sandMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, map: pattern('soil'), bumpMap: bump('soil'), bumpScale: 1.2, polygonOffset: true, polygonOffsetFactor: -3 });
    return sandMat;
  };
  // Bruk też nie ma równych brzegów: maska o poszarpanej krawędzi wycina go tak, że kamienie
  // nierówno wchodzą w trawę, a każde pole ma trochę inny odcień (jaśniejsze, ciemniejsze, omszałe).
  let paveMat: THREE.MeshStandardMaterial | null = null;
  const paveMaterial = (base: THREE.Material): THREE.MeshStandardMaterial => {
    if (paveMat) return paveMat;
    const n = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const c2 = cv.getContext('2d')!;
    const img = c2.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = Math.abs(x / n - 0.5) * 2, dy = Math.abs(y / n - 0.5) * 2;
        // kształt zbliżony do kwadratu z zaokrąglonymi rogami, brzeg wyszczerbiony na wielkość pojedynczych kamieni
        const d = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
        const lump = ((hash2(x >> 4, y >> 4, 311) & 255) / 255 - 0.5) * 0.22 + ((hash2(x >> 2, y >> 2, 419) & 255) / 255 - 0.5) * 0.08;
        const v = d + lump < 0.86 ? 255 : 0;
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    c2.putImageData(img, 0, 0);
    const mask = new THREE.CanvasTexture(cv);
    mask.channel = 1; // maska używa drugiego zestawu współrzędnych: 0..1 na każdym polu
    paveMat = (base as THREE.MeshStandardMaterial).clone();
    paveMat.vertexColors = true;
    paveMat.polygonOffset = true;
    paveMat.polygonOffsetFactor = -2;
    return paveMat;
  };
  const setRoads = (roads: Uint8Array, materials: THREE.Material[]): void => {
    for (const old of roadMeshes) { group.remove(old); old.geometry.dispose(); }
    roadMeshes.length = 0;
    const shade = new THREE.Color();
    for (let kind = 1; kind <= materials.length; kind++) {
      const p3: number[] = [], uv2: number[] = [], uvMask: number[] = [], col3: number[] = [], ditch: number[] = [], ditchUv: number[] = [];
      const soft = kind === 1;
      // bruk kryje dokładnie swoje pole, żeby kostka równo dochodziła do rowu; piaskowa ścieżka rozlewa się poza pole
      const grow = soft ? 0.42 : 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (roads[y * w + x] !== kind) continue;
          clear(y * w + x); // na drodze nie rośnie trawa ani krzewy
          if (soft) continue; // ścieżka gruntowa powstaje niżej jako jedna ciągła powierzchnia
          // lekkie przesunięcie każdego płata, żeby droga nie szła jak po linijce
          const r = hash2(x, y, map.seed ^ 0x77);
          const jx = soft ? ((r & 15) / 15 - 0.5) * 0.22 : 0, jy = soft ? (((r >>> 4) & 15) / 15 - 0.5) * 0.22 : 0;
          const x0 = x - grow + jx, x1 = x + 1 + grow + jx, y0 = y - grow + jy, y1 = y + 1 + grow + jy;
          // odcień pola: większość szara, część jaśniejsza albo ciemniejsza, niektóre zielonkawe od mchu
          const tone = 0.9 + (((r >>> 8) & 31) / 31) * 0.16;
          const moss = (r >>> 14) % 5 === 0 ? 0.12 : 0;
          shade.setRGB(tone * (1 - moss), tone * (1 + moss * 0.3), tone * (1 - moss * 1.4));
          for (const [qx, qy, u, v] of [[x0, y0, 0, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y1, 1, 1]] as const) {
            p3.push(qx + ox, heightAt(qx, qy) + (soft ? 0.03 : 0.045), qy + oz);
            if (soft) uv2.push(u, v);
            else { uv2.push(qx / 2.5, qy / 2.5); uvMask.push(u, v); col3.push(shade.r, shade.g, shade.b); }
          }
        }
      // Rów liczony od strony trawy: każde pole bez bruku dostaje pas wzdłuż boków, którymi dotyka bruku.
      // Gdy bruk jest z dwóch stron (wewnętrzny róg), pasy schodzą się na ukos; przy zewnętrznym rogu bruku
      // rów zakręca łukiem. Dzięki temu nic się nie nakłada nawet wokół pojedynczego pola trawy.
      if (!soft && SHOW_DITCH) {
        const pave = (nx: number, ny: number): boolean => nx >= 0 && ny >= 0 && nx < w && ny < h && roads[ny * w + nx] === kind;
        const D = 0.24;
        const put = (qx: number, qy: number, u: number, v: number): void => { ditch.push(qx + ox, heightAt(qx, qy) + 0.035, qy + oz); ditchUv.push(u, v); };
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (pave(x, y)) continue;
            const L = pave(x - 1, y), R = pave(x + 1, y), T = pave(x, y - 1), B = pave(x, y + 1);
            if (L || R || T || B) {
              const y0 = y + (T ? D : 0), y1 = y + 1 - (B ? D : 0), x0 = x + (L ? D : 0), x1 = x + 1 - (R ? D : 0);
              // pas pionowy (przy lewym albo prawym boku): v rośnie od bruku w stronę trawy
              const vert = (edgeX: number, inX: number): void => {
                for (const [qx, qy] of [[edgeX, y0], [inX, y0], [edgeX, y1], [edgeX, y1], [inX, y0], [inX, y1]] as const) put(qx, qy, qy / 2, Math.abs(qx - edgeX) / D);
              };
              const horiz = (edgeY: number, inY: number): void => {
                for (const [qx, qy] of [[x0, edgeY], [x0, inY], [x1, edgeY], [x1, edgeY], [x0, inY], [x1, inY]] as const) put(qx, qy, qx / 2, Math.abs(qy - edgeY) / D);
              };
              if (L) vert(x, x + D);
              if (R) vert(x + 1, x + 1 - D);
              if (T) horiz(y, y + D);
              if (B) horiz(y + 1, y + 1 - D);
              // wewnętrzne rogi: kwadrat D×D dzielony po przekątnej, każda połowa należy do swojego pasa
              for (const [sx, sy, on] of [[-1, -1, L && T], [1, -1, R && T], [-1, 1, L && B], [1, 1, R && B]] as const) {
                if (!on) continue;
                const cx = sx < 0 ? x : x + 1, cy = sy < 0 ? y : y + 1;
                const ix = cx - sx * D, iy = cy - sy * D;
                put(cx, cy, cy / 2, 0); put(cx, iy, iy / 2, 0); put(ix, iy, iy / 2, 1);
                put(cx, cy, cx / 2, 0); put(ix, cy, ix / 2, 0); put(ix, iy, ix / 2, 1);
              }
            }
            // zewnętrzne rogi bruku: bruk tylko po skosie, rów skręca ćwiartką koła wokół rogu
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
              if (!pave(x + sx, y + sy) || pave(x + sx, y) || pave(x, y + sy)) continue;
              const px = sx < 0 ? x : x + 1, py = sy < 0 ? y : y + 1;
              const seg = 6;
              for (let k = 0; k < seg; k++) {
                const a0 = (k / seg) * Math.PI / 2, a1 = ((k + 1) / seg) * Math.PI / 2;
                const u0 = (py + a0 * D) / 2, u1 = (py + a1 * D) / 2;
                put(px, py, (u0 + u1) / 2, 0);
                put(px - Math.cos(a0) * D * sx, py - Math.sin(a0) * D * sy, u0, 1);
                put(px - Math.cos(a1) * D * sx, py - Math.sin(a1) * D * sy, u1, 1);
              }
            }
          }
      }
      // Ścieżka gruntowa: jedna ciągła powierzchnia na drobnej siatce (4×4 na pole). Przezroczystość liczona
      // z odległości do najbliższego pola drogi plus płynny szum, więc brzeg jest miękki i nieregularny,
      // bez placków z nakładających się kół i bez schodków.
      const sand: number[] = [];
      if (soft) {
        const isRoad = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && roads[y * w + x] === 1;
        const edge = (fx: number, fy: number): number => {
          // odległość od punktu do najbliższego pola drogi (0 w środku pola)
          let best = 9;
          const cx = Math.floor(fx), cy = Math.floor(fy);
          for (let yy = cy - 1; yy <= cy + 1; yy++)
            for (let xx = cx - 1; xx <= cx + 1; xx++) {
              if (!isRoad(xx, yy)) continue;
              const dx = Math.max(xx - fx, 0, fx - (xx + 1)), dy = Math.max(yy - fy, 0, fy - (yy + 1));
              best = Math.min(best, Math.hypot(dx, dy));
            }
          return best;
        };
        const S = 4, done = new Set<number>();
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (!isRoad(x, y)) continue;
            for (let yy = y - 1; yy <= y + 1; yy++)
              for (let xx = x - 1; xx <= x + 1; xx++) {
                if (xx < 0 || yy < 0 || xx >= w || yy >= h || done.has(yy * w + xx)) continue;
                done.add(yy * w + xx);
                for (let sy = 0; sy < S; sy++)
                  for (let sx = 0; sx < S; sx++) {
                    const ax = xx + sx / S, ay = yy + sy / S, bx = ax + 1 / S, by = ay + 1 / S;
                    const pts = [[ax, ay], [ax, by], [bx, ay], [bx, ay], [ax, by], [bx, by]] as const;
                    const alpha = pts.map(([px, py]) => {
                      const wob = (pathNoise(px * 0.9, py * 0.9) * 0.22 + pathNoise(px * 3.1, py * 3.1) * 0.08);
                      return Math.max(0, Math.min(1, (0.32 + wob - edge(px, py)) / 0.3));
                    });
                    if (alpha.every((a) => a <= 0)) continue;
                    pts.forEach(([px, py], k) => {
                      p3.push(px + ox, heightAt(px, py) + 0.03, py + oz);
                      uv2.push(px / 2, py / 2);
                      // środek ścieżki jaśniejszy i ubity, brzegi ciemniejsze, wilgotniejsze
                      const a = alpha[k]!;
                      const t = 0.78 + a * 0.22 + pathNoise(px * 6, py * 6) * 0.05;
                      sand.push(0.82 * t, 0.68 * t, 0.46 * t, a);
                    });
                  }
              }
          }
      }
      if (!p3.length) continue;
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(p3, 3));
      g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
      if (soft) g2.setAttribute('color', new THREE.Float32BufferAttribute(sand, 4));
      if (!soft) {
        g2.setAttribute('uv1', new THREE.Float32BufferAttribute(uvMask, 2));
        g2.setAttribute('color', new THREE.Float32BufferAttribute(col3, 3));
      }
      g2.computeVertexNormals();
      const mesh = new THREE.Mesh(g2, soft ? sandMaterial() : paveMaterial(materials[kind - 1]!));
      mesh.receiveShadow = true;
      mesh.renderOrder = soft ? 1 : 0;
      group.add(mesh);
      roadMeshes.push(mesh);
      if (ditch.length) {
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.Float32BufferAttribute(ditch, 3));
        dg.setAttribute('uv', new THREE.Float32BufferAttribute(ditchUv, 2));
        // rów leży płasko na terenie: normalne w górę, a trójkąty widoczne z obu stron niezależnie od kolejności wierzchołków
        dg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(ditch.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        const dm = new THREE.Mesh(dg, ditchMaterial());
        dm.receiveShadow = true;
        group.add(dm);
        roadMeshes.push(dm);
      }
    }
  };

  return {
    group,
    ground,
    setRoads,
    heightAt,
    fell,
    clear,
    animate,
    setWet(k: number) {
      // błoto: ciemniejsza, błyszcząca ziemia na ścieżkach, mokry połysk bruku, trochę ciemniejsza trawa
      const dryC = new THREE.Color(0xffffff);
      if (sandMat) { sandMat.color.copy(dryC).lerp(new THREE.Color(0x3e2c1c), k * 0.85); sandMat.roughness = 1 - k * 0.7; }
      if (paveMat) { paveMat.roughness = 0.9 - k * 0.5; paveMat.color.copy(dryC).lerp(new THREE.Color(0x8a8478), k * 0.4); }
      const gm = ground.material as THREE.MeshStandardMaterial;
      gm.color.copy(dryC).lerp(new THREE.Color(0x8a917c), k * 0.6);
    },
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
}

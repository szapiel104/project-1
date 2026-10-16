import * as THREE from 'three';
import { TEST } from '../testmode';
import { cat } from './cat';

/** Daleki obrazek drzewa liściastego: jesienią rudzieje, zimą szarzeje (bez zwijania korony — obrazek ma pień) */
const leafFar = <M extends THREE.Material>(m: M): M => { m.userData.season = 'leafFar'; return m; };
import { createNoise2D } from 'simplex-noise';
import { treeImpostor } from './impostors';
import { rng } from './craft';
import { TERRAIN, Terrain } from '../data/terrain';
import type { GameMap } from '../sim/map';
import { hash2 } from '../sim/rng';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModelFactory } from './models';
import { bump, normal, pattern } from './textures';
import { groundGrassTexture, groundMaterial, waterMaterial } from './ground';
import { SHADOW_LAYER, shadowProxyMaterial } from './shadowlayer';
import { bladeTexture, createGrassField, type GrassField } from './grass';

const HEIGHT_SCALE = 0.03;
const smoothstep = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
  /** Spacer: czy punkt (pola, ułamkowo) jest bliżej niż r od pnia drzewa (ścięte już nie przeszkadzają) */
  trunkNear(x: number, y: number, r: number): boolean;
  /** Odbudowuje nawierzchnię dróg z tablicy pól (0 brak, 1 piasek, 2 bruk) */
  setRoads(roads: Uint8Array, materials: THREE.Material[]): void;
  /** Animacje otoczenia: fale i ryby */
  animate(time: number): void;
  /** Mokro po deszczu: 0 sucho, 1 błoto i połyskujące drogi */
  setWet(k: number): void;
  /** Gęsta trawa nad punktem (x, z) świata */
  updateGrass(x: number, z: number, time: number, camDist?: number): void;
  /** Zasięg gęstej trawy (automatyczna jakość) */
  grassReach(f: number): void;
  /** Pole zabudowane: bez trawy */
  noGrass(tile: number, on?: boolean): void;
  /** Kolor nieba odbijany przez wodę */
  setSky(c: THREE.Color): void;
  /** Kierunek ku słońcu (świat) i jego barwa: odblaski na wodzie; golden = złota godzina (0..1) */
  setSun(dir: THREE.Vector3, color: THREE.Color, golden: number): void;
  /** Wykop pod budowę (depth 0 = zasypany): opuszcza teren działki tylko w obrazie */
  dig(x: number, y: number, w: number, h: number, depth: number): void;
  /** Poziomy szczegółów wokół punktu (x, z); reach poszerza zasięg, gdy kamera jest daleko */
  /** `detail` (0–1) skraca odległości szczegółów na słabszych poziomach grafiki (1 = pełne) */
  lod(x: number, z: number, reach: number, detail?: number): void;
  /** Wydeptuje ziemię w narożniku pola (x, y): trawa brązowieje do gołej ziemi, do progu cap */
  wear(x: number, y: number, amount: number, cap?: number): void;
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
  // Góry na planszy (pole gór przy krawędzi): bryła z szumu grzbietowego, im wyżej, tym bardziej poszarpana —
  // granie, żleby i turnie zamiast gładkiego kopca. To tylko wygląd: po górach i tak nikt nie chodzi.
  const nz = createNoise2D(rng(map.seed ^ 0x6d0f));
  const ridged = (x: number, y: number, oct = 4): number => {
    let v = 0, a = 0.5, f = 1, sum = 0;
    for (let o = 0; o < oct; o++) { const n = 1 - Math.abs(nz(x * f, y * f)); v += n * n * a; sum += a; a *= 0.5; f *= 2.03; }
    return v / sum;
  };
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++) {
      const k = y * (w + 1) + x, hh = corners[k]!;
      if (hh <= 1.6) continue;
      const lift = hh - 1.6;
      corners[k] = hh + (ridged(x / 11, y / 11, 5) - 0.45) * lift * 0.55 + Math.pow(ridged(x / 26 + 7, y / 26 - 3), 2) * Math.min(lift, 8) * 0.6;
    }
  const corner = (x: number, y: number): number => corners[y * (w + 1) + x]!;

  // Kolor i normalna liczone w narożnikach i dzielone przez sąsiednie pola: teren przechodzi płynnie,
  // bez widocznej szachownicy. Kolor narożnika to średnia z czterech pól dookoła plus łagodne plamy.
  const snow = new THREE.Color(0xf2efe6);
  const tmp = new THREE.Color();
  const cornerCol = new Float32Array((w + 1) * (h + 1) * 3);
  const cornerNor = new Float32Array((w + 1) * (h + 1) * 3);
  // udziały warstw podłoża w narożniku: las (ściółka), żwir, skała, wydeptanie
  const cornerSplat = new Float32Array((w + 1) * (h + 1) * 4);
  const tileAt = (x: number, y: number): Terrain => map.tiles[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as Terrain;
  // zdjęciowe podłoże ma własne barwy: kolor wierzchołka to tylko delikatny mnożnik (ruda, skała, śnieg)
  const PHOTO_GROUND = !TEST;
  const MUL: Record<Terrain, [number, number, number]> = {
    [Terrain.Grass]: [1, 1, 1], [Terrain.Forest]: [0.92, 0.95, 0.9], [Terrain.Stone]: [1, 1, 1], [Terrain.Iron]: [1.12, 0.86, 0.74],
    [Terrain.Water]: [0.8, 0.8, 0.75], [Terrain.Mountain]: [1, 1, 1],
  };
  const tileColor = (x: number, y: number): THREE.Color =>
    tmp.setHex(TERRAIN[map.tiles[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as Terrain].color);
  // Plaże: część jezior (losowo, ale zawsze te największe) ma piaszczysty brzeg szeroki na 1–2 pola, piasek schodzi pod wodę
  const sandTile = new Float32Array(w * h);
  {
    const lake = new Int32Array(w * h).fill(-1);
    const sizes: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (map.tiles[i] !== Terrain.Water || lake[i]! >= 0) continue;
      const id = sizes.length, q = [i]; lake[i] = id;
      for (let k = 0; k < q.length; k++) {
        const j = q[k]!, x = j % w, y = (j - x) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy, n = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || lake[n]! >= 0 || map.tiles[n] !== Terrain.Water) continue;
          lake[n] = id; q.push(n);
        }
      }
      sizes.push(q.length);
    }
    // brzegi przeplatają się: odcinek piaszczystej plaży, dalej trzciny i krzaki, potem znów zatoczka z piaskiem;
    // „plażowe” jeziora mają piasku więcej, pozostałe tylko pojedyncze zatoczki
    const biggest = sizes.indexOf(Math.max(...sizes, 0));
    const bias = sizes.map((sz, id) => (id === biggest ? 0.25 : sz > 6 && (hash2(id, sz, map.seed ^ 0x5a4d) & 3) < 2 ? 0.1 : -0.3));
    for (let i = 0; i < w * h; i++) {
      const id = lake[i]!;
      if (id < 0) continue;
      const x = i % w, y = (i - x) / w;
      const bf = smoothstep(-0.05, 0.25, nz(x / 8 + 31, y / 8 - 17) + bias[id]!);
      if (bf <= 0.02) continue;
      const reach = 1 + Math.round(bf * 2 * (0.6 + 0.4 * nz(x / 4, y / 4)));
      sandTile[i] = Math.max(sandTile[i]!, bf);
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = map.tiles[ny * w + nx];
        if (t !== Terrain.Grass && t !== Terrain.Water) continue;
        const rr = Math.max(Math.abs(dx), Math.abs(dy));
        const v = (rr <= 1 ? 1 : rr === 2 ? 0.7 : 0.4) * bf;
        sandTile[ny * w + nx] = Math.max(sandTile[ny * w + nx]!, v);
      }
    }
  }
  const cornerSand = new Float32Array((w + 1) * (h + 1));
  const nv = new THREE.Vector3();
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      let r = 0, g = 0, b = 0, sf = 0, sp = 0, sr = 0, sd = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
        const tt = tileAt(x + dx, y + dy);
        if (PHOTO_GROUND) { const m = MUL[tt]; r += m[0]; g += m[1]; b += m[2]; } else { const c = tileColor(x + dx, y + dy); r += c.r; g += c.g; b += c.b; }
        if (tt === Terrain.Forest) sf += 0.25;
        if (tt === Terrain.Stone || tt === Terrain.Iron) sp += 0.25;
        if (tt === Terrain.Mountain) sr += 0.25;
        if (tt === Terrain.Water) sp += 0.2; // brzeg: piasek i kamyki (shader zostawia je tylko miejscami)
        const sx2 = Math.min(w - 1, Math.max(0, x + dx)), sy2 = Math.min(h - 1, Math.max(0, y + dy));
        sd += sandTile[sy2 * w + sx2]! * 0.25;
      }
      cornerSand[y * (w + 1) + x] = sd;
      const patch = 0.9 + ((hash2(x >> 2, y >> 2, map.seed) & 63) / 63) * 0.12 + ((hash2(x, y, map.seed ^ 0x55) & 15) / 15) * 0.06;
      tmp.setRGB((r / 4) * patch, (g / 4) * patch, (b / 4) * patch);
      const hh = corner(x, y);
      if (hh > 3) {
        // skała: ciemniejsze i jaśniejsze warstwy, powyżej nierównej linii śniegu biało
        const strata = 0.82 + ((hash2(x >> 1, Math.round(hh * 2.2), map.seed ^ 0x99) & 31) / 31) * 0.3;
        if (PHOTO_GROUND) tmp.setRGB(strata, strata * 0.98, strata * 0.95); else tmp.setRGB(0.47 * strata, 0.45 * strata, 0.43 * strata);
        const line = 8.5 + ((hash2(x >> 2, y >> 2, map.seed ^ 0x4d) & 63) / 63) * 3;
        tmp.lerp(snow, Math.max(0, Math.min(1, (hh - line) / 1.6)));
      }
      const si = (y * (w + 1) + x) * 4;
      cornerSplat[si] = sf; cornerSplat[si + 1] = sp; cornerSplat[si + 2] = Math.max(sr, Math.min(1, (hh - 2.4) / 0.9)); cornerSplat[si + 3] = 0;
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
  const spl = new Float32Array(w * h * 24);
  const snd = new Float32Array(w * h * 6);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const quad = [[x, y], [x, y + 1], [x + 1, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const;
      quad.forEach(([qx, qy], k) => {
        const ci = (qy * (w + 1) + qx) * 3, o = p + k * 3;
        pos[o] = qx + ox; pos[o + 1] = corner(qx, qy); pos[o + 2] = qy + oz;
        col[o] = cornerCol[ci]!; col[o + 1] = cornerCol[ci + 1]!; col[o + 2] = cornerCol[ci + 2]!;
        nor[o] = cornerNor[ci]!; nor[o + 1] = cornerNor[ci + 1]!; nor[o + 2] = cornerNor[ci + 2]!;
        const so = (p / 3 + k) * 4, cs4 = (qy * (w + 1) + qx) * 4;
        spl[so] = cornerSplat[cs4]!; spl[so + 1] = cornerSplat[cs4 + 1]!; spl[so + 2] = cornerSplat[cs4 + 2]!; spl[so + 3] = 0;
        snd[p / 3 + k] = cornerSand[qy * (w + 1) + qx]!;
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
  geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  geo.setAttribute('sand', new THREE.BufferAttribute(snd, 1));
  // Wydeptana ziemia: kolor narożnika przechodzi od trawy do brunatnej, ubitej gleby (przy domach, na ścieżkach chłopów)
  const baseCol = cornerCol.slice();
  const worn = new Float32Array((w + 1) * (h + 1));
  const dirtA = new THREE.Color(0x5e4a33), dirtB = new THREE.Color(0x7a6446), dc = new THREE.Color();
  let dirtyLo = Infinity, dirtyHi = -1;
  // narożnik (dx, dy) względem pola → numery wierzchołków w kwadracie pola
  const SLOTS: Record<string, number[]> = { '0,0': [0], '0,1': [1, 4], '1,0': [2, 3], '1,1': [5] };
  const wear = (cx: number, cy: number, amount: number, cap = 0.8): void => {
    if (cx < 0 || cy < 0 || cx > w || cy > h) return;
    const ci = cy * (w + 1) + cx;
    const hh = corner(cx, cy);
    if (hh > 3 || hh < 0.02) return; // skały i brzegi wody zostają
    const nv2 = Math.min(cap, worn[ci]! + amount);
    if (nv2 <= worn[ci]!) return;
    worn[ci] = nv2;
    if (grass) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) { const tx = cx - dx, ty = cy - dy; if (tx >= 0 && ty >= 0 && tx < w && ty < h) grass.setWear(ty * w + tx, Math.min(1, nv2 * 1.3)); }
    if (PHOTO_GROUND) {
      const k2 = nv2 * nv2 * (3 - 2 * nv2);
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
        const tx = cx - dx, ty = cy - dy;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        for (const slot of SLOTS[`${dx},${dy}`]!) {
          const o = ((ty * w + tx) * 6 + slot) * 4 + 3;
          spl[o] = k2;
          splLo = Math.min(splLo, o); splHi = Math.max(splHi, o + 1);
        }
      }
      queueMicrotask(flushWear);
      return;
    }
    dc.copy(dirtA).lerp(dirtB, (hash2(cx, cy, map.seed ^ 0x3131) & 255) / 255);
    const k = nv2 * nv2 * (3 - 2 * nv2) * 0.9;
    const r0 = baseCol[ci * 3]! + (dc.r - baseCol[ci * 3]!) * k, g0 = baseCol[ci * 3 + 1]! + (dc.g - baseCol[ci * 3 + 1]!) * k, b0 = baseCol[ci * 3 + 2]! + (dc.b - baseCol[ci * 3 + 2]!) * k;
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const tx = cx - dx, ty = cy - dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      for (const slot of SLOTS[`${dx},${dy}`]!) {
        const o = (ty * w + tx) * 18 + slot * 3;
        col[o] = r0; col[o + 1] = g0; col[o + 2] = b0;
        dirtyLo = Math.min(dirtyLo, o); dirtyHi = Math.max(dirtyHi, o + 3);
      }
    }
    queueMicrotask(flushWear);
  };
  let splLo = Infinity, splHi = -1;
  const flushWear = (): void => {
    if (splHi >= 0) {
      const sa = geo.getAttribute('splat') as THREE.BufferAttribute;
      sa.clearUpdateRanges();
      sa.addUpdateRange(splLo, splHi - splLo);
      sa.needsUpdate = true;
      splLo = Infinity; splHi = -1;
    }
    if (dirtyHi < 0) return;
    const attr = geo.getAttribute('color') as THREE.BufferAttribute;
    attr.clearUpdateRanges();
    attr.addUpdateRange(dirtyLo, dirtyHi - dirtyLo);
    attr.needsUpdate = true;
    dirtyLo = Infinity; dirtyHi = -1;
  };
  const ground = new THREE.Mesh(geo, PHOTO_GROUND ? groundMaterial() : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: pattern('grass'), bumpMap: bump('grass'), bumpScale: 0.7, normalMap: normal('grass'), normalScale: new THREE.Vector2(0.8, 0.8) }));
  (ground.material as THREE.Material).userData.season = 'ground'; // śnieg ze śladami ludzi
  ground.receiveShadow = true;
  ground.castShadow = true; // góry i pagórki też rzucają cień
  group.add(cat(ground, 'teren'));

  // Woda: dwie warstwy drobnych fal przesuwające się w różne strony, lekko przejrzysta, z połyskiem słońca
  const ripples = bump('water')?.clone() ?? null;
  if (ripples) { ripples.repeat.set(w / 14, h / 14); ripples.needsUpdate = true; }
  // woda (jeziora i morze za mapą) powstaje niżej, gdy znany jest już teren za mapą
  let wm!: ReturnType<typeof waterMaterial>;

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
    group.add(cat(fishMesh, 'ryby'));
  }
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fe = new THREE.Euler();
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3(1, 1, 1);
  const animate = (time: number): void => {
    if (ripples) ripples.offset.set(time * 0.006, time * 0.009);
    windTime.value = time;
    wm.time.value = time;
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

  // Za mapą: puszcza i prawdziwe góry. Brzeg planszy przechodzi płynnie w las, dalej wznoszą się pasma
  // (grzbiety z szumu „ridged”) i 2–3 wielkie masywy z ośnieżonymi szczytami, które giną we mgle.
  // Siatka indeksowana: każdy wierzchołek raz, gęsta przy planszy, rzadsza daleko (tam i tak mgła).
  const D = TEST ? 6 : 110;
  const floorCol = PHOTO_GROUND ? new THREE.Color(0.86, 0.88, 0.84) : new THREE.Color(0x46612a);
  // wielkie masywy: losowo po bokach i w rogach, zawsze poza planszą
  const massifs: { x: number; y: number; r: number; hgt: number }[] = [];
  let seaSide = -1;
  /** Jak daleko w morze (ujemne = jeszcze ląd): 0 przy krawędzi planszy od strony morza, wybrzeże faluje */
  const seaT = (X: number, Y: number): number => {
    if (seaSide < 0) return -99;
    const s0 = seaSide === 0 ? -X : seaSide === 1 ? X - w : seaSide === 2 ? -Y : Y - h;
    const along = seaSide < 2 ? Y : X;
    return s0 - 17 + nz(along / 22, 3.3) * 4 + nz(along / 7, 9.1) * 1.2;
  };
  {
    let rs = (map.seed ^ 0x2b7e1516) >>> 0;
    const rnd = (): number => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
    // morze: na części map jeden bok za planszą to morze z szeroką plażą (zamiast lasu i gór)
    seaSide = TEST ? -1 : rnd() < 0.6 ? Math.floor(rnd() * 4) : -1;
    const count = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < count; i++) {
      let side = (Math.floor(rnd() * 4) + i) % 4;
      if (side === seaSide) side = (side + 2) % 4;
      const along = 0.1 + rnd() * 0.8, out = 30 + rnd() * 30;
      const x = side === 0 ? -out : side === 1 ? w + out : along * w;
      const y = side === 2 ? -out : side === 3 ? h + out : along * h;
      massifs.push({ x, y, r: 20 + rnd() * 16, hgt: 26 + rnd() * 18 });
    }
  }
  const outerH = (X: number, Y: number): number => {
    if (X >= 0 && X <= w && Y >= 0 && Y <= h) return corner(Math.round(X), Math.round(Y));
    const cx = Math.max(0, Math.min(w, X)), cy = Math.max(0, Math.min(h, Y));
    const d = Math.max(Math.abs(X - cx), Math.abs(Y - cy));
    const base = Math.max(0.12, corner(Math.round(cx), Math.round(cy)));
    const fade = Math.max(0, 1 - d / 9);
    let hh = 0.12 + (base - 0.12) * fade * fade * (3 - 2 * fade);
    // pagórki pod lasem przy brzegu, dalej coraz wyższe zalesione pasma
    const rr = ridged(X / 46, Y / 46);
    hh += (0.4 + nz(X / 11, Y / 11) * 0.3) * Math.min(1, d / 5) + Math.pow(rr, 1.6) * 14 * smoothstep(8, 45, d);
    for (const m of massifs) {
      const dx = X - m.x, dy = Y - m.y, q = (dx * dx + dy * dy) / (m.r * m.r);
      if (q > 9) continue;
      const g = Math.exp(-q * 1.4);
      hh += m.hgt * g * (0.6 + 0.4 * ridged(X / 13 + m.x, Y / 13 + m.y, 5)) * smoothstep(1, 12, d);
    }
    // od strony morza: szeroka, płaska plaża łagodnie schodząca do wody, dalej coraz głębiej
    const t = seaT(X, Y);
    if (t > -20) {
      // wydmy: lekko pofalowana plaża, przy wodzie płasko, dalej od wody nieco wyżej
      const beachH = t < 0 ? 0.1 + Math.min(-t, 13) * 0.014 + Math.max(0, nz(X / 6, Y / 6)) * 0.12 * smoothstep(-2, -8, t) : -0.02 - t * 0.12;
      const k = smoothstep(-20, -13, t);
      hh = hh * (1 - k) + Math.max(beachH, -3.5) * k;
    }
    return hh;
  };
  /** Udział piasku za mapą (plaża nad morzem i pod płytką wodą) */
  const outerSand = (X: number, Y: number): number => { const t = seaT(X, Y); return t < -40 ? 0 : smoothstep(-17, -13, t); };
  {
    const W2 = w + 2 * D, H2 = h + 2 * D;
    // kolumny/wiersze siatki: co 1 pole przy planszy, co 2 dalej niż 30, co 4 dalej niż 70
    const axis = (size: number): number[] => {
      const out: number[] = [];
      for (let v = -D; v <= size + D;) {
        out.push(v);
        const dd = v < 0 ? -v : v > size ? v - size : 0;
        v += dd >= 70 ? 4 : dd >= 30 ? 2 : 1;
      }
      if (out[out.length - 1] !== size + D) out.push(size + D);
      return out;
    };
    const xs = axis(w), ys = axis(h);
    const NX = xs.length, NY = ys.length;
    const P = new Float32Array(NX * NY * 3), C = new Float32Array(NX * NY * 3), N = new Float32Array(NX * NY * 3), U = new Float32Array(NX * NY * 2), S = new Float32Array(NX * NY * 4), SD = new Float32Array(NX * NY);
    const hs = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) hs[j * NX + i] = outerH(xs[i]!, ys[j]!);
    const c3 = new THREE.Color(), nv2 = new THREE.Vector3();
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const X = xs[i]!, Y = ys[j]!, k = j * NX + i;
        const inside = X >= 0 && X <= w && Y >= 0 && Y <= h;
        P[k * 3] = X + ox; P[k * 3 + 1] = hs[k]!; P[k * 3 + 2] = Y + oz;
        U[k * 2] = X / 5; U[k * 2 + 1] = Y / 5;
        const cx = Math.max(0, Math.min(w, X)), cy = Math.max(0, Math.min(h, Y));
        const ci = (cy * (w + 1) + cx) * 3, c4 = (cy * (w + 1) + cx) * 4;
        if (inside) {
          C[k * 3] = cornerCol[ci]!; C[k * 3 + 1] = cornerCol[ci + 1]!; C[k * 3 + 2] = cornerCol[ci + 2]!;
          N[k * 3] = cornerNor[ci]!; N[k * 3 + 1] = cornerNor[ci + 1]!; N[k * 3 + 2] = cornerNor[ci + 2]!;
          S[k * 4] = cornerSplat[c4]!; S[k * 4 + 1] = cornerSplat[c4 + 1]!; S[k * 4 + 2] = cornerSplat[c4 + 2]!;
          SD[k] = cornerSand[cy * (w + 1) + cx]!;
          continue;
        }
        const d = Math.max(Math.abs(X - cx), Math.abs(Y - cy));
        c3.setRGB(cornerCol[ci]!, cornerCol[ci + 1]!, cornerCol[ci + 2]!);
        if (corner(cx, cy) < 0) c3.copy(floorCol);
        c3.lerp(tmp.copy(floorCol).multiplyScalar(0.92 + ((hash2(X >> 2, Y >> 2, map.seed) & 63) / 63) * 0.12), Math.min(1, d / 10));
        C[k * 3] = c3.r; C[k * 3 + 1] = c3.g; C[k * 3 + 2] = c3.b;
        const iL = Math.max(0, i - 1), iR = Math.min(NX - 1, i + 1), jU = Math.max(0, j - 1), jD = Math.min(NY - 1, j + 1);
        const sx = (hs[j * NX + iR]! - hs[j * NX + iL]!) / Math.max(1e-3, xs[iR]! - xs[iL]!), sz = (hs[jD * NX + i]! - hs[jU * NX + i]!) / Math.max(1e-3, ys[jD]! - ys[jU]!);
        nv2.set(-sx, 1, -sz).normalize();
        N[k * 3] = nv2.x; N[k * 3 + 1] = nv2.y; N[k * 3 + 2] = nv2.z;
        // pod lasem ściółka; skała, gdzie stromo albo wysoko (śnieg dokłada shader)
        const rockK = Math.max(smoothstep(0.82, 0.6, nv2.y), smoothstep(13, 17, hs[k]!));
        const sandK = outerSand(X, Y);
        SD[k] = sandK;
        S[k * 4] = Math.min(0.9, d / 4) * (1 - rockK) * (1 - sandK); S[k * 4 + 2] = rockK * (1 - sandK);
      }
    const idx: number[] = [];
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX - 1; i++) {
        // komórki leżące całe na planszy pomijamy: plansza ma własną siatkę
        if (xs[i]! >= 0 && xs[i + 1]! <= w && ys[j]! >= 0 && ys[j + 1]! <= h) continue;
        const a = j * NX + i, b = a + 1, c = a + NX, e = c + 1;
        idx.push(a, c, b, b, c, e);
      }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(P, 3));
    og.setAttribute('color', new THREE.BufferAttribute(C, 3));
    og.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    og.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    og.setAttribute('splat', new THREE.BufferAttribute(S, 4));
    og.setAttribute('sand', new THREE.BufferAttribute(SD, 1));
    og.setIndex(idx);
    const outer = new THREE.Mesh(og, ground.material);
    outer.receiveShadow = true;
    // góry za mapą nie rzucają cienia: 100 tys. trójkątów w każdej klatce cienia, a ich cień i tak pada poza plansza
    outer.castShadow = false;
    group.add(cat(outer, 'teren za mapą'));
    // daleko za górami płaska ciemna równina, którą i tak zakrywa mgła
    const far = new THREE.Mesh(new THREE.PlaneGeometry(W2 + 600, H2 + 600), new THREE.MeshStandardMaterial({ color: 0x2c3a1c, roughness: 1 }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.2;
    group.add(cat(far, 'teren za mapą'));
  }

  // Woda na całym obszarze (plansza i teren za nią): jeziora na planszy i morze za mapą jedną taflą.
  // Tekstura brzegu (2 podpola na pole): R = głębia, G = gładka maska wody (rozmyta granica): tafla wygasa
  // miękko i nieregularnie zamiast kończyć się kantem pól.
  {
    const EW = w + 2 * D, EH = h + 2 * D, SS = 2, SW = EW * SS, SH = EH * SS;
    const dist = new Int16Array(w * h).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < w * h; i++) if (map.tiles[i] !== Terrain.Water) { dist[i] = 0; queue.push(i); }
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi]!, x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j]! >= 0) continue;
        dist[j] = dist[i]! + 1; queue.push(j);
      }
    }
    // wysokość terenu za mapą w siatce pól (raz, potem odczyt)
    const oh = new Float32Array(EW * EH);
    for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
      const X = x - D + 0.5, Y = y - D + 0.5;
      oh[y * EW + x] = X >= 0 && X < w && Y >= 0 && Y < h ? 1 : outerH(X, Y);
    }
    let m: Float32Array = new Float32Array(SW * SH), d: Float32Array = new Float32Array(SW * SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const tx = ((x / SS) | 0) - D, ty = ((y / SS) | 0) - D;
      if (tx >= 0 && ty >= 0 && tx < w && ty < h) {
        const t = ty * w + tx;
        m[y * SW + x] = map.tiles[t] === Terrain.Water ? 1 : 0;
        d[y * SW + x] = Math.max(0, dist[t]! - 0.5) / 6;
      } else {
        const hh = oh[(ty + D) * EW + (tx + D)]!;
        m[y * SW + x] = hh < -0.07 ? 1 : 0;
        d[y * SW + x] = Math.max(0, Math.min(1.4, -hh * 0.45));
      }
    }
    const blur = (src: Float32Array): Float32Array => {
      const tmpB = new Float32Array(src.length), out = new Float32Array(src.length), R = 2;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { let a = 0, n = 0; for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < SW) { a += src[y * SW + xx]!; n++; } } tmpB[y * SW + x] = a / n; }
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { let a = 0, n = 0; for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < SH) { a += tmpB[yy * SW + x]!; n++; } } out[y * SW + x] = a / n; }
      return out;
    };
    m = blur(blur(m)); d = blur(d);
    const shoreData = new Uint8Array(SW * SH * 4);
    for (let i = 0; i < SW * SH; i++) { shoreData[i * 4] = Math.min(255, d[i]! * 255); shoreData[i * 4 + 1] = Math.min(255, m[i]! * 255); shoreData[i * 4 + 3] = 255; }
    const shoreTex = new THREE.DataTexture(shoreData, SW, SH, THREE.RGBAFormat);
    shoreTex.magFilter = THREE.LinearFilter; shoreTex.minFilter = THREE.LinearFilter; shoreTex.needsUpdate = true;
    wm = waterMaterial(shoreTex, EW, EH);
    const waterMat = wm.mat;
    if (TEST) { waterMat.bumpMap = ripples; waterMat.bumpScale = 0.7; }
    // tafla sięga daleko za obszar (morze aż po horyzont); poza nim tekstura brzegu powtarza wartości z krawędzi
    const water = new THREE.Mesh(new THREE.PlaneGeometry(EW + 600, EH + 600), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.08;
    water.receiveShadow = true;
    group.add(cat(water, 'woda'));
    const shallow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x46533f, roughness: 1 }));
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.y = -0.32;
    group.add(cat(shallow, 'woda'));
  }

  // gęsta trawa: łąka pełna, las i złoża rzadko, woda i góry bez trawy
  const grassBase = new Float32Array(w * h);
  for (let t = 0; t < w * h; t++) {
    const tt = map.tiles[t] as Terrain;
    grassBase[t] = (tt === Terrain.Grass ? 1 : tt === Terrain.Forest ? 0.35 : tt === Terrain.Stone ? 0.25 : tt === Terrain.Iron ? 0.1 : 0) * (sandTile[t]! > 0.12 ? 0 : 1); // na piasku plaży trawy nie ma wcale
  }
  const grass: GrassField | null = TEST ? null : createGrassField(w, h, corners, grassBase, groundGrassTexture(), bladeTexture(map.seed));
  if (grass) group.add(cat(grass.mesh, 'trawa (dywan)'));
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
  type Item = { m: THREE.Matrix4; shade: number; tile: number; pos: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; frost?: number };
  const FROST = new THREE.Color(0xdfe7ea);
  const pines: Item[] = [], leafy: Item[] = [], rocks: Item[] = [], ores: Item[] = [], tufts: Item[] = [];
  const bushes: Item[] = [], pebbles: Item[] = [], flowers: Item[] = [], reeds: Item[] = [], lilies: Item[] = [];
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
      // brzeg wody: kępy trzcin i pałek po obu stronach linii wody, na płyciźnie liście grzybieni
      const isW = (xx: number, yy: number): boolean => xx >= 0 && yy >= 0 && xx < w && yy < h && map.tiles[yy * w + xx] === Terrain.Water;
      const nearW = isW(x + 1, y) || isW(x - 1, y) || isW(x, y + 1) || isW(x, y - 1);
      const sandy = sandTile[y * w + x]! > 0.3;
      if (!sandy && t === Terrain.Grass && nearW && (r >>> 18) % 4 === 0) put(bushes, x, y, 24, 0.9 + ((r >>> 20) & 7) / 12, 0.8);
      if (!sandy && t !== Terrain.Water && nearW && (r >>> 9) % 3 !== 0) { put(reeds, x, y, 21, 1, 1.0); if ((r >>> 12) & 1) put(reeds, x, y, 22, 0.8, 1.0); }
      if (t === Terrain.Water) {
        const shoreNear = !isW(x + 1, y) || !isW(x - 1, y) || !isW(x, y + 1) || !isW(x, y - 1);
        if (!sandy && shoreNear && (r >>> 9) % 2 === 0) put(reeds, x, y, 23, 1.1, 0.9);
        const near2 = !isW(x + 2, y) || !isW(x - 2, y) || !isW(x, y + 2) || !isW(x, y - 2);
        if ((shoreNear || near2) && (r >>> 14) % 5 === 0) for (let k = 0; k < 3; k++) put(lilies, x, y, 30 + k, 0.8 + k * 0.2, 0.9);
      }
      else if (t === Terrain.Grass && !sandy) {
        // łąka: gęste kępy trawy, kwiaty, pojedyncze krzewy, kamyki i z rzadka większy głaz
        // kępy rosną gęściej tam, gdzie łąka jest bujniejsza (wolny szum), na wydeptanych miejscach znikają razem z polem
        const lush = (hash2(x >> 3, y >> 3, map.seed ^ 0x6a5d) & 255) / 255;
        // trawę rysuje gęsty dywan (grass.ts); tu tylko pojedyncze wyższe kępy dla urozmaicenia
        if (TEST && ((r >>> 7) & 3) === 0) put(tufts, x, y, 2, 1, 0.95);
        if ((r >>> 13) % 15 === 0) { put(flowers, x, y, 7, 1, 0.9); put(flowers, x, y, 8, 0.9, 0.9); if ((r >>> 4) & 1) put(flowers, x, y, 9, 1.1, 0.9); }
        if ((r >>> 16) % 23 === 0) put(bushes, x, y, 4, 0.9 + ((r >>> 20) & 7) / 14, 0.6);
        if ((r >>> 19) % 31 === 0) put(pebbles, x, y, 5, 0.35 + ((r >>> 24) & 7) / 20, 0.8);
        if ((r >>> 21) % 173 === 0) put(pebbles, x, y, 10, 1.5, 0.4);
        // drobne kamyki wystające z darni, częściej tam, gdzie łąka rzadsza
        if ((r >>> 22) % (lush > 0.5 ? 19 : 11) === 0) put(pebbles, x, y, 12, 0.12 + ((r >>> 26) & 7) / 40, 0.95);
        if ((r >>> 25) % 41 === 0) put(pebbles, x, y, 14, 0.1 + ((r >>> 3) & 7) / 50, 0.95);
      }
    }
  }
  const tint = new THREE.Color();
  // trawa: kolory z wierzchołków (ciemna nasada, jasny koniec) i lekki wiatr kołyszący czubki
  const windTime = { value: 0 };
  // Trawa jak w nowych grach: tekstura z setkami cienkich źdźbeł (rysowana raz na starcie, z przezroczystością)
  // na trzech skrzyżowanych kartach. Kępa to 6 trójkątów zamiast kilkudziesięciu, a z bliska widać prawdziwe źdźbła.
  const grassTex = grassCardTexture(map.seed);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.windTime = windTime;
    sh.fragmentShader = sh.fragmentShader
      // ostre krawędzie źdźbeł także z daleka (mipmapy rozmywają przezroczystość, więc ją wyostrzamy)
      .replace('#include <alphatest_fragment>', 'diffuseColor.a = (diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;\n#include <alphatest_fragment>')
      // źdźbło świeci z obu stron tak samo, nasada ciemniejsza (cień w kępie), trochę światła przechodzi przez liść
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.0, 0.55, vGrassH));\n  totalEmissiveRadiance += diffuseColor.rgb * 0.06;');
    sh.fragmentShader = 'varying float vGrassH;\n' + sh.fragmentShader;
    sh.vertexShader = 'uniform float windTime;\nvarying float vGrassH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vGrassH = uv.y;
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
        float gust = sin(windTime * 1.7 + ip.x * 0.35 + ip.y * 0.21) * 0.6 + sin(windTime * 3.3 + ip.x * 1.3 + ip.y) * 0.25;
        transformed.x += gust * 0.05 * uv.y * uv.y;
        transformed.z += gust * 0.025 * uv.y * uv.y;
      #endif`);
  };
  grassMat.customProgramCacheKey = () => 'grass-cards';
  grassMat.userData.season = 'grass';
  /**
   * Roślinność i kamienie w kawałkach 40×40 pól: każdy kawałek to osobna siatka z własną sferą ograniczającą,
   * więc karta graficzna pomija to, czego nie widać (także w cieniach). Na dużych mapach to kilkukrotnie mniej trójkątów.
   * Na zewnątrz zachowuje się jak jedna siatka instancji (indeksy jak w liście).
   */
  type Inst = { setMatrixAt(i: number, m: THREE.Matrix4): void; setColorAt(i: number, c: THREE.Color): void; instanceMatrix: { needsUpdate: boolean } };
  const CHUNK = 40;
  // korony świerków: kolory z wierzchołków (jasne końce gałęzi, ciemne wnętrze), gładkie cieniowanie, widoczne z obu stron
  const farPine = models.treeCrownFar();
  farPine.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((farPine.attributes.position as THREE.BufferAttribute).count * 3).fill(0.95), 3));
  // daleki las jako obrazki: świerk i drzewo liściaste sfotografowane z 8 stron (pień + korona w jednym obrazku)
  const pineImp = treeImpostor([{ geo: models.treeTrunk(), color: 0x6b4a2e, map: pattern('bark') }, { geo: models.treeCrown(), color: 0x3c7a3a, map: pattern('needles'), vertexColors: true }]);
  const leafImp = treeImpostor([{ geo: models.leafTrunk(), color: 0x7a5a3a, map: pattern('bark') }, { geo: models.leafCrown(), color: 0x6fa33d, map: pattern('leaves') }]);
  const PINE_LOD: Lod = pineImp ? { farGeo: pineImp.geometry, farMat: pineImp.material(0x3c7a3a) } : { farGeo: farPine };
  const LEAF_LOD: Lod = { ...(leafImp ? { farGeo: leafImp.geometry, farMat: leafFar(leafImp.material(0x6fa33d)) } : { farGeo: models.leafCrownFar() }), shadowGeo: models.leafCrownShadow() };
  // pień znika razem z przełączeniem korony na obrazek (obrazek ma już pień)
  // od ok. 30 pól od środka widoku drzewa są obrazkami (impostorami), drobiazgi znikają — z bliska nic się nie zmienia,
  // a z daleka i tak ich nie widać (wcześniej 40–42 pola: w zwykłym widoku pełne drzewa sięgały do krawędzi ekranu)
  // cień pnia: graniastosłup bez denek (z góry słońca denka i tak nie widać), gałęzie liściastych też uproszczone
  const pineTrunkShadow = new THREE.CylinderGeometry(0.06, 0.11, 0.55, 4, 1, true).translate(0, 0.27, 0);
  const leafTrunkShadow = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.12, 0.6, 4, 1, true).translate(0, 0.3, 0),
    new THREE.CylinderGeometry(0.035, 0.05, 0.35, 3, 1, true).rotateZ(0.8).translate(-0.13, 0.62, 0),
    new THREE.CylinderGeometry(0.035, 0.05, 0.35, 3, 1, true).rotateZ(-0.8).translate(0.13, 0.66, 0.02),
  ])!;
  const TRUNK_LOD: Lod = { hide: pineImp ? 30 : 62, shadowGeo: pineTrunkShadow }, SMALL_LOD: Lod = { hide: 30 };
  const LEAF_TRUNK_LOD: Lod = { ...TRUNK_LOD, shadowGeo: leafTrunkShadow };
  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, map: pattern('needles') });
  // wiatr w koronach: czubek drzewa kołysze się wolno, każde drzewo w swojej fazie (podmuchy przechodzą przez las falą);
  // pień stoi, więc ruch rośnie z wysokością. Ten sam zegar co trawa.
  const windCrown = (m: THREE.Material, amp: number, key: string): void => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.windTime = windTime;
      sh.vertexShader = 'uniform float windTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wp = instanceMatrix[3].xz;
          float lift = max(position.y - 0.25, 0.0);
          float wave = sin(windTime * 0.9 + wp.x * 0.11 + wp.y * 0.07) * 0.7 + sin(windTime * 2.3 + wp.x * 0.6 + wp.y * 0.4) * 0.3;
          transformed.x += wave * ${amp.toFixed(3)} * lift * lift;
          transformed.z += wave * ${(amp * 0.5).toFixed(3)} * lift * lift;
        #endif`);
    };
    m.customProgramCacheKey = () => key;
    // cień korony kołysze się razem z nią (inaczej po koronie wędrują jasne pasy w miejscach, gdzie cień „został”)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = m.onBeforeCompile;
    depth.customProgramCacheKey = () => key + '-depth';
    m.userData.windDepth = depth;
  };
  windCrown(pineMat, 0.08, 'wind-pine');
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: pattern('leaves'), bumpMap: bump('leaves'), bumpScale: 1.2, normalMap: normal('leaves') });
  leafMat.userData.season = 'leaf';
  windCrown(leafMat, 0.12, 'wind-leaf');
  // Poziomy szczegółów: każdy kawałek (40×40 pól) wie, gdzie leży. Drobiazgi (kępy, kwiaty, kamyki) znikają daleko
  // od kamery, a świerki dalej niż kilkadziesiąt pól przełączają się na prosty model. Liczone co kilka klatek.
  // shadowGeo: prostsza bryła tego samego kształtu, która rzuca cień zamiast pełnego modelu (w obrazie zostaje pełny);
  // cień liczony jest z mapy 4096 px na obszar kilkudziesięciu pól, więc różnicy w kształcie cienia nie widać
  type Lod = { hide?: number; farGeo?: THREE.BufferGeometry; farMat?: THREE.Material; shadowGeo?: THREE.BufferGeometry };
  const lodChunks: { mesh: THREE.InstancedMesh; x: number; z: number; lod: Lod; near: THREE.BufferGeometry; nearMat: THREE.Material; shadow: boolean; proxy?: THREE.InstancedMesh }[] = [];
  /** Podpis kolejnych siatek roślinności do okna wydajności (F3) */
  let label = 'roślinność';
  const instanced = (g: THREE.BufferGeometry, color: number, list: Item[], tex?: Parameters<typeof pattern>[0], shadow = true, own?: THREE.Material, lod?: Lod, chunk = CHUNK): Inst | null => {
    if (!list.length) return null;
    const mat = own ?? new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: 1.2, normalMap: tex ? normal(tex) : null });
    if (!own && tex === 'leaves') mat.userData.season = 'leaf'; // liściaste korony i krzewy: jesienią rude, zimą gołe
    const buckets = new Map<number, number[]>();
    list.forEach((it, i) => {
      const k = Math.floor((it.pos.x + 512) / chunk) * 4096 + Math.floor((it.pos.z + 512) / chunk);
      let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); } b.push(i);
    });
    const where: [THREE.InstancedMesh, number][] = new Array(list.length);
    const dirty = new Set<THREE.InstancedMesh>();
    for (const idx of buckets.values()) {
      const mesh = new THREE.InstancedMesh(g, mat, idx.length);
      idx.forEach((i, j) => { const it = list[i]!; mesh.setMatrixAt(j, it.m); tint.setHex(color).multiplyScalar(it.shade); if (it.frost) tint.lerp(FROST, it.frost); mesh.setColorAt(j, tint); where[i] = [mesh, j]; });
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 3; // zapas na ścinane, przechylające się drzewa
      let proxy: THREE.InstancedMesh | undefined;
      if (shadow && lod?.shadowGeo) {
        // zastępcza bryła cienia: te same instancje (wspólny bufor macierzy, więc ścinanie drzew działa samo), warstwa „tylko cień”
        proxy = new THREE.InstancedMesh(lod.shadowGeo, shadowProxyMaterial, idx.length);
        proxy.instanceMatrix = mesh.instanceMatrix;
        proxy.boundingSphere = mesh.boundingSphere;
        proxy.layers.set(SHADOW_LAYER);
        proxy.castShadow = true;
        if (mat.userData.windDepth) proxy.customDepthMaterial = mat.userData.windDepth as THREE.Material;
        cat(proxy, label + ' (cień)');
        group.add(proxy);
      }
      const casts = shadow && !proxy;
      if (lod && mesh.boundingSphere) lodChunks.push({ mesh, x: mesh.boundingSphere.center.x, z: mesh.boundingSphere.center.z, lod, near: g, nearMat: mat, shadow: casts, proxy });
      mesh.castShadow = casts;
      if (mat.userData.windDepth) mesh.customDepthMaterial = mat.userData.windDepth as THREE.Material;
      cat(mesh, label);
      // kępy trawy nie przyjmują cienia: cienkie źdźbła tuż nad ziemią łapały cień samego terenu i czerniały
      mesh.receiveShadow = mat !== grassMat;
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
  const trunkItems = new Set<Item>([...pines, ...leafy]);
  label = 'drzewa: pnie';
  const pineTrunks = instanced(models.treeTrunk(), 0x6b4a2e, pines, 'bark', true, undefined, TRUNK_LOD);
  const leafTrunks = instanced(models.leafTrunk(), 0x7a5a3a, leafy, 'bark', true, undefined, LEAF_TRUNK_LOD);
  label = 'drzewa: korony';
  plant(pines, pineTrunks, instanced(models.treeCrown(), 0x3c7a3a, pines, 'needles', true, pineMat, PINE_LOD));
  plant(leafy, leafTrunks, instanced(models.leafCrown(), 0x6fa33d, leafy, 'leaves', true, leafMat, LEAF_LOD));
  // Puszcza za krawędzią mapy: nikt tam nie dojdzie ani nie zetnie drzew (to tylko tło).
  // Las wchodzi na zbocza aż pod granicę lasu; wyżej drzewa rzedną, są niższe i oszronione, nad nimi tylko skała i śnieg.
  // Dalekie drzewa mają uproszczony model (mniej trójkątów), a mgła i tak zaciera szczegóły.
  {
    const near: { pine: Item[]; leaf: Item[] } = { pine: [], leaf: [] };
    const far: { pine: Item[]; leaf: Item[] } = { pine: [], leaf: [] };
    const e3 = new THREE.Euler();
    const hAny = (X: number, Y: number): number => (X >= 0 && X <= w && Y >= 0 && Y <= h ? heightAt(X, Y) : outerH(X, Y));
    const slopeAt = (X: number, Y: number): number => Math.hypot(hAny(X + 1, Y) - hAny(X - 1, Y), hAny(X, Y + 1) - hAny(X, Y - 1)) / 2;
    for (let gz = -h / 2 - D; gz < h / 2 + D; gz += 1.7)
      for (let gx = -w / 2 - D; gx < w / 2 + D; gx += 1.7) {
        const r = hash2(Math.round(gx * 10), Math.round(gz * 10), map.seed ^ 0x7f4a7c15);
        const dist = Math.max(Math.abs(gx) - w / 2, Math.abs(gz) - h / 2);
        // dalej rzadziej: co drugi punkt za 40 pól, co trzeci za 75 (mgła)
        // z obrazkami dalekich drzew las może być gęstszy (co trzeci punkt za 70 pól, co drugi za 35)
        if (dist > 70 ? r % 3 !== 0 : dist > 35 ? (r & 1) === 1 : false) continue;
        const step = dist > 70 ? 5 : dist > 35 ? 3.5 : dist > 18 ? 2.4 : 1.7;
        const px = gx + ((r & 255) / 255 - 0.5) * step * 0.9;
        const pz = gz + (((r >>> 8) & 255) / 255 - 0.5) * step * 0.9;
        const dd = Math.max(Math.abs(px) - w / 2, Math.abs(pz) - h / 2);
        if (dd < 0.9) {
          // na planszy las tylko na zboczach gór (tam nikt nie chodzi ani nie ścina)
          const tx = Math.floor(px - ox), ty = Math.floor(pz - oz);
          if (tx < 1 || ty < 1 || tx >= w - 1 || ty >= h - 1 || map.tiles[ty * w + tx] !== Terrain.Mountain) continue;
          if (map.tiles[ty * w + tx + 1] !== Terrain.Mountain || map.tiles[ty * w + tx - 1] !== Terrain.Mountain || map.tiles[(ty + 1) * w + tx] !== Terrain.Mountain || map.tiles[(ty - 1) * w + tx] !== Terrain.Mountain) continue;
        }
        const X = px - ox, Y = pz - oz;
        if (seaT(X, Y) > -16) continue; // plaża i morze bez drzew
        const groundY = hAny(X, Y);
        const treeline = 10.5 + nz(X / 30, Y / 30) * 2.0;
        if (groundY > treeline || slopeAt(X, Y) > 1.3) continue;
        const alt = smoothstep(treeline - 6, treeline, groundY);
        if (((r >>> 20) & 255) / 255 < alt * 0.7) continue; // pod granicą lasu coraz rzadziej
        const k = Math.min(1, dd / 60);
        const size = (1.25 + k * 1.6) * (0.8 + ((r >>> 16) & 255) / 255 * 0.5) * (1 - alt * 0.45);
        const leafTree = groundY < 4 && (r >>> 24) % 4 === 0; // wysoko tylko świerki
        const pos = new THREE.Vector3(px, groundY - 0.05, pz);
        const qq = new THREE.Quaternion().setFromEuler(e3.set(0, ((r >>> 4) & 63) / 10, 0));
        const sc = new THREE.Vector3(size * 1.25, size * 1.6 * (leafTree ? 1 : 1.15), size * 1.25);
        const item = { m: new THREE.Matrix4().compose(pos, qq, sc), shade: (1 - k * 0.5) * (0.82 + ((r >>> 12) & 15) / 60), tile: -1, pos, q: qq, s: sc, frost: smoothstep(treeline - 5.5, treeline - 0.5, groundY) * 0.75 } as Item;
        const bucket = dd < 14 ? near : far;
        (leafTree ? bucket.leaf : bucket.pine).push(item);
      }
    label = 'puszcza za mapą: bliska';
    instanced(models.treeTrunk(), 0x6b4a2e, near.pine, 'bark', true, undefined, TRUNK_LOD);
    instanced(models.treeCrown(), 0x3c7a3a, near.pine, 'needles', true, pineMat, PINE_LOD);
    instanced(models.leafTrunk(), 0x7a5a3a, near.leaf, 'bark', true, undefined, LEAF_TRUNK_LOD);
    instanced(models.leafCrown(), 0x5f9a38, near.leaf, 'leaves', true, leafMat, LEAF_LOD);
    // puszcza za mapą: obrazki zamiast brył (dwa trójkąty na drzewo), stąd może być gęstsza
    // dalekie obrazki nie przełączają szczegółów, więc kawałki mogą być duże (120 pól): kilkanaście wywołań rysowania zamiast ~200
    label = 'puszcza za mapą: obrazki';
    if (pineImp) instanced(pineImp.geometry, 0xffffff, far.pine, undefined, false, pineImp.material(), undefined, 120);
    else instanced(models.treeCrownFar(), 0x35703a, far.pine, 'needles', false, undefined, undefined, 120);
    if (leafImp) instanced(leafImp.geometry, 0xffffff, far.leaf, undefined, false, leafFar(leafImp.material()), undefined, 120);
    else instanced(models.leafCrownFar(), 0x55903a, far.leaf, 'leaves', false, undefined, undefined, 120);
  }
  // drobna roślinność i kamienie też są przypisane do pól, żeby znikały pod budynkami i drogami
  // krzaki: z bliska cztery kule po 80 trójkątów, dalej jedna bryła z dwóch prostych kul (40 trójkątów) — krzaków są tysiące
  const bushFar = mergeGeometries([new THREE.IcosahedronGeometry(0.27, 0).translate(0, 0.2, 0).toNonIndexed(), new THREE.IcosahedronGeometry(0.2, 0).translate(0.12, 0.15, 0.05).toNonIndexed()])!;
  label = 'krzewy';
  plant(bushes, instanced(models.bush(), 0x4f8a36, bushes, 'leaves', true, undefined, { farGeo: bushFar, shadowGeo: models.bushShadow() }), null, false);
  // trzciny: wysokie karty z teksturą trzcin i pałek; grzybienie leżą płasko na tafli
  for (const it of reeds) { it.s.y *= 2.6; it.s.x *= 1.1; it.s.z *= 1.1; it.m.compose(it.pos, it.q, it.s); }
  for (const it of lilies) { it.pos.y = -0.072; it.m.compose(it.pos, it.q, it.s); }
  const reedMat = new THREE.MeshStandardMaterial({ map: reedTexture(map.seed), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  reedMat.onBeforeCompile = grassMat.onBeforeCompile;
  reedMat.userData.season = 'grass';
  reedMat.customProgramCacheKey = () => 'reeds';
  label = 'trzcina i grzybienie';
  plant(reeds, instanced(grassCards(), 0xffffff, reeds, undefined, false, reedMat, { hide: 70 }), null, false);
  const lilyGeo = new THREE.CircleGeometry(0.13, 12, 0.35, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2);
  plant(lilies, instanced(lilyGeo, 0x4a7a32, lilies, undefined, false, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 }), { hide: 70 }), null, false);
  label = 'kamyki';
  plant(pebbles, instanced(models.rock(), 0xb8b3a6, pebbles, 'rock', true, undefined, SMALL_LOD), null, false);
  label = 'kępy trawy';
  plant(tufts, instanced(grassCards(), 0xffffff, tufts, undefined, false, grassMat, SMALL_LOD), null, false);
  {
    label = 'kwiaty';
    const mesh = instanced(models.flower(), 0xffffff, flowers, undefined, false, undefined, SMALL_LOD);
    const palette = [0xf4f1e6, 0xf2d24a, 0xb07ad6, 0xe8687a, 0x7fb2e6];
    if (mesh) { flowers.forEach((it, i) => mesh.setColorAt(i, tint.setHex(palette[(it.tile * 7 + i) % palette.length]!))); mesh.instanceMatrix.needsUpdate = true; }
    plant(flowers, mesh, null, false);
  }
  // skały i rudy też znikają, gdy złoże się wyczerpie (bez pniaka)
  label = 'skały i złoża';
  plant(rocks, instanced(models.rock(), 0xc4bfb1, rocks, 'rock'), null, false);
  plant(ores, instanced(models.rock(), 0xa05a36, ores, 'rock'), null, false);
  label = 'pniaki (ukryte)';
  // Pniaki pojawiają się dopiero po ścięciu drzewa. Wcześniej wszystkie stały w scenie z zerową skalą i karta
  // i tak je przetwarzała (ok. 300 tys. trójkątów w zwykłym widoku); teraz rysujemy tylko te już widoczne:
  // jedna siatka, liczba instancji rośnie z każdym ściętym drzewem.
  const stumpMesh = stumpItems.length ? new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 7).translate(0, 0.07, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: pattern('bark'), bumpMap: bump('bark'), bumpScale: 1.2, normalMap: normal('bark') }), stumpItems.length) : null;
  if (stumpMesh) {
    stumpMesh.count = 0;
    stumpMesh.visible = false;
    stumpMesh.frustumCulled = false; // pniaki rozsiane po całej mapie, a jest ich niewiele trójkątów
    stumpMesh.receiveShadow = true;
    cat(stumpMesh, label);
    group.add(stumpMesh);
  }
  const stumpShown = new Set<number>();
  const showStump = (si: number, mm: THREE.Matrix4): void => {
    if (!stumpMesh || stumpShown.has(si)) return;
    stumpShown.add(si);
    const it = stumpItems[si]!;
    const j = stumpMesh.count++;
    stumpMesh.setMatrixAt(j, mm);
    tint.setHex(0x8a6a45).multiplyScalar(it.shade);
    if (it.frost) tint.lerp(FROST, it.frost);
    stumpMesh.setColorAt(j, tint);
    stumpMesh.instanceMatrix.needsUpdate = true;
    if (stumpMesh.instanceColor) stumpMesh.instanceColor.needsUpdate = true;
    stumpMesh.visible = true;
  };
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
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
      if (si !== undefined) showStump(si, m.compose(t.item.pos, t.item.q, t.item.s));
    }
    trees.delete(tile);
  };
  const trunkNear = (x: number, y: number, r: number): boolean => {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      for (const t of trees.get(yy * w + xx) ?? []) {
        if (!trunkItems.has(t.item)) continue;
        const R = r + 0.12 * t.item.s.x;
        if ((t.item.pos.x - ox - x) ** 2 + (t.item.pos.z - oz - y) ** 2 < R * R) return true;
      }
    }
    return false;
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
    if (!sandMat) sandMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, map: pattern('soil'), bumpMap: bump('soil'), bumpScale: 1.2, normalMap: normal('soil'), polygonOffset: true, polygonOffsetFactor: -3 });
    return sandMat;
  };
  // Bruk też nie ma równych brzegów: maska o poszarpanej krawędzi wycina go tak, że kamienie
  // nierówno wchodzą w trawę, a każde pole ma trochę inny odcień (jaśniejsze, ciemniejsze, omszałe).
  // osobny materiał na każdy rodzaj nawierzchni (bruk, dyle): wspólny był tylko, gdy istniał sam bruk
  const paveMats = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const PLANK_DRY = new THREE.Color(0x9a7650);
  // zdjęcie bruku jest bardzo jasne, więc sam materiał ma barwę kamienia polnego (ciepła, przygaszona szarość)
  const PAVE_DRY = new THREE.Color(0xb8b4aa);
  const paveMaterial = (base: THREE.Material, wood = false): THREE.MeshStandardMaterial => {
    const have = paveMats.get(base);
    if (have) return have;
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
    const paveMat = (base as THREE.MeshStandardMaterial).clone();
    paveMat.vertexColors = true;
    paveMat.color.copy(wood ? PLANK_DRY : PAVE_DRY);
    paveMat.polygonOffset = true;
    paveMat.polygonOffsetFactor = -2;
    paveMat.userData.wood = wood;
    paveMats.set(base, paveMat);
    return paveMat;
  };
  // Krawężnik bruku i kamyki przy ścieżkach: ciosane kamienie w osobnym materiale, każdy w trochę innym odcieniu
  let kerbMat: THREE.MeshStandardMaterial | null = null;
  const kerbMaterial = (): THREE.MeshStandardMaterial => {
    if (!kerbMat) kerbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, map: pattern('rock'), normalMap: normal('rock') });
    return kerbMat;
  };
  // bale: zdjęcie desek przycięte tak, że na jednym balu widać jedną deskę ze słojami
  let plankMat: THREE.MeshStandardMaterial | null = null;
  // ciepłe, miodowo-brązowe drewno jak na miniaturze w menu (zdjęcie desek jest szare, barwę daje materiał)
  const PLANK_WOOD = new THREE.Color(0xd09a5c);
  const plankMaterial = (): THREE.MeshStandardMaterial => {
    if (plankMat) return plankMat;
    const src = pattern('planks'), nrm = normal('planks');
    const map = src ? src.clone() : null, nmap = nrm ? nrm.clone() : null;
    for (const t of [map, nmap]) if (t) { t.repeat.set(0.55, 0.3); t.needsUpdate = true; }
    plankMat = new THREE.MeshStandardMaterial({ color: PLANK_WOOD, roughness: 0.85, metalness: 0, map, normalMap: nmap });
    return plankMat;
  };
  const kerbDummy = new THREE.Object3D();
  const kerbTone = new THREE.Color();
  /** Ustawia kamień (krawężnik albo kamyk) w instancji i: środek (x, y) w polach mapy, wymiary, obrót i odcień */
  const placeStone = (im: THREE.InstancedMesh, i: number, x: number, y: number, lift: number, sx: number, sy: number, sz: number, rot: number, tilt: number, r: number): void => {
    kerbDummy.position.set(x + ox, heightAt(x, y) + lift, y + oz);
    kerbDummy.rotation.set(tilt * (((r >>> 3) & 7) / 7 - 0.5), rot, tilt * (((r >>> 6) & 7) / 7 - 0.5));
    kerbDummy.scale.set(sx, sy, sz);
    kerbDummy.updateMatrix();
    im.setMatrixAt(i, kerbDummy.matrix);
    const t = 0.36 + ((r >>> 9) & 31) / 31 * 0.16;
    const moss = (r >>> 15) % 6 === 0 ? 0.06 : 0;
    im.setColorAt(i, kerbTone.setRGB(t * 1.02 - moss, t + moss * 0.6, t * 0.92 - moss));
  };
  // trawa znika pod budynkami i na drogach (bruk całkiem, ścieżka z piasku prawie)
  const builtOn = new Uint8Array(w * h);
  let roadsNow: Uint8Array | null = null;
  const regrass = (t: number): void => { if (grass) grass.setDensity(t, builtOn[t] ? 0 : roadsNow?.[t] ? (roadsNow[t] === 1 ? 0 : 0) : grassBase[t]!); };
  const setRoads = (roads: Uint8Array, materials: THREE.Material[]): void => {
    roadsNow = roads;
    if (grass) for (let t = 0; t < w * h; t++) regrass(t);
    for (const old of roadMeshes) { group.remove(old); old.geometry.dispose(); }
    roadMeshes.length = 0;
    const shade = new THREE.Color();
    for (let kind = 1; kind <= materials.length; kind++) {
      const p3: number[] = [], uv2: number[] = [], uvMask: number[] = [], col3: number[] = [], ditch: number[] = [], ditchUv: number[] = [];
      const soft = kind === 1;
      // droga z dyli: drewniane bale, bez rowu i bez krawężnika z kamieni
      const plank = kind === 3;
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
          // ciepła szarość kamienia polnego zamiast prawie białej tafli
          const tone = 0.5 + (((r >>> 8) & 31) / 31) * 0.12;
          const moss = (r >>> 14) % 5 === 0 ? 0.08 : 0;
          if (plank) { const wt = 0.3 + (((r >>> 8) & 31) / 31) * 0.06; shade.setRGB(wt, wt * 0.82, wt * 0.62); } // ciemna ziemia w szparach między balami
          else shade.setRGB(tone * 1.0 * (1 - moss), tone * 0.98 * (1 + moss * 0.4), tone * 0.94 * (1 - moss * 1.5));
          for (const [qx, qy, u, v] of [[x0, y0, 0, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y1, 1, 1]] as const) {
            p3.push(qx + ox, heightAt(qx, qy) + (soft ? 0.03 : 0.045), qy + oz);
            if (soft) uv2.push(u, v);
            else { uv2.push(plank ? qx / 1.2 : qx / 2.5, plank ? qy / 1.2 : qy / 2.5); uvMask.push(u, v); col3.push(shade.r, shade.g, shade.b); }
          }
        }
      // Rów liczony od strony trawy: każde pole bez bruku dostaje pas wzdłuż boków, którymi dotyka bruku.
      // Gdy bruk jest z dwóch stron (wewnętrzny róg), pasy schodzą się na ukos; przy zewnętrznym rogu bruku
      // rów zakręca łukiem. Dzięki temu nic się nie nakłada nawet wokół pojedynczego pola trawy.
      if (!soft && !plank && SHOW_DITCH) {
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
                      const t = 0.62 + a * 0.3 + pathNoise(px * 6, py * 6) * 0.06 + pathNoise(px * 1.7 + 9, py * 1.7) * 0.05;
                      sand.push(0.6 * t, 0.43 * t, 0.26 * t, Math.min(1, a * 1.08));
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
      const mesh = new THREE.Mesh(g2, soft ? sandMaterial() : paveMaterial(materials[kind - 1]!, plank));
      mesh.receiveShadow = true;
      mesh.renderOrder = soft ? 1 : 0;
      group.add(cat(mesh, 'drogi'));
      roadMeshes.push(mesh);
      const onRoad = (nx: number, ny: number): boolean => nx >= 0 && ny >= 0 && nx < w && ny < h && roads[ny * w + nx] === kind;
      if (plank) {
        // Droga z dyli: prawdziwe bale w poprzek drogi na dwóch legarach, każdy trochę inny
        // (długość, wysokość, przekrzywienie, odcień), a spod szpar prześwituje ciemna ziemia.
        const boards: [number, number, number, number, number, number][] = []; // x, y, długość, obrót, ziarno, wysokość
        const rails: [number, number, number, number][] = []; // x, y, długość, obrót
        const N = 6, BW = 1 / N;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (!onRoad(x, y)) continue;
            // kierunek drogi: wzdłuż X, gdy sąsiedzi są z lewej/prawej, inaczej wzdłuż Y; bale leżą w poprzek
            const horiz = (onRoad(x - 1, y) ? 1 : 0) + (onRoad(x + 1, y) ? 1 : 0) >= (onRoad(x, y - 1) ? 1 : 0) + (onRoad(x, y + 1) ? 1 : 0);
            for (let k = 0; k < N; k++) {
              const r = hash2(x * 8 + k, y * 8 + 3, map.seed ^ 0x3d1f);
              const along = (k + 0.5) * BW;
              const len = 0.94 + ((r & 15) / 15) * 0.12;
              const shift = (((r >>> 4) & 15) / 15 - 0.5) * 0.08;
              const rot = (((r >>> 8) & 15) / 15 - 0.5) * 0.07;
              const hgt = 0.045 + ((r >>> 12) & 7) * 0.003;
              if (horiz) boards.push([x + along, y + 0.5 + shift, len, rot + Math.PI / 2, r, hgt]);
              else boards.push([x + 0.5 + shift, y + along, len, rot, r, hgt]);
            }
            for (const side of [0.2, 0.8]) {
              if (horiz) rails.push([x + 0.5, y + side, 1.02, 0]);
              else rails.push([x + side, y + 0.5, 1.02, Math.PI / 2]);
            }
          }
        if (boards.length) {
          const boardMat = plankMaterial();
          const im = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.12), boardMat, boards.length);
          const tone = new THREE.Color();
          boards.forEach(([bx, by, len, rot, r, hgt], i) => {
            kerbDummy.position.set(bx + ox, heightAt(bx, by) + 0.05 + hgt / 2, by + oz);
            kerbDummy.rotation.set((((r >>> 16) & 7) / 7 - 0.5) * 0.04, rot, (((r >>> 19) & 7) / 7 - 0.5) * 0.03);
            kerbDummy.scale.set(len, hgt, BW * 0.86);
            kerbDummy.updateMatrix();
            im.setMatrixAt(i, kerbDummy.matrix);
            // świeże jaśniejsze, stare szarzejące, czasem ciemny, przegniły bal
            const t = 0.78 + ((r >>> 22) & 31) / 31 * 0.3;
            const old = (r >>> 27) % 6 === 0 ? 0.22 : 0;
            im.setColorAt(i, tone.setRGB(t * (1 - old), t * 0.94 * (1 - old * 0.9), t * 0.86 * (1 - old * 0.7)));
          });
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.castShadow = true;
          im.receiveShadow = true;
          group.add(cat(im, 'drogi'));
          roadMeshes.push(im);
          const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), boardMat, rails.length);
          rails.forEach(([rx, ry, len, rot], i) => {
            kerbDummy.position.set(rx + ox, heightAt(rx, ry) + 0.045, ry + oz);
            kerbDummy.rotation.set(0, rot, 0);
            kerbDummy.scale.set(len, 0.05, 0.09);
            kerbDummy.updateMatrix();
            rm.setMatrixAt(i, kerbDummy.matrix);
            rm.setColorAt(i, tone.setRGB(0.5, 0.36, 0.24));
          });
          rm.instanceMatrix.needsUpdate = true;
          if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
          rm.receiveShadow = true;
          group.add(cat(rm, 'drogi'));
          roadMeshes.push(rm);
        }
      } else if (!soft) {
        // Krawężnik: rząd ciosanych kamieni wzdłuż każdego boku bruku, który styka się z trawą,
        // a za nim pas ubitej, ciemniejszej ziemi, który miękko przechodzi w trawę.
        const kerbs: [number, number, number, number, number][] = []; // x, y, długość, obrót, ziarno
        const shoulder: number[] = [], shoulderUv: number[] = [], shoulderCol: number[] = [];
        const SH = 0.22;
        const band = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number): void => {
          const pts = [[ax, ay, 1], [ax + nx * SH, ay + ny * SH, 0], [bx, by, 1], [bx, by, 1], [ax + nx * SH, ay + ny * SH, 0], [bx + nx * SH, by + ny * SH, 0]] as const;
          for (const [qx, qy, a] of pts) {
            shoulder.push(qx + ox, heightAt(qx, qy) + 0.032, qy + oz);
            shoulderUv.push(qx / 2, qy / 2);
            const t = 0.55 + pathNoise(qx * 5, qy * 5) * 0.06;
            shoulderCol.push(0.46 * t, 0.34 * t, 0.22 * t, a * (0.8 + pathNoise(qx * 2.3, qy * 2.3) * 0.2));
          }
        };
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (!onRoad(x, y)) continue;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
              if (onRoad(x + dx, y + dy)) continue;
              // bok pola od punktu A do B, normalna na zewnątrz (dx, dy)
              const ax = dx === 1 ? x + 1 : x, ay = dy === 1 ? y + 1 : y;
              const bx = dy !== 0 ? x + 1 : ax, by = dx !== 0 ? y + 1 : ay;
              band(ax, ay, bx, by, dx, dy);
              const n = 3;
              for (let k = 0; k < n; k++) {
                const r = hash2(x * 4 + k, y * 4 + (dx + 1) * 2 + dy + 1, map.seed ^ 0x6b3e);
                const f = (k + 0.5) / n + (((r & 15) / 15) - 0.5) * 0.03;
                const inset = 0.075;
                kerbs.push([ax + (bx - ax) * f - dx * inset, ay + (by - ay) * f - dy * inset, 1 / n - 0.018 - ((r >>> 4) & 7) * 0.004, dx !== 0 ? Math.PI / 2 : 0, r]);
              }
            }
          }
        if (kerbs.length) {
          const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.24);
          const im = new THREE.InstancedMesh(geo, kerbMaterial(), kerbs.length);
          kerbs.forEach(([kx, ky, len, rot, r], i) => { const hgt = 0.08 + ((r >>> 20) & 7) * 0.007; placeStone(im, i, kx, ky, 0.03 + hgt / 2, len, hgt, 0.13 + ((r >>> 26) & 3) * 0.012, rot + (((r >>> 23) & 7) / 7 - 0.5) * 0.12, 0.1, r); });
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.castShadow = true;
          im.receiveShadow = true;
          group.add(cat(im, 'drogi'));
          roadMeshes.push(im);
        }
        if (shoulder.length) {
          const sg = new THREE.BufferGeometry();
          sg.setAttribute('position', new THREE.Float32BufferAttribute(shoulder, 3));
          sg.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUv, 2));
          sg.setAttribute('color', new THREE.Float32BufferAttribute(shoulderCol, 4));
          sg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(shoulder.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
          const sm = new THREE.Mesh(sg, sandMaterial());
          (sm.material as THREE.Material).side = THREE.DoubleSide;
          sm.receiveShadow = true;
          sm.renderOrder = 1;
          group.add(cat(sm, 'drogi'));
          roadMeshes.push(sm);
        }
      } else {
        // kamyki przy brzegach ścieżki: kilka na pole, tylko tam, gdzie ścieżka graniczy z trawą
        const pebbles: [number, number, number, number][] = [];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (!onRoad(x, y)) continue;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
              if (onRoad(x + dx, y + dy)) continue;
              const r = hash2(x * 3 + dx + 1, y * 3 + dy + 1, map.seed ^ 0x2e9d);
              const cnt = r & 3;
              for (let k = 0; k < cnt; k++) {
                const rr = hash2(x * 7 + k, y * 5 + dx * 2 + dy, map.seed ^ (0x41 + k));
                const along = ((rr & 255) / 255) * 0.9 + 0.05, out = 0.22 + (((rr >>> 8) & 255) / 255) * 0.22;
                const px = dy !== 0 ? x + along : x + 0.5 + dx * (0.5 + out - 0.2);
                const py = dx !== 0 ? y + along : y + 0.5 + dy * (0.5 + out - 0.2);
                pebbles.push([px, py, 0.03 + ((rr >>> 16) & 15) / 15 * 0.04, rr]);
              }
            }
          }
        if (pebbles.length) {
          const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), kerbMaterial(), pebbles.length);
          pebbles.forEach(([px, py, sz, r], i) => placeStone(im, i, px, py, sz * 0.25, sz * 1.3, sz * 0.7, sz, ((r >>> 4) & 63) / 10, 0.5, r));
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.receiveShadow = true;
          group.add(cat(im, 'drogi'));
          roadMeshes.push(im);
        }
      }
      if (ditch.length) {
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.Float32BufferAttribute(ditch, 3));
        dg.setAttribute('uv', new THREE.Float32BufferAttribute(ditchUv, 2));
        // rów leży płasko na terenie: normalne w górę, a trójkąty widoczne z obu stron niezależnie od kolejności wierzchołków
        dg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(ditch.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        const dm = new THREE.Mesh(dg, ditchMaterial());
        dm.receiveShadow = true;
        group.add(cat(dm, 'drogi'));
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
    trunkNear,
    animate,
    setSky(c: THREE.Color) { wm.sky.value.copy(c); },
    setSun(dir: THREE.Vector3, color: THREE.Color, golden: number) { wm.sunDir.value.copy(dir).normalize(); wm.sunCol.value.copy(color).multiplyScalar(dir.y > 0 ? 0.6 + golden * 0.8 : 0); },
    dig(x: number, y: number, fw: number, fh: number, depth: number) {
      // wykop pod budowę: narożniki działki opuszczone (środek głębiej, brzeg płycej), tylko w obrazie terenu
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      const SLOT_OF: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]];
      for (let ty = Math.max(0, y - 1); ty < Math.min(h, y + fh + 1); ty++)
        for (let tx = Math.max(0, x - 1); tx < Math.min(w, x + fw + 1); tx++)
          for (let k = 0; k < 6; k++) {
            const [dx, dy] = SLOT_OF[k]!;
            const cx = tx + dx, cy = ty + dy;
            if (cx < x || cx > x + fw || cy < y || cy > y + fh) continue;
            const inner = cx > x && cx < x + fw && cy > y && cy < y + fh;
            const o = (ty * w + tx) * 18 + k * 3;
            pos[o + 1] = corner(cx, cy) - depth * (inner ? 1 : 0.45);
          }
      attr.needsUpdate = true;
    },
    updateGrass(x: number, z: number, time: number, camDist?: number) { grass?.update(x, z, time, camDist); },
    grassReach(f: number) { grass?.setReach(f); },
    noGrass(tile: number, on = true) { builtOn[tile] = on ? 1 : 0; regrass(tile); },
    lod(x: number, z: number, reach: number, detail = 1) {
      for (const c of lodChunks) {
        const d = Math.hypot(c.x - x, c.z - z) - 28; // od krawędzi kawałka, nie od środka
        if (c.lod.hide !== undefined) c.mesh.visible = d < c.lod.hide * detail + reach;
        const far = d > 30 * detail + reach;
        // cień z daleka: obrazek drzewa nie rzuca cienia (jak dotąd), krzak z daleka dalej rzuca
        if (c.proxy) c.proxy.visible = c.mesh.visible && !(far && c.lod.farMat);
        if (c.lod.farGeo) {
          const want = far ? c.lod.farGeo : c.near;
          if (c.mesh.geometry !== want) {
            c.mesh.geometry = want;
            // obrazek ma własny materiał i nie rzuca cienia (płaski prostokąt dałby zły cień)
            if (c.lod.farMat) { c.mesh.material = far ? c.lod.farMat : c.nearMat; c.mesh.castShadow = far ? false : c.shadow; }
          }
        }
      }
    },
    setWet(k: number) {
      // błoto: ciemniejsza, błyszcząca ziemia na ścieżkach, mokry połysk bruku, trochę ciemniejsza trawa
      const dryC = new THREE.Color(0xffffff);
      if (sandMat) { sandMat.color.copy(dryC).lerp(new THREE.Color(0x3e2c1c), k * 0.85); sandMat.roughness = 1 - k * 0.7; }
      if (plankMat) { plankMat.roughness = 0.85 - k * 0.45; plankMat.color.copy(PLANK_WOOD).lerp(new THREE.Color(0x6a5a48), k * 0.45); }
      if (kerbMat) { kerbMat.roughness = 0.88 - k * 0.45; kerbMat.color.copy(dryC).lerp(new THREE.Color(0x8a8478), k * 0.4); }
      // mokra nawierzchnia w deszczu: ciemniejsza i bardziej lśniąca
      for (const pm of paveMats.values()) { pm.roughness = 0.9 - k * 0.5; pm.color.copy(pm.userData.wood ? PLANK_DRY : PAVE_DRY).lerp(new THREE.Color(0x6e675c), k * 0.4); }
      const gm = ground.material as THREE.MeshStandardMaterial;
      gm.color.copy(dryC).lerp(new THREE.Color(0x8a917c), k * 0.6);
    },
    wear,
    dispose() {
      // zmiana mapy (także podgląd w menu): zwalniamy wszystko, co ta mapa stworzyła — geometrie, materiały,
      // tekstury robione dla niej (brzeg wody, fale, trawa, trzciny); wspólne zdjęcia i materiał podłoża zostają
      const mats = new Set<THREE.Material>();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && !(mesh.geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry) mesh.geometry.dispose();
        const m = mesh.material;
        if (m) for (const x of Array.isArray(m) ? m : [m]) if (x !== ground.material) mats.add(x);
      });
      for (const m of mats) {
        for (const t of (m.userData.owned as THREE.Texture[] | undefined) ?? []) t.dispose();
        m.dispose();
      }
      grass?.dispose();
      grassTex.dispose();
      reedMat.map?.dispose();
    },
  };
}


/** Trzy skrzyżowane karty kępy trawy (szer. 0,55, wys. 0,34), normalne w górę: kępa świeci jak ziemia pod nią */
function grassCards(): THREE.BufferGeometry {
  const P: number[] = [], U: number[] = [], N: number[] = [], I: number[] = [];
  const W = 0.55, H = 0.34;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI + 0.3, cx = Math.cos(a) * W / 2, cz = Math.sin(a) * W / 2;
    const b = P.length / 3;
    // lekko odchylone od pionu na zewnątrz, żeby z góry kępa nie znikała
    P.push(-cx, 0, -cz, cx, 0, cz, cx * 1.15, H, cz * 1.15 + 0.03, -cx * 1.15, H, -cz * 1.15 + 0.03);
    U.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) N.push(0, 1, 0);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex(I);
  return g;
}

/**
 * Tekstura kępy: ok. 220 źdźbeł malowanych krzywymi, zwężających się ku górze, w różnych odcieniach zieleni,
 * część zżółkła i sucha, kilka kłosków traw. Tło przezroczyste. Rysowana raz, 512×512.
 */
function grassCardTexture(seed: number): THREE.Texture {
  const N = typeof document === 'undefined' ? 0 : 512;
  if (!N) return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const blades = 220;
  for (let i = 0; i < blades; i++) {
    // dalsze źdźbła (rysowane najpierw) ciemniejsze, bliższe jaśniejsze
    const depth = i / blades;
    const x0 = N * (0.5 + (rnd() - 0.5) * 0.85 * (0.6 + rnd() * 0.4));
    const hgt = N * (0.35 + rnd() * 0.62) * (1 - Math.abs(x0 / N - 0.5) * 0.9);
    const lean = (x0 / N - 0.5) * N * 0.55 + (rnd() - 0.5) * N * 0.25;
    const w = N * (0.008 + rnd() * 0.012);
    const dry = rnd() < 0.14;
    const hue = dry ? 48 + rnd() * 10 : 78 + rnd() * 30;
    const sat = dry ? 35 + rnd() * 20 : 38 + rnd() * 30;
    const light = (dry ? 42 : 22) + depth * 22 + rnd() * 8;
    const x1 = x0 + lean, y1 = N - hgt;
    const cxp = x0 + lean * 0.25, cyp = N - hgt * 0.6;
    const grad = ctx.createLinearGradient(0, N, 0, y1);
    grad.addColorStop(0, `hsl(${hue - 6}, ${sat}%, ${light * 0.55}%)`);
    grad.addColorStop(0.6, `hsl(${hue}, ${sat}%, ${light}%)`);
    grad.addColorStop(1, `hsl(${hue - (dry ? 0 : 18)}, ${sat + 5}%, ${light + 12}%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 - w, N);
    ctx.quadraticCurveTo(cxp - w * 0.7, cyp, x1, y1);
    ctx.quadraticCurveTo(cxp + w * 0.7, cyp, x0 + w, N);
    ctx.closePath();
    ctx.fill();
    // jaśniejszy nerw środkiem źdźbła
    if (w > N * 0.012) {
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light + 14}%, 0.45)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, N); ctx.quadraticCurveTo(cxp, cyp, x1, y1); ctx.stroke();
    }
    // kłosek trawy na niektórych wysokich źdźbłach
    if (hgt > N * 0.75 && rnd() < 0.25) {
      ctx.fillStyle = `hsl(${45 + rnd() * 10}, 35%, ${45 + rnd() * 15}%)`;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(x1 + (rnd() - 0.5) * 6, y1 + k * 5, 2.2, 4.5, (rnd() - 0.5) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}


/** Tekstura trzcin: proste, wysokie, oliwkowe źdźbła i liście, kilka brązowych pałek na sztywnych łodygach */
function reedTexture(seed: number): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  let s = (seed ^ 0x51ed27) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 70; i++) {
    const depth = i / 70;
    const x0 = N * (0.2 + rnd() * 0.6), hgt = N * (0.55 + rnd() * 0.43), lean = (rnd() - 0.5) * N * 0.18, wd = N * (0.01 + rnd() * 0.012);
    const hue = 62 + rnd() * 25, l = 18 + depth * 20 + rnd() * 6;
    ctx.fillStyle = `hsl(${hue}, ${30 + rnd() * 20}%, ${l}%)`;
    ctx.beginPath();
    ctx.moveTo(x0 - wd, N);
    ctx.quadraticCurveTo(x0 + lean * 0.3 - wd * 0.5, N - hgt * 0.6, x0 + lean, N - hgt);
    ctx.quadraticCurveTo(x0 + lean * 0.3 + wd * 0.5, N - hgt * 0.6, x0 + wd, N);
    ctx.fill();
    // pałka: brązowy walec u szczytu sztywnej łodygi
    if (rnd() < 0.18) {
      const tx = x0 + lean * 0.5, ty = N - hgt * 0.85;
      ctx.fillStyle = `hsl(25, 45%, ${20 + rnd() * 10}%)`;
      ctx.beginPath(); ctx.ellipse(tx, ty, 3.2, 11, lean / N, 0, Math.PI * 2); ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

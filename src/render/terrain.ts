import { touch } from './touch';
import * as THREE from 'three';
import { propGeometry, propMaterial } from './props';
import { TEST } from '../testmode';
import { cat } from './cat';

/** Kwiaty na łąkach — na razie wyłączone (19.10.2026); `true` przywraca stare kwiatki z models.flower() */
const FLOWERS = false;

/** Daleki obrazek drzewa liściastego: jesienią rudzieje, zimą szarzeje (bez zwijania korony — obrazek ma pień) */
const leafFar = <M extends THREE.Material>(m: M): M => { m.userData.season = 'leafFar'; return m; };
import { createNoise2D } from 'simplex-noise';
import { rng } from './craft';
import { TERRAIN, Terrain } from '../data/terrain';
import type { GameMap } from '../sim/map';
import { hash2 } from '../sim/rng';
import { fernTexture } from './foliage';
import { bushKinds, kindsOf, waterPlants, type BushKind, type TreeKind } from './forest';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModelFactory } from './models';
import { bump, normal, pattern } from './textures';
import { cloudShade, groundGrassTexture, groundMaterial, waterMaterial, WATER_Y } from './ground';
import { WaterReflection } from './waterReflect';
import { SHADOW_LAYER, shadowProxyMaterial } from './shadowlayer';
import { createGrassField, type GrassField } from './grass';
import { buildHighMist, type Atmosphere, type HighMist } from './highmist';
import { buildStreams, type Streams } from './streams';

const HEIGHT_SCALE = 0.03;
const smoothstep = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const HAZE = 0xcfc9b4;

/** Wysokość pola w świecie 3D. Woda leży poniżej zera, góry wyrastają stromo. */
function tileHeight(map: GameMap, x: number, y: number, waterLevel: number, shelf?: Float32Array): number {
  const cx = Math.min(map.width - 1, Math.max(0, x));
  const cy = Math.min(map.height - 1, Math.max(0, y));
  const e = map.elevation[cy * map.width + cx]!;
  const t = map.tiles[cy * map.width + cx] as Terrain;
  if (t === Terrain.Mountain) return 1.3 + (e - 170) * 0.15;
  const h = (e - waterLevel) * HEIGHT_SCALE;
  // dno jeziora: przy brzegu łagodna półka (płycizna, przez którą widać dno), dalej coraz głębiej aż do dna z mapy
  // (jeziora z mapy są płytkie, ok. 60 cm, więc środek pogłębiamy według odległości od brzegu: tam dna już nie widać)
  if (t === Terrain.Water) return shelf ? Math.max(-2.6, Math.min(shelf[cy * map.width + cx]!, Math.min(h, -0.25) * 0.5 - 0.15)) : Math.min(h, -0.25);
  if (t === Terrain.Ford) return -0.17; // bród: dno tuż pod taflą, woda po kostki
  // ląd w większości płaski: łagodne falowanie, a wyraźne pagórki tylko tam, gdzie teren jest naprawdę wysoko
  const d = e - waterLevel;
  if (map.gen >= 2) {
    // generator 2: wzgórza rosną łagodnie (miękkie kolano zamiast stromej ściany), niższe i szersze
    const x = Math.max(0, d - 95);
    return 0.12 + Math.max(0, d) * 0.004 + ((x * x) / (x + 60)) * 0.014;
  }
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
  /** Drzewo posadzone przez leśniczego: wzrost 0..1 (0 = brak drzewka, 1 = dorosłe drzewo) */
  grow(tile: number, k: number): void;
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
  /** Odbicie lustrzane w wodzie: rysowane raz na klatkę przed obrazem (on = false: tańsze odbicie nieba) */
  reflectWater(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, on: boolean): void;
  /** Pogoda i pora dnia dla mgły w dolinach, chmur przy szczytach i strumieni */
  setAtmosphere(a: Atmosphere): void;
  /** Kierunek ku słońcu (świat) i jego barwa: odblaski na wodzie; golden = złota godzina (0..1) */
  setSun(dir: THREE.Vector3, color: THREE.Color, golden: number): void;
  /** Wykop pod budowę (depth 0 = zasypany): opuszcza teren działki tylko w obrazie */
  dig(x: number, y: number, w: number, h: number, depth: number): void;
  /** Wyrównuje teren pod działką do wysokości y (nasyp albo wkop), z łagodnym przejściem na 2 pola dookoła */
  level(x: number, y: number, w: number, h: number, height: number): void;
  /** Poziomy szczegółów wokół punktu (x, z); reach poszerza zasięg, gdy kamera jest daleko */
  /** `detail` (0–1) skraca odległości szczegółów na słabszych poziomach grafiki (1 = pełne) */
  lod(x: number, z: number, reach: number, detail?: number): void;
  /** Roślinność do wspólnych pul na tę klatkę: kawałki w kadrze i w zasięgu mapy cieni */
  cullVegetation(view: THREE.Frustum, shadow: THREE.Frustum | null): void;
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

  // Półka przy brzegu: odległość pola wody od lądu (w polach) wyznacza najmniejszą głębokość dna. Pierwsze pole
  // to płycizna (ok. 20 cm przy samym brzegu), każde następne ok. 30 cm głębiej, z losowymi płyciznami i dołkami, więc linia, za którą
  // dna już nie widać, faluje zamiast biec równo z brzegiem. Głęboki środek zostaje taki, jak z mapy.
  const shelf = new Float32Array(w * h).fill(-99);
  {
    const sd = new Int16Array(w * h).fill(-1);
    const q: number[] = [];
    for (let i = 0; i < w * h; i++) if (map.tiles[i] !== Terrain.Water) { sd[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]!, x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (sd[j]! >= 0) continue;
        sd[j] = sd[i]! + 1; q.push(j);
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (map.tiles[i] !== Terrain.Water) continue;
      const x = i % w, y = (i - x) / w, d = sd[i]!;
      const n = ((hash2(x >> 1, y >> 1, map.seed ^ 0x5a17) & 255) / 255 - 0.5) * 0.22 + ((hash2(x, y, map.seed ^ 0x2c3) & 255) / 255 - 0.5) * 0.08;
      shelf[i] = Math.min(-0.28, -0.3 - 0.36 * (d - 1) - 0.05 * (d - 1) * (d - 1) + (d > 1 ? n * 1.6 : 0)); // pole przy lądzie -0,3: narożnik wspólny z lądem wypada tuż pod taflą, więc woda sięga brzegu pola, a nie kończy się w połowie
    }
  }
  // wysokości narożników = średnia z czterech sąsiednich pól
  const corners = new Float32Array((w + 1) * (h + 1));
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++)
      corners[y * (w + 1) + x] =
        (tileHeight(map, x - 1, y - 1, waterLevel, shelf) + tileHeight(map, x, y - 1, waterLevel, shelf) +
          tileHeight(map, x - 1, y, waterLevel, shelf) + tileHeight(map, x, y, waterLevel, shelf)) / 4;
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
    [Terrain.Water]: [0.8, 0.8, 0.75], [Terrain.Mountain]: [1, 1, 1], [Terrain.Ford]: [0.85, 0.85, 0.8],
  };
  const tileColor = (x: number, y: number): THREE.Color =>
    tmp.setHex(TERRAIN[map.tiles[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as Terrain].color);
  // Plaże: część jezior (losowo, ale zawsze te największe) ma piaszczysty brzeg szeroki na 1–2 pola, piasek schodzi pod wodę
  const sandTile = new Float32Array(w * h);
  {
    const lake = new Int32Array(w * h).fill(-1);
    const sizes: number[] = [], river: boolean[] = [];
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
      // rzeka (długa i wąska: w swoim prostokącie zajmuje mało miejsca) ma brzeg z trawą i trzciną, nie plażę
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      for (const j of q) { const x = j % w, y = (j - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      river.push(q.length > 40 && q.length < (x1 - x0 + 1) * (y1 - y0 + 1) * 0.22);
    }
    // brzegi przeplatają się: odcinek piaszczystej plaży, dalej trzciny i krzaki, potem znów zatoczka z piaskiem;
    // „plażowe” jeziora mają piasku więcej, pozostałe tylko pojedyncze zatoczki
    const biggest = sizes.indexOf(Math.max(...sizes.map((sz, id) => (river[id] ? 0 : sz)), 0));
    // bez pierścieni piasku dookoła jeziora: brzeg to trawa, trzcina i kamyki, a piasek tylko w kilku małych zatoczkach
    void biggest;
    const bias = sizes.map((sz, id) => (river[id] ? -0.42 : sz > 6 && (hash2(id, sz, map.seed ^ 0x5a4d) & 3) < 2 ? -0.16 : -0.3));
    for (let i = 0; i < w * h; i++) {
      const id = lake[i]!;
      if (id < 0 || map.river?.[i]) continue; // nad rzeką trawa i trzcina, nie plaża
      const x = i % w, y = (i - x) / w;
      const bf = smoothstep(-0.05, 0.25, nz(x / 8 + 31, y / 8 - 17) + bias[id]!);
      if (bf <= 0.02) continue;
      // plaża wąska (pas 1–2 pól przy wodzie), żeby nie wyglądała jak wklejona łata piasku
      const reach = 1;
      sandTile[i] = Math.max(sandTile[i]!, bf);
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = map.tiles[ny * w + nx];
        if (t !== Terrain.Grass && t !== Terrain.Water) continue;
        const rr = Math.max(Math.abs(dx), Math.abs(dy));
        const v = (rr === 0 ? 1 : 0.55) * bf; // piasek tuż przy wodzie, w trawę przechodzi miękko
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
  // plansza tylko odbiera cień: pagórki są łagodne i cienia na siebie praktycznie nie rzucają, a rysowanie całej
  // planszy (74–148 tys. trójkątów) do mapy cieni przy każdym odświeżeniu było jednym z większych kosztów karty;
  // góry za mapą to osobna siatka i nie są tu ruszane
  ground.castShadow = false;
  group.add(cat(ground, 'teren'));

  // Woda: dwie warstwy drobnych fal przesuwające się w różne strony, lekko przejrzysta, z połyskiem słońca
  const ripples = bump('water')?.clone() ?? null;
  if (ripples) { ripples.repeat.set(w / 14, h / 14); ripples.needsUpdate = true; }
  // woda (jeziora i morze za mapą) powstaje niżej, gdy znany jest już teren za mapą
  let wm!: ReturnType<typeof waterMaterial>;
  const reflection = new WaterReflection(WATER_Y);
  let hasWater = false;
  let mistFx: HighMist | null = null, streams: Streams | null = null, fxTime = 0;

  // Ryby: pływają po małych okręgach tuż pod powierzchnią, co jakiś czas któraś wyskakuje
  const waterTiles: number[] = [];
  // ryby tylko tam, gdzie całe ich kółko (do ok. 0,6 pola od środka pola) ma dno głębiej niż 40 cm pod taflą —
  // inaczej pływały w ziemi przy brzegu i na płyciznach
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== Terrain.Water) continue;
    const x = i % w, y = (i - x) / w;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    let deep = true;
    for (let cy = y - 1; cy <= y + 2 && deep; cy++) for (let cx = x - 1; cx <= x + 2; cx++) if (corner(cx, cy) > WATER_Y - 0.4) { deep = false; break; }
    if (deep) waterTiles.push(i);
  }
  const fishCount = Math.min(90, Math.floor(waterTiles.length / 5));
  // ryba z paczki (tools/models/props_import.py, wersja z daleka sprawdzona obok oryginału), długość ok. 0,42 pola
  const fishGeo = propGeometry('fish', true).clone().scale(0.42, 0.42, 0.42);
  const fishMesh = fishCount ? new THREE.InstancedMesh(fishGeo, propMaterial('fish'), fishCount) : null;
  const fish: { x: number; z: number; r: number; speed: number; phase: number }[] = [];
  if (fishMesh) {
    const fc = new THREE.Color();
    for (let i = 0; i < fishCount; i++) {
      const rr = hash2(i * 31, i * 17 + 5, map.seed ^ 0x1f123bb5);
      const tile = waterTiles[rr % waterTiles.length]!;
      fish.push({ x: (tile % w) + 0.5 + ox, z: Math.floor(tile / w) + 0.5 + oz, r: 0.25 + ((rr >>> 8) & 15) / 40, speed: 0.6 + ((rr >>> 12) & 15) / 20, phase: ((rr >>> 16) & 255) / 40 });
      fishMesh.setColorAt(i, fc.setHex([0xffffff, 0xeef0e6, 0xdfe3d6, 0xf4efe2][(rr >>> 24) % 4]!)); // lekkie różnice odcienia, barwa z tekstury
    }
    group.add(cat(fishMesh, 'ryby'));
  }
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fe = new THREE.Euler();
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3(1, 1, 1);
  const animate = (time: number): void => {
    fxTime = time;
    streams?.animate(time);
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
    touch(fishMesh);
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
    far.position.y = -4; // pod najgłębszym dnem (morze do -3,5): wyżej przykrywała dno jezior ciemnozieloną płytą
    group.add(cat(far, 'teren za mapą'));
  }

  // Woda na całym obszarze (plansza i teren za nią): jeziora na planszy i morze za mapą jedną taflą.
  // Mapa głębokości (4 próbki na pole): tafla minus dno w metrach, liczona dokładnie jak narysowana siatka terenu
  // (trójkąty dzielone przekątną (1,0)–(0,1)), więc przejrzystość i linia brzegu zgadzają się z terenem co do centymetra.
  {
    const EW = w + 2 * D, EH = h + 2 * D, SS = 4, SW = EW * SS, SH = EH * SS, CW = EW + 1;
    const oc = new Float32Array(CW * (EH + 1));
    for (let y = 0; y <= EH; y++) for (let x = 0; x <= EW; x++) {
      const X = x - D, Y = y - D;
      oc[y * CW + x] = X >= 0 && Y >= 0 && X <= w && Y <= h ? corner(X, Y) : outerH(X, Y);
    }
    const depthData = new Uint16Array(SW * SH);
    let anyWater = false;
    for (let sy = 0; sy < SH; sy++) {
      const fy = (sy + 0.5) / SS, iy = Math.min(EH - 1, Math.floor(fy)), ty = fy - iy;
      for (let sx = 0; sx < SW; sx++) {
        const fx = (sx + 0.5) / SS, ix = Math.min(EW - 1, Math.floor(fx)), tx = fx - ix;
        const k = iy * CW + ix;
        let hh: number;
        if (tx + ty <= 1) { const c0 = oc[k]!; hh = c0 + (oc[k + 1]! - c0) * tx + (oc[k + CW]! - c0) * ty; }
        else { const c3 = oc[k + CW + 1]!; hh = c3 + (oc[k + CW]! - c3) * (1 - tx) + (oc[k + 1]! - c3) * (1 - ty); }
        const dep = Math.max(-1, Math.min(8, WATER_Y - hh));
        if (dep > 0) anyWater = true;
        depthData[sy * SW + sx] = THREE.DataUtils.toHalfFloat(dep);
      }
    }
    // G: ta sama głębokość rozmyta (promień ok. 1,5 pola) — do przejrzystości, R zostaje dokładne — do linii brzegu
    const raw = new Float32Array(SW * SH);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.max(0, THREE.DataUtils.fromHalfFloat(depthData[i]!));
    const R = 6, tmpB = new Float32Array(raw.length), sm = new Float32Array(raw.length);
    for (let y = 0; y < SH; y++) { let acc = 0; const row = y * SW; for (let x = -R; x <= R; x++) acc += raw[row + Math.min(SW - 1, Math.max(0, x))]!; for (let x = 0; x < SW; x++) { tmpB[row + x] = acc / (2 * R + 1); acc += raw[row + Math.min(SW - 1, x + R + 1)]! - raw[row + Math.max(0, x - R)]!; } }
    for (let x = 0; x < SW; x++) { let acc = 0; for (let y = -R; y <= R; y++) acc += tmpB[Math.min(SH - 1, Math.max(0, y)) * SW + x]!; for (let y = 0; y < SH; y++) { sm[y * SW + x] = acc / (2 * R + 1); acc += tmpB[Math.min(SH - 1, y + R + 1) * SW + x]! - tmpB[Math.max(0, y - R) * SW + x]!; } }
    const rg = new Uint16Array(SW * SH * 2);
    for (let i = 0; i < SW * SH; i++) { rg[i * 2] = depthData[i]!; rg[i * 2 + 1] = THREE.DataUtils.toHalfFloat(sm[i]!); }
    const depthTex = new THREE.DataTexture(rg, SW, SH, THREE.RGFormat, THREE.HalfFloatType);
    depthTex.magFilter = THREE.LinearFilter; depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
    hasWater = anyWater;
    wm = waterMaterial(depthTex, EW, EH, reflection.uniforms);
    const waterMat = wm.mat;
    if (TEST) { waterMat.bumpMap = ripples; waterMat.bumpScale = 0.7; }
    // tafla sięga daleko za obszar (morze aż po horyzont); poza nim tekstura głębokości powtarza wartości z krawędzi
    const water = new THREE.Mesh(new THREE.PlaneGeometry(EW + 600, EH + 600), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    water.receiveShadow = true;
    group.add(cat(water, 'woda'));
    const shallow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x2b281a, roughness: 1 }) /* muł pod mętną wodą */);
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.y = -3.6; // tylko łata pod dnem — na -0,32 przykrywała głębsze dno jezior
    group.add(cat(shallow, 'woda'));
  }

  // gęsta trawa: łąka pełna, las i złoża rzadko, woda i góry bez trawy
  const grassBase = new Float32Array(w * h);
  for (let t = 0; t < w * h; t++) {
    const tt = map.tiles[t] as Terrain;
    grassBase[t] = (tt === Terrain.Grass ? 1 : tt === Terrain.Forest ? 0.35 : tt === Terrain.Stone ? 0.25 : tt === Terrain.Iron ? 0.1 : 0) * (sandTile[t]! > 0.12 ? 0 : 1); // na piasku plaży trawy nie ma wcale
  }
  // bujność przy wodzie: 1 na brzegu, maleje do zera ok. 4 pola od wody (BFS po polach)
  const grassLush = new Float32Array(w * h);
  {
    const LUSH_R = 4;
    const d = new Int16Array(w * h).fill(LUSH_R + 1);
    let q: number[] = [];
    for (let t = 0; t < w * h; t++) if (map.tiles[t] === Terrain.Water || map.tiles[t] === Terrain.Ford) { d[t] = 0; q.push(t); }
    for (let r = 1; r <= LUSH_R && q.length; r++) {
      const nq: number[] = [];
      for (const t of q) {
        const x = t % w, y = (t / w) | 0;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (d[n]! > r) { d[n] = r; nq.push(n); }
        }
      }
      q = nq;
    }
    for (let t = 0; t < w * h; t++) grassLush[t] = d[t]! === 0 ? 0 : Math.max(0, 1 - (d[t]! - 1) / LUSH_R);
  }
  const grass: GrassField | null = TEST ? null : createGrassField(w, h, corners, grassBase, groundGrassTexture(), grassLush);
  if (grass) group.add(cat(grass.mesh, 'trawa (dywan)'));
  // leśne ścieżki z generatora mapy: wydeptana ziemia, najmocniej tam, gdzie spotykają się dwa pola ścieżki (środek dróżki),
  // słabiej na brzegach, z lekką nierównością — wygląda jak dróżka chodzona od lat, a nie jak wyrysowana droga
  if (map.trails) {
    for (let cy = 1; cy < h; cy++) for (let cx = 1; cx < w; cx++) {
      const n = map.trails[(cy - 1) * w + cx - 1]! + map.trails[(cy - 1) * w + cx]! + map.trails[cy * w + cx - 1]! + map.trails[cy * w + cx]!;
      if (!n) continue;
      const j = (hash2(cx, cy, map.seed ^ 0x7e11) & 15) / 100;
      // tylko narożniki w środku dróżki (dwa pola ścieżki obok siebie), brzeg ledwo przetarty: ścieżka na ok. jedno pole, nie na dwa
      wear(cx, cy, n >= 3 ? 0.5 + j : n === 2 ? 0.4 + j : 0.06, 0.55);
    }
  }
  const yAxis = new THREE.Vector3(0, 1, 0);
  // wysokość dokładnie taka, jak na narysowanej siatce ziemi: pole to dwa trójkąty dzielone przekątną (1,0)–(0,1).
  // Wcześniej liczona dwuliniowo — na zboczach różnica sięgała pół metra, więc drzewa, ludzie i graty wisiały nad
  // ziemią albo w nią wchodziły.
  const heightAt = (fx: number, fy: number): number => {
    const x = Math.max(0, Math.min(w - 0.001, fx)), y = Math.max(0, Math.min(h - 0.001, fy));
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    if (tx + ty <= 1) { const a = corner(ix, iy); return a + (corner(ix + 1, iy) - a) * tx + (corner(ix, iy + 1) - a) * ty; }
    const d = corner(ix + 1, iy + 1);
    return d + (corner(ix, iy + 1) - d) * (1 - tx) + (corner(ix + 1, iy) - d) * (1 - ty);
  };
  /** Spadek terenu w punkcie (metry na pole) — o tyle zagłębiamy drzewa, żeby pień nie wisiał nad zboczem od dołu */
  const slopeOf = (fx: number, fy: number): number => Math.hypot(heightAt(fx + 0.35, fy) - heightAt(fx - 0.35, fy), heightAt(fx, fy + 0.35) - heightAt(fx, fy - 0.35)) / 0.7;

  // Mgła w dolinach, chmury przy szczytach, strumienie i wodospady z gór (bez trybu testowego: tam teren jest płaski)
  if (!TEST) {
    const anyH = (X: number, Y: number): number => (X >= 0 && Y >= 0 && X <= w && Y <= h ? heightAt(X, Y) : outerH(X, Y));
    // wysokość dokładnie taka, jak na narysowanej siatce (trójkąty dzielone przekątną (1,0)–(0,1)), a nie dwuliniowa:
    // na stromym zboczu różnica sięga pół metra i strumień chowałby się pod skałą
    const cornerAny = (X: number, Y: number): number => (X >= 0 && Y >= 0 && X <= w && Y <= h ? corner(X, Y) : outerH(X, Y));
    const meshH = (fx: number, fy: number): number => {
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      if (tx + ty <= 1) { const a = cornerAny(ix, iy); return a + (cornerAny(ix + 1, iy) - a) * tx + (cornerAny(ix, iy + 1) - a) * ty; }
      const d = cornerAny(ix + 1, iy + 1);
      return d + (cornerAny(ix, iy + 1) - d) * (1 - tx) + (cornerAny(ix + 1, iy) - d) * (1 - ty);
    };
    const STEP = 2, x0 = -D, z0 = -D, nx = Math.floor((w + 2 * D) / STEP) + 1, ny = Math.floor((h + 2 * D) / STEP) + 1;
    const data = new Float32Array(nx * ny);
    const wet = new Uint8Array(nx * ny);
    // las i skały wokół węzła (0..4 pól z kratki 2×2): tam poranny opar nie leży płachtą, tylko kończy się delikatnym paskiem
    const wood = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const X = x0 + i * STEP, Y = z0 + j * STEP;
      data[j * nx + i] = anyH(X, Y);
      if (X >= 0 && Y >= 0 && X < w && Y < h) { const t = map.tiles[Y * w + X]; wet[j * nx + i] = t === Terrain.Water || t === Terrain.Ford ? 1 : 0; }
      let c = 0;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const XX = X + dx, YY = Y + dy;
        const t = XX >= 0 && YY >= 0 && XX < w && YY < h ? map.tiles[YY * w + XX] : Terrain.Mountain;
        if (t === Terrain.Forest || t === Terrain.Mountain) c++;
      }
      wood[j * nx + i] = c;
    }
    mistFx = buildHighMist({ data, nx, ny, x0: x0 + ox, z0: z0 + oz, step: STEP, wet, wood }, { cx: ox + w / 2, cz: oz + h / 2, hw: w / 2, hh: h / 2 }, map.seed);
    group.add(mistFx.group);
    const tileOf = (x: number, y: number): Terrain => map.tiles[y * w + x] as Terrain;
    streams = buildStreams({
      height: meshH,
      rock: (x, y) => x < 0 || y < 0 || x >= w || y >= h || tileOf(x, y) === Terrain.Mountain,
      water: (x, y) => tileOf(x, y) === Terrain.Water || tileOf(x, y) === Terrain.Ford,
      w, h, ox, oz, seed: map.seed,
    }, mistFx.noise);
    group.add(streams.group);
    mistFx.addSpray(streams.sprays);
  }

  // obiekty na polach: jedna siatka instancjonowana na rodzaj
  type Item = { m: THREE.Matrix4; shade: number; tile: number; pos: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; frost?: number };
  const FROST = new THREE.Color(0xdfe7ea);
  const pines: Item[] = [], leafy: Item[] = [], rocks: Item[] = [], ores: Item[] = [], tufts: Item[] = [];
  const ferns: Item[] = [], deadwood: Item[] = [];
  // młode jodły w podroście (gotowy model z Poly Haven): w głębi lasu pod starymi drzewami, rzadziej na skraju
  const firs: Item[] = [];
  // odległość od skraju lasu (w polach, do 3): skraj rzadszy i młodszy, w głębi stary las z paprociami i opadłymi gałęziami
  const forestDepth = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (map.tiles[i] !== Terrain.Forest) continue;
    let d = 3;
    for (let dy = -2; dy <= 2 && d > 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const tt = map.tiles[ny * w + nx];
      if (tt === Terrain.Forest || tt === Terrain.Mountain) continue;
      d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
    }
    forestDepth[i] = d;
  }
  /** Pole łąki tuż przy lesie (jedno pole od drzew): tu las „wychodzi” na łąkę młodymi drzewkami i krzakami */
  const besideForest = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && map.tiles[ny * w + nx] === Terrain.Forest) return true;
    }
    return false;
  };
  // pola przy zamkach zostają czyste (miejsce pod osadę): ani samotnych drzew, ani murków
  const peak = (x: number, y: number): boolean => {
    const e = map.elevation[y * w + x]!;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && map.elevation[ny * w + nx]! >= e + ((dy * w + dx) > 0 ? 0 : 1)) return false;
    }
    return true;
  };
  /** Odległość pola od najbliższej skały gór (1–3 pola, 0 = dalej): u podnóża leży rumowisko, które spadło ze zboczy */
  const rockFoot = (x: number, y: number): number => {
    let best = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || map.tiles[ny * w + nx] !== Terrain.Mountain) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (!best || d < best) best = d;
    }
    return best;
  };
  const farFromKeeps = (x: number, y: number): boolean => map.starts.every((st) => Math.hypot(st.x - x, st.y - y) > 16);
  const bushes: Item[] = [], pebbles: Item[] = [], flowers: Item[] = [], reeds: Item[] = [], lilies: Item[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const put = (list: Item[], x: number, y: number, n: number, scaleBase: number, spread = 0.7, sx = 0, sz = 0): void => {
    const r = hash2(x * 7 + n, y * 13 - n, map.seed ^ 0xabcdef);
    const jx = ((r & 255) / 255 - 0.5) * spread + sx;
    const jz = (((r >>> 8) & 255) / 255 - 0.5) * spread + sz;
    const s = scaleBase * (0.75 + (((r >>> 16) & 255) / 255) * 0.6);
    q.setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI * 2);
    const pos = new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x + 0.5 + jx, y + 0.5 + jz), y + 0.5 + jz + oz);
    // drzewa w prawdziwej skali względem ludzi: wyraźnie wyższe od chłopa (korona nad głową), trochę szersze
    const tree = list === pines || list === leafy;
    // pień i krzak stoją w ziemi, a nie na niej: na zboczu dolna strona pnia zagłębiona o spadek × promień podstawy
    if (tree || list === firs || list === bushes) pos.y -= 0.04 + slopeOf(x + 0.5 + jx, y + 0.5 + jz) * 0.3 * s;
    // drzewa z Poly Haven mają prawdziwe proporcje: skala jednakowa, tylko wysokość trochę się waha
    const scale = new THREE.Vector3(s, s * (0.9 + ((r >>> 12) & 15) / 60) * (tree ? 1.05 : 1), s);
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
        // przy leśnej ścieżce: jedno drzewo, mniejsze i odsunięte od dróżki, żeby korony nie zakrywały przecinki
        let ex = 0, ez = 0;
        if (map.trails) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && map.trails[ny * w + nx]) { ex -= dx; ez -= dy; }
        }
        if (ex || ez) {
          const l = Math.hypot(ex, ez) || 1;
          put((r >>> 3) % 3 === 0 ? leafy : pines, x, y, 0, age < 8 ? 0.55 : 0.8, 0.3, (ex / l) * 0.32, (ez / l) * 0.32);
          if ((r >>> 17) % 3 === 0) put(bushes, x, y, 4, 0.7, 0.5);
          continue;
        }
        // jedno drzewo na pole (pole to ok. 3 m): pnie stoją w naturalnych odstępach, korony zwierają się wysoko nad głowami;
        // las w różnym wieku — rzadko stary olbrzym, najwięcej dojrzałych, do tego młode i podrost, a między nimi krzaki
        const depth = forestDepth[y * w + x]!;
        if (depth <= 1) {
          // skraj lasu: młodsze i niższe drzewa (częściej liściaste, które lubią światło), gęsto krzaki — las nie urywa się ścianą
          const edgeSize = age < 3 ? 1 : age < 12 ? 0.75 : 0.5;
          put((r >>> 3) % 2 === 0 ? leafy : pines, x, y, 0, edgeSize, 0.8);
          if ((r >>> 17) % 3 !== 0) put(bushes, x, y, 4, 0.8 + ((r >>> 21) & 3) * 0.1, 0.95);
          if ((r >>> 23) % 3 === 0) put(ferns, x, y, 6, 0.9, 0.95);
          if ((r >>> 28) % 14 === 0) put(firs, x, y, 10, 0.55, 0.9);
          continue;
        }
        const size = age === 0 ? 1.55 : age < 3 ? 1.25 : age < 12 ? 1 : age < 17 ? 0.7 : 0.45;
        // w głębi starszy las: drzewa dorastają do pełnej wielkości
        put((r >>> 3) % 4 === 0 ? leafy : pines, x, y, 0, size * (depth >= 3 ? 1.08 : 0.95), age === 0 ? 0.25 : 0.75);
        if ((r >>> 17) % 4 === 0 || age >= 17) put(bushes, x, y, 4, 0.75 + ((r >>> 21) & 3) * 0.1, 0.95);
        // podszyt: paprocie w cieniu koron, tu i ówdzie opadła gałąź
        if ((r >>> 23) % 5 < 2) put(ferns, x, y, 6, 0.85 + ((r >>> 26) & 3) * 0.12, 0.95);
        if ((r >>> 27) % 9 === 0) put(deadwood, x, y, 8, 0.9 + ((r >>> 5) & 3) * 0.15, 0.9);
        if ((r >>> 28) % 9 === 0) put(firs, x, y, 10, 0.6 + ((r >>> 9) & 3) * 0.06, 0.9);
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
        if ((shoreNear || near2) && (r >>> 14) % 5 === 0) put(lilies, x, y, 30, 0.8 + ((r >>> 18) & 3) * 0.12, 0.9); // jeden płat kożucha liści na pole
      }
      else if (t === Terrain.Grass && !sandy && map.trails?.[y * w + x]) {
        // na leśnej ścieżce tylko drobne kamyki w ubitej ziemi
        if ((r >>> 22) % 9 === 0) put(pebbles, x, y, 12, 0.12 + ((r >>> 26) & 7) / 40, 0.95);
      }
      else if (t === Terrain.Grass && !sandy && !map.trails?.[y * w + x] && map.elevation[y * w + x]! - waterLevel > 105 && peak(x, y)) {
        // sam szczyt wzgórza (najwyższe pole w promieniu 4): wychodnia skalna — kilka głazów różnej wielkości z darni
        const n = 2 + ((r >>> 9) & 1) + ((r >>> 11) & 1);
        for (let k = 0; k < n; k++) put(rocks, x, y, 40 + k, 0.55 + ((r >>> (k * 3)) & 7) / 10, 0.95);
        put(pebbles, x, y, 46, 0.4, 0.95);
      }
      else if (t === Terrain.Grass && !sandy && !map.trails?.[y * w + x] && map.gen >= 4 && rockFoot(x, y) > 0 && farFromKeeps(x, y)) {
        // podnóże gór (generator 4, bez dawnych placków złóż): rumowisko ze zboczy — przy samej skale gęściej i większe głazy,
        // dalej coraz rzadziej i drobniej; skupiska płyną z szumu, więc nie układają się w równy pas ani w kratkę
        const d = rockFoot(x, y);
        const clump = (nz(x / 7, y / 7) + 1) / 2; // 0..1: tu leży więcej, tam prawie nic
        const chance = (d === 1 ? 0.55 : d === 2 ? 0.28 : 0.1) * (0.35 + clump * 0.9);
        if (((r >>> 5) & 1023) / 1023 < chance) {
          const n = d === 1 ? 1 + ((r >>> 9) & 1) + (clump > 0.6 ? 1 : 0) : 1;
          const big = d === 1 ? 0.55 : d === 2 ? 0.38 : 0.24;
          for (let k = 0; k < n; k++) put(rocks, x, y, 50 + k, big + ((r >>> (12 + k * 3)) & 7) / (d === 1 ? 14 : 22), 0.95);
        }
        if ((r >>> 17) % (d === 1 ? 2 : 4) === 0) put(pebbles, x, y, 55, 0.25 + ((r >>> 20) & 3) * 0.08, 0.95);
        // między kamieniami jałowiec i krzaki, trawa zostaje (to łąka pod górą, nie żwirowisko)
        if ((r >>> 24) % 7 === 0) put(bushes, x, y, 56, 0.6 + ((r >>> 27) & 3) * 0.1, 0.95);
      }
      else if (t === Terrain.Grass && !sandy && !nearW && !map.trails?.[y * w + x] && !besideForest(x, y) && (r >>> 7) % 211 === 0 && farFromKeeps(x, y)) {
        // samotne drzewo na łące: rozłożysty, stary dąb (czasem świerk), widoczny z daleka
        put((r >>> 3) % 5 === 0 ? pines : leafy, x, y, 0, 1.35 + ((r >>> 20) & 7) / 25, 0.5);
        put(bushes, x, y, 4, 0.7, 0.95);
      }
      else if (t === Terrain.Grass && !sandy && besideForest(x, y) && !map.trails?.[y * w + x] && (r >>> 14) % 5 < 3) {
        // łąka przy lesie: zarasta młodymi drzewkami (samosiejki), krzakami i paprociami — przejście łąka–las stopniowe
        const k = (r >>> 18) % 6;
        if (k < 2) put((r >>> 3) % 3 === 0 ? pines : leafy, x, y, 0, 0.32 + ((r >>> 20) & 7) / 30, 0.9);
        else if (k < 5) put(bushes, x, y, 4, 0.7 + ((r >>> 21) & 3) * 0.12, 0.95);
        if ((r >>> 25) % 3 === 0) put(ferns, x, y, 6, 0.75, 0.95);
      }
      else if (t === Terrain.Grass && !sandy) {
        // łąka: gęste kępy trawy, kwiaty, pojedyncze krzewy, kamyki i z rzadka większy głaz
        // kępy rosną gęściej tam, gdzie łąka jest bujniejsza (wolny szum), na wydeptanych miejscach znikają razem z polem
        const lush = (hash2(x >> 3, y >> 3, map.seed ^ 0x6a5d) & 255) / 255;
        // trawę rysuje gęsty dywan (grass.ts); tu tylko pojedyncze wyższe kępy dla urozmaicenia
        if (TEST && ((r >>> 7) & 3) === 0) put(tufts, x, y, 2, 1, 0.95);
        // kwiaty wyłączone na razie (19.10.2026, prośba Michała) — wrócą z gotowych modeli; włącza się je z powrotem tą flagą
        if (FLOWERS && (r >>> 13) % 15 === 0) { put(flowers, x, y, 7, 1, 0.9); put(flowers, x, y, 8, 0.9, 0.9); if ((r >>> 4) & 1) put(flowers, x, y, 9, 1.1, 0.9); }
        if ((r >>> 16) % 23 === 0) put(bushes, x, y, 4, 0.9 + ((r >>> 20) & 7) / 14, 0.6);
        if ((r >>> 19) % 31 === 0) put(pebbles, x, y, 5, 0.35 + ((r >>> 24) & 7) / 20, 0.8);
        if ((r >>> 21) % 173 === 0) put(pebbles, x, y, 10, 1.5, 0.4);
        // drobne kamyki wystające z darni, częściej tam, gdzie łąka rzadsza
        if ((r >>> 22) % (lush > 0.5 ? 19 : 11) === 0) put(pebbles, x, y, 12, 0.12 + ((r >>> 26) & 7) / 40, 0.95);
        if ((r >>> 25) % 41 === 0) put(pebbles, x, y, 14, 0.1 + ((r >>> 3) & 7) / 50, 0.95);
      }
    }
  }
  // murki z polnych kamieni: stare miedze na łąkach — proste odcinki po kilka pól, z przerwą na przejście,
  // tylko na łące (nie przez las, wodę, ścieżki ani plac pod zamkiem)
  const walls: Item[] = [];
  for (let by = 0; by < h; by += 18) for (let bx = 0; bx < w; bx += 18) {
    const r = hash2(bx, by, map.seed ^ 0x4d55524b);
    if ((r & 3) !== 0) continue;
    let x = bx + ((r >>> 4) % 18), y = by + ((r >>> 9) % 18);
    const alongX = ((r >>> 14) & 1) === 1, len = 4 + ((r >>> 15) % 8), gap = 1 + ((r >>> 19) % Math.max(1, len - 2));
    for (let k = 0; k < len; k++, alongX ? x++ : y++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) break;
      const i = y * w + x;
      if (map.tiles[i] !== Terrain.Grass || map.trails?.[i] || map.river?.[i] || sandTile[i]! > 0.1 || !farFromKeeps(x, y) || besideForest(x, y)) break;
      if (k === gap) continue; // przełaz
      const jx = alongX ? 0 : ((hash2(x, y, 7) & 15) / 15 - 0.5) * 0.12, jz = alongX ? ((hash2(x, y, 7) & 15) / 15 - 0.5) * 0.12 : 0;
      const pos = new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x + 0.5 + jx, y + 0.5 + jz) - 0.02, y + 0.5 + jz + oz);
      const qq = new THREE.Quaternion().setFromAxisAngle(yAxis, (alongX ? 0 : Math.PI / 2) + ((hash2(x, y, 9) & 15) / 15 - 0.5) * 0.12);
      const sc = new THREE.Vector3(1, 0.9 + (hash2(x, y, 11) & 7) / 30, 1);
      walls.push({ m: new THREE.Matrix4().compose(pos, qq, sc), shade: 0.85 + (hash2(x, y, 13) & 15) / 60, tile: i, pos, q: qq, s: sc });
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
  cloudShade(grassMat);
  /**
   * Roślinność i kamienie w kawałkach 40×40 pól: każdy kawałek to osobna siatka z własną sferą ograniczającą,
   * więc karta graficzna pomija to, czego nie widać (także w cieniach). Na dużych mapach to kilkukrotnie mniej trójkątów.
   * Na zewnątrz zachowuje się jak jedna siatka instancji (indeksy jak w liście).
   */
  type Inst = { setMatrixAt(i: number, m: THREE.Matrix4): void; setColorAt(i: number, c: THREE.Color): void; count: number; instanceMatrix: { needsUpdate: boolean; count: number } };
  const CHUNK = 40;
  // korony świerków: kolory z wierzchołków (jasne końce gałęzi, ciemne wnętrze), gładkie cieniowanie, widoczne z obu stron
  // daleki las jako obrazki: świerk i drzewo liściaste sfotografowane z 8 stron (pień + korona w jednym obrazku)
  // pień znika razem z przełączeniem korony na obrazek (obrazek ma już pień)
  // od ok. 30 pól od środka widoku drzewa są obrazkami (impostorami), drobiazgi znikają — z bliska nic się nie zmienia,
  // a z daleka i tak ich nie widać (wcześniej 40–42 pola: w zwykłym widoku pełne drzewa sięgały do krawędzi ekranu)
  // cień pnia: graniastosłup bez denek (z góry słońca denka i tak nie widać), gałęzie liściastych też uproszczone
  const pineTrunkShadow = new THREE.CylinderGeometry(0.06, 0.12, 1.3, 4, 1, true).translate(0, 0.64, 0);
  const leafTrunkShadow = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.13, 1.2, 4, 1, true).translate(0, 0.6, 0),
    new THREE.CylinderGeometry(0.035, 0.05, 0.4, 3, 1, true).rotateZ(0.8).translate(-0.14, 1.2, 0),
    new THREE.CylinderGeometry(0.035, 0.05, 0.4, 3, 1, true).rotateZ(-0.8).translate(0.14, 1.25, 0.02),
  ])!;
  const SMALL_LOD: Lod = { hide: 30 };
  void pineTrunkShadow; void leafTrunkShadow;
  // korony z kart (drzewa z Blendera): igliwie i liście na przezroczystym tle, cięte alphaTest, widoczne z obu stron
  // wiatr w koronach: czubek drzewa kołysze się wolno, każde drzewo w swojej fazie (podmuchy przechodzą przez las falą);
  // pień stoi, więc ruch rośnie z wysokością. Ten sam zegar co trawa.
  const windCrown = (m: THREE.Material, amp: number, key: string, base = 0.25, cards = true): void => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.windTime = windTime;
      sh.vertexShader = 'uniform float windTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wp = instanceMatrix[3].xz;
          float lift = max(position.y - ${base.toFixed(2)}, 0.0);
          float wave = sin(windTime * 0.9 + wp.x * 0.11 + wp.y * 0.07) * 0.7 + sin(windTime * 2.3 + wp.x * 0.6 + wp.y * 0.4) * 0.3;
          transformed.x += wave * ${amp.toFixed(3)} * lift * lift;
          transformed.z += wave * ${(amp * 0.5).toFixed(3)} * lift * lift;
        #endif`);
      // ostre brzegi liści i igieł także z daleka (mipmapy rozmywają przezroczystość, więc ją wyostrzamy)
      if (cards) sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a = (diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;\n#include <alphatest_fragment>');
    };
    m.customProgramCacheKey = () => key;
    // cień korony kołysze się razem z nią (inaczej po koronie wędrują jasne pasy w miejscach, gdzie cień „został”)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    // karty rzucają cień tylko tam, gdzie są liście i igły (ta sama maska co w obrazie), a nie całymi prostokątami
    const src = m as THREE.MeshStandardMaterial;
    if (cards && src.map) { depth.map = src.map; depth.alphaTest = src.alphaTest || 0.5; }
    depth.onBeforeCompile = m.onBeforeCompile;
    depth.customProgramCacheKey = () => key + '-depth';
    m.userData.windDepth = depth;
  };
  // drzewa z Poly Haven (src/render/forest.ts): wiatr zaczyna się nad pniem, siła dobrana do wysokości modelu
  // (ruch rośnie z kwadratem wysokości), liściaste jesienią rudzieją i zimą tracą liście, z daleka obrazki z 8 stron
  const CONIFERS = kindsOf('conifer'), LEAFS = kindsOf('leaf'), SAPLINGS = kindsOf('sapling');
  const WIND: Record<TreeKind['role'], [number, number]> = { conifer: [0.025, 1.5], leaf: [0.03, 1.2], sapling: [0.04, 0.3] };
  for (const k of [...CONIFERS, ...LEAFS, ...SAPLINGS]) {
    const [amp, from] = WIND[k.role];
    windCrown(k.cardMat, amp, `wind-${k.name}`, from);
    windCrown(k.barkMat, amp, `wind-${k.name}-bark`, from, false);
    if (k.role === 'leaf') { k.cardMat.userData.season = 'leaf'; leafFar(k.far.material); }
    // iglaki: korona bez śniegu z bliska i z daleka tak samo (obrazki z daleka nie mają śniegu, więc białe korony
    // z bliska „wyskakiwały” przy ruchu kamery); śnieg i szron dalej leżą na ziemi, pniach i krzakach
    else { k.cardMat.userData.noSeason = true; k.far.material.userData.noSeason = true; }
  }
  // Zamiana drzewa na obrazek dopiero w mgle: mgła zaczyna się ok. 70 pól za punktem, na który patrzy kamera
  // (scene.ts: fog.near), więc do ok. 60 pól drzewo jest zawsze bryłą z kartami i nic nie mruga w zasięgu wzroku.
  // Karty korony są tanie (52 trójkąty); drogi jest pień, więc ten ma dwa stopnie: pełny do 18 pól, dalej lekki.
  const FOG_SWITCH = 60;
  // cień korony rzucają te same karty co w obrazie (z wyciętym tłem), więc ma dokładnie kształt drzewa; wcześniej rzucała
  // go prosta bryła-stożek i na ziemi leżały trójkątne kliny zamiast koron
  const kindLod = (k: TreeKind): Lod => ({ near: FOG_SWITCH, farGeo: k.far.geometry, farMat: k.far.material });
  // pień z bliska pełną bryłą (do kilku tys. trójkątów), dalej lżejszy; cień rzuca prosty graniastosłup w jego miejscu
  const trunkLods = new Map<TreeKind, Lod>();
  const kindTrunkLodOf = (k: TreeKind): Lod => {
    let l = trunkLods.get(k);
    if (!l) { const h = k.height * (k.role === 'leaf' ? 0.45 : 0.7); l = { near: 18, farGeo: k.trunkFar, hide: FOG_SWITCH, shadowGeo: new THREE.CylinderGeometry(0.04 * k.height / 3, 0.07 * k.height / 3, h, 5, 1, true).translate(0, h / 2, 0) }; trunkLods.set(k, l); }
    return l;
  };
  /** odmiana dla drzewa: stała dla miejsca (hash pozycji) */
  const kindFor = <T,>(list: T[], it: Item, salt: number): T => list[hash2(Math.round(it.pos.x * 10) + salt, Math.round(it.pos.z * 10), 0x5eed) % list.length]!;
  const splitKinds = (list: Item[], ks: TreeKind[], salt: number): Map<TreeKind, Item[]> => {
    const m = new Map<TreeKind, Item[]>(ks.map((k) => [k, []]));
    for (const it of list) m.get(kindFor(ks, it, salt))!.push(it);
    return m;
  };
  // pnie gną się tym samym wiatrem co ich korony (ta sama wysokość startu i siła), więc górna część pnia i gałęzie
  // idą razem z liśćmi, a nie sterczą z kołyszącej się korony; dół pnia stoi
  const barkMat = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: pattern('bark'), bumpMap: bump('bark'), bumpScale: 1.2, normalMap: normal('bark') });
  void barkMat;
  // Poziomy szczegółów: każdy kawałek (40×40 pól) wie, gdzie leży. Drobiazgi (kępy, kwiaty, kamyki) znikają daleko
  // od kamery, a świerki dalej niż kilkadziesiąt pól przełączają się na prosty model. Liczone co kilka klatek.
  // shadowGeo: prostsza bryła tego samego kształtu, która rzuca cień zamiast pełnego modelu (w obrazie zostaje pełny);
  // cień liczony jest z mapy 4096 px na obszar kilkudziesięciu pól, więc różnicy w kształcie cienia nie widać
  type Lod = { hide?: number; near?: number; farGeo?: THREE.BufferGeometry; farMat?: THREE.Material; shadowGeo?: THREE.BufferGeometry };
  const lodChunks: { mesh: THREE.InstancedMesh; x: number; z: number; r: number; lod: Lod; near: THREE.BufferGeometry; nearMat: THREE.Material; shadow: boolean; proxy?: THREE.InstancedMesh }[] = [];
  /**
   * Wspólne pule roślinności: zamiast osobnego wywołania rysowania dla każdego kawałka 40×40 (i drugiego w cieniu)
   * każdy rodzaj (korony, pnie, krzewy, kamyki, kwiaty…) rysuje się jedną siatką na parę bryła–materiał. Co klatkę
   * (tylko gdy coś się zmieniło) trafiają do niej instancje kawałków w kadrze kamery, a do puli cienia — kawałki
   * w zasięgu mapy cieni. Kawałki zostają jak były (macierze, kolory, ścinanie drzew, LOD z lod()); pula tylko je
   * kopiuje, więc logika lasu się nie zmienia.
   */
  type VegChunk = { mesh: THREE.InstancedMesh; proxy?: THREE.InstancedMesh };
  type VegPool = { mesh: THREE.InstancedMesh; n: number };
  type VegKind = { chunks: VegChunk[]; pools: Map<string, VegPool>; label: string; receive: boolean; sig: number[] };
  const vegKinds: VegKind[] = [];
  const poolKey = (g: THREE.BufferGeometry, m: THREE.Material, role: 'main' | 'shadow'): string => `${g.uuid}|${m.uuid}|${role}`;
  const vegPool = (k: VegKind, g: THREE.BufferGeometry, m: THREE.Material, role: 'main' | 'shadow', cap: number, depth?: THREE.Material): VegPool => {
    const key = poolKey(g, m, role);
    let p = k.pools.get(key);
    if (p) return p;
    const mesh = new THREE.InstancedMesh(g, m, cap);
    mesh.count = 0;
    mesh.visible = true; // widoczna od startu, żeby wstępna kompilacja shaderów ją objęła; pierwsze cullVeg ustawi właściwie
    mesh.frustumCulled = false;
    mesh.userData.noCull = true; // sama wybiera kawałki; cięcie instancji poza kadrem (scene.cullInstances) jej nie dotyczy
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (role === 'shadow') {
      mesh.layers.set(SHADOW_LAYER);
      mesh.castShadow = true;
      if (depth) mesh.customDepthMaterial = depth;
      cat(mesh, k.label + ' (cień)');
    } else {
      mesh.castShadow = false;
      mesh.receiveShadow = k.receive;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
      cat(mesh, k.label);
    }
    group.add(mesh);
    p = { mesh, n: 0 };
    k.pools.set(key, p);
    return p;
  };
  const vegSphere = new THREE.Sphere();
  /** Wybór kawałków do pul na tę klatkę: `view` — kadr kamery, `shadow` — zasięg mapy cieni (null: bez cieni) */
  const cullVeg = (view: THREE.Frustum, shadow: THREE.Frustum | null): void => {
    for (const k of vegKinds) {
      // podpis: które kawałki, do której puli i w jakiej wersji danych — bez zmian nic nie kopiujemy
      const sig: number[] = [];
      const plan: [VegPool, THREE.InstancedMesh, boolean][] = [];
      k.chunks.forEach((c, ci) => {
        const m = c.mesh;
        if (!m.visible || !m.boundingSphere) return;
        vegSphere.copy(m.boundingSphere).applyMatrix4(group.matrixWorld);
        if (view.intersectsSphere(vegSphere)) {
          const p = k.pools.get(poolKey(m.geometry, m.material as THREE.Material, 'main'));
          if (p) { plan.push([p, m, true]); sig.push(ci, 0, m.instanceMatrix.version, m.instanceColor?.version ?? 0); }
        }
        if (!shadow || !shadow.intersectsSphere(vegSphere)) return;
        if (c.proxy) {
          if (!c.proxy.visible) return;
          const p = k.pools.get(poolKey(c.proxy.geometry, shadowProxyMaterial, 'shadow'));
          if (p) { plan.push([p, m, false]); sig.push(ci, 1, m.instanceMatrix.version); }
        } else if (m.castShadow) {
          const p = k.pools.get(poolKey(m.geometry, m.material as THREE.Material, 'shadow'));
          if (p) { plan.push([p, m, false]); sig.push(ci, 2, m.instanceMatrix.version); }
        }
      });
      if (sig.length === k.sig.length && sig.every((v, i) => v === k.sig[i])) continue;
      k.sig = sig;
      for (const p of k.pools.values()) p.n = 0;
      for (const [p, m, color] of plan) {
        const n = m.count;
        (p.mesh.instanceMatrix.array as Float32Array).set((m.instanceMatrix.array as Float32Array).subarray(0, n * 16), p.n * 16);
        if (color && p.mesh.instanceColor && m.instanceColor) (p.mesh.instanceColor.array as Float32Array).set((m.instanceColor.array as Float32Array).subarray(0, n * 3), p.n * 3);
        p.n += n;
      }
      for (const p of k.pools.values()) {
        p.mesh.count = p.n;
        p.mesh.visible = p.n > 0;
        if (p.n) {
          p.mesh.instanceMatrix.clearUpdateRanges(); p.mesh.instanceMatrix.addUpdateRange(0, p.n * 16); touch(p.mesh);
          if (p.mesh.instanceColor) { p.mesh.instanceColor.clearUpdateRanges(); p.mesh.instanceColor.addUpdateRange(0, p.n * 3); touch(p.mesh); }
        }
      }
    }
  };
  /** Podpis kolejnych siatek roślinności do okna wydajności (F3) */
  let label = 'roślinność';
  const instanced = (g: THREE.BufferGeometry, color: number, list: Item[], tex?: Parameters<typeof pattern>[0], shadow = true, own?: THREE.Material, lod?: Lod, chunk = CHUNK): Inst | null => {
    if (!list.length) return null;
    const mat = own ?? new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: 1.2, normalMap: tex ? normal(tex) : null });
    if (!own && tex === 'leaves') mat.userData.season = 'leaf'; // liściaste korony i krzewy: jesienią rude, zimą gołe
    cloudShade(mat); // plamy cienia chmur suną po lesie razem z ziemią
    if (lod?.farMat) cloudShade(lod.farMat);
    const buckets = new Map<number, number[]>();
    list.forEach((it, i) => {
      const k = Math.floor((it.pos.x + 512) / chunk) * 4096 + Math.floor((it.pos.z + 512) / chunk);
      let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); } b.push(i);
    });
    const where: [THREE.InstancedMesh, number][] = new Array(list.length);
    const dirty = new Set<THREE.InstancedMesh>();
    const kind: VegKind = { chunks: [], pools: new Map(), label, receive: mat !== grassMat, sig: [] };
    vegKinds.push(kind);
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
      }
      const casts = shadow && !proxy;
      if (lod && mesh.boundingSphere) lodChunks.push({ mesh, x: mesh.boundingSphere.center.x, z: mesh.boundingSphere.center.z, r: chunk * 0.7, lod, near: g, nearMat: mat, shadow: casts, proxy });
      mesh.castShadow = casts;
      if (mat.userData.windDepth) mesh.customDepthMaterial = mat.userData.windDepth as THREE.Material;
      // kępy trawy nie przyjmują cienia: cienkie źdźbła tuż nad ziemią łapały cień samego terenu i czerniały
      mesh.receiveShadow = mat !== grassMat;
      // kawałek nie trafia do sceny: to tylko dane (macierze, kolory, stan LOD); rysuje go wspólna pula rodzaju
      kind.chunks.push({ mesh, proxy });
    }
    // pule tworzone od razu dla wszystkich par bryła–materiał, jakie ten rodzaj może mieć (pory roku łatają materiały
    // tego, co jest w scenie — pula dodana później dostałaby je z opóźnieniem)
    const total = list.length;
    vegPool(kind, g, mat, 'main', total);
    if (lod?.farGeo) vegPool(kind, lod.farGeo, lod.farMat ?? mat, 'main', total);
    if (shadow && lod?.shadowGeo) vegPool(kind, lod.shadowGeo, shadowProxyMaterial, 'shadow', total, mat.userData.windDepth as THREE.Material | undefined);
    else if (shadow) {
      vegPool(kind, g, mat, 'shadow', total, mat.userData.windDepth as THREE.Material | undefined);
      if (lod?.farGeo && !lod.farMat) vegPool(kind, lod.farGeo, mat, 'shadow', total, mat.userData.windDepth as THREE.Material | undefined);
    }
    const flag = { count: 0, get needsUpdate() { return dirty.size > 0; }, set needsUpdate(v: boolean) { if (v) { for (const m of dirty) touch(m); dirty.clear(); } } };
    return {
      count: 0,
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
  /** drzewa jednej roli rozdzielone na odmiany: pień (bryła) i korona (karty), każda odmiana osobną pulą */
  const plantKinds = (list: Item[], ks: TreeKind[], salt: number, stump = true): void => {
    for (const [k, sub] of splitKinds(list, ks, salt)) {
      label = 'drzewa: pnie';
      const trunk = instanced(k.trunk, 0xffffff, sub, undefined, true, k.barkMat, kindTrunkLodOf(k), 16);
      label = 'drzewa: korony';
      plant(sub, trunk, instanced(k.cards, 0xffffff, sub, undefined, true, k.cardMat, kindLod(k), 16), stump);
    }
  };
  label = 'drzewa: korony';
  plantKinds(pines, CONIFERS, 1);
  plantKinds(leafy, LEAFS, 2);
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
        const pos = new THREE.Vector3(px, groundY - 0.05 - slopeAt(X, Y) * 0.3 * size, pz);
        const qq = new THREE.Quaternion().setFromEuler(e3.set(0, ((r >>> 4) & 63) / 10, 0));
        const sc = new THREE.Vector3(size, size * (leafTree ? 1 : 1.1), size);
        const item = { m: new THREE.Matrix4().compose(pos, qq, sc), shade: (1 - k * 0.5) * (0.82 + ((r >>> 12) & 15) / 60), tile: -1, pos, q: qq, s: sc, frost: smoothstep(treeline - 5.5, treeline - 0.5, groundY) * 0.75 } as Item;
        const bucket = dd < 14 ? near : far;
        (leafTree ? bucket.leaf : bucket.pine).push(item);
      }
    label = 'puszcza za mapą: bliska';
    for (const [ks, list, salt] of [[CONIFERS, near.pine, 3], [LEAFS, near.leaf, 4]] as const)
      for (const [k, sub] of splitKinds(list, ks, salt)) {
        instanced(k.trunk, 0xffffff, sub, undefined, true, k.barkMat, kindTrunkLodOf(k), 16);
        instanced(k.cards, 0xffffff, sub, undefined, true, k.cardMat, kindLod(k), 16);
      }
    // puszcza za mapą: obrazki zamiast brył (dwa trójkąty na drzewo), stąd może być gęstsza
    // dalekie obrazki nie przełączają szczegółów, więc kawałki mogą być duże (120 pól): kilkanaście wywołań rysowania zamiast ~200
    label = 'puszcza za mapą: obrazki';
    for (const [ks, list, salt] of [[CONIFERS, far.pine, 5], [LEAFS, far.leaf, 6]] as const)
      for (const [k, sub] of splitKinds(list, ks, salt)) instanced(k.far.geometry, 0xffffff, sub, undefined, false, k.far.material, undefined, 120);
  }
  // drobna roślinność i kamienie też są przypisane do pól, żeby znikały pod budynkami i drogami
  // krzaki: z bliska cztery kule po 80 trójkątów, dalej jedna bryła z dwóch prostych kul (40 trójkątów) — krzaków są tysiące
  // krzaki i głazy z Blendera (tools/models/plants.py) w wersji z bliska i z daleka; cień w zagłębieniach w kolorach wierzchołków
  const plantMat = (tex: Parameters<typeof pattern>[0], flat: boolean): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, flatShading: flat, roughness: 0.95, metalness: 0, map: pattern(tex), bumpMap: bump(tex), bumpScale: 1.2, normalMap: normal(tex) });
  const rockMat = plantMat('rock', true), rockFar = models.rockFar();
  // krzaki z Poly Haven (src/render/forest.ts → bushKinds): gęste kępy krzewów na kartach, z daleka obrazki;
  // drżą na wietrze (przy ziemi prawie nic, u góry najwięcej), jesienią rudzieją, zimą gubią liście jak dawniej
  label = 'krzewy';
  const BUSHES = bushKinds();
  for (const b of BUSHES) {
    windCrown(b.cardMat, 0.22, `wind-${b.name}`, 0.04);
    b.cardMat.userData.season = 'leaf';
    leafFar(b.far.material);
  }
  const bushSplit = new Map<BushKind, Item[]>(BUSHES.map((b) => [b, []]));
  for (const it of bushes) bushSplit.get(kindFor(BUSHES, it, 11))!.push(it);
  for (const [b, sub] of bushSplit) plant(sub, instanced(b.cards, 0xffffff, sub, undefined, true, b.cardMat, { near: FOG_SWITCH, farGeo: b.far.geometry, farMat: b.far.material }, 16), null, false);
  // podszyt lasu: paprocie (karty z przezroczystością, drżą na wietrze, jesienią rudzieją) i opadłe gałęzie z korą
  label = 'podszyt';
  const fernMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, map: fernTexture(), alphaTest: 0.5 });
  fernMat.userData.season = 'leaf';
  windCrown(fernMat, 0.5, 'wind-fern', 0.05);
  plant(ferns, instanced(models.fern(), 0x5d8a34, ferns, undefined, false, fernMat, SMALL_LOD), null, false);
  plant(deadwood, instanced(models.deadwood(), 0x6b5038, deadwood, 'bark', false, undefined, SMALL_LOD), null, false);
  // młode jodły w podroście (Fir Sapling Medium z Poly Haven): z bliska bryła i karty, dalej obrazki, nie do ścięcia
  label = 'podszyt: młode jodły';
  for (const [k, sub] of splitKinds(firs, SAPLINGS, 7)) plant(sub, instanced(k.trunk, 0xffffff, sub, undefined, false, k.barkMat, kindTrunkLodOf(k), 16), instanced(k.cards, 0xffffff, sub, undefined, true, k.cardMat, kindLod(k), 16), false);
  // trzciny (pałka wodna) i kożuch liści na stawach z gry 0 A.D. (src/render/forest.ts → waterPlants): oryginalne
  // siatki i tekstury bez przeróbek; pałka w dwóch odmianach, liście leżą płasko na tafli
  const WP = waterPlants();
  // 2,5 cm nad taflą (WATER_Y) i przesunięcie głębi — tafla sięga po horyzont, więc przy samej wodzie liście migały
  for (const it of lilies) { it.pos.y = WATER_Y + 0.025; it.m.compose(it.pos, it.q, it.s); }
  label = 'trzcina i grzybienie';
  const reedMats = WP.reedTex.map((tex, i) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    m.onBeforeCompile = grassMat.onBeforeCompile;
    m.userData.season = 'grass';
    m.customProgramCacheKey = () => `reeds-${i}`;
    return m;
  });
  const reedSplit = reedMats.map(() => [] as Item[]);
  for (const it of reeds) reedSplit[kindFor(reedMats.map((_, i) => i), it, 13)]!.push(it);
  reedMats.forEach((m, i) => plant(reedSplit[i]!, instanced(WP.reeds, 0xffffff, reedSplit[i]!, undefined, false, m, { hide: 70 }), null, false));
  // zdjęcie z południa jest jasne: przyciemnione do mętnej wody wokół, matowe (bez odblasku słońca)
  const lilyMat = new THREE.MeshStandardMaterial({ map: WP.lilyTex, color: 0x7f8a72, alphaTest: 0.35, alphaToCoverage: true, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  lilyMat.userData.season = 'leaf';
  plant(lilies, instanced(WP.lilies, 0xffffff, lilies, undefined, false, lilyMat, { hide: 70 }), null, false);
  label = 'kamyki';
  plant(pebbles, instanced(models.rock(), 0xb8b3a6, pebbles, 'rock', true, rockMat, { ...SMALL_LOD, farGeo: rockFar }), null, false);
  label = 'kępy trawy';
  plant(tufts, instanced(grassCards(), 0xffffff, tufts, undefined, false, grassMat, SMALL_LOD), null, false);
  {
    label = 'kwiaty';
    const mesh = instanced(models.flower(), 0xffffff, flowers, undefined, false, undefined, SMALL_LOD);
    const palette = [0xf4f1e6, 0xf2d24a, 0xb07ad6, 0xe8687a, 0x7fb2e6];
    if (mesh) { flowers.forEach((it, i) => mesh.setColorAt(i, tint.setHex(palette[(it.tile * 7 + i) % palette.length]!))); touch(mesh); }
    plant(flowers, mesh, null, false);
  }
  // skały i rudy też znikają, gdy złoże się wyczerpie (bez pniaka)
  label = 'skały i złoża';
  plant(rocks, instanced(models.rock(), 0xc4bfb1, rocks, 'rock', true, rockMat, { farGeo: rockFar }), null, false);
  label = 'murki';
  plant(walls, instanced(models.drywall(), 0xb9b3a4, walls, 'rock', true, rockMat), null, false);
  plant(ores, instanced(models.rock(), 0xa05a36, ores, 'rock', true, rockMat, { farGeo: rockFar }), null, false);
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
    touch(stumpMesh);
    if (stumpMesh.instanceColor) touch(stumpMesh);
    stumpMesh.visible = true;
  };
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tilt = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);
  // Drzewa leśniczych: osobna pula (pnie i korony świerków i drzew liściastych z tymi samymi bryłami i materiałami co las,
  // więc wiatr, pory roku i cienie chmur działają same). Drzewko rośnie skalą od sadzonki po dorosłe drzewo; ścięte
  // przez drwala znika z puli. Pula rysuje tylko zajęte miejsca (licznik rośnie z każdym nowym drzewkiem).
  const YOUNG_CAP = 2048;
  type Young = { kind: 0 | 1; i: number; pos: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; k: number };
  const young = new Map<number, Young>();
  const youngFree: number[] = [];
  let youngTop = 0;
  const youngMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geo, mat, YOUNG_CAP);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.userData.noCull = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (mat.userData.windDepth) mesh.customDepthMaterial = mat.userData.windDepth as THREE.Material;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(YOUNG_CAP * 3), 3);
    cat(mesh, name);
    group.add(mesh);
    return mesh;
  };
  // [rodzaj][pień, korona] i ich barwy (jak w lesie z mapy)
  const youngSets: [THREE.InstancedMesh, THREE.InstancedMesh][] = [
    [youngMesh(CONIFERS[0]!.trunk, CONIFERS[0]!.barkMat, 'drzewa leśniczych: pnie'), youngMesh(CONIFERS[0]!.cards, CONIFERS[0]!.cardMat, 'drzewa leśniczych: korony')],
    [youngMesh(LEAFS[0]!.trunk, LEAFS[0]!.barkMat, 'drzewa leśniczych: pnie'), youngMesh(LEAFS[0]!.cards, LEAFS[0]!.cardMat, 'drzewa leśniczych: korony')],
  ];
  const youngTint: [number, number][] = [[0xffffff, 0xffffff], [0xffffff, 0xffffff]];
  const youngPut = (y: Young, mm: THREE.Matrix4): void => {
    for (const mesh of youngSets[y.kind]!) { mesh.setMatrixAt(y.i, mm); touch(mesh); }
  };
  const grow = (tile: number, k: number): void => {
    let y = young.get(tile);
    if (k <= 0) {
      if (!y) return;
      youngPut(y, zero);
      youngFree.push(y.i);
      young.delete(tile);
      return;
    }
    if (!y) {
      const i = youngFree.pop() ?? (youngTop < YOUNG_CAP ? youngTop++ : -1);
      if (i < 0) return;
      const tx = tile % w, ty = Math.floor(tile / w);
      const r = hash2(tx * 31 + 7, ty * 17 + 3, map.seed ^ 0x51ed27);
      const kind: 0 | 1 = (r >>> 3) % 3 === 0 ? 1 : 0;   // sadzi głównie świerki, co trzecie drzewo liściaste
      const jx = ((r & 255) / 255 - 0.5) * 0.5, jz = (((r >>> 8) & 255) / 255 - 0.5) * 0.5;
      const pos = new THREE.Vector3(tx + 0.5 + jx + ox, heightAt(tx + 0.5 + jx, ty + 0.5 + jz), ty + 0.5 + jz + oz);
      const qq = new THREE.Quaternion().setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI * 2);
      const sz = 0.85 + (((r >>> 16) & 255) / 255) * 0.3;   // dorosłe jak zwykłe drzewo w lesie
      y = { kind, i, pos, q: qq, s: new THREE.Vector3(sz, sz * (0.9 + ((r >>> 12) & 15) / 60) * 1.05, sz), k: -1 };
      young.set(tile, y);
      const shade = 0.82 + ((r >>> 20) & 15) / 60;
      const [mt, mc] = youngSets[kind]!;
      mt.setColorAt(i, tint.setHex(youngTint[kind]![0]).multiplyScalar(shade));
      mc.setColorAt(i, tint.setHex(youngTint[kind]![1]).multiplyScalar(shade * 1.05));
      for (const mesh of youngSets[kind]!) {
        if (mesh.instanceColor) touch(mesh);
        mesh.count = Math.max(mesh.count, i + 1);
        mesh.visible = true;
      }
    }
    const kk = Math.min(1, k);
    if (Math.abs(kk - y.k) < 0.004) return;
    y.k = kk;
    // sadzonka po kolana, potem coraz wyższe drzewko; korona rośnie trochę szybciej wszerz niż w górę
    const f = 0.12 + 0.88 * kk;
    const wide = f ** 0.8;
    youngPut(y, m.compose(y.pos, y.q, q2.set(y.s.x * wide, y.s.y * f, y.s.z * wide)));
  };
  const q2 = new THREE.Vector3();
  const fell = (tile: number, k: number): void => {
    const y = young.get(tile);
    if (y) {
      tilt.copy(y.q).multiply(q.setFromAxisAngle(xAxis, Math.min(1, k) * 1.45));
      youngPut(y, m.compose(y.pos, tilt, q2.copy(y.s)));
    }
    for (const t of trees.get(tile) ?? []) {
      tilt.copy(t.item.q).multiply(q.setFromAxisAngle(xAxis, Math.min(1, k) * 1.45));
      m.compose(t.item.pos, tilt, t.item.s);
      for (const mesh of t.meshes) { mesh.setMatrixAt(t.index, m); touch(mesh); }
    }
  };
  const clear = (tile: number): void => {
    grow(tile, 0);
    for (const t of trees.get(tile) ?? []) {
      for (const mesh of t.meshes) { mesh.setMatrixAt(t.index, zero); touch(mesh); }
      const si = stumpOf.get(t.item);
      if (si !== undefined) showStump(si, m.compose(t.item.pos, t.item.q, t.item.s));
    }
    trees.delete(tile);
  };
  const trunkNear = (x: number, y: number, r: number): boolean => {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const yt = young.get(yy * w + xx);
      if (yt && yt.k > 0.4) {
        // drzewko leśniczego: pień zawadza dopiero, gdy podrośnie
        const R = r + 0.12 * yt.s.x * yt.k;
        if ((yt.pos.x - ox - x) ** 2 + (yt.pos.z - oz - y) ** 2 < R * R) return true;
      }
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
  let roadMats: THREE.Material[] | null = null;
  // wyrównanie terenu pod budynek po ułożeniu drogi (np. wczytanie zapisu: drogi rysują się przed budynkami)
  // zmienia wysokości narożników — drogę trzeba wtedy przeliczyć, inaczej zostaje pod nowym terenem i trawą
  let roadRefresh = false;
  const refreshRoadsSoon = (): void => {
    if (roadRefresh || !roadsNow || !roadMats) return;
    roadRefresh = true;
    queueMicrotask(() => { roadRefresh = false; if (roadsNow && roadMats) setRoads(roadsNow, roadMats); });
  };
  const setRoads = (roads: Uint8Array, materials: THREE.Material[]): void => {
    roadsNow = roads; roadMats = materials;
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
          touch(im);
          if (im.instanceColor) touch(im);
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
          touch(rm);
          if (rm.instanceColor) touch(rm);
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
          touch(im);
          if (im.instanceColor) touch(im);
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
          touch(im);
          if (im.instanceColor) touch(im);
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

  /** Narożniki terenu pod stojącymi budynkami (wyrównane): skarpy kolejnych budynków ich nie ruszają */
  let levelLock: Uint8Array | null = null;
  return {
    group,
    ground,
    setRoads,
    heightAt,
    fell,
    clear,
    grow,
    trunkNear,
    animate,
    setSky(c: THREE.Color) { wm.sky.value.copy(c); streams?.setSky(c); },
    reflectWater(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, on: boolean) { reflection.render(renderer, scene, camera, on && hasWater && !TEST); },
    setAtmosphere(a: Atmosphere) { mistFx?.update(fxTime, a); },
    setSun(dir: THREE.Vector3, color: THREE.Color, golden: number) { wm.sunDir.value.copy(dir).normalize(); wm.sunCol.value.copy(color).multiplyScalar(dir.y > 0 ? 0.6 + golden * 0.8 : 0); },
    level(x: number, y: number, fw: number, fh: number, y0: number) {
      streams?.blocked(x, y, fw, fh);
      levelLock ??= new Uint8Array((w + 1) * (h + 1));
      const lock = levelLock;
      const rockCorner = (cx: number, cy: number): boolean => {
        for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
          const tx = cx + ox, ty = cy + oy;
          if (tx >= 0 && ty >= 0 && tx < w && ty < h && map.tiles[ty * w + tx] === Terrain.Mountain) return true;
        }
        return false;
      };
      // plac pod budynek jak w prawdziwej budowie: działka równa, a dookoła skarpa łagodnie schodzi do terenu
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      const changed: number[] = [];
      // skarpa szersza i mocniejsza: modele wystają trochę poza działkę (cokół, kopiec kopalni), więc pierwszy pierścień
      // jest prawie równy z placem, a dopiero dalej teren schodzi do zbocza — inaczej brzeg budynku wisiał nad stokiem
      for (let cy = Math.max(0, y - 3); cy <= Math.min(h, y + fh + 3); cy++)
        for (let cx = Math.max(0, x - 3); cx <= Math.min(w, x + fw + 3); cx++) {
          const d = Math.max(x - cx, cx - (x + fw), y - cy, cy - (y + fh), 0);
          const ci = cy * (w + 1) + cx, old = corners[ci]!;
          // ziemia NIŻEJ niż plac (dół stoku): pierwsze dwa pierścienie podsypane mocniej — tam wystaje cokół, okap,
          // ganek i kosze przy ścianie, a każda szczelina pod nimi wygląda jak budynek w powietrzu.
          // Ziemia WYŻEJ (góra stoku) może zostać trochę wyżej: najwyżej lekko zasypie brzeg cokołu.
          const below = old < y0;
          const k = d === 0 ? 1 : d === 1 ? (below ? 1 : 0.9) : d === 2 ? (below ? 0.8 : 0.55) : below ? 0.35 : 0.2;
          if (old < 0 && d > 0) continue; // brzeg wody zostaje
          // narożnik przy górach POZA działką zostaje: zbocze masywu nie schodzi do poziomu działki (kopalnia stoi tyłem do skały).
          // Sama działka jest zawsze równa — inaczej zbocze wjeżdżało w grotę kopalni i zasłaniało ją od środka.
          if (d > 0 && rockCorner(cx, cy)) continue;
          // narożnik pod innym, już stojącym budynkiem: skarpa nowego go nie rusza (inaczej sąsiad zawisał w powietrzu albo się zapadał)
          // (także pierwszy pierścień skarpy: tam stoi okap, cokół albo brzeg kopca sąsiada)
          const held = lock[ci]!;
          if (d > 0 && held) continue;
          if (d === 0) lock[ci] = 1;
          else if (d === 1) lock[ci] = 2;
          let nv = old + (y0 - old) * k;
          // wspólna krawędź z sąsiadem stojącym tuż obok (narożnik już pod nim albo pod jego okapem): wolno ją tylko
          // podnieść, nigdy obniżyć — obniżenie odsłaniało szparę pod sąsiadem i ten „latał” (17.10.2026)
          if (held && nv < old) nv = old;
          if (Math.abs(nv - old) < 0.002) continue;
          corners[ci] = nv; changed.push(ci);
          grass?.setHeight(ci, nv);
        }
      if (!changed.length) return;
      // droga dotyka zmienionego narożnika: przelicz ją na nowej wysokości (raz na partię wyrównań)
      if (roadsNow) {
        const rn = roadsNow;
        const nearRoad = changed.some((ci) => {
          const cx = ci % (w + 1), cy = (ci - cx) / (w + 1);
          for (let ty = cy - 1; ty <= cy; ty++) for (let tx = cx - 1; tx <= cx; tx++) if (tx >= 0 && ty >= 0 && tx < w && ty < h && rn[ty * w + tx]) return true;
          return false;
        });
        if (nearRoad) refreshRoadsSoon();
      }
      const SLOT_OF: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]];
      for (let ty = Math.max(0, y - 4); ty < Math.min(h, y + fh + 4); ty++)
        for (let tx = Math.max(0, x - 4); tx < Math.min(w, x + fw + 4); tx++)
          for (let k = 0; k < 6; k++) {
            const [dx, dy] = SLOT_OF[k]!;
            pos[(ty * w + tx) * 18 + k * 3 + 1] = corner(tx + dx, ty + dy);
          }
      attr.needsUpdate = true;
    },
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
    /** Roślinność do wspólnych pul na tę klatkę (wywołanie tuż przed rysowaniem) */
    cullVegetation(view: THREE.Frustum, shadow: THREE.Frustum | null) { cullVeg(view, shadow); },
    lod(x: number, z: number, reach: number, detail = 1) {
      mistFx?.detail(detail);
      for (const c of lodChunks) {
        const d = Math.hypot(c.x - x, c.z - z) - c.r; // od krawędzi kawałka, nie od środka
        if (c.lod.hide !== undefined) c.mesh.visible = d < c.lod.hide * detail + reach;
        const far = d > (c.lod.near ?? 30) * detail + reach;
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
      mistFx?.dispose(); streams?.dispose(); reflection.dispose();
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



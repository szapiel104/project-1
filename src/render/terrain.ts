import * as THREE from 'three';
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
  if (t === Terrain.Mountain) return 1.2 + (e - 170) * 0.13;
  const h = (e - waterLevel) * HEIGHT_SCALE;
  return t === Terrain.Water ? Math.min(h, -0.25) : Math.max(h, 0.12);
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
      if (hh > 5) tmp.lerp(snow, Math.max(0, Math.min(1, (hh - 6.5) / 3)));
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
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: pattern('grass'), bumpMap: bump('grass'), bumpScale: 1.2 }));
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

  // Za mapą: skalne podłoże i pasma gór ginące we mgle, żeby nie było widać końca świata.
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(w + 400, h + 400), new THREE.MeshLambertMaterial({ color: 0x77746c }));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.y = -0.3;
  group.add(beyond);
  const peaks: THREE.Matrix4[] = [];
  const pm = new THREE.Matrix4();
  const pq = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const ringStep = 5;
  for (let ring = 0; ring < 6; ring++) {
    const d = 1 + ring * 6;
    for (let side = 0; side < 4; side++) {
      const len = (side % 2 === 0 ? w : h) + d * 2;
      for (let i = 0; i < len; i += ringStep) {
        const r = hash2(i + ring * 131, side * 17 + ring, map.seed ^ 0x6a09e667);
        const along = -len / 2 + i + ((r & 15) / 15) * 3;
        const out = d + (((r >>> 4) & 15) / 15) * 4;
        const px = side === 0 ? along : side === 2 ? along : side === 1 ? w / 2 + out : -w / 2 - out;
        const pz = side === 0 ? -h / 2 - out : side === 2 ? h / 2 + out : along;
        const height = 9 + ring * 2.5 + (((r >>> 8) & 255) / 255) * 9;
        const radius = 5 + (((r >>> 16) & 255) / 255) * 5;
        pq.setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI);
        pm.compose(new THREE.Vector3(px, -0.3, pz), pq, new THREE.Vector3(radius, height, radius));
        peaks.push(pm.clone());
      }
    }
  }
  const peakGeo = new THREE.ConeGeometry(1, 1, 5);
  peakGeo.translate(0, 0.5, 0);
  const peakMesh = new THREE.InstancedMesh(peakGeo, new THREE.MeshLambertMaterial({ color: 0x8b8880, flatShading: true }), peaks.length);
  peaks.forEach((m, i) => peakMesh.setMatrixAt(i, m));
  group.add(peakMesh);

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
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const put = (list: Item[], x: number, y: number, n: number, scaleBase: number, spread = 0.7): void => {
    const r = hash2(x * 7 + n, y * 13 - n, map.seed ^ 0xabcdef);
    const jx = ((r & 255) / 255 - 0.5) * spread;
    const jz = (((r >>> 8) & 255) / 255 - 0.5) * spread;
    const s = scaleBase * (0.75 + (((r >>> 16) & 255) / 255) * 0.6);
    q.setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI * 2);
    const pos = new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x + 0.5 + jx, y + 0.5 + jz), y + 0.5 + jz + oz);
    const scale = new THREE.Vector3(s, s * (0.9 + ((r >>> 12) & 15) / 60), s);
    m.compose(pos, q, scale);
    list.push({ m: m.clone(), shade: 0.8 + (((r >>> 20) & 15) / 15) * 0.4, tile: y * w + x, pos, q: q.clone(), s: scale });
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y * w + x] as Terrain;
      const r = hash2(x, y, map.seed);
      if (t === Terrain.Forest) {
        // las mieszany: głównie świerki, co czwarte drzewo liściaste
        put((r >>> 3) % 4 === 0 ? leafy : pines, x, y, 0, 1);
        if (r & 1) put((r >>> 5) % 4 === 0 ? leafy : pines, x, y, 1, 0.8);
      } else if (t === Terrain.Stone) put(rocks, x, y, 0, 1.1);
      else if (t === Terrain.Iron) put(ores, x, y, 0, 1);
      else if (t === Terrain.Grass && (r >>> 7) % 3 === 0) { put(tufts, x, y, 2, 1, 0.9); if ((r >>> 9) & 1) put(tufts, x, y, 3, 0.8, 0.9); }
    }
  }
  const tint = new THREE.Color();
  const instanced = (g: THREE.BufferGeometry, color: number, list: Item[], tex?: Parameters<typeof pattern>[0], shadow = true): THREE.InstancedMesh | null => {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: 1.2 }), list.length);
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tint.setHex(color).multiplyScalar(it.shade)); });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // drzewa zapamiętujemy według pola, żeby drwal mógł je ściąć
  const trees = new Map<number, { meshes: THREE.InstancedMesh[]; index: number; item: Item }[]>();
  const stumpItems: Item[] = [];
  const stumpOf = new Map<Item, number>();
  const plant = (list: Item[], trunk: THREE.InstancedMesh | null, crown: THREE.InstancedMesh | null, stump = true): void => {
    list.forEach((item, index) => {
      const here = trees.get(item.tile) ?? [];
      here.push({ meshes: [trunk, crown].filter((x): x is THREE.InstancedMesh => !!x), index, item });
      trees.set(item.tile, here);
      if (stump) { stumpOf.set(item, stumpItems.length); stumpItems.push(item); }
    });
  };
  plant(pines, instanced(models.treeTrunk(), 0x6b4a2e, pines, 'bark'), instanced(models.treeCrown(), 0x3c7a3a, pines, 'needles'));
  plant(leafy, instanced(models.leafTrunk(), 0x7a5a3a, leafy, 'bark'), instanced(models.leafCrown(), 0x6fa33d, leafy, 'leaves'));
  // skały i rudy też znikają, gdy złoże się wyczerpie (bez pniaka)
  plant(rocks, instanced(models.rock(), 0xa9a498, rocks), null, false);
  plant(ores, instanced(models.rock(), 0x8a4a2c, ores), null, false);
  const stumps = instanced(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 7).translate(0, 0.07, 0), 0x8a6a45, stumpItems, 'bark', false);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  if (stumps) { stumpItems.forEach((_, i) => stumps.setMatrixAt(i, zero)); }
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

  instanced(models.tuft(), 0x7fae45, tufts, undefined, false);

  // Drogi. Kamienna to równe pola bruku. Piaskowa to wydeptana ścieżka: każde pole dostaje miękką,
  // nieregularną plamę większą od pola, a sąsiednie plamy zlewają się w jeden trakt o poszarpanych brzegach.
  const roadMeshes: THREE.Mesh[] = [];
  let pathMat: THREE.MeshStandardMaterial | null = null;
  const pathMaterial = (): THREE.MeshStandardMaterial => {
    if (pathMat) return pathMat;
    const n = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const c2 = cv.getContext('2d')!;
    const img = c2.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = (x / n - 0.5) * 2, dy = (y / n - 0.5) * 2;
        const wob = (hash2(x >> 3, y >> 3, 77) & 255) / 255 * 0.18 + (hash2(x >> 1, y >> 1, 91) & 255) / 255 * 0.08;
        const d = Math.hypot(dx, dy) + wob;
        const alpha = Math.max(0, Math.min(1, (0.98 - d) / 0.4));
        const tone = 0.82 + ((hash2(x, y, 5) & 255) / 255) * 0.18;
        const i = (y * n + x) * 4;
        img.data[i] = 205 * tone; img.data[i + 1] = 176 * tone; img.data[i + 2] = 118 * tone; img.data[i + 3] = alpha * 235;
      }
    c2.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    pathMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
    return pathMat;
  };
  const setRoads = (roads: Uint8Array, materials: THREE.Material[]): void => {
    for (const old of roadMeshes) { group.remove(old); old.geometry.dispose(); }
    roadMeshes.length = 0;
    for (let kind = 1; kind <= materials.length; kind++) {
      const p3: number[] = [], uv2: number[] = [];
      const soft = kind === 1;
      const grow = soft ? 0.42 : 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (roads[y * w + x] !== kind) continue;
          // lekkie przesunięcie każdej plamy, żeby ścieżka nie szła jak po linijce
          const r = hash2(x, y, map.seed ^ 0x77);
          const jx = soft ? ((r & 15) / 15 - 0.5) * 0.22 : 0, jy = soft ? (((r >>> 4) & 15) / 15 - 0.5) * 0.22 : 0;
          const x0 = x - grow + jx, x1 = x + 1 + grow + jx, y0 = y - grow + jy, y1 = y + 1 + grow + jy;
          for (const [qx, qy, u, v] of [[x0, y0, 0, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y1, 1, 1]] as const) {
            p3.push(qx + ox, heightAt(qx, qy) + (soft ? 0.03 : 0.045), qy + oz);
            if (soft) uv2.push(u, v); else uv2.push(qx / 3, qy / 3); // wzór bruku rozciąga się na 3 pola: po dwie płyty na pole
          }
        }
      if (!p3.length) continue;
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(p3, 3));
      g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
      g2.computeVertexNormals();
      const mesh = new THREE.Mesh(g2, soft ? pathMaterial() : materials[kind - 1]);
      mesh.receiveShadow = true;
      mesh.renderOrder = soft ? 1 : 0;
      group.add(mesh);
      roadMeshes.push(mesh);
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
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
}

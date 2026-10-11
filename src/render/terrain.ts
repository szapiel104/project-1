import * as THREE from 'three';
import { TERRAIN, Terrain } from '../data/terrain';
import type { GameMap } from '../sim/map';
import { hash2 } from '../sim/rng';
import type { ModelFactory } from './models';

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

  const pos = new Float32Array(w * h * 18);
  const col = new Float32Array(w * h * 18);
  const c = new THREE.Color();
  const snow = new THREE.Color(0xf2efe6);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y * w + x] as Terrain;
      const shade = 0.9 + ((hash2(x, y, map.seed) & 31) / 31) * 0.2;
      c.setHex(TERRAIN[t].color).multiplyScalar(shade);
      const h00 = corner(x, y), h10 = corner(x + 1, y), h01 = corner(x, y + 1), h11 = corner(x + 1, y + 1);
      if (t === Terrain.Mountain) c.lerp(snow, Math.max(0, Math.min(1, ((h00 + h11) / 2 - 6.5) / 3)));
      const quad = [
        x, h00, y, x, h01, y + 1, x + 1, h10, y,
        x + 1, h10, y, x, h01, y + 1, x + 1, h11, y + 1,
      ];
      for (let i = 0; i < 18; i += 3) {
        pos[p + i] = quad[i]! + ox;
        pos[p + i + 1] = quad[i + 1]!;
        pos[p + i + 2] = quad[i + 2]! + oz;
        col[p + i] = c.r; col[p + i + 1] = c.g; col[p + i + 2] = c.b;
      }
      p += 18;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  ground.castShadow = true; // góry i pagórki też rzucają cień
  group.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ color: 0x3f7f96, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.08;
  group.add(water);

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
  const trees: THREE.Matrix4[] = [];
  const rocks: THREE.Matrix4[] = [];
  const ores: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const put = (list: THREE.Matrix4[], x: number, y: number, n: number, scaleBase: number): void => {
    const r = hash2(x * 7 + n, y * 13 - n, map.seed ^ 0xabcdef);
    const jx = ((r & 255) / 255 - 0.5) * 0.7;
    const jz = (((r >>> 8) & 255) / 255 - 0.5) * 0.7;
    const s = scaleBase * (0.75 + (((r >>> 16) & 255) / 255) * 0.6);
    q.setFromAxisAngle(yAxis, ((r >>> 24) / 255) * Math.PI * 2);
    m.compose(new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x + 0.5 + jx, y + 0.5 + jz), y + 0.5 + jz + oz), q, new THREE.Vector3(s, s, s));
    list.push(m.clone());
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y * w + x] as Terrain;
      if (t === Terrain.Forest) { put(trees, x, y, 0, 1); if (hash2(x, y, map.seed) & 1) put(trees, x, y, 1, 0.8); }
      else if (t === Terrain.Stone) put(rocks, x, y, 0, 1.1);
      else if (t === Terrain.Iron) put(ores, x, y, 0, 1);
    }
  }
  const instanced = (g: THREE.BufferGeometry, color: number, list: THREE.Matrix4[]): void => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color, flatShading: true }), list.length);
    list.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  instanced(models.treeTrunk(), 0x4a3320, trees);
  instanced(models.treeCrown(), 0x2f5a2a, trees);
  instanced(models.rock(), 0xa9a498, rocks);
  instanced(models.rock(), 0x8a4a2c, ores);

  return {
    group,
    ground,
    heightAt,
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
  };
}

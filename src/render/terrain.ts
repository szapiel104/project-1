import * as THREE from 'three';
import { TERRAIN, Terrain } from '../data/terrain';
import { TEAM_COLORS } from '../data/teams';
import { MAP_PRESETS } from '../data/maps';
import type { GameMap } from '../sim/map';
import { hash2 } from '../sim/rng';
import type { ModelFactory } from './models';

const HEIGHT_SCALE = 0.03;

/** Wysokość pola w świecie 3D. Woda leży poniżej zera. */
function tileHeight(map: GameMap, x: number, y: number, waterLevel: number): number {
  const cx = Math.min(map.width - 1, Math.max(0, x));
  const cy = Math.min(map.height - 1, Math.max(0, y));
  const e = map.elevation[cy * map.width + cx]!;
  const t = map.tiles[cy * map.width + cx] as Terrain;
  const h = (e - waterLevel) * HEIGHT_SCALE;
  return t === Terrain.Water ? Math.min(h, -0.25) : Math.max(h, 0.12);
}

export interface TerrainView {
  group: THREE.Group;
  ground: THREE.Mesh;
  /** Wysokość terenu w środku pola */
  heightAt(x: number, y: number): number;
  dispose(): void;
}

/** Buduje widok mapy: podłoże, wodę, drzewa, skały i twierdze startowe. Tylko czyta stan. */
export function buildTerrain(map: GameMap, models: ModelFactory, waterLevel: number): TerrainView {
  const group = new THREE.Group();
  const { width: w, height: h } = map;
  const ox = -w / 2;
  const oz = -h / 2;

  // wysokości narożników = średnia z czterech sąsiednich pól
  const corner = (x: number, y: number): number =>
    (tileHeight(map, x - 1, y - 1, waterLevel) + tileHeight(map, x, y - 1, waterLevel) +
      tileHeight(map, x - 1, y, waterLevel) + tileHeight(map, x, y, waterLevel)) / 4;

  const pos = new Float32Array(w * h * 18);
  const col = new Float32Array(w * h * 18);
  const c = new THREE.Color();
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y * w + x] as Terrain;
      const shade = 0.9 + ((hash2(x, y, map.seed) & 31) / 31) * 0.2;
      c.setHex(TERRAIN[t].color).multiplyScalar(shade);
      const h00 = corner(x, y), h10 = corner(x + 1, y), h01 = corner(x, y + 1), h11 = corner(x + 1, y + 1);
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
  group.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 60, h + 60),
    new THREE.MeshLambertMaterial({ color: 0x3f7f96, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.08;
  group.add(water);

  const heightAt = (x: number, y: number): number =>
    (corner(x, y) + corner(x + 1, y) + corner(x, y + 1) + corner(x + 1, y + 1)) / 4;

  // obiekty na polach: liczymy, potem jedna siatka instancjonowana na rodzaj
  const trees: THREE.Matrix4[] = [];
  const rocks: THREE.Matrix4[] = [];
  const ores: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const put = (list: THREE.Matrix4[], x: number, y: number, n: number, scaleBase: number): void => {
    const r = hash2(x * 7 + n, y * 13 - n, map.seed ^ 0xabcdef);
    const jx = ((r & 255) / 255 - 0.5) * 0.7;
    const jz = (((r >>> 8) & 255) / 255 - 0.5) * 0.7;
    const s = scaleBase * (0.75 + (((r >>> 16) & 255) / 255) * 0.6);
    q.setFromAxisAngle(up, ((r >>> 24) / 255) * Math.PI * 2);
    m.compose(new THREE.Vector3(x + 0.5 + jx + ox, heightAt(x, y), y + 0.5 + jz + oz), q, new THREE.Vector3(s, s, s));
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
    group.add(mesh);
  };
  instanced(models.treeTrunk(), 0x4a3320, trees);
  instanced(models.treeCrown(), 0x2f5a2a, trees);
  instanced(models.rock(), 0xa9a498, rocks);
  instanced(models.rock(), 0x8a4a2c, ores);

  for (const s of map.starts) {
    const keep = models.keep(TEAM_COLORS[s.team]!);
    keep.position.set(s.x + 0.5 + ox, heightAt(s.x, s.y), s.y + 0.5 + oz);
    keep.rotation.y = s.team === 0 ? Math.PI * 0.25 : Math.PI * 1.25;
    group.add(keep);
  }

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

export function waterLevelFor(presetId: keyof typeof MAP_PRESETS): number {
  return MAP_PRESETS[presetId].waterLevel;
}

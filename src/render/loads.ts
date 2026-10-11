import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RESOURCES } from '../data/resources';

/** Maluje całą bryłę jednym kolorem (kolor siedzi w wierzchołkach, więc jeden model może mieć kilka barw). */
function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const ball = (r: number, x: number, y: number, z: number, hex: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry =>
  tint(new THREE.IcosahedronGeometry(r, 1).scale(sx, sy, sz).translate(x, y, z), hex);
const block = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number): THREE.BufferGeometry =>
  tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const basket = (): THREE.BufferGeometry => tint(new THREE.CylinderGeometry(0.15, 0.11, 0.13, 8).translate(0, 0, 0), 0xb08a4e);

/**
 * Jak wygląda ładunek niesiony przez chłopa, osobno dla każdego surowca.
 * Początek układu = środek ładunku; scena ustawia go nad głową albo w rękach.
 */
const SHAPES: Record<string, () => THREE.BufferGeometry[]> = {
  apples: () => [basket(), ...[0, 1, 2, 3, 4, 5].map((k) => ball(0.05, Math.cos(k * 1.05) * 0.08, 0.08, Math.sin(k * 1.05) * 0.08, k % 3 ? 0xd0281f : 0xa9c23f)), ball(0.05, 0, 0.11, 0, 0xd0281f)],
  bread: () => [basket(), ...[-0.06, 0.06].map((x) => ball(0.07, x, 0.09, 0, 0xc9843d, 0.8, 0.7, 1.6)), ball(0.06, 0, 0.14, 0.02, 0xd99a4f, 1.5, 0.7, 0.8)],
  wheat: () => [0, 1, 2].map((k) => tint(new THREE.ConeGeometry(0.07, 0.34, 6).rotateZ(Math.PI / 2 + (k - 1) * 0.18).translate(0, 0.03 + k * 0.01, (k - 1) * 0.08), 0xe2bf4a)).concat(block(0.04, 0.16, 0.2, -0.02, 0.03, 0, 0x8a6a1f)),
  flour: () => [ball(0.13, 0, 0.04, 0, 0xf4eedc, 1.25, 0.95, 0.9), block(0.06, 0.05, 0.06, 0.15, 0.1, 0, 0xcfc4a4)],
  stone: () => [block(0.24, 0.17, 0.2, 0, 0.03, 0, 0xb5b0a2), block(0.14, 0.1, 0.14, 0.03, 0.16, 0.01, 0x9d978a)],
  iron: () => [block(0.3, 0.07, 0.11, 0, 0, -0.07, 0x6a6570), block(0.3, 0.07, 0.11, 0, 0, 0.07, 0x6a6570), block(0.3, 0.07, 0.11, 0, 0.08, 0, 0x7c7784)],
};

/** Tworzy po jednej siatce instancjonowanej na surowiec. Zwraca indeks surowca → siatka. */
export function createLoads(max: number, scene: THREE.Scene): Map<number, THREE.InstancedMesh> {
  const out = new Map<number, THREE.InstancedMesh>();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  RESOURCES.forEach((id, index) => {
    const parts = SHAPES[id]?.();
    const geo = parts ? mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))) : null;
    if (!geo) return;
    geo.translate(0, 0.72, 0.16); // niesione przed sobą, na wysokości piersi
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    scene.add(mesh);
    out.set(index, mesh);
  });
  return out;
}

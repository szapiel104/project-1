import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { createNoise3D } from 'simplex-noise';

/**
 * Narzędzia do składania budynków jak „rękodzieło”: belki z fazowanymi krawędziami, mury z nieregularnych kamieni,
 * strzecha z nierówną powierzchnią i ściany z wyciętymi otworami. Wszystko deterministyczne z ziarna,
 * więc ten sam budynek wygląda za każdym razem tak samo.
 */

/** Prosty generator liczb z ziarna (tylko wygląd). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Skaluje współrzędne tekstury tak, by wzór miał tę samą wielkość niezależnie od rozmiaru bryły. */
function scaleUv(geo: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  return geo;
}

/** Kolor w wierzchołkach całej bryły (do łączenia wielu części w jedną siatkę). */
export function paintGeo(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Belka z fazowanymi krawędziami między dwoma punktami, lekko krzywa (ręcznie ciosana).
 * `size` = grubość, `jitter` = jak bardzo odchyla się od prostej.
 */
export function beam(a: THREE.Vector3, b: THREE.Vector3, size: number, r: () => number, jitter = 0.012): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new RoundedBoxGeometry(size * (0.9 + r() * 0.2), len + size * 0.3, size * (0.85 + r() * 0.2), 2, size * 0.22);
  scaleUv(geo, Math.max(len, 0.3) * 1.2);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.x += (r() - 0.5) * jitter; mid.z += (r() - 0.5) * jitter;
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  // drobny skręt wokół własnej osi i odchyłka kąta: belka nie jest od linijki
  q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * jitter * 2, (r() - 0.5) * 0.2, (r() - 0.5) * jitter * 2)));
  geo.applyQuaternion(q);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

/**
 * Podmurówka z polnych kamieni wokół prostokąta w × d: dwa rzędy nierównych, zaokrąglonych kamieni
 * w różnych odcieniach, ciasno jeden przy drugim.
 */
export function stoneSkirt(w: number, d: number, height: number, r: () => number, base = new THREE.Color(0xd8cfbc)): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rows = 2, rowH = height / rows;
  const sides: [number, number, number, number, number][] = [
    // x0, z0, kierunek x, kierunek z, długość
    [-w / 2, d / 2, 1, 0, w], [w / 2, -d / 2, -1, 0, w], [w / 2, d / 2, 0, -1, d], [-w / 2, -d / 2, 0, 1, d],
  ];
  for (let row = 0; row < rows; row++)
    for (const [x0, z0, dx, dz, len] of sides) {
      let t = row % 2 ? -0.04 : 0;
      while (t < len) {
        const sw = 0.15 + r() * 0.12, sh = rowH * (0.9 + r() * 0.25), sd = 0.09 + r() * 0.04;
        const geo = new RoundedBoxGeometry(sw, sh, sd, 2, Math.min(sw, sh, sd) * 0.4);
        // nierówności: wierzchołki rozepchnięte losowo, żeby kamień nie był pudełkiem
        const p = geo.getAttribute('position');
        const k = 0.006 + r() * 0.006, s0 = r() * 100;
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + Math.sin(i * 1.7 + s0) * k, p.getY(i) + Math.cos(i * 2.3 + s0) * k * 0.6, p.getZ(i) + Math.sin(i * 3.1 + s0) * k);
        geo.computeVertexNormals();
        scaleUv(geo, 0.2);
        geo.rotateY(dz !== 0 ? Math.PI / 2 : 0);
        geo.rotateY((r() - 0.5) * 0.15);
        const along = t + sw / 2;
        // kamienie lekko wystają poza lico ściany, narożniki się zazębiają
        const out = 0.035;
        const nx = dz !== 0 ? -dz : 0, nz = dx !== 0 ? dx : 0; // normalna na zewnątrz
        geo.translate(x0 + dx * along + nx * out, row * rowH + sh / 2 - 0.02, z0 + dz * along + nz * out);
        const tone = 0.82 + r() * 0.3;
        parts.push(paintGeo(geo, base.clone().multiplyScalar(tone).offsetHSL((r() - 0.5) * 0.03, 0, 0)));
        t += sw * 0.92;
      }
    }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/**
 * Połać strzechy: gruba warstwa słomy o nierównej powierzchni i postrzępionym okapie.
 * Zwraca jedną połać leżącą płasko (x = długość, z = spadek od kalenicy do okapu), do obrócenia przez wywołującego.
 */
export function thatchSlab(length: number, slope: number, thick: number, seed: number): THREE.BufferGeometry {
  const noise = createNoise3D(rng(seed));
  const geo = new THREE.BoxGeometry(length, thick, slope, Math.ceil(length * 14), 1, Math.ceil(slope * 14));
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const top = y > 0;
    // pęczki słomy: fale wzdłuż połaci i drobne guzy
    const n = noise(x * 2.2, z * 3.1, 0) * 0.025 + noise(x * 7, z * 9, 1) * 0.012;
    // okap (z = +slope/2) postrzępiony i lekko podwinięty
    const eave = Math.max(0, z / (slope / 2));
    const ragged = noise(x * 11, 0, 2) * 0.03 * eave * eave;
    p.setXYZ(i, x, top ? y + n + ragged : y + n * 0.5 - eave * eave * 0.02, z + (top ? 0 : 0.01) + ragged * 0.6);
  }
  geo.computeVertexNormals();
  scaleUv(geo, 1.2);
  return geo;
}

/** Ściana-pudełko z wyciętymi otworami (okna, drzwi). Otwory podane jako pudełka w układzie ściany. */
export function cutBox(w: number, h: number, d: number, holes: { w: number; h: number; d: number; x: number; y: number; z: number }[], material: THREE.Material, uvK: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  // tekstura w skali świata, jak przy zwykłych ścianach
  const uv = geo.getAttribute('uv');
  const size: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * size[f]![0] * uvK, uv.getY(i) * size[f]![1] * uvK); }
  geo.translate(0, h / 2, 0);
  let brush = new Brush(geo, material);
  brush.updateMatrixWorld();
  const ev = new Evaluator();
  ev.attributes = ['position', 'normal', 'uv'];
  for (const hole of holes) {
    const hb = new Brush(new THREE.BoxGeometry(hole.w, hole.h, hole.d), material);
    hb.position.set(hole.x, hole.y, hole.z);
    hb.updateMatrixWorld();
    brush = ev.evaluate(brush, hb, SUBTRACTION) as Brush;
    brush.updateMatrixWorld();
  }
  const mesh = new THREE.Mesh(brush.geometry, material);
  return mesh;
}

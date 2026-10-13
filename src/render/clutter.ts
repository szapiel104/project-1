import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { Terrain } from '../data/terrain';
import { hash2 } from '../sim/rng';
import type { GameState } from '../sim/state';
import { tint } from './loads';

/**
 * Graty przy domach: beczki, worki, siano, skrzynie, kupki śmieci, wiadra i taczki pod ścianami.
 * Tylko obraz — stoją na wolnych polach tuż przy budynku (nie na drodze, nie przy drzwiach), a gdy obok coś
 * zbudujesz albo położysz drogę, przestawiają się same. Każdy rodzaj to jedna siatka instancjonowana.
 */
type Kind = 'barrel' | 'sack' | 'hay' | 'crate' | 'trash' | 'bucket' | 'barrow' | 'logs';

const n = (g: THREE.BufferGeometry): THREE.BufferGeometry => (g.index ? g.toNonIndexed() : g);
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(parts.map(n))!;

function geometry(kind: Kind): THREE.BufferGeometry {
  const wood = 0x7a5232, dark = 0x3e2a1a, iron = 0x4a4844;
  switch (kind) {
    case 'barrel': return merge([
      tint(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 9).translate(0, 0.1, 0), wood),
      tint(new THREE.CylinderGeometry(0.085, 0.085, 0.13, 9).translate(0, 0.1, 0), 0x6b4728), // brzuchaty środek
      tint(new THREE.CylinderGeometry(0.079, 0.079, 0.016, 9).translate(0, 0.04, 0), iron),
      tint(new THREE.CylinderGeometry(0.079, 0.079, 0.016, 9).translate(0, 0.16, 0), iron),
      tint(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 9).translate(0, 0.2, 0), dark),
    ]);
    case 'sack': return merge([
      tint(new THREE.IcosahedronGeometry(0.075, 1).scale(1, 1.2, 0.85).translate(0, 0.085, 0), 0xb59a6a),
      tint(new THREE.CylinderGeometry(0.02, 0.035, 0.05, 6).translate(0, 0.18, 0), 0xa58a5a),
      tint(new THREE.IcosahedronGeometry(0.07, 1).scale(1.2, 0.8, 0.9).translate(0.11, 0.055, 0.04), 0xa88e60), // drugi worek obok
    ]);
    case 'hay': {
      // stóg siana na żerdzi: pękaty dół, zaokrąglony szczyt, sterczący kij; nierówne pasma i rozwiane źdźbła u stóp
      const parts = [
        tint(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.5, 1).translate(0, 0.08, 0), 0xc9a64e),
        tint(new THREE.CylinderGeometry(0.17, 0.19, 0.09, 12).translate(0, 0.045, 0), 0xb8963f),
        tint(new THREE.TorusGeometry(0.16, 0.012, 4, 16).rotateX(Math.PI / 2).translate(0, 0.17, 0), 0xa8862f), // pasmo przyciśniętego siana
        tint(new THREE.CylinderGeometry(0.008, 0.01, 0.16, 5).translate(0, 0.38, 0), 0x5a3e24), // żerdź
      ];
      for (let k = 0; k < 7; k++) {
        const a2 = k * 0.9;
        parts.push(tint(new THREE.BoxGeometry(0.035, 0.005, 0.1).rotateY(a2).translate(Math.cos(a2) * 0.22, 0.004, Math.sin(a2) * 0.22), k % 2 ? 0xd2b158 : 0xbf9e48));
      }
      return merge(parts);
    }
    case 'crate': return merge([
      tint(new THREE.BoxGeometry(0.15, 0.13, 0.15).translate(0, 0.065, 0), 0x8a6a42),
      tint(new THREE.BoxGeometry(0.155, 0.02, 0.155).translate(0, 0.12, 0), 0x6b4f30),
      tint(new THREE.BoxGeometry(0.155, 0.02, 0.155).translate(0, 0.015, 0), 0x6b4f30),
      tint(new THREE.BoxGeometry(0.11, 0.1, 0.11).rotateY(0.4).translate(0.03, 0.18, -0.01), 0x7f6240), // mniejsza na górze
    ]);
    case 'trash': return merge([
      tint(new THREE.IcosahedronGeometry(0.09, 0).scale(1.4, 0.35, 1).translate(0, 0.02, 0), 0x3f3527),
      tint(new THREE.BoxGeometry(0.06, 0.012, 0.03).rotateY(0.7).translate(0.05, 0.04, 0.02), 0x8a7a5a), // deska
      tint(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 6).rotateZ(1.3).translate(-0.05, 0.035, 0.01), 0x6a5a48), // skorupa dzbana
      tint(new THREE.IcosahedronGeometry(0.02, 0).translate(0.01, 0.045, -0.04), 0x5a6a3a), // łupiny
    ]);
    case 'bucket': return merge([
      tint(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 8).translate(0, 0.035, 0), wood),
      tint(new THREE.TorusGeometry(0.04, 0.004, 4, 10, Math.PI).translate(0, 0.07, 0), iron),
    ]);
    case 'barrow': {
      // taczka: skrzynia zwężająca się ku przodowi, koło ze szprychami na osi z przodu, dwa długie uchwyty i nóżki z tyłu
      const tub = new THREE.CylinderGeometry(0.095, 0.07, 0.07, 4, 1).rotateY(Math.PI / 4).scale(1.25, 1, 0.9);
      const parts = [
        tint(tub.translate(0.0, 0.11, 0), wood),
        tint(new THREE.BoxGeometry(0.17, 0.012, 0.13).translate(0, 0.077, 0), dark), // dno
        tint(new THREE.TorusGeometry(0.045, 0.01, 5, 14).translate(0.15, 0.047, 0), dark), // obręcz koła
        tint(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6).rotateX(Math.PI / 2).translate(0.15, 0.047, 0), iron), // oś
        ...[0, 1, 2].map((k) => tint(new THREE.BoxGeometry(0.008, 0.088, 0.008).rotateZ((k / 3) * Math.PI).translate(0.15, 0.047, 0), wood)),
      ];
      for (const sz of [-0.05, 0.05]) {
        parts.push(tint(new THREE.BoxGeometry(0.34, 0.016, 0.016).rotateZ(0.12).translate(-0.02, 0.085, sz), dark)); // uchwyt biegnie pod skrzynią do koła
        parts.push(tint(new THREE.BoxGeometry(0.014, 0.07, 0.014).translate(-0.09, 0.035, sz), dark)); // nóżka
      }
      return merge(parts);
    }
    case 'logs': return merge([0, 1, 2].map((i) => tint(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 7).rotateZ(Math.PI / 2).translate(0, 0.035 + (i === 2 ? 0.06 : 0), (i === 2 ? 0 : i - 0.5) * 0.075), i === 1 ? 0x6b4a2b : 0x7a5535)));
  }
}

/** Co leży przy jakim budynku */
const KINDS: Record<string, Kind[]> = {
  house: ['barrel', 'trash', 'bucket', 'sack', 'logs'],
  tavern: ['barrel', 'barrel', 'crate', 'trash'],
  bakery: ['sack', 'sack', 'logs', 'crate'],
  mill: ['sack', 'sack', 'barrow'],
  farm: ['hay', 'hay', 'barrow'],
  barn: ['hay', 'crate', 'barrow'],
  granary: ['sack', 'sack', 'crate'],
  stockpile: ['crate', 'barrel', 'barrow'],
  woodcutter: ['logs', 'barrow'],
  quarry: ['barrow', 'bucket'],
  mine: ['barrow', 'crate'],
  orchard: ['crate', 'barrow'],
  fisher: ['barrel', 'bucket'],
  barracks: ['barrel', 'crate'],
  engineers: ['crate', 'logs', 'barrow'],
  poleturner: ['logs', 'crate'],
  fletcher: ['logs', 'crate'],
  camp: ['trash', 'logs'],
};
const ALL: Kind[] = ['barrel', 'sack', 'hay', 'crate', 'trash', 'bucket', 'barrow', 'logs'];
const MAX = 1500;

export class Clutter {
  readonly group = new THREE.Group();
  private meshes = new Map<Kind, THREE.InstancedMesh>();
  private key = '';

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    for (const k of ALL) {
      const m = new THREE.InstancedMesh(geometry(k), mat, MAX);
      m.count = 0; m.castShadow = true; m.receiveShadow = true;
      this.meshes.set(k, m);
      this.group.add(m);
    }
  }

  /** Przestawia graty, gdy zmieniły się budynki albo drogi (tanio sprawdzane po kluczu) */
  sync(g: GameState, heightAt: (x: number, y: number) => number): void {
    let roads = 0;
    for (let i = 0; i < g.roads.length; i += 7) roads += g.roads[i]!;
    const key = `${g.buildings.length}:${g.nextId}:${roads}:${g.buildings.reduce((s, b) => s + (b.build ? 1 : 0) + (b.ruined ? 2 : 0), 0)}`;
    if (key === this.key) return;
    this.key = key;
    const { width: w, height: h } = g.map;
    const counts = new Map<Kind, number>(ALL.map((k) => [k, 0]));
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const used = new Set<number>();
    const free = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const t = y * w + x;
      const terr = g.map.tiles[t];
      return g.occupancy[t] === 0 && !g.roads[t] && !g.reserved[t] && terr !== Terrain.Water && terr !== Terrain.Mountain && terr !== Terrain.Forest && !used.has(t);
    };
    for (const b of g.buildings) {
      const def = BUILDINGS[b.type]!;
      const kinds = KINDS[def.id];
      if (!kinds || b.build || b.ruined) continue;
      const fp = footprint(def, b.rot);
      const dx0 = b.door % w, dy0 = Math.floor(b.door / w);
      // pola tuż przy ścianach; dla każdego wiemy, z której strony jest ściana
      const ring: [number, number, number, number][] = [];
      for (let x = b.x; x < b.x + fp.w; x++) { ring.push([x, b.y - 1, 0, 1]); ring.push([x, b.y + fp.h, 0, -1]); }
      for (let y = b.y; y < b.y + fp.h; y++) { ring.push([b.x - 1, y, 1, 0]); ring.push([b.x + fp.w, y, -1, 0]); }
      const want = 2 + (hash2(b.id, 1, 77) % 3);
      let placed = 0;
      for (let k = 0; k < ring.length && placed < want; k++) {
        const pick = ring[(hash2(b.id, k, 91) % ring.length + k * 7) % ring.length]!;
        const [tx, ty, nx, ny] = pick;
        // przy drzwiach przejście zostaje wolne
        if (b.door >= 0 && Math.abs(tx - dx0) <= 1 && Math.abs(ty - dy0) <= 1) continue;
        if (!free(tx, ty)) continue;
        used.add(ty * w + tx);
        const kind = kinds[(hash2(b.id, k, 13) % kinds.length)]!;
        const c = counts.get(kind)!;
        if (c >= MAX) continue;
        const r = (s: number): number => (hash2(b.id, k, s) % 1000) / 1000;
        // przyklejone do ściany: środek pola przesunięty w stronę budynku, trochę w bok
        const px = tx + 0.5 + nx * 0.28 + (ny ? (r(3) - 0.5) * 0.5 : 0);
        const py = ty + 0.5 + ny * 0.28 + (nx ? (r(4) - 0.5) * 0.5 : 0);
        P.set(px - w / 2, heightAt(px, py) - 0.01, py - h / 2);
        Q.setFromAxisAngle(Y, r(5) * Math.PI * 2);
        S.setScalar(0.85 + r(6) * 0.35);
        this.meshes.get(kind)!.setMatrixAt(c, M.compose(P, Q, S));
        counts.set(kind, c + 1);
        placed++;
      }
    }
    for (const [k, m] of this.meshes) { m.count = counts.get(k)!; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  }

  reset(): void { this.key = ''; for (const m of this.meshes.values()) m.count = 0; }
}

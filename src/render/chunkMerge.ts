import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Nieruchome części budynków zlepione w gotowe bryły na kawałek mapy (docs/optymalizacja-budynkow.md, partia 2+).
 *
 * Paczki budynków (buildingBatch.ts) rysują na WebGPU każdą sztukę osobnym poleceniem, więc pełna wioska to ~1400 poleceń
 * na klatkę. Tu wszystkie wskazane części budynków z jednego kawałka mapy (CELL × CELL pól) i z tym samym materiałem
 * stają się jedną siatką: jedno polecenie na materiał w kawałku. Kawałek przelicza się tylko wtedy, gdy zmieni się jego
 * zawartość (budynek postawiony, zburzony, przesunięty, inna liczba części) — najwyżej jeden kawałek na klatkę; do czasu
 * przeliczenia jego budynki rysują się po staremu (paczki), więc nic nie znika ani nie miga.
 */
export const CELL = 16;

export interface MergePart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  matrix: THREE.Matrix4;
  recv: boolean;
}
export interface MergeCandidate {
  id: number;
  root: THREE.Object3D;
  /** Liczba części do zlepienia (do podpisu kawałka) */
  n: number;
  /** Same części — wołane tylko przy przeliczaniu kawałka */
  parts: () => MergePart[];
}

interface Chunk {
  sig: string;
  ids: Set<number>;
  meshes: THREE.Mesh[];
}

const attrKey = (g: THREE.BufferGeometry): string => Object.keys(g.attributes).sort().map((k) => {
  const a = g.attributes[k] as THREE.BufferAttribute;
  return `${k}:${a.itemSize}:${a.normalized ? 1 : 0}`;
}).join(',') + (g.index ? '|i' : '|n');

export class ChunkMerge {
  private chunks = new Map<string, Chunk>();
  /** Budynki, których części są już w aktualnym kawałku (te nie idą do paczek) */
  private covered = new Set<number>();
  constructor(private readonly parent: THREE.Object3D, private readonly opts: { cast: boolean; reflect: boolean; label: string }) {}

  has(id: number): boolean { return this.covered.has(id); }

  /** Liczba zlepionych siatek (do pomiarów) */
  get size(): number { let n = 0; for (const c of this.chunks.values()) n += c.meshes.length; return n; }

  /**
   * Co klatkę: lista budynków z częściami do zlepienia. Liczy podpis każdego kawałka; kawałek z innym podpisem niż
   * zbudowany przelicza się (jeden na klatkę), a jego budynki do tego czasu nie są „pokryte”.
   */
  update(list: Iterable<MergeCandidate>): void {
    const groups = new Map<string, MergeCandidate[]>();
    for (const c of list) {
      if (!c.n) continue;
      const p = c.root.position;
      const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(c);
    }
    let rebuilt = false;
    this.covered.clear();
    for (const [key, cands] of groups) {
      cands.sort((a, b) => a.id - b.id);
      let sig = '';
      for (const c of cands) {
        const e = c.root.matrixWorld.elements;
        sig += `${c.id}:${c.root.uuid.slice(0, 8)}:${c.n}:${e[12]!.toFixed(3)},${e[13]!.toFixed(3)},${e[14]!.toFixed(3)},${e[0]!.toFixed(3)},${e[2]!.toFixed(3)};`;
      }
      const ch = this.chunks.get(key);
      if (ch && ch.sig === sig) { for (const id of ch.ids) this.covered.add(id); continue; }
      // nieaktualny kawałek chowamy od razu (jego budynki wracają do paczek) — inaczej te same bryły rysowałyby się dwa razy
      if (ch) for (const m of ch.meshes) m.visible = false;
      if (rebuilt) continue; // ten kawałek w następnej klatce; jego budynki na razie w paczkach
      rebuilt = true;
      this.build(key, sig, cands);
      for (const c of cands) this.covered.add(c.id);
    }
    // kawałki, w których nie został żaden budynek
    for (const [key, ch] of this.chunks) if (!groups.has(key)) { this.drop(ch); this.chunks.delete(key); }
  }

  private build(key: string, sig: string, cands: MergeCandidate[]): void {
    const old = this.chunks.get(key);
    if (old) this.drop(old);
    const byMat = new Map<string, { mat: THREE.Material; recv: boolean; geos: THREE.BufferGeometry[] }>();
    for (const c of cands) for (const part of c.parts()) {
      const k = part.mat.uuid + (part.recv ? 'r' : '') + '|' + attrKey(part.geo);
      let b = byMat.get(k);
      if (!b) byMat.set(k, (b = { mat: part.mat, recv: part.recv, geos: [] }));
      const g = new THREE.BufferGeometry();
      for (const name of Object.keys(part.geo.attributes)) g.setAttribute(name, (part.geo.attributes[name] as THREE.BufferAttribute).clone());
      if (part.geo.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(part.geo.index.array), 1));
      g.applyMatrix4(part.matrix);
      b.geos.push(g);
    }
    const meshes: THREE.Mesh[] = [];
    for (const { mat, recv, geos } of byMat.values()) {
      const merged = geos.length === 1 ? geos[0]! : mergeGeometries(geos, false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.matrixAutoUpdate = false;
      m.castShadow = this.opts.cast;
      m.receiveShadow = recv;
      if (!this.opts.reflect) m.userData.noReflect = true;
      m.userData.cat = this.opts.label;
      this.parent.add(m);
      meshes.push(m);
    }
    this.chunks.set(key, { sig, ids: new Set(cands.map((c) => c.id)), meshes });
  }

  private drop(ch: Chunk): void {
    for (const m of ch.meshes) { this.parent.remove(m); m.geometry.dispose(); }
    ch.meshes = [];
  }

  dispose(): void {
    for (const ch of this.chunks.values()) this.drop(ch);
    this.chunks.clear();
    this.covered.clear();
  }
}

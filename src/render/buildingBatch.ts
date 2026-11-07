import * as THREE from 'three';

/**
 * Budynki rysowane razem PO MATERIALE (Michał 7.11.2026: „pełna wioska dusi FPS”). Dotąd budynki tego samego rodzaju
 * dzieliły jedno wywołanie na parę bryła+materiał — przy 9 rodzajach to 135 osobnych wywołań, a każde kosztuje
 * three.js ok. 0,03–0,05 ms procesora. Te same materiały (deski, strzecha, kamień, tynk…) powtarzają się jednak
 * w wielu rodzajach: było ich tylko 44. THREE.BatchedMesh rysuje różne bryły z jednym materiałem w jednym wywołaniu,
 * więc z ~135 robi się ~44. Bryły, materiały i tekstury zostają te same — obraz się nie zmienia.
 *
 * Co klatkę: begin() → add(…) dla każdej nieruchomej części każdego budynku → end(). Sztuki (instancje) są
 * używane ponownie; nadmiarowe chowamy, a pojemność rośnie skokami (bez przebudowy co klatkę).
 */
interface Entry {
  mesh: THREE.BatchedMesh;
  geoIds: Map<THREE.BufferGeometry, number>;
  inst: number[];
  instGeo: number[];
  used: number;
  verts: number;
  index: number;
  maxVerts: number;
  maxIndex: number;
  maxInst: number;
}

const attrKey = (g: THREE.BufferGeometry): string => Object.keys(g.attributes).sort().map((k) => {
  const a = g.attributes[k] as THREE.BufferAttribute;
  return `${k}:${a.itemSize}:${(a.array as { constructor: { name: string } }).constructor.name}:${a.normalized ? 1 : 0}`;
}).join(',') + (g.index ? `|i${(g.index.array as { constructor: { name: string } }).constructor.name}` : '|n');
const vertsOf = (g: THREE.BufferGeometry): number => g.getAttribute('position').count;
const indexOf = (g: THREE.BufferGeometry): number => g.index?.count ?? 0;

export class MaterialBatches {
  private entries = new Map<string, Entry>();
  constructor(private readonly parent: THREE.Object3D) {}

  begin(): void { for (const e of this.entries.values()) e.used = 0; }

  /** Jedna nieruchoma część budynku (bryła, materiał, macierz świata) */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4, cast: boolean, recv: boolean): void {
    const key = mat.uuid + (cast ? 'c' : '') + (recv ? 'r' : '') + '|' + attrKey(geo);
    let e = this.entries.get(key);
    if (!e) e = this.create(key, geo, mat, cast, recv);
    let gid = e.geoIds.get(geo);
    if (gid === undefined) {
      const v = vertsOf(geo), ix = indexOf(geo);
      if (e.verts + v > e.maxVerts || e.index + ix > e.maxIndex) {
        e.maxVerts = Math.max(e.maxVerts * 2, e.verts + v);
        e.maxIndex = Math.max(e.maxIndex * 2, e.index + ix);
        e.mesh.setGeometrySize(e.maxVerts, e.maxIndex);
      }
      gid = e.mesh.addGeometry(geo);
      e.geoIds.set(geo, gid);
      e.verts += v; e.index += ix;
    }
    let id: number;
    if (e.used < e.inst.length) {
      id = e.inst[e.used]!;
      if (e.instGeo[e.used] !== gid) { e.mesh.setGeometryIdAt(id, gid); e.instGeo[e.used] = gid; }
      e.mesh.setVisibleAt(id, true);
    } else {
      if (e.inst.length >= e.maxInst) { e.maxInst *= 2; e.mesh.setInstanceCount(e.maxInst); }
      id = e.mesh.addInstance(gid);
      e.inst.push(id); e.instGeo.push(gid);
    }
    e.mesh.setMatrixAt(id, matrix);
    e.used++;
  }

  end(): void {
    for (const e of this.entries.values()) {
      for (let i = e.used; i < e.inst.length; i++) e.mesh.setVisibleAt(e.inst[i]!, false);
      e.mesh.visible = e.used > 0;
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) { this.parent.remove(e.mesh); e.mesh.dispose(); }
    this.entries.clear();
  }

  /** Liczba wspólnych siatek (do okna wydajności) */
  get size(): number { let n = 0; for (const e of this.entries.values()) if (e.mesh.visible) n++; return n; }

  private create(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean, recv: boolean): Entry {
    const maxInst = 64, maxVerts = Math.max(4096, vertsOf(geo) * 4), maxIndex = geo.index ? Math.max(8192, indexOf(geo) * 4) : 0;
    const mesh = new THREE.BatchedMesh(maxInst, maxVerts, maxIndex, mat);
    mesh.castShadow = cast; mesh.receiveShadow = recv;
    // bez cięcia do kadru po sztuce: w jednej klatce rysujemy kilka przejść (obraz, cienie, odbicie) z różnych kamer, a lista
    // widocznych sztuk idzie na kartę teksturą raz — przy cięciu części budynków migały (Michał 7.11.2026: „mrugają”)
    mesh.perObjectFrustumCulled = false;
    mesh.sortObjects = false;
    mesh.userData.noCull = true;
    mesh.frustumCulled = false; // całość obejmuje całą osadę; cięcie do kadru robi każda sztuka osobno
    this.parent.add(mesh);
    const e: Entry = { mesh, geoIds: new Map(), inst: [], instGeo: [], used: 0, verts: 0, index: 0, maxVerts, maxIndex, maxInst };
    this.entries.set(key, e);
    return e;
  }
}

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
  /** Czy w tej klatce choć jedna sztuka jest widoczna */
  anyVisible: boolean;
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

  begin(): void { for (const e of this.entries.values()) { e.used = 0; e.anyVisible = false; } }

  /** Jedna nieruchoma część budynku (bryła, materiał, macierz świata) */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4, cast: boolean, recv: boolean, hidden = false, inner = false): void {
    // wnętrza osobno (Michał 10.11.2026): w obrazie zawsze, ale bez cienia słońca i bez odbicia w wodzie — siedzą pod
    // dachem, a każda sztuka w tych przejściach to dodatkowe polecenie rysowania
    if (inner) cast = false;
    const key = mat.uuid + (cast ? 'c' : '') + (recv ? 'r' : '') + (inner ? 'i' : '') + '|' + attrKey(geo);
    let e = this.entries.get(key);
    if (!e) e = this.create(key, geo, mat, cast, recv, inner);
    let gid = e.geoIds.get(geo);
    if (gid === undefined) {
      const v = vertsOf(geo), ix = indexOf(geo);
      if (e.verts + v > e.maxVerts || e.index + ix > e.maxIndex)
        this.rebuild(e, Math.max(e.maxVerts * 2, e.verts + v), Math.max(e.maxIndex * 2, e.index + ix), e.maxInst);
      gid = e.mesh.addGeometry(geo);
      e.geoIds.set(geo, gid);
      e.verts += v; e.index += ix;
    }
    let id: number;
    if (e.used < e.inst.length) {
      id = e.inst[e.used]!;
      if (e.instGeo[e.used] !== gid) { e.mesh.setGeometryIdAt(id, gid); e.instGeo[e.used] = gid; }
      e.mesh.setVisibleAt(id, !hidden);
    } else {
      if (e.inst.length >= e.maxInst) this.rebuild(e, e.maxVerts, e.maxIndex, e.maxInst * 2);
      id = e.mesh.addInstance(gid);
      e.inst.push(id); e.instGeo.push(gid);
      if (hidden) e.mesh.setVisibleAt(id, false);
    }
    // budynek poza kadrem i poza mapą cieni: sztuka zostaje na swoim miejscu (numery się nie przesuwają), tylko schowana
    // macierz bez zmian (budynek stoi): nie przepisujemy jej — każde setMatrixAt oznacza całą teksturę macierzy do wysłania
    // na kartę, a w pełnej wiosce szło tak ~100 tekstur w każdej klatce (Michał 9.11.2026: „30 FPS na 5070”)
    if (hidden) { e.used++; e.anyVisible ||= false; return; }
    e.anyVisible = true;
    const arr = (e.mesh as unknown as { _matricesTexture: { image: { data: Float32Array } } })._matricesTexture.image.data, el = matrix.elements, o = id * 16;
    let same = true;
    for (let k = 0; k < 16; k++) if (arr[o + k] !== Math.fround(el[k]!)) { same = false; break; }
    if (!same) e.mesh.setMatrixAt(id, matrix);
    e.used++;
  }

  end(): void {
    for (const e of this.entries.values()) {
      for (let i = e.used; i < e.inst.length; i++) e.mesh.setVisibleAt(e.inst[i]!, false);
      e.mesh.visible = e.used > 0 && e.anyVisible; // cała paczka poza kadrem: bez rysowania
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) { this.parent.remove(e.mesh); e.mesh.dispose(); }
    this.entries.clear();
  }

  /** Do pomiarów: każda paczka — materiał, cienie, układ atrybutów, sztuki widoczne/wszystkie, bryły */
  stats(): { key: string; mat: string; vis: number; inst: number; geos: number; on: boolean }[] {
    return [...this.entries.entries()].map(([key, e]) => {
      let vis = 0;
      for (let i = 0; i < e.used; i++) if (e.mesh.getVisibleAt(e.inst[i]!)) vis++;
      const m = e.mesh.material as THREE.Material & { map?: { userData?: { name?: string } } | null; color?: THREE.Color };
      return { key: key.slice(36), mat: `${m.name || m.type}${m.color ? ' #' + m.color.getHexString() : ''}`, vis, inst: e.used, geos: e.geoIds.size, on: e.mesh.visible };
    });
  }

  /** Liczba wspólnych siatek (do okna wydajności) */
  get size(): number { let n = 0; for (const e of this.entries.values()) if (e.mesh.visible) n++; return n; }

  /**
   * Większy pakiet od zera zamiast setGeometrySize / setInstanceCount: przy powiększaniu w miejscu three.js podmienia
   * bufory, a na WebGPU rysowanie zostawało przy starych z nowymi zakresami — części jednych budynków pojawiały się
   * w innych (Michał 8.11.2026: wiatrak w zamku). Bryły i sztuki przepisujemy do nowego pakietu w tej samej kolejności.
   */
  private rebuild(e: Entry, maxVerts: number, maxIndex: number, maxInst: number): void {
    const old = e.mesh;
    const mesh = new THREE.BatchedMesh(maxInst, maxVerts, maxIndex, old.material as THREE.Material);
    mesh.castShadow = old.castShadow; mesh.receiveShadow = old.receiveShadow; mesh.userData.noReflect = old.userData.noReflect;
    mesh.perObjectFrustumCulled = false; mesh.sortObjects = false; mesh.frustumCulled = false; mesh.userData.noCull = true;
    const remap = new Map<number, number>();
    for (const [geo, gid] of e.geoIds) { const n = mesh.addGeometry(geo); remap.set(gid, n); e.geoIds.set(geo, n); }
    const m = new THREE.Matrix4();
    for (let i = 0; i < e.inst.length; i++) {
      const oldId = e.inst[i]!, g = remap.get(e.instGeo[i]!)!;
      const id = mesh.addInstance(g);
      old.getMatrixAt(oldId, m); mesh.setMatrixAt(id, m); mesh.setVisibleAt(id, old.getVisibleAt(oldId));
      e.inst[i] = id; e.instGeo[i] = g;
    }
    this.parent.remove(old); old.dispose();
    this.parent.add(mesh);
    e.mesh = mesh; e.maxVerts = maxVerts; e.maxIndex = maxIndex; e.maxInst = maxInst;
  }

  private create(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean, recv: boolean, inner = false): Entry {
    const maxInst = 64, maxVerts = Math.max(4096, vertsOf(geo) * 4), maxIndex = geo.index ? Math.max(8192, indexOf(geo) * 4) : 0;
    const mesh = new THREE.BatchedMesh(maxInst, maxVerts, maxIndex, mat);
    mesh.castShadow = cast; mesh.receiveShadow = recv;
    // bez cięcia do kadru po sztuce: w jednej klatce rysujemy kilka przejść (obraz, cienie, odbicie) z różnych kamer, a lista
    // widocznych sztuk idzie na kartę teksturą raz — przy cięciu części budynków migały (Michał 7.11.2026: „mrugają”)
    mesh.perObjectFrustumCulled = false;
    mesh.sortObjects = false;
    mesh.userData.noCull = true;
    if (inner) mesh.userData.noReflect = true;
    mesh.frustumCulled = false; // całość obejmuje całą osadę; cięcie do kadru robi każda sztuka osobno
    this.parent.add(mesh);
    const e: Entry = { mesh, geoIds: new Map(), inst: [], instGeo: [], used: 0, verts: 0, index: 0, maxVerts, maxIndex, maxInst, anyVisible: false };
    this.entries.set(key, e);
    return e;
  }
}

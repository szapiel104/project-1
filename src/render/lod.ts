import * as THREE from 'three';
import { coreReady, simplifyAll, type BucketData, type LevelData } from './lodcore';

/**
 * Daleka wersja budynków (LOD).
 *
 * Z bliska budynek to pełny model (zamek ~40 tys. trójkątów, warsztaty ~35 tys.). Z daleka te same bryły w kilkudziesięciu
 * pikselach ekranu nie potrzebują każdej deski i gwoździa, więc dla każdego rodzaju budynku liczymy uproszczone wersje
 * (meshoptimizer, ten sam algorytm co w silnikach gier), w osobnym wątku, żeby gra się nie zacinała:
 *  - bierzemy tylko bryły zewnętrzne: korpus oraz mury, dach i komin (bez wnętrza, sufitów, skrzydeł wrót, kraty, wiatraka,
 *    flag, ludzi, zapasów, okien i ognia — te zostają takie, jak były, i dalej się ruszają);
 *  - korpus i „wieko” (mury, dach) upraszczamy osobno, więc zdjęty dach nad pracującym budynkiem działa też z daleka;
 *  - materiały z tą samą teksturą (np. jasne i ciemne deski) łączymy w jedną siatkę, a różnicę barwy zapisujemy w kolorze
 *    wierzchołków — mniej wywołań rysowania, a deszcz, noc i podświetlenie ataku działają dalej, bo to te same materiały;
 *  - każdy poziom ma błąd w jednostkach świata (pole mapy = 1); drobiazgi mniejsze od błędu znikają; tekstury dostają
 *    współrzędne z położenia, jak w modelach z Blendera, więc się nie rozjeżdżają.
 * Odległość przełączenia wynika z błędu poziomu: prostszy poziom pokazujemy dopiero, gdy różnica na ekranie jest mniejsza
 * niż ułamek piksela (ile — zależy od jakości grafiki: minimum przełącza blisko, Ultra bardzo daleko).
 */

/** Grupy budynku, które tworzą „wieko” (znikają przy podglądzie wnętrza) */
const LIDS = new Set(['shell', 'roof', 'chimney']);
/** Kroki błędu kolejnych poziomów (każdy liczony z poprzedniego): łącznie ok. 0.006 / 0.02 / 0.05 jednostki */
export const LOD_STEPS = [0.006, 0.014, 0.03];
/** Budynki mniejsze od tego (trójkąty brył zewnętrznych) nie dostają dalekiej wersji — szkoda zachodu */
const MIN_TRIS = 800;

let ready = false;
export const lodReady: Promise<void> = coreReady.then(() => { ready = true; }, () => {});

export interface LodLevel { obj: THREE.Group; lid: THREE.Group; tris: number; error: number; calls: number }
export interface BuildingLod {
  /** Szczegółowe siatki, które z daleka chowamy */
  parts: THREE.Mesh[];
  /** Uproszczone wersje, od najbliższej do najdalszej (puste, dopóki się nie policzą) */
  levels: LodLevel[];
  /** Trójkąty pełnych brył zewnętrznych */
  full: number;
  /** Aktualnie widoczny poziom: -1 = pełny model */
  level: number;
  /** Klucz do pamięci policzonych wersji (rodzaj budynku + materiały + liczby wierzchołków) */
  sig: string;
  /** Środek i promień brył (w układzie budynku) — do liczenia odległości od kamery */
  center: THREE.Vector3;
  radius: number;
  /** Pierwsza grupa wieka: jej widoczność (dach zdjęty / na miejscu) przenosimy na daleką wersję */
  lidRef: THREE.Object3D | null;
}

export interface LodOptions {
  /** Materiały, których nie łączymy z innymi (np. okna świecące nocą) */
  keep?: (m: THREE.Material) => boolean;
  /** Materiały moknące w deszczu (łączymy tylko mokre z mokrymi) */
  wet?: (m: THREE.Material) => boolean;
}

const triCount = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.attributes.position!.count) / 3;

/** Bryły zewnętrzne: siatki bez nazwy w korzeniu albo w grupach wieka (bez względu na to, czy dach jest akurat zdjęty) */
function collect(root: THREE.Object3D): { mesh: THREE.Mesh; lid: boolean }[] {
  const out: { mesh: THREE.Mesh; lid: boolean }[] = [];
  const walk = (o: THREE.Object3D, lid: boolean): void => {
    for (const ch of o.children) {
      // nazwane części (wnętrze, sufit, skrzydła wrót, ludzie, zapasy, szyby…) zostają; grupy wieka bierzemy zawsze
      if (ch.name ? !LIDS.has(ch.name) : !ch.visible) continue;
      if (ch.userData.lod) continue;
      const m = ch as THREE.Mesh;
      if (m.isMesh && !ch.name) {
        const mat = m.material as THREE.Material;
        if (!(m as THREE.InstancedMesh).isInstancedMesh && !(m as unknown as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(m.material)
          && mat.visible && !mat.transparent && m.geometry.attributes.position && triCount(m.geometry) >= 1) out.push({ mesh: m, lid });
      }
      walk(ch, lid || LIDS.has(ch.name));
    }
  };
  walk(root, false);
  return out;
}

/** Przygotowuje budynek do przełączania (bez liczenia wersji): null, gdy budynek jest za mały */
export function prepareLod(root: THREE.Object3D, kind: string): BuildingLod | null {
  const found = collect(root);
  let full = 0;
  for (const p of found) full += triCount(p.mesh.geometry);
  if (full < MIN_TRIS) return null;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), b = new THREE.Box3(), m4 = new THREE.Matrix4();
  for (const { mesh } of found) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.union(b.copy(mesh.geometry.boundingBox!).applyMatrix4(m4.multiplyMatrices(inv, mesh.matrixWorld)));
  }
  const sig = kind + '|' + found.map((p) => (p.lid ? 'L' : 'R') + (p.mesh.material as THREE.Material).uuid.slice(0, 8) + ':' + p.mesh.geometry.attributes.position!.count).join(',');
  let lidRef: THREE.Object3D | null = null;
  root.traverse((o) => { if (!lidRef && o !== root && LIDS.has(o.name) && !(o as THREE.Mesh).isMesh) lidRef = o; });
  return {
    parts: found.map((p) => p.mesh), levels: [], full, level: -1, sig,
    center: box.getCenter(new THREE.Vector3()), radius: box.getSize(new THREE.Vector3()).length() / 2, lidRef,
  };
}

/** Policzone wersje jednego rodzaju budynku: wspólne geometrie, materiały z pierwszego egzemplarza */
interface Baked { levels: { geos: { geo: THREE.BufferGeometry; mat: THREE.Material; lid: boolean }[]; tris: number; error: number }[] }
interface Gathered { buckets: BucketData[]; mats: THREE.Material[]; lids: boolean[] }

const cache = new Map<string, Baked>();
const pending = new Map<string, number>();
/** Statystyki do okna wydajności */
export const lodStats = { baked: 0, bakeMs: 0, worker: false };

/** Klucz łączenia: materiały różniące się tylko barwą (ta sama tekstura, połysk, strona) trafiają do jednej siatki */
function foldKey(m: THREE.Material, o: LodOptions): string {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || o.keep?.(m) || s.alphaTest > 0 || s.emissiveMap || (s.emissive && s.emissive.getHex() !== 0)) return 'own:' + m.uuid;
  if (Math.min(s.color.r, s.color.g, s.color.b) < 0.02) return 'own:' + m.uuid; // za ciemny na wzorzec barwy
  const tex = (t: THREE.Texture | null): string => (t ? t.uuid : '-');
  return [s.type, tex(s.map), tex(s.normalMap), tex(s.bumpMap), tex(s.roughnessMap), s.side, s.flatShading, s.roughness.toFixed(2), s.metalness.toFixed(2),
    s.bumpScale, (m.userData.tile as number) || 1, o.wet?.(m) ? 'wet' : 'dry', s.vertexColors ? 'vc' : 'c' + s.color.getHexString()].join('|');
}

/** Zbiera trójkąty brył w układzie budynku, pogrupowane po materiale (wieko osobno) */
function gather(root: THREE.Object3D, lod: BuildingLod, o: LodOptions): Gathered {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const lidSet = new Set(collect(root).filter((p) => p.lid).map((p) => p.mesh));
  type Acc = { mat: THREE.Material; lid: boolean; k: number; members: THREE.Material[]; items: { mesh: THREE.Mesh; member: number }[]; n: number };
  const accs = new Map<string, Acc>();
  for (const mesh of lod.parts) {
    const mat = mesh.material as THREE.Material;
    const lid = lidSet.has(mesh);
    const key = (lid ? 'L|' : 'R|') + foldKey(mat, o);
    let a = accs.get(key);
    if (!a) { a = { mat, lid, k: (mat.userData.tile as number) || 1, members: [], items: [], n: 0 }; accs.set(key, a); }
    let mi = a.members.indexOf(mat);
    if (mi < 0) { mi = a.members.length; a.members.push(mat); }
    if (mi > 255) continue;
    a.items.push({ mesh, member: mi });
    a.n += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position!.count);
  }
  const out: Gathered = { buckets: [], mats: [], lids: [] };
  const rel = new THREE.Matrix4(), e = rel.elements;
  for (const a of accs.values()) {
    const pos = new Float32Array(a.n * 3), col = new Float32Array(a.n * 3), member = new Uint8Array(a.n);
    let w = 0;
    const ref = (a.mat as THREE.MeshStandardMaterial).color;
    for (const { mesh, member: mi } of a.items) {
      rel.multiplyMatrices(inv, mesh.matrixWorld);
      const flip = rel.determinant() < 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // barwa względem materiału-wzorca: łączone materiały różnią się tylko kolorem
      const src = mat.color;
      const kr = src && ref ? src.r / ref.r : 1, kg = src && ref ? src.g / ref.g : 1, kb = src && ref ? src.b / ref.b : 1;
      const geo = mesh.geometry, P = geo.attributes.position as THREE.BufferAttribute, C = mat.vertexColors ? (geo.attributes.color as THREE.BufferAttribute | undefined) : undefined;
      const idx = geo.index, n = idx ? idx.count : P.count;
      for (let t = 0; t < n; t += 3) for (let c = 0; c < 3; c++) {
        const i = idx ? idx.getX(t + (flip ? 2 - c : c)) : t + (flip ? 2 - c : c);
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        pos[w * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        pos[w * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        pos[w * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
        col[w * 3] = (C ? C.getX(i) : 1) * kr; col[w * 3 + 1] = (C ? C.getY(i) : 1) * kg; col[w * 3 + 2] = (C ? C.getZ(i) : 1) * kb;
        member[w] = mi;
        w++;
      }
    }
    out.buckets.push({ pos, col, member, k: a.k });
    out.mats.push(a.mat);
    out.lids.push(a.lid);
  }
  return out;
}

function toBaked(g: Gathered, levels: LevelData[]): Baked {
  return {
    levels: levels.map((l) => ({
      tris: l.tris, error: l.error,
      geos: l.geos.flatMap((d, i) => {
        if (!d) return [];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(d.P, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(d.N, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(d.C, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(d.UV, 2));
        geo.computeBoundingSphere();
        return [{ geo, mat: g.mats[i]!, lid: g.lids[i]! }];
      }),
    })),
  };
}

// ---------------- wątek w tle ----------------
let worker: Worker | null | undefined;
let jobId = 0;
const jobs = new Map<number, { sig: string; g: Gathered; t0: number }>();
function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(new URL('./lodworker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; levels?: LevelData[]; error?: string }>): void => {
      const job = jobs.get(e.data.id);
      if (!job) return;
      jobs.delete(e.data.id);
      pending.delete(job.sig);
      if (!e.data.levels) return; // nie wyszło: budynek zostaje w pełnej wersji
      cache.set(job.sig, toBaked(job.g, e.data.levels));
      lodStats.baked++;
      lodStats.bakeMs = performance.now() - job.t0;
    };
    // wątek się nie wczytał: liczymy na miejscu (krótkie przycięcie raz na rodzaj budynku)
    w.onerror = (): void => { worker = null; for (const j of jobs.values()) pending.delete(j.sig); jobs.clear(); };
    worker = w;
    lodStats.worker = true;
  } catch { worker = null; }
  return worker;
}

/**
 * Dopina policzone wersje do budynku. Gdy dla tego rodzaju jeszcze ich nie ma, zleca liczenie (w tle, gdy się da)
 * i zwraca false — budynek do tego czasu zostaje w pełnej wersji. `sync` = licz od razu (podgląd modeli, testy).
 */
export function attachLod(root: THREE.Object3D, lod: BuildingLod, o: LodOptions = {}, sync = false): boolean {
  if (lod.levels.length) return true;
  let baked = cache.get(lod.sig);
  if (!baked) {
    if (pending.has(lod.sig)) return false;
    const w = sync ? null : getWorker();
    const g = gather(root, lod, o);
    if (w) {
      const id = ++jobId;
      pending.set(lod.sig, id);
      jobs.set(id, { sig: lod.sig, g, t0: performance.now() });
      // tablice idą do wątku jako kopie (gather jest nam potrzebny tylko do materiałów)
      w.postMessage({ id, buckets: g.buckets, steps: LOD_STEPS });
      return false;
    }
    if (!ready) return false;
    const t0 = performance.now();
    baked = toBaked(g, simplifyAll(g.buckets, LOD_STEPS));
    lodStats.bakeMs = performance.now() - t0;
    lodStats.baked++;
    cache.set(lod.sig, baked);
  }
  for (let i = 0; i < baked.levels.length; i++) {
    const b = baked.levels[i]!;
    const obj = new THREE.Group();
    obj.name = 'lod' + (i + 1);
    obj.visible = false;
    obj.userData.lod = true;
    const lid = new THREE.Group();
    lid.userData.lod = true;
    obj.add(lid);
    for (const { geo, mat, lid: isLid } of b.geos) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => {}; // klikanie trafia w pełny model (też schowany), nie liczymy dwa razy
      m.userData.lod = true;
      (isLid ? lid : obj).add(m);
    }
    root.add(obj);
    lod.levels.push({ obj, lid, tris: b.tris, error: b.error, calls: b.geos.length });
  }
  return true;
}

/** Przełącza widoczny poziom (−1 = pełny model); wieko dalekiej wersji idzie za dachem pełnego modelu */
export function showLod(lod: BuildingLod, level: number): void {
  level = Math.min(level, lod.levels.length - 1);
  if (level !== lod.level) {
    for (const p of lod.parts) p.visible = level < 0;
    lod.levels.forEach((l, i) => { l.obj.visible = i === level; });
    lod.level = level;
  }
  if (level >= 0) lod.levels[level]!.lid.visible = lod.lidRef ? lod.lidRef.visible : true;
}

/**
 * Odległość (w jednostkach świata), od której wolno pokazać poziom o danym błędzie: błąd rzutowany na ekran
 * ma być mniejszy niż `px` pikseli. fovDeg — pionowy kąt kamery, screenH — wysokość obrazu w pikselach.
 */
export function lodDistance(error: number, fovDeg: number, screenH: number, px: number): number {
  return (error * screenH) / (2 * Math.tan((fovDeg * Math.PI) / 360) * px);
}

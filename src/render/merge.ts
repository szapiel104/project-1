/**
 * Scalanie nieruchomych części budynków w mniej siatek (wyniesione z scene.ts, 24.10.2026).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Grupy, w których też łączymy bryły (ściany i dach znikają w całości przy podglądzie wnętrza, więc wspólna siatka nic nie psuje) */
export const MERGE_IN = new Set(['shell', 'roof', 'chimney', 'spin', 'flagpole']);
/** Wspólne scalone siatki dla budynków tego samego rodzaju: dzięki temu wszystkie chaty mają te same siatki i karta rysuje je razem */
export const mergedCache = new Map<string, THREE.BufferGeometry>();
/** Warstwa, na którą odkładamy bryły budynków rysowane wspólnie (nie 1 — tę rysuje mapa cieni, SHADOW_LAYER) */
export const BATCH_LAYER = 5;
/**
 * Łączy nieruchome części budynku o tym samym materiale w jedną siatkę: zamiast kilkudziesięciu
 * wywołań rysowania na budynek jest kilka. Części nazwane (dach, wnętrze, skrzydła młyna, pochodnia…)
 * zostają osobno, bo animacje i podgląd wnętrza ich szukają.
 */
export function mergeStatic(root: THREE.Object3D, kind = ''): void {
  root.updateMatrixWorld(true);
  // klucz: grupa, do której trafi wspólna siatka (korzeń albo „shell” / „roof” / „chimney”) + materiał
  const groups = new Map<THREE.Object3D, Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>>();
  const m4 = new THREE.Matrix4();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.name || !m.visible) return;
    // wszystko pod inną nazwaną grupą zostaje nietknięte (animacje, wnętrza, zapasy w składzie, ludzie w twierdzy)
    let into: THREE.Object3D | null = null;
    for (let p: THREE.Object3D | null = m.parent; p; p = p.parent) {
      if (p === root) { into ??= root; break; }
      if (!p.visible) return;
      if (p.name) { if (!MERGE_IN.has(p.name)) return; into ??= p; }
    }
    if (!into) return;
    m4.copy(into.matrixWorld).invert().multiply(m.matrixWorld);
    if (m4.determinant() <= 0) return; // lustrzane odbicie odwróciłoby ściany
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m4);
    let byMat = groups.get(into); if (!byMat) { byMat = new Map(); groups.set(into, byMat); }
    let e = byMat.get(m.material); if (!e) { e = { geos: [], meshes: [] }; byMat.set(m.material, e); }
    e.geos.push(g); e.meshes.push(m);
  });
  for (const [into, byMat] of groups) for (const [mat, e] of byMat) {
    if (e.meshes.length < 2) { for (const g of e.geos) g.dispose(); continue; }
    // wspólne atrybuty muszą się zgadzać; inaczej zostawiamy jak jest
    const keys = Object.keys(e.geos[0]!.attributes).sort().join();
    if (e.geos.some((g) => Object.keys(g.attributes).sort().join() !== keys)) { for (const g of e.geos) g.dispose(); continue; }
    for (const g of e.geos) g.morphAttributes = {};
    let verts = 0;
    for (const g of e.geos) verts += g.getAttribute('position').count;
    const ck = kind ? kind + '|' + (into === root ? '' : into.name) + '|' + mat.uuid + '|' + e.meshes.length + '|' + verts : '';
    const merged = (ck && mergedCache.get(ck)) || mergeGeometries(e.geos);
    if (ck && merged && !mergedCache.has(ck)) mergedCache.set(ck, merged);
    for (const g of e.geos) g.dispose();
    if (!merged) continue;
    const one = new THREE.Mesh(merged, mat);
    one.castShadow = e.meshes.some((m) => m.castShadow);
    one.receiveShadow = true;
    one.userData.merged = true;
    one.userData.shared = !!ck; // wspólna dla wszystkich budynków tego rodzaju: nie zwalniać przy rozbiórce
    into.add(one);
    for (const m of e.meshes) m.parent?.remove(m);
  }
}

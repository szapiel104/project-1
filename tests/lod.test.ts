import { expect, it } from 'vitest';
import * as THREE from 'three';
import { buildingModel, isWetMat, isWindowMat } from '../src/render/buildings';
import { BUILDINGS } from '../src/data/buildings';
import { attachLod, lodDistance, lodReady, prepareLod, showLod } from '../src/render/lod';

/** Wymiary widocznych brył (bez nazwanych części, których daleka wersja nie rusza) */
function size(root: THREE.Object3D, only: (m: THREE.Mesh) => boolean): THREE.Vector3 {
  const b = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh || !only(m)) return;
    b.expandByObject(m, true); // dokładnie, po wierzchołkach (obrócone pudełko pudełka byłoby za duże)
  });
  return b.getSize(new THREE.Vector3());
}

it('daleka wersja budynków: dużo mniej trójkątów, ten sam obrys, wieko osobno', async () => {
  await lodReady;
  const rows: string[] = [];
  let full = 0, far = 0;
  for (const def of BUILDINGS) {
    const g = buildingModel(def.id, 0xa32a22);
    const lod = prepareLod(g, def.id);
    if (!lod) continue;
    const t0 = performance.now();
    expect(attachLod(g, lod, { keep: isWindowMat, wet: isWetMat }, true)).toBe(true);
    const ms = performance.now() - t0;
    expect(lod.levels.length).toBe(3);
    const parts = new Set(lod.parts);
    const ref = size(g, (m) => parts.has(m));
    const row = lod.levels.map((l, i) => {
      showLod(lod, i);
      const s = size(g, (m) => !!m.userData.lod);
      // obrys się nie kurczy bardziej niż o kilka błędów poziomu (cienkie drągi i flagi mogą zniknąć)
      for (const k of ['x', 'y', 'z'] as const) expect(s[k], `${def.id} L${i + 1} ${k}`).toBeGreaterThan(ref[k] - Math.max(0.25, l.error * 10));
      for (const k of ['x', 'y', 'z'] as const) expect(s[k]).toBeLessThan(ref[k] + 1e-3);
      return `L${i + 1} ${String(l.tris).padStart(5)} (${String(Math.round((100 * l.tris) / lod.full)).padStart(3)}%) błąd ${l.error.toFixed(3)} wywołań ${l.calls}`;
    });
    // poziomy coraz prostsze
    for (let i = 1; i < lod.levels.length; i++) expect(lod.levels[i]!.tris).toBeLessThanOrEqual(lod.levels[i - 1]!.tris);
    expect(lod.levels[2]!.tris).toBeLessThan(lod.full * 0.6);
    // z daleka szczegółowe bryły znikają, z bliska wracają
    showLod(lod, 2);
    expect(lod.parts.every((p) => !p.visible)).toBe(true);
    showLod(lod, -1);
    expect(lod.parts.every((p) => p.visible)).toBe(true);
    expect(lod.levels.every((l) => !l.obj.visible)).toBe(true);
    // zdjęty dach: daleka wersja też bez wieka
    if (lod.lidRef) { showLod(lod, 1); lod.lidRef.visible = false; showLod(lod, 1); expect(lod.levels[1]!.lid.visible).toBe(false); lod.lidRef.visible = true; showLod(lod, -1); }
    full += lod.full; far += lod.levels[1]!.tris;
    rows.push(`${def.id.padEnd(11)} pełny ${String(lod.full).padStart(6)} | ${row.join(' | ')} | ${ms.toFixed(0)} ms`);
  }
  console.log(rows.join('\n'));
  console.log(`razem: pełne ${full}, poziom 2: ${far} (${Math.round((100 * far) / full)}%)`);
  expect(far).toBeLessThan(full * 0.4);
});

it('odległość przełączenia rośnie z jakością (mniejszy dopuszczalny błąd w pikselach)', () => {
  const near = lodDistance(0.02, 38, 1000, 2), far = lodDistance(0.02, 38, 1000, 0.3);
  expect(far).toBeGreaterThan(near * 6);
  // błąd 0,02 jednostki na 1000 px, kąt 38°: pół piksela w odległości ~58 pól
  expect(lodDistance(0.02, 38, 1000, 0.5)).toBeCloseTo(58, 0);
});

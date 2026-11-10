/**
 * Przyciąganie do krawędzi innych przedmiotów przy przesuwaniu z Shiftem (Michał 10.11.2026: „jak przytrzymam Shift,
 * to mogę równać względem ścian innego, pokazują się kreski i wyrówna się względem ścian — lewo, prawo, góra, dół”).
 * Dla każdej osi porównujemy lewą krawędź, środek i prawą krawędź przesuwanego pudełka z krawędziami i środkami
 * pudełek obok; najbliższa para w zasięgu wygrywa, a przez wyrównane miejsce rysujemy kreskę prowadzącą.
 */
import * as THREE from 'three';

type Axis = 'x' | 'y' | 'z';
const AXES: Axis[] = ['x', 'y', 'z'];
const vals = (b: THREE.Box3, a: Axis): number[] => [b.min[a], (b.min[a] + b.max[a]) / 2, b.max[a]];

export interface SnapHit { axis: Axis; value: number; other: THREE.Box3 }

/** Poprawka położenia (w świecie) dla przesuwanego pudełka i lista trafień do narysowania kresek */
export function snapBox(moved: THREE.Box3, cands: THREE.Box3[], thr: number, groundY?: number): { corr: THREE.Vector3; hits: SnapHit[] } {
  const corr = new THREE.Vector3(), hits: SnapHit[] = [];
  // tylko pudełka w pobliżu (inaczej kreski do drugiego końca budynku)
  const near = moved.clone().expandByScalar(Math.max(thr * 40, 0.3));
  const close = cands.filter((b) => b.intersectsBox(near));
  for (const a of AXES) {
    let best = thr, d = 0, hit: SnapHit | null = null;
    const mine = vals(moved, a);
    for (const b of close) {
      const theirs = vals(b, a);
      for (const m of mine) for (const t of theirs) {
        const dd = t - m;
        if (Math.abs(dd) < best) { best = Math.abs(dd); d = dd; hit = { axis: a, value: t, other: b }; }
      }
    }
    // spód na ziemi (wysokość 0 modelu)
    if (a === 'y' && groundY !== undefined && Math.abs(groundY - moved.min.y) < best) {
      d = groundY - moved.min.y;
      const g = moved.clone(); g.min.y = g.max.y = groundY;
      hit = { axis: 'y', value: groundY, other: g.expandByScalar(0.15) };
    }
    if (hit) { corr[a] = d; hits.push(hit); }
  }
  return { corr, hits };
}

/** Kreski prowadzące: przez wyrównaną płaszczyznę, od przesuwanego pudełka do tego, do którego się wyrównało */
export function createGuides(scene: THREE.Scene): { show: (moved: THREE.Box3, hits: SnapHit[]) => void; hide: () => void } {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 6), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xff4fd8, depthTest: false, transparent: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 1000; lines.frustumCulled = false; lines.visible = false;
  scene.add(lines);
  return {
    show(moved, hits) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      let k = 0;
      for (const h of hits.slice(0, 3)) {
        const u = new THREE.Box3().copy(moved).union(h.other), c = moved.getCenter(new THREE.Vector3());
        // kreska leży w płaszczyźnie wyrównania, wzdłuż osi, w której oba pudełka są najdalej od siebie
        const others = AXES.filter((a) => a !== h.axis);
        const along = (u.max[others[0]!] - u.min[others[0]!]) >= (u.max[others[1]!] - u.min[others[1]!]) ? others[0]! : others[1]!;
        const p0 = c.clone(), p1 = c.clone();
        p0[h.axis] = p1[h.axis] = h.value;
        p0[along] = u.min[along] - 0.02; p1[along] = u.max[along] + 0.02;
        pos.setXYZ(k++, p0.x, p0.y, p0.z); pos.setXYZ(k++, p1.x, p1.y, p1.z);
      }
      for (; k < 6; k++) pos.setXYZ(k, 0, 0, 0);
      pos.needsUpdate = true;
      geo.setDrawRange(0, hits.length ? Math.min(hits.length, 3) * 2 : 0);
      lines.visible = hits.length > 0;
    },
    hide() { lines.visible = false; },
  };
}

import * as THREE from 'three';

/**
 * Spis sceny do testów przebudowy kodu rysowania (np. podziału scene.ts): każdy obiekt sceny opisany tym,
 * co widać na ekranie — rodzaj, nazwa, widoczność, siatka, materiał, położenie w świecie i położenia kopii (instancje).
 * Przy zatrzymanym czasie gry spis przed i po przebudowie ma wyjść taki sam (kolejność obiektów nie gra roli).
 * W trybie testowym: `__test.census()`.
 */
const r = (n: number): string => (Math.abs(n) < 5e-3 ? '0' : n.toFixed(2));
/** Skrót liczb: FNV-1a po liczbach zaokrąglonych do setnych */
function hashNums(a: ArrayLike<number>, from = 0, to = a.length): string {
  let h = 0x811c9dc5;
  for (let i = from; i < to; i++) {
    const s = r(a[i]!);
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
    h ^= 44; h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function matDesc(m: THREE.Material): string {
  const x = m as THREE.MeshStandardMaterial;
  const c = x.color ? x.color.getHexString() : '-';
  const e = x.emissive ? x.emissive.getHexString() : '-';
  return `${m.type}:${c}:${e}:${x.map ? 'map' : ''}:${r(m.opacity)}:${m.visible ? 1 : 0}`;
}

export interface Census {
  /** Opisy obiektów, posortowane */
  items: string[];
  /** Ile obiektów każdego rodzaju */
  kinds: Record<string, number>;
}

export function census(root: THREE.Object3D): Census {
  root.updateMatrixWorld(true);
  const items: string[] = [];
  const kinds: Record<string, number> = {};
  root.traverse((o) => {
    if (o === root) return;
    let vis = o.visible;
    for (let p = o.parent; vis && p; p = p.parent) vis = p.visible;
    // podpis grupy (cat.ts) od najbliższego podpisanego rodzica — żeby różnicę dało się przypisać do części obrazu
    let tag = '';
    for (let p: THREE.Object3D | null = o; p && !tag; p = p.parent) tag = (p.userData.cat as string | undefined) ?? '';
    const parts = [o.type, o.name || '-', vis ? 'v' : 'h', `L${o.layers.mask}`, `C${tag.replace(/\s+/g, '_') || '-'}`, `W${hashNums(o.matrixWorld.elements)}`];
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) {
      const g = mesh.geometry;
      const pos = g.getAttribute('position');
      parts.push(`G${pos?.count ?? 0}/${g.index?.count ?? 0}/${Object.keys(g.attributes).sort().join(',')}`);
      // kształt siatki: skrót kilkuset pierwszych liczb położeń (zmieniane w miejscu siatki, np. trawa, też się liczą)
      if (pos) parts.push(`P${hashNums(pos.array as ArrayLike<number>, 0, Math.min(pos.array.length, 600))}`);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      parts.push(`M${mats.filter(Boolean).map(matDesc).join('|')}`);
    }
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      parts.push(`I${inst.count}`, `IM${hashNums(inst.instanceMatrix.array, 0, inst.count * 16)}`);
      if (inst.instanceColor) parts.push(`IC${hashNums(inst.instanceColor.array, 0, inst.count * 3)}`);
    }
    const light = o as THREE.Light;
    if (light.isLight) parts.push(`Li${r(light.intensity)}:${light.color.getHexString()}`);
    const key = `${o.type}${vis ? '' : '(ukryte)'}`;
    kinds[key] = (kinds[key] ?? 0) + 1;
    items.push(parts.join(' '));
  });
  items.sort();
  return { items, kinds };
}

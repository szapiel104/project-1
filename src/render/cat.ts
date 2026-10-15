import type * as THREE from 'three';

/**
 * Podpis grupy rzeczy na scenie do okna wydajności (F3): „las: korony”, „budynki”, „postacie: chłop”…
 * Siatka bez podpisu bierze go od najbliższego podpisanego rodzica.
 */
export function cat<T extends THREE.Object3D>(o: T, name: string): T {
  o.userData.cat = name;
  return o;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingModel } from './buildings';

/**
 * Proceduralne modele z prostych brył. Każdy model powstaje przez tę fabrykę,
 * więc późniejsza podmiana na pliki glTF nie dotyka reszty renderera.
 */
export interface ModelFactory {
  /** Świerk: pień i korona z kilku pięter */
  treeTrunk(): THREE.BufferGeometry;
  treeCrown(): THREE.BufferGeometry;
  /** Drzewo liściaste */
  leafTrunk(): THREE.BufferGeometry;
  leafCrown(): THREE.BufferGeometry;
  /** Kępka trawy */
  tuft(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  building(id: string, teamColor: number): THREE.Group;
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => g.translate(x, y, z);

export const proceduralModels: ModelFactory = {
  treeTrunk() {
    return at(new THREE.CylinderGeometry(0.06, 0.11, 0.55, 6), 0, 0.27, 0);
  },
  treeCrown() {
    // trzy piętra gałęzi, każde węższe i lekko obrócone
    return mergeGeometries([
      at(new THREE.ConeGeometry(0.42, 0.55, 7), 0, 0.62, 0),
      at(new THREE.ConeGeometry(0.33, 0.5, 7).rotateY(0.5), 0, 0.95, 0),
      at(new THREE.ConeGeometry(0.22, 0.5, 7).rotateY(1), 0, 1.28, 0),
    ]);
  },
  leafTrunk() {
    return mergeGeometries([
      at(new THREE.CylinderGeometry(0.07, 0.12, 0.6, 6), 0, 0.3, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 5).rotateZ(0.8), -0.13, 0.62, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 5).rotateZ(-0.8), 0.13, 0.66, 0.02),
    ]);
  },
  leafCrown() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.36, 1), 0, 0.95, 0),
      at(new THREE.IcosahedronGeometry(0.26, 1), -0.27, 0.8, 0.08),
      at(new THREE.IcosahedronGeometry(0.27, 1), 0.26, 0.84, -0.06),
      at(new THREE.IcosahedronGeometry(0.22, 1), 0.02, 0.82, 0.27),
    ]);
  },
  tuft() {
    const blade = (rot: number, lean: number): THREE.BufferGeometry =>
      new THREE.ConeGeometry(0.035, 0.22, 3).translate(0, 0.11, 0).rotateZ(lean).rotateY(rot);
    return mergeGeometries([blade(0, 0.25), blade(2.1, -0.3), blade(4.2, 0.15), blade(1, -0.1)]);
  },
  rock() {
    const g = new THREE.DodecahedronGeometry(0.34, 0);
    g.scale(1, 0.7, 1);
    g.translate(0, 0.12, 0);
    return g;
  },
  building: buildingModel,
};

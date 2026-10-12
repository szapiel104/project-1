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
  /** Krzew */
  bush(): THREE.BufferGeometry;
  /** Kwiat polny (sama główka z łodyżką) */
  flower(): THREE.BufferGeometry;
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
    // gęstsza kępa: siedem źdźbeł różnej długości rozchylonych na boki
    const blade = (rot: number, lean: number, len: number): THREE.BufferGeometry =>
      new THREE.ConeGeometry(0.03, len, 3).translate(0, len / 2, 0).rotateZ(lean).rotateY(rot);
    return mergeGeometries([blade(0, 0.28, 0.24), blade(0.9, -0.2, 0.3), blade(1.8, 0.35, 0.2), blade(2.7, -0.3, 0.26), blade(3.6, 0.18, 0.32), blade(4.5, -0.38, 0.2), blade(5.4, 0.1, 0.27)]);
  },
  bush() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.24, 1), 0, 0.2, 0),
      at(new THREE.IcosahedronGeometry(0.18, 1), -0.2, 0.15, 0.06),
      at(new THREE.IcosahedronGeometry(0.19, 1), 0.19, 0.16, -0.05),
      at(new THREE.IcosahedronGeometry(0.15, 1), 0.03, 0.14, 0.2),
    ]);
  },
  flower() {
    return mergeGeometries([
      new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3).translate(0, 0.08, 0).toNonIndexed(),
      new THREE.IcosahedronGeometry(0.04, 0).scale(1, 0.6, 1).translate(0, 0.17, 0),
    ]);
  },
  rock() {
    // głaz z nierównymi ścianami: wierzchołki przesunięte zależnie od położenia, więc bryła pozostaje szczelna
    const g = new THREE.IcosahedronGeometry(0.34, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.82 + (Math.sin(x * 37.1 + y * 11.7) * Math.cos(z * 29.3 - x * 5.1) + 1) * 0.16;
      p.setXYZ(i, x * k, Math.max(y * k, -0.12), z * k);
    }
    g.computeVertexNormals();
    g.scale(1, 0.7, 1);
    g.translate(0, 0.12, 0);
    return g;
  },
  building: buildingModel,
};

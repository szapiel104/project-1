import * as THREE from 'three';
import { buildingModel } from './buildings';

/**
 * Proceduralne modele z prostych brył. Każdy model powstaje przez tę fabrykę,
 * więc późniejsza podmiana na pliki glTF nie dotyka reszty renderera.
 */
export interface ModelFactory {
  treeTrunk(): THREE.BufferGeometry;
  treeCrown(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  building(id: string, teamColor: number): THREE.Group;
}


export const proceduralModels: ModelFactory = {
  treeTrunk() {
    const g = new THREE.CylinderGeometry(0.07, 0.1, 0.5, 5);
    g.translate(0, 0.25, 0);
    return g;
  },
  treeCrown() {
    const g = new THREE.ConeGeometry(0.36, 1.1, 6);
    g.translate(0, 0.95, 0);
    return g;
  },
  rock() {
    const g = new THREE.DodecahedronGeometry(0.34, 0);
    g.scale(1, 0.7, 1);
    g.translate(0, 0.12, 0);
    return g;
  },
  building: buildingModel,
};

import * as THREE from 'three';

/**
 * Proceduralne modele z prostych brył. Każdy model powstaje przez tę fabrykę,
 * więc późniejsza podmiana na pliki glTF nie dotyka reszty renderera.
 */
export interface ModelFactory {
  treeTrunk(): THREE.BufferGeometry;
  treeCrown(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  keep(teamColor: number): THREE.Object3D;
}

const stone = new THREE.MeshLambertMaterial({ color: 0xb9b2a0, flatShading: true });
const stoneDark = new THREE.MeshLambertMaterial({ color: 0x8f8877, flatShading: true });
const wood = new THREE.MeshLambertMaterial({ color: 0x5b4027, flatShading: true });

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
  keep(teamColor: number) {
    const group = new THREE.Group();
    const roof = new THREE.MeshLambertMaterial({ color: teamColor, flatShading: true });

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 3.2), stone);
    base.position.y = 0.8;
    group.add(base);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.9), stoneDark);
    hall.position.y = 2.35;
    group.add(hall);

    const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.2, 4), roof);
    hallRoof.position.y = 3.7;
    hallRoof.rotation.y = Math.PI / 4;
    group.add(hallRoof);

    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.6, 8), stone);
      tower.position.set(sx * 1.6, 1.3, sz * 1.6);
      group.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.9, 8), roof);
      cap.position.set(sx * 1.6, 3.05, sz * 1.6);
      group.add(cap);
    }

    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.12), wood);
    gate.position.set(0, 0.5, 1.62);
    group.add(gate);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), wood);
    pole.position.y = 4.9;
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.03), roof);
    flag.position.set(0.37, 5.35, 0);
    group.add(flag);

    return group;
  },
};

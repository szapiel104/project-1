import * as THREE from 'three';

const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });
const M = {
  stone: mat(0xb9b2a0), stoneDark: mat(0x8f8877), wood: mat(0x6b4a2b), woodDark: mat(0x4a3320),
  plaster: mat(0xe6d9b8), thatch: mat(0xb8973f), soil: mat(0x6e5232), wheat: mat(0xd9b84a),
  leaf: mat(0x3f7a33), apple: mat(0xb3261e), iron: mat(0x4a4038), white: mat(0xf1ead8),
};

function box(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

/** Dach dwuspadowy: graniastosłup o podstawie trójkąta */
function gable(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, y: number, x = 0, z = 0): void {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  geo.rotateX(-Math.PI / 2); // trójkąt pionowo, wierzchołkiem do góry
  geo.rotateY(Math.PI / 2); // kalenica wzdłuż osi X
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(w, h / 1.5, d / 1.732);
  mesh.position.set(x, y + h / 3, z);
  g.add(mesh);
}

function pyramid(g: THREE.Group, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, sides = 4): void {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = Math.PI / sides;
  g.add(mesh);
}

function hut(g: THREE.Group, wall: THREE.Material, roof: THREE.Material, w: number, d: number, h: number, x = 0, z = 0): void {
  box(g, wall, w, h, d, x, 0, z);
  gable(g, roof, w * 1.12, h * 0.75, d * 1.15, h, x, z);
  box(g, M.woodDark, w * 0.22, h * 0.6, 0.05, x, 0, z + d / 2 + 0.01);
}

type Builder = (g: THREE.Group, team: THREE.Material) => void;

/** Modele budynków z brył. Klucz = id z data/buildings.ts. Początek układu = środek działki, 1 = jedno pole. */
const BUILDERS: Record<string, Builder> = {
  keep(g, team) {
    box(g, M.stone, 2.5, 1.4, 2.5);
    box(g, M.stoneDark, 1.5, 1.3, 1.5, 0, 1.4, 0);
    pyramid(g, team, 1.25, 1.0, 0, 2.7, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.3, 8), M.stone);
      t.position.set(sx * 1.2, 1.15, sz * 1.2);
      g.add(t);
      pyramid(g, team, 0.56, 0.75, sx * 1.2, 2.3, sz * 1.2, 8);
    }
    box(g, M.woodDark, 0.6, 0.85, 0.08, 0, 0, 1.27);
    box(g, M.woodDark, 0.05, 1.2, 0.05, 0, 3.7, 0);
    box(g, team, 0.6, 0.34, 0.03, 0.32, 4.5, 0);
  },
  house(g, team) {
    hut(g, M.plaster, M.thatch, 1.5, 1.3, 0.8);
    box(g, team, 0.3, 0.3, 0.04, 0.45, 0.35, 0.67);
  },
  stockpile(g) {
    box(g, M.soil, 1.8, 0.06, 1.8);
    for (let i = 0; i < 3; i++) box(g, M.wood, 0.75, 0.16, 0.16, -0.4, 0.06 + i * 0.16, -0.5 + i * 0.05);
    box(g, M.stone, 0.5, 0.35, 0.5, 0.45, 0.06, -0.4);
    box(g, M.stoneDark, 0.4, 0.3, 0.4, 0.5, 0.06, 0.4);
    box(g, M.iron, 0.4, 0.22, 0.3, -0.45, 0.06, 0.45);
  },
  granary(g, team) {
    box(g, M.wood, 1.4, 1.1, 1.4, 0, 0.25, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.14, 0.25, 0.14, sx * 0.6, 0, sz * 0.6);
    pyramid(g, M.thatch, 1.2, 0.8, 0, 1.35, 0);
    box(g, team, 0.3, 0.3, 0.04, 0, 0.7, 0.72);
  },
  woodcutter(g) {
    hut(g, M.wood, M.woodDark, 1.0, 0.9, 0.65, -0.3, -0.2);
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), M.wood);
      log.rotation.z = Math.PI / 2;
      log.position.set(0.45, 0.1 + (i === 2 ? 0.17 : 0), 0.45 + (i === 2 ? 0.1 : i * 0.21));
      g.add(log);
    }
  },
  quarry(g) {
    box(g, M.stoneDark, 1.8, 0.1, 1.8);
    box(g, M.stone, 0.7, 0.5, 0.6, -0.4, 0.1, -0.4);
    box(g, M.stone, 0.5, 0.35, 0.5, 0.35, 0.1, -0.5);
    box(g, M.stoneDark, 0.45, 0.3, 0.45, -0.5, 0.1, 0.45);
    box(g, M.woodDark, 0.08, 1.3, 0.08, 0.5, 0.1, 0.4);
    const arm = box(g, M.woodDark, 0.9, 0.07, 0.07, 0.15, 1.3, 0.4);
    arm.rotation.z = 0.25;
  },
  mine(g) {
    box(g, M.stoneDark, 1.6, 0.9, 1.3, 0, 0, -0.2);
    pyramid(g, M.stone, 1.2, 0.6, 0, 0.9, -0.2);
    box(g, mat(0x1c1611), 0.6, 0.65, 0.1, 0, 0, 0.46);
    box(g, M.wood, 0.1, 0.75, 0.12, -0.36, 0, 0.5);
    box(g, M.wood, 0.1, 0.75, 0.12, 0.36, 0, 0.5);
    box(g, M.wood, 0.85, 0.1, 0.12, 0, 0.72, 0.5);
  },
  orchard(g) {
    box(g, M.soil, 2.8, 0.05, 2.8).material = mat(0x5f8a3a);
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85], [0, 0]] as const) {
      box(g, M.woodDark, 0.12, 0.45, 0.12, x, 0, z);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), M.leaf);
      crown.position.set(x, 0.75, z);
      g.add(crown);
      box(g, M.apple, 0.1, 0.1, 0.1, x + 0.28, 0.62, z + 0.2);
      box(g, M.apple, 0.1, 0.1, 0.1, x - 0.2, 0.8, z + 0.3);
    }
  },
  farm(g) {
    box(g, M.soil, 2.8, 0.05, 2.8);
    for (let i = 0; i < 6; i++) box(g, M.wheat, 1.7, 0.28, 0.2, 0.45, 0.05, -1.1 + i * 0.44);
    hut(g, M.plaster, M.thatch, 0.7, 0.7, 0.5, -0.95, -0.9);
  },
  mill(g) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.7, 8), M.plaster);
    tower.position.y = 0.85;
    g.add(tower);
    pyramid(g, M.woodDark, 0.65, 0.6, 0, 1.7, 0, 8);
    for (let i = 0; i < 4; i++) {
      const blade = box(g, M.white, 0.16, 1.25, 0.03, 0, 0, 0);
      blade.geometry.translate(0, 0.62, 0);
      blade.position.set(0, 1.35, 0.62);
      blade.rotation.z = (Math.PI / 2) * i + 0.4;
    }
  },
  bakery(g, team) {
    hut(g, M.plaster, mat(0x9c4a2a), 1.4, 1.2, 0.8);
    box(g, M.stoneDark, 0.3, 1.0, 0.3, -0.45, 0.8, -0.3);
    box(g, team, 0.3, 0.3, 0.04, -0.45, 0.35, 0.62);
  },
};

const teamMats = new Map<number, THREE.MeshLambertMaterial>();

export function buildingModel(id: string, teamColor: number): THREE.Group {
  let team = teamMats.get(teamColor);
  if (!team) { team = mat(teamColor); teamMats.set(teamColor, team); }
  const g = new THREE.Group();
  (BUILDERS[id] ?? ((gg) => { box(gg, M.wood, 1, 1, 1); }))(g, team);
  // fundament, żeby budynek nie wisiał nad nierównym terenem
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.soil);
  base.name = 'base';
  g.add(base);
  return g;
}

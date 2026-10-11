import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pattern } from './textures';

type Pattern = Parameters<typeof pattern>[0];
const mat = (color: number, tex?: Pattern): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, map: tex ? pattern(tex) : null });
const M = {
  stone: mat(0xcfc7b3, 'bricks'), stoneDark: mat(0xa39b88, 'bricks'), wood: mat(0x85603a, 'planks'), woodDark: mat(0x5e4329, 'planks'),
  plaster: mat(0xf0e4c4, 'plaster'), thatch: mat(0xd1ad4c, 'thatch'), soil: mat(0x86633d, 'soil'), wheat: mat(0xd9b84a),
  leaf: mat(0x5c9a3c, 'leaves'), apple: mat(0xd0281f), iron: mat(0x4a4038), white: mat(0xf1ead8),
  plank: mat(0xd9b27a, 'planks'),
  orchardGrass: mat(0x86b54a, 'grass'), bark: mat(0x7a5a3a, 'bark'), leafLight: mat(0x7fb548, 'leaves'),
  appleGreen: mat(0xa9c23f), basket: mat(0xb08a4e, 'thatch'), bread: mat(0xb97a3a),
  ember: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  window: mat(0xb08a5a, 'window'),
  smoke: new THREE.MeshLambertMaterial({ color: 0xd8d4c8, flatShading: true, transparent: true, opacity: 0.8 }),
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

/** Chata. Z `open` dach i ściany dają się zdjąć, żeby pokazać wnętrze, gdy ktoś w środku pracuje. */
function hut(g: THREE.Group, wall: THREE.Material, roof: THREE.Material, w: number, d: number, h: number, x = 0, z = 0, open = false): THREE.Group {
  const shell = box(g, wall, w, h, d, x, 0, z);
  const top = new THREE.Group();
  gable(top, roof, w * 1.12, h * 0.75, d * 1.15, h, x, z);
  g.add(top);
  box(g, M.woodDark, w * 0.22, h * 0.6, 0.05, x, 0, z + d / 2 + 0.01);
  const interior = new THREE.Group();
  if (open) {
    shell.name = 'shell';
    top.name = 'roof';
    interior.name = 'interior';
    interior.visible = false;
    box(interior, M.wood, w, 0.05, d, x, 0, z);
    const t = 0.07, low = h * 0.45;
    box(interior, wall, w, low, t, x, 0, z - d / 2 + t / 2);
    box(interior, wall, t, low, d, x - w / 2 + t / 2, 0, z);
    box(interior, wall, t, low, d, x + w / 2 - t / 2, 0, z);
    box(interior, wall, w * 0.3, low, t, x - w * 0.35, 0, z + d / 2 - t / 2);
    box(interior, wall, w * 0.3, low, t, x + w * 0.35, 0, z + d / 2 - t / 2);
    g.add(interior);
  }
  return interior;
}

export const STOCK_LAYERS = 3;
const STOCK_SLOTS = 9;

const part = (geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => geo.translate(x, y, z);
/** Jak wygląda jedna porcja surowca w składzie: deski leżą na deskach, worki na workach. Klucz = id surowca. */
const PILES: Record<string, { geo: THREE.BufferGeometry; color: number }> = {
  wood: {
    color: 0xc9a26b,
    geo: mergeGeometries([0, 1, 2].flatMap((layer) => [-0.12, 0.12].map((z) => part(new THREE.BoxGeometry(0.46, 0.075, 0.21), 0, -0.1 + layer * 0.095, z)))),
  },
  stone: { color: 0xb5b0a2, geo: new THREE.BoxGeometry(0.42, 0.28, 0.42) },
  iron: {
    color: 0x5a5560,
    geo: mergeGeometries([0, 1].flatMap((layer) => [-0.11, 0.11].map((x) => part(new THREE.BoxGeometry(0.17, 0.11, 0.4), x, -0.08 + layer * 0.14, 0)))),
  },
  wheat: {
    color: 0xd9b84a,
    geo: mergeGeometries([-0.11, 0.11].map((x) => part(new THREE.ConeGeometry(0.12, 0.3, 6), x, 0, 0))),
  },
  flour: {
    color: 0xf1ead8,
    geo: mergeGeometries([-0.11, 0.11].map((x) => part(new THREE.IcosahedronGeometry(0.13, 0).scale(0.95, 1.05, 1.3), x, -0.01, 0))),
  },
};
const pileMats = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Układa w składzie stosy surowców. Każdy surowiec dostaje własne miejsca i rośnie w górę,
 * więc widać osobno deski, kamień, żelazo, zboże i mąkę.
 */
export function setStockFill(model: THREE.Object3D, ratio: number, stock: { id: string; share: number }[]): void {
  const fill = model.getObjectByName('fill');
  if (!fill) return;
  const total = STOCK_SLOTS * STOCK_LAYERS;
  const shown = ratio <= 0 ? 0 : Math.max(1, Math.round(Math.min(1, ratio) * total));
  for (const child of fill.children) child.visible = false;
  let slot = 0;
  for (const r of stock) {
    const pile = PILES[r.id];
    if (!pile || slot >= STOCK_SLOTS) continue;
    let items = Math.max(1, Math.round(r.share * shown));
    let m = pileMats.get(r.id);
    if (!m) { m = mat(pile.color); pileMats.set(r.id, m); }
    while (items > 0 && slot < STOCK_SLOTS) {
      for (let layer = 0; layer < STOCK_LAYERS && items > 0; layer++, items--) {
        const mesh = fill.children[layer * STOCK_SLOTS + slot] as THREE.Mesh;
        mesh.geometry = pile.geo;
        mesh.material = m;
        mesh.visible = true;
      }
      slot++;
    }
  }
}

/** Animacje budynków: kręcące się skrzydła młyna i dym z komina, tylko gdy ktoś w środku pracuje. */
export function animateBuilding(model: THREE.Object3D, active: boolean, time: number, dt: number): void {
  const interior = model.getObjectByName('interior');
  if (interior) {
    // ktoś pracuje w środku: zdejmujemy dach i ściany, żeby było go widać
    interior.visible = active;
    for (const name of ['roof', 'shell', 'chimney']) { const part = model.getObjectByName(name); if (part) part.visible = !active; }
  }
  const flame = model.getObjectByName('flame');
  if (flame) { flame.visible = active; flame.scale.set(1, 0.8 + Math.abs(Math.sin(time * 9)) * 0.5, 1); }
  const spin = model.getObjectByName('spin');
  if (spin && active) spin.rotation.z -= dt * 1.6;
  const smoke = model.getObjectByName('smoke');
  if (smoke) {
    smoke.visible = active;
    if (active) smoke.children.forEach((puff, i) => {
      const k = (time * 0.35 + i / smoke.children.length) % 1;
      puff.position.set(Math.sin((k + i) * 5) * 0.12 + k * 0.25, k * 1.5, 0);
      puff.scale.setScalar(0.5 + k * 1.1);
    });
  }
}

type Builder = (g: THREE.Group, team: THREE.Material, flag: THREE.Material) => void;

/** Mała chorągiewka w barwie drużyny (gładka, bez wzoru dachówek) */
function pennant(g: THREE.Group, flag: THREE.Material, x: number, y: number, z: number): void {
  box(g, M.woodDark, 0.03, 0.4, 0.03, x, y, z);
  box(g, flag, 0.24, 0.14, 0.02, x + 0.13, y + 0.25, z);
}

/** Modele budynków z brył. Klucz = id z data/buildings.ts. Początek układu = środek działki, 1 = jedno pole. */
const BUILDERS: Record<string, Builder> = {
  keep(g, team, flag) {
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
    box(g, flag, 0.6, 0.34, 0.03, 0.32, 4.5, 0);
  },
  house(g, _team, flag) {
    const inside = hut(g, M.plaster, M.thatch, 1.5, 1.3, 0.8, 0, 0, true);
    // izba: stół z miską, ławy i łóżko
    box(inside, M.wood, 0.45, 0.22, 0.3, 0.15, 0.05, 0.1);
    box(inside, M.bread, 0.12, 0.05, 0.12, 0.15, 0.27, 0.1);
    box(inside, M.woodDark, 0.4, 0.12, 0.1, 0.15, 0.05, 0.36);
    box(inside, M.woodDark, 0.6, 0.14, 0.3, -0.38, 0.05, -0.42);
    box(inside, M.white, 0.5, 0.06, 0.26, -0.38, 0.19, -0.42);
    box(g, M.window, 0.3, 0.3, 0.04, 0.45, 0.32, 0.66);
    pennant(g, flag, 0.62, 1.15, 0);
  },
  stockpile(g) {
    box(g, M.soil, 1.9, 0.06, 1.9);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.1, 0.5, 0.1, sx * 0.9, 0.06, sz * 0.9);
    // skrzynie pojawiają się w miarę zapełniania: 9 miejsc w 3 warstwach
    const fill = new THREE.Group();
    fill.name = 'fill';
    for (let layer = 0; layer < STOCK_LAYERS; layer++)
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.46), M.wood);
        m.position.set(((i % 3) - 1) * 0.54, 0.06 + 0.15 + layer * 0.31, (Math.floor(i / 3) - 1) * 0.54);
        m.visible = false;
        fill.add(m);
      }
    g.add(fill);
  },
  granary(g, _team, flag) {
    box(g, M.wood, 1.4, 1.1, 1.4, 0, 0.25, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.14, 0.25, 0.14, sx * 0.6, 0, sz * 0.6);
    pyramid(g, M.thatch, 1.2, 0.8, 0, 1.35, 0);
    box(g, M.window, 0.3, 0.3, 0.04, 0, 0.7, 0.71);
    pennant(g, flag, 0, 2.1, 0);
  },
  woodcutter(g) {
    const inside = hut(g, M.wood, M.woodDark, 1.0, 0.9, 0.65, -0.3, -0.2, true);
    // kozioł z kłodą i gotowe deski
    box(inside, M.woodDark, 0.5, 0.2, 0.12, -0.45, 0.05, -0.35);
    const sawn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), M.wood);
    sawn.rotation.z = Math.PI / 2;
    sawn.position.set(-0.45, 0.33, -0.35);
    inside.add(sawn);
    for (let i = 0; i < 3; i++) box(inside, M.plank, 0.5, 0.04, 0.16, -0.05, 0.05 + i * 0.045, -0.45);
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
  camp(g) {
    box(g, M.soil, 1.9, 0.04, 1.9);
    // wiata: cztery słupy i skośny dach nad ławami
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85]] as const) box(g, M.woodDark, 0.09, 1.0, 0.09, x, 0, z);
    for (const [x, z] of [[-0.85, -0.1], [0.85, -0.1]] as const) box(g, M.woodDark, 0.09, 0.75, 0.09, x, 0, z);
    const roof = box(g, M.thatch, 1.95, 0.06, 1.0, 0, 0.88, -0.48);
    roof.rotation.x = 0.33;
    box(g, M.wood, 1.5, 0.06, 0.2, 0, 0.2, -0.62);
    box(g, M.woodDark, 0.08, 0.2, 0.16, -0.6, 0, -0.62);
    box(g, M.woodDark, 0.08, 0.2, 0.16, 0.6, 0, -0.62);
    // kłody do siedzenia wokół ogniska
    for (const [x, z, rot] of [[-0.62, 0.45, 0.5], [0.62, 0.45, -0.5]] as const) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 7), M.bark);
      log.rotation.set(Math.PI / 2, 0, rot);
      log.position.set(x, 0.12, z);
      g.add(log);
    }
    // ognisko: krąg kamieni, polana, żar i dym
    for (let k = 0; k < 7; k++) box(g, M.stoneDark, 0.11, 0.09, 0.11, Math.cos(k * 0.9) * 0.24, 0.04, 0.35 + Math.sin(k * 0.9) * 0.24);
    for (const rot of [0.4, -0.6, 1.5]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 5), M.woodDark);
      stick.rotation.set(Math.PI / 2 - 0.5, rot, 0);
      stick.position.set(0, 0.13, 0.35);
      g.add(stick);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), M.ember);
    flame.position.set(0, 0.26, 0.35);
    flame.name = 'flame';
    g.add(flame);
    const smoke = new THREE.Group();
    smoke.name = 'smoke';
    smoke.position.set(0, 0.5, 0.35);
    for (let i = 0; i < 4; i++) smoke.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.smoke));
    smoke.visible = false;
    g.add(smoke);
  },
  orchard(g) {
    box(g, M.orchardGrass, 2.8, 0.05, 2.8);
    // płotek dookoła z przerwą na wejście
    for (const [x, z, w, d] of [[0, -1.38, 2.8, 0.04], [-1.38, 0, 0.04, 2.8], [1.38, 0, 0.04, 2.8], [-0.85, 1.38, 1.1, 0.04], [0.85, 1.38, 1.1, 0.04]] as const) {
      box(g, M.wood, w, 0.05, d, x, 0.2, z);
      box(g, M.wood, w, 0.05, d, x, 0.36, z);
    }
    for (const [x, z] of [[-1.38, -1.38], [1.38, -1.38], [-1.38, 1.38], [1.38, 1.38], [-0.3, 1.38], [0.3, 1.38], [0, -1.38], [-1.38, 0], [1.38, 0]] as const) box(g, M.woodDark, 0.08, 0.45, 0.08, x, 0.05, z);
    // jabłonie: krzywy pień, korona z kilku kul liści i jabłka na gałęziach
    const spots = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.7], [0.8, 0.7], [0, -0.05]] as const;
    spots.forEach(([x, z], n) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 6), M.bark);
      trunk.position.set(x, 0.3, z);
      trunk.rotation.z = (n % 2 ? 1 : -1) * 0.12;
      g.add(trunk);
      for (const [dx, dy, dz, r] of [[0, 0.82, 0, 0.33], [-0.22, 0.7, 0.08, 0.22], [0.22, 0.72, -0.06, 0.23], [0.02, 0.7, 0.22, 0.2], [0, 0.72, -0.22, 0.2]] as const) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), n % 2 ? M.leaf : M.leafLight);
        blob.position.set(x + dx, dy, z + dz);
        g.add(blob);
      }
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4 + n, rad = 0.28 + (k % 3) * 0.05;
        const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), k % 4 === 0 ? M.appleGreen : M.apple);
        apple.position.set(x + Math.cos(a) * rad, 0.58 + (k % 4) * 0.09, z + Math.sin(a) * rad);
        g.add(apple);
      }
    });
    // kosz z zebranymi jabłkami przy wejściu
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.16, 8), M.basket);
    basket.position.set(0.45, 0.13, 1.0);
    g.add(basket);
    for (let k = 0; k < 6; k++) {
      const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), M.apple);
      apple.position.set(0.45 + Math.cos(k * 1.05) * 0.08, 0.23, 1.0 + Math.sin(k * 1.05) * 0.08);
      g.add(apple);
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
    tower.name = 'shell';
    g.add(tower);
    const cap = new THREE.Group();
    cap.name = 'roof';
    pyramid(cap, M.woodDark, 0.65, 0.6, 0, 1.7, 0, 8);
    g.add(cap);
    // wnętrze: niski mur, kamienie młyńskie i worki z mąką; słup trzyma skrzydła, gdy wieża jest odsłonięta
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 8), M.wood);
    floor.position.set(0.2, 0.025, 0.1);
    inside.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.4, 8, 1, true, Math.PI * 0.75, Math.PI * 1.5), new THREE.MeshLambertMaterial({ color: 0xe6d9b8, flatShading: true, side: THREE.DoubleSide }));
    wall.position.y = 0.2;
    inside.add(wall);
    for (let i = 0; i < 2; i++) {
      const stoneWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), i ? M.stone : M.stoneDark);
      stoneWheel.position.set(-0.2, 0.11 + i * 0.13, -0.15);
      inside.add(stoneWheel);
    }
    box(inside, M.white, 0.2, 0.26, 0.16, 0.3, 0.05, -0.3);
    box(inside, M.white, 0.2, 0.2, 0.16, 0.42, 0.05, -0.12);
    box(inside, M.woodDark, 0.1, 1.4, 0.1, 0, 0, 0.5);
    g.add(inside);
    // skrzydła w osobnej grupie, żeby mogły się kręcić, gdy młynarz pracuje
    const spin = new THREE.Group();
    spin.name = 'spin';
    spin.position.set(0, 1.35, 0.62);
    for (let i = 0; i < 4; i++) {
      const blade = box(spin, M.white, 0.16, 1.25, 0.03, 0, 0, 0);
      blade.geometry.translate(0, 0.62, 0);
      blade.position.set(0, 0, 0);
      blade.rotation.z = (Math.PI / 2) * i;
    }
    g.add(spin);
  },
  bakery(g, _team, flag) {
    const inside = hut(g, M.plaster, mat(0xb5562f, 'tiles'), 1.4, 1.2, 0.8, 0, 0, true);
    // piec z żarem, stół i bochenki
    box(inside, M.stoneDark, 0.5, 0.55, 0.45, -0.4, 0.05, -0.33);
    box(inside, M.ember, 0.26, 0.2, 0.03, -0.4, 0.15, -0.1);
    box(inside, M.wood, 0.5, 0.25, 0.3, 0.35, 0.05, -0.35);
    for (let i = 0; i < 3; i++) box(inside, M.bread, 0.12, 0.07, 0.18, 0.2 + i * 0.15, 0.3, -0.35);
    box(g, M.stoneDark, 0.3, 1.0, 0.3, -0.45, 0.8, -0.3).name = 'chimney';
    box(g, M.window, 0.3, 0.3, 0.04, 0.45, 0.32, 0.61);
    pennant(g, flag, 0.6, 1.2, 0);
    // dym z komina, widoczny tylko gdy piekarz piecze
    const smoke = new THREE.Group();
    smoke.name = 'smoke';
    smoke.position.set(-0.45, 1.85, -0.3);
    for (let i = 0; i < 4; i++) smoke.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), M.smoke));
    smoke.visible = false;
    g.add(smoke);
  },
};

const teamMats = new Map<number, THREE.MeshLambertMaterial>();
const flagMats = new Map<number, THREE.MeshLambertMaterial>();

export function buildingModel(id: string, teamColor: number): THREE.Group {
  let team = teamMats.get(teamColor);
  if (!team) { team = mat(teamColor, 'tiles'); teamMats.set(teamColor, team); }
  const g = new THREE.Group();
  let flag = flagMats.get(teamColor);
  if (!flag) { flag = mat(teamColor); flagMats.set(teamColor, flag); }
  (BUILDERS[id] ?? ((gg) => { box(gg, M.wood, 1, 1, 1); }))(g, team, flag);
  // fundament, żeby budynek nie wisiał nad nierównym terenem
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.soil);
  base.name = 'base';
  g.add(base);
  return g;
}

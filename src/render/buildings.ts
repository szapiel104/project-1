import * as THREE from 'three';

const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });
const M = {
  stone: mat(0xb9b2a0), stoneDark: mat(0x8f8877), wood: mat(0x6b4a2b), woodDark: mat(0x4a3320),
  plaster: mat(0xe6d9b8), thatch: mat(0xb8973f), soil: mat(0x6e5232), wheat: mat(0xd9b84a),
  leaf: mat(0x3f7a33), apple: mat(0xb3261e), iron: mat(0x4a4038), white: mat(0xf1ead8),
  plank: mat(0xc9a26b), bread: mat(0xb97a3a),
  ember: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
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
const resMats = new Map<number, THREE.MeshLambertMaterial>();

/** Pokazuje w składzie tyle skrzyń, ile wynika z zapełnienia; kolory według rodzaju surowca. */
export function setStockFill(model: THREE.Object3D, ratio: number, colors: { color: number; share: number }[]): void {
  const fill = model.getObjectByName('fill');
  if (!fill) return;
  const total = fill.children.length;
  const shown = ratio <= 0 ? 0 : Math.max(1, Math.round(Math.min(1, ratio) * total));
  let k = 0, acc = 0;
  fill.children.forEach((child, i) => {
    child.visible = i < shown;
    if (i >= shown) return;
    while (k < colors.length - 1 && (i + 0.5) / shown > acc + colors[k]!.share) { acc += colors[k]!.share; k++; }
    const color = colors[k]?.color ?? 0x8a5a2b;
    let m = resMats.get(color);
    if (!m) { m = mat(color); resMats.set(color, m); }
    (child as THREE.Mesh).material = m;
  });
}

/** Animacje budynków: kręcące się skrzydła młyna i dym z komina, tylko gdy ktoś w środku pracuje. */
export function animateBuilding(model: THREE.Object3D, active: boolean, time: number, dt: number): void {
  const interior = model.getObjectByName('interior');
  if (interior) {
    // ktoś pracuje w środku: zdejmujemy dach i ściany, żeby było go widać
    interior.visible = active;
    for (const name of ['roof', 'shell', 'chimney']) { const part = model.getObjectByName(name); if (part) part.visible = !active; }
  }
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
  granary(g, team) {
    box(g, M.wood, 1.4, 1.1, 1.4, 0, 0.25, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.14, 0.25, 0.14, sx * 0.6, 0, sz * 0.6);
    pyramid(g, M.thatch, 1.2, 0.8, 0, 1.35, 0);
    box(g, team, 0.3, 0.3, 0.04, 0, 0.7, 0.72);
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
  bakery(g, team) {
    const inside = hut(g, M.plaster, mat(0x9c4a2a), 1.4, 1.2, 0.8, 0, 0, true);
    // piec z żarem, stół i bochenki
    box(inside, M.stoneDark, 0.5, 0.55, 0.45, -0.4, 0.05, -0.33);
    box(inside, M.ember, 0.26, 0.2, 0.03, -0.4, 0.15, -0.1);
    box(inside, M.wood, 0.5, 0.25, 0.3, 0.35, 0.05, -0.35);
    for (let i = 0; i < 3; i++) box(inside, M.bread, 0.12, 0.07, 0.18, 0.2 + i * 0.15, 0.3, -0.35);
    box(g, M.stoneDark, 0.3, 1.0, 0.3, -0.45, 0.8, -0.3).name = 'chimney';
    box(g, team, 0.3, 0.3, 0.04, -0.45, 0.35, 0.62);
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

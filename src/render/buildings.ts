import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bump, pattern } from './textures';

type Pattern = Parameters<typeof pattern>[0];
/** Materiał fizyczny: wzór, wypukłość z tego samego wzoru i matowa, chropowata powierzchnia. */
/** Ile razy wzór powtarza się na jednostkę długości (jedno pole mapy). Dzięki temu kamień ma tę samą wielkość na małej i dużej ścianie. */
export const roadMaterials = (): THREE.MeshStandardMaterial[] => [M.roadSand, M.roadStone];
const TILE: Partial<Record<Pattern, number>> = { cobble: 1,  ashlar: 1.15, bricks: 1.3, planks: 1.1, thatch: 0.9, tiles: 1.2, plaster: 0.9, soil: 0.7, bark: 1.5 };
const mat = (color: number, tex?: Pattern): THREE.MeshStandardMaterial => {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: tex === 'ashlar' ? 0.9 : tex === 'cobble' ? 1.6 : 1.4 });
  m.userData.tile = (tex && TILE[tex]) || 0;
  return m;
};

/** Skaluje współrzędne tekstury ścian pudełka do ich prawdziwych wymiarów. Ściany idą w kolejności: ±X, ±Y, ±Z. */
function tileBox(geo: THREE.BufferGeometry, w: number, h: number, d: number, k: number): void {
  const uv = geo.getAttribute('uv');
  const size: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * size[f]![0] * k, uv.getY(i) * size[f]![1] * k);
    }
}

/** To samo dla walca: obwód w poziomie, wysokość w pionie. */
function tileRound(mesh: THREE.Mesh, radius: number, height: number): THREE.Mesh {
  const k = ((mesh.material as THREE.Material).userData.tile as number) || 0;
  if (!k) return mesh;
  const uv = mesh.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius * k, uv.getY(i) * height * k);
  return mesh;
}
const M = {
  stone: mat(0xcfc7b3, 'bricks'), stoneDark: mat(0xa39b88, 'bricks'), wood: mat(0x85603a, 'planks'), woodDark: mat(0x5e4329, 'planks'),
  plaster: mat(0xf0e4c4, 'plaster'), thatch: mat(0xd1ad4c, 'thatch'), soil: mat(0x86633d, 'soil'), wheat: mat(0xd9b84a),
  leaf: mat(0x5c9a3c, 'leaves'), apple: mat(0xd0281f), iron: mat(0x4a4038), white: mat(0xf1ead8),
  plank: mat(0xd9b27a, 'planks'),
  orchardGrass: mat(0x86b54a, 'grass'), bark: mat(0x7a5a3a, 'bark'), leafLight: mat(0x7fb548, 'leaves'),
  appleGreen: mat(0xa9c23f), basket: mat(0xb08a4e, 'thatch'), bread: mat(0xb97a3a),
  ember: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  window: mat(0xb08a5a, 'window'), dark: mat(0x1c1611),
  turf: mat(0x7f9a48, 'grass'),
  trodden: new THREE.MeshStandardMaterial({ color: 0x8f8f52, roughness: 1, map: pattern('grass'), transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
  ash: mat(0x4a4540), rock: mat(0x9a968c), rockDark: mat(0x77736a),
  flameLight: new THREE.MeshBasicMaterial({ color: 0xffc04a }), flameCore: new THREE.MeshBasicMaterial({ color: 0xfff0a8 }),
  roadSand: mat(0xd4b77c, 'soil'), roadStone: mat(0xc4c3bf, 'cobble'),
  trousers: mat(0x5a4632), skin: mat(0xe2bd94), gold: mat(0xe9c145),
  hay: mat(0xe0c466, 'thatch'),
  thatchDark: mat(0xa9862f, 'thatch'), fish: mat(0x9cc3d6), sawdust: mat(0xd9c08a, 'soil'), needle: mat(0x3c7a3a, 'needles'),
  castle: mat(0xf2e2ba, 'ashlar'), castleDark: mat(0xcdb98e, 'ashlar'), castlePlain: mat(0xd6c49a),
  smoke: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, flatShading: true, transparent: true, opacity: 0.8 }),
};

function box(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const k = (m.userData.tile as number) || 0;
  if (k) tileBox(geo, w, h, d, k);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

/** Dach dwuspadowy: graniastosłup o podstawie trójkąta */
function gable(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, y: number, x = 0, z = 0): void {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  geo.rotateX(-Math.PI / 2); // trójkąt pionowo, wierzchołkiem do góry
  geo.rotateY(Math.PI / 2); // kalenica wzdłuż osi X
  // wzór w prawdziwej skali: w poprzek obwód dachu, wzdłuż jego długość
  const k = (m.userData.tile as number) || 0;
  if (k) {
    const uv = geo.getAttribute('uv');
    const around = d + 2 * Math.hypot(d / 2, h);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around * k, uv.getY(i) * w * k);
  }
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

/** Pusta siatka miejsc na stosy (9 miejsc w 3 warstwach), wypełniana przez setStockFill. */
function fillSlots(name: string, x: number, z: number, step = 0.54): THREE.Group {
  const fill = new THREE.Group();
  fill.name = name;
  for (let layer = 0; layer < STOCK_LAYERS; layer++)
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.46), M.wood);
      m.position.set(x + ((i % 3) - 1) * step, 0.06 + 0.15 + layer * 0.31, z + (Math.floor(i / 3) - 1) * step);
      m.visible = false;
      fill.add(m);
    }
  return fill;
}
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
  bread: {
    color: 0xc9843d,
    geo: mergeGeometries([-0.12, 0.12].map((z) => part(new THREE.IcosahedronGeometry(0.12, 0).scale(1.6, 0.8, 0.9), 0, -0.04, z))),
  },
  apples: {
    color: 0xd0281f,
    geo: mergeGeometries([part(new THREE.CylinderGeometry(0.19, 0.15, 0.2, 8).toNonIndexed(), 0, -0.04, 0), ...[0, 1, 2, 3, 4].map((k) => part(new THREE.IcosahedronGeometry(0.07, 0), Math.cos(k * 1.26) * 0.09, 0.08, Math.sin(k * 1.26) * 0.09))]),
  },
  fish: {
    color: 0x9cc3d6,
    geo: mergeGeometries([-0.13, 0, 0.13].map((z) => part(new THREE.IcosahedronGeometry(0.1, 0).scale(1.9, 0.5, 0.6), 0, -0.08, z))),
  },
  flour: {
    color: 0xf1ead8,
    geo: mergeGeometries([-0.11, 0.11].map((x) => part(new THREE.IcosahedronGeometry(0.13, 0).scale(0.95, 1.05, 1.3), x, -0.01, 0))),
  },
};
const pileMats = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Układa w składzie stosy surowców. Każdy surowiec dostaje własne miejsca i rośnie w górę,
 * więc widać osobno deski, kamień, żelazo, zboże i mąkę.
 */
export function setStockFill(model: THREE.Object3D, ratio: number, stock: { id: string; share: number }[], group = 'fill'): void {
  const fill = model.getObjectByName(group);
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
        if (pile.geo) mesh.geometry = pile.geo;
        mesh.material = m;
        mesh.visible = true;
      }
      slot++;
    }
  }
}

/** Noc: okna zaczynają świecić ciepłym światłem. `k` od 0 (dzień) do 1 (środek nocy). */
export function setNight(k: number): void {
  M.window.emissive.setHex(0xffb050);
  M.window.emissiveIntensity = k * 0.8;
}

/** Pochodnia na słupie: stawiana przy każdym budynku, płonie tylko nocą. */
export function torchModel(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'torch';
  box(g, M.woodDark, 0.06, 0.95, 0.06);
  box(g, M.iron, 0.12, 0.08, 0.12, 0, 0.92, 0);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), M.ember);
  flame.position.y = 1.15;
  flame.name = 'torchflame';
  g.add(flame);
  return g;
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
  // życie na murach, niezależnie od tego, czy budynek jest otwarty
  const life = model.getObjectByName('life');
  if (life && dt > 0) {
    const R = 1.02, Y = 1.25;
    for (const p of life.children) {
      if (p.name === 'patrol') {
        // obchód po obwodzie muru: cztery proste odcinki, strażnik patrzy w kierunku marszu
        const k = ((time * 0.045 + (p.userData.phase as number)) % 1) * 4;
        const side = Math.floor(k), f = (k - side) * 2 - 1;
        const [x, z, face] = side === 0 ? [f * R, -R, Math.PI / 2] : side === 1 ? [R, f * R, 0] : side === 2 ? [-f * R, R, -Math.PI / 2] : [-R, -f * R, Math.PI];
        p.position.set(x, Y + Math.abs(Math.sin(time * 7 + side)) * 0.012, z);
        p.rotation.y = face;
      } else if (p.name === 'sentry') p.rotation.y = Math.sin(time * 0.4) * 0.5;
      else if (p.name === 'lookout') { p.rotation.y = time * 0.25; p.visible = !active; }
      else if (p.name === 'brazier') p.scale.set(1, 0.8 + Math.abs(Math.sin(time * 10 + p.position.x * 9)) * 0.5, 1);
    }
  }
  // życie we wnętrzu: służący krąży między kuchnią a stołem, biesiadnicy jedzą, strażnik się rozgląda
  if (interior && active && dt > 0) {
    let n = 0;
    for (const p of interior.children) {
      if (!p.name || !p.userData.x) { if (p.name !== 'lord') continue; }
      n++;
      const arm = p.getObjectByName('arm');
      if (p.name === 'servant') {
        const k = (Math.sin(time * 0.7) + 1) / 2;
        p.position.x = 0.3 - k * 0.55;
        p.position.z = 0.2 - Math.sin(k * Math.PI) * 0.15;
        p.rotation.y = Math.cos(time * 0.7) > 0 ? -Math.PI / 2 : Math.PI / 2;
        p.position.y += Math.abs(Math.sin(time * 8)) * 0.0;
      } else if (p.name === 'diner' && arm) arm.rotation.x = -1.2 - Math.max(0, Math.sin(time * 2.2 + n * 2)) * 1.1;
      else if (p.name === 'guard') p.rotation.y = Math.sin(time * 0.5) * 0.8;
      else if (p.name === 'servant2') { p.position.z = 0.6 + Math.sin(time * 0.5) * 0.3; p.rotation.y = Math.cos(time * 0.5) > 0 ? 0 : Math.PI; }
      else if (p.name === 'scribe' && arm) arm.rotation.x = -1.3 + Math.sin(time * 6) * 0.15;
      else if (p.name === 'lord' && arm) arm.rotation.x = -0.6 + Math.sin(time * 0.9) * 0.3;
    }
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

type Builder = (g: THREE.Group, team: THREE.Material, flag: THREE.Material) => void;

/** Mała chorągiewka w barwie drużyny (gładka, bez wzoru dachówek) */
function pennant(g: THREE.Group, flag: THREE.Material, x: number, y: number, z: number): void {
  box(g, M.woodDark, 0.03, 0.4, 0.03, x, y, z);
  box(g, flag, 0.24, 0.14, 0.02, x + 0.13, y + 0.25, z);
}

/** Modele budynków z brył. Klucz = id z data/buildings.ts. Początek układu = środek działki, 1 = jedno pole. */
const BUILDERS: Record<string, Builder> = {
  keep(root, team, flag) {
    let g = root;
    // Twierdza z ciepłego piaskowca, z drewnianymi hurdycjami i gontem jak reszta osady
    const S = M.castle, D = M.castleDark;
    const merlons = (cx: number, cz: number, len: number, y: number, alongX: boolean, m: THREE.Material): void => {
      const n = Math.max(3, Math.round(len / 0.26) | 1);
      for (let i = 0; i < n; i += 2) {
        const o = -len / 2 + (i + 0.5) * (len / n);
        box(g, m, alongX ? len / n : 0.1, 0.14, alongX ? 0.1 : len / n, cx + (alongX ? o : 0), y, cz + (alongX ? 0 : o));
      }
    };
    // mur: szersza podstawa, ściana, gzyms i blanki
    box(g, D, 2.66, 0.25, 2.66);
    box(g, S, 2.5, 1.0, 2.5, 0, 0.2, 0);
    box(g, D, 2.6, 0.1, 2.6, 0, 1.2, 0);
    for (const s of [-1, 1]) { merlons(0, s * 1.25, 2.5, 1.3, true, S); merlons(s * 1.25, 0, 2.5, 1.3, false, S); }
    // dziedziniec wyłożony deskami
    box(g, M.plank, 2.3, 0.03, 2.3, 0, 1.2, 0);
    // donżon: wieża mieszkalna z drewnianą hurdycją pod dachem (zdejmowany, żeby zajrzeć do sali)
    const don = new THREE.Group();
    don.name = 'shell';
    const gg = g;
    g = don;
    box(g, S, 1.25, 1.75, 1.25, 0, 1.2, -0.25);
    box(g, D, 1.31, 0.07, 1.31, 0, 1.95, -0.25);
    box(g, D, 1.33, 0.12, 1.33, 0, 1.2, -0.25);
    box(g, M.woodDark, 1.5, 0.08, 1.5, 0, 2.9, -0.25);
    box(g, M.wood, 1.48, 0.42, 1.48, 0, 2.98, -0.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.woodDark, 0.07, 0.42, 0.07, sx * 0.72, 2.98, -0.25 + sz * 0.72);
    pyramid(g, team, 1.12, 1.15, 0, 3.4, -0.25);
    for (const x of [-0.3, 0.3]) { box(g, M.window, 0.2, 0.3, 0.03, x, 2.2, 0.385); box(g, M.window, 0.2, 0.3, 0.03, x, 1.55, 0.385); }
    for (const sx of [-1, 1]) box(g, M.window, 0.03, 0.3, 0.2, sx * 0.635, 2.0, -0.25);
    box(g, M.woodDark, 0.04, 0.8, 0.04, 0, 4.5, -0.25);
    box(g, flag, 0.5, 0.28, 0.02, 0.27, 5.0, -0.25);
    g = gg;
    g.add(don);
    // Wnętrze po zdjęciu donżonu: cały poziom dziedzińca podzielony na komnaty, w których toczy się życie
    const hall = new THREE.Group();
    hall.name = 'interior';
    hall.visible = false;
    const Y = 1.2;
    box(hall, M.plank, 2.3, 0.05, 2.3, 0, Y, 0);
    // ściany zewnętrzne i działowe (niskie, żeby było widać środek)
    for (const [x, z, w, d] of [[0, -1.12, 2.3, 0.07], [-1.12, 0, 0.07, 2.3], [1.12, 0, 0.07, 2.3], [-0.75, 1.12, 0.8, 0.07], [0.75, 1.12, 0.8, 0.07]] as const) box(hall, M.castle, w, 0.5, d, x, Y, z);
    box(hall, M.castle, 1.0, 0.42, 0.06, -0.62, Y, -0.15);
    box(hall, M.castle, 0.75, 0.42, 0.06, 0.75, Y, -0.15);
    box(hall, M.castle, 0.06, 0.42, 0.85, 0.2, Y, 0.66);
    // SALA LORDA (tył): dywan, podest, tron, chorągwie, kominek
    box(hall, flag, 0.4, 0.02, 0.85, 0, Y + 0.05, -0.62);
    box(hall, M.stoneDark, 0.7, 0.06, 0.34, 0, Y + 0.05, -0.92);
    box(hall, M.woodDark, 0.26, 0.14, 0.24, 0, Y + 0.11, -0.93);
    box(hall, M.woodDark, 0.26, 0.5, 0.05, 0, Y + 0.11, -1.04);
    box(hall, flag, 0.2, 0.03, 0.18, 0, Y + 0.25, -0.92);
    for (const sx of [-1, 1]) box(hall, flag, 0.22, 0.34, 0.02, sx * 0.6, Y + 0.14, -1.07);
    box(hall, M.stoneDark, 0.36, 0.3, 0.14, -0.9, Y + 0.05, -1.02);
    box(hall, M.ember, 0.2, 0.14, 0.03, -0.9, Y + 0.08, -0.94);
    // JADALNIA (przód, lewa): długi stół, ławy, misy i bochny
    box(hall, M.wood, 0.9, 0.05, 0.3, -0.5, Y + 0.2, 0.5);
    for (const sx of [-1, 1]) box(hall, M.woodDark, 0.05, 0.16, 0.24, -0.5 + sx * 0.38, Y + 0.05, 0.5);
    for (const sz of [-1, 1]) box(hall, M.woodDark, 0.85, 0.04, 0.1, -0.5, Y + 0.13, 0.5 + sz * 0.27);
    for (let k = 0; k < 4; k++) box(hall, k % 2 ? M.bread : M.apple, 0.08, 0.04, 0.08, -0.82 + k * 0.21, Y + 0.25, 0.5);
    // KOMNATA (przód, prawa): łoże, skrzynia, beczka
    box(hall, M.woodDark, 0.5, 0.12, 0.34, 0.72, Y + 0.05, 0.3);
    box(hall, M.white, 0.42, 0.05, 0.3, 0.72, Y + 0.17, 0.3);
    box(hall, flag, 0.16, 0.06, 0.3, 0.9, Y + 0.18, 0.3);
    box(hall, M.wood, 0.26, 0.16, 0.18, 0.5, Y + 0.05, 0.85);
    // mieszkańcy: lord na tronie, biesiadnicy przy stole, służący z tacą, strażnik przy bramie
    const person = (name: string, tunic: THREE.Material, x: number, z: number, turn: number, hatMat?: THREE.Material, into: THREE.Group = hall): THREE.Group => {
      const p = new THREE.Group();
      p.name = name;
      box(p, M.trousers, 0.07, 0.1, 0.06, 0, 0, 0);
      box(p, tunic, 0.1, 0.12, 0.07, 0, 0.1, 0);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 1), M.skin);
      head.position.y = 0.26;
      p.add(head);
      if (hatMat) box(p, hatMat, 0.08, 0.03, 0.08, 0, 0.29, 0);
      const arm = box(p, tunic, 0.03, 0.1, 0.03, 0.065, 0.12, 0.02);
      arm.name = 'arm';
      p.position.set(x, Y + 0.05, z);
      p.rotation.y = turn;
      p.userData = { x, z };
      into.add(p);
      return p;
    };
    person('lord', flag, 0, -0.88, 0, M.gold).position.y = Y + 0.24;
    person('diner', M.plaster, -0.72, 0.24, 0);
    person('diner', M.wood, -0.3, 0.24, 0);
    person('diner', M.thatch, -0.5, 0.76, Math.PI);
    person('servant', M.plaster, 0.3, 0.2, 0);
    person('guard', M.iron, 0.28, 0.98, 0, M.iron);
    person('diner', flag, -0.9, 0.76, Math.PI);
    person('servant2', M.thatch, 0.75, 0.6, 0);
    person('scribe', M.plaster, 0.55, -0.6, Math.PI / 2);
    box(hall, M.wood, 0.2, 0.16, 0.3, 0.75, Y + 0.05, -0.6);
    box(hall, M.white, 0.12, 0.01, 0.16, 0.75, Y + 0.215, -0.6);
    g.add(hall);
    // Życie widoczne z zewnątrz, cały czas: straże obchodzą mury, wartownik stoi w bramie, kosze z ogniem przy wejściu
    const life = new THREE.Group();
    life.name = 'life';
    for (let k = 0; k < 3; k++) { const guard = person('patrol', M.iron, 0, 0, 0, M.iron, life); guard.userData.phase = k / 3; guard.scale.setScalar(1.25); }
    const sentry = person('sentry', flag, 0.45, 1.78, 0, M.iron, life);
    sentry.position.y = 0;
    sentry.scale.setScalar(1.3);
    box(sentry, M.woodDark, 0.012, 0.5, 0.012, 0.09, 0, 0.03);
    const lookout = person('lookout', M.iron, 0, -0.25, 0, M.iron, life);
    lookout.position.y = 3.02;
    lookout.userData.top = true;
    for (const sx of [-1, 1]) {
      box(life, M.iron, 0.12, 0.3, 0.12, sx * 0.62, 0, 1.62);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), M.ember);
      fire.name = 'brazier';
      fire.position.set(sx * 0.62, 0.4, 1.62);
      life.add(fire);
    }
    g.add(life);
    // cztery baszty narożne: lekko zwężane, z gzymsem, blankami i gontowym hełmem
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = sx * 1.22, z = sz * 1.22;
      const t = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.95, 16), S), 0.45, 1.95);
      t.position.set(x, 0.975, z);
      g.add(t);
      const rim = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.2, 16), D), 0.46, 0.2);
      rim.position.set(x, 2.05, z);
      g.add(rim);
      // blanki baszty: osiem zębów ustawionych po okręgu, licem na zewnątrz, z tego samego kamienia co mur
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785 + 0.39;
        const tooth = box(g, S, 0.16, 0.15, 0.09, x + Math.sin(a) * 0.44, 2.15, z + Math.cos(a) * 0.44);
        tooth.rotation.y = a;
      }
      pyramid(g, team, 0.4, 0.95, x, 2.15, z, 12);
      box(g, M.window, 0.12, 0.26, 0.03, x, 1.2, z + sz * 0.46);
    }
    // brama: przedbramie z daszkiem, wrota z kratą, most
    box(g, D, 0.95, 1.35, 0.32, 0, 0, 1.3);
    box(g, M.woodDark, 1.1, 0.07, 0.5, 0, 1.35, 1.32);
    gable(g, team, 1.15, 0.4, 0.55, 1.42, 0, 1.32);
    box(g, M.dark, 0.52, 0.85, 0.06, 0, 0, 1.45);
    box(g, M.woodDark, 0.24, 0.8, 0.03, -0.13, 0, 1.49);
    box(g, M.woodDark, 0.24, 0.8, 0.03, 0.13, 0, 1.49);
    for (let k = 0; k < 3; k++) box(g, M.iron, 0.5, 0.03, 0.02, 0, 0.18 + k * 0.25, 1.51);
    box(g, M.plank, 0.62, 0.05, 0.36, 0, 0, 1.66);
    for (const s of [-1, 1]) box(g, flag, 0.14, 0.42, 0.02, s * 0.37, 0.75, 1.47);
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
    g.add(fillSlots('fill', 0, 0));
  },
  granary(g, _team, flag) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.14, 0.25, 0.14, sx * 0.6, 0, sz * 0.6);
    box(g, M.wood, 1.4, 1.1, 1.4, 0, 0.25, 0).name = 'shell';
    const top = new THREE.Group();
    top.name = 'roof';
    pyramid(top, M.thatch, 1.2, 0.8, 0, 1.35, 0);
    box(top, M.window, 0.3, 0.3, 0.04, 0, 0.7, 0.71);
    g.add(top);
    // wnętrze: podłoga, niskie ściany i zapasy żywności, których przybywa
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    box(inside, M.plank, 1.4, 0.06, 1.4, 0, 0.25, 0);
    for (const [x, z, w, d] of [[0, -0.67, 1.4, 0.06], [-0.67, 0, 0.06, 1.4], [0.67, 0, 0.06, 1.4]] as const) box(inside, M.wood, w, 0.4, d, x, 0.25, z);
    const food = fillSlots('foodfill', 0, 0, 0.4);
    food.position.y = 0.25;
    inside.add(food);
    g.add(inside);
    pennant(g, flag, 0.62, 1.2, 0.62);
  },
  woodcutter(g) {
    // Tartak: chata po prawej (naprzeciw wejścia), po lewej wiata z kozłem do cięcia, z tyłu stos desek.
    // Plac z pniem leży z boku, więc droga do drzwi jest wolna.
    const inside = hut(g, M.wood, M.thatch, 0.95, 0.9, 0.7, 0.42, -0.3, true);
    box(inside, M.woodDark, 0.4, 0.2, 0.12, 0.3, 0.05, -0.45);
    box(inside, M.plank, 0.4, 0.04, 0.3, 0.6, 0.05, -0.5);
    box(g, M.window, 0.2, 0.2, 0.03, 0.72, 0.36, 0.16);
    // wiata: cztery słupy i skośny dach
    for (const [x, z, hgt] of [[-0.9, -0.75, 0.85], [-0.15, -0.75, 0.85], [-0.9, 0.05, 0.62], [-0.15, 0.05, 0.62]] as const) box(g, M.woodDark, 0.07, hgt, 0.07, x, 0, z);
    const shed = box(g, M.thatch, 0.95, 0.05, 1.0, -0.52, 0.76, -0.35);
    shed.rotation.x = 0.28;
    // kozioł: dwa krzyżaki, na nich kłoda i piła
    for (const x of [-0.75, -0.3]) for (const r of [0.5, -0.5]) { const leg = box(g, M.woodDark, 0.05, 0.42, 0.05, x, 0, -0.35); leg.rotation.x = r; }
    const sawn = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 7), M.bark);
    sawn.rotation.z = Math.PI / 2;
    sawn.position.set(-0.52, 0.36, -0.35);
    g.add(sawn);
    box(g, M.iron, 0.02, 0.2, 0.34, -0.45, 0.36, -0.35);
    box(g, M.woodDark, 0.03, 0.06, 0.08, -0.45, 0.52, -0.2);
    // stos gotowych desek przy tylnej ścianie wiaty i trociny na ziemi
    for (let i = 0; i < 4; i++) box(g, M.plank, 0.62, 0.045, 0.16 + (i % 2) * 0.03, -0.52, 0.02 + i * 0.05, -0.82);
    box(g, M.sawdust, 0.5, 0.015, 0.4, -0.52, 0.035, -0.3);
    // pieniek z siekierą
    const block = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.18, 8), M.bark);
    block.position.set(-0.05, 0.09, 0.35);
    g.add(block);
    // siekiera wbita w pieniek: trzonek i ostrze w jednej grupie, pochylone razem
    const axe = new THREE.Group();
    axe.position.set(-0.05, 0.17, 0.35);
    axe.rotation.z = -0.45;
    box(axe, M.woodDark, 0.03, 0.34, 0.03);
    box(axe, M.iron, 0.11, 0.08, 0.025, 0.045, 0.02, 0);
    g.add(axe);
    // przyciągnięte drzewo: pień z sękami, gałęziami i resztką listowia; skraca się z każdą partią desek
    const yard = new THREE.Group();
    yard.name = 'yardlog';
    yard.position.set(-0.98, 0.1, 0.68);
    yard.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.95, 7).rotateZ(Math.PI / 2).translate(0.475, 0, 0), M.bark));
    // krótkie gałęzie odstające na boki i kępki igliwia przy ich końcach, nisko przy pniu
    for (const [x, side, len] of [[0.3, 1, 0.22], [0.5, -1, 0.2], [0.68, 1, 0.18], [0.84, -1, 0.16]] as const) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.026, len, 5).translate(0, len / 2, 0), M.bark);
      branch.position.set(x, 0.02, 0);
      branch.rotation.x = side * 1.25;
      yard.add(branch);
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), M.needle);
      tuft.scale.set(1.3, 0.6, 1);
      tuft.position.set(x + 0.02, 0.02 + Math.cos(1.25) * len, side * Math.sin(1.25) * len);
      yard.add(tuft);
    }
    yard.visible = false;
    g.add(yard);
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
  barn(g, _team, flag) {
    // duża drewniana stodoła na kamiennej podmurówce, z wrotami i sianem
    box(g, M.stoneDark, 2.7, 0.2, 1.7);
    const shell = new THREE.Group();
    shell.name = 'shell';
    box(shell, M.wood, 2.6, 0.95, 1.6, 0, 0.2, 0);
    box(shell, M.woodDark, 0.8, 0.85, 0.05, 0, 0.2, 0.81);
    box(shell, M.plank, 0.04, 0.85, 0.06, 0, 0.2, 0.82);
    for (const s of [-1, 1]) { box(shell, M.plank, 0.75, 0.05, 0.06, 0, 0.45 + s * 0.25, 0.83); box(shell, M.window, 0.26, 0.26, 0.04, s * 0.95, 0.6, 0.81); }
    g.add(shell);
    // dach: gruba strzecha z ciemniejszym okapem, kalenica z żerdzi, wiatrownice na szczytach i daszek nad wrotami
    const top = new THREE.Group();
    top.name = 'roof';
    gable(top, M.thatchDark, 2.95, 0.9, 2.1, 1.1);
    gable(top, M.thatch, 2.8, 1.0, 1.9, 1.16);
    box(top, M.woodDark, 2.9, 0.07, 0.09, 0, 2.12, 0);
    box(top, M.woodDark, 0.36, 0.36, 0.05, 0, 1.4, 0.93);
    box(top, M.woodDark, 0.07, 0.07, 0.4, 0, 1.82, 1.1);
    const porch = box(top, M.thatchDark, 1.1, 0.05, 0.45, 0, 1.12, 1.05);
    porch.rotation.x = 0.45;
    g.add(top);
    // siano przy wrotach: dwie okrągłe bele obwiązane powrósłem i kopka z wbitymi widłami
    for (const [bx, bz, rot] of [[1.0, 0.98, 0.3], [0.62, 1.02, -0.2]] as const) {
      const bale = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 12), M.hay), 0.17, 0.3);
      bale.rotation.set(Math.PI / 2, 0, rot);
      bale.position.set(bx, 0.17, bz);
      g.add(bale);
      for (const o of [-0.08, 0.08]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.008, 4, 12), M.woodDark); band.rotation.set(0, Math.PI / 2 + rot, 0); band.position.set(bx + Math.sin(rot) * o, 0.17, bz + Math.cos(rot) * o); g.add(band); }
    }
    const stack = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.hay);
    stack.scale.set(1, 1.25, 1);
    stack.position.set(-1.0, 0, 1.0);
    g.add(stack);
    const fork = box(g, M.woodDark, 0.025, 0.55, 0.025, -0.95, 0.15, 1.0);
    fork.rotation.z = 0.35;
    // wnętrze: klepisko, niskie ściany, po lewej surowce, po prawej żywność
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    box(inside, M.plank, 2.6, 0.05, 1.6, 0, 0.2, 0);
    for (const [x, z, w, d] of [[0, -0.77, 2.6, 0.06], [-1.27, 0, 0.06, 1.6], [1.27, 0, 0.06, 1.6]] as const) box(inside, M.wood, w, 0.45, d, x, 0.2, z);
    box(inside, M.woodDark, 0.06, 0.45, 1.5, 0.08, 0.2, 0);
    const goods = fillSlots('fill', -0.6, 0, 0.42);
    goods.position.y = 0.2;
    const food = fillSlots('foodfill', 0.7, 0, 0.36);
    food.position.y = 0.2;
    inside.add(goods, food);
    g.add(inside);
    pennant(g, flag, -1.25, 1.75, 0);
  },
  fisher(g, _team, flag) {
    // chata rybaka na palach, z suszarnią ryb, beczką i łódką wyciągniętą na brzeg
    for (const [x, z] of [[-0.75, -0.6], [0.15, -0.6], [-0.75, 0.1], [0.15, 0.1]] as const) box(g, M.woodDark, 0.09, 0.3, 0.09, x, 0, z);
    box(g, M.plank, 1.15, 0.06, 0.95, -0.3, 0.3, -0.25);
    box(g, M.wood, 0.95, 0.6, 0.75, -0.3, 0.36, -0.25);
    gable(g, M.thatch, 1.1, 0.5, 0.95, 0.96, -0.3, -0.25);
    box(g, M.woodDark, 0.22, 0.42, 0.04, -0.3, 0.36, 0.13);
    box(g, M.window, 0.2, 0.2, 0.03, 0.18, 0.55, -0.25).rotation.y = Math.PI / 2;
    // suszarnia: dwa słupki, żerdź i wiszące ryby
    box(g, M.woodDark, 0.05, 0.6, 0.05, 0.45, 0, 0.75);
    box(g, M.woodDark, 0.05, 0.6, 0.05, 0.9, 0, 0.75);
    box(g, M.woodDark, 0.55, 0.04, 0.04, 0.675, 0.58, 0.75);
    for (let k = 0; k < 4; k++) box(g, M.fish, 0.05, 0.2, 0.03, 0.5 + k * 0.12, 0.36, 0.75);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.3, 8), M.wood);
    barrel.position.set(-0.75, 0.15, 0.7);
    g.add(barrel);
    // łódka
    const boat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.85, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI), M.woodDark);
    boat.scale.set(1, 0.6, 1);
    boat.position.set(0.55, 0.14, -0.55);
    boat.rotation.y = 0.5;
    g.add(boat);
    pennant(g, flag, -0.8, 0.9, -0.6);
  },
  torch(g) {
    g.add(torchModel());
  },
  roadSand(g) { box(g, M.roadSand, 0.96, 0.04, 0.96); },
  roadStone(g) { box(g, M.roadStone, 0.96, 0.05, 0.96); },
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
    // ognisko: krąg nieregularnych polnych kamieni, popiół, polana ułożone w stożek, żar i płomienie
    const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 10), M.ash);
    ash.position.set(0, 0.055, 0.35);
    g.add(ash);
    for (let k = 0; k < 9; k++) {
      const a2 = (k / 9) * Math.PI * 2 + 0.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.075 + (k % 3) * 0.012, 0), k % 2 ? M.rock : M.rockDark);
      rock.scale.set(1 + (k % 2) * 0.25, 0.7 + (k % 3) * 0.12, 1 + ((k + 1) % 2) * 0.2);
      rock.rotation.set(k * 1.3, k * 2.1, k * 0.7);
      rock.position.set(Math.cos(a2) * 0.27, 0.07, 0.35 + Math.sin(a2) * 0.27);
      g.add(rock);
    }
    for (let k = 0; k < 5; k++) {
      const a2 = (k / 5) * Math.PI * 2;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.36, 5), M.bark);
      stick.position.set(Math.cos(a2) * 0.09, 0.2, 0.35 + Math.sin(a2) * 0.09);
      stick.rotation.set(Math.sin(a2) * -0.55, 0, Math.cos(a2) * 0.55);
      g.add(stick);
    }
    const flame = new THREE.Group();
    flame.name = 'flame';
    flame.position.set(0, 0.16, 0.35);
    for (const [x, z, r, hgt, m] of [[0, 0, 0.1, 0.34, M.ember], [0.05, 0.03, 0.06, 0.24, M.flameLight], [-0.05, -0.02, 0.055, 0.2, M.flameLight], [0, 0, 0.05, 0.16, M.flameCore]] as const) {
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 6), m);
      tongue.position.set(x, hgt / 2, z);
      flame.add(tongue);
    }
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
    const tower = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.7, 10), M.plaster), 0.6, 1.7);
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
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.4, 8, 1, true, Math.PI * 0.75, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0xe6d9b8, flatShading: true, side: THREE.DoubleSide }));
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

const teamMats = new Map<number, THREE.MeshStandardMaterial>();
const flagMats = new Map<number, THREE.MeshStandardMaterial>();

export function buildingModel(id: string, teamColor: number): THREE.Group {
  let team = teamMats.get(teamColor);
  if (!team) { team = mat(teamColor, 'tiles'); teamMats.set(teamColor, team); }
  const g = new THREE.Group();
  let flag = flagMats.get(teamColor);
  if (!flag) { flag = mat(teamColor); flagMats.set(teamColor, flag); }
  (BUILDERS[id] ?? ((gg) => { box(gg, M.wood, 1, 1, 1); }))(g, team, flag);
  // fundament, żeby budynek nie wisiał nad nierównym terenem
  if (id === 'torch' || id.startsWith('road')) return g; // sama pochodnia: zwykły słup wbity w ziemię, bez wydeptanego placu
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.turf);
  base.name = 'base';
  g.add(base);
  return g;
}

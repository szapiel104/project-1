import * as THREE from 'three';
import { assetModel } from './assets';
import { BUILDINGS } from '../data/buildings';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bump, pattern } from './textures';
import { beam, cutBox, paintGeo, rng, stoneSkirt, thatchSlab } from './craft';

type Pattern = Parameters<typeof pattern>[0];
/** Materiał fizyczny: wzór, wypukłość z tego samego wzoru i matowa, chropowata powierzchnia. */
/** Ile razy wzór powtarza się na jednostkę długości (jedno pole mapy). Dzięki temu kamień ma tę samą wielkość na małej i dużej ścianie. */
export const roadMaterials = (): THREE.MeshStandardMaterial[] => [M.roadSand, M.roadStone];
const TILE: Partial<Record<Pattern, number>> = { cobble: 1,  ashlar: 0.8, dressed: 0.55, bricks: 0.9, planks: 1.1, thatch: 0.9, tiles: 1.2, plaster: 0.9, soil: 0.7, bark: 1.5 };
const mat = (color: number, tex?: Pattern): THREE.MeshStandardMaterial => {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, bumpScale: tex === 'ashlar' ? 0.9 : tex === 'dressed' ? 0.7 : tex === 'cobble' ? 1.6 : 1.4 });
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
  appleGreen: mat(0xa9c23f), basket: mat(0xb08a4e, 'thatch'), bread: mat(0xa8652c),
  ember: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  window: mat(0xb08a5a, 'window'), dark: mat(0x1c1611), pane: mat(0x1c1611),
  turf: mat(0x7f9a48, 'grass'),
  trodden: new THREE.MeshStandardMaterial({ color: 0x8c8a4e, roughness: 1, map: pattern('grass'), transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  ash: mat(0x4a4540), rock: mat(0xb3ae9f, 'rock'), rockDark: mat(0x8d877a, 'rock'),
  flameLight: new THREE.MeshBasicMaterial({ color: 0xffc04a }), flameCore: new THREE.MeshBasicMaterial({ color: 0xfff0a8 }),
  roadSand: mat(0xd4b77c, 'soil'), roadStone: mat(0xf4f0e8, 'cobble'),
  trousers: mat(0x5a4632), skin: mat(0xe2bd94), gold: mat(0xe9c145),
  hay: mat(0xe0c466, 'thatch'),
  ore: mat(0x8a4a2c), crust: mat(0xe2b06a),
  cut: mat(0xe6dfcf, 'dressed'), cutDark: mat(0xc9c1ae, 'dressed'), rope: mat(0xb89a64), dust: mat(0xd8d3c6, 'soil'),
  wattle: mat(0x9a7a4a, 'thatch'),
  thatchDark: mat(0xa9862f, 'thatch'), fish: mat(0x9cc3d6), sawdust: mat(0xd9c08a, 'soil'), needle: mat(0x3c7a3a, 'needles'),
  castle: mat(0xf2e2ba, 'ashlar'), castleDark: mat(0xcdb98e, 'ashlar'), castlePlain: mat(0xd6c49a),
  smoke: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, flatShading: true, transparent: true, opacity: 0.8 }),
};

// Szyby, ciemne wnęki i rysy leżą tuż przy ścianie: z daleka karta graficzna myli je ze ścianą i obraz mruga.
// Przesunięcie głębi „do przodu” rozstrzyga ten remis zawsze na ich korzyść.
for (const m of [M.window, M.pane, M.dark]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }

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

/** Dach jak na stodole: ciemniejszy okap pod spodem, gruba warstwa na wierzchu i kalenica z żerdzi. */
function layeredRoof(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, y: number, x = 0, z = 0): void {
  const eave = m === M.thatch ? M.thatchDark : M.woodDark;
  gable(g, eave, w * 1.06, h * 0.9, d * 1.1, y - 0.035, x, z);
  gable(g, m, w, h, d, y + 0.02, x, z);
  box(g, M.woodDark, w * 1.03, 0.05, 0.07, x, y + h - 0.01, z);
}

/** Chata. Z `open` dach i ściany dają się zdjąć, żeby pokazać wnętrze, gdy ktoś w środku pracuje. */
function hut(g: THREE.Group, wall: THREE.Material, roof: THREE.Material, w: number, d: number, h: number, x = 0, z = 0, open = false): THREE.Group {
  const shell = box(g, wall, w, h, d, x, 0, z);
  const top = new THREE.Group();
  layeredRoof(top, roof, w * 1.14, h * 0.8, d * 1.18, h, x, z);
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
/** Barwi bryłę kolorem w wierzchołkach (żeby jeden stos mógł mieć np. kosz i jabłka) */
function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(parts.map((p2) => (p2.index ? p2.toNonIndexed() : p2)))!;

/**
 * Jak wygląda jedna porcja surowca w składzie. Każda ma własny kształt i teksturę:
 * deski z usłojeniem, ciosany kamień, snopki zboża ze związanymi kłosami, worki z płótna, sztaby, kosze.
 */
/** Kosz z wikliny: dno, ścianki zwężające się w dół, obręcz u góry i ciemniejsze plecione pasy */
function basket(light: number, dark: number): THREE.BufferGeometry[] {
  return [
    paint(part(new THREE.CylinderGeometry(0.2, 0.15, 0.14, 14, 1, true), 0, -0.07, 0), light),
    paint(part(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 14), 0, -0.135, 0), dark),
    paint(new THREE.TorusGeometry(0.2, 0.014, 5, 20).rotateX(Math.PI / 2).translate(0, 0.0, 0), dark),
    ...[-0.1, -0.05].map((y) => paint(new THREE.TorusGeometry(0.18 + (y + 0.1) * 0.4, 0.008, 4, 20).rotateX(Math.PI / 2).translate(0, y, 0), dark)),
    paint(part(new THREE.CylinderGeometry(0.185, 0.185, 0.02, 14), 0, -0.02, 0), 0x5a3e22), // ciemne wnętrze pod owocami
  ];
}
const PILES: Record<string, { geo: THREE.BufferGeometry; tex?: Pattern; metal?: boolean }> = {
  wood: {
    tex: 'planks',
    geo: merge([0, 1, 2].flatMap((layer) => [-0.115, 0.115].map((z) => paint(part(new THREE.BoxGeometry(0.46, 0.07, 0.21), (layer % 2 ? 0.015 : -0.01), -0.1 + layer * 0.088, z), layer === 2 ? 0xe2bf8a : 0xd2ab74)))
      .concat([-0.18, 0.18].map((x) => paint(part(new THREE.BoxGeometry(0.04, 0.03, 0.46), x, -0.135, 0), 0x6b4a2e)))),
  },
  stone: {
    tex: 'dressed',
    geo: merge([
      paint(part(new THREE.BoxGeometry(0.4, 0.17, 0.38), 0, -0.065, 0), 0xc9c4b6),
      paint(part(new THREE.BoxGeometry(0.22, 0.13, 0.2).rotateY(0.3), -0.07, 0.09, -0.05), 0xb9b3a4),
      paint(part(new THREE.BoxGeometry(0.17, 0.11, 0.16).rotateY(-0.4), 0.1, 0.08, 0.08), 0xd6d0c2),
    ]),
  },
  iron: {
    metal: true,
    // sztaby żelaza: trapezowe odlewy ułożone w krzyż (warstwa wzdłuż, warstwa w poprzek), na drewnianym podkładzie
    geo: merge([
      ...[-0.15, 0.15].map((x) => paint(part(new THREE.BoxGeometry(0.05, 0.03, 0.4), x, -0.135, 0), 0x5a3e24)),
      ...[0, 1, 2].flatMap((layer) => [-0.12, 0, 0.12].map((o) => {
        const bar = new THREE.CylinderGeometry(0.035, 0.055, 0.36, 4, 1).rotateY(Math.PI / 4).scale(1, 0.6, 1).rotateX(Math.PI / 2);
        if (layer % 2) bar.rotateY(Math.PI / 2);
        return paint(part(bar, layer % 2 ? 0 : o, -0.09 + layer * 0.048, layer % 2 ? o : 0), layer === 2 ? 0x7a7c84 : 0x5f6168);
      })),
    ]),
  },
  wheat: {
    tex: 'thatch',
    // dwa snopki oparte o siebie: pęk źdźbeł rozchylony u dołu, przewiązany powrósłem, u góry opadające kłosy
    geo: merge([-0.1, 0.1].flatMap((x, side) => {
      const lean = side ? -0.18 : 0.18;
      const parts: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2 + (k % 2) * 0.15;
        const spread = 0.04 + (k % 3) * 0.012;
        // źdźbło: od rozchylonej stopy do przewiązki i dalej do kłosa
        // dół źdźbeł rozchodzi się na boki (snop stoi na szerokiej stopie), w przewiązce są ściśnięte
        const stalk = new THREE.CylinderGeometry(0.009, 0.007, 0.3, 3).rotateX(-Math.sin(a) * 0.22).rotateZ(Math.cos(a) * 0.22 + lean);
        parts.push(paint(part(stalk, x + Math.cos(a) * spread * 0.5, -0.02, Math.sin(a) * spread * 0.5), k % 2 ? 0xd9b452 : 0xc9a240));
        // kłos: wydłużony, lekko opadający na zewnątrz
        // kłosy zbite w pióropusz, lekko opadające na boki
        const ear = new THREE.IcosahedronGeometry(0.017, 0).scale(0.75, 2.4, 0.75).rotateZ(-Math.cos(a) * 0.45 + lean).rotateX(Math.sin(a) * 0.45);
        parts.push(paint(part(ear, x + Math.cos(a) * 0.028 - lean * 0.14, 0.15 + (k % 3) * 0.008, Math.sin(a) * 0.028), k % 3 ? 0xe8c766 : 0xd4ad4a));
      }
      parts.push(paint(part(new THREE.CylinderGeometry(0.048, 0.048, 0.025, 10).rotateZ(lean), x - lean * 0.03, 0.0, 0), 0x8a6a28)); // powrósło
      return parts;
    })),
  },
  flour: {
    tex: 'thatch',
    // worki z płótna: pękaty spód, zwężenie przewiązane sznurkiem, nad nim zebrana góra worka; jeden leży bokiem
    geo: merge([
      ...([[-0.1, -0.05, 0.15], [0.11, -0.06, -0.1]] as const).flatMap(([x, z, rot]) => [
        paint(new THREE.CylinderGeometry(0.085, 0.11, 0.2, 9).rotateY(rot).translate(x, -0.05, z), 0xe6dcc4), // korpus
        paint(new THREE.IcosahedronGeometry(0.1, 1).scale(1.05, 0.55, 1.05).translate(x, -0.13, z), 0xddd2b8), // wybrzuszony dół
        paint(new THREE.IcosahedronGeometry(0.088, 1).scale(1, 0.5, 1).translate(x, 0.05, z), 0xe6dcc4), // ramiona worka
        paint(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 8).translate(x, 0.1, z), 0xd8cdb0), // szyjka
        paint(new THREE.CylinderGeometry(0.034, 0.034, 0.014, 8).translate(x, 0.105, z), 0x7a5a32), // sznurek
        paint(new THREE.ConeGeometry(0.045, 0.06, 7).rotateX(Math.PI).translate(x, 0.15, z), 0xddd2b8), // zebrana góra
        paint(new THREE.IcosahedronGeometry(0.03, 0).scale(1.6, 0.2, 1.2).translate(x + 0.02, 0.07, z + 0.06), 0xf6f2e8), // mąka na płótnie
      ]),
      // trzeci worek leży bokiem z przodu
      paint(new THREE.CylinderGeometry(0.07, 0.085, 0.24, 9).rotateZ(Math.PI / 2).translate(0.0, -0.1, 0.13), 0xe0d6be),
      paint(new THREE.ConeGeometry(0.04, 0.05, 7).rotateZ(-Math.PI / 2).translate(0.15, -0.1, 0.13), 0xd8cdb0),
    ]),
  },
  bread: {
    tex: 'organic',
    // kosz z wikliny (obręcz, plecione pasy), w nim bochny z naciętą skórką i jasnym oprószeniem mąką
    geo: merge([
      ...basket(0x8a6438, 0x6b4a2a),
      ...([[-0.08, -0.05, 0.4, 0xb8743a], [0.08, -0.04, -0.5, 0xc4823f], [0, 0.08, 1.2, 0xae6a33]] as const).flatMap(([x, z, rot, col]) => [
        paint(new THREE.IcosahedronGeometry(0.07, 2).scale(1.55, 0.72, 1).rotateY(rot).translate(x, 0.02, z), col),
        // trzy ukośne nacięcia na skórce
        ...[-0.04, 0, 0.04].map((d) => paint(new THREE.BoxGeometry(0.012, 0.012, 0.06).rotateY(rot + 0.6).translate(x + Math.cos(rot) * d, 0.072, z - Math.sin(rot) * d), 0x6e3e1c)),
        paint(new THREE.IcosahedronGeometry(0.04, 1).scale(1.6, 0.25, 0.8).rotateY(rot).translate(x, 0.066, z), 0xe9d8b8), // mąka na wierzchu
      ]),
      paint(new THREE.IcosahedronGeometry(0.06, 2).scale(1, 0.75, 1).translate(0.03, 0.1, 0.01), 0xc98a45), // okrągły bochenek na górze
    ]),
  },
  apples: {
    tex: 'organic',
    // kosz jabłek: każde trochę inne (czerwone, rumiane, zielone), z ogonkiem; jedno z listkiem
    geo: merge([
      ...basket(0x8a6438, 0x6b4a2a),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((k) => {
        const top = k >= 7;
        const ang = k * 0.9 + (top ? 0.4 : 0), rr = top ? 0.04 : k ? 0.11 : 0;
        const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, y = top ? 0.09 : 0.03 + (k ? 0 : 0.03);
        const col = [0xc8261d, 0xb31d18, 0xd9452a, 0x9fbf3a, 0xc8261d, 0xe0582c, 0xb8301f, 0xa8c040, 0xcf3322][k]!;
        const parts = [
          paint(new THREE.IcosahedronGeometry(0.052, 2).scale(1, 0.92, 1).translate(x, y, z), col),
          paint(new THREE.SphereGeometry(0.02, 6, 4).scale(1, 0.4, 1).translate(x + 0.01, y + 0.03, z - 0.012), 0xf2d27a), // rumieniec / połysk
          paint(new THREE.CylinderGeometry(0.004, 0.005, 0.03, 4).rotateZ(0.3).translate(x, y + 0.055, z), 0x4a3018), // ogonek
        ];
        if (k === 8) parts.push(paint(new THREE.IcosahedronGeometry(0.022, 0).scale(1.6, 0.25, 0.8).rotateY(0.6).translate(x + 0.02, y + 0.06, z), 0x4f8a2c));
        return parts;
      }),
    ]),
  },
  spear: {
    tex: 'planks',
    // pęk włóczni na kozłach: drzewca jasne, groty z żelaza
    geo: merge([
      ...[-0.16, 0.16].map((x) => paint(part(new THREE.BoxGeometry(0.04, 0.12, 0.3), x, -0.1, 0), 0x6b4a2e)),
      ...[0, 1, 2, 3, 4].flatMap((k) => [
        paint(new THREE.CylinderGeometry(0.014, 0.016, 0.5, 5).rotateZ(Math.PI / 2).translate(0, -0.02 + (k % 2) * 0.03, -0.1 + k * 0.05), 0xc9a26b),
        paint(new THREE.ConeGeometry(0.025, 0.08, 4).rotateZ(-Math.PI / 2).translate(0.29, -0.02 + (k % 2) * 0.03, -0.1 + k * 0.05), 0x8a8f96),
      ]),
    ]),
  },
  bow: {
    tex: 'planks',
    // łuki oparte o kozioł, cięciwy jasne
    geo: merge([
      ...[-0.16, 0.16].map((x) => paint(part(new THREE.BoxGeometry(0.04, 0.12, 0.3), x, -0.1, 0), 0x6b4a2e)),
      ...[0, 1, 2, 3].flatMap((k) => [
        paint(new THREE.TorusGeometry(0.2, 0.012, 4, 12, Math.PI * 0.9).rotateZ(Math.PI * 0.05).translate(0, 0.02, -0.09 + k * 0.06), 0x7a5232),
        paint(new THREE.CylinderGeometry(0.004, 0.004, 0.39, 3).rotateZ(Math.PI / 2).translate(0, 0.03, -0.09 + k * 0.06), 0xe8e0c8),
      ]),
    ]),
  },
  fish: {
    tex: 'organic',
    // skrzynka z listew, w niej ryby: ciemny grzbiet, srebrny brzuch, płetwa ogonowa i grzbietowa, oko
    geo: merge([
      paint(part(new THREE.BoxGeometry(0.38, 0.02, 0.3), 0, -0.12, 0), 0x6b4f30),
      ...[-0.14, 0.14].map((z) => paint(part(new THREE.BoxGeometry(0.4, 0.08, 0.02), 0, -0.08, z), 0x8a6a45)),
      ...[-0.19, 0.19].map((x) => paint(part(new THREE.BoxGeometry(0.02, 0.08, 0.3), x, -0.08, 0), 0x7a5a3a)),
      ...([[-0.08, 0.1, 0], [0, -0.05, 0.03], [0.08, 0.06, 0], [-0.02, 0.02, 0.08]] as const).flatMap(([z, rot, lift]) => {
        const y = -0.03 + lift;
        return [
          paint(new THREE.IcosahedronGeometry(0.06, 2).scale(2.4, 0.5, 0.75).rotateY(rot).translate(0, y, z), 0xc9d6dc), // brzuch
          paint(new THREE.IcosahedronGeometry(0.058, 2).scale(2.35, 0.35, 0.6).rotateY(rot).translate(0, y + 0.012, z), 0x4f6470), // grzbiet
          paint(new THREE.ConeGeometry(0.04, 0.07, 3).rotateZ(Math.PI / 2).scale(1, 1, 0.25).rotateY(rot).translate(-Math.cos(rot) * 0.17, y, z + Math.sin(rot) * 0.17), 0x5f7480), // ogon
          paint(new THREE.ConeGeometry(0.02, 0.05, 3).scale(1.6, 1, 0.3).rotateY(rot).translate(0, y + 0.035, z), 0x5a6e7a), // płetwa grzbietowa
          paint(new THREE.SphereGeometry(0.008, 5, 4).translate(Math.cos(rot) * 0.115, y + 0.008, z - Math.sin(rot) * 0.115 + 0.02), 0x111111), // oko
        ];
      }),
    ]),
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
    if (!m) {
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: pile.metal ? 0.45 : 0.92, metalness: pile.metal ? 0.6 : 0, map: pile.tex ? pattern(pile.tex) : null, bumpMap: pile.tex ? bump(pile.tex) : null, bumpScale: 1.2 });
      pileMats.set(r.id, m);
    }
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

/** Stos gruzu po rozbiórce: kamienie, połamane belki i deski rozsypane po działce. */
export function rubbleModel(w: number, h: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const count = Math.round(9 * w * h);
  let s = seed * 9301 + 49297;
  const r = (): number => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    const x = (r() - 0.5) * w * 0.85, z = (r() - 0.5) * h * 0.85;
    const kind = i % 3;
    let m: THREE.Mesh;
    if (kind === 0) { m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + r() * 0.1, 0), r() > 0.5 ? M.rock : M.rockDark); m.position.set(x, 0.07 + r() * 0.12, z); }
    else if (kind === 1) { m = new THREE.Mesh(new THREE.BoxGeometry(0.5 + r() * 0.4, 0.06, 0.08), M.woodDark); m.position.set(x, 0.08 + r() * 0.2, z); }
    else { m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + r() * 0.3, 0.035, 0.16), M.plank); m.position.set(x, 0.05 + r() * 0.15, z); }
    m.rotation.set((r() - 0.5) * 0.9, r() * 6.3, (r() - 0.5) * 0.9);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/** Pokazuje tyle gruzu, ile jeszcze zostało do wyniesienia. */
export function setRubble(model: THREE.Object3D, ratio: number): void {
  const shown = Math.max(1, Math.ceil(model.children.length * ratio));
  model.children.forEach((c, i) => { c.visible = i < shown; });
}

/** Noc: okna zaczynają świecić ciepłym światłem. `k` od 0 (dzień) do 1 (środek nocy). */
/** Bale częstokołu dla pola: środkowy pal i pół przęsła w stronę każdego sąsiada z umocnieniem */
export function palisadeLogs(links: [boolean, boolean, boolean, boolean], seed: number): { x: number; z: number; h: number; r: number }[] {
  const out: { x: number; z: number; h: number; r: number }[] = [];
  const rand = (i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  out.push({ x: 0, z: 0, h: 1.25 + rand(0) * 0.2, r: 0.1 });
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let n = 1;
  dirs.forEach(([dx, dz], k) => {
    if (!links[k]) return;
    for (const t of [0.2, 0.4]) { out.push({ x: dx * t, z: dz * t, h: 1.15 + rand(n) * 0.25, r: 0.085 + rand(n + 7) * 0.02 }); n++; }
  });
  if (n === 1) for (const [dx, dz] of dirs) { out.push({ x: dx * 0.2, z: dz * 0.2, h: 1.1 + rand(n) * 0.2, r: 0.09 }); n++; }
  return out;
}

/** Czy materiał to szyba okna (świeci nocą) */
export const isWindowMat = (m: THREE.Material): boolean => m === M.window || m === M.pane;

export function setNight(k: number): void {
  M.window.emissive.setHex(0xffb050);
  M.window.emissiveIntensity = k * 0.95;
  // szyby chat: w dzień ciemna wnęka, nocą ciepłe światło ze środka
  M.pane.emissive.setHex(0xff9a3c);
  M.pane.emissiveIntensity = k * 1.3;
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
    // wszystkie części o tych nazwach (np. twierdza ma kilka warstw „shell”: donżon i bryłę murów z dziedzińcem)
    const parts = (model.userData.lids ??= (() => { const l: THREE.Object3D[] = []; model.traverse((o) => { if (o !== model && ['roof', 'shell', 'chimney', 'spin'].includes(o.name)) l.push(o); }); return l; })()) as THREE.Object3D[];
    for (const part of parts) part.visible = !active;
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
        p.position.x = 0.3 - k * 0.38;
        p.position.z = -0.08 - Math.sin(k * Math.PI) * 0.1;
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
  const crops = (model.userData.crops ?? model.children[0]?.userData.crops) as THREE.Object3D[] | undefined;
  if (crops) for (const o of crops) o.rotation.x = Math.sin(time * 1.3 + o.position.z * 3) * 0.06;
  const runner = model.getObjectByName('runner');
  if (runner && active) runner.rotation.y += dt * 2.2;
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

/** Jeden rząd zboża jako wspólna bryła: kilkadziesiąt źdźbeł różnej wysokości z kłosami, barwy w wierzchołkach. */
const wheatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
const wheatRows = new Map<number, THREE.BufferGeometry>();
function wheatRow(variant: number): THREE.BufferGeometry {
  const v = variant % 3;
  const hit = wheatRows.get(v);
  if (hit) return hit;
  const parts: THREE.BufferGeometry[] = [];
  let r = 1234 + v * 977;
  const rnd = (): number => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  for (let x = -0.86; x <= 0.86; x += 0.045)
    for (const lane of [-0.08, 0, 0.08]) {
      const px = x + (rnd() - 0.5) * 0.04, pz = lane + (rnd() - 0.5) * 0.05;
      const h = 0.26 + rnd() * 0.14;
      const lean = (rnd() - 0.5) * 0.25;
      const shade = 0.85 + rnd() * 0.25;
      const stalk = new THREE.CylinderGeometry(0.006, 0.009, h, 3).translate(0, h / 2, 0).rotateX(lean).translate(px, 0, pz);
      parts.push(paint(stalk, new THREE.Color(0xb89a3c).multiplyScalar(shade).getHex()));
      const ear = new THREE.ConeGeometry(0.018, 0.09, 4).rotateX(Math.PI).translate(0, h + 0.03, 0).rotateZ((rnd() - 0.5) * 0.5).rotateX(lean).translate(px, 0, pz);
      parts.push(paint(ear, new THREE.Color(0xe6c55c).multiplyScalar(shade).getHex()));
      if (rnd() < 0.35) parts.push(paint(new THREE.PlaneGeometry(0.02, 0.12).translate(0, h * 0.4, 0).rotateY(rnd() * 3).rotateZ(0.6).translate(px, 0, pz), 0x9aa046));
    }
  const geo = merge(parts);
  wheatRows.set(v, geo);
  return geo;
}


/** Materiały „rękodzieła”: kolor w wierzchołkach (każda belka i kamień w innym odcieniu) plus wzór. */
let craftMats: { timber: THREE.MeshStandardMaterial; stones: THREE.MeshStandardMaterial } | null = null;
function craft(): { timber: THREE.MeshStandardMaterial; stones: THREE.MeshStandardMaterial } {
  if (craftMats) return craftMats;
  const make = (tex: Pattern): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern(tex), bumpMap: bump(tex), bumpScale: 1.3 });
  craftMats = { timber: make('planks'), stones: make('rock') };
  craftMats.stones.bumpScale = 0.6;
  return craftMats;
}
let houseSeed = 1;

/**
 * Chata z szachulcem: podmurówka z polnych kamieni, bielone ściany z ciemnymi, ręcznie ciosanymi belkami,
 * prawdziwe otwory na drzwi i okna (z okiennicami), gruba nierówna strzecha, komin z kamienia,
 * drewno pod ścianą. Zwraca grupę wnętrza (widoczną, gdy zaglądamy do środka).
 */
/**
 * Chata w nowym stylu (szachulec, strzecha, podmurówka, wnętrze) w dowolnym rozmiarze i miejscu działki.
 * Zwraca grupę wnętrza w układzie działki (te same współrzędne co dawny hut()), więc wyposażenie wstawia się jak wcześniej.
 */
function cottageAt(g: THREE.Group, seed: number, w: number, d: number, h: number, x: number, z: number): THREE.Group {
  const sub = new THREE.Group();
  const inside = cottage(sub, seed);
  const sx = w / 1.5, sy = h / 0.92, sz = d / 1.2;
  sub.scale.set(sx, sy, sz);
  sub.position.set(x, 0, z);
  g.add(sub);
  const local = new THREE.Group();
  local.scale.set(1 / sx, 1 / sy, 1 / sz);
  local.position.set(-x / sx, 0, -z / sz);
  inside.add(local);
  return local;
}

function cottage(g: THREE.Group, seed: number): THREE.Group {
  const r = rng(seed * 7919 + 13);
  const W = 1.5, D = 1.2, H = 0.92, RH = 0.6, EAVE = 0.15, GABLE = 0.12;
  const left = seed % 2 === 0; // po której stronie komin, a po której drewno
  const { timber, stones } = craft();
  // podmurówka
  const skirt = new THREE.Mesh(stoneSkirt(W + 0.04, D + 0.04, 0.2, r), stones);
  g.add(skirt);
  const shell = new THREE.Group();
  shell.name = 'shell';
  // ściany z otworami: drzwi i okno z przodu, okna z boków i z tyłu
  // otwór = pudełko wycinane ze ściany (w: wymiar w osi x, d: w osi z); wnęka ma głębokość ~0.1
  const walls = cutBox(W, H, D, [
    { w: 0.28, h: 0.56, d: 0.24, x: -0.25, y: 0.28, z: D / 2 },
    { w: 0.24, h: 0.22, d: 0.2, x: 0.36, y: 0.56, z: D / 2 },
    { w: 0.2, h: 0.2, d: 0.2, x: -0.18, y: 0.56, z: -D / 2 },
    { w: 0.2, h: 0.2, d: 0.2, x: W / 2, y: 0.56, z: 0 },
    { w: 0.2, h: 0.2, d: 0.2, x: -W / 2, y: 0.56, z: 0 },
  ], M.plaster, 0.9);
  shell.add(walls);
  // wnęki: szyba w głębi, krzyż ramy, parapet, okiennice odchylone na boki
  const glass = (x: number, y: number, z: number, nx: number, nz: number, w: number, h: number): void => {
    const deep = 0.085;
    const px = x - nx * deep, pz = z - nz * deep;
    const pane = box(shell, M.pane, nx ? 0.01 : w, h, nz ? 0.01 : w, px, y - h / 2, pz);
    pane.name = 'pane';
    box(shell, M.woodDark, nx ? 0.02 : w, 0.025, nz ? 0.02 : w, px + nx * 0.01, y - 0.012, pz + nz * 0.01);
    box(shell, M.woodDark, nx ? 0.02 : 0.025, h, nz ? 0.02 : 0.025, px + nx * 0.01, y - h / 2, pz + nz * 0.01);
    box(shell, M.wood, nx ? 0.07 : w + 0.06, 0.03, nz ? 0.07 : w + 0.06, x + nx * 0.02, y - h / 2 - 0.03, z + nz * 0.02);
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      const hx = nx ? x + nx * 0.01 : x + side * (w / 2 + 0.005), hz = nz ? z + nz * 0.01 : z + side * (w / 2 + 0.005);
      sh.position.set(hx, y - h / 2, hz);
      box(sh, M.wood, nz ? w / 2 : 0.02, h + 0.02, nx ? w / 2 : 0.02, nz ? side * w / 4 : 0, -0.01, nx ? side * w / 4 : 0);
      box(sh, M.woodDark, nz ? w / 2 : 0.024, 0.02, nx ? w / 2 : 0.024, nz ? side * w / 4 : 0, h * 0.25, nx ? side * w / 4 : 0);
      sh.rotation.y = (nz ? side * (nz > 0 ? 1 : -1) : -side * (nx > 0 ? 1 : -1)) * (0.9 + r() * 0.4);
      shell.add(sh);
    }
  };
  glass(0.36, 0.67, D / 2, 0, 1, 0.24, 0.22);
  glass(-0.18, 0.66, -D / 2, 0, -1, 0.2, 0.2);
  glass(W / 2, 0.66, 0, 1, 0, 0.2, 0.2);
  glass(-W / 2, 0.66, 0, -1, 0, 0.2, 0.2);
  // drzwi z desek w głębi otworu, okute zawiasami, z kamiennym progiem
  box(shell, M.wood, 0.26, 0.54, 0.03, -0.25, 0.0, D / 2 - 0.1);
  for (const yy of [0.1, 0.42]) box(shell, M.iron, 0.2, 0.025, 0.012, -0.29, yy, D / 2 - 0.08);
  box(shell, M.iron, 0.025, 0.025, 0.02, -0.15, 0.24, D / 2 - 0.075);
  box(g, M.stoneDark, 0.36, 0.05, 0.16, -0.25, 0, D / 2 + 0.1);
  // szachulec: słupy narożne, podwalina, oczep, rygle, zastrzały i nadproża, lekko wystające z tynku
  const B: THREE.BufferGeometry[] = [];
  const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  const t = 0.075, o = 0.012;
  const fz = D / 2 + o, bz = -D / 2 - o, rx = W / 2 + o, lx = -W / 2 - o;
  for (const [x, z] of [[lx, fz], [rx, fz], [lx, bz], [rx, bz]] as const) B.push(beam(V(x, 0.02, z), V(x, H, z), t, r));
  for (const [z] of [[fz], [bz]] as const) { B.push(beam(V(-W / 2, 0.05, z), V(W / 2, 0.05, z), t, r)); B.push(beam(V(-W / 2, H - 0.03, z), V(W / 2, H - 0.03, z), t, r)); }
  for (const [x] of [[lx], [rx]] as const) { B.push(beam(V(x, 0.05, -D / 2), V(x, 0.05, D / 2), t, r)); B.push(beam(V(x, H - 0.03, -D / 2), V(x, H - 0.03, D / 2), t, r)); }
  // przód: słupki przy drzwiach i oknie, zastrzały
  for (const x of [-0.43, -0.07, 0.2, 0.52]) B.push(beam(V(x, 0.05, fz), V(x, H - 0.03, fz), t * 0.85, r));
  B.push(beam(V(-0.72, 0.08, fz), V(-0.45, H - 0.06, fz), t * 0.8, r));
  B.push(beam(V(0.54, 0.08, fz), V(0.72, 0.5, fz), t * 0.8, r));
  B.push(beam(V(-0.43, 0.6, fz), V(-0.07, 0.6, fz), t * 0.8, r));
  B.push(beam(V(0.2, 0.81, fz), V(0.52, 0.81, fz), t * 0.7, r));
  B.push(beam(V(0.2, 0.52, fz), V(0.52, 0.52, fz), t * 0.7, r));
  // tył: słupki i krzyż św. Andrzeja
  for (const x of [-0.32, -0.04, 0.4]) B.push(beam(V(x, 0.05, bz), V(x, H - 0.03, bz), t * 0.85, r));
  B.push(beam(V(-0.04, 0.08, bz), V(0.4, H - 0.06, bz), t * 0.75, r));
  B.push(beam(V(0.4, 0.08, bz), V(-0.04, H - 0.06, bz), t * 0.75, r));
  B.push(beam(V(-0.72, 0.48, bz), V(-0.32, 0.48, bz), t * 0.75, r));
  // boki: słupki przy oknach i zastrzały do narożników
  for (const x of [lx, rx]) {
    for (const z of [-0.14, 0.14]) B.push(beam(V(x, 0.05, z), V(x, H - 0.03, z), t * 0.85, r));
    B.push(beam(V(x, 0.08, -D / 2 + 0.04), V(x, H - 0.06, -0.16), t * 0.75, r));
    B.push(beam(V(x, 0.08, D / 2 - 0.04), V(x, H - 0.06, 0.16), t * 0.75, r));
  }
  // szczyty: trójkąty z tynku z belką pionową i dwiema skośnymi pod okapem
  for (const sx of [-1, 1]) {
    const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, RH)]);
    const gg = new THREE.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false });
    gg.rotateY(Math.PI / 2);
    gg.translate(sx * (W / 2) - 0.025 - (sx < 0 ? -0.0 : 0), H, 0);
    const gm = new THREE.Mesh(gg, M.plaster);
    const uv = gg.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9, uv.getY(i) * 0.9);
    shell.add(gm);
    const x = sx * (W / 2 + o);
    B.push(beam(V(x, H, 0), V(x, H + RH - 0.04, 0), t * 0.8, r));
    B.push(beam(V(x, H + 0.02, -D / 2 + 0.05), V(x, H + RH - 0.06, -0.02), t * 0.7, r));
    B.push(beam(V(x, H + 0.02, D / 2 - 0.05), V(x, H + RH - 0.06, 0.02), t * 0.7, r));
  }
  const tones = B.map((geo) => paintGeo(geo, new THREE.Color(0x5a3d26).multiplyScalar(0.8 + r() * 0.35)));
  shell.add(new THREE.Mesh(mergeGeometries(tones.map((x) => (x.index ? x.toNonIndexed() : x)))!, timber));
  g.add(shell);
  // strzecha: dwie grube, nierówne połacie z okapem wysuniętym za ściany i kalenica z pęku słomy
  const roof = new THREE.Group();
  roof.name = 'roof';
  const run = D / 2 + EAVE, rise = RH + 0.05, L = Math.hypot(run, rise), a = Math.atan2(rise, run);
  for (const side of [1, -1]) {
    const slab = new THREE.Mesh(thatchSlab(W + GABLE * 2, L, 0.13, seed * 31 + side), M.thatch);
    slab.rotation.order = 'YXZ';
    slab.rotation.set(a, side > 0 ? 0 : Math.PI, 0);
    const n = 0.065; // połowa grubości, żeby spód połaci leżał na krawędzi szczytu
    slab.position.set(0, H + RH - rise / 2 + Math.cos(a) * n, side * (run / 2) + side * Math.sin(a) * n);
    roof.add(slab);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, W + GABLE * 2 + 0.04, 9).rotateZ(Math.PI / 2), M.thatchDark);
  ridge.position.set(0, H + RH + 0.08, 0);
  roof.add(ridge);
  for (let k = 0; k < 5; k++) { const peg = box(roof, M.woodDark, 0.03, 0.03, 0.24, -W / 2 + 0.1 + k * ((W - 0.2) / 4), H + RH + 0.1, 0); peg.rotation.x = 0.1; }
  g.add(roof);
  // komin z kamienia przy szczycie, przebija strzechę
  const cx = (left ? -1 : 1) * (W / 2 - 0.22);
  const chim = new THREE.Group();
  chim.name = 'chimney';
  box(chim, M.castleDark, 0.24, RH + 0.62, 0.24, cx, H * 0.6, -0.18);
  box(chim, M.stoneDark, 0.3, 0.06, 0.3, cx, H * 0.6 + RH + 0.62, -0.18);
  g.add(chim);
  // drewno porąbane pod ścianą, beczka przy drzwiach, skrzynka z kwiatami pod oknem
  const wx = (left ? 1 : -1) * (W / 2 + 0.16);
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 5 - row; k++) {
      // polano leży w poprzek ściany (czołem do nas), polana obok siebie z odstępem — nie przenikają się
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.3, 7).rotateZ(Math.PI / 2), r() < 0.3 ? M.bark : M.plank);
      log.position.set(wx, 0.046 + row * 0.08, -0.36 + k * 0.105 + row * 0.0525);
      g.add(log);
    }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.22, 10), M.wood);
  barrel.position.set(-0.6, 0.11, D / 2 + 0.16);
  g.add(barrel);
  box(shell, M.wood, 0.3, 0.06, 0.08, 0.36, 0.46, D / 2 + 0.06);
  for (let k = 0; k < 5; k++) {
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), k % 2 ? M.apple : M.gold);
    fl.position.set(0.24 + k * 0.06, 0.55, D / 2 + 0.06);
    shell.add(fl);
  }
  // wnętrze: podłoga i niskie ściany tych samych wymiarów
  const interior = new THREE.Group();
  interior.name = 'interior';
  interior.visible = false;
  box(interior, M.wood, W, 0.05, D, 0, 0, 0);
  const tw = 0.07, low = H * 0.45;
  box(interior, M.plaster, W, low, tw, 0, 0, -D / 2 + tw / 2).name = 'iwall';
  box(interior, M.plaster, tw, low, D, -W / 2 + tw / 2, 0, 0).name = 'iwall';
  box(interior, M.plaster, tw, low, D, W / 2 - tw / 2, 0, 0).name = 'iwall';
  box(interior, M.plaster, W * 0.3, low, tw, -W * 0.35, 0, D / 2 - tw / 2).name = 'iwall';
  box(interior, M.plaster, W * 0.3, low, tw, W * 0.35, 0, D / 2 - tw / 2).name = 'iwall';
  g.add(interior);
  return interior;
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
    const r = rng(7331);
    // Podstawa: skarpa z ciosów (szersza u dołu), polne kamienie u stóp, mur z gzymsem i blankami
    box(g, D, 2.72, 0.18, 2.72);
    box(g, D, 2.62, 0.14, 2.62, 0, 0.18, 0);
    g.add(new THREE.Mesh(stoneSkirt(2.78, 2.78, 0.16, r, new THREE.Color(0xb9ae98)), craft().stones));
    // bryła murów z dziedzińcem: przy podglądzie wnętrza znika i odsłania podziemia
    const outer = new THREE.Group();
    outer.name = 'shell';
    g.add(outer);
    box(outer, S, 2.5, 0.88, 2.5, 0, 0.32, 0);
    box(outer, D, 2.58, 0.08, 2.58, 0, 0.62, 0); // gzyms w połowie wysokości
    box(outer, D, 2.6, 0.1, 2.6, 0, 1.2, 0);
    for (const sx of [-1, 1]) { merlons(0, sx * 1.25, 2.5, 1.3, true, S); merlons(sx * 1.25, 0, 2.5, 1.3, false, S); }
    // przypory i strzelnice na każdym boku muru
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      for (const o of [-0.55, 0.55]) {
        if (nz === 1 && Math.abs(o) < 0.6) continue; // z przodu stoi brama
        const px = nx ? nx * 1.27 : o, pz = nz ? nz * 1.27 : o;
        box(g, D, nx ? 0.12 : 0.22, 0.9, nx ? 0.22 : 0.12, px, 0.3, pz);
        box(g, M.dark, nx ? 0.02 : 0.05, 0.2, nx ? 0.05 : 0.02, nx ? nx * 1.255 : o + 0.25 * (o > 0 ? -1 : 1), 0.78, nz ? nz * 1.255 : o + 0.25 * (o > 0 ? -1 : 1));
      }
    }
    // dziedziniec wyłożony kamieniem, ze studnią, beczkami i stogiem siana
    box(outer, M.roadStone, 2.3, 0.03, 2.3, 0, 1.2, 0);
    const well = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.16, 12), M.stone), 0.13, 0.16);
    well.position.set(0.72, 1.31, 0.62);
    outer.add(well);
    box(outer, M.dark, 0.16, 0.01, 0.16, 0.72, 1.39, 0.62);
    for (const sx of [-1, 1]) box(outer, M.woodDark, 0.03, 0.26, 0.03, 0.72 + sx * 0.12, 1.23, 0.62);
    box(outer, M.woodDark, 0.3, 0.03, 0.04, 0.72, 1.48, 0.62);
    for (const [x, z] of [[-0.85, 0.75], [-0.72, 0.82]] as const) { const bl = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.15, 10), M.wood), 0.07, 0.15); bl.position.set(x, 1.3, z); outer.add(bl); }
    const hay = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.hay);
    hay.position.set(-0.85, 1.22, 0.45);
    outer.add(hay);
    // donżon: wieża mieszkalna na skarpowej podstawie, okna z wnękami, drewniana hurdycja i spiczasty dach (zdejmowany przy wnętrzu)
    const don = new THREE.Group();
    don.name = 'shell';
    const gg = g;
    g = don;
    box(g, D, 1.37, 0.16, 1.37, 0, 1.2, -0.25);
    const tower = cutBox(1.25, 1.62, 1.25, [
      { w: 0.18, h: 0.3, d: 0.16, x: -0.3, y: 1.05, z: 0.625 }, { w: 0.18, h: 0.3, d: 0.16, x: 0.3, y: 1.05, z: 0.625 },
      { w: 0.18, h: 0.3, d: 0.16, x: -0.3, y: 0.45, z: 0.625 }, { w: 0.18, h: 0.3, d: 0.16, x: 0.3, y: 0.45, z: 0.625 },
      { w: 0.16, h: 0.28, d: 0.18, x: 0.625, y: 0.85, z: 0 }, { w: 0.16, h: 0.28, d: 0.18, x: -0.625, y: 0.85, z: 0 },
    ], S, 1.15);
    tower.position.set(0, 1.3, -0.25);
    g.add(tower);
    for (const [x, y] of [[-0.3, 2.35], [0.3, 2.35], [-0.3, 1.75], [0.3, 1.75]] as const) {
      box(g, M.dark, 0.18, 0.3, 0.02, x, y - 0.15, 0.315);
      box(g, M.woodDark, 0.02, 0.3, 0.02, x, y - 0.15, 0.33);
      box(g, D, 0.24, 0.04, 0.06, x, y - 0.19, 0.39);
    }
    for (const sx of [-1, 1]) box(g, M.dark, 0.02, 0.28, 0.18, sx * 0.535, 2.01, -0.25);
    box(g, D, 1.33, 0.08, 1.33, 0, 1.95, -0.25); // gzyms piętra
    // hurdycja: wysunięta drewniana galeria na belkach, z otworami między deskami
    const HB: THREE.BufferGeometry[] = [];
    for (let k = -2; k <= 2; k++) for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const along = k * 0.29;
      const bx = nx ? nx * 0.62 : along, bz = -0.25 + (nz ? nz * 0.62 : along);
      HB.push(beam(new THREE.Vector3(bx, 2.82, bz), new THREE.Vector3(bx + nx * 0.16, 2.9, bz + nz * 0.16), 0.05, r));
    }
    g.add(new THREE.Mesh(mergeGeometries(HB.map((x) => paintGeo(x, new THREE.Color(0x4a3220)).toNonIndexed()))!, craft().timber));
    box(g, M.woodDark, 1.6, 0.06, 1.6, 0, 2.9, -0.25);
    box(g, M.wood, 1.56, 0.4, 1.56, 0, 2.96, -0.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.woodDark, 0.07, 0.42, 0.07, sx * 0.77, 2.96, -0.25 + sz * 0.77);
    for (let k = -2; k <= 2; k++) { box(g, M.dark, 0.08, 0.14, 0.02, k * 0.28, 3.1, 0.54); box(g, M.dark, 0.02, 0.14, 0.08, 0.79, 3.1, -0.25 + k * 0.28); }
    pyramid(g, team, 1.18, 1.25, 0, 3.36, -0.25);
    box(g, M.gold, 0.06, 0.12, 0.06, 0, 4.6, -0.25);
    box(g, M.woodDark, 0.04, 0.85, 0.04, 0, 4.6, -0.25);
    box(g, flag, 0.55, 0.3, 0.02, 0.29, 5.1, -0.25);
    g = gg;
    g.add(don);
    // Wnętrze po zdjęciu donżonu: cały poziom dziedzińca podzielony na komnaty, w których toczy się życie
    const hall = new THREE.Group();
    hall.name = 'interior';
    hall.visible = false;
    const Y = 1.2;
    // Sala zajmuje dokładnie obrys donżonu: te same ściany z piaskowca i te same okna, tylko ucięte nisko,
    // a dziedziniec dookoła zostaje taki, jak widać go z zewnątrz.
    const CZ = -0.25, HW = 0.625;
    box(hall, D, 1.25, 0.05, 1.25, 0, Y, CZ);
    box(hall, M.plank, 1.1, 0.02, 1.1, 0, Y + 0.05, CZ);
    // ściany: tył i boki w całości, przód z otworem na drzwi; okna w tych samych miejscach co na zewnątrz
    box(hall, S, 1.25, 0.55, 0.1, 0, Y, CZ - HW + 0.05);
    for (const sx of [-1, 1]) box(hall, S, 0.1, 0.55, 1.25, sx * (HW - 0.05), Y, CZ);
    for (const sx of [-1, 1]) box(hall, S, 0.45, 0.55, 0.1, sx * 0.4, Y, CZ + HW - 0.05);
    // gzyms na ściętych ścianach sali: tylko obwódka, środek otwarty
    for (const [x, z, w2, d2] of [[0, CZ - HW + 0.05, 1.31, 0.12], [0, CZ + HW - 0.05, 1.31, 0.12], [-HW + 0.05, CZ, 0.12, 1.31], [HW - 0.05, CZ, 0.12, 1.31]] as const) box(hall, D, w2, 0.05, d2, x, Y + 0.55, z);
    for (const x of [-0.3, 0.3]) box(hall, M.window, 0.2, 0.22, 0.03, x, Y + 0.3, CZ + HW + 0.01);
    for (const sx of [-1, 1]) box(hall, M.window, 0.03, 0.22, 0.2, sx * (HW + 0.01), Y + 0.3, CZ);
    box(hall, M.woodDark, 0.3, 0.42, 0.04, 0, Y + 0.05, CZ + HW + 0.02);
    // tron na podeście pod tylną ścianą, dywan do drzwi, chorągwie i kominek w rogu
    box(hall, flag, 0.26, 0.02, 0.85, 0, Y + 0.07, CZ + 0.05);
    box(hall, M.stoneDark, 0.5, 0.06, 0.26, 0, Y + 0.07, CZ - 0.43);
    box(hall, M.woodDark, 0.22, 0.12, 0.2, 0, Y + 0.13, CZ - 0.44);
    box(hall, M.woodDark, 0.22, 0.42, 0.05, 0, Y + 0.13, CZ - 0.53);
    box(hall, flag, 0.17, 0.03, 0.15, 0, Y + 0.25, CZ - 0.43);
    for (const sx of [-1, 1]) box(hall, flag, 0.16, 0.3, 0.02, sx * 0.3, Y + 0.15, CZ - 0.565);
    box(hall, M.stoneDark, 0.26, 0.28, 0.12, -0.45, Y + 0.07, CZ - 0.5);
    box(hall, M.ember, 0.14, 0.12, 0.03, -0.45, Y + 0.09, CZ - 0.435);
    // stół biesiadny wzdłuż lewej ściany
    box(hall, M.wood, 0.22, 0.04, 0.55, -0.32, Y + 0.2, CZ + 0.15);
    for (const sz of [-1, 1]) box(hall, M.woodDark, 0.18, 0.15, 0.04, -0.32, Y + 0.06, CZ + 0.15 + sz * 0.22);
    box(hall, M.woodDark, 0.07, 0.04, 0.5, -0.5, Y + 0.13, CZ + 0.15);
    for (let k = 0; k < 3; k++) box(hall, k % 2 ? M.bread : M.apple, 0.07, 0.04, 0.07, -0.32, Y + 0.24, CZ - 0.03 + k * 0.17);
    // pulpit pisarza po prawej
    box(hall, M.wood, 0.16, 0.15, 0.24, 0.42, Y + 0.07, CZ - 0.2);
    box(hall, M.white, 0.1, 0.01, 0.14, 0.42, Y + 0.225, CZ - 0.2);
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
    person('lord', flag, 0, CZ - 0.43, 0, M.gold).position.y = Y + 0.22;
    person('diner', M.plaster, -0.5, CZ + 0.03, Math.PI / 2);
    person('diner', M.wood, -0.5, CZ + 0.27, Math.PI / 2);
    person('diner', M.thatch, -0.14, CZ + 0.15, -Math.PI / 2);
    person('servant', M.plaster, 0.3, CZ + 0.2, 0);
    person('guard', M.iron, 0.2, CZ + 0.45, 0, M.iron);
    person('servant2', M.thatch, 0.75, 0.6, 0);
    person('scribe', M.plaster, 0.27, CZ - 0.2, Math.PI / 2);
    // PODZIEMIA pod dziedzińcem (widać je w przekroju): lochy z kratami, wartownia, piwnica ze skarbcem
    const L = 0.32;
    box(hall, D, 2.42, 0.04, 2.42, 0, L - 0.02, 0);
    box(hall, M.roadStone, 2.3, 0.02, 2.3, 0, L + 0.01, 0);
    for (const [x, z, w, d] of [[0, -1.18, 2.4, 0.08], [-1.18, 0, 0.08, 2.4], [1.18, 0, 0.08, 2.4], [-0.65, 1.18, 1.1, 0.08], [0.65, 1.18, 1.1, 0.08]] as const) box(hall, S, w, 0.5, d, x, L, z).name = 'iwall';
    box(hall, S, 0.08, 0.42, 1.0, 0, L, 0.65);
    box(hall, S, 2.3, 0.42, 0.08, 0, L, 0.12);
    // lochy (przód, lewo): trzy cele z żelaznymi kratami, słoma, łańcuchy, więzień
    for (let c = 0; c < 3; c++) {
      const cx = -1.0 + c * 0.32;
      if (c) box(hall, S, 0.05, 0.42, 0.5, cx - 0.16, L, 0.42);
      for (let k = 0; k < 5; k++) box(hall, M.iron, 0.015, 0.42, 0.015, cx - 0.12 + k * 0.06, L, 0.68);
      box(hall, M.iron, 0.3, 0.02, 0.02, cx, L + 0.4, 0.68);
      box(hall, M.hay, 0.22, 0.02, 0.18, cx, L + 0.02, 0.3);
    }
    for (const y of [0.15, 0.25]) box(hall, M.iron, 0.012, 0.012, 0.12, -0.74, L + y, 0.2);
    const prisoner = person('prisoner', M.trousers, -0.68, 0.32, Math.PI);
    prisoner.position.y = L + 0.02;
    prisoner.rotation.x = -0.25;
    box(hall, M.wood, 0.14, 0.08, 0.1, -1.0, L + 0.02, 0.32); // miska i dzban
    // wartownia (przód, prawo): stół, kości do gry, stojak z bronią, koksownik
    box(hall, M.wood, 0.4, 0.04, 0.24, 0.6, L + 0.18, 0.62);
    for (const sx of [-1, 1]) box(hall, M.woodDark, 0.04, 0.18, 0.2, 0.6 + sx * 0.16, L, 0.62);
    for (const x of [0.52, 0.58, 0.66]) box(hall, M.white, 0.025, 0.025, 0.025, x, L + 0.22, 0.6);
    const jailer = person('guard', M.iron, 0.62, 0.86, Math.PI, M.iron);
    jailer.position.y = L + 0.02;
    for (let k = 0; k < 4; k++) { const sp = box(hall, M.plank, 0.02, 0.5, 0.02, 1.0, L, 0.3 + k * 0.08); sp.rotation.x = 0.08; }
    box(hall, M.iron, 0.1, 0.12, 0.1, 0.25, L, 0.95);
    const glow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 5), M.ember);
    glow.name = 'brazier';
    glow.position.set(0.25, L + 0.18, 0.95);
    hall.add(glow);
    // piwnica i skarbiec (tył, pod donżonem): beczki wina w stojakach, worki, skrzynia ze złotem, schody na górę
    for (let k = 0; k < 4; k++) {
      const bl = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), M.wood), 0.09, 0.22);
      bl.rotation.z = Math.PI / 2;
      bl.position.set(-0.95 + k * 0.24, L + 0.1, -0.95);
      hall.add(bl);
      box(hall, M.woodDark, 0.05, 0.04, 0.2, -0.95 + k * 0.24, L, -0.95);
    }
    for (const [x, z] of [[-0.9, -0.55], [-0.75, -0.5], [-0.82, -0.38]] as const) { const sk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), M.white); sk.scale.set(0.9, 1.2, 0.8); sk.position.set(x, L + 0.09, z); hall.add(sk); }
    box(hall, M.woodDark, 0.3, 0.16, 0.18, 0.75, L, -0.8);
    box(hall, M.gold, 0.26, 0.04, 0.14, 0.75, L + 0.16, -0.8);
    for (let k = 0; k < 6; k++) { const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8), M.gold); coin.position.set(0.6 + (k % 3) * 0.05, L + 0.02, -0.55 + Math.floor(k / 3) * 0.05); hall.add(coin); }
    for (let k = 0; k < 6; k++) box(hall, D, 0.3, 0.06, 0.12, 1.0, L + k * 0.07, -0.2 - k * 0.12);
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
    // cztery baszty narożne: skarpowa podstawa, strzelnice, machikuły na kroksztynach, blanki i stożkowy hełm z chorągiewką
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = sx * 1.22, z = sz * 1.22;
      const foot = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.35, 18), D), 0.55, 0.35);
      foot.position.set(x, 0.175, z);
      g.add(foot);
      const t = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.75, 18), S), 0.46, 1.75);
      t.position.set(x, 0.35 + 0.875, z);
      g.add(t);
      // kroksztyny pod wysuniętym gankiem
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const c = box(g, D, 0.07, 0.12, 0.1, x + Math.sin(a) * 0.44, 1.95, z + Math.cos(a) * 0.44);
        c.rotation.y = a;
      }
      const rim = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.47, 0.16, 18), D), 0.5, 0.16);
      rim.position.set(x, 2.13, z);
      g.add(rim);
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785 + 0.39;
        const tooth = box(g, S, 0.17, 0.16, 0.1, x + Math.sin(a) * 0.46, 2.21, z + Math.cos(a) * 0.46);
        tooth.rotation.y = a;
      }
      pyramid(g, team, 0.44, 1.05, x, 2.25, z, 14);
      box(g, M.woodDark, 0.025, 0.35, 0.025, x, 3.28, z);
      box(g, flag, 0.2, 0.11, 0.015, x + 0.1, 3.5, z);
      // strzelnice na zewnątrz
      for (const [ox, oz] of [[sx, 0], [0, sz]] as const) {
        const sl = box(g, M.dark, ox ? 0.02 : 0.045, 0.24, ox ? 0.045 : 0.02, x + ox * 0.48, 1.05, z + oz * 0.48);
        sl.rotation.y = 0;
      }
    }
    // brama: dwie półokrągłe wieżyczki, łukowy przejazd, krata, wrota, zwodzony most na łańcuchach
    for (const s2 of [-1, 1]) {
      const gt = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.45, 14), D), 0.26, 1.45);
      gt.position.set(s2 * 0.48, 0.725, 1.35);
      g.add(gt);
      pyramid(g, team, 0.27, 0.5, s2 * 0.48, 1.45, 1.35, 12);
      box(g, M.dark, 0.035, 0.2, 0.02, s2 * 0.48, 0.9, 1.63);
    }
    const gate = cutBox(0.72, 1.38, 0.36, [{ w: 0.42, h: 0.62, d: 0.5, x: 0, y: 0.31, z: 0 }], D, 1.15);
    gate.position.set(0, 0, 1.32);
    g.add(gate);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.37, 16, 1, false, -Math.PI / 2, Math.PI), M.dark);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 0.62, 1.32);
    g.add(arch);
    box(g, M.dark, 0.42, 0.62, 0.02, 0, 0, 1.2);
    box(g, M.woodDark, 0.19, 0.58, 0.03, -0.1, 0, 1.22);
    box(g, M.woodDark, 0.19, 0.58, 0.03, 0.1, 0, 1.22);
    for (let k = 0; k < 5; k++) box(g, M.iron, 0.018, 0.5, 0.018, -0.16 + k * 0.08, 0.32, 1.47);
    for (let k = 0; k < 3; k++) box(g, M.iron, 0.36, 0.018, 0.018, 0, 0.42 + k * 0.14, 1.47);
    merlons(0, 1.48, 0.72, 1.38, true, S);
    box(g, M.woodDark, 0.16, 0.16, 0.05, 0, 1.0, 1.51);
    box(g, flag, 0.12, 0.12, 0.02, 0, 1.02, 1.54);
    const bridge = new THREE.Group();
    bridge.position.set(0, 0.05, 1.5);
    box(bridge, M.plank, 0.46, 0.05, 0.5, 0, 0, 0.25);
    for (let k = 0; k < 4; k++) box(bridge, M.woodDark, 0.48, 0.02, 0.03, 0, 0.05, 0.08 + k * 0.12);
    g.add(bridge);
    for (const s2 of [-1, 1]) { const ch = box(g, M.iron, 0.015, 0.75, 0.015, s2 * 0.2, 0.08, 1.85); ch.rotation.x = -0.75; }
    for (const s2 of [-1, 1]) box(g, flag, 0.14, 0.5, 0.02, s2 * 0.42, 0.55, 1.62);
  },
  tavern(g, _team, flag) {
    // Karczma: duża chata z bali i strzechy, w izbie szynkwas i beczki; przed wejściem ławy z kuflami, beczki i szyld
    const hall = new THREE.Group();
    const inside = cottage(hall, 7);
    hall.scale.set(1.75, 1.15, 1.35);
    hall.position.z = -0.15;
    g.add(hall);
    box(inside, M.woodDark, 0.8, 0.28, 0.14, 0, 0.05, -0.3); // szynkwas
    for (const x of [-0.5, -0.32]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 10).rotateZ(Math.PI / 2), M.wood); b.position.set(x, 0.12, -0.42); inside.add(b); }
    box(inside, M.wood, 0.35, 0.18, 0.25, 0.3, 0.05, 0.15);
    // przed karczmą: dwie ławy ze stołem, kufle, beczki
    box(g, M.wood, 0.7, 0.05, 0.28, -0.6, 0.26, 0.95);
    for (const z of [0.75, 1.15]) box(g, M.woodDark, 0.7, 0.04, 0.1, -0.6, 0.16, z);
    for (const x of [-0.8, -0.55, -0.4]) { const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.07, 8), M.woodDark); mug.position.set(x, 0.33, 0.95); g.add(mug); }
    for (const [x, z] of [[0.75, 0.85], [0.95, 0.95], [0.85, 1.12]] as const) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.28, 10), M.wood);
      barrel.position.set(x, 0.14, z); g.add(barrel);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 4, 12).rotateX(Math.PI / 2), M.iron);
      hoop.position.set(x, 0.2, z); g.add(hoop);
    }
    // szyld na wysięgniku: kufel na desce
    box(g, M.woodDark, 0.05, 1.25, 0.05, 0.3, 0, 0.62);
    box(g, M.woodDark, 0.4, 0.04, 0.04, 0.45, 1.15, 0.62);
    box(g, M.wood, 0.3, 0.22, 0.03, 0.55, 0.88, 0.62);
    const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), M.wheat);
    sign.position.set(0.55, 0.9, 0.645); sign.rotation.x = Math.PI / 2; g.add(sign);
    pennant(g, flag, -1.3, 0.2, 0.7);
  },
  house(g, _team, flag) {
    const inside = cottage(g, houseSeed++);
    // izba: stół z miską, ławy i łóżko
    box(inside, M.wood, 0.45, 0.22, 0.3, 0.15, 0.05, 0.1);
    box(inside, M.bread, 0.12, 0.05, 0.12, 0.15, 0.27, 0.1);
    box(inside, M.woodDark, 0.4, 0.12, 0.1, 0.15, 0.05, 0.36);
    box(inside, M.woodDark, 0.6, 0.14, 0.3, -0.38, 0.05, -0.38);
    box(inside, M.white, 0.5, 0.06, 0.26, -0.38, 0.19, -0.38);
    // chorągiewka stoi na szczycie dachu, więc znika razem z nim przy podglądzie wnętrza
    pennant(g.getObjectByName('roof') as THREE.Group, flag, 0.86, 1.42, 0);
  },
  stockpile(g) {
    box(g, M.soil, 1.9, 0.06, 1.9);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, M.woodDark, 0.1, 0.5, 0.1, sx * 0.9, 0.06, sz * 0.9);
    g.add(fillSlots('fill', 0, 0));
  },
  granary(g, _team, flag) {
    // Spichlerz na kamiennych grzybkach (chronią ziarno przed gryzoniami), ściany szachulcowe, dach jak na stodole
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.2, 7), M.rock);
      leg.position.set(sx * 0.6, 0.1, sz * 0.52);
      g.add(leg);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 8), M.rockDark);
      cap.position.set(sx * 0.6, 0.225, sz * 0.52);
      g.add(cap);
    }
    box(g, M.woodDark, 1.55, 0.08, 1.35, 0, 0.25, 0);
    const shell = new THREE.Group();
    shell.name = 'shell';
    box(shell, M.plaster, 1.45, 0.85, 1.25, 0, 0.33, 0);
    // belki szachulca: słupy, rygle i zastrzały
    for (const sz of [-1, 1]) {
      for (const x of [-0.71, -0.24, 0.24, 0.71]) box(shell, M.woodDark, 0.06, 0.85, 0.03, x, 0.33, sz * 0.635);
      box(shell, M.woodDark, 1.45, 0.05, 0.03, 0, 0.72, sz * 0.635);
      for (const x of [-0.475, 0.475]) { const brace = box(shell, M.woodDark, 0.045, 0.52, 0.03, x, 0.36, sz * 0.636); brace.rotation.z = x > 0 ? 0.75 : -0.75; }
    }
    for (const sx of [-1, 1]) {
      for (const z of [-0.61, 0, 0.61]) box(shell, M.woodDark, 0.03, 0.85, 0.06, sx * 0.735, 0.33, z);
      box(shell, M.woodDark, 0.03, 0.05, 1.25, sx * 0.735, 0.72, 0);
    }
    box(shell, M.woodDark, 0.34, 0.5, 0.04, 0, 0.33, 0.64);
    box(shell, M.plank, 0.28, 0.44, 0.02, 0, 0.36, 0.665);
    g.add(shell);
    const top = new THREE.Group();
    top.name = 'roof';
    layeredRoof(top, M.thatch, 1.75, 0.8, 1.6, 1.18);
    // luk na strychu z żurawikiem do wciągania worków
    box(top, M.woodDark, 0.26, 0.26, 0.04, 0, 1.3, 0.72);
    box(top, M.woodDark, 0.05, 0.05, 0.4, 0, 1.62, 0.9);
    box(top, M.plank, 0.012, 0.3, 0.012, 0, 1.33, 1.08);
    g.add(top);
    // drabinka do drzwi i worki pod ścianą
    for (const x of [-0.12, 0.12]) { const rail = box(g, M.wood, 0.03, 0.42, 0.03, x, 0, 0.78); rail.rotation.x = 0.5; }
    for (let k = 0; k < 3; k++) box(g, M.wood, 0.26, 0.025, 0.03, 0, 0.08 + k * 0.1, 0.86 - k * 0.055);
    for (const [x, z, sc] of [[0.55, 0.82, 1], [0.78, 0.8, 0.85], [0.66, 0.84, 0.8]] as const) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), M.white);
      sack.scale.set(sc, 1.25 * sc, 0.8 * sc);
      sack.position.set(x, x === 0.66 ? 0.34 : 0.14, z);
      g.add(sack);
    }
    // wnętrze: podłoga, niskie ściany i zapasy żywności, których przybywa
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    box(inside, M.plank, 1.45, 0.05, 1.25, 0, 0.33, 0);
    for (const [x, z, w, d] of [[0, -0.6, 1.45, 0.06], [-0.7, 0, 0.06, 1.25], [0.7, 0, 0.06, 1.25]] as const) box(inside, M.plaster, w, 0.4, d, x, 0.33, z);
    const food = fillSlots('foodfill', 0, 0, 0.4);
    food.position.y = 0.33;
    inside.add(food);
    g.add(inside);
    pennant(g, flag, 0.72, 1.25, -0.6);
  },
  woodcutter(g) {
    // Tartak: chata po prawej (naprzeciw wejścia), po lewej wiata z kozłem do cięcia, z tyłu stos desek.
    // Plac z pniem leży z boku, więc droga do drzwi jest wolna.
    const inside = cottageAt(g, 21, 1.0, 0.95, 0.75, 0.42, -0.3);
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
  quarry(g, _team, flag) {
    // Kamieniołom: skała wycięta w trzy równe stopnie (świeży, jasny ciosany kamień, ślady klinów),
    // nad nią dziki, ciemny garb skalny. Z przodu trójnóg z liną podnoszący blok, wiata kamieniarza i stos gotowych ciosów.
    const r = rng(7311);
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    const stick = (a: THREE.Vector3, b2: THREE.Vector3, size: number, m: THREE.Material = M.woodDark): void => { g.add(new THREE.Mesh(beam(a, b2, size, r), m)); };
    // dziki garb skały z tyłu, zachodzi na boki
    for (const [x, y, z, rad, sy, dark] of [[-0.55, 0.55, -0.78, 0.5, 1.1, 1], [0.15, 0.7, -0.85, 0.55, 1.1, 0], [0.7, 0.45, -0.7, 0.42, 1.0, 1], [-0.88, 0.25, -0.35, 0.3, 0.9, 0], [0.88, 0.2, -0.3, 0.28, 0.8, 1]] as const) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), dark ? M.rockDark : M.rock);
      rock.scale.set(1.15, sy, 0.8);
      rock.rotation.set(x * 2.1, z * 3.3, x * 1.7);
      rock.position.set(x, y, z);
      g.add(rock);
    }
    // stopnie wycięte w skale: od najwyższego z tyłu do najniższego z przodu
    const steps: [number, number, number, number][] = [[1.3, 0.95, -0.62, 0.3], [1.2, 0.62, -0.4, 0.26], [1.0, 0.3, -0.2, 0.24]];
    steps.forEach(([w, h, z, d], i) => {
      box(g, i === 0 ? M.cutDark : M.cut, w, h, d, -0.05 + i * 0.04, 0, z);
      // ślady wierteł i klinów na czole stopnia
      for (let k = 0; k < 5; k++) box(g, M.dark, 0.012, h * 0.55, 0.01, -0.05 + i * 0.04 - w / 2 + 0.15 + k * (w - 0.3) / 4, h * 0.2, z + d / 2 + 0.002);
      // jedna pozioma szczelina, wzdłuż której blok zaraz odpadnie
      box(g, M.dark, w * 0.6, 0.012, 0.01, -0.05 + i * 0.04 + 0.1, h * 0.62, z + d / 2 + 0.002);
    });
    // blok właśnie odłupany ze stopnia, z klinami wbitymi w szczelinę
    box(g, M.cut, 0.32, 0.2, 0.2, 0.38, 0.3, -0.18).rotation.y = 0.12;
    for (const x of [0.28, 0.38, 0.48]) box(g, M.iron, 0.025, 0.06, 0.04, x, 0.5, -0.1);
    // drabina oparta o środkowy stopień
    stick(V(-0.62, 0, -0.06), V(-0.66, 0.66, -0.36), 0.035, M.wood);
    stick(V(-0.44, 0, -0.06), V(-0.48, 0.66, -0.36), 0.035, M.wood);
    for (let k = 1; k < 5; k++) { const t = k / 5; box(g, M.wood, 0.2, 0.025, 0.025, -0.55 - t * 0.04, t * 0.62, -0.06 - t * 0.3); }
    // trójnóg z liną i bloczkiem: blok kamienia wisi w uprzęży nad wozem
    const apex = V(0.3, 1.35, 0.25);
    stick(V(0.0, 0, 0.0), apex, 0.06);
    stick(V(0.62, 0, 0.05), apex, 0.06);
    stick(V(0.32, 0, 0.65), apex, 0.06);
    box(g, M.iron, 0.08, 0.08, 0.08, apex.x, apex.y - 0.06, apex.z);
    box(g, M.rope, 0.014, 0.62, 0.014, apex.x, apex.y - 0.68, apex.z);
    box(g, M.cut, 0.3, 0.18, 0.22, apex.x, 0.5, apex.z);
    for (const dz of [-0.06, 0.06]) box(g, M.rope, 0.31, 0.015, 0.02, apex.x, 0.62, apex.z + dz);
    // kołowrót przy nodze trójnogu, lina biegnie do niego
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8), M.wood);
    drum.rotation.z = Math.PI / 2; drum.position.set(0.66, 0.28, 0.32); g.add(drum);
    for (const dx of [-0.14, 0.14]) box(g, M.woodDark, 0.04, 0.3, 0.04, 0.66 + dx, 0, 0.32);
    box(g, M.woodDark, 0.025, 0.16, 0.025, 0.82, 0.28, 0.4).rotation.z = 0.4;
    stick(V(0.66, 0.34, 0.32), V(apex.x, apex.y - 0.08, apex.z), 0.012, M.rope);
    // wiata kamieniarza po lewej: cztery słupy, pochyły dach z desek, pod nią kozioł z blokiem w obróbce
    const sx = -0.55, sz = 0.55;
    for (const [dx, dz, hgt] of [[-0.3, -0.22, 0.78], [0.3, -0.22, 0.78], [-0.3, 0.22, 0.6], [0.3, 0.22, 0.6]] as const) box(g, M.woodDark, 0.05, hgt, 0.05, sx + dx, 0, sz + dz);
    const roof = box(g, M.wood, 0.78, 0.035, 0.6, sx, 0.68, sz);
    roof.rotation.x = 0.32;
    for (const dz of [-0.2, 0, 0.2]) { const lath = box(g, M.woodDark, 0.8, 0.02, 0.03, sx, 0.715 - dz * 0.33, sz + dz); lath.rotation.x = 0.32; }
    box(g, M.woodDark, 0.44, 0.04, 0.24, sx, 0.24, sz);
    for (const [dx, dz] of [[-0.18, -0.08], [0.18, -0.08], [-0.18, 0.08], [0.18, 0.08]] as const) box(g, M.woodDark, 0.035, 0.24, 0.035, sx + dx, 0, sz + dz);
    box(g, M.cut, 0.26, 0.15, 0.18, sx - 0.02, 0.28, sz);
    box(g, M.wood, 0.03, 0.03, 0.15, sx + 0.18, 0.29, sz - 0.04).rotation.y = 0.6; // trzonek młotka
    box(g, M.iron, 0.07, 0.05, 0.05, sx + 0.21, 0.29, sz - 0.1);
    box(g, M.iron, 0.012, 0.012, 0.13, sx + 0.06, 0.44, sz + 0.02).rotation.x = 0.8; // dłuto
    pennant(g, flag, sx + 0.3, 0.78, sz - 0.22);
    // stos gotowych ciosów na płozach po prawej, z przodu
    for (const dz of [-0.11, 0.11]) box(g, M.woodDark, 0.56, 0.05, 0.06, 0.55, 0, 0.78 + dz);
    for (const [x, y, z] of [[0.42, 0.05, 0.78], [0.68, 0.05, 0.78], [0.55, 0.2, 0.78]] as const) box(g, (x + y) % 0.2 > 0.1 ? M.cutDark : M.cut, 0.24, 0.15, 0.24, x, y, z);
    // okruchy u stóp ściany i jasny pył na placu
    for (let k = 0; k < 9; k++) {
      const chip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + r() * 0.04, 0), k % 3 ? M.cut : M.rock);
      chip.position.set(-0.7 + r() * 1.4, 0.02, -0.02 + r() * 0.25);
      chip.rotation.set(r() * 3, r() * 3, 0);
      g.add(chip);
    }
    box(g, M.dust, 1.5, 0.012, 0.95, 0, 0.004, 0.35);
  },
  mine(g) {
    // Kopalnia żelaza: skalny garb ze sztolnią w drewnianej obudowie, tory z wózkiem rudy, kołowrót i hałda
    for (const [x, z, r, sy] of [[-0.25, -0.45, 0.62, 0.95], [0.4, -0.5, 0.5, 0.85], [-0.7, -0.15, 0.4, 0.7], [0.75, -0.1, 0.36, 0.6], [0.05, -0.75, 0.45, 0.75]] as const) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), x > 0.3 ? M.rockDark : M.rock);
      rock.scale.set(1, sy, 0.9);
      rock.rotation.set(x * 2, z * 3, x + z);
      rock.position.set(x, r * sy * 0.45, z);
      g.add(rock);
    }
    for (const [x, z] of [[-0.55, 0.05], [0.6, 0.02], [-0.1, -0.3]] as const) {
      const vein = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), M.ore);
      vein.position.set(x, 0.42, z);
      g.add(vein);
    }
    // sztolnia: ciemny otwór, stemple i strop z belek
    box(g, M.dark, 0.56, 0.62, 0.3, 0, 0, 0.02);
    for (const sx of [-1, 1]) box(g, M.wood, 0.1, 0.72, 0.12, sx * 0.33, 0, 0.18).rotation.z = sx * -0.08;
    box(g, M.wood, 0.9, 0.11, 0.14, 0, 0.7, 0.18);
    box(g, M.woodDark, 0.8, 0.06, 0.4, 0, 0.8, 0.02);
    for (const x of [-0.2, 0, 0.2]) box(g, M.woodDark, 0.05, 0.06, 0.5, x, 0.86, 0);
    // tory i wózek z rudą
    for (const sx of [-1, 1]) box(g, M.iron, 0.03, 0.03, 0.95, sx * 0.14, 0.02, 0.55);
    for (let k = 0; k < 5; k++) box(g, M.woodDark, 0.42, 0.025, 0.07, 0, 0, 0.15 + k * 0.2);
    box(g, M.wood, 0.34, 0.2, 0.42, 0, 0.1, 0.62);
    box(g, M.iron, 0.36, 0.03, 0.44, 0, 0.3, 0.62);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), M.iron);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.17, 0.07, 0.62 + sz * 0.13);
      g.add(wheel);
    }
    for (let k = 0; k < 4; k++) { const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), M.ore); lump.position.set((k % 2 - 0.5) * 0.14, 0.34 + (k > 1 ? 0.05 : 0), 0.56 + (k % 3) * 0.06); g.add(lump); }
    // kołowrót z liną nad szybem wentylacyjnym
    for (const sx of [-1, 1]) { box(g, M.woodDark, 0.06, 0.6, 0.06, 0.62 + sx * 0.2, 0, 0.62); }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), M.wood);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0.62, 0.55, 0.62);
    g.add(drum);
    box(g, M.woodDark, 0.03, 0.03, 0.2, 0.86, 0.55, 0.7);
    box(g, M.stoneDark, 0.3, 0.12, 0.3, 0.62, 0, 0.62);
    // hałda urobku i latarnia przy wejściu
    for (const [x, z, r] of [[-0.72, 0.6, 0.16], [-0.55, 0.75, 0.12], [-0.85, 0.78, 0.1], [-0.68, 0.72, 0.11]] as const) {
      const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), r > 0.12 ? M.ore : M.rockDark);
      lump.position.set(x, r * 0.6, z);
      g.add(lump);
    }
    box(g, M.iron, 0.06, 0.1, 0.06, -0.33, 0.52, 0.26);
    box(g, M.ember, 0.04, 0.06, 0.04, -0.33, 0.54, 0.26);
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
    layeredRoof(g, M.thatch, 1.12, 0.52, 0.98, 0.96, -0.3, -0.25);
    box(g, M.woodDark, 0.22, 0.42, 0.04, -0.3, 0.36, 0.13);
    box(g, M.window, 0.2, 0.2, 0.03, 0.18, 0.55, -0.25).rotation.y = Math.PI / 2;
    // suszarnia: dwa słupki, żerdź i wiszące ryby
    box(g, M.woodDark, 0.05, 0.6, 0.05, 0.45, 0, 0.75);
    box(g, M.woodDark, 0.05, 0.6, 0.05, 0.9, 0, 0.75);
    box(g, M.woodDark, 0.55, 0.04, 0.04, 0.675, 0.58, 0.75);
    // ryby suszone na żerdzi: srebrzyste tułowie, ogon i sznurek, każda trochę inna
    for (let k = 0; k < 4; k++) {
      const fish = new THREE.Group();
      fish.position.set(0.5 + k * 0.12, 0.5, 0.75);
      fish.rotation.z = (k % 2 ? 1 : -1) * 0.08;
      box(fish, M.woodDark, 0.008, 0.06, 0.008, 0, -0.06, 0);
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), M.fish);
      body.scale.set(0.55, 1.9, 0.8);
      body.position.y = -0.13;
      fish.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), M.fish);
      tail.scale.set(1, 1, 0.35);
      tail.position.y = -0.24;
      fish.add(tail);
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.008, 0), M.dark);
      eye.position.set(0, -0.075, 0.03);
      fish.add(eye);
      g.add(fish);
    }
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
  engineers(g, _team, flag) {
    // Cech inżynierów: warsztat z daszkiem nad stołem kreślarskim, dźwig z blokiem kamienia, taczka i narzędzia
    const eng = cottageAt(g, 24, 1.0, 0.95, 0.78, 0.42, -0.35);
    // warsztat inżyniera: stół z planami, skrzynia narzędzi, belki pod ścianą
    box(eng, M.wood, 0.4, 0.2, 0.25, 0.3, 0.05, -0.4);
    box(eng, M.white, 0.3, 0.01, 0.2, 0.3, 0.26, -0.4);
    box(eng, M.woodDark, 0.25, 0.15, 0.15, 0.6, 0.05, -0.15);
    for (let k = 0; k < 3; k++) box(eng, M.plank, 0.05, 0.05, 0.6, 0.12 + k * 0.06, 0.05, -0.35);
    box(g, M.window, 0.2, 0.2, 0.03, 0.72, 0.36, 0.11);
    for (const [x, z] of [[-0.9, -0.8], [-0.15, -0.8], [-0.9, -0.1], [-0.15, -0.1]] as const) box(g, M.woodDark, 0.07, 0.7, 0.07, x, 0, z);
    box(g, M.plank, 0.95, 0.05, 0.9, -0.52, 0.7, -0.45).rotation.x = 0.2;
    box(g, M.wood, 0.55, 0.05, 0.35, -0.52, 0.32, -0.5);
    for (const sx of [-1, 1]) box(g, M.woodDark, 0.05, 0.32, 0.3, -0.52 + sx * 0.23, 0, -0.5);
    box(g, M.white, 0.3, 0.01, 0.22, -0.52, 0.375, -0.5);
    // dźwig: dwie skośne nogi, wysięgnik, lina i podwieszony blok
    for (const sz of [-1, 1]) { const leg = box(g, M.woodDark, 0.06, 1.25, 0.06, -0.55, 0, 0.55 + sz * 0.22); leg.rotation.x = sz * -0.2; }
    const boom = box(g, M.woodDark, 0.9, 0.06, 0.06, -0.2, 1.15, 0.55);
    boom.rotation.z = 0.25;
    // krążek na końcu wysięgnika, lina i ciosany blok w linowym oplocie
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), M.wood);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(0.22, 1.27, 0.55);
    g.add(pulley);
    box(g, M.rope, 0.014, 0.58, 0.014, 0.22, 0.66, 0.55);
    box(g, M.cut, 0.28, 0.2, 0.24, 0.22, 0.42, 0.55);
    for (const r of [0.6, -0.6]) { const sling = box(g, M.rope, 0.012, 0.3, 0.012, 0.22, 0.58, 0.55); sling.rotation.z = r; }
    box(g, M.rope, 0.29, 0.015, 0.25, 0.22, 0.61, 0.55);
    // taczka z kamieniami: skrzynia, koło z przodu, rączki i nóżki z tyłu
    const barrow = new THREE.Group();
    barrow.position.set(0.62, 0, 0.66);
    barrow.rotation.y = -0.4;
    box(barrow, M.wood, 0.3, 0.1, 0.22, 0, 0.12, 0);
    box(barrow, M.woodDark, 0.31, 0.02, 0.23, 0, 0.12, 0);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 10), M.woodDark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.2, 0.075, 0);
    barrow.add(wheel);
    for (const sz of [-1, 1]) {
      box(barrow, M.woodDark, 0.5, 0.025, 0.025, -0.05, 0.14, sz * 0.12).rotation.z = -0.15;
      box(barrow, M.woodDark, 0.025, 0.13, 0.025, -0.12, 0, sz * 0.1);
    }
    for (const [x, z, r] of [[-0.06, -0.04, 0.06], [0.06, 0.03, 0.055], [0, 0.06, 0.05], [-0.05, 0.06, 0.045]] as const) {
      const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.rock);
      lump.position.set(x, 0.23, z);
      barrow.add(lump);
    }
    g.add(barrow);
    pennant(g, flag, 0.8, 1.25, -0.7);
  },
  fletcher(g, _team, flag) {
    // Warsztat łuczarza: otwarta chata, na ścianie wiszą łuki, na stole drewno na łęczyska, kosz strzał
    const inside = cottageAt(g, 22, 1.4, 1.1, 0.8, 0, -0.15);
    box(inside, M.wood, 0.7, 0.05, 0.22, -0.1, 0.32, -0.25);
    for (const sx of [-1, 1]) box(inside, M.woodDark, 0.05, 0.32, 0.18, -0.1 + sx * 0.3, 0.0, -0.25);
    for (let k = 0; k < 3; k++) {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.014, 5, 14, Math.PI * 0.85), M.woodDark);
      bow.rotation.z = Math.PI * 0.07; bow.position.set(-0.45 + k * 0.32, 0.55, -0.62); inside.add(bow);
    }
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.3, 8), M.wood);
    quiver.position.set(0.55, 0.15, 0.25); g.add(quiver);
    for (let k = 0; k < 5; k++) box(g, M.plank, 0.012, 0.22, 0.012, 0.52 + (k % 3) * 0.03, 0.28, 0.22 + (k >> 1) * 0.03);
    box(g, M.woodDark, 0.06, 1.3, 0.06, 0.75, 0, 0.55);
    box(g, flag, 0.04, 0.4, 0.3, 0.75, 0.85, 0.72);
  },
  poleturner(g, _team, flag) {
    // Warsztat włóczniarza: otwarta chata z kozłem do strugania, stojak z gotowymi włóczniami i kosz z grotami
    const inside = cottageAt(g, 22, 1.4, 1.1, 0.8, 0, -0.15);
    box(inside, M.wood, 0.7, 0.05, 0.22, -0.1, 0.32, -0.25);
    for (const sx of [-1, 1]) box(inside, M.woodDark, 0.05, 0.32, 0.18, -0.1 + sx * 0.3, 0.0, -0.25);
    box(inside, M.plank, 0.9, 0.03, 0.03, -0.05, 0.38, -0.25).rotation.y = 0.15;
    box(inside, M.sawdust, 0.6, 0.012, 0.4, -0.1, 0.03, 0.05);
    // stojak pod ścianą od frontu
    box(g, M.woodDark, 0.06, 0.6, 0.06, 0.45, 0, 0.62);
    box(g, M.woodDark, 0.06, 0.6, 0.06, 0.85, 0, 0.62);
    box(g, M.woodDark, 0.5, 0.05, 0.06, 0.65, 0.55, 0.62);
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Group();
      sp.position.set(0.5 + k * 0.08, 0, 0.6);
      sp.rotation.z = -0.12;
      box(sp, M.plank, 0.025, 0.95, 0.025, 0, 0, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), M.iron);
      tip.position.y = 1.0;
      sp.add(tip);
      g.add(sp);
    }
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.14, 8), M.basket);
    basket.position.set(-0.7, 0.07, 0.62);
    g.add(basket);
    pennant(g, flag, -0.62, 0.95, -0.6);
  },
  barracks(g, _team, flag) {
    // Koszary: długi dom z kamienną podmurówką i strzechą, plac ćwiczeń z kukłami, stojak z bronią, ławka i sztandar
    box(g, M.soil, 2.9, 0.03, 2.9);
    box(g, M.stoneDark, 2.6, 0.3, 1.2, 0, 0, -0.75);
    box(g, M.wood, 2.5, 0.65, 1.1, 0, 0.3, -0.75);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) box(g, M.woodDark, 0.08, 0.66, 0.08, x, 0.3, -0.19);
    box(g, M.woodDark, 2.55, 0.07, 0.08, 0, 0.92, -0.19);
    box(g, M.woodDark, 0.34, 0.5, 0.04, 0, 0.3, -0.18);
    for (const x of [-0.8, 0.8]) box(g, M.window, 0.26, 0.22, 0.04, x, 0.55, -0.18);
    layeredRoof(g, M.thatch, 2.8, 0.75, 1.5, 0.95, 0, -0.75);
    // plac: dwie kukły ze słomy na palach i stojak z włóczniami
    for (const x of [-0.9, -0.3]) {
      box(g, M.woodDark, 0.05, 0.7, 0.05, x, 0, 0.6);
      box(g, M.woodDark, 0.4, 0.04, 0.04, x, 0.5, 0.6);
      const dummy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 8), M.hay);
      dummy.position.set(x, 0.5, 0.6);
      g.add(dummy);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), M.hay);
      head.position.set(x, 0.78, 0.6);
      g.add(head);
    }
    box(g, M.woodDark, 0.06, 0.55, 0.06, 0.55, 0, 0.75);
    box(g, M.woodDark, 0.06, 0.55, 0.06, 1.15, 0, 0.75);
    box(g, M.woodDark, 0.66, 0.05, 0.06, 0.85, 0.5, 0.75);
    for (let k = 0; k < 6; k++) {
      const sp = new THREE.Group();
      sp.position.set(0.6 + k * 0.1, 0, 0.73);
      sp.rotation.z = -0.1;
      box(sp, M.plank, 0.025, 1.0, 0.025, 0, 0, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), M.iron);
      tip.position.y = 1.05;
      sp.add(tip);
      g.add(sp);
    }
    box(g, M.wood, 0.9, 0.05, 0.22, 0.6, 0.22, 0.05);
    for (const x of [0.25, 0.95]) box(g, M.woodDark, 0.05, 0.22, 0.2, x, 0, 0.05);
    // sztandar w barwach drużyny przy wejściu
    box(g, M.woodDark, 0.06, 1.5, 0.06, -1.3, 0, 0.2);
    box(g, flag, 0.04, 0.6, 0.36, -1.3, 0.85, 0.4);
  },
  palisade(g) {
    // na mapie częstokół rysuje scena jako jeden zestaw bali łączący sąsiednie pola (palisadeLogs);
    // tu tylko podgląd do miniatury i ducha przy stawianiu
    const preview = new THREE.Group();
    preview.name = 'preview';
    for (const log of palisadeLogs([true, true, false, false], 3)) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(log.r, log.r * 1.1, log.h, 7), M.bark);
      shaft.position.set(log.x, log.h / 2, log.z); preview.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(log.r, log.r * 2.2, 7), M.bark);
      tip.position.set(log.x, log.h + log.r * 1.1, log.z); preview.add(tip);
    }
    g.add(preview);
  },
  gate(g, _team, flag) {
    // Brama w częstokole: dwa grube słupy, belka z daszkiem, dwuskrzydłowe wrota z okuciami, uchylone
    for (const x of [-0.46, 0.46]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.55, 8), M.bark);
      post.position.set(x, 0.775, 0); g.add(post);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), M.bark);
      tip.position.set(x, 1.66, 0); g.add(tip);
    }
    box(g, M.woodDark, 1.1, 0.12, 0.16, 0, 1.28, 0);
    box(g, M.wood, 1.2, 0.04, 0.42, 0, 1.4, 0).rotation.x = 0.12;
    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.position.set(side * 0.4, 0, 0);
      leaf.name = side < 0 ? 'leafL' : 'leafR';
      leaf.rotation.y = side * 1.3; // otwarte do środka; scena domyka je przy zamknięciu
      box(leaf, M.wood, 0.4, 1.1, 0.06, -side * 0.2, 0.05, 0);
      for (const y of [0.3, 0.85]) box(leaf, M.iron, 0.38, 0.05, 0.075, -side * 0.2, y, 0);
      g.add(leaf);
    }
    box(g, flag, 0.3, 0.22, 0.02, 0, 1.0, 0.1);
  },
  watchtower(g, _team, flag) {
    // Drewniana wieża strażnicza: cztery nogi z bali, zastrzały, pomost z balustradą, dach ze strzechy, drabina
    const r = 0.68, H = 1.9;
    for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, H + 0.9, 7), M.bark);
      leg.position.set(x, (H + 0.9) / 2, z); g.add(leg);
    }
    // zastrzały na krzyż
    for (const [x, z, ry] of [[0, -r, 0], [0, r, 0], [-r, 0, Math.PI / 2], [r, 0, Math.PI / 2]] as const) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 5), M.woodDark);
      brace.position.set(x, H * 0.48, z); brace.rotation.set(0, ry, 0.72); g.add(brace);
    }
    box(g, M.wood, 1.65, 0.1, 1.65, 0, H, 0);
    // balustrada z bali
    for (const [x, z, w, d] of [[0, -r, 1.5, 0.07], [0, r, 1.5, 0.07], [-r, 0, 0.07, 1.5], [r, 0, 0.07, 1.5]] as const) {
      box(g, M.woodDark, w, 0.07, d, x, H + 0.42, z);
      box(g, M.woodDark, w, 0.06, d, x, H + 0.2, z);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), M.thatch);
    roof.rotation.y = Math.PI / 4; roof.position.set(0, H + 1.22, 0); roof.name = 'roof'; g.add(roof);
    // drabina
    const ladder = new THREE.Group();
    ladder.position.set(0.25, 0, r + 0.35); ladder.rotation.x = -0.18;
    for (const x of [-0.13, 0.13]) box(ladder, M.wood, 0.04, H + 0.1, 0.04, x, 0, 0);
    for (let y = 0.2; y < H; y += 0.25) box(ladder, M.wood, 0.28, 0.03, 0.04, 0, y, 0);
    g.add(ladder);
    box(g, M.woodDark, 0.04, 0.7, 0.04, -r, H + 0.9, -r);
    box(g, flag, 0.02, 0.22, 0.34, -r, H + 1.35, -r + 0.18);
  },
  cemetery(g, _team, flag) {
    // Cmentarz: płot z żerdzi, rzędy mogił z drewnianymi krzyżami, kamienny nagrobek, kaplica z dzwonkiem, łopata grabarza
    box(g, M.soil, 2.9, 0.025, 2.9);
    for (const [x, z, w, d] of [[0, -1.42, 2.9, 0.05], [-1.42, 0, 0.05, 2.9], [1.42, 0, 0.05, 2.9], [-0.95, 1.42, 1.0, 0.05], [0.95, 1.42, 1.0, 0.05]] as const) {
      box(g, M.woodDark, w, 0.05, d, x, 0.32, z);
      box(g, M.woodDark, w, 0.05, d, x, 0.16, z);
    }
    for (let k = -1.4; k <= 1.41; k += 0.35) for (const [x, z] of [[k, -1.42], [-1.42, k], [1.42, k]] as const) box(g, M.woodDark, 0.06, 0.4, 0.06, x, 0, z);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++) {
        const x = -1.05 + col * 0.5, z = -0.15 + row * 0.5;
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.soil);
        mound.scale.set(1, 0.5, 1.7);
        mound.position.set(x, 0.02, z);
        g.add(mound);
        const tilt = ((row * 4 + col) % 3 - 1) * 0.08;
        const cross = new THREE.Group();
        cross.position.set(x, 0, z - 0.24);
        cross.rotation.z = tilt;
        box(cross, M.wood, 0.035, 0.34, 0.035, 0, 0, 0);
        box(cross, M.wood, 0.18, 0.035, 0.035, 0, 0.22, 0);
        g.add(cross);
      }
    box(g, M.castleDark, 0.24, 0.32, 0.08, 1.0, 0, 0.85);
    // kaplica w rogu
    const before = g.children.length;
    hut(g, M.castle, M.thatchDark, 0.8, 0.7, 0.6, 0.85, -0.85);
    // krzyż stoi na kalenicy kaplicy: wysokość liczona z bryły, którą właśnie postawiliśmy
    const chapel = new THREE.Box3();
    for (const c of g.children.slice(before)) chapel.expandByObject(c);
    const peak = chapel.isEmpty() ? 1.2 : chapel.max.y - 0.03;
    box(g, M.woodDark, 0.05, 0.34, 0.05, 0.85, peak, -0.85);
    box(g, M.woodDark, 0.2, 0.045, 0.045, 0.85, peak + 0.21, -0.85);
    // łopata wbita w ziemię przy świeżej mogile
    const sh = new THREE.Group();
    sh.position.set(0.55, 0, 1.05);
    sh.rotation.z = 0.25;
    box(sh, M.woodDark, 0.03, 0.55, 0.03, 0, 0.12, 0);
    box(sh, M.iron, 0.12, 0.16, 0.02, 0, 0.0, 0);
    g.add(sh);
    pennant(g, flag, -1.3, 0.4, 1.3);
  },
  roadSand(g) { box(g, M.roadSand, 0.96, 0.04, 0.96); },
  roadStone(g) { box(g, M.roadStone, 0.96, 0.05, 0.96); },
  camp(g) {
    // Wiata dla ludzi bez pracy: ciesielska altana z dwuspadową strzechą, plecioną ścianą od wiatru,
    // ławami, beczką i zapasem drewna; ognisko z kociołkiem przed nią
    box(g, M.soil, 1.9, 0.03, 1.9);
    const px = 0.82, back = -0.9, front = -0.05, top = 0.95;
    for (const sx of [-1, 1]) for (const z of [back, front]) {
      box(g, M.woodDark, 0.09, top, 0.09, sx * px, 0, z);
      // zastrzały pod płatwią
      const brace = box(g, M.woodDark, 0.05, 0.36, 0.05, sx * (px - 0.13), top - 0.33, z);
      brace.rotation.z = sx * 0.8;
    }
    // dach i płatwie w osobnej grupie: po kliknięciu znikają i widać, kto siedzi pod wiatą
    const roof = new THREE.Group();
    roof.name = 'roof';
    for (const z of [back, front]) box(roof, M.woodDark, 1.8, 0.07, 0.08, 0, top, z);
    for (const sx of [-1, 1]) box(roof, M.woodDark, 0.08, 0.07, 0.95, sx * px, top, (back + front) / 2);
    layeredRoof(roof, M.thatch, 2.0, 0.55, 1.2, top + 0.05, 0, (back + front) / 2);
    g.add(roof);
    // pod dachem: posłania ze słomy i koce, widoczne po zdjęciu dachu
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    for (const [x, c] of [[-0.35, M.hay], [0.15, M.hay], [0.55, M.hay]] as const) {
      box(inside, c, 0.34, 0.04, 0.5, x, 0.03, -0.5);
      box(inside, x > 0 ? M.white : M.wattle, 0.3, 0.025, 0.28, x, 0.07, -0.42);
    }
    g.add(inside);
    // pleciona ścianka z tyłu i z jednego boku
    box(g, M.wattle, 1.6, 0.55, 0.04, 0, 0.05, back);
    box(g, M.wattle, 0.04, 0.55, 0.8, -px, 0.05, (back + front) / 2);
    // ławy pod dachem
    box(g, M.plank, 1.3, 0.05, 0.22, 0.05, 0.22, back + 0.2);
    for (const x of [-0.5, 0.6]) box(g, M.woodDark, 0.06, 0.2, 0.18, x, 0.03, back + 0.2);
    box(g, M.plank, 0.2, 0.05, 0.6, -px + 0.18, 0.22, -0.45);
    box(g, M.woodDark, 0.16, 0.2, 0.06, -px + 0.18, 0.03, -0.45);
    // beczka z wodą, kubki i stos drewna na opał
    const barrel = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.34, 10), M.wood), 0.14, 0.34);
    barrel.position.set(0.68, 0.2, -0.3);
    g.add(barrel);
    for (const y of [0.1, 0.3]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.01, 4, 12), M.iron); hoop.rotation.x = Math.PI / 2; hoop.position.set(0.68, y, -0.3); g.add(hoop); }
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), row % 2 ? M.bark : M.wood);
      log.rotation.x = Math.PI / 2;
      log.position.set(0.5 + k * 0.1 + row * 0.05, 0.08 + row * 0.09, 0.75);
      g.add(log);
    }
    // kłody do siedzenia wokół ogniska
    for (const [x, z, rot] of [[-0.6, 0.5, 0.5], [0.52, 0.42, -0.6], [-0.05, 0.86, 1.57]] as const) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.55, 8), M.bark);
      seat.rotation.set(Math.PI / 2, 0, rot);
      seat.position.set(x, 0.11, z);
      g.add(seat);
    }
    // trójnóg z kociołkiem nad ogniem
    for (let k = 0; k < 3; k++) {
      const a2 = k * 2.094 + 0.5;
      const leg = box(g, M.woodDark, 0.025, 0.72, 0.025, Math.cos(a2) * 0.2, 0, 0.35 + Math.sin(a2) * 0.2);
      leg.rotation.set(Math.sin(a2) * -0.27, 0, Math.cos(a2) * 0.27);
    }
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, Math.PI * 0.35), M.iron);
    pot.position.set(0, 0.42, 0.35);
    g.add(pot);
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
    // zagony: usypane grzędy z ziemi, na nich gęste źdźbła z pochylonymi kłosami, każdy rząd lekko faluje na wietrze
    for (let i = 0; i < 6; i++) {
      const z = -1.1 + i * 0.44;
      box(g, M.soil, 1.8, 0.06, 0.3, 0.45, 0.04, z);
      const row = new THREE.Group();
      row.name = 'crop';
      row.position.set(0.45, 0.1, z);
      row.add(new THREE.Mesh(wheatRow(i), wheatMat));
      g.add(row);
      ((g.userData.crops ??= []) as THREE.Object3D[]).push(row);
    }
    hut(g, M.plaster, M.thatch, 0.7, 0.7, 0.5, -0.95, -0.9);
  },
  mill(g, _team, flag) {
    // Wiatrak wieżowy: kamienna podmurówka, zbieżna wieża z tynku przepasana belkami, małe okna, drzwi ze schodkiem,
    // obiegowa galeria z balustradą (z niej młynarz ustawia płótna), kopulasta czapa ze strzechy,
    // cztery kratowe skrzydła z płótnem (dwa rozwinięte, dwa zrefowane). Przy drzwiach worki i zapasowy kamień młyński.
    const millWall = M.plaster.clone();
    millWall.side = THREE.DoubleSide;
    const r = rng(4417);
    const H = 1.55, R0 = 0.66, R1 = 0.47; // wysokość wieży, promień u dołu i u góry
    const rad = (y: number): number => R0 + (R1 - R0) * Math.min(1, Math.max(0, (y - 0.12) / H));
    const shell = new THREE.Group();
    shell.name = 'shell';
    g.add(shell);
    // podmurówka z polnego kamienia
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R0 + 0.06, R0 + 0.1, 0.24, 14), M.stoneDark);
    base.position.y = 0.12;
    shell.add(base);
    const tower = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, H, 14), M.plaster), (R0 + R1) / 2, H);
    tower.position.y = 0.12 + H / 2;
    shell.add(tower);
    // belki opasujące wieżę
    for (const y of [0.32, 0.86, 1.42]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(rad(y) + 0.008, 0.022, 4, 28), M.woodDark);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      shell.add(band);
    }
    // okna w drewnianych ramach, rozłożone spiralnie
    for (const [ang, y] of [[0.9, 0.62], [-1.0, 0.66], [2.4, 1.15], [-2.2, 1.2], [0.2, 1.22]] as const) {
      const rr = rad(y) - 0.01;
      const win = new THREE.Group();
      win.position.set(Math.sin(ang) * rr, y, Math.cos(ang) * rr);
      win.rotation.y = ang;
      // ściana jest pochylona: okno pochylone razem z nią
      win.rotation.x = -Math.atan((R0 - R1) / H);
      box(win, M.woodDark, 0.15, 0.2, 0.03, 0, -0.1, 0.005);
      box(win, M.pane, 0.1, 0.14, 0.03, 0, -0.07, 0.012);
      box(win, M.woodDark, 0.012, 0.14, 0.035, 0, -0.07, 0.014);
      shell.add(win);
    }
    // drzwi od frontu: deski, okucia, kamienny schodek i daszek
    const dz = rad(0.3);
    const door = new THREE.Group();
    door.position.set(0, 0.24, dz - 0.02);
    door.rotation.x = -Math.atan((R0 - R1) / H);
    box(door, M.woodDark, 0.32, 0.46, 0.04, 0, 0, 0.01);
    for (let k = -1; k <= 1; k++) box(door, M.wood, 0.085, 0.42, 0.03, k * 0.09, 0.02, 0.03);
    for (const y of [0.1, 0.32]) box(door, M.iron, 0.24, 0.025, 0.03, -0.02, y, 0.05);
    const lintel = box(door, M.woodDark, 0.42, 0.05, 0.14, 0, 0.47, 0.06);
    lintel.rotation.x = 0.25;
    shell.add(door);
    box(shell, M.stone, 0.44, 0.08, 0.2, 0, 0, R0 + 0.12);
    // galeria w połowie wysokości: pomost z desek, wsporniki, balustrada
    const gy = 0.9, gr = rad(gy) + 0.2;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr, 0.04, 20), M.plank);
    deck.position.y = gy;
    shell.add(deck);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(gr - 0.01, 0.014, 4, 32), M.woodDark);
    rail.rotation.x = Math.PI / 2; rail.position.y = gy + 0.17;
    shell.add(rail);
    for (let k = 0; k < 12; k++) {
      const a2 = (k / 12) * Math.PI * 2;
      const post = box(shell, M.woodDark, 0.025, 0.18, 0.025, Math.sin(a2) * (gr - 0.01), gy, Math.cos(a2) * (gr - 0.01));
      post.rotation.y = a2;
      if (k % 2 === 0) shell.add(new THREE.Mesh(beam(new THREE.Vector3(Math.sin(a2) * rad(0.55), 0.55, Math.cos(a2) * rad(0.55)), new THREE.Vector3(Math.sin(a2) * (gr - 0.04), gy - 0.01, Math.cos(a2) * (gr - 0.04)), 0.035, r), M.woodDark));
    }
    // czapa: kopuła ze strzechy na drewnianym wieńcu, gałka na szczycie
    const cap = new THREE.Group();
    cap.name = 'roof';
    const top = 0.12 + H;
    const curb = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.06, R1 + 0.06, 0.08, 14), M.woodDark);
    curb.position.y = top + 0.03;
    cap.add(curb);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.thatchDark);
    dome.scale.set(1.05, 0.95, 1.25);
    dome.position.y = top + 0.06;
    cap.add(dome);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.woodDark);
    knob.position.y = top + 0.56;
    cap.add(knob);
    // wał skrzydeł wychodzi z czapy do przodu, lekko zadarty
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8), M.woodDark);
    shaft.rotation.x = Math.PI / 2 - 0.12;
    shaft.position.set(0, top + 0.24, 0.62);
    cap.add(shaft);
    pennant(cap, flag, 0, top + 0.55, 0);
    g.add(cap);
    // wnętrze: ta sama wieża ucięta nisko, w środku żarna z lejem, wał, worki i skrzynia na ziarno
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 10), M.wood);
    floor.position.y = 0.04;
    inside.add(floor);
    // mur z tego samego tynku co wieża, z otworem na drzwi od frontu
    const low = tileRound(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.4, 10, 1, true, Math.PI * 0.12, Math.PI * 1.76), millWall), 0.68, 0.4);
    low.position.y = 0.2;
    inside.add(low);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.035, 4, 20, Math.PI * 1.76), M.woodDark);
    lip.rotation.set(Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.12);
    lip.position.y = 0.4;
    inside.add(lip);
    // żarna na drewnianej skrzyni, lej z ziarnem nad nimi i pionowy wał
    box(inside, M.woodDark, 0.5, 0.16, 0.5, 0, 0.04, -0.22);
    for (let i = 0; i < 2; i++) {
      const stoneWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 14), i ? M.stone : M.stoneDark);
      stoneWheel.name = i ? 'runner' : '';
      stoneWheel.position.set(0, 0.24 + i * 0.085, -0.22);
      inside.add(stoneWheel);
    }
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.04, 0.16, 4), M.wood);
    hopper.position.set(0, 0.5, -0.22);
    hopper.rotation.y = Math.PI / 4;
    inside.add(hopper);
    box(inside, M.woodDark, 0.05, 0.7, 0.05, 0, 0.32, -0.22);
    // worki mąki i skrzynia z ziarnem
    for (const [x, z, h2] of [[0.38, 0.12, 0.22], [0.43, -0.12, 0.18], [0.24, 0.3, 0.2]] as const) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), M.white);
      sack.scale.set(0.9, h2 / 0.17, 0.8);
      sack.position.set(x, 0.04 + h2 / 2, z);
      inside.add(sack);
    }
    box(inside, M.wood, 0.3, 0.2, 0.22, -0.36, 0.04, 0.2);
    box(inside, M.wheat, 0.26, 0.03, 0.18, -0.36, 0.24, 0.2);
    g.add(inside);
    // skrzydła: cztery kratowe ramiona na piaście; dwa z rozwiniętym płótnem, dwa zrefowane (płótno zwinięte przy ramieniu)
    const spin = new THREE.Group();
    spin.name = 'spin';
    spin.position.set(0, top + 0.27, 0.84);
    spin.rotation.x = -0.12;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8), M.woodDark);
    hub.rotation.x = Math.PI / 2;
    spin.add(hub);
    const cloth = M.white;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (Math.PI / 2) * i + Math.PI / 4;
      box(arm, M.woodDark, 0.06, 1.28, 0.06, 0, 0.0, 0); // główne ramię
      // krata: listwa krawędzi i poprzeczki co kawałek
      box(arm, M.wood, 0.025, 1.0, 0.025, 0.25, 0.27, 0.0);
      for (let k = 0; k < 9; k++) box(arm, M.wood, 0.25, 0.018, 0.018, 0.125, 0.3 + k * 0.115, 0.0);
      for (let k = 0; k < 3; k++) box(arm, M.wood, 0.018, 1.0, 0.018, 0.06 + k * 0.065, 0.27, -0.012);
      if (i % 2 === 0) box(arm, cloth, 0.23, 0.92, 0.01, 0.125, 0.32, -0.025); // płótno rozwinięte
      else { const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), cloth); roll.position.set(0.045, 0.77, -0.03); arm.add(roll); }
      spin.add(arm);
    }
    g.add(spin);
    // przy drzwiach: worki z mąką, zapasowy kamień młyński oparty o wieżę, taczka
    for (const [x, z, s2] of [[0.42, 0.66, 1], [0.55, 0.52, 0.85], [0.47, 0.78, 0.8]] as const) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 * s2, 1), M.white);
      sack.scale.set(0.95, 1.25, 0.85);
      sack.position.set(x, 0.1 * s2, z);
      g.add(sack);
    }
    const stoneWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 16), M.stone);
    stoneWheel.rotation.set(Math.PI / 2 - 0.25, 0, 0.2);
    stoneWheel.position.set(-0.7, 0.2, 0.66);
    g.add(stoneWheel);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.075, 8), M.dark);
    eye.rotation.copy(stoneWheel.rotation); eye.position.copy(stoneWheel.position);
    g.add(eye);
  },
  bakery(g, _team, flag) {
    const inside = cottageAt(g, 23, 1.4, 1.2, 0.85, 0, 0);
    // podłoga z desek, kopulasty piec chlebowy z żarem w łukowym otworze, stół z bochenkami, dzieża i worek mąki
    box(inside, M.wood, 1.3, 0.03, 1.1, 0, 0.02, 0);
    box(inside, M.stoneDark, 0.56, 0.22, 0.5, -0.38, 0.05, -0.3);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), M.stone);
    dome.scale.set(1, 0.85, 0.95);
    dome.position.set(-0.38, 0.27, -0.3);
    inside.add(dome);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10, 1, false, 0, Math.PI), M.dark);
    mouth.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    mouth.position.set(-0.38, 0.28, -0.04);
    inside.add(mouth);
    box(inside, M.ember, 0.14, 0.04, 0.03, -0.38, 0.28, -0.02);
    // łopata piekarska oparta o piec
    const peel = new THREE.Group();
    peel.position.set(-0.1, 0.05, -0.12);
    peel.rotation.z = 0.35;
    box(peel, M.wood, 0.025, 0.5, 0.025);
    box(peel, M.wood, 0.14, 0.14, 0.012, 0, -0.02, 0);
    inside.add(peel);
    // stół z bochenkami: owalne, wypieczone, z jaśniejszym nacięciem na grzbiecie
    box(inside, M.wood, 0.5, 0.04, 0.3, 0.32, 0.26, -0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(inside, M.woodDark, 0.04, 0.26, 0.04, 0.32 + sx * 0.21, 0, -0.3 + sz * 0.11);
    for (const [x, z, r] of [[0.17, -0.36, 0.3], [0.32, -0.24, -0.2], [0.47, -0.35, 0.1], [0.3, -0.38, 0.6]] as const) {
      const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), M.bread);
      loaf.scale.set(1.35, 0.62, 0.9);
      loaf.rotation.y = r;
      loaf.position.set(x, 0.33, z);
      inside.add(loaf);
      const cut = box(inside, M.crust, 0.12, 0.012, 0.016, x, 0.365, z);
      cut.rotation.y = r;
    }
    // dzieża z ciastem i worek mąki
    const trough = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.14, 10), M.woodDark);
    trough.position.set(0.38, 0.1, 0.18);
    inside.add(trough);
    const dough = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
    dough.scale.y = 0.4;
    dough.position.set(0.38, 0.16, 0.18);
    inside.add(dough);
    const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), M.white);
    sack.scale.set(0.9, 1.3, 0.8);
    sack.position.set(-0.45, 0.17, 0.25);
    inside.add(sack);
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

/** Części modelu z kodu, które zostają także przy gotowym modelu: wnętrze, zapasy, dym, ogień, życie */
const KEEP = ['interior', 'yardlog', 'smoke', 'flame', 'fill', 'life'];

export function buildingModel(id: string, teamColor: number): THREE.Group {
  let team = teamMats.get(teamColor);
  if (!team) { team = mat(teamColor, 'tiles'); teamMats.set(teamColor, team); }
  const g = new THREE.Group();
  let flag = flagMats.get(teamColor);
  if (!flag) { flag = mat(teamColor); flagMats.set(teamColor, flag); }
  (BUILDERS[id] ?? ((gg) => { box(gg, M.wood, 1, 1, 1); }))(g, team, flag);
  // gotowy model z paczki zastępuje bryłę z kodu; nasze wnętrze i animowane części zostają
  const def = BUILDINGS.find((d) => d.id === id);
  const asset = def ? assetModel(id, teamColor, def.w, def.h) : null;
  if (asset) {
    const keep = g.children.filter((c) => KEEP.includes(c.name));
    g.clear();
    asset.name = 'shell';
    g.add(asset, ...keep);
    // skrzydła wiatraka z paczki kręcą się tak jak nasze
    asset.traverse((o) => { if (/fan/i.test(o.name)) o.name = 'spin'; });
  }
  // fundament, żeby budynek nie wisiał nad nierównym terenem
  if (id === 'torch' || id.startsWith('road')) return g; // sama pochodnia: zwykły słup wbity w ziemię, bez wydeptanego placu
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.turf);
  base.name = 'base';
  g.add(base);
  // delikatnie wydeptana trawa wokół budynku: miękka, półprzezroczysta plama, zawsze pod drogami
  const shape = new THREE.Shape();
  const seed = id.length * 17 + id.charCodeAt(0);
  for (let i = 0; i <= 20; i++) {
    const a = ((i % 20) / 20) * Math.PI * 2;
    const r = 0.84 + ((Math.sin(seed + i * 2.7) + Math.sin(seed * 1.3 + i * 5.1)) * 0.5) * 0.1;
    const c = Math.cos(a), s2 = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 0.6) * r, y = Math.sign(s2) * Math.pow(Math.abs(s2), 0.6) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const patch = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), M.trodden);
  patch.name = 'patch';
  patch.renderOrder = -1;
  g.add(patch);
  return g;
}

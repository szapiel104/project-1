import * as THREE from 'three';
import { assetModel } from './assets';
import { BUILDINGS } from '../data/buildings';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bump, normal, pattern } from './textures';
import { beam, cutBox, paintGeo, rng, stoneSkirt, thatchSlab } from './craft';
import KEEP_MODEL from './models/keep.json';
import TAVERN_MODEL from './models/tavern.json';

type Pattern = Parameters<typeof pattern>[0];
/** Materiał fizyczny: wzór, wypukłość z tego samego wzoru i matowa, chropowata powierzchnia. */
/** Ile razy wzór powtarza się na jednostkę długości (jedno pole mapy). Dzięki temu kamień ma tę samą wielkość na małej i dużej ścianie. */
export const roadMaterials = (): THREE.MeshStandardMaterial[] => [M.roadSand, M.roadStone, M.roadWood];
const TILE: Partial<Record<Pattern, number>> = { cobble: 1,  ashlar: 0.8, dressed: 0.55, slate: 1.1, bricks: 0.9, planks: 1.1, thatch: 0.9, tiles: 1.2, plaster: 0.9, soil: 0.7, bark: 1.5 };
const mat = (color: number, tex?: Pattern): THREE.MeshStandardMaterial => {
  const nm = tex ? normal(tex) : null;
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, map: tex ? pattern(tex) : null, bumpMap: tex ? bump(tex) : null, normalMap: nm, normalScale: new THREE.Vector2(0.9, 0.9), bumpScale: tex === 'ashlar' ? 0.9 : tex === 'dressed' ? 0.7 : tex === 'cobble' ? 1.6 : 1.4 });
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
/**
 * Okrągła bela siana leżąca na boku (oś X): zaokrąglone krawędzie, źdźbła zwinięte wokół osi
 * (na denkach widać słoje zwoju), dwa powrósła. Tekstura strzechy biegnie wzdłuż obwodu.
 */
function roundBale(r: number, len: number): THREE.Group {
  const c = r * 0.32, h = len / 2, pts: THREE.Vector2[] = [new THREE.Vector2(0.001, -h)];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push(new THREE.Vector2(r - c + Math.sin(a) * c, -h + c - Math.cos(a) * c)); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, h - c + Math.sin(a) * c)); }
  pts.push(new THREE.Vector2(0.001, h));
  const seg = 22, geo = new THREE.LatheGeometry(pts, seg);
  const k = (M.hay.userData.tile as number) || 4;
  const uv = geo.getAttribute('uv');
  const along: number[] = [0];
  for (let j = 1; j < pts.length; j++) along.push(along[j - 1]! + pts[j]!.distanceTo(pts[j - 1]!));
  for (let i = 0; i <= seg; i++) for (let j = 0; j < pts.length; j++) uv.setXY(i * pts.length + j, along[j]! * k * 1.5, (i / seg) * Math.PI * 2 * r * k);
  geo.rotateZ(Math.PI / 2);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(geo, M.hay));
  for (const o of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.003, 0.006, 4, 22), M.woodDark);
    band.rotation.y = Math.PI / 2;
    band.position.x = o * len;
    grp.add(band);
  }
  return grp;
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
  ash: mat(0x4a4540), slate: mat(0x8a8d94, 'slate'), sack: mat(0xbfa77c, 'burlap'), rock: mat(0xb3ae9f, 'rock'), rockDark: mat(0x8d877a, 'rock'),
  flameLight: new THREE.MeshBasicMaterial({ color: 0xffc04a }), flameCore: new THREE.MeshBasicMaterial({ color: 0xfff0a8 }),
  roadSand: mat(0xd4b77c, 'soil'), roadStone: mat(0xf4f0e8, 'cobble'), roadWood: mat(0xc49a6a, 'planks'),
  // miniatury dróg w menu: te same barwy co na mapie (ciepła szarość bruku, ubita ziemia)
  pathDirt: mat(0xa8865a, 'soil'), pathCobble: mat(0x9e968a, 'cobble'), kerb: mat(0x8c867c, 'rock'),
  trousers: mat(0x5a4632), skin: mat(0xe2bd94), gold: mat(0xe9c145),
  hay: mat(0xe0c466, 'thatch'),
  ore: mat(0x8a4a2c), crust: mat(0xe2b06a),
  cut: mat(0xe6dfcf, 'dressed'), cutDark: mat(0xc9c1ae, 'dressed'), rope: mat(0xb89a64), dust: mat(0xd8d3c6, 'soil'),
  wattle: mat(0x9a7a4a, 'thatch'),
  thatchDark: mat(0xa9862f, 'thatch'), fish: mat(0x9cc3d6), sawdust: mat(0xd9c08a, 'soil'), needle: mat(0x3c7a3a, 'needles'),
  castle: mat(0xa9a08c, 'ashlar'), castleDark: mat(0x857b68, 'ashlar'), castlePlain: mat(0xd6c49a),
  smoke: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, flatShading: true, transparent: true, opacity: 0.8 }),
};

// Szyby, ciemne wnęki i rysy leżą tuż przy ścianie: z daleka karta graficzna myli je ze ścianą i obraz mruga.
// Przesunięcie głębi „do przodu” rozstrzyga ten remis zawsze na ich korzyść.
for (const m of [M.window, M.pane, M.dark]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }

/**
 * Worek z płótna stojący na ziemi (y = podłoże): pękaty, lekko oklapnięty spód, ramiona, szyjka przewiązana sznurkiem
 * i zebrana nad nią góra. `s` = wielkość (1 ≈ 0,3 pola wysokości), `rot` = obrót.
 */
function sack(g: THREE.Object3D, x: number, y: number, z: number, s = 1, rot = 0): void {
  const m = new THREE.Mesh(sackGeometry(), M.sack);
  m.position.set(x, y, z);
  m.rotation.y = rot;
  m.scale.setScalar(s);
  g.add(m);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10), M.rope);
  tie.rotation.x = Math.PI / 2;
  tie.position.set(x, y + 0.25 * s, z);
  tie.scale.setScalar(s);
  g.add(tie);
}
let sackGeo: THREE.BufferGeometry | null = null;
/** Bryła worka: obrócony profil — oklapnięty spód, pękate boki, ramiona, przewiązana szyjka i rozchylona góra */
export function sackGeometry(): THREE.BufferGeometry {
  if (sackGeo) return sackGeo;
  const prof = [[0, 0], [0.075, 0], [0.105, 0.025], [0.116, 0.075], [0.112, 0.14], [0.095, 0.195], [0.06, 0.232], [0.03, 0.248], [0.028, 0.258], [0.046, 0.285], [0.034, 0.3], [0, 0.302]].map(([px, py]) => new THREE.Vector2(px, py));
  sackGeo = new THREE.LatheGeometry(prof, 16).scale(1.05, 1, 0.92);
  // drobniejszy splot płótna: wzór powtarza się kilka razy dookoła worka
  const uv = sackGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2);
  return sackGeo;
}

/** Studnia: kamienna cembrowina, dwa słupy z daszkiem, wał z korbą, wiadro na linie; skala do wstawienia na podwórze */
function wellModel(k: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.32, 14, 1, true), M.stone);
  ring.position.y = 0.16; g.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 6, 16), M.stoneDark);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; g.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.27, 14), new THREE.MeshStandardMaterial({ color: 0x1b3a40, roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.2; g.add(water);
  for (const sx of [-1, 1]) box(g, M.woodDark, 0.06, 0.82, 0.06, sx * 0.3, 0, 0);
  box(g, M.wood, 0.7, 0.05, 0.05, 0, 0.62, 0);
  const crank = box(g, M.woodDark, 0.03, 0.14, 0.03, 0.38, 0.55, 0.04);
  crank.rotation.z = 0.4;
  for (const sz of [-1, 1]) { const r = box(g, M.thatch, 0.8, 0.04, 0.34, 0, 0.84, sz * 0.15); r.rotation.x = sz * 0.55; }
  box(g, M.rope, 0.012, 0.3, 0.012, 0, 0.32, 0);
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 8), M.wood);
  pail.position.set(0, 0.3, 0); g.add(pail);
  g.scale.setScalar(k);
  return g;
}

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
    tex: 'burlap',
    // worki z płótna: trzy stoją (każdy trochę inaczej obrócony), czwarty leży bokiem z przodu
    geo: merge([
      ...([[-0.1, -0.06, 0.2, 1], [0.1, -0.07, -0.5, 0.95], [0.0, 0.08, 1.1, 0.9]] as const).flatMap(([x, z, rot, sc]) => [
        paint(sackGeometry().clone().scale(sc, sc, sc).rotateY(rot).translate(x, -0.15, z), 0xcdb68a),
        paint(new THREE.TorusGeometry(0.03, 0.007, 4, 10).rotateX(Math.PI / 2).scale(sc, sc, sc).translate(x, -0.15 + 0.25 * sc, z), 0x7a5a32),
      ]),
      paint(sackGeometry().clone().scale(0.85, 0.85, 0.7).rotateZ(Math.PI / 2).translate(0.12, -0.055, 0.15), 0xc4ad80),
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
    const parts = (model.userData.lids ??= (() => { const l: THREE.Object3D[] = []; model.traverse((o) => { if (o !== model && ['roof', 'shell', 'chimney', 'spin', 'flagpole'].includes(o.name)) l.push(o); }); return l; })()) as THREE.Object3D[];
    for (const part of parts) part.visible = !active;
  }
  // flagi łopoczą: płachta kołysze się wokół drzewca, każda w innym rytmie
  const clothes = (model.userData.cloths ??= (() => { const l: THREE.Object3D[] = []; model.traverse((o) => { if (o.name === 'flagcloth') l.push(o); }); return l; })()) as THREE.Object3D[];
  for (let i = 0; i < clothes.length; i++) { const c = clothes[i]!; c.rotation.y = Math.sin(time * 1.7 + i * 1.3 + model.id) * 0.28; c.rotation.z = Math.sin(time * 2.3 + i) * 0.04; }
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
  // stary dym z brył (kanciaste kule) wyłączony: dym z kominów i ognisk rysuje teraz system cząstek (ambience)
  const smoke = model.getObjectByName('smoke');
  if (smoke && smoke.visible) smoke.visible = false;
}

type Builder = (g: THREE.Group, team: THREE.Material, flag: THREE.Material) => void;

/** Mała chorągiewka w barwie drużyny (gładka, bez wzoru dachówek) */
/** Płachta flagi: płótno pofalowane na wietrze, przyczepione lewym brzegiem do drzewca, końce lekko opadają */
let clothGeo: THREE.BufferGeometry | null = null;
function flagCloth(): THREE.BufferGeometry {
  if (clothGeo) return clothGeo;
  const geo = new THREE.PlaneGeometry(0.3, 0.18, 12, 4).translate(0.15, 0, 0);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const k = x / 0.3;
    p.setXYZ(i, x, y - k * k * 0.03, Math.sin(k * 7.5) * 0.025 * k + Math.sin(y * 18 + k * 4) * 0.004);
  }
  geo.computeVertexNormals();
  clothGeo = geo;
  return geo;
}
/** Flaga na drzewcu z gałką; cała grupa nazywa się 'flagpole' — znika, gdy zaglądamy do wnętrza budynku */
function pennant(g: THREE.Group, flag: THREE.Material, x: number, y: number, z: number): void {
  const fp = new THREE.Group();
  fp.name = 'flagpole';
  fp.position.set(x, y, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.56, 6), M.woodDark);
  pole.position.y = 0.28; fp.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.gold);
  knob.position.y = 0.57; fp.add(knob);
  const cloth = new THREE.Group();
  cloth.name = 'flagcloth';
  cloth.position.y = 0.44;
  cloth.add(new THREE.Mesh(flagCloth(), flag));
  fp.add(cloth);
  g.add(fp);
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

/** Budynek z Blendera: grupy (zawsze / dach i piętra / wnętrze / podłoga sypialni), w każdej siatka na materiał gry */
interface BlenderBuilding { q: number; [group: string]: number | { mat: string; pos: string; ao: string }[] }
const aoMats = new Map<THREE.Material, THREE.Material>();
/** Ten sam materiał gry, ale z kolorem wierzchołków (niesie cień w zagłębieniach upieczony w Blenderze) */
function withAo(m: THREE.Material): THREE.Material {
  let c = aoMats.get(m);
  if (!c) { c = m.clone(); (c as THREE.MeshStandardMaterial).vertexColors = true; c.userData = m.userData; aoMats.set(m, c); }
  return c;
}
const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
const geoCache = new Map<string, THREE.BufferGeometry>();
function blenderGeo(pos: string, ao: string, q: number, k: number): THREE.BufferGeometry {
  const key = pos.length + ':' + pos.slice(0, 40) + ':' + k;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const raw = b64(pos), p16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), a8 = b64(ao);
  const n = p16.length / 3, P = new Float32Array(n * 3), C = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  for (let i = 0; i < p16.length; i++) P[i] = p16[i]! / q;
  for (let i = 0; i < n; i++) { const v = a8[i]! / 255; C[i * 3] = v; C[i * 3 + 1] = v; C[i * 3 + 2] = v; }
  // współrzędne tekstury z położenia, rzutem na płaszczyznę ściany (jak tileBox dla brył z kodu)
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nr = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    e1.set(P[t * 3 + 3]! - P[t * 3]!, P[t * 3 + 4]! - P[t * 3 + 1]!, P[t * 3 + 5]! - P[t * 3 + 2]!);
    e2.set(P[t * 3 + 6]! - P[t * 3]!, P[t * 3 + 7]! - P[t * 3 + 1]!, P[t * 3 + 8]! - P[t * 3 + 2]!);
    nr.crossVectors(e1, e2);
    const ax = Math.abs(nr.x), ay = Math.abs(nr.y), az = Math.abs(nr.z);
    for (let v = t; v < t + 3; v++) {
      const x = P[v * 3]!, y = P[v * 3 + 1]!, z = P[v * 3 + 2]!;
      const [u, w] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      UV[v * 2] = u * k; UV[v * 2 + 1] = w * k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}
function blenderModel(g: THREE.Group, model: BlenderBuilding, flag: THREE.Material): void {
  const mats = M as unknown as Record<string, THREE.Material>;
  const meshes = (name: string): THREE.Mesh[] => ((model[name] as { mat: string; pos: string; ao: string }[] | undefined) ?? []).map((m) => {
    const base = m.mat === 'flag' ? flag : mats[m.mat] ?? M.wood;
    const k = (base.userData.tile as number) || 1;
    return new THREE.Mesh(blenderGeo(m.pos, m.ao, model.q, k), withAo(base));
  });
  for (const m of meshes('base')) g.add(m);
  const shell = new THREE.Group();
  shell.name = 'shell';
  for (const m of meshes('shell')) shell.add(m);
  g.add(shell);
  // wnętrze: pierwsza jest podłoga sypialni (na niej gra kładzie posłania śpiących)
  const interior = new THREE.Group();
  interior.name = 'interior';
  interior.visible = false;
  for (const m of [...meshes('floor'), ...meshes('interior')]) interior.add(m);
  g.add(interior);
  // sufit sali: tylko gdy ktoś chodzi po niej oczami mieszkańca
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  ceiling.visible = false;
  for (const m of meshes('ceiling')) ceiling.add(m);
  g.add(ceiling);
  // znaczniki z modelu: szyby (świecą nocą), komin (dym), ogień w palenisku
  const marks = model as unknown as { windows?: [number, number, number, number, number, number, number, string][]; chimneys?: [number, number, number][]; flames?: [number, number, number][] };
  for (const [x, y, z, nx, nz, w, h, grp] of marks.windows ?? []) {
    const pane = box(grp === 'shell' ? shell : g, M.pane, nx ? 0.012 : w, h, nz ? 0.012 : w, x, y - h / 2, z);
    pane.name = 'pane';
  }
  for (const [x, y, z] of marks.chimneys ?? []) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    c.name = 'chimney';
    c.position.set(x, y, z);
    shell.add(c);
  }
  for (const [x, y, z] of marks.flames ?? []) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6).translate(0, 0.08, 0), M.ember);
    f.name = 'flame';
    f.position.set(x, y, z);
    g.add(f);
  }
}

/** Modele budynków z brył. Klucz = id z data/buildings.ts. Początek układu = środek działki, 1 = jedno pole. */
const BUILDERS: Record<string, Builder> = {
  keep(g, _team, flag) {
    // Zamek z Blendera (tools/models/keep.py): mury z dziedzińcem, baszty, brama z mostem, donżon z salą i komnatą,
    // koszary straży. Przy podglądzie wnętrza znikają dachy i piętra donżonu — widać pomieszczenia i śpiących.
    blenderModel(g, KEEP_MODEL as unknown as BlenderBuilding, flag);
    // Życie widoczne z zewnątrz: kosze z ogniem przy wejściu. Straż na murach i w bramie to prawdziwi strażnicy miejscy
    // z symulacji (systems/guards.ts), więc w modelu nie ma już udawanych postaci.
    const life = new THREE.Group();
    life.name = 'life';
    // kosze ogniowe przy bramie: kuta noga na trzech łapach, żelazna misa z węglem; płomień rysuje system ognia (tylko po zmroku)
    for (const sx of [-1, 1]) {
      const stand = new THREE.Group();
      stand.position.set(sx * 1.2, 0, 6.15);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.36, 6).translate(0, 0.18, 0), M.iron);
      stand.add(leg);
      for (let k = 0; k < 3; k++) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 4).translate(0, 0.06, 0), M.iron);
        foot.rotation.z = 0.9; foot.rotation.y = (k / 3) * Math.PI * 2;
        foot.position.y = 0.01;
        stand.add(foot);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.07, 10, 1, true), M.iron);
      bowl.material = M.iron; bowl.position.y = 0.39;
      stand.add(bowl);
      const coal = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 10), M.woodDark);
      coal.position.y = 0.41;
      stand.add(coal);
      const spot = new THREE.Object3D();
      spot.name = 'brazier';
      spot.position.y = 0.42;
      stand.add(spot);
      life.add(stand);
    }
    g.add(life);
  },
  tavern(g, _team, flag) {
    // Karczma z Blendera (tools/models/tavern.py): piętrowy szachulec, strzecha, komin, ganek z ławami i szyldem;
    // w izbie szynkwas, beczki, palenisko i stoły — wieczorem siadają przy nich goście, chłopem da się wejść do środka
    blenderModel(g, TAVERN_MODEL as unknown as BlenderBuilding, flag);
    const p = (TAVERN_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  house(g, _team, flag) {
    const inside = cottage(g, houseSeed++);
    // izba: cała podłoga to legowiska (siennik pod każdym śpiącym rysuje scena), przy ścianie skrzynia i dzban
    box(inside, M.woodDark, 0.22, 0.14, 0.14, 0.56, 0.05, 0.42);
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.1, 8), M.rockDark);
    jug.position.set(0.56, 0.24, 0.42);
    inside.add(jug);
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
    g.add(top);
    // drabinka do drzwi i worki pod ścianą
    for (const x of [-0.12, 0.12]) { const rail = box(g, M.wood, 0.03, 0.42, 0.03, x, 0, 0.78); rail.rotation.x = 0.5; }
    for (let k = 0; k < 3; k++) box(g, M.wood, 0.26, 0.025, 0.03, 0, 0.08 + k * 0.1, 0.86 - k * 0.055);
    for (const [x, z, sc] of [[0.55, 0.82, 1], [0.78, 0.8, 0.85], [0.66, 0.84, 0.8]] as const) {
      sack(g, x, x === 0.66 ? 0.24 : 0, z, sc, x * 3);
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
    // ściany z deskami, od frontu szeroki otwór: wrota przesuwne zawsze odsunięte na boki, w środku widać zapasy
    box(shell, M.wood, 2.6, 0.95, 0.06, 0, 0.2, -0.77);
    for (const sx of [-1, 1]) {
      box(shell, M.wood, 0.06, 0.95, 1.6, sx * 1.27, 0.2, 0);
      box(shell, M.window, 0.04, 0.26, 0.26, sx * 1.305, 0.6, 0);
      box(shell, M.wood, 0.65, 0.95, 0.06, sx * 0.975, 0.2, 0.77);
      // wrota na szynie: deski z ukośną zastrzałą
      box(shell, M.woodDark, 0.66, 0.84, 0.04, sx * 0.99, 0.2, 0.83);
      for (const yy of [0.32, 0.86]) box(shell, M.plank, 0.62, 0.05, 0.03, sx * 0.99, yy, 0.86);
      const brace = box(shell, M.plank, 0.05, 0.62, 0.03, sx * 0.99, 0.33, 0.86);
      brace.rotation.z = sx * 0.75;
    }
    box(shell, M.wood, 1.3, 0.13, 0.06, 0, 1.02, 0.77);
    box(shell, M.iron, 2.4, 0.03, 0.03, 0, 1.06, 0.86);
    g.add(shell);
    // dach: gruba strzecha z ciemniejszym okapem, kalenica z żerdzi, wiatrownice na szczytach i daszek nad wrotami
    const top = new THREE.Group();
    top.name = 'roof';
    gable(top, M.thatchDark, 2.95, 0.9, 2.1, 1.1);
    gable(top, M.thatch, 2.8, 1.0, 1.9, 1.16);
    box(top, M.woodDark, 2.9, 0.07, 0.09, 0, 2.12, 0);
    const porch = box(top, M.thatchDark, 1.1, 0.05, 0.45, 0, 1.12, 1.05);
    porch.rotation.x = 0.45;
    g.add(top);
    // siano przy wrotach: dwie okrągłe bele obwiązane powrósłem i kopka z wbitymi widłami
    for (const [bx, bz, rot] of [[1.08, 1.1, 0.3], [0.66, 1.12, -0.2]] as const) {
      const b = roundBale(0.17, 0.3);
      b.position.set(bx, 0.17, bz);
      b.rotation.y = rot;
      g.add(b);
    }
    const stack = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.hay);
    stack.scale.set(1, 1.25, 1);
    stack.position.set(-1.0, 0, 1.12);
    g.add(stack);
    const fork = box(g, M.woodDark, 0.025, 0.55, 0.025, -0.95, 0.15, 1.12);
    fork.rotation.z = 0.35;
    // wnętrze zawsze widoczne przez otwarte wrota: klepisko ze słomą i zapasy składu (stodoła trzyma tylko surowce)
    box(g, M.plank, 2.5, 0.05, 1.5, 0, 0.2, 0);
    // po kliknięciu (albo gdy ktoś pracuje) zdejmujemy dach i ściany: zostają niskie ścianki jak w innych budynkach
    const inside = new THREE.Group();
    inside.name = 'interior';
    inside.visible = false;
    for (const [x, z, w, d] of [[0, -0.77, 2.6, 0.06], [-1.27, 0, 0.06, 1.6], [1.27, 0, 0.06, 1.6]] as const) box(inside, M.wood, w, 0.45, d, x, 0.2, z);
    g.add(inside);
    const goods = fillSlots('fill', 0, -0.05, 0.42);
    goods.position.y = 0.2;
    g.add(goods);
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
    // łódka wyciągnięta na brzeg: kadłub ze spiczastym dziobem i rufą, ciemne wnętrze, ławka i wiosło
    const boat = new THREE.Group();
    boat.position.set(0.55, 0, -0.55);
    boat.rotation.y = 0.5;
    const outline = (k: number): THREE.Shape => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.46 * k, 0);
      sh.quadraticCurveTo(-0.25 * k, 0.19 * k, 0.15 * k, 0.18 * k);
      sh.quadraticCurveTo(0.42 * k, 0.15 * k, 0.46 * k, 0);
      sh.quadraticCurveTo(0.42 * k, -0.15 * k, 0.15 * k, -0.18 * k);
      sh.quadraticCurveTo(-0.25 * k, -0.19 * k, -0.46 * k, 0);
      return sh;
    };
    const hull = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outline(1), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, 0.03, 0),
      M.woodDark);
    boat.add(hull);
    const inside = new THREE.Mesh(new THREE.ShapeGeometry(outline(0.84)).rotateX(-Math.PI / 2), M.dark);
    inside.position.y = 0.181;
    boat.add(inside);
    box(boat, M.wood, 0.5, 0.02, 0.035, 0, 0.17, 0.155); // listwy burt
    box(boat, M.wood, 0.5, 0.02, 0.035, 0, 0.17, -0.155);
    box(boat, M.plank, 0.07, 0.025, 0.3, 0.05, 0.16, 0); // ławka
    // wiosło oparte o burtę: drzewce i płaskie pióro
    const oar = new THREE.Group();
    oar.position.set(-0.05, 0.02, 0.3);
    oar.rotation.set(0, 0.15, 0.12);
    box(oar, M.wood, 0.7, 0.025, 0.025, 0, 0, 0);
    box(oar, M.wood, 0.18, 0.012, 0.08, 0.38, 0, 0);
    boat.add(oar);
    g.add(boat);
    pennant(g, flag, -0.8, 0.9, -0.6);
  },
  torch(g) {
    g.add(torchModel());
  },
  well(g) {
    g.add(wellModel(1));
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
    // studnia na podwórzu cechu: stąd inżynier czerpie wodę do gaszenia pożarów
    const w2 = wellModel(0.7); w2.position.set(0.72, 0, 0.78); g.add(w2);
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
  roadSand(g) {
    box(g, M.pathDirt, 0.96, 0.04, 0.96);
    // kamyki przy brzegu ubitej ścieżki
    for (const [x, z, r] of [[-0.44, 0.3, 0.035], [0.4, -0.38, 0.03], [0.46, 0.12, 0.025], [-0.2, -0.46, 0.028]] as const) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), M.kerb);
      p.position.set(x, 0.04 + r * 0.4, z);
      p.scale.set(1.3, 0.7, 1);
      g.add(p);
    }
  },
  roadWood(g) {
    // droga z dyli: bale w poprzek na dwóch legarach, nierówne końce
    for (let k = 0; k < 6; k++) {
      const z = -0.4 + k * 0.16;
      const b = box(g, M.roadWood, 0.9 + ((k * 5) % 3) * 0.04, 0.045, 0.14, ((k * 7) % 3 - 1) * 0.02, 0.02, z);
      b.rotation.y = ((k * 3) % 5 - 2) * 0.015;
    }
    for (const x of [-0.3, 0.3]) box(g, M.woodDark, 0.08, 0.04, 0.96, x, 0, 0);
  },
  roadStone(g) {
    box(g, M.pathCobble, 0.96, 0.05, 0.96);
    // krawężnik z ciosanych kamieni dookoła płyty, jak na mapie
    for (const side of [0, 1, 2, 3]) {
      for (let k = 0; k < 4; k++) {
        const t = -0.36 + k * 0.24;
        const [x, z] = side === 0 ? [t, -0.42] : side === 1 ? [t, 0.42] : side === 2 ? [-0.42, t] : [0.42, t];
        const kb = box(g, M.kerb, side < 2 ? 0.22 : 0.11, 0.08, side < 2 ? 0.11 : 0.22, x, 0.03, z);
        kb.rotation.y = ((k * 7 + side * 3) % 5 - 2) * 0.02;
      }
    }
  },
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
      sack(inside, x, 0.04, z, h2 / 0.26, x * 5);
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
      sack(g, x, 0, z, s2 * 0.85, x * 4);
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
    sack(inside, -0.45, 0.04, 0.25, 0.9, 0.4);
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
const KEEP = ['interior', 'ceiling', 'yardlog', 'smoke', 'flame', 'fill', 'life'];

export function buildingModel(id: string, teamColor: number): THREE.Group {
  let team = teamMats.get(teamColor);
  if (!team) { team = mat(teamColor, 'tiles'); teamMats.set(teamColor, team); }
  const g = new THREE.Group();
  let flag = flagMats.get(teamColor);
  if (!flag) {
    // flagi, chorągwie i proporce z płótna w barwach drużyny (widać splot, światło przechodzi miękko)
    flag = new THREE.MeshStandardMaterial({ color: teamColor, map: pattern('burlap'), normalMap: normal('burlap'), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, side: THREE.DoubleSide });
    flag.userData.tile = 3;
    flagMats.set(teamColor, flag);
  }
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

import { named } from './named';
import * as THREE from 'three';
import { basketAt, propAt, propGeometryFlat, propMaterial, type PropName } from './props';
import { assetModel } from './assets';
import { BUILDINGS } from '../data/buildings';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bump, grayPattern, normal, pattern } from './textures';
import { boxUv, modelGeo } from './peasants';
import { beam, rng } from './craft';
import { model } from './modelstore';
import { addModelBanners, bannerGeometry, bannerMaterial, flagTime } from './banners';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
const KEEP_MODEL = model('keep');
const TAVERN_MODEL = model('tavern');
const HOUSE_MODEL = model('house');
const BARN_MODEL = model('barn');
const GRANARY_MODEL = model('granary');
const TORCH_MODEL = model('torch');
const GRANARY_BIG_MODEL = model('granary_big');
const ARMORY_MODEL = model('armory');
const BAKERY_MODEL = model('bakery');
const MILL_MODEL = model('mill');
const BARRACKS_MODEL = model('barracks');
const ORCHARD_MODEL = model('orchard');
const FARM_MODEL = model('farm');
const CAMP_MODEL = model('camp');
const BREWERY_MODEL = model('brewery');
const GATE_MODEL = model('gate');
const STONE_TOWER_MODEL = model('stonetower');
const WATCH_TOWER_MODEL = model('watchtower');
const WELL_MODEL = model('well');
const ENGINEERS_MODEL = model('engineers');
const STONE_GATE_MODEL = model('stonegate');
const STOCKPILE_MODEL = model('stockpile');
const WOODCUTTER_MODEL = model('woodcutter');
const OREMINE_MODEL = model('mine');
const MINECAMP_MODEL = model('minecamp');
const BANDITCAMP_MODEL = model('banditcamp');
const MINE_LEVEL_MODEL = model('minelevel');
const FISHER_MODEL = model('fisher');
const FLETCHER_MODEL = model('fletcher');
const POLETURNER_MODEL = model('poleturner');
const CEMETERY_MODEL = model('cemetery');
const FORESTER_MODEL = model('forester');

type Pattern = Parameters<typeof pattern>[0];
/** Materiał fizyczny: wzór, wypukłość z tego samego wzoru i matowa, chropowata powierzchnia. */
/** Ile razy wzór powtarza się na jednostkę długości (jedno pole mapy). Dzięki temu kamień ma tę samą wielkość na małej i dużej ścianie. */
export const roadMaterials = (): THREE.MeshStandardMaterial[] => [M.roadSand, M.roadStone, M.roadWood];
const TILE: Partial<Record<Pattern, number>> = { cobble: 1,  ashlar: 0.8, dressed: 0.55, slate: 1.1, bricks: 0.9, planks: 1.1, thatch: 0.9, tiles: 1.2, plaster: 0.9, soil: 0.7, bark: 1.5 };
/**
 * Magiczna ruda jak w Gothicu: głęboki granat i fiolet w plamach, gęsto nakrapiany białymi i błękitnymi iskrami.
 * Wzór rysowany raz na płótnie (to nie zdjęciowa tekstura z pattern(), więc KTX2 go nie dotyczy); iskry lekko świecą
 * same z siebie (emissiveMap), więc ruda błyszczy też w ciemnej sztolni, a płaskie ścianki brył łapią światło jak kryształ.
 */
function oreMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.32, metalness: 0.2 });
  m.userData.tile = 2.2;
  if (typeof document === 'undefined') { m.color.setHex(0x3a3cc8); return m; }
  const S = 256;
  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const draw = (glow: boolean): THREE.CanvasTexture => {
    seed = 7;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d')!;
    x.fillStyle = glow ? '#000' : '#14123f'; x.fillRect(0, 0, S, S);
    // plamy granatu, kobaltu i fioletu (rysowane z zawinięciem, żeby wzór się kafelkował bez szwów)
    const blot = (px: number, py: number, r: number, col: string): void => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    };
    const tones = ['rgba(52,58,210,0.85)', 'rgba(88,48,190,0.75)', 'rgba(30,34,140,0.9)', 'rgba(70,96,235,0.7)', 'rgba(16,14,70,0.9)'];
    for (let i = 0; i < 70; i++) { const px = rnd() * S, py = rnd() * S, r = 10 + rnd() * 34, col = tones[Math.floor(rnd() * tones.length)]!; if (!glow) blot(px, py, r, col); }
    // iskry: drobne, ostre, białe i błękitne (z nich bierze się świecenie)
    for (let i = 0; i < 520; i++) {
      const px = rnd() * S, py = rnd() * S, big = rnd() < 0.12, r = big ? 1.6 + rnd() * 1.6 : 0.6 + rnd() * 0.9;
      const t = rnd();
      const col = t < 0.45 ? '#e8f0ff' : t < 0.8 ? '#8fc4ff' : '#b49cff';
      x.fillStyle = glow ? (big ? col : 'rgba(120,150,255,0.55)') : col;
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  m.map = draw(false);
  m.emissiveMap = draw(true);
  m.emissive.setHex(0x6f8cff);
  m.emissiveIntensity = 0.45;
  return m;
}

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

const M = {
  stone: mat(0xcfc7b3, 'bricks'), stoneDark: mat(0xa39b88, 'bricks'), wood: mat(0x85603a, 'planks'), woodDark: mat(0x5e4329, 'planks'),
  plaster: mat(0xf0e4c4, 'plaster'), thatch: mat(0xd1ad4c, 'thatch'), soil: mat(0x86633d, 'soil'), wheat: mat(0xd9b84a),
  leaf: mat(0x5c9a3c, 'leaves'), apple: mat(0xd0281f), iron: mat(0x4a4038), white: mat(0xf1ead8),
  plank: mat(0xd9b27a, 'planks'),
  orchardGrass: mat(0x86b54a, 'grass'), bark: mat(0x7a5a3a, 'bark'), leafLight: mat(0x7fb548, 'leaves'),
  appleGreen: mat(0xa9c23f), basket: mat(0xb08a4e, 'thatch'), bread: mat(0xa8652c),
  ember: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
  // czarna czeluść (wyjście ze sztolni ginące w mroku): bez światła i odbić, zawsze smoliście czarna
  void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
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
  // magiczna ruda jak w Gothicu: skała z niebieskawym połyskiem, lekko świeci w ciemnej sztolni (żyły, hałdy, urobek w koszach)
  magicOre: oreMaterial(),
  cut: mat(0xe6dfcf, 'dressed'), cutDark: mat(0xc9c1ae, 'dressed'), rope: mat(0xb89a64, 'burlap'), dust: mat(0xd8d3c6, 'soil'),
  wattle: mat(0x9a7a4a, 'thatch'),
  // skóry zwierząt na szałasach zbójów (ciemna, wytarta skóra z włosiem; dwa odcienie, żeby płaty się różniły)
  hide: mat(0x7a5a3e, 'burlap'), hideDark: mat(0x58402c, 'burlap'),
  thatchDark: mat(0xa9862f, 'thatch'), fish: mat(0x9cc3d6), sawdust: mat(0xd9c08a, 'soil'), needle: mat(0x3c7a3a, 'needles'),
  // woda w studni i korycie: ciemna, gładka tafla z połyskiem (bez tekstury)
  water: new THREE.MeshStandardMaterial({ color: 0x1b3a40, roughness: 0.15, metalness: 0.1 }),
  castle: mat(0xa9a08c, 'ashlar'), castleDark: mat(0x857b68, 'ashlar'), castlePlain: mat(0xd6c49a),
  smoke: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, flatShading: true, transparent: true, opacity: 0.8 }),
};

// Szyby, ciemne wnęki i rysy leżą tuż przy ścianie: z daleka karta graficzna myli je ze ścianą i obraz mruga.
// Przesunięcie głębi „do przodu” rozstrzyga ten remis zawsze na ich korzyść.
for (const m of [M.window, M.pane, M.dark]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }

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

function box(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const k = (m.userData.tile as number) || 0;
  if (k) tileBox(geo, w, h, d, k);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

export const STOCK_LAYERS = 3;

/** Pusta siatka miejsc na stosy (9 miejsc w 3 warstwach), wypełniana przez setStockFill. */
function fillSlots(name: string, x: number, z: number, step = 0.54, cols = 3, rows = 3, scale = 1): THREE.Group {
  // miejsca na zapasy: siatka cols × rows w STOCK_LAYERS warstwach; scale zmniejsza kosze, worki i beczki
  // (w spichlerzach jedzenie jest mniejsze, a duży spichlerz ma więcej miejsc, więc widać, że mieści więcej)
  const fill = new THREE.Group();
  fill.name = name;
  fill.userData.slots = cols * rows;
  for (let layer = 0; layer < STOCK_LAYERS; layer++)
    for (let i = 0; i < cols * rows; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.46), M.wood);
      m.scale.setScalar(scale);
      m.position.set(x + ((i % cols) - (cols - 1) / 2) * step, 0.06 + (0.15 + layer * 0.31) * scale, z + (Math.floor(i / cols) - (rows - 1) / 2) * step);
      m.visible = false;
      fill.add(m);
    }
  return fill;
}

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
/**
 * Kosz z wikliny w składzie: kosz z paczki (src/render/props.ts, Poly Haven wicker_basket_02) — dno w y = -0,14,
 * szerokość 0,4, brzeg w y = 0. W nim modele z paczek (jabłka, bochenki): dwie grupy bryły, kosz i zawartość,
 * każda z własną teksturą (`withProp: ['basket', …]`, `noCode`).
 */
const inBasket = (contents: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries([basketAt(0, -0.14, 0, 0.4, 0.14, 0.3), merge(contents)], true)!;
/**
 * `withProp`: kolejne grupy bryły to gotowe modele z paczek (src/render/props.ts) z własnymi teksturami — np. ryby
 * w skrzynce, beczki na legarach; `noCode`: bryła ma same modele z paczek (kosz jabłek, kosz chleba), bez części z kodu.
 */
const PILES: Record<string, { geo: THREE.BufferGeometry; tex?: Pattern; metal?: boolean; withProp?: PropName | PropName[]; noCode?: boolean }> = {
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
    // kosz z wikliny, w nim cztery bochenki ze skanów (trzy różne, Poly Haven hamburger_buns): trzy na dnie, czwarty
    // na nich skosem, wierzch wystaje nad brzeg kosza
    withProp: ['basket', 'bun1'],
    noCode: true,
    geo: inBasket([
      // kosz zwęża się ku dołowi: dolne bochenki (szer. 0,14) bliżej środka, żeby nie przebijały ścianek
      propAt('bun1', -0.055, -0.125, -0.02, 0.14, 0.3), propAt('bun2', 0.06, -0.125, -0.025, 0.14, -0.5),
      propAt('bun3', 0.0, -0.125, 0.065, 0.14, 1.4), propAt('bun2', 0.005, -0.065, 0.0, 0.16, 2.2),
    ]),
  },
  apples: {
    // kosz jabłek ze skanu (Poly Haven food_apple_01): trzy w środku, trzy na wierzchu wystają nad brzeg
    // (głębiej i tak nie widać; kosz: dno -0,14, brzeg 0, jabłko szerokości 0,1 i wysokości 0,088)
    withProp: ['basket', 'apple'],
    noCode: true,
    geo: inBasket(([[0.055, -0.085, 0.025], [-0.05, -0.085, 0.04], [0.0, -0.085, -0.06], [0.03, -0.035, 0.0], [-0.045, -0.03, -0.03], [-0.01, -0.03, 0.06]] as const)
      .map(([x, y, z], k) => propAt('apple', x, y, z, 0.1, k * 2.1))),
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
  ale: {
    tex: 'planks',
    // beczki piwa z paczki (Poly Haven wine_barrel_01, wypalona wersja 560 trójkątów — w składzie może ich stać
    // kilkadziesiąt): dwie leżą na legarach, trzecia stoi na nich w rowku między nimi
    withProp: 'barrelLow',
    geo: mergeGeometries([
      // legary w poprzek beczek (beczki leżą wzdłuż x, długość 0,26), wierzch legara w -0,12 = spód leżących beczek
      merge([-0.08, 0.08].map((x) => paint(part(new THREE.BoxGeometry(0.04, 0.03, 0.46), x, -0.135, 0), 0x5a3e24))),
      merge([
        ...[-0.113, 0.113].map((z) => propGeometryFlat('barrelLow').translate(0, -0.5, 0).scale(0.26, 0.26, 0.26).rotateZ(Math.PI / 2).rotateX(z * 9).translate(0, -0.007, z)),
        // stojąca: średnica 0,19, dno 0,106 — tam leżące beczki (promień 0,113) mają powierzchnię pod jej krawędzią
        propGeometryFlat('barrelLow').scale(0.22, 0.22, 0.22).rotateY(0.8).translate(0, 0.106, 0),
      ]),
    ], true)!,
  },
  fish: {
    tex: 'planks',
    withProp: 'fish',
    // skrzynka z listew, w niej trzy ryby z paczki (tools/models/props_import.py) — prawdziwe łuski, płetwy i oko
    geo: mergeGeometries([
      merge([
        paint(part(new THREE.BoxGeometry(0.38, 0.02, 0.3), 0, -0.12, 0), 0x6b4f30),
        ...[-0.14, 0.14].map((z) => paint(part(new THREE.BoxGeometry(0.4, 0.08, 0.02), 0, -0.08, z), 0x8a6a45)),
        ...[-0.19, 0.19].map((x) => paint(part(new THREE.BoxGeometry(0.02, 0.08, 0.3), x, -0.08, 0), 0x7a5a3a)),
      ]),
      // ryby leżą na boku wzdłuż skrzynki (długość 0,3, szerokość ok. 0,13, grubość 0,067): dwie obok siebie na dnie,
      // trzecia na nich, odwrócona łbem w drugą stronę — bez przenikania
      merge(([[-0.066, 0.03, -0.076, 1, 0], [0.066, -0.03, -0.076, -1, 0], [0.0, 0.05, -0.011, 1, Math.PI]] as const).map(([z, yaw, y, side, turn]) =>
        propGeometryFlat('fish', true).scale(0.3, 0.3, 0.3).rotateZ(side * Math.PI / 2).rotateY(Math.PI / 2 + yaw + turn).translate(0, y, z))),
    ], true)!,
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
  const STOCK_SLOTS = (fill.userData.slots as number | undefined) ?? 9;
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
    const props = pile.withProp === undefined ? [] : (Array.isArray(pile.withProp) ? pile.withProp : [pile.withProp]).map(propMaterial);
    const mat: THREE.Material | THREE.Material[] = props.length ? (pile.noCode ? props : [m, ...props]) : m;
    while (items > 0 && slot < STOCK_SLOTS) {
      for (let layer = 0; layer < STOCK_LAYERS && items > 0; layer++, items--) {
        const mesh = fill.children[layer * STOCK_SLOTS + slot] as THREE.Mesh;
        if (pile.geo) mesh.geometry = pile.geo;
        mesh.material = mat;
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
/** Pochodnia na słupie z Blendera (tools/models/torch.py): ociosany słup z opaskami, kopczyk z kamieniami, kuty kosz
 *  ze szczapami. Siatki wspólne dla wszystkich pochodni (stoją przy każdym budynku z wejściem). */
let torchParts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] | null = null;
export function torchModel(): THREE.Group {
  if (!torchParts) {
    const T = TORCH_MODEL as unknown as { flame: [number, number, number]; parts: (Parameters<typeof modelGeo>[0] & { mat: string })[] };
    const MATS: Record<string, [THREE.Material, number]> = {
      wood: [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('bark'), normalMap: normal('bark') }), 7],
      iron: [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.65, map: grayPattern('rock'), normalMap: normal('rock') }), 9],
      stone: [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: pattern('rock'), normalMap: normal('rock') }), 5],
      soil: [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('soil'), normalMap: normal('soil') }), 4],
      pitch: [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), 1],
    };
    torchParts = T.parts.map((p) => { const [mat, sc] = MATS[p.mat] ?? MATS.pitch!; return { geo: boxUv(modelGeo(p), sc), mat }; });
  }
  const g = new THREE.Group();
  g.name = 'torch';
  for (const p of torchParts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // punkt płomienia: system ognia rysuje go 0,12 niżej, czyli tuż nad szczapami w koszu
  const flame = new THREE.Object3D();
  flame.position.set(0, 1.21, 0);
  flame.name = 'torchflame';
  g.add(flame);
  return g;
}

/** Animacje budynków: kręcące się skrzydła młyna i dym z komina, tylko gdy ktoś w środku pracuje. */
export function animateBuilding(model: THREE.Object3D, active: boolean, time: number, dt: number): void {
  const interior = named(model, 'interior');
  if (interior) {
    // ktoś pracuje w środku: zdejmujemy dach i ściany, żeby było go widać
    interior.visible = active;
    // wszystkie części o tych nazwach (np. twierdza ma kilka warstw „shell”: donżon i bryłę murów z dziedzińcem)
    const parts = (model.userData.lids ??= (() => { const l: THREE.Object3D[] = []; model.traverse((o) => { if (o !== model && ['roof', 'shell', 'chimney', 'spin', 'flagpole'].includes(o.name)) l.push(o); }); return l; })()) as THREE.Object3D[];
    for (const part of parts) part.visible = !active;
  }
  // flagi łopoczą: płachta kołysze się wokół drzewca, każda w innym rytmie
  const clothes = (model.userData.cloths ??= (() => { const l: THREE.Object3D[] = []; model.traverse((o) => { if (o.name === 'flagcloth') l.push(o); }); return l; })()) as THREE.Object3D[];
  // płótno faluje w shaderze (banners.ts); tu tylko lekki ruch całej płachty na wietrze
  flagTime.value = time;
  for (let i = 0; i < clothes.length; i++) { const c = clothes[i]!; c.rotation.y = Math.sin(time * 0.9 + i * 1.3 + model.id) * 0.12; }
  const flame = named(model, 'flame');
  if (flame) { flame.visible = active; flame.scale.set(1, 0.8 + Math.abs(Math.sin(time * 9)) * 0.5, 1); }
  // życie na murach, niezależnie od tego, czy budynek jest otwarty
  const life = named(model, 'life');
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
      const arm = named(p, 'arm');
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
  const spin = named(model, 'spin');
  if (spin && active) spin.rotation.z -= dt * 1.6;
  const crops = (model.userData.crops ?? model.children[0]?.userData.crops) as THREE.Object3D[] | undefined;
  if (crops) for (const o of crops) o.rotation.x = Math.sin(time * 1.3 + o.position.z * 3) * 0.06;
  const runner = named(model, 'runner');
  if (runner && active) runner.rotation.y += dt * 2.2;
  // stary dym z brył (kanciaste kule) wyłączony: dym z kominów i ognisk rysuje teraz system cząstek (ambience)
  const smoke = named(model, 'smoke');
  if (smoke && smoke.visible) smoke.visible = false;
}

type Builder = (g: THREE.Group, team: THREE.Material, flag: THREE.Material) => void;

/** Chorągiew na drzewcu: płachta z obszyciem i jaskółczym ogonem (herb właściciela dokłada scena — applyCrest),
 *  drzewce z obręczą, złotą gałką i żelaznym grotem; cała grupa nazywa się 'flagpole' — znika, gdy zaglądamy do wnętrza */
const poleGeo = new THREE.CylinderGeometry(0.011, 0.016, 0.58, 7);
const ringGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.018, 8);
const knobGeo = new THREE.SphereGeometry(0.019, 10, 8);
const spikeGeo = new THREE.ConeGeometry(0.012, 0.06, 6);
function pennant(g: THREE.Group, flag: THREE.Material, x: number, y: number, z: number): void {
  const fp = new THREE.Group();
  fp.name = 'flagpole';
  fp.position.set(x, y, z);
  const pole = new THREE.Mesh(poleGeo, M.woodDark);
  pole.position.y = 0.29; fp.add(pole);
  const ring = new THREE.Mesh(ringGeo, M.iron);
  ring.position.y = 0.02; fp.add(ring);
  const knob = new THREE.Mesh(knobGeo, M.gold);
  knob.position.y = 0.585; fp.add(knob);
  const spike = new THREE.Mesh(spikeGeo, M.iron);
  spike.position.y = 0.63; fp.add(spike);
  const cloth = new THREE.Group();
  cloth.name = 'flagcloth';
  cloth.position.set(0.006, 0.455, 0);
  cloth.add(new THREE.Mesh(bannerGeometry(), bannerMaterial((flag as THREE.MeshStandardMaterial).color?.getHex() ?? 0xa32a22, null)));
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




/** Budynek z Blendera: grupy (zawsze / dach i piętra / wnętrze / podłoga sypialni), w każdej siatka na materiał gry */
interface BlenderBuilding { q: number; [group: string]: number | { mat: string; pos: string; ao: string }[] }
const aoMats = new Map<THREE.Material, THREE.Material>();
/** Ten sam materiał gry, ale z kolorem wierzchołków (niesie cień w zagłębieniach upieczony w Blenderze) */
let baseMats: Set<THREE.Material> | null = null;
function withAo(m: THREE.Material): THREE.Material {
  let c = aoMats.get(m);
  if (!c) {
    c = m.clone(); (c as THREE.MeshStandardMaterial).vertexColors = true; c.userData = m.userData; aoMats.set(m, c);
    // Modele z Blendera składamy z brył, które często stykają się płaszczyznami (belki szachulca na tynku, ciosy na murze,
    // gzyms na koronie): dwie powierzchnie w tym samym miejscu migają przy ruchu kamery (z-fighting). Duże płaszczyzny
    // (tynk, mur, deski, ziemia, strzecha) zostają na swoim miejscu, a detale są o włos bliżej kamery, więc zawsze wygrywają.
    baseMats ??= new Set<THREE.Material>([M.plaster, M.stone, M.castle, M.castlePlain, M.plank, M.soil, M.thatch, M.thatchDark, M.slate, M.roadWood, M.roadStone, M.roadSand, M.pathCobble, M.pathDirt, M.cut, M.turf, M.orchardGrass]);
    if (!baseMats.has(m)) { c.polygonOffset = true; c.polygonOffsetFactor = -1; c.polygonOffsetUnits = -4; }
  }
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
/**
 * Ryby w budynkach z Blendera (suszarnia i kosz u rybaka, stół w kuchni twierdzy): gotowy model z paczki
 * (src/render/props.ts) w miejscach zapisanych przez skrypt budynku (`fishSpots`: x, y, z pyska, yaw, wisi?, długość).
 * Wszystkie ryby budynku w jednej siatce (jedno rysowanie), wersja lżejsza — na porównaniu nie różni się od pełnej.
 */
type FishSpot = [number, number, number, number, number, number];
const fishGeos = new Map<unknown, THREE.BufferGeometry>();
function buildingFish(model: unknown): THREE.Mesh {
  let geo = fishGeos.get(model);
  if (!geo) {
    const spots = (model as { fishSpots: FishSpot[] }).fishSpots;
    const m = new THREE.Matrix4(), X = new THREE.Vector3(), B = new THREE.Vector3(), H = new THREE.Vector3(), C = new THREE.Vector3(), S = new THREE.Vector3();
    geo = mergeGeometries(spots.map(([x, y, z, yaw, hang, L]) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      if (hang) {
        // wisi pyskiem w górę na sznurku przez skrzela, grzbiet w stronę yaw
        H.set(0, 1, 0); B.set(cy, 0, sy); C.set(x, y - L / 2, z);
      } else {
        // leży na boku: od pyska w (x, z) ogonem w stronę yaw; grubość ryby to ok. 0,22 długości
        H.set(-cy, 0, -sy); B.set(-sy, 0, cy); C.set(x + cy * L / 2, y + L * 0.111 + 0.004, z + sy * L / 2);
      }
      X.crossVectors(B, H);
      m.makeBasis(X, B, H).scale(S.set(L, L, L)).setPosition(C);
      return propGeometryFlat('fish', true).applyMatrix4(m);
    }))!;
    fishGeos.set(model, geo);
  }
  const mesh = new THREE.Mesh(geo, propMaterial('fish'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Jabłko albo bochenek w modelu budynku: [grupa, 'apple' | 'bun', x, y dna, z, szerokość, obrót] (building.py) */
type FoodSpot = [string, 'apple' | 'bun', number, number, number, number, number];
const foodCache = new Map<unknown, [string, 'apple' | 'bun', THREE.BufferGeometry][]>();
/**
 * Siatki jabłek i bochenków budynku, po jednej na grupę i rodzaj. Jabłka w najlżejszej wersji (420 trójkątów —
 * w sadzie jest ich ponad sto, a każde ma kilka centymetrów), bochenki z trzech skanów na zmianę (wspólna tekstura).
 */
function foodGeos(model: unknown, spots: FoodSpot[]): [string, 'apple' | 'bun', THREE.BufferGeometry][] {
  let out = foodCache.get(model);
  if (out) return out;
  const by = new Map<string, THREE.BufferGeometry[]>();
  spots.forEach(([grp, kind, x, y, z, w, rot], i) => {
    const key = `${grp}|${kind}`;
    let l = by.get(key); if (!l) { l = []; by.set(key, l); }
    l.push(kind === 'apple' ? propAt('appleLow', x, y, z, w, rot) : propAt((['bun1', 'bun2', 'bun3'] as const)[i % 3]!, x, y, z, w, rot));
  });
  out = [...by].map(([key, l]) => { const [grp, kind] = key.split('|') as [string, 'apple' | 'bun']; return [grp, kind, mergeGeometries(l)!] as [string, 'apple' | 'bun', THREE.BufferGeometry]; });
  foodCache.set(model, out);
  return out;
}

/** Kosz w modelu budynku: [grupa, x, y dna, z, szerokość, wysokość] (tools/models/building.py) */
type BasketSpot = [string, number, number, number, number, number];
const basketCache = new Map<unknown, [string, THREE.BufferGeometry][]>();
/** Siatki koszy budynku, po jednej na grupę; każdy kosz lekko inaczej obrócony (stały obrót z położenia) */
function basketGeos(model: unknown, spots: BasketSpot[]): [string, THREE.BufferGeometry][] {
  let out = basketCache.get(model);
  if (out) return out;
  const by = new Map<string, THREE.BufferGeometry[]>();
  for (const [grp, x, y, z, w, h] of spots) {
    const yaw = (Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5) % 1) * Math.PI * 2;
    let l = by.get(grp); if (!l) { l = []; by.set(grp, l); }
    l.push(basketAt(x, y, z, w, h, yaw));
  }
  out = [...by].map(([grp, l]) => [grp, mergeGeometries(l)!] as [string, THREE.BufferGeometry]);
  basketCache.set(model, out);
  return out;
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
  // skrzydła wrót (brama): zapisane zamknięte, obracają się wokół zawiasów x = ±hinge; startują otwarte
  const hinge = (model as unknown as { hinge?: number }).hinge;
  if (hinge) for (const [name, side] of [['leafL', -1], ['leafR', 1]] as const) {
    const leaf = new THREE.Group();
    leaf.name = name;
    leaf.position.x = side * hinge;
    leaf.rotation.y = side * 1.3;
    // siatki są wspólne dla wszystkich bram (pamięć podręczna), więc przesuwamy pośrednią grupę, nie geometrię
    const off = new THREE.Group();
    off.position.x = -side * hinge;
    for (const m of meshes(name)) off.add(m);
    leaf.add(off);
    g.add(leaf);
  }
  // inne grupy z modelu (np. krata bramy zamku): osobne obiekty o tej samej nazwie, gra rusza nimi sama
  for (const [key, val] of Object.entries(model)) {
    if (['base', 'shell', 'interior', 'floor', 'ceiling', 'leafL', 'leafR'].includes(key) || !Array.isArray(val) || !val.length || typeof val[0] !== 'object' || !('pos' in (val[0] as object))) continue;
    const grp = new THREE.Group();
    grp.name = key;
    for (const m of meshes(key)) grp.add(m);
    g.add(grp);
  }
  // chorągwie z herbem: model podaje tylko miejsca, płachty rysuje banners.ts (herb dokłada scena)
  addModelBanners(g, (model as unknown as { banners?: Parameters<typeof addModelBanners>[1] }).banners, (flag as THREE.MeshStandardMaterial).color?.getHex() ?? 0xa32a22);
  // znaczniki z modelu: szyby (świecą nocą), komin (dym), ogień w palenisku
  const marks = model as unknown as { windows?: [number, number, number, number, number, number, number, string][]; chimneys?: [number, number, number][]; flames?: [number, number, number][]; lights?: [number, number, number][] };
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
  // kosze z wikliny: model zapisuje tylko miejsca (building.py → 'baskets'), kosz z paczki wstawiamy tutaj,
  // wszystkie kosze jednej grupy w jednej siatce (jedno rysowanie)
  const baskets = (model as unknown as { baskets?: BasketSpot[] }).baskets;
  if (baskets?.length) {
    const groups: Record<string, THREE.Object3D> = { base: g, shell, interior, floor: interior, ceiling };
    for (const [name, geo] of basketGeos(model, baskets)) {
      const mesh = new THREE.Mesh(geo, propMaterial('basket'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (groups[name] ?? g.getObjectByName(name) ?? g).add(mesh);
    }
  }
  // jabłka i bochenki ze skanów: model zapisuje tylko miejsca (building.py → 'foods'), jedna siatka na grupę i rodzaj
  const foods = (model as unknown as { foods?: FoodSpot[] }).foods;
  if (foods?.length) {
    const groups: Record<string, THREE.Object3D> = { base: g, shell, interior, floor: interior, ceiling };
    for (const [name, kind, geo] of foodGeos(model, foods)) {
      const mesh = new THREE.Mesh(geo, propMaterial(kind === 'apple' ? 'apple' : 'bun1'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (groups[name] ?? g.getObjectByName(name) ?? g).add(mesh);
    }
  }
  // pochodnie zrobione w bryle modelu (zamek): niewidoczne znaczniki, przy których scena nocą zapala lekkie światło
  for (const [x, y, z] of marks.lights ?? []) {
    const o = new THREE.Object3D();
    o.name = 'lightSpot';
    o.position.set(x, y, z);
    g.add(o);
  }
  // latarnie, które płoną zawsze (sztolnia, izba baraku): znacznik w swojej grupie, więc widać go tylko, gdy widać tę grupę
  for (const [x, y, z, grp] of (model as unknown as { lamps?: [number, number, number, string?][] }).lamps ?? []) {
    const o = new THREE.Object3D();
    o.name = 'lampSpot';
    o.position.set(x, y, z);
    (grp === 'interior' ? interior : g).add(o);
  }
  // ognisko przed budynkiem (barak górników): pali się cały czas, rysuje je system płomieni jak w obozowisku
  for (const [x, y, z] of (model as unknown as { campfires?: [number, number, number][] }).campfires ?? []) {
    const o = new THREE.Object3D();
    o.name = 'campfire';
    o.position.set(x, y, z);
    g.add(o);
  }
  for (const [x, y, z] of marks.flames ?? []) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6).translate(0, 0.08, 0), M.ember);
    f.name = 'flame';
    f.position.set(x, y, z);
    g.add(f);
  }
}

/**
 * Wnętrze kopalni jako osobna lokacja (tools/models/minelevel.py): korytarz, hala i dwa chodniki z przodkami.
 * Spacer przenosi się tu po wejściu w portal kopalni (scene.ts, enterMine). Znaczniki latarń to obiekty 'lampSpot'.
 */
export function mineLevelModel(): THREE.Group {
  const g = new THREE.Group();
  blenderModel(g, MINE_LEVEL_MODEL as unknown as BlenderBuilding, M.wood);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return g;
}

/** Modele budynków z brył. Klucz = id z data/buildings.ts. Początek układu = środek działki, 1 = jedno pole. */
const BUILDERS: Record<string, Builder> = {
  keep(g, _team, flag) {
    // Zamek z Blendera (tools/models/keep.py): mury z dziedzińcem, baszty, brama z mostem, donżon z salą i komnatą,
    // koszary straży. Przy podglądzie wnętrza znikają dachy i piętra donżonu — widać pomieszczenia i śpiących.
    blenderModel(g, KEEP_MODEL as unknown as BlenderBuilding, flag);
    // ryba na stole w kuchni (wnętrze: widać ją razem z resztą wnętrza)
    (g.getObjectByName('interior') as THREE.Group | undefined)?.add(buildingFish(KEEP_MODEL));
    // krata na start podniesiona (opuszcza ją gra, gdy pod zamek podejdzie wróg)
    const port = g.getObjectByName('portcullis');
    if (port) port.position.y = (KEEP_MODEL as unknown as { portLift?: number }).portLift ?? 0.86;
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
  brewery(g, _team, flag) {
    // Browar z Blendera (tools/models/brewery.py): kamienny dom, dach z gontu, komin pieca; w środku kocioł z miedzi i kadzie
    blenderModel(g, BREWERY_MODEL as unknown as BlenderBuilding, flag);
    pennant(g.getObjectByName('shell') as THREE.Group, flag, 0, 1.45, 0.4);
  },
  tavern(g, _team, flag) {
    // Karczma z Blendera (tools/models/tavern.py): piętrowy szachulec, strzecha, komin, ganek z ławami i szyldem;
    // w izbie szynkwas, beczki, palenisko i stoły — wieczorem siadają przy nich goście, chłopem da się wejść do środka
    blenderModel(g, TAVERN_MODEL as unknown as BlenderBuilding, flag);
    const p = (TAVERN_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  house(g, _team, flag) {
    // chata z Blendera (tools/models/house.py): szachulec, strzecha, komin nad paleniskiem; w izbie stół, skrzynia
    // i wolna podłoga pod ścianami na posłania śpiących; chłopem da się wejść do środka
    blenderModel(g, HOUSE_MODEL as unknown as BlenderBuilding, flag);
    const p = (HOUSE_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  stockpile(g, _team, flag) {
    // skład z Blendera (tools/models/stockpile.py): plac z desek na legarach, płot z żerdzi z trzech stron, tablica z karbami,
    // taczka; na środku 3×3 miejsc, na których gra układa towary według stanu składu
    blenderModel(g, STOCKPILE_MODEL as unknown as BlenderBuilding, flag);
    const fill = fillSlots('fill', 0, 0);
    fill.position.y = (STOCKPILE_MODEL as unknown as { floorY: number }).floorY - 0.06;
    g.add(fill);
  },
  granary(g, _team, flag) {
    // spichlerz z Blendera (tools/models/granary.py): szachulec na kamiennych grzybkach, strzecha, schodki do drzwi;
    // w środku pusta podłoga, na której gra układa żywność według stanu spichlerza
    blenderModel(g, GRANARY_MODEL as unknown as BlenderBuilding, flag);
    const inside = g.getObjectByName('interior') as THREE.Group;
    const food = fillSlots('foodfill', 0, -0.02, 0.3, 4, 3, 0.55);
    food.position.y = (GRANARY_MODEL as unknown as { floorY: number }).floorY - 0.06;
    inside.add(food);
    const p = (GRANARY_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  granaryBig(g, _team, flag) {
    // duży spichlerz z Blendera (tools/models/granary_big.py): kamienna podmurówka, szachulec, łupek, lukarna z bloczkiem;
    // na podłodze gra układa żywność według stanu spichlerzy (gęściej niż w małym, bo izba większa)
    blenderModel(g, GRANARY_BIG_MODEL as unknown as BlenderBuilding, flag);
    const inside = g.getObjectByName('interior') as THREE.Group;
    const food = fillSlots('foodfill', 0, -0.08, 0.32, 6, 5, 0.55);
    food.position.y = (GRANARY_BIG_MODEL as unknown as { floorY: number }).floorY - 0.06;
    inside.add(food);
    const p = (GRANARY_BIG_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  armory(g, _team, flag) {
    // zbrojownia z Blendera (tools/models/armory.py): kamień, łupek, okute drzwi, tarcza w barwach pana nad wejściem;
    // w środku stojaki pod ścianami, a na posadzce gra układa włócznie i łuki według stanu zbrojowni
    blenderModel(g, ARMORY_MODEL as unknown as BlenderBuilding, flag);
    const inside = g.getObjectByName('interior') as THREE.Group;
    const arms = fillSlots('armsfill', 0.12, 0.02, 0.34);
    arms.position.y = (ARMORY_MODEL as unknown as { floorY: number }).floorY - 0.06;
    inside.add(arms);
    const p = (ARMORY_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  woodcutter(g, _team, flag) {
    // chata drwala z Blendera (tools/models/woodcutter.py): chata z bali z dachem z gontu i kominem, wiata z kozłem, piłą
    // i stosem desek, pieniek z siekierą, sągi; w izbie pieniek do rąbania (tu pracuje drwal), ława z narzędziami, polana
    blenderModel(g, WOODCUTTER_MODEL as unknown as BlenderBuilding, flag);
    const p = (WOODCUTTER_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
    // przyciągnięte drzewo: pień z sękami, gałęziami i resztką listowia; skraca się z każdą partią desek
    const yard = new THREE.Group();
    yard.name = 'yardlog';
    yard.position.set(-0.98, 0.1, 0.74);
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
    // stodoła z Blendera (tools/models/barn.py): deski na słupach, strzecha z lukarną, wrota otwarte na oścież,
    // w środku puste klepisko, na którym gra układa zapasy składu (stodoła trzyma tylko surowce)
    blenderModel(g, BARN_MODEL as unknown as BlenderBuilding, flag);
    const goods = fillSlots('fill', 0, 0.05, 0.42);
    goods.position.y = (BARN_MODEL as unknown as { floorY: number }).floorY;
    g.add(goods);
    const p = (BARN_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },

  fisher(g, _team, flag) {
    // chata rybaka z Blendera (tools/models/fisher.py): chata z desek na palach z gankiem i strzechą, suszarnia ryb,
    // sieci na tyczkach, łódka z wiosłami wyciągnięta na brzeg, beczka do solenia, kosz z rybami
    blenderModel(g, FISHER_MODEL as unknown as BlenderBuilding, flag);
    g.add(buildingFish(FISHER_MODEL));
    const p = (FISHER_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  torch(g) {
    g.add(torchModel());
  },
  well(g, _team, flag) {
    // studnia z Blendera (tools/models/well.py): cembrowina z ciosów na mijankę, wał z liną i korbą, wiadra, daszek z desek, koryto
    blenderModel(g, WELL_MODEL as unknown as BlenderBuilding, flag);
  },
  engineers(g, _team, flag) {
    // cech inżynierów z Blendera (tools/models/engineers.py): warsztat z szachulca, w izbie stół kreślarski z planem,
    // model trebusza i skrzynia narzędzi; na obejściu dźwig z blokiem nad taczką, beczkowóz z wodą, wiadra, bosak, drabina
    blenderModel(g, ENGINEERS_MODEL as unknown as BlenderBuilding, flag);
    const p = (ENGINEERS_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  fletcher(g, _team, flag) {
    // łuczarz z Blendera (tools/models/fletcher.py): warsztat z szachulca; w izbie stół z łęczyskiem, łuki na ścianie,
    // beczka strzał, lotki; przed nim tarcza ze słomy, stojak z łukami do sezonowania
    blenderModel(g, FLETCHER_MODEL as unknown as BlenderBuilding, flag);
    const p = (FLETCHER_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  poleturner(g, _team, flag) {
    // włóczniarz z Blendera (tools/models/poleturner.py): warsztat z szachulca; w izbie kozioł do strugania drzewc,
    // drzewca na wieszakach, kosz grotów; przed nim stojak z gotowymi włóczniami i wiązka surowych drzewc pod daszkiem
    blenderModel(g, POLETURNER_MODEL as unknown as BlenderBuilding, flag);
    const p = (POLETURNER_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  barracks(g, _team, flag) {
    // koszary z Blendera (tools/models/barracks.py): z tyłu dom straży (szachulec, strzecha, komin), z przodu plac ćwiczeń
    // z kukłami, tarczą łuczniczą, stojakiem z włóczniami, korytem i sztandarem; w domu prycze, stół, palenisko, tarcze
    blenderModel(g, BARRACKS_MODEL as unknown as BlenderBuilding, flag);
  },
  ladder(g) {
    // na mapie drabinę rysuje scena przy murze (syncWalls); tu tylko podgląd: drabina oparta o mur od strony -z
    const preview = new THREE.Group();
    preview.name = 'preview';
    const geo = stoneWallKit().ladder.clone().translate(0, 0, -1);
    preview.add(new THREE.Mesh(geo, M.wood));
    g.add(preview);
  },
  stoneWall(g) {
    // na mapie mur kamienny rysuje scena (syncWalls) jako filary i ramiona łączące sąsiednie mury; tu tylko podgląd
    const preview = new THREE.Group();
    preview.name = 'preview';
    box(preview, M.stone, 1.0, 1.25, 0.42, 0, 0, 0);
    box(preview, M.stoneDark, 1.07, 0.06, 0.49, 0, 1.25, 0);
    for (const x of [-0.33, -0.08, 0.17, 0.42]) box(preview, M.stone, 0.11, 0.2, 0.44, x, 1.31, 0);
    g.add(preview);
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
    // Brama z Blendera (tools/models/gate.py): baszty z zaostrzonych bali, pomost straży z daszkiem i palami,
    // dwuskrzydłowe wrota z desek z okuciami (obraca je scena), pochodnie w uchwytach (płoną nocą)
    blenderModel(g, GATE_MODEL as unknown as BlenderBuilding, flag);
    g.traverse((o) => { if (o.name === 'flame') o.name = 'torchFlame'; });
    const p = (GATE_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  stoneGate(g, _team, flag) {
    // Kamienna brama z Blendera (tools/models/stonegate.py): baszty z ciosów, łukowy przejazd z klińcami, korona na wysokości
    // muru kamiennego, okute wrota (obraca je scena), pochodnie w uchwytach (płoną nocą)
    blenderModel(g, STONE_GATE_MODEL as unknown as BlenderBuilding, flag);
    g.traverse((o) => { if (o.name === 'flame') o.name = 'torchFlame'; });
  },
  watchtower(g, _team, flag) {
    // Drewniana wieża strażnicza z Blendera (tools/models/watchtower.py): nogi z bali na kamiennych podkładach, zastrzały
    // na krzyż z oplotami z liny, pomost z przedpiersiem z desek, ławka, kosz strzał, róg alarmowy, strzecha, drabina
    blenderModel(g, WATCH_TOWER_MODEL as unknown as BlenderBuilding, flag);
  },
  stoneTower(g, _team, flag) {
    // Kamienna wieża z Blendera (tools/models/stonetower.py): baszta z ciosów, machikuły, blanki, pomost dla łuczników
    blenderModel(g, STONE_TOWER_MODEL as unknown as BlenderBuilding, flag);
  },
  forester(g, _team, flag) {
    // chata leśniczego z Blendera (tools/models/forester.py): chata z bali pod strzechą, szkółka młodych drzewek za płotem
    // z wikliny, kopczyk z łopatą, sadzonki w płótnie, wiadro i worek z nasionami; w izbie stół z siewkami i prycza
    blenderModel(g, FORESTER_MODEL as unknown as BlenderBuilding, flag);
    const p = (FORESTER_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  cemetery(g, _team, flag) {
    // cmentarz z Blendera (tools/models/cemetery.py): kamienna kapliczka z sygnaturką i dzwonkiem, mogiły z krzyżami
    // i nagrobkami, świeży dół z łopatą, płot z żerdzi z bramką, ławka i latarnia
    blenderModel(g, CEMETERY_MODEL as unknown as BlenderBuilding, flag);
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
  camp(g, _team, flag) {
    // obozowisko z Blendera (tools/models/camp.py): ognisko w kręgu kamieni z kociołkiem na trójnogu, wokół stołki
    // i kłoda, stos drewna; płomień ('flame') dokłada blenderModel, a scena zamienia go na żywy ogień
    blenderModel(g, CAMP_MODEL as unknown as BlenderBuilding, flag);
  },
  orchard(g, _team, flag) {
    // sad z Blendera (tools/models/orchard.py): łąka w płocie z plecionki, cztery jabłonie z jabłkami, skład jabłek
    // (szopa z regałami skrzynek), ul, drabina, skrzynki przy wejściu; chłopem da się wejść i pochodzić między drzewami
    blenderModel(g, ORCHARD_MODEL as unknown as BlenderBuilding, flag);
  },
  farm(g, _team, flag) {
    // farma z Blendera (tools/models/farm.py): pole w płocie, zagony, chałupa rolnika z narzędziami, kopki, strach na wróble;
    // zboże na zagonach jest z kodu (rośnie i faluje), w miejscach zapisanych w modelu
    blenderModel(g, FARM_MODEL as unknown as BlenderBuilding, flag);
    const rows = (FARM_MODEL as unknown as { rows: [number, number, number, number][] }).rows;
    rows.forEach(([x, y, z, len], i) => {
      const row = new THREE.Group();
      row.name = 'crop';
      row.position.set(x, y, z);
      const m = new THREE.Mesh(wheatRow(i), wheatMat);
      m.scale.x = len / 1.78;
      row.add(m);
      g.add(row);
      ((g.userData.crops ??= []) as THREE.Object3D[]).push(row);
    });
  },
  mill(g, _team, flag) {
    // wiatrak z Blendera (tools/models/mill.py): kamienna podmurówka, zbieżna wieża z tynku, galeria, czapa ze strzechy,
    // kratowe skrzydła z płótnem; w środku żarna z lejem, worki mąki. Skrzydła ('spin') i górny kamień ('runner')
    // kręci scena, gdy młynarz pracuje — tu przenosimy je do grup obracanych wokół ich osi
    blenderModel(g, MILL_MODEL as unknown as BlenderBuilding, flag);
    const m = MILL_MODEL as unknown as { spinAt: [number, number, number]; runnerAt: [number, number, number]; pennant: [number, number, number] };
    const pivot = (name: string, at: [number, number, number], parent: THREE.Object3D): void => {
      const src = g.getObjectByName(name);
      if (!src) return;
      src.name = '';
      const p = new THREE.Group();
      p.name = name;
      p.position.set(at[0], at[1], at[2]);
      const off = new THREE.Group();
      off.position.set(-at[0], -at[1], -at[2]);
      off.add(src);
      p.add(off);
      parent.add(p);
    };
    pivot('spin', m.spinAt, g);
    pivot('runner', m.runnerAt, g.getObjectByName('interior') ?? g);
    pennant(g.getObjectByName('shell') as THREE.Group, flag, m.pennant[0], m.pennant[1], m.pennant[2]);
  },
  bakery(g, _team, flag) {
    // piekarnia z Blendera (tools/models/bakery.py): szachulec, strzecha, z tyłu kopulasty piec pod daszkiem i komin;
    // od frontu okno-lada z bochenkami i szyld z obwarzankiem; w środku czeluść z żarem, stół z chlebem, dzieża, worki mąki
    blenderModel(g, BAKERY_MODEL as unknown as BlenderBuilding, flag);
    const p = (BAKERY_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  oremine(g, _team, flag) {
    // kopalnia pod górami z Blendera (tools/models/mine.py): skalny garb z drewnianym portalem sztolni, w grocie ściany
    // z żyłami rudy, stemple, wózek na szynach, latarnie; górnicy kopią w miejscach z klucza `spots` (scene.ts)
    blenderModel(g, OREMINE_MODEL as unknown as BlenderBuilding, flag);
  },
  minecamp(g, _team, flag) {
    // barak górników z Blendera (tools/models/minecamp.py): chata z bali, prycze ze słomą (tu śpi załoga kopalni), stół,
    // kilofy i latarnia, piecyk; przed nim ognisko z kłodami i kosze z urobkiem czekającym na wóz
    blenderModel(g, MINECAMP_MODEL as unknown as BlenderBuilding, flag);
    const p = (MINECAMP_MODEL as unknown as { pennant: [number, number, number] }).pennant;
    pennant(g.getObjectByName('shell') as THREE.Group, flag, p[0], p[1], p[2]);
  },
  banditCamp(g, _team, flag) {
    // obóz zbójów z Blendera (tools/models/banditcamp.py): szałas z gałęzi i namiot ze skór, zasieka z pali, ognisko
    // z rożnem przy przedniej krawędzi (płonie zawsze), stojak z włóczniami, skrzynie z łupem; bez flagi — nie ma pana
    blenderModel(g, BANDITCAMP_MODEL as unknown as BlenderBuilding, flag);
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

/**
 * Mur kamienny z ciosów (jak w Twierdzy): każde pole muru to pełny blok, więc mury postawione obok siebie zlewają się
 * w jeden gruby mur ze wspólnym chodnikiem na górze; blanki stoją tylko na krawędziach, za którymi nie ma muru.
 *  - block: pole muru: cokół, lico, chodnik z kamiennych płyt na górze
 *  - edge: krawędź pola bez sąsiedniego muru (przedpiersie z blankami i gzyms); biegnie wzdłuż x, na zewnątrz = +z
 *  - ladder: drabina oparta o mur od strony twierdzy (tędy łucznicy wchodzą na mur)
 */
export const STONE_WALL_TOP = 1.14;
/** Pomost kamiennej wieży (stoją na nim łucznicy) — z modelu */
/** Wysokość pomostu drewnianej wieży (tu stoją łucznicy) — z tools/models/watchtower.py */
export const WATCH_TOWER_TOP: number = (WATCH_TOWER_MODEL as unknown as { deck?: number }).deck ?? 1.95;
export const STONE_TOWER_TOP: number = (STONE_TOWER_MODEL as unknown as { deck?: number }).deck ?? 2.3;
export function stoneWallKit(): { block: THREE.BufferGeometry; edge: THREE.BufferGeometry; ladder: THREE.BufferGeometry; mat: THREE.Material; wood: THREE.Material } {
  const k = (M.castle.userData.tile as number) || 1;
  const shade = (geo: THREE.BufferGeometry, v: number): THREE.BufferGeometry => {
    const n = geo.getAttribute('position').count, c = new Float32Array(n * 3).fill(v);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  };
  const blk = (w: number, h: number, d: number, x: number, y: number, z: number, v = 1, top = true): THREE.BufferGeometry => {
    let geo: THREE.BufferGeometry = new THREE.BoxGeometry(w, h, d);
    tileBox(geo, w, h, d, k);
    geo = geo.translate(x, y + h / 2, z).toNonIndexed();
    if (!top) {
      // bez górnej i dolnej ściany (BoxGeometry: ściany ±Y to wierzchołki 12–23 po rozwinięciu: 6 na ścianę)
      const pos = geo.getAttribute('position').array as Float32Array, uv = geo.getAttribute('uv').array as Float32Array, nm = geo.getAttribute('normal').array as Float32Array;
      const keep = (a: Float32Array, n: number): Float32Array => new Float32Array([...a.slice(0, 12 * n), ...a.slice(24 * n)]);
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.BufferAttribute(keep(pos, 3), 3));
      g2.setAttribute('normal', new THREE.BufferAttribute(keep(nm, 3), 3));
      g2.setAttribute('uv', new THREE.BufferAttribute(keep(uv, 2), 2));
      geo = g2;
    }
    return shade(geo, v);
  };
  const TOP = STONE_WALL_TOP;
  const block = mergeGeometries([
    blk(1.0, 0.18, 1.0, 0, 0, 0, 0.78, false),
    blk(1.0, TOP - 0.18, 1.0, 0, 0.18, 0, 1, false),
    blk(1.0, 0.02, 1.0, 0, TOP - 0.02, 0, 0.88),            // chodnik
  ])!;
  // krawędź: cokół wystający przed lico, gzyms, przedpiersie i trzy blanki
  const E = 0.5;
  const edge = mergeGeometries([
    blk(1.0, 0.18, 0.06, 0, 0, E + 0.03, 0.72),
    blk(1.0, 0.05, 0.05, 0, TOP - 0.3, E + 0.02, 0.8),
    blk(1.0, 0.14, 0.11, 0, TOP, E - 0.055, 0.95),
    blk(1.0, 0.025, 0.13, 0, TOP + 0.14, E - 0.055, 0.8),
    ...[-0.33, 0, 0.33].map((x) => blk(0.17, 0.19, 0.11, x, TOP + 0.165, E - 0.055, 1)),
    ...[-0.33, 0, 0.33].map((x) => blk(0.19, 0.025, 0.13, x, TOP + 0.355, E - 0.055, 0.78)),
  ])!;
  // drabina oparta o krawędź muru (+z), lekko pochylona
  const lad: THREE.BufferGeometry[] = [];
  const L = TOP + 0.3, lean = -0.3, foot = E + 0.42;
  for (const x of [-0.11, 0.11]) lad.push(shade(new THREE.BoxGeometry(0.035, L, 0.035).translate(0, L / 2, 0).rotateX(lean).translate(x, 0, foot).toNonIndexed(), 0.9));
  for (let y = 0.18; y < L - 0.1; y += 0.2) lad.push(shade(new THREE.BoxGeometry(0.26, 0.025, 0.03).translate(0, y, 0).rotateX(lean).translate(0, 0, foot).toNonIndexed(), 0.75));
  return { block, edge, ladder: mergeGeometries(lad)!, mat: withAo(M.castle), wood: withAo(M.wood) };
}

/** Mokre budynki w deszczu: dachy, drewno i kamień ciemnieją i łapią połysk (odbicia światła), po deszczu schną */
const WET_KEYS = ['thatch', 'thatchDark', 'wood', 'woodDark', 'plank', 'stone', 'stoneDark', 'castle', 'castleDark', 'plaster', 'slate', 'tiles', 'bark'] as const;
const dryState = new Map<THREE.MeshStandardMaterial, { c: THREE.Color; r: number }>();
/** Czy materiał moknie w deszczu (daleka wersja budynku łączy tylko materiały, które mokną tak samo) */
// liście i owoce w sadach: jesienią rude, zimą opadają (pory roku, render/season.ts)
for (const m of [M.leaf, M.leafLight, M.apple, M.appleGreen]) m.userData.season = 'leaf';

export function isWetMat(m: THREE.Material): boolean {
  const mats = M as unknown as Record<string, THREE.Material | undefined>;
  for (const key of WET_KEYS) { const base = mats[key]; if (base && (m === base || m === aoMats.get(base))) return true; }
  return false;
}
export function setWetBuildings(k: number): void {
  const mats = M as unknown as Record<string, THREE.Material | undefined>;
  for (const key of WET_KEYS) {
    const base = mats[key] as THREE.MeshStandardMaterial | undefined;
    if (!base) continue;
    for (const m of [base, aoMats.get(base) as THREE.MeshStandardMaterial | undefined]) {
      if (!m) continue;
      let d = dryState.get(m);
      if (!d) { d = { c: m.color.clone(), r: m.roughness }; dryState.set(m, d); }
      m.color.copy(d.c).multiplyScalar(1 - k * 0.28);
      m.roughness = d.r - (d.r - 0.38) * k;
    }
  }
}

import * as THREE from 'three';
import { cat } from './cat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RESOURCES } from '../data/resources';
import { boxUv } from './peasants';
import { grayPattern, normal, type Kind } from './textures';
import { basketAt, propGeometryFlat, propMaterial } from './props';

/**
 * Materiał części ładunku: zdjęciowa tekstura w szarości (barwę daje kolor wierzchołków) i mapa nierówności.
 * Owoce, ryby i grudki rudy zostają gładkie; drewno, wiklina, płótno, skórka chleba, kamień i żelazo mają fakturę.
 */
type LoadMat = 'plain' | 'wood' | 'board' | 'rope' | 'wicker' | 'cloth' | 'crust' | 'stone' | 'iron' | 'straw' | 'bark' | 'fish' | 'basket';
const MAT_TEX: Record<LoadMat, [Kind | null, number, number, number]> = {
  // [tekstura, gęstość na 1 jednostkę, chropowatość, metaliczność]
  plain: [null, 1, 0.9, 0], wood: ['planks', 5, 0.85, 0], board: [null, 1, 0.8, 0], rope: ['burlap', 14, 1, 0], wicker: ['thatch', 9, 0.95, 0], cloth: ['burlap', 9, 1, 0],
  crust: ['soil', 7, 0.9, 0], stone: ['rock', 5, 0.95, 0], iron: ['iron', 6, 0.5, 0.55], straw: ['thatch', 6, 0.95, 0], bark: ['bark', 6, 0.95, 0],
  fish: [null, 1, 0.42, 0.08], // ryba z paczki: własne UV i tekstura (src/render/props.ts)
  basket: [null, 1, 0.9, 0], // kosz z paczki: własne UV i tekstura
};
const matCache = new Map<LoadMat, THREE.MeshStandardMaterial>();

/**
 * Słoje świeżo heblowanej deski, rysowane w kodzie (szare, barwę daje kolor wierzchołków): długie, lekko falujące
 * słoje wzdłuż deski, ciemniejsze pasma drewna późnego, drobne włókna i jeden sęk z opływającymi go słojami.
 * Zdjęcie `planks` to stara podłoga ze szparami i plamami — na wąskich deskach w wiązce wyglądało jak brudne łaty.
 * Kafel powtarza się w obu kierunkach (całkowite częstotliwości), u = wzdłuż deski.
 */
let boardTex: THREE.CanvasTexture | null | undefined;
function boardGrain(): THREE.CanvasTexture | null {
  if (boardTex !== undefined) return boardTex;
  if (typeof document === 'undefined') return (boardTex = null);
  const W = 512, H = 128, TAU = Math.PI * 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return (boardTex = null);
  const img = ctx.createImageData(W, H), px = img.data;
  const kx = W * 0.68, ky = H * 0.42; // sęk
  let seed = 1234567;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const fine = new Float32Array(H).map(() => rnd() - 0.5); // drobne włókna: stała jasność wzdłuż całej linii
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - kx, dy = y - ky, d2 = dx * dx * 0.12 + dy * dy;
      // słoje falują wzdłuż deski i rozchodzą się wokół sęka
      const bend = 5 * Math.sin((x / W) * TAU + 0.7) + 2.2 * Math.sin((x / W) * TAU * 3 + 2.1) + 14 * Math.sign(dy || 1) * Math.exp(-d2 / 260);
      const t = ((y + bend) / H) * TAU;
      const ring = 0.5 + 0.5 * Math.sin(t * 6 + 0.8 * Math.sin(t * 2 + (x / W) * TAU));
      const late = Math.pow(ring, 7); // wąskie ciemne pasma drewna późnego
      const soft = 0.5 + 0.5 * Math.sin(t * 2 + 1.3);
      const fy = Math.round(y + bend) % H;
      let v = 0.94 - 0.16 * late - 0.05 * soft + fine[(fy + H) % H]! * 0.07 + (rnd() - 0.5) * 0.025;
      if (d2 < 60) v -= 0.3 * (1 - d2 / 60) * (0.75 + 0.25 * Math.sin(Math.sqrt(d2) * 2.2)); // sęk
      const g = Math.max(0, Math.min(255, Math.round(v * 255)));
      const i = (y * W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = g; px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return (boardTex = tex);
}

/** Współrzędne tekstury deski: u zawsze wzdłuż deski (oś z), v w poprzek; każda deska z innego miejsca kafla */
function boardUv(geo: THREE.BufferGeometry): void {
  const p = geo.attributes.position!, n = geo.attributes.normal!;
  geo.computeBoundingBox();
  const b = geo.boundingBox!, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
  const off = Math.abs(Math.sin(cx * 913.1 + cy * 377.7 + cz * 151.3) * 43758.5) % 1; // stałe przesunięcie na deskę
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // wierzch i spód: słoje na szerokości deski (x); boki: na grubości (y); czoła: przekrój (słoje w poprzek)
    const [u, v] = az > ax && az > ay ? [x * 3 + off, y * 3] : ay >= ax ? [z * 1.6 + off, (x - cx) * 4 + off] : [z * 1.6 + off, (y - cy) * 4 + off * 0.5];
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function loadMat(k: LoadMat): THREE.MeshStandardMaterial {
  let m = matCache.get(k);
  if (!m && (k === 'fish' || k === 'basket')) { m = propMaterial(k); matCache.set(k, m); }
  if (!m && k === 'board') {
    const g = boardGrain();
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, map: g, bumpMap: g, bumpScale: 0.6 });
    matCache.set(k, m);
  }
  if (!m) {
    const [tex, , rough, metal] = MAT_TEX[k];
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: k === 'stone' || k === 'iron',
      map: tex ? grayPattern(tex) : null, normalMap: tex ? normal(tex) : null, normalScale: new THREE.Vector2(0.7, 0.7) });
    matCache.set(k, m);
  }
  return m;
}
/** Oznacza część ładunku materiałem */
const as = (g: THREE.BufferGeometry, k: LoadMat): THREE.BufferGeometry => { g.userData.mat = k; return g; };
/** Składa części w jedną bryłę z grupami według materiału (współrzędne tekstury z rzutu na ściany) */
function assemble(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const by = new Map<LoadMat, THREE.BufferGeometry[]>();
  for (const p0 of parts) {
    const k = (p0.userData.mat as LoadMat | undefined) ?? 'plain';
    const p = p0.index ? p0.toNonIndexed() : p0;
    if (!p.getAttribute('normal')) p.computeVertexNormals();
    if (k === 'board') boardUv(p); else if (k !== 'fish' && k !== 'basket') boxUv(p, MAT_TEX[k][1]);
    for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(name)) p.deleteAttribute(name);
    let l = by.get(k); if (!l) { l = []; by.set(k, l); } l.push(p);
  }
  const keys = [...by.keys()];
  const geo = mergeGeometries(keys.map((k) => mergeGeometries(by.get(k)!)!), true);
  if (geo) geo.userData.mats = keys;
  return geo;
}
/** Materiały w kolejności grup bryły ładunku (z assemble) */
export function loadMaterials(geo: THREE.BufferGeometry): THREE.Material[] {
  return ((geo.userData.mats as LoadMat[] | undefined) ?? ['plain']).map(loadMat);
}

/** Maluje całą bryłę jednym kolorem (kolor siedzi w wierzchołkach, więc jeden model może mieć kilka barw). */
export function tint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const ball = (r: number, x: number, y: number, z: number, hex: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry =>
  tint(new THREE.IcosahedronGeometry(r, 1).scale(sx, sy, sz).translate(x, y, z), hex);
// kosz z paczki (Poly Haven wicker_basket_02, src/render/props.ts) w wymiarach dawnego: szerokość 0,23, dno w -0,065,
// brzeg w 0,065 — mieści się między dłońmi (ręce chłopa są ±0,135 od środka), dłonie obejmują go z boków
const basket = (): THREE.BufferGeometry => as(basketAt(0, -0.065, 0, 0.23, 0.13, 0.4), 'basket');

/**
 * Jak wygląda ładunek niesiony przez chłopa, osobno dla każdego surowca.
 * Początek układu = środek ładunku; scena ustawia go nad głową albo w rękach.
 */
const SHAPES: Record<string, () => THREE.BufferGeometry[]> = {
  apples: () => [basket(), ...[0, 1, 2, 3, 4, 5].map((k) => ball(0.045, Math.cos(k * 1.05) * 0.06, 0.08, Math.sin(k * 1.05) * 0.06, k % 3 ? 0xd0281f : 0xa9c23f)), ball(0.05, 0, 0.11, 0, 0xd0281f)],
  bread: () => [basket(), ...[-0.06, 0.06].map((x) => as(ball(0.07, x, 0.09, 0, 0xc9843d, 0.8, 0.7, 1.6), 'crust')), as(ball(0.06, 0, 0.14, 0.02, 0xd99a4f, 1.5, 0.7, 0.8), 'crust')],
  // snop zboża niesiony w poprzek na rękach (jak w stodole): pęk źdźbeł przewiązany powrósłem, z jednej strony
  // rozchylone ścięte końce, z drugiej opadające kłosy
  wheat: () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + (k % 2) * 0.2, r = 0.022 + (k % 3) * 0.008;
      const y = Math.sin(a) * r + 0.04, z = Math.cos(a) * r;
      // źdźbło wzdłuż x: przy kłosach ściśnięte, przy ściętym końcu lekko rozchylone
      const stalk = new THREE.CylinderGeometry(0.007, 0.006, 0.3, 3).rotateZ(Math.PI / 2).rotateY(Math.cos(a) * 0.12).rotateZ(Math.sin(a) * 0.12);
      parts.push(as(tint(stalk.translate(-0.02, y, z), k % 2 ? 0xd9b452 : 0xc9a240), 'straw'));
      const ear = new THREE.IcosahedronGeometry(0.015, 0).scale(2.4, 0.75, 0.75).rotateY(Math.cos(a) * 0.4).rotateZ(-0.25 + Math.sin(a) * 0.3);
      parts.push(as(tint(ear.translate(0.15 + (k % 3) * 0.008, y - 0.01, z * 1.4), k % 3 ? 0xe8c766 : 0xd4ad4a), 'straw'));
    }
    parts.push(as(tint(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 10).rotateZ(Math.PI / 2).translate(0.02, 0.04, 0), 0x8a6a28), 'straw')); // powrósło
    return parts;
  },
  // worek mąki z płótna: pękaty u dołu, zwężony i przewiązany sznurkiem pod szyjką, z wywiniętym brzegiem;
  // fałdy płótna i biały pył mąki na wierzchu (ten sam kształt co worki w spichlerzu)
  flour: () => {
    const prof = [[0, 0], [0.075, 0], [0.105, 0.025], [0.116, 0.075], [0.112, 0.14], [0.095, 0.195], [0.06, 0.232], [0.03, 0.248], [0.028, 0.258], [0.046, 0.285], [0.034, 0.3], [0, 0.302]].map(([x, y]) => new THREE.Vector2(x, y));
    const sack = new THREE.LatheGeometry(prof, 14).scale(1.05, 1, 0.92);
    const p = sack.attributes.position!;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z);
      // fałdy: płótno marszczy się pionowo, mocniej u góry pod sznurkiem
      const fold = 1 + Math.sin(a * 7) * 0.05 * Math.min(1, y / 0.2);
      p.setXYZ(i, x * fold, y - 0.15, z * fold);
      const shade = (0.82 + 0.18 * Math.min(1, y / 0.12)) * (0.94 + Math.sin(a * 7) * 0.06);
      c.setHex(y > 0.27 ? 0xf2ede0 : 0xcdb68a).multiplyScalar(y > 0.27 ? 1 : shade);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    sack.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sack.computeVertexNormals();
    return [as(sack, 'cloth'), as(tint(new THREE.TorusGeometry(0.032, 0.008, 4, 12).rotateX(Math.PI / 2).translate(0, 0.252 - 0.15, 0), 0x7a5a32), 'cloth')];
  },
  // ciosany blok z kamieniołomu: nieregularna bryła z płaskimi ścianami po ciosaniu, odpryski na krawędziach,
  // barwa szara z jaśniejszymi i ciemniejszymi płatami (płaskie cieniowanie daje ostre ściany jak u prawdziwego kamienia)
  stone: () => {
    // (dwudziestościan w three.js nie ma indeksów: każdy trójkąt ma własne wierzchołki; zniekształcenie liczone
    // z położenia, więc wspólne rogi sąsiednich trójkątów przesuwają się tak samo i bryła zostaje szczelna)
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position!;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const rnd = (a: number): number => { const j = Math.sin(a) * 43758.5; return j - Math.floor(j); };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // ściany ciosane: punkty dociągnięte do płaszczyzn prostopadłościanu (blok), z drobną nierównością
      const k = 1 / Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      const n = rnd(Math.round(x * 1000) * 12.9 + Math.round(y * 1000) * 78.2 + Math.round(z * 1000) * 37.7);
      const f = 0.62 + 0.38 * k * 0.72 + (n - 0.5) * 0.12;
      p.setXYZ(i, x * f * 0.11, y * f * 0.075 + 0.03, z * f * 0.09);
    }
    // kolor płatami: każdy trójkąt w jednym odcieniu — wygląda jak różne warstwy skały
    for (let t = 0; t < p.count; t += 3) {
      const n = rnd(t * 3.7 + 1.3);
      c.setHex(n > 0.7 ? 0xc2bdb0 : n > 0.35 ? 0xaaa597 : 0x928d80);
      for (let v = 0; v < 3; v++) { col[(t + v) * 3] = c.r; col[(t + v) * 3 + 1] = c.g; col[(t + v) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return [as(g, 'stone')];
  },
  // kosz z trzema rybami z paczki (tools/models/props_import.py), leżą na boku W koszu: dwie obok siebie na dnie
  // (dno kosza ok. -0,06, ryba długości 0,2 ma 0,09 wysokości i 0,044 grubości), trzecia na nich, odwrócona łbem w drugą
  // stronę; wierzch trzeciej wystaje trochę ponad brzeg (0,065), żeby z góry było widać, co niesie
  fish: () => [basket(), ...([[0, -0.038, -0.046, 0.06, 1, 0], [0, -0.038, 0.046, -0.06, -1, 0], [0.005, 0.01, 0, 0.12, 1, Math.PI]] as const).map(([x, y, z, yaw, side, turn]) =>
    as(propGeometryFlat('fish', true).scale(0.2, 0.2, 0.2).rotateZ(side * Math.PI / 2).rotateY(Math.PI / 2 + yaw + turn).translate(x, y, z), 'fish'))],
  // wiązka włóczni na prawym ramieniu (jak deski): trzy drzewca z grotami w przód i lekko w górę, przewiązane sznurem
  spear: () => [0, 1, 2].flatMap((k) => {
    const x = (k - 1) * 0.022, y = (k === 1 ? 0.02 : 0);
    const tilt = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(-0.28).translate(x, y, 0);
    return [
      as(tint(tilt(new THREE.CylinderGeometry(0.009, 0.01, 0.72, 5).rotateX(Math.PI / 2).translate(0, 0, 0.04)), k === 1 ? 0xb88f5c : 0xa67f50), 'wood'),
      as(tint(tilt(new THREE.OctahedronGeometry(1, 0).scale(0.018, 0.006, 0.055).translate(0, 0, 0.45)), 0x9aa0a8), 'iron'),
      as(tint(tilt(new THREE.CylinderGeometry(0.011, 0.012, 0.03, 5).rotateX(Math.PI / 2).translate(0, 0, 0.395)), 0x7a7f86), 'iron'),
    ];
  }).concat([-0.1, 0.12].map((z) => as(tint(new THREE.TorusGeometry(0.026, 0.006, 4, 10).translate(0, 0, z).rotateX(-0.28).translate(0, 0.01, 0), 0x6b5a3c), 'cloth'))),
  bow: () => [0, 1].flatMap((k) => [as(tint(new THREE.TorusGeometry(0.18, 0.012, 4, 10, Math.PI * 0.9).rotateX(Math.PI / 2).translate(0, 0.02 + k * 0.03, -0.05), 0x7a5232), 'wood'), tint(new THREE.CylinderGeometry(0.004, 0.004, 0.34, 3).rotateZ(Math.PI / 2).translate(0, 0.02 + k * 0.03, -0.03), 0xe8e0c8)]),
  // ruda (waluta, w kodzie 'gold'): kosz pełen ciemnych brył z jasnoniebieskimi, połyskującymi grudkami jak w Gothicu
  gold: () => [basket(), ...[[-0.05, 0.1, -0.03, 0x3e424e], [0.05, 0.1, 0.03, 0x4a4e5c], [0, 0.14, -0.01, 0x8fd3ff], [0.02, 0.13, 0.05, 0x3a3d48], [-0.03, 0.15, 0.04, 0x7cc4f0]].map(([x, y, z, c]) => { const b = ball(0.045, x as number, y as number, z as number, c as number, 1.1, 0.8, 0.9); return (c as number) > 0x700000 ? b : as(b, 'stone'); })],
  ale: () => [as(tint(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10).rotateZ(Math.PI / 2).translate(0, 0.04, 0), 0x8a5a2b), 'wood'), ...[-0.1, 0, 0.1].map((x) => as(tint(new THREE.CylinderGeometry(0.128, 0.128, 0.02, 10).rotateZ(Math.PI / 2).translate(x, 0.04, 0), 0x4a4038), 'iron'))],
  // sztaby żelaza jak w składzie: trapezowe odlewy (szersze u dołu), dwie na spodzie i jedna na wierzchu, w poprzek rąk
  iron: () => {
    // sztaby z kuźni: trapezowe odlewy, stal ciemna z rdzawobrązowymi zaciekami (żelazo bez ochrony szybko rdzewieje)
    const bar = (x: number, y: number, z: number, seed: number): THREE.BufferGeometry => {
      const g = new THREE.CylinderGeometry(0.035, 0.055, 0.3, 4, 3).rotateY(Math.PI / 4).scale(1, 0.6, 1).rotateZ(Math.PI / 2).translate(x, y, z);
      const n = g.index ? g.toNonIndexed() : g;
      const p = n.attributes.position!, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let t = 0; t < p.count; t += 3) {
        const r = Math.sin((t + seed * 97) * 12.989) * 43758.5; const v = r - Math.floor(r);
        c.setHex(v > 0.86 ? 0x5f4433 : v > 0.7 ? 0x4e423a : v > 0.35 ? 0x484a50 : 0x3e4046);
        for (let k = 0; k < 3; k++) { col[(t + k) * 3] = c.r; col[(t + k) * 3 + 1] = c.g; col[(t + k) * 3 + 2] = c.b; }
      }
      n.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return as(n, 'iron');
    };
    return [bar(0, 0, -0.045, 1), bar(0, 0, 0.045, 2), bar(0, 0.05, 0, 3)];
  },
};

/** Tworzy po jednej siatce instancjonowanej na surowiec. Zwraca indeks surowca → siatka. */
export function createLoads(max: number, scene: THREE.Scene): Map<number, THREE.InstancedMesh> {
  const out = new Map<number, THREE.InstancedMesh>();
  RESOURCES.forEach((id, index) => {
    // niesione oburącz przed sobą: ręce zgięte w przód (CARRY_ARM), ładunek leży na dłoniach przed piersią
    const geo = loadGeometry(id);
    if (!geo) return;
    const mesh = new THREE.InstancedMesh(geo, loadMaterials(geo), max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    scene.add(cat(mesh, 'niesione ładunki'));
    out.set(index, mesh);
  });
  // grabarz niesie ciało owinięte w płótno (znacznik poza listą surowców)
  const shroud = assemble([
    as(tint(new THREE.CapsuleGeometry(0.09, 0.42, 3, 8).rotateZ(Math.PI / 2).translate(0, 0.05, 0), 0xd8cfb8), 'cloth'),
    as(tint(new THREE.TorusGeometry(0.092, 0.012, 4, 10).rotateY(Math.PI / 2).translate(-0.12, 0.05, 0), 0x6b5a3c), 'cloth'),
    as(tint(new THREE.TorusGeometry(0.092, 0.012, 4, 10).rotateY(Math.PI / 2).translate(0.14, 0.05, 0), 0x6b5a3c), 'cloth'),
  ])!;
  shroud.translate(0.1, 0.5, 0);
  const sm = new THREE.InstancedMesh(shroud, loadMaterials(shroud), max);
  sm.count = 0; sm.frustumCulled = false; sm.castShadow = true;
  scene.add(cat(sm, 'niesione ładunki'));
  out.set(RESOURCES.length, sm);
  return out;
}

/** Ładunki niesione na prawym ramieniu (prawa ręka przytrzymuje), a nie oburącz przed sobą */
export const ON_SHOULDER = new Set(['spear']);
const LOAD_SCALE: Record<string, number> = { flour: 0.7, iron: 0.75, stone: 0.8, ale: 0.75, wheat: 0.85, bow: 0.85 };

/** Ręce chłopa niosącego ładunek: zgięte w przód pod kątem, dłonie pod ładunkiem przed piersią (ładunek nad dłońmi) */
export const CARRY_ARM = -1.1;
/**
 * Kąty rąk przy niesieniu [prawa, lewa]: zwykły ładunek oburącz przed sobą; deski na prawym ramieniu —
 * prawa ręka w górze przytrzymuje wiązkę, lewa macha jak przy chodzie (`swing` = wymach kroku).
 */
export function carryArms(planks: boolean, swing: number): [number, number] {
  return planks ? [-2.35, swing * 0.8] : [CARRY_ARM, CARRY_ARM];
}

/** Wiązka desek na prawym ramieniu: kilka cienkich, lekko przesuniętych desek z dwiema przewiązkami ze sznura */
export function plankBundle(): THREE.BufferGeometry {
  const boards: THREE.BufferGeometry[] = [];
  // świeża sosna w kilku odcieniach (ciepły miód do przybrudzonego brązu), bez jasnej żółci
  ([[-0.045, 0, 0.02, 0xb98a58], [0.045, 0, -0.03, 0xa8794b], [0, 0.03, 0.04, 0xc29462], [-0.045, 0.06, -0.02, 0xae8050], [0.045, 0.06, 0.01, 0xbb8c5a]] as const).forEach(([x, y, z, c]) => {
    const b = new THREE.BoxGeometry(0.042, 0.018, 0.5); b.translate(x * 0.45, y * 0.75, z); boards.push(as(tint(b, c), 'board'));
  });
  // sznur owinięty dookoła wiązki (cienki, ciemny), a nie gruba płócienna opaska
  for (const z of [-0.16, 0.15]) for (const dz of [-0.007, 0.007]) {
    const tie = new THREE.BoxGeometry(0.092, 0.072, 0.009); tie.translate(0, 0.022, z + dz); boards.push(as(tint(tie, dz < 0 ? 0x5b4632 : 0x4f3d2b), 'rope'));
  }
  const plank = assemble(boards)!;
  // wąska wiązka na barku między głową a ręką (bark ±0,135, głowa ±0,054): ręka idzie obok, dłoń przytrzymuje z boku od góry
  plank.translate(0.09, 0.495, 0);
  return plank;
}

/** Jeden ładunek jako zwykła siatka (podgląd modeli): ten sam kształt i położenie co w grze, w układzie postaci */
export function loadGeometry(res: string): THREE.BufferGeometry | null {
  const parts = SHAPES[res]?.();
  if (!parts) return null;
  const geo = assemble(parts);
  // duże ładunki mniejsze, w proporcji do chłopa (worek mąki nie wielkości tułowia); kosze zostają, żeby dłonie je obejmowały
  const k = LOAD_SCALE[res] ?? 1;
  geo?.scale(k, k, k);
  // włócznie na ramieniu (jak deski), reszta na dłoniach przed piersią
  if (ON_SHOULDER.has(res)) geo?.translate(0.09, 0.5, 0); else geo?.translate(0, 0.33, 0.12);
  return geo;
}

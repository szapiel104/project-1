import * as THREE from 'three';
import { cat } from './cat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RESOURCES } from '../data/resources';

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
// kosz mieści się między dłońmi (ręce chłopa są ±0,135 od środka): dłonie obejmują go z boków, a nie wchodzą w środek
const basket = (): THREE.BufferGeometry => tint(new THREE.CylinderGeometry(0.115, 0.09, 0.13, 10).translate(0, 0, 0), 0xb08a4e);

/**
 * Jak wygląda ładunek niesiony przez chłopa, osobno dla każdego surowca.
 * Początek układu = środek ładunku; scena ustawia go nad głową albo w rękach.
 */
const SHAPES: Record<string, () => THREE.BufferGeometry[]> = {
  apples: () => [basket(), ...[0, 1, 2, 3, 4, 5].map((k) => ball(0.045, Math.cos(k * 1.05) * 0.06, 0.08, Math.sin(k * 1.05) * 0.06, k % 3 ? 0xd0281f : 0xa9c23f)), ball(0.05, 0, 0.11, 0, 0xd0281f)],
  bread: () => [basket(), ...[-0.06, 0.06].map((x) => ball(0.07, x, 0.09, 0, 0xc9843d, 0.8, 0.7, 1.6)), ball(0.06, 0, 0.14, 0.02, 0xd99a4f, 1.5, 0.7, 0.8)],
  // snop zboża niesiony w poprzek na rękach (jak w stodole): pęk źdźbeł przewiązany powrósłem, z jednej strony
  // rozchylone ścięte końce, z drugiej opadające kłosy
  wheat: () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + (k % 2) * 0.2, r = 0.022 + (k % 3) * 0.008;
      const y = Math.sin(a) * r + 0.04, z = Math.cos(a) * r;
      // źdźbło wzdłuż x: przy kłosach ściśnięte, przy ściętym końcu lekko rozchylone
      const stalk = new THREE.CylinderGeometry(0.007, 0.006, 0.3, 3).rotateZ(Math.PI / 2).rotateY(Math.cos(a) * 0.12).rotateZ(Math.sin(a) * 0.12);
      parts.push(tint(stalk.translate(-0.02, y, z), k % 2 ? 0xd9b452 : 0xc9a240));
      const ear = new THREE.IcosahedronGeometry(0.015, 0).scale(2.4, 0.75, 0.75).rotateY(Math.cos(a) * 0.4).rotateZ(-0.25 + Math.sin(a) * 0.3);
      parts.push(tint(ear.translate(0.15 + (k % 3) * 0.008, y - 0.01, z * 1.4), k % 3 ? 0xe8c766 : 0xd4ad4a));
    }
    parts.push(tint(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 10).rotateZ(Math.PI / 2).translate(0.02, 0.04, 0), 0x8a6a28)); // powrósło
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
    return [sack, tint(new THREE.TorusGeometry(0.032, 0.008, 4, 12).rotateX(Math.PI / 2).translate(0, 0.252 - 0.15, 0), 0x7a5a32)];
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
    return [g];
  },
  fish: () => [basket(), ...[-0.05, 0.05].map((x, k) => ball(0.05, x, 0.09, k ? 0.03 : -0.03, 0x9cc3d6, 0.7, 0.6, 2.2)), ball(0.045, 0, 0.13, 0, 0x7aa6bd, 2.2, 0.6, 0.7)],
  // wiązka włóczni na prawym ramieniu (jak deski): trzy drzewca z grotami w przód i lekko w górę, przewiązane sznurem
  spear: () => [0, 1, 2].flatMap((k) => {
    const x = (k - 1) * 0.022, y = (k === 1 ? 0.02 : 0);
    const tilt = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(-0.28).translate(x, y, 0);
    return [
      tint(tilt(new THREE.CylinderGeometry(0.009, 0.01, 0.72, 5).rotateX(Math.PI / 2).translate(0, 0, 0.04)), k === 1 ? 0xb88f5c : 0xa67f50),
      tint(tilt(new THREE.OctahedronGeometry(1, 0).scale(0.018, 0.006, 0.055).translate(0, 0, 0.45)), 0x9aa0a8),
      tint(tilt(new THREE.CylinderGeometry(0.011, 0.012, 0.03, 5).rotateX(Math.PI / 2).translate(0, 0, 0.395)), 0x7a7f86),
    ];
  }).concat([-0.1, 0.12].map((z) => tint(new THREE.TorusGeometry(0.026, 0.006, 4, 10).translate(0, 0, z).rotateX(-0.28).translate(0, 0.01, 0), 0x6b5a3c))),
  bow: () => [0, 1].flatMap((k) => [tint(new THREE.TorusGeometry(0.18, 0.012, 4, 10, Math.PI * 0.9).rotateX(Math.PI / 2).translate(0, 0.02 + k * 0.03, -0.05), 0x7a5232), tint(new THREE.CylinderGeometry(0.004, 0.004, 0.34, 3).rotateZ(Math.PI / 2).translate(0, 0.02 + k * 0.03, -0.03), 0xe8e0c8)]),
  ale: () => [tint(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10).rotateZ(Math.PI / 2).translate(0, 0.04, 0), 0x8a5a2b), ...[-0.1, 0, 0.1].map((x) => tint(new THREE.CylinderGeometry(0.128, 0.128, 0.02, 10).rotateZ(Math.PI / 2).translate(x, 0.04, 0), 0x4a4038))],
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
      return n;
    };
    return [bar(0, 0, -0.045, 1), bar(0, 0, 0.045, 2), bar(0, 0.05, 0, 3)];
  },
};

/** Tworzy po jednej siatce instancjonowanej na surowiec. Zwraca indeks surowca → siatka. */
export function createLoads(max: number, scene: THREE.Scene): Map<number, THREE.InstancedMesh> {
  const out = new Map<number, THREE.InstancedMesh>();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // kute żelazo: metal z połyskiem, ciemne i rdzawe plamy w kolorach wierzchołków
  const ironMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0.55 });
  RESOURCES.forEach((id, index) => {
    // niesione oburącz przed sobą: ręce zgięte w przód (CARRY_ARM), ładunek leży na dłoniach przed piersią
    const geo = loadGeometry(id);
    if (!geo) return;
    const mesh = new THREE.InstancedMesh(geo, id === 'iron' ? ironMat : mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    scene.add(cat(mesh, 'niesione ładunki'));
    out.set(index, mesh);
  });
  // grabarz niesie ciało owinięte w płótno (znacznik poza listą surowców)
  const shroud = mergeGeometries([
    tint(new THREE.CapsuleGeometry(0.09, 0.42, 3, 8).rotateZ(Math.PI / 2).translate(0, 0.05, 0), 0xd8cfb8),
    tint(new THREE.TorusGeometry(0.092, 0.012, 4, 10).rotateY(Math.PI / 2).translate(-0.12, 0.05, 0), 0x6b5a3c),
    tint(new THREE.TorusGeometry(0.092, 0.012, 4, 10).rotateY(Math.PI / 2).translate(0.14, 0.05, 0), 0x6b5a3c),
  ].map((p) => (p.index ? p.toNonIndexed() : p)))!;
  shroud.translate(0.1, 0.5, 0);
  const sm = new THREE.InstancedMesh(shroud, mat, max);
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

/** Wiązka desek na prawym ramieniu: kilka cienkich, lekko przesuniętych desek z dwiema przewiązkami */
export function plankBundle(): THREE.BufferGeometry {
  const boards: THREE.BufferGeometry[] = [];
  ([[-0.045, 0, 0.02, 0xd2ab74], [0.045, 0, -0.03, 0xc49a63], [0, 0.03, 0.04, 0xdcb886], [-0.045, 0.06, -0.02, 0xcca26c], [0.045, 0.06, 0.01, 0xd8b07a]] as const).forEach(([x, y, z, c]) => {
    const b = new THREE.BoxGeometry(0.042, 0.018, 0.5); b.translate(x * 0.45, y * 0.75, z); boards.push(tint(b, c));
  });
  for (const z of [-0.15, 0.15]) { const tie = new THREE.BoxGeometry(0.09, 0.07, 0.02); tie.translate(0, 0.022, z); boards.push(tint(tie, 0x8a6a3a)); }
  const plank = mergeGeometries(boards.map((b) => (b.index ? b.toNonIndexed() : b)))!;
  // wąska wiązka na barku między głową a ręką (bark ±0,135, głowa ±0,054): ręka idzie obok, dłoń przytrzymuje z boku od góry
  plank.translate(0.09, 0.495, 0);
  return plank;
}

/** Jeden ładunek jako zwykła siatka (podgląd modeli): ten sam kształt i położenie co w grze, w układzie postaci */
export function loadGeometry(res: string): THREE.BufferGeometry | null {
  const parts = SHAPES[res]?.();
  if (!parts) return null;
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  // duże ładunki mniejsze, w proporcji do chłopa (worek mąki nie wielkości tułowia); kosze zostają, żeby dłonie je obejmowały
  const k = LOAD_SCALE[res] ?? 1;
  geo?.scale(k, k, k);
  // włócznie na ramieniu (jak deski), reszta na dłoniach przed piersią
  if (ON_SHOULDER.has(res)) geo?.translate(0.09, 0.5, 0); else geo?.translate(0, 0.33, 0.12);
  return geo;
}

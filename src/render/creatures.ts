import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Szum z położenia (ten sam dla zdublowanych wierzchołków na szwach, więc futro się nie rozchodzi) */
const noise = (x: number, y: number, z: number): number => {
  const v = Math.sin(Math.round(x * 1e4) * 0.01271 + Math.round(y * 1e4) * 0.03117 + Math.round(z * 1e4) * 0.00747) * 43758.5453;
  return v - Math.floor(v);
};

/** Gładkie normalne także na szwach i w siatkach bez indeksu: uśrednione po wierzchołkach w tym samym miejscu */
function smooth(geo: THREE.BufferGeometry): THREE.BufferAttribute {
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const key = (i: number): string => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const sum = new Map<string, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i), v = sum.get(k) ?? new THREE.Vector3();
    v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i); sum.set(k, v);
  }
  for (let i = 0; i < pos.count; i++) { const v = sum.get(key(i))!.clone().normalize(); nor.setXYZ(i, v.x, v.y, v.z); }
  return nor;
}

/** Kudłate futro: wierzchołki wypchnięte losowo wzdłuż normalnej */
function shaggy(geo: THREE.BufferGeometry, amp: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position'), nor = smooth(geo);
  for (let i = 0; i < pos.count; i++) {
    const d = (noise(pos.getX(i), pos.getY(i), pos.getZ(i)) - 0.35) * amp;
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d);
  }
  smooth(geo);
  return geo;
}

/** Kolor z położenia i normalnej (grzbiet ciemny, brzuch jasny) plus drobne plamki jasności */
function paint(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number, ny: number) => THREE.Color, speck = 0.08): THREE.BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const c = fn(x, y, z, nor.getY(i));
    const k = 1 + (noise(x * 3.1, y * 2.7, z * 3.3) - 0.5) * 2 * speck;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Walec od punktu a do punktu b (promień ra przy a, rb przy b) */
function seg(a: [number, number, number], b: [number, number, number], ra: number, rb: number, sides = 7): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), h = d.length();
  const geo = new THREE.CylinderGeometry(rb, ra, h, sides, 2).translate(0, h / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return geo.translate(...a);
}

const ell = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, detail = 3): THREE.BufferGeometry =>
  new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z);

const C = (hex: number): THREE.Color => new THREE.Color(hex);
const mix = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

/** Wilk z części: tułów z łbem, łapa przednia i tylna (oś w barku/biodrze), kita (oś u nasady), oczy. Wspólne dla gry i galerii. */
export function wolfParts(): { body: THREE.BufferGeometry; leg: THREE.BufferGeometry; hindLeg: THREE.BufferGeometry; tail: THREE.BufferGeometry; eyes: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial } {
  // szary wilk: ciemne siodło na grzbiecie, płowe boki, jasny brzuch, pysk i policzki
  const SADDLE = C(0x37342f), SIDE = C(0x6a655c), BELLY = C(0xa9a08e), DARK = C(0x26231f), TAN = C(0x7a6e5e);
  const coat = (_x: number, _y: number, _z: number, ny: number): THREE.Color =>
    ny > 0.35 ? mix(SIDE, SADDLE, (ny - 0.35) / 0.5) : ny < -0.15 ? mix(SIDE, BELLY, (-ny - 0.15) / 0.6) : SIDE;
  const legCoat = (_x: number, y: number, _z: number, ny: number): THREE.Color => mix(coat(0, 0, 0, ny), TAN, Math.min(0.7, (-0.12 - y) / 0.2));
  const body = mergeGeometries([
    paint(shaggy(ell(0.1, 0.8, 1, 1.28, 0, 0.345, 0.09), 0.009), coat), // głęboka klatka
    paint(shaggy(ell(0.075, 0.78, 0.82, 1.5, 0, 0.36, -0.07), 0.008), coat), // wcięty brzuch
    paint(shaggy(ell(0.085, 0.88, 0.98, 1.05, 0, 0.355, -0.18), 0.008), coat), // zad
    paint(shaggy(ell(0.076, 0.95, 1.08, 1.05, 0, 0.425, 0.19), 0.016), (x, y, z, ny) => mix(coat(x, y, z, ny), SADDLE, 0.25)), // kudłaty kark (grzywa)
    paint(shaggy(seg([0, 0.41, 0.17], [0, 0.48, 0.28], 0.058, 0.046, 9), 0.012), coat), // szyja
    paint(shaggy(ell(0.056, 1, 0.88, 1.05, 0, 0.495, 0.3), 0.006), (x, y, z, ny) => mix(coat(x, y, z, ny), SIDE, 0.3)), // czaszka
    paint(shaggy(ell(0.033, 1, 1, 1, -0.038, 0.47, 0.295, 1), 0.012), () => BELLY), // jasne policzki
    paint(shaggy(ell(0.033, 1, 1, 1, 0.038, 0.47, 0.295, 1), 0.012), () => BELLY),
    paint(seg([0, 0.482, 0.33], [0, 0.468, 0.435], 0.031, 0.017, 8), (_x, _y, _z, ny) => (ny > 0.2 ? mix(SIDE, SADDLE, 0.3) : BELLY)), // długi pysk
    paint(seg([0, 0.457, 0.335], [0, 0.449, 0.418], 0.024, 0.012, 7), () => BELLY), // żuchwa
    paint(ell(0.013, 1.1, 0.85, 1, 0, 0.472, 0.437, 1), () => C(0x151311), 0), // nos
    paint(new THREE.ConeGeometry(0.027, 0.072, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).rotateX(-0.22).rotateZ(0.18).translate(-0.034, 0.56, 0.285), () => SADDLE), // uszy
    paint(new THREE.ConeGeometry(0.027, 0.072, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).rotateX(-0.22).rotateZ(-0.18).translate(0.034, 0.56, 0.285), () => SADDLE),
  ])!;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  // łapa przednia: ramię, przedramię, nadgarstek i łapa
  const leg = mergeGeometries([
    paint(shaggy(seg([0, 0.03, 0], [0, -0.17, 0.012], 0.036, 0.022), 0.006), legCoat),
    paint(seg([0, -0.17, 0.012], [0, -0.31, 0], 0.02, 0.014, 6), legCoat),
    paint(seg([0, -0.31, 0], [0, -0.335, 0.012], 0.014, 0.013, 6), () => TAN),
    paint(ell(0.02, 1, 0.6, 1.4, 0, -0.34, 0.02, 1), () => DARK, 0.04),
  ])!;
  // łapa tylna: mocne udo, goleń w tył, skok i śródstopie w przód
  const hindLeg = mergeGeometries([
    paint(shaggy(ell(0.05, 0.72, 1.3, 1, 0, -0.06, 0.005), 0.01), legCoat),
    paint(seg([0, -0.09, 0.02], [0, -0.2, -0.05], 0.03, 0.019, 6), legCoat),
    paint(seg([0, -0.2, -0.05], [0, -0.335, -0.012], 0.016, 0.013, 6), () => TAN),
    paint(ell(0.02, 1, 0.6, 1.4, 0, -0.348, 0.005, 1), () => DARK, 0.04),
  ])!;
  // puszysta kita z ciemnym końcem (oś u nasady, zwisa w dół)
  const tailGeo = new THREE.LatheGeometry([[0.001, 0], [0.016, 0.014], [0.034, 0.05], [0.044, 0.12], [0.04, 0.2], [0.03, 0.26], [0.02, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 9).translate(0, -0.3, 0);
  const tail = paint(shaggy(tailGeo, 0.016), (_x, y, _z, ny) => (y < -0.25 ? DARK : mix(coat(0, 0, 0, ny), SADDLE, 0.2)));
  const eyes = mergeGeometries([new THREE.SphereGeometry(0.009, 6, 4).translate(-0.03, 0.502, 0.343), new THREE.SphereGeometry(0.009, 6, 4).translate(0.03, 0.502, 0.343)])!;
  return { body, leg, hindLeg, tail, eyes, mat };
}

/** Barki i biodra wilka (x, y, z) — tam zaczepione są łapy: dwie przednie, potem dwie tylne */
export const WOLF_HIPS: [number, number, number][] = [[-0.048, 0.35, 0.12], [0.048, 0.35, 0.12], [-0.05, 0.36, -0.19], [0.05, 0.36, -0.19]];
/** Nasada ogona */
export const WOLF_TAIL: [number, number, number] = [0, 0.385, -0.25];

/** Kruk: tułów z pierśmi, łeb z grubym zakrzywionym dziobem, złożone skrzydła z lotkami, klinowy ogon, nogi z palcami */
export function crowGeometry(): THREE.BufferGeometry {
  // czarny z granatowo-fioletowym połyskiem na grzbiecie i skrzydłach
  const BLACK = C(0x111116), SHEEN = C(0x2a2d44), BEAK = C(0x1d1d20), LEG = C(0x26262a);
  const plumage = (_x: number, _y: number, _z: number, ny: number): THREE.Color => mix(BLACK, SHEEN, (ny - 0.1) / 0.8);
  const wing = (side: number): THREE.BufferGeometry[] => [
    paint(shaggy(ell(0.05, 0.2, 0.5, 1.8, 0, 0, 0).rotateX(0.2).rotateY(side * 0.08).translate(side * 0.04, 0.098, -0.035), 0.003), plumage),
    // lotki: trzy cienkie pióra wystające za tułów, na krzyż nad ogonem
    ...[0, 1, 2].map((k) => paint(new THREE.BoxGeometry(0.012, 0.004, 0.09 - k * 0.012).translate(0, 0, -0.045).rotateY(-side * (0.12 + k * 0.05)).rotateX(-0.12).translate(side * (0.03 - k * 0.006), 0.093 - k * 0.003, -0.1), plumage, 0.03)),
  ];
  const tailShape = new THREE.Shape([new THREE.Vector2(-0.012, 0), new THREE.Vector2(0.012, 0), new THREE.Vector2(0.03, -0.1), new THREE.Vector2(0, -0.118), new THREE.Vector2(-0.03, -0.1)]);
  const tail = new THREE.ExtrudeGeometry(tailShape, { depth: 0.005, bevelEnabled: false }).rotateX(Math.PI / 2).rotateX(-0.22).translate(0, 0.088, -0.11);
  const legGeo = (side: number): THREE.BufferGeometry[] => [
    paint(seg([side * 0.017, 0.055, 0.005], [side * 0.019, 0.004, 0.01], 0.006, 0.005, 5), () => LEG, 0),
    ...[-0.5, 0, 0.5].map((a) => paint(seg([side * 0.019, 0.004, 0.01], [side * 0.019 + Math.sin(a) * 0.025, 0.002, 0.01 + Math.cos(a) * 0.025], 0.003, 0.002, 4), () => LEG, 0)),
    paint(seg([side * 0.019, 0.004, 0.01], [side * 0.019, 0.002, -0.012], 0.003, 0.002, 4), () => LEG, 0),
  ];
  return mergeGeometries([
    paint(shaggy(ell(0.058, 0.85, 0.8, 1.55, 0, 0.095, -0.005).rotateX(-0.3), 0.004), plumage), // tułów, przód uniesiony
    paint(shaggy(ell(0.048, 1, 1, 1, 0, 0.11, 0.05), 0.005), plumage), // pierś
    paint(shaggy(ell(0.04, 0.9, 0.95, 1.12, 0, 0.158, 0.098), 0.003), plumage), // łeb
    ...[-0.012, 0, 0.012].map((x) => paint(new THREE.ConeGeometry(0.01, 0.035, 4).rotateX(Math.PI - 0.35).translate(x, 0.125, 0.112), () => BLACK, 0.05)), // nastroszone pióra na gardle
    paint(new THREE.ConeGeometry(0.017, 0.07, 6).scale(0.85, 1, 1.25).rotateX(Math.PI / 2 + 0.12).translate(0, 0.157, 0.162), () => BEAK, 0.03), // górna część dzioba, lekko w dół
    paint(new THREE.ConeGeometry(0.012, 0.055, 5).scale(0.85, 1, 0.8).rotateX(Math.PI / 2 - 0.05).translate(0, 0.146, 0.155), () => BEAK, 0.03),
    paint(ell(0.007, 1, 1, 1, -0.031, 0.168, 0.118, 1), () => C(0x050505), 0), // oczy
    paint(ell(0.007, 1, 1, 1, 0.031, 0.168, 0.118, 1), () => C(0x050505), 0),
    ...wing(-1), ...wing(1),
    paint(tail, plumage, 0.04),
    ...legGeo(-1), ...legGeo(1),
  ])!;
}

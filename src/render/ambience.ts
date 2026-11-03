import { touch } from './touch';
import * as THREE from 'three';

/**
 * Klimat osady: dym z kominów, iskry nad ogniskami i pożarami, świecące nocą okna i mgła snująca się przy ziemi.
 * Wszystko to tylko obraz — nie czyta i nie zmienia symulacji. Cząstki to jeden bufor punktów na rodzaj (jedno rysowanie).
 */

/** Miękka, okrągła plama (środek pełny, brzegi zanikają) — wspólna dla dymu, iskier, blasku okien i mgły */
function softTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Kłęby dymu: atlas 2×2 czterech różnych obłoczków (kilkanaście miękkich kul zlanych w jeden kłąb, przetkanych
 * drobnym szumem — brzegi strzępią się jak prawdziwy dym, a nie jak gładkie koło). Każda cząstka bierze jeden z nich
 * i obraca się powoli, więc słup dymu nie powtarza wzoru (Michał 3.11.2026: „u nas dym jest brzydki”).
 */
function puffTexture(): THREE.Texture {
  const N = 256, C = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  const img = x.createImageData(N, N);
  let s = 424242;
  const rnd = (): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  // drobny szum wartości (zawijający się w komórce), dwie skale
  const G = 16, grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const vn = (u: number, v: number): number => {
    const fx = u * G, fy = v * G, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (a: number, b: number): number => grid[((b % G + G) % G) * G + ((a % G + G) % G)]!;
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  for (let cell = 0; cell < 4; cell++) {
    const blobs: [number, number, number, number][] = [];
    const n = 12 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.2;
      blobs.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r * 0.9, 0.09 + rnd() * 0.11, 0.55 + rnd() * 0.45]);
    }
    const ox = (cell & 1) * C, oy = (cell >> 1) * C;
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      const u = (i + 0.5) / C, v = (j + 0.5) / C;
      let d = 0;
      for (const [bx, by, br, bw] of blobs) { const dx = u - bx, dy = v - by; d += bw * Math.exp(-(dx * dx + dy * dy) / (br * br)); }
      const wisp = 0.55 + 0.3 * vn(u + cell * 0.37, v) + 0.25 * vn(u * 2.3 + 0.5, v * 2.3 + cell);
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const mask = r >= 0.96 ? 0 : 1 - Math.pow(r / 0.96, 3);
      const a = Math.max(0, Math.min(1, (d * 0.75 - 0.08) * wisp)) * mask;
      const k = ((oy + j) * N + ox + i) * 4;
      // jasność: wierzch kłębu jaśniejszy (światło z góry), spód i środek ciemniejszy — kłąb ma bryłę
      const lit = Math.max(0, Math.min(1, 0.72 + (0.5 - v) * 0.5 + (wisp - 0.7) * 0.4));
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(lit * 255);
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Mgła: plama poszarpana szumem, żeby smugi nie były idealnymi kołami */
function mistTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, r = 18 + ((i * 37) % 23);
    const cx = 64 + Math.cos(a) * r * 0.9, cy = 64 + Math.sin(a) * r * 0.5;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  // brzegi płytki do zera (owalnie): bez tego plamy wychodziły poza obrazek i było widać prosty, kanciasty prostokąt
  const img = x.getImageData(0, 0, 128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const u = (i + 0.5) / 64 - 1, v = (j + 0.5) / 64 - 1;
    const d = Math.sqrt(u * u + v * v);
    const m = d >= 1 ? 0 : 1 - d * d * (3 - 2 * d);
    img.data[(j * 128 + i) * 4 + 3] = Math.round(img.data[(j * 128 + i) * 4 + 3]! * m);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 tint;
attribute float spin;
uniform float scale;
varying float vA;
varying vec3 vT;
varying float vS;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vA = alpha; vT = tint; vS = spin;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uAtlas;
varying float vA;
varying vec3 vT;
varying float vS;
#include <fog_pars_fragment>
void main() {
  vec4 tx;
  if (uAtlas > 0.5) {
    // kłąb dymu: obrót o kąt cząstki, jedna z czterech komórek atlasu (numer w części całkowitej spin)
    float cell = floor(vS);
    float ang = fract(vS) * 6.2831853;
    vec2 p = gl_PointCoord - 0.5;
    float cs = cos(ang), sn = sin(ang);
    p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * 1.05 + 0.5;
    if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
    vec2 off = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
    tx = texture2D(map, off + clamp(p, 0.01, 0.99) * 0.5);
    tx.rgb = mix(vec3(1.0), tx.rgb, 0.85);
  } else tx = vec4(1.0, 1.0, 1.0, texture2D(map, gl_PointCoord).a);
  float a = tx.a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vT * tx.rgb, a);
  #include <fog_fragment>
}`;

/** Pula cząstek: pozycja, prędkość, wiek; martwe mają rozmiar 0 */
class Pool {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly tint: Float32Array;
  readonly vel: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly base: Float32Array;
  /** Kłęby: komórka atlasu (część całkowita) + kąt obrotu w obrotach (ułamek); prędkość obrotu w `turn` */
  readonly spin: Float32Array;
  readonly turn: Float32Array;
  private next = 0;
  readonly mat: THREE.ShaderMaterial;
  constructor(readonly n: number, map: THREE.Texture, additive: boolean, atlas = false) {
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.tint = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1); this.base = new Float32Array(n);
    this.spin = new Float32Array(n); this.turn = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('spin', new THREE.BufferAttribute(this.spin, 1).setUsage(atlas ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage));
    this.atlas = atlas;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, scale: { value: 600 }, uAtlas: { value: atlas ? 1 : 0 } }]),
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat.uniforms.map!.value = map;
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  private atlas: boolean;
  /** Nowa cząstka (nadpisuje najstarszą, gdy pula pełna) */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, base: number): number {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.base[i] = base;
    if (this.atlas) { this.spin[i] = Math.floor(Math.random() * 4) + Math.random() * 0.999; this.turn[i] = (Math.random() - 0.5) * 0.08; }
    return i;
  }
  flush(): void {
    const a = this.points.geometry.attributes;
    for (const k of ['position', 'size', 'alpha', 'tint']) a[k]!.needsUpdate = true;
    if (this.atlas) a.spin!.needsUpdate = true;
  }
}

export interface BuildingFx {
  /** Wierzchołki kominów (lokalnie w budynku) */
  chimneys: THREE.Vector3[];
  /** Okna: punkt tuż przed szybą (lokalnie) */
  windows: THREE.Vector3[];
  /** Ogniska (lokalnie) */
  fires: THREE.Vector3[];
}

/** Zbiera z modelu budynku miejsca na dym, iskry i blask okien. Wywoływać przed scaleniem części, gdy model stoi w zerze. */
export function collectFx(root: THREE.Object3D, isWindow: (m: THREE.Material) => boolean): BuildingFx {
  root.updateMatrixWorld(true);
  const fx: BuildingFx = { chimneys: [], windows: [], fires: [] };
  const box = new THREE.Box3(), v = new THREE.Vector3(), q = new THREE.Quaternion(), n = new THREE.Vector3();
  const flames: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (o.name === 'chimney') { box.setFromObject(o); fx.chimneys.push(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.05, (box.min.z + box.max.z) / 2)); }
    if (o.name === 'flame') flames.push(o.getWorldPosition(new THREE.Vector3()));
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || !isWindow(m.material)) return;
    // pomijamy okna we wnętrzach (widać je tylko po zdjęciu dachu)
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.name === 'interior') return;
    m.geometry.computeBoundingBox();
    const s = m.geometry.boundingBox!.getSize(v);
    // szyba jest cienka w jednej osi: to kierunek, w który patrzy
    if (s.x <= s.y && s.x <= s.z) n.set(1, 0, 0); else if (s.z <= s.y) n.set(0, 0, 1); else return;
    n.applyQuaternion(m.getWorldQuaternion(q));
    const p = m.getWorldPosition(new THREE.Vector3());
    if (n.x * p.x + n.z * p.z < 0) n.negate();
    fx.windows.push(p.addScaledVector(n, 0.12));
  });
  // palenisko pod kominem jest w środku budynku: jego dym wychodzi kominem, a nie przez strop i dach,
  // więc iskry i dym sypiemy tylko z ognisk pod gołym niebem (obozowisko)
  if (!fx.chimneys.length) fx.fires.push(...flames);
  return fx;
}

export interface FxSource { mesh: THREE.Object3D; fx: BuildingFx; smoke: boolean; burning: boolean }

export class Ambience {
  readonly group = new THREE.Group();
  private soft = softTexture();
  private smoke = new Pool(1800, puffTexture(), false, true);
  private sparks = new Pool(700, this.soft, true);
  private glow: Pool;
  private mist: THREE.InstancedMesh;
  private mistMat: THREE.MeshBasicMaterial;
  private chimneys: THREE.Vector3[] = [];
  private fires: { p: THREE.Vector3; big: boolean }[] = [];
  private emitAcc = 0;
  private windows = 0;
  private time = 0;
  private static MIST = 46;
  private mistSeed: { x: number; z: number; s: number; r: number; v: number }[] = [];

  enabled = true;

  constructor() {
    this.glow = new Pool(1600, this.soft, true);
    this.mistMat = new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, fog: true });
    this.mist = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.mistMat, Ambience.MIST);
    this.mist.frustumCulled = false;
    this.mist.renderOrder = 2;
    for (let i = 0; i < Ambience.MIST; i++) {
      const r = (k: number): number => { const v = Math.sin(i * 91.7 + k * 13.1) * 43758.5453; return v - Math.floor(v); };
      this.mistSeed.push({ x: r(1) * 220, z: r(2) * 220, s: 10 + r(3) * 12, r: r(4) * Math.PI, v: 0.5 + r(5) * 0.7 });
    }
    this.group.add(this.mist, this.smoke.points, this.sparks.points, this.glow.points);
  }

  /** Nowe miejsca emisji (wołane rzadko, np. raz na sekundę): kominy, ogniska, okna */
  setSources(list: FxSource[], focus: THREE.Vector3): void {
    this.chimneys = []; this.fires = [];
    const w = new THREE.Vector3();
    let gi = 0;
    const G = this.glow;
    for (const s of list) {
      const m = s.mesh;
      // tylko w pobliżu tego, na co patrzymy — dalej i tak przykrywa mgła
      if ((m.position.x - focus.x) ** 2 + (m.position.z - focus.z) ** 2 > 75 * 75) continue;
      if (s.smoke) for (const c of s.fx.chimneys) this.chimneys.push(m.localToWorld(w.copy(c)).clone());
      for (const f of s.fx.fires) this.fires.push({ p: m.localToWorld(w.copy(f)).clone(), big: false });
      if (s.burning) {
        // iskry i czarny dym z wierzchu płonącego budynku (obrys liczy blaze.ts przy zapłonie)
        const box = m.userData.burnBox as THREE.Box3 | undefined;
        this.fires.push({ p: box ? box.getCenter(w).setY(box.max.y - 0.15).clone() : m.localToWorld(w.set(0, 1.1, 0)).clone(), big: true });
      }
      for (const o of s.fx.windows) {
        if (gi >= G.n) break;
        m.localToWorld(w.copy(o));
        G.pos[gi * 3] = w.x; G.pos[gi * 3 + 1] = w.y; G.pos[gi * 3 + 2] = w.z;
        G.base[gi] = (gi * 0.618) % 1; // przesunięcie migotania
        G.tint[gi * 3] = 1; G.tint[gi * 3 + 1] = 0.48; G.tint[gi * 3 + 2] = 0.12;
        gi++;
      }
    }
    for (let i = gi; i < G.n; i++) G.size[i] = 0;
    G.points.geometry.setDrawRange(0, gi);
    this.windows = gi;
    G.flush();
  }

  /** Klatka: night 0..1, mist 0..1 (świt, mgliste dni), rain 0..1, kolor mgły sceny, środek widoku, wysokość terenu */
  update(dt: number, o: { night: number; mist: number; rain: number; fog: THREE.Color; focus: THREE.Vector3; ground: (x: number, z: number) => number; scale: number; calm: boolean }): void {
    this.time += dt;
    for (const p of [this.smoke, this.sparks, this.glow]) p.mat.uniforms.scale!.value = o.scale;
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    const night = o.night;
    // --- emisja
    this.emitAcc += dt;
    if (!o.calm && this.emitAcc > 0.05) {
      const step = this.emitAcc; this.emitAcc = 0;
      // komin dymi co ~0,45 s; ognisko sypie iskrami, pożar dużo mocniej
      for (const c of this.chimneys) if (Math.random() < step / 0.4)
        this.smoke.emit(c.x + (Math.random() - 0.5) * 0.04, c.y + 0.1, c.z + (Math.random() - 0.5) * 0.04, 0, 0.42 + Math.random() * 0.1, 0, 6 + Math.random() * 3, Math.random() * 0.2);
      for (const f of this.fires) {
        const rate = f.big ? 0.025 : 0.14;
        for (let k = 0; k < 4 && Math.random() < step / rate; k++)
          this.sparks.emit(f.p.x + (Math.random() - 0.5) * (f.big ? 0.8 : 0.12), f.p.y + 0.15, f.p.z + (Math.random() - 0.5) * (f.big ? 0.8 : 0.12),
            (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 1.1, Math.random());
        // pożar: gęsty słup z całego wierzchu budynku (kilka kłębów naraz), ognisko — cienka smużka
        for (let k = 0; k < (f.big ? 3 : 1) && Math.random() < step / (f.big ? 0.07 : 0.9); k++) {
          const sp = f.big ? 0.9 : 0;
          this.smoke.emit(f.p.x + (Math.random() - 0.5) * sp, f.p.y + 0.3, f.p.z + (Math.random() - 0.5) * sp,
            0.06 + (Math.random() - 0.5) * 0.1, f.big ? 0.85 + Math.random() * 0.35 : 0.3, 0.02 + (Math.random() - 0.5) * 0.1, f.big ? 6 + Math.random() * 2 : 3.2, f.big ? 1 : 0.5);
        }
      }
    }
    // --- dym: rośnie, rzednie, znosi go wiatr; nocą ciemny z ciepłym podświetleniem u wylotu
    const S = this.smoke;
    for (let i = 0; i < S.n; i++) {
      if (S.age[i]! >= 1) { S.size[i] = 0; S.alpha[i] = 0; continue; }
      S.age[i] = Math.min(1, S.age[i]! + dt / S.life[i]!);
      const a = S.age[i]!;
      // wiatr łapie dym dopiero, gdy ten wzniesie się nad dach — przy wylocie komina idzie prosto w górę
      S.vel[i * 3] = S.vel[i * 3]! + dt * 0.06 * Math.min(1, a * 4); S.vel[i * 3 + 2] = S.vel[i * 3 + 2]! + dt * 0.02 * Math.min(1, a * 4);
      S.pos[i * 3] = S.pos[i * 3]! + S.vel[i * 3]! * dt; S.pos[i * 3 + 1] = S.pos[i * 3 + 1]! + S.vel[i * 3 + 1]! * dt * (1 - a * 0.5); S.pos[i * 3 + 2] = S.pos[i * 3 + 2]! + S.vel[i * 3 + 2]! * dt;
      const kind = S.base[i]!; // 1 = dym z pożaru, gęsty i czarny; 0,5 = lekki dymek ogniska; 0..0,2 = komin (odcień)
      const black = kind === 1 ? 1 : 0, light = kind === 0.5;
      // kłąb obraca się powoli (ułamek spin = kąt w obrotach), coraz wolniej, gdy się rozpływa
      S.spin[i] = Math.floor(S.spin[i]!) + (((S.spin[i]! % 1) + S.turn[i]! * dt * (1.2 - a)) % 1 + 1) % 1;
      // smuga zaczyna się wąsko (szerokość wylotu) i rośnie z wysokością, żeby kłąb nie wchodził w dach obok komina;
      // ognisko: cienka, przejrzysta smużka (Michał 2.11.2026: przy ognisku wisiała wielka biała kula)
      S.size[i] = (0.2 + a * a * (black ? 3.4 : light ? 0.6 : 1.9) + a * (black ? 0.9 : light ? 0.15 : 0.4)) * (1 + o.rain * 0.3);
      S.alpha[i] = Math.min(1, a * (black ? 5 : 8)) * (1 - a) * (1 - a * 0.3) * (black ? 0.95 : light ? 0.2 : 0.5);
      if (black) {
        // pożar: u dołu kłęby podświetlone płomieniami (pomarańcz → czerwień), wyżej brunatnoczarny dym, na samej górze
        // rozrzedzony i szarzejący; nocą łuna świeci mocniej i dłużej
        const glow = Math.max(0, 1 - a / (0.22 + night * 0.12));
        const smokeG = 0.13 + a * 0.16 * (1 - night * 0.6);
        S.tint[i * 3] = smokeG + glow * (1.25 + night * 0.4); S.tint[i * 3 + 1] = smokeG * 0.92 + glow * (0.42 + night * 0.12); S.tint[i * 3 + 2] = smokeG * 0.85 + glow * 0.12;
      } else {
        // komin i ognisko: jasnoszary, miękki dym (w słońcu prawie biały), nocą ciemny z ciepłym podświetleniem u wylotu
        const g = (light ? 0.7 : 0.8 + kind * 0.6) - night * 0.5;
        const warm = night * Math.max(0, 1 - a * 5) * 0.55;
        S.tint[i * 3] = g + warm; S.tint[i * 3 + 1] = g + warm * 0.45; S.tint[i * 3 + 2] = g + 0.03 - warm * 0.1;
      }
    }
    S.flush();
    // --- iskry: lecą w górę, gasną z żółtego przez pomarańcz do czerwieni
    const K = this.sparks;
    for (let i = 0; i < K.n; i++) {
      if (K.age[i]! >= 1) { K.size[i] = 0; K.alpha[i] = 0; continue; }
      K.age[i] = Math.min(1, K.age[i]! + dt / K.life[i]!);
      const a = K.age[i]!;
      const wob = Math.sin(this.time * 7 + K.base[i]! * 40) * 0.3;
      K.pos[i * 3] = K.pos[i * 3]! + (K.vel[i * 3]! + wob) * dt; K.pos[i * 3 + 1] = K.pos[i * 3 + 1]! + K.vel[i * 3 + 1]! * dt * (1 - a * 0.6); K.pos[i * 3 + 2] = K.pos[i * 3 + 2]! + K.vel[i * 3 + 2]! * dt;
      const tw = 0.6 + 0.4 * Math.sin(this.time * 30 + K.base[i]! * 90);
      K.size[i] = 0.09 * (1 - a * 0.5);
      K.alpha[i] = (1 - a) * tw * (0.45 + night * 0.55);
      K.tint[i * 3] = 1; K.tint[i * 3 + 1] = 0.75 - a * 0.5; K.tint[i * 3 + 2] = 0.3 - a * 0.28;
    }
    K.flush();
    // --- okna: ciepły blask nocą, lekko pulsuje jak płomień świecy
    const G = this.glow, nWin = this.windows;
    const lit = Math.max(0, (night - 0.1) / 0.9);
    for (let i = 0; i < nWin; i++) {
      const fl = 0.82 + 0.1 * Math.sin(this.time * 6 + G.base[i]! * 50) + 0.08 * Math.sin(this.time * 13.7 + G.base[i]! * 31);
      G.size[i] = lit > 0 ? 0.32 : 0;
      G.alpha[i] = lit * fl * 0.45;
    }
    G.points.geometry.attributes.size!.needsUpdate = true;
    G.points.geometry.attributes.alpha!.needsUpdate = true;
    // --- mgła przy ziemi: długie, niskie ławice snujące się w oddali (nad lasem, łąkami, wodą), nigdy nad tym, na co patrzymy;
    // gęstsza o świcie i w deszczu. Blisko środka widoku ich nie ma, dalej rosną płynnie, więc nie zasłaniają wioski.
    const level = Math.min(1, o.mist * 0.7 + night * 0.25 + o.rain * 0.3);
    this.mistMat.opacity = level * 0.24;
    this.mist.visible = level > 0.02;
    if (this.mist.visible) {
      this.mistMat.color.copy(o.fog).lerp(WHITE, 0.1 + (1 - night) * 0.3);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      const W = 220;
      const wrap = (v: number): number => ((v % W) + W) % W - W / 2;
      for (let i = 0; i < Ambience.MIST; i++) {
        const s = this.mistSeed[i]!;
        const x = o.focus.x + wrap(s.x + this.time * 0.35 * s.v - o.focus.x);
        const z = o.focus.z + wrap(s.z + this.time * 0.12 * s.v - o.focus.z);
        const d = Math.hypot(x - o.focus.x, z - o.focus.z);
        let k = Math.max(0, Math.min(1, (d - 38) / 22));
        // płaska ławica nie może wchodzić w zbocze ani w skały: wysokość z kilku punktów pod nią,
        // a na stromiźnie (skraj gór, urwisko) płynnie znika zamiast ciąć się o teren prostą krawędzią
        const rr = s.s * 0.9;
        const h0 = o.ground(x, z), h1 = o.ground(x + rr, z), h2 = o.ground(x - rr, z), h3 = o.ground(x, z + rr), h4 = o.ground(x, z - rr);
        const hi = Math.max(h0, h1, h2, h3, h4), lo = Math.min(h0, h1, h2, h3, h4);
        k *= Math.max(0, Math.min(1, (1.6 - (hi - lo)) / 1.0));
        p.set(x, hi + 0.18 + (i % 3) * 0.08, z);
        q.setFromAxisAngle(Y, s.r + this.time * 0.01 * s.v);
        sc.set(s.s * 2.4 * k, 1, s.s * 0.8 * k);
        this.mist.setMatrixAt(i, M.compose(p, q, sc));
      }
      touch(this.mist);
    }
  }
}
const WHITE = new THREE.Color(1, 1, 1);

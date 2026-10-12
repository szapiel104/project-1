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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 tint;
uniform float scale;
varying float vA;
varying vec3 vT;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vA = alpha; vT = tint;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying float vA;
varying vec3 vT;
#include <fog_pars_fragment>
void main() {
  float a = texture2D(map, gl_PointCoord).a * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vT, a);
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
  private next = 0;
  readonly mat: THREE.ShaderMaterial;
  constructor(readonly n: number, map: THREE.Texture, additive: boolean) {
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.tint = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1); this.base = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, scale: { value: 600 } }]),
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat.uniforms.map!.value = map;
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  /** Nowa cząstka (nadpisuje najstarszą, gdy pula pełna) */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, base: number): number {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.base[i] = base;
    return i;
  }
  flush(): void {
    const a = this.points.geometry.attributes;
    for (const k of ['position', 'size', 'alpha', 'tint']) a[k]!.needsUpdate = true;
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
  root.traverse((o) => {
    if (o.name === 'chimney') { box.setFromObject(o); fx.chimneys.push(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.05, (box.min.z + box.max.z) / 2)); }
    if (o.name === 'flame') fx.fires.push(o.getWorldPosition(new THREE.Vector3()));
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
  return fx;
}

export interface FxSource { mesh: THREE.Object3D; fx: BuildingFx; smoke: boolean; burning: boolean }

export class Ambience {
  readonly group = new THREE.Group();
  private soft = softTexture();
  private smoke = new Pool(1400, this.soft, false);
  private sparks = new Pool(700, this.soft, true);
  private glow: Pool;
  private mist: THREE.InstancedMesh;
  private mistMat: THREE.MeshBasicMaterial;
  private chimneys: THREE.Vector3[] = [];
  private fires: { p: THREE.Vector3; big: boolean }[] = [];
  private emitAcc = 0;
  private windows = 0;
  private time = 0;
  private static MIST = 70;
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
      this.mistSeed.push({ x: r(1) * 130, z: r(2) * 130, s: 7 + r(3) * 9, r: r(4) * Math.PI, v: 0.5 + r(5) * 0.7 });
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
      if (s.burning) this.fires.push({ p: m.localToWorld(w.set(0, 1.1, 0)).clone(), big: true });
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
      for (const c of this.chimneys) if (Math.random() < step / 0.45)
        this.smoke.emit(c.x + (Math.random() - 0.5) * 0.06, c.y, c.z + (Math.random() - 0.5) * 0.06, 0.05, 0.32 + Math.random() * 0.1, 0.02, 6 + Math.random() * 3, 0);
      for (const f of this.fires) {
        const rate = f.big ? 0.025 : 0.14;
        for (let k = 0; k < 4 && Math.random() < step / rate; k++)
          this.sparks.emit(f.p.x + (Math.random() - 0.5) * (f.big ? 0.8 : 0.12), f.p.y + 0.15, f.p.z + (Math.random() - 0.5) * (f.big ? 0.8 : 0.12),
            (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 1.1, Math.random());
        if (Math.random() < step / (f.big ? 0.12 : 0.9))
          this.smoke.emit(f.p.x, f.p.y + 0.3, f.p.z, 0.06, f.big ? 0.7 : 0.3, 0.02, f.big ? 5 : 4, f.big ? 1 : 0);
      }
    }
    // --- dym: rośnie, rzednie, znosi go wiatr; nocą ciemny z ciepłym podświetleniem u wylotu
    const S = this.smoke;
    for (let i = 0; i < S.n; i++) {
      if (S.age[i]! >= 1) { S.size[i] = 0; S.alpha[i] = 0; continue; }
      S.age[i] = Math.min(1, S.age[i]! + dt / S.life[i]!);
      const a = S.age[i]!;
      S.vel[i * 3] = S.vel[i * 3]! + dt * 0.05; // wiatr
      S.pos[i * 3] = S.pos[i * 3]! + S.vel[i * 3]! * dt; S.pos[i * 3 + 1] = S.pos[i * 3 + 1]! + S.vel[i * 3 + 1]! * dt * (1 - a * 0.5); S.pos[i * 3 + 2] = S.pos[i * 3 + 2]! + S.vel[i * 3 + 2]! * dt;
      const black = S.base[i]!; // 1 = dym z pożaru, gęsty i czarny
      S.size[i] = (0.3 + a * (black ? 2.6 : 1.5)) * (1 + o.rain * 0.3);
      S.alpha[i] = Math.min(1, a * 8) * (1 - a) * (black ? 0.7 : 0.42);
      const g = black ? 0.12 : 0.62 - night * 0.42;
      const warm = night * Math.max(0, 1 - a * 5) * 0.5;
      S.tint[i * 3] = g + warm; S.tint[i * 3 + 1] = g + warm * 0.45; S.tint[i * 3 + 2] = g + 0.02;
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
    // --- mgła przy ziemi: płaskie smugi dryfujące z wiatrem wokół środka widoku; gęsta o świcie, wyraźna nocą
    const level = Math.min(1, o.mist * 0.9 + night * 0.28 + o.rain * 0.3);
    this.mistMat.opacity = level * 0.42;
    this.mist.visible = level > 0.02;
    if (this.mist.visible) {
      this.mistMat.color.copy(o.fog).lerp(WHITE, 0.1 + (1 - night) * 0.3);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      const W = 130;
      const wrap = (v: number): number => ((v % W) + W) % W - W / 2;
      for (let i = 0; i < Ambience.MIST; i++) {
        const s = this.mistSeed[i]!;
        const x = o.focus.x + wrap(s.x + this.time * 0.35 * s.v - o.focus.x);
        const z = o.focus.z + wrap(s.z + this.time * 0.12 * s.v - o.focus.z);
        p.set(x, o.ground(x, z) + 0.3 + (i % 3) * 0.12, z);
        q.setFromAxisAngle(Y, s.r + this.time * 0.01 * s.v);
        sc.set(s.s * 1.6, 1, s.s);
        this.mist.setMatrixAt(i, M.compose(p, q, sc));
      }
      this.mist.instanceMatrix.needsUpdate = true;
    }
  }
}
const WHITE = new THREE.Color(1, 1, 1);

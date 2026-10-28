import { touch } from './touch';
import * as THREE from 'three';
import { FIRE_NOISE } from './fireGlsl';

/**
 * Żywy ogień: płomienie pochodni, ognisk i koszy jako prawdziwe bryły ognia (28.10.2026) — promień z oka przechodzi
 * przez trójwymiarowy, unoszący się szum, więc płomień wygląda tak samo z każdej strony i nie obraca się z kamerą
 * (wcześniej była to płaska kartka zwrócona do patrzącego). Wokół każdego ciepła poświata. Dwa wywołania rysowania.
 * Pożary budynków rysuje osobno blaze.ts (ogień obejmujący całą bryłę).
 */
const MAX = 900;

// Płomień to bryła (prostopadłościan od podstawy w górę), przez którą idzie promień z oka. Ten sam kod dla puli
// (InstancedMesh) i dla pojedynczej siatki (pochodnia w ręce): wszystko liczone w przestrzeni bryły.
const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vScale;
varying float vSeed;
varying float vI;
void main() {
  #ifdef USE_INSTANCING
    mat4 M = modelMatrix * instanceMatrix;
  #else
    mat4 M = modelMatrix;
  #endif
  vLocal = position;
  vCam = (inverse(M) * vec4(cameraPosition, 1.0)).xyz;
  vScale = vec3(length(M[0].xyz), length(M[1].xyz), length(M[2].xyz));
  #ifdef USE_INSTANCING_COLOR
    vSeed = instanceColor.r; vI = instanceColor.g;
  #else
    vSeed = 0.37; vI = 1.0;
  #endif
  gl_Position = projectionMatrix * viewMatrix * M * vec4(position, 1.0);
}`;

const FLAME_FRAG = /* glsl */ `
uniform float time;
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vScale;
varying float vSeed;
varying float vI;
${FIRE_NOISE}
void main() {
  vec3 o = vCam;
  vec3 d = normalize(vLocal - vCam);
  vec2 tt = fBox(o, d, vec3(-0.5, 0.0, -0.5), vec3(0.5, 1.0, 0.5));
  float t0 = max(tt.x, 0.0), t1 = tt.y;
  if (t1 <= t0) discard;
  const int N = 22;
  float ds = (t1 - t0) / float(N);
  // przesunięcie startu o losowy ułamek kroku: zamiast prążków drobne, niewidoczne ziarno
  float t = t0 + ds * fHash(vec3(gl_FragCoord.xy, fract(time) * 97.0));
  float wl = length(d * vScale); // długość kroku w metrach świata
  float tm = time + vSeed * 20.0;
  vec2 sway = vec2(fNoise(vec3(tm * 0.5, vSeed * 9.0, 0.5)), fNoise(vec3(4.5, tm * 0.5, vSeed * 7.0))) - 0.5;
  vec3 col = vec3(0.0);
  float A = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = o + d * t;
    float y = p.y;
    vec2 xz = p.xz - sway * 0.4 * y * y;
    // kłęby szumu unoszą się w górę szybciej niż sam płomień — języki odrywają się od czubka
    float n = fFbm(vec3(xz * 3.2, y * 2.4 - tm * 1.7) + vSeed * 13.0, 3);
    float r = length(xz);
    float R = 0.46 * pow(max(0.0, 1.0 - y), 0.85) * smoothstep(0.0, 0.14, y + 0.03);
    float dist = r - R * (0.45 + 1.0 * n);
    float dens = smoothstep(0.05, -0.1, dist) * smoothstep(1.0, 0.5, y + (n - 0.5) * 0.7);
    if (dens > 0.002) {
      float temp = clamp(dens * (1.2 - y * 0.95) * (0.65 + 0.7 * n), 0.0, 1.0);
      float a = 1.0 - exp(-dens * ds * wl * 22.0);
      col += (1.0 - A) * a * fRamp(temp);
      A += (1.0 - A) * a;
      if (A > 0.97) break;
    }
    t += ds;
  }
  A *= vI;
  if (A < 0.01) discard;
  // mieszanie z przemnożoną alfą: ogień świeci, a tło za nim tylko lekko przygasa
  // jasność stonowana (28.10.2026, „wali po oczach”): płomień pomarańczowy, nie biały, i bez rozlanej łuny
  gl_FragColor = vec4(col * vI * 0.65, A * 0.4);
}`;

/** Materiał objętościowego płomienia (wspólny dla puli i pojedynczych siatek) */
function flameMaterial(time: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time }, vertexShader: VERT, fragmentShader: FLAME_FRAG,
    transparent: true, depthWrite: false, premultipliedAlpha: true, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// poświata to okrągła plama (wygląda tak samo z każdej strony), więc zostaje zwrócona do kamery
const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
varying float vSeed;
varying float vI;
void main() {
  vUv = uv;
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = center + (right * position.x + up * position.y) * sx;
  #ifdef USE_INSTANCING_COLOR
    vSeed = instanceColor.r; vI = instanceColor.g;
  #else
    vSeed = 0.0; vI = 1.0;
  #endif
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vSeed;
varying float vI;
uniform float time;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float fl = 0.85 + 0.15 * sin(time * 13.0 + vSeed * 40.0) * sin(time * 7.3 + vSeed * 11.0);
  float a = pow(max(0.0, 1.0 - r), 2.5) * vI * fl * 0.42; // poświata miękka, nie oślepia
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.18), a);
}`;

/** Pojedynczy płomień jako zwykła siatka (np. pochodnia w ręce przy kamerze): ta sama bryła ognia co w puli */
export function flameSprite(time: { value: number }, w = 0.06, h = 0.13): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_BOX, flameMaterial(time));
  m.scale.set(w, h, w);
  m.renderOrder = 7;
  m.frustumCulled = false;
  return m;
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // podstawa płomienia na dole

export class Flames {
  readonly group = new THREE.Group();
  private flame: THREE.InstancedMesh;
  private glow: THREE.InstancedMesh;
  private uni = { time: { value: 0 } };
  private n = 0;
  private M = new THREE.Matrix4();
  private P = new THREE.Vector3();
  private S = new THREE.Vector3();
  private Q = new THREE.Quaternion();
  private C = new THREE.Color();

  constructor() {
    this.flame = new THREE.InstancedMesh(UNIT_BOX, flameMaterial(this.uni.time), MAX);
    this.glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), MAX);
    for (const m of [this.flame, this.glow]) {
      for (let i = 0; i < MAX; i++) m.setColorAt(i, this.C.setRGB(0, 0, 0));
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.flame.renderOrder = 6;
    this.glow.renderOrder = 5;
  }

  begin(time: number): void { this.uni.time.value = time; this.n = 0; }

  /** Płomień: punkt u podstawy, wysokość, szerokość, ziarno (różnicuje ruch), jasność poświaty (0 w dzień, 1 nocą);
   *  halo — mnożnik łuny (świeczka i latarnia w izbie: mała i słaba, żeby nie wyglądała jak płonący stół) */
  add(base: THREE.Vector3, height: number, width: number, seed: number, glow: number, halo = 1): void {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.flame.setMatrixAt(i, this.M.compose(this.P.copy(base), this.Q, this.S.set(width, height, width)));
    this.flame.setColorAt(i, this.C.setRGB(seed, 1, 0));
    const gs = height * 2.6 * Math.sqrt(halo);
    this.glow.setMatrixAt(i, this.M.compose(this.P.set(base.x, base.y + height * 0.35, base.z), this.Q, this.S.set(gs, gs, 1)));
    this.glow.setColorAt(i, this.C.setRGB(seed, (0.12 + glow * 0.35) * halo, 0));
  }

  /** Sama poświata (bez płomienia), np. nad płonącym budynkiem, którego ogień rysuje blaze.ts */
  addGlow(at: THREE.Vector3, size: number, seed: number, strength: number): void {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.flame.setMatrixAt(i, this.M.compose(this.P.copy(at), this.Q, this.S.set(1e-4, 1e-4, 1e-4)));
    this.flame.setColorAt(i, this.C.setRGB(seed, 0, 0));
    this.glow.setMatrixAt(i, this.M.compose(this.P.copy(at), this.Q, this.S.set(size, size, 1)));
    this.glow.setColorAt(i, this.C.setRGB(seed, strength, 0));
  }

  end(): void {
    for (const m of [this.flame, this.glow]) {
      m.count = this.n;
      touch(m);
      if (m.instanceColor) touch(m);
    }
  }
}

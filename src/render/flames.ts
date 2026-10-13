import * as THREE from 'three';

/**
 * Żywy ogień: płomienie pochodni, ognisk i pożarów rysowane jako miękkie, falujące języki z szumu
 * (biało-żółty rdzeń, pomarańczowy środek, czerwone końce), zawsze pionowe i zwrócone do kamery,
 * a wokół każdego ciepła poświata. Wszystko w dwóch wywołaniach rysowania.
 */
const MAX = 900;

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vSeed;
varying float vI;
void main() {
  vUv = uv;
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
  // płomień stoi pionowo: obraca się tylko wokół osi pionowej, w stronę kamery
  vec3 toCam = cameraPosition - center; toCam.y = 0.0;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4))));
  vec3 p = center + right * position.x * sx + vec3(0.0, 1.0, 0.0) * position.y * sy;
  #ifdef USE_INSTANCING_COLOR
    vSeed = instanceColor.r; vI = instanceColor.g;
  #else
    vSeed = 0.0; vI = 1.0;
  #endif
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FLAME_FRAG = /* glsl */ `
uniform float time;
varying vec2 vUv;
varying float vSeed;
varying float vI;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
void main() {
  float t = time * 2.4 + vSeed * 17.0;
  float y = vUv.y;
  float x = vUv.x * 2.0 - 1.0;
  // języki ognia unoszą się w górę: szum przesuwa się szybciej niż sam płomień
  float n = fbm(vec2(vUv.x * 3.2 + vSeed * 5.0, y * 3.0 - t * 1.7));
  float sway = (noise(vec2(t * 0.6, vSeed * 9.0)) - 0.5) * 0.35 * y * y;
  float w = mix(0.62, 0.02, pow(y, 0.75));
  float d = abs(x - sway + (n - 0.5) * 0.55 * y);
  float shape = smoothstep(w, w * 0.35, d);
  shape *= smoothstep(0.0, 0.1, y);
  shape *= smoothstep(1.0, 0.45, y + (n - 0.5) * 0.45);
  float core = smoothstep(0.55, 0.05, y + d * 1.3) * shape;
  vec3 col = mix(vec3(0.85, 0.12, 0.02), vec3(1.0, 0.55, 0.1), smoothstep(0.0, 0.7, shape));
  col = mix(col, vec3(1.0, 0.93, 0.62), core);
  float a = clamp(shape * 1.25, 0.0, 1.0) * vI;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
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
  float a = pow(max(0.0, 1.0 - r), 2.2) * vI * fl;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.18), a);
}`;

/** Pojedynczy płomień jako zwykła siatka (np. pochodnia w ręce przy kamerze): ten sam shader ognia, płaszczyzna zwrócona do patrzącego */
export function flameSprite(time: { value: number }, w = 0.06, h = 0.13): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vSeed; varying float vI;
      void main() { vUv = uv; vSeed = 0.37; vI = 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat);
  m.renderOrder = 7;
  m.frustumCulled = false;
  return m;
}

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
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // podstawa płomienia na dole
    const mk = (frag: string): THREE.ShaderMaterial => new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.flame = new THREE.InstancedMesh(quad, mk(FLAME_FRAG), MAX);
    this.glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mk(GLOW_FRAG), MAX);
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

  /** Płomień: punkt u podstawy, wysokość, szerokość, ziarno (różnicuje ruch), jasność poświaty (0 w dzień, 1 nocą) */
  add(base: THREE.Vector3, height: number, width: number, seed: number, glow: number): void {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.flame.setMatrixAt(i, this.M.compose(this.P.copy(base), this.Q, this.S.set(width, height, 1)));
    this.flame.setColorAt(i, this.C.setRGB(seed, 1, 0));
    const gs = height * 3.2;
    this.glow.setMatrixAt(i, this.M.compose(this.P.set(base.x, base.y + height * 0.35, base.z), this.Q, this.S.set(gs, gs, 1)));
    this.glow.setColorAt(i, this.C.setRGB(seed, 0.12 + glow * 0.35, 0));
  }

  end(): void {
    for (const m of [this.flame, this.glow]) {
      m.count = this.n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

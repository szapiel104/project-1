import * as THREE from 'three';

/**
 * Padający śnieg (Michał 3.11.2026: „śnieg u nas nie pada”). Przy mrozie opad z zegara pogody to śnieg zamiast
 * deszczu, a zimą przy zachmurzeniu sypią też drobne śnieżyce. Tylko obraz — symulacja nic o nim nie wie.
 *
 * Wydajność: jedna pula punktów, ruch liczy karta graficzna (bez pracy procesora co klatkę). Płatki są przypięte do
 * świata w powtarzalnym pudle wokół miejsca, na które patrzymy, więc przy przesuwaniu kamery nie „jadą” razem z nią.
 * Każdy płatek opada w swoim tempie, kołysze się i znosi go wiatr; bliższe są większe, dalsze giną w mgle.
 */
const VERT = /* glsl */ `
attribute vec4 seed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform float uScale;
uniform float uWind;
uniform float uAmount;
varying float vA;
#include <fog_pars_vertex>
void main() {
  // płatek: początek w pudle, opada 0,6–1,4 m/s, kołysze się po małym okręgu, wiatr znosi go w bok
  float fall = 0.6 + seed.w * 0.8;
  vec3 p = seed.xyz * uBox;
  p.y -= uTime * fall;
  p.x += uTime * uWind * (0.7 + seed.w * 0.6) + sin(uTime * (0.9 + seed.w) + seed.x * 40.0) * 0.35;
  p.z += uTime * uWind * 0.35 + cos(uTime * (0.7 + seed.y) + seed.z * 40.0) * 0.35;
  // zawinięcie w pudle wokół środka widoku: płatek zostaje w tym samym miejscu świata
  vec3 lo = uCenter - uBox * 0.5;
  p = p - uBox * floor((p - lo) / uBox);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  // przy słabym opadzie część płatków znika (to samo pudło, mniej płatków)
  float on = step(fract(seed.x * 13.7 + seed.z * 7.3), uAmount);
  // płatki przy samej kamerze i na brzegach pudła gasną płynnie (bez skakania przy zawinięciu)
  vec3 e = abs(p - uCenter) / (uBox * 0.5);
  float edge = 1.0 - smoothstep(0.75, 1.0, max(max(e.x, e.z), e.y));
  vA = on * edge * smoothstep(0.6, 2.5, -mvPosition.z);
  gl_PointSize = (0.045 + seed.y * 0.05) * uScale / max(0.1, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vA;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}`;

export class Snowfall {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  private time = 0;
  /** Bieżąca siła opadu 0..1 (płynnie goni zadaną) */
  amount = 0;

  constructor(n = 9000) {
    const seed = new Float32Array(n * 4);
    // ziarno płatków stałe (nie Math.random): ten sam obraz u każdego, łatwiej porównywać zrzuty
    let s = 987654321;
    const rnd = (): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < n * 4; i++) seed[i] = rnd();
    const geo = new THREE.BufferGeometry();
    // pozycja nieużywana (ruch liczy shader z ziarna), ale three.js jej wymaga do liczenia punktów
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(70, 26, 70) },
        uScale: { value: 600 }, uWind: { value: 0.5 }, uAmount: { value: 0 }, uOpacity: { value: 0.9 }, uColor: { value: new THREE.Color(0.95, 0.96, 1) },
      }]),
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 3;
  }

  /**
   * Klatka: want = zadana siła opadu 0..1, focus = środek widoku (świat), scale = jak w ambience (wysokość obrazu przez
   * tangens pola widzenia), night = 0..1 (nocą płatki szarzeją, tylko te przy światłach jaśnieją — tu po prostu ciemniej)
   */
  update(dt: number, want: number, focus: THREE.Vector3, scale: number, night: number): void {
    this.amount += (want - this.amount) * Math.min(1, dt * 0.4);
    if (!Number.isFinite(this.amount)) this.amount = 0;
    this.points.visible = this.amount > 0.01;
    if (!this.points.visible) return;
    this.time += dt;
    const u = this.mat.uniforms;
    u.uTime!.value = this.time % 10000;
    // pudło stoi trochę nad ziemią w miejscu widoku: płatki widać z kamery strategicznej i ze spaceru
    (u.uCenter!.value as THREE.Vector3).set(focus.x, focus.y + 10, focus.z);
    u.uScale!.value = scale;
    u.uAmount!.value = Math.min(1, this.amount * 1.15);
    // w śnieżycy wieje mocniej
    u.uWind!.value = 0.3 + this.amount * 1.1;
    u.uOpacity!.value = 0.95 - night * 0.45;
  }

  dispose(): void { this.points.geometry.dispose(); this.mat.dispose(); }
}

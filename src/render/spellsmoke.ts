import * as THREE from 'three';
import { FIRE_NOISE } from './fireGlsl';

/**
 * Dym i para z czarów magów jako prawdziwe, trójwymiarowe kłęby (28.10.2026, wcześniej szare, twarde kulki
 * z dwudziestościanu w jednym kolorze — wyglądały sztucznie).
 *
 * Każdy kłąb to niewidoczny sześcian; promień z oka przechodzi przez niego i zbiera gęstość z trójwymiarowego szumu
 * zamkniętego w miękkiej kuli. Brzeg jest postrzępiony i rozwiewa się, środek gęstszy, wierzch jaśniejszy od spodu
 * (światło z góry), z każdej strony widać ten sam kłąb — nic nie obraca się za kamerą.
 * - dym z ognia: ciemny, sadzowy, u młodego kłębu podświetlony od spodu żarem; z wiekiem szarzeje, rośnie i rzednie;
 * - para z czaru wody: jasna, chłodnobiała, szybciej się rozwiewa.
 *
 * Wydajność: jedna siatka instancji (jedno wywołanie rysowania), stała pula, krótki marsz promienia (kłęby są małe na ekranie).
 */
const MAX = 260;

const VERT = /* glsl */ `
attribute vec4 aPuff; // x = wiek 0..1, y = ziarno, z = rodzaj (0 dym, 1 para), w = siła
varying vec3 vLocal;
varying vec3 vCam;
varying vec4 vPuff;
varying float vSize;
void main() {
  mat4 mm = modelMatrix * instanceMatrix;
  vLocal = position;
  vCam = (inverse(mm) * vec4(cameraPosition, 1.0)).xyz;
  vPuff = aPuff;
  vSize = length(mm[0].xyz);
  gl_Position = projectionMatrix * viewMatrix * mm * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float time;
varying vec3 vLocal;
varying vec3 vCam;
varying vec4 vPuff;
varying float vSize;
${FIRE_NOISE}
float density(vec3 q, float age, float seed, float steam) {
  // kłąb: miękka kula, szum zjada brzeg coraz mocniej z wiekiem (rozwiewa się), wnętrze wiruje i unosi się
  vec3 w = q * 3.2 + vec3(seed * 7.1, seed * 3.7 - time * 0.55, seed * 5.3);
  float n = fFbm(w, 4);
  float r = length(q * vec3(1.0, 0.85, 1.0)) * 2.0; // 0 w środku, 1 na ścianie sześcianu
  float edge = 0.62 + 0.3 * (1.0 - age) - steam * 0.08;
  float d = 1.0 - smoothstep(edge - 0.45, edge, r + (n - 0.5) * (0.75 + age * 0.55));
  return d * (0.35 + n * 1.15);
}
void main() {
  float age = vPuff.x, seed = vPuff.y, steam = vPuff.z, power = vPuff.w;
  vec3 o = vCam;
  vec3 d = normalize(vLocal - vCam);
  vec2 tt = fBox(o, d, vec3(-0.5), vec3(0.5));
  float t0 = max(tt.x, 0.0), t1 = tt.y;
  if (t1 <= t0) discard;
  const int N = 14;
  float ds = (t1 - t0) / float(N);
  float t = t0 + ds * fHash(vec3(gl_FragCoord.xy, seed * 13.0));
  float dsm = ds * vSize;
  // gęstość w metrach: drobny kłąb musi zasłaniać tak samo jak duży, więc dzielimy przez rozmiar
  float k = power * (steam > 0.5 ? 9.0 : 13.0) * (1.0 - age * 0.55) / max(0.06, vSize);
  // barwy: sadza (ciemna, lekko ciepła) albo para (chłodna biel); młody dym od spodu żarzy się
  vec3 lit = steam > 0.5 ? vec3(0.86, 0.91, 0.96) : mix(vec3(0.16, 0.14, 0.12), vec3(0.38, 0.36, 0.34), age);
  vec3 shade = steam > 0.5 ? vec3(0.52, 0.6, 0.7) : vec3(0.05, 0.045, 0.04);
  vec3 ember = vec3(1.0, 0.36, 0.08) * (1.0 - steam) * pow(1.0 - age, 3.0) * 1.4;
  vec3 col = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < N; i++) {
    vec3 q = o + d * t;
    float dn = density(q, age, seed, steam);
    if (dn > 0.01) {
      // światło z góry: próbka nieco wyżej — im mniej dymu nad punktem, tym jaśniej (samocień kłębu)
      float above = density(q + vec3(0.0, 0.16, 0.0), age, seed, steam);
      float light = clamp(1.0 - above * 1.3, 0.0, 1.0);
      float low = 1.0 - smoothstep(-0.45, 0.1, q.y); // spód kłębu bliżej żaru
      vec3 c = mix(shade, lit, light * 0.85 + 0.15) + ember * low;
      float a = 1.0 - exp(-dn * k * dsm);
      col += T * c * a;
      T *= 1.0 - a;
      if (T < 0.04) break;
    }
    t += ds;
  }
  float alpha = 1.0 - T;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col / max(alpha, 0.001), alpha);
}`;

export class SpellSmoke {
  private readonly mesh: THREE.InstancedMesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly puff: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private n = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.puff = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    this.puff.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPuff', this.puff);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { time: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.BackSide, toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Początek klatki */
  begin(time: number): void { this.n = 0; this.mat.uniforms.time!.value = time; }

  /** Jeden kłąb: środek, średnica w metrach, wiek 0..1, ziarno, para (czar wody) czy dym, siła 0..1 */
  put(at: THREE.Vector3, size: number, age: number, seed: number, steam: boolean, power = 1): void {
    if (this.n >= MAX) return;
    // lekko spłaszczony i obrócony wg ziarna, żeby kłęby nie były identyczne
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, seed * 6.283);
    this.m.compose(at, this.q, this.s.set(size, size * 0.92, size));
    this.mesh.setMatrixAt(this.n, this.m);
    this.puff.setXYZW(this.n, age, seed, steam ? 1 : 0, power);
    this.n++;
  }

  /** Koniec klatki: wysłanie instancji */
  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (!this.n) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.puff.needsUpdate = true;
  }
}

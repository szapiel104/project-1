import * as THREE from 'three';
import { FIRE_NOISE } from './fireGlsl';

/**
 * Pożar budynku jako prawdziwy, objętościowy ogień (28.10.2026, wcześniej kilka płaskich płomyków zwróconych do kamery).
 * Wokół płonącego budynku stoi niewidoczna bryła; promień z oka przechodzi przez nią i zbiera ogień z trójwymiarowego
 * szumu, który unosi się w górę i przechyla z wiatrem. Ogień oblewa ściany i bucha nad dachem, nie pali się równo
 * (gorące miejsca wędrują po budynku), wyżej przechodzi w czarny dym. Przy gaszeniu przygasa razem z siłą pożaru.
 * Jedna siatka na płonący budynek, liczy się tylko to, co zasłania ogień na ekranie.
 */
const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vScale;
void main() {
  vLocal = position;
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float time;
uniform float heat;
uniform float seed;
uniform float roof;
uniform float tall;
uniform vec2 foot;
varying vec3 vLocal;
varying vec3 vCam;
varying vec3 vScale;
${FIRE_NOISE}
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec3 o = vCam;
  vec3 d = normalize(vLocal - vCam);
  vec2 tt = fBox(o, d, vec3(-0.5, 0.0, -0.5), vec3(0.5, 1.0, 0.5));
  float t0 = max(tt.x, 0.0), t1 = tt.y;
  if (t1 <= t0) discard;
  const int N = 44;
  float ds = (t1 - t0) / float(N);
  float t = t0 + ds * fHash(vec3(gl_FragCoord.xy, fract(time) * 97.0));
  float dsm = ds * length(d * vScale); // krok w metrach
  float tm = time + seed * 30.0;
  vec3 col = vec3(0.0);
  float T = 1.0; // ile światła z tła przechodzi
  float fireSeen = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 q = (o + d * t) * vScale; // metry: x, z od środka, y od podstawy
    // gorące miejsca wędrują po budynku powoli: jedna część dachu bucha, inna dopiero się tli, a część jeszcze stoi
    float hs = fNoise(vec3(q.xz * 0.6, tm * 0.03) + seed * 7.0);
    float cover = clamp(heat * 1.25 - 0.45 + (hs - 0.5) * 1.4, 0.0, 1.0);
    // lekki wiatr przechyla języki nad dachem
    float above = max(0.0, q.y - roof);
    vec2 xz = q.xz - vec2(0.22, 0.08) * above * (0.3 + 0.08 * sin(tm * 0.3 + seed * 5.0));
    // języki: drobny szum, rozciągnięty w pionie, unosi się spokojnie (dawniej za szybko)
    float n = fFbm(vec3(xz.x * 2.8, q.y * 0.9 - tm * 1.25, xz.y * 2.8) + seed * 11.0, 4);
    // ogień siedzi NA budynku: cienka warstwa na ścianach i na połaciach dachu (dach zwęża się ku kalenicy),
    // a nad kalenicą tylko krótkie języki — nic nie wylewa się na podwórko
    float eave = roof * 0.55;
    float r = clamp((q.y - eave) / max(0.2, roof - eave), 0.0, 1.0);
    vec2 footR = foot * (1.0 - 0.55 * r);
    float db = sdBox2(xz, footR);
    float onWall = smoothstep(-0.45, -0.1, db) * smoothstep(0.38, 0.05, db) * (1.0 - step(roof, q.y));
    float tongues = smoothstep(0.15, -0.35, db + above * 0.4) * step(roof * 0.85, q.y);
    float lat = max(onWall, tongues);
    float low = mix(smoothstep(0.0, eave, q.y) * 0.6, 1.0, smoothstep(eave * 0.6, eave, q.y)); // od dołu ściany słabiej
    float v = above / max(0.3, tall * (0.35 + 0.65 * cover));
    float m = lat * low * cover * (1.0 - smoothstep(0.35, 1.0, v + (n - 0.5) * 0.5));
    float dens = m > 0.01 ? clamp((n + 0.55 * m - 0.74) * 6.0, 0.0, 1.0) : 0.0;
    float ef = dens * 2.0;
    // nad płomieniami czarny, kłębiasty dym (dalej niesie go system dymu z cząstek)
    float es = 0.0;
    if (q.y > roof * 0.9) {
      float sm = fFbm(vec3(xz * 0.8, q.y * 0.6 - tm * 0.45) + seed * 3.0, 3);
      float sootMask = smoothstep(0.6, -0.3, db + above * 0.08) * smoothstep(0.25, 0.9, v) * heat;
      es = clamp((sm - 0.42) * 2.4, 0.0, 1.0) * sootMask;
    }
    if (ef + es > 0.001) {
      float temp = clamp(dens * (0.95 - 0.55 * clamp(v, 0.0, 1.0)) * (0.35 + 0.8 * n), 0.0, 1.0);
      fireSeen = max(fireSeen, temp);
      col += T * (fRamp(temp) * ef * 0.3 + vec3(0.03, 0.026, 0.022) * es * (0.4 + fireSeen * 1.5)) * dsm;
      T *= exp(-(ef * 0.35 + es * 1.1) * dsm);
      if (T < 0.03) break;
    }
    t += ds;
  }
  float a = 1.0 - T;
  if (a < 0.005 && dot(col, col) < 1e-5) discard;
  gl_FragColor = vec4(col, a);
}`;

const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

interface Fire { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; seen: boolean; born: number }

/** Nazwy części, które nie liczą się do obrysu budynku (flagi, znaki, dotychczasowe znaczniki ognia i dymu) */
const SKIP = new Set(['fire', 'flame', 'smoke', 'noworker', 'flagcloth', 'bannercloth', 'flagpole']);

/** Obrys budynku w świecie (bez flag i znaczków) — liczony raz, gdy zaczyna się pożar */
export function burnBox(mesh: THREE.Object3D): THREE.Box3 {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const walk = (o: THREE.Object3D): void => {
    if (SKIP.has(o.name)) return;
    const me = o as THREE.Mesh;
    if (me.isMesh && !(me as unknown as THREE.InstancedMesh).isInstancedMesh && me.geometry) box.expandByObject(me, false);
    for (const c of o.children) walk(c);
  };
  for (const c of mesh.children) walk(c);
  if (box.isEmpty()) box.setFromCenterAndSize(mesh.position.clone().setY(mesh.position.y + 0.75), new THREE.Vector3(1.5, 1.5, 1.5));
  return box;
}

export class Blaze {
  readonly group = new THREE.Group();
  private time = { value: 0 };
  private fires = new Map<number, Fire>();
  private camIn = new THREE.Box3();

  constructor() { this.group.name = 'pożary'; }

  begin(time: number): void {
    this.time.value = time;
    for (const f of this.fires.values()) f.seen = false;
  }

  /** Płonący budynek: id, obrys w świecie, siła pożaru 0..1, położenie kamery */
  add(id: number, box: THREE.Box3, heat: number, cam: THREE.Vector3, foot?: { w: number; h: number }): void {
    let f = this.fires.get(id);
    // obrys z działki budynku (pola), a nie z modelu razem ze snopkami, beczkami i płotem dookoła
    const sx = Math.min(box.max.x - box.min.x, foot ? foot.w * 0.96 : Infinity), sz = Math.min(box.max.z - box.min.z, foot ? foot.h * 0.96 : Infinity);
    const h = Math.max(0.8, box.max.y - box.min.y);
    const span = Math.max(sx, sz);
    const tall = 0.7 + span * 0.22;
    if (!f) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          time: this.time, heat: { value: 0.1 }, seed: { value: (id * 0.6180339) % 1 }, roof: { value: h }, tall: { value: tall },
          foot: { value: new THREE.Vector2(sx / 2, sz / 2) },
        },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false, premultipliedAlpha: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      });
      const mesh = new THREE.Mesh(BOX, mat);
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.name = 'pożar';
      const pad = 0.3;
      mesh.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
      mesh.scale.set(sx + pad * 2, h + tall + 1.6, sz + pad * 2);
      this.group.add(mesh);
      f = { mesh, mat, seen: true, born: this.time.value };
      this.fires.set(id, f);
    }
    f.seen = true;
    // siła pożaru zmienia się płynnie (gaszenie wiadrami nie skacze)
    // ogień rozpala się powoli (ok. 15 s od iskry do pełnego pożaru), a przy gaszeniu przygasa płynnie
    const grow = Math.min(1, Math.max(0.12, (this.time.value - f.born) / 15));
    const u = f.mat.uniforms.heat!;
    u.value += (heat * grow - u.value) * 0.03;
    // kamera w środku bryły (spacer przy płonącym budynku): rysujemy tylne ściany bez testu głębi, inaczej ogień by zniknął
    const m = f.mesh;
    this.camIn.min.set(m.position.x - m.scale.x / 2, m.position.y, m.position.z - m.scale.z / 2);
    this.camIn.max.set(m.position.x + m.scale.x / 2, m.position.y + m.scale.y, m.position.z + m.scale.z / 2);
    const inside = this.camIn.expandByScalar(0.05).containsPoint(cam);
    f.mat.side = inside ? THREE.BackSide : THREE.FrontSide;
    f.mat.depthTest = !inside;
  }

  end(): void {
    for (const [id, f] of this.fires) {
      if (f.seen) continue;
      this.group.remove(f.mesh);
      f.mat.dispose();
      this.fires.delete(id);
    }
  }
}

import * as THREE from 'three';

/**
 * Chmury jako prawdziwe obiekty na niebie nad mapą: każda to grono kłębów, które powoli płynie z wiatrem,
 * rodzi się (gęstnieje), oddycha (kłęby rosną i maleją) i rozpływa się. Ile ich jest i jak są ciemne, zależy od pogody.
 * Pod każdą chmurą po ziemi sunie jej miękki cień. Widać je z kamery nad osadą (w dali) i z oczu chłopa (nad głową).
 * Rysowane jednym wywołaniem: kłęby to instancje zwrócone zawsze do kamery.
 */
interface Puff { dx: number; dy: number; dz: number; r: number; ph: number }
interface Cloud { x: number; y: number; z: number; size: number; puffs: Puff[]; age: number; life: number; dark: number }

const MAX_CLOUDS = 34, MAX_PUFFS = 14;
const ALT = 82; // wysokość chmur: zawsze ponad kamerą strategiczną
const AREA = 260; // chmury żyją w kwadracie wokół środka widoku

function puffTexture(): THREE.Texture {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d')!;
  // kanał alfa: miękkie koło; kanał koloru: jasna góra, ciemniejszy spód (cieniowanie kłębu)
  const img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n * 2 - 1, v = (j + 0.5) / n * 2 - 1;
    const d = Math.sqrt(u * u + v * v);
    const a = Math.max(0, 1 - d);
    const k = (j * n + i) * 4;
    const light = Math.min(1, Math.max(0, 0.55 - v * 0.55 + (1 - d) * 0.25));
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(light * 255);
    img.data[k + 3] = Math.round(Math.pow(a, 0.9) * Math.min(1, a * 2.2) * 255);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const VERT = /* glsl */ `
uniform float far;
varying vec2 vUv;
varying vec3 vC;
varying float vFade;
void main() {
  vUv = uv;
  // kłąb zwrócony do kamery w przestrzeni świata (a nie do płaszczyzny ekranu): przy obracaniu głowy chmury stoją w miejscu
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float s = length(instanceMatrix[0].xyz);
  vec3 toCam = normalize(cameraPosition - center);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = cross(toCam, right);
  vec4 c = viewMatrix * vec4(center + (right * position.x + up * position.y) * s, 1.0);
  #ifdef USE_INSTANCING_COLOR
    vC = instanceColor;
  #else
    vC = vec3(1.0);
  #endif
  // daleko, tuż przed granicą widzenia kamery, chmura blednie zamiast być uciętą
  vFade = 1.0 - smoothstep(far * 0.62, far * 0.93, -c.z);
  gl_Position = projectionMatrix * c;
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 lit;
uniform vec3 shade;
uniform vec3 haze;
varying vec2 vUv;
varying vec3 vC;
varying float vFade;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vC.g * vFade;
  if (a < 0.008) discard;
  vec3 col = mix(shade, lit, t.r) * mix(1.0, 0.55, vC.b);
  col = mix(haze, col, 0.35 + 0.65 * vFade);
  gl_FragColor = vec4(col, a);
}`;

export class Clouds {
  readonly group = new THREE.Group();
  private clouds: Cloud[] = [];
  private mesh: THREE.InstancedMesh;
  private mat: THREE.ShaderMaterial;
  private shadows: THREE.InstancedMesh;
  private shadowMat: THREE.MeshBasicMaterial;
  private t = 0;
  private seed = 1;
  private rnd = (): number => { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; };

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: puffTexture() }, lit: { value: new THREE.Color(1, 1, 1) }, shade: { value: new THREE.Color(0.6, 0.64, 0.72) }, haze: { value: new THREE.Color(0.7, 0.72, 0.75) }, far: { value: 300 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), this.mat, MAX_CLOUDS * MAX_PUFFS);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    this.mesh.count = 0;
    const soft = document.createElement('canvas'); soft.width = soft.height = 64;
    const sx = soft.getContext('2d')!;
    const g = sx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = g; sx.fillRect(0, 0, 64, 64);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(soft), color: 0x0c1218, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.shadowMat, MAX_CLOUDS);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.group.add(this.mesh, this.shadows);
  }

  private spawn(focus: THREE.Vector3, anywhere: boolean, wind: THREE.Vector2): void {
    const r = this.rnd;
    // nowe chmury rodzą się na nawietrznej (albo gdziekolwiek przy starcie)
    let x: number, z: number;
    if (anywhere) { x = focus.x + (r() - 0.5) * AREA * 2; z = focus.z + (r() - 0.5) * AREA * 2; }
    else { const side = (r() - 0.5) * AREA * 2; x = focus.x - wind.x * AREA + -wind.y * side; z = focus.z - wind.y * AREA + wind.x * side; }
    const size = 14 + r() * 22;
    const puffs: Puff[] = [];
    const n = 6 + Math.floor(r() * (MAX_PUFFS - 6));
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * 2 - 1; // wzdłuż chmury
      const hump = 1 - Math.abs(t);
      puffs.push({ dx: t * size * 1.1 + (r() - 0.5) * size * 0.3, dy: hump * size * (0.25 + r() * 0.35), dz: (r() - 0.5) * size * 0.7, r: size * (0.35 + hump * 0.4 + r() * 0.2), ph: r() * 6.28 });
    }
    this.clouds.push({ x, y: ALT + (r() - 0.5) * 16, z, size, puffs, age: anywhere ? r() * 60 : 0, life: 150 + r() * 200, dark: 0 });
  }

  /**
   * Klatka: cover 0..1 (zachmurzenie), rain 0..1, night 0..1, kierunek słońca, kolor nieba przy horyzoncie,
   * środek widoku, wysokość terenu, odległość widzenia kamery.
   */
  update(dt: number, o: { cover: number; rain: number; night: number; sun: THREE.Vector3; haze: THREE.Color; focus: THREE.Vector3; camera: THREE.Camera; ground: (x: number, z: number) => number; far: number }): void {
    this.t += dt;
    const wind = new THREE.Vector2(0.92, 0.38).normalize();
    const speed = 1.2 + o.cover * 1.6 + o.rain * 1.5;
    // ile chmur na niebie: kilka zawsze, więcej przy zachmurzeniu i w deszczu
    const want = Math.min(MAX_CLOUDS, Math.round(4 + o.cover * 22 + o.rain * 8));
    if (!this.clouds.length) for (let i = 0; i < want; i++) this.spawn(o.focus, true, wind);
    else if (this.clouds.filter((c) => c.age < c.life).length < want && this.rnd() < dt * 0.5) this.spawn(o.focus, false, wind);
    for (const c of this.clouds) {
      c.age += dt;
      c.x += wind.x * speed * dt; c.z += wind.y * speed * dt;
      c.dark += ((o.rain > 0.3 ? 1 : o.cover * 0.5) - c.dark) * Math.min(1, dt * 0.2);
      // chmura, która odpłynęła daleko od widoku, kończy życie
      if (Math.abs(c.x - o.focus.x) > AREA * 1.3 || Math.abs(c.z - o.focus.z) > AREA * 1.3) c.age = Math.max(c.age, c.life);
    }
    this.clouds = this.clouds.filter((c) => c.age < c.life + 25);
    // nadmiar chmur (pogoda się przejaśnia) rozpływa się
    let alive = this.clouds.filter((c) => c.age < c.life);
    for (let i = want; i < alive.length; i++) alive[i]!.life = Math.min(alive[i]!.life, alive[i]!.age);
    alive = this.clouds;

    // barwy: w dzień białe z szaroniebieskim spodem, o zachodzie ciepłe, w deszczu ołowiane, nocą ciemne
    const u = this.mat.uniforms;
    const lowSun = Math.max(0, 1 - Math.max(0, o.sun.y) * 2.2);
    (u.lit!.value as THREE.Color).setRGB(1, 0.97 - lowSun * 0.2, 0.93 - lowSun * 0.35).lerp(new THREE.Color(0.16, 0.18, 0.25), o.night);
    (u.shade!.value as THREE.Color).setRGB(0.58, 0.62, 0.7).lerp(new THREE.Color(0.06, 0.07, 0.1), o.night);
    (u.haze!.value as THREE.Color).copy(o.haze);
    u.far!.value = o.far;

    const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), C = new THREE.Color();
    let n = 0, sh = 0;
    for (const c of alive) {
      const fadeIn = Math.min(1, c.age / 20), fadeOut = Math.min(1, Math.max(0, (c.life + 25 - c.age) / 25));
      const life = fadeIn * fadeOut;
      if (life <= 0) continue;
      for (const p of c.puffs) {
        if (n >= MAX_CLOUDS * MAX_PUFFS) break;
        // kłęby oddychają: powoli rosną i maleją; młoda chmura dopiero się nadyma
        const breathe = 1 + Math.sin(this.t * 0.07 + p.ph) * 0.1;
        const grow = 0.55 + 0.45 * fadeIn;
        P.set(c.x + p.dx * grow, c.y + p.dy * grow, c.z + p.dz * grow);
        S.setScalar(p.r * breathe * grow);
        this.mesh.setMatrixAt(n, M.compose(P, Q, S));
        this.mesh.setColorAt(n, C.setRGB(1, life * (0.85 + o.rain * 0.15), c.dark));
        n++;
      }
      // cień chmury na ziemi, przesunięty od słońca
      if (sh < MAX_CLOUDS && o.night < 0.6) {
        const k = o.sun.y > 0.15 ? c.y / o.sun.y : 0;
        const gx = c.x - o.sun.x * k * 0.25, gz = c.z - o.sun.z * k * 0.25;
        P.set(gx, o.ground(gx, gz) + 0.2, gz);
        S.set(c.size * 3.2, 1, c.size * 1.8);
        this.shadows.setMatrixAt(sh, M.compose(P, Q, S));
        sh++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.shadows.count = sh;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.shadowMat.opacity = 0.16 * (1 - o.night) * (0.6 + o.cover * 0.4) * (1 - o.rain * 0.5);
  }

  reset(): void { this.clouds = []; }
}

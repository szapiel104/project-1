/**
 * Krew pod poległymi (Michał 28.10.2026: „krew lepsza jak plama, a nie okrągła”, „dynamiczna krew”).
 * Nieregularna plama z bryzgami i kroplami (maska rysowana raz na płótnie), każda obrócona i rozciągnięta inaczej.
 * Plama rozlewa się po upadku przez ok. 20 s, świeża jest jaskrawoczerwona i mokra, potem ciemnieje i brązowieje.
 * Leży na wierzchu terenu (przesunięcie głębi), żeby na śniegu i zboczu nie była ucinana jak kawałek tortu.
 */
import * as THREE from 'three';

/** Maska plamy: zlane kleksy z poszarpanym brzegiem, kilka smug w bok i kropelki dookoła */
function splatMask(): THREE.CanvasTexture {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blob = (x: number, y: number, r: number, a: number): void => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.7, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  };
  // rdzeń kałuży: kilka zlanych kleksów, nie w jednym środku
  for (let i = 0; i < 9; i++) blob(S / 2 + (rnd() - 0.5) * 70, S / 2 + (rnd() - 0.5) * 50, 26 + rnd() * 30, 0.95);
  // smugi: wąskie języki wypływające w bok, zakończone kroplą
  for (let i = 0; i < 3; i++) {
    const ang = rnd() * Math.PI * 2, len = 20 + rnd() * 30;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, r = (14 - t * 9) * (0.7 + rnd() * 0.5);
      blob(S / 2 + Math.cos(ang) * (30 + t * len), S / 2 + Math.sin(ang) * (30 + t * len), r, 0.9);
    }
  }
  // bryzgi: drobne krople rozrzucone wokół
  for (let i = 0; i < 12; i++) {
    const ang = rnd() * Math.PI * 2, d = 50 + rnd() * 35;
    blob(S / 2 + Math.cos(ang) * d, S / 2 + Math.sin(ang) * d, 2 + rnd() * 5, 0.85);
  }
  // twardszy brzeg: progowanie jasności, żeby plama miała ostry, poszarpany kontur zamiast rozmytej mgiełki
  const img = c.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]! / 255, a = Math.max(0, Math.min(1, (v - 0.35) * 4));
    d[i] = d[i + 1] = d[i + 2] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const FRESH = new THREE.Color(0x5e0a06), OLD = new THREE.Color(0x2a130c);
const col = new THREE.Color(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), s = new THREE.Vector3(), p = new THREE.Vector3();

export class BloodStains {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(max: number) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, alphaMap: splatMask(), transparent: true, depthWrite: false, roughness: 0.35, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  }

  begin(): void { this.n = 0; }

  /**
   * Plama pod ciałem: `id` daje własny obrót i kształt, `spread` 0..1 to rozlewanie po upadku, `age` 0..1 rozkład
   * (ciemnieje i jeszcze trochę wsiąka szerzej).
   */
  /** `slope` = nachylenie terenu (dh/dx, dh/dz): plama kładzie się na zboczu, a nie wisi płasko i nie chowa się do połowy w ziemi */
  add(id: number, x: number, y: number, z: number, spread: number, age: number, slope: [number, number] = [0, 0]): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    const r = (id * 0.6180339887) % 1, r2 = (id * 0.7548776662) % 1;
    const grow = 1 - (1 - spread) ** 2; // szybko na początku, potem coraz wolniej
    // mała plama pod ciałem (Michał 28.10.2026: „aż za dużo krwi”): do ok. pół pola, nie kałuża na pół podwórka
    const size = (0.14 + 0.36 * grow) * (0.85 + r2 * 0.3) * (1 + age * 0.12);
    q.setFromAxisAngle(up, r * Math.PI * 2);
    nrm.set(-slope[0], 1, -slope[1]).normalize();
    q.premultiply(q2.setFromUnitVectors(up, nrm));
    s.set(size * (0.8 + r * 0.45), 1, size * (1.2 - r * 0.4));
    p.set(x, y, z);
    this.mesh.setMatrixAt(this.n, new THREE.Matrix4().compose(p, q, s));
    // świeża: czerwona; z czasem ciemnieje do brązu
    col.copy(FRESH).lerp(OLD, Math.min(1, spread * 0.25 + age * 0.9));
    this.mesh.setColorAt(this.n, col);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

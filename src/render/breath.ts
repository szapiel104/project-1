/**
 * Para z ust na mrozie (Michał 29.10.2026, z listy „Pory roku — dalej”): przy temperaturze poniżej ok. 2°C ludzie
 * i żołnierze co kilka sekund wypuszczają przed siebie mały obłoczek pary — rośnie, unosi się i rozwiewa w ok. sekundę.
 * Tylko blisko kamery (dalej i tak tego nie widać), jedna wspólna siatka dla wszystkich obłoczków.
 */
import * as THREE from 'three';

const MAX = 320;
/** Co ile sekund oddech (każdy z innym przesunięciem) i jak długo żyje obłoczek */
const EVERY = 3.4, LIFE = 1.3;
/** Dalej od kamery (w polach) para się nie pokazuje */
const NEAR = 22;

interface Puff { x: number; y: number; z: number; vx: number; vz: number; t: number; s: number }

export class BreathFx {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private last = new Map<number, number>();
  private cold = 0;
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0.32, depthWrite: false, roughness: 1 });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'breath';
    scene.add(this.mesh);
  }

  /** Jak bardzo zimno: temperatura w °C (para od ok. 2°C w dół, gęstsza przy mrozie) */
  setTemp(temp: number): void { this.cold = Math.max(0, Math.min(1, (2 - temp) / 6)); }

  /**
   * Postać w tej klatce (współrzędne sceny): usta na wysokości `y`, patrzy w `heading`. Oddycha co EVERY sekund;
   * `cam` = położenie kamery (dalej niż NEAR nie dmucha).
   */
  breathe(id: number, x: number, y: number, z: number, heading: number, time: number, cam: THREE.Vector3, hard = false): void {
    if (this.cold <= 0) return;
    if (Math.abs(x - cam.x) > NEAR || Math.abs(z - cam.z) > NEAR) return;
    // przy wysiłku (walka, bieg) częściej
    const every = hard ? EVERY * 0.55 : EVERY;
    const k = Math.floor((time + (id * 0.618) % 1 * every) / every);
    const was = this.last.get(id);
    this.last.set(id, k);
    if (was === undefined || was === k || this.puffs.length >= MAX) return;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    this.puffs.push({ x: x + fx * 0.05, y, z: z + fz * 0.05, vx: fx * 0.14, vz: fz * 0.14, t: 0, s: 0.03 + this.cold * 0.025 });
  }

  update(dt: number): void {
    if (this.last.size > 4000) this.last.clear();
    let n = 0;
    const keep: Puff[] = [];
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t >= LIFE) continue;
      keep.push(p);
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += 0.05 * dt;
      p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      // rośnie szybko, potem rzednie (zmniejsza się do zera, bo przezroczystość jest wspólna)
      const f = p.t / LIFE, size = p.s * (f < 0.3 ? 0.5 + f / 0.3 * 0.9 : 1.4 * (1 - (f - 0.3) / 0.7) ** 0.7);
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q.identity(), this.sc.set(size, size * 0.8, size));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.puffs = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

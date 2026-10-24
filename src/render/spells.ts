import * as THREE from 'three';

/**
 * Czary magów bojowych w locie (tylko wygląd; trafienie liczy symulacja w chwili rzutu, jak przy strzałach).
 * Kula ognia: pomarańczowa, jarząca się kula z żywym płomieniem (rysuje go system ognia ze scene.ts) i dymiącym
 * rozbłyskiem przy celu. Czar wody: błękitna kula z jaśniejszym jądrem, przy celu rozprysk — krótko rosnąca,
 * blednąca bańka. Leci łukiem, szybciej niż strzała z łuku po płaskim torze, bo mag ciska z bliższego dystansu.
 */
interface Shot { from: THREE.Vector3; to: THREE.Vector3; t: number; fire: boolean; dur: number }
interface Burst { at: THREE.Vector3; t: number; fire: boolean }

const MAX = 128;
const FIRE = new THREE.Color(0xff7a22), FIRE_CORE = new THREE.Color(0xffe2a0);
const WATER = new THREE.Color(0x4aa8ff), WATER_CORE = new THREE.Color(0xdff2ff);

export class SpellLayer {
  private shots: Shot[] = [];
  private bursts: Burst[] = [];
  private readonly glow: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly ring: THREE.InstancedMesh;
  private readonly flameAt: THREE.Vector3[] = [];
  private flameN = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const add = (geo: THREE.BufferGeometry, opacity: number): THREE.InstancedMesh => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.InstancedMesh(geo, mat, MAX);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, FIRE);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      return mesh;
    };
    this.glow = add(new THREE.SphereGeometry(1, 14, 10), 0.5);
    this.core = add(new THREE.SphereGeometry(1, 12, 8), 0.95);
    this.ring = add(new THREE.SphereGeometry(1, 16, 10), 0.45);
  }

  /** Rzut czaru z dłoni maga (`from`) do celu (`to`), oba w układzie świata */
  cast(from: THREE.Vector3, to: THREE.Vector3, fire: boolean): void {
    if (this.shots.length >= MAX) return;
    this.shots.push({ from: from.clone(), to: to.clone(), t: 0, fire, dur: 0.25 + Math.min(0.35, from.distanceTo(to) * 0.05) });
  }

  /** Płomienie kul ognia w tej klatce (rysuje je wspólny system ognia sceny) */
  flames(): readonly THREE.Vector3[] { return this.flameAt.slice(0, this.flameN); }

  /** Klatka: kule lecą łukiem, przy celu rozbłysk albo rozprysk; `time` do migotania */
  update(dt: number, time: number): void {
    const next: Shot[] = [];
    for (const a of this.shots) {
      a.t += dt / a.dur;
      if (a.t >= 1) { if (this.bursts.length < MAX) this.bursts.push({ at: a.to.clone(), t: 0, fire: a.fire }); }
      else next.push(a);
    }
    this.shots = next;
    this.bursts = this.bursts.filter((b) => (b.t += dt / 0.4) < 1);
    let n = 0, r = 0;
    this.flameN = 0;
    for (const a of this.shots) {
      const arc = Math.sin(a.t * Math.PI) * a.from.distanceTo(a.to) * 0.18;
      this.p.lerpVectors(a.from, a.to, a.t); this.p.y += arc;
      const flick = 1 + Math.sin(time * 40 + a.t * 9) * 0.12;
      this.put(this.glow, n, this.p, (a.fire ? 0.13 : 0.11) * flick, a.fire ? FIRE : WATER);
      this.put(this.core, n, this.p, (a.fire ? 0.06 : 0.055) * flick, a.fire ? FIRE_CORE : WATER_CORE);
      n++;
      if (a.fire) {
        const v = this.flameAt[this.flameN] ?? (this.flameAt[this.flameN] = new THREE.Vector3());
        v.copy(this.p).setY(this.p.y - 0.08);
        this.flameN++;
      }
    }
    for (const b of this.bursts) {
      // rozbłysk: szybko rośnie i blednie (przy additive blednięcie = mniejsza jasność koloru)
      const k = 1 - b.t;
      this.s.set(1, 1, 1);
      const c = (b.fire ? FIRE : WATER).clone().multiplyScalar(k);
      this.put(this.ring, r++, b.at, (b.fire ? 0.2 : 0.18) + b.t * (b.fire ? 0.45 : 0.55), c, b.fire ? 1 : 0.55);
      if (b.fire && b.t < 0.5 && this.flameN < 64) {
        const v = this.flameAt[this.flameN] ?? (this.flameAt[this.flameN] = new THREE.Vector3());
        v.copy(b.at).setY(b.at.y - 0.05);
        this.flameN++;
      }
    }
    this.glow.count = n; this.core.count = n; this.ring.count = r;
    for (const mesh of [this.glow, this.core, this.ring]) {
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private put(mesh: THREE.InstancedMesh, i: number, at: THREE.Vector3, size: number, color: THREE.Color, squash = 1): void {
    this.m.compose(at, this.q, this.s.set(size, size * squash, size));
    mesh.setMatrixAt(i, this.m);
    mesh.setColorAt(i, color);
  }
}

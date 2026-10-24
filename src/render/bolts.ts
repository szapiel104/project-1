import * as THREE from 'three';

/**
 * Piorun w budynek (tylko wygląd; trafienie i pożar liczy symulacja, storms.ts): poszarpany, jasny kanał z chmur
 * do dachu z dwiema bocznymi odnogami, który miga i gaśnie w pół sekundy. Kształt losuje się raz przy uderzeniu.
 */
interface Bolt { group: THREE.Group; t: number }

const LIFE = 0.55;

export class BoltLayer {
  private bolts: Bolt[] = [];
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private readonly glow = new THREE.MeshBasicMaterial({ color: 0x7f9cff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private readonly unit = new THREE.CylinderGeometry(1, 1, 1, 5, 1, false);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly scene: THREE.Scene) {}

  /** Uderzenie w punkt świata (x, y = wysokość dachu, z) */
  strike(x: number, y: number, z: number): void {
    const group = new THREE.Group();
    group.renderOrder = 6;
    const top = new THREE.Vector3(x + (Math.random() - 0.5) * 4, y + 22, z + (Math.random() - 0.5) * 4);
    const main = this.path(top, new THREE.Vector3(x, y, z), 11, 1.4);
    this.chain(group, main, 0.05);
    // dwie odnogi z górnej połowy kanału, krótsze i cieńsze
    for (const k of [3, 6]) {
      const from = main[k]!;
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, -4 - Math.random() * 4, (Math.random() - 0.5) * 6));
      this.chain(group, this.path(from, to, 5, 1), 0.025);
    }
    this.scene.add(group);
    this.bolts.push({ group, t: 0 });
  }

  /** Klatka: piorun miga (dwa przebłyski) i blednie */
  update(dt: number): void {
    for (const b of this.bolts) {
      b.t += dt;
      const k = b.t / LIFE;
      b.group.visible = k < 0.25 || (k > 0.35 && k < 0.6) || (k > 0.7 && Math.random() < 0.5);
      b.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.scale.x = m.scale.z = (m.userData.r as number) * (1 - k * 0.6); });
    }
    for (const b of this.bolts.filter((x) => x.t >= LIFE)) this.scene.remove(b.group);
    this.bolts = this.bolts.filter((x) => x.t < LIFE);
  }

  /** Łamana od `a` do `b` z bocznymi uskokami (największe w środku) */
  private path(a: THREE.Vector3, b: THREE.Vector3, n: number, jag: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i > 0 && i < n) { const s = Math.sin((i / n) * Math.PI) * jag; p.x += (Math.random() - 0.5) * 2 * s; p.z += (Math.random() - 0.5) * 2 * s; }
      out.push(p);
    }
    return out;
  }

  /** Odcinki łamanej jako cienkie walce: jasny rdzeń i szersza, błękitna poświata */
  private chain(group: THREE.Group, pts: THREE.Vector3[], r: number): void {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!, len = a.distanceTo(b);
      const dir = b.clone().sub(a).normalize();
      for (const [mat, rr] of [[this.mat, r], [this.glow, r * 4]] as const) {
        const m = new THREE.Mesh(this.unit, mat);
        m.position.copy(a).lerp(b, 0.5);
        m.quaternion.setFromUnitVectors(this.up, dir);
        m.scale.set(rr, len, rr);
        m.userData.r = rr;
        m.frustumCulled = false;
        group.add(m);
      }
    }
  }
}

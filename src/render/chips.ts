import * as THREE from 'three';
import { touch } from './touch';

/**
 * Grudki spod kilofa: przy każdym ciosie górnika odpryskuje kilka okruchów skały i rudy, spadają na ziemię,
 * odbijają się raz i znikają. Tylko wygląd, tylko z bliska (o tym decyduje scena), jedna siatka na wszystkie.
 */
type Chip = { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; floor: number; t: number; life: number; s: number; ore: boolean };

const MAX = 192;

export class Chips {
  readonly group = new THREE.Group();
  private list: Chip[] = [];
  private rock: THREE.InstancedMesh;
  private ore: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();

  constructor() {
    // nieregularny okruch: dwudziestościan ze spłaszczonymi i pociągniętymi wierzchołkami
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.7 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.5;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    // zwykła skała ściany: szarobrązowa, matowa
    this.rock = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x6b625a, roughness: 0.95, flatShading: true }), MAX);
    // ruda jak w Gothicu: ciemny fiolet z błękitnym połyskiem, lekko świeci w mroku sztolni
    this.ore = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2148, emissive: 0x3b4cc0, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3, flatShading: true }), MAX);
    for (const im of [this.rock, this.ore]) { im.count = 0; im.frustumCulled = false; this.group.add(im); }
    this.group.name = 'okruchy spod kilofa';
  }

  /** Cios w punkcie (x, y, z) na ścianie; (dx, dz) = kierunek, w który patrzy górnik; `floor` = wysokość podłogi; `ore` = jaka część okruchów to ruda */
  hit(x: number, y: number, z: number, dx: number, dz: number, floor: number, ore = 0.45): void {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n && this.list.length < MAX * 2; i++) {
      // odpryskują od ściany z powrotem w stronę górnika i na boki
      const side = (Math.random() - 0.5) * 0.6, back = 0.15 + Math.random() * 0.35; // skala świata: człowiek ma ok. 0,4
      this.list.push({
        p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.04, y + (Math.random() - 0.5) * 0.05, z + (Math.random() - 0.5) * 0.04),
        v: new THREE.Vector3(-dx * back + -dz * side, 0.25 + Math.random() * 0.45, -dz * back + dx * side),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        floor, t: 0, life: 1.4 + Math.random() * 0.8, s: 0.007 + Math.random() * 0.009, ore: Math.random() < ore,
      });
    }
  }

  /** Ruch co klatkę: lot, jedno odbicie od podłogi, chwila leżenia i zniknięcie (kurczy się) */
  step(dt: number): void {
    if (!this.list.length && !this.rock.count && !this.ore.count) return;
    this.list = this.list.filter((c) => (c.t += dt) < c.life);
    let nr = 0, no = 0;
    for (const c of this.list) {
      c.v.y -= 3.2 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.floor + c.s) {
        c.p.y = c.floor + c.s;
        if (c.v.y < -0.15) { c.v.y *= -0.3; c.v.x *= 0.5; c.v.z *= 0.5; c.w.multiplyScalar(0.4); }
        else { c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
      }
      c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
      const fade = Math.min(1, (c.life - c.t) / 0.4);
      this.sc.setScalar(c.s * fade);
      this.m.compose(c.p, this.q.setFromEuler(c.r), this.sc);
      if (c.ore) { if (no < MAX) this.ore.setMatrixAt(no++, this.m); }
      else if (nr < MAX) this.rock.setMatrixAt(nr++, this.m);
    }
    this.rock.count = nr; this.ore.count = no;
    touch(this.rock); touch(this.ore);
  }
}

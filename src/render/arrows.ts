/**
 * Strzały w locie (wyniesione z scene.ts, 24.10.2026): łuk balistyczny od łucznika do celu (ok. 0,45 s),
 * jasna smuga za strzałą, a przy ognistej strzale pomarańczowa smuga i płomyk na grocie (rysuje go system ognia).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint } from './loads';
import { touch } from './touch';

/** Barwa smugi za strzałą: zwykła (jasna) i ognista (pomarańczowa) */
const PLAIN_TRAIL = new THREE.Color(0xd8d0c0), FIRE_TRAIL = new THREE.Color(0xff8a30);
/** Najwięcej strzał naraz w powietrzu */
export const MAX_ARROWS = 256;

export class ArrowLayer {
  private arrowMesh: THREE.InstancedMesh;
  private arrowTrail: THREE.InstancedMesh;
  private arrows: { from: THREE.Vector3; to: THREE.Vector3; t: number; fire?: boolean; arc: number }[] = [];
  /** Groty ognistych strzał w locie (pierwsze `fireN`) — płomyki rysuje system ognia */
  readonly fires: THREE.Vector3[] = [];
  fireN = 0;

  constructor(scene: THREE.Scene) {
    this.arrowMesh = new THREE.InstancedMesh(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4).rotateX(Math.PI / 2), 0x8a6a42),
      tint(new THREE.ConeGeometry(0.02, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0, 0.27), 0x6a6e76),
      tint(new THREE.BoxGeometry(0.04, 0.002, 0.08).translate(0, 0, -0.22), 0xe8e0c8),
    ])!, new THREE.MeshStandardMaterial({ vertexColors: true }), MAX_ARROWS);
    // smuga za strzałą: jasny, gasnący pas, żeby lot było widać z daleka i nocą
    // smuga: delikatna, jaśniejsza przy strzale i zanikająca ku tyłowi (gradient w kolorach wierzchołków)
    const trailGeo = new THREE.PlaneGeometry(0.03, 1, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
    {
      const pos = trailGeo.getAttribute('position'), col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const k = 1 + pos.getZ(i); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.max(0, k) ** 1.5; }
      trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    this.arrowTrail = new THREE.InstancedMesh(trailGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), MAX_ARROWS);
    this.arrowTrail.setColorAt(0, PLAIN_TRAIL); // barwa smugi na instancję: zwykła jasna, ognista pomarańczowa
    this.arrowTrail.count = 0; this.arrowTrail.frustumCulled = false; scene.add(this.arrowTrail);
    this.arrowMesh.count = 0; this.arrowMesh.frustumCulled = false; scene.add(this.arrowMesh);
  }

  /** Ile strzał jest teraz w powietrzu */
  get count(): number { return this.arrows.length; }

  /** Nowa strzała z `from` do `to` (położenia w świecie) */
  /** Każda strzała wylatuje z innego miejsca dłoni i celuje w inne miejsce sylwetki, więc kilka naraz nie leci jedną kreską */
  shoot(from: THREE.Vector3, to: THREE.Vector3, fire: boolean): void {
    const j = (): number => (Math.random() - 0.5);
    from.x += j() * 0.22; from.z += j() * 0.22; from.y += j() * 0.1;
    to.x += j() * 0.3; to.z += j() * 0.3; to.y += j() * 0.25;
    this.arrows.push({ from, to, t: 0, fire, arc: 0.08 + Math.random() * 0.08 });
  }

  /** Strzały w locie: łuk balistyczny od łucznika do celu, ok. 0,4 s (tyle leci w symulacji, army.ts ARROW_TICKS — trafia, gdy doleci) */
  fly(calm: boolean): void {
    const dt = calm ? 1 : 1 / 60;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), nx = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    this.arrows = this.arrows.filter((a) => (a.t += dt / 0.4) < 1);
    this.fireN = 0;
    for (const a of this.arrows) {
      const arc = Math.sin(a.t * Math.PI) * a.from.distanceTo(a.to) * a.arc;
      p.lerpVectors(a.from, a.to, a.t); p.y += arc;
      nx.lerpVectors(a.from, a.to, Math.min(1, a.t + 0.05)); nx.y += Math.sin(Math.min(1, a.t + 0.05) * Math.PI) * a.from.distanceTo(a.to) * a.arc;
      m.lookAt(nx, p, new THREE.Vector3(0, 1, 0));
      q.setFromRotationMatrix(m);
      m.compose(p, q, one);
      this.arrowMesh.setMatrixAt(n, m);
      // ognista strzała: płomyk na grocie (rysuje go system ognia) i pomarańczowa, dłuższa smuga dymu i iskier
      if (a.fire) {
        const v = this.fires[this.fireN] ?? (this.fires[this.fireN] = new THREE.Vector3());
        v.copy(nx).sub(p).normalize().multiplyScalar(0.24).add(p).setY(v.y - 0.06);
        this.fireN++;
      }
      this.arrowTrail.setColorAt(n, a.fire ? FIRE_TRAIL : PLAIN_TRAIL);
      // smuga: rozciągnięta do tyłu, dłuższa przy szybkim, dalekim strzale
      m.compose(p, q, new THREE.Vector3(a.fire ? 1.8 : 1, 1, Math.min(1.6, 0.4 + a.from.distanceTo(a.to) * 0.12) * (a.fire ? 1.4 : 1)));
      this.arrowTrail.setMatrixAt(n++, m);
    }
    this.arrowMesh.count = n;
    touch(this.arrowMesh);
    this.arrowTrail.count = n;
    if (this.arrowTrail.instanceColor) this.arrowTrail.instanceColor.needsUpdate = true;
    touch(this.arrowTrail);
  }
}

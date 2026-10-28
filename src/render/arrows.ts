/**
 * Strzały w locie (wyniesione z scene.ts, 24.10.2026): łuk balistyczny od łucznika do celu (ok. 0,45 s),
 * jasna smuga za strzałą, a przy ognistej strzale pomarańczowa smuga i płomyk na grocie (rysuje go system ognia).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint } from './loads';
import { touch } from './touch';
import type { WorldSound } from '../audio/bank';

/** Barwa smugi za strzałą: zwykła (jasna) i ognista (pomarańczowa) */
const UP = new THREE.Vector3(0, 1, 0);
const PLAIN_TRAIL = new THREE.Color(0xd8d0c0), FIRE_TRAIL = new THREE.Color(0xb85a26);
/** Najwięcej strzał naraz w powietrzu */
export const MAX_ARROWS = 256;
/** Strzały wbite po bitwie (Michał 28.10.2026): najwięcej tyle naraz, każda stoi `STUCK_LIFE` s, w ostatnich
 *  `STUCK_FADE` s chowa się w ziemię albo w ścianę i znika. W ciałach zostają, dopóki leży ciało (najwyżej 3 w jednym). */
const MAX_STUCK = 600, STUCK_LIFE = 90, STUCK_FADE = 3, MAX_BODY = 512, PER_BODY = 3;
/** Gdzie wbija się strzała: w ziemię, w ścianę budynku albo w człowieka (id jak id ciała po śmierci) */
export type Stick = { ground?: boolean; wall?: boolean; unit?: number };

export class ArrowLayer {
  private arrowMesh: THREE.InstancedMesh;
  private arrowTrail: THREE.InstancedMesh;
  private arrows: { from: THREE.Vector3; to: THREE.Vector3; t: number; fire?: boolean; arc: number; hit?: WorldSound; whoosh?: boolean; stick?: Stick }[] = [];
  /** Wbite w ziemię i ściany: miejsce, obrót (grot w środek), kierunek lotu i chwila wbicia */
  private stuck: { p: THREE.Vector3; q: THREE.Quaternion; d: THREE.Vector3; at: number }[] = [];
  /** Ile strzał tkwi w kim (id żołnierza albo chłopa = id jego ciała) i kiedy ostatnio */
  private inBody = new Map<number, { n: number; at: number }>();
  private stuckMesh: THREE.InstancedMesh;
  private bodyN = 0;
  private clock = 0;
  /** Wysokość terenu w punkcie świata (ustawia scene.ts) — strzała w ziemię wbija się w teren, a nie w powietrze */
  groundAt: (x: number, z: number) => number = () => 0;
  /** Groty ognistych strzał w locie (pierwsze `fireN`) — płomyki rysuje system ognia */
  readonly fires: THREE.Vector3[] = [];
  fireN = 0;

  /** `land` — strzała doleciała: dźwięk trafienia (ciało, drewno, kamień, zbroja, ziemia) w miejscu celu;
   *  `pass` — strzała mija słuchacza: świst lotu w połowie toru */
  constructor(scene: THREE.Scene, private land: (kind: WorldSound, at: THREE.Vector3) => void = () => {}, private pass: (at: THREE.Vector3) => void = () => {}) {
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
    this.stuckMesh = new THREE.InstancedMesh(this.arrowMesh.geometry, this.arrowMesh.material, MAX_STUCK + MAX_BODY);
    this.stuckMesh.name = 'stuckArrows'; // strzały wbite w ziemię, ściany i poległych (osobno od lecących)
    this.stuckMesh.count = 0; this.stuckMesh.frustumCulled = false; this.stuckMesh.castShadow = true; scene.add(this.stuckMesh);
  }

  /** Ile strzał jest teraz w powietrzu */
  get count(): number { return this.arrows.length; }

  /** Nowa strzała z `from` do `to` (położenia w świecie) */
  /** Każda strzała wylatuje z innego miejsca dłoni i celuje w inne miejsce sylwetki, więc kilka naraz nie leci jedną kreską */
  shoot(from: THREE.Vector3, to: THREE.Vector3, fire: boolean, hit?: WorldSound, stick?: Stick): void {
    const j = (): number => (Math.random() - 0.5);
    from.x += j() * 0.22; from.z += j() * 0.22; from.y += j() * 0.1;
    to.x += j() * 0.3; to.z += j() * 0.3; to.y += j() * 0.25;
    // strzały lecą prawie prosto: część zupełnie płasko, reszta z lekkim łukiem (bez paraboli góra–dół)
    this.arrows.push({ from, to, t: 0, fire, hit, stick, arc: Math.random() < 0.4 ? 0 : 0.015 + Math.random() * 0.03 });
  }

  /** Strzała doleciała: zostaje wbita w ziemię, w ścianę albo w trafionego */
  private plant(a: { from: THREE.Vector3; to: THREE.Vector3; stick?: Stick }): void {
    const st = a.stick;
    if (!st) return;
    if (st.unit !== undefined) {
      const e = this.inBody.get(st.unit);
      this.inBody.set(st.unit, { n: Math.min(PER_BODY, (e?.n ?? 0) + 1), at: this.clock });
      return;
    }
    const d = new THREE.Vector3().subVectors(a.to, a.from).normalize();
    const p = new THREE.Vector3();
    if (st.ground) {
      // chybiona: leci dalej w dół i wbija się w ziemię za celem, skośnie, do połowy długości grotu
      d.y = Math.min(d.y, -0.45); d.normalize();
      p.copy(a.to).addScaledVector(d, 0.5 + Math.random() * 0.8);
      p.y = this.groundAt(p.x, p.z);
      p.addScaledVector(d, -0.14); // środek drzewca nad ziemią, grot w ziemi
    } else if (st.wall) p.copy(a.to).addScaledVector(d, -0.16); // w ścianie: grot w deskach albo w murze
    else return;
    const m = new THREE.Matrix4().lookAt(p.clone().add(d), p, UP);
    if (this.stuck.length >= MAX_STUCK) this.stuck.shift();
    this.stuck.push({ p, q: new THREE.Quaternion().setFromRotationMatrix(m), d, at: this.clock });
  }

  /** Początek rysowania strzał w ciałach (scene.ts przed pętlą po ciałach) */
  beginBodies(): void { this.bodyN = 0; }

  /** Ciało `id` leży w (x, y, z): ile strzał w nim utkwiło, tyle sterczy z tułowia (losowo, ale stale dla danego ciała) */
  body(id: number, x: number, y: number, z: number, yaw: number): void {
    const e = this.inBody.get(id);
    if (!e || this.bodyN >= MAX_BODY) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), d = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < e.n && this.bodyN < MAX_BODY; i++) {
      const r1 = ((id * 0.618 + i * 0.37) % 1), r2 = ((id * 0.754 + i * 0.53) % 1);
      // wzdłuż tułowia (oś ciała = yaw), trochę na boki; strzała sterczy skośnie w górę
      const along = (r1 - 0.4) * 0.35, side = (r2 - 0.5) * 0.14;
      const hx = x + Math.sin(yaw) * along + Math.cos(yaw) * side, hz = z + Math.cos(yaw) * along - Math.sin(yaw) * side;
      const ang = r1 * 6.283 + i * 2.1;
      d.set(Math.sin(ang) * 0.55, -0.83, Math.cos(ang) * 0.55).normalize();
      p.set(hx, y + 0.1, hz).addScaledVector(d, -0.18);
      m.lookAt(p.clone().add(d), p, UP);
      q.setFromRotationMatrix(m);
      (this.bodyMats[this.bodyN] ??= new THREE.Matrix4()).compose(p, q, one);
      this.bodyN++;
    }
  }

  /** Koniec klatki: wbite w ziemię i ściany (z chowaniem pod koniec) i w ciała; stare wpisy o trafionych sprzątamy */
  drawStuck(): void {
    const now = this.clock;
    while (this.stuck.length && now - this.stuck[0]!.at > STUCK_LIFE) this.stuck.shift();
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const s of this.stuck) {
      const left = STUCK_LIFE - (now - s.at);
      p.copy(s.p);
      if (left < STUCK_FADE) p.addScaledVector(s.d, (1 - left / STUCK_FADE) * 0.26); // chowa się grotem naprzód
      m.compose(p, s.q, one);
      this.stuckMesh.setMatrixAt(n++, m);
    }
    for (let i = 0; i < this.bodyN; i++) this.stuckMesh.setMatrixAt(n++, this.bodyMats[i]!);
    this.stuckMesh.count = n;
    touch(this.stuckMesh);
    if (this.inBody.size > 64 && Math.random() < 0.01) for (const [k, v] of this.inBody) if (now - v.at > 900) this.inBody.delete(k);
  }
  private bodyMats: THREE.Matrix4[] = [];

  /** Nowa gra albo wczytanie: bez wbitych strzał */
  clearStuck(): void { this.stuck = []; this.inBody.clear(); this.bodyN = 0; this.stuckMesh.count = 0; }

  /** Strzały w locie: prawie prosto od łucznika do celu (najwyżej lekki łuk), ok. 0,4 s (tyle leci w symulacji, army.ts ARROW_TICKS — trafia, gdy doleci) */
  fly(calm: boolean): void {
    const dt = calm ? 1 : 1 / 60;
    if (!calm) this.clock += dt;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), nx = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    this.arrows = this.arrows.filter((a) => {
      a.t += dt / 0.4;
      if (!calm && !a.whoosh && a.t >= 0.45) { a.whoosh = true; this.pass(new THREE.Vector3().lerpVectors(a.from, a.to, 0.5)); }
      if (a.t < 1) return true;
      if (!calm && a.hit) this.land(a.hit, a.to);
      if (!calm) this.plant(a);
      return false;
    });
    this.fireN = 0;
    for (const a of this.arrows) {
      const arc = Math.sin(a.t * Math.PI) * a.from.distanceTo(a.to) * a.arc;
      p.lerpVectors(a.from, a.to, a.t); p.y += arc;
      // kierunek lotu liczony wprost (pochodna toru), a nie z punktu „chwilę dalej”: tamten pod koniec lotu
      // zbiegał się z celem i strzała potrafiła nagle obrócić się o 90° tuż przed trafieniem (Michał 27.10.2026)
      nx.subVectors(a.to, a.from); nx.y += Math.cos(a.t * Math.PI) * Math.PI * a.from.distanceTo(a.to) * a.arc;
      if (nx.lengthSq() < 1e-8) nx.set(0, 0, 1);
      nx.normalize().add(p);
      m.lookAt(nx, p, UP);
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
      m.compose(p, q, new THREE.Vector3(1, 1, Math.min(1.6, 0.4 + a.from.distanceTo(a.to) * 0.12))); // ognista: ta sama szerokość smugi (tylko kolor), bez rozlanej łuny
      this.arrowTrail.setMatrixAt(n++, m);
    }
    this.arrowMesh.count = n;
    touch(this.arrowMesh);
    this.arrowTrail.count = n;
    if (this.arrowTrail.instanceColor) this.arrowTrail.instanceColor.needsUpdate = true;
    touch(this.arrowTrail);
  }
}

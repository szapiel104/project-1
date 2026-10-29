/**
 * Krew w trakcie walki (Michał 29.10.2026, pomysł z „Bitwy i klimatu”): przy każdym trafieniu żołnierza, chłopa albo
 * wilka krótki prysk kropli,
 * które lecą łukiem w bok i w tył od trafionego i spadają na ziemię jako drobne plamki; ciężko ranny (poniżej
 * połowy zdrowia), idąc, gubi co kawałek kroplę. Plamki ciemnieją i po ok. minucie znikają.
 *
 * Tylko wygląd: symulacja o tym nie wie (trafienie poznajemy po spadku zdrowia między klatkami), więc nic nie
 * rozjedzie się w grze przez sieć. Pod poległymi zostaje osobna, duża plama (blood.ts).
 */
import * as THREE from 'three';
import { BloodStains } from './blood';

/** Ile kropli naraz w powietrzu i ile plamek na ziemi (najstarsze ustępują nowym) */
const AIR = 240, GROUND = 700;
/** Po tylu sekundach plamka znika (ostatnie 10 s blednie) */
const LIFE = 60;
const GRAV = 5.5;

interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; size: number }
interface Spot { x: number; y: number; z: number; t0: number; size: number; rot: number; sx: number; sz: number }
interface Track { hp: number; x: number; z: number; walked: number; seen: number }

export class BloodFx {
  readonly air: THREE.InstancedMesh;
  private stains = new BloodStains(GROUND);
  private drops: Drop[] = [];
  private spots: Spot[] = [];
  private next = 0;
  private seen = new Map<number, Track>();
  private frame = 0;
  private seed = 1;
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private q = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    this.air = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6a0b07, roughness: 0.3 }), AIR);
    this.air.count = 0;
    this.air.frustumCulled = false;
    this.air.name = 'bloodDrops';
    scene.add(this.air);
    this.stains.mesh.name = 'bloodSpots';
    scene.add(this.stains.mesh);
  }

  /** Czy ta postać jest już śledzona (zdrowy, ale niedawno ranny — śledzimy dalej, żeby złapać kolejny cios) */
  knows(id: number): boolean { return this.seen.has(id); }

  private rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  /**
   * Żołnierz w tej klatce: `x, z` na mapie (pola), `y` stopy, `heading` dokąd patrzy. Spadek zdrowia = trafienie.
   * `ground(x, z)` = wysokość terenu (tam spadają krople).
   */
  track(id: number, hp: number, maxHp: number, x: number, y: number, z: number, heading: number, walking: boolean, time: number, ground: (x: number, z: number) => number, chest = 0.28, wasFull = false): void {
    const tr = this.seen.get(id);
    if (!tr) {
      // `wasFull`: chłopa i wilka zaczynamy śledzić dopiero po pierwszym ciosie — wtedy przed chwilą był zdrowy
      this.seen.set(id, { hp: wasFull ? maxHp : hp, x, z, walked: 0, seen: this.frame });
      if (!wasFull || hp >= maxHp) return;
      return this.track(id, hp, maxHp, x, y, z, heading, walking, time, ground, chest);
    }
    tr.seen = this.frame;
    if (hp < tr.hp) this.spray(x, y + chest, z, heading, Math.min(1, (tr.hp - hp) / Math.max(1, maxHp) * 4));
    tr.hp = hp;
    // ciężko ranny gubi krople: co ok. 0,7 pola drogi (im słabszy, tym częściej)
    const step = Math.hypot(x - tr.x, z - tr.z);
    tr.x = x; tr.z = z;
    if (walking && step < 1 && hp * 2 < maxHp) {
      tr.walked += step;
      const every = 0.4 + (hp / maxHp) * 0.8;
      if (tr.walked > every) {
        tr.walked = 0;
        const ox = (this.rnd() - 0.5) * 0.12, oz = (this.rnd() - 0.5) * 0.12;
        this.spot(x + ox, ground(x + ox, z + oz), z + oz, time, 0.035 + this.rnd() * 0.035);
      }
    }
  }

  /** Prysk przy trafieniu: kilka kropli z wysokości tułowia, w tył i na boki od trafionego */
  private spray(x: number, y: number, z: number, heading: number, power: number): void {
    const n = 3 + Math.round(power * 5);
    for (let i = 0; i < n; i++) {
      if (this.drops.length >= AIR) this.drops.shift();
      const a = heading + Math.PI + (this.rnd() - 0.5) * 2.2, sp = 0.5 + this.rnd() * 0.9 * (0.6 + power);
      this.drops.push({ x, y: y + this.rnd() * 0.1, z, vx: Math.sin(a) * sp, vy: 0.4 + this.rnd() * 0.9, vz: Math.cos(a) * sp, t: 0, size: 0.008 + this.rnd() * 0.008 });
    }
  }

  private spot(x: number, y: number, z: number, time: number, size: number): void {
    const s: Spot = { x, y, z, t0: time, size, rot: this.rnd() * Math.PI * 2, sx: 0.7 + this.rnd() * 0.6, sz: 0.7 + this.rnd() * 0.6 };
    if (this.spots.length < GROUND) this.spots.push(s);
    else { this.spots[this.next] = s; this.next = (this.next + 1) % GROUND; }
  }

  /**
   * Raz na klatkę po wszystkich `track`: krople lecą i spadają, plamki ciemnieją i znikają. `calm` = bez animacji
   * (krople od razu leżą). `ox, oz` = przesunięcie mapy na scenę (środek mapy w zerze).
   */
  update(dt: number, time: number, ground: (x: number, z: number) => number, ox: number, oz: number, calm: boolean): void {
    this.frame++;
    // żołnierze, których już nie ma (polegli, w budynku): zapominamy po chwili
    if (this.frame % 120 === 0) for (const [id, tr] of this.seen) if (this.frame - tr.seen > 60) this.seen.delete(id);
    let k = 0;
    const keep: Drop[] = [];
    for (const d of this.drops) {
      d.t += calm ? 1 : dt;
      d.vy -= GRAV * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const gy = ground(d.x, d.z);
      if (calm || d.y <= gy || d.t > 2) { this.spot(d.x, gy, d.z, time, 0.03 + d.size * 3); continue; }
      keep.push(d);
      this.m.compose(this.v.set(d.x - ox, d.y, d.z - oz), this.q.identity(), this.sc.set(d.size, d.size * 1.4, d.size));
      this.air.setMatrixAt(k++, this.m);
    }
    this.drops = keep;
    this.air.count = k;
    this.air.instanceMatrix.needsUpdate = true;
    // plamki: te same nieregularne kleksy co pod poległymi, tylko małe; po LIFE sekundach znikają
    this.stains.begin();
    for (const s of this.spots) {
      const age = time - s.t0;
      if (age > LIFE || age < 0) continue;
      const fade = Math.min(1, (LIFE - age) / 10);
      const h = 0.15;
      const hx = (ground(s.x + h, s.z) - ground(s.x - h, s.z)) / (2 * h), hz = (ground(s.x, s.z + h) - ground(s.x, s.z - h)) / (2 * h);
      this.stains.addSpot(s.x - ox, s.y + 0.015, s.z - oz, s.size * fade, s.rot, s.sx, s.sz, Math.min(1, age / LIFE * 1.4), [hx, hz]);
    }
    this.stains.end();
  }
}

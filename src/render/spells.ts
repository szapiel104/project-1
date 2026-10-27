import * as THREE from 'three';

/**
 * Czary magów bojowych w locie (tylko wygląd; trafienie liczy symulacja w chwili rzutu, jak przy strzałach).
 * Kula leci PROSTO w cel (Michał 27.10.2026: bez łuku góra–dół), z warstwami światła i efektami:
 *
 * - Kula ognia: białożółte jądro, pomarańczowy płomień, czerwona poświata rozciągnięta w kierunku lotu (smuga ruchu),
 *   ogon iskier i żarzących się drobin, które opadają i gasną, plus żywy płomień z systemu ognia sceny.
 *   Przy celu: oślepiający błysk, fala uderzeniowa po ziemi, snop iskier na boki i kłąb ciemnego dymu.
 * - Czar wody: jasne, prawie białe jądro, błękitna kula z wirującą otoczką, ogon kropel i mgiełki.
 *   Przy celu: rozprysk — krople wystrzeliwują w górę i na boki i spadają, po ziemi rozchodzi się krąg wody.
 *
 * Wydajność: wszystko na kilku wspólnych siatkach instancji (stała liczba wywołań rysowania, bez nowych obiektów
 * w trakcie gry), cząstki w stałej puli; bez czarów warstwa nic nie rysuje.
 */
interface Shot { from: THREE.Vector3; to: THREE.Vector3; t: number; fire: boolean; dur: number; seed: number }
interface Burst { at: THREE.Vector3; t: number; fire: boolean }
interface Particle { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; kind: 0 | 1 | 2 | 3 }

const MAX = 128;
/** Najwięcej cząstek naraz (iskry, krople, dym) — stała pula */
const MAX_P = 900;
const FIRE = new THREE.Color(0xff6a1a), FIRE_CORE = new THREE.Color(0xfff1c4), FIRE_HALO = new THREE.Color(0xd8320f);
const WATER = new THREE.Color(0x3d9cff), WATER_CORE = new THREE.Color(0xeefaff), WATER_HALO = new THREE.Color(0x2a6fd6);
/** Barwy cząstek: iskra ognia, żar (ciemniejszy), kropla wody, dym */
const P_COLOR = [new THREE.Color(0xffc25a), new THREE.Color(0xff5a14), new THREE.Color(0x9fd8ff), new THREE.Color(0x3a332c)];
const UP = new THREE.Vector3(0, 0, 1);

export class SpellLayer {
  private shots: Shot[] = [];
  private bursts: Burst[] = [];
  private parts: Particle[] = [];
  private readonly glow: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly halo: THREE.InstancedMesh;
  private readonly flash: THREE.InstancedMesh;
  private readonly wave: THREE.InstancedMesh;
  private readonly spark: THREE.InstancedMesh;
  private readonly smoke: THREE.InstancedMesh;
  private readonly flameAt: THREE.Vector3[] = [];
  private flameN = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly d = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private rnd = 1;

  constructor(scene: THREE.Scene) {
    const add = (geo: THREE.BufferGeometry, opacity: number, max: number, additive = true): THREE.InstancedMesh => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.InstancedMesh(geo, mat, max);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, FIRE);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      return mesh;
    };
    this.halo = add(new THREE.SphereGeometry(1, 16, 12), 0.32, MAX);
    this.glow = add(new THREE.SphereGeometry(1, 16, 12), 0.6, MAX);
    this.core = add(new THREE.SphereGeometry(1, 12, 8), 1, MAX);
    this.flash = add(new THREE.SphereGeometry(1, 16, 12), 0.7, MAX);
    // fala po ziemi: płaski pierścień (obrócony do poziomu przy rysowaniu)
    this.wave = add(new THREE.RingGeometry(0.78, 1, 40), 0.6, MAX);
    this.spark = add(new THREE.IcosahedronGeometry(1, 0), 0.95, MAX_P);
    this.smoke = add(new THREE.IcosahedronGeometry(1, 1), 0.38, MAX_P, false);
  }

  /** Rzut czaru z dłoni maga (`from`) do celu (`to`), oba w układzie świata */
  cast(from: THREE.Vector3, to: THREE.Vector3, fire: boolean): void {
    if (this.shots.length >= MAX) return;
    const dist = from.distanceTo(to);
    this.shots.push({ from: from.clone(), to: to.clone(), t: 0, fire, dur: Math.min(0.62, 0.22 + dist * 0.05), seed: Math.random() * 100 });
    // błysk w dłoni przy rzucie
    for (let i = 0; i < 6; i++) this.emit(from, this.jitter(0.6), 0.25, fire ? 0 : 2, fire ? 0.035 : 0.03);
  }

  /** Płomienie kul ognia w tej klatce (rysuje je wspólny system ognia sceny) */
  flames(): readonly THREE.Vector3[] { return this.flameAt.slice(0, this.flameN); }

  /** Losowa liczba 0..1 (bez wpływu na symulację — tylko wygląd) */
  private rand(): number { this.rnd = (this.rnd * 16807) % 2147483647; return this.rnd / 2147483647; }
  private jitter(k: number): THREE.Vector3 { return new THREE.Vector3((this.rand() - 0.5) * k, (this.rand() - 0.5) * k, (this.rand() - 0.5) * k); }

  private emit(at: THREE.Vector3, v: THREE.Vector3, life: number, kind: 0 | 1 | 2 | 3, size: number): void {
    if (this.parts.length >= MAX_P) return;
    this.parts.push({ p: at.clone(), v, life, max: life, size, kind });
  }

  /** Klatka: kule lecą prosto w cel, sypią iskrami albo kroplami, przy celu rozbłysk albo rozprysk */
  update(dt: number, time: number): void {
    // zatrzymany obraz (dt = 1): bez lecących czarów i cząstek
    if (dt >= 1) { this.shots = []; this.bursts = []; this.parts = []; }
    const step = Math.min(dt, 0.05);
    const next: Shot[] = [];
    for (const a of this.shots) {
      a.t += step / a.dur;
      if (a.t >= 1) this.impact(a);
      else next.push(a);
    }
    this.shots = next;
    this.bursts = this.bursts.filter((b) => (b.t += step / (b.fire ? 0.55 : 0.5)) < 1);

    let n = 0;
    this.flameN = 0;
    for (const a of this.shots) {
      // prosto od dłoni do celu, bez łuku
      this.p.lerpVectors(a.from, a.to, a.t);
      this.d.subVectors(a.to, a.from).normalize();
      this.q.setFromUnitVectors(UP, this.d);
      const pulse = 1 + Math.sin(time * 38 + a.seed) * 0.1 + Math.sin(time * 23 + a.seed * 2) * 0.06;
      const big = a.fire ? 1 : 0.92;
      // poświata rozciągnięta wzdłuż lotu (smuga), kula i jasne jądro
      this.putQ(this.halo, n, this.p, 0.2 * big * pulse, 0.2 * big * pulse, 0.42 * big, a.fire ? FIRE_HALO : WATER_HALO);
      this.putQ(this.glow, n, this.p, 0.12 * big * pulse, 0.12 * big * pulse, 0.17 * big, a.fire ? FIRE : WATER);
      this.putQ(this.core, n, this.p, 0.065 * pulse, 0.065 * pulse, 0.08, a.fire ? FIRE_CORE : WATER_CORE);
      n++;
      // ogon: iskry i żar (ogień) albo krople i mgiełka (woda), wyrzucane do tyłu i lekko na boki
      const back = this.d.clone().multiplyScalar(-1.6);
      const count = a.fire ? 5 : 4;
      for (let i = 0; i < count; i++) {
        const v = back.clone().add(this.jitter(a.fire ? 1.4 : 1.1));
        this.emit(this.p.clone().addScaledVector(this.d, -this.rand() * 0.15), v, 0.18 + this.rand() * 0.25, a.fire ? (this.rand() < 0.6 ? 0 : 1) : 2, (a.fire ? 0.022 : 0.019) * (0.6 + this.rand() * 0.8));
      }
      if (a.fire && this.rand() < 0.35) this.emit(this.p, back.clone().multiplyScalar(0.3).add(new THREE.Vector3(0, 0.4, 0)), 0.5, 3, 0.05);
      if (a.fire) {
        const v = this.flameAt[this.flameN] ?? (this.flameAt[this.flameN] = new THREE.Vector3());
        v.copy(this.p).setY(this.p.y - 0.08);
        this.flameN++;
      }
    }

    // rozbłyski przy celu: błysk kuli i fala po ziemi
    let f = 0;
    for (const b of this.bursts) {
      const k = 1 - b.t;
      const flashK = Math.max(0, 1 - b.t * 2.4); // błysk krótszy niż fala
      if (flashK > 0) this.put(this.flash, f, b.at, (b.fire ? 0.17 : 0.15) + b.t * 0.32, this.c.copy(b.fire ? FIRE_CORE : WATER_CORE).multiplyScalar(flashK));
      else this.put(this.flash, f, b.at, 0.0001, this.c.setRGB(0, 0, 0));
      // cel jest ok. 0,4 nad ziemią (pierś) — fala rozchodzi się tuż nad gruntem pod nim
      this.p.copy(b.at).setY(b.at.y - 0.36);
      this.m.compose(this.p, this.qFlat, this.s.setScalar(0.25 + b.t * (b.fire ? 1.5 : 1.3)));
      this.wave.setMatrixAt(f, this.m);
      this.wave.setColorAt(f, this.c.copy(b.fire ? FIRE : WATER).multiplyScalar(k * k));
      if (b.fire && b.t < 0.45 && this.flameN < 64) {
        const v = this.flameAt[this.flameN] ?? (this.flameAt[this.flameN] = new THREE.Vector3());
        v.copy(b.at).setY(b.at.y - 0.05);
        this.flameN++;
      }
      f++;
    }

    // cząstki: iskry i krople lecą, spadają i gasną; dym unosi się, rośnie i blednie
    let sp = 0, sm = 0;
    const alive: Particle[] = [];
    for (const pt of this.parts) {
      pt.life -= step;
      if (pt.life <= 0) continue;
      alive.push(pt);
      const age = 1 - pt.life / pt.max;
      if (pt.kind === 3) {
        pt.v.multiplyScalar(0.96);
        pt.p.addScaledVector(pt.v, step);
        if (sm < MAX_P) { this.put(this.smoke, sm, pt.p, pt.size * (1 + age * 2.2), this.c.copy(P_COLOR[3]!).lerp(new THREE.Color(0x6a625a), age)); sm++; }
      } else {
        pt.v.y -= (pt.kind === 2 ? 6 : 2.2) * step; // krople spadają szybciej niż iskry
        pt.v.multiplyScalar(pt.kind === 2 ? 0.985 : 0.97);
        pt.p.addScaledVector(pt.v, step);
        const fade = 1 - age;
        this.put(this.spark, sp, pt.p, pt.size * (pt.kind === 2 ? 1 : 0.7 + fade * 0.5), this.c.copy(P_COLOR[pt.kind]!).multiplyScalar(0.4 + fade * 0.9));
        sp++;
      }
    }
    this.parts = alive;

    this.halo.count = n; this.glow.count = n; this.core.count = n;
    this.flash.count = f; this.wave.count = f;
    this.spark.count = sp; this.smoke.count = sm;
    for (const mesh of [this.halo, this.glow, this.core, this.flash, this.wave, this.spark, this.smoke]) {
      mesh.visible = mesh.count > 0;
      if (!mesh.visible) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Trafienie: rozbłysk, fala po ziemi i snop iskier albo rozprysk kropel */
  private impact(a: Shot): void {
    if (this.bursts.length < MAX) this.bursts.push({ at: a.to.clone(), t: 0, fire: a.fire });
    const n = a.fire ? 26 : 30;
    for (let i = 0; i < n; i++) {
      const ang = this.rand() * Math.PI * 2, out = (a.fire ? 1.6 : 1.2) + this.rand() * 1.8;
      const up = a.fire ? 0.6 + this.rand() * 2 : 1.8 + this.rand() * 2.6;
      const v = new THREE.Vector3(Math.cos(ang) * out, up, Math.sin(ang) * out);
      this.emit(a.to, v, 0.35 + this.rand() * 0.45, a.fire ? (i % 3 ? 0 : 1) : 2, (a.fire ? 0.03 : 0.028) * (0.6 + this.rand() * 0.9));
    }
    if (a.fire) for (let i = 0; i < 7; i++) this.emit(a.to.clone().add(this.jitter(0.25)), new THREE.Vector3((this.rand() - 0.5) * 0.4, 0.5 + this.rand() * 0.5, (this.rand() - 0.5) * 0.4), 0.9 + this.rand() * 0.6, 3, 0.07 + this.rand() * 0.05);
  }

  private put(mesh: THREE.InstancedMesh, i: number, at: THREE.Vector3, size: number, color: THREE.Color): void {
    this.m.compose(at, this.q.identity(), this.s.setScalar(size));
    mesh.setMatrixAt(i, this.m);
    mesh.setColorAt(i, color);
  }

  /** Jak `put`, ale z obrotem w kierunku lotu i osobną długością wzdłuż niego (smuga ruchu) */
  private putQ(mesh: THREE.InstancedMesh, i: number, at: THREE.Vector3, sx: number, sy: number, sz: number, color: THREE.Color): void {
    this.m.compose(at, this.q, this.s.set(sx, sy, sz));
    mesh.setMatrixAt(i, this.m);
    mesh.setColorAt(i, color);
  }
}

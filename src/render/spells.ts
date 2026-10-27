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
/** Języków ognia na płonącym */
const FLAMES = 9;

/**
 * Miękka tekstura (64 px, rysowana raz na płótnie): kropla płomienia (jasny środek, rozmyta ku górze) albo okrągła plama
 * światła. Same jasności w kanałach — barwę daje kolor instancji, mieszanie addytywne.
 */
function softTexture(flame: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = flame ? 96 : 64;
  const x = c.getContext('2d');
  if (x) {
    if (flame) {
      // kropla: szeroka u dołu, zwężona ku górze; jasność maleje od środka-dołu
      const img = x.createImageData(64, 96);
      for (let py = 0; py < 96; py++) for (let px = 0; px < 64; px++) {
        const v = 1 - py / 96; // 0 u dołu .. 1 u góry
        const half = 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.04)), 0.7) * (1 - v * 0.55);
        const dx = Math.abs(px / 63 - 0.5) / Math.max(0.01, half);
        const across = Math.max(0, 1 - dx * dx);
        const along = Math.min(1, v * 6) * Math.pow(1 - v, 0.8);
        const k = Math.round(255 * Math.min(1, across * along * 1.5));
        const i = (py * 64 + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = k;
      }
      x.putImageData(img, 0, 0);
    } else {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  /** Przymrożenie czarem wody: kryształki lodu wokół stóp, szron w powietrzu i miękka chłodna poświata */
  private readonly ice: THREE.InstancedMesh;
  /** Miękkie plamy światła (zwrócone do kamery): ciepło płonącego, chłód przymrożonego */
  private readonly blob: THREE.InstancedMesh;
  private frostAt: { p: THREE.Vector3; id: number }[] = [];
  private frostN = 0;
  /** Płonący po ognistej strzale albo kuli ognia: miękkie języki ognia (zwrócone do kamery), żar i dym */
  private readonly lick: THREE.InstancedMesh;
  private readonly camQ = new THREE.Quaternion();
  private burnAt: { p: THREE.Vector3; id: number }[] = [];
  private burnN = 0;
  private readonly flameAt: THREE.Vector3[] = [];
  private flameN = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly d = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private readonly s = new THREE.Vector3();
  private readonly ax = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private rnd = 1;

  constructor(scene: THREE.Scene) {
    const add = (geo: THREE.BufferGeometry, opacity: number, max: number, additive = true, map?: THREE.Texture): THREE.InstancedMesh => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, ...(map ? { map } : {}), transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, toneMapped: false });
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
    this.ice = add(new THREE.OctahedronGeometry(1, 0), 0.85, MAX * 6);
    // płaskie kwadraty z miękką teksturą, co klatkę obrócone do kamery (bez twardych brzegów brył)
    this.blob = add(new THREE.PlaneGeometry(1, 1), 0.5, MAX * 2, true, softTexture(false));
    // język ognia: kropla rozmyta ku górze; podstawa przy ubraniu
    this.lick = add(new THREE.PlaneGeometry(1, 1).translate(0, 0.42, 0), 0.9, MAX * FLAMES, true, softTexture(true));
  }

  /** Ten żołnierz płonie (w tej klatce): `at` = jego pozycja na ziemi */
  burning(at: THREE.Vector3, id: number): void {
    if (this.burnN >= MAX) return;
    const f = this.burnAt[this.burnN] ?? (this.burnAt[this.burnN] = { p: new THREE.Vector3(), id: 0 });
    f.p.copy(at); f.id = id;
    this.burnN++;
  }

  /** Ten żołnierz jest przymrożony (w tej klatce): `at` = jego pozycja na ziemi */
  frost(at: THREE.Vector3, id: number): void {
    if (this.frostN >= MAX) return;
    const f = this.frostAt[this.frostN] ?? (this.frostAt[this.frostN] = { p: new THREE.Vector3(), id: 0 });
    f.p.copy(at); f.id = id;
    this.frostN++;
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
  update(dt: number, time: number, cam?: THREE.Camera): void {
    if (cam) this.camQ.copy(cam.quaternion);
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

    // przymrożeni: drobne kryształki lodu wokół stóp (powoli krążą), szron w powietrzu i miękka chłodna poświata
    let ic = 0, bl = 0;
    for (let k = 0; k < this.frostN; k++) {
      const f = this.frostAt[k]!;
      for (let j = 0; j < 7; j++) {
        const a = j * 0.9 + time * 0.5 + f.id;
        const r = 0.13 + (j % 3) * 0.04;
        this.p.set(f.p.x + Math.cos(a) * r, f.p.y + 0.03 + (j % 2) * 0.03, f.p.z + Math.sin(a) * r);
        this.q.setFromAxisAngle(this.ax.set(Math.cos(a), 0, Math.sin(a)), 0.3 + (j % 3) * 0.15);
        this.m.compose(this.p, this.q, this.s.set(0.018, 0.05 + (j % 3) * 0.018, 0.018));
        this.ice.setMatrixAt(ic, this.m);
        this.ice.setColorAt(ic, this.c.setRGB(0.55, 0.82, 1));
        ic++;
      }
      this.p.copy(f.p).setY(f.p.y + 0.4);
      this.m.compose(this.p, this.camQ, this.s.setScalar(0.62));
      this.blob.setMatrixAt(bl, this.m);
      this.blob.setColorAt(bl, this.c.setRGB(0.25, 0.55, 1).multiplyScalar(0.5 + Math.sin(time * 2.5 + f.id) * 0.1));
      bl++;
      // szron: drobinki opadają powoli wokół postaci
      if (this.rand() < 0.3) this.emit(new THREE.Vector3(f.p.x + (this.rand() - 0.5) * 0.3, f.p.y + 0.5 + this.rand() * 0.3, f.p.z + (this.rand() - 0.5) * 0.3), new THREE.Vector3((this.rand() - 0.5) * 0.1, 0.5, (this.rand() - 0.5) * 0.1), 0.5, 2, 0.008);
    }
    // płonący: języki ognia wyrastają z ubrania, rosną, unoszą się i gasną (każdy w swoim rytmie),
    // od spodu jasnożółte, wyżej pomarańczowe i czerwone; pod nimi ciepła poświata, w górę żar i dym
    let lk = 0;
    for (let k = 0; k < this.burnN; k++) {
      const f = this.burnAt[k]!;
      for (let j = 0; j < FLAMES; j++) {
        const life = (time * (1.6 + (j % 3) * 0.35) + j / FLAMES + f.id * 0.37) % 1;
        const a = j * 2.39 + f.id * 0.7;
        const r = 0.07 + (j % 3) * 0.035;
        const h = 0.1 + ((j * 5) % FLAMES) / FLAMES * 0.4 + life * 0.25;
        const sway = Math.sin(time * 6 + j * 1.3) * 0.02;
        this.p.set(f.p.x + Math.cos(a) * r + sway, f.p.y + h, f.p.z + Math.sin(a) * r);
        const size = (0.19 + (j % 4) * 0.045) * Math.sin(Math.PI * Math.min(1, life * 1.15));
        this.m.compose(this.p, this.camQ, this.s.set(size * 0.75, size * 1.35, size));
        this.lick.setMatrixAt(lk, this.m);
        // barwa: młody płomień jasnożółty, starszy pomarańczowy, na końcu ciemnieje ku czerwieni
        this.c.setRGB(0.95, 0.5 - life * 0.3, 0.1 - life * 0.08);
        this.lick.setColorAt(lk, this.c);
        lk++;
      }
      this.p.copy(f.p).setY(f.p.y + 0.38);
      this.m.compose(this.p, this.camQ, this.s.setScalar(0.6 + Math.sin(time * 11 + f.id) * 0.05));
      this.blob.setMatrixAt(bl, this.m);
      this.blob.setColorAt(bl, this.c.setRGB(1, 0.36, 0.06).multiplyScalar(0.42 + Math.sin(time * 9 + f.id) * 0.1));
      bl++;
      if (this.rand() < 0.45) this.emit(new THREE.Vector3(f.p.x + (this.rand() - 0.5) * 0.2, f.p.y + 0.45 + this.rand() * 0.3, f.p.z + (this.rand() - 0.5) * 0.2), new THREE.Vector3((this.rand() - 0.5) * 0.3, 0.7 + this.rand() * 0.5, (this.rand() - 0.5) * 0.3), 0.35 + this.rand() * 0.3, this.rand() < 0.5 ? 0 : 1, 0.011);
      if (this.rand() < 0.1) this.emit(new THREE.Vector3(f.p.x, f.p.y + 0.85, f.p.z), new THREE.Vector3((this.rand() - 0.5) * 0.15, 0.45, (this.rand() - 0.5) * 0.15), 1, 3, 0.04);
    }
    this.lick.count = lk;
    this.ice.count = ic; this.blob.count = bl;
    this.frostN = 0; this.burnN = 0;
    this.halo.count = n; this.glow.count = n; this.core.count = n;
    this.flash.count = f; this.wave.count = f;
    this.spark.count = sp; this.smoke.count = sm;
    for (const mesh of [this.halo, this.glow, this.core, this.flash, this.wave, this.spark, this.smoke, this.ice, this.blob, this.lick]) {
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

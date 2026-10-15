import * as THREE from 'three';

/**
 * Kamera strategiczna: patrzy z góry pod stałym kątem na punkt na ziemi.
 * Przesuwanie, obrót i zbliżenie z klawiatury, myszy i dotyku.
 */
export class StrategyCamera {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private yaw = Math.PI / 4;
  private dist = 38;
  /** Kąt patrzenia: od prawie poziomego (widok z ziemi) do pionowego (z lotu ptaka) */
  private pitch = (52 * Math.PI) / 180;
  /**
   * Ruch kamery jest płynny: klawisze, mysz i kółko zmieniają cel (goal), a kamera co klatkę dojeżdża do niego
   * miękko (wykładniczo), zamiast skakać o cały krok kółka czy szarpać przy nierównym czasie klatek.
   */
  private goal = { x: 0, z: 0, yaw: Math.PI / 4, dist: 38, pitch: (52 * Math.PI) / 180 };
  private static readonly MIN_PITCH = (6 * Math.PI) / 180;
  private static readonly MAX_PITCH = (89 * Math.PI) / 180;
  /** Najbliżej, jak da się podjechać kamerą (dawniej 12): z tej odległości widać twarze, hełmy i lotki strzał */
  private static readonly MIN_DIST = 4;
  private static readonly MAX_DIST = 58;
  /** Wysokość terenu w punkcie świata; kamera nigdy nie zejdzie pod ziemię */
  ground: (x: number, z: number) => number = () => 0;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; button: number; moved?: number }>();
  private pinch = 0;
  private bounds = { x: 36, z: 36 };
  /** Mnożnik szybkości przesuwania i obrotu (ustawienia) */
  speed = 1;
  /** Przesuwanie kamery, gdy kursor dotknie krawędzi ekranu */
  edgeScroll = true;
  private mouse = { x: -1, y: -1 };
  /** Czy ostatni gest był przeciąganiem (żeby nie mylić go z kliknięciem). */
  dragged = false;
  /** Prawy przycisk należy do gry (rysowanie szyku): kamera się wtedy nie obraca */
  lockRotate = false;
  /** Lewy przycisk nie przesuwa kamery (używany przy malowaniu dróg); klawisze i prawy przycisk działają dalej */
  panLocked = false;

  constructor(private el: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    document.addEventListener('mouseleave', () => { this.mouse.x = -1; });
    this.apply();
  }

  /** Punkt na ziemi, na który patrzy kamera */
  get focus(): THREE.Vector3 { return this.target; }
  get distance(): number { return this.dist; }

  /** Kamera nie wyjedzie poza grywalny środek mapy, więc nie widać końca świata. */
  setBounds(width: number, height: number, margin: number): void {
    this.bounds = { x: Math.max(4, width / 2 - margin), z: Math.max(4, height / 2 - margin) };
  }

  /** Położenie kamery do zapisu gry: punkt, odległość i obrót */
  get view(): { x: number; z: number; dist: number; yaw: number } { return { x: this.target.x, z: this.target.z, dist: this.dist, yaw: this.yaw }; }
  setView(v: { x: number; z: number; dist: number; yaw: number }): void {
    if (![v.x, v.z, v.dist, v.yaw].every(Number.isFinite)) return;
    this.yaw = v.yaw;
    this.lookAt(v.x, v.z, v.dist);
  }

  /** Wysokość punktu, na który patrzy kamera, nad ziemią (tylko widoki testowe; zwykle 0) */
  private lift = 0;
  /** Testy: kamera dookoła punktu — obrót i nachylenie w radianach, lift = wysokość celu nad ziemią */
  orbit(x: number, z: number, dist: number, yaw: number, pitch: number, lift = 0): void {
    this.target.set(x, 0, z);
    this.dist = dist; this.yaw = yaw; this.lift = lift;
    this.pitch = Math.max(StrategyCamera.MIN_PITCH, Math.min(StrategyCamera.MAX_PITCH, pitch));
    this.snap();
    this.apply();
  }

  /** Cel = obecne położenie (po skoku kamery: lookAt, zapis, ujęcia filmowe) */
  private snap(): void { this.goal = { x: this.target.x, z: this.target.z, yaw: this.yaw, dist: this.dist, pitch: this.pitch }; }

  lookAt(x: number, z: number, dist = this.dist): void {
    this.lift = 0;
    this.target.set(x, 0, z);
    this.dist = dist;
    this.snap();
    this.apply();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const k = this.keys;
    let fx = 0, fz = 0, rot = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    if (k.has('KeyQ')) rot += 1;
    if (k.has('KeyE')) rot -= 1;
    // krawędź ekranu: kursor przy brzegu okna przesuwa mapę (jak w klasycznych strategiach)
    if (this.edgeScroll && this.mouse.x >= 0 && !document.body.classList.contains('menu-open') && !this.pointers.size) {
      const m = 6, W = window.innerWidth, Hh = window.innerHeight;
      if (this.mouse.x <= m) fx -= 1; else if (this.mouse.x >= W - 1 - m) fx += 1;
      if (this.mouse.y <= m) fz -= 1; else if (this.mouse.y >= Hh - 1 - m) fz += 1;
    }
    let tilt = 0;
    if (k.has('PageUp') || k.has('KeyT')) tilt += 1;
    if (k.has('PageDown') || k.has('KeyG')) tilt -= 1;
    if (tilt) this.tilt(tilt * dt * 1.2);
    if (fx || fz) this.pan(fx * this.goal.dist * dt * 0.9 * this.speed, fz * this.goal.dist * dt * 0.9 * this.speed);
    if (rot) this.goal.yaw += rot * dt * 1.6 * this.speed;
    // dojazd do celu: szybko, ale bez skoków (ok. 90% drogi w ~0,15 s)
    const g = this.goal, kk = 1 - Math.exp(-Math.min(0.1, dt) * 16);
    const d = Math.abs(g.x - this.target.x) + Math.abs(g.z - this.target.z) + Math.abs(g.yaw - this.yaw) + Math.abs(g.dist - this.dist) * 0.1 + Math.abs(g.pitch - this.pitch);
    if (d < 1e-4) return;
    this.target.x += (g.x - this.target.x) * kk;
    this.target.z += (g.z - this.target.z) * kk;
    this.yaw += (g.yaw - this.yaw) * kk;
    // zbliżenie w skali logarytmicznej: tak samo płynne z daleka i z bliska
    this.dist = Math.exp(Math.log(this.dist) + (Math.log(g.dist) - Math.log(this.dist)) * kk);
    this.pitch += (g.pitch - this.pitch) * kk;
    this.apply();
  }

  private pan(dx: number, dz: number): void {
    const g = this.goal, s = Math.sin(g.yaw), c = Math.cos(g.yaw);
    g.x += dx * c + dz * s;
    g.z += -dx * s + dz * c;
    g.x = Math.max(-this.bounds.x, Math.min(this.bounds.x, g.x));
    g.z = Math.max(-this.bounds.z, Math.min(this.bounds.z, g.z));
  }

  private saved: { pitch: number; dist: number } | null = null;
  /** Ujęcie filmowe do menu: nisko nad ziemią i bliżej; wyłączenie przywraca widok gracza */
  cinematic(on: boolean): void {
    if (on && !this.saved) { this.saved = { pitch: this.pitch, dist: this.dist }; this.pitch = (20 * Math.PI) / 180; this.dist = 24; }
    else if (!on && this.saved) { this.pitch = this.saved.pitch; this.dist = this.saved.dist; this.saved = null; }
    else if (!on) return; // nic do przywrócenia
    this.snap();
    this.apply();
  }

  spin(d: number): void { this.yaw += d; this.snap(); this.apply(); }

  /** Lot do ujęcia z lotu ptaka (podgląd mapy w menu): płynnie w górę i nad środek; zwykły widok wraca przez cinematic(false) */
  fly(dt: number, pitch: number, dist: number, x: number, z: number, spin: number): void {
    if (!this.saved) this.saved = { pitch: this.pitch, dist: this.dist };
    const k = 1 - Math.exp(-dt * 1.6);
    this.pitch += (pitch - this.pitch) * k;
    this.dist += (dist - this.dist) * k;
    this.target.x += (x - this.target.x) * k;
    this.target.z += (z - this.target.z) * k;
    this.yaw += spin * dt;
    this.snap();
    this.apply();
  }

  private tilt(d: number): void {
    this.goal.pitch = Math.max(StrategyCamera.MIN_PITCH, Math.min(StrategyCamera.MAX_PITCH, this.goal.pitch + d));
  }

  private zoom(factor: number): void {
    // przy ziemi kroki kółka są drobniejsze, żeby dało się płynnie podjechać do żołnierzy
    const f = this.goal.dist < 14 ? 1 + (factor - 1) * 0.6 : factor;
    this.goal.dist = Math.max(StrategyCamera.MIN_DIST, Math.min(StrategyCamera.MAX_DIST, this.goal.dist * f));
  }

  private apply(): void {
    // punkt na ziemi leży na wysokości terenu, żeby przy niskim kącie nie patrzeć w głąb pagórka
    this.target.y = this.ground(this.target.x, this.target.z) + this.lift;
    // z bliska kamera sama się kładzie niżej (widok bardziej z boku, jak przy patrzeniu na oddział z konia)
    const close = Math.max(0, Math.min(1, (14 - this.dist) / 10));
    const pitch = Math.max(StrategyCamera.MIN_PITCH, this.pitch - close * close * 0.35);
    const flat = Math.cos(pitch) * this.dist;
    const x = this.target.x + Math.sin(this.yaw) * flat, z = this.target.z + Math.cos(this.yaw) * flat;
    let y = this.target.y + Math.sin(pitch) * this.dist;
    const clear = 1.2 - close * 0.8;
    // nie wchodzimy pod ziemię: kamera zawsze co najmniej trochę nad terenem pod sobą i na linii do celu
    for (let k = 0.25; k <= 1; k += 0.25) {
      const gx = this.target.x + (x - this.target.x) * k, gz = this.target.z + (z - this.target.z) * k;
      const need = this.target.y + (this.ground(gx, gz) + clear - this.target.y) / k;
      if (y < need) y = need;
    }
    this.camera.position.set(x, y, z);
    // bliska płaszczyzna cięcia: z bliska mniejsza, żeby nie ucinało postaci tuż przed kamerą
    const near = Math.max(0.12, Math.min(0.5, this.dist * 0.04));
    if (Math.abs(this.camera.near - near) > 0.01 && this.camera.fov < 60) { this.camera.near = near; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(this.target);
  }

  private onKey = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    this.keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  };

  private onDown = (e: PointerEvent): void => {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    this.dragged = false;
    this.pinch = 0;
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [typeof p, typeof p];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoom(this.pinch / d);
      this.pinch = d;
      this.dragged = true;
    } else if (p.button === 2 && this.lockRotate) {
      p.moved = (p.moved ?? 0) + Math.abs(dx) + Math.abs(dy);
      if (p.moved > 5) this.dragged = true;
      return;
    } else if (p.button === 2 || (p.button === 0 && e.ctrlKey)) {
      // obrót: prawy przycisk albo lewy z Ctrl; ruch w górę i w dół zmienia kąt patrzenia
      this.goal.yaw -= dx * 0.006 * this.speed;
      this.tilt(dy * 0.005);
      this.dragged = true;
    } else if (p.button === 1) {
      // środkowy przycisk przesuwa mapę
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
      const scale = (this.dist / this.el.clientHeight) * 1.1;
      this.pan(-dx * scale, -dy * scale * 1.3);
    } else {
      // lewy przycisk należy do gry (ramka zaznaczenia, malowanie dróg); kamera tylko notuje, że był ruch
      p.moved = (p.moved ?? 0) + Math.abs(dx) + Math.abs(dy);
      if (p.moved > 5) this.dragged = true;
      return;
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.pinch = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // gładzik i myszy z płynnym kółkiem dają małe kroki: zbliżenie proporcjonalne do obrotu kółka
    const steps = Math.max(-3, Math.min(3, (e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) / 100));
    this.zoom(Math.pow(1.12, steps));
  };
}

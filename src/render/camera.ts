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
  private static readonly MIN_PITCH = (6 * Math.PI) / 180;
  private static readonly MAX_PITCH = (89 * Math.PI) / 180;
  /** Wysokość terenu w punkcie świata; kamera nigdy nie zejdzie pod ziemię */
  ground: (x: number, z: number) => number = () => 0;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; button: number }>();
  private pinch = 0;
  private bounds = { x: 36, z: 36 };
  /** Mnożnik szybkości przesuwania i obrotu (ustawienia) */
  speed = 1;
  /** Przesuwanie kamery, gdy kursor dotknie krawędzi ekranu */
  edgeScroll = true;
  private mouse = { x: -1, y: -1 };
  /** Czy ostatni gest był przeciąganiem (żeby nie mylić go z kliknięciem). */
  dragged = false;
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

  lookAt(x: number, z: number, dist = this.dist): void {
    this.target.set(x, 0, z);
    this.dist = dist;
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
    if (fx || fz) this.pan(fx * this.dist * dt * 0.9 * this.speed, fz * this.dist * dt * 0.9 * this.speed);
    if (rot) this.yaw += rot * dt * 1.6 * this.speed;
    if (fx || fz || rot || tilt) this.apply();
  }

  private pan(dx: number, dz: number): void {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.target.x += dx * c + dz * s;
    this.target.z += -dx * s + dz * c;
    this.target.x = Math.max(-this.bounds.x, Math.min(this.bounds.x, this.target.x));
    this.target.z = Math.max(-this.bounds.z, Math.min(this.bounds.z, this.target.z));
  }

  spin(d: number): void { this.yaw += d; this.apply(); }

  private tilt(d: number): void {
    this.pitch = Math.max(StrategyCamera.MIN_PITCH, Math.min(StrategyCamera.MAX_PITCH, this.pitch + d));
  }

  private zoom(factor: number): void {
    this.dist = Math.max(12, Math.min(58, this.dist * factor));
  }

  private apply(): void {
    // punkt na ziemi leży na wysokości terenu, żeby przy niskim kącie nie patrzeć w głąb pagórka
    this.target.y = this.ground(this.target.x, this.target.z);
    const flat = Math.cos(this.pitch) * this.dist;
    const x = this.target.x + Math.sin(this.yaw) * flat, z = this.target.z + Math.cos(this.yaw) * flat;
    let y = this.target.y + Math.sin(this.pitch) * this.dist;
    // nie wchodzimy pod ziemię: kamera zawsze co najmniej trochę nad terenem pod sobą i na linii do celu
    for (let k = 0.25; k <= 1; k += 0.25) {
      const gx = this.target.x + (x - this.target.x) * k, gz = this.target.z + (z - this.target.z) * k;
      const need = this.target.y + (this.ground(gx, gz) + 1.2 - this.target.y) / k;
      if (y < need) y = need;
    }
    this.camera.position.set(x, y, z);
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
    } else if (p.button === 2 || p.button === 1 || (p.button === 0 && e.ctrlKey)) {
      // obrót: prawy albo środkowy przycisk, a także lewy z wciśniętym Ctrl; ruch w górę i w dół zmienia kąt patrzenia
      this.yaw -= dx * 0.006;
      this.tilt(dy * 0.005);
      this.dragged = true;
    } else if (this.panLocked && e.pointerType !== 'touch' && !e.ctrlKey) {
      return;
    } else {
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragged = true;
      const scale = (this.dist / this.el.clientHeight) * 1.1;
      this.pan(-dx * scale, -dy * scale * 1.3);
    }
    this.apply();
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.pinch = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    this.apply();
  };
}

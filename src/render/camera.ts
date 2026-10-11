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
  private readonly pitch = (52 * Math.PI) / 180;
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number; button: number }>();
  private pinch = 0;
  private bounds = { x: 36, z: 36 };
  /** Czy ostatni gest był przeciąganiem (żeby nie mylić go z kliknięciem). */
  dragged = false;

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
    this.apply();
  }

  setBounds(width: number, height: number): void {
    this.bounds = { x: width / 2, z: height / 2 };
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
    if (fx || fz) this.pan(fx * this.dist * dt * 0.9, fz * this.dist * dt * 0.9);
    if (rot) this.yaw += rot * dt * 1.6;
    if (fx || fz || rot) this.apply();
  }

  private pan(dx: number, dz: number): void {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.target.x += dx * c + dz * s;
    this.target.z += -dx * s + dz * c;
    this.target.x = Math.max(-this.bounds.x, Math.min(this.bounds.x, this.target.x));
    this.target.z = Math.max(-this.bounds.z, Math.min(this.bounds.z, this.target.z));
  }

  private zoom(factor: number): void {
    this.dist = Math.max(12, Math.min(110, this.dist * factor));
  }

  private apply(): void {
    const flat = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * flat,
      Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * flat,
    );
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
    } else if (p.button === 2 || p.button === 1) {
      this.yaw -= dx * 0.006;
      this.dragged = true;
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

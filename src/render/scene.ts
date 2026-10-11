import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { StrategyCamera } from './camera';
import { proceduralModels, type ModelFactory } from './models';
import { buildTerrain, type TerrainView } from './terrain';

export interface HoverTile { x: number; y: number }

/** Renderer: czyta stan symulacji, nigdy go nie zmienia. */
export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: StrategyCamera;
  private view: TerrainView | null = null;
  private cursor: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private state: GameState | null = null;
  private last = 0;
  onHover: (tile: HoverTile | null) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private models: ModelFactory = proceduralModels) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0xd9cfae);
    this.scene.fog = new THREE.Fog(0xd9cfae, 90, 260);
    this.scene.add(new THREE.HemisphereLight(0xfff4d6, 0x4a4433, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0cc, 2.1);
    sun.position.set(-40, 70, 30);
    this.scene.add(sun);

    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.66, 4, 1, Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, side: THREE.DoubleSide }),
    );
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.cam = new StrategyCamera(canvas);
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerleave', () => { this.cursor.visible = false; this.onHover(null); });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  setState(state: GameState, waterLevel: number): void {
    if (this.view) { this.scene.remove(this.view.group); this.view.dispose(); }
    this.state = state;
    this.view = buildTerrain(state.map, this.models, waterLevel);
    this.scene.add(this.view.group);
    const { width, height, starts } = state.map;
    this.cam.setBounds(width, height);
    const s = starts[0];
    if (s) this.cam.lookAt(s.x + 0.5 - width / 2, s.y + 0.5 - height / 2, 34);
    this.cursor.visible = false;
  }

  private resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
  }

  private onPointer = (e: PointerEvent): void => {
    if (!this.view || !this.state || e.pointerType === 'touch') return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    const hit = this.ray.intersectObject(this.view.ground)[0];
    const { width, height } = this.state.map;
    if (!hit) { this.cursor.visible = false; this.onHover(null); return; }
    const x = Math.floor(hit.point.x + width / 2), y = Math.floor(hit.point.z + height / 2);
    if (x < 0 || y < 0 || x >= width || y >= height) { this.cursor.visible = false; this.onHover(null); return; }
    this.cursor.position.set(x + 0.5 - width / 2, Math.max(this.view.heightAt(x, y), 0) + 0.06, y + 0.5 - height / 2);
    this.cursor.visible = true;
    this.onHover({ x, y });
  };

  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.cam.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
    requestAnimationFrame(this.frame);
  };
}

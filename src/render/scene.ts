import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { animateBuilding, setStockFill } from './buildings';
import { RESOURCES, RESOURCE_DEFS } from '../data/resources';
import { TEAM_COLORS } from '../data/teams';
import { FP, Phase, type GameState } from '../sim/state';
import { StrategyCamera } from './camera';
import { proceduralModels, type ModelFactory } from './models';
import { HAZE, buildTerrain, type TerrainView } from './terrain';

export interface TileRef { x: number; y: number }
export interface Ghost { x: number; y: number; w: number; h: number; ok: boolean; id: string; team: number }

const MAX_UNITS = 2048;
const WOOD = RESOURCES.indexOf('wood');

/** Renderer: czyta stan symulacji, nigdy go nie zmienia. */
export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: StrategyCamera;
  private view: TerrainView | null = null;
  private state: GameState | null = null;
  private ray = new THREE.Raycaster();

  private cursor: THREE.Mesh;
  private ghost: THREE.Mesh;
  private selection: THREE.Mesh;
  private ghostModels = new Map<string, THREE.Group>();
  private ghostModel: THREE.Group | null = null;
  private buildingLayer = new THREE.Group();
  private buildingMeshes = new Map<number, THREE.Group>();

  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private loads: THREE.InstancedMesh;
  private logs: THREE.InstancedMesh;
  private time = 0;
  private calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private prevPos = new Map<number, [number, number]>();
  private storesTick = -1;
  private tmp = new THREE.Object3D();
  private color = new THREE.Color();

  onHover: (tile: TileRef | null) => void = () => {};
  onClick: (tile: TileRef, touch: boolean) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private models: ModelFactory = proceduralModels) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(HAZE);
    this.scene.fog = new THREE.Fog(HAZE, 55, 150);
    this.scene.add(new THREE.HemisphereLight(0xfff4d6, 0x4a4433, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0cc, 2.1);
    sun.position.set(-40, 70, 30);
    this.scene.add(sun);
    this.scene.add(this.buildingLayer);

    const flat = (geo: THREE.BufferGeometry, color: number, opacity = 1): THREE.Mesh => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };
    this.cursor = flat(new THREE.RingGeometry(0.5, 0.66, 4, 1, Math.PI / 4), 0xfff3c4);
    this.ghost = flat(new THREE.PlaneGeometry(1, 1), 0x3f9b3f, 0.4);
    this.selection = flat(new THREE.RingGeometry(0.62, 0.72, 4, 1, Math.PI / 4), 0xfff3c4);

    const unitMat = (): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ flatShading: true });
    const body = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 6); body.translate(0, 0.2, 0);
    const head = new THREE.IcosahedronGeometry(0.1, 0); head.translate(0, 0.5, 0);
    const load = new THREE.BoxGeometry(0.2, 0.16, 0.2); load.translate(0, 0.7, 0);
    this.bodies = new THREE.InstancedMesh(body, unitMat(), MAX_UNITS);
    this.heads = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ color: 0xe2bd94, flatShading: true }), MAX_UNITS);
    this.loads = new THREE.InstancedMesh(load, unitMat(), MAX_UNITS);
    // drewno niesione jako kłoda na ramieniu, reszta jako pakunek nad głową
    const log = new THREE.CylinderGeometry(0.07, 0.07, 0.62, 6); log.rotateX(Math.PI / 2); log.translate(0.13, 0.44, 0);
    this.logs = new THREE.InstancedMesh(log, new THREE.MeshLambertMaterial({ color: RESOURCE_DEFS.wood.color, flatShading: true }), MAX_UNITS);
    for (const m of [this.bodies, this.heads, this.loads, this.logs]) { m.count = 0; m.frustumCulled = false; this.scene.add(m); }

    this.cam = new StrategyCamera(canvas);
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') this.hover(this.pick(e)); });
    canvas.addEventListener('pointerleave', () => this.hover(null));
    canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || this.cam.dragged) return;
      const tile = this.pick(e);
      if (tile) this.onClick(tile, e.pointerType === 'touch');
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  setState(state: GameState, waterLevel: number, rim: number, focusPlayer = 0): void {
    if (this.view) { this.scene.remove(this.view.group); this.view.dispose(); }
    for (const g of this.buildingMeshes.values()) this.buildingLayer.remove(g);
    this.buildingMeshes.clear();
    this.prevPos.clear();
    this.storesTick = -1;
    this.state = state;
    this.view = buildTerrain(state.map, this.models, waterLevel);
    this.scene.add(this.view.group);
    const { width, height, starts } = state.map;
    this.cam.setBounds(width, height, rim + 8);
    const s = starts.find((p) => p.player === focusPlayer) ?? starts[0];
    if (s) this.cam.lookAt(s.x + 0.5 - width / 2, s.y + 0.5 - height / 2, 30);
    this.cursor.visible = this.ghost.visible = this.selection.visible = false;
  }

  /** Zapamiętuje pozycje jednostek przed krokiem symulacji, żeby ruch był płynny między tickami. */
  snapshot(): void {
    if (!this.state) return;
    this.prevPos.clear();
    for (const u of this.state.units) this.prevPos.set(u.id, [u.px, u.py]);
  }

  setGhost(g: Ghost | null): void {
    if (this.ghostModel) this.ghostModel.visible = false;
    if (!g || !this.view || !this.state) { this.ghost.visible = false; return; }
    const { width, height } = this.state.map;
    let top = 0;
    for (let y = g.y; y <= g.y + g.h; y++) for (let x = g.x; x <= g.x + g.w; x++) top = Math.max(top, this.view.heightAt(x, y));
    this.ghost.scale.set(g.w, g.h, 1);
    this.ghost.position.set(g.x + g.w / 2 - width / 2, top + 0.08, g.y + g.h / 2 - height / 2);
    (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(g.ok ? 0x3f9b3f : 0xb3261e);
    this.ghost.visible = true;
    // półprzezroczysty podgląd samej budowli nad działką
    const key = `${g.id}:${g.team}`;
    let model = this.ghostModels.get(key);
    if (!model) {
      model = this.models.building(g.id, TEAM_COLORS[g.team] ?? 0x888888);
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.name === 'base') { mesh.visible = false; return; }
        const m = (mesh.material as THREE.MeshLambertMaterial).clone();
        m.transparent = true; m.opacity = 0.85; m.depthWrite = false;
        mesh.material = m;
      });
      this.ghostModels.set(key, model);
      this.scene.add(model);
    }
    model.position.set(this.ghost.position.x, top, this.ghost.position.z);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshLambertMaterial).emissive.setHex(g.ok ? 0x000000 : 0x7a0f0a);
    });
    model.visible = true;
    this.ghostModel = model;
  }

  setSelection(buildingId: number): void {
    const b = this.state?.buildings.find((x) => x.id === buildingId);
    const mesh = this.buildingMeshes.get(buildingId);
    if (!b || !mesh) { this.selection.visible = false; return; }
    const def = BUILDINGS[b.type]!;
    this.selection.scale.set(def.w, def.h, 1);
    this.selection.position.set(mesh.position.x, mesh.position.y + 0.07, mesh.position.z);
    this.selection.visible = true;
  }

  frame(dt: number, alpha: number): void {
    this.cam.update(dt);
    this.time += dt;
    if (this.state && this.view) {
      if (!this.calm) this.animate(this.state, dt); this.syncBuildings(this.state, this.view); this.syncStores(this.state); this.syncUnits(this.state, this.view, alpha); }
    this.renderer.render(this.scene, this.cam.camera);
  }

  private syncBuildings(g: GameState, view: TerrainView): void {
    if (this.buildingMeshes.size === g.buildings.length && g.buildings.every((b) => this.buildingMeshes.has(b.id))) return;
    const alive = new Set<number>();
    const { width, height } = g.map;
    for (const b of g.buildings) {
      alive.add(b.id);
      if (this.buildingMeshes.has(b.id)) continue;
      const def = BUILDINGS[b.type]!;
      const team = g.players[b.owner]?.team ?? 0;
      const mesh = this.models.building(def.id, TEAM_COLORS[team] ?? 0x888888);
      let top = -99, low = 99;
      for (let y = b.y; y <= b.y + def.h; y++)
        for (let x = b.x; x <= b.x + def.w; x++) { const hh = view.heightAt(x, y); top = Math.max(top, hh); low = Math.min(low, hh); }
      mesh.position.set(b.x + def.w / 2 - width / 2, top, b.y + def.h / 2 - height / 2);
      const base = mesh.getObjectByName('base');
      if (base) { const depth = top - low + 0.3; base.scale.set(def.w * 0.96, depth, def.h * 0.96); base.position.y = -depth / 2; }
      this.buildingLayer.add(mesh);
      this.buildingMeshes.set(b.id, mesh);
    }
    for (const [id, mesh] of this.buildingMeshes) {
      if (alive.has(id)) continue;
      this.buildingLayer.remove(mesh);
      this.buildingMeshes.delete(id);
    }
  }

  private animate(g: GameState, dt: number): void {
    const working = new Set<number>();
    for (const u of g.units) if (u.phase === Phase.Working) working.add(u.job);
    for (const [id, mesh] of this.buildingMeshes) animateBuilding(mesh, working.has(id), this.time, dt);
  }

  /** Zapełnia najpierw widoczne składy w kolejności budowy, a twierdzę na końcu, żeby było widać każdą dostawę. */
  private syncStores(g: GameState): void {
    if (g.tick === this.storesTick) return;
    this.storesTick = g.tick;
    for (const p of g.players) {
      let left = 0, sum = 0;
      const colors: { color: number; share: number }[] = [];
      RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === 'stockpile') sum += p.res[i]!; });
      RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === 'stockpile' && p.res[i]! > 0) colors.push({ color: RESOURCE_DEFS[r].color, share: p.res[i]! / sum }); });
      left = sum;
      const stores = g.buildings.filter((b) => b.owner === p.id && BUILDINGS[b.type]!.capacity?.stockpile);
      stores.sort((a, b) => Number(BUILDINGS[a.type]!.id === 'keep') - Number(BUILDINGS[b.type]!.id === 'keep') || a.id - b.id);
      for (const b of stores) {
        const cap = BUILDINGS[b.type]!.capacity!.stockpile!;
        const here = Math.min(cap, left);
        left -= here;
        const mesh = this.buildingMeshes.get(b.id);
        if (mesh) setStockFill(mesh, here / cap, colors);
      }
    }
  }

  private syncUnits(g: GameState, view: TerrainView, alpha: number): void {
    const { width, height } = g.map;
    const n = Math.min(g.units.length, MAX_UNITS);
    const t = this.tmp;
    for (let i = 0; i < n; i++) {
      const u = g.units[i]!;
      const prev = this.prevPos.get(u.id);
      const fx = (prev ? prev[0] + (u.px - prev[0]) * alpha : u.px) / FP;
      const fy = (prev ? prev[1] + (u.py - prev[1]) * alpha : u.py) / FP;
      // stojący w tym samym miejscu rozstawiają się wokół, żeby nie zlewali się w jednego
      const still = u.path.length === 0;
      const ox = still ? (((u.id * 7) % 5) - 2) * 0.17 : 0;
      const oz = still ? (((u.id * 11) % 5) - 2) * 0.17 : 0;
      t.position.set(fx + ox - width / 2, view.heightAt(fx + ox, fy + oz), fy + oz - height / 2);
      t.scale.setScalar(1);
      t.updateMatrix();
      this.bodies.setMatrixAt(i, t.matrix);
      this.heads.setMatrixAt(i, t.matrix);
      this.bodies.setColorAt(i, this.color.setHex(TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888));
      const wood = u.carryRes === WOOD;
      // kłoda leży wzdłuż kierunku marszu
      const next = u.path[0];
      if (wood && next !== undefined) t.rotation.y = Math.atan2((next % g.map.width) + 0.5 - u.px / FP, Math.floor(next / g.map.width) + 0.5 - u.py / FP);
      t.scale.setScalar(wood ? 1 : 0);
      t.updateMatrix();
      this.logs.setMatrixAt(i, t.matrix);
      t.rotation.y = 0;
      t.scale.setScalar(u.carryRes < 0 || wood ? 0 : 1);
      t.updateMatrix();
      this.loads.setMatrixAt(i, t.matrix);
      this.loads.setColorAt(i, this.color.setHex(u.carryRes >= 0 ? RESOURCE_DEFS[RESOURCES[u.carryRes]!].color : 0));
    }
    for (const m of [this.bodies, this.heads, this.loads, this.logs]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  private resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
  }

  private pick(e: PointerEvent): TileRef | null {
    if (!this.view || !this.state) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    const hit = this.ray.intersectObject(this.view.ground)[0];
    if (!hit) return null;
    const { width, height } = this.state.map;
    const x = Math.floor(hit.point.x + width / 2), y = Math.floor(hit.point.z + height / 2);
    return x < 0 || y < 0 || x >= width || y >= height ? null : { x, y };
  }

  private hover(tile: TileRef | null): void {
    if (tile && this.view && this.state) {
      const { width, height } = this.state.map;
      this.cursor.position.set(tile.x + 0.5 - width / 2, Math.max(this.view.heightAt(tile.x + 0.5, tile.y + 0.5), 0) + 0.06, tile.y + 0.5 - height / 2);
      this.cursor.visible = !this.ghost.visible;
    } else this.cursor.visible = false;
    this.onHover(tile);
  }
}

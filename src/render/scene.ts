import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { animateBuilding, roadMaterials, rubbleModel, setNight, setRubble, setStockFill, torchModel } from './buildings';
import { RESOURCES, RESOURCE_DEFS } from '../data/resources';
import { Terrain } from '../data/terrain';
import { TEAM_COLORS } from '../data/teams';
import { FP, Phase, type GameState } from '../sim/state';
import { clockAt } from '../sim/clock';
import { StrategyCamera } from './camera';
import { proceduralModels, type ModelFactory } from './models';
import { Figures } from './peasants';
import { createLoads, tint } from './loads';
import { HAZE, buildTerrain, type TerrainView } from './terrain';

export interface TileRef { x: number; y: number }
export interface Ghost { x: number; y: number; w: number; h: number; ok: boolean; id: string; team: number; rot: number }

const MAX_UNITS = 2048;
const tmpColor = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
/** Klatki kluczowe doby: godzina, barwa i siła słońca (albo księżyca), siła światła nieba, barwa mgły i tła */
const DAY = [
  { h: 0, sun: 0x9fb2e8, power: 0.5, sky: 0.42, haze: 0x141b33 },
  { h: 4.5, sun: 0x9fb2e8, power: 0.5, sky: 0.42, haze: 0x182039 },
  { h: 6, sun: 0xffb37a, power: 1.1, sky: 0.85, haze: 0xd6a887 },
  { h: 8, sun: 0xffe6c2, power: 1.8, sky: 1.25, haze: 0xd4cdb8 },
  { h: 12, sun: 0xfff4e0, power: 2.0, sky: 1.35, haze: 0xcdd2c6 },
  { h: 17, sun: 0xffe6c2, power: 1.8, sky: 1.25, haze: 0xd4cdb8 },
  { h: 19.5, sun: 0xff9d66, power: 1.1, sky: 0.85, haze: 0xc98f6e },
  { h: 21.5, sun: 0x9fb2e8, power: 0.5, sky: 0.42, haze: 0x182039 },
  { h: 24, sun: 0x9fb2e8, power: 0.5, sky: 0.42, haze: 0x141b33 },
];
const WOOD = RESOURCES.indexOf('wood');
const FISHER = BUILDINGS.findIndex((b) => b.id === 'fisher');

/** Renderer: czyta stan symulacji, nigdy go nie zmienia. */
export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: StrategyCamera;
  private view: TerrainView | null = null;
  private state: GameState | null = null;
  private ray = new THREE.Raycaster();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sunDir = new THREE.Vector3(-55, 85, 40);
  /** 0 w dzień, 1 w środku nocy */
  private night = 0;
  private lamps: THREE.PointLight[] = [];
  private lampSpots: { v: THREE.Vector3; k: number }[] = [];
  private handTorches: THREE.InstancedMesh;
  private rods: THREE.InstancedMesh;
  private frameNo = 0;

  private cursor: THREE.Mesh;
  private ghost: THREE.Mesh;
  private selection: THREE.Mesh;
  private ghostModels = new Map<string, THREE.Group>();
  private ghostModel: THREE.Group | null = null;
  private buildingLayer = new THREE.Group();
  private buildingMeshes = new Map<number, THREE.Group>();

  private figures: Figures;
  private facing = new Map<number, number>();
  /** Faza kroku każdego chłopa: rośnie z przebytą drogą, więc nogi chodzą w tempie marszu przy każdej prędkości gry */
  private strides = new Map<number, { x: number; y: number; phase: number }>();
  private camps = new Map<number, GameState['buildings'][number]>();
  private loads: Map<number, THREE.InstancedMesh>;
  private logs: THREE.InstancedMesh;
  private planks: THREE.InstancedMesh;
  private time = 0;
  private calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private prevPos = new Map<number, [number, number]>();
  private storesTick = -1;
  private selectedId = 0;
  private cutSeen = 0;
  private roadSum = -1;
  private rubbleMeshes = new Map<number, THREE.Group>();
  /** Budynki w trakcie zawalania się po rozbiórce */
  private dying: { mesh: THREE.Group; t: number }[] = [];
  /** Gdy prawda, przeciąganie lewym przyciskiem maluje (np. drogę) zamiast przesuwać kamerę */
  painting = false;
  onPaint: (tile: TileRef) => void = () => {};
  private tmp = new THREE.Object3D();

  onHover: (tile: TileRef | null) => void = () => {};
  onClick: (tile: TileRef, touch: boolean) => void = () => {};
  /** Kliknięto w chłopa o tym numerze */
  onUnit: (id: number) => void = () => {};
  private unitSpots: { id: number; x: number; z: number }[] = [];
  private selectedUnit = 0;
  private unitY = new Map<number, number>();

  constructor(private canvas: HTMLCanvasElement, private models: ModelFactory = proceduralModels) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(HAZE);
    this.scene.fog = new THREE.Fog(HAZE, 55, 150);
    // Cienie: jedno słońce, którego obszar cienia podąża za kamerą. Na telefonach mniejsza mapa cieni.
    const phone = matchMedia('(pointer: coarse)').matches;
    // filmowe odwzorowanie tonów: jasne partie nie przepalają się, cienie zostają głębokie
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x6a5a3c, 1.5);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe2ad, 3.6);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(phone ? 1024 : 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.25;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    this.scene.add(sun, sun.target);
    this.sun = sun;
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

    this.figures = new Figures(MAX_UNITS, this.scene);
    // Prawdziwe światła punktowe są drogie, więc jest ich stała pula: nocą trafiają do pochodni najbliżej środka ekranu.
    // Płomienie świecą na wszystkich pochodniach, ale otoczenie oświetla tylko ta pula.
    for (let i = 0; i < (phone ? 5 : 12); i++) {
      const lamp = new THREE.PointLight(0xffb469, 0, 8, 2);
      this.scene.add(lamp);
      this.lamps.push(lamp);
    }
    const hand = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 5).translate(0.17, 0.5, 0.1), 0x4a3320),
      tint(new THREE.ConeGeometry(0.05, 0.16, 5).translate(0.17, 0.72, 0.1), 0xffa53a),
    ]);
    this.handTorches = new THREE.InstancedMesh(hand, new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_UNITS);
    // wędka rybaka: kij, żyłka i spławik
    const rod = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.012, 0.02, 1.1, 5).rotateX(1.05).translate(0.12, 0.72, 0.6), 0x6b4a2e),
      tint(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 3).translate(0.12, 0.62, 1.07), 0xe8e4d8),
      tint(new THREE.IcosahedronGeometry(0.035, 0).translate(0.12, 0.24, 1.07), 0xd0281f),
    ]);
    this.rods = new THREE.InstancedMesh(rod, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }), MAX_UNITS);
    this.rods.count = 0;
    this.rods.frustumCulled = false;
    this.scene.add(this.rods);
    this.handTorches.count = 0;
    this.handTorches.frustumCulled = false;
    this.scene.add(this.handTorches);
    this.loads = createLoads(MAX_UNITS, this.scene);
    // drewno niesione jako kłoda na ramieniu, reszta jako pakunek nad głową
    // całe ścięte drzewo ciągnięte po ziemi za drwalem: pień z gałęziami i koroną na końcu
    const log = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.06, 0.1, 1.3, 7).rotateX(Math.PI / 2 - 0.1).translate(0, 0.15, -0.72), 0x6b4a2e),
      tint(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 5).rotateZ(0.9).translate(0.13, 0.2, -0.95), 0x6b4a2e),
      tint(new THREE.CylinderGeometry(0.02, 0.035, 0.28, 5).rotateZ(-0.9).translate(-0.13, 0.17, -0.75), 0x6b4a2e),
      tint(new THREE.ConeGeometry(0.3, 0.6, 7).rotateX(-Math.PI / 2).translate(0, 0.2, -1.25), 0x3c7a3a),
      tint(new THREE.ConeGeometry(0.22, 0.5, 7).rotateX(-Math.PI / 2).translate(0, 0.2, -1.6), 0x44883f),
      tint(new THREE.IcosahedronGeometry(0.16, 0).translate(0.16, 0.2, -1.05), 0x4c8f44),
      tint(new THREE.IcosahedronGeometry(0.15, 0).translate(-0.17, 0.18, -0.98), 0x3c7a3a),
    ]);
    this.logs = new THREE.InstancedMesh(log, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), MAX_UNITS);
    const plank = new THREE.BoxGeometry(0.2, 0.1, 0.6); plank.translate(0.14, 0.53, 0);
    this.planks = new THREE.InstancedMesh(plank, new THREE.MeshLambertMaterial({ color: 0xc9a26b, flatShading: true }), MAX_UNITS);
    for (const m of [this.logs, this.planks]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; this.scene.add(m); }

    this.cam = new StrategyCamera(canvas);
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') this.hover(this.pick(e));
      if (this.painting && e.buttons === 1) { const tile = this.pick(e); if (tile) this.onPaint(tile); }
    });
    canvas.addEventListener('pointerleave', () => this.hover(null));
    canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || (this.cam.dragged && !this.painting)) return;
      // najpierw sprawdzamy, czy kliknięto w człowieka (nie w trybie malowania dróg i wyburzania)
      if (!this.painting) { const id = this.pickUnit(e); if (id) { this.onUnit(id); return; } }
      // kliknięcie w dach albo ścianę liczy się jako kliknięcie w ten budynek, a nie w ziemię za nim
      const tile = this.pickBuilding(e) ?? this.pick(e);
      if (tile) this.onClick(tile, e.pointerType === 'touch');
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  setState(state: GameState, waterLevel: number, rim: number, focusPlayer = 0): void {
    if (this.view) { this.scene.remove(this.view.group); this.view.dispose(); }
    for (const g of this.buildingMeshes.values()) this.buildingLayer.remove(g);
    this.buildingMeshes.clear();
    for (const pile of this.rubbleMeshes.values()) this.scene.remove(pile);
    this.rubbleMeshes.clear();
    for (const d of this.dying) this.buildingLayer.remove(d.mesh);
    this.dying = [];
    this.prevPos.clear();
    this.facing.clear();
    this.strides.clear();
    this.storesTick = -1;
    this.state = state;
    this.view = buildTerrain(state.map, this.models, waterLevel);
    this.scene.add(this.view.group);
    const { width, height, starts } = state.map;
    this.cam.setBounds(width, height, rim + 8);
    const s = starts.find((p) => p.player === focusPlayer) ?? starts[0];
    if (s) this.cam.lookAt(s.x + 0.5 - width / 2, s.y + 0.5 - height / 2, 30);
    this.cursor.visible = this.ghost.visible = this.selection.visible = false;
    this.roadSum = -1;
    this.cutSeen = state.cut.length; // wczytana gra ma już polany na mapie
  }

  /** Zapamiętuje pozycje jednostek przed krokiem symulacji, żeby ruch był płynny między tickami. */
  snapshot(): void {
    if (!this.state) return;
    this.prevPos.clear();
    for (const u of this.state.units) this.prevPos.set(u.id, [u.px, u.py]);
  }

  /** Blokuje przesuwanie kamery myszą na czas malowania */
  setPainting(on: boolean): void { this.painting = on; this.cam.panLocked = on; }

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
    model.rotation.y = (g.rot * Math.PI) / 2;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      // fundament dzieli materiał z prawdziwymi budynkami, więc go nie barwimy
      if (mesh.isMesh && mesh.name !== 'base') (mesh.material as THREE.MeshLambertMaterial).emissive?.setHex(g.ok ? 0x000000 : 0x7a0f0a);
    });
    model.visible = true;
    this.ghostModel = model;
  }

  setSelection(buildingId: number): void {
    this.selectedId = buildingId;
    if (buildingId) this.selectedUnit = 0;
    const b = this.state?.buildings.find((x) => x.id === buildingId);
    const mesh = this.buildingMeshes.get(buildingId);
    if (!b || !mesh) { this.selection.visible = false; return; }
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    this.selection.scale.set(fp.w, fp.h, 1);
    this.selection.position.set(mesh.position.x, mesh.position.y + 0.07, mesh.position.z);
    this.selection.visible = true;
  }

  frame(dt: number, alpha: number): void {
    this.cam.update(dt);
    this.time += dt;
    if (this.state) this.setDaylight(clockAt(this.state.tick).hour);
    this.aimSun();
    if (this.state && this.view) {
      this.animate(this.state, this.calm ? 0 : dt);
      this.syncForest(this.state, this.view);
      this.syncRoads(this.state, this.view);
      this.syncRubble(this.state, this.view, dt);
      this.syncLamps(this.state);
      if (!this.calm) this.view.animate(this.time); this.syncBuildings(this.state, this.view); this.syncStores(this.state); this.syncUnits(this.state, this.view, alpha); }
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
      const fp = footprint(def, b.rot);
      // pod budynkiem nie rośnie trawa, krzewy ani nie leżą kamyki
      for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) view.clear(y * width + x);
      for (let y = b.y; y <= b.y + fp.h; y++)
        for (let x = b.x; x <= b.x + fp.w; x++) { const hh = view.heightAt(x, y); top = Math.max(top, hh); low = Math.min(low, hh); }
      // budynek siada lekko poniżej najwyższego punktu działki, wtopiony w teren, bez cokołu
      const ground = low + (top - low) * 0.35;
      mesh.position.set(b.x + fp.w / 2 - width / 2, ground, b.y + fp.h / 2 - height / 2);
      mesh.rotation.y = (b.rot * Math.PI) / 2;
      const base = mesh.getObjectByName('base');
      const patch = mesh.getObjectByName('patch');
      if (patch) { patch.scale.set(def.w * 0.62, 1, def.h * 0.62); patch.position.y = top - ground + 0.015; patch.receiveShadow = true; }
      if (base) base.visible = false; // żadnego podniesienia pod budynkiem
      mesh.traverse((o) => {
        const part = o as THREE.Mesh;
        if (!part.isMesh || o.parent?.name === 'smoke' || o.name === 'patch') return;
        part.castShadow = true;
        part.receiveShadow = true;
      });
      if (def.id !== 'torch') {
        const torch = torchModel();
        torch.position.set(def.w / 2 - 0.08, 0, def.h / 2 - 0.08);
        mesh.add(torch);
      }
      this.buildingLayer.add(mesh);
      this.buildingMeshes.set(b.id, mesh);
    }
    for (const [id, mesh] of this.buildingMeshes) {
      if (alive.has(id)) continue;
      // rozebrany budynek nie znika od razu: zapada się i przechyla, a pod nim zostaje gruz
      this.dying.push({ mesh, t: 0 });
      this.buildingMeshes.delete(id);
    }
  }

  /** Zawalanie się rozebranych budynków i stosy gruzu, które maleją z każdym wyniesionym ładunkiem. */
  private syncRubble(g: GameState, view: TerrainView, dt: number): void {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]!;
      d.t += Math.max(dt, 0.016);
      const k = Math.min(1, d.t / 1.1);
      d.mesh.scale.y = Math.max(0.04, 1 - k * k);
      d.mesh.rotation.z = k * 0.18;
      d.mesh.rotation.x = k * -0.1;
      if (k >= 1) { this.buildingLayer.remove(d.mesh); this.dying.splice(i, 1); }
    }
    const { width, height } = g.map;
    const alive = new Set<number>();
    for (const r of g.rubble) {
      alive.add(r.id);
      let pile = this.rubbleMeshes.get(r.id);
      if (!pile) {
        pile = rubbleModel(r.w, r.h, r.id);
        pile.position.set(r.x + r.w / 2 - width / 2, view.heightAt(r.x + r.w / 2, r.y + r.h / 2), r.y + r.h / 2 - height / 2);
        this.scene.add(pile);
        this.rubbleMeshes.set(r.id, pile);
      }
      setRubble(pile, r.loads.length / r.total);
    }
    for (const [id, pile] of this.rubbleMeshes) if (!alive.has(id)) { this.scene.remove(pile); this.rubbleMeshes.delete(id); }
  }

  /** Pora dnia: kolor i siła słońca, światło nieba, barwa mgły. W nocy świeci chłodny księżyc. */
  private setDaylight(hour: number): void {
    let i = 0;
    while (i < DAY.length - 2 && hour >= DAY[i + 1]!.h) i++;
    const a = DAY[i]!, b = DAY[i + 1]!;
    const k = Math.max(0, Math.min(1, (hour - a.h) / (b.h - a.h)));
    this.sun.color.setHex(a.sun).lerp(tmpColor.setHex(b.sun), k);
    this.sun.intensity = a.power + (b.power - a.power) * k;
    this.hemi.intensity = a.sky + (b.sky - a.sky) * k;
    const bg = this.scene.background as THREE.Color;
    bg.setHex(a.haze).lerp(tmpColor.setHex(b.haze), k);
    (this.scene.fog as THREE.Fog).color.copy(bg);
    // płynne przejście: zmierzch 19:30–21:30, świt 4:30–6:30
    const dusk = Math.max(0, Math.min(1, (hour - 19.5) / 2)), dawn = Math.max(0, Math.min(1, (6.5 - hour) / 2));
    this.night = hour >= 12 ? dusk : dawn;
    setNight(this.night);
    // słońce wędruje ze wschodu na zachód; nocą tę samą drogę robi księżyc
    const dayTime = hour >= 6 && hour < 20;
    const arc = (((dayTime ? hour - 6 : (hour + 4) % 24) / (dayTime ? 14 : 10)) * 0.84 + 0.08) * Math.PI;
    this.sunDir.set(-Math.cos(arc) * 80, 30 + Math.sin(arc) * 70, 40);
  }

  /** Przesuwa słońce i obszar cienia za kamerą; im dalej kamera, tym większy obszar. */
  private aimSun(): void {
    const f = this.cam.focus;
    const half = Math.max(22, Math.min(70, this.cam.distance * 1.15));
    // skok o stałą siatkę, żeby cienie nie migotały przy przesuwaniu kamery
    const grid = (half * 2) / this.sun.shadow.mapSize.x * 8;
    const x = Math.round(f.x / grid) * grid, z = Math.round(f.z / grid) * grid;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x, this.sunDir.y, z + this.sunDir.z);
    const c = this.sun.shadow.camera;
    if (c.right !== half) { c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.updateProjectionMatrix(); }
  }

  /** Nocą zapala pochodnie przy budynkach i w rękach ludzi oraz rozdaje światła najbliższym z nich. */
  private syncLamps(g: GameState): void {
    const on = this.night > 0.15;
    const flicker = this.calm ? 1 : 0.85 + Math.sin(this.time * 11) * 0.08 + Math.sin(this.time * 23.7) * 0.07;
    const lit = new Set<number>();
    for (const b of g.buildings) if (b.lit) lit.add(b.id);
    for (const [id, mesh] of this.buildingMeshes) {
      const torch = mesh.getObjectByName('torch');
      if (!torch) continue;
      // słup stoi cały czas; płomień pali się dopiero, gdy ktoś podejdzie i zapali pochodnię
      const flame = torch.getObjectByName('torchflame');
      if (flame) { flame.visible = lit.has(id); flame.scale.set(1, 0.8 + flicker * 0.4, 1); }
    }
    this.handTorches.visible = on;
    if (!on) { for (const lamp of this.lamps) lamp.intensity = 0; return; }
    // co kilka klatek wybieramy źródła światła najbliższe środkowi ekranu
    if (this.frameNo++ % 6 === 0) {
      const f = this.cam.focus;
      const spots: { v: THREE.Vector3; d: number; k: number }[] = [];
      for (const [id, mesh] of this.buildingMeshes) {
        const torch = mesh.getObjectByName('torch');
        if (!torch || !lit.has(id)) continue;
        const v = torch.getWorldPosition(new THREE.Vector3());
        v.y += 1.25;
        spots.push({ v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2, k: 1 });
      }
      const { width, height } = g.map;
      for (const u of g.units) {
        if (u.path.length === 0) continue; // pochodnię niosą ci, którzy idą
        const v = new THREE.Vector3(u.px / FP - width / 2, (this.view?.heightAt(u.px / FP, u.py / FP) ?? 0) + 0.8, u.py / FP - height / 2);
        spots.push({ v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 4, k: 0.2 }); // ręczna pochodnia świeci dużo słabiej niż ta na słupie
      }
      spots.sort((a, b) => a.d - b.d);
      this.lampSpots = spots.slice(0, this.lamps.length);
    }
    this.lamps.forEach((lamp, i) => {
      const spot = this.lampSpots[i];
      lamp.intensity = spot ? spot.k * this.night * 5 * (0.9 + Math.sin(this.time * 9 + i * 2.1) * (this.calm ? 0 : 0.1)) * flicker : 0;
      if (spot) lamp.position.copy(spot.v);
    });
  }

  private syncRoads(g: GameState, view: TerrainView): void {
    if (g.tick % 3 !== 0 && this.roadSum >= 0) return;
    let sum = 0;
    for (let i = 0; i < g.roads.length; i++) if (g.roads[i]) sum = (sum * 31 + i * 3 + g.roads[i]!) | 0;
    if (sum === this.roadSum) return;
    this.roadSum = sum;
    view.setRoads(g.roads, roadMaterials());
  }

  /** Drzewo przechyla się pod koniec rąbania, a po ścięciu znika i zostaje pniak. */
  private syncForest(g: GameState, view: TerrainView): void {
    for (const u of g.units) {
      if (u.phase !== Phase.WorkingSite || u.timer > 40) continue;
      const tile = (u.py >> 8) * g.map.width + (u.px >> 8);
      if (g.map.tiles[tile] === Terrain.Forest) { const k = 1 - u.timer / 40; view.fell(tile, k * k); } // powoli rusza, potem wali się coraz szybciej
    }
    for (; this.cutSeen < g.cut.length; this.cutSeen++) view.clear(g.cut[this.cutSeen]!);
  }

  private animate(g: GameState, dt: number): void {
    const working = new Set<number>();
    for (const u of g.units) {
      if (u.phase === Phase.Working) working.add(u.job);
      else if (u.phase === Phase.Resting) working.add(u.home);
      else if (u.phase === Phase.Idle && u.path.length === 0) { const camp = this.camps.get((u.py >> 8) * g.map.width + (u.px >> 8)); if (camp) working.add(camp.id); }
    }
    // kliknięty budynek też odsłania wnętrze, żeby dało się zajrzeć do środka
    for (const u of g.units) {
      if (!u.job) continue;
      const yard = this.buildingMeshes.get(u.job)?.getObjectByName('yardlog');
      if (!yard) continue;
      // pień leży pod chatą, dopóki zostały z niego partie do pocięcia
      const left = u.phase === Phase.ToHome ? 0 : u.batches;
      yard.visible = left > 0;
      yard.scale.x = Math.max(0.3, left / 4);
    }
    for (const [id, mesh] of this.buildingMeshes) animateBuilding(mesh, working.has(id) || id === this.selectedId, this.time, dt);
  }

  /** Zapełnia najpierw otwarte składy w kolejności budowy, a zamkniętą stodołę na końcu, żeby było widać każdą dostawę. */
  private syncStores(g: GameState): void {
    if (g.tick === this.storesTick) return;
    this.storesTick = g.tick;
    for (const p of g.players) {
      for (const [kind, group] of [['stockpile', 'fill'], ['granary', 'foodfill']] as const) {
        let sum = 0;
        const stock: { id: string; share: number }[] = [];
        RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === kind) sum += p.res[i]!; });
        RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === kind && p.res[i]! > 0) stock.push({ id: r, share: p.res[i]! / sum }); });
        let left = sum;
        const stores = g.buildings.filter((b) => b.owner === p.id && BUILDINGS[b.type]!.capacity?.[kind]);
        stores.sort((a, b) => Number(BUILDINGS[a.type]!.id === 'barn') - Number(BUILDINGS[b.type]!.id === 'barn') || a.id - b.id);
        for (const b of stores) {
          const cap = BUILDINGS[b.type]!.capacity![kind]!;
          const here = Math.min(cap, left);
          left -= here;
          const mesh = this.buildingMeshes.get(b.id);
          if (mesh) setStockFill(mesh, here / cap, stock, group);
        }
      }
    }
  }

  private syncUnits(g: GameState, view: TerrainView, alpha: number): void {
    const { width, height } = g.map;
    const n = Math.min(g.units.length, MAX_UNITS);
    const t = this.tmp;
    this.unitSpots.length = 0;
    this.unitY.clear();
    const jobs = new Map<number, GameState['buildings'][number]>();
    this.camps.clear();
    for (const b of g.buildings) { jobs.set(b.id, b); if (BUILDINGS[b.type]!.idleSlots && b.door >= 0) this.camps.set(b.door, b); }
    for (let i = 0; i < n; i++) {
      const u = g.units[i]!;
      const prev = this.prevPos.get(u.id);
      const fx = (prev ? prev[0] + (u.px - prev[0]) * alpha : u.px) / FP;
      const fy = (prev ? prev[1] + (u.py - prev[1]) * alpha : u.py) / FP;
      // stojący w tym samym miejscu rozstawiają się wokół, żeby nie zlewali się w jednego
      const still = u.path.length === 0;
      const ox = still ? (((u.id * 7) % 5) - 2) * 0.17 : 0;
      const oz = still ? (((u.id * 11) % 5) - 2) * 0.17 : 0;
      // postać patrzy w stronę marszu; gdy stoi, zachowuje ostatni kierunek
      const next = u.path[0];
      let heading = this.facing.get(u.id) ?? ((u.id * 2.4) % 6.28);
      if (next !== undefined) {
        const want = Math.atan2((next % width) + 0.5 - fx, Math.floor(next / width) + 0.5 - fy);
        let diff = want - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        heading += diff * 0.25; // płynny obrót
        this.facing.set(u.id, heading);
      }
      const walking = !still && !this.calm;
      let st = this.strides.get(u.id);
      if (!st) { st = { x: fx, y: fy, phase: u.id }; this.strides.set(u.id, st); }
      // jeden pełny krok (obie nogi) na około 0,8 pola
      st.phase += Math.min(0.5, Math.hypot(fx - st.x, fy - st.y)) * 7.5;
      st.x = fx; st.y = fy;
      const stride = walking ? st.phase : 0;
      let swing = walking ? Math.sin(stride) * 0.55 : 0;
      t.position.set(fx + ox - width / 2, view.heightAt(fx + ox, fy + oz) + (walking ? Math.abs(Math.cos(stride)) * 0.025 : 0), fy + oz - height / 2);
      t.rotation.set(0, heading, 0);
      // pracujący: rolnik chodzi po polu, rzemieślnik stoi w odsłoniętym wnętrzu
      const resting = u.phase === Phase.Resting;
      const job = resting ? jobs.get(u.home) : u.phase === Phase.Working && u.job ? jobs.get(u.job) : undefined;
      const mode = resting ? 'inside' : job ? BUILDINGS[job.type]!.workView : undefined;
      if (job && mode) {
        const def = BUILDINGS[job.type]!;
        const mesh = this.buildingMeshes.get(job.id);
        const fp = footprint(def, job.rot);
        const cx = job.x + fp.w / 2, cy = job.y + fp.h / 2;
        const turn = (job.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const k = this.calm ? 0 : this.time;
        if (mode === 'field') {
          const wx = cx + Math.sin(k * 0.5 + u.id) * fp.w * 0.3, wy = cy + Math.cos(k * 0.37 + u.id * 2) * fp.h * 0.3;
          t.position.set(wx - width / 2, (mesh?.position.y ?? 0) + 0.05, wy - height / 2);
          t.rotation.set(Math.max(0, Math.sin(k * 5)) * 0.5, k * 0.4 + u.id, 0, 'YXZ'); // schyla się przy pracy
          swing = Math.sin(k * 5) * 0.4;
        } else {
          const m = mesh?.getObjectByName('interior')?.children[0];
          // miejsce we wnętrzu jest zapisane w układzie modelu, więc obracamy je razem z budynkiem
          const mx = m ? m.position.x : 0, mz = (m ? m.position.z : 0) + (resting ? 0.3 : 0.12);
          const lx = mx * cosT + mz * sinT, lz = -mx * sinT + mz * cosT;
          // odpoczywający siedzą przy stole obok siebie, pracujący krzątają się przy warsztacie
          const side = resting ? ((u.id % 3) - 1) * 0.28 : Math.sin(k * 2) * 0.12;
          t.position.set(cx + lx - width / 2 + side, (mesh?.position.y ?? 0) + (resting ? -0.03 : 0.05), cy + lz - height / 2);
          t.rotation.set(0, resting ? 0 : Math.PI + Math.sin(k * 2) * 0.6, 0);
          if (!resting) swing = Math.sin(k * 6) * 0.35;
        }
      }
      // bezrobotni siadają wokół ogniska w obozowisku
      const camp = u.phase === Phase.Idle && still ? this.camps.get((u.py >> 8) * width + (u.px >> 8)) : undefined;
      if (camp && camp.owner === u.owner) {
        const mesh = this.buildingMeshes.get(camp.id);
        const a = (u.id * 2.39996) % (Math.PI * 2), rad = 0.5 + (u.id % 3) * 0.14;
        t.position.set(camp.x + 1 + Math.cos(a) * rad - width / 2, (mesh?.position.y ?? 0) + 0.02, camp.y + 1.35 + Math.sin(a) * rad * 0.8 - height / 2);
        t.rotation.set(0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0);
        swing = 0;
      }
      // rybak stoi twarzą do wody z wędką; pozostali na stanowisku machają siekierą lub kilofem
      const fishing = u.phase === Phase.WorkingSite && u.job !== 0 && jobs.get(u.job)?.type === FISHER;
      if (fishing) {
        const tx = u.px >> 8, ty = u.py >> 8;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          if (g.map.tiles[(ty + dy) * width + tx + dx] === Terrain.Water) { t.rotation.set(0, Math.atan2(dx, dy), 0); break; }
        swing = 0;
      } else if (u.phase === Phase.WorkingSite && !this.calm) swing = Math.sin(this.time * 9 + u.id) * 1.1;
      this.unitSpots.push({ id: u.id, x: t.position.x, z: t.position.z });
      this.unitY.set(u.id, t.position.y);
      if (u.id === this.selectedUnit) { this.selection.scale.set(0.5, 0.5, 1); this.selection.position.set(t.position.x, t.position.y + 0.05, t.position.z); this.selection.visible = true; }
      t.scale.setScalar(1);
      t.updateMatrix();
      this.rods.setMatrixAt(i, fishing ? t.matrix : ZERO);
      const wood = u.carryRes === WOOD;
      // nocą idący niosą pochodnię (ci z ładunkiem mają zajęte ręce)
      const torchOn = this.night > 0.15 && !still && u.carryRes < 0;
      if (torchOn) this.handTorches.setMatrixAt(i, t.matrix); else this.handTorches.setMatrixAt(i, ZERO);
      this.figures.set(i, t.matrix, swing, u.carryRes >= 0 && !(wood && u.phase === Phase.ToHome), TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888, u.id);
      // z lasu do chaty niesie kłodę, z chaty do składu gotowe deski
      t.scale.setScalar(wood && u.phase === Phase.ToHome ? 1 : 0);
      t.updateMatrix();
      this.logs.setMatrixAt(i, t.matrix);
      t.scale.setScalar(wood && u.phase !== Phase.ToHome ? 1 : 0);
      t.updateMatrix();
      this.planks.setMatrixAt(i, t.matrix);
      // każdy surowiec ma własny wygląd: kosz jabłek, bochenki, snop, worek, blok, sztaby
      for (const [res, mesh] of this.loads) {
        t.scale.setScalar(u.carryRes === res ? 1 : 0);
        t.updateMatrix();
        mesh.setMatrixAt(i, t.matrix);
      }
    }
    this.figures.finish(n);
    this.rods.count = n;
    this.rods.instanceMatrix.needsUpdate = true;
    this.handTorches.count = n;
    this.handTorches.instanceMatrix.needsUpdate = true;
    for (const m of [...this.loads.values(), this.logs, this.planks]) {
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

  /** Zaznacza chłopa: pierścień chodzi za nim. 0 zdejmuje zaznaczenie. */
  setUnitSelection(id: number): void { this.selectedUnit = id; if (id) this.selectedId = 0; else if (!this.selectedId) this.selection.visible = false; }

  private pickUnit(e: PointerEvent): number {
    if (!this.view) return 0;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    // odległość promienia od środka sylwetki; wygrywa najbliższa postać w zasięgu
    let best = 0, bestD = 0.3;
    const p = new THREE.Vector3();
    for (const u of this.unitSpots) {
      p.set(u.x, (this.unitY.get(u.id) ?? 0) + 0.33, u.z);
      const d = this.ray.ray.distanceToPoint(p);
      if (d < bestD) { bestD = d; best = u.id; }
    }
    return best;
  }

  private pickBuilding(e: PointerEvent): TileRef | null {
    if (!this.state) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    const hit = this.ray.intersectObjects([...this.buildingMeshes.values()], true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && o.parent !== this.buildingLayer) o = o.parent;
    for (const [id, mesh] of this.buildingMeshes) {
      if (mesh !== o) continue;
      const b = this.state.buildings.find((x) => x.id === id);
      return b ? { x: b.x, y: b.y } : null;
    }
    return null;
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
      // ramka pola pokazuje się tylko przy malowaniu dróg i wyburzaniu; przy zwykłym ruchu myszy nic nie zaznaczamy
      this.cursor.visible = this.painting && !this.ghost.visible;
    } else this.cursor.visible = false;
    this.onHover(tile);
  }
}

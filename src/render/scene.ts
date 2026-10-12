import * as THREE from 'three';
import { TEST } from '../testmode';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { animateBuilding, roadMaterials, rubbleModel, setNight, setRubble, setStockFill, torchModel } from './buildings';
import { RESOURCES, RESOURCE_DEFS } from '../data/resources';
import { Terrain } from '../data/terrain';
import { TEAM_COLORS } from '../data/teams';
import { FP, Phase, type GameState } from '../sim/state';
import { clockAt } from '../sim/clock';
import { maxHp } from '../sim/systems/placement';
import { StrategyCamera } from './camera';
import { proceduralModels, type ModelFactory } from './models';
import { Figures } from './peasants';
import { createLoads, tint } from './loads';
import { HAZE, buildTerrain, type TerrainView } from './terrain';
import { pattern } from './textures';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export interface TileRef { x: number; y: number }
const FIRE_A = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
const FIRE_B = new THREE.MeshBasicMaterial({ color: 0xffd25a });

let sadMat: THREE.SpriteMaterial | null = null;
/** Smutna minka nad głową chłopa, który opuszcza osadę */
function sadMaterial(): THREE.SpriteMaterial {
  if (sadMat) return sadMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 7; x.strokeStyle = '#e9c145'; x.stroke();
  x.fillStyle = '#f2d27a'; x.beginPath(); x.arc(64, 64, 44, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3a2410';
  x.beginPath(); x.arc(48, 54, 6, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(80, 54, 6, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#3a2410'; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.arc(64, 96, 20, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); // usta w podkówkę
  x.fillStyle = '#6fb6ff'; x.beginPath(); x.ellipse(84, 70, 4, 7, 0, 0, Math.PI * 2); x.fill(); // łza
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sadMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return sadMat;
}

let noWorkerMat: THREE.SpriteMaterial | null = null;
/** Znak „brak pracownika”: ludzik w złotym kole przekreślony na czerwono, rysowany raz na płótnie */
function noWorkerMaterial(): THREE.SpriteMaterial {
  if (noWorkerMat) return noWorkerMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#e9c145'; x.stroke();
  x.fillStyle = '#f6ecd0';
  x.beginPath(); x.arc(64, 40, 13, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(40, 98); x.quadraticCurveTo(42, 60, 64, 58); x.quadraticCurveTo(86, 60, 88, 98); x.closePath(); x.fill();
  x.strokeStyle = '#d6372b'; x.lineWidth = 12; x.lineCap = 'round';
  x.beginPath(); x.moveTo(26, 26); x.lineTo(102, 102); x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  noWorkerMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return noWorkerMat;
}

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
  /** Obraz przechodzi przez cieniowanie zagłębień (AO): ciemniejsze kąty, styki ścian z ziemią, szczeliny */
  private composer!: EffectComposer;
  private ao!: N8AOPass;
  /** Zwykłe renderowanie, gdy cieniowanie zagłębień jest wyłączone w ustawieniach */
  private plain!: RenderPass;
  private view: TerrainView | null = null;
  private state: GameState | null = null;
  private ray = new THREE.Raycaster();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sunDir = new THREE.Vector3(-55, 85, 40);
  /** 0 w dzień, 1 w środku nocy */
  private night = 0;
  private sadFaces: THREE.Sprite[] = [];
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
  /** Żołnierze: osobny zestaw postaci w zbrojach */
  private spearmen: Figures;
  private rings: THREE.InstancedMesh;
  /** Ciała poległych i ciemne plamy pod nimi */
  private bodies: Figures;
  private stains: THREE.InstancedMesh;
  /** Migające kropki na polach, do których idą zaznaczeni żołnierze, i fala w miejscu rozkazu */
  private dots: THREE.InstancedMesh;
  private wave: THREE.Mesh;
  private waveAge = 99;
  private soldierSel = new Set<number>();
  /** Położenie żołnierzy na ekranie z ostatniej klatki (do zaznaczania ramką) */
  private soldierPos = new Map<number, THREE.Vector3>();
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
  private plan!: THREE.InstancedMesh;
  /** Wciśnięcie lewego przycisku w trybie malowania (początek drogi albo zatwierdzenie planu) */
  onPaintDown: (tile: TileRef) => void = () => {};
  onPaint: (tile: TileRef) => void = () => {};
  private tmp = new THREE.Object3D();

  onHover: (tile: TileRef | null) => void = () => {};
  onClick: (tile: TileRef, touch: boolean) => void = () => {};
  /** Kliknięto w chłopa o tym numerze */
  onUnit: (id: number) => void = () => {};
  /** Budynek zaczął się zawalać po rozbiórce */
  onCollapse: () => void = () => {};
  private unitSpots: { id: number; x: number; z: number }[] = [];
  private selectedUnit = 0;
  private unitY = new Map<number, number>();

  constructor(private canvas: HTMLCanvasElement, private models: ModelFactory = proceduralModels) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(HAZE);
    this.scene.fog = new THREE.Fog(HAZE, 55, 150);
    // Cienie: jedno słońce, którego obszar cienia podąża za kamerą.
    // filmowe odwzorowanie tonów: jasne partie nie przepalają się, cienie zostają głębokie
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x6a5a3c, 1.5);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe2ad, 3.6);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(4096);
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
    // podgląd planowanej drogi: zielone pola da się wybudować, czerwone nie
    this.plan = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), 512);
    this.plan.count = 0;
    this.plan.frustumCulled = false;
    this.plan.renderOrder = 3;
    this.scene.add(this.plan);

    this.figures = new Figures(MAX_UNITS, this.scene);
    this.spearmen = new Figures(MAX_UNITS, this.scene, 'spearman');
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.2, 0.27, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false }), MAX_UNITS);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 3;
    this.scene.add(this.rings);
    this.bodies = new Figures(MAX_UNITS, this.scene, 'spearman');
    this.stains = new THREE.InstancedMesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a1a12, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }), MAX_UNITS);
    this.stains.count = 0;
    this.stains.frustumCulled = false;
    this.scene.add(this.stains);
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false }), MAX_UNITS);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 3;
    this.scene.add(this.dots);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, depthWrite: false }));
    this.wave.visible = false;
    this.wave.renderOrder = 3;
    this.scene.add(this.wave);
    // Prawdziwe światła punktowe są drogie, więc jest ich stała pula: nocą trafiają do pochodni najbliżej środka ekranu.
    // Płomienie świecą na wszystkich pochodniach, ale otoczenie oświetla tylko ta pula.
    for (let i = 0; i < 12; i++) {
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
    // wiązka desek na ramieniu: kilka cienkich, lekko przesuniętych desek z dwiema przewiązkami
    const boards: THREE.BufferGeometry[] = [];
    [[-0.045, 0, 0.02, 0xd2ab74], [0.045, 0, -0.03, 0xc49a63], [0, 0.03, 0.04, 0xdcb886], [-0.045, 0.06, -0.02, 0xcca26c], [0.045, 0.06, 0.01, 0xd8b07a]].forEach(([x, y, z, c]) => {
      const b = new THREE.BoxGeometry(0.085, 0.024, 0.66); b.translate(x!, y!, z!); boards.push(tint(b, c!));
    });
    for (const z of [-0.2, 0.2]) { const tie = new THREE.BoxGeometry(0.2, 0.1, 0.025); tie.translate(0, 0.03, z); boards.push(tint(tie, 0x8a6a3a)); }
    const plank = mergeGeometries(boards.map((b) => (b.index ? b.toNonIndexed() : b)))!;
    plank.translate(0.14, 0.53, 0);
    const plankMap = pattern('planks')?.clone() ?? null;
    if (plankMap) { plankMap.repeat.set(0.25, 1); plankMap.needsUpdate = true; }
    this.planks = new THREE.InstancedMesh(plank, new THREE.MeshStandardMaterial({ vertexColors: true, map: plankMap, roughness: 0.9 }), MAX_UNITS);
    for (const m of [this.logs, this.planks]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; this.scene.add(m); }

    this.cam = new StrategyCamera(canvas);
    this.composer = new EffectComposer(this.renderer);
    this.ao = new N8AOPass(this.scene, this.cam.camera, canvas.clientWidth || 1, canvas.clientHeight || 1);
    Object.assign(this.ao.configuration, { aoRadius: 1.6, distanceFalloff: 0.6, intensity: 2.2, gammaCorrection: false, color: new THREE.Color(0x1a120a) });
    this.ao.setQualityMode('Medium');
    this.plain = new RenderPass(this.scene, this.cam.camera);
    this.plain.enabled = false;
    this.composer.addPass(this.plain);
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') this.hover(this.pick(e));
      if (this.painting && e.buttons === 1) { const tile = this.pick(e); if (tile) this.onPaint(tile); }
    });
    canvas.addEventListener('pointerleave', () => this.hover(null));
    canvas.addEventListener('pointerdown', (e) => { if (this.painting && e.button === 0) { const tile = this.pick(e); if (tile) this.onPaintDown(tile); } });
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

  /** Gracz przy tym ekranie (znaki „brak pracownika” tylko nad jego budynkami) */
  private me = 0;
  private hpSeen = new Map<number, number>();
  private shake = new Map<number, number>();

  setState(state: GameState, waterLevel: number, rim: number, focusPlayer = 0): void {
    this.me = focusPlayer;
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
    const view = this.view;
    this.cam.ground = (x, z) => view.heightAt(x + width / 2, z + height / 2);
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
    for (const x of this.state.soldiers) this.prevPos.set(x.id, [x.px, x.py]);
    for (const x of this.state.travelers) this.prevPos.set(x.id, [x.px, x.py]);
  }

  /** Ustawia kamerę nad wskazanym punktem mapy (w polach); używane też przy testach wyglądu */
  lookAt(x: number, y: number, dist = 40): void {
    if (!this.state) return;
    this.cam.lookAt(x - this.state.map.width / 2, y - this.state.map.height / 2, dist);
  }

  /** Blokuje przesuwanie kamery myszą na czas malowania */
  /** Pokazuje planowaną drogę (pusta lista chowa podgląd) */
  setRoadPlan(tiles: { x: number; y: number; ok: boolean }[]): void {
    const g = this.state;
    if (!g || !this.view) { this.plan.count = 0; return; }
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const n = Math.min(tiles.length, 512);
    for (let i = 0; i < n; i++) {
      const t = tiles[i]!;
      m.makeTranslation(t.x + 0.5 - width / 2, Math.max(this.view.heightAt(t.x + 0.5, t.y + 0.5), 0) + 0.08, t.y + 0.5 - height / 2);
      this.plan.setMatrixAt(i, m);
      this.plan.setColorAt(i, c.set(t.ok ? 0x6fd05a : 0xe0503a));
    }
    this.plan.count = n;
    this.plan.instanceMatrix.needsUpdate = true;
    if (this.plan.instanceColor) this.plan.instanceColor.needsUpdate = true;
  }

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

  /** Zawsze dzień zamiast cyklu dnia i nocy (ustawienie gracza) */
  private alwaysDay = false;

  /** Ustawienia grafiki i kamery z menu */
  setGraphics(o: { ao: string; shadows: number; scale: number; dayNight: boolean; camSpeed: number; edgeScroll: boolean }): void {
    if (TEST) o = { ...o, ao: 'off', shadows: 0, scale: 0.5, edgeScroll: false };
    this.ao.enabled = o.ao !== 'off';
    this.plain.enabled = o.ao === 'off';
    if (o.ao !== 'off') this.ao.setQualityMode(o.ao === 'high' ? 'High' : o.ao === 'low' ? 'Low' : 'Medium');
    this.sun.castShadow = o.shadows > 0;
    if (o.shadows > 0 && this.sun.shadow.mapSize.x !== o.shadows) {
      this.sun.shadow.mapSize.setScalar(o.shadows);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as { map: unknown }).map = null;
    }
    const ratio = Math.min(window.devicePixelRatio, o.scale);
    if (this.renderer.getPixelRatio() !== ratio) {
      this.renderer.setPixelRatio(ratio);
      this.composer.setPixelRatio(ratio);
      this.resize();
    }
    this.alwaysDay = !o.dayNight;
    this.cam.speed = o.camSpeed;
    this.cam.edgeScroll = o.edgeScroll;
  }

  /** Kompiluje z góry wszystkie shadery sceny, żeby gra nie przycinała przy pierwszym widoku */
  warmup(): void { this.renderer.compile(this.scene, this.cam.camera); this.composer.render(); }

  /** Powolny obrót kamery wokół osady, gdy otwarte jest menu */
  orbit(dt: number): void { this.cam.cinematic(true); this.cam.spin(dt * 0.035); }
  /** Koniec ujęcia z menu: wraca zwykły widok strategiczny */
  endOrbit(): void { this.cam.cinematic(false); }

  frame(dt: number, alpha: number): void {
    this.cam.update(dt);
    this.time += dt;
    if (this.state) this.setDaylight(this.alwaysDay ? 11 : clockAt(this.state.tick).hour);
    this.aimSun();
    if (this.state && this.view) {
      this.animate(this.state, this.calm ? 0 : dt);
      this.syncForest(this.state, this.view);
      this.syncRoads(this.state, this.view);
      this.syncRubble(this.state, this.view, dt);
      this.syncLamps(this.state);
      if (!this.calm) this.view.animate(this.time); this.syncBuildings(this.state, this.view); this.syncStores(this.state); this.syncUnits(this.state, this.view, alpha); this.syncSoldiers(this.state, this.view, alpha); }
    this.composer.render();
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
      this.onCollapse();
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
    // budynek bez pracownika: nad dachem kołysze się mały znak przekreślonego człowieka
    for (const b of g.buildings) {
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      // trafiony budynek drży, a mocno uszkodzony płonie
      const prevHp = this.hpSeen.get(b.id) ?? b.hp;
      if (b.hp < prevHp) this.shake.set(b.id, 0.25);
      this.hpSeen.set(b.id, b.hp);
      const sk = this.shake.get(b.id) ?? 0;
      // drganie: lekkie kołysanie całej bryły, które wygasa po ćwierć sekundy
      if (sk > 0) { this.shake.set(b.id, sk - dt); mesh.rotation.z = Math.sin(this.time * 60) * 0.012 * (sk / 0.25); }
      else if (mesh.rotation.z !== 0) { mesh.rotation.z = 0; this.shake.delete(b.id); }
      const hurt = 1 - b.hp / maxHp(b.type);
      let fire = mesh.getObjectByName('fire') as THREE.Group | undefined;
      if (hurt > 0.4 && !fire) {
        fire = new THREE.Group();
        fire.name = 'fire';
        for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), k % 2 ? FIRE_A : FIRE_B); f.position.set(Math.sin(k * 2.4) * 0.5, 1.0 + (k % 3) * 0.2, Math.cos(k * 2.4) * 0.5); fire.add(f); }
        mesh.add(fire);
      }
      if (fire) {
        fire.visible = hurt > 0.4;
        fire.children.forEach((f, k) => { f.scale.set(1, 0.7 + Math.abs(Math.sin(this.time * 9 + k)) * 0.6 * (0.5 + hurt), 1); });
      }
      const def = BUILDINGS[b.type]!;
      const needs = b.owner === this.me && (def.production || def.staff) && b.worker === 0;
      let sign = mesh.getObjectByName('noworker') as THREE.Sprite | undefined;
      if (!needs) { if (sign) sign.visible = false; continue; }
      if (!sign) {
        sign = new THREE.Sprite(noWorkerMaterial());
        sign.name = 'noworker';
        sign.scale.setScalar(0.55);
        sign.renderOrder = 4;
        mesh.add(sign);
      }
      sign.visible = true;
      sign.position.set(0, 2.3 + Math.sin(this.time * 2 + b.id) * 0.06, 0);
      (sign.material as THREE.SpriteMaterial).rotation = Math.sin(this.time * 1.6 + b.id) * 0.18;
    }
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

  private hl = 0;
  private hlMats = new Map<THREE.Material, THREE.Material>();
  /** Wrogi budynek pod kursorem przy zaznaczonym wojsku: delikatnie czerwienieje (0 = bez podświetlenia) */
  setAttackHighlight(id: number): void {
    if (id === this.hl) return;
    const swap = (bid: number, on: boolean): void => {
      this.buildingMeshes.get(bid)?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material) || o.name === 'patch') return;
        if (on) {
          let red = this.hlMats.get(m.material);
          if (!red) {
            red = m.material.clone();
            const st = red as THREE.MeshStandardMaterial;
            if (st.emissive) { st.emissive = new THREE.Color(0xff2a1a); st.emissiveIntensity = 0.35; }
            this.hlMats.set(m.material, red);
            red.userData.orig = m.material;
          }
          m.material = red;
        } else if (m.material.userData.orig) m.material = m.material.userData.orig as THREE.Material;
      });
    };
    if (this.hl) swap(this.hl, false);
    this.hl = id;
    if (id) swap(id, true);
  }

  /** Rozkaz marszu: rozchodząca się złota fala w klikniętym miejscu */
  orderMarker(tile: { x: number; y: number }): void {
    if (!this.state || !this.view) return;
    const { width, height } = this.state.map;
    this.wave.position.set(tile.x + 0.5 - width / 2, this.view.heightAt(tile.x + 0.5, tile.y + 0.5) + 0.04, tile.y + 0.5 - height / 2);
    this.waveAge = 0;
  }

  /** Zaznaczeni żołnierze dostają złoty pierścień pod stopami */
  setSoldierSelection(ids: Set<number>): void { this.soldierSel = ids; }

  /** Ruch myszy zajęty przez ramkę zaznaczenia: kliknięcie na końcu nie liczy się jako kliknięcie w mapę */
  markDragged(): void { this.cam.dragged = true; }
  /** Wysokość punktu nad żołnierzem, dla którego liczymy położenie na ekranie */
  barLift = 0.45;
  /** Czy ostatni ruch myszy obracał albo przesuwał kamerę */
  get dragged(): boolean { return this.cam.dragged; }

  /** Żołnierze gracza z położeniem na ekranie (piksele w oknie) */
  soldiersOnScreen(player: number): { id: number; x: number; y: number; owner: number; hp: number }[] {
    if (!this.state) return [];
    const out: { id: number; x: number; y: number; owner: number; hp: number }[] = [];
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const s of this.state.soldiers) {
      if (player >= 0 && s.owner !== player) continue;
      const p = this.soldierPos.get(s.id);
      if (!p) continue;
      v.copy(p).setY(p.y + this.barLift).project(this.cam.camera);
      if (v.z > 1) continue;
      out.push({ id: s.id, owner: s.owner, hp: s.hp, x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height });
    }
    return out;
  }

  private syncSoldiers(g: GameState, view: TerrainView, alpha: number): void {
    const { width, height } = g.map;
    const t = this.tmp;
    let n = 0, rings = 0, dots = 0;
    const m = new THREE.Matrix4();
    const byId = new Map<number, (typeof g.soldiers)[number]>();
    for (const x of g.soldiers) byId.set(x.id, x);
    const bById = new Map<number, (typeof g.buildings)[number]>();
    for (const b of g.buildings) bById.set(b.id, b);
    for (const s of g.soldiers) {
      if (n >= MAX_UNITS) break;
      const prev = this.prevPos.get(s.id);
      const fx = (prev ? prev[0] + (s.px - prev[0]) * alpha : s.px) / FP;
      const fy = (prev ? prev[1] + (s.py - prev[1]) * alpha : s.py) / FP;
      const next = s.path[0];
      let heading = this.facing.get(s.id) ?? Math.PI;
      if (next !== undefined) {
        const want = Math.atan2((next % width) + 0.5 - fx, Math.floor(next / width) + 0.5 - fy);
        let diff = want - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        heading += diff * 0.25;
        this.facing.set(s.id, heading);
      }
      let st = this.strides.get(s.id);
      if (!st) { st = { x: fx, y: fy, phase: s.id }; this.strides.set(s.id, st); }
      st.phase += Math.min(0.5, Math.hypot(fx - st.x, fy - st.y)) * 7.5;
      st.x = fx; st.y = fy;
      const walking = s.path.length > 0 && !this.calm;
      // w walce zwraca się do wroga i wyprowadza pchnięcie zaraz po ciosie
      const foe = s.target ? byId.get(s.target) : undefined;
      if (foe && !walking) { heading = Math.atan2((foe.px - s.px) / FP, (foe.py - s.py) / FP); this.facing.set(s.id, heading); }
      // oblężenie: zwraca się do budynku i bije w niego włócznią
      const wall = !foe && s.target ? bById.get(s.target) : undefined;
      if (wall && !walking) {
        const fp = footprint(BUILDINGS[wall.type]!, wall.rot);
        heading = Math.atan2(wall.x + fp.w / 2 - fx, wall.y + fp.h / 2 - fy);
        this.facing.set(s.id, heading);
      }
      const swing = walking ? Math.sin(st.phase) * 0.5 : 0;
      const striking = (!!foe || !!wall) && !walking && s.cd > 6;
      const y = view.heightAt(fx, fy);
      t.position.set(fx - width / 2, y + (walking ? Math.abs(Math.cos(st.phase)) * 0.02 : 0), fy - height / 2);
      t.rotation.set(0, heading, 0);
      t.scale.setScalar(1.08);
      t.updateMatrix();
      t.scale.setScalar(1);
      this.spearmen.set(n, t.matrix, swing, striking, TEAM_COLORS[g.players[s.owner]?.team ?? 0] ?? 0x888888, s.id);
      let pos = this.soldierPos.get(s.id);
      if (!pos) { pos = new THREE.Vector3(); this.soldierPos.set(s.id, pos); }
      pos.set(fx - width / 2, y, fy - height / 2);
      if (this.soldierSel.has(s.id)) {
        m.makeTranslation(pos.x, y + 0.03, pos.z); this.rings.setMatrixAt(rings++, m);
        // kropka na polu docelowym, póki żołnierz idzie
        const dest = s.path.length ? s.path[s.path.length - 1]! : s.goal;
        if (dest >= 0) {
          const dx = dest % width, dy = (dest - dx) / width;
          const pulse = 0.75 + Math.sin(this.time * 6 + s.id) * 0.25;
          m.makeScale(pulse, 1, pulse).setPosition(dx + 0.5 - width / 2, view.heightAt(dx + 0.5, dy + 0.5) + 0.035, dy + 0.5 - height / 2);
          this.dots.setMatrixAt(dots++, m);
        }
      }
      n++;
    }
    this.dots.count = dots;
    this.dots.instanceMatrix.needsUpdate = true;
    (this.dots.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(this.time * 6) * 0.35;
    // fala rozkazu: rośnie i blednie przez pół sekundy
    this.waveAge += 1 / 60;
    this.wave.visible = this.waveAge < 0.6;
    if (this.wave.visible) { const k = this.waveAge / 0.6; this.wave.scale.setScalar(0.6 + k * 1.6); (this.wave.material as THREE.MeshBasicMaterial).opacity = 1 - k; }
    this.spearmen.finish(n);
    // ciała: leżą na ziemi, z czasem ciemnieją i zapadają się (rozkład trwa ok. 10 minut gry)
    let c = 0;
    const lay = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (const body of g.corpses) {
      if (c >= MAX_UNITS) break;
      const fx = body.px / FP, fy = body.py / FP;
      const age = Math.min(1, (g.tick - body.at) / 6000);
      const y = view.heightAt(fx, fy);
      lay.setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.08, ((body.id * 2.39) % 6.28), 0, 'YXZ'));
      sc.set(1.05, 1.05, 1.05 * (1 - age * 0.55));
      m.compose(new THREE.Vector3(fx - width / 2, y + 0.06 - age * 0.04, fy - height / 2), lay, sc);
      const team = TEAM_COLORS[g.players[body.owner]?.team ?? 0] ?? 0x888888;
      const rot = new THREE.Color(team).lerp(new THREE.Color(0x3b3226), 0.3 + age * 0.6).getHex();
      this.bodies.set(c, m, 0.3, false, rot, body.id);
      m.compose(new THREE.Vector3(fx - width / 2, y + 0.02, fy - height / 2), new THREE.Quaternion(), sc.set(1 + age * 0.4, 1, 1 + age * 0.4));
      this.stains.setMatrixAt(c, m);
      c++;
    }
    this.bodies.finish(c);
    this.stains.count = c;
    this.stains.instanceMatrix.needsUpdate = true;
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
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
      // kłodę ciągnie tylko drwal z lasu; włóczniarz niesie ze składu zwykłe deski
      const jb = u.job ? jobs.get(u.job) : undefined;
      const log = wood && u.phase === Phase.ToHome && !!jb && BUILDINGS[jb.type]!.production?.site === Terrain.Forest;
      // nocą idący niosą pochodnię (ci z ładunkiem mają zajęte ręce)
      const torchOn = this.night > 0.15 && !still && u.carryRes < 0;
      if (torchOn) this.handTorches.setMatrixAt(i, t.matrix); else this.handTorches.setMatrixAt(i, ZERO);
      this.figures.set(i, t.matrix, swing, u.carryRes >= 0 && !log, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888, u.id);
      // z lasu do chaty niesie kłodę, z chaty do składu gotowe deski
      t.scale.setScalar(log ? 1 : 0);
      t.updateMatrix();
      this.logs.setMatrixAt(i, t.matrix);
      t.scale.setScalar(wood && !log ? 1 : 0);
      t.updateMatrix();
      this.planks.setMatrixAt(i, t.matrix);
      // każdy surowiec ma własny wygląd: kosz jabłek, bochenki, snop, worek, blok, sztaby
      for (const [res, mesh] of this.loads) {
        t.scale.setScalar(u.carryRes === res ? 1 : 0);
        t.updateMatrix();
        mesh.setMatrixAt(i, t.matrix);
      }
    }
    // wędrowcy: przychodzący z lasu i odchodzący za mapę (ci drudzy ze smutną minką nad głową)
    let k = n, sad = 0;
    for (const tr of g.travelers) {
      if (k >= MAX_UNITS) break;
      const prev = this.prevPos.get(tr.id);
      const fx = (prev ? prev[0] + (tr.px - prev[0]) * alpha : tr.px) / FP;
      const fy = (prev ? prev[1] + (tr.py - prev[1]) * alpha : tr.py) / FP;
      let st = this.strides.get(tr.id);
      if (!st) { st = { x: fx, y: fy, phase: tr.id }; this.strides.set(tr.id, st); }
      st.phase += Math.min(0.5, Math.hypot(fx - st.x, fy - st.y)) * 7.5;
      st.x = fx; st.y = fy;
      const heading = Math.atan2(tr.tx / FP - fx, tr.ty / FP - fy);
      const y = view.heightAt(fx, fy);
      t.position.set(fx - width / 2, y + (this.calm ? 0 : Math.abs(Math.cos(st.phase)) * 0.025), fy - height / 2);
      t.rotation.set(tr.leaving ? 0.12 : 0, heading, 0, 'YXZ'); // odchodzący idzie ze spuszczoną głową
      t.scale.setScalar(1);
      t.updateMatrix();
      this.figures.set(k, t.matrix, this.calm ? 0 : Math.sin(st.phase) * 0.55, false, TEAM_COLORS[g.players[tr.owner]?.team ?? 0] ?? 0x888888, tr.id);
      if (tr.leaving) {
        let face = this.sadFaces[sad];
        if (!face) { face = new THREE.Sprite(sadMaterial()); face.scale.setScalar(0.42); face.renderOrder = 5; this.scene.add(face); this.sadFaces.push(face); }
        face.visible = true;
        face.position.set(t.position.x, y + 0.95, t.position.z);
        sad++;
      }
      k++;
    }
    for (let i = sad; i < this.sadFaces.length; i++) this.sadFaces[i]!.visible = false;
    this.figures.finish(k);
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
    this.composer?.setSize(w, h);
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

import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import { UNITS } from '../data/units';
import { RULES } from '../data/rules';
import { playAt, pluck, type WorldSound } from '../audio/sfx';
import { buildWork } from '../sim/systems/placement';
import { TEST } from '../testmode';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint, workArea } from '../data/buildings';
import { Clutter } from './clutter';
import { Clouds } from './clouds';
import { Flames, flameSprite } from './flames';
import { crowGeometry, WOLF_HIPS, wolfParts } from './creatures';
import { Ambience, collectFx, type BuildingFx, type FxSource } from './ambience';
import { animateBuilding, isWindowMat, palisadeLogs, roadMaterials, rubbleModel, setNight, setRubble, setStockFill, torchModel } from './buildings';
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
import { normal, pattern } from './textures';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { N8AOPass } from 'n8ao';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export interface TileRef { x: number; y: number }
const FIRE_A = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
const FIRE_B = new THREE.MeshBasicMaterial({ color: 0xffd25a });

/**
 * Łączy nieruchome części budynku o tym samym materiale w jedną siatkę: zamiast kilkudziesięciu
 * wywołań rysowania na budynek jest kilka. Części nazwane (dach, wnętrze, skrzydła młyna, pochodnia…)
 * zostają osobno, bo animacje i podgląd wnętrza ich szukają.
 */
/** Budynki, w których pali się w piecu: z komina idzie dym */
const SMOKY = new Set(['house', 'bakery', 'tavern', 'keep', 'barracks', 'engineers', 'fletcher', 'poleturner', 'woodcutter']);

function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.name || !m.visible) return;
    // wszystko pod nazwaną grupą zostaje nietknięte (animacje, wnętrza, zapasy w składzie, ludzie w twierdzy)
    for (let p: THREE.Object3D | null = m.parent; p && p !== root; p = p.parent) if (p.name || !p.visible) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    let e = groups.get(m.material); if (!e) { e = { geos: [], meshes: [] }; groups.set(m.material, e); }
    e.geos.push(g); e.meshes.push(m);
  });
  for (const [mat, e] of groups) {
    if (e.meshes.length < 2) continue;
    // wspólne atrybuty muszą się zgadzać; inaczej zostawiamy jak jest
    const keys = Object.keys(e.geos[0]!.attributes).sort().join();
    if (e.geos.some((g) => Object.keys(g.attributes).sort().join() !== keys)) continue;
    for (const g of e.geos) g.morphAttributes = {};
    const merged = mergeGeometries(e.geos);
    if (!merged) continue;
    const one = new THREE.Mesh(merged, mat);
    one.castShadow = e.meshes.some((m) => m.castShadow);
    one.receiveShadow = true;
    root.add(one);
    for (const m of e.meshes) m.parent?.remove(m);
  }
}

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
/** Skala ludzi względem budynków i drzew: drzwi chaty mają być wyższe od człowieka */
const FIG = 0.76;
const tmpColor = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
/** Klatki kluczowe doby: godzina, barwa i siła słońca (albo księżyca), siła światła nieba, barwa mgły i tła */
const DAY = [
  // mroczniejszy, bardziej szary świat: ciemne noce, mglisty świt, zgaszone południe
  { h: 0, sun: 0x8095c8, power: 0.36, sky: 0.32, haze: 0x0b0f1c },
  { h: 4.5, sun: 0x8095c8, power: 0.36, sky: 0.32, haze: 0x10162a },
  { h: 6, sun: 0xe0a070, power: 0.9, sky: 0.7, haze: 0x9a8f86 },
  { h: 8, sun: 0xf2dcb8, power: 1.55, sky: 1.05, haze: 0xa9aa9f },
  { h: 12, sun: 0xfaeedc, power: 1.8, sky: 1.15, haze: 0xb4b7ae },
  { h: 17, sun: 0xf2dcb8, power: 1.6, sky: 1.05, haze: 0xaaa79a },
  { h: 19.5, sun: 0xe88a58, power: 0.95, sky: 0.7, haze: 0x8a6650 },
  { h: 21.5, sun: 0x8095c8, power: 0.36, sky: 0.32, haze: 0x10162a },
  { h: 24, sun: 0x8095c8, power: 0.28, sky: 0.24, haze: 0x0b0f1c },
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
  private grade!: ShaderPass;
  private rain = 0;
  private hammers!: THREE.InstancedMesh;
  private soldierTorches!: THREE.InstancedMesh;
  private peasantBodies!: Figures;
  private archers!: Figures;
  private arrowMesh!: THREE.InstancedMesh;
  private arrows: { from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  private lastCd = new Map<number, number>();
  private evening = false;
  private taverns = new Map<number, GameState['buildings'][number]>();
  private luteAt = 0;
  private luteNote = 0;
  /** Lutnia przed karczmą: prosta melodia nuta po nucie, słyszalna z bliska */
  private lutePlay(x: number, z: number): void {
    if (this.time < this.luteAt) return;
    const tune = [0, 3, 5, 7, 5, 3, 0, -2, 0, 3, 7, 10, 7, 5, 3, 0];
    const len = [0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.9];
    const i = this.luteNote++ % tune.length;
    this.luteAt = this.time + len[i]!;
    const d = this.cam.camera.position.distanceTo(new THREE.Vector3(x, 0.5, z));
    pluck(tune[i]!, Math.max(0, Math.min(1, 1 - (d - 8) / 30)));
  }
  private pullNow = new Map<number, [number, number]>();
  private armM = new THREE.Matrix4();
  private soundAt = new Map<string, number>();
  /** Dźwięk z miejsca na mapie, nie częściej niż co `every` sekund dla danego źródła; głośność z odległości od środka ekranu */
  private sfxAt(kind: WorldSound, x: number, z: number, key: string | number, every: number, gain = 1): void {
    const k = `${kind}${key}`;
    const due = this.soundAt.get(k) ?? 0;
    if (this.time < due) return;
    this.soundAt.set(k, this.time + every * (0.85 + Math.random() * 0.3));
    if (due === 0) return; // pierwszy raz tylko ustawiamy zegar, żeby wszystkie źródła nie ruszyły naraz
    // słychać jak w rzeczywistości: z odległości od kamery (ucha), nie od środka ekranu;
    // blisko — głośno, przy zwykłym widoku cicho, a z daleka od osady wcale
    const cam = this.cam.camera;
    const src = new THREE.Vector3(x, this.view?.heightAt(x + (this.state?.map.width ?? 0) / 2, z + (this.state?.map.height ?? 0) / 2) ?? 0, z);
    const d = cam.position.distanceTo(src);
    const near = Math.max(0, Math.min(1, 1 - (d - 8) / 30)); // ok. 38 jednostek = cisza
    const rel = src.sub(cam.position);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const pan = (rel.dot(right) / Math.max(1, d)) * 1.4;
    playAt(kind, near, pan, gain);
  }
  /** Pora i pogoda dla dźwięków otoczenia */
  private flash = 0;
  /** Błyskawica: na ułamek sekundy rozjaśnia całą scenę */
  lightning(): void { this.flash = 1; }
  get weather(): { night: number; rain: number } { return { night: this.night, rain: this.rain }; }
  private rainLines: THREE.LineSegments | null = null;
  private sadFaces: THREE.Sprite[] = [];
  private lamps: THREE.PointLight[] = [];
  private lampSpots: { v: THREE.Vector3; k: number }[] = [];
  /** Czubki pochodni niesionych przez ludzi i żołnierzy w tej klatce (płomienie rysuje system ognia) */
  private handFlames: THREE.Vector3[] = [];
  private handFlameN = 0;
  private pushHandFlame(m: THREE.Matrix4, x: number): void {
    if (this.handFlameN >= 400) return;
    const v = this.handFlames[this.handFlameN] ?? (this.handFlames[this.handFlameN] = new THREE.Vector3());
    const f = this.focusPoint;
    v.set(x, 0.69, 0.1).applyMatrix4(m);
    if ((v.x - f.x) ** 2 + (v.z - f.z) ** 2 > 80 * 80) return;
    this.handFlameN++;
  }
  private handTorches: THREE.InstancedMesh;
  private rods: THREE.InstancedMesh;
  private frameNo = 0;

  private cursor: THREE.Mesh;
  private ghost: THREE.Mesh;
  private selection: THREE.Mesh;
  private ghostModels = new Map<string, THREE.Group>();
  private ghostModel: THREE.Group | null = null;
  private buildingLayer = new THREE.Group();
  /** Dym z kominów, iskry, blask okien, mgła przy ziemi */
  private ambience = new Ambience();
  /** Beczki, worki, siano i śmieci przy domach */
  private clutter = new Clutter();
  /** Chmury jako obiekty nad mapą: płyną, rodzą się i rozpływają, rzucają cień */
  private clouds = new Clouds();
  /** Żywe płomienie pochodni, ognisk i pożarów */
  private flames = new Flames();
  private fxAt = 0;
  private mistLevel = 0;
  private buildingMeshes = new Map<number, THREE.Group>();

  private figures: Figures;
  /** Żołnierze: osobny zestaw postaci w zbrojach */
  private spearmen: Figures;
  private rings: THREE.InstancedMesh;
  private ringsBack!: THREE.InstancedMesh;
  /** Podgląd szyku przy przeciąganiu prawym przyciskiem: przyszłe miejsca żołnierzy */
  private ghostRings!: THREE.InstancedMesh;
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
    this.renderer.localClippingEnabled = true; // budynki w budowie: model przycięty na wysokości postępu
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(HAZE);
    this.scene.fog = new THREE.Fog(HAZE, 55, 150);
    // Cienie: jedno słońce, którego obszar cienia podąża za kamerą.
    // filmowe odwzorowanie tonów: jasne partie nie przepalają się, cienie zostają głębokie
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.84; // odrobinę mroczniej: klimat Gothica, nie słoneczna pocztówka
    this.renderer.info.autoReset = false;
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
    this.scene.add(this.ambience.group);
    this.scene.add(this.clutter.group);
    this.scene.add(this.clouds.group);
    this.scene.add(this.flames.group);

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
    this.archers = new Figures(MAX_UNITS, this.scene, 'archer');
    this.arrowMesh = new THREE.InstancedMesh(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4).rotateX(Math.PI / 2), 0x8a6a42),
      tint(new THREE.ConeGeometry(0.02, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0, 0.27), 0x6a6e76),
      tint(new THREE.BoxGeometry(0.04, 0.002, 0.08).translate(0, 0, -0.22), 0xe8e0c8),
    ])!, new THREE.MeshStandardMaterial({ vertexColors: true }), 256);
    this.arrowMesh.count = 0; this.arrowMesh.frustumCulled = false; this.scene.add(this.arrowMesh);
    // znaczniki zaznaczenia rysują się nad wszystkim (trawa, krzaki), z ciemną obwódką, żeby było je widać na każdym tle
    const mark = (inner: number, outer: number, color: number, opacity: number, order: number): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, toneMapped: false, fog: false }), MAX_UNITS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
      return mesh;
    };
    this.ringsBack = mark(0.25, 0.4, 0x120c05, 0.6, 20);
    this.rings = mark(0.28, 0.36, 0xffd34d, 1, 21);
    this.bodies = new Figures(MAX_UNITS, this.scene, 'spearman');
    this.peasantBodies = new Figures(MAX_UNITS, this.scene);
    this.stains = new THREE.InstancedMesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a1a12, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }), MAX_UNITS);
    this.stains.count = 0;
    this.stains.frustumCulled = false;
    this.scene.add(this.stains);
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, toneMapped: false, fog: false }), MAX_UNITS);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 21;
    this.scene.add(this.dots);
    this.ghostRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.22, 0.32, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, toneMapped: false, fog: false }), MAX_UNITS);
    this.ghostRings.count = 0;
    this.ghostRings.frustumCulled = false;
    this.ghostRings.renderOrder = 21;
    this.scene.add(this.ghostRings);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false }));
    this.wave.visible = false;
    this.wave.renderOrder = 21;
    this.scene.add(this.wave);
    // Prawdziwe światła punktowe są drogie, więc jest ich stała pula: nocą trafiają do pochodni najbliżej środka ekranu.
    // Płomienie świecą na wszystkich pochodniach, ale otoczenie oświetla tylko ta pula.
    for (let i = 0; i < 18; i++) {
      const lamp = new THREE.PointLight(0xffa35a, 0, 11, 1.4);
      this.scene.add(lamp);
      this.lamps.push(lamp);
    }
    const hand = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 5).translate(0.17, 0.5, 0.1), 0x4a3320),
      tint(new THREE.CylinderGeometry(0.03, 0.022, 0.07, 6).translate(0.17, 0.67, 0.1), 0x2a1c12),
    ]);
    this.handTorches = new THREE.InstancedMesh(hand, new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_UNITS);
    // co piąty żołnierz nocą niesie pochodnię w lewej ręce (prawa trzyma włócznię)
    this.soldierTorches = new THREE.InstancedMesh(hand.clone().translate(-0.34, 0, 0), new THREE.MeshBasicMaterial({ vertexColors: true }), 256);
    this.soldierTorches.count = 0; this.soldierTorches.frustumCulled = false;
    this.scene.add(this.soldierTorches);
    // wędka rybaka: kij, żyłka i spławik
    const rod = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.012, 0.02, 1.1, 5).rotateX(1.05).translate(0.12, 0.72, 0.6), 0x6b4a2e),
      tint(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 3).translate(0.12, 0.62, 1.07), 0xe8e4d8),
      tint(new THREE.IcosahedronGeometry(0.035, 0).translate(0.12, 0.24, 1.07), 0xd0281f),
    ]);
    // młotek w prawej dłoni: trzonek w przód z dłoni, obuch na końcu (układ ramienia: oś w barku)
    const hammer = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.014, 0.016, 0.26, 6).rotateX(Math.PI / 2).translate(0, -0.19, 0.11), 0x7a5232),
      tint(new THREE.BoxGeometry(0.11, 0.05, 0.05).translate(0, -0.19, 0.24), 0x55585e),
    ]);
    this.hammers = new THREE.InstancedMesh(hammer, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), MAX_UNITS);
    this.hammers.count = 0;
    this.hammers.frustumCulled = false;
    this.hammers.castShadow = true;
    this.scene.add(this.hammers);
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
    // gradacja koloru w klimacie surowego średniowiecza: mniej nasycenia, ciepłe brudne cienie, chłodna noc, winieta
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, night: { value: 0 }, rain: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float night; uniform float rain; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.72 - rain * 0.15);                       // przygaszone barwy
          c = mix(c * vec3(1.06, 0.98, 0.86), c, smoothstep(0.0, 0.6, l)); // brązowe cienie
          c = (c - 0.5) * 1.08 + 0.5;                                   // trochę kontrastu
          c = mix(c, c * vec3(0.72, 0.8, 1.05), night * 0.35);          // chłodna, ciemna noc
          c *= 1.0 - rain * 0.12;
          vec2 d = vUv - 0.5;
          c *= 1.0 - dot(d, d) * (0.85 + night * 0.6);                  // winieta
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
    });
    this.composer.addPass(this.grade);
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') this.hover(this.pick(e));
      if (this.painting && e.buttons === 1) { const tile = this.pick(e); if (tile) this.onPaint(tile); }
    });
    canvas.addEventListener('pointerleave', () => this.hover(null));
    canvas.addEventListener('pointerdown', (e) => { if (this.painting && e.button === 0) { const tile = this.pick(e); if (tile) this.onPaintDown(tile); } });
    canvas.addEventListener('pointerup', (e) => {
      if (this.walk) return; // podczas spaceru klik tylko łapie kursor
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
    this.builtAt = 0; this.quickBuild.clear(); // budynki z wczytanej / nowej mapy stoją od razu, bez pokazu budowy
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
    this.clutter.reset();
    for (const p of this.ruinPiles.values()) this.buildingLayer.remove(p);
    this.ruinPiles.clear();
    this.clouds.reset();
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
    for (const x of this.state.wolves) this.prevPos.set(x.id, [x.px, x.py]);
  }

  /** Ustawia kamerę nad wskazanym punktem mapy (w polach); używane też przy testach wyglądu */
  /** Pole mapy na ekranie: piksele w oknie i czy jest przed kamerą */
  project(x: number, y: number): { sx: number; sy: number; front: boolean } {
    const g = this.state;
    const v = new THREE.Vector3(x - (g?.map.width ?? 0) / 2, (this.view?.heightAt(x, y) ?? 0) + 1, y - (g?.map.height ?? 0) / 2);
    v.project(this.cam.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { sx: r.left + ((v.x + 1) / 2) * r.width, sy: r.top + ((1 - v.y) / 2) * r.height, front: v.z < 1 };
  }

  /** Liczniki karty graficznej z ostatniej klatki (do okna wydajności) */
  /** Do diagnozy wydajności: które siatki mają najwięcej trójkątów (z instancjami) */
  heavy(top = 15): { name: string; tris: number; count: number; culled: boolean }[] {
    const out: { name: string; tris: number; count: number; culled: boolean }[] = [];
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const geo = m.geometry;
      const per = (geo.index ? geo.index.count : geo.getAttribute('position')?.count ?? 0) / 3;
      const count = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      out.push({ name: `${m.parent?.name || ''}/${m.name || m.type}`, tris: Math.round(per * count), count, culled: m.frustumCulled });
    });
    return out.sort((a, b) => b.tris - a.tris).slice(0, top);
  }

  get stats(): { calls: number; triangles: number; geometries: number; textures: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

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

  /** Tereny pracy pokazane na mapie: zielony, półprzezroczysty kwadrat z obwódką, ułożony na ziemi */
  private areaIds = new Set<number>();
  private areaKey = '';
  private areaGroup = new THREE.Group();
  private areaFill = new THREE.MeshBasicMaterial({ color: 0x4fd06a, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  private areaLine = new THREE.LineBasicMaterial({ color: 0x7dff8f, transparent: true, opacity: 0.9, fog: false });
  setAreas(ids: Set<number>): void { this.areaIds = new Set(ids); this.areaKey = '#'; }
  private syncAreas(g: GameState, v: TerrainView): void {
    const list = g.buildings.filter((b) => this.areaIds.has(b.id) && !b.ruined);
    const key = list.map((b) => `${b.id}:${b.x}:${b.y}:${b.rot}`).join('|');
    if (key === this.areaKey) return;
    this.areaKey = key;
    for (const c of this.areaGroup.children) (c as THREE.Mesh).geometry.dispose();
    this.areaGroup.clear();
    if (!this.areaGroup.parent) { this.areaGroup.renderOrder = 4; this.scene.add(this.areaGroup); }
    const { width, height } = g.map;
    for (const b of list) {
      const a = workArea(b);
      if (!a) continue;
      const x0 = Math.max(0, a.x0), y0 = Math.max(0, a.y0), x1 = Math.min(width, a.x1 + 1), y1 = Math.min(height, a.y1 + 1);
      const nx = x1 - x0, ny = y1 - y0;
      const lift = (x: number, y: number): number => Math.max(0, v.heightAt(Math.min(width - 0.01, x), Math.min(height - 0.01, y))) + 0.09;
      // wypełnienie: siatka co pole, wierzchołki na wysokości terenu
      const geo = new THREE.PlaneGeometry(nx, ny, nx, ny).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const wx = pos.getX(i) + x0 + nx / 2, wy = pos.getZ(i) + y0 + ny / 2;
        pos.setXYZ(i, wx - width / 2, lift(wx, wy), wy - height / 2);
      }
      geo.computeBoundingSphere();
      const fill = new THREE.Mesh(geo, this.areaFill);
      fill.renderOrder = 4;
      // obwódka idzie po krawędzi pole po polu
      const pts: THREE.Vector3[] = [];
      const at = (x: number, y: number): void => { pts.push(new THREE.Vector3(x - width / 2, lift(x, y) + 0.03, y - height / 2)); };
      for (let x = x0; x < x1; x++) at(x, y0);
      for (let y = y0; y < y1; y++) at(x1, y);
      for (let x = x1; x > x0; x--) at(x, y1);
      for (let y = y1; y > y0; y--) at(x0, y);
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), this.areaLine);
      line.renderOrder = 4;
      this.areaGroup.add(fill, line);
    }
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
    this.quality = `AO ${o.ao}, cienie ${o.shadows || 'wył.'}, skala ${o.scale}`;
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
  orbit(dt: number): void {
    // podgląd nowej mapy: kamera wzlatuje nad całą mapę, w dzień, i powoli ją obraca
    if (this.previewing && this.state) {
      const span = Math.max(this.state.map.width, this.state.map.height);
      this.cam.fly(dt, 1.02, span * 0.95, 0, 0, 0.05);
      this.menuNight = false;
      return;
    }
    this.cam.cinematic(true); this.cam.spin(dt * 0.035); this.menuNight = true;
  }
  /** Podgląd generowanej mapy w menu (ujęcie z góry) */
  private previewing = false;
  startPreview(): void { this.previewing = true; }
  get isPreviewing(): boolean { return this.previewing; }
  endPreview(): void { this.previewing = false; }
  /** Koniec ujęcia z menu: wraca zwykły widok strategiczny */
  endOrbit(): void { this.cam.cinematic(false); this.menuNight = false; }
  /** Menu główne zawsze nocą, z zapalonymi pochodniami */
  private menuNight = false;

  private puffs: { group: THREE.Group; age: number; bits: { m: THREE.Mesh; v: THREE.Vector3 }[] }[] = [];
  private static puffGeo = new THREE.IcosahedronGeometry(0.16, 1);
  private static chipGeo = new THREE.DodecahedronGeometry(0.05, 0);
  /** Rozbita droga: kłąb kurzu i odpryski kamieni lub grudki ziemi rozlatują się i opadają */
  roadDust(x: number, y: number, stone: boolean): void {
    const g = this.state;
    if (!g || !this.view) return;
    const { width, height } = g.map;
    const group = new THREE.Group();
    group.position.set(x + 0.5 - width / 2, Math.max(this.view.heightAt(x + 0.5, y + 0.5), 0) + 0.05, y + 0.5 - height / 2);
    const bits: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(GameRenderer.puffGeo, new THREE.MeshStandardMaterial({ color: stone ? 0xbdb3a0 : 0xa08660, transparent: true, opacity: 0.7, depthWrite: false, roughness: 1 }));
      const a = (i / 7) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
      bits.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.5, 0.5 + (i % 3) * 0.15, Math.sin(a) * 0.5) });
      group.add(m);
    }
    const chipMat = new THREE.MeshStandardMaterial({ color: stone ? 0x9a9182 : 0x6b5236, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(GameRenderer.chipGeo, chipMat);
      const a = i * 2.4;
      bits.push({ m, v: new THREE.Vector3(Math.cos(a) * (0.6 + (i % 3) * 0.3), 1.6 + (i % 4) * 0.35, Math.sin(a) * (0.6 + (i % 3) * 0.3)) });
      group.add(m);
    }
    this.scene.add(group);
    this.puffs.push({ group, age: 0, bits });
  }

  /** Deszcz: przychodzi i odchodzi co kilka dni gry (czysto wizualnie, z zegara gry, więc bez losowania) */
  private updateRain(dt: number): void {
    const g = this.state;
    const day = g ? g.tick / RULES.dayTicks : 0;
    // co ~3 dni pada przez około pół dnia
    const phase = (day / 3 + 0.37) % 1;
    const want = phase < 0.16 ? Math.sin((phase / 0.16) * Math.PI) : 0;
    this.rain += (Math.min(1, want * 1.6) - this.rain) * Math.min(1, dt * 0.5);
    // pogoda dnia: pogodnie, pochmurno albo mglisto (z ziarna mapy, więc u każdego taka sama); przejścia płynne w ciągu dnia
    const seed = g?.map.seed ?? 1;
    const dayW = (d: number): [number, number] => { const h = Math.sin((Math.floor(d) + seed * 0.013) * 12.9898) * 43758.5453; const v = h - Math.floor(h); return v < 0.45 ? [0.12, 0] : v < 0.8 ? [0.55, 0.15] : [0.35, 0.8]; };
    const [c0, f0] = dayW(day), [c1, f1] = dayW(day + 1), fr = day - Math.floor(day);
    const wantCover = Math.max(this.rain, c0 + (c1 - c0) * fr), wantMist = f0 + (f1 - f0) * fr;
    this.cover += (wantCover - this.cover) * Math.min(1, dt * 0.3);
    this.dayMist += (wantMist - this.dayMist) * Math.min(1, dt * 0.3);
    this.grade.uniforms.rain!.value = this.rain;
    // po deszczu długo jest mokro: błoto i kałuże schną powoli
    this.wet = Math.max(0, Math.min(1, this.wet + (this.rain > 0.15 ? dt * 0.12 : -dt * 0.003)));
    if (Math.abs(this.wet - this.wetShown) > 0.01) { this.view?.setWet(this.wet); this.wetShown = this.wet; }
    if (g && this.view) this.syncPuddles(g, this.view);
    if (!this.rainLines) {
      // dwie identyczne warstwy jedna nad drugą: przesuwanie o 25 w kółko jest niewidoczne
      const n = 1500, pos = new Float32Array(n * 12);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 60, y = Math.random() * 25, z = (Math.random() - 0.5) * 60;
        pos.set([x, y, z, x + 0.06, y - 0.55, z + 0.03, x, y + 25, z, x + 0.06, y + 24.45, z + 0.03], i * 12);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rainLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab4c4, transparent: true, opacity: 0, depthWrite: false }));
      this.rainLines.frustumCulled = false;
      this.scene.add(this.rainLines);
    }
    const mat = this.rainLines.material as THREE.LineBasicMaterial;
    mat.opacity = this.rain * 0.45;
    this.rainLines.visible = this.rain > 0.02;
    if (this.rainLines.visible) {
      const f = this.focusPoint;
      const fall = (this.time * 22) % 25;
      this.rainLines.position.set(f.x, f.y - fall - 2, f.z);
    }
  }

  // --- niebo nocą: gwiazdy, księżyc z poświatą; w deszczu ciemne chmury zasłaniają niebo ---
  private sky: { group: THREE.Group; stars: THREE.Points; moon: THREE.Sprite; dome: THREE.Mesh; sunDisc: THREE.Sprite } | null = null;
  private updateSky(): void {
    if (!this.sky) {
      const group = new THREE.Group();
      const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // tylko górna półkula, gęściej nad horyzontem nie trzeba
        const u = Math.random(), v = Math.random() * 0.95;
        const th = u * Math.PI * 2, ph = Math.acos(v);
        pos.set([Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380], i * 3);
        const b = 0.6 + Math.random() * 0.4, warm = Math.random() < 0.2;
        col.set([b, b * (warm ? 0.9 : 1), b * (warm ? 0.75 : 1.05)], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // każda gwiazda mruga we własnym rytmie (faza i tempo w atrybucie), jasne bywają większe
      const ph = new Float32Array(n), sz = new Float32Array(n);
      for (let i = 0; i < n; i++) { ph[i] = Math.random() * 6.28; sz[i] = Math.random() < 0.08 ? 3.2 : 1.4 + Math.random() * 1.2; }
      geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
      geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
      const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, opacity: { value: 0 } },
        vertexShader: 'attribute float phase; attribute float size; attribute vec3 color; uniform float time; varying vec3 vC; varying float vA; void main() { vC = color; float tw = 0.55 + 0.45 * sin(time * (1.5 + fract(phase * 7.1) * 3.0) + phase); vA = tw; gl_PointSize = size * (0.7 + tw * 0.5); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float opacity; varying vec3 vC; varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC, a * vA * opacity); }',
        transparent: true, depthWrite: false, fog: false,
      }));
      // księżyc jak prawdziwy: tarcza z ciemnymi „morzami”, drobnymi kraterami, ciemniejszym brzegiem i szeroką, słabą poświatą
      const cv = document.createElement('canvas'); cv.width = cv.height = 512;
      const x = cv.getContext('2d')!;
      const glow = x.createRadialGradient(256, 256, 40, 256, 256, 256);
      glow.addColorStop(0, 'rgba(200,215,255,0.35)'); glow.addColorStop(0.3, 'rgba(160,180,230,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = glow; x.fillRect(0, 0, 512, 512);
      const R = 46;
      x.save(); x.beginPath(); x.arc(256, 256, R, 0, Math.PI * 2); x.clip();
      x.fillStyle = '#e6e4dc'; x.fillRect(256 - R, 256 - R, R * 2, R * 2);
      const rnd = (k: number): number => { const v = Math.sin(k * 91.7) * 43758.5; return v - Math.floor(v); };
      // morza: duże, nieregularne, szarawe plamy
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(120,124,132,${0.18 + rnd(i) * 0.2})`; x.beginPath(); x.ellipse(232 + rnd(i + 3) * 40, 236 + rnd(i + 7) * 36, 4 + rnd(i + 11) * 13, 3 + rnd(i + 13) * 10, rnd(i + 17) * 3, 0, Math.PI * 2); x.fill(); }
      // kratery: jasny brzeg, ciemny środek
      for (let i = 0; i < 40; i++) { const cx = 214 + rnd(i + 50) * 84, cy = 214 + rnd(i + 70) * 84, cr = 0.8 + rnd(i + 90) * 3.2; x.fillStyle = 'rgba(95,98,106,0.45)'; x.beginPath(); x.arc(cx, cy, cr, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(250,250,245,0.35)'; x.lineWidth = 0.7; x.stroke(); }
      // ciemniejszy brzeg tarczy (kula, nie płaski krążek)
      const limb = x.createRadialGradient(250, 250, R * 0.2, 256, 256, R);
      limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(0.85, 'rgba(0,0,10,0.12)'); limb.addColorStop(1, 'rgba(0,0,20,0.35)');
      x.fillStyle = limb; x.fillRect(256 - R, 256 - R, R * 2, R * 2);
      x.restore();
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, fog: false, depthWrite: false }));
      moon.scale.setScalar(110);
      // kopuła nieba: u góry głęboki błękit, przy horyzoncie kolor mgły (płynne przejście w krajobraz)
      const domeGeo = new THREE.SphereGeometry(420, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15);
      // Niebo jak w nowoczesnych grach: barwa zależna od wysokości nad horyzontem i od położenia słońca,
      // rozświetlony pas przy horyzoncie, poświata wokół słońca (szeroka i wąska), ciepła łuna o świcie i zmierzchu,
      // nocą granat z jaśniejszym horyzontem i poświatą księżyca; drobny szum usuwa pasy w gradiencie
      const dome = new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({
        uniforms: {
          zenith: { value: new THREE.Color(0x3d6fb4) }, horizon: { value: new THREE.Color(0xc9d6e2) }, fogCol: { value: new THREE.Color(0xb4b7ae) },
          glow: { value: new THREE.Color(0xffd9a0) }, sun: { value: new THREE.Vector3(0, 1, 0) }, moon: { value: new THREE.Vector3(0, 1, 0) },
          night: { value: 0 }, dusk: { value: 0 }, haze: { value: 0 },
        },
        vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform vec3 zenith; uniform vec3 horizon; uniform vec3 fogCol; uniform vec3 glow; uniform vec3 sun; uniform vec3 moon;
          uniform float night; uniform float dusk; uniform float haze;
          varying vec3 vDir;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            // gradient: przy horyzoncie jaśniej (gruba warstwa powietrza), w zenicie głęboki kolor
            vec3 col = mix(horizon, zenith, pow(h, 0.45));
            // łuna o wschodzie/zachodzie: ciepły pas nad horyzontem, najmocniej od strony słońca
            float sunSide = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sun.x, 0.0, sun.z))), 0.0);
            col += glow * dusk * pow(1.0 - h, 6.0) * (0.35 + 0.65 * sunSide);
            // poświata słońca: szeroka mgiełka i jaśniejszy środek (słabnie w zachmurzeniu)
            float cs = max(dot(d, normalize(sun)), 0.0);
            float above = smoothstep(-0.15, 0.05, sun.y);
            col += glow * above * (1.0 - haze * 0.7) * (pow(cs, 6.0) * 0.35 + pow(cs, 64.0) * 0.6);
            // poświata księżyca nocą
            float cm = max(dot(d, normalize(moon)), 0.0);
            col += vec3(0.35, 0.42, 0.6) * night * pow(cm, 24.0) * 0.5;
            // poniżej horyzontu i tuż przy nim niebo przechodzi w kolor mgły nad ziemią
            col = mix(col, fogCol, smoothstep(0.08, -0.02, d.y));
            col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.BackSide, depthWrite: true, fog: false, // kopuła zapisuje głębię, inaczej efekt cieni (AO) traktuje niebo jak puste tło i je zamalowuje
      }));
      dome.renderOrder = -20;
      // słońce jak prawdziwe: mała, oślepiająca tarcza, wokół szeroka mgiełka; kolor ociepla się przy horyzoncie
      const sc = document.createElement('canvas'); sc.width = sc.height = 256;
      const sx2 = sc.getContext('2d')!;
      const sg = sx2.createRadialGradient(128, 128, 0, 128, 128, 128);
      sg.addColorStop(0, 'rgba(255,255,250,1)'); sg.addColorStop(0.07, 'rgba(255,253,240,1)'); sg.addColorStop(0.1, 'rgba(255,240,210,0.65)');
      sg.addColorStop(0.25, 'rgba(255,225,180,0.22)'); sg.addColorStop(0.6, 'rgba(255,215,170,0.06)'); sg.addColorStop(1, 'rgba(255,215,170,0)');
      sx2.fillStyle = sg; sx2.fillRect(0, 0, 256, 256);
      const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
      const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      sunDisc.scale.setScalar(160);
      group.add(dome, stars, moon, sunDisc);
      for (const o of [stars, moon, sunDisc]) o.renderOrder = -10;
      this.scene.add(group);
      this.sky = { group, stars, moon, dome, sunDisc };
    }
    const sk = this.sky;
    const clear = 1 - this.rain;
    sk.group.position.copy(this.cam.camera.position);
    // niebo zawsze tuż przed granicą widzenia kamery (kopuła ma promień 420)
    sk.group.scale.setScalar(Math.min(1, (this.cam.camera.far * 0.92) / 420));
    const su = (sk.stars.material as THREE.ShaderMaterial).uniforms;
    su.opacity!.value = Math.max(0, (this.night - 0.2) / 0.8) * (1 - this.cover * 0.8);
    su.time!.value = this.time;
    // księżyc idzie łukiem po nocnym niebie
    const d = this.sunDir.clone().normalize();
    sk.moon.position.set(d.x * 340, Math.max(60, d.y * 340), d.z * 340); // nocą kierunek „słońca” to droga księżyca
    (sk.moon.material as THREE.SpriteMaterial).opacity = Math.max(0, (this.night - 0.15) / 0.85) * (0.3 + 0.7 * clear);
    // kolory kopuły: zenit zależny od pory (dzień błękit, świt/zmierzch cieplej, noc granat), horyzont = mgła
    const bg = this.scene.background as THREE.Color;
    const u = (this.sky.dome.material as THREE.ShaderMaterial).uniforms;
    const grey = Math.max(this.rain * 0.9, this.cover * 0.55, this.dayMist * 0.7);
    // prawdziwe położenie słońca z godziny (nocą pod horyzontem); „sunDir” nocą prowadzi księżyc
    const hour = this.state ? clockAt(this.state.tick).hour : 12;
    const ang = ((hour - 6) / 24) * Math.PI * 2;
    const realSun = new THREE.Vector3(-Math.cos(ang), Math.sin(ang) * 0.85, 0.4).normalize();
    const duskK = Math.max(0, 1 - Math.abs(realSun.y) * 4.5) * (1 - grey * 0.6); // tylko nisko przy horyzoncie
    (u.sun!.value as THREE.Vector3).copy(realSun);
    (u.moon!.value as THREE.Vector3).copy(this.sunDir).normalize();
    u.night!.value = this.night; u.dusk!.value = duskK; u.haze!.value = grey;
    (u.fogCol!.value as THREE.Color).copy(bg);
    // zenit: dzień błękit (szary w niepogodę), o zmierzchu głębszy fiolet, nocą granat
    const zen = new THREE.Color(0x2f62ad).lerp(new THREE.Color(0x737a84), grey).lerp(new THREE.Color(0x3b3f73), duskK * 0.5).lerp(new THREE.Color(0x050914), this.night);
    (u.zenith!.value as THREE.Color).copy(zen);
    // horyzont: dzień jasny, lekko mleczny; o zmierzchu pomarańczowo-różowy; nocą przygaszony granat
    const hor = new THREE.Color(0xd2dde8).lerp(new THREE.Color(0xa9adb2), grey).lerp(new THREE.Color(0xe7a27a), duskK * 0.8).lerp(new THREE.Color(0x141c30), this.night);
    (u.horizon!.value as THREE.Color).copy(hor);
    (u.glow!.value as THREE.Color).set(0xffe2b0).lerp(new THREE.Color(0xff8a40), duskK);
    // słońce widać tylko w dzień i bez deszczu
    const sd = this.sunDir.clone().normalize();
    sk.sunDisc.position.set(sd.x * 360, Math.max(30, sd.y * 360), sd.z * 360);
    const sm2 = sk.sunDisc.material as THREE.SpriteMaterial;
    sm2.opacity = (1 - this.night) * (1 - Math.max(this.rain * 0.9, this.cover * 0.6)) * Math.min(1, Math.max(0, (sd.y - 0.02) * 6));
    sm2.color.set(0xffffff).lerp(new THREE.Color(0xff9a50), Math.max(0, 1 - sd.y * 2.5)); // nisko nad horyzontem pomarańczowe
  }

  private updatePuffs(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!;
      p.age += dt;
      for (const b of p.bits) {
        const chip = b.m.geometry === GameRenderer.chipGeo;
        if (chip) { b.v.y -= 6 * dt; b.m.position.addScaledVector(b.v, dt); if (b.m.position.y < 0) { b.m.position.y = 0; b.v.set(0, 0, 0); } b.m.rotation.x += dt * 8; }
        else {
          b.m.position.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 2.5);
          b.m.scale.setScalar(1 + p.age * 3);
          (b.m.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.7 * (1 - p.age / 1.2));
        }
      }
      if (p.age > 1.4) {
        this.scene.remove(p.group);
        for (const b of p.bits) if (b.m.geometry !== GameRenderer.chipGeo || b === p.bits[p.bits.length - 1]) (b.m.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
      }
    }
  }

  // --- spacer oczami chłopa: kamera na wysokości głowy, WASD i mysz, zderzenia z budynkami i wodą ---
  private walk: { x: number; z: number; yaw: number; pitch: number; keys: Set<string>; bob: number } | null = null;
  /** Wywoływane, gdy spacer się skończy (Esc) */
  onWalkEnd: () => void = () => {};
  get walking(): boolean { return !!this.walk; }
  setWalkPitch(p: number): void { if (this.walk) this.walk.pitch = p; }
  private walkFocus = new THREE.Vector3();
  /** Środek uwagi: przy spacerze miejsce, gdzie stoi chłop (światła, cienie i deszcz liczą się wokół niego) */
  private get focusPoint(): THREE.Vector3 {
    if (!this.walk || !this.state) return this.cam.focus;
    const c = this.cam.camera.position;
    return this.walkFocus.set(c.x, c.y - 0.46, c.z);
  }
  // pochodnia w ręce podczas spaceru: F zapala i gasi
  // Światło pochodni bierze jedną z gotowych lamp: dodanie nowego światła do sceny przekompilowałoby
  // wszystkie shadery i gra stanęłaby na 1–2 sekundy.
  private handTorch: THREE.Group | null = null;
  private handTip = new THREE.Object3D();
  private handFlameTime = { value: 0 };
  private lodTick = 0;
  private torchOn = false;
  private toggleHandTorch(): void {
    if (!this.handTorch) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0x3a2818 }));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.017, 0.06, 7).translate(0, 0.17, 0), new THREE.MeshBasicMaterial({ color: 0x1e140c }));
      this.handTip.position.set(0, 0.19, 0);
      // płomień jako płaska siatka przypięta do pochodni w kamerze (billboard świata rozciągał się tuż przy oku)
      const fl = flameSprite(this.handFlameTime, 0.07, 0.15);
      fl.position.set(0, 0.18, 0);
      fl.rotation.x = 0.35;
      g.add(stick, head, this.handTip, fl);
      g.rotation.x = -0.35;
      g.position.set(0.22, -0.24, -0.42);
      this.handTorch = g;
      this.cam.camera.add(g);
      if (!this.cam.camera.parent) this.scene.add(this.cam.camera);
    }
    this.torchOn = !this.torchOn;
    this.handTorch.visible = this.torchOn;
    if (this.torchOn) playAt('creak', 1, 0.3, 0.4);
  }
  startWalk(tileX: number, tileY: number, heading = 0): void {
    if (!this.state) return;
    const keys = new Set<string>();
    this.walk = { x: tileX, z: tileY, yaw: heading, pitch: -0.05, keys, bob: 0 };
    const cam = this.cam.camera;
    cam.fov = 70; cam.near = 0.05; cam.updateProjectionMatrix();
    const down = (e: KeyboardEvent): void => { if (this.walk) { if (e.code === 'KeyF' && !e.repeat) this.toggleHandTorch(); keys.add(e.code); if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF'].includes(e.code)) e.stopImmediatePropagation(); } };
    const up = (e: KeyboardEvent): void => { keys.delete(e.code); };
    const move = (e: MouseEvent): void => {
      if (!this.walk || document.pointerLockElement !== this.canvas) return;
      this.walk.yaw -= e.movementX * 0.0025;
      this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - e.movementY * 0.0025));
    };
    const lock = (): void => { if (document.pointerLockElement !== this.canvas) end(); };
    const click = (): void => { if (this.walk && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock(); };
    const end = (): void => {
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
      window.removeEventListener('mousemove', move); document.removeEventListener('pointerlockchange', lock); this.canvas.removeEventListener('click', click);
      this.walk = null;
      if (this.torchOn) this.toggleHandTorch();
      cam.fov = 38; cam.near = 0.5; cam.updateProjectionMatrix();
      this.cam.lookAt(tileX - this.state!.map.width / 2, tileY - this.state!.map.height / 2, 22);
      this.onWalkEnd();
    };
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('mousemove', move);
    this.canvas.addEventListener('click', click);
    void this.canvas.requestPointerLock();
    // pointerlockchange przychodzi chwilę po zablokowaniu kursora; dopiero potem słuchamy wyjścia (Esc)
    setTimeout(() => document.addEventListener('pointerlockchange', lock), 300);
  }
  private stepWalk(dt: number): void {
    const w = this.walk!, g = this.state!;
    const k = w.keys;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const sp = (run ? 4.2 : 2.1) * dt;
    let fx = 0, fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    const sx = Math.sin(w.yaw), cz = Math.cos(w.yaw);
    // przód kamery to -z w jej układzie: yaw=0 patrzy w -z świata
    const dx = (-sx * fz + cz * fx) / len * sp, dz = (-cz * fz - sx * fx) / len * sp;
    const free = (x: number, z: number): boolean => {
      const tx = Math.floor(x), ty = Math.floor(z);
      if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
      const t = ty * g.map.width + tx;
      return (g.occupancy[t] === 0 || g.gates[t] !== 0) && g.map.tiles[t] !== Terrain.Water && g.map.tiles[t] !== Terrain.Mountain;
    };
    if (free(w.x + dx, w.z)) w.x += dx;
    if (free(w.x, w.z + dz)) w.z += dz;
    if (fx || fz) w.bob += sp * 5;
    const cam = this.cam.camera;
    const { width, height } = g.map;
    const ground = this.view ? this.view.heightAt(w.x, w.z) : 0;
    cam.position.set(w.x - width / 2, Math.max(ground, 0) + 0.46 + Math.sin(w.bob) * 0.02, w.z - height / 2);
    cam.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
  }

  frame(dt: number, alpha: number): void {
    if (this.walk && this.state) this.stepWalk(dt); else this.cam.update(dt);
    this.time += dt;
    this.updatePuffs(dt);
    this.updateRain(dt);
    this.updateSky();
    if (this.state) this.setDaylight(this.menuNight ? 23 : this.alwaysDay ? 11 : clockAt(this.state.tick).hour);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); this.hemi.intensity += this.flash * 3 * (Math.random() < 0.7 ? 1 : 0.3); }
    this.aimSun();
    if (this.state && this.view) {
      const g = this.state, v = this.view;
      // każdy etap mierzony osobno: okno wydajności pokazuje, co zjada czas klatki
      const T = (name: string, fn: () => void): void => { const t0 = performance.now(); fn(); this.timing[name] = (this.timing[name] ?? 0) + performance.now() - t0; };
      T('animacje', () => { this.animate(g, this.calm ? 0 : dt); if (!this.calm) v.animate(this.time); });
      T('las', () => this.syncForest(g, v));
      { const f = this.focusPoint; v.updateGrass(f.x, f.z, this.calm ? 0 : this.time, this.walk ? 0 : this.cam.distance); }
      if (this.lodTick++ % 10 === 0) { const f = this.focusPoint; v.lod(f.x, f.z, this.walk ? 0 : Math.max(0, this.cam.distance - 30) * 0.35); }
      T('drogi', () => this.syncRoads(g, v));
      T('gruz', () => this.syncRubble(g, v, dt));
      T('światła', () => this.syncLamps(g));
      T('budynki', () => { this.syncAreas(g, v); this.syncBuildings(g, v); this.syncSites(g); this.syncWalls(g, v); this.syncGates(g, dt); this.syncStores(g); });
      T('chłopi', () => this.syncUnits(g, v, alpha));
      T('wojsko', () => this.syncSoldiers(g, v, alpha));
      T('klimat', () => { this.syncAmbience(g, v, dt); this.syncFlames(g); });
      T('zwierzęta', () => { this.syncWolves(g, v, alpha); this.syncCrows(g, v); this.syncForestEyes(g, v); });
    }
    const tg = performance.now();
    this.renderer.info.reset(); // liczymy wszystkie przejścia klatki razem (AO, wyjście)
    this.composer.render();
    this.timing['karta graficzna'] = (this.timing['karta graficzna'] ?? 0) + performance.now() - tg;
    this.timingFrames++;
  }
  /** Płomienie: pochodnie przy budynkach (zapalone), ogniska w obozowiskach i karczmach, pożary uszkodzonych budynków */
  private syncFlames(g: GameState): void {
    const F = this.flames, w = new THREE.Vector3();
    F.begin(this.calm ? 0 : this.time);
    const glow = Math.min(1, this.night * 1.4);
    const f = this.focusPoint;
    const lit = new Set<number>();
    // pochodnia na słupie płonie tylko po zmroku (także gdy cykl dnia jest wyłączony, a symulacja ma noc)
    const dark = this.night > 0.12 || this.menuNight;
    if (dark) for (const b of g.buildings) if (b.lit || this.menuNight) lit.add(b.id);
    for (let i = 0; i < this.handFlameN; i++) F.add(this.handFlames[i]!, 0.2, 0.11, (i * 0.377) % 1, glow * 0.6);
    this.handFlameN = 0;
    this.handFlameTime.value = this.time;
    for (const [id, mesh] of this.buildingMeshes) {
      if ((mesh.position.x - f.x) ** 2 + (mesh.position.z - f.z) ** 2 > 110 * 110) continue;
      const torchFlame = mesh.getObjectByName('torchflame');
      if (torchFlame && lit.has(id)) { torchFlame.getWorldPosition(w); w.y -= 0.12; F.add(w, 0.36, 0.2, (id * 0.137) % 1, glow); }
      // kosze ogniowe (brama zamku, wartownia): płoną tylko po zmroku i tylko gdy są widoczne
      if (dark) {
        // lista koszy zapamiętana przy budynku; gdy model się przebudował (stare części odpięte), szukamy od nowa
        let list = mesh.userData.braziers as THREE.Object3D[] | undefined;
        const attached = (o: THREE.Object3D): boolean => { let p: THREE.Object3D | null = o; while (p && p !== mesh) p = p.parent; return p === mesh; };
        if (!list || (list.length && !attached(list[0]!)) || (this.lodTick % 120 === 0)) { list = []; mesh.traverse((o) => { if (o.name === 'brazier') list!.push(o); }); mesh.userData.braziers = list; }
        for (const o of list) {
          let shown = true;
          for (let p: THREE.Object3D | null = o; p && p !== mesh; p = p.parent) if (!p.visible) { shown = false; break; }
          if (!shown) continue;
          o.getWorldPosition(w); F.add(w, 0.3, 0.17, (o.id * 0.271) % 1, glow);
        }
      }
      const camp = mesh.getObjectByName('flame');
      if (camp && camp.visible) {
        camp.getWorldPosition(w);
        for (const ch of camp.children) ch.visible = false;
        F.add(w, 0.42, 0.3, (id * 0.311) % 1, glow);
        F.add(w.set(w.x + 0.04, w.y, w.z - 0.03), 0.3, 0.2, (id * 0.731) % 1, 0);
      }
      const fire = mesh.getObjectByName('fire');
      if (fire && fire.visible) {
        for (const ch of fire.children) { ch.visible = false; ch.getWorldPosition(w); F.add(w.setY(w.y - 0.1), 0.75, 0.5, (ch.id * 0.193) % 1, glow * 0.6 + 0.3); }
      }
    }
    F.end();
  }

  /** Dym, iskry, okna i mgła: źródła odświeżane dwa razy na sekundę, cząstki co klatkę */
  private syncAmbience(g: GameState, v: TerrainView, dt: number): void {
    const { width, height } = g.map;
    const focus = this.focusPoint;
    if (this.time > this.fxAt) {
      this.fxAt = this.time + 0.5;
      const list: FxSource[] = [];
      for (const b of g.buildings) {
        const mesh = this.buildingMeshes.get(b.id);
        const fx = mesh?.userData.fx as BuildingFx | undefined;
        if (!mesh || !fx || b.build || b.ruined) continue;
        const fire = mesh.getObjectByName('fire');
        list.push({ mesh, fx, smoke: SMOKY.has(BUILDINGS[b.type]!.id), burning: !!fire?.visible });
      }
      this.ambience.setSources(list, focus);
      this.clutter.sync(g, (x, y) => v.heightAt(x, y));
      // chłopi wydeptują ścieżki tam, gdzie chodzą najczęściej
      let n = 0;
      for (const u of g.units) {
        if (u.path.length === 0) continue;
        v.wear(Math.round(u.px / 256), Math.round(u.py / 256), 0.012, 0.6);
        if (++n > 400) break;
      }
    }
    const cam = this.cam.camera;
    this.clouds.update(this.calm ? 0 : dt, {
      cover: this.cover, rain: this.rain, night: this.night, sun: this.sunDir.clone().normalize(), haze: this.scene.background as THREE.Color,
      focus, camera: cam, ground: (x, z) => v.heightAt(x + width / 2, z + height / 2), far: cam.far,
    });
    this.ambience.update(dt, {
      night: this.night, mist: this.mistLevel, rain: this.rain, fog: (this.scene.fog as THREE.Fog).color, focus, calm: this.calm,
      ground: (x, z) => v.heightAt(x + width / 2, z + height / 2),
      scale: this.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360)),
    });
  }
  /** Czas poszczególnych etapów klatki (ms na klatkę) od ostatniego odczytu */
  readTiming(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.timing)) out[k] = +(v / Math.max(1, this.timingFrames)).toFixed(2);
    this.timing = {}; this.timingFrames = 0;
    return out;
  }
  private timing: Record<string, number> = {};
  private timingFrames = 0;
  quality = '';

  private wallKey = '';
  private wallShafts: THREE.InstancedMesh | null = null;
  private wallTips: THREE.InstancedMesh | null = null;
  /** Częstokół: bale łączą się z sąsiednimi palisadami, bramami i wieżami; brama obraca się w linii muru */
  private syncWalls(g: GameState, view: TerrainView): void {
    const { width, height } = g.map;
    const walls = g.buildings.filter((b) => { const d = BUILDINGS[b.type]!; return d.wall || d.gate; });
    const key = walls.map((b) => `${b.id}:${b.build ? Math.ceil((1 - b.build / buildWork(b.type)) * 16) : 99}`).join(',');
    if (key === this.wallKey) return;
    this.wallKey = key;
    const solid = new Map<number, GameState['buildings'][number]>();
    for (const b of walls) { const fp = footprint(BUILDINGS[b.type]!, b.rot); for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) solid.set(y * width + x, b); }
    const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && solid.has(y * width + x);
    if (!this.wallShafts) {
      const bark = (new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95, map: pattern('bark'), normalMap: normal('bark') }));
      this.wallShafts = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.1, 1, 7).translate(0, 0.5, 0), bark, 4096);
      this.wallTips = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), bark, 4096);
      for (const m of [this.wallShafts, this.wallTips]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); }
    }
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    for (const b of walls) {
      const def = BUILDINGS[b.type]!;
      if (def.gate) {
        // brama staje w poprzek muru: gdy sąsiedzi są po bokach w osi x, wrota idą wzdłuż x
        const mesh = this.buildingMeshes.get(b.id);
        if (mesh) mesh.rotation.y = at(b.x - 1, b.y) || at(b.x + 1, b.y) ? 0 : Math.PI / 2;
        continue;
      }
      if (!def.line) continue;
      // budowa częstokołu: bale stają jeden po drugim (pełnej wysokości), a nie rosną z ziemi
      const built = b.build ? 1 - b.build / buildWork(b.type) : 1;
      const links: [boolean, boolean, boolean, boolean] = [at(b.x + 1, b.y), at(b.x - 1, b.y), at(b.x, b.y + 1), at(b.x, b.y - 1)];
      const cx = b.x + 0.5, cz = b.y + 0.5;
      const logs = palisadeLogs(links, b.id);
      const shown = Math.floor(logs.length * built + 0.001);
      for (let li = 0; li < logs.length; li++) {
        const log = logs[li]!;
        if (n >= 4096) break;
        if (li >= shown) {
          // miejsce na kolejny bal: wbity kołek znacznikowy
          if (li === shown) {
            const lx = cx + log.x, lz = cz + log.z, y = view.heightAt(lx, lz) - 0.05;
            M4.compose(p.set(lx - width / 2, y, lz - height / 2), q.identity(), sc.set(log.r * 0.4, 0.18, log.r * 0.4));
            this.wallShafts.setMatrixAt(n, M4);
            this.wallTips!.setMatrixAt(n, M4.makeScale(0, 0, 0));
            n++;
          }
          continue;
        }
        const lx = cx + log.x, lz = cz + log.z;
        const y = view.heightAt(lx, lz) - 0.05;
        const h = log.h;
        e.set((log.x * 7 % 1) * 0.05, 0, (log.z * 5 % 1) * 0.05);
        q.setFromEuler(e);
        M4.compose(p.set(lx - width / 2, y, lz - height / 2), q, sc.set(log.r, h, log.r));
        this.wallShafts.setMatrixAt(n, M4);
        M4.compose(p.set(lx - width / 2, y + h, lz - height / 2), q, sc.set(log.r, log.r * 2.2, log.r));
        this.wallTips!.setMatrixAt(n, M4);
        n++;
      }
    }
    this.wallShafts.count = n; this.wallTips!.count = n;
    this.wallShafts.instanceMatrix.needsUpdate = true; this.wallTips!.instanceMatrix.needsUpdate = true;
  }

  private wolfMesh: THREE.InstancedMesh | null = null;
  private wolfEyes: THREE.InstancedMesh | null = null;
  private wolfLegs!: THREE.InstancedMesh;
  private wolfTails!: THREE.InstancedMesh;
  private wolfPart = new THREE.Matrix4();
  private wolfRot = new THREE.Matrix4();
  private wolfHeading = new Map<number, number>();
  get wolvesNear(): number { return this.state?.wolves.length ?? 0; }
  /** Wilki: szare, przygarbione, w kłusie; nocą świecą im oczy */
  private syncWolves(g: GameState, view: TerrainView, alpha: number): void {
    if (!this.wolfMesh) {
      const { body, leg, tail, eyes, mat } = wolfParts();
      this.wolfMesh = new THREE.InstancedMesh(body, mat, 64);
      this.wolfLegs = new THREE.InstancedMesh(leg, mat, 256);
      this.wolfTails = new THREE.InstancedMesh(tail, mat, 64);
      for (const m of [this.wolfMesh, this.wolfLegs, this.wolfTails]) { m.castShadow = true; m.frustumCulled = false; this.scene.add(m); }
      this.wolfEyes = new THREE.InstancedMesh(eyes, new THREE.MeshBasicMaterial({ color: 0xffd24a }), 64);
      this.wolfEyes.frustumCulled = false;
      this.scene.add(this.wolfEyes);
    }
    const { width, height } = g.map;
    const t = this.tmp;
    let n = 0;
    for (const w of g.wolves) {
      if (n >= 64) break;
      const prev = this.prevPos.get(w.id);
      const fx = (prev ? prev[0] + (w.px - prev[0]) * alpha : w.px) / FP, fy = (prev ? prev[1] + (w.py - prev[1]) * alpha : w.py) / FP;
      const next = w.path[0];
      let h = this.wolfHeading.get(w.id) ?? 0;
      if (next !== undefined) {
        const want = Math.atan2((next % width) + 0.5 - fx, Math.floor(next / width) + 0.5 - fy);
        let d = want - h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        h += d * 0.2; this.wolfHeading.set(w.id, h);
      }
      const run = next !== undefined && !this.calm;
      // atak: wilk skacze do przodu i cofa się, łeb w dół
      let lunge = 0;
      if (w.target && !run && !this.calm) {
        const prey = g.units.find((u) => u.id === w.target) ?? g.soldiers.find((s) => s.id === w.target);
        if (prey && (prey.px - w.px) ** 2 + (prey.py - w.py) ** 2 < (1.5 * FP) ** 2) {
          h = Math.atan2(prey.px / FP - fx, prey.py / FP - fy); this.wolfHeading.set(w.id, h);
          lunge = Math.max(0, Math.sin(this.time * 9 + w.id));
        }
      }
      const bob = run ? Math.abs(Math.sin(this.time * 12 + w.id)) * 0.05 : 0;
      t.position.set(fx - width / 2 + Math.sin(h) * lunge * 0.3, view.heightAt(fx, fy) + bob + lunge * 0.12, fy - height / 2 + Math.cos(h) * lunge * 0.3);
      t.rotation.set(run ? Math.sin(this.time * 12 + w.id) * 0.06 : -lunge * 0.25, h, 0, 'YXZ');
      t.scale.setScalar(1.0);
      t.updateMatrix();
      this.wolfMesh.setMatrixAt(n, t.matrix);
      // kłus: łapy po przekątnej razem; w ataku przednie wyrzucone do przodu
      const ph = this.time * 12 + w.id;
      const hips = WOLF_HIPS;
      hips.forEach(([hx, hy, hz], k) => {
        const diag = k === 0 || k === 3 ? 1 : -1;
        const front = hz > 0;
        const ang = run ? Math.sin(ph) * 0.55 * diag : lunge ? (front ? -0.7 * lunge : 0.35 * lunge) : 0;
        this.wolfRot.makeRotationX(ang).setPosition(hx, hy, hz);
        this.wolfLegs.setMatrixAt(n * 4 + k, this.wolfPart.multiplyMatrices(t.matrix, this.wolfRot));
      });
      // ogon: w biegu prosto za sobą i lekko faluje, w miejscu zwieszony, w ataku sztywno
      const tailUp = run ? 1.9 + Math.sin(ph * 0.5) * 0.15 : lunge ? 2.2 : 0.5;
      this.wolfRot.makeRotationX(tailUp).setPosition(0, 0.37, -0.23);
      this.wolfTails.setMatrixAt(n, this.wolfPart.multiplyMatrices(t.matrix, this.wolfRot));
      this.wolfEyes!.setMatrixAt(n, this.night > 0.2 ? t.matrix : ZERO);
      // warczenie z bliska, kłapnięcie przy ataku
      if (!this.calm && w.target) this.sfxAt('growl', t.position.x, t.position.z, `w${w.id}`, 2.6 + (w.id % 3), 1.4);
      n++;
    }
    this.wolfMesh.count = n; this.wolfEyes!.count = n; this.wolfTails.count = n; this.wolfLegs.count = n * 4;
    this.wolfLegs.instanceMatrix.needsUpdate = true; this.wolfTails.instanceMatrix.needsUpdate = true;
    this.wolfMesh.instanceMatrix.needsUpdate = true; this.wolfEyes!.instanceMatrix.needsUpdate = true;
  }

  private gateAngle = new Map<number, number>();
  private gateShut = new Map<number, boolean>();
  /** Wrota bramy płynnie się otwierają i zamykają; skrzypienie przy ruchu, łomot przy domknięciu */
  private syncGates(g: GameState, dt: number): void {
    for (const b of g.buildings) {
      if (!BUILDINGS[b.type]!.gate) continue;
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      const shut = !!b.shut;
      const was = this.gateShut.get(b.id);
      const want = shut ? 0 : 1.3;
      let a = this.gateAngle.get(b.id) ?? want;
      if (was !== undefined && was !== shut) this.sfxAt('creak', mesh.position.x, mesh.position.z, `g${b.id}`, 0.1, 1.6);
      this.gateShut.set(b.id, shut);
      const before = a;
      a += Math.max(-dt * 1.1, Math.min(dt * 1.1, want - a)); // ok. 1,2 s na pełny ruch
      if (this.calm) a = want;
      if (before > 0.02 && a <= 0.02 && shut) this.sfxAt('plank', mesh.position.x, mesh.position.z, `gt${b.id}`, 0.1, 1.8);
      this.gateAngle.set(b.id, a);
      const l = mesh.getObjectByName('leafL'), r = mesh.getObjectByName('leafR');
      if (l) l.rotation.y = -a;
      if (r) r.rotation.y = a;
    }
  }

  private wet = 0;
  /** Zachmurzenie 0..1 i mglistość dnia 0..1 (zmienna pogoda) */
  private cover = 0.2;
  private dayMist = 0;
  get weatherText(): string { return this.rain > 0.3 ? 'deszcz' : this.dayMist > 0.4 ? 'mgła' : this.cover > 0.4 ? 'pochmurno' : 'pogodnie'; }
  private wetShown = -1;
  private puddles: THREE.InstancedMesh | null = null;
  private puddleKey = '';
  /** Kałuże na ścieżkach gruntowych (co któreś pole), widoczne tylko gdy mokro */
  private syncPuddles(g: GameState, view: TerrainView): void {
    if (!this.puddles) {
      this.puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 18).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x3a3c38, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 1024);
      this.puddles.frustumCulled = false; this.puddles.renderOrder = 1;
      this.scene.add(this.puddles);
    }
    (this.puddles.material as THREE.MeshStandardMaterial).opacity = Math.min(0.85, this.wet * 1.6);
    this.puddles.visible = this.wet > 0.03;
    if (!this.puddles.visible) return;
    const key = `${this.roadSum}`;
    if (key === this.puddleKey) return;
    this.puddleKey = key;
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    for (let t = 0; t < g.roads.length && n < 1024; t++) {
      if (g.roads[t] !== 1) continue;
      const hsh = (t * 2654435761) >>> 0;
      if (hsh % 3 !== 0) continue;
      const x = (t % width) + 0.3 + ((hsh >>> 8) & 255) / 640, y = Math.floor(t / width) + 0.3 + ((hsh >>> 16) & 255) / 640;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hsh & 63) / 10);
      m.compose(p.set(x - width / 2, view.heightAt(x, y) + 0.05, y - height / 2), q, sc.set(0.5 + ((hsh >>> 4) & 15) / 30, 1, 0.3 + ((hsh >>> 12) & 15) / 40));
      this.puddles.setMatrixAt(n++, m);
    }
    this.puddles.count = n;
    this.puddles.instanceMatrix.needsUpdate = true;
  }

  private crows: THREE.InstancedMesh | null = null;
  /** Kruki na ciałach poległych: dziobią, podskakują; płoszą się, gdy ktoś podejdzie */
  private syncCrows(g: GameState, view: TerrainView): void {
    if (!this.crows) {
      const geo = crowGeometry();
      this.crows = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 256);
      this.crows.frustumCulled = false; this.crows.castShadow = true;
      this.scene.add(this.crows);
    }
    const { width, height } = g.map;
    const t = this.tmp;
    let n = 0;
    for (const body of g.corpses) {
      if (n >= 250) break;
      if (body.taken || g.tick - body.at < 150) continue; // przylatują chwilę po śmierci
      const near = g.units.some((u) => Math.abs(u.px - body.px) < 2.5 * FP && Math.abs(u.py - body.py) < 2.5 * FP)
        || g.soldiers.some((s) => Math.abs(s.px - body.px) < 2.5 * FP && Math.abs(s.py - body.py) < 2.5 * FP);
      if (near) continue; // spłoszone
      const count = 1 + (body.id % 3);
      for (let i = 0; i < count; i++) {
        const a = body.id * 1.7 + i * 2.3, r = 0.28 + (i % 2) * 0.12;
        const k = this.calm ? 0 : this.time * 3 + body.id + i * 1.9;
        const hop = Math.max(0, Math.sin(k * 0.7)) > 0.97 ? 0.06 : 0;
        const x = body.px / FP + Math.cos(a) * r, y = body.py / FP + Math.sin(a) * r;
        t.position.set(x - width / 2, view.heightAt(x, y) + hop, y - height / 2);
        // dziobanie: tułów pochyla się do ciała
        t.rotation.set(Math.max(0, Math.sin(k * 2.3)) * 0.6, Math.atan2(-Math.cos(a), -Math.sin(a)), 0, 'YXZ');
        t.scale.setScalar(1.25);
        t.updateMatrix();
        this.crows.setMatrixAt(n++, t.matrix);
      }
    }
    this.crows.count = n;
    this.crows.instanceMatrix.needsUpdate = true;
  }

  /** Strzały w locie: łuk balistyczny od łucznika do celu, ok. 0,45 s */
  private flyArrows(): void {
    const dt = this.calm ? 1 : 1 / 60;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), nx = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    this.arrows = this.arrows.filter((a) => (a.t += dt / 0.45) < 1);
    for (const a of this.arrows) {
      const arc = Math.sin(a.t * Math.PI) * a.from.distanceTo(a.to) * 0.12;
      p.lerpVectors(a.from, a.to, a.t); p.y += arc;
      nx.lerpVectors(a.from, a.to, Math.min(1, a.t + 0.05)); nx.y += Math.sin(Math.min(1, a.t + 0.05) * Math.PI) * a.from.distanceTo(a.to) * 0.12;
      m.lookAt(nx, p, new THREE.Vector3(0, 1, 0));
      q.setFromRotationMatrix(m);
      m.compose(p, q, one);
      this.arrowMesh.setMatrixAt(n++, m);
    }
    this.arrowMesh.count = n;
    this.arrowMesh.instanceMatrix.needsUpdate = true;
  }

  private eyes: THREE.InstancedMesh | null = null;
  private eyeSpots: { a: number; d: number; speed: number; blink: number }[] = [];
  /** Nocą w lesie za mapą świecą czerwone oczy: pary krążą wolno, mrugają, czasem znikają między drzewami */
  private syncForestEyes(g: GameState, view: TerrainView): void {
    const on = this.night > 0.35;
    if (!this.eyes) {
      const pair = mergeGeometries([new THREE.SphereGeometry(0.035, 6, 4).translate(-0.06, 0, 0), new THREE.SphereGeometry(0.035, 6, 4).translate(0.06, 0, 0)])!;
      this.eyes = new THREE.InstancedMesh(pair, new THREE.MeshBasicMaterial({ color: 0xff3322, fog: false }), 48);
      this.eyes.frustumCulled = false;
      this.scene.add(this.eyes);
      for (let i = 0; i < 48; i++) this.eyeSpots.push({ a: (i / 48) * Math.PI * 2 + Math.random() * 0.1, d: 1.5 + Math.random() * 6, speed: (Math.random() - 0.5) * 0.02, blink: Math.random() * 10 });
    }
    this.eyes.visible = on;
    if (!on) return;
    const { width, height } = g.map;
    const t = this.tmp;
    // więcej oczu, gdy wataha jest na mapie
    const shown = g.wolves.length ? 48 : 30;
    for (let i = 0; i < 48; i++) {
      const e = this.eyeSpots[i]!;
      if (!this.calm) e.a += e.speed * 0.016;
      // punkt na brzegu mapy (prostokąt), odsunięty w las
      const per = (((e.a / (Math.PI * 2)) % 1) + 1) % 1, L = 2 * (width + height);
      let p = per * L, x = 0, y = 0, nx = 0, ny = 0;
      if (p < width) { x = p; y = 0; ny = -1; } else if ((p -= width) < height) { x = width; y = p; nx = 1; } else if ((p -= height) < width) { x = width - p; y = height; ny = 1; } else { p -= width; x = 0; y = height - p; nx = -1; }
      x += nx * e.d + Math.sin(this.time * 0.3 + i) * 0.4; y += ny * e.d + Math.cos(this.time * 0.25 + i) * 0.4;
      // mrugnięcie i chowanie się za drzewami
      const k = (this.time + e.blink) % 9;
      const open = i < shown && !(k > 8.7 || (k > 4 && k < 4.6 && i % 3 === 0));
      t.position.set(x - width / 2, view.heightAt(Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y))) + 0.35 + (i % 4) * 0.05, y - height / 2);
      t.rotation.set(0, Math.atan2(-nx, -ny), 0);
      t.scale.set(1, open ? 1 : 0.05, 1);
      t.updateMatrix();
      this.eyes.setMatrixAt(i, t.matrix);
    }
    this.eyes.instanceMatrix.needsUpdate = true;
  }

  private dustAt = new Map<number, number>();
  /** Gruzowiska na miejscu zniszczonych budynków (do odbudowy) */
  private ruinPiles = new Map<number, THREE.Group>();
  /** Do kiedy (czas sceny) pali się uszkodzony budynek */
  private burnUntil = new Map<number, number>();
  /**
   * Plac budowy: budynek nie rośnie ani się nie rozciąga — wznosi się warstwa po warstwie. Model jest przycięty
   * poziomą płaszczyzną na wysokości postępu (widać mury do połowy, puste wnętrze, potem dach), dookoła stoją
   * rusztowania z pomostem na bieżącej wysokości, obok leży stos desek i kamieni, nad placem kurz.
   * Wydajność: osobne kopie materiałów tylko dla budynków właśnie w budowie (zwykle kilka), rusztowania i stosy
   * to dwie wspólne siatki instancji przeliczane tylko, gdy postęp przeskoczy o 1/20.
   */
  /** Czas, od kiedy trwa pokazowa budowa gotowego od razu budynku (sama grafika, ok. 3 s) */
  private quickBuild = new Map<number, number>();
  private builtAt = 0;
  private sites = new Map<number, { plane: THREE.Plane; base: number; top: number; swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][]; clip: (m: THREE.Material) => THREE.Material }>();
  private siteKey = '';
  private scaffold: THREE.InstancedMesh | null = null;
  private siteStones: THREE.InstancedMesh | null = null;
  private beginSite(id: number, mesh: THREE.Object3D): void {
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const clones = new Map<THREE.Material, THREE.Material>();
    const clip = (m: THREE.Material): THREE.Material => {
      let c = clones.get(m);
      if (!c) { c = m.clone(); c.clippingPlanes = [plane]; c.clipShadows = true; c.side = THREE.DoubleSide; clones.set(m, c); }
      return c;
    };
    const site = { plane, base: mesh.position.y, top: Math.max(box.max.y, mesh.position.y + 0.5), swapped, clip };
    this.sites.set(id, site);
    this.clipNew(mesh, site);
  }
  /** Przycina części modelu, które jeszcze nie są przycięte (np. zapasy dodane później) */
  private clipNew(mesh: THREE.Object3D, site: { swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][]; clip: (m: THREE.Material) => THREE.Material }): void {
    mesh.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || !me.material || me.userData.siteClip) return;
      me.userData.siteClip = true;
      site.swapped.push([me, me.material]);
      me.material = Array.isArray(me.material) ? me.material.map(site.clip) : site.clip(me.material);
    });
  }
  private endSite(id: number): void {
    const s = this.sites.get(id);
    if (!s) return;
    const done = new Set<THREE.Material>();
    for (const [me, orig] of s.swapped) {
      for (const m of Array.isArray(me.material) ? me.material : [me.material]) if (!done.has(m)) { done.add(m); m.dispose(); }
      me.material = orig;
      me.userData.siteClip = false;
    }
    this.sites.delete(id);
  }
  private syncSites(g: GameState): void {
    const live = new Set<number>();
    const scaffolds: { b: GameState['buildings'][number]; k: number; cut: number; site: { base: number; top: number } }[] = [];
    for (const b of g.buildings) {
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      const def = BUILDINGS[b.type]!;
      // ruina po zniszczeniu: kupa gruzu i resztki ścian; dopiero odbudowa podnosi budynek z gruzowiska
      const pile = this.ruinPiles.get(b.id);
      const ruinShown = !!b.ruined && !def.wall && !def.gate;
      if (mesh.scale.y !== 1) mesh.scale.y = 1;
      if (b.build && def.line) {
        // częstokół w budowie: niskie rusztowanie przy odcinku, bale stają jeden po drugim (syncWalls)
        const k = 1 - b.build / buildWork(b.type);
        scaffolds.push({ b, k: Math.max(0.1, k), cut: mesh.position.y + 0.7, site: { base: mesh.position.y, top: mesh.position.y + 0.9 } });
        continue;
      }
      // pokazowa budowa: gotowy w symulacji, ale na ekranie wznosi się przez kilka sekund
      const qb = this.quickBuild.get(b.id);
      let k = b.build ? 1 - b.build / buildWork(b.type) : 1;
      if (qb !== undefined && !b.build) {
        const t = (this.time - qb) / 3;
        if (t >= 1 || this.calm) this.quickBuild.delete(b.id); else k = t;
      }
      if (k >= 1 || def.line) {
        if (pile && !b.build) { this.buildingLayer.remove(pile); this.ruinPiles.delete(b.id); }
        if (this.sites.has(b.id)) { this.endSite(b.id); mesh.visible = true; this.roadDust(b.x, b.y, false); }
        continue;
      }
      live.add(b.id);
      if (!this.sites.has(b.id)) this.beginSite(b.id, mesh);
      const site = this.sites.get(b.id)!;
      if (this.lodTick % 30 === 0) this.clipNew(mesh, site);
      if (ruinShown) {
        if (!pile) {
          const fp = footprint(def, b.rot);
          const p2 = rubbleModel(fp.w, fp.h, b.id);
          p2.position.copy(mesh.position);
          p2.scale.set(1, 1.6, 1);
          this.buildingLayer.add(p2);
          this.ruinPiles.set(b.id, p2);
        }
        const pl = this.ruinPiles.get(b.id)!;
        pl.visible = k < 0.7;
        pl.scale.y = 1.6 * (1 - k);
      } else if (pile) { this.buildingLayer.remove(pile); this.ruinPiles.delete(b.id); }
      // najpierw fundament (pierwsze 10% pracy), potem mury i dach
      const cut = site.base + 0.04 + Math.max(0, (k - 0.08) / 0.92) * (site.top - site.base) * 1.01;
      site.plane.constant = cut;
      mesh.visible = true;
      scaffolds.push({ b, k, cut, site });
      if (this.calm) continue;
      const next = this.dustAt.get(b.id) ?? 0;
      if (this.time > next) {
        const fp = footprint(def, b.rot);
        this.roadDust(b.x + Math.floor(Math.random() * fp.w), b.y + Math.floor(Math.random() * fp.h), false);
        this.dustAt.set(b.id, this.time + 0.9 + Math.random() * 1.2);
      }
    }
    for (const id of [...this.sites.keys()]) if (!live.has(id)) this.endSite(id);
    this.syncScaffolds(g, scaffolds);
  }

  /** Rusztowania, pomosty i stosy materiału przy wszystkich placach budowy (dwie siatki instancji) */
  private syncScaffolds(g: GameState, list: { b: GameState['buildings'][number]; k: number; cut: number; site: { base: number; top: number } }[]): void {
    const key = list.map((s) => `${s.b.id}:${Math.round(s.k * 20)}`).join(',');
    if (key === this.siteKey) return;
    this.siteKey = key;
    if (!this.scaffold) {
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95, map: pattern('planks') });
      this.scaffold = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wood, 6000);
      this.siteStones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0).translate(0, 0.35, 0), new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1, flatShading: true }), 600);
      for (const m of [this.scaffold, this.siteStones]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.buildingLayer.add(m); }
    }
    const { width, height } = g.map;
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let n = 0, ns = 0;
    const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = 0): void => {
      if (n >= 6000) return;
      q.setFromAxisAngle(Y, rot);
      this.scaffold!.setMatrixAt(n++, M4.compose(p.set(x, y, z), q, sc.set(sx, sy, sz)));
    };
    for (const { b, k, cut, site } of list) {
      const def = BUILDINGS[b.type]!;
      const fp = footprint(def, b.rot);
      const x0 = b.x - width / 2 - 0.12, z0 = b.y - height / 2 - 0.12, x1 = x0 + fp.w + 0.24, z1 = z0 + fp.h + 0.24;
      const base = site.base;
      // stos desek i kamieni przy rogu działki: maleje, im dalej budowa
      const left = 1 - k;
      for (let i = 0; i < Math.ceil(5 * left); i++) put(x1 + 0.25, base + i * 0.06, z1 - 0.4, 0.7, 0.05, 0.12 + (i % 2) * 0.02, 0.1 * i);
      for (let i = 0; i < Math.ceil(4 * left) && ns < 600; i++) {
        q.setFromAxisAngle(Y, i * 1.7);
        this.siteStones!.setMatrixAt(ns++, M4.compose(p.set(x0 - 0.3 + (i % 2) * 0.22, base + (i > 1 ? 0.12 : 0), z1 - 0.3 - Math.floor(i / 2) * 0.2), q, sc.setScalar(0.2)));
      }
      if (k < 0.08) continue; // fundament: jeszcze bez rusztowań
      // słupy co ~0,8 pola po obwodzie, sięgają nieco ponad bieżącą wysokość
      const poleTop = Math.min(site.top + 0.2, cut + 0.45) - base;
      const posts: [number, number][] = [];
      const nx = Math.max(1, Math.round((x1 - x0) / 0.8)), nz = Math.max(1, Math.round((z1 - z0) / 0.8));
      for (let i = 0; i <= nx; i++) { posts.push([x0 + (x1 - x0) * i / nx, z0], [x0 + (x1 - x0) * i / nx, z1]); }
      for (let i = 1; i < nz; i++) { posts.push([x0, z0 + (z1 - z0) * i / nz], [x1, z0 + (z1 - z0) * i / nz]); }
      for (const [px, pz] of posts) put(px, base, pz, 0.045, poleTop, 0.045);
      // poprzeczki co 0,45 i pomost z desek na bieżącej wysokości (tam, gdzie pracują murarze)
      const levels: number[] = [];
      for (let y = 0.45; y < poleTop - 0.05; y += 0.45) levels.push(y);
      const deck = Math.max(0.3, cut - base - 0.1);
      for (const ly of levels) {
        put((x0 + x1) / 2, base + ly, z0, x1 - x0, 0.03, 0.03); put((x0 + x1) / 2, base + ly, z1, x1 - x0, 0.03, 0.03);
        put(x0, base + ly, (z0 + z1) / 2, 0.03, 0.03, z1 - z0); put(x1, base + ly, (z0 + z1) / 2, 0.03, 0.03, z1 - z0);
      }
      put((x0 + x1) / 2, base + deck, z0 - 0.12, x1 - x0 + 0.2, 0.035, 0.26); put((x0 + x1) / 2, base + deck, z1 + 0.12, x1 - x0 + 0.2, 0.035, 0.26);
      put(x0 - 0.12, base + deck, (z0 + z1) / 2, 0.26, 0.035, z1 - z0); put(x1 + 0.12, base + deck, (z0 + z1) / 2, 0.26, 0.035, z1 - z0);
      // ukośne zastrzały na dwóch bokach i drabina
      const diag = Math.hypot(x1 - x0, poleTop);
      put((x0 + x1) / 2, base, z0, 0.03, diag, 0.03); this.scaffold!.setMatrixAt(n - 1, M4.compose(p.set(x0, base, z0 - 0.02), q.setFromAxisAngle(new THREE.Vector3(0, 0, -1), Math.atan2(x1 - x0, poleTop)), sc.set(0.03, diag, 0.03)));
      put(x1 + 0.3, base, (z0 + z1) / 2, 0.05, poleTop + 0.2, 0.05); put(x1 + 0.3, base, (z0 + z1) / 2 + 0.22, 0.05, poleTop + 0.2, 0.05);
      for (let y = 0.15; y < poleTop; y += 0.18) put(x1 + 0.3, base + y, (z0 + z1) / 2 + 0.11, 0.025, 0.025, 0.24);
    }
    this.scaffold.count = n;
    this.siteStones!.count = ns;
    this.scaffold.instanceMatrix.needsUpdate = true;
    this.siteStones!.instanceMatrix.needsUpdate = true;
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
      mesh.userData.fx = collectFx(mesh, isWindowMat);
      mergeStatic(mesh);
      let top = -99, low = 99;
      const fp = footprint(def, b.rot);
      // pod budynkiem nie rośnie trawa, krzewy ani nie leżą kamyki
      for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) { view.clear(y * width + x); view.noGrass(y * width + x); }
      for (let y = b.y; y <= b.y + fp.h; y++)
        for (let x = b.x; x <= b.x + fp.w; x++) { const hh = view.heightAt(x, y); top = Math.max(top, hh); low = Math.min(low, hh); }
      // budynek siada lekko poniżej najwyższego punktu działki, wtopiony w teren, bez cokołu
      const ground = low + (top - low) * 0.35;
      mesh.position.set(b.x + fp.w / 2 - width / 2, ground, b.y + fp.h / 2 - height / 2);
      mesh.rotation.y = (b.rot * Math.PI) / 2;
      // ziemia wokół domu wydeptana do gołej gleby, najmocniej przy drzwiach
      if (!def.wall && !def.gate && !def.road && def.id !== 'torch') {
        for (let cy = b.y - 1; cy <= b.y + fp.h + 1; cy++) for (let cx = b.x - 1; cx <= b.x + fp.w + 1; cx++) {
          const d = Math.max(b.x - cx, cx - (b.x + fp.w), b.y - cy, cy - (b.y + fp.h), 0);
          view.wear(cx, cy, d === 0 ? 0.7 : 0.25 + (hash2(cx, cy, b.id) & 7) / 30);
        }
        if (b.door >= 0) {
          const dx = b.door % width, dy = Math.floor(b.door / width);
          for (let cy = dy - 1; cy <= dy + 2; cy++) for (let cx = dx - 1; cx <= dx + 2; cx++) view.wear(cx, cy, cx >= dx && cx <= dx + 1 && cy >= dy && cy <= dy + 1 ? 0.8 : 0.45);
        }
      }
      const base = mesh.getObjectByName('base');
      const patch = mesh.getObjectByName('patch');
      if (patch) patch.visible = false; // udeptana ziemia wisiała nad pochyłym terenem; teren pod budynkiem i tak jest czysty
      if (base) base.visible = false; // żadnego podniesienia pod budynkiem
      const preview = mesh.getObjectByName('preview');
      if (preview) preview.visible = false; // bale częstokołu rysuje syncWalls
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
      // budynek postawiony od razu gotowy (tryb deweloperski, rozkaz bota z gotowcem): krótki pokaz budowy
      if (this.builtAt > 0 && !b.build && !def.wall && !def.gate && !def.road && def.id !== 'torch') this.quickBuild.set(b.id, this.time);
    }
    this.builtAt = 1;
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
    this.sun.intensity *= 1 - this.rain * 0.55; // w deszczu słońce przygasa
    const bg = this.scene.background as THREE.Color;
    bg.setHex(a.haze).lerp(tmpColor.setHex(b.haze), k);
    (this.scene.fog as THREE.Fog).color.copy(bg);
    this.view?.setSky(bg);
    // płynne przejście: zmierzch 19:30–21:30, świt 4:30–6:30
    const dusk = Math.max(0, Math.min(1, (hour - 19.5) / 2)), dawn = Math.max(0, Math.min(1, (6.5 - hour) / 2));
    this.night = hour >= 12 ? dusk : dawn;
    setNight(this.night);
    this.grade.uniforms.night!.value = this.night;
    // mgła: gęsta o świcie (4–8), rzadsza w dzień; w deszczu gęstsza
    const mist = Math.max(0, Math.min(1, hour < 4 ? 0 : hour < 6 ? (hour - 4) / 2 : (8.5 - hour) / 2.5));
    const fog = this.scene.fog as THREE.Fog;
    const m = Math.min(1, mist + this.dayMist);
    this.mistLevel = m;
    // pogodny dzień: daleka widoczność; mgła rano i w mgliste dni, gęsta w deszczu
    // mgła liczy się od kamery: zaczyna się zawsze dopiero za ziemią, na którą patrzymy, więc osady nie zakrywa
    const cd = this.walk ? 2 : this.cam.distance;
    fog.near = cd * 0.95 + 70 * (1 - m * 0.8) - this.rain * 20;
    fog.far = Math.max(fog.near + 45, cd + 220 - m * 140 - this.rain * 90);
    // za mgłą i tak nic nie widać: kamera nie rysuje dalej niż mgła (dużo mniej trójkątów w gęstej pogodzie i przy niskim kącie)
    const cam = this.cam.camera, wantFar = fog.far + 15;
    if (Math.abs(cam.far - wantFar) > 8) { cam.far = wantFar; cam.updateProjectionMatrix(); }
    // słońce wędruje ze wschodu na zachód; nocą tę samą drogę robi księżyc
    const dayTime = hour >= 6 && hour < 20;
    const arc = (((dayTime ? hour - 6 : (hour + 4) % 24) / (dayTime ? 14 : 10)) * 0.84 + 0.08) * Math.PI;
    this.sunDir.set(-Math.cos(arc) * 80, 30 + Math.sin(arc) * 70, 40);
  }

  /** Przesuwa słońce i obszar cienia za kamerą; im dalej kamera, tym większy obszar. */
  private aimSun(): void {
    const f = this.focusPoint;
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
    if (on || this.menuNight) for (const b of g.buildings) if (b.lit || this.menuNight) lit.add(b.id);
    for (const mesh of this.buildingMeshes.values()) {
      const torch = mesh.getObjectByName('torch');
      if (!torch) continue;
      // słup stoi cały czas; płomień pali się dopiero, gdy ktoś podejdzie i zapali pochodnię
      const flame = torch.getObjectByName('torchflame');
      // stary stożek zostaje tylko jako znacznik miejsca; płomień rysuje system ognia
      if (flame) flame.visible = false;
    }
    this.handTorches.visible = on;
    // pochodnia w ręce przy spacerze świeci zawsze, gdy jest zapalona (pierwsza lampa z puli)
    const own = this.walk && this.torchOn ? this.lamps[0]! : null;
    if (own) { this.handTip.getWorldPosition(own.position); own.intensity = (this.night > 0.15 ? 7 : 3) * flicker; }
    if (!on) { for (const lamp of this.lamps) if (lamp !== own) lamp.intensity = 0; return; }
    // co kilka klatek wybieramy źródła światła najbliższe środkowi ekranu
    if (this.frameNo++ % 6 === 0) {
      const f = this.focusPoint;
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
        spots.push({ v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 4, k: 0.3 }); // ręczna pochodnia świeci dużo słabiej niż ta na słupie
      }
      for (const s of g.soldiers) {
        if (s.id % 5 !== 0 || s.owner !== this.me) continue;
        const v = new THREE.Vector3(s.px / FP - width / 2, (this.view?.heightAt(s.px / FP, s.py / FP) ?? 0) + 0.8, s.py / FP - height / 2);
        spots.push({ v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 4, k: 0.35 });
      }
      spots.sort((a, b) => a.d - b.d);
      this.lampSpots = spots.slice(0, this.lamps.length);
    }
    this.lamps.forEach((lamp, i) => {
      if (lamp === own) return;
      const spot = this.lampSpots[own ? i - 1 : i];
      lamp.intensity = spot ? spot.k * this.night * 16 * (0.9 + Math.sin(this.time * 9 + i * 2.1) * (this.calm ? 0 : 0.1)) * flicker : 0;
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
      if (b.hp < prevHp) { this.shake.set(b.id, 0.25); this.burnUntil.set(b.id, this.time + 50); }
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
        // pożar trwa tylko po świeżych ciosach; gdy nikt dalej nie atakuje, ogień przygasa i znika (budynek zostaje osmalony)
        fire.visible = hurt > 0.4 && this.time < (this.burnUntil.get(b.id) ?? 0);
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

  /** Podgląd szyku: półprzezroczyste kółka na polach, na których staną żołnierze (null chowa podgląd) */
  setFormationPreview(tiles: number[] | null): void {
    if (!this.state || !this.view) return;
    const { width, height } = this.state.map;
    const m = new THREE.Matrix4();
    let n = 0;
    for (const t of tiles ?? []) {
      if (n >= MAX_UNITS) break;
      const x = t % width, y = (t - x) / width;
      m.makeTranslation(x + 0.5 - width / 2, this.view.heightAt(x + 0.5, y + 0.5) + 0.04, y + 0.5 - height / 2);
      this.ghostRings.setMatrixAt(n++, m);
    }
    this.ghostRings.count = n;
    this.ghostRings.instanceMatrix.needsUpdate = true;
  }

  /** Prawy przycisk rysuje szyk zamiast obracać kamerę (gdy zaznaczone jest wojsko) */
  set lockRotate(v: boolean) { this.cam.lockRotate = v; }

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
    let n = 0, rings = 0, dots = 0, torches = 0;
    // stojący oddział zbija się ciaśniej: każdy przysuwa się do środka swojej grupy (tylko wygląd, pola w symulacji bez zmian)
    const pull = new Map<number, [number, number]>();
    const still = g.soldiers.filter((x) => !x.path.length && !x.up && !x.target && x.goal < 0);
    // oddział z jednego rozkazu ściąga się do swojego środka równo, więc linia zostaje linią, a blok blokiem
    const mid = new Map<number, [number, number, number]>();
    for (const a of still) if (a.grp) { const c = mid.get(a.grp) ?? [0, 0, 0]; c[0] += a.px; c[1] += a.py; c[2]++; mid.set(a.grp, c); }
    for (const a of still) {
      const c = a.grp ? mid.get(a.grp) : undefined;
      if (c && c[2] > 1) { pull.set(a.id, [(c[0] / c[2] - a.px) / FP * 0.3, (c[1] / c[2] - a.py) / FP * 0.3]); continue; }
      let sx = 0, sy = 0, k = 0;
      for (const b of still) if (b.owner === a.owner && Math.abs(b.px - a.px) < 3 * FP && Math.abs(b.py - a.py) < 3 * FP) { sx += b.px; sy += b.py; k++; }
      if (k > 1) pull.set(a.id, [(sx / k - a.px) / FP * 0.45, (sy / k - a.py) / FP * 0.45]);
    }
    const torchesOn = this.night > 0.15;
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
      // po dojściu obraca się w kierunek szyku (płynnie, nie skokiem)
      if (!walking && !foe && !wall && s.face !== undefined && !s.path.length) {
        let diff = s.face * (Math.PI / 4) - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > 0.01) { heading += this.calm ? diff : diff * 0.15; this.facing.set(s.id, heading); }
      }
      const swing = walking ? Math.sin(st.phase) * 0.5 : 0;
      const udef = UNITS[s.kind]!;
      const ranged = !!udef.range;
      const striking = (!!foe || !!wall) && !walking && (ranged ? s.cd > udef.cooldown - 8 : s.cd > 6);
      // łucznik na wieży stoi na pomoście
      const lift = s.up ? 1.95 : 0;
      // przesunięcie do środka grupy narasta i znika płynnie, więc po dojściu nikt nie „doskakuje” do kolegów
      const want = pull.get(s.id) ?? [0, 0];
      const cur = this.pullNow.get(s.id) ?? [0, 0];
      const k = this.calm ? 1 : 0.06;
      cur[0] += (want[0] - cur[0]) * k; cur[1] += (want[1] - cur[1]) * k;
      this.pullNow.set(s.id, cur);
      const px = fx + cur[0], pz = fy + cur[1];
      const y = view.heightAt(px, pz) + lift;
      t.position.set(px - width / 2, y + (walking ? Math.abs(Math.cos(st.phase)) * 0.02 : 0), pz - height / 2);
      // strzał: cooldown właśnie wskoczył na pełną wartość — leci strzała do celu
      const pc = this.lastCd.get(s.id) ?? 0;
      if (ranged && (foe || wall) && s.cd > pc && !this.calm && this.arrows.length < 256) {
        let tx: number, ty: number, th: number;
        if (foe) { tx = foe.px / FP; ty = foe.py / FP; th = foe.up ? 2.3 : 0.4; }
        else { const fp = footprint(BUILDINGS[wall!.type]!, wall!.rot); tx = wall!.x + fp.w / 2; ty = wall!.y + fp.h / 2; th = 0.8; }
        this.arrows.push({ from: new THREE.Vector3(fx - width / 2, y + 0.5, fy - height / 2), to: new THREE.Vector3(tx - width / 2, view.heightAt(tx, ty) + th, ty - height / 2), t: 0 });
        this.sfxAt('swing', t.position.x, t.position.z, `a${s.id}`, 0.3, 0.5);
      }
      this.lastCd.set(s.id, s.cd);
      t.rotation.set(0, heading, 0);
      t.scale.setScalar(1.08 * FIG);
      t.updateMatrix();
      t.scale.setScalar(1);
      if (striking && !this.calm) {
        // zamach włócznią i uderzenie: w człowieka głucho, w mur jak w drewno
        this.sfxAt('swing', t.position.x, t.position.z, s.id, 1.1, 0.6);
        if (s.cd > 10) this.sfxAt(wall ? 'plank' : Math.random() < 0.3 ? 'clang' : 'hit', t.position.x, t.position.z, `h${s.id}`, 1.1, 0.8);
      }
      if (torchesOn && s.id % 5 === 0 && s.owner === this.me && torches < 256) { this.soldierTorches.setMatrixAt(torches++, t.matrix); this.pushHandFlame(t.matrix, -0.17); }
      if (ranged) { this.archers.set(n, t.matrix, swing, striking, TEAM_COLORS[g.players[s.owner]?.team ?? 0] ?? 0x888888, s.id); this.spearmen.set(n, ZERO, 0, false, 0, s.id); }
      else { this.archers.set(n, ZERO, 0, false, 0, s.id); this.spearmen.set(n, t.matrix, swing, striking, TEAM_COLORS[g.players[s.owner]?.team ?? 0] ?? 0x888888, s.id); }
      let pos = this.soldierPos.get(s.id);
      if (!pos) { pos = new THREE.Vector3(); this.soldierPos.set(s.id, pos); }
      // kółko i ramka zaznaczenia idą za figurą (z dociągnięciem do grupy), nie za polem z symulacji
      pos.set(px - width / 2, y, pz - height / 2);
      if (this.soldierSel.has(s.id)) {
        m.makeTranslation(pos.x, y + 0.03, pos.z); this.ringsBack.setMatrixAt(rings, m); this.rings.setMatrixAt(rings++, m);
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
    this.archers.finish(n);
    this.flyArrows();
    this.soldierTorches.count = torches;
    this.soldierTorches.instanceMatrix.needsUpdate = true;
    // ciała: leżą na ziemi, z czasem ciemnieją i zapadają się (rozkład trwa ok. 10 minut gry)
    let c = 0;
    const lay = new THREE.Quaternion(), sc = new THREE.Vector3();
    let pc = 0;
    for (const body of g.corpses) {
      if (c >= MAX_UNITS) break;
      const fx = body.px / FP, fy = body.py / FP;
      const age = Math.min(1, (g.tick - body.at) / 6000);
      const y = view.heightAt(fx, fy);
      lay.setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.08, ((body.id * 2.39) % 6.28), 0, 'YXZ'));
      sc.set(1.05 * FIG, 1.05 * FIG, 1.05 * FIG * (1 - age * 0.55));
      m.compose(new THREE.Vector3(fx - width / 2, y + 0.06 - age * 0.04, fy - height / 2), lay, sc);
      const team = TEAM_COLORS[g.players[body.owner]?.team ?? 0] ?? 0x888888;
      const rot = new THREE.Color(team).lerp(new THREE.Color(0x3b3226), 0.3 + age * 0.6).getHex();
      if (body.kind < 0) { this.peasantBodies.set(pc++, m, 0.3, false, rot, body.id); this.bodies.set(c, ZERO, 0, false, rot, body.id); }
      else this.bodies.set(c, m, 0.3, false, rot, body.id);
      m.compose(new THREE.Vector3(fx - width / 2, y + 0.02, fy - height / 2), new THREE.Quaternion(), sc.set(1 + age * 0.4, 1, 1 + age * 0.4));
      this.stains.setMatrixAt(c, m);
      c++;
    }
    this.bodies.finish(c);
    this.peasantBodies.finish(pc);
    this.stains.count = c;
    this.stains.instanceMatrix.needsUpdate = true;
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringsBack.count = rings;
    this.ringsBack.instanceMatrix.needsUpdate = true;
    // lekki puls, żeby wzrok od razu łapał zaznaczonych
    (this.rings.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.sin(this.time * 4) * 0.15;
  }

  private syncUnits(g: GameState, view: TerrainView, alpha: number): void {
    // karczmy z karczmarzem: wieczorem schodzą się do nich ludzie
    const hourNow = this.menuNight ? 23 : clockAt(g.tick).hour;
    this.evening = hourNow >= 18 && hourNow < 23.5;
    this.taverns.clear();
    for (const b of g.buildings) if (BUILDINGS[b.type]!.id === 'tavern' && b.worker && !b.build && !this.taverns.has(b.owner)) this.taverns.set(b.owner, b);
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
      // wieczorem (18–23) połowa bezrobotnych z obozowiska siedzi przed karczmą przy kuflu, a jeden się zatacza
      const camp = u.phase === Phase.Idle && still ? this.camps.get((u.py >> 8) * width + (u.px >> 8)) : undefined;
      const inn = camp && camp.owner === u.owner && this.evening && u.id % 2 === 0 ? this.taverns.get(u.owner) : undefined;
      if (inn) {
        const mesh = this.buildingMeshes.get(inn.id);
        const turn = (inn.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const slot = (u.id >> 1) % 6;
        const drunk = slot === 5;
        // trzech w izbie przy stole (widać po zdjęciu dachu), dwóch na ławie przed karczmą, jeden pijak przed wejściem
        const SEATS: [number, number, number][] = [[0.2, 0.05, -Math.PI / 2], [0.85, 0.05, Math.PI / 2], [-0.35, -0.5, 0], [-0.8, 0.72, 0], [-0.45, 1.18, Math.PI]];
        const seat = SEATS[Math.min(slot, 4)]!;
        let lx = seat[0], lz = seat[1];
        if (drunk) { lx = 0.1 + Math.sin(this.time * 0.6 + u.id) * 0.5; lz = 1.5 + Math.cos(this.time * 0.45) * 0.25; }
        const wx = lx * cosT + lz * sinT, wz = -lx * sinT + lz * cosT;
        t.position.set(inn.x + 1.5 + wx - width / 2, (mesh?.position.y ?? 0) + 0.02, inn.y + 1 + wz - height / 2);
        t.rotation.set(drunk ? Math.sin(this.time * 2.3 + u.id) * 0.25 : 0, drunk ? this.time * 0.7 : seat[2] + turn, drunk ? Math.cos(this.time * 1.9) * 0.2 : 0);
        swing = drunk ? Math.sin(this.time * 3) * 0.4 : Math.max(0, Math.sin(this.time * 1.3 + u.id * 2)) * -1.2;
        if (slot === 0 && !this.calm) this.lutePlay(t.position.x, t.position.z);
      } else if (camp && camp.owner === u.owner) {
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
      // odgłosy pracy z miejsca, gdzie pracuje
      if (!this.calm && u.job) {
        const jt = jobs.get(u.job);
        const jid = jt ? BUILDINGS[jt.type]!.id : '';
        if (u.phase === Phase.WorkingSite) {
          if (jid === 'woodcutter') this.sfxAt('chop', t.position.x, t.position.z, u.id, 0.9);
          else if (jid === 'quarry' || jid === 'mine') this.sfxAt('mine', t.position.x, t.position.z, u.id, 1.0);
        } else if (u.phase === Phase.Working) {
          if (jid === 'woodcutter' || jid === 'poleturner') this.sfxAt('plank', t.position.x, t.position.z, u.id, 1.3, 0.7);
          else if (jid === 'mill') this.sfxAt('creak', t.position.x, t.position.z, u.id, 3.5, 0.8);
        }
      }
      // wilk tuż obok: chłop staje do niego twarzą i macha rękami
      if (!this.calm && g.wolves.length) for (const w of g.wolves) {
        if ((w.px - u.px) ** 2 + (w.py - u.py) ** 2 > (1.5 * FP) ** 2) continue;
        t.rotation.set(0, Math.atan2(w.px - u.px, w.py - u.py), 0);
        swing = Math.sin(this.time * 14 + u.id) * 1.4;
        if ((u.hp ?? 30) < 30) this.sfxAt('hit', t.position.x, t.position.z, `bite${u.id}`, 0.9, 0.8);
        break;
      }
      const hammering = u.phase === Phase.Repairing;
      if (hammering) {
        // robotnicy rozstawiają się wokół budowy, twarzą do ścian, a nie tłoczą przy drzwiach
        const site = g.buildings.find((b) => b.id === u.target);
        if (site) {
          const fp = footprint(BUILDINGS[site.type]!, site.rot);
          const a = (u.id * 2.39996) % (Math.PI * 2);
          const cx = site.x + fp.w / 2, cy = site.y + fp.h / 2;
          const rx = fp.w / 2 + 0.25, ry = fp.h / 2 + 0.25;
          const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
          t.position.set(px - width / 2, view.heightAt(px, py), py - height / 2);
          t.rotation.set(0, Math.atan2(cx - px, cy - py), 0);
        }
        swing = this.calm ? 0 : -0.6 - Math.abs(Math.sin(this.time * 7 + u.id)) * 1.3;
        if (!this.calm) this.sfxAt('plank', t.position.x, t.position.z, u.id, 0.45);
      }
      this.unitSpots.push({ id: u.id, x: t.position.x, z: t.position.z });
      this.unitY.set(u.id, t.position.y);
      if (u.id === this.selectedUnit) { this.selection.scale.set(0.5, 0.5, 1); this.selection.position.set(t.position.x, t.position.y + 0.05, t.position.z); this.selection.visible = true; }
      t.scale.setScalar(FIG);
      t.updateMatrix();
      this.rods.setMatrixAt(i, fishing ? t.matrix : ZERO);
      if (hammering) {
        // ramię obraca się w barku tak jak prawa ręka postaci (kąt = swing * 0.8)
        this.armM.makeRotationX(swing * 0.8).setPosition(0.135, 0.45, 0);
        this.hammers.setMatrixAt(i, this.armM.premultiply(t.matrix));
      } else this.hammers.setMatrixAt(i, ZERO);
      const wood = u.carryRes === WOOD;
      // kłodę ciągnie tylko drwal z lasu; włóczniarz niesie ze składu zwykłe deski
      const jb = u.job ? jobs.get(u.job) : undefined;
      const log = wood && u.phase === Phase.ToHome && !!jb && BUILDINGS[jb.type]!.production?.site === Terrain.Forest;
      // nocą idący niosą pochodnię (ci z ładunkiem mają zajęte ręce)
      const torchOn = this.night > 0.15 && !still && u.carryRes < 0;
      if (torchOn) { this.handTorches.setMatrixAt(i, t.matrix); this.pushHandFlame(t.matrix, 0.17); } else this.handTorches.setMatrixAt(i, ZERO);
      this.figures.set(i, t.matrix, swing, u.carryRes >= 0 && !log, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888, u.id);
      // z lasu do chaty niesie kłodę, z chaty do składu gotowe deski
      t.scale.setScalar(log ? FIG : 0);
      t.updateMatrix();
      this.logs.setMatrixAt(i, t.matrix);
      t.scale.setScalar(wood && !log ? FIG : 0);
      t.updateMatrix();
      this.planks.setMatrixAt(i, t.matrix);
      // każdy surowiec ma własny wygląd: kosz jabłek, bochenki, snop, worek, blok, sztaby
      for (const [res, mesh] of this.loads) {
        t.scale.setScalar(u.carryRes === res ? FIG : 0);
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
      t.scale.setScalar(FIG);
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
    this.hammers.count = n;
    this.hammers.instanceMatrix.needsUpdate = true;
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

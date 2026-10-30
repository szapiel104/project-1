import { cloneMaterial } from './matclone';
import { boulderAt } from '../sim/systems/boulders';
import { PYRE_TICKS } from '../sim/systems/cremation';
import { poseOnRoute, routeTime } from './minepath';
import { PROCESS_TICKS } from '../sim/systems/emergencywood';
import { mineWalkTicks } from '../data/minewalk';
import { named, namedTick, remember } from './named';
import { brazierModel, mineLevelModel } from './buildings';
import { touch } from './touch';
import * as THREE from 'three';
import { initKtx } from './ktx';
import { MeshBVH } from 'three-mesh-bvh';
import { GL_DEBUG, glSection, watchLoading, watchRenderer } from '../debug/errlog';
import { hash2 } from '../sim/rng';
import { TOWER_RANGE, UNITS } from '../data/units';
import { RULES } from '../data/rules';
import { loop3d, musicPlaying, play3d, playAt, pluck, setListener, updateLoops, type WorldSound } from '../audio/sfx';
import { TEST } from '../testmode';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, brazierHost, NO_TORCH, footprint, isStoneTower, isTower, towerBonus, workArea } from '../data/buildings';
import { crewOf } from '../sim/systems/workers';
import { mageKindOf } from '../sim/systems/plague';
import { SpellLayer } from './spells';
import { BoltLayer } from './bolts';
import { saplingGrowth } from '../sim/systems/forestry';
import { Clutter } from './clutter';
import { Chips } from './chips';
import { Clouds } from './clouds';
import { Flames, flameSprite } from './flames';
import { Blaze, burnBox } from './blaze';
import { ScorchLayer } from './scorch';
import { WolfLayer } from './wolves';
import { PEASANT_HP, WOLF_HP } from '../sim/systems/wolves';
import { ArrowLayer, MAX_ARROWS } from './arrows';
import { RallyFlags, TowerIcons } from './rally';
import { GateMotion } from './gates';
import { SkyDome } from './sky';
import { DustFx } from './dust';
import { Braziers, placeBrazier } from './braziers';
import { RubbleLayer } from './rubble';
import { GraveLayer } from './graves';
import { BEARER_GAP } from '../sim/systems/bearers';
import { PileLayer } from './piles';
import { WearLayer } from './damage';
import { RepairLayer } from './repairs';
import { WallLayer } from './walls';
import { SiteLayer } from './sites';
import { TorchGlow } from './torchglow';
import { CrowLayer } from './crows';
import { ForestEyes } from './foresteyes';
import { PuddleLayer } from './puddles';
import { SpawnFx } from './spawnfx';
import { KEEP_GATE, KEEP_SIZE, keepRoom, keepTile, keepWalk } from '../data/keep';
import { wallBetween } from '../sim/path';
import { Ambience, collectFx, type BuildingFx, type FxSource } from './ambience';
import { isWetMat, setWetBuildings } from './buildings';
import { attachLod, LOD_STEPS, prepareLod, showLod, lodStats, type BuildingLod } from './lod';
import { cloudShade, setCloudShadows } from './ground';
import { cat } from './cat';
import { tx } from '../i18n';
import { GearPool } from './gearpool';
import { propGeometry, propMaterial } from './props';
import { enableShadowLayer } from './shadowlayer';
import { animateBuilding, isWindowMat, roadMaterials, setNight, STONE_WALL_TOP, TOWER_TOP, WATCH_TOWER_TOP, setStockFill, torchModel } from './buildings';
import { RESOURCES, RESOURCE_DEFS } from '../data/resources';
import { Terrain } from '../data/terrain';
import { BANDIT_COLOR, TEAM_COLORS } from '../data/teams';
import { applyCrest, defaultCrest } from './banners';
import { BloodStains } from './blood';
import { BloodFx } from './bloodfx';
import { BreathFx } from './breath';
import type { Stick } from './arrows';
import { FORECOURT, FP, Phase, TICKS_PER_SECOND, buildingById, type GameState } from '../sim/state';
import { towerEntry, towerUnder } from '../sim/systems/stonewalls';
import { GREAT_FLIGHT } from '../sim/systems/greatspell';
import { CLIMB_TICKS, fireArrow, high, peasantWeapon } from '../sim/systems/army';
import { firstBlock } from '../sim/systems/sight';
import { partsGeometry, peasantGear, toolMaterials } from './gear';
import { clockAt, rainAt } from '../sim/clock';
import { COLD, weatherOf, yearPos } from '../sim/weather';
import { applySeason, SEASON_U, SnowTrails } from './season';
import { Footprints } from './footprints';
import { maxHp } from '../sim/systems/placement';
import { StrategyCamera } from './camera';
import { proceduralModels, type ModelFactory } from './models';
import { kindsOf, type TreeKind } from './forest';
import { Figures } from './peasants';
import { Standards } from './standards';
import { bearerIds } from '../sim/systems/standards';
import { Crowd, idle } from './motion';
import { Village } from './village';
import { Family, yardModel } from './family';
import { createLoads, tint, carryArms, plankBundle, ON_SHOULDER, loadMaterials } from './loads';
import { FireCrewFx } from './firecrew';
import { DRAW as FIRE_DRAW } from '../sim/systems/fire';
import { HAZE, buildTerrain, buildTerrainAsync, type TerrainView } from './terrain';
import { normal, pattern } from './textures';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { N8AOPass } from 'n8ao';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { MaterialQuality, makeEnvironment, msaaSamples, sharpenPass, type AaMode } from './postfx';
import { spearThrust, bowShot, deathKind, swordCombo, axeChop } from './combatanim';
import { sadMaterial, sickMaterial, noWorkerMaterial } from './marks';
import { MERGE_IN, BATCH_LAYER, mergeStatic } from './merge';
/** Nazwane grupy budynku rysowane razem z innymi budynkami tego samego rodzaju (syncBatches): pochodnia, dalekie wersje */
const BATCH_ALSO = /^(torch|lod\d+)$/;
import { Precompiler } from './precompile';
import { KEEP_MODEL, RAM_MODEL, SHRINE_SPOTS, CAMP_SEATS, KEEP_SOLID, KEEP_FLOOR, KEEP_WALL, KEEP_HALF, type WalkModel, WALK_MODELS, MINE_SPOTS, OREMINE_T, OREMINE_WALK, MINE_LEVEL, MINE_LEVEL_SPOTS, mineRoute, OREMINE_PROD, inRect, MINE_AT, TAVERN_SEATS, walkFoot, TAVERN_FLOOR } from './walkmodels';
import { createRenderer } from './glcontext';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
/** Promień (w polach mapy), w którym spacerem widać wnętrza budynków przez drzwi i okna */
const WALK_SEE_R = 9;
/** Godzina na ekranie tytułowym: późne popołudnie, ciepłe światło przed zachodem */
const MENU_HOUR = 17.6;

export interface TileRef { x: number; y: number }
const FIRE_A = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
const FIRE_B = new THREE.MeshBasicMaterial({ color: 0xffd25a });

/** door: pole wyjścia (indeks pola mapy) liczone tak jak przy stawianiu (findDoor), -1 albo brak = budowla bez wejścia */
export interface Ghost { x: number; y: number; w: number; h: number; ok: boolean; id: string; team: number; rot: number; door?: number }

const MAX_UNITS = 2048;
/** Ręka z pochodnią uniesiona w przód (tak samo w tools/models/tools.py) i koniec pochodni w układzie ręki */
const TORCH_ARM = -0.55;
/** Ile sekund kopacz wyciąga kilof z pleców, zanim zacznie kopać */
const PICK_DRAW = 0.75;
/** Część wyciągania, po której dłoń chwyta stylisko i kilof przechodzi z pleców do ręki */
const PICK_GRAB = 0.42;
/** Ręka rybaka z wędką wyciągnięta w przód (tak samo w tools/models/tools.py) */
const FISH_ARM = -0.9;
/** Buntownik wymachuje widłami nad głową (tools.py: FORK_ARM — przy tym kącie widły stoją prawie pionowo) */
const FORK_ARM = -2.3;
/** Oburęczny chwyt kilofa i siekiery: o tyle ręce schodzą się do środka (dłonie razem na stylisku) */
const TWO_HAND = 0.5;
const TORCH_TIP = new THREE.Vector3(0, -0.19 + Math.cos(0.55) * 0.34, Math.sin(0.55) * 0.34);
/** Środek wiadra w układzie postaci (wisi z opuszczonej prawej dłoni) */
const BUCKET_C = new THREE.Vector3(0.15, 0.15, 0.02);
/** Skala ludzi względem budynków i drzew: drzwi chaty mają być wyższe od człowieka */
const FIG = 0.76;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Pochodnia łucznika wbita w ziemię: skala pochodni z rąk chłopów (jak w ręce postaci) i wysokość płomienia nad ziemią */
const TORCH_K = FIG, STICK_TIP = 0.36 * TORCH_K;
/** Znacznik „niesie ciało” w carryRes (jak CORPSE w workers.ts: pierwszy numer poza listą surowców) */
const CORPSE_LOAD = RESOURCES.length;
/** Odchylenie rąk niosących trumnę od pionu (rad): przedni ma dłonie za sobą, tylny przed sobą — w końcach drągów */
const BIER_ARM = 0.3;
/** Miejsca w zamku z modelu (tools/models/keep.py, układ modelu: środek działki, przód z bramą = +z) */
const CASTLE = { floorY: 0.15, walkY: 1.71, throneZ: -4.16, seatY: 0.34 };
/** O ile podnosi się krata bramy zamku (z modelu) */
const KEEP_PORT_LIFT = (KEEP_MODEL as unknown as { portLift?: number }).portLift ?? 0.86;
/** Wierzch nawierzchni drogi nad ziemią (0 brak, 1 ścieżka, 2 bruk, 3 dyle: bale leżą na 0,05 i mają ok. 0,05 grubości) */
const ROAD_TOP = [0, 0.025, 0.045, 0.1];
const tmpColor = new THREE.Color();
/** Szyk „ścisk”: o ile żołnierz (i jego kropka celu) przysuwa się do środka oddziału — ramię w ramię */
const TIGHT = 0.6;
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
const ALE = RESOURCES.indexOf('ale');
const LADDER_RI = RESOURCES.indexOf('ladder');
const FISHER = BUILDINGS.findIndex((b) => b.id === 'fisher');

/** Budynki, w których pali się w piecu: z komina idzie dym */
/** Mała pochodnia zamiast słupa przy wejściu (x, z w układzie budynku, skala): rudera z desek dostaje niski kij przy drzwiach */
const SMALL_TORCH: Record<string, [number, number, number]> = { shack: [0.7, 0.5, 0.5], shackL: [0.72, -0.02, 0.5] };
const SMOKY = new Set(['armory', 'house', 'tent', 'bakery', 'brewery', 'tavern', 'keep', 'barracks', 'engineers', 'fletcher', 'poleturner', 'carpenter', 'woodcutter', 'smithy', 'armorer']);

/**
 * Renderer: czyta stan symulacji, nigdy go nie zmienia. Samodzielne części obrazu są w osobnych plikach
 * (strzały, mury, place budowy, gruz, niebo, kurz, koksowniki, bramy, znaczniki wojska, poświata pochodni,
 * wilki, kruki, kałuże…) — tu zostaje to, co je łączy: kamera, światło, budynki, ludzie i żołnierze.
 */
export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: StrategyCamera;
  /** Obraz przechodzi przez cieniowanie zagłębień (AO): ciemniejsze kąty, styki ścian z ziemią, szczeliny */
  private composer!: EffectComposer;
  private ao!: N8AOPass;
  private fxaa!: FXAAPass;
  private smaa!: SMAAPass;
  private sharpen!: ShaderPass;
  private matQ!: MaterialQuality;
  private envTex!: THREE.Texture;
  /** Odbicia otoczenia (mapa otoczenia jak w podglądzie modeli) */
  private envOn = true;
  /** Bieżące MSAA (próbki × 2 + AO), -1 = jeszcze nie ustawione */
  private msaa = -1;
  private matSweep = 0;
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
  private bloom!: UnrealBloomPass;
  private sanitize!: ShaderPass;
  private rain = 0;
  private hammers!: GearPool;
  private spades!: GearPool;
  private guardsFig!: Figures;
  /** Słomiane posłania pod śpiącymi bez dachu nad głową */
  private bedrolls!: GearPool;
  /** Siekiera drwala i kilof kopacza: w prawej dłoni, obracane w barku jak młotek */
  private axes!: GearPool;
  private picks!: GearPool;
  /** Saperzy z poprzedniej klatki wojska: rysuje ich pula chłopów (ta sama postać, kilof i ładunek co u kopacza) */
  private sapperDraw: { m: THREE.Matrix4; swing: number; walking: boolean; work: boolean; carry: number; team: number; id: number }[] = [];
  /** Broń chłopa: maczuga w dłoni w walce, kilof na plecach i maczuga u pasa na co dzień */
  private clubs!: GearPool;
  /** Widły buntowników spod bramy (bunt głodowy) */
  private forks!: GearPool;
  private backPicks!: GearPool;
  private beltClubs!: GearPool;
  private soldierTorches!: THREE.InstancedMesh;
  /** Kulki leczenia krążące wokół leczonych przez magów (bez cieni, jasne, mieszane addytywnie) */
  private healOrbs = (() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 256);
    m.count = 0; m.visible = false; m.frustumCulled = false; m.userData.noCull = true;
    return m;
  })();
  private orbM = new THREE.Matrix4();
  private orbC = new THREE.Color();
  private peasantBodies!: Figures;
  /** Polegli łucznicy i strażnicy leżą we własnych zbrojach (nie w zbroi włócznika) */
  private archerBodies!: Figures;
  private guardBodies!: Figures;
  private menAtArms!: Figures;
  private sappersFig!: Figures;
  private banditsFig!: Figures;
  private banditBodies!: Figures;
  private sapperBodies!: Figures;
  /** Chorążowie z proporcami (po jednym w oddziale) */
  private standards!: Standards;
  /** Chorążowie z poprzedniej klatki i polegli chorążowie (numer ciała) — przy ich ciałach leży przewrócony proporzec */
  private lastBearers = new Set<number>();
  private fallenBearers = new Set<number>();
  private manAtArmsBodies!: Figures;
  private archers!: Figures;
  /** Wieże, których łucznicy właśnie strzelają: id → czas ostatniego strzału (znaczek ataku nad wieżą) */
  /** Znaczki strzelających wież i flagi zbiórki (src/render/rally.ts) */
  private towerIcons = new TowerIcons(this.scene);
  /** Flagi zbiórki koszar gracza (drzewce z chorągwią w jego barwach) */
  private rallyFlags = new RallyFlags(this.scene);
  /** Herby graczy na chorągwiach (numer herbu z konta; brak = stały herb z numeru gracza) */
  private crests: (number | null)[] = [];
  /** Wyjście nowego żołnierza z koszar: złote iskry w górę, błysk i „+1” (tylko wygląd) */
  /** Miejsce łucznika na wieży w wyglądzie (płynne przejścia między pozami) */
  private towerPose = new Map<number, [number, number]>();
  /** Na jakim poziomie stał żołnierz w poprzedniej klatce (0 = ziemia, 1 = korona muru, inaczej wieża pod nim: id + 1) */
  private levelOf = new Map<number, number>();
  /** Gdzie żołnierz był narysowany w poprzedniej klatce (świat): strzały celują w obrazek, także na wieży, murze i murach zamku */
  private drawnAt = new Map<number, THREE.Vector3>();
  /** Strzały w locie (src/render/arrows.ts) */
  private arrows = new ArrowLayer(this.scene,
    (kind, at) => this.playHere(kind, at.x, at.z, 1, at.y),
    (at) => this.playHere('arrowfly', at.x, at.z, 1, at.y));
  private lastCd = new Map<number, number>();
  /** Ostatnia chwila strzału każdego strzelca (Soldier.shot), żeby strzała wyleciała raz, w chwili wypuszczenia */
  private lastShot = new Map<number, number>();
  /** Mag: tick ostatniego wielkiego czaru, który obraz już pokazał */
  private lastGreat = new Map<number, number>();
  /** Ile ciosów zadał żołnierz (do kombinacji mieczem: cięcie z góry, z lewej, z prawej, obrót) */
  private hits = new Map<number, number>();
  /** Trafienia: kiedy żołnierz ostatnio oberwał (odrzut do tyłu) i ile miał zdrowia */
  private soldierHp = new Map<number, number>();
  private hitAt = new Map<number, number>();
  /** Kierunek, w którym patrzył poległy w chwili śmierci (pada do tyłu, nie obraca się w locie) */
  private fallYaw = new Map<number, number>();
  /** Do dźwięków: kiedy chłop zaczął uciekać, przed kim stanął, którzy polegli już krzyknęli */
  private fledSeen = new Map<number, number>();
  private foeSeen = new Map<number, number>();
  private screamed = new Set<number>();
  /** Kiedy żołnierz może znów zabrzmieć ciosem (szczęk, tarcza, ciało) */
  private blowAt = new Map<number, number>();
  /** Kierunek „w prawo” ekranu dla panoramy dźwięku */
  private earRight = new THREE.Vector3();
  private taverns = new Map<number, GameState['buildings'][number]>();
  private innDoors = new Map<number, GameState['buildings'][number]>();
  /** Drzwi kapliczek: wieczorem modlący się klęczą przy klęczniku i stoją za nimi ze spuszczonymi głowami */
  private shrineDoors = new Map<number, GameState['buildings'][number]>();
  /** Rynki po id: kupcy stoją za ladami kramów (Michał 30.10.2026: „ktoś niech stoi w dzień na stoisku”) */
  private markets = new Map<number, GameState['buildings'][number]>();
  private luteAt = 0;
  /** Kto pił dziś w karczmie (wraca potem chwiejnym krokiem); czyszczone rano */
  private drank = new Set<number>();
  private murmurAt = 0;
  private luteNote = 0;
  /** Lutnia przed karczmą: prosta melodia nuta po nucie, słyszalna z bliska */
  private lutePlay(x: number, z: number): void {
    if (this.time < this.luteAt) return;
    // gdy gra muzyka z pliku, lutni nie słychać (dwie melodie w różnych tonacjach naraz to kakofonia)
    if (musicPlaying()) { this.luteAt = this.time + 1; return; }
    const tune = [0, 3, 5, 7, 5, 3, 0, -2, 0, 3, 7, 10, 7, 5, 3, 0];
    const len = [0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.9];
    const i = this.luteNote++ % tune.length;
    this.luteAt = this.time + len[i]!;
    // jak inne dźwięki świata: odległość od punktu, na który patrzy kamera, plus „wysokość ucha” z oddalenia
    const f = this.focusPoint, d = Math.hypot(x - f.x, z - f.z, this.walk ? 0 : this.cam.distance * 0.42);
    pluck(tune[i]!, Math.max(0, Math.min(1, 1 - (d - 5) / 18)));
  }
  private pullNow = new Map<number, [number, number]>();
  private armM = new THREE.Matrix4();
  private gripE = new THREE.Euler();
  private armS = new THREE.Matrix4();
  private armV = new THREE.Vector3();
  private soundAt = new Map<string, number>();
  /** Dźwięk z miejsca na mapie, nie częściej niż co `every` sekund dla danego źródła; głośność z odległości od środka ekranu */
  private sfxAt(kind: WorldSound, x: number, z: number, key: string | number, every: number, gain = 1, y?: number): void {
    const k = `${kind}${key}`;
    const due = this.soundAt.get(k) ?? 0;
    if (this.time < due) return;
    this.soundAt.set(k, this.time + every * (0.85 + Math.random() * 0.3));
    if (due === 0) return; // pierwszy raz tylko ustawiamy zegar, żeby wszystkie źródła nie ruszyły naraz
    this.playHere(kind, x, z, gain, y);
  }

  /** Krzyki naraz: najwyżej trzy na sekundę w całej grze, żeby ucieczka tłumu nie zlała się w jeden wrzask */
  private voiceTimes: number[] = [];
  /** Dźwięk jednorazowy z miejsca w świecie (krzyk, okrzyk): od razu, bez zegara powtórek */
  private voiceAt(kind: WorldSound, x: number, z: number, gain = 1): void {
    this.voiceTimes = this.voiceTimes.filter((t) => this.time - t < 1);
    if (this.voiceTimes.length >= 3) return;
    this.voiceTimes.push(this.time);
    this.playHere(kind, x, z, gain);
  }

  /** Dźwięk z miejsca w świecie: odległość, panoramę i stłumienie z oddali liczy silnik (audio/engine.ts) względem słuchacza.
   *  `y` podajemy, gdy źródło nie stoi na terenie (np. górnik w sztolni pod mapą) */
  private playHere(kind: WorldSound, x: number, z: number, gain = 1, y?: number, rate?: number): void {
    play3d(kind, x, z, { gain, y, rate });
  }
  /** Gwar osady: gdy przy środku ekranu krząta się sporo ludzi, z ich środka ciężkości słychać cichy gwar (nagranie targu, 0 A.D.) */
  private crowdSnd = { at: 0, x: 0, z: 0, y: 0, level: 0 };
  private syncCrowdSound(g: GameState, v: TerrainView): void {
    const c = this.crowdSnd;
    if (this.time >= c.at) {
      c.at = this.time + 0.5;
      const f = this.focusPoint, { width, height } = g.map;
      let n = 0, sx = 0, sz = 0;
      for (const u of g.units) {
        if (u.phase === Phase.Resting) continue;
        const x = u.px / FP - width / 2, z = u.py / FP - height / 2;
        if ((x - f.x) ** 2 + (z - f.z) ** 2 > 16 * 16) continue;
        n++; sx += x; sz += z;
      }
      c.level = n < 5 ? 0 : Math.min(1, (n - 4) / 14) * (1 - this.night * 0.8) * (1 - this.rain * 0.5);
      if (n) { c.x = sx / n; c.z = sz / n; c.y = v.heightAt(c.x + width / 2, c.z + height / 2); }
    }
    if (c.level > 0.01 && !this.calm) loop3d('crowd', 'crowd', c.x, c.y + 1, c.z, c.level);
  }
  /** Głos człowieka z jego miejsca: gadanie albo okrzyk (nagrania 0 A.D.), każdy z własną barwą (wysokość z id) */
  private say(id: number, shout: boolean, p: THREE.Vector3, gain = 1): void {
    this.playHere(shout ? 'shout' : 'talk', p.x, p.z, gain, p.y + 1.4, 0.9 + (id % 9) * 0.025);
  }
  /** Podłoże pod stopami (do dźwięku kroków): bruk, deski, żwir, błoto po deszczu albo ziemia z trawą */
  private surface(g: GameState, x: number, y: number): WorldSound {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return 'stepDirt';
    const t = ty * g.map.width + tx, road = g.roads[t]!;
    if (road === 2 || this.keepAt(x, y)) return 'stepStone';
    if (road === 3) return 'stepWood';
    if (road === 1) return 'stepGravel';
    if (this.wet > 0.35) return 'stepMud';
    const tile = g.map.tiles[t];
    return tile === Terrain.Stone || tile === Terrain.Iron ? 'stepGravel' : 'stepDirt';
  }

  /** Krok postaci: tylko z bliska i najwyżej 5 na sekundę w całej grze (tłum nie zlewa się w szum) */
  private footstep(g: GameState, id: number, x: number, y: number, stride: number, gain: number): void {
    const k = Math.floor(stride / Math.PI);
    const last = this.stepIdx.get(id);
    this.stepIdx.set(id, k);
    if (last === undefined || last === k || this.walk) return;
    const cam = this.cam.camera, { width, height } = g.map;
    const wx = x - width / 2, wz = y - height / 2, wy = this.view?.heightAt(x, y) ?? 0;
    const d = Math.hypot(cam.position.x - wx, cam.position.y - wy, cam.position.z - wz);
    if (d > 24) return;
    this.stepTimes = this.stepTimes.filter((s) => this.time - s < 1);
    if (this.stepTimes.length >= 6) return;
    if (play3d(this.surface(g, x, y), wx, wz, { gain, y: wy })) this.stepTimes.push(this.time);
  }

  /**
   * Stojący bez zajęcia, którzy są blisko siebie (ten sam pan), dobierają się w pary i gadają.
   * Pary sprawdzamy dwa razy na sekundę; para trwa, dopóki obaj stoją obok siebie.
   */
  private pairChats(): void {
    [this.restPos, this.restNext] = [this.restNext, this.restPos];
    this.restNext.clear();
    if (this.time - this.chatAt < 0.5) return;
    this.chatAt = this.time;
    const pos = this.restPos;
    for (const [a, b] of this.chats) {
      const pa = pos.get(a), pb = pos.get(b);
      if (!pa || !pb || Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > 1.6) { this.chats.delete(a); this.chats.delete(b); }
    }
    const grid = new Map<number, number[]>();
    for (const [id, [x, z]] of pos) { const k = Math.floor(x) * 4096 + Math.floor(z); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(id); }
    for (const [id, [x, z, owner]] of pos) {
      if (this.chats.has(id)) continue;
      let best = 1.3, mate = 0;
      for (let gx = Math.floor(x) - 1; gx <= Math.floor(x) + 1; gx++) for (let gz = Math.floor(z) - 1; gz <= Math.floor(z) + 1; gz++)
        for (const o of grid.get(gx * 4096 + gz) ?? []) {
          if (o === id || this.chats.has(o)) continue;
          const po = pos.get(o)!;
          if (po[2] !== owner) continue;
          const d = Math.hypot(po[0] - x, po[1] - z);
          if (d < best) { best = d; mate = o; }
        }
      // nie każdy jest gadułą: mniej więcej trzy pary na cztery zaczynają rozmowę
      if (mate && ((Math.min(id, mate) * 31 + Math.max(id, mate) * 17) % 4) !== 0) { this.chats.set(id, mate); this.chats.set(mate, id); }
    }
  }

  private village: Village | null = null;
  private family: Family | null = null;
  /** Kury, świnie, koń i pies w osadzie (tylko wygląd) */
  private syncVillage(g: GameState, view: TerrainView, dt: number): void {
    if (!this.village) this.village = new Village(this.scene);
    const people: { x: number; y: number; owner: number; moving: boolean; id: number }[] = [];
    for (const u of g.units) people.push({ x: u.px / FP, y: u.py / FP, owner: u.owner, moving: u.path.length > 0, id: u.id });
    for (const s of g.soldiers) if (!s.up) people.push({ x: s.px / FP, y: s.py / FP, owner: s.owner, moving: s.path.length > 0, id: s.id });
    const cam = this.cam.camera, { width, height } = g.map;
    if (!this.family) this.family = new Family(this.scene);
    this.family.view(this.cam.camera.position);
    this.family.sync(g, {
      time: this.time, dt, calm: this.calm, height: (x, y) => this.standY(view, x, y, -2), fig: FIG,
      cam: { x: this.cam.camera.position.x + g.map.width / 2, y: this.cam.camera.position.z + g.map.height / 2, h: this.cam.camera.position.y },
      team: (o) => TEAM_COLORS[g.players[o]?.team ?? 0] ?? 0x888888,
    });
    this.village.sync(g, {
      time: this.time, dt, night: this.night, calm: this.calm, height: (x, y) => this.standY(view, x, y, -2),
      cam: { x: cam.position.x + width / 2, y: cam.position.z + height / 2, h: cam.position.y },
      // pies, kura, świnia: nagrania (0 A.D.) z miejsca zwierzęcia
      sound: (kind, x, y) => { play3d(kind === 'bark' ? 'dog' : kind === 'cluck' ? 'hen' : 'pig', x - width / 2, y - height / 2, { y: view.heightAt(x, y) }); },
    }, people);
  }

  /** Pora i pogoda dla dźwięków otoczenia */
  private flash = 0;
  /** Błyskawica: na ułamek sekundy rozjaśnia całą scenę */
  lightning(): void { this.flash = 1; }
  /** Pioruny w budynki (src/render/bolts.ts) */
  private bolts = new BoltLayer(this.scene);
  /** Piorun trafia w pole mapy (x, y): kanał z chmur do dachu i błysk całej sceny */
  strike(x: number, y: number): void {
    if (!this.state) return;
    const { width, height } = this.state.map;
    this.bolts.strike(x - width / 2, (this.view?.heightAt(x, y) ?? 0) + 1.2, y - height / 2);
    this.flash = 1;
  }
  get weather(): { night: number; rain: number } { return { night: this.night, rain: this.rain }; }
  private rainLines: THREE.LineSegments | null = null;
  private sadFaces: THREE.Sprite[] = [];
  /** Znaki zarazy nad chatami z gorączkującymi i nad chorymi leżącymi pod gołym niebem */
  private sickIcons: THREE.Sprite[] = [];
  /** Magowie: Zakonu Płomienia i Bractwa Źródła (wędrowny mag z chatki wygląda jak brat Źródła) */
  private magesFireFig!: Figures;
  private magesWaterFig!: Figures;
  /** Magowie bojowi (żołnierze) obu zakonów i ich czary w locie */
  private battleFireFig!: Figures;
  private battleWaterFig!: Figures;
  private spells!: SpellLayer;
  private mageBodiesFire!: Figures;
  /** Kaznodzieje przy kapliczkach (pracownicy kapliczki) */
  private preacherFig!: Figures;
  /** Kaznodzieja w tej klatce stoi przy kapliczce i mówi kazanie (ręce w górę co kilka sekund) */
  private sermon = false;
  private mageBodiesWater!: Figures;
  private readonly eye = new THREE.Matrix4();
  private lamps: THREE.PointLight[] = [];
  /** Poświata pochodni na ziemi: tania plama ciepłego światła pod każdą zapaloną pochodnią (bez kosztu prawdziwego
   *  światła), więc nocą osada świeci w całym kadrze, a nie tylko tam, gdzie sięgają lampy z puli */
  private torchGlow = new TorchGlow(this.scene); // src/render/torchglow.ts
  /** Stan lamp z puli: do jakiego źródła przypięta (klucz), docelowa i bieżąca jasność — lampy przechodzą płynnie,
   *  zamiast skakać, gdy kamera przesuwa się nad osadą i zmienia się zestaw najbliższych pochodni */
  private lampState: { key: string; k: number; target: number; cur: number }[] = [];
  /** Czubki pochodni niesionych przez ludzi i żołnierzy w tej klatce (płomienie rysuje system ognia) */
  private handFlames: THREE.Vector3[] = [];
  private handFlameN = 0;
  /** Płomień w punkcie `local` układu `m` (np. koniec pochodni w dłoni) */
  private pushHandFlameAt(m: THREE.Matrix4, local: THREE.Vector3): void {
    if (this.handFlameN >= 400) return;
    const v = this.handFlames[this.handFlameN] ?? (this.handFlames[this.handFlameN] = new THREE.Vector3());
    const f = this.focusPoint;
    v.copy(local).applyMatrix4(m);
    if ((v.x - f.x) ** 2 + (v.z - f.z) ** 2 > 80 * 80) return;
    this.handFlameN++;
  }

  private handTorches: GearPool;
  /** Pochodnie strażników miejskich nocą: ten sam model co u chłopów, w uniesionej lewej ręce (prawa trzyma miecz) */
  private guardTorches: GearPool;
  /**
   * Pochodnie łuczników wbite w ziemię przy strzelaniu w budynek: miejsce w świecie ustalone raz, gdy łucznik ją wbija
   * (nie jeździ za nim i nie obraca się z naciągiem łuku); klucz = łucznik, `b` = budynek, w który strzela oddział
   */
  private planted = new Map<number, { x: number; y: number; z: number; b: number }>();
  /**
   * Wbite pochodnie: ta sama pochodnia z Blendera co w rękach chłopów (drewniany trzonek z teksturą, owinięta głowica),
   * postawiona pionowo, końcem trzonka trochę w ziemi
   */
  private plantedTorches: THREE.InstancedMesh | null = null;
  private plantedN = 0;
  private plantTorch(x: number, y: number, z: number): void {
    if (!this.plantedTorches) {
      const butt = new THREE.Vector3(0, -0.19 - Math.cos(0.55) * 0.09, -Math.sin(0.55) * 0.09);
      const geo = propGeometry('torch').clone().translate(-butt.x, -butt.y, -butt.z).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.55))
        .translate(0, -0.04, 0).scale(TORCH_K, TORCH_K, TORCH_K);
      this.plantedTorches = new THREE.InstancedMesh(geo, propMaterial('torch'), 64);
      this.plantedTorches.castShadow = true;
      this.plantedTorches.frustumCulled = false;
      this.scene.add(this.plantedTorches);
    }
    if (this.plantedN >= 64) return;
    this.plantedTorches.setMatrixAt(this.plantedN++, this.armM.makeTranslation(x, y, z));
  }
  /** Płomienie pochodni łuczników przy budynku (palą się też w dzień, jak koksowniki) */
  private stickFlames: THREE.Vector3[] = [];
  private stickFlameN = 0;
  /** Brama twierdzy gracza (środek pola przed drzwiami) — buntownicy patrzą w jej stronę; liczone raz na klatkę */
  private riotDoors = new Map<number, [number, number] | null>();
  private riotDoorsAt = -1;
  private riotDoor(g: GameState, owner: number): [number, number] | null {
    if (this.riotDoorsAt !== g.tick) { this.riotDoors.clear(); this.riotDoorsAt = g.tick; }
    let d = this.riotDoors.get(owner);
    if (d === undefined) {
      const keep = g.buildings.find((b) => b.owner === owner && b.door >= 0 && BUILDINGS[b.type]!.id === 'keep');
      const w = g.map.width;
      d = keep ? [(keep.door % w) + 0.5, Math.floor(keep.door / w) + 0.5] : null;
      this.riotDoors.set(owner, d);
    }
    return d;
  }
  private ramBodies!: THREE.InstancedMesh;
  private ramBeams!: THREE.InstancedMesh;
  /** wiadro w prawej ręce gaszącego (puste i z wodą) */
  private buckets!: GearPool;
  private fireFx!: FireCrewFx;
  /** ostatnia faza wylewania (do jednorazowego kłębu pary przy trafieniu) */
  private pourWas = new Map<number, number>();
  private bucketM = new THREE.Matrix4();
  private bucketL = new THREE.Matrix4();
  private bucketR = new THREE.Matrix4();
  private mouth = new THREE.Vector3();
  private bucketWater!: GearPool;
  private rods: GearPool;
  private frameNo = 0;

  private cursor: THREE.Mesh;
  private ghost: THREE.Mesh;
  private selection: THREE.Mesh;
  private ghostModels = new Map<string, THREE.Group>();
  private ghostModel: THREE.Group | null = null;
  /** Czerwone pole ze strzałką: tędy ludzie będą wchodzić i wychodzić z budynku */
  private ghostDoor = new THREE.Group();
  private buildingLayer = new THREE.Group();
  /** Gruz i zapadające się budynki (src/render/rubble.ts) */
  private rubble = new RubbleLayer(this.scene, this.buildingLayer);
  /** Leśne groby osady bez cmentarza (kopczyk z krzyżem) */
  private graves = new GraveLayer(this.scene);
  /** Gdzie w tej klatce stoją niosący trumnę: id → [x, y, z, kierunek, wzrost] (do ustawienia noszy między nimi) */
  private bierPose = new Map<number, [number, number, number, number, number]>();
  private coffinM = new THREE.Matrix4();
  private coffinQ = new THREE.Quaternion();
  private coffinV = new THREE.Vector3();
  private coffinS = new THREE.Vector3();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  /** Trumny na noszach: między przednim (niesie ciało) a tylnym niosącym; bez pomocnika — tuż za przednim */
  private drawCoffins(g: GameState): void {
    this.graves.beginCoffins();
    const helperOf = new Map<number, number>();
    for (const u of g.units) if (u.phase === Phase.Bearing) helperOf.set(u.target, u.id);
    for (const u of g.units) {
      if (u.carryRes !== CORPSE_LOAD || u.phase === Phase.Burying) continue;
      const p = this.bierPose.get(u.id);
      if (!p) continue;
      const hid = helperOf.get(u.id), h = hid !== undefined ? this.bierPose.get(hid) : undefined;
      let x: number, y: number, z: number, yaw: number, size: number;
      if (h && Math.hypot(p[0] - h[0], p[2] - h[2]) < 0.8) {
        x = (p[0] + h[0]) / 2; y = (p[1] + h[1]) / 2; z = (p[2] + h[2]) / 2; size = (p[4] + h[4]) / 2;
        yaw = Math.atan2(p[0] - h[0], p[2] - h[2]);
      } else {
        const half = (BEARER_GAP / FP) / 2;
        yaw = p[3]; x = p[0] - Math.sin(yaw) * half; y = p[1]; z = p[2] - Math.cos(yaw) * half; size = p[4];
      }
      this.coffinQ.setFromAxisAngle(GameRenderer.UP, yaw);
      this.coffinM.compose(this.coffinV.set(x, y, z), this.coffinQ, this.coffinS.setScalar(FIG * size));
      this.graves.coffin(this.coffinM);
    }
    this.graves.endCoffins();
    this.bierPose.clear();
  }
  /** Towar odłożony pod pełnymi magazynami i znak „pełno” nad nimi (piles.ts) */
  private piles = new PileLayer(this.scene);
  /** Koksowniki na murach i wieżach (osobna warstwa: mur kamienny nie ma własnego modelu budynku) */
  /** Koksowniki (src/render/braziers.ts) */
  private braziers = new Braziers(this.scene);
  /** Groty płonących strzał w locie (płomyki dokłada syncFlames) */
  /** Dym z kominów, iskry, blask okien, mgła przy ziemi */
  private ambience = new Ambience();
  /** Okruchy skały i rudy spod kilofów (tylko z bliska) */
  private chips = new Chips();
  /** Który zamach kilofa danego górnika już sypnął okruchami (jeden wysyp na cios) */
  private chipSwing = new Map<number, number>();
  /** Kiedy kopacz stanął przy złożu (od tego liczy się wyciąganie kilofa z pleców i zamachy) */
  private mineStart = new Map<number, number>();
  /** Beczki, worki, siano i śmieci przy domach */
  private clutter = new Clutter();
  /** Chmury jako obiekty nad mapą: płyną, rodzą się i rozpływają, rzucają cień */
  private clouds = new Clouds();
  /** Żywe płomienie pochodni, ognisk i pożarów */
  private flames = new Flames();
  private blaze = new Blaze();
  private camPos = new THREE.Vector3();
  private fxAt = 0;
  private mistLevel = 0;
  private atmoSun = new THREE.Color();
  private buildingMeshes = new Map<number, THREE.Group>();
  /** Dalekie (uproszczone) wersje budynków i ich przełączanie wg odległości od kamery */
  private lods = new Map<number, BuildingLod>();
  /** Do porównań (window.__renderer.lodOn = false) i ?lod=0 */
  lodOn = new URLSearchParams(location.search).get('lod') !== '0';
  /** Dopuszczalny błąd dalekiej wersji na ekranie (piksele): mniejszy = przełączanie dalej; z jakości grafiki */
  private lodPx = 0.6;
  /** Ile budynków stoi w pełnej wersji i na kolejnych poziomach, ile trójkątów oszczędzamy (okno wydajności) */
  lodInfo = '';

  private figures: Figures;
  /** Żołnierze: osobny zestaw postaci w zbrojach */
  private spearmen: Figures;
  private rings: THREE.InstancedMesh;
  private ringsBack!: THREE.InstancedMesh;
  private guardRings!: THREE.InstancedMesh;
  private guardPins: THREE.Sprite[] = [];
  private guardPinMat?: THREE.SpriteMaterial;
  /** Tarcza nad strażnikiem (pokazana po kliknięciu twierdzy) */
  private guardPin(i: number, x: number, y: number, z: number): void {
    if (!this.guardPinMat) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const k = c.getContext('2d')!;
      // tarcza herbowa w barwie straży (czerwona skóra, żelazne okucie), pod nią szpic wskazujący strażnika
      k.fillStyle = '#b8382a'; k.strokeStyle = 'rgba(20,10,5,.9)'; k.lineWidth = 4;
      k.beginPath(); k.moveTo(14, 10); k.lineTo(50, 10); k.lineTo(50, 30); k.quadraticCurveTo(50, 46, 32, 56); k.quadraticCurveTo(14, 46, 14, 30); k.closePath(); k.fill(); k.stroke();
      k.strokeStyle = '#d9d2c2'; k.lineWidth = 4; k.beginPath(); k.moveTo(32, 14); k.lineTo(32, 48); k.moveTo(19, 27); k.lineTo(45, 27); k.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      // stała wielkość na ekranie: tarcze widać i z daleka, i z bliska
      this.guardPinMat = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false, sizeAttenuation: false });
    }
    let sp = this.guardPins[i];
    if (!sp) { sp = new THREE.Sprite(this.guardPinMat); sp.renderOrder = 22; sp.scale.setScalar(0.045); this.scene.add(sp); this.guardPins.push(sp); }
    sp.visible = true;
    sp.position.set(x, y + 1.05 + Math.sin(this.time * 3 + i) * 0.05, z);
  }
  /** Pracownik zaznaczonego budynku: nad nim złota szpilka z ludzikiem (widać ją też zza ścian i drzew) */
  private workerMark = 0;
  private workerPin: THREE.Sprite | null = null;
  setWorkerMark(id: number): void { this.workerMark = id; if (!id && this.workerPin) this.workerPin.visible = false; }
  private placeWorkerPin(): void {
    if (!this.workerMark) return;
    if (!this.workerPin) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const k = c.getContext('2d')!;
      // złote koło z ciemnym ludzikiem, pod nim szpic wskazujący pracownika
      k.fillStyle = '#e9c145'; k.strokeStyle = 'rgba(20,10,5,.95)'; k.lineWidth = 4;
      k.beginPath(); k.arc(32, 25, 19, 0, Math.PI * 2); k.moveTo(22, 40); k.lineTo(32, 60); k.lineTo(42, 40); k.fill(); k.stroke();
      k.beginPath(); k.arc(32, 25, 19, 0, Math.PI * 2); k.fill();
      k.fillStyle = '#2a1a0c';
      k.beginPath(); k.arc(32, 17, 5.5, 0, Math.PI * 2); k.fill();
      k.beginPath(); k.moveTo(22, 37); k.quadraticCurveTo(22, 24, 32, 24); k.quadraticCurveTo(42, 24, 42, 37); k.closePath(); k.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.workerPin = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false, sizeAttenuation: false }));
      this.workerPin.renderOrder = 22;
      this.workerPin.scale.setScalar(0.05);
      this.scene.add(this.workerPin);
    }
    const spot = this.unitSpots.find((s) => s.id === this.workerMark);
    this.workerPin.visible = !!spot;
    if (spot) this.workerPin.position.set(spot.x, (this.unitY.get(spot.id) ?? 0) + 1.05 + (this.calm ? 0 : Math.sin(this.time * 3) * 0.05), spot.z);
  }
  /** Podgląd szyku przy przeciąganiu prawym przyciskiem: przyszłe miejsca żołnierzy */
  private ghostRings!: THREE.InstancedMesh;
  /** Ciała poległych i ciemne plamy pod nimi */
  private bodies: Figures;
  private stains: BloodStains;
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
  /** Ścięte drzewa ciągnięte przez drwali: po parze siatek [pień, korona] na każdą odmianę z lasu */
  private logs = new Map<TreeKind, [THREE.InstancedMesh, THREE.InstancedMesh]>();
  /** Pień leżący na ziemi przy rąbiącym z biedy (emergencywood.ts): ociosany (bez korony), coraz krótszy w trakcie cięcia */
  private groundLogs = new Map<TreeKind, THREE.InstancedMesh>();
  /** Ile bali danej odmiany jest w tej klatce (niesione i leżące przy pniaku) — pule mają tylko prawdziwe sztuki */
  private logN = new Map<TreeKind, number>();
  private groundN = new Map<TreeKind, number>();
  private groundM = new THREE.Matrix4();
  private groundQ = new THREE.Quaternion();
  private groundP = new THREE.Vector3();
  private groundS = new THREE.Vector3();
  /** Które drzewo ściął drwal (id ludzika → odmiana), żeby ciągnął to samo, które stało w lesie */
  private felled = new Map<number, TreeKind>();
  private planks: THREE.InstancedMesh;
  private time = 0;
  private bloodFx!: BloodFx;
  /** Ślady walki na postaciach: numer → [plamy krwi 0–3, krew na ostrzu] (Figures.marks) */
  private woundMarks = new Map<number, readonly [number, boolean]>();
  /** Kiedy (czas sceny) żołnierz ostatnio trafił wręcz — od tego krew na ostrzu */
  private bladeAt = new Map<number, number>();
  private breath!: BreathFx;
  private bloodGround: (x: number, z: number) => number = () => 0;
  /** Bez animacji (tylko na życzenie: ?spokoj=1). Systemowe „ogranicz ruch” zatrzymywało wszystkie animacje w grze (ludzie sunęli, bramy stały) */
  private calm = new URLSearchParams(location.search).has('spokoj');
  /** Ruch ludzi w wyglądzie: łuki na zakrętach, omijanie się */
  private crowd = new Crowd();
  /** Ostatni krok (numer półokresu chodu) każdej postaci: dźwięk kroku przy zmianie */
  private stepIdx = new Map<number, number>();
  private stepTimes: number[] = [];
  private walkStep = 0;
  private frameDt = 1 / 60;
  /** Rozmowy stojących: kto z kim (para), od kiedy; położenia stojących z poprzedniej klatki */
  private chats = new Map<number, number>();
  private chatAt = 0;
  private restPos = new Map<number, [number, number, number]>();
  private restNext = new Map<number, [number, number, number]>();
  private chatYaw = new Map<number, number>();
  private chatTurn = new Map<number, number>();
  /** Pozdrowienia w przejściu: do kiedy macha, kiedy ostatnio */
  private waveUntil = new Map<number, number>();
  private waveAt = new Map<number, number>();
  private prevPos = new Map<number, [number, number]>();
  private storesTick = -1;
  private selectedId = 0;
  private cutSeen = 0;
  private rocksSeen = 0;
  /** Pola z sadzonkami leśniczych pokazanymi w ostatniej klatce */
  private youngSeen = new Set<number>();
  private roadSum = -1;
  private planSum = -1;
  private roadPlans!: THREE.InstancedMesh;
  /** Budynki w trakcie zawalania się po rozbiórce */
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
  /** Ciała spalone w ogniu (z g.corpses co klatkę) */
  private burntBodies = new Set<number>();
  /** Pochodnie chłopów w tej klatce (x, z na zmianę): w grupie niesie ją jeden */
  private torchSpots: number[] = [];
  private frozenBodies = new Set<number>();
  private pyreAt = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, private models: ModelFactory = proceduralModels) {
    this.renderer = createRenderer({canvas, antialias: true }, 'gra');
    this.pre = new Precompiler(this.renderer, this.scene);
    this.scene.add(this.healOrbs);
    Figures.charred = (id) => this.burntBodies.has(id);
    Figures.frozen = (id) => this.frozenBodies.has(id);
    initKtx(this.renderer);
    watchRenderer(this.renderer, 'gra');
    watchLoading(THREE.DefaultLoadingManager);
    this.renderer.localClippingEnabled = true; // budynki w budowie: model przycięty na wysokości postępu
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(HAZE);
    this.scene.fog = new THREE.Fog(HAZE, 55, 150);
    // Cienie: jedno słońce, którego obszar cienia podąża za kamerą.
    // filmowe odwzorowanie tonów: jasne partie nie przepalają się, cienie zostają głębokie
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9; // klimat Gothica: mrocznie, ale bez topienia się w czerni
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    enableShadowLayer(this.renderer); // zastępcze bryły cienia roślinności (terrain.ts)
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
    this.scene.add(cat(this.buildingLayer, 'budynki'));
    this.scene.add(cat(this.ambience.group, 'dym, mgła, iskry'));
    this.scene.add(this.chips.group);
    this.scene.add(cat(this.clutter.group, 'graty przy domach'));
    this.scene.add(cat(this.clouds.group, 'chmury'));
    this.scene.add(cat(this.flames.group, 'płomienie'));
    this.scene.add(cat(this.blaze.group, 'pożary'));

    const flat = (geo: THREE.BufferGeometry, color: number, opacity = 1): THREE.Mesh => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      return m;
    };
    this.cursor = flat(new THREE.RingGeometry(0.5, 0.66, 4, 1, Math.PI / 4), 0xfff3c4);
    this.ghost = flat(new THREE.PlaneGeometry(1, 1), 0x3f9b3f, 0.16);
    this.selection = flat(new THREE.RingGeometry(0.62, 0.72, 4, 1, Math.PI / 4), 0xfff3c4);
    {
      // znacznik wyjścia w podglądzie budowy: czerwone pole z obwódką i biała strzałka od budynku na zewnątrz
      // (bez testu głębokości, żeby nie chował się pod modelem ani w trawie)
      const mat = (color: number, opacity: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), mat(0xd42a1e, 0.55));
      const edge = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.68, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), mat(0xff3b2a, 0.95));
      const arrow = new THREE.Shape();
      arrow.moveTo(0, 0.36); arrow.lineTo(0.24, 0.06); arrow.lineTo(0.09, 0.06); arrow.lineTo(0.09, -0.3);
      arrow.lineTo(-0.09, -0.3); arrow.lineTo(-0.09, 0.06); arrow.lineTo(-0.24, 0.06); arrow.closePath();
      const tip = new THREE.Mesh(new THREE.ShapeGeometry(arrow).rotateX(-Math.PI / 2), mat(0xfff6e8, 0.95));
      tip.position.y = 0.01;
      for (const m of [fill, edge, tip]) { m.renderOrder = 22; this.ghostDoor.add(m); }
      this.ghostDoor.visible = false;
      this.scene.add(this.ghostDoor);
    }
    // podgląd planowanej drogi: zielone pola da się wybudować, czerwone nie
    this.plan = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), 512);
    this.plan.count = 0;
    this.plan.frustumCulled = false;
    this.plan.renderOrder = 3;
    this.scene.add(this.plan);
    // zaplanowane drogi: półprzezroczyste pola w barwie przyszłej nawierzchni, póki chłop ich nie ułoży
    this.roadPlans = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.82, 0.82).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }), 4096);
    this.roadPlans.count = 0;
    this.roadPlans.frustumCulled = false;
    this.roadPlans.renderOrder = 2;
    this.scene.add(this.roadPlans);

    this.figures = new Figures(MAX_UNITS, this.scene);
    this.spearmen = new Figures(MAX_UNITS, this.scene, 'spearman');
    this.archers = new Figures(MAX_UNITS, this.scene, 'archer');
    this.guardsFig = new Figures(MAX_UNITS, this.scene, 'guard');
    this.menAtArms = new Figures(MAX_UNITS, this.scene, 'manatarms');
    this.sappersFig = new Figures(MAX_UNITS, this.scene, 'sapper');
    this.banditsFig = new Figures(256, this.scene, 'bandit');
    this.magesFireFig = new Figures(128, this.scene, 'mageFire');
    this.magesWaterFig = new Figures(128, this.scene, 'mageWater');
    this.preacherFig = new Figures(64, this.scene, 'preacher');
    this.battleFireFig = new Figures(160, this.scene, 'mageFire');
    this.battleWaterFig = new Figures(160, this.scene, 'mageWater');
    this.spells = new SpellLayer(this.scene);
    this.standards = new Standards(this.scene);
    this.kings = new Figures(32, this.scene, 'king');
    // znaczniki zaznaczenia rysują się nad wszystkim (trawa, krzaki), z ciemną obwódką, żeby było je widać na każdym tle
    const mark = (inner: number, outer: number, color: number, opacity: number, order: number): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(new THREE.RingGeometry(inner, outer, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, toneMapped: false, fog: false }), MAX_UNITS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
      return mesh;
    };
    this.ringsBack = mark(0.17, 0.29, 0x120c05, 0.6, 20);
    this.rings = mark(0.195, 0.262, 0xffd34d, 1, 21);
    // straż miejska po kliknięciu twierdzy: czerwone kółka pod strażnikami i tarcza nad głową
    this.guardRings = mark(0.24, 0.33, 0xe0503a, 0.95, 21);
    this.bodies = new Figures(MAX_UNITS, this.scene, 'spearman').enableChar();
    this.peasantBodies = new Figures(MAX_UNITS, this.scene).enableChar();
    this.archerBodies = new Figures(512, this.scene, 'archer').enableChar();
    this.mageBodiesFire = new Figures(160, this.scene, 'mageFire').enableChar();
    this.mageBodiesWater = new Figures(160, this.scene, 'mageWater').enableChar();
    this.guardBodies = new Figures(256, this.scene, 'guard').enableChar();
    this.manAtArmsBodies = new Figures(256, this.scene, 'manatarms').enableChar();
    this.sapperBodies = new Figures(256, this.scene, 'sapper').enableChar();
    this.banditBodies = new Figures(256, this.scene, 'bandit').enableChar();
    this.stains = new BloodStains(MAX_UNITS); // krew: nieregularna plama, rozlewa się i ciemnieje (render/blood.ts)
    this.scene.add(this.stains.mesh);
    this.breath = new BreathFx(this.scene); // para z ust na mrozie (render/breath.ts)
    this.bloodFx = new BloodFx(this.scene);
    Figures.marks = (id) => this.woundMarks.get(id); // krew w walce: prysk przy trafieniu, krople za ciężko rannym (render/bloodfx.ts)
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
    // 12 świateł: każde kosztuje każdy piksel każdego oświetlonego materiału (także wygaszone), a 12 najbliższych
    // środka ekranu wystarcza, żeby osada nocą była oświetlona tam, gdzie się patrzy (dalsze pochodnie mają sam płomień)
    for (let i = 0; i < 12; i++) {
      const lamp = new THREE.PointLight(0xffa35a, 0, 9, 1.5);   // krótszy zasięg: światło pochodni kończy się kilka kroków dalej, a nie oblewa całej osady
      this.scene.add(lamp);
      this.lamps.push(lamp);
    }
    // światło sal przy spacerze stoi w scenie od początku (wygaszone): nowe światło w trakcie gry zmienia ich liczbę,
    // a wtedy three przebudowuje shadery wszystkich materiałów — wejście w spacer zamrażało grę na kilka sekund
    this.roomLight = new THREE.PointLight(0xffb36b, 0, 5, 1.2);
    this.scene.add(this.roomLight);
    const hand = mergeGeometries([
      tint(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 5).translate(0.17, 0.5, 0.1), 0x4a3320),
      tint(new THREE.CylinderGeometry(0.03, 0.022, 0.07, 6).translate(0.17, 0.67, 0.1), 0x2a1c12),
    ]);
    // co piąty żołnierz nocą niesie pochodnię w lewej ręce (prawa trzyma włócznię)
    this.soldierTorches = new THREE.InstancedMesh(hand.clone().translate(-0.34, 0, 0), new THREE.MeshBasicMaterial({ vertexColors: true }), 256);
    this.soldierTorches.count = 0; this.soldierTorches.frustumCulled = false;
    this.scene.add(this.soldierTorches);
    // narzędzia chłopów z Blendera (tools/models/tools.py): każde w wersji z bliska i z daleka, drewno z teksturą i kute żelazo;
    // pula rysuje tylko te, które ktoś naprawdę trzyma (wcześniej każdy człowiek miał każde narzędzie, schowane zerową skalą)
    const gear = peasantGear();
    const tm = toolMaterials();
    const pool = (name: keyof typeof gear, label = 'narzędzia w rękach', mats: THREE.Material | THREE.Material[] = tm): GearPool =>
      new GearPool(this.scene, gear[name], gear[(name + 'Far') as keyof typeof gear] ?? null, mats, MAX_UNITS, label);
    this.axes = pool('axe');
    this.picks = pool('pick');
    this.clubs = pool('club');
    this.forks = pool('fork', 'widły buntowników');
    this.backPicks = pool('backPick');
    this.beltClubs = pool('beltClub');
    this.hammers = pool('hammer');
    this.spades = pool('spade');
    this.rods = pool('rod');
    // pochodnia w ręce: kij, drut i szmaty ze smołą (płomień dokłada system ognia)
    this.handTorches = pool('torch', 'pochodnie w rękach');
    this.guardTorches = pool('torch', 'pochodnie strażników');
    this.buckets = pool('bucket');
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x4f8fb8, roughness: 0.2, metalness: 0.1 });
    this.bucketWater = pool('bucketWater', 'woda w wiadrach', [waterMat, waterMat, waterMat]);
    // posłanie: rozrzucona wiązka słomy z wałkiem pod głowę i kawałkiem zgrzebnego koca na nogach
    const straw = new THREE.MeshStandardMaterial({ color: 0xd6b56a, roughness: 1, map: pattern('thatch'), vertexColors: true });
    // wymiary pod leżącą postać (ok. 0,48 długości): siennik, wałek pod głową, koc na nogach
    const bed = mergeGeometries([
      tint(new THREE.BoxGeometry(0.2, 0.025, 0.58).translate(0, 0.0125, 0), 0xffffff),
      tint(new THREE.CylinderGeometry(0.035, 0.04, 0.17, 7).rotateZ(Math.PI / 2).translate(0, 0.04, -0.24), 0xe8d29a),
      // koc przykrywa śpiącemu nogi i brzuch (leży nad postacią, nie pod nią — wcześniej nogi sterczały nad kocem)
      tint(new THREE.BoxGeometry(0.25, 0.045, 0.34).translate(0, 0.1, 0.1), 0x7d6a52),
      tint(new THREE.BoxGeometry(0.255, 0.012, 0.03).translate(0, 0.122, -0.075), 0x6a5844),
    ]);
    this.bedrolls = new GearPool(this.scene, bed, null, straw, MAX_UNITS, 'posłania', false);
    // taran z Blendera (tools/models/ram.py): wóz z daszkiem i osobno belka, która wysuwa się przy uderzeniu
    const RAM_MATS = ['wood', 'woodDark', 'sack', 'iron'];
    const RAM_COL = { wood: 0x8a6440, woodDark: 0x5e4329, sack: 0xb39a72, iron: 0x6a6e76 };
    const ramMats = [
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: pattern('planks'), normalMap: normal('planks') }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks'), normalMap: normal('planks') }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('burlap'), normalMap: normal('burlap') }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 }),
    ];
    const ramMesh = (grp: string): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(partsGeometry(RAM_MODEL as unknown as { q: number } & Record<string, unknown>, grp, RAM_MATS, RAM_COL), ramMats, 256);
      m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; this.scene.add(cat(m, 'tarany'));
      return m;
    };
    this.ramBodies = ramMesh('body');
    this.ramBeams = ramMesh('beam');
    this.fireFx = new FireCrewFx(this.scene);

    this.loads = createLoads(MAX_UNITS, this.scene);
    // całe ścięte drzewo ciągnięte po ziemi za drwalem: ta sama odmiana z Poly Haven co w lesie (src/render/forest.ts),
    // położona czubkiem do tyłu — pień z korą w dłoniach, korona wlecze się po ziemi. Bez odchudzania modelu:
    // pełny pień i karty korony jak w lesie, tylko bez wiatru (leżące drzewo się nie kołysze).
    for (const k of [...kindsOf('conifer'), ...kindsOf('leaf')]) {
      // długość w układzie postaci jak dawny świerk; liściaste krótsze, bo mają szeroką koronę
      const s = (k.role === 'leaf' ? 1.7 : 2.1) / k.height;
      const box = new THREE.Box3().setFromBufferAttribute(k.cards.getAttribute('position') as THREE.BufferAttribute);
      const r = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) * s; // promień korony po skali
      // pochylenie czubka w górę: korona szura po ziemi, ale nie zapada się w nią (szeroka korona = mocniej uniesiona)
      let tilt = 0.12;
      while (tilt < 0.6 && 0.3 + Math.sin(tilt) * ((box.min.y + box.max.y) / 2) * s - r * Math.cos(tilt) < -0.06) tilt += 0.02;
      const lay = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.clone().scale(s, s, s).rotateX(-Math.PI / 2 + tilt).translate(0, 0.3, -0.2);
      const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, map: k.barkMat.map, normalMap: k.barkMat.normalMap });
      const leaves = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, map: k.cardMat.map, alphaTest: 0.5 });
      const trunk = new THREE.InstancedMesh(lay(k.trunk), bark, MAX_UNITS);
      const crown = new THREE.InstancedMesh(lay(k.cards), leaves, MAX_UNITS);
      // cień korony z kształtu liści na kartach, nie z prostokątów kart
      crown.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: k.cardMat.map, alphaTest: 0.5 });
      for (const m of [trunk, crown]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; this.scene.add(cat(m, 'niesione bale i deski')); }
      this.logs.set(k, [trunk, crown]);
      // ten sam pień położony płasko wzdłuż osi x, środkiem w zerze i spodem na ziemi (do obróbki przy pniaku)
      const flat = k.trunk.clone().scale(s, s, s).rotateZ(-Math.PI / 2);
      flat.computeBoundingBox();
      const fb = flat.boundingBox!;
      flat.translate(-(fb.min.x + fb.max.x) / 2, -fb.min.y, -(fb.min.z + fb.max.z) / 2);
      const ground = new THREE.InstancedMesh(flat, bark, MAX_UNITS);
      ground.count = 0; ground.frustumCulled = false; ground.castShadow = true; ground.receiveShadow = true;
      this.scene.add(cat(ground, 'niesione bale i deski'));
      this.groundLogs.set(k, ground);
    }
    // wiązka desek na ramieniu: kilka cienkich, lekko przesuniętych desek z dwiema przewiązkami
    const plank = plankBundle();
    this.planks = new THREE.InstancedMesh(plank, loadMaterials(plank), MAX_UNITS); // deski z fakturą drewna, przewiązki z płótna
    this.planks.count = 0; this.planks.frustumCulled = false; this.planks.castShadow = true; this.scene.add(cat(this.planks, 'niesione bale i deski'));

    this.cam = new StrategyCamera(canvas);
    this.composer = new EffectComposer(this.renderer);
    this.ao = new N8AOPass(this.scene, this.cam.camera, canvas.clientWidth || 1, canvas.clientHeight || 1);
    Object.assign(this.ao.configuration, { aoRadius: 1.6, distanceFalloff: 0.6, intensity: 2.2, gammaCorrection: false, color: new THREE.Color(0x1a120a) });
    this.ao.setQualityMode('Medium');
    // AO bez osobnego rysowania przezroczystych rzeczy: n8ao samo to włączało (w scenie są przezroczyste pierścienie,
    // dym i woda), a wtedy co klatkę cztery razy przechodziło po całej scenie i dwa razy ją dodatkowo rysowało
    this.ao.configuration.transparencyAware = false;
    this.plain = new RenderPass(this.scene, this.cam.camera);
    this.plain.enabled = false;
    this.composer.addPass(this.plain);
    this.composer.addPass(this.ao);
    // poświata: tylko najjaśniejsze miejsca (płomienie, okna nocą, odblaski słońca) dostają miękką aureolę
    // przed poświatą: pojedynczy błędny piksel (NaN albo nieskończenie jasny) rozmyty przez poświatę czernił cały ekran,
    // więc obraz jest najpierw czyszczony i przycinany do rozsądnej jasności
    this.sanitize = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          if (!(c.r == c.r && c.g == c.g && c.b == c.b) || c.r > 1e4 || c.g > 1e4 || c.b > 1e4) c = vec4(0.0, 0.0, 0.0, 1.0);
          gl_FragColor = vec4(clamp(c.rgb, 0.0, 40.0), c.a);
        }`,
    });
    this.sanitize.enabled = false;
    this.composer.addPass(this.sanitize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.18, 0.45, 1.6);
    this.bloom.enabled = false;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // gradacja koloru w klimacie surowego średniowiecza: mniej nasycenia, ciepłe brudne cienie, chłodna noc, winieta
    this.grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, night: { value: 0 }, rain: { value: 0 }, golden: { value: 0 }, bright: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float night; uniform float rain; uniform float golden; uniform float bright; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.72 - rain * 0.15 + golden * 0.14);       // przygaszone barwy (o złotej godzinie żywsze)
          c = mix(c, c * vec3(1.14, 1.0, 0.8), golden * smoothstep(0.15, 0.75, l)); // ciepłe, złote światło o świcie i zmierzchu
          c = mix(c * vec3(1.06, 0.98, 0.86), c, smoothstep(0.0, 0.6, l)); // brązowe cienie
          c = (c - 0.5) * 1.08 + 0.5;                                   // trochę kontrastu
          c = mix(c, c * vec3(0.72, 0.8, 1.05), night * 0.35);          // chłodna, ciemna noc
          c *= 1.0 - rain * 0.12;
          // suwak Jasność: podnosi przede wszystkim ciemne miejsca (noc, cienie), jasne prawie zostają; 1 = bez zmian
          c = pow(max(c, 0.0), vec3(1.0 / pow(bright, 1.1))) * mix(1.0, bright, 0.35);
          vec2 d = vUv - 0.5;
          c *= 1.0 - dot(d, d) * (0.85 + night * 0.6) / bright;         // winieta (jaśniej = słabsza)
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
    });
    this.composer.addPass(this.grade);
    // wygładzanie krawędzi w obrazie (FXAA / SMAA) i wyostrzenie — na samym końcu, na gotowym obrazie
    this.fxaa = new FXAAPass();
    this.fxaa.enabled = false;
    this.composer.addPass(this.fxaa);
    this.smaa = new SMAAPass();
    this.smaa.enabled = false;
    this.composer.addPass(this.smaa);
    this.sharpen = sharpenPass();
    this.sharpen.enabled = false;
    this.composer.addPass(this.sharpen);
    this.matQ = new MaterialQuality(this.renderer.capabilities.getMaxAnisotropy());
    this.envTex = makeEnvironment(this.renderer);
    canvas.addEventListener('pointermove', (e) => {
      // kursor nad budynkiem (wieża, mur, dach chaty) wskazuje ten budynek, a nie ziemię za nim — łatwiej kliknąć
      // wieżę albo mur, żeby wysłać na nie wojsko (Michał 28.10.2026); promień po budynkach najwyżej co 40 ms
      if (e.pointerType !== 'touch') {
        let tile: TileRef | null = null;
        if (!this.ghost.visible && !this.painting) {
          const now = performance.now();
          if (now - this.hoverPickAt >= 40) { this.hoverPickAt = now; this.hoverPicked = this.pickBuilding(e); }
          tile = this.hoverPicked;
        }
        this.hover(tile ?? this.pick(e));
      }
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
      // przy stawianiu budynku liczy się pole pod podglądem (ziemia), nie mur ani dach, w który akurat celuje kursor
      const tile = (this.ghost.visible ? null : this.pickBuilding(e)) ?? this.pick(e);
      if (tile) this.onClick(tile, e.pointerType === 'touch');
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** Gracz przy tym ekranie (znaki „brak pracownika” tylko nad jego budynkami) */
  private me = 0;
  private hpSeen = new Map<number, number>();
  /** budynek -> czas, od którego może znowu sypnąć kurzem po trafieniu (żeby seria ciosów nie robiła chmury) */
  private shake = new Map<number, number>();

  /** Herby graczy do chorągwi na budynkach i flagach zbiórki (ustawiać przed setState) */
  setCrests(list: (number | null)[]): void {
    this.crests = list.slice();
    this.rallyFlags.reset();
    // budynki, które już stoją (konto wczytało się po starcie gry albo gracz zmienił herb w trakcie): podmień płachty
    const g = this.state;
    if (!g) return;
    for (const b of g.buildings) {
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      const team = TEAM_COLORS[g.players[b.owner]?.team ?? 0] ?? 0x888888;
      applyCrest(mesh, team, this.crestOf(b.owner));
    }
  }
  private crestOf(player: number): number { return this.crests[player] ?? defaultCrest(player); }
  setState(state: GameState, waterLevel: number, rim: number, focusPlayer = 0): void {
    this.stateJob++;
    this.building = false; // ewentualna wcześniejsza budowa etapami (setStateAsync) właśnie przestała się liczyć
    this.beginState(state, focusPlayer);
    this.finishState(state, buildTerrain(state.map, this.models, waterLevel), rim, focusPlayer);
  }

  /**
   * To samo co `setState`, ale teren budowany etapami z przerwą na klatkę (`buildTerrainAsync`): strona nie staje na
   * całe budowanie mapy. Przez ten czas nic się nie rysuje. Zwraca false, gdy w międzyczasie przyszła inna mapa
   * (np. „Losuj inną mapę” kliknięte jeszcze raz) — wtedy zbudowany teren od razu idzie do kosza.
   */
  async setStateAsync(state: GameState, waterLevel: number, rim: number, focusPlayer: number, pause: () => Promise<void>): Promise<boolean> {
    const job = ++this.stateJob;
    this.building = true;
    try {
      this.beginState(state, focusPlayer);
      const view = await buildTerrainAsync(state.map, this.models, waterLevel, pause);
      if (job !== this.stateJob) { view.dispose(); return false; }
      this.finishState(state, view, rim, focusPlayer);
      return true;
    } finally { if (job === this.stateJob) this.building = false; }
  }
  private stateJob = 0;
  /** Teren nowej mapy w budowie etapami: nic nie rysujemy (stary teren już zwolniony) */
  private building = false;

  private beginState(state: GameState, focusPlayer: number): void {
    this.builtAt = 0; this.sites.reset(); // budynki z wczytanej / nowej mapy stoją od razu, bez pokazu budowy
    this.me = focusPlayer;
    if (this.view) { this.scene.remove(this.view.group); this.view.dispose(); }
    for (const g of this.buildingMeshes.values()) this.buildingLayer.remove(g);
    this.buildingMeshes.clear();
    for (const b of this.batches.values()) { this.buildingLayer.remove(b.mesh); b.mesh.dispose(); }
    this.batches.clear();
    this.lods.clear();
    this.rubble.clear();
    this.graves.clear();
    this.arrows.clearStuck();
    this.piles.clear();
    this.prevPos.clear();
    this.facing.clear();
    this.strides.clear();
    this.storesTick = -1;
    this.clutter.reset();
    this.clouds.reset();
    this.state = state;
  }

  private finishState(state: GameState, view0: TerrainView, rim: number, focusPlayer: number): void {
    this.view = view0;
    this.spawnFx.reset();
    this.view.grassReach(this.grassReach);
    this.scene.add(this.view.group);
    this.snowNow = -1; this.seasonScan = 0;
    const { width, height, starts } = state.map;
    this.cam.setBounds(width, height, rim + 8);
    this.camMargin = rim + 8; this.reachKey = '';
    const view = this.view;
    this.cam.ground = (x, z) => view.heightAt(x + width / 2, z + height / 2);
    const s = starts.find((p) => p.player === focusPlayer) ?? starts[0];
    if (s) this.cam.lookAt(s.x + 0.5 - width / 2, s.y + 0.5 - height / 2, 30);
    this.cursor.visible = this.ghost.visible = this.ghostDoor.visible = this.selection.visible = false;
    this.roadSum = -1; this.planSum = -1;
    // nowa mapa: mury, place budowy i obszary liczone od nowa (te same id budynków na nowej mapie dawały ten sam klucz —
    // brama zostawała nieobrócona, a bale palisady stały jak na poprzedniej mapie)
    // nie puste: mapa bez murów (placów budowy, obszarów) ma klucz '', a stare bale i ciosy z poprzedniej mapy muszą zniknąć
    this.walls.invalidate(); this.wear.invalidate(); this.scorch.invalidate(); this.repairs.invalidate(); this.areaKey = '-';
    this.cutSeen = state.cut.length; // wczytana gra ma już polany na mapie (i odrośnięty las)
    this.rocksSeen = 0;
    this.youngSeen = new Set();
    }

  /** Nowy stan tej samej gry z wątku symulacji (bez przebudowy terenu i modeli) */
  swapState(state: GameState): void { this.state = state; }

  /** Zapamiętuje pozycje jednostek przed krokiem symulacji, żeby ruch był płynny między tickami. */
  snapshot(): void {
    if (!this.state) return;
    this.prevPos.clear();
    for (const u of this.state.units) this.prevPos.set(u.id, [u.px, u.py]);
    for (const x of this.state.soldiers) this.prevPos.set(x.id, [x.px, x.py]);
    for (const x of this.state.travelers) this.prevPos.set(x.id, [x.px, x.py]);
    for (const x of this.state.caravans ?? []) this.prevPos.set(x.id, [x.px, x.py]);
    for (const x of this.state.wolves) this.prevPos.set(x.id, [x.px, x.py]);
  }

  /** Ustawia kamerę nad wskazanym punktem mapy (w polach); używane też przy testach wyglądu */
  /** Pole mapy na ekranie: piksele w oknie i czy jest przed kamerą */
  /** Ułamek ticku z ostatniej klatki: położenie między poprzednim a obecnym tickiem (jak rysowane ludziki) */
  private lastAlpha = 1;
  /**
   * Płynne położenie (w polach) chłopa, żołnierza, wilka albo wędrowca — tak, jak jest właśnie narysowany.
   * Do napisów nad głowami (numery grup, dymki): pozycja z symulacji skacze 10 razy na sekundę, rysunek idzie płynnie.
   */
  smoothTile(id: number, px: number, py: number): { x: number; y: number } {
    const prev = this.prevPos.get(id), a = this.lastAlpha;
    return { x: (prev ? prev[0] + (px - prev[0]) * a : px) / FP, y: (prev ? prev[1] + (py - prev[1]) * a : py) / FP };
  }

  /** Punkt świata (współrzędne sceny 3D) na ekranie; front = przed kamerą */
  projectWorld(x: number, y: number, z: number): { sx: number; sy: number; front: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.cam.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { sx: r.left + ((v.x + 1) / 2) * r.width, sy: r.top + ((1 - v.y) / 2) * r.height, front: v.z < 1 };
  }

  project(x: number, y: number, lift = 1): { sx: number; sy: number; front: boolean } {
    const g = this.state;
    const v = new THREE.Vector3(x - (g?.map.width ?? 0) / 2, (this.view?.heightAt(x, y) ?? 0) + lift, y - (g?.map.height ?? 0) / 2);
    v.project(this.cam.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { sx: r.left + ((v.x + 1) / 2) * r.width, sy: r.top + ((1 - v.y) / 2) * r.height, front: v.z < 1 };
  }

  /** Liczniki karty graficznej z ostatniej klatki (do okna wydajności) */
  /** Do diagnozy wydajności: które siatki mają najwięcej trójkątów (z instancjami) */
  /**
   * Co ile trójkątów rysuje w tej chwili, pogrupowane po rodzaju (podpisy z cat()): w kadrze kamery i w mapie cieni.
   * Liczy tylko widoczne siatki; ukryte instancje (zerowa skala poza kadrem) też się liczą, bo karta i tak je przetwarza.
   */
  heavy(top = 12): { cat: string; tris: number; shadow: number; meshes: number }[] {
    const cam = this.cam.camera;
    cam.updateMatrixWorld();
    const m4 = new THREE.Matrix4();
    const view = new THREE.Frustum().setFromProjectionMatrix(m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const sc = this.sun.shadow.camera;
    sc.updateMatrixWorld();
    const shadow = this.sun.castShadow ? new THREE.Frustum().setFromProjectionMatrix(m4.multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse)) : null;
    const by = new Map<string, { cat: string; tris: number; shadow: number; meshes: number }>();
    const walk = (o: THREE.Object3D, label: string): void => {
      if (!o.visible) return;
      const l = o.userData.lod ? 'budynki (daleka wersja)' : ((o.userData.cat as string | undefined) ?? label);
      const m = o as THREE.Mesh;
      if ((m.isMesh || (o as THREE.Sprite).isSprite) && m.geometry && !(Array.isArray(m.material) ? false : (m.material as THREE.Material).visible === false)) {
        const geo = m.geometry;
        const all = (geo.index ? geo.index.count : geo.getAttribute('position')?.count ?? 0);
        const per = Math.min(all, geo.drawRange.count) / 3;
        const count = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        const n = per * count;
        if (n > 0) {
          let e = by.get(l);
          if (!e) { e = { cat: l, tris: 0, shadow: 0, meshes: 0 }; by.set(l, e); }
          e.meshes++;
          if (!m.frustumCulled || view.intersectsObject(m)) e.tris += n;
          if (shadow && m.castShadow && (!m.frustumCulled || shadow.intersectsObject(m))) e.shadow += n;
        }
      }
      for (const ch of o.children) walk(ch, l);
    };
    for (const ch of this.scene.children) walk(ch, 'inne');
    return [...by.values()].sort((a, b) => b.tris + b.shadow - a.tris - a.shadow).slice(0, top);
  }

  get stats(): { calls: number; triangles: number; geometries: number; textures: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  /** Kamera do zapisu i odtworzenia po odświeżeniu strony */
  get camView(): { x: number; z: number; dist: number; yaw: number } { return this.cam.view; }
  setCamView(v: { x: number; z: number; dist: number; yaw: number }): void { this.cam.setView(v); }

  /** Testy: kamera dookoła pola (x, y) mapy — kąty w stopniach, lift = wysokość celu nad ziemią */
  viewAround(x: number, y: number, dist: number, yawDeg: number, pitchDeg: number, lift = 0): void {
    if (!this.state) return;
    this.cam.orbit(x - this.state.map.width / 2, y - this.state.map.height / 2, dist, (yawDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180, lift);
  }
  /** Testy: wymiary modelu budynku w świecie (szerokość, wysokość, głębokość) albo null */
  buildingSize(id: number): { w: number; h: number; d: number } | null {
    const m = this.buildingMeshes.get(id);
    if (!m) return null;
    const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    return { w: s.x, h: s.y, d: s.z };
  }
  /** Zasięg szczegółów (drzewa jako bryły, drobiazgi) wg poziomu grafiki: 1 = pełny */
  private detail = 1;
  /** Ustawienia → Grafika: deszcz i mgła (tylko obraz i dźwięk; symulacja deszczu liczy się dalej) */
  rainOn = true;
  fogOn = true;
  /** Ustawienia → Grafika: jasność obrazu (1 = 100%) */
  set brightness(v: number) {
    const b = Math.max(0.5, Math.min(2, v));
    this.renderer.toneMappingExposure = 0.9 * Math.sqrt(b);
    this.grade.uniforms.bright!.value = b;
  }
  /** Testy: budynki stawiane od ręki stoją od razu, bez kilkusekundowego pokazu budowy */
  noBuildShow = false;

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
    touch(this.plan);
    if (this.plan.instanceColor) touch(this.plan);
  }

  setPainting(on: boolean): void { this.painting = on; this.cam.panLocked = on; }

  /** Siatka budowy: przy wybranym budynku pola wokół kursora — zielone, gdzie wolno budować, czerwone, gdzie nie
   *  (zajęte, w tym świeżo postawione place budowy, zły teren, za daleko). Prawie przezroczysta, z przerwami jak kratka. */
  private buildGrid: THREE.InstancedMesh | null = null;
  setBuildGrid(center: { x: number; y: number } | null, ok?: (x: number, y: number) => boolean): void {
    const g = this.state, view = this.view;
    if (!center || !g || !view || !ok) { if (this.buildGrid) this.buildGrid.visible = false; return; }
    const R = 13;
    if (!this.buildGrid) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, fog: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      this.buildGrid = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), mat, (2 * R + 1) ** 2);
      this.buildGrid.frustumCulled = false;
      this.buildGrid.renderOrder = 3;
      this.scene.add(cat(this.buildGrid, 'siatka budowy'));
    }
    const grid = this.buildGrid;
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), c = new THREE.Color(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
    // zielone pola tylko podpowiadają (słabo, w nocy jeszcze słabiej), czerwone mają być widać wyraźnie
    const GOOD = new THREE.Color(0x3ee05a).multiplyScalar(0.55 - this.night * 0.25), BAD = new THREE.Color(0xff3a2e);
    let n = 0;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = center.x + dx, y = center.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const d = Math.hypot(dx, dy);
        if (d > R + 0.5) continue;
        // ku brzegowi kratka gaśnie (kółko wokół kursora, bez ostrej krawędzi)
        const fade = Math.max(0, Math.min(1, (R + 0.5 - d) / 6));
        const hgt = Math.max(view.heightAt(x + 0.5, y + 0.5), 0) + 0.035;
        m.compose(v.set(x + 0.5 - width / 2, hgt, y + 0.5 - height / 2), q, sc);
        grid.setMatrixAt(n, m);
        grid.setColorAt(n, c.copy(ok(x, y) ? GOOD : BAD).multiplyScalar(fade));
        n++;
      }
    grid.count = n;
    touch(grid);
    if (grid.instanceColor) touch(grid);
    grid.visible = true;
  }

  /** Wieża, nad którą stoi podgląd koksownika: dach zdjęty, żeby było widać, gdzie kosz stanie (Michał 30.10.2026) */
  private ghostOpen = 0;
  setGhost(g: Ghost | null): void {
    if (this.ghostModel) this.ghostModel.visible = false;
    this.ghostOpen = 0;
    if (!g || !this.view || !this.state) { this.ghost.visible = this.ghostDoor.visible = false; return; }
    const { width, height } = this.state.map;
    if (g.door !== undefined && g.door >= 0) {
      const dx = g.door % width, dy = (g.door / width) | 0;
      // strzałka od środka działki w stronę wyjścia (domyślnie geometria wskazuje −z)
      const vx = dx + 0.5 - (g.x + g.w / 2), vz = dy + 0.5 - (g.y + g.h / 2);
      const [ax, az] = Math.abs(vx) >= Math.abs(vz) ? [Math.sign(vx), 0] : [0, Math.sign(vz)];
      this.ghostDoor.rotation.y = Math.atan2(-ax, -az);
      this.ghostDoor.position.set(dx + 0.5 - width / 2, this.view.heightAt(dx + 0.5, dy + 0.5) + 0.1, dy + 0.5 - height / 2);
      this.ghostDoor.visible = true;
    } else this.ghostDoor.visible = false;
    // koksownik: podgląd prawdziwego kosza tam, gdzie stanie — na pomoście wieży albo na chodniku muru, a nie wielki
    // kwadrat ze strzałką na ziemi pod wieżą (Michał 30.10.2026)
    if (g.id === 'brazier') {
      this.ghost.visible = this.ghostDoor.visible = false;
      const key = 'brazier';
      let model = this.ghostModels.get(key);
      if (!model) { model = brazierModel(); model.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.material = cloneMaterial(mesh.material as THREE.MeshLambertMaterial); }); this.ghostModels.set(key, model); this.scene.add(model); }
      const id = this.state.occupancy[g.y * width + g.x];
      const host = id ? this.state.buildings.find((b) => b.id === id) : undefined;
      if (host && brazierHost(BUILDINGS[host.type]!.id)) this.ghostOpen = host.id;
      if (host && brazierHost(BUILDINGS[host.type]!.id)) placeBrazier(model, this.state, this.view, host, this.buildingMeshes.get(host.id));
      else { model.position.set(g.x + 0.5 - width / 2, this.view.heightAt(g.x + 0.5, g.y + 0.5), g.y + 0.5 - height / 2); model.rotation.y = 0; model.scale.setScalar(0.5); }
      const bad = new THREE.Color(0x7a0f0a), lift = new THREE.Color(0x3a3020).multiplyScalar(0.25 + this.night * 0.75);
      model.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) (mesh.material as THREE.MeshLambertMaterial).emissive?.copy(g.ok ? lift : bad); });
      model.visible = true;
      this.ghostModel = model;
      return;
    }
    let top = 0;
    for (let y = g.y; y <= g.y + g.h; y++) for (let x = g.x; x <= g.x + g.w; x++) top = Math.max(top, this.view.heightAt(x, y));
    this.ghost.scale.set(g.w, g.h, 1);
    this.ghost.position.set(g.x + g.w / 2 - width / 2, top + 0.08, g.y + g.h / 2 - height / 2);
    (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(g.ok ? 0x3f9b3f : 0xb3261e);
    (this.ghost.material as THREE.MeshBasicMaterial).opacity = g.ok ? 0.12 : 0.3;
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
        const m = cloneMaterial(mesh.material as THREE.MeshLambertMaterial);
        // pełna bryła (bez prześwitywania siatki i trawy przez ściany); widoczność daje rozjaśnienie niżej
        m.transparent = false; m.opacity = 1; m.depthWrite = true;
        mesh.material = m;
      });
      this.ghostModels.set(key, model);
      this.scene.add(model);
    }
    model.position.set(this.ghost.position.x, top, this.ghost.position.z);
    model.rotation.y = (g.rot * Math.PI) / 2;
    const lift = new THREE.Color(0x3a3020).multiplyScalar(0.25 + this.night * 0.75), bad = new THREE.Color(0x7a0f0a).add(lift);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      // fundament dzieli materiał z prawdziwymi budynkami, więc go nie barwimy
      // w nocy podgląd lekko się podświetla, żeby budynek było widać na ciemnej trawie
      if (mesh.isMesh && mesh.name !== 'base') (mesh.material as THREE.MeshLambertMaterial).emissive?.copy(g.ok ? lift : bad);
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
  // zasięg strzału wieży: czerwonawe koło zamiast zielonego kwadratu
  private rangeFill = new THREE.MeshBasicMaterial({ color: 0xd8503a, transparent: true, opacity: 0.14, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
  private rangeLine = new THREE.LineBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.9, fog: false });
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
      if (isTower(BUILDINGS[b.type]!.id)) {
        // koło o promieniu zasięgu łucznika na wieży, od środka wieży, ułożone na terenie
        const fp = footprint(BUILDINGS[b.type]!, b.rot), cx = b.x + fp.w / 2, cy = b.y + fp.h / 2, R = TOWER_RANGE + towerBonus(BUILDINGS[b.type]!.id);
        const lift = (x: number, y: number): number => Math.max(0, v.heightAt(Math.min(width - 0.01, Math.max(0, x)), Math.min(height - 0.01, Math.max(0, y)))) + 0.09;
        const geo = new THREE.CircleGeometry(R, 72, 0, Math.PI * 2).rotateX(-Math.PI / 2);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) { const wx = pos.getX(i) + cx, wy = pos.getZ(i) + cy; pos.setXYZ(i, wx - width / 2, lift(wx, wy), wy - height / 2); }
        // gęstsza siatka w środku nie jest potrzebna, ale brzeg musi iść po terenie: dokładamy pierścienie
        const rings = new THREE.RingGeometry(0.5, R, 72, 8).rotateX(-Math.PI / 2);
        const rp = rings.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rp.count; i++) { const wx = rp.getX(i) + cx, wy = rp.getZ(i) + cy; rp.setXYZ(i, wx - width / 2, lift(wx, wy), wy - height / 2); }
        geo.dispose();
        rings.computeBoundingSphere();
        const fill = new THREE.Mesh(rings, this.rangeFill);
        fill.renderOrder = 4;
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k < 120; k++) { const a = (k / 120) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; pts.push(new THREE.Vector3(x - width / 2, lift(x, y) + 0.03, y - height / 2)); }
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), this.rangeLine);
        line.renderOrder = 4;
        this.areaGroup.add(fill, line);
        continue;
      }
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

  /** Zasięg gęstej trawy wokół kamery (1 = pełny); ustawia jakość grafiki */
  private grassReach = 1;
  /** Zawsze dzień zamiast cyklu dnia i nocy (ustawienie gracza) */
  private alwaysDay = false;

  private reachTick = 0;
  private camMargin = 18;
  private reachKey = '';
  /** Koła, do których kamera może wyjechać poza grywalny środek: wokół każdego własnego budynku, który tam stoi */
  private updateReach(g: GameState): void {
    const { width, height } = g.map;
    const bx = width / 2 - this.camMargin, bz = height / 2 - this.camMargin;
    const pts: { x: number; z: number; r: number }[] = [];
    for (const b of g.buildings) {
      if (b.owner !== this.me) continue;
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      const x = b.x + fp.w / 2 - width / 2, z = b.y + fp.h / 2 - height / 2;
      if (Math.abs(x) <= bx && Math.abs(z) <= bz) continue;
      pts.push({ x, z, r: Math.max(fp.w, fp.h) / 2 + 6 });
    }
    const key = pts.map((p) => `${p.x},${p.z}`).join('|');
    if (key !== this.reachKey) { this.reachKey = key; this.cam.setReach(pts); }
  }

  /** Ustawienia grafiki i kamery z menu */
  setGraphics(o: { ao: string; shadows: number; scale: number; dayNight: boolean; camSpeed: number; edgeScroll: boolean; grass?: number; detail?: number; soft?: boolean; dynRes?: boolean; label?: string; aa?: AaMode; aniso?: number; reflections?: boolean; sharpen?: number }): void {
    if (TEST) o = { ...o, ao: 'off', shadows: 0, scale: 0.5, edgeScroll: false, aa: 'off', reflections: false, sharpen: 0 };
    this.quality = `${o.label ? o.label + ': ' : ''}AO ${o.ao}, cienie ${o.shadows || 'wył.'}, skala ${o.scale}, trawa ${(o.grass ?? 1) > 0 ? Math.round((o.grass ?? 1) * 100) + '%' : 'wył.'}`;
    this.grassReach = o.grass ?? 1;
    // zasięg szczegółów: z automatu jakości, a przy ręcznych ustawieniach z trawy (bez trawy = bliżej)
    this.detail = o.detail ?? 0.6 + 0.4 * (o.grass ?? 1);
    // daleka wersja budynków: na minimum wolno pomylić się o ~2 piksele (przełącza blisko), na Ultra o 0,3 piksela (bardzo daleko)
    this.lodPx = 0.6 / Math.pow(Math.max(0.4, this.detail), 2.2);
    this.view?.grassReach(this.grassReach);
    this.ao.enabled = o.ao !== 'off';
    this.plain.enabled = o.ao === 'off';
    if (o.ao !== 'off') this.ao.setQualityMode(o.ao === 'high' ? 'High' : o.ao === 'low' ? 'Low' : 'Medium');
    this.aoMode = o.ao;
    this.aoRes();
    this.sun.castShadow = o.shadows > 0;
    this.shadowMax = o.shadows;
    // poświata od średniej jakości w górę (kosztuje kilka przejść w małej rozdzielczości)
    // poświata wokół płomieni, okien i odblasków: od średniej jakości w górę (obraz przed nią czyszczony z błędnych pikseli)
    this.bloom.enabled = o.ao !== 'off' && o.shadows >= 2048;
    this.sanitize.enabled = this.bloom.enabled;
    // miękkie cienie: rodzaj mapy cieni ustawiany tylko przy starcie gry (przebudowa shaderów w trakcie psuła teren i budynki)
    if (!this.shadowTypeSet) {
      this.shadowTypeSet = true;
      // PCFSoftShadowMap został w three.js usunięty; miękkość daje promień rozmycia PCF
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.sun.shadow.radius = o.soft ? 3 : 1;
    }
    this.shadowSize(o.shadows);
    // „Ostra”: na zwykłym monitorze (gęstość 1×) gra liczy obraz w 1,5× rozdzielczości i zmniejsza go (nadpróbkowanie —
    // wygładza krawędzie, trawę i drobne tekstury); wcześniej było przycinane do gęstości ekranu i na 1× nic nie dawało
    const dpr = window.devicePixelRatio || 1;
    // „Ostrzejsza” (1,25): pośredni stopień nadpróbkowania — złoty środek na szerokie monitory (ultrapanorama, 4K na 1×)
    // najwyżej 1,25× (1,5× zdjęte 30.10.2026 — na szerokim monitorze za ciężkie nawet dla mocnej karty)
    this.ratioMax = o.scale > 1 ? Math.min(2, dpr * Math.min(1.25, o.scale)) : Math.min(dpr, o.scale);
    this.ratioDyn = 1;
    this.dynRes = !!o.dynRes;
    this.applyRatio();
    this.imageQuality(o.aa ?? 'msaa4', o.aniso ?? 16, o.reflections ?? true, o.sharpen ?? 0);
    this.alwaysDay = !o.dayNight;
    this.cam.speed = o.camSpeed;
    this.cam.edgeScroll = o.edgeScroll;
  }

  /**
   * Kompiluje z góry wszystkie shadery sceny, żeby gra nie przycinała przy pierwszym widoku.
   * Asynchronicznie: modele próbne budujemy partiami z przerwą na klatkę, a shadery kompiluje karta w tle
   * (`compileAsync`, rozszerzenie KHR_parallel_shader_compile) — strona nie zamarza na kilkanaście sekund,
   * pasek wczytywania się rusza. `onProgress(gotowe, wszystkich)` po każdej partii modeli.
   */
  async warmup(onProgress?: (done: number, total: number) => void): Promise<void> {
    this.warming = true;
    try { await this.warmupInner(onProgress); } finally { this.warming = false; this.pre.start(); void this.prewarmLater().catch((e) => console.error(e)); }
  }
  private warming = false;
  /**
   * Wstrzymanie rysowania na czas przygotowania nowej mapy (od jej zbudowania do końca rozgrzewki): bez tego pętla gry
   * rysowała nową scenę jeszcze przed `warmup()` i karta kompilowała jej shadery „na żywo”, blokując stronę.
   */
  private held = false;
  private seasonPatchAt = 0;
  /** Shadery nowych obiektów w trakcie gry: kompilacja w tle, obiekt pokazuje się gotowy (precompile.ts) */
  private pre!: Precompiler;
  hold(on: boolean): void { this.held = on; }
  private dry = false;
  /**
   * Przygotowanie bieżącego widoku bez rysowania: klatka bez czasu tworzy wszystko, co widać z tej kamery (kępy trawy,
   * paprocie, trzciny, dalekie wersje modeli), a shadery tych nowych rzeczy kompiluje karta w tle. Dopiero potem
   * pierwsza prawdziwa klatka z tego miejsca — bez kompilacji „na żywo”, która blokowała stronę na 1–2 s.
   */
  async prepareView(): Promise<void> {
    if (this.warming || this.held || this.building) return;
    this.dry = true;
    try { this.frame(0, 1, true); } finally { this.dry = false; }
    this.matQ.sweep(this.scene);
    this.warming = true;
    try { await this.renderer.compileAsync(this.scene, this.cam.camera); }
    catch { /* bez kompilacji w tle shadery skompilują się przy rysowaniu */ }
    finally { this.warming = false; }
  }
  private async warmupInner(onProgress?: (done: number, total: number) => void): Promise<void> {
    // Shadery wszystkiego, co stoi w scenie, kompiluje karta w tle (compileAsync); budynki, których jeszcze nie ma,
    // przygotowują się dopiero po starcie (prewarmLater). Potem cienie i efekty obrazu (niżej), na końcu pierwsza klatka.
    void onProgress;
    const pause = (): Promise<void> => new Promise((ok) => { requestAnimationFrame(() => setTimeout(ok, 0)); setTimeout(ok, 60); });
    // czasy kroków do sprawdzania w konsoli: window.__warmTimes
    const times: [string, number][] = [];
    let tm = performance.now();
    const lap = (name: string): void => { const n = performance.now(); times.push([name, Math.round(n - tm)]); tm = n; };
    (window as unknown as { __warmTimes: unknown }).__warmTimes = times;
    const compile = async (): Promise<void> => {
      try { await this.renderer.compileAsync(this.scene, this.cam.camera); }
      catch { this.renderer.compile(this.scene, this.cam.camera); }
    };
    // klatka bez rysowania: budynki osady, mury, place budowy i to, co widać z kamery, powstają TERAZ, żeby ich shadery
    // skompilowały się w tle razem z resztą (30.10.2026: na mapie z 189 budynkami pierwsza prawdziwa klatka tworzyła je
    // 1,3 s, a karta kompilowała ich shadery na żywo jeszcze 0,8 + 0,4 s)
    if (this.state && this.view) {
      const held = this.held;
      this.warming = false; this.held = false; this.dry = true;
      try { this.frame(0, 1, true); } catch (e) { console.error(e); } finally { this.dry = false; this.warming = true; this.held = held; }
      lap('budynki osady');
      await pause();
    }
    this.matQ.sweep(this.scene);
    applySeason(this.scene);   // teren, las i trawa nowej mapy też od razu z łatkami pór roku
    await compile();
    lap('shadery wspólne');
    // Cienie i efekty obrazu: three.js kompiluje shadery mapy cieni i przejść obrazu (AO, blask…) dopiero przy pierwszym
    // rysowaniu i wtedy strona stała 1–3,5 s (Michał 30.10.2026). Najpierw jedna klatka bez obiektów (powstaje mapa
    // cieni, kompilują się lekkie przejścia obrazu), potem shadery cienia całej sceny zleca się karcie w tle i czeka na
    // nie z przerwami na klatkę (pasek wczytywania się rusza) — dopiero wtedy prawdziwa pierwsza klatka.
    const hide = this.scene.children.filter((o) => o.visible && !(o as THREE.Light).isLight);
    for (const o of hide) o.visible = false;
    try { this.composer.render(); } finally { for (const o of hide) o.visible = true; }
    lap('efekty obrazu');
    const shadowMats = this.pre.warm(this.scene, this.cam.camera);
    for (let k = 0; k < 120 && shadowMats.length && !this.pre.isReady(shadowMats); k++) await pause();
    lap('shadery cieni');
    this.composer.render();
    lap('pierwsza klatka');
  }
  private prewarmed = false;

  /**
   * Shadery wszystkich budynków w tle, już po starcie gry (Michał 30.10.2026: wczytywanie za długie — wcześniej gra
   * przed startem składała po egzemplarzu każdego budynku, ok. 3,5 s nawet na pustej mapie). Po jednym budynku na
   * przerwę: model gotowy i jako plac budowy (przycięty płaszczyzną) oraz wariant wspólnego rysowania (instancje).
   * Nic z tego nie trafia do sceny — karta tylko kompiluje programy. Budynek postawiony, zanim przyjdzie jego kolej,
   * i tak czeka w ukryciu na swoje shadery (precompile.ts), więc niczego nie widać „na żywo”.
   */
  private async prewarmLater(): Promise<void> {
    if (this.prewarmed) return;
    this.prewarmed = true;
    const idle = (): Promise<void> => new Promise((ok) => {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(() => ok(), { timeout: 400 }); else setTimeout(ok, 30);
    });
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -49);
    const clips = new Map<THREE.Material, THREE.Material>();
    const clip = (m: THREE.Material): THREE.Material => {
      let c = clips.get(m);
      if (!c) { c = cloneMaterial(m); c.clippingPlanes = [plane]; c.clipShadows = true; c.side = THREE.DoubleSide; clips.set(m, c); }
      return c;
    };
    const t0 = performance.now();
    // czas każdego kroku (budynek: ms) do sprawdzania w konsoli: window.__prewarmSteps
    const steps: [string, number][] = [];
    (window as unknown as { __prewarmSteps: unknown }).__prewarmSteps = steps;
    let waiting: THREE.Material[] = [];
    for (const def of BUILDINGS) {
      // nie w trakcie wczytywania nowej mapy ani pełnej rozgrzewki: wtedy czekamy
      while (this.warming || this.held || this.building) await idle();
      await idle();
      // poprzedni budynek jeszcze się kompiluje: nie dokładamy karcie roboty (najwyżej ok. 2 s czekania)
      for (let k = 0; k < 20 && waiting.length && !this.pre.isReady(waiting); k++) await idle();
      const ts = performance.now();
      const m = this.models.building(def.id, TEAM_COLORS[0] ?? 0x888888);
      m.userData.fx = collectFx(m, isWindowMat);
      mergeStatic(m, def.id + ':0');
      m.traverse((o) => { o.visible = true; const me = o as THREE.Mesh; if (me.isMesh) me.castShadow = me.receiveShadow = true; });
      const site = m.clone(true);
      site.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.material = Array.isArray(me.material) ? me.material.map(clip) : clip(me.material); });
      const probe = new THREE.Group();
      probe.add(m, site);
      // wspólne rysowanie budynków tego rodzaju: ten sam materiał w siatce z instancjami (inny wariant shadera)
      for (const part of this.staticParts(m)) {
        const im = new THREE.InstancedMesh(part.geometry, part.material as THREE.Material, 1);
        im.castShadow = part.castShadow; im.receiveShadow = part.receiveShadow;
        probe.add(im);
      }
      probe.position.set(0, -50, 0);
      probe.updateMatrixWorld(true);
      applySeason(probe);
      waiting = this.pre.warm(probe, this.cam.camera);
      steps.push([def.id, Math.round(performance.now() - ts)]);
    }
    (window as unknown as { __prewarmMs: number }).__prewarmMs = Math.round(performance.now() - t0);
  }

  /**
   * Wgrywa do karty graficznej wszystkie tekstury sceny z góry. Bez tego three.js wysyła teksturę dopiero przy pierwszym
   * rysowaniu obiektu, więc pierwsze obroty kamery po wejściu do gry przycinają. Zwraca liczbę tekstur.
   */
  uploadTextures(): number {
    const seen = new Set<THREE.Texture>();
    const take = (m: THREE.Material): void => {
      for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture && !seen.has(v as THREE.Texture)) seen.add(v as THREE.Texture);
      const u = (m as THREE.ShaderMaterial).uniforms;
      if (u) for (const k in u) { const v = u[k]?.value; if (v && (v as THREE.Texture).isTexture) seen.add(v as THREE.Texture); }
    };
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (!mat) return;
      if (Array.isArray(mat)) mat.forEach(take); else take(mat);
    });
    for (const tex of seen) { try { this.renderer.initTexture(tex); } catch { /* tekstura jeszcze bez obrazka: wgra się przy rysowaniu */ } }
    return seen.size;
  }

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
  /** Ujęcie z menu: osada w złotej godzinie (ciepłe, niskie słońce), a nie w nocy */
  private menuNight = false;

  /** Kurz i odpryski (src/render/dust.ts) */
  private dust = new DustFx(this.scene);
  /** Rozbita droga: kłąb kurzu i odpryski kamieni lub grudki ziemi rozlatują się i opadają */
  roadDust(x: number, y: number, stone: boolean, soft = false): void {
    if (this.state && this.view) this.dust.roadDust(this.state, this.view, x, y, stone, soft);
  }
  /** Trafiony budynek: obłoczek kurzu i okruchy pod murem */
  private hitDust(b: { type: number; x: number; y: number; rot: number }): void {
    if (this.state && this.view && !this.calm) this.dust.hitDust(this.state, this.view, b);
  }

  /** Deszcz: przychodzi i odchodzi co kilka dni gry (czysto wizualnie, z zegara gry, więc bez losowania) */
  private updateRain(dt: number): void {
    const g = this.state;
    const day = g ? g.tick / RULES.dayTicks : 0;
    // co ~3 dni pada przez około pół dnia (ten sam zegar deszczu co w symulacji: ludzie na słomie mokną naprawdę)
    const want = g && this.rainOn ? rainAt(g.tick) : 0;
    this.rain += (Math.min(1, want * 1.6) - this.rain) * Math.min(1, dt * 0.5);
    // raz zepsuta liczba zostałaby na zawsze (jak śnieg niżej) — wraca do pogody z zegara
    if (!Number.isFinite(this.rain)) { console.warn('[pogoda] deszcz NaN', { dt, tick: g?.tick, want }); this.rain = Number.isFinite(want) ? Math.min(1, want * 1.6) : 0; }
    // pogoda dnia: pogodnie, pochmurno albo mglisto (z ziarna mapy, więc u każdego taka sama); przejścia płynne w ciągu dnia
    const seed = g?.map.seed ?? 1;
    const dayW = (d: number): [number, number] => { const h = Math.sin((Math.floor(d) + seed * 0.013) * 12.9898) * 43758.5453; const v = h - Math.floor(h); return v < 0.45 ? [0.12, 0] : v < 0.8 ? [0.55, 0.15] : [0.35, 0.8]; };
    const [c0, f0] = dayW(day), [c1, f1] = dayW(day + 1), fr = day - Math.floor(day);
    const wantCover = Math.max(this.rain, c0 + (c1 - c0) * fr), wantMist = f0 + (f1 - f0) * fr;
    this.cover += (wantCover - this.cover) * Math.min(1, dt * 0.3);
    this.dayMist += (wantMist - this.dayMist) * Math.min(1, dt * 0.3);
    if (!Number.isFinite(this.cover)) this.cover = 0.3;
    if (!Number.isFinite(this.dayMist)) this.dayMist = 0;
    this.grade.uniforms.rain!.value = this.rain;
    // po deszczu długo jest mokro: błoto i kałuże schną powoli
    this.wet = Math.max(0, Math.min(1, this.wet + (this.rain > 0.15 ? dt * 0.12 : -dt * 0.003)));
    if (Math.abs(this.wet - this.wetShown) > 0.01) { this.view?.setWet(this.wet); setWetBuildings(this.wet); this.wetShown = this.wet; }
    if (g && this.view) this.puddleLayer.sync(g, this.view, this.wet, this.roadSum, this.rain, this.time);
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

  /** Niebo: kopuła, gwiazdy, księżyc, słońce (src/render/sky.ts) */
  private skyDome = new SkyDome(this.scene);



  // --- spacer oczami chłopa: kamera na wysokości głowy, WASD i mysz, zderzenia z budynkami i wodą ---
  private walk: { x: number; z: number; yaw: number; pitch: number; keys: Set<string>; bob: number; jy?: number; vy?: number; gy?: number } | null = null;
  /** Wywoływane, gdy spacer się skończy (Esc) */
  onWalkEnd: () => void = () => {};
  /**
   * Spacer na ziemiach wroga: 'seen' — straż Cię zauważyła (kilka sekund na ucieczkę), 'safe' — zgubili Cię,
   * 'killed' — dopadli Cię i spacer się kończy, 'foreign' — próba wejścia do cudzej kopalni
   */
  onWalkAlert: (kind: 'seen' | 'safe' | 'killed' | 'foreign' | 'mineRaid' | 'mineLost') => void = () => {};
  private mineRaidShown = false;
  /** Kończy trwający spacer (jak Esc) */
  private walkEnd: (() => void) | null = null;
  /** Ile sekund straż wroga już patrzy na spacerowicza (rośnie, gdy widzi, opada, gdy zgubi) */
  private walkSeen = 0;
  private walkSeenShown = false;
  private foreignAt = -99;
  get walking(): boolean { return !!this.walk; }
  setWalkPitch(p: number): void { if (this.walk) this.walk.pitch = p; }
  private walkFocus = new THREE.Vector3();
  /** Środek uwagi: przy spacerze miejsce, gdzie stoi chłop (światła, cienie i deszcz liczą się wokół niego) */
  /** Pole mapy, na które patrzy kamera (do odzywek ludzi w pobliżu) */
  get focusTile(): { x: number; y: number } {
    const f = this.focusPoint, g = this.state;
    return g ? { x: f.x + g.map.width / 2, y: f.z + g.map.height / 2 } : { x: 0, y: 0 };
  }
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
  /** Ciepłe światło kominków i koszy z ogniem w salach zamku (włączone, gdy spacerowicz jest pod dachem) */
  private roomLight!: THREE.PointLight;
  /** Spacer we wnętrzu kopalni: która kopalnia i gdzie stoi spacerowicz (układ wnętrza) */
  private inMine: { id: number; x: number; z: number; lvl: number; climb?: { t: number; down: boolean } } | null = null;
  private mineLevel: THREE.Group | null = null;
  /** Czy spacer jest teraz w sztolni (dla interfejsu: podpowiedź wyjścia) */
  get inMineWalk(): boolean { return !!this.inMine; }
  /** Ilu górników kopie teraz w tej sztolni (echo kilofów) */
  minePicks = 0;
  /**
   * Wejście do kopalni: spacer przenosi się do osobnej lokacji (duża sztolnia pod mapą). Z przycisku w oknie kopalni
   * zaczyna też spacer, jeśli jeszcze go nie ma. Wyjście: na końcu korytarza wejściowego (wrota) albo Esc.
   */
  enterMine(id: number): void {
    const g = this.state;
    const b = g?.buildings.find((x) => x.id === id);
    if (!g || !b || BUILDINGS[b.type]!.id !== 'oremine') return;
    // do cudzej kopalni nie wejdziesz (sztolnia należy do jej pana); sojusznik też trzyma swoją
    if (b.owner !== this.me) { this.foreign(); return; }
    if (!this.walk) { const w = g.map.width; this.startWalk((b.door % w) + 0.5, Math.floor(b.door / w) + 0.5); }
    if (!this.walk) return;
    if (!this.mineLevel) { this.mineLevel = mineLevelModel(); this.mineLevel.position.copy(MINE_AT); this.scene.add(this.mineLevel); }
    this.mineLevel.visible = true;
    const [ex, ez, yaw] = MINE_LEVEL.entry;
    this.inMine = { id, x: ex, z: ez, lvl: 0 };
    this.walk.yaw = yaw - Math.PI; this.walk.pitch = -0.05; this.walk.jy = 0; this.walk.gy = undefined;
    playAt('creak', 0.8, 0, 0.6);
  }
  /** Wyjście z kopalni przed jej wrota na powierzchni (spacer trwa dalej na zewnątrz, plecami do skały) */
  private leaveMine(): void {
    const g = this.state, m = this.inMine;
    this.inMine = null;
    if (this.mineLevel) this.mineLevel.visible = false;
    const w = this.walk;
    const b = g && m ? g.buildings.find((x) => x.id === m.id) : undefined;
    if (!w || !g) return;
    if (b && b.door >= 0) {
      const W = g.map.width, th = (b.rot * Math.PI) / 2;
      w.x = (b.door % W) + 0.5 + Math.sin(th) * 0.4; w.z = Math.floor(b.door / W) + 0.5 + Math.cos(th) * 0.4;
      w.yaw = th + Math.PI; w.gy = undefined;
    }
    playAt('creak', 0.8, 0, 0.6);
  }
  /** Spacer w sztolni: ruch po salach z modelu (prostokąty), przeszkody, kamera nisko pod stropem, latarnia w dłoni */
  private stepMine(dt: number): void {
    const w = this.walk!, m = this.inMine!, k = w.keys;
    const cam = this.cam.camera;
    const floorY = (lvl: number): number => (lvl ? MINE_LEVEL.low : 0);
    // drabina w szybie: krótka wspinaczka między poziomami (kamera jedzie w pionie, szczebel po szczeblu)
    if (m.climb) {
      const c = m.climb, T = 1.8;
      const before = Math.floor(c.t / 0.3);
      c.t += dt;
      if (Math.floor(c.t / 0.3) !== before) playAt('stepWood', 0.8, 0, 0.7);
      const k2 = Math.min(1, c.t / T), e = k2 * k2 * (3 - 2 * k2);
      const y0 = c.down ? 0 : MINE_LEVEL.low, y1 = c.down ? MINE_LEVEL.low : 0;
      const [hx0, hx1, hz0, hz1] = MINE_LEVEL.hole;
      cam.position.set(MINE_AT.x + (hx0 + hx1) / 2, MINE_AT.y + y0 + (y1 - y0) * e + 0.46, MINE_AT.z + (hz0 + hz1) / 2 + 0.12);
      cam.rotation.set(c.down ? -0.5 : 0.35, 0, 0, 'YXZ'); // twarzą do drabiny
      this.roomLight.position.set(cam.position.x, cam.position.y + 0.25, cam.position.z);
      if (k2 >= 1) {
        m.climb = undefined;
        m.lvl = c.down ? 1 : 0;
        [m.x, m.z] = c.down ? MINE_LEVEL.down : MINE_LEVEL.up;
        w.yaw = Math.PI; w.pitch = -0.05; // plecami do drabiny
      }
      return;
    }
    // stan kopalni na powierzchni: kto kopie (echo kilofów), czy wróg stoi u wrót, czy kopalnia jeszcze stoi
    const g = this.state!, mb = g.buildings.find((x) => x.id === m.id);
    if (!mb || mb.ruined || mb.owner !== this.me) {
      this.onWalkAlert('mineLost');
      this.leaveMine();
      return;
    }
    let picks = 0;
    for (const u of g.units) if (u.job === m.id && u.phase === Phase.Working) picks++;
    this.minePicks = picks;
    const raid = (mb.threat ?? 0) > g.tick;
    if (raid && !this.mineRaidShown) this.onWalkAlert('mineRaid');
    this.mineRaidShown = raid;
    const rooms = m.lvl ? MINE_LEVEL.rooms2 : MINE_LEVEL.rooms, solids = m.lvl ? MINE_LEVEL.solid2 : MINE_LEVEL.solid;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const sp = (run ? 3.4 : 1.8) * dt;
    let fx = 0, fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    const len = Math.hypot(fx, fz) || 1;
    const sx = Math.sin(w.yaw), cz = Math.cos(w.yaw);
    const dx = (-sx * fz + cz * fx) / len * sp, dz = (-cz * fz - sx * fx) / len * sp;
    const R = 0.14;
    const free = (x: number, z: number): boolean => {
      for (const [ox, oz] of [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]] as const) {
        const px = x + ox, pz = z + oz;
        if (!rooms.some(([x0, x1, z0, z1]) => px >= x0 && px <= x1 && pz >= z0 && pz <= z1)) return false;
      }
      for (const [x0, x1, z0, z1] of solids) if (x > x0 - R && x < x1 + R && z > z0 - R && z < z1 + R) return false;
      return true;
    };
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.04));
    for (let i = 0; i < n; i++) {
      // po ścianie się ślizga: najpierw wzdłuż x, potem wzdłuż z
      if (free(m.x + dx / n, m.z)) m.x += dx / n;
      if (free(m.x, m.z + dz / n)) m.z += dz / n;
    }
    if (fx || fz) { w.bob += dt * (run ? 11 : 7); if (Math.sin(w.bob) * Math.sin(w.bob - dt * 7) < 0) playAt('stepDirt', 0.8, 0, 0.65); }
    if (k.has('Space') && !w.jy) { w.vy = 2.3; w.jy = 0.0001; }
    if (w.jy) { w.jy += (w.vy ?? 0) * dt; w.vy = (w.vy ?? 0) - 9.5 * dt; if (w.jy <= 0) { w.jy = 0; w.vy = 0; } }
    cam.position.set(MINE_AT.x + m.x, MINE_AT.y + floorY(m.lvl) + 0.46 + Math.min(w.jy ?? 0, 0.5) + Math.sin(w.bob) * 0.015, MINE_AT.z + m.z);
    cam.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
    // pochodnia w ręce przy patrzeniu w dół: podnosi się i przechyla z powrotem do pionu (jak trzymana przy piersi),
    // zamiast obracać się razem z widokiem i wchodzić w ziemię (Michał 30.10.2026)
    if (this.handTorch) {
      const down = Math.max(0, -w.pitch);
      this.handTorch.position.set(0.22, -0.24 + down * 0.2, -0.42 + down * 0.1);
      this.handTorch.rotation.x = -0.35 + down * 0.85;
    }
    // ciepłe światło latarni w dłoni (w sztolni bez niego byłoby czarno między lampami)
    this.roomLight.intensity = this.torchOn ? 0.6 : 1.4; // bez pochodni tylko słaba poświata (ciemno między latarniami)
    this.roomLight.position.set(cam.position.x, cam.position.y + 0.25, cam.position.z);
    // wrota na końcu korytarza: wyjście na powierzchnię
    const [ex0, ex1, ez0, ez1] = MINE_LEVEL.exit;
    if (!m.lvl && m.x >= ex0 && m.x <= ex1 && m.z >= ez0 && m.z <= ez1) { this.leaveMine(); return; }
    // wejście w otwór szybu (z góry) albo pod drabinę (z dołu): wspinaczka na drugi poziom
    if (MINE_LEVEL.hole && inRect(MINE_LEVEL.hole, m.x, m.z) && !w.jy) { m.climb = { t: 0, down: !m.lvl }; playAt('creak', 0.7, 0, 0.5); }
  }
  private toggleHandTorch(): void {
    if (!this.handTorch) {
      const g = new THREE.Group();
      // pochodnia wyciągnięta w spacerze (F): gotowy model z sieci (tools/models/props_import.py) — trzonek, szmaty
      // ze smołą owinięte sznurem; siatka i tekstura bez przeróbek. W pliku leży w układzie ręki chłopa (pochylona),
      // tu stawiamy ją pionowo: koniec trzonka w y = -0,21, góra głowicy w 0,19 (tam płomień, jak dotąd)
      // odwrotność ustawienia z props_import.py: przesunięcie końca trzonka (dłoń - d·0,09) do zera i obrót o TORCH_ARM
      const butt = new THREE.Vector3(0, -0.19 - Math.cos(0.55) * 0.09, -Math.sin(0.55) * 0.09);
      const torch = propGeometry('torch').clone()
        .translate(-butt.x, -butt.y, -butt.z)
        .applyMatrix4(new THREE.Matrix4().makeRotationX(-0.55))
        .translate(0, -0.21, 0);
      const stick = new THREE.Mesh(torch, propMaterial('torch'));
      this.handTip.position.set(0, 0.19, 0);
      // płomień jako płaska siatka przypięta do pochodni w kamerze (billboard świata rozciągał się tuż przy oku)
      // płonie cała głowica, a nie tylko czubek (Michał 29.10.2026): główny płomień zaczyna się w połowie szmat
      // i obejmuje je, dookoła trzy mniejsze języki liżą boki głowicy
      const fl = flameSprite(this.handFlameTime, 0.1, 0.24);
      fl.position.set(0, 0.1, 0);
      fl.rotation.x = 0.35;
      g.add(stick, this.handTip, fl);
      for (const [x, z, h, rot] of [[0.028, 0.012, 0.13, 0.2], [-0.026, 0.016, 0.12, -0.25], [0.004, -0.028, 0.11, 0.1]] as const) {
        const t = flameSprite(this.handFlameTime, 0.05, h);
        t.position.set(x, 0.075, z);
        t.rotation.set(0.35, rot, 0);
        g.add(t);
      }
      g.rotation.x = -0.35;
      g.position.set(0.22, -0.24, -0.42);
      this.handTorch = g;
      this.cam.camera.add(g);
      if (!this.cam.camera.parent) this.scene.add(this.cam.camera);
    }
    this.torchOn = !this.torchOn;
    this.handTorch.visible = this.torchOn;
    if (this.torchOn) playAt('torch', 1, 0.3, 0.55);
  }
  startWalk(tileX: number, tileY: number, heading = 0): void {
    if (!this.state) return;
    const keys = new Set<string>();
    this.walk = { x: tileX, z: tileY, yaw: heading, pitch: -0.05, keys, bob: 0 };
    const cam = this.cam.camera;
    cam.fov = 70; cam.near = 0.05; cam.updateProjectionMatrix();
    const down = (e: KeyboardEvent): void => {
      if (!this.walk) return;
      // Esc bez zablokowanego kursora (przeglądarka nie dała blokady, np. start spaceru z kliknięcia mapy): wyjście ze spaceru
      if (e.key === 'Escape' && document.pointerLockElement !== this.canvas) { e.stopImmediatePropagation(); end(); return; }
      if (e.code === 'KeyF' && !e.repeat) this.toggleHandTorch();
      keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF'].includes(e.code)) e.stopImmediatePropagation();
    };
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
      // wyjście bez Esc (śmierć, wyjście z kopalni): zwalniamy kursor, inaczej kamera mapy nie dostaje ruchów myszy aż do Esc
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      // kamera wraca nad miejsce, w którym skończył się spacer (lookAt sam przycina je do dozwolonego obszaru mapy)
      if (this.inMine) this.leaveMine(); // Esc w sztolni: wychodzimy przed kopalnię
      const ex = this.walk?.x ?? tileX, ez = this.walk?.z ?? tileY;
      this.walk = null; this.walkEnd = null;
      if (this.roomLight) this.roomLight.intensity = 0;
      if (this.torchOn) this.toggleHandTorch();
      cam.fov = 38; cam.near = 0.5; cam.updateProjectionMatrix();
      this.cam.lookAt(ex - this.state!.map.width / 2, ez - this.state!.map.height / 2, 22);
      this.onWalkEnd();
    };
    this.walkEnd = end;
    this.walkSeen = 0; this.walkSeenShown = false;
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('mousemove', move);
    this.canvas.addEventListener('click', click);
    void this.canvas.requestPointerLock();
    // pointerlockchange przychodzi chwilę po zablokowaniu kursora; dopiero potem słuchamy wyjścia (Esc)
    setTimeout(() => document.addEventListener('pointerlockchange', lock), 300);
  }
  /** Spacer: siatki budynków w pobliżu (widoczne), z drzewami BVH do szybkich promieni */
  private walkHits: { mesh: THREE.Mesh; box: THREE.Box3; root: THREE.Object3D; low?: boolean }[] = [];
  private walkCache = new WeakMap<THREE.Group, { mesh: THREE.Mesh; box: THREE.Box3; root: THREE.Object3D; low?: boolean }[]>();
  private gatherWalkHits(wx: number, wz: number): void {
    this.walkHits.length = 0;
    for (const [bid, grp] of this.buildingMeshes) {
      if (Math.abs(grp.position.x - wx) > 9 || Math.abs(grp.position.z - wz) > 9) continue;
      let list = this.walkCache.get(grp);
      // obozowisko nie ma ścian, tylko niskie rzeczy (krąg kamieni, stołki, stos drewna): sprawdzamy je też tuż nad ziemią
      const low = BUILDINGS[this.state?.buildings.find((b) => b.id === bid)?.type ?? -1]?.id === 'camp';
      if (!list) {
        // raz na budynek: wszystkie stałe siatki (bez płomieni, szyb i dymu) z ramką w świecie i drzewem BVH
        list = [];
        grp.updateMatrixWorld(true);
        grp.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || !m.geometry.getAttribute('position')) return;
          const mat = m.material as THREE.Material;
          if (!mat || Array.isArray(mat) || mat.transparent || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
          const geo = m.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
          if (!geo.boundingBox) geo.computeBoundingBox();
          list!.push({ mesh: m, box: geo.boundingBox!.clone().applyMatrix4(m.matrixWorld), root: grp, low });
        });
        this.walkCache.set(grp, list);
      }
      for (const h of list) {
        const bx = h.box;
        if (wx < bx.min.x - 0.6 || wx > bx.max.x + 0.6 || wz < bx.min.z - 0.6 || wz > bx.max.z + 0.6) continue;
        // tylko to, co teraz widać (ukryte wnętrze, zdjęty dach, schowana krata nie przeszkadzają)
        let o: THREE.Object3D | null = h.mesh, vis = true;
        while (o && o !== h.root) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (!vis) continue;
        // ruchome części (wrota, krata): ramka i macierz z bieżącego położenia
        if (h.mesh.parent !== h.root) { h.mesh.updateWorldMatrix(true, false); h.box.copy(h.mesh.geometry.boundingBox!).applyMatrix4(h.mesh.matrixWorld); }
        // drzewo BVH dopiero dla siatki, przy której naprawdę stoimy (wcześniej od razu dla wszystkich budynków w promieniu 9 pól)
        const geo = h.mesh.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
        if (!geo.boundsTree) geo.boundsTree = new MeshBVH(geo);
        this.walkHits.push(h);
      }
    }
  }
  /** Czy bliżej niż r od punktu (świat) na którejś z wysokości ys jest ściana albo sprzęt (najbliższy punkt siatki, drzewo BVH) */
  private walkTouch(x: number, z: number, ys: number[], r: number, lowY?: number): boolean {
    const inv = this.walkInv, pt = this.walkPt, hit = this.walkHit;
    for (const { mesh, box, low } of this.walkHits) {
      if (x < box.min.x - r || x > box.max.x + r || z < box.min.z - r || z > box.max.z + r) continue;
      const tree = (mesh.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree!;
      inv.copy(mesh.matrixWorld).invert();
      const sc = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
      for (const y of low && lowY !== undefined ? [lowY, ...ys] : ys) {
        if (y < box.min.y - r || y > box.max.y + r) continue;
        pt.set(x, y, z).applyMatrix4(inv);
        const res = tree.closestPointToPoint(pt, hit, 0, r / sc);
        if (res && res.distance < r / sc) return true;
      }
    }
    return false;
  }
  private walkInv = new THREE.Matrix4();
  private walkPt = new THREE.Vector3();
  private walkHit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  private walkGatherAt = { x: 1e9, z: 1e9, t: 0 };
  private foreign(): void {
    if (this.time - this.foreignAt < 3) return;
    this.foreignAt = this.time;
    this.onWalkAlert('foreign');
  }
  /**
   * Straż wroga a spacerowicz (tylko obraz: spacerowicz nie jest jednostką symulacji, więc w grze sieciowej nic się
   * nie rozjeżdża). Żołnierz wroga w zasięgu wzroku albo wejście na cudzą działkę = zauważony; po chwili w zasięgu
   * dopadają go i spacer się kończy (kamera wraca nad mapę). True, gdy spacer właśnie się skończył.
   */
  private watchedByEnemy(dt: number): boolean {
    const g = this.state!, w = this.walk!;
    const myTeam = g.players[this.me]?.team ?? -1;
    const enemy = (owner: number): boolean => owner !== this.me && (g.players[owner]?.team ?? -2) !== myTeam;
    const SIGHT = 7;
    let near = Infinity, spotted = false;
    for (const s of g.soldiers) {
      if (s.hp <= 0 || !enemy(s.owner)) continue;
      const d = Math.hypot(s.px / 256 - w.x, s.py / 256 - w.z); // pozycje w symulacji: stały przecinek ×256
      if (d < (s.up ? SIGHT + 4 : SIGHT)) spotted = true; // z wieży widać dalej
      if (d < near) near = d;
    }
    // na cudzej działce (chata, kopalnia, zamek): ktoś zawsze patrzy — łucznicy z murów, ludzie z okien
    let trespass = false;
    for (const b of g.buildings) {
      if (!enemy(b.owner) || b.ruined) continue;
      const def = BUILDINGS[b.type]!;
      if (def.road || def.line) continue;
      const fp = footprint(def, b.rot), m = def.id === 'keep' ? 2 : 0.3;
      if (w.x > b.x - m && w.x < b.x + fp.w + m && w.z > b.y - m && w.z < b.y + fp.h + m) { trespass = true; break; }
    }
    const seen = spotted || trespass;
    // im bliżej, tym szybciej dobiegają; tuż obok — cios od razu
    const rate = near < SIGHT ? 1 + (SIGHT - near) / 3 : 0.8;
    this.walkSeen = seen ? this.walkSeen + dt * rate : Math.max(0, this.walkSeen - dt * 0.7);
    if (seen && !this.walkSeenShown && this.walkSeen > 0.15) { this.walkSeenShown = true; playAt('alert', 0.8, 0, 0.6); this.onWalkAlert('seen'); }
    if (!seen && this.walkSeenShown && this.walkSeen <= 0) { this.walkSeenShown = false; this.onWalkAlert('safe'); }
    if (near < 1.2 || this.walkSeen > 4) {
      this.walkSeen = 0; this.walkSeenShown = false;
      playAt('hit', 1, 0, 0.7);
      this.onWalkAlert('killed');
      this.walkEnd?.();
      return true;
    }
    return false;
  }
  private stepWalk(dt: number): void {
    if (this.inMine) { this.stepMine(dt); return; }
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
    // skok spacją: wybicie, łuk w górę i lądowanie (w powietrzu niskie przeszkody, np. ławy, nie zatrzymują)
    if (k.has('Space') && !w.jy) { w.vy = 2.5; w.jy = 0.0001; }
    if (w.jy) {
      w.jy += (w.vy ?? 0) * dt; w.vy = (w.vy ?? 0) - 9.5 * dt;
      if (w.jy <= 0) { w.jy = 0; w.vy = 0; playAt(this.surface(g, w.x, w.z), 0.9, 0, 0.85); }
    }
    // wysokość stóp spacerowicza (na murach i schodach przeszkody z dołu go nie dotyczą)
    const feet = (this.view ? this.standY(this.view, w.x, w.z) : 0) + (w.jy ?? 0);
    const point = (x: number, z: number, ring: readonly (readonly [number, number])[]): boolean => {
      const tx = Math.floor(x), ty = Math.floor(z);
      if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
      const t = ty * g.map.width + tx;
      // w karczmie (i na jej ganku): obrys izby i drzwi z modelu, sprzęty na swojej wysokości
      const wb = this.walkableAt(x, z);
      const ft = wb && walkFoot(wb[4]);
      if (wb && ft && (wb[1] < ft[0] || wb[1] > ft[1] || wb[2] < ft[2] || wb[2] > ft[3])) return true;   // podwórko przed chatą, w obrysie działki
      if (wb) {
        const y = feet - wb[3];
        for (const [ox, oz] of ring) {
          const lx = wb[1] + ox, lz = wb[2] + oz;
          if (ft && (lx < ft[0] || lx > ft[1] || lz < ft[2] || lz > ft[3])) continue;
          if (!wb[4].open.some(([x0, x1, z0, z1]) => lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1)) return false;
          for (const [x0, x1, z0, z1, y0, y1] of wb[4].solid) if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1 && y + 0.3 > y0 && y < y1 - 0.05) return false;
        }
        return true;
      }
      if (!((g.occupancy[t] === 0 || g.gates[t] !== 0) && g.map.tiles[t] !== Terrain.Water && g.map.tiles[t] !== Terrain.Mountain)) return false;
      // ściany między polami (w zamku): ta sama zasada co dla ludzi w symulacji — przez drzwi tak, przez ścianę nie
      const fx0 = Math.floor(w.x), fz0 = Math.floor(w.z);
      if (fx0 !== tx || fz0 !== ty) {
        const from = fz0 * g.map.width + fx0, ox = tx - fx0, oz = ty - fz0;
        if (Math.abs(ox) + Math.abs(oz) === 1 && wallBetween(g, from, ox, oz)) return false;
      }
      // przy zamku: ściany sal, kraty, sprzęty, baszty i wieże bramy (każda przeszkoda na swojej wysokości)
      const k = this.keepAt(x, z);
      if (k) {
        const base = k[3], y = feet - base;
        for (const [ox, oz] of ring) {
          const lx = k[1] + ox, lz = k[2] + oz;
          for (const [x0, x1, z0, z1, y0, y1] of KEEP_SOLID) if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1 && y + 0.3 > y0 && y < y1 - 0.05) return false;
        }
      }
      return true;
    };
    // ciało spacerowicza: kamera trzyma się ok. 0,11 pola od ścian, sprzętów i pni (bliżej przednia płaszczyzna kamery wchodziła w ściany)
    const BODY = 0.11, D = BODY * 0.7071, W2 = g.map.width / 2, H2 = g.map.height / 2;
    // zbiór siatek w pobliżu odświeżany co kilka kroków (i tak sięga 0,6 pola dalej niż ciało)
    const gt = this.walkGatherAt;
    if (Math.hypot(w.x - gt.x, w.z - gt.z) > 0.3 || this.time - gt.t > 0.3 || this.time < gt.t) { this.gatherWalkHits(w.x - W2, w.z - H2); gt.x = w.x; gt.z = w.z; gt.t = this.time; }
    const RING = [[0, 0], [BODY, 0], [-BODY, 0], [0, BODY], [0, -BODY], [D, D], [D, -D], [-D, D], [-D, -D]] as const;
    const free = (x: number, z: number): boolean => {
      if (!point(x, z, RING)) return false;
      // poza budynkami z modelem (także przy zamku i w nim): obrys ciała też nie może wejść na zajęte pole ani za ścianę między polami
      if (!this.walkableAt(x, z)) for (const [ox, oz] of RING) if ((ox || oz) && !point(x + ox, z + oz, [[0, 0]])) return false;
      if (this.view && this.view.trunkNear(x, z, BODY * 0.8)) return false;
      // duży głaz (boulders.ts): kolizja jak z pniem — bryła zajmuje ok. 0,8 pola
      { const tx = Math.floor(x), tz = Math.floor(z); if (tx >= 0 && tz >= 0 && tx < g.map.width && tz < g.map.height && boulderAt(g, tz * g.map.width + tx) && Math.hypot(x - tx - 0.5, z - tz - 0.5) < 0.4 + BODY) return false; }
      // prawdziwe siatki budynków: promienie na wysokości kolan i oczu, żeby kamera nigdy nie weszła w ścianę ani sprzęt
      return !this.walkTouch(x - W2, z - H2, [feet + 0.3, feet + 0.46], BODY, feet + 0.13);
    };
    // małymi krokami: przy niskim FPS jeden duży skok przeskoczyłby cienką ścianę
    const nStep = Math.min(40, Math.ceil(Math.hypot(dx, dz) / 0.04));
    // stoi już za blisko ściany (start spaceru, skok, otwarte wrota): wolno mu odejść, sprawdzamy wtedy tylko środek
    const ok = free(w.x, w.z) ? free : (x: number, z: number): boolean => point(x, z, [[0, 0]]);
    const sx0 = dx / nStep, sz0 = dz / nStep, sl = Math.hypot(sx0, sz0);
    for (let i = 0; i < nStep; i++) {
      const x0 = w.x, z0 = w.z;
      if (ok(w.x + sx0, w.z)) w.x += sx0;
      if (ok(w.x, w.z + sz0)) w.z += sz0;
      // utknął na framudze drzwi albo rogu: lekko w bok, jeśli stamtąd da się iść dalej (wejście w drzwi bez celowania co do centymetra)
      if (w.x === x0 && w.z === z0 && sl > 0) {
        const px = -sz0 / sl, pz = sx0 / sl;
        let moved = false;
        for (const o of [0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12]) {
          const nx = x0 + px * o, nz = z0 + pz * o;
          if (!ok(nx, nz) || !ok(nx + sx0, nz + sz0)) continue;
          // przesuwa się w stronę prześwitu o długość kroku (płynnie, bez skoku na bok)
          const k = Math.sign(o) * Math.min(Math.abs(o), sl);
          if (ok(x0 + px * k, z0 + pz * k)) { w.x = x0 + px * k; w.z = z0 + pz * k; moved = true; }
          break;
        }
        if (!moved) break;   // ściana na całej szerokości: dalsze kroki w tej klatce i tak nic nie dadzą
      }
    }
    // tempo kroków jak u człowieka: idąc ok. 1,8 kroku na sekundę, biegiem ok. 2,7 (kołysanie kamery w tym samym rytmie)
    if ((fx || fz) && !w.jy) w.bob += (run ? 2.7 : 1.8) * Math.PI * dt;
    // własne kroki w spacerze: na każdy krok dźwięk podłoża, lewa i prawa noga lekko z boku
    const stepK = Math.floor(w.bob / Math.PI);
    if (stepK !== this.walkStep) { this.walkStep = stepK; playAt(this.surface(g, w.x, w.z), 0.9, stepK % 2 ? 0.12 : -0.12, run ? 0.85 : 0.7); }
    const cam = this.cam.camera;
    const { width, height } = g.map;
    const ground = this.view ? this.standY(this.view, w.x, w.z) : 0;
    // ślady butów także za tym, kto chodzi spacerem (z pierwszej osoby); w skoku stopy nie dotykają śniegu
    if ((fx || fz) && !w.jy) this.feet.set(-1, [w.x, w.z, ground]);
    // w pomieszczeniu (nie na dziedzińcu): dach znika, widać sufit; przy zamku jego wnętrza są zawsze widoczne
    const kp = this.keepAt(w.x, w.z);
    const inRoom = !!kp && Math.abs(kp[1]) < KEEP_HALF && Math.abs(kp[2]) < KEEP_HALF && 'TKCBLQ1234'.includes(keepRoom(Math.floor(kp[1] + KEEP_HALF), Math.floor(kp[2] + KEEP_HALF)));
    const wbk = this.walkableAt(w.x, w.z), tap = wbk?.[4].open[0];
    // w kopalni „salą” jest cała sztolnia: już w korytarzu za portalem garb skały znika, a pokazuje się grota ze stropem
    // (inaczej garb, wciąż widoczny w korytarzu, zastawiał przejście do groty)
    const inside = (r: [number, number, number, number] | undefined): boolean => !!wbk && !!r && wbk[1] >= r[0] && wbk[1] <= r[1] && wbk[2] >= r[2] && wbk[2] <= r[3];
    // kopalnia: garb skały zostaje zawsze na miejscu (wnętrze to osobna sztolnia), inaczej tuż przed portalem
    // znikał i przez otwór było widać zbocze gór za kopalnią
    const inTap = !!wbk && wbk[4] !== OREMINE_WALK && inside(tap);
    // pod oczepem portalu kopalni: od razu przejście do sztolni (osobna lokacja), bez pół kroku „pustego” korytarza
    if (wbk && wbk[4] === OREMINE_WALK && wbk[2] < 1.32 && Math.abs(wbk[1]) < 0.45) {
      const mb = g.buildings.find((x) => x.id === wbk[0]);
      if (mb && mb.owner === this.me) { this.enterMine(wbk[0]); return; }
      // cudza kopalnia: wrota zamknięte, spacerowicz odbija się od portalu
      this.foreign();
      const th = ((mb?.rot ?? 0) * Math.PI) / 2;
      w.x += Math.sin(th) * 0.6; w.z += Math.cos(th) * 0.6;
    }
    if (this.watchedByEnemy(dt)) return;
    this.walkHall = inRoom ? kp![0] : inTap ? wbk![0] : 0;
    this.walkNear = wbk ? wbk[0] : kp ? kp[0] : 0; // budynek pod nogami ma pierwszeństwo przed zamkiem obok
    // budynki w zasięgu wzroku spacerowicza: ich wnętrza (podłoga, sprzęty) widać przez drzwi i okna już z ulicy,
    // a nie dopiero po wejściu na próg; dalej wnętrze i tak ginie w mroku, więc go nie rysujemy
    this.walkInView.clear();
    for (const [id, mesh] of this.buildingMeshes) {
      const dx = mesh.position.x - cam.position.x, dz = mesh.position.z - cam.position.z;
      if (dx * dx + dz * dz < WALK_SEE_R * WALK_SEE_R) this.walkInView.add(id);
    }
    // stopy idą po podłożu z lekkim wygładzeniem: próg chaty, skraj sadu czy bruku to krok, a nie skok kamery
    const gy = Math.max(ground, 0);
    w.gy = w.gy === undefined || Math.abs(gy - w.gy) > 0.4 ? gy : w.gy + (gy - w.gy) * Math.min(1, dt * 12);
    cam.position.set(w.x - width / 2, w.gy + 0.46 + (w.jy ?? 0) + (w.jy ? 0 : Math.sin(w.bob) * 0.02), w.z - height / 2);
    // izby w basztach (narożne i w połowie boków) też mają ogień
    const tdx = kp ? Math.floor(kp[1] + KEEP_HALF) : -1, tdy = kp ? Math.floor(kp[2] + KEEP_HALF) : -1;
    const inTower = !!kp && keepTile(tdx, tdy) === '=' && (((tdx === 0 || tdx === KEEP_SIZE - 1) && (tdy === 0 || tdy === KEEP_SIZE - 1 || tdy === KEEP_SIZE >> 1))
      || (tdy === KEEP_SIZE - 1 && (keepTile(tdx - 1, tdy) === 'G' || keepTile(tdx + 1, tdy) === 'G'))); // baszty i wieże bramy
    this.roomLight.intensity = inRoom || inTower || inTap ? 3.4 + Math.sin(this.time * 7) * 0.2 : 0;
    this.roomLight.position.set(cam.position.x, cam.position.y + 0.35, cam.position.z);
    cam.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
    // pochodnia w ręce przy patrzeniu w dół: podnosi się i przechyla z powrotem do pionu (jak trzymana przy piersi),
    // zamiast obracać się razem z widokiem i wchodzić w ziemię (Michał 30.10.2026)
    if (this.handTorch) {
      const down = Math.max(0, -w.pitch);
      this.handTorch.position.set(0.22, -0.24 + down * 0.2, -0.42 + down * 0.1);
      this.handTorch.rotation.x = -0.35 + down * 0.85;
    }
  }

  /** `paused` = pauza: kamera dalej się rusza, ale ludzie, zwierzęta, ogień i woda stoją w miejscu */
  frame(realDt: number, alpha: number, paused = false): void {
    // w trakcie kompilacji shaderów w tle nie rysujemy: rysowanie czekałoby na kartę i strona by zamarzła
    if (this.warming || this.held || this.building) return;
    const f0 = performance.now();
    this.fparts = {};
    this.lastAlpha = alpha;
    namedTick();
    // co pół sekundy: wyjątki od granicy kamery przy własnych budynkach poza środkiem mapy (kopalnia pod górami)
    if (this.state && (this.reachTick = (this.reachTick + 1) % 30) === 0) this.updateReach(this.state);
    if (this.walk && this.state) this.stepWalk(realDt); else this.cam.update(realDt);
    {
      // słuch: w widoku z góry ucho w punkcie, na który patrzy kamera (wyżej przy oddaleniu), w spacerze w oczach postaci
      const f = this.focusPoint, cam = this.cam.camera;
      cam.updateMatrixWorld();
      const r = this.earRight.setFromMatrixColumn(cam.matrixWorld, 0);
      setListener(f.x, f.y, f.z, this.walk ? 0 : this.cam.distance, r.x, r.z, !!this.walk);
      updateLoops(paused);
    }
    // zepsuta długość klatki (NaN, ujemna) zatrułaby deszcz, mgłę i zachmurzenie na zawsze
    const dt = paused || !Number.isFinite(realDt) || realDt < 0 ? 0 : realDt;
    this.time += dt;
    this.frameDt = dt;
    this.dust.update(dt);
    this.breath?.update(dt);
    this.updateRain(dt);
    this.skyDome.update({ camera: this.cam.camera, rain: this.rain, cover: this.cover, dayMist: this.dayMist, night: this.night, time: this.time, sunDir: this.sunDir, hour: this.state ? clockAt(this.state.tick).hour : 12 });
    if (this.state) this.setDaylight(this.menuNight ? MENU_HOUR : this.alwaysDay ? 11 : clockAt(this.state.tick).hour);
    if (this.inMine) {
      // w sztolni: bez słońca i nieba, ciemna mgła, światło tylko z latarń
      this.sun.intensity = 0; this.hemi.intensity = 0.1; this.scene.environmentIntensity = this.envOn ? 0.03 : 0;
      const fog = this.scene.fog as THREE.Fog;
      fog.color.setHex(0x0b0806); fog.near = 3; fog.far = 20;
      (this.scene.background as THREE.Color).setHex(0x0b0806);
    }
    this.bolts.update(dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); this.hemi.intensity += this.flash * 3 * (Math.random() < 0.7 ? 1 : 0.3); }
    this.aimSun();
    this.updateSeason(dt);
    // cienie chmur: przy pogodzie z chmurami wyraźniejsze, nocą, w deszczu (pełne zachmurzenie) i we mgle znikają
    setCloudShadows(this.calm ? 0 : this.time, Math.min(1, 0.75 + this.cover * 0.5) * (1 - this.night) * (1 - this.rain * 0.8) * (1 - this.dayMist * 0.6));
    if (this.state && this.view) {
      const g = this.state, v = this.view;
      // każdy etap mierzony osobno: okno wydajności pokazuje, co zjada czas klatki
      const T = (name: string, fn: () => void): void => { const t0 = performance.now(); fn(); const d = performance.now() - t0; this.timing[name] = (this.timing[name] ?? 0) + d; this.fparts[name] = (this.fparts[name] ?? 0) + d; };
      T('animacje', () => { this.animate(g, this.calm ? 0 : dt); if (!this.calm) v.animate(this.time); });
      T('las', () => this.syncForest(g, v));
      { const f = this.focusPoint; v.updateGrass(f.x, f.z, this.calm ? 0 : this.time, this.walk ? 0 : this.cam.distance); }
      if (this.lodTick++ % 10 === 0) { const f = this.focusPoint; v.lod(f.x, f.z, this.walk ? 0 : Math.max(0, this.cam.distance - 30) * 0.35, this.walk ? 1 : this.detail, !!this.walk); }
      T('drogi', () => this.syncRoads(g, v));
      T('gruz', () => this.rubble.sync(g, v, dt));
      T('groby', () => this.graves.sync(g, v));
      T('towar pod magazynami', () => this.piles.sync(g, v, this.me, this.time));
      T('światła', () => this.syncLamps(g));
      T('budynki', () => { this.syncAreas(g, v); this.syncBuildings(g, v); this.sites.sync(g, this.view, this.buildingMeshes, { time: this.time, calm: this.calm, lodTick: this.lodTick }); this.walls.sync(g, v, this.buildingMeshes); this.wear.sync(g, v, this.buildingMeshes); this.scorch.sync(g, this.buildingMeshes); this.repairs.sync(g, v, this.buildingMeshes, this.time, this.calm); this.braziers.sync(g, v, this.buildingMeshes); this.gates.sync(g, this.buildingMeshes, dt, this.calm); this.syncStores(g); });
      T('budynki z daleka', () => this.updateLods());
      const cp = this.cam.camera.position;
      for (const f of [this.figures, this.spearmen, this.archers, this.guardsFig, this.kings, this.bodies, this.peasantBodies, this.archerBodies, this.guardBodies, this.menAtArms, this.manAtArmsBodies, this.sappersFig, this.sapperBodies, this.banditsFig, this.banditBodies, this.magesFireFig, this.magesWaterFig, this.battleFireFig, this.battleWaterFig, this.mageBodiesFire, this.mageBodiesWater, this.preacherFig]) f.view(cp);
      for (const t of [this.axes, this.picks, this.clubs, this.forks, this.backPicks, this.beltClubs, this.hammers, this.spades, this.rods, this.handTorches, this.guardTorches, this.buckets, this.bucketWater, this.bedrolls]) t.setView(cp);
      this.crowd.begin(dt);
      T('chłopi', () => { this.syncUnits(g, v, alpha); this.placeWorkerPin(); });
      this.syncCrowdSound(g, v);
      T('wojsko', () => { this.syncSoldiers(g, v, alpha); this.placeFoeMark(); });
      T('klimat', () => { this.syncAmbience(g, v, dt); this.syncFlames(g); });
      T('zwierzęta', () => { this.wolves.sync(g, v, alpha, { time: this.time, calm: this.calm, night: this.night, prevPos: this.prevPos }); this.wolfBlood(g); this.crowLayer.sync(g, v, { time: this.time, calm: this.calm }); this.forestEyes.sync(g, v, { time: this.time, calm: this.calm, night: this.night }); this.syncVillage(g, v, dt); });
      T('budynki razem', () => this.syncBatches());
      T('kadr', () => { this.cullInstances(); this.cullVegetation(v); });
    }
    if (this.dry) return; // przygotowanie widoku: obiekty zaktualizowane, rysowanie pomijamy
    this.renderer.info.reset(); // liczymy wszystkie przejścia klatki razem (AO, wyjście)
    // okno wydajności otwarte: co 15. klatka mierzona przejście po przejściu (ta jedna klatka jest wolniejsza, więc jej
    // czasu nie wliczamy do zwykłego „karta graficzna”)
    if (GL_DEBUG) this.tagPasses();
    // nowe modele w scenie (budynki, drzewa, ludzie) dostają filtrowanie tekstur i wygładzanie liści z ustawień
    if (++this.matSweep % 90 === 0) this.matQ.sweep(this.scene);
    // pule instancji bez ani jednej sztuki (zbóje, tarany, wilki, ładunki, gdy nikt nic nie niesie…) nie idą do karty:
    // three.js wysyła dla nich polecenie rysowania z zerem sztuk — ok. 1/5 wszystkich wywołań klatki
    const empties = this.hideEmptyPools();
    try {
    if (this.gpuProfile && this.profN++ % 15 === 0) { this.profiledRender(); return; }
    const tg = performance.now();
    // odbicie w wodzie (od średniej grafiki w górę, jak poświata)
    // nowe obiekty z shaderami w trakcie kompilacji nie są rysowane w tej klatce (bez blokowania strony)
    // nowe obiekty dostają łatkę pór roku od razu, przed kompilacją (inaczej skan co 3 s łatał je później
    // i shadery kompilowały się drugi raz, już na żywo)
    if (this.pre.hasFresh() && tg - this.seasonPatchAt > 150) { this.seasonPatchAt = tg; for (const m of applySeason(this.scene)) this.pre.watch(m); }
    const restore = this.pre.beforeRender(this.cam.camera);
    try {
      this.view?.reflectWater(this.renderer, this.scene, this.cam.camera, this.bloom.enabled);
      this.composer.render();
    } finally { restore(); }
    const gpu = performance.now() - tg;
    this.timing['karta graficzna'] = (this.timing['karta graficzna'] ?? 0) + gpu;
    this.dynamicResolution(gpu);
    this.timingFrames++;
    // wolne klatki (ponad 200 ms) z rozbiciem na etapy: window.__slowFrames (do szukania przycięć w Chrome)
    const total = performance.now() - f0;
    if (total > 200) {
      this.fparts['karta graficzna'] = gpu;
      const top = Object.entries(this.fparts).filter(([, v]) => v > 20).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${Math.round(v)}`);
      const list = ((window as unknown as { __slowFrames?: unknown[] }).__slowFrames ??= []);
      if (list.length < 40) list.push([Math.round(f0), Math.round(total), top.join(', ')]);
    }
    } finally { for (const m of empties) m.visible = true; }
  }

  /** Wszystkie pule instancji w scenie (lista odświeżana co 60 klatek — nowe pule powstają rzadko) */
  private pools: THREE.InstancedMesh[] = [];
  private poolScan = 0;
  private emptyHidden: THREE.InstancedMesh[] = [];
  /** Chowa na czas rysowania pule z zerową liczbą sztuk; zwraca listę do przywrócenia po klatce */
  private hideEmptyPools(): THREE.InstancedMesh[] {
    if (this.poolScan-- <= 0) {
      this.poolScan = 60;
      this.pools.length = 0;
      this.scene.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) this.pools.push(o as THREE.InstancedMesh); });
    }
    const out = this.emptyHidden;
    out.length = 0;
    for (const m of this.pools) if (m.visible && m.count === 0) { m.visible = false; out.push(m); }
    return out;
  }

  /** Tryb ?gldebug=1: każde przejście rysowania podpisane w dzienniku błędów (wiadomo, czy błąd jest w cieniach, AO, poświacie…) */
  private passesTagged = false;
  private tagPasses(): void {
    glSection('przed rysowaniem');
    if (this.passesTagged) return;
    this.passesTagged = true;
    const wrap = <T extends object>(o: T, key: keyof T, name: string): void => {
      const f = o[key] as unknown as (...a: unknown[]) => unknown;
      (o as Record<keyof T, unknown>)[key] = (...a: unknown[]): unknown => { const was = glSection(name); try { return f.apply(o, a); } finally { glSection(was); } };
    };
    wrap(this.renderer.shadowMap as unknown as { render: () => void }, 'render', 'cienie');
    for (const p of this.composer.passes) wrap(p, 'render', this.passName(p));
  }

  /** Okno wydajności (F3) otwarte: mierzymy, ile karta graficzna liczy cienie, scenę, AO, poświatę i resztę przejść */
  gpuProfile = false;
  private profN = 0;
  private prof: Record<string, number> = {};
  private profFrames = 0;
  private gpuLast: Record<string, string | number> = {};
  private passName(p: object): string {
    return p === this.ao ? 'AO' : p === this.plain ? 'obraz' : p === this.bloom ? 'poświata' : p === this.sanitize ? 'czyszczenie obrazu'
      : p === this.grade ? 'barwy' : p === this.fxaa ? 'FXAA' : p === this.smaa ? 'SMAA' : p === this.sharpen ? 'wyostrzenie'
      : p instanceof OutputPass ? 'wyjście' : 'inne';
  }
  /**
   * Jedna klatka mierzona dokładnie: przed i po każdym kawałku czekamy, aż karta skończy (gl.finish), więc czas kawałka
   * to naprawdę jego praca na karcie. Kawałki: mapa cieni (w środku rysowania sceny), scena, każde przejście obrazu.
   */
  private profiledRender(): void {
    const r = this.renderer, gl = r.getContext(), info = r.info.render, acc = this.prof;
    const add = (k: string, v: number): void => { acc[k] = (acc[k] ?? 0) + v; };
    const seg = (name: string, fn: () => void): void => {
      gl.finish();
      const t0 = performance.now(), c0 = info.calls, t0r = info.triangles;
      fn();
      gl.finish();
      add(name, performance.now() - t0); add(name + '#w', info.calls - c0); add(name + '#t', info.triangles - t0r);
    };
    const restore: (() => void)[] = [];
    const sm = r.shadowMap as unknown as { render: (...a: unknown[]) => void };
    const smRender = sm.render;
    sm.render = (...a: unknown[]): void => seg('cienie', () => smRender.apply(sm, a));
    restore.push(() => { sm.render = smRender; });
    const rRender = r.render;
    r.render = ((sc: THREE.Object3D, c: THREE.Camera): void => {
      if (sc === this.scene) seg('scena', () => rRender.call(r, sc, c)); else rRender.call(r, sc, c);
    }) as typeof rRender;
    restore.push(() => { r.render = rRender; });
    for (const p of this.composer.passes) {
      if (!p.enabled) continue;
      const pRender = p.render, name = this.passName(p);
      p.render = ((...a: Parameters<typeof pRender>): void => seg('p:' + name, () => pRender.apply(p, a))) as typeof pRender;
      restore.push(() => { p.render = pRender; });
    }
    try { seg('klatka', () => this.composer.render()); } finally { for (const f of restore) f(); }
    this.profFrames++;
  }
  /** Wyniki pomiaru od ostatniego odczytu (ms na klatkę i liczba wywołań / trójkątów), potem zerowanie */
  readGpu(): Record<string, string | number> {
    const n = this.profFrames, a = this.prof, out: Record<string, string | number> = {};
    if (!n) return this.gpuLast; // w tej sekundzie nie było mierzonej klatki: pokazujemy poprzedni wynik
    const ms = (k: string): number => (a[k] ?? 0) / n;
    const cnt = (k: string): string => `${Math.round((a[k + '#w'] ?? 0) / n)} wyw., ${Math.round((a[k + '#t'] ?? 0) / n / 1000)} tys. trójk.`;
    const f = (v: number): string => v.toFixed(2);
    out['  cienie'] = `${f(ms('cienie'))} ms · ${cnt('cienie')}`;
    out['  scena'] = `${f(ms('scena') - ms('cienie'))} ms · ${Math.round(((a['scena#w'] ?? 0) - (a['cienie#w'] ?? 0)) / n)} wyw., ${Math.round(((a['scena#t'] ?? 0) - (a['cienie#t'] ?? 0)) / n / 1000)} tys. trójk.`;
    for (const k of Object.keys(a)) {
      if (!k.startsWith('p:') || k.includes('#')) continue;
      const name = k.slice(2);
      // przejście ze sceną (obraz albo AO): sama scena już policzona wyżej
      const own = name === 'AO' || name === 'obraz' ? ms(k) - ms('scena') : ms(k);
      if (name === 'obraz' && own < 0.05) continue;
      out[`  ${name}`] = `${f(own)} ms`;
    }
    out['  razem (pomiar)'] = `${f(ms('klatka'))} ms`;
    this.prof = {}; this.profFrames = 0;
    this.gpuLast = out;
    return out;
  }
  /** Płomienie: pochodnie przy budynkach (zapalone), ogniska w obozowiskach i karczmach, pożary uszkodzonych budynków */
  private syncFlames(g: GameState): void {
    const F = this.flames, w = new THREE.Vector3();
    F.begin(this.calm ? 0 : this.time);
    this.blaze.begin(this.calm ? 0 : this.time);
    this.cam.camera.getWorldPosition(this.camPos);
    const glow = Math.min(1, this.night * 1.4);
    const f = this.focusPoint;
    const lit = new Set<number>();
    // pochodnia na słupie płonie tylko po zmroku (także gdy cykl dnia jest wyłączony, a symulacja ma noc)
    const dark = this.night > 0.12;
    if (dark) for (const b of g.buildings) if (b.lit && !b.ruined && !b.build) lit.add(b.id);
    for (let i = 0; i < this.handFlameN; i++) F.add(this.handFlames[i]!, 0.2, 0.11, (i * 0.377) % 1, glow * 0.6);
    for (let i = 0; i < this.stickFlameN; i++) F.add(this.stickFlames[i]!, 0.13, 0.075, (i * 0.531) % 1, Math.max(0.35, glow));
    // koksowniki na murach i wieżach: płoną dniem i nocą (łucznicy maczają w nich strzały)
    for (const [id, m] of this.braziers.meshes) {
      if ((m.position.x - f.x) ** 2 + (m.position.z - f.z) ** 2 > 110 * 110) continue;
      const fire = m.getObjectByName('warFire');
      if (!fire) continue;
      fire.getWorldPosition(w);
      F.add(w, 0.34 * m.scale.y, 0.2 * m.scale.y, (id * 0.173) % 1, Math.max(0.35, glow));
    }
    // ogniste strzały w locie: mały płomyk na grocie
    // płomyk mały i przygaszony: jasny płomień z poświatą rozlewał się (z daleka strzała wyglądała na większą od człowieka)
    for (let i = 0; i < this.arrows.fireN; i++) F.add(this.arrows.fires[i]!, 0.07, 0.04, (i * 0.531) % 1, glow * 0.35);
    // kule ognia magów w locie i rozbłyski przy celu
    // ogień czarów: mała łuna (duże pomarańczowe tarcze łuny przy wielkim czarze wyglądały jak płaskie owale)
    this.spells.flames().forEach((v, i) => F.add(v, 0.2, 0.13, (i * 0.377) % 1, Math.max(0.5, glow), 0.3));
    this.handFlameN = 0;
    this.handFlameTime.value = this.time;
    const dead = new Set<number>();
    for (const b of g.buildings) if (b.ruined || b.build) dead.add(b.id);
    for (const [id, mesh] of this.buildingMeshes) {
      if ((mesh.position.x - f.x) ** 2 + (mesh.position.z - f.z) ** 2 > 110 * 110) continue;
      // gruz po zburzonym budynku: żadnych pochodni, koszy ani latarni z dawnego modelu
      if (dead.has(id) && !named(mesh, 'fire')?.visible) continue;
      const torchFlame = named(mesh, 'torchflame');
      if (torchFlame && lit.has(id) && this.shownIn(mesh, torchFlame.parent ?? torchFlame)) { torchFlame.getWorldPosition(w); w.y -= 0.12; F.add(w, 0.36, 0.2, (id * 0.137) % 1, glow); }
      // pochodnie w bryle modelu (baszty bram, ściany zamku): po zmroku żywy ogień jak w pochodni chłopa, tylko gdy widoczne
      if (dark) for (const o of this.lightMarks(mesh)) {
        if (!this.shownIn(mesh, o.parent ?? o)) continue;
        o.getWorldPosition(w);
        if (o.name === 'lightSpot') w.y -= 0.08;
        F.add(w, 0.22, 0.12, (o.id * 0.419) % 1, glow * 0.7, 0.6);
      }
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
      // latarnie płonące zawsze (sztolnia, izba baraku) i ognisko przed barakiem: znaczniki z modelu, zapamiętane przy budynku
      let spots = mesh.userData.lampSpots as THREE.Object3D[] | undefined;
      if (!spots) { spots = []; mesh.traverse((o) => { if (o.name === 'lampSpot' || o.name === 'campfire') spots!.push(o); }); mesh.userData.lampSpots = spots; }
      for (const o of spots) {
        let shown = true;
        for (let p: THREE.Object3D | null = o.parent; p && p !== mesh; p = p.parent) if (!p.visible) { shown = false; break; }
        if (!shown) continue;
        o.getWorldPosition(w);
        if (o.name === 'campfire') { F.add(w, 0.42, 0.3, (o.id * 0.311) % 1, glow); F.add(w.set(w.x + 0.04, w.y, w.z - 0.03), 0.3, 0.2, (o.id * 0.731) % 1, 0); if (!this.calm) loop3d(`camp${o.id}`, 'campfire', w.x, w.y, w.z); }
        else F.add(w, 0.11, 0.06, (o.id * 0.419) % 1, glow * 0.5, 0.35); // świeczka, kaganek, latarnia w izbie: mały płomyk i ledwie łuna
      }
      const camp = named(mesh, 'flame');
      if (camp && camp.visible) {
        camp.getWorldPosition(w);
        for (const ch of camp.children) ch.visible = false;
        F.add(w, 0.42, 0.3, (id * 0.311) % 1, glow);
        F.add(w.set(w.x + 0.04, w.y, w.z - 0.03), 0.3, 0.2, (id * 0.731) % 1, 0);
        if (!this.calm) loop3d(`flame${id}`, 'campfire', w.x, w.y, w.z);
      }
      const fire = named(mesh, 'fire');
      if (fire && fire.visible) {
        // pożar to prawdziwa bryła ognia wokół całego budynku (blaze.ts); tu tylko poświata nad nim
        for (const ch of fire.children) ch.visible = false;
        const box = (mesh.userData.burnBox as THREE.Box3 | undefined) ?? (mesh.userData.burnBox = burnBox(mesh));
        const heat = (mesh.userData.fireHeat as number | undefined) ?? 1;
        const bb = g.buildings.find((x) => x.id === id);
        this.blaze.add(id, box, heat, this.camPos, bb ? footprint(BUILDINGS[bb.type]!, bb.rot) : undefined);
        box.getCenter(w);
        const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        F.addGlow(w.setY(box.max.y), span * 1.8, (id * 0.193) % 1, (glow * 0.45 + 0.12) * (0.4 + heat * 0.6));
        // trzask pożaru z miejsca budynku: im więcej ognisk na budynku, tym głośniej
        if (!this.calm) loop3d(`fire${id}`, 'fire', mesh.position.x, mesh.position.y + 1, mesh.position.z, Math.min(1, 0.5 + fire.children.length * 0.15));
      }
    }
    if (this.inMine && this.mineLevel) {
      for (const o of (this.mineLevel.userData.lampSpots as THREE.Object3D[] | undefined) ?? []) { o.getWorldPosition(w); F.add(w, 0.13, 0.07, (o.id * 0.419) % 1, 0.4, 0.5); }
    }
    F.end();
    this.blaze.end();
  }

  /** Dym, iskry, okna i mgła: źródła odświeżane dwa razy na sekundę, cząstki co klatkę */
  private syncAmbience(g: GameState, v: TerrainView, dt: number): void {
    const { width, height } = g.map;
    const focus = this.focusPoint;
    if (this.time > this.fxAt) {
      this.fxAt = this.time + 0.5;
      const list: FxSource[] = [];
      // dym ma powód: w zimne dni ludzie palą w piecach tam, gdzie są (chata z mieszkańcami, warsztat z pracownikiem),
      // piekarz i piwowar palą pod piecem i kotłem tylko przy robocie, karczma wieczorem, kuchnia zamku za dnia
      const temp = weatherOf(g, rainAt(g.tick)).temp;
      const cold = temp < COLD;
      const hour = clockAt(g.tick).hour;
      const home = new Set<number>(), busy = new Set<number>();
      for (const u of g.units) {
        if (u.home && (u.phase === Phase.Sleeping || u.phase === Phase.Resting)) home.add(u.home);
        if (u.job && (u.phase === Phase.Working || u.phase === Phase.Resting)) busy.add(u.job);
      }
      for (const b of g.buildings) {
        const mesh = this.buildingMeshes.get(b.id);
        const fx = mesh?.userData.fx as BuildingFx | undefined;
        if (!mesh || !fx || b.build || b.ruined) continue;
        const fire = named(mesh, 'fire');
        const id = BUILDINGS[b.type]!.id;
        const smoke = !SMOKY.has(id) ? false
          : id === 'bakery' || id === 'brewery' ? busy.has(b.id) || (cold && !!b.worker)
          : id === 'tavern' ? !!b.worker && ((hour >= 17 && hour < 23) || cold)
          : id === 'keep' ? (hour >= 5 && hour < 21) || cold
          : id === 'house' || id === 'tent' ? cold && home.has(b.id)
          : cold && busy.has(b.id);
        list.push({ mesh, fx, smoke, burning: !!fire?.visible });
      }
      this.ambience.setSources(list, focus);
      this.clutter.sync(g, (x, y) => v.heightAt(x, y));
      // chłopi wydeptują ścieżki tam, gdzie chodzą najczęściej
      let n = 0;
      for (const u of g.units) {
        if (u.path.length === 0) continue;
        v.wear(Math.round(u.px / 256), Math.round(u.py / 256), 0.005, 0.3);
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
  /** Etapy bieżącej klatki (ms) — do zapisu wolnych klatek */
  private fparts: Record<string, number> = {};
  private timingFrames = 0;
  quality = '';

  /**
   * Rzeczy rysowane setkami (instancje: postacie, broń, ładunki, drzewa, bale…) poza kadrem nie idą do karty graficznej:
   * ich macierz dostaje na tę klatkę zerową skalę. Oryginał jest odkładany, więc gdy siatki nikt nie przepisze
   * (mury, las), a kamera się przesunie, ukryte instancje wracają same.
   */
  private cullSeen = new Map<THREE.InstancedMesh, { ver: number; r: number; cx: number; cy: number; cz: number; hidden: Uint8Array | null; saved: Float32Array | null }>();
  private cullFrustum = new THREE.Frustum();
  private cullM = new THREE.Matrix4();
  private cullS = new THREE.Sphere();
  culled = 0;
  /** Do porównań wydajności (window.__renderer.cullOn = false) */
  cullOn = true;
  /**
   * Budynki rysowane razem (instancjonowanie): stałe bryły budynków (ściany, dach, sprzęty — po scaleniu w mergeStatic
   * te same siatki dla każdego budynku danego rodzaju) zbieramy co klatkę w jedno InstancedMesh na parę siatka+materiał.
   * Karta dostaje jedno polecenie „narysuj strzechę chaty w tych 20 miejscach” zamiast 20 osobnych. Sam budynek dalej
   * istnieje jak dotąd (widoczność dachu, wnętrza, daleka wersja, podświetlenie i kliknięcie działają bez zmian): jego
   * stałe bryły przenosimy tylko na warstwę 1, której kamera nie rysuje. Place budowy (przycinane) zostają po staremu.
   */
  private batches = new Map<string, { mesh: THREE.InstancedMesh; n: number }>();
  private batchParts = new WeakMap<THREE.Object3D, THREE.Mesh[]>();
  batchOn = !/[?&]razem=0/.test(location.search);   // włączone: 32 budynki, Chrome, hd — 1327 wywołań i 8,8 ms karty (bez: 1650 i 12,5 ms); ?razem=0 wyłącza
  private staticParts(root: THREE.Object3D): THREE.Mesh[] {
    let list = this.batchParts.get(root);
    if (list) return list;
    list = [];
    const walk = (o: THREE.Object3D): void => {
      for (const ch of o.children) {
        // wnętrza, ludzie, ogień, ruchome części: po staremu; pochodnia (słup i kosz, wspólne siatki) i dalekie wersje
        // budynków (wspólne dla budynków tego samego rodzaju) też idą razem
        if (ch.name && !MERGE_IN.has(ch.name) && !BATCH_ALSO.test(ch.name)) continue;
        const m = ch as THREE.Mesh;
        if (m.isMesh && !ch.name && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material)) {
          const mat = m.material as THREE.Material;
          if (!mat.transparent && mat.visible !== false && m.geometry.getAttribute('position')) list!.push(m);
        }
        walk(ch);
      }
    };
    walk(root);
    this.batchParts.set(root, list);
    return list;
  }
  private batchGroups = new Map<string, THREE.Mesh[]>();
  private syncBatches(roots: Iterable<[number, THREE.Object3D]> = this.buildingMeshes, keepOff = false): void {
    for (const b of this.batches.values()) b.n = 0;
    const on = this.batchOn, groups = this.batchGroups;
    for (const l of groups.values()) l.length = 0;
    this.buildingLayer.updateMatrixWorld();
    for (const [id, root] of roots) {
      const parts = this.staticParts(root);
      const own = !on || this.sites.sites.has(id) || !root.visible;
      for (const m of parts) {
        if (own) { m.layers.set(0); continue; }
        let vis = m.visible;
        for (let q: THREE.Object3D | null = m.parent; vis && q; q = q.parent) { if (!q.visible) vis = false; if (q === root) break; }
        if (!vis) { m.layers.set(0); continue; }   // i tak niewidoczna
        const mat = m.material as THREE.Material;
        const key = m.geometry.uuid + mat.uuid + (m.castShadow ? 'c' : '') + (m.receiveShadow ? 'r' : '');
        let l = groups.get(key);
        if (!l) { l = []; groups.set(key, l); }
        l.push(m);
      }
    }
    // razem rysujemy tylko to, co powtarza się w co najmniej dwóch budynkach; pojedyncze siatki rysują się same (z cięciem do kadru)
    for (const [key, list] of groups) {
      if (list.length < 2) { for (const m of list) m.layers.set(0); continue; }
      const m0 = list[0]!;
      let b = this.batches.get(key);
      if (!b || b.mesh.instanceMatrix.count < list.length) {
        if (b) { this.buildingLayer.remove(b.mesh); b.mesh.dispose(); }
        const im = new THREE.InstancedMesh(m0.geometry, m0.material as THREE.Material, Math.max(4, list.length * 2));
        im.castShadow = m0.castShadow; im.receiveShadow = m0.receiveShadow;
        im.userData.noCull = true;
        b = { mesh: im, n: 0 };
        this.batches.set(key, b);
        this.buildingLayer.add(im);
      }
      for (const m of list) { m.layers.set(BATCH_LAYER); b.mesh.setMatrixAt(b.n++, m.matrixWorld); }
    }
    for (const b of this.batches.values()) {
      if (keepOff) continue;
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      if (b.n) { touch(b.mesh); b.mesh.computeBoundingSphere(); }
    }
  }
  private vegView = new THREE.Frustum();
  private vegShadow = new THREE.Frustum();
  /** Roślinność: wspólne pule dostają kawałki w kadrze kamery i w zasięgu mapy cieni słońca (terrain.ts, cullVeg) */
  private cullVegetation(v: TerrainView): void {
    const cam = this.cam.camera;
    cam.updateMatrixWorld();
    this.vegView.setFromProjectionMatrix(this.cullM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let shadow: THREE.Frustum | null = null;
    if (this.sun.castShadow && this.renderer.shadowMap.enabled) {
      // macierze kamery cienia liczymy teraz (te same, które za chwilę policzy mapa cieni)
      this.sun.updateMatrixWorld();
      this.sun.target.updateMatrixWorld();
      this.sun.shadow.updateMatrices(this.sun);
      shadow = this.vegShadow.copy(this.sun.shadow.getFrustum());
    }
    v.cullVegetation(this.vegView, shadow);
  }

  private cullInstances(): void {
    if (!this.cullOn) {
      for (const [m, st] of this.cullSeen) {
        if (!st.hidden || m.instanceMatrix.version !== st.ver) continue;
        const a = m.instanceMatrix.array as Float32Array;
        for (let i = 0; i < st.hidden.length; i++) if (st.hidden[i]) { for (let k = 0; k < 16; k++) a[i * 16 + k] = st.saved![i * 16 + k]!; st.hidden[i] = 0; }
        touch(m); st.ver = m.instanceMatrix.version;
      }
      this.culled = 0;
      return;
    }
    const cam = this.cam.camera;
    cam.updateMatrixWorld();
    this.cullFrustum.setFromProjectionMatrix(this.cullM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let culled = 0;
    const sph = this.cullS, fr = this.cullFrustum;
    this.scene.traverseVisible((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || m.count === 0 || m.count > 4096 || m.userData.noCull) return;
      const attr = m.instanceMatrix, a = attr.array as Float32Array;
      let st = this.cullSeen.get(m);
      if (!st) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const bs = m.geometry.boundingSphere!;
        // drobiazgi (iskry, krople, liście) nie są warte liczenia: tylko siatki od 60 trójkątów w górę
        const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
        st = { ver: tris < 60 ? -2 : -1, r: bs.radius, cx: bs.center.x, cy: bs.center.y, cz: bs.center.z, hidden: null, saved: null };
        this.cullSeen.set(m, st);
      }
      if (st.ver === -2) return;
      // przepisana od ostatniej klatki: ktoś zmienił część instancji (np. ścięte drzewo w kawałku lasu). Te, które
      // ukryliśmy, a których nikt nie ruszył, mają dalej nasze same zera (prawdziwa macierz ma w rogu 1, także zerowa
      // skala ściętego drzewa) — wracają z odłożonej kopii; przepisane zostają takie, jakie są. Inaczej korony drzew
      // ukryte poza kadrem znikały na zawsze, gdy drwal ściął jedno drzewo w tym kawałku lasu (zostawały same pnie).
      if (attr.version !== st.ver && st.hidden) {
        for (let i = 0; i < st.hidden.length && i * 16 < a.length; i++) {
          if (!st.hidden[i] || a[i * 16 + 15] !== 0) continue;
          for (let k = 0; k < 16; k++) a[i * 16 + k] = st.saved![i * 16 + k]!;
          attr.needsUpdate = true;
        }
        st.hidden.fill(0);
      }
      const inView = (src: Float32Array, o16: number): boolean => {
        const sx = src[o16]! * src[o16]! + src[o16 + 1]! * src[o16 + 1]! + src[o16 + 2]! * src[o16 + 2]!;
        const sc = Math.sqrt(Math.max(sx, src[o16 + 4]! * src[o16 + 4]! + src[o16 + 5]! * src[o16 + 5]! + src[o16 + 6]! * src[o16 + 6]!, src[o16 + 8]! * src[o16 + 8]! + src[o16 + 9]! * src[o16 + 9]! + src[o16 + 10]! * src[o16 + 10]!));
        if (sc === 0) return true; // i tak niewidoczna
        sph.center.set(src[o16 + 12]! + st!.cx * sc, src[o16 + 13]! + st!.cy * sc, src[o16 + 14]! + st!.cz * sc).applyMatrix4(m.matrixWorld);
        sph.radius = st!.r * sc + 1.5; // zapas: cień i ruch kamery w tej klatce
        return fr.intersectsSphere(sph);
      };
      let changed = false;
      for (let i = 0; i < m.count; i++) {
        const o16 = i * 16;
        if (st.hidden && st.hidden[i]) {
          // ukryta wcześniej, a nikt jej nie przepisał: wraca, gdy znów jest w kadrze
          if (inView(st.saved!, o16)) { for (let k = 0; k < 16; k++) a[o16 + k] = st.saved![o16 + k]!; st.hidden[i] = 0; changed = true; } else culled++;
          continue;
        }
        if (inView(a, o16)) continue;
        if (!st.saved || st.saved.length < a.length) { st.saved = new Float32Array(a.length); st.hidden = new Uint8Array(a.length / 16); }
        for (let k = 0; k < 16; k++) { st.saved[o16 + k] = a[o16 + k]!; a[o16 + k] = 0; }
        st.hidden![i] = 1;
        changed = true; culled++;
      }
      if (changed) attr.needsUpdate = true;
      st.ver = attr.version;
      if (st.ver === -2) st.ver = -3;
    });
    this.culled = culled;
  }

  /** Częstokół i mury kamienne (src/render/walls.ts) */
  private walls = new WallLayer(this.scene);
  /** Pęknięcia i gruz przy rozbitych murach, wieżach i bramach (src/render/damage.ts) */
  private wear = new WearLayer(this.scene);
  private scorch = new ScorchLayer(this.scene);
  /** Rusztowania przy naprawie (src/render/repairs.ts) */
  private repairs = new RepairLayer(this.buildingLayer);



  get wolvesNear(): number { return this.state?.wolves.length ?? 0; }
  /** Wilki (src/render/wolves.ts) */
  private wolves = new WolfLayer(this.scene, (kind, x, z, key, every, gain) => this.sfxAt(kind, x, z, key, every, gain));

  /** Wrota bram (src/render/gates.ts) */
  private gates = new GateMotion((kind, x, z, key, every, gain) => this.sfxAt(kind, x, z, key, every, gain));

  private wet = 0;
  /** Zachmurzenie 0..1 i mglistość dnia 0..1 (zmienna pogoda) */
  private cover = 0.2;
  private dayMist = 0;
  get weatherText(): string { return this.rain > 0.3 ? tx('deszcz', 'rain') : this.dayMist > 0.4 ? tx('mgła', 'mist') : this.cover > 0.4 ? tx('pochmurno', 'overcast') : tx('pogodnie', 'fair'); }
  private wetShown = -1;
  /** Kałuże (src/render/puddles.ts) */
  private puddleLayer = new PuddleLayer(this.scene);

  /** Kruki (src/render/crows.ts) */
  private crowLayer = new CrowLayer(this.scene);

  /** Iskry i „+1” przy nowym żołnierzu (src/render/spawnfx.ts) */
  private spawnFx = new SpawnFx(this.scene);

  /** Oczy w puszczy (src/render/foresteyes.ts) */
  private forestEyes = new ForestEyes(this.scene);

  /** Do kiedy (czas sceny) pali się uszkodzony budynek */
  private burnUntil = new Map<number, number>();
  private builtAt = 0;
  /** Place budowy (src/render/sites.ts) */
  private sites = new SiteLayer(this.buildingLayer, (x, y, stone, soft) => this.roadDust(x, y, stone, soft), (o) => this.pre?.watch(o));

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
      applyCrest(mesh, TEAM_COLORS[team] ?? 0x888888, this.crestOf(b.owner));
      mesh.userData.fx = collectFx(mesh, isWindowMat);
      mergeStatic(mesh, def.id + ':' + team);
      // sad: płyta łąki z modelu niewidoczna, spod spodu rośnie zwykła trawa mapy (ten sam kolor i kępy co dookoła)
      if (def.id === 'orchard') mesh.traverse((o) => { const mm = (o as THREE.Mesh).material; if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) if (x.userData?.orchardFloor) x.visible = false; });
      // cienie chmur suną też po dachach i ścianach (te same plamy co na ziemi)
      mesh.traverse((o) => { const mm = (o as THREE.Mesh).material; if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) cloudShade(x); });
      let top = -99, low = 99;
      const fp = footprint(def, b.rot);
      // pod budynkiem nie rośnie trawa, krzewy ani nie leżą kamyki; sad stoi na zwykłej łące (trawa z dywanu rośnie
      // dalej, ten sam kolor i kępy co dookoła), łysy jest tylko narożnik ze szopą
      const orchard = def.id === 'orchard';
      const shed = orchard ? orchardShedTile(b.x, b.y, b.rot) : null;
      for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) {
        view.clear(y * width + x);
        if (!shed || (x === shed[0] && y === shed[1])) view.noGrass(y * width + x);
      }
      for (let y = b.y; y <= b.y + fp.h; y++)
        for (let x = b.x; x <= b.x + fp.w; x++) { const hh = view.heightAt(x, y); top = Math.max(top, hh); low = Math.min(low, hh); }
      // budynek siada lekko poniżej najwyższego punktu działki, a teren pod nim się wyrównuje (nasyp od dołu stoku,
      // wkop od góry), więc fundament nigdzie nie wisi nad ziemią i do środka nie zagląda trawa ze zbocza
      const ground = low + (top - low) * 0.35;
      if (!def.wall && !def.road) view.level(b.x, b.y, fp.w, fp.h, ground - 0.01);
      // model sadu stoi na płycie łąki grubej na ORCHARD_FLOOR (w grze niewidocznej): opuszczamy go, żeby płot, jabłka
      // i szopa stały na terenie, a nie 5 cm nad nim
      const sink = orchard ? ORCHARD_FLOOR : 0;
      mesh.position.set(b.x + fp.w / 2 - width / 2, ground - sink, b.y + fp.h / 2 - height / 2);
      if (def.id === 'keep') {
        this.keepFloors.set(b.id, [b.x + KEEP_HALF, b.y + KEEP_HALF, ground]);
        this.keepOwner.set((b.x + KEEP_HALF) * 1000 + (b.y + KEEP_HALF), b.owner);
        // plac przed bramą: bez krzaków i kamyków, ziemia wydeptana najmocniej przy moście
        const gx = b.x + KEEP_GATE[0];
        for (let d = 0; d < FORECOURT.depth; d++) for (let o = -FORECOURT.half; o <= FORECOURT.half; o++) {
          const tx = gx + o, ty = b.y + KEEP_SIZE + d;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          view.clear(ty * width + tx);
          view.wear(tx, ty, Math.max(0.15, 0.6 - d * 0.1 - Math.abs(o) * 0.08));
        }
      }
      const wm = WALK_MODELS[def.id];
      if (wm) this.walkables.set(b.id, { cx: b.x + fp.w / 2, cy: b.y + fp.h / 2, rot: b.rot, base: ground - sink, hw: fp.w / 2, hh: fp.h / 2, m: wm });
      mesh.rotation.y = (b.rot * Math.PI) / 2;
      // ziemia wydeptana tylko tuż przy ścianach (z przerwami) i przy drzwiach; dalej trawa ledwo naruszona
      if (!def.wall && !def.gate && !def.road && def.id !== 'torch') {
        for (let cy = b.y - 1; cy <= b.y + fp.h + 1; cy++) for (let cx = b.x - 1; cx <= b.x + fp.w + 1; cx++) {
          const d = Math.max(b.x - cx, cx - (b.x + fp.w), b.y - cy, cy - (b.y + fp.h), 0);
          if (d === 0 && (hash2(cx, cy, b.id) & 1)) view.wear(cx, cy, 0.18 + (hash2(cx, cy, b.id) & 6) / 40);
        }
        // obozowisko: ziemia wydeptana wokół ogniska, najmocniej przy ogniu, ku brzegom miękko przechodzi w trawę
        if (def.id === 'camp') {
          const ox = b.x + fp.w / 2, oy = b.y + fp.h / 2;
          for (let cy = b.y - 1; cy <= b.y + fp.h + 1; cy++) for (let cx = b.x - 1; cx <= b.x + fp.w + 1; cx++) {
            const r = Math.hypot(cx - ox, cy - oy);
            if (r < 2.2) view.wear(cx, cy, Math.max(0, 0.75 - r * 0.3) * (0.85 + (hash2(cx, cy, b.id) & 3) * 0.05));
          }
        }
        // obóz zbójów: ziemia wydeptana nierówną plamą (brzeg faluje, tu i ówdzie kępa trawy), najmocniej przy ognisku
        // z przodu; od ogniska wychodzą w las dwie-trzy krótkie, rozmyte dróżki — żadnego równego koła
        if (def.id === 'banditCamp') {
          const ox = b.x + fp.w / 2, oy = b.y + fp.h / 2 + 0.6;
          const k1 = (hash2(b.id, 1, 0x51) & 255) / 255 * 6.28, k2 = (hash2(b.id, 2, 0x51) & 255) / 255 * 6.28;
          const paths = [0, 1, 2].map((i) => Math.PI / 2 + (((hash2(b.id, i + 7, 0x77) & 255) / 255) - 0.5) * 2.6);
          for (let cy = b.y - 4; cy <= b.y + fp.h + 4; cy++) for (let cx = b.x - 4; cx <= b.x + fp.w + 4; cx++) {
            const dx = cx + 0.5 - ox, dy = cy + 0.5 - oy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            const edge = 2.1 + Math.sin(a * 3 + k1) * 0.45 + Math.sin(a * 5 + k2) * 0.3 + ((hash2(cx, cy, b.id) & 7) - 3.5) * 0.08;
            let w = r < edge ? Math.min(0.8, 0.85 - r * 0.16) : Math.max(0, (edge + 1.1 - r) / 1.1) * 0.35;
            for (const pa of paths) { // dróżka: wąski pas wzdłuż kierunku, słabnący z odległością
              const along = dx * Math.cos(pa) + dy * Math.sin(pa), side = Math.abs(-dx * Math.sin(pa) + dy * Math.cos(pa));
              if (along > 0 && along < 5.5 && side < 0.75) w = Math.max(w, (0.42 - along * 0.06) * (1 - side / 0.75));
            }
            if ((hash2(cx, cy, b.id ^ 0x3c) & 15) === 0) w *= 0.4; // kępa trawy, której nikt nie zdeptał
            if (w > 0.02) view.wear(cx, cy, w);
          }
        }
        if (b.door >= 0) {
          const dx = b.door % width, dy = Math.floor(b.door / width);
          for (let cy = dy - 1; cy <= dy + 2; cy++) for (let cx = dx - 1; cx <= dx + 2; cx++) view.wear(cx, cy, cx >= dx && cx <= dx + 1 && cy >= dy && cy <= dy + 1 ? 0.4 : 0);
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
      // daleka wersja: zapamiętujemy bryły teraz (dach na miejscu, nic nie zdjęte), liczymy ją dopiero, gdy będzie potrzebna
      const lod = prepareLod(mesh, def.id);
      if (lod) this.lods.set(b.id, lod);
      // pochodnia na słupie przy wejściu: przy budynkach z drzwiami (nie przy murach, bramach ani drogach)
      if (def.id !== 'torch' && !def.wall && !def.gate && !def.road && def.id !== 'keep' && !NO_TORCH.has(def.id)) {
        const torch = torchModel();
        const small = SMALL_TORCH[def.id];
        if (small) { torch.position.set(small[0], 0, small[1]); torch.scale.setScalar(small[2]); }
        else torch.position.set(def.w / 2 - 0.08, 0, def.h / 2 - 0.08);
        mesh.add(torch);
      }
      this.buildingLayer.add(mesh);
      this.buildingMeshes.set(b.id, mesh);
      // budynek postawiony od razu gotowy (tryb deweloperski, rozkaz bota z gotowcem): krótki pokaz budowy
      if (this.builtAt > 0 && !this.noBuildShow && !b.build && !def.wall && !def.gate && !def.road && def.id !== 'torch') this.sites.quickBuild.set(b.id, this.time);
    }
    this.builtAt = 1;
    for (const [id, mesh] of this.buildingMeshes) {
      if (alive.has(id)) continue;
      // rozebrany budynek nie znika od razu: zapada się i przechyla, a pod nim zostaje gruz
      for (const m of this.staticParts(mesh)) m.layers.set(0); // zapadający się budynek rysuje się już sam (poza wspólnym rysowaniem)
      this.rubble.collapse(mesh);
      // łoskot walącego się budynku z jego miejsca (nagrania 0 A.D.)
      this.playHere('collapse', mesh.position.x, mesh.position.z, 1, mesh.position.y);
      this.onCollapse();
      this.buildingMeshes.delete(id);
      this.lods.delete(id);
    }
  }

  /**
   * Daleka wersja budynków: dla każdego budynku wybieramy najprostszy poziom, którego błąd (w jednostkach świata)
   * rzutowany na ekran z tej odległości jest mniejszy niż `lodPx` pikseli. Przełączanie z zapasem 10%, żeby budynek na
   * granicy nie mrugał. Budowy, pokaz budowy i budynek, w którym stoimy spacerem, zawsze w pełnej wersji.
   */
  private lodW = new THREE.Vector3();
  private updateLods(): void {
    const cam = this.cam.camera, cp = cam.position;
    const H = this.renderer.domElement.clientHeight || window.innerHeight;
    // odległość, w której błąd 1 jednostki ma `lodPx` pikseli
    const k = H / (2 * Math.tan((cam.fov * Math.PI) / 360) * this.lodPx);
    const counts = [0, 0, 0, 0];
    let saved = 0, waiting = 0;
    const opts = { keep: isWindowMat, wet: isWetMat };
    for (const [id, lod] of this.lods) {
      const mesh = this.buildingMeshes.get(id);
      if (!mesh) { this.lods.delete(id); continue; }
      let want = -1;
      const pinned = !this.lodOn || this.sites.sites.has(id) || this.sites.quickBuild.has(id) || (this.walk && (id === this.walkHall || id === this.walkNear || this.walkInView.has(id)));
      if (!pinned) {
        const d = Math.max(0, this.lodW.copy(lod.center).applyMatrix4(mesh.matrixWorld).distanceTo(cp) - lod.radius);
        if (!lod.levels.length) {
          // wersje liczą się w tle przy pierwszej potrzebie (raz na rodzaj budynku)
          if (d > LOD_STEPS[0]! * k * 0.8) {
            if (!attachLod(mesh, lod, opts)) waiting++;
            else this.batchParts.delete(mesh); // doszły dalekie wersje: lista części do wspólnego rysowania od nowa
          }
        }
        for (let i = lod.levels.length - 1; i >= 0; i--) {
          const D = lod.levels[i]!.error * k * (i <= lod.level ? 0.9 : 1);
          if (d > D) { want = i; break; }
        }
      }
      showLod(lod, want);
      counts[lod.level + 1]!++;
      if (lod.level >= 0) saved += lod.full - lod.levels[lod.level]!.tris;
    }
    if (this.lodTick % 30 === 0) {
      this.lodInfo = `pełne ${counts[0]}, bliżej ${counts[1]}, dalej ${counts[2]}, najdalej ${counts[3]}` +
        ` · −${Math.round(saved / 1000)} tys. trójkątów · próg ${this.lodPx.toFixed(2)} px` +
        (waiting ? ` · liczy się ${waiting}` : '') + ` · policzone rodzaje ${lodStats.baked}${lodStats.worker ? ' (w tle)' : ''}`;
    }
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
    // z mapą otoczenia część światła nieba przychodzi z niej (z odbiciami), więc samo niebo trochę słabsze — proporcje jak w podglądzie modeli
    // bilans: o ile dochodzi światła z mapy otoczenia, o tyle słabsze niebo — obraz nie jaśnieje, tylko modele dostają bryłę i połysk
    this.scene.environmentIntensity = this.envOn ? 0.42 * (this.hemi.intensity / 1.15) * (1 - this.rain * 0.3) : 0;
    if (this.envOn) this.hemi.intensity *= 0.62;
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
    // złota godzina: rano 6–8:30 i wieczorem 17–20 ciepłe, niskie światło (najmocniej tuż po wschodzie i przed zachodem)
    const bell = (h0: number, h1: number): number => { const t = (hour - h0) / (h1 - h0); return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI); };
    const golden = Math.max(bell(5.6, 8.6), bell(16.8, 20.3)) * (1 - this.rain * 0.8) * (1 - this.dayMist * 0.5);
    this.grade.uniforms.golden!.value = golden;
    this.hemi.color.setHex(0xdfeaff).lerp(tmpColor.setHex(0xffd2a0), golden * 0.45);
    this.view?.setSun(this.sunDir, this.sun.color, golden);
    // mgła: gęsta o świcie (4–8), rzadsza w dzień; w deszczu gęstsza
    const mist = Math.max(0, Math.min(1, hour < 4 ? 0 : hour < 6 ? (hour - 4) / 2 : (8.5 - hour) / 2.5));
    const fog = this.scene.fog as THREE.Fog;
    const m = this.fogOn ? Math.min(1, mist + this.dayMist) : 0;
    this.mistLevel = m;
    this.view?.setAtmosphere({ mist: m, cover: this.cover, rain: this.rain, night: this.night, fog: bg, sun: this.atmoSun.copy(this.sun.color).multiplyScalar(Math.min(1.4, this.sun.intensity)) });
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

  private shadowMax = 4096;
  private shadowFrame = 0;
  private sunWas = new THREE.Vector3();
  private camWas = new THREE.Vector3();
  /** Rozdzielczość z ustawień i bieżący mnożnik dynamicznej rozdzielczości (0,55–1) */
  private ratioMax = 1;
  private ratioDyn = 1;
  private gpuAvg = 0;
  private gpuFrames = 0;
  private gpuBad = 0;
  private gpuGood = 0;
  private ratioChanged = 0;
  /** Bieżąca rozdzielczość obrazu (do okna wydajności) */
  get resolution(): string { return `${Math.round(this.ratioDyn * 100)}% z ${this.ratioMax}×`; }
  private gpuName?: string;
  /** Nazwa karty graficznej, na której rysuje przeglądarka (F3) — po niej widać, czy to osobna karta, czy wbudowana */
  get gpu(): string {
    if (this.gpuName === undefined) {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpuName = String((ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? '?');
    }
    return this.gpuName;
  }
  private applyRatio(): void {
    const ratio = Math.max(0.5, Math.round(this.ratioMax * this.ratioDyn * 20) / 20);
    if (Math.abs(this.renderer.getPixelRatio() - ratio) < 0.01) return;
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.resize();
  }
  /**
   * Dynamiczna rozdzielczość: gdy karta graficzna nie wyrabia (średnio > 20 ms na klatkę), obraz robi się trochę mniejszy,
   * a gdy jest zapas (< 11 ms), wraca do rozdzielczości z ustawień. Zmiana co ok. sekundę, małymi krokami.
   */
  private dynRes = false;
  private dynamicResolution(ms: number): void {
    if (this.calm || !this.dynRes) return;
    this.gpuAvg += ms; this.gpuFrames++;
    if (this.gpuFrames < 60) return;
    const avg = this.gpuAvg / this.gpuFrames;
    this.gpuAvg = 0; this.gpuFrames = 0;
    // zmiana rozdzielczości przebudowuje bufory obrazu (jedna klatka potrafi mignąć), więc rzadko i tylko przy pewności:
    // w dół po 3 kolejnych słabych sekundach, w górę po 10 dobrych, nie częściej niż co 15 s
    this.gpuBad = avg > 22 ? this.gpuBad + 1 : 0;
    this.gpuGood = avg < 10 ? this.gpuGood + 1 : 0;
    const now = performance.now();
    if (now - this.ratioChanged < 15000) return;
    const before = this.ratioDyn;
    if (this.gpuBad >= 3) this.ratioDyn = Math.max(0.55, this.ratioDyn - (avg > 32 ? 0.2 : 0.1));
    else if (this.gpuGood >= 10) this.ratioDyn = Math.min(1, this.ratioDyn + 0.1);
    if (this.ratioDyn !== before) { this.gpuBad = this.gpuGood = 0; this.ratioChanged = now; this.applyRatio(); }
  }
  private shadowTypeSet = false;
  private shadowSize(n: number): void {
    if (n <= 0 || this.sun.shadow.mapSize.x === n) return;
    this.sun.shadow.mapSize.setScalar(n);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as { map: unknown }).map = null;
  }

  /**
   * Przesuwa słońce i obszar cienia za kamerą; im dalej kamera, tym większy obszar. Gdy kamera stoi,
   * mapa cieni liczy się co drugą klatkę (ludzie chodzą wolno, więc cień nie odstaje).
   */
  private aimSun(): void {
    // z daleka mapa cieni 2048 zamiast 4096 (z histerezą, żeby przy progu nie przełączała się w kółko)
    if (this.shadowMax > 0 && !this.calm) {
      const d = this.cam.distance, cur = this.sun.shadow.mapSize.x;
      this.shadowSize(d > 34 ? Math.min(this.shadowMax, 2048) : d < 30 ? this.shadowMax : cur);
    }
    const f = this.focusPoint;
    // obszar cienia rośnie skokami (co ~12%), a nie płynnie: przy płynnym rozmiar piksela cienia zmieniał się
    // w każdej klatce przybliżania i krawędzie cieni pełzały
    const raw = Math.max(22, Math.min(70, this.cam.distance * 1.15));
    const half = Math.min(70, 22 * 1.12 ** Math.ceil(Math.log(raw / 22) / Math.log(1.12) - 1e-6));
    // przyciąganie do pikseli mapy cieni liczone w układzie słońca (jego osie prawo/góra), a nie w osiach świata:
    // słońce świeci pod kątem, więc siatka X/Z nie pokrywała się z pikselami i cienie migały przy przelocie kamery
    const d = this.sunAxisZ.copy(this.sunDir).normalize();
    const ax = this.sunAxisX.crossVectors(this.sun.up, d).normalize();
    const ay = this.sunAxisY.crossVectors(d, ax);
    const texel = (half * 2) / this.sun.shadow.mapSize.x;
    const px = Math.round(f.dot(ax) / texel) * texel, py = Math.round(f.dot(ay) / texel) * texel, pz = f.dot(d);
    const tgt = this.sunTgt.set(0, 0, 0).addScaledVector(ax, px).addScaledVector(ay, py).addScaledVector(d, pz);
    const sm = this.renderer.shadowMap;
    sm.autoUpdate = false;
    const cp = this.cam.camera.position;
    const camMove2 = this.camWas.distanceToSquared(cp);
    this.camWas.copy(cp);
    const c = this.sun.shadow.camera;
    const resized = c.right !== half;
    const moved = resized || this.sunWas.distanceToSquared(tgt) > 1e-8 || this.sunDirWas.distanceToSquared(this.sunDir) > 1e-8;
    // szybkie przewijanie widoku: mapa cieni liczy się co drugą klatkę. Słońce przesuwamy TYLKO w klatkach,
    // w których mapa się liczy — inaczej stara mapa była czytana nową macierzą i cienie skakały co klatkę
    const fast = camMove2 > (0.006 * this.cam.distance) ** 2;
    const update = this.calm || !fast || resized || !this.sun.shadow.map || (this.shadowFrame++ & 1) === 0;
    if (!update) { sm.needsUpdate = false; return; }
    if (moved) {
      this.sunWas.copy(tgt); this.sunDirWas.copy(this.sunDir);
      this.sun.target.position.copy(tgt);
      this.sun.position.copy(tgt).add(this.sunDir);
      if (resized) { c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.updateProjectionMatrix(); }
    }
    // gdy nic się nie rusza, mapa i tak liczy się co drugą klatkę (ludzie chodzą wolno, cień nie odstaje)
    sm.needsUpdate = moved || this.calm || !this.sun.shadow.map || (this.shadowFrame++ & 1) === 0;
  }
  private sunAxisX = new THREE.Vector3();
  private sunAxisY = new THREE.Vector3();
  private sunAxisZ = new THREE.Vector3();
  private sunTgt = new THREE.Vector3();
  private sunDirWas = new THREE.Vector3();

  /** Nocą zapala pochodnie przy budynkach i w rękach ludzi oraz rozdaje światła najbliższym z nich. */
  private syncLamps(g: GameState): void {
    if (this.inMine && this.mineLevel) {
      // w sztolni: światła z puli przy najbliższych latarniach (reszta zgaszona), płomyki rysuje syncFlames
      const spots = (this.mineLevel.userData.lampSpots ??= (() => { const l: THREE.Object3D[] = []; this.mineLevel!.traverse((o) => { if (o.name === 'lampSpot') l.push(o); }); return l; })()) as THREE.Object3D[];
      const cp = this.cam.camera.position, v = new THREE.Vector3();
      const near = spots.map((o) => ({ o, d: o.getWorldPosition(v).distanceToSquared(cp) })).sort((a, b) => a.d - b.d);
      // pochodnia w dłoni (F): pierwsza lampa z puli idzie za ręką i świeci mocno, reszta przy latarniach
      const own = this.torchOn ? this.lamps[0]! : null;
      if (own) { this.handTip.getWorldPosition(own.position); own.intensity = 9 * (0.85 + Math.sin(this.time * 11) * 0.08 + Math.sin(this.time * 23.7) * 0.07); }
      let j = 0;
      this.lamps.forEach((lamp, i) => {
        if (lamp === own) return;
        const sp = near[j++];
        if (!sp) { lamp.intensity = 0; return; }
        sp.o.getWorldPosition(lamp.position);
        lamp.intensity = 5 * (0.9 + Math.sin(this.time * 9 + i * 2.1) * 0.1);
      });
      return;
    }
    const on = this.night > 0.15;
    const flicker = this.calm ? 1 : 0.85 + Math.sin(this.time * 11) * 0.08 + Math.sin(this.time * 23.7) * 0.07;
    const lit = new Set<number>();
    if (on) for (const b of g.buildings) if (b.lit && !b.ruined && !b.build) lit.add(b.id);
    for (const mesh of this.buildingMeshes.values()) {
      const torch = named(mesh, 'torch');
      if (!torch) continue;
      // słup stoi cały czas; płomień pali się dopiero, gdy ktoś podejdzie i zapali pochodnię
      const flame = named(torch, 'torchflame');
      // stary stożek zostaje tylko jako znacznik miejsca; płomień rysuje system ognia
      if (flame) flame.visible = false;
    }
    this.handTorches.visible = on;
    this.guardTorches.visible = on;
    // pochodnia w ręce przy spacerze świeci zawsze, gdy jest zapalona (pierwsza lampa z puli)
    const own = this.walk && this.torchOn ? this.lamps[0]! : null;
    if (own) { this.handTip.getWorldPosition(own.position); own.intensity = (this.night > 0.15 ? 7 : 3) * flicker; }
    this.torchGlow.sync(g, this.view, this.buildingMeshes, lit, this.night);
    // nocą lampy rozjaśniają się, w dzień gasną — płynnie, bez przeskoku
    const dt = Math.min(0.1, this.frameDt || 0.016);
    const ease = Math.min(1, dt * 3.5);
    if (this.lampState.length !== this.lamps.length) this.lampState = this.lamps.map(() => ({ key: '', k: 0, target: 0, cur: 0 }));
    // co kilka klatek wybieramy źródła światła najbliższe środkowi ekranu
    if (on && this.frameNo++ % 6 === 0) {
      const f = this.focusPoint;
      const spots: { key: string; v: THREE.Vector3; d: number; k: number }[] = [];
      // gruzy i place budowy nie świecą (pochodnia zburzonego budynku nie może wisieć w powietrzu)
      const dead = new Set<number>();
      for (const b of g.buildings) if (b.ruined || b.build) dead.add(b.id);
      for (const [id, mesh] of this.buildingMeshes) {
        const torch = named(mesh, 'torch');
        if (!torch || !lit.has(id) || dead.has(id) || !this.shownIn(mesh, torch.parent ?? torch)) continue;
        const v = torch.getWorldPosition(new THREE.Vector3());
        v.y += 1.25;
        spots.push({ key: 'b' + id, v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2, k: 1 });
      }
      // pochodnie na bramach i w zamku (w bryle modelu) świecą nocą lekko, słabiej niż pochodnia na słupie
      for (const [id, mesh] of this.buildingMeshes) {
        if (dead.has(id)) continue;
        const marks = this.lightMarks(mesh);
        for (let k = 0; k < marks.length; k++) {
          if (!this.shownIn(mesh, marks[k]!.parent ?? marks[k]!)) continue;
          const v = marks[k]!.getWorldPosition(new THREE.Vector3());
          spots.push({ key: 'm' + id + ':' + k, v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 1, k: 0.4 });
        }
      }
      // ognisko w obozowisku pali się zawsze, więc nocą świeci na ludzi i stołki dookoła
      for (const b of g.buildings) {
        if (BUILDINGS[b.type]!.id !== 'camp' || b.build) continue;
        const fl = named(this.buildingMeshes.get(b.id), 'flame');
        if (!fl) continue;
        const v = fl.getWorldPosition(new THREE.Vector3());
        v.y += 0.45;
        spots.push({ key: 'c' + b.id, v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 - 2, k: 0.9 });
      }
      // płonący budynek oświetla wszystko dookoła mocniej niż pochodnia i ma pierwszeństwo w puli świateł
      for (const b of g.buildings) {
        if (!(b.fire ?? 0)) continue;
        const box = this.buildingMeshes.get(b.id)?.userData.burnBox as THREE.Box3 | undefined;
        if (!box) continue;
        const v = box.getCenter(new THREE.Vector3());
        v.y = box.min.y + (box.max.y - box.min.y) * 0.85;
        spots.push({ key: 'f' + b.id, v, d: Math.max(0, (v.x - f.x) ** 2 + (v.z - f.z) ** 2 - 8), k: 1.2 });
      }
      const { width, height } = g.map;
      for (const u of g.units) {
        if (u.path.length === 0) continue; // pochodnię niosą ci, którzy idą
        const v = new THREE.Vector3(u.px / FP - width / 2, (this.view?.heightAt(u.px / FP, u.py / FP) ?? 0) + 0.8, u.py / FP - height / 2);
        spots.push({ key: 'u' + u.id, v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 4, k: 0.3 }); // ręczna pochodnia świeci dużo słabiej niż ta na słupie
      }
      for (const sd of g.soldiers) {
        if (sd.id % 5 !== 0 || sd.owner !== this.me) continue;
        const v = new THREE.Vector3(sd.px / FP - width / 2, (this.view?.heightAt(sd.px / FP, sd.py / FP) ?? 0) + 0.8, sd.py / FP - height / 2);
        spots.push({ key: 's' + sd.id, v, d: (v.x - f.x) ** 2 + (v.z - f.z) ** 2 + 4, k: 0.35 });
      }
      spots.sort((a, b) => a.d - b.d);
      const free = this.lamps.length - (own ? 1 : 0);
      const chosen = spots.slice(0, free);
      // miękki brzeg: najdalsze z wybranych świecą słabiej, więc gdy wypadają z puli, nie gasną nagle
      // UWAGA: „d” to odległość do kwadratu z poprawką pierwszeństwa, więc bywa UJEMNE (ognisko: −2). sqrt(ujemne) = NaN,
      // NaN szło do siły lampy i zostawało w niej na zawsze (cur += (NaN − cur)·ease), a jedno światło z NaN czerni
      // każdy oświetlony piksel — stąd „nocą jadę kamerą nad obozem i cały obraz gaśnie”. Dlatego obcinamy do zera.
      const edge = spots.length > free ? Math.sqrt(Math.max(0, spots[free]!.d)) : Infinity;
      const weight = (d: number): number => (edge === Infinity || edge <= 0 ? 1 : Math.max(0, Math.min(1, (edge - Math.sqrt(Math.max(0, d))) / (edge * 0.35))));
      const want = new Map(chosen.map((sp) => [sp.key, sp]));
      // lampy już przypięte do wybranych źródeł zostają przy nich
      const taken = new Set<string>();
      this.lamps.forEach((lamp, i) => {
        if (lamp === own) return;
        const st = this.lampState[i]!;
        const sp = want.get(st.key);
        if (sp) { taken.add(st.key); st.k = sp.k; st.target = weight(sp.d); lamp.position.copy(sp.v); }
        else st.target = 0; // źródło wypadło z puli: lampa wygasa, zanim przejdzie gdzie indziej
      });
      // nowe źródła dostają lampy, które już zgasły (najciemniejsze najpierw)
      const idle = this.lamps.map((_, i) => i).filter((i) => this.lamps[i] !== own && !want.has(this.lampState[i]!.key) && this.lampState[i]!.cur < 0.06)
        .sort((a, b) => this.lampState[a]!.cur - this.lampState[b]!.cur);
      for (const sp of chosen) {
        if (taken.has(sp.key)) continue;
        const i = idle.shift();
        if (i === undefined) break;
        const st = this.lampState[i]!;
        st.key = sp.key; st.k = sp.k; st.target = weight(sp.d); st.cur = 0;
        this.lamps[i]!.position.copy(sp.v);
      }
    }
    this.lamps.forEach((lamp, i) => {
      if (lamp === own) return;
      const st = this.lampState[i]!;
      st.cur += ((on ? st.target : 0) - st.cur) * ease;
      // bezpiecznik: zepsuta liczba (NaN/∞) w sile światła czerni cały obraz i sama nie zniknie — gasimy lampę i zaczynamy od zera
      if (!Number.isFinite(st.cur) || !Number.isFinite(st.target)) { console.warn('[lampy] zła siła światła', st); st.cur = 0; st.target = 0; st.key = ''; }
      if (st.cur < 0.002) { st.cur = 0; if (!on) st.key = ''; }
      lamp.intensity = st.cur * st.k * this.night * 10 * (0.9 + Math.sin(this.time * 9 + i * 2.1) * (this.calm ? 0 : 0.1)) * flicker;
    });
  }

  /** Znaczniki pochodni w bryle budynku (płomienie na bramach, pochodnie na ścianach zamku); liczone raz na budynek */
  private lightMarkCache = new WeakMap<THREE.Object3D, THREE.Object3D[]>();
  private lightMarks(mesh: THREE.Object3D): THREE.Object3D[] {
    let l = this.lightMarkCache.get(mesh);
    // model po zburzeniu albo przebudowie odpina stare części: zapamiętane znaczniki, które już do niego nie należą, szukamy od nowa
    if (l && l.length && !this.shownIn(mesh, l[0]!, true)) l = undefined;
    if (!l) { l = []; mesh.traverse((o) => { if (o.name === 'torchFlame' || o.name === 'lightSpot') l!.push(o); }); this.lightMarkCache.set(mesh, l); }
    return l;
  }
  /** Znacznik (pochodnia, latarnia) naprawdę jest w modelu i jest widoczny — a nie wisi po zburzonej części budynku */
  private shownIn(mesh: THREE.Object3D, o: THREE.Object3D, attachedOnly = false): boolean {
    let p: THREE.Object3D | null = o;
    for (; p && p !== mesh; p = p.parent) if (!attachedOnly && !p.visible) return false;
    return p === mesh && (attachedOnly || mesh.visible);
  }



  private syncRoads(g: GameState, view: TerrainView): void {
    if (g.tick % 3 !== 0 && this.roadSum >= 0) return;
    let sum = 0;
    for (let i = 0; i < g.roads.length; i++) if (g.roads[i]) sum = (sum * 31 + i * 3 + g.roads[i]!) | 0;
    if (sum !== this.roadSum) { this.roadSum = sum; view.setRoads(g.roads, roadMaterials()); }
    let ps = 0;
    for (let i = 0; i < g.roadPlan.length; i++) if (g.roadPlan[i]) ps = (ps * 31 + i * 3 + g.roadPlan[i]!) | 0;
    if (ps === this.planSum) return;
    this.planSum = ps;
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const TONE = [0, 0xe0c38a, 0xd2cdc2, 0xb07a42];
    let n = 0;
    for (let i = 0; i < g.roadPlan.length && n < 4096; i++) {
      const k = g.roadPlan[i]!;
      if (!k) continue;
      const x = i % width, y = (i - x) / width;
      m.makeTranslation(x + 0.5 - width / 2, view.heightAt(x + 0.5, y + 0.5) + 0.05, y + 0.5 - height / 2);
      this.roadPlans.setMatrixAt(n, m);
      this.roadPlans.setColorAt(n, c.set(TONE[k] ?? 0xffffff));
      n++;
    }
    this.roadPlans.count = n;
    touch(this.roadPlans);
    if (this.roadPlans.instanceColor) touch(this.roadPlans);
  }

  /** Odmiana ciągniętego drzewa, gdy nie widzieliśmy ścinania (np. wczytany zapis): stała dla ludzika, zwykle iglak */
  private logKindFor(id: number): TreeKind | null {
    const all = [...this.logs.keys()];
    const con = all.filter((k) => k.role === 'conifer');
    const list = con.length ? con : all;
    return list.length ? list[(id * 2654435761 >>> 0) % list.length]! : null;
  }

  /** Drzewo przechyla się pod koniec rąbania, a po ścięciu znika i zostaje pniak. */
  private syncForest(g: GameState, view: TerrainView): void {
    for (const u of g.units) {
      if (u.phase !== Phase.WorkingSite || u.timer > 40) continue;
      const tile = (u.py >> 8) * g.map.width + (u.px >> 8);
      if (g.map.tiles[tile] === Terrain.Forest) {
        // z ułamkiem ticku: licznik w symulacji spada 10 razy na sekundę, więc bez tego drzewo waliło się skokami
        const k = Math.min(1, Math.max(0, 1 - (u.timer - (this.calm ? 0 : this.lastAlpha)) / 40));
        view.fell(tile, k * k); // powoli rusza, potem wali się coraz szybciej
        const kind = view.treeKindAt(tile);
        if (kind) this.felled.set(u.id, kind); // to samo drzewo potem ciągnie do chaty
      }
    }
    // dziennik lasu: wpis ≥ 0 = ścięte (pniak), < 0 = drzewko leśniczego dorosło w zwykłe drzewo
    for (; this.cutSeen < g.cut.length; this.cutSeen++) {
      const e = g.cut[this.cutSeen]!;
      if (e >= 0) view.clear(e);
      else { view.grow(~e, 1); this.youngSeen.delete(~e); }
    }
    // rozbite głazy (boulders.ts): znikają z terenu (także te z wczytanej gry — licznik zerowany przy nowej mapie)
    for (const rg = g.rocksGone ?? []; this.rocksSeen < rg.length; this.rocksSeen++) view.clear(rg[this.rocksSeen]!);
    // sadzonki rosną na oczach; te, które zniknęły bez dorośnięcia (np. droga na polu), znikają też z obrazu
    const now = new Set<number>();
    for (const s of g.saplings ?? []) { now.add(s.t); view.grow(s.t, saplingGrowth(s)); }
    for (const t of this.youngSeen) if (!now.has(t) && g.map.tiles[t] !== Terrain.Forest) view.grow(t, 0);
    this.youngSeen = now;
  }

  private animate(g: GameState, dt: number): void {
    const working = new Set<number>();
    for (const u of g.units) {
      // czekający na miejsce w magazynie siedzi w warsztacie (storage.ts): też go widać w środku
      if (u.phase === Phase.Working || u.phase === Phase.Stalled) working.add(u.job);
      else if (u.phase === Phase.Resting) working.add(u.home);
      else if ((u.phase === Phase.Idle || u.phase === Phase.Evening) && u.path.length === 0) { const camp = this.camps.get((u.py >> 8) * g.map.width + (u.px >> 8)); if (camp && BUILDINGS[camp.type]!.id !== 'keep') working.add(camp.id); }
    }
    // kliknięty budynek też odsłania wnętrze, żeby dało się zajrzeć do środka
    for (const u of g.units) {
      if (!u.job) continue;
      const yard = named(this.buildingMeshes.get(u.job), 'yardlog');
      if (!yard) continue;
      // pień leży pod chatą, dopóki zostały z niego partie do pocięcia
      const left = u.phase === Phase.ToHome ? 0 : u.batches;
      yard.visible = left > 0;
      yard.scale.x = Math.max(0.3, left / 4);
    }
    // krata w bramie zamku: opada szybko, gdy symulacja zamknęła bramę (wróg pod zamkiem), podnosi się powoli
    for (const id of this.keepFloors.keys()) {
      const port = named(this.buildingMeshes.get(id), 'portcullis');
      const kb = g.buildings.find((x) => x.id === id);
      if (!port || !kb) continue;
      const want = kb.shut ? 0 : KEEP_PORT_LIFT;
      const was = port.position.y;
      const sp = want < was ? 2.2 : 0.35;
      port.position.y = was + Math.max(-sp * dt, Math.min(sp * dt, want - was));
      if (Math.abs(port.position.y - was) > 1e-4 && !this.calm) {
        const wp = this.buildingMeshes.get(id)!.position;
        this.sfxAt(want < was ? 'portcullis' : 'creak', wp.x, wp.z + KEEP_HALF, `port${id}`, want < was ? 0.6 : 1.2, 0.8);
      }
    }
    // kopalnia zawsze stoi zakryta (kopiec i portal): jej wnętrze to osobna sztolnia, do której wchodzi się spacerem
    const shut = new Set<number>();
    for (const b of g.buildings) if (b.type === OREMINE_T) shut.add(b.id);
    for (const [id, mesh] of this.buildingMeshes) {
      if (shut.has(id) && !this.walk) { animateBuilding(mesh, false, this.time, dt); continue; }
      const inHall = !!this.walk && id === this.walkHall;
      // spacerem z ziemi dachy zostają na miejscu (zdjęty dach widać od dołu jako dziurę); zdejmujemy go tylko nad salą, w której stoimy
      const busy = working.has(id) || id === this.selectedId;
      // z kamery dach z pracującego budynku zdejmujemy tylko, gdy patrzymy na niego z góry; z niska (przybliżenie) dach zostaje,
      // bo inaczej widać mury bez dachu i szczytów. Kliknięty budynek otwiera się zawsze.
      const cp = this.cam.camera.position, mp = mesh.position;
      const steep = cp.y - mp.y > Math.hypot(cp.x - mp.x, cp.z - mp.z) * 0.85;
      const open = id === this.selectedId || id === this.ghostOpen || (working.has(id) && steep);
      animateBuilding(mesh, this.walk ? inHall : open || inHall, this.time, dt);
      if (this.walk && busy && !inHall) {
        const inn = named(mesh, 'interior'); if (inn) inn.visible = true;
        const fl = named(mesh, 'flame'); if (fl) fl.visible = true;
      }
      const ceil = named(mesh, 'ceiling');
      if (ceil) ceil.visible = inHall;
      // spacerem przy zamku: przez drzwi widać wnętrza sal, choć dachy zostają na miejscu
      if (this.walk && (id === this.walkNear || this.walkInView.has(id)) && !inHall) { const inn = named(mesh, 'interior'); if (inn) inn.visible = true; }
    }
    // budynek bez pracownika: nad dachem kołysze się mały znak przekreślonego człowieka
    for (const b of g.buildings) {
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      // trafiony budynek drży, a mocno uszkodzony płonie
      const prevHp = this.hpSeen.get(b.id) ?? b.hp;
      // trafiony budynek nie drży (to wyglądało sztucznie) — z miejsca uderzenia sypie się delikatny kurz i okruchy
      if (b.hp < prevHp) {
        this.burnUntil.set(b.id, this.time + 50);
        if (this.time >= (this.shake.get(b.id) ?? 0)) { this.shake.set(b.id, this.time + 0.35); this.hitDust(b); }
      }
      this.hpSeen.set(b.id, b.hp);
      if (mesh.rotation.z !== 0) mesh.rotation.z = 0;
      const hurt = 1 - b.hp / maxHp(b.type);
      let fire = named(mesh, 'fire') as THREE.Group | undefined;
      if ((b.fire ?? 0) > 0 && !fire) {
        fire = new THREE.Group();
        fire.name = 'fire';
        for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), k % 2 ? FIRE_A : FIRE_B); f.position.set(Math.sin(k * 2.4) * 0.5, 1.0 + (k % 3) * 0.2, Math.cos(k * 2.4) * 0.5); fire.add(f); }
        mesh.add(fire);
        remember(mesh, 'fire', fire);
      }
      if (fire) {
        // pożar trwa tylko po świeżych ciosach; gdy nikt dalej nie atakuje, ogień przygasa i znika (budynek zostaje osmalony)
        fire.visible = (b.fire ?? 0) > 0;
        const heat = Math.min(1, (b.fire ?? 0) / 300); // przy gaszeniu płomienie maleją
        mesh.userData.fireHeat = heat;
        if (!fire.visible) mesh.userData.burnBox = undefined; // po pożarze obrys liczymy od nowa (budynek mógł się zmienić)
        fire.children.forEach((f, k) => { const k2 = 0.35 + heat * 0.65; f.scale.set(k2, (0.7 + Math.abs(Math.sin(this.time * 9 + k)) * 0.6 * (0.5 + hurt)) * k2, k2); });
      }
      const def = BUILDINGS[b.type]!;
      // magazyn bez magazyniera nie dostaje znaku: magazynierzy to rezerwa, a towar i tak wnoszą sami robotnicy (storage.ts)
      const needs = b.owner === this.me && (def.production || def.staff) && !def.keepers && b.worker === 0;
      let sign = named(mesh, 'noworker') as THREE.Sprite | undefined;
      if (!needs) { if (sign) sign.visible = false; continue; }
      if (!sign) {
        sign = new THREE.Sprite(noWorkerMaterial());
        sign.name = 'noworker';
        sign.scale.setScalar(0.55);
        sign.renderOrder = 4;
        mesh.add(sign);
        remember(mesh, 'noworker', sign);
      }
      sign.visible = true;
      sign.position.set(0, 2.3 + Math.sin(this.time * 2 + b.id) * 0.06, 0);
      (sign.material as THREE.SpriteMaterial).rotation = Math.sin(this.time * 1.6 + b.id) * 0.18;
    }
  }

  /** Każdy magazyn pokazuje to, co naprawdę w nim leży (Building.stock, sim/systems/stock.ts): stosy rosną przy każdej dostawie. */
  private syncStores(g: GameState): void {
    if (g.tick === this.storesTick) return;
    this.storesTick = g.tick;
    for (const b of g.buildings) {
      const cap = BUILDINGS[b.type]!.capacity;
      if (!cap) continue;
      const mesh = this.buildingMeshes.get(b.id);
      if (!mesh) continue;
      for (const [kind, group] of [['stockpile', 'fill'], ['granary', 'foodfill'], ['armory', 'armsfill'], ['grain', 'grainfill']] as const) {
        const max = cap[kind];
        if (!max) continue;
        let here = 0;
        const stock: { id: string; share: number }[] = [];
        RESOURCES.forEach((r, i) => { if (RESOURCE_DEFS[r].store === kind) here += b.stock?.[i] ?? 0; });
        if (here > 0) RESOURCES.forEach((r, i) => { const n = b.stock?.[i] ?? 0; if (RESOURCE_DEFS[r].store === kind && n > 0) stock.push({ id: r, share: n / here }); });
        setStockFill(mesh, Math.min(1, here / max), stock, group);
      }
    }
  }

  private hl = 0;
  /** Wróg (żołnierz, chłop, wilk) pod kursorem przy zaznaczonym wojsku: czerwony krąg pod stopami */
  private foeMarkId = 0;
  private foeMark: THREE.Mesh | null = null;
  setFoeMark(id: number): void { this.foeMarkId = id; }
  private placeFoeMark(): void {
    if (!this.foeMark) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xd8231a, transparent: true, opacity: 0.9, depthWrite: false }));
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xb3120c, transparent: true, opacity: 0.28, depthWrite: false }));
      ring.add(inner);
      ring.renderOrder = 3;
      this.scene.add(ring);
      this.foeMark = ring;
    }
    const id = this.foeMarkId;
    let p: THREE.Vector3 | undefined = id ? this.soldierPos.get(id) ?? this.wolfPos.get(id) : undefined;
    if (id && !p) { const u = this.unitSpots.find((x) => x.id === id); if (u) p = this.markV.set(u.x, this.unitY.get(id) ?? 0, u.z); }
    // żołnierz już nie istnieje (pozycja z pamięci zostaje): krąg tylko pod żywymi
    if (p && this.state && this.soldierPos.has(id) && !this.state.soldiers.some((x) => x.id === id)) p = undefined;
    this.foeMark.visible = !!p && !this.walk;
    if (!p) return;
    const pulse = this.calm ? 1 : 1 + Math.sin(this.time * 7) * 0.06;
    this.foeMark.position.set(p.x, p.y + 0.04, p.z);
    this.foeMark.scale.setScalar(pulse);
  }
  private markV = new THREE.Vector3();
  private hlMats = new Map<THREE.Material, THREE.Material>();
  private hlOrig = new WeakMap<THREE.Material, THREE.Material>();
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
            red = cloneMaterial(m.material);
            const st = red as THREE.MeshStandardMaterial;
            // głęboka czerwień „do ataku”: barwa przyciemniona ku czerwieni i czerwona poświata (dawniej wychodził pomarańcz)
            if (st.color) st.color = st.color.clone().multiply(new THREE.Color(1, 0.42, 0.38));
            if (st.emissive) { st.emissive = new THREE.Color(0xb3120c); st.emissiveIntensity = 0.6; }
            this.hlMats.set(m.material, red);
            // oryginał trzymamy poza userData: materiał w userData kopiował się z teksturami przez JSON przy każdym clone()
            this.hlOrig.set(red, m.material);
          }
          m.material = red;
        } else { const orig = this.hlOrig.get(m.material); if (orig) m.material = orig; }
      });
    };
    if (this.hl) swap(this.hl, false);
    this.hl = id;
    if (id) swap(id, true);
  }

  /** Znaczniki sojuszników (gra drużynowa): pulsujący krąg na ziemi i słup światła widoczny z daleka, ok. 10 s */
  private pings: { g: THREE.Group; age: number; x: number; y: number }[] = [];
  /** Wozy z surowcami w drodze (modele dwukółki) */
  private carts = new Map<number, { obj: THREE.Group; heading: number; icon?: THREE.Sprite }>();
  /** Gracz, nad którego wozami widać znacznik (okno „Sojusznicy” otwarte); -1 = bez znaczników */
  cartIcons = -1;
  private cartTex: THREE.CanvasTexture | null = null;
  /** Znacznik wozu: złota tarcza z kołem i skrzynią, widoczny z daleka (stała wielkość na ekranie) */
  private cartIcon(): THREE.Sprite {
    if (!this.cartTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d')!;
      x.fillStyle = '#2a1c0e'; x.strokeStyle = '#e8c15a'; x.lineWidth = 4;
      x.beginPath(); x.arc(32, 28, 24, 0, Math.PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(26, 52); x.lineTo(32, 62); x.lineTo(38, 52); x.closePath(); x.fillStyle = '#e8c15a'; x.fill();
      // skrzynia wozu z ładunkiem i koło
      x.fillStyle = '#e8c15a'; x.fillRect(16, 20, 30, 10); x.fillRect(19, 15, 9, 5); x.fillRect(31, 13, 9, 7);
      x.strokeStyle = '#e8c15a'; x.lineWidth = 3; x.beginPath(); x.arc(24, 36, 6, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(46, 26); x.lineTo(54, 34); x.stroke();
      this.cartTex = new THREE.CanvasTexture(c); this.cartTex.colorSpace = THREE.SRGBColorSpace;
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cartTex, transparent: true, depthTest: false, fog: false }));
    sp.renderOrder = 11;
    this.scene.add(sp);
    return sp;
  }
  ping(x: number, y: number, color: number): void {
    if (!this.state || !this.view) return;
    const { width, height } = this.state.map;
    const g = new THREE.Group();
    const mat = (o: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40).rotateX(-Math.PI / 2), mat(0.9));
    ring.renderOrder = 21;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.22, 24).rotateX(-Math.PI / 2), mat(0.9));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 6, 12, 1, true).translate(0, 3, 0), mat(0.35));
    g.add(ring, inner, beam);
    g.position.set(x - width / 2, this.view.heightAt(x, y) + 0.05, y - height / 2);
    this.scene.add(g);
    this.pings.push({ g, age: 0, x, y });
    while (this.pings.length > 6) this.dropPing(0);
  }
  private dropPing(i: number): void {
    const p = this.pings[i]!;
    this.scene.remove(p.g);
    p.g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.pings.splice(i, 1);
  }
  private animatePings(dt: number): void {
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i]!;
      p.age += dt;
      if (p.age > 10) { this.dropPing(i); continue; }
      const [ring, inner, beam] = p.g.children as THREE.Mesh[];
      const pulse = (p.age * 1.4) % 1;
      ring!.scale.setScalar(0.6 + pulse * 1.4);
      (ring!.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * 0.9;
      const fade = p.age > 8 ? (10 - p.age) / 2 : 1;
      (inner!.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      (beam!.material as THREE.MeshBasicMaterial).opacity = 0.35 * fade * (0.8 + 0.2 * Math.sin(p.age * 6));
    }
  }
  /** Punkt mapy (pola) na ekranie: piksele w oknie i czy jest przed kamerą w kadrze */
  screenOf(x: number, y: number, lift = 0.6): { x: number; y: number; on: boolean; behind: boolean } {
    const g = this.state;
    if (!g || !this.view) return { x: 0, y: 0, on: false, behind: false };
    const v = new THREE.Vector3(x - g.map.width / 2, this.view.heightAt(x, y) + lift, y - g.map.height / 2).project(this.cam.camera);
    const behind = v.z > 1;
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    return { x: sx, y: sy, on: !behind && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, behind };
  }

  /** Środek kamery nad punktem mapy (pola) bez zmiany przybliżenia — minimapa */
  centerOn(x: number, y: number): void {
    if (!this.state) return;
    this.cam.lookAt(x - this.state.map.width / 2, y - this.state.map.height / 2, this.cam.distance);
  }
  /** Gdzie na mapie (w polach) leży to, co widać na ekranie: cztery rogi kadru rzucone na ziemię (minimapa) */
  viewQuad(): { x: number; y: number }[] {
    const g = this.state;
    if (!g || !this.view) return [];
    const cam = this.cam.camera;
    const f = this.focusPoint;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.view.heightAt(f.x + g.map.width / 2, f.z + g.map.height / 2));
    const out: { x: number; y: number }[] = [];
    const ray = new THREE.Ray(), hit = new THREE.Vector3();
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 0.98], [-1, 0.98]] as const) {
      ray.origin.setFromMatrixPosition(cam.matrixWorld);
      ray.direction.set(nx, ny, 0.5).unproject(cam).sub(ray.origin).normalize();
      // górne rogi patrzą czasem ponad horyzont: wtedy bierzemy punkt daleko w tym kierunku
      if (!ray.intersectPlane(plane, hit)) { ray.direction.y = Math.min(ray.direction.y, -0.02); ray.at(Math.min(400, this.cam.distance * 6), hit); }
      out.push({ x: hit.x + g.map.width / 2, y: hit.z + g.map.height / 2 });
    }
    return out;
  }

  /** Rozkaz marszu: rozchodząca się złota fala w klikniętym miejscu */
  orderMarker(tile: { x: number; y: number }): void {
    if (!this.state || !this.view) return;
    const { width, height } = this.state.map;
    this.wave.position.set(tile.x + 0.5 - width / 2, this.view.heightAt(tile.x + 0.5, tile.y + 0.5) + 0.04, tile.y + 0.5 - height / 2);
    this.waveAge = 0;
  }

  /** Podgląd szyku: półprzezroczyste kółka na polach, na których staną żołnierze (null chowa podgląd) */
  setFormationPreview(tiles: number[] | null, tight = false): void {
    if (!this.state || !this.view) return;
    const { width, height } = this.state.map;
    const m = new THREE.Matrix4();
    let n = 0, cx = 0, cy = 0;
    const list = tiles ?? [];
    for (const t of list) { cx += t % width + 0.5; cy += Math.floor(t / width) + 0.5; }
    if (list.length) { cx /= list.length; cy /= list.length; }
    for (const t of list) {
      if (n >= MAX_UNITS) break;
      let x = t % width + 0.5, y = Math.floor(t / width) + 0.5;
      // ścisk: podgląd tak zbity, jak oddział stanie
      if (tight) { x += (cx - x) * TIGHT; y += (cy - y) * TIGHT; }
      m.makeTranslation(x - width / 2, this.view.heightAt(x, y) + 0.04, y - height / 2);
      if (tight) m.scale(new THREE.Vector3(0.6, 1, 0.6));
      this.ghostRings.setMatrixAt(n++, m);
    }
    this.ghostRings.count = n;
    touch(this.ghostRings);
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
  /** Położenia wilków w świecie (do pasków zdrowia nad nimi) */
  private get wolfPos(): Map<number, THREE.Vector3> { return this.wolves.wolfPos; }
  /** Krew wilków: trafiony wilk pryska krwią nisko przy ziemi, ciężko ranny gubi krople (render/bloodfx.ts) */
  private wolfBlood(g: GameState): void {
    for (const w of g.wolves) {
      if (w.hp >= WOLF_HP && !this.bloodFx.knows(w.id)) continue;
      const p = this.wolfPos.get(w.id);
      if (!p || w.hp <= 0) continue;
      const x = p.x + g.map.width / 2, z = p.z + g.map.height / 2;
      this.bloodFx.track(w.id, w.hp, WOLF_HP, x, p.y, z, (w.id * 2.39996) % (Math.PI * 2), true, this.time, this.bloodGround, 0.12, true);
    }
  }
  /** Wilki na ekranie: punkt nad grzbietem i zdrowie */
  wolvesOnScreen(): { id: number; x: number; y: number; hp: number; wx: number; wy: number; wz: number }[] {
    if (!this.state) return [];
    const out: { id: number; x: number; y: number; hp: number; wx: number; wy: number; wz: number }[] = [];
    const r = this.canvas.getBoundingClientRect(), v = new THREE.Vector3();
    for (const w of this.state.wolves) {
      const p = this.wolfPos.get(w.id);
      if (!p) continue;
      v.copy(p).setY(p.y + 0.7).project(this.cam.camera);
      if (v.z > 1) continue;
      out.push({ id: w.id, hp: w.hp, x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, wx: p.x, wy: p.y + 0.7, wz: p.z });
    }
    for (const id of this.wolfPos.keys()) if (!this.state.wolves.some((w) => w.id === id)) this.wolfPos.delete(id);
    return out;
  }

  soldiersOnScreen(player: number): { id: number; x: number; y: number; owner: number; hp: number; feet: number; fx: number; wx: number; wy: number; wz: number }[] {
    if (!this.state) return [];
    const out: { id: number; x: number; y: number; owner: number; hp: number; feet: number; fx: number; wx: number; wy: number; wz: number }[] = [];
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const s of this.state.soldiers) {
      if (player >= 0 && s.owner !== player) continue;
      const p = this.soldierPos.get(s.id);
      if (!p) continue;
      v.copy(p).setY(p.y + this.barLift).project(this.cam.camera);
      if (v.z > 1) continue;
      const x = r.left + ((v.x + 1) / 2) * r.width, y = r.top + ((1 - v.y) / 2) * r.height;
      // stopy: do trafienia kliknięciem w całą sylwetkę (od stóp po pasek zdrowia nad głową), przy każdym zbliżeniu
      const wy = p.y + this.barLift;
      v.copy(p).project(this.cam.camera);
      out.push({ id: s.id, owner: s.owner, hp: s.hp, x, y, wx: p.x, wy, wz: p.z, fx: r.left + ((v.x + 1) / 2) * r.width, feet: r.top + ((1 - v.y) / 2) * r.height });
    }
    return out;
  }

  private syncSoldiers(g: GameState, view: TerrainView, alpha: number): void {
    this.bloodGround = (x: number, z: number): number => view.heightAt(x, z);
    if (this.bladeAt.size > 2000) this.bladeAt.clear();
    if (this.woundMarks.size > 4000) this.woundMarks.clear();
    { const hw = g.map.width / 2, hh = g.map.height / 2; this.spells.ground = (x: number, z: number): number => view.heightAt(x + hw, z + hh); }
    try { this.syncSoldiersInner(g, view, alpha); } finally {
      this.bloodFx.update(Math.min(0.1, this.frameDt || 0.016), this.time, this.bloodGround, g.map.width / 2, g.map.height / 2, this.calm);
    }
  }

  private syncSoldiersInner(g: GameState, view: TerrainView, alpha: number): void {
    this.stickFlameN = 0;
    this.plantedN = 0;
    const { width, height } = g.map;
    const t = this.tmp;
    let n = 0, rings = 0, dots = 0, torches = 0, rams = 0;
    // leczeni przez magów (mageheal.ts): kto i jakiej szkoły mag — wokół leczonego krążą świetliste kulki
    const healers = new Map<number, string>();
    for (const x of g.soldiers) if (x.healing && x.hp > 0) healers.set(x.healing, UNITS[x.kind]!.magic ?? 'water');
    let orbs = 0;
    // kliknięta twierdza: pokazujemy, gdzie są jej strażnicy
    const selB = this.selectedId ? g.buildings.find((b) => b.id === this.selectedId) : undefined;
    // kliknięta twierdza: pinezki nad strażą miejską; kliknięty barak górników: nad strażnikami tej kopalni
    const guardOwner = selB && selB.type === 0 ? selB.owner : -99;
    const guardCamp = selB && BUILDINGS[selB.type]!.id === 'minecamp' ? selB.id : 0;
    let guardRingN = 0;
    // stojący oddział zbija się ciaśniej: każdy przysuwa się do środka swojej grupy (tylko wygląd, pola w symulacji bez zmian)
    const pull = new Map<number, [number, number]>();
    const still = g.soldiers.filter((x) => !x.path.length && !x.up && !x.target && x.goal < 0);
    // oddział z jednego rozkazu ściąga się do swojego środka równo, więc linia zostaje linią, a blok blokiem
    const mid = new Map<number, [number, number, number]>();
    for (const a of still) if (a.grp) { const c = mid.get(a.grp) ?? [0, 0, 0]; c[0] += a.px; c[1] += a.py; c[2]++; mid.set(a.grp, c); }
    // ścisk: oddział zbity od razu, także w marszu, a kropki celu też w ścisku (środek celów oddziału)
    const tightMid = new Map<number, [number, number, number]>(), tightGoal = new Map<number, [number, number, number]>();
    for (const a of g.soldiers) if (a.tight && a.grp && !a.up) {
      const c = tightMid.get(a.grp) ?? [0, 0, 0]; c[0] += a.px; c[1] += a.py; c[2]++; tightMid.set(a.grp, c);
      if (a.goal >= 0) { const q = tightGoal.get(a.grp) ?? [0, 0, 0]; q[0] += a.goal % width + 0.5; q[1] += Math.floor(a.goal / width) + 0.5; q[2]++; tightGoal.set(a.grp, q); }
    }
    // ścisk to tylko drobne przysunięcie (najwyżej 0,35 pola) i tylko do bliskiego środka: oddział rozdzielony przez zamek
    // albo mur ma środek w środku zamku — wtedy obrazki „przelatywały” przez mury, choć w symulacji nikt tam nie szedł
    const near = (c: [number, number, number], a: { px: number; py: number }): boolean => Math.max(Math.abs(c[0] / c[2] - a.px), Math.abs(c[1] / c[2] - a.py)) < 3 * FP;
    const clampPull = (v: [number, number]): [number, number] => { const L = Math.hypot(v[0], v[1]); return L > 0.35 ? [v[0] / L * 0.35, v[1] / L * 0.35] : v; };
    for (const a of g.soldiers) {
      const c = a.tight && a.grp ? tightMid.get(a.grp) : undefined;
      if (c && c[2] > 1 && near(c, a)) pull.set(a.id, clampPull([(c[0] / c[2] - a.px) / FP * TIGHT, (c[1] / c[2] - a.py) / FP * TIGHT]));
    }
    for (const a of still) {
      if (pull.has(a.id)) continue;
      const c = a.grp ? mid.get(a.grp) : undefined;
      if (c && c[2] > 1 && near(c, a)) { const k = 0.3; pull.set(a.id, clampPull([(c[0] / c[2] - a.px) / FP * k, (c[1] / c[2] - a.py) / FP * k])); continue; }
      let sx = 0, sy = 0, k = 0;
      for (const b of still) if (b.owner === a.owner && Math.abs(b.px - a.px) < 3 * FP && Math.abs(b.py - a.py) < 3 * FP) { sx += b.px; sy += b.py; k++; }
      if (k > 1) pull.set(a.id, clampPull([(sx / k - a.px) / FP * 0.45, (sy / k - a.py) / FP * 0.45]));
    }
    const torchesOn = this.night > 0.15;
    const m = new THREE.Matrix4();
    // załogi wież: kto stoi na której wieży (kolejność wg id) i czy wieża walczy (ktoś z załogi ma cel)
    const crews = new Map<number, number[]>(), crewFight = new Map<number, [number, number]>();
    for (const x of g.soldiers) if (x.up && x.post) {
      const l = crews.get(x.post) ?? []; l.push(x.id); crews.set(x.post, l);
      if (x.target && !crewFight.has(x.post)) { const f = g.soldiers.find((o) => o.id === x.target); if (f) crewFight.set(x.post, [f.px / FP, f.py / FP]); }
    }
    for (const l of crews.values()) l.sort((a, b) => a - b);
    const byId = new Map<number, (typeof g.soldiers)[number]>();
    for (const x of g.soldiers) byId.set(x.id, x);
    const bById = new Map<number, (typeof g.buildings)[number]>();
    for (const b of g.buildings) bById.set(b.id, b);
    // łucznicy strzelający w budynek: jeden z nich (najniższy numer na ten sam budynek) wbija w ziemię zapaloną pochodnię,
    // także w dzień, i od niej reszta odpala ogniste strzały — sam łucznik też ma swoją
    const fireKeeper = new Map<number, number>(), fireTarget = new Set<number>();
    for (const x of g.soldiers) {
      const xd = UNITS[x.kind];
      if (!xd?.range || xd.magic || !x.target || x.hp <= 0 || !bById.has(x.target) || byId.has(x.target)) continue;
      fireTarget.add(x.id);
      if (x.path.length) continue;
      const k = (x.owner << 24) + x.target, was = fireKeeper.get(k);
      if (was === undefined || x.id < was) fireKeeper.set(k, x.id);
    }
    const torchBearers = new Set(fireKeeper.values());
    for (const id of this.planted.keys()) if (!torchBearers.has(id)) this.planted.delete(id);
    // chorążowie: po jednym w każdym oddziale (rozkazie) z co najmniej trzema żołnierzami
    const bearers = bearerIds(g);
    // chorąży zniknął z wojska, a w tym miejscu leży jego ciało: padł, więc proporzec pada razem z nim
    if (this.lastBearers.size) {
      const dead = new Set(g.corpses.map((c) => c.id));
      for (const id of this.lastBearers) if (!bearers.has(id) && dead.has(id)) this.fallenBearers.add(id);
    }
    this.lastBearers = bearers;
    this.standards.begin();
    this.sapperDraw = [];
    let bandits = 0;
    // pozycje poległych i zwolnionych żołnierzy nie wiszą w pamięci (sprzątanie, gdy uzbiera się zapas starych wpisów)
    if (this.drawnAt.size > g.soldiers.length + 64) { const live = new Set(g.soldiers.map((x) => x.id)); for (const id of this.drawnAt.keys()) if (!live.has(id)) this.drawnAt.delete(id); }
    for (const s of g.soldiers) {
      if (n >= MAX_UNITS) break;
      let prev = this.prevPos.get(s.id);
      // wejście na mur/pomost i zejście: symulacja przestawia go o całe pole naraz — bez przejścia między polami
      // (inaczej przez jeden krok symulacji szedł już na wysokości pomostu, ale jeszcze obok wieży)
      if (prev) {
        const t0 = (prev[1] >> 8) * width + (prev[0] >> 8), t1 = (s.py >> 8) * width + (s.px >> 8);
        if (t0 !== t1 && (((g.walls[t0]! & 16) !== 0) !== ((g.walls[t1]! & 16) !== 0) || towerUnder(g, t0)?.id !== towerUnder(g, t1)?.id)) prev = undefined;
      }
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
      // bije wrogiego chłopa: zwraca się do niego i dźga albo strzela tak jak do żołnierza
      // cel bez zbroi: chłop, w którego bije, albo wilk, do którego strzela łucznik (wolves.ts)
      const wolfT = !foe && !s.hitting && s.hitWolf ? g.wolves.find((w) => w.id === s.hitWolf) : undefined;
      const victim: { px: number; py: number } | undefined = !foe && s.hitting ? g.units.find((u) => u.id === s.hitting) : wolfT;
      if (victim && !walking) { heading = Math.atan2((victim.px - s.px) / FP, (victim.py - s.py) / FP); this.facing.set(s.id, heading); }
      // oblężenie: zwraca się do budynku i bije w niego włócznią
      const wall = !foe && s.target ? bById.get(s.target) : !foe && s.douse ? bById.get(s.douse) : undefined;
      if (wall && !walking) {
        const fp = footprint(BUILDINGS[wall.type]!, wall.rot);
        heading = Math.atan2(wall.x + fp.w / 2 - fx, wall.y + fp.h / 2 - fy);
        this.facing.set(s.id, heading);
      }
      // Mag Płomienia pali ciało (cremation.ts): stoi zwrócony do niego, ręce w górze z ogniem w dłoniach
      const pyreBody = s.pyreOf && !walking && !foe ? g.corpses.find((c) => c.id === s.pyreOf && c.pyre !== undefined && c.pyreBy === s.id) : undefined;
      if (pyreBody) {
        heading = Math.atan2((pyreBody.px - s.px) / FP, (pyreBody.py - s.py) / FP);
        this.facing.set(s.id, heading);
        // bez lecących kul: ogień w uniesionych dłoniach (poza rzucania), a ciało samo zajmuje się płomieniem (Michał 30.10.2026)
      }
      // mag leczy (mageheal.ts): zwraca się do leczonego (siebie leczy, stojąc jak stał)
      const healed = s.healing && s.healing !== s.id && !walking && !foe ? byId.get(s.healing) : undefined;
      if (healed) { heading = Math.atan2((healed.px - s.px) / FP, (healed.py - s.py) / FP); this.facing.set(s.id, heading); }
      // po dojściu obraca się w kierunek szyku (płynnie, nie skokiem)
      if (!walking && !foe && !wall && !pyreBody && !healed && s.face !== undefined && !s.path.length) {
        let diff = s.face * (Math.PI / 4) - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > 0.01) { heading += this.calm ? diff : diff * 0.15; this.facing.set(s.id, heading); }
      }
      const swing = walking ? Math.sin(st.phase) * 0.5 : 0;
      const udef = UNITS[s.kind]!;
      const ranged = !!udef.range;
      const striking = !udef.sapper && !udef.ladderman && (!!foe || !!wall || !!victim) && !walking && (ranged ? s.cd > udef.cooldown - 8 : s.cd > 6);
      // łucznik na wieży stoi na pomoście
      let lift = s.up ? (s.post ? TOWER_TOP[BUILDINGS[bById.get(s.post)?.type ?? 0]!.id] ?? WATCH_TOWER_TOP : WATCH_TOWER_TOP) : 0;
      // życie na wieży: bez walki każdy zajęty czym innym (oparty o barierkę, siedzi, wypatruje, czwarty pod wieżą);
      // przy ataku wszyscy na pomoście obok siebie, od strony wroga, i strzelają w tamtą stronę
      let towerSit = false, towerLean = 0, towerAt: [number, number] | null = null;
      const tw0 = s.up && s.post ? bById.get(s.post) : undefined;
      // łucznik na murze kamiennym: stoi na chodniku za blankami, dwaj obok siebie, przodem na zewnątrz
      const onWall = !!tw0 && BUILDINGS[tw0.type]!.id === 'stoneWall';
      const tw = onWall ? undefined : tw0;
      if (onWall) {
        const crew = crews.get(tw0!.id) ?? [s.id], idx = crew.indexOf(s.id);
        lift = STONE_WALL_TOP + this.walls.levelDelta(view, tw0!.y * width + tw0!.x, width);
        const along = (idx - (crew.length - 1) / 2) * 0.24;
        const wx = !!(g.occupancy[tw0!.y * width + tw0!.x - 1] || g.occupancy[tw0!.y * width + tw0!.x + 1]);
        towerAt = wx ? [tw0!.x + 0.5 + along, tw0!.y + 0.5] : [tw0!.x + 0.5, tw0!.y + 0.5 + along];
        if (!foe) {
          const kp = g.buildings.find((o) => o.type === 0 && o.owner === s.owner);
          const ax = tw0!.x + 0.5 - (kp ? kp.x + 1.5 : 0), az = tw0!.y + 0.5 - (kp ? kp.y + 1.5 : 0);
          heading = wx ? (az >= 0 ? 0 : Math.PI) : (ax >= 0 ? Math.PI / 2 : -Math.PI / 2);
          this.facing.set(s.id, heading);
        }
      }
      if (tw) {
        const fpT = footprint(BUILDINGS[tw.type]!, tw.rot), tcx = tw.x + fpT.w / 2, tcy = tw.y + fpT.h / 2;
        const crew = crews.get(tw.id) ?? [s.id], idx = crew.indexOf(s.id), fight = crewFight.get(tw.id);
        // większe baszty (3×3, 4×4): szerszy pomost, łucznicy rozstawieni dalej od środka i gęściej przy barierce
        const big = fpT.w > 2, rr = (fpT.w / 2) * 0.42;
        if (fight) {
          const ang = Math.atan2(fight[0] - tcx, fight[1] - tcy);
          // przy barierce od strony wroga mieści się tylu, ilu zmieści bok pomostu; reszta stoi w drugim szeregu
          const row = big ? Math.max(4, Math.floor((rr * 2.6) / 0.3)) : crew.length, rank = Math.floor(idx / row), inRow = Math.min(row, crew.length - rank * row);
          const side = ((idx % row) - (inRow - 1) / 2) * (big ? 0.3 : 0.32), dist = rr - rank * 0.36;
          towerAt = [tcx + Math.sin(ang) * dist + Math.cos(ang) * side, tcy + Math.cos(ang) * dist - Math.sin(ang) * side];
          if (!foe) { heading = ang; this.facing.set(s.id, heading); }
        } else if (fpT.w < 2) {
          // czatownia: jeden łucznik na ciasnym pomoście, stoi pośrodku i powoli się rozgląda
          towerAt = [tcx, tcy];
          heading = Math.sin(this.time * 0.15 + s.id) * 1.6;
          this.facing.set(s.id, heading);
        } else if (big) {
          // bez walki rozchodzą się po pomoście (każdy w swoim miejscu, przodem na zewnątrz), co trzeci przysiada
          const a = idx * 2.39996 + tw.id, r = rr * (0.55 + 0.45 * ((idx * 0.618) % 1));
          towerAt = [tcx + Math.sin(a) * r, tcy + Math.cos(a) * r];
          heading = a + Math.sin(this.time * 0.2 + s.id) * 0.5;
          if (idx % 3 === 1) { towerSit = true; lift -= 0.17; } else if (idx % 3 === 0) towerLean = 0.12;
          this.facing.set(s.id, heading);
        } else {
          const role = idx % 4;
          const corner = [[0.42, 0.42], [-0.42, 0.38], [0.4, -0.42], [0, 0]][role]!;
          if (role === 3 && crew.length >= 4) {
            // czwarty schodzi pod wieżę: stoi przy drabinie i pilnuje wejścia
            towerAt = [tcx + 0.15, tcy + fpT.h / 2 + 0.35]; lift = 0;
            heading = Math.PI * 0.1 + Math.sin(this.time * 0.13 + s.id) * 0.6;
          } else {
            towerAt = [tcx + corner[0]!, tcy + corner[1]!];
            const out = Math.atan2(corner[0]!, corner[1]!);
            heading = out + (role === 2 ? Math.sin(this.time * 0.25 + s.id) * 0.9 : 0); // wypatrujący powoli rozgląda się
            if (role === 0) towerLean = 0.16; // oparty o barierkę, pochylony
            if (role === 1) { towerSit = true; lift -= 0.17; }
          }
          this.facing.set(s.id, heading);
        }
      }
      // stoi na pomoście drewnianej strażnicy (wszedł jak na teren): pola wieży sięgają aż po nogi z bali,
      // więc obrazek stoi trochę bliżej środka pomostu, między słupami, a nie w nich
      if (!tw0 && !s.up) {
        const tb = towerUnder(g, (s.py >> 8) * width + (s.px >> 8));
        if (tb && BUILDINGS[tb.type]!.id === 'watchtower') {
          const fpT = footprint(BUILDINGS[tb.type]!, tb.rot), tcx = tb.x + fpT.w / 2, tcy = tb.y + fpT.h / 2;
          towerAt = [tcx + (fx - tcx) * 0.76, tcy + (fy - tcy) * 0.76];
        }
      }
      // przesunięcie do środka grupy narasta i znika płynnie, więc po dojściu nikt nie „doskakuje” do kolegów
      const want = pull.get(s.id) ?? [0, 0];
      const cur = this.pullNow.get(s.id) ?? [0, 0];
      const k = this.calm ? 1 : 0.06;
      cur[0] += (want[0] - cur[0]) * k; cur[1] += (want[1] - cur[1]) * k;
      this.pullNow.set(s.id, cur);
      // łuki na zakrętach i omijanie mijających się (tylko w wyglądzie); patrzy tam, dokąd idzie
      // po wejściu na mur lub pomost (i zejściu) symulacja przestawia go o pole: tu też od razu na nowym miejscu,
      // a nie płynnie z ziemi (wcześniej szedł już na wysokości pomostu, ale jeszcze poza wieżą, i „doskakiwał”)
      const tileNow = (s.py >> 8) * width + (s.px >> 8);
      const lvl = (g.walls[tileNow]! & 16) ? (towerUnder(g, tileNow)?.id ?? 0) + 1 : 0;
      const jumped = this.levelOf.get(s.id) !== undefined && this.levelOf.get(s.id) !== lvl;
      this.levelOf.set(s.id, lvl);
      if (jumped) this.towerPose.delete(s.id);
      // wszedł do kamiennej wieży: wychodzi na pomost z klatki schodowej w środku i dopiero idzie na swoje miejsce
      const intoStone = jumped && lvl > 1 && (() => { const tb = towerUnder(g, tileNow); return tb && isStoneTower(BUILDINGS[tb.type]!.id) ? tb : undefined; })();
      if (intoStone && !this.calm) {
        const fpS = footprint(BUILDINGS[intoStone.type]!, intoStone.rot);
        this.crowd.place(s.id, intoStone.x + fpS.w / 2, intoStone.y + fpS.h / 2, heading);
        this.towerPose.set(s.id, [intoStone.x + fpS.w / 2, intoStone.y + fpS.h / 2]);
      }
      const cv = this.crowd.move(s.id, fx + cur[0], fy + cur[1], heading, this.calm || !!s.up || (jumped && !intoStone), true);
      if (walking && cv.speed > 0.3) { heading = cv.heading; this.facing.set(s.id, heading); }
      let px = cv.sx, pz = cv.sy;
      if (towerAt) {
        // płynnie przechodzi na nowe miejsce (z pomostu pod wieżę i z powrotem, do barierki przy ataku)
        const tp = this.towerPose.get(s.id) ?? [towerAt[0], towerAt[1]];
        const kk = this.calm ? 1 : 0.05;
        tp[0] += (towerAt[0] - tp[0]) * kk; tp[1] += (towerAt[1] - tp[1]) * kk;
        this.towerPose.set(s.id, tp);
        px = tp[0]; pz = tp[1];
      } else this.towerPose.delete(s.id);
      if (walking && !s.up) this.footstep(g, s.id, px, pz, st.phase, 0.55);
      let y = this.standY(view, px, pz, s.up ? -1 : (s.py >> 8) * width + (s.px >> 8)) + lift;
      // wspinaczka po drabinie na mur albo pomost wieży (i zejście): stoi przy krawędzi pól i powoli wznosi się (opada);
      // w kamiennej wieży idzie schodami w środku — wtedy go nie widać, dopóki nie wyjdzie na pomost (albo drzwiami na dół)
      if (s.climb !== undefined && s.climbTo !== undefined && !s.up) {
        const from = (s.py >> 8) * width + (s.px >> 8), to = s.climbTo, W = width;
        // wyżej leży pole wieży (albo korona muru, gdy wchodzi z ziemi na mur); niżej ziemia albo korona muru
        const tAt = (t: number): string => { const o = buildingById(g, g.occupancy[t]); return o && isTower(BUILDINGS[o.type]!.id) && (g.walls[t]! & 16) ? BUILDINGS[o.type]!.id : ''; };
        const hOf = (t: number): number => { const id = tAt(t); return id ? TOWER_TOP[id] ?? WATCH_TOWER_TOP : (g.walls[t]! & 16) ? STONE_WALL_TOP : 0; };
        const upward = hOf(to) > hOf(from), top = upward ? to : from, low = upward ? from : to;
        const tid = tAt(top);
        const L = hOf(low), H = hOf(top) - L;
        const p = Math.max(0, Math.min(1, 1 - s.climb / CLIMB_TICKS));
        const ex = ((from % W) + (to % W)) / 2 + 0.5, ez = (Math.floor(from / W) + Math.floor(to / W)) / 2 + 0.5;
        // przy drabinie po stronie ziemi (drabina stoi przed krawędzią)
        const gx = upward ? from % W : to % W, gz = upward ? Math.floor(from / W) : Math.floor(to / W);
        px = ex + (gx + 0.5 - ex) * 0.25; pz = ez + (gz + 0.5 - ez) * 0.25;
        y = view.heightAt(px, pz) + L + H * (upward ? p : 1 - p);
        heading = Math.atan2((top % W) + 0.5 - (gx + 0.5), Math.floor(top / W) + 0.5 - (gz + 0.5));
        this.facing.set(s.id, heading);
        if (isStoneTower(tid)) y = -50; // schody w środku kamiennej wieży
      }
      t.position.set(px - width / 2, y + (walking ? Math.abs(Math.cos(st.phase)) * 0.02 : 0), pz - height / 2);
      // krew w walce: trafienie (spadek zdrowia) pryska kroplami, ciężko ranny gubi krople, idąc; taran nie krwawi
      if (!udef.ram && s.hp > 0 && y > -10) {
        const gy = view.heightAt(px, pz);
        this.bloodFx.track(s.id, s.hp, udef.hp, px, y, pz, heading, walking && y - gy < 0.2, this.time, this.bloodGround);
        if (!this.calm) this.breath.breathe(s.id, t.position.x, t.position.y + 0.42, t.position.z, heading, this.time, this.camPos, !!foe || (walking && !!s.run));
      }
      if (walking && !s.up) this.feet.set(s.id, [px, pz, y]); // ślady butów: tam, gdzie naprawdę stoi na ekranie
      { const d = this.drawnAt.get(s.id); if (d) d.copy(t.position); else this.drawnAt.set(s.id, t.position.clone()); }
      // przymrożony czarem wody: lód wokół stóp i chłodna poświata (spells.ts), dopóki czar trwa
      if ((s.slow ?? 0) > g.tick && !this.calm && s.hp > 0) this.spells.frost(t.position, s.id);
      // płonący po ognistej strzale albo kuli ognia: języki ognia na ubraniu, żar i dym (spells.ts), dopóki ogień nie zgaśnie
      if (s.burn && !this.calm && s.hp > 0) this.spells.burning(t.position, s.id);
      // strzał: symulacja zapisała chwilę wypuszczenia (s.shot) — strzała wylatuje dokładnie wtedy, gdy ręka puszcza cięciwę
      // (wcześniej obraz zgadywał po skoku odliczania i przy mierzeniu do nowego celu puszczał strzałę „z powietrza”)
      const pc = this.lastCd.get(s.id) ?? 0;
      const ls = this.lastShot.get(s.id);
      const fired = ranged ? ls !== undefined && (s.shot ?? -1) !== ls : s.cd > pc;
      // ślady walki na postaci: plamy krwi na ubraniu rannego, krew na ostrzu przez ok. 40 s po ciosie (peasants.ts)
      if (fired && !ranged && !udef.ram && (foe || victim)) this.bladeAt.set(s.id, this.time);
      {
        const frac = s.hp / Math.max(1, udef.hp), lvl = frac < 0.2 ? 3 : frac < 0.38 ? 2 : frac < 0.62 ? 1 : 0;
        const bl = this.bladeAt.get(s.id), bloody = bl !== undefined && this.time - bl < 40;
        if (lvl || bloody) this.woundMarks.set(s.id, [lvl, bloody]); else this.woundMarks.delete(s.id);
      }
      this.lastShot.set(s.id, s.shot ?? -1);
      if (ranged && fired && (foe || wall || victim) && !this.calm && this.arrows.count < MAX_ARROWS) {
        let tx: number, ty: number, th: number;
        // dźwięk trafienia: w ciało, w zbroję (strażnik, zbrojny), w drewno albo w kamień muru; część strzał wbija się w ziemię obok
        let hit: WorldSound;
        // wysokość celu jak jego obrazek (standY): na koronie muru, na murach zamku i na wieży — strzała leci w człowieka, nie w mur pod nim
        if (foe) { tx = foe.px / FP; ty = foe.py / FP; th = foe.up ? 2.3 : this.standY(view, tx, ty, (foe.py >> 8) * width + (foe.px >> 8)) - view.heightAt(tx, ty) + 0.45; const fd = UNITS[foe.kind]; hit = Math.random() < 0.25 ? 'arrowDirt' : fd?.guard || fd?.id === 'manatarms' ? 'arrowMetal' : 'flesh'; }
        else if (victim) { tx = victim.px / FP; ty = victim.py / FP; th = wolfT ? 0.25 : this.standY(view, tx, ty, (victim.py >> 8) * width + (victim.px >> 8)) - view.heightAt(tx, ty) + 0.4; hit = Math.random() < 0.25 ? 'arrowDirt' : 'flesh'; }
        else { const wd = BUILDINGS[wall!.type]!, fp = footprint(wd, wall!.rot); tx = wall!.x + fp.w * (0.25 + Math.random() * 0.5); ty = wall!.y + fp.h * (0.25 + Math.random() * 0.5); th = 0.5 + Math.random() * 0.7; /* rozrzut po ścianach i dachu, nie wszystkie w jeden punkt */ hit = (wd.cost.stone ?? 0) > (wd.cost.wood ?? 0) ? 'arrowStone' : 'arrowWood'; }
        if (s.up && s.post) this.towerIcons.shot(s.post, this.time);
        // cel: pierś narysowanego wroga (pozycja z poprzedniej klatki), a gdy go jeszcze nie ma — wyliczona wysokość
        const seen = foe ? this.drawnAt.get(foe.id) : wolfT ? this.wolfPos.get(wolfT.id) : undefined;
        const aim = seen ? new THREE.Vector3(seen.x, seen.y + (foe ? 0.95 : 0.28), seen.z) : new THREE.Vector3(tx - width / 2, view.heightAt(tx, ty) + th, ty - height / 2);
        if (udef.magic) {
          // czar z dłoni: kula ognia albo wody leci do celu (trafienie liczy symulacja, to tylko wygląd)
          const hx = Math.sin(heading) * 0.2, hz = Math.cos(heading) * 0.2;
          // mag na murze albo wieży (albo cel na murze) strzela ponad budynkami: kula leci łukiem nad dachem, nie przez ścianę
          const tgt = foe ?? victim;
          const arc = tgt && firstBlock(g, s, tgt, !!(foe && (foe.up || high(g, foe)))) >= 0 ? 1.5 : 0;
          this.spells.cast(this.armV.set(px - width / 2 + hx, y + 0.5, pz - height / 2 + hz), this.mouth.copy(aim), udef.magic === 'fire', arc);
          // dźwięk czaru: buchnięcie ognia albo świst wody — nie zamach miecza (Michał 30.10.2026: „jak broń metalowa”)
          if (udef.magic === 'fire') this.playHere('torch', t.position.x, t.position.z, 1, t.position.y + 1, 0.8);
          else this.playHere('arrowfly', t.position.x, t.position.z, 1.1, t.position.y + 1, 0.65);
        } else {
          const from = new THREE.Vector3(px - width / 2, y + 0.5, pz - height / 2);
          // gdzie strzała zostanie po trafieniu (arrows.ts): chybiona w ziemi, w budynku na jego ścianie, inaczej w trafionym
          let stick: Stick;
          if (hit === 'arrowDirt') stick = { ground: true };
          else if (foe) stick = { unit: foe.id };
          else if (victim && !wolfT) stick = { unit: s.hitting };
          else if (wall) { stick = { wall: wall.id }; wallFace(wall, from, aim, width, height, view); }
          else stick = {};
          this.arrows.shoot(from, aim, fireArrow(g, s) || (!foe && !victim && fireTarget.has(s.id)), hit, stick);
          // puszczenie cięciwy (nagrania 0 A.D.) z miejsca łucznika, także z wieży
          this.playHere('bow', t.position.x, t.position.z, 1, t.position.y + 1);
        }
      }
      // wielki czar (greatspell.ts): deszcz ognia albo lodowy krąg w miejscu zapisanym przez symulację
      if (udef.magic && s.greatShot !== undefined && this.lastGreat.get(s.id) !== s.greatShot) {
        const first = !this.lastGreat.has(s.id) && g.tick - s.greatShot > GREAT_FLIGHT;
        this.lastGreat.set(s.id, s.greatShot);
        if (!first && !this.calm && s.greatX !== undefined && s.greatY !== undefined) {
          const gx = s.greatX / FP, gy = s.greatY / FP;
          const hx = Math.sin(heading) * 0.2, hz = Math.cos(heading) * 0.2;
          this.spells.great(this.armV.set(px - width / 2 + hx, y + 0.5, pz - height / 2 + hz), this.mouth.set(gx - width / 2, view.heightAt(gx, gy), gy - height / 2), udef.magic === 'fire', GREAT_FLIGHT / TICKS_PER_SECOND);
          if (udef.magic === 'fire') this.playHere('fire', t.position.x, t.position.z, 1.2, t.position.y + 1, 0.85);
          else this.playHere('arrowfly', t.position.x, t.position.z, 1.3, t.position.y + 1, 0.5);
        }
      }
      if (fired) this.hits.set(s.id, (this.hits.get(s.id) ?? 0) + 1);
      this.lastCd.set(s.id, s.cd);
      // miecz (strażnik miejski, zbrojny): kombinacja ciosów fazami według odliczania do ciosu; obrót ciała w poprzek ciosu
      // łucznik: wypuszczenie, sięgnięcie do kołczanu, nałożenie strzały i naciąg (bokiem do celu) fazami do następnego strzału
      const bowPose = ranged && !udef.magic && (!!foe || !!wall || !!victim) && !walking && !this.calm ? bowShot(1 - Math.max(0, s.cd - alpha) / Math.max(1, s.shot !== undefined && g.tick - s.shot < udef.cooldown * 2 ? s.cd + (g.tick - s.shot) : udef.cooldown)) : undefined;
      const swordPose = (udef.guard || udef.id === 'manatarms') && (!!foe || !!wall || !!victim) && !walking && !this.calm
        ? swordCombo(this.hits.get(s.id) ?? 0, 1 - Math.max(0, s.cd - alpha) / udef.cooldown) : undefined;
      // trafiony odchyla się do tyłu i lekko cofa na ułamek sekundy
      const was = this.soldierHp.get(s.id);
      if (was !== undefined && s.hp < was && !this.calm) this.hitAt.set(s.id, this.time);
      this.soldierHp.set(s.id, s.hp);
      const since = this.time - (this.hitAt.get(s.id) ?? -9);
      const flinch = since < 0.3 ? Math.sin((since / 0.3) * Math.PI) : 0;
      if (flinch) { t.position.x -= Math.sin(heading) * flinch * 0.06; t.position.z -= Math.cos(heading) * flinch * 0.06; }
      // stojący bez walki: przenosi ciężar, rozgląda się, przestępuje, opiera o włócznię; w marszu kołysze się z krokiem
      const ia = !walking && !striking && !foe && !wall && !victim && !this.calm ? idle(s.id, this.time, true) : undefined;
      const sway = ia ? ia.roll : walking ? Math.sin(st.phase) * 0.025 : 0;
      t.rotation.set(-flinch * 0.32 + (walking ? 0.04 : 0) + towerLean, heading + (towerAt ? 0 : ia?.yaw ?? 0) + (swordPose?.[2] ?? bowPose?.[5] ?? 0), sway, 'YXZ');
      if (ia) t.position.y += ia.dy;
      t.scale.setScalar(1.08 * FIG);
      t.updateMatrix();
      t.scale.setScalar(1);
      t.rotation.order = 'XYZ';
      this.fallYaw.set(s.id, heading);
      if (striking && !this.calm && !udef.magic) {
        // zamach (miecz albo włócznia) i uderzenie: w mur jak w drewno, w człowieka — szczęk ostrzy, tarcza albo ciało
        const sword = udef.guard || udef.id === 'manatarms';
        this.sfxAt(sword ? 'swing' : 'spear', t.position.x, t.position.z, s.id, 1.1, 0.9);
        if (s.cd > 10 && this.time >= (this.blowAt.get(s.id) ?? 0)) {
          // jeden zegar na żołnierza (a nie na rodzaj dźwięku), żeby losowy rodzaj ciosu nie mnożył uderzeń
          const first = !this.blowAt.has(s.id);
          this.blowAt.set(s.id, this.time + 1.1 * (0.85 + Math.random() * 0.3));
          const r = Math.random();
          const blow: WorldSound = wall ? 'plank' : r < 0.4 ? 'clang' : r < 0.65 ? 'shield' : r < 0.75 ? 'shieldMetal' : 'flesh';
          if (!first) this.playHere(blow, t.position.x, t.position.z, 1, t.position.y + 1);
        }
      }
      // nocą strażnik miejski niesie pochodnię w uniesionej lewej ręce, jak chłopi (Michał 30.10.2026: stara wisiała obok
      // niego); w walce ręka wraca do miecza, pochodnia zostaje w dłoni. Reszta wojska ma ręce zajęte bronią i tarczą
      const guardTorch = torchesOn && !!udef.guard && !this.calm;
      if (guardTorch) {
        this.armM.makeRotationX(TORCH_ARM).setPosition(-0.135, 0.45, 0);
        this.armM.premultiply(t.matrix);
        this.guardTorches.setMatrixAt(torches++, this.armM);
        this.pushHandFlameAt(this.armM, TORCH_TIP);
      }
      // pochodnia wbita w ziemię obok łucznika, który strzela w budynek (płomień palący się także w dzień)
      if (torchBearers.has(s.id) && !this.calm) {
        let pl = this.planted.get(s.id);
        if (!pl || pl.b !== s.target) {
          // pół kroku przed nim i w bok (po prawej, z dala od łuku), stoi na ziemi w tym miejscu
          const fx = px + Math.sin(heading) * 0.25 + Math.cos(heading) * 0.3, fz = pz + Math.cos(heading) * 0.25 - Math.sin(heading) * 0.3;
          pl = { x: fx - width / 2, y: this.standY(view, fx, fz, -2), z: fz - height / 2, b: s.target };
          this.planted.set(s.id, pl);
        }
        this.plantTorch(pl.x, pl.y, pl.z);
        if (this.stickFlameN < 64) (this.stickFlames[this.stickFlameN++] ??= new THREE.Vector3()).set(pl.x, pl.y + STICK_TIP, pl.z);
      }
      // zbój z lasu nie ma pana: skóry i brudne płótno zamiast barw drużyny
      const teamC = g.players[s.owner] ? TEAM_COLORS[g.players[s.owner]!.team] ?? 0x888888 : BANDIT_COLOR;
      if (bearers.has(s.id)) this.standards.add(t.matrix, s.owner, teamC, this.crestOf(s.owner));
      // każdy rodzaj ma własny model: strażnik miejski (miecz, zbroja Starego Obozu), łucznik, włócznik
      const legs = ia?.legs ? ia.legs : swing;
      this.guardsFig.set(n, udef.guard ? t.matrix : ZERO, legs, striking, teamC, s.id, undefined, -0.5, false, undefined, 0, swordPose ? [swordPose[0], swordPose[1], 0, guardTorch ? TORCH_ARM : undefined] : guardTorch && !striking ? [legs * 0.55 - 0.15, -0.55, 0, TORCH_ARM] : undefined);
      // mag bojowy: postać swojego zakonu; ręce w górze z kulą w dłoni, gdy szykuje czar (od połowy odliczania do rzutu)
      if (udef.magic) {
        const u = 1 - Math.max(0, s.cd - alpha) / udef.cooldown;
        const casting = !!pyreBody || (!!s.healing && !walking) || ((!!foe || !!wall || !!victim) && !walking && (u > 0.45 || u < 0.1));
        (udef.magic === 'fire' ? this.battleFireFig : this.battleWaterFig).set(0, t.matrix, legs, casting, teamC, s.id);
      }
      // kulki leczenia: dwie małe, świetliste, krążą wokół leczonego na różnych wysokościach (od pasa po głowę)
      const school = healers.get(s.id);
      if (school && !this.calm && orbs < 254) {
        for (let k = 0; k < 2; k++) {
          const a = this.time * (1.7 + k * 0.4) + s.id * 1.3 + k * Math.PI;
          const h = 0.32 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * (1.1 + k * 0.5) + s.id + k * 2));
          this.orbM.makeScale(1, 1, 1).setPosition(t.position.x + Math.cos(a) * 0.2, t.position.y + h, t.position.z + Math.sin(a) * 0.2);
          this.healOrbs.setMatrixAt(orbs, this.orbM);
          this.healOrbs.setColorAt(orbs, this.orbC.setHex(school === 'fire' ? 0xffd47a : 0x9ef5d0));
          orbs++;
        }
      }
      this.archers.set(n, ranged && !udef.magic ? t.matrix : ZERO, legs, striking, teamC, s.id, undefined, -0.5, false, towerSit ? -1.45 : undefined, 0, bowPose && [bowPose[0]!, 0, 0, bowPose[4]!, bowPose[3]!, bowPose[1]!, bowPose[2]!]);
      const heavy = udef.id === 'manatarms';
      this.menAtArms.set(n, heavy ? t.matrix : ZERO, legs, striking, teamC, s.id, undefined, -0.5, false, undefined, 0, swordPose && [swordPose[0], swordPose[1]]);
      // włócznik w walce: włócznia opuszczona na wroga, cofnięcie i pchnięcie fazami według odliczania do ciosu
      const spearPose = !ranged && !udef.ram && (!!foe || !!wall || !!victim) && !walking && !this.calm ? spearThrust(1 - Math.max(0, s.cd - alpha) / udef.cooldown) : undefined;
      this.spearmen.set(n, !ranged && !udef.guard && !udef.ram && !heavy && !udef.sapper && !udef.ladderman && !udef.bandit ? t.matrix : ZERO, legs, striking, teamC, s.id, undefined, -0.5, false, undefined, 0, spearPose);
      // zbój z puszczy: własny model z toporem (tools/models/bandit.py)
      if (udef.bandit && bandits < 256) {
        // w walce cios toporem idzie fazami według odliczania do następnego ciosu: po trafieniu dociąga cięcie,
        // wraca do gardy, potem zamach zza głowy i szybkie cięcie w dół — trafienie wypada na końcu cięcia
        const fighting = (!!foe || !!wall || !!victim) && !walking;
        const pose = fighting && !this.calm ? axeChop(1 - Math.max(0, s.cd - alpha) / udef.cooldown) : undefined;
        this.banditsFig.set(bandits++, t.matrix, legs, striking, teamC, s.id, undefined, -0.5, false, undefined, 0, pose);
      }
      // saper: postać chłopa w barwach pana z kilofem; rysuje go pula chłopów (syncUnits) w następnej klatce
      if (udef.sapper) this.sapperDraw.push({ m: t.matrix.clone(), swing: legs, walking, work: !!wall && !walking && !s.loot && wall.ruined === true, carry: s.loot ? s.loot - 1 : -1, team: teamC, id: s.id });
      // drabiniarz: postać sapera, niesie drabinę szturmową oburącz (po przystawieniu idzie z pustymi rękami po następną)
      else if (udef.ladderman) this.sapperDraw.push({ m: t.matrix.clone(), swing: legs, walking, work: false, carry: s.noLadder ? -1 : LADDER_RI, team: teamC, id: s.id });
      if (udef.ram && rams < 256) {
        // wóz jedzie przodem (głowicą) w stronę marszu; belka cofa się, gdy taran szykuje cios, i wybija się do przodu przy uderzeniu
        // pod budynkiem: głowicą prosto w najbliższy kawałek ściany celu (nie bokiem, jak stanął po drodze)
        let rh = heading;
        const tb = !walking && s.target ? g.buildings.find((b) => b.id === s.target) : undefined;
        if (tb) {
          const fp = footprint(BUILDINGS[tb.type]!, tb.rot);
          const nx = Math.max(tb.x, Math.min(tb.x + fp.w, px)), nz = Math.max(tb.y, Math.min(tb.y + fp.h, pz));
          if ((nx - px) ** 2 + (nz - pz) ** 2 > 1e-4) rh = Math.atan2(nx - px, nz - pz);
        }
        m.makeRotationY(rh).setPosition(px - width / 2, y, pz - height / 2);
        this.ramBodies.setMatrixAt(rams, m);
        const k = s.cd / udef.cooldown;
        const hitting = !walking && s.target && s.cd > 0;
        const off = !hitting ? 0 : k > 0.85 ? 0.13 * ((k - 0.85) / 0.15) : -0.12 * (1 - k / 0.85);
        this.armM.makeTranslation(0, 0, off).premultiply(m);
        this.ramBeams.setMatrixAt(rams, this.armM);
        if (hitting && k > 0.97 && !this.calm) this.sfxAt('plank', px - width / 2, pz - height / 2, `ram${s.id}`, 0.5, 1.2);
        rams++;
      }
      let pos = this.soldierPos.get(s.id);
      if (!pos) { pos = new THREE.Vector3(); this.soldierPos.set(s.id, pos); }
      // kółko i ramka zaznaczenia idą za figurą (z dociągnięciem do grupy), nie za polem z symulacji
      pos.set(px - width / 2, y, pz - height / 2);
      if (udef.guard && ((guardOwner === s.owner && !s.camp) || (guardCamp && s.camp === guardCamp)) && guardRingN < MAX_UNITS) {
        m.makeTranslation(pos.x, y + 0.03, pos.z); this.guardRings.setMatrixAt(guardRingN, m);
        this.guardPin(guardRingN++, pos.x, y, pos.z);
      }
      if (this.soldierSel.has(s.id)) {
        m.makeTranslation(pos.x, y + 0.03, pos.z); this.ringsBack.setMatrixAt(rings, m); this.rings.setMatrixAt(rings++, m);
        // kropka na polu docelowym, póki żołnierz idzie
        // cel rozkazu (goal), nie najbliższy krok: w zwartym szyku droga to tylko pole przed żołnierzem
        const dest = s.goal >= 0 ? s.goal : s.path.length ? s.path[s.path.length - 1]! : -1;
        if (dest >= 0) {
          const dx = dest % width, dy = (dest - dx) / width;
          const pulse = 0.75 + Math.sin(this.time * 6 + s.id) * 0.25;
          let ox = dx + 0.5, oy = dy + 0.5;
          const tg = s.tight && s.grp && s.goal >= 0 ? tightGoal.get(s.grp) : undefined;
          if (tg && tg[2] > 1) { ox += (tg[0] / tg[2] - ox) * TIGHT; oy += (tg[1] / tg[2] - oy) * TIGHT; }
          m.makeScale(pulse * (tg ? 0.7 : 1), 1, pulse * (tg ? 0.7 : 1)).setPosition(ox - width / 2, view.heightAt(ox, oy) + 0.035, oy - height / 2);
          this.dots.setMatrixAt(dots++, m);
        }
      }
      n++;
    }
    this.guardRings.count = guardRingN;
    touch(this.guardRings);
    for (let i = guardRingN; i < this.guardPins.length; i++) this.guardPins[i]!.visible = false;
    this.dots.count = dots;
    touch(this.dots);
    (this.dots.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(this.time * 6) * 0.35;
    // fala rozkazu: rośnie i blednie przez pół sekundy
    this.animatePings(1 / 60);
    this.waveAge += 1 / 60;
    this.wave.visible = this.waveAge < 0.6;
    if (this.wave.visible) { const k = this.waveAge / 0.6; this.wave.scale.setScalar(0.6 + k * 1.6); (this.wave.material as THREE.MeshBasicMaterial).opacity = 1 - k; }
    // wartownicy na murach zamków to teraz prawdziwi strażnicy (guardSystem), nie ozdoba
    this.ramBodies.count = rams; this.ramBeams.count = rams;
    touch(this.ramBodies); touch(this.ramBeams);
    this.spearmen.finish(n);
    this.archers.finish(n);
    this.guardsFig.finish(n);
    this.menAtArms.finish(n);
    this.banditsFig.finish(bandits);
    this.battleFireFig.finish(0);
    this.battleWaterFig.finish(0);
    this.arrows.groundAt = (x, z) => view.heightAt(x + width / 2, z + height / 2);
    this.arrows.fly(this.calm);
    this.spells.update(this.calm ? 1 : 1 / 60, this.time, this.cam.camera);
    this.towerIcons.sync(g, this.view, this.time);
    this.rallyFlags.sync(g, view, this.me, this.crestOf(this.me), this.time);
    this.spawnFx.sync(g, view, this.cam.camera, this.calm);
    this.chips.step(1 / 60);
    this.soldierTorches.count = 0;
    this.guardTorches.count = torches;
    this.healOrbs.count = orbs; this.healOrbs.visible = orbs > 0;
    if (orbs) { touch(this.healOrbs); if (this.healOrbs.instanceColor) touch(this.healOrbs); }
    if (this.plantedTorches) { this.plantedTorches.count = this.plantedN; touch(this.plantedTorches); }
    touch(this.soldierTorches);
    // ciała: leżą na ziemi, z czasem ciemnieją i zapadają się (rozkład trwa ok. 10 minut gry)
    let c = 0;
    this.stains.begin();
    this.arrows.beginBodies();
    const lay = new THREE.Quaternion(), sc = new THREE.Vector3();
    let pc = 0, ac = 0, gc = 0, sp = 0, mc = 0, sc2 = 0, bc = 0, mf = 0, mw = 0;
    // spaleni w ogniu: zwęglone ciała (Figures.charred w pulach ciał)
    this.burntBodies.clear();
    this.frozenBodies.clear();
    for (const body of g.corpses) { if (body.burnt) this.burntBodies.add(body.id); else if (body.frozen) this.frozenBodies.add(body.id); }
    for (const body of g.corpses) {
      if (c >= MAX_UNITS) break;
      if (body.kind === -2) continue; // zabity wilk: rysuje go syncWolves (leży na boku)
      const fx = body.px / FP, fy = body.py / FP;
      const age = Math.min(1, (g.tick - body.at) / 6000);
      // poległ na wieży albo na murze: leży na pomoście/chodniku (dopóki budynek stoi), na koronie muru twierdzy — na murze
      const onPost = body.post ? bById.get(body.post) : undefined;
      const postId = onPost && !onPost.ruined ? BUILDINGS[onPost.type]!.id : '';
      const y = postId ? view.heightAt(fx, fy) + (postId === 'stoneWall' ? STONE_WALL_TOP + this.walls.levelDelta(view, (body.py >> 8) * width + (body.px >> 8), width) : TOWER_TOP[postId] ?? WATCH_TOWER_TOP)
        : this.standY(view, fx, fy, (body.py >> 8) * width + (body.px >> 8));
      // padanie — każdy pada inaczej (zależnie od numeru ciała): na plecy, na twarz, na bok albo osuwa się na ziemię
      // i dopiero wtedy przewraca na plecy. Przewrót przyspiesza i kończy się małym odbiciem przy ziemi
      const how = deathKind(body.id);
      // czas z ułamkiem ticku (alpha): ticków jest 10 na sekundę, więc bez tego upadek szedł skokami jak w kilku klatkach
      const fall = Math.max(0, Math.min(1, (g.tick + alpha - body.at) / (TICKS_PER_SECOND * (how === 3 ? 1.4 : 0.7))));
      // śmierć: dawny krzyk (C-Dogs) brzmiał jak dmuchanie albo zjawa i został zdjęty (Michał 27.10.2026, 0.53.14);
      // teraz prawdziwe nagrania jęku i krzyku umierającego (0 A.D.), cicho i nie przy każdym — w tłumie bitwy co któryś
      if (fall < 0.3 && !this.calm && !this.screamed.has(body.id)) { this.screamed.add(body.id); if (body.id % 3 !== 0) this.voiceAt('death', fx - width / 2, fy - height / 2, 0.8); }
      const ease = fall < 0.85 ? (fall / 0.85) ** 2 : 1 - Math.sin(((fall - 0.85) / 0.15) * Math.PI) * 0.06;
      const yaw = this.fallYaw.get(body.id) ?? ((body.id * 2.39) % 6.28);
      const e = this.calm ? 1 : ease;
      // osuwa się: najpierw siada (nogi w przód, ciało w dół), potem przewraca się na plecy, a nogi kładą się płasko
      const e1 = how === 3 ? (this.calm ? 1 : Math.min(1, fall / 0.45) ** 2) : 0;
      const e2 = how === 3 ? (this.calm ? 1 : Math.max(0, (fall - 0.45) / 0.55) ** 2) : 0;
      const side = (body.id & 1) ? 1 : -1;
      const tilt = how === 1 ? (Math.PI / 2 - 0.08) * e : how === 3 ? (-Math.PI / 2 + 0.08) * e2 : how === 2 ? -0.1 * e : (-Math.PI / 2 + 0.08) * e;
      const roll = how === 2 ? side * (Math.PI / 2 - 0.12) * e : 0;
      lay.setFromEuler(new THREE.Euler(tilt, yaw, roll, 'YXZ'));
      // rozkład spłaszcza ciało w grubości: u leżącego na boku w osi barków, u reszty przód–tył
      const flat = 1 - age * 0.55;
      sc.set(1.05 * FIG * (how === 2 ? flat : 1), 1.05 * FIG, 1.05 * FIG * (how === 2 ? 1 : flat));
      let sink = how === 3 ? -0.21 * 1.05 * FIG * e1 * (1 - e2) : 0;
      // spalane przez Maga Płomienia (cremation.ts): płonie, kurczy się i zapada, po PYRE_TICKS znika z symulacji
      // spalane przez Maga Płomienia: płonie całe (ogień w trzech miejscach wzdłuż ciała), czernieje i pod koniec
      // zapada się w popiół (w ziemię), zamiast się zmniejszać (Michał 30.10.2026)
      if (body.pyre !== undefined) {
        const pk = Math.max(0, Math.min(1, (g.tick + alpha - body.pyre) / PYRE_TICKS));
        const ash = Math.max(0, (pk - 0.55) / 0.45);
        sink -= 0.16 * ash * ash;
        sc.y *= 1 - 0.5 * ash;                       // spłaszcza się w popiół
        if (!this.calm && pk < 0.95) {
          const ax = Math.sin(yaw) * 0.16, az = Math.cos(yaw) * 0.16;
          for (let k = -1; k <= 1; k++) this.spells.burning(this.pyreAt.set(fx - width / 2 + ax * k, y + 0.06, fy - height / 2 + az * k), body.id * 3 + k + 1);
        }
      }
      m.compose(new THREE.Vector3(fx - width / 2, y + sink + (0.06 - age * 0.04) * (how === 3 ? e2 : e), fy - height / 2), lay, sc);
      const legs = how === 3 ? -1.45 * e1 * (1 - e2) : undefined;
      const team = body.owner >= 0 && !g.players[body.owner] ? BANDIT_COLOR : TEAM_COLORS[g.players[body.owner]?.team ?? 0] ?? 0x888888;
      const rot = new THREE.Color(team).lerp(new THREE.Color(0x3b3226), 0.3 + age * 0.6).getHex();
      // każdy leży w swoim stroju: chłop, łucznik, strażnik miejski albo włócznik
      const ud = body.kind >= 0 ? UNITS[body.kind] : undefined;
      // każde ciało rysuje się tylko jednym modelem (wcześniej chłop, strażnik i zbrojny leżeli dodatkowo jako włócznik)
      if (body.kind < 0) { if (pc < MAX_UNITS) this.peasantBodies.set(pc++, m, 0.3, false, rot, body.id, undefined, -0.5, false, legs); }
      else if (ud?.sapper || ud?.ladderman) { if (sc2 < 256) this.sapperBodies.set(sc2++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); }
      else if (ud?.bandit) { if (bc < 256) this.banditBodies.set(bc++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); }
      else if (ud?.guard) { if (gc < 256) this.guardBodies.set(gc++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); }
      else if (ud?.id === 'manatarms') { if (mc < 256) this.manAtArmsBodies.set(mc++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); }
      else if (ud?.magic) { if (ud.magic === 'fire') { if (mf < 160) this.mageBodiesFire.set(mf++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); } else if (mw < 160) this.mageBodiesWater.set(mw++, m, 0.3, false, team, body.id, undefined, -0.5, false, legs); }
      else if (ud?.range) { if (ac < 512) this.archerBodies.set(ac++, m, 0.3, false, rot, body.id, undefined, -0.5, false, legs); }
      else this.bodies.set(sp++, m, 0.3, false, rot, body.id, undefined, -0.5, false, legs);
      // poległy chorąży: drzewce przewraca się na bok razem z nim i proporzec leży na ziemi obok ciała
      if (this.fallenBearers.has(body.id) && g.players[body.owner]) {
        const k = this.calm ? 1 : ease;
        const fallM = new THREE.Matrix4().compose(new THREE.Vector3(fx - width / 2, y, fy - height / 2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + 0.5, 1.45 * k, 'YXZ')), new THREE.Vector3().setScalar(1.08 * FIG));
        this.standards.add(fallM, body.owner, team, this.crestOf(body.owner));
      }
      // krew wypływa dopiero po upadku i rozlewa się przez ok. 20 s
      const spread = this.calm ? 1 : Math.max(0, Math.min(1, (g.tick + alpha - body.at) / (TICKS_PER_SECOND * 20) - 0.03));
      // plama kładzie się na terenie: nachylenie z wysokości dookoła, a środek odrobinę nad najwyższym punktem pod nią
      // (na pomoście wieży albo koronie muru leży płasko)
      const sb = 0.25, onGround = Math.abs(y - view.heightAt(fx, fy)) < 0.05;
      const hx = onGround ? (view.heightAt(fx + sb, fy) - view.heightAt(fx - sb, fy)) / (2 * sb) : 0, hz = onGround ? (view.heightAt(fx, fy + sb) - view.heightAt(fx, fy - sb)) / (2 * sb) : 0;
      if (fall >= 1 || this.calm) this.arrows.body(body.id, fx - width / 2, y + sink, fy - height / 2, yaw); // strzały, które w nim utkwiły
      this.stains.add(body.id, fx - width / 2, y + 0.02, fy - height / 2, spread, age, [hx, hz]);
      c++;
    }
    this.bodies.finish(sp);
    this.peasantBodies.finish(pc);
    this.archerBodies.finish(ac);
    this.mageBodiesFire.finish(mf);
    this.mageBodiesWater.finish(mw);
    this.guardBodies.finish(gc);
    this.manAtArmsBodies.finish(mc);
    this.sapperBodies.finish(sc2);
    this.banditBodies.finish(bc);
    // proporce żywych chorążych (wyżej) i przewrócone przy poległych: wszystko naraz
    this.standards.finish();
    // ciała już nie ma (pochowane albo rozłożone): zapominamy, że był chorążym
    if (this.fallenBearers.size && g.tick % 60 === 0) {
      const dead = new Set(g.corpses.map((cc) => cc.id));
      for (const id of this.fallenBearers) if (!dead.has(id)) this.fallenBearers.delete(id);
    }
    this.stains.end();
    this.arrows.drawStuck((id) => { const b = bById.get(id); return !!b && !b.ruined; });
    this.rings.count = rings;
    touch(this.rings);
    this.ringsBack.count = rings;
    touch(this.ringsBack);
    // lekki puls, żeby wzrok od razu łapał zaznaczonych
    (this.rings.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.sin(this.time * 4) * 0.15;
  }

  /**
   * Siennik dla śpiącego: [głowa x, y, z, stopy x, y, z] w świecie. W chacie (i w twierdzy) dwa rzędy po cztery
   * na podłodze wnętrza, głowami do ścian; pod gołym niebem na polu, na którym leży, w stałym kierunku.
   */
  /** Zamki: środek działki (pola) i wysokość, na której stoi model — po dziedzińcu i salach chodzi się po posadzce */
  private keepFloors = new Map<number, [number, number, number]>();
  /** Właściciel zamku (klucz: x * 1000 + y środka) — barwy domowników i wartowników */
  private keepOwner = new Map<number, number>();
  /** Panowie zamków (osobna siatka: korona, gronostaj, płaszcz) */
  private kings!: Figures;
  private lifeObj = new THREE.Object3D();
  /**
   * Domownicy zamku (ozdoba, poza symulacją): pan na tronie, który co jakiś czas przechadza się po sali, kucharz
   * przy palenisku, dwoje służby noszącej jedzenie z kuchni do sali i dwóch więźniów w celach. Rysowani tą samą
   * siatką co chłopi (dalsze miejsca w puli), więc nie kosztują osobnych wywołań rysowania.
   */
  /** Saperzy (model z tools/models/sapper.py): rąbią ruinę kilofem z puli chłopów, niosą łup oburącz, w drodze kilof na plecach */
  private drawSappers(loadUsed: Map<number, number>): void {
    let k = 0;
    for (const d of this.sapperDraw) {
      if (k >= MAX_UNITS) break;
      const sz = this.sappersFig.sizeOf(d.id, d.team);
      let armR = -0.5, armL = -0.5, grip = 0;
      const carrying = d.carry >= 0;
      if (carrying) [armR, armL] = carryArms(false, d.swing);
      else if (d.work && !this.calm) {
        // zamach kilofem znad głowy, cios, odbicie — jak kopacz przy złożu
        const ph = (this.time * 0.95 + (d.id % 7) * 0.21) % 1;
        const ease = (x: number): number => x * x * (3 - 2 * x);
        const high = 2.75;
        armR = ph < 0.55 ? -0.35 - ease(ph / 0.55) * high : ph < 0.67 ? -0.35 - high + ((ph - 0.55) / 0.12) ** 2 * (high + 0.15) : -0.2;
        armL = armR; grip = TWO_HAND;
        if (ph > 0.62 && ph < 0.68) this.sfxAt('plank', d.m.elements[12]!, d.m.elements[14]!, `sap${d.id}`, 0.6, 0.7);
      }
      const posed = carrying || (d.work && !this.calm);
      this.sappersFig.set(k, d.m, d.swing, false, d.team, d.id, posed ? armR : undefined, armL, carrying, undefined, grip);
      this.armS.copy(d.m).scale(this.armV.setScalar(sz));
      if (d.work && !carrying) {
        this.armM.makeRotationFromEuler(this.gripE.set(armR, 0, -TWO_HAND)).setPosition(0.135, 0.45, 0);
        this.picks.setMatrixAt(k, this.armM.premultiply(this.armS));
      } else this.backPicks.setMatrixAt(k, this.armS);
      const load = carrying ? this.loads.get(d.carry) : undefined;
      if (load) {
        const j = loadUsed.get(d.carry) ?? 0;
        loadUsed.set(d.carry, j + 1);
        load.setMatrixAt(j, this.armS.copy(d.m).scale(this.armV.setScalar(sz)));
      }
      k++;
    }
    this.sappersFig.finish(k);
  }

  private castleFolk(g: GameState, k0: number): number {
    let k = k0;
    const { width, height } = g.map;
    const hour = clockAt(g.tick).hour, day = hour >= 6 && hour < 21.5;
    const t = this.lifeObj, T = this.time;
    let kings = 0;
    const put = (kx: number, ky: number, base: number, x: number, y: number, z: number, yaw: number, swing: number, tunic: number, id: number, opt: { up?: boolean; work?: number; workL?: number; sit?: number; bow?: number; king?: boolean } = {}): void => {
      if (opt.king) {
        if (kings >= 32) return;
        t.position.set(kx + x - width / 2, base + y, ky + z - height / 2);
        t.rotation.set(0, yaw, 0, 'YXZ');
        t.scale.setScalar(FIG * 1.05);
        t.updateMatrix();
        this.kings.set(kings++, t.matrix, swing, false, tunic, id, opt.work, opt.workL ?? -0.5, false, opt.sit);
        return;
      }
      if (k >= MAX_UNITS) return;
      t.position.set(kx + x - width / 2, base + y, ky + z - height / 2);
      t.rotation.set(opt.bow ?? 0, yaw, 0, 'YXZ');
      t.scale.setScalar(FIG);
      t.updateMatrix();
      this.figures.set(k, t.matrix, swing, !!opt.up, tunic, id, opt.work, opt.workL ?? -0.5, false, opt.sit);
      k++;
    };
    // droga po łamanej: położenie i kierunek dla ułamka f (0..1) całej trasy
    const along = (pts: [number, number][], f: number): [number, number, number] => {
      const seg: number[] = []; let L = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]); seg.push(d); L += d; }
      let r = Math.max(0, Math.min(1, f)) * L;
      for (let i = 0; i < seg.length; i++) {
        if (r <= seg[i]! || i === seg.length - 1) {
          const a = pts[i]!, b = pts[i + 1]!, q = seg[i]! ? Math.min(1, r / seg[i]!) : 0;
          return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, Math.atan2(b[0] - a[0], b[1] - a[1])];
        }
        r -= seg[i]!;
      }
      return [pts[0]![0], pts[0]![1], 0];
    };
    for (const [, [kx, ky, base]] of this.keepFloors) {
      const owner = this.keepOwner.get(kx * 1000 + ky) ?? 0;
      const team = g.players[owner]?.team ?? 0;
      const col = TEAM_COLORS[team] ?? 0x888888;
      const foe = TEAM_COLORS[team === 0 ? 1 : 0] ?? 0x666666;
      const seed = Math.round(kx * 7 + ky * 13);
      const G = CASTLE.floorY;
      // pan: za dnia na tronie; co minutę wstaje i obchodzi salę (ok. 15 s), nocą śpi w komnacie (niewidoczny);
      // co kilka minut wychodzi drzwiami sali na dziedziniec, obchodzi go dookoła studni, chwilę przy niej stoi i wraca
      const yard = day && !this.calm ? this.lordYard(T + seed * 1.7) : null;
      if (yard) {
        const [x, z, yaw, moving] = yard;
        put(kx, ky, base, x, z < -3.5 ? G + 0.12 : G, z, yaw, moving ? Math.sin(T * 3.6) * 0.32 : 0, col, 777000 + seed, { king: true });
        if (z > -1.5) this.lordPos.set(owner, { x: kx + x, y: ky + z, t: T });
      } else if (day) {
        const per = 60, ph = ((T + seed) % per) / per;
        if (ph < 0.75) put(kx, ky, base, 0, CASTLE.seatY, CASTLE.throneZ + 0.12, 0, 0, col, 777000 + seed, { sit: -1.45, work: -0.3 + Math.sin(T * 0.7) * 0.08, workL: -0.3, king: true });
        else {
          const f = (ph - 0.75) / 0.25;
          const tour: [number, number][] = [[0, CASTLE.throneZ + 0.45], [0.9, -3.0], [0.6, -2.0], [-0.7, -2.0], [-0.9, -3.0], [0, CASTLE.throneZ + 0.45]];
          const [x, z, yaw] = along(tour, f);
          put(kx, ky, base, x, z < -3.5 ? G + 0.12 : G, z, yaw, Math.sin(T * 4) * 0.35, col, 777000 + seed, { king: true });
        }
      }
      // kucharz: przy palenisku miesza w kotle, co jakiś czas idzie do stołu kroić
      if (day || hour >= 4.5) {
        const per = 24, ph = ((T + seed * 3) % per) / per;
        // stół stoi między paleniskiem a drzwiami: do niego obchodzi się bokiem
        const hearth: [number, number] = [-3.5, -3.82], table: [number, number] = [-3.5, -2.95];
        const round: [number, number][] = [hearth, [-2.95, -3.82], [-2.95, -2.95], table];
        if (ph < 0.55) put(kx, ky, base, hearth[0], G, hearth[1], Math.PI, 0, 0xd9ceb0, 778000 + seed, { work: -1.1 + Math.sin(T * 4) * 0.35, workL: -0.9 });
        else if (ph < 0.62 || ph > 0.93) {
          const f = ph < 0.62 ? (ph - 0.55) / 0.07 : 1 - (ph - 0.93) / 0.07;
          const [x, z, yaw] = along(round, f);
          put(kx, ky, base, x, G, z, ph < 0.62 ? yaw : yaw + Math.PI, Math.sin(T * 6) * 0.45, 0xd9ceb0, 778000 + seed);
        } else put(kx, ky, base, table[0], G, table[1], Math.PI, 0, 0xd9ceb0, 778000 + seed, { work: -0.95 + Math.max(0, Math.sin(T * 7)) * -0.5, workL: -0.8 });
      }
      // służba: z kuchni przez drzwi do sali i z powrotem; w stronę sali niesie jedzenie oburącz
      if (day) {
        const path: [number, number][] = [[-3.0, -2.95], [-2.85, -3.9], [-2.2, -4.0], [-1.6, -4.0], [-0.95, -3.35]];
        for (let s2 = 0; s2 < 2; s2++) {
          const per = 30, ph = ((T + seed + s2 * 15) % per) / per;
          let x: number, z: number, yaw: number, up = false, sw = Math.sin(T * 5.5 + s2) * 0.5;
          if (ph < 0.4) { [x, z, yaw] = along(path, ph / 0.4); up = true; }
          else if (ph < 0.5) { [x, z] = path[path.length - 1]!; yaw = Math.PI / 2 + 0.6; sw = 0; up = ph < 0.46; }
          else if (ph < 0.9) { [x, z, yaw] = along([...path].reverse(), (ph - 0.5) / 0.4); }
          else { [x, z] = path[0]!; yaw = Math.PI; sw = 0; }
          put(kx, ky, base, x + s2 * 0.18, G, z + s2 * 0.12, yaw, sw, s2 ? 0x8a7350 : 0x6a5a40, 779000 + seed + s2, { up });
        }
      }
      // więźniowie w celach: siedzą na słomie ze spuszczoną głową, w barwach wroga
      for (const [cz, id] of [[2.1, 780000], [4.1, 780001]] as const) {
        const rest = Math.sin(T * 0.3 + cz) * 0.05;
        put(kx, ky, base, -4.25, G + 0.02, cz, Math.PI / 2, 0, foe, id + seed, { sit: -1.45, bow: 0.35 + rest, work: -0.25, workL: -0.25 });
      }
    }
    this.kings.finish(kings);
    return k;
  }
  /**
   * Pory roku na ekranie: śnieg (narasta i topnieje przez ok. pół minuty), szron o świcie, jesienne liście, gołe drzewa.
   * Materiały nowych rzeczy (budynki, drogi) łatamy co kilka sekund — raz na materiał.
   */
  private snowNow = -1;
  /** Test: wymuszona ilość śniegu 0..1 (−1 = z pogody) */
  snowForce = -1;
  private trails: SnowTrails | null = null;
  private trailSeen = 0;
  /** Pojedyncze odciski butów na śniegu przy kamerze (footprints.ts) */
  private prints: Footprints | null = null;
  /** Stopy idących z ostatniej klatki: [x, y w polach mapy, wysokość stóp w świecie] — tam, gdzie postać stoi na ekranie */
  private feet = new Map<number, [number, number, number]>();
  /** Ciągnięte pnie i dwukółki z ostatniej klatki: [x, y, wysokość ziemi, rodzaj 0 = pień, 1 = wóz] — bruzdy w śniegu */
  private drags = new Map<number, [number, number, number, number]>();
  /** Ślady na śniegu: ludzie, żołnierze i wilki wydeptują ścieżki, które powoli się zasypują */
  private updateTrails(g: GameState, dt: number): void {
    const { width: w, height: h } = g.map;
    if (!this.trails || this.trailSeen !== w * 100000 + h) { this.trails?.dispose(); this.trails = new SnowTrails(w, h); this.trailSeen = w * 100000 + h; }
    const t = this.trails;
    if (this.snowNow > 0.05) {
      const alive = new Set<number>();
      for (const u of g.units) if (u.path.length > 0) { t.step(u.id, u.px / FP, u.py / FP); alive.add(u.id); }
      for (const s of g.soldiers) if (s.path.length > 0) { t.step(s.id, s.px / FP, s.py / FP); alive.add(s.id); }
      for (const v of g.wolves) { t.step(v.id, v.px / FP, v.py / FP); alive.add(v.id); }
      t.forget(alive);
    }
    // śnieg zasypuje ślady: pojedyncze kroki po ok. 45 s, wydeptana ścieżka po ok. 2 min; w opadzie szybciej
    t.update(dt, 2 + this.rain * 8);
    // odciski butów: chłopi i żołnierze w ruchu (na wieży nikt nie chodzi po śniegu), w pobliżu kamery
    const view = this.view;
    if (view && (this.snowNow > 0.01 || this.prints)) {
      this.prints ??= new Footprints(this.scene);
      const walkers: { id: number; x: number; y: number; h: number }[] = [];
      if (this.snowNow >= 0.45) for (const [id, f] of this.feet) walkers.push({ id, x: f[0], y: f[1], h: f[2] });
      const drags: { id: number; x: number; y: number; h: number; kind: number }[] = [];
      if (this.snowNow >= 0.45) for (const [id, f] of this.drags) drags.push({ id, x: f[0], y: f[1], h: f[2], kind: f[3] });
      this.feet.clear(); this.drags.clear();
      const c = this.cam.camera.position;
      // wilki: łapy na śniegu tam, gdzie wilk stoi na ekranie (render/wolves.ts)
      const paws: { id: number; x: number; y: number; h: number }[] = [];
      if (this.snowNow >= 0.45) for (const v of g.wolves) { const p = this.wolfPos.get(v.id); if (p) paws.push({ id: v.id, x: p.x + w / 2, y: p.z + h / 2, h: p.y }); }
      this.prints.sync(this.snowNow, this.calm ? 0 : dt, this.rain, walkers, w, h, { x: c.x + w / 2, y: c.z + h / 2 }, drags, paws);
    }
  }
  private shiftSeen = 0;
  private seasonScan = 0;
  private updateSeason(dt: number): void {
    const g = this.state;
    if (!g) return;
    if ((this.seasonScan -= dt) <= 0) { this.seasonScan = 3; for (const m of applySeason(this.scene)) this.pre.watch(m); }
    const w = weatherOf(g, this.rain);
    this.breath?.setTemp(w.temp);
    const p = yearPos(g.tick, g.seasonShift ?? 0);
    const sm = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // liście: żółkną od początku jesieni, opadają pod jej koniec, wiosną odrastają
    const bare = p < 0.2 ? 1 - sm(0.03, 0.13, p) : sm(0.7, 0.78, p);
    const autumn = p < 0.5 ? 0 : sm(0.52, 0.64, p);
    // śnieg: przy mrozie leży, przy odwilży topnieje; po wczytaniu mapy od razu taki, jaki powinien być
    const want = Math.max(0, Math.min(1, (0.5 - w.temp) / 4)) * (w.temp > 0 ? 1 - this.rain : 1); // leży przy mrozie, deszcz w odwilż go spłukuje
    // przeskok pory roku (menu dewelopera): śnieg od razu taki, jaki powinien być
    if ((g.seasonShift ?? 0) !== this.shiftSeen) { this.shiftSeen = g.seasonShift ?? 0; this.snowNow = -1; }
    this.snowNow = this.snowNow < 0 || this.calm ? want : this.snowNow + (want - this.snowNow) * Math.min(1, dt / 30);
    if (this.snowForce >= 0) this.snowNow = this.snowForce;
    if (!Number.isFinite(this.snowNow)) { console.warn('[pory roku] śnieg NaN', { dt, rain: this.rain, temp: w.temp }); this.snowNow = -1; } // raz zepsuta liczba zostałaby na zawsze i czerniła cały obraz
    const hour = clockAt(g.tick).hour;
    const frost = w.temp < 3 && hour > 3.5 && hour < 9.5 ? Math.min(1, (3 - w.temp) / 5) * (1 - Math.abs(hour - 6.3) / 3.2) : 0;
    // każda wartość trafia do shaderów wszystkich materiałów: NaN dałby błędny kolor wszędzie (czyszczenie przed
    // poświatą zamienia go na czerń — czarny ekran, świecą tylko płomienie), więc tylko liczby 0..1
    const ok = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
    SEASON_U.uSnow.value = ok(this.snowNow);
    if (Number.isFinite(dt)) this.updateTrails(g, dt);
    SEASON_U.uFrost.value = ok(frost);
    SEASON_U.uAutumn.value = ok(autumn);
    SEASON_U.uBare.value = ok(bare);
    // wiosna od pierwszych liści do początku lata; lato najmocniej w drugiej połowie (susza)
    SEASON_U.uSpring.value = ok(sm(0.04, 0.1, p) * (1 - sm(0.2, 0.28, p)));
    SEASON_U.uSummer.value = ok(p < 0.6 ? sm(0.27, 0.36, p) * (1 - sm(0.5, 0.56, p)) : 0);
    // w sztolni pod górą nie ma pór roku: śnieg, szron i jesień zostają na powierzchni (materiały są wspólne z
    // budynkami na mapie, ale powierzchni stąd nie widać, więc na czas spaceru w kopalni zerujemy je wszystkie)
    if (this.inMine) { SEASON_U.uSnow.value = 0; SEASON_U.uFrost.value = 0; SEASON_U.uAutumn.value = 0; SEASON_U.uBare.value = 0; SEASON_U.uSpring.value = 0; SEASON_U.uSummer.value = 0; }
  }

  /** Gdzie pan zamku spaceruje po dziedzińcu (pola mapy; ostatnia sekunda), do odzywek ludzi i straży */
  private lordPos = new Map<number, { x: number; y: number; t: number }>();
  lordAt(owner: number): { x: number; y: number } | null {
    const p = this.lordPos.get(owner);
    return p && this.time - p.t < 1 ? p : null;
  }
  /**
   * Spacer pana po dziedzińcu (układ zamku: środek = 0,0, pole = 1, tył -z): od tronu przez drzwi sali, wzdłuż
   * zachodniej strony, za studnią (przy niej przystaje i patrzy na nią), wschodnią stroną z powrotem do sali.
   * Co 150 s, trwa ok. 40 s. Zwraca [x, z, kierunek, czy idzie] albo null, gdy pan siedzi w sali.
   */
  private lordYard(t: number): [number, number, number, boolean] | null {
    const per = 150, len = 40, ph = t % per;
    if (ph > len) return null;
    const route: [number, number][] = [[0, CASTLE.throneZ + 0.45], [0, -2.4], [0, -1.5], [0, -0.6], [-2, 0], [-2, 1.6], [-1, 3.0], [0, 3.05],
      [1, 3.0], [2, 1.6], [2, 0], [0, -0.6], [0, -1.5], [0, -2.4], [0, CASTLE.throneZ + 0.45]];
    const stopAt = 7, stop = 6; // przy studni (punkt 7 trasy) stoi 6 s
    const seg: number[] = []; let L = 0;
    for (let i = 1; i < route.length; i++) { const d = Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]); seg.push(d); L += d; }
    let before = 0; for (let i = 0; i < stopAt; i++) before += seg[i]!;
    const speed = L / (len - stop);
    let r: number;
    if (ph * speed < before) r = ph * speed;
    else if (ph < before / speed + stop) return [0, 3.05, Math.PI, false]; // przodem do studni (studnia na z = 2)
    else r = (ph - stop) * speed;
    for (let i = 0; i < seg.length; i++) {
      if (r <= seg[i]! || i === seg.length - 1) {
        const a = route[i]!, b = route[i + 1]!, q = seg[i]! ? Math.min(1, r / seg[i]!) : 0;
        return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, Math.atan2(b[0] - a[0], b[1] - a[1]), true];
      }
      r -= seg[i]!;
    }
    return null;
  }
  /** Wysokość, na której stoi człowiek: teren, a w zamku posadzka dziedzińca i sal (most z bramy łagodnie wznosi się do niej) */
  /** sim: pole człowieka w symulacji (o wejściu na mur decyduje ono, a nie wygładzona pozycja obrazka); -1 = z pozycji, -2 = nigdy na mur */
  /** Mag w osadzie: postać zakonu; przy czarze ręce w górze z kulą w dłoni, twarzą do celu — brat Źródła leje strugę wody
   *  na chorego (albo w drzwi chaty), brat Płomienia ma ogień w dłoniach i dymi tam, gdzie wypala zarazę albo pali zwłoki */
  private drawMage(g: GameState, u: GameState['units'][number], t: THREE.Object3D, kind: 'water' | 'hut' | 'fire', swing: number, heading: number, view: TerrainView, jobs: Map<number, GameState['buildings'][number]>): void {
    const fig = kind === 'fire' ? this.magesFireFig : this.magesWaterFig;
    const casting = u.phase === Phase.Healing;
    const team = TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888;
    // uzdrowiciel bez roboty czeka w swojej siedzibie (stojąc przed nią wyglądał jak zdublowany mag bojowy);
    // wychodzi dopiero do chorego, do zwłok albo do zarażonej chaty
    if (u.phase === Phase.Vigil && !u.path.length && kind !== 'hut' && !u.foe) return;
    // obrona: wróg blisko — zwrócony do niego, ręce w górze, a przy każdym czarze (u.zap) leci kula ognia albo wody
    const foe = u.foe ? g.soldiers.find((s) => s.id === u.foe) : undefined;
    if (foe && !casting) {
      const { width: W, height: H } = g.map;
      const fx = foe.px / FP - W / 2, fz = foe.py / FP - H / 2;
      const yaw = Math.atan2(fx - t.position.x, fz - t.position.z);
      t.rotation.set(0, yaw, 0); t.updateMatrix(); this.facing.set(u.id, yaw);
      fig.set(0, t.matrix, 0, true, team, u.id);
      if (u.zap !== undefined && this.zapSeen.get(u.id) !== u.zap) {
        this.zapSeen.set(u.id, u.zap);
        if (!this.calm && g.tick - u.zap < 10) this.spells.cast(this.armV.set(t.position.x + Math.sin(yaw) * 0.2, t.position.y + 0.5, t.position.z + Math.cos(yaw) * 0.2), this.mouth.set(fx, view.heightAt(foe.px / FP, foe.py / FP) + 0.4, fz), kind === 'fire');
      }
      return;
    }
    if (!casting) { fig.set(0, t.matrix, swing, false, team, u.id); return; }
    const { width, height } = g.map;
    // cel czaru: chata (drzwi), leżący chory albo zwłoki
    let tx = t.position.x + Math.sin(heading), tz = t.position.z + Math.cos(heading);
    const goal = u.batches === 2 ? g.corpses.find((c) => c.id === u.target) : u.batches === 3 ? jobs.get(u.target) : g.units.find((o) => o.id === u.target);
    let house: GameState['buildings'][number] | undefined = u.batches === 3 ? (goal as GameState['buildings'][number] | undefined) : undefined;
    if (goal && u.batches !== 3) {
      const o = goal as { px: number; py: number; home?: number; phase?: Phase };
      if (o.home && o.phase === Phase.Sleeping) house = jobs.get(o.home);
      if (!house) { tx = o.px / FP - width / 2; tz = o.py / FP - height / 2; }
    }
    if (house) { const fp = footprint(BUILDINGS[house.type]!, house.rot); tx = house.x + fp.w / 2 - width / 2; tz = house.y + fp.h / 2 - height / 2; }
    const yaw = Math.atan2(tx - t.position.x, tz - t.position.z);
    t.rotation.set(0, yaw, 0);
    t.updateMatrix();
    this.facing.set(u.id, yaw);
    fig.set(0, t.matrix, 0, true, team, u.id);
    if (this.calm) return;
    const dx = Math.sin(yaw), dz = Math.cos(yaw), y0 = t.position.y + 0.58 * FIG;
    if (kind === 'fire') {
      // ogień w obu dłoniach przed twarzą, a u celu dym (spalane posłania albo zwłoki)
      this.eye.identity();
      for (const s of [-1, 1]) this.pushHandFlameAt(this.eye, this.armV.set(t.position.x + dx * 0.16 + dz * 0.07 * s, y0, t.position.z + dz * 0.16 - dx * 0.07 * s));
      if ((Math.floor(this.time * 6) + u.id) % 3 === 0) this.fireFx.steam(tx, this.standY(view, tx + width / 2, tz + height / 2) + 0.3, tz, 2);
    } else {
      // struga wody z dłoni w stronę chorego
      this.mouth.set(t.position.x + dx * 0.18, y0, t.position.z + dz * 0.18);
      this.fireFx.pour(this.mouth, this.armV.set(dx, -0.35, dz).normalize(), 0.55 + Math.sin(this.time * 7 + u.id) * 0.2);
    }
  }

  /** Znaki zarazy: nad chatą, w której ktoś leży w gorączce, i nad chorym leżącym na słomie pod gołym niebem */
  private drawSickIcons(g: GameState, view: TerrainView): void {
    const { width, height } = g.map;
    let k = 0;
    const seen = new Set<number>();
    const put = (x: number, y: number, z: number, sc: number): void => {
      let s = this.sickIcons[k];
      if (!s) { s = new THREE.Sprite(sickMaterial()); s.renderOrder = 5; this.scene.add(s); this.sickIcons.push(s); }
      const dist = this.cam.camera.position.distanceTo(this.armV.set(x, y, z));
      const size = Math.max(sc, dist * 0.03) * (1 + Math.sin(this.time * 3 + k) * 0.05);
      s.scale.setScalar(size);
      s.position.set(x, y + size * 0.5, z);
      s.visible = true;
      k++;
    };
    for (const u of g.units) {
      if (k >= 200) break;
      if (!u.sick || g.tick < (u.sickFrom ?? 0) || u.phase !== Phase.Sleeping) continue;
      if (u.home) {
        if (seen.has(u.home)) continue;
        seen.add(u.home);
        const b = g.buildings.find((x) => x.id === u.home);
        if (!b) continue;
        const fp = footprint(BUILDINGS[b.type]!, b.rot), cx = b.x + fp.w / 2, cy = b.y + fp.h / 2;
        put(cx - width / 2, this.standY(view, cx, cy) + 1.55, cy - height / 2, 0.42);
      } else {
        const x = u.px / FP, y = u.py / FP;
        put(x - width / 2, this.standY(view, x, y) + 0.4, y - height / 2, 0.3);
      }
    }
    for (let i = k; i < this.sickIcons.length; i++) this.sickIcons[i]!.visible = false;
  }

  /** Wejścia na pomosty wież: pole przed drabiną/drzwiami → [kierunek do wieży x, y, wysokość pomostu] (co klatkę) */
  private towerFeet = new Map<number, [number, number, number]>();
  private towerFeetAt = -1;
  private feetOfTowers(g: GameState): Map<number, [number, number, number]> {
    if (this.towerFeetAt === this.time) return this.towerFeet;
    this.towerFeetAt = this.time;
    this.towerFeet.clear();
    const W = g.map.width;
    for (const b of g.buildings) {
      const id = BUILDINGS[b.type]!.id;
      if (!isTower(id) || b.build || b.ruined) continue;
      const [out, inner] = towerEntry(g, b);
      if (out < 0 || (g.walls[out]! & 16)) continue;
      this.towerFeet.set(out, [(inner % W) - (out % W), Math.floor(inner / W) - Math.floor(out / W), TOWER_TOP[id] ?? WATCH_TOWER_TOP]);
    }
    return this.towerFeet;
  }

  /** Wysokość pomostu wieży, na której polu stoi człowiek (undefined = to nie wieża, tylko np. korona muru) */
  private towerTopAt(g: GameState, t: number): number | undefined {
    const b = buildingById(g, g.occupancy[t]);
    return b && isTower(BUILDINGS[b.type]!.id) ? TOWER_TOP[BUILDINGS[b.type]!.id] ?? WATCH_TOWER_TOP : undefined;
  }

  private standY(view: TerrainView, x: number, y: number, sim = -1): number {
    const k = this.keepAt(x, y);
    let h = view.heightAt(x, y);
    // na drodze stopy stoją na nawierzchni, nie w niej: ścieżka, bruk i dyle są trochę nad ziemią
    const g = this.state;
    // także tuż przed murami zamku (pas do pola od murów, w którym działa keepAt): strażnicy przy bramie i chłopi
    // na bruku pod murem stoją na nawierzchni, a nie po kostki w niej
    const outsideKeep = !k || Math.abs(k[1]) >= KEEP_HALF || Math.abs(k[2]) >= KEEP_HALF;
    if (g && outsideKeep) {
      // wejście na drogę krótkim krokiem w górę (przy samym brzegu pola), nie skokiem
      const W = g.map.width, H = g.map.height;
      const top = (tx: number, ty: number): number => (tx >= 0 && ty >= 0 && tx < W && ty < H ? ROAD_TOP[g.roads[ty * W + tx]!] ?? 0 : 0);
      const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const ease = (t: number): number => { const u = Math.max(0, Math.min(1, (t - 0.42) / 0.16)); return u * u * (3 - 2 * u); };
      const ax = ease(fx - x0), ay = ease(fy - y0);
      const a = top(x0, y0) + (top(x0 + 1, y0) - top(x0, y0)) * ax, b = top(x0, y0 + 1) + (top(x0 + 1, y0 + 1) - top(x0, y0 + 1)) * ax;
      h += a + (b - a) * ay;
    }
    // sim = -2: dzieci, żony i zwierzęta nigdy nie wchodzą na mur (stoją u jego stóp)
    if (!k && g && sim !== -2) {
      // korona muru kamiennego: chodzi się wysoko; u stóp drabiny wspina się na wysokość muru
      // pole z symulacji (gdy znane): wygładzona i rozsuwana w tłumie pozycja obrazka potrafi na chwilę wejść na pole muru
      // u jego stóp — wtedy człowiek podskakiwał na koronę i spadał z powrotem
      const W = g.map.width, t = sim >= 0 ? sim : Math.floor(y) * W + Math.floor(x), tx = t % W, ty = (t - tx) / W;
      if (tx >= 0 && ty >= 0 && tx < W && ty < g.map.height) {
        // pomost wieży (Michał 28.10.2026: wchodzi się na wieżę jak na teren) albo korona muru
        if ((g.walls[t]! & 16) && g.gates[t]) { const tt = this.towerTopAt(g, t); return h + (tt ?? STONE_WALL_TOP + this.walls.levelDelta(view, t, W)); }
        // przed drabiną albo drzwiami wieży: wspina się na wysokość pomostu
        const tf = this.feetOfTowers(g).get(t);
        if (tf) {
          const off = (x - tx - 0.5) * tf[0] + (y - ty - 0.5) * tf[1];
          if (off > 0) return h + tf[2] * Math.min(1, off * 2);
        }
        const lf = this.walls.ladderFeet.get(t);
        if (lf) {
          const off = (x - tx - 0.5) * lf[0] + (y - ty - 0.5) * lf[1];
          if (off > 0) return h + STONE_WALL_TOP * Math.min(1, off * 2);
        }
      }
    }
    if (!k) {
      const wb = this.walkableAt(x, y);
      if (wb && wb[4].open.some(([x0, x1, z0, z1]) => wb[1] >= x0 && wb[1] <= x1 && wb[2] >= z0 && wb[2] <= z1)) return Math.max(h, wb[3] + wb[4].floorY);
      return h;
    }
    const [, lx, lz, base] = k;
    // most zwodzony przed bramą: łagodnie z ziemi na posadzkę
    const gx = KEEP_GATE[0] - KEEP_HALF + 0.5, bridge0 = KEEP_HALF - 0.05, bridge1 = KEEP_HALF + 0.85;
    if (Math.abs(lx - gx) < 0.5 && lz > bridge0 && lz < bridge1 + 0.1) return Math.max(h, base + KEEP_FLOOR * Math.min(1, Math.max(0, (bridge1 - lz) / (bridge1 - bridge0))));
    if (Math.abs(lx) >= KEEP_HALF || Math.abs(lz) >= KEEP_HALF) return h;
    // pole zamku, na którym człowiek naprawdę stoi (symulacja): idący pod murem zamku nie wskakuje na chodnik muru,
    // gdy jego obrazek (wygładzony, rozsuwany w tłumie) na chwilę wejdzie na pole muru
    let cx = lx, cz = lz;
    if (sim >= 0 && g) {
      const W = g.map.width, ks = this.keepAt(sim % W + 0.5, Math.floor(sim / W) + 0.5);
      if (!ks || Math.abs(ks[1]) >= KEEP_HALF || Math.abs(ks[2]) >= KEEP_HALF) return h;
      cx = ks[1]; cz = ks[2];
    }
    const dx = Math.floor(cx + KEEP_HALF), dy = Math.floor(cz + KEEP_HALF), c = keepTile(dx, dy);
    if (sim === -2 && (c === '=' || c === 'S' || c === 'Q')) return h;
    if (c === '=' || c === 'Q') return base + KEEP_WALL; // Q: komnata królowej w donżonie, na wysokości chodnika
    if (c === 'S') {
      // schody: od dolnego końca biegu (dziedziniec) do korony muru
      let y0 = dy, y1 = dy;
      while (keepTile(dx, y0 - 1) === 'S') y0--;
      while (keepTile(dx, y1 + 1) === 'S') y1++;
      const f = (lz + KEEP_HALF - y0) / (y1 + 1 - y0);
      return base + KEEP_FLOOR + (KEEP_WALL - KEEP_FLOOR) * Math.min(1, Math.max(0, f));
    }
    if (!keepWalk(dx, dy)) return h;
    return Math.max(h, base + KEEP_FLOOR);
  }
  /** Zamek pod punktem albo tuż przy nim (pola mapy): [id, x i z względem środka zamku, wysokość modelu] albo null */
  private keepAt(x: number, y: number): [number, number, number, number] | null {
    for (const [id, [kx, ky, base]] of this.keepFloors) {
      const lx = x - kx, lz = y - ky;
      if (Math.abs(lx) > KEEP_HALF + 1 || Math.abs(lz) > KEEP_HALF + 1) continue;
      if (!this.buildingMeshes.has(id)) { this.keepFloors.delete(id); continue; }
      return [id, lx, lz, base];
    }
    return null;
  }
  /** Budynki z Blendera, do których wchodzi się spacerem (karczma): środek, obrót, wysokość, połowa wymiarów działki */
  private walkables = new Map<number, { cx: number; cy: number; rot: number; base: number; hw: number; hh: number; m: WalkModel }>();
  /** Budynek do chodzenia pod punktem: [id, x i z w układzie modelu (bez obrotu), wysokość] albo null */
  private walkableAt(x: number, y: number): [number, number, number, number, WalkModel] | null {
    for (const [id, w] of this.walkables) {
      const dx = x - w.cx, dz = y - w.cy;
      if (Math.abs(dx) > Math.max(w.hw, w.hh) + 0.5 || Math.abs(dz) > Math.max(w.hw, w.hh) + 0.5) continue;
      if (!this.buildingMeshes.has(id)) { this.walkables.delete(id); continue; }
      const th = (w.rot * Math.PI) / 2, c = Math.cos(th), s = Math.sin(th);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const half = w.rot % 2 ? [w.hh, w.hw] : [w.hw, w.hh];
      if (Math.abs(lx) > half[0]! || Math.abs(lz) > half[1]!) continue;
      return [id, lx, lz, w.base, w.m];
    }
    return null;
  }
  /** Zamek, przy którym (albo w którym) spaceruje gracz */
  private walkNear = 0;
  /** Budynki blisko spacerowicza: pokazane wnętrza i pełna wersja modelu */
  private walkInView = new Set<number>();
  /** Zamek, w którego sali stoi teraz spacerowicz (zdejmujemy wtedy bryłę donżonu i kładziemy sufit) */
  private walkHall = 0;

  private bedSpot(g: GameState, u: GameState['units'][number], view: TerrainView, sleepers: Map<number, number[]>): [number, number, number, number, number, number] | null {
    const width = g.map.width, height = g.map.height;
    const L = 0.48;
    if (u.home) {
      const floor = named(this.buildingMeshes.get(u.home), 'interior')?.children[0] as THREE.Mesh | undefined;
      if (!floor?.geometry) return null;
      floor.geometry.boundingBox ?? floor.geometry.computeBoundingBox();
      const bb = floor.geometry.boundingBox!;
      const idx = Math.max(0, (sleepers.get(u.home) ?? []).indexOf(u.id));
      let hx: number, fxl: number, z: number;
      // miejsca posłań zapisane w modelu (rudera narożna: dwa skrzydła, posłania pod dwiema ścianami)
      const bm = this.buildingMeshes.get(u.home)!;
      const fixed = bm.userData.beds as [number, number, number, number][] | undefined;
      if (fixed) {
        if (idx >= fixed.length) { this.bedHidden = true; return null; }
        const [ax, az, bx, bz] = fixed[idx]!;
        bm.updateWorldMatrix(true, false);
        const h = bm.localToWorld(this.bedA.set(ax, bb.max.y, az));
        const f = bm.localToWorld(this.bedB.set(bx, bb.max.y, bz));
        return [h.x, h.y, h.z, f.x, f.y, f.z];
      }
      if (bb.max.x - bb.min.x < 0.9) {
        // namiot: dwa posłania obok siebie, wzdłuż namiotu, głową pod tylną ścianą (w poprzek się nie mieszczą)
        if (idx >= 2) { this.bedHidden = true; return null; }
        const x = (bb.min.x + bb.max.x) / 2 + (idx ? 0.11 : -0.11);
        floor.updateWorldMatrix(true, false);
        const h = floor.localToWorld(this.bedA.set(x, bb.max.y, bb.min.z + 0.17));
        const f = floor.localToWorld(this.bedB.set(x, bb.max.y, bb.min.z + 0.17 + L));
        return [h.x, h.y, h.z, f.x, f.y, f.z];
      }
      if (bb.max.x - bb.min.x > 1.6) {
        // duża sala (koszary zamku): rzędy posłań w poprzek, kilka kolumn, głowami do ściany
        const m = 0.16, cols = Math.max(1, Math.floor((bb.max.x - bb.min.x - 2 * m) / (L + 0.1)));
        const rows = Math.max(1, Math.floor((bb.max.z - bb.min.z - 2 * m) / 0.21));
        const k = idx % (cols * rows), col = k % cols, row = Math.floor(k / cols);
        const cw = (bb.max.x - bb.min.x - 2 * m) / cols;
        hx = bb.min.x + m + cw * col + (cw - L) / 2; fxl = hx + L;
        z = bb.min.z + m + ((bb.max.z - bb.min.z - 2 * m) / rows) * (row + 0.5);
      } else {
        // chata: po trzy posłania pod każdą ścianą, z odstępem na ramiona; kto się nie zmieści, śpi niewidoczny w kącie
        // (wcześniej cztery na ścianę leżały na sobie, a nogi wchodziły na ławę i stół)
        if (idx >= 6) { this.bedHidden = true; return null; }
        const k = idx, col = k % 2, row = k >> 1;
        const m = 0.1, dz = (bb.max.z - bb.min.z - 2 * m) / 3;
        z = bb.min.z + m + dz * (row + 0.5);
        hx = col === 0 ? bb.min.x + m : bb.max.x - m;
        fxl = col === 0 ? hx + L : hx - L;
      }
      floor.updateWorldMatrix(true, false);
      const h = floor.localToWorld(this.bedA.set(hx, bb.max.y, z));
      const f = floor.localToWorld(this.bedB.set(fxl, bb.max.y, z));
      return [h.x, h.y, h.z, f.x, f.y, f.z];
    }
    // na słomie: kierunek z numeru chłopa, środek posłania na środku pola
    const a = ((u.id * 1.618) % 1) * Math.PI * 2, sx = Math.sin(a) * L / 2, sz = Math.cos(a) * L / 2;
    const cx = u.px / FP, cy = u.py / FP;
    const y = view.heightAt(cx, cy);
    return [cx - sx - width / 2, y, cy - sz - height / 2, cx + sx - width / 2, y, cy + sz - height / 2];
  }
  /** Śpiący w chacie bez wolnego posłania na widoku (więcej niż 6): nie rysujemy go, zamiast stawiać go w izbie */
  private bedHidden = false;
  /** Ostatni czar obronny maga-uzdrowiciela, który już pokazaliśmy (tick) */
  private zapSeen = new Map<number, number>();
  private bedA = new THREE.Vector3();
  private bedB = new THREE.Vector3();

  /**
   * Gaszący pożar: ikonka nad głową, przy studni kręci korbą (wiadro w studni, wraca pełne),
   * przy ogniu unosi wiadro, przechyla je i chlusta wodą (krople łukiem, rozbryzg, kłąb pary nad ogniem).
   */
  private fireCrew(g: GameState, u: GameState['units'][number], i: number, t: THREE.Object3D, view: TerrainView, jobs: Map<number, GameState['buildings'][number]>, heading: number, still: boolean, alpha: number): void {
    const { width, height } = g.map;
    this.fireFx.icon(u.id, t.position.x, t.position.y + 1.02, t.position.z, this.time);
    if (!still || u.timer <= 0) { this.pourWas.delete(u.id); return; }
    const p = Math.min(1, (u.timer + (this.calm ? 0 : alpha)) / FIRE_DRAW);
    const team = TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888;
    if (u.bucket === 1) {
      // przy studni: obie ręce na korbie, wiadro w studni; pod koniec wyciąga je pełne
      const c = this.time * 9 + u.id;
      this.figures.set(i, t.matrix, 0, false, team, u.id, -1.35 + Math.sin(c) * 0.45, -1.35 + Math.cos(c) * 0.45, false);
      const up = p >= 0.75;
      this.buckets.setMatrixAt(i, up ? t.matrix : ZERO);
      this.bucketWater.setMatrixAt(i, up ? t.matrix : ZERO);
      return;
    }
    // przy ogniu: 0–0,45 unosi wiadro do piersi, 0,45–0,7 przechyla, do końca leje
    const lift = Math.min(1, p / 0.45), ease = lift * lift * (3 - 2 * lift);
    const tilt = p < 0.45 ? 0 : Math.min(1, (p - 0.45) / 0.25) * 2.0;
    this.figures.set(i, t.matrix, 0, false, team, u.id, -0.35 - 1.55 * ease - tilt * 0.15, -0.35 - 1.45 * ease - tilt * 0.15, false);
    // wiadro: z prawej dłoni na wprost piersi, obrót wokół jego środka
    const C = BUCKET_C;
    this.bucketL.makeTranslation(C.x + (0.02 - C.x) * ease, C.y + (0.6 - C.y) * ease, C.z + (0.23 - C.z) * ease)
      .multiply(this.bucketR.makeRotationX(tilt))
      .multiply(this.bucketM.makeTranslation(-C.x, -C.y, -C.z));
    this.bucketM.copy(t.matrix).multiply(this.bucketL);
    this.buckets.setMatrixAt(i, this.bucketM);
    this.bucketWater.setMatrixAt(i, tilt < 0.7 ? this.bucketM : ZERO);
    if (this.calm) return;
    if (tilt > 0.6 && p < 0.99) {
      this.mouth.set(0.19, 0.34, 0.13).applyMatrix4(this.bucketM);
      this.fireFx.pour(this.mouth, this.armV.set(Math.sin(heading), 0, Math.cos(heading)), Math.min(1, (tilt - 0.6) * 1.5) * (1 - Math.max(0, p - 0.9) * 8));
    }
    const was = this.pourWas.get(u.id) ?? 0;
    this.pourWas.set(u.id, p);
    const fire = jobs.get(u.fireAt ?? 0);
    if (fire && was < 0.72 && p >= 0.72) {
      const fp = footprint(BUILDINGS[fire.type]!, fire.rot);
      const cx = fire.x + fp.w / 2, cy = fire.y + fp.h / 2;
      this.fireFx.steam(cx - width / 2, this.standY(view, cx, cy) + 0.6, cy - height / 2, 7);
    }
  }

  private syncUnits(g: GameState, view: TerrainView, alpha: number): void {
    this.torchSpots.length = 0;
    // karczmy z karczmarzem: wieczorem schodzą się do nich ludzie (rytm dnia w symulacji)
    this.taverns.clear();
    this.innDoors.clear();
    this.shrineDoors.clear();
    for (const b of g.buildings) if (BUILDINGS[b.type]!.id === 'shrine' && !b.build && !b.ruined && b.door >= 0) this.shrineDoors.set(b.door, b);
    this.markets.clear();
    for (const b of g.buildings) if (BUILDINGS[b.type]!.id === 'market' && !b.build && !b.ruined && b.door >= 0) this.markets.set(b.id, b);
    for (const b of g.buildings) if (BUILDINGS[b.type]!.id === 'tavern' && b.worker && !b.build) { if (!this.taverns.has(b.owner)) this.taverns.set(b.owner, b); if (b.door >= 0) this.innDoors.set(b.door, b); }
    const { width, height } = g.map;
    const n = Math.min(g.units.length, MAX_UNITS);
    const t = this.tmp;
    this.unitSpots.length = 0;
    this.unitY.clear();
    this.fireFx.begin();
    const jobs = new Map<number, GameState['buildings'][number]>();
    this.camps.clear();
    for (const b of g.buildings) { jobs.set(b.id, b); if (BUILDINGS[b.type]!.idleSlots && b.door >= 0) this.camps.set(b.door, b); }
    // przy każdym ognisku wieczorem gra jeden: ten z najmniejszym numerem spośród siedzących (zawsze ktoś, kto tam jest)
    const bards = new Map<number, number>();
    for (const u of g.units) {
      if (u.phase !== Phase.Evening || u.path.length) continue;
      const c = this.camps.get((u.py >> 8) * g.map.width + (u.px >> 8));
      if (c && BUILDINGS[c.type]!.id === 'camp' && (bards.get(c.id) ?? Infinity) > u.id) bards.set(c.id, u.id);
    }
    // kto śpi w której chacie: miejsce na podłodze według kolejności (stałej, po numerze chłopa)
    const sleepers = new Map<number, number[]>();
    for (const u of g.units) if (u.phase === Phase.Sleeping && u.home) { const l = sleepers.get(u.home); if (l) l.push(u.id); else sleepers.set(u.home, [u.id]); }
    for (const l of sleepers.values()) l.sort((a, b) => a - b);
    this.pairChats();
    // pijacy z karczmy: po zamknięciu (od 22:00) wracają do chat chwiejnym krokiem; rano trzeźwieją
    const hourNow = clockAt(g.tick).hour;
    const tipsy = hourNow >= 21.5 || hourNow < 5;
    if (hourNow >= 6 && hourNow < 18) this.drank.clear();
    // niesione ładunki: każdy surowiec ma swoją siatkę, ale rysujemy w niej tylko tych, którzy go niosą
    // (wcześniej każda z kilkunastu siatek miała po jednej instancji na każdego człowieka, z zerową skalą)
    const loadUsed = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const u = g.units[i]!;
      const prev = this.prevPos.get(u.id);
      const fx = (prev ? prev[0] + (u.px - prev[0]) * alpha : u.px) / FP;
      const fy = (prev ? prev[1] + (u.py - prev[1]) * alpha : u.py) / FP;
      // stojący w tym samym miejscu rozstawiają się wokół, żeby nie zlewali się w jednego
      const still = u.path.length === 0;
      // trumnę niosą dwaj (bearers.ts): przedni z ciałem i tylny pomocnik; obaj idą dokładnie tam, gdzie każe symulacja
      // (tylny chwyta drągi dopiero, gdy przedni podniósł trumnę; wcześniej idzie za nim zwyczajnie)
      const bier = (u.phase === Phase.Bearing && g.units.some((x) => x.id === u.target && x.carryRes === CORPSE_LOAD)) || (u.carryRes === CORPSE_LOAD && u.phase !== Phase.Burying);
      const ox = still && !u.bucket && !bier ? (((u.id * 7) % 5) - 2) * 0.17 : 0;
      const oz = still && !u.bucket && !bier ? (((u.id * 11) % 5) - 2) * 0.17 : 0;
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
      // figura idzie łukiem za pozycją z symulacji i omija innych; patrzy tam, dokąd naprawdę idzie
      const cv = this.crowd.move(u.id, fx + ox, fy + oz, heading, this.calm, !bier);
      // niosący trumnę nie odbijają w bok przed innymi (rozjechaliby się z noszami)
      if (bier) { cv.side = 0; cv.sx = cv.x; cv.sy = cv.y; }
      if (cv.speed > 0.3) { heading = cv.heading; this.facing.set(u.id, heading); }
      // gaszący na miejscu: twarzą do studni (czerpie) albo do ognia (wylewa)
      const bucketGoal = u.bucket ? jobs.get(u.bucket === 1 ? u.target : u.fireAt ?? 0) : undefined;
      if (bucketGoal && still && cv.speed <= 0.3) {
        const fpB = footprint(BUILDINGS[bucketGoal.type]!, bucketGoal.rot);
        const want = Math.atan2(bucketGoal.x + fpB.w / 2 - cv.sx, bucketGoal.y + fpB.h / 2 - cv.sy);
        let diff = want - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        heading += this.calm ? diff : diff * 0.2;
        this.facing.set(u.id, heading);
      }
      // buntownik w tłumie: stoi twarzą do bramy twierdzy i krzyczy w jej stronę
      const rioting = !!u.riot && !this.calm;
      if (rioting && still && cv.speed <= 0.3) {
        const door = this.riotDoor(g, u.owner);
        if (door) {
          let diff = Math.atan2(door[0] - cv.sx, door[1] - cv.sy) - heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          heading += diff * 0.2;
          this.facing.set(u.id, heading);
        }
      }
      const walking = (!still || cv.speed > 0.35) && !this.calm;
      let st = this.strides.get(u.id);
      if (!st) { st = { x: cv.sx, y: cv.sy, phase: u.id }; this.strides.set(u.id, st); }
      // jeden pełny krok (obie nogi) na około 0,8 pola
      st.phase += Math.min(0.5, Math.hypot(cv.sx - st.x, cv.sy - st.y)) * 7.5;
      st.x = cv.sx; st.y = cv.sy;
      const stride = walking ? st.phase : 0;
      if (walking) this.footstep(g, u.id, cv.sx, cv.sy, stride, 0.45);
      let swing = walking ? Math.sin(stride) * 0.55 : 0;
      const footY = this.standY(view, cv.sx, cv.sy, (u.py >> 8) * width + (u.px >> 8));
      t.position.set(cv.sx - width / 2, footY + (walking ? Math.abs(Math.cos(stride)) * 0.025 : 0), cv.sy - height / 2);
      if (walking) this.feet.set(u.id, [cv.sx, cv.sy, footY]); // ślady butów: miejsce i wysokość stóp z ekranu
      // krew: chłop raniony przez wilka albo wroga pryska krwią, ciężko ranny gubi krople (render/bloodfx.ts)
      if ((u.hp ?? PEASANT_HP) < PEASANT_HP || this.bloodFx.knows(u.id)) this.bloodFx.track(u.id, u.hp ?? PEASANT_HP, PEASANT_HP, cv.sx, footY, cv.sy, heading, walking, this.time, this.bloodGround, 0.24, true);
      { const frac = (u.hp ?? PEASANT_HP) / PEASANT_HP, lvl = frac < 0.25 ? 3 : frac < 0.45 ? 2 : frac < 0.7 ? 1 : 0; if (lvl) this.woundMarks.set(u.id, [lvl, false]); else if (this.woundMarks.has(u.id)) this.woundMarks.delete(u.id); }
      if (!this.calm) this.breath.breathe(u.id, t.position.x, footY + 0.4, t.position.z, heading, this.time, this.camPos, false);
      t.rotation.set(0, heading, 0);
      if (walking && tipsy && this.drank.has(u.id)) {
        // zatacza się: znosi go na boki (prostopadle do drogi), kiwa się i kręci głową
        const w = Math.sin(this.time * 1.7 + u.id) * 0.13 + Math.sin(this.time * 4.1 + u.id * 3) * 0.04;
        t.position.x += Math.cos(heading) * w; t.position.z -= Math.sin(heading) * w;
        t.rotation.set(Math.sin(this.time * 2.2 + u.id) * 0.1, heading + Math.sin(this.time * 1.3 + u.id) * 0.35, Math.sin(this.time * 1.7 + u.id) * 0.18);
      }
      // pracujący: rolnik chodzi po polu, rzemieślnik stoi w odsłoniętym wnętrzu
      // czeka na miejsce w magazynie (storage.ts): siedzi w swoim warsztacie albo stoi w sadzie/na polu, nic nie robi
      const stalled = u.phase === Phase.Stalled && !!u.job;
      const resting = u.phase === Phase.Resting || (stalled && BUILDINGS[jobs.get(u.job)?.type ?? -1]?.workView === 'inside');
      /** Kopacz idzie sztolnią (do przodka albo do wrót) zamiast kopać — bez zamachu kilofem */
      let mineWalk = false;
      const job = u.phase === Phase.Resting ? jobs.get(u.home) : (u.phase === Phase.Working || stalled) && u.job ? jobs.get(u.job) : undefined;
      const mode = resting ? 'inside' : job ? BUILDINGS[job.type]!.workView : undefined;
      if (job && mode) {
        const def = BUILDINGS[job.type]!;
        const mesh = this.buildingMeshes.get(job.id);
        const fp = footprint(def, job.rot);
        const cx = job.x + fp.w / 2, cy = job.y + fp.h / 2;
        const turn = (job.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const k = this.calm ? 0 : this.time;
        if (mode === 'field' && stalled) {
          // stoi na skraju pola i czeka (bez schylania się)
          t.position.set(cx + fp.w * 0.3 - width / 2, (mesh?.position.y ?? 0) + 0.05, cy + fp.h * 0.3 - height / 2);
          t.rotation.set(0, u.id * 1.3, 0);
          swing = 0;
        } else if (mode === 'field') {
          const wx = cx + Math.sin(k * 0.5 + u.id) * fp.w * 0.3, wy = cy + Math.cos(k * 0.37 + u.id * 2) * fp.h * 0.3;
          t.position.set(wx - width / 2, (mesh?.position.y ?? 0) + 0.05, wy - height / 2);
          t.rotation.set(Math.max(0, Math.sin(k * 5)) * 0.5, k * 0.4 + u.id, 0, 'YXZ'); // schyla się przy pracy
          swing = Math.sin(k * 5) * 0.4;
        } else {
          const m = named(mesh, 'interior')?.children[0];
          // miejsce we wnętrzu jest zapisane w układzie modelu, więc obracamy je razem z budynkiem
          const mx = m ? m.position.x : 0, mz = (m ? m.position.z : 0) + (resting ? 0.3 : 0.12);
          const lx = mx * cosT + mz * sinT, lz = -mx * sinT + mz * cosT;
          // odpoczywający siedzą przy stole obok siebie, pracujący krzątają się przy warsztacie
          const side = resting ? ((u.id % 3) - 1) * 0.28 : Math.sin(k * 2) * 0.12;
          t.position.set(cx + lx - width / 2 + side, (mesh?.position.y ?? 0) + (resting ? -0.03 : 0.05), cy + lz - height / 2);
          t.rotation.set(0, resting ? 0 : Math.PI + Math.sin(k * 2) * 0.6, 0);
          if (!resting) swing = Math.sin(k * 6) * 0.35;
          // załoga kopalni: każdy przy swoim przodku z modelu (`spots`), twarzą do ściany; zamach kilofem robi animacja kopania niżej
          if (job.type === OREMINE_T && !resting && this.inMine?.id === job.id) {
            // spacerowicz jest w sztolni tej kopalni: górnicy kopią przy przodkach we wnętrzu
            const idx = Math.max(0, crewOf(job).indexOf(u.id)) % MINE_LEVEL_SPOTS.length;
            const sp = MINE_LEVEL_SPOTS[idx]!;
            t.position.set(MINE_AT.x + sp[0], MINE_AT.y + sp[1], MINE_AT.z + sp[2]);
            t.rotation.set(0, sp[3], 0);
            swing = 0;
            // dojście: wszedł wrotami i idzie sztolnią do swojego przodka, a po robocie wraca do wrót i dopiero tam znika
            if (OREMINE_PROD) {
              const left = Math.max(0, u.timer - alpha) / TICKS_PER_SECOND;
              const route = mineRoute(idx), rt = routeTime(route);
              // czas drogi z symulacji (pełne ticki): przy wrotach chwilę postoi, zanim ruszy — bez skoku na końcu
              const walkS = mineWalkTicks(idx) / TICKS_PER_SECOND;
              const total = OREMINE_PROD.workTicks / TICKS_PER_SECOND + 2 * walkS;
              const gone = total - left;
              const tWalk = gone < walkS ? Math.max(0, gone - (walkS - rt.walk)) : left < walkS ? Math.max(0, left - (walkS - rt.walk)) : -1;
              if (tWalk >= 0) {
                const pose = poseOnRoute(route, rt.speed, tWalk, MINE_LEVEL.low, MINE_LEVEL.hole, gone >= walkS);
                t.position.set(MINE_AT.x + pose.x, MINE_AT.y + pose.y, MINE_AT.z + pose.z);
                t.rotation.set(0, pose.yaw, 0);
                if (pose.moving) {
                  mineWalk = true;
                  const ph = this.time * rt.speed * 9.4 + u.id;
                  swing = pose.climbing ? Math.sin(this.time * 7 + u.id) * 0.3 : Math.sin(ph) * 0.55;
                  if (!pose.climbing) t.position.y += Math.abs(Math.cos(ph)) * 0.025;
                }
              }
            }
          } else if (job.type === OREMINE_T && !resting && MINE_SPOTS.length) {
            const idx = Math.max(0, crewOf(job).indexOf(u.id));
            const sp = MINE_SPOTS[idx % MINE_SPOTS.length]!;
            const sx = sp[0] * cosT + sp[1] * sinT, sz = -sp[0] * sinT + sp[1] * cosT;
            t.position.set(cx + sx - width / 2, (mesh?.position.y ?? 0) + 0.05, cy + sz - height / 2);
            t.rotation.set(0, sp[2] + turn, 0);
            swing = 0;
          }
        }
      }
      // wieczorem (18–23) połowa bezrobotnych z obozowiska siedzi przed karczmą przy kuflu, a jeden się zatacza
      const evening = u.phase === Phase.Evening && still;
      const camp = (u.phase === Phase.Idle || evening) && still ? this.camps.get((u.py >> 8) * width + (u.px >> 8)) : undefined;
      // wieczorem w karczmie: ci, którzy przyszli pod jej drzwi (rytm dnia), i dawny skrót dla wolnych z obozowiska
      // wieczorem w karczmie siedzą ci, którzy przyszli pod jej drzwi (każda karczma osobno)
      const inn = evening ? this.innDoors.get((u.py >> 8) * width + (u.px >> 8)) : undefined;
      const shrine = evening && !inn ? this.shrineDoors.get((u.py >> 8) * width + (u.px >> 8)) : undefined;
      // kupiec rynku czekający pod drzwiami (za dnia): stoi za ladą swojego kramu, przodem do placu
      const market = !evening && still && u.job ? this.markets.get(u.job) : undefined;
      if (market && market.door === (u.py >> 8) * width + (u.px >> 8)) {
        const mesh = this.buildingMeshes.get(market.id);
        const turn = (market.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const idx = Math.max(0, crewOf(market).indexOf(u.id)) % 2;
        // układ modelu (tools/models/market.py): kramy w x = ∓0,72, lada w z ≈ 0, kupiec za nią w z = −0,32
        const lx = idx ? 0.72 : -0.72, lz = -0.32, wx = lx * cosT + lz * sinT, wz = -lx * sinT + lz * cosT;
        const mfp = footprint(BUILDINGS[market.type]!, market.rot);
        t.position.set(market.x + mfp.w / 2 + wx - width / 2, (mesh?.position.y ?? 0) + 0.06, market.y + mfp.h / 2 + wz - height / 2);
        t.rotation.set(0, turn + (this.calm ? 0 : Math.sin(this.time * 0.5 + u.id) * 0.4), 0);
        swing = this.calm ? 0 : Math.max(0, Math.sin(this.time * 1.7 + u.id)) * -0.6; // zachwala towar, macha ręką
      } else if (inn) {
        const mesh = this.buildingMeshes.get(inn.id);
        const turn = (inn.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        // miejsca z modelu karczmy: przy stołach w izbie i na ławach ganku; ostatni to pijak zataczający się przed wejściem
        const SEATS = TAVERN_SEATS;
        // sucha karczma (w składzie nie ma piwa): siedzą markotni, nikt nie gra ani się nie zatacza
        const wet = (g.players[inn.owner]?.res[ALE] ?? 0) > 0;
        const slot = (u.id >> 1) % (SEATS.length + (wet ? 1 : 0));
        const drunk = slot === SEATS.length;
        if (wet) this.drank.add(u.id);
        const seat = SEATS[Math.min(slot, SEATS.length - 1)]!;
        let lx = seat[0], lz = seat[1];
        if (drunk) { lx = 0.1 + Math.sin(this.time * 0.6 + u.id) * 0.5; lz = 1.5 + Math.cos(this.time * 0.45) * 0.25; }
        const wx = lx * cosT + lz * sinT, wz = -lx * sinT + lz * cosT;
        const ifp = footprint(BUILDINGS[inn.type]!, inn.rot);
        t.position.set(inn.x + ifp.w / 2 + wx - width / 2, (mesh?.position.y ?? 0) + (drunk ? 0.02 : TAVERN_FLOOR), inn.y + ifp.h / 2 + wz - height / 2);
        t.rotation.set(drunk ? Math.sin(this.time * 2.3 + u.id) * 0.25 : 0, drunk ? this.time * 0.7 : seat[2] + turn, drunk ? Math.cos(this.time * 1.9) * 0.2 : 0);
        swing = drunk ? Math.sin(this.time * 3) * 0.4 : wet ? Math.max(0, Math.sin(this.time * 1.3 + u.id * 2)) * -1.2 : 0;
        if (!wet) t.rotation.x = 0.18; // zwiesza głowę nad pustym kuflem
        if (wet && slot === 0 && !this.calm) this.lutePlay(t.position.x, t.position.z);
        // gwar przy kuflach: co chwilę ktoś inny zagaduje, śmieje się albo przekrzykuje lutnię
        if (wet && !this.calm && this.time > this.murmurAt && (u.id + Math.floor(this.time * 3)) % 4 === 0) {
          const cam = this.cam.camera, dist = cam.position.distanceTo(t.position);
          if (dist < 14) {
            this.murmurAt = this.time + 0.9 + ((u.id * 13) % 7) * 0.15;
            this.say(u.id, (u.id + Math.floor(this.time / 3)) % 5 === 0, t.position);
          }
        }
      } else if (shrine && u.job === shrine.id) {
        // kaznodzieja tej kapliczki: stoi z boku posągu przodem do modlących się i mówi kazanie
        const mesh = this.buildingMeshes.get(shrine.id);
        const turn = (shrine.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const lx = 0.44, lz = 0.3, wx = lx * cosT + lz * sinT, wz = -lx * sinT + lz * cosT;
        const sfp = footprint(BUILDINGS[shrine.type]!, shrine.rot);
        t.position.set(shrine.x + sfp.w / 2 + wx - width / 2, (mesh?.position.y ?? 0) + 0.01, shrine.y + sfp.h / 2 + wz - height / 2);
        t.rotation.set(0, turn - 0.35 + (this.calm ? 0 : Math.sin(this.time * 0.6 + u.id) * 0.35), 0);
        swing = 0;
        this.sermon = true;
        if (!this.calm && this.time > this.murmurAt) {
          const cam = this.cam.camera, dist = cam.position.distanceTo(t.position);
          if (dist < 16) {
            this.murmurAt = this.time + 0.6;
            this.say(u.id, false, t.position);
          }
        }
      } else if (shrine) {
        const mesh = this.buildingMeshes.get(shrine.id);
        const turn = (shrine.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        // miejsca przed posągiem (układ modelu, przód = +z): trzech klęczy za klęcznikiem, reszta stoi za nimi w dwóch rzędach
        const slot = (u.id >> 2) % SHRINE_SPOTS.length;
        const [lx, lz] = SHRINE_SPOTS[slot]!;
        const kneel = slot < 3;
        const wx = lx * cosT + lz * sinT, wz = -lx * sinT + lz * cosT;
        const sfp = footprint(BUILDINGS[shrine.type]!, shrine.rot);
        // klęczący: niżej (golenie chowa deska klęcznika), pochyleni; stojący ze spuszczoną głową i lekkim kołysaniem
        t.position.set(shrine.x + sfp.w / 2 + wx - width / 2, (mesh?.position.y ?? 0) + (kneel ? -0.1 : 0.01), shrine.y + sfp.h / 2 + wz - height / 2);
        t.rotation.set(kneel ? 0.22 : 0.14 + Math.sin(this.time * 0.8 + u.id) * 0.03, Math.PI + turn, 0);
        swing = kneel ? -0.5 : 0;
      } else if (camp && camp.owner === u.owner) {
        const mesh = this.buildingMeshes.get(camp.id);
        // przy stołkach wokół ogniska (miejsca z modelu), kolejni stoją za nimi w drugim kręgu
        const seats = CAMP_SEATS, n = u.id % (seats.length * 2), seat = seats[n % seats.length]!, back = n >= seats.length ? 1.45 : 1.25;
        const turn = (camp.rot * Math.PI) / 2, cosT = Math.cos(turn), sinT = Math.sin(turn);
        const lx = seat[0] * back, lz = seat[1] * back;
        t.position.set(camp.x + 1 + lx * cosT + lz * sinT - width / 2, (mesh?.position.y ?? 0) + 0.02, camp.y + 1 - lx * sinT + lz * cosT - height / 2);
        t.rotation.set(0, seat[2] + turn, 0);
        swing = 0;
        // wieczorem przy ogniu: pierwszy gra na lutni, inni kiwają się w takt i co chwilę ktoś śpiewa albo zagaduje
        if (evening && !this.calm) {
          if (bards.get(camp.id) === u.id) { swing = Math.sin(this.time * 9) * 0.35; t.rotation.x = 0.12; this.lutePlay(t.position.x, t.position.z); }
          else { t.rotation.z = Math.sin(this.time * 2.2 + u.id) * 0.06; if ((u.id + Math.floor(this.time * 0.5)) % 3 === 0) swing = Math.max(0, Math.sin(this.time * 2.2 + u.id)) * -0.9; }
          if (this.time > this.murmurAt && (u.id + Math.floor(this.time * 3)) % 4 === 0) {
            const cam = this.cam.camera, dist = cam.position.distanceTo(t.position);
            if (dist < 14) {
              this.murmurAt = this.time + 0.5 + ((u.id * 13) % 7) * 0.1;
              this.say(u.id, (u.id + Math.floor(this.time / 3)) % 4 === 0, t.position);
            }
          }
        }
      }
      // rybak stoi twarzą do wody z wędką; pozostali na stanowisku machają siekierą lub kilofem
      const fishing = u.phase === Phase.WorkingSite && u.job !== 0 && jobs.get(u.job)?.type === FISHER;
      if (fishing) {
        const tx = u.px >> 8, ty = u.py >> 8;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          if (g.map.tiles[(ty + dy) * width + tx + dx] === Terrain.Water) { t.rotation.set(0, Math.atan2(dx, dy), 0); break; }
        swing = 0;
      }
      // drwal z siekierą, kopacz z kilofem: oburęczny zamach, cios z pochyleniem i stuk w chwili trafienia
      const site = u.phase === Phase.WorkingSite && !fishing && u.job ? BUILDINGS[jobs.get(u.job)?.type ?? -1]?.production?.site : undefined;
      // rąbiący z biedy (bez chaty drwala, emergencywood.ts) macha siekierą tak samo jak drwal
      // po ścięciu ociosuje i tnie leżący pień przy pniaku: zamach niżej, z mocnym pochyleniem nad pniem
      const limbing = u.phase === Phase.Working && !!u.chop && !u.job;
      const chopping = site === Terrain.Forest || (u.phase === Phase.WorkingSite && !!u.chop) || limbing;
      // górnik w grocie kopalni: ten sam zamach kilofem co na złożu, ale stoi już twarzą do ściany (miejsce z modelu)
      const inMine = u.phase === Phase.Working && !!job && job.type === OREMINE_T && !mineWalk;
      const mining = site === Terrain.Stone || site === Terrain.Iron || inMine;
      let toolArm = 0, toolLean = 0;
      // kopacz przy złożu najpierw sięga przez bark po kilof z pleców (PICK_DRAW s), dopiero potem zaczyna walić
      let drawing = -1; // 0..1 = postęp wyciągania kilofa; -1 = nie wyciąga
      let mineT = 0;    // czas od chwili, gdy kilof jest już w rękach (zamachy liczone od zera)
      if (mining && !this.calm) {
        let st = this.mineStart.get(u.id);
        if (st === undefined) { st = this.time; this.mineStart.set(u.id, st); }
        const el = this.time - st;
        if (el < PICK_DRAW) drawing = el / PICK_DRAW; else mineT = el - PICK_DRAW;
      } else if (!mining) this.mineStart.delete(u.id);
      if (chopping || mining) {
        // twarzą do najbliższego drzewa albo skały obok
        const tx = u.px >> 8, ty = u.py >> 8, want = chopping ? Terrain.Forest : site!;
        if (!inMine) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
          if (g.map.tiles[(ty + dy) * width + tx + dx] === want) { t.rotation.set(0, Math.atan2(dx, dy), 0); break; }
        // przy pniu: stoi zawsze tak samo (pień leży przed nim w poprzek), nie szuka drzewa obok
        if (limbing) t.rotation.set(0, (u.id * 2.399) % (Math.PI * 2), 0);
        if (drawing >= 0) {
          // ręka w górę za bark (chwyta stylisko), potem kilof zjeżdża przed siebie do pozycji wyjściowej
          const ease = (x: number): number => x * x * (3 - 2 * x);
          toolArm = drawing < PICK_GRAB ? -0.5 - ease(drawing / PICK_GRAB) * 2.45 : -2.95 + ease((drawing - PICK_GRAB) / (1 - PICK_GRAB)) * 2.6;
          toolLean = 0.05;
        } else if (!this.calm) {
          const ph = mining ? (mineT * 0.85) % 1 : (this.time * 1.15 + (u.id % 11) * 0.173) % 1;
          const ease = (x: number): number => x * x * (3 - 2 * x);
          const high = limbing ? 1.75 : chopping ? 2.3 : 2.75;
          if (ph < 0.55) toolArm = -0.35 - ease(ph / 0.55) * high;                    // zamach nad ramię albo nad głowę
          else if (ph < 0.67) toolArm = -0.35 - high + ((ph - 0.55) / 0.12) ** 2 * (high + 0.15); // cios
          else if (ph < 0.77) toolArm = -0.2 - Math.sin(((ph - 0.67) / 0.1) * Math.PI) * 0.15;     // odbicie
          else toolArm = -0.2;
          toolLean = ph > 0.55 && ph < 0.85 ? Math.sin(((ph - 0.55) / 0.3) * Math.PI) * (mining ? 0.4 : limbing ? 0.5 : 0.28) : limbing ? 0.2 : 0.05;
          // okruchy spod kilofa: raz na cios i tylko gdy kamera stoi tuż obok (spacer przy górniku albo bliskie zbliżenie)
          if (mining && ph > 0.66 && ph < 0.78) {
            const swingNo = Math.floor(mineT * 0.85);
            if (this.chipSwing.get(u.id) !== swingNo) {
              this.chipSwing.set(u.id, swingNo);
              const cp = this.cam.camera.position;
              const visible = !inMine || this.inMine?.id === job!.id; // z zewnątrz kopalni górników w górze nie widać
              if (visible && (cp.x - t.position.x) ** 2 + (cp.y - t.position.y) ** 2 + (cp.z - t.position.z) ** 2 < 5 * 5) {
                const yaw = t.rotation.y, dx = Math.sin(yaw), dz = Math.cos(yaw);
                this.chips.hit(t.position.x + dx * 0.3, t.position.y + 0.24, t.position.z + dz * 0.3, dx, dz, t.position.y, inMine ? 0.5 : site === Terrain.Iron ? 0.25 : 0);
              }
            }
          }
          if (ph > 0.66 && ph < 0.71) {
            if (!inMine) this.sfxAt(chopping ? 'chop' : 'mine', t.position.x, t.position.z, u.id, 0.5, 0.9);
            // górnik w sztolni, a my w niej spacerujemy: pełny stuk z jego miejsca pod ziemią (wysokość z pozycji, nie z terenu)
            else if (this.inMine?.id === job!.id) this.sfxAt('mine', t.position.x, t.position.z, u.id, 0.5, 1.1, t.position.y + 0.8);
            // z zewnątrz kopalni: kopią w głębi góry — jeden przytłumiony stuk na całą kopalnię, nie każdy górnik osobno
            else this.sfxAt('mine', t.position.x, t.position.z, `m${job!.id}`, 1.4, 0.3);
          }
        } else toolArm = -0.3;
        swing = 0;
      }
      // rzemieślnik w warsztacie: pochylony nad stołem, ręce na zmianę wyrabiają albo strugają
      const crafting = u.phase === Phase.Working && !!job && mode === 'inside' && !inMine;
      let craftR = 0, craftL = 0;
      if (crafting) {
        const k2 = this.calm ? 0 : this.time * 5.5 + u.id;
        craftR = -1.05 + Math.sin(k2) * 0.32; craftL = -1.05 - Math.sin(k2) * 0.32;
      }
      // odgłosy pracy z miejsca, gdzie pracuje
      if (!this.calm && u.job) {
        const jt = jobs.get(u.job);
        const jid = jt ? BUILDINGS[jt.type]!.id : '';
        if (u.phase === Phase.Working) {
          // tartak i tokarz: piła w drewnie, czasem stuk młotka
          if (jid === 'woodcutter' || jid === 'poleturner' || jid === 'carpenter') this.sfxAt(Math.random() < 0.7 ? 'saw' : 'hammer', t.position.x, t.position.z, u.id, 1.3, 0.8);
          // kowal: metaliczne uderzenia młota
          else if (jid === 'smithy') this.sfxAt('smith', t.position.x, t.position.z, u.id, 1.1, 0.9);
          // płatnerz: drobne, ciche stuknięcia młotka przy nitowaniu kółek
          else if (jid === 'armorer') this.sfxAt('smith', t.position.x, t.position.z, u.id, 0.8, 0.45);
          // młyn: bez dźwięku — dawne skrzypnięcie drzwi co 3,5 s brzmiało jak skrzypiące wiadro w wiosce (28.10.2026)
        }
      }
      // wilk tuż obok: chłop staje do niego twarzą i macha rękami
      // (bije go swoją bronią: kilofem albo maczugą — patrz walka niżej)
      let wolfNear: { px: number; py: number } | undefined;
      if (!this.calm && g.wolves.length) for (const w of g.wolves) {
        if (w.hp <= 0 || (w.px - u.px) ** 2 + (w.py - u.py) ** 2 > (1.5 * FP) ** 2) continue;
        t.rotation.set(0, Math.atan2(w.px - u.px, w.py - u.py), 0);
        wolfNear = w;
        if ((u.hp ?? 30) < 30) this.sfxAt('flesh', t.position.x, t.position.z, `bite${u.id}`, 0.9, 0.8);
        break;
      }
      // odważny chłop przed wrogim żołnierzem: twarzą do niego, z bliska okłada go pięściami i kijem
      const enemy = (u.foe ? g.soldiers.find((x) => x.id === u.foe) : undefined) ?? (u.foeU ? g.units.find((x) => x.id === u.foeU) : undefined) ?? wolfNear;
      // kopacz (kopalnia, kamieniołom, żelazo) zawsze ma kilof, nie maczugę — po drodze do roboty niesie go w ręku
      const workAt = u.job ? jobs.get(u.job) : undefined;
      const workSite = workAt ? BUILDINGS[workAt.type]?.production?.site : undefined;
      const miner = !!workAt && (workAt.type === OREMINE_T || workSite === Terrain.Stone || workSite === Terrain.Iron);
      const weapon = miner ? 'pick' : peasantWeapon(u.id);
      let fighting = false, fightArm = -0.4;
      if (enemy && !this.calm) {
        t.rotation.set(0, Math.atan2(enemy.px - u.px, enemy.py - u.py), 0);
        // z bliska wyciąga broń: kilof oburącz z zamachem znad głowy, maczuga jedną ręką, krótszy zamach
        if ((enemy.px - u.px) ** 2 + (enemy.py - u.py) ** 2 < (1.6 * FP) ** 2) {
          fighting = true;
          const ph = (this.time * (weapon === 'pick' ? 1.1 : 1.6) + (u.id % 7) * 0.21) % 1;
          const ease = (x: number): number => x * x * (3 - 2 * x);
          const high = weapon === 'pick' ? 2.7 : 2.1;
          if (ph < 0.5) fightArm = -0.4 - ease(ph / 0.5) * high;
          else if (ph < 0.62) fightArm = -0.4 - high + ((ph - 0.5) / 0.12) ** 2 * (high + 0.2);
          else fightArm = -0.3;
          toolLean = ph > 0.5 && ph < 0.8 ? Math.sin(((ph - 0.5) / 0.3) * Math.PI) * 0.3 : 0.08;
          if (ph > 0.6 && ph < 0.65) this.sfxAt('punch', t.position.x, t.position.z, `pf${u.id}`, 0.4, 0.8);
          swing = 0;
        }
      }
      // krzyk przy ucieczce, zaskoczone „hę?!” odważnego na widok wroga
      if (!this.calm) {
        const f = u.fled ?? 0, pf = this.fledSeen.get(u.id) ?? 0;
        if (f > pf && f > g.tick) this.voiceAt('scream', t.position.x, t.position.z, 0.7);
        this.fledSeen.set(u.id, f);
        const pe = this.foeSeen.get(u.id) ?? 0;
        if (u.foe && u.foe !== pe) this.voiceAt('alert', t.position.x, t.position.z, 0.8);
        this.foeSeen.set(u.id, u.foe ?? 0);
      }
      // układanie drogi wygląda jak budowa: pochylony chłop bije młotkiem w ziemię
      // leśniczy sadzi drzewko: stoi pochylony nad dołkiem i kopie łopatą — wbija pióro w ziemię, podważa i odrzuca ziemię
      // chłop bez cmentarza zakopuje ciało na skraju lasu: kopie łopatą tak samo jak leśniczy
      const planting = u.phase === Phase.Planting || u.phase === Phase.Burying;
      const hammering = u.phase === Phase.Repairing || u.phase === Phase.Paving;
      let lean = u.phase === Phase.Paving ? 0.35 : planting ? 0.22 : crafting ? 0.18 : toolLean, work = 0;
      if (planting) {
        if (!this.calm) {
          const ph = (this.time * 0.8 + (u.id % 13) * 0.137) % 1;
          const ease = (x: number): number => x * x * (3 - 2 * x);
          // work = kąt prawej ręki z łopatą: uniesiona w przód, pchnięcie w ziemię, podważenie do siebie, odrzut i powrót
          if (ph < 0.3) work = -0.75 + ease(ph / 0.3) * 0.45;                         // wbija pióro w ziemię przed sobą
          else if (ph < 0.55) work = -0.3 - ease((ph - 0.3) / 0.25) * 0.15;           // podważa
          else if (ph < 0.75) work = -0.45 - Math.sin(((ph - 0.55) / 0.2) * Math.PI) * 0.55; // odrzuca ziemię na bok
          else work = -0.45 - ease((ph - 0.75) / 0.25) * 0.3;                         // z powrotem w górę
          lean += ph < 0.55 ? ease(Math.min(1, ph / 0.3)) * 0.15 : 0.15 * (1 - ease((ph - 0.55) / 0.45));
        } else work = -0.4;
        swing = 0;
      }
      if (hammering) {
        // robotnicy rozstawiają się wokół budowy, twarzą do ścian; co drugi pracuje na pomoście rusztowania (na wysokości murów)
        const site = u.phase === Phase.Repairing ? g.buildings.find((b) => b.id === u.target) : undefined;
        if (site) {
          const fp = footprint(BUILDINGS[site.type]!, site.rot);
          const a = (u.id * 2.39996) % (Math.PI * 2);
          const cx = site.x + fp.w / 2, cy = site.y + fp.h / 2;
          const sc = this.sites.sites.get(site.id);
          const deck = sc ? sc.plane.constant - 0.1 : 0;
          const onDeck = !!sc && u.id % 2 === 0 && deck - sc.base > 0.35;
          // tuż przy ścianie, żeby młotek trafiał w mur; co trzeci na ziemi klęczy i bije nisko (przy wykopie wszyscy)
          const kneel = !onDeck && (u.id % 3 === 1 || (sc ? sc.plane.constant - sc.base < 0.2 : false));
          const rx = fp.w / 2 + (onDeck ? 0.22 : 0.17), ry = fp.h / 2 + (onDeck ? 0.22 : 0.17);
          const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
          t.position.set(px - width / 2, (onDeck ? deck + 0.02 : view.heightAt(px, py)) - (kneel ? 0.11 : 0), py - height / 2);
          if (kneel) lean = 0.3;
          t.rotation.set(0, Math.atan2(cx - px, cy - py), 0);
        }
        // uderzenie młotkiem: powolny zamach w górę, szybki cios w dół, krótkie odbicie i chwila przerwy;
        // przy ciosie tułów pochyla się do przodu, a w chwili trafienia słychać stuk
        if (!this.calm) {
          const ph = (this.time * 1.45 + (u.id % 13) * 0.137) % 1;
          const ease = (x: number): number => x * x * (3 - 2 * x);
          // work = kąt prawej ręki (ujemny = w przód i w górę). Trzonek sterczy z pięści prostopadle do ręki:
          // przy zamachu młotek jest za głową, przy ciosie ręka idzie w przód-w dół, a obuch trafia w mur na wysokości twarzy
          if (ph < 0.5) work = -0.6 - ease(ph / 0.5) * 2.1;                       // powolny zamach nad głowę
          else if (ph < 0.6) work = -2.7 + ((ph - 0.5) / 0.1) ** 2 * 2.1;         // przyspieszający cios
          else if (ph < 0.7) work = -0.6 - Math.sin(((ph - 0.6) / 0.1) * Math.PI) * 0.18; // odbicie od muru
          else work = -0.6;                                                        // chwila przerwy
          lean += ph > 0.5 && ph < 0.75 ? Math.sin(((ph - 0.5) / 0.25) * Math.PI) * 0.22 : 0;
          // budowa: młotek w drewno (nagrania 0 A.D.), przy murach z kamienia dłuto
          if (ph > 0.59 && ph < 0.65) this.sfxAt(Math.random() < 0.85 ? 'hammer' : 'saw', t.position.x, t.position.z, u.id, 0.5);
        } else work = -0.6;
        swing = 0;
      }
      // sen: każdy leży na wznak na sienniku — w chacie (widać po kliknięciu, gdy zdejmie się dach)
      // albo bez dachu nad głową na słomie obok ogniska
      const sleeping = u.phase === Phase.Sleeping;
      this.bedHidden = false;
      const bed = sleeping ? this.bedSpot(g, u, view, sleepers) : null;
      if (bed) {
        const [hx, hy, hz, fx2, fy2, fz2] = bed;
        const a = Math.atan2(fx2 - hx, fz2 - hz);
        t.position.set((hx + fx2) / 2, (hy + fy2) / 2, (hz + fz2) / 2);
        t.rotation.set(0, a, 0);
        t.scale.setScalar(1);
        t.updateMatrix();
        this.bedrolls.setMatrixAt(i, t.matrix);
        // postać obraca się wokół stóp, więc stawiamy ją stopami na końcu siennika i kładziemy na plecy
        t.position.set(fx2, fy2 + 0.045, fz2);
        lean = -Math.PI / 2;
        // chory w gorączce: co chwilę zanosi się kaszlem (unosi się lekko na posłaniu)
        if (u.sick && !this.calm) { const c = Math.sin(this.time * 2.3 + u.id * 1.7); if (c > 0.88) lean += (c - 0.88) * 3 * (1 + Math.sin(this.time * 30) * 0.3); }
        swing = 0;
      } else this.bedrolls.setMatrixAt(i, ZERO);
      // śpiących w chacie nie da się kliknąć przez ściany: kliknięcie trafia w chatę i odsłania wnętrze
      if (!(sleeping && u.home)) this.unitSpots.push({ id: u.id, x: t.position.x, z: t.position.z });
      this.unitY.set(u.id, t.position.y);
      if (u.id === this.selectedUnit) { this.selection.scale.set(0.5, 0.5, 1); this.selection.position.set(t.position.x, t.position.y + 0.05, t.position.z); this.selection.visible = true; }
      t.scale.setScalar(this.bedHidden ? 0 : FIG);
      // stojący bez zajęcia nie zamiera: przestępuje, rozgląda się, drapie się, przeciąga, przenosi ciężar
      const rest = !walking && !this.calm && !(job && mode) && !inn && !bed && !fishing && !chopping && !mining && !crafting && !hammering && !planting && !fighting && u.carryRes < 0 && !lean && !u.bucket;
      const ia = rest ? idle(u.id, this.time) : undefined;
      // rozmowa: obaj zwracają się do siebie, mówiący gestykuluje, słuchający kiwa głową; co kilkanaście sekund chwila ciszy
      const mate = rest ? this.chats.get(u.id) : undefined;
      const mp = mate ? this.restPos.get(mate) : undefined;
      if (ia && mate && mp) {
        const want = Math.atan2(mp[0] - t.position.x, mp[1] - t.position.z);
        let cy = this.chatYaw.get(u.id) ?? t.rotation.y;
        let d = want - cy; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        cy += d * Math.min(1, this.frameDt * 4);
        this.chatYaw.set(u.id, cy);
        ia.yaw = 0; ia.legs = 0; ia.up = false; ia.armL = undefined; ia.arm = undefined;
        t.rotation.y = cy;
        const pair = Math.min(u.id, mate) * 7 + Math.max(u.id, mate) * 3;
        const ct = this.time + (pair % 13);
        const talking = ct % 19 < 14;
        if (talking) {
          const turn = Math.floor(ct / 2.6);
          const speaker = turn % 2 ? Math.max(u.id, mate) : Math.min(u.id, mate);
          if (speaker === u.id) {
            ia.arm = -0.75 + Math.sin(this.time * 5.3 + u.id) * 0.45;
            ia.armL = -0.35 + Math.sin(this.time * 3.9 + u.id * 2) * 0.35;
            // bełkot rozmowy z bliska, raz na kolejkę mówiącego
            if (this.chatTurn.get(u.id) !== turn) {
              this.chatTurn.set(u.id, turn);
              const cam = this.cam.camera, dist = cam.position.distanceTo(t.position);
              if (dist < 9 && !this.calm) {
                this.say(u.id, false, t.position);
              }
            }
          } else lean = Math.max(0, Math.sin(this.time * 2.6 + u.id)) * 0.07; // kiwa głową, słuchając
        }
      }
      if (ia) { t.rotation.y += ia.yaw; t.position.y += ia.dy; }
      if (rest) this.restNext.set(u.id, [t.position.x, t.position.z, u.owner]);
      // pozdrowienie w przejściu: mijając swojego, czasem macha ręką (z pustymi rękami)
      const wavingNow = (this.waveUntil.get(u.id) ?? 0) > this.time;
      if (walking && !wavingNow && cv.near && u.carryRes < 0 && !this.calm && this.time - (this.waveAt.get(u.id) ?? -99) > 25 && (u.id * 13 + cv.near * 7) % 3 === 0) {
        const other = g.units.find((o) => o.id === cv.near);
        if (other && other.owner === u.owner) { this.waveUntil.set(u.id, this.time + 0.9); this.waveAt.set(u.id, this.time); }
      }
      const waving = walking && (this.waveUntil.get(u.id) ?? 0) > this.time && u.carryRes < 0;
      // chód: biodra kołyszą się z krokiem, tułów lekko pochylony do przodu (uciekający bardziej)
      const fleeing = (u.fled ?? 0) > g.tick && !still;
      const roll = ia ? ia.roll : walking ? Math.sin(stride) * 0.03 : 0;
      if (walking && !lean && !this.calm) lean = fleeing ? 0.16 : 0.05;
      if (lean || roll) { t.rotation.reorder('YXZ'); t.rotation.x = lean; t.rotation.z = roll; }
      t.updateMatrix();
      if (fishing) {
        // wędka w prawej dłoni wyciągniętej w przód (FISH_ARM), obracana w barku razem z ręką
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(FISH_ARM).setPosition(0.135, 0.45, 0);
        this.rods.setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
      } else this.rods.setMatrixAt(i, ZERO);
      if (hammering) {
        // młotek obraca się w barku razem z prawą ręką (ta sama skala co postać)
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(work).setPosition(0.135, 0.45, 0);
        this.hammers.setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
      } else this.hammers.setMatrixAt(i, ZERO);
      if (planting) {
        // łopata w prawej dłoni, obraca się w barku razem z ręką
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(work).setPosition(0.135, 0.45, 0);
        this.spades.setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
      } else this.spades.setMatrixAt(i, ZERO);
      // mag i kaznodzieja nie noszą narzędzi, maczugi ani pochodni (mag ma czar w dłoniach)
      const robedJob = u.job && !u.enlist ? jobs.get(u.job) : undefined; // rekrut w drodze na szkolenie to jeszcze chłop
      const robed = !!robedJob && (!!mageKindOf(robedJob.type) || BUILDINGS[robedJob.type]?.id === 'shrine');
      // nocą idący niosą pochodnię (ci z ładunkiem mają zajęte ręce)
      // buntownik: co trzeci z płonącą pochodnią (dzień i noc, na napad wszyscy), reszta z widłami; wymachują nimi w swoim rytmie
      const riotTorch = rioting && (u.id % 3 === 0 || !!u.raid); // na napad idą z pochodniami
      const shake = rioting ? Math.sin(this.time * (5.5 + (u.id % 5) * 0.4) + u.id * 1.7) : 0;
      const torchArm = riotTorch ? TORCH_ARM - 0.45 + shake * 0.18 : TORCH_ARM;
      const forkArm = FORK_ARM + shake * 0.28;
      // w grupie pochodnię niesie jeden (Michał 30.10.2026: czterech idących obok siebie nie potrzebuje czterech pochodni —
      // to też mniej płomieni i świateł do policzenia); kto ma towarzysza z pochodnią do ok. 1,6 pola, idzie przy jego świetle
      let torchOn = !robed && !bier && (riotTorch || (this.night > 0.15 && !still && u.carryRes < 0 && !u.bucket));
      if (torchOn && !riotTorch) {
        const tp = t.position, spots = this.torchSpots;
        for (let k = 0; k < spots.length; k += 2) if ((spots[k]! - tp.x) ** 2 + (spots[k + 1]! - tp.z) ** 2 < 2.6) { torchOn = false; break; }
        if (torchOn) spots.push(tp.x, tp.z);
      }
      // kopacz w drodze (także sztolnią) ma kilof na plecach; do ręki bierze go dopiero przy złożu, gdy dłoń chwyci stylisko
      const pickOnBack = drawing >= 0 && drawing < PICK_GRAB;
      // siekiera albo kilof w prawej dłoni, obracane w barku razem z ręką
      if (pickOnBack) { this.axes.setMatrixAt(i, ZERO); this.picks.setMatrixAt(i, ZERO); }
      else if (chopping || mining) {
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationFromEuler(this.gripE.set(toolArm, 0, drawing >= 0 ? -TWO_HAND * (drawing - PICK_GRAB) / (1 - PICK_GRAB) : -TWO_HAND)).setPosition(0.135, 0.45, 0);
        (chopping ? this.axes : this.picks).setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
        (chopping ? this.picks : this.axes).setMatrixAt(i, ZERO);
      } else if (fighting && !robed) {
        // broń z pleców albo zza pasa w dłoni
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(fightArm).setPosition(0.135, 0.45, 0);
        (weapon === 'pick' ? this.picks : this.clubs).setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
        (weapon === 'pick' ? this.clubs : this.picks).setMatrixAt(i, ZERO);
        this.axes.setMatrixAt(i, ZERO);
      } else { this.axes.setMatrixAt(i, ZERO); this.picks.setMatrixAt(i, ZERO); }
      if (!fighting) this.clubs.setMatrixAt(i, ZERO);
      // na co dzień broń wisi na plecach albo u pasa (kopacz trzyma kilof w ręku tylko przy złożu)
      // magowie i kaznodzieja nie noszą kilofa ani maczugi (pula narzędzi tylko dokłada, więc nie wolno ich nawet wstawić)
      const stowed = !robed && !fighting && (!(mining && weapon === 'pick') || pickOnBack);
      if (stowed) {
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armS.copy(t.matrix).scale(this.armV.setScalar(sz));
        (weapon === 'pick' ? this.backPicks : this.beltClubs).setMatrixAt(i, this.armS);
        (weapon === 'pick' ? this.beltClubs : this.backPicks).setMatrixAt(i, ZERO);
      } else { this.backPicks.setMatrixAt(i, ZERO); this.beltClubs.setMatrixAt(i, ZERO); }
      const wood = u.carryRes === WOOD;
      // kłodę ciągnie tylko drwal z lasu; włóczniarz niesie ze składu zwykłe deski
      const jb = u.job ? jobs.get(u.job) : undefined;
      const log = wood && u.phase === Phase.ToHome && !!jb && BUILDINGS[jb.type]!.production?.site === Terrain.Forest;
      this.buckets.setMatrixAt(i, u.bucket ? t.matrix : ZERO);
      this.bucketWater.setMatrixAt(i, u.bucket === 2 ? t.matrix : ZERO);
      if (torchOn) {
        // pochodnia w prawej dłoni, obracana w barku razem z uniesioną ręką (TORCH_ARM); płomień nad jej końcem
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(torchArm).setPosition(0.135, 0.45, 0);
        this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz)));
        this.handTorches.setMatrixAt(i, this.armM);
        this.pushHandFlameAt(this.armM, TORCH_TIP);
      } else this.handTorches.setMatrixAt(i, ZERO);
      const forkUp = rioting && !riotTorch && !fighting && u.carryRes < 0;
      if (forkUp) {
        // widły w prawej dłoni nad głową, obracane w barku razem z ręką
        const sz = this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888);
        this.armM.makeRotationX(forkArm).setPosition(0.135, 0.45, 0);
        this.forks.setMatrixAt(i, this.armM.premultiply(this.armS.copy(t.matrix).scale(this.armV.setScalar(sz))));
      } else this.forks.setMatrixAt(i, ZERO);
      // druga ręka buntownika: z pochodnią potrząsa pięścią nad głową, z widłami podpiera trzonek przed sobą
      const riotL = riotTorch ? -2.35 - shake * 0.35 : -1.1 + shake * 0.12;
      // uciekający w panice: długi, szybki krok i ręce machające nad głową
      const panic = (u.fled ?? 0) > g.tick && !still && !this.calm;
      const flail = panic ? Math.sin(this.time * 16 + u.id) * 0.6 : 0;
      // niosący ładunek trzyma go oburącz przed sobą przez cały czas: bez drapania się, machania i rozkładania rąk
      // (inaczej ręce opadały, a kosz czy blok wisiał sam w powietrzu)
      const carrying = u.carryRes >= 0 && !log && !hammering && !planting && !chopping && !mining && !fighting && !crafting;
      const iaArm = carrying ? undefined : ia?.arm;
      // deski niesie na prawym ramieniu: prawa ręka w górze przytrzymuje wiązkę, lewa macha jak przy chodzie
      const [carryR, carryL] = carryArms(wood || (u.carryRes >= 0 && ON_SHOULDER.has(RESOURCES[u.carryRes] ?? '')), swing);
      const wave = waving && !carrying, flee = panic && !carrying;
      const mage = u.job && !u.enlist ? mageKindOf(jobs.get(u.job)?.type ?? -1) : undefined;
      const preacher = !mage && !!u.job && BUILDINGS[jobs.get(u.job)?.type ?? -1]?.id === 'shrine';
      if (mage) this.drawMage(g, u, t, mage, swing, heading, view, jobs);
      else if (preacher) {
        // w kazaniu wznosi ręce co kilka sekund (ku posągowi Ojca Płomienia), poza nim chodzi i stoi jak zwykle
        const up = this.sermon && !this.calm && Math.floor(this.time / 2.6 + u.id) % 3 === 0;
        this.preacherFig.set(0, t.matrix, swing, up, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888, u.id);
        this.sermon = false;
      }
      else if (bier) {
        // ręce opuszczone przy biodrach, dłonie na końcach drągów: przedni trzyma je za sobą, tylny przed sobą
        const tc = TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888;
        const arm = u.phase === Phase.Bearing ? -BIER_ARM : BIER_ARM;
        this.figures.set(i, t.matrix, swing, false, tc, u.id, arm, arm, true);
        this.bierPose.set(u.id, [t.position.x, t.position.y, t.position.z, heading, this.figures.sizeOf(u.id, tc)]);
      }
      else this.figures.set(i, t.matrix, panic ? swing * 1.5 : ia?.legs ? ia.legs : swing, !(u.carryRes >= 0 && !log) && !!ia?.up, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888, u.id, carrying ? carryR : hammering || planting ? work : chopping || mining ? toolArm : fighting ? fightArm : crafting ? craftR : flee ? -2.5 + flail : wave ? -2.55 + Math.sin(this.time * 14) * 0.35 : fishing ? FISH_ARM : forkUp ? forkArm : torchOn ? torchArm : u.bucket ? 0 : iaArm, carrying ? carryL : rioting && !fighting ? riotL : planting ? work + 0.08 : drawing >= 0 ? (drawing < PICK_GRAB ? -0.5 : -0.5 + ((drawing - PICK_GRAB) / (1 - PICK_GRAB)) * (toolArm + 0.5)) : chopping || mining ? toolArm : fighting ? (weapon === 'pick' ? fightArm + 0.1 : -0.6) : crafting ? craftL : flee ? -2.5 - flail : wave ? -swing * 0.8 : fishing ? FISH_ARM + 0.15 : ia ? (ia.armL ?? 0.05) : -0.5, carrying || flee || wave || torchOn || forkUp || rioting || (!!u.bucket && walking) || !!ia?.legs, undefined, drawing >= 0 ? (drawing < PICK_GRAB ? 0 : TWO_HAND * (drawing - PICK_GRAB) / (1 - PICK_GRAB)) : chopping || mining ? TWO_HAND : 0);
      if (u.bucket) this.fireCrew(g, u, i, t, view, jobs, heading, still && cv.speed <= 0.3, alpha);
      // z lasu do chaty niesie kłodę, z chaty do składu gotowe deski
      // ciągnie odmianę, którą ściął (po wczytaniu zapisu w trakcie drogi: stała odmiana dla ludzika)
      const logKind = log ? this.felled.get(u.id) ?? this.logKindFor(u.id) : null;
      t.scale.setScalar(FIG);
      t.updateMatrix();
      // tylko niesione bale trafiają do swojej odmiany (wcześniej każda z odmian liczyła wszystkich chłopów z bryłą
      // ściśniętą do zera — karta przeliczała ok. 400 tys. pustych trójkątów na klatkę, pomiar 28.10.2026)
      if (logKind) { const pair = this.logs.get(logKind), c = this.logN.get(logKind) ?? 0; if (pair) { for (const m of pair) m.setMatrixAt(c, t.matrix); this.logN.set(logKind, c + 1); } }
      // bruzda w śniegu za ciągniętym pniem: koniec pnia szoruje po ziemi za plecami drwala
      if (logKind && walking) { const bx = cv.sx - Math.sin(heading) * 0.38, by = cv.sy - Math.cos(heading) * 0.38; this.drags.set(u.id, [bx, by, this.standY(view, bx, by, -2), 0]); }
      // pień do obróbki leży przed rąbiącym w poprzek; w miarę cięcia skraca się (odcięte kawałki idą w deski przy pniaku)
      const groundKind = limbing ? this.felled.get(u.id) ?? this.logKindFor(u.id) : null;
      if (groundKind) {
        const yaw = t.rotation.y, left = Math.max(0, Math.min(1, (u.timer - (this.calm ? 0 : alpha)) / PROCESS_TICKS));
        this.groundP.set(t.position.x + Math.sin(yaw) * 0.5, view.heightAt(t.position.x + Math.sin(yaw) * 0.5 + width / 2, t.position.z + Math.cos(yaw) * 0.5 + height / 2), t.position.z + Math.cos(yaw) * 0.5);
        this.groundQ.setFromAxisAngle(Y_AXIS, yaw + Math.PI / 2);
        this.groundM.compose(this.groundP, this.groundQ, this.groundS.set(FIG * (0.35 + 0.65 * left), FIG, FIG));
      }
      if (groundKind) { const m = this.groundLogs.get(groundKind), c = this.groundN.get(groundKind) ?? 0; if (m) { m.setMatrixAt(c, this.groundM); this.groundN.set(groundKind, c + 1); } }
      t.scale.setScalar(wood && !log ? FIG : 0);
      t.updateMatrix();
      this.planks.setMatrixAt(i, t.matrix);
      // każdy surowiec ma własny wygląd: kosz jabłek, bochenki, snop, worek, blok, sztaby;
      // skala jak postać (ludzie są różnego wzrostu), żeby ładunek trafiał w dłonie i u niskiego, i u wysokiego
      const loadSz = u.carryRes >= 0 ? this.figures.sizeOf(u.id, TEAM_COLORS[g.players[u.owner]?.team ?? 0] ?? 0x888888) : 1;
      const loadMesh = u.carryRes >= 0 && u.carryRes !== CORPSE_LOAD ? this.loads.get(u.carryRes) : undefined; // ciało jedzie w trumnie (drawCoffins)
      if (loadMesh) {
        const j = loadUsed.get(u.carryRes) ?? 0;
        loadUsed.set(u.carryRes, j + 1);
        t.scale.setScalar(FIG * loadSz);
        t.updateMatrix();
        loadMesh.setMatrixAt(j, t.matrix);
      }
      // pochylenie i kołysanie zerujemy dopiero po ładunkach: kłoda, deski i kosz liczą się z tym samym obrotem co tułów
      // (wcześniej obrót zerował się razem z kierunkiem i ładunek trafiał w bok, nie w dłonie)
      if (lean || roll) { t.rotation.set(0, 0, 0); t.rotation.order = 'XYZ'; }
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
    // wozy z surowcami dla sojusznika: chłop idzie z przodu i ciągnie dwukółkę za dyszle (model z tools/models/yard.py)
    const seenCarts = new Set<number>();
    for (const c of g.caravans ?? []) {
      if (k >= MAX_UNITS) break;
      const prev = this.prevPos.get(c.id);
      const fx = (prev ? prev[0] + (c.px - prev[0]) * alpha : c.px) / FP;
      const fy = (prev ? prev[1] + (c.py - prev[1]) * alpha : c.py) / FP;
      let st = this.strides.get(c.id);
      if (!st) { st = { x: fx, y: fy, phase: c.id }; this.strides.set(c.id, st); }
      const moved = Math.hypot(fx - st.x, fy - st.y);
      st.phase += Math.min(0.5, moved) * 7.5;
      st.x = fx; st.y = fy;
      // kierunek wygładzony (na zakrętach wóz nie obraca się skokiem)
      const want = c.tx || c.ty ? Math.atan2(c.tx / FP - fx, c.ty / FP - fy) : 0;
      let cart = this.carts.get(c.id);
      if (!cart) { cart = { obj: yardModel('handcart'), heading: want }; cart.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); this.scene.add(cat(cart.obj, 'wozy z surowcami')); this.carts.set(c.id, cart); }
      let d = want - cart.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      cart.heading += d * Math.min(1, this.frameDt * 6);
      seenCarts.add(c.id);
      const sx = Math.sin(cart.heading), sz = Math.cos(cart.heading);
      // wóz za plecami chłopa (dyszle sięgają mu do rąk)
      const cx = fx - sx * 0.3, cy = fy - sz * 0.3;
      const cyH = view.heightAt(cx, cy);
      cart.obj.position.set(cx - width / 2, cyH, cy - height / 2);
      // koleiny w śniegu po kołach dwukółki i ślady chłopa, który ją ciągnie
      if (moved > 1e-4) { this.drags.set(c.id, [cx, cy, cyH, 1]); this.feet.set(c.id + 0x40000000, [fx, fy, view.heightAt(fx, fy)]); }
      cart.obj.rotation.set(0, cart.heading, 0);
      cart.obj.visible = true;
      if (this.cartIcons >= 0 && c.owner === this.cartIcons) {
        cart.icon ??= this.cartIcon();
        // stała wielkość na ekranie, żeby wóz było widać także z wysoka; lekko pulsuje
        const dist = this.cam.camera.position.distanceTo(cart.obj.position);
        const sc = Math.max(1, dist * 0.045) * (1 + Math.sin(this.time * 4) * 0.06);
        cart.icon.scale.set(sc, sc, 1);
        cart.icon.position.set(cx - width / 2, cyH + 1.4 + sc * 0.5, cy - height / 2);
        cart.icon.visible = true;
      } else if (cart.icon) cart.icon.visible = false;
      const px = fx + sx * 0.1, py = fy + sz * 0.1;
      const y = view.heightAt(px, py);
      t.position.set(px - width / 2, y + (this.calm ? 0 : Math.abs(Math.cos(st.phase)) * 0.02), py - height / 2);
      t.rotation.set(0.1, cart.heading, 0, 'YXZ'); // pochylony, ciągnie
      t.scale.setScalar(FIG);
      t.updateMatrix();
      this.figures.set(k, t.matrix, this.calm ? 0 : Math.sin(st.phase) * 0.45, false, TEAM_COLORS[g.players[c.owner]?.team ?? 0] ?? 0x888888, c.id);
      k++;
    }
    for (const [id, cart] of this.carts) if (!seenCarts.has(id)) { if (cart.icon) { this.scene.remove(cart.icon); cart.icon.material.dispose(); } this.scene.remove(cart.obj); cart.obj.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); this.carts.delete(id); }
    this.drawCoffins(g);
    this.drawSappers(loadUsed);
    k = this.castleFolk(g, k);
    this.figures.finish(k);
    this.magesFireFig.finish(0);
    this.preacherFig.finish(0);
    this.magesWaterFig.finish(0);
    this.drawSickIcons(g, view);
    // pule narzędzi: `count` zamyka klatkę (liczba bez znaczenia) i same oznaczają swoje bufory
    for (const p of [this.rods, this.bedrolls, this.hammers, this.spades, this.axes, this.picks, this.clubs, this.forks, this.backPicks, this.beltClubs, this.handTorches, this.buckets, this.bucketWater]) p.count = n;
    this.fireFx.end(this.calm ? 0 : Math.min(0.05, this.frameDt), (x, z) => this.standY(view, x + width / 2, z + height / 2));
    for (const [res, m] of this.loads) {
      m.count = loadUsed.get(res) ?? 0;
      touch(m);
    }
    this.planks.count = n;
    touch(this.planks);
    for (const [k, pair] of this.logs) for (const m of pair) { m.count = this.logN.get(k) ?? 0; touch(m); }
    for (const [k, m] of this.groundLogs) { m.count = this.groundN.get(k) ?? 0; touch(m); }
    this.logN.clear(); this.groundN.clear();
  }

  private resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.sharpenTexel();
    this.cam.resize(w, h);
    this.aoRes();
  }
  /** Wyostrzenie liczy sąsiednie piksele, więc musi znać wielkość obrazu */
  private sharpenTexel(): void {
    if (!this.sharpen) return;
    const r = this.renderer.getPixelRatio();
    (this.sharpen.uniforms.texel!.value as THREE.Vector2).set(1 / Math.max(1, this.canvas.clientWidth * r), 1 / Math.max(1, this.canvas.clientHeight * r));
  }

  /**
   * Jakość obrazu z ustawień: wygładzanie krawędzi, filtrowanie tekstur, odbicia otoczenia i wyostrzenie.
   * MSAA trzeba włączyć w buforach, do których rysuje się scena: w buforze AO (n8ao rysuje tam scenę sam), a bez AO
   * w buforach składania obrazu — samo antialias: true przy tworzeniu renderera nic nie daje, gdy obraz idzie przez composer.
   */
  private imageQuality(aa: AaMode, aniso: number, reflections: boolean, sharpen: number): void {
    const max = (this.renderer.capabilities as unknown as { maxSamples?: number }).maxSamples ?? 4;
    const samples = Math.min(msaaSamples(aa), max);
    const aoOn = this.ao.enabled;
    const key = samples * 2 + (aoOn ? 1 : 0);
    if (key !== this.msaa) {
      this.msaa = key;
      // z AO scena rysuje się tylko do bufora n8ao; bufory składania dostają MSAA tylko bez AO (inaczej to zbędny koszt)
      const want = (t: THREE.WebGLRenderTarget, n: number): void => { if (t.samples !== n) { t.samples = n; t.dispose(); } }; // nowy bufor powstanie przy następnej klatce
      want(this.ao.beautyRenderTarget, samples);
      want(this.composer.renderTarget1, aoOn ? 0 : samples);
      want(this.composer.renderTarget2, aoOn ? 0 : samples);
    }
    this.fxaa.enabled = aa === 'fxaa';
    this.smaa.enabled = aa === 'smaa';
    this.sharpen.enabled = sharpen > 0;
    this.sharpen.uniforms.amount!.value = sharpen;
    this.sharpenTexel();
    this.envOn = reflections;
    this.scene.environment = reflections ? this.envTex : null;
    this.matQ.set(aniso, samples > 0);
    this.matQ.sweep(this.scene);
  }

  private aoMode = 'medium';
  /**
   * Cienie w zakamarkach (AO) liczone w połowie rozdzielczości i rozciągane z poszanowaniem krawędzi (depthAwareUpsampling):
   * na niższych jakościach zawsze, na wysokiej — przy dużym obrazie (ultrapanorama, 4K), gdzie różnicy nie widać, a karta
   * liczy czterokrotnie mniej pikseli. Pełna rozdzielczość zostaje tylko na wysokiej jakości przy zwykłym ekranie.
   */
  private aoRes(): void {
    if (!this.ao) return;
    const px = this.canvas.clientWidth * this.canvas.clientHeight * this.renderer.getPixelRatio() ** 2;
    const half = this.aoMode !== 'high' || px > 3.2e6;
    if (this.ao.configuration.halfRes !== half) this.ao.configuration.halfRes = half;
  }

  /** Zaznacza chłopa: pierścień chodzi za nim. 0 zdejmuje zaznaczenie. */
  setUnitSelection(id: number): void { this.selectedUnit = id; if (id) this.selectedId = 0; else if (!this.selectedId) this.selection.visible = false; }

  /**
   * Chłop pod kursorem (współrzędne ekranu jak w zdarzeniu myszy), tylko z tych, które przepuści `ok` — promień z kamery
   * jak przy klikaniu w chłopa, więc trafia w całą sylwetkę przy każdym zbliżeniu (wskazywanie wroga do ataku)
   */
  unitAt(clientX: number, clientY: number, ok: (id: number) => boolean): number {
    if (!this.view) return 0;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    let best = 0, bestD = 0.35;
    const p = new THREE.Vector3();
    for (const u of this.unitSpots) {
      if (!ok(u.id)) continue;
      // najbliższy punkt sylwetki od stóp po głowę, nie jeden punkt w pasie
      const y0 = this.unitY.get(u.id) ?? 0;
      for (const h of [0.12, 0.33, 0.55]) {
        const d = this.ray.ray.distanceToPoint(p.set(u.x, y0 + h, u.z));
        if (d < bestD) { bestD = d; best = u.id; }
      }
    }
    return best;
  }

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

  private hoverPickAt = 0;
  private hoverPicked: TileRef | null = null;

  private pickBuilding(e: PointerEvent): TileRef | null {
    if (!this.state) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam.camera);
    this.ray.layers.enable(BATCH_LAYER); // stałe bryły budynków rysowane razem leżą na osobnej warstwie (kliknięcie dalej je trafia)
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

/** Grubość płyty łąki w modelu sadu (FLOOR w tools/models/orchard.py) */
const ORCHARD_FLOOR = 0.05;
/** Pole mapy, na którym stoi szopa sadu (lewy tylny róg modelu, obrócony razem z budynkiem o rot·90°) */
/**
 * Strzała w budynek trafia w jego ścianę, a nie w środek działki: punkt, w którym lot wchodzi w bryłę działki
 * (zwężonej, bo model zwykle nie sięga jej brzegów). `aim` zostaje przesunięty na to miejsce.
 */
function wallFace(b: { x: number; y: number; type: number; rot: number }, from: THREE.Vector3, aim: THREE.Vector3, width: number, height: number, view: TerrainView): void {
  const fp = footprint(BUILDINGS[b.type]!, b.rot), IN = 0.3;
  const x0 = b.x + IN - width / 2, x1 = b.x + fp.w - IN - width / 2, z0 = b.y + IN - height / 2, z1 = b.y + fp.h - IN - height / 2;
  const d = new THREE.Vector3().subVectors(aim, from);
  let t0 = 0, t1 = 1;
  for (const [o, v, lo, hi] of [[from.x, d.x, x0, x1], [from.z, d.z, z0, z1]] as const) {
    if (Math.abs(v) < 1e-6) { if (o < lo || o > hi) return; continue; }
    let a = (lo - o) / v, c = (hi - o) / v;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
  }
  if (t0 <= 0 || t0 > t1) return; // strzelec w środku albo lot nie przechodzi przez działkę
  aim.addScaledVector(d, t0 - 1);
  // nie niżej niż tuż nad ziemią pod ścianą
  aim.y = Math.max(aim.y, view.heightAt(aim.x + width / 2, aim.z + height / 2) + 0.15);
}

function orchardShedTile(bx: number, by: number, rot: number): [number, number] {
  const a = (rot * Math.PI) / 2, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  // środek szopy w modelu ≈ (-1, -1) pole od środka; obrót jak mesh.rotation.y: x' = x·cos + z·sin, z' = -x·sin + z·cos
  const dx = -c - sn, dz = sn - c;
  return [bx + 1 + dx, by + 1 + dz];
}

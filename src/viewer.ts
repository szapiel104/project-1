/**
 * Podgląd modeli (modele.html): jeden model na kamiennej podstawce, w powietrzu albo na trawie, w zwykłym świetle
 * i w pełnej jakości (zdjęciowe tekstury, miękkie cienie, odbicia otoczenia). Kamerą obraca się myszą dookoła.
 * Do sprawdzania nowych i zmienionych modeli bez uruchamiania gry: modele.html?id=tavern (&tlo=powietrze|trawa, &noc=1).
 * Budynki mają też daleką wersję (przycisk „Z daleka”, &daleko=1..3): ta sama bryła uproszczona tak, jak gra rysuje ją z oddali.
 */
import * as THREE from 'three';
import { Standards } from './render/standards';
import { defaultCrest } from './render/banners';
import { propGeometry, propMaterial } from './render/props';
import { initKtx } from './render/ktx';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BUILDINGS } from './data/buildings';
import { RESOURCES } from './data/resources';
import { carryArms, loadGeometry, loadMaterials, ON_SHOULDER, plankBundle } from './render/loads';
import { lang, t, tx } from './i18n';
import { buildingModel, isWetMat, isWindowMat, mineLevelModel, setNight, tickBuildingWater, towerDoorKit } from './render/buildings';
import { createThumbs } from './ui/viewerThumbs';
import { attachLod, lodReady, prepareLod, showLod, type BuildingLod } from './render/lod';
import { partsGeometry, toolGeometry, toolMaterials } from './render/gear';
import { proceduralModels } from './render/models';
import { fernTexture, leafTexture, needleTexture } from './render/foliage';
import { bushKinds, treeKinds, waterPlants } from './render/forest';
import { rockMaterial, rocks0ad } from './render/rocks0ad';
import { desertPlants, plantMaterial } from './render/desert0ad';
import { model } from './render/modelstore';
import { clutterObject } from './render/clutter';
import { crowParts } from './render/creatures';
import { YARD_KEYS, yardModel } from './render/family';
import { graveModel } from './render/graves';
import { Figures, idWithHead, type FigureKind } from './render/peasants';
import { normal, pattern } from './render/textures';
import { HORSE_MORPH, horseObject } from './render/horse';
import { faunaAnimated } from './render/fauna';
import { watchRenderer } from './debug/errlog';
import { createRenderer } from './render/glcontext';
import { createMenuBar } from './ui/menuBar';
import { createViewerAccount } from './ui/viewerAccount';
import { icon } from './ui/editorIcons';
import { createNightLights } from './ui/viewerLights';
import { createModelEditor } from './ui/modelEditor';
const RAM_MODEL = model('ram');

const RED = 0xa32a22;
declare const __BUILD__: string;
type Make = () => { obj: THREE.Object3D; size?: THREE.Vector3 };
const vc = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material = vc()): THREE.Mesh => new THREE.Mesh(g, m);

/** Postać z instancjonowanych części gry, w kontenerze (żeby dało się ją usunąć ze sceny) */
function figure(kind: FigureKind, id: number, h = 0.64, up = false): Make {
  return () => {
    const holder = new THREE.Scene();
    Figures.FAR2 = 1e9;
    const f = new Figures(1, holder, kind);
    f.set(0, new THREE.Matrix4(), 0, up, RED, id);
    f.finish(1);
    return { obj: holder, size: new THREE.Vector3(0.3, h, 0.2) };
  };
}
/** Chłop niosący ładunek: ta sama poza rąk i to samo położenie ładunku co w grze (loads.ts) */
function carrier(res: string): Make {
  return () => {
    const holder = new THREE.Scene();
    Figures.FAR2 = 1e9;
    const id = 3;
    const f = new Figures(1, holder, 'peasant');
    const planks = res === 'planks';
    const [r, l] = carryArms(planks || ON_SHOULDER.has(res), 0);
    f.set(0, new THREE.Matrix4(), 0, false, RED, id, r, l, true);
    f.finish(1);
    const geo = planks ? plankBundle() : loadGeometry(res);
    if (geo) {
      const m = new THREE.Mesh(geo, loadMaterials(geo));
      m.scale.setScalar(f.sizeOf(id, RED));
      holder.add(m);
    }
    return { obj: holder, size: new THREE.Vector3(0.3, 0.64, 0.3) };
  };
}
/** Koń z 0 A.D. (render/horse.ts) w pozie: base, graze (skubie), look (czujny), swish (ogon w bok) */
function horse(pose?: keyof typeof HORSE_MORPH): THREE.Object3D {
  const g = horseObject();
  if (pose) for (const m of g.children as THREE.Mesh[]) { m.updateMorphTargets(); m.morphTargetInfluences![HORSE_MORPH[pose]] = 1; }
  return g;
}

/** Narzędzie z Blendera (tools/models/tools.py): z lewej pełna wersja, z prawej daleka (lżejsza) — do porównania */
const WATER_MAT = new THREE.MeshStandardMaterial({ color: 0x4f8fb8, roughness: 0.2, metalness: 0.1 });
function toolPair(name: string): Make {
  return () => {
    const g = new THREE.Group();
    const mats = name === 'bucketWater' ? [WATER_MAT, WATER_MAT, WATER_MAT] : toolMaterials();
    const near = new THREE.Mesh(toolGeometry(name), mats);
    const far = new THREE.Mesh(toolGeometry(name + 'Far'), mats);
    // dno wiadra z wodą: woda w wiadrze, żeby było widać, gdzie leży
    if (name === 'bucket') for (const [m, n] of [[near, 'bucketWater'], [far, 'bucketWaterFar']] as const) m.add(new THREE.Mesh(toolGeometry(n), [WATER_MAT, WATER_MAT, WATER_MAT]));
    // każde narzędzie przesunięte tak, żeby jego dół stał na podstawce, i dwa razy większe (są drobne)
    const holder = new THREE.Group();
    for (const [m, x] of [[near, -0.3], [far, 0.3]] as const) {
      const box = new THREE.Box3().setFromObject(m);
      const c = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      m.position.set(-c.x, -box.min.y, -c.z);
      wrap.add(m);
      wrap.scale.setScalar(2);
      wrap.position.x = x;
      holder.add(wrap);
    }
    g.add(holder);
    const box = new THREE.Box3().setFromObject(g);
    return { obj: g, size: box.getSize(new THREE.Vector3()) };
  };
}

/** Chłop przy pracy z narzędziem — ta sama poza ręki i to samo przypięcie narzędzia co w grze (scene.ts):
 *  narzędzia ręczne obracają się w barku (0,135; 0,45) razem z prawą ręką, pochodnia, wiadro i wędka są w układzie postaci */
function worker(tool: string, arm: number, hand: boolean, extra?: string, grip = 0): Make {
  return () => {
    const holder = new THREE.Scene();
    Figures.FAR2 = 1e9;
    const id = 3;
    const f = new Figures(1, holder, 'peasant');
    f.set(0, new THREE.Matrix4(), 0, false, RED, id, hand ? arm : tool === 'bucket' ? 0 : undefined, tool === 'rod' ? arm + 0.15 : grip ? arm : -0.5, false, undefined, grip);
    f.finish(1);
    const sz = f.sizeOf(id, RED);
    const mats = toolMaterials();
    const add = (name: string, m: THREE.Material[] = mats): void => {
      const mesh = new THREE.Mesh(toolGeometry(name), m);
      if (hand) mesh.applyMatrix4(new THREE.Matrix4().makeScale(sz, sz, sz).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(arm, 0, -grip)).setPosition(0.135, 0.45, 0)));
      holder.add(mesh);
    };
    add(tool);
    if (extra) add(extra, [WATER_MAT, WATER_MAT, WATER_MAT]);
    return { obj: holder, size: new THREE.Vector3(0.5, 0.7, 0.5) };
  };
}

/** Myśliwy celuje z łuku (scene.ts: BOW_ARM, BOW_DRAW): łuk w lewej dłoni, prawa naciąga cięciwę */
function archerPeasant(): Make {
  return () => {
    const holder = new THREE.Scene();
    Figures.FAR2 = 1e9;
    const id = 3;
    const f = new Figures(1, holder, 'peasant');
    f.set(0, new THREE.Matrix4(), 0, false, RED, id, -1.75, -1.45, false);
    f.finish(1);
    const sz = f.sizeOf(id, RED);
    const mesh = new THREE.Mesh(toolGeometry('bow'), toolMaterials());
    mesh.applyMatrix4(new THREE.Matrix4().makeScale(sz, sz, sz).multiply(new THREE.Matrix4().makeRotationX(-1.45).setPosition(-0.135, 0.45, 0)));
    holder.add(mesh);
    return { obj: holder, size: new THREE.Vector3(0.5, 0.7, 0.5) };
  };
}

/** Krzak albo głaz z Blendera (tools/models/plants.py): z lewej z bliska, z prawej z daleka; barwa jak w grze */
function plantPair(near: THREE.BufferGeometry, far: THREE.BufferGeometry, color: number, tex: 'leaves' | 'rock', flat: boolean): Make {
  return () => {
    const mat = new THREE.MeshStandardMaterial({ color, vertexColors: true, flatShading: flat, roughness: 0.95, map: pattern(tex), normalMap: normal(tex) });
    const g = new THREE.Group();
    const a = new THREE.Mesh(near, mat), b = new THREE.Mesh(far, mat);
    a.position.x = -0.45; b.position.x = 0.45;
    g.add(a, b);
    return { obj: g, size: new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()) };
  };
}

/** Drzewo z Blendera: pień z korą i korona z kart (igliwie / liście z przezroczystością), w barwach z gry */
function treeMake(trunk: THREE.BufferGeometry, crown: THREE.BufferGeometry, crownTex: THREE.Texture, trunkCol: number, crownCol: number): Make {
  return () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(trunk, new THREE.MeshStandardMaterial({ color: trunkCol, vertexColors: true, roughness: 0.95, map: pattern('bark'), normalMap: normal('bark') })));
    g.add(new THREE.Mesh(crown, new THREE.MeshStandardMaterial({ color: crownCol, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, map: crownTex, alphaTest: 0.5 })));
    g.scale.set(1.25, 1.6, 1.25); // jak w grze (dorosłe drzewo)
    return { obj: g, size: new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()) };
  };
}

/** Wszystkie modele w grupach: [grupa, [id, podpis, budowa]] */
const GROUPS: [string, [string, string, Make][]][] = [
  [tx('Budynki', 'Buildings'), BUILDINGS.filter((d) => !d.road).map((d) => [d.id, t(d.name), () => {
    const m = buildingModel(d.id, RED);
    const base = m.getObjectByName('base'); if (base) base.visible = false;
    return { obj: m };
  }] as [string, string, Make]).concat([['minelevel', tx('Kopalnia — wnętrze (sztolnia)', 'Mine — inside (the shaft)'), () => ({ obj: mineLevelModel() })]])],
  [tx('Ludzie', 'People'), [
    ['peasant', tx('Chłop', 'Peasant'), figure('peasant', 3)],
    ['woman', tx('Gospodyni (chusta)', 'Goodwife (headscarf)'), figure('woman', idWithHead((h) => h % 2 === 0))],
    ['woman2', tx('Gospodyni (kok)', 'Goodwife (bun)'), figure('woman', idWithHead((h) => h % 2 === 1))],
    ['child', tx('Dziecko', 'Child'), figure('child', idWithHead((h) => h !== 2), 0.42)],
    ['child2', tx('Dziecko (czapka)', 'Child (cap)'), figure('child', idWithHead((h) => h === 2), 0.42)],
    ['spearman', t('u.spearman'), figure('spearman', 4)],
    ['archer', t('u.archer'), figure('archer', 5)],
    ['guard', tx('Strażnik', 'Guard'), figure('guard', 6)],
    ['manatarms', tx('Zbrojny', 'Man-at-arms'), figure('manatarms', 6)],
    ['sapper', t('u.sapper'), figure('sapper', 7)],
    ['bandit', t('u.bandit'), figure('bandit', 8)],
    ['mageFire', tx('Mag Płomienia', 'Mage of the Flame'), figure('mageFire', 9)],
    ['mageWater', tx('Mag Źródła', 'Mage of the Spring'), figure('mageWater', 10)],
    ['mageFire-cast', tx('Mag Płomienia — czar', 'Mage of the Flame — casting'), figure('mageFire', 9, 0.64, true)],
    ['mageWater-cast', tx('Mag Źródła — czar', 'Mage of the Spring — casting'), figure('mageWater', 10, 0.64, true)],
    ['preacher', tx('Kaznodzieja', 'Preacher'), figure('preacher', 11)],
    ['preacher-sermon', tx('Kaznodzieja — kazanie', 'Preacher — sermon'), figure('preacher', 11, 0.64, true)],
    ['standard', tx('Chorąży z proporcem', 'Standard-bearer'), () => {
      // włócznik z drzewcem i proporcem na plecach, tak jak chorąży w oddziale (src/render/standards.ts)
      const holder = new THREE.Scene();
      Figures.FAR2 = 1e9;
      const f = new Figures(1, holder, 'spearman');
      f.set(0, new THREE.Matrix4(), 0, false, RED, 4);
      f.finish(1);
      const st = new Standards(holder);
      st.begin(); st.add(new THREE.Matrix4(), 0, RED, defaultCrest(0)); st.finish();
      return { obj: holder, size: new THREE.Vector3(0.5, 1.2, 0.5) };
    }],
    ['king', tx('Pan zamku', 'Lord of the castle'), figure('king', 7)],
  ]],
  [tx('Niosą', 'Carrying'), [
    ['carry-planks', tx('deski', 'planks'), carrier('planks')],
    ...RESOURCES.filter((r) => r !== 'wood' && r !== 'gold').map((r) => [`carry-${r}`, t(`res.${r}`), carrier(r)] as [string, string, Make]),
  ]],
  [tx('Zwierzęta', 'Animals'), [
    ['hen', tx('Kura', 'Hen'), () => ({ obj: faunaAnimated('hen', 'idle') })],
    ['hen-walk', tx('Kura idzie', 'Hen, walking'), () => ({ obj: faunaAnimated('hen', 'walk'), size: new THREE.Vector3(0.5, 0.15, 0.5) })],
    ['pig', tx('Świnia', 'Pig'), () => ({ obj: faunaAnimated('pig', 'idle') })],
    ['pig-walk', tx('Świnia idzie', 'Pig, walking'), () => ({ obj: faunaAnimated('pig', 'walk'), size: new THREE.Vector3(1.5, 0.35, 1.5) })],
    ['horse', tx('Koń', 'Horse'), () => ({ obj: horse() })],
    ['camel', tx('Wielbłąd', 'Camel'), () => ({ obj: faunaAnimated('camel', 'idle') })],
    ['camel-walk', tx('Wielbłąd idzie', 'Camel, walking'), () => ({ obj: faunaAnimated('camel', 'walk'), size: new THREE.Vector3(2.6, 0.9, 2.6) })],
    ['deer', tx('Jeleń', 'Deer'), () => ({ obj: faunaAnimated('deer', 'idle') })],
    ['deer-walk', tx('Jeleń idzie', 'Deer, walking'), () => ({ obj: faunaAnimated('deer', 'walk'), size: new THREE.Vector3(1.6, 0.6, 1.6) })],
    ['boar', tx('Dzik', 'Wild boar'), () => ({ obj: faunaAnimated('boar', 'idle') })],
    ['boar-walk', tx('Dzik idzie', 'Wild boar, walking'), () => ({ obj: faunaAnimated('boar', 'walk'), size: new THREE.Vector3(1.8, 0.5, 1.8) })],
    ['fox', tx('Lis', 'Fox'), () => ({ obj: faunaAnimated('fox', 'idle') })],
    ['fox-walk', tx('Lis idzie', 'Fox, walking'), () => ({ obj: faunaAnimated('fox', 'walk'), size: new THREE.Vector3(1.1, 0.3, 1.1) })],
    ['rabbit', tx('Zając', 'Hare'), () => ({ obj: faunaAnimated('rabbit', 'idle') })],
    ['rabbit-walk', tx('Zając kica', 'Hare, hopping'), () => ({ obj: faunaAnimated('rabbit', 'walk'), size: new THREE.Vector3(0.4, 0.15, 0.4) })],
    ['horse-graze', tx('Koń skubie trawę', 'Horse, grazing'), () => ({ obj: horse('graze') })],
    ['horse-look', tx('Koń czujny', 'Horse, alert'), () => ({ obj: horse('look') })],
    ['dog', tx('Pies', 'Dog'), () => ({ obj: faunaAnimated('dog', 'idle') })],
    ['dog-walk', tx('Pies idzie', 'Dog, walking'), () => ({ obj: faunaAnimated('dog', 'walk'), size: new THREE.Vector3(1.4, 0.35, 1.4) })],
    ['wolf', tx('Wilk', 'Wolf'), () => ({ obj: faunaAnimated('wolf', 'idle') })],
    ['wolf-walk', tx('Wilk idzie', 'Wolf, walking'), () => ({ obj: faunaAnimated('wolf', 'walk'), size: new THREE.Vector3(1.6, 0.4, 1.6) })],
    ['crow', tx('Kruk', 'Raven'), () => ({ obj: mesh(crowParts().stand, crowParts().mat) })],
    ['crow-fly', tx('Kruk w locie', 'Raven in flight'), () => ({ obj: mesh(crowParts().fly[1]!, crowParts().mat) })],
  ]],
  [tx('Machiny', 'Siege engines'), [
    ['ram', 'Taran', () => {
      const g = new THREE.Group();
      const mats = ['wood', 'woodDark', 'sack', 'iron'];
      const col = { wood: 0x8a6440, woodDark: 0x5e4329, sack: 0xb39a72, iron: 0x6a6e76 };
      const mm = [
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: pattern('planks'), normalMap: normal('planks') }),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks'), normalMap: normal('planks') }),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('burlap'), normalMap: normal('burlap') }),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 }),
      ];
      for (const grp of ['body', 'beam']) g.add(new THREE.Mesh(partsGeometry(RAM_MODEL as unknown as { q: number } & Record<string, unknown>, grp, mats, col), mm));
      return { obj: g };
    }],
  ] as [string, string, Make][]],
  [tx('Roślinność i kamienie', 'Plants and rocks'), [
    ...treeKinds().map((k): [string, string, Make] => [`tree-${k.name}`, `${k.name.replace(/_/g, ' ')} (Poly Haven)`, () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(k.trunk, k.barkMat), new THREE.Mesh(k.cards, k.cardMat));
      return { obj: g };
    }]),
    ['tree-pine', tx('świerk (stary)', 'spruce (old)'), treeMake(proceduralModels.treeTrunk(), proceduralModels.treeCrown(), needleTexture(), 0x6b4a2e, 0x3c7a3a)],
    ['tree-leaf', tx('drzewo liściaste (stare)', 'broadleaf tree (old)'), treeMake(proceduralModels.leafTrunk(), proceduralModels.leafCrown(), leafTexture(), 0x7a5a3a, 0x6fa33d)],
    ['plant-fern', tx('paproć', 'fern'), () => ({ obj: new THREE.Mesh(proceduralModels.fern(), new THREE.MeshStandardMaterial({ color: 0x5d8a34, side: THREE.DoubleSide, map: fernTexture(), alphaTest: 0.5 })) })],
    ['plant-deadwood', tx('opadła gałąź', 'fallen branch'), () => ({ obj: new THREE.Mesh(proceduralModels.deadwood(), new THREE.MeshStandardMaterial({ color: 0x6b5038, vertexColors: true, map: pattern('bark') })) })],
    // krzaki z Poly Haven (karty z bliska; obrazek z daleka obraca się do kamery tylko w grze); skala jak średni krzak w grze
    ...bushKinds().map((k): [string, string, Make] => [k.name.replace('pv_', '').replace(/_/g, '-'), tx(`krzak ${k.name.slice(-1)} (Poly Haven)`, `bush ${k.name.slice(-1)} (Poly Haven)`), () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(k.cards, k.cardMat));
      g.scale.setScalar(1.2);
      return { obj: g, size: new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()) };
    }]),
    // trzciny i kożuch liści z 0 A.D. (oryginalne siatki i tekstury); skala jak w grze
    ...[0, 1].map((i): [string, string, Make] => [`reeds-${i + 1}`, tx(`pałka wodna ${i + 1} (0 A.D.)`, `cattails ${i + 1} (0 A.D.)`), () => {
      const w = waterPlants();
      return { obj: new THREE.Mesh(w.reeds, new THREE.MeshStandardMaterial({ map: w.reedTex[i] ?? null, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })) };
    }]),
    ['lilies', tx('liście na stawie (0 A.D.)', 'pond leaves (0 A.D.)'), () => {
      const w = waterPlants();
      const m = new THREE.Mesh(w.lilies, new THREE.MeshStandardMaterial({ map: w.lilyTex, alphaTest: 0.35, roughness: 0.55 }));
      m.position.y = 0.01;
      return { obj: m, size: new THREE.Vector3(1.2, 0.1, 1.2) };
    }],
    ['plant-bush', tx('krzak (stary, z kul)', 'bush (old, spheres)'), plantPair(proceduralModels.bush(), proceduralModels.bushFar(), 0x4f8a36, 'leaves', false)],
    // głazy i skały z 0 A.D. (render/rocks0ad.ts) — te, które leżą na mapie
    ...rocks0ad().map((r): [string, string, Make] => [`rock-${r.name}`, tx(`skała 0 A.D.: ${r.name}`, `0 A.D. rock: ${r.name}`), () => ({ obj: new THREE.Mesh(r.geo, rockMaterial(r.tex)) })]),
    // roślinność pustyni z 0 A.D. (render/desert0ad.ts): palmy, uschnięte palmy, krzewy, trawy
    ...desertPlants().map((p): [string, string, Make] => [`desert-${p.name}`, tx(`pustynia 0 A.D.: ${p.name}`, `0 A.D. desert: ${p.name}`), () => ({ obj: new THREE.Mesh(p.geo, plantMaterial(p.tex[0]!)) })]),
    ...proceduralModels.boulders().map(([near, far], k) => [`plant-boulder${k}`, tx(`głaz polny ${k + 1} (z bliska | z daleka)`, `field boulder ${k + 1} (near | far)`), plantPair(near, far, 0x9a948a, 'rock', true)] as [string, string, Make]),
  ]],
  [tx('W pracy', 'At work'), [
    ['work-hammer', tx('budowniczy z młotkiem (zamach)', 'builder with hammer (swing)'), worker('hammer', -2.1, true)],
    ['work-hammer2', tx('budowniczy z młotkiem (uderzenie)', 'builder with hammer (strike)'), worker('hammer', -0.9, true)],
    ['work-axe', tx('drwal z siekierą (oburącz)', 'woodcutter with axe (two-handed)'), worker('axe', -2.0, true, undefined, 0.5)],
    ['work-pick', tx('kamieniarz z kilofem (oburącz)', 'stonecutter with pick (two-handed)'), worker('pick', -1.9, true, undefined, 0.5)],
    ['work-pick2', tx('kamieniarz z kilofem (cios)', 'stonecutter with pick (blow)'), worker('pick', -0.7, true, undefined, 0.5)],
    ['work-club', tx('chłop z maczugą', 'peasant with club'), worker('club', -1.4, true)],
    ['work-torch', tx('z pochodnią nocą', 'with torch at night'), worker('torch', -0.55, true)],
    ['work-fork', tx('buntownik z widłami', 'rioter with a pitchfork'), worker('fork', -2.3, true)],
    ['work-bucket', tx('z wiadrem wody', 'with a bucket of water'), worker('bucket', 0, false, 'bucketWater')],
    ['work-rod', tx('rybak z wędką', 'fisherman with rod'), worker('rod', -0.9, true)],
    ['work-bow', tx('myśliwy z łukiem', 'hunter with bow'), archerPeasant()],
    ['work-back', tx('kilof na plecach', 'pick on the back'), worker('backPick', 0, false)],
  ]],
  [tx('Narzędzia', 'Tools'), ([['axe', tx('siekiera', 'axe')], ['pick', tx('kilof', 'pick')], ['hammer', tx('młotek', 'hammer')], ['club', tx('maczuga', 'club')], ['fork', tx('widły', 'pitchfork')], ['torch', tx('pochodnia', 'torch')], ['bucket', tx('wiadro', 'bucket')], ['rod', tx('wędka', 'fishing rod')], ['bow', tx('łuk myśliwego', 'hunting bow')], ['backPick', tx('kilof na plecach', 'pick on the back')], ['beltClub', tx('maczuga u pasa', 'club at the belt')]] as const).map(([k, l]) => [`tool-${k}`, `${l} ${tx('(z bliska | z daleka)', '(near | far)')}`, toolPair(k)] as [string, string, Make])],
  [tx('Części budynków', 'Building parts'), [['towerdoor', tx('drzwi kamiennej wieży (nowe wejście: z muru i przy ziemi)', 'stone tower door (new entrance: from the wall and at ground)'), () => {
    const g = new THREE.Group(), k = towerDoorKit();
    for (const d of [...k.door, ...k.steps]) { const m = new THREE.Mesh(d.geo, d.mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.position.y = 0.28;
    return { obj: g };
  }]]],
  [tx('Pochówek', 'Burial'), [['grave', tx('grób w lesie (kopczyk z krzyżem)', 'woodland grave (mound and cross)'), () => ({ obj: graveModel() })], ['coffin', tx('trumna na noszach', 'coffin on a bier'), () => ({ obj: graveModel('coffin') })]]],
  [tx('Podwórko', 'Yard'), YARD_KEYS.map((k) => [`yard-${k}`, k.replace('cloth_', tx('pranie: ', 'washing: ')), () => ({ obj: yardModel(k) })] as [string, string, Make])],
  [tx('Graty', 'Clutter'), (['barrel', 'sack', 'hay', 'crate', 'trash', 'bucket', 'barrow', 'logs'] as const).map((k) => [`clutter-${k}`, k, () => ({ obj: clutterObject(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks') })) })] as [string, string, Make])],
  // gotowe modele z paczek (tools/models/props_import.py): z lewej wersja z bliska, z prawej z daleka; ryba w rozmiarze z kosza
  [tx('Z paczek', 'From packs'), ([['fish', tx('ryba', 'fish'), 0.3], ['torch', tx('pochodnia wyciągana w spacerze', 'torch drawn on a walk'), 1], ['basket', tx('kosz z wikliny', 'wicker basket'), 0.3], ['apple', tx('jabłko', 'apple'), 0.15], ['bun1', tx('chleb', 'bread'), 0.2], ['barrel', tx('beczka', 'barrel'), 0.4], ['sack', tx('worek z płótna', 'linen sack'), 0.25]] as const).map(([k, l, sc]) => [`prop-${k}`, `${l} ${tx('(z bliska | z daleka)', '(near | far)')}`, () => {
    const g = new THREE.Group();
    for (const [far, x] of [[false, -0.25], [true, 0.25]] as const) {
      const kk = k;
      const m = new THREE.Mesh(propGeometry(kk, far).clone().scale(sc * 2, sc * 2, sc * 2), propMaterial(kk));
      m.castShadow = true;
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(x - c.x, -b.min.y, -c.z);
      g.add(m);
    }
    return { obj: g };
  }] as [string, string, Make])],
];

// ---------- scena ----------
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = createRenderer({canvas, antialias: true }, 'pomocniczy');
initKtx(renderer);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft usunięty w three.js
watchRenderer(renderer, 'podgląd modeli');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = env;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
const controls = new OrbitControls(camera, canvas);
controls.zoomToCursor = true;   // kółko przybliża tam, gdzie wskazuje mysz — łatwiej podjechać do detalu
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 0.8;

const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x5a5440, 0.9);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(hemi, sun, sun.target);

// tło: kamienna podstawka, trawa albo nic (model w powietrzu)
const stone = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9, map: pattern('ashlar'), normalMap: normal('ashlar') });
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.06, 1, 48), stone);
plinth.receiveShadow = true; plinth.castShadow = true;
const grassTex = pattern('grass');
const grass = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: 0x9aa878, roughness: 1, map: grassTex, normalMap: normal('grass') }));
grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
const shadowCatch = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.receiveShadow = true;
scene.add(plinth, grass, shadowCatch);

const q = new URLSearchParams(location.search);
const state = { id: q.get('id') ?? 'house', bg: (q.get('tlo') ?? 'podstawka') as 'podstawka' | 'powietrze' | 'trawa', night: q.has('noc'), roof: true, spin: false, wire: false, far: Math.max(0, Math.min(3, Number(q.get('daleko')) || 0)) };
let current: THREE.Object3D | null = null;
/** Daleka wersja pokazanego budynku (null dla innych modeli) */
let lod: BuildingLod | null = null;
const url = (): string => `?id=${encodeURIComponent(state.id)}${state.bg !== 'podstawka' ? `&tlo=${state.bg}` : ''}${state.night ? '&noc=1' : ''}${state.far ? `&daleko=${state.far}` : ''}`;
let size = new THREE.Vector3(1, 1, 1);
const nameEl = document.getElementById('name')!, infoEl = document.getElementById('info')!;

function find(id: string): [string, Make] | null {
  for (const [, list] of GROUPS) for (const [k, label, make] of list) if (k === id) return [label, make];
  return null;
}

function applyLook(): void {
  const night = state.night;
  setNight(night ? 1 : 0);
  scene.background = new THREE.Color(night ? 0x0d1220 : 0x8fa3b8);
  hemi.intensity = night ? 0.15 : 0.9;
  sun.color.setHex(night ? 0x8aa0d0 : 0xfff0d8);
  sun.intensity = night ? 0.35 : 2.6;
  scene.environmentIntensity = night ? 0.06 : 0.45;
  const span = Math.max(size.x, size.z);
  const r = span * 0.75 + 0.15;
  plinth.visible = state.bg === 'podstawka';
  grass.visible = state.bg === 'trawa';
  shadowCatch.visible = state.bg === 'powietrze';
  const ph = Math.max(0.04, span * 0.06);
  plinth.scale.set(r, ph, r); plinth.position.y = -ph / 2;
  // kamienie podstawki w stałej wielkości, niezależnie od rozmiaru modelu
  for (const tx of [stone.map, stone.normalMap]) if (tx) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(r * 1.6, r * 1.6); }
  grass.scale.setScalar(r * 2.2);
  // w powietrzu model wisi nad własnym cieniem
  const lift = state.bg === 'powietrze' ? Math.max(0.15, size.y * 0.35) : 0;
  if (current) current.position.y = ((current.userData.baseY as number | undefined) ?? 0) + lift;
  shadowCatch.scale.setScalar(r * 1.6);
  if (current) {
    current.traverse((o) => {
      if (['shell', 'roof', 'chimney', 'spin', 'flagpole'].includes(o.name)) o.visible = state.roof;
      if (o.name === 'interior') o.visible = true; // wnętrze zawsze, jak w grze (Michał 10.11.2026); „Bez dachu” zdejmuje tylko dach i ściany
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (m) for (const mm of Array.isArray(m) ? m : [m]) if ('wireframe' in mm) mm.wireframe = state.wire;
    });
    // daleka wersja: wieko (dach, mury) idzie za przyciskiem „Bez dachu”, tak jak w grze
    if (lod) showLod(lod, state.far - 1);
    let tris = 0, meshes = 0;
    current.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3;
    });
    const far = lod && state.far ? tx(` · daleka wersja ${state.far}/3 (błąd ${lod.levels[state.far - 1]?.error.toFixed(3) ?? '—'} pola)`, ` · far version ${state.far}/3 (error ${lod.levels[state.far - 1]?.error.toFixed(3) ?? '—'} tiles)`) : '';
    infoEl.textContent = `${nameEl.textContent} · ${Math.round(tris).toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL')} ${tx('trójkątów', 'triangles')} · ${meshes} ${tx('siatek', 'meshes')} · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} ${tx('(pola)', '(tiles)')}${far}`;
  }
  controls.autoRotate = state.spin;
  syncBar();
}

function show(id: string): void {
  const hit = find(id) ?? find('house')!;
  state.id = find(id) ? id : 'house';
  if (current) { scene.remove(current); }
  const made = hit[1]();
  current = made.obj;
  current.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  scene.add(current);
  lod = null;
  if (BUILDINGS.some((d) => d.id === state.id)) {
    lod = prepareLod(current, state.id);
    if (lod) attachLod(current, lod, { keep: isWindowMat, wet: isWetMat }, true);
  }
  const box = new THREE.Box3().setFromObject(current);
  size = made.size ?? box.getSize(new THREE.Vector3());
  if (!made.size) {
    // wyśrodkowanie w poziomie, stopa na zerze
    const c = box.getCenter(new THREE.Vector3());
    // stopa na podstawce: modele wiszące od y = 0 w dół (pranie) też stają na niej
    current.position.set(-c.x, box.min.y < -0.001 ? -box.min.y : 0, -c.z);
    current.userData.baseY = current.position.y;
  }
  const span = Math.max(size.x, size.y, size.z, 0.2);
  const d = span * 2.4;
  camera.near = span * 0.003; camera.far = span * 60; camera.updateProjectionMatrix();
  controls.target.set(0, size.y * 0.45, 0);
  camera.position.set(d * 0.7, size.y * 0.6 + d * 0.35, d * 0.75);
  // blisko do detali (Michał 10.11.2026: „w trybie budowy nie mogę mocno przybliżyć”)
  controls.minDistance = span * 0.015; controls.maxDistance = span * 8;
  sun.position.set(span * 3, span * 5, span * 2.5);
  const s = sun.shadow.camera as THREE.OrthographicCamera;
  s.left = s.bottom = -span * 1.4; s.right = s.top = span * 1.4; s.near = 0.01; s.far = span * 15; s.updateProjectionMatrix();
  controls.update();
  nameEl.textContent = hit[0];
  history.replaceState(null, '', url());
  document.querySelectorAll<HTMLButtonElement>('#groups button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.id)));
  applyLook();
  editor.onModel();
}

// ---------- panel ----------
// zwijanie lewego panelu z listą modeli (Michał 10.11.2026) — więcej miejsca na model w edytorze
const fold = document.createElement('button');
fold.type = 'button'; fold.className = 'fold';
const setFold = (v: boolean): void => {
  document.body.classList.toggle('folded', v);
  fold.textContent = v ? '»' : '«';
  fold.title = v ? tx('Pokaż listę modeli', 'Show the model list') : tx('Schowaj listę modeli', 'Hide the model list');
  fold.setAttribute('aria-expanded', String(!v));
  try { localStorage.setItem('p1-viewer-fold', v ? '1' : ''); } catch { /* bez pamięci */ }
  requestAnimationFrame(() => resize());
};
fold.onclick = () => setFold(!document.body.classList.contains('folded'));
document.body.append(fold);
try { setFold(localStorage.getItem('p1-viewer-fold') === '1'); } catch { setFold(false); }
const groupsEl = document.getElementById('groups')!;
// lista modeli jako kafelki z miniaturą (Michał 10.11.2026) i mała wyszukiwarka jak przy teksturach
const thumbs = createThumbs(renderer, scene, () => {
  // na czas miniatury: bez bieżącego modelu, podstawki, trawy i cienia; dzień
  const hid = [current, plinth, grass, shadowCatch].filter((o): o is THREE.Object3D => !!o && o.visible);
  for (const o of hid) o.visible = false;
  const bg = scene.background, night = state.night;
  scene.background = new THREE.Color(0x2e2b24);
  if (night) { state.night = false; applyLook(); for (const o of hid) o.visible = false; }
  return () => { scene.background = bg; for (const o of hid) o.visible = true; if (night) { state.night = true; applyLook(); } };
}, (id) => find(id)?.[1]().obj ?? null, __BUILD__);
const search = document.createElement('input');
search.type = 'search'; search.className = 'list-search';
search.placeholder = tx('szukaj modelu…', 'search models…');
search.setAttribute('aria-label', tx('Szukaj modelu', 'Search models'));
search.addEventListener('keydown', (e) => e.stopPropagation());   // bez lotu WASD przy pisaniu
groupsEl.append(search);
const sections: { h: HTMLElement; box: HTMLElement; tiles: HTMLButtonElement[] }[] = [];
for (const [title, list] of GROUPS) {
  const h = document.createElement('h2'); h.textContent = title; groupsEl.append(h);
  const box = document.createElement('div'); box.className = 'list tiles';
  const tiles: HTMLButtonElement[] = [];
  for (const [id, label] of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.id = id; b.title = label; b.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img'); img.alt = ''; img.width = img.height = 56;
    const cap = document.createElement('span'); cap.textContent = label;
    b.append(img, cap);
    b.onclick = () => editor.guard(() => show(id));
    box.append(b); tiles.push(b);
    thumbs.watch(id, img);
  }
  groupsEl.append(box);
  sections.push({ h, box, tiles });
}
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  for (const s of sections) {
    let any = false;
    for (const b of s.tiles) { const on = !q || b.title.toLowerCase().includes(q) || (b.dataset.id ?? '').toLowerCase().includes(q); b.hidden = !on; any ||= on; }
    s.h.hidden = s.box.hidden = !any;
  }
});
const barEl = document.getElementById('bar')!;
const toggles: [string, () => boolean, () => void][] = [
  [tx('Podstawka', 'Plinth'), () => state.bg === 'podstawka', () => { state.bg = 'podstawka'; }],
  [tx('W powietrzu', 'In the air'), () => state.bg === 'powietrze', () => { state.bg = 'powietrze'; }],
  [tx('Na trawie', 'On grass'), () => state.bg === 'trawa', () => { state.bg = 'trawa'; }],
  [tx('Noc', 'Night'), () => state.night, () => { state.night = !state.night; }],
  [tx('Bez dachu', 'No roof'), () => !state.roof, () => { state.roof = !state.roof; }],
  [tx('Siatka', 'Wireframe'), () => state.wire, () => { state.wire = !state.wire; }],
  [tx('Obrót', 'Spin'), () => state.spin, () => { state.spin = !state.spin; }],
  [tx('Z daleka', 'Far'), () => state.far > 0, () => { state.far = (state.far + 1) % 4; }],
];
const viewBox = document.createElement('div');
viewBox.className = 'view-tools';
barEl.append(viewBox);
const runToggle = (act: () => void): void => { act(); applyLook(); history.replaceState(null, '', url()); };
const VIEW_ICONS = ['plinth', 'air', 'grass', 'night', 'noroof', 'wire', 'spin', 'far'];
const barButtons = toggles.map(([label, on, act], k) => {
  const b = document.createElement('button');
  b.type = 'button'; b.title = label; b.className = 'ico';
  b.innerHTML = icon(VIEW_ICONS[k]!); b.setAttribute('aria-label', label);
  b.onclick = () => runToggle(act);
  viewBox.append(b);
  return [b, on] as const;
});
function syncBar(): void {
  for (const [b, on] of barButtons) b.setAttribute('aria-pressed', String(on()));
  // przycisk dalekiej wersji przełącza po kolei: pełny → 1 → 2 → 3 (tylko budynki ją mają)
  const farBtn = barButtons[barButtons.length - 1]![0];
  const farLabel = state.far ? tx(`Z daleka ${state.far}/3 (klik — następny stopień)`, `Far ${state.far}/3 (click — next level)`) : tx('Z daleka — uproszczona wersja na daleki plan', 'Far — simplified distant version');
  farBtn.title = farLabel; farBtn.setAttribute('aria-label', farLabel);
  farBtn.innerHTML = icon('far') + (state.far ? `<span class="ico-badge">${state.far}</span>` : '');
  farBtn.hidden = !lod;
}

// edytor poprawek (Michał 10.11.2026): „Edytuj” → klik w część, uchwyt do przesuwania i obracania, „Zapisz”
const editor = createModelEditor({ renderer, scene, camera, canvas, orbit: controls, bar: barEl, current: () => current, id: () => state.id });

// konto po prawej stronie górnej belki (zalogowany twórca dostaje „Edytuj”)
createViewerAccount(document.querySelector('.menubar') as HTMLElement);
// górne menu jak w programach graficznych (Michał 10.11.2026): Plik, Edycja, Narzędzia, Dodaj, Widok, Pomoc
createMenuBar(document.getElementById('menus')!, [
  { label: tx('Plik', 'File'), items: () => editor.menus().file },
  { label: tx('Edycja', 'Edit'), items: () => editor.menus().edit },
  { label: tx('Narzędzia', 'Tools'), items: () => editor.menus().tools },
  { label: tx('Dodaj', 'Add'), items: () => editor.menus().add },
  { label: tx('Widok', 'View'), items: () => [
    ...toggles.slice(0, 3).map(([label, on, act]) => ({ label, checked: on, act: () => runToggle(act) })),
    { sep: true },
    ...toggles.slice(3).map(([label, on, act]) => ({ label, checked: on, act: () => runToggle(act), enabled: label === toggles[7]![0] ? () => !!lod : undefined })),
    { sep: true },
    { label: tx('Lista modeli', 'Model list'), checked: () => !document.body.classList.contains('folded'), act: () => setFold(!document.body.classList.contains('folded')) },
  ] },
  { label: tx('Pomoc', 'Help'), items: () => [
    { label: tx('Mysz: lewy — obrót, prawy — przesuw, kółko — zoom', 'Mouse: left — orbit, right — pan, wheel — zoom'), enabled: () => false },
    { label: tx('WASD — lot kamerą, Shift — szybciej, Q/E — dół/góra', 'WASD — fly, Shift — faster, Q/E — down/up'), enabled: () => false },
    { label: tx('Klik — przedmiot, Alt+klik — jedna część, Ctrl — kilka', 'Click — object, Alt+click — single part, Ctrl — several'), enabled: () => false },
    { label: tx('1/2/3 — przesuń/obróć/skaluj, F — pokaż zaznaczenie', '1/2/3 — move/rotate/scale, F — frame selection'), enabled: () => false },
  ] },
]);

function resize(): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
// upraszczanie (WebAssembly) wczytuje się chwilę; bez niego model i tak się pokaże, tylko bez dalekiej wersji
void lodReady.then(() => show(state.id));
// latanie kamerą WASD (Q/E — w dół / w górę, Shift — szybciej), też w edytorze (Michał 10.11.2026)
const held = new Set<string>();
window.addEventListener('keydown', (e) => { if (!(e.target instanceof HTMLInputElement) && !e.ctrlKey && !e.metaKey) held.add(e.key.toLowerCase()); });
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());
let lastT = performance.now();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
const nightLights = createNightLights(scene);
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (held.size) {
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    move.set(0, 0, 0);
    if (held.has('w')) move.add(fwd);
    if (held.has('s')) move.sub(fwd);
    if (held.has('d')) move.add(right);
    if (held.has('a')) move.sub(right);
    if (held.has('e')) move.y += 1;
    if (held.has('q')) move.y -= 1;
    if (move.lengthSq()) {
      // prędkość od odległości do punktu, na który patrzy kamera: z bliska wolno i dokładnie, z daleka szybciej
      // (Michał 10.11.2026: „za czuły jest WASD w budowaniu”); Shift — 3× szybciej
      const span = Math.max(size.x, size.y, size.z, 0.2), dist = camera.position.distanceTo(controls.target);
      move.normalize().multiplyScalar(Math.min(span * 1.2, Math.max(0.03, dist * 0.8)) * (held.has('shift') ? 3 : 1) * dt);
      camera.position.add(move); controls.target.add(move);
    }
  }
  controls.update();
  // modele, które się ruszają (zwierzęta w podglądzie: chód, ruch spoczynkowy)
  tickBuildingWater(now / 1000);
  (current?.userData.tick as ((dt: number, t: number) => void) | undefined)?.(dt, now / 1000);
  thumbs.step();
  nightLights.update(current, state.night, camera, Math.max(size.x, size.z, 0.3));
  renderer.render(scene, camera);
});
// do sprawdzania z konsoli: window.__cur() — obiekt obecnie oglądanego modelu
(window as unknown as { __cur: () => THREE.Object3D | null; __cam: () => THREE.Camera; __three: typeof THREE }).__cur = () => current ?? null;
(window as unknown as { __cam: () => THREE.Camera }).__cam = () => camera;
(window as unknown as { __three: typeof THREE }).__three = THREE;
// do zrzutów z testów: window.__view('tavern', yawStopnie, nachylenieStopnie, dalekaWersja 0..3, przybliżenie)
(window as unknown as { __view: (id: string, yaw?: number, pitch?: number, far?: number, zoom?: number, lift?: number) => void }).__view = (id, yaw = 40, pitch = 25, far, zoom = 1, lift = 0) => {
  if (id !== state.id) show(id);
  if (far !== undefined) { state.far = far; applyLook(); }
  const span = Math.max(size.x, size.y, size.z, 0.2), d = (span * 2.4) / zoom, a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  if (lift) controls.target.y = size.y * (0.45 + lift);
  camera.position.set(Math.sin(a) * Math.cos(p) * d, controls.target.y + Math.sin(p) * d, Math.cos(a) * Math.cos(p) * d);
  controls.update();
};

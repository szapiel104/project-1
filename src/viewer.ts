/**
 * Podgląd modeli (modele.html): jeden model na kamiennej podstawce, w powietrzu albo na trawie, w zwykłym świetle
 * i w pełnej jakości (zdjęciowe tekstury, miękkie cienie, odbicia otoczenia). Kamerą obraca się myszą dookoła.
 * Do sprawdzania nowych i zmienionych modeli bez uruchamiania gry: modele.html?id=tavern (&tlo=powietrze|trawa, &noc=1).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BUILDINGS } from './data/buildings';
import { t } from './i18n';
import { buildingModel, setNight } from './render/buildings';
import { partsGeometry } from './render/gear';
import RAM_MODEL from './render/models/ram.json';
import { clutterModel } from './render/clutter';
import { crowGeometry, wolfParts, WOLF_HIPS, WOLF_TAIL } from './render/creatures';
import { YARD_KEYS, yardModel } from './render/family';
import { Figures, idWithHead, type FigureKind } from './render/peasants';
import { normal, pattern } from './render/textures';
import { ANIMAL_AT, animalGeo } from './render/village';

const RED = 0xa32a22;
type Make = () => { obj: THREE.Object3D; size?: THREE.Vector3 };
const vc = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material = vc()): THREE.Mesh => new THREE.Mesh(g, m);

/** Postać z instancjonowanych części gry, w kontenerze (żeby dało się ją usunąć ze sceny) */
function figure(kind: FigureKind, id: number, h = 0.64): Make {
  return () => {
    const holder = new THREE.Scene();
    Figures.FAR2 = 1e9;
    const f = new Figures(1, holder, kind);
    f.set(0, new THREE.Matrix4(), 0, false, RED, id);
    f.finish(1);
    return { obj: holder, size: new THREE.Vector3(0.3, h, 0.2) };
  };
}
function horse(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(animalGeo('horse_body')));
  const neck = mesh(animalGeo('horse_neck')); neck.position.set(...ANIMAL_AT.neck); g.add(neck);
  const tail = mesh(animalGeo('horse_tail')); tail.position.set(...ANIMAL_AT.tail); g.add(tail);
  return g;
}
function dog(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(animalGeo('dog_body')));
  ANIMAL_AT.dogHips.forEach((p, i) => { const l = mesh(animalGeo(i < 2 ? 'dog_leg' : 'dog_hind')); l.position.set(...p); g.add(l); });
  const tail = mesh(animalGeo('dog_tail')); tail.position.set(...ANIMAL_AT.dogTail); tail.rotation.x = -1.1; g.add(tail);
  return g;
}
function wolf(): THREE.Object3D {
  const w = wolfParts(), g = new THREE.Group();
  g.add(new THREE.Mesh(w.body, w.mat), new THREE.Mesh(w.eyes, new THREE.MeshBasicMaterial({ color: 0xd8a040 })));
  WOLF_HIPS.forEach((p, i) => { const l = new THREE.Mesh(i < 2 ? w.leg : w.hindLeg, w.mat); l.position.set(...p); g.add(l); });
  const tail = new THREE.Mesh(w.tail, w.mat); tail.position.set(...WOLF_TAIL); tail.rotation.x = -1.2; g.add(tail);
  return g;
}

/** Wszystkie modele w grupach: [grupa, [id, podpis, budowa]] */
const GROUPS: [string, [string, string, Make][]][] = [
  ['Budynki', BUILDINGS.filter((d) => !d.road).map((d) => [d.id, t(d.name), () => {
    const m = buildingModel(d.id, RED);
    const base = m.getObjectByName('base'); if (base) base.visible = false;
    return { obj: m };
  }] as [string, string, Make])],
  ['Ludzie', [
    ['peasant', 'Chłop', figure('peasant', 3)],
    ['woman', 'Gospodyni (chusta)', figure('woman', idWithHead((h) => h % 2 === 0))],
    ['woman2', 'Gospodyni (kok)', figure('woman', idWithHead((h) => h % 2 === 1))],
    ['child', 'Dziecko', figure('child', idWithHead((h) => h !== 2), 0.42)],
    ['child2', 'Dziecko (czapka)', figure('child', idWithHead((h) => h === 2), 0.42)],
    ['spearman', 'Włócznik', figure('spearman', 4)],
    ['archer', 'Łucznik', figure('archer', 5)],
    ['guard', 'Strażnik', figure('guard', 6)],
    ['king', 'Pan zamku', figure('king', 7)],
  ]],
  ['Zwierzęta', [
    ['hen', 'Kura', () => ({ obj: mesh(animalGeo('hen_brown')) })],
    ['pig', 'Świnia', () => ({ obj: mesh(animalGeo('pig')) })],
    ['horse', 'Koń', () => ({ obj: horse() })],
    ['dog', 'Pies', () => ({ obj: dog() })],
    ['wolf', 'Wilk', () => ({ obj: wolf() })],
    ['crow', 'Kruk', () => ({ obj: mesh(crowGeometry()) })],
  ]],
  ['Machiny', [
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
  ['Podwórko', YARD_KEYS.map((k) => [`yard-${k}`, k.replace('cloth_', 'pranie: '), () => ({ obj: yardModel(k) })] as [string, string, Make])],
  ['Graty', (['barrel', 'sack', 'hay', 'crate', 'trash', 'bucket', 'barrow', 'logs'] as const).map((k) => [`clutter-${k}`, k, () => ({ obj: mesh(clutterModel(k), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks') })) })] as [string, string, Make])],
];

// ---------- scena ----------
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
const state = { id: q.get('id') ?? 'house', bg: (q.get('tlo') ?? 'podstawka') as 'podstawka' | 'powietrze' | 'trawa', night: q.has('noc'), roof: true, spin: false, wire: false };
let current: THREE.Object3D | null = null;
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
  if (current) current.position.y = lift;
  shadowCatch.scale.setScalar(r * 1.6);
  if (current) {
    current.traverse((o) => {
      if (['shell', 'roof', 'chimney', 'spin', 'flagpole'].includes(o.name)) o.visible = state.roof;
      if (o.name === 'interior') o.visible = !state.roof;
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (m) for (const mm of Array.isArray(m) ? m : [m]) if ('wireframe' in mm) mm.wireframe = state.wire;
    });
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
  const box = new THREE.Box3().setFromObject(current);
  size = made.size ?? box.getSize(new THREE.Vector3());
  if (!made.size) {
    // wyśrodkowanie w poziomie, stopa na zerze
    const c = box.getCenter(new THREE.Vector3());
    current.position.set(-c.x, 0, -c.z);
  }
  const span = Math.max(size.x, size.y, size.z, 0.2);
  const d = span * 2.4;
  camera.near = span * 0.01; camera.far = span * 60; camera.updateProjectionMatrix();
  controls.target.set(0, size.y * 0.45, 0);
  camera.position.set(d * 0.7, size.y * 0.6 + d * 0.35, d * 0.75);
  controls.minDistance = span * 0.3; controls.maxDistance = span * 8;
  sun.position.set(span * 3, span * 5, span * 2.5);
  const s = sun.shadow.camera as THREE.OrthographicCamera;
  s.left = s.bottom = -span * 1.4; s.right = s.top = span * 1.4; s.near = 0.01; s.far = span * 15; s.updateProjectionMatrix();
  controls.update();
  nameEl.textContent = hit[0];
  let tris = 0, meshes = 0;
  current.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !o.visible) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position!.count) / 3;
  });
  infoEl.textContent = `${hit[0]} · ${Math.round(tris).toLocaleString('pl-PL')} trójkątów · ${meshes} siatek · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} (pola)`;
  history.replaceState(null, '', `?id=${encodeURIComponent(state.id)}${state.bg !== 'podstawka' ? `&tlo=${state.bg}` : ''}${state.night ? '&noc=1' : ''}`);
  document.querySelectorAll<HTMLButtonElement>('#groups button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.id)));
  applyLook();
}

// ---------- panel ----------
const groupsEl = document.getElementById('groups')!;
for (const [title, list] of GROUPS) {
  const h = document.createElement('h2'); h.textContent = title; groupsEl.append(h);
  const box = document.createElement('div'); box.className = 'list';
  for (const [id, label] of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.id = id; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => show(id);
    box.append(b);
  }
  groupsEl.append(box);
}
const barEl = document.getElementById('bar')!;
const toggles: [string, () => boolean, () => void][] = [
  ['Podstawka', () => state.bg === 'podstawka', () => { state.bg = 'podstawka'; }],
  ['W powietrzu', () => state.bg === 'powietrze', () => { state.bg = 'powietrze'; }],
  ['Na trawie', () => state.bg === 'trawa', () => { state.bg = 'trawa'; }],
  ['Noc', () => state.night, () => { state.night = !state.night; }],
  ['Bez dachu', () => !state.roof, () => { state.roof = !state.roof; }],
  ['Siatka', () => state.wire, () => { state.wire = !state.wire; }],
  ['Obrót', () => state.spin, () => { state.spin = !state.spin; }],
];
const barButtons = toggles.map(([label, on, act]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.onclick = () => { act(); applyLook(); history.replaceState(null, '', `?id=${encodeURIComponent(state.id)}${state.bg !== 'podstawka' ? `&tlo=${state.bg}` : ''}${state.night ? '&noc=1' : ''}`); };
  barEl.append(b);
  return [b, on] as const;
});
function syncBar(): void { for (const [b, on] of barButtons) b.setAttribute('aria-pressed', String(on())); }

function resize(): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
show(state.id);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
// do zrzutów z testów: window.__view('tavern', yawStopnie, nachylenieStopnie)
(window as unknown as { __view: (id: string, yaw?: number, pitch?: number) => void }).__view = (id, yaw = 40, pitch = 25) => {
  if (id !== state.id) show(id);
  const span = Math.max(size.x, size.y, size.z, 0.2), d = span * 2.4, a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  camera.position.set(Math.sin(a) * Math.cos(p) * d, controls.target.y + Math.sin(p) * d, Math.cos(a) * Math.cos(p) * d);
  controls.update();
};

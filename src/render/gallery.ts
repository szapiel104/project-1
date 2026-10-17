import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { TEAM_COLORS } from '../data/teams';
import { t, tx } from '../i18n';
import { buildingModel } from './buildings';
import { crowParts, WOLF_HIPS, WOLF_TAIL, wolfParts } from './creatures';
import { Figures } from './peasants';

/**
 * Galeria postaci do menu „Jak grać”: te same modele co w grze, obracające się powoli na kawałku łąki.
 * Własny, mały renderer — sam się zamyka, gdy płótno zniknie ze strony (zmiana zakładki albo ekranu).
 */
export interface GalleryEntry { id: string; name: string; group: string; text: string }

const PEOPLE: GalleryEntry[] = [
  { id: 'peasant', group: tx('Ludzie', 'People'), name: tx('Chłopi', 'Peasants'), text: tx('Mieszkańcy osady: noszą drewno, kamień i żywność, pracują w warsztatach, stawiają budynki. Każdy wygląda trochę inaczej — czapka, kaptur, broda, fartuch.', 'The folk of your settlement: they haul timber, stone and food, toil in the workshops and raise buildings. No two look quite alike — cap, hood, beard, apron.') },
  { id: 'guard', group: tx('Ludzie', 'People'), name: t('guard.plain'), text: tx('Straż zamku, jak w Starym Obozie: zbroja z czerwonej skóry i żelaznych płyt, naramienniki, miecz w dłoni, pas w barwach pana. Dwóch stoi za dnia przy bramie twierdzy, reszta obchodzi osadę w dzień i w nocy (po zmroku z pochodniami). Nie słucha rozkazów. Poległego zastępuje rekrut szkolony w twierdzy (włócznia i złoto, ok. półtorej minuty).', 'The castle watch, as in the Old Camp: armour of red leather and iron plates, pauldrons, sword in hand, a belt in their lord\'s colours. Two stand at the keep gate by day; the rest patrol the settlement day and night (with torches after dark). They take no orders. A fallen guard is replaced by a recruit trained in the keep (a spear and gold, about a minute and a half).') },
  { id: 'spearman', group: tx('Ludzie', 'People'), name: t('u.spearman'), text: tx('Podstawowy żołnierz: kolczuga z czepcem pod waffenrockiem z krzyżem, kapalin albo hełm z nosalem, wypukła tarcza z okuciem i włócznia z liściastym grotem. Trzyma szyk i dźga z bliska. Nosi barwy swojego pana.', 'The backbone of any army: mail and coif under a surcoat with a cross, a kettle hat or nasal helm, a domed shield with iron trim and a leaf-bladed spear. Holds the line and stabs up close. Wears his lord\'s colours.') },
  { id: 'archer', group: tx('Ludzie', 'People'), name: t('u.archer'), text: tx('Pikowana przeszywanica, kaptur z pelerynką, kołczan na plecach, kord u pasa i długi łuk. Strzela z daleka, najlepiej z wieży albo zza palisady. Słaby w zwarciu, więc trzymaj go za włócznikami.', 'A quilted gambeson, a hood with a short cape, a quiver on his back, a long knife at his belt and a longbow. Shoots from afar, best from a tower or behind a palisade. Weak in melee, so keep him behind your spearmen.') },
  { id: 'wolf', group: tx('Zwierzęta', 'Animals'), name: tx('Wilk', 'Wolf'), text: tx('Wychodzi z lasu nocą. Poluje na samotnych chłopów, przegryza palisadę. W ciemności widać jego świecące oczy.', 'Comes out of the forest at night. Hunts lone peasants and gnaws through palisades. In the dark you can see its glowing eyes.') },
  { id: 'crow', group: tx('Zwierzęta', 'Animals'), name: tx('Kruk', 'Raven'), text: tx('Zlatuje na ciała poległych po bitwie. Płoszy się, gdy ktoś podejdzie.', 'Swoops down on the fallen after a battle. Takes flight when anyone comes near.') },
];
const CATS: Record<string, string> = { settlement: t('cat.settlement'), food: t('cat.food'), industry: t('cat.industry'), military: t('cat.military'), defense: t('cat.defense'), roads: t('cat.roads') };
const BUILDING_ENTRIES: GalleryEntry[] = BUILDINGS.filter((d) => !d.road).map((d) => ({
  id: `b:${d.id}`, group: d.category ? CATS[d.category] ?? tx('Budynki', 'Buildings') : t('cat.settlement'), name: t(d.name),
  text: (t(`d.${d.id}`) !== `d.${d.id}` ? t(`d.${d.id}`) : '') + (d.w ? tx(` Działka: ${d.w}×${d.h}.`, ` Plot: ${d.w}×${d.h}.`) : ''),
}));
/** Galeria: postacie i zwierzęta albo budynki (pogrupowane jak na belce budowania) */
export const GALLERY = { people: PEOPLE, buildings: [...BUILDING_ENTRIES].sort((a, b) => Object.values(CATS).indexOf(a.group) - Object.values(CATS).indexOf(b.group)) };

export function createGallery(canvas: HTMLCanvasElement): { show(id: string): void } {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120d08);
  scene.add(new THREE.HemisphereLight(0xe8e0d0, 0x3a3020, 1.3));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.position.set(2, 4, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5 });
  scene.add(sun);
  // kawałek ubitej łąki pod postaciami
  // brzeg placka rozmywa się w ciemne tło (bez twardego koła)
  const fade = document.createElement('canvas');
  fade.width = fade.height = 128;
  const fc = fade.getContext('2d')!;
  const grad = fc.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.55, '#bbb'); grad.addColorStop(1, '#000');
  fc.fillStyle = grad; fc.fillRect(0, 0, 128, 128);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshStandardMaterial({ color: 0x4a4a2c, roughness: 1, alphaMap: new THREE.CanvasTexture(fade), transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);

  const stage = new THREE.Group();
  scene.add(stage);
  const peasants = new Figures(3, stage as unknown as THREE.Scene);
  const spearmen = new Figures(2, stage as unknown as THREE.Scene, 'spearman');
  const archers = new Figures(2, stage as unknown as THREE.Scene, 'archer');
  const guardsFig = new Figures(2, stage as unknown as THREE.Scene, 'guard');
  const wp = wolfParts();
  const wolf = new THREE.Group();
  const wolfBody = new THREE.Mesh(wp.body, wp.mat);
  const legs = WOLF_HIPS.map(([x, y, z], k) => { const m = new THREE.Mesh(k < 2 ? wp.leg : wp.hindLeg, wp.mat); m.position.set(x, y, z); wolf.add(m); return m; });
  const tail = new THREE.Mesh(wp.tail, wp.mat);
  tail.position.set(...WOLF_TAIL);
  const eyes = new THREE.Mesh(wp.eyes, new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  wolf.add(wolfBody, tail, eyes);
  wolf.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  stage.add(wolf);
  const crows = [0, 1].map((k) => { const m = new THREE.Mesh(crowParts().stand, crowParts().mat); m.castShadow = true; m.position.set(k ? 0.18 : -0.15, 0, k ? -0.1 : 0.08); m.rotation.y = k ? 2.2 : -0.6; stage.add(m); return m; });

  let current = 'peasant';
  let shown: THREE.Object3D | null = null;
  let size = 1;
  let centerY = 0.3;
  const showBuilding = (id: string): void => {
    if (shown) { stage.remove(shown); shown = null; }
    if (!id.startsWith('b:')) { size = 1; return; }
    const def = BUILDINGS.find((d) => d.id === id.slice(2));
    if (!def) return;
    const m = buildingModel(def.id, TEAM_COLORS[0]!);
    // podgląd bali palisady zostaje widoczny (w grze bale rysuje osobny system)
    for (const n of ['base', 'patch']) { const o = m.getObjectByName(n); if (o) o.visible = false; }
    const pv = m.getObjectByName('preview'); if (pv) pv.visible = true;
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    stage.add(m);
    shown = m;
    // kadr dopasowany do bryły (brama i wieża są wyższe niż szersze)
    const sphere = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
    size = Math.max(sphere.radius, 0.5);
    centerY = sphere.center.y;
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const place = (x: number, z: number, yaw: number, scale = 1): THREE.Matrix4 => M.compose(P.set(x, 0, z), Q.setFromAxisAngle(Y, yaw), S.setScalar(scale));
  const t0 = performance.now();
  let alive = true;

  const frame = (): void => {
    if (!alive) return;
    if (!canvas.isConnected) { alive = false; renderer.dispose(); renderer.forceContextLoss(); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    }
    const t = (performance.now() - t0) / 1000;
    const walk = Math.sin(t * 7) * 0.5;
    const strike = Math.sin(t * 1.3) > 0.55; // co chwilę cios / strzał
    const team = TEAM_COLORS[0]!, foe = TEAM_COLORS[1]!;
    const kind = current;
    const enemy = false;
    // chłopi: trzech obok siebie, każdy inny
    if (kind === 'peasant') { [-0.32, 0, 0.32].forEach((x, i) => peasants.set(i, place(x, i === 1 ? 0.12 : -0.05, 0.25 - i * 0.2), i === 1 ? walk : 0, i === 2, team, 11 + i * 7)); peasants.finish(3); } else peasants.finish(0);
    if (kind === 'spearman') { spearmen.set(0, place(-0.16, 0, 0.3), 0, strike, enemy ? foe : team, 3); spearmen.set(1, place(0.18, -0.08, -0.2), walk, false, enemy ? foe : team, 8); spearmen.finish(2); } else spearmen.finish(0);
    if (kind === 'guard') { guardsFig.set(0, place(-0.16, 0, 0.3), 0, strike, team, 4); guardsFig.set(1, place(0.18, -0.08, -0.2), walk, false, team, 10); guardsFig.finish(2); } else guardsFig.finish(0);
    if (kind === 'archer') { archers.set(0, place(-0.15, 0, 0.3), 0, strike, enemy ? foe : team, 5); archers.set(1, place(0.17, -0.08, -0.2), walk, false, enemy ? foe : team, 9); archers.finish(2); } else archers.finish(0);
    wolf.visible = kind === 'wolf';
    if (wolf.visible) {
      legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 9) * 0.5 * (k === 0 || k === 3 ? 1 : -1); });
      tail.rotation.x = 1.9 + Math.sin(t * 4) * 0.15;
      wolf.scale.setScalar(1.15);
      wolf.position.set(0, 0, 0);
    }
    for (const c of crows) { c.visible = kind === 'crow'; c.rotation.x = Math.max(0, Math.sin(t * 5 + c.position.x * 20)) * 0.6; }
    // kamera powoli krąży; zwierzęta i ptaki z bliska, budynki z daleka (wg wielkości działki)
    const building = kind.startsWith('b:');
    ground.scale.setScalar(building ? Math.max(1, size * 1.1) : 1);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -(building ? size * 1.4 : 1.5); sun.shadow.camera.right = sun.shadow.camera.top = building ? size * 1.4 : 1.5; sun.shadow.camera.updateProjectionMatrix();
    const near = building ? size * 3.2 + 0.4 : kind === 'crow' ? 0.9 : kind === 'wolf' ? 2.6 : 2.0;
    // duży zamek stoi dalej niż zasięg kamery dla małych budynków: daleka płaszczyzna rośnie razem z kadrem
    const far = Math.max(20, near + size * 3);
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    const yaw = t * 0.35;
    const lookY = building ? centerY * 0.85 : kind === 'crow' ? 0.08 : kind === 'wolf' ? 0.4 : 0.33;
    camera.position.set(Math.sin(yaw) * near, lookY + near * 0.35, Math.cos(yaw) * near);
    camera.lookAt(0, lookY, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { show(id) { current = id; showBuilding(id); } };
}

import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import type { ModelFactory } from './models';
import { Figures } from './peasants';

/** Renderuje obrazki budynków do menu z tych samych modeli, które stoją na mapie. Zwraca id → adres obrazka. */
export function renderThumbnails(models: ModelFactory, teamColor: number, size = 160): Map<string, string> {
  const out = new Map<string, string>();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true , powerPreference: 'high-performance' });
  } catch {
    return out; // brak drugiego kontekstu WebGL: menu pokaże same nazwy
  }
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  // bez mapowania tonów i bez białego światła otoczenia, bo wypłukują barwy drewna i strzech
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x7a6644, 2.0));
  const sun = new THREE.DirectionalLight(0xfff0cc, 2.6);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  // doświetlenie od strony kamery, żeby ściany frontowe nie wpadały w czerń
  const fill = new THREE.DirectionalLight(0xffe2b8, 1.0);
  fill.position.set(6, 4, 6);
  scene.add(fill);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);

  for (const def of BUILDINGS) {
    if (!def.buildable && def.id !== 'keep') continue; // twierdza też: pokazuje ją pomoc „Budynki”
    const model = models.building(def.id, teamColor);
    const base = model.getObjectByName('base');
    if (base) base.visible = false;
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    cam.position.set(center.x + 6.5, center.y + 4, center.z + 5); // niżej i lekko z boku: widać ściany, drzwi i okna, nie tylko dach
    cam.lookAt(center);
    cam.updateMatrixWorld();
    // kadr dopasowany do rzutu narożników bryły na kamerę: budynek wypełnia kafelek i nic nie jest ucięte
    let half = 0.1;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      cam.worldToLocal(p);
      half = Math.max(half, Math.abs(p.x), Math.abs(p.y));
    }
    half *= 1.04;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    out.set(def.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

/**
 * Portrety jednostek do koszar: te same modele co na mapie (włócznik, łucznik), w barwach gracza,
 * w trzech czwartych od przodu, od pasa w górę z bronią, na ciemnym tle z ciepłym światłem od pochodni.
 * Klucz: `u:<id jednostki>`.
 */
export function renderUnitPortraits(teamColor: number, size = 192): Map<string, string> {
  const out = new Map<string, string>();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true , powerPreference: 'high-performance' });
  } catch {
    return out;
  }
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffeccc, 0x3a2c1c, 1.6));
  const key = new THREE.DirectionalLight(0xffd9a0, 3.0); key.position.set(-1.5, 2.5, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa860, 1.6); rim.position.set(2, 1.5, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
  const m = new THREE.Matrix4();
  for (const kind of ['spearman', 'archer', 'mageFire', 'mageWater'] as const) {
    const root = new THREE.Group();
    scene.add(root);
    const f = new Figures(1, root as unknown as THREE.Scene, kind);
    // lekko obrócony w stronę kamery, broń widoczna
    m.makeRotationY(-0.45);
    f.set(0, m, 0, false, teamColor, kind === 'archer' ? 9 : 3);
    f.finish(1);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    // wzrost postaci bez broni (włócznia sterczy wysoko nad głowę): kadr na człowieka, nie na drzewce
    const h = Math.min(box.max.y - box.min.y, 0.68);
    // kadr: od pasa po czubek broni/głowy
    const lookY = box.min.y + h * 0.66;
    cam.position.set(0.25 * h, lookY + 0.05 * h, 1.55 * h);
    cam.lookAt(0, lookY, 0);
    renderer.render(scene, cam);
    out.set(`u:${kind}`, renderer.domElement.toDataURL('image/png'));
    scene.remove(root);
    root.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.geometry.dispose(); (mm.material as THREE.Material).dispose(); } });
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

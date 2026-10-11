import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import type { ModelFactory } from './models';

/** Renderuje obrazki budynków do menu z tych samych modeli, które stoją na mapie. Zwraca id → adres obrazka. */
export function renderThumbnails(models: ModelFactory, teamColor: number, size = 160): Map<string, string> {
  const out = new Map<string, string>();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out; // brak drugiego kontekstu WebGL: menu pokaże same nazwy
  }
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4d6, 0x4a4433, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0cc, 2.2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);

  for (const def of BUILDINGS) {
    if (!def.buildable) continue;
    const model = models.building(def.id, teamColor);
    const base = model.getObjectByName('base');
    if (base) base.visible = false;
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, box.max.y - box.min.y) * 0.78;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.position.set(center.x + 6, center.y + 6.5, center.z + 6);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    out.set(def.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

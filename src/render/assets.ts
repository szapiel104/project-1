import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Gotowe modele budynków (KayKit Medieval Hexagon Pack, CC0) wczytywane przed startem gry.
 * Klucz = id budynku z data/buildings.ts; kilka plików = losowy wariant wyglądu.
 * Gdy plik się nie wczyta, budynek zostaje przy modelu składanym w kodzie.
 */
// Wyłączone 12.10.2026: styl paczki KayKit był zbyt bajkowy, gra zostaje przy modelach z kodu.
// Wpisy do przywrócenia: house: building_home_A/B, woodcutter: building_lumbermill, mine: building_mine, mill: building_windmill.
const MODELS: Record<string, string[]> = {};

/** Barwa drużyny → wariant kolorystyczny paczki */
const VARIANT: Record<number, string> = { 0xa32a22: 'red', 0x24508f: 'blue' };

const templates = new Map<string, THREE.Object3D>();

export async function preloadAssets(): Promise<void> {
  const loader = new GLTFLoader();
  const jobs: Promise<void>[] = [];
  for (const variant of new Set(Object.values(VARIANT)))
    for (const files of Object.values(MODELS))
      for (const file of files) {
        const name = `${file}_${variant}`;
        jobs.push(loader.loadAsync(`models/kaykit/${variant}/${name}.gltf`)
          .then((gltf) => {
            gltf.scene.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
            });
            templates.set(name, gltf.scene);
          })
          .catch(() => { /* zostaje model z kodu */ }));
      }
  await Promise.all(jobs);
}

let variantCounter = 0;

/**
 * Kopia gotowego modelu dopasowana do działki (w × h pól) albo null, gdy dla budynku nie ma pliku.
 * Model stoi na ziemi, wyśrodkowany, przeskalowany tak, by zajmował większość działki.
 */
export function assetModel(id: string, teamColor: number, w: number, h: number): THREE.Group | null {
  const files = MODELS[id];
  if (!files) return null;
  const variant = VARIANT[teamColor] ?? 'red';
  const file = files[variantCounter++ % files.length]!;
  const tpl = templates.get(`${file}_${variant}`);
  if (!tpl) return null;
  const inner = tpl.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min((w * 0.92) / size.x, (h * 0.92) / size.z);
  inner.scale.setScalar(scale);
  inner.position.set(-(box.min.x + size.x / 2) * scale, -box.min.y * scale, -(box.min.z + size.z / 2) * scale);
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

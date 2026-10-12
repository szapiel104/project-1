import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Gotowe modele budynków (KayKit Medieval Hexagon Pack, CC0) wczytywane przed startem gry.
 * Klucz = id budynku z data/buildings.ts; kilka plików = losowy wariant wyglądu.
 * Gdy plik się nie wczyta, budynek zostaje przy modelu składanym w kodzie.
 */
const MODELS: Record<string, string[]> = {
  house: ['building_home_A', 'building_home_B'],
  woodcutter: ['building_lumbermill'],
  mine: ['building_mine'],
  mill: ['building_windmill'],
  keep: ['building_castle'],
  bakery: ['building_tavern'],
  engineers: ['building_blacksmith'],
};

/** Wysokość cięcia przekroju (w jednostkach świata nad ziemią) przy podglądzie wnętrza */
const CUT: Record<string, number> = { keep: 1.85 };

/** Czy gra używa gotowych modeli. Powrót do modeli z kodu: ?modele=kod w adresie (zapamiętuje się w przeglądarce). */
export const USE_ASSETS = ((): boolean => {
  try {
    const q = new URLSearchParams(location.search).get('modele');
    if (q === 'kod' || q === 'paczka') localStorage.setItem('project1.models', q);
    return (localStorage.getItem('project1.models') ?? 'paczka') !== 'kod';
  } catch { return true; }
})();

/** Barwa drużyny → wariant kolorystyczny paczki */
const VARIANT: Record<number, string> = { 0xa32a22: 'red', 0x24508f: 'blue' };

const templates = new Map<string, THREE.Object3D>();

export async function preloadAssets(): Promise<void> {
  if (!USE_ASSETS) return;
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
export function assetModel(id: string, teamColor: number, w: number, h: number): { shell: THREE.Group; cut: THREE.Group } | null {
  const files = MODELS[id];
  if (!files || !USE_ASSETS) return null;
  const variant = VARIANT[teamColor] ?? 'red';
  const file = files[variantCounter++ % files.length]!;
  const tpl = templates.get(`${file}_${variant}`);
  if (!tpl) return null;
  const fit = (o: THREE.Object3D): THREE.Group => {
    const box = new THREE.Box3().setFromObject(tpl);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.min((w * 0.92) / size.x, (h * 0.92) / size.z);
    o.scale.setScalar(scale);
    o.position.set(-(box.min.x + size.x / 2) * scale, -box.min.y * scale, -(box.min.z + size.z / 2) * scale);
    const g = new THREE.Group();
    g.add(o);
    g.userData.height = size.y * scale;
    return g;
  };
  const shell = fit(tpl.clone(true));
  // Przekrój do podglądu wnętrza: ta sama bryła ucięta płaszczyzną na wysokości niskich ścian,
  // z widocznymi wewnętrznymi stronami ścian. Płaszczyznę ustawia animacja budynku (zależy od położenia w świecie).
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const cutInner = tpl.clone(true);
  cutInner.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = Array.isArray(m.material) ? m.material : [m.material];
    const mats = src.map((mm) => { const c = mm.clone(); c.side = THREE.DoubleSide; c.clippingPlanes = [plane]; c.clipShadows = true; return c; });
    m.material = Array.isArray(m.material) ? mats : mats[0]!;
  });
  const cut = fit(cutInner);
  cut.name = 'cutaway';
  cut.userData.plane = plane;
  cut.userData.cutAt = CUT[id] ?? 0.55;
  return { shell, cut };
}

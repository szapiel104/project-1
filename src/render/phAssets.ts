/**
 * Gotowe modele z Poly Haven (CC0, paczki glTF 1K, pobrane 10.11.2026 do edytora modeli — Michał: „dodaj dużo
 * obiektów darmowych”). Leżą w public/models/ph/<id>/ bez odchudzania (zasada Michała z 19.10.2026: oryginalne trójkąty,
 * UV i tekstury paczki). Wczytują się dopiero, gdy są potrzebne: edytor dodaje model, albo zapisane poprawki budynku go
 * używają (modelstore.ts zamawia je przed budową sceny). Wszystkie części modelu są sklejone w jedną bryłę bez indeksów
 * z grupami materiałów — tak edytor przesuwa ją jak każdy model z paczki (rodzaj poprawki 'prop', nazwa 'ph:<id>').
 *
 * Skala: paczki są w metrach; w grze człowiek ma ok. 0,64 pola wzrostu, więc 1 m ≈ 0,36 pola. Model stoi spodem na zerze,
 * wyśrodkowany w poziomie.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PH_SCALE = 0.36;

/** [id paczki, nazwa po polsku, po angielsku] */
export const PH_ASSETS: [string, string, string][] = [
  ['wooden_crate_01', 'skrzynia', 'crate'],
  ['wooden_crate_02', 'skrzynia z listew', 'slatted crate'],
  ['treasure_chest', 'skrzynia skarbów', 'treasure chest'],
  ['wooden_barrels_01', 'beczki', 'barrels'],
  ['wooden_bucket_01', 'wiadro', 'bucket'],
  ['wooden_bucket_02', 'cebrzyk', 'tub bucket'],
  ['wooden_stool_01', 'stołek', 'stool'],
  ['wooden_stool_02', 'zydel', 'three-legged stool'],
  ['wooden_table_02', 'stół', 'table'],
  ['small_wooden_table_01', 'stolik', 'small table'],
  ['round_wooden_table_01', 'okrągły stół', 'round table'],
  ['painted_wooden_bench', 'ława', 'bench'],
  ['wooden_display_shelves_01', 'regał', 'shelves'],
  ['wooden_bowl_01', 'miska', 'bowl'],
  ['wooden_bowl_02', 'misa', 'deep bowl'],
  ['wooden_spoon', 'łyżka', 'spoon'],
  ['wooden_cutting_board', 'deska do krojenia', 'cutting board'],
  ['jug_01', 'dzban', 'jug'],
  ['ceramic_pot', 'gliniany garnek', 'clay pot'],
  ['brass_goblets', 'kielichy', 'goblets'],
  ['wooden_candlestick', 'świecznik', 'candlestick'],
  ['wooden_lantern_01', 'latarnia', 'lantern'],
  ['wooden_broom', 'miotła', 'broom'],
  ['wooden_axe', 'siekiera', 'axe'],
  ['wooden_hammer_01', 'młot drewniany', 'mallet'],
  ['wooden_ladder', 'drabina', 'ladder'],
  ['spinning_wheel_01', 'kołowrotek', 'spinning wheel'],
  ['kite_shield', 'tarcza', 'kite shield'],
  ['wicker_basket_01', 'kosz z prętów', 'wicker basket'],
  ['wicker_basket_02', 'kosz z wiekiem', 'lidded basket'],
  ['tree_stump_01', 'pniak', 'tree stump'],
  ['tree_stump_02', 'pniak z korzeniami', 'rooted stump'],
  ['dead_tree_trunk', 'martwy pień', 'dead trunk'],
  ['dry_branches_medium_01', 'suche gałęzie', 'dry branches'],
  ['rock_moss_set_01', 'omszałe kamienie', 'mossy stones'],
  ['boulder_01', 'głaz', 'boulder'],
];

type Loaded = { geo: THREE.BufferGeometry; mats: THREE.Material[] };
const cache = new Map<string, Loaded>();
const pending = new Map<string, Promise<Loaded | null>>();
const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'models/ph/';

/** Wczytuje model (raz) i skleja go w jedną bryłę z grupami materiałów, spód na zerze, w skali gry */
export function loadPh(id: string): Promise<Loaded | null> {
  const c = cache.get(id);
  if (c) return Promise.resolve(c);
  let p = pending.get(id);
  if (p) return p;
  p = new GLTFLoader().loadAsync(`${base()}${id}/${id}_1k.gltf`).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      src.applyMatrix4(m.matrixWorld);
      // jeden materiał na kawałek (grupy z glTF rozbijamy na osobne bryły)
      const groups = src.groups.length ? src.groups : [{ start: 0, count: src.getAttribute('position').count, materialIndex: 0 }];
      for (const gr of groups) {
        const g = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv'] as const) {
          const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
          if (!a) continue;
          g.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
        }
        if (!g.getAttribute('normal')) g.computeVertexNormals();
        if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
        const mat = list[gr.materialIndex ?? 0] ?? list[0]!;
        let k = mats.indexOf(mat);
        if (k < 0) { k = mats.length; mats.push(mat); }
        g.userData.mat = k;
        geos.push(g);
      }
    });
    // kolejność po materiale, żeby grupy w sklejonej bryle szły po kolei
    geos.sort((a, b) => (a.userData.mat as number) - (b.userData.mat as number));
    const geo = mergeGeometries(geos, true)!;
    geo.groups.forEach((g, i) => { g.materialIndex = geos[i]!.userData.mat as number; });
    // skala gry, spód na zerze, środek w poziomie
    geo.computeBoundingBox();
    const b = geo.boundingBox!, c = b.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -b.min.y, -c.z);
    geo.scale(PH_SCALE, PH_SCALE, PH_SCALE);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    for (const m of mats) {
      const s = m as THREE.MeshStandardMaterial;
      s.side = THREE.DoubleSide;   // listki, płótno i szmaty w paczkach bywają pojedynczą płaszczyzną
      if (s.map) s.map.anisotropy = 8;
    }
    const out = { geo, mats };
    cache.set(id, out);
    return out;
  }).catch(() => null);
  pending.set(id, p);
  return p;
}

/** Gotowy (już wczytany) model albo null — dla kodu, który buduje scenę od razu */
export function phLoaded(id: string): Loaded | null { return cache.get(id) ?? null; }

/** Nazwy modeli Poly Haven użyte w danych modeli (rekwizyty 'ph:<id>') */
export function phUsed(datas: Iterable<unknown>): string[] {
  const out = new Set<string>();
  for (const d of datas) for (const p of ((d as { props?: { prop: string }[] } | null)?.props ?? [])) if (p.prop.startsWith('ph:')) out.add(p.prop.slice(3));
  return [...out];
}

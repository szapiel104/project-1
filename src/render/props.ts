import * as THREE from 'three';
import { model } from './modelstore';
import { loadTexture } from './ktx';

/**
 * Gotowe modele z sieci, przerobione w Blenderze skryptem tools/models/props_import.py (porównanie z oryginałem:
 * tools/models/props_check.py): ryba (Barramundi, Khronos glTF-Sample-Assets, CC0) i pochodnia w ręce chłopa
 * (Secret Histories, CC-BY-SA 4.0).
 *
 * Siatki idą do gry bez przeróbek: oryginalne trójkąty, UV i normalne, pozycje w pełnej precyzji, tekstura z paczki.
 * Płetwy i część szmat to pojedyncze płaszczyzny, więc materiał jest dwustronny (inaczej znikałyby z jednej strony).
 *
 * Układy: ryba — długość 1 wzdłuż z (pysk w +z), grzbiet w +y, środek w (0, 0, 0);
 * pochodnia — układ ręki jak narzędzia z tools.py (dłoń w (0, -0.19, 0), ręka uniesiona o TORCH_ARM).
 */
export type PropName = 'fish' | 'torch';
type Packed = { pos: string; nrm: string; col: string; uv: string; idx: string };

const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const slice = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

const geos = new Map<string, THREE.BufferGeometry>();

/** Siatka modelu (`far` = lżejsza wersja z daleka). Ta sama instancja przy każdym wywołaniu — nie zmieniać jej w miejscu, do przekształceń `.clone()`. */
export function propGeometry(name: PropName, far = false): THREE.BufferGeometry {
  const key = far ? `${name}Far` : name;
  let g = geos.get(key);
  if (g) return g;
  const m = model<Record<string, Packed>>('props')[key]!;
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(slice(b64(m.pos))), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(slice(b64(m.nrm))), 3, true));
  const col = b64(m.col), lin = new Float32Array(col.length);
  for (let i = 0; i < col.length; i++) lin[i] = col[i]! / 255;
  g.setAttribute('color', new THREE.BufferAttribute(lin, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(slice(b64(m.uv))), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(slice(b64(m.idx))), 1));
  g.computeBoundingSphere();
  geos.set(key, g);
  return g;
}

/**
 * Siatka bez indeksu i z normalnymi w float32 — do sklejania z bryłami z kodu (ładunki, stosy w składzie), bo przy
 * sklejaniu wszystkie atrybuty muszą mieć ten sam typ. Kształt, UV i normalne te same co w `propGeometry`.
 */
export function propGeometryFlat(name: PropName, far = false): THREE.BufferGeometry {
  const g = propGeometry(name, far).toNonIndexed();
  const n = g.getAttribute('normal');
  const f = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { f[i * 3] = n.getX(i); f[i * 3 + 1] = n.getY(i); f[i * 3 + 2] = n.getZ(i); }
  g.setAttribute('normal', new THREE.BufferAttribute(f, 3));
  return g;
}

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const mats = new Map<PropName, THREE.MeshStandardMaterial>();

/** Materiał z teksturą z paczki (kolor + mapa normalnych), dwustronny */
export function propMaterial(name: PropName): THREE.MeshStandardMaterial {
  let m = mats.get(name);
  if (m) return m;
  const fish = name === 'fish';
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: fish ? 0.42 : 0.85, metalness: fish ? 0.08 : 0, side: THREE.DoubleSide });
  if (typeof document !== 'undefined') {
    const map = loadTexture(`${base()}prop_${name}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const nm = loadTexture(`${base()}prop_${name}_n.jpg`);
    m.map = map;
    m.normalMap = nm;
  }
  mats.set(name, m);
  return m;
}

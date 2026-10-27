import * as THREE from 'three';
import { model, bytes } from './modelstore';

/**
 * Gotowe modele z sieci, przerobione w Blenderze skryptem tools/models/props_import.py (porównanie z oryginałem:
 * tools/models/props_check.py): ryba (Barramundi, Khronos glTF-Sample-Assets, CC0), pochodnia wyciągana w spacerze
 * (Secret Histories, CC-BY-SA 4.0), kosz z wikliny (Poly Haven wicker_basket_02, CC0, bez wieka), jabłko, trzy bochenki
 * i beczka (Poly Haven, CC0, skany).
 *
 * Siatki idą do gry bez przeróbek: oryginalne trójkąty, UV i normalne, pozycje w pełnej precyzji, tekstura z paczki;
 * wersja z daleka (`far`) to na razie ta sama siatka.
 * Płetwy i część szmat to pojedyncze płaszczyzny, więc materiał jest dwustronny (inaczej znikałyby z jednej strony).
 *
 * Układy: ryba — długość 1 wzdłuż z (pysk w +z), grzbiet w +y, środek w (0, 0, 0);
 * pochodnia — układ ręki jak narzędzia z tools.py (dłoń w (0, -0.19, 0), ręka uniesiona o TORCH_ARM);
 * kosz — dno w y = 0, środek podstawy w (0, 0), największa szerokość 1, wysokość `basketH` (ok. 0,93);
 * jabłko, bułki (bun1–3) — tak samo, szerokość 1 (jabłko: wysokość 0,875, bułki ok. 0,53);
 * beczka — dno w y = 0, wysokość 1, szerokość `barrelW` (0,87); worek — dno w 0, szerokość 1, wysokość `sackH` (1,3).
 * Skład (tools/models/stock_import.py, Sketchfab, CC BY 4.0): granit — trzy części jednego skanu (granite1–3, każda
 * z własną teksturą), dno w 0, szerokość 1, wysokość `graniteH`; snopek — leży wzdłuż x, długość 1; sztaby żelaza —
 * trzy sztaby wzdłuż z, długość 1.
 *
 * Zasada Michała (19.10.2026): siatki i tekstury z paczek bez odchudzania i w pełnej rozdzielczości; tekstury jako
 * zwykły JPG (TextureLoader) — kompresja KTX2 (ETC1S) robiła na małych teksturach z paczek widoczne kwadraty.
 */
export type PropName = 'fish' | 'torch' | 'basket' | 'apple' | 'bun1' | 'bun2' | 'bun3' | 'barrel' | 'sack'
  | 'granite1' | 'granite2' | 'granite3' | 'sheaf' | 'ingots';
/** Tekstura modelu, gdy kilka modeli dzieli jedną (trzy bułki z jednej paczki) */
const TEX_OF: Partial<Record<PropName, string>> = { bun1: 'bread', bun2: 'bread', bun3: 'bread' };
/**
 * Worek (tools/models/sack.py, symulacja tkaniny w Blenderze) nie ma własnej tekstury: juta z gry (burlap.jpg, ambientCG
 * Fabric 011, CC0) powtarzana wokół płótna (UV w metrach / 0,3), barwa lnu i cień w fałdach w kolorach wierzchołków
 */
const TEX_FILE: Partial<Record<PropName, string>> = { sack: 'burlap' };
/** Chropowatość i metaliczność powierzchni (połysk skórki jabłka i łusek ryby, matowy chleb i drewno) */
const SURFACE: Partial<Record<PropName, [number, number]>> = {
  fish: [0.42, 0.08], basket: [0.9, 0], apple: [0.45, 0], barrel: [0.75, 0.05], sack: [0.95, 0],
  granite1: [0.9, 0], granite2: [0.9, 0], granite3: [0.9, 0], sheaf: [0.92, 0], ingots: [0.62, 0.12],
};
/** Skan granitu (tools/models/stock_import.py) ma tylko kolor ze zdjęć, bez mapy normalnych */
const NO_NORMAL = new Set<PropName>(['granite1', 'granite2', 'granite3']);
type Packed = { pos: string; nrm: string; col: string; uv: string; idx: string };

const b64 = (s: string | Uint8Array): Uint8Array => bytes(s);
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
  // kolory wierzchołków zapisane w sRGB (barwa lnu i cień w fałdach worka; u modeli z paczek biel) → liniowe, jak w lesie
  for (let i = 0; i < col.length; i++) { const c = col[i]! / 255; lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
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

/**
 * Kosz z paczki w miejscu kosza z dawnych brył: dno w (x, y, z), szerokość `w`, wysokość `h` (wysokość dopasowana,
 * bo w koszu leżą na tej wysokości jabłka, chleb, ryby, ruda), obrócony o `yaw`. Bez indeksu — do sklejania.
 */
export function basketAt(x: number, y: number, z: number, w: number, h: number, yaw = 0, far = true): THREE.BufferGeometry {
  const nativeH = model<{ basketH: number }>('props').basketH;
  return propGeometryFlat('basket', far).scale(w, h / nativeH, w).rotateY(yaw).translate(x, y, z);
}

/** Model z paczki ustawiony w miejscu: dno w (x, y, z), szerokość `w`, obrót `yaw` — bez indeksu, do sklejania */
export function propAt(name: PropName, x: number, y: number, z: number, w: number, yaw = 0, far = true): THREE.BufferGeometry {
  return propGeometryFlat(name, far).scale(w, w, w).rotateY(yaw).translate(x, y, z);
}

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const mats = new Map<PropName, THREE.MeshStandardMaterial>();

/** Materiał z teksturą z paczki (kolor + mapa normalnych), dwustronny */
export function propMaterial(name: PropName): THREE.MeshStandardMaterial {
  let m = mats.get(name);
  if (m) return m;
  const [roughness, metalness] = SURFACE[name] ?? [0.85, 0];
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, side: THREE.DoubleSide });
  const tex = TEX_OF[name] ?? name;
  if (typeof document !== 'undefined') {
    const tl = new THREE.TextureLoader();
    const file = TEX_FILE[name] ?? `prop_${tex}`;
    const map = tl.load(`${base()}${file}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    const nm = NO_NORMAL.has(name) ? null : tl.load(`${base()}${file}_n.jpg`);
    if (nm) nm.anisotropy = 16;
    if (TEX_FILE[name]) for (const t of [map, nm]) if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping;   // tekstura powtarzana
    m.map = map;
    m.normalMap = nm;
  }
  mats.set(name, m);
  return m;
}

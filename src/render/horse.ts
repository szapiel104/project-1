import * as THREE from 'three';
import { model } from './modelstore';
import { loadTexture } from './ktx';
import { maskedTex } from './forest';

/**
 * Koń z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0) — model zrobiony przez grafików, przerobiony skryptem
 * tools/models/horse_0ad.py (bez odchudzania: 1666 trójkątów ciała, 204 grzywy i ogona, oryginalne UV i tekstury).
 *
 * Pozy są wypieczone ze szkieletu jako morph targets (różnice względem pozy stojącej), więc każdy koń w InstancedMesh
 * może stać inaczej, a całość to nadal dwa wywołania rysowania: sierść i włosie (grzywa + ogon, z przezroczystością).
 *   0 half  — w pół drogi do skubania,  1 graze — łeb przy ziemi,
 *   2 look  — łeb uniesiony, odwrócony (czujny),  3 swish — ogon odrzucony w bok (waga ujemna = w drugą stronę).
 * Układ: kopyta na y = 0, łeb w +z, środek tułowia w (0, 0); kłąb na wysokości `withers` pola.
 */
type Packed = { pos: string; nrm: string; uv: string; idx: string; morph: Record<string, { pos: string; nrm: string }> };
type HorseModel = { withers: number; body: Packed; hair: Packed };

export const HORSE_MORPHS = ['half', 'graze', 'look', 'swish'] as const;
export const HORSE_MORPH = { half: 0, graze: 1, look: 2, swish: 3 } as const;

const b64 = (s: string): ArrayBuffer => { const u = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return u.buffer; };

const geos = new Map<string, THREE.BufferGeometry>();

/** Siatka części konia z pozami (wspólna instancja — nie zmieniać w miejscu) */
export function horseGeometry(part: 'body' | 'hair'): THREE.BufferGeometry {
  let g = geos.get(part);
  if (g) return g;
  const m = model<HorseModel>('horse')[part];
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b64(m.pos)), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(b64(m.nrm)), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b64(m.uv)), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64(m.idx)), 1));
  g.morphTargetsRelative = true;
  g.morphAttributes.position = HORSE_MORPHS.map((k) => new THREE.BufferAttribute(new Float32Array(b64(m.morph[k]!.pos)), 3));
  // różnice normalnych (int8/127) — morph target normalnych musi być float, żeby dodawać się do znormalizowanej normalnej
  g.morphAttributes.normal = HORSE_MORPHS.map((k) => {
    const raw = new Int8Array(b64(m.morph[k]!.nrm)), f = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) f[i] = raw[i]! / 127;
    return new THREE.BufferAttribute(f, 3);
  });
  // obrys z pozy stojącej (three liczyłby go z sumą wszystkich póz naraz — koń „rósł” i wisiał nad podstawką);
  // sfera z zapasem, bo pozy wychodzą poza obrys (łeb przy ziemi, ogon w bok)
  g.boundingBox = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  g.boundingSphere.radius *= 1.25;
  geos.set(part, g);
  return g;
}

export const horseWithers = (): number => model<HorseModel>('horse').withers;

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const mats = new Map<string, THREE.MeshStandardMaterial>();

/** Materiał sierści (kolor + mapa normalnych z paczki) albo włosia (z maską przezroczystości, dwustronny) */
export function horseMaterial(part: 'body' | 'hair'): THREE.MeshStandardMaterial {
  let m = mats.get(part);
  if (m) return m;
  if (part === 'body') {
    m = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
    if (typeof document !== 'undefined') {
      const map = loadTexture(`${base()}horse_coat.jpg`);
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
      m.map = map;
      m.normalMap = loadTexture(`${base()}horse_coat_n.jpg`);
    }
  } else {
    // grzywa i ogon to pojedyncze płaty z maską — z obu stron, z wycinaniem po masce (bez sortowania przezroczystości)
    // grzywa i ogon: płaty z obu stron (osobne trójkąty w modelu) z normalnymi z sierści pod spodem, więc rysujemy
    // tylko przody; brzegi pasm z alphaToCoverage (miękkie przy wygładzaniu krawędzi zamiast ostrych schodków)
    m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.5, alphaTest: 0.35, alphaToCoverage: true, map: maskedTex('horse_hair') });
  }
  mats.set(part, m);
  return m;
}

/** Pojedynczy koń (podgląd modeli): dwie siatki, pozy przez `morphTargetInfluences` */
export function horseObject(): THREE.Group {
  const g = new THREE.Group();
  for (const part of ['body', 'hair'] as const) {
    const mesh = new THREE.Mesh(horseGeometry(part), horseMaterial(part));
    mesh.castShadow = true; mesh.receiveShadow = part === 'body';
    g.add(mesh);
  }
  return g;
}

/**
 * Wagi póz dla chwili `time` konia nr `id` (uwiązany, spokojny): na zmianę skubie trawę i podnosi łeb, czasem się
 * rozgląda, ogonem odgania muchy. `calm` (noc, deszcz) — stoi z łbem nisko, bez machania.
 * Skubanie idzie base → half → graze, żeby szyja nie skracała się w połowie (pozy mieszają się liniowo).
 */
export function horseWeights(time: number, id: number, calm: boolean, out: number[]): number[] {
  const ph = time * 0.11 + id * 1.7;
  // 0 = łeb w górze, 1 = przy trawie; długie skubanie, krótkie podniesienie łba
  const g = calm ? 0.45 : Math.min(1, Math.max(0, 0.5 + Math.sin(ph) * 1.6));
  out[0] = g < 0.5 ? g * 2 : 2 - g * 2;
  out[1] = g < 0.5 ? 0 : g * 2 - 1;
  // rozgląda się tylko z podniesionym łbem
  const look = Math.max(0, Math.sin(time * 0.07 + id * 2.3) * 2 - 1);
  out[2] = calm ? 0 : look * (1 - g);
  // ogon: krótkie machnięcia co kilka sekund
  const sw = Math.sin(time * 0.9 + id * 0.7);
  out[3] = calm ? 0 : sw > 0.6 ? Math.sin(time * 7 + id) * (sw - 0.6) * 2.5 : 0;
  return out;
}

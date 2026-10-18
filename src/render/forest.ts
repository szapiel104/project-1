import * as THREE from 'three';
import { model } from './modelstore';
import { loadTexture } from './ktx';
import { impostorFrom } from './impostors';

/**
 * Las z gotowych drzew Poly Haven (CC0, modele zrobione przez grafików), przerobionych w Blenderze skryptem
 * tools/models/forest_polyhaven.py: pień jako bryła, korona jako warstwy kart ze zdjęciami prawdziwej korony
 * (kilkadziesiąt trójkątów), z daleka obrazek z 8 stron. Rodzaje: dorosłe iglaki (jodła, sosna), stare liściaste,
 * młode jodły w podroście.
 */
type Packed = { pos: string; nrm: string; col: string; uv: string; idx: string };
type Variant = { species: string; role: 'conifer' | 'leaf' | 'sapling'; trunk: Packed; cards: Packed; shadow: Packed; far: { w: number; h: number }; avg: number[] };

const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const f32 = (u: Uint8Array): Float32Array => new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength));

function geo(m: Packed): THREE.BufferGeometry {
  const pos = b64(m.pos), nrm = b64(m.nrm), col = b64(m.col), uv = b64(m.uv), idx = b64(m.idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength)), 3, true));
  const lin = new Float32Array(col.length);
  for (let i = 0; i < col.length; i++) { const c = col[i]! / 255; lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  g.setAttribute('color', new THREE.BufferAttribute(lin, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)), 1));
  g.computeBoundingSphere();
  return g;
}

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const texCache = new Map<string, THREE.Texture>();
function tex(name: string, color = true): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  let t = texCache.get(name);
  if (!t) {
    t = loadTexture(`${base()}${name}.jpg`);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(name, t);
  }
  return t;
}

export interface TreeKind {
  name: string;
  role: Variant['role'];
  trunk: THREE.BufferGeometry;
  cards: THREE.BufferGeometry;
  shadow: THREE.BufferGeometry;
  barkMat: THREE.MeshStandardMaterial;
  cardMat: THREE.MeshStandardMaterial;
  far: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };
  /** wysokość modelu (bez skali instancji) */
  height: number;
}

let kinds: TreeKind[] | null = null;
/** Wszystkie odmiany z forest.json (geometrie i materiały tworzone raz) */
export function treeKinds(): TreeKind[] {
  if (kinds) return kinds;
  const data = model<Record<string, Variant>>('forest');
  kinds = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([name, v]) => {
    const cards = geo(v.cards);
    const box = new THREE.Box3().setFromBufferAttribute(cards.getAttribute('position') as THREE.BufferAttribute);
    const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, metalness: 0, map: tex(`pv_${name}_bark`), normalMap: tex(`pv_${name}_bark_n`, false) });
    // karty mają przód i tył jako osobne trójkąty z normalnymi od pnia, więc rysujemy tylko przednie strony
    const cardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, map: tex(`pv_${name}_cards`), alphaTest: 0.5 });
    const imp = impostorFrom(tex(`pv_${name}_far`) ?? new THREE.Texture(), v.far.w, v.far.h);
    return { name, role: v.role, trunk: geo(v.trunk), cards, shadow: geo(v.shadow), barkMat, cardMat, far: { geometry: imp.geometry, material: imp.material() }, height: box.max.y };
  });
  return kinds;
}

/** Odmiany danej roli (stała kolejność) */
export const kindsOf = (role: TreeKind['role']): TreeKind[] => treeKinds().filter((k) => k.role === role);

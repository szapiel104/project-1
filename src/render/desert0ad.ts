import * as THREE from 'three';
import { model, bytes } from './modelstore';
import { maskedTex } from './forest';

/**
 * Roślinność pustyni z gry 0 A.D. (© Wildfire Games, CC BY-SA 3.0), przeniesiona bez przeróbek skryptem
 * tools/models/desert_0ad.py (Michał 3.11.2026: „na pustyni przyszuszone trawy, kaktusy, palmy — wszystko pobierz
 * i dodaj”): palmy daktylowe (6 kształtów, 2 odmiany liści), uschnięte palmy, suche krzewy, rośliny pustynne i trawy.
 * Model ma wysokość 1, środek podstawy w zerze; gra skaluje go do rodzaju (HEIGHT niżej) i wielkości z mapy.
 */
export type PlantKind = 'palm' | 'deadpalm' | 'bush' | 'drybush' | 'desertplant' | 'grass';
interface Packed { name: string; kind: PlantKind; tex: string[]; w: number; pos: string; nrm: string; uv: string; idx: string }
export interface Plant { name: string; kind: PlantKind; tex: string[]; geo: THREE.BufferGeometry }

/** Wysokość w polach mapy przy skali 1 (palma wyraźnie nad chatą, krzaki do kolan–pasa, trawa do kostek) */
const HEIGHT: Record<PlantKind, number> = { palm: 3.6, deadpalm: 2.6, bush: 0.55, drybush: 0.45, desertplant: 0.4, grass: 0.32 };

const f32 = (u: Uint8Array): Float32Array => new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength));
function geoOf(m: Packed): THREE.BufferGeometry {
  const pos = bytes(m.pos), nrm = bytes(m.nrm), uv = bytes(m.uv), idx = bytes(m.idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength)), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)), 1));
  const h = HEIGHT[m.kind];
  // trawa z 0 A.D. bywa szerokim płatem (do 12× szerszym niż wysokim): taka idzie mniejsza, żeby płat miał ok. 1,5 pola
  const k = m.kind === 'grass' ? Math.min(h, 1.5 / Math.max(1, m.w)) : h;
  g.scale(k, k, k);
  g.computeBoundingSphere();
  return g;
}

let plants: Plant[] | null = null;
export function desertPlants(): Plant[] {
  if (plants) return plants;
  const d = model<{ plants: Packed[] }>('desert0ad');
  plants = d.plants.map((p) => ({ name: p.name, kind: p.kind, tex: p.tex, geo: geoOf(p) }));
  return plants;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
/** Materiał rośliny: zdjęcie z paczki i maska przezroczystości (dwa JPG, jak maskedTex), obie strony, ostre brzegi */
export function plantMaterial(tex: string): THREE.MeshStandardMaterial {
  let m = mats.get(tex);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  m.map = maskedTex(`oad_${tex}`);
  m.userData.noSeason = true; // pustynia: bez śniegu i rudych liści
  mats.set(tex, m);
  return m;
}

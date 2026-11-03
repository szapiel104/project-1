import * as THREE from 'three';
import { model, bytes } from './modelstore';

/**
 * Głazy i skały z gry 0 A.D. (© Wildfire Games, CC BY-SA 3.0), przeniesione bez przeróbek skryptem
 * tools/models/rocks_0ad.py: oryginalne trójkąty, UV, normalne i zdjęciowe tekstury z mapami nierówności.
 * Zastępują dawne trzy głazy z Blendera (Michał 3.11.2026: „czemu nie ma różnych wersji kamieni”): 23 kształty
 * w pięciu rodzajach — duże, średnie i małe bloki granitu, okrągłe głazy i wysokie, bruzdowane skały pustyni.
 * Skala modelu: najszerszy bok = 1 pole (gra mnoży to przez wielkość kamienia).
 */
export type RockKind = 'large' | 'medium' | 'small' | 'boulder' | 'furrowed';
export type RockTex = 'temperate' | 'sahara' | 'quarry';
interface Packed { name: string; kind: RockKind; tex: RockTex; h: number; pos: string; nrm: string; uv: string; idx: string }
export interface Rock { name: string; kind: RockKind; tex: RockTex; geo: THREE.BufferGeometry }

const f32 = (u: Uint8Array): Float32Array => new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength));
function geoOf(m: Packed): THREE.BufferGeometry {
  const pos = bytes(m.pos), nrm = bytes(m.nrm), uv = bytes(m.uv), idx = bytes(m.idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(f32(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength)), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(f32(uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)), 1));
  // mapa normalnych potrzebuje stycznych z UV (three.js liczy je w shaderze z pochodnych, ale z atrybutem jest równiej)
  return g;
}

let rocks: Rock[] | null = null;
export function rocks0ad(): Rock[] {
  if (rocks) return rocks;
  const d = model<{ rocks: Packed[] }>('rocks0ad');
  // 0,72: tyle, ile miał dawny głaz przy skali 1 — wielkości kamieni na mapie zostają te same
  rocks = d.rocks.map((r) => { const g = geoOf(r).scale(0.72, 0.72, 0.72); g.computeTangents(); g.computeBoundingSphere(); return { name: r.name, kind: r.kind, tex: r.tex, geo: g }; });
  return rocks;
}

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
const mats = new Map<RockTex, THREE.MeshStandardMaterial>();
/**
 * Materiał skały: zdjęcie i mapa nierówności z paczki (małe tekstury z paczek idą zwykłym JPG, nie KTX2 — CLAUDE.md).
 * Matowa skała, lekko ciepły odcień; na pustyni tekstura z Sahary niezależnie od kształtu.
 */
export function rockMaterial(tex: RockTex): THREE.MeshStandardMaterial {
  let m = mats.get(tex);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  if (typeof document !== 'undefined') {
    const tl = new THREE.TextureLoader();
    const map = tl.load(`${base()}oad_stone_${tex}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const nm = tl.load(`${base()}oad_stone_${tex}_n.jpg`);
    nm.anisotropy = 8; nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
    m.map = map; m.normalMap = nm; m.normalScale.set(1.2, 1.2);
  }
  mats.set(tex, m);
  return m;
}

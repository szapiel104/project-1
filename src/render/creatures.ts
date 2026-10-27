import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelGeo, type ModelMesh } from './peasants';
import { model, bytes } from './modelstore';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
const WOLF_MODEL = model('wolf');
const CROW_MODEL = model('crow');
const CROW2 = model('crow2');

/** Wilk z części (z Blendera, tools/models/wolf.py): tułów z łbem, łapa przednia i tylna (oś w barku/biodrze), kita (oś u nasady), oczy. Wspólne dla gry i galerii. */
export function wolfParts(): { body: THREE.BufferGeometry; leg: THREE.BufferGeometry; hindLeg: THREE.BufferGeometry; tail: THREE.BufferGeometry; eyes: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial } {
  const W = WOLF_MODEL as unknown as Record<'body' | 'leg' | 'hindLeg' | 'tail', ModelMesh[]>;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const eyes = mergeGeometries([new THREE.SphereGeometry(0.009, 6, 4).translate(-0.03, 0.502, 0.343), new THREE.SphereGeometry(0.009, 6, 4).translate(0.03, 0.502, 0.343)])!;
  return { body: modelGeo(W.body[0]!), leg: modelGeo(W.leg[0]!), hindLeg: modelGeo(W.hindLeg[0]!), tail: modelGeo(W.tail[0]!), eyes, mat };
}

/** Barki i biodra wilka (x, y, z) — tam zaczepione są łapy: dwie przednie, potem dwie tylne */
export const WOLF_HIPS: [number, number, number][] = [[-0.048, 0.35, 0.12], [0.048, 0.35, 0.12], [-0.05, 0.36, -0.19], [0.05, 0.36, -0.19]];
/** Nasada ogona */
export const WOLF_TAIL: [number, number, number] = [0, 0.385, -0.25];

/** Kruk z Blendera (tools/models/wolf.py): tułów, łeb z dziobem, złożone skrzydła, klinowy ogon, nogi — jedna siatka */
export function crowGeometry(): THREE.BufferGeometry {
  return modelGeo((CROW_MODEL as unknown as { body: ModelMesh[] }).body[0]!);
}

interface Crow2Mesh { pos: string; nrm: string; uv?: string; idx?: string }
const b64 = (s: string | Uint8Array): Uint8Array => bytes(s);
let crowCache: { stand: THREE.BufferGeometry; fly: THREE.BufferGeometry[]; mat: THREE.MeshStandardMaterial } | null = null;
/**
 * Kruk z gotowego modelu CC0 („Raven”, OpenGameArt; tools/models/crow_import.py): poza „stoi” i 8 klatek machania
 * skrzydłami (wspólne UV i trójkąty), tekstura piór public/textures/crow.png. Przód w +z, stopy na y = 0.
 */
export function crowParts(): { stand: THREE.BufferGeometry; fly: THREE.BufferGeometry[]; mat: THREE.MeshStandardMaterial } {
  if (crowCache) return crowCache;
  const C = CROW2 as unknown as { stand: Crow2Mesh; fly: Crow2Mesh[] };
  const uvB = b64(C.stand.uv!), idxB = b64(C.stand.idx!);
  const uv = new THREE.BufferAttribute(new Float32Array(uvB.buffer, uvB.byteOffset, uvB.byteLength / 4), 2);
  const index = new THREE.BufferAttribute(new Uint16Array(idxB.buffer.slice(idxB.byteOffset, idxB.byteOffset + idxB.byteLength)), 1);
  const geo = (m: Crow2Mesh): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    const p = b64(m.pos), n = b64(m.nrm);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(n.buffer, n.byteOffset, n.byteLength), 3, true));
    g.setAttribute('uv', uv);
    g.setIndex(index);
    g.computeBoundingSphere();
    return g;
  };
  const base = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './');
  const map = typeof document !== 'undefined' ? new THREE.TextureLoader().load(`${base}textures/crow.png`) : null;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
  // pióra kruka lekko połyskują granatowo
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  crowCache = { stand: geo(C.stand), fly: C.fly.map(geo), mat };
  return crowCache;
}

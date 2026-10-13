import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelGeo, type ModelMesh } from './peasants';
import WOLF_MODEL from './models/wolf.json';
import CROW_MODEL from './models/crow.json';

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

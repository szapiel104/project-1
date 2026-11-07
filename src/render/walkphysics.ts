import * as THREE from 'three';
import type { MeshBVH } from 'three-mesh-bvh';

/**
 * Spacer (pierwsza osoba): podłoże z budynków pod stopami — dachy, ganki, beczki, korony murów z modeli.
 * Promień w dół od wysokości `fromY` trafia w najwyższą powierzchnię siatki budynku pod punktem (x, z) w świecie.
 * Dzięki temu da się wskoczyć na dach, przejść po nim i zeskoczyć (Michał 6.11.2026: „skakać po dachach piechotą”).
 */
export interface WalkHit { mesh: THREE.Mesh; box: THREE.Box3 }

const ray = new THREE.Ray(), inv = new THREE.Matrix4(), p = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/** Najwyższa powierzchnia budynku pod (x, z) niżej niż fromY (świat); -Infinity, gdy pod spodem nic nie ma */
export function roofBelow(hits: readonly WalkHit[], x: number, z: number, fromY: number): number {
  let best = -Infinity;
  for (const { mesh, box } of hits) {
    if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z || box.min.y > fromY) continue;
    const tree = (mesh.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree;
    if (!tree) continue;
    inv.copy(mesh.matrixWorld).invert();
    ray.origin.set(x, fromY, z);
    ray.direction.copy(DOWN);
    ray.applyMatrix4(inv);
    const hit = tree.raycastFirst(ray, THREE.DoubleSide);
    if (!hit) continue;
    p.copy(hit.point).applyMatrix4(mesh.matrixWorld);
    if (p.y <= fromY + 1e-4 && p.y > best) best = p.y;
  }
  return best;
}

/** Jak wysoko wolno wejść jednym krokiem bez skoku (próg, stopień, krawędź dachu przy lądowaniu) */
export const WALK_STEP_UP = 0.16;
/** Prędkość wybicia w skoku: szczyt ok. 0,7 pola — z muru albo beczki na dach, z dachu na dach */
export const WALK_JUMP = 3.6;
export const WALK_GRAVITY = 9.5;

const fwd = new THREE.Vector3(), hitP = new THREE.Vector3();
/**
 * Odległość od `origin` do najbliższej ściany budynku wzdłuż `dir` (świat), nie dalej niż `max`; `max`, gdy nic nie stoi
 * na drodze. Pochodnia w ręce cofa się o tyle, żeby nie wchodzić w mur (Michał 7.11.2026: „jak mam pochodnię, wchodzi nią w budynek”).
 */
export function wallAhead(hits: readonly WalkHit[], origin: THREE.Vector3, dir: THREE.Vector3, max: number): number {
  let best = max;
  fwd.copy(dir).normalize();
  for (const { mesh, box } of hits) {
    // szybkie odrzucenie: ramka siatki dalej niż max od punktu
    if (box.distanceToPoint(origin) > max) continue;
    const tree = (mesh.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree;
    if (!tree) continue;
    inv.copy(mesh.matrixWorld).invert();
    ray.origin.copy(origin);
    ray.direction.copy(fwd);
    ray.applyMatrix4(inv);
    const hit = tree.raycastFirst(ray, THREE.DoubleSide);
    if (!hit) continue;
    hitP.copy(hit.point).applyMatrix4(mesh.matrixWorld);
    const d = hitP.distanceTo(origin);
    if (d < best) best = d;
  }
  return best;
}

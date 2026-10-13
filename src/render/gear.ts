import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint } from './loads';

/**
 * Broń chłopa. W dłoni (układ ramienia: oś w barku, dłoń 0,19 niżej, stylisko w przód z pięści) albo schowana
 * w układzie postaci: kilof skośnie przez plecy, drewniana maczuga zwisająca u prawego biodra.
 */
export function peasantGear(pick: THREE.BufferGeometry): { club: THREE.BufferGeometry; backPick: THREE.BufferGeometry; beltClub: THREE.BufferGeometry } {
  // maczuga: stylisko rozszerzające się w sękatą głowicę
  const clubParts = (): THREE.BufferGeometry[] => [
    tint(new THREE.CylinderGeometry(0.018, 0.012, 0.3, 6).rotateX(Math.PI / 2).translate(0, -0.19, 0.12), 0x7a5634),
    tint(new THREE.IcosahedronGeometry(0.042, 0).scale(1, 1, 1.4).translate(0, -0.19, 0.29), 0x5e4128),
    tint(new THREE.IcosahedronGeometry(0.016, 0).translate(0.03, -0.17, 0.27), 0x4a3320),
    tint(new THREE.IcosahedronGeometry(0.014, 0).translate(-0.028, -0.21, 0.31), 0x4a3320),
  ];
  const club = mergeGeometries(clubParts())!;
  // kilof: środek styliska w początek układu, pionowo, skośnie przez plecy
  // kilof przypięty płasko do pleców: stylisko lekko skośnie, grot w poprzek pleców przy lewym barku (nic nie sterczy w bok)
  const backM = new THREE.Matrix4().makeTranslation(0, 0.19, -0.16)
    .premultiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
    .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    .premultiply(new THREE.Matrix4().makeScale(0.78, 0.78, 0.78))
    .premultiply(new THREE.Matrix4().makeRotationZ(0.38))
    .premultiply(new THREE.Matrix4().makeTranslation(0, 0.3, -0.145));
  const backPick = pick.clone().applyMatrix4(backM);
  // maczuga u pasa: głowicą w dół przy prawym biodrze
  const beltM = new THREE.Matrix4().makeTranslation(0, 0.19, -0.2)
    .premultiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.15))
    .premultiply(new THREE.Matrix4().makeRotationZ(-0.12))
    .premultiply(new THREE.Matrix4().makeTranslation(0.115, 0.2, 0.02));
  const beltClub = mergeGeometries(clubParts())!.applyMatrix4(beltM);
  return { club, backPick, beltClub };
}

/** Kilof (w dłoni): stylisko i obustronny, lekko wygięty grot w poprzek */
export function pickGeometry(): THREE.BufferGeometry {
  return mergeGeometries([
    tint(new THREE.CylinderGeometry(0.014, 0.017, 0.42, 6).rotateX(Math.PI / 2).translate(0, -0.19, 0.16), 0x6e4a2c),
    tint(new THREE.BoxGeometry(0.026, 0.05, 0.035).translate(0, -0.19, 0.37), 0x4a4d52),
    tint(new THREE.ConeGeometry(0.016, 0.13, 4).rotateX(Math.PI).rotateX(0.25).translate(0, -0.27, 0.36), 0x6a6e76),
    tint(new THREE.ConeGeometry(0.016, 0.11, 4).rotateX(-0.25).translate(0, -0.12, 0.36), 0x6a6e76),
  ])!;
}

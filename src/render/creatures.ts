import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tint } from './loads';

/** Wilk z części: tułów, łapa (oś w biodrze), ogon (oś u nasady), oczy. Wspólne dla gry i galerii postaci. */
export function wolfParts(): { body: THREE.BufferGeometry; leg: THREE.BufferGeometry; tail: THREE.BufferGeometry; eyes: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial } {
  // smukły wilk: głęboka klatka, wcięty brzuch, długi pysk, stojące uszy; łapy i ogon osobno, żeby się ruszały
  const fur = 0x6a655d, back = 0x4a4640, belly = 0x8f8778, dark = 0x2e2b27;
  const body = mergeGeometries([
    tint(new THREE.CylinderGeometry(0.075, 0.095, 0.22, 8).rotateX(Math.PI / 2).translate(0, 0.33, 0.1), fur), // klatka
    tint(new THREE.CylinderGeometry(0.06, 0.075, 0.24, 8).rotateX(Math.PI / 2).translate(0, 0.335, -0.12), fur), // zad, wcięty
    tint(new THREE.BoxGeometry(0.1, 0.03, 0.44).translate(0, 0.41, 0), back), // ciemny grzbiet
    tint(new THREE.BoxGeometry(0.09, 0.03, 0.18).translate(0, 0.25, 0.1), belly), // jasna pierś
    tint(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 7).rotateX(-0.9).translate(0, 0.42, 0.25), fur), // kark
    tint(new THREE.BoxGeometry(0.11, 0.1, 0.11).translate(0, 0.47, 0.33), fur), // łeb
    tint(new THREE.BoxGeometry(0.055, 0.05, 0.13).translate(0, 0.44, 0.44), belly), // pysk
    tint(new THREE.BoxGeometry(0.03, 0.025, 0.02).translate(0, 0.455, 0.505), dark), // nos
    tint(new THREE.ConeGeometry(0.025, 0.07, 4).translate(-0.035, 0.55, 0.31), back),
    tint(new THREE.ConeGeometry(0.025, 0.07, 4).translate(0.035, 0.55, 0.31), back),
  ])!;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const leg = mergeGeometries([tint(new THREE.BoxGeometry(0.035, 0.26, 0.04).translate(0, -0.13, 0), fur), tint(new THREE.BoxGeometry(0.04, 0.03, 0.05).translate(0, -0.26, 0.01), dark)])!;
  const tail = mergeGeometries([tint(new THREE.CylinderGeometry(0.035, 0.015, 0.26, 6).translate(0, -0.13, 0), back)])!;
  const eyes = mergeGeometries([new THREE.SphereGeometry(0.012, 6, 4).translate(-0.032, 0.49, 0.39), new THREE.SphereGeometry(0.012, 6, 4).translate(0.032, 0.49, 0.39)])!;
  return { body, leg, tail, eyes, mat };
}

/** Biodra wilka (x, y, z) — tam zaczepione są łapy */
export const WOLF_HIPS: [number, number, number][] = [[-0.045, 0.32, 0.17], [0.045, 0.32, 0.17], [-0.045, 0.32, -0.17], [0.045, 0.32, -0.17]];
/** Nasada ogona */
export const WOLF_TAIL: [number, number, number] = [0, 0.37, -0.23];

/** Kruk: korpus, łeb, dziób, ogon, nogi */
export function crowGeometry(): THREE.BufferGeometry {
  const black = 0x15151a;
  return mergeGeometries([
    tint(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.8, 1.5).translate(0, 0.08, 0), black),
    tint(new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.13, 0.09), black),
    tint(new THREE.ConeGeometry(0.018, 0.07, 5).rotateX(Math.PI / 2).translate(0, 0.125, 0.15), 0x2a2a2a),
    tint(new THREE.BoxGeometry(0.06, 0.012, 0.1).translate(0, 0.08, -0.12), black),
    tint(new THREE.BoxGeometry(0.01, 0.05, 0.01).translate(-0.02, 0.025, 0), 0x333333),
    tint(new THREE.BoxGeometry(0.01, 0.05, 0.01).translate(0.02, 0.025, 0), 0x333333),
  ])!;
}

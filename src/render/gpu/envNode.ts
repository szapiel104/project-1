import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Mapa otoczenia na WebGPU (bliźniak makeEnvironment z postfx.ts): miękkie niebo nad jasnym horyzontem i ciemną
 * ziemią, przepuszczone przez PMREM — metal, szyby i mokre kamienie odbijają niebo, a nie czerń.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function makeGpuEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  try {
    const { W, TSL } = gpuMods!;
    const T = TSL as any, Wm = W as any;
    const { normalize, positionLocal, vec3, vec4, mix, pow, max, select } = T;
    const scene = new Wm.Scene();
    const d = normalize(positionLocal);
    const y = d.y;
    const zenith = vec3(0.52, 0.6, 0.72), horizon = vec3(0.86, 0.84, 0.78), ground = vec3(0.2, 0.17, 0.12);
    const up = mix(horizon, zenith, pow(max(y, 0), 0.6));
    const down = mix(horizon.mul(0.55), ground, pow(max(y.negate(), 0), 0.4));
    const mat = new Wm.MeshBasicNodeMaterial({ side: Wm.BackSide, depthWrite: false });
    mat.colorNode = vec4(select(y.greaterThan(0), up, down), 1);
    const dome = new Wm.Mesh(new Wm.SphereGeometry(10, 48, 24), mat);
    scene.add(dome);
    const pmrem = new Wm.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(scene, 0).texture;
    dome.geometry.dispose(); mat.dispose();
    return tex;
  } catch (e) { console.warn('[webgpu] mapa otoczenia niedostępna', e); return null; }
}

import type * as THREE from 'three';
import { gpuMods, instanceMatrixNode } from './webgpu';

/**
 * Drzewa z daleka na WebGPU (impostors.ts): czworokąt zwrócony do kamery (obrót tylko wokół pionu), z paska 8 klatek
 * zdjęcia drzewa wybrana ta, która pasuje do kierunku patrzenia i obrotu drzewa. Liściaste zimą — obrazek bez liści.
 * Macierz instancji czyta węzeł z obiektu, dla którego materiał jest składany (three.js składa osobno każdą pulę
 * instancji, więc dane się nie mieszają).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function impostorNode(o: { map: THREE.Texture; bare?: THREE.Texture | null; frames: number; color: THREE.Color; bareU: { value: number } }): THREE.MeshStandardMaterial {
  const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
  const { Fn, vec2, vec3, vec4, float, atan, floor, mod, normalize, length, positionGeometry, normalLocal,
    cameraPosition, modelWorldMatrix, uv, varying, texture, uniform, select } = T;
  const F = o.frames;
  const IM = Fn((_: unknown, b: any) => b.object?.instanceMatrix ? instanceMatrixNode(b.object.instanceMatrix) : T.mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1))();
  const ipos = IM.element(3).xyz;
  const wpos = modelWorldMatrix.mul(vec4(ipos, 1)).xyz;
  const tc0 = cameraPosition.sub(wpos);
  const tc = normalize(vec3(tc0.x, 0, tc0.z).add(vec3(1e-4, 0, 0)));
  const c0 = IM.element(0).xyz;
  const psi = atan(c0.z.negate(), c0.x);
  const fr = mod(floor(atan(tc.x, tc.z).sub(psi).div(6.2831853).mul(F).add(0.5)), F);
  const bsx = length(IM.element(0).xyz), bsy = length(IM.element(1).xyz);
  const pos = Fn(() => {
    normalLocal.assign(normalize(vec3(tc.x.mul(0.55), 0.83, tc.z.mul(0.55))));
    return ipos.add(vec3(tc.z, 0, tc.x.negate()).mul(positionGeometry.x).mul(bsx)).add(vec3(0, positionGeometry.y.mul(bsy), 0));
  })();
  const vUv = varying(vec2(uv().x.add(fr).div(F), uv().y));
  const m = new Wm.MeshStandardNodeMaterial({ alphaTest: 0.5, roughness: 1, metalness: 0, side: Wm.DoubleSide });
  m.color.copy(o.color);
  m.positionNode = pos;
  let tex: any = texture(o.map, vUv);
  if (o.bare) {
    const bareU = uniform(0).onFrameUpdate(() => o.bareU.value);
    tex = select(bareU.greaterThan(0.5), texture(o.bare, vUv), tex);
  }
  m.colorNode = tex.mul(vec4(T.materialColor.rgb ?? vec3(1), 1));
  void float;
  return m;
}

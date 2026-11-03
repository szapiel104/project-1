import type * as THREE from 'three';
import { gpuMods, instanceMatrixNode } from './webgpu';

/**
 * Postacie ze szkieletem na WebGPU (skinned.ts): ruch z zapieczonych klatek animacji w teksturze kości, mieszanie dwóch
 * klatek, pas w barwach drużyny. Jedna pula instancji na rodzaj postaci; cień rzuca ta sama poza (WebGPU liczy
 * mapę cieni z tego samego `positionNode`, bez osobnego materiału głębi).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function skinnedNode(src: THREE.MeshStandardMaterial, bones: THREE.DataTexture, mesh: THREE.InstancedMesh): THREE.MeshStandardMaterial {
  const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
  const { Fn, attribute, textureLoad, ivec2, int, mat4, vec4, vec3, float, mix, clamp, dot, normalize, positionGeometry,
    normalGeometry, normalLocal, varying, materialColor, texture } = T;
  const bt = texture(bones);
  const boneAt = (row: any, i: any): any => {
    const x = int(i).mul(4), y = int(row);
    return mat4(textureLoad(bt, ivec2(x, y)), textureLoad(bt, ivec2(x.add(1), y)), textureLoad(bt, ivec2(x.add(2), y)), textureLoad(bt, ivec2(x.add(3), y)));
  };
  const si = attribute('skinIndex', 'vec4'), sw = attribute('skinWeight', 'vec4');
  const skinAt = (row: any): any => boneAt(row, si.x).mul(sw.x).add(boneAt(row, si.y).mul(sw.y)).add(boneAt(row, si.z).mul(sw.z)).add(boneAt(row, si.w).mul(sw.w));
  const anim = attribute('aAnim', 'vec4');
  const IM = instanceMatrixNode(mesh.instanceMatrix);
  const pos = Fn(() => {
    const skm = skinAt(anim.x).mul(float(1).sub(anim.z)).add(skinAt(anim.y).mul(anim.z));
    const M = IM.mul(skm);
    normalLocal.assign(normalize(M.mul(vec4(normalGeometry, 0)).xyz));
    return M.mul(vec4(positionGeometry, 1)).xyz;
  })();
  const vTeam = varying(attribute('aTeam', 'vec3')), vTeamK = varying(attribute('teamMask', 'vec3').x);
  const m = new Wm.MeshStandardNodeMaterial({
    map: src.map, color: src.color, roughness: src.roughness, metalness: src.metalness, normalMap: src.normalMap,
    roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, aoMap: src.aoMap, emissive: src.emissive, emissiveMap: src.emissiveMap,
    side: src.side, transparent: src.transparent, alphaTest: src.alphaTest,
  });
  if (src.normalScale) m.normalScale.copy(src.normalScale);
  m.positionNode = pos;
  const c = materialColor;
  const lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  m.colorNode = vec4(mix(c.rgb, vTeam.mul(clamp(lum.mul(6).add(0.35), 0.35, 1)), vTeamK), c.a);
  return m;
}

import type * as THREE from 'three';
import { gpuMods, instanceMatrixNode } from './webgpu';

/**
 * Chmury na niebie (clouds.ts) na WebGPU: kłęby z jednej puli instancji, zwrócone do kamery w przestrzeni świata,
 * bledną przy granicy widzenia i przy samej kamerze, a gdzie dotykają czegoś w scenie — gasną miękko (bufor głębi).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function cloudNode(map: THREE.Texture, mesh: THREE.InstancedMesh): THREE.Material & { uniforms: Record<string, { value: any }> } {
  const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
  const { uniform, instancedBufferAttribute, vec3, vec4, float, normalize, cross, length, distance, smoothstep, mix, uv, texture,
    positionGeometry, cameraPosition, cameraViewMatrix, cameraProjectionMatrix, modelWorldMatrix, varying,
    viewportDepthTexture, screenUV, getViewPosition, cameraProjectionMatrixInverse, positionView } = T;
  const u = { lit: uniform(new Wm.Color(1, 1, 1)), shade: uniform(new Wm.Color(0.6, 0.64, 0.72)), haze: uniform(new Wm.Color(0.7, 0.72, 0.75)), far: uniform(300) };
  const IM = modelWorldMatrix.mul(instanceMatrixNode(mesh.instanceMatrix));
  const ic = instancedBufferAttribute(mesh.instanceColor!, 'vec3');
  const center = IM.element(3).xyz, s = length(IM.element(0).xyz);
  const toCam = normalize(cameraPosition.sub(center));
  const right = normalize(cross(vec3(0, 1, 0), toCam));
  const up = cross(toCam, right);
  const c = cameraViewMatrix.mul(vec4(center.add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(s)), 1));
  const fade = float(1).sub(smoothstep(u.far.mul(0.62), u.far.mul(0.93), c.z.negate())).mul(smoothstep(s.mul(1.1), s.mul(2.4), distance(cameraPosition, center)));
  const vC = varying(ic), vFade = varying(fade);
  const t = texture(map, uv());
  // miękko tam, gdzie kłąb wchodzi w górę albo drzewa (bufor głębi)
  const behind = getViewPosition(screenUV, viewportDepthTexture(screenUV).r, cameraProjectionMatrixInverse);
  const soft = smoothstep(0, 6, positionView.z.sub(behind.z));
  const a = t.a.mul(vC.y).mul(vFade).mul(soft);
  let col: any = mix(u.shade, u.lit, t.r).mul(mix(1, 0.55, vC.z));
  col = mix(u.haze, col, vFade.mul(0.65).add(0.35));
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  m.vertexNode = cameraProjectionMatrix.mul(c);
  m.colorNode = vec4(col, a);
  m.alphaTest = 0.008;
  m.uniforms = u;
  return m;
}

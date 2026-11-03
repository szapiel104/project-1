import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Kałuże (puddles.ts) i ślady na śniegu (footprints.ts) na WebGPU: węzły doklejane do ich zwykłych materiałów,
 * ta sama logika co w GLSL (brzeg kałuży zależny od wilgoci, błoto, zmarszczki i kręgi kropel; ślad blednie z wiekiem).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const live = (u: { value: number }): any => (gpuMods!.TSL as any).uniform(u.value).onFrameUpdate(() => u.value);

export function puddleNode(m: THREE.MeshStandardMaterial, u: { uWet: { value: number }; uRain: { value: number }; uTime: { value: number } }): void {
  if (!gpuMods) return;
  const T = gpuMods.TSL as any;
  const { attribute, varying, positionWorld, fract, sin, dot, vec2, vec3, vec4, floor, mix, smoothstep, step, clamp, max, length,
    materialColor, normalize, normalView, cameraViewMatrix, select, positionView } = T;
  const uWet = live(u.uWet), uRain = live(u.uRain), uTime = live(u.uTime);
  const hash = (p: any): any => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const noise = (p: any): any => { const i = floor(p), f0 = fract(p), f = f0.mul(f0).mul(f0.mul(-2).add(3));
    return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y); };
  const ripple = (p: any, t: any): any => {
    const cell = floor(p), f = fract(p).sub(0.5), h = hash(cell);
    const ph = fract(t.mul(0.9).add(h));
    const c = vec2(hash(cell.add(3.1)), hash(cell.add(7.3))).mul(0.5).sub(0.25);
    const d = f.sub(c), r = length(d);
    const wave = sin(r.sub(ph.mul(0.45)).mul(38)).mul(smoothstep(0, 0.05, ph.mul(0.45).sub(r).add(0.05))).mul(smoothstep(0.45, 0, r)).mul(ph.negate().add(1));
    return d.div(max(r, 1e-3)).mul(wave);
  };
  const pd = varying(attribute('pd', 'vec3'));
  const pw = positionWorld.xz;
  const pr = length(pd.xy);
  const edgeN = noise(pw.mul(3.1).add(pd.z.mul(17))).mul(0.28).add(noise(pw.mul(9)).mul(0.1));
  const reach = clamp(uWet.mul(1.5).sub(pd.z.mul(0.35)), 0, 1);
  const edge = reach.mul(edgeN.negate().add(0.92));
  const water = smoothstep(edge, edge.sub(0.1), pr).mul(step(0.02, reach));
  const mud = smoothstep(edge.add(0.22), edge, pr).mul(smoothstep(0, 0.25, reach));
  const col = mix(vec3(0.16, 0.12, 0.085), materialColor.rgb, water);
  (m as any).colorNode = vec4(col, materialColor.a.mul(max(water.mul(0.88), mud.mul(0.42))));
  (m as any).roughnessNode = mix(0.55, T.materialRoughness.add(noise(pw.mul(1.7)).mul(0.05)), water);
  let tilt: any = vec2(noise(pw.mul(2.3).add(uTime.mul(0.25))).sub(0.5), noise(pw.mul(2.3).sub(uTime.mul(0.21)).add(5)).sub(0.5)).mul(0.06);
  tilt = tilt.add(ripple(pw.mul(2.2), uTime).add(ripple(pw.mul(2.2).add(0.5), uTime.mul(1.13).add(0.4))).mul(0.22).mul(uRain).mul(step(0.02, uRain)));
  (m as any).normalNode = normalize(normalView.add(cameraViewMatrix.mul(vec4(tilt.x, 0, tilt.y, 0)).xyz.mul(water)));
  (m as any).alphaTest = 0.004;
  // zamiast polygonOffset: kałuża odsunięta ku kamerze o kilka cm w świecie (jak w GLSL)
  const mv = T.modelViewMatrix.mul(vec4(T.positionLocal, 1));
  const d = length(mv.xyz);
  const k = max(0, T.float(1).sub(d.mul(0.0025).add(0.05).div(max(d, 0.001))));
  (m as any).vertexNode = T.cameraProjectionMatrix.mul(vec4(mv.xyz.mul(k), 1));
  void select; void positionView;
  m.userData.gpuKey = 'puddles-gpu';
}

export function footprintNode(m: THREE.Material, map: THREE.Texture, alpha: number, hold: number, fade: number, uTime: { value: number }, uSnow: { value: number }): void {
  if (!gpuMods) return;
  const T = gpuMods.TSL as any;
  const { attribute, varying, texture, uv, clamp, smoothstep, select } = T;
  const t = live(uTime), s = live(uSnow);
  const age = t.sub(attribute('aBorn', 'float'));
  const vFade = varying(select(age.lessThan(0), T.float(0), T.float(1).sub(clamp(age.sub(hold).div(fade), 0, 1))));
  (m as any).opacityNode = texture(map, uv()).g.mul(vFade).mul(alpha).mul(smoothstep(0.45, 0.75, s));
  m.userData.gpuKey = `footprint-${alpha}`;
}

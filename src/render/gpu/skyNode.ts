import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Niebo na WebGPU (docs/webgpu.md, partia 5): kopuła i gwiazdy jako materiały węzłowe. Te same pokrętła co w sky.ts
 * (`material.uniforms.zenith.value` itd.), więc kod pory dnia i pogody działa bez zmian.
 * Gwiazdy: jedna siatka punktów, mruganie i wielkość liczone na karcie (każda gwiazda jako mały czworokąt).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type U = Record<string, { value: any }>;

export function skyDomeNode(): THREE.Material & { uniforms: U } {
  const { W, TSL } = gpuMods!;
  const T = TSL as any, Wm = W as any;
  const { uniform, vec3, vec4, float, mix, smoothstep, pow, max, dot, normalize, positionLocal } = T;
  const u = {
    zenith: uniform(new Wm.Color(0x3d6fb4)), horizon: uniform(new Wm.Color(0xc9d6e2)), fogCol: uniform(new Wm.Color(0xb4b7ae)),
    glow: uniform(new Wm.Color(0xffd9a0)), sun: uniform(new Wm.Vector3(0, 1, 0)), moon: uniform(new Wm.Vector3(0, 1, 0)),
    night: uniform(0), dusk: uniform(0), haze: uniform(0),
  };
  const d = normalize(positionLocal);
  const h = max(d.y, 0);
  let col: any = mix(u.horizon, u.zenith, pow(h, 0.45));
  // łuna o świcie i zmierzchu, najmocniej od strony słońca
  const sunSide = max(dot(normalize(vec3(d.x, 0, d.z)), normalize(vec3(u.sun.x, 0, u.sun.z))), 0);
  col = col.add(u.glow.mul(u.dusk).mul(pow(float(1).sub(h), 6)).mul(sunSide.mul(0.65).add(0.35)));
  // poświata słońca: szeroka i wąska
  const cs = max(dot(d, normalize(u.sun)), 0);
  const above = smoothstep(-0.15, 0.05, u.sun.y);
  col = col.add(u.glow.mul(above).mul(float(1).sub(u.haze.mul(0.7))).mul(pow(cs, 6).mul(0.35).add(pow(cs, 64).mul(0.6))));
  // poświata księżyca
  const cm = max(dot(d, normalize(u.moon)), 0);
  col = col.add(vec3(0.35, 0.42, 0.6).mul(u.night).mul(pow(cm, 24)).mul(0.5));
  // przy horyzoncie i niżej — kolor mgły nad ziemią
  col = mix(col, u.fogCol, smoothstep(0.08, -0.02, d.y));
  const m = new Wm.MeshBasicNodeMaterial({ side: Wm.BackSide, depthWrite: true, fog: false });
  m.colorNode = vec4(col, 1);
  // kopuła zawsze tuż przed tylną płaszczyzną kamery: przy krótszym zasięgu widoku (spacer) środek kopuły ucinała
  // tylna płaszczyzna i na niebie było widać okrągłą dziurę w kolorze tła (Michał 3.11.2026: „niebo to jakieś kółko”)
  const clip = T.cameraProjectionMatrix.mul(T.modelViewMatrix.mul(vec4(positionLocal, 1)));
  m.vertexNode = vec4(clip.xy, clip.w.mul(0.99995), clip.w);
  m.toneMapped = true;
  m.uniforms = u;
  return m;
}

/**
 * Gwiazdy: na WebGPU punkty większe niż piksel to czworokąty z instancji (Sprite z `count`), dane gwiazd z atrybutów
 * geometrii jako bufory instancji; mruganie i wielkość liczy karta.
 */
export function starsNode(geo: THREE.BufferGeometry): THREE.Object3D & { material: THREE.Material & { uniforms: U } } {
  const { W, TSL } = gpuMods!;
  const T = TSL as any, Wm = W as any;
  const { uniform, instancedBufferAttribute, sin, fract, smoothstep, length, uv, vec4 } = T;
  const u = { time: uniform(0), opacity: uniform(0) };
  const inst = (name: string, size: number): any => {
    const a = geo.getAttribute(name) as THREE.BufferAttribute;
    return instancedBufferAttribute(new Wm.InstancedBufferAttribute(a.array, size));
  };
  const phase = inst('phase', 1), size = inst('size', 1), color = inst('color', 3);
  const tw = sin(u.time.mul(fract(phase.mul(7.1)).mul(3).add(1.5)).add(phase)).mul(0.45).add(0.55);
  const a = smoothstep(0.5, 0, length(uv().sub(0.5)));
  const m = new Wm.PointsNodeMaterial({ transparent: true, depthWrite: false, fog: false, sizeAttenuation: false });
  m.positionNode = inst('position', 3);
  m.sizeNode = size.mul(tw.mul(0.5).add(0.7)).mul(1.3);
  // jasność gwiazdy i jej przezroczystość razem (dodawane do nieba, więc bez czarnych kropek za dnia)
  m.blending = Wm.AdditiveBlending;
  m.colorNode = vec4(color.mul(a).mul(tw).mul(u.opacity), 1);
  m.uniforms = u;
  const sprite = new Wm.Sprite(m);
  sprite.count = (geo.getAttribute('position') as THREE.BufferAttribute).count;
  sprite.frustumCulled = false;
  return sprite;
}

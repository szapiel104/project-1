import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Cząstki-punkty na WebGPU (dym z kominów, iskry, blask okien — ambience.ts). W WebGPU nie ma punktów większych niż
 * piksel, więc każda cząstka to czworokąt z instancji (Sprite z `count`) — jedno wywołanie rysowania na całą pulę.
 * Dane cząstek zostają w tych samych tablicach co dotąd (ten sam kod ruchu), tylko atrybuty geometrii stają się
 * buforami instancji, które karta czyta wprost.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function pointsSprite(geo: THREE.BufferGeometry, o: { map: THREE.Texture; additive: boolean; atlas: boolean; maxPx: number }): THREE.Object3D & { material: THREE.Material & { uniforms: Record<string, { value: any }> }; count: number } {
  const { W, TSL } = gpuMods!;
  const T = TSL as any, Wm = W as any;
  const { uniform, instancedBufferAttribute, texture, uv, vec2, vec3, vec4, float, min, max, floor, fract, mod, cos, sin, clamp,
    cameraViewMatrix, select, Discard, If, mix } = T;
  // atrybuty geometrii → bufory instancji (te same tablice; `needsUpdate` na nich działa jak dotąd)
  const inst = (name: string, size: number): any => {
    const a = geo.getAttribute(name) as THREE.BufferAttribute;
    const ia = new Wm.InstancedBufferAttribute(a.array, size);
    ia.setUsage(a.usage);
    geo.setAttribute(name, ia);
    return instancedBufferAttribute(ia);
  };
  const pos = inst('position', 3), size = inst('size', 1), alpha = inst('alpha', 1), tint = inst('tint', 3), spin = inst('spin', 1);
  const u = { scale: uniform(600), maxPx: uniform(o.maxPx), uAtlas: uniform(o.atlas ? 1 : 0) };
  const mvz = cameraViewMatrix.mul(vec4(pos, 1)).z;
  const m = new Wm.PointsNodeMaterial({ transparent: true, depthWrite: false, fog: !o.additive, sizeAttenuation: false,
    blending: o.additive ? Wm.AdditiveBlending : Wm.NormalBlending });
  m.positionNode = pos;
  m.sizeNode = min(size.mul(u.scale).div(max(0.1, mvz.negate())), u.maxPx);
  let tx: any;
  if (o.atlas) {
    // kłąb dymu: obrót o kąt cząstki, jedna z czterech komórek atlasu (część całkowita `spin`)
    const cell = floor(spin), ang = fract(spin).mul(6.2831853);
    const p0 = uv().sub(0.5);
    const cs = cos(ang), sn = sin(ang);
    const p = vec2(cs.mul(p0.x).sub(sn.mul(p0.y)), sn.mul(p0.x).add(cs.mul(p0.y))).mul(1.05).add(0.5);
    const inside = p.x.greaterThanEqual(0).and(p.y.greaterThanEqual(0)).and(p.x.lessThanEqual(1)).and(p.y.lessThanEqual(1));
    const off = vec2(mod(cell, 2), floor(cell.div(2))).mul(0.5);
    const t = texture(o.map, off.add(clamp(p, 0.01, 0.99).mul(0.5)));
    tx = vec4(mix(vec3(1), t.rgb, 0.85), select(inside, t.a, float(0)));
  } else tx = vec4(1, 1, 1, texture(o.map, uv()).a);
  const a = tx.a.mul(alpha);
  m.colorNode = o.additive ? vec4(tint.mul(tx.rgb).mul(a), 1) : vec4(tint.mul(tx.rgb), a);
  m.alphaTest = o.additive ? 0 : 0.004;
  void Discard; void If;
  m.uniforms = u;
  const sprite = new Wm.Sprite(m);
  sprite.count = (geo.getAttribute('position') as THREE.BufferAttribute).count;
  sprite.frustumCulled = false;
  return sprite;
}

/**
 * Padający śnieg (snowfall.ts): płatki jako czworokąty z instancji; ruch (opadanie, kołysanie, wiatr, zawinięcie
 * w pudle wokół widoku) liczy karta z ziarna płatka — procesor ustawia tylko kilka pokręteł na klatkę.
 */
export function snowSprite(seedArr: Float32Array, n: number): THREE.Object3D & { material: THREE.Material & { uniforms: Record<string, { value: any }> } } {
  const { W, TSL } = gpuMods!;
  const T = TSL as any, Wm = gpuMods!.W as any;
  void W;
  const { uniform, instancedBufferAttribute, vec3, vec4, float, sin, cos, floor, fract, step, abs, max, smoothstep, length, uv, cameraViewMatrix, varying } = T;
  const u = {
    uTime: uniform(0), uCenter: uniform(new Wm.Vector3()), uBox: uniform(new Wm.Vector3(70, 26, 70)), uScale: uniform(600),
    uWind: uniform(0.5), uAmount: uniform(0), uOpacity: uniform(0.9), uColor: uniform(new Wm.Color(0.95, 0.96, 1)),
  };
  const seed = instancedBufferAttribute(new Wm.InstancedBufferAttribute(seedArr, 4));
  const fall = seed.w.mul(0.8).add(0.6);
  let p: any = seed.xyz.mul(u.uBox);
  p = p.add(vec3(
    u.uTime.mul(u.uWind).mul(seed.w.mul(0.6).add(0.7)).add(sin(u.uTime.mul(seed.w.add(0.9)).add(seed.x.mul(40))).mul(0.35)),
    u.uTime.mul(fall).negate(),
    u.uTime.mul(u.uWind).mul(0.35).add(cos(u.uTime.mul(seed.y.add(0.7)).add(seed.z.mul(40))).mul(0.35))));
  const lo = u.uCenter.sub(u.uBox.mul(0.5));
  p = p.sub(u.uBox.mul(floor(p.sub(lo).div(u.uBox))));
  const mvz = cameraViewMatrix.mul(vec4(p, 1)).z;
  const on = step(fract(seed.x.mul(13.7).add(seed.z.mul(7.3))), u.uAmount);
  const e = abs(p.sub(u.uCenter)).div(u.uBox.mul(0.5));
  const edge = float(1).sub(smoothstep(0.75, 1, max(max(e.x, e.z), e.y)));
  const vA = varying(on.mul(edge).mul(smoothstep(0.6, 2.5, mvz.negate())));
  const m = new Wm.PointsNodeMaterial({ transparent: true, depthWrite: false, fog: true, sizeAttenuation: false });
  m.positionNode = p;
  m.sizeNode = seed.y.mul(0.05).add(0.045).mul(u.uScale).div(max(0.1, mvz.negate()));
  const d = length(uv().sub(0.5)).mul(2);
  m.colorNode = vec4(u.uColor, float(1).sub(smoothstep(0.35, 1, d)).mul(vA).mul(u.uOpacity));
  m.alphaTest = 0.01;
  m.uniforms = u;
  const sprite = new Wm.Sprite(m);
  sprite.count = n;
  sprite.frustumCulled = false;
  return sprite;
}

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

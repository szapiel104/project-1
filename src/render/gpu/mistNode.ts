import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Mgła w dolinach, opar na planszy i kłęby przy szczytach na WebGPU (docs/webgpu.md, partia 5) — te same pokrętła
 * `uniforms` co w highmist.ts, ale z tym, czego WebGL nie miał tanio: każda warstwa i kłąb gaśnie miękko tam, gdzie
 * dotyka czegokolwiek w scenie (bufor głębokości — „miękkie cząstki”), więc nie ma twardych linii na zboczach, drzewach
 * ani murach. Ruch kłębów liczy karta.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Mat = THREE.ShaderMaterial;

function common(): any {
  const { TSL } = gpuMods!;
  const T = TSL as any;
  // miękkie przecięcie z sceną: 0 tuż przy powierzchni za warstwą, 1 od `soft` metrów
  const softFade = (soft: number): any => {
    const { viewportDepthTexture, screenUV, getViewPosition, cameraProjectionMatrixInverse, positionView, smoothstep } = T;
    const behind = getViewPosition(screenUV, viewportDepthTexture(screenUV).r, cameraProjectionMatrixInverse);
    return smoothstep(0, soft, positionView.z.sub(behind.z));
  };
  return { T, softFade };
}

const hgt = (T: any, hMap: THREE.Texture, hBox: any, xz: any): any => T.texture(hMap, xz.sub(hBox.xy).div(hBox.zw)).r;

export function mistLayerNode(o: { hMap: THREE.Texture; hBox: THREE.Vector4; noise: THREE.Texture; thick: number; y: number; drift: THREE.Vector2; board: THREE.Vector4 }): Mat {
  const { T, softFade } = common();
  const Wm = gpuMods!.W as any;
  const { uniform, texture, vec2, vec4, smoothstep, mix, max, abs, positionWorld } = T;
  const u = {
    time: uniform(0), opacity: uniform(0), thick: uniform(o.thick), layerY: uniform(o.y), drift: uniform(o.drift),
    board: uniform(o.board), col: uniform(new Wm.Color(0xc8ccc4)), hBox: uniform(o.hBox),
  };
  const p = positionWorld.xz;
  const depth = u.layerY.sub(hgt(T, o.hMap, u.hBox, p));
  let a: any = smoothstep(0, u.thick, depth);
  const q = abs(p.sub(u.board.xy)).sub(u.board.zw);
  a = a.mul(smoothstep(2, 22, max(q.x, q.y)));
  const n1 = texture(o.noise, p.div(61).add(u.drift.mul(u.time))).r;
  const n2 = texture(o.noise, vec2(p.y, p.x.negate()).div(27).sub(u.drift.yx.mul(u.time).mul(1.7))).g;
  const n = n1.mul(0.65).add(n2.mul(0.45));
  a = a.mul(mix(smoothstep(0.28, 0.72, n), 1, smoothstep(u.thick.mul(0.6), u.thick.mul(2.2), depth).mul(0.55)));
  a = a.mul(softFade(1.5)).mul(u.opacity);
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: Wm.DoubleSide, fog: true });
  m.colorNode = vec4(u.col.mul(n1.mul(0.18).add(0.9)), a);
  m.alphaTest = 0.003;
  m.uniforms = u;
  return m;
}

export function mistDrapeNode(noise: THREE.Texture): Mat {
  const { T, softFade } = common();
  const Wm = gpuMods!.W as any;
  const { uniform, texture, vec2, vec4, smoothstep, attribute, distance, positionWorld, cameraPosition, varying } = T;
  const u = { time: uniform(0), opacity: uniform(0), col: uniform(new Wm.Color(0xc8ccc4)) };
  const v = varying(attribute('aV', 'float'));
  const p = positionWorld.xz;
  const n1 = texture(noise, p.div(34).add(vec2(u.time.mul(0.0016), u.time.mul(0.0009)))).r;
  const n2 = texture(noise, vec2(p.y, p.x.negate()).div(15).sub(vec2(u.time.mul(0.0011), u.time.mul(-0.0019)))).g;
  const n = n1.mul(0.7).add(n2.mul(0.45));
  let a: any = v.mul(v).mul(v.mul(-2).add(3)).mul(smoothstep(0.38, 0.9, n.add(v.mul(0.1))));
  a = a.mul(smoothstep(5, 24, distance(cameraPosition, positionWorld))).mul(u.opacity).mul(softFade(0.6));
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: Wm.DoubleSide, fog: true });
  m.colorNode = vec4(u.col.mul(n1.mul(0.16).add(0.92)), a);
  m.alphaTest = 0.003;
  m.uniforms = u;
  return m;
}

export function mistPuffNode(o: { hMap: THREE.Texture; hBox: THREE.Vector4; map: THREE.Texture }): Mat {
  const { T, softFade } = common();
  const Wm = gpuMods!.W as any;
  const {
    uniform, texture, vec3, vec4, float, smoothstep, mix, sin, cos, fract, select, attribute, distance, positionGeometry,
    cameraPosition, cameraWorldMatrix, varying, uv,
  } = T;
  const u = {
    time: uniform(0), amount: uniform(0.3), hBox: uniform(o.hBox),
    lit: uniform(new Wm.Color(0xeeeeea)), shade: uniform(new Wm.Color(0xa9aeb2)), spray: uniform(new Wm.Color(0xe8eef0)),
  };
  const c4 = attribute('aCenter', 'vec4'), mv = attribute('aMove', 'vec4'), kd = attribute('aKind', 'vec2');
  const ang = mv.y.add(u.time.mul(mv.z));
  const spray = kd.y.greaterThan(0.5);
  const f = fract(u.time.mul(0.35).add(mv.w));
  const base = c4.xyz.add(vec3(cos(ang), 0, sin(ang)).mul(mv.x));
  const center = base.add(vec3(0, select(spray, f.mul(1.3), sin(u.time.mul(0.13).add(mv.w.mul(2))).mul(0.6)), 0));
  const size0 = c4.w.mul(sin(u.time.mul(0.21).add(mv.w)).mul(0.12).add(0.88));
  const size = select(spray, size0.mul(f.mul(0.9).add(0.6)), size0);
  let a: any = select(spray, sin(f.mul(3.14159)).mul(0.3), smoothstep(kd.x, kd.x.add(0.18), u.amount));
  const camD = distance(cameraPosition, center);
  a = a.mul(smoothstep(size.mul(0.7).add(3), size.mul(1.6).add(9), camD));
  // osie ekranu kamery (z góry kłąb się nie kręci przy przesuwaniu widoku)
  const right = cameraWorldMatrix.element(0).xyz, up = cameraWorldMatrix.element(1).xyz;
  const wp = center.add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(size));
  const vA = varying(a), vK = varying(kd.y), vWP = varying(wp);
  const t = texture(o.map, uv());
  // miękki brzeg kłębu (ostre krawędzie wyglądały jak wycięte z papieru) i jaśniejszy, mniej siny kolor
  let alpha: any = smoothstep(0.02, 0.75, t.a).mul(t.a).mul(vA).mul(0.55).mul(smoothstep(-0.3, 2.2, vWP.y.sub(hgt(T, o.hMap, u.hBox, vWP.xz))));
  alpha = alpha.mul(softFade(3));
  let col: any = mix(u.shade, u.lit, t.r);
  col = select(vK.greaterThan(0.5), mix(col, u.spray, 0.35), col);
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true });
  m.positionNode = wp;
  m.colorNode = vec4(col, alpha);
  m.alphaTest = 0.004;
  void float;
  m.uniforms = u;
  return m;
}

import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Dywan trawy na WebGPU (grass.ts): kępy z czterech pochylonych kart, rozłożone po siatce przyklejonej do świata,
 * gęstość z maski pól i szumu, nachylenie terenu, wiatr, barwa podłoża pod kępą, suche źdźbła jesienią.
 * Wszystko liczy karta z jednej instancjonowanej siatki (jedno wywołanie rysowania), jak w GLSL.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GrassUniforms {
  uOrigin: { value: THREE.Vector2 }; uTime: { value: number }; uReach: { value: number }; uMap: { value: THREE.Vector2 }; uFade: { value: number };
  tNoise: { value: THREE.Texture }; tGround2: { value: THREE.Texture | null }; tH: { value: THREE.Texture }; tMask: { value: THREE.Texture };
  tBlade: { value: THREE.Texture }; tDry: { value: THREE.Texture }; gAutumn: { value: number }; gBare: { value: number }; tGround: { value: THREE.Texture | null };
}

export function grassNode(u0: GrassUniforms, o: { STEP: number; BASE: number; WEIGHTS: number[] }): THREE.MeshStandardMaterial {
  const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
  const {
    uniform, attribute, texture, textureLoad, ivec2, vec2, vec3, vec4, float, floor, fract, sin, cos, dot, mix, clamp, smoothstep,
    step, length, max, min, select, mod, positionGeometry, uv, varying, fwidth, log2, Fn,
  } = T;
  // pokrętła: te same obiekty `{ value }` co w grass.ts (czas, środek dywanu, zasięg) — węzły czytają je co klatkę
  const live = (src: { value: any }): any => uniform(src.value).onFrameUpdate(() => src.value);
  const uOrigin = live(u0.uOrigin), uTime = live(u0.uTime), uReach = live(u0.uReach), uMap = uniform(u0.uMap.value), uFade = live(u0.uFade);
  const gAutumn = live(u0.gAutumn), gBare = live(u0.gBare);
  const tH = texture(u0.tH.value), tMask = u0.tMask.value, tNoise = u0.tNoise.value;
  const STEP = o.STEP, BASE = o.BASE;
  const gHash = (p: any): any => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const gHeight = (p: any): any => {
    const c = clamp(p, vec2(0), uMap.sub(0.001));
    const i = floor(c), f = c.sub(i), ii = ivec2(i);
    const a = textureLoad(tH, ii).r, b = textureLoad(tH, ii.add(ivec2(1, 0))).r;
    const d = textureLoad(tH, ii.add(ivec2(0, 1))).r, e = textureLoad(tH, ii.add(ivec2(1, 1))).r;
    return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
  };
  const aCell = attribute('aCell', 'vec2'), aCard = attribute('aCard', 'float');
  const cell = floor(uOrigin.div(STEP)).add(aCell);
  const r1 = gHash(cell), r2 = gHash(cell.add(17.3)), r3 = gHash(cell.add(41.9));
  const p = cell.add(vec2(r1, r2)).mul(STEP);
  const mk = texture(tMask, p.div(uMap));
  const lush = mk.g;
  const pn = texture(tNoise, p.div(34).add(vec2(0.31, 0.77))).g.mul(0.75).add(texture(tNoise, p.div(7).add(vec2(0.13, 0.52))).b.mul(0.25));
  const gPatch = smoothstep(0.5, 0.66, pn.add(lush.mul(0.4)));
  const gr = vec2(gHeight(p.add(vec2(0.5, 0))).sub(gHeight(p.sub(vec2(0.5, 0)))), gHeight(p.add(vec2(0, 0.5))).sub(gHeight(p.sub(vec2(0, 0.5)))));
  const slopeK = float(1).sub(smoothstep(0.36, 0.7, length(gr)));
  const dens = mk.r.mul(slopeK).mul(mix(0.12, 0.85, gPatch));
  const rr = length(aCell).div(uReach.mul(BASE));
  const edge = float(1).sub(smoothstep(0.35, 0.97, rr.add(gHash(cell.add(5.5)).sub(0.5).mul(0.25))));
  const keep = step(r3, smoothstep(0.25, 0.9, dens).mul(1.1)).mul(step(gHash(cell.add(7.7)), edge));
  const sz = mix(0.26, 0.38, gHash(cell.add(3.7))).mul(keep).mul(mix(0.6, 1, edge)).mul(uFade).mul(mix(0.7, 1, gPatch))
    .mul(mix(1, 1.35, lush)).mul(mix(0.75, 1, slopeK));
  const gBase = vec3(p.x.sub(uMap.x.mul(0.5)), gHeight(p).sub(0.01), p.y.sub(uMap.y.mul(0.5)));
  // pole atlasu: losowanie z wagami; na rzadkiej trawie częściej siewki, przy wodzie wysokie źdźbła
  const pick = gHash(cell.add(23.1).add(aCard.mul(11.7)));
  let acc = 0;
  let tile: any = float(0);
  for (const wt of o.WEIGHTS.slice(0, -1)) { acc += wt; tile = tile.add(step(acc, pick)); }
  tile = select(dens.lessThan(0.5).and(gHash(cell.add(61.3)).lessThan(0.35)), float(6), tile);
  const lp1 = gHash(cell.add(83.9).add(aCard));
  tile = select(lp1.lessThan(lush.mul(0.55)), select(lp1.lessThan(lush.mul(0.3)), float(4), float(1)), tile);
  const flip = step(0.5, gHash(cell.add(3.3).add(aCard)));
  const uvv = uv();
  const tu = vec2(mix(uvv.x, float(1).sub(uvv.x), flip), uvv.y);
  const vAUv = varying(vec2(mod(tile, 4).add(clamp(tu.x, 0.004, 0.996)).div(4), float(1).sub(floor(tile.div(4))).add(clamp(tu.y, 0, 0.992)).div(2)));
  const vDry = varying(gHash(cell.add(77.7)));
  const lean = mix(0.68, 0.86, gHash(cell.add(13.1).add(aCard)));
  const hgt = sz.mul(mix(0.8, 1.1, r2));
  const pg = positionGeometry;
  const lp = vec3(pg.x.mul(sz), pg.y.mul(hgt).mul(cos(lean)), pg.y.mul(hgt).mul(sin(lean)).add(sz.mul(0.1)));
  const cy = r1.mul(6.2831).add(aCard.mul(1.5708)).add(gHash(cell.add(29.3).add(aCard)).sub(0.5).mul(0.6));
  let tr: any = vec3(lp.x.mul(cos(cy)).add(lp.z.mul(sin(cy))), lp.y, lp.x.negate().mul(sin(cy)).add(lp.z.mul(cos(cy))));
  const gust = sin(uTime.mul(1.6).add(p.x.mul(0.35)).add(p.y.mul(0.22))).mul(0.6).add(sin(uTime.mul(3.4).add(p.x.mul(1.7)).sub(p.y.mul(1.1))).mul(0.25));
  const vy2 = uvv.y.mul(uvv.y).mul(sz);
  tr = tr.add(vec3(gust.mul(0.05).mul(vy2), 0, gust.mul(0.025).mul(vy2))).add(gBase);
  const vGW = varying(tr.xz), vGUv = varying(uvv), vGTone = varying(gHash(cell.add(9.1)));

  // --- barwa: zdjęcie kępy ściągnięte do barwy i jasności podłoża pod nią, suche źdźbła jesienią
  const color = Fn(() => {
    const bl = texture(u0.tBlade.value, vAUv);
    const nM = texture(tNoise, vGW.div(96)), nS = texture(tNoise, vGW.div(23).add(0.37));
    let gc: any = u0.tGround.value ? texture(u0.tGround.value, vGW.div(3.1)).rgb : vec3(0.3, 0.38, 0.18);
    if (u0.tGround2.value) {
      const c2 = Math.cos(2.1), s2 = Math.sin(2.1);
      const r2v = vec2(vGW.x.mul(c2).sub(vGW.y.mul(s2)), vGW.x.mul(s2).add(vGW.y.mul(c2)));
      gc = mix(gc, texture(u0.tGround2.value, r2v.div(4.3)).rgb.mul(vec3(0.92, 0.9, 0.8)), smoothstep(0.38, 0.72, nM.r).mul(0.85));
    }
    const dryAmt = clamp(smoothstep(0.9, 1, vDry).mul(0.45).add(smoothstep(0.7, 0.9, nM.g).mul(0.3)).add(gAutumn.mul(1.2)).add(gBare)
      .sub(float(1).sub(vDry).mul(gAutumn).mul(0.6)), 0, 1);
    let col: any = mix(bl.rgb, texture(u0.tDry.value, vAUv).rgb, dryAmt);
    const lw = vec3(0.3, 0.59, 0.11);
    const gL = max(dot(gc, lw), 1e-3), cL = dot(col, lw);
    col = mix(col, cL.mul(gc).div(gL), mix(0.72, 0.15, dryAmt));
    col = col.mul(mix(1, clamp(gL.mul(3.2).div(max(cL, 1e-3)), 0.35, 1), 0.75));
    col = col.mul(nM.b.mul(0.3).add(0.84).add(nS.r.sub(0.5).mul(0.14))).mul(mix(0.9, 1.08, vGTone));
    col = mix(vec3(dot(col, lw)), col, 0.78).mul(vec3(0.96, 0.98, 0.86)).mul(0.66);
    col = col.mul(mix(0.8, 1, smoothstep(0, 0.6, vGUv.y)));
    // ostre krawędzie źdźbeł także z daleka (mipmapy rozmywają przezroczystość)
    const aLod = log2(max(max(fwidth(vAUv.x).mul(2048), fwidth(vAUv.y).mul(1024)), 1));
    let a: any = bl.a.mul(aLod.mul(0.45).add(1));
    a = a.sub(0.5).div(max(fwidth(a), 1e-4)).add(0.5);
    return vec4(col, clamp(a, 0, 1));
  });
  const m = new Wm.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: Wm.DoubleSide, alphaTest: 0.5 });
  m.positionNode = tr;
  m.colorNode = color();
  m.normalNode = T.transformNormalToView(vec3(0, 1, 0));
  void min;
  return m;
}

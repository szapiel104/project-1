import type * as THREE from 'three';
import { gpuMods } from './webgpu';
import { snowMix, type SeasonU } from './seasonNode';

/**
 * Bliźniak materiału ziemi w TSL (WebGPU, docs/webgpu.md, partia 2) — ta sama logika co GLSL w `ground.ts`
 * (FRAG_ALBEDO / FRAG_NORMAL): warstwy trawy, łąki, ściółki, żwiru, ziemi, skały i piasku mieszane po wysokości,
 * skała z trzech rzutów, normalne z tekstur, drobna faktura z bliska, półki i śnieg w górach, mokry brzeg, dno pod wodą,
 * plamy jasności. Zmiana w GLSL ziemi = ta sama zmiana tutaj (CLAUDE.md, „Przejście na WebGPU”).
 *
 * Jeszcze nie ma (dojdzie w kolejnych partiach): cienie chmur (światło), łatka pór roku (śnieg na ziemi, ślady).
 * Normalne: zwykłe tekstury `*_n` (WebGPU nie potrzebuje pakowania par z normalpack.ts — każda osobno).
 */
export interface GroundTextures {
  grass1: THREE.Texture; grass2: THREE.Texture; meadow: THREE.Texture; forest: THREE.Texture; pebble: THREE.Texture;
  dirt: THREE.Texture; rock: THREE.Texture; cliff: THREE.Texture; sand: THREE.Texture; noise: THREE.Texture;
  grassN: THREE.Texture; forestN: THREE.Texture; pebbleN: THREE.Texture; cliffN: THREE.Texture;
}

export function groundNodeMaterial(t: GroundTextures, season?: SeasonU): { material: THREE.MeshStandardMaterial; uniforms: { uDark: { value: number }; uDry: { value: number } } } {
  const { W, TSL } = gpuMods!;
  const {
    attribute, positionWorld, normalWorld, positionView, texture, uniform, vec2, vec3, float, mix, smoothstep, clamp, max,
    abs, pow, dot, length, normalize, sqrt, vertexColor, cameraViewMatrix, vec4,
  } = TSL as any;
  // typy węzłów TSL są bardzo szczegółowe (każda operacja inny typ) — tu wystarczy „jakiś węzeł”
  /* eslint-disable @typescript-eslint/no-explicit-any */
  type N = any;
  type V2 = any;
  type V3 = any;

  const uDark: any = uniform(1.0), uDry: any = uniform(0.0);
  const splat: any = attribute('splat', 'vec4');
  const sandA: any = attribute('sand', 'float');
  const wp: any = positionWorld, wn: any = normalWorld;
  const w = wp.xz;
  const lum = (c: V3): N => dot(c, vec3(0.299, 0.587, 0.114));
  const rot = (p: V2, a: number): V2 => { const s = Math.sin(a), c = Math.cos(a); return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c))); };
  const tx = (m: THREE.Texture, uv: V2): V3 => texture(m, uv).rgb;
  const unN = (v: V2): V3 => { const q = v.mul(2).sub(1); return vec3(q, sqrt(max(float(1).sub(dot(q, q)), 0))); };
  const ss = (a: number, b: number, x: N): N => smoothstep(a, b, x);

  const nM: any = texture(t.noise, w.div(96)), nS: any = texture(t.noise, w.div(23).add(0.37)), nD: any = texture(t.noise, w.div(6.5).add(0.71));
  const dist = length(positionView);

  // trawa
  const g1a = tx(t.grass1, w.div(3.1)), g1b = tx(t.grass1, rot(w, 0.9).div(9.7)), g2 = tx(t.grass2, rot(w, 2.1).div(4.3));
  const far = ss(18, 60, dist);
  let grass: V3 = mix(g1a, g1b, clamp(nS.b.mul(0.8).add(far.mul(0.6)).sub(0.15), 0, 1));
  grass = mix(grass, g2.mul(vec3(0.92, 0.9, 0.8)), ss(0.38, 0.72, nM.r).mul(0.85));
  const meadow = tx(t.meadow, rot(w, 0.4).div(4.6)).mul(vec3(0.84, 0.86, 0.8));
  const forest = tx(t.forest, rot(w, 1.3).div(4.2)).mul(vec3(1.04, 0.96, 0.84));
  const pebble = tx(t.pebble, rot(w, 2.6).div(2.9));
  let dirt: V3 = tx(t.dirt, rot(w, 0.2).div(4.5)).mul(vec3(1.02, 0.95, 0.86));
  const grit = tx(t.pebble, rot(w, 1.1).div(2.2)).mul(vec3(0.8, 0.74, 0.64));
  dirt = mix(dirt, grit, ss(0.3, 0.62, nD.a.mul(0.55).add(nS.b.mul(0.55))).mul(0.75));
  dirt = mix(dirt, forest.mul(vec3(0.92, 0.86, 0.8)), ss(0.5, 0.78, nS.g.mul(0.7).add(nD.r.mul(0.4))).mul(0.45));
  dirt = dirt.mul(ss(0.3, 0.7, nD.g).mul(0.22).add(0.86));

  // skała z trzech rzutów
  const an = abs(wn);
  const bw0 = pow(an, vec3(8));
  const bw = bw0.div(bw0.x.add(bw0.y).add(bw0.z));
  const uX = wp.zy, uZ = wp.xy, uT = rot(w, 0.6);
  const tri = (m: THREE.Texture, s: number, o = 0): V3 => tx(m, uX.div(s).add(o)).mul(bw.x).add(tx(m, uT.div(s).add(o)).mul(bw.y)).add(tx(m, uZ.div(s).add(o)).mul(bw.z));
  const cliff = tri(t.cliff, 8.5), cBig = tri(t.cliff, 26, 0.4);
  const layered = tx(t.rock, uX.div(7)).mul(bw.x).add(tx(t.rock, uZ.div(7)).mul(bw.z)).add(cliff.mul(bw.y));
  let rock: V3 = mix(cliff, cBig, 0.4);
  rock = mix(rock, layered.mul(1.15), ss(0.5, 0.8, nM.a).mul(0.5).mul(float(1).sub(bw.y)));
  rock = rock.mul(vec3(0.84, 0.8, 0.74)).mul(lum(rock).mul(0.42).add(0.72));
  rock = mix(rock, rock.mul(vec3(1.12, 0.96, 0.8)), ss(0.55, 0.85, nS.r).mul(0.35));
  rock = rock.mul(mix(vec3(1), vec3(1.2, 1.0, 0.74), uDry.mul(0.85)));

  // udziały warstw
  const wMeadow = ss(0.86, 1.02, nS.g.mul(0.75).add(nD.b.mul(0.3))).mul(0.5);
  let wPeb: N = clamp(splat.y.mul(wp.y.lessThan(0.1).select(ss(0.35, 0.6, nS.a).mul(1.4), float(1))).add(ss(0.99, 1.06, nD.a.mul(0.7).add(nS.r.mul(0.4))).mul(0.5)), 0, 1);
  let wForest: N = clamp(splat.x.mul(nS.a.mul(0.5).add(0.75)), 0, 1);
  let wDirt: N = clamp(splat.w.mul(1.15).add(ss(1.0, 1.08, nS.r.mul(0.6).add(nD.g.mul(0.5))).mul(0.5)), 0, 1);
  wDirt = wDirt.mul(mix(float(1), ss(0.18, 0.52, nD.r.mul(0.8).add(nS.a.mul(0.35))), 0.4));
  const wRock = max(clamp(splat.z, 0, 1), ss(0.82, 0.62, wn.y));
  let sandC: V3 = tx(t.sand, rot(w, 0.8).div(4)).mul(mix(vec3(0.98, 0.9, 0.72), vec3(1.1, 0.98, 0.78), uDry));
  sandC = sandC.mul(mix(float(1), nM.g.mul(0.2).add(0.9), uDry));
  const wSand = clamp(sandA.mul(1.1), 0, 1).mul(float(1).sub(wRock));
  wPeb = wPeb.mul(float(1).sub(wSand.mul(0.7))); wDirt = wDirt.mul(float(1).sub(wSand)); wForest = wForest.mul(float(1).sub(wSand));

  // mieszanie po wysokości
  const hG = lum(grass).mul(1.3).add(0.15), hM = lum(meadow).mul(1.2).add(0.1), hF = lum(forest), hP = lum(pebble).mul(1.15), hD = lum(dirt).mul(0.8), hR = lum(rock).add(0.3);
  const aG = float(1).sub(wMeadow).mul(float(1).sub(max(max(max(wForest, wDirt), max(wPeb, wRock)), wSand))).add(hG);
  const aM = wMeadow.mul(float(1).sub(max(max(wForest, wDirt), wRock))).mul(0.9).add(hM);
  const aF = wForest.mul(1.2).add(hF);
  const aP = wPeb.mul(1.3).add(hP).sub(0.45);
  const aD = wDirt.mul(1.25).add(hD);
  const aR = wRock.mul(1.6).add(hR).sub(0.4);
  const aS = wSand.mul(1.5).add(lum(sandC).mul(0.9)).sub(0.1);
  const top = max(max(max(aG, aM), max(aF, aP)), max(max(aD, aR), aS)).sub(0.22);
  const bG = max(aG.sub(top), 0), bM = max(aM.sub(top), 0), bF = max(aF.sub(top), 0), bP = max(aP.sub(top), 0), bD = max(aD.sub(top), 0), bR = max(aR.sub(top), 0), bS = max(aS.sub(top), 0);
  const sum = bG.add(bM).add(bF).add(bP).add(bD).add(bR).add(bS).add(1e-4);
  let alb: V3 = grass.mul(bG).add(meadow.mul(bM)).add(forest.mul(bF)).add(pebble.mul(bP)).add(dirt.mul(bD)).add(rock.mul(bR)).add(sandC.mul(bS)).div(sum);

  // drobna faktura z bliska
  const near = float(1).sub(ss(5, 24, dist));
  const det = lum(tx(t.grass2, rot(w, 1.7).div(0.85))), detD = lum(tx(t.pebble, rot(w, 2.9).div(0.9)));
  const dg = bG.add(bM).div(sum), dd = bD.add(bF).add(bP).div(sum);
  alb = alb.mul(mix(float(1), clamp(det.mul(2.3), 0.55, 1.45), near.mul(0.55).mul(dg))).mul(mix(float(1), clamp(detD.mul(2.4), 0.6, 1.4), near.mul(0.45).mul(dd)));

  // normalna z tekstur (x = świat X, y = świat Z, z = w górę)
  const nrm = (m: THREE.Texture, uv: V2): V3 => unN(texture(m, uv).xy);
  const tnG = nrm(t.grassN, w.div(3.1)), tnF = nrm(t.forestN, rot(w, 1.3).div(4.2)), tnP = nrm(t.pebbleN, rot(w, 2.6).div(2.9));
  const tnR = normalize(nrm(t.cliffN, uX.div(8.5)).mul(bw.x).add(nrm(t.cliffN, uT.div(8.5)).mul(bw.y)).add(nrm(t.cliffN, uZ.div(8.5)).mul(bw.z)));
  let gN: V3 = normalize(tnG.mul(bG.add(bM.mul(0.6))).add(tnF.mul(bF.add(bD.mul(0.4)).add(bM.mul(0.4)))).add(tnP.mul(bP.mul(1.4).add(bD.mul(0.9)).add(bS.mul(0.5)))).add(tnR.mul(bR.mul(1.3))).add(vec3(0, 0, 1).mul(bS.mul(0.6))).div(sum));
  const tnDet = nrm(t.grassN, rot(w, 1.7).div(0.85));
  gN = normalize(gN.add(vec3(tnDet.xy.mul(near.mul(0.8).mul(dg)), 0)));

  // półki i śnieg w górach
  const ledge = bR.div(sum).mul(ss(0.8, 0.95, wn.y)).mul(ss(0.45, 0.7, nS.b)).mul(float(1).sub(ss(9, 13, wp.y)));
  alb = mix(alb, mix(grass.mul(0.8), sandC, uDry), ledge.mul(0.85));
  const line = nM.g.mul(3).add(11.5).add(nD.r.sub(0.5).mul(1.5));
  let snow: N = smoothstep(line, line.add(1.4), wp.y).mul(mix(float(0.55), float(1), ss(0.3, 0.75, wn.y)));
  const snowC = vec3(0.78, 0.81, 0.86).mul(lum(rock).mul(0.45).add(0.8)).mul(nD.g.mul(0.16).add(0.9));
  snow = snow.mul(ss(0, 0.35, float(1).sub(lum(rock).mul(0.6)).add(nD.b.mul(0.4)).sub(0.3)).mul(0.5).add(0.5));
  alb = mix(alb, snowC, clamp(snow, 0, 1));
  gN = normalize(mix(gN, vec3(0, 0, 1), snow.mul(0.35)));
  // mokry brzeg i dno pod wodą
  const wetK = float(1).sub(ss(-0.12, 0.07, wp.y));
  alb = mix(alb, alb.mul(vec3(0.52, 0.5, 0.45)), wetK.mul(0.85));
  const under = smoothstep(-0.075, -0.16, wp.y);
  const bedN = nS.g.mul(0.6).add(nD.b.mul(0.5));
  let shallowBed: V3 = mix(sandC.mul(vec3(0.86, 0.8, 0.66)), pebble.mul(vec3(0.82, 0.77, 0.66)), ss(0.45, 0.75, bedN));
  shallowBed = mix(shallowBed, grit.mul(0.9), ss(0.62, 0.85, nD.a).mul(0.6));
  const silt = mix(dirt.mul(vec3(0.55, 0.53, 0.44)), forest.mul(vec3(0.46, 0.5, 0.36)), ss(0.4, 0.8, nM.r).mul(0.6));
  const deepK = smoothstep(-0.3, -0.95, wp.y.add(nS.a.sub(0.5).mul(0.35)));
  alb = mix(alb, mix(shallowBed, silt, deepK), under);
  gN = normalize(mix(gN, tnP, under.mul(float(1).sub(deepK)).mul(0.6)));
  // plamy jasności, fałszywe AO, suche łaty
  const macro = nM.b.mul(0.42).add(0.74).add(nS.r.sub(0.5).mul(0.16));
  const cav = mix(float(0.82), float(1.08), ss(0.08, 0.45, lum(alb)));
  alb = alb.mul(mix(mix(macro.mul(cav), macro.sub(0.95).mul(0.35).add(0.95), bS.div(sum)), float(1), bR.div(sum).mul(0.8))).mul(uDark);
  alb = mix(alb, alb.mul(vec3(1.12, 1.04, 0.78)), ss(0.62, 0.85, nM.g).mul(0.5).mul(bG).div(sum));

  const m = new W.MeshStandardNodeMaterial({ roughness: 0.97, metalness: 0 });
  let outC: any = alb.mul(vertexColor().rgb);
  // zima: śnieg na płaskim (wierzch z normalnej terenu), szron; jak `ground` w season.ts
  if (season) outC = snowMix(TSL as any, season, outC, wp.xz, wn.y).color;
  m.colorNode = vec4(outC, 1);
  // normalna: osie świata X i Z rzutowane na powierzchnię (jak FRAG_NORMAL), wynik w przestrzeni widoku
  const T = normalize(vec3(1, 0, 0).sub(wn.mul(wn.x)));
  const Bv = normalize(vec3(0, 0, 1).sub(wn.mul(wn.z)).sub(T.mul(dot(vec3(0, 0, 1), T))));
  const nWorld = normalize(T.mul(gN.x.mul(1.35)).sub(Bv.mul(gN.y.mul(1.35))).add(wn.mul(gN.z)));
  m.normalNode = normalize(cameraViewMatrix.mul(vec4(nWorld, 0)).xyz);
  return { material: m as unknown as THREE.MeshStandardMaterial, uniforms: { uDark, uDry } };
}

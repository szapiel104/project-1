import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Pory roku na WebGPU (season.ts): śnieg i szron na wierzchach brył, ziemi i trawie, wiosenna i letnia zieleń liści,
 * jesienne rude korony, gołe drzewa zimą. Te same pokrętła co w GLSL (SEASON_U), barwa doklejana do materiału jako
 * węzeł koloru (three.js przenosi go przy zamianie na materiał węzłowy).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type U = { value: any };
export interface SeasonU { uSnow: U; uFrost: U; uAutumn: U; uBare: U; uSpring: U; uSummer: U; uTrail: U; uTrailMap: U }

const live = (u: U): any => (gpuMods!.TSL as any).uniform(u.value).onFrameUpdate(() => u.value);

/** Szum plam (jak sPatch w GLSL) */
export function seasonNoise(T: any): { hash: (p: any) => any; val: (p: any) => any; patch: (p: any) => any } {
  const { fract, sin, dot, vec2, floor, mix } = T;
  const hash = (p: any): any => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
  const val = (p: any): any => {
    const i = floor(p), f0 = fract(p), f = f0.mul(f0).mul(f0.mul(-2).add(3));
    return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
  };
  const patch = (p: any): any => val(p.mul(0.28)).mul(0.55).add(val(p.mul(0.9).add(7.3)).mul(0.3)).add(val(p.mul(3.1).sub(2.1)).mul(0.15));
  return { hash, val, patch };
}

/** Śnieg na powierzchni (wierzch zależny od normalnej w świecie) — wspólne dla brył, ziemi i trawy */
export function snowMix(T: any, S: SeasonU, base: any, p: any, upY: any, trail: any = null): { color: any; amt: any } {
  const { smoothstep, max, mix, vec3, dot } = T;
  const { val, patch } = seasonNoise(T);
  const uSnow = live(S.uSnow), uFrost = live(S.uFrost);
  const sUp = smoothstep(0.45, 0.92, upY);
  const n = patch(p);
  let amt: any = sUp.mul(smoothstep(0, 0.1, uSnow.mul(1.25).sub(n.mul(-1).add(0.92)))).mul(0.9);
  amt = max(amt, uFrost.mul(0.3).mul(smoothstep(0.7, 0.95, upY)).mul(n.mul(0.5).add(0.5)));
  if (trail) amt = amt.mul(trail.mul(-0.65).add(1));
  const lum = dot(base, vec3(0.3, 0.59, 0.11));
  const drift = val(p.mul(1.7).add(3)).mul(0.6).add(val(p.mul(6).sub(1.3)).mul(0.4));
  const snowCol = mix(vec3(0.66, 0.71, 0.8), vec3(0.8, 0.82, 0.86), drift).mul(lum.sub(0.3).mul(0.22).add(0.94));
  return { color: mix(base, trail ? snowCol.mul(trail.mul(-0.25).add(1)) : snowCol, amt), amt };
}

/** Dokleja barwę pory roku do zwykłego materiału (rodzaj jak w seasonMaterial) */
export function seasonNode(m: THREE.Material, kind: string, S: SeasonU): void {
  if (!gpuMods || kind === 'grass' || kind === 'ground') return; // trawa i ziemia mają pory roku we własnych węzłach
  const T = gpuMods.TSL as any;
  const { materialColor, positionWorld, normalWorld, vec3, vec4, mix, clamp, dot, step, smoothstep } = T;
  const { hash } = seasonNoise(T);
  // materiał węzłowy z własną barwą (np. drzewa z daleka) — pora roku nakłada się na nią
  const own = (m as any).isNodeMaterial ? (m as any).colorNode : null;
  const c = own ?? materialColor;
  const p = positionWorld.xz;
  let col: any = c.rgb;
  let alpha: any = c.a;
  if (kind === 'leaf' || kind === 'leafFar') {
    const uSpring = live(S.uSpring), uSummer = live(S.uSummer), uAutumn = live(S.uAutumn), uBare = live(S.uBare), uSnow = live(S.uSnow);
    const cell = hash(T.floor(p.mul(0.9)));
    const lum = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, col.mul(vec3(1.12, 1.32, 0.62)).add(vec3(0.03, 0.05, 0)), uSpring.mul(0.85));
    col = mix(col, col.mul(vec3(0.78, 0.88, 0.7)), uSummer.mul(0.8));
    const fall = mix(mix(vec3(0.88, 0.58, 0.07), vec3(0.8, 0.32, 0.05), cell), vec3(0.55, 0.16, 0.05), cell.mul(cell)).mul(lum.mul(1.1).add(0.5));
    col = mix(col, fall, clamp(uAutumn.mul(cell.mul(0.35).add(0.75)), 0, 1));
    col = mix(col, vec3(0.42, 0.33, 0.24).mul(lum.add(0.6)), uBare.mul(0.8));
    col = mix(col, vec3(0.74, 0.78, 0.84), uSnow.mul(0.3).mul(smoothstep(0.2, 0.8, normalWorld.y)));
    if (kind === 'leaf') alpha = alpha.mul(step(uBare, 0.999)); // zimą liście znikają (w GLSL: korona zwinięta do zera)
  } else {
    const r = snowMix(T, S, col, p, normalWorld.y);
    col = r.color;
    (m as any).roughnessNode = mix(T.materialRoughness, 0.8, r.amt);
  }
  (m as any).colorNode = vec4(col, alpha);
  m.userData.gpuKey = `${(m.userData.gpuKey as string | undefined) ?? ''}|season-${kind}`;
}

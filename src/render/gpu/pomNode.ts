import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Głębia kamienia na WebGPU (bliźniak parallax.ts): parallax occlusion mapping w TSL. Współrzędne tekstury przesuwane
 * wzdłuż kierunku patrzenia krokami w głąb mapy wysokości, z tych współrzędnych kolor i mapa normalnych — fugi chowają
 * się za licami ciosów. Układ stycznej z pochodnych położenia i UV w pikselu (bez stycznych w siatce), odczyty z
 * gradientem (stałe mipmapy w pętli), pod ostrym kątem głębia gaśnie (bez smug i migania na krawędziach blanków).
 *
 * Węzły powstają leniwie, przy pierwszym rysowaniu (three.js kopiuje wtedy pola materiału do materiału węzłowego):
 * materiały budynków bywają tworzone, zanim silnik WebGPU jest gotowy.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function pomGpu(m: THREE.MeshStandardMaterial, height: THREE.Texture, scale: number, steps: number): void {
  let built: { color: any; normal: any } | null = null;
  const build = (): { color: any; normal: any } | null => {
    if (built) return built;
    if (!gpuMods || !m.map) return null;
    const T = gpuMods.TSL as any;
    const { Fn, uv, texture, vec3, float, normalize, cross, dot, max, smoothstep, mix, clamp, positionView, dFdx, dFdy,
      inverseSqrt, Loop, If, Break, normalMap, uniform } = T;
    const map = m.map;
    map.updateMatrix();
    const pomUV = Fn(() => {
      const uv0 = texture(map).getTransformedUV(uv()).toVar();
      const q0 = dFdx(positionView), q1 = dFdy(positionView);
      const s0 = dFdx(uv0), s1 = dFdy(uv0);
      const N = normalize(cross(q0, q1));
      const q1p = cross(q1, N), q0p = cross(N, q0);
      const Tn = q1p.mul(s0.x).add(q0p.mul(s1.x));
      const Bn = q1p.mul(s0.y).add(q0p.mul(s1.y));
      const k = inverseSqrt(max(max(dot(Tn, Tn), dot(Bn, Bn)), 1e-20));
      const V = normalize(positionView.negate());
      const vt = vec3(dot(V, Tn.mul(k)), dot(V, Bn.mul(k)), dot(V, N));
      const fade = smoothstep(0.35, 0.75, vt.z);
      // więcej kroków pod ostrzejszym kątem (mniej „schodków” warstw)
      const n = mix(float(steps * 2), float(steps), clamp(vt.z, 0, 1)).floor();
      const layer = float(1).div(n);
      const delta = vt.xy.div(max(vt.z, 0.5)).mul(scale).mul(fade).mul(layer);
      const H = (p: any): any => float(1).sub(texture(height, p).grad(s0, s1).r);
      const p = uv0.toVar(), cur = float(0).toVar(), depth = H(uv0).toVar();
      Loop(steps * 2, ({ i }: any) => {
        If(cur.greaterThanEqual(depth).or(float(i).greaterThanEqual(n)).or(fade.lessThanEqual(0)), () => { Break(); });
        p.subAssign(delta);
        depth.assign(H(p));
        cur.addAssign(layer);
      });
      const back = p.add(delta);
      const after = depth.sub(cur);
      const before = H(back).sub(cur).add(layer);
      const w = after.div(after.sub(before).add(1e-5));
      return mix(p, back, clamp(w, 0, 1));
    })().toVar();
    // barwa i siła normalnych jako zwykłe uniformy z obiektów materiału (materialReference czytał je z materiału, który
    // akurat rysuje — przy cieniach i przejściach bez koloru wywracał całą grę, 0.94.9)
    const color = texture(map, pomUV).mul(uniform(m.color));
    const normal = m.normalMap ? normalMap(texture(m.normalMap, pomUV), uniform(m.normalScale)) : null;
    built = { color, normal };
    return built;
  };
  // klucz z numerem materiału: węzły niosą tę konkretną teksturę i barwę (uniform/texture), a three.js dzieli złożony
  // shader między materiałami o tym samym kluczu — ze wspólnym kluczem wszystkie mury dostałyby teksturę pierwszego
  m.userData.gpuKey = `pom${steps}-${m.uuid}`;
  Object.defineProperty(m, 'colorNode', { configurable: true, enumerable: true, get: () => build()?.color ?? null, set: () => undefined });
  if (m.normalMap) Object.defineProperty(m, 'normalNode', { configurable: true, enumerable: true, get: () => build()?.normal ?? null, set: () => undefined });
}

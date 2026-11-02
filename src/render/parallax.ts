import * as THREE from 'three';

/**
 * Głębia kamienia (Michał 2.11.2026: „tekstury na zamku, wieżach, kamienia nie mają 3D głębi”).
 *
 * Parallax occlusion mapping: przed odczytem koloru i mapy normalnych przesuwamy współrzędne tekstury wzdłuż kierunku
 * patrzenia, krokami w głąb mapy wysokości (`*_h.jpg` z tools/textures/gen_stone.py). Fugi i krawędzie ciosów chowają
 * się wtedy za wypukłymi licami jak w prawdziwym murze, a nie są tylko namalowane. Bez stycznych w siatce: układ
 * stycznej liczony w pikselu z pochodnych położenia i UV (jak perturbNormal2Arb w three.js), więc działa na każdym
 * modelu z Blendera. Odczyty przez textureGrad (stałe pochodne), żeby pętla nie psuła mipmap.
 *
 * `scale` — głębokość w jednostkach UV (ok. 0,02–0,04: fuga kilka cm przy ciosie ok. 40 cm).
 */
export function applyParallax(m: THREE.MeshStandardMaterial, height: THREE.Texture, scale: number, steps = 14): void {
  m.userData.parallax = { height, scale, steps };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (this: THREE.Material, sh, r) {
    prev.call(this, sh, r);
    sh.uniforms.uPomHeight = { value: height };
    sh.uniforms.uPomScale = { value: scale };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uPomHeight;
uniform float uPomScale;
vec2 pomUv(vec2 uv0) {
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 s0 = dFdx(uv0), s1 = dFdy(uv0);
  vec3 N = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * s0.x + q0p * s1.x;
  vec3 B = q1p * s0.y + q0p * s1.y;
  float d = max(dot(T, T), dot(B, B));
  if (d == 0.0) return uv0;
  float k = inversesqrt(d);
  T *= k; B *= k;
  vec3 V = normalize(vViewPosition);
  vec3 vt = vec3(dot(V, T), dot(V, B), dot(V, N));
  // pod ostrym kątem (ściana widziana prawie z boku) głębia słabnie do zera: inaczej wzór się rozciąga w smugi
  // i krawędzie małych brył (blanki, gzymsy) migają (Michał 2.11.2026: „mury mrugają, nachodzą na siebie”)
  float fade = smoothstep(0.35, 0.75, vt.z);
  if (fade <= 0.0) return uv0;
  const int STEPS = ${steps};
  float layer = 1.0 / float(STEPS);
  vec2 delta = vt.xy / max(vt.z, 0.5) * uPomScale * fade * layer;
  vec2 uv = uv0;
  float cur = 0.0;
  float depth = 1.0 - textureGrad(uPomHeight, uv, s0, s1).r;
  for (int i = 0; i < STEPS; i++) {
    if (cur >= depth) break;
    uv -= delta;
    depth = 1.0 - textureGrad(uPomHeight, uv, s0, s1).r;
    cur += layer;
  }
  vec2 back = uv + delta;
  float after = depth - cur;
  float before = (1.0 - textureGrad(uPomHeight, back, s0, s1).r) - cur + layer;
  float w = after / (after - before + 1e-5);
  return mix(uv, back, clamp(w, 0.0, 1.0));
}`)
      .replace('void main() {', 'void main() {\n#ifdef USE_MAP\n  vec2 pomUV = pomUv(vMapUv);\n#endif')
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace(/vMapUv/g, 'pomUV'))
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g, 'pomUV'));
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|pom${steps}`;
  m.needsUpdate = true;
}

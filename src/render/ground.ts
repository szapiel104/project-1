import * as THREE from 'three';
import { TEST } from '../testmode';

/**
 * Podłoże jak w nowych silnikach: kilka zdjęciowych warstw (dwie trawy, łąka z ziemią i kamykami, ściółka leśna,
 * żwir, wydeptana ziemia, skała) mieszanych w shaderze.
 * - Udział warstw: atrybut `splat` (las, żwir, skała, wydeptanie) z mapy gry plus szum w dużej i średniej skali,
 *   który na zwykłej łące rozrzuca plamy kępiastej trawy, prześwity ziemi i drobne kamienie.
 * - Mieszanie po wysokości: na granicy warstw wygrywa to, co wystaje (kamyk z ziemi, kępa z gleby), więc przejścia
 *   są poszarpane, a nie rozmyte.
 * - Anty-kafelkowanie: trawa próbkowana w dwóch skalach i pod innym kątem, a całość przyciemniana i rozjaśniana
 *   wielkimi plamami (tu ciemniej, tam jaśniej), żeby nie było jednej świecącej planszy.
 * - Skała na stromych zboczach jest rzutowana z boku (bez rozciągniętych smug).
 * Kolor wierzchołka zostaje jako delikatny mnożnik (śnieg, ruda, plamy jasności).
 */
const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/terrain/';

const loader = typeof document !== 'undefined' ? new THREE.TextureLoader() : null;
const cache = new Map<string, THREE.Texture>();
function tex(name: string, color: boolean): THREE.Texture {
  let t = cache.get(name);
  if (t) return t;
  t = loader!.load(base() + name + '.jpg?v=4'); // numer wersji: przeglądarka nie trzyma starego zdjęcia po podmianie
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, t);
  return t;
}

/** Zawijający się szum wartości w czterech kanałach o różnej częstotliwości (plamy, kępy, drobiazg) */
function noiseTexture(): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  let s = 1234567;
  const rnd = (): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const layer = (cells: number): Float32Array => { const a = new Float32Array(cells * cells); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const sample = (v: Float32Array, cells: number, x: number, y: number): number => {
    const fx = (x / N) * cells, fy = (y / N) * cells;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    const a = v[y0 * cells + x0]! * (1 - sx) + v[y0 * cells + x1]! * sx;
    const b = v[y1 * cells + x0]! * (1 - sx) + v[y1 * cells + x1]! * sx;
    return a * (1 - sy) + b * sy;
  };
  const fbm = (oct: number[]): ((x: number, y: number) => number) => {
    const ls = oct.map((c) => ({ c, v: layer(c) }));
    return (x, y) => { let v = 0, a = 0.5, sum = 0; for (const l of ls) { v += sample(l.v, l.c, x, y) * a; sum += a; a *= 0.5; } return v / sum; };
  };
  const ch = [fbm([4, 8, 16, 32]), fbm([6, 12, 24, 48]), fbm([8, 16, 32, 64]), fbm([16, 32, 64, 128])];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      for (let c = 0; c < 4; c++) {
        // rozciągamy kontrast: szum fbm skupia się wokół 0,5
        const v = (ch[c]!(x, y) - 0.5) * 2.2 + 0.5;
        data[(y * N + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const VERT_HEAD = /* glsl */ `
attribute vec4 splat;
varying vec4 vSplat;
varying vec3 vWP;
varying vec3 vWN;
`;
const VERT_BODY = /* glsl */ `
vSplat = splat;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_HEAD = /* glsl */ `
uniform sampler2D tGrass1, tGrass2, tMeadow, tForest, tPebble, tDirt, tRock, tCliff, tNoise;
uniform sampler2D nGrass, nForest, nPebble, nRock;
uniform float uDark;
varying vec4 vSplat;
varying vec3 vWP;
varying vec3 vWN;
vec3 gNormal;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 rot(vec2 p, float a) { float s = sin(a), c = cos(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
`;

/** Liczy kolor podłoża i odkłada normalną z tekstur do gNormal (przestrzeń: x = świat X, y = świat Z, z = w górę) */
const FRAG_ALBEDO = /* glsl */ `
{
  vec2 w = vWP.xz;
  vec4 nM = texture2D(tNoise, w / 96.0);
  vec4 nS = texture2D(tNoise, w / 23.0 + 0.37);
  vec4 nD = texture2D(tNoise, w / 6.5 + 0.71);
  float dist = length(vViewPosition);

  // trawa: dwa zdjęcia w dwóch skalach, mieszane plamami; z daleka większa skala (bez powtórek)
  vec3 g1a = texture2D(tGrass1, w / 3.1).rgb;
  vec3 g1b = texture2D(tGrass1, rot(w, 0.9) / 9.7).rgb;
  vec3 g2 = texture2D(tGrass2, rot(w, 2.1) / 4.3).rgb;
  float far = smoothstep(18.0, 60.0, dist);
  vec3 grass = mix(g1a, g1b, clamp(nS.b * 0.8 + far * 0.6 - 0.15, 0.0, 1.0));
  grass = mix(grass, g2 * vec3(0.92, 0.9, 0.8), smoothstep(0.38, 0.72, nM.r) * 0.85);
  vec3 meadow = texture2D(tMeadow, rot(w, 0.4) / 4.6).rgb * vec3(0.84, 0.86, 0.8);
  vec3 forest = texture2D(tForest, rot(w, 1.3) / 4.2).rgb * vec3(1.04, 0.96, 0.84);
  vec3 pebble = texture2D(tPebble, rot(w, 2.6) / 2.9).rgb;
  vec3 dirt = texture2D(tDirt, rot(w, 0.2) / 4.5).rgb * vec3(0.95, 0.9, 0.84);
  // skała: rzut z boku na stromych ścianach, z góry na płaskim
  vec3 an = abs(vWN);
  vec3 rTop = texture2D(tRock, w / 6.0).rgb;
  vec3 rX = texture2D(tRock, vWP.zy / 6.0).rgb;
  vec3 rZ = texture2D(tRock, vWP.xy / 6.0).rgb;
  vec3 bw = pow(an, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 rock = rX * bw.x + rTop * bw.y + rZ * bw.z;
  // druga skała (poszarpane turnie) w wielkich płatach i warstwy jaśniejsze/ciemniejsze wzdłuż wysokości
  vec3 cX = texture2D(tCliff, vWP.zy / 7.5).rgb, cZ = texture2D(tCliff, vWP.xy / 7.5).rgb, cT = texture2D(tCliff, w / 7.5).rgb;
  vec3 cliff = (cX * bw.x + cT * bw.y + cZ * bw.z) * vec3(0.78, 0.76, 0.72);
  rock = mix(rock, cliff, smoothstep(0.35, 0.65, nM.a));
  float strata = texture2D(tNoise, vec2(vWP.y / 3.2, w.x / 140.0 + w.y / 170.0)).g;
  rock *= 0.78 + strata * 0.4;

  // udziały: łąka w plamach, drobne kamienie i prześwity ziemi rozsiane po trawie
  float wMeadow = smoothstep(0.86, 1.02, nS.g * 0.75 + nD.b * 0.3) * 0.5;
  float wPeb = clamp(vSplat.y * (vWP.y < 0.1 ? smoothstep(0.35, 0.6, nS.a) * 1.4 : 1.0) + smoothstep(0.99, 1.06, nD.a * 0.7 + nS.r * 0.4) * 0.5 + vSplat.w * smoothstep(0.6, 0.85, nD.r) * 0.45, 0.0, 1.0);
  float wForest = clamp(vSplat.x * (0.75 + nS.a * 0.5), 0.0, 1.0);
  float wDirt = clamp(vSplat.w * 1.15 + smoothstep(1.0, 1.08, nS.r * 0.6 + nD.g * 0.5) * 0.5, 0.0, 1.0);
  float wRock = clamp(vSplat.z, 0.0, 1.0);
  float steep = smoothstep(0.82, 0.62, vWN.y);
  wRock = max(wRock, steep);

  // mieszanie po wysokości (jaśniejsze = wystaje): przejścia poszarpane, kamyki wychodzą z ziemi
  float hG = lum(grass) * 1.3 + 0.15, hM = lum(meadow) * 1.2 + 0.1, hF = lum(forest), hP = lum(pebble) * 1.15, hD = lum(dirt) * 0.8, hR = lum(rock) + 0.3;
  float aG = (1.0 - wMeadow) * (1.0 - max(max(wForest, wDirt), max(wPeb, wRock))) + hG;
  float aM = wMeadow * (1.0 - max(max(wForest, wDirt), wRock)) * 0.9 + hM;
  float aF = wForest * 1.2 + hF;
  float aP = wPeb * 1.3 + hP - 0.45;
  float aD = wDirt * 1.25 + hD;
  float aR = wRock * 1.6 + hR - 0.4;
  float top = max(max(max(aG, aM), max(aF, aP)), max(aD, aR)) - 0.22;
  float bG = max(aG - top, 0.0), bM = max(aM - top, 0.0), bF = max(aF - top, 0.0), bP = max(aP - top, 0.0), bD = max(aD - top, 0.0), bR = max(aR - top, 0.0);
  float sum = bG + bM + bF + bP + bD + bR + 1e-4;
  vec3 alb = (grass * bG + meadow * bM + forest * bF + pebble * bP + dirt * bD + rock * bR) / sum;

  // z bliska drobna faktura w dużo mniejszej skali: więcej szczegółu na metr (ostrzej, mniej płasko)
  float near = 1.0 - smoothstep(5.0, 24.0, dist);
  float det = lum(texture2D(tGrass2, rot(w, 1.7) / 0.85).rgb);
  float detD = lum(texture2D(tDirt, rot(w, 2.9) / 0.9).rgb);
  float dg = (bG + bM) / sum, dd = (bD + bF + bP) / sum;
  alb *= mix(1.0, clamp(det * 2.3, 0.55, 1.45), near * 0.55 * dg) * mix(1.0, clamp(detD * 2.4, 0.6, 1.4), near * 0.45 * dd);
  // normalna z tekstur w tych samych proporcjach
  vec3 tnG = texture2D(nGrass, w / 3.1).xyz * 2.0 - 1.0;
  vec3 tnF = texture2D(nForest, rot(w, 1.3) / 4.2).xyz * 2.0 - 1.0;
  vec3 tnP = texture2D(nPebble, rot(w, 2.6) / 2.9).xyz * 2.0 - 1.0;
  vec3 tnR = texture2D(nRock, w / 6.0).xyz * 2.0 - 1.0;
  gNormal = normalize((tnG * (bG + bM * 0.6) + tnF * (bF + bD + bM * 0.4) + tnP * bP * 1.4 + tnR * bR * 1.3) / sum);
  vec3 tnDet = texture2D(nGrass, rot(w, 1.7) / 0.85).xyz * 2.0 - 1.0;
  gNormal = normalize(gNormal + vec3(tnDet.xy * near * 0.8 * dg, 0.0));

  // góry: na płaskich półkach trawa i mech, wysoko śnieg (mniej na stromiznach), granica postrzępiona szumem
  float ledge = bR / sum * smoothstep(0.8, 0.95, vWN.y) * smoothstep(0.45, 0.7, nS.b) * (1.0 - smoothstep(9.0, 13.0, vWP.y));
  alb = mix(alb, grass * 0.8, ledge * 0.85);
  float line = 11.5 + nM.g * 3.0 + (nD.r - 0.5) * 1.5;
  float snow = smoothstep(line, line + 1.4, vWP.y) * mix(0.55, 1.0, smoothstep(0.3, 0.75, vWN.y));
  vec3 snowC = vec3(0.78, 0.81, 0.86) * (0.8 + lum(rock) * 0.45) * (0.9 + nD.g * 0.16);
  snow *= smoothstep(0.0, 0.35, 1.0 - lum(rock) * 0.6 + nD.b * 0.4 - 0.3) * 0.5 + 0.5;
  alb = mix(alb, snowC, clamp(snow, 0.0, 1.0));
  gNormal = normalize(mix(gNormal, vec3(0.0, 0.0, 1.0), snow * 0.35));
  // brzeg wody: ziemia tuż przy linii wody mokra i ciemna, kamyki i piasek tylko w niektórych zatoczkach
  float wetK = 1.0 - smoothstep(-0.12, 0.07, vWP.y);
  alb = mix(alb, alb * vec3(0.52, 0.5, 0.45), wetK * 0.85);
  // światło i cień w dużej skali: kępy wilgotniejsze i ciemniejsze, suche placki jaśniejsze
  float macro = 0.74 + nM.b * 0.42 + (nS.r - 0.5) * 0.16;
  // wnęki między źdźbłami i kamieniami ciemnieją (fałszywe AO z jasności)
  float cav = mix(0.82, 1.08, smoothstep(0.08, 0.45, lum(alb)));
  alb *= macro * cav * uDark;
  // suchsze, żółtawe łaty na trawie
  alb = mix(alb, alb * vec3(1.12, 1.04, 0.78), smoothstep(0.62, 0.85, nM.g) * 0.5 * bG / sum);
  diffuseColor.rgb *= alb;
}
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  // osie świata X i Z w przestrzeni widoku, prostopadłe do normalnej powierzchni
  vec3 T = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 B = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  T = normalize(T - normal * dot(T, normal));
  B = normalize(B - normal * dot(B, normal) - T * dot(B, T));
  vec3 gn = vec3(gNormal.xy * 1.35, gNormal.z);
  normal = normalize(T * gn.x - B * gn.y + normal * gn.z);
}
`;

let shared: THREE.MeshStandardMaterial | null = null;

/** Materiał podłoża (wspólny dla planszy i terenu za mapą). Geometria musi mieć atrybut `splat` (vec4). */
/** Zdjęcie trawy podłoża (do barwienia gęstej trawy, żeby zlewała się z ziemią) */
export function groundGrassTexture(): THREE.Texture | null { return TEST || !loader ? null : tex('grass1', true); }

export function groundMaterial(): THREE.MeshStandardMaterial {
  if (shared) return shared;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  if (TEST || !loader) { shared = mat; return mat; }
  const uniforms = {
    tGrass1: { value: tex('grass1', true) }, tGrass2: { value: tex('grass2', true) }, tMeadow: { value: tex('meadow', true) },
    tForest: { value: tex('forest', true) }, tPebble: { value: tex('pebble', true) }, tDirt: { value: tex('dirt', true) }, tRock: { value: tex('rock', true) }, tCliff: { value: tex('cliff', true) },
    tNoise: { value: noiseTexture() },
    nGrass: { value: tex('grass_n', false) }, nForest: { value: tex('forest_n', false) }, nPebble: { value: tex('pebble_n', false) }, nRock: { value: tex('rock_n', false) },
    uDark: { value: 1.0 },
  };
  mat.userData.ground = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_ALBEDO)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL);
  };
  mat.customProgramCacheKey = () => 'ground-v1';
  shared = mat;
  return mat;
}

/** Zawijająca się mapa normalnych drobnych fal: suma sinusoid o całkowitych częstotliwościach (bez szwów) */
function waveNormals(): THREE.DataTexture {
  // drobna, nieregularna tafla: szum wartości (kilka oktaw, zawija się), bez kratki od sinusoid
  const N = 256;
  const hgt = new Float32Array(N * N);
  let s = 99991;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const octs = [6, 12, 24, 48].map((cells) => { const v = new Float32Array(cells * cells); for (let i = 0; i < v.length; i++) v[i] = rnd(); return { cells, v }; });
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0, a = 1;
      for (const o of octs) {
        const fx = (x / N) * o.cells, fy = (y / N) * o.cells, x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % o.cells, y1 = (y0 + 1) % o.cells;
        const top = o.v[y0 * o.cells + x0]! * (1 - sx) + o.v[y0 * o.cells + x1]! * sx;
        const bot = o.v[y1 * o.cells + x0]! * (1 - sx) + o.v[y1 * o.cells + x1]! * sx;
        v += (top * (1 - sy) + bot * sy) * a; a *= 0.55;
      }
      hgt[y * N + x] = v * 2.2;
    }
  const data = new Uint8Array(N * N * 4);
  const at = (x: number, y: number): number => hgt[((y + N) % N) * N + ((x + N) % N)]!;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.6, dy = (at(x, y + 1) - at(x, y - 1)) * 0.6;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Woda: przy brzegu jasna, przejrzysta i z pianą, dalej ciemna i głęboka; dwie warstwy fal płyną w różne strony,
 * pod kątem (efekt Fresnela) tafla odbija kolor nieba, a słońce daje ostry połysk.
 * `shore` to tekstura odległości od lądu (0 = brzeg, 1 = głębia) rozpięta na całej mapie.
 */
export function waterMaterial(shore: THREE.Texture, w: number, h: number): { mat: THREE.MeshStandardMaterial; time: { value: number }; sky: { value: THREE.Color } } {
  const time = { value: 0 };
  const sky = { value: new THREE.Color(0x8a9aa6) };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: 0.06, metalness: 0.0, depthWrite: false });
  if (TEST || !loader) { mat.color.setHex(0x2c6f8f); mat.opacity = 0.86; return { mat, time, sky }; }
  const uni = { wN: { value: waveNormals() }, shore: { value: shore }, wTime: time, skyCol: sky, mapSize: { value: new THREE.Vector2(w, h) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform sampler2D wN, shore; uniform float wTime; uniform vec3 skyCol; uniform vec2 mapSize; varying vec3 vWP; float wDepth; float wFoam; float wRip;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 suv = (vWP.xz + mapSize * 0.5) / mapSize;
          wDepth = texture2D(shore, suv).r;
          float wMask = texture2D(shore, suv).g;
          float d = smoothstep(0.0, 0.55, wDepth);
          vec3 shallowC = vec3(0.09, 0.12, 0.095), deepC = vec3(0.02, 0.058, 0.072);
          diffuseColor.rgb = mix(shallowC, deepC, d);
          diffuseColor.a = mix(0.62, 0.95, smoothstep(0.0, 0.3, wDepth));
          // miękki, nieregularny brzeg: tafla wygasa na ostatnich centymetrach zamiast kończyć się kantem
          float edgeN = texture2D(wN, vWP.xz / 1.7).r;
          diffuseColor.a *= smoothstep(0.42, 0.62, wMask + (edgeN - 0.5) * 0.18);
          // piana: postrzępiona linia tuż przy brzegu, przesuwa się z falami
          float fn = texture2D(wN, vWP.xz / 2.3 + vec2(wTime * 0.03, -wTime * 0.02)).r;
          wFoam = smoothstep(0.07, 0.0, wDepth + (fn - 0.5) * 0.06) * (0.5 + 0.5 * sin(wTime * 1.3 + wDepth * 60.0)) * smoothstep(0.35, 0.6, fn);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 n1 = texture2D(wN, vWP.xz / 4.2 + vec2(wTime * 0.026, wTime * 0.016)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(wN, vec2(vWP.z, -vWP.x) / 2.1 - vec2(wTime * 0.02, wTime * 0.033)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(wN, vWP.xz / 19.0 + vec2(-wTime * 0.008, wTime * 0.006)).xyz * 2.0 - 1.0;
          vec3 wn = normalize(vec3((n1.xy * 0.8 + n2.xy * 0.7 + n3.xy * 0.2) * 0.75, 1.0));
          wRip = wn.x;
          vec3 T = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
          vec3 B = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          normal = normalize(T * wn.x - B * wn.y + normal * wn.z);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 vdir = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 4.0);
          // odbicie nieba zależy od nachylenia fali: grzbiety łapią jasny horyzont, doliny ciemny zenit
          vec3 rw = reflect(-vdir, normal);
          vec3 rWorld = (vec4(rw, 0.0) * viewMatrix).xyz;
          vec3 skyR = mix(skyCol * 0.62, skyCol * 0.36, smoothstep(0.1, 0.55, rWorld.y)) * vec3(0.8, 0.9, 1.0);
          outgoingLight = mix(outgoingLight, skyR * (0.85 + wRip * 1.2), clamp(fres * 0.9 + 0.24, 0.0, 0.62));
          outgoingLight += vec3(0.7, 0.72, 0.68) * wFoam * 0.22 * (0.3 + skyCol.g);
          diffuseColor.a = clamp(max(diffuseColor.a, fres * 0.9) + wFoam * 0.2, 0.0, 1.0);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'water-v1';
  return { mat, time, sky };
}

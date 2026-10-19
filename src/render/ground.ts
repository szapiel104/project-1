import * as THREE from 'three';
import { TEST } from '../testmode';
import { loadTexture } from './ktx';

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
  t = loadTexture(base() + name + '.jpg?v=5'); // numer wersji: przeglądarka nie trzyma starego zdjęcia po podmianie; w praktyce .ktx2 (ktx.ts)
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
attribute float sand;
varying vec4 vSplat;
varying float vSand;
varying vec3 vWP;
varying vec3 vWN;
`;
const VERT_BODY = /* glsl */ `
vSplat = splat;
vSand = sand;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_HEAD = /* glsl */ `
uniform sampler2D tGrass1, tGrass2, tMeadow, tForest, tPebble, tDirt, tRock, tCliff, tSand, tNoise;
uniform sampler2D nGrass, nForest, nPebble, nRock;
uniform float uDark;
varying vec4 vSplat;
varying float vSand;
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
  // wydeptana ziemia: nie gładkie błoto, tylko ubita glina przetykana żwirem, ściółką i ciemniejszymi koleinami
  vec3 dirt = texture2D(tDirt, rot(w, 0.2) / 4.5).rgb * vec3(1.02, 0.95, 0.86);
  vec3 grit = texture2D(tPebble, rot(w, 1.1) / 2.2).rgb * vec3(0.8, 0.74, 0.64);
  dirt = mix(dirt, grit, smoothstep(0.3, 0.62, nD.a * 0.55 + nS.b * 0.55) * 0.75);
  dirt = mix(dirt, forest * vec3(0.92, 0.86, 0.8), smoothstep(0.5, 0.78, nS.g * 0.7 + nD.r * 0.4) * 0.45);
  dirt *= 0.86 + smoothstep(0.3, 0.7, nD.g) * 0.22;
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
  float wPeb = clamp(vSplat.y * (vWP.y < 0.1 ? smoothstep(0.35, 0.6, nS.a) * 1.4 : 1.0) + smoothstep(0.99, 1.06, nD.a * 0.7 + nS.r * 0.4) * 0.5, 0.0, 1.0);
  float wForest = clamp(vSplat.x * (0.75 + nS.a * 0.5), 0.0, 1.0);
  float wDirt = clamp(vSplat.w * 1.15 + smoothstep(1.0, 1.08, nS.r * 0.6 + nD.g * 0.5) * 0.5, 0.0, 1.0);
  // w wydeptanym zostają kępki trawy (nie jednolita plama), krawędź poszarpana
  wDirt *= mix(1.0, smoothstep(0.18, 0.52, nD.r * 0.8 + nS.a * 0.35), 0.4);
  float wRock = clamp(vSplat.z, 0.0, 1.0);
  float steep = smoothstep(0.82, 0.62, vWN.y);
  wRock = max(wRock, steep);
  // piasek plaż (jeziora z plażą, morze za mapą): na plaży trawa i kamienie ustępują
  vec3 sandC = texture2D(tSand, rot(w, 0.8) / 4.0).rgb * vec3(0.98, 0.9, 0.72); // przygaszony, wilgotny piasek (nie jaskrawa plaża)
  float wSand = clamp(vSand * 1.1, 0.0, 1.0) * (1.0 - wRock);
  wPeb *= 1.0 - wSand * 0.7; wDirt *= 1.0 - wSand; wForest *= 1.0 - wSand;

  // mieszanie po wysokości (jaśniejsze = wystaje): przejścia poszarpane, kamyki wychodzą z ziemi
  float hG = lum(grass) * 1.3 + 0.15, hM = lum(meadow) * 1.2 + 0.1, hF = lum(forest), hP = lum(pebble) * 1.15, hD = lum(dirt) * 0.8, hR = lum(rock) + 0.3;
  float aG = (1.0 - wMeadow) * (1.0 - max(max(max(wForest, wDirt), max(wPeb, wRock)), wSand)) + hG;
  float aM = wMeadow * (1.0 - max(max(wForest, wDirt), wRock)) * 0.9 + hM;
  float aF = wForest * 1.2 + hF;
  float aP = wPeb * 1.3 + hP - 0.45;
  float aD = wDirt * 1.25 + hD;
  float aR = wRock * 1.6 + hR - 0.4;
  float aS = wSand * 1.5 + lum(sandC) * 0.9 - 0.1;
  float top = max(max(max(aG, aM), max(aF, aP)), max(max(aD, aR), aS)) - 0.22;
  float bG = max(aG - top, 0.0), bM = max(aM - top, 0.0), bF = max(aF - top, 0.0), bP = max(aP - top, 0.0), bD = max(aD - top, 0.0), bR = max(aR - top, 0.0), bS = max(aS - top, 0.0);
  float sum = bG + bM + bF + bP + bD + bR + bS + 1e-4;
  vec3 alb = (grass * bG + meadow * bM + forest * bF + pebble * bP + dirt * bD + rock * bR + sandC * bS) / sum;

  // z bliska drobna faktura w dużo mniejszej skali: więcej szczegółu na metr (ostrzej, mniej płasko)
  float near = 1.0 - smoothstep(5.0, 24.0, dist);
  float det = lum(texture2D(tGrass2, rot(w, 1.7) / 0.85).rgb);
  float detD = lum(texture2D(tPebble, rot(w, 2.9) / 0.9).rgb);
  float dg = (bG + bM) / sum, dd = (bD + bF + bP) / sum;
  alb *= mix(1.0, clamp(det * 2.3, 0.55, 1.45), near * 0.55 * dg) * mix(1.0, clamp(detD * 2.4, 0.6, 1.4), near * 0.45 * dd);
  // normalna z tekstur w tych samych proporcjach
  vec3 tnG = texture2D(nGrass, w / 3.1).xyz * 2.0 - 1.0;
  vec3 tnF = texture2D(nForest, rot(w, 1.3) / 4.2).xyz * 2.0 - 1.0;
  vec3 tnP = texture2D(nPebble, rot(w, 2.6) / 2.9).xyz * 2.0 - 1.0;
  vec3 tnR = texture2D(nRock, w / 6.0).xyz * 2.0 - 1.0;
  gNormal = normalize((tnG * (bG + bM * 0.6) + tnF * (bF + bD * 0.4 + bM * 0.4) + tnP * (bP * 1.4 + bD * 0.9 + bS * 0.5) + tnR * bR * 1.3 + vec3(0.0, 0.0, 1.0) * bS * 0.6) / sum);
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
  // dno pod wodą: zamiast trawy piasek, żwir i kamyki na płyciźnie, głębiej ciemny muł z resztkami liści
  // (przez czystą wodę przy brzegu widać je wyraźnie, dalej toń je zakrywa)
  float under = smoothstep(-0.075, -0.16, vWP.y);
  if (under > 0.0) {
    float bedN = nS.g * 0.6 + nD.b * 0.5;
    vec3 shallowBed = mix(sandC * vec3(0.86, 0.8, 0.66), pebble * vec3(0.82, 0.77, 0.66), smoothstep(0.45, 0.75, bedN));
    shallowBed = mix(shallowBed, grit * vec3(0.9), smoothstep(0.62, 0.85, nD.a) * 0.6);
    vec3 silt = mix(dirt * vec3(0.55, 0.53, 0.44), forest * vec3(0.46, 0.5, 0.36), smoothstep(0.4, 0.8, nM.r) * 0.6);
    float deepK = smoothstep(-0.3, -0.95, vWP.y + (nS.a - 0.5) * 0.35);
    alb = mix(alb, mix(shallowBed, silt, deepK), under);
    gNormal = normalize(mix(gNormal, tnP, under * (1.0 - deepK) * 0.6));
  }
  // światło i cień w dużej skali: kępy wilgotniejsze i ciemniejsze, suche placki jaśniejsze
  float macro = 0.74 + nM.b * 0.42 + (nS.r - 0.5) * 0.16;
  // wnęki między źdźbłami i kamieniami ciemnieją (fałszywe AO z jasności)
  float cav = mix(0.82, 1.08, smoothstep(0.08, 0.45, lum(alb)));
  alb *= mix(macro * cav, 0.95 + (macro - 0.95) * 0.35, bS / sum) * uDark; // piasek jasny i równy, bez ciemnych plam łąki
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
let noiseShared: THREE.DataTexture | null = null;
/** Ten sam szum plam co na podłożu (trawa korzysta z niego, żeby jaśniej i ciemniej było w tych samych miejscach) */
export function sharedNoise(): THREE.DataTexture { return (noiseShared ??= noiseTexture()); }
/** Druga trawa podłoża (plamy jaśniejszej, żółtawej trawy) */
export function groundGrassTexture2(): THREE.Texture | null { return TEST || !loader ? null : tex('grass2', true); }

/** Zdjęcie trawy podłoża (do barwienia gęstej trawy, żeby zlewała się z ziemią) */
export function groundGrassTexture(): THREE.Texture | null { return TEST || !loader ? null : tex('grass1', true); }

const cloudT = { value: 0 }, cloudK = { value: 0 };
/** Cienie chmur na ziemi: czas (przesuw z wiatrem) i siła (0 = bez chmur, nocą i w gęstej mgle też 0) */
export function setCloudShadows(time: number, strength: number): void { cloudT.value = time; cloudK.value = strength; }
/**
 * Te same cienie chmur na wszystkim, co stoi na ziemi (trawa, drzewa, krzaki, pnie): plama cienia przesuwa się
 * po łące i lesie jednocześnie, a nie tylko po gołej ziemi pod spodem. Dokleja się do istniejącego shadera materiału.
 */
const clouded = new WeakSet<THREE.Material>();
export function cloudShade(mat: THREE.Material): void {
  // WeakSet, nie userData: klony materiałów (withAo) dzielą userData z oryginałem
  if (TEST || !loader || clouded.has(mat) || !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
  clouded.add(mat);
  // klucz programu: dotychczasowy (liczony na bieżąco, np. pory roku) albo — przy domyślnym — treść poprzedniej łatki
  const prev = mat.onBeforeCompile, pk = mat.customProgramCacheKey, prevSrc = prev.toString();
  const isDefault = pk === THREE.Material.prototype.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    // wstawka tylko raz (łańcuch onBeforeCompile bywa owinięty dwa razy — np. pory roku i kopie materiału — a podwójna deklaracja psuje shader)
    if (sh.fragmentShader.includes('uniform float uCloudT;')) return;
    sh.uniforms.uCloudT = cloudT; sh.uniforms.uCloud = cloudK; sh.uniforms.tCloudN = { value: sharedNoise() };
    sh.fragmentShader = 'uniform float uCloudT; uniform float uCloud; uniform sampler2D tCloudN;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        vec3 cw = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
        vec2 cuv = cw.xz / 70.0 + uCloudT * vec2(0.006, 0.0035);
        float cn = texture2D(tCloudN, cuv).r * 0.65 + texture2D(tCloudN, cuv * 2.3 + 0.37).g * 0.35;
        float ccm = uCloud * smoothstep(0.38, 0.62, cn);
        float csh = 1.0 - ccm * 0.75;
        reflectedLight.directDiffuse *= csh;
        reflectedLight.directSpecular *= csh;
        reflectedLight.indirectDiffuse *= 1.0 - ccm * 0.32;
      }`);
  };
  mat.customProgramCacheKey = function (this: THREE.Material) { return (isDefault ? prevSrc : pk.call(this)) + '|cloud'; };
}


/**
 * Podłoże używa 14 własnych próbników tekstur; three.js dokłada mapę cieni i (od r18x) tablicę DFG do odbić,
 * a pory roku mapę śladów w śniegu — razem 17, a wiele kart (np. NVIDIA przez ANGLE/D3D11) daje shaderowi 16.
 * Powyżej limitu three.js sypie ostrzeżeniem przy każdym rysowaniu (tysiące wpisów na sekundę w konsoli, co samo
 * w sobie spowalnia grę). Tablicę DFG zastępujemy tu wzorem przybliżonym (ten sam, którego three.js używało do r18x);
 * na matowej ziemi (chropowatość 0,97) różnicy nie widać, a próbników jest o jeden mniej.
 */
const DFG_APPROX = /* glsl */ `
vec2 dfgApprox(const in float roughness, const in float dotNV) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * dotNV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}
`;
function withoutDfgLut(frag: string): string {
  const strip = (src: string): string => src
    .replace('uniform sampler2D dfgLUT;', DFG_APPROX)
    .replace(/texture2D\(\s*dfgLUT,\s*vec2\(\s*([^,]+),\s*([^)]+)\)\s*\)\.rg/g, 'dfgApprox($1, $2)');
  return frag
    .replace('#include <lights_physical_pars_fragment>', strip(THREE.ShaderChunk.lights_physical_pars_fragment!))
    .replace('#include <lights_fragment_begin>', strip(THREE.ShaderChunk.lights_fragment_begin!));
}

export function groundMaterial(): THREE.MeshStandardMaterial {
  if (shared) return shared;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  if (TEST || !loader) { shared = mat; return mat; }
  const uniforms = {
    tGrass1: { value: tex('grass1', true) }, tGrass2: { value: tex('grass2', true) }, tMeadow: { value: tex('meadow', true) },
    tForest: { value: tex('forest', true) }, tPebble: { value: tex('pebble', true) }, tDirt: { value: tex('dirt', true) }, tRock: { value: tex('rock', true) }, tCliff: { value: tex('cliff', true) }, tSand: { value: tex('sand', true) },
    tNoise: { value: sharedNoise() },
    nGrass: { value: tex('grass_n', false) }, nForest: { value: tex('forest_n', false) }, nPebble: { value: tex('pebble_n', false) }, nRock: { value: tex('rock_n', false) },
    uDark: { value: 1.0 },
    uCloudT: cloudT, uCloud: cloudK,
  };
  mat.userData.ground = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_ALBEDO)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      // cienie chmur: wielkie, miękkie plamy cienia sunące z wiatrem (tylko światło słońca, nie rozproszone)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec2 cuv = vWP.xz / 70.0 + uCloudT * vec2(0.006, 0.0035);
          float cn = texture2D(tNoise, cuv).r * 0.65 + texture2D(tNoise, cuv * 2.3 + 0.37).g * 0.35;
          // w scenie dużo światła rozproszonego (niebo), więc sam brak słońca prawie nie widać — cień chmury
          // przygasza też trochę światło nieba (pod chmurą jest naprawdę ciemniej)
          float cm = uCloud * smoothstep(0.38, 0.62, cn);
          float sh = 1.0 - cm * 0.75;
          reflectedLight.directDiffuse *= sh;
          reflectedLight.directSpecular *= sh;
          reflectedLight.indirectDiffuse *= 1.0 - cm * 0.32;
        }`);
    sh.fragmentShader = 'uniform float uCloudT; uniform float uCloud;\n' + sh.fragmentShader;
    sh.fragmentShader = withoutDfgLut(sh.fragmentShader);
  };
  mat.customProgramCacheKey = () => 'ground-v3';
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

/** Wysokość tafli wody (świat) */
export const WATER_Y = -0.08;

/**
 * Woda jak w grach z prawdziwą wodą (podejście znane m.in. z wody w Unity Boat Attack i UE):
 * - przejrzystość z prawdziwej głębokości (tekstura `depth`: tafla minus dno, w metrach, liczona z siatki terenu)
 *   i pochłaniania światła (Beer–Lambert): przy brzegu widać dno, dalej toń gęstnieje do ciemnej, torfowej barwy,
 *   brzeg wygasa miękko na ostatnich centymetrach zamiast kończyć się kantem pól;
 * - odbicie: lustrzany obraz sceny z drugiej kamery (`WaterReflection`), zniekształcony falą; siła z Fresnela
 *   (z góry ciemna toń, płasko patrząc lustro); bez lustra (słabsza grafika) gradient nieba z ciemnym pasem lasu;
 * - trzy warstwy drobnych zmarszczek płyną w różne strony, z odległością łagodnieją (bez migotania w oddali);
 * - ostry odblask słońca. Tafla zapisuje głębokość, więc AO i cienie chmur z dna nie prześwitują przez wodę.
 */
export function waterMaterial(depth: THREE.Texture, w: number, h: number, refl: { tRefl: { value: THREE.Texture | null }; mRefl: { value: THREE.Matrix4 }; uRefl: { value: number } }): { mat: THREE.MeshStandardMaterial; time: { value: number }; sky: { value: THREE.Color }; sunDir: { value: THREE.Vector3 }; sunCol: { value: THREE.Color } } {
  const time = { value: 0 };
  const sky = { value: new THREE.Color(0x8a9aa6) };
  const sunDir = { value: new THREE.Vector3(0, 1, 0) }, sunCol = { value: new THREE.Color(0) };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, roughness: 0.45, metalness: 0.0, depthWrite: true });
  if (TEST || !loader) { mat.color.setHex(0x1f2214); mat.opacity = 0.9; mat.depthWrite = false; return { mat, time, sky, sunDir, sunCol }; }
  const wN = waveNormals();
  mat.userData.owned = [wN, depth];
  const uni = { wN: { value: wN }, wDepth: { value: depth }, wTime: time, skyCol: sky, wSunDir: sunDir, wSunCol: sunCol, mapSize: { value: new THREE.Vector2(w, h) }, ...refl };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform sampler2D wN, wDepth, tRefl; uniform mat4 mRefl; uniform float uRefl; uniform float wTime; uniform vec3 skyCol; uniform vec3 wSunDir; uniform vec3 wSunCol; uniform vec2 mapSize; varying vec3 vWP; float wD; float wDs; vec2 wSlope;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 suv = (vWP.xz + mapSize * 0.5) / mapSize;
          // głębokość z siatki terenu, lekko zaburzona szumem: linia wody nie biegnie po prostych krawędziach trójkątów
          vec2 dd = texture2D(wDepth, suv).rg;
          wD = dd.r + (texture2D(wN, vWP.xz / 1.9).r - 0.5) * 0.04;
          // głębokość do przejrzystości: wygładzona (ok. 1,5 pola), więc granica widocznego dna nie biegnie po trójkątach terenu
          wDs = max(min(dd.g, dd.r * 2.0 + 0.02), 0.0);
          if (wD <= 0.0) discard;
          // barwa toni (światło rozproszone w wodzie): leśne jezioro, oliwkowo-brunatne od torfu
          diffuseColor.rgb = vec3(0.055, 0.07, 0.038);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float camD = length(vViewPosition);
          vec2 g1 = texture2D(wN, vWP.xz / 3.4 + vec2(wTime * 0.019, wTime * 0.012)).xy * 2.0 - 1.0;
          vec2 g2 = texture2D(wN, vec2(vWP.z, -vWP.x) / 1.9 + vec2(-wTime * 0.015, wTime * 0.021)).xy * 2.0 - 1.0;
          vec2 g3 = texture2D(wN, vWP.xz / 0.75 + vec2(wTime * 0.034, -wTime * 0.027)).xy * 2.0 - 1.0;
          vec2 g = g1 * 0.55 + g2 * 0.45 + g3 * 0.35 * (1.0 - smoothstep(6.0, 30.0, camD));
          // stojąca woda: zmarszczki płytkie, w oddali gładsze (bez migotania), na samej płyciźnie prawie lustro
          g *= mix(0.2, 0.06, smoothstep(15.0, 120.0, camD)) * mix(0.4, 1.0, smoothstep(0.0, 0.3, wD));
          wSlope = g;
          vec3 wn = normalize(vec3(g, 1.0));
          vec3 T = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
          vec3 B = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          normal = normalize(T * wn.x - B * wn.y + normal * wn.z);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 vdir = normalize(vViewPosition);
          float F = 0.035 + 0.965 * pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 5.0);   // Fresnel (Schlick, woda)
          // pochłanianie (Beer–Lambert): droga promienia w wodzie rośnie, im płaściej patrzymy
          vec3 V = normalize(cameraPosition - vWP);
          float path = wDs / max(V.y, 0.15);
          // przy brzegu dno widać przez zielonkawą toń, od ok. 1,5 m znika
          float tr = dot(exp(-vec3(2.7, 2.1, 3.1) * path), vec3(0.3333));
          vec3 rw = reflect(-vdir, normal);
          vec3 rWorld = (vec4(rw, 0.0) * viewMatrix).xyz;
          vec3 refl;
          if (uRefl > 0.5) {
            vec4 rc = mRefl * vec4(vWP, 1.0);
            refl = texture2D(tRefl, clamp(rc.xy / rc.w + wSlope * 0.25, 0.002, 0.998)).rgb;
          } else {
            vec3 treeR = vec3(0.035, 0.045, 0.025) * (0.4 + skyCol.g * 1.2);
            refl = mix(treeR, skyCol * vec3(0.62, 0.68, 0.7), smoothstep(0.06, 0.4, rWorld.y));
          }
          // odblask słońca: ostre błyski na zmarszczkach
          float glint = pow(max(dot(normalize(rWorld), wSunDir), 0.0), 700.0);
          vec3 spec = wSunCol * glint * 3.0;
          // skład: odbicie (F) + toń (rozproszenie) + dno widoczne przez resztę (przezroczystość)
          float body = (1.0 - F) * (1.0 - tr);
          float a = clamp(F + body, 0.0, 1.0);
          outgoingLight = min((refl * F + outgoingLight * body + spec) / max(a, 0.002), vec3(30.0));
          // przy samym brzegu woda wygasa: cieniutka warstwa na piasku, bez kantu
          diffuseColor.a = a * smoothstep(0.0, 0.035, wD);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'water-v8';
  return { mat, time, sky, sunDir, sunCol };
}

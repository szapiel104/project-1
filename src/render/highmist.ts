import * as THREE from 'three';
import { cat } from './cat';

/**
 * Mgła w dolinach i chmury zahaczające o szczyty (klimat Gothica: surowe góry toną w oparach).
 *
 * Obie rzeczy znają rzeźbę terenu z małej mapy wysokości (tekstura half-float co 2 pola), więc:
 * - mgła dolinna to kilka poziomych warstw nad terenem za mapą: widać ją tylko tam, gdzie warstwa leży NAD ziemią
 *   (im głębsza dolina pod warstwą, tym gęściej), więc sama „wlewa się” w doliny i obmywa zbocza miękką linią;
 * - chmury przy szczytach to kłęby zwrócone do kamery, przyklejone do najwyższych wierzchołków; tam, gdzie kłąb
 *   wchodzi w zbocze, blednie (zamiast twardego cięcia o skałę). Ile ich widać, zależy od pogody.
 * Plansza (pole gry) zostaje czysta: mgła zaczyna się kilka pól za jej brzegiem, a kłęby przy kamerze znikają.
 * Wszystko liczy się na karcie (ruch kłębów też), procesor tylko ustawia kilka liczb na klatkę.
 */

export interface HeightGrid {
  /** Wysokości w węzłach siatki, wiersz po wierszu (z rośnie z j) */
  data: Float32Array;
  nx: number;
  ny: number;
  /** Pozycja świata węzła (0, 0) i odstęp węzłów */
  x0: number;
  z0: number;
  step: number;
  /** Węzły na wodzie planszy (1 = jezioro, rzeka, bród): nad wodą opar gęstnieje */
  wet?: Uint8Array;
  /** Las i skały wokół węzła (0..4): opar planszy kończy się przed nimi miękkim paskiem, zamiast ciąć się o korony i urwisko */
  wood?: Uint8Array;
}

export interface Atmosphere {
  /** Mgła poranna i mgliste dni 0..1 */
  mist: number;
  /** Zachmurzenie 0..1 */
  cover: number;
  /** Deszcz 0..1 */
  rain: number;
  /** Noc 0..1 */
  night: number;
  /** Barwa mgły sceny (horyzont) */
  fog: THREE.Color;
  /** Barwa i siła słońca */
  sun: THREE.Color;
}

const HMAP_GLSL = /* glsl */ `
uniform sampler2D hMap;
uniform vec4 hBox;
float terrainH(vec2 xz) { return texture2D(hMap, (xz - hBox.xy) / hBox.zw).r; }
`;

/** Mapa wysokości jako tekstura (half-float daje filtrowanie liniowe na każdej karcie z WebGL2) */
function heightTexture(g: HeightGrid): { tex: THREE.DataTexture; box: THREE.Vector4 } {
  const half = new Uint16Array(g.nx * g.ny);
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(g.data[i]!);
  const tex = new THREE.DataTexture(half, g.nx, g.ny, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // środek teksela i to węzeł siatki: pudełko zaczyna się pół odstępu przed pierwszym węzłem
  const box = new THREE.Vector4(g.x0 - g.step / 2, g.z0 - g.step / 2, g.nx * g.step, g.ny * g.step);
  return { tex, box };
}

/** Szum powtarzalny (bez szwów przy kafelkowaniu): kilka oktaw szumu wartości na okresowej kratce */
export function mistNoise(seed: number): THREE.DataTexture {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const octave = (cells: number): Float32Array => {
    const lat = new Float32Array(cells * cells).map(() => rnd());
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number): number => lat[((j % cells) * cells) + (i % cells)]!;
      const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
      out[y * N + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
    return out;
  };
  const o1 = octave(4), o2 = octave(8), o3 = octave(16), o4 = octave(32);
  for (let i = 0; i < N * N; i++) {
    const v = o1[i]! * 0.5 + o2[i]! * 0.27 + o3[i]! * 0.15 + o4[i]! * 0.08;
    // R: miękkie kłęby, G: drugie, przesunięte pole do mieszania (bez widocznego powtarzania)
    data[i * 4] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, o2[(i + N * 37 + 53) % (N * N)]! * 0.6 + o3[i]! * 0.4)) * 255);
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Miękki kłąb: jasny wierzch, ciemniejszy spód, poszarpany brzeg */
function puffTexture(): THREE.CanvasTexture {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d')!;
  const img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) / n) * 2 - 1, v = ((j + 0.5) / n) * 2 - 1;
    const ang = Math.atan2(v, u);
    const edge = 1 + Math.sin(ang * 5 + 1.3) * 0.06 + Math.sin(ang * 11 + 0.4) * 0.04;
    const d = Math.sqrt(u * u + v * v) / edge;
    const a = Math.max(0, 1 - d);
    const k = (j * n + i) * 4;
    const light = Math.min(1, Math.max(0, 0.6 - v * 0.5 + (1 - d) * 0.2));
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(light * 255);
    img.data[k + 3] = Math.round(Math.pow(a, 1.2) * 255);
  }
  x.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

const LAYER_VERT = /* glsl */ `
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const LAYER_FRAG = /* glsl */ `
${HMAP_GLSL}
uniform sampler2D noise;
uniform float time, opacity, thick, layerY;
uniform vec2 drift;
uniform vec4 board; // środek planszy (xz) i połowa wymiarów
uniform vec3 col;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  float depth = layerY - terrainH(vWP.xz);
  float a = smoothstep(0.0, thick, depth);
  vec2 q = abs(vWP.xz - board.xy) - board.zw;
  a *= smoothstep(5.0, 20.0, max(q.x, q.y));
  if (a < 0.003) discard;
  vec2 p = vWP.xz;
  float n1 = texture2D(noise, p / 61.0 + drift * time).r;
  float n2 = texture2D(noise, vec2(p.y, -p.x) / 27.0 - drift.yx * time * 1.7).g;
  float n = n1 * 0.65 + n2 * 0.45;
  // głęboko w dolinie opar zwarty, przy linii zbocza poszarpany szumem
  a *= mix(smoothstep(0.28, 0.72, n), 1.0, smoothstep(thick * 0.6, thick * 2.2, depth) * 0.55);
  gl_FragColor = vec4(col * (0.9 + n1 * 0.18), a * opacity);
  #include <fog_fragment>
}`;

const DRAPE_VERT = /* glsl */ `
attribute float aV;
varying float vV;
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vV = aV;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const DRAPE_FRAG = /* glsl */ `
uniform sampler2D noise;
uniform float time, opacity;
uniform vec3 col;
varying float vV;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  vec2 p = vWP.xz;
  float n1 = texture2D(noise, p / 34.0 + vec2(time * 0.0016, time * 0.0009)).r;
  float n2 = texture2D(noise, vec2(p.y, -p.x) / 15.0 - vec2(time * 0.0011, -time * 0.0019)).g;
  float n = n1 * 0.7 + n2 * 0.45;
  float a = vV * vV * (3.0 - 2.0 * vV) * smoothstep(0.38, 0.9, n + vV * 0.1);
  // tuż przy kamerze czysto (widać, czym się gra), dalej doliny toną w oparze
  a *= smoothstep(5.0, 24.0, distance(cameraPosition, vWP));
  a *= opacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * (0.92 + n1 * 0.16), a);
  #include <fog_fragment>
}`;

const PUFF_VERT = /* glsl */ `
${HMAP_GLSL}
attribute vec4 aCenter; // x, y, z, rozmiar
attribute vec4 aMove;   // promień obiegu, kąt startowy, prędkość kątowa, faza
attribute vec2 aKind;   // próg pogody (kiedy kłąb się pojawia), rodzaj: 0 chmura, 1 pył wodny
uniform float time, amount;
varying vec2 vUv;
varying float vA;
varying float vKind;
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vKind = aKind.y;
  float ang = aMove.y + time * aMove.z;
  vec3 center = aCenter.xyz + vec3(cos(ang), 0.0, sin(ang)) * aMove.x;
  float size = aCenter.w * (0.88 + 0.12 * sin(time * 0.21 + aMove.w));
  float a;
  if (aKind.y > 0.5) {
    // pył wodny: wznosi się z dołu wodospadu, rośnie i rozpływa
    float f = fract(time * 0.35 + aMove.w);
    center.y += f * 1.3;
    size *= 0.6 + f * 0.9;
    a = sin(f * 3.14159) * 0.3;
  } else {
    center.y += sin(time * 0.13 + aMove.w * 2.0) * 0.6;
    a = smoothstep(aKind.x, aKind.x + 0.18, amount);
  }
  // przy kamerze kłąb znika (nie zasłania pola gry, gdy przybliżamy się do gór)
  float camD = distance(cameraPosition, center);
  a *= smoothstep(size * 0.7 + 3.0, size * 1.6 + 9.0, camD);
  vA = a;
  // osie ekranu kamery (nie „w stronę kamery” w świecie): z góry kłąb się nie kręci przy przesuwaniu widoku
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = center + (right * position.x + up * position.y) * size;
  vWP = wp;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = a < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const PUFF_FRAG = /* glsl */ `
${HMAP_GLSL}
uniform sampler2D map;
uniform vec3 lit, shade, spray;
varying vec2 vUv;
varying float vA;
varying float vKind;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  // tam, gdzie kłąb wchodzi w zbocze, blednie: miękka linia zamiast twardego cięcia o skałę
  float a = t.a * vA * 0.62 * smoothstep(-0.3, 2.2, vWP.y - terrainH(vWP.xz));
  if (a < 0.004) discard;
  vec3 c = mix(shade, lit, t.r);
  if (vKind > 0.5) c = mix(c, spray, 0.35);
  gl_FragColor = vec4(c, a);
  #include <fog_fragment>
}`;

export interface HighMist {
  group: THREE.Group;
  /** Wspólny szum (strumienie też z niego korzystają) */
  noise: THREE.Texture;
  /** Kłęby pyłu wodnego (dół wodospadu): pozycje w świecie */
  addSpray(points: THREE.Vector3[]): void;
  update(time: number, a: Atmosphere): void;
  /** Słabsza grafika = jedna warstwa mgły zamiast trzech */
  detail(d: number): void;
  dispose(): void;
}

interface Summit { x: number; z: number; h: number }

/** Najwyższe wierzchołki (lokalne maksima, odsunięte od siebie) — tam przyczepiają się chmury */
export function findSummits(g: HeightGrid, limit: number, minH: number, minSep: number, keepOut?: (x: number, z: number) => boolean): Summit[] {
  const out: Summit[] = [];
  const R = Math.max(2, Math.round(8 / g.step));
  const cand: Summit[] = [];
  for (let j = R; j < g.ny - R; j += 2)
    for (let i = R; i < g.nx - R; i += 2) {
      const h = g.data[j * g.nx + i]!;
      if (h < minH) continue;
      let top = true;
      for (let dj = -R; dj <= R && top; dj += 2) for (let di = -R; di <= R; di += 2) if (g.data[(j + dj) * g.nx + i + di]! > h) { top = false; break; }
      const x = g.x0 + i * g.step, z = g.z0 + j * g.step;
      if (top && !keepOut?.(x, z)) cand.push({ x, z, h });
    }
  cand.sort((a, b) => b.h - a.h);
  for (const c of cand) {
    if (out.length >= limit) break;
    if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < minSep)) continue;
    out.push(c);
  }
  return out;
}

export function buildHighMist(g: HeightGrid, board: { cx: number; cz: number; hw: number; hh: number }, seed: number): HighMist {
  const group = new THREE.Group();
  const { tex: hMap, box: hBox } = heightTexture(g);
  const noise = mistNoise(seed);
  const owned: { dispose(): void }[] = [hMap, noise];
  let s = (seed ^ 0x51ed270b) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sample = (x: number, z: number): number => {
    const fi = Math.max(0, Math.min(g.nx - 1, (x - g.x0) / g.step)), fj = Math.max(0, Math.min(g.ny - 1, (z - g.z0) / g.step));
    return g.data[Math.round(fj) * g.nx + Math.round(fi)]!;
  };

  // --- warstwy mgły dolinnej: rama wokół planszy (środek planszy zostaje pusty — tam i tak nic nie widać)
  const x0 = g.x0, z0 = g.z0, x1 = g.x0 + (g.nx - 1) * g.step, z1 = g.z0 + (g.ny - 1) * g.step;
  const ix0 = board.cx - board.hw - 3, ix1 = board.cx + board.hw + 3, iz0 = board.cz - board.hh - 3, iz1 = board.cz + board.hh + 3;
  const frame = new THREE.BufferGeometry();
  {
    const quads: [number, number, number, number][] = [
      [x0, z0, x1, iz0], [x0, iz1, x1, z1], [x0, iz0, ix0, iz1], [ix1, iz0, x1, iz1],
    ];
    const P: number[] = [], I: number[] = [];
    for (const [a, b, c, d] of quads) {
      const k = P.length / 3;
      P.push(a, 0, b, c, 0, b, a, 0, d, c, 0, d);
      I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    frame.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    frame.setIndex(I);
    frame.computeBoundingSphere();
  }
  owned.push(frame);
  const LAYERS = [
    { y: 1.8, thick: 1.1, op: 0.8, drift: new THREE.Vector2(0.0011, 0.0006) },
    { y: 3.3, thick: 1.8, op: 0.58, drift: new THREE.Vector2(-0.0007, 0.0009) },
    { y: 5.2, thick: 2.6, op: 0.42, drift: new THREE.Vector2(0.0005, -0.001) },
  ];
  const layerMats: THREE.ShaderMaterial[] = [];
  const layerMeshes: THREE.Mesh[] = [];
  const boardU = new THREE.Vector4(board.cx, board.cz, board.hw, board.hh);
  LAYERS.forEach((L, i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        hMap: { value: hMap }, hBox: { value: hBox }, noise: { value: noise }, time: { value: 0 }, opacity: { value: 0 },
        thick: { value: L.thick }, layerY: { value: L.y }, drift: { value: L.drift }, board: { value: boardU }, col: { value: new THREE.Color(0xc8ccc4) },
      }]),
      vertexShader: LAYER_VERT, fragmentShader: LAYER_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    });
    // UniformsUtils.merge kopiuje wartości: wspólne tekstury i wektory podpinamy z powrotem
    mat.uniforms.hMap!.value = hMap; mat.uniforms.noise!.value = noise; mat.uniforms.hBox!.value = hBox; mat.uniforms.board!.value = boardU;
    const m = new THREE.Mesh(frame, mat);
    m.renderOrder = 3 + i;
    m.frustumCulled = false;
    layerMats.push(mat);
    layerMeshes.push(m);
    owned.push(mat);
    group.add(cat(m, 'mgła w dolinach'));
  });

  // --- opar na planszy: cienka, poszarpana pierzyna tuż nad ziemią, tylko w obniżeniach (dolina rzeki, niecki,
  // nad jeziorami). „Dolinność” węzła = o ile leży niżej niż okolica (rozmyta wysokość w promieniu ok. 12 pól).
  const bi0 = Math.max(0, Math.floor((board.cx - board.hw - g.x0) / g.step)), bi1 = Math.min(g.nx - 1, Math.ceil((board.cx + board.hw - g.x0) / g.step));
  const bj0 = Math.max(0, Math.floor((board.cz - board.hh - g.z0) / g.step)), bj1 = Math.min(g.ny - 1, Math.ceil((board.cz + board.hh - g.z0) / g.step));
  const BW = bi1 - bi0 + 1, BH = bj1 - bj0 + 1;
  const hb = new Float32Array(BW * BH);
  // tafla wody liczy się jak ziemia: jezioro na płaskiej łące to nie dolina (dno pod wodą udawało niecki i opar
  // leżał zwartą, mleczną płachtą akurat nad stawami, zasłaniając odbicia w wodzie)
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) hb[j * BW + i] = Math.max(-0.08, g.data[(j + bj0) * g.nx + i + bi0]!);
  const boxBlur = (src: Float32Array, R: number): Float32Array => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const ii = i + k; if (ii >= 0 && ii < BW) { a += src[j * BW + ii]!; c++; } } tmp[j * BW + i] = a / c; }
    for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const jj = j + k; if (jj >= 0 && jj < BH) { a += tmp[jj * BW + i]!; c++; } } out[j * BW + i] = a / c; }
    return out;
  };
  // góry nie wchodzą do średniej (inaczej każda łąka u ich stóp wyglądałaby na dolinę)
  const capped = hb.map((v) => Math.min(v, 1.2));
  const avg = boxBlur(boxBlur(capped, 3), 3);
  let vall: Float32Array = new Float32Array(BW * BH);
  for (let k = 0; k < vall.length; k++) {
    const jj = Math.floor(k / BW), ii = k - jj * BW;
    const wet = g.wet ? g.wet[(jj + bj0) * g.nx + ii + bi0]! : 0;
    // nad otwartą wodą tylko lekki opar przy brzegu, nie pierzyna na całej tafli
    vall[k] = hb[k]! > 1.25 ? 0 : Math.min(1, Math.max(0, (avg[k]! - hb[k]!) / 0.35)) * (1 - wet * 0.8);
  }
  vall = boxBlur(vall, 1);
  // Skraj lasu i urwiska: płachta wygasa kilka pól przed drzewami (pod koronami i tak jej nie widać, a ucięta o nie
  // dawała twardą, prostą krawędź), a wzdłuż samego skraju zostaje cienki, poszarpany pasek oparu.
  if (g.wood) {
    const cov = new Float32Array(BW * BH);
    for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) cov[j * BW + i] = g.wood[(j + bj0) * g.nx + i + bi0]! / 4;
    const cb = boxBlur(cov, 1);
    for (let k = 0; k < vall.length; k++) {
      const c = cb[k]!;
      const open = 1 - Math.min(1, Math.max(0, (c - 0.12) / 0.4));
      const band = Math.exp(-(((c - 0.34) / 0.13) ** 2));
      vall[k] = Math.min(1, vall[k]! * open * open + band * 0.6);
    }
  }
  // na koniec szerokie rozmycie: przejścia między oparem a czystą ziemią na kilka pól, bez ostrej linii
  // (węzły co 2 pola — skok 0→1 między sąsiadami wyglądał jak krawędź płyty), i nigdy pełna, zwarta płachta
  vall = boxBlur(boxBlur(vall, 2), 1);
  for (let k = 0; k < vall.length; k++) vall[k] = Math.min(1, vall[k]! * 1.15) * 0.8 * Math.max(0, Math.min(1, (1.6 - hb[k]!) / 0.6));
  const DP: number[] = [], DV: number[] = [], DI: number[] = [];
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    DP.push(g.x0 + (i + bi0) * g.step, Math.max(hb[j * BW + i]!, -0.08) + 0.42, g.z0 + (j + bj0) * g.step);
    DV.push(vall[j * BW + i]!);
  }
  for (let j = 0; j < BH - 1; j++) for (let i = 0; i < BW - 1; i++) {
    const a = j * BW + i, b = a + 1, c = a + BW, d = c + 1;
    if (Math.max(vall[a]!, vall[b]!, vall[c]!, vall[d]!) < 0.01) continue;
    DI.push(a, c, b, b, c, d);
  }
  const drapeGeo = new THREE.BufferGeometry();
  drapeGeo.setAttribute('position', new THREE.Float32BufferAttribute(DP, 3));
  drapeGeo.setAttribute('aV', new THREE.Float32BufferAttribute(DV, 1));
  drapeGeo.setIndex(DI);
  drapeGeo.computeBoundingSphere();
  const drapeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: noise }, time: { value: 0 }, opacity: { value: 0 }, col: { value: new THREE.Color(0xc8ccc4) } }]),
    vertexShader: DRAPE_VERT, fragmentShader: DRAPE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  drapeMat.uniforms.noise!.value = noise;
  const drape = new THREE.Mesh(drapeGeo, drapeMat);
  drape.renderOrder = 2;
  drape.frustumCulled = false;
  if (DI.length) group.add(cat(drape, 'mgła w dolinach'));
  owned.push(drapeGeo, drapeMat);

  // --- kłęby: chmury przy szczytach (i pył wodny pod wodospadami, dopisywany później)
  const MAX = 400;
  const centers = new Float32Array(MAX * 4), moves = new Float32Array(MAX * 4), kinds = new Float32Array(MAX * 2);
  let count = 0;
  const push = (x: number, y: number, z: number, size: number, orbit: number, ang: number, speed: number, phase: number, thr: number, kind: number): void => {
    if (count >= MAX) return;
    centers.set([x, y, z, size], count * 4);
    moves.set([orbit, ang, speed, phase], count * 4);
    kinds.set([thr, kind], count * 2);
    count++;
  };
  // tylko dalekie masywy za mapą (min. 18 pól od brzegu planszy): góry na skraju planszy są za blisko kamery —
  // płaski kłąb tuż obok widać od razu jako obrazek
  const nearBoard = (x: number, z: number): boolean => Math.max(Math.abs(x - board.cx) - board.hw, Math.abs(z - board.cz) - board.hh) < 18;
  const summits = findSummits(g, 10, 12, 24, nearBoard);
  for (const sm of summits) {
    const R = 4 + sm.h * 0.16;
    const n = 16 + Math.floor(rnd() * 8);
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2, rr = R * (0.35 + rnd() * 0.75);
      const x = sm.x + Math.cos(ang) * rr, z = sm.z + Math.sin(ang) * rr;
      const size = 2.6 + sm.h * 0.09 + rnd() * 2.2;
      // na wysokości pod szczytem albo tuż nad zboczem: chmura „siedzi” na górze
      const y = Math.max(sm.h * (0.68 + rnd() * 0.26), sample(x, z) + size * 0.25);
      // próg pogody: część kłębów jest zawsze (lekka czapa), reszta dochodzi z zachmurzeniem i deszczem
      const thr = k < 3 ? 0.05 + rnd() * 0.2 : 0.3 + rnd() * 0.6;
      push(x - Math.cos(ang) * rr * 0.4, y, z - Math.sin(ang) * rr * 0.4, size, rr * 0.4, ang, (rnd() < 0.5 ? 1 : -1) * (0.006 + rnd() * 0.01), rnd() * 6.28, thr, 0);
    }
  }
  const pGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  pGeo.index = base.index;
  pGeo.setAttribute('position', base.getAttribute('position'));
  pGeo.setAttribute('uv', base.getAttribute('uv'));
  const cA = new THREE.InstancedBufferAttribute(centers, 4), mA = new THREE.InstancedBufferAttribute(moves, 4), kA = new THREE.InstancedBufferAttribute(kinds, 2);
  pGeo.setAttribute('aCenter', cA); pGeo.setAttribute('aMove', mA); pGeo.setAttribute('aKind', kA);
  pGeo.instanceCount = count;
  const puffMap = puffTexture();
  const puffMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      hMap: { value: hMap }, hBox: { value: hBox }, map: { value: puffMap }, time: { value: 0 }, amount: { value: 0.3 },
      lit: { value: new THREE.Color(0xeeeeea) }, shade: { value: new THREE.Color(0x8c9196) }, spray: { value: new THREE.Color(0xe8eef0) },
    }]),
    vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG,
    transparent: true, depthWrite: false, fog: true,
  });
  puffMat.uniforms.hMap!.value = hMap; puffMat.uniforms.hBox!.value = hBox; puffMat.uniforms.map!.value = puffMap;
  const puffs = new THREE.Mesh(pGeo, puffMat);
  puffs.frustumCulled = false;
  puffs.renderOrder = 6;
  group.add(cat(puffs, 'chmury przy szczytach'));
  owned.push(pGeo, base, puffMap, puffMat);

  const white = new THREE.Color(0xffffff), rainGrey = new THREE.Color(0x6d7378), tone = new THREE.Color();
  let layersShown = LAYERS.length;
  return {
    group,
    noise,
    addSpray(points: THREE.Vector3[]) {
      for (const p of points)
        for (let k = 0; k < 5; k++)
          push(p.x + (rnd() - 0.5) * 1.0, p.y - 0.2, p.z + (rnd() - 0.5) * 1.0, 0.6 + rnd() * 0.5, 0.15 + rnd() * 0.25, rnd() * 6.28, 0.6 + rnd(), rnd(), 0, 1);
      cA.needsUpdate = mA.needsUpdate = kA.needsUpdate = true;
      pGeo.instanceCount = count;
    },
    update(time: number, a: Atmosphere) {
      const day = 1 - a.night;
      // opar w dolinach: zawsze lekko (surowy klimat), gęsto o świcie, w mgliste dni i w deszczu; o świcie wyżej
      const dens = Math.min(1, 0.22 + a.mist * 0.7 + a.rain * 0.3 + a.night * 0.12);
      const lift = a.mist * 1.4 + a.rain * 0.6;
      tone.copy(a.fog).lerp(white, 0.08 + day * 0.32 * (1 - a.rain * 0.5));
      layerMats.forEach((m, i) => {
        const u = m.uniforms;
        u.time!.value = time;
        u.opacity!.value = dens * LAYERS[i]!.op * (i < layersShown ? 1 : 0);
        u.layerY!.value = LAYERS[i]!.y + lift * (0.6 + i * 0.3);
        (u.col!.value as THREE.Color).copy(tone);
        layerMeshes[i]!.visible = i < layersShown && u.opacity!.value > 0.004;
      });
      const du = drapeMat.uniforms;
      du.time!.value = time;
      // na planszy opar tylko rano, w mgliste dni, w deszczu i nocą; w zwykły dzień czysto
      du.opacity!.value = Math.min(0.42, a.mist * 0.42 + a.rain * 0.14 + a.night * 0.1);
      (du.col!.value as THREE.Color).copy(tone);
      const pu = puffMat.uniforms;
      pu.time!.value = time;
      pu.amount!.value = Math.min(1.2, 0.28 + a.cover * 0.7 + a.rain * 0.4 + a.mist * 0.25);
      // jasny wierzch od słońca (nocą srebrzysto-ciemny), cień w barwie mgły; w deszczu ciężkie, szare
      (pu.lit!.value as THREE.Color).copy(a.sun).multiplyScalar(0.55).lerp(tone, 0.45).lerp(rainGrey, a.rain * 0.5);
      (pu.shade!.value as THREE.Color).copy(a.fog).multiplyScalar(0.78 - a.rain * 0.15);
      (pu.spray!.value as THREE.Color).copy(tone).lerp(white, day * 0.3);
    },
    detail(d: number) { layersShown = d < 0.7 ? 1 : d < 0.85 ? 2 : LAYERS.length; },
    dispose() { for (const o of owned) o.dispose(); },
  };
}

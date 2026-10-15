import * as THREE from 'three';
import { groundGrassTexture2, sharedNoise } from './ground';

/**
 * Trawa jak w nowych grach: gęsty dywan kęp wokół miejsca, na które patrzymy, zamiast pojedynczych kępek na płaskiej ziemi.
 * - Siatka kilkudziesięciu tysięcy kęp (instancje, 2 skrzyżowane karty = 4 trójkąty) jedzie za kamerą skokami o oczko,
 *   a położenie, obrót i wielkość każdej kępy wynikają z jej pola w świecie, więc trawa stoi w miejscu, gdy kamera jedzie.
 * - Wysokość terenu i gęstość trawy shader czyta z tekstur mapy (wysokości narożników, maska: łąka gęsto, las rzadko,
 *   droga, budynek, woda, wydeptana ziemia — nic). Na brzegu zasięgu kępy maleją do zera, bez twardej granicy.
 * - Barwa źdźbła pochodzi z tej samej tekstury trawy co ziemia pod nim, więc dywan zlewa się z podłożem,
 *   a tekstura kępy daje tylko kształt źdźbeł, ciemną nasadę i jaśniejsze, miejscami żółte końce.
 */
const GRID = 290; // kępy w rzędzie: siatka na najdalszy zasięg (Ultra); zwykły pełny zasięg używa promienia BASE
/** Promień (w kępach) pełnego zasięgu trawy = 1 (ok. 20 pól wokół kamery); Ultra sięga do GRID/2 */
const BASE = 105;
const STEP = 0.19; // odstęp kęp w polach

export interface GrassField {
  mesh: THREE.Mesh;
  /** Przesuwa dywan nad punkt (x, z) w świecie i ustawia czas wiatru; camDist: z daleka dywan znika (wystarcza tekstura ziemi) */
  update(x: number, z: number, time: number, camDist?: number): void;
  /** Gęstość trawy na polu (0 brak … 1 pełna) */
  setDensity(tile: number, v: number): void;
  /** Mnoży gęstość pola (np. wydeptanie): 1 bez zmian, 0 łyso */
  setWear(tile: number, worn: number): void;
  /** Zasięg dywanu (1 = pełny, mniej = mniejszy krąg i mniej kęp do narysowania, 0 = bez trawy) */
  setReach(f: number): void;
  /** Zwalnia tekstury i geometrię dywanu (przy zmianie mapy) */
  dispose(): void;
}

export function createGrassField(w: number, h: number, corners: Float32Array, density: Float32Array, grassTex: THREE.Texture | null, bladeTex: THREE.Texture): GrassField {
  // wysokości narożników pól (w+1)×(h+1) w teksturze zmiennoprzecinkowej, czytane w shaderze
  const hTex = new THREE.DataTexture(new Float32Array(corners), w + 1, h + 1, THREE.RedFormat, THREE.FloatType);
  hTex.minFilter = hTex.magFilter = THREE.NearestFilter;
  hTex.needsUpdate = true;
  const base = new Float32Array(density);
  const wear = new Float32Array(w * h);
  const mask = new Uint8Array(w * h * 4);
  const write = (t: number): void => { mask[t * 4] = Math.round(Math.max(0, Math.min(1, base[t]! * (1 - wear[t]!))) * 255); };
  for (let t = 0; t < w * h; t++) { write(t); mask[t * 4 + 3] = 255; }
  const mTex = new THREE.DataTexture(mask, w, h, THREE.RGBAFormat);
  mTex.magFilter = THREE.LinearFilter; mTex.minFilter = THREE.LinearFilter;
  mTex.needsUpdate = true;
  let dirty = false;

  // kępa: dwie skrzyżowane karty, normalne w górę (świeci jak ziemia pod nią)
  const card = new THREE.BufferGeometry();
  {
    const P: number[] = [], U: number[] = [], N: number[] = [], I: number[] = [];
    for (let k = 0; k < 2; k++) {
      const a = k * Math.PI / 2 + 0.4, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = P.length / 3;
      P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
      U.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let i = 0; i < 4; i++) N.push(0, 1, 0);
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    card.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    card.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    card.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    card.setIndex(I);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = card.index;
  for (const k of ['position', 'uv', 'normal'] as const) geo.setAttribute(k, card.getAttribute(k));
  // kępy ułożone od środka na zewnątrz: mniejsza liczba instancji = mniejszy krąg (zasięg przy niższej jakości)
  const cells: [number, number, number][] = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) { const x = i - GRID / 2, y = j - GRID / 2; cells.push([x, y, x * x + y * y]); }
  cells.sort((a, b) => a[2] - b[2]);
  const off = new Float32Array(GRID * GRID * 2);
  const dist = new Float32Array(GRID * GRID);
  cells.forEach((c, k) => { off[k * 2] = c[0]; off[k * 2 + 1] = c[1]; dist[k] = Math.sqrt(c[2]); });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(off, 2));
  // na start pełny zwykły zasięg (BASE); dalej sięga tylko Ultra (setReach > 1)
  { let n = 0; while (n < dist.length && dist[n]! <= BASE) n++; geo.instanceCount = n; }

  const uni = {
    uOrigin: { value: new THREE.Vector2() }, uTime: { value: 0 }, uReach: { value: 1 }, uMap: { value: new THREE.Vector2(w, h) }, uFade: { value: 1 },
    tNoise: { value: sharedNoise() }, tGround2: { value: groundGrassTexture2() },
    tH: { value: hTex }, tMask: { value: mTex }, tBlade: { value: bladeTex }, tGround: { value: grassTex },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = /* glsl */ `
      attribute vec2 aCell;
      uniform vec2 uOrigin; uniform float uTime; uniform vec2 uMap; uniform float uFade; uniform float uReach;
      uniform sampler2D tH; uniform sampler2D tMask;
      varying vec2 vGUv; varying vec2 vGW; varying float vGTone;
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gHeight(vec2 p) {
        vec2 c = clamp(p, vec2(0.0), uMap - 0.001);
        vec2 i = floor(c), f = c - i;
        float a = texelFetch(tH, ivec2(i), 0).r, b = texelFetch(tH, ivec2(i) + ivec2(1, 0), 0).r;
        float d = texelFetch(tH, ivec2(i) + ivec2(0, 1), 0).r, e = texelFetch(tH, ivec2(i) + ivec2(1, 1), 0).r;
        return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
      }
    ` + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
      // pole kępy w świecie: siatka przyklejona do świata, przesuwana skokami razem z kamerą
      vec2 cell = floor(uOrigin / ${STEP.toFixed(3)}) + aCell;
      float r1 = gHash(cell), r2 = gHash(cell + 17.3), r3 = gHash(cell + 41.9);
      vec2 p = (cell + vec2(r1, r2)) * ${STEP.toFixed(3)};         // pozycja w polach mapy
      float dens = texture2D(tMask, (p + 0.5 * vec2(0.0)) / uMap).r;
      // im dalej od środka, tym mniejsze kępy (miękki brzeg dywanu)
      // brzeg dywanu: kępy rzedną i maleją stopniowo przez całą drugą połowę zasięgu (bez widocznego koła)
      float rr = length(aCell) / (${BASE.toFixed(1)} * uReach);
      float edge = 1.0 - smoothstep(0.35, 0.97, rr + (gHash(cell + 5.5) - 0.5) * 0.25);
      float keep = step(r3, smoothstep(0.25, 0.9, dens) * 1.1) * step(gHash(cell + 7.7), edge);
      float sz = mix(0.17, 0.32, gHash(cell + 3.7)) * keep * mix(0.55, 1.0, edge) * uFade;
      float ang = r1 * 6.2831;
      vec3 transformed = vec3(position.x * sz * 1.4, position.y * sz * mix(0.55, 1.0, r2), position.z * sz * 1.4);
      transformed.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * transformed.xz;
      // wiatr: fale przechodzą przez łąkę, czubki chodzą najmocniej
      float gust = sin(uTime * 1.6 + p.x * 0.35 + p.y * 0.22) * 0.6 + sin(uTime * 3.4 + p.x * 1.7 - p.y * 1.1) * 0.25;
      transformed.x += gust * 0.07 * uv.y * uv.y * sz;
      transformed.z += gust * 0.035 * uv.y * uv.y * sz;
      transformed += vec3(p.x - uMap.x * 0.5, gHeight(p) - 0.01, p.y - uMap.y * 0.5);
      vGUv = uv; vGW = transformed.xz; vGTone = gHash(cell + 9.1);
    `).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    sh.fragmentShader = /* glsl */ `
      uniform sampler2D tBlade; uniform sampler2D tGround; uniform sampler2D tGround2; uniform sampler2D tNoise;
      varying vec2 vGUv; varying vec2 vGW; varying float vGTone;
    ` + sh.fragmentShader.replace('#include <map_fragment>', /* glsl */ `
      vec4 bl = texture2D(tBlade, vGUv);
      // barwa z tekstury trawy pod kępą (jak ziemia), kształt i cieniowanie z tekstury źdźbeł
      // dokładnie jak podłoże: ta sama trawa, te same plamy jasności i żółtawe łaty, więc dywan nie odcina się od ziemi
      vec4 nM = texture2D(tNoise, vGW / 96.0), nS = texture2D(tNoise, vGW / 23.0 + 0.37);
      vec3 gc = texture2D(tGround, vGW / 3.1).rgb;
      vec2 r2 = vec2(cos(2.1) * vGW.x - sin(2.1) * vGW.y, sin(2.1) * vGW.x + cos(2.1) * vGW.y);
      gc = mix(gc, texture2D(tGround2, r2 / 4.3).rgb * vec3(0.92, 0.9, 0.8), smoothstep(0.38, 0.72, nM.r) * 0.85);
      gc *= 0.74 + nM.b * 0.42 + (nS.r - 0.5) * 0.16;
      gc = mix(gc, gc * vec3(1.12, 1.04, 0.78), smoothstep(0.62, 0.85, nM.g) * 0.5);
      gc = mix(gc, gc * vec3(1.18, 1.1, 0.72), smoothstep(0.75, 1.0, vGTone) * 0.7);
      diffuseColor.rgb *= gc * (0.8 + bl.r * 0.55) * mix(0.72, 1.18, smoothstep(0.0, 0.85, vGUv.y));
      diffuseColor.a = bl.a;
      diffuseColor.a = (diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;
    `).replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  };
  mat.customProgramCacheKey = () => 'grass-field-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  let off0 = false;
  return {
    mesh,
    update(x: number, z: number, time: number, camDist = 0) {
      uni.uOrigin.value.set(x + w / 2, z + h / 2);
      uni.uFade.value = 1 - Math.max(0, Math.min(1, (camDist - 32) / 26));
      mesh.visible = !off0 && uni.uFade.value > 0.01;
      uni.uTime.value = time;
      if (dirty) { mTex.needsUpdate = true; dirty = false; }
    },
    setReach(f: number) {
      off0 = f <= 0;
      mesh.visible = !off0 && uni.uFade.value > 0.01;
      const r = Math.max(0.3, Math.min(GRID / 2 / BASE, f));
      uni.uReach.value = r;
      // instancje do promienia r·BASE (dalsze i tak mają zerową wielkość)
      const lim = BASE * r;
      let lo = 0, hi = dist.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (dist[m]! <= lim) lo = m + 1; else hi = m; }
      geo.instanceCount = lo;
    },
    setDensity(tile: number, v: number) { if (base[tile] !== v) { base[tile] = v; write(tile); dirty = true; } },
    dispose() { hTex.dispose(); mTex.dispose(); bladeTex.dispose(); geo.dispose(); card.dispose(); mat.dispose(); },
    setWear(tile: number, worn: number) { if (Math.abs(wear[tile]! - worn) > 0.02) { wear[tile] = worn; write(tile); dirty = true; } },
  };
}

/**
 * Tekstura kępy: ok. 160 źdźbeł w odcieniach szarości (barwę daje ziemia pod spodem), zwężających się ku górze,
 * dalsze ciemniejsze, bliższe jaśniejsze, z jaśniejszym nerwem; tło przezroczyste.
 */
export function bladeTexture(seed: number): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 160; i++) {
    const depth = i / 160;
    const x0 = N * (0.5 + (rnd() - 0.5) * 0.8);
    const hgt = N * (0.3 + rnd() * 0.68) * (1 - Math.abs(x0 / N - 0.5) * 0.8);
    const lean = (x0 / N - 0.5) * N * 0.6 + (rnd() - 0.5) * N * 0.3;
    const wd = N * (0.012 + rnd() * 0.016);
    const v = Math.round(60 + depth * 150 + rnd() * 40);
    const x1 = x0 + lean, y1 = N - hgt, cxp = x0 + lean * 0.2, cyp = N - hgt * 0.62;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.moveTo(x0 - wd, N);
    ctx.quadraticCurveTo(cxp - wd * 0.6, cyp, x1, y1);
    ctx.quadraticCurveTo(cxp + wd * 0.6, cyp, x0 + wd, N);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

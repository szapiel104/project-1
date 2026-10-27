/**
 * Kałuże na drogach gruntowych (co któreś pole), widoczne tylko gdy mokro (wyniesione z scene.ts, 23.10.2026).
 *
 * Przebudowa 27.10.2026 — wcześniej były płaskimi dyskami (instancje) zawieszonymi 5 cm nad środkiem pola:
 * - na nierównym terenie brzeg dysku wchodził pod nawierzchnię drogi (ta leży 3–4,5 cm nad gruntem i idzie za jego
 *   kształtem), więc kałuże były pocięte, migały i znikały zależnie od kąta i odległości kamery;
 * - twarde krawędzie i metal bez odbić dawały czarne, „nalepione” plamy.
 * Teraz:
 * - jedna wspólna siatka; każdy wierzchołek kałuży leży na terenie (heightAt), więc kałuża idzie za podłożem;
 * - w shaderze kałuża jest przesuwana ku kamerze o kilka cm (więcej z daleka) — zawsze nad drogą, bez migania,
 *   a postacie i budynki dalej ją zasłaniają;
 * - kształt nieregularny, brzeg miękki, wokół ciemna obwódka mokrego błota, środek gładki i odbija niebo;
 * - rosną w czasie deszczu i kurczą się przy schnięciu (małe znikają pierwsze) zamiast całe blaknąć;
 * - w deszczu po wodzie biegną drobne kręgi;
 * - tylko na płaskich kawałkach drogi (na zboczu woda by spłynęła) i wydłużone wzdłuż drogi, jak w koleinach.
 * Układ liczony od nowa tylko po zmianie dróg albo mapy.
 */
import * as THREE from 'three';
import type { GameState } from '../sim/state';
import type { TerrainView } from './terrain';
import { cat } from './cat';

const MAX = 1024;
const SEG = 20; // wierzchołki na obwodzie
const RINGS = 4; // pierścienie od środka do brzegu (siatka idzie za terenem)
/** Najmniejsza wysokość nad terenem; reszta odstępu od drogi robi przesunięcie ku kamerze w shaderze */
const LIFT = 0.035;
/** Kałuża tylko tam, gdzie teren prawie płaski (metry spadku na pole) */
const MAX_SLOPE = 0.16;

const VERT_HEAD = /* glsl */ `
attribute vec3 pd; // x, y: położenie w kałuży (-1..1, brzeg ok. 1); z: ziarno kałuży 0..1
varying vec3 vPd;
varying vec2 vPW;
`;
const FRAG_HEAD = /* glsl */ `
uniform float uWet;
uniform float uRain;
uniform float uTime;
varying vec3 vPd;
varying vec2 vPW;
float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), u.x), mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// kręgi od kropel: kilka komórek siatki, w każdej kropla w innej chwili
vec2 pRipple(vec2 p, float t) {
  vec2 cell = floor(p), f = fract(p) - 0.5;
  float h = pHash(cell);
  float ph = fract(t * 0.9 + h);
  vec2 c = vec2(pHash(cell + 3.1), pHash(cell + 7.3)) * 0.5 - 0.25;
  vec2 d = f - c;
  float r = length(d);
  float wave = sin((r - ph * 0.45) * 38.0) * smoothstep(0.0, 0.05, ph * 0.45 - r + 0.05) * smoothstep(0.45, 0.0, r) * (1.0 - ph);
  return d / max(r, 1e-3) * wave;
}
`;

const material = (): THREE.MeshStandardMaterial => {
  const m = new THREE.MeshStandardMaterial({
    color: 0x2b261f, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.4,
  });
  const u = { uWet: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_HEAD + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPd = pd;\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xz;')
      // zamiast polygonOffset (stały w pikselach, z daleka za mały): odsuwamy kałużę ku kamerze o kilka cm w świecie
      .replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 mv = mvPosition;
    float d = length(mv.xyz);
    mv.xyz *= max(0.0, 1.0 - (0.05 + d * 0.0025) / max(d, 0.001));
    gl_Position = projectionMatrix * mv;
  }`);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  float pr = length(vPd.xy);
  // poszarpany brzeg (szum w świecie, więc każda kałuża ma inny), a zasięg wody zależny od wilgoci:
  // przy schnięciu kałuża kurczy się od brzegów, małe (niższe ziarno) znikają pierwsze
  float edgeN = pNoise(vPW * 3.1 + vPd.z * 17.0) * 0.28 + pNoise(vPW * 9.0) * 0.1;
  float reach = clamp(uWet * 1.5 - vPd.z * 0.35, 0.0, 1.0);
  float edge = reach * (0.92 - edgeN);
  float water = smoothstep(edge, edge - 0.1, pr) * step(0.02, reach);
  float mud = smoothstep(edge + 0.22, edge, pr) * smoothstep(0.0, 0.25, reach);
  diffuseColor.rgb = mix(vec3(0.16, 0.12, 0.085), diffuseColor.rgb, water);
  diffuseColor.a *= max(water * 0.88, mud * 0.42);
  if (diffuseColor.a < 0.004) discard;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(0.55, roughnessFactor + pNoise(vPW * 1.7) * 0.05, water);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // drobna fala od wiatru zawsze, kręgi kropel tylko w deszczu
    vec2 tilt = vec2(pNoise(vPW * 2.3 + uTime * 0.25) - 0.5, pNoise(vPW * 2.3 - uTime * 0.21 + 5.0) - 0.5) * 0.06;
    if (uRain > 0.02) tilt += (pRipple(vPW * 2.2, uTime) + pRipple(vPW * 2.2 + 0.5, uTime * 1.13 + 0.4)) * 0.22 * uRain;
    normal = normalize(normal + (viewMatrix * vec4(tilt.x, 0.0, tilt.y, 0.0)).xyz * water);
  }`);
  };
  m.customProgramCacheKey = () => 'puddles-v2';
  return m;
};

export class PuddleLayer {
  private mesh: THREE.Mesh | null = null;
  private key = '';
  private viewRef: TerrainView | null = null;
  constructor(private scene: THREE.Scene) {}

  /** Kałuże na ścieżkach gruntowych (co któreś pole), widoczne tylko gdy mokro; rain i time do kręgów od kropel */
  sync(g: GameState, view: TerrainView, wet: number, roadSum: number, rain = 0, time = 0): void {
    if (!this.mesh) {
      const geo = new THREE.BufferGeometry();
      this.mesh = cat(new THREE.Mesh(geo, material()), 'kałuże');
      this.mesh.name = 'kałuże';
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 1;
      this.mesh.receiveShadow = true;
      this.mesh.userData.noCull = true;
      this.scene.add(this.mesh);
    }
    const u = (this.mesh.material as THREE.MeshStandardMaterial).userData.u as Record<string, { value: number }>;
    u.uWet!.value = wet; u.uRain!.value = rain; u.uTime!.value = time;
    this.mesh.visible = wet > 0.03;
    if (!this.mesh.visible) return;
    const key = `${roadSum}|${g.map.width}x${g.map.height}|${g.map.seed}`;
    if (key === this.key && view === this.viewRef) return;
    this.key = key; this.viewRef = view;
    this.build(g, view);
  }

  private build(g: GameState, view: TerrainView): void {
    const { width, height } = g.map;
    const per = 1 + RINGS * SEG;
    const pos: number[] = [], pd: number[] = [], idx: number[] = [];
    const road = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && g.roads[y * width + x] === 1;
    let n = 0;
    for (let t = 0; t < g.roads.length && n < MAX; t++) {
      if (g.roads[t] !== 1) continue;
      const hsh = (t * 2654435761) >>> 0;
      if (hsh % 3 !== 0) continue;
      const tx = t % width, ty = Math.floor(t / width);
      const cx = tx + 0.5 + (((hsh >>> 8) & 255) / 255 - 0.5) * 0.3, cy = ty + 0.5 + (((hsh >>> 16) & 255) / 255 - 0.5) * 0.3;
      const slope = Math.hypot(view.heightAt(cx + 0.35, cy) - view.heightAt(cx - 0.35, cy), view.heightAt(cx, cy + 0.35) - view.heightAt(cx, cy - 0.35)) / 0.7;
      if (slope > MAX_SLOPE) continue;
      // wzdłuż drogi: koleina po osi, którą biegnie droga; na skrzyżowaniu albo pojedynczym polu — dowolnie
      const alongX = road(tx - 1, ty) || road(tx + 1, ty), alongY = road(tx, ty - 1) || road(tx, ty + 1);
      const yaw = alongX && !alongY ? 0 : alongY && !alongX ? Math.PI / 2 : (hsh & 63) / 10;
      const wob = (((hsh >>> 4) & 15) / 15 - 0.5) * 0.5;
      const len = 0.34 + ((hsh >>> 12) & 15) / 60, wid = 0.2 + ((hsh >>> 20) & 15) / 80;
      const seed = ((hsh >>> 24) & 255) / 255;
      const cs = Math.cos(yaw + wob), sn = Math.sin(yaw + wob);
      const base = n * per;
      const put = (lx: number, ly: number): void => {
        const wx = cx + (lx * len) * cs - (ly * wid) * sn, wy = cy + (lx * len) * sn + (ly * wid) * cs;
        pos.push(wx - width / 2, view.heightAt(wx, wy) + LIFT, wy - height / 2);
        pd.push(lx, ly, seed);
      };
      put(0, 0);
      // zewnętrzny pierścień trochę dalej niż brzeg wody (1.0): tam leży miękka obwódka mokrego błota
      for (let r = 1; r <= RINGS; r++) {
        const rr = (r / RINGS) * 1.25;
        for (let s = 0; s < SEG; s++) { const a = (s / SEG) * Math.PI * 2; put(Math.cos(a) * rr, Math.sin(a) * rr); }
      }
      for (let s = 0; s < SEG; s++) idx.push(base, base + 1 + ((s + 1) % SEG), base + 1 + s);
      for (let r = 1; r < RINGS; r++) {
        const a0 = base + 1 + (r - 1) * SEG, a1 = base + 1 + r * SEG;
        for (let s = 0; s < SEG; s++) {
          const s1 = (s + 1) % SEG;
          idx.push(a0 + s, a0 + s1, a1 + s, a1 + s, a0 + s1, a1 + s1);
        }
      }
      n++;
    }
    const old = this.mesh!.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('pd', new THREE.Float32BufferAttribute(pd, 3));
    const nrm = new Float32Array(pos.length);
    for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    this.mesh!.geometry = geo;
    old.dispose();
  }

  /** Ile kałuż jest teraz rozłożonych (testy, podgląd) */
  get count(): number {
    const p = this.mesh?.geometry.getAttribute('position');
    return p ? p.count / (1 + RINGS * SEG) : 0;
  }
}

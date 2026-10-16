import * as THREE from 'three';

/**
 * Wygląd pór roku wspólny dla całej sceny: śnieg na ziemi, dachach i koronach świerków (na powierzchniach zwróconych
 * w górę, w plamach), szron o świcie, jesienne liście (żółte i rude), gołe drzewa liściaste zimą, zszarzała trawa.
 *
 * Każdy materiał dostaje te same mundury (wspólne obiekty), więc zmiana pory roku to zmiana kilku liczb — bez
 * przebudowy shaderów. Materiały łatamy raz (applySeason przechodzi po scenie i dokłada wstawki do shaderów).
 */
export const SEASON_U = {
  uSnow: { value: 0 },
  uFrost: { value: 0 },
  uAutumn: { value: 0 },
  uBare: { value: 0 },
  /** Wiosna: świeża jasna zieleń i kwitnące drzewa (0..1) */
  uSpring: { value: 0 },
  /** Lato: głęboka zieleń liści, pod koniec płowiejąca trawa (0..1) */
  uSummer: { value: 0 },
  /** Ślady na śniegu (wydeptanie 0..1) i jak je czytać: [przesunięcie x, przesunięcie z, 1/szerokość, 1/wysokość] w metrach */
  uTrail: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) as THREE.Texture },
  uTrailMap: { value: new THREE.Vector4(0, 0, 1, 1) },
};

/**
 * Ślady na śniegu: mapa wydeptania (4 piksele na pole). Każdy idący człowiek i wilk odciska w niej ślad, ślad
 * powoli się zasypuje (pojedyncze przejście po ok. 45 s, wydeptana ścieżka po ok. 2 min); ziemia i trawa pokazują w tych miejscach mniej śniegu.
 */
export class SnowTrails {
  private static readonly RES = 4;
  private data: Uint8Array;
  private tex: THREE.DataTexture;
  private active = new Set<number>();
  private last = new Map<number, [number, number]>();
  private fade = 0;
  private dirty = 0;
  constructor(private w: number, private h: number) {
    const R = SnowTrails.RES;
    this.data = new Uint8Array(w * R * h * R);
    this.tex = new THREE.DataTexture(this.data, w * R, h * R, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    SEASON_U.uTrail.value = this.tex;
    // świat: x = pole − w/2, z = pole − h/2
    SEASON_U.uTrailMap.value.set(w / 2, h / 2, 1 / w, 1 / h);
  }
  /** Odcisk stopy w polach mapy (x, y); id = kto idzie (żeby łączyć kroki w ciągłą ścieżkę) */
  step(id: number, x: number, y: number): void {
    const prev = this.last.get(id);
    if (prev) {
      const d = Math.hypot(x - prev[0], y - prev[1]);
      if (d > 3) { this.last.set(id, [x, y]); return; } // przeskok (wejście do budynku, wczytanie): bez kreski przez pół mapy
      if (d < 1 / SnowTrails.RES) return; // jeden odcisk na piksel mapy, niezależnie od liczby klatek na sekundę
      this.last.set(id, [x, y]);
      const n = Math.ceil(d * SnowTrails.RES);
      for (let i = 1; i <= n; i++) this.dot(prev[0] + (x - prev[0]) * i / n, prev[1] + (y - prev[1]) * i / n);
    } else { this.last.set(id, [x, y]); this.dot(x, y); }
  }
  private dot(x: number, y: number): void {
    const R = SnowTrails.RES, W = this.w * R;
    const i = Math.floor(x * R), j = Math.floor(y * R);
    if (i < 0 || j < 0 || i >= W || j >= this.h * R) return;
    const k = j * W + i;
    this.data[k] = Math.min(255, this.data[k]! + 90);
    this.active.add(k);
    this.dirty++;
  }
  /** Zasypywanie śladów i wysyłka mapy do karty graficznej (najwyżej 4 razy na sekundę) */
  update(dt: number, refill: number): void {
    this.fade += dt;
    if (this.fade < 0.25) return;
    const sub = Math.max(1, Math.round(this.fade * refill));
    this.fade = 0;
    for (const k of this.active) {
      const v = this.data[k]! - sub;
      if (v <= 0) { this.data[k] = 0; this.active.delete(k); } else this.data[k] = v;
    }
    if (this.dirty || this.active.size) { this.tex.needsUpdate = true; this.dirty = 0; }
  }
  /** Ktoś zniknął z mapy — następny krok zaczyna nową ścieżkę */
  forget(alive: Set<number>): void { for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id); }
  dispose(): void { this.tex.dispose(); SEASON_U.uTrail.value = new THREE.DataTexture(new Uint8Array(4), 1, 1); }
}

/** Rodzaj materiału: zwykły (śnieg na górnych ścianach), liście (jesień, gołe zimą), trawa (szarzeje, przysypana) */
export type SeasonKind = 'solid' | 'ground' | 'leaf' | 'leafFar' | 'grass';

// Mapa śladów: trawa czyta ją w pikselach; ziemia w wierzchołkach (jej shader ma już 14 tekstur, a karty
// graficzne pozwalają na 16 w pikselach — z jedną więcej cały teren przestaje się rysować); reszta wcale.
const VERT_HEAD = (kind: SeasonKind): string => 'uniform float uBare;\nvarying vec3 vSeasonPos;\n' +
  (kind === 'ground' ? 'uniform sampler2D uTrail;\nuniform vec4 uTrailMap;\nvarying float vTrail;\n' : '');
const VERT_BODY = (kind: SeasonKind): string => `
  ${kind === 'leaf' ? 'transformed *= max(0.0, 1.0 - uBare);' : ''}
  {
    vec4 sP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      sP = instanceMatrix * sP;
    #endif
    vSeasonPos = (modelMatrix * sP).xyz;
    ${kind === 'ground' ? 'vTrail = texture2D(uTrail, (vSeasonPos.xz + uTrailMap.xy) * uTrailMap.zw).r;' : ''}
  }
`;
const FRAG_HEAD = (kind: SeasonKind): string => (kind === 'grass' ? 'uniform sampler2D uTrail;\nuniform vec4 uTrailMap;\n' : kind === 'ground' ? 'varying float vTrail;\n' : '') + 'uniform float uSpring;\nuniform float uSummer;\nuniform float uSnow;\nuniform float uFrost;\nuniform float uAutumn;\nuniform float uBare;\nvarying vec3 vSeasonPos;\n' +
  'float sHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' +
  'float sVal(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
  '  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
  'float sPatch(vec2 p) { return sVal(p * 0.28) * 0.55 + sVal(p * 0.9 + 7.3) * 0.3 + sVal(p * 3.1 - 2.1) * 0.15; }\n';
const FRAG_BODY = (kind: SeasonKind): string => `
  {
    vec3 sWN = normalize(inverseTransformDirection(normal, viewMatrix));
    float sCell = fract(sin(dot(floor(vSeasonPos.xz * 0.9), vec2(12.9898, 78.233))) * 43758.5453);
    ${kind === 'grass' ? 'float sTrail = texture2D(uTrail, (vSeasonPos.xz + uTrailMap.xy) * uTrailMap.zw).r;' : kind === 'ground' ? 'float sTrail = vTrail;' : ''}
    float sWave = sin(vSeasonPos.x * 1.3 + vSeasonPos.z * 0.7) * sin(vSeasonPos.z * 1.1 - vSeasonPos.x * 0.4) * 0.5 + 0.5;
    ${kind === 'leaf' || kind === 'leafFar' ? `
    // jesień: liście żółkną i rudzieją (każde drzewo trochę inaczej), zimą resztki brązowieją
    float sLum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
    // wiosna: młode liście jasne, żółtawozielone
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.32, 0.62) + vec3(0.03, 0.05, 0.0), uSpring * 0.85);
    // lato: zieleń ciemnieje i nasyca się
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.88, 0.7), uSummer * 0.8);
    vec3 sFall = mix(mix(vec3(0.88, 0.58, 0.07), vec3(0.8, 0.32, 0.05), sCell), vec3(0.55, 0.16, 0.05), sCell * sCell) * (0.5 + sLum * 1.1);
    diffuseColor.rgb = mix(diffuseColor.rgb, sFall, clamp(uAutumn * (0.75 + sCell * 0.35), 0.0, 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.33, 0.24) * (0.6 + sLum), uBare * 0.8);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.78, 0.84), uSnow * 0.3 * smoothstep(0.2, 0.8, sWN.y));` : ''}
    ${kind === 'grass' ? `
    // trawa: jesienią płowieje, zimą szarzeje i niknie pod śniegiem
    float sG = dot(diffuseColor.rgb, vec3(0.33));
    // wiosną soczyście zielona, latem pod koniec płowieje
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 1.22, 0.7), uSpring * 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.56, 0.3) * (0.55 + sG), uSummer * 0.3);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.55, 0.3) * (0.6 + sG), uAutumn * 0.55 + uBare * 0.25);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.78, 0.84), max(smoothstep(0.0, 0.1, uSnow * 1.25 - (0.92 - sPatch(vSeasonPos.xz))) * 0.85, uFrost * 0.35) * (1.0 - sTrail * 0.8));` : `
    // śnieg leży na tym, co patrzy w górę (płaskie dachy i ziemia najmocniej, strome połacie mniej), w plamach;
    // szron rano: cienki, tylko na płaskim
    float sUp = smoothstep(0.45, 0.92, sWN.y);
    // mało śniegu = osobne białe płaty (najpierw w zagłębieniach fali), a nie szary nalot na całej ziemi
    float sNoise = sPatch(vSeasonPos.xz);
    float sAmt = sUp * smoothstep(0.0, 0.1, uSnow * 1.25 - (0.92 - sNoise)) * 0.9;
    sAmt = max(sAmt, uFrost * 0.3 * smoothstep(0.7, 0.95, sWN.y) * (0.5 + sNoise * 0.5));
    ${kind === 'ground' ? `
    // wydeptane ścieżki: śnieg ubity i przemieszany z ziemią
    sAmt *= 1.0 - sTrail * 0.65;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.78, 0.84) * (1.0 - sTrail * 0.25), sAmt);` : `
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.78, 0.84), sAmt);`}
    #ifdef STANDARD
      roughnessFactor = mix(roughnessFactor, 0.8, sAmt);
    #endif`}
  }
`;

const done = new WeakSet<THREE.Material>();
/** Materiały wnętrz: te same co na zewnątrz (deski, kamień), ale pod dachem — bez śniegu i pór roku */
const indoor = new WeakSet<THREE.Material>();
const twins = new WeakMap<THREE.Material, THREE.Material>();
function indoorTwin(m: THREE.Material): THREE.Material {
  if (indoor.has(m)) return m;
  let t = twins.get(m);
  if (!t) {
    t = m.clone();
    t.onBeforeCompile = m.onBeforeCompile;
    t.customProgramCacheKey = m.customProgramCacheKey;
    t.userData = m.userData;
    indoor.add(t);
    twins.set(m, t);
  }
  return t;
}
/** Dokłada wstawki pór roku do materiału (raz); istniejące onBeforeCompile zostają i działają pierwsze */
export function seasonMaterial(m: THREE.Material, kind: SeasonKind): void {
  if (done.has(m)) return;
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial) return;
  done.add(m);
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  // zwykłe funkcje (this = materiał): bliźniak do wnętrz (indoorTwin) dziedziczy je, ale bez śniegu
  m.onBeforeCompile = function (this: THREE.Material, sh, r) {
    prev.call(this, sh, r);
    if (indoor.has(this)) return;
    if (!sh.fragmentShader.includes('#include <lights_physical_fragment>') || !sh.vertexShader.includes('#include <project_vertex>')) return;
    Object.assign(sh.uniforms, SEASON_U);
    sh.vertexShader = VERT_HEAD(kind) + sh.vertexShader.replace('#include <project_vertex>', VERT_BODY(kind) + '#include <project_vertex>');
    sh.fragmentShader = FRAG_HEAD(kind) + sh.fragmentShader.replace('#include <lights_physical_fragment>', FRAG_BODY(kind) + '#include <lights_physical_fragment>');
  };
  m.customProgramCacheKey = function (this: THREE.Material) { return indoor.has(this) ? prevKey.call(this) : `${prevKey.call(this)}|season-${kind}`; };
  m.needsUpdate = true;
}

/** Podpisy grup (cat), których nie przysypujemy: ludzie, zwierzęta, niesione rzeczy, woda, chmury, dym, ogień */
const INSIDE = new Set(['interior', 'floor', 'ceiling']);
const SKIP = /^(postacie|wilki|kruki|niesione|narzędzia|zwierzęta|woda|chmury|dym|płomienie|ryby|tarany)/;

/** Przechodzi po obiekcie i łata jego materiały; rodzaj z material.userData.season (domyślnie zwykły) */
export function applySeason(root: THREE.Object3D): void {
  const walk = (o: THREE.Object3D, skip: boolean): void => {
    const cat = o.userData.cat as string | undefined;
    // wnętrza budynków (podłogi, sprzęty, sufity sal) są pod dachem: bez śniegu, szronu i pór roku
    const sk = skip || (!!cat && SKIP.test(cat)) || !!o.userData.noSeason || INSIDE.has(o.name);
    const m = o as THREE.Mesh;
    const inside = INSIDE.has(o.name) || (skip && o.userData.seasonInside);
    if (inside) o.userData.seasonInside = true;
    if (inside && m.isMesh && m.material) m.material = Array.isArray(m.material) ? m.material.map(indoorTwin) : indoorTwin(m.material);
    if (!sk && m.isMesh && m.material) {
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (mat.transparent && !mat.alphaTest) continue;
        seasonMaterial(mat, (mat.userData.season as SeasonKind | undefined) ?? 'solid');
      }
    }
    for (const ch of o.children) { if (inside) ch.userData.seasonInside = true; walk(ch, sk); }
  };
  walk(root, false);
}

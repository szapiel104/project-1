import * as THREE from 'three';
import { cloudShade } from './ground';
import { groundGrassTexture2, sharedNoise } from './ground';
import { maskedTex } from './forest';
import { SEASON_U } from './season';

/**
 * Trawa jak w nowych grach: gęsty dywan kęp wokół miejsca, na które patrzymy, zamiast pojedynczych kępek na płaskiej ziemi.
 * - Siatka kilkudziesięciu tysięcy kęp (instancje, 4 karty rozchylone jak płatki = 8 trójkątów) jedzie za kamerą skokami o oczko,
 *   a położenie, obrót i wielkość każdej kępy wynikają z jej pola w świecie, więc trawa stoi w miejscu, gdy kamera jedzie.
 * - Wysokość terenu i gęstość trawy shader czyta z tekstur mapy (wysokości narożników, maska: łąka gęsto, las rzadko,
 *   droga, budynek, woda, wydeptana ziemia — nic). Na brzegu zasięgu kępy maleją do zera, bez twardej granicy.
 * - Kępy to zdjęcia prawdziwych kęp z Poly Haven (CC0, zrobione przez grafików; Blender robi z nich atlas 4×2,
 *   tools/models/grass_polyhaven.py): łąka, wysokie źdźbła z kłosami, gęsta niska trawa, rzadkie siewki, mniszek.
 *   Każda z dwóch kart kępy losuje swoje pole atlasu, więc skrzyżowane karty to dwie różne kępy. Barwa ze zdjęcia,
 *   lekko podciągnięta do odcienia ziemi pod spodem (dywan się z nią zlewa), plamy jaśniejsze i płowe jak na podłożu,
 *   a jesienią źdźbła przechodzą w suchą wersję tego samego zdjęcia (pv_grass_dry).
 */
const GRID = 290; // kępy w rzędzie: siatka na najdalszy zasięg (Ultra); zwykły pełny zasięg używa promienia BASE
/**
 * Pola atlasu (kolejność z grass_polyhaven.py) i jak często się trafiają (suma 1): gęsta niska trawa najczęściej,
 * łąka i kłosy rzadziej, rzadkie siewki i mniszek tu i ówdzie. Pole = 0,42 m na bok w zdjęciu, w grze FRAME pól.
 */
const TILE_WEIGHTS = [0.05, 0.03, 0.3, 0.17, 0.06, 0.33, 0.03, 0.03];
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
  /** Nowa wysokość narożnika (wyrównany teren pod budynkiem) */
  setHeight(corner: number, y: number): void;
  /** Zwalnia tekstury i geometrię dywanu (przy zmianie mapy) */
  dispose(): void;
}

/**
 * lush: bujność pola 0…1 (1 przy samej wodzie, maleje z odległością) — tam trawa rośnie wszędzie, wyższa i z kłosami.
 * Gdzie indziej łąka nie jest równym dywanem: kępy stoją płatami (szum w skali kilku pól), między płatami
 * zostaje sama tekstura trawy na ziemi i pojedyncze siewki. Na zboczach trawa rzednie i znika (jak w edytorach
 * terenu: zakres nachylenia dla trawy), więc przy górach zostaje ziemia i kamień.
 */
export function createGrassField(w: number, h: number, corners: Float32Array, density: Float32Array, grassTex: THREE.Texture | null, lush?: Float32Array): GrassField {
  const bladeTex = maskedTex('pv_grass') ?? new THREE.Texture();
  const dryTex = maskedTex('pv_grass_dry', 'pv_grass_a') ?? bladeTex;
  for (const t of [bladeTex, dryTex]) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  // wysokości narożników pól (w+1)×(h+1) w teksturze zmiennoprzecinkowej, czytane w shaderze
  const hTex = new THREE.DataTexture(new Float32Array(corners), w + 1, h + 1, THREE.RedFormat, THREE.FloatType);
  hTex.minFilter = hTex.magFilter = THREE.NearestFilter;
  hTex.needsUpdate = true;
  const base = new Float32Array(density);
  const wear = new Float32Array(w * h);
  const mask = new Uint8Array(w * h * 4);
  const write = (t: number): void => { mask[t * 4] = Math.round(Math.max(0, Math.min(1, base[t]! * (1 - wear[t]!))) * 255); };
  for (let t = 0; t < w * h; t++) { write(t); mask[t * 4 + 1] = Math.round(Math.max(0, Math.min(1, lush?.[t] ?? 0)) * 255); mask[t * 4 + 3] = 255; }
  const mTex = new THREE.DataTexture(mask, w, h, THREE.RGBAFormat);
  mTex.magFilter = THREE.LinearFilter; mTex.minFilter = THREE.LinearFilter;
  mTex.needsUpdate = true;
  let dirty = false;

  // kępa: cztery karty rozchylone na zewnątrz jak płatki (zdjęcia kęp są robione z boku, a kamera patrzy z góry —
  // pionowe karty na krzyż dawały z góry same cienkie paski „X”, a pochylone płatki pokazują zdjęcie z każdej strony
  // i z góry); kępa jest przyklejona do świata, nie obraca się z kamerą. Normalne w górę (świeci jak ziemia pod nią);
  // aCard = numer płatka (osobne pole atlasu)
  const card = new THREE.BufferGeometry();
  {
    const P: number[] = [], U: number[] = [], N: number[] = [], I: number[] = [];
    for (let k = 0; k < 4; k++) {
      const b = P.length / 3;
      P.push(-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0);
      U.push(0, 0, k, 1, 0, k, 1, 1, k, 0, 1, k);
      for (let i = 0; i < 4; i++) N.push(0, 1, 0);
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    card.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    card.setAttribute('aCard', new THREE.Float32BufferAttribute(U.filter((_, i) => i % 3 === 2), 1));
    card.setAttribute('uv', new THREE.Float32BufferAttribute(U.filter((_, i) => i % 3 !== 2), 2));
    card.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    card.setIndex(I);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = card.index;
  for (const k of ['position', 'uv', 'normal', 'aCard'] as const) geo.setAttribute(k, card.getAttribute(k));
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
    tH: { value: hTex }, tMask: { value: mTex }, tBlade: { value: bladeTex }, tDry: { value: dryTex }, gAutumn: SEASON_U.uAutumn, gBare: SEASON_U.uBare, tGround: { value: grassTex },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = /* glsl */ `
      attribute vec2 aCell; attribute float aCard;
      uniform vec2 uOrigin; uniform float uTime; uniform vec2 uMap; uniform float uFade; uniform float uReach;
      uniform sampler2D tH; uniform sampler2D tMask; uniform sampler2D tNoise;
      varying vec2 vGUv; varying vec2 vGW; varying float vGTone; varying vec2 vAUv; varying float vDry;
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
      vec4 mk = texture2D(tMask, p / uMap);
      float lush = mk.g;
      // płaty: duży szum (plamy ok. 5–6 pól) z postrzępionym brzegiem; przy wodzie płat wszędzie
      float pn = texture2D(tNoise, p / 34.0 + vec2(0.31, 0.77)).g * 0.75 + texture2D(tNoise, p / 7.0 + vec2(0.13, 0.52)).b * 0.25;
      float gPatch = smoothstep(0.42, 0.6, pn + lush * 0.45);
      // nachylenie terenu (różnica wysokości na polu): od ok. 20° trawa rzednie, powyżej ok. 35° nie ma jej wcale
      vec2 gr = vec2(gHeight(p + vec2(0.5, 0.0)) - gHeight(p - vec2(0.5, 0.0)), gHeight(p + vec2(0.0, 0.5)) - gHeight(p - vec2(0.0, 0.5)));
      float slopeK = 1.0 - smoothstep(0.36, 0.7, length(gr));
      // poza płatami zostają pojedyncze, rzadkie kępy (łąka nie jest łysa, tylko niska)
      float dens = mk.r * slopeK * mix(0.32, 1.0, gPatch);
      // im dalej od środka, tym mniejsze kępy (miękki brzeg dywanu)
      // brzeg dywanu: kępy rzedną i maleją stopniowo przez całą drugą połowę zasięgu (bez widocznego koła)
      float rr = length(aCell) / (${BASE.toFixed(1)} * uReach);
      float edge = 1.0 - smoothstep(0.35, 0.97, rr + (gHash(cell + 5.5) - 0.5) * 0.25);
      float keep = step(r3, smoothstep(0.25, 0.9, dens) * 1.1) * step(gHash(cell + 7.7), edge);
      // bok zdjęcia kępy (0,42 m) w polach: kępy w zdjęciach mają prawdziwe proporcje, w grze ok. 2,5 raza większe
      float sz = mix(0.32, 0.46, gHash(cell + 3.7)) * keep * mix(0.6, 1.0, edge) * uFade * mix(0.7, 1.0, gPatch) * mix(1.0, 1.35, lush) * mix(0.75, 1.0, slopeK);
      vec3 gBase = vec3(p.x - uMap.x * 0.5, gHeight(p) - 0.01, p.y - uMap.y * 0.5);
      // pole atlasu tej karty: losowanie z wagami TILE_WEIGHTS; na rzadkiej trawie (skraj lasu, wydeptane) częściej siewki
      float pick = gHash(cell + 23.1 + aCard * 11.7);
      ${(() => {
        let acc = 0;
        return TILE_WEIGHTS.slice(0, -1).map((wt, i) => { acc += wt; return `float t${i} = step(${acc.toFixed(3)}, pick);`; }).join(' ');
      })()}
      float tile = ${TILE_WEIGHTS.slice(0, -1).map((_, i) => `t${i}`).join(' + ')};
      tile = dens < 0.5 && gHash(cell + 61.3) < 0.35 ? 6.0 : tile;
      // przy wodzie częściej wysokie źdźbła z kłosami i wysoka łąka
      float lp1 = gHash(cell + 83.9 + aCard);
      tile = lp1 < lush * 0.55 ? (lp1 < lush * 0.3 ? 4.0 : 1.0) : tile;
      float flip = step(0.5, gHash(cell + 3.3 + aCard));
      vec2 tu = vec2(mix(uv.x, 1.0 - uv.x, flip), uv.y);
      vAUv = vec2((mod(tile, 4.0) + clamp(tu.x, 0.004, 0.996)) / 4.0, (1.0 - floor(tile / 4.0) + clamp(tu.y, 0.0, 0.992)) / 2.0);
      vDry = gHash(cell + 77.7);
      // płatki: podstawa lekko odsunięta od środka kępy, czubek odchylony na zewnątrz o ok. 40–50° od pionu
      // (z góry widać zdjęcie, z boku kępa dalej stoi); obrót kępy losowy, ale stały — nie zależy od kamery
      float lean = mix(0.68, 0.86, gHash(cell + 13.1 + aCard));
      float hgt = sz * mix(0.8, 1.1, r2);
      vec3 lp = vec3(position.x * sz, position.y * hgt * cos(lean), position.y * hgt * sin(lean) + 0.1 * sz);
      float cy = r1 * 6.2831 + aCard * 1.5708 + (gHash(cell + 29.3 + aCard) - 0.5) * 0.6;
      vec3 transformed = vec3(lp.x * cos(cy) + lp.z * sin(cy), lp.y, -lp.x * sin(cy) + lp.z * cos(cy));
      // wiatr: fale przechodzą przez łąkę, czubki chodzą najmocniej
      float gust = sin(uTime * 1.6 + p.x * 0.35 + p.y * 0.22) * 0.6 + sin(uTime * 3.4 + p.x * 1.7 - p.y * 1.1) * 0.25;
      transformed.x += gust * 0.05 * uv.y * uv.y * sz;
      transformed.z += gust * 0.025 * uv.y * uv.y * sz;
      transformed += gBase;
      vGUv = uv; vGW = transformed.xz; vGTone = gHash(cell + 9.1);
    `).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    sh.fragmentShader = /* glsl */ `
      uniform float gAutumn; uniform float gBare; uniform sampler2D tBlade; uniform sampler2D tDry; uniform sampler2D tGround; uniform sampler2D tGround2; uniform sampler2D tNoise;
      varying vec2 vGUv; varying vec2 vGW; varying float vGTone; varying vec2 vAUv; varying float vDry;
    ` + sh.fragmentShader.replace('#include <map_fragment>', /* glsl */ `
      vec4 bl = texture2D(tBlade, vAUv);
      // podłoże pod kępą (ta sama trawa, plamy jasności i płowe łaty co ziemia), żeby dywan się z nim zlewał
      vec4 nM = texture2D(tNoise, vGW / 96.0), nS = texture2D(tNoise, vGW / 23.0 + 0.37);
      vec3 gc = texture2D(tGround, vGW / 3.1).rgb;
      vec2 r2 = vec2(cos(2.1) * vGW.x - sin(2.1) * vGW.y, sin(2.1) * vGW.x + cos(2.1) * vGW.y);
      gc = mix(gc, texture2D(tGround2, r2 / 4.3).rgb * vec3(0.92, 0.9, 0.8), smoothstep(0.38, 0.72, nM.r) * 0.85);
      // suche źdźbła: pojedyncze kępy i płowe łaty latem, jesienią coraz więcej, pod koniec jesieni wszystko
      float dryAmt = clamp(smoothstep(0.9, 1.0, vDry) * 0.45 + smoothstep(0.7, 0.9, nM.g) * 0.3 + gAutumn * 1.2 + gBare - (1.0 - vDry) * gAutumn * 0.6, 0.0, 1.0);
      vec3 col = mix(bl.rgb, texture2D(tDry, vAUv).rgb, dryAmt);
      float gL = max(dot(gc, vec3(0.3, 0.59, 0.11)), 1e-3), cL = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, cL * gc / gL, mix(0.72, 0.15, dryAmt));
      // zdjęcie jest jaśniej oświetlone (miękkie niebo w Blenderze): jasność ściągamy do podłoża pod kępą, z lekkim prześwitem
      col *= mix(1.0, clamp(gL * 3.2 / max(cL, 1e-3), 0.35, 1.0), 0.75);
      col *= (0.84 + nM.b * 0.3 + (nS.r - 0.5) * 0.14) * mix(0.9, 1.08, vGTone);
      col *= 0.9;
      diffuseColor.rgb *= col * mix(0.8, 1.0, smoothstep(0.0, 0.6, vGUv.y));
      // z daleka mipmapa uśrednia cienkie źdźbła i maska spada pod próg: podbijamy ją z poziomem mipmapy
      float aLod = log2(max(max(fwidth(vAUv.x) * 2048.0, fwidth(vAUv.y) * 1024.0), 1.0));
      diffuseColor.a = bl.a * (1.0 + aLod * 0.45);
      diffuseColor.a = (diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;
    `).replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  };
  mat.customProgramCacheKey = () => 'grass-field-v7';
  mat.userData.season = 'grass';
  cloudShade(mat); // cienie chmur suną też po trawie
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
    setHeight(corner: number, y: number) { (hTex.image.data as Float32Array)[corner] = y; hTex.needsUpdate = true; },
    setDensity(tile: number, v: number) { if (base[tile] !== v) { base[tile] = v; write(tile); dirty = true; } },
    dispose() { hTex.dispose(); mTex.dispose(); geo.dispose(); card.dispose(); mat.dispose(); },
    setWear(tile: number, worn: number) { if (Math.abs(wear[tile]! - worn) > 0.02) { wear[tile] = worn; write(tile); dirty = true; } },
  };
}

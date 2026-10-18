import * as THREE from 'three';
import { cat } from './cat';
import { model } from './modelstore';
import { boxUv, modelGeo } from './peasants';
import { normal, pattern } from './textures';

/**
 * Strumienie i wodospady spływające z gór na skraju mapy.
 *
 * Źródło leży pod szczytem w paśmie gór przy brzegu planszy; woda szuka drogi w dół (najbardziej stromy spadek
 * z bezwładnością, więc nie zygzakuje) aż do stóp gór albo do jeziora czy rzeki na planszy. Tam, gdzie spadek jest
 * stromy, strumień zmienia się w wodospad: biała piana szybko płynie w dół, a u jego stóp unosi się pył wodny.
 * To tylko wygląd: strumień nie blokuje pól, a gdy ktoś postawi budynek na jego drodze, strumień znika.
 */

export interface StreamSampler {
  /** Wysokość terenu w polach (x, y), także poza planszą */
  height(x: number, y: number): number;
  /** Pole planszy to góry (poza planszą: true) */
  rock(x: number, y: number): boolean;
  /** Pole planszy to woda albo bród */
  water(x: number, y: number): boolean;
  w: number;
  h: number;
  /** Przesunięcie pól na świat */
  ox: number;
  oz: number;
  seed: number;
}

export interface Streams {
  group: THREE.Group;
  /** Dół każdego wodospadu (pył wodny), w świecie */
  sprays: THREE.Vector3[];
  animate(time: number): void;
  setSky(c: THREE.Color): void;
  /** Budynek na działce: strumienie, które przez nią płyną, znikają */
  blocked(x: number, y: number, w: number, h: number): void;
  dispose(): void;
}

interface Pt { x: number; y: number }

/** Droga wody od źródła w dół; null, gdy woda utknęła albo spadek jest za mały */
export function traceStream(S: StreamSampler, sx: number, sy: number): Pt[] | null {
  const pts: Pt[] = [{ x: sx, y: sy }];
  let x = sx, y = sy, dx = 0, dy = 0;
  const h0 = S.height(sx, sy);
  let lowSteps = 0, flatLeft = -1;
  for (let i = 0; i < 520; i++) {
    const e = 0.45;
    const gx = (S.height(x + e, y) - S.height(x - e, y)) / (2 * e);
    const gy = (S.height(x, y + e) - S.height(x, y - e)) / (2 * e);
    const gl = Math.hypot(gx, gy);
    if (gl > 1e-4) { dx = dx * 0.62 - (gx / gl) * 0.38; dy = dy * 0.62 - (gy / gl) * 0.38; }
    const dl = Math.hypot(dx, dy);
    if (dl < 1e-4) return null;
    dx /= dl; dy /= dl;
    const hPrev = S.height(x, y);
    x += dx * 0.3; y += dy * 0.3;
    const hNow = S.height(x, y);
    // pod górę przez kilka kroków = woda w niecce bez odpływu: koniec
    if (hNow > hPrev + 0.01) { if (++lowSteps > 6) return null; } else lowSteps = 0;
    pts.push({ x, y });
    const inBoard = x >= 0 && y >= 0 && x < S.w && y < S.h;
    if (inBoard && S.water(Math.floor(x), Math.floor(y))) return pts; // wpada do jeziora albo rzeki
    if (hNow < -0.05) return pts;
    if (inBoard && !S.rock(Math.floor(x), Math.floor(y))) {
      // u stóp gór: płynie dalej po łące najwyżej kilka pól i tylko wtedy, gdy trafi do wody; inaczej wsiąka u podnóża
      if (flatLeft < 0) flatLeft = pts.length;
      if (pts.length - flatLeft > 34) { pts.length = flatLeft + 2; break; }
    }
  }
  if (flatLeft >= 0 && pts.length > flatLeft + 2) pts.length = flatLeft + 2;
  if (pts.length < 14 || h0 - S.height(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y) < 3) return null;
  return pts;
}

/** Wygładzenie łamanej (Chaikin) i równe odstępy punktów */
function smooth(pts: Pt[], step: number): Pt[] {
  let p = pts;
  for (let k = 0; k < 2; k++) {
    const q: Pt[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!, b = p[i + 1]!;
      q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q.push(p[p.length - 1]!);
    p = q;
  }
  const out: Pt[] = [p[0]!];
  let carry = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!, b = p[i]!, L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1e-6) continue;
    let t = step - carry;
    for (; t <= L; t += step) out.push({ x: a.x + ((b.x - a.x) * t) / L, y: a.y + ((b.y - a.y) * t) / L });
    carry = L - (t - step);
  }
  out.push(p[p.length - 1]!);
  return out;
}

/** Źródła: wysokie pola gór przy brzegu planszy, odsunięte od siebie */
export function pickSources(S: StreamSampler, want: number): Pt[][] {
  let s = (S.seed ^ 0x7f4a7c15) >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // najpierw zbieramy wiele dróg, potem bierzemy te z największym spadkiem (długie, wysokie wodospady), odsunięte od siebie
  const cands: { path: Pt[]; drop: number; x: number; y: number }[] = [];
  for (let tries = 0; tries < 1400; tries++) {
    const x = Math.floor(rnd() * S.w), y = Math.floor(rnd() * S.h);
    if (!S.rock(x, y)) continue;
    const hh = S.height(x + 0.5, y + 0.5);
    if (hh < 5) continue;
    const path = traceStream(S, x + 0.5, y + 0.5);
    if (!path) continue;
    // musi zejść na planszę (do stóp gór albo do wody), żeby gracz go widział
    const end = path[path.length - 1]!;
    if (end.x < 0 || end.y < 0 || end.x >= S.w || end.y >= S.h) continue;
    cands.push({ path, drop: hh - S.height(end.x, end.y), x: end.x, y: end.y });
  }
  cands.sort((p, q) => q.drop - p.drop);
  const found: Pt[][] = [];
  const ends: Pt[] = [];
  for (const c of cands) {
    if (found.length >= want) break;
    if (ends.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 30)) continue;
    ends.push({ x: c.x, y: c.y });
    found.push(c.path);
  }
  return found;
}


/**
 * Wodospady nad wodą: tam, gdzie jezioro albo rzeka na planszy dochodzi do skalnej ściany, woda spada ze ściany
 * prosto do toni. Szukamy pól wody z sąsiadem w górach i wspinamy się od brzegu po zboczu aż na krawędź progu.
 */
export function cliffFalls(S: StreamSampler, want: number): Pt[][] {
  const cands: { path: Pt[]; gain: number; x: number; y: number }[] = [];
  for (let y = 1; y < S.h - 1; y++)
    for (let x = 1; x < S.w - 1; x++) {
      if (!S.water(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!S.rock(x + dx, y + dy) || S.water(x + dx, y + dy)) continue;
        // start na brzegu wody, krok w głąb skały i dalej pod górę najbardziej stromo (z bezwładnością)
        let px = x + 0.5 + dx * 0.45, py = y + 0.5 + dy * 0.45, vx = dx, vy = dy;
        const h0 = S.height(px, py);
        const up: Pt[] = [{ x: px - dx * 0.7, y: py - dy * 0.7 }, { x: px, y: py }];
        let flat = 0, top = h0;
        for (let i = 0; i < 90; i++) {
          const e = 0.3;
          const gx = (S.height(px + e, py) - S.height(px - e, py)) / (2 * e), gy = (S.height(px, py + e) - S.height(px, py - e)) / (2 * e);
          const gl = Math.hypot(gx, gy);
          if (gl > 1e-4) { vx = vx * 0.7 + (gx / gl) * 0.3; vy = vy * 0.7 + (gy / gl) * 0.3; }
          const vl = Math.hypot(vx, vy) || 1;
          vx /= vl; vy /= vl;
          const nx = px + vx * 0.15, ny = py + vy * 0.15, hn = S.height(nx, ny);
          // krawędź progu: zbocze łagodnieje (tam woda wypływa z góry), albo próg już dość wysoki
          if (hn - S.height(px, py) < 0.15 * 0.3) { if (++flat >= 3) break; } else flat = 0;
          px = nx; py = ny; up.push({ x: px, y: py }); top = Math.max(top, hn);
          if (top - h0 > 8.5) break;
        }
        const gain = top - h0;
        // prawdziwy próg: wspinaczka skończyła się na półce (zbocze złagodniało), a nie na zboczu szczytu
        if (gain < 2.5 || flat < 3) continue;
        // za progiem góra rośnie dalej (woda spływa z masywu), krawędź nie jest szczytem stożka
        let behind = top;
        for (let k = 1; k <= 9; k++) behind = Math.max(behind, S.height(px + vx * k, py + vy * k));
        if (behind < top + 1) continue;
        const climbLen = up.length;
        // kawałek spokojnego nurtu po półce nad krawędzią, żeby woda „skądś” płynęła — tylko dopóki półka jest płaska
        for (let k = 1; k <= 8; k++) {
          const qx = px + vx * 0.25 * k, qy = py + vy * 0.25 * k;
          if (S.height(qx, qy) > top + 0.6) break;
          up.push({ x: qx, y: qy });
        }
        const ext = up.length - climbLen;
        if (ext < 3) continue;
        const path: Pt[] & { lip?: number } = up.reverse();
        path.lip = ext; // indeks krawędzi progu w odwróconej drodze
        cands.push({ path, gain, x, y });
      }
    }
  cands.sort((a, b) => b.gain - a.gain);
  const out: Pt[][] = [];
  const at: Pt[] = [];
  for (const c of cands) {
    if (out.length >= want) break;
    if (at.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 24)) continue;
    at.push({ x: c.x, y: c.y });
    out.push(c.path);
  }
  return out;
}

const VERT = /* glsl */ `
attribute float aSlope;
attribute float aEdge;
attribute float aEnd;
varying vec2 vUv;
varying float vSlope;
varying float vEdge;
varying float vEnd;
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vSlope = aSlope; vEdge = aEdge; vEnd = aEnd;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D noise;
uniform float time;
uniform vec3 sky;
varying vec2 vUv;
varying float vSlope;
varying float vEdge;
varying float vEnd;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  float fall = smoothstep(0.45, 1.0, vSlope);
  // woda płynie wzdłuż v; na wodospadzie kilka razy szybciej
  float speed = 0.55 + fall * 2.6 + vSlope * 0.4;
  float n1 = texture2D(noise, vec2(vUv.x * 0.7, vUv.y * 0.55 - time * speed)).r;
  float n2 = texture2D(noise, vec2(vUv.x * 1.6 + 0.3, vUv.y * 1.3 - time * speed * 1.4)).g;
  float n = n1 * 0.6 + n2 * 0.5;
  vec3 deep = vec3(0.03, 0.065, 0.075), shallow = vec3(0.1, 0.13, 0.11);
  vec3 c = mix(deep, shallow, smoothstep(0.55, 0.0, abs(vEdge)));
  // odbicie nieba na spokojnej wodzie, zmarszczki jaśniejsze
  c = mix(c, sky * 0.55, 0.28 + n * 0.18);
  // piana: na wodospadzie prawie biało, w nurcie tylko jaśniejsze grzywki
  // piana w smugach wzdłuż spadku (nie jednolita biała farba): między smugami prześwituje ciemna, mokra woda
  float streak = texture2D(noise, vec2(vUv.x * 2.6 + 0.17, vUv.y * 0.22 - time * speed * 0.8)).r;
  float foam = fall * smoothstep(0.3, 0.72, streak * 0.75 + n * 0.45) + smoothstep(0.66, 0.92, n) * 0.3 * (0.3 + vSlope);
  foam = clamp(foam, 0.0, 0.92);
  vec3 foamC = mix(vec3(0.72, 0.77, 0.78), vec3(0.95, 0.97, 0.97), n2) * (0.5 + sky.g * 0.7);
  c = mix(c, foamC, foam);
  float a = smoothstep(1.0, 0.5, abs(vEdge) + (n - 0.5) * 0.3);
  a *= mix(0.62, 0.92, foam) * vEnd;
  if (vSlope > 4.0) {
    // kurtyna wodospadu: pionowe, szybko spadające pasma wody, między nimi prześwit; brzegi postrzępione,
    // kolor chłodny i przygaszony w cieniu skały, biały tylko na grzbietach pasm
    float s1 = texture2D(noise, vec2(vUv.x * 3.1, vUv.y * 0.16 - time * 1.5)).r;
    float s2 = texture2D(noise, vec2(vUv.x * 8.3 + 0.4, vUv.y * 0.42 - time * 2.3)).g;
    float st = s1 * 0.62 + s2 * 0.48;
    vec3 base = vec3(0.42, 0.5, 0.53) * (0.55 + sky.g * 0.6);
    vec3 hiC = vec3(0.93, 0.96, 0.97) * (0.55 + sky.g * 0.6);
    c = mix(base, hiC, smoothstep(0.38, 0.82, st));
    a = smoothstep(1.0, 0.5, abs(vEdge) + (st - 0.5) * 0.6) * (0.52 + 0.46 * smoothstep(0.28, 0.75, st)) * vEnd;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
  #include <fog_fragment>
}`;

const FOAM_VERT = /* glsl */ `
varying vec3 vWP;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FOAM_FRAG = /* glsl */ `
uniform sampler2D noise;
uniform float time;
uniform vec3 sky;
varying vec3 vWP;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float ang = atan(c.y, c.x);
  // piana rozchodzi się od miejsca uderzenia: kręgi płyną na zewnątrz, szum je szarpie
  float n = texture2D(noise, vec2(ang * 0.32 + time * 0.01, r * 0.9 - time * 0.22)).r;
  float n2 = texture2D(noise, vWP.xz / 3.0 + vec2(time * 0.05, -time * 0.04)).g;
  float rings = 0.5 + 0.5 * sin(r * 14.0 - time * 3.0 + n * 6.0);
  float a = smoothstep(1.0, 0.25, r) * (0.45 + 0.55 * smoothstep(0.35, 0.7, n * 0.6 + n2 * 0.5)) * (0.6 + rings * 0.4);
  a = max(a, smoothstep(0.35, 0.0, r) * 0.9);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.9, 0.93, 0.93) * (0.6 + sky.g * 0.7), a * 0.85);
  #include <fog_fragment>
}`;

type WMesh = Parameters<typeof modelGeo>[0];
let rockMat: THREE.MeshStandardMaterial | null = null;
/** Materiał mokrej skały wodospadu (tekstura skały z gry, barwa i mech z kolorów wierzchołków) */
function fallRockMaterial(): THREE.MeshStandardMaterial {
  rockMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, map: pattern('rock'), normalMap: normal('rock'), roughness: 0.88, metalness: 0 });
  return rockMat;
}

/** Materiał wody (ten sam shader co nurt i kurtyna) — do wodospadu w podglądzie modeli */
export function streamWaterMaterial(noise: THREE.Texture): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: noise }, time: { value: 0 }, sky: { value: new THREE.Color(0x9aa8b2) } }]),
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  m.uniforms.noise!.value = noise;
  return m;
}

type FallRocks = { lip: WMesh; pool: WMesh };
/** Kamienie wodospadu z Blendera (tools/models/waterfall.py): 'lip' na krawędzi progu, 'pool' wokół misy */
function fallRock(part: keyof FallRocks, scale: number): THREE.Mesh {
  const geo = modelGeo(model<FallRocks>('waterfall')[part]).toNonIndexed();
  geo.scale(scale, scale, scale); // tylko równo: nierówne skalowanie robiło z głazów rozciągnięte kluski
  geo.computeVertexNormals(); // łupana skała: płaskie ściany
  boxUv(geo, 0.42);
  const m = new THREE.Mesh(geo, fallRockMaterial());
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Kurtyna wodospadu wzdłuż prawdziwej ściany: od krawędzi L w stronę (dx, dy) woda spada łukiem, ale nigdy nie wchodzi
 * w skałę — na każdej wysokości trzyma się co najmniej `gap` przed zboczem z mapy wysokości. Zwraca dwie warstwy
 * (przednia szersza, tylna węższa) w polach mapy, y = wysokość; `hit` = odległość od L, gdzie woda trafia w taflę.
 */
export function curtainRows(H: (x: number, y: number) => number, L: Pt, dx: number, dy: number, ly: number, by: number): { rows: { x: number; y: number; h: number; t: number }[]; hit: number } {
  const N = 32, gap = 0.22;
  const rows: { x: number; y: number; h: number; t: number }[] = [];
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const h = ly + (by - ly) * t;
    // łuk: woda wypływa z prędkością nurtu i spada swobodnie (odległość rośnie z pierwiastkiem spadku)
    const arcS = 0.42 * Math.sqrt(Math.max(0, ly - h));
    // zbocze: pierwsza odległość, gdzie teren jest już niżej niż woda
    let face = 0;
    while (face < 12 && H(L.x + dx * face, L.y + dy * face) > h - 0.05) face += 0.05;
    s = Math.max(s, arcS, i === 0 ? 0 : face + gap);
    rows.push({ x: L.x + dx * s, y: L.y + dy * s, h, t });
  }
  return { rows, hit: s };
}

/** Siatka kurtyny z rzędów (dwie warstwy dają grubość) */
function curtainMeshes(rows: { x: number; y: number; h: number; t: number }[], dx: number, dy: number, ox: number, oz: number, mat: THREE.Material): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const drop = rows[0]!.h - rows[rows.length - 1]!.h;
  for (const [wMul, push, phase] of [[1, 0.05, 0], [0.72, -0.07, 0.37]] as const) {
    const P: number[] = [], UV: number[] = [], SL: number[] = [], ED: number[] = [], EN: number[] = [], I: number[] = [];
    rows.forEach((r, i) => {
      const half = (0.34 + r.t * 0.55) * wMul;
      for (const side of [-1, 1]) {
        P.push(r.x + dx * push - dy * half * side + ox, r.h, r.y + dy * push + dx * half * side + oz);
        UV.push(side * 0.5 + 0.5, r.t * drop * 0.35 + phase);
        SL.push(5); ED.push(side); // 5 = kurtyna (osobny wygląd w shaderze)
        EN.push(Math.min(1, (rows.length - 1 - i) / 2 + 0.3));
      }
      if (i < rows.length - 1) { const q = i * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('aSlope', new THREE.Float32BufferAttribute(SL, 1));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(ED, 1));
    g.setAttribute('aEnd', new THREE.Float32BufferAttribute(EN, 1));
    g.setIndex(I);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2;
    out.push(m);
  }
  return out;
}

/**
 * Wodospad do podglądu modeli: kamienna ściana 5 pól nad taflą, kamienie z Blendera i ta sama kurtyna co w grze.
 * (0, 0, 0) = tafla pod ścianą, woda spada w stronę +z.
 */
export function waterfallModel(_sy: number, _sxz: number, waterMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const top = 5;
  const H = (_x: number, y: number): number => (y < 0 ? top : -0.3);
  const wall = new THREE.BoxGeometry(6, top + 0.3, 4).translate(0, (top - 0.3) / 2, -2).toNonIndexed();
  boxUv(wall, 0.42);
  const cols = new Float32Array((wall.attributes.position as THREE.BufferAttribute).count * 3).fill(0.55);
  wall.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.add(new THREE.Mesh(wall, fallRockMaterial()));
  const L = { x: 0, y: -0.02 };
  const { rows, hit } = curtainRows(H, L, 0, 1, top + 0.08, -0.07);
  for (const m of curtainMeshes(rows, 0, 1, 0, 0, waterMat)) g.add(m);
  const lip = fallRock('lip', 1); lip.position.set(0, top, -0.05); g.add(lip);
  const pool = fallRock('pool', 1); pool.position.set(0, -0.1, hit); g.add(pool);
  return g;
}

export function buildStreams(S: StreamSampler, noise: THREE.Texture, want = 6): Streams {
  const group = new THREE.Group();
  // najpierw wodospady wpadające do jezior i rzek pod skałą, potem zwykłe strumienie z gór
  const falls = cliffFalls(S, 5);
  // same wodospady: zwykłe strumienie po zboczach wyglądały jak białe pasy farby kończące się w pół drogi (17.10)
  void want;
  const paths = [...falls];
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: noise }, time: { value: 0 }, sky: { value: new THREE.Color(0x8a9aa6) } }]),
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
    // obie strony: wstęga na stromym zboczu i kurtyna wodospadu bywają widziane od spodu (z góry były niewidoczne)
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  mat.uniforms.noise!.value = noise;
  const meshes: { mesh: THREE.Mesh; tiles: Set<number> }[] = [];
  const sprays: THREE.Vector3[] = [];
  const H = (x: number, y: number): number => S.height(x, y);
  const foamMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: noise }, time: { value: 0 }, sky: { value: new THREE.Color(0x8a9aa6) } }]),
    vertexShader: FOAM_VERT, fragmentShader: FOAM_FRAG, transparent: true, depthWrite: false, fog: true,
  });
  foamMat.uniforms.noise!.value = noise;
  const extra: THREE.BufferGeometry[] = [];
  /**
   * Wodospad: nurt po półce aż do krawędzi progu L, z niej kurtyna wzdłuż prawdziwej ściany skalnej do toni w stronę B,
   * omszone głazy przy wylocie, mokre głazy wokół misy, u dołu piana i pył wodny.
   */
  const placeFall = (full: Pt[], lipI: number, tiles: Set<number>): void => {
    const L = full[lipI]!, B = full[full.length - 1]!;
    let dx = B.x - L.x, dy = B.y - L.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const ly = H(L.x, L.y) + 0.1, by = -0.07;
    const { rows, hit } = curtainRows(H, L, dx, dy, ly, by);
    for (const m of curtainMeshes(rows, dx, dy, S.ox, S.oz, mat)) { group.add(cat(m, 'strumienie i wodospady')); meshes.push({ mesh: m, tiles }); }
    for (const r of rows) tiles.add(Math.floor(r.y) * S.w + Math.floor(r.x));
    const rot = Math.atan2(dx, dy);
    const sc = Math.max(0.85, Math.min(1.25, (ly - by) / 6));
    const lip = fallRock('lip', sc);
    lip.position.set(L.x + S.ox, H(L.x, L.y) - 0.04, L.y + S.oz);
    lip.rotation.y = rot;
    group.add(cat(lip, 'strumienie i wodospady'));
    meshes.push({ mesh: lip, tiles });
    const hx = L.x + dx * hit, hz = L.y + dy * hit;
    const pool = fallRock('pool', sc);
    pool.position.set(hx + S.ox, by - 0.05, hz + S.oz);
    pool.rotation.y = rot;
    group.add(cat(pool, 'strumienie i wodospady'));
    meshes.push({ mesh: pool, tiles });
    const fg = new THREE.CircleGeometry(1.3 + Math.min(1.2, (ly - by) * 0.09), 28).rotateX(-Math.PI / 2).translate(hx + S.ox, -0.06, hz + S.oz);
    extra.push(fg);
    const fm = new THREE.Mesh(fg, foamMat);
    fm.renderOrder = 2;
    group.add(cat(fm, 'strumienie i wodospady'));
    meshes.push({ mesh: fm, tiles });
    sprays.push(new THREE.Vector3(hx + S.ox, 0.15, hz + S.oz));
    for (let a = -2; a <= 2; a += 0.5) for (let c = -2; c <= 2; c += 0.5) tiles.add(Math.floor(hz + dy * a + dx * c) * S.w + Math.floor(hx + dx * a - dy * c));
  };
  paths.forEach((full, pi) => {
    const isFall = pi < falls.length;
    // przy wodospadzie wstęgą rysujemy tylko nurt nad krawędzią (punkty do krawędzi), resztę robi kurtyna
    const lip = (full as Pt[] & { lip?: number }).lip ?? 8;
    const raw = isFall ? full.slice(0, lip + 1) : full;
    const pts = smooth(raw, 0.16);
    const n = pts.length;
    const P: number[] = [], UV: number[] = [], SL: number[] = [], ED: number[] = [], EN: number[] = [], I: number[] = [];
    const tiles = new Set<number>();
    let along = 0, fallLen = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i]!, a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
      let tx = b.x - a.x, ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const horiz = Math.hypot(b.x - a.x, b.y - a.y) || 1e-3;
      const slope = Math.abs(H(a.x, a.y) - H(b.x, b.y)) / horiz;
      const k = i / (n - 1);
      // strumień rośnie z biegiem; nurt nad wodospadem mieści się między głazami wylotu
      const width = isFall ? 0.26 + k * 0.08 : 0.32 + k * 0.38 + Math.min(slope, 3) * 0.14;
      const hc = H(p.x, p.y);
      // normalna terenu: woda leży tuż nad zboczem także na stromej ścianie (pionowe podniesienie by ją tam schowało)
      const e = 0.35;
      const gx = (H(p.x + e, p.y) - H(p.x - e, p.y)) / (2 * e), gy = (H(p.x, p.y + e) - H(p.x, p.y - e)) / (2 * e);
      const nl = Math.hypot(gx, 1, gy);
      const nX = -gx / nl, nY = 1 / nl, nZ = -gy / nl;
      for (const side of [-1, 1]) {
        const ex = p.x - ty * width * side, ey = p.y + tx * width * side;
        // brzeg w korycie: nie wyżej niż środek (inaczej woda wisi nad grzbietem), nie niżej niż zbocze pod nim
        const he = Math.min(H(ex, ey), hc + 0.08);
        const lift = 0.1 + Math.min(slope, 3) * 0.05;
        P.push(ex + S.ox + nX * lift, he + nY * lift, ey + S.oz + nZ * lift);
        UV.push(side * 0.5 + 0.5, along);
        SL.push(isFall ? Math.min(slope, 0.4) : slope); ED.push(side);
        // ujście: na końcu (u stóp gór) strumień wsiąka, w jeziorze wtapia się w taflę; nad wodospadem wypływa spod półki
        EN.push(isFall ? Math.min(1, i / 4) : Math.min(1, (n - 1 - i) / 4) * Math.min(1, i / 3));
      }
      tiles.add(Math.floor(p.y) * S.w + Math.floor(p.x));
      if (i > 0) along += Math.hypot(p.x - a.x, p.y - a.y) * 0.5;
      if (isFall) continue;
      // koniec stromego odcinka = dół wodospadu: tam pył wodny
      // (tylko pod prawdziwym wodospadem: kilka stromych kroków z rzędu, nie pod jednym progiem)
      if (slope > 1.1) fallLen++;
      else if (slope < 0.6) { if (fallLen >= 3) sprays.push(new THREE.Vector3(p.x + S.ox, hc + 0.3, p.y + S.oz)); fallLen = 0; }
      if (i === n - 1 && fallLen >= 3) sprays.push(new THREE.Vector3(p.x + S.ox, Math.max(hc, -0.1) + 0.3, p.y + S.oz));
    }
    for (let i = 0; i < n - 1; i++) { const q = i * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('aSlope', new THREE.Float32BufferAttribute(SL, 1));
    geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(ED, 1));
    geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(EN, 1));
    geo.setIndex(I);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    group.add(cat(mesh, 'strumienie i wodospady'));
    meshes.push({ mesh, tiles });
    if (isFall) placeFall(full, lip, tiles);
  });
  return {
    group,
    sprays,
    animate(time: number) { mat.uniforms.time!.value = time; foamMat.uniforms.time!.value = time; },
    setSky(c: THREE.Color) { (mat.uniforms.sky!.value as THREE.Color).copy(c); (foamMat.uniforms.sky!.value as THREE.Color).copy(c); },
    blocked(x: number, y: number, w: number, h: number) {
      for (const m of meshes) {
        if (!m.mesh.visible) continue;
        for (let ty = y - 1; ty <= y + h && m.mesh.visible; ty++)
          for (let tx = x - 1; tx <= x + w; tx++) if (m.tiles.has(ty * S.w + tx)) { m.mesh.visible = false; break; }
      }
    },
    dispose() { for (const m of meshes) m.mesh.geometry?.dispose(); for (const g of extra) g.dispose(); mat.dispose(); foamMat.dispose(); },
  };
}

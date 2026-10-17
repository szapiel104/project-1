import * as THREE from 'three';
import { cat } from './cat';

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
  float foam = clamp(fall * (0.55 + n * 0.7) + smoothstep(0.62, 0.9, n) * 0.35 * (0.3 + vSlope), 0.0, 1.0);
  vec3 foamC = mix(vec3(0.82, 0.86, 0.86), vec3(1.0), n2) * (0.45 + sky.g * 0.7);
  c = mix(c, foamC, foam);
  float a = smoothstep(1.0, 0.55 - fall * 0.2, abs(vEdge) + (n - 0.5) * 0.25);
  a *= mix(0.82, 0.96, foam) * vEnd;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
  #include <fog_fragment>
}`;

export function buildStreams(S: StreamSampler, noise: THREE.Texture, want = 6): Streams {
  const group = new THREE.Group();
  const paths = pickSources(S, want);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: noise }, time: { value: 0 }, sky: { value: new THREE.Color(0x8a9aa6) } }]),
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  mat.uniforms.noise!.value = noise;
  const meshes: { mesh: THREE.Mesh; tiles: Set<number> }[] = [];
  const sprays: THREE.Vector3[] = [];
  const H = (x: number, y: number): number => S.height(x, y);
  for (const raw of paths) {
    const pts = smooth(raw, 0.22);
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
      // strumień rośnie z biegiem; wodospad węższy i zwarty
      const width = 0.32 + k * 0.38 + Math.min(slope, 2.5) * 0.08;
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
        SL.push(slope); ED.push(side);
        // ujście: na końcu (u stóp gór) strumień wsiąka, w jeziorze wtapia się w taflę
        EN.push(Math.min(1, (n - 1 - i) / 10) * Math.min(1, i / 3));
      }
      tiles.add(Math.floor(p.y) * S.w + Math.floor(p.x));
      if (i > 0) along += Math.hypot(p.x - a.x, p.y - a.y) * 0.5;
      // koniec stromego odcinka = dół wodospadu: tam pył wodny
      // (tylko pod prawdziwym wodospadem: kilka stromych kroków z rzędu, nie pod jednym progiem)
      if (slope > 1.1) fallLen++;
      else if (slope < 0.6) { if (fallLen >= 4) sprays.push(new THREE.Vector3(p.x + S.ox, hc + 0.3, p.y + S.oz)); fallLen = 0; }
      if (i < n - 1) { const q = i * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
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
  }
  return {
    group,
    sprays,
    animate(time: number) { mat.uniforms.time!.value = time; },
    setSky(c: THREE.Color) { (mat.uniforms.sky!.value as THREE.Color).copy(c); },
    blocked(x: number, y: number, w: number, h: number) {
      for (const m of meshes) {
        if (!m.mesh.visible) continue;
        for (let ty = y - 1; ty <= y + h && m.mesh.visible; ty++)
          for (let tx = x - 1; tx <= x + w; tx++) if (m.tiles.has(ty * S.w + tx)) { m.mesh.visible = false; break; }
      }
    },
    dispose() { for (const m of meshes) m.mesh.geometry.dispose(); mat.dispose(); },
  };
}

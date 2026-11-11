import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { Terrain } from '../data/terrain';
import { model, bytes } from './modelstore';
import { cat } from './cat';
import { play3d } from '../audio/engine';

/**
 * Dzikie zwierzęta (Michał 11.11.2026: „wielbłądy na pustyni, jelenie i sarny na zielonych terenach, uciekają od ludzi;
 * w przyszłości mięso dla myśliwego”). Modele z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0), przeniesione bez odchudzania
 * skryptem tools/models/fauna_0ad.py: dziesięć klatek chodu, osiem klatek ruchu spoczynkowego (łeb, uszy, ogon)
 * i skubanie trawy.
 *
 * Animacja płynna (Michał: „animacja musi być płynna”): co klatkę obrazu mieszamy dwie sąsiednie klatki animacji według
 * ułamka kroku (procesor, kilkanaście zwierząt po ok. 1–2 tys. wierzchołków) — nogi idą miękko, łeb i ogon ruszają się
 * na postoju. Każde widoczne zwierzę to jedno wywołanie rysowania; poza kadrem odrzuca je kamera. (Morph targets
 * i pozy z tekstury w puli instancji na WebGPU nie działały — nogi stały albo zwierzęta znikały.)
 *
 * Na razie tylko wygląd (symulacja o nich nie wie, gra przez sieć zostaje zgodna): stada pasą się wokół swojego miejsca,
 * chodzą od kępy do kępy, porykują, a gdy podejdzie człowiek (chłop, żołnierz), uciekają biegiem. Myśliwy i mięso —
 * osobna partia (docs/pomysly.md), wtedy zwierzęta przejdą do symulacji.
 */
type Packed = { pos: string; nrm: string; uv: string; idx: string; morph: Record<string, { pos: string; nrm: string }> };
type FaunaModel = { height: number; length: number; normalMap?: boolean; body: Packed };
export type Species = 'camel' | 'deer' | 'pig' | 'hen' | 'dog' | 'boar' | 'fox' | 'rabbit';
/** Prędkość chodu w polach na sekundę (podgląd modeli) */
const WALK_SPEED: Record<Species, number> = { camel: 0.55, deer: 0.7, pig: 0.3, hen: 0.35, dog: 0.8, boar: 0.45, fox: 0.6, rabbit: 0.35 };
/** bieg przy ucieczce (pola na sekundę) */
const FLEE_SPEED: Partial<Record<Species, number>> = { camel: 2.6, deer: 3.4, boar: 2.8, fox: 3.6, rabbit: 4 };
const WALK = 10, IDLE = 8;
/** Ile długości ciała na pełny cykl chodu: zając kica daleko (Michał 11.11.2026: „królik skacze jak powalony” — przy
 *  1,1 długości robił ok. 4 skoki na sekundę), reszta stawia kroki mniej więcej na swoją długość */
const STRIDE: Partial<Record<Species, number>> = { rabbit: 3.6, fox: 1.3 };
const strideOf = (sp: Species): number => STRIDE[sp] ?? 1.1;
const MORPHS = [...Array.from({ length: WALK }, (_, k) => `walk${k}`), ...Array.from({ length: IDLE }, (_, k) => `idle${k}`), 'graze'];
/** wiersze tekstury klatek: 0..9 chód, 10..17 spoczynek, 18 skubanie */
const IDLE0 = WALK, GRAZE = WALK + IDLE, FRAMES = WALK + IDLE + 1;

const b64 = (s: string | Uint8Array): ArrayBuffer => bytes(s).buffer as ArrayBuffer;
const geos = new Map<Species, THREE.BufferGeometry>();

/** Siatka zwierzęcia z pozami (wspólna — nie zmieniać w miejscu) */
export function faunaGeometry(sp: Species): THREE.BufferGeometry {
  let g = geos.get(sp);
  if (g) return g;
  const m = model<FaunaModel>(`fauna_${sp}`).body;
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b64(m.pos)), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(b64(m.nrm)), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b64(m.uv)), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64(m.idx)), 1));
  g.morphTargetsRelative = true;
  g.morphAttributes.position = MORPHS.map((k) => new THREE.BufferAttribute(new Float32Array(b64(m.morph[k]!.pos)), 3));
  g.morphAttributes.normal = MORPHS.map((k) => {
    const raw = new Int8Array(b64(m.morph[k]!.nrm)), f = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) f[i] = raw[i]! / 127;
    return new THREE.BufferAttribute(f, 3);
  });
  g.boundingBox = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  g.boundingSphere.radius *= 1.25;
  geos.set(sp, g);
  return g;
}

const frameSets = new Map<Species, { P: Float32Array[]; N: Float32Array[] }>();
/** Wszystkie klatki jako gotowe tablice położeń i normalnych (stojąca + różnica klatki) */
function frames(sp: Species): { P: Float32Array[]; N: Float32Array[] } {
  let f = frameSets.get(sp);
  if (f) return f;
  const src = faunaGeometry(sp), P0 = src.getAttribute('position') as THREE.BufferAttribute, N0 = src.getAttribute('normal') as THREE.BufferAttribute;
  const V = P0.count;
  f = { P: [], N: [] };
  for (let k = 0; k < FRAMES; k++) {
    const dP = src.morphAttributes.position![k]!.array as Float32Array, dN = src.morphAttributes.normal![k]!.array as Float32Array;
    const P = new Float32Array(V * 3), N = new Float32Array(V * 3);
    for (let i = 0; i < V; i++) {
      P[i * 3] = P0.getX(i) + dP[i * 3]!; P[i * 3 + 1] = P0.getY(i) + dP[i * 3 + 1]!; P[i * 3 + 2] = P0.getZ(i) + dP[i * 3 + 2]!;
      const x = N0.getX(i) + dN[i * 3]!, y = N0.getY(i) + dN[i * 3 + 1]!, z = N0.getZ(i) + dN[i * 3 + 2]!, l = Math.hypot(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
    f.P.push(P); f.N.push(N);
  }
  frameSets.set(sp, f);
  return f;
}

const mats = new Map<Species, THREE.MeshStandardMaterial>();
const texBase = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
/** Sierść z paczki (mała tekstura: zwykły JPG, bez KTX2 — jak koń) */
export function faunaMaterial(sp: Species): THREE.MeshStandardMaterial {
  let m = mats.get(sp);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  if (typeof document !== 'undefined') {
    const map = new THREE.TextureLoader().load(`${texBase()}fauna_${sp}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    m.map = map;
    // zwierzęta z glTF (fauna_gltf.py): mapa normalnych z paczki — sierść, fałdy skóry i mięśnie z bliska
    if (model<FaunaModel>(`fauna_${sp}`).normalMap) {
      const nm = new THREE.TextureLoader().load(`${texBase()}fauna_${sp}_n.jpg`);
      nm.anisotropy = 8;
      m.normalMap = nm;
      m.roughness = 0.88;
    }
  }
  mats.set(sp, m);
  return m;
}

/** Siatka zwierzęcia z własnymi położeniami i normalnymi (do mieszania klatek), wspólne UV, trójkąty i materiał */
function ownBody(sp: Species): THREE.Mesh {
  const src = faunaGeometry(sp), V = src.getAttribute('position').count;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', src.getAttribute('uv'));
  geo.setIndex(src.getIndex());
  geo.boundingSphere = src.boundingSphere!.clone();
  geo.boundingBox = src.boundingBox!.clone();
  const m = new THREE.Mesh(geo, faunaMaterial(sp));
  m.castShadow = true; m.receiveShadow = true;
  blendFrames(m, sp, [[IDLE0, 1]]);
  return m;
}
/** Wpisuje do siatki mieszankę klatek: lista [klatka, waga] (wagi sumują się do 1) */
type Mix = [number, number][];
function blendFrames(mesh: THREE.Mesh, sp: Species, mix: Mix): void {
  const fr = frames(sp);
  const pa = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, na = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const P = pa.array as Float32Array, N = na.array as Float32Array;
  const use = mix.filter(([, w]) => w > 0.001);
  const [f0, w0] = use[0] ?? [IDLE0, 1];
  { const PA = fr.P[f0]!, NA = fr.N[f0]!; for (let i = 0; i < P.length; i++) { P[i] = PA[i]! * w0; N[i] = NA[i]! * w0; } }
  for (let k = 1; k < use.length; k++) {
    const [f, w] = use[k]!, PA = fr.P[f]!, NA = fr.N[f]!;
    for (let i = 0; i < P.length; i++) { P[i] = P[i]! + PA[i]! * w; N[i] = N[i]! + NA[i]! * w; }
  }
  pa.needsUpdate = true; na.needsUpdate = true;
}
/**
 * Mieszanka klatek dla stanu (Michał 11.11.2026: „wielbłąd z łbem w dół nagle przeskakuje do góry”): wszystko przechodzi
 * płynnie — ruch spoczynkowy ↔ skubanie (waga `graze`), postój ↔ chód (waga `walk` 0–1, rośnie z prędkością). Ruch
 * spoczynkowy gra tam i z powrotem (0→7→0), bo animacje z paczek nie zawsze zamykają się w pętlę.
 */
function poseFor(walk: number, phase: number, t: number, seed: number, graze: number): Mix {
  const g = Math.max(0, Math.min(1, graze)), wk = Math.max(0, Math.min(1, walk));
  const span = IDLE - 1, cyc = (t * 0.9 + seed * IDLE * 2) % (span * 2), ip = cyc < span ? cyc : span * 2 - cyc;
  const i0 = Math.min(span - 1, Math.floor(ip)), iw = ip - i0;
  const st = 1 - wk;
  const out: Mix = [[IDLE0 + i0, st * (1 - g) * (1 - iw)], [IDLE0 + i0 + 1, st * (1 - g) * iw], [GRAZE, st * g]];
  if (wk > 0) { const a = Math.floor(phase) % WALK, fw = phase - Math.floor(phase); out.push([a, wk * (1 - fw)], [(a + 1) % WALK, wk * fw]); }
  return out;
}

/**
 * Zwierzę do podglądu modeli, które się rusza (Michał 11.11.2026: „scena do testowania jak w silnikach — wielbłąd chodzi
 * po pustej podstawce, wczytuje się w 2 sekundy”): `walk` — chodzi w kółko po podstawce, `idle` — stoi i rusza łbem
 * i ogonem, co kilka sekund schyla się do trawy. Podgląd woła `userData.tick(dt, time)` co klatkę.
 */
export function faunaAnimated(sp: Species, mode: 'walk' | 'idle'): THREE.Group {
  const g = new THREE.Group(), body = ownBody(sp);
  g.add(body);
  const len = model<FaunaModel>(`fauna_${sp}`).length, R = len * 1.4, speed = WALK_SPEED[sp];
  let phase = 0, ang = 0, graze = 0;
  g.userData.tick = (dt: number, t: number): void => {
    if (mode === 'walk') {
      ang += (speed * dt) / R;
      phase = (phase + (speed * dt) / (len * strideOf(sp)) * WALK) % WALK;
      body.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      body.rotation.y = -ang;             // łeb w kierunku marszu (styczna do koła)
      blendFrames(body, sp, poseFor(1, phase, t, 0.3, 0));
    } else {
      graze += ((Math.sin(t * 0.35) > 0.4 ? 1 : 0) - graze) * Math.min(1, dt * 1.2);
      blendFrames(body, sp, poseFor(0, 0, t, 0.3, graze));
    }
  };
  return g;
}

/**
 * Pula zwierząt jednego gatunku dla kodu, który sam prowadzi zwierzęta (village.ts: kury, świnie, pies): co klatkę
 * `put(macierz, idzie, faza kroku, druga poza 0–1, ziarno)` dla każdego widocznego, na koniec `end()`.
 * Druga poza: świnia ryje, kura dziobie, pies siedzi. Każde zwierzę to osobna siatka z mieszanymi klatkami.
 */
export class FaunaPool {
  private list: THREE.Mesh[] = [];
  private n = 0;
  private walkMix = new Map<number, number>();
  private seen = new Map<number, number>();
  constructor(private sp: Species, private parent: THREE.Object3D) {}
  put(matrix: THREE.Matrix4, walking: boolean, phase: number, alt: number, seed: number, time: number): void {
    let m = this.list[this.n];
    if (!m) { m = ownBody(this.sp); m.matrixAutoUpdate = false; this.parent.add(m); this.list.push(m); }
    // chód ↔ postój płynnie: waga chodu dąży do 1 albo 0 w ok. 0,2 s (osobno dla każdego zwierzęcia, po ziarnie)
    const prev = this.walkMix.get(seed) ?? (walking ? 1 : 0), dt = Math.min(0.1, Math.max(0, time - (this.seen.get(seed) ?? time)));
    const wm = prev + ((walking ? 1 : 0) - prev) * Math.min(1, dt * 7);
    this.walkMix.set(seed, wm); this.seen.set(seed, time);
    blendFrames(m, this.sp, poseFor(wm, phase % WALK, time, seed, alt));
    m.matrix.copy(matrix); m.matrixWorldNeedsUpdate = true; m.visible = true;
    this.n++;
  }
  end(): void { for (let i = this.n; i < this.list.length; i++) this.list[i]!.visible = false; this.n = 0; }
  /** Długość ciała w polach (krok: pełny cykl chodu na ok. 1,1 długości) */
  get length(): number { return model<FaunaModel>(`fauna_${this.sp}`).length; }
  static readonly STEPS = WALK;
}

/** Pojedyncze zwierzę (podgląd modeli) */
export function faunaObject(sp: Species): THREE.Mesh {
  const mesh = new THREE.Mesh(faunaGeometry(sp), faunaMaterial(sp));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

interface Beast {
  sp: Species; x: number; y: number; hx: number; hy: number; heading: number;
  /** 0 pasie się, 1 idzie, 2 ucieka */
  state: number; until: number; tx: number; ty: number; speed: number; phase: number; graze: number; scale: number; seed: number;
}

/** Ile stad i jakich (kraina mapy) */
const HERDS: Record<string, [Species, number, number, number][]> = {
  // [gatunek, liczba stad, najmniej w stadzie, najwięcej]
  // dziki chodzą watahami, lisy pojedynczo, zające po dwa-trzy (przyszła zwierzyna dla myśliwego)
  desert: [['camel', 7, 2, 4], ['fox', 2, 1, 1]],
  meadow: [['deer', 9, 3, 6], ['boar', 5, 2, 4], ['fox', 4, 1, 1], ['rabbit', 7, 1, 3]],
  highland: [['deer', 8, 2, 5], ['boar', 5, 2, 4], ['fox', 3, 1, 1], ['rabbit', 4, 1, 2]],
  steppe: [['deer', 5, 2, 4], ['fox', 4, 1, 1], ['rabbit', 8, 1, 3]],
  north: [['deer', 4, 2, 3], ['fox', 3, 1, 1], ['rabbit', 3, 1, 2]],
};
const FLEE = 6.5;       // człowiek bliżej niż tyle pól — zwierzę ucieka
const MAX = 110;

export class Wildlife {
  private beasts: Beast[] = [];
  /** zwierzę → jego siatka (jedno wywołanie rysowania na widoczne zwierzę, poza kadrem odrzuca je kamera) */
  private bodies = new Map<Beast, THREE.Mesh>();
  private group = new THREE.Group();
  /** kiedy zwierzę ostatnio się odezwało */
  private voiceAt = new Map<Beast, number>();
  private key = '';
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) { scene.add(cat(this.group, 'dzikie zwierzęta')); }

  /** Siatka zwierzęcia w scenie (własne położenia i normalne, mieszane co klatkę) */
  private body(b: Beast): THREE.Mesh {
    let m = this.bodies.get(b);
    if (m) return m;
    m = ownBody(b.sp);
    m.matrixAutoUpdate = false;
    this.group.add(m);
    this.bodies.set(b, m);
    return m;
  }

  /** do sprawdzania z konsoli (window.__fauna()): gatunek, miejsce na mapie, stan (0 pasie się, 1 idzie, 2 ucieka), czy widoczne */
  list(): { sp: Species; x: number; y: number; state: number; shown: boolean }[] {
    return this.beasts.map((b) => ({ sp: b.sp, x: +b.x.toFixed(1), y: +b.y.toFixed(1), state: b.state, shown: !!this.bodies.get(b)?.visible }));
  }

  /** Miejsce, po którym zwierzę może chodzić: łąka/piach (jeleń także las), bez budynków, wody i gór */
  private ok(g: GameState, sp: Species, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 1 || ty < 1 || tx >= g.map.width - 1 || ty >= g.map.height - 1) return false;
    const t = ty * g.map.width + tx, tile = g.map.tiles[t];
    if (g.occupancy[t] !== 0) return false;
    return tile === Terrain.Grass || ((sp === 'deer' || sp === 'boar' || sp === 'fox') && tile === Terrain.Forest);
  }

  private spawn(g: GameState): void {
    for (const m of this.bodies.values()) this.group.remove(m);
    this.bodies.clear();
    this.beasts = [];
    const herds = HERDS[g.map.biome ?? 'meadow'] ?? [];
    let s = (g.map.seed ^ 0x5eed1) >>> 0;
    const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const W = g.map.width, H = g.map.height;
    for (const [sp, n, lo, hi] of herds) {
      for (let k = 0; k < n; k++) {
        // miejsce stada: z dala od zamków (ponad 22 pola), na dozwolonym polu
        let hx = 0, hy = 0, found = false;
        for (let tries = 0; tries < 60 && !found; tries++) {
          hx = 6 + rnd() * (W - 12); hy = 6 + rnd() * (H - 12);
          found = this.ok(g, sp, hx, hy) && g.map.starts.every((st) => Math.hypot(st.x - hx, st.y - hy) > 22);
        }
        if (!found) continue;
        const cnt = lo + Math.floor(rnd() * (hi - lo + 1));
        for (let i = 0; i < cnt && this.beasts.length < MAX; i++) {
          const x = hx + (rnd() - 0.5) * 3, y = hy + (rnd() - 0.5) * 3;
          if (!this.ok(g, sp, x, y)) continue;
          this.beasts.push({ sp, x, y, hx, hy, heading: rnd() * Math.PI * 2, state: 0, until: rnd() * 8, tx: x, ty: y, speed: 0, phase: rnd() * WALK, graze: 0, scale: 0.9 + rnd() * 0.2, seed: rnd() });
        }
      }
    }
  }

  sync(g: GameState, ctx: { time: number; dt: number; calm: boolean; height: (x: number, y: number) => number; cam: { x: number; y: number } }, people: { x: number; y: number }[]): void {
    const key = `${g.map.seed}:${g.map.biome}:${g.map.width}`;
    if (key !== this.key) { this.key = key; this.spawn(g); }
    const dt = Math.min(0.1, ctx.dt), t = ctx.time;
    const W2 = g.map.width / 2, H2 = g.map.height / 2;
    const seen = new Set<Beast>();
    for (const b of this.beasts) {
      // kto najbliżej z ludzi
      let nd = FLEE * FLEE, px = 0, py = 0;
      for (const p of people) { const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2; if (d < nd) { nd = d; px = p.x; py = p.y; } }
      if (nd < FLEE * FLEE) {
        // ucieczka: biegiem w przeciwną stronę, kawałek dalej niż zasięg
        if (b.state !== 2) b.phase = b.phase % WALK;
        const a = Math.atan2(b.x - px, b.y - py) + (b.seed - 0.5) * 0.6;
        b.state = 2; b.until = t + 2.5; b.tx = b.x + Math.sin(a) * 9; b.ty = b.y + Math.cos(a) * 9;
      } else if (t > b.until) {
        if (b.state === 0) {
          // idzie do nowej kępy niedaleko swojego miejsca (stado nie rozłazi się po mapie)
          const a = b.seed * 100 + t * 0.37, r = 1 + ((Math.sin(a * 3.1) + 1) / 2) * 5;
          b.tx = b.hx + Math.cos(a) * r; b.ty = b.hy + Math.sin(a) * r;
          b.state = 1; b.until = t + 14;
        } else {
          // po ucieczce stado osiada w nowym miejscu
          if (b.state === 2) { b.hx = b.x; b.hy = b.y; }
          b.state = 0; b.until = t + 5 + ((Math.sin(b.seed * 77 + t) + 1) / 2) * 9;
        }
      }
      let want = 0;
      if (b.state !== 0) {
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        if (d < 0.15) { if (b.state === 1) { b.state = 0; b.until = t + 4 + b.seed * 8; } }
        else {
          want = b.state === 2 ? (FLEE_SPEED[b.sp] ?? 3) : WALK_SPEED[b.sp];
          const h = Math.atan2(dx, dy);
          let dh = h - b.heading; dh -= Math.round(dh / (Math.PI * 2)) * Math.PI * 2;
          b.heading += dh * Math.min(1, dt * (b.state === 2 ? 6 : 2.5));
        }
      }
      b.speed += (want - b.speed) * Math.min(1, dt * 3);
      if (b.speed > 0.02) {
        const nx = b.x + Math.sin(b.heading) * b.speed * dt, ny = b.y + Math.cos(b.heading) * b.speed * dt;
        if (this.ok(g, b.sp, nx, ny)) { b.x = nx; b.y = ny; }
        else { b.heading += Math.PI * 0.5 * (b.seed > 0.5 ? 1 : -1); if (b.state === 1) b.until = t; }
      }
      // daleko od kamery nie liczymy pozy ani macierzy
      if ((b.x - ctx.cam.x) ** 2 + (b.y - ctx.cam.y) ** 2 > 90 * 90) continue;
      const len = model<FaunaModel>(`fauna_${b.sp}`).length;
      // klatka chodu z przebytej drogi (nogi nie ślizgają się): pełny cykl na ok. 1,1 długości ciała
      // przy ucieczce nogi nie młócą szybciej niż ~2,5 cyklu na sekundę (małe zwierzęta wyglądały jak nakręcane)
      b.phase = (b.phase + Math.min(2.5, b.speed / (len * strideOf(b.sp))) * dt * WALK) % WALK;
      b.graze += ((b.state === 0 && !ctx.calm ? 1 : 0) * (0.5 + 0.5 * Math.max(0, Math.sin(t * 0.25 + b.seed * 40))) - b.graze) * Math.min(1, dt * 1.2);
      const mix = poseFor(Math.min(1, b.speed / (WALK_SPEED[b.sp] * 0.7)), b.phase, t, b.seed, b.graze);
      // mieszanie dwóch klatek na procesorze: zwierząt jest kilkanaście, a gotowa siatka rysuje się zwykłym materiałem
      const mesh = this.body(b);
      blendFrames(mesh, b.sp, mix);
      // odgłosy: od czasu do czasu z bliska, przy ucieczce częściej
      const near = (b.x - ctx.cam.x) ** 2 + (b.y - ctx.cam.y) ** 2 < 30 * 30;
      if (near && !ctx.calm) {
        const last = this.voiceAt.get(b) ?? -99, gap = b.state === 2 ? 4 : 14 + b.seed * 20;
        // lis i zając milczą; dzik chrząka jak świnia, tylko niżej
        const voice = b.sp === 'camel' ? 'camel' : b.sp === 'deer' ? 'deer' : b.sp === 'boar' ? 'pig' : null;
        if (voice && t - last > gap && Math.sin(t * 1.7 + b.seed * 91) > 0.97) { this.voiceAt.set(b, t); play3d(voice, b.x - W2, b.y - H2, { y: ctx.height(b.x, b.y) + 0.4, rate: voice === 'pig' ? 0.75 : 1 }); }
      }
      this.q.setFromAxisAngle(this.up, b.heading);
      this.m.compose(this.v.set(b.x - W2, ctx.height(b.x, b.y), b.y - H2), this.q, this.s.setScalar(b.scale));
      mesh.matrix.copy(this.m); mesh.matrixWorldNeedsUpdate = true;
      mesh.visible = true;
      seen.add(b);
    }
    for (const [b, m] of this.bodies) if (!seen.has(b)) m.visible = false;
  }
}

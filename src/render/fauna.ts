import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { Terrain } from '../data/terrain';
import { model, bytes } from './modelstore';
import { cat } from './cat';
import { gpuMods } from './gpu/webgpu';
import { play3d } from '../audio/engine';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Dzikie zwierzęta (Michał 11.11.2026: „wielbłądy na pustyni, jelenie i sarny na zielonych terenach, uciekają od ludzi;
 * w przyszłości mięso dla myśliwego”). Modele z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0), przeniesione bez odchudzania
 * skryptem tools/models/fauna_0ad.py: dziesięć klatek chodu, osiem klatek ruchu spoczynkowego (łeb, uszy, ogon)
 * i skubanie trawy.
 *
 * Animacja płynna (Michał: „animacja musi być płynna”): wszystkie klatki leżą w jednej teksturze (wiersz położeń i wiersz
 * normalnych na klatkę), a karta graficzna miesza dwie sąsiednie klatki według ułamka — osobno dla każdego zwierzęcia
 * (atrybut instancji: klatka A, klatka B, waga). Cały gatunek to jedno wywołanie rysowania. (Morph targets w puli
 * instancji na WebGPU nie działały — nogi stały w miejscu.)
 *
 * Na razie tylko wygląd (symulacja o nich nie wie, gra przez sieć zostaje zgodna): stada pasą się wokół swojego miejsca,
 * chodzą od kępy do kępy, porykują, a gdy podejdzie człowiek (chłop, żołnierz), uciekają biegiem. Myśliwy i mięso —
 * osobna partia (docs/pomysly.md), wtedy zwierzęta przejdą do symulacji.
 */
type Packed = { pos: string; nrm: string; uv: string; idx: string; morph: Record<string, { pos: string; nrm: string }> };
type FaunaModel = { height: number; length: number; body: Packed };
export type Species = 'camel' | 'deer';
const WALK = 10, IDLE = 8;
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

const texs = new Map<Species, THREE.DataTexture>();
/** Tekstura klatek: szerokość = liczba wierzchołków, wiersz 2f = położenia klatki f, wiersz 2f+1 = normalne */
function frameTexture(sp: Species): THREE.DataTexture {
  let t = texs.get(sp);
  if (t) return t;
  const src = faunaGeometry(sp), P0 = src.getAttribute('position') as THREE.BufferAttribute, N0 = src.getAttribute('normal') as THREE.BufferAttribute;
  const V = P0.count, data = new Float32Array(V * FRAMES * 2 * 4);
  for (let f = 0; f < FRAMES; f++) {
    const dP = src.morphAttributes.position![f]!.array as Float32Array, dN = src.morphAttributes.normal![f]!.array as Float32Array;
    for (let i = 0; i < V; i++) {
      const o = ((2 * f) * V + i) * 4, on = ((2 * f + 1) * V + i) * 4;
      data[o] = P0.getX(i) + dP[i * 3]!; data[o + 1] = P0.getY(i) + dP[i * 3 + 1]!; data[o + 2] = P0.getZ(i) + dP[i * 3 + 2]!; data[o + 3] = 1;
      const x = N0.getX(i) + dN[i * 3]!, y = N0.getY(i) + dN[i * 3 + 1]!, z = N0.getZ(i) + dN[i * 3 + 2]!, l = Math.hypot(x, y, z) || 1;
      data[on] = x / l; data[on + 1] = y / l; data[on + 2] = z / l; data[on + 3] = 0;
    }
  }
  t = new THREE.DataTexture(data, V, FRAMES * 2, THREE.RGBAFormat, THREE.FloatType);
  t.needsUpdate = true;
  texs.set(sp, t);
  return t;
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
  }
  mats.set(sp, m);
  return m;
}

/** Materiał puli z płynną animacją: położenie i normalna z dwóch klatek tekstury, mieszane wagą z atrybutu `pose` */
function herdMaterial(sp: Species): THREE.Material {
  const base = faunaMaterial(sp);
  if (!gpuMods) return base;
  const T = gpuMods.TSL as any, Wm = gpuMods.W as any;
  const { attribute, textureLoad, ivec2, int, vertexIndex, mix, normalize, Fn, normalLocal } = T;
  const tex = frameTexture(sp);
  const pose = attribute('pose', 'vec3');
  const a = int(pose.x), b = int(pose.y), w = pose.z, vi = int(vertexIndex);
  const row = (f: any, k: number): any => textureLoad(tex, ivec2(vi, f.mul(2).add(k))).xyz;
  const m = new Wm.MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0 });
  m.map = base.map;
  m.positionNode = Fn(() => {
    normalLocal.assign(normalize(mix(row(a, 1), row(b, 1), w)));
    return mix(row(a, 0), row(b, 0), w);
  })();
  return m as THREE.Material;
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
  desert: [['camel', 7, 2, 4]],
  meadow: [['deer', 9, 3, 6]],
  highland: [['deer', 8, 2, 5]],
  steppe: [['deer', 5, 2, 4]],
  north: [['deer', 4, 2, 3]],
};
const FLEE = 6.5;       // człowiek bliżej niż tyle pól — zwierzę ucieka
const MAX = 64;

export class Wildlife {
  private beasts: Beast[] = [];
  /** gatunek → pula instancji i atrybut pozy (klatka A, klatka B, waga) */
  private meshes = new Map<Species, { im: THREE.InstancedMesh; pose: THREE.InstancedBufferAttribute }>();
  /** kiedy zwierzę ostatnio się odezwało */
  private voiceAt = new Map<Beast, number>();
  private key = '';
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private scene: THREE.Scene) {}

  private herd(sp: Species): { im: THREE.InstancedMesh; pose: THREE.InstancedBufferAttribute } {
    let h = this.meshes.get(sp);
    if (h) return h;
    const geo = faunaGeometry(sp).clone();
    geo.morphAttributes = {};
    const pose = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    pose.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('pose', pose);
    const im = new THREE.InstancedMesh(geo, herdMaterial(sp), MAX);
    im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.count = 0; im.visible = false;
    this.scene.add(cat(im, 'dzikie zwierzęta'));
    h = { im, pose };
    this.meshes.set(sp, h);
    return h;
  }

  /** Miejsce, po którym zwierzę może chodzić: łąka/piach (jeleń także las), bez budynków, wody i gór */
  private ok(g: GameState, sp: Species, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 1 || ty < 1 || tx >= g.map.width - 1 || ty >= g.map.height - 1) return false;
    const t = ty * g.map.width + tx, tile = g.map.tiles[t];
    if (g.occupancy[t] !== 0) return false;
    return tile === Terrain.Grass || (sp === 'deer' && tile === Terrain.Forest);
  }

  private spawn(g: GameState): void {
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
    const counts = new Map<string, number>();
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
          want = b.state === 2 ? (b.sp === 'camel' ? 2.6 : 3.4) : (b.sp === 'camel' ? 0.55 : 0.7);
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
      const herd = this.herd(b.sp);
      const len = model<FaunaModel>(`fauna_${b.sp}`).length;
      // klatka chodu z przebytej drogi (nogi nie ślizgają się): pełny cykl na ok. 1,1 długości ciała
      b.phase = (b.phase + (b.speed * dt) / (len * 1.1) * WALK) % WALK;
      b.graze += ((b.state === 0 && !ctx.calm ? 1 : 0) * (0.5 + 0.5 * Math.max(0, Math.sin(t * 0.25 + b.seed * 40))) - b.graze) * Math.min(1, dt * 1.2);
      const n = counts.get(b.sp) ?? 0;
      if (n >= MAX) continue;
      let fa: number, fb: number, fw: number;
      if (b.speed > 0.06) {
        // chód: dwie sąsiednie klatki, mieszane ułamkiem kroku
        fa = Math.floor(b.phase) % WALK; fb = (fa + 1) % WALK; fw = b.phase - Math.floor(b.phase);
      } else {
        // stoi: zapętlony ruch spoczynkowy (łeb, uszy, ogon), a przy skubaniu przejście do łba przy ziemi
        const ip = (t * 0.9 + b.seed * IDLE) % IDLE, i0 = Math.floor(ip);
        if (b.graze > 0.02) { fa = IDLE0 + i0; fb = GRAZE; fw = Math.min(1, b.graze); }
        else { fa = IDLE0 + i0; fb = IDLE0 + (i0 + 1) % IDLE; fw = ip - i0; }
      }
      herd.pose.setXYZ(n, fa, fb, fw);
      // odgłosy: od czasu do czasu z bliska, przy ucieczce częściej
      const near = (b.x - ctx.cam.x) ** 2 + (b.y - ctx.cam.y) ** 2 < 30 * 30;
      if (near && !ctx.calm) {
        const last = this.voiceAt.get(b) ?? -99, gap = b.state === 2 ? 4 : 14 + b.seed * 20;
        if (t - last > gap && Math.sin(t * 1.7 + b.seed * 91) > 0.97) { this.voiceAt.set(b, t); play3d(b.sp === 'camel' ? 'camel' : 'deer', b.x - W2, b.y - H2, { y: ctx.height(b.x, b.y) + 0.4 }); }
      }
      const im = herd.im;
      this.q.setFromAxisAngle(this.up, b.heading);
      this.m.compose(this.v.set(b.x - W2, ctx.height(b.x, b.y), b.y - H2), this.q, this.s.setScalar(b.scale));
      im.setMatrixAt(n, this.m);
      counts.set(b.sp, n + 1);
    }
    for (const [sp, h] of this.meshes) {
      const n = counts.get(sp) ?? 0;
      h.im.count = n; h.im.visible = n > 0;
      if (n) { h.im.instanceMatrix.needsUpdate = true; h.pose.needsUpdate = true; }
    }
  }
}

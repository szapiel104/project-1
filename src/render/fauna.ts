import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { Terrain } from '../data/terrain';
import { model, bytes } from './modelstore';
import { cat } from './cat';

/**
 * Dzikie zwierzęta (Michał 11.11.2026: „wielbłądy na pustyni, jelenie i sarny na zielonych terenach, uciekają od ludzi;
 * w przyszłości mięso dla myśliwego”). Modele z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0), przeniesione bez odchudzania
 * skryptem tools/models/fauna_0ad.py: sześć klatek chodu i skubanie jako morph targets, więc każde zwierzę w stadzie
 * idzie i je po swojemu, a cały gatunek to jedno wywołanie rysowania.
 *
 * Na razie tylko wygląd (symulacja o nich nie wie, gra przez sieć zostaje zgodna): stada pasą się wokół swojego miejsca,
 * chodzą od kępy do kępy, a gdy podejdzie człowiek (chłop, żołnierz), uciekają biegiem. Myśliwy i mięso — osobna partia
 * (docs/pomysly.md), wtedy zwierzęta przejdą do symulacji.
 */
type Packed = { pos: string; nrm: string; uv: string; idx: string; morph: Record<string, { pos: string; nrm: string }> };
type FaunaModel = { height: number; length: number; body: Packed };
export type Species = 'camel' | 'deer';
const MORPHS = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'graze'];
const WALK = 6, GRAZE = 6;

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
  private meshes = new Map<Species, THREE.InstancedMesh>();
  private pose = new Map<Species, THREE.Mesh>();
  private key = '';
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private scene: THREE.Scene) {}

  private mesh(sp: Species): THREE.InstancedMesh {
    let im = this.meshes.get(sp);
    if (im) return im;
    im = new THREE.InstancedMesh(faunaGeometry(sp), faunaMaterial(sp), MAX);
    im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
    const p = new THREE.Mesh(faunaGeometry(sp));
    p.updateMorphTargets();
    // pierwsze ustawienie póz na pełną liczbę (three robi teksturę póz na `count` z chwili pierwszego wywołania)
    im.count = MAX; for (let i = 0; i < MAX; i++) im.setMorphAt(i, p); im.count = 0;
    this.scene.add(cat(im, 'dzikie zwierzęta'));
    this.meshes.set(sp, im); this.pose.set(sp, p);
    return im;
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
    const counts = new Map<Species, number>();
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
      const im = this.mesh(b.sp), p = this.pose.get(b.sp)!, n = counts.get(b.sp) ?? 0;
      if (n >= MAX) continue;
      const len = model<FaunaModel>(`fauna_${b.sp}`).length;
      // klatka chodu z przebytej drogi (nogi nie ślizgają się): pełny cykl na ok. 1,1 długości ciała
      b.phase = (b.phase + (b.speed * dt) / (len * 1.1) * WALK) % WALK;
      const w = p.morphTargetInfluences!;
      w.fill(0);
      const walkK = Math.min(1, b.speed / 0.3);
      const i0 = Math.floor(b.phase), f = b.phase - i0;
      w[i0] = (1 - f) * walkK; w[(i0 + 1) % WALK] = f * walkK;
      b.graze += ((b.state === 0 && !ctx.calm ? 1 : 0) * (0.5 + 0.5 * Math.max(0, Math.sin(t * 0.25 + b.seed * 40))) - b.graze) * Math.min(1, dt * 1.5);
      w[GRAZE] = b.graze * (1 - walkK);
      this.q.setFromAxisAngle(this.up, b.heading);
      this.m.compose(this.v.set(b.x - W2, ctx.height(b.x, b.y), b.y - H2), this.q, this.s.setScalar(b.scale));
      im.setMatrixAt(n, this.m);
      im.setMorphAt(n, p);
      counts.set(b.sp, n + 1);
    }
    for (const [sp, im] of this.meshes) {
      const n = counts.get(sp) ?? 0;
      im.count = n; im.visible = n > 0;
      if (n) { im.instanceMatrix.needsUpdate = true; if (im.morphTexture) im.morphTexture.needsUpdate = true; }
    }
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { FP, type GameState } from '../sim/state';
import { tint } from './loads';
import { WOLF_HIPS, WOLF_TAIL, wolfParts } from './creatures';

/**
 * Zwierzęta w osadzie — tylko w wyglądzie (symulacja ich nie zna, gra przez sieć zostaje zgodna):
 * kury grzebią przy chatach i uciekają przed przechodniami, świnie ryją przy chatach i polach,
 * przy koszarach stoi koń i skubie trawę, a po osadzie biega pies: chodzi za kimś z mieszkańców,
 * a nocą obszczekuje wilki pod palisadą.
 */

type Sound = (kind: 'bark' | 'cluck' | 'grunt', x: number, y: number) => void;
export interface VillageCtx { time: number; dt: number; night: number; calm: boolean; height: (x: number, y: number) => number; sound: Sound }

interface Critter { x: number; y: number; tx: number; ty: number; wait: number; heading: number; speed: number; seen: number; hx: number; hy: number; flee: number; next: number }
interface Dog extends Critter { master: number; until: number; bark: number; run: number }

const HEN_COLORS = [0xf0ece2, 0xa8673a, 0x8a5530, 0x2e2925, 0xd8c7a0];
const MAX_HENS = 160, MAX_PIGS = 48, MAX_HORSES = 8, MAX_DOGS = 8;

const ell = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, hex: number): THREE.BufferGeometry =>
  tint(new THREE.SphereGeometry(r, 10, 7).scale(sx, sy, sz).translate(x, y, z), hex);
const cyl = (r1: number, r2: number, h: number, x: number, y: number, z: number, hex: number, sides = 6): THREE.BufferGeometry =>
  tint(new THREE.CylinderGeometry(r1, r2, h, sides).translate(x, y, z), hex);
const mergeAll = (l: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(l.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }))!;

export function henGeometry(): { body: THREE.BufferGeometry; detail: THREE.BufferGeometry } {
  // tułów, ogon i łeb w kolorze kury (barwa na egzemplarz); grzebień, korale, dziób i nogi stałe
  const body = mergeAll([
    ell(0.045, 0.8, 0.82, 1.15, 0, 0.068, 0, 0xffffff),
    tint(new THREE.ConeGeometry(0.026, 0.06, 5).rotateX(-0.9).translate(0, 0.098, -0.05), 0xe6e6e6),
    ell(0.021, 1, 1.05, 1, 0, 0.112, 0.045, 0xffffff),
  ]);
  const detail = mergeAll([
    tint(new THREE.BoxGeometry(0.006, 0.018, 0.026).translate(0, 0.137, 0.045), 0xc0281e),
    tint(new THREE.BoxGeometry(0.008, 0.014, 0.008).translate(0, 0.1, 0.064), 0xc0281e),
    tint(new THREE.ConeGeometry(0.007, 0.018, 4).rotateX(Math.PI / 2).translate(0, 0.11, 0.072), 0xe0a530),
    cyl(0.004, 0.004, 0.04, -0.013, 0.02, 0, 0xd99a2a, 4), cyl(0.004, 0.004, 0.04, 0.013, 0.02, 0, 0xd99a2a, 4),
    ell(0.004, 1, 1, 1, -0.015, 0.118, 0.056, 0x111111), ell(0.004, 1, 1, 1, 0.015, 0.118, 0.056, 0x111111),
  ]);
  return { body, detail };
}

export function pigGeometry(): THREE.BufferGeometry {
  const PINK = 0xd9a08c, SNOUT = 0xe6aa98, HOOF = 0x4a3a30;
  return mergeAll([
    ell(0.08, 0.9, 0.82, 1.45, 0, 0.115, 0, PINK),
    ell(0.05, 0.95, 0.9, 1, 0, 0.125, 0.12, PINK),
    tint(new THREE.CylinderGeometry(0.024, 0.026, 0.035, 8).rotateX(Math.PI / 2).translate(0, 0.115, 0.17), SNOUT),
    tint(new THREE.ConeGeometry(0.018, 0.035, 4).rotateX(0.6).translate(-0.028, 0.17, 0.11), PINK),
    tint(new THREE.ConeGeometry(0.018, 0.035, 4).rotateX(0.6).translate(0.028, 0.17, 0.11), PINK),
    ...[[-0.04, 0.07], [0.04, 0.07], [-0.04, -0.07], [0.04, -0.07]].map(([x, z]) => cyl(0.014, 0.012, 0.06, x!, 0.03, z!, HOOF, 5)),
    tint(new THREE.TorusGeometry(0.012, 0.004, 4, 8, Math.PI * 1.5).translate(0, 0.13, -0.118), PINK),
    ell(0.005, 1, 1, 1, -0.02, 0.14, 0.158, 0x1a1412), ell(0.005, 1, 1, 1, 0.02, 0.14, 0.158, 0x1a1412),
  ]);
}

export function horseGeometry(): { body: THREE.BufferGeometry; neck: THREE.BufferGeometry; tail: THREE.BufferGeometry } {
  const COAT = 0x6b4527, DARK = 0x2a1c12, HOOF = 0x1c1612;
  const body = mergeAll([
    ell(0.12, 0.76, 0.86, 1.6, 0, 0.37, 0, COAT),
    ell(0.07, 1, 1, 1, 0, 0.38, 0.13, COAT), // pierś
    ell(0.075, 1, 1, 1, 0, 0.385, -0.13, COAT), // zad
    ...[[-0.05, 0.14], [0.05, 0.14], [-0.05, -0.14], [0.05, -0.14]].flatMap(([x, z]) => [
      cyl(0.032, 0.02, 0.26, x!, 0.17, z!, COAT, 7), cyl(0.024, 0.024, 0.04, x!, 0.02, z!, HOOF, 7),
    ]),
    tint(new THREE.BoxGeometry(0.17, 0.025, 0.2).translate(0, 0.475, 0.0), 0x5a3018), // derka na grzbiecie
  ]);
  // szyja i łeb z osią w kłębie (pochyla się do trawy)
  const neck = mergeAll([
    cyl(0.045, 0.07, 0.26, 0, 0.12, 0, COAT, 8).rotateX(0.55),
    tint(new THREE.CylinderGeometry(0.03, 0.045, 0.21, 8).rotateX(Math.PI / 2 + 0.5).translate(0, 0.19, 0.2), COAT), // łeb
    tint(new THREE.CylinderGeometry(0.026, 0.03, 0.04, 8).rotateX(Math.PI / 2 + 0.5).translate(0, 0.14, 0.29), 0x3a2414), // chrapy
    tint(new THREE.BoxGeometry(0.016, 0.04, 0.22).translate(0, 0.19, -0.01).rotateX(0.55), DARK), // grzywa
    tint(new THREE.ConeGeometry(0.014, 0.05, 4).translate(-0.022, 0.27, 0.13), COAT),
    tint(new THREE.ConeGeometry(0.014, 0.05, 4).translate(0.022, 0.27, 0.13), COAT),
  ]);
  const tail = mergeAll([tint(new THREE.CylinderGeometry(0.03, 0.012, 0.28, 6).translate(0, -0.14, 0), DARK)]);
  return { body, neck, tail };
}

const rand = (): number => Math.random();

export class Village {
  private hensBody: THREE.InstancedMesh;
  private hensDetail: THREE.InstancedMesh;
  private pigs: THREE.InstancedMesh;
  private horseBody: THREE.InstancedMesh;
  private horseNeck: THREE.InstancedMesh;
  private horseTail: THREE.InstancedMesh;
  private dogBody: THREE.InstancedMesh;
  private dogLegF: THREE.InstancedMesh;
  private dogLegH: THREE.InstancedMesh;
  private dogTail: THREE.InstancedMesh;
  private hens = new Map<string, Critter>();
  private pigState = new Map<string, Critter>();
  private dogs = new Map<number, Dog>();
  private frame = 0;
  private m = new THREE.Matrix4();
  private p = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const inst = (geo: THREE.BufferGeometry, max: number, mat?: THREE.Material): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geo, mat ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), max);
      m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m);
      return m;
    };
    const hen = henGeometry();
    this.hensBody = inst(hen.body, MAX_HENS);
    this.hensDetail = inst(hen.detail, MAX_HENS);
    this.pigs = inst(pigGeometry(), MAX_PIGS);
    const horse = horseGeometry();
    this.horseBody = inst(horse.body, MAX_HORSES);
    this.horseNeck = inst(horse.neck, MAX_HORSES);
    this.horseTail = inst(horse.tail, MAX_HORSES);
    // pies: sylwetka wilka, mniejszy, w brązowej, płowej sierści, z ogonem w górze
    const w = wolfParts();
    const fur = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, color: 0xd6a466 });
    this.dogBody = inst(w.body, MAX_DOGS, fur);
    this.dogLegF = inst(w.leg, MAX_DOGS * 2, fur);
    this.dogLegH = inst(w.hindLeg, MAX_DOGS * 2, fur);
    this.dogTail = inst(w.tail, MAX_DOGS, fur);
    // pierwsze ustawienie kolorów, żeby instanceColor istniał
    this.hensBody.setColorAt(0, this.c.setHex(0xffffff));
    this.pigs.setColorAt(0, this.c.setHex(0xffffff));
  }

  /** Czy zwierzę może tu stanąć: pole bez budynku, nie woda i nie góra */
  private free(g: GameState, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
    const t = ty * g.map.width + tx;
    return g.occupancy[t] === 0 && TERRAIN[g.map.tiles[t] as keyof typeof TERRAIN]!.walkable;
  }

  /** Nowy cel wędrówki w promieniu `r` od domu (pole wolne) */
  private wander(g: GameState, c: Critter, r: number): void {
    for (let k = 0; k < 6; k++) {
      const a = rand() * Math.PI * 2, d = 0.3 + rand() * r;
      const x = c.hx + Math.cos(a) * d, y = c.hy + Math.sin(a) * d;
      if (this.free(g, x, y)) { c.tx = x; c.ty = y; return; }
    }
    c.tx = c.hx; c.ty = c.hy;
  }

  /** Krok w stronę celu z omijaniem budynków (ślizg po osi albo nowy cel) */
  private walk(g: GameState, c: Critter, dt: number, speed: number, r: number): number {
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 0.03) return 0;
    const st = Math.min(d, speed * dt), nx = c.x + (dx / d) * st, ny = c.y + (dy / d) * st;
    if (this.free(g, nx, ny)) { c.x = nx; c.y = ny; }
    else if (this.free(g, nx, c.y)) c.x = nx;
    else if (this.free(g, c.x, ny)) c.y = ny;
    else { this.wander(g, c, r); return 0; }
    let a = Math.atan2(dx, dy) - c.heading;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    c.heading += a * Math.min(1, dt * 8);
    return st / Math.max(dt, 1e-4);
  }

  private place(x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0, scale = 1): THREE.Matrix4 {
    this.e.set(pitch, yaw, roll, 'YXZ');
    return this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e), this.s.setScalar(scale));
  }

  sync(g: GameState, ctx: VillageCtx, people: { x: number; y: number; owner: number; moving: boolean; id: number }[]): void {
    this.frame++;
    const { width, height } = g.map, dt = ctx.calm ? 0 : Math.min(0.1, ctx.dt), time = ctx.time;
    const W2 = width / 2, H2 = height / 2;
    // siatka przechodniów (kury przed nimi uciekają, pies wybiera sobie pana)
    const grid = new Map<number, typeof people>();
    for (const p of people) { const k = Math.floor(p.x) * 4096 + Math.floor(p.y); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(p); }
    const nearPerson = (x: number, y: number, r: number): (typeof people)[number] | undefined => {
      for (let gx = Math.floor(x) - 1; gx <= Math.floor(x) + 1; gx++) for (let gy = Math.floor(y) - 1; gy <= Math.floor(y) + 1; gy++)
        for (const p of grid.get(gx * 4096 + gy) ?? []) if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r) return p;
      return undefined;
    };
    let hens = 0, pigs = 0, horses = 0;
    const sleep = ctx.night > 0.55;
    for (const b of g.buildings) {
      if (b.build || b.ruined || b.door < 0) continue;
      const id = BUILDINGS[b.type]!.id;
      const house = id === 'house', farm = id === 'farm';
      const dx = (b.door % width) + 0.5, dy = Math.floor(b.door / width) + 0.5;
      // kury przy chatach: grzebią i dziobią, przed przechodniem uciekają z trzepotem; nocą siedzą w kurniku
      if (house && !sleep) {
        const n = 2 + (b.id % 2);
        for (let k = 0; k < n && hens < MAX_HENS; k++) {
          const key = `${b.id}:${k}`;
          let c = this.hens.get(key);
          if (!c) { c = { x: dx, y: dy, tx: dx, ty: dy, wait: rand() * 2, heading: rand() * 6.28, speed: 0, seen: 0, hx: dx, hy: dy, flee: 0, next: time + 5 + rand() * 15 }; this.wander(g, c, 1.4); this.hens.set(key, c); }
          c.seen = this.frame;
          const p = nearPerson(c.x, c.y, 0.45);
          if (p && c.flee <= 0) {
            // ucieka od przechodnia
            const ax = c.x - p.x, ay = c.y - p.y, d = Math.hypot(ax, ay) || 1;
            c.tx = c.x + (ax / d) * 0.9; c.ty = c.y + (ay / d) * 0.9; c.flee = 0.8; c.wait = 0;
          }
          let sp = 0, peck = 0, hop = 0;
          if (c.flee > 0) { c.flee -= dt; sp = this.walk(g, c, dt, 1.6, 1.4); hop = Math.abs(Math.sin(time * 22 + k)) * 0.02; }
          else if (c.wait > 0) { c.wait -= dt; peck = Math.max(0, Math.sin(time * 9 + b.id + k * 2)) * 0.7; if (c.wait <= 0) this.wander(g, c, 1.4); }
          else { sp = this.walk(g, c, dt, 0.45, 1.4); if (!sp) c.wait = 1 + rand() * 3; }
          if (time > c.next) { c.next = time + 8 + rand() * 18; ctx.sound('cluck', c.x, c.y); }
          const bob = sp > 0.1 && !hop ? Math.abs(Math.sin(time * 14 + k)) * 0.006 : 0;
          this.place(c.x - W2, ctx.height(c.x, c.y) + bob + hop, c.y - H2, c.heading, peck);
          this.hensBody.setMatrixAt(hens, this.m);
          this.hensDetail.setMatrixAt(hens, this.m);
          this.hensBody.setColorAt(hens, this.c.setHex(HEN_COLORS[(b.id * 3 + k * 7) % HEN_COLORS.length]!));
          hens++;
        }
      }
      // świnie: przy co trzeciej chacie jedna, przy polu dwie; ryją w ziemi, nocą leżą na boku
      const pn = farm ? 2 : house && b.id % 3 === 0 ? 1 : 0;
      for (let k = 0; k < pn && pigs < MAX_PIGS; k++) {
        const key = `${b.id}:${k}`;
        let c = this.pigState.get(key);
        if (!c) {
          // przy polu: obok działki, nie na niej
          const fp = footprint(BUILDINGS[b.type]!, b.rot);
          const hx = farm ? b.x + fp.w + 0.4 : dx, hy = farm ? b.y + fp.h / 2 : dy;
          c = { x: hx, y: hy, tx: hx, ty: hy, wait: rand() * 4, heading: rand() * 6.28, speed: 0, seen: 0, hx, hy, flee: 0, next: time + 10 + rand() * 20 };
          if (!this.free(g, hx, hy)) { c.hx = c.x = c.tx = dx; c.hy = c.y = c.ty = dy; }
          this.pigState.set(key, c);
        }
        c.seen = this.frame;
        let root = 0, lie = 0;
        if (sleep) lie = 1.35;
        else if (c.wait > 0) { c.wait -= dt; root = 0.12 + Math.sin(time * 5 + b.id) * 0.06; if (c.wait <= 0) this.wander(g, c, 1.5); }
        else if (!this.walk(g, c, dt, 0.3, 1.5)) c.wait = 2 + rand() * 5;
        if (!sleep && time > c.next) { c.next = time + 12 + rand() * 20; ctx.sound('grunt', c.x, c.y); }
        this.place(c.x - W2, ctx.height(c.x, c.y) + (lie ? 0.05 : 0), c.y - H2, c.heading, root, lie);
        this.pigs.setMatrixAt(pigs, this.m);
        // co druga świnia ubłocona
        this.pigs.setColorAt(pigs, this.c.setHex((b.id + k) % 2 ? 0xffffff : 0xa08070));
        pigs++;
      }
      // koń przy koszarach: uwiązany obok, skubie trawę, macha ogonem, przestępuje
      if (id === 'barracks' && horses < MAX_HORSES) {
        const fp = footprint(BUILDINGS[b.type]!, b.rot);
        let hx = dx + 1.2, hy = dy;
        if (!this.free(g, hx, hy)) { hx = dx - 1.2; if (!this.free(g, hx, hy)) { hx = b.x + fp.w + 0.6; hy = b.y + 1; } }
        const yaw = ((b.id * 1.7) % 1) * Math.PI * 2;
        const graze = ctx.calm ? 0.2 : 0.55 + Math.sin(time * 0.25 + b.id) * 0.75;
        const y = ctx.height(hx, hy);
        this.place(hx - W2, y, hy - H2, yaw + Math.sin(time * 0.1 + b.id) * 0.15);
        this.horseBody.setMatrixAt(horses, this.m);
        const body = this.p.copy(this.m);
        this.m.compose(this.v.set(0, 0.4, 0.17), this.q.setFromEuler(this.e.set(Math.max(-0.25, Math.min(1.25, graze)), 0, 0)), this.s.setScalar(1));
        this.horseNeck.setMatrixAt(horses, this.m.premultiply(body));
        this.m.compose(this.v.set(0, 0.42, -0.2), this.q.setFromEuler(this.e.set(0.35, 0, ctx.calm ? 0 : Math.sin(time * 2.3 + b.id) * 0.35)), this.s.setScalar(1));
        this.horseTail.setMatrixAt(horses, this.m.premultiply(body));
        horses++;
      }
    }
    // pies: jeden na gracza, przy twierdzy; chodzi za kimś z osady, nocą obszczekuje wilki
    let dogs = 0;
    for (const pl of g.players) {
      if (dogs >= MAX_DOGS || pl.defeated) continue;
      const keep = g.buildings.find((b) => b.owner === pl.id && b.type === 0 && !b.ruined);
      if (!keep || keep.door < 0) continue;
      const kx = (keep.door % width) + 0.5, ky = Math.floor(keep.door / width) + 1.5;
      let d = this.dogs.get(pl.id);
      if (!d) { d = { x: kx, y: ky, tx: kx, ty: ky, wait: 0, heading: 0, speed: 0, seen: 0, hx: kx, hy: ky, flee: 0, next: 0, master: 0, until: 0, bark: 0, run: 0 }; this.dogs.set(pl.id, d); }
      d.hx = kx; d.hy = ky; d.seen = this.frame;
      // wilk w pobliżu: biegnie w jego stronę, staje dwa pola przed nim i szczeka
      let wolf: { x: number; y: number } | undefined, wd = 10;
      for (const w of g.wolves) { if (w.hp <= 0 || w.leaving) continue; const x = w.px / FP, y = w.py / FP, dd = Math.hypot(x - d.x, y - d.y); if (dd < wd) { wd = dd; wolf = { x, y }; } }
      let speed = 0.8;
      if (wolf) {
        const ax = d.x - wolf.x, ay = d.y - wolf.y, dd = Math.hypot(ax, ay) || 1;
        d.tx = wolf.x + (ax / dd) * 2.2; d.ty = wolf.y + (ay / dd) * 2.2; speed = 3;
        if (time > d.bark) { d.bark = time + 0.6 + rand() * 0.5; ctx.sound('bark', d.x, d.y); }
      } else {
        // pan: ktoś z osady, kto akurat idzie; co jakiś czas inny
        const master = d.master ? people.find((p) => p.id === d!.master) : undefined;
        if (!master || time > d.until || Math.hypot(master.x - kx, master.y - ky) > 14) {
          const pool = people.filter((p) => p.owner === pl.id && p.moving && Math.hypot(p.x - kx, p.y - ky) < 12);
          const pick = pool.length ? pool[Math.floor(rand() * pool.length)] : undefined;
          d.master = pick ? pick.id : 0; d.until = time + 20 + rand() * 25;
          if (!pick) { if (d.wait <= 0) { this.wander(g, d, 2.5); d.wait = 3 + rand() * 4; } }
        }
        if (master && time <= d.until) {
          // idzie obok pana, trochę z tyłu; gdy pan stoi, siada przy nim
          d.tx = master.x + 0.35; d.ty = master.y + 0.35;
          speed = Math.min(2.6, 0.6 + Math.hypot(d.tx - d.x, d.ty - d.y) * 2);
        } else d.wait -= dt;
        // obcy żołnierz w osadzie: szczeka z daleka
        if (time > d.bark) {
          const foe = g.soldiers.find((s) => g.players[s.owner]?.team !== pl.team && Math.abs(s.px / FP - d!.x) < 6 && Math.abs(s.py / FP - d!.y) < 6);
          if (foe) ctx.sound('bark', d.x, d.y);
          d.bark = time + (foe ? 0.8 + rand() : 3);
        }
      }
      const sp = this.walk(g, d, dt, speed, 2.5);
      d.run += (sp - d.run) * Math.min(1, dt * 6);
      const moving = d.run > 0.15;
      const ph = time * (6 + d.run * 3);
      const sit = !moving && !wolf;
      const y = ctx.height(d.x, d.y);
      // siedzi: zad nisko (pochylony do tyłu); w biegu podskakuje
      this.place(d.x - W2, y + (moving ? Math.abs(Math.sin(ph)) * 0.02 : 0) - (sit ? 0.03 : 0), d.y - H2, d.heading, sit ? -0.32 : 0, 0, 0.5);
      this.dogBody.setMatrixAt(dogs, this.m);
      const body = this.p.copy(this.m);
      WOLF_HIPS.forEach(([hx, hy, hz], k) => {
        const diag = k === 0 || k === 3 ? 1 : -1;
        const ang = moving ? Math.sin(ph) * Math.min(0.7, 0.25 + d!.run * 0.2) * diag : sit && k >= 2 ? -1.2 : sit ? 0.32 : 0;
        this.m.compose(this.v.set(hx, hy, hz), this.q.setFromEuler(this.e.set(ang, 0, 0)), this.s.setScalar(1));
        (k < 2 ? this.dogLegF : this.dogLegH).setMatrixAt(dogs * 2 + (k & 1), this.m.premultiply(body));
      });
      // ogon w górze i merda (przy wilku sztywny)
      const wag = ctx.calm || wolf ? 0 : Math.sin(time * (moving ? 14 : 8)) * 0.5;
      this.m.compose(this.v.set(...WOLF_TAIL), this.q.setFromEuler(this.e.set(wolf ? 2.1 : 2.5, 0, wag)), this.s.setScalar(1));
      this.dogTail.setMatrixAt(dogs, this.m.premultiply(body));
      dogs++;
    }
    // zwierzęta zniknęłych budynków: precz
    for (const [k, c] of this.hens) if (this.frame - c.seen > 120) this.hens.delete(k);
    for (const [k, c] of this.pigState) if (this.frame - c.seen > 120) this.pigState.delete(k);
    for (const [k, c] of this.dogs) if (this.frame - c.seen > 120) this.dogs.delete(k);
    const fin = (m: THREE.InstancedMesh, n: number): void => { m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    fin(this.hensBody, hens); fin(this.hensDetail, hens); fin(this.pigs, pigs);
    fin(this.horseBody, horses); fin(this.horseNeck, horses); fin(this.horseTail, horses);
    fin(this.dogBody, dogs); fin(this.dogLegF, dogs * 2); fin(this.dogLegH, dogs * 2); fin(this.dogTail, dogs);
  }
}

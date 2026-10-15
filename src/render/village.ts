import * as THREE from 'three';
import { cat } from './cat';
import { BUILDINGS, footprint } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { FP, keepFront, type GameState } from '../sim/state';
import { modelGeo, type ModelMesh } from './peasants';
import ANIMALS from './models/animals.json';

/**
 * Zwierzęta w osadzie — tylko w wyglądzie (symulacja ich nie zna, gra przez sieć zostaje zgodna):
 * kury grzebią przy chatach i uciekają przed przechodniami, świnie ryją przy chatach i polach,
 * przy koszarach stoi koń i skubie trawę, a po osadzie biega pies: chodzi za kimś z mieszkańców,
 * a nocą obszczekuje wilki pod palisadą.
 */

type Sound = (kind: 'bark' | 'cluck' | 'grunt', x: number, y: number) => void;
/** `cam` = kamera w polach mapy (x, y) i jej wysokość; zwierzęta dalej niż ~40 pól od niej nie są rysowane */
export interface VillageCtx { time: number; dt: number; night: number; calm: boolean; height: (x: number, y: number) => number; sound: Sound; cam?: { x: number; y: number; h: number } }

interface Critter { x: number; y: number; tx: number; ty: number; wait: number; heading: number; speed: number; seen: number; hx: number; hy: number; flee: number; next: number }
interface Dog extends Critter { master: number; until: number; bark: number; run: number; stuck: number }

const MAX_HENS = 120, MAX_PIGS = 48, MAX_HORSES = 8, MAX_DOGS = 8;

/** Modele zwierząt z Blendera (tools/models/animals.py) */
const A = ANIMALS as unknown as Record<string, ModelMesh[]> & { horse_neck_at: [number, number, number]; horse_tail_at: [number, number, number]; dog_hips: [number, number, number][]; dog_tail_at: [number, number, number] };
const geo = (k: string): THREE.BufferGeometry => modelGeo(A[k]![0]!);
export const animalGeo = (k: 'hen_white' | 'hen_brown' | 'hen_black' | 'pig' | 'horse_body' | 'horse_neck' | 'horse_tail' | 'dog_body' | 'dog_leg' | 'dog_hind' | 'dog_tail'): THREE.BufferGeometry => geo(k);
export const ANIMAL_AT = { neck: A.horse_neck_at, tail: A.horse_tail_at, dogHips: A.dog_hips, dogTail: A.dog_tail_at };

const rand = (): number => Math.random();

export class Village {
  /** Kury w trzech umaszczeniach (białe, rude, czarne) */
  private hensBy: THREE.InstancedMesh[];
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
  private keeps: [number, number, number, number][] = [];
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
      m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(cat(m, 'zwierzęta i wieś'));
      return m;
    };
    this.hensBy = (['hen_white', 'hen_brown', 'hen_black'] as const).map((k) => inst(geo(k), MAX_HENS));
    this.pigs = inst(geo('pig'), MAX_PIGS);
    this.horseBody = inst(geo('horse_body'), MAX_HORSES);
    this.horseNeck = inst(geo('horse_neck'), MAX_HORSES);
    this.horseTail = inst(geo('horse_tail'), MAX_HORSES);
    this.dogBody = inst(geo('dog_body'), MAX_DOGS);
    this.dogLegF = inst(geo('dog_leg'), MAX_DOGS * 2);
    this.dogLegH = inst(geo('dog_hind'), MAX_DOGS * 2);
    this.dogTail = inst(geo('dog_tail'), MAX_DOGS);
    // pierwsze ustawienie koloru, żeby instanceColor istniał (ubłocone świnie)
    this.pigs.setColorAt(0, this.c.setHex(0xffffff));
  }

  /** Czy zwierzę może tu stanąć: pole bez budynku, nie woda i nie góra */
  private free(g: GameState, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
    const t = ty * g.map.width + tx;
    // na dziedziniec i do sal zamku zwierzęta nie wchodzą (pole w zamku bywa wolne dla ludzi)
    for (const k of this.keeps) if (x >= k[0] && x < k[1] && y >= k[2] && y < k[3]) return false;
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
    this.keeps = g.buildings.filter((b) => b.type === 0 && !b.ruined).map((b) => { const d = BUILDINGS[0]!; return [b.x, b.x + d.w, b.y, b.y + d.h]; });
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
    const henN = [0, 0, 0];
    const sleep = ctx.night > 0.55;
    for (const b of g.buildings) {
      if (b.build || b.ruined || b.door < 0) continue;
      const id = BUILDINGS[b.type]!.id;
      const house = id === 'house', farm = id === 'farm';
      const dx = (b.door % width) + 0.5, dy = Math.floor(b.door / width) + 0.5;
      // daleko od kamery zwierząt i tak nie widać: nie liczymy ich i nie rysujemy (stoją, aż kamera wróci)
      if (ctx.cam && Math.hypot(dx - ctx.cam.x, dy - ctx.cam.y) > 36 + ctx.cam.h * 0.4) continue;
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
          const v = (b.id * 3 + k * 7) % 5, kind = v < 2 ? 0 : v < 4 ? 1 : 2;
          this.hensBy[kind]!.setMatrixAt(henN[kind]!++, this.m);
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
        this.m.compose(this.v.set(...ANIMAL_AT.neck), this.q.setFromEuler(this.e.set(Math.max(-0.25, Math.min(1.25, graze)), 0, 0)), this.s.setScalar(1));
        this.horseNeck.setMatrixAt(horses, this.m.premultiply(body));
        this.m.compose(this.v.set(...ANIMAL_AT.tail), this.q.setFromEuler(this.e.set(0.35, 0, ctx.calm ? 0 : Math.sin(time * 2.3 + b.id) * 0.35)), this.s.setScalar(1));
        this.horseTail.setMatrixAt(horses, this.m.premultiply(body));
        horses++;
      }
    }
    // pies: jeden na gracza, przy twierdzy; chodzi za kimś z osady, nocą obszczekuje wilki
    let dogs = 0;
    for (const pl of g.players) {
      if (dogs >= MAX_DOGS || pl.defeated) continue;
      const keep = g.buildings.find((b) => b.owner === pl.id && b.type === 0 && !b.ruined);
      if (!keep) continue;
      // dom psa: przedpole przed bramą zamku (drzwi budynku zamku prowadzą do środka, tam pies nie chodzi)
      // dom z boku przedpola, nie na drodze do bramy
      const [fx, fy] = keepFront(keep);
      // na przedpolu, dwa pola w bok od osi bramy; gdy tam zajęte, druga strona albo dalej przed bramą
      const spots: [number, number][] = [[fx + 2.5, fy + 1.5], [fx - 1.5, fy + 1.5], [fx + 0.5, fy + 3.5]];
      const [kx, ky] = spots.find(([x, y]) => this.free(g, x, y)) ?? spots[0]!;
      let d = this.dogs.get(pl.id);
      if (!d) { d = { x: kx, y: ky, tx: kx, ty: ky, wait: 0, heading: 0, speed: 0, seen: 0, hx: kx, hy: ky, flee: 0, next: 0, master: 0, until: 0, bark: 0, run: 0, stuck: 0 }; this.dogs.set(pl.id, d); }
      d.hx = kx; d.hy = ky; d.seen = this.frame;
      if (!this.free(g, d.x, d.y)) { d.x = d.tx = kx; d.y = d.ty = ky; }   // zabłąkany w zamku albo w budynku: wraca przed bramę
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
          // pan wszedł do zamku albo budynku, albo pies utknął za przeszkodą: szuka innego
          if (!this.free(g, d.tx, d.ty) || d.stuck > 1.5) { d.master = 0; d.until = 0; d.stuck = 0; this.wander(g, d, 2.5); d.wait = 2 + rand() * 3; }
        } else d.wait -= dt;
        // obcy żołnierz w osadzie: szczeka z daleka
        if (time > d.bark) {
          const foe = g.soldiers.find((s) => g.players[s.owner]?.team !== pl.team && Math.abs(s.px / FP - d!.x) < 6 && Math.abs(s.py / FP - d!.y) < 6);
          if (foe) ctx.sound('bark', d.x, d.y);
          d.bark = time + (foe ? 0.8 + rand() : 3);
        }
      }
      const sp = this.walk(g, d, dt, speed, 2.5);
      // stoi, choć cel jest daleko = coś go blokuje
      d.stuck = sp < 0.05 && Math.hypot(d.tx - d.x, d.ty - d.y) > 0.6 ? d.stuck + dt : 0;
      d.run += (sp - d.run) * Math.min(1, dt * 6);
      const moving = d.run > 0.15;
      const ph = time * (6 + d.run * 3);
      const sit = !moving && !wolf;
      const y = ctx.height(d.x, d.y);
      // siedzi: zad nisko (pochylony do tyłu); w biegu podskakuje
      this.place(d.x - W2, y + (moving ? Math.abs(Math.sin(ph)) * 0.015 : 0) - (sit ? 0.02 : 0), d.y - H2, d.heading, sit ? -0.32 : 0, 0, 1);
      this.dogBody.setMatrixAt(dogs, this.m);
      const body = this.p.copy(this.m);
      ANIMAL_AT.dogHips.forEach(([hx, hy, hz], k) => {
        const diag = k === 0 || k === 3 ? 1 : -1;
        const ang = moving ? Math.sin(ph) * Math.min(0.7, 0.25 + d!.run * 0.2) * diag : sit && k >= 2 ? -1.2 : sit ? 0.32 : 0;
        this.m.compose(this.v.set(hx, hy, hz), this.q.setFromEuler(this.e.set(ang, 0, 0)), this.s.setScalar(1));
        (k < 2 ? this.dogLegF : this.dogLegH).setMatrixAt(dogs * 2 + (k & 1), this.m.premultiply(body));
      });
      // ogon w górze i merda (przy wilku sztywny)
      const wag = ctx.calm || wolf ? 0 : Math.sin(time * (moving ? 14 : 8)) * 0.5;
      this.m.compose(this.v.set(...ANIMAL_AT.dogTail), this.q.setFromEuler(this.e.set(wolf ? 2.1 : 2.5, 0, wag)), this.s.setScalar(1));
      this.dogTail.setMatrixAt(dogs, this.m.premultiply(body));
      dogs++;
    }
    // zwierzęta zniknęłych budynków: precz
    for (const [k, c] of this.hens) if (this.frame - c.seen > 120) this.hens.delete(k);
    for (const [k, c] of this.pigState) if (this.frame - c.seen > 120) this.pigState.delete(k);
    for (const [k, c] of this.dogs) if (this.frame - c.seen > 120) this.dogs.delete(k);
    const fin = (m: THREE.InstancedMesh, n: number): void => { m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    this.hensBy.forEach((m, k) => fin(m, henN[k]!)); fin(this.pigs, pigs);
    fin(this.horseBody, horses); fin(this.horseNeck, horses); fin(this.horseTail, horses);
    fin(this.dogBody, dogs); fin(this.dogLegF, dogs * 2); fin(this.dogLegH, dogs * 2); fin(this.dogTail, dogs);
  }
}

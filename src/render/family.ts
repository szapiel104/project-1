import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { clockAt, dayFraction } from '../sim/clock';
import { RULES } from '../data/rules';
import { FP, type GameState } from '../sim/state';
import { torchHour } from '../sim/systems/torches';
import { idle } from './motion';
import { Figures, familyId } from './peasants';
import { tint } from './loads';

/**
 * Rodziny przy chatach — tylko w wyglądzie (symulacja ich nie zna, gra przez sieć zostaje zgodna).
 * Przy każdej chacie gospodyni (w długiej sukni) i 0–2 dzieci, a obok chaty balia i sznur z praniem.
 * Za dnia gospodyni zajmuje się domem na zmianę: zamiata miotłą przed drzwiami, pierze w balii,
 * wiesza pranie, sypie ziarno kurom, odpoczywa. Dzieci (małe) gonią się, skaczą, kręcą się wokół matki.
 * Wieczorem gospodyni obchodzi pochodnie przy swojej chacie i budynkach w pobliżu i je zapala.
 * Nocą wszyscy w domu; na widok wilka albo wrogiego żołnierza uciekają do chaty.
 */

type Chore = 'sweep' | 'wash' | 'hang' | 'feed' | 'rest';
const CHORES: Chore[] = ['sweep', 'wash', 'hang', 'sweep', 'feed', 'wash', 'rest', 'hang'];

interface Member { x: number; y: number; tx: number; ty: number; wait: number; heading: number; seen: number; next: number }
/** Miejsca przy chacie: drzwi, balia, sznur z praniem (dwa słupki), kierunek „na zewnątrz” */
interface Yard { dx: number; dy: number; tub: [number, number] | null; line: [number, number, number, number] | null; fx: number; fy: number }

export interface FamilyCtx { time: number; dt: number; calm: boolean; height: (x: number, y: number) => number; fig: number; cam?: { x: number; y: number; h: number }; team: (owner: number) => number }

const MAX = 160;
const DRESS = [0x6a3a32, 0x4a4f6a, 0x5a5a3c, 0x6a5038, 0x3e4a3e, 0x7a4a5a];
const CLOTH = [0xe8e0cc, 0xd8cfb4, 0xb8c4c8, 0xc8a890, 0xe0d8c0, 0xa8b498];
const rand = (): number => Math.random();
const hashN = (a: number, b: number): number => { let h = (a * 2654435761 + b * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); return (h ^ (h >>> 12)) >>> 0; };

export class Family {
  private figs: Figures;
  private skirts: THREE.InstancedMesh;
  private brooms: THREE.InstancedMesh;
  private tubs: THREE.InstancedMesh;
  private lines: THREE.InstancedMesh;
  private cloths: THREE.InstancedMesh;
  private dust: THREE.InstancedMesh;
  private members = new Map<string, Member>();
  private yards = new Map<number, Yard>();
  private frame = 0;
  private t = new THREE.Object3D();
  private m = new THREE.Matrix4();
  private m2 = new THREE.Matrix4();
  private c = new THREE.Color();
  /** Która chata obsługuje pochodnię którego budynku (najbliższa w promieniu 12 pól), liczone co jakiś czas */
  private duty = new Map<number, number[]>();
  private dutyAt = -99;

  constructor(scene: THREE.Scene) {
    this.figs = new Figures(MAX, scene);
    const inst = (geo: THREE.BufferGeometry, max: number, mat: THREE.Material, shadow = true): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.count = 0; m.frustumCulled = false; m.castShadow = shadow; scene.add(m); return m;
    };
    const vc = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    // długa suknia z fartuchem: od pasa do ziemi zasłania nogi (postać z gry ma męską sylwetkę)
    const skirt = new THREE.LatheGeometry([[0.0, 0.0], [0.155, 0.0], [0.15, 0.06], [0.125, 0.2], [0.098, 0.31], [0.0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
    this.skirts = inst(skirt, MAX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    this.skirts.setColorAt(0, this.c.setHex(0xffffff));
    // miotła z witek: kij w dłoni, miotła przy ziemi (układ ręki: bark w początku, dłoń 0,185 niżej)
    this.brooms = inst(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.009, 0.009, 0.62, 5).translate(0, -0.2, 0.05).rotateX(0.35), 0x7a5a38),
      tint(new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, -0.5, 0.0).rotateX(0.35).translate(0, 0, 0.0), 0xc8a85a),
    ].map((g) => { g.deleteAttribute('uv'); return g; }))!, MAX, vc());
    // balia: niska drewniana kadź z obręczą i wodą
    this.tubs = inst(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.17, 0.14, 0.14, 12, 1, true).translate(0, 0.07, 0), 0x7a5a3a),
      tint(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 12).translate(0, 0.005, 0), 0x5a4028),
      tint(new THREE.TorusGeometry(0.165, 0.008, 4, 16).rotateX(Math.PI / 2).translate(0, 0.11, 0), 0x3a3a3a),
      tint(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 12).translate(0, 0.11, 0), 0x5a7a8a),
    ].map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }))!, 128, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    // sznur z praniem: dwa słupki 1,2 pola od siebie (wzdłuż osi x) i lina
    this.lines = inst(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 5).translate(-0.6, 0.31, 0), 0x6a4a2a),
      tint(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 5).translate(0.6, 0.31, 0), 0x6a4a2a),
      tint(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 3).rotateZ(Math.PI / 2).translate(0, 0.58, 0), 0xc8b890),
    ].map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }))!, 128, vc());
    // płachty prania na sznurze (wieszane od góry, kołyszą się na wietrze)
    this.cloths = inst(new THREE.PlaneGeometry(0.22, 0.26).translate(0, -0.13, 0), 512, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }));
    this.cloths.setColorAt(0, this.c.setHex(0xffffff));
    // kurz spod miotły
    this.dust = inst(new THREE.SphereGeometry(0.05, 6, 4), 256, new THREE.MeshBasicMaterial({ color: 0xb8a888, transparent: true, opacity: 0.35, depthWrite: false }), false);
  }

  view(p: THREE.Vector3): void { this.figs.view(p); }

  private free(g: GameState, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
    const t = ty * g.map.width + tx;
    return g.occupancy[t] === 0 && g.roads[t] === 0 && TERRAIN[g.map.tiles[t] as keyof typeof TERRAIN]!.walkable;
  }

  /** Podwórko chaty: balia z jednej strony drzwi, sznur z praniem z drugiej (tylko na wolnych polach) */
  private yard(g: GameState, h: GameState['buildings'][number]): Yard {
    let y = this.yards.get(h.id);
    if (y && this.frame % 300 !== h.id % 300) return y;
    const W = g.map.width, fp = footprint(BUILDINGS[h.type]!, h.rot);
    const dx = (h.door % W) + 0.5, dy = Math.floor(h.door / W) + 0.5;
    const cx = h.x + fp.w / 2, cy = h.y + fp.h / 2;
    let fx = dx - cx, fy = dy - cy; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const sx = -fy, sy = fx;
    const ok = (x: number, yy: number): boolean => this.free(g, x, yy);
    const tubAt: [number, number] = [dx + sx * 0.95 + fx * 0.25, dy + sy * 0.95 + fy * 0.25];
    const lc: [number, number] = [dx - sx * 1.3 + fx * 0.7, dy - sy * 1.3 + fy * 0.7];
    const la: [number, number, number, number] = [lc[0], lc[1], Math.atan2(sx, sy), 0];
    y = {
      dx, dy, fx, fy,
      tub: ok(...tubAt) ? tubAt : null,
      line: ok(lc[0] + sy * 0.6, lc[1] - sx * 0.6) && ok(lc[0] - sy * 0.6, lc[1] + sx * 0.6) && ok(lc[0], lc[1]) ? la : null,
    };
    this.yards.set(h.id, y);
    return y;
  }

  private walk(g: GameState, m: Member, dt: number, speed: number): number {
    const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
    if (d < 0.04) return 0;
    const st = Math.min(d, speed * dt), nx = m.x + (dx / d) * st, ny = m.y + (dy / d) * st;
    const free = (x: number, y: number): boolean => { const tx = Math.floor(x), ty = Math.floor(y); return tx >= 0 && ty >= 0 && tx < g.map.width && ty < g.map.height && g.occupancy[ty * g.map.width + tx] === 0; };
    if (free(nx, ny) || !free(m.x, m.y)) { m.x = nx; m.y = ny; }
    else if (free(nx, m.y)) m.x = nx;
    else if (free(m.x, ny)) m.y = ny;
    else { m.x = nx; m.y = ny; }
    this.face(m, Math.atan2(dx, dy), dt);
    return st / Math.max(dt, 1e-4);
  }

  private face(m: Member, want: number, dt: number): void {
    let a = want - m.heading;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    m.heading += a * Math.min(1, dt * 8);
  }

  sync(g: GameState, ctx: FamilyCtx): void {
    this.frame++;
    const dt = ctx.calm ? 0 : Math.min(0.1, ctx.dt), time = ctx.time;
    const { width, height } = g.map, W2 = width / 2, H2 = height / 2;
    const hour = clockAt(g.tick).hour;
    const home = hour >= 22 || hour < 5.5; // noc: wszyscy w domu
    const day = hour >= 6 && hour < 19.5;
    const tph = RULES.dayTicks * Math.max(0.001, dayFraction(Math.min(23.9, hour + 0.1)) - dayFraction(hour)) / 0.1;
    const houses = g.buildings.filter((b) => BUILDINGS[b.type]!.id === 'house' && !b.build && !b.ruined && b.door >= 0);
    if (time - this.dutyAt > 3) {
      this.dutyAt = time;
      this.duty.clear();
      for (const b of g.buildings) {
        if (b.door < 0 || b.ruined) continue;
        const bx = b.door % width, by = Math.floor(b.door / width);
        let best: typeof b | undefined, bd = 12 * 12;
        for (const h of houses) { if (h.owner !== b.owner) continue; const d = (h.door % width - bx) ** 2 + (Math.floor(h.door / width) - by) ** 2; if (d < bd) { bd = d; best = h; } }
        if (best) { const l = this.duty.get(best.id) ?? []; l.push(b.id); this.duty.set(best.id, l); }
      }
      for (const l of this.duty.values()) l.sort((a, b) => torchHour(a) - torchHour(b));
    }
    const byId = new Map(g.buildings.map((b) => [b.id, b] as const));
    let n = 0, sk = 0, br = 0, tb = 0, ln = 0, cl = 0, du = 0;
    const tm = this.t;
    const wind = Math.sin(time * 0.6) * 0.5 + 0.6;
    for (const h of houses) {
      if (n >= MAX) break;
      const yd = this.yard(g, h);
      const hx = yd.dx, hy = yd.dy;
      if (ctx.cam && Math.hypot(hx - ctx.cam.x, hy - ctx.cam.y) > 36 + ctx.cam.h * 0.4) continue;
      // podwórko: balia i sznur stoją zawsze, pranie wisi za dnia
      if (yd.tub && tb < 128) { this.m.makeRotationY(h.id).setPosition(yd.tub[0] - W2, ctx.height(yd.tub[0], yd.tub[1]), yd.tub[1] - H2); this.tubs.setMatrixAt(tb++, this.m); }
      if (yd.line && ln < 128) {
        const [lx, ly, rot] = yd.line;
        this.m.makeRotationY(rot - Math.PI / 2).setPosition(lx - W2, ctx.height(lx, ly), ly - H2);
        this.lines.setMatrixAt(ln++, this.m);
        if (day) for (let k = 0; k < 4 && cl < 512; k++) {
          const along = -0.45 + k * 0.3;
          const sway = Math.sin(time * 2.2 + k * 1.3 + h.id) * 0.35 * wind;
          this.m2.makeRotationX(sway).setPosition(along, 0.58, 0);
          this.cloths.setMatrixAt(cl, this.m2.premultiply(this.m));
          this.cloths.setColorAt(cl++, this.c.setHex(CLOTH[(h.id + k * 3) % CLOTH.length]!));
        }
      }
      const danger = g.wolves.some((w) => w.hp > 0 && Math.abs(w.px / FP - hx) < 9 && Math.abs(w.py / FP - hy) < 9)
        || g.soldiers.some((s) => g.players[s.owner]?.team !== g.players[h.owner]?.team && Math.abs(s.px / FP - hx) < 9 && Math.abs(s.py / FP - hy) < 9);
      if (home || danger) continue;
      const kids = h.id % 3;
      const team = ctx.team(h.owner);
      for (let k = 0; k <= kids && n < MAX; k++) {
        const woman = k === 0;
        const key = `${h.id}:${k}`;
        let m = this.members.get(key);
        if (!m) { m = { x: hx, y: hy, tx: hx, ty: hy, wait: rand() * 3, heading: rand() * 6.28, seen: 0, next: 0 }; this.members.set(key, m); }
        m.seen = this.frame;
        let swing = 0, arm: number | undefined, armL = -0.5, legs = false, sp = 0, lean = 0, broom = false, up = false, hop = 0;
        let lighting = false;
        if (woman && hour >= 19.5) {
          for (const id of this.duty.get(h.id) ?? []) {
            const b = byId.get(id);
            if (!b || b.lit) continue;
            const tx = (b.door % width) + 0.5, ty = Math.floor(b.door / width) + 0.5;
            const lead = (Math.hypot(tx - m.x, ty - m.y) / 1.4) * 10 / tph + 0.05;
            if (hour < torchHour(id) - lead) break;
            m.tx = tx; m.ty = ty; lighting = true;
            sp = this.walk(g, m, dt, 1.4);
            if (!sp) { arm = -2.6 + Math.sin(time * 6) * 0.08; armL = -0.3; }
            break;
          }
        }
        if (!lighting && woman) {
          // praca w domu: co kilkanaście sekund inna (stała dla chaty i chwili)
          const slot = Math.floor((time + h.id * 3.7) / 16);
          let chore: Chore = day ? CHORES[hashN(h.id, slot) % CHORES.length]! : 'rest';
          if (chore === 'wash' && !yd.tub) chore = 'sweep';
          if (chore === 'hang' && !yd.line) chore = 'sweep';
          // gdzie: przy drzwiach (zamiatanie, w drodze tam i z powrotem), przy balii, pod sznurem, obok domu (kury)
          let spot: [number, number] = [hx + yd.fx * 0.6, hy + yd.fy * 0.6];
          if (chore === 'wash' && yd.tub) spot = [yd.tub[0] - yd.fx * 0.05 + (yd.tub[0] - hx) * 0.0, yd.tub[1] + 0.0];
          if (chore === 'hang' && yd.line) spot = [yd.line[0] + yd.fx * 0.25, yd.line[1] + yd.fy * 0.25];
          if (chore === 'feed') spot = [hx + yd.fx * 1.2 - yd.fy * 0.6, hy + yd.fy * 1.2 + yd.fx * 0.6];
          if (chore === 'sweep') {
            // zamiata pas przed drzwiami: tam i z powrotem w bok
            const s = Math.sin(time * 0.35 + h.id) * 0.8;
            spot = [hx + yd.fx * 0.6 - yd.fy * s, hy + yd.fy * 0.6 + yd.fx * s];
          }
          m.tx = spot[0]; m.ty = spot[1];
          sp = this.walk(g, m, dt, chore === 'sweep' ? 0.35 : 0.8);
          const near = Math.hypot(m.tx - m.x, m.ty - m.y) < 0.3;
          if (near || chore === 'sweep') {
            const ph = time * 1.0 + h.id;
            if (chore === 'sweep') {
              // miotła w obu rękach, zamach w bok, kurz spod miotły
              broom = true; lean = 0.22;
              arm = -0.55 + Math.sin(ph * 4.2) * 0.32; armL = -0.75 - Math.sin(ph * 4.2) * 0.25;
              this.face(m, Math.atan2(-yd.fy, yd.fx) + Math.sin(ph * 4.2) * 0.35, dt);
              if (du < 256 && Math.sin(ph * 4.2) > 0.6) {
                const k2 = (time * 3 + h.id) % 1;
                this.m.makeScale(0.6 + k2 * 2, 0.5 + k2, 0.6 + k2 * 2).setPosition(m.x - W2 + Math.sin(m.heading) * 0.3, ctx.height(m.x, m.y) + 0.04 + k2 * 0.06, m.y - H2 + Math.cos(m.heading) * 0.3);
                this.dust.setMatrixAt(du++, this.m);
              }
            } else if (chore === 'wash' && yd.tub) {
              // pochylona nad balią, obie ręce trą pranie w wodzie
              this.face(m, Math.atan2(yd.tub[0] - m.x, yd.tub[1] - m.y), dt);
              lean = 0.55; arm = -1.15 + Math.sin(ph * 5.5) * 0.3; armL = -1.15 - Math.sin(ph * 5.5) * 0.3;
            } else if (chore === 'hang' && yd.line) {
              // wiesza pranie: ręce wysoko na sznurze, na zmianę
              this.face(m, Math.atan2(-yd.fx, -yd.fy), dt);
              arm = -2.6 + Math.max(0, Math.sin(ph * 2)) * 0.4; armL = -2.4 - Math.max(0, -Math.sin(ph * 2)) * 0.4;
            } else if (chore === 'feed') {
              // sypie ziarno kurom: zamach ręką od fartucha w bok
              arm = -0.9 - Math.max(0, Math.sin(ph * 3)) * 0.8; armL = -1.0; lean = 0.1;
            }
          }
          if (sp > 0.1 && chore !== 'sweep') { arm = undefined; armL = -0.5; }
        } else if (!lighting) {
          // dzieci: małe, biegają w kółko koło domu, gonią się (drugie goni pierwsze), czasem podskakują
          const evening = hour >= 19.5;
          if (m.wait > 0) { m.wait -= dt; if (!evening && Math.sin(time * 9 + k) > 0.2) hop = Math.abs(Math.sin(time * 9 + k)) * 0.06; }
          else {
            const ang = time * (0.9 + k * 0.15) + h.id + k * 2.1, r = evening ? 0.8 : 1.6 + Math.sin(time * 0.3 + k) * 0.6;
            if (k === 2 && !evening) { const o = this.members.get(`${h.id}:1`); if (o) { m.tx = o.x; m.ty = o.y; } }
            else { m.tx = hx + yd.fx * 1.4 + Math.cos(ang) * r; m.ty = hy + yd.fy * 1.4 + Math.sin(ang) * r; }
            sp = this.walk(g, m, dt, evening ? 0.8 : 1.8);
            if (Math.sin(time * 0.5 + k * 3 + h.id) > 0.85) m.wait = 1 + rand();
          }
          if (sp > 0.1) up = Math.sin(time * 0.4 + k) > 0.7; // biegnie z rękami w górze (zabawa)
        }
        if (sp > 0.1) { swing = Math.sin(time * (woman ? 8 : 14) + k) * (woman ? 0.45 : 0.75); legs = arm !== undefined; }
        const ia = !sp && arm === undefined && !hop && !ctx.calm ? idle(h.id * 3 + k, time) : undefined;
        const scale = woman ? 0.94 : 0.5 + (h.id % 2) * 0.05;
        const run = !woman && sp > 0.1 ? Math.abs(Math.sin(time * 14 + k)) * 0.03 : 0;
        tm.position.set(m.x - W2, ctx.height(m.x, m.y) + run + hop, m.y - H2);
        tm.rotation.set(lean, m.heading + (ia?.yaw ?? 0), ia?.roll ?? 0, 'YXZ');
        tm.scale.setScalar(ctx.fig * scale);
        tm.updateMatrix();
        const id = familyId(h.id * 3 + k, woman ? 'woman' : 'child');
        this.figs.set(n, tm.matrix, ia?.legs ? ia.legs : swing, up || !!ia?.up, team, id, arm ?? ia?.arm, arm !== undefined ? armL : (ia?.armL ?? -0.5), legs || !!ia?.legs);
        if (woman) {
          this.skirts.setMatrixAt(sk, tm.matrix);
          this.skirts.setColorAt(sk++, this.c.setHex(DRESS[h.id % DRESS.length]!));
          if (broom && br < MAX) {
            // miotła w prawej ręce, obraca się razem z ręką w barku
            this.m2.makeRotationX(arm ?? -0.5).setPosition(0.135, 0.45, 0);
            this.brooms.setMatrixAt(br++, this.m2.premultiply(tm.matrix));
          }
        }
        n++;
      }
    }
    this.figs.finish(n);
    const fin = (mesh: THREE.InstancedMesh, k: number): void => { mesh.count = k; mesh.visible = k > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
    fin(this.skirts, sk); fin(this.brooms, br); fin(this.tubs, tb); fin(this.lines, ln); fin(this.cloths, cl); fin(this.dust, du);
    for (const [k, mm] of this.members) if (this.frame - mm.seen > 600) this.members.delete(k);
  }
}

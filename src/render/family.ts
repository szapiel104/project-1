import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { clockAt, dayFraction } from '../sim/clock';
import { RULES } from '../data/rules';
import { FP, type GameState } from '../sim/state';
import { torchHour } from '../sim/systems/torches';
import { idle } from './motion';
import { Figures, familyId } from './peasants';

/**
 * Rodziny przy chatach — tylko w wyglądzie (symulacja ich nie zna, gra przez sieć zostaje zgodna).
 * Przy każdej chacie żona i 0–2 dzieci. Za dnia kobieta krząta się przy domu, dzieci biegają i gonią się.
 * Wieczorem kobieta obchodzi pochodnie przy swojej chacie i przy budynkach w pobliżu i je zapala
 * (pochodnia zapala się w symulacji o swojej godzinie, kobieta przychodzi na czas). Nocą wszyscy w domu;
 * na widok wilka albo wrogiego żołnierza uciekają do chaty.
 */

interface Member { x: number; y: number; tx: number; ty: number; wait: number; heading: number; seen: number; speed: number; next: number }

export interface FamilyCtx { time: number; dt: number; calm: boolean; height: (x: number, y: number) => number; fig: number; cam?: { x: number; y: number; h: number }; team: (owner: number) => number }

const MAX = 160;
const rand = (): number => Math.random();

export class Family {
  private figs: Figures;
  private members = new Map<string, Member>();
  private frame = 0;
  private t = new THREE.Object3D();
  /** Która chata obsługuje pochodnię którego budynku (najbliższa w promieniu 12 pól), liczone co jakiś czas */
  private duty = new Map<number, number[]>();
  private dutyAt = -99;

  constructor(scene: THREE.Scene) {
    this.figs = new Figures(MAX, scene);
  }

  view(p: THREE.Vector3): void { this.figs.view(p); }

  private free(g: GameState, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= g.map.width || ty >= g.map.height) return false;
    const t = ty * g.map.width + tx;
    return g.occupancy[t] === 0 && TERRAIN[g.map.tiles[t] as keyof typeof TERRAIN]!.walkable;
  }

  private walk(g: GameState, m: Member, dt: number, speed: number): number {
    const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
    if (d < 0.04) return 0;
    const st = Math.min(d, speed * dt), nx = m.x + (dx / d) * st, ny = m.y + (dy / d) * st;
    // przez budynki nie przechodzi: ślizga się po osi, a jak nie da rady — przenika (krótkie trasy przy domu)
    if (this.free(g, nx, ny) || !this.free(g, m.x, m.y)) { m.x = nx; m.y = ny; }
    else if (this.free(g, nx, m.y)) m.x = nx;
    else if (this.free(g, m.x, ny)) m.y = ny;
    else { m.x = nx; m.y = ny; }
    let a = Math.atan2(dx, dy) - m.heading;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    m.heading += a * Math.min(1, dt * 8);
    return st / Math.max(dt, 1e-4);
  }

  private wander(g: GameState, m: Member, hx: number, hy: number, r: number): void {
    for (let k = 0; k < 6; k++) {
      const a = rand() * Math.PI * 2, d = 0.4 + rand() * r, x = hx + Math.cos(a) * d, y = hy + Math.sin(a) * d;
      if (this.free(g, x, y)) { m.tx = x; m.ty = y; return; }
    }
    m.tx = hx; m.ty = hy;
  }

  sync(g: GameState, ctx: FamilyCtx): void {
    this.frame++;
    const dt = ctx.calm ? 0 : Math.min(0.1, ctx.dt), time = ctx.time;
    const { width, height } = g.map, W2 = width / 2, H2 = height / 2;
    const clock = clockAt(g.tick), hour = clock.hour;
    const home = hour >= 22 || hour < 5.5; // noc: wszyscy w domu
    // ile ticków trwa godzina o tej porze (doba płynie nierówno)
    const tph = RULES.dayTicks * Math.max(0.001, dayFraction(Math.min(23.9, hour + 0.1)) - dayFraction(hour)) / 0.1;
    const houses = g.buildings.filter((b) => BUILDINGS[b.type]!.id === 'house' && !b.build && !b.ruined && b.door >= 0);
    // przydział pochodni do chat (co kilka sekund)
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
    let n = 0;
    const tm = this.t;
    for (const h of houses) {
      if (n >= MAX) break;
      const hx = (h.door % width) + 0.5, hy = Math.floor(h.door / width) + 0.5;
      if (ctx.cam && Math.hypot(hx - ctx.cam.x, hy - ctx.cam.y) > 36 + ctx.cam.h * 0.4) continue;
      // niebezpieczeństwo w pobliżu: wilk albo wrogi żołnierz — wszyscy w chacie
      const danger = g.wolves.some((w) => w.hp > 0 && Math.abs(w.px / FP - hx) < 9 && Math.abs(w.py / FP - hy) < 9)
        || g.soldiers.some((s) => g.players[s.owner]?.team !== g.players[h.owner]?.team && Math.abs(s.px / FP - hx) < 9 && Math.abs(s.py / FP - hy) < 9);
      if (home || danger) continue;
      const kids = h.id % 3;
      const team = ctx.team(h.owner);
      for (let k = 0; k <= kids && n < MAX; k++) {
        const woman = k === 0;
        const key = `${h.id}:${k}`;
        let m = this.members.get(key);
        if (!m) { m = { x: hx, y: hy, tx: hx, ty: hy, wait: rand() * 3, heading: rand() * 6.28, seen: 0, speed: 0, next: 0 }; this.members.set(key, m); }
        m.seen = this.frame;
        let swing = 0, arm: number | undefined, armL = -0.5, legs = false, sp = 0;
        // wieczorem kobieta zapala pochodnie: do następnej niezapalonej, żeby zdążyć na jej godzinę
        let lighting = false;
        if (woman && hour >= 19.5) {
          for (const id of this.duty.get(h.id) ?? []) {
            const b = byId.get(id);
            if (!b || b.lit) continue;
            const tx = (b.door % width) + 0.5, ty = Math.floor(b.door / width) + 0.5;
            const lead = (Math.hypot(tx - m.x, ty - m.y) / 1.4) * 10 / tph + 0.05; // ile godzin gry zajmie dojście
            if (hour < torchHour(id) - lead) break; // jeszcze za wcześnie na następną
            m.tx = tx; m.ty = ty; lighting = true;
            sp = this.walk(g, m, dt, 1.4);
            // na miejscu: unosi rękę z łuczywem do pochodni
            if (!sp) { arm = -2.6 + Math.sin(time * 6) * 0.08; armL = -0.3; }
            break;
          }
        }
        if (!lighting) {
          // dzień: kobieta krząta się przy domu, dzieci biegają (młodsze gonią starsze); wieczór: przy drzwiach
          const evening = hour >= 19.5;
          const r = woman ? 1.6 : evening ? 1.2 : 3;
          if (m.wait > 0) m.wait -= dt;
          else {
            if (!woman && k === 2 && !evening) {
              // berek: drugie dziecko goni pierwsze
              const other = this.members.get(`${h.id}:1`);
              if (other) { m.tx = other.x; m.ty = other.y; }
            }
            const speed = woman ? 0.7 : evening ? 0.8 : 1.5;
            sp = this.walk(g, m, dt, speed);
            if (!sp) { m.wait = woman ? 2 + rand() * 4 : 0.5 + rand() * 2; this.wander(g, m, hx, hy, r); }
          }
          if (!sp && woman && time > m.next) {
            // przy pracy: zamiata albo coś robi rękami
            if (Math.sin(time * 0.7 + h.id) > 0.3) { arm = -0.6 + Math.sin(time * 5 + h.id) * 0.35; armL = -0.6 - Math.sin(time * 5 + h.id) * 0.35; }
          }
        }
        if (sp > 0.1) { swing = Math.sin(time * (woman ? 8 : 12) + k) * (woman ? 0.5 : 0.7); legs = arm !== undefined; }
        const ia = !sp && arm === undefined && !ctx.calm ? idle(h.id * 3 + k, time) : undefined;
        const kidScale = woman ? 0.96 : 0.62 + (h.id % 2) * 0.06;
        tm.position.set(m.x - W2, ctx.height(m.x, m.y) + (sp > 0.1 && !woman ? Math.abs(Math.sin(time * 12 + k)) * 0.03 : 0), m.y - H2);
        tm.rotation.set(0, m.heading + (ia?.yaw ?? 0), ia?.roll ?? 0, 'YXZ');
        tm.scale.setScalar(ctx.fig * kidScale);
        tm.updateMatrix();
        const id = familyId(h.id * 3 + k, woman ? 'woman' : 'child');
        this.figs.set(n, tm.matrix, ia?.legs ? ia.legs : swing, !!ia?.up, team, id, arm ?? ia?.arm, arm !== undefined ? armL : (ia?.armL ?? -0.5), legs || !!ia?.legs);
        n++;
      }
    }
    this.figs.finish(n);
    for (const [k, m] of this.members) if (this.frame - m.seen > 600) this.members.delete(k);
  }
}

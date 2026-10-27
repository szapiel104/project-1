/**
 * Kruki na ciałach poległych (wyniesione z scene.ts, 23.10.2026): przylatują chwilę po śmierci, dziobią i podskakują,
 * a gdy ktoś podejdzie, zrywają się i krążą nad ciałem. Po kilkudziesięciu sekundach odlatują w siną dal
 * (Michał 27.10.2026: nie mają siedzieć nad ciałem bez końca). Garść na całe pobojowisko (najwyżej 18 na mapę).
 * Ciała na wieżach i murach kruki omijają.
 */
/** Sekundy od śmierci: przylot, odlot (koniec siedzenia) i zniknięcie */
const ARRIVE = 15, LAND = 19, LEAVE = 50, GONE = 57;
import * as THREE from 'three';
import { FP, type GameState } from '../sim/state';
import { cat } from './cat';
import { crowParts } from './creatures';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class CrowLayer {
  private time = 0;
  private calm = false;
  private tmp = new THREE.Object3D();
  /** Ułamek bieżącego ticku (płynny lot między tickami symulacji, 10 na sekundę) */
  private lastTick = -1;
  private tickAt = 0;
  constructor(private scene: THREE.Scene) {}

  private crows: THREE.InstancedMesh | null = null;
  /** Kruki w locie: jedna siatka na klatkę machania skrzydłami (model CC0 z animacją lotu) */
  private crowFly: THREE.InstancedMesh[] = [];
  /** Kruki na ciałach poległych: dziobią, podskakują; gdy ktoś podejdzie, zrywają się i krążą nad ciałem, aż odejdzie */
  sync(g: GameState, view: TerrainView, ctx: { time: number; calm: boolean }): void {
    this.time = ctx.time; this.calm = ctx.calm;
    if (!this.crows) {
      const c = crowParts();
      this.crows = new THREE.InstancedMesh(c.stand, c.mat, 256);
      this.crows.frustumCulled = false; this.crows.castShadow = true;
      this.scene.add(this.crows);
      this.crowFly = c.fly.map((geo) => { const m = new THREE.InstancedMesh(geo, c.mat, 128); m.frustumCulled = false; m.castShadow = true; m.count = 0; this.scene.add(cat(m, 'kruki')); return m; });
    }
    const { width, height } = g.map;
    if (g.tick !== this.lastTick) { this.lastTick = g.tick; this.tickAt = this.time; }
    const frac = this.calm ? 0 : Math.min(1, (this.time - this.tickAt) * 10);
    const ageOf = (at: number): number => (g.tick - at + frac) / 10;
    const t = this.tmp;
    const F = this.crowFly.length;
    const flyN = new Array<number>(F).fill(0);
    let n = 0, total = 0;
    // Kruków ma być garść na całe pobojowisko, nie 1–3 na każde ciało: ciała liczymy w polach 10×10,
    // pole dostaje 2 kruki + 1 na każde kolejne 8 ciał (najwyżej 6), a na całą mapę najwyżej 18.
    const CELL = 10 * FP;
    const bodies = new Map<number, number>();
    const visit = (body: GameState['corpses'][number]): boolean => !body.taken && !body.post && ageOf(body.at) >= ARRIVE && ageOf(body.at) < GONE;
    for (const body of g.corpses) {
      if (!visit(body)) continue;
      const key = Math.floor(body.px / CELL) * 4096 + Math.floor(body.py / CELL);
      bodies.set(key, (bodies.get(key) ?? 0) + 1);
    }
    const used = new Map<number, number>();
    for (const body of g.corpses) {
      if (total >= 18) break;
      if (!visit(body)) continue; // przylatują chwilę po śmierci, po chwili odlatują
      const key = Math.floor(body.px / CELL) * 4096 + Math.floor(body.py / CELL);
      const budget = Math.min(6, 2 + Math.floor(((bodies.get(key) ?? 1) - 1) / 8));
      const had = used.get(key) ?? 0;
      if (had >= budget) continue;
      // nie każde ciało ma kruka: przy większej liczbie ciał w polu tylko co któreś (stałe dla danego ciała)
      if ((bodies.get(key) ?? 1) > 3 && (body.id * 2654435761 >>> 0) % 3 !== 0) continue;
      const count = Math.min(1 + (body.id % 2), budget - had, 18 - total);
      used.set(key, had + count);
      total += count;
      const near = g.units.some((u) => Math.abs(u.px - body.px) < 2.5 * FP && Math.abs(u.py - body.py) < 2.5 * FP)
        || g.soldiers.some((s) => Math.abs(s.px - body.px) < 2.5 * FP && Math.abs(s.py - body.py) < 2.5 * FP);
      const bx = body.px / FP, by = body.py / FP;
      const age = ageOf(body.at);
      for (let i = 0; i < count; i++) {
        // przylot i odlot: z daleka, z góry, po łuku; kierunek stały dla danego ciała
        if (age < LAND || age >= LEAVE) {
          const dir = body.id * 2.399 + i * 0.5;
          const k = age < LAND ? 1 - (age - ARRIVE) / (LAND - ARRIVE) : (age - LEAVE) / (GONE - LEAVE); // 0 = przy ciele, 1 = daleko
          const e = k * k;
          const dist = e * 28, up = 0.5 + e * 9 + Math.sin(k * Math.PI) * 1.2;
          const x = bx + Math.cos(dir) * dist + Math.cos(dir + 1.57) * 0.35 * i, y = by + Math.sin(dir) * dist + Math.sin(dir + 1.57) * 0.35 * i;
          t.position.set(x - width / 2, view.heightAt(bx, by) + up + i * 0.2, y - height / 2);
          // dziobem w stronę lotu: przylot do ciała, odlot od ciała
          const away = age >= LEAVE;
          t.rotation.set(away ? -0.25 : 0.2, Math.atan2(away ? Math.cos(dir) : -Math.cos(dir), away ? Math.sin(dir) : -Math.sin(dir)), 0, 'YXZ');
          t.scale.setScalar(1.1);
          t.updateMatrix();
          const f = Math.floor(((this.calm ? 0 : this.time) * 10 + i * 2.7 + body.id) % F);
          const mesh = this.crowFly[f]!;
          if (flyN[f]! < 128) mesh.setMatrixAt(flyN[f]!++, t.matrix);
          continue;
        }
        if (near) {
          // spłoszone: krążą nad ciałem na różnych wysokościach, machając skrzydłami
          const ang = (this.calm ? 0 : this.time) * (0.9 + i * 0.15) + body.id + i * 2.1;
          const r = 1.1 + i * 0.35;
          const x = bx + Math.cos(ang) * r, y = by + Math.sin(ang) * r;
          t.position.set(x - width / 2, view.heightAt(bx, by) + 1.6 + i * 0.35 + Math.sin(ang * 2) * 0.12, y - height / 2);
          // leci po okręgu (stycznie), lekko przechylony do środka zakrętu
          t.rotation.set(0, Math.atan2(-Math.sin(ang), Math.cos(ang)), -0.35, 'YXZ');
          t.scale.setScalar(1.1);
          t.updateMatrix();
          const f = Math.floor(((this.calm ? 0 : this.time) * 9 + i * 2.7 + body.id) % F);
          const mesh = this.crowFly[f]!;
          if (flyN[f]! < 128) mesh.setMatrixAt(flyN[f]!++, t.matrix);
          continue;
        }
        const a = body.id * 1.7 + i * 2.3, r = 0.28 + (i % 2) * 0.12;
        const k = this.calm ? 0 : this.time * 3 + body.id + i * 1.9;
        const hop = Math.max(0, Math.sin(k * 0.7)) > 0.97 ? 0.05 : 0;
        const x = bx + Math.cos(a) * r, y = by + Math.sin(a) * r;
        t.position.set(x - width / 2, view.heightAt(x, y) + hop, y - height / 2);
        // dziobanie: tułów pochyla się do ciała (przód modelu w +z)
        t.rotation.set(Math.max(0, Math.sin(k * 2.3)) * 0.5, Math.atan2(-Math.cos(a), -Math.sin(a)), 0, 'YXZ');
        t.scale.setScalar(1);
        t.updateMatrix();
        this.crows.setMatrixAt(n++, t.matrix);
      }
    }
    this.crows.count = n;
    touch(this.crows);
    this.crowFly.forEach((m, f) => { m.count = flyN[f]!; m.visible = m.count > 0; touch(m); });
  }
}

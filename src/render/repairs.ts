/**
 * Rusztowania przy naprawie (27.10.2026). Gdy inżynier z cechu przychodzi łatać rozbity mur, wieżę, bramę albo
 * budynek, przy ścianie wyrasta rusztowanie: najpierw słupy, potem poprzeczki, na końcu pomost z desek.
 * Stoi, dopóki ekipa ma przy nim robotę (także gdy ktoś poszedł po kamień), a po naprawie jest rozbierane.
 * Pęknięcia (damage.ts) znikają w tym czasie same, bo idą za wytrzymałością.
 *
 * Mur i częstokół: rusztowanie po jednej stronie odcinka — tej, po której stoi inżynier. Wieże, bramy i małe
 * budynki: dookoła. Duże budowle (twierdza): odcinek trzech pól przy ścianie, którą łata inżynier.
 * Jedna wspólna siatka instancji, przeliczana tylko przy zmianie (i kilka razy na sekundę, gdy rośnie lub znika).
 */
import * as THREE from 'three';
import { BUILDINGS, footprint } from '../data/buildings';
import { FP, Phase, type GameState } from '../sim/state';
import { maxHp } from '../sim/systems/placement';
import { STONE_WALL_TOP } from './buildings';
import { cat } from './cat';
import type { TerrainView } from './terrain';
import { pattern } from './textures';
import { touch } from './touch';

const MAX = 5000;
const UP = 2.2, DOWN = 1.8;

interface Rig {
  /** od kiedy rośnie; po rozbiórce w trakcie — od kiedy znowu rośnie */
  up: number;
  /** od kiedy jest rozbierane */
  down?: number;
  /** strona, po której stoi inżynier (kierunek od środka budowli) */
  sx: number; sz: number;
  /** postęp w chwili, gdy zaczęła się rozbiórka (żeby nie przeskakiwało) */
  at: number;
}

export class RepairLayer {
  constructor(private layer: THREE.Object3D) {}
  invalidate(): void { this.rigs.clear(); this.key = '-'; this.tops.clear(); }

  private rigs = new Map<number, Rig>();
  private tops = new Map<number, number>();
  private key = '';
  private beams: THREE.InstancedMesh | null = null;

  private progress(r: Rig, time: number): number {
    const up = Math.min(1, (time - r.up) / UP);
    return r.down === undefined ? up : Math.max(0, r.at * (1 - (time - r.down) / DOWN));
  }

  sync(g: GameState, view: TerrainView, meshes: Map<number, THREE.Group>, time: number, calm: boolean): void {
    const working = new Map<number, GameState['units'][number]>();
    const crew = new Set<number>();
    for (const u of g.units) {
      if (u.phase === Phase.Repairing) { if (!working.has(u.target)) working.set(u.target, u); crew.add(u.target); }
      else if (u.phase === Phase.ToRepair || u.phase === Phase.ToFetch) crew.add(u.target);
    }
    const byId = new Map<number, GameState['buildings'][number]>();
    for (const b of g.buildings) byId.set(b.id, b);
    const needs = (b: GameState['buildings'][number] | undefined): boolean => !!b && !b.build && !b.ruined && b.hp < maxHp(b.type);
    // nowe naprawy: rusztowanie stawiane, gdy inżynier zaczyna stukać
    for (const [id, u] of working) {
      const b = byId.get(id);
      if (!needs(b)) continue;
      const r = this.rigs.get(id);
      if (!r) {
        const fp = footprint(BUILDINGS[b!.type]!, b!.rot);
        this.rigs.set(id, { up: calm ? time - UP : time, sx: u.px / FP - (b!.x + fp.w / 2), sz: u.py / FP - (b!.y + fp.h / 2), at: 0 });
      } else if (r.down !== undefined) {
        // wrócili do roboty w trakcie rozbiórki: rośnie dalej od tego, co zostało
        const e = this.progress(r, time);
        r.down = undefined; r.up = time - e * UP;
      }
    }
    for (const [id, r] of this.rigs) {
      const b = byId.get(id);
      if (r.down === undefined && !(needs(b) && crew.has(id))) { r.at = this.progress(r, time); r.down = calm ? time - DOWN : time; }
      if (!b || (r.down !== undefined && time - r.down >= DOWN)) this.rigs.delete(id);
    }
    let key = '';
    for (const [id, r] of this.rigs) key += `${id}:${Math.round(this.progress(r, time) * 14)},`;
    if (key === this.key) return;
    this.key = key;
    if (!this.beams) {
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95, map: pattern('planks') });
      this.beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wood, MAX);
      this.beams.castShadow = true; this.beams.receiveShadow = true; this.beams.frustumCulled = false;
      this.layer.add(cat(this.beams, 'naprawy (rusztowania)'));
    }
    const { width, height } = g.map;
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    let n = 0;
    const ground = (x: number, z: number): number => view.heightAt(x + width / 2, z + height / 2) - 0.03;
    /** belka od punktu a do b (słup, poprzeczka, zastrzał) */
    const beam = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number): void => {
      if (n >= MAX) return;
      d.set(bx - ax, by - ay, bz - az);
      const L = d.length();
      if (L < 0.01) return;
      q.setFromUnitVectors(Y, d.divideScalar(L));
      this.beams!.setMatrixAt(n++, M4.compose(p.set(ax, ay, az), q, sc.set(t, L, t)));
    };
    /** deska pomostu wzdłuż odcinka */
    const plank = (x: number, y: number, z: number, len: number, w: number, rotY: number): void => {
      if (n >= MAX) return;
      q.setFromAxisAngle(Y, rotY);
      this.beams!.setMatrixAt(n++, M4.compose(p.set(x, y, z), q, sc.set(len, 0.035, w)));
    };
    /**
     * Jedna ściana rusztowania wzdłuż odcinka A→B, odsunięta od lica w stronę (nx, nz):
     * dwa rzędy słupów, poprzeczki co 0,45, pomost na ok. 55% wysokości (wyższe dostają drugi pod szczytem), zastrzał.
     */
    const side = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, base: number, H: number, e: number, seed: number): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const posts = Math.max(1, Math.round(len / 0.8));
      const postH = H * Math.min(1, e / 0.55);
      const rows = [0.06, 0.34];
      const rotY = Math.atan2(-(bz - az), bx - ax);
      for (const off of rows) {
        const ox = nx * off, oz = nz * off;
        for (let i = 0; i <= posts; i++) {
          const t = i / posts, x = ax + (bx - ax) * t + ox, z = az + (bz - az) * t + oz;
          const y = ground(x, z);
          // słupy stają po kolei, nie wszystkie naraz
          const k = Math.min(1, Math.max(0, (e * 1.8 - t * 0.6)));
          if (k > 0.02) beam(x, y, z, x, y + postH * k, z, 0.045);
        }
        if (e < 0.35) continue;
        for (let ly = 0.45; ly < postH - 0.05; ly += 0.45) beam(ax + ox, base + ly, az + oz, bx + ox, base + ly, bz + oz, 0.03);
      }
      if (e < 0.6) return;
      // poprzeczki łączące oba rzędy i pomost z desek
      const decks = H > 2.4 ? [0.55, 0.88] : [0.55];
      for (const f of decks) {
        const dy = base + H * f;
        if (dy > base + postH) continue;
        for (let i = 0; i <= posts; i++) {
          const t = i / posts, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          beam(x + nx * rows[0]!, dy - 0.02, z + nz * rows[0]!, x + nx * rows[1]!, dy - 0.02, z + nz * rows[1]!, 0.03);
        }
        if (e < 0.8) continue;
        const mx = (ax + bx) / 2 + nx * 0.2, mz = (az + bz) / 2 + nz * 0.2;
        plank(mx, dy, mz, len + 0.12, 0.3, rotY);
      }
      if (e >= 0.95) {
        // ukośny zastrzał na zewnętrznym rzędzie (raz w lewo, raz w prawo)
        const o = rows[1]!, flip = seed % 2 ? 1 : 0;
        const [sx, sz, ex, ez] = flip ? [bx, bz, ax, az] : [ax, az, bx, bz];
        beam(sx + nx * o, ground(sx + nx * o, sz + nz * o), sz + nz * o, ex + nx * o, base + postH * 0.95, ez + nz * o, 0.028);
      }
    };
    for (const [id, r] of this.rigs) {
      const b = byId.get(id)!;
      const e = this.progress(r, time);
      if (e <= 0.01) continue;
      const def = BUILDINGS[b.type]!, fp = footprint(def, b.rot);
      const mesh = meshes.get(id);
      const base = mesh ? mesh.position.y : ground(b.x + 0.5 - width / 2, b.y + 0.5 - height / 2);
      if (def.line) {
        // odcinek muru: rusztowanie po stronie inżyniera, wzdłuż muru
        const wallAt = (x: number, y: number): boolean => g.buildings.some((o) => o.x === x && o.y === y && (BUILDINGS[o.type]!.line || BUILDINGS[o.type]!.gate));
        const alongX = wallAt(b.x - 1, b.y) || wallAt(b.x + 1, b.y) || !(wallAt(b.x, b.y - 1) || wallAt(b.x, b.y + 1));
        const stone = def.id === 'stoneWall';
        const face = stone ? 0.52 : 0.16, H = stone ? STONE_WALL_TOP + 0.12 : 1.1;
        const cx = b.x + 0.5 - width / 2, cz = b.y + 0.5 - height / 2;
        if (alongX) { const s = r.sz >= 0 ? 1 : -1; side(cx - 0.5, cz + s * face, cx + 0.5, cz + s * face, 0, s, base, H, e, id); }
        else { const s = r.sx >= 0 ? 1 : -1; side(cx + s * face, cz - 0.5, cx + s * face, cz + 0.5, s, 0, base, H, e, id); }
        continue;
      }
      const H = this.topOf(id, mesh) * 0.92;
      const x0 = b.x - width / 2 - 0.1, z0 = b.y - height / 2 - 0.1, x1 = x0 + fp.w + 0.2, z1 = z0 + fp.h + 0.2;
      if (Math.max(fp.w, fp.h) <= 3) {
        side(x0, z1, x1, z1, 0, 1, base, H, e, id); side(x1, z0, x0, z0, 0, -1, base, H, e, id + 1);
        side(x1, z1, x1, z0, 1, 0, base, H, e, id + 2); side(x0, z0, x0, z1, -1, 0, base, H, e, id + 3);
        continue;
      }
      // duża budowla: trzy pola rusztowania przy ścianie, którą łata inżynier
      const ux = b.x + fp.w / 2 + r.sx, uz = b.y + fp.h / 2 + r.sz;
      const onX = Math.abs(r.sx) / fp.w > Math.abs(r.sz) / fp.h;
      if (onX) {
        const s = r.sx >= 0 ? 1 : -1, fx = s > 0 ? x1 : x0;
        const m = Math.min(Math.max(uz - height / 2, z0 + 1.5), z1 - 1.5);
        side(fx, m - 1.5, fx, m + 1.5, s, 0, base, Math.min(H, 3.2), e, id);
      } else {
        const s = r.sz >= 0 ? 1 : -1, fz = s > 0 ? z1 : z0;
        const m = Math.min(Math.max(ux - width / 2, x0 + 1.5), x1 - 1.5);
        side(m - 1.5, fz, m + 1.5, fz, 0, s, base, Math.min(H, 3.2), e, id);
      }
    }
    this.beams.count = n;
    touch(this.beams);
  }

  /** Wysokość budowli nad podstawą (liczona raz na budynek) */
  private topOf(id: number, mesh: THREE.Group | undefined): number {
    const t = this.tops.get(id);
    if (t !== undefined) return t;
    let h = 1.5;
    if (mesh) {
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3();
      mesh.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && me.visible && !(me as unknown as THREE.InstancedMesh).isInstancedMesh && me.name !== 'fire') box.expandByObject(me); });
      if (!box.isEmpty()) h = Math.max(0.8, Math.min(6, box.max.y - mesh.position.y));
    }
    this.tops.set(id, h);
    return h;
  }
}

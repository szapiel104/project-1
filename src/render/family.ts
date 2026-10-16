import * as THREE from 'three';
import { cat } from './cat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, NO_TORCH, footprint } from '../data/buildings';
import { Terrain, TERRAIN } from '../data/terrain';
import { clockAt, dayFraction } from '../sim/clock';
import { RULES } from '../data/rules';
import { FP, type GameState } from '../sim/state';
import { torchHour } from '../sim/systems/torches';
import { clutterTaken } from './clutter';
import { idle } from './motion';
import { Figures, modelGeo, type ModelMesh } from './peasants';
import { tint } from './loads';
import { grayPattern, normal, pattern } from './textures';
import YARD from './models/yard.json';

/**
 * Rodziny przy chatach — tylko w wyglądzie (symulacja ich nie zna, gra przez sieć zostaje zgodna).
 * Przy każdej chacie gospodyni (w długiej sukni) i 0–2 dzieci. Każda chata ma własne podwórko: z siedmiu rzeczy
 * (balia, sznur z praniem, stos polan z pniakiem, ława, kosz z praniem, wiadro, grządka) losuje 2–4 i stawia je
 * przy ścianach, na wolnych polach tuż przy chacie (gdzie nie stoją graty z clutter.ts). Pranie też co chata inne.
 * Modele z Blendera (tools/models/yard.py) z teksturami desek, płótna i ziemi.
 * Za dnia gospodyni zajmuje się tym, co ma przy chacie: zamiata przed drzwiami, pierze w balii, wiesza pranie,
 * pieli grządkę, układa polana, sypie ziarno kurom, siada na ławie. Dzieci (małe) gonią się, skaczą.
 * Wieczorem gospodyni obchodzi pochodnie przy swojej chacie i budynkach w pobliżu i je zapala.
 * Nocą wszyscy w domu; na widok wilka albo wrogiego żołnierza uciekają do chaty.
 */

type Prop = 'tub' | 'line' | 'woodpile' | 'bench' | 'basket' | 'bucket' | 'garden';
const PROPS: Prop[] = ['tub', 'line', 'woodpile', 'bench', 'basket', 'bucket', 'garden'];
type Chore = 'sweep' | 'wash' | 'hang' | 'feed' | 'weed' | 'stack' | 'sit';
/** Która praca przy której rzeczy z podwórka */
const NEEDS: Partial<Record<Chore, Prop>> = { wash: 'tub', hang: 'line', weed: 'garden', stack: 'woodpile', sit: 'bench' };
const CLOTHS = ['cloth_shirt', 'cloth_sheet', 'cloth_small', 'cloth_pants'] as const;
/** Szerokość płachty prania wzdłuż sznura */
const CLOTH_W = [0.2, 0.28, 0.11, 0.13];

interface Member { x: number; y: number; tx: number; ty: number; wait: number; heading: number; seen: number }
interface Placed { prop: Prop; x: number; y: number; yaw: number; ox: number; oy: number }
/** Podwórko chaty: drzwi, kierunek „na zewnątrz” od drzwi i rozstawione rzeczy */
interface Yard { dx: number; dy: number; fx: number; fy: number; props: Placed[]; cloth: { kind: number; at: number; color: number }[]; key: string }

export interface FamilyCtx { time: number; dt: number; calm: boolean; height: (x: number, y: number) => number; fig: number; cam?: { x: number; y: number; h: number }; team: (owner: number) => number }

const MAX = 160;
const CLOTH = [0xe8e0cc, 0xd8cfb4, 0xb8c4c8, 0xc8a890, 0xe0d8c0, 0xa8b498, 0x9a4a3a, 0x6a7a8a, 0xb89a5a];
const rand = (): number => Math.random();
const hashN = (a: number, b: number): number => { let h = (a * 2654435761 + b * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); return (h ^ (h >>> 12)) >>> 0; };
const Y = YARD as unknown as Record<string, ModelMesh[]> & { post_top: number };

/** Współrzędne tekstury z rzutu na płaszczyznę, do której ściana jest najbardziej zwrócona (deski, płótno, ziemia) */
function boxUv(geo: THREE.BufferGeometry, scale: number): THREE.BufferGeometry {
  const p = geo.attributes.position!, n = geo.attributes.normal!;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

let yardMats: Record<string, [THREE.Material, number]> | null = null;
/** Materiały podwórka: deski, płótno, ziemia (tekstury zdjęciowe) i gładkie; liczba = skala tekstury */
function yardMaterials(): Record<string, [THREE.Material, number]> {
  if (yardMats) return yardMats;
  const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks'), normalMap: normal('planks') });
  const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: grayPattern('burlap'), normalMap: normal('burlap'), side: THREE.DoubleSide });
  const soil = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('soil'), normalMap: normal('soil') });
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  return (yardMats = { wood: [wood, 6], cloth: [cloth, 8], soil: [soil, 3], plain: [plain, 1] });
}
/** Nazwy przedmiotów podwórka z yard.json (do podglądu modeli) */
export const YARD_KEYS = ['tub', 'post', 'woodpile', 'bench', 'basket', 'bucket', 'garden', ...CLOTHS];
/** Jeden przedmiot podwórka jako zwykła grupa siatek (podgląd modeli) */
export function yardModel(key: string): THREE.Group {
  const g = new THREE.Group(), MAT = yardMaterials();
  for (const part of Y[key] ?? []) {
    const [mat, scale] = MAT[part.mat] ?? MAT.plain!;
    g.add(new THREE.Mesh(boxUv(modelGeo(part), scale), mat));
  }
  return g;
}

export class Family {
  /** Gospodynie i dzieci: osobne modele z Blendera (tools/models/woman.py, child.py) */
  private women: Figures;
  private kids: Figures;
  private brooms: THREE.InstancedMesh;
  /** Rzeczy z podwórka: [rodzaj] → siatki po materiale (deski, płótno, ziemia, gładkie) */
  private props = new Map<string, THREE.InstancedMesh[]>();
  private rope: THREE.InstancedMesh;
  private dust: THREE.InstancedMesh;
  private members = new Map<string, Member>();
  private yards = new Map<number, Yard>();
  private frame = 0;
  private t = new THREE.Object3D();
  private m = new THREE.Matrix4();
  private m2 = new THREE.Matrix4();
  private c = new THREE.Color();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q = new THREE.Quaternion();
  /** Która chata obsługuje pochodnię którego budynku (najbliższa w promieniu 12 pól), liczone co jakiś czas */
  private duty = new Map<number, number[]>();
  private dutyAt = -99;

  constructor(scene: THREE.Scene) {
    this.women = new Figures(MAX, scene, 'woman');
    this.kids = new Figures(MAX, scene, 'child');
    const inst = (geo: THREE.BufferGeometry, max: number, mat: THREE.Material, shadow = true): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; scene.add(cat(m, 'rodziny i podwórka')); return m;
    };
    // długa suknia z fartuchem: od pasa do ziemi zasłania nogi (postać z gry ma męską sylwetkę)
    // miotła z witek: kij w dłoni, miotła przy ziemi (układ ręki: bark w początku, dłoń 0,185 niżej)
    this.brooms = inst(mergeGeometries([
      tint(new THREE.CylinderGeometry(0.009, 0.009, 0.62, 5).translate(0, -0.2, 0.05).rotateX(0.35), 0x7a5a38),
      tint(new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, -0.5, 0.0).rotateX(0.35), 0xc8a85a),
    ].map((g) => { g.deleteAttribute('uv'); return g; }))!, MAX, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const MAT = yardMaterials();
    const cloth = MAT.cloth![0];
    for (const key of [...PROPS.filter((p) => p !== 'line'), 'post', ...CLOTHS]) {
      const list: THREE.InstancedMesh[] = [];
      for (const part of Y[key] ?? []) {
        const [mat, scale] = MAT[part.mat] ?? MAT.plain!;
        const mesh = inst(boxUv(modelGeo(part), scale), key.startsWith('cloth') ? 768 : 256, key.startsWith('cloth') ? cloth : mat);
        if (key.startsWith('cloth')) mesh.setColorAt(0, this.c.setHex(0xffffff));
        list.push(mesh);
      }
      this.props.set(key, list);
    }
    // sznur: odcinek liny (instancje układają się w zwisający łuk między słupkami)
    this.rope = inst(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4).translate(0, 0.5, 0), 1024, new THREE.MeshStandardMaterial({ color: 0xb8a882, roughness: 1 }), false);
    // kurz spod miotły
    this.dust = inst(new THREE.SphereGeometry(0.05, 6, 4), 256, new THREE.MeshBasicMaterial({ color: 0xb8a888, transparent: true, opacity: 0.35, depthWrite: false }), false);
  }

  view(p: THREE.Vector3): void { this.women.view(p); this.kids.view(p); }

  /**
   * Podwórko chaty: wolne pola tuż przy ścianach (bez drzwi i pola przed nimi, bez gratów, dróg i lasu),
   * na nich 2–4 rzeczy wybrane z numeru chaty, każda przyklejona do ściany, przodem na zewnątrz.
   */
  private yard(g: GameState, h: GameState['buildings'][number]): Yard {
    const W = g.map.width, fp = footprint(BUILDINGS[h.type]!, h.rot);
    const key = `${g.buildings.length}:${g.nextId}:${clutterTaken.size}`;
    let y = this.yards.get(h.id);
    if (y && y.key === key) return y;
    const dx = (h.door % W) + 0.5, dy = Math.floor(h.door / W) + 0.5;
    const cx = h.x + fp.w / 2, cy = h.y + fp.h / 2;
    let fx = dx - cx, fy = dy - cy; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const ring: [number, number, number, number][] = [];
    for (let x = h.x; x < h.x + fp.w; x++) { ring.push([x, h.y - 1, 0, 1]); ring.push([x, h.y + fp.h, 0, -1]); }
    for (let yy = h.y; yy < h.y + fp.h; yy++) { ring.push([h.x - 1, yy, 1, 0]); ring.push([h.x + fp.w, yy, -1, 0]); }
    const dTx = h.door % W, dTy = Math.floor(h.door / W);
    const free = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= W || ty >= g.map.height) return false;
      const t = ty * W + tx, terr = g.map.tiles[t] as Terrain;
      if (tx === dTx && ty === dTy) return false; // drzwi
      if (tx === dTx + Math.round(fx) && ty === dTy + Math.round(fy)) return false; // przejście przed drzwiami
      return g.occupancy[t] === 0 && !g.roads[t] && !g.reserved[t] && !clutterTaken.has(t) && TERRAIN[terr].walkable && terr !== Terrain.Forest;
    };
    const spots = ring.filter(([tx, ty]) => free(tx, ty));
    // kolejność pól i rzeczy z numeru chaty: każda chata ma inny zestaw i inny układ
    spots.sort((a, b) => hashN(h.id, a[0] * 977 + a[1]) - hashN(h.id, b[0] * 977 + b[1]));
    const pool = [...PROPS].sort((a, b) => hashN(h.id * 7, PROPS.indexOf(a)) - hashN(h.id * 7, PROPS.indexOf(b)));
    const want = Math.min(spots.length, 2 + (hashN(h.id, 5) % 3));
    const props: Placed[] = [];
    for (let i = 0; i < want; i++) {
      const [tx, ty, nx, ny] = spots[i]!, prop = pool[i]!;
      const r = (s: number): number => (hashN(h.id + s * 131, tx * 31 + ty) % 1000) / 1000;
      // przy ścianie: środek pola przesunięty ku chacie, trochę w bok wzdłuż ściany
      const back = prop === 'line' ? 0.12 : prop === 'garden' ? 0.16 : 0.26;
      const side = (r(1) - 0.5) * (prop === 'line' || prop === 'garden' || prop === 'bench' || prop === 'woodpile' ? 0.1 : 0.4);
      const x = tx + 0.5 + nx * back + ny * side, yy = ty + 0.5 + ny * back + nx * side;
      const yaw = Math.atan2(-nx, -ny) + (prop === 'tub' || prop === 'basket' || prop === 'bucket' ? (r(2) - 0.5) * 1.2 : (r(2) - 0.5) * 0.12);
      props.push({ prop, x, y: yy, yaw, ox: -nx, oy: -ny });
    }
    const cloth: Yard['cloth'] = [];
    if (props.some((p) => p.prop === 'line')) {
      // pranie: 2–4 sztuki różnego rodzaju i koloru, rozwieszone wzdłuż sznura z przerwami
      const n = 2 + (hashN(h.id, 9) % 3);
      let at = -0.34;
      for (let k = 0; k < n && at < 0.3; k++) {
        const kind = hashN(h.id, 20 + k) % CLOTHS.length, w = CLOTH_W[kind]!;
        if (at + w > 0.36) break;
        cloth.push({ kind, at: at + w / 2, color: CLOTH[hashN(h.id, 40 + k) % CLOTH.length]! });
        at += w + 0.02 + (hashN(h.id, 60 + k) % 5) * 0.012;
      }
    }
    y = { dx, dy, fx, fy, props, cloth, key };
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
        if (b.door < 0 || b.ruined || NO_TORCH.has(BUILDINGS[b.type]!.id)) continue;
        const bx = b.door % width, by = Math.floor(b.door / width);
        let best: typeof b | undefined, bd = 12 * 12;
        for (const h of houses) { if (h.owner !== b.owner) continue; const d = (h.door % width - bx) ** 2 + (Math.floor(h.door / width) - by) ** 2; if (d < bd) { bd = d; best = h; } }
        if (best) { const l = this.duty.get(best.id) ?? []; l.push(b.id); this.duty.set(best.id, l); }
      }
      for (const l of this.duty.values()) l.sort((a, b) => torchHour(a) - torchHour(b));
    }
    const byId = new Map(g.buildings.map((b) => [b.id, b] as const));
    const counts = new Map<string, number>();
    const put = (key: string, mat: THREE.Matrix4, color?: number): void => {
      const list = this.props.get(key);
      if (!list?.length) return;
      const k = counts.get(key) ?? 0;
      if (k >= list[0]!.instanceMatrix.count) return;
      for (const mesh of list) { mesh.setMatrixAt(k, mat); if (color !== undefined) mesh.setColorAt(k, this.c.setHex(color)); }
      counts.set(key, k + 1);
    };
    let n = 0, br = 0, rp = 0, du = 0;
    const tm = this.t;
    const wind = Math.sin(time * 0.6) * 0.5 + 0.6;
    const top = Y.post_top ?? 0.46;
    for (const h of houses) {
      if (n >= MAX) break;
      const yd = this.yard(g, h);
      const hx = yd.dx, hy = yd.dy;
      if (ctx.cam && Math.hypot(hx - ctx.cam.x, hy - ctx.cam.y) > 36 + ctx.cam.h * 0.4) continue;
      // podwórko stoi zawsze; pranie wisi tylko za dnia
      for (const p of yd.props) {
        const gy = ctx.height(p.x, p.y);
        this.m.makeRotationY(p.yaw).setPosition(p.x - W2, gy, p.y - H2);
        if (p.prop !== 'line') { put(p.prop, this.m); continue; }
        // sznur: dwa słupki 0,76 pola od siebie wzdłuż ściany, lina zwisa między nimi
        const ax = Math.cos(p.yaw), az = -Math.sin(p.yaw); // oś wzdłuż ściany (x modelu po obrocie)
        for (const s of [-0.38, 0.38]) { this.m2.makeRotationY(p.yaw + s * 4).setPosition(p.x - W2 + ax * s, gy, p.y - H2 + az * s); put('post', this.m2); }
        const SEG = 6, sag = 0.035;
        for (let k = 0; k < SEG && rp < 1024; k++) {
          const t0 = k / SEG, t1 = (k + 1) / SEG;
          const y0 = top - sag * Math.sin(t0 * Math.PI), y1 = top - sag * Math.sin(t1 * Math.PI);
          this.v1.set(p.x - W2 + ax * (t0 - 0.5) * 0.76, gy + y0, p.y - H2 + az * (t0 - 0.5) * 0.76);
          this.v2.set(p.x - W2 + ax * (t1 - 0.5) * 0.76, gy + y1, p.y - H2 + az * (t1 - 0.5) * 0.76);
          const len = this.v1.distanceTo(this.v2);
          this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.v2.clone().sub(this.v1).normalize());
          this.m2.compose(this.v1, this.q, new THREE.Vector3(1, len, 1));
          this.rope.setMatrixAt(rp++, this.m2);
        }
        if (day) for (const [k, c] of yd.cloth.entries()) {
          const along = c.at / 0.76 + 0.5;
          const cy = top - sag * Math.sin(along * Math.PI) - 0.003;
          const sway = Math.sin(time * 2.2 + k * 1.3 + h.id) * 0.3 * wind;
          this.m2.makeRotationX(sway).setPosition(c.at, cy, 0);
          put(CLOTHS[c.kind]!, this.m2.premultiply(this.m), c.color);
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
        if (!m) { m = { x: hx, y: hy, tx: hx, ty: hy, wait: rand() * 3, heading: rand() * 6.28, seen: 0 }; this.members.set(key, m); }
        m.seen = this.frame;
        let swing = 0, arm: number | undefined, armL = -0.5, legs = false, sp = 0, lean = 0, broom = false, up = false, hop = 0, sit = 0;
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
          // praca przy domu: co kilkanaście sekund inna, tylko taka, do której chata ma rzeczy
          const has = (p: Prop): Placed | undefined => yd.props.find((q) => q.prop === p);
          const can: Chore[] = ['sweep', 'feed'];
          for (const [c, p] of Object.entries(NEEDS) as [Chore, Prop][]) if (has(p)) can.push(c, c);
          const slot = Math.floor((time + h.id * 3.7) / 16);
          const chore: Chore = day ? can[hashN(h.id, slot) % can.length]! : has('bench') ? 'sit' : 'sweep';
          const at = NEEDS[chore] ? has(NEEDS[chore]!) : undefined;
          // gdzie stanąć: przed rzeczą (od strony podwórka), przy drzwiach (zamiatanie), obok domu (kury)
          let spot: [number, number] = [hx + yd.fx * 0.6, hy + yd.fy * 0.6];
          if (at) spot = chore === 'sit' ? [at.x + at.ox * 0.05, at.y + at.oy * 0.05] : [at.x + at.ox * (chore === 'weed' ? 0.3 : 0.24), at.y + at.oy * (chore === 'weed' ? 0.3 : 0.24)];
          if (chore === 'feed') spot = [hx + yd.fx * 1.2 - yd.fy * 0.6, hy + yd.fy * 1.2 + yd.fx * 0.6];
          if (chore === 'sweep') {
            const s = Math.sin(time * 0.35 + h.id) * 0.8;
            spot = [hx + yd.fx * 0.6 - yd.fy * s, hy + yd.fy * 0.6 + yd.fx * s];
          }
          m.tx = spot[0]; m.ty = spot[1];
          sp = this.walk(g, m, dt, chore === 'sweep' ? 0.35 : 0.8);
          const near = Math.hypot(m.tx - m.x, m.ty - m.y) < 0.3;
          const ph = time + h.id;
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
          } else if (near && at) {
            const look = (): void => this.face(m!, chore === 'sit' ? Math.atan2(at.ox, at.oy) : Math.atan2(at.x - m!.x, at.y - m!.y), dt);
            look();
            if (chore === 'wash') { lean = 0.55; arm = -1.15 + Math.sin(ph * 5.5) * 0.3; armL = -1.15 - Math.sin(ph * 5.5) * 0.3; }
            else if (chore === 'hang') { arm = -2.6 + Math.max(0, Math.sin(ph * 2)) * 0.4; armL = -2.4 - Math.max(0, -Math.sin(ph * 2)) * 0.4; }
            else if (chore === 'weed') { lean = 0.75; arm = -1.3 + Math.sin(ph * 3.5) * 0.35; armL = -1.0; }
            else if (chore === 'stack') {
              // nosi polana ze stosu: schyla się, podnosi, odkłada
              const s = Math.sin(ph * 1.6);
              lean = 0.15 + Math.max(0, s) * 0.5; arm = -1.2 - Math.max(0, -s) * 0.4; armL = arm;
            } else if (chore === 'sit') { sit = 0.1; arm = -0.9; armL = -0.9; }
          } else if (near && chore === 'feed') {
            // sypie ziarno kurom: zamach ręką od fartucha w bok
            arm = -0.9 - Math.max(0, Math.sin(ph * 3)) * 0.8; armL = -1.0; lean = 0.1;
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
        const scale = woman ? 1 : 0.92 + (h.id % 2) * 0.08;
        const run = !woman && sp > 0.1 ? Math.abs(Math.sin(time * 14 + k)) * 0.03 : 0;
        tm.position.set(m.x - W2, ctx.height(m.x, m.y) + run + hop - sit, m.y - H2);
        tm.rotation.set(lean, m.heading + (ia?.yaw ?? 0), ia?.roll ?? 0, 'YXZ');
        tm.scale.setScalar(ctx.fig * scale);
        tm.updateMatrix();
        const id = h.id * 3 + k;
        (woman ? this.women : this.kids).set(n, tm.matrix, ia?.legs ? ia.legs : swing, up || !!ia?.up, team, id, arm ?? ia?.arm, arm !== undefined ? armL : (ia?.armL ?? -0.5), legs || !!ia?.legs);
        if (woman) {
          if (broom && br < MAX) {
            // miotła w prawej ręce, obraca się razem z ręką w barku
            this.m2.makeRotationX(arm ?? -0.5).setPosition(this.women.shoulder[0], this.women.shoulder[1], this.women.shoulder[2]);
            this.brooms.setMatrixAt(br++, this.m2.premultiply(tm.matrix));
          }
        }
        n++;
      }
    }
    this.women.finish(n);
    this.kids.finish(n);
    const fin = (mesh: THREE.InstancedMesh, k: number): void => { mesh.count = k; mesh.visible = k > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
    fin(this.brooms, br); fin(this.rope, rp); fin(this.dust, du);
    for (const [key, list] of this.props) for (const mesh of list) fin(mesh, counts.get(key) ?? 0);
    for (const [k, mm] of this.members) if (this.frame - mm.seen > 600) this.members.delete(k);
  }
}

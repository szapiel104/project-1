/**
 * Uszkodzenia murów, wież, bram i twierdzy (27.10.2026). Im mniej wytrzymałości, tym więcej widać:
 * 1 — pojedyncze rysy, 2 — pęknięcia z odpryskami i pierwsze okruchy pod murem, 3 — długie pęknięcia, wyrwy
 * po wybitych kamieniach i kupki gruzu u stóp. Drewno (częstokół, brama, wieża strażnicza) łupie się: jasne
 * drzazgi w korze, a pod ścianą leżą odłamki. Bale częstokołu dodatkowo się przekrzywiają i łamią (walls.ts).
 *
 * Stopień idzie za wytrzymałością (wear.ts), więc gdy inżynier łata mur, pęknięcia znikają jedno po drugim.
 *
 * Wydajność: wszystko w ośmiu wspólnych siatkach instancji, przeliczanych tylko wtedy, gdy któraś budowla
 * zmieni stopień. Miejsca na pęknięcia na modelu (wieże, bramy, twierdza) szukamy raz na budynek promieniami
 * przez drzewo BVH siatki (to samo `boundsTree`, którego używa reszta sceny); mur kamienny liczymy wprost z bloku.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { BUILDINGS, footprint } from '../data/buildings';
import type { GameState } from '../sim/state';
import { maxHp } from '../sim/systems/placement';
import { STONE_WALL_TOP } from './buildings';
import { cat } from './cat';
import type { TerrainView } from './terrain';
import { pattern } from './textures';
import { touch } from './touch';
import { showsWear, wearMaterial, wearStage } from './wear';

type Kind = 'stone' | 'wood';
/** Miejsce na ścianie: punkt i kierunek na zewnątrz (świat); decal = false — tylko odłamki pod ścianą */
interface Spot { p: THREE.Vector3; n: THREE.Vector3; decal: boolean }

/** Części modelu, na których nie rysujemy pęknięć (wnętrza, ludzie, ogień, znaki, flagi) */
const SKIP = new Set(['interior', 'life', 'fire', 'flame', 'smoke', 'noworker', 'fill', 'foodfill', 'armsfill', 'flagcloth', 'bannercloth', 'flagpole', 'ceiling']);
const MAX_DECALS = 1500, MAX_ROCKS = 3000, MAX_SPLINTERS = 2000;

const rnd = (seed: number, i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };

/** Pęknięcia i drzazgi rysowane na płótnie (z ręki, bez zdjęć), po trzy coraz cięższe na materiał */
function wearTexture(kind: Kind, level: 1 | 2 | 3): THREE.Texture {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  let seed = level * 31 + (kind === 'wood' ? 7 : 0);
  const r = (): number => { seed++; return rnd(seed, 3); };
  const inside = (x: number, y: number): boolean => x > 40 && y > 40 && x < S - 40 && y < S - 40;
  const stroke = (pts: [number, number][], w: number, style: string, dx = 0, dy = 0): void => {
    for (let i = 1; i < pts.length; i++) {
      const k = 1 - i / pts.length; // pęknięcie zwęża się ku końcowi
      c.strokeStyle = style; c.lineWidth = Math.max(0.8, w * (0.35 + k * 0.65)); c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[i - 1]![0] + dx, pts[i - 1]![1] + dy); c.lineTo(pts[i]![0] + dx, pts[i]![1] + dy); c.stroke();
    }
  };
  const walk = (x: number, y: number, ang: number, len: number, wiggle: number): [number, number][] => {
    const pts: [number, number][] = [[x, y]];
    for (let d = 0; d < len; d += 7 + r() * 7) {
      ang += (r() - 0.5) * wiggle;
      x += Math.cos(ang) * 10; y += Math.sin(ang) * 10;
      if (!inside(x, y)) break;
      pts.push([x, y]);
    }
    return pts;
  };
  /** Odprysk: wybity kawałek z ciemniejszym dnem i jasną krawędzią od góry (światło pada z góry) */
  const spall = (x: number, y: number, rad: number, deep: string, edge: string, rim: string): void => {
    const n = 9, pts: [number, number][] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = rad * (0.6 + r() * 0.5); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
    const gr = c.createRadialGradient(x, y + rad * 0.2, rad * 0.1, x, y, rad);
    gr.addColorStop(0, deep); gr.addColorStop(1, edge);
    c.fillStyle = gr; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill();
    c.strokeStyle = rim; c.lineWidth = 2.5; c.beginPath();
    pts.forEach(([px, py], i) => { if (py > y) return; if (i && pts[i - 1]![1] <= y) c.lineTo(px, py); else c.moveTo(px, py); });
    c.stroke();
  };
  if (kind === 'stone') {
    const half = [0, 110, 170, 215][level]!, branches = [0, 1, 3, 6][level]!;
    const cracks: [number, number][][] = [];
    const a0 = Math.PI / 2 + (r() - 0.5) * 0.9; // pęknięcia murów idą raczej w pionie, po spoinach skośnie
    cracks.push(walk(S / 2, S / 2, a0, half, 0.9), walk(S / 2, S / 2, a0 + Math.PI, half, 0.9));
    for (let b = 0; b < branches; b++) {
      const base = cracks[b % 2]!, at = base[Math.floor(r() * (base.length - 1))] ?? [S / 2, S / 2];
      cracks.push(walk(at[0], at[1], a0 + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.7), half * (0.35 + r() * 0.35), 1.1));
    }
    if (level >= 2) for (let k = 0; k < level; k++) {
      const base = cracks[k % cracks.length]!, at = base[Math.floor(r() * base.length)] ?? [S / 2, S / 2];
      const rad = level === 3 && k === 0 ? 62 + r() * 18 : 22 + r() * 18;
      spall(at[0], at[1], rad, 'rgba(52,46,40,0.92)', 'rgba(118,108,96,0.55)', 'rgba(222,214,198,0.55)');
    }
    for (const [i, p] of cracks.entries()) {
      const w = i < 2 ? 3 + level * 1.6 : 2 + level * 0.6;
      stroke(p, w + 6, 'rgba(0,0,0,0.18)');            // cień wokół szczeliny
      stroke(p, w, 'rgba(26,22,18,0.95)');              // szczelina
      stroke(p, 1.3, 'rgba(225,216,200,0.45)', 1.5, -1.5); // wykruszona, jaśniejsza krawędź
    }
  } else {
    // drewno: rozłupane włókna wzdłuż bala — ciemny brzeg w korze, w środku jasne, świeże drewno
    const n = [0, 2, 4, 6][level]!;
    for (let k = 0; k < n; k++) {
      const x = S / 2 + (r() - 0.5) * 220, y = S / 2 + (r() - 0.5) * 120, len = 90 + level * 50 + r() * 60;
      const up = walk(x, y, -Math.PI / 2 + (r() - 0.5) * 0.2, len / 2, 0.18), down = walk(x, y, Math.PI / 2 + (r() - 0.5) * 0.2, len / 2, 0.18);
      const p = [...up.reverse(), ...down.slice(1)];
      const w = 5 + level * 2 + r() * 3;
      stroke(p, w + 4, 'rgba(24,16,10,0.85)');
      stroke(p, w * 0.55, 'rgba(198,162,114,0.97)');
      stroke(p, 1, 'rgba(120,88,56,0.8)', 1, 0);
    }
    if (level === 3) {
      // wyrwany kawał drewna: jasne, poszarpane włókna
      spall(S / 2, S / 2, 70, 'rgba(176,138,92,0.98)', 'rgba(140,104,64,0.9)', 'rgba(36,24,14,0.85)');
      for (let k = 0; k < 9; k++) { const x = S / 2 + (r() - 0.5) * 100; stroke([[x, S / 2 - 50 + r() * 20], [x + (r() - 0.5) * 8, S / 2 + 40 + r() * 20]], 1.4, 'rgba(110,80,50,0.7)'); }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class WearLayer {
  constructor(private scene: THREE.Scene) {}
  /** Nowa mapa */
  invalidate(): void { this.key = '-'; this.spots.clear(); }

  private key = '';
  private decals = new Map<string, THREE.InstancedMesh>();
  private rocks: THREE.InstancedMesh | null = null;
  private splinters: THREE.InstancedMesh | null = null;
  private spots = new Map<number, { at: string; list: Spot[] }>();

  private mesh(kind: Kind, level: 1 | 2 | 3): THREE.InstancedMesh {
    const id = `${kind}${level}`;
    let m = this.decals.get(id);
    if (!m) {
      const mat = new THREE.MeshStandardMaterial({ map: wearTexture(kind, level), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAX_DECALS);
      m.count = 0; m.receiveShadow = true; m.frustumCulled = false; m.renderOrder = 2;
      this.scene.add(cat(m, 'uszkodzenia murów'));
      this.decals.set(id, m);
    }
    return m;
  }

  sync(g: GameState, view: TerrainView, meshes: Map<number, THREE.Group>): void {
    const hurt: { b: GameState['buildings'][number]; s: 1 | 2 | 3 }[] = [];
    let key = '';
    for (const b of g.buildings) {
      if (b.build || b.ruined || !showsWear(b.type)) continue;
      const s = wearStage(b.hp, maxHp(b.type));
      if (!s) continue;
      const m = meshes.get(b.id);
      hurt.push({ b, s });
      key += `${b.id}:${s}:${m ? Math.round(m.rotation.y * 10) : 0},`;
    }
    if (key === this.key) return;
    this.key = key;
    if (!this.rocks) {
      this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, map: pattern('rock') }), MAX_ROCKS);
      this.splinters = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc9a473, roughness: 0.95, map: pattern('planks') }), MAX_SPLINTERS);
      for (const m of [this.rocks, this.splinters]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(cat(m, 'uszkodzenia murów')); }
    }
    const used = new Map<string, number>();
    let nr = 0, ns = 0;
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), col = new THREE.Color();
    const { width, height } = g.map;
    const ground = (x: number, z: number): number => view.heightAt(x + width / 2, z + height / 2);
    for (const { b, s } of hurt) {
      const kind = wearMaterial(b.type);
      const spots = this.spotsFor(g, b, meshes.get(b.id));
      if (!spots.length) continue;
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      const big = Math.max(fp.w, fp.h);
      const size = (kind === 'wood' ? 0.3 : big <= 1 ? 0.48 : Math.min(1.2, 0.45 + big * 0.12)) * [0, 1, 1.15, 1.35][s]!;
      const wantDecals = Math.min(spots.length, [0, 2, 4, 7][s]! * (big >= 6 ? 3 : 1));
      const dm = this.mesh(kind, s);
      let placed = 0;
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i]!;
        if (sp.decal && placed < wantDecals) {
          const n = used.get(`${kind}${s}`) ?? 0;
          if (n < MAX_DECALS) {
            q.setFromUnitVectors(Z, sp.n);
            // kamień pęka pod różnym kątem, drewno tylko wzdłuż włókien
            qr.setFromAxisAngle(Z, kind === 'wood' ? (rnd(b.id, i) - 0.5) * 0.2 : (rnd(b.id, i) - 0.5) * 1.4);
            q.multiply(qr);
            const k = size * (0.85 + rnd(b.id, i + 50) * 0.3);
            dm.setMatrixAt(n, M4.compose(p.copy(sp.p).addScaledVector(sp.n, 0.012), q, sc.set(k, k, 1)));
            used.set(`${kind}${s}`, n + 1);
          }
          placed++;
        }
        // okruchy i drzazgi pod ścianą: od drugiego stopnia, przy trzecim kupki gruzu
        if (s < 2 || (s === 2 && i % 2)) continue;
        const pieces = s === 3 ? 4 : 2;
        for (let j = 0; j < pieces; j++) {
          const d = 0.12 + rnd(b.id + i, j) * 0.35, side = (rnd(b.id + i, j + 9) - 0.5) * 0.5;
          const x = sp.p.x + sp.n.x * d - sp.n.z * side, z = sp.p.z + sp.n.z * d + sp.n.x * side;
          const y = ground(x, z);
          q.setFromEuler(new THREE.Euler(rnd(b.id, j + i * 7) * 3, rnd(b.id, j + i * 5) * 6, rnd(b.id, j + i * 3) * 3));
          if (kind === 'stone') {
            if (nr >= MAX_ROCKS) continue;
            const k = (s === 3 && j === 0 ? 0.2 : 0.09) + rnd(b.id, j + i) * 0.08;
            this.rocks.setColorAt(nr, col.setHex(0xa39c90).multiplyScalar(0.8 + rnd(i, j) * 0.3));
            this.rocks.setMatrixAt(nr++, M4.compose(p.set(x, y + k * 0.25, z), q, sc.set(k, k * 0.7, k * 0.9)));
          } else {
            if (ns >= MAX_SPLINTERS) continue;
            q.setFromEuler(new THREE.Euler(0, rnd(b.id, j + i * 5) * 6, (rnd(i, j) - 0.5) * 0.3));
            const L = 0.12 + rnd(b.id, j + i) * 0.22;
            this.splinters!.setMatrixAt(ns++, M4.compose(p.set(x, y + 0.015, z), q, sc.set(L, 0.025, 0.035)));
          }
        }
      }
    }
    for (const [id, m] of this.decals) { m.count = used.get(id) ?? 0; touch(m); }
    this.rocks.count = nr; this.splinters!.count = ns;
    touch(this.rocks); touch(this.splinters!);
  }

  /** Miejsca na pęknięcia dla budowli (liczone raz, dopóki budowla się nie przesunie ani nie obróci) */
  private spotsFor(g: GameState, b: GameState['buildings'][number], mesh: THREE.Group | undefined): Spot[] {
    const def = BUILDINGS[b.type]!;
    const at = mesh ? `${mesh.position.x.toFixed(2)},${mesh.position.y.toFixed(2)},${mesh.position.z.toFixed(2)},${mesh.rotation.y.toFixed(2)}` : `${b.x},${b.y}`;
    const hit = this.spots.get(b.id);
    if (hit && hit.at === at) return hit.list;
    const list = def.line ? this.lineSpots(g, b, mesh) : mesh ? this.modelSpots(b, mesh) : [];
    this.spots.set(b.id, { at, list });
    return list;
  }

  /** Mur kamienny i częstokół: odsłonięte boki pola (bez sąsiedniego odcinka tego samego muru) */
  private lineSpots(g: GameState, b: GameState['buildings'][number], mesh: THREE.Group | undefined): Spot[] {
    const { width, height } = g.map;
    const def = BUILDINGS[b.type]!;
    const same = (x: number, y: number): boolean => g.buildings.some((o) => o.x === x && o.y === y && o.type === b.type);
    const cx = b.x + 0.5 - width / 2, cz = b.y + 0.5 - height / 2;
    const y0 = mesh ? mesh.position.y : 0;
    const out: Spot[] = [];
    const sides: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const stone = def.id === 'stoneWall';
    // pęknięcia między cokołem (0,18) a gzymsem (TOP − 0,3), z zapasem na grubość krawędzi
    const yLo = y0 - 0.06 + 0.26, yHi = y0 - 0.06 + STONE_WALL_TOP - 0.4;
    for (let k = 0; k < 3; k++) for (const [si, [dx, dz]] of sides.entries()) {
      if (same(b.x + dx, b.y + dz)) continue;
      const u = (k - 1) * 0.3 + (rnd(b.id + si, k) - 0.5) * 0.08;
      const face = stone ? 0.5 : 0.11;
      const px = cx + dx * face + (dz ? u : 0), pz = cz + dz * face + (dx ? u : 0);
      const py = stone ? yLo + rnd(b.id, k + si * 3) * (yHi - yLo) : y0 + 0.5;
      out.push({ p: new THREE.Vector3(px, py, pz), n: new THREE.Vector3(dx, 0, dz), decal: stone });
    }
    return out;
  }

  /** Wieże, bramy, twierdza: promienie z zewnątrz do środka na różnych wysokościach, trafienia w pionowe ściany */
  private modelSpots(b: GameState['buildings'][number], mesh: THREE.Group): Spot[] {
    mesh.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
    const skip = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p && p !== mesh; p = p.parent) if (SKIP.has(p.name)) return true; return false; };
    mesh.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || (me as unknown as THREE.InstancedMesh).isInstancedMesh || (me as unknown as THREE.SkinnedMesh).isSkinnedMesh || !me.visible || skip(me)) return;
      if (!me.geometry?.getAttribute('position')) return;
      parts.push(me);
    });
    if (!parts.length) return [];
    const box = new THREE.Box3();
    for (const me of parts) box.expandByObject(me);
    const c = box.getCenter(new THREE.Vector3()), r = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.5;
    const def = BUILDINGS[b.type]!, fp = footprint(def, b.rot);
    const rays = Math.max(fp.w, fp.h) >= 6 ? 40 : 18;
    const out: Spot[] = [];
    const ray = new THREE.Ray(), local = new THREE.Ray(), inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), dir = new THREE.Vector3();
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + rnd(b.id, i) * 0.3;
      // pęknięcia w dolnych dwóch trzecich (blanki i dachy wież zostawiamy w spokoju)
      const h = box.min.y + (0.12 + rnd(b.id, i + 99) * 0.55) * (box.max.y - box.min.y);
      dir.set(Math.cos(a), 0, Math.sin(a));
      ray.origin.set(c.x + dir.x * r, h, c.z + dir.z * r);
      ray.direction.copy(dir).negate();
      let best: { d: number; p: THREE.Vector3; n: THREE.Vector3 } | null = null;
      for (const me of parts) {
        const geo = me.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
        if (!geo.boundsTree) geo.boundsTree = new MeshBVH(geo);
        inv.copy(me.matrixWorld).invert();
        local.copy(ray).applyMatrix4(inv);
        const hitL = geo.boundsTree.raycastFirst(local, THREE.FrontSide);
        if (!hitL || !hitL.face) continue;
        const pw = hitL.point.clone().applyMatrix4(me.matrixWorld);
        const d = pw.distanceTo(ray.origin);
        if (best && d >= best.d) continue;
        const nw = hitL.face.normal.clone().applyMatrix3(nm.getNormalMatrix(me.matrixWorld)).normalize();
        best = { d, p: pw, n: nw };
      }
      // tylko pionowe ściany zwrócone na zewnątrz
      if (best && Math.abs(best.n.y) < 0.35 && best.n.dot(dir) > 0.4) { best.n.y = 0; best.n.normalize(); out.push({ p: best.p, n: best.n, decal: true }); }
    }
    return out;
  }
}

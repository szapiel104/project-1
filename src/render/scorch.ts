/**
 * Osmalenie po pożarze (28.10.2026). Póki budynek płonie, na ścianach i dachu przybywa sadzy — czarne, poszarpane
 * plamy z zaciekami w górę, jak od ognia buchającego z okien i spod okapu. Sadza zostaje po ugaszeniu i schodzi
 * dopiero z naprawą (stan `scorch` liczy fire.ts w symulacji, więc tak samo u wszystkich graczy i po wczytaniu zapisu).
 *
 * Miejsca na plamy szukamy raz na budynek promieniami przez drzewo BVH siatki (jak pęknięcia w damage.ts): z boków
 * w ściany i z góry w dach. Rysujemy je w dwóch wspólnych siatkach instancji, przeliczanych tylko przy zmianie stopnia.
 */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { BUILDINGS, footprint } from '../data/buildings';
import type { GameState } from '../sim/state';
import { cat } from './cat';
import { touch } from './touch';

const SKIP = new Set(['interior', 'life', 'fire', 'flame', 'smoke', 'noworker', 'fill', 'foodfill', 'armsfill', 'grainfill', 'flagcloth', 'bannercloth', 'flagpole', 'ceiling', 'pożar']);
const MAX = 2500;
interface Spot { p: THREE.Vector3; n: THREE.Vector3; roof: boolean }

const rnd = (seed: number, i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };

/** Plama sadzy narysowana na płótnie: ciemny, nierówny środek, miękki brzeg i zacieki dymu w górę */
function sootTexture(variant: number): THREE.Texture {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  let seed = 17 + variant * 53;
  const r = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // kłęby czerni: wiele miękkich kół, gęściej u dołu (tam, skąd szedł ogień), w górę rzedną
  for (let k = 0; k < 70; k++) {
    const up = r();
    const x = S / 2 + (r() - 0.5) * S * (0.55 - up * 0.2), y = S * (0.78 - up * 0.62);
    const rad = S * (0.06 + r() * 0.13) * (1 - up * 0.35);
    const a = 0.32 * (1 - up * 0.6);
    const gr = c.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(8,6,5,${a})`);
    gr.addColorStop(0.6, `rgba(14,10,8,${a * 0.55})`);
    gr.addColorStop(1, 'rgba(20,14,10,0)');
    c.fillStyle = gr;
    c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
  }
  // zacieki: smugi w górę od dolnej krawędzi plamy
  for (let k = 0; k < 14; k++) {
    const x = S * (0.25 + r() * 0.5), y0 = S * (0.7 + r() * 0.15), y1 = S * (0.08 + r() * 0.3), w = 3 + r() * 9;
    const gr = c.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, 'rgba(6,5,4,0.35)');
    gr.addColorStop(1, 'rgba(6,5,4,0)');
    c.strokeStyle = gr; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + (r() - 0.5) * 30, (y0 + y1) / 2, x + (r() - 0.5) * 24, y1); c.stroke();
  }
  // przypalone, rdzawe drobinki przy środku (zwęglone drewno)
  for (let k = 0; k < 40; k++) {
    const x = S / 2 + (r() - 0.5) * S * 0.4, y = S * (0.55 + (r() - 0.5) * 0.35);
    c.fillStyle = r() < 0.7 ? 'rgba(4,3,2,0.55)' : 'rgba(70,32,12,0.35)';
    c.beginPath(); c.arc(x, y, 1 + r() * 3, 0, Math.PI * 2); c.fill();
  }
  // miękkie wygaszenie brzegów kwadratu, żeby nie było widać krawędzi naklejki
  const id = c.getImageData(0, 0, S, S), d = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
    const f = Math.max(0, 1 - Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 6));
    d[(y * S + x) * 4 + 3] = d[(y * S + x) * 4 + 3]! * f;
  }
  c.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class ScorchLayer {
  private key = '';
  private decals: THREE.InstancedMesh[] = [];
  private spots = new Map<number, { at: string; list: Spot[] }>();

  constructor(private scene: THREE.Scene) {}

  invalidate(): void { this.key = '-'; this.spots.clear(); }

  private ensure(): void {
    if (this.decals.length) return;
    for (let v = 0; v < 2; v++) {
      const mat = new THREE.MeshStandardMaterial({
        map: sootTexture(v), transparent: true, depthWrite: false, roughness: 1, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
      });
      mat.userData.noSeason = true;
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, MAX);
      m.count = 0; m.receiveShadow = true; m.frustumCulled = false; m.renderOrder = 3;
      this.scene.add(cat(m, 'osmalenia'));
      this.decals.push(m);
    }
  }

  sync(g: GameState, meshes: Map<number, THREE.Group>): void {
    let key = '';
    const list: { b: GameState['buildings'][number]; k: number }[] = [];
    for (const b of g.buildings) {
      if (!b.scorch || b.build || b.ruined) continue;
      const m = meshes.get(b.id);
      if (!m) continue;
      // stopnie co 4%: wystarczy, żeby sadzy przybywało płynnie, a nie liczymy wszystkiego co klatkę
      const k = Math.ceil(b.scorch / 40);
      list.push({ b, k });
      key += `${b.id}:${k}:${m.position.x.toFixed(1)},${m.position.z.toFixed(1)},${m.rotation.y.toFixed(2)};`;
    }
    if (key === this.key) return;
    this.key = key;
    this.ensure();
    const n = [0, 0];
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    for (const { b, k } of list) {
      const spots = this.spotsFor(b, meshes.get(b.id)!);
      if (!spots.length) continue;
      const level = k / 25; // 0..1
      // najpierw szybko pojawiają się pierwsze plamy, potem gęstnieją i rosną
      const want = Math.round(spots.length * Math.min(1, Math.sqrt(level) * 1.05));
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      const base = Math.min(1.25, 0.5 + Math.max(fp.w, fp.h) * 0.09);
      for (let i = 0; i < want; i++) {
        const sp = spots[i]!;
        const v = (b.id + i) & 1;
        if (n[v]! >= MAX) continue;
        q.setFromUnitVectors(Z, sp.n);
        // zacieki zawsze w górę ściany (na dachu w górę połaci), z małym odchyleniem
        if (!sp.roof) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
          const want = new THREE.Vector3(0, 1, 0).projectOnPlane(sp.n).normalize();
          const ang = Math.atan2(new THREE.Vector3().crossVectors(up, want).dot(sp.n), up.dot(want));
          qr.setFromAxisAngle(Z, ang + (rnd(b.id, i + 31) - 0.5) * 0.35);
        } else qr.setFromAxisAngle(Z, rnd(b.id, i + 31) * Math.PI * 2);
        q.multiply(qr);
        const s = base * (0.75 + rnd(b.id, i + 7) * 0.5) * (0.65 + level * 0.55);
        this.decals[v]!.setMatrixAt(n[v]!, M4.compose(p.copy(sp.p).addScaledVector(sp.n, 0.004 + (i % 3) * 0.0015), q, sc.set(s, s * (sp.roof ? 1 : 1.25), 1)));
        n[v]!++;
      }
    }
    this.decals.forEach((m, v) => { m.count = n[v]!; touch(m); });
  }

  /** Miejsca na sadzę: liczone raz, dopóki budynek się nie przesunie ani nie obróci */
  private spotsFor(b: GameState['buildings'][number], mesh: THREE.Group): Spot[] {
    const at = `${mesh.position.x.toFixed(2)},${mesh.position.y.toFixed(2)},${mesh.position.z.toFixed(2)},${mesh.rotation.y.toFixed(2)}`;
    const hit = this.spots.get(b.id);
    if (hit && hit.at === at) return hit.list;
    const list = this.modelSpots(b, mesh);
    this.spots.set(b.id, { at, list });
    return list;
  }

  /** Promienie z boków w ściany i z góry w dach; trafienia zwrócone na zewnątrz, w kolejności losowej (ale stałej) */
  private modelSpots(b: GameState['buildings'][number], mesh: THREE.Group): Spot[] {
    mesh.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
    const skip = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p && p !== mesh; p = p.parent) if (SKIP.has(p.name)) return true; return false; };
    mesh.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || (me as unknown as THREE.InstancedMesh).isInstancedMesh || (me as unknown as THREE.SkinnedMesh).isSkinnedMesh || skip(me)) return;
      if (!me.geometry?.getAttribute('position')) return;
      parts.push(me);
    });
    if (!parts.length) return [];
    const box = new THREE.Box3();
    for (const me of parts) box.expandByObject(me);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.5;
    const fp = footprint(BUILDINGS[b.type]!, b.rot), big = Math.max(fp.w, fp.h);
    const side = big >= 6 ? 56 : big >= 3 ? 34 : 22, top = big >= 6 ? 30 : big >= 3 ? 16 : 9;
    const out: (Spot & { o: number })[] = [];
    const ray = new THREE.Ray(), local = new THREE.Ray(), inv = new THREE.Matrix4(), nm = new THREE.Matrix3();
    const cast = (i: number): void => {
      let best: { d: number; p: THREE.Vector3; n: THREE.Vector3 } | null = null;
      for (const me of parts) {
        const geo = me.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
        if (!geo.boundsTree) geo.boundsTree = new MeshBVH(geo);
        inv.copy(me.matrixWorld).invert();
        local.copy(ray).applyMatrix4(inv);
        const h = geo.boundsTree.raycastFirst(local, THREE.FrontSide);
        if (!h || !h.face) continue;
        const pw = h.point.clone().applyMatrix4(me.matrixWorld);
        const d = pw.distanceTo(ray.origin);
        if (best && d >= best.d) continue;
        best = { d, p: pw, n: h.face.normal.clone().applyMatrix3(nm.getNormalMatrix(me.matrixWorld)).normalize() };
      }
      if (!best || best.n.dot(ray.direction) > -0.3) return;
      out.push({ p: best.p, n: best.n, roof: best.n.y > 0.45, o: rnd(b.id, i + 500) });
    };
    for (let i = 0; i < side; i++) {
      const a = (i / side) * Math.PI * 2 + rnd(b.id, i) * 0.4;
      const h = box.min.y + (0.08 + rnd(b.id, i + 99) * 0.85) * (box.max.y - box.min.y);
      ray.direction.set(-Math.cos(a), 0, -Math.sin(a));
      ray.origin.set(c.x + Math.cos(a) * r, h, c.z + Math.sin(a) * r);
      cast(i);
    }
    for (let i = 0; i < top; i++) {
      const x = box.min.x + (0.1 + rnd(b.id, i + 300) * 0.8) * (box.max.x - box.min.x), z = box.min.z + (0.1 + rnd(b.id, i + 400) * 0.8) * (box.max.z - box.min.z);
      ray.origin.set(x, box.max.y + 1, z);
      ray.direction.set((rnd(b.id, i + 450) - 0.5) * 0.3, -1, (rnd(b.id, i + 460) - 0.5) * 0.3).normalize();
      cast(i + 1000);
    }
    out.sort((a, b2) => a.o - b2.o);
    return out;
  }
}

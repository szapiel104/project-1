/**
 * Towar pod magazynami (Michał 27.10.2026, logika w sim/systems/storage.ts): gdy magazyn jest pełny, robotnik odkłada
 * ładunek pod drzwiami. Tu ten towar widać — porządnie ułożony na palecie albo w sztaplu obok wejścia, a nad pełnym
 * magazynem gracza wisi znak „pełno”.
 *
 * Wydajność: stos to jedna siatka na materiał (zwykle 2–3 wywołania rysowania), geometria wspólna dla stosów o tym samym
 * towarze i wielkości; przebudowa tylko, gdy stos urośnie albo zmaleje. Bez stosów warstwa nic nie robi.
 */
import * as THREE from 'three';
import { BUILDINGS, footprint } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import type { GameState, Pile } from '../sim/state';
import { assembleParts, beamPiece, boardPiece, groundLoad, loadMaterials } from './loads';
import type { TerrainView } from './terrain';

/** Ile sztuk towaru to jedna „sztuka” na stosie (mniej więcej jeden niesiony ładunek) */
const UNIT: Record<string, number> = { stone: 10, iron: 7, wheat: 16, flour: 16, bread: 10, apples: 18, fish: 8, gold: 6, crystal: 1, ale: 3, spear: 3, bow: 2, sword: 2, armor: 1 };
/** Najwięcej sztuk na jednym stosie (dalej stos już nie rośnie, choć towaru przybywa) */
const MAX_ITEMS = 12;
const PALLET_W = 0.84, PALLET_D = 0.58, PALLET_H = 0.075;

interface Built { geo: THREE.BufferGeometry; mats: THREE.Material[] }
const cache = new Map<string, Built | null>();

/** Grupy bryły z powrotem jako osobne części z oznaczonym materiałem (żeby cały stos złożyć w jedną bryłę) */
function splitGroups(geo: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const mats = (geo.userData.mats as string[] | undefined) ?? ['plain'];
  const src = geo.index ? geo.toNonIndexed() : geo;
  const groups = src.groups.length ? src.groups : [{ start: 0, count: src.getAttribute('position').count, materialIndex: 0 }];
  return groups.map((gr) => {
    const part = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color', 'uv']) {
      const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      part.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    part.userData.mat = mats[gr.materialIndex ?? 0];
    return part;
  });
}

/** Stała „losowość” z liczby (lekki skręt sztuk, żeby stos nie wyglądał jak z formy) */
const jitter = (n: number): number => (Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1) - 0.5;

/** Paleta z desek na dwóch płozach */
function pallet(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of [-PALLET_D / 2 + 0.06, PALLET_D / 2 - 0.06]) parts.push(beamPiece(PALLET_W, 0.045, 0.07, 0x5e4630).translate(0, 0.0225, z));
  for (let i = 0; i < 5; i++) {
    const x = -PALLET_W / 2 + 0.085 + i * ((PALLET_W - 0.17) / 4);
    parts.push(boardPiece(0.13, 0.025, PALLET_D, [0xa17a4f, 0x94704a, 0xa98252, 0x8f6b45, 0x9d774c][i]!).translate(x, 0.045 + 0.0125, 0));
  }
  return parts;
}

/** Sztapel desek: warstwy na przemian, z przekładkami, na dwóch podkładach (jak w tartaku) */
function lumber(layers: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const L = 0.78, bw = 0.12, bt = 0.034, gap = 0.028;
  for (const z of [-0.2, 0.2]) parts.push(beamPiece(L * 0.95, 0.06, 0.07, 0x4e3a28).translate(0, 0.03, z));
  let y = 0.06;
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < 4; i++) {
      const z = -(4 * bw + 3 * gap) / 2 + bw / 2 + i * (bw + gap);
      const tone = [0xc29462, 0xb98a58, 0xae8050, 0xbb8c5a][(i + l) % 4]!;
      parts.push(boardPiece(L + jitter(l * 7 + i) * 0.04, bt, bw, tone).translate(jitter(l * 3 + i) * 0.03, y + bt / 2, z));
    }
    y += bt;
    // przekładki w poprzek (powietrze między warstwami, żeby deski schły)
    if (l < layers - 1) {
      for (const x of [-0.3, 0, 0.3]) parts.push(beamPiece(0.025, 0.02, 4 * bw + 3 * gap + 0.02, 0x6b5238).translate(x, y + 0.01, 0));
      y += 0.02;
    }
  }
  return parts;
}

/** Stos jednego towaru złożony w jedną bryłę (grupy według materiału); wspólny dla stosów tej samej wielkości */
function pileModel(res: string, n: number): Built | null {
  const key = `${res}:${n}`;
  if (cache.has(key)) return cache.get(key)!;
  let parts: THREE.BufferGeometry[];
  if (res === 'wood') parts = lumber(Math.max(1, Math.min(6, n)));
  else {
    const item = groundLoad(res);
    if (!item) { cache.set(key, null); return null; }
    const box = item.boundingBox!;
    const w = box.max.x - box.min.x, d = box.max.z - box.min.z, h = box.max.y - box.min.y;
    // ile sztuk w rzędzie i ile rzędów zmieści paleta; reszta idzie warstwą wyżej (najwyżej trzy warstwy)
    const cols = Math.max(1, Math.floor((PALLET_W - 0.04) / (w + 0.02)));
    const rows = Math.max(1, Math.floor((PALLET_D - 0.02) / (d + 0.02)));
    const per = cols * rows;
    const count = Math.min(n, per * 3);
    parts = pallet();
    const pieces = splitGroups(item);
    for (let i = 0; i < count; i++) {
      const layer = Math.floor(i / per), k = i % per;
      // wyższa warstwa mniejsza i cofnięta do środka (piramidka), jak układa się worki i kosze
      const lc = layer ? Math.max(1, cols - layer) : cols, lr = layer ? Math.max(1, rows - (layer > 1 ? 1 : 0)) : rows;
      if (layer && k >= lc * lr) continue;
      const cx = k % lc, cz = Math.floor(k / lc);
      const x = (cx - (lc - 1) / 2) * (w + 0.02), z = (cz - (lr - 1) / 2) * (d + 0.02);
      const y = PALLET_H + layer * (h * 0.92);
      const turn = jitter(i + layer * 13) * 0.25;
      for (const p of pieces) {
        const c = p.clone();
        c.userData.mat = p.userData.mat;
        c.rotateY(turn).translate(x, y, z);
        parts.push(c);
      }
    }
  }
  const geo = assembleParts(parts);
  const built = geo ? { geo, mats: loadMaterials(geo) } : null;
  cache.set(key, built);
  return built;
}

/** Ile sztuk pokazać na stosie danego towaru */
function itemsFor(res: string, amt: number): number {
  if (res === 'wood') return Math.max(1, Math.min(6, Math.ceil(amt / 6)));
  return Math.max(1, Math.min(MAX_ITEMS, Math.ceil(amt / (UNIT[res] ?? 4))));
}

let signMat: THREE.SpriteMaterial | null = null;
/** Znak nad pełnym magazynem: tarcza jak przy „brak pracownika”, skrzynia ze strzałką w dół i czerwony wykrzyknik */
function fullSignMaterial(): THREE.SpriteMaterial {
  if (signMat) return signMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.88)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#e9c145'; x.stroke();
  // skrzynia z deskami
  x.fillStyle = '#c99a5a'; x.fillRect(30, 50, 52, 44);
  x.strokeStyle = '#2a1a0c'; x.lineWidth = 4; x.strokeRect(30, 50, 52, 44);
  x.beginPath(); x.moveTo(30, 72); x.lineTo(82, 72); x.moveTo(30, 50); x.lineTo(82, 94); x.stroke();
  // wykrzyknik: magazyn pełny
  x.fillStyle = '#d6372b'; x.beginPath(); x.roundRect(88, 32, 14, 42, 6); x.fill();
  x.beginPath(); x.arc(95, 88, 8, 0, Math.PI * 2); x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return signMat;
}

export class PileLayer {
  private shown = new Map<number, { obj: THREE.Group; key: string }>();
  private signs = new Map<number, THREE.Sprite>();
  private root = new THREE.Group();
  constructor(scene: THREE.Scene) { this.root.name = 'towar pod magazynami'; scene.add(this.root); }

  clear(): void {
    for (const s of this.shown.values()) this.root.remove(s.obj);
    for (const s of this.signs.values()) this.root.remove(s);
    this.shown.clear(); this.signs.clear();
  }

  /** Pola obok drzwi magazynu, na których kładzie się kolejne stosy: wzdłuż ściany po obu stronach wejścia, potem rząd dalej */
  private slots(g: GameState, storeId: number): { x: number; y: number; turn: number }[] {
    const b = g.buildings.find((o) => o.id === storeId);
    if (!b || b.door < 0) return [];
    const W = g.map.width;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    const dx = b.door % W, dy = Math.floor(b.door / W);
    const cx = b.x + fp.w / 2 - 0.5, cy = b.y + fp.h / 2 - 0.5;
    // wyjście w osi x (drzwi z boku) albo y (z przodu/tyłu): stosy idą wzdłuż ściany, prostopadle do wyjścia
    const alongX = Math.abs(dy - cy) >= Math.abs(dx - cx);
    const out = alongX ? Math.sign(dy - cy) || 1 : Math.sign(dx - cx) || 1;
    const res: { x: number; y: number; turn: number }[] = [];
    for (const row of [0, 1]) for (const k of [1, -1, 2, -2, 3, -3]) {
      const x = alongX ? dx + k : dx + row * out, y = alongX ? dy + row * out : dy + k;
      if (x < 1 || y < 1 || x >= W - 1 || y >= g.map.height - 1) continue;
      const t = y * W + x;
      if (g.occupancy[t] || g.reserved[t]) continue;
      res.push({ x, y, turn: alongX ? 0 : Math.PI / 2 });
    }
    return res;
  }

  sync(g: GameState, view: TerrainView, me: number, time: number): void {
    const list = g.piles ?? [];
    if (!list.length && !this.shown.size && !this.signs.size) return;
    const W = g.map.width, H = g.map.height;
    const alive = new Set<number>();
    // stosy pod każdym magazynem po kolei na wolne pola obok wejścia
    const byStore = new Map<number, Pile[]>();
    for (const p of list) { const l = byStore.get(p.store) ?? []; l.push(p); byStore.set(p.store, l); }
    for (const [storeId, piles] of byStore) {
      piles.sort((a, b) => a.id - b.id);
      const spots = storeId ? this.slots(g, storeId) : [];
      piles.forEach((p, i) => {
        const res = RESOURCES[p.res]!;
        const n = itemsFor(res, p.amt);
        const key = `${res}:${n}`;
        alive.add(p.id);
        let s = this.shown.get(p.id);
        if (!s || s.key !== key) {
          if (s) this.root.remove(s.obj);
          const model = pileModel(res, n);
          const obj = new THREE.Group();
          if (model) {
            // jedna siatka z tablicą materiałów (rysowanie po grupach); geometria wspólna dla stosów tej samej wielkości
            const m = new THREE.Mesh(model.geo, model.mats);
            m.castShadow = true; m.receiveShadow = true;
            obj.add(m);
          }
          this.root.add(obj);
          s = { obj, key };
          this.shown.set(p.id, s);
        }
        const spot = spots[i % Math.max(1, spots.length)];
        const tx = spot ? spot.x : p.t % W, ty = spot ? spot.y : Math.floor(p.t / W);
        s.obj.position.set(tx + 0.5 - W / 2, view.heightAt(tx + 0.5, ty + 0.5), ty + 0.5 - H / 2);
        s.obj.rotation.y = (spot?.turn ?? 0) + jitter(p.id) * 0.12;
      });
    }
    for (const [id, s] of this.shown) if (!alive.has(id)) { this.root.remove(s.obj); this.shown.delete(id); }
    // znak „pełno” nad magazynami gracza, pod którymi czeka towar
    const full = new Set<number>();
    for (const p of list) if (p.owner === me && p.store) full.add(p.store);
    for (const id of full) {
      const b = g.buildings.find((o) => o.id === id);
      if (!b) continue;
      let sign = this.signs.get(id);
      if (!sign) { sign = new THREE.Sprite(fullSignMaterial()); sign.scale.setScalar(0.6); sign.renderOrder = 4; this.root.add(sign); this.signs.set(id, sign); }
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      const cx = b.x + fp.w / 2, cy = b.y + fp.h / 2;
      sign.position.set(cx - W / 2 + 0.35, view.heightAt(cx, cy) + 3.1 + Math.sin(time * 2 + id) * 0.06, cy - H / 2);
      sign.material.rotation = Math.sin(time * 1.6 + id) * 0.15;
    }
    for (const [id, s] of this.signs) if (!full.has(id)) { this.root.remove(s); this.signs.delete(id); }
  }
}

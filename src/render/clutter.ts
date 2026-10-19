import { touch } from './touch';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { Terrain } from '../data/terrain';
import { hash2 } from '../sim/rng';
import type { GameState } from '../sim/state';
import { tint } from './loads';
import { bump, pattern } from './textures';
import { propGeometry, propMaterial } from './props';
import { toolGeometry, toolMaterials } from './gear';

/**
 * Graty przy domach: beczki, worki, siano, skrzynie, kupki śmieci, wiadra i taczki pod ścianami.
 * Tylko obraz — stoją na wolnych polach tuż przy budynku (nie na drodze, nie przy drzwiach), a gdy obok coś
 * zbudujesz albo położysz drogę, przestawiają się same. Każdy rodzaj to jedna siatka instancjonowana.
 */
type Kind = 'barrel' | 'sack' | 'hay' | 'crate' | 'trash' | 'bucket' | 'barrow' | 'logs';

const n = (g: THREE.BufferGeometry): THREE.BufferGeometry => (g.index ? g.toNonIndexed() : g);
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(parts.map(n))!;

/**
 * Skrzynia z desek: cztery narożne słupki, poziome klepki ze szparami (w środku ciemno), wieko z trzech desek
 * i żelazne okucia na rogach. Otwarta skrzynka ma zamiast wieka rzepy i jabłka.
 */
function crate(w: number, h: number, x: number, y: number, z: number, rot: number, open: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, c: number): void => { out.push(tint(g.rotateY(rot).translate(x, y, z), c)); };
  const SLAT = [0x8a6a42, 0x7d5e3a, 0x94724a, 0x846440];
  const post = 0.02, t = 0.012, rows = 3, gap = 0.008, sh = (h - gap * (rows + 1)) / rows;
  put(new THREE.BoxGeometry(w - 0.02, h - 0.01, w - 0.02).translate(0, h / 2, 0), 0x1c130b); // ciemne wnętrze widoczne w szparach
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    put(new THREE.BoxGeometry(post, h, post).translate(sx * (w / 2 - post / 2), h / 2, sz * (w / 2 - post / 2)), 0x5a3e24);
    // żelazne okucie na górnym i dolnym rogu
    for (const yy of [0.012, h - 0.012]) put(new THREE.BoxGeometry(post + 0.006, 0.014, post + 0.006).translate(sx * (w / 2 - post / 2), yy, sz * (w / 2 - post / 2)), 0x3a3836);
  }
  for (let side = 0; side < 4; side++)
    for (let r = 0; r < rows; r++) {
      const yy = gap + sh / 2 + r * (sh + gap);
      const along = w - post * 2;
      const g = side < 2 ? new THREE.BoxGeometry(along, sh, t) : new THREE.BoxGeometry(t, sh, along);
      const off = w / 2 - t / 2;
      g.translate(side === 2 ? -off : side === 3 ? off : 0, yy, side === 0 ? -off : side === 1 ? off : 0);
      put(g, SLAT[(side * 3 + r) % SLAT.length]!);
    }
  if (!open) {
    for (let k = 0; k < 3; k++) put(new THREE.BoxGeometry(w + 0.004, 0.012, (w - 0.008) / 3 - 0.004).translate(0, h + 0.006, -w / 3 + k * (w / 3)), SLAT[(k + 1) % SLAT.length]!);
    put(new THREE.BoxGeometry(0.014, 0.014, w * 0.95).translate(0, h + 0.016, 0), 0x5a3e24); // listwa w poprzek wieka
  } else {
    // pełna skrzynka: rzepy i jabłka wystają nad brzeg
    const FRUIT: [number, number, number, number][] = [[-0.026, -0.022, 0.019, 0xd8cfa8], [0.024, 0.02, 0.018, 0xb02a22], [0.02, -0.026, 0.017, 0xd8cfa8], [-0.022, 0.024, 0.017, 0xa83226], [0, 0, 0.019, 0xc9b98a], [0.026, -0.002, 0.016, 0x9a2a20]];
    for (const [fx, fz, r, c] of FRUIT) put(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.85, 1).translate(fx, h - 0.005, fz), c);
  }
  return out;
}

/** Model jednego rodzaju gratów (podgląd w podglad-wojsko.html?graty=1) */
export const clutterModel = (kind: Kind): THREE.BufferGeometry => geometry(kind);

/** Wysokość stojącej beczki przy domu (model z paczki ma wysokość 1, dno w zerze) */
const BARREL_H = 0.2;
/** Wiadro z Blendera wisi w dłoni (tools.py: środek w (0,15; 0,02), dno na 0,1) — tu stoi na ziemi */
const toGround = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.clone().translate(-0.15, -0.1, -0.02);
let waterMat: THREE.Material | null = null;

/**
 * Gotowe modele gratów: [siatka, materiał] — beczka to ta sama wypalona beczka co w stosach w składzie (`barrelLow`
 * z Poly Haven), wiadro to wiadro z wodą, które noszą chłopi (pełna wersja, z obręczami). Reszta to bryły z `geometry`.
 */
function models(kind: Kind): [THREE.BufferGeometry, THREE.Material | THREE.Material[]][] | null {
  if (kind === 'barrel') return [[propGeometry('barrelLow').clone().scale(BARREL_H, BARREL_H, BARREL_H), propMaterial('barrelLow')]];
  if (kind === 'bucket') {
    waterMat ??= new THREE.MeshStandardMaterial({ color: 0x4f8fb8, roughness: 0.2, metalness: 0.1 });
    return [[toGround(toolGeometry('bucket')), toolMaterials()], [toGround(toolGeometry('bucketWater')), [waterMat, waterMat, waterMat]]];
  }
  return null;
}

/** Graty do podglądu modeli: gotowy model z właściwymi materiałami albo bryła z kodu */
export function clutterObject(kind: Kind, fallback: THREE.Material): THREE.Object3D {
  const ms = models(kind);
  if (!ms) return new THREE.Mesh(geometry(kind), fallback);
  const g = new THREE.Group();
  for (const [geo, mat] of ms) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  return g;
}

function geometry(kind: Kind): THREE.BufferGeometry {
  const wood = 0x7a5232, dark = 0x3e2a1a, iron = 0x4a4844;
  switch (kind) {
    // beczka i wiadro to gotowe modele (beczka z paczki, wiadro z wodą z Blendera) — patrz `models()` niżej
    case 'barrel': case 'bucket': return new THREE.BufferGeometry();
    case 'sack': return merge([
      tint(new THREE.IcosahedronGeometry(0.075, 1).scale(1, 1.2, 0.85).translate(0, 0.085, 0), 0xb59a6a),
      tint(new THREE.CylinderGeometry(0.02, 0.035, 0.05, 6).translate(0, 0.18, 0), 0xa58a5a),
      tint(new THREE.IcosahedronGeometry(0.07, 1).scale(1.2, 0.8, 0.9).translate(0.11, 0.055, 0.04), 0xa88e60), // drugi worek obok
    ]);
    case 'hay': {
      // stóg siana jak ul: szeroki, pękaty dół, zaokrąglony czubek z żerdzią; profil obracany dookoła osi
      const prof = [[0, 0], [0.2, 0], [0.225, 0.05], [0.225, 0.13], [0.2, 0.22], [0.15, 0.3], [0.08, 0.36], [0.02, 0.385], [0, 0.39]].map(([x, y]) => new THREE.Vector2(x, y));
      const parts = [
        tint(new THREE.LatheGeometry(prof, 14), 0xc9a64e),
        tint(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 5).translate(0, 0.44, 0), 0x5a3e24), // żerdź
        tint(new THREE.TorusGeometry(0.205, 0.01, 4, 18).rotateX(Math.PI / 2).translate(0, 0.21, 0), 0x9a7a2a), // sznur przyciskający siano
      ];
      for (let k = 0; k < 9; k++) {
        const a2 = k * 0.71;
        parts.push(tint(new THREE.BoxGeometry(0.03, 0.006, 0.11).rotateY(a2).translate(Math.cos(a2) * 0.25, 0.004, Math.sin(a2) * 0.25), k % 2 ? 0xd2b158 : 0xbf9e48));
      }
      return merge(parts);
    }
    case 'crate': return merge([
      ...crate(0.17, 0.14, 0, 0, 0, 0, false),
      ...crate(0.12, 0.085, 0.025, 0.155, -0.01, 0.45, true),
    ]);
    case 'trash': return merge([
      tint(new THREE.IcosahedronGeometry(0.09, 0).scale(1.4, 0.35, 1).translate(0, 0.02, 0), 0x3f3527),
      tint(new THREE.BoxGeometry(0.06, 0.012, 0.03).rotateY(0.7).translate(0.05, 0.04, 0.02), 0x8a7a5a), // deska
      tint(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 6).rotateZ(1.3).translate(-0.05, 0.035, 0.01), 0x6a5a48), // skorupa dzbana
      tint(new THREE.IcosahedronGeometry(0.02, 0).translate(0.01, 0.045, -0.04), 0x5a6a3a), // łupiny
    ]);
    case 'barrow': {
      // taczka: skrzynia zwężająca się ku przodowi, koło ze szprychami na osi z przodu, dwa długie uchwyty i nóżki z tyłu
      const tub = new THREE.CylinderGeometry(0.095, 0.07, 0.07, 4, 1).rotateY(Math.PI / 4).scale(1.25, 1, 0.9);
      const parts = [
        tint(tub.translate(0.0, 0.11, 0), wood),
        tint(new THREE.BoxGeometry(0.17, 0.012, 0.13).translate(0, 0.077, 0), dark), // dno
        tint(new THREE.TorusGeometry(0.045, 0.01, 5, 14).translate(0.15, 0.047, 0), dark), // obręcz koła
        tint(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6).rotateX(Math.PI / 2).translate(0.15, 0.047, 0), iron), // oś
        ...[0, 1, 2].map((k) => tint(new THREE.BoxGeometry(0.008, 0.088, 0.008).rotateZ((k / 3) * Math.PI).translate(0.15, 0.047, 0), wood)),
      ];
      for (const sz of [-0.05, 0.05]) {
        parts.push(tint(new THREE.BoxGeometry(0.34, 0.016, 0.016).rotateZ(0.12).translate(-0.02, 0.085, sz), dark)); // uchwyt biegnie pod skrzynią do koła
        parts.push(tint(new THREE.BoxGeometry(0.014, 0.07, 0.014).translate(-0.09, 0.035, sz), dark)); // nóżka
      }
      return merge(parts);
    }
    case 'logs': return merge([0, 1, 2].map((i) => tint(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 7).rotateZ(Math.PI / 2).translate(0, 0.035 + (i === 2 ? 0.06 : 0), (i === 2 ? 0 : i - 0.5) * 0.075), i === 1 ? 0x6b4a2b : 0x7a5535)));
  }
}

/** Co leży przy jakim budynku */
const KINDS: Record<string, Kind[]> = {
  house: ['barrel', 'trash', 'bucket', 'sack', 'logs'],
  tavern: ['barrel', 'barrel', 'crate', 'trash'],
  bakery: ['sack', 'sack', 'logs', 'crate'],
  mill: ['sack', 'sack', 'barrow'],
  farm: ['hay', 'hay', 'barrow'],
  barn: ['hay', 'crate', 'barrow'],
  granary: ['sack', 'sack', 'crate'],
  stockpile: ['crate', 'barrel', 'barrow'],
  woodcutter: ['logs', 'barrow'],
  quarry: ['barrow', 'bucket'],
  mine: ['barrow', 'crate'],
  orchard: ['crate', 'barrow'],
  fisher: ['barrel', 'bucket'],
  barracks: ['barrel', 'crate'],
  engineers: ['crate', 'logs', 'barrow'],
  poleturner: ['logs', 'crate'],
  fletcher: ['logs', 'crate'],
  camp: ['trash', 'logs'],
};
const ALL: Kind[] = ['barrel', 'sack', 'hay', 'crate', 'trash', 'bucket', 'barrow', 'logs'];
const MAX = 1500;
/** Pola zajęte przez graty (czyta je podwórko rodzin w family.ts, żeby balia nie stanęła na beczce) */
export const clutterTaken = new Set<number>();

export class Clutter {
  readonly group = new THREE.Group();
  /** Każdy rodzaj: jedna siatka instancjonowana albo kilka (wiadro + woda), ustawiane razem */
  private meshes = new Map<Kind, THREE.InstancedMesh[]>();
  private key = '';

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    // drewniane graty ze słojami desek (tekstura w mniejszej skali, żeby na małej klepce było widać jedno usłojenie)
    // tekstura ta sama co na budynkach (dociąga się do niej zdjęcie desek), a skalę słojów zmniejsza geometria
    const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: pattern('planks') });
    const WOODEN = new Set<Kind>(['crate', 'barrow', 'logs']);
    // siano dostaje teksturę strzechy (źdźbła), reszta gratów gładkie barwy
    const hayMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('thatch'), bumpMap: bump('thatch'), bumpScale: 1.2 });
    for (const k of ALL) {
      const ready = models(k);
      if (ready) {
        const list = ready.map(([geo, mat]) => {
          const m = new THREE.InstancedMesh(geo, mat, MAX);
          m.count = 0; m.castShadow = true; m.receiveShadow = true;
          this.group.add(m);
          return m;
        });
        this.meshes.set(k, list);
        continue;
      }
      const geo = geometry(k);
      if (WOODEN.has(k)) { const uv = geo.attributes.uv; if (uv) { for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35, uv.getY(i) * 0.35); uv.needsUpdate = true; } }
      const m = new THREE.InstancedMesh(geo, k === 'hay' ? hayMat : WOODEN.has(k) ? woodMat : mat, MAX);
      m.count = 0; m.castShadow = true; m.receiveShadow = true;
      this.meshes.set(k, [m]);
      this.group.add(m);
    }
  }

  /** Przestawia graty, gdy zmieniły się budynki albo drogi (tanio sprawdzane po kluczu) */
  sync(g: GameState, heightAt: (x: number, y: number) => number): void {
    let roads = 0;
    for (let i = 0; i < g.roads.length; i += 7) roads += g.roads[i]!;
    const key = `${g.buildings.length}:${g.nextId}:${roads}:${g.buildings.reduce((s, b) => s + (b.build ? 1 : 0) + (b.ruined ? 2 : 0), 0)}`;
    if (key === this.key) return;
    this.key = key;
    const { width: w, height: h } = g.map;
    const counts = new Map<Kind, number>(ALL.map((k) => [k, 0]));
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const used = clutterTaken;
    used.clear();
    const free = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const t = y * w + x;
      const terr = g.map.tiles[t];
      return g.occupancy[t] === 0 && !g.roads[t] && !g.reserved[t] && terr !== Terrain.Water && terr !== Terrain.Mountain && terr !== Terrain.Forest && !used.has(t);
    };
    for (const b of g.buildings) {
      const def = BUILDINGS[b.type]!;
      const kinds = KINDS[def.id];
      if (!kinds || b.build || b.ruined) continue;
      const fp = footprint(def, b.rot);
      const dx0 = b.door % w, dy0 = Math.floor(b.door / w);
      // pola tuż przy ścianach; dla każdego wiemy, z której strony jest ściana
      const ring: [number, number, number, number][] = [];
      for (let x = b.x; x < b.x + fp.w; x++) { ring.push([x, b.y - 1, 0, 1]); ring.push([x, b.y + fp.h, 0, -1]); }
      for (let y = b.y; y < b.y + fp.h; y++) { ring.push([b.x - 1, y, 1, 0]); ring.push([b.x + fp.w, y, -1, 0]); }
      const want = 2 + (hash2(b.id, 1, 77) % 3);
      let placed = 0;
      for (let k = 0; k < ring.length && placed < want; k++) {
        const pick = ring[(hash2(b.id, k, 91) % ring.length + k * 7) % ring.length]!;
        const [tx, ty, nx, ny] = pick;
        // przy drzwiach przejście zostaje wolne
        if (b.door >= 0 && Math.abs(tx - dx0) <= 1 && Math.abs(ty - dy0) <= 1) continue;
        if (!free(tx, ty)) continue;
        used.add(ty * w + tx);
        const kind = kinds[(hash2(b.id, k, 13) % kinds.length)]!;
        const c = counts.get(kind)!;
        if (c >= MAX) continue;
        const r = (s: number): number => (hash2(b.id, k, s) % 1000) / 1000;
        // przyklejone do ściany: środek pola przesunięty w stronę budynku, trochę w bok
        const px = tx + 0.5 + nx * 0.28 + (ny ? (r(3) - 0.5) * 0.5 : 0);
        const py = ty + 0.5 + ny * 0.28 + (nx ? (r(4) - 0.5) * 0.5 : 0);
        P.set(px - w / 2, heightAt(px, py) - 0.01, py - h / 2);
        Q.setFromAxisAngle(Y, r(5) * Math.PI * 2);
        S.setScalar(0.85 + r(6) * 0.35);
        M.compose(P, Q, S);
        for (const m of this.meshes.get(kind)!) m.setMatrixAt(c, M);
        counts.set(kind, c + 1);
        placed++;
      }
    }
    for (const [k, list] of this.meshes) for (const m of list) { m.count = counts.get(k)!; touch(m); m.computeBoundingSphere(); }
  }

  reset(): void { this.key = ''; for (const list of this.meshes.values()) for (const m of list) m.count = 0; }
}

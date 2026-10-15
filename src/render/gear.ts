import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import TOOLS_MODEL from './models/tools.json';
import { normal, pattern } from './textures';

/**
 * Broń chłopa z Blendera (tools/models/tools.py): kilof i maczuga w dłoni (układ ramienia: oś w barku, dłoń 0,19 niżej,
 * stylisko w przód z pięści) albo schowane w układzie postaci: kilof płasko na plecach, maczuga za sznurem u biodra.
 * Każda siatka ma dwie grupy: drewno (tekstura kory/słojów) i żelazo (metal), więc jedna instancja = jedno wywołanie.
 */
type ToolPart = { mat: string; pos: string; ao: string };
const T = TOOLS_MODEL as unknown as { q: number } & Record<string, ToolPart[]>;
const COLOR: Record<string, number> = { wood: 0x8a6440, iron: 0x6a6e76 };
const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

function partGeo(p: ToolPart): THREE.BufferGeometry {
  const raw = b64(p.pos), p16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), ao = b64(p.ao);
  const n = p16.length / 3, P = new Float32Array(n * 3), C = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  for (let i = 0; i < p16.length; i++) P[i] = p16[i]! / T.q;
  const c = new THREE.Color(COLOR[p.mat] ?? 0x888888);
  for (let i = 0; i < n; i++) { const k = ao[i]! / 255; C[i * 3] = c.r * k; C[i * 3 + 1] = c.g * k; C[i * 3 + 2] = c.b * k; }
  // słoje wzdłuż styliska: tekstura rzutowana z boku, gęsto (stylisko jest cienkie)
  for (let i = 0; i < n; i++) { UV[i * 2] = (P[i * 3]! + P[i * 3 + 1]!) * 6; UV[i * 2 + 1] = P[i * 3 + 2]! * 6; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.computeVertexNormals();
  return g;
}

/** Siatka narzędzia z grupami [drewno, żelazo] (pusta grupa dostaje zdegenerowany trójkąt, żeby indeksy grup się zgadzały) */
export function toolGeometry(name: string): THREE.BufferGeometry {
  const parts = T[name] ?? [];
  const byMat = (m: string): THREE.BufferGeometry => {
    const p = parts.find((x) => x.mat === m);
    if (p) return partGeo(p);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
    return g;
  };
  return mergeGeometries([byMat('wood'), byMat('iron')], true)!;
}

let mats: THREE.Material[] | null = null;
/** Materiały narzędzi: [drewno z teksturą kory, kute żelazo] — wspólne dla wszystkich chłopów */
export function toolMaterials(): THREE.Material[] {
  if (mats) return mats;
  const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: pattern('bark'), normalMap: normal('bark') });
  const iron = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 });
  mats = [wood, iron];
  return mats;
}

/**
 * Siatka z Blendera do instancjonowania (wiele sztuk jednym wywołaniem): grupy w kolejności `mats`
 * (np. drewno, ciemne drewno, płótno, żelazo) — do każdej trzeba podać materiał w tej samej kolejności.
 */
export function partsGeometry(model: { q: number } & Record<string, unknown>, group: string, mats: string[], colors: Record<string, number>): THREE.BufferGeometry {
  const parts = (model[group] as ToolPart[] | undefined) ?? [];
  const geos = mats.map((m) => {
    const p = parts.find((x) => x.mat === m);
    if (!p) {
      const g = new THREE.BufferGeometry();
      for (const [a, n] of [['position', 3], ['color', 3], ['uv', 2], ['normal', 3]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(3 * n), n));
      return g;
    }
    const raw = b64(p.pos), p16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), ao = b64(p.ao);
    const n = p16.length / 3, P = new Float32Array(n * 3), C = new Float32Array(n * 3), UV = new Float32Array(n * 2);
    for (let i = 0; i < p16.length; i++) P[i] = p16[i]! / model.q;
    const c = new THREE.Color(colors[m] ?? 0x888888);
    for (let i = 0; i < n; i++) { const k = ao[i]! / 255; C[i * 3] = c.r * k; C[i * 3 + 1] = c.g * k; C[i * 3 + 2] = c.b * k; }
    // tekstura rzutowana z płaszczyzny ściany trójkąta (jak w budynkach z Blendera)
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nr = new THREE.Vector3();
    for (let t = 0; t < n; t += 3) {
      e1.set(P[t * 3 + 3]! - P[t * 3]!, P[t * 3 + 4]! - P[t * 3 + 1]!, P[t * 3 + 5]! - P[t * 3 + 2]!);
      e2.set(P[t * 3 + 6]! - P[t * 3]!, P[t * 3 + 7]! - P[t * 3 + 1]!, P[t * 3 + 8]! - P[t * 3 + 2]!);
      nr.crossVectors(e1, e2);
      const ax = Math.abs(nr.x), ay = Math.abs(nr.y), az = Math.abs(nr.z);
      for (let v = t; v < t + 3; v++) {
        const x = P[v * 3]!, y = P[v * 3 + 1]!, z = P[v * 3 + 2]!;
        const [u, w] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
        UV[v * 2] = u * 3; UV[v * 2 + 1] = w * 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.computeVertexNormals();
    return g;
  });
  return mergeGeometries(geos, true)!;
}

export function peasantGear(): { pick: THREE.BufferGeometry; club: THREE.BufferGeometry; backPick: THREE.BufferGeometry; beltClub: THREE.BufferGeometry } {
  return { pick: toolGeometry('pick'), club: toolGeometry('club'), backPick: toolGeometry('backPick'), beltClub: toolGeometry('beltClub') };
}

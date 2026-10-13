import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingModel } from './buildings';

/**
 * Proceduralne modele z prostych brył. Każdy model powstaje przez tę fabrykę,
 * więc późniejsza podmiana na pliki glTF nie dotyka reszty renderera.
 */
export interface ModelFactory {
  /** Świerk: pień i korona z kilku pięter */
  treeTrunk(): THREE.BufferGeometry;
  treeCrown(): THREE.BufferGeometry;
  /** Uproszczony świerk na daleki plan (pień i korona w jednej, lekkiej bryle) */
  treeCrownFar(): THREE.BufferGeometry;
  /** Uproszczona korona drzewa liściastego na daleki plan */
  leafCrownFar(): THREE.BufferGeometry;
  /** Drzewo liściaste */
  leafTrunk(): THREE.BufferGeometry;
  leafCrown(): THREE.BufferGeometry;
  /** Kępka trawy */
  tuft(): THREE.BufferGeometry;
  /** Krzew */
  bush(): THREE.BufferGeometry;
  /** Kwiat polny (sama główka z łodyżką) */
  flower(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  building(id: string, teamColor: number): THREE.Group;
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => g.translate(x, y, z);

export const proceduralModels: ModelFactory = {
  treeTrunk() {
    return at(new THREE.CylinderGeometry(0.06, 0.11, 0.55, 6), 0, 0.27, 0);
  },
  treeCrown() {
    // Świerk z pięciu pięter gałęzi. Każde piętro to „spódnica” o postrzępionym brzegu: końce gałęzi wystają
    // i opadają, między nimi wcięcia. Kolor w wierzchołkach: jaśniejsze końce i czubek, ciemne wnętrze przy pniu.
    const P: number[] = [], C: number[] = [], U: number[] = [];
    const TIERS = 5, B = 7;
    let seed = 11;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let t = 0; t < TIERS; t++) {
      const f = t / (TIERS - 1);
      const y0 = 0.36 + f * 1.05, R = 0.5 - f * 0.33, hT = 0.42 - f * 0.08;
      const twist = t * 0.7;
      const apex = [0, y0 + hT, 0];
      const ring: number[][] = [];
      for (let k = 0; k < B * 2; k++) {
        const a = (k / (B * 2)) * Math.PI * 2 + twist;
        const tip = k % 2 === 0;
        const r = tip ? R * (0.9 + rnd() * 0.25) : R * 0.58;
        ring.push([Math.cos(a) * r, y0 + (tip ? -0.07 * (1 - f * 0.5) : 0.06), Math.sin(a) * r, tip ? 1.25 : 0.78]);
      }
      for (let k = 0; k < B * 2; k++) {
        const p0 = ring[k]!, p1 = ring[(k + 1) % (B * 2)]!;
        for (const v of [apex, p1, p0]) {
          P.push(v[0]!, v[1]!, v[2]!);
          const c = v === apex ? 1.05 + f * 0.1 : v[3]!;
          C.push(c * 0.92, c, c * 0.9);
          U.push(v[0]! * 2 + 0.5, v[2]! * 2 + v[1]!);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.computeVertexNormals();
    // normalne wygładzone na zewnątrz i lekko w górę: korona świeci miękko jak gęste igliwie, bez ostrych ścianek
    const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), l = Math.hypot(x, z) || 1;
      const n = new THREE.Vector3(x / l * 0.8 + nor.getX(i) * 0.3, 0.75, z / l * 0.8 + nor.getZ(i) * 0.3).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  },
  treeCrownFar() {
    const crown = new THREE.ConeGeometry(0.46, 1.45, 6).translate(0, 1.0, 0).toNonIndexed();
    const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 4).translate(0, 0.2, 0).toNonIndexed();
    crown.deleteAttribute('uv'); trunk.deleteAttribute('uv');
    const g = mergeGeometries([crown, trunk])!;
    const n = (g.attributes.position as THREE.BufferAttribute).count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  },
  leafTrunk() {
    return mergeGeometries([
      at(new THREE.CylinderGeometry(0.07, 0.12, 0.6, 6), 0, 0.3, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 5).rotateZ(0.8), -0.13, 0.62, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 5).rotateZ(-0.8), 0.13, 0.66, 0.02),
    ]);
  },
  leafCrownFar() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.38, 0), 0, 0.95, 0),
      at(new THREE.IcosahedronGeometry(0.28, 0), -0.25, 0.8, 0.08),
      at(new THREE.IcosahedronGeometry(0.28, 0), 0.24, 0.84, -0.06),
    ])!;
  },
  leafCrown() {
    // korona z trzech gruzłowatych brył (wierzchołki odsunięte szumem), razem 200 trójkątów zamiast 320
    const lump = (r: number, detail: number, x: number, y: number, z: number, seed: number): THREE.BufferGeometry => {
      const g = new THREE.IcosahedronGeometry(r, detail);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const k = 1 + Math.sin(vx * 17 + seed) * Math.cos(vz * 13 - seed) * 0.12 + Math.sin(vy * 21 + seed * 2) * 0.06;
        p.setXYZ(i, vx * k + x, vy * k * 0.92 + y, vz * k + z);
      }
      return g;
    };
    return mergeGeometries([lump(0.4, 1, 0, 0.95, 0, 1), lump(0.29, 1, -0.26, 0.8, 0.1, 2), lump(0.3, 0, 0.25, 0.84, -0.08, 3), lump(0.24, 0, 0.03, 0.82, 0.27, 4)])!;
  },
  tuft() {
    // kępa trawy: kilkanaście cienkich, wygiętych źdźbeł (taśma zwężająca się ku górze, trzy odcinki),
    // u nasady ciemne, na końcach jaśniejsze i żółtawe; normalne w górę, więc kępa świeci jak ziemia pod nią
    const P: number[] = [], C: number[] = [], N: number[] = [];
    let seed = 7;
    const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const BL = 13, SEG = 2;
    for (let b = 0; b < BL; b++) {
      const ang = rnd() * Math.PI * 2;
      const r0 = rnd() * 0.07;
      const bx = Math.cos(ang) * r0, bz = Math.sin(ang) * r0;
      const face = rnd() * Math.PI * 2;
      const len = 0.13 + rnd() * 0.17;
      const bend = 0.05 + rnd() * 0.12;
      const wid = 0.011 + rnd() * 0.008;
      const fx = Math.cos(face), fz = Math.sin(face);
      // kierunek pochylenia: na zewnątrz kępy
      const lx = Math.cos(ang), lz = Math.sin(ang);
      const yellow = rnd() < 0.15;
      const pt = (t: number, side: number): [number, number, number] => {
        const ww = wid * (1 - t) * side;
        return [bx + lx * bend * t * t + -fz * ww, len * t * (1 - 0.15 * t * t), bz + lz * bend * t * t + fx * ww];
      };
      const col = (t: number): [number, number, number] => {
        const k = 0.55 + t * 0.4;
        return yellow ? [k * 1.05, k * 1.0, k * 0.62] : [k * 0.86, k, k * 0.72];
      };
      for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG, t1 = (i + 1) / SEG;
        const a = pt(t0, -1), bb = pt(t0, 1), c = pt(t1, -1), d = pt(t1, 1);
        const ca = col(t0), cc = col(t1);
        for (const [v, cl] of [[a, ca], [bb, ca], [c, cc], [c, cc], [bb, ca], [d, cc]] as const) { P.push(...v); C.push(...cl); N.push(lx * 0.25, 0.95, lz * 0.25); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    return g;
  },
  bush() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.24, 1), 0, 0.2, 0),
      at(new THREE.IcosahedronGeometry(0.18, 1), -0.2, 0.15, 0.06),
      at(new THREE.IcosahedronGeometry(0.19, 1), 0.19, 0.16, -0.05),
      at(new THREE.IcosahedronGeometry(0.15, 1), 0.03, 0.14, 0.2),
    ]);
  },
  flower() {
    // kwiat polny: cienka łodyżka i mała, płaska główka z pięciu płatków (z góry widać kolorową gwiazdkę, nie kulkę)
    const petals: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) petals.push(new THREE.SphereGeometry(0.018, 5, 3).scale(1, 0.3, 0.55).translate(0.02, 0.13, 0).rotateY((i / 5) * Math.PI * 2).toNonIndexed());
    return mergeGeometries([
      new THREE.CylinderGeometry(0.004, 0.005, 0.13, 3).translate(0, 0.065, 0).toNonIndexed(),
      ...petals,
      new THREE.SphereGeometry(0.012, 5, 3).translate(0, 0.135, 0).toNonIndexed(),
    ]);
  },
  rock() {
    // głaz z nierównymi ścianami: wierzchołki przesunięte zależnie od położenia, więc bryła pozostaje szczelna
    const g = new THREE.IcosahedronGeometry(0.34, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.82 + (Math.sin(x * 37.1 + y * 11.7) * Math.cos(z * 29.3 - x * 5.1) + 1) * 0.16;
      p.setXYZ(i, x * k, Math.max(y * k, -0.12), z * k);
    }
    g.computeVertexNormals();
    g.scale(1, 0.7, 1);
    g.translate(0, 0.12, 0);
    return g;
  },
  building: buildingModel,
};

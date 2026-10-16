import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingModel } from './buildings';
import PLANTS from './models/plants.json';
import { boxUv, modelGeo } from './peasants';

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
  /** Bryła cienia korony liściastej: te same gruzły co korona, z mniejszej liczby ścian */
  leafCrownShadow(): THREE.BufferGeometry;
  /** Kępka trawy */
  tuft(): THREE.BufferGeometry;
  /** Krzew */
  bush(): THREE.BufferGeometry;
  /** Kwiat polny (sama główka z łodyżką) */
  flower(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  /** Głaz z daleka (ten sam kształt z 20 ścian) */
  rockFar(): THREE.BufferGeometry;
  /** Krzak z daleka (te same kępy z mniejszej liczby ścian) — też jako bryła cienia */
  bushFar(): THREE.BufferGeometry;
  building(id: string, teamColor: number): THREE.Group;
}


/** Krzaki i głazy z Blendera (tools/models/plants.py): pozycje, normalne i cień w zagłębieniach (kolor wierzchołków
 *  w szarości — barwę daje instancja), współrzędne tekstury rzutowane z boków bryły */
function plantGeo(name: string, flat: boolean, uvScale: number): THREE.BufferGeometry {
  const src = (PLANTS as unknown as Record<string, Parameters<typeof modelGeo>[0]>)[name]!;
  const g = modelGeo(src).toNonIndexed();
  if (flat) g.computeVertexNormals(); // głaz: płaskie ściany (normalne trójkątów); krzak zostaje z gładkimi normalnymi z Blendera
  return boxUv(g, uvScale);
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => g.translate(x, y, z);

export const proceduralModels: ModelFactory = {
  treeTrunk() {
    // wysoki pień: pierwsze gałęzie dopiero nad głowami ludzi (z instancją ok. 2,5 wzrostu chłopa)
    return at(new THREE.CylinderGeometry(0.06, 0.12, 1.3, 7), 0, 0.64, 0);
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
      const y0 = 0.9 + f * 1.15, R = 0.54 - f * 0.36, hT = 0.44 - f * 0.08;
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
    const crown = new THREE.ConeGeometry(0.5, 1.6, 6).translate(0, 1.62, 0).toNonIndexed();
    const trunk = new THREE.CylinderGeometry(0.05, 0.09, 0.95, 4).translate(0, 0.47, 0).toNonIndexed();
    crown.deleteAttribute('uv'); trunk.deleteAttribute('uv');
    const g = mergeGeometries([crown, trunk])!;
    const n = (g.attributes.position as THREE.BufferAttribute).count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  },
  leafTrunk() {
    return mergeGeometries([
      at(new THREE.CylinderGeometry(0.07, 0.13, 1.2, 7), 0, 0.6, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5).rotateZ(0.8), -0.14, 1.2, 0),
      at(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5).rotateZ(-0.8), 0.14, 1.25, 0.02),
    ]);
  },
  leafCrownFar() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.42, 0), 0, 1.6, 0),
      at(new THREE.IcosahedronGeometry(0.31, 0), -0.28, 1.43, 0.08),
      at(new THREE.IcosahedronGeometry(0.31, 0), 0.27, 1.47, -0.06),
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
    // korona wysoko na pniu (pod nią swobodnie przechodzi człowiek), trochę szersza
    return mergeGeometries([lump(0.44, 1, 0, 1.6, 0, 1), lump(0.32, 1, -0.29, 1.43, 0.1, 2), lump(0.33, 0, 0.28, 1.47, -0.08, 3), lump(0.27, 0, 0.03, 1.45, 0.3, 4)])!;
  },
  leafCrownShadow() {
    // te same cztery gruzły i ten sam szum, tylko każdy z 20 ścian (80 trójkątów zamiast 200)
    const lump = (r: number, x: number, y: number, z: number, seed: number): THREE.BufferGeometry => {
      const g = new THREE.IcosahedronGeometry(r * 1.03, 0);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const k = 1 + Math.sin(vx * 17 + seed) * Math.cos(vz * 13 - seed) * 0.12 + Math.sin(vy * 21 + seed * 2) * 0.06;
        p.setXYZ(i, vx * k + x, vy * k * 0.92 + y, vz * k + z);
      }
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      return g;
    };
    return mergeGeometries([lump(0.44, 0, 1.6, 0, 1), lump(0.32, -0.29, 1.43, 0.1, 2), lump(0.33, 0.28, 1.47, -0.08, 3), lump(0.27, 0.03, 1.45, 0.3, 4)])!;
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
    // krzak z Blendera: cztery kępy liści z gałązkami i dziurami (ok. 220 trójkątów zamiast 320)
    return plantGeo('bush', false, 2.2);
  },
  bushFar() {
    return plantGeo('bushFar', false, 2.2);
  },
  flower() {
    // kwiat polny: cienka łodyżka i mała, płaska główka z pięciu płatków (z góry widać kolorową gwiazdkę, nie kulkę)
    const petals: THREE.BufferGeometry[] = [];
    // płatek to spłaszczony ośmiościan (8 trójkątów zamiast 20 w kulce); przy 3–4 cm i płaskim cieniowaniu wygląda tak samo
    for (let i = 0; i < 5; i++) petals.push(new THREE.OctahedronGeometry(0.019, 0).scale(1, 0.3, 0.55).translate(0.02, 0.13, 0).rotateY((i / 5) * Math.PI * 2));
    const parts = [
      new THREE.CylinderGeometry(0.004, 0.005, 0.13, 3, 1, true).translate(0, 0.065, 0).toNonIndexed(),
      ...petals,
      new THREE.OctahedronGeometry(0.012, 0).translate(0, 0.135, 0),
    ];
    for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') p.deleteAttribute(k);
    return mergeGeometries(parts)!;
  },
  rock() {
    // głaz z Blendera: nieregularna bryła o płaskich ścianach, spód osadzony w ziemi (80 trójkątów)
    return plantGeo('rock', true, 2.5);
  },
  rockFar() {
    return plantGeo('rockFar', true, 2.5);
  },
  building: buildingModel,
};

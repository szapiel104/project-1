import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingModel } from './buildings';
import { boxUv, modelGeo } from './peasants';
import { treeGeo } from './foliage';
import { model } from './modelstore';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
const PLANTS = model('plants');

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
  /** Bryła cienia korony świerka (trzy stożki) */
  pineCrownShadow(): THREE.BufferGeometry;
  /** Paproć (trzy skrzyżowane karty) i opadła gałąź — podszyt lasu */
  fern(): THREE.BufferGeometry;
  deadwood(): THREE.BufferGeometry;
  /** Murek z polnych kamieni, jedno pole długości (wzdłuż x) */
  drywall(): THREE.BufferGeometry;
  /** Kępka trawy */
  tuft(): THREE.BufferGeometry;
  /** Krzew */
  bush(): THREE.BufferGeometry;
  /** Kwiat polny (sama główka z łodyżką) */
  flower(): THREE.BufferGeometry;
  rock(): THREE.BufferGeometry;
  /** Głaz z daleka (ten sam kształt z 20 ścian) */
  rockFar(): THREE.BufferGeometry;
  /** Trzy odmiany głazu polnego (obły, kanciasty, z mniejszym kamieniem): [z bliska, z daleka] */
  boulders(): [THREE.BufferGeometry, THREE.BufferGeometry][];
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
    // pień świerka z Blendera (tools/models/trees.py): zwęża się aż do czubka, nisko suche kikuty gałęzi
    return treeGeo('pineTrunk');
  },
  treeCrown() {
    // korona świerka z kart igliwia: 9 pięter opadających gałęzi, każda z dwóch skrzyżowanych kart
    return treeGeo('pineCrown');
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
    // pień z konarami i gałązkami (drzewo liściaste z Blendera)
    return treeGeo('leafTrunk');
  },
  leafCrownFar() {
    return mergeGeometries([
      at(new THREE.IcosahedronGeometry(0.42, 0), 0, 1.6, 0),
      at(new THREE.IcosahedronGeometry(0.31, 0), -0.28, 1.43, 0.08),
      at(new THREE.IcosahedronGeometry(0.31, 0), 0.27, 1.47, -0.06),
    ])!;
  },
  leafCrown() {
    // korona z ok. 36 kęp liści (po trzy skrzyżowane karty) na nierównej elipsoidzie
    return treeGeo('leafCrown');
  },
  leafCrownShadow() {
    // zamknięta elipsoida w obrysie korony: cień bez dziur i dużo tańszy niż karty
    return treeGeo('leafShadow');
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
  pineCrownShadow() { return treeGeo('pineShadow'); },
  fern() {
    // karta paproci: u wzdłuż wysokości w modelu, a tekstura ma nasadę na dole — zamiana osi
    const g = treeGeo('fern'), uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u); }
    return g;
  },
  deadwood() { return treeGeo('deadwood'); },
  drywall() { return plantGeo('drywall', true, 2.2); },
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
  boulders() {
    // głazy z Blendera (tools/models/plants.py, boulder0–2): ciemniejsze, z ziemistym spodem i porostami na wierzchu
    return [0, 1, 2].map((k) => [plantGeo(`boulder${k}`, true, 2.5), plantGeo(`boulder${k}Far`, true, 2.5)] as [THREE.BufferGeometry, THREE.BufferGeometry]);
  },
  building: buildingModel,
};

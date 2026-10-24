import { touch } from './touch';
import * as THREE from 'three';
import { cloudShade } from './ground';
import { cat } from './cat';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { grayPattern, normal, pattern } from './textures';
import { charTexture } from './chartex';
import { model } from './modelstore';
// modele z Blendera (pobrane wcześniej przez loadModels; same pliki w src/render/models)
const GUARD_MODEL = model('guard');
const MANATARMS_MODEL = model('manatarms');
const PEASANT_MODEL = model('peasant');
const SPEARMAN_MODEL = model('spearman');
const ARCHER_MODEL = model('archer');
const WOMAN_MODEL = model('woman');
const KING_MODEL = model('king');
const CHILD_MODEL = model('child');
const SAPPER_MODEL = model('sapper');
const BANDIT_MODEL = model('bandit');
const MAGE_FIRE_MODEL = model('mage_fire');
const MAGE_WATER_MODEL = model('mage_water');

/** Siatka z modelu wygenerowanego w Blenderze: pozycje (float32), normalne (int8), kolory sRGB (uint8), indeksy (uint16), wszystko w base64 */
export interface ModelMesh { mat: string; dyn: string | null; show: string | null; pos: string; nrm: string; col: string; idx: string }
/** Postać z Blendera: środki obrotu i siatki tułowia, nogi i ręki (z bliska i z daleka) */
interface FigureModel {
  hip: number[]; shoulder: number[]; hand: number[];
  static: ModelMesh[]; leg: ModelMesh[]; arm: ModelMesh[];
  far_static: ModelMesh[]; far_leg: ModelMesh[]; far_arm: ModelMesh[];
}
const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function modelGeo(m: ModelMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = b64(m.pos), nrm = b64(m.nrm), col = b64(m.col), idx = b64(m.idx);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.buffer, pos.byteOffset, pos.byteLength / 4), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nrm.buffer, nrm.byteOffset, nrm.byteLength), 3, true));
  // kolory zapisane w sRGB (jak w Blenderze), a kolory wierzchołków w Three.js są liniowe
  const lin = new Float32Array(col.length);
  for (let i = 0; i < col.length; i++) { const c = col[i]! / 255; lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  geo.setAttribute('color', new THREE.BufferAttribute(lin, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(idx.buffer.slice(idx.byteOffset, idx.byteOffset + idx.byteLength)), 1));
  geo.computeBoundingSphere();
  return geo;
}

interface Part {
  mesh: THREE.InstancedMesh;
  pos: THREE.Vector3;
  /** Obrót wokół osi X: wymach nogi lub ręki */
  rot: (swing: number, armsUp: boolean) => number;
  /** Kolor tej części dla danej osoby; null = stały kolor materiału */
  color: ((look: Look) => number) | null;
  /** Czy ta osoba w ogóle ma tę część (np. kaptur zamiast kapelusza) */
  shown: (look: Look) => boolean;
  /** Druga oś obrotu w dłoni (łuk zostaje pionowo, choć ręka się unosi) */
  sub?: { at: THREE.Vector3; rot: (swing: number, armsUp: boolean) => number };
  /** Przedramię za łokciem (łucznik): w walce kąt łokcia z pozy (pose[4]) */
  elbow?: boolean;
  /** Kula czaru w dłoni maga: widać ją tylko przy czarowaniu (armsUp) */
  orb?: boolean;
  /** 0 = wersja z bliska, 1 = uproszczona wersja z daleka */
  lod: 0 | 1;
}

const legL = (s: number): number => s, legR = (s: number): number => -s;
const armL = (s: number, up: boolean): number => (up ? -1.35 : -s * 0.8), armR = (s: number, up: boolean): number => (up ? -1.35 : s * 0.8);

type Mat = 'cloth' | 'leather' | 'metal' | 'mail' | 'skin' | 'wood' | 'glow';
const MATS: Record<Mat, { roughness: number; metalness: number; side?: THREE.Side }> = {
  cloth: { roughness: 0.95, metalness: 0, side: THREE.DoubleSide },
  leather: { roughness: 0.72, metalness: 0, side: THREE.DoubleSide },
  metal: { roughness: 0.48, metalness: 0.3 },
  mail: { roughness: 0.5, metalness: 0.35 },
  skin: { roughness: 0.78, metalness: 0 },
  wood: { roughness: 0.82, metalness: 0, side: THREE.DoubleSide },
  // świeci własnym światłem (kula czaru maga) — z poświatą w grafice
  glow: { roughness: 0.4, metalness: 0 },
};

/** Każda siatka dostaje kolory wierzchołków (cieniowanie fałd, pikowania, obrębków); bez nich byłaby czarna */
function prep(geo: THREE.BufferGeometry, shade?: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const pos = g.attributes.position!;
  const c = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = shade ? shade(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Współrzędne tekstury z rzutu na płaszczyznę, do której ściana jest najbardziej zwrócona (splot tkaniny, słoje) */
export function boxUv(geo: THREE.BufferGeometry, scale: number): THREE.BufferGeometry {
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

/** Tekstury ubrań i drewna na postaciach: splot płótna (szary, barwę daje kolor ubrania) i słoje drzewca, łuku, tarczy */
type TexDef = { map: THREE.Texture | null; normalMap: THREE.Texture | null; scale: number; ns?: number };
const TEX: Partial<Record<Mat, () => TexDef>> = {
  cloth: () => ({ map: grayPattern('burlap'), normalMap: normal('burlap'), scale: 9 }),
  leather: () => ({ map: grayPattern('soil'), normalMap: null, scale: 7 }),
  mail: () => ({ map: grayPattern('mail'), normalMap: normal('mail'), scale: 9 }),
  wood: () => ({ map: pattern('planks'), normalMap: normal('planks'), scale: 6 }),
};
/** Z bliska: zdjęciowe tekstury CC0 z ambientCG (filcowana wełna, kute żelazo z rdzą, kolczuga) w 1024 px i rysowane
 *  w kodzie (ziarno wyprawionej skóry, pory skóry) — wszystkie z mapami normalnych */
const NEAR_TEX: Partial<Record<Mat, () => TexDef | null>> = {
  cloth: () => ({ map: grayPattern('wool', 1024), normalMap: normal('wool'), scale: 3, ns: 0.6 }),
  metal: () => ({ map: grayPattern('iron', 1024), normalMap: normal('iron'), scale: 2.5, ns: 0.5 }),
  mail: () => ({ map: grayPattern('mail', 1024), normalMap: normal('mail'), scale: 9, ns: 0.9 }),
  leather: () => { const t = charTexture('leather'); return t && { ...t, scale: 7, ns: 0.45 }; },
  skin: () => { const t = charTexture('skin'); return t && { ...t, scale: 4, ns: 0.35 }; },
};

const merge = (...g: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(g.map((x) => (x.attributes.color ? x : prep(x))))!;

/** Wygląd jednej osoby, wyliczony raz z jej numeru: każdy chłop wygląda trochę inaczej i zawsze tak samo. */
interface Look {
  tunic: number;
  trousers: number;
  hair: number;
  skin: number;
  headwear: number;
  hat: number;
  apron: boolean;
  beard: boolean;
  wraps: boolean;
  size: number;
}

// portki jak u kopaczy z Gothica: oliwkowe i bure zielenie, kilka brązów
const TROUSERS = [0x5c6440, 0x4e5636, 0x6a6a44, 0x5a4632, 0x4a4a3a, 0x626a48];
const HAIR = [0x3a2a1c, 0x6b4a2b, 0x1f1a16, 0xa8834a, 0x8a8a84, 0x7a3a1c];
const SKIN = [0xe2bd94, 0xd9a877, 0xedc9a4, 0xc99872];
const EARTH = [0x6a5638, 0x5a5040, 0x74603e, 0x4f4636];
const CAPS = [0x5c7a3a, 0x7a3a2a, 0x3a5a7a, 0x8a6a2a, 0x4a4a4a];

function mix(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

/**
 * Numer postaci, która wygląda jak kobieta (chusta na głowie, fartuch, bez brody) albo jak dziecko (bez brody,
 * z odkrytą głową lub w czapce) — do rodzin przy chatach. `n` = który z kolei (różne osoby wyglądają różnie).
 */
const familyIds = new Map<string, number>();
export function familyId(n: number, kind: 'woman' | 'child'): number {
  const key = `${kind}${n}`, have = familyIds.get(key);
  if (have !== undefined) return have;
  for (let id = 900000 + n * 7919; ; id++) {
    const head = mix(id, 5) % 5, beard = mix(id, 8) % 3 === 0;
    if (beard) continue;
    if (kind === 'woman' ? head === 3 && mix(id, 7) % 4 === 0 : head === 2 || head === 4) { familyIds.set(key, id); return id; }
  }
}

/** Pierwszy numer postaci od `from`, której nakrycie głowy (0–4) spełnia warunek — do podglądu wariantów */
export function idWithHead(want: (head: number) => boolean, from = 1): number { let id = from; while (!want(mix(id, 5) % 5)) id++; return id; }

const looks = new Map<string, Look>();
function lookOf(id: number, tunic: number, muted = false): Look {
  const key = `${id}:${tunic}:${muted}`;
  let l = looks.get(key);
  if (l) return l;
  const pickOf = <T,>(list: readonly T[], salt: number): T => list[mix(id, salt) % list.length]!;
  // tunika zostaje w barwie drużyny, ale u każdego w nieco innym odcieniu
  const c = new THREE.Color(tunic);
  const shade = 0.8 + (mix(id, 1) % 40) / 100;
  c.multiplyScalar(shade);
  // chłop: barwa pana wyblakła i przybrudzona (tania wełna), żołnierz nosi ją czystą
  if (muted) c.lerp(new THREE.Color(EARTH[mix(id, 11) % EARTH.length]!), 0.6); // jak u kopaczy w Gothicu: brudny brąz, barwa pana tylko przebija
  l = {
    tunic: c.getHex(), trousers: pickOf(TROUSERS, 2), hair: pickOf(HAIR, 3), skin: pickOf(SKIN, 4),
    headwear: mix(id, 5) % 5, hat: pickOf(CAPS, 6), apron: mix(id, 7) % 4 === 0, beard: mix(id, 8) % 3 === 0, wraps: mix(id, 10) % 2 === 0,
    size: 0.92 + (mix(id, 9) % 17) / 100,
  };
  looks.set(key, l);
  return l;
}

/**
 * Chłopi jako małe postacie złożone z części: buty, nogawice, tunika z pasem, ręce z dłońmi, głowa z włosami,
 * a do tego jedno z kilku nakryć głowy, czasem broda albo fartuch. Każda część to jedna siatka instancjonowana.
 */
/** Rodzaje postaci z Blendera */
export type FigureKind = 'peasant' | 'spearman' | 'archer' | 'guard' | 'woman' | 'child' | 'king' | 'manatarms' | 'sapper' | 'bandit' | 'mageFire' | 'mageWater';

export class Figures {
  private parts: Part[] = [];
  private muted: boolean;
  private local = new THREE.Matrix4();
  private out = new THREE.Matrix4();
  private scaled = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private subM = new THREE.Matrix4();
  private e = new THREE.Euler();
  private one = new THREE.Vector3(1, 1, 1);
  private none = new THREE.Matrix4().makeScale(0, 0, 0);
  private color = new THREE.Color();
  private nearN = 0;
  private farN = 0;
  private hasFar = false;
  private viewPos: THREE.Vector3 | null = null;
  /** Od tej odległości od kamery (do kwadratu) postać rysuje się w wersji uproszczonej */
  static FAR2 = 13 * 13;

  /** Ręka z bronią prowadzoną fazą ciosu (topór zbója): set(…, pose) ustawia ją i broń w dłoni wprost */
  private weaponArm: Part['rot'] | null = null;
  private freeArmRot: Part['rot'] | null = null;
  /** Broń jako osobna część (włócznia): pose[1] = jej kąt, pose[2] = wysunięcie do przodu (pchnięcie) */
  private weaponRot: Part['rot'] | null = null;
  private push = new THREE.Vector3();
  /** Dłoń względem barku (z modelu) — w walce włócznia leży w dłoni, a nie na stałej osi przy boku */
  private hand = new THREE.Vector3(0, -0.185, 0.004);

  /** Bark względem stóp (x, y, z) — tam zaczepia się narzędzie w dłoni */
  shoulder: [number, number, number] = [0.135, 0.45, 0];

  constructor(max: number, scene: THREE.Scene, kind: FigureKind = 'peasant') {
    this.muted = kind === 'peasant' || kind === 'woman' || kind === 'child';
    const always = (): boolean => true;
    const mk = (geo: THREE.BufferGeometry, color: number | Part['color'], pos: THREE.Vector3, rot: Part['rot'], shown: Part['shown'], mat: Mat, sub?: Part['sub'], lod: 0 | 1 = 0, elbow = false): void => {
      const fixed = typeof color === 'number';
      const m = MATS[mat];
      const tex = (lod === 0 ? NEAR_TEX[mat]?.() : null) ?? TEX[mat]?.();
      const g0 = geo.attributes.color ? geo : prep(geo);
      if (tex?.map) boxUv(g0, tex.scale);
      const ns = tex?.ns ?? 0.45;
      const mesh = new THREE.InstancedMesh(g0, new THREE.MeshStandardMaterial({
        color: fixed ? color : 0xffffff, vertexColors: true, roughness: m.roughness, metalness: m.metalness, side: m.side ?? THREE.FrontSide,
        map: tex?.map ?? null, normalMap: tex?.normalMap ?? null, normalScale: new THREE.Vector2(ns, ns),
      }), max);
      mesh.count = 0;
      mesh.frustumCulled = false;
      // cień rzuca tylko wersja z bliska: z daleka postać ma kilka pikseli i jej cień zlewa się z cieniem ziemi,
      // a każda część to osobne rysowanie do mapy cieni
      mesh.castShadow = lod === 0;
      cloudShade(mesh.material as THREE.Material); // ludzie też wchodzą w cień chmury
      scene.add(cat(mesh, `postacie: ${{ peasant: 'chłopi', spearman: 'włócznicy', archer: 'łucznicy', guard: 'strażnicy', manatarms: 'zbrojni', sapper: 'saperzy', bandit: 'zbóje', mageFire: 'magowie ognia', mageWater: 'magowie wody', woman: 'gospodynie', child: 'dzieci', king: 'pan zamku' }[kind]}`));
      if (mat === 'glow') { const mm = mesh.material as THREE.MeshStandardMaterial; mm.emissive.setHex(fixed ? color : 0xffffff); mm.emissiveIntensity = 2.2; mesh.castShadow = false; }
      this.parts.push({ mesh, pos, rot, color: fixed ? null : color, shown, sub, lod, elbow, orb: mat === 'glow' });
      if (lod) this.hasFar = true;
    };
    const add = (geo: THREE.BufferGeometry, color: number | Part['color'], x: number, y: number, z: number, rot: Part['rot'], shown: Part['shown'] = always, mat: Mat = 'cloth', sub?: Part['sub']): void =>
      mk(geo, color, new THREE.Vector3(x, y, z), rot, shown, mat, sub);
    const still = (): number => 0;
    const tunic = (l: Look): number => l.tunic, skin = (l: Look): number => l.skin;
    /** Wczytuje postać z Blendera: tułów stoi, nogi i ręce się obracają; wersja z bliska i z daleka */
    const DYN: Record<string, Part['color']> = { skin, tunic, hair: (l) => l.hair, trousers: (l) => l.trousers, hat: (l) => l.hat };
    const SHOW: Record<string, Part['shown']> = {
      beard: (l) => l.beard || l.headwear % 2 === 0, beardP: (l) => l.beard, apron: (l) => l.apron, wraps: (l) => l.wraps,
      hairOn: (l) => l.headwear !== 1 && l.headwear !== 3, straw: (l) => l.headwear === 0, hood: (l) => l.headwear === 1,
      wkerchief: (l) => l.headwear % 2 === 0, wbun: (l) => l.headwear % 2 === 1,
      cap: (l) => l.headwear === 2, kerchief: (l) => l.headwear === 3, kettle: (l) => l.headwear % 3 !== 1, nasal: (l) => l.headwear % 3 === 1,
    };
    const model = (M: FigureModel, armLeft: Part['rot'], armRight: Part['rot']): void => {
      this.shoulder = [M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!];
      this.hand.set(M.hand[0]!, M.hand[1]!, M.hand[2]!);
      const dyn = (d: string | null): number | Part['color'] => (d ? DYN[d] ?? 0xffffff : 0xffffff);
      const showOf = (sh: string | null): Part['shown'] => (sh ? SHOW[sh] ?? always : always);
      for (const lod of [0, 1] as const) {
        const st = lod ? M.far_static : M.static, lg = lod ? M.far_leg : M.leg, ar = lod ? M.far_arm : M.arm;
        for (const m of st) mk(modelGeo(m), dyn(m.dyn), new THREE.Vector3(), still, showOf(m.show), m.mat as Mat, undefined, lod);
        for (const [sx, rot] of [[-1, legL], [1, legR]] as const)
          for (const m of lg) mk(modelGeo(m), dyn(m.dyn), new THREE.Vector3(sx * M.hip[0]!, M.hip[1]!, M.hip[2]!), rot, showOf(m.show), m.mat as Mat, undefined, lod);
        for (const [sx, rot] of [[-1, armLeft], [1, armRight]] as const)
          for (const m of ar) mk(modelGeo(m), dyn(m.dyn), new THREE.Vector3(sx * M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!), rot, showOf(m.show), m.mat as Mat, undefined, lod);
      }
    };
    /** Broń i sprzęt w jednej siatce z kolorami wierzchołków (jedno wywołanie rysowania) */
    const tinted = (g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      const c = new THREE.Color(hex), arr = new Float32Array(n.attributes.position!.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
      n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return n;
    };
    if (kind === 'guard' || kind === 'manatarms') {
      // Strażnik Starego Obozu (tools/models/guard.py) i zbrojny w pełnej zbroi (tools/models/manatarms.py): ten sam miecz i ruchy
      const M = (kind === 'guard' ? GUARD_MODEL : MANATARMS_MODEL) as FigureModel;
      // prawa ręka z mieczem: przy marszu luźno, w walce zamach z góry
      const swordArm = (sw: number, up: boolean): number => (up ? -2.2 : sw * 0.55 - 0.15);
      model(M, armL, swordArm);
      this.weaponArm = swordArm; this.freeArmRot = armL; // w walce cięcie fazami (scene.ts: swordCut), lewa ręka przed sobą
      // miecz: rękojeść w dłoni, jelec, głowica, prosta klinga; w spoczynku ostrzem w dół i lekko w przód
      const sword = { at: new THREE.Vector3(M.hand[0]!, M.hand[1]!, M.hand[2]!), rot: (_s: number, up: boolean): number => (up ? -0.9 : -0.55) };
      const at = new THREE.Vector3(M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!);
      // miecz z Blendera (tools/models/sword.py): owinięta rękojeść, głowica, jelec, klinga ze zbroczem; z bliska i z daleka
      const SW = M as FigureModel & { sword: ModelMesh[]; swordFar: ModelMesh[] };
      for (const lod of [0, 1] as const)
        for (const m of lod ? SW.swordFar : SW.sword) mk(modelGeo(m), 0xffffff, at.clone(), swordArm, always, m.mat as Mat, sword, lod);
      return;
    }
    if (kind === 'mageFire' || kind === 'mageWater') {
      // mag ognia / wody (tools/models/mage.py): szata do ziemi, płaszcz z kapturem, bez kostura — czaruje z dłoni
      // (efekt ognia / wody w dłoniach dokłada scena); spokojny krok, ręce kołyszą się słabiej niż u chłopa
      // czarowanie (armsUp): obie ręce uniesione przed pierś, łokcie zgięte, w prawej dłoni świecąca kula ognia albo wody
      const calmL = (sw: number, up: boolean): number => (up ? -0.9 : -sw * 0.4), calmR = (sw: number, up: boolean): number => (up ? -1.0 : sw * 0.4);
      const M = (kind === 'mageFire' ? MAGE_FIRE_MODEL : MAGE_WATER_MODEL) as FigureModel & { fore: ModelMesh[]; foreFar: ModelMesh[]; elbow: number[]; orb: number[] };
      model(M, calmL, calmR);
      const at = new THREE.Vector3(M.elbow[0]!, M.elbow[1]!, M.elbow[2]!);
      const elbowL = (sw: number, up: boolean): number => (up ? -1.0 : -0.2 - Math.max(0, -sw) * 0.3);
      const elbowR = (sw: number, up: boolean): number => (up ? -1.1 : -0.2 - Math.max(0, sw) * 0.3);
      for (const lod of [0, 1] as const)
        for (const m of lod ? M.foreFar : M.fore)
          for (const [sx, rot, el] of [[-1, calmL, elbowL], [1, calmR, elbowR]] as const)
            mk(modelGeo(m), m.dyn ? DYN[m.dyn] ?? 0xffffff : 0xffffff, new THREE.Vector3(sx * M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!), rot,
              m.show ? SHOW[m.show] ?? always : always, m.mat as Mat, { at: at.clone(), rot: el }, lod, true);
      const orb = new THREE.SphereGeometry(0.024, 16, 12).translate(M.orb[0]!, M.orb[1]!, M.orb[2]!);
      mk(orb, kind === 'mageFire' ? 0xff7a22 : 0x5ab4ff, new THREE.Vector3(M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!), calmR, always, 'glow', { at: at.clone(), rot: elbowR });
      return;
    }
    if (kind === 'bandit') {
      // zbój z puszczy (tools/models/bandit.py): skóry, kaptur, onuce; topór w prawej dłoni, bez tarczy
      const M = BANDIT_MODEL as FigureModel & { axe: ModelMesh[]; axeFar: ModelMesh[] };
      // prawa ręka z toporem: w marszu luźno przy boku, w walce zamach znad głowy (jak miecz strażnika, ale szerzej)
      const axeArm = (sw: number, up: boolean): number => (up ? -2.4 : sw * 0.5 - 0.1);
      // lewa ręka luźno, w walce wysunięta do przodu dla równowagi
      const freeArm = (sw: number, up: boolean): number => (up ? -0.7 : -sw * 0.55);
      model(M, freeArm, axeArm);
      this.weaponArm = axeArm; this.freeArmRot = freeArm;
      // topór: chwyt w dłoni, obuch na końcu drzewca; w spoczynku zwisa ostrzem w dół, lekko w przód
      const grip = { at: new THREE.Vector3(M.hand[0]!, M.hand[1]!, M.hand[2]!), rot: (_s: number, up: boolean): number => (up ? -0.75 : -0.55) };
      const at = new THREE.Vector3(M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!);
      for (const lod of [0, 1] as const)
        for (const m of lod ? M.axeFar : M.axe) mk(modelGeo(m), 0xffffff, at.clone(), axeArm, always, m.mat as Mat, grip, lod);
      return;
    }
    if (kind === 'spearman' || kind === 'archer') {
      // ciało z Blendera (tools/models/soldier.py); tarcza, włócznia i łuk wiszą na kotwicach ręki
      const archer = kind === 'archer';
      const M = (archer ? ARCHER_MODEL : SPEARMAN_MODEL) as FigureModel;
      const S = M.shoulder, sx = S[0]!, sy = S[1]!;
      const STEEL = 0xa6abb2, IRON = 0x767b83, WOOD = 0x6e5233;
      if (!archer) {
        // prawa ręka trzyma włócznię pionowo przy boku; pchnięcie: ręka do przodu, włócznia grotem we wroga
        const thrustArm = (_s: number, up: boolean): number => (up ? -1.25 : -0.25);
        const thrustSpear = (_s: number, up: boolean): number => (up ? 1.45 : 0);
        // lewa ręka trzyma tarczę przed sobą: w marszu prawie się nie kołysze
        const shieldArm = (sw: number, up: boolean): number => (up ? -1.35 : -0.32 - sw * 0.12);
        model(M, shieldArm, thrustArm);
        this.weaponArm = thrustArm; this.weaponRot = thrustSpear; this.freeArmRot = shieldArm; // w walce tarcza stale uniesiona przed sobą
        // wypukła tarcza w barwach pana na lewym przedramieniu, okucie i guz z żelaza
        const shield = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateY(0.6).translate(0.022, -0.11, 0.035); // tuż przy przedramieniu
        add(shield(prep(new THREE.SphereGeometry(0.33, 18, 5, 0, Math.PI * 2, 0, 0.38).rotateZ(Math.PI / 2).translate(0.28, 0, 0), (_x, y, z) => 0.8 + 0.25 * (1 - Math.hypot(y, z) / 0.122))), tunic, -sx, sy, 0, shieldArm, always, 'wood');
        add(shield(merge(
          new THREE.TorusGeometry(0.122, 0.008, 4, 22).rotateY(Math.PI / 2).translate(-0.027, 0, 0),
          new THREE.SphereGeometry(0.03, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2).translate(-0.047, 0, 0),
        )), IRON, -sx, sy, 0, shieldArm, always, 'metal');
        // drzewce i liściasty grot w jednej siatce
        add(mergeGeometries([
          // włócznia ok. półtora raza wyższa od człowieka (dawniej dwa razy): drzewce od kostki do nad głowę
          tinted(new THREE.CylinderGeometry(0.009, 0.0105, 0.84, 6).translate(0, 0.12, 0), WOOD),
          tinted(new THREE.CylinderGeometry(0.011, 0.0095, 0.025, 6).translate(0, -0.3, 0), WOOD),
          tinted(new THREE.OctahedronGeometry(1, 0).scale(0.027, 0.085, 0.01).translate(0, 0.66, 0), STEEL),
          tinted(new THREE.CylinderGeometry(0.0105, 0.012, 0.04, 6).translate(0, 0.565, 0), STEEL),
        ])!, 0xffffff, 0.15, sy - 0.09, 0.075, thrustSpear, always, 'metal');
        return;
      }
      // łucznik: lewa ręka trzyma łuk, prawa naciąga cięciwę
      const bowArm = (s: number, up: boolean): number => (up ? -1.5 : -s * 0.6);
      const drawArm = (s: number, up: boolean): number => (up ? -1.35 : s * 0.6);
      model(M, bowArm, drawArm);
      // łokcie (tools/models/soldier.py: 'fore' za łokciem 'elbow'): prawe przedramię zgina się przy naciągu i sięganiu do kołczanu,
      // lewe zostaje proste — trzyma łuk. W marszu prawa ręka lekko zgięta
      const FA = M as FigureModel & { fore?: ModelMesh[]; foreFar?: ModelMesh[]; elbow?: number[] };
      if (FA.fore && FA.elbow) {
        const at = new THREE.Vector3(FA.elbow[0]!, FA.elbow[1]!, FA.elbow[2]!);
        const elbowR = (sw: number, up: boolean): number => (up ? -1.0 : -0.25 - Math.max(0, sw) * 0.4);
        const elbowL = (): number => 0;
        for (const lod of [0, 1] as const)
          for (const m of (lod ? FA.foreFar : FA.fore) ?? [])
            for (const [sx, rot, el] of [[-1, bowArm, elbowL], [1, drawArm, elbowR]] as const)
              mk(modelGeo(m), m.dyn ? DYN[m.dyn] ?? 0xffffff : 0xffffff, new THREE.Vector3(sx * M.shoulder[0]!, M.shoulder[1]!, M.shoulder[2]!), rot,
                m.show ? SHOW[m.show] ?? always : always, m.mat as Mat, { at: at.clone(), rot: el }, lod, true);
      }
      // w walce strzał fazami (scene.ts: bowShot): pose[0] = ręka cięciwy, pose[3] = ręka z łukiem (łuk zawsze pionowo)
      this.weaponArm = drawArm; this.freeArmRot = bowArm;
      // długi łuk: w dłoni, ale zawsze pionowo (druga oś obrotu znosi uniesienie ręki); cięciwa po stronie łucznika
      const chord = 0.58, sag = 0.07, R = (chord * chord / 4 + sag * sag) / (2 * sag), arc = 2 * Math.asin(chord / 2 / R);
      const bowSub = { at: new THREE.Vector3(M.hand[0]!, M.hand[1]!, M.hand[2]!), rot: (s: number, up: boolean): number => -bowArm(s, up) + (up ? 0 : 0.28) };
      add(mergeGeometries([
        tinted(new THREE.TorusGeometry(R, 0.0095, 5, 22, arc).rotateZ(-arc / 2).translate(-R, 0, 0).rotateY(-Math.PI / 2), 0x5a3a20),
        tinted(new THREE.CylinderGeometry(0.0025, 0.0025, chord, 3).translate(-sag, 0, 0).rotateY(-Math.PI / 2), 0xe6dfcc),
      ])!, 0xffffff, -sx, sy, 0, bowArm, always, 'wood', bowSub);
      return;
    }
    // ---- gospodyni i dziecko z Blendera (tools/models/woman.py, child.py) ----
    // saper (tools/models/sapper.py): skórzany kaftan i kaptur, kotwice jak u chłopa — kilof i ładunki z puli chłopów
    if (kind === 'sapper') { model(SAPPER_MODEL as FigureModel, armL, armR); return; }
    if (kind === 'woman' || kind === 'child') { model((kind === 'woman' ? WOMAN_MODEL : CHILD_MODEL) as FigureModel, armL, armR); return; }
    // pan zamku z Blendera (tools/models/king.py): korona, gronostaj, płaszcz w barwach pana
    if (kind === 'king') { model(KING_MODEL as FigureModel, armL, armR); return; }
    // ---- chłop z Blendera (tools/models/peasant.py); kotwice narzędzi: bark (±0,135; 0,45), dłoń 0,185 niżej ----
    model(PEASANT_MODEL as FigureModel, armL, armR);
  }

  /** Ustawia postać numer `i`. `base` = położenie i obrót całej postaci, `id` = numer chłopa (od niego zależy wygląd). */
  /** Skala postaci (ludzie są różnego wzrostu) — potrzebna, żeby narzędzie w dłoni trafiało w rękę. */
  sizeOf(id: number, tunic: number): number { return lookOf(id, tunic, this.muted).size; }

  /**
   * `work` = poza przy pracy: kąt prawej ręki (ujemny = w przód i w górę); nogi stoją, lewa ręka lekko przed sobą.
   * Bez tego `swing` rusza rękami i nogami jak przy chodzie.
   */
  /** grip: o ile obie ręce schodzą się do środka (oburęczny chwyt kilofa czy siekiery), w radianach; 0 = zwykle */
  /** `pose` = [kąt ręki z bronią, kąt broni w dłoni] — faza ciosu liczona w scenie (bandit: zamach zza głowy i cięcie) */
  set(_i: number, base: THREE.Matrix4, swing: number, armsUp: boolean, tunic: number, id = _i, work?: number, workL = -0.5, walkLegs = false, sitLegs?: number, grip = 0, pose?: [number, number, number?, number?, number?, number?, number?]): void {
    // ukryta postać (macierz o zerowej skali) nie zajmuje miejsca: karta graficzna liczy tylko widoczne
    const e = base.elements;
    if (e[0] === 0 && e[5] === 0 && e[10] === 0) return;
    // z daleka: uproszczona wersja (o ile postać ją ma)
    const far = this.hasFar && !!this.viewPos && (e[12] - this.viewPos.x) ** 2 + (e[13] - this.viewPos.y) ** 2 + (e[14] - this.viewPos.z) ** 2 > Figures.FAR2;
    const i = far ? this.farN++ : this.nearN++;
    const lod = far ? 1 : 0;
    const look = lookOf(id, tunic, this.muted);
    this.scaled.copy(base).scale(this.one.setScalar(look.size));
    this.one.setScalar(1);
    for (const p of this.parts) {
      if (p.lod !== lod) continue;
      if (!p.shown(look) || (p.orb && !armsUp)) { p.mesh.setMatrixAt(i, this.none); continue; }
      const r = pose && p.rot === this.weaponArm ? pose[0] : pose && p.rot === this.weaponRot ? pose[1] : pose && p.rot === this.freeArmRot ? (pose[3] ?? p.rot(0, true)) : work === undefined ? p.rot(swing, armsUp)
        : p.rot === armR ? work : p.rot === armL ? workL : p.rot === legL || p.rot === legR ? (walkLegs ? p.rot(swing, false) : 0) : p.rot(0, false);
      // siedzi: obie nogi wyciągnięte przed siebie
      // oburęczny chwyt: ręce obrócone do środka (przed uniesieniem), dłonie spotykają się na stylisku
      const roll = grip && (p.rot === armR || p.rot === armL) ? (p.rot === armR ? -grip : grip) : 0;
      // ręka cięciwy łucznika przy naciągu: pełny obrót (w przód, w poziomie i w przekroju), kolejność jak w tools/models/render_preview.py
      const full = pose && pose[5] !== undefined && p.rot === this.weaponArm;
      this.q.setFromEuler(full ? this.e.set(pose[0], pose[5]!, pose[6] ?? 0, 'YXZ') : this.e.set(sitLegs !== undefined && (p.rot === legL || p.rot === legR) ? sitLegs : r, 0, roll, 'XYZ'));
      // pchnięcie włócznią: cała broń przesuwa się wzdłuż drzewca (w przód postaci), nie tylko obraca
      this.local.compose(pose && p.rot === this.weaponRot ? this.gripAt(pose[0], pose[2] ?? 0) : p.pos, this.q, this.one);
      // łuk w dłoni ręki prowadzonej pozą: obrót odwrotny do ręki, więc łuk zostaje pionowo
      if (p.sub) { this.q.setFromEuler(this.e.set(p.elbow ? (pose && p.rot === this.weaponArm && pose[4] !== undefined ? pose[4] : p.sub.rot(swing, armsUp)) : pose && p.rot === this.weaponArm ? pose[1] : pose && pose[3] !== undefined && p.rot === this.freeArmRot ? -pose[3] : p.sub.rot(swing, armsUp), 0, 0, 'XYZ')); this.local.multiply(this.subM.compose(p.sub.at, this.q, this.one)); }
      this.out.multiplyMatrices(this.scaled, this.local);
      p.mesh.setMatrixAt(i, this.out);
      if (p.color) p.mesh.setColorAt(i, this.color.setHex(p.color(look)));
    }
  }

  /** Dłoń prawej ręki obróconej o `arm` (układ postaci) + wysunięcie w przód: tam leży włócznia w walce */
  private gripAt(arm: number, push: number): THREE.Vector3 {
    const [sx, sy, sz] = this.shoulder, h = this.hand, c = Math.cos(arm), s = Math.sin(arm);
    return this.push.set(sx + h.x, sy + h.y * c - h.z * s, sz + h.y * s + h.z * c + push);
  }

  /** Skąd patrzy kamera (do wyboru wersji z bliska / z daleka); wywoływane co klatkę przed set() */
  view(p: THREE.Vector3): void { this.viewPos = p; }

  finish(_count: number): void {
    for (const p of this.parts) {
      const n = p.lod ? this.farN : this.nearN;
      p.mesh.count = n;
      p.mesh.visible = n > 0; // pusta grupa nie kosztuje wywołania rysowania
      touch(p.mesh);
      if (p.mesh.instanceColor) touch(p.mesh);
    }
    this.nearN = 0; this.farN = 0;
  }
}

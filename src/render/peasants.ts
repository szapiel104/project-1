import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
}

const legL = (s: number): number => s, legR = (s: number): number => -s;
const armL = (s: number, up: boolean): number => (up ? -1.35 : -s * 0.8), armR = (s: number, up: boolean): number => (up ? -1.35 : s * 0.8);

type Mat = 'cloth' | 'leather' | 'metal' | 'skin' | 'wood';
const MATS: Record<Mat, { roughness: number; metalness: number; side?: THREE.Side }> = {
  cloth: { roughness: 0.95, metalness: 0, side: THREE.DoubleSide },
  leather: { roughness: 0.72, metalness: 0 },
  metal: { roughness: 0.48, metalness: 0.3 },
  skin: { roughness: 0.78, metalness: 0 },
  wood: { roughness: 0.82, metalness: 0, side: THREE.DoubleSide },
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

/** Bryła toczona z profilu [promień, wysokość]; profil zagęszczony, żeby cieniowanie miało gdzie się rozłożyć */
function lathe(pts: [number, number][], seg = 14, depth = 1, phiStart = 0, phiLength = Math.PI * 2, step = 0.008): THREE.BufferGeometry {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i]!, [r1, y1] = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push(new THREE.Vector2(r0 + ((r1 - r0) * k) / n, y0 + ((y1 - y0) * k) / n));
  }
  const last = pts[pts.length - 1]!;
  out.push(new THREE.Vector2(last[0], last[1]));
  return new THREE.LatheGeometry(out, seg, phiStart, phiLength).scale(1, 1, depth);
}

/** Kończyna zwężająca się ku dołowi, obracana wokół górnego końca */
const taper = (rTop: number, rBot: number, h: number, seg = 8): THREE.BufferGeometry => new THREE.CylinderGeometry(rTop, rBot, h, seg).translate(0, -h / 2, 0);
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

const TROUSERS = [0x5a4632, 0x4a4a3a, 0x6b5a3c, 0x3f3a33, 0x55503c];
const HAIR = [0x3a2a1c, 0x6b4a2b, 0x1f1a16, 0xa8834a, 0x8a8a84, 0x7a3a1c];
const SKIN = [0xe2bd94, 0xd9a877, 0xedc9a4, 0xc99872];
const EARTH = [0x6a5638, 0x5a5040, 0x74603e, 0x4f4636];
const CAPS = [0x5c7a3a, 0x7a3a2a, 0x3a5a7a, 0x8a6a2a, 0x4a4a4a];

function mix(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

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
  if (muted) c.lerp(new THREE.Color(EARTH[mix(id, 11) % EARTH.length]!), 0.42);
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

  constructor(max: number, scene: THREE.Scene, kind: 'peasant' | 'spearman' | 'archer' | 'guard' = 'peasant') {
    this.muted = kind === 'peasant';
    const always = (): boolean => true;
    const mk = (geo: THREE.BufferGeometry, color: number | Part['color'], pos: THREE.Vector3, rot: Part['rot'], shown: Part['shown'], mat: Mat, sub?: Part['sub']): void => {
      const fixed = typeof color === 'number';
      const m = MATS[mat];
      const mesh = new THREE.InstancedMesh(geo.attributes.color ? geo : prep(geo), new THREE.MeshStandardMaterial({ color: fixed ? color : 0xffffff, vertexColors: true, roughness: m.roughness, metalness: m.metalness, side: m.side ?? THREE.FrontSide }), max);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.parts.push({ mesh, pos, rot, color: fixed ? null : color, shown, sub });
    };
    const add = (geo: THREE.BufferGeometry, color: number | Part['color'], x: number, y: number, z: number, rot: Part['rot'], shown: Part['shown'] = always, mat: Mat = 'cloth', sub?: Part['sub']): void =>
      mk(geo, color, new THREE.Vector3(x, y, z), rot, shown, mat, sub);
    // części nieruchome (tułów, głowa, hełm) o tym samym kolorze i materiale łączymy w jedną siatkę: mniej wywołań rysowania
    const stills: { geo: THREE.BufferGeometry[]; color: number | Part['color']; mat: Mat; shown: Part['shown'] }[] = [];
    const fix = (geo: THREE.BufferGeometry, color: number | Part['color'], mat: Mat = 'cloth', shown: Part['shown'] = always): void => {
      const g = geo.attributes.color ? geo : prep(geo);
      const grp = stills.find((x) => x.color === color && x.mat === mat && x.shown === shown);
      if (grp) grp.geo.push(g); else stills.push({ geo: [g], color, mat, shown });
    };
    const flush = (): void => { for (const x of stills) mk(mergeGeometries(x.geo)!, x.color, new THREE.Vector3(), still, x.shown, x.mat); };
    const still = (): number => 0;
    const tunic = (l: Look): number => l.tunic, skin = (l: Look): number => l.skin;
    if (kind === 'guard') {
      // Strażnik Starego Obozu (Gothic): ciężka zbroja z czerwonej skóry i żelaznych płyt, naramienniki, gołą głowa
      // (krótko ostrzyżony, często z brodą), miecz w prawej dłoni, pochwa u lewego biodra. Pas w barwach pana, żeby
      // odróżnić swoich od cudzych.
      const LIFT = 0.035;
      const head = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(0, -0.47, 0).scale(0.87, 0.87, 0.87).translate(0, 0.47, 0);
      const legsEnd = this.parts.length + 4;
      const BOOT = 0x24180f, RED = 0x7a2a1a, DARK = 0x3a1c12, LEATHER = 0x4a2c18, IRON = 0x80858d, STEEL = 0xb7bcc3, GLOVE = 0x2f2118, BRASS = 0xb08a3a;
      const hair = (l: Look): number => l.hair, beard = (l: Look): boolean => l.beard || l.headwear % 2 === 0;
      for (const [x, rot] of [[-0.052, legL], [0.052, legR]] as const) {
        add(taper(0.047, 0.034, 0.17 + LIFT), DARK, x, 0.235 + LIFT, 0, rot, always, 'leather');
        // wysokie buty z cholewą i żelaznym nagolennikiem z przodu
        add(merge(
          new THREE.CylinderGeometry(0.039, 0.041, 0.11, 8).translate(0, -0.18, 0),
          new THREE.BoxGeometry(0.07, 0.04, 0.112).translate(0, -0.215, 0.026),
          new THREE.SphereGeometry(0.036, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, -0.215, 0.078),
        ).translate(0, -LIFT, 0), BOOT, x, 0.235 + LIFT, 0, rot, always, 'leather');
        add(new THREE.BoxGeometry(0.05, 0.1, 0.012).translate(0, -0.13 - LIFT, 0.04), IRON, x, 0.235 + LIFT, 0, rot, always, 'metal');
      }
      // twarz, nos, oczy, krótkie włosy i broda
      fix(head(new THREE.IcosahedronGeometry(0.072, 1).scale(0.95, 1.08, 1).translate(0, 0.555, 0)), skin, 'skin');
      fix(head(new THREE.BoxGeometry(0.015, 0.027, 0.017).translate(0, 0.548, 0.069)), skin, 'skin');
      for (const ex of [-0.022, 0.022]) fix(head(new THREE.BoxGeometry(0.014, 0.009, 0.006).translate(ex, 0.564, 0.065)), 0x2a1c14, 'skin');
      fix(head(new THREE.SphereGeometry(0.075, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42).translate(0, 0.563, -0.004)), hair, 'cloth');
      fix(head(prep(new THREE.IcosahedronGeometry(0.05, 1).scale(1.1, 0.9, 0.8).translate(0, 0.515, 0.032), (_x, y) => 0.8 + (y - 0.48) * 2)), hair, 'cloth', beard);
      // kaftan z czerwonej skóry do pół uda, ciemny obrębek
      fix(prep(lathe([[0.122, 0.14], [0.118, 0.2], [0.102, 0.29], [0.108, 0.34], [0.12, 0.4], [0.114, 0.445], [0.08, 0.472], [0.048, 0.488]], 16, 0.78), (x, y, z) => {
        if (y < 0.16) return 0.55;
        const panel = y < 0.29 ? 0.88 + 0.12 * Math.sign(Math.cos(Math.atan2(x, z) * 4)) : 1; // pasy skóry spódnicy
        return panel * (0.85 + (y - 0.14) * 0.4);
      }), RED, 'leather');
      // napierśnik z żelaznych płyt nachodzących na siebie (z przodu i z tyłu)
      fix(prep(lathe([[0.112, 0.31], [0.116, 0.34], [0.123, 0.39], [0.118, 0.43], [0.09, 0.458]], 16, 0.8), (_x, y) => 0.75 + 0.25 * (((y - 0.31) / 0.03) % 1)), IRON, 'metal');
      // naramienniki: dwie warstwy wypukłych płyt na każdym barku
      for (const sx of [-1, 1]) {
        fix(new THREE.SphereGeometry(0.044, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.1).translate(sx * 0.122, 0.452, 0), IRON, 'metal');
        fix(new THREE.SphereGeometry(0.046, 12, 4, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.2).scale(1, 0.85, 1.1).translate(sx * 0.126, 0.432, 0), STEEL, 'metal');
      }
      // pas z mosiężną klamrą, szarfa w barwach pana przez pierś
      fix(lathe([[0.108, 0.284], [0.112, 0.296], [0.112, 0.31], [0.107, 0.322]], 16, 0.8), LEATHER, 'leather');
      fix(new THREE.BoxGeometry(0.032, 0.028, 0.012).translate(0, 0.303, 0.09), BRASS, 'metal');
      fix(prep(lathe([[0.122, -0.013], [0.125, 0], [0.122, 0.013]], 18, 0.82).rotateZ(0.6).translate(0, 0.37, 0), () => 1), tunic);
      // pochwa miecza u lewego biodra
      fix(new THREE.BoxGeometry(0.022, 0.2, 0.014).rotateZ(-0.3).translate(-0.118, 0.2, 0.02), 0x1f1611, 'leather');
      fix(new THREE.BoxGeometry(0.026, 0.014, 0.018).rotateZ(-0.3).translate(-0.088, 0.296, 0.02), BRASS, 'metal');
      // ręce: rękawy z czerwonej skóry, karwasze, rękawice
      const sleeve = (): THREE.BufferGeometry => prep(merge(new THREE.SphereGeometry(0.035, 10, 6).scale(1, 0.85, 1).translate(0, -0.004, 0), taper(0.036, 0.029, 0.175)), (_x, y) => 0.82 + 0.1 * Math.cos((y * Math.PI * 2) / 0.04));
      const hand = (): THREE.BufferGeometry => new THREE.IcosahedronGeometry(0.031, 1).scale(1, 1.2, 1.05).translate(0, -0.195, 0.004);
      add(sleeve(), RED, -0.128, 0.45, 0, armL, always, 'leather');
      add(new THREE.CylinderGeometry(0.036, 0.034, 0.06, 9).translate(0, -0.15, 0), LEATHER, -0.128, 0.45, 0, armL, always, 'leather');
      add(hand(), GLOVE, -0.128, 0.45, 0, armL, always, 'leather');
      // prawa ręka z mieczem: przy marszu luźno, w walce zamach z góry
      const swordArm = (s: number, up: boolean): number => (up ? -2.2 : s * 0.55 - 0.15);
      add(sleeve(), RED, 0.128, 0.45, 0, swordArm, always, 'leather');
      add(new THREE.CylinderGeometry(0.036, 0.034, 0.06, 9).translate(0, -0.15, 0), LEATHER, 0.128, 0.45, 0, swordArm, always, 'leather');
      add(hand(), GLOVE, 0.128, 0.45, 0, swordArm, always, 'leather');
      // miecz: rękojeść w dłoni, jelec, głowica, prosta klinga z wgłębieniem; w spoczynku ostrzem w dół i lekko w przód
      const sword = { at: new THREE.Vector3(0, -0.195, 0.01), rot: (_s: number, up: boolean): number => (up ? -0.9 : -0.55) };
      add(merge(
        new THREE.CylinderGeometry(0.009, 0.009, 0.06, 6).translate(0, 0.012, 0),
        new THREE.SphereGeometry(0.014, 6, 4).translate(0, 0.047, 0),
      ), 0x3a2416, 0.128, 0.45, 0, swordArm, always, 'leather', sword);
      add(merge(
        new THREE.BoxGeometry(0.075, 0.011, 0.016).translate(0, -0.022, 0),
        new THREE.BoxGeometry(0.026, 0.27, 0.0055).translate(0, -0.165, 0),
        new THREE.ConeGeometry(0.0185, 0.04, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).rotateX(Math.PI).translate(0, -0.32, 0),
      ), STEEL, 0.128, 0.45, 0, swordArm, always, 'metal', sword);
      flush();
      for (let i = legsEnd; i < this.parts.length; i++) this.parts[i]!.pos.y += LIFT;
      return;
    }
    if (kind === 'spearman' || kind === 'archer') {
      const archer = kind === 'archer';
      // dłuższe nogi i mniejsza głowa niż u chłopa: sylwetka żołnierza, a nie figurki
      const LIFT = 0.035;
      const head = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(0, -0.47, 0).scale(0.87, 0.87, 0.87).translate(0, 0.47, 0);
      const legsEnd = this.parts.length + 4;
      const BOOT = 0x2a1d13, LEATHER = 0x5a3b22, GLOVE = 0x3b2a1b, STEEL = 0xa6abb2, IRON = 0x767b83, WOOD = 0x6e5233;
      // nogi: nogawice zwężone ku kostce, wysokie buty z cholewą (archer: wywinięty mankiet)
      for (const [x, rot] of [[-0.052, legL], [0.052, legR]] as const) {
        add(taper(0.046, 0.033, 0.17 + LIFT), archer ? 0x4a3f2c : 0x3b3226, x, 0.235 + LIFT, 0, rot);
        add(merge(
          new THREE.CylinderGeometry(0.037, 0.04, 0.085, 8).translate(0, -0.19, 0),
          new THREE.BoxGeometry(0.068, 0.04, 0.11).translate(0, -0.215, 0.026),
          new THREE.SphereGeometry(0.035, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, -0.235 + 0.02, 0.078),
          ...(archer ? [new THREE.CylinderGeometry(0.046, 0.042, 0.025, 8).translate(0, -0.145, 0)] : []),
        ).translate(0, -LIFT, 0), BOOT, x, 0.235 + LIFT, 0, rot, always, 'leather');
      }
      // twarz: głowa, nos, cień oczodołów
      fix(head(new THREE.IcosahedronGeometry(0.072, 1).scale(0.95, 1.08, 1).translate(0, 0.555, 0)), skin, 'skin');
      fix(head(new THREE.BoxGeometry(0.014, 0.026, 0.016).translate(0, 0.548, 0.069)), skin, 'skin');
      for (const ex of [-0.022, 0.022]) fix(head(new THREE.BoxGeometry(0.013, 0.009, 0.006).translate(ex, 0.564, 0.065)), 0x3a281c, 'skin');
      // dłonie w skórzanych rękawicach
      const hand = (): THREE.BufferGeometry => new THREE.IcosahedronGeometry(0.03, 1).scale(1, 1.2, 1.05).translate(0, -0.195, 0.004);
      if (!archer) {
        // Włócznik: kolczuga z czepcem pod waffenrockiem w barwach pana, kapalin albo hełm z nosalem, wypukła tarcza i włócznia z liściastym grotem
        fix(prep(lathe([[0.112, 0.15], [0.108, 0.2], [0.098, 0.28], [0.104, 0.34], [0.118, 0.4], [0.113, 0.445], [0.078, 0.474], [0.046, 0.49]], 14, 0.75, 0, Math.PI * 2, 0.005), (_x, y) => 0.86 + 0.14 * Math.cos((y * Math.PI * 2) / 0.02)), STEEL, 'metal');
        fix(prep(lathe([[0.123, 0.128], [0.119, 0.2], [0.104, 0.29], [0.11, 0.34], [0.123, 0.4], [0.116, 0.44], [0.086, 0.462]], 16, 0.76), (x, y, z) => {
          if (y < 0.152) return 0.5; // ciemny obrębek dołu
          const fold = y < 0.29 ? 0.9 + 0.1 * Math.cos(Math.atan2(x, z) * 7) : 1; // fałdy spódnicy pod pasem
          return fold * (0.86 + (y - 0.13) * 0.45);
        }), tunic);
        // krzyż na piersi i plecach
        for (const z of [0.093, -0.093]) {
          fix(new THREE.BoxGeometry(0.024, 0.1, 0.006).translate(0, 0.385, z), 0xd8cca8);
          fix(new THREE.BoxGeometry(0.072, 0.022, 0.006).translate(0, 0.402, z), 0xd8cca8);
        }
        fix(lathe([[0.107, 0.285], [0.111, 0.296], [0.111, 0.31], [0.106, 0.322]], 16, 0.78), LEATHER, 'leather');
        fix(new THREE.BoxGeometry(0.03, 0.026, 0.012).translate(0, 0.303, 0.087), 0xb38a3a, 'metal');
        // czepiec kolczy: szyja dookoła, wyżej otwarty na twarz
        fix(head(lathe([[0.05, 0.468], [0.074, 0.486], [0.079, 0.505]], 12)), STEEL, 'metal');
        fix(head(lathe([[0.079, 0.505], [0.081, 0.53], [0.079, 0.555], [0.068, 0.575]], 12, 1, 0.95, Math.PI * 2 - 1.9)), STEEL, 'metal');
        const kettle = (l: Look): boolean => l.headwear % 3 !== 1, nasal = (l: Look): boolean => l.headwear % 3 === 1;
        // kapalin: kopuła z szerokim, opadającym rondem
        fix(head(merge(
          lathe([[0.09, 0.585], [0.089, 0.596], [0.085, 0.617], [0.07, 0.64], [0.04, 0.657], [0, 0.662]], 14),
          lathe([[0.09, 0.583], [0.151, 0.551], [0.148, 0.558], [0.124, 0.576], [0.09, 0.585]], 18),
        )), IRON, 'metal', kettle);
        fix(head(lathe([[0.0905, 0.588], [0.092, 0.598], [0.0905, 0.607]], 14)), 0x4a4d52, 'metal', kettle);
        // hełm stożkowy z nosalem
        fix(head(merge(
          lathe([[0.085, 0.582], [0.082, 0.598], [0.064, 0.627], [0.03, 0.66], [0, 0.684]], 14),
          lathe([[0.086, 0.576], [0.089, 0.583], [0.089, 0.596], [0.086, 0.6]], 14),
          new THREE.BoxGeometry(0.017, 0.065, 0.012).translate(0, 0.553, 0.08),
        )), IRON, 'metal', nasal);
        // lewa ręka z tarczą
        add(merge(new THREE.SphereGeometry(0.035, 10, 6).scale(1, 0.85, 1).translate(0, -0.004, 0), taper(0.036, 0.029, 0.175)), STEEL, -0.128, 0.45, 0, armL, always, 'metal');
        add(hand(), GLOVE, -0.128, 0.45, 0, armL, always, 'leather');
        const shield = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateY(0.6).translate(-0.02, -0.11, 0.035);
        add(shield(prep(new THREE.SphereGeometry(0.33, 18, 5, 0, Math.PI * 2, 0, 0.38).rotateZ(Math.PI / 2).translate(0.28, 0, 0), (_x, y, z) => 0.8 + 0.25 * (1 - Math.hypot(y, z) / 0.122))), tunic, -0.128, 0.45, 0, armL, always, 'wood');
        add(shield(merge(
          new THREE.TorusGeometry(0.122, 0.008, 4, 22).rotateY(Math.PI / 2).translate(-0.027, 0, 0),
          new THREE.SphereGeometry(0.03, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2).translate(-0.047, 0, 0),
        )), IRON, -0.128, 0.45, 0, armL, always, 'metal');
        // prawa ręka trzyma włócznię pionowo przy boku; pchnięcie: ręka do przodu, włócznia grotem we wroga
        const thrustArm = (_s: number, up: boolean): number => (up ? -1.25 : -0.25);
        const thrustSpear = (_s: number, up: boolean): number => (up ? 1.45 : 0);
        add(merge(new THREE.SphereGeometry(0.035, 10, 6).scale(1, 0.85, 1).translate(0, -0.004, 0), taper(0.036, 0.029, 0.175)), STEEL, 0.128, 0.45, 0, thrustArm, always, 'metal');
        add(hand(), GLOVE, 0.128, 0.45, 0, thrustArm, always, 'leather');
        add(merge(
          new THREE.CylinderGeometry(0.0105, 0.012, 1.2, 6).translate(0, 0.24, 0),
          new THREE.CylinderGeometry(0.013, 0.011, 0.03, 6).translate(0, -0.37, 0),
        ), WOOD, 0.15, 0.36, 0.075, thrustSpear, always, 'wood');
        add(merge(
          new THREE.OctahedronGeometry(1, 0).scale(0.027, 0.09, 0.008).translate(0, 0.93, 0),
          new THREE.CylinderGeometry(0.0125, 0.014, 0.05, 6).translate(0, 0.855, 0),
        ), STEEL, 0.15, 0.36, 0.075, thrustSpear, always, 'metal');
        flush();
        for (let i = legsEnd; i < this.parts.length; i++) this.parts[i]!.pos.y += LIFT;
        return;
      }
      // Łucznik: pikowana przeszywanica w barwach pana, kaptur z pelerynką i ogonem, kołczan, kord u pasa i długi łuk
      fix(prep(lathe([[0.121, 0.138], [0.118, 0.2], [0.1, 0.29], [0.106, 0.34], [0.114, 0.41], [0.104, 0.448], [0.072, 0.474], [0.05, 0.486]], 16, 0.76), (_x, y) => {
        if (y < 0.158) return 0.55;
        return (0.86 + 0.14 * Math.cos((y * Math.PI * 2) / 0.034)) * (0.88 + (y - 0.14) * 0.35); // poziome pikowanie
      }), tunic);
      fix(lathe([[0.103, 0.284], [0.106, 0.295], [0.106, 0.308], [0.101, 0.32]], 16, 0.78), LEATHER, 'leather');
      fix(new THREE.BoxGeometry(0.045, 0.05, 0.03).translate(-0.06, 0.262, 0.072), LEATHER, 'leather');
      // kord w pochwie na prawym biodrze
      fix(new THREE.BoxGeometry(0.02, 0.13, 0.012).rotateZ(0.35).translate(0.112, 0.235, 0.02), 0x2a1d13, 'leather');
      fix(merge(new THREE.BoxGeometry(0.05, 0.008, 0.01).rotateZ(0.35).translate(0.087, 0.3, 0.02), new THREE.CylinderGeometry(0.007, 0.007, 0.04, 5).rotateZ(0.35).translate(0.08, 0.322, 0.02)), IRON, 'metal');
      // pelerynka kaptura na ramionach, kaptur otwarty na twarz, ogon kaptura opada na plecy
      fix(prep(lathe([[0.138, 0.398], [0.134, 0.428], [0.113, 0.458], [0.079, 0.486], [0.06, 0.5]], 16, 0.86), (_x, y) => (y < 0.405 ? 0.5 : 0.72)), tunic);
      fix(prep(head(new THREE.SphereGeometry(0.087, 16, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.66).translate(0, 0.558, -0.004)), () => 0.72), tunic);
      fix(prep(head(new THREE.ConeGeometry(0.03, 0.13, 7).rotateX(-2.1).translate(0, 0.565, -0.115)), () => 0.66), tunic);
      // kołczan na plecach, wylotem nad prawym ramieniem: duży, jasna skóra z ciemnym okuciem, strzały wystają ponad wylot
      const Q = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(-0.18).rotateZ(-0.38).translate(0.055, 0.35, -0.118);
      fix(Q(prep(new THREE.CylinderGeometry(0.043, 0.035, 0.3, 10), (_x, y) => (Math.abs(y + 0.08) < 0.012 ? 0.6 : 1))), 0x8a5c34, 'leather');
      fix(Q(merge(lathe([[0.044, 0.135], [0.047, 0.15], [0.046, 0.158]], 10), new THREE.CylinderGeometry(0.036, 0.036, 0.012, 10).translate(0, -0.153, 0))), 0x3a2616, 'leather');
      // pas kołczanu przez pierś (widać go też od przodu)
      fix(prep(lathe([[0.117, -0.012], [0.119, 0], [0.117, 0.012]], 18, 0.8).rotateZ(-0.62).translate(0.0, 0.372, 0.0), () => 1), 0x4a3020, 'leather');
      const tips: [number, number][] = [[0, 0], [0.018, 0.01], [-0.014, 0.013], [0.008, -0.018], [-0.018, -0.008], [0.02, -0.006]];
      const arrows = (part: 'shaft' | 'white' | 'red'): THREE.BufferGeometry => merge(...tips.filter((_, i) => part === 'shaft' || (i % 2 === 0) === (part === 'white')).map(([dx, dz]) => Q(part === 'shaft'
        ? new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4).translate(dx, 0.17, dz)
        : merge(new THREE.BoxGeometry(0.005, 0.06, 0.03).translate(dx, 0.205, dz), new THREE.BoxGeometry(0.03, 0.06, 0.005).translate(dx, 0.205, dz)))));
      fix(arrows('shaft'), 0x9a7a4e, 'wood');
      fix(arrows('white'), 0xeae3d0);
      fix(arrows('red'), 0x9a2a20);
      // ręce: rękawy przeszywanicy, na lewym przedramieniu karwasz
      const bowArm = (s: number, up: boolean): number => (up ? -1.5 : -s * 0.6);
      const drawArm = (s: number, up: boolean): number => (up ? -1.35 : s * 0.6);
      const sleeve = (): THREE.BufferGeometry => prep(merge(new THREE.SphereGeometry(0.034, 10, 6).scale(1, 0.85, 1).translate(0, -0.004, 0), taper(0.035, 0.029, 0.17)), (_x, y) => 0.8 + 0.12 * Math.cos((y * Math.PI * 2) / 0.034));
      add(sleeve(), tunic, -0.126, 0.45, 0, bowArm);
      add(new THREE.CylinderGeometry(0.035, 0.034, 0.055, 9).translate(0, -0.15, 0), LEATHER, -0.126, 0.45, 0, bowArm, always, 'leather');
      add(hand(), GLOVE, -0.126, 0.45, 0, bowArm, always, 'leather');
      add(sleeve(), tunic, 0.126, 0.45, 0, drawArm);
      add(hand(), GLOVE, 0.126, 0.45, 0, drawArm, always, 'leather');
      // długi łuk: w dłoni, ale zawsze pionowo (druga oś obrotu znosi uniesienie ręki); cięciwa po stronie łucznika
      const chord = 0.58, sag = 0.07, R = (chord * chord / 4 + sag * sag) / (2 * sag), arc = 2 * Math.asin(chord / 2 / R);
      const bowSub = { at: new THREE.Vector3(0, -0.19, 0.005), rot: (s: number, up: boolean): number => -bowArm(s, up) + (up ? 0 : 0.28) };
      add(new THREE.TorusGeometry(R, 0.0095, 5, 22, arc).rotateZ(-arc / 2).translate(-R, 0, 0).rotateY(-Math.PI / 2), 0x5a3a20, -0.126, 0.45, 0, bowArm, always, 'wood', bowSub);
      add(new THREE.CylinderGeometry(0.0025, 0.0025, chord, 3).translate(-sag, 0, 0).rotateY(-Math.PI / 2), 0xe6dfcc, -0.126, 0.45, 0, bowArm, always, 'cloth', bowSub);
      flush();
      for (let i = legsEnd; i < this.parts.length; i++) this.parts[i]!.pos.y += LIFT;
      return;
    }
    // ---- chłop: wełniana tunika do kolan w przygaszonych barwach pana, sznurek w pasie, owijacze, nakrycie głowy ----
    // kotwice narzędzi zostają jak dawniej: bark (±0,135; 0,45), dłoń 0,185 niżej, głowa na 0,555
    const LINEN = 0xd9ceb0, STRAW = 0xcfae55, SHOE = 0x33251a;
    const head = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(0, -0.47, 0).scale(0.93, 0.93, 0.93).translate(0, 0.47, 0);
    const trousers = (l: Look): number => l.trousers, hair = (l: Look): number => l.hair, hat = (l: Look): number => l.hat;
    const wraps = (l: Look): boolean => l.wraps, apron = (l: Look): boolean => l.apron, beard = (l: Look): boolean => l.beard;
    const hairOn = (l: Look): boolean => l.headwear !== 1 && l.headwear !== 3;
    const strawHat = (l: Look): boolean => l.headwear === 0, hood = (l: Look): boolean => l.headwear === 1;
    const cap = (l: Look): boolean => l.headwear === 2, kerchief = (l: Look): boolean => l.headwear === 3;
    for (const [x, rot] of [[-0.052, legL], [0.052, legR]] as const) {
      add(taper(0.045, 0.033, 0.17), trousers, x, 0.235, 0, rot);
      // owijacze: lniane pasy na łydce (co drugi chłop)
      add(prep(taper(0.039, 0.035, 0.08).translate(0, -0.12, 0), (_x, y) => 0.85 + 0.15 * Math.cos((y * Math.PI * 2) / 0.016)), 0xa89a7c, x, 0.235, 0, rot, wraps);
      add(merge(
        new THREE.CylinderGeometry(0.035, 0.038, 0.035, 8).translate(0, -0.2175, 0),
        new THREE.BoxGeometry(0.064, 0.034, 0.105).translate(0, -0.218, 0.024),
        new THREE.SphereGeometry(0.032, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, -0.235 + 0.017, 0.074),
      ), SHOE, x, 0.235, 0, rot, always, 'leather');
    }
    // tunika do pół uda: fałdy pod pasem, ciemniejszy, wytarty dół
    fix(prep(lathe([[0.12, 0.158], [0.115, 0.2], [0.097, 0.29], [0.101, 0.34], [0.11, 0.405], [0.108, 0.44], [0.07, 0.468], [0.046, 0.478]], 16, 0.76), (x, y, z) => {
      if (y < 0.176) return 0.62;
      const fold = y < 0.29 ? 0.88 + 0.12 * Math.cos(Math.atan2(x, z) * 6 + y * 30) : 1;
      return fold * (0.84 + (y - 0.16) * 0.5);
    }), tunic);
    // fartuch z przodu
    fix(prep(lathe([[0.124, 0.15], [0.118, 0.2], [0.102, 0.285], [0.1, 0.33]], 10, 0.8, -0.85, 1.7), (_x, y) => 0.88 + (y - 0.15) * 0.6), LINEN, 'cloth', apron);
    // sznurek w pasie z sakiewką
    fix(lathe([[0.098, 0.287], [0.101, 0.293], [0.101, 0.301], [0.097, 0.307]], 16, 0.78), 0x8a7350);
    fix(merge(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.15, 0.7).translate(-0.072, 0.262, 0.05), new THREE.CylinderGeometry(0.004, 0.004, 0.03, 4).translate(-0.072, 0.293, 0.05)), 0x6a4a2e, 'leather');
    // ręce: rękawy tuniki, gołe dłonie
    for (const [x, rot] of [[-0.135, armL], [0.135, armR]] as const) {
      add(prep(merge(new THREE.SphereGeometry(0.035, 10, 6).scale(1, 0.85, 1).translate(0, -0.004, 0), taper(0.035, 0.028, 0.15)), (_x, y) => 0.86 + 0.06 * Math.sin(y * 60)), tunic, x, 0.45, 0, rot);
      add(new THREE.IcosahedronGeometry(0.028, 1).scale(1, 1.2, 1.05).translate(0, -0.185, 0.003), skin, x, 0.45, 0, rot, always, 'skin');
    }
    // głowa: twarz, nos, oczy, szyja
    fix(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 8).translate(0, 0.485, 0), skin, 'skin');
    fix(head(new THREE.IcosahedronGeometry(0.072, 1).scale(0.95, 1.08, 1).translate(0, 0.555, 0)), skin, 'skin');
    fix(head(new THREE.BoxGeometry(0.014, 0.026, 0.016).translate(0, 0.548, 0.069)), skin, 'skin');
    for (const ex of [-0.022, 0.022]) fix(head(new THREE.BoxGeometry(0.013, 0.009, 0.006).translate(ex, 0.564, 0.065)), 0x3a281c, 'skin');
    // włosy: czupryna z tyłu i na czubku, broda u co trzeciego
    fix(head(new THREE.SphereGeometry(0.078, 14, 8, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.6).translate(0, 0.562, -0.006)), hair, 'cloth', hairOn);
    fix(head(new THREE.SphereGeometry(0.077, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.32).translate(0, 0.565, 0)), hair, 'cloth', hairOn);
    fix(head(prep(new THREE.IcosahedronGeometry(0.05, 1).scale(1.12, 0.95, 0.85).translate(0, 0.518, 0.03), (_x, y) => 0.85 + (y - 0.48) * 2)), hair, 'cloth', beard);
    // słomkowy kapelusz z szerokim rondem
    fix(head(prep(merge(
      lathe([[0.08, 0.588], [0.155, 0.572], [0.16, 0.566], [0.08, 0.582]], 18),
      lathe([[0.08, 0.582], [0.074, 0.62], [0.06, 0.64], [0, 0.645]], 14),
    ), (_x, y) => 0.85 + 0.15 * Math.cos(y * 300))), STRAW, 'cloth', strawHat);
    fix(head(lathe([[0.0795, 0.596], [0.0795, 0.608]], 14)), 0x7a3a2a, 'cloth', strawHat);
    // kaptur z pelerynką
    fix(head(prep(new THREE.SphereGeometry(0.087, 16, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.66).translate(0, 0.558, -0.004), () => 0.9)), hat, 'cloth', hood);
    fix(prep(lathe([[0.132, 0.4], [0.128, 0.428], [0.108, 0.456], [0.075, 0.484], [0.056, 0.5]], 16, 0.86), (_x, y) => (y < 0.407 ? 0.6 : 0.85)), hat, 'cloth', hood);
    // filcowa czapka
    fix(head(lathe([[0.08, 0.578], [0.084, 0.6], [0.075, 0.622], [0.045, 0.638], [0, 0.642]], 14)), hat, 'cloth', cap);
    fix(head(lathe([[0.083, 0.577], [0.086, 0.585], [0.084, 0.593]], 14)), 0x3a2a1c, 'cloth', cap);
    // lniana chusta zawiązana pod brodą
    fix(head(prep(merge(
      new THREE.SphereGeometry(0.081, 14, 8, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.72).translate(0, 0.56, -0.004),
      new THREE.TorusGeometry(0.06, 0.009, 4, 12, Math.PI).rotateX(0.25).rotateZ(Math.PI).translate(0, 0.53, 0.02),
    ), (_x, y) => 0.9 + (y - 0.5) * 0.4)), LINEN, 'cloth', kerchief);
    flush();
  }

  /** Ustawia postać numer `i`. `base` = położenie i obrót całej postaci, `id` = numer chłopa (od niego zależy wygląd). */
  /** Skala postaci (ludzie są różnego wzrostu) — potrzebna, żeby narzędzie w dłoni trafiało w rękę. */
  sizeOf(id: number, tunic: number): number { return lookOf(id, tunic, this.muted).size; }

  /**
   * `work` = poza przy pracy: kąt prawej ręki (ujemny = w przód i w górę); nogi stoją, lewa ręka lekko przed sobą.
   * Bez tego `swing` rusza rękami i nogami jak przy chodzie.
   */
  set(i: number, base: THREE.Matrix4, swing: number, armsUp: boolean, tunic: number, id = i, work?: number, workL = -0.5, walkLegs = false): void {
    const look = lookOf(id, tunic, this.muted);
    this.scaled.copy(base).scale(this.one.setScalar(look.size));
    this.one.setScalar(1);
    for (const p of this.parts) {
      if (!p.shown(look)) { p.mesh.setMatrixAt(i, this.none); continue; }
      const r = work === undefined ? p.rot(swing, armsUp)
        : p.rot === armR ? work : p.rot === armL ? workL : p.rot === legL || p.rot === legR ? (walkLegs ? p.rot(swing, false) : 0) : p.rot(0, false);
      this.q.setFromEuler(this.e.set(r, 0, 0));
      this.local.compose(p.pos, this.q, this.one);
      if (p.sub) { this.q.setFromEuler(this.e.set(p.sub.rot(swing, armsUp), 0, 0)); this.local.multiply(this.subM.compose(p.sub.at, this.q, this.one)); }
      this.out.multiplyMatrices(this.scaled, this.local);
      p.mesh.setMatrixAt(i, this.out);
      if (p.color) p.mesh.setColorAt(i, this.color.setHex(p.color(look)));
    }
  }

  finish(count: number): void {
    for (const p of this.parts) {
      p.mesh.count = count;
      p.mesh.visible = count > 0; // pusta grupa nie kosztuje wywołania rysowania
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
}

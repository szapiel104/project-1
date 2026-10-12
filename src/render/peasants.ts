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
}

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
  size: number;
}

const TROUSERS = [0x5a4632, 0x4a4a3a, 0x6b5a3c, 0x3f3a33, 0x55503c];
const HAIR = [0x3a2a1c, 0x6b4a2b, 0x1f1a16, 0xa8834a, 0x8a8a84, 0x7a3a1c];
const SKIN = [0xe2bd94, 0xd9a877, 0xedc9a4, 0xc99872];
const CAPS = [0x5c7a3a, 0x7a3a2a, 0x3a5a7a, 0x8a6a2a, 0x4a4a4a];

function mix(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

const looks = new Map<string, Look>();
function lookOf(id: number, tunic: number): Look {
  const key = `${id}:${tunic}`;
  let l = looks.get(key);
  if (l) return l;
  const pickOf = <T,>(list: readonly T[], salt: number): T => list[mix(id, salt) % list.length]!;
  // tunika zostaje w barwie drużyny, ale u każdego w nieco innym odcieniu
  const c = new THREE.Color(tunic);
  const shade = 0.8 + (mix(id, 1) % 40) / 100;
  c.multiplyScalar(shade);
  l = {
    tunic: c.getHex(), trousers: pickOf(TROUSERS, 2), hair: pickOf(HAIR, 3), skin: pickOf(SKIN, 4),
    headwear: mix(id, 5) % 5, hat: pickOf(CAPS, 6), apron: mix(id, 7) % 4 === 0, beard: mix(id, 8) % 3 === 0,
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
  private local = new THREE.Matrix4();
  private out = new THREE.Matrix4();
  private scaled = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private one = new THREE.Vector3(1, 1, 1);
  private none = new THREE.Matrix4().makeScale(0, 0, 0);
  private color = new THREE.Color();

  constructor(max: number, scene: THREE.Scene, kind: 'peasant' | 'spearman' | 'archer' = 'peasant') {
    const always = (): boolean => true;
    const add = (geo: THREE.BufferGeometry, color: number | Part['color'], x: number, y: number, z: number, rot: Part['rot'], shown: Part['shown'] = always): void => {
      const fixed = typeof color === 'number';
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: fixed ? color : 0xffffff, flatShading: true, roughness: 0.9 }), max);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.parts.push({ mesh, pos: new THREE.Vector3(x, y, z), rot, color: fixed ? null : color, shown });
    };
    const limb = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0); // obrót wokół góry
    const still = (): number => 0;
    const legL = (s: number): number => s, legR = (s: number): number => -s;
    const armL = (s: number, up: boolean): number => (up ? -1.35 : -s * 0.8), armR = (s: number, up: boolean): number => (up ? -1.35 : s * 0.8);
    if (kind === 'archer') {
      // Łucznik: przeszywanica w barwach drużyny, kaptur, kołczan na plecach, łuk w lewej ręce.
      // Strzał (armsUp): lewa ręka z łukiem wyciągnięta do przodu, prawa naciąga cięciwę
      const LEATHER = 0x6a4a2e;
      for (const [x, rot] of [[-0.055, legL], [0.055, legR]] as const) {
        add(limb(0.075, 0.17, 0.085), 0x4a3a2a, x, 0.23, 0, rot);
        add(new THREE.BoxGeometry(0.085, 0.07, 0.12).translate(0, -0.2, 0.015), 0x2a1e14, x, 0.23, 0, rot);
      }
      add(new THREE.BoxGeometry(0.2, 0.27, 0.13).translate(0, 0.125, 0), (l) => l.tunic, 0, 0.22, 0, still);
      add(new THREE.BoxGeometry(0.21, 0.035, 0.14), LEATHER, 0, 0.3, 0, still);
      // kołczan ze strzałami na plecach
      add(new THREE.CylinderGeometry(0.035, 0.03, 0.24, 7).rotateZ(0.35).translate(0.05, 0.14, -0.09), LEATHER, 0, 0.22, 0, still);
      for (const dx of [-0.015, 0.01, 0.03]) add(new THREE.BoxGeometry(0.012, 0.06, 0.012).translate(0.09 + dx, 0.29, -0.09), 0xe8e0c8, 0, 0.22, 0, still);
      const bowArm = (s: number, up: boolean): number => (up ? -1.5 : -s * 0.6);
      const drawArm = (s: number, up: boolean): number => (up ? -1.35 : s * 0.6);
      add(limb(0.06, 0.16, 0.065), (l) => l.tunic, -0.135, 0.45, 0, bowArm);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.055).translate(0, -0.185, 0), (l) => l.skin, -0.135, 0.45, 0, bowArm);
      add(new THREE.TorusGeometry(0.2, 0.012, 4, 14, Math.PI * 0.9).rotateY(Math.PI / 2).rotateX(Math.PI / 2 + Math.PI * 0.05).translate(0, -0.19, 0.03), 0x6b4626, -0.135, 0.45, 0, bowArm);
      add(limb(0.06, 0.16, 0.065), (l) => l.tunic, 0.135, 0.45, 0, drawArm);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.055).translate(0, -0.185, 0), (l) => l.skin, 0.135, 0.45, 0, drawArm);
      add(new THREE.IcosahedronGeometry(0.085, 1), (l) => l.skin, 0, 0.555, 0, still);
      // kaptur z pelerynką
      add(new THREE.SphereGeometry(0.1, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, 0.005, -0.008), (l) => l.tunic, 0, 0.56, 0, still);
      add(new THREE.CylinderGeometry(0.11, 0.15, 0.06, 10).translate(0, -0.09, 0), (l) => l.tunic, 0, 0.56, 0, still);
      return;
    }
    if (kind === 'spearman') {
      // Włócznik: kolczuga pod tuniką w barwach drużyny, hełm z rondem (kapalin), okrągła tarcza i długa włócznia
      const MAIL = 0x7c8088, IRON = 0x5a5e66;
      for (const [x, rot] of [[-0.055, legL], [0.055, legR]] as const) {
        add(limb(0.078, 0.17, 0.088), 0x4a3a2a, x, 0.23, 0, rot);
        add(new THREE.BoxGeometry(0.088, 0.075, 0.125).translate(0, -0.2, 0.015), 0x2a1e14, x, 0.23, 0, rot);
      }
      add(new THREE.BoxGeometry(0.21, 0.26, 0.14).translate(0, 0.125, 0), MAIL, 0, 0.22, 0, still);
      add(new THREE.BoxGeometry(0.18, 0.3, 0.02).translate(0, 0.09, 0.075), (l) => l.tunic, 0, 0.22, 0, still);
      add(new THREE.BoxGeometry(0.18, 0.3, 0.02).translate(0, 0.09, -0.075), (l) => l.tunic, 0, 0.22, 0, still);
      add(new THREE.BoxGeometry(0.22, 0.035, 0.15), 0x3a2a1c, 0, 0.3, 0, still);
      add(limb(0.065, 0.16, 0.07), MAIL, -0.14, 0.45, 0, armL);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.055).translate(0, -0.185, 0), (l) => l.skin, -0.14, 0.45, 0, armL);
      // prawa ręka trzyma włócznię pionowo przy boku
      // pchnięcie: ręka wychodzi do przodu, a włócznia kładzie się poziomo grotem we wroga
      const thrustArm = (_s: number, up: boolean): number => (up ? -1.25 : -0.25);
      const thrustSpear = (_s: number, up: boolean): number => (up ? 1.45 : 0);
      add(limb(0.065, 0.16, 0.07), MAIL, 0.14, 0.45, 0, thrustArm);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.055).translate(0, -0.185, 0), (l) => l.skin, 0.14, 0.45, 0, thrustArm);
      add(mergeGeometries([
        new THREE.CylinderGeometry(0.012, 0.014, 1.15, 5).translate(0, 0.32, 0),
        new THREE.ConeGeometry(0.026, 0.12, 4).translate(0, 0.95, 0),
      ].map((g) => g.toNonIndexed()).map((g) => g.translate(0, -0.1, 0))), 0x8a6a42, 0.165, 0.36, 0.08, thrustSpear);
      add(new THREE.ConeGeometry(0.027, 0.12, 4).translate(0, 0.85, 0), 0xb9bec6, 0.165, 0.36, 0.08, thrustSpear);
      // tarcza na lewym przedramieniu
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12).rotateZ(Math.PI / 2).translate(-0.03, -0.1, 0.02), (l) => l.tunic, -0.16, 0.45, 0, armL);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateZ(Math.PI / 2).translate(-0.045, -0.1, 0.02), IRON, -0.16, 0.45, 0, armL);
      add(new THREE.IcosahedronGeometry(0.085, 1), (l) => l.skin, 0, 0.555, 0, still);
      add(mergeGeometries([
        new THREE.SphereGeometry(0.095, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.01, 0).toNonIndexed(),
        new THREE.CylinderGeometry(0.15, 0.15, 0.016, 12).translate(0, 0.0, 0).toNonIndexed(),
      ]), IRON, 0, 0.575, 0, still);
      return;
    }
    // nogi z butami (but jest częścią nogi, więc macha razem z nią)
    for (const [x, rot] of [[-0.055, legL], [0.055, legR]] as const) {
      add(limb(0.075, 0.17, 0.085), (l) => l.trousers, x, 0.23, 0, rot);
      add(new THREE.BoxGeometry(0.085, 0.07, 0.12).translate(0, -0.2, 0.015), 0x2e2219, x, 0.23, 0, rot);
    }
    // tułów: tunika, pas, czasem jasny fartuch
    add(new THREE.BoxGeometry(0.2, 0.25, 0.13).translate(0, 0.125, 0), (l) => l.tunic, 0, 0.22, 0, still);
    add(new THREE.BoxGeometry(0.21, 0.03, 0.14), 0x3a2a1c, 0, 0.3, 0, still);
    add(new THREE.BoxGeometry(0.14, 0.17, 0.02), 0xe6dcc0, 0, 0.3, 0.07, still, (l) => l.apron);
    // ręce z dłońmi
    for (const [x, rot] of [[-0.135, armL], [0.135, armR]] as const) {
      add(limb(0.06, 0.16, 0.065), (l) => l.tunic, x, 0.45, 0, rot);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.055).translate(0, -0.185, 0), (l) => l.skin, x, 0.45, 0, rot);
    }
    // głowa, włosy, broda
    add(new THREE.IcosahedronGeometry(0.085, 1), (l) => l.skin, 0, 0.555, 0, still);
    add(new THREE.IcosahedronGeometry(0.09, 1).scale(1, 0.75, 1).translate(0, 0.03, -0.012), (l) => l.hair, 0, 0.555, 0, still, (l) => l.headwear !== 1);
    add(new THREE.BoxGeometry(0.1, 0.06, 0.05).translate(0, -0.06, 0.055), (l) => l.hair, 0, 0.555, 0, still, (l) => l.beard);
    // nakrycia głowy: słomkowy kapelusz, kaptur z kołnierzem, płaska czapka, chustka; co piąty chodzi z gołą głową
    add(mergeGeometries([
      new THREE.CylinderGeometry(0.15, 0.15, 0.018, 10),
      new THREE.CylinderGeometry(0.06, 0.085, 0.07, 8).translate(0, 0.04, 0),
    ]), 0xcfae55, 0, 0.615, 0, still, (l) => l.headwear === 0);
    add(mergeGeometries([
      new THREE.IcosahedronGeometry(0.105, 1).scale(1, 1.05, 1.05).translate(0, 0.0, -0.015).toNonIndexed(),
      new THREE.CylinderGeometry(0.12, 0.14, 0.06, 8).translate(0, -0.1, 0).toNonIndexed(),
    ]), (l) => l.hat, 0, 0.56, 0, still, (l) => l.headwear === 1);
    add(new THREE.CylinderGeometry(0.095, 0.1, 0.045, 8).translate(0, 0.03, 0), (l) => l.hat, 0, 0.605, 0, still, (l) => l.headwear === 2);
    add(new THREE.IcosahedronGeometry(0.095, 1).scale(1, 0.6, 1).translate(0, 0.04, -0.01), (l) => l.hat, 0, 0.555, 0, still, (l) => l.headwear === 3);
  }

  /** Ustawia postać numer `i`. `base` = położenie i obrót całej postaci, `id` = numer chłopa (od niego zależy wygląd). */
  set(i: number, base: THREE.Matrix4, swing: number, armsUp: boolean, tunic: number, id = i): void {
    const look = lookOf(id, tunic);
    this.scaled.copy(base).scale(this.one.setScalar(look.size));
    this.one.setScalar(1);
    for (const p of this.parts) {
      if (!p.shown(look)) { p.mesh.setMatrixAt(i, this.none); continue; }
      this.q.setFromEuler(this.e.set(p.rot(swing, armsUp), 0, 0));
      this.local.compose(p.pos, this.q, this.one);
      this.out.multiplyMatrices(this.scaled, this.local);
      p.mesh.setMatrixAt(i, this.out);
      if (p.color) p.mesh.setColorAt(i, this.color.setHex(p.color(look)));
    }
  }

  finish(count: number): void {
    for (const p of this.parts) {
      p.mesh.count = count;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
}

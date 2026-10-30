/**
 * Fizyka gruzu (Michał 28.10.2026): gdy budynek się zawala albo zostaje rozebrany, kamienie, belki i deski spadają
 * z wysokości budynku z prawdziwą grawitacją, odbijają się od siebie i od ziemi, i leżą tam, gdzie upadły — za każdym
 * razem inaczej. Silnik: cannon-es (MIT), wczytywany dopiero przy pierwszym zawaleniu (nie obciąża startu gry).
 *
 * Tylko obraz: symulacja gry nie wie, gdzie leży który kamień (mecz przez sieć się nie rozjeżdża). Gruz z wczytanego
 * zapisu leży od razu w ułożeniu z rubbleModel (bez spadania). Gdy wszystko znieruchomieje (albo po kilku sekundach),
 * świat fizyki jest usuwany — leżący gruz nic już nie kosztuje.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Cannon = typeof import('cannon-es');
/** Wysokość terenu względem środka stosu (x, z w polach od środka) */
export type Ground = (x: number, z: number) => number;

/** Grawitacja w polach/s² (pole ≈ 3 m, ale ciut mocniej, żeby spadanie było krótkie i ciężkie) */
const GRAVITY = 14;
/** Najdłużej tyle sekund trwa jedno zawalenie; potem kawałki zastygają tam, gdzie są */
const MAX_TIME = 6;
/** Tyle zawaleń liczy się naraz; kolejne kładą gruz od razu (np. w wielkiej bitwie) */
const MAX_FALLS = 6;
const STEP = 1 / 60;

interface Fall { pile: THREE.Group; world: InstanceType<Cannon['World']>; pairs: [InstanceType<Cannon['Body']>, THREE.Object3D][]; t: number }

let lib: Cannon | null = null;
let loading: Promise<Cannon> | null = null;
function load(): Promise<Cannon> {
  loading ??= import('cannon-es').then((m) => (lib = m));
  return loading;
}

/** Kształt fizyczny kamienia z jego siatki (wypukła bryła z wierzchołków dwunastościanu) */
const stoneShapes = new WeakMap<THREE.BufferGeometry, InstanceType<Cannon['ConvexPolyhedron']>>();
function stoneShape(C: Cannon, geo: THREE.BufferGeometry): InstanceType<Cannon['ConvexPolyhedron']> {
  let s = stoneShapes.get(geo);
  if (s) return s;
  const g = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
  const p = g.attributes.position!, idx = g.index!;
  const vertices: InstanceType<Cannon['Vec3']>[] = [];
  for (let i = 0; i < p.count; i++) vertices.push(new C.Vec3(p.getX(i), p.getY(i), p.getZ(i)));
  const faces: number[][] = [];
  for (let i = 0; i < idx.count; i += 3) faces.push([idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)]);
  g.dispose();
  s = new C.ConvexPolyhedron({ vertices, faces });
  stoneShapes.set(geo, s);
  return s;
}

export class RubbleFalls {
  private falls: Fall[] = [];

  /** Zbiera wszystkie trwające zawalenia (nowa mapa) */
  clear(): void { this.falls = []; }

  /** Ile zawaleń teraz liczy się w fizyce (okno wydajności) */
  get active(): number { return this.falls.length; }

  /** Czy kawałki tego stosu jeszcze spadają (wtedy nie zlewamy ich w jedną siatkę, bakeRubble) */
  falling(pile: THREE.Object3D): boolean { return this.falls.some((f) => f.pile === pile); }

  /**
   * Zawala stos `pile` (z rubbleModel, współrzędne względem środka działki w × h): kawałki startują z wysokości
   * do `height` nad ziemią, rozrzucone po działce, obrócone i z lekkim pchnięciem na boki, i spadają.
   */
  drop(pile: THREE.Group, w: number, h: number, height: number, ground?: Ground): void {
    if (this.falls.length >= MAX_FALLS) return; // zostaje gotowe ułożenie z rubbleModel
    if (!lib) { void load().then(() => this.start(pile, w, h, height, ground)); return; }
    this.start(pile, w, h, height, ground);
  }

  private start(pile: THREE.Group, w: number, h: number, height: number, ground?: Ground): void {
    const C = lib!;
    if (!pile.parent || this.falls.length >= MAX_FALLS) return; // stos zdążył zniknąć albo za dużo naraz
    const world = new C.World({ gravity: new C.Vec3(0, -GRAVITY, 0), allowSleep: true });
    world.broadphase = new C.SAPBroadphase(world);
    (world.solver as InstanceType<Cannon['GSSolver']>).iterations = 8;
    const mat = new C.Material('gruz');
    world.addContactMaterial(new C.ContactMaterial(mat, mat, { friction: 0.7, restitution: 0.12 }));
    world.defaultContactMaterial.friction = 0.7;
    world.defaultContactMaterial.restitution = 0.12;

    // ziemia: siatka wysokości pod działką (z zapasem), a pod nią płaszczyzna na wypadek kawałka, który odleci dalej
    const pad = 1, es = 0.1;
    const nx = Math.ceil((w + 2 * pad) / es) + 1, nz = Math.ceil((h + 2 * pad) / es) + 1;
    const x0 = -w / 2 - pad, zTop = h / 2 + pad;
    let low = 0;
    if (ground) {
      const data: number[][] = [];
      for (let i = 0; i < nx; i++) {
        const col: number[] = [];
        for (let j = 0; j < nz; j++) { const y = ground(x0 + i * es, zTop - j * es); col.push(y); low = Math.min(low, y); }
        data.push(col);
      }
      // siatka cannon leży w płaszczyźnie XY z wysokością w Z; obrót o -90° wokół X kładzie ją: (x, y, z) → (x, z, -y)
      const hf = new C.Body({ mass: 0, material: mat });
      hf.addShape(new C.Heightfield(data, { elementSize: es }));
      hf.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      hf.position.set(x0, 0, zTop);
      world.addBody(hf);
    }
    const plane = new C.Body({ mass: 0, material: mat });
    plane.addShape(new C.Plane());
    plane.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    plane.position.set(0, low - 0.002, 0);
    world.addBody(plane);

    // kawałki: kamienie jako wypukłe bryły, belki i deski jako prostopadłościany; startują rozrzucone na wysokości budynku
    const pairs: Fall['pairs'] = [];
    const n = pile.children.length;
    pile.children.forEach((o, i) => {
      const m = o as THREE.Mesh;
      const geo = m.geometry as THREE.BufferGeometry & { parameters?: { width?: number; height?: number; depth?: number; radius?: number } };
      const par = geo.parameters ?? {};
      let shape;
      let mass: number;
      if (par.radius !== undefined) { shape = stoneShape(C, geo); mass = 4 * par.radius ** 3 * 30; }
      else {
        const bw = par.width ?? 0.3, bh = par.height ?? 0.05, bd = par.depth ?? 0.1;
        shape = new C.Box(new C.Vec3(bw / 2, bh / 2, bd / 2));
        mass = bw * bh * bd * 12;
      }
      const body = new C.Body({ mass: Math.max(0.05, mass), material: mat, linearDamping: 0.04, angularDamping: 0.25 });
      body.addShape(shape);
      body.sleepSpeedLimit = 0.12;
      body.sleepTimeLimit = 0.35;
      // wysokość startu: im dalej na liście (wierzch stosu), tym wyżej — niżej mury, wyżej dach
      const up = (0.15 + (i / Math.max(1, n - 1)) * 0.85) * height * (0.6 + Math.random() * 0.4);
      const gx = m.position.x * (0.75 + Math.random() * 0.2), gz = m.position.z * (0.75 + Math.random() * 0.2);
      body.position.set(gx, (ground ? ground(gx, gz) : 0) + 0.15 + up, gz);
      body.quaternion.setFromEuler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      // pchnięcie na boki (zawalające się ściany rozchodzą się od środka) i obrót
      const out = 0.4 + Math.random() * 0.6;
      body.velocity.set(gx * out, Math.random() * 0.3, gz * out);
      body.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
      world.addBody(body);
      pairs.push([body, o]);
    });
    const fall: Fall = { pile, world, pairs, t: 0 };
    this.copy(fall);
    this.falls.push(fall);
  }

  /** Krok fizyki w tej klatce; zastygłe zawalenia schodzą z listy (świat fizyki przestaje istnieć) */
  step(dt: number): void {
    for (let i = this.falls.length - 1; i >= 0; i--) {
      const f = this.falls[i]!;
      // stos wyniesiony albo usunięty ze sceny w trakcie spadania: fizyka przestaje go liczyć
      const gone = !f.pairs.length || !f.pile.parent;
      if (!gone) {
        f.t += dt;
        f.world.step(STEP, Math.min(dt, 0.1), 4);
        this.copy(f);
      }
      const asleep = f.pairs.every(([b]) => b.sleepState === 2);
      if (gone || asleep || f.t > MAX_TIME) this.falls.splice(i, 1);
    }
  }

  private copy(f: Fall): void {
    for (const [b, o] of f.pairs) {
      o.position.set(b.position.x, b.position.y, b.position.z);
      o.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }
  }

  /** Do testów: liczy zawalenie od razu do końca (bez czekania na klatki) */
  async settleNow(pile: THREE.Group, w: number, h: number, height: number, ground?: Ground): Promise<void> {
    await load();
    this.start(pile, w, h, height, ground);
    for (let k = 0; k < MAX_TIME * 60 && this.falls.length; k++) this.step(STEP);
  }
}

/** Jedna wspólna fizyka gruzu dla całej sceny (gruz po rozbiórce i ruiny); krok liczy RubbleLayer co klatkę */
export const rubbleFalls = new RubbleFalls();

/** Z jakiej wysokości spada gruz budynku o działce w × h (większy budynek — wyżej) */
export const fallHeight = (w: number, h: number): number => Math.min(1.5, 0.55 + 0.22 * Math.max(w, h));

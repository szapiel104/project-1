/**
 * Chorążowie: w każdym oddziale (żołnierze z jednego rozkazu, co najmniej trzech) jeden niesie na plecach proporzec
 * w barwach pana z jego herbem. Drzewce z Blendera (tools/models/standard.py), płachta z banners.ts (łopocze w shaderze).
 * Tylko wygląd — symulacja nic o chorążych nie wie; dzięki temu oddział łatwo znaleźć na mapie i widać, czyj jest.
 */
import * as THREE from 'three';
import { bannerGeometry, bannerMaterial } from './banners';
import { toolMaterials } from './gear';
import { model } from './modelstore';
import { boxUv, modelGeo } from './peasants';

type Part = Parameters<typeof modelGeo>[0] & { mat: string };
type StandardModel = { flag: [number, number, number]; parts: Part[] };

/** Ilu najwyżej chorążych naraz (wszyscy gracze razem) */
const MAX = 96;
/** Od ilu żołnierzy w rozkazie oddział dostaje chorążego */
export const STANDARD_MIN = 3;

export class Standards {
  private poles: THREE.InstancedMesh[] = [];
  private cloths = new Map<number, THREE.InstancedMesh>();
  private counts = new Map<number, number>();
  private n = 0;
  private flag = new THREE.Matrix4();
  private m = new THREE.Matrix4();

  constructor(private scene: THREE.Scene) {
    // model wczytany dopiero tutaj (nie przy imporcie), żeby standardBearers dało się testować bez modeli
    const STANDARD = model('standard') as StandardModel;
    const [wood, iron, leather] = toolMaterials();
    const mats: Record<string, [THREE.Material, number]> = { wood: [wood!, 7], iron: [iron!, 9], leather: [leather!, 6] };
    for (const p of STANDARD.parts) {
      const [mat, sc] = mats[p.mat] ?? mats.wood!;
      const mesh = new THREE.InstancedMesh(boxUv(modelGeo(p), sc), mat, MAX);
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
      mesh.name = 'chorążowie: drzewca';
      scene.add(mesh);
      this.poles.push(mesh);
    }
    // płachta: lewy brzeg przy drzewcu, idzie do tyłu postaci (+x płachty → -z postaci)
    const [fx, fy, fz] = STANDARD.flag;
    this.flag.makeRotationY(Math.PI / 2).setPosition(fx, fy, fz);
  }

  /** Płachta w barwie `team` z herbem `crest` dla gracza `owner` (jedna siatka instancji na gracza) */
  private cloth(owner: number, team: number, crest: number): THREE.InstancedMesh {
    let c = this.cloths.get(owner);
    if (!c) {
      c = new THREE.InstancedMesh(bannerGeometry(), bannerMaterial(team, crest), MAX);
      c.count = 0; c.frustumCulled = false; c.castShadow = true;
      c.name = 'chorążowie: proporce';
      this.scene.add(c);
      this.cloths.set(owner, c);
    }
    return c;
  }

  /** Początek klatki */
  begin(): void { this.n = 0; this.counts.clear(); }

  /** Chorąży o macierzy postaci `body` (stopy, obrót i skala postaci) */
  add(body: THREE.Matrix4, owner: number, team: number, crest: number): void {
    if (this.n >= MAX) return;
    for (const p of this.poles) p.setMatrixAt(this.n, body);
    this.n++;
    const c = this.cloth(owner, team, crest);
    const k = this.counts.get(owner) ?? 0;
    c.setMatrixAt(k, this.m.multiplyMatrices(body, this.flag));
    this.counts.set(owner, k + 1);
  }

  /** Koniec klatki: liczby instancji i odświeżenie macierzy */
  finish(): void {
    for (const p of this.poles) { p.count = this.n; p.visible = this.n > 0; p.instanceMatrix.needsUpdate = true; }
    for (const [owner, c] of this.cloths) {
      const k = this.counts.get(owner) ?? 0;
      c.count = k; c.visible = k > 0; c.instanceMatrix.needsUpdate = true;
    }
  }
}

/**
 * Kto niesie proporzec: w każdym rozkazie (Soldier.grp) z co najmniej STANDARD_MIN żołnierzami — piechur wręcz
 * o najniższym numerze (gdy w oddziale są sami łucznicy, to łucznik). Strażnicy, tarany i zbóje nie mają chorążych.
 */
export function standardBearers(soldiers: readonly { id: number; owner: number; grp?: number; kind: number }[], isRanged: (kind: number) => boolean, skip: (kind: number) => boolean): Set<number> {
  const best = new Map<string, { id: number; melee: boolean; n: number }>();
  for (const s of soldiers) {
    if (!s.grp || skip(s.kind)) continue;
    const key = s.owner + ':' + s.grp, melee = !isRanged(s.kind);
    const b = best.get(key);
    if (!b) { best.set(key, { id: s.id, melee, n: 1 }); continue; }
    b.n++;
    if ((melee && !b.melee) || (melee === b.melee && s.id < b.id)) { b.id = s.id; b.melee = melee; }
  }
  const out = new Set<number>();
  for (const b of best.values()) if (b.n >= STANDARD_MIN) out.add(b.id);
  return out;
}

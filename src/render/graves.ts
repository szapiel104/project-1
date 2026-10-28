/**
 * Leśne groby (0.58.3): kopczyk ziemi z krzyżem z kijów tam, gdzie chłopi bez cmentarza zakopali zmarłego
 * (symulacja: sim/systems/graves.ts). Model z Blendera: tools/models/grave.py → models/grave.json.
 * Wszystkie groby rysujemy instancjami (po jednej siatce na materiał). Każdy leży trochę inaczej obrócony;
 * pod koniec życia (ostatnie 15%) kopczyk osiada w ziemię, a krzyż z nim, aż grób zniknie.
 */
import * as THREE from 'three';
import { RULES } from '../data/rules';
import type { GameState } from '../sim/state';
import { cat } from './cat';
import { boxUv } from './family';
import { model } from './modelstore';
import { modelGeo, type ModelMesh } from './peasants';
import type { TerrainView } from './terrain';
import { normal, pattern } from './textures';

const GRAVE = model('grave') as Record<string, ModelMesh[]>;
const MAX = 256;

let mats: Record<string, [THREE.Material, number]> | null = null;
/** Ziemia i kora ze zdjęciowymi teksturami, łyko gładkie; liczba = skala tekstury */
function graveMaterials(): Record<string, [THREE.Material, number]> {
  if (mats) return mats;
  const soil = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: pattern('soil'), normalMap: normal('soil') });
  const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: pattern('bark'), normalMap: normal('bark') });
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  return (mats = { soil: [soil, 3], bark: [bark, 14], plain: [plain, 1] });
}

/** Grób jako zwykła grupa siatek (podgląd modeli) */
export function graveModel(): THREE.Group {
  const g = new THREE.Group(), M = graveMaterials();
  for (const part of GRAVE.grave ?? []) {
    const [mat, scale] = M[part.mat] ?? M.plain!;
    g.add(new THREE.Mesh(boxUv(modelGeo(part), scale), mat));
  }
  return g;
}

const hash = (t: number): number => { let h = (t * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); return (h ^ (h >>> 12)) >>> 0; };

export class GraveLayer {
  private meshes: THREE.InstancedMesh[] = [];
  private o = new THREE.Object3D();
  private key = '';

  constructor(scene: THREE.Scene) {
    const M = graveMaterials();
    for (const part of GRAVE.grave ?? []) {
      const [mat, scale] = M[part.mat] ?? M.plain!;
      const m = new THREE.InstancedMesh(boxUv(modelGeo(part), scale), mat, MAX);
      m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      scene.add(cat(m, 'groby w lesie'));
      this.meshes.push(m);
    }
  }

  clear(): void { for (const m of this.meshes) m.count = 0; this.key = ''; }

  sync(g: GameState, view: TerrainView): void {
    const list = g.graves ?? [];
    const life = RULES.graveDays * RULES.dayTicks;
    // ustawienia liczymy na nowo tylko przy zmianie listy albo co ok. 2 s (osiadanie pod koniec życia)
    const key = `${list.length}:${list.length ? list[list.length - 1]!.t : 0}:${(g.tick / 40) | 0}`;
    if (key === this.key) return;
    this.key = key;
    const { width, height } = g.map;
    let n = 0;
    for (const gr of list) {
      if (n >= MAX) break;
      const x = gr.t % width, y = (gr.t - x) / width, h = hash(gr.t);
      const fx = x + 0.5 + ((h & 255) / 255 - 0.5) * 0.2, fy = y + 0.5 + (((h >> 8) & 255) / 255 - 0.5) * 0.2;
      const age = (g.tick - gr.at) / life;
      const sink = age > 0.85 ? Math.min(1, (age - 0.85) / 0.15) : 0;
      this.o.position.set(fx - width / 2, view.heightAt(fx, fy) - sink * 0.07, fy - height / 2);
      this.o.rotation.set(0, ((h >> 16) & 1023) / 1023 * Math.PI * 2, 0);
      this.o.scale.set(1, 1 - sink * 0.6, 1);
      this.o.updateMatrix();
      for (const m of this.meshes) m.setMatrixAt(n, this.o.matrix);
      n++;
    }
    for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
  }
}

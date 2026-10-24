/**
 * Wrota bram w murach (wyniesione z scene.ts, 24.10.2026): płynnie się otwierają i zamykają,
 * skrzypią przy ruchu i łomoczą przy domknięciu.
 */
import type * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import type { GameState } from '../sim/state';

/** Dźwięk w świecie (jak sfxAt w GameRenderer): rodzaj, położenie, klucz, najczęściej co ile sekund, głośność */
export type SfxAt = (kind: 'creak' | 'plank', x: number, z: number, key: string, every: number, gain: number) => void;

export class GateMotion {
  private angle = new Map<number, number>();
  private shut = new Map<number, boolean>();
  constructor(private sfx: SfxAt) {}

  /** Wrota bramy płynnie się otwierają i zamykają; skrzypienie przy ruchu, łomot przy domknięciu */
  sync(g: GameState, meshes: Map<number, THREE.Object3D>, dt: number, calm: boolean): void {
    for (const b of g.buildings) {
      if (!BUILDINGS[b.type]!.gate) continue;
      const mesh = meshes.get(b.id);
      if (!mesh) continue;
      const shut = !!b.shut;
      const was = this.shut.get(b.id);
      const want = shut ? 0 : 1.3;
      let a = this.angle.get(b.id) ?? want;
      if (was !== undefined && was !== shut) this.sfx('creak', mesh.position.x, mesh.position.z, `g${b.id}`, 0.1, 1.6);
      this.shut.set(b.id, shut);
      const before = a;
      a += Math.max(-dt * 1.1, Math.min(dt * 1.1, want - a)); // ok. 1,2 s na pełny ruch
      if (calm) a = want;
      if (before > 0.02 && a <= 0.02 && shut) this.sfx('plank', mesh.position.x, mesh.position.z, `gt${b.id}`, 0.1, 1.8);
      this.angle.set(b.id, a);
      const l = mesh.getObjectByName('leafL'), r = mesh.getObjectByName('leafR');
      if (l) l.rotation.y = -a;
      if (r) r.rotation.y = a;
      mesh.traverse((o) => { if (o.name === 'torchFlame') o.visible = false; }); // stożek to tylko znacznik: płomień rysuje system ognia (syncFlames)
    }
  }
}

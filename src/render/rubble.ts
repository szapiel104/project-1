/**
 * Gruz (wyniesione z scene.ts, 24.10.2026): rozebrany budynek zapada się i przechyla, a na jego miejscu zostaje
 * stos gruzu, który maleje z każdym wyniesionym ładunkiem.
 */
import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { rubbleModel, setRubble } from './buildings';
import type { TerrainView } from './terrain';

export class RubbleLayer {
  private piles = new Map<number, THREE.Group>();
  private dying: { mesh: THREE.Group; t: number }[] = [];
  constructor(private scene: THREE.Scene, private buildings: THREE.Group) {}

  /** Rozebrany budynek: zapada się w ciągu ok. 1 s i znika z warstwy budynków */
  collapse(mesh: THREE.Group): void { this.dying.push({ mesh, t: 0 }); }

  /** Nowa mapa: bez gruzu i zapadających się budynków */
  clear(): void {
    for (const pile of this.piles.values()) this.scene.remove(pile);
    this.piles.clear();
    for (const d of this.dying) this.buildings.remove(d.mesh);
    this.dying = [];
  }

  /** Zawalanie się rozebranych budynków i stosy gruzu, które maleją z każdym wyniesionym ładunkiem. */
  sync(g: GameState, view: TerrainView, dt: number): void {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]!;
      d.t += Math.max(dt, 0.016);
      const k = Math.min(1, d.t / 1.1);
      d.mesh.scale.y = Math.max(0.04, 1 - k * k);
      d.mesh.rotation.z = k * 0.18;
      d.mesh.rotation.x = k * -0.1;
      if (k >= 1) { this.buildings.remove(d.mesh); d.mesh.traverse((o) => { if (o.userData.merged && !o.userData.shared) (o as THREE.Mesh).geometry.dispose(); }); this.dying.splice(i, 1); }
    }
    const { width, height } = g.map;
    const alive = new Set<number>();
    for (const r of g.rubble) {
      alive.add(r.id);
      let pile = this.piles.get(r.id);
      if (!pile) {
        pile = rubbleModel(r.w, r.h, r.id);
        pile.position.set(r.x + r.w / 2 - width / 2, view.heightAt(r.x + r.w / 2, r.y + r.h / 2), r.y + r.h / 2 - height / 2);
        this.scene.add(pile);
        this.piles.set(r.id, pile);
      }
      setRubble(pile, r.loads.length / r.total);
    }
    for (const [id, pile] of this.piles) if (!alive.has(id)) { this.scene.remove(pile); this.piles.delete(id); }
  }
}

/**
 * Gruz (wyniesione z scene.ts, 24.10.2026): rozebrany budynek zapada się i przechyla, a na jego miejscu zostaje
 * stos gruzu, który maleje z każdym wyniesionym ładunkiem.
 */
import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { bakeRubble, rubbleModel, setRubble } from './buildings';
import type { TerrainView } from './terrain';
import { fallHeight, rubbleFalls } from './rubblefall';

export class RubbleLayer {
  private piles = new Map<number, THREE.Group>();
  private dying: { mesh: THREE.Group; t: number }[] = [];
  /** Pierwsza klatka po wczytaniu mapy: gruz z zapisu leży od razu, bez spadania */
  private fresh = true;
  constructor(private scene: THREE.Scene, private buildings: THREE.Group) {}

  /** Rozebrany budynek: zapada się w ciągu ok. 1 s i znika z warstwy budynków */
  collapse(mesh: THREE.Group): void { this.dying.push({ mesh, t: 0 }); }

  /** Nowa mapa: bez gruzu i zapadających się budynków */
  clear(): void {
    this.fresh = true;
    rubbleFalls.clear();
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
        const cx = r.x + r.w / 2, cz = r.y + r.h / 2, y0 = view.heightAt(cx, cz);
        const ground = (x: number, z: number): number => view.heightAt(cx + x, cz + z) - y0;
        pile = rubbleModel(r.w, r.h, r.id, ground);
        pile.position.set(cx - width / 2, y0, cz - height / 2);
        this.scene.add(pile);
        this.piles.set(r.id, pile);
        // świeżo rozebrany budynek: gruz spada z jego wysokości (fizyka), z zapisu leży od razu
        if (!this.fresh) rubbleFalls.drop(pile, r.w, r.h, fallHeight(r.w, r.h), ground);
      }
      setRubble(pile, r.loads.length / r.total);
      bakeRubble(pile, rubbleFalls.falling(pile));
    }
    for (const [id, pile] of this.piles) if (!alive.has(id)) { this.scene.remove(pile); this.piles.delete(id); }
    rubbleFalls.step(Math.min(dt, 0.1));
    this.fresh = false;
  }
}

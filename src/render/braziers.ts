/**
 * Koksowniki na wieżach i murach (wyniesione z scene.ts, 24.10.2026). Ogień w nich rysuje system ognia (syncFlames).
 */
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import type { GameState } from '../sim/state';
import { brazierModel, STONE_WALL_TOP, towerBrazierAt } from './buildings';
import { cat } from './cat';
import type { TerrainView } from './terrain';

export class Braziers {
  private layer = new THREE.Group();
  /** Budynek → jego koksownik */
  readonly meshes = new Map<number, THREE.Group>();
  private key = '';
  constructor(scene: THREE.Scene) { scene.add(cat(this.layer, 'koksowniki')); }

  /**
   * Koksowniki (Building.brazier): na kamiennej wieży stoją w rogu pomostu (miejsce z modelu wieży, obrócone razem
   * z nią), na murze kamiennym — na chodniku, przesunięte ku twierdzy, żeby łucznicy mieli miejsce przy blankach.
   */
  sync(g: GameState, view: TerrainView, buildingMeshes: Map<number, THREE.Group>): void {
    const list = g.buildings.filter((b) => b.brazier && !b.ruined);
    const key = list.map((b) => `${b.id}:${buildingMeshes.has(b.id) ? 1 : 0}:${g.occupancy[b.y * g.map.width + b.x - 1] ? 1 : 0}${g.occupancy[(b.y - 1) * g.map.width + b.x] ? 1 : 0}`).join(',');
    if (key === this.key) return;
    this.key = key;
    const { width, height } = g.map;
    const keep = new Set(list.map((b) => b.id));
    for (const [id, m] of this.meshes) if (!keep.has(id)) { this.layer.remove(m); this.meshes.delete(id); }
    for (const b of list) {
      let m = this.meshes.get(b.id);
      if (!m) { m = brazierModel(); this.meshes.set(b.id, m); this.layer.add(m); }
      const def = BUILDINGS[b.type]!;
      const host = buildingMeshes.get(b.id);
      if (def.id !== 'stoneWall' && host) {
        const [ax, ay, az] = towerBrazierAt(def.id);
        const p = new THREE.Vector3(ax, ay, az).applyAxisAngle(new THREE.Vector3(0, 1, 0), host.rotation.y);
        m.position.set(host.position.x + p.x, host.position.y + p.y + 0.02, host.position.z + p.z);
        m.rotation.y = host.rotation.y;
        // mniejszy kosz (Michał 25.10: na wieży wyglądał jak beczka): płomień maleje razem z nim
        m.scale.setScalar(0.6);
      } else {
        // mur biegnie wzdłuż x, gdy ma sąsiada z lewej albo prawej; koksownik odsunięty od blank w stronę twierdzy
        const W = width;
        const along = !!(g.occupancy[b.y * W + b.x - 1] || g.occupancy[b.y * W + b.x + 1]);
        const kp = g.buildings.find((o) => o.type === 0 && o.owner === b.owner);
        const kx = kp ? kp.x + 5.5 : b.x, ky = kp ? kp.y + 5.5 : b.y;
        const off = 0.27;
        const cx = b.x + 0.5 + (along ? 0 : (kx > b.x + 0.5 ? off : -off));
        const cy = b.y + 0.5 + (along ? (ky > b.y + 0.5 ? off : -off) : 0);
        m.position.set(cx - width / 2, view.heightAt(b.x + 0.5, b.y + 0.5) + STONE_WALL_TOP + 0.005, cy - height / 2);
        m.rotation.y = along ? 0 : Math.PI / 2;
        m.scale.setScalar(0.5);
      }
    }
  }
}

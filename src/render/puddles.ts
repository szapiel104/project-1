/**
 * Kałuże na drogach gruntowych (co któreś pole), widoczne tylko gdy mokro (wyniesione z scene.ts, 23.10.2026).
 * Układ liczony od nowa tylko po zmianie dróg.
 */
import * as THREE from 'three';
import type { GameState } from '../sim/state';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class PuddleLayer {
  private wet = 0;
  private roadSum = -1;
  constructor(private scene: THREE.Scene) {}

  private puddles: THREE.InstancedMesh | null = null;
  private puddleKey = '';
  /** Kałuże na ścieżkach gruntowych (co któreś pole), widoczne tylko gdy mokro */
  sync(g: GameState, view: TerrainView, wet: number, roadSum: number): void {
    this.wet = wet; this.roadSum = roadSum;
    if (!this.puddles) {
      this.puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 18).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x3a3c38, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 1024);
      this.puddles.frustumCulled = false; this.puddles.renderOrder = 1;
      this.scene.add(this.puddles);
    }
    (this.puddles.material as THREE.MeshStandardMaterial).opacity = Math.min(0.85, this.wet * 1.6);
    this.puddles.visible = this.wet > 0.03;
    if (!this.puddles.visible) return;
    const key = `${this.roadSum}`;
    if (key === this.puddleKey) return;
    this.puddleKey = key;
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    for (let t = 0; t < g.roads.length && n < 1024; t++) {
      if (g.roads[t] !== 1) continue;
      const hsh = (t * 2654435761) >>> 0;
      if (hsh % 3 !== 0) continue;
      const x = (t % width) + 0.3 + ((hsh >>> 8) & 255) / 640, y = Math.floor(t / width) + 0.3 + ((hsh >>> 16) & 255) / 640;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hsh & 63) / 10);
      m.compose(p.set(x - width / 2, view.heightAt(x, y) + 0.05, y - height / 2), q, sc.set(0.5 + ((hsh >>> 4) & 15) / 30, 1, 0.3 + ((hsh >>> 12) & 15) / 40));
      this.puddles.setMatrixAt(n++, m);
    }
    this.puddles.count = n;
    touch(this.puddles);
  }
}

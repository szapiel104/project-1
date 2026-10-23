/**
 * Nocą w lesie za mapą świecą czerwone oczy (wyniesione z scene.ts, 23.10.2026): pary krążą wolno, mrugają,
 * czasem znikają między drzewami; więcej, gdy na mapie jest wataha.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameState } from '../sim/state';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class ForestEyes {
  private time = 0;
  private calm = false;
  private night = 0;
  private tmp = new THREE.Object3D();
  constructor(private scene: THREE.Scene) {}

  private eyes: THREE.InstancedMesh | null = null;
  private eyeSpots: { a: number; d: number; speed: number; blink: number }[] = [];
  /** Nocą w lesie za mapą świecą czerwone oczy: pary krążą wolno, mrugają, czasem znikają między drzewami */
  sync(g: GameState, view: TerrainView, ctx: { time: number; calm: boolean; night: number }): void {
    this.time = ctx.time; this.calm = ctx.calm; this.night = ctx.night;
    const on = this.night > 0.35;
    if (!this.eyes) {
      const pair = mergeGeometries([new THREE.SphereGeometry(0.035, 6, 4).translate(-0.06, 0, 0), new THREE.SphereGeometry(0.035, 6, 4).translate(0.06, 0, 0)])!;
      this.eyes = new THREE.InstancedMesh(pair, new THREE.MeshBasicMaterial({ color: 0xff3322, fog: false }), 48);
      this.eyes.frustumCulled = false;
      this.scene.add(this.eyes);
      for (let i = 0; i < 48; i++) this.eyeSpots.push({ a: (i / 48) * Math.PI * 2 + Math.random() * 0.1, d: 1.5 + Math.random() * 6, speed: (Math.random() - 0.5) * 0.02, blink: Math.random() * 10 });
    }
    this.eyes.visible = on;
    if (!on) return;
    const { width, height } = g.map;
    const t = this.tmp;
    // więcej oczu, gdy wataha jest na mapie
    const shown = g.wolves.length ? 48 : 30;
    for (let i = 0; i < 48; i++) {
      const e = this.eyeSpots[i]!;
      if (!this.calm) e.a += e.speed * 0.016;
      // punkt na brzegu mapy (prostokąt), odsunięty w las
      const per = (((e.a / (Math.PI * 2)) % 1) + 1) % 1, L = 2 * (width + height);
      let p = per * L, x = 0, y = 0, nx = 0, ny = 0;
      if (p < width) { x = p; y = 0; ny = -1; } else if ((p -= width) < height) { x = width; y = p; nx = 1; } else if ((p -= height) < width) { x = width - p; y = height; ny = 1; } else { p -= width; x = 0; y = height - p; nx = -1; }
      x += nx * e.d + Math.sin(this.time * 0.3 + i) * 0.4; y += ny * e.d + Math.cos(this.time * 0.25 + i) * 0.4;
      // mrugnięcie i chowanie się za drzewami
      const k = (this.time + e.blink) % 9;
      const open = i < shown && !(k > 8.7 || (k > 4 && k < 4.6 && i % 3 === 0));
      t.position.set(x - width / 2, view.heightAt(Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y))) + 0.35 + (i % 4) * 0.05, y - height / 2);
      t.rotation.set(0, Math.atan2(-nx, -ny), 0);
      t.scale.set(1, open ? 1 : 0.05, 1);
      t.updateMatrix();
      this.eyes.setMatrixAt(i, t.matrix);
    }
    touch(this.eyes);
  }
}

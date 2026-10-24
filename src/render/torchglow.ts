/**
 * Poświata pochodni na ziemi (wyniesione z scene.ts, 24.10.2026): nocą miękka, ciepła plama pod zapalonymi
 * pochodniami na słupach i pod idącymi z pochodnią w ręce.
 */
import * as THREE from 'three';
import { FP, type GameState } from '../sim/state';
import { cat } from './cat';
import { named } from './named';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class TorchGlow {
  private glow: THREE.InstancedMesh | null = null;
  constructor(private scene: THREE.Scene) {}

  sync(g: GameState, view: TerrainView | null, buildingMeshes: Map<number, THREE.Group>, lit: Set<number>, night: number): void {
    if (!view) return;
    if (!this.glow) {
      // miękka, ciepła plama: jasny środek, długie wygaszanie ku brzegom (bez ostrej krawędzi)
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,190,120,1)');
      gr.addColorStop(0.25, 'rgba(255,160,90,0.55)');
      gr.addColorStop(0.6, 'rgba(255,130,60,0.15)');
      gr.addColorStop(1, 'rgba(255,120,50,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, 1024);
      this.glow.count = 0;
      this.glow.frustumCulled = false;
      this.glow.renderOrder = 2;
      this.scene.add(cat(this.glow, 'poświata pochodni'));
    }
    const glow = this.glow;
    const mat = glow.material as THREE.MeshBasicMaterial;
    const k = Math.max(0, Math.min(1, (night - 0.1) / 0.4));
    mat.opacity = k * 0.1;   // delikatna plama (0,45 przepalała ziemię na biało-żółto)
    glow.visible = k > 0.01;
    if (!glow.visible) return;
    const { width, height } = g.map;
    const m = new THREE.Matrix4(), v = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    let n = 0;
    const put = (wx: number, wz: number, r: number): void => {
      if (n >= 1024) return;
      const y = Math.max(view.heightAt(wx + width / 2, wz + height / 2), 0) + 0.04;
      m.compose(v.set(wx, y, wz), q, sc.set(r * 2, 1, r * 2));
      glow.setMatrixAt(n++, m);
    };
    for (const [id, mesh] of buildingMeshes) {
      if (!lit.has(id)) continue;
      const torch = named(mesh, 'torch');
      if (!torch) continue;
      torch.getWorldPosition(v);
      put(v.x, v.z, 1.8);   // mała plama pod pochodnią (4 pola zlewały się w jedną pomarańczową łunę nad osadą)
    }
    for (const u of g.units) if (u.path.length > 0 && !u.bucket && u.carryRes < 0) put(u.px / FP - width / 2, u.py / FP - height / 2, 0.8);
    glow.count = n;
    touch(glow);
  }
}

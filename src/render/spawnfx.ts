/**
 * Nowy żołnierz wychodzi z koszar (wyniesione z scene.ts, 23.10.2026): złote iskry przy drzwiach i „+1”,
 * które unosi się i gaśnie.
 */
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { FP, type GameState } from '../sim/state';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class SpawnFx {
  private knownSoldiers: Set<number> | null = null;
  private sparks: { p: THREE.Vector3; v: THREE.Vector3; t: number; life: number }[] = [];
  private sparkMesh: THREE.InstancedMesh | null = null;
  private plusIcons: { s: THREE.Sprite; t: number }[] = [];
  private calm = false;
  constructor(private scene: THREE.Scene) {}
  /** Nowa gra albo wczytany zapis: znani żołnierze liczą się od nowa (bez iskier dla już stojących) */
  reset(): void { this.knownSoldiers = null; }

  sync(g: GameState, view: TerrainView, camera: THREE.Camera, calm: boolean): void {
    this.calm = calm;
    const W = g.map.width, H = g.map.height;
    if (!this.knownSoldiers) { this.knownSoldiers = new Set(g.soldiers.map((s) => s.id)); return; }
    const doors = new Set(g.buildings.filter((b) => BUILDINGS[b.type]!.id === 'barracks').map((b) => b.door));
    for (const s of g.soldiers) {
      if (this.knownSoldiers.has(s.id)) continue;
      this.knownSoldiers.add(s.id);
      const tile = (s.py >> 8) * W + (s.px >> 8);
      if (!doors.has(tile) || this.calm) continue;
      const x = s.px / FP - W / 2, z = s.py / FP - H / 2, y = view.heightAt(s.px / FP, s.py / FP);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9;
        this.sparks.push({ p: new THREE.Vector3(x, y + 0.15 + Math.random() * 0.3, z), v: new THREE.Vector3(Math.cos(a) * r * 0.6, 1.1 + Math.random() * 1.3, Math.sin(a) * r * 0.6), t: 0, life: 0.7 + Math.random() * 0.6 });
      }
      // „+1” nad drzwiami, unosi się i gaśnie
      const c = document.createElement('canvas'); c.width = 96; c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.font = 'bold 44px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#2a1406'; ctx.strokeText('+1', 48, 34);
      ctx.fillStyle = '#ffe08a'; ctx.fillText('+1', 48, 34);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
      sp.renderOrder = 12; sp.scale.set(0.6, 0.4, 1); sp.position.set(x, y + 1.0, z);
      this.scene.add(sp); this.plusIcons.push({ s: sp, t: 0 });
    }
    for (const id of this.knownSoldiers) if (!g.soldiers.some((s) => s.id === id)) this.knownSoldiers.delete(id);
    // ruch iskier: lecą w górę, zwalniają, opadają i gasną
    const dt = 1 / 60;
    if (!this.sparkMesh) {
      // okrągła, miękka iskra (jasny środek, złota poświata), nie kwadracik
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d')!, gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
      const sparkTex = new THREE.CanvasTexture(c);
      this.sparkMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshBasicMaterial({ map: sparkTex, color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 512);
      this.sparkMesh.frustumCulled = false; this.sparkMesh.renderOrder = 11; this.scene.add(this.sparkMesh);
    }
    this.sparks = this.sparks.filter((k) => (k.t += dt) < k.life);
    const m = new THREE.Matrix4(), q = camera.quaternion, sc = new THREE.Vector3();
    let n = 0;
    for (const k of this.sparks) {
      k.v.y -= 1.6 * dt; k.v.multiplyScalar(0.985); k.p.addScaledVector(k.v, dt);
      const f = 1 - k.t / k.life;
      sc.setScalar(0.5 + f);
      if (n < 512) this.sparkMesh.setMatrixAt(n++, m.compose(k.p, q, sc));
    }
    this.sparkMesh.count = n; touch(this.sparkMesh);
    this.plusIcons = this.plusIcons.filter((p) => {
      p.t += dt;
      p.s.position.y += dt * 0.5;
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - Math.max(0, p.t - 0.6) / 0.8);
      if (p.t > 1.4) { this.scene.remove(p.s); (p.s.material as THREE.SpriteMaterial).map?.dispose(); p.s.material.dispose(); return false; }
      return true;
    });
  }
}

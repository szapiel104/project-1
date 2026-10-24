/**
 * Kurz i odpryski (wyniesione z scene.ts, 24.10.2026): kłąb kurzu z grudkami przy rozbitej drodze i placu budowy,
 * mały obłoczek i okruchy pod murem trafionego budynku. Tylko wygląd, bez wpływu na symulację.
 */
import * as THREE from 'three';
import { BUILDINGS, footprint } from '../data/buildings';
import type { GameState } from '../sim/state';
import type { TerrainView } from './terrain';

const PUFF_GEO = new THREE.IcosahedronGeometry(0.16, 1);
const CHIP_GEO = new THREE.DodecahedronGeometry(0.05, 0);

export class DustFx {
  private puffs: { group: THREE.Group; age: number; soft?: boolean; bits: { m: THREE.Mesh; v: THREE.Vector3 }[] }[] = [];
  constructor(private scene: THREE.Scene) {}

  /** Rozbita droga: kłąb kurzu i odpryski kamieni lub grudki ziemi rozlatują się i opadają */
  roadDust(g: GameState, view: TerrainView, x: number, y: number, stone: boolean, soft = false): void {
    const { width, height } = g.map;
    const group = new THREE.Group();
    group.position.set(x + 0.5 - width / 2, Math.max(view.heightAt(x + 0.5, y + 0.5), 0) + 0.05, y + 0.5 - height / 2);
    const bits: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
    // kurz z placu budowy: kilka małych, przejrzystych kłębków (nie biała „dynia”)
    const puffMat = new THREE.MeshStandardMaterial({ color: stone ? 0xbdb3a0 : soft ? 0x9c8a6c : 0xa08660, transparent: true, opacity: soft ? 0.22 : 0.7, depthWrite: false, roughness: 1 });
    const nPuff = soft ? 4 : 7;
    for (let i = 0; i < nPuff; i++) {
      const m = new THREE.Mesh(PUFF_GEO, puffMat);
      if (soft) m.scale.setScalar(0.45);
      const a = (i / nPuff) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
      bits.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.5, 0.5 + (i % 3) * 0.15, Math.sin(a) * 0.5) });
      group.add(m);
    }
    const chipMat = new THREE.MeshStandardMaterial({ color: stone ? 0x9a9182 : 0x6b5236, roughness: 0.9 });
    for (let i = 0; i < (soft ? 3 : 8); i++) {
      const m = new THREE.Mesh(CHIP_GEO, chipMat);
      const a = i * 2.4;
      bits.push({ m, v: new THREE.Vector3(Math.cos(a) * (0.6 + (i % 3) * 0.3), 1.6 + (i % 4) * 0.35, Math.sin(a) * (0.6 + (i % 3) * 0.3)) });
      group.add(m);
    }
    this.scene.add(group);
    this.puffs.push({ group, age: 0, bits, soft });
  }

  /** Trafiony budynek: w losowym miejscu przy ścianie, na wysokości uderzenia, wysypuje się mały, rzadki obłoczek
   *  kurzu (powoli rośnie i znika) i kilka okruchów spada pod mur. Tylko wygląd, bez wpływu na symulację. */
  hitDust(g: GameState, view: TerrainView, b: { type: number; x: number; y: number; rot: number }): void {
    const { width, height } = g.map;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    // punkt na obwodzie budynku (tuż przed ścianą)
    const per = 2 * (fp.w + fp.h);
    let t = Math.random() * per, px: number, py: number;
    if (t < fp.w) { px = b.x + t; py = b.y - 0.05; }
    else if ((t -= fp.w) < fp.h) { px = b.x + fp.w + 0.05; py = b.y + t; }
    else if ((t -= fp.h) < fp.w) { px = b.x + t; py = b.y + fp.h + 0.05; }
    else { px = b.x - 0.05; py = b.y + (t - fp.w); }
    const cx = b.x + fp.w / 2, cy = b.y + fp.h / 2;
    const ox = px - cx, oy = py - cy, ol = Math.hypot(ox, oy) || 1;
    const group = new THREE.Group();
    group.position.set(px - width / 2, Math.max(view.heightAt(px, py), 0), py - height / 2);
    const bits: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
    const hy = 0.15 + Math.random() * 0.35;
    const puffMat = new THREE.MeshStandardMaterial({ color: 0xb3a68e, transparent: true, opacity: 0.22, depthWrite: false, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(PUFF_GEO, puffMat);
      m.scale.setScalar(0.45);
      m.position.set((Math.random() - 0.5) * 0.2, hy + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.2);
      // od ściany na zewnątrz i lekko w górę, wolno
      bits.push({ m, v: new THREE.Vector3((ox / ol) * 0.25 + (Math.random() - 0.5) * 0.15, 0.12 + Math.random() * 0.12, (oy / ol) * 0.25 + (Math.random() - 0.5) * 0.15) });
      group.add(m);
    }
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x8e8473, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(CHIP_GEO, chipMat);
      m.scale.setScalar(0.45);
      m.position.set((Math.random() - 0.5) * 0.15, hy, (Math.random() - 0.5) * 0.15);
      bits.push({ m, v: new THREE.Vector3((ox / ol) * 0.35 + (Math.random() - 0.5) * 0.2, 0.3, (oy / ol) * 0.35 + (Math.random() - 0.5) * 0.2) });
      group.add(m);
    }
    this.scene.add(group);
    this.puffs.push({ group, age: 0, bits, soft: true });
  }

  update(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!;
      p.age += dt;
      for (const b of p.bits) {
        const chip = b.m.geometry === CHIP_GEO;
        if (chip) { b.v.y -= 6 * dt; b.m.position.addScaledVector(b.v, dt); if (b.m.position.y < 0) { b.m.position.y = 0; b.v.set(0, 0, 0); } b.m.rotation.x += dt * 8; }
        else {
          b.m.position.addScaledVector(b.v, dt); b.v.multiplyScalar(1 - dt * 2.5);
          b.m.scale.setScalar(p.soft ? 0.45 + p.age * 1.1 : 1 + p.age * 3);
          (b.m.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (p.soft ? 0.22 : 0.7) * (1 - p.age / 1.2));
        }
      }
      if (p.age > 1.4) {
        this.scene.remove(p.group);
        for (const b of p.bits) if (b.m.geometry !== CHIP_GEO || b === p.bits[p.bits.length - 1]) (b.m.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
      }
    }
  }
}

/**
 * Znaczniki wojska na mapie (wyniesione z scene.ts, 24.10.2026):
 * - flagi zbiórki nad polem, na które idą nowi żołnierze z koszar (tylko koszary gracza), z płachtą w jego herbie;
 * - znaczek nad wieżą, której łucznicy strzelają: czerwona tarcza ze skrzyżowanymi strzałami, pulsuje i gaśnie 3 s po ostatnim strzale.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, footprint } from '../data/buildings';
import { TEAM_COLORS } from '../data/teams';
import type { GameState } from '../sim/state';
import { bannerGeometry, bannerMaterial, flagTime } from './banners';
import { tint } from './loads';
import type { TerrainView } from './terrain';
import { touch } from './touch';

export class RallyFlags {
  private flags: THREE.InstancedMesh | null = null;
  private cloth: THREE.InstancedMesh | null = null;
  constructor(private scene: THREE.Scene) {}

  /** Nowa mapa albo inny gracz: flagi powstaną od nowa (barwa drużyny i herb) */
  reset(): void {
    if (this.cloth) { this.scene.remove(this.cloth); this.cloth = null; }
    if (this.flags) { this.scene.remove(this.flags); this.flags = null; }
  }

  /** Flagi zbiórki: nad polem, na które idą nowi żołnierze z koszar (tylko moje koszary) */
  sync(g: GameState, view: TerrainView, me: number, crest: number, time: number): void {
    if (!this.flags) {
      const team = TEAM_COLORS[g.players[me]?.team ?? 0] ?? 0xa32a22;
      const geo = mergeGeometries([
        tint(new THREE.CylinderGeometry(0.014, 0.02, 0.8, 7).translate(0, 0.4, 0), 0x5a3a20),
        tint(new THREE.SphereGeometry(0.024, 10, 8).translate(0, 0.81, 0), 0xe9c766),
        tint(new THREE.ConeGeometry(0.014, 0.07, 6).translate(0, 0.86, 0), 0x4a4038),
        tint(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 10).translate(0, 0.015, 0), 0x3b2a1a),
      ])!;
      // płachta z herbem gracza, falująca jak na budynkach
      this.cloth = new THREE.InstancedMesh(bannerGeometry().clone().translate(0.016, 0.66, 0), bannerMaterial(team, crest), 64);
      this.cloth.frustumCulled = false;
      this.cloth.castShadow = true;
      this.scene.add(this.cloth);
      this.flags = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 64);
      this.flags.frustumCulled = false;
      this.flags.castShadow = true;
      this.scene.add(this.flags);
    }
    const W = g.map.width, H = g.map.height, m = new THREE.Matrix4();
    let n = 0;
    const seen = new Set<number>();
    for (const b of g.buildings) {
      if (b.owner !== me || !b.rally) continue;
      for (const t of b.rally) {
        if (t < 0 || seen.has(t) || n >= 64) continue;
        seen.add(t);
        const x = (t % W) + 0.5, y = Math.floor(t / W) + 0.5;
        m.makeRotationY(Math.sin(time * 0.9 + t) * 0.15).setPosition(x - W / 2, view.heightAt(x, y), y - H / 2);
        this.cloth!.setMatrixAt(n, m);
        this.flags.setMatrixAt(n++, m);
      }
    }
    this.flags.count = n;
    touch(this.flags);
    this.cloth!.count = n;
    touch(this.cloth!);
    flagTime.value = time;
  }
}

export class TowerIcons {
  /** Wieża → czas sceny ostatniego strzału jej łuczników */
  private shots = new Map<number, number>();
  private icons: THREE.Sprite[] = [];
  constructor(private scene: THREE.Scene) {}

  /** Łucznik z wieży `tower` właśnie strzelił */
  shot(tower: number, time: number): void { this.shots.set(tower, time); }

  /** Znaczek nad wieżą, której łucznicy strzelają: czerwona tarcza ze skrzyżowanymi strzałami, pulsuje; gaśnie 3 s po ostatnim strzale */
  sync(g: GameState, view: TerrainView | null, time: number): void {
    let n = 0;
    if (view) for (const [id, at] of this.shots) {
      const age = time - at;
      const b = g.buildings.find((x) => x.id === id);
      if (!b || age > 3) { this.shots.delete(id); continue; }
      let icon = this.icons[n];
      if (!icon) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d')!;
        x.fillStyle = '#7a120c'; x.strokeStyle = '#e9c766'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(32, 4); x.lineTo(58, 12); x.lineTo(56, 34); x.quadraticCurveTo(52, 52, 32, 60); x.quadraticCurveTo(12, 52, 8, 34); x.lineTo(6, 12); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = '#fff1c8'; x.lineWidth = 3.5; x.lineCap = 'round';
        for (const [a, b2, c2, d] of [[18, 46, 46, 18], [46, 46, 18, 18]] as const) { x.beginPath(); x.moveTo(a, b2); x.lineTo(c2, d); x.stroke(); }
        x.fillStyle = '#fff1c8';
        for (const [px, py, dx, dy] of [[46, 18, 1, -1], [18, 18, -1, -1]] as const) { x.beginPath(); x.moveTo(px + dx * 5, py + dy * 5); x.lineTo(px - dx * 6, py + dy * 1); x.lineTo(px + dx * 1, py - dy * 6); x.closePath(); x.fill(); }
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
        icon.renderOrder = 11; this.scene.add(icon); this.icons[n] = icon;
      }
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      const cx = b.x + fp.w / 2, cy = b.y + fp.h / 2;
      const pulse = 1 + Math.sin(time * 8) * 0.08;
      icon.position.set(cx - g.map.width / 2, view.heightAt(cx, cy) + 3.4 + Math.sin(time * 3) * 0.05, cy - g.map.height / 2);
      icon.scale.setScalar(0.62 * pulse);
      (icon.material as THREE.SpriteMaterial).opacity = Math.min(1, (3 - age) * 1.5);
      icon.visible = true;
      n++;
    }
    for (let i = n; i < this.icons.length; i++) this.icons[i]!.visible = false;
  }
}

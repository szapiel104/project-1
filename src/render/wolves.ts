/**
 * Wilki w obrazie gry (wyniesione z scene.ts, 23.10.2026): szare, przygarbione, w kłusie, nocą świecą im oczy;
 * zabite leżą na boku. Nad żywymi znaczki: łapa (poluje / odchodzi), linia do celu i kółko na ofierze.
 * Tylko wygląd — symulacja wilków jest w src/sim/systems/wolves.ts.
 */
import * as THREE from 'three';
import type { WorldSound } from '../audio/sfx';
import { FP, TICKS_PER_SECOND, type GameState } from '../sim/state';
import { cat } from './cat';
import { WOLF_HIPS, WOLF_TAIL, wolfParts } from './creatures';
import type { TerrainView } from './terrain';
import { touch } from './touch';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class WolfLayer {
  /** Położenia wilków w świecie z ostatniej klatki (paski zdrowia nad nimi) */
  readonly wolfPos = new Map<number, THREE.Vector3>();
  private time = 0;
  private calm = false;
  private night = 0;
  private prevPos = new Map<number, [number, number]>();
  private tmp = new THREE.Object3D();

  constructor(
    private scene: THREE.Scene,
    private sfxAt: (kind: WorldSound, x: number, z: number, key: string | number, every: number, gain?: number) => void,
  ) {}

  private wolfMesh: THREE.InstancedMesh | null = null;
  private wolfEyes: THREE.InstancedMesh | null = null;
  private wolfLegs!: THREE.InstancedMesh;
  private wolfHindLegs!: THREE.InstancedMesh;
  private wolfTails!: THREE.InstancedMesh;
  private wolfPart = new THREE.Matrix4();
  private wolfRot = new THREE.Matrix4();
  private wolfHeading = new Map<number, number>();
  /** Wilki: szare, przygarbione, w kłusie; nocą świecą im oczy */
  /** Znaczki nad wilkami: łapa nad łbem (czerwona, gdy poluje; szara, gdy odchodzi), cienka linia do celu i kółko na ofierze */
  private wolfIcons: THREE.Sprite[] = [];
  private wolfAims: THREE.Sprite[] = [];
  private wolfLines?: THREE.LineSegments;
  private wolfIconMat?: { hunt: THREE.SpriteMaterial; leave: THREE.SpriteMaterial; aim: THREE.SpriteMaterial };
  private wolfMarker(i: number, w: GameState['wolves'][number], g: GameState, x: number, y: number, z: number, view: TerrainView): void {
    if (!this.wolfIconMat) {
      const icon = (bg: string, fg: string): THREE.Texture => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const k = c.getContext('2d')!;
        k.fillStyle = bg; k.strokeStyle = 'rgba(20,10,5,.85)'; k.lineWidth = 4;
        k.beginPath(); k.arc(32, 32, 27, 0, Math.PI * 2); k.fill(); k.stroke();
        // łapa: duża poduszka i cztery palce
        k.fillStyle = fg;
        k.beginPath(); k.ellipse(32, 39, 10, 8.5, 0, 0, Math.PI * 2); k.fill();
        for (const [px, py, r] of [[19, 28, 4.6], [27, 21, 4.8], [37, 21, 4.8], [45, 28, 4.6]] as const) { k.beginPath(); k.ellipse(px, py, r * 0.85, r, 0, 0, Math.PI * 2); k.fill(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      };
      const ring = (): THREE.Texture => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const k = c.getContext('2d')!;
        k.strokeStyle = 'rgba(230,70,50,.95)'; k.lineWidth = 5;
        k.beginPath(); k.arc(32, 32, 24, 0, Math.PI * 2); k.stroke();
        for (let a = 0; a < 4; a++) { const r = (a * Math.PI) / 2; k.beginPath(); k.moveTo(32 + Math.cos(r) * 16, 32 + Math.sin(r) * 16); k.lineTo(32 + Math.cos(r) * 30, 32 + Math.sin(r) * 30); k.stroke(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      };
      const mk = (map: THREE.Texture, opacity: number): THREE.SpriteMaterial => new THREE.SpriteMaterial({ map, transparent: true, opacity, depthTest: false, depthWrite: false, fog: false });
      this.wolfIconMat = { hunt: mk(icon('#9b2418', '#f4e3c4'), 0.82), leave: mk(icon('#5c5650', '#d8d0c2'), 0.6), aim: mk(ring(), 0.85) };
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
      this.wolfLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe0503a, transparent: true, opacity: 0.4, depthTest: false, fog: false }));
      this.wolfLines.frustumCulled = false;
      this.wolfLines.renderOrder = 9;
      this.scene.add(this.wolfLines);
    }
    const mats = this.wolfIconMat;
    let icon = this.wolfIcons[i];
    if (!icon) { icon = new THREE.Sprite(mats.hunt); icon.renderOrder = 10; this.scene.add(icon); this.wolfIcons[i] = icon; }
    icon.material = w.leaving ? mats.leave : mats.hunt;
    icon.visible = true;
    icon.position.set(x, y + 0.72 + (this.calm ? 0 : Math.sin(this.time * 3 + w.id) * 0.03), z);
    icon.scale.setScalar(0.3);
    // cel: ofiara (człowiek, żołnierz) albo pole, do którego biegnie
    let tx: number | undefined, tz = 0;
    const { width, height } = g.map;
    if (w.target && !w.leaving) {
      const prey = g.units.find((u) => u.id === w.target) ?? g.soldiers.find((v) => v.id === w.target);
      if (prey) { tx = prey.px / FP - width / 2; tz = prey.py / FP - height / 2; }
    }
    if (tx === undefined && w.path.length && !w.leaving) { const e = w.path[w.path.length - 1]!; tx = (e % width) + 0.5 - width / 2; tz = Math.floor(e / width) + 0.5 - height / 2; }
    let aim = this.wolfAims[i];
    if (!aim) { aim = new THREE.Sprite(mats.aim); aim.renderOrder = 10; this.scene.add(aim); this.wolfAims[i] = aim; }
    const pos = this.wolfLines!.geometry.attributes.position as THREE.BufferAttribute;
    if (tx !== undefined) {
      const ty = view.heightAt(tx + width / 2, tz + height / 2);
      aim.visible = !!w.target; // kółko tylko na ofierze, sama trasa to linia
      aim.position.set(tx, ty + 0.35, tz);
      aim.scale.setScalar(0.34 + (this.calm ? 0 : Math.sin(this.time * 6 + w.id) * 0.04));
      pos.setXYZ(i * 2, x, y + 0.3, z);
      pos.setXYZ(i * 2 + 1, tx, ty + 0.3, tz);
    } else {
      aim.visible = false;
      pos.setXYZ(i * 2, 0, -100, 0); pos.setXYZ(i * 2 + 1, 0, -100, 0);
    }
  }
  private wolfMarkersFinish(n: number): void {
    for (let i = n; i < this.wolfIcons.length; i++) { this.wolfIcons[i]!.visible = false; const a = this.wolfAims[i]; if (a) a.visible = false; }
    if (this.wolfLines) {
      this.wolfLines.geometry.setDrawRange(0, n * 2);
      (this.wolfLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.wolfLines.visible = n > 0;
    }
  }

  sync(g: GameState, view: TerrainView, alpha: number, ctx: { time: number; calm: boolean; night: number; prevPos: Map<number, [number, number]> }): void {
    this.time = ctx.time; this.calm = ctx.calm; this.night = ctx.night; this.prevPos = ctx.prevPos;
    if (!this.wolfMesh) {
      const { body, leg, hindLeg, tail, eyes, mat } = wolfParts();
      this.wolfMesh = new THREE.InstancedMesh(body, mat, 64);
      this.wolfLegs = new THREE.InstancedMesh(leg, mat, 128);
      this.wolfHindLegs = new THREE.InstancedMesh(hindLeg, mat, 128);
      this.wolfTails = new THREE.InstancedMesh(tail, mat, 64);
      for (const m of [this.wolfMesh, this.wolfLegs, this.wolfHindLegs, this.wolfTails]) { m.castShadow = true; m.frustumCulled = false; this.scene.add(cat(m, 'wilki')); }
      this.wolfEyes = new THREE.InstancedMesh(eyes, new THREE.MeshBasicMaterial({ color: 0xffd24a }), 64);
      this.wolfEyes.frustumCulled = false;
      this.scene.add(this.wolfEyes);
    }
    const { width, height } = g.map;
    const t = this.tmp;
    let n = 0;
    for (const w of g.wolves) {
      if (n >= 64) break;
      const prev = this.prevPos.get(w.id);
      const fx = (prev ? prev[0] + (w.px - prev[0]) * alpha : w.px) / FP, fy = (prev ? prev[1] + (w.py - prev[1]) * alpha : w.py) / FP;
      const next = w.path[0];
      let h = this.wolfHeading.get(w.id) ?? 0;
      if (next !== undefined) {
        const want = Math.atan2((next % width) + 0.5 - fx, Math.floor(next / width) + 0.5 - fy);
        let d = want - h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        h += d * 0.2; this.wolfHeading.set(w.id, h);
      }
      const run = next !== undefined && !this.calm;
      // atak: wilk skacze do przodu i cofa się, łeb w dół
      let lunge = 0;
      if (w.target && !run && !this.calm) {
        const prey = g.units.find((u) => u.id === w.target) ?? g.soldiers.find((s) => s.id === w.target);
        if (prey && (prey.px - w.px) ** 2 + (prey.py - w.py) ** 2 < (1.5 * FP) ** 2) {
          h = Math.atan2(prey.px / FP - fx, prey.py / FP - fy); this.wolfHeading.set(w.id, h);
          lunge = Math.max(0, Math.sin(this.time * 9 + w.id));
        }
      }
      const bob = run ? Math.abs(Math.sin(this.time * 12 + w.id)) * 0.05 : 0;
      t.position.set(fx - width / 2 + Math.sin(h) * lunge * 0.3, view.heightAt(fx, fy) + bob + lunge * 0.12, fy - height / 2 + Math.cos(h) * lunge * 0.3);
      t.rotation.set(run ? Math.sin(this.time * 12 + w.id) * 0.06 : -lunge * 0.25, h, 0, 'YXZ');
      t.scale.setScalar(1.0);
      t.updateMatrix();
      this.wolfMesh.setMatrixAt(n, t.matrix);
      { let wp = this.wolfPos.get(w.id); if (!wp) { wp = new THREE.Vector3(); this.wolfPos.set(w.id, wp); } wp.copy(t.position); }
      // kłus: łapy po przekątnej razem; w ataku przednie wyrzucone do przodu
      const ph = this.time * 12 + w.id;
      const hips = WOLF_HIPS;
      hips.forEach(([hx, hy, hz], k) => {
        const diag = k === 0 || k === 3 ? 1 : -1;
        const front = hz > 0;
        const ang = run ? Math.sin(ph) * 0.55 * diag : lunge ? (front ? -0.7 * lunge : 0.35 * lunge) : 0;
        this.wolfRot.makeRotationX(ang).setPosition(hx, hy, hz);
        (k < 2 ? this.wolfLegs : this.wolfHindLegs).setMatrixAt(n * 2 + (k & 1), this.wolfPart.multiplyMatrices(t.matrix, this.wolfRot));
      });
      // ogon: w biegu prosto za sobą i lekko faluje, w miejscu zwieszony, w ataku sztywno
      const tailUp = run ? 1.9 + Math.sin(ph * 0.5) * 0.15 : lunge ? 2.2 : 0.5;
      this.wolfRot.makeRotationX(tailUp).setPosition(...WOLF_TAIL);
      this.wolfTails.setMatrixAt(n, this.wolfPart.multiplyMatrices(t.matrix, this.wolfRot));
      this.wolfEyes!.setMatrixAt(n, this.night > 0.2 ? t.matrix : ZERO);
      // warczenie z bliska, kłapnięcie przy ataku
      if (!this.calm && w.target) this.sfxAt('growl', t.position.x, t.position.z, `w${w.id}`, 2.6 + (w.id % 3), 1.4);
      this.wolfMarker(n, w, g, t.position.x, t.position.y, t.position.z, view);
      n++;
    }
    // zabite wilki leżą na boku z wyciągniętymi łapami, z czasem ciemnieją (rozkład)
    let dead = 0;
    for (const body of g.corpses) {
      if (body.kind !== -2 || n + dead >= 64) continue;
      const fx = body.px / FP, fy = body.py / FP;
      const fall = this.calm ? 1 : Math.max(0, Math.min(1, (g.tick + alpha - body.at) / (TICKS_PER_SECOND * 0.6))); // z ułamkiem ticku: płynnie, nie skokami
      const yaw = this.wolfHeading.get(body.id) ?? ((body.id * 2.39) % 6.28);
      const k = n + dead;
      t.position.set(fx - width / 2, view.heightAt(fx, fy), fy - height / 2);
      t.rotation.set(0, yaw, 0, 'YXZ');
      t.scale.setScalar(1);
      t.updateMatrix();
      // obrót na bok wokół osi grzbietu: ciało kładzie się na ziemi
      this.wolfRot.makeTranslation(0, 0.075 * fall, 0).multiply(new THREE.Matrix4().makeRotationZ(fall * Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, -0.33 * fall, 0));
      const bodyM = new THREE.Matrix4().multiplyMatrices(t.matrix, this.wolfRot);
      this.wolfMesh.setMatrixAt(k, bodyM);
      WOLF_HIPS.forEach(([hx, hy, hz], j) => {
        this.wolfRot.makeRotationX((j < 2 ? -0.35 : 0.35) * fall).setPosition(hx, hy, hz);
        (j < 2 ? this.wolfLegs : this.wolfHindLegs).setMatrixAt(k * 2 + (j & 1), this.wolfPart.multiplyMatrices(bodyM, this.wolfRot));
      });
      this.wolfRot.makeRotationX(1.5).setPosition(...WOLF_TAIL);
      this.wolfTails.setMatrixAt(k, this.wolfPart.multiplyMatrices(bodyM, this.wolfRot));
      this.wolfEyes!.setMatrixAt(k, ZERO);
      dead++;
    }
    this.wolfMarkersFinish(n);
    this.wolfMesh.count = n + dead; this.wolfEyes!.count = n + dead; this.wolfTails.count = n + dead; this.wolfLegs.count = this.wolfHindLegs.count = (n + dead) * 2;
    touch(this.wolfLegs); touch(this.wolfHindLegs); touch(this.wolfTails);
    touch(this.wolfMesh); touch(this.wolfEyes!);
  }
}

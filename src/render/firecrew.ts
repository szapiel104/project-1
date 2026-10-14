import * as THREE from 'three';

/**
 * Efekty gaszenia pożaru (tylko wygląd): ikonka nad głową każdego, kto biegnie z wiadrem,
 * strumień wody z przechylanego wiadra (krople lecą łukiem i rozbryzgują się na ziemi) i kłęby pary nad ogniem.
 */
const MAX_DROPS = 600;
const MAX_STEAM = 80;

interface Drop { p: THREE.Vector3; v: THREE.Vector3; life: number; size: number; splash: boolean }
interface Puff { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; size: number }

function iconTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d')!;
  // okrągła tarcza w kolorze wody ze złotą obwódką (jak ikonka wieży), w środku wiadro z chlustem wody
  x.fillStyle = '#16557d'; x.strokeStyle = '#e9c766'; x.lineWidth = 6;
  x.beginPath(); x.arc(48, 48, 41, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#fff1c8'; x.strokeStyle = '#fff1c8'; x.lineWidth = 4; x.lineJoin = 'round';
  // wiadro przechylone w prawo
  x.save(); x.translate(40, 56); x.rotate(-0.5);
  x.beginPath(); x.moveTo(-15, -14); x.lineTo(15, -14); x.lineTo(11, 16); x.lineTo(-11, 16); x.closePath(); x.fill();
  x.beginPath(); x.arc(0, -14, 16, Math.PI, 0); x.stroke();
  x.fillStyle = '#16557d'; x.fillRect(-14, -6, 28, 3); x.fillRect(-13, 6, 26, 3);
  x.restore();
  // chlust wody: trzy krople
  x.fillStyle = '#8fd4ff';
  for (const [px, py, r] of [[66, 30, 7], [74, 46, 5.5], [70, 62, 4.5]] as const) {
    x.beginPath(); x.moveTo(px, py - r * 1.9); x.quadraticCurveTo(px + r * 1.1, py - r * 0.2, px, py + r); x.quadraticCurveTo(px - r * 1.1, py - r * 0.2, px, py - r * 1.9); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(235,238,240,0.45)'); gr.addColorStop(1, 'rgba(230,232,235,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class FireCrewFx {
  private icons = new Map<number, { s: THREE.Sprite; born: number; seen: boolean }>();
  private iconTex = iconTexture();
  private puffTex = puffTexture();
  private drops: Drop[] = [];
  private dropMesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0x9fd8f5, transparent: true, opacity: 0.85, depthWrite: false, fog: true }), MAX_DROPS);
    this.dropMesh.count = 0; this.dropMesh.frustumCulled = false; this.dropMesh.renderOrder = 5;
    scene.add(this.dropMesh);
  }

  /** Początek klatki: ikonki, których nikt nie odświeży, znikną */
  begin(): void { for (const v of this.icons.values()) v.seen = false; }

  /** Ikonka nad głową gaszącego; wyskakuje sprężyście, gdy ktoś dostaje wiadro */
  icon(id: number, x: number, y: number, z: number, time: number): void {
    let e = this.icons.get(id);
    if (!e) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTex, transparent: true, depthTest: false, fog: false }));
      s.renderOrder = 12; this.scene.add(s);
      e = { s, born: time, seen: true };
      this.icons.set(id, e);
    }
    e.seen = true;
    const a = Math.min(1, (time - e.born) / 0.35);
    // „easeOutBack”: najpierw trochę za duża, potem siada na miejsce
    const pop = a >= 1 ? 1 : 1 + 2.7 * (a - 1) ** 3 + 1.7 * (a - 1) ** 2;
    const bob = Math.sin(time * 4 + id) * 0.025;
    e.s.position.set(x, y + bob + (1 - a) * 0.15, z);
    e.s.scale.setScalar(0.3 * Math.max(0.01, pop));
    (e.s.material as THREE.SpriteMaterial).opacity = Math.min(1, a * 2);
  }

  /** Woda wylewana z wiadra: `mouth` = brzeg wiadra, `dir` = kierunek przodu postaci (poziomo) */
  pour(mouth: THREE.Vector3, dir: THREE.Vector3, strength: number): void {
    const n = Math.round(4 * strength);
    for (let i = 0; i < n && this.drops.length < MAX_DROPS; i++) {
      const sp = 1.4 + Math.random() * 1.1;
      this.drops.push({
        p: mouth.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05)),
        v: new THREE.Vector3(dir.x * sp + (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.9, dir.z * sp + (Math.random() - 0.5) * 0.5),
        life: 1.2, size: 0.018 + Math.random() * 0.016, splash: false,
      });
    }
  }

  /** Para i dym, gdy woda trafia w ogień */
  steam(x: number, y: number, z: number, n = 6): void {
    for (let i = 0; i < n && this.puffs.length < MAX_STEAM; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6);
      this.scene.add(s);
      const max = 1.4 + Math.random() * 1.2;
      this.puffs.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.7 + Math.random() * 0.6, (Math.random() - 0.5) * 0.25), life: max, max, size: 0.35 + Math.random() * 0.35 });
    }
  }

  /** Koniec klatki: ruch kropel i pary; `ground(x, z)` = wysokość ziemi */
  end(dt: number, ground: (x: number, z: number) => number): void {
    for (const [id, e] of this.icons) if (!e.seen) { this.scene.remove(e.s); e.s.material.dispose(); this.icons.delete(id); }
    let k = 0;
    const next: Drop[] = [];
    for (const d of this.drops) {
      d.life -= dt;
      if (d.life <= 0) continue;
      d.v.y -= 9.8 * dt;
      d.p.addScaledVector(d.v, dt);
      const gy = ground(d.p.x, d.p.z);
      if (d.p.y <= gy && !d.splash) {
        // rozbryzg: kropla rozpada się na kilka drobnych, które podskakują i znikają
        d.p.y = gy + 0.01;
        for (let i = 0; i < 2 && this.drops.length + next.length < MAX_DROPS; i++) {
          next.push({ p: d.p.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.7, (Math.random() - 0.5) * 1.2), life: 0.35, size: d.size * 0.55, splash: true });
        }
        continue;
      }
      if (d.splash && d.p.y < gy) continue;
      next.push(d);
    }
    this.drops = next;
    for (const d of this.drops) {
      // kropla wydłużona w kierunku lotu
      const len = Math.min(3, 1 + d.v.length() * 0.6);
      this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.v.clone().normalize());
      this.sc.set(d.size, d.size * len, d.size);
      this.m.compose(d.p, this.q, this.sc);
      this.dropMesh.setMatrixAt(k++, this.m);
    }
    this.dropMesh.count = k;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    this.puffs = this.puffs.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); return false; }
      const a = 1 - p.life / p.max;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (1 + a * 2.2));
      p.s.material.opacity = Math.min(1, a * 6) * (1 - a) * 0.7;
      return true;
    });
  }
}

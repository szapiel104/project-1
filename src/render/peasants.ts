import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Part {
  mesh: THREE.InstancedMesh;
  pos: THREE.Vector3;
  /** Obrót wokół osi X: wymach nogi lub ręki */
  rot: (swing: number, armsUp: boolean) => number;
  /** Czy część bierze barwę drużyny */
  tinted: boolean;
}

/**
 * Chłopi jako małe postacie: nogi, tunika w barwach drużyny, ręce, głowa i słomkowy kapelusz.
 * Każda część to jedna siatka instancjonowana, więc setki postaci kosztują kilka wywołań rysowania.
 */
export class Figures {
  private parts: Part[] = [];
  private local = new THREE.Matrix4();
  private out = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private one = new THREE.Vector3(1, 1, 1);
  private color = new THREE.Color();

  constructor(max: number, scene: THREE.Scene) {
    const add = (geo: THREE.BufferGeometry, color: number | null, x: number, y: number, z: number, rot: Part['rot']): void => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: color ?? 0xffffff, flatShading: true }), max);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.parts.push({ mesh, pos: new THREE.Vector3(x, y, z), rot, tinted: color === null });
    };
    const limb = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0); // obrót wokół góry
    const still = (): number => 0;
    add(limb(0.075, 0.23, 0.085), 0x5a4632, -0.055, 0.23, 0, (s) => s);
    add(limb(0.075, 0.23, 0.085), 0x5a4632, 0.055, 0.23, 0, (s) => -s);
    add(new THREE.BoxGeometry(0.2, 0.25, 0.13).translate(0, 0.125, 0), null, 0, 0.22, 0, still);
    add(limb(0.06, 0.21, 0.065), null, -0.135, 0.45, 0, (s, up) => (up ? -1.35 : -s * 0.8));
    add(limb(0.06, 0.21, 0.065), null, 0.135, 0.45, 0, (s, up) => (up ? -1.35 : s * 0.8));
    add(new THREE.IcosahedronGeometry(0.085, 1), 0xe2bd94, 0, 0.555, 0, still);
    const hat = mergeGeometries([
      new THREE.CylinderGeometry(0.15, 0.15, 0.018, 10).translate(0, 0.0, 0),
      new THREE.CylinderGeometry(0.06, 0.085, 0.07, 8).translate(0, 0.04, 0),
    ]);
    add(hat, 0xcfae55, 0, 0.615, 0, still);
  }

  /** Ustawia postać numer `i`. `base` = położenie i obrót całej postaci. */
  set(i: number, base: THREE.Matrix4, swing: number, armsUp: boolean, tunic: number): void {
    for (const p of this.parts) {
      this.q.setFromEuler(this.e.set(p.rot(swing, armsUp), 0, 0));
      this.local.compose(p.pos, this.q, this.one);
      this.out.multiplyMatrices(base, this.local);
      p.mesh.setMatrixAt(i, this.out);
      if (p.tinted) p.mesh.setColorAt(i, this.color.setHex(tunic));
    }
  }

  finish(count: number): void {
    for (const p of this.parts) {
      p.mesh.count = count;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
}

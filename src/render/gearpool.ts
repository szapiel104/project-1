import * as THREE from 'three';
import { cat } from './cat';
import { Figures } from './peasants';
import { touch } from './touch';

/** Zerowa macierz: „tego narzędzia teraz nie ma” — pula takiej instancji w ogóle nie rysuje */
export const GEAR_NONE = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Narzędzia w rękach i przy ludziach (siekiery, kilofy, młotki, pochodnie, wiadra, wędki, posłania).
 * Zamiast jednej instancji na każdego człowieka (z zerową skalą u tych, którzy narzędzia nie mają — karta i tak je
 * przetwarzała) pula zbiera w każdej klatce tylko te, które naprawdę widać, i rozdziela je na dwie siatki:
 * pełną z bliska i lżejszą z daleka (ta sama odległość przełączania co u postaci). Bardzo daleko narzędzi nie rysuje
 * wcale — z wysokości kamery i tak ich nie widać.
 *
 * Z zewnątrz zachowuje się jak siatka instancji: `setMatrixAt(i, m)` (numer i jest bez znaczenia) i `count = n`
 * na końcu klatki zamyka zbieranie.
 */
export class GearPool {
  private near: THREE.InstancedMesh;
  private far: THREE.InstancedMesh | null;
  private n = 0;
  private f = 0;
  private view: THREE.Vector3 | null = null;
  private on = true;
  /** Dalej niż tyle (do kwadratu) od kamery narzędzia nie rysujemy */
  static HIDE2 = 60 * 60;

  constructor(scene: THREE.Object3D, near: THREE.BufferGeometry, far: THREE.BufferGeometry | null, mat: THREE.Material | THREE.Material[], max: number, label: string, shadow = true) {
    const make = (geo: THREE.BufferGeometry, sh: boolean): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.count = 0; m.frustumCulled = false; m.castShadow = sh;
      scene.add(cat(m, label));
      return m;
    };
    this.near = make(near, shadow);
    // z daleka bez cienia: drobne narzędzie w mapie cieni i tak zlewa się z cieniem postaci
    this.far = far ? make(far, false) : null;
  }

  /** Pozycja kamery (to samo, co dostają postacie) */
  setView(p: THREE.Vector3): void { this.view = p; }

  set visible(v: boolean) { this.on = v; this.near.visible = v && this.near.count > 0; if (this.far) this.far.visible = v && this.far.count > 0; }
  get visible(): boolean { return this.on; }

  setMatrixAt(_i: number, m: THREE.Matrix4): void {
    if (m === GEAR_NONE) return;
    const e = m.elements;
    if (e[0] === 0 && e[5] === 0 && e[10] === 0 && e[1] === 0 && e[4] === 0) return; // zerowa skala: brak narzędzia
    let d2 = 0;
    if (this.view) d2 = (e[12]! - this.view.x) ** 2 + (e[13]! - this.view.y) ** 2 + (e[14]! - this.view.z) ** 2;
    if (d2 > GearPool.HIDE2) return;
    if (this.far && d2 > Figures.FAR2) { if (this.f < this.far.instanceMatrix.count) this.far.setMatrixAt(this.f++, m); }
    else if (this.n < this.near.instanceMatrix.count) this.near.setMatrixAt(this.n++, m);
  }

  /** Koniec klatki: tyle narzędzi rysujemy; liczba podana z zewnątrz (dawna liczba ludzi) nie ma znaczenia */
  set count(_n: number) {
    // pusta pula znika ze sceny (bez wywołania rysowania), a na kartę idą tylko używane instancje
    this.near.count = this.n; this.near.visible = this.on && this.n > 0; touch(this.near);
    if (this.far) { this.far.count = this.f; this.far.visible = this.on && this.f > 0; touch(this.far); }
    this.n = 0; this.f = 0;
  }
  get count(): number { return this.n + this.f; }

  /** Zgodność z siatką instancji: zmiany oznacza już `count` */
  readonly instanceMatrix = { needsUpdate: false, count: 0 };
}

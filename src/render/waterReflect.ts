import * as THREE from 'three';

/**
 * Odbicie w wodzie jak w grach z prawdziwą wodą (planar reflection): druga kamera, odbita lustrzanie względem
 * tafli, rysuje scenę do tekstury w połowie rozdzielczości; shader wody czyta ją w miejscu piksela, przesuniętym
 * o falę. Wszystko pod taflą jest odcinane skośną płaszczyzną w macierzy rzutowania (jak THREE.Reflector), więc
 * dno i ryby się nie odbijają.
 *
 * Rysowane raz na klatkę, przed właściwym obrazem, bez przeliczania mapy cieni. Pomijane są rzeczy drobne albo
 * przezroczyste, których w falującym odbiciu i tak nie widać (gęsta trawa, opary, dym, siatki budowy).
 */
const SKIP = new Set(['woda', 'trawa (dywan)', 'mgła w dolinach', 'dym, mgła, iskry', 'siatka budowy', 'chmury', ' (cień)', 'ryby']);

export class WaterReflection {
  readonly uniforms = {
    tRefl: { value: null as THREE.Texture | null },
    mRefl: { value: new THREE.Matrix4() },
    uRefl: { value: 0 },
  };
  private rt: THREE.WebGLRenderTarget | null = null;
  private cam = new THREE.PerspectiveCamera();
  private size = new THREE.Vector2();
  private hidden: THREE.Object3D[] = [];
  private lights: THREE.DirectionalLight[] = [];
  private hiddenScan = 0;

  constructor(private readonly y: number) {}

  /** on = false: shader wraca do taniego odbicia nieba (słabsza grafika) */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, on: boolean): void {
    if (!on || camera.position.y <= this.y + 0.02) { this.uniforms.uRefl.value = 0; return; }
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(64, Math.round(this.size.x * 0.5)), h = Math.max(64, Math.round(this.size.y * 0.5));
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 2 });
      this.rt.texture.name = 'odbicie w wodzie';
    } else if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);

    // kamera odbita względem płaszczyzny y = this.y
    camera.updateMatrixWorld();
    const c = this.cam, p = camera.position;
    c.position.set(p.x, 2 * this.y - p.y, p.z);
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    c.up.set(up.x, -up.y, up.z);
    c.lookAt(c.position.x + fwd.x, c.position.y - fwd.y, c.position.z + fwd.z);
    c.near = camera.near; c.far = camera.far;
    c.updateMatrixWorld();
    c.projectionMatrix.copy(camera.projectionMatrix);
    // skośne odcięcie bliskiej płaszczyzny na wysokości tafli (Lengyel, „Oblique View Frustum Depth Projection”)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.y).applyMatrix4(c.matrixWorldInverse);
    const cp = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = c.projectionMatrix.elements;
    const q = new THREE.Vector4((Math.sign(cp.x) + e[8]!) / e[0]!, (Math.sign(cp.y) + e[9]!) / e[5]!, -1, (1 + e[10]!) / e[14]!);
    cp.multiplyScalar(2 / cp.dot(q));
    e[2] = cp.x; e[6] = cp.y; e[10] = cp.z + 1 - 0.003; e[14] = cp.w;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    // macierz: świat -> współrzędne tekstury odbicia (0..1)
    this.uniforms.mRefl.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);

    // co jakiś czas od nowa zbieramy rzeczy do schowania (scena się zmienia: nowe budowy, dym)
    if (this.hiddenScan-- <= 0) {
      this.hiddenScan = 60;
      this.hidden.length = 0;
      this.lights.length = 0;
      scene.traverse((o) => {
        if (SKIP.has(o.userData.cat as string)) this.hidden.push(o);
        if ((o as THREE.DirectionalLight).isLight && (o as THREE.DirectionalLight).shadow) this.lights.push(o as THREE.DirectionalLight);
      });
    }
    const was = this.hidden.map((o) => o.visible);
    for (const o of this.hidden) o.visible = false;
    const sm = renderer.shadowMap.autoUpdate, smNeed = renderer.shadowMap.needsUpdate, prevRt = renderer.getRenderTarget();
    // mapa cieni z poprzedniej klatki wystarczy — o ile już istnieje (pierwsza klatka, świeżo włączone cienie:
    // bez mapy shader dostałby pustą teksturę zamiast cienia i karta zgłasza błąd)
    if (this.lights.every((l) => !l.castShadow || l.shadow.map)) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; }
    try {
      renderer.setRenderTarget(this.rt);
      renderer.clear();
      renderer.render(scene, c);
    } finally {
      renderer.setRenderTarget(prevRt);
      renderer.shadowMap.autoUpdate = sm;
      renderer.shadowMap.needsUpdate = smNeed;
      this.hidden.forEach((o, i) => { o.visible = was[i]!; });
    }
    this.uniforms.tRefl.value = this.rt.texture;
    this.uniforms.uRefl.value = 1;
  }

  dispose(): void { this.rt?.dispose(); this.rt = null; }
}

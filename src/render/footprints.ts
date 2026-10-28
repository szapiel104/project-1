/**
 * Ślady butów na śniegu (Michał 28.10.2026). Zimą każdy idący chłop i żołnierz zostawia za sobą pojedyncze odciski
 * podeszew — na zmianę lewa i prawa, wzdłuż kierunku marszu. Odcisk jest ciemniejszy, chłodny (cień we wgłębieniu
 * śniegu), z wyraźnym obcasem; po ok. 25 s zaczyna blednąć i po ok. 40 s znika (w zamieci szybciej), a gdy śnieg
 * stopnieje, znikają wszystkie. To uzupełnia rozmytą mapę wydeptania (SnowTrails w season.ts): tamta pokazuje
 * wydeptane ścieżki, ta — pojedyncze kroki z bliska.
 *
 * Wszystko w jednej siatce instancji (jedno wywołanie rysowania) w pierścieniu MAX odcisków: nowy zastępuje najstarszy.
 * Blednięcie liczy shader z czasu narodzin odcisku (atrybut instancji), więc co klatkę zmienia się tylko jeden mundur.
 * Tylko w pobliżu kamery (dalej odcisków i tak nie widać). Tylko wygląd — symulacja o nich nie wie.
 */
import * as THREE from 'three';
import { cat } from './cat';
import { touch } from './touch';

const MAX = 4096;
/** Długość kroku i rozstaw stóp (pola mapy), wymiary odcisku */
const STEP = 0.085, SPREAD = 0.021, LEN = 0.058, WID = 0.024;
/** Po ilu sekundach odcisk zaczyna blednąć i ile trwa blednięcie */
const HOLD = 25, FADE = 15;

/** Podeszwa narysowana na płótnie: przód i obcas, miękki brzeg, drobne nierówności śniegu w środku */
function soleTexture(): THREE.Texture {
  const W = 64, H = 128, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.filter = 'blur(2px)';
  c.fillStyle = 'rgba(255,255,255,1)';
  c.beginPath(); c.ellipse(W / 2, H * 0.33, W * 0.36, H * 0.27, 0, 0, Math.PI * 2); c.fill(); // przód stopy
  c.beginPath(); c.ellipse(W / 2, H * 0.78, W * 0.29, H * 0.15, 0, 0, Math.PI * 2); c.fill(); // obcas
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fillRect(W * 0.3, H * 0.55, W * 0.4, H * 0.12); // płytsze śródstopie
  c.filter = 'none';
  // grudki śniegu w odcisku: jaśniejsze plamki zmniejszają krycie
  let seed = 7;
  const r = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  c.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.25})`; c.beginPath(); c.arc(r() * W, r() * H, 1 + r() * 3, 0, Math.PI * 2); c.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

export class Footprints {
  private mesh: THREE.InstancedMesh;
  private born: THREE.InstancedBufferAttribute;
  private next = 0;
  /** Zegar śladów (s): biegnie szybciej w opadzie, więc ślady szybciej się zasypują */
  private clock = 0;
  private used = 0;
  private last = new Map<number, { x: number; y: number; d: number; side: number }>();
  private uTime = { value: 0 };
  private uSnow = { value: 0 };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(WID, 1, LEN);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.born = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(-1e6), 1);
    this.born.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBorn', this.born);
    // chłodny cień we wgłębieniu śniegu; oświetlony jak reszta (nocą ciemny), bez zapisu głębi i z przesunięciem ku kamerze
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a7c92, alphaMap: soleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.onBeforeCompile = (sh): void => {
      sh.uniforms.uTime = this.uTime;
      sh.uniforms.uSnow = this.uSnow;
      sh.vertexShader = 'attribute float aBorn;\nuniform float uTime;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>\n  float age = uTime - aBorn;\n  vFade = age < 0.0 ? 0.0 : 1.0 - clamp((age - ${HOLD.toFixed(1)}) / ${FADE.toFixed(1)}, 0.0, 1.0);`);
      sh.fragmentShader = 'uniform float uSnow;\nvarying float vFade;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
        '#include <alphamap_fragment>\n  diffuseColor.a *= vFade * 0.55 * smoothstep(0.1, 0.45, uSnow);');
    };
    mat.customProgramCacheKey = (): string => 'footprints';
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.name = 'ślady butów';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.visible = false;
    cat(this.mesh, 'ślady');
    scene.add(this.mesh);
  }

  /**
   * Klatka: `snow` 0..1 (ile śniegu leży), `dt` w sekundach, `fall` przyspiesza zasypywanie (opad),
   * `walkers` — idący w polach mapy, `height` — wysokość terenu, `cam` — środek widoku w polach mapy.
   */
  sync(snow: number, dt: number, fall: number, walkers: { id: number; x: number; y: number }[], height: (x: number, y: number) => number, W: number, H: number, cam: { x: number; y: number }): void {
    // w zamieci ślady starzeją się szybciej (czas shadera biegnie dla nich szybciej)
    this.uSnow.value = snow;
    this.clock += dt * (1 + fall * 2);
    const clock = this.clock;
    this.uTime.value = clock;
    if (snow < 0.1) {
      // stopniało: nowych nie robimy, a stare znikają razem ze śniegiem (mundur uSnow)
      this.last.clear();
      this.mesh.visible = this.used > 0 && snow > 0.01;
      return;
    }
    let added = false;
    const alive = new Set<number>();
    for (const w of walkers) {
      if (Math.abs(w.x - cam.x) > 40 || Math.abs(w.y - cam.y) > 40) continue;
      alive.add(w.id);
      const p = this.last.get(w.id);
      if (!p) { this.last.set(w.id, { x: w.x, y: w.y, d: 0, side: w.id & 1 }); continue; }
      const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy);
      if (d > 2) { p.x = w.x; p.y = w.y; p.d = 0; continue; } // przeskok (wyszedł z budynku): bez kroków przez pół mapy
      if (d < 1e-4) continue;
      p.d += d;
      const ux = dx / d, uy = dy / d;
      // tyle kroków, ile zmieściło się w przebytej drodze (cofamy się od bieżącego miejsca)
      while (p.d >= STEP) {
        p.d -= STEP;
        const bx = w.x - ux * p.d, by = w.y - uy * p.d;
        const sgn = p.side ? 1 : -1;
        p.side ^= 1;
        const fx = bx - uy * SPREAD * sgn, fy = by + ux * SPREAD * sgn;
        this.put(fx, fy, Math.atan2(ux, uy), height(fx, fy), W, H, clock);
        added = true;
      }
      p.x = w.x; p.y = w.y;
    }
    for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id);
    if (added) { this.mesh.instanceMatrix.needsUpdate = true; this.born.needsUpdate = true; touch(this.mesh); }
    this.mesh.count = this.used;
    this.mesh.visible = this.used > 0;
  }

  private put(x: number, y: number, yaw: number, h: number, W: number, H: number, clock: number): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.used = Math.min(MAX, this.used + 1);
    this.q.setFromAxisAngle(this.up, yaw);
    this.m.compose(this.v.set(x - W / 2, h + 0.004, y - H / 2), this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.born.setX(i, clock);
  }

  dispose(): void { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

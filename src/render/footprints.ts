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
 *
 * Bruzdy (Michał 28.10: „ciągnące drzewa niech też zostawiają ślad i wóz”): drwal ciągnący ścięty pień zostawia za sobą
 * szeroką, ciągłą bruzdę, a dwukółka z surowcami dwie wąskie koleiny po kołach. To druga siatka instancji (własna
 * tekstura miękkiego pasa z podłużnymi rysami), z tym samym blednięciem co odciski butów.
 */
import * as THREE from 'three';
import { cat } from './cat';
import { touch } from './touch';

/** Pierścień odcisków: przy kilkudziesięciu idących 4096 starczało na kilka sekund i stare znikały od razu, zanim zbladły */
const MAX = 24576;
/** Długość kroku i rozstaw stóp (pola mapy), wymiary odcisku */
const STEP = 0.085, SPREAD = 0.021, LEN = 0.058, WID = 0.024;
/** Łapy wilka: krok, rozstaw (prawie jedna linia) i wymiary odcisku */
const PAW_STEP = 0.075, PAW_SPREAD = 0.008, PAW_W = 0.03, PAW_L = 0.032;
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

/** Łapa wilka: duża poduszka śródstopia (trójlistna z tyłu) i cztery owalne palce z przodu, ślady pazurów przed nimi */
function pawTexture(): THREE.Texture {
  const W = 64, H = 64, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.filter = 'blur(1.5px)';
  c.fillStyle = 'rgba(255,255,255,1)';
  c.beginPath(); c.ellipse(W / 2, H * 0.68, W * 0.2, H * 0.15, 0, 0, Math.PI * 2); c.fill(); // poduszka
  for (const [x, y] of [[0.3, 0.38], [0.7, 0.38], [0.42, 0.24], [0.58, 0.24]] as const) {
    c.beginPath(); c.ellipse(W * x, H * y, W * 0.075, H * 0.095, 0, 0, Math.PI * 2); c.fill(); // palce
  }
  c.fillStyle = 'rgba(255,255,255,0.6)';
  for (const [x, y] of [[0.28, 0.23], [0.72, 0.23], [0.42, 0.09], [0.58, 0.09]] as const) {
    c.beginPath(); c.arc(W * x, H * y, 2, 0, Math.PI * 2); c.fill(); // pazury
  }
  c.filter = 'none';
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

/** Bruzda w śniegu: miękki pas z podłużnymi rysami (pień, koło), lekko wygaszony na obu końcach, żeby kolejne odcinki zlewały się w jedną linię */
function furrowTexture(): THREE.Texture {
  const W = 64, H = 128, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.filter = 'blur(3px)';
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fillRect(W * 0.16, -10, W * 0.68, H + 20);
  c.filter = 'blur(1px)';
  let seed = 11;
  const r = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 7; k++) { c.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`; c.fillRect(W * (0.22 + r() * 0.5), -4, 1 + r() * 2.5, H + 8); }
  c.filter = 'none';
  c.globalCompositeOperation = 'destination-in';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.2, 'rgba(0,0,0,1)'); g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

/** Jedna siatka instancji śladów (odciski albo bruzdy) z czasem narodzin każdej sztuki; blednięcie liczy shader */
class TrackLayer {
  readonly mesh: THREE.InstancedMesh;
  private born: THREE.InstancedBufferAttribute;
  private next = 0;
  used = 0;
  dirty = false;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  constructor(scene: THREE.Scene, name: string, map: THREE.Texture, color: number, alpha: number, max: number, uTime: { value: number }, uSnow: { value: number }) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.born = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(-1e6), 1);
    this.born.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBorn', this.born);
    // chłodny cień we wgłębieniu śniegu; oświetlony jak reszta (nocą ciemny), bez zapisu głębi i z przesunięciem ku kamerze
    const mat = new THREE.MeshLambertMaterial({ color, alphaMap: map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.onBeforeCompile = (sh): void => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uSnow = uSnow;
      sh.vertexShader = 'attribute float aBorn;\nuniform float uTime;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>\n  float age = uTime - aBorn;\n  vFade = age < 0.0 ? 0.0 : 1.0 - clamp((age - ${HOLD.toFixed(1)}) / ${FADE.toFixed(1)}, 0.0, 1.0);`);
      sh.fragmentShader = 'uniform float uSnow;\nvarying float vFade;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
        `#include <alphamap_fragment>\n  diffuseColor.a *= vFade * ${alpha.toFixed(2)} * smoothstep(0.45, 0.75, uSnow);`);
    };
    mat.customProgramCacheKey = (): string => name;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.visible = false;
    cat(this.mesh, 'ślady');
    scene.add(this.mesh);
  }
  /** Sztuka śladu w polach mapy (x, y), obrót wokół pionu, wysokość ziemi, szerokość i długość */
  put(x: number, y: number, yaw: number, h: number, w: number, l: number, W: number, H: number, clock: number): void {
    const i = this.next;
    // pierścień pełny świeżych śladów: nowego nie kładziemy, zamiast wycinać jeszcze widoczny (ślad ma zblednąć, a nie zniknąć)
    if (clock - this.born.getX(i) < HOLD + FADE) return;
    this.next = (this.next + 1) % this.mesh.instanceMatrix.count;
    this.used = Math.min(this.mesh.instanceMatrix.count, this.used + 1);
    this.q.setFromAxisAngle(this.up, yaw);
    this.m.compose(this.v.set(x - W / 2, h + 0.004, y - H / 2), this.q, this.s.set(w, 1, l));
    this.mesh.setMatrixAt(i, this.m);
    this.born.setX(i, clock);
    this.dirty = true;
  }
  finish(snow: number): void {
    if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.born.needsUpdate = true; touch(this.mesh); this.dirty = false; }
    this.mesh.count = this.used;
    this.mesh.visible = this.used > 0 && snow > 0.45;
  }
  dispose(): void { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

/** Odstęp kolejnych odcinków bruzdy, szerokość i długość odcinka; rozstaw kół dwukółki */
const DRAG_STEP = 0.06, LOG_W = 0.085, RUT_W = 0.026, SEG_L = 0.1, WHEELS = 0.085;

export class Footprints {
  /** Zegar śladów (s): biegnie szybciej w opadzie, więc ślady szybciej się zasypują */
  private clock = 0;
  private soles: TrackLayer;
  private furrows: TrackLayer;
  private paws: TrackLayer;
  private last = new Map<number, { x: number; y: number; d: number; side: number }>();
  private lastDrag = new Map<number, { x: number; y: number; d: number }>();
  private uTime = { value: 0 };
  private uSnow = { value: 0 };

  constructor(scene: THREE.Scene) {
    this.soles = new TrackLayer(scene, 'ślady butów', soleTexture(), 0x6a7c92, 0.55, MAX, this.uTime, this.uSnow);
    this.furrows = new TrackLayer(scene, 'bruzdy w śniegu', furrowTexture(), 0x637690, 0.5, 8192, this.uTime, this.uSnow);
    this.paws = new TrackLayer(scene, 'ślady wilków', pawTexture(), 0x6a7c92, 0.55, 8192, this.uTime, this.uSnow);
  }

  /**
   * Klatka: `snow` 0..1 (ile śniegu leży), `dt` w sekundach, `fall` przyspiesza zasypywanie (opad),
   * `walkers` — idący w polach mapy z wysokością stóp tak, jak stoją na ekranie (`h`, świat),
   * `drags` — ciągnięte pnie (kind 0, punkt środka pnia przy ziemi) i dwukółki (kind 1, środek osi), `cam` — środek widoku w polach mapy.
   */
  sync(snow: number, dt: number, fall: number, walkers: { id: number; x: number; y: number; h: number }[], W: number, H: number, cam: { x: number; y: number },
    drags: { id: number; x: number; y: number; h: number; kind: number }[] = [], wolves: { id: number; x: number; y: number; h: number }[] = []): void {
    // w zamieci ślady starzeją się szybciej (czas shadera biegnie dla nich szybciej)
    this.uSnow.value = snow;
    this.clock += dt * (1 + fall * 2);
    const clock = this.clock;
    this.uTime.value = clock;
    // ślady tylko na prawdziwym śniegu: przy cienkich łatach (wiosną, w odwilż) ziemia jest już zielona i niebieskie
    // odciski na trawie wyglądały źle (Michał 28.10.2026)
    if (snow < 0.45) {
      // stopniało: nowych nie robimy, a stare znikają razem ze śniegiem (mundur uSnow)
      this.last.clear(); this.lastDrag.clear();
      this.soles.finish(snow); this.furrows.finish(snow); this.paws.finish(snow);
      return;
    }
    const alive = new Set<number>();
    // wilki: łapy prawie w jednej linii (kłus — tylna łapa trafia w ślad przedniej), krok krótszy niż człowieka
    for (const w of wolves) this.stepPrints(w, cam, alive, this.paws, PAW_STEP, PAW_SPREAD, PAW_W, PAW_L, W, H, clock);
    for (const w of walkers) this.stepPrints(w, cam, alive, this.soles, STEP, SPREAD, WID, LEN, W, H, clock);
    for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id);
    // bruzdy: ciągnięty pień (jedna szeroka) i dwukółka (dwie koleiny po bokach osi)
    const aliveD = new Set<number>();
    for (const g of drags) {
      if (Math.abs(g.x - cam.x) > 30 || Math.abs(g.y - cam.y) > 30) continue;
      aliveD.add(g.id);
      const p = this.lastDrag.get(g.id);
      if (!p) { this.lastDrag.set(g.id, { x: g.x, y: g.y, d: 0 }); continue; }
      const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy);
      if (d > 2) { p.x = g.x; p.y = g.y; p.d = 0; continue; }
      if (d < 1e-4) continue;
      p.d += d;
      const ux = dx / d, uy = dy / d, yaw = Math.atan2(ux, uy);
      while (p.d >= DRAG_STEP) {
        p.d -= DRAG_STEP;
        const bx = g.x - ux * p.d, by = g.y - uy * p.d;
        if (g.kind === 0) this.furrows.put(bx, by, yaw, g.h, LOG_W, SEG_L, W, H, clock);
        else for (const sgn of [-1, 1]) this.furrows.put(bx - uy * WHEELS * sgn, by + ux * WHEELS * sgn, yaw, g.h, RUT_W, SEG_L, W, H, clock);
      }
      p.x = g.x; p.y = g.y;
    }
    for (const id of this.lastDrag.keys()) if (!aliveD.has(id)) this.lastDrag.delete(id);
    this.soles.finish(snow);
    this.furrows.finish(snow);
    this.paws.finish(snow);
  }

  /** Kroki jednego idącego: tyle odcisków, ile zmieściło się w przebytej drodze, na zmianę lewy i prawy */
  private stepPrints(w: { id: number; x: number; y: number; h: number }, cam: { x: number; y: number }, alive: Set<number>, layer: TrackLayer,
    step: number, spread: number, wid: number, len: number, W: number, H: number, clock: number): void {
    if (Math.abs(w.x - cam.x) > 30 || Math.abs(w.y - cam.y) > 30) return;
    alive.add(w.id);
    const p = this.last.get(w.id);
    if (!p) { this.last.set(w.id, { x: w.x, y: w.y, d: 0, side: w.id & 1 }); return; }
    const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy);
    if (d > 2) { p.x = w.x; p.y = w.y; p.d = 0; return; } // przeskok (wyszedł z budynku): bez kroków przez pół mapy
    if (d < 1e-4) return;
    p.d += d;
    const ux = dx / d, uy = dy / d;
    // tyle kroków, ile zmieściło się w przebytej drodze (cofamy się od bieżącego miejsca)
    while (p.d >= step) {
      p.d -= step;
      const bx = w.x - ux * p.d, by = w.y - uy * p.d;
      const sgn = p.side ? 1 : -1;
      p.side ^= 1;
      const fx = bx - uy * spread * sgn, fy = by + ux * spread * sgn;
      // przód odcisku leży w teksturze u góry, czyli w -z płaszczyzny: obrót o 180°, żeby palce szły w stronę marszu
      layer.put(fx, fy, Math.atan2(ux, uy) + Math.PI, w.h, wid, len, W, H, clock);
    }
    p.x = w.x; p.y = w.y;
  }

  dispose(): void { this.soles.dispose(); this.furrows.dispose(); this.paws.dispose(); }
}

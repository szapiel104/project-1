import * as THREE from 'three';

/**
 * Nowe obiekty w trakcie gry (pierwsza wieża, brama, plac budowy, podgląd stawiania) potrzebują czasem shaderów,
 * których jeszcze nie ma. Bez tej warstwy karta kompilowała je w chwili pierwszego rysowania i gra stawała na
 * 0,1–1 s przy każdym takim shaderze.
 *
 * Tu: każdy obiekt dodany do sceny po rozgrzewce trafia na listę. Przed klatką jego shadery są zlecane karcie
 * (`renderer.compile` przy równoległej kompilacji nie blokuje), a sam obiekt nie jest rysowany, dopóki nie są gotowe —
 * zwykle kilka klatek. Obiekty z gotowymi shaderami schodzą z listy od razu.
 *
 * Koszt pilnujemy: materiały obiektu zbieramy raz, kompilacja najwyżej kilku obiektów na klatkę, a po pełnej
 * rozgrzewce (nowa mapa) lista jest czyszczona — wszystko w scenie jest wtedy już skompilowane.
 */

/** Najdłużej tyle czekamy na shadery (wolna karta): potem obiekt i tak się pokazuje */
const MAX_WAIT_MS = 1500;
/** Tyle obiektów na klatkę może zlecić kompilację (compile przegląda światła całej sceny) */
const COMPILES_PER_FRAME = 4;

let sink: ((o: THREE.Object3D) => void) | null = null;
let patched = false;

/** Raz: każde `add` w całym three.js zgłasza dodawane obiekty, gdy ktoś słucha */
function patchAdd(): void {
  if (patched) return;
  patched = true;
  const add = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (this: THREE.Object3D, ...objects: THREE.Object3D[]) {
    const r = add.apply(this, objects);
    if (sink) for (const o of objects) sink(o);
    return r;
  } as typeof add;
}

interface Entry { since: number; mats: THREE.Material[] | null; compiled: boolean }

export class Precompiler {
  private pending = new Map<THREE.Object3D, Entry>();
  private on = false;
  /** Obiekty już sprawdzone (przeniesione do innej grupy nie wracają na listę) */
  private done = new WeakSet<THREE.Object3D>();

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene) {
    patchAdd();
  }

  /**
   * Shadery cienia nowego obiektu: three.js kompiluje je dopiero przy pierwszym rzucie cienia, w środku rysowania mapy
   * cieni — i strona wtedy staje. Tu zlecamy je razem ze zwykłymi (kompilacja w tle karty), na bliźniakach materiałów
   * cienia rysowanych z tymi samymi ustawieniami co w mapie cieni (cel: mapa cieni słońca). Zwraca bliźniaki, żeby obiekt
   * czekał w ukryciu także na nie. Obiekt bez rzucania cienia, mapa cieni jeszcze nie narysowana — nic nie robi.
   */
  private compileShadow(o: THREE.Object3D): THREE.Material[] {
    const r = this.renderer;
    if (!r.shadowMap.enabled) return [];
    let sun: THREE.DirectionalLight | undefined;
    this.scene.traverseVisible((x) => { if (!sun && (x as THREE.DirectionalLight).isDirectionalLight && x.castShadow) sun = x as THREE.DirectionalLight; });
    const target = sun?.shadow.map as THREE.WebGLRenderTarget | null | undefined;
    if (!sun || !target) return [];
    // podmiana materiałów na bliźniaki cienia tylko na czas zlecenia kompilacji (synchronicznie, bez rysowania)
    const swaps: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const out = new Set<THREE.Material>();
    o.traverseVisible((x) => {
      const mesh = x as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow || !mesh.material) return;
      swaps.push([mesh, mesh.material]);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => depthTwin(m, r.shadowMap.type)) : depthTwin(mesh.material, r.shadowMap.type);
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) out.add(m);
    });
    if (!swaps.length) return [];
    const prev = r.getRenderTarget();
    try {
      r.setRenderTarget(target);
      r.compile(o, sun.shadow.camera, this.scene);
    } catch { /* bez kompilacji zawczasu cień skompiluje się przy rysowaniu, jak dawniej */ }
    finally {
      r.setRenderTarget(prev);
      for (const [mesh, mat] of swaps) mesh.material = mat;
    }
    return [...out];
  }

  /**
   * Zleca karcie shadery obiektu spoza sceny (zwykłe i cienia), bez rysowania i bez czekania — do przygotowania budynków
   * w tle po starcie gry (scene.ts, prewarmLater). Zwraca materiały, na które można potem czekać (`isReady`).
   */
  warm(o: THREE.Object3D, camera: THREE.Camera): THREE.Material[] {
    try { return [...(this.renderer.compile(o, camera, this.scene) as Set<THREE.Material>), ...this.compileShadow(o)]; }
    catch { return []; }
  }

  /** Czy shadery tych materiałów są już gotowe (bez blokowania: przy równoległej kompilacji pyta kartę, nie czeka) */
  isReady(mats: THREE.Material[]): boolean { return this.ready(mats, false); }

  /** Po pełnej rozgrzewce: wszystko w scenie skompilowane, lista od zera; od teraz pilnujemy nowych obiektów */
  start(): void {
    this.pending.clear();
    this.on = true;
    sink = (o) => { if (this.on && !this.done.has(o) && !this.pending.has(o)) this.pending.set(o, { since: performance.now(), mats: null, compiled: false }); };
  }

  /** Obiekt, któremu zmieniły się materiały (np. łatka pór roku): znowu pilnujemy jego shaderów */
  watch(o: THREE.Object3D): void {
    if (!this.on) return;
    this.done.delete(o);
    this.pending.set(o, { since: performance.now(), mats: null, compiled: false });
  }

  /** Są nowe obiekty jeszcze nie sprawdzone (przed nimi warto dołożyć łatki materiałów, żeby kompilować raz) */
  hasFresh(): boolean {
    for (const e of this.pending.values()) if (!e.mats) return true;
    return false;
  }

  /** Ile obiektów czeka (do okna wydajności) */
  get size(): number { return this.pending.size; }

  private inScene(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === this.scene) return true;
    return false;
  }

  /** `strict`: materiał bez programu albo zmieniony od ostatniego rysowania też liczy się jako niegotowy */
  private ready(mats: THREE.Material[], strict: boolean): boolean {
    for (const m of mats) {
      const p = this.renderer.properties.get(m) as { currentProgram?: { isReady(): boolean }; __version?: number };
      const prog = p.currentProgram;
      if (!prog) { if (strict) return false; continue; }
      if (strict && p.__version !== m.version) return false;
      if (!prog.isReady()) return false;
    }
    return true;
  }

  /**
   * Przed rysowaniem: zleca shadery nowych obiektów i chowa te, których shadery jeszcze się kompilują.
   * Zwraca funkcję przywracającą widoczność (po narysowaniu klatki).
   */
  beforeRender(camera: THREE.Camera): () => void {
    if (!this.pending.size) return noop;
    const hidden: THREE.Object3D[] = [];
    const now = performance.now();
    let compiles = 0;
    for (const [o, e] of this.pending) {
      // obiekt składany dopiero w grupie, która trafi do sceny później (jej dodanie i tak się zgłosi), albo już usunięty
      if (!this.inScene(o)) { this.pending.delete(o); continue; }
      // zgłoszony też przodek: wystarczy pilnować przodka
      let covered = false;
      for (let p = o.parent; p && !covered; p = p.parent) if (this.pending.has(p)) covered = true;
      if (covered) { this.pending.delete(o); continue; }
      e.mats ??= materialsOf(o);
      if (this.ready(e.mats, !e.compiled) || now - e.since > MAX_WAIT_MS) { this.pending.delete(o); this.done.add(o); continue; }
      if (!e.compiled && compiles < COMPILES_PER_FRAME) {
        compiles++;
        e.compiled = true;
        // obiekt chwilowo schowany (np. plac budowy w fazie wykopu): na czas zlecenia widoczny, żeby shadery były gotowe, zanim się pokaże
        const vis = o.visible;
        o.visible = true;
        e.mats = [...(this.renderer.compile(o, camera, this.scene) as Set<THREE.Material>), ...this.compileShadow(o)];
        o.visible = vis;
        if (this.ready(e.mats, false)) { this.pending.delete(o); this.done.add(o); continue; }
      }
      if (o.visible) { o.visible = false; hidden.push(o); }
    }
    return hidden.length ? () => { for (const o of hidden) o.visible = true; } : noop;
  }
}

const noop = (): void => undefined;

/** Bliźniaki materiałów cienia: dla jednego materiału i rodzaju cienia zawsze ten sam (program kompiluje się raz) */
const twins = new WeakMap<THREE.Material, Map<number, THREE.MeshDepthMaterial>>();
const SHADOW_SIDE: Record<number, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };

/**
 * Materiał, którym three.js narysuje ten materiał w mapie cieni (kopia logiki `getDepthMaterial` z WebGLShadowMap):
 * te same ustawienia dają ten sam program karty, więc skompilowany tu shader cienia three.js weźmie gotowy.
 */
function depthTwin(m: THREE.Material, shadowType: THREE.ShadowMapType): THREE.MeshDepthMaterial {
  let byType = twins.get(m);
  if (!byType) { byType = new Map(); twins.set(m, byType); }
  let t = byType.get(shadowType);
  if (!t) { t = new THREE.MeshDepthMaterial(); byType.set(shadowType, t); }
  const src = m as THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; displacementMap?: THREE.Texture | null; displacementScale?: number; displacementBias?: number; wireframe?: boolean; wireframeLinewidth?: number; linewidth?: number };
  t.visible = m.visible;
  t.wireframe = !!src.wireframe;
  t.side = m.shadowSide !== null ? m.shadowSide : shadowType === THREE.VSMShadowMap ? m.side : SHADOW_SIDE[m.side]!;
  t.alphaMap = src.alphaMap ?? null;
  t.alphaTest = m.alphaToCoverage ? 0.5 : m.alphaTest;
  t.map = src.map ?? null;
  t.clipShadows = m.clipShadows;
  t.clippingPlanes = m.clippingPlanes;
  t.clipIntersection = m.clipIntersection;
  t.displacementMap = src.displacementMap ?? null;
  t.displacementScale = src.displacementScale ?? 1;
  t.displacementBias = src.displacementBias ?? 0;
  return t;
}

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    if (Array.isArray(m)) for (const x of m) out.add(x); else out.add(m);
  });
  return [...out];
}

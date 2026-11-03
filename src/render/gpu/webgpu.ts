import * as THREE from 'three';

/**
 * Przejście na WebGPU (docs/webgpu.md). Od 0.91.0 domyślnie (Michał 3.11.2026: „rób od razu na produkcji”):
 *   bez flagi   — WebGPURenderer na prawdziwym WebGPU (gdy przeglądarka go nie ma, three.js sam schodzi do WebGL2)
 *   ?webgpu=gl  — WebGPURenderer w trybie zgodności WebGL2 (do porównań)
 *   ?webgl=1    — stary WebGLRenderer ze wszystkimi shaderami GLSL (zapas i porównanie, narzędzia w tools/check)
 *
 * Na tym etapie WebGPURenderer rysuje zwykłe materiały three.js (sam zamienia je na węzłowe), a materiały z własnym
 * GLSL (`ShaderMaterial`) chowa — ich bliźniaki w TSL dochodzą w kolejnych partiach. Wstawki `onBeforeCompile` (ziemia,
 * pory roku, wiatr) WebGPU pomija, więc obraz jest uboższy. Cel partii: gra wstaje, da się grać i zmierzyć FPS.
 */
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
export const GPU_MODE = !!q && !q.has('webgl');
const FORCE_GL = q?.get('webgpu') === 'gl';

let ready: THREE.WebGLRenderer | null = null;
/** Moduły three/webgpu i three/tsl (tylko z flagą) — bliźniaki materiałów biorą je stąd, bez statycznego importu */
export let gpuMods: { W: typeof import('three/webgpu'); TSL: typeof import('three/tsl'); FX: Record<string, unknown> } | null = null;
let buildBudget = Infinity, buildSpent = 0;
/** Obiekty pominięte w ostatniej klatce, bo ich materiał czeka na złożenie */
export let gpuDeferredCount = 0;
/** Początek klatki: budżet składania materiałów w ms (w grze mały, przy wczytywaniu większy) */
export function gpuFrameBudget(ms: number): void { buildBudget = ms; buildSpent = 0; gpuDeferredCount = 0; }
/** Ile programów karty kompiluje się teraz w tle (rozgrzewka czeka, aż spadnie do zera) */
export let gpuPendingCount = 0;
export const gpuPending = (): number => gpuPendingCount;
/** Opis backendu do F3 i dziennika („WebGPU” albo „WebGL2 w WebGPURenderer”) */
export let gpuBackend = '';

/**
 * Tworzy i uruchamia WebGPURenderer przed sceną (boot.ts, przed importem main.ts): `init()` jest asynchroniczne,
 * a scena tworzy renderer w konstruktorze. Moduł `three/webgpu` ładuje się tylko z flagą (zwykła gra go nie pobiera).
 */
export async function prepareGpu(canvas: HTMLCanvasElement): Promise<void> {
  if (!GPU_MODE || ready) return;
  const W = await import('three/webgpu');
  const TSL = await import('three/tsl');
  // efekty obrazu z three/addons (postNode.ts) — też tylko dynamicznie, żeby nie wciągać three/webgpu do zwykłej paczki
  const [ao, dn, fx, sm, bl] = await Promise.all([
    import('three/examples/jsm/tsl/display/GTAONode.js'), import('three/examples/jsm/tsl/display/DenoiseNode.js'),
    import('three/examples/jsm/tsl/display/FXAANode.js'), import('three/examples/jsm/tsl/display/SMAANode.js'),
    import('three/examples/jsm/tsl/display/BloomNode.js'),
  ]);
  gpuMods = { W, TSL, FX: { ao: ao.ao, denoise: dn.denoise, fxaa: fx.fxaa, smaa: sm.smaa, bloom: bl.bloom } };
  const r = new W.WebGPURenderer({ canvas, antialias: true, forceWebGL: FORCE_GL, powerPreference: 'high-performance' });
  await r.init();
  const backend = (r as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
  gpuBackend = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPURenderer)';
  // Światła punktowe (pochodnie, ogniska, okna): oświetlenie klastrowe Forward+ liczone przez compute — kod materiału
  // nie zależy od liczby świateł (wcześniej 13 pochodni = 13 kopii kodu światła w każdym materiale i ponowne składanie
  // wszystkiego, gdy zapalała się kolejna). Bez prawdziwego WebGPU: światła w tablicach (też bez przebudowy).
  // ?swiatla=zwykle — zwykłe światła three.js (do porównań)
  if (!q?.has('swiatla')) try {
    if (backend.isWebGPUBackend) {
      const { ClusteredLighting } = await import('three/examples/jsm/lighting/ClusteredLighting.js');
      (r as unknown as { lighting: unknown }).lighting = new ClusteredLighting(256);
    } else {
      const { DynamicLighting } = await import('three/examples/jsm/lighting/DynamicLighting.js');
      (r as unknown as { lighting: unknown }).lighting = new DynamicLighting({ maxPointLights: 32 });
    }
  } catch (e) { console.warn('[webgpu] oświetlenie klastrowe niedostępne', e); }
  console.info(`[webgpu] renderer gotowy: ${gpuBackend}`);
  // zgodność z miejscami, które pytają WebGLRenderer o rzeczy, których WebGPURenderer nie ma
  // Klucze programów ze starych łatek GLSL (onBeforeCompile, customProgramCacheKey: „ground-v4”, „wind-<drzewo>”…)
  // na WebGPU nic nie zmieniają, a każdy osobny klucz to osobne, drogie składanie materiału (ok. 12 ms) — wszystkie
  // zwykłe materiały dostają jeden wspólny klucz (materiały węzłowe mają własny i zostają bez zmian)
  const blank = (): string => '';
  // (to samo z onBeforeCompile: three.js wlicza jego kod do klucza materiału, a na WebGPU go nie wywołuje)
  const noop = (): void => undefined;
  Object.defineProperty(THREE.Material.prototype, 'customProgramCacheKey', { configurable: true, get: () => blank, set: () => undefined });
  Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', { configurable: true, get: () => noop, set: () => undefined });
  // Programy karty (potoki) zawsze w tle: three.js domyślnie woła createRenderPipeline synchronicznie, a wtedy proces
  // grafiki Chrome'a — wspólny dla wszystkich kart — stoi na czas kompilacji (Michał 3.11.2026: „zawiesza całą
  // przeglądarkę przy 95%”). Z obietnicą three.js tworzy potok przez createRenderPipelineAsync i nie rysuje obiektu,
  // dopóki potok nie jest gotowy (Pipelines.isReady) — obiekt pojawia się klatkę czy dwie później, nic nie staje.
  const pipes = (r as unknown as { _pipelines: { updateForRender(ro: unknown): void; getForRender(ro: unknown, p: unknown): unknown } })._pipelines;
  const sink = { push(p: Promise<unknown>): void { gpuPendingCount++; void p.finally(() => { gpuPendingCount--; }); } };
  pipes.updateForRender = function (ro: unknown): void { this.getForRender(ro, sink); };
  // Budżet składania materiałów na klatkę: three.js składa każdy nowy wariant (i każdą pulę instancji) na procesorze,
  // ok. 12 ms sztuka. Gdy budżet tej klatki się skończył, obiekt z nowym, jeszcze niezłożonym wariantem czeka do
  // następnej klatki (pojawia się chwilę później) — gra nie staje, ani przy wczytywaniu, ani w trakcie.
  const R = r as unknown as {
    _renderObjectDirect: (...a: unknown[]) => void; _objects: { get(...a: unknown[]): unknown }; _currentRenderContext: unknown;
    _nodes: { get(ro: unknown): { nodeBuilderState?: unknown }; nodeBuilderCache: Map<unknown, unknown>; getForRenderCacheKey(ro: unknown): unknown };
  };
  const direct = R._renderObjectDirect;
  R._renderObjectDirect = function (this: typeof R, object: unknown, material: unknown, scene: unknown, camera: unknown, lightsNode: unknown, group: unknown, clipping: unknown, passId: unknown): void {
    if (buildSpent >= buildBudget) {
      const ro = this._objects.get(object, material, scene, camera, lightsNode, this._currentRenderContext, clipping, passId);
      if (this._nodes.get(ro).nodeBuilderState === undefined && !this._nodes.nodeBuilderCache.has(this._nodes.getForRenderCacheKey(ro))) { gpuDeferredCount++; return; }
    }
    const t = performance.now();
    direct.call(this, object, material, scene, camera, lightsNode, group, clipping, passId);
    const dt = performance.now() - t;
    if (dt > 1) buildSpent += dt;
  };
  const shim = r as unknown as Record<string, unknown>;
  shim.capabilities = { getMaxAnisotropy: () => 16, maxSamples: 4, isWebGL2: true };
  shim.localClippingEnabled = true;
  ready = r as unknown as THREE.WebGLRenderer;
}

/** Gotowy renderer WebGPU (null bez flagi albo gdy nie wstał — wtedy gra bierze zwykły WebGLRenderer) */
export function takeGpuRenderer(): THREE.WebGLRenderer | null { return ready; }

const hidden = new WeakSet<THREE.Material>();
/** Liczba materiałów z GLSL schowanych w tej sesji (F3: ile jeszcze do przeniesienia) */
export let gpuHiddenCount = 0;
/**
 * Materiały z własnym GLSL (`ShaderMaterial`, `RawShaderMaterial`) WebGPURenderer odrzuca — chowamy je, dopóki nie
 * dostaną bliźniaka w TSL. Wołane co jakiś czas (nowe obiekty dochodzą w trakcie gry).
 */
export function hideGlslMaterials(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const sm = m as THREE.ShaderMaterial & { isNodeMaterial?: boolean };
      if (!sm.isShaderMaterial || sm.isNodeMaterial || hidden.has(m)) continue;
      hidden.add(m);
      m.visible = false;
      gpuHiddenCount++;
    }
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const ibCache = new WeakMap<object, any>();
/**
 * Macierz instancji jako węzeł (dla własnych shaderów z obrotem do kamery, ognia, kości): cztery kolumny z bufora
 * przeplatanego nad tą samą tablicą co `instanceMatrix`, zsynchronizowanego co klatkę (jak w three.js Instance.js).
 * Atrybut wierzchołka typu mat4 nie istnieje w WebGPU — 0.92.2–0.92.7 czytały tak macierz i ognisko rozciągało się
 * w długi pas (Michał 3.11.2026).
 */
export function instanceMatrixNode(im: THREE.InstancedBufferAttribute): any {
  const { W, TSL } = gpuMods!;
  const T = TSL as any, Wm = W as any;
  let ib = ibCache.get(im);
  if (!ib) { ib = new Wm.InstancedInterleavedBuffer(im.array, 16, 1); ib.setUsage(Wm.DynamicDrawUsage); ibCache.set(im, ib); }
  const imA = im as any;
  const sync = T.uniform(0).onFrameUpdate(() => {
    if (ib.version !== imA.version) {
      ib.clearUpdateRanges(); ib.updateRanges.push(...imA.updateRanges); imA.clearUpdateRanges(); ib.version = imA.version;
    }
    return 0;
  });
  const c = [0, 4, 8, 12].map((o) => T.instancedDynamicBufferAttribute(ib, 'vec4', 16, o));
  return T.mat4(c[0], c[1], c[2], c[3].add(T.vec4(sync, sync, sync, 0)));
}

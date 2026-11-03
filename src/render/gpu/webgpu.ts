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
export let gpuMods: { W: typeof import('three/webgpu'); TSL: typeof import('three/tsl') } | null = null;
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
  gpuMods = { W, TSL };
  const r = new W.WebGPURenderer({ canvas, antialias: true, forceWebGL: FORCE_GL, powerPreference: 'high-performance' });
  await r.init();
  const backend = (r as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
  gpuBackend = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPURenderer)';
  console.info(`[webgpu] renderer gotowy: ${gpuBackend}`);
  // zgodność z miejscami, które pytają WebGLRenderer o rzeczy, których WebGPURenderer nie ma
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

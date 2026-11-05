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
// 5.11.2026: domyślnie znowu WebGL (Michał: „gra nie działa, budynki w budynkach”, 18 FPS przy 25 na WebGL) — WebGPU
// tylko z ?webgpu=1, dopóki wspólne shadery pul i liczba wywołań rysowania nie są naprawione (docs/webgpu.md)
export const GPU_MODE = !!q && !q.has('webgl') && q.has('webgpu');
const FORCE_GL = q?.get('webgpu') === 'gl';

let ready: THREE.WebGLRenderer | null = null;
/** Moduły three/webgpu i three/tsl (tylko z flagą) — bliźniaki materiałów biorą je stąd, bez statycznego importu */
export let gpuMods: { W: typeof import('three/webgpu'); TSL: typeof import('three/tsl'); FX: Record<string, unknown> } | null = null;
let buildBudget = Infinity, buildSpent = 0;
const builds: { t: number; ms: number; what: string }[] = [];
/** Składania materiałów w ostatnich 10 s: liczba, czas i najczęstsze obiekty (do dziennika błędów) */
export function gpuBuildSummary(): string {
  const now = performance.now(), last = builds.filter((b) => now - b.t < 10000);
  if (!last.length) return 'brak';
  const by = new Map<string, number>();
  for (const b of last) by.set(b.what, (by.get(b.what) ?? 0) + 1);
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ×${n}`).join(', ');
  return `${last.length} w 10 s, ${Math.round(last.reduce((a, b) => a + b.ms, 0))} ms (${top})`;
}
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
  // limity urządzenia: tyle, ile karta naprawdę ma (domyślne 16 tekstur na shader nie starcza ziemi z cieniami
  // i oświetleniem klastrowym — 0.93.0 gubiło przez to ziemię)
  let requiredLimits: Record<string, number> | undefined;
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(o?: unknown): Promise<{ limits: Record<string, number> } | null> } }).gpu;
    const ad = !FORCE_GL && gpu ? await gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
    if (ad) {
      requiredLimits = {};
      for (const k of ['maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxStorageBuffersPerShaderStage', 'maxStorageTexturesPerShaderStage',
        'maxUniformBuffersPerShaderStage', 'maxUniformBufferBindingSize', 'maxStorageBufferBindingSize', 'maxBufferSize', 'maxColorAttachmentBytesPerSample',
        'maxVertexAttributes', 'maxVertexBuffers', 'maxInterStageShaderVariables', 'maxComputeWorkgroupStorageSize']) {
        const v = ad.limits[k];
        if (typeof v === 'number') requiredLimits[k] = v;
      }
    }
  } catch { requiredLimits = undefined; }
  const r = new W.WebGPURenderer({ canvas, antialias: true, forceWebGL: FORCE_GL, powerPreference: 'high-performance', requiredLimits } as ConstructorParameters<typeof W.WebGPURenderer>[0]);
  await r.init();
  const backend = (r as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
  gpuBackend = backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (WebGPURenderer)';
  // Światła punktowe (pochodnie, ogniska, okna): oświetlenie klastrowe Forward+ liczone przez compute — kod materiału
  // nie zależy od liczby świateł (wcześniej 13 pochodni = 13 kopii kodu światła w każdym materiale i ponowne składanie
  // wszystkiego, gdy zapalała się kolejna). Bez prawdziwego WebGPU: światła w tablicach (też bez przebudowy).
  // ?swiatla=zwykle — zwykłe światła three.js (do porównań)
  // Domyślnie światła w tablicach (DynamicLighting): zmiana liczby świateł nie przebudowuje materiałów, a składanie
  // materiału jest tanie. Oświetlenie klastrowe (0.93.0) robiło każde składanie ok. 50× droższym (ok. 50 ms zamiast
  // ok. 1 ms) — gra doczytywała się wolno i przycinała (Michał 3.11.2026); zostaje do porównań pod ?swiatla=klastry.
  const lightMode = q?.get('swiatla') ?? 'tablice';
  if (lightMode !== 'zwykle') try {
    if (lightMode === 'klastry' && backend.isWebGPUBackend) {
      const { ClusteredLighting } = await import('three/examples/jsm/lighting/ClusteredLighting.js');
      (r as unknown as { lighting: unknown }).lighting = new ClusteredLighting(256);
    } else {
      const { DynamicLighting } = await import('three/examples/jsm/lighting/DynamicLighting.js');
      (r as unknown as { lighting: unknown }).lighting = new DynamicLighting({ maxPointLights: 24 });
    }
  } catch (e) { console.warn('[webgpu] oświetlenie w tablicach niedostępne', e); }
  console.info(`[webgpu] renderer gotowy: ${gpuBackend}`);
  // zgodność z miejscami, które pytają WebGLRenderer o rzeczy, których WebGPURenderer nie ma
  // Klucze programów ze starych łatek GLSL (onBeforeCompile, customProgramCacheKey: „ground-v4”, „wind-<drzewo>”…)
  // na WebGPU nic nie zmieniają, a każdy osobny klucz to osobne, drogie składanie materiału (ok. 12 ms) — wszystkie
  // zwykłe materiały dostają jeden wspólny klucz (materiały węzłowe mają własny i zostają bez zmian)
  const blank = (): string => '';
  // (to samo z onBeforeCompile: three.js wlicza jego kod do klucza materiału, a na WebGPU go nie wywołuje)
  const noop = (): void => undefined;
  // (wyjątek: materiał z węzłami dopiętymi na WebGPU — wiatr, flagi — niesie własny klucz w userData.gpuKey)
  Object.defineProperty(THREE.Material.prototype, 'customProgramCacheKey', {
    configurable: true,
    get(this: THREE.Material) { const k = this.userData?.gpuKey as string | undefined; return k ? () => k : blank; },
    set: () => undefined,
  });
  Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', { configurable: true, get: () => noop, set: () => undefined });
  // Programy karty (potoki) zawsze w tle: three.js domyślnie woła createRenderPipeline synchronicznie, a wtedy proces
  // grafiki Chrome'a — wspólny dla wszystkich kart — stoi na czas kompilacji (Michał 3.11.2026: „zawiesza całą
  // przeglądarkę przy 95%”). Z obietnicą three.js tworzy potok przez createRenderPipelineAsync i nie rysuje obiektu,
  // dopóki potok nie jest gotowy (Pipelines.isReady) — obiekt pojawia się klatkę czy dwie później, nic nie staje.
  const pipes = (r as unknown as { _pipelines: { updateForRender(ro: unknown): void; getForRender(ro: unknown, p: unknown): unknown } })._pipelines;
  const sink = { push(p: Promise<unknown>): void { gpuPendingCount++; void p.finally(() => { gpuPendingCount--; }); } };
  // Najwyżej kilka programów naraz: proces grafiki Chrome'a jest wspólny dla wszystkich kart i okien, a kompilacja
  // shadera (na Windows przez D3D) zajmuje go na dziesiątki ms — przy kilkudziesięciu naraz stawał film w innym oknie
  // (Michał 3.11.2026). Obiekt, dla którego nie starczyło miejsca, czeka klatkę (jak przy budżecie składania niżej).
  // Tylko pierwszy potok obiektu: obiekt z gotowym potokiem zawsze dostaje aktualizację.
  const MAX_PENDING = 3;
  const pd = pipes as unknown as { get(o: unknown): { pipeline?: unknown } };
  pipes.updateForRender = function (ro: unknown): void {
    // przejścia obrazu (QuadMesh: wyjście na ekran, AO, bloom, SMAA) zawsze od razu — czekając w kolejce za setkami potoków
    // sceny, zostawiały pusty ekran na długie sekundy, a przy ciągle dochodzących nowych potokach na zawsze (Michał 5.11.2026)
    if (gpuPendingCount >= MAX_PENDING && pd.get(ro).pipeline === undefined && !(ro as { object?: { isQuadMesh?: boolean } }).object?.isQuadMesh) { gpuDeferredCount++; return; }
    this.getForRender(ro, sink);
  };
  // Budżet składania materiałów na klatkę: three.js składa każdy nowy wariant (i każdą pulę instancji) na procesorze,
  // ok. 12 ms sztuka. Gdy budżet tej klatki się skończył, obiekt z nowym, jeszcze niezłożonym wariantem czeka do
  // następnej klatki (pojawia się chwilę później) — gra nie staje, ani przy wczytywaniu, ani w trakcie.
  const R = r as unknown as {
    _renderObjectDirect: (...a: unknown[]) => void; _objects: { get(...a: unknown[]): unknown }; _currentRenderContext: unknown;
    _nodes: { get(ro: unknown): { nodeBuilderState?: unknown }; nodeBuilderCache: Map<unknown, unknown>; getForRenderCacheKey(ro: unknown): unknown };
  };
  // --- Wspólne shadery pul instancji ---
  // three.js dokłada do klucza materiału numer każdej InstancedMesh (bo bufory instancji siedzą w złożonym shaderze),
  // więc każda pula — każdy kawałek lasu, każda grupa kamieni, każda pula budynków — składała się osobno, i to dla
  // obrazu, cienia i odbicia w wodzie. Kamera wjeżdżająca w nowy kawałek mapy = kilkadziesiąt składań i cienie
  // „doładowujące się” (Michał 3.11.2026). Tu: pule ze zwykłymi materiałami (bez własnych węzłów) dzielą jeden złożony
  // shader, a bufory instancji podstawiamy każdej puli jej własne przy wiązaniu atrybutów.
  const srcMat = new WeakMap<object, any>();
  const imArrays = new WeakSet<object>(), icArrays = new WeakSet<object>();
  // wszystkie pule ze zwykłymi materiałami, także z dopiętym wiatrem i porami roku (sprawdzone 3.11.2026: las, palmy
  // i kamienie na swoich miejscach, 927 pul → 48 shaderów); ?pule=1 — bez materiałów z węzłami, ?pule=0 — wyłączone
  // 4.11.2026: domyślnie WYŁĄCZONE — w grze Michała (dev 1v1, 194 budynki) wspólny shader wiązał jednej puli cudzy, za mały
  // bufor macierzy („Instance range (count 118) requires a larger buffer (4224)”), karta odrzucała każdą klatkę i ekran
  // był pusty. Włączenie na próbę: ?pule=2 (albo ?pule=1). Do naprawy przed ponownym włączeniem (docs/webgpu.md).
  // 5.11.2026 (sprawdzone w Chrome Michała na jego zapisie): ?pule=2 (także materiały z wiatrem — drzewa, pnie, cienie
  // drzew) dalej wiąże pulom za mały bufor macierzy (cień, 477 sztuk przy miejscu na 290); ?pule=1 (tylko zwykłe
  // materiały) — 0 błędów i prawie bez składania. Domyślnie 1, a wiatr wraca do 2 dopiero po naprawie (docs/webgpu.md).
  const POOLS = q?.get('pule') ?? '1';
  const sharedPool = (o: any, m: any): boolean => POOLS !== '0' && !!o?.isInstancedMesh && !o.morphTexture && !!m && !m.isNodeMaterial
    && (!m.userData?.gpuKey || POOLS === '2');
  type Sub = { ib: any; at: Map<number, any>; col?: any };
  const subs = new WeakMap<object, Sub>();
  const overSeen = new WeakSet<object>();
  const poolName = (o: any): string => { let q = o, c = ''; while (q && !c) { c = q.userData?.cat || q.name || ''; q = q.parent; } return c || o.geometry?.type || 'InstancedMesh'; };
  const subOf = (o: any): Sub => {
    let sb = subs.get(o.instanceMatrix);
    if (!sb) {
      const ib = new (THREE as any).InstancedInterleavedBuffer(o.instanceMatrix.array, 16, 1);
      ib.setUsage(THREE.DynamicDrawUsage);
      sb = { ib, at: new Map() };
      subs.set(o.instanceMatrix, sb);
    }
    return sb;
  };
  // Straż rysowania pul instancji: bufor instancji (macierze, kolory) musi pomieścić tyle sztuk, ile rysujemy. Za mały
  // bufor = WebGPU odrzuca CAŁĄ klatkę (pusty ekran, 4.11.2026). Taki obiekt pomijamy w tej klatce i raz zapisujemy
  // w dzienniku, co to było (nazwa, ile sztuk, ile miejsca w tablicy i w karcie, czy bufor jest własny obiektu).
  const bk = (r as any).backend;
  if (bk?.isWebGPUBackend && typeof bk.draw === 'function') {
    const draw0 = bk.draw.bind(bk);
    const badSeen = new WeakSet<object>();
    bk.draw = (ro: any, info: unknown): unknown => {
      const o = ro.object;
      if (o?.isInstancedMesh) {
        const n = Math.max(0, o.count | 0);
        for (const vb of ro.getVertexBuffers() as any[]) {
          if (!vb?.isInstancedInterleavedBuffer && !vb?.isInstancedBufferAttribute) continue;
          const per = vb.isInstancedInterleavedBuffer ? vb.stride : vb.itemSize;
          const gpuBuf = bk.get(vb)?.buffer as { size?: number } | undefined;
          const jsCap = Math.floor(vb.array.length / per), gpuCap = gpuBuf?.size ? Math.floor(gpuBuf.size / (per * 4)) : jsCap;
          if (Math.min(jsCap, gpuCap) < n) {
            if (!badSeen.has(o)) {
              badSeen.add(o);
              const own = vb.array === o.instanceMatrix?.array || vb.array === o.instanceColor?.array;
              console.warn(`[WebGPU] pula ${poolName(o)} (${o.geometry?.index?.count ?? '?'} ind.): ${n} sztuk, miejsca w tablicy ${jsCap}, w karcie ${gpuCap}, bufor ${own ? 'własny' : 'cudzy'}, wspólny shader ${sharedPool(o, srcMat.get(o) ?? ro.material) ? 'tak' : 'nie'} — pominięta`);
            }
            return undefined;
          }
        }
      }
      return draw0(ro, info);
    };
  }
  const anyR = r as any;
  const renderObj = anyR.renderObject.bind(anyR);
  anyR.renderObject = (object: any, scene: unknown, camera: unknown, geometry: unknown, material: any, ...rest: unknown[]): unknown => {
    if (object?.isInstancedMesh) {
      // więcej sztuk niż miejsca w buforze: WebGPU odrzuca wtedy całą klatkę (pusty ekran, zrzut Michała 4.11.2026:
      // „Instance range … requires a larger buffer”). Przycinamy i raz zapisujemy w dzienniku, która to pula.
      const cap = object.instanceMatrix.count as number;
      if (object.count > cap) {
        if (!overSeen.has(object)) { overSeen.add(object); console.warn(`[WebGPU] pula ${poolName(object)}: ${object.count} sztuk, miejsca ${cap} — przycięte`); }
        object.count = cap;
      }
      srcMat.set(object, material);
      imArrays.add(object.instanceMatrix.array);
      if (object.instanceColor) icArrays.add(object.instanceColor.array);
      // nasze bufory tej puli: ta sama wersja co jej instanceMatrix / instanceColor (jak w three.js Instance.js)
      const sb = subs.get(object.instanceMatrix);
      if (sb && sb.ib.version !== object.instanceMatrix.version) {
        sb.ib.clearUpdateRanges(); for (const u of object.instanceMatrix.updateRanges) sb.ib.addUpdateRange(u.start, u.count);
        sb.ib.version = object.instanceMatrix.version;
      }
      if (sb?.col && object.instanceColor && sb.col.version !== object.instanceColor.version) {
        sb.col.clearUpdateRanges(); for (const u of object.instanceColor.updateRanges) sb.col.addUpdateRange(u.start, u.count);
        sb.col.version = object.instanceColor.version;
      }
    }
    return renderObj(object, scene, camera, geometry, material, ...rest);
  };
  let roPatched = false;
  const objs = anyR._objects;
  const createRO = objs.createRenderObject.bind(objs);
  objs.createRenderObject = (...a: unknown[]): unknown => {
    if (!roPatched) {
      roPatched = true;
      const proto = Object.getPrototypeOf(createRO(...a));
      const gmk = proto.getMaterialCacheKey;
      proto.getMaterialCacheKey = function (this: any): unknown {
        const o = this.object;
        if (!sharedPool(o, srcMat.get(o) ?? this.material)) return gmk.call(this);
        const n = o.count;
        o.isInstancedMesh = false; o.count = 1;
        try { return `${gmk.call(this)}:pula${o.instanceColor ? 'c' : ''}`; } finally { o.isInstancedMesh = true; o.count = n; }
      };
      const gat = proto.getAttributes;
      proto.getAttributes = function (this: any): unknown {
        const list = gat.call(this) as any[];
        const o = this.object;
        if (!sharedPool(o, srcMat.get(o) ?? this.material)) return list;
        let changed = false;
        const out = list.map((a: any) => {
          const d = a.isInterleavedBufferAttribute ? a.data : null;
          if (d && d.stride === 16 && (imArrays.has(d.array) || d.isInstancedInterleavedBuffer) && d.array !== o.instanceMatrix.array) {
            const sb = subOf(o);
            let na = sb.at.get(a.offset);
            if (!na) { na = new (THREE as any).InterleavedBufferAttribute(sb.ib, a.itemSize, a.offset); sb.at.set(a.offset, na); }
            changed = true;
            return na;
          }
          if (!d && a.isInstancedBufferAttribute && a.itemSize === 3 && o.instanceColor && icArrays.has(a.array) && a.array !== o.instanceColor.array) {
            const sb = subOf(o);
            if (!sb.col) { sb.col = new THREE.InstancedBufferAttribute(o.instanceColor.array, 3); sb.col.setUsage(THREE.DynamicDrawUsage); }
            changed = true;
            return sb.col;
          }
          return a;
        });
        if (changed) {
          this.attributes = out;
          this.vertexBuffers = [...new Set(out.map((a: any) => (a.isInterleavedBufferAttribute ? a.data : a)))];
        }
        return this.attributes;
      };
      // pierwszy obiekt powstał jeszcze bez łatki — tworzymy go jeszcze raz już z nią
    }
    return createRO(...a);
  };
  const direct = R._renderObjectDirect;
  R._renderObjectDirect = function (this: typeof R, object: unknown, material: unknown, scene: unknown, camera: unknown, lightsNode: unknown, group: unknown, clipping: unknown, passId: unknown): void {
    if (buildSpent >= buildBudget && !(object as { isQuadMesh?: boolean })?.isQuadMesh) {
      const ro = this._objects.get(object, material, scene, camera, lightsNode, this._currentRenderContext, clipping, passId);
      if (this._nodes.get(ro).nodeBuilderState === undefined && !this._nodes.nodeBuilderCache.has(this._nodes.getForRenderCacheKey(ro))) { gpuDeferredCount++; return; }
    }
    direct.call(this, object, material, scene, camera, lightsNode, group, clipping, passId);
  };
  // do budżetu liczy się tylko samo składanie materiału (wcześniej całe rysowanie obiektu — budżet zjadało zwykłe
  // rysowanie i nowe obiekty dochodziły po kilka na klatkę, przez co przygotowanie grafiki trwało 12 s)
  const nodes = R._nodes as unknown as { _createNodeBuilder(ro: unknown, m: unknown): { build(): unknown } };
  const create = nodes._createNodeBuilder.bind(nodes);
  nodes._createNodeBuilder = (ro: unknown, m: unknown) => {
    const b = create(ro, m);
    // Pule instancji zawsze z macierzami w atrybucie wierzchołków, nigdy w tablicy uniformów: three.js przy małej puli
    // (do ok. 1000 sztuk) wpisuje macierze w tablicę nazwaną numerem węzła i z jej długością — każda pula dostaje wtedy
    // własny kod shadera, a każdy kod to osobna kompilacja w karcie (zrzut 3.11.2026: 374 programy wierzchołków,
    // z czego 104 różniły się tylko nazwą tablicy). Z atrybutem kod jest wspólny dla wszystkich pul tego materiału.
    if ((ro as { object?: { isInstancedMesh?: boolean } }).object?.isInstancedMesh) (b as unknown as { getUniformBufferLimit(): number }).getUniformBufferLimit = () => 0;
    const build = b.build.bind(b);
    b.build = () => {
      const t = performance.now();
      try { return build(); } finally {
        const dt = performance.now() - t;
        buildSpent += dt;
        // do dziennika: co i jak często się składa (składanie w kółko = spadek FPS)
        const r = ro as { object: THREE.Object3D; material: THREE.Material & { isShadowPassMaterial?: boolean } };
        let o: THREE.Object3D | null = r.object, cat = '';
        while (o && !cat) { cat = (o.userData?.cat as string | undefined) ?? ''; o = o.parent; }
        builds.push({ t, ms: dt, what: `${cat || r.object.name || r.object.type}${r.material.isShadowPassMaterial ? ' (cień)' : ''}` });
        if (builds.length > 400) builds.splice(0, builds.length - 400);
      }
    };
    return b;
  };
  // Obiekt odłożony przez budżet (wyżej) ma już RenderObject, ale jeszcze nie ma założonych grup wiązań (three.js
  // zakłada je dopiero przy pierwszym rysowaniu i liczy użycia wspólnych grup). Gdy taki obiekt znikał, zanim się
  // narysował, three.js i tak odejmował użycie — wspólny bufor uniformów schodził do zera i był niszczony, choć
  // rysowały go inne obiekty: „used in submit while destroyed”, efekty obrazu padały i zostawał mleczny ekran
  // (Michał 3.11.2026, dziennik po 440 s gry). Niezałożonych wiązań nie zwalniamy.
  const bnd = (r as unknown as { _bindings: { get(o: unknown): { initialized?: boolean }; delete(o: unknown): void; deleteForRender(ro: unknown): void } })._bindings;
  const delForRender = bnd.deleteForRender.bind(bnd);
  bnd.deleteForRender = (ro: unknown): void => { if (bnd.get(ro).initialized === true) delForRender(ro); else bnd.delete(ro); };
  (window as unknown as { __gpuStat: () => unknown }).__gpuStat = () => ({ deferred: gpuDeferredCount, pending: gpuPendingCount, spent: buildSpent });
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
    // kształty (morph) z plików modeli bez wag na obiekcie: WebGPU składa wtedy shader z pustą tablicą wag i wywraca
    // całe przejście obrazu (Michał 3.11.2026, gra deweloperska); gra kształtów nie używa — zdejmujemy je
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (g && Object.keys(g.morphAttributes).length && !(o as THREE.Mesh).morphTargetInfluences) g.morphAttributes = {};
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

// Spis wywołań rysowania jednej klatki według kategorii (budynki, las, ludzie…) — do szukania, co idzie do karty osobno.
//   node tools/check/drawcalls.mjs [--url=…] [--build=N] [--ticks=N]
// Bez --url: lokalny build (dist/). Tryb testowy w pełnej grafice (?test=1&hd=1), gracz dostaje surowce i stawia po kilka
// budynków każdego rodzaju, symulacja idzie N kroków, potem jedna klatka jest liczona wywołanie po wywołaniu.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
let base = arg('url', null), srv = null;
if (!base) { srv = await preview({ preview: { port: 4199 }, logLevel: 'silent' }); base = srv.resolvedUrls.local[0]; }
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(base + '?test=1&hd=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.__test && window.__renderer, null, { timeout: 280000 });
const res = await p.evaluate(async ([perType, ticks]) => {
  const T = window.__test, R = window.__renderer;
  T.give(99999);
  const ids = ['house', 'woodcutter', 'quarry', 'farm', 'mill', 'bakery', 'well', 'granary', 'storehouse', 'barracks', 'tavern', 'smith', 'tower', 'chapel', 'market', 'stable', 'archery', 'tanner'];
  for (let k = 0; k < perType; k++) for (const id of ids) { T.give(99999); T.build(id); }
  T.run(ticks);
  const g = T.state ? T.state() : null;
  const keep = window.__renderer.state.buildings.find((x) => x.type === 0 && x.owner === 0);
  T.at(keep.x + 5, keep.y + 8, 30);
  await new Promise((r) => setTimeout(r, 25000));
  const gl = R.renderer;
  const orig = gl.renderBufferDirect.bind(gl);
  const by = new Map();
  const cat = (o) => {
    const names = [];
    for (let q = o; q; q = q.parent) { if (q.userData?.cat) return q.userData.cat + (names.length ? ' / ' + names.reverse().join('/') : ''); if (q.name) names.push(q.name); }
    return 'inne' + (names.length ? ' / ' + names.reverse().join('/') : '');
  };
  let shadowCalls = 0, mainCalls = 0;
  gl.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const shadow = !!camera.isOrthographicCamera && camera !== R.cam?.camera;
    if (object.isInstancedMesh && object.count === 0) zero++;
    const k = (shadow ? '[cień] ' : '') + cat(object) + (object.isInstancedMesh ? ' (inst.)' : '') + (object.isBatchedMesh ? ' (batch)' : '');
    by.set(k, (by.get(k) ?? 0) + 1);
    if (shadow) shadowCalls++; else mainCalls++;
    return orig(camera, scene, geometry, material, object, group);
  };
  // jedna pełna klatka: liczymy od początku do końca jednego wywołania render() kamery gracza
  let frames = 0;
  const render = gl.render.bind(gl);
  let capture = false, done = false;
  const passes = [];
  gl.render = function (scene, camera) {
    if (!done && camera === R.cam?.camera && !scene.overrideMaterial && new Error().stack.includes('.frame')) { if (capture && passes.length) { done = true; } else if (!capture) { capture = true; by.clear(); shadowCalls = 0; mainCalls = 0; } }
    const before = gl.info.render.calls, auto = gl.info.autoReset;
    const t = performance.now();
    const r = render(scene, camera);
    if (capture && !done) passes.push(`${scene.type}${scene.name ? ':' + scene.name : ''} kamera:${camera.type}${camera.name ? ':' + camera.name : ''} cel:${gl.getRenderTarget() ? 'RT' : 'ekran'} wyw:${gl.info.render.calls - before} zero-inst:${zero} override:${scene.overrideMaterial?.type ?? '-'} ${scene.isScene ? (new Error().stack.split('\n').slice(2, 6).map((l) => l.trim().replace(/https?:\/\/[^/]+\/assets\//, '')).join(' < ')) : ''}`);
    return r;
  };
  let zero = 0;
  const wrapped = gl.renderBufferDirect;
  gl.renderBufferDirect = function (...a) { if (capture && !done) return wrapped.apply(this, a); return orig(...a); };
  const t0 = performance.now();
  while (!done && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 200));
  gl.render = render;
  gl.renderBufferDirect = orig;
  return { passes, zero, calls: gl.info.render.calls, mainCalls, shadowCalls, buildings: window.__renderer.state.buildings.length, top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 40) };
}, [+arg('build', 3), +arg('ticks', 3000)]);
console.log(res.passes.join('\n')); console.log('wywołania instancji z zerową liczbą sztuk:', res.zero);
console.log(`budynki: ${res.buildings} · wywołań (main/cień): ${res.mainCalls}/${res.shadowCalls} · info.calls ${res.calls}`);
for (const [k, n] of res.top) console.log(String(n).padStart(5), k);
await b.close(); await srv?.close();

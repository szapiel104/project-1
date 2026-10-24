/**
 * Spis sceny 3D przed i po przebudowie kodu rysowania (np. podział src/render/scene.ts na mniejsze pliki).
 * Otwiera zbudowaną grę w Chromium bez okna, ustawia stały scenariusz (mapa 2 na 2, osada, wojsko, bitwa, dzień i noc,
 * zatrzymany czas) i zapisuje spis sceny (src/debug/census.ts) do pliku JSON. Dwa spisy porównuje `--compare`.
 *
 *   node tools/check/census.mjs --dist=dist --out=/tmp/a.json
 *   node tools/check/census.mjs --compare=/tmp/a.json,/tmp/b.json [--struct]
 *   --spacer: dodatkowo ujęcie ze spaceru oczami chłopa; --lite: uboga grafika testowa (spacer w pełnej grafice
 *   bez karty graficznej trwa za długo, więc spacer sprawdzaj z --lite --spacer)
 *
 * Najpierw puść ten sam build dwa razy: różnice między nimi to rzeczy losowe (iskry, dym) — szum, który wolno pominąć.
 */
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (name, def) => {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

const cmp = arg('compare', '');
if (cmp) {
  const [fa, fb] = String(cmp).split(',');
  const A = JSON.parse(readFileSync(fa, 'utf8')), B = JSON.parse(readFileSync(fb, 'utf8'));
  // --struct: tylko budowa sceny (rodzaj, nazwa, widoczność, siatka, materiał, liczba kopii), bez położeń —
  // położenia ludzi i zwierząt w klatce różnią się nawet między dwoma uruchomieniami tego samego buildu
  const struct = !!arg('struct', false);
  const norm = (s) => (struct ? s.split(' ').filter((t) => !/^(W|IM|IC|Li)/.test(t)).join(' ') : s);
  for (const k of Object.keys(A)) if (A[k]?.items) { A[k].items = A[k].items.map(norm); B[k].items = B[k].items.map(norm); }
  const skip = new Set();
  let diffs = 0;
  const allNoise = [];
  for (const k of Object.keys(A)) {
    if (k === 'perf') continue;
    const ca = new Map(), cb = new Map();
    for (const s of A[k].items) ca.set(s, (ca.get(s) ?? 0) + 1);
    for (const s of B[k].items) cb.set(s, (cb.get(s) ?? 0) + 1);
    const only = (x, y) => [...x].flatMap(([s, n]) => Array(Math.max(0, n - (y.get(s) ?? 0))).fill(s));
    const a = only(ca, cb).filter((s) => !skip.has(s.split(' ').slice(0, 2).join(' ')));
    const b = only(cb, ca).filter((s) => !skip.has(s.split(' ').slice(0, 2).join(' ')));
    for (const s of [...only(ca, cb), ...only(cb, ca)]) allNoise.push(s.split(' ').slice(0, 2).join(' '));
    console.log(`\n== ${k}: ${A[k].items.length} / ${B[k].items.length} obiektów, różnic: ${a.length} + ${b.length}`);
    for (const s of a.slice(0, 25)) console.log(`  - ${s.slice(0, 260)}`);
    for (const s of b.slice(0, 25)) console.log(`  + ${s.slice(0, 260)}`);
    diffs += a.length + b.length;
  }
  const out = arg('noise-out', '');
  if (out) writeFileSync(out, JSON.stringify([...new Set(allNoise)]));
  console.log(diffs ? `\n✖ różnice: ${diffs}` : '\n✓ spisy takie same');
  process.exit(diffs ? 1 : 0);
}

const dist = String(arg('dist', 'dist'));
const outFile = String(arg('out', 'census.json'));
const server = await preview({ build: { outDir: dist }, preview: { port: 4190, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 260 } });
const t0 = Date.now();
const say = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${m}`);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// stałe ustawienia grafiki: bez automatu jakości (w SwiftShader schodziłby z jakością w różnych chwilach)
await page.addInitScript(() => {
  localStorage.setItem('project1.settings', JSON.stringify({ auto: false, ao: 'off', shadows: 512, scale: 0.5, grass: 1, dayNight: true, reflections: false, aa: 'off', dynRes: false, lang: 'pl' }));
  localStorage.setItem('project1.lang', 'pl');
});
const LITE = !!arg('lite', false);
await page.goto(`${base}?test=1${LITE ? '' : '&hd=1'}#2v2/census`, { waitUntil: 'load', timeout: 120000 });
say('strona wczytana');
await page.waitForFunction(() => !!window.__test && !!window.__renderer, null, { timeout: 600000 });
say('gra gotowa');
const out = {};
const settle = (ms) => page.waitForTimeout(ms);
/** Zatrzymany czas obrazu: ten sam zegar animacji w obu buildach */
const freeze = () => page.evaluate(() => { window.__test.speed(0); window.__renderer.time = 100; });
await page.evaluate(() => {
  const T = window.__test;
  T.speed(0);
  T.give(800);
  for (const id of ['house', 'house', 'woodcutter', 'farm', 'barracks', 'armory', 'poleturner', 'fletcher', 'stockpile', 'tavern', 'shrine', 'mageHut', 'bakery', 'mill']) T.build(id);
  T.run(3000);
  T.give(400);
  T.train(6);
  T.run(400);
  T.enemy(5);
  T.run(60);
  T.hour(12);
  const h = T.home();
  T.at(h.x, h.y + 6, 26);
});
say('scenariusz gotowy');
// budynki łączą się we wspólne siatki i dalekie wersje (LOD) w tle, przez kilka klatek — czekamy, aż skończą
await settle(20000);
for (const [name, hour] of [['dzien', 12], ['noc', 20.5]]) {
  await page.evaluate((hh) => window.__test.hour(hh), hour);
  say(`godzina ${hour}`);
  await freeze();
  say('zatrzymany czas');
  await settle(6000);
  await freeze();
  await settle(3000);
  out[name] = await page.evaluate(() => window.__test.census());
  if (arg('dump', '')) out[name + '_dump'] = { items: await page.evaluate((c) => {
    // surowe macierze kopii dla jednej grupy (np. „postacie: strażnicy”) — do szukania, skąd różnica
    const res = []; const sc = window.__renderer.scene;
    sc.traverse((o) => { let t = ''; for (let p = o; p && !t; p = p.parent) t = p.userData.cat ?? ''; if (t === c && o.isInstancedMesh) res.push(JSON.stringify({ g: o.geometry.getAttribute('position').count, n: o.count, m: Array.from(o.instanceMatrix.array.slice(0, o.count * 16)).map((v) => Math.round(v * 1000) / 1000) })); });
    return res;
  }, String(arg('dump', ''))), kinds: {} };
  say(`spis ${name}`);
}
// z bliska, przy ludziach (inne poziomy szczegółów, trawa, cienie)
await page.evaluate(() => { const h = window.__test.home(); window.__test.at(h.x, h.y + 3, 9); window.__test.hour(9); });
await freeze(); await settle(15000); await freeze(); await settle(5000);
out.blisko = await page.evaluate(() => window.__test.census());
say('spis blisko');
if (arg('spacer', false)) {
// spacer oczami chłopa przed bramą (modele do chodzenia, wnętrza widoczne przez drzwi, pochodnia)
await page.evaluate(() => { const h = window.__test.home(); window.__renderer.startWalk(h.x + 0.5, h.y + 2.5, 0); window.__test.hour(21); }).catch((e) => say(`spacer: ${e.message}`));
say('spacer rozpoczęty');
await freeze(); await settle(12000); await freeze(); await settle(4000);
out.spacer = await page.evaluate(() => window.__test.census());
say('spis spacer');
}
out.perf = await page.evaluate(() => window.__perf?.() ?? null);
out.errors = { items: errors.map((e) => `pageerror ${e}`), kinds: {} };
const log = await page.evaluate(() => window.__errors?.() ?? null);
if (log) out.errors.items.push(...log.items.filter((e) => e.level === 'error').map((e) => `errlog ${e.kind} ${e.msg}`));
writeFileSync(outFile, JSON.stringify(out));
console.log(`zapisano ${outFile}: ${Object.entries(out).filter(([k]) => k !== 'perf').map(([k, v]) => `${k} ${v.items.length}`).join(', ')}`);
if (out.errors.items.length) console.log('błędy:\n  ' + out.errors.items.join('\n  '));
await browser.close();
await server.close();

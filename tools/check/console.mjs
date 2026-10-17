/**
 * Przegląd konsoli gry: otwiera grę w Chromium (bez okna), chwilę gra i wypisuje dziennik błędów
 * (src/debug/errlog.ts → window.__errors()) oraz wszystko, co poszło do konsoli przeglądarki.
 *
 *   npm run check:console                     — zbudowana gra (dist/), strony domyślne
 *   npm run check:console -- --url=https://szapiel104.github.io/project-1/   — wdrożona wersja
 *   npm run check:console -- --pages="?test=1&pusta=1,modele.html?id=keep" --wait=15
 *   npm run check:console -- --hd             — dodaje ?test=1&hd=1 (pełna grafika, bez karty graficznej bardzo wolno)
 *
 * Kod wyjścia 1, gdy w dzienniku jest choć jeden błąd (ostrzeżenia tylko wypisuje).
 * Przeglądarka: Chromium z Playwright (PLAYWRIGHT_BROWSERS_PATH) albo CHROME=/ścieżka/do/chrome.
 * Grafika bez karty graficznej idzie przez SwiftShader, więc FPS tu nic nie znaczy — liczą się błędy.
 */
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const arg = (name, def) => {
  const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};
const WAIT = Number(arg('wait', 12)) * 1000;
let pages = String(arg('pages', '?test=1,?test=1&pusta=1,modele.html?id=keep')).split(',').filter(Boolean);
if (arg('hd', false)) pages.push('?test=1&hd=1');
/** Zewnętrzne pliki, których brak w piaskownicy bez internetu nie jest błędem gry */
const OFFLINE = /fonts\.(googleapis|gstatic)\.com/;

let server = null;
let base = arg('url', '');
if (!base) {
  server = await preview({ preview: { port: 4179, strictPort: false }, logLevel: 'silent' });
  base = server.resolvedUrls.local[0];
}
if (!base.endsWith('/')) base += '/';

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failed = 0;
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const raw = new Map();
  const add = (s) => { s = s.slice(0, 400); raw.set(s, (raw.get(s) ?? 0) + 1); };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') add(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => add(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => { if (!OFFLINE.test(r.url())) add(`[nie wczytano] ${r.url()} ${r.failure()?.errorText ?? ''}`); });
  page.on('response', (r) => { if (r.status() >= 400) add(`[http ${r.status()}] ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(base + p, { waitUntil: 'load', timeout: 60000 }).catch((e) => add(`[otwieranie] ${e.message}`));
  // gra gotowa: tryb testowy wystawia __test, podgląd modeli __view; potem chwila zwykłego działania
  await page.waitForFunction(() => !!(window.__test || window.__view), null, { timeout: 90000 }).catch(() => add('[czekanie] gra nie wystartowała w 90 s'));
  if (p.includes('test=1')) await page.evaluate(() => window.__test?.run?.(900)).catch((e) => add(`[__test.run] ${e.message}`));
  await page.waitForTimeout(WAIT);
  const log = await page.evaluate(() => window.__errors?.() ?? null).catch(() => null);
  const perf = await page.evaluate(() => window.__perf?.() ?? null).catch(() => null);
  const errs = log ? log.errors : -1;
  console.log(`\n=== ${p}  (${((Date.now() - t0) / 1000).toFixed(0)} s, build ${log?.build ?? '?'})`);
  if (!log) { console.log('  ✖ brak window.__errors — dziennik się nie wczytał'); failed++; }
  else {
    console.log(`  dziennik: ${log.errors} błędów, ${log.warnings} ostrzeżeń${perf ? `, wywołań rysowania ${perf['wywołania rysowania'] ?? '—'}, trójkątów ${perf['trójkąty'] ?? '—'}` : ''}`);
    for (const e of log.items) {
      if (OFFLINE.test(e.msg)) continue;
      console.log(`  ${e.level === 'error' ? '✖' : '!'} [${e.kind}] ×${e.count} @${e.first}s ${e.msg}`);
      if (e.stack && e.level === 'error') console.log('      ' + e.stack.split('\n').slice(1, 4).map((l) => l.trim()).join('\n      '));
    }
    const real = log.items.filter((e) => e.level === 'error' && !OFFLINE.test(e.msg)).length;
    if (real) failed++;
    if (errs >= 0 && log.previous) console.log(`  (poprzednie wejście miało ${log.previous.items.length} wpisów)`);
  }
  // to, co dziennik mógł przegapić (np. błąd zanim się wczytał)
  const extra = [...raw].filter(([s]) => !OFFLINE.test(s) && !s.includes('ERR_TUNNEL_CONNECTION_FAILED') && !log?.items.some((e) => s.includes(e.msg.slice(0, 60))));
  if (extra.length) { console.log('  konsola przeglądarki (poza dziennikiem):'); for (const [s, n] of extra) console.log(`    ${n > 1 ? `×${n} ` : ''}${s}`); }
  await page.close();
}
await browser.close();
await server?.close();
console.log(failed ? `\n✖ błędy na ${failed} z ${pages.length} stron` : `\n✓ bez błędów na ${pages.length} stronach`);
process.exit(failed ? 1 : 0);

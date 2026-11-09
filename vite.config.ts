import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// @ts-expect-error — wtyczka w czystym JS (tools/models/vite-plugin.mjs): modele jadą do gry spakowane
import { modelPacks } from './tools/models/vite-plugin.mjs';
// @ts-expect-error — wtyczka w czystym JS: kod gry pobiera się razem ze stroną (tools/build/preload-main.mjs)
import { preloadMain } from './tools/build/preload-main.mjs';
import pkg from './package.json' with { type: 'json' };
// @ts-expect-error — typy Node nie są w tsconfig gry (to plik konfiguracji, wykonuje go Node)
import { createHash } from 'node:crypto';
// @ts-expect-error — jak wyżej
import { readFileSync, readdirSync, statSync } from 'node:fs';

/**
 * Odcisk wszystkiego, co zmienia wygląd miniatur budynków w menu budowy (modele, rysowanie miniatur, dane budynków, tekstury).
 * Miniatury z pamięci przeglądarki żyją, dopóki ten odcisk się nie zmieni — a nie przy każdej wersji gry (Michał 7.11.2026:
 * „długo trwa wczytywanie budynków”: po każdym wdrożeniu menu budowy świeciło pustymi kartami, aż miniatury narysowały się od nowa).
 */
// (odcisk liczony przy starcie serwera; zmiana tego pliku restartuje `npx vite`, więc miniatury przeliczają się od nowa)
function thumbsKey(): string {
  const h = createHash('sha1');
  const add = (f: string): void => { try { h.update(f); h.update(readFileSync(f)); } catch { /* brak pliku: pomijamy */ } };
  for (const f of ['src/render/thumbnails.ts', 'src/data/buildings.ts', 'src/render/textures.ts']) add(f);
  for (const d of ['src/render/models']) { try { for (const f of readdirSync(d).sort()) add(`${d}/${f}`); } catch { /* nic */ } }
  for (const d of ['public/textures/cc0', 'public/textures/terrain']) { try { for (const f of readdirSync(d).sort()) { const st = statSync(`${d}/${f}`); h.update(`${f}:${st.size}`); } } catch { /* nic */ } }
  return h.digest('hex').slice(0, 12);
}

const BUILD = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** Wersja na ekranie wczytywania już w samym HTML (widać ją, zanim wczyta się kod gry) — Michał 28.10.2026 */
const versionInHtml = { name: 'version-in-html', transformIndexHtml: (html: string) => html.replaceAll('%GAME_VERSION%', `${pkg.version} · ${BUILD}`) };
/** version.json obok gry: menu porównuje go ze swoją wersją i podpowiada odświeżenie (src/ui/refresh.ts) */
const versionFile = { name: 'version-file', generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD }) }); } };

/**
 * Lokalnie (npx vite) zmiana kodu NIE przeładowuje gry (Michał 9.11.2026: „push resetuje mi grę, a ja testuję”).
 * Style (.css) wchodzą na żywo, bez resetu; po zmianie TS/danych gra stoi dalej i pokazuje znaczek „Nowy kod gotowy — F5”.
 */
const noAutoReload = {
  name: 'no-auto-reload',
  apply: 'serve' as const,
  handleHotUpdate(ctx: { file: string; server: { ws: { send: (p: unknown) => void } } }): unknown[] | undefined {
    if (/\.css$/.test(ctx.file)) return undefined;
    ctx.server.ws.send({ type: 'custom', event: 'p1:stale', data: {} });
    return [];
  },
};

export default defineConfig(({ mode }) => ({
  base: './',
  // godzina zbudowania trafia do gry, żeby było widać, czy przeglądarka pokazuje najnowszą wersję
  // numer wersji z package.json trafia do dziennika błędów (po nim wiadomo, który kod i które mapy źródeł wziąć)
  define: { __VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(BUILD), __THUMBS__: JSON.stringify(thumbsKey()) },
  // długie symulacje (bot, 10 000 ticków) potrzebują więcej czasu niż domyślne 5 s
  test: { testTimeout: 60000, setupFiles: ['tests/setup/lang.ts', 'tests/setup/models.ts'] },
  plugins: mode === 'single' ? [versionInHtml, modelPacks(true), viteSingleFile()] : [versionInHtml, versionFile, modelPacks(false), preloadMain(), noAutoReload],
  // lokalnie: zgoda na próbkowanie JS z samej strony (window.__prof w src/debug/prof.ts — gdzie ucieka czas klatki)
  server: { headers: { 'Document-Policy': 'js-profiling' } },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 1200,
    // mapy źródeł obok plików (bez odnośnika w kodzie); na stronę nie trafiają — wdrożenie przenosi je do artefaktu
    // „sourcemaps” w GitHub Actions. Błąd z dziennika z pozycją w main-XXXX.js tłumaczy na plik i linię tools/check/stack.mjs
    sourcemap: mode === 'single' ? false : 'hidden',
    // druga strona: podgląd modeli (modele.html) — wdrażany razem z grą
    ...(mode === 'single' ? {} : { rollupOptions: { input: { main: 'index.html', modele: 'modele.html' } } }),
  },
}));

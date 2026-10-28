import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// @ts-expect-error — wtyczka w czystym JS (tools/models/vite-plugin.mjs): modele jadą do gry spakowane
import { modelPacks } from './tools/models/vite-plugin.mjs';
// @ts-expect-error — wtyczka w czystym JS: kod gry pobiera się razem ze stroną (tools/build/preload-main.mjs)
import { preloadMain } from './tools/build/preload-main.mjs';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  base: './',
  // godzina zbudowania trafia do gry, żeby było widać, czy przeglądarka pokazuje najnowszą wersję
  // numer wersji z package.json trafia do dziennika błędów (po nim wiadomo, który kod i które mapy źródeł wziąć)
  define: { __VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) },
  // długie symulacje (bot, 10 000 ticków) potrzebują więcej czasu niż domyślne 5 s
  test: { testTimeout: 60000, setupFiles: ['tests/setup/lang.ts', 'tests/setup/models.ts'] },
  plugins: mode === 'single' ? [modelPacks(true), viteSingleFile()] : [modelPacks(false), preloadMain()],
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

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' = ścieżki względne, więc ten sam build działa na GitHub Pages,
// Cloudflare Pages i pod własną domeną bez zmian.
export default defineConfig(({ mode }) => ({
  base: './',
  // godzina zbudowania trafia do gry, żeby było widać, czy przeglądarka pokazuje najnowszą wersję
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) },
  // długie symulacje (bot, 10 000 ticków) potrzebują więcej czasu niż domyślne 5 s
  test: { testTimeout: 60000 },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 1200,
  },
}));

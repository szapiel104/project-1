// Wtyczka Vite: modele z Blendera spakowane do .bin (opis niżej). Używa jej vite.config.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packModel } from './pack.mjs';

/**
 * Modele z Blendera jadą do gry spakowane (bezstratnie, ok. 44% mniej do pobrania): moduł `virtual:model-packs`
 * daje mapę nazwa → adres pliku .bin. Przy budowaniu każdy src/render/models/<nazwa>.json staje się
 * assets/<nazwa>-<hash>.bin (w wersji jednoplikowej: data:), a `npx vite` pakuje pliki na żądanie pod /@mpack/.
 * Format i kodek: tools/models/pack.mjs, rozpakowanie: src/render/modelpack.ts.
 */
export function modelPacks(inline) {
  const dir = fileURLToPath(new URL('../../src/render/models', import.meta.url));
  const ID = '\0virtual:model-packs';
  let serve = false;
  const cache = new Map();
  const names = () => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  async function packed(name) {
    const file = resolve(dir, name + '.json'), mtime = statSync(file).mtimeMs;
    const hit = cache.get(name);
    if (hit && hit.mtime === mtime) return hit.bin;
    const bin = await packModel(readFileSync(file, 'utf8'));
    cache.set(name, { mtime, bin });
    return bin;
  }
  return {
    name: 'model-packs',
    configResolved(c) { serve = c.command === 'serve'; },
    resolveId(id) { return id === 'virtual:model-packs' ? ID : null; },
    async load(id) {
      if (id !== ID) return null;
      this.addWatchFile(dir);
      const rows = [];
      for (const name of names()) {
        this.addWatchFile(resolve(dir, name + '.json'));
        let url;
        if (serve) url = JSON.stringify(`/@mpack/${name}.bin`);
        else if (inline) url = JSON.stringify('data:application/octet-stream;base64,' + (await packed(name)).toString('base64'));
        else url = `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'asset', name: name + '.bin', source: await packed(name) })}`;
        rows.push(`  ${JSON.stringify(name)}: ${url},`);
      }
      return `export default {\n${rows.join('\n')}\n};\n`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/@mpack\/([\w-]+)\.bin(?:\?|$)/.exec(req.url ?? '');
        if (!m || !names().includes(m[1])) { next(); return; }
        packed(m[1]).then((bin) => { res.setHeader('Content-Type', 'application/octet-stream'); res.setHeader('Cache-Control', 'no-cache'); res.end(bin); }, next);
      });
    },
  };
}

// base './' = ścieżki względne, więc ten sam build działa na GitHub Pages,
// Cloudflare Pages i pod własną domeną bez zmian.

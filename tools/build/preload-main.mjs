// Wtyczka Vite: kod gry (src/main.ts z bibliotekami) zaczyna się pobierać razem ze stroną.
//
// boot.ts wczytuje główny kod gry dynamicznie (`import('./main')`) dopiero po teksturach i modelach, więc ok. 2 MB
// JavaScriptu szło przez sieć na samym końcu, po kolei za resztą. Ta wtyczka dopisuje do index.html
// <link rel="modulepreload"> dla tego kawałka i wszystkiego, co on importuje: przeglądarka pobiera i przygotowuje
// kod w tle od pierwszej chwili, a uruchamia go dopiero, gdy boot.ts zrobi import (kolejność wczytywania bez zmian).
export function preloadMain(entry = '/src/main.ts') {
  return {
    name: 'preload-main',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.filename.endsWith('index.html')) return;
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk');
        const main = chunks.find((c) => c.facadeModuleId?.replaceAll('\\', '/').endsWith(entry));
        if (!main) return;
        const byName = new Map(chunks.map((c) => [c.fileName, c]));
        const files = new Set();
        const add = (name) => {
          if (files.has(name)) return;
          files.add(name);
          for (const dep of byName.get(name)?.imports ?? []) add(dep);
        };
        add(main.fileName);
        // pliki, które Vite już sam podpiął (kod startowy), pomijamy
        return [...files].filter((f) => !html.includes(`/${f}"`)).map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: './' + f }, injectTo: 'head' }));
      },
    },
  };
}

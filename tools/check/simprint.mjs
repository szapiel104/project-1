// Odcisk symulacji do przebudów bez zmiany zachowania gry (np. szybsze szukanie wrogów, kubełki, podział plików).
//   node tools/check/simprint.mjs          → dla kilku długich gier z botami (1v1, 2v2, 4v4) skrót stanu i czas
// Uruchom PRZED zmianą (np. na czystym `git stash`) i PO niej: skróty muszą wyjść identyczne, czas pokazuje zysk.
// Skrót liczony z pełnego zapisu gry (serialize), więc wyłapie każdą różnicę w ruchach, ekonomii czy walce.
import { build } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = mkdtempSync(join(tmpdir(), 'simprint-'));
await build({ configFile: false, logLevel: 'silent', publicDir: false, build: { ssr: 'tools/check/simprint.ts', outDir: out, minify: false, rollupOptions: { output: { entryFileNames: 'run.mjs' } } } });
await import(pathToFileURL(join(out, 'run.mjs')).href);
rmSync(out, { recursive: true, force: true });

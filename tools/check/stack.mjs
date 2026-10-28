// Tłumaczy dziennik błędów skopiowany z gry (F3 → „Kopiuj dziennik błędów”) na miejsca w kodzie źródłowym.
//
//   node tools/check/stack.mjs dziennik.txt      (albo: node tools/check/stack.mjs < dziennik.txt)
//
// Stos wywołań z gry wskazuje na zbudowane pliki (np. main-DdiuuIab.js:1:483920). Mapy źródeł nie są publikowane
// na stronie: build robi je obok plików (`sourcemap: 'hidden'`), a wdrożenie odkłada je jako artefakt „sourcemaps”
// przebiegu GitHub Actions (30 dni). Narzędzie szuka mapy w lokalnym `dist/` (ta sama nazwa z hashem = ten sam kod),
// potem w pobranych już artefaktach, a na końcu ściąga artefakty ostatnich wdrożeń przez `gh` (dostęp do repozytorium).
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SourceMapConsumer } from 'source-map-js';

const REPO = 'szapiel104/project-1';
const CACHE = join(tmpdir(), 'project1-sourcemaps');
const input = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
const RE = /([\w.-]+-[\w-]{6,}\.js):(\d+):(\d+)/g;

/** Szuka pliku `name` w katalogu (rekurencyjnie) */
function findIn(dir, name) {
  if (!existsSync(dir)) return null;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const r = findIn(p, name); if (r) return r; } else if (e.name === name) return p;
  }
  return null;
}
let fetched = false;
/** Ściąga artefakty „sourcemaps” z ostatnich udanych przebiegów na main (raz na uruchomienie) */
function fetchArtifacts() {
  if (fetched) return;
  fetched = true;
  try {
    const runs = JSON.parse(execFileSync('gh', ['api', `repos/${REPO}/actions/runs?branch=main&status=success&per_page=8`], { encoding: 'utf8' })).workflow_runs ?? [];
    for (const r of runs) {
      const dir = join(CACHE, String(r.id));
      if (existsSync(dir)) continue;
      mkdirSync(dir, { recursive: true });
      try { execFileSync('gh', ['run', 'download', String(r.id), '-R', REPO, '-n', 'sourcemaps', '-D', dir], { stdio: 'ignore' }); } catch { /* przebieg bez map (sprzed 0.54.8) */ }
    }
  } catch (e) { console.error('Nie udało się pobrać artefaktów przez gh:', e.message); }
}

const maps = new Map();
function mapFor(file) {
  if (maps.has(file)) return maps.get(file);
  const name = file + '.map';
  let path = existsSync(`dist/assets/${name}`) ? `dist/assets/${name}` : findIn(CACHE, name);
  if (!path) { fetchArtifacts(); path = findIn(CACHE, name); }
  const c = path ? new SourceMapConsumer(JSON.parse(readFileSync(path, 'utf8'))) : null;
  maps.set(file, c);
  return c;
}

const out = [];
for (const line of input.split('\n')) {
  const found = [...line.matchAll(RE)];
  if (!found.length) { out.push(line); continue; }
  const notes = [];
  for (const [, file, l, col] of found) {
    const c = mapFor(file);
    if (!c) { notes.push(`${file}: brak mapy źródeł (build sprzed 0.54.8 albo starszy niż 8 ostatnich wdrożeń)`); continue; }
    const p = c.originalPositionFor({ line: +l, column: +col - 1 });
    notes.push(p.source ? `${p.source.replace(/^(\.\.\/)+/, '')}:${p.line}:${(p.column ?? 0) + 1}${p.name ? ` (${p.name})` : ''}` : `${file}:${l}:${col} → nie znaleziono`);
  }
  out.push(line, ...notes.map((n) => '      → ' + n));
}
console.log(out.join('\n'));

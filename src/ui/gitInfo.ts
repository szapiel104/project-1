import { tx } from '../i18n';

/**
 * Lokalnie (npx vite / uruchom.bat) przy numerze wersji druga linijka: kiedy ostatnio zmienił się dev i main
 * i czy kod na dysku jest już najnowszym dev (Michał 10.11.2026: „dev i main mam widzieć”).
 * Dane daje serwer gry (`/__git.json` w vite.config.ts) z gita na dysku; na stronie gry tego nie ma.
 */
interface Ref { t: number; h: string; s: string }
interface Info { head?: Ref; dev?: Ref; main?: Ref }

const when = (r?: Ref): string => {
  if (!r) return '—';
  const d = new Date(r.t * 1000);
  const hm = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${hm}`;
};

let text = '';
let title = '';

function paint(): void {
  if (!text) return;
  for (const host of document.querySelectorAll<HTMLElement>('.loading-ver, .tb-ver')) {
    let line = host.querySelector<HTMLElement>('.ver-git');
    if (!line) { line = document.createElement('span'); line.className = 'ver-git'; host.append(line); }
    if (line.textContent !== text) line.textContent = text;
    line.title = title;
  }
}

async function poll(): Promise<void> {
  try {
    const r = await fetch('/__git.json', { cache: 'no-store' });
    if (!r.ok) return;
    const g = (await r.json()) as Info;
    const behind = !!(g.dev && g.head && g.head.h !== g.dev.h && g.head.t < g.dev.t);
    text = `${tx('lokalnie', 'local')}: dev ${when(g.dev)} · main ${when(g.main)}` + (behind ? tx(' · czekam na pobranie', ' · waiting for pull') : '');
    title = [
      `${tx('na dysku', 'on disk')}: ${g.head?.h ?? '?'} ${g.head?.s ?? ''}`,
      `dev: ${g.dev?.h ?? '?'} ${g.dev?.s ?? ''}`,
      `main: ${g.main?.h ?? '?'} ${g.main?.s ?? ''}`,
    ].join('\n');
    paint();
  } catch { /* serwer bez gita albo wyłączony: bez drugiej linijki */ }
}

export function startGitInfo(): void {
  void poll();
  window.setInterval(() => void poll(), 20000);
  window.setInterval(paint, 1000); // pasek menu i ekran wczytywania rysują się od nowa — dopisujemy linijkę z powrotem
}

/**
 * Ekran wczytywania (Michał 28.10.2026: „zajebista strona wczytywania, 100% frontowa ładna”).
 *
 * Pełnoekranowy pejzaż rysowany wektorowo (SVG, bez plików do pobrania): zmierzch nad górami, na wzgórzu zamek
 * z zapalonymi oknami i chorągwią, mgła w dolinie, z przodu ciemny bór. U góry herb i tytuł, na dole okuta listwa
 * z radą, żarzącym się paskiem, procentem i krokami wczytywania.
 *
 * Bez animacji (decyzja z 19.10.2026): wątek główny w tym czasie wczytuje grę, więc każda animowana ozdoba by
 * przycinała. Obraz jest statyczny i rysuje się raz; rusza się tylko pasek.
 *
 * Ten sam układ ma ekran przy starcie strony (boot.ts) i przy wejściu do meczu (main.ts → enterGame).
 */
import { vistaScene } from './vista';
import { t, tx } from '../i18n';

const CREST = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 34 L102 86 M102 34 L18 86" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/><path d="M14 30 l8 2 -2 8z M106 30 l-8 2 2 8z" fill="#b9b2a2"/><path d="M60 12 L96 22 V56 C96 82 78 98 60 108 C42 98 24 82 24 56 V22 Z" fill="#8c1f18" stroke="#e9c145" stroke-width="4"/><path d="M60 18 L90 26 V56 C90 78 75 92 60 101 Z" fill="#6e1711"/><path d="M46 84 V52 h4 v-6 h5 v6 h10 v-6 h5 v6 h4 V84 Z" fill="#e9c145"/><path d="M56 84 v-12 a4 4 0 0 1 8 0 v12z" fill="#6e1711"/></svg>';

/** Dwie linijki pod podtytułem: czym jest gra i że ciągle się rozwija (menu główne i ekran wczytywania) */
export function gameTagline(): string {
  return `<p class="game-tagline"><span class="game-tagline-what">${t('menu.tagline')}</span><span class="game-tagline-dev">${t('menu.taglineDev')}</span></p>`;
}

/** Pejzaż w tle ekranu wczytywania i menu (src/ui/vista.ts) */
export function loadingScene(): string {
  return vistaScene();
}

declare const __VERSION__: string;
declare const __BUILD__: string;
/** Wersja i godzina buildu w rogu ekranu wczytywania — od razu widać, czy przeglądarka ma najnowszą (Ctrl+F5) */
const VER = `v${typeof __VERSION__ === 'string' ? __VERSION__ : 'dev'}${typeof __BUILD__ === 'string' ? ` · ${__BUILD__}` : ''}`;

/** Cały ekran wczytywania: pejzaż, herb z tytułem i dolna listwa z paskiem (identyfikatory dla boot.ts) */
export function loadingMarkup(label: string, tip: string): string {
  return `${loadingScene()}
  <p class="loading-ver">${VER}</p>
  <div class="loading-head"><div class="loading-crest">${CREST}</div><p class="loading-title">Project‑1</p><p class="loading-sub">${t('menu.subtitle')}</p>${gameTagline()}</div>
  <div class="loading-card">
    <div class="ld-top">
      <p class="loading-tip" id="loading-tip">${tip}</p>
      <p class="ld-pct" id="loading-pct" aria-hidden="true">0%</p>
    </div>
    <div class="loading-bar" role="progressbar" aria-label="${tx('Postęp wczytywania', 'Loading progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="loading-fill"></span></div>
    <p class="loading-line"><span id="loading-label">${label}</span> <strong id="loading-count"></strong></p>
  </div>`;
}

/** Ustawia pasek, procent i wartość dla czytnika ekranu */
export function setLoadingProgress(root: ParentNode, pct: number): void {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const fill = root.querySelector<HTMLElement>('.loading-bar span');
  if (fill) fill.style.width = `${p}%`;
  const bar = root.querySelector('.loading-bar');
  bar?.setAttribute('aria-valuenow', String(p));
  bar?.setAttribute('data-pct', `${p}%`); // procent w pasku (Michał 7.11.2026)
  const big = root.querySelector('.ld-pct');
  if (big) big.textContent = `${p}%`;
}

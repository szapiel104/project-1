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
import { stepTip } from '../data/tips';
import { logoSvg } from './logo';

const CREST = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 34 L102 86 M102 34 L18 86" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/><path d="M14 30 l8 2 -2 8z M106 30 l-8 2 2 8z" fill="#b9b2a2"/><path d="M60 12 L96 22 V56 C96 82 78 98 60 108 C42 98 24 82 24 56 V22 Z" fill="#8c1f18" stroke="#e9c145" stroke-width="4"/><path d="M60 18 L90 26 V56 C90 78 75 92 60 101 Z" fill="#6e1711"/><path d="M46 84 V52 h4 v-6 h5 v6 h10 v-6 h5 v6 h4 V84 Z" fill="#e9c145"/><path d="M56 84 v-12 a4 4 0 0 1 8 0 v12z" fill="#6e1711"/></svg>';

/** Dwie linijki pod podtytułem: czym jest gra i że ciągle się rozwija (menu główne i ekran wczytywania) */
export function gameTagline(): string {
  return `<p class="game-tagline"><span class="game-tagline-what">${t('menu.tagline')}</span><span class="game-tagline-dev">${t('menu.taglineDev')}</span></p>`;
}

/**
 * Zdjęcia z gry w tle (Michał 11.11.2026: „porób parę zdjęć w trakcie gry — pustynia, zima, z boku… poprzerabiaj, żeby
 * były ciemniejsze, ładniejsze; przy wczytywaniu niech się zmieniają, a w menu jeden, przy odświeżeniu kolejny”).
 * Pliki w public/shots/ (zrzuty z gry w pełnej grafice, przyciemnione, z winietą, 1600 px, WebP). Pejzaż SVG zostaje pod
 * spodem — widać go, póki zdjęcie się nie wczyta.
 */
export const SHOTS = ['1-osada', '2-brama', '3-mury', '4-wieza', '5-pustynia', '6-zima'];
const shotUrl = (i: number): string => `${(import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './'}shots/${SHOTS[i]}.webp`;
/** Pierwsze zdjęcie tego wejścia: losowe, ale inne niż przy poprzednim (odświeżenie menu = kolejne zdjęcie) */
const firstShot = ((): number => {
  let last = -1;
  try { last = Number(localStorage.getItem('p1-shot') ?? -1); } catch { /* bez pamięci przeglądarki */ }
  let i = Math.floor(Math.random() * SHOTS.length);
  if (i === last) i = (i + 1 + Math.floor(Math.random() * (SHOTS.length - 1))) % SHOTS.length;
  try { localStorage.setItem('p1-shot', String(i)); } catch { /* nic */ }
  return i;
})();
let shotNow = firstShot;
/** Pokazuje zdjęcie w warstwie, gdy już się wczytało (płynne przejście w CSS) */
function showShot(layer: HTMLElement, i: number): void {
  const img = new Image();
  img.onload = () => { layer.style.backgroundImage = `url("${img.src}")`; layer.classList.add('on'); };
  img.src = shotUrl(i);
}

/** Pejzaż w tle ekranu wczytywania i menu (src/ui/vista.ts) i zdjęcie z gry na nim */
export function loadingScene(): string {
  if (typeof document !== 'undefined') queueMicrotask(() => {
    for (const box of document.querySelectorAll<HTMLElement>('.ld-shots:not([data-on])')) {
      box.dataset.on = '1';
      showShot(box.firstElementChild as HTMLElement, shotNow);
    }
  });
  return `${vistaScene()}<div class="ld-shots" aria-hidden="true"><i></i><i></i></div>`;
}

// na ekranie wczytywania zdjęcia zmieniają się co kilka sekund (przenikanie dwóch warstw — sama przezroczystość,
// liczy ją karta graficzna, wątek główny wczytujący grę nic nie traci)
const SHOT_EVERY = 6500;
if (typeof document !== 'undefined') window.setInterval(() => {
  const box = document.querySelector<HTMLElement>('#loading .ld-shots');
  if (!box || box.offsetParent === null) return;
  const [a, b] = [...box.children] as HTMLElement[];
  const next = a!.classList.contains('on') ? b! : a!, prev = next === a ? b! : a!;
  shotNow = (shotNow + 1) % SHOTS.length;
  const img = new Image();
  img.onload = () => { next.style.backgroundImage = `url("${img.src}")`; next.classList.add('on'); prev.classList.remove('on'); };
  img.src = shotUrl(shotNow);
}, SHOT_EVERY);

declare const __VERSION__: string;
declare const __BUILD__: string;
/** Wersja i godzina buildu w rogu ekranu wczytywania — od razu widać, czy przeglądarka ma najnowszą (Ctrl+F5) */
const VER = `v${typeof __VERSION__ === 'string' ? __VERSION__ : 'dev'}${typeof __BUILD__ === 'string' ? ` · ${__BUILD__}` : ''}`;

/** Cały ekran wczytywania: pejzaż, herb z tytułem i dolna listwa z paskiem (identyfikatory dla boot.ts) */
export function loadingMarkup(label: string, tip: string): string {
  return `${loadingScene()}
  <p class="loading-ver">${VER}</p>
  <div class="loading-head"><div class="loading-crest">${CREST}</div><p class="loading-title has-logo">${logoSvg('lgl')}</p><p class="loading-sub">${t('menu.subtitle')}</p>${gameTagline()}</div>
  <div class="loading-card">
    <div class="ld-top">
      <button type="button" class="tip-arrow" data-dir="-1" aria-label="${tx('Poprzednia rada', 'Previous tip')}">‹</button>
      <p class="loading-tip" id="loading-tip">${tip}</p>
      <button type="button" class="tip-arrow" data-dir="1" aria-label="${tx('Następna rada', 'Next tip')}">›</button>
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

// Rady na ekranie wczytywania zmieniają się same co kilka sekund, a strzałkami (przyciski albo ← →) przewija się je jak
// w suwaku (Michał 7.11.2026). Jeden zegar i jeden nasłuch na całą stronę: ekran wczytywania powstaje kilka razy.
let tipTimer = 0;
const TIP_EVERY = 5000;
function showTip(d: number): void {
  const p = document.querySelector<HTMLElement>('#loading .loading-tip');
  if (!p) return;
  p.textContent = stepTip(d);
  clearInterval(tipTimer);
  tipTimer = window.setInterval(() => showTip(1), TIP_EVERY);
}
if (typeof document !== 'undefined') {
  tipTimer = window.setInterval(() => showTip(1), TIP_EVERY);
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.('#loading .tip-arrow') as HTMLElement | null;
    if (b) showTip(Number(b.dataset.dir) || 1);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !document.querySelector('#loading .loading-tip')) return;
    showTip(e.key === 'ArrowLeft' ? -1 : 1);
  });
}

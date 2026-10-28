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
import { t, tx } from '../i18n';

const CREST = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 34 L102 86 M102 34 L18 86" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/><path d="M14 30 l8 2 -2 8z M106 30 l-8 2 2 8z" fill="#b9b2a2"/><path d="M60 12 L96 22 V56 C96 82 78 98 60 108 C42 98 24 82 24 56 V22 Z" fill="#8c1f18" stroke="#e9c145" stroke-width="4"/><path d="M60 18 L90 26 V56 C90 78 75 92 60 101 Z" fill="#6e1711"/><path d="M46 84 V52 h4 v-6 h5 v6 h10 v-6 h5 v6 h4 V84 Z" fill="#e9c145"/><path d="M56 84 v-12 a4 4 0 0 1 8 0 v12z" fill="#6e1711"/></svg>';

/** Dwie linijki pod podtytułem: czym jest gra i że ciągle się rozwija (menu główne i ekran wczytywania) */
export function gameTagline(): string {
  return `<p class="game-tagline"><span class="game-tagline-what">${t('menu.tagline')}</span><span class="game-tagline-dev">${t('menu.taglineDev')}</span></p>`;
}

/** Stałe „losowanie” (ten sam obraz przy każdym wejściu) */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Rząd świerków jako jedna ścieżka: piętra gałęzi zwężające się ku czubkowi */
function forest(seed: number, y0: number, hMin: number, hMax: number, gap: number, color: string, opacity = 1): string {
  const r = rng(seed);
  let d = '';
  for (let x = -40; x < 1660; x += gap * (0.6 + r() * 0.8)) {
    const h = hMin + r() * (hMax - hMin), w = h * (0.32 + r() * 0.1), base = y0 + r() * 14;
    const tiers = 3 + Math.floor(r() * 2);
    for (let k = 0; k < tiers; k++) {
      const top = base - h + (h * k) / (tiers + 0.6), bot = base - h + (h * (k + 1.6)) / (tiers + 0.6);
      const half = (w / 2) * ((k + 1.4) / (tiers + 0.4));
      d += `M${(x - half).toFixed(1)} ${bot.toFixed(1)}L${x.toFixed(1)} ${top.toFixed(1)}L${(x + half).toFixed(1)} ${bot.toFixed(1)}Z`;
    }
    d += `M${(x - w * 0.06).toFixed(1)} ${base.toFixed(1)}h${(w * 0.12).toFixed(1)}v-${(h * 0.2).toFixed(1)}h-${(w * 0.12).toFixed(1)}Z`;
  }
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

/** Blanki na wierzchu muru albo wieży */
const merlons = (x: number, y: number, w: number, n: number, mh = 9): string => {
  const step = w / (n * 2 - 1);
  let d = '';
  for (let i = 0; i < n; i++) d += `M${(x + i * step * 2).toFixed(1)} ${y}h${step.toFixed(1)}v-${mh}h-${step.toFixed(1)}Z`;
  return d;
};

function castle(): string {
  // zamek na wzgórzu, prawa trzecia część kadru (środek zostaje dla tytułu)
  const body = [
    // mury kurtynowe
    'M1040 560 h300 v-70 h-300 Z', merlons(1040, 490, 300, 15),
    // wieża lewa, donżon, wieża prawa, baszta przy bramie
    'M1010 560 h46 v-130 h-46 Z', merlons(1008, 430, 50, 4),
    'M1130 560 h96 v-210 h-96 Z', merlons(1128, 350, 100, 6, 11),
    'M1146 350 h64 v-40 h-64 Z', merlons(1144, 310, 68, 4),
    'M1320 560 h50 v-150 h-50 Z', merlons(1318, 410, 54, 4),
    'M1240 560 h40 v-100 h-40 Z', merlons(1238, 460, 44, 3),
    // dachy stożkowe na wieżach bocznych
    'M1004 430 L1033 382 L1062 430 Z', 'M1314 410 L1345 356 L1376 410 Z',
  ].join('');
  const windows: [number, number, number, number][] = [
    [1026, 452, 8, 14], [1026, 490, 8, 14], [1162, 376, 9, 16], [1196, 376, 9, 16], [1178, 420, 10, 18], [1150, 470, 9, 16], [1206, 470, 9, 16],
    [1338, 434, 8, 14], [1338, 476, 8, 14], [1254, 484, 7, 12], [1090, 520, 7, 10], [1290, 520, 7, 10],
  ];
  const lit = windows.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" ry="${w / 2}"/>`).join('');
  return `<g>
    <path d="M880 640 C960 560 1040 548 1110 552 C1210 540 1300 548 1400 560 C1460 572 1520 610 1560 650 Z" fill="#140c08"/>
    <path d="${body}" fill="#0f0906"/>
    <path d="M1178 560 v-30 a12 12 0 0 1 24 0 v30 Z" fill="#2a1408"/>
    <g fill="#ffb64d" opacity=".92" filter="url(#ld-glow)">${lit}</g>
    <path d="M1178 310 v-74" stroke="#0f0906" stroke-width="3"/>
    <path d="M1179 238 C1196 232 1210 246 1228 240 L1226 268 C1210 274 1196 260 1179 266 Z" fill="#8c1f18"/>
    <path d="M1196 248 l6 -4 6 4 -2 8 h-8 Z" fill="#e9c145" opacity=".9"/>
  </g>`;
}

/** Pejzaż w tle (SVG, rysowany raz) */
export function loadingScene(): string {
  return `<svg class="ld-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="ld-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0706"/><stop offset=".38" stop-color="#24140d"/><stop offset=".62" stop-color="#5a2711"/><stop offset=".76" stop-color="#8f3b12"/><stop offset="1" stop-color="#3a1a0c"/>
    </linearGradient>
    <radialGradient id="ld-sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(900 470) scale(760 340)">
      <stop offset="0" stop-color="#ffa448" stop-opacity=".7"/><stop offset=".45" stop-color="#c2541a" stop-opacity=".22"/><stop offset="1" stop-color="#c2541a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ld-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a27a" stop-opacity="0"/><stop offset=".5" stop-color="#d2ab82" stop-opacity=".24"/><stop offset="1" stop-color="#c9a27a" stop-opacity="0"/></linearGradient>
    <linearGradient id="ld-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050302" stop-opacity="0"/><stop offset=".55" stop-color="#050302" stop-opacity=".85"/><stop offset="1" stop-color="#050302"/></linearGradient>
    <radialGradient id="ld-vig" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
    <filter id="ld-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#ld-sky)"/>
  <rect width="1600" height="900" fill="url(#ld-sun)"/>
  <circle cx="900" cy="452" r="58" fill="#f7b46a" opacity=".22"/>
  <circle cx="900" cy="452" r="36" fill="#ffd9a0" opacity=".38"/>
  <g fill="#e7c9a0" opacity=".5">${(() => { const r = rng(7); let s = ''; for (let i = 0; i < 70; i++) { const x = r() * 1600, y = r() * 300; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.6 + r() * 1.2).toFixed(1)}" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`; } return s; })()}</g>
  <path d="M0 520 L120 430 L210 470 L330 360 L420 420 L520 330 L640 430 L760 380 L880 450 L990 360 L1090 420 L1210 330 L1330 410 L1450 350 L1600 430 V900 H0 Z" fill="#33201a"/>
  <path d="M330 360 L352 380 L340 384 L318 372 Z M520 330 L548 356 L530 360 L506 346 Z M1210 330 L1236 352 L1220 356 L1196 344 Z M990 360 L1010 378 L996 380 Z" fill="#d6b48c" opacity=".22"/>
  <path d="M0 590 C140 520 260 540 380 500 C500 460 620 520 760 500 C880 484 960 530 1080 520 C1220 508 1360 540 1600 500 V900 H0 Z" fill="#221410"/>
  <rect x="0" y="540" width="1600" height="120" fill="url(#ld-mist)"/>
  ${castle()}
  ${forest(11, 640, 70, 120, 26, '#120b08', 0.95)}
  <rect x="0" y="600" width="1600" height="90" fill="url(#ld-mist)" opacity=".7"/>
  ${forest(23, 740, 150, 260, 34, '#0a0604')}
  ${forest(37, 905, 260, 420, 70, '#050302')}
  <rect x="0" y="560" width="1600" height="340" fill="url(#ld-floor)"/>
  <rect width="1600" height="900" fill="url(#ld-vig)"/>
</svg>`;
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
  root.querySelector('.loading-bar')?.setAttribute('aria-valuenow', String(p));
  const big = root.querySelector('.ld-pct');
  if (big) big.textContent = `${p}%`;
}

import { tx } from '../i18n';

/**
 * Przyciski-ikony w oknie budynku (Michał 9.11.2026: „rozbierz, pokaż zasięg, zejdźcie z wieży — ikonkami”).
 * Ikona w środku, napis w dymku (title) i dla czytnika ekranu (aria-label); podpis zmienia się przez setLabel.
 */
export const ICON = {
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  range: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  area: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6l-5 4-5-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 13v8M8.5 17.5 12 21l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  market: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 5 4h14l2 5.5M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5S13 10.9 13 9.5c0 1.4 1.1 2.5 2.5 2.5S18 10.9 18 9.5c0 1.4 1.1 2.5 2.5 2.5M5 12v8h14v-8M10 20v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8M7.2 6.3a7.5 7.5 0 1 0 9.6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** Zamienia zwykły przycisk na ikonę z dymkiem */
export function iconBtn(btn: HTMLButtonElement, svg: string, label: string): HTMLButtonElement {
  btn.classList.add('icon-act');
  btn.innerHTML = svg;
  setLabel(btn, label);
  return btn;
}

export function setLabel(btn: HTMLElement, label: string): void {
  if (btn.title === label) return;
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

/**
 * Rozbiórka z potwierdzeniem: pierwszy klik uzbraja przycisk („Rozebrać? Kliknij jeszcze raz”), drugi w ciągu 4 s
 * wykonuje; po 4 s albo po zmianie budynku wraca do zwykłej ikony kosza.
 */
export function confirmBtn(btn: HTMLButtonElement, run: () => void): { reset: () => void } {
  let armed = 0;
  const reset = (): void => {
    if (!btn.classList.contains('armed')) return;
    btn.classList.remove('armed');
    btn.innerHTML = ICON.trash;
    window.clearTimeout(armed);
  };
  btn.addEventListener('click', () => {
    if (btn.classList.contains('armed')) { reset(); run(); return; }
    btn.classList.add('armed');
    btn.innerHTML = `${ICON.trash}<span class="icon-act-q">${tx('Na pewno?', 'Sure?')}</span>`;
    armed = window.setTimeout(reset, 4000);
  });
  return { reset };
}

import { pl, type TextKey } from './pl';
import { en } from './en';

/**
 * Teksty interfejsu po polsku i po angielsku.
 * - Stałe teksty: klucz w pl.ts + ta sama linijka w en.ts (tsc pilnuje, że angielski ma każdy klucz), w kodzie `t('klucz')`.
 * - Krótkie teksty pisane w miejscu (etykieta jednego przycisku): `tx('Polski', 'English')`.
 * Każdy nowy budynek, jednostka, okno i komunikat dostaje od razu obie wersje.
 */
export type Lang = 'pl' | 'en';
export const LANGS: [Lang, string][] = [['pl', 'Polski'], ['en', 'English']];
const LANG_KEY = 'project1.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'pl' || saved === 'en') return saved;
  } catch { /* prywatne okno: bez zapisu */ }
  // pierwszy raz: język przeglądarki (polski dla polskiej, angielski dla każdej innej)
  const nav = typeof navigator !== 'undefined' ? navigator.language ?? 'pl' : 'pl';
  return nav.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function lang(): Lang {
  return current;
}

/** Zmienia język i przeładowuje grę (zapis gry robi się sam przy zamykaniu strony) */
export function setLang(l: Lang): void {
  if (l === current) return;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* nic */ }
  current = l;
  if (typeof location !== 'undefined') location.reload();
}

export function t(key: TextKey | string): string {
  const dict = (current === 'en' ? en : pl) as Record<string, string>;
  return dict[key] ?? (pl as Record<string, string>)[key] ?? key;
}

/** Tekst w miejscu użycia: polska i angielska wersja obok siebie */
export function tx(plText: string, enText: string): string {
  return current === 'en' ? enText : plText;
}

export type { TextKey };

/**
 * Odświeżenie gry do najnowszej wersji (Michał 28.10.2026): przycisk w menu głównym czyści pamięć podręczną
 * (service worker `sw.js` i jego pliki) i wczytuje grę od nowa — bez szukania Ctrl+F5.
 * Zapis gry, konto i ustawienia (localStorage, Supabase) zostają nietknięte.
 * Menu samo sprawdza też `version.json` (zapisywany przy każdym buildzie) i gdy na serwerze jest nowsza wersja, mówi o tym.
 */
declare const __BUILD__: string;
declare const __VERSION__: string;
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : '';

/** Czyści pamięć podręczną przeglądarki dla gry i wczytuje stronę od nowa z sieci */
export async function hardReload(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
  } catch { /* bez service workera nie ma czego wyrejestrować */ }
  try {
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* np. tryb prywatny bez dostępu do pamięci podręcznej */ }
  const url = new URL(location.href);
  url.searchParams.set('r', String(Date.now())); // nowy adres strony = przeglądarka nie weźmie jej z pamięci
  location.replace(url.toString());
}

/** Nowsza wersja na serwerze (napis „0.63.0 · 28.10, 17:05”) albo null, gdy gra jest aktualna lub nie da się sprawdzić */
export async function newerVersion(): Promise<string | null> {
  if (!BUILD || location.hostname === 'localhost') return null;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const v = (await res.json()) as { version?: string; build?: string };
    if (!v.build || (v.build === BUILD && v.version === VERSION)) return null;
    return `${v.version ?? ''} · ${v.build}`;
  } catch {
    return null;
  }
}

/**
 * Wcześniejsze pobieranie dużych plików gry, zanim gra o nie poprosi.
 *
 * Tekstury KTX2 (teren ok. 10 MB, zdjęciowe tekstury budynków ok. 9 MB) gra zamawia dopiero wtedy, gdy powstaje silnik
 * rysowania, czyli po pobraniu modeli i kodu gry. Wcześniej wszystko szło po kolei: najpierw modele, potem kod, potem
 * tekstury. Tu na samym początku wczytywania wysyłamy po nie zapytania z niskim priorytetem (pierwszeństwo mają modele
 * i kod). Pliki lądują w pamięci przeglądarki, a gdy silnik o nie poprosi pod tym samym adresem, bierze je stamtąd
 * zamiast z sieci. Sam wygląd i kod wczytywania tekstur się nie zmieniają (ktx.ts, ground.ts, textures.ts).
 *
 * Odpowiedzi nie trzymamy w pamięci gry: ciało pliku jest tylko doczytane do końca, żeby trafiło do pamięci przeglądarki.
 */

/** Numer wersji tekstur terenu w adresie (`?v=`): po podmianie tekstury terenu podbij go tutaj (używa go ground.ts) */
export const TERRAIN_V = 5;

/** Wszystkie tekstury terenu, których używa ground.ts (sprawdza test tests/prefetch.test.ts) */
export const TERRAIN_FILES = ['grass1', 'grass2', 'meadow', 'forest', 'pebble', 'dirt', 'rock', 'cliff', 'sand', 'grass_n', 'forest_n', 'pebble_n', 'rock_n'];

const base = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './');

/** Adres tekstury terenu dokładnie taki, o jaki potem prosi ground.ts (inaczej pamięć przeglądarki nie zadziała) */
export const terrainUrl = (name: string): string => `${base()}textures/terrain/${name}.jpg?v=${TERRAIN_V}`;

/** Dekoder tekstur KTX2 (ktx.ts, `setTranscoderPath`): bez niego żadna tekstura się nie rozpakuje, więc idzie pierwszy */
export const basisUrls = (): string[] => [`${base()}basis/basis_transcoder.js`, `${base()}basis/basis_transcoder.wasm`];

let started = false;

/**
 * Wysyła zapytania o podane adresy (`.jpg` w wersji `.ktx2`, tak jak robi to ktx.ts; inne bez zmian), po kilka naraz,
 * z niskim priorytetem, w podanej kolejności.
 * Nic nie zwraca i nigdy nie rzuca błędem — gdy coś nie dojdzie, gra pobierze to później jak zwykle.
 */
export function prefetchTextures(jpgUrls: string[]): void {
  if (started || typeof fetch === 'undefined' || typeof document === 'undefined') return;
  started = true;
  // kolejne wejście: pliki są już w pamięci Service Workera (sw.js) i dochodzą od razu — dodatkowe zapytania tylko by
  // dublowały sprawdzanie nowszej wersji w tle
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) return;
  const queue = [...new Set(jpgUrls)].map((u) => u.replace(/\.jpg(\?|$)/, '.ktx2$1'));
  // kilka naraz: nie zapychamy łącza przed modelami i kodem gry, a przy szybkim łączu i tak idzie równolegle
  const next = (): void => {
    const url = queue.shift();
    if (!url) return;
    fetch(url, { priority: 'low' } as RequestInit)
      .then((r) => (r.ok ? r.arrayBuffer() : undefined))
      .catch(() => undefined)
      .finally(next);
  };
  for (let i = 0; i < 4; i++) next();
}

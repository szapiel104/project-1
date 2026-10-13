/**
 * Pamięć miniatur budynków między wizytami (IndexedDB). Klucz to wersja gry, więc po każdym wdrożeniu
 * miniatury rysują się raz od nowa (mogły się zmienić modele), a potem znowu biorą się z pamięci.
 */
declare const __BUILD__: string;
const DB = 'project1-ui', STORE = 'kv', KEY = 'thumbs';
let cached: Map<string, string> | null = null;

function open(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ok(null);
    } catch { ok(null); }
  });
}

/** Wczytuje miniatury tej wersji gry, jeśli są (wołane przed uruchomieniem gry) */
export async function loadThumbs(): Promise<void> {
  const d = await open();
  if (!d) return;
  const v = await new Promise<{ build: string; items: [string, string][] } | undefined>((ok) => {
    try { const rq = d.transaction(STORE).objectStore(STORE).get(KEY); rq.onsuccess = () => ok(rq.result); rq.onerror = () => ok(undefined); } catch { ok(undefined); }
  });
  if (v && v.build === __BUILD__ && Array.isArray(v.items) && v.items.length) cached = new Map(v.items);
}

/** Miniatury z pamięci (null = trzeba narysować) */
export const cachedThumbs = (): Map<string, string> | null => cached;

/** Zapamiętuje gotowe miniatury (te z teksturami zdjęciowymi) */
export async function saveThumbs(thumbs: Map<string, string>): Promise<void> {
  const d = await open();
  if (!d) return;
  try { d.transaction(STORE, 'readwrite').objectStore(STORE).put({ build: __BUILD__, items: [...thumbs] }, KEY); } catch { /* brak miejsca: trudno */ }
}

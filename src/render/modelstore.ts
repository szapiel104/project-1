/**
 * Modele z Blendera (`src/render/models/*.json`) poza kodem gry.
 *
 * Wcześniej każdy plik JSON był wklejony do bundla (`import X from './models/x.json'`), przez co główny kawałek
 * kodu miał 8 MB i przeglądarka musiała go pobrać i sparsować jako JavaScript, zanim gra w ogóle ruszyła.
 * Teraz pliki leżą osobno (z hashem w nazwie, więc pamięć podręczna i Service Worker trzymają je na stałe),
 * pobierają się równolegle na ekranie wczytywania i są czytane szybkim `JSON.parse`.
 *
 * Same pliki i skrypty w `tools/models/` nie zmieniają się — to tylko inny sposób dostarczenia ich do gry.
 *
 * Użycie: przed importem modułów renderu `await loadModels()`, potem w module `const X = model('x')`.
 */
const URLS = import.meta.glob('./models/*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

const store = new Map<string, unknown>();
let loading: Promise<void> | null = null;

/** Nazwa modelu z klucza globa: './models/keep.json' → 'keep' */
const nameOf = (key: string): string => key.slice(key.lastIndexOf('/') + 1, -'.json'.length);

/** Lista nazw znanych modeli */
export function modelNames(): string[] { return Object.keys(URLS).map(nameOf); }

/** Gotowy model (po `loadModels`). Brak = błąd programisty (moduł renderu zaimportowany przed wczytaniem). */
export function model<T = unknown>(name: string): T {
  const m = store.get(name);
  if (m === undefined) throw new Error(`Model „${name}” nie jest wczytany — najpierw await loadModels() (src/render/modelstore.ts)`);
  return m as T;
}

/** Wstawienie modelu z zewnątrz (testy w Node czytają pliki z dysku) */
export function setModel(name: string, data: unknown): void { store.set(name, data); }

export function modelsLoaded(): boolean { return store.size >= Object.keys(URLS).length; }

/** Pobiera wszystkie modele naraz; `onProgress(gotowe, wszystkich)` po każdym pliku. Drugie wywołanie nic nie robi. */
export function loadModels(onProgress?: (done: number, total: number) => void): Promise<void> {
  if (loading) return loading;
  const entries = Object.entries(URLS);
  let done = 0;
  loading = Promise.all(entries.map(async ([key, url]) => {
    const name = nameOf(key);
    if (!store.has(name)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Nie udało się pobrać modelu ${name} (${res.status})`);
      store.set(name, await res.json());
    }
    done++;
    onProgress?.(done, entries.length);
  })).then(() => undefined);
  return loading;
}

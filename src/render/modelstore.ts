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
 * Od 27.10.2026 przez sieć jadą spakowane pliki `.bin` (wtyczka `modelPacks` w vite.config.ts + tools/models/pack.mjs):
 * bezstratnie, ok. 44% mniej do pobrania niż JSON z gzip. Strumienie siatek przychodzą wtedy jako Uint8Array,
 * a w testach (JSON z dysku) jako napisy base64 — moduły renderu czytają jedno i drugie przez `bytes()`.
 *
 * Użycie: przed importem modułów renderu `await loadModels()`, potem w module `const X = model('x')`.
 */
import PACKS from 'virtual:model-packs';
import { tx } from '../i18n';
import { unpackModel } from './modelpack';

/** nazwa modelu → adres spakowanego pliku .bin */
const URLS: Record<string, string> = PACKS;

const store = new Map<string, unknown>();
let loading: Promise<void> | null = null;

/** Lista nazw znanych modeli */
export function modelNames(): string[] { return Object.keys(URLS); }

/** Bajty strumienia siatki: napis base64 (JSON z dysku) albo gotowe bajty (plik .bin). Zawsze świeża kopia od zera bufora. */
export function bytes(s: string | Uint8Array): Uint8Array {
  return typeof s === 'string' ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : s.slice();
}

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
  loading = Promise.all(entries.map(async ([name, url]) => {
    if (!store.has(name)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(tx(`Nie udało się pobrać modelu ${name} (${res.status})`, `Could not download model ${name} (${res.status})`));
      store.set(name, await unpackModel(await res.arrayBuffer()));
    }
    done++;
    onProgress?.(done, entries.length);
  })).then(() => undefined);
  return loading;
}

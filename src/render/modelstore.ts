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
import { applyModelFixes, dedupeFixes, type Fix } from './modelfix';
import { loadPh, phUsed } from './phAssets';
import FIXES from '../data/modelFixes.json';

/**
 * Poprawki modelu: z repozytorium (src/data/modelFixes.json), a lokalnie (localhost) te zapisane w edytorze podglądu modeli
 * w tej samej przeglądarce — żeby zmiana z edytora była od razu widać w grze (Michał 10.11.2026), zanim trafi do repozytorium.
 */
let live: Record<string, Fix[]> = {};
/** Poprawki „na żywo” dla podglądu modeli (baza + ta przeglądarka) — ustawiane przed loadModels() w viewerboot.ts */
export function setLiveFixes(map: Record<string, Fix[]>): void { live = map; }
/**
 * Poprawki z edytora prosto z bazy (model_fixes, odczyt publiczny, zapis tylko twórca) — gra i podgląd modeli biorą
 * je przy wczytywaniu, więc zmiana z edytora widać w grze po odświeżeniu, bez wydania (Michał 11.11.2026: „zapisały
 * się, ale w grze nie są zaktualizowane”). Z `local` dochodzą też zapisy z tej przeglądarki. Bez bazy (sieć, czas
 * ponad 3 s) zostaje plik z repozytorium.
 */
export async function fetchLiveFixes(local: boolean): Promise<void> {
  const map: Record<string, Fix[]> = {};
  let dbOk = false;
  try {
    const { supa } = await import('../net/supa');
    const res = await Promise.race([supa.from('model_fixes').select('model,fixes'), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    const rows = (res as { data?: { model: string; fixes: Fix[] }[] | null } | null)?.data;
    if (rows) { dbOk = true; for (const row of rows) if (Array.isArray(row.fixes)) map[row.model] = row.fixes; }
  } catch { /* bez bazy */ }
  if (local) {
    // Ta sama wersja lokalnie i na produkcji (Michał 11.11.2026): podstawą jest baza; zmiany zapisane tylko w tej
    // przeglądarce (np. bez logowania) dochodzą na końcu, a zalogowany twórca od razu wysyła wynik do bazy —
    // wtedy localhost i produkcja pokazują dokładnie to samo. Przeglądarka dostaje kopię z bazy.
    const upload: [string, Fix[]][] = [];
    try {
      for (let k = 0; k < localStorage.length; k++) {
        const key = localStorage.key(k);
        if (!key?.startsWith('p1-model-fixes:')) continue;
        const v = JSON.parse(localStorage.getItem(key) ?? 'null') as Fix[] | null, id = key.slice('p1-model-fixes:'.length);
        if (!Array.isArray(v)) continue;
        const merged = dedupeFixes([...(map[id] ?? []), ...v]);
        if (dbOk && merged.length > (map[id]?.length ?? 0)) upload.push([id, merged]);
        map[id] = merged;
      }
      if (dbOk) for (const [id, list] of Object.entries(map)) localStorage.setItem(`p1-model-fixes:${id}`, JSON.stringify(list));
    } catch { /* prywatne okno */ }
    if (upload.length) {
      try {
        const { supa } = await import('../net/supa');
        const { data: s } = await supa.auth.getSession();
        if (s.session) for (const [model, fixes] of upload) await supa.from('model_fixes').upsert({ model, fixes, updated_by: s.session.user.id, updated_at: new Date().toISOString() });
      } catch { /* zostaje w przeglądarce, wyśle następny zapis */ }
    }
  }
  live = map;
}
/** poprawki zapisane przez pierwszą wersję edytora pod nazwą budynku zamiast pliku modelu */
const OLD_KEY: Record<string, string> = { mine: 'oremine' };
function fixesFor(name: string): Fix[] | undefined {
  // stara nazwa budynku: z tabeli albo ta sama inaczej pisana (budynek 'mageFire' → plik 'magefire')
  const old = OLD_KEY[name] ?? [...Object.keys(FIXES as Record<string, unknown>), ...Object.keys(live)].find((k) => k !== name && k.toLowerCase() === name);
  const repo0 = (FIXES as unknown as Record<string, Fix[]>)[name] ?? (old ? (FIXES as unknown as Record<string, Fix[]>)[old] : undefined);
  const l = live[name] ?? (old ? live[old] : undefined);
  const repo = l && l.length >= (repo0?.length ?? 0) ? l : repo0;
  try {
    if (typeof location === 'undefined' || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return repo;
    const local = JSON.parse(localStorage.getItem(`p1-model-fixes:${name}`) ?? (old ? localStorage.getItem(`p1-model-fixes:${old}`) : null) ?? 'null') as Fix[] | null;
    return Array.isArray(local) && local.length >= (repo?.length ?? 0) ? local : repo;
  } catch { return repo; }
}

/** nazwa modelu → adres spakowanego pliku .bin */
const URLS: Record<string, string> = PACKS;

const store = new Map<string, unknown>();
/** dane modelu → nazwa pliku (poza danymi: kod gry przegląda wszystkie klucze modelu jako grupy siatek) */
const names = new WeakMap<object, string>();
export function modelNameOf(data: unknown): string | undefined { return data && typeof data === 'object' ? names.get(data) : undefined; }
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

/**
 * Modele doczytywane dopiero po wejściu do gry (Michał 12.11.2026: „krótsze wczytywanie”): zwierzęta (fauna_*) to ok.
 * 21 MB klatek ruchu, a nie są potrzebne do pierwszego obrazu — do czasu wczytania po prostu ich nie widać.
 */
const later = (name: string): boolean => name.startsWith('fauna_');
const pending = new Map<string, Promise<void>>();
async function fetchModel(name: string, url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(tx(`Nie udało się pobrać modelu ${name} (${res.status})`, `Could not download model ${name} (${res.status})`));
  const data = await unpackModel(await res.arrayBuffer());
  // poprawki z edytora w podglądzie modeli (modelfix.ts)
  applyModelFixes(name, data as Record<string, unknown>, fixesFor(name));
  names.set(data as object, name);   // nazwa pliku dla edytora poprawek (buildings.ts → userData.modelName)
  store.set(name, data);
}
/** Czy model jest już w pamięci; jeśli nie — zaczyna go pobierać w tle (zwierzęta) i zwraca false */
export function modelReady(name: string): boolean {
  if (store.has(name)) return true;
  const url = URLS[name];
  if (url && !pending.has(name)) pending.set(name, fetchModel(name, url).catch((e) => { pending.delete(name); console.warn(e); }));
  return false;
}

export function modelsLoaded(): boolean { return Object.keys(URLS).every((n) => later(n) || store.has(n)); }

/**
 * Pobiera modele naraz; `onProgress(gotowe, wszystkich)` po każdym pliku. Drugie wywołanie nic nie robi.
 * Zwierzęta (`later`) idą w tle po pozostałych, chyba że `all` (podgląd modeli czeka na wszystko).
 */
export function loadModels(onProgress?: (done: number, total: number) => void, opts: { all?: boolean } = {}): Promise<void> {
  if (loading) return loading;
  const entries = Object.entries(URLS).filter(([n]) => opts.all || !later(n));
  let done = 0;
  loading = Promise.all(entries.map(async ([name, url]) => {
    if (!store.has(name)) await fetchModel(name, url);
    done++;
    onProgress?.(done, entries.length);
  })).then(async () => {
    // modele z Poly Haven użyte w poprawkach budynków (rekwizyty 'ph:<id>') — przed budową sceny, żeby stały od razu
    await Promise.all(phUsed(store.values()).map((id) => loadPh(id)));
    // zwierzęta zaraz po starcie, w tle
    if (!opts.all) setTimeout(() => { for (const n of Object.keys(URLS)) if (later(n)) modelReady(n); }, 1500);
  });
  return loading;
}

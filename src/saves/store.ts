import { me, supa } from '../net/supa';
import { tx } from '../i18n';

/**
 * Zapisy gry (Michał 2.11.2026): do 20 zapisów ręcznych, 3 autozapisy po kolei i szybki zapis (Ctrl+S), każdy
 * z miniaturą miejsca, datą i opisem. Tylko gry z botami — mecz przez sieć się nie zapisuje.
 *
 * Gdzie leżą:
 * 1. Zawsze w bazie przeglądarki (IndexedDB — bez limitu ~5 MB jak localStorage), z prośbą o trwałe przechowywanie:
 *    działa bez konta i bez internetu, natychmiast.
 * 2. Po zalogowaniu także w chmurze — Supabase Storage (osobny 1 GB plików, nie tabele bazy): folder `<user_id>/`,
 *    plik `<id>.p1save` na zapis i `index.json` ze spisem (opisy, miniatury). Wyczyszczenie przeglądarki ani inny
 *    komputer nie kasują zapisów: po zalogowaniu wracają. Zapis spakowany gzipem to kilka–kilkadziesiąt KB.
 * 3. Eksport i import pojedynczego pliku `.p1save` (kopia, przeniesienie bez konta).
 * Zapisy są przypisane do konta gry (gość ma osobną pulę), więc na wspólnym komputerze nikt nie nadpisze cudzej gry.
 *
 * Plik `.p1save` = JSON { meta, game } spakowany gzipem.
 */
export type SaveKind = 'manual' | 'auto' | 'quick';
export interface SaveMeta {
  id: string;
  /** konto gry (id z Supabase) albo 'guest' */
  owner: string;
  name: string;
  kind: SaveKind;
  created: number;
  /** wersja gry, która zapisała */
  build: string;
  /** wersja kształtu stanu (SAVE_VERSION) — inna = zapis nie pasuje do tej wersji gry */
  v: number;
  preset: string;
  seedText: string;
  /** numer meczu (main.ts matchId): zapisy skończonego meczu nie wracają przez „Kontynuuj” */
  match?: string;
  day: number;
  hour: number;
  people: number;
  soldiers: number;
  buildings: number;
  gold: number;
  /** poziom botów 0–3 */
  level?: number;
  dev?: boolean;
  /** miniatura miejsca zapisu (JPEG ok. 320×180) */
  thumb: string;
  /** rozmiar spakowanego zapisu w bajtach */
  size?: number;
  /** gdzie jest: tylko w tej przeglądarce, tylko w chmurze, w obu */
  where?: 'local' | 'cloud' | 'both';
}
export interface SaveGame { seedText: string; data: unknown; ui?: unknown }
export interface SaveFile { meta: SaveMeta; game: SaveGame }

export const MAX_MANUAL = 20;
export const MAX_AUTO = 3;
const BUCKET = 'saves';
const ownerNow = (): string => me()?.id ?? 'guest';

// ---------------- IndexedDB ----------------
const DB = 'project1-saves';
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  // przegląd 4.11.2026: stara karta z bazą w starszej wersji blokowała otwarcie na zawsze (zapisy i wczytywanie wisiały),
  // a raz odrzucona obietnica zostawała w pamięci — teraz: zamknięcie przy zmianie wersji, limit czasu i ponowna próba
  dbP ??= new Promise<IDBDatabase>((ok, bad) => {
    const r = indexedDB.open(DB, 2);
    const t = setTimeout(() => bad(new Error('baza zapisów zablokowana')), 8000);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('data')) d.createObjectStore('data');
    };
    r.onsuccess = () => { clearTimeout(t); const d = r.result; d.onversionchange = () => { d.close(); dbP = null; }; ok(d); };
    r.onerror = () => { clearTimeout(t); bad(r.error); };
  }).catch((e) => { dbP = null; throw e; });
  return dbP;
}
function idb<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((ok, bad) => {
    const t = d.transaction(stores, mode);
    const req = run(t);
    t.oncomplete = () => ok(req ? req.result : undefined);
    t.onerror = () => bad(t.error);
    t.onabort = () => bad(t.error ?? new Error('abort'));
  }));
}
const localMetas = async (): Promise<SaveMeta[]> => ((await idb<SaveMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').getAll() as IDBRequest<SaveMeta[]>).catch(() => [])) ?? []);
const localBlob = (id: string): Promise<Blob | undefined> => idb<Blob>(['data'], 'readonly', (t) => t.objectStore('data').get(id) as IDBRequest<Blob>);
const localPut = (m: SaveMeta, blob: Blob): Promise<unknown> => idb(['meta', 'data'], 'readwrite', (t) => { const { where: _w, ...clean } = m; t.objectStore('meta').put(clean); t.objectStore('data').put(blob, m.id); });
const localDel = (id: string): Promise<unknown> => idb(['meta', 'data'], 'readwrite', (t) => { t.objectStore('meta').delete(id); t.objectStore('data').delete(id); }).catch(() => undefined);

/** Prośba o trwałe przechowywanie (przeglądarka nie wyrzuci zapisów sama przy braku miejsca) */
export async function askPersist(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) || !!(await navigator.storage?.persist?.()); } catch { return false; }
}

// ---------------- pakowanie ----------------
async function pack(obj: unknown): Promise<Blob> {
  const raw = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  if (typeof CompressionStream === 'undefined') return raw;
  return new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
async function unpack<T>(blob: Blob): Promise<T> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const gz = head[0] === 0x1f && head[1] === 0x8b;
  const text = gz ? await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await blob.text();
  return JSON.parse(text) as T;
}

// ---------------- chmura (Supabase Storage) ----------------
let cloudOk = true; // false, gdy kubeł jeszcze nie istnieje albo nie ma sieci — wtedy tylko lokalnie
export const cloudReady = (): boolean => !!me() && cloudOk;
const path = (uid: string, name: string): string => `${uid}/${name}`;
async function cloudIndex(uid: string): Promise<SaveMeta[] | null> {
  const { data, error } = await supa.storage.from(BUCKET).download(path(uid, 'index.json'));
  if (error) {
    // brak spisu = nie ma jeszcze zapisów w chmurze; inny błąd (np. brak kubła) = chmura niedostępna
    const msg = String((error as { message?: string }).message ?? error);
    // najpierw brak kubła (też zawiera „not found”), potem brak samego spisu
    if (/Bucket not found/i.test(msg)) { cloudOk = false; return null; }
    if (/not.?found|Object not found|404/i.test(msg)) return [];
    return null;
  }
  // uszkodzony spis: nie nadpisujemy go jednym wpisem (zniknęłyby wszystkie inne zapisy w chmurze)
  try { const l = JSON.parse(await data.text()) as unknown; return Array.isArray(l) ? (l as SaveMeta[]) : null; } catch { return null; }
}
async function cloudSaveIndex(uid: string, list: SaveMeta[]): Promise<void> {
  const body = new Blob([JSON.stringify(list.map(({ where: _w, ...m }) => m))], { type: 'application/json' });
  const { error } = await supa.storage.from(BUCKET).upload(path(uid, 'index.json'), body, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw new Error(error.message);
}
/** Spis w chmurze zmieniamy po kolei (dwa zapisy naraz nie gubią sobie wpisów) */
let indexQueue: Promise<unknown> = Promise.resolve();
const editIndex = (uid: string, f: (l: SaveMeta[]) => SaveMeta[]): Promise<void> => {
  const job = indexQueue.then(async () => { const cur = await cloudIndex(uid); if (!cur) throw new Error('spis chmury niedostępny'); const g = gone(); await cloudSaveIndex(uid, f(cur).filter((x) => !g.has(x.id))); });
  indexQueue = job.catch(() => undefined);
  return job;
};
async function cloudPut(m: SaveMeta, file: Blob): Promise<boolean> {
  const uid = me()?.id;
  if (!uid || m.owner !== uid || !cloudOk) return false;
  const { error } = await supa.storage.from(BUCKET).upload(path(uid, `${m.id}.p1save`), file, { upsert: true, contentType: 'application/octet-stream', cacheControl: '0' });
  if (error) { console.warn('[zapisy] chmura', error); if (/Bucket not found/i.test(error.message)) cloudOk = false; return false; }
  // plik jest w chmurze, ale bez wpisu w spisie i tak go nie widać — wtedy zgłaszamy niepowodzenie
  try { await editIndex(uid, (l) => [m, ...l.filter((x) => x.id !== m.id)]); } catch (e) { console.warn('[zapisy] spis chmury', e); return false; }
  return true;
}
// Usunięte zapisy (Michał 7.11.2026: „nie zawsze działa usuwanie”): spis w chmurze bywa odczytany sprzed usunięcia
// (pamięć podręczna, autozapis albo druga karta dopisuje swój wpis do starej wersji spisu) i zapis wracał na listę.
// Numer usuniętego zapisu zostaje w przeglądarce: lista go pomija, a każda zmiana spisu w chmurze wycina go ponownie.
const GONE_KEY = 'p1.savesGone';
const gone = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(GONE_KEY) ?? '[]') as string[]); } catch { return new Set(); } };
const markGone = (id: string): void => { try { localStorage.setItem(GONE_KEY, JSON.stringify([...gone(), id].slice(-200))); } catch { /* bez pamięci przeglądarki: zostaje zwykłe usuwanie */ } };

async function cloudDel(id: string): Promise<void> {
  const uid = me()?.id;
  if (!uid || !cloudOk) return;
  const { error } = await supa.storage.from(BUCKET).remove([path(uid, `${id}.p1save`)]);
  if (error) console.warn('[zapisy] usuwanie z chmury', error);
  await editIndex(uid, (l) => l.filter((x) => x.id !== id));
}

// ---------------- zapisy ----------------
const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Zapisy zalogowanego gracza (albo gościa): z tej przeglądarki i z chmury, od najnowszego */
export async function listSaves(): Promise<SaveMeta[]> {
  const owner = ownerNow();
  const local = (await localMetas()).filter((m) => m.owner === owner);
  const byId = new Map<string, SaveMeta>(local.map((m) => [m.id, { ...m, where: 'local' }]));
  if (owner !== 'guest') {
    const cloud = await cloudIndex(owner).catch(() => null);
    const g = gone();
    for (const m of cloud ?? []) { if (g.has(m.id)) continue; const l = byId.get(m.id); byId.set(m.id, l ? { ...l, where: 'both' } : { ...m, where: 'cloud' }); }
  }
  return [...byId.values()].sort((a, b) => b.created - a.created);
}

/**
 * Zapis gry. `replace` — nadpisz ten zapis; autozapis sam zastępuje najstarszy z trzech, szybki zapis jest jeden.
 * Do chmury idzie w tle (gra nie czeka); `onCloud` mówi, czy się udało.
 */
export async function writeSave(meta: Omit<SaveMeta, 'id' | 'created' | 'size' | 'owner' | 'where'>, game: SaveGame, replace?: string, onCloud?: (ok: boolean) => void): Promise<SaveMeta | string> {
  try {
    void askPersist();
    const all = await listSaves();
    let id = replace;
    if (!id && meta.kind === 'quick') id = all.find((m) => m.kind === 'quick')?.id;
    if (!id && meta.kind === 'auto') {
      const autos = all.filter((m) => m.kind === 'auto');
      if (autos.length >= MAX_AUTO) id = autos[autos.length - 1]!.id;
    }
    if (!id && meta.kind === 'manual' && all.filter((m) => m.kind === 'manual').length >= MAX_MANUAL) {
      return tx(`Masz już ${MAX_MANUAL} zapisów — nadpisz albo usuń któryś.`, `You already have ${MAX_MANUAL} saves — overwrite or delete one.`);
    }
    const blob = await pack(game);
    const m: SaveMeta = { ...meta, id: id ?? newId(), owner: ownerNow(), created: Date.now(), size: blob.size };
    await localPut(m, blob);
    if (m.owner !== 'guest') void pack({ meta: m, game }).then((f) => cloudPut(m, f)).then((ok) => onCloud?.(ok), () => onCloud?.(false));
    return m;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    return /quota/i.test(msg) ? tx('Brak miejsca na zapis w przeglądarce — usuń stare zapisy.', 'No room left for saves in the browser — delete some old ones.') : msg;
  }
}

/** Wczytanie zapisu: z tej przeglądarki, a gdy go tu nie ma — z chmury (i od razu kopia lokalna) */
export async function readSave(id: string): Promise<SaveFile | string> {
  try {
    const meta = await idb<SaveMeta>(['meta'], 'readonly', (t) => t.objectStore('meta').get(id) as IDBRequest<SaveMeta>);
    const blob = await localBlob(id);
    if (meta && blob) return { meta, game: await unpack<SaveGame>(blob) };
    const uid = me()?.id;
    if (!uid) return tx('Nie ma już tego zapisu.', 'This save no longer exists.');
    const { data, error } = await supa.storage.from(BUCKET).download(path(uid, `${id}.p1save`));
    if (error || !data) return tx('Nie udało się pobrać zapisu z chmury — sprawdź internet.', 'Could not download the save from the cloud — check your connection.');
    const f = await unpack<SaveFile>(data);
    void pack(f.game).then((b) => localPut(f.meta, b)).catch(() => undefined); // kopia w przeglądarce — bez niej też działa
    return f;
  } catch (e) { return (e as Error).message; }
}

export async function deleteSave(id: string): Promise<void> {
  markGone(id);
  await localDel(id);
  await cloudDel(id).catch(() => undefined);
}

export async function renameSave(id: string, name: string): Promise<string | null> {
  const f = await readSave(id);
  if (typeof f === 'string') return f;
  const m: SaveMeta = { ...f.meta, name: name.trim().slice(0, 40) || f.meta.name };
  await localPut(m, await pack(f.game));
  if (m.owner !== 'guest') await cloudPut(m, await pack({ meta: m, game: f.game }));
  return null;
}

/** Wyślij do chmury zapis, który jest tylko w tej przeglądarce (np. zrobiony przed zalogowaniem albo bez sieci) */
export async function uploadSave(id: string): Promise<boolean> {
  const f = await readSave(id);
  if (typeof f === 'string' || !me()) return false;
  const m = { ...f.meta, owner: me()!.id };
  await localPut(m, await pack(f.game));
  return cloudPut(m, await pack({ meta: m, game: f.game }));
}

/** Plik do pobrania (kopia, przeniesienie bez konta) */
export async function exportSave(id: string): Promise<string | null> {
  const f = await readSave(id);
  if (typeof f === 'string') return f;
  const blob = await pack(f);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${f.meta.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-') || 'zapis'}.p1save`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return null;
}

/** Plik .p1save z dysku → nowy zapis ręczny tego konta */
export async function importSave(file: File): Promise<SaveMeta | string> {
  try {
    const f = await unpack<SaveFile>(file);
    if (!f?.meta || !f.game) return tx('To nie jest zapis Project-1.', 'This is not a Project-1 save.');
    const { id: _i, created: _c, size: _s, owner: _o, where: _w, ...rest } = f.meta;
    return await writeSave({ ...rest, kind: 'manual', name: rest.name || file.name.replace(/\.p1save$/, '') }, f.game);
  } catch { return tx('Nie udało się odczytać pliku — to nie jest zapis Project-1.', 'Could not read the file — this is not a Project-1 save.'); }
}

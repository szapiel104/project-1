import { tx } from '../i18n';

/**
 * Zapisy gry (Michał 2.11.2026): do 20 zapisów ręcznych, 3 autozapisy po kolei i szybki zapis (Ctrl+S), każdy
 * z miniaturą miejsca, datą i opisem. Tylko gry z botami — mecz przez sieć się nie zapisuje.
 *
 * Gdzie leżą:
 * 1. W bazie przeglądarki (IndexedDB, nie localStorage z limitem ok. 5 MB) — z prośbą do przeglądarki o trwałe
 *    przechowywanie (`navigator.storage.persist`), więc czyszczenie pamięci podręcznej ich nie rusza.
 * 2. Dodatkowo w zwykłym folderze na dysku (Chrome, Edge: wskazujesz np. Dokumenty/Project-1): każdy zapis to plik
 *    `.p1save`. Przeżywa wyczyszczenie wszystkich danych przeglądarki, da się go skopiować na inny komputer
 *    i wczytać stamtąd po wskazaniu folderu. Przeglądarka nie pozwala stronie samej pisać do AppData — folder
 *    wybiera gracz, raz, a potem po każdym uruchomieniu wystarczy jedno kliknięcie „Zezwól”.
 * 3. Eksport i import pojedynczego pliku `.p1save` (każda przeglądarka, także Firefox i Safari).
 * Baza w chmurze (Supabase) zostaje na konta i znajomych — zapisy po kilka MB szybko by ją zapchały.
 *
 * Plik `.p1save` = JSON spakowany gzipem: { meta, game }.
 */
export type SaveKind = 'manual' | 'auto' | 'quick';
export interface SaveMeta {
  id: string;
  name: string;
  kind: SaveKind;
  created: number;
  /** wersja gry, która zapisała */
  build: string;
  preset: string;
  seedText: string;
  day: number;
  hour: number;
  people: number;
  soldiers: number;
  buildings: number;
  gold: number;
  /** poziom botów 0–3 (gdy znany) */
  level?: number;
  dev?: boolean;
  /** miniatura miejsca zapisu (JPEG, ok. 320×180) */
  thumb: string;
  /** rozmiar spakowanego zapisu w bajtach */
  size?: number;
  /** zapis tylko w folderze na dysku (nie ma go w bazie przeglądarki) */
  diskOnly?: boolean;
}
export interface SaveGame { seedText: string; data: unknown; ui?: unknown }
export interface SaveFile { meta: SaveMeta; game: SaveGame }

export const MAX_MANUAL = 20;
export const MAX_AUTO = 3;

// ---------------- IndexedDB ----------------
const DB = 'project1-saves';
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbP ??= new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('data')) d.createObjectStore('data');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbP;
}
function tx_<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((ok, bad) => {
    const t = d.transaction(stores, mode);
    const req = run(t);
    t.oncomplete = () => ok(req ? req.result : undefined);
    t.onerror = () => bad(t.error);
    t.onabort = () => bad(t.error ?? new Error('abort'));
  }));
}
const kvGet = <T>(k: string): Promise<T | undefined> => tx_<T>(['kv'], 'readonly', (t) => t.objectStore('kv').get(k) as IDBRequest<T>);
const kvSet = (k: string, v: unknown): Promise<unknown> => tx_(['kv'], 'readwrite', (t) => t.objectStore('kv').put(v, k));

/** Prośba o trwałe przechowywanie (przeglądarka nie usunie zapisów przy braku miejsca ani przy czyszczeniu pamięci podręcznej) */
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

// ---------------- folder na dysku (File System Access API) ----------------
interface DirHandle { name: string; queryPermission(o: { mode: string }): Promise<string>; requestPermission(o: { mode: string }): Promise<string>; getFileHandle(n: string, o?: { create?: boolean }): Promise<FileHandleT>; removeEntry(n: string): Promise<void>; values(): AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> }> }
interface FileHandleT { getFile(): Promise<File>; createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }
export type FolderState = 'unsupported' | 'none' | 'prompt' | 'granted';
export const folderSupported = (): boolean => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
let dir: DirHandle | null = null;
let dirState: FolderState = folderSupported() ? 'none' : 'unsupported';
export const folderState = (): FolderState => dirState;
export const folderName = (): string => dir?.name ?? '';
/** Po starcie: czy pamiętamy folder i czy mamy do niego prawo (bez pytania gracza) */
export async function initFolder(): Promise<FolderState> {
  if (!folderSupported()) return (dirState = 'unsupported');
  try {
    dir = (await kvGet<DirHandle>('folder')) ?? null;
    if (!dir) return (dirState = 'none');
    const p = await dir.queryPermission({ mode: 'readwrite' });
    return (dirState = p === 'granted' ? 'granted' : 'prompt');
  } catch { return (dirState = 'none'); }
}
/** Wybór folderu (okno systemowe) — potem wszystkie zapisy z bazy przeglądarki trafiają też do niego */
export async function pickFolder(): Promise<string | null> {
  try {
    const h = await (window as unknown as { showDirectoryPicker(o: unknown): Promise<DirHandle> }).showDirectoryPicker({ id: 'project1-saves', mode: 'readwrite', startIn: 'documents' });
    dir = h; dirState = 'granted';
    await kvSet('folder', h);
    await mirrorAll();
    return null;
  } catch (e) { return (e as Error).name === 'AbortError' ? '' : (e as Error).message; }
}
/** Po ponownym uruchomieniu przeglądarka pyta o zgodę — jedno kliknięcie w menu zapisów */
export async function reconnectFolder(): Promise<boolean> {
  if (!dir) return false;
  try { dirState = (await dir.requestPermission({ mode: 'readwrite' })) === 'granted' ? 'granted' : 'prompt'; } catch { dirState = 'prompt'; }
  if (dirState === 'granted') await mirrorAll();
  return dirState === 'granted';
}
export async function forgetFolder(): Promise<void> { dir = null; dirState = folderSupported() ? 'none' : 'unsupported'; await kvSet('folder', null); }
const fileName = (m: SaveMeta): string => `${m.kind === 'manual' ? '' : m.kind === 'auto' ? 'autozapis-' : 'szybki-'}${m.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 40).replace(/\s+/g, '-') || 'zapis'}-${m.id}.p1save`;
async function diskWrite(m: SaveMeta, blob: Blob): Promise<void> {
  if (!dir || dirState !== 'granted') return;
  try {
    // stary plik tego zapisu (np. pod inną nazwą) znika
    for await (const e of dir.values()) if (e.kind === 'file' && e.name.endsWith(`-${m.id}.p1save`) && e.name !== fileName(m)) await dir.removeEntry(e.name).catch(() => undefined);
    const fh = await dir.getFileHandle(fileName(m), { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
  } catch (e) { console.warn('[zapisy] folder', e); }
}
async function diskDelete(id: string): Promise<void> {
  if (!dir || dirState !== 'granted') return;
  try { for await (const e of dir.values()) if (e.kind === 'file' && e.name.endsWith(`-${id}.p1save`)) await dir.removeEntry(e.name); } catch { /* nic */ }
}
/** Pliki z folderu (meta z pamięci podręcznej po nazwie i dacie, żeby nie rozpakowywać wszystkich przy każdym otwarciu) */
async function diskList(): Promise<Map<string, { meta: SaveMeta; file: File }>> {
  const out = new Map<string, { meta: SaveMeta; file: File }>();
  if (!dir || dirState !== 'granted') return out;
  const cache = (await kvGet<Record<string, { t: number; meta: SaveMeta }>>('diskmeta')) ?? {};
  const next: typeof cache = {};
  try {
    for await (const e of dir.values()) {
      if (e.kind !== 'file' || !e.name.endsWith('.p1save') || !e.getFile) continue;
      const f = await e.getFile();
      const hit = cache[e.name];
      let meta = hit && hit.t === f.lastModified ? hit.meta : null;
      if (!meta) { try { meta = (await unpack<SaveFile>(f)).meta; } catch { continue; } }
      next[e.name] = { t: f.lastModified, meta };
      out.set(meta.id, { meta, file: f });
    }
  } catch (e) { console.warn('[zapisy] folder', e); }
  await kvSet('diskmeta', next);
  return out;
}
/** Wszystkie zapisy z bazy przeglądarki do folderu (po wybraniu albo ponownym połączeniu folderu) */
async function mirrorAll(): Promise<void> {
  const metas = (await tx_<SaveMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').getAll() as IDBRequest<SaveMeta[]>)) ?? [];
  const onDisk = await diskList();
  for (const m of metas) {
    if (onDisk.has(m.id)) continue;
    const blob = await tx_<Blob>(['data'], 'readonly', (t) => t.objectStore('data').get(m.id) as IDBRequest<Blob>);
    if (blob) await diskWrite(m, await pack({ meta: m, game: await unpack<SaveGame>(blob) }));
  }
}

// ---------------- zapisy ----------------
const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Lista zapisów: z bazy przeglądarki i z folderu na dysku, od najnowszego */
export async function listSaves(): Promise<SaveMeta[]> {
  const metas = (await tx_<SaveMeta[]>(['meta'], 'readonly', (t) => t.objectStore('meta').getAll() as IDBRequest<SaveMeta[]>).catch(() => [])) ?? [];
  const byId = new Map(metas.map((m) => [m.id, m]));
  for (const [id, d] of await diskList()) if (!byId.has(id)) byId.set(id, { ...d.meta, diskOnly: true });
  return [...byId.values()].sort((a, b) => b.created - a.created);
}

/**
 * Zapis gry. `replace` — nadpisz ten zapis (ten sam slot); autozapis sam zastępuje najstarszy z trzech,
 * szybki zapis jest jeden. Zwraca błąd albo null.
 */
export async function writeSave(meta: Omit<SaveMeta, 'id' | 'created' | 'size'>, game: SaveGame, replace?: string): Promise<SaveMeta | string> {
  try {
    void askPersist();
    const all = await listSaves();
    let id = replace;
    if (!id && meta.kind === 'quick') id = all.find((m) => m.kind === 'quick')?.id;
    if (!id && meta.kind === 'auto') {
      const autos = all.filter((m) => m.kind === 'auto');
      if (autos.length >= MAX_AUTO) id = autos[autos.length - 1]!.id; // najstarszy autozapis
    }
    if (!id && meta.kind === 'manual' && all.filter((m) => m.kind === 'manual').length >= MAX_MANUAL) {
      return tx(`Masz już ${MAX_MANUAL} zapisów — nadpisz albo usuń któryś.`, `You already have ${MAX_MANUAL} saves — overwrite or delete one.`);
    }
    const blob = await pack(game);
    const m: SaveMeta = { ...meta, id: id ?? newId(), created: Date.now(), size: blob.size };
    await tx_(['meta', 'data'], 'readwrite', (t) => { t.objectStore('meta').put(m); t.objectStore('data').put(blob, m.id); });
    if (dirState === 'granted') void pack({ meta: m, game }).then((b) => diskWrite(m, b));
    return m;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    return /quota/i.test(msg) ? tx('Brak miejsca na zapis w przeglądarce — usuń stare zapisy.', 'No room left for saves in the browser — delete some old ones.') : msg;
  }
}

/** Wczytanie zapisu (z bazy przeglądarki albo z pliku w folderze) */
export async function readSave(id: string): Promise<SaveFile | string> {
  try {
    const meta = await tx_<SaveMeta>(['meta'], 'readonly', (t) => t.objectStore('meta').get(id) as IDBRequest<SaveMeta>);
    const blob = await tx_<Blob>(['data'], 'readonly', (t) => t.objectStore('data').get(id) as IDBRequest<Blob>);
    if (meta && blob) return { meta, game: await unpack<SaveGame>(blob) };
    const d = (await diskList()).get(id);
    if (d) return await unpack<SaveFile>(d.file);
    return tx('Nie ma już tego zapisu.', 'This save no longer exists.');
  } catch (e) { return (e as Error).message; }
}

export async function deleteSave(id: string): Promise<void> {
  await tx_(['meta', 'data'], 'readwrite', (t) => { t.objectStore('meta').delete(id); t.objectStore('data').delete(id); }).catch(() => undefined);
  await diskDelete(id);
}

export async function renameSave(id: string, name: string): Promise<void> {
  const meta = await tx_<SaveMeta>(['meta'], 'readonly', (t) => t.objectStore('meta').get(id) as IDBRequest<SaveMeta>);
  if (!meta) return;
  const m = { ...meta, name: name.trim().slice(0, 40) || meta.name };
  await tx_(['meta'], 'readwrite', (t) => t.objectStore('meta').put(m));
  if (dirState === 'granted') { const f = await readSave(id); if (typeof f !== 'string') await diskWrite(m, await pack({ meta: m, game: f.game })); }
}

/** Plik do pobrania (przeniesienie na inny komputer, kopia) */
export async function exportSave(id: string): Promise<string | null> {
  const f = await readSave(id);
  if (typeof f === 'string') return f;
  const blob = await pack(f);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(f.meta);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return null;
}

/** Plik .p1save z dysku → nowy zapis ręczny */
export async function importSave(file: File): Promise<SaveMeta | string> {
  try {
    const f = await unpack<SaveFile>(file);
    if (!f?.meta || !f.game) return tx('To nie jest zapis Project-1.', 'This is not a Project-1 save.');
    const { id: _i, created: _c, size: _s, diskOnly: _d, ...rest } = f.meta;
    return await writeSave({ ...rest, kind: 'manual', name: rest.name || file.name.replace(/\.p1save$/, '') }, f.game);
  } catch { return tx('Nie udało się odczytać pliku — to nie jest zapis Project-1.', 'Could not read the file — this is not a Project-1 save.'); }
}

/** Najnowszy zapis (do „Kontynuuj”) */
export async function latestSave(): Promise<SaveMeta | null> {
  return (await listSaves())[0] ?? null;
}

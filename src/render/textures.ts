import * as THREE from 'three';
import { loadTexture } from './ktx';
import { TEST } from '../testmode';

import { PAINT, grain, paintInto, painter, type Kind } from './texpaint';
export type { Kind } from './texpaint';
export { KINDS } from './texpaint';
const cache = new Map<Kind, THREE.CanvasTexture>();

/**
 * Tekstury rysowane kodem, w odcieniach szarości: kolor nadaje materiał, tekstura tylko wzór.
 * Dzięki temu jeden wzór cegieł służy jasnemu i ciemnemu kamieniowi oraz barwom drużyn.
 */
/** Rysuje teksturę od zera (wolne: ziarno liczone piksel po pikselu). */
const size = (kind: Kind): number => (TEST ? 256 : kind === 'cobble' || kind === 'ashlar' || kind === 'bricks' || kind === 'dressed' || kind === 'slate' || kind === 'grass' ? 2048 : 1024);
function paint(kind: Kind, n: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  paintInto(ctx, kind, n);
  return canvas;
}

// --- pamięć gotowych tekstur w przeglądarce (IndexedDB): drugie wejście nie rysuje ich od nowa ---
const stored = new Map<Kind, HTMLCanvasElement>();
const DB = 'project1-tex';
/** Klucz zmienia się razem z kodem rysującym, więc po zmianie wyglądu tekstura rysuje się na nowo */
function keyOf(kind: Kind, n: number): string {
  const src = String(PAINT[painter(kind)]) + String(grain);
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  return `${kind}-${n}-${(h >>> 0).toString(36)}`;
}
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('t');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
let dbp: Promise<IDBDatabase | null> | null = null;
const db = (): Promise<IDBDatabase | null> => (dbp ??= TEST ? Promise.resolve(null) : openDb());
function remember(kind: Kind, n: number, canvas: HTMLCanvasElement): void {
  canvas.toBlob(async (blob) => {
    const d = await db();
    if (!blob || !d) return;
    try { d.transaction('t', 'readwrite').objectStore('t').put(blob, keyOf(kind, n)); } catch { /* brak miejsca: trudno */ }
  }, 'image/png');
}
/** Czy tę teksturę trzeba rysować z kodu (zdjęciowe przychodzą z plików i nie są rysowane) */
export const needsPaint = (kind: Kind): boolean => !PHOTO[kind] || TEST;

/**
 * Rysuje podane tekstury w kilku wątkach w tle naraz (texworker.ts, OffscreenCanvas) — każdy rdzeń procesora inną.
 * Gotowe trafiają tam, gdzie zapamiętane z poprzedniej wizyty (`stored`), i do pamięci przeglądarki (`remember`),
 * więc `pattern()` już ich nie rysuje. Zwraca rodzaje, których nie udało się narysować w tle (te rysuje potem wątek
 * główny, jak dawniej) — np. przeglądarka bez OffscreenCanvas albo wątek się nie wczytał.
 */
export async function paintInBackground(kinds: Kind[], onDone?: (kind: Kind) => void): Promise<Kind[]> {
  const todo = kinds.filter((k) => !stored.has(k) && !cache.has(k));
  if (!todo.length || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof document === 'undefined') return todo;
  const cores = navigator.hardwareConcurrency || 4;
  // największe najpierw (2048 px rysuje się ok. 4× dłużej), żeby na końcu nie czekać na jedną dużą
  const queue = [...todo].sort((a, b) => size(b) - size(a));
  const failed: Kind[] = [];
  const run = (): Promise<void> => new Promise((finish) => {
    let w: Worker;
    try { w = new Worker(new URL('./texworker.ts', import.meta.url), { type: 'module' }); } catch { finish(); return; }
    let current: Kind | undefined;
    const next = (): void => {
      current = queue.shift();
      if (!current) { w.terminate(); finish(); return; }
      w.postMessage({ kind: current, n: size(current) });
    };
    w.onmessage = (e: MessageEvent<{ kind: Kind; bmp?: ImageBitmap; error?: string }>): void => {
      const { kind, bmp } = e.data;
      if (bmp) {
        const n = size(kind), c = document.createElement('canvas');
        c.width = c.height = n;
        c.getContext('2d')!.drawImage(bmp, 0, 0);
        bmp.close();
        stored.set(kind, c);
        remember(kind, n, c);
        onDone?.(kind);
      } else failed.push(kind);
      next();
    };
    // wątek się nie wczytał albo padł: jego bieżąca tekstura wraca do kolejki dla pozostałych albo wątku głównego
    w.onerror = (): void => { if (current) failed.push(current); current = undefined; w.terminate(); finish(); };
    next();
  });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(todo.length, cores - 1, 6)) }, run));
  return [...failed, ...queue];
}

/** Wczytuje zapamiętaną teksturę, jeśli jest; zwraca true, gdy nie trzeba jej rysować */
export async function restore(kind: Kind): Promise<boolean> {
  const n = size(kind);
  const d = await db();
  if (!d) return false;
  const blob = await new Promise<Blob | undefined>((ok) => {
    try { const rq = d.transaction('t').objectStore('t').get(keyOf(kind, n)); rq.onsuccess = () => ok(rq.result as Blob | undefined); rq.onerror = () => ok(undefined); } catch { ok(undefined); }
  });
  if (!blob) return false;
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = c.height = n;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    stored.set(kind, c);
    return true;
  } catch { return false; }
}

/**
 * Zdjęciowe tekstury CC0 (ambientCG, Poly Haven) — w odcieniach szarości,
 * żeby barwę nadawał materiał, plus mapy normalnych dające prawdziwą rzeźbę: bruk, deski, tynk.
 */
const PHOTO: Partial<Record<Kind, string>> = { cobble: 'cobble', planks: 'planks', plaster: 'plaster', thatch: 'thatch', slate: 'slate', ashlar: 'ashlar', bricks: 'bricks', burlap: 'burlap', grass: 'grass', soil: 'soil', rock: 'rock', bark: 'bark', wool: 'wool', iron: 'iron', mail: 'mail' };
const photoBase = (): string => ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './') + 'textures/cc0/';
/** Adresy wszystkich zdjęciowych tekstur (kolor i mapa normalnych) — do wcześniejszego pobrania (prefetch.ts) */
export const photoUrls = (): string[] => Object.values(PHOTO).flatMap((f) => [`${photoBase()}${f}.jpg`, `${photoBase()}${f}_n.jpg`]);
const normals = new Map<Kind, THREE.Texture>();
const loading: Promise<void>[] = [];
/** Wczytuje zdjęciową teksturę i zapamiętuje, kiedy dojdzie (albo się nie uda) — patrz texturesReady */
const loadPhoto = (url: string): THREE.Texture => {
  let done = (): void => {};
  loading.push(new Promise<void>((r) => { done = r; }));
  return loadTexture(url, () => done());
};
/** Obietnica spełniona, gdy wszystkie dotąd zamówione tekstury zdjęciowe są już wczytane */
export const texturesReady = (): Promise<void> => Promise.all(loading).then(() => undefined);
const photos = new Map<Kind, THREE.Texture>();
/** Mapa normalnych dla zdjęciowej tekstury (albo null, gdy wzór jest rysowany w kodzie) */
export function normal(kind: Kind): THREE.Texture | null {
  const f = PHOTO[kind];
  if (!f || typeof document === 'undefined' || TEST) return null;
  let n = normals.get(kind);
  if (!n) {
    n = loadPhoto(`${photoBase()}${f}_n.jpg`);
    n.wrapS = n.wrapT = THREE.RepeatWrapping;
    n.anisotropy = 8;
    normals.set(kind, n);
  }
  return n;
}

export function pattern(kind: Kind): THREE.Texture | null {
  let t = cache.get(kind);
  if (t) return t;
  if (typeof document === 'undefined') return null;
  const photo = PHOTO[kind];
  if (photo && !TEST) {
    let pt = photos.get(kind);
    if (!pt) {
      pt = loadPhoto(`${photoBase()}${photo}.jpg`);
      pt.wrapS = pt.wrapT = THREE.RepeatWrapping;
      pt.colorSpace = THREE.SRGBColorSpace;
      pt.anisotropy = 16;
      photos.set(kind, pt);
    }
    return pt;
  }
  // bruk w 2048 px, mur twierdzy 1024, reszta 512
  // tylko komputery: wysoka rozdzielczość wszędzie (bruk, mur, trawa 2048, reszta 1024)
  const n = size(kind);
  const canvas = stored.get(kind) ?? paint(kind, n);
  if (!canvas) return null;
  if (!stored.has(kind)) remember(kind, n, canvas);
  t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  cache.set(kind, t);
  return t;
}

const bumps = new Map<Kind, THREE.CanvasTexture>();
/** Ta sama tekstura jako mapa wypukłości: jasne miejsca wystają, fugi i szpary są wgłębione. */
export function bump(kind: Kind): THREE.Texture | null {
  if (PHOTO[kind] && !TEST) return null; // zdjęciowe mają mapę normalnych
  let b = bumps.get(kind);
  if (b) return b;
  const src = pattern(kind);
  if (!src) return null;
  b = new THREE.CanvasTexture(src.image as HTMLCanvasElement);
  b.wrapS = b.wrapT = THREE.RepeatWrapping;
  bumps.set(kind, b);
  return b;
}


const grays = new Map<Kind, THREE.CanvasTexture>();
/**
 * Szara wersja tekstury (jasność średnio ok. 0,9, w przestrzeni liniowej): sam splot, słoje albo ziarno, bez barwy.
 * Do rzeczy, których kolor daje gra (ubrania w barwach pana, suknie, pranie) — zdjęciowa juta zabarwiłaby je na brązowo.
 * Wypełnia się, gdy wczyta się zdjęcie (albo od razu, gdy wzór jest rysowany w kodzie).
 */
export function grayPattern(kind: Kind, max = 512): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const have = grays.get(kind);
  if (have) return have;
  // zdjęcie wczytujemy osobno jako zwykły obraz: tekstura z pattern() bywa skompresowana (KTX2) i nie da się jej narysować
  const photo = PHOTO[kind] && !TEST ? new THREE.ImageLoader().load(`${photoBase()}${PHOTO[kind]}.jpg`) : null;
  const src = photo ? null : pattern(kind);
  if (!photo && !src) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) { ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, 4, 4); }
  const out = new THREE.CanvasTexture(canvas);
  out.wrapS = out.wrapT = THREE.RepeatWrapping;
  out.colorSpace = THREE.NoColorSpace;
  out.anisotropy = 8;
  grays.set(kind, out);
  const fill = (): boolean => {
    const img = (photo ?? src!.image) as (CanvasImageSource & { width: number; height: number; complete?: boolean }) | undefined;
    if (photo && !photo.complete) return false;
    if (!ctx || !img || !img.width) return false;
    const n = Math.min(max, img.width);
    canvas.width = canvas.height = n;
    ctx.drawImage(img, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n), px = d.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i]! * 0.3 + px[i + 1]! * 0.59 + px[i + 2]! * 0.11;
    const mean = Math.max(1, sum / (px.length / 4));
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i]! * 0.3 + px[i + 1]! * 0.59 + px[i + 2]! * 0.11) / mean;
      const v = Math.max(0, Math.min(255, Math.round((0.9 + (l - 1) * 0.8) * 255)));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    // płótno urosło z 4×4 do pełnego rozmiaru: karta ma już teksturę 4×4 o stałym rozmiarze (texStorage), więc samo
    // needsUpdate kończyło się błędem GL „offset overflows texture dimensions” i szara wersja zostawała pustym 4×4.
    // dispose() zwalnia starą teksturę na karcie; przy następnym rysowaniu powstaje nowa, już w dobrym rozmiarze.
    out.dispose();
    out.needsUpdate = true;
    return true;
  };
  if (!fill()) { const iv = setInterval(() => { if (fill()) clearInterval(iv); }, 250); setTimeout(() => clearInterval(iv), 30000); }
  return out;
}

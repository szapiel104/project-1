import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { report } from '../debug/errlog';

/**
 * Tekstury skompresowane dla karty graficznej (KTX2 / Basis Universal, robione przez tools/textures/ktx2.mjs).
 * Karta trzyma je w swoim formacie (BC1/BC7 na komputerach): ok. 6–8× mniej pamięci niż JPG rozpakowany do RGBA,
 * a przeglądarka nie dekoduje dużych obrazków w trakcie gry (mniej zacięć, gdy do kadru wchodzi nowa tekstura).
 *
 * `loadTexture('…/grass1.jpg')` od razu oddaje obiekt tekstury (materiały mogą go mieć od początku), a w tle
 * wczytuje `grass1.ktx2`; gdy plik KTX2 nie dojdzie albo karta/przeglądarka go nie obsłuży — zwykły JPG.
 * Pliki KTX2 są zakodowane z odwróconą osią Y, więc wyglądają tak samo jak JPG wczytany z flipY.
 */
const base = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';

let ktx: KTX2Loader | null = null;
let resolveReady: (l: KTX2Loader | null) => void = () => {};
const ready = new Promise<KTX2Loader | null>((r) => { resolveReady = r; });
// bez kart graficznej (podgląd, który nie zgłosił renderera) po chwili zwykłe JPG
if (typeof window !== 'undefined') setTimeout(() => resolveReady(null), 6000);

/** Zgłoszenie renderera (potrzebny do sprawdzenia, jakie formaty obsługuje karta). Wystarczy raz. */
export function initKtx(renderer: THREE.WebGLRenderer): void {
  if (ktx) return;
  try {
    ktx = new KTX2Loader().setTranscoderPath(base() + 'basis/').detectSupport(renderer);
    resolveReady(ktx);
  } catch {
    resolveReady(null);
  }
}

/** Gotowa tekstura z KTX2 przepisana do obiektu, który materiały już mają */
function adopt(t: THREE.Texture, c: THREE.CompressedTexture): void {
  const tt = t as unknown as { isCompressedTexture: boolean; mipmaps: unknown[] } & THREE.Texture;
  tt.isCompressedTexture = true;
  (tt as unknown as { mipmaps: unknown[] }).mipmaps = c.mipmaps as unknown[];
  tt.image = c.image;
  tt.format = c.format;
  tt.type = c.type;
  tt.generateMipmaps = false;
  tt.flipY = false;
  tt.minFilter = c.mipmaps && c.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tt.needsUpdate = true;
}

/**
 * Kopie tekstury (gra robi je dla innej skali, np. deski podłóg, kafle terenu) dzielą obraz z oryginałem; kopia
 * zrobiona przed wczytaniem musi też dostać dane KTX2, inaczej karta próbuje wgrać ją jak zwykły obrazek.
 */
function trackClones(t: THREE.Texture, linked: THREE.Texture[], state: { c: THREE.CompressedTexture | null }): void {
  const plain = THREE.Texture.prototype.clone;
  t.clone = function (this: THREE.Texture): THREE.Texture {
    const k = plain.call(this) as THREE.Texture;
    if (state.c) adopt(k, state.c); else linked.push(k);
    trackClones(k, linked, state);
    return k;
  } as typeof t.clone;
}

/** Tekstura z pliku `.jpg` — w praktyce z `.ktx2` obok niego, JPG tylko w zapasie. `done` po wczytaniu (albo błędzie). */
export function loadTexture(url: string, done?: () => void): THREE.Texture {
  const t = new THREE.Texture();
  const linked: THREE.Texture[] = [];
  const state: { c: THREE.CompressedTexture | null } = { c: null };
  trackClones(t, linked, state);
  const finish = (): void => done?.();
  const jpg = (): void => {
    new THREE.ImageLoader().load(url, (img) => { t.image = img; t.needsUpdate = true; for (const k of linked) k.needsUpdate = true; finish(); }, undefined, () => { report('resource', 'error', `nie wczytano tekstury: ${url}`); finish(); });
  };
  if (typeof document === 'undefined') return t;
  void ready.then((l) => {
    if (!l) { jpg(); return; }
    l.load(url.replace(/\.jpg(\?|$)/, '.ktx2$1'), (c) => {
      state.c = c as THREE.CompressedTexture;
      adopt(t, state.c);
      for (const k of linked) adopt(k, state.c);
      finish();
    }, undefined, () => { report('resource', 'warn', `brak .ktx2, wczytuję zapasowy .jpg: ${url}`); jpg(); });
  });
  return t;
}

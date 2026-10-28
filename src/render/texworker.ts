/// <reference lib="webworker" />
/**
 * Rysowanie tekstur z kodu w wątku w tle (OffscreenCanvas). Kilka takich wątków rysuje naraz, każdy na innym rdzeniu
 * procesora — przy pierwszym wejściu (potem tekstury są w pamięci przeglądarki, textures.ts → restore).
 * Protokół: { kind, n } → { kind, bmp } (ImageBitmap przekazany bez kopiowania) albo { kind, error }.
 */
import { paintInto, type Kind } from './texpaint';

self.onmessage = (e: MessageEvent<{ kind: Kind; n: number }>): void => {
  const { kind, n } = e.data;
  try {
    const canvas = new OffscreenCanvas(n, n);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('brak płótna 2D');
    paintInto(ctx, kind, n);
    const bmp = canvas.transferToImageBitmap();
    (self as unknown as Worker).postMessage({ kind, bmp }, [bmp]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ kind, error: String(err) });
  }
};

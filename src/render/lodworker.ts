/// <reference lib="webworker" />
import { coreReady, simplifyAll, type BucketData } from './lodcore';

/** Osobny wątek: upraszcza budynki w tle, żeby gra nie przycinała się przy pierwszym oddaleniu kamery */
self.onmessage = async (e: MessageEvent<{ id: number; buckets: BucketData[]; steps: number[] }>) => {
  const { id, buckets, steps } = e.data;
  try {
    await coreReady;
    const levels = simplifyAll(buckets, steps);
    const transfer: Transferable[] = [];
    for (const l of levels) for (const g of l.geos) if (g) transfer.push(g.P.buffer, g.N.buffer, g.C.buffer, g.UV.buffer);
    (self as unknown as Worker).postMessage({ id, levels }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};

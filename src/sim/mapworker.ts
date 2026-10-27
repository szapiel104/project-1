/// <reference lib="webworker" />
/**
 * Generowanie nowej mapy w osobnym wątku (podgląd przy „Nowej grze”): `createGame` liczy teren, lasy, złoża
 * i twierdze ok. 150–300 ms, a w wątku głównym zatrzymywało to menu przy każdym „Losuj inną mapę”.
 *
 * Protokół: { id, seed, preset, level, dev, walls } → { id, state } albo { id, error }.
 * Wynik jest ten sam co z `createGame` w wątku głównym (deterministyczny generator z ziarnem);
 * po drugiej stronie (mapthread.ts) przywracamy tylko prototyp `Rng`.
 */
import { createGame, type DevWalls } from './state';
import type { MapPresetId } from '../data/maps';

export interface MapJob { id: number; seed: number; preset: MapPresetId; level: number; dev: boolean; walls: DevWalls }

self.onmessage = (e: MessageEvent): void => {
  const m = e.data as MapJob;
  try {
    const state = createGame(m.seed, m.preset, m.level, m.dev, undefined, true, m.walls);
    (self as unknown as Worker).postMessage({ id: m.id, state });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: String(err) });
  }
};

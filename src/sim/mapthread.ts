/**
 * Nowa gra policzona w osobnym wątku (mapworker.ts), żeby menu nie stawało przy generowaniu mapy.
 * Gdy przeglądarka nie umie wątków modułowych albo wątek padnie, mapa liczy się po staremu w wątku głównym.
 */
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { Rng } from './rng';
import { createGame, type DevWalls, type GameState } from './state';

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: (g: GameState) => void; fallback: () => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    const w = new Worker(new URL('./mapworker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent): void => {
      const m = e.data as { id: number; state?: GameState; error?: string };
      const job = waiting.get(m.id);
      if (!job) return;
      waiting.delete(m.id);
      if (!m.state) { console.warn('Wątek mapy:', m.error); job.fallback(); return; }
      Object.setPrototypeOf(m.state.rng, Rng.prototype);
      job.resolve(m.state);
    };
    const broken = (): void => {
      // wątek się nie wczytał albo padł: wszystko, co czeka, i każda następna mapa liczy się w wątku głównym
      worker = null;
      w.terminate();
      for (const job of waiting.values()) job.fallback();
      waiting.clear();
    };
    w.onerror = broken;
    w.onmessageerror = broken;
    return (worker = w);
  } catch {
    return (worker = null);
  }
}

/** To samo co `createGame(seed, preset, level, dev, undefined, true, walls)`, ale bez zatrzymywania strony */
export function createGameAsync(seed: number, preset: MapPresetId, level: number, dev: boolean, walls: DevWalls): Promise<GameState> {
  const local = (): GameState => createGame(seed, preset, level, dev, undefined, true, walls);
  const w = getWorker();
  if (!w || !(preset in MAP_PRESETS)) return Promise.resolve().then(local);
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, fallback: () => { try { resolve(local()); } catch (e) { reject(e); } } });
    w.postMessage({ id, seed, preset, level, dev, walls });
  });
}

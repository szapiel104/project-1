import { Rng } from './rng';
import type { GameState } from './state';
import type { Command } from './step';

/** Wynik porcji kroków policzonej w wątku symulacji */
export interface SimResult { state: GameState; gen: number; ms: number; ticks: number }

/**
 * Wątek symulacji (patrz worker.ts). `null`, gdy przeglądarka nie umie wątków modułowych — wtedy gra liczy po staremu
 * w wątku głównym.
 */
export interface SimThread {
  set(state: GameState, gen: number): void;
  run(ticks: number, cmds: Command[], gen: number): void;
  onResult: (r: SimResult) => void;
  /** Wątek się nie wczytał albo padł — gra wraca do liczenia w wątku głównym */
  onError: () => void;
}

export function createSimThread(): SimThread | null {
  if (typeof Worker === 'undefined') return null;
  let w: Worker;
  try { w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); } catch { return null; }
  const t: SimThread = {
    set: (state, gen) => w.postMessage({ type: 'set', gen, state }),
    run: (ticks, cmds, gen) => w.postMessage({ type: 'run', gen, ticks, cmds }),
    onResult: () => {},
    onError: () => {},
  };
  w.onerror = (): void => t.onError();
  w.onmessageerror = (): void => t.onError();
  w.onmessage = (e: MessageEvent): void => {
    const m = e.data as { type: string; gen: number; state: GameState; ms: number; ticks: number };
    if (m.type !== 'state') return;
    Object.setPrototypeOf(m.state.rng, Rng.prototype);
    t.onResult({ state: m.state, gen: m.gen, ms: m.ms, ticks: m.ticks });
  };
  return t;
}

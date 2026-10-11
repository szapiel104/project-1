import { generateMap, type GameMap } from './map';
import { hashBytes } from './hash';
import { Rng } from './rng';
import type { MAP_PRESETS } from '../data/maps';

/** Częstotliwość symulacji. Render interpoluje między tickami. */
export const TICKS_PER_SECOND = 10;

/** Komenda gracza. Kolejne etapy dodają tu budowę, rozkazy itd. */
export type Command = { type: 'noop'; player: number };

export interface GameState {
  tick: number;
  map: GameMap;
  rng: Rng;
}

export function createGame(seed: number, preset: keyof typeof MAP_PRESETS = '1v1'): GameState {
  return { tick: 0, map: generateMap(seed, preset), rng: new Rng(seed) };
}

/**
 * Jeden krok symulacji. Jedyny sposób zmiany stanu gry:
 * te same komendy w tej samej kolejności dają zawsze ten sam stan.
 */
export function step(state: GameState, commands: readonly Command[]): void {
  for (const c of commands) {
    switch (c.type) {
      case 'noop':
        break;
    }
  }
  state.rng.nextU32();
  state.tick++;
}

/** Skrót całego stanu — klienci porównują go, żeby wykryć rozjazd symulacji. */
export function stateHash(state: GameState): number {
  const meta = new Uint8Array(new Uint32Array([state.tick, state.rng.state]).buffer);
  return hashBytes(meta, state.map.tiles, state.map.elevation);
}

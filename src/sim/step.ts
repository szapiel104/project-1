import { buildingIndex } from '../data/buildings';
import { RULES } from '../data/rules';
import type { GameState } from './state';
import { economySystem } from './systems/economy';
import { demolish, placeBuilding } from './systems/placement';
import { migrationSystem } from './systems/population';
import { torchSystem } from './systems/torches';
import { workerSystem } from './systems/workers';

/** Komendy graczy. To jedyna droga, którą gracz (albo bot, albo sieć) wpływa na grę. */
export type Command =
  | { type: 'noop'; player: number }
  | { type: 'build'; player: number; building: string; x: number; y: number; rot?: number }
  | { type: 'demolish'; player: number; id: number }
  | { type: 'setRations'; player: number; level: number }
  | { type: 'setTax'; player: number; level: number };

function apply(g: GameState, c: Command): void {
  const p = g.players[c.player];
  if (!p) return;
  switch (c.type) {
    case 'build':
      if (Number.isInteger(c.x) && Number.isInteger(c.y)) placeBuilding(g, c.player, buildingIndex(c.building), c.x, c.y, Number.isInteger(c.rot) ? ((c.rot! % 4) + 4) % 4 : 0);
      break;
    case 'demolish':
      demolish(g, c.player, c.id);
      break;
    case 'setRations':
      if (Number.isInteger(c.level) && c.level >= 0 && c.level < RULES.rations.length) p.rations = c.level;
      break;
    case 'setTax':
      if (Number.isInteger(c.level) && c.level >= 0 && c.level < RULES.taxes.length) p.tax = c.level;
      break;
    case 'noop':
      break;
  }
}

/**
 * Jeden krok symulacji. Te same komendy w tej samej kolejności dają zawsze ten sam stan.
 * Komendy są sprawdzane tutaj, bo w grze sieciowej nie wolno ufać klientowi.
 */
export function step(g: GameState, commands: readonly Command[]): void {
  for (const c of commands) apply(g, c);
  g.tick++;
  torchSystem(g);
  workerSystem(g);
  migrationSystem(g);
  economySystem(g);
}

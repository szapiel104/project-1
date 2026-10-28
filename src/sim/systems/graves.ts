/**
 * Leśne groby (0.58.3, Michał 28.10.2026). Osada bez cmentarza: wolny chłop zakopuje ciało na skraju lasu
 * (workers.ts, faza Burying) i zostaje tam kopczyk ziemi z krzyżem z dwóch kijów.
 * - Grób znika sam po `RULES.graveDays` dniach (zarasta) albo od razu, gdy na tym polu stanie budynek (także plac
 *   budowy) albo droga — groby nie blokują stawiania.
 * - Póki gracz ma groby w lesie, popularność spada co miesiąc: -1, a od `RULES.graveMany` grobów -2 (economy.ts,
 *   składnik `graves`). Cmentarz z grabarzem tego oszczędza: ciała idą wtedy na cmentarz, a nie do lasu.
 */
import { RULES } from '../../data/rules';
import type { GameState } from '../state';

/** Co tyle ticków sprawdzamy, czy grób nie zarósł albo nie stoi już pod budynkiem */
const EVERY = 10;

export function forestGraveSystem(g: GameState): void {
  const list = g.graves;
  if (!list?.length || g.tick % EVERY !== 0) return;
  const life = RULES.graveDays * RULES.dayTicks;
  const keep = list.filter((x) => g.tick - x.at < life && !g.occupancy[x.t] && !g.roads[x.t] && !g.roadPlan[x.t]);
  if (keep.length !== list.length) g.graves = keep;
}

import { RESOURCES, RESOURCE_DEFS, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { housing, population, type GameState, type PlayerState } from '../state';

const FOOD = RESOURCES.map((r, i) => (RESOURCE_DEFS[r].food ? i : -1)).filter((i) => i >= 0);
const GOLD = resIndex('gold');

export function foodTotal(p: PlayerState): number {
  let n = 0;
  for (const i of FOOD) n += p.res[i]!;
  return n;
}

/** Miesięczna zmiana popularności przy obecnych ustawieniach (także jako prognoza dla interfejsu). */
export function monthlyForecast(g: GameState, p: PlayerState): { delta: number; food: number; gold: number; fed: boolean; bribed: boolean } {
  const pop = population(g, p.id);
  const ration = RULES.rations[p.rations] ?? RULES.rations[0];
  const tax = RULES.taxes[p.tax] ?? RULES.taxes[1];
  const food = Math.ceil((pop * ration.foodPer4) / 4);
  const fed = foodTotal(p) >= food;
  const gold = Math.trunc((pop * tax.goldPer2) / 2);
  const bribed = gold >= 0 || p.res[GOLD]! >= -gold;
  let delta = fed ? ration.effect : RULES.rations[0].effect;
  delta += bribed ? tax.effect : RULES.taxes[1].effect;
  if (pop > housing(g, p.id)) delta += RULES.crowdingPenalty;
  return { delta, food, gold, fed, bribed };
}

/** Co „miesiąc”: chłopi zjadają racje, płacą podatki, a popularność się zmienia. */
export function economySystem(g: GameState): void {
  if (g.tick === 0 || g.tick % RULES.monthTicks !== 0) return;
  for (const p of g.players) {
    const f = monthlyForecast(g, p);
    let toEat = f.fed ? f.food : foodTotal(p);
    for (const i of FOOD) {
      const eat = Math.min(toEat, p.res[i]!);
      p.res[i]! -= eat; toEat -= eat;
    }
    if (f.bribed) p.res[GOLD]! += f.gold;
    p.popDelta = f.delta;
    p.popularity = Math.max(0, Math.min(100, p.popularity + f.delta));
  }
}

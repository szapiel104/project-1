import { RESOURCES, RESOURCE_DEFS, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { BUILDINGS } from '../../data/buildings';
import { housing, population, type GameState, type PlayerState } from '../state';
import { dayPart } from './workers';

const FOOD = RESOURCES.map((r, i) => (RESOURCE_DEFS[r].food ? i : -1)).filter((i) => i >= 0);
const GOLD = resIndex('gold');
const WHEAT = resIndex('wheat');

export function foodTotal(p: PlayerState): number {
  let n = 0;
  for (const i of FOOD) n += p.res[i]!;
  return n;
}

/** Miesięczna zmiana popularności przy obecnych ustawieniach (także jako prognoza dla interfejsu). */
export function monthlyForecast(g: GameState, p: PlayerState): { delta: number; food: number; gold: number; fed: boolean; bribed: boolean; ale: number; parts: { key: string; value: number; level?: string }[] } {
  const pop = population(g, p.id);
  const tax = RULES.taxes[p.tax] ?? RULES.taxes[1];
  const have = foodTotal(p);
  // gdy brakuje żywności na wybrane racje, ludzie jedzą najwyższe, na jakie starcza
  let level = Math.min(p.rations, RULES.rations.length - 1);
  const need = (l: number): number => Math.ceil((pop * RULES.rations[l]!.foodPer8) / 8);
  const fed = have >= need(level);
  while (level > 0 && have < need(level)) level--;
  const food = need(level);
  const gold = Math.trunc((pop * tax.goldPer2) / 2);
  const bribed = gold >= 0 || p.res[GOLD]! >= -gold;
  // rozbicie na składniki, żeby gracz widział, co podnosi, a co obniża popularność
  const parts: { key: string; value: number; level?: string }[] = [];
  parts.push({ key: 'food', value: RULES.rations[level]!.effect, level: RULES.rations[level]!.name });
  parts.push({ key: 'tax', value: bribed ? tax.effect : RULES.taxes[1].effect, level: bribed ? tax.name : RULES.taxes[1].name });
  // karczmy z karczmarzem i pszenicą na piwo: wieczory przy kuflu poprawiają nastroje
  const taverns = g.buildings.filter((b) => b.owner === p.id && !b.build && b.worker && BUILDINGS[b.type]!.id === 'tavern').length;
  const ale = Math.min(taverns, 2, Math.floor(p.res[WHEAT]! / 2));
  parts.push({ key: 'tavern', value: ale === 0 ? 0 : ale === 1 ? 3 : 5 });
  parts.push({ key: 'crowd', value: pop > housing(g, p.id) ? RULES.crowdingPenalty : 0 });
  // ostatnia noc: kto spał na słomie pod gołym niebem, narzeka; kto przy tym zmókł w deszczu, narzeka podwójnie
  parts.push({ key: 'rough', value: !p.rough ? 0 : p.rough >= 4 ? -2 : -1 });
  parts.push({ key: 'cold', value: p.cold ? -1 : 0 });
  const delta = parts.reduce((n, x) => n + x.value, 0);
  return { delta, food, gold, fed, bribed, parts, ale };
}

/** Co „miesiąc”: chłopi zjadają racje, płacą podatki, a popularność się zmienia. */
export function economySystem(g: GameState): void {
  if (g.tick === 0 || g.tick % RULES.monthTicks !== 0) return;
  // nocą wszyscy śpią: nikt nie je, podatków nikt nie zbiera, nastroje stoją (noc i tak mija szybko)
  if (dayPart(g.tick) === 'sleep') return;
  for (const p of g.players) {
    const f = monthlyForecast(g, p);
    let toEat = f.food;
    for (const i of FOOD) {
      const eat = Math.min(toEat, p.res[i]!);
      p.res[i]! -= eat; toEat -= eat;
    }
    if (f.bribed) p.res[GOLD]! += f.gold;
    p.res[WHEAT]! -= f.ale * 2; // piwo wypite
    p.popDelta = f.delta;
    p.popularity = Math.max(0, Math.min(RULES.maxPopularity, p.popularity + f.delta));
  }
}

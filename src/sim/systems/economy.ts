import { RESOURCES, RESOURCE_DEFS, resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { BUILDINGS } from '../../data/buildings';
import { housing, population, type GameState, type PlayerState } from '../state';
import { dayPart } from './workers';
import { rainAt } from '../clock';
import { weatherOf } from '../weather';

const WOOD = resIndex('wood');
/** Drewno na opał: na jedną zamieszkaną chatę i dobę przy ok. 0°C (zamek liczy się za dwie); przy mrozie więcej */
export const FUEL_PER_HOUSE_DAY = 1;

/** Ile drewna na opał na miesiąc gry (ułamek) przy obecnej pogodzie */
export function fuelNeed(g: GameState, p: PlayerState): number {
  const { chill } = weatherOf(g, rainAt(g.tick));
  if (!chill) return 0;
  let homes = 0;
  for (const b of g.buildings) if (b.owner === p.id && !b.build && !b.ruined) { const id = BUILDINGS[b.type]!.id; if (id === 'house') homes++; else if (id === 'keep') homes += 2; }
  return (homes * chill * FUEL_PER_HOUSE_DAY * RULES.monthTicks) / RULES.dayTicks;
}

const FOOD = RESOURCES.map((r, i) => (RESOURCE_DEFS[r].food ? i : -1)).filter((i) => i >= 0);
const GOLD = resIndex('gold');
const ALE = resIndex('ale');

/** Ile porcji daje jedna sztuka jedzenia: ryba to mięso — syci jak dwa jabłka czy dwa bochenki */
export const FOOD_VALUE: Record<string, number> = { fish: 2 };
const VALUE = RESOURCES.map((r) => FOOD_VALUE[r] ?? 1);

/** Ile porcji jedzenia jest w spichlerzach (ryba liczy się podwójnie) */
export function foodTotal(p: PlayerState): number {
  let n = 0;
  for (const i of FOOD) n += p.res[i]! * VALUE[i]!;
  return n;
}

/** Ile razy na dobę ludzie jedzą (rozliczenie co miesiąc gry, poza nocą — śpiący nie jedzą) */
export const MEALS_PER_DAY = (() => { let n = 0; for (let t = RULES.monthTicks; t <= RULES.dayTicks; t += RULES.monthTicks) if (dayPart(t) !== 'sleep') n++; return n; })();

/** Ile jedzenia na dobę daje jeden pracujący budynek (zmierzone w symulacji: chodzenie do spichlerza w cenie;
 *  dla piekarni cały łańcuch pole → młyn → piekarnia, po jednym budynku) — do prognozy w oknie spichlerza */
export const FOOD_PER_DAY: Record<string, number> = { orchard: 130, fisher: 128, bakery: 110 }; // rybak: 64 ryby = 128 porcji

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
  // racje wybrane przez gracza działają na nastroje jak zawsze; gdy jedzenia po prostu zabrakło, ludzie nie obrażają się
  // na pana na długo (to nie on skąpi) — tylko trochę narzekają, a głodni odchodzą od razu (migrationSystem)
  parts.push({ key: 'food', value: fed ? RULES.rations[level]!.effect : Math.max(RULES.rations[level]!.effect, RULES.hungerPenalty), level: RULES.rations[level]!.name });
  parts.push({ key: 'tax', value: bribed ? tax.effect : RULES.taxes[1].effect, level: bribed ? tax.name : RULES.taxes[1].name });
  // karczmy z karczmarzem i piwem ze składu: wieczory przy kuflu poprawiają nastroje, a sucha karczma złości
  const taverns = g.buildings.filter((b) => b.owner === p.id && !b.build && b.worker && BUILDINGS[b.type]!.id === 'tavern').length;
  const ale = Math.min(taverns, 2, p.res[ALE]! / RULES.alePerTavern | 0);
  parts.push({ key: 'tavern', value: ale === 0 ? (taverns ? RULES.dryTavernPenalty : 0) : ale === 1 ? 3 : 5, level: taverns && !ale ? 'tavern.dry' : undefined });
  parts.push({ key: 'crowd', value: pop > housing(g, p.id) ? RULES.crowdingPenalty : 0 });
  // ostatnia noc: kto spał na słomie pod gołym niebem, narzeka; kto przy tym zmókł w deszczu, narzeka podwójnie
  parts.push({ key: 'rough', value: !p.rough ? 0 : p.rough >= 4 ? -2 : -1 });
  parts.push({ key: 'cold', value: p.cold ? -1 : 0 });
  // zima: zimno trochę psuje nastroje; gdy zabrakło drewna na opał, ludzie marzną w chatach i złości to dużo bardziej
  const w = weatherOf(g, rainAt(g.tick));
  parts.push({ key: 'winter', value: w.chill >= 1 ? -1 : 0 });
  parts.push({ key: 'freezing', value: w.chill > 0 && p.freezing ? -3 : 0 });
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
      if (toEat <= 0) break;
      const v = VALUE[i]!;
      const eat = Math.min(Math.ceil(toEat / v), p.res[i]!); // ryba: jedna sztuka = dwie porcje
      p.res[i]! -= eat; toEat -= eat * v;
    }
    // głodni: zabrakło na racje, które gracz ustawił (zjedli mniej albo nic)
    p.hungry = !f.fed || undefined;
    if (f.bribed) p.res[GOLD]! += f.gold;
    p.res[ALE]! -= f.ale * RULES.alePerTavern; // piwo wypite
    // opał: w zimne dni chaty palą w piecach — z drewna w składzie znika po trochu (ułamki się zbierają)
    p.fuel = (p.fuel ?? 0) + fuelNeed(g, p);
    const burn = Math.floor(p.fuel);
    if (burn > 0) {
      const take = Math.min(burn, p.res[WOOD]!);
      p.res[WOOD]! -= take;
      p.fuel -= burn;
      p.freezing = take < burn;
    } else if (!fuelNeed(g, p)) p.freezing = false;
    p.popDelta = f.delta;
    p.popularity = Math.max(0, Math.min(RULES.maxPopularity, p.popularity + f.delta));
  }
}

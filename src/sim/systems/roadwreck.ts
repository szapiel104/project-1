import { UNITS } from '../../data/units';
import type { GameState, Soldier } from '../state';

/**
 * Rozkopywanie wrogich dróg (Michał 28.10.2026): swoją drogę gracz zdejmuje od ręki (removeRoad), a cudzą tylko
 * żołnierzami. Rozkaz `wreck` (prawy klik zaznaczonym wojskiem na wrogiej drodze, bot sam w bot.ts) wysyła oddział
 * na pole drogi; kto stoi na nim albo tuż obok, rozkopuje nawierzchnię. Praca kilku żołnierzy się sumuje.
 * W trakcie żołnierz dalej broni się i bije wrogów w zasięgu (armySystem), a po walce wraca do kopania.
 * Sojusznicze i niczyje drogi (stare zapisy) zostają nietknięte. Taran nie kopie.
 */

/** Ile ticków pracy jednego żołnierza zjada pole drogi danego rodzaju (1 piaskowa, 2 kamienna, 3 z dyli) */
export const WRECK_TICKS: readonly number[] = [0, 30, 90, 60];

const team = (g: GameState, player: number): number => g.players[player]?.team ?? -1;

/** Czy pole to droga wroga gracza (ułożona albo zaplanowana) */
export function enemyRoad(g: GameState, player: number, t: number): boolean {
  if (t < 0 || t >= g.roads.length || (!g.roads[t] && !g.roadPlan[t])) return false;
  const own = g.roadOwner[t]!;
  return own > 0 && team(g, own - 1) !== team(g, player);
}

/** Rozkaz: wskazani żołnierze idą rozkopać wrogą drogę na polu (x, y). Zwraca liczbę wysłanych */
export function orderWreck(g: GameState, player: number, ids: readonly number[], x: number, y: number): number {
  const W = g.map.width;
  if (x < 0 || y < 0 || x >= W || y >= g.map.height) return 0;
  const t = y * W + x;
  if (!enemyRoad(g, player, t)) return 0;
  const want = new Set(ids);
  let n = 0;
  for (const s of g.soldiers) {
    if (s.owner !== player || !want.has(s.id) || s.hp <= 0 || s.post || UNITS[s.kind]!.ram) continue;
    s.wreck = t; s.wreckT = 0;
    s.target = 0; s.prey = 0; s.hunt = 0; s.siegeOf = 0; s.hold = -1; s.amove = false; s.slot = undefined; s.wounded = 0;
    s.goal = t; s.path = []; s.wait = 0;
    n++;
  }
  return n;
}

/** Nowy rozkaz (marsz, atak, patrol, wieża) zdejmuje rozkopywanie */
export function clearWreck(g: GameState, player: number, ids: readonly number[]): void {
  const want = new Set(ids);
  for (const s of g.soldiers) if (s.owner === player && want.has(s.id) && s.wreck !== undefined) { s.wreck = undefined; s.wreckT = undefined; }
}

function near(W: number, a: number, b: number): boolean {
  return Math.abs((a % W) - (b % W)) <= 1 && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= 1;
}

/** Co tick: żołnierze przy wrogiej drodze kopią; gdy suma pracy dobije do WRECK_TICKS, pole drogi znika */
export function roadWreckSystem(g: GameState): void {
  const W = g.map.width;
  let work: Map<number, Soldier[]> | undefined;
  for (const s of g.soldiers) {
    if (s.wreck === undefined) continue;
    const t = s.wreck;
    if (s.hp <= 0 || !enemyRoad(g, s.owner, t)) { s.wreck = undefined; s.wreckT = undefined; continue; }
    if (s.target || s.prey || s.hunt) continue; // walczy: kopanie poczeka
    const here = (s.py >> 8) * W + (s.px >> 8);
    if (near(W, here, t) && !s.path.length) {
      if (s.goal >= 0 && s.goal !== t) { s.wreck = undefined; s.wreckT = undefined; continue; } // dostał inny cel
      s.goal = -1;
      s.wreckT = (s.wreckT ?? 0) + 1;
      (work ??= new Map()).set(t, [...(work.get(t) ?? []), s]);
    } else if (s.goal < 0 && !s.path.length) {
      s.goal = t; s.wait = 0; // po walce albo po zepchnięciu z drogi wraca do kopania
    }
  }
  if (!work) return;
  for (const [t, crew] of work) {
    const kind = g.roads[t]! || g.roadPlan[t]!;
    const done = crew.reduce((a, s) => a + (s.wreckT ?? 0), 0);
    if (done < (WRECK_TICKS[kind] ?? 60)) continue;
    g.roads[t] = 0; g.roadPlan[t] = 0; g.roadOwner[t] = 0;
    for (const s of g.soldiers) if (s.wreck === t) { s.wreck = undefined; s.wreckT = undefined; }
  }
}

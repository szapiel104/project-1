import { FP, type GameState, type Soldier } from '../state';
import { UNITS } from '../../data/units';

/**
 * Magowie leczą (Michał 30.10.2026): Mag Płomienia albo Źródła, który od HEAL_CALM ticków nie rzucał czaru i nie ma
 * wroga w zasięgu wzroku (army.ts woła to tylko wtedy), powoli leczy sojuszników w promieniu HEAL_R pól — po jednym:
 * najbardziej rannego (siebie też), po HEAL_HP zdrowia co HEAL_EVERY ticków, aż wyleczy, potem następnego.
 * `s.healing` = kogo właśnie leczy (wygląd: ręce w górze), `t.healAt` = tick ostatniego leczenia (plusy nad nim, hpBars.ts).
 * Taran, rozbite i zmarli się nie liczą. Bez losowania: wybór po stopniu zranienia, potem po numerze.
 */
export const HEAL_CALM = 60;
export const HEAL_R = 4;
export const HEAL_EVERY = 10;
export const HEAL_HP = 2;

const team = (g: GameState, p: number): number => g.players[p]?.team ?? p;

/** true = w tym ticku leczy (zajęty) */
export function healStep(g: GameState, s: Soldier): boolean {
  if (g.tick - (s.shot ?? -1e9) < HEAL_CALM) { s.healing = 0; return false; }
  const my = team(g, s.owner);
  const hurt = (o: Soldier): number => o.hp / UNITS[o.kind]!.hp;
  let t = s.healing ? g.soldiers.find((o) => o.id === s.healing) : undefined;
  const ok = (o: Soldier | undefined): o is Soldier => !!o && o.hp > 0 && o.hp < UNITS[o.kind]!.hp && !UNITS[o.kind]!.ram
    && team(g, o.owner) === my && Math.max(Math.abs(o.px - s.px), Math.abs(o.py - s.py)) <= HEAL_R * FP;
  if (!ok(t)) {
    t = undefined;
    for (const o of g.soldiers) if (ok(o) && (!t || hurt(o) < hurt(t) || (hurt(o) === hurt(t) && o.id < t.id))) t = o;
  }
  if (!t) { s.healing = 0; return false; }
  s.healing = t.id;
  if ((g.tick + s.id) % HEAL_EVERY === 0) { t.hp = Math.min(UNITS[t.kind]!.hp, t.hp + HEAL_HP); t.healAt = g.tick; }
  return true;
}

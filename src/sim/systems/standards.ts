/**
 * Chorążowie i duch oddziału. W każdym oddziale (żołnierze z jednego rozkazu, Soldier.grp) z co najmniej dziesięcioma
 * ludźmi (Michał 22.10) jeden piechur niesie proporzec pana. Żołnierz z tego samego oddziału, który walczy w pobliżu swojego
 * chorążego, bije mocniej (STANDARD_BONUS). Chorąży nie jest zapisany w stanie gry — wynika z niego (najniższy numer),
 * więc u wszystkich graczy w meczu sieciowym wychodzi ten sam; gdy padnie, proporzec przejmuje następny.
 */
import { UNITS } from '../../data/units';
import { FP, type GameState, type Soldier } from '../state';

/** Od ilu żołnierzy w rozkazie oddział dostaje chorążego */
export const STANDARD_MIN = 10;
/** Promień ducha oddziału wokół chorążego (w polach) */
export const STANDARD_RANGE = 4;
/** O ile procent mocniej bije żołnierz przy swoim chorążym */
export const STANDARD_BONUS = 15;

/**
 * Kto niesie proporzec: w każdym rozkazie (Soldier.grp) z co najmniej STANDARD_MIN żołnierzami — piechur wręcz
 * o najniższym numerze (gdy w oddziale są sami łucznicy, to łucznik). Strażnicy, tarany i zbóje nie mają chorążych.
 */
export function standardBearers(soldiers: readonly { id: number; owner: number; grp?: number; kind: number }[], isRanged: (kind: number) => boolean, skip: (kind: number) => boolean, min = STANDARD_MIN): Set<number> {
  const best = new Map<string, { id: number; melee: boolean; n: number }>();
  for (const s of soldiers) {
    if (!s.grp || skip(s.kind)) continue;
    const key = s.owner + ':' + s.grp, melee = !isRanged(s.kind);
    const b = best.get(key);
    if (!b) { best.set(key, { id: s.id, melee, n: 1 }); continue; }
    b.n++;
    if ((melee && !b.melee) || (melee === b.melee && s.id < b.id)) { b.id = s.id; b.melee = melee; }
  }
  const out = new Set<number>();
  for (const b of best.values()) if (b.n >= min) out.add(b.id);
  return out;
}

/** Strażnicy, tarany i zbóje nie mają chorążych; łucznik niesie proporzec tylko w oddziale samych łuczników */
const skipKind = (k: number): boolean => { const u = UNITS[k]; return !u || !!u.guard || !!u.ram || !!u.bandit; };
const rangedKind = (k: number): boolean => !!UNITS[k]?.range;

/** Chorążowie w tej chwili gry: grp oddziału → chorąży. Liczone raz na tick (pamięć poza stanem, wynika ze stanu). */
const cache = new WeakMap<GameState, { tick: number; n: number; byGrp: Map<string, Soldier> }>();
function bearersNow(g: GameState): Map<string, Soldier> {
  const c = cache.get(g);
  if (c && c.tick === g.tick && c.n === g.soldiers.length) return c.byGrp;
  const ids = standardBearers(g.soldiers, rangedKind, skipKind);
  const byGrp = new Map<string, Soldier>();
  for (const s of g.soldiers) if (ids.has(s.id)) byGrp.set(s.owner + ':' + s.grp, s);
  cache.set(g, { tick: g.tick, n: g.soldiers.length, byGrp });
  return byGrp;
}

/** Numery chorążych (do wyglądu: kto niesie drzewce z proporcem) */
export function bearerIds(g: GameState): Set<number> {
  return new Set([...bearersNow(g).values()].map((s) => s.id));
}

/** Czy żołnierz walczy w zasięgu proporca swojego oddziału (sam chorąży też się liczy) */
export function nearStandard(g: GameState, s: Soldier): boolean {
  if (!s.grp || skipKind(s.kind)) return false;
  const b = bearersNow(g).get(s.owner + ':' + s.grp);
  if (!b || b.hp <= 0) return false;
  const r = STANDARD_RANGE * FP;
  return (b.px - s.px) ** 2 + (b.py - s.py) ** 2 <= r * r;
}

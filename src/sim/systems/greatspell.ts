import { FP, type GameState, type Missile, type Soldier } from '../state';
import { UNITS, type UnitDef } from '../../data/units';

/**
 * Wielki czar magów bojowych (28.10.2026): obszarowy, na długim odliczaniu, rzucany sam, gdy wrogowie stoją w kupie.
 * - Mag Płomienia: „Deszcz ognia” — z nieba spada kilka ognistych kul na skupisko wrogów; parzy każdego w kręgu i podpala.
 * - Mag Źródła: „Lodowy krąg” — kula wody rozbija się w środku skupiska, ziemię skuwa lód: wszyscy w kręgu
 *   idą długo o połowę wolniej, trochę tracą zdrowia, a płonący sojusznicy w kręgu gasną.
 * Bot korzysta z tego tak samo jak gracz (magowie rzucają sami, bez rozkazu).
 * Bez losowania: wszystko z ticków i pozycji, więc symulacja zostaje taka sama u każdego gracza.
 */

/** Odliczanie wielkiego czaru (ticki; 10 na sekundę) */
export const GREAT_CD = 250;
/** Promień kręgu (w jednostkach pozycji; FP = jedno pole) */
export const GREAT_R = (FP * 3) / 2;
/** Ilu wrogów musi stać w kręgu wokół celu, żeby mag sięgnął po wielki czar */
export const GREAT_MIN = 3;
/** Ile ticków czar leci / spada z nieba, zanim uderzy */
export const GREAT_FLIGHT = 9;
/** Lodowy krąg: tyle ticków spowolnienia (zwykły czar wody: 60) */
const ICE_SLOW = 160;
/** Deszcz ognia: ile ognia (po 1 zdrowia co kilka ticków) zostaje na trafionym */
const RAIN_BURN = 6;

const team = (g: GameState, player: number): number => g.players[player]?.team ?? player;
const gap = (a: { px: number; py: number }, x: number, y: number): number => Math.max(Math.abs(a.px - x), Math.abs(a.py - y));

/** Wrogowie maga w kręgu wokół punktu (żywi, nie na wieży i nie na murze — tam czar nie sięga) */
function foesAround(g: GameState, s: Soldier, x: number, y: number): number {
  const my = team(g, s.owner);
  let n = 0;
  for (const o of g.soldiers) if (o.hp > 0 && !o.up && team(g, o.owner) !== my && gap(o, x, y) <= GREAT_R) n++;
  return n;
}

/** Czy mag właśnie teraz rzuci wielki czar w okolicę celu `foe` */
export function greatReady(g: GameState, s: Soldier, def: UnitDef, foe: Soldier): boolean {
  if (!def.magic || foe.up || g.tick < (s.great ?? 0)) return false;
  return foesAround(g, s, foe.px, foe.py) >= GREAT_MIN;
}

/** Rzut wielkiego czaru: krąg w miejscu, gdzie teraz stoi cel; uderzy za GREAT_FLIGHT ticków */
export function castGreat(g: GameState, s: Soldier, def: UnitDef, foe: Soldier): void {
  (g.missiles ??= []).push({ to: foe.id, dmg: def.attack, at: g.tick + GREAT_FLIGHT, from: s.id, by: s.owner, great: def.magic, gx: foe.px, gy: foe.py });
  s.great = g.tick + GREAT_CD;
  // dla obrazu: chwila rzutu i środek kręgu
  s.greatShot = g.tick; s.greatX = foe.px; s.greatY = foe.py;
}

/** Uderzenie wielkiego czaru: wszyscy w kręgu (wrogowie — obrażenia i skutki; przy lodzie płonący swoi gasną) */
export function greatImpact(g: GameState, m: Missile): void {
  const x = m.gx ?? 0, y = m.gy ?? 0;
  const my = team(g, m.by);
  const killer = g.players[m.by];
  for (const o of g.soldiers) {
    if (o.hp <= 0 || o.up || gap(o, x, y) > GREAT_R) continue;
    if (team(g, o.owner) === my) {
      if (m.great === 'water' && o.burn) delete o.burn;
      continue;
    }
    // bliżej środka mocniej: od pełnego ciosu w środku do połowy na brzegu
    const edge = gap(o, x, y) / GREAT_R;
    const full = m.great === 'fire' ? m.dmg : m.dmg >> 1;
    o.hp -= Math.max(1, Math.round(full * (1 - edge * 0.5)));
    if (m.great === 'fire') { if (o.hp > 0) { o.burn = (o.burn ?? 0) + RAIN_BURN; o.burnBy = m.by; } }
    else if (!UNITS[o.kind]?.ram) o.slow = Math.max(o.slow ?? 0, g.tick + ICE_SLOW);
    if (o.hp <= 0) { const l = g.players[o.owner]; if (killer) killer.stats.kills++; if (l) l.stats.lost++; }
  }
}

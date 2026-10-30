import { FP, type Corpse, type GameState, type Soldier } from '../state';
import type { UnitDef } from '../../data/units';

/**
 * Palenie ciał przez Maga Płomienia (Michał 30.10.2026: „ikonka u maga ognia: automatycznie pali ciała — nasze i wrogie,
 * podchodzi, pali, ciało znika; bez zaznaczonej ikonki nie pali”). Sposób na sprzątnięcie pola bitwy z ciał.
 * Przełącznik `s.cremate` (rozkaz 'cremate', step.ts) ustawia gracz w panelu wojska; bot włącza go swoim magom sam.
 * Mag z włączonym paleniem, bez wroga w zasięgu wzroku, szuka najbliższego ciała (do CREMATE_REACH pól, swojego
 * i cudzego, ludzi i wilków), podchodzi na CAST pól i rzuca ogień: ciało płonie PYRE_TICKS i znika. Wróg ma zawsze
 * pierwszeństwo (army.ts woła to tylko bez wroga). Ciało, po które idą już grabarze albo leżące na wieży — pomija.
 * Bez losowania: wszystko z ticków i pozycji.
 */
export const PYRE_TICKS = 40;
export const CREMATE_REACH = 12;
const CAST = 4;

const dist = (s: Soldier, c: Corpse): number => Math.max(Math.abs(s.px - c.px), Math.abs(s.py - c.py));
const free = (c: Corpse): boolean => !c.taken && c.pyre === undefined && !c.post && !c.by?.length;

/** Krok maga z włączonym paleniem (bez wroga w pobliżu). true = w tym ticku rzucił ogień albo czeka na odliczanie przy ciele */
export function cremateStep(g: GameState, s: Soldier, def: UnitDef): boolean {
  let c = s.pyreOf ? g.corpses.find((x) => x.id === s.pyreOf) : undefined;
  if (c && !free(c)) c = undefined;
  if (!c) {
    s.pyreOf = 0;
    // szuka nowego co 10 ticków (rozłożone po magach), tylko gdy stoi bez rozkazu marszu
    if (s.goal >= 0 || (g.tick + s.id) % 10 !== 0) return false;
    let best: Corpse | undefined, bd = CREMATE_REACH * FP + 1;
    for (const x of g.corpses) {
      if (!free(x)) continue;
      const d = dist(s, x);
      if (d < bd || (d === bd && best && x.id < best.id)) { bd = d; best = x; }
    }
    if (!best) return false;
    // inny mag już po nie idzie: weź następne (bez tłoczenia się kilku magów przy jednym ciele)
    if (g.soldiers.some((o) => o !== s && o.hp > 0 && o.pyreOf === best!.id)) return false;
    c = best;
    s.pyreOf = c.id;
  }
  if (dist(s, c) <= CAST * FP) {
    s.goal = -1; s.path = []; s.amove = false;
    if (s.cd > 0) return true;
    c.pyre = g.tick; c.burnt = true; c.taken = true;   // grabarze już po nie nie pójdą
    s.cd = def.cooldown;
    s.shot = g.tick;
    s.pyreOf = 0;
    return true;
  }
  // idzie do ciała; „atak w marszu”, więc wróg po drodze przerywa marsz jak zwykle
  if (s.goal < 0 && !s.path.length) { s.goal = (c.py >> 8) * g.map.width + (c.px >> 8); s.amove = true; }
  return false;
}

/** Spalone ciała znikają po PYRE_TICKS (co tick, tanio: tylko gdy coś płonie) */
export function pyreSystem(g: GameState): void {
  if (!g.corpses.some((c) => c.pyre !== undefined)) return;
  g.corpses = g.corpses.filter((c) => c.pyre === undefined || g.tick - c.pyre < PYRE_TICKS);
}

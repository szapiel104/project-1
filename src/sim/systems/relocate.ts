import { BUILDINGS, footprint } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { buildingById, type Building, type GameState, type Rubble } from '../state';
import { addBuilding, canPlace, demolish, enemyNear, siteLoads, startSite, type PlaceError } from './placement';

/**
 * Przenoszenie budynku (Michał 28.10.2026). Za rudę gracz wskazuje nowe miejsce dla gotowego budynku:
 * stary rozbierają na stos materiału (gruz „do przenosin”), robotnicy biorą z niego ładunek po ładunku,
 * niosą na nowy plac i stawiają tam budynek od nowa. Materiał nie idzie przez skład i nie przepada,
 * a ruda płaci za robotę. Gdy plac w nowym miejscu zniknie, resztki stosu to zwykły, bezwartościowy gruz.
 */

/** Powód, dla którego budynku nie da się przenieść (klucz tłumaczenia), albo null gdy wolno. */
export type MoveError = 'move.cannot' | 'move.building' | 'move.ruined' | 'move.fire' | 'move.enemy' | 'move.cost';

/** Ile rudy kosztują przenosiny: stała opłata plus część wartości materiału budynku */
export function relocateCost(type: number): number {
  let sum = 0;
  for (const v of Object.values(BUILDINGS[type]!.cost)) sum += v as number;
  return RULES.moveBase + Math.ceil((sum * RULES.movePercent) / 100);
}

/**
 * Czego nie przenosi się w ogóle: twierdzy, dróg, murów, bram i wież (to umocnienia, stawia się je od nowa),
 * dodatków, magazynów (w środku leży towar) i kopalni rudy (załoga, urobek i obóz przy skale).
 */
export function movable(type: number): boolean {
  const def = BUILDINGS[type];
  if (!def || !def.buildable || def.legacy) return false;
  if (def.id === 'keep' || def.id === 'oremine' || def.id === 'torch') return false;
  return !(def.road || def.line || def.addon || def.wall || def.gate || def.stores);
}

/** Czy ten budynek wolno teraz przenieść (bez sprawdzania nowego miejsca) */
export function canRelocate(g: GameState, player: number, id: number): MoveError | null {
  const b = buildingById(g, id);
  if (!b || b.owner !== player || !movable(b.type)) return 'move.cannot';
  if (b.ruined) return 'move.ruined';
  if (b.build > 0) return 'move.building';
  if ((b.fire ?? 0) > 0) return 'move.fire';
  const fp = footprint(BUILDINGS[b.type]!, b.rot);
  if (enemyNear(g, player, b.x, b.y, fp.w, fp.h)) return 'move.enemy';
  const p = g.players[player];
  if (!p || p.res[resIndex('gold')]! < relocateCost(b.type)) return 'move.cost';
  return null;
}

/** Czy budynek da się przenieść w to miejsce: najpierw sam budynek, potem nowa działka (jak przy stawianiu, bez kosztu materiału) */
export function canRelocateTo(g: GameState, player: number, id: number, x: number, y: number, rot: number): MoveError | PlaceError | null {
  const err = canRelocate(g, player, id);
  if (err) return err;
  return canPlace(g, player, buildingById(g, id)!.type, x, y, false, rot);
}

/** Stos materiału z rozebranego budynku, który czeka na tragarzy nowego placu */
export function moveStack(g: GameState, b: Building): Rubble | undefined {
  if (!b.from) return undefined;
  const r = g.rubble.find((x) => x.id === b.from);
  return r && r.to === b.id && r.loads.length ? r : undefined;
}

/** Zdejmuje stos z mapy (ostatni ładunek zabrany albo przenosiny odwołane) */
function dropStack(g: GameState, r: Rubble): void {
  const i = g.rubble.indexOf(r);
  if (i < 0) return;
  for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) g.reserved[ty * g.map.width + tx]!--;
  g.rubble.splice(i, 1);
}

/** Robotnik stoi przy stosie: bierze z niego jeden ładunek na nowy plac (true = coś wziął) */
export function takeFromStack(g: GameState, b: Building): boolean {
  const r = moveStack(g, b);
  if (!r) return false;
  r.loads.pop();
  if (!r.loads.length) dropStack(g, r);
  return true;
}

/** Przenosi budynek: płaci rudę, stary rozbiera na stos materiału, a w nowym miejscu zakłada plac budowy. */
export function relocate(g: GameState, player: number, id: number, x: number, y: number, rot: number): boolean {
  if (canRelocateTo(g, player, id, x, y, rot) !== null) return false;
  const b = buildingById(g, id)!;
  const p = g.players[player]!;
  const type = b.type, off = b.off;
  p.res[resIndex('gold')]! -= relocateCost(type);
  // rozbiórka bez zwrotu (materiał zostaje w stosie i jedzie na nowy plac)
  demolish(g, player, id, true);
  const stack = g.rubble[g.rubble.length - 1]!;
  const nb = addBuilding(g, type, player, x, y, rot);
  if (off) nb.off = true;
  if (p.dev && p.instantBuild !== false) { dropStack(g, stack); return true; }
  startSite(nb);
  // tyle ładunków w stosie, ile trzeba przynieść na plac; ładunki są bez wartości dla składu (wartość niesie budowa)
  const n = Math.max(1, nb.loads ?? 0);
  if (!nb.loads) { nb.loads = n; nb.haul = n; nb.delivered = 0; }
  stack.loads = Array.from({ length: n }, () => [-1, 0] as [number, number]);
  stack.total = n;
  stack.to = nb.id;
  nb.from = stack.id;
  return true;
}

/** Stos do przenosin, którego plac zniknął albo jest już gotowy, staje się zwykłym gruzem (do wyniesienia, bez wartości) */
export function orphanStacks(g: GameState): void {
  for (const r of g.rubble) {
    if (!r.to) continue;
    const b = buildingById(g, r.to);
    if (b && b.build > 0 && b.from === r.id) continue;
    r.to = undefined;
  }
}

/** Do testów i podpowiedzi: ile ładunków trzeba przenieść dla budynku tego rodzaju */
export const moveLoads = (type: number): number => Math.max(1, siteLoads(type));

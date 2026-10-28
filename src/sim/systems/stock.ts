import { BUILDINGS } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, type StoreKind } from '../../data/resources';
import type { Building, GameState } from '../state';
import { heldAmount } from './emergencywood';

/**
 * Zawartość każdego magazynu osobno (Michał 27.10.2026: okno składu ma pokazywać, co leży właśnie w nim).
 *
 * Zapasy gracza (`PlayerState.res`) zostają jedną sumą — z niej korzysta cała gra (koszty, jedzenie, koszary).
 * Każdy magazyn ma dodatkowo `Building.stock`: ile czego leży w nim samym. Towar wnoszony przez drzwi trafia do tego
 * magazynu (`depositAt`), towar brany przez drzwi wychodzi z niego (`withdrawAt`). Wszystko inne, co zmienia sumę
 * (zjedzone racje, zapłata za budynek, łup, wozy od sojusznika), wyrównuje `syncStock`: ubytek zdejmuje najpierw
 * z magazynów, w których leży najwięcej, a przybytek kładzie tam, gdzie jest miejsce. Suma ze wszystkich magazynów
 * nigdy nie przekracza zapasów gracza; nadwyżka ponad pojemność (np. tryb deweloperski) nie leży w żadnym.
 */

/** Ile miejsca ma magazyn na dany rodzaj towaru (plac budowy: 0, tak jak w `storeCapacity`) */
export const capOf = (b: Building, kind: StoreKind): number => (b.build ? 0 : BUILDINGS[b.type]!.capacity?.[kind] ?? 0);

const kindOf = (res: number): StoreKind | undefined => RESOURCE_DEFS[RESOURCES[res]!]?.store ?? undefined;

/** Lista zawartości magazynu (tworzy ją przy pierwszym użyciu) */
export function stockOf(b: Building): number[] {
  if (!b.stock || b.stock.length !== RESOURCES.length) {
    const s = new Array<number>(RESOURCES.length).fill(0);
    b.stock?.forEach((v, i) => { if (i < s.length) s[i] = v; });
    b.stock = s;
  }
  return b.stock;
}

/** Ile towaru danego rodzaju leży w tym magazynie */
export function usedIn(b: Building, kind: StoreKind): number {
  if (!b.stock) return 0;
  let n = 0;
  for (let i = 0; i < b.stock.length; i++) if (b.stock[i] && kindOf(i) === kind) n += b.stock[i]!;
  return n;
}

/** Wolne miejsce w tym jednym magazynie na towar `res` (tryb deweloperski: bez limitu, jak `storeCapacity`) */
export function freeIn(g: GameState, b: Building, res: number): number {
  const kind = kindOf(res);
  if (!kind || b.build) return 0;
  if (g.players[b.owner]?.dev && BUILDINGS[b.type]!.capacity?.[kind]) return 1_000_000;
  return Math.max(0, capOf(b, kind) - usedIn(b, kind));
}

/** Magazyn gracza, którego drzwi są na polu `t` i który trzyma ten rodzaj towaru */
export function storeAtDoor(g: GameState, owner: number, t: number, res: number): Building | undefined {
  const kind = kindOf(res);
  if (!kind) return undefined;
  return g.buildings.find((b) => b.owner === owner && b.door === t && !b.build && BUILDINGS[b.type]!.capacity?.[kind]);
}

/** Wnosi towar do tego magazynu (ile się w nim zmieści); zwraca, ile wniósł. Suma gracza rośnie razem z nim. */
export function depositAt(g: GameState, b: Building, res: number, amt: number): number {
  const put = Math.max(0, Math.min(amt, freeIn(g, b, res)));
  if (!put) return 0;
  stockOf(b)[res]! += put;
  g.players[b.owner]!.res[res]! += put;
  return put;
}

/** Zdejmuje towar z tego magazynu (sumę gracza zmienia wołający); zwraca, ile zdjął */
export function withdrawAt(b: Building, res: number, amt: number): number {
  const s = b.stock;
  if (!s || !s[res]) return 0;
  const take = Math.min(amt, s[res]!);
  s[res]! -= take;
  return take;
}

/**
 * Wyrównuje zawartość magazynów z zapasami gracza. Tani przy zgodnych sumach (jedno przejście po magazynach),
 * więc może działać w każdym ticku.
 */
export function syncStock(g: GameState): void {
  const n = RESOURCES.length;
  const sums = new Map<number, number[]>();
  const stores = new Map<number, Building[]>();
  for (const b of g.buildings) {
    if (!BUILDINGS[b.type]!.capacity) continue;
    let l = stores.get(b.owner);
    if (!l) { l = []; stores.set(b.owner, l); sums.set(b.owner, new Array<number>(n).fill(0)); }
    l.push(b);
    if (b.build && b.stock) b.stock = undefined; // plac budowy nic nie trzyma
    const s = b.stock;
    if (s) { const sum = sums.get(b.owner)!; for (let i = 0; i < n; i++) sum[i]! += s[i] ?? 0; }
  }
  const held = (g.piles ?? []).some((x) => x.held);
  for (const p of g.players) {
    const list = stores.get(p.id);
    if (!list) continue;
    const sum = sums.get(p.id)!;
    for (let r = 0; r < n; r++) {
      const kind = kindOf(r);
      if (!kind) continue;
      // deski z biedy przy pniakach (emergencywood.ts) już są w zapasach, ale leżą poza składem — nie rozkładamy ich po magazynach
      let diff = p.res[r]! - sum[r]! - (held ? heldAmount(g, p.id, r) : 0);
      if (diff < 0) {
        // ubyło (zjedli, zapłacone, rozkradzione): najpierw z magazynów, w których tego leży najwięcej
        const holders = list.filter((b) => (b.stock?.[r] ?? 0) > 0).sort((a, b) => (b.stock![r]! - a.stock![r]!) || a.id - b.id);
        for (const b of holders) { if (diff >= 0) break; const take = Math.min(-diff, b.stock![r]!); b.stock![r]! -= take; diff += take; }
      } else if (diff > 0) {
        // przybyło spoza drzwi (zapas startowy, łup, wóz, odbudowa): do magazynów z miejscem, po kolei wg budowy
        for (const b of list) {
          if (diff <= 0) break;
          const put = Math.min(diff, freeIn(g, b, r));
          if (put > 0) { stockOf(b)[r]! += put; diff -= put; }
        }
      }
    }
  }
}

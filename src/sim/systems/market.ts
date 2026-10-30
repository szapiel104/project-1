import { BUILDINGS } from '../../data/buildings';
import { buyPrice, MARKET_VALUE, sellPrice } from '../../data/market';
import { RESOURCES, resIndex, type ResourceId } from '../../data/resources';
import { storeRoom, type GameState } from '../state';

/**
 * Rynek (Michał 30.10.2026): sprzedaż i kupno od ręki, za rudę. Towar znika ze składu / pojawia się w nim od razu
 * (rozkład po magazynach robi syncStock w stock.ts). Kupno tylko tyle, ile zmieści się w magazynach tego rodzaju.
 */
export type TradeError = 'trade.market' | 'trade.goods' | 'trade.have' | 'trade.gold' | 'trade.room';

const GOLD = resIndex('gold');

/** Czy gracz ma gotowy, cały rynek */
export const hasMarket = (g: GameState, player: number): boolean =>
  g.buildings.some((b) => b.owner === player && !b.build && !b.ruined && BUILDINGS[b.type]!.id === 'market');

/** Czy handel się uda (null = tak). amount > 0 kupno, < 0 sprzedaż. */
export function canTrade(g: GameState, player: number, res: number, amount: number): TradeError | null {
  const id = RESOURCES[res] as ResourceId | undefined;
  const p = g.players[player];
  if (!p || !hasMarket(g, player)) return 'trade.market';
  if (!id || MARKET_VALUE[id] === undefined || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) return 'trade.goods';
  if (amount < 0) return p.res[res]! >= -amount ? null : 'trade.have';
  if (p.res[GOLD]! < buyPrice(id, amount)) return 'trade.gold';
  if (storeRoom(g, player, res) < amount) return 'trade.room';
  return null;
}

/** Handel od ręki; zwraca true, gdy się udał */
export function trade(g: GameState, player: number, res: number, amount: number): boolean {
  if (canTrade(g, player, res, amount)) return false;
  const p = g.players[player]!;
  const id = RESOURCES[res] as ResourceId;
  if (amount < 0) { p.res[res]! += amount; p.res[GOLD]! += sellPrice(id, -amount); }
  else { p.res[GOLD]! -= buyPrice(id, amount); p.res[res]! += amount; }
  return true;
}

/**
 * Bot na rynku (zasada: boty dostają to samo co gracz): co jakiś czas sprzedaje nadwyżki (drewno, kamień, jedzenie,
 * broń ponad zapas) i dokupuje to, czego mu brakuje, gdy ma rudę na zbyciu. Te same ceny i limity co u gracza.
 */
export function botTrade(g: GameState, player: number): void {
  if (!hasMarket(g, player)) return;
  const p = g.players[player]!;
  const r = (id: ResourceId): number => p.res[resIndex(id)]!;
  const sell: [ResourceId, number, number][] = [['wood', 300, 20], ['stone', 220, 20], ['bread', 300, 20], ['apples', 300, 20], ['fish', 250, 20], ['meat', 250, 20], ['spear', 40, 5], ['bow', 40, 5]];
  for (const [id, over, n] of sell) if (r(id) > over) { trade(g, player, resIndex(id), -n); return; }
  if (r('gold') < 160) return;
  const buy: [ResourceId, number, number][] = [['wood', 20, 20], ['stone', 20, 20], ['iron', 8, 5]];
  for (const [id, under, n] of buy) if (r(id) < under && trade(g, player, resIndex(id), n)) return;
}

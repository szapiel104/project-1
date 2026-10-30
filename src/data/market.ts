import { RESOURCES, type ResourceId } from './resources';

/**
 * Ceny na rynku (Michał 30.10.2026: „wszystkim mogę handlować, sprzedaje się od razu”). Waluta to ruda (w kodzie 'gold').
 * VALUE = ile rudy płaci rynek za 10 sztuk przy sprzedaży; kupno kosztuje BUY_MULT razy więcej (handlarz bierze swoje),
 * więc kręcenie towarem w kółko zawsze traci. Ruda sama nie jest towarem. Handluje się partiami (MARKET_LOTS).
 */
export const MARKET_VALUE: Partial<Record<ResourceId, number>> = {
  wood: 5, stone: 7, iron: 20,
  wheat: 4, flour: 7, bread: 5, apples: 4, fish: 5, meat: 8, ale: 10,
  spear: 25, bow: 35, sword: 50, armor: 80, ladder: 30,
  crystal: 200,
};
/** Kupno: tyle razy drożej niż sprzedaż */
export const BUY_MULT = 2;
/** Partie w oknie rynku */
export const MARKET_LOTS = [5, 20] as const;

/** Towary rynku w kolejności listy zasobów */
export const MARKET_GOODS: ResourceId[] = RESOURCES.filter((r) => MARKET_VALUE[r] !== undefined);

/** Ile rudy dostaje się za sprzedaż `n` sztuk (zaokrąglone w dół, co najmniej 1 za niepustą partię wartego towaru) */
export const sellPrice = (res: ResourceId, n: number): number => {
  const v = MARKET_VALUE[res];
  if (v === undefined || n <= 0) return 0;
  return Math.max(1, Math.floor((v * n) / 10));
};
/** Ile rudy kosztuje kupno `n` sztuk (zaokrąglone w górę) */
export const buyPrice = (res: ResourceId, n: number): number => {
  const v = MARKET_VALUE[res];
  if (v === undefined || n <= 0) return 0;
  return Math.max(1, Math.ceil((v * n * BUY_MULT) / 10));
};

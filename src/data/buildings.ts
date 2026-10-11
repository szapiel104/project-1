import { Terrain } from './terrain';
import type { ResourceId, StoreKind } from './resources';

export interface ProductionDef {
  /** Surowiec pobierany z magazynu przed pracą */
  input?: { res: ResourceId; amount: number };
  output: { res: ResourceId; amount: number };
  /** 'home' = praca w budynku, teren = chłop idzie do najbliższego pola tego typu */
  site: 'home' | Terrain;
  /** Czas pracy w tickach */
  workTicks: number;
  /** Po pracy w terenie chłop wraca do budynku i tyle ticków przerabia surowiec (np. kłody na deski) */
  processTicks?: number;
}

/** Kategorie w menu budowy. Nowa kategoria = wpis tutaj i nazwa w i18n. */
export const CATEGORIES = ['settlement', 'food', 'industry'] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export interface BuildingDef {
  id: string;
  category?: CategoryId;
  name: string;
  w: number;
  h: number;
  cost: Partial<Record<ResourceId, number>>;
  /** Miejsca dla ludności */
  housing?: number;
  /** Jakie surowce można tu odnosić */
  stores?: StoreKind[];
  /** Ile surowców danego rodzaju mieści budynek */
  capacity?: Partial<Record<StoreKind, number>>;
  production?: ProductionDef;
  /** Budynek wymaga terenu danego typu w pobliżu */
  needsTerrain?: { terrain: Terrain; radius: number };
  /** Jak pokazać pracującego: 'inside' = odsłonięte wnętrze budynku, 'field' = chodzi po polu */
  workView?: 'inside' | 'field';
  /** Czy gracz może go postawić (twierdza powstaje sama) */
  buildable: boolean;
}

/**
 * Lista budynków. Nowy budynek = nowy wpis tutaj (plus model w render/buildings.ts i nazwa w i18n).
 * KOLEJNOŚĆ MA ZNACZENIE: indeks trafia do stanu gry i skrótu, nowe wpisy dopisujemy na końcu.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'keep', name: 'b.keep', w: 3, h: 3, cost: {}, housing: 8, stores: ['stockpile', 'granary'], capacity: { stockpile: 250, granary: 120 }, buildable: false },
  { id: 'house', category: 'settlement', name: 'b.house', w: 2, h: 2, cost: { wood: 20 }, housing: 8, buildable: true },
  { id: 'stockpile', category: 'settlement', name: 'b.stockpile', w: 2, h: 2, cost: { wood: 10 }, stores: ['stockpile'], capacity: { stockpile: 200 }, buildable: true },
  { id: 'granary', category: 'food', name: 'b.granary', w: 2, h: 2, cost: { wood: 15 }, stores: ['granary'], capacity: { granary: 150 }, buildable: true },
  {
    id: 'woodcutter', category: 'industry', name: 'b.woodcutter', w: 2, h: 2, cost: { wood: 10 }, buildable: true,
    workView: 'inside',
    production: { output: { res: 'wood', amount: 8 }, site: Terrain.Forest, workTicks: 50, processTicks: 40 },
  },
  {
    id: 'quarry', category: 'industry', name: 'b.quarry', w: 2, h: 2, cost: { wood: 20 }, buildable: true,
    needsTerrain: { terrain: Terrain.Stone, radius: 6 },
    production: { output: { res: 'stone', amount: 6 }, site: Terrain.Stone, workTicks: 70 },
  },
  {
    id: 'mine', category: 'industry', name: 'b.mine', w: 2, h: 2, cost: { wood: 30 }, buildable: true,
    needsTerrain: { terrain: Terrain.Iron, radius: 6 },
    production: { output: { res: 'iron', amount: 4 }, site: Terrain.Iron, workTicks: 90 },
  },
  {
    id: 'orchard', category: 'food', name: 'b.orchard', w: 3, h: 3, cost: { wood: 10 }, buildable: true,
    workView: 'field',
    production: { output: { res: 'apples', amount: 8 }, site: 'home', workTicks: 80 },
  },
  {
    id: 'farm', category: 'food', name: 'b.farm', w: 3, h: 3, cost: { wood: 20 }, buildable: true,
    workView: 'field',
    production: { output: { res: 'wheat', amount: 8 }, site: 'home', workTicks: 110 },
  },
  {
    id: 'mill', category: 'food', name: 'b.mill', w: 2, h: 2, cost: { wood: 25, stone: 10 }, buildable: true,
    production: { input: { res: 'wheat', amount: 8 }, output: { res: 'flour', amount: 8 }, site: 'home', workTicks: 50 },
  },
  {
    id: 'bakery', category: 'food', name: 'b.bakery', w: 2, h: 2, cost: { wood: 20, stone: 10 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'flour', amount: 4 }, output: { res: 'bread', amount: 12 }, site: 'home', workTicks: 60 },
  },
];

export const buildingIndex = (id: string): number => BUILDINGS.findIndex((b) => b.id === id);

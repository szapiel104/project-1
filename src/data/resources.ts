export const RESOURCES = ['wood', 'stone', 'iron', 'wheat', 'flour', 'bread', 'apples', 'gold', 'fish', 'spear', 'bow'] as const;
export type ResourceId = (typeof RESOURCES)[number];
export type StoreKind = 'stockpile' | 'granary';

export interface ResourceDef {
  name: string;
  color: number;
  /** Gdzie chłopi odnoszą surowiec. Złoto nie jest noszone. */
  store: StoreKind | null;
  /** Czy liczy się jako żywność przy racjach */
  food?: boolean;
}

export const RESOURCE_DEFS: Record<ResourceId, ResourceDef> = {
  wood: { name: 'res.wood', color: 0x8a5a2b, store: 'stockpile' },
  stone: { name: 'res.stone', color: 0xb5b0a2, store: 'stockpile' },
  iron: { name: 'res.iron', color: 0x8a4a2c, store: 'stockpile' },
  wheat: { name: 'res.wheat', color: 0xd9b84a, store: 'stockpile' },
  flour: { name: 'res.flour', color: 0xf1ead8, store: 'stockpile' },
  bread: { name: 'res.bread', color: 0xb97a3a, store: 'granary', food: true },
  apples: { name: 'res.apples', color: 0xb3261e, store: 'granary', food: true },
  gold: { name: 'res.gold', color: 0xe2b93b, store: null },
  fish: { name: 'res.fish', color: 0x8fb4c9, store: 'granary', food: true },
  spear: { name: 'res.spear', color: 0x9a7a4a, store: 'stockpile' },
  bow: { name: 'res.bow', color: 0x7a5232, store: 'stockpile' },
};

export const resIndex = (id: ResourceId): number => RESOURCES.indexOf(id);

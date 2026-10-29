// KOLEJNOŚĆ MA ZNACZENIE (indeks w stanie gry i zapisach): nowe surowce dopisujemy na końcu
export const RESOURCES = ['wood', 'stone', 'iron', 'wheat', 'flour', 'bread', 'apples', 'gold', 'fish', 'spear', 'bow', 'ale', 'ore', 'sword', 'armor', 'crystal', 'ladder', 'meat'] as const;
export type ResourceId = (typeof RESOURCES)[number];
export type StoreKind = 'stockpile' | 'granary' | 'armory' | 'grain';

export interface ResourceDef {
  name: string;
  color: number;
  /** Gdzie chłopi odnoszą surowiec. Ruda z podatków nie jest noszona. */
  store: StoreKind | null;
  /** Czy liczy się jako żywność przy racjach */
  food?: boolean;
}

export const RESOURCE_DEFS: Record<ResourceId, ResourceDef> = {
  wood: { name: 'res.wood', color: 0x8a5a2b, store: 'stockpile' },
  stone: { name: 'res.stone', color: 0xb5b0a2, store: 'stockpile' },
  iron: { name: 'res.iron', color: 0x8a4a2c, store: 'stockpile' },
  // pszenica i mąka leżą w stodole, osobno od towarów (Michał 23.10: spichlerz tylko na jedzenie) — surowiec dla młyna, piekarni i browaru
  wheat: { name: 'res.wheat', color: 0xd9b84a, store: 'grain' },
  flour: { name: 'res.flour', color: 0xf1ead8, store: 'grain' },
  bread: { name: 'res.bread', color: 0xb97a3a, store: 'granary', food: true },
  apples: { name: 'res.apples', color: 0xb3261e, store: 'granary', food: true },
  // waluta gry: w kodzie 'gold', dla gracza „Ruda” (jak w Gothicu); nie leży w składzie — trafia do skarbca w zamku
  gold: { name: 'res.gold', color: 0x5a7ea8, store: null },
  fish: { name: 'res.fish', color: 0x8fb4c9, store: 'granary', food: true },
  // broń trafia do zbrojowni (jak w Twierdzy), skąd biorą ją koszary i straż
  spear: { name: 'res.spear', color: 0x9a7a4a, store: 'armory' },
  bow: { name: 'res.bow', color: 0x7a5232, store: 'armory' },
  ale: { name: 'res.ale', color: 0xc98a2a, store: 'stockpile' },
  // NIEUŻYWANE (17.10): krótko osobna ruda z kopalni; ruda jest teraz walutą (dawne 'gold'). Zostaje w liście tylko dla zapisów.
  ore: { name: 'res.ore', color: 0xa8843c, store: 'stockpile' },
  // miecze z kuźni: z żelaza ze składu, trafiają do zbrojowni jak włócznie i łuki (dla zbrojnych)
  sword: { name: 'res.sword', color: 0x9aa0a8, store: 'armory' },
  // kolczugi od płatnerza: z żelaza ze składu, do zbrojowni (dla zbrojnych)
  armor: { name: 'res.armor', color: 0x6f747c, store: 'armory' },
  // kryształ magii: rzadki urobek z głębokiej galerii kopalni; jak ruda nie leży w składzie, trafia do skarbca w zamku.
  // Potrzebny magom bojowym i siedzibom zakonów
  crystal: { name: 'res.crystal', color: 0x9a6cff, store: null },
  // drabiny szturmowe od cieśli (z drewna), w zbrojowni; żołnierz bierze jedną, gdy przystawia drabinę do wrogiego muru
  ladder: { name: 'res.ladder', color: 0xa07a48, store: 'armory' },
  // mięso z chlewa (Michał 29.10.2026): czwarte jedzenie, syci jak ryba; różnorodne jedzenie podnosi popularność
  meat: { name: 'res.meat', color: 0xa8463a, store: 'granary', food: true },
};

export const resIndex = (id: ResourceId): number => RESOURCES.indexOf(id);

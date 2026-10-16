export enum Terrain {
  Grass = 0,
  Forest = 1,
  Stone = 2,
  Iron = 3,
  Water = 4,
  /** Góry na krańcach mapy: nie do przejścia, zasłaniają koniec świata */
  Mountain = 5,
  /** Bród na rzece: płytka woda, da się przejść, nie da się budować */
  Ford = 6,
}

export interface TerrainDef {
  /** Klucz tłumaczenia */
  name: string;
  /** Kolor podłoża (hex) */
  color: number;
  /** Czy da się po polu chodzić */
  walkable: boolean;
  /** Czy da się na polu budować */
  buildable: boolean;
}

export const TERRAIN: Record<Terrain, TerrainDef> = {
  [Terrain.Grass]: { name: 'terrain.grass', color: 0x6f8f3c, walkable: true, buildable: true },
  [Terrain.Forest]: { name: 'terrain.forest', color: 0x4f7030, walkable: true, buildable: false },
  [Terrain.Stone]: { name: 'terrain.stone', color: 0x8d8778, walkable: true, buildable: false },
  [Terrain.Iron]: { name: 'terrain.iron', color: 0x7a5a48, walkable: true, buildable: false },
  [Terrain.Water]: { name: 'terrain.water', color: 0x3b6f86, walkable: false, buildable: false },
  [Terrain.Mountain]: { name: 'terrain.mountain', color: 0x7d7a74, walkable: false, buildable: false },
  [Terrain.Ford]: { name: 'terrain.ford', color: 0x5d8a8a, walkable: true, buildable: false },
};

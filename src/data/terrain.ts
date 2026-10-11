export enum Terrain {
  Grass = 0,
  Forest = 1,
  Stone = 2,
  Iron = 3,
  Water = 4,
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
};

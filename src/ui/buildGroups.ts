import type { CategoryId } from '../data/buildings';

/**
 * Grupy kart w pasku budowy: w każdej kategorii budynki ułożone po funkcji, z krótkim podpisem nad grupą
 * (np. mieszkania osobno, życie osady osobno). Nowy budynek dopisz do pasującej grupy — bez wpisu trafi do „Inne”.
 * Kolejność grup i budynków w grupie = kolejność na pasku.
 */
export interface BuildGroup { cat: CategoryId; pl: string; en: string; ids: readonly string[] }

export const BUILD_GROUPS: readonly BuildGroup[] = [
  { cat: 'settlement', pl: 'Mieszkania', en: 'Housing', ids: ['house'] },
  { cat: 'settlement', pl: 'Życie osady', en: 'Village life', ids: ['camp', 'tavern', 'shrine', 'well', 'torch'] },
  { cat: 'settlement', pl: 'Składy', en: 'Storage', ids: ['stockpile', 'barn'] },
  { cat: 'settlement', pl: 'Rzemiosło i magia', en: 'Craft and magic', ids: ['engineers', 'mageHut', 'mageFire', 'mageWater'] },

  { cat: 'food', pl: 'Z natury', en: 'From the land', ids: ['orchard', 'fisher'] },
  { cat: 'food', pl: 'Chleb', en: 'Bread', ids: ['farm', 'mill', 'bakery'] },
  { cat: 'food', pl: 'Piwo', en: 'Ale', ids: ['brewery'] },
  { cat: 'food', pl: 'Spichlerze', en: 'Granaries', ids: ['granary', 'granaryBig'] },

  { cat: 'industry', pl: 'Drewno', en: 'Timber', ids: ['woodcutter', 'forester'] },
  { cat: 'industry', pl: 'Góry', en: 'Mountains', ids: ['oremine', 'minecamp'] },

  { cat: 'military', pl: 'Broń i zbroje', en: 'Arms and armour', ids: ['fletcher', 'poleturner', 'smithy', 'armorer'] },
  { cat: 'military', pl: 'Wojsko', en: 'Troops', ids: ['armory', 'barracks', 'fieldTent', 'cemetery'] },

  { cat: 'defense', pl: 'Mury i bramy', en: 'Walls and gates', ids: ['palisade', 'gate', 'stoneWall', 'stoneGate', 'ladder'] },
  { cat: 'defense', pl: 'Wieże i ogień', en: 'Towers and fire', ids: ['watchtower', 'stoneTower', 'stoneTowerBig', 'stoneTowerGreat', 'brazier'] },

  { cat: 'roads', pl: 'Drogi', en: 'Roads', ids: ['roadSand', 'roadWood', 'roadStone'] },
];

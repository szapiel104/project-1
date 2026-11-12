import { expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { RESOURCES } from '../src/data/resources';

/**
 * Typ budynku i surowca w zapisach gry to numer na liście. Wstawienie nowego wpisu w środek przesuwa wszystkie dalsze
 * i stare zapisy pokazują inne budynki (12.11.2026: chata myśliwego w środku listy zamieniła mury w warsztaty bez pracownika).
 * Nowe wpisy dopisujemy NA KOŃCU — i tu też, na końcu listy.
 */
const BUILDING_ORDER = ['keep', 'house', 'stockpile', 'granary', 'woodcutter', 'quarry', 'mine', 'orchard', 'farm', 'mill', 'bakery', 'camp', 'barn', 'fisher', 'torch', 'roadSand', 'roadStone', 'engineers', 'poleturner', 'barracks', 'cemetery', 'fletcher', 'tavern', 'palisade', 'gate', 'watchtower', 'roadWood', 'well', 'brewery', 'stoneWall', 'ladder', 'stoneTower', 'armory', 'granaryBig', 'stoneGate', 'oremine', 'minecamp', 'banditCamp', 'forester', 'fieldTent', 'smithy', 'armorer', 'stoneTowerBig', 'stoneTowerGreat', 'brazier', 'market', 'shrine', 'mageFire', 'mageWater', 'mageHut', 'shack', 'tent', 'shackL', 'lookout', 'carpenter', 'pigsty', 'hunter'];
const RESOURCE_ORDER = ['wood', 'stone', 'iron', 'wheat', 'flour', 'bread', 'apples', 'gold', 'fish', 'spear', 'bow', 'ale', 'ore', 'sword', 'armor', 'crystal', 'ladder', 'meat', 'hides'];

it('budynki i surowce zachowują numery ze starszych wersji (nowe tylko na końcu listy)', () => {
  expect(BUILDINGS.slice(0, BUILDING_ORDER.length).map((b) => b.id)).toEqual(BUILDING_ORDER);
  expect(RESOURCES.slice(0, RESOURCE_ORDER.length)).toEqual(RESOURCE_ORDER);
});

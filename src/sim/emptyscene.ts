import { BUILDINGS, buildingIndex } from '../data/buildings';
import { RULES } from '../data/rules';
import { Terrain } from '../data/terrain';
import { clockAt, dayFraction } from './clock';
import { FP, paveForecourt, type GameState, type Unit } from './state';
import { addBuilding } from './systems/placement';
import { spawnPeasant } from './systems/population';

/**
 * Pusta scena do testów (?test=1&pusta=1): płaska łąka bez lasów, skał, wody i botów, tylko twierdze graczy.
 * Każdy czat stawia na niej tylko to, co sprawdza (__test.place, __test.peasants, __test.wolf, __test.hour),
 * więc zrzut pokazuje sam testowany element, bez drzew i murów zasłaniających kamerę.
 * Góry na krańcach mapy zostają (koniec świata), wszystko inne to trawa na jednej wysokości.
 */
export function emptyScene(g: GameState): void {
  const W = g.map.width;
  const me = g.map.starts.find((s) => s.player === 0) ?? g.map.starts[0]!;
  const level = g.map.elevation[me.y * W + me.x]!;
  const tiles = new Uint8Array(g.map.tiles.length);
  const elevation = new Uint8Array(g.map.tiles.length).fill(level);
  for (let i = 0; i < tiles.length; i++) {
    const rim = g.map.tiles[i] === Terrain.Mountain;
    tiles[i] = rim ? Terrain.Mountain : Terrain.Grass;
    if (rim) elevation[i] = g.map.elevation[i]!;
  }
  // nowy obiekt mapy: podręczne tablice przechodniości (trzymane per mapa) liczą się od nowa
  g.map = { ...g.map, tiles, elevation };
  const keeps = g.buildings.filter((b) => BUILDINGS[b.type]!.id === 'keep');
  g.buildings = []; g.units = []; g.soldiers = []; g.corpses = []; g.travelers = []; g.wolves = []; g.cut = []; g.rubble = []; g.marches = [];
  for (const a of [g.occupancy, g.gates, g.walls, g.reserved, g.wear, g.roads, g.roadPlan]) a.fill(0);
  for (const k of keeps) { addBuilding(g, k.type, k.owner, k.x, k.y, k.rot); paveForecourt(g, k); }
  // bez botów i bez napadów: poziom pokojowy, nikt nie gra za przeciwnika
  for (const p of g.players) { p.bot = false; p.level = 0; p.guards = 0; for (let i = 0; i < p.res.length; i++) p.res[i] = 5000; }
}

/** Gotowy budynek w polu (x, y) bez budowy; null, gdy działka zajęta albo za mapą */
export function placeReady(g: GameState, id: string, x: number, y: number, rot = 0, owner = 0): number | null {
  const type = buildingIndex(id);
  if (type < 0) return null;
  const d = BUILDINGS[type]!, w = rot % 2 ? d.h : d.w, h = rot % 2 ? d.w : d.h;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    if (tx < 1 || ty < 1 || tx >= g.map.width - 1 || ty >= g.map.height - 1) return null;
    const t = ty * g.map.width + tx;
    if (g.occupancy[t] || g.map.tiles[t] === Terrain.Mountain) return null;
  }
  return addBuilding(g, type, owner, x, y, rot).id;
}

/** Ustawia zegar na godzinę `hour` bieżącego dnia (tylko piaskownica: czas skacze bez symulowania) */
export function setHour(g: GameState, hour: number): void {
  const off = Math.round(dayFraction(RULES.startHour) * RULES.dayTicks);
  const day = clockAt(g.tick).day - 1;
  g.tick = Math.max(0, day * RULES.dayTicks + Math.round(dayFraction(hour) * RULES.dayTicks) - off);
}

/** `n` chłopów gracza przy twierdzy */
export function addPeasants(g: GameState, n: number, owner = 0): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) { const u = spawnPeasant(g, owner); if (u) out.push(u); }
  return out;
}

/** Wilk w polu (x, y) */
export function addWolf(g: GameState, x: number, y: number): void {
  g.wolves.push({ id: g.nextId++, px: x * FP + FP / 2, py: y * FP + FP / 2, hp: 45, path: [], target: 0, cd: 0, leaving: false });
}

/** Zdejmuje budynek od ręki, bez gruzu (do wymiany modelu na scenie testowej) */
export function removeReady(g: GameState, id: number): void {
  const i = g.buildings.findIndex((b) => b.id === id);
  const b = g.buildings[i];
  if (!b) return;
  const d = BUILDINGS[b.type]!, w = b.rot % 2 ? d.h : d.w, h = b.rot % 2 ? d.w : d.h;
  for (let ty = b.y; ty < b.y + h; ty++) for (let tx = b.x; tx < b.x + w; tx++) { const t = ty * g.map.width + tx; g.occupancy[t] = 0; g.gates[t] = 0; g.walls[t] = 0; }
  if (b.door >= 0 && g.reserved[b.door]) g.reserved[b.door]!--;
  g.buildings.splice(i, 1);
}

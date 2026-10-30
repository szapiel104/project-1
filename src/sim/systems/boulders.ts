import { type GameMap } from '../map';
import { Terrain } from '../../data/terrain';
import { hash2 } from '../rng';
import { buildingIndex, BUILDINGS } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import type { GameState } from '../state';

/**
 * Duże głazy na łąkach (Michał 30.10.2026: „kamienie to fizyczne obiekty”). Wcześniej rysował je sam teren, a symulacja
 * nic o nich nie wiedziała — budynek stawał na głazie, spacerowicz przechodził przez niego. Teraz położenie liczy się
 * tu, z ziarna mapy (te same głazy u każdego gracza, bez zapisu w stanie), a teren rysuje dokładnie te.
 * - Na głazie nie da się nic postawić ani położyć drogi (placement.ts).
 * - W spacerze głaz ma kolizję (scene.ts).
 * - Gracz z gotowym cechem inżynierów może kazać go rozbić (rozkaz 'smashRock', ROCK_COST rudy): głaz znika, a na polu
 *   zostaje stos kamienia (gruz, rubble.ts) — wynoszą go magazynierzy, wolni chłopi albo inżynierowie z cechu, kamień
 *   trafia do składu, potem pole jest wolne.
 * Rozbite pola: g.rocksGone (zapis gry).
 */
export const ROCK_COST = 10;
/** Ile kamienia daje rozbity głaz (dwa ładunki) */
export const ROCK_STONE = 8;

const cache = new WeakMap<GameMap, Map<number, number>>();

/** Pola z dużym głazem → jego wielkość (skala modelu); stałe dla mapy */
export function boulderTiles(map: GameMap): Map<number, number> {
  let m = cache.get(map);
  if (m) return m;
  m = new Map();
  const { width: w, height: h } = map;
  const water = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && map.tiles[y * w + x] === Terrain.Water;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const t = y * w + x;
      if (map.tiles[t] !== Terrain.Grass || map.trails?.[t]) continue;
      const r = hash2(x * 7 + 77, y * 13 - 77, map.seed ^ 0x9b0d1);
      if (r % 140 !== 0) continue;
      if (water(x + 1, y) || water(x - 1, y) || water(x, y + 1) || water(x, y - 1)) continue;
      if (map.starts.some((s) => Math.hypot(s.x - x, s.y - y) <= 16)) continue;   // nie przy zamkach na starcie
      m.set(t, 0.9 + ((r >>> 8) & 7) / 14);
    }
  cache.set(map, m);
  return m;
}

/** Czy na polu leży głaz (nierozbity) */
export function boulderAt(g: GameState, t: number): boolean {
  return boulderTiles(g.map).has(t) && !(g.rocksGone?.includes(t) ?? false);
}

export type SmashError = 'rock.none' | 'rock.guild' | 'rock.cost';

/** Czy gracz może kazać rozbić głaz na polu t (null = tak) */
export function canSmash(g: GameState, player: number, t: number): SmashError | null {
  if (!boulderAt(g, t)) return 'rock.none';
  const guild = buildingIndex('engineers');
  if (!g.buildings.some((b) => b.owner === player && b.type === guild && !b.build && !b.ruined)) return 'rock.guild';
  const p = g.players[player];
  if (!p || p.res[resIndex('gold')]! < ROCK_COST) return 'rock.cost';
  return null;
}

/** Rozbija głaz: płaci rudę, głaz znika, na polu stos kamienia do wyniesienia (true = rozbity) */
export function smashRock(g: GameState, player: number, t: number): boolean {
  if (canSmash(g, player, t)) return false;
  const p = g.players[player]!;
  p.res[resIndex('gold')]! -= ROCK_COST;
  (g.rocksGone ??= []).push(t);
  const w = g.map.width, x = t % w, y = (t - x) / w, stone = resIndex('stone');
  const loads: [number, number][] = [[stone, ROCK_STONE / 2], [stone, ROCK_STONE / 2]];
  g.rubble.push({ id: g.nextId++, owner: player, type: buildingIndex('stoneWall'), x, y, w: 1, h: 1, loads, total: loads.length, idle: 0 });
  g.reserved[t]!++;
  void BUILDINGS;
  return true;
}

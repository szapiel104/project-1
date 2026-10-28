import { Terrain, TERRAIN } from '../data/terrain';
import type { GameState } from '../sim/state';
import { WATER_Y } from './ground';

/**
 * Sucha ziemia dla postaci i zwierząt, które żyją tylko w wyglądzie (rodziny przy chatach, kury, świnie).
 * Pole musi być do chodzenia, nie może być brodem ani wodą, a sam punkt musi leżeć wyraźnie nad taflą:
 * trawa tuż przy stawie jest wygładzona w dół i jej brzeg bywa już pod wodą (gospodyni i dzieci brodziły po kolana).
 */
export const DRY_MARGIN = 0.05;

export function dryLand(g: GameState, height: (x: number, y: number) => number, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y), W = g.map.width;
  if (tx < 0 || ty < 0 || tx >= W || ty >= g.map.height) return false;
  const terr = g.map.tiles[ty * W + tx] as Terrain;
  if (terr === Terrain.Water || terr === Terrain.Ford || !TERRAIN[terr]?.walkable) return false;
  return height(x, y) > WATER_Y + DRY_MARGIN;
}

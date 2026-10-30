import { BUILDINGS } from '../../data/buildings';
import { WALL_TOP } from '../../data/keep';
import { wallBetween } from '../path';
import { buildingById, type GameState } from '../state';

/**
 * Linia strzału (Michał 27.10.2026): strzała ani czar nie przelatują przez mury i budynki.
 *
 * - Strzelec na murze, wieży albo murach zamku (wysoko) strzela ponad przeszkodami — widzi przed sobą wroga.
 * - Strzelec na ziemi potrzebuje czystej linii: każde pole między nim a celem (bez obu końców) nie może być
 *   budynkiem (chata, warsztat, częstokół, mur kamienny, zamknięta brama, lity kawałek twierdzy), a po drodze
 *   nie może być ściany zamku. Niskie rzeczy (pochodnia, kosz ognia, studnia, cmentarz, drabina, ruiny, place budowy)
 *   nie zasłaniają. Obrońcę na koronie muru albo na wieży da się trafić z ziemi — wystaje nad blanki — o ile
 *   przed samym murem nie stoi nic innego.
 * - Bez linii strzału łucznik podchodzi (szuka miejsca, skąd widzi wroga) albo bierze innego wroga.
 *
 * Tanio: prosta linia po polach (najwyżej kilkanaście pól), liczona tylko dla wroga w zasięgu.
 */
const LOW = new Set(['torch', 'brazier', 'well', 'cemetery', 'ladder', 'roadSand', 'roadWood', 'roadStone']);
const LOW_T = new Set(BUILDINGS.map((d, i) => (LOW.has(d.id) ? i : -1)).filter((i) => i >= 0));

interface Spot { px: number; py: number; up?: boolean; post?: number }

/** Czy pole `t` zasłania strzał (pole pośrednie, nie koniec linii) */
function blocks(g: GameState, t: number, aimHigh: boolean, tx: number, ty: number, postOf: number): boolean {
  const id = g.occupancy[t];
  if (!id) return false;
  if (postOf && id === postOf) return false; // wieża, na której stoi cel
  const w = g.map.width, x = t % w, y = (t - x) / w;
  // korona muru tuż przy celu na murze: strzał idzie ponad blankami w obrońcę
  if (g.walls[t]! & WALL_TOP) return !(aimHigh && Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1);
  const b = buildingById(g, id);
  if (!b || b.ruined || b.build) return false;
  if (LOW_T.has(b.type)) return false;
  const def = BUILDINGS[b.type]!;
  if (def.gate) return !b.gateOpen;
  // dziedziniec twierdzy (przechodnie pole zamku): zasłaniają tylko ściany między polami
  if (g.gates[t]) return false;
  return true;
}

/** Czy `from` (strzelec) widzi `to` (cel) — patrz opis wyżej */
export function lineOfSight(g: GameState, from: Spot, to: Spot, shooterHigh: boolean, targetHigh: boolean): boolean {
  if (shooterHigh) return true;
  return firstBlock(g, from, to, targetHigh) < 0;
}

/**
 * Pierwsze pole na linii od `from` do `to`, które zasłania strzał (−1 = czysto). Dla obrazu: kula czaru, której cel
 * zdążył zejść za przeszkodę, rozbija się na tym polu, a nie przelatuje przez dach (Michał 30.10.2026).
 */
export function firstBlock(g: GameState, from: Spot, to: Spot, targetHigh: boolean): number {
  const w = g.map.width;
  let x = from.px >> 8, y = from.py >> 8;
  const tx = to.px >> 8, ty = to.py >> 8;
  const dx = Math.abs(tx - x), dy = Math.abs(ty - y), sx = tx > x ? 1 : -1, sy = ty > y ? 1 : -1;
  const postOf = to.up && to.post ? to.post : 0;
  // linia po polach (Bresenham), krok po skosie sprawdza też ściany przy narożniku
  let err = dx - dy;
  for (let i = 0; i < 64 && (x !== tx || y !== ty); i++) {
    const e2 = 2 * err;
    let mx = 0, my = 0;
    if (e2 > -dy) { err -= dy; mx = sx; }
    if (e2 < dx) { err += dx; my = sy; }
    if (wallBetween(g, y * w + x, mx, my) && !(targetHigh && x + mx === tx && y + my === ty)) return (y + my) * w + x + mx;
    x += mx; y += my;
    if (x === tx && y === ty) break;
    if (blocks(g, y * w + x, targetHigh, tx, ty, postOf)) return y * w + x;
  }
  return -1;
}

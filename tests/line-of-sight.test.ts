import { describe, expect, it } from 'vitest';
import { UNITS, unitIndex } from '../src/data/units';
import { createGame, FP, playerKeep, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { lineOfSight } from '../src/sim/systems/sight';

/** Pusta łąka przed twierdzą gracza 0 */
function field(): { g: GameState; x: number; y: number } {
  const g = createGame(9);
  emptyScene(g);
  const k = playerKeep(g, 0)!, w = g.map.width, x = k.door % w;
  return { g, x, y: (k.door - x) / w };
}
const soldier = (g: GameState, owner: number, kind: string, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNITS[unitIndex(kind)]!.hp, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
  g.soldiers.push(s);
  return s;
};
const at = (x: number, y: number): { px: number; py: number } => ({ px: x * FP + FP / 2, py: y * FP + FP / 2 });

describe('linia strzału', () => {
  it('łucznik na ziemi nie strzela przez częstokół, bez częstokołu trafia', () => {
    for (const wall of [true, false]) {
      const { g, x, y } = field();
      if (wall) for (let dx = -6; dx <= 6; dx++) expect(placeReady(g, 'palisade', x + dx, y + 22)).toBeTruthy();
      soldier(g, 0, 'archer', x, y + 19);
      const foe = soldier(g, 1, 'spearman', x, y + 25);
      for (let i = 0; i < 120; i++) step(g, []);
      if (wall) expect(foe.hp).toBe(UNITS[unitIndex('spearman')]!.hp);
      else expect(foe.hp).toBeLessThan(UNITS[unitIndex('spearman')]!.hp);
    }
  });

  it('chata zasłania, wysoko stojący strzela ponad nią', () => {
    const { g, x, y } = field();
    expect(placeReady(g, 'house', x - 1, y + 21)).toBeTruthy();
    expect(lineOfSight(g, at(x, y + 18), at(x, y + 26), false, false)).toBe(false);
    expect(lineOfSight(g, at(x, y + 18), at(x, y + 26), true, false)).toBe(true);
    // obok chaty linia jest czysta
    expect(lineOfSight(g, at(x + 8, y + 18), at(x + 8, y + 26), false, false)).toBe(true);
  });

  it('z ziemi widać obrońcę na koronie muru, ale nie wroga za murem', () => {
    const { g, x, y } = field();
    for (let dx = -4; dx <= 4; dx++) expect(placeReady(g, 'stoneWall', x + dx, y + 22)).toBeTruthy();
    step(g, []); // korona muru (WALL_TOP) ustawia się w kroku symulacji
    expect(lineOfSight(g, at(x, y + 17), at(x, y + 22), false, true)).toBe(true);
    expect(lineOfSight(g, at(x, y + 17), at(x, y + 26), false, false)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/data/terrain';
import { clockAt } from '../src/sim/clock';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';

describe('pusta scena testowa', () => {
  it('płaska łąka z samymi twierdzami, budynki stawiane od ręki, zegar ustawialny', () => {
    const g = createGame(7, '1v1', 2, true);
    emptyScene(g);
    expect(g.buildings.every((b) => b.type === 0)).toBe(true);
    expect(g.units.length + g.soldiers.length + g.wolves.length).toBe(0);
    expect([...g.map.tiles].every((t) => t === Terrain.Grass || t === Terrain.Mountain)).toBe(true);
    const k = g.buildings[0]!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    expect(placeReady(g, 'house', hx - 1, hy + 5)).not.toBeNull();
    expect(placeReady(g, 'house', hx - 1, hy + 5)).toBeNull(); // zajęte
    expect(addPeasants(g, 3).length).toBe(3);
    setHour(g, 20.5);
    expect(clockAt(g.tick).hour).toBeCloseTo(20.5, 1);
    for (let i = 0; i < 50; i++) step(g, []);
    expect(g.players.every((p) => !p.bot)).toBe(true);
  });
});

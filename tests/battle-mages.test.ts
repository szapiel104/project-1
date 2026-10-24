import { describe, expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { MAGE_CAP, UNITS, unitIndex } from '../src/data/units';
import { createGame, FP, playerKeep, population, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { battleMages, train } from '../src/sim/systems/army';

/** Pusta łąka: siedziby obu zakonów i koszary gracza 0, ludzie i ruda */
function field(): { g: GameState; fire: number; water: number; barracks: number; door: [number, number] } {
  const g = createGame(9);
  emptyScene(g);
  const k = playerKeep(g, 0)!, w = g.map.width, dx = k.door % w, dy = (k.door - dx) / w;
  const fire = placeReady(g, 'mageFire', dx - 8, dy + 6)!, water = placeReady(g, 'mageWater', dx + 2, dy + 6)!, barracks = placeReady(g, 'barracks', dx - 2, dy + 13)!;
  expect(fire && water && barracks).toBeTruthy();
  while (population(g, 0) < 40) spawnPeasant(g, 0);
  g.players[0]!.res[resIndex('gold')] = 5000;
  return { g, fire, water, barracks, door: [dx, dy] };
}
const soldier = (g: GameState, owner: number, kind: string, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNITS[unitIndex(kind)]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};

describe('magowie bojowi', () => {
  it('szkolą się tylko w siedzibie swojego zakonu, najwyżej 10 na gracza', () => {
    const { g, fire, water, barracks } = field();
    expect(train(g, 0, barracks, 'mageFire')).toBe(false);
    expect(train(g, 0, water, 'mageFire')).toBe(false);
    for (let i = 0; i < 6; i++) expect(train(g, 0, fire, 'mageFire')).toBe(true);
    for (let i = 0; i < 4; i++) expect(train(g, 0, water, 'mageWater')).toBe(true);
    expect(battleMages(g, 0)).toBe(MAGE_CAP);
    expect(train(g, 0, water, 'mageWater')).toBe(false);
    for (let i = 0; i < 1500 && g.soldiers.filter((s) => s.owner === 0 && UNITS[s.kind]!.magic).length < MAGE_CAP; i++) step(g, []);
    expect(g.soldiers.filter((s) => s.owner === 0 && UNITS[s.kind]!.magic).length).toBe(MAGE_CAP);
    expect(train(g, 0, fire, 'mageFire')).toBe(false);
    // rekruci nie zostali uzdrowicielami siedziby
    for (const b of g.buildings) if (b.id === fire || b.id === water) expect(b.worker).not.toBe(0);
  });

  it('kula ognia nie chybia i parzy też stojących obok celu', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageFire', x, y + 20);
    const a = soldier(g, 1, 'spearman', x, y + 26), b = soldier(g, 1, 'spearman', x + 1, y + 26);
    a.stance = 2; b.stance = 2; m.stance = 2;
    for (let i = 0; i < 45; i++) step(g, []);
    expect(Math.min(a.hp, b.hp)).toBeLessThan(UNITS[unitIndex('spearman')]!.hp);
    expect(a.hp < 60 && b.hp < 60).toBe(true);
  });

  it('czar wody spowalnia i odrzuca trafionego', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageWater', x, y + 20);
    const a = soldier(g, 1, 'manatarms', x, y + 25);
    m.stance = 2; a.stance = 2;
    const y0 = a.py;
    for (let i = 0; i < 3; i++) step(g, []);
    expect(a.slow ?? 0).toBeGreaterThan(g.tick);
    expect(a.py).toBeGreaterThan(y0);
  });

  it('mag Źródła gasi własny płonący budynek', () => {
    const { g, fire } = field();
    const b = g.buildings.find((o) => o.id === fire)!;
    const w = g.map.width, d = b.door;
    soldier(g, 0, 'mageWater', d % w, Math.floor(d / w) + 2);
    b.fire = 600;
    for (let i = 0; i < 40; i++) step(g, []);
    expect(b.fire ?? 0).toBeLessThan(600 - 40 - 100);
  });
});

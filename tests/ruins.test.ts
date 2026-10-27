import { describe, expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { SAPPER, UNITS } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { addPeasants, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame as realGame, FP, playerKeep, type Building, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { rebuildCost, ruin } from '../src/sim/systems/placement';
import { salvageLoads } from '../src/sim/systems/army';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; g.wolves = []; return g; };

/** Wolny prostokąt w × h co najmniej `min` pól od twierdzy gracza 0 */
function openArea(g: GameState, w: number, h: number, min: number): { x: number; y: number } {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = min; r < 60; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x0 = keep.x + dx, y0 = keep.y + dy;
        let ok = x0 > 1 && y0 > 1 && x0 + w < W - 1 && y0 + h < g.map.height - 1;
        for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, 0) || g.occupancy[y * W + x]) ok = false;
        if (ok) return { x: x0, y: y0 };
      }
  throw new Error('brak wolnego miejsca');
}

const WOOD = resIndex('wood');

describe('odbudowa ruin kosztuje', () => {
  it('ruina czeka, aż starczy surowców, i pobiera połowę kosztu', () => {
    const g = createGame(7);
    const p = openArea(g, 4, 4, 14);
    const id = placeReady(g, 'house', p.x, p.y)!;
    const house = g.buildings.find((b) => b.id === id)!;
    addPeasants(g, 10); setHour(g, 8);
    const me = g.players[0]!;
    expect(rebuildCost(house.type)).toEqual([['wood', 13]]);
    me.res[WOOD] = 5;
    ruin(g, house);
    for (let i = 0; i < 200; i++) step(g, []);
    // bez drewna nikt nie odbudowuje
    expect(house.unpaid).toBe(true);
    expect(house.ruined).toBe(true);
    expect(g.units.some((u) => u.target === house.id)).toBe(false);
    me.res[WOOD] = 20;
    for (let i = 0; i < 20 && house.unpaid; i++) step(g, []);
    expect(house.unpaid).toBeFalsy();
    expect(me.res[WOOD]).toBeLessThanOrEqual(7);
    for (let i = 0; i < 8000 && house.ruined; i++) step(g, []);
    expect(house.ruined).toBeFalsy();
  });
});

describe('saperzy', () => {
  function setup(): { g: GameState; ruinB: Building; sappers: Soldier[] } {
    const g = createGame(7);
    const p = openArea(g, 4, 4, 12);
    // wroga chata na naszej ziemi, zburzona w bitwie
    const id = placeReady(g, 'house', p.x, p.y, 0, 1)!;
    const ruinB = g.buildings.find((b) => b.id === id)!;
    ruin(g, ruinB);
    g.players[1]!.res[WOOD] = 0; // wróg nie ma za co odbudować
    setHour(g, 8);
    const sappers: Soldier[] = [];
    for (let i = 0; i < 2; i++) {
      const s: Soldier = { id: g.nextId++, owner: 0, kind: SAPPER, px: (p.x - 2) * FP + FP / 2, py: (p.y + i) * FP + FP / 2, path: [], hp: UNITS[SAPPER]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
      g.soldiers.push(s); sappers.push(s);
    }
    return { g, ruinB, sappers };
  }

  it('rozbierają wrogą ruinę, znoszą łup do twierdzy, a ruina znika z mapy', () => {
    const { g, ruinB } = setup();
    const me = g.players[0]!;
    const before = me.res[WOOD]!;
    const loot = salvageLoads(ruinB.type).reduce((n, [, a]) => n + a, 0);
    expect(loot).toBe(12);
    for (let i = 0; i < 6000 && (g.buildings.includes(ruinB) || g.soldiers.some((s) => s.loot)); i++) step(g, []);
    expect(g.buildings.includes(ruinB)).toBe(false);
    expect(g.soldiers.some((s) => s.loot)).toBe(false);
    // drewno z ruiny trafiło do naszych zapasów (nic innego go w tym czasie nie dokładało ponad to)
    expect(me.res[WOOD]! - before).toBeGreaterThanOrEqual(loot);
  });

  it('nie biją się i nie ruszają własnych ruin', () => {
    const { g, ruinB, sappers } = setup();
    ruinB.owner = 0; // to nasza ruina: saperzy jej nie rozbierają
    for (let i = 0; i < 300; i++) step(g, []);
    expect(g.buildings.includes(ruinB)).toBe(true);
    expect(sappers.every((s) => !s.loot && !s.target)).toBe(true);
  });
});

describe('odbudowa nie zabiera wszystkich ludzi z roboty', () => {
  it('przy wielu ruinach z warsztatów i pól pomaga przy budowie najwyżej co piąty pracownik', async () => {
    const { borrowLimit } = await import('../src/sim/systems/army');
    const { Phase } = await import('../src/sim/state');
    const g = createGame(7);
    const me = g.players[0]!;
    me.res[WOOD] = 5000;
    // dziesięć miejsc pracy (leśniczówki) i dziesięć chat do zburzenia
    for (let i = 0; i < 10; i++) { const p = openArea(g, 3, 3, 12); placeReady(g, 'forester', p.x, p.y); }
    const houses: Building[] = [];
    for (let i = 0; i < 10; i++) { const p = openArea(g, 3, 3, 12); const id = placeReady(g, 'house', p.x, p.y)!; houses.push(g.buildings.find((b) => b.id === id)!); }
    setHour(g, 8);
    addPeasants(g, 10);
    for (let i = 0; i < 300; i++) step(g, []);
    const employed = (): number => g.units.filter((u) => u.owner === 0 && u.job).length;
    expect(employed()).toBeGreaterThanOrEqual(8);
    for (const h of houses) ruin(g, h);
    let worst = 0;
    for (let i = 0; i < 3000; i++) {
      step(g, []);
      const helping = g.units.filter((u) => u.owner === 0 && u.job && (u.phase === Phase.ToRepair || u.phase === Phase.Repairing || u.phase === Phase.ToFetch) && g.buildings.find((b) => b.id === u.target)?.build).length;
      worst = Math.max(worst, helping);
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(borrowLimit(employed()));
  });
});

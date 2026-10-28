import { expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { UNITS } from '../src/data/units';
import { createGame, FP, type GameState } from '../src/sim/state';
import { canPlace, placeBuilding, removeRoad } from '../src/sim/systems/placement';
import { enemyRoad, orderWreck, WRECK_TICKS } from '../src/sim/systems/roadwreck';
import { step } from '../src/sim/step';

/** Pole drogi gracza 1 tuż przy jego zamku (ułożone od razu) */
function enemyRoadTile(g: GameState): { x: number; y: number; t: number } {
  const keep = g.buildings.find((b) => b.owner === 1 && b.type === 0)!;
  const road = buildingIndex('roadSand');
  for (let r = 13; r < 25; r++) for (let d = -r; d <= r; d++) {
    const x = keep.x + d, y = keep.y + r;
    if (canPlace(g, 1, road, x, y) === null && placeBuilding(g, 1, road, x, y)) {
      const t = y * g.map.width + x;
      g.roads[t] = g.roadPlan[t]!; g.roadPlan[t] = 0;
      return { x, y, t };
    }
  }
  throw new Error('brak miejsca na drogę');
}

it('droga ma właściciela: swoją zdejmuje się od ręki, wrogą tylko wojskiem', () => {
  const g = createGame(4, '1v1', 1, false);
  for (const p of g.players) p.bot = false;
  const r = enemyRoadTile(g);
  expect(g.roadOwner[r.t]).toBe(2);
  expect(enemyRoad(g, 0, r.t)).toBe(true);
  expect(enemyRoad(g, 1, r.t)).toBe(false);
  // gracz 0 nie zdejmie cudzej drogi narzędziem rozbiórki
  expect(removeRoad(g, 0, r.x, r.y)).toBe(false);
  expect(g.roads[r.t]).toBe(1);

  // dwóch włóczników gracza 0 tuż obok rozkopuje piaskową drogę
  const spear = UNITS.findIndex((u) => u.id === 'spearman');
  const ids: number[] = [];
  for (let k = 0; k < 2; k++) {
    const id = g.nextId++;
    ids.push(id);
    g.soldiers.push({ id, owner: 0, kind: spear, px: (r.x + k) * FP + 128, py: (r.y - 1) * FP + 128, path: [], hp: UNITS[spear]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
  }
  expect(orderWreck(g, 0, ids, r.x, r.y)).toBe(2);
  // wrogowie nie mogą rozkopać własnej drogi ani sojusznik nie dostaje rozkazu na swoją
  expect(orderWreck(g, 1, ids, r.x, r.y)).toBe(0);
  for (let i = 0; i < WRECK_TICKS[1]! + 20 && g.roads[r.t]; i++) step(g, []);
  expect(g.roads[r.t]).toBe(0);
  expect(g.roadOwner[r.t]).toBe(0);
  expect(g.soldiers.filter((s) => ids.includes(s.id)).every((s) => s.wreck === undefined)).toBe(true);

  // a własną drogę gracz 1 dalej zdejmuje od ręki
  const r2 = enemyRoadTile(g);
  expect(removeRoad(g, 1, r2.x, r2.y)).toBe(true);
});

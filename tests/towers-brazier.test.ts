import { expect, it } from 'vitest';
import { BUILDINGS, buildingIndex, footprint } from '../src/data/buildings';
import { UNITS } from '../src/data/units';
import { createGame, FP, type GameState } from '../src/sim/state';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';
import { burnFor, FIRE_BONUS, fireArrow, garrisonRoom, hitDamage, orderGarrison } from '../src/sim/systems/army';
import { step } from '../src/sim/step';

function game(): GameState {
  const g = createGame(5, '1v1', 1, true);
  for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 900); }
  return g;
}

/** Wolny kwadrat n×n na trawie, w pobliżu własnej twierdzy */
function freeSquare(g: GameState, type: number, n: number): [number, number] {
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  for (let r = 13; r < 34; r++) for (let d = -r; d <= r; d++) {
    const x = keep.x + d, y = keep.y + r;
    let ok = canPlace(g, 0, type, x, y) === null;
    for (let k = 0; ok && k < n * n; k++) ok = g.map.tiles[(y + Math.floor(k / n)) * g.map.width + x + (k % n)] === 0;
    if (ok) return [x, y];
  }
  throw new Error('brak miejsca');
}

function archers(g: GameState, n: number, x: number, y: number): number[] {
  const archer = UNITS.findIndex((u) => u.id === 'archer');
  const ids: number[] = [];
  for (let k = 0; k < n; k++) {
    const id = g.nextId++;
    ids.push(id);
    g.soldiers.push({ id, owner: 0, kind: archer, px: (x + (k % 5)) * FP + 128, py: y * FP + 128, path: [], hp: UNITS[archer]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
  }
  return ids;
}

it('większe kamienne wieże: 3×3 i 4×4, mieszczą więcej łuczników i strzelają dalej', () => {
  expect(garrisonRoom('stoneTower')).toBe(6);
  expect(garrisonRoom('stoneTowerBig')).toBe(10);
  expect(garrisonRoom('stoneTowerGreat')).toBe(16);
  for (const [id, n] of [['stoneTowerBig', 3], ['stoneTowerGreat', 4]] as const) {
    const g = game();
    const type = buildingIndex(id);
    expect(BUILDINGS[type]!.w).toBe(n);
    const [x, y] = freeSquare(g, type, n);
    expect(placeBuilding(g, 0, type, x, y)).toBe(true);
    const t = g.buildings.find((b) => b.type === type && b.x === x && b.y === y)!;
    t.build = 0;
    const room = garrisonRoom(id);
    const ids = archers(g, room + 2, x, y + n);
    orderGarrison(g, 0, ids, t.id);
    expect(g.soldiers.filter((s) => s.post === t.id).length).toBe(room);
    for (let i = 0; i < 1500; i++) step(g, []);
    expect(g.soldiers.filter((s) => s.post === t.id && s.up).length).toBe(room);
    expect(footprint(BUILDINGS[type]!, 0).w).toBe(n);
  }
});

it('koksownik: tylko na własnym gotowym murze kamiennym albo kamiennej wieży, łucznicy obok strzelają ogniem', () => {
  const g = game();
  const tower = buildingIndex('stoneTower'), brazier = buildingIndex('brazier');
  const [x, y] = freeSquare(g, tower, 2);
  // na gołej ziemi nie wolno
  expect(canPlace(g, 0, brazier, x, y)).toBe('place.brazier');
  expect(placeBuilding(g, 0, tower, x, y)).toBe(true);
  const t = g.buildings.find((b) => b.type === tower && b.x === x && b.y === y)!;
  // na wieży w budowie jeszcze nie (gra w trybie deweloperskim stawia od ręki, więc udajemy plac budowy)
  t.build = 100;
  expect(canPlace(g, 0, brazier, x, y)).toBe('place.brazier');
  t.build = 0;
  const before = g.buildings.length, stone = g.players[0]!.res.slice();
  expect(canPlace(g, 0, brazier, x + 1, y + 1)).toBe(null);
  expect(placeBuilding(g, 0, brazier, x + 1, y + 1)).toBe(true);
  expect(g.buildings.length).toBe(before); // nie zajmuje pola, tylko wyposaża wieżę
  expect(t.brazier).toBe(1);
  expect(g.players[0]!.res.some((v, i) => v < stone[i]!)).toBe(true);
  expect(canPlace(g, 0, brazier, x, y)).toBe('place.brazierTaken');

  // łucznik na wieży: ognista strzała; ten sam łucznik na ziemi — zwykła
  const [id] = archers(g, 1, x, y - 3);
  orderGarrison(g, 0, [id!], t.id);
  for (let i = 0; i < 400; i++) step(g, []);
  const a = g.soldiers.find((s) => s.id === id)!;
  expect(a.up).toBe(true);
  expect(fireArrow(g, a)).toBe(true);
  const spear = UNITS.findIndex((u) => u.id === 'spearman');
  const foe = { id: g.nextId++, owner: 1, kind: spear, px: a.px, py: a.py + 6 * FP, path: [], hp: UNITS[spear]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
  const byId = new Map([[a.id, a], [foe.id, foe]]);
  const hot = hitDamage(g, a, foe, byId, true);
  t.brazier = undefined;
  expect(fireArrow(g, a)).toBe(false);
  const cold = hitDamage(g, a, foe, byId, true);
  // od 0.53: ognista strzała rani przy trafieniu tak samo, a premia schodzi z celu płomieniem (po 1 zdrowia co BURN_EVERY ticków)
  expect(hot).toBe(cold);
  expect(burnFor(cold)).toBe(Math.max(2, Math.round((cold * FIRE_BONUS) / 100)));
});

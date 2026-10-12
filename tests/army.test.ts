import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { deserialize, serialize } from '../src/sim/save';
import { createGame, playerKeep, population, stateHash, type GameState } from '../src/sim/state';
import { step, type Command } from '../src/sim/step';
import { canPlace } from '../src/sim/systems/placement';

function spot(g: GameState, id: string): { x: number; y: number } {
  const keep = playerKeep(g, 0)!;
  const type = buildingIndex(id);
  for (let r = 3; r < RULES.buildRadius; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (canPlace(g, 0, type, keep.x + dx, keep.y + dy, false) === null) return { x: keep.x + dx, y: keep.y + dy };
  throw new Error('brak miejsca');
}

function withBarracks(): { g: GameState; id: number } {
  const g = createGame(7);
  const p = g.players[0]!;
  p.res[resIndex('wood')] = 500; p.res[resIndex('stone')] = 500; p.res[resIndex('spear')] = 5; p.res[resIndex('gold')] = 100;
  step(g, [{ type: 'build', player: 0, building: 'barracks', ...spot(g, 'barracks') }]);
  const b = g.buildings.find((x) => x.type === buildingIndex('barracks'))!;
  return { g, id: b.id };
}

describe('wojsko', () => {
  it('koszary zamieniają wolnego chłopa w żołnierza za włócznię i złoto', () => {
    const { g, id } = withBarracks();
    const pop = population(g, 0);
    const gold = g.players[0]!.res[resIndex('gold')]!;
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    expect(g.soldiers.length).toBe(1);
    expect(population(g, 0)).toBe(pop - 1);
    expect(g.players[0]!.res[resIndex('spear')]).toBe(4);
    expect(g.players[0]!.res[resIndex('gold')]).toBe(gold - 8);
  });

  it('bez włóczni nie ma szkolenia', () => {
    const { g, id } = withBarracks();
    g.players[0]!.res[resIndex('spear')] = 0;
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    expect(g.soldiers.length).toBe(0);
  });

  it('oddział idzie w szyku na wskazane miejsce i każdy staje na innym polu', () => {
    const { g, id } = withBarracks();
    const train: Command[] = [1, 2, 3].map(() => ({ type: 'train', player: 0, building: id, unit: 'spearman' }));
    step(g, train);
    const keep = playerKeep(g, 0)!;
    const tx = keep.x + 1, ty = keep.y + 8;
    step(g, [{ type: 'move', player: 0, ids: g.soldiers.map((s) => s.id), x: tx, y: ty }]);
    for (let i = 0; i < 800; i++) step(g, []);
    const tiles = g.soldiers.map((s) => (s.py >> 8) * g.map.width + (s.px >> 8));
    expect(new Set(tiles).size).toBe(tiles.length);
    for (const s of g.soldiers) expect(Math.abs((s.px >> 8) - tx) + Math.abs((s.py >> 8) - ty)).toBeLessThanOrEqual(3);
  });

  it('zapis pamięta żołnierzy', () => {
    const { g, id } = withBarracks();
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    const back = deserialize(serialize(g, '1v1'))!;
    expect(back.soldiers.length).toBe(1);
    expect(stateHash(back)).toBe(stateHash(g));
  });
});

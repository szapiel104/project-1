import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { createGame } from '../src/sim/state';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';
import { walkable } from '../src/sim/path';
import { step } from '../src/sim/step';

describe('brama na częstokole', () => {
  it('bramę można postawić na własnym przęśle: przęsło znika, swoi przechodzą, wróg nie', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const pal = buildingIndex('palisade'), gate = buildingIndex('gate');
    let x = -1, y = -1;
    for (let r = 5; r < 15 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++) {
      const tx = keep.x + d, ty = keep.y + r;
      if ([0, 1, 2].every((k) => canPlace(g, 0, pal, tx + k, ty) === null)) { x = tx; y = ty; }
    }
    expect(x).toBeGreaterThanOrEqual(0);
    for (let k = 0; k < 3; k++) expect(placeBuilding(g, 0, pal, x + k, y)).toBe(true);
    const W = g.map.width, t = y * W + x + 1;
    // na zajętym polu zwykły budynek nie stanie, brama tak
    expect(canPlace(g, 0, buildingIndex('well'), x + 1, y)).not.toBe(null);
    expect(canPlace(g, 0, gate, x + 1, y)).toBe(null);
    // cudzy gracz nie wstawi bramy w mój częstokół
    expect(canPlace(g, 1, gate, x + 1, y)).not.toBe(null);
    const before = g.buildings.length;
    expect(placeBuilding(g, 0, gate, x + 1, y)).toBe(true);
    expect(g.buildings.length).toBe(before); // przęsło zastąpione bramą
    const here = g.buildings.filter((b) => b.x === x + 1 && b.y === y);
    expect(here.map((b) => BUILDINGS[b.type]!.id)).toEqual(['gate']);
    expect(g.rubble.some((r) => r.x === x + 1 && r.y === y)).toBe(false);
    expect(walkable(g, t, 0)).toBe(true);
    expect(walkable(g, t, 1)).toBe(false);
  });

  it('mur kamienny wchodzi na palisadę, a wieża 2×2 staje na murze', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const pal = buildingIndex('palisade'), stone = buildingIndex('stoneWall'), tower = buildingIndex('watchtower');
    let x = -1, y = -1;
    for (let r = 5; r < 16 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++) {
      const tx = keep.x + d, ty = keep.y + r;
      if ([0, 1, 2, 3].every((k) => canPlace(g, 0, pal, tx + k, ty) === null) && [2, 3].every((k) => canPlace(g, 0, pal, tx + k, ty - 1) === null)) { x = tx; y = ty; }
    }
    expect(x).toBeGreaterThanOrEqual(0);
    for (let k = 0; k < 4; k++) expect(placeBuilding(g, 0, pal, x + k, y)).toBe(true);
    // kamień na bale
    expect(placeBuilding(g, 0, stone, x, y)).toBe(true);
    expect(g.buildings.filter((b) => b.x === x && b.y === y).map((b) => BUILDINGS[b.type]!.id)).toEqual(['stoneWall']);
    // kamień na kamień — nie
    expect(canPlace(g, 0, stone, x, y)).not.toBe(null);
    // wieża 2×2 na dwóch przęsłach palisady (druga połowa na wolnym polu)
    expect(canPlace(g, 0, tower, x + 2, y - 1)).toBe(null);
    expect(placeBuilding(g, 0, tower, x + 2, y - 1)).toBe(true);
    expect(g.buildings.filter((b) => (b.y === y || b.y === y - 1) && (b.x === x + 2 || b.x === x + 3)).map((b) => BUILDINGS[b.type]!.id)).toEqual(['watchtower']);
    // brama na murze kamiennym
    expect(canPlace(g, 0, buildingIndex('gate'), x, y)).toBe(null);
  });

  it('łucznicy wchodzą na mur kamienny (najwyżej dwóch na pole)', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const stone = buildingIndex('stoneWall');
    let x = -1, y = -1;
    for (let r = 5; r < 16 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++) if (canPlace(g, 0, stone, keep.x + d, keep.y + r) === null) { x = keep.x + d; y = keep.y + r; }
    expect(placeBuilding(g, 0, stone, x, y)).toBe(true);
    const wall = g.buildings[g.buildings.length - 1]!;
    wall.build = 0;
    const W = g.map.width;
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const id = g.nextId++;
      ids.push(id);
      g.soldiers.push({ id, owner: 0, kind: 1, px: (x + 1 + i) * 256 + 128, py: (y + 2) * 256 + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 } as never);
    }
    step(g, [{ type: 'garrison', player: 0, ids, tower: wall.id }]);
    for (let i = 0; i < 300; i++) step(g, []);
    expect(g.soldiers.filter((s) => s.post === wall.id && s.up).length).toBe(2);
    void W;
  });
});

import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { createGame } from '../src/sim/state';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';
import { walkable } from '../src/sim/path';
import { step } from '../src/sim/step';
import { high } from '../src/sim/systems/army';

describe('brama na częstokole', () => {
  it('bramę można postawić na własnym przęśle: przęsło znika, swoi przechodzą, wróg nie', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 500); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const pal = buildingIndex('palisade'), gate = buildingIndex('gate');
    let x = -1, y = -1;
    for (let r = 5; r < 15 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++) {
      const tx = keep.x + d, ty = keep.y + r;
      if ([0, 1, 2].every((k) => canPlace(g, 0, pal, tx + k, ty) === null && g.map.tiles[ty * g.map.width + tx + k] === 0)) { x = tx; y = ty; }
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
      if ([0, 1, 2, 3].every((k) => canPlace(g, 0, pal, tx + k, ty) === null && g.map.tiles[ty * g.map.width + tx + k] === 0) && [2, 3].every((k) => canPlace(g, 0, pal, tx + k, ty - 1) === null && g.map.tiles[(ty - 1) * g.map.width + tx + k] === 0)) { x = tx; y = ty; }
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

  it('po murze kamiennym chodzi się jak po terenie, wchodzi się tylko po drabinie (każdy, kto do niej dojdzie)', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 900); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const stone = buildingIndex('stoneWall');
    let x = -1, y = -1;
    for (let r = 6; r < 16 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++)
      if ([0, 1, 2, 3, 4, 5].every((k) => canPlace(g, 0, stone, keep.x + d + k, keep.y + r) === null)) { x = keep.x + d; y = keep.y + r; }
    expect(x).toBeGreaterThanOrEqual(0);
    for (let k = 0; k < 6; k++) { expect(placeBuilding(g, 0, stone, x + k, y)).toBe(true); g.buildings[g.buildings.length - 1]!.build = 0; }
    // bez drabiny nikt nie wejdzie
    const W = g.map.width, top = y * W + x + 3;
    expect(canPlace(g, 0, buildingIndex('ladder'), x + 3, y + 3)).toBe('place.ladder'); // nie przy murze
    expect(placeBuilding(g, 0, buildingIndex('ladder'), x + 3, y + 1)).toBe(true);
    g.buildings[g.buildings.length - 1]!.build = 0;
    step(g, []);
    expect(walkable(g, top, 0)).toBe(true);
    expect(walkable(g, (y + 1) * W + x + 3, 1)).toBe(true); // drabina od zewnątrz posłuży też wrogowi
    // łucznik spod muru wchodzi na koronę po postawionej drabinie i strzela z góry
    const id = g.nextId++;
    g.soldiers.push({ id, owner: 0, kind: 1, px: (x + 3) * 256 + 128, py: (y + 3) * 256 + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 } as never);
    step(g, [{ type: 'move', player: 0, ids: [id], x: x + 3, y }]);
    for (let i = 0; i < 600; i++) step(g, []);
    const s = g.soldiers.find((o) => o.id === id)!;
    expect((s.py >> 8) * W + (s.px >> 8)).toBe(top);
    expect(high(g, s)).toBe(true);
  });

  it('wróg wchodzi na mur po drabinie postawionej od zewnątrz i walczy z obrońcą na koronie', () => {
    const g = createGame(5, '1v1', 1, true);
    for (const p of g.players) { p.bot = false; p.res = p.res.map(() => 900); }
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const stone = buildingIndex('stoneWall');
    let x = -1, y = -1;
    for (let r = 5; r < 30 && x < 0; r++) for (let d = -r; d <= r && x < 0; d++)
      if ([0, 1, 2, 3, 4, 5].every((k) => canPlace(g, 0, stone, keep.x + d + k, keep.y + r) === null && (k !== 1 || canPlace(g, 0, buildingIndex('palisade'), keep.x + d + k, keep.y + r + 1) === null) && (k !== 1 || canPlace(g, 0, buildingIndex('palisade'), keep.x + d + k, keep.y + r + 4) === null))) { x = keep.x + d; y = keep.y + r; }
    expect(x).toBeGreaterThanOrEqual(0);
    for (let k = 0; k < 6; k++) { placeBuilding(g, 0, stone, x + k, y); g.buildings[g.buildings.length - 1]!.build = 0; }
    // drabina od zewnątrz (z dala od twierdzy)
    expect(canPlace(g, 0, buildingIndex('ladder'), x + 1, y + 1)).toBe(null);
    expect(placeBuilding(g, 0, buildingIndex('ladder'), x + 1, y + 1)).toBe(true);
    g.buildings[g.buildings.length - 1]!.build = 0;
    step(g, []);
    const W = g.map.width;
    const mk = (owner: number, tx: number, ty: number): number => {
      const id = g.nextId++;
      g.soldiers.push({ id, owner, kind: 0, px: tx * 256 + 128, py: ty * 256 + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, stance: owner === 0 ? 2 : 0 } as never);
      return id;
    };
    const def = mk(0, x + 4, y);
    for (const s of g.soldiers) if (s.id === def) { s.hold = y * W + x + 4; }
    const foe = mk(1, x + 1, y + 4);
    step(g, [{ type: 'move', player: 1, ids: [foe], x: x + 3, y, amove: true }]);
    let met = false;
    for (let i = 0; i < 900 && !met; i++) {
      step(g, []);
      const f = g.soldiers.find((o) => o.id === foe), d = g.soldiers.find((o) => o.id === def);
      if (!f || !d || f.hp < 60 || d.hp < 60) met = true;
    }
    expect(met).toBe(true);
  });
});

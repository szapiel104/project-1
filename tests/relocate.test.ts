import { describe, expect, it } from 'vitest';
import { createGame, playerKeep } from '../src/sim/state';
import { placeReady } from '../src/sim/emptyscene';
import { step } from '../src/sim/step';
import { walkable } from '../src/sim/path';
import { resIndex } from '../src/data/resources';
import { buildingIndex } from '../src/data/buildings';
import { canRelocate, canRelocateTo, relocateCost } from '../src/sim/systems/relocate';

/** Wolne miejsce 3×3 za twierdzą, od promienia r (pierwsze, gdzie da się postawić gotowy budynek) */
function spot(g: ReturnType<typeof createGame>, from: number, skip = 0): { x: number; y: number } {
  const k = playerKeep(g, 0)!, W = g.map.width;
  for (let r = from; r < 40; r++)
    for (let d = -r; d <= r; d++) {
      const x = k.x + d, y = k.y + r;
      let ok = true;
      for (let yy = y - 1; ok && yy < y + 4; yy++) for (let xx = x - 1; ok && xx < x + 4; xx++) if (!walkable(g, yy * W + xx, 0) || g.occupancy[yy * W + xx] || g.reserved[yy * W + xx]) ok = false;
      if (ok && skip-- <= 0) return { x, y };
    }
  throw new Error('brak miejsca');
}

describe('przenoszenie budynku za rudę', () => {
  it('stary znika w stos, robotnicy noszą go na nowy plac i budynek staje w nowym miejscu', () => {
    const g = createGame(7);
    const a = spot(g, 10);
    const id = placeReady(g, 'woodcutter', a.x, a.y, 0, 0)!;
    expect(id).toBeTruthy();
    const p = g.players[0]!, gold = resIndex('gold');
    p.res[gold] = 0;
    expect(canRelocate(g, 0, id)).toBe('move.cost');
    p.res[gold] = 500;
    const wood = p.res[resIndex('wood')];
    let b = spot(g, 14);
    for (let k = 1; canRelocateTo(g, 0, id, b.x, b.y, 1) !== null; k++) b = spot(g, 14, k);
    const cost = relocateCost(buildingIndex('woodcutter'));
    step(g, [{ type: 'relocate', player: 0, id, x: b.x, y: b.y, rot: 1 }]);
    expect(p.res[gold]).toBe(500 - cost);
    expect(p.res[resIndex('wood')]).toBe(wood); // materiał nie jest płacony drugi raz
    expect(g.buildings.some((x) => x.id === id)).toBe(false);
    const nb = g.buildings.find((x) => x.x === b.x && x.y === b.y)!;
    expect(nb.build).toBeGreaterThan(0);
    expect(nb.rot).toBe(1);
    const stack = g.rubble.find((r) => r.id === nb.from)!;
    expect(stack.to).toBe(nb.id);
    const n = stack.loads.length;
    expect(n).toBeGreaterThan(0);
    let tookFromStack = false;
    for (let i = 0; i < 20000 && nb.build > 0; i++) {
      step(g, []);
      if (g.rubble.find((r) => r.id === stack.id)?.loads.length !== n) tookFromStack = true;
    }
    expect(tookFromStack).toBe(true);
    expect(nb.build).toBe(0);
    expect(g.rubble.some((r) => r.id === stack.id && r.to)).toBe(false);
  });

  it('nie przenosi się twierdzy, murów ani magazynów', () => {
    const g = createGame(7);
    g.players[0]!.res[resIndex('gold')] = 999;
    expect(canRelocate(g, 0, playerKeep(g, 0)!.id)).toBe('move.cannot');
    const a = spot(g, 10);
    const s = placeReady(g, 'stockpile', a.x, a.y, 0, 0)!;
    expect(canRelocate(g, 0, s)).toBe('move.cannot');
  });
});

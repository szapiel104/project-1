import { expect, it } from 'vitest';
import { RESOURCES, resIndex } from '../src/data/resources';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { Phase } from '../src/sim/state';
import { canPlace } from '../src/sim/systems/placement';
import { buildingIndex } from '../src/data/buildings';
import { stockOf } from '../src/sim/systems/stock';
it('po materiał na budowę idą do składu, w którym leży surowiec, a nie do bliższego pustego (30.10.2026)', () => {
  const g = createGame(11, '1v1', 2, false); emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W), p = g.players[0]!;
  for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
  const nearId = placeReady(g, 'stockpile', hx + 3, hy + 4)!;
  const farId = placeReady(g, 'stockpile', hx + 14, hy + 4)!;
  const near = g.buildings.find((b) => b.id === nearId)!, far = g.buildings.find((b) => b.id === farId)!;
  const wood = resIndex('wood');
  p.res[wood] = 60; step(g, []);
  // całe drewno w dalszym składzie
  for (const b of g.buildings) if (b.stock) b.stock[wood] = 0;
  stockOf(far)[wood] = 60;
  addPeasants(g, 4); setHour(g, 9);
  let sx = -1, sy = -1;
  for (let r = 3; r < 12 && sx < 0; r++) for (let dx = -r; dx <= r && sx < 0; dx++) if (canPlace(g, 0, buildingIndex('house'), hx + dx, hy - r, true) === null) { sx = hx + dx; sy = hy - r; }
  step(g, [{ type: 'build', player: 0, building: 'house', x: sx, y: sy }]);
  const doors = new Set<number>();
  for (let i = 0; i < 800; i++) {
    step(g, []);
    for (const u of g.units) if (u.phase === Phase.ToFetch && u.path.length) { const e = u.path[u.path.length - 1]!; doors.add(e); }
  }
  expect(doors.size).toBeGreaterThan(0);
  expect(doors.has(near.door)).toBe(false);
}, 60000);

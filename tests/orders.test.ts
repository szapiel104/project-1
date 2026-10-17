import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { FP, createGame as realGame, playerKeep, stateHash, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; return g; };

const mk = (g: GameState, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('spearman'), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};

/** Wolny prostokąt w × h niedaleko twierdzy */
function openArea(g: GameState, w: number, h: number): { x: number; y: number } {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = 6; r < 50; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x0 = keep.x + dx, y0 = keep.y + dy;
        let ok = x0 > 0 && y0 > 0 && x0 + w < W && y0 + h < g.map.height;
        for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, 0)) ok = false;
        if (ok) return { x: x0, y: y0 };
      }
  throw new Error('brak wolnego miejsca');
}

const near = (s: Soldier, x: number, y: number, d = 2): boolean => Math.abs((s.px >> 8) - x) <= d && Math.abs((s.py >> 8) - y) <= d;

describe('kolejka rozkazów i patrol', () => {
  it('Shift + prawy klik: oddział idzie po kolei przez punkty trasy', () => {
    const g = createGame(11);
    const a = openArea(g, 14, 14);
    const list = [mk(g, a.x + 1, a.y + 1), mk(g, a.x + 2, a.y + 1)];
    const ids = list.map((s) => s.id);
    const p1 = { x: a.x + 12, y: a.y + 1 }, p2 = { x: a.x + 12, y: a.y + 12 };
    step(g, [{ type: 'move', player: 0, ids, ...p1, queue: true }]);
    step(g, [{ type: 'move', player: 0, ids, ...p2, queue: true }]);
    expect(g.orders?.length).toBe(1);
    let visited1 = false, t = 0;
    for (; t < 3000; t++) {
      step(g, []);
      if (list.every((s) => near(s, p1.x, p1.y))) visited1 = true;
      if (!g.orders?.length && list.every((s) => s.goal < 0 && !s.path.length)) break;
    }
    expect(visited1).toBe(true);
    expect(list.every((s) => near(s, p2.x, p2.y))).toBe(true);
  });

  it('patrol chodzi tam i z powrotem, przetrwa zapis, a zwykły rozkaz go kończy', () => {
    const g = createGame(12);
    const a = openArea(g, 14, 4);
    const list = [mk(g, a.x + 1, a.y + 1), mk(g, a.x + 1, a.y + 2)];
    const ids = list.map((s) => s.id);
    const far = { x: a.x + 12, y: a.y + 1 };
    step(g, [{ type: 'patrol', player: 0, ids, pts: [[far.x, far.y]] }]);
    expect(g.orders?.[0]?.patrol).toBe(true);
    let out = 0, back = 0, wasFar = false;
    for (let t = 0; t < 4000 && back < 2; t++) {
      step(g, []);
      if (!wasFar && list.every((s) => near(s, far.x, far.y))) { wasFar = true; out++; }
      if (wasFar && list.every((s) => near(s, a.x + 1, a.y + 1))) { wasFar = false; back++; }
    }
    expect(out).toBeGreaterThanOrEqual(2);
    expect(back).toBe(2);
    // zapis i odczyt: kolejka jest w stanie gry, skrót się zgadza
    const g2 = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(g2).not.toBeNull();
    expect(stateHash(g2)).toBe(stateHash(g));
    // zwykły rozkaz: koniec patrolu
    step(g, [{ type: 'move', player: 0, ids, x: a.x + 5, y: a.y + 1 }]);
    expect(g.orders?.length ?? 0).toBe(0);
  });
});

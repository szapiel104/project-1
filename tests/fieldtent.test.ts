import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { placeReady } from '../src/sim/emptyscene';
import { FP, createGame as realGame, playerKeep, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; return g; };

const mk = (g: GameState, owner: number, x: number, y: number, extra: Partial<Soldier> = {}): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex('spearman'), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, ...extra };
  g.soldiers.push(s);
  return s;
};

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

const dist = (s: Soldier, x: number, y: number): number => Math.max(Math.abs((s.px >> 8) - x), Math.abs((s.py >> 8) - y));

describe('namiot polowy z medykiem', () => {
  it('ranny idzie do bliższego namiotu z medykiem zamiast do zamku i tam szybciej się leczy', () => {
    const g = createGame(7);
    const a = openArea(g, 9, 9, 22);
    const id = placeReady(g, 'fieldTent', a.x + 3, a.y + 3)!;
    expect(id).toBeTruthy();
    const tent = g.buildings.find((b) => b.id === id)!;
    tent.worker = g.units.find((u) => u.owner === 0)!.id; // medyk na miejscu
    const s = mk(g, 0, a.x, a.y + 8, { hp: 15, wounded: 1, hold: -1 });
    let start = -1;
    for (let i = 0; i < 1500; i++) {
      step(g, []);
      if (start < 0 && dist(s, a.x + 4, a.y + 4) <= 4 && !s.path.length) start = s.hp;
      if (!s.wounded) break;
    }
    // doszedł do namiotu, nie do zamku, i wyzdrowiał
    expect(start).toBeGreaterThan(0);
    expect(s.wounded ?? 0).toBe(0);
    expect(s.hp).toBeGreaterThanOrEqual(54);
  });

  it('namiot bez medyka nie leczy', () => {
    const g = createGame(7);
    const a = openArea(g, 9, 9, 22);
    const id = placeReady(g, 'fieldTent', a.x + 3, a.y + 3)!;
    const tent = g.buildings.find((b) => b.id === id)!;
    tent.off = true; // wyłączony: medyk nie pracuje
    const s = mk(g, 0, a.x + 4, a.y + 7, { hp: 20 });
    for (let i = 0; i < 200; i++) step(g, []);
    expect(s.hp).toBe(20);
  });
});

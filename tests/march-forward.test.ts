import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { FP, createGame as realGame, playerKeep, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; return g; };
const mk = (g: GameState, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};
/** Wolny pas w × h od twierdzy */
function open(g: GameState, w: number, h: number): { x: number; y: number } {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = 4; r < 50; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = keep.x + dx, y0 = keep.y + dy;
    let ok = x0 > 0 && y0 > 0 && x0 + w < W && y0 + h < g.map.height;
    for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, 0)) ok = false;
    if (ok) return { x: x0, y: y0 };
  }
  throw new Error('brak miejsca');
}

describe('marsz łuczników do przodu (zgłoszenie: stoją, cofają się, co drugi klik idą)', () => {
  it('rozkaz do przodu: oddział rusza od razu i nikt nie cofa się za swoje miejsce startowe', () => {
    const g = createGame(11);
    const a = open(g, 7, 26);
    // sześciu łuczników w luźnej gromadce na dole pasa
    const list = [0, 1, 2, 3, 4, 5].map((i) => mk(g, a.x + 1 + (i % 3) * 2, a.y + 22 + Math.floor(i / 3)));
    const ids = list.map((s) => s.id);
    const startY = list.map((s) => s.py);
    step(g, [{ type: 'move', player: 0, ids, x: a.x + 3, y: a.y + 2 }]);
    let back = 0, firstGain = -1;
    const cy0 = list.reduce((t, s) => t + s.py, 0) / list.length;
    for (let t = 0; t < 900; t++) {
      step(g, []);
      list.forEach((s, i) => { back = Math.max(back, (s.py - startY[i]!) / FP); });
      const cy = list.reduce((t2, s) => t2 + s.py, 0) / list.length;
      if (firstGain < 0 && cy0 - cy > 2 * FP) firstGain = t;
    }
    expect(back).toBeLessThan(1.6); // przy ustawianiu w szyk najwyżej krok w tył
    expect(firstGain).toBeGreaterThanOrEqual(0);
    expect(firstGain).toBeLessThan(120); // po kilku sekundach oddział jest już 2 pola bliżej celu
  });

  it('kolejne kliknięcia do przodu co sekundę: oddział cały czas posuwa się naprzód', () => {
    const g = createGame(11);
    const a = open(g, 7, 30);
    const list = [0, 1, 2, 3, 4, 5].map((i) => mk(g, a.x + 1 + (i % 3) * 2, a.y + 26 + Math.floor(i / 3)));
    const ids = list.map((s) => s.id);
    const cy = (): number => list.reduce((t, s) => t + s.py, 0) / list.length / FP;
    let prev = cy();
    let worst = 0;
    for (let k = 0; k < 8; k++) {
      // klik zawsze ~8 pól przed środkiem oddziału
      step(g, [{ type: 'move', player: 0, ids, x: a.x + 3, y: Math.max(a.y + 1, Math.round(cy()) - 8) }]);
      for (let t = 0; t < 10; t++) step(g, []);
      const now = cy();
      worst = Math.max(worst, now - prev); // dodatnie = cofnięcie
      prev = now;
    }
    expect(worst).toBeLessThan(0.3);
    expect(cy()).toBeLessThan(a.y + 26 - 4);
  });
});

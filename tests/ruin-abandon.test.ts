import { describe, expect, it } from 'vitest';
import { createGame, playerKeep } from '../src/sim/state';
import { placeReady } from '../src/sim/emptyscene';
import { demolish, ruin } from '../src/sim/systems/placement';
import { FIRST_WAVE, nextWave } from '../src/sim/systems/bot';
import { walkable } from '../src/sim/path';

describe('porzucenie ruiny', () => {
  function house(): { g: ReturnType<typeof createGame>; id: number } {
    const g = createGame(7);
    const k = playerKeep(g, 0)!, W = g.map.width;
    for (let r = 8; r < 40; r++)
      for (let d = -r; d <= r; d++) {
        const x = k.x + d, y = k.y + r;
        let ok = true;
        for (let yy = y; ok && yy < y + 3; yy++) for (let xx = x; ok && xx < x + 3; xx++) if (!walkable(g, yy * W + xx, 0) || g.occupancy[yy * W + xx]) ok = false;
        const id = ok ? placeReady(g, 'house', x, y, 0, 0) : null;
        if (id) return { g, id };
      }
    throw new Error('brak miejsca');
  }

  it('zwykła rozbiórka zwraca połowę kosztu, porzucona ruina tylko gruz', () => {
    const a = house();
    expect(demolish(a.g, 0, a.id)).toBe(true);
    expect(a.g.rubble.at(-1)!.loads.some(([r]) => r >= 0)).toBe(true);

    const b = house();
    const bld = b.g.buildings.find((x) => x.id === b.id)!;
    ruin(b.g, bld);
    expect(demolish(b.g, 0, b.id)).toBe(true);
    expect(b.g.buildings.some((x) => x.id === b.id)).toBe(false);
    expect(b.g.rubble.at(-1)!.loads).toEqual([[-1, 0]]);
  });
});

describe('fale bota', () => {
  it('każdy bot (przesunięcie myślenia o id) trafia w pierwszą falę', () => {
    for (let id = 0; id < 8; id++) {
      let hit = false;
      for (let t = id * 5; t <= FIRST_WAVE; t += 40) { const w = nextWave(t); if (w && w.at - t < 40 && w.at === FIRST_WAVE) hit = true; }
      expect(hit, `bot ${id}`).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { Crowd } from '../src/render/motion';

describe('ludzie nie wchodzą w siebie (motion.ts)', () => {
  it('dziesięciu idących tą samą drogą w tym samym miejscu rozsuwa się, a nie stoi jeden w drugim', () => {
    const c = new Crowd();
    let pos: { sx: number; sy: number }[] = [];
    for (let f = 0; f < 120; f++) {
      c.begin(1 / 60);
      pos = [];
      for (let id = 1; id <= 10; id++) pos.push(c.move(id, 10 + f * 0.02, 10, Math.PI / 2, false));
    }
    let min = Infinity;
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) min = Math.min(min, Math.hypot(pos[i]!.sx - pos[j]!.sx, pos[i]!.sy - pos[j]!.sy));
    expect(min).toBeGreaterThan(0.08);
    // nikt nie odjechał daleko od drogi
    for (const p of pos) expect(Math.hypot(p.sx - (10 + 119 * 0.02), p.sy - 10)).toBeLessThan(0.5);
  });
});

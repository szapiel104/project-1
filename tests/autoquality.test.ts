import { describe, expect, it } from 'vitest';
import { AutoQuality, TOP_TIER } from '../src/render/autoquality';

/** Puszcza `ms` milisekund klatek po `dt` ms i zbiera zmiany poziomu */
function run(q: AutoQuality, dt: number, ms: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < ms; t += dt) { const r = q.frame(dt); if (r !== null) out.push(r); }
  return out;
}

describe('automatyczna jakość', () => {
  it('słaby komputer: schodzi poziom po poziomie aż do płynności', () => {
    const q = new AutoQuality(TOP_TIER);
    expect(run(q, 1000 / 20, 40000)).toEqual([3, 2, 1, 0]);
    expect(q.tier).toBe(0);
  });

  it('płynnie: zostaje na najwyższym', () => {
    const q = new AutoQuality(TOP_TIER);
    expect(run(q, 1000 / 60, 60000)).toEqual([]);
  });

  it('pomija przerwy (karta w tle) i nie obniża przez nie jakości', () => {
    const q = new AutoQuality(TOP_TIER);
    expect(run(q, 1000, 60000)).toEqual([]);
  });

  it('próbuje wyżej tylko raz; gdy znów przycina, wraca i zostaje', () => {
    const q = new AutoQuality(2);
    expect(run(q, 1000 / 60, 30000)).toEqual([3]);
    expect(run(q, 1000 / 30, 6000)).toEqual([2]);
    expect(run(q, 1000 / 60, 60000)).toEqual([]);
    expect(q.tier).toBe(2);
  });
});

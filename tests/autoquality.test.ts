import { describe, expect, it } from 'vitest';
import { AutoQuality, MIN_AUTO, TOP_TIER } from '../src/render/autoquality';

/** Puszcza `ms` milisekund klatek po `dt` ms i zbiera zmiany poziomu */
function run(q: AutoQuality, dt: number, ms: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < ms; t += dt) { const r = q.frame(dt); if (r !== null) out.push(r); }
  return out;
}

describe('automatyczna jakość', () => {
  it('słaby komputer: schodzi poziom po poziomie, ale nie niżej niż MIN_AUTO (cienie i drzewa zostają)', () => {
    const q = new AutoQuality(TOP_TIER);
    expect(run(q, 1000 / 20, 60000)).toEqual([3, 2]);
    expect(q.tier).toBe(MIN_AUTO);
  });

  it('30–45 FPS (laptop) to jeszcze nie powód, żeby psuć grafikę', () => {
    const q = new AutoQuality(TOP_TIER);
    expect(run(q, 1000 / 38, 60000)).toEqual([]);
  });

  it('zapisany dawny najniższy poziom podnosi do MIN_AUTO', () => {
    expect(new AutoQuality(0).tier).toBe(MIN_AUTO);
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
    expect(run(q, 1000 / 24, 12000)).toEqual([2]);
    expect(run(q, 1000 / 60, 60000)).toEqual([]);
    expect(q.tier).toBe(2);
  });
});

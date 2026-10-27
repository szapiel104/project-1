import { describe, expect, it } from 'vitest';
import { spatialMix } from '../src/audio/engine';
import { DEFS } from '../src/audio/bank';
import { BANK_0AD } from '../src/audio/bank.gen';

describe('dźwięk przestrzenny', () => {
  const hammer = DEFS.hammer;
  it('bliżej znaczy głośniej, za zasięgiem cisza', () => {
    const near = spatialMix(hammer, 2, 0, 0, 3, 1, 0).g;
    const mid = spatialMix(hammer, 20, 0, 0, 3, 1, 0).g;
    const far = spatialMix(hammer, hammer.max + 5, 0, 0, 3, 1, 0).g;
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    expect(far).toBe(0);
  });
  it('oddalenie kamery ścisza i stępia dźwięk, kroki milkną przy zwykłym widoku', () => {
    const close = spatialMix(hammer, 0, 0, 0, 2, 1, 0), wide = spatialMix(hammer, 0, 0, 0, 16, 1, 0);
    expect(wide.g).toBeLessThan(close.g);
    expect(wide.cut).toBeLessThan(close.cut);
    expect(spatialMix(DEFS.stepDirt, 0, 0, 0, 16, 1, 0).g).toBe(0);
  });
  it('panorama z boku ekranu, nigdy w jednym uchu', () => {
    const r = spatialMix(hammer, 10, 0, 0, 3, 1, 0).pan, l = spatialMix(hammer, -10, 0, 0, 3, 1, 0).pan;
    expect(r).toBeGreaterThan(0.3); expect(l).toBeLessThan(-0.3);
    expect(Math.abs(spatialMix(hammer, 1000, 0, 0, 3, 1, 0).pan)).toBeLessThanOrEqual(0.85);
  });
  it('każdy plik z banku istnieje', () => {
    const have = new Set(Object.keys(import.meta.glob('../public/sounds/**/*.ogg')).map((k) => k.replace('../public/sounds/', '').replace('.ogg', '')));
    for (const d of Object.values(DEFS)) for (const f of d.files) expect(have.has(f), f).toBe(true);
    for (const list of Object.values(BANK_0AD)) expect(list.length).toBeGreaterThan(0);
  });
});

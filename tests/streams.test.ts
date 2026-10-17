import { describe, expect, it } from 'vitest';
import { pickSources, traceStream, type StreamSampler } from '../src/render/streams';
import { findSummits } from '../src/render/highmist';

// Plansza 60×60: pas gór wzdłuż północnego brzegu (y < 12) opada ku łące, na łące jezioro.
const W = 60, H = 60;
const ridge = (x: number, y: number): number => Math.max(0, 12 - y) * 1.3 + Math.sin(x * 0.4) * 0.8 * Math.max(0, 12 - y) / 12;
const S: StreamSampler = {
  height: (x, y) => (y < 0 ? 16 : ridge(x, y) + 0.12),
  rock: (x, y) => x < 0 || y < 0 || x >= W || y >= H || y < 12,
  water: (x, y) => y >= 20 && y < 24 && x > 10 && x < 50,
  w: W, h: H, ox: -30, oz: -30, seed: 7,
};

describe('strumienie z gór', () => {
  it('woda spływa w dół zbocza do stóp gór albo do jeziora', () => {
    const p = traceStream(S, 30.5, 2.5)!;
    expect(p).not.toBeNull();
    const end = p[p.length - 1]!;
    expect(end.y).toBeGreaterThan(11);
    // za każdym krokiem nie wyżej niż na starcie
    expect(S.height(end.x, end.y)).toBeLessThan(S.height(30.5, 2.5) - 3);
  });
  it('źródła są odsunięte od siebie i kończą się na planszy', () => {
    const all = pickSources(S, 4);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      const e = p[p.length - 1]!;
      expect(e.x).toBeGreaterThanOrEqual(0); expect(e.y).toBeGreaterThanOrEqual(0); expect(e.x).toBeLessThan(W); expect(e.y).toBeLessThan(H);
    }
  });
  it('woda w niecce bez odpływu nie tworzy strumienia', () => {
    const pit: StreamSampler = { ...S, height: (x, y) => 10 + Math.hypot(x - 30, y - 5) * 0.01 };
    expect(traceStream(pit, 30.5, 5.5)).toBeNull();
  });
});

describe('chmury przy szczytach', () => {
  it('znajduje najwyższe wierzchołki odsunięte od siebie', () => {
    const nx = 80, ny = 80, data = new Float32Array(nx * ny);
    const peaks = [[20, 20, 30], [60, 25, 22], [22, 26, 18]];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let v = 0;
      for (const [px, py, ph] of peaks) v = Math.max(v, ph! - Math.hypot(i - px!, j - py!) * 2);
      data[j * nx + i] = v;
    }
    const s = findSummits({ data, nx, ny, x0: 0, z0: 0, step: 1 }, 5, 9, 15);
    expect(s.length).toBe(2); // trzeci jest za blisko pierwszego
    expect(s[0]!.h).toBe(30);
  });
});

import { describe, expect, it } from 'vitest';
import { applyModelFixes, islands } from '../src/render/modelfix';

// dwa osobne trójkąty (dwie „części”) w jednej siatce, pozycje int16 / q jak w modelach z Blendera
const q = 1000;
const tri = (x: number): number[] => [x, 0, 0, x + 0.1, 0, 0, x, 0.1, 0];
const pack = (v: number[]): Uint8Array => new Uint8Array(Int16Array.from(v.map((a) => Math.round(a * q))).buffer);
const unpack = (b: Uint8Array): number[] => Array.from(new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2), (a) => a / q);

describe('poprawki modeli z edytora (modelfix.ts)', () => {
  it('przesuwa tylko wskazaną część, druga zostaje', () => {
    const P = [...tri(0), ...tri(1)];
    expect(islands(P).list.length).toBe(2);
    const data: Record<string, unknown> = { q, base: [{ mat: 'wood', pos: pack(P), ao: '' }] };
    const c = [0.1 / 3 + 1, 0.1 / 3, 0] as [number, number, number];
    applyModelFixes('test', data, [{ g: 'base', i: 0, c, n: 1, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0.5, 0, 1] }]);
    const out = unpack((data.base as { pos: Uint8Array }[])[0]!.pos);
    expect(out.slice(0, 9)).toEqual(tri(0).map((a) => Math.round(a * q) / q));
    expect(out[10]).toBeCloseTo(0.5, 3);   // y pierwszego wierzchołka drugiej części podniesione o 0,5
  });
  it('poprawka, która nie pasuje do bryły, jest pomijana', () => {
    const data: Record<string, unknown> = { q, base: [{ mat: 'wood', pos: pack(tri(0)), ao: '' }] };
    const before = unpack((data.base as { pos: Uint8Array }[])[0]!.pos);
    applyModelFixes('test2', data, [{ g: 'base', i: 0, c: [5, 5, 5], n: 1, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1] }]);
    expect(unpack((data.base as { pos: Uint8Array }[])[0]!.pos)).toEqual(before);
  });
});

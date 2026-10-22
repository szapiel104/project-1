import { describe, expect, it } from 'vitest';
import { standardBearers } from '../src/render/standards';

describe('chorążowie', () => {
  const ranged = (k: number): boolean => k === 1, skip = (k: number): boolean => k === 2;
  it('jeden chorąży na oddział (próg z ustawień, domyślnie 10), piechur przed łucznikiem', () => {
    const s = [
      { id: 5, owner: 0, grp: 10, kind: 1 }, { id: 7, owner: 0, grp: 10, kind: 0 }, { id: 9, owner: 0, grp: 10, kind: 0 },
      { id: 3, owner: 0, grp: 11, kind: 0 }, { id: 4, owner: 0, grp: 11, kind: 0 },          // za mały oddział
      { id: 1, owner: 1, grp: 10, kind: 1 }, { id: 2, owner: 1, grp: 10, kind: 1 }, { id: 6, owner: 1, grp: 10, kind: 1 }, // sami łucznicy, inny gracz
      { id: 8, owner: 0, kind: 0 }, { id: 11, owner: 0, grp: 12, kind: 2 }, { id: 12, owner: 0, grp: 12, kind: 2 }, { id: 13, owner: 0, grp: 12, kind: 2 },
    ];
    expect([...standardBearers(s, ranged, skip, 3)].sort((a, b) => a - b)).toEqual([1, 7]);
    // domyślnie chorąży dopiero od dziesięciu w oddziale
    expect(standardBearers(s, ranged, skip).size).toBe(0);
    const big = Array.from({ length: 10 }, (_, k) => ({ id: 100 + k, owner: 0, grp: 50, kind: 0 }));
    expect([...standardBearers(big, ranged, skip)]).toEqual([100]);
    expect(standardBearers(big.slice(1), ranged, skip).size).toBe(0);
  });
});

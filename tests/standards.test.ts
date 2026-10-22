import { describe, expect, it } from 'vitest';
import { standardBearers } from '../src/render/standards';

describe('chorążowie', () => {
  const ranged = (k: number): boolean => k === 1, skip = (k: number): boolean => k === 2;
  it('jeden chorąży na oddział z co najmniej trzema żołnierzami, piechur przed łucznikiem', () => {
    const s = [
      { id: 5, owner: 0, grp: 10, kind: 1 }, { id: 7, owner: 0, grp: 10, kind: 0 }, { id: 9, owner: 0, grp: 10, kind: 0 },
      { id: 3, owner: 0, grp: 11, kind: 0 }, { id: 4, owner: 0, grp: 11, kind: 0 },          // za mały oddział
      { id: 1, owner: 1, grp: 10, kind: 1 }, { id: 2, owner: 1, grp: 10, kind: 1 }, { id: 6, owner: 1, grp: 10, kind: 1 }, // sami łucznicy, inny gracz
      { id: 8, owner: 0, kind: 0 }, { id: 11, owner: 0, grp: 12, kind: 2 }, { id: 12, owner: 0, grp: 12, kind: 2 }, { id: 13, owner: 0, grp: 12, kind: 2 },
    ];
    expect([...standardBearers(s, ranged, skip)].sort((a, b) => a - b)).toEqual([1, 7]);
  });
});

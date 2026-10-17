import { describe, expect, it } from 'vitest';
import { avatarSvg, CREST_BASE, CREST_CHARGES, decodeCrest, DIVISIONS, encodeCrest, TINCTURES, CHARGE_NAMES } from '../src/ui/avatars';
import { levelOf, TITLES, titleRank } from '../src/data/progress';

describe('herb składany i tytuły', () => {
  it('herb z elementów zapisuje się w jednym numerze i odczytuje bez zmian', () => {
    for (let f = 0; f < TINCTURES.length; f++)
      for (let d = 0; d < DIVISIONS.length; d++)
        for (const c of [0, 5, CREST_CHARGES - 1]) {
          const crest = { field: f, field2: (f + 3) % TINCTURES.length, division: d, charge: c, tincture: (f + 7) % TINCTURES.length };
          const n = encodeCrest(crest);
          expect(n).toBeGreaterThanOrEqual(CREST_BASE);
          expect(Number.isSafeInteger(n)).toBe(true);
          expect(decodeCrest(n)).toEqual(crest);
        }
    expect(CHARGE_NAMES.length).toBe(CREST_CHARGES);
  });
  it('dawne gotowe herby (0–63) dalej się rysują, a kreator startuje od podobnych barw i tego samego godła', () => {
    expect(avatarSvg(5)).toContain('<svg');
    const c = decodeCrest(9); // pole 1 (błękit), godło 1 (krzyż)
    expect(TINCTURES[c.field]![0]).toBe('#1f3d6e');
    expect(c.charge).toBe(1);
    expect(avatarSvg(encodeCrest(c))).toContain('clip-path');
  });
  it('drabina tytułów idzie z poziomem', () => {
    expect(titleRank(1)).toBe(0);
    expect(titleRank(6)).toBe(1);
    expect(titleRank(39)).toBe(4);
    expect(titleRank(120)).toBe(TITLES.length - 1);
    expect(levelOf(0).level).toBe(1);
  });
});

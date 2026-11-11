import { describe, expect, it } from 'vitest';
import { formatMat, needsVariant, parseMat } from '../src/render/matSpec';

describe('nazwy materiałów z ustawieniami edytora (matSpec.ts)', () => {
  it('czyta stary zapis i składa nowy', () => {
    const a = parseMat('woodDark@2^1.2~0.5');
    expect([a.base, a.scale, a.bright, a.depth]).toEqual(['woodDark', 2, 1.2, 0.5]);
    expect(formatMat(a)).toBe('woodDark|s=2|b=1.2|d=0.5');
  });
  it('barwa, zagłębienia, połysk, metal, świecenie', () => {
    const s = parseMat('castle|t=C8A070|ao=1.5|r=0.3|m=0.6|e=0.2');
    expect(s).toMatchObject({ base: 'castle', tint: 'c8a070', ao: 1.5, rough: 0.3, metal: 0.6, glow: 0.2 });
    expect(needsVariant(s)).toBe(true);
    expect(needsVariant(parseMat('castle|s=2|b=1.1|t=ffeedd|ao=2'))).toBe(false);
    expect(formatMat(parseMat('castle'))).toBe('castle');
  });
});

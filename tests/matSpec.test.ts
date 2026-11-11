import { describe, expect, it } from 'vitest';
import { formatMat, parseMat } from '../src/render/matSpec';

describe('nazwy materiałów z ustawieniami edytora (matSpec.ts)', () => {
  it('czyta i składa skalę, jasność i głębię', () => {
    expect(parseMat('woodDark')).toEqual({ base: 'woodDark', scale: 1, bright: 1, depth: 1 });
    expect(parseMat('woodDark@2^1.2~0.5')).toEqual({ base: 'woodDark', scale: 2, bright: 1.2, depth: 0.5 });
    expect(formatMat({ base: 'ph_wood_planks', scale: 0.5, bright: 1, depth: 1.5 })).toBe('ph_wood_planks@0.5~1.5');
    expect(formatMat(parseMat('castle^0.8'))).toBe('castle^0.8');
  });
});

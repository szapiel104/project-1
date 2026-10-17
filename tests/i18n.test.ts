import { describe, expect, it } from 'vitest';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { BUILDINGS } from '../src/data/buildings';

describe('języki', () => {
  it('angielski ma dokładnie te same klucze co polski i żaden tekst nie jest pusty', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    for (const [k, v] of Object.entries(en)) expect(v.trim(), k).not.toBe('');
  });
  it('każdy budynek ma nazwę po polsku i po angielsku', () => {
    for (const b of BUILDINGS) {
      expect((pl as Record<string, string>)[b.name], b.id).toBeTruthy();
      expect((en as Record<string, string>)[b.name], b.id).toBeTruthy();
    }
  });
});

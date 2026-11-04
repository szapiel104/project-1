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
  it('każde zajęcie chłopa (Phase 0–33 w state.ts) ma opis w obu językach', () => {
    // przegląd 4.11.2026: brakowało phase.32 i phase.33 — karta chłopa pokazywała „Robi: phase.32”
    for (let i = 0; i <= 33; i++) {
      expect((pl as Record<string, string>)[`phase.${i}`], `phase.${i}`).toBeTruthy();
      expect((en as Record<string, string>)[`phase.${i}`], `phase.${i}`).toBeTruthy();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { BADGES, levelOf, xpAtLevel } from '../src/data/progress';

describe('poziom z panelu administratora i odznaki', () => {
  it('xpAtLevel daje dokładnie początek poziomu', () => {
    for (const l of [1, 2, 6, 12, 20, 40, 100]) {
      expect(levelOf(xpAtLevel(l)).level).toBe(l);
      expect(levelOf(xpAtLevel(l)).into).toBe(0);
      if (l > 1) expect(levelOf(xpAtLevel(l) - 1).level).toBe(l - 1);
    }
  });
  it('odznaki mają unikalne id, oba języki i działają bez nowych liczników (przed migracją)', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.length).toBeGreaterThanOrEqual(25);
    for (const b of BADGES) {
      expect(b.pl[0] && b.pl[1] && b.en[0] && b.en[1]).toBeTruthy();
      expect(b.of({ matches: 0, wins: 0, kills: 0, level: 1 })).toBeLessThan(b.goal);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { BADGES, levelOf, nextTitle, xpToNext, xpUntil } from '../src/data/progress';

describe('Mój ród: cele i odznaki', () => {
  it('PD do poziomu liczone od bieżącego postępu', () => {
    expect(xpUntil(0, 2)).toBe(xpToNext(1));
    expect(xpUntil(40, 2)).toBe(xpToNext(1) - 40);
    expect(xpUntil(0, 3)).toBe(xpToNext(1) + xpToNext(2));
    const xp = 5000; expect(xpUntil(xp, levelOf(xp).level)).toBe(0);
  });
  it('następny tytuł', () => {
    expect(nextTitle(1)?.from).toBe(6);
    expect(nextTitle(6)?.from).toBe(12);
    expect(nextTitle(45)).toBeNull();
  });
  it('odznaki mają unikalne id i cele', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    const p = { matches: 10, wins: 1, kills: 0, level: 1 };
    expect(BADGES.filter((b) => b.of(p) >= b.goal).map((b) => b.id)).toEqual(['first', 'win1', 'vet']);
  });
});

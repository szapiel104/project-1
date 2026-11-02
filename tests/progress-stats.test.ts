import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { levelOf, matchXp, xpToNext } from '../src/data/progress';

describe('poziomy: statystyki meczu i wzory zgodne z bazą', () => {
  it('nowa gra zaczyna statystyki od zera (także miasto trybu deweloperskiego nie liczy się do „postawionych”)', () => {
    for (const dev of [false, true]) {
      const g = createGame(11, '1v1', 2, dev);
      for (const p of g.players) expect(p.stats).toEqual({ gathered: 0, trained: 0, kills: 0, lost: 0, built: 0, razed: 0 });
    }
  });
  it('PD na poziom i poziom z PD jak w SQL (round(100 * l^1.5))', () => {
    expect([1, 2, 3, 10, 40].map(xpToNext)).toEqual([100, 283, 520, 3162, 25298]);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100).level).toBe(2);
    expect(levelOf(383).level).toBe(3);
  });
  it('podgląd PD jak w award_match: limit 600, mnożnik trybu, krótki mecz bez PD', () => {
    expect(matchXp({ won: true, minutes: 2, kills: 50, razed: 5, built: 10 }, 'online')).toBe(0);
    expect(matchXp({ won: true, minutes: 30, kills: 10, razed: 2, built: 20 }, 'online')).toBe(60 + 100 + 20 + 10 + 20);
    expect(matchXp({ won: true, minutes: 180, kills: 300, razed: 60, built: 100 }, 'online')).toBe(600);
    expect(matchXp({ won: false, minutes: 30, kills: 0, razed: 0, built: 0 }, 'bots0')).toBe(Math.round(90 * 0.2));
  });
});

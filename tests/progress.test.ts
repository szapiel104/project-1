import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { levelOf, matchXp, MAX_MATCH_XP, MODE_MULT, titleOf, xpToNext } from '../src/data/progress';

describe('poziomy i doświadczenie za mecz', () => {
  it('więcej zabitych i dłuższy mecz = więcej PD; przegrana też daje; limit na mecz', () => {
    const base = { won: false, minutes: 20, kills: 10, razed: 0, built: 10 };
    const lose = matchXp(base, 'online');
    const win = matchXp({ ...base, won: true }, 'online');
    expect(lose).toBeGreaterThan(0);
    expect(win).toBeGreaterThan(lose);
    expect(matchXp({ ...base, kills: 60 }, 'online')).toBeGreaterThan(lose);
    expect(matchXp({ ...base, minutes: 40 }, 'online')).toBeGreaterThan(lose);
    expect(matchXp({ won: true, minutes: 999, kills: 99999, razed: 9999, built: 9999 }, 'online')).toBe(MAX_MATCH_XP);
    expect(matchXp({ ...base, minutes: 2 }, 'online')).toBe(0); // poddanie od razu
    expect(matchXp(base, 'bots1')).toBeLessThan(lose); // z łatwym botem mniej
  });
  it('poziomy: pierwsze szybko, potem coraz dłużej; tytuły', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelOf(100).level).toBe(2);
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(2) * 5);
    expect(titleOf(1)).toBe('Giermek');
    expect(titleOf(40)).toBe('Król');
  });
  it('wzór w bazie (award_match) zgadza się z grą', () => {
    const sql = readFileSync('supabase/migrations/20261016_progress.sql', 'utf8');
    for (const [mode, mult] of Object.entries(MODE_MULT)) expect(sql).toContain(`when '${mode}' then ${mult}`);
    expect(sql).toContain(`least(${MAX_MATCH_XP},`);
    expect(sql).toContain('round(100 * power(l, 1.5))');
    expect(sql).toContain('least(m, 60) * 2 + case when p_won then 100 else 30 end + k * 2 + r * 5 + b');
  });
});

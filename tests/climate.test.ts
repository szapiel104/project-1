import { describe, expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { seasonAt, temperatureAt, YEAR_DAYS } from '../src/sim/weather';

// Klimat krain (Michał 7.11.2026): Północ — zima cały rok, Step i Pustynia — nigdy zimy, reszta — cztery pory
const ticks = Array.from({ length: 48 }, (_, i) => Math.round((i / 48) * YEAR_DAYS * RULES.dayTicks));
describe('klimat krainy', () => {
  it('Północ ma zimę i mróz przez cały rok', () => {
    for (const t of ticks) { expect(seasonAt(t, 0, 'north')).toBe('winter'); expect(temperatureAt(t, 7, 0, 0, 'north')).toBeLessThan(0.5); }
  });
  it('Step i Pustynia nie mają zimy ani mrozu', () => {
    for (const b of ['steppe', 'desert'] as const) for (const t of ticks) { expect(seasonAt(t, 0, b)).not.toBe('winter'); expect(temperatureAt(t, 7, 0, 0, b)).toBeGreaterThan(0.5); }
  });
  it('Łęgi mają wszystkie cztery pory', () => {
    expect(new Set(ticks.map((t) => seasonAt(t, 0, 'meadow'))).size).toBe(4);
  });
});

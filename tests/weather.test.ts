import { expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { COLD, SEASON_DAYS, seasonAt, temperatureAt, YEAR_DAYS } from '../src/sim/weather';

it('pory roku po kolei, lato ciepłe, zima mroźna, start w połowie wiosny', () => {
  const D = RULES.dayTicks;
  expect(seasonAt(0)).toBe('spring');
  const at = (day: number, hour = 0.5): number => Math.round((day + hour) * D);
  expect(seasonAt(at(SEASON_DAYS))).toBe('summer');
  expect(seasonAt(at(SEASON_DAYS * 2))).toBe('autumn');
  expect(seasonAt(at(SEASON_DAYS * 3))).toBe('winter');
  expect(seasonAt(at(YEAR_DAYS))).toBe('spring');
  // średnia z doby: latem ciepło, zimą poniżej progu palenia w piecach
  const mean = (day: number): number => { let s = 0; for (let k = 0; k < 24; k++) s += temperatureAt(Math.round((day + k / 24) * D), 7); return s / 24; };
  expect(mean(SEASON_DAYS * 1.5 - 0.5)).toBeGreaterThan(17);
  expect(mean(SEASON_DAYS * 3.5 - 0.5)).toBeLessThan(COLD - 4);
  // ta sama mapa i chwila = ta sama temperatura (gra przez sieć)
  expect(temperatureAt(12345, 3)).toBe(temperatureAt(12345, 3));
});

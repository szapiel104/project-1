import { describe, expect, it } from 'vitest';
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

it('zima: chaty palą drewno (po trochu), zimno psuje nastroje, a bez drewna ludzie marzną', async () => {
  const { createGame } = await import('../src/sim/state');
  const { step } = await import('../src/sim/step');
  const { resIndex } = await import('../src/data/resources');
  const { monthlyForecast } = await import('../src/sim/systems/economy');
  const { shiftToSeason } = await import('../src/sim/weather');
  const g = createGame(4, '1v1', 2, false);
  for (const p of g.players) p.bot = false;
  const p = g.players[0]!, W = resIndex('wood');
  // lato: drewno nie znika na opał
  g.seasonShift = shiftToSeason(g.tick, 'summer');
  p.res[W] = 500;
  const before = p.res[W]!;
  for (let i = 0; i < RULES.dayTicks / 3; i++) step(g, []); // ok. 8 godzin gry, także chłodny wieczór
  const summerUse = before - p.res[W]!;
  // zima: znika po trochu
  g.seasonShift = shiftToSeason(g.tick, 'winter');
  p.res[W] = 500;
  for (let i = 0; i < RULES.dayTicks / 3; i++) step(g, []); // ok. 8 godzin gry, także chłodny wieczór
  const winterUse = 500 - p.res[W]!;
  expect(winterUse).toBeGreaterThan(summerUse);
  expect(winterUse).toBeLessThan(60); // „bardzo malutko”
  expect(monthlyForecast(g, p).parts.find((x) => x.key === 'winter')!.value).toBeLessThan(0);
  // bez drewna: marzną
  for (let i = 0; i < 4000 && !p.freezing; i++) { p.res[W] = 0; step(g, []); }
  expect(p.freezing).toBe(true);
  expect(monthlyForecast(g, p).parts.find((x) => x.key === 'freezing')!.value).toBe(-3);
});

describe('gotowość na zimę (skryba jesienią)', () => {
  it('liczy dni do zimy, opał na całą zimę i dni jedzenia', async () => {
    const { createGame } = await import('../src/sim/state');
    const { winterReadiness } = await import('../src/sim/systems/economy');
    const { shiftToSeason } = await import('../src/sim/weather');
    const g = createGame(5);
    g.seasonShift = shiftToSeason(g.tick, 'autumn'); // środek jesieni
    const p = g.players[0]!;
    const w = winterReadiness(g, p);
    expect(w.days).toBeGreaterThan(SEASON_DAYS * 0.3); // środek jesieni: do zimy pół pory roku
    expect(w.days).toBeLessThan(SEASON_DAYS * 0.7);
    expect(w.fuel).toBeGreaterThan(0); // zamek liczy się za dwie chaty, a zimą jest zimno
    expect(w.foodDays).toBeGreaterThan(0);
    g.seasonShift = shiftToSeason(g.tick, 'winter');
    expect(winterReadiness(g, p).days).toBe(0);
  });
});

import { RULES } from '../data/rules';
import { tx } from '../i18n';
import { clockAt, dayFraction } from './clock';

/**
 * Pory roku i temperatura. Liczone wprost z numeru ticka i ziarna mapy, więc u każdego gracza są takie same
 * (gra przez sieć) i nic nie trzeba zapisywać.
 *
 * Rok ma 4 pory po SEASON_DAYS dni gry. Gra zaczyna się w środku wiosny. Temperatura to krzywa roczna
 * (najcieplej w połowie lata, najzimniej w połowie zimy), dobowa (najzimniej przed świtem, najcieplej po południu)
 * i losowe odchylenie każdego dnia (cieplejsze i chłodniejsze dni przechodzą jedne w drugie płynnie); deszcz chłodzi.
 */
/** Dni gry na jedną porę roku: cały rok to ok. 2 godziny gry (20 dni po ok. 6 minut), jak w grach z porami roku na jedną dłuższą rozgrywkę */
export const SEASON_DAYS = 5;
export const YEAR_DAYS = SEASON_DAYS * 4;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAME: Record<Season, string> = { spring: tx('Wiosna', 'Spring'), summer: tx('Lato', 'Summer'), autumn: tx('Jesień', 'Autumn'), winter: tx('Zima', 'Winter') };
/** Poniżej tej temperatury ludzie palą w piecach (dym z kominów chat i warsztatów) */
export const COLD = 8;

/** Dzień gry z ułamkiem od początku gry (0 = start); shift = przesunięcie pory roku w dniach (menu dewelopera) */
function gameDays(tick: number, shift = 0): number {
  return tick / RULES.dayTicks + dayFraction(RULES.startHour) + shift;
}
/** Położenie w roku 0..1 (0 = początek wiosny); start gry w połowie wiosny */
export function yearPos(tick: number, shift = 0): number {
  return (((gameDays(tick, shift) + SEASON_DAYS / 2) / YEAR_DAYS) % 1 + 1) % 1;
}
export function seasonAt(tick: number, shift = 0): Season {
  return SEASONS[Math.min(3, Math.floor(yearPos(tick, shift) * 4))]!;
}
/** Przesunięcie (w dniach), po którym w chwili `tick` jest środek danej pory roku */
export function shiftToSeason(tick: number, season: Season): number {
  const want = (SEASONS.indexOf(season) + 0.5) / 4;
  let d = (want - yearPos(tick, 0)) * YEAR_DAYS;
  d = ((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  return d;
}

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Temperatura w °C (z jedną cyfrą po przecinku). rain = 0..1 (deszcz chłodzi) */
export function temperatureAt(tick: number, seed: number, rain = 0, shift = 0): number {
  const pos = yearPos(tick, shift);
  // rok: +24° w połowie lata (0.375), −6° w połowie zimy (0.875)
  const year = 9 + 15 * Math.cos(2 * Math.PI * (pos - 0.375));
  // doba: najcieplej ok. 15:00, najzimniej ok. 3:00 (±4°)
  const days = gameDays(tick, shift);
  const hour = clockAt(tick).hour;
  const daily = 4 * Math.cos((2 * Math.PI * (hour - 15)) / 24);
  // pogoda dnia: losowe odchylenie ±3,5°, płynnie z dnia na dzień
  const d0 = Math.floor(days), f = days - d0, s = f * f * (3 - 2 * f);
  const noise = ((hash(seed, d0) * (1 - s) + hash(seed, d0 + 1) * s) - 0.5) * 7;
  return Math.round((year + daily + noise - rain * 3) * 10) / 10;
}

/** Pogoda w grze: pora roku, temperatura (z deszczem) i jak bardzo zimno (0 = ciepło, 1 = ok. 0°C, 1.75 = −6°C) */
export function weatherOf(g: { tick: number; map: { seed: number }; seasonShift?: number }, rain = 0): { season: Season; temp: number; chill: number } {
  const temp = temperatureAt(g.tick, g.map.seed, rain, g.seasonShift ?? 0);
  return { season: seasonAt(g.tick, g.seasonShift ?? 0), temp, chill: Math.max(0, Math.min(2, (COLD - temp) / COLD)) };
}

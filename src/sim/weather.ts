import { RULES } from '../data/rules';
import { clockAt, dayFraction } from './clock';

/**
 * Pory roku i temperatura. Liczone wprost z numeru ticka i ziarna mapy, więc u każdego gracza są takie same
 * (gra przez sieć) i nic nie trzeba zapisywać.
 *
 * Rok ma 4 pory po SEASON_DAYS dni gry. Gra zaczyna się w środku wiosny. Temperatura to krzywa roczna
 * (najcieplej w połowie lata, najzimniej w połowie zimy), dobowa (najzimniej przed świtem, najcieplej po południu)
 * i losowe odchylenie każdego dnia (cieplejsze i chłodniejsze dni przechodzą jedne w drugie płynnie); deszcz chłodzi.
 */
export const SEASON_DAYS = 3;
export const YEAR_DAYS = SEASON_DAYS * 4;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAME: Record<Season, string> = { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' };
/** Poniżej tej temperatury ludzie palą w piecach (dym z kominów chat i warsztatów) */
export const COLD = 8;

/** Dzień gry z ułamkiem od początku gry (0 = start) */
function gameDays(tick: number): number {
  return tick / RULES.dayTicks + dayFraction(RULES.startHour);
}
/** Położenie w roku 0..1 (0 = początek wiosny); start gry w połowie wiosny */
export function yearPos(tick: number): number {
  return (((gameDays(tick) + SEASON_DAYS / 2) / YEAR_DAYS) % 1 + 1) % 1;
}
export function seasonAt(tick: number): Season {
  return SEASONS[Math.min(3, Math.floor(yearPos(tick) * 4))]!;
}

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Temperatura w °C (z jedną cyfrą po przecinku). rain = 0..1 (deszcz chłodzi) */
export function temperatureAt(tick: number, seed: number, rain = 0): number {
  const pos = yearPos(tick);
  // rok: +24° w połowie lata (0.375), −6° w połowie zimy (0.875)
  const year = 9 + 15 * Math.cos(2 * Math.PI * (pos - 0.375));
  // doba: najcieplej ok. 15:00, najzimniej ok. 3:00 (±4°)
  const days = gameDays(tick);
  const hour = clockAt(tick).hour;
  const daily = 4 * Math.cos((2 * Math.PI * (hour - 15)) / 24);
  // pogoda dnia: losowe odchylenie ±3,5°, płynnie z dnia na dzień
  const d0 = Math.floor(days), f = days - d0, s = f * f * (3 - 2 * f);
  const noise = ((hash(seed, d0) * (1 - s) + hash(seed, d0 + 1) * s) - 0.5) * 7;
  return Math.round((year + daily + noise - rain * 3) * 10) / 10;
}

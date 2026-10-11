import { RULES } from '../data/rules';

export interface GameClock {
  /** Numer dnia, od 1 */
  day: number;
  /** Godzina z ułamkiem, 0..24 */
  hour: number;
  night: boolean;
}

/** Czas gry wynika wprost z numeru ticka, więc u każdego gracza jest ta sama pora dnia. */
export function clockAt(tick: number): GameClock {
  const t = tick + (RULES.startHour * RULES.dayTicks) / 24;
  const hour = ((t % RULES.dayTicks) / RULES.dayTicks) * 24;
  return { day: Math.floor(t / RULES.dayTicks) + 1, hour, night: hour < 5.5 || hour >= 20.5 };
}

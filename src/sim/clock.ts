import { RULES } from '../data/rules';

export interface GameClock {
  /** Numer dnia, od 1 */
  day: number;
  /** Godzina z ułamkiem, 0..24 */
  hour: number;
  night: boolean;
}

/**
 * Doba nie płynie równo: ludzie śpią w nocy, więc noc mija szybko, a dzień pracy trwa dłużej.
 * Każdy odcinek to [godzina końca, ile części doby w tickach zajmuje]. Razem = 1.
 * Noc 22:00–5:30 (7,5 h) to ok. 11% doby, wieczór 19:30–22:00 ok. 8%, a dzień pracy 5:30–19:30 ok. 81%.
 */
const SEGMENTS: [number, number][] = [
  [5.5, 0.08],
  [19.5, 0.81],
  [22, 0.08],
  [24, 0.03],
];

/** Godzina (0..24) dla ułamka doby w tickach (0..1) */
function hourAt(f: number): number {
  let h0 = 0, f0 = 0;
  for (const [h1, part] of SEGMENTS) {
    if (f < f0 + part) return h0 + ((f - f0) / part) * (h1 - h0);
    h0 = h1; f0 += part;
  }
  return 24 * (f % 1);
}
/** Ułamek doby w tickach dla godziny (odwrotność hourAt) */
export function dayFraction(hour: number): number {
  let h0 = 0, f0 = 0;
  for (const [h1, part] of SEGMENTS) {
    if (hour < h1) return f0 + ((hour - h0) / (h1 - h0)) * part;
    h0 = h1; f0 += part;
  }
  return 1;
}

/** Czas gry wynika wprost z numeru ticka, więc u każdego gracza jest ta sama pora dnia. */
export function clockAt(tick: number): GameClock {
  const t = tick + Math.round(dayFraction(RULES.startHour) * RULES.dayTicks);
  const hour = hourAt((t % RULES.dayTicks) / RULES.dayTicks);
  return { day: Math.floor(t / RULES.dayTicks) + 1, hour, night: hour < 5.5 || hour >= 20.5 };
}

/** Czy w tym ticku zegar właśnie przeszedł przez daną godzinę */
export function hourStarts(tick: number, hour: number): boolean {
  const a = clockAt(tick - 1).hour, b = clockAt(tick).hour;
  return a < b ? a < hour && b >= hour : hour <= b || hour > a;
}

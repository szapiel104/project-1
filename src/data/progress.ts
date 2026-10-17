/**
 * Poziomy gracza i doświadczenie (PD) za mecze. Ten sam wzór liczy funkcja w bazie (supabase/migrations/…_progress.sql,
 * award_match) — tam jest rozstrzygający; gra używa go tylko do podglądu („za ten mecz ok. +X PD”) i do paska poziomu.
 * Zmieniasz liczby tutaj — zmień je też w SQL (test pilnuje, że tabela poziomów się zgadza).
 */
import { tx } from '../i18n';

/** Rodzaj meczu: przez sieć z ludźmi, z ludźmi przeciw botom, sam z botami (poziom trudności 0–3) */
export type MatchMode = 'online' | 'coop' | 'bots0' | 'bots1' | 'bots2' | 'bots3';

/** Mnożnik PD: z ludźmi najwięcej, z botami mniej (łatwy bot mało), pokojowy prawie nic */
export const MODE_MULT: Record<MatchMode, number> = { online: 1, coop: 0.7, bots0: 0.2, bots1: 0.4, bots2: 0.6, bots3: 0.8 };

/** Najwięcej PD za jeden mecz (zabezpieczenie przed podrobionym wynikiem) */
export const MAX_MATCH_XP = 600;

export interface MatchStats { won: boolean; minutes: number; kills: number; razed: number; built: number }

/** Składniki PD za mecz (przed mnożnikiem i limitem) — do rozpiski na ekranie końca meczu */
export function xpParts(s: MatchStats): { key: string; label: string; xp: number }[] {
  const minutes = Math.max(0, Math.min(60, Math.floor(s.minutes)));
  const kills = Math.max(0, Math.min(300, Math.floor(s.kills)));
  const razed = Math.max(0, Math.min(60, Math.floor(s.razed)));
  const built = Math.max(0, Math.min(100, Math.floor(s.built)));
  return [
    { key: 'time', label: tx(`czas meczu (${minutes} min)`, `match time (${minutes} min)`), xp: minutes * 2 },
    { key: 'result', label: s.won ? tx('wygrana', 'victory') : tx('przegrana (też uczy)', 'defeat (still a lesson)'), xp: s.won ? 100 : 30 },
    { key: 'kills', label: tx(`pokonani wrogowie (${kills})`, `enemies slain (${kills})`), xp: kills * 2 },
    { key: 'razed', label: tx(`zburzone budynki wroga (${razed})`, `enemy buildings razed (${razed})`), xp: razed * 5 },
    { key: 'built', label: tx(`postawione budynki (${built})`, `buildings raised (${built})`), xp: built },
  ];
}

/** PD za mecz po mnożniku rodzaju meczu i z limitem */
export function matchXp(s: MatchStats, mode: MatchMode): number {
  // mecz krótszy niż 3 minuty (poddanie od razu) nic nie daje
  if (s.minutes < 3) return 0;
  const sum = xpParts(s).reduce((a, p) => a + p.xp, 0);
  return Math.min(MAX_MATCH_XP, Math.round(sum * MODE_MULT[mode]));
}

/** Ile PD trzeba z poziomu `level` na następny: pierwsze idą szybko, wysokie wymagają wielu meczów */
export const xpToNext = (level: number): number => Math.round(100 * level ** 1.5);

/** Poziom i postęp z łącznej liczby PD */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1, left = Math.max(0, Math.floor(xp));
  while (left >= xpToNext(level) && level < 200) { left -= xpToNext(level); level++; }
  return { level, into: left, need: xpToNext(level) };
}

/** Tytuł pana na zamku według poziomu */
export function titleOf(level: number): string {
  return level >= 40 ? tx('Król', 'King') : level >= 30 ? tx('Książę', 'Duke') : level >= 20 ? tx('Wojewoda', 'Voivode') : level >= 12 ? tx('Kasztelan', 'Castellan') : level >= 6 ? tx('Rycerz', 'Knight') : tx('Giermek', 'Squire');
}

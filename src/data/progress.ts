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

/** Drabina tytułów: od którego poziomu, nazwa PL i EN */
export const TITLES: { from: number; pl: string; en: string }[] = [
  { from: 1, pl: 'Giermek', en: 'Squire' }, { from: 6, pl: 'Rycerz', en: 'Knight' }, { from: 12, pl: 'Kasztelan', en: 'Castellan' },
  { from: 20, pl: 'Wojewoda', en: 'Voivode' }, { from: 30, pl: 'Książę', en: 'Duke' }, { from: 40, pl: 'Król', en: 'King' },
];
/** Który stopień drabiny tytułów odpowiada poziomowi */
export const titleRank = (level: number): number => { let r = 0; TITLES.forEach((t, i) => { if (level >= t.from) r = i; }); return r; };
/** Tytuł pana na zamku według poziomu */
export function titleOf(level: number): string {
  const t = TITLES[titleRank(level)]!;
  return tx(t.pl, t.en);
}

/** Ile PD brakuje do osiągnięcia poziomu `target` (0, gdy już osiągnięty) */
export function xpUntil(xp: number, target: number): number {
  const lv = levelOf(xp);
  if (lv.level >= target) return 0;
  let sum = lv.need - lv.into;
  for (let l = lv.level + 1; l < target; l++) sum += xpToNext(l);
  return sum;
}

/** Następny tytuł na drabinie (null: gracz jest już królem) */
export function nextTitle(level: number): { from: number; pl: string; en: string } | null {
  return TITLES[titleRank(level) + 1] ?? null;
}

/** Odznaki liczone z liczników postępu (mecze, wygrane, pokonani, poziom) — kamienie milowe w „Moim rodzie” */
export interface BadgeDef { id: string; icon: 'sword' | 'swords' | 'banner' | 'tower' | 'skull' | 'crown'; pl: [string, string]; en: [string, string]; of: (p: { matches: number; wins: number; kills: number; level: number }) => number; goal: number }
export const BADGES: BadgeDef[] = [
  { id: 'first', icon: 'sword', pl: ['Pierwsza bitwa', 'Rozegraj pierwszy mecz'], en: ['First battle', 'Play your first match'], of: (p) => p.matches, goal: 1 },
  { id: 'win1', icon: 'banner', pl: ['Pierwsze zwycięstwo', 'Wygraj mecz'], en: ['First victory', 'Win a match'], of: (p) => p.wins, goal: 1 },
  { id: 'vet', icon: 'tower', pl: ['Weteran', 'Rozegraj 10 meczów'], en: ['Veteran', 'Play 10 matches'], of: (p) => p.matches, goal: 10 },
  { id: 'win10', icon: 'swords', pl: ['Zdobywca', 'Wygraj 10 meczów'], en: ['Conqueror', 'Win 10 matches'], of: (p) => p.wins, goal: 10 },
  { id: 'kill100', icon: 'skull', pl: ['Pogromca', 'Pokonaj 100 wrogów'], en: ['Slayer', 'Slay 100 foes'], of: (p) => p.kills, goal: 100 },
  { id: 'kill1000', icon: 'skull', pl: ['Postrach ziem', 'Pokonaj 1000 wrogów'], en: ['Terror of the realm', 'Slay 1000 foes'], of: (p) => p.kills, goal: 1000 },
  { id: 'knight', icon: 'sword', pl: ['Pasowany', 'Zdobądź tytuł rycerza (poziom 6)'], en: ['Dubbed', 'Earn the rank of knight (level 6)'], of: (p) => p.level, goal: 6 },
  { id: 'castellan', icon: 'crown', pl: ['Pan na zamku', 'Zostań kasztelanem (poziom 12)'], en: ['Lord of the keep', 'Become a castellan (level 12)'], of: (p) => p.level, goal: 12 },
];

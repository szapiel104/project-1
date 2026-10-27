/**
 * Bank dźwięków świata (27.10.2026): które nagrania gra każdy rodzaj i jak brzmi w miksie.
 *
 * - `vol` — głośność rodzaju po wyrównaniu nagrań (wszystkie pliki mają ten sam poziom, tu ustalamy hierarchię:
 *   śmierć, szczęk mieczy i zawalenie najgłośniej, kroki i gadanie ciszej, świst strzały tylko z bliska);
 * - `ref` / `max` / `roll` — krzywa odległości w polach mapy: do `ref` pełna głośność, dalej spada jak w powietrzu
 *   (szybciej przy większym `roll`), od 65% `max` miękko gaśnie do zera; słuchacz stoi w punkcie, na który patrzy kamera,
 *   a oddalenie kamery dokłada „wysokość ucha” (engine.ts), więc przy zwykłym widoku kroki i gadanie milkną same;
 * - `pitch` — rozrzut wysokości (każde odtworzenie trochę inne), `voices` — najwięcej naraz,
 *   `gap` — ten sam rodzaj w tym samym miejscu nie częściej niż co tyle sekund, `prio` — kto ustępuje w tłoku,
 * - `wet` — ile pogłosu (z daleka więcej), `dull` — najniższe odcięcie wysokich tonów z daleka,
 * - `duck` — ile ten dźwięk ścisza muzykę i tło (walka i krzyki przebijają się przez muzykę, kroki nie).
 *
 * Nagrania: public/sounds/0ad/ — gra 0 A.D. (Wildfire Games, CC BY-SA 3.0), obrobione tools/audio/import_0ad.py;
 * public/sounds/*.ogg — Kenney, OpenGameArt, Freesound (CC0), szczegóły w docs/zasoby.md.
 */
import { BANK_0AD, type Group0ad } from './bank.gen';

export interface Def {
  files: readonly string[];
  vol: number; ref: number; max: number; roll: number;
  pitch: [number, number]; voices: number; gap?: number; prio?: number;
  wet?: number; dull?: number; duck?: number; bus?: 'world' | 'amb'; preload?: boolean;
}

const oad = (g: Group0ad): string[] => BANK_0AD[g].map((n) => `0ad/${n}`);
const D = (files: readonly string[], o: Partial<Def> & { vol: number }): Def => ({ files, ref: 8, max: 46, roll: 1.2, pitch: [0.94, 1.06], voices: 4, ...o });

export const DEFS = {
  // praca
  chop: D(oad('axe'), { vol: 0.75, ref: 7, max: 44, voices: 4, preload: true }),
  treefall: D(oad('treefall'), { vol: 0.85, ref: 10, max: 60, voices: 2, pitch: [0.95, 1.03], wet: 0.4 }),
  mine: D(oad('pick'), { vol: 0.62, ref: 7, max: 40, voices: 4, preload: true }),
  smith: D(oad('metal'), { vol: 0.6, ref: 7, max: 40, voices: 3, pitch: [0.97, 1.08], preload: true }),
  hammer: D(oad('hammer'), { vol: 0.7, ref: 7, max: 44, voices: 6, gap: 0.06, preload: true }),
  saw: D(oad('saw'), { vol: 0.42, ref: 6, max: 32, voices: 2 }),
  chisel: D(oad('chisel'), { vol: 0.55, ref: 6, max: 36, voices: 3 }),
  plank: D(['plank-0', 'plank-1', 'plank-2'], { vol: 0.85, ref: 8, max: 48, voices: 3, pitch: [0.85, 1] }),
  creak: D(['creak-1', 'creak-2', 'creak-3'], { vol: 0.55, ref: 6, max: 30, voices: 2 }),
  coins: D(['coins'], { vol: 0.5, ref: 6, max: 26, voices: 2 }),
  // walka
  bow: D(oad('bow'), { vol: 0.55, ref: 8, max: 46, voices: 6, gap: 0.04, pitch: [0.95, 1.06], duck: 0.3, preload: true }),
  arrowfly: D(oad('arrowfly'), { vol: 0.42, ref: 4, max: 20, roll: 1.6, voices: 4, gap: 0.06, pitch: [0.92, 1.12] }),
  arrowDirt: D(oad('arrowDirt'), { vol: 0.5, ref: 6, max: 34, voices: 5, gap: 0.03, preload: true }),
  arrowWood: D(oad('arrowWood'), { vol: 0.58, ref: 7, max: 38, voices: 5, gap: 0.03, preload: true }),
  arrowStone: D(oad('arrowStone'), { vol: 0.5, ref: 7, max: 38, voices: 4, gap: 0.03 }),
  arrowMetal: D(oad('arrowMetal'), { vol: 0.55, ref: 7, max: 38, voices: 4, gap: 0.03 }),
  flesh: D(oad('flesh'), { vol: 0.62, ref: 7, max: 40, voices: 5, gap: 0.03, duck: 0.4, prio: 1.2, preload: true }),
  hit: D(oad('flesh'), { vol: 0.55, ref: 7, max: 40, voices: 4, duck: 0.35 }),
  punch: D(['hit-0', 'hit-1', 'hit-2'], { vol: 0.5, ref: 6, max: 30, voices: 3, pitch: [0.85, 1.05] }),
  swing: D(oad('swordSwing'), { vol: 0.42, ref: 6, max: 34, voices: 5, gap: 0.04, pitch: [0.92, 1.1], preload: true }),
  spear: D(oad('spear'), { vol: 0.45, ref: 6, max: 34, voices: 4, gap: 0.04 }),
  clang: D(oad('swordHit'), { vol: 0.62, ref: 8, max: 46, voices: 6, gap: 0.04, duck: 0.45, prio: 1.2, preload: true }),
  shield: D(oad('shieldWood'), { vol: 0.6, ref: 8, max: 42, voices: 4, gap: 0.04, duck: 0.35 }),
  shieldMetal: D(oad('shieldMetal'), { vol: 0.55, ref: 8, max: 42, voices: 3, gap: 0.04 }),
  // stalowa krata bramy (opuszczana) — szczęk z Kenney
  portcullis: D(['clang-0', 'clang-1'], { vol: 0.6, ref: 8, max: 40, voices: 2, pitch: [0.8, 0.95] }),
  gateOpen: D(oad('gateOpen'), { vol: 0.6, ref: 9, max: 46, voices: 2, wet: 0.4 }),
  gateClose: D(oad('gateClose'), { vol: 0.65, ref: 9, max: 46, voices: 2, wet: 0.4 }),
  collapse: D(oad('collapse'), { vol: 0.95, ref: 14, max: 90, roll: 0.9, voices: 3, pitch: [0.92, 1.05], wet: 0.5, duck: 0.8, prio: 2, preload: true }),
  // ludzie
  death: D(oad('deathMale'), { vol: 0.78, ref: 8, max: 50, voices: 4, gap: 0.08, pitch: [0.93, 1.07], duck: 0.6, prio: 1.6, preload: true }),
  deathFemale: D(oad('deathFemale'), { vol: 0.72, ref: 8, max: 50, voices: 3, gap: 0.08, duck: 0.6, prio: 1.6 }),
  scream: D(['scream-0', 'scream-1', 'scream-2', 'scream-3', 'scream-4'], { vol: 0.6, ref: 8, max: 48, voices: 3, gap: 0.2, duck: 0.5, prio: 1.4 }),
  alert: D(['alert-0', 'alert-1'], { vol: 0.55, ref: 6, max: 30, voices: 2, gap: 0.3 }),
  talk: D(oad('talkMale'), { vol: 0.42, ref: 4, max: 22, roll: 1.5, voices: 4, gap: 0.3, pitch: [0.96, 1.04], duck: 0.15, prio: 0.6, wet: 0.18 }),
  talkFemale: D(oad('talkFemale'), { vol: 0.4, ref: 4, max: 22, roll: 1.5, voices: 3, gap: 0.3, pitch: [0.97, 1.03], duck: 0.15, prio: 0.6, wet: 0.18 }),
  shout: D(oad('shoutMale'), { vol: 0.6, ref: 7, max: 40, voices: 3, gap: 0.25, pitch: [0.95, 1.05], duck: 0.35, prio: 1.1 }),
  // zwierzęta
  dog: D(oad('dog'), { vol: 0.55, ref: 6, max: 36, voices: 2, gap: 0.2, pitch: [0.85, 1.15] }),
  pig: D(oad('pig'), { vol: 0.45, ref: 5, max: 26, voices: 2, pitch: [0.9, 1.1] }),
  cow: D(oad('cow'), { vol: 0.45, ref: 6, max: 34, voices: 2 }),
  sheep: D(oad('sheep'), { vol: 0.4, ref: 5, max: 28, voices: 2, pitch: [0.9, 1.15] }),
  horse: D(oad('horse'), { vol: 0.45, ref: 6, max: 30, voices: 2 }),
  hen: D(['hen-0', 'hen-1', 'hen-2', 'hen-3'], { vol: 0.42, ref: 4, max: 22, voices: 2, pitch: [0.92, 1.1] }),
  growl: D(['wolf'], { vol: 0.65, ref: 6, max: 34, voices: 2, pitch: [0.85, 1] }),
  // ogień i drobiazgi
  torch: D(['torch'], { vol: 0.5, ref: 4, max: 18, voices: 2 }),
  fire: D(oad('fire'), { vol: 0.55, ref: 5, max: 36, roll: 1.3, voices: 8, pitch: [0.97, 1.03], wet: 0.15, bus: 'amb' }),
  campfire: D(oad('fire'), { vol: 0.28, ref: 3, max: 18, roll: 1.6, voices: 6, pitch: [1.05, 1.15], wet: 0.1, bus: 'amb' }),
  crowd: D(oad('crowd'), { vol: 0.32, ref: 5, max: 30, roll: 1.3, voices: 2, pitch: [0.97, 1.03], wet: 0.2, bus: 'amb' }),
  // kroki (krótkie zasięgi: słychać tylko przy zbliżeniu)
  stepDirt: D(['step-dirt-0', 'step-dirt-1', 'step-dirt-2', 'step-dirt-3', 'step-dirt-4'], { vol: 0.38, ref: 2.5, max: 13, roll: 1.6, voices: 5, gap: 0.02, pitch: [0.9, 1.1], wet: 0.08 }),
  stepStone: D(['step-stone-0', 'step-stone-1', 'step-stone-2', 'step-stone-3', 'step-stone-4', 'step-stone-5'], { vol: 0.38, ref: 2.5, max: 13, roll: 1.6, voices: 5, gap: 0.02, pitch: [0.9, 1.1], wet: 0.12 }),
  stepWood: D(['step-wood-0', 'step-wood-1', 'step-wood-2', 'step-wood-3', 'step-wood-4'], { vol: 0.4, ref: 2.5, max: 13, roll: 1.6, voices: 5, gap: 0.02, pitch: [0.9, 1.1], wet: 0.12 }),
  stepGravel: D(['step-gravel-0', 'step-stone-5'], { vol: 0.36, ref: 2.5, max: 13, roll: 1.6, voices: 5, gap: 0.02, pitch: [0.9, 1.1], wet: 0.08 }),
  stepMud: D(['step-mud-0'], { vol: 0.38, ref: 2.5, max: 13, roll: 1.6, voices: 5, gap: 0.02, pitch: [0.85, 1.15], wet: 0.06 }),
} satisfies Record<string, Def>;

export type Kind = keyof typeof DEFS;
/** Odgłosy świata — ta sama nazwa co rodzaj w banku */
export type WorldSound = Kind;
export const fileUrl = (f: string): string => `sounds/${f}.ogg`;

/**
 * Stopnie zużycia murów, wież i bram (bez three.js, żeby dało się to sprawdzić testem).
 * 0 = cały, 1 = rysy, 2 = pęknięcia i odpryski, 3 = mocno rozbity (wyrwy, gruz pod murem).
 * Inżynier podnosi wytrzymałość, więc w trakcie naprawy stopień spada sam, a pęknięcia znikają jedno po drugim.
 */
import { BUILDINGS } from '../data/buildings';

export const WEAR_STEPS = [0.1, 0.35, 0.65] as const;

export function wearStage(hp: number, max: number): 0 | 1 | 2 | 3 {
  if (max <= 0) return 0;
  const hurt = 1 - hp / max;
  if (hurt >= WEAR_STEPS[2]) return 3;
  if (hurt >= WEAR_STEPS[1]) return 2;
  if (hurt >= WEAR_STEPS[0]) return 1;
  return 0;
}

/** Które budynki pokazują pęknięcia: mury, bramy, wieże (obrona) i twierdza. Drabina i studnia nie. */
export function showsWear(type: number): boolean {
  const d = BUILDINGS[type];
  if (!d) return false;
  if (d.id === 'keep') return true;
  return d.category === 'defense' && d.id !== 'ladder';
}

/** Z czego jest budowla: kamień pęka i kruszy się, drewno łupie się i drzazgi lecą pod mur */
export function wearMaterial(type: number): 'stone' | 'wood' {
  const id = BUILDINGS[type]?.id ?? '';
  return id === 'palisade' || id === 'gate' || id === 'watchtower' ? 'wood' : 'stone';
}

/** Ile odbudowano z ruiny (0 = świeża ruina, 1 = stoi): ruina zaczyna od połowy pracy (placement.ts → ruin) */
export function ruinRebuilt(build: number, work: number): number {
  if (work <= 0) return 1;
  const built = 1 - build / work;
  return Math.min(1, Math.max(0, (built - 0.5) / 0.5));
}

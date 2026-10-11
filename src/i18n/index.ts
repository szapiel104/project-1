import { pl, type TextKey } from './pl';

/** Teksty interfejsu. Kolejny język = kolejny plik obok pl.ts. */
export function t(key: TextKey): string {
  return pl[key];
}
export type { TextKey };

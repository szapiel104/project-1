import { pl, type TextKey } from './pl';

/** Teksty interfejsu. Kolejny język = kolejny plik obok pl.ts. */
export function t(key: TextKey | string): string {
  return (pl as Record<string, string>)[key] ?? key;
}
export type { TextKey };

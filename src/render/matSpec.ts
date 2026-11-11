/**
 * Nazwa materiału części z ustawieniami z edytora (Michał 11.11.2026: „skalowanie tekstur — drobniejsze, większe;
 * głębia do ustawienia”): `woodDark@2^1.2~1.5`
 *   `@s` — skala tekstury (2 = dwa razy drobniejsza, 0.5 = dwa razy większa); bez kosztu — liczona w UV bryły,
 *   `^b` — jasność (1.2 = o 20% jaśniej); bez kosztu — w kolorach wierzchołków,
 *   `~d` — głębia wzoru (siła mapy normalnych); osobny wariant materiału, więc jedno wywołanie rysowania więcej
 *          na każdy użyty wariant (wspólny dla wszystkich budynków).
 */
export interface MatSpec { base: string; scale: number; bright: number; depth: number }

export function parseMat(mat: string): MatSpec {
  const m = /^([^@^~]+)(?:@([\d.]+))?(?:\^([\d.]+))?(?:~([\d.]+))?$/.exec(mat);
  if (!m) return { base: mat, scale: 1, bright: 1, depth: 1 };
  const num = (v: string | undefined): number => { const n = Number(v); return v !== undefined && Number.isFinite(n) && n > 0 ? n : 1; };
  return { base: m[1]!, scale: num(m[2]), bright: num(m[3]), depth: num(m[4]) };
}

export function formatMat(s: MatSpec): string {
  const r = (v: number): string => String(Math.round(v * 100) / 100);
  return s.base + (s.scale !== 1 ? `@${r(s.scale)}` : '') + (s.bright !== 1 ? `^${r(s.bright)}` : '') + (s.depth !== 1 ? `~${r(s.depth)}` : '');
}

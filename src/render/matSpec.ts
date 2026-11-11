/**
 * Nazwa materiału części z ustawieniami z edytora (Michał 11.11.2026: „skalowanie tekstur, głębia, światło, cień,
 * zagłębienia — żeby wyglądało jak gra z 2026”): `woodDark|s=2|b=1.2|t=c8a070|ao=1.5|d=1.5|r=0.4|m=0.3|e=0.2`
 *
 * Bez kosztu wydajności (w UV i kolorach wierzchołków tej samej bryły):
 *   s  — skala tekstury (2 = dwa razy drobniejsza, 0.5 = dwa razy większa),
 *   b  — jasność (1.2 = o 20% jaśniej),
 *   t  — barwa (mnożnik koloru, hex bez #; ffffff = bez zmian),
 *   ao — zagłębienia: siła cienia w szczelinach i rogach (wypieczone AO z Blendera; 2 = mocniej, 0 = bez),
 * Osobny wariant materiału (jedno wywołanie rysowania więcej na każdy użyty zestaw, wspólny dla budynków):
 *   d  — głębia wzoru (siła mapy normalnych / wypukłości),
 *   r  — chropowatość (0 = połysk jak mokry kamień czy lakier, 1 = matowe),
 *   m  — metaliczność (0–1),
 *   e  — świecenie własne (0–1; żar, okna nocą, magiczne kryształy).
 * Zgodność wstecz: wcześniejszy zapis `nazwa@s^b~d`.
 */
export interface MatSpec { base: string; scale: number; bright: number; depth: number; tint: string | null; ao: number; rough: number | null; metal: number | null; glow: number }

const DEF: Omit<MatSpec, 'base'> = { scale: 1, bright: 1, depth: 1, tint: null, ao: 1, rough: null, metal: null, glow: 0 };

export function parseMat(mat: string): MatSpec {
  if (mat.includes('|')) {
    const [base, ...parts] = mat.split('|');
    const s: MatSpec = { base: base!, ...DEF };
    for (const p of parts) {
      const [k, v = ''] = p.split('=');
      const n = Number(v);
      if (k === 't') { if (/^[0-9a-f]{6}$/i.test(v)) s.tint = v.toLowerCase(); continue; }
      if (!Number.isFinite(n) || n < 0) continue;
      if (k === 's' && n > 0) s.scale = n; else if (k === 'b' && n > 0) s.bright = n; else if (k === 'd') s.depth = n;
      else if (k === 'ao') s.ao = n; else if (k === 'r') s.rough = Math.min(1, n); else if (k === 'm') s.metal = Math.min(1, n); else if (k === 'e') s.glow = Math.min(1, n);
    }
    return s;
  }
  const m = /^([^@^~]+)(?:@([\d.]+))?(?:\^([\d.]+))?(?:~([\d.]+))?$/.exec(mat);
  if (!m) return { base: mat, ...DEF };
  const num = (v: string | undefined): number => { const n = Number(v); return v !== undefined && Number.isFinite(n) && n > 0 ? n : 1; };
  return { base: m[1]!, ...DEF, scale: num(m[2]), bright: num(m[3]), depth: num(m[4]) };
}

export function formatMat(s: MatSpec): string {
  const r = (v: number): string => String(Math.round(v * 100) / 100);
  const out = [s.base];
  if (s.scale !== 1) out.push(`s=${r(s.scale)}`);
  if (s.bright !== 1) out.push(`b=${r(s.bright)}`);
  if (s.tint && s.tint !== 'ffffff') out.push(`t=${s.tint}`);
  if (s.ao !== 1) out.push(`ao=${r(s.ao)}`);
  if (s.depth !== 1) out.push(`d=${r(s.depth)}`);
  if (s.rough !== null) out.push(`r=${r(s.rough)}`);
  if (s.metal !== null) out.push(`m=${r(s.metal)}`);
  if (s.glow > 0) out.push(`e=${r(s.glow)}`);
  return out.join('|');
}

/** czy ustawienia wymagają osobnego wariantu materiału (koszt: jedno rysowanie więcej) */
export const needsVariant = (s: MatSpec): boolean => s.depth !== 1 || s.rough !== null || s.metal !== null || s.glow > 0;
/** klucz wariantu materiału */
export const variantKey = (s: MatSpec): string => `d${s.depth}|r${s.rough ?? '-'}|m${s.metal ?? '-'}|e${s.glow}`;

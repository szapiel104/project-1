/**
 * Herby graczy: tarcza w barwach z prostym godłem. Numer herbu trzymany jest przy koncie.
 * Rysowane w SVG, więc są ostre w każdym rozmiarze i nie potrzebują plików.
 */
const FIELDS: [string, string][] = [
  ['#8c1f18', '#e9c145'], ['#1f3d6e', '#e8e2cf'], ['#2f4a24', '#e9c145'], ['#1c1714', '#c9c1ad'],
  ['#8a6a1e', '#2a1a0c'], ['#4b2350', '#e9c145'], ['#5c5a55', '#8c1f18'], ['#6b3b1b', '#e8e2cf'],
];

/** Godła: ścieżki w polu 0..100 (środek tarczy ok. 50,52) */
const CHARGES: string[] = [
  // wieża
  'M36 76 V44 h5 v-7 h6 v7 h6 v-7 h6 v7 h5 V76 Z M46 76 v-12 a4 4 0 0 1 8 0 v12 Z',
  // krzyż
  'M45 26 h10 v20 h18 v10 h-18 v26 h-10 v-26 h-18 v-10 h18 Z',
  // gwiazda
  'M50 26 l7 16 17 1 -13 11 4 17 -15 -9 -15 9 4 -17 -13 -11 17 -1 Z',
  // półksiężyc
  'M62 24 A28 28 0 1 0 62 82 A34 34 0 0 1 62 24 Z',
  // skrzyżowane miecze
  'M30 30 l4 -4 40 42 4 -2 2 2 -6 6 -2 -2 2 -4 Z M70 30 l-4 -4 -40 42 -4 -2 -2 2 6 6 2 -2 -2 -4 Z',
  // krokiew
  'M24 66 L50 38 L76 66 L68 72 L50 52 L32 72 Z',
  // topór
  'M48 24 h5 v58 h-5 Z M53 30 c14 0 20 8 20 18 c-8 -3 -13 -2 -20 2 Z',
  // kłos / drzewo
  'M48 80 V46 h4 V80 Z M50 22 c10 8 12 16 0 26 c-12 -10 -10 -18 0 -26 Z M50 40 c12 4 14 12 2 20 Z M50 40 c-12 4 -14 12 -2 20 Z',
];

export const AVATAR_COUNT = FIELDS.length * CHARGES.length;

// ---------------- herb składany z elementów („Mój ród”) ----------------
// Numer herbu od CREST_BASE w górę to herb złożony: pole, drugie pole, podział, godło i jego barwa.
// Numery poniżej 64 to dawne gotowe herby (zostają, żeby stare konta, wyniki i pokoje dalej je pokazywały).
export const CREST_BASE = 100000;
/** Barwy herbowe: [kolor, nazwa PL, nazwa EN] */
export const TINCTURES: [string, string, string][] = [
  ['#8c1f18', 'Czerwień', 'Gules'], ['#1f3d6e', 'Błękit', 'Azure'], ['#2f4a24', 'Zieleń', 'Vert'], ['#1c1714', 'Czerń', 'Sable'],
  ['#4b2350', 'Purpura', 'Purpure'], ['#6b3b1b', 'Brąz', 'Brunatre'], ['#5c5a55', 'Szarość', 'Cendrée'], ['#b4561c', 'Rdza', 'Tenné'],
  ['#e9c145', 'Złoto', 'Or'], ['#e8e2cf', 'Srebro', 'Argent'],
];
/** Podziały tarczy: [nazwa PL, nazwa EN] */
export const DIVISIONS: [string, string][] = [
  ['Jednolita', 'Plain'], ['W słup', 'Per pale'], ['W pas', 'Per fess'], ['W krzyż', 'Quarterly'],
  ['Ukośnie', 'Per bend'], ['Głowica', 'Chief'], ['Bordiura', 'Bordure'], ['Słup', 'Pale'],
];
/** Godła składanego herbu: dawne osiem i nowe (kilof, korona, klucz, róża) */
const MORE_CHARGES: { d: string; even?: boolean }[] = [
  // kilof górnika
  { d: 'M28 76 l38 -38 5 5 -38 38 Z M40 28 c16 -6 32 -1 42 12 c-12 -4 -24 -3 -33 2 Z' },
  // korona
  { d: 'M26 72 V42 l12 12 12 -20 12 20 12 -12 V72 Z M26 76 h48 v6 h-48 Z' },
  // klucz
  { d: 'M50 20 a13 13 0 1 0 0.1 0 Z M50 27 a6 6 0 1 1 -0.1 0 Z M46 44 h8 v38 h-8 Z M54 62 h10 v6 h-10 Z M54 72 h7 v6 h-7 Z', even: true },
  // róża
  { d: 'M50 30 a10 10 0 1 1 -0.1 0 Z M68 42 a10 10 0 1 1 -0.1 0 Z M62 64 a10 10 0 1 1 -0.1 0 Z M38 64 a10 10 0 1 1 -0.1 0 Z M32 42 a10 10 0 1 1 -0.1 0 Z' },
];
export const CREST_CHARGES = CHARGES.length + MORE_CHARGES.length;
/** Nazwy godeł (w kolejności CHARGES, potem MORE_CHARGES): [PL, EN] */
export const CHARGE_NAMES: [string, string][] = [
  ['Wieża', 'Tower'], ['Krzyż', 'Cross'], ['Gwiazda', 'Mullet'], ['Półksiężyc', 'Crescent'], ['Miecze', 'Swords'], ['Krokiew', 'Chevron'],
  ['Topór', 'Axe'], ['Drzewo', 'Tree'], ['Kilof', 'Pickaxe'], ['Korona', 'Crown'], ['Klucz', 'Key'], ['Róża', 'Rose'],
];
export interface Crest { field: number; field2: number; division: number; charge: number; tincture: number }

export const encodeCrest = (c: Crest): number => CREST_BASE + ((((c.field * 16 + c.field2) * 8 + c.division) * 16 + c.tincture) * 16 + c.charge);
const near = (hex: string): number => {
  const v = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = v(hex);
  let best = 0, bd = Infinity;
  TINCTURES.forEach(([t], i) => { const b = v(t); const d = (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
};
/** Herb jako elementy: złożony wprost z numeru, dawny gotowy — przybliżony barwami herbowymi (start kreatora) */
export function decodeCrest(n: number): Crest {
  if (n >= CREST_BASE) {
    let v = n - CREST_BASE;
    const charge = v % 16; v = Math.floor(v / 16);
    const tincture = v % 16; v = Math.floor(v / 16);
    const division = v % 8; v = Math.floor(v / 8);
    const field2 = v % 16; const field = Math.floor(v / 16);
    const T = TINCTURES.length;
    return { field: field % T, field2: field2 % T, division: division % DIVISIONS.length, tincture: tincture % T, charge: charge % CREST_CHARGES };
  }
  const k = ((n % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const [bg, fg] = FIELDS[k % FIELDS.length]!;
  const f = near(bg);
  return { field: f, field2: f, division: 0, tincture: near(fg), charge: Math.floor(k / FIELDS.length) % CHARGES.length };
}

const SHIELD = 'M50 4 L92 14 V52 C92 80 72 98 50 106 C28 98 8 80 8 52 V14 Z';
let clipSeq = 0;
function crestSvg(c: Crest, size: number): string {
  const col = (i: number): string => TINCTURES[i]![0];
  const id = `crest${++clipSeq}`;
  const f2 = col(c.field2);
  const parts: Record<number, string> = {
    1: `<rect x="50" y="0" width="50" height="110" fill="${f2}"/>`,
    2: `<rect x="0" y="55" width="100" height="55" fill="${f2}"/>`,
    3: `<rect x="50" y="0" width="50" height="55" fill="${f2}"/><rect x="0" y="55" width="50" height="55" fill="${f2}"/>`,
    4: `<path d="M0 0 L100 110 H0 Z" fill="${f2}"/>`,
    5: `<rect x="0" y="0" width="100" height="34" fill="${f2}"/>`,
    6: `<path d="${SHIELD}" fill="${f2}"/><path d="${SHIELD}" fill="${col(c.field)}" transform="translate(50 55) scale(.8) translate(-50 -55)"/>`,
    7: `<rect x="36" y="0" width="28" height="110" fill="${f2}"/>`,
  };
  const ch = c.charge < CHARGES.length ? { d: CHARGES[c.charge]! } : MORE_CHARGES[c.charge - CHARGES.length]!;
  return `<svg class="avatar" viewBox="0 0 100 110" width="${size}" height="${Math.round(size * 1.1)}" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath></defs>
    <g clip-path="url(#${id})"><path d="${SHIELD}" fill="${col(c.field)}"/>${parts[c.division] ?? ''}</g>
    <path d="M50 10 L86 19 V52 C86 76 69 92 50 99 Z" fill="#000" opacity=".16"/>
    <path d="${ch.d}" fill="${col(c.tincture)}"${ch.even ? ' fill-rule="evenodd"' : ''} stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <path d="${SHIELD}" fill="none" stroke="#e9c145" stroke-width="5"/>
  </svg>`;
}
export const crestPreview = (c: Crest, size = 48): string => crestSvg(c, size);

export function avatarSvg(i: number, size = 48): string {
  if (i >= CREST_BASE) return crestSvg(decodeCrest(i), size);
  const n = ((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const [bg, fg] = FIELDS[n % FIELDS.length]!;
  const charge = CHARGES[Math.floor(n / FIELDS.length) % CHARGES.length]!;
  return `<svg class="avatar" viewBox="0 0 100 110" width="${size}" height="${Math.round(size * 1.1)}" aria-hidden="true">
    <path d="M50 4 L92 14 V52 C92 80 72 98 50 106 C28 98 8 80 8 52 V14 Z" fill="${bg}" stroke="#e9c145" stroke-width="5"/>
    <path d="M50 10 L86 19 V52 C86 76 69 92 50 99 Z" fill="#000" opacity=".16"/>
    <path d="${charge}" fill="${fg}"/>
  </svg>`;
}

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
  'M58 28 a24 24 0 1 0 0 48 a19 19 0 1 1 0 -48 Z',
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

export function avatarSvg(i: number, size = 48): string {
  const n = ((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const [bg, fg] = FIELDS[n % FIELDS.length]!;
  const charge = CHARGES[Math.floor(n / FIELDS.length) % CHARGES.length]!;
  return `<svg class="avatar" viewBox="0 0 100 110" width="${size}" height="${Math.round(size * 1.1)}" aria-hidden="true">
    <path d="M50 4 L92 14 V52 C92 80 72 98 50 106 C28 98 8 80 8 52 V14 Z" fill="${bg}" stroke="#e9c145" stroke-width="5"/>
    <path d="M50 10 L86 19 V52 C86 76 69 92 50 99 Z" fill="#000" opacity=".16"/>
    <path d="${charge}" fill="${fg}"/>
  </svg>`;
}

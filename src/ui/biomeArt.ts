/**
 * Pejzaże krain na kartach „Nowej gry” (Michał 7.11.2026: „większe zdjęcia, o wiele ładniejsze”).
 * Malowane w SVG: niebo w gradiencie, słońce z poświatą, góry w mgle (perspektywa powietrzna), warstwy terenu
 * ze światłem i cieniem, bez czarnych konturów. Format 16:9 (160×90). Identyfikatory gradientów mają przedrostek
 * krainy, bo na stronie każda ilustracja jest raz.
 */
const W = 160, H = 90;
const svg = (id: string, defs: string, body: string): string =>
  `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${defs}`
  + `<radialGradient id="${id}-vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".35"/></radialGradient>`
  + `</defs>${body}<rect width="${W}" height="${H}" fill="url(#${id}-vig)"/></svg>`;
const lin = (id: string, stops: [number, string, number?][], x2 = 0, y2 = 1): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`;
const sun = (id: string, x: number, y: number, r: number, core: string, glow: string): string =>
  `<radialGradient id="${id}" cx="${x / W}" cy="${y / H}" r="${(r * 4.5) / W}" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`
  + `|<rect width="${W}" height="${H}" fill="url(#${id})"/><circle cx="${x}" cy="${y}" r="${r}" fill="${core}"/>`;
/** sun() zwraca „defs|body” — rozdzielamy */
const split = (s: string): [string, string] => { const i = s.indexOf('|'); return [s.slice(0, i), s.slice(i + 1)]; };

/** drzewo liściaste: pień i trzy kule korony (jasna strona od słońca) */
const oak = (x: number, y: number, s: number, dark: string, light: string): string =>
  `<rect x="${x - 0.8 * s}" y="${y - 6 * s}" width="${1.6 * s}" height="${6 * s}" fill="#4a3220"/>`
  + `<circle cx="${x - 3 * s}" cy="${y - 8 * s}" r="${4 * s}" fill="${dark}"/><circle cx="${x + 3 * s}" cy="${y - 8.5 * s}" r="${4.2 * s}" fill="${dark}"/>`
  + `<circle cx="${x}" cy="${y - 11.5 * s}" r="${4.6 * s}" fill="${dark}"/><circle cx="${x + 1.2 * s}" cy="${y - 12.5 * s}" r="${2.8 * s}" fill="${light}" opacity=".85"/>`;
/** świerk: trzy piętra, opcjonalnie czapy śniegu */
const pine = (x: number, y: number, s: number, c: string, snow = false): string => {
  let o = `<rect x="${x - 0.7 * s}" y="${y - 3 * s}" width="${1.4 * s}" height="${3 * s}" fill="#3a2a1c"/>`;
  for (let i = 0; i < 3; i++) {
    const top = y - (10 + i * 5) * s, w = (7 - i * 1.8) * s, base = top + 9 * s;
    o += `<path d="M${x} ${top} L${x + w} ${base} H${x - w}Z" fill="${c}"/>`;
    if (snow) o += `<path d="M${x} ${top} L${x + w * 0.45} ${top + 4 * s} L${x} ${top + 3 * s} L${x - w * 0.45} ${top + 4 * s}Z" fill="#f4f8fb"/>`;
  }
  return o;
};

const meadow = (): string => {
  const [sd, sb] = split(sun('mw-sun', 118, 22, 7, '#fff3c4', '#ffe7a0'));
  return svg('mw',
    lin('mw-sky', [[0, '#7fb2df'], [0.7, '#cfe3ea'], [1, '#f3e6c0']]) + lin('mw-h1', [[0, '#93a9b8'], [1, '#b7c6c4']])
    + lin('mw-h2', [[0, '#6f9a4a'], [1, '#4f7a34']]) + lin('mw-h3', [[0, '#86b04f'], [1, '#5c8a35']]) + lin('mw-w', [[0, '#9fd0ea'], [1, '#4e8fb8']]) + sd,
    `<rect width="${W}" height="${H}" fill="url(#mw-sky)"/>${sb}`
    + `<g fill="#fff" opacity=".8"><ellipse cx="38" cy="18" rx="16" ry="4.5"/><ellipse cx="48" cy="15" rx="9" ry="5"/><ellipse cx="86" cy="11" rx="11" ry="3"/></g>`
    + `<path d="M0 50 C22 38 40 40 58 46 C78 36 104 36 124 44 C138 40 150 40 160 44 V90 H0Z" fill="url(#mw-h1)"/>`
    + `<path d="M0 60 C28 50 52 52 80 58 C104 50 132 50 160 56 V90 H0Z" fill="url(#mw-h2)"/>`
    + `<path d="M0 72 C30 64 60 64 92 70 C118 64 140 64 160 68 V90 H0Z" fill="url(#mw-h3)"/>`
    + `<path d="M64 90 C70 82 88 78 98 72 C108 66 124 66 134 64 C126 70 116 72 108 76 C96 82 92 86 90 90Z" fill="url(#mw-w)"/>`
    + `<path d="M100 72 C108 68 118 67 126 66" stroke="#e8f6ff" stroke-width=".8" fill="none" opacity=".8"/>`
    + oak(22, 66, 1.3, '#3f6b2a', '#8cbf55') + oak(36, 64, 1, '#46752e', '#94c65c') + oak(140, 64, 1.15, '#3f6b2a', '#8cbf55') + oak(58, 58, 0.7, '#557e3a', '#9cc66a')
    + `<g fill="#f2e27a">${[[14, 82], [30, 84], [44, 80], [118, 82], [150, 80], [130, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g>`);
};

const highland = (): string => {
  const [sd, sb] = split(sun('hl-sun', 30, 20, 6, '#fff0c8', '#ffd28a'));
  return svg('hl',
    lin('hl-sky', [[0, '#5d8fc4'], [0.65, '#d9c9a8'], [1, '#f0c98e']]) + lin('hl-far', [[0, '#a39aa6'], [1, '#c4b4a6']])
    + lin('hl-cliff', [[0, '#c98a56'], [1, '#8a5232']], 1, 0) + lin('hl-shade', [[0, '#7a4a30'], [1, '#5a3424']]) + lin('hl-gr', [[0, '#8aa24e'], [1, '#5f7a34']]) + sd,
    `<rect width="${W}" height="${H}" fill="url(#hl-sky)"/>${sb}`
    + `<path d="M0 54 L8 40 H30 L36 54 Z M110 54 L118 36 H146 L152 54 Z" fill="url(#hl-far)" opacity=".85"/>`
    + `<path d="M0 54 H160 V90 H0Z" fill="#b8a07a"/>`
    // główna mesa: oświetlona ściana, cień po prawej, pasy skał
    + `<path d="M40 70 L50 30 H104 L112 70Z" fill="url(#hl-cliff)"/><path d="M96 30 H104 L112 70 H100Z" fill="url(#hl-shade)"/>`
    + `<g stroke="#a86a40" stroke-width="1.2" opacity=".55"><path d="M47 42 H106"/><path d="M45 50 H108"/><path d="M43 58 H109"/></g>`
    + `<path d="M48 31 C60 27 92 27 106 31 L104 33 H50Z" fill="#7d9a45"/>`
    + `<path d="M120 72 L126 52 H146 L152 72Z" fill="#b07448"/><path d="M142 52 H146 L152 72 H146Z" fill="#7a4a30"/><path d="M125 53 H147" stroke="#7d9a45" stroke-width="2"/>`
    + `<path d="M0 76 C30 70 60 72 90 76 C120 72 140 72 160 74 V90 H0Z" fill="url(#hl-gr)"/>`
    + pine(18, 80, 0.9, '#3e5a2c') + pine(28, 82, 1.1, '#355026') + oak(132, 82, 0.9, '#4d6b2c', '#8fae55')
    + `<path d="M60 90 C70 84 80 82 92 78" stroke="#c8b07a" stroke-width="2.2" fill="none" opacity=".8"/>`);
};

const steppe = (): string => {
  const [sd, sb] = split(sun('st-sun', 112, 46, 9, '#fff1c0', '#ffbf6a'));
  return svg('st',
    lin('st-sky', [[0, '#6f8fb8'], [0.55, '#e6b98a'], [1, '#f6d79a']]) + lin('st-far', [[0, '#c7a27a'], [1, '#d6b386']])
    + lin('st-g1', [[0, '#d9b964'], [1, '#b8923f']]) + lin('st-g2', [[0, '#c9a44c'], [1, '#97732c']]) + sd,
    `<rect width="${W}" height="${H}" fill="url(#st-sky)"/>${sb}`
    + `<g fill="#fff4dc" opacity=".55"><ellipse cx="34" cy="20" rx="20" ry="2.5"/><ellipse cx="62" cy="28" rx="14" ry="1.8"/></g>`
    + `<path d="M0 56 C40 52 80 53 120 54 C136 54 150 53 160 54 V90 H0Z" fill="url(#st-far)"/>`
    + `<path d="M28 56 C34 48 46 48 52 56Z" fill="#b8936a" opacity=".8"/>`
    + `<path d="M0 64 C40 58 90 60 160 62 V90 H0Z" fill="url(#st-g1)"/>`
    + `<path d="M0 76 C50 70 110 72 160 74 V90 H0Z" fill="url(#st-g2)"/>`
    + `<g stroke="#7c5f24" stroke-width=".9" stroke-linecap="round" opacity=".85">${[8, 22, 37, 50, 66, 82, 97, 112, 128, 144, 156].map((x, i) => { const y = 84 + (i % 3); return `<path d="M${x} ${y} l-2.5 -7 M${x} ${y} l0 -8 M${x} ${y} l2.5 -7"/>`; }).join('')}</g>`
    + `<g stroke="#f3dc95" stroke-width=".7" opacity=".7">${[14, 44, 74, 104, 134].map((x) => `<path d="M${x} 70 l-1.5 -5 M${x} 70 l1.5 -5"/>`).join('')}</g>`
    + `<g fill="none" stroke="#4a3a2c" stroke-width=".8" stroke-linecap="round"><path d="M70 22 q2 -2 4 0 q2 -2 4 0"/><path d="M84 18 q1.5 -1.5 3 0 q1.5 -1.5 3 0"/></g>`);
};

const north = (): string => {
  return svg('no',
    lin('no-sky', [[0, '#1f3550'], [0.6, '#6f8fa8'], [1, '#c8d8e2']]) + lin('no-aur', [[0, '#6fe0b0', 0], [0.5, '#6fe0b0', 0.55], [1, '#7a9cf0', 0]], 1, 0)
    + lin('no-m', [[0, '#dfe8ef'], [1, '#93a8b8']]) + lin('no-ms', [[0, '#8fa4b6'], [1, '#6a7f92']]) + lin('no-snow', [[0, '#f6fafc'], [1, '#cfdde6']]),
    `<rect width="${W}" height="${H}" fill="url(#no-sky)"/>`
    + `<path d="M0 22 C30 10 60 26 90 14 C120 4 140 18 160 10 V20 C140 28 118 16 90 24 C60 34 30 20 0 32Z" fill="url(#no-aur)" opacity=".8"/>`
    + `<g fill="#fff">${[[12, 8], [40, 6], [70, 10], [104, 5], [150, 12], [128, 22], [22, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".6"/>`).join('')}</g>`
    + `<path d="M0 58 L22 34 L36 46 L58 24 L82 50 L100 32 L124 54 L142 38 L160 52 V90 H0Z" fill="url(#no-m)"/>`
    + `<path d="M58 24 L82 50 L70 50 L62 36Z M22 34 L36 46 L28 46Z M100 32 L124 54 L112 54 L104 42Z M142 38 L160 52 H152Z" fill="url(#no-ms)"/>`
    + `<path d="M0 64 C40 58 100 60 160 62 V90 H0Z" fill="#b9cad6" opacity=".7"/>`
    + `<path d="M0 72 C40 66 100 68 160 70 V90 H0Z" fill="url(#no-snow)"/>`
    + pine(10, 74, 1.2, '#1f3d2e', true) + pine(24, 76, 1.5, '#1b3628', true) + pine(40, 73, 1, '#24432f', true)
    + pine(112, 74, 1.1, '#1f3d2e', true) + pine(128, 77, 1.55, '#1b3628', true) + pine(146, 74, 1.2, '#24432f', true) + pine(70, 70, 0.7, '#2d4c38', true)
    + `<path d="M60 90 C70 84 84 80 100 78" stroke="#e8f0f5" stroke-width="2" fill="none" opacity=".7"/>`);
};

const desert = (): string => {
  const [sd, sb] = split(sun('de-sun', 124, 20, 8, '#fffbe6', '#ffd27a'));
  return svg('de',
    lin('de-sky', [[0, '#3f86c6'], [0.6, '#a9cbe0'], [1, '#f5dcae']]) + lin('de-d1', [[0, '#e9c58a'], [1, '#d9a866']], 1, 0)
    + lin('de-d2', [[0, '#f0c47a'], [1, '#c98c48']], 1, 0) + lin('de-d3', [[0, '#f6d394'], [1, '#d9a258']]) + lin('de-w', [[0, '#7fd0e0'], [1, '#2f8ca8']]) + sd,
    `<rect width="${W}" height="${H}" fill="url(#de-sky)"/>${sb}`
    + `<path d="M0 56 C20 46 40 46 60 54 C80 44 104 44 124 52 C140 46 152 46 160 50 V90 H0Z" fill="url(#de-d1)" opacity=".85"/>`
    // wydma z ostrą granią: strona w słońcu i strona w cieniu
    + `<path d="M0 74 C18 60 34 56 52 62 C66 54 84 54 100 64 C110 70 116 80 118 90 H0Z" fill="url(#de-d2)"/>`
    + `<path d="M52 62 C66 54 84 54 100 64 C84 62 70 64 52 70Z" fill="#b97c3e" opacity=".55"/>`
    + `<path d="M90 90 C104 72 128 64 160 66 V90Z" fill="url(#de-d3)"/>`
    + `<g stroke="#c08a4a" stroke-width=".6" fill="none" opacity=".6"><path d="M10 80 C20 76 30 76 40 79"/><path d="M14 85 C26 81 38 81 50 84"/><path d="M112 80 C124 76 136 76 150 78"/></g>`
    // oaza: woda, palmy
    + `<ellipse cx="74" cy="80" rx="16" ry="3.6" fill="url(#de-w)"/><path d="M62 80 C68 78 78 78 86 80" stroke="#e8fbff" stroke-width=".6" fill="none"/>`
    + `<path d="M62 80 C60 72 62 66 64 60" stroke="#7a5230" stroke-width="1.3" fill="none"/><g fill="#3f7a35"><path d="M64 60 C58 57 54 58 51 61 C56 59 60 60 64 61Z"/><path d="M64 60 C70 56 75 57 78 60 C73 58 68 59 64 61Z"/><path d="M64 60 C62 54 58 52 55 52 C59 55 61 57 64 61Z"/><path d="M64 60 C67 54 71 53 74 53 C70 56 67 58 64 61Z"/></g>`
    + `<path d="M84 80 C84 74 85 70 87 66" stroke="#7a5230" stroke-width="1.1" fill="none"/><g fill="#4a8a3c"><path d="M87 66 C82 63 79 64 77 66 C81 65 84 66 87 67Z"/><path d="M87 66 C92 63 96 64 98 66 C94 65 90 66 87 67Z"/><path d="M87 66 C86 61 83 60 81 60 C84 62 86 64 87 67Z"/></g>`);
};

/** „Losowa”: kawałek mapy na pergaminie (wybrzeże, rzeka, las, góry) z kośćmi na wierzchu */
const any = (): string => {
  return svg('an',
    `<radialGradient id="an-p" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#f6ead0"/><stop offset="1" stop-color="#d8bd8a"/></radialGradient>`
    + lin('an-sea', [[0, '#8ab8c8'], [1, '#5c93aa']]) + lin('an-d', [[0, '#fffaf0'], [1, '#e9dcc0']]),
    `<rect width="${W}" height="${H}" fill="url(#an-p)"/>`
    + `<path d="M0 0 H46 C40 14 48 26 40 40 C34 52 42 66 34 90 H0Z" fill="url(#an-sea)" opacity=".9"/>`
    + `<path d="M46 0 C40 14 48 26 40 40 C34 52 42 66 34 90" stroke="#8a6a3a" stroke-width=".8" fill="none"/>`
    + `<path d="M40 40 C60 44 72 34 92 40 C110 46 124 40 160 46" stroke="#5c93aa" stroke-width="2" fill="none"/>`
    + `<g fill="#6b8a4a">${[[64, 60], [72, 64], [80, 58], [70, 72], [86, 68], [60, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4"/>`).join('')}</g>`
    + `<g fill="#9a8466"><path d="M110 22 l8 -12 l8 12Z"/><path d="M124 24 l7 -10 l7 10Z"/><path d="M138 22 l6 -9 l6 9Z"/></g><g fill="#f6ead0"><path d="M118 10 l2.5 4 h-5Z"/><path d="M131 14 l2 3 h-4Z"/></g>`
    + `<g stroke="#8a6a3a" stroke-width=".6" fill="none" opacity=".6"><circle cx="140" cy="72" r="9"/><path d="M140 60 V84 M128 72 H152"/></g><path d="M140 63 l2 9 l-2 2 l-2 -2Z" fill="#8a1f14"/>`
    // dwie kości
    + `<g transform="rotate(-12 92 34)"><rect x="80" y="22" width="24" height="24" rx="4" fill="url(#an-d)" stroke="#6a4a2a" stroke-width="1"/>${[[86, 28], [98, 28], [92, 34], [86, 40], [98, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.1" fill="#8a1f14"/>`).join('')}</g>`
    + `<g transform="rotate(14 112 54)"><rect x="102" y="44" width="20" height="20" rx="3.5" fill="url(#an-d)" stroke="#6a4a2a" stroke-width="1"/>${[[107, 49], [117, 59], [112, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#8a1f14"/>`).join('')}</g>`);
};

export const BIOME_ART: Record<string, string> = {
  'biome-any': any(), 'biome-meadow': meadow(), 'biome-highland': highland(), 'biome-steppe': steppe(), 'biome-north': north(), 'biome-desert': desert(),
};

/**
 * Pejzaż ekranu wczytywania i menu (Michał 2.11.2026: „drzewa były mega proste, narysuj coś zajebiście ładnego,
 * jaśniej”). Malowany w SVG, w duchu ekranów wczytywania WoW: złota godzina, niebo od błękitu do złota, chmury
 * podświetlone od dołu, cztery pasma gór coraz bardziej zamglone (perspektywa powietrzna) ze śniegiem na szczytach,
 * dolina z rzeką odbijającą niebo, zamek na skale oświetlony z boku słońcem (ciepła ściana i chłodny cień), smugi
 * światła, ptaki, a z przodu świerki z rozjaśnionym brzegiem. Na wszystkim drobny szum jak faktura obrazu.
 * Wszystko liczone stałym ziarnem — ten sam obraz przy każdym wejściu; rysowany raz, bez plików z zewnątrz.
 */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const f1 = (n: number): string => n.toFixed(1);

/** Pasmo gór: poszarpany grzbiet od lewej do prawej (śnieg na szczytach to ta sama ścieżka z białym gradientem u góry) */
function ridge(seed: number, base: number, amp: number, step: number, peaks: number): { d: string } {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const centers = Array.from({ length: peaks }, () => [r() * 1600, amp * (0.55 + r() * 0.45), 90 + r() * 160] as const);
  for (let x = -20; x <= 1620; x += step) {
    let h = 0;
    for (const [cx, a, w] of centers) h = Math.max(h, a * Math.max(0, 1 - Math.abs(x - cx) / w));
    h += (r() - 0.5) * amp * 0.08;
    pts.push([x, base - h]);
  }
  return { d: `M-20 900 ${pts.map(([x, y]) => `L${f1(x)} ${f1(y)}`).join(' ')} L1620 900 Z` };
}

/** Świerki: każdy z ciemnym pniem koron i jaśniejszym brzegiem od słońca (z prawej) */
function pines(seed: number, y0: number, hMin: number, hMax: number, gap: number, dark: string, lit: string): string {
  const r = rng(seed);
  let dd = '', dl = '';
  for (let x = -40; x < 1660; x += gap * (0.55 + r() * 0.8)) {
    const h = hMin + r() * (hMax - hMin), w = h * (0.4 + r() * 0.1), base = y0 + r() * 16;
    const tiers = 5 + Math.floor(r() * 3);
    for (let k = 0; k < tiers; k++) {
      const top = base - h + (h * k) / (tiers + 0.8), bot = base - h + (h * (k + 1.7)) / (tiers + 0.8);
      const half = (w / 2) * ((k + 1.2) / (tiers + 0.2));
      const sag = (bot - top) * 0.12;
      dd += `M${f1(x - half)} ${f1(bot)}Q${f1(x - half * 0.4)} ${f1(bot - sag)} ${f1(x)} ${f1(top)}Q${f1(x + half * 0.4)} ${f1(bot - sag)} ${f1(x + half)} ${f1(bot)}Z`;
      // oświetlona prawa krawędź piętra
      dl += `M${f1(x + half * 0.15)} ${f1(top + (bot - top) * 0.35)}Q${f1(x + half * 0.55)} ${f1(bot - sag)} ${f1(x + half)} ${f1(bot)}L${f1(x + half * 0.7)} ${f1(bot)}Z`;
    }
  }
  return `<path d="${dd}" fill="${dark}"/><path d="${dl}" fill="${lit}" opacity=".55"/>`;
}

function castle(): string {
  // zamek na skale w prawej części kadru; ściana od słońca (lewa) ciepła, druga w chłodnym cieniu
  const warm = '#b8916a', shade = '#4d4655', roof = '#3a3a52', dark = '#2a2430';
  const m = (x: number, y: number, w: number, n: number, mh = 10): string => {
    const s = w / (n * 2 - 1);
    let d = '';
    for (let i = 0; i < n; i++) d += `M${f1(x + i * s * 2)} ${y}h${f1(s)}v-${mh}h-${f1(s)}Z`;
    return d;
  };
  return `<g>
    <!-- skała -->
    <path d="M960 640 C1000 560 1040 520 1090 512 L1120 470 L1170 480 L1230 455 L1300 468 L1360 500 L1420 540 C1470 580 1500 620 1530 660 Z" fill="#5b4a46"/>
    <path d="M1090 512 L1120 470 L1150 476 L1130 540 L1060 600 L1000 640 L960 640 C1000 560 1040 520 1090 512 Z" fill="#a8806a" opacity=".55"/>
    <path d="M1230 455 L1300 468 L1360 500 L1420 540 L1470 600 L1380 560 L1300 520 Z" fill="#3a3040" opacity=".6"/>
    <!-- mury i wieże: najpierw cień (całość), potem ciepłe ściany od słońca -->
    <path d="M1090 488 h300 v-70 h-300 Z ${m(1090, 418, 300, 15)} M1060 492 h50 v-150 h-50 Z ${m(1058, 342, 54, 4)} M1185 470 h104 v-250 h-104 Z ${m(1183, 220, 108, 6, 12)} M1205 220 h64 v-44 h-64 Z ${m(1203, 176, 68, 4)} M1370 496 h54 v-170 h-54 Z ${m(1368, 326, 58, 4)} M1300 480 h42 v-110 h-42 Z ${m(1298, 370, 46, 3)}" fill="${shade}"/>
    <path d="M1060 492 h24 v-150 h-24 Z M1185 470 h50 v-250 h-50 Z M1205 220 h30 v-44 h-30 Z M1370 496 h24 v-170 h-24 Z M1300 480 h20 v-110 h-20 Z M1090 488 h120 v-70 h-120 Z" fill="${warm}" opacity=".9"/>
    <!-- dachy stożkowe -->
    <path d="M1054 342 L1085 282 L1116 342 Z M1364 326 L1397 262 L1430 326 Z M1199 176 L1237 118 L1275 176 Z" fill="${roof}"/>
    <path d="M1054 342 L1085 282 L1085 342 Z M1364 326 L1397 262 L1397 326 Z M1199 176 L1237 118 L1237 176 Z" fill="#6a6a86" opacity=".7"/>
    <!-- okna i brama -->
    <g fill="#ffd27a" opacity=".95" filter="url(#v-glow)">
      <rect x="1080" y="370" width="7" height="13" rx="3.5"/><rect x="1080" y="410" width="7" height="13" rx="3.5"/>
      <rect x="1214" y="250" width="8" height="15" rx="4"/><rect x="1250" y="250" width="8" height="15" rx="4"/><rect x="1232" y="300" width="9" height="17" rx="4.5"/>
      <rect x="1389" y="356" width="7" height="13" rx="3.5"/><rect x="1389" y="400" width="7" height="13" rx="3.5"/><rect x="1316" y="400" width="6" height="11" rx="3"/>
    </g>
    <path d="M1226 470 v-34 a11 11 0 0 1 22 0 v34 Z" fill="${dark}"/>
    <!-- chorągwie -->
    <path d="M1237 118 v-58" stroke="${dark}" stroke-width="3"/>
    <path d="M1238 62 C1256 56 1270 70 1290 64 L1288 92 C1270 98 1256 84 1238 90 Z" fill="#a8241a"/>
    <path d="M1258 72 l6 -4 6 4 -2 8 h-8 Z" fill="#f0c94a"/>
    <path d="M1397 262 v-34" stroke="${dark}" stroke-width="2"/><path d="M1398 230 l22 6 -22 7 Z" fill="#a8241a"/>
    <path d="M1085 282 v-30" stroke="${dark}" stroke-width="2"/><path d="M1086 254 l18 5 -18 6 Z" fill="#a8241a"/>
  </g>`;
}

export function vistaScene(): string {
  const r = rng(5);
  const far = ridge(101, 560, 250, 14, 7), mid = ridge(203, 600, 200, 12, 6), near = ridge(307, 650, 160, 10, 6);
  let clouds = '';
  for (let i = 0; i < 14; i++) {
    const x = r() * 1700 - 50, y = 60 + r() * 260, w = 180 + r() * 320, h = 26 + r() * 40;
    clouds += `<g opacity="${(0.55 + r() * 0.4).toFixed(2)}"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w / 2)}" ry="${f1(h / 2)}" fill="url(#v-cloud)"/><ellipse cx="${f1(x + w * 0.15)}" cy="${f1(y - h * 0.35)}" rx="${f1(w * 0.28)}" ry="${f1(h * 0.45)}" fill="url(#v-cloud)"/></g>`;
  }
  let birds = '';
  for (let i = 0; i < 9; i++) {
    const x = 640 + r() * 380, y = 170 + r() * 120, s = 5 + r() * 6;
    birds += `M${f1(x - s)} ${f1(y)} Q${f1(x - s / 2)} ${f1(y - s * 0.6)} ${f1(x)} ${f1(y)} Q${f1(x + s / 2)} ${f1(y - s * 0.6)} ${f1(x + s)} ${f1(y)}`;
  }
  return `<svg class="ld-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f3c6e"/><stop offset=".28" stop-color="#4f78a8"/><stop offset=".5" stop-color="#9fb4c4"/><stop offset=".64" stop-color="#f0c88e"/><stop offset=".74" stop-color="#ffb96a"/><stop offset="1" stop-color="#e39a5a"/>
    </linearGradient>
    <radialGradient id="v-sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(820 540) scale(720 360)">
      <stop offset="0" stop-color="#fff4d6" stop-opacity=".95"/><stop offset=".18" stop-color="#ffd38a" stop-opacity=".7"/><stop offset=".55" stop-color="#ffa860" stop-opacity=".22"/><stop offset="1" stop-color="#ff9a50" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="v-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f0ea" stop-opacity=".9"/><stop offset=".6" stop-color="#e8c8b0"/><stop offset="1" stop-color="#ffb47a"/></linearGradient>
    <linearGradient id="v-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea2c0"/><stop offset="1" stop-color="#c9b8b0"/></linearGradient>
    <linearGradient id="v-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a7ea4"/><stop offset="1" stop-color="#a59a9c"/></linearGradient>
    <linearGradient id="v-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c5a7a"/><stop offset="1" stop-color="#6e6a6a"/></linearGradient>
    <linearGradient id="v-snow1" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="420"><stop offset="0" stop-color="#fbf7f2" stop-opacity=".95"/><stop offset=".7" stop-color="#f4ece6" stop-opacity=".55"/><stop offset="1" stop-color="#f4ece6" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-snow2" gradientUnits="userSpaceOnUse" x1="0" y1="390" x2="0" y2="470"><stop offset="0" stop-color="#f2f2f6" stop-opacity=".85"/><stop offset="1" stop-color="#f2f2f6" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9a4a"/><stop offset="1" stop-color="#4e6a30"/></linearGradient>
    <linearGradient id="v-hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f7a36"/><stop offset="1" stop-color="#2f4a22"/></linearGradient>
    <linearGradient id="v-river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0a6"/><stop offset="1" stop-color="#9fc0dc"/></linearGradient>
    <linearGradient id="v-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2b8" stop-opacity="0"/><stop offset=".5" stop-color="#ffdcae" stop-opacity=".45"/><stop offset="1" stop-color="#ffdcae" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d0" stop-opacity="0"/><stop offset=".5" stop-color="#fff2d0" stop-opacity=".22"/><stop offset="1" stop-color="#fff2d0" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0805" stop-opacity="0"/><stop offset=".6" stop-color="#0b0805" stop-opacity=".55"/><stop offset="1" stop-color="#0b0805" stop-opacity=".92"/></linearGradient>
    <radialGradient id="v-vig" cx=".5" cy=".45" r=".8"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <filter id="v-soft" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="v-blur2"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="v-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="v-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .42  0 0 0 0 .32  0 0 0 .07 0"/></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#v-sky)"/>
  <rect width="1600" height="900" fill="url(#v-sun)"/>
  <g filter="url(#v-soft)">${clouds}</g>
  <circle cx="820" cy="520" r="44" fill="#fff6dc" opacity=".9" filter="url(#v-blur2)"/>
  <!-- smugi światła zza gór -->
  <g opacity=".9"><path d="M820 520 L520 0 L640 0 Z M820 520 L760 0 L860 0 Z M820 520 L980 0 L1100 0 Z M820 520 L1220 0 L1320 0 Z" fill="url(#v-ray)"/></g>
  <path d="${far.d}" fill="url(#v-far)"/>
  <path d="${far.d}" fill="url(#v-snow1)"/>
  <rect x="0" y="420" width="1600" height="200" fill="url(#v-haze)"/>
  <path d="${mid.d}" fill="url(#v-mid)"/>
  <path d="${mid.d}" fill="url(#v-snow2)"/>
  <rect x="0" y="480" width="1600" height="180" fill="url(#v-haze)" opacity=".8"/>
  <path d="${near.d}" fill="url(#v-near)"/>
  <!-- dolina i rzeka -->
  <path d="M0 690 C160 630 300 650 440 620 C560 596 660 640 800 628 C940 616 1040 650 1180 640 C1320 630 1460 600 1600 620 V900 H0 Z" fill="url(#v-hill)"/>
  <path d="M760 640 C740 660 700 668 640 690 C560 720 520 750 470 800 C430 840 420 870 400 900 L560 900 C580 860 610 820 660 780 C720 735 790 700 830 670 C850 656 840 642 820 638 Z" fill="url(#v-river)" opacity=".9"/>
  <path d="M0 740 C200 690 360 720 520 700 C700 676 860 720 1040 706 C1240 690 1420 700 1600 680 V900 H0 Z" fill="url(#v-hill2)"/>
  ${castle()}
  <path d="${birds}" fill="none" stroke="#3a2a2a" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
  ${pines(23, 770, 120, 200, 30, '#24361f', '#7a8a3a')}
  ${pines(37, 900, 260, 420, 64, '#121c10', '#4a5a26')}
  <rect x="0" y="600" width="1600" height="300" fill="url(#v-floor)"/>
  <rect width="1600" height="900" fill="url(#v-vig)"/>
  <rect width="1600" height="900" filter="url(#v-grain)"/>
</svg>`;
}

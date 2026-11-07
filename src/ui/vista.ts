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
  // Zamek na skalnym grzbiecie (Michał 2.11.2026: „zamek na górze nienaturalnie” — wcześniej płaski klocek na kopcu).
  // Teraz: mniejszy i dalej (we mgiełce), stoi na poszarpanej skale z jasnymi i ciemnymi ścianami, mury schodzą po
  // zboczu, podstawy wież wrastają w skałę, na stokach drzewa; ściany mają gradient światła i rzędy kamieni.
  // Układ lokalny: (0, 0) = podstawa donżonu, skala i miejsce w transformacji grupy.
  const m = (x: number, y: number, w: number, n: number, mh = 9): string => {
    const st = w / (n * 2 - 1);
    let d = '';
    for (let i = 0; i < n; i++) d += `M${f1(x + i * st * 2)} ${f1(y)}h${f1(st)}v-${mh}h-${f1(st)}Z`;
    return d;
  };
  /** wieża: prostokąt z blankami albo z dachem; lewa (od słońca) połowa ciepła */
  const tower = (x: number, base: number, w: number, h: number, roof: boolean): string => {
    const top = base - h;
    let o = `<path d="M${x} ${base} h${w} v-${h} h-${w} Z" fill="url(#v-wshade)"/>`;
    o += `<path d="M${x} ${base} h${f1(w * 0.48)} v-${h} h-${f1(w * 0.48)} Z" fill="url(#v-wlit)"/>`;
    o += `<path d="M${x} ${base} h${w} v-${h} h-${w} Z" fill="url(#v-courses)" opacity=".5"/>`;
    if (roof) {
      o += `<path d="M${f1(x - 5)} ${top} L${f1(x + w / 2)} ${f1(top - w * 1.25)} L${f1(x + w + 5)} ${top} Z" fill="#3c3a54"/>`;
      o += `<path d="M${f1(x - 5)} ${top} L${f1(x + w / 2)} ${f1(top - w * 1.25)} L${f1(x + w / 2)} ${top} Z" fill="#7a7894" opacity=".75"/>`;
    } else o += `<path d="${m(x - 2, top, w + 4, Math.max(3, Math.round(w / 12)))}" fill="#5a5060"/>`;
    return o;
  };
  const win = (x: number, y: number, w = 5, h = 9): string => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`;
  return `<g transform="translate(1230 560) scale(.9)">
    <!-- skała: bryła grzbietu i ściany w świetle i w cieniu -->
    <path d="M-330 140 L-260 60 L-210 40 L-170 8 L-120 -6 L-60 -14 L0 -8 L60 -20 L120 -4 L170 10 L220 34 L280 70 L340 130 L380 160 Z" fill="#5d4f4c"/>
    <path d="M-260 60 L-210 40 L-170 8 L-150 30 L-190 70 L-230 120 L-300 150 Z M-120 -6 L-60 -14 L-70 20 L-110 60 L-150 30 Z M0 -8 L60 -20 L40 30 L-10 60 L-40 30 Z" fill="#c09a7a" opacity=".55"/>
    <path d="M120 -4 L170 10 L220 34 L280 70 L340 130 L260 120 L200 80 L150 40 Z M60 -20 L120 -4 L100 40 L60 70 L40 30 Z" fill="#2e2838" opacity=".55"/>
    <path d="M-170 8 L-150 30 M-110 60 L-60 90 M40 30 L80 80 M150 40 L180 90 M-230 120 L-200 150" stroke="#2a2228" stroke-width="2" opacity=".5"/>
    <!-- mur kurtynowy schodzący po zboczu (w cieniu, z blankami) -->
    <path d="M-200 46 L-200 0 L-110 -8 L-110 -40 L120 -40 L120 -10 L200 30 L200 64 L120 30 L120 4 L-110 4 L-110 38 Z" fill="url(#v-wshade)"/>
    <path d="M-200 46 L-200 0 L-110 -8 L-110 -40 L0 -40 L0 4 L-110 4 L-110 38 Z" fill="url(#v-wlit)"/>
    <path d="${m(-108, -40, 226, 12)} ${m(-198, 0, 86, 5)}" fill="#5a5060"/>
    <path d="M-200 46 L-200 0 L-110 -8 L-110 -40 L120 -40 L120 -10 L200 30 L200 64 Z" fill="url(#v-courses)" opacity=".45"/>
    ${tower(-232, 52, 40, 128, true)}
    ${tower(-40, 0, 84, 236, false)}
    ${tower(-20, -236, 44, 42, true)}
    ${tower(110, 0, 34, 96, false)}
    ${tower(186, 72, 42, 150, true)}
    <!-- skały przed podstawami (wieże wrastają w grzbiet) -->
    <path d="M-250 70 L-226 46 L-200 54 L-180 48 L-160 76 L-200 96 Z M-60 10 L-30 -2 L10 4 L40 0 L60 14 L20 30 L-30 26 Z M170 84 L196 64 L230 72 L250 96 L210 110 Z" fill="#5d4f4c"/>
    <path d="M-250 70 L-226 46 L-212 60 L-236 82 Z M-60 10 L-30 -2 L-24 14 Z" fill="#c09a7a" opacity=".5"/>
    <!-- brama i okna -->
    <path d="M-8 0 v-30 a10 10 0 0 1 20 0 v30 Z" fill="#241e28"/>
    <g fill="#ffd27a" filter="url(#v-glow)">${win(-28, -200)}${win(14, -200)}${win(-8, -150, 6, 11)}${win(-215, -60)}${win(-215, -25)}${win(200, -40)}${win(200, 0)}${win(120, -70, 4, 8)}</g>
    <!-- chorągwie -->
    <path d="M2 -331 v-46" stroke="#241e28" stroke-width="3"/><path d="M3 -376 C18 -381 30 -369 46 -374 L44 -350 C30 -345 18 -357 3 -352 Z" fill="#a8241a"/><path d="M20 -368 l5 -3 5 3 -2 7 h-6 Z" fill="#f0c94a"/>
    <path d="M-212 -126 v-26" stroke="#241e28" stroke-width="2"/><path d="M-211 -151 l18 5 -18 6 Z" fill="#a8241a"/>
    <path d="M207 -130 v-26" stroke="#241e28" stroke-width="2"/><path d="M208 -155 l18 5 -18 6 Z" fill="#a8241a"/>
  </g>`;
}

/** Kolejny numer obrazu: każdy pejzaż ma własne identyfikatory gradientów i filtrów. Ekran wczytywania i menu mają
 *  dwa naraz w dokumencie; przy wspólnych „v-sky” itd. Chrome brał definicje z obrazu już schowanego (display: none)
 *  i niebo, góry i dolina wychodziły czarne (Michał 2.11.2026: „zbugowane”). */
let instance = 0;

/** Pora dnia pejzażu losuje się przy każdym wczytaniu (Michał 7.11.2026); różnią się tylko filtrem barw w CSS */
const VARIANTS = ['dusk', 'dawn', 'night'];
export function vistaScene(): string {
  return paint().replace(/v-([a-z0-9]+)/g, `v${++instance}-$1`);
}

function paint(): string {
  const r = rng(5);
  const far = ridge(101, 560, 250, 14, 7), mid = ridge(203, 600, 200, 12, 6), near = ridge(307, 650, 160, 10, 6);
  // chmury (Michał 2.11.2026: „bardziej epickie”): wielkie kłębiaste cumulusy po bokach kadru i mniejsze w głębi —
  // każdy z dziesiątek kłębów, jasny wierzch, złoto-różowy spód od zachodzącego słońca, ciemniejszy cień pod spodem
  // i rozświetlona krawędź od strony słońca; nisko nad górami smugi pierzastych chmur w pomarańczu
  const cumulus = (cx: number, base: number, w: number, h: number, seed: number, op = 1): string => {
    const q = rng(seed);
    const puffs: [number, number, number][] = [];
    const rows = 5;
    for (let k = 0; k < rows; k++) {
      const t = k / (rows - 1), rowW = w * (1 - t * 0.72), y = base - h * t * 0.85;
      const n = Math.max(2, Math.round(9 * (1 - t * 0.7)));
      for (let i = 0; i < n; i++) {
        const x = cx - rowW / 2 + (rowW * (i + 0.5)) / n + (q() - 0.5) * rowW * 0.08;
        puffs.push([x, y - q() * h * 0.08, (h * (0.22 + q() * 0.14)) * (1 - t * 0.35)]);
      }
    }
    const circ = (dx: number, dy: number, ks: number): string => puffs.map(([x, y, rr]) => `<circle cx="${f1(x + dx)}" cy="${f1(y + dy)}" r="${f1(rr * ks)}"/>`).join('');
    const flat = `<ellipse cx="${f1(cx)}" cy="${f1(base + h * 0.06)}" rx="${f1(w * 0.52)}" ry="${f1(h * 0.16)}"/>`;
    // jeden gradient na całą chmurę (w układzie sceny): z osobnym na każdy kłąb każda kula miała własne światło i chmura
    // wyglądała jak kiść baniek
    const top = base - h * 1.05, gid = `v-cum${seed}`;
    return `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(top)}" x2="0" y2="${f1(base + h * 0.2)}"><stop offset="0" stop-color="#fffaf2"/><stop offset=".5" stop-color="#f9e8d8"/><stop offset=".8" stop-color="#eebc98"/><stop offset="1" stop-color="#d98a5e"/></linearGradient>
    <g opacity="${op}">
      <g fill="#6e5e7e" opacity=".45" filter="url(#v-cs)">${circ(8, h * 0.12, 1)}${flat}</g>
      <g fill="url(#${gid})" filter="url(#v-cb)">${circ(0, 0, 1)}${flat}</g>
      <g fill="#ffffff" opacity=".45" filter="url(#v-cs)">${circ(-w * 0.04, -h * 0.08, 0.5)}</g>
    </g>`;
  };
  let clouds = '';
  clouds += cumulus(170, 300, 520, 300, 11, 0.95);
  clouds += cumulus(1480, 250, 560, 320, 12, 0.95);
  clouds += cumulus(560, 190, 260, 120, 13, 0.8);
  clouds += cumulus(1060, 150, 300, 130, 14, 0.75);
  clouds += cumulus(820, 90, 180, 70, 15, 0.6);
  let streaks = '';
  for (let i = 0; i < 9; i++) {
    const x = r() * 1600, y = 330 + r() * 130, w = 220 + r() * 360;
    streaks += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w / 2)}" ry="${f1(4 + r() * 6)}" fill="url(#v-streak)" opacity="${(0.45 + r() * 0.4).toFixed(2)}"/>`;
  }
  let birds = '';
  for (let i = 0; i < 9; i++) {
    const x = 640 + r() * 380, y = 170 + r() * 120, s = 5 + r() * 6;
    birds += `M${f1(x - s)} ${f1(y)} Q${f1(x - s / 2)} ${f1(y - s * 0.6)} ${f1(x)} ${f1(y)} Q${f1(x + s / 2)} ${f1(y - s * 0.6)} ${f1(x + s)} ${f1(y)}`;
  }
  return `<svg class="ld-scene sv-${VARIANTS[Math.floor(Math.random() * VARIANTS.length)]}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14284e"/><stop offset=".26" stop-color="#3e6698"/><stop offset=".5" stop-color="#9fb4c4"/><stop offset=".64" stop-color="#f0c88e"/><stop offset=".74" stop-color="#ffb96a"/><stop offset="1" stop-color="#e39a5a"/>
    </linearGradient>
    <radialGradient id="v-sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(820 540) scale(720 360)">
      <stop offset="0" stop-color="#fff4d6" stop-opacity=".95"/><stop offset=".18" stop-color="#ffd38a" stop-opacity=".7"/><stop offset=".55" stop-color="#ffa860" stop-opacity=".22"/><stop offset="1" stop-color="#ff9a50" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="v-cum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset=".45" stop-color="#f8e6d6"/><stop offset=".8" stop-color="#eab694"/><stop offset="1" stop-color="#d7845a"/></linearGradient>
    <linearGradient id="v-streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb070" stop-opacity="0"/><stop offset=".5" stop-color="#ffc890"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></linearGradient>
    <filter id="v-cb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="v-cs" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <linearGradient id="v-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f0ea" stop-opacity=".9"/><stop offset=".6" stop-color="#e8c8b0"/><stop offset="1" stop-color="#ffb47a"/></linearGradient>
    <linearGradient id="v-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea2c0"/><stop offset="1" stop-color="#c9b8b0"/></linearGradient>
    <linearGradient id="v-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a7ea4"/><stop offset="1" stop-color="#a59a9c"/></linearGradient>
    <linearGradient id="v-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c5a7a"/><stop offset="1" stop-color="#6e6a6a"/></linearGradient>
    <linearGradient id="v-snow1" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="420"><stop offset="0" stop-color="#fbf7f2" stop-opacity=".95"/><stop offset=".7" stop-color="#f4ece6" stop-opacity=".55"/><stop offset="1" stop-color="#f4ece6" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-snow2" gradientUnits="userSpaceOnUse" x1="0" y1="390" x2="0" y2="470"><stop offset="0" stop-color="#f2f2f6" stop-opacity=".85"/><stop offset="1" stop-color="#f2f2f6" stop-opacity="0"/></linearGradient>
    <linearGradient id="v-wlit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b48a"/><stop offset="1" stop-color="#9a7a5e"/></linearGradient>
    <linearGradient id="v-wshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e5668"/><stop offset="1" stop-color="#3e3846"/></linearGradient>
    <pattern id="v-courses" width="18" height="9" patternUnits="userSpaceOnUse"><path d="M0 8.5 H18 M9 0 V4.5 M0 4.5 H18 M3 4.5 V9" stroke="#2a2228" stroke-width=".8" fill="none"/></pattern>
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
  <g filter="url(#v-soft)" opacity=".9">${streaks}</g>
  ${clouds}
  <circle cx="820" cy="520" r="44" fill="#fff6dc" opacity=".9" filter="url(#v-blur2)"/>
  <!-- smugi światła zza gór -->
  <g opacity="1.25"><path d="M820 520 L520 0 L640 0 Z M820 520 L760 0 L860 0 Z M820 520 L980 0 L1100 0 Z M820 520 L1220 0 L1320 0 Z" fill="url(#v-ray)"/></g>
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
  <!-- mgła w dolinie u stóp zamku -->
  <ellipse cx="900" cy="640" rx="900" ry="34" fill="#fff1dc" opacity=".28" filter="url(#v-soft)"/>
  <ellipse cx="1250" cy="610" rx="420" ry="22" fill="#fff1dc" opacity=".22" filter="url(#v-soft)"/>
  <!-- skała z lewej na pierwszym planie (rama obrazu) z oświetloną krawędzią -->
  <path d="M-20 900 L-20 420 L30 400 L70 430 L120 470 L150 520 L200 560 L230 620 L270 700 L300 780 L330 900 Z" fill="#1c1514"/>
  <path d="M30 400 L70 430 L120 470 L150 520 L200 560 L230 620 L212 626 L182 566 L134 526 L104 478 L60 440 Z" fill="#d79a5e" opacity=".55"/>
  <path d="${birds}" fill="none" stroke="#3a2a2a" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
  ${pines(23, 770, 120, 200, 30, '#24361f', '#7a8a3a')}
  ${pines(37, 900, 260, 420, 64, '#121c10', '#4a5a26')}
  <rect x="0" y="600" width="1600" height="300" fill="url(#v-floor)"/>
  <rect width="1600" height="900" fill="url(#v-vig)"/>
  <rect width="1600" height="900" filter="url(#v-grain)"/>
</svg>`;
}

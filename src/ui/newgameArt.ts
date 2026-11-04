/**
 * „Nowa gra” w pasku na dole (Michał 3.11.2026: „fajny, przesuwalny, dużo się dzieje, przepiękny”): ilustracje na
 * kartach trybu, poziomu i krainy (proste rysunki w barwach pergaminu i atramentu) oraz rzędy kart przewijane
 * przeciąganiem, kółkiem myszy i strzałkami po bokach, z dociąganiem do karty.
 */
const INK = '#3a2410', RED = '#8a1f14', GOLD = '#c9963a', BLUE = '#1f4f7a';

const shield = (x: number, y: number, s: number, fill: string): string =>
  `<path d="M${x} ${y} l${8 * s} ${2.5 * s} v${8 * s} c0 ${6 * s} ${-4 * s} ${9.5 * s} ${-8 * s} ${11 * s} c${-4 * s} ${-1.5 * s} ${-8 * s} ${-5 * s} ${-8 * s} ${-11 * s} v${-8 * s} z" fill="${fill}" stroke="${INK}" stroke-width="1.6"/>`;
const swords = (x: number, y: number, s: number): string =>
  `<g stroke="${INK}" stroke-width="${2.2 * s}" stroke-linecap="round"><path d="M${x - 9 * s} ${y - 9 * s} L${x + 9 * s} ${y + 9 * s} M${x + 9 * s} ${y - 9 * s} L${x - 9 * s} ${y + 9 * s}"/></g>`
  + `<g stroke="${GOLD}" stroke-width="${2 * s}" stroke-linecap="round"><path d="M${x - 5 * s} ${y + 2 * s} l${3 * s} ${3 * s} M${x + 5 * s} ${y + 2 * s} l${-3 * s} ${3 * s}"/></g>`;
const svg = (body: string): string => `<svg viewBox="0 0 140 64" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

/** Tarcze obu stron: czerwone po lewej, niebieskie po prawej; przy 4 na 4 w dwóch rzędach */
const sides = (n: number): string => {
  const s = n === 1 ? 1.5 : n === 2 ? 1.15 : 0.82;
  const rows = n === 4 ? 2 : 1, per = n / rows;
  let out = '';
  for (let i = 0; i < n; i++) {
    const col = i % per, row = Math.floor(i / per);
    const y = rows === 2 ? 6 + row * 27 : 32 - 11 * s;
    out += shield(14 + 8 * s + col * 19 * s, y, s, RED);
    out += shield(126 - 8 * s - col * 19 * s, y, s, BLUE);
  }
  return out;
};

const ART: Record<string, string> = {
  'mode-1v1': svg(`${sides(1)}${swords(70, 32, 1.1)}`),
  'mode-2v2': svg(`${sides(2)}${swords(70, 32, 1)}`),
  'mode-4v4': svg(`${sides(4)}${swords(70, 32, 0.9)}`),
  // poziomy: od gałązki oliwnej (pokój) po trzy pary mieczy i czaszkę
  'lvl-0': svg(`<path d="M44 46 C60 30 80 26 98 18" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>${([[54, 38, -30], [64, 32, 30], [72, 30, -30], [82, 25, 30], [90, 22, -30]] as const).map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.2" transform="rotate(${r} ${x} ${y})" fill="#6b8a3a" stroke="${INK}" stroke-width="1"/>`).join('')}<circle cx="100" cy="17" r="3" fill="${GOLD}" stroke="${INK}"/>`),
  'lvl-1': svg(swords(70, 32, 1.2)),
  'lvl-2': svg(`${swords(54, 32, 1.05)}${swords(86, 32, 1.05)}`),
  'lvl-3': svg(`${swords(40, 34, 0.95)}${swords(100, 34, 0.95)}<path d="M62 22 a8 8 0 0 1 16 0 v6 l-3 3 h-10 l-3 -3z" fill="#efe2c4" stroke="${INK}" stroke-width="1.6"/><circle cx="67" cy="24" r="2" fill="${INK}"/><circle cx="73" cy="24" r="2" fill="${INK}"/><path d="M66 33 v4 M70 33 v4 M74 33 v4" stroke="${INK}" stroke-width="1.4"/>`),
  // krainy: małe pejzaże
  'biome-any': svg(`<rect x="52" y="12" width="36" height="36" rx="5" fill="#efe2c4" stroke="${INK}" stroke-width="1.8" transform="rotate(-10 70 30)"/>${([[62, 22], [78, 20], [70, 30], [62, 38], [78, 38]] as const).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${RED}"/>`).join('')}`),
  'biome-meadow': svg(`<path d="M0 50 C30 34 50 40 70 44 S110 34 140 44 V64 H0z" fill="#7d9a45" stroke="${INK}" stroke-width="1.4"/><ellipse cx="96" cy="52" rx="18" ry="4" fill="#4f86a8" stroke="${INK}" stroke-width="1.2"/><path d="M34 44 v-10" stroke="${INK}" stroke-width="2"/><circle cx="34" cy="28" r="9" fill="#4f7a2f" stroke="${INK}" stroke-width="1.4"/><circle cx="50" cy="32" r="6" fill="#5b8a35" stroke="${INK}" stroke-width="1.2"/>`),
  'biome-highland': svg(`<path d="M0 56 H24 L30 26 H74 L80 56 H140 V64 H0z" fill="#9a8a6a" stroke="${INK}" stroke-width="1.4"/><path d="M30 26 H74" stroke="#5b7a35" stroke-width="4"/><path d="M90 56 L100 38 H124 L132 56" fill="#a89878" stroke="${INK}" stroke-width="1.4"/><path d="M40 34 v10 M52 30 v14 M64 34 v12" stroke="#6e5c40" stroke-width="1"/>`),
  'biome-steppe': svg(`<path d="M0 46 C40 42 90 44 140 42 V64 H0z" fill="#c8b06a" stroke="${INK}" stroke-width="1.4"/>${[14, 30, 48, 66, 84, 102, 120].map((x) => `<path d="M${x} 52 l-3 -8 M${x} 52 l0 -9 M${x} 52 l3 -8" stroke="#8a7a3a" stroke-width="1.3" stroke-linecap="round"/>`).join('')}<circle cx="112" cy="18" r="8" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>`),
  'biome-north': svg(`<path d="M0 50 C40 46 90 48 140 46 V64 H0z" fill="#e8eef0" stroke="${INK}" stroke-width="1.4"/>${([[24, 50, 1], [44, 52, 1.2], [66, 50, 0.9], [92, 52, 1.15], [114, 50, 1]] as const).map(([x, y, s]) => `<path d="M${x} ${y - 30 * s} l${9 * s} ${14 * s} h-${4 * s} l${7 * s} ${12 * s} h-${24 * s} l${7 * s} -${12 * s} h-${4 * s}z" fill="#2f5a3a" stroke="${INK}" stroke-width="1.2"/><path d="M${x} ${y - 30 * s} l${4 * s} ${6 * s} h-${8 * s}z" fill="#fff"/>`).join('')}`),
  'biome-desert': svg(`<path d="M0 48 C24 36 44 36 64 46 C84 34 110 34 140 46 V64 H0z" fill="#e0c07a" stroke="${INK}" stroke-width="1.4"/><path d="M30 44 C40 40 50 40 58 44" stroke="#b8954e" stroke-width="1.4" fill="none"/><circle cx="108" cy="16" r="9" fill="#e8a83a" stroke="${INK}" stroke-width="1.4"/><path d="M80 48 v-12 M80 38 c-6 -2 -9 -6 -10 -10 M80 38 c6 -2 9 -6 10 -10" stroke="#4f7a2f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`),
};

/** Ilustracja do karty (po klasie kafelka, np. `mode-2v2`, `lvl-3`, `biome-north`) albo pusty napis */
export const pickArt = (key: string): string => ART[key.trim()] ?? '';

/**
 * Rząd kart przewijany w poziomie: przeciąganie myszą (z bezwładnością dociągania przez CSS scroll-snap), kółko myszy
 * przewija w bok, strzałki po bokach o dwie karty; strzałka znika na końcu rzędu. Zwraca opakowanie z rzędem w środku.
 */
export function slider(row: HTMLElement, label: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ng-slider';
  const mk = (dir: -1 | 1): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ng-arrow ${dir < 0 ? 'prev' : 'next'}`;
    b.setAttribute('aria-label', `${label}: ${dir < 0 ? '←' : '→'}`);
    b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    b.addEventListener('click', () => row.scrollBy({ left: dir * Math.max(160, row.clientWidth * 0.7), behavior: 'smooth' }));
    return b;
  };
  const prev = mk(-1), next = mk(1);
  const sync = (): void => {
    const max = row.scrollWidth - row.clientWidth - 2;
    prev.hidden = row.scrollLeft <= 2;
    next.hidden = row.scrollLeft >= max;
    wrap.classList.toggle('more-l', !prev.hidden);
    wrap.classList.toggle('more-r', !next.hidden);
  };
  row.addEventListener('scroll', sync, { passive: true });
  // obserwator sam się odłącza, gdy rząd zniknie ze strony (każde otwarcie „Nowej gry” tworzy nowe rzędy)
  let attached = false;
  const ro = new ResizeObserver(() => { if (row.isConnected) { attached = true; sync(); } else if (attached) ro.disconnect(); });
  ro.observe(row);
  // kółko myszy: przewija rząd w bok (gdy jest co przewijać)
  row.addEventListener('wheel', (e) => {
    if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    row.scrollBy({ left: e.deltaY, behavior: 'auto' });
  }, { passive: false });
  // przeciąganie myszą; klik bez przesunięcia zostaje zwykłym wyborem karty
  let down = false, sx = 0, sl = 0, moved = false;
  row.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = row.scrollLeft; });
  // ruch i puszczenie na samym rzędzie (przechwycony wskaźnik) — bez nasłuchów na oknie, które zostawały po zamknięciu
  row.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved) { try { row.setPointerCapture(e.pointerId); } catch { /* wskaźnik już puszczony */ } }
    moved = true;
    row.classList.add('dragging');
    row.scrollLeft = sl - dx;
  });
  const up = (): void => { if (!down) return; down = false; row.classList.remove('dragging'); };
  row.addEventListener('pointerup', up);
  row.addEventListener('pointercancel', up);
  row.addEventListener('lostpointercapture', up);
  row.addEventListener('pointerleave', () => { if (!moved) down = false; });
  row.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  wrap.append(prev, row, next);
  requestAnimationFrame(sync);
  return wrap;
}

import { tx } from '../i18n';
import { UNITS } from '../data/units';
import type { Soldier } from '../sim/state';
import { GREAT_CD, GREAT_POWER, GREAT_POWER_WATER } from '../sim/systems/greatspell';
import { hideTip, showTip } from './armyControls';

/**
 * Pasek czarów zaznaczonych magów (Michał 30.10.2026: „jak kliknę maga, niech ma w interfejsie zwykły i wielki czar
 * i widać, jak się ładuje — jak w MMORPG”). Na każdy rodzaj maga w zaznaczeniu para ikon: zwykły czar i wielki czar.
 * Odnowienie pokazuje ciemna nakładka schodząca jak wskazówka zegara i licznik sekund; gotowy czar świeci złotą ramką,
 * a w chwili rzutu ikona błyska. Przy kilku magach jednego rodzaju liczy się ten, który najszybciej będzie gotowy,
 * a w rogu widać, ilu ma czar gotowy. Magowie rzucają sami (symulacja), pasek tylko pokazuje ich stan.
 * Odświeża się co klatkę (własna pętla), dopóki są zaznaczeni magowie — panel wojska odświeża się rzadziej.
 */

type School = 'fire' | 'water';
interface Slot { el: HTMLButtonElement; shade: HTMLElement; secs: HTMLElement; badge: HTMLElement; wasReady: boolean; last: number }
interface Pair { wrap: HTMLElement; normal: Slot; great: Slot }

const svg = (body: string): string => `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">${body}</svg>`;
let uid = 0;
/** Pocisk z ogonem (kometa): kula w (x, y), ogon w stronę `rot` stopni; kolory: zewnętrzny ogon, środek ogona, kula, blask */
function comet(x: number, y: number, k: number, rot: number, c: [string, string, string, string]): string {
  const id = `sb${uid++}`;
  return `<defs><radialGradient id="${id}" cx="40%" cy="40%" r="65%"><stop offset="0" stop-color="${c[3]}"/><stop offset=".5" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[0]}"/></radialGradient></defs>
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">
      <path d="M0 -24C5 -15 9 -9 9 -2L-9 -2C-9 -9 -5 -15 0 -24z" fill="${c[0]}" opacity=".9"/>
      <path d="M0 -17C3 -11 5 -7 5 -2L-5 -2C-5 -7 -3 -11 0 -17z" fill="${c[1]}"/>
      <circle r="9" fill="url(#${id})"/><circle cx="-3" cy="-3" r="2.6" fill="#fff" opacity=".75"/></g>`;
}
const FIRE: [string, string, string, string] = ['#c9360f', '#ffb52e', '#ff8a1f', '#fff3b8'];
const WATER: [string, string, string, string] = ['#1d5fae', '#8fdcff', '#3fa4e6', '#effcff'];
// płomień na ziemi (deszcz ognia trafia w cel)
const FLAME = '<path d="M20 37c-8 0-11-6-8-11 1 3 3 4 4 3-2-5 1-10 5-13 0 4 3 6 5 9 1-2 1-4 0-6 4 3 6 8 4 12-1 4-4 6-10 6z" fill="#ff7a1e"/><path d="M20 37c-4 0-6-3-4-6 1 1 2 2 3 1-1-3 1-5 3-7 0 3 2 4 3 6 1 3-1 6-5 6z" fill="#ffe08a"/>';
// ramię lodowej gwiazdy (6 razy obrócone)
const ARM = '<path d="M20 20V7M20 11l-3.5-3M20 11l3.5-3M20 15l-3-2.5M20 15l3-2.5" stroke="#effcff" stroke-width="2" stroke-linecap="round" fill="none"/>';
// ikony w kolorze (nie kreską jak rozkazy): zwykły czar to pocisk, wielki to deszcz pocisków / lodowy krąg
const ICON: Record<School, { normal: string; great: string }> = {
  fire: {
    normal: svg(comet(17, 23, 0.9, 45, FIRE)),
    great: svg(`<rect width="40" height="40" fill="#3a0f05" opacity=".55"/>${comet(9, 11, 0.42, 30, FIRE)}${comet(31, 9, 0.42, 30, FIRE)}${comet(21, 15, 0.5, 30, FIRE)}${FLAME}`),
  },
  water: {
    normal: svg(comet(17, 23, 0.9, 45, WATER)),
    great: svg(`<rect width="40" height="40" fill="#06223f" opacity=".55"/><ellipse cx="20" cy="31" rx="16" ry="5" fill="#bfeaff" fill-opacity=".3" stroke="#9fe0ff" stroke-width="1.8"/>
      <g transform="translate(0 -1)">${[0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a} 20 20)">${ARM}</g>`).join('')}<circle cx="20" cy="20" r="3" fill="#5fc3f0" stroke="#effcff" stroke-width="1.4"/></g>`),
  },
};

const unitOf = (s: School): number => UNITS.findIndex((u) => u.magic === s);

function texts(s: School, great: boolean): { name: string; tip: string } {
  const def = UNITS[unitOf(s)]!;
  const secs = (t: number): string => (t / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (s === 'fire' && !great) return {
    name: tx('Kula ognia', 'Fireball'),
    tip: tx(`${def.attack} obrażeń, nie chybia, parzy stojących obok celu i podpala. Co ${secs(def.cooldown)} s.`, `${def.attack} damage. Never misses, scorches those standing beside the target and sets it alight. Every ${secs(def.cooldown)} s.`),
  };
  if (s === 'fire') return {
    name: tx('Deszcz ognia', 'Rain of Fire'),
    tip: tx(`Wielki czar: z nieba spadają ogniste kule na skupisko wrogów (ok. ${Math.round(def.attack * GREAT_POWER)} obrażeń w środku kręgu, każdy płonie). Mag rzuca go sam, gdy wrogowie stoją w kupie. Odnowienie ${secs(GREAT_CD)} s.`,
      `Great spell: balls of fire fall from the sky on a knot of foes (about ${Math.round(def.attack * GREAT_POWER)} damage at the heart of the circle, and all of them burn). The mage casts it unbidden when the enemy bunches up. Recharges in ${secs(GREAT_CD)} s.`),
  };
  if (!great) return {
    name: tx('Pocisk wody', 'Water Bolt'),
    tip: tx(`${def.attack} obrażeń, nie chybia, odrzuca trafionego o pole i spowalnia. Bez walki gasi płonące budynki. Co ${secs(def.cooldown)} s.`, `${def.attack} damage. Never misses, hurls the target back a tile and slows it. Out of battle it douses burning buildings. Every ${secs(def.cooldown)} s.`),
  };
  return {
    name: tx('Lodowy krąg', 'Ring of Ice'),
    tip: tx(`Wielki czar: ziemię w kręgu skuwa lód — wrogowie długo idą o połowę wolniej i tracą ok. ${Math.round(def.attack * GREAT_POWER_WATER)} zdrowia, a płonący sojusznicy gasną. Mag rzuca go sam, gdy wrogowie stoją w kupie. Odnowienie ${secs(GREAT_CD)} s.`,
      `Great spell: the ground within the ring freezes — foes long move at half pace and lose about ${Math.round(def.attack * GREAT_POWER_WATER)} health, and burning allies are quenched. The mage casts it unbidden when the enemy bunches up. Recharges in ${secs(GREAT_CD)} s.`),
  };
}

export interface SpellBar {
  root: HTMLElement;
  /** `cremate(on)`: przełącznik „Palenie ciał” Maga Płomienia (main.ts wysyła rozkaz dla zaznaczonych magów ognia) */
  bind(source: () => { tick: number; mages: readonly Soldier[] } | null, act?: { cremate(on: boolean): void }): void;
}

// palenie ciał: leżąca postać i płomień nad nią
const PYRE_ICON = svg(`<rect width="40" height="40" fill="#2a0d05" opacity=".45"/>
  <path d="M6 31h28" stroke="#6b5136" stroke-width="3" stroke-linecap="round"/><path d="M8 34h24" stroke="#4a3624" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="22" cy="27" rx="10" ry="3.2" fill="#3a2d22"/><circle cx="10.5" cy="26.5" r="3" fill="#3a2d22"/>
  <path d="M20 26c-7 0-9-5-7-9 1 2 2 3 3 2-1-4 1-8 4-10 0 3 2 5 4 7 1-1 1-3 0-5 3 2 5 6 4 9-1 4-4 6-8 6z" fill="#ff7a1e"/>
  <path d="M20 26c-3 0-5-2-4-5 1 1 2 2 3 1 0-2 1-4 3-6 0 2 2 3 3 5 1 3-1 5-5 5z" fill="#ffe08a"/>`);

export function createSpellBar(): SpellBar {
  const root = document.createElement('div');
  root.className = 'spell-bar';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', tx('Czary magów', "Mages' spells"));
  root.hidden = true;
  const pairs = new Map<School, Pair>();
  let act: { cremate(on: boolean): void } | undefined;
  // przełącznik „Palenie ciał” (tylko przy magach ognia): wciśnięty, gdy wszyscy zaznaczeni magowie ognia palą ciała
  const pyre = document.createElement('button');
  pyre.type = 'button';
  pyre.className = 'spell-slot spell-toggle';
  pyre.innerHTML = PYRE_ICON;
  pyre.setAttribute('aria-pressed', 'false');
  const pyreText = { name: tx('Palenie ciał', 'Burn the dead'), tip: tx('Włączone: mag sam podchodzi do ciał w pobliżu (swoich i wrogich) i je pali — po chwili znikają. Wróg ma pierwszeństwo. Kliknij, żeby włączyć albo wyłączyć.', 'On: the mage walks to bodies nearby (yours and the enemy\'s) and burns them; soon they are gone. Foes come first. Click to turn on or off.') };
  pyre.setAttribute('aria-label', `${pyreText.name}. ${pyreText.tip}`);
  const pyreTip = (): void => showTip(pyre, tx('Przełącznik', 'Toggle'), { ...pyreText, icon: '' });
  pyre.addEventListener('mouseenter', pyreTip); pyre.addEventListener('focus', pyreTip);
  pyre.addEventListener('mouseleave', hideTip); pyre.addEventListener('blur', hideTip);
  pyre.addEventListener('click', () => act?.cremate(pyre.getAttribute('aria-pressed') !== 'true'));

  const slot = (s: School, great: boolean): Slot => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `spell-slot spell-${s}${great ? ' spell-great' : ''}`;
    el.innerHTML = ICON[s][great ? 'great' : 'normal'];
    const shade = document.createElement('span'); shade.className = 'spell-shade';
    const secs = document.createElement('span'); secs.className = 'spell-secs';
    const badge = document.createElement('span'); badge.className = 'spell-badge';
    el.append(shade, secs, badge);
    const tt = texts(s, great);
    el.setAttribute('aria-label', `${tt.name}. ${tt.tip}`);
    const group = great ? tx('Wielki czar', 'Great spell') : tx('Czar', 'Spell');
    const show = (): void => showTip(el, group, { ...tt, icon: '' });
    el.addEventListener('mouseenter', show); el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hideTip); el.addEventListener('blur', hideTip);
    return { el, shade, secs, badge, wasReady: true, last: -1 };
  };
  const pairOf = (s: School): Pair => {
    let p = pairs.get(s);
    if (!p) {
      const wrap = document.createElement('div');
      wrap.className = 'spell-pair';
      p = { wrap, normal: slot(s, false), great: slot(s, true) };
      wrap.append(p.normal.el, p.great.el);
      if (s === 'fire') wrap.append(pyre);
      root.append(wrap);
      pairs.set(s, p);
    }
    return p;
  };

  /** left: ile ticków do gotowości najszybszego maga, full: długość odnowienia, ready/total: ilu ma czar gotowy */
  const paint = (sl: Slot, left: number, full: number, ready: number, total: number): void => {
    const isReady = left <= 0;
    const frac = isReady ? 0 : Math.min(1, left / full);
    // nakładka jak zegar: ciemna część to brakujący czas, schodzi zgodnie ze wskazówkami
    const pct = Math.round(frac * 1000) / 10;
    if (pct !== sl.last) { sl.last = pct; sl.shade.style.background = pct > 0 ? `conic-gradient(rgba(8, 5, 2, .74) ${pct}%, transparent 0)` : 'none'; }
    const s = isReady ? '' : left >= 100 ? String(Math.ceil(left / 10)) : (left / 10).toFixed(1);
    if (sl.secs.textContent !== s) sl.secs.textContent = s;
    const b = total > 1 ? `${ready}/${total}` : '';
    if (sl.badge.textContent !== b) sl.badge.textContent = b;
    sl.el.classList.toggle('ready', isReady);
    // błysk w chwili rzutu (gotowy → odnowienie) i krótki rozbłysk, gdy znów gotowy
    if (sl.wasReady && !isReady && full > 0) { sl.el.classList.remove('cast'); void sl.el.offsetWidth; sl.el.classList.add('cast'); }
    if (!sl.wasReady && isReady) { sl.el.classList.remove('charged'); void sl.el.offsetWidth; sl.el.classList.add('charged'); }
    sl.wasReady = isReady;
  };

  let source: (() => { tick: number; mages: readonly Soldier[] } | null) | null = null;
  const frame = (): void => {
    requestAnimationFrame(frame);
    const v = source?.();
    const seen = new Set<School>();
    if (v) {
      for (const school of ['fire', 'water'] as const) {
        const kind = unitOf(school);
        const list = v.mages.filter((m) => m.kind === kind && m.hp > 0);
        if (!list.length) continue;
        seen.add(school);
        const def = UNITS[kind]!;
        const p = pairOf(school);
        p.wrap.hidden = false;
        let nLeft = Infinity, nReady = 0, gLeft = Infinity, gReady = 0;
        for (const m of list) {
          const n = Math.max(0, m.cd); nLeft = Math.min(nLeft, n); if (n === 0) nReady++;
          const gl = Math.max(0, (m.great ?? 0) - v.tick); gLeft = Math.min(gLeft, gl); if (gl === 0) gReady++;
        }
        paint(p.normal, nLeft, def.cooldown, nReady, list.length);
        if (school === 'fire') { const on = list.every((m) => m.cremate); if (pyre.getAttribute('aria-pressed') !== String(on)) pyre.setAttribute('aria-pressed', String(on)); }
        paint(p.great, gLeft, GREAT_CD, gReady, list.length);
      }
    }
    for (const [s, p] of pairs) if (!seen.has(s)) p.wrap.hidden = true;
    const show = seen.size > 0;
    if (root.hidden === show) root.hidden = !show;
  };
  requestAnimationFrame(frame);
  return { root, bind(src, a) { source = src; act = a; } };
}

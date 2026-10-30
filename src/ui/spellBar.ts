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

const svg = (body: string): string => `<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true" focusable="false">${body}</svg>`;
// ikony w kolorze (nie kreską jak rozkazy): ogień pomarańcz i żar, woda błękit i lód
const ICON: Record<School, { normal: string; great: string }> = {
  fire: {
    normal: svg(`<defs><radialGradient id="sbF1" cx="40%" cy="60%" r="60%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".35" stop-color="#ffc23a"/><stop offset=".75" stop-color="#e3561b"/><stop offset="1" stop-color="#7a1d08"/></radialGradient></defs>
      <path d="M30 6c-4 5-12 7-17 13" stroke="#e86a1e" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M33 11c-5 3-10 6-14 11" stroke="#ffb02e" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
      <circle cx="16" cy="25" r="10" fill="url(#sbF1)"/><circle cx="13" cy="23" r="3" fill="#fffbe0" opacity=".85"/>`),
    great: svg(`<defs><radialGradient id="sbF2" cx="45%" cy="55%" r="60%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#ff9c2a"/><stop offset="1" stop-color="#9a2508"/></radialGradient></defs>
      <rect x="0" y="0" width="40" height="40" fill="#2a0d05" opacity=".35"/>
      ${[[9, 9, 4], [21, 4, 5], [32, 12, 4]].map(([x, y, r]) => `<path d="M${x! - 5} ${y! - 9}L${x} ${y}" stroke="#ff8a2a" stroke-width="2.4" stroke-linecap="round" opacity=".75"/><circle cx="${x}" cy="${y! + 4}" r="${r}" fill="url(#sbF2)"/>`).join('')}
      <ellipse cx="20" cy="33" rx="15" ry="4.5" fill="none" stroke="#ff7a1e" stroke-width="2"/>
      <path d="M10 33c2-6 4-3 5-8 2 4 3 2 5-4 2 5 4 6 5 3 1 4 3 4 5 9z" fill="#ffb43a"/><path d="M15 33c1-3 3-2 4-5 1 3 2 3 4 1 0 2 1 3 2 4z" fill="#fff0a0"/>`),
  },
  water: {
    normal: svg(`<defs><linearGradient id="sbW1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6fbff"/><stop offset=".45" stop-color="#5fc3f0"/><stop offset="1" stop-color="#1b4f9a"/></linearGradient></defs>
      <path d="M6 30c5-3 8 2 13-1s7-9 14-7" stroke="#8fdcff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M20 4c5 7 10 12 10 18a10 10 0 0 1-20 0c0-6 5-11 10-18z" fill="url(#sbW1)"/><path d="M15 20c0-3 2-6 4-8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`),
    great: svg(`<rect x="0" y="0" width="40" height="40" fill="#06203a" opacity=".35"/>
      <ellipse cx="20" cy="28" rx="16" ry="7" fill="#bfeaff" opacity=".35" stroke="#9fe0ff" stroke-width="2"/>
      <g stroke="#e9fbff" stroke-width="2.2" stroke-linecap="round"><path d="M20 6v20M11 11l18 10M29 11L11 21"/>
      <path d="M17 8l3 3 3-3M17 24l3-3 3 3M10 15l4 0-1-4M30 15l-4 0 1-4M10 17l4 0-1 4M30 17l-4 0 1 4" fill="none" stroke-width="1.6"/></g>
      <circle cx="20" cy="16" r="2.6" fill="#5fc3f0"/>`),
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

export interface SpellBar { root: HTMLElement; bind(source: () => { tick: number; mages: readonly Soldier[] } | null): void }

export function createSpellBar(): SpellBar {
  const root = document.createElement('div');
  root.className = 'spell-bar';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', tx('Czary magów', "Mages' spells"));
  root.hidden = true;
  const pairs = new Map<School, Pair>();

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
        paint(p.great, gLeft, GREAT_CD, gReady, list.length);
      }
    }
    for (const [s, p] of pairs) if (!seen.has(s)) p.wrap.hidden = true;
    const show = seen.size > 0;
    if (root.hidden === show) root.hidden = !show;
  };
  requestAnimationFrame(frame);
  return { root, bind(src) { source = src; } };
}

/**
 * Panel dewelopera (F9): tylko w grze z botami w trybie deweloperskim albo testowym.
 * Stawianie jednostek kliknięciem na mapie (swoje albo wroga — każdy rodzaj wojska, z magami, i wilki),
 * pora dnia i roku, szybkie scenki, kamera do twierdz. Działa wprost na stanie gry — w grze przez sieć jest wyłączony.
 *
 * Układ (Michał 27.10.2026: „bardzo łatwe w poruszaniu się”): każdy przycisk ma ikonę i krótki podpis,
 * sekcje idą w kolejności użycia: kogo postawić → czyj → ilu → Stawiaj; potem czas, scenki, kamera.
 */
import { t, tx } from '../i18n';
import { UNITS } from '../data/units';

/** Rodzaj z UNITS (np. 'spearman', 'mageFire') albo wilk */
export type DevSpawn = string;
export interface DevEvents {
  /** Tryb stawiania: następne kliknięcie na mapie stawia `count` jednostek; null = wyłączony */
  onPlace(spawn: { kind: DevSpawn; foe: boolean; count: number } | null): void;
  onFoeAtTower(): void;
  /** Od razu kończy mecz wygraną (ekran końca z pokazem podsumowania PD) */
  onWin(): void;
  onSkip(to: 'night' | 'day'): void;
  onFire(): void;
  /** Ustawia porę roku (środek wybranej pory); zwraca opis pogody */
  onSeason(season: 'spring' | 'summer' | 'autumn' | 'winter'): string;
  onHeal(): void;
  onGive(): void;
  onCamera(which: 'mine' | 'foe'): void;
  onKillFoes(): void;
}

export interface DevPanel {
  toggle(): void;
  /** Stawianie się udało: przycisk zostaje włączony (można stawiać dalej), opis pokazuje, co postawiono */
  placed(text: string): void;
  isPlacing(): boolean;
  /** Kończy stawianie (panel zostaje otwarty) */
  stop(): void;
  close(): void;
  /** Panel jest teraz widoczny */
  isOpen(): boolean;
}

/** Proste ikony (viewBox 24, obrys w kolorze tekstu, wypełnienia akcentem) */
const I: Record<string, string> = {
  spearman: '<path d="M5 21 18 6"/><path d="m16 3 5 0 0 5-3-1z" fill="currentColor"/><path d="M4 16l4 4"/>',
  archer: '<path d="M6 3c8 3 8 15 0 18"/><path d="M6 3v18" stroke-dasharray="2 1.5"/><path d="M4 12h16"/><path d="m17 9 3 3-3 3"/>',
  guard: '<path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z"/><path d="M12 7v10M8 11h8"/>',
  manatarms: '<path d="M14 4l6-1-1 6-9 9"/><path d="m6 14 4 4M4 20l3-3"/>',
  bandit: '<path d="M4 9c3-2 13-2 16 0-1 4-3 6-8 6s-7-2-8-6z" fill="currentColor" fill-opacity=".25"/><circle cx="9" cy="10" r="1.3" fill="currentColor"/><circle cx="15" cy="10" r="1.3" fill="currentColor"/><path d="M8 18c2 1 6 1 8 0"/>',
  sapper: '<path d="M4 8c4-4 12-4 16 0"/><path d="M12 6v15"/>',
  ram: '<rect x="3" y="9" width="15" height="6" rx="1"/><path d="M18 10l3 2-3 2"/><circle cx="7" cy="18" r="2"/><circle cx="14" cy="18" r="2"/>',
  mageFire: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 1 3 2 4 1-3 0-6 1-9z" fill="#ff8a2a" fill-opacity=".85"/>',
  mageWater: '<path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="#5fb0ff" fill-opacity=".85"/>',
  wolf: '<circle cx="7" cy="8" r="1.8" fill="currentColor"/><circle cx="12" cy="6" r="1.8" fill="currentColor"/><circle cx="17" cy="8" r="1.8" fill="currentColor"/><path d="M7 16c0-4 3-6 5-6s5 2 5 6c0 3-3 3-5 2-2 1-5 1-5-2z" fill="currentColor"/>',
  foe: '<path d="M5 3v18"/><path d="M5 4h13l-3 4 3 4H5" fill="#c0392b"/>',
  mine: '<path d="M5 3v18"/><path d="M5 4h13l-3 4 3 4H5" fill="#3a78c9"/>',
  place: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="#ffd36a"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z" fill="#c9d6ff" fill-opacity=".8"/>',
  spring: '<circle cx="12" cy="10" r="2.2" fill="#ffd36a"/><path d="M12 5.5a2.5 2.5 0 1 1 0 0M7.5 10a2.5 2.5 0 1 1 0 0M16.5 10a2.5 2.5 0 1 1 0 0M12 14.5a2.5 2.5 0 1 1 0 0" /><path d="M12 13v8M12 18c-2-2-4-2-5-1"/>',
  summer: '<circle cx="12" cy="12" r="5" fill="#ffb93a"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  autumn: '<path d="M12 21v-6"/><path d="M12 15C5 14 4 7 6 3c3 2 5 1 6 0 1 1 3 2 6 0 2 4 1 11-6 12z" fill="#d9792b" fill-opacity=".85"/>',
  winter: '<path d="M12 2v20M3 7l18 10M3 17 21 7"/><path d="m9 3 3 2 3-2M9 21l3-2 3 2"/>',
  win: '<path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="#e8c766"/><path d="M7 6H4c0 3 1 4 3 4M17 6h3c0 3-1 4-3 4M12 13v4M8 21h8M9 17h6"/>',
  tower: '<path d="M7 21V9h10v12M6 9V5h2v2h2V5h4v2h2V5h2v4"/><path d="M10 21v-4h4v4"/><path d="m19 3 3 3" stroke="#c0392b"/>',
  fire: '<path d="M12 2c1 4 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 5 1-4 0-7 1-10z" fill="#ff7a1a"/>',
  heal: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" fill="#d23a3a"/><path d="M12 9v6M9 12h6" stroke="#fff"/>',
  give: '<path d="M8 6h8l-1-3H9zM6 9c0-2 2-3 6-3s6 1 6 3c2 3 3 6 3 8 0 3-4 4-9 4s-9-1-9-4c0-2 1-5 3-8z" fill="#c9a24a" fill-opacity=".85"/>',
  kill: '<path d="M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6h10c0-2 2-3 2-6a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10" r="1.6" fill="currentColor"/><circle cx="14.5" cy="10" r="1.6" fill="currentColor"/><path d="M9 16v4M12 16v4M15 16v4"/>',
  keepMine: '<path d="M4 21V9l3-2 3 2V5h4v4l3-2 3 2v12z" fill="#3a78c9" fill-opacity=".6"/><path d="M10 21v-5h4v5"/>',
  keepFoe: '<path d="M4 21V9l3-2 3 2V5h4v4l3-2 3 2v12z" fill="#c0392b" fill-opacity=".6"/><path d="M10 21v-5h4v5"/>',
};
const svg = (id: string, size = 22): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[id] ?? ''}</svg>`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Przycisk z ikoną i podpisem pod nią (kafelek) */
const tile = (icon: string, label: string, title = '', cls = 'dev-tile'): HTMLButtonElement => {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = svg(icon);
  b.append(el('span', '', label));
  if (title) b.title = title;
  return b;
};

/** Jednostki do stawiania: całe wojsko z UNITS (bez tych, których nie da się postawić z ręki), plus wilk */
const SPAWNS: readonly { id: DevSpawn; label: () => string }[] = [
  ...UNITS.filter((u) => u.id !== 'ram').map((u) => ({ id: u.id, label: () => t(u.name) })),
  { id: 'wolf', label: () => tx('Wilk', 'Wolf') },
];

export function createDevPanel(root: HTMLElement, ev: DevEvents): DevPanel {
  const box = el('div', 'panel devpanel');
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', tx('Panel dewelopera', 'Developer panel'));
  const head = el('div', 'dev-head');
  const close = el('button', 'dev-x', '×');
  close.type = 'button';
  close.title = tx('Zamknij (F9 albo Esc)', 'Close (F9 or Esc)');
  close.setAttribute('aria-label', tx('Zamknij panel dewelopera', 'Close developer panel'));
  head.append(el('p', 'info-name', tx('Panel dewelopera', 'Developer panel')), close);

  let kind: DevSpawn = 'spearman', foe = true, count = 3, placing = false;
  const status = el('p', 'dev-status', tx('Wybierz, kogo postawić, i kliknij „Stawiaj”, potem miejsce na mapie.', 'Choose who to place, click “Place”, then a spot on the map.'));
  status.setAttribute('aria-live', 'polite');
  const section = (title: string): HTMLElement => el('p', 'dev-sub', title);

  // 1. kogo: kafelki z ikoną każdego rodzaju wojska (z magami) i wilka
  const units = el('div', 'dev-grid dev-units');
  units.setAttribute('role', 'group');
  units.setAttribute('aria-label', tx('Kogo postawić', 'Who to place'));
  const unitBtns = SPAWNS.map((s) => {
    const b = tile(s.id, s.label(), '', 'dev-tile dev-pick');
    b.setAttribute('aria-pressed', String(s.id === kind));
    b.addEventListener('click', () => { kind = s.id; unitBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(SPAWNS[i]!.id === kind))); refresh(); });
    units.append(b);
    return b;
  });

  // 2. czyj i ilu — w jednym rzędzie
  const opts = el('div', 'dev-opts');
  const side = el('div', 'dev-seg');
  side.setAttribute('role', 'group');
  side.setAttribute('aria-label', tx('Czyje wojsko', 'Whose troops'));
  const sideBtns = ([[true, 'foe', tx('Wróg', 'Enemy')], [false, 'mine', tx('Mój', 'Mine')]] as const).map(([v, ico, label]) => {
    const b = tile(ico, label, '', 'dev-chip');
    b.setAttribute('aria-pressed', String(v === foe));
    b.addEventListener('click', () => { foe = v; sideBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(i === 0 ? foe : !foe))); refresh(); });
    side.append(b);
    return b;
  });
  const many = el('div', 'dev-seg');
  many.setAttribute('role', 'group');
  many.setAttribute('aria-label', tx('Ilu naraz', 'How many at once'));
  const nums = [1, 3, 6, 12];
  const numBtns = nums.map((n) => {
    const b = el('button', 'dev-chip dev-num', `×${n}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(n === count));
    b.addEventListener('click', () => { count = n; numBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(nums[i] === count))); refresh(); });
    many.append(b);
    return b;
  });
  opts.append(side, many);

  // 3. stawiaj
  const place = el('button', 'btn-main dev-place');
  place.type = 'button';
  place.setAttribute('aria-pressed', 'false');
  const refresh = (): void => {
    place.setAttribute('aria-pressed', String(placing));
    place.innerHTML = svg('place', 20);
    place.append(el('span', '', placing ? tx('Klikaj na mapie — Esc kończy', 'Click the map — Esc stops') : tx('Stawiaj na mapie', 'Place on map')));
    ev.onPlace(placing ? { kind, foe, count } : null);
  };
  place.addEventListener('click', () => { placing = !placing; refresh(); });

  const act = (icon: string, label: string, fn: () => void, title = ''): HTMLButtonElement => {
    const b = tile(icon, label, title);
    b.addEventListener('click', fn);
    return b;
  };

  // czas: pora dnia i pora roku w jednym rzędzie
  const time = el('div', 'dev-grid dev-time');
  time.append(
    act('sun', tx('Rano', 'Morning'), () => ev.onSkip('day'), tx('Przewiń do rana (7:00)', 'Skip to morning (7:00)')),
    act('moon', tx('Noc', 'Night'), () => ev.onSkip('night'), tx('Przewiń do zmierzchu — wilki wychodzą', 'Skip to dusk — wolves come out')),
  );
  for (const [id, label] of [['spring', tx('Wiosna', 'Spring')], ['summer', tx('Lato', 'Summer')], ['autumn', tx('Jesień', 'Autumn')], ['winter', tx('Zima', 'Winter')]] as const)
    time.append(act(id, label, () => { status.textContent = ev.onSeason(id); }, tx(`Przeskocz do środka pory: ${label.toLowerCase()}`, `Jump to mid-${label.toLowerCase()}`)));

  // scenki i pomoc
  const acts = el('div', 'dev-grid');
  acts.append(
    act('tower', tx('Wróg pod wieżą', 'Foe at tower'), () => { ev.onFoeAtTower(); status.textContent = tx('Trzech wrogich włóczników 6 pól od Twojej wieży z łucznikami.', 'Three enemy spearmen 6 tiles from your archer tower.'); }, tx('Sprawdzenie, czy wieża strzela', 'Checks that the tower shoots')),
    act('fire', tx('Pożar', 'Fire'), () => ev.onFire(), tx('Podpala Twój budynek najbliżej studni', 'Sets fire to your building nearest a well')),
    act('heal', tx('Ulecz moich', 'Heal mine'), () => { ev.onHeal(); status.textContent = tx('Wszyscy Twoi żołnierze mają pełne zdrowie.', 'All your soldiers are at full health.'); }),
    act('give', '+1000', () => { ev.onGive(); status.textContent = tx('Dodano po 1000 każdego zapasu.', 'Added 1000 of every good.'); }, tx('Po 1000 każdego zapasu', '1000 of every good')),
    act('kill', tx('Usuń wrogów', 'Clear foes'), () => { ev.onKillFoes(); status.textContent = tx('Wrogie wojsko i wilki usunięte.', 'Enemy army and wolves removed.'); }, tx('Usuwa wrogie wojsko i wilki', 'Removes the enemy army and wolves')),
    act('win', tx('Wygraj', 'Win'), () => ev.onWin(), tx('Od razu ekran zwycięstwa z pokazem podsumowania PD (w trybie deweloperskim PD się nie zapisuje)', 'Straight to the victory screen with the XP summary shown (developer mode saves no XP)')),
  );
  const cams = el('div', 'dev-grid dev-cams');
  cams.append(
    act('keepMine', tx('Moja twierdza', 'My keep'), () => ev.onCamera('mine'), tx('Kamera nad moją twierdzą', 'Camera over my keep')),
    act('keepFoe', tx('Twierdza wroga', 'Enemy keep'), () => ev.onCamera('foe'), tx('Kamera nad twierdzą wroga', 'Camera over the enemy keep')),
  );

  refresh();
  box.append(
    head,
    section(tx('Postaw wojsko', 'Place troops')), units, opts, place, status,
    section(tx('Czas', 'Time')), time,
    section(tx('Szybko', 'Quick')), acts,
    section(tx('Kamera', 'Camera')), cams,
  );
  root.append(box);
  const hide = (): void => { box.hidden = true; if (placing) { placing = false; refresh(); } };
  close.addEventListener('click', hide);
  return {
    toggle() { if (box.hidden) { box.hidden = false; place.focus(); } else hide(); },
    placed(text) { status.textContent = text; },
    isPlacing: () => placing,
    stop() { if (placing) { placing = false; refresh(); } },
    close: hide,
    isOpen: () => !box.hidden,
  };
}

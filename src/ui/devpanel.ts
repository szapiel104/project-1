/**
 * Panel dewelopera (F9): tylko w grze z botami w trybie deweloperskim albo testowym.
 * Stawianie jednostek kliknięciem na mapie (swoje albo wroga), wilki, szybkie scenki (wróg pod wieżą),
 * przewijanie czasu, kamera do twierdz. Działa wprost na stanie gry — w grze przez sieć jest wyłączony.
 */
import { t, tx } from '../i18n';

export type DevSpawn = 'spearman' | 'archer' | 'wolf';
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function createDevPanel(root: HTMLElement, ev: DevEvents): DevPanel {
  const box = el('div', 'panel devpanel');
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', tx('Panel dewelopera', 'Developer panel'));
  const head = el('div', 'dev-head');
  const close = el('button', 'dev-x', '×');
  close.type = 'button';
  close.setAttribute('aria-label', tx('Zamknij panel dewelopera', 'Close developer panel'));
  head.append(el('p', 'info-name', tx('Panel dewelopera', 'Developer panel')), close);

  let kind: DevSpawn = 'spearman', foe = true, count = 3, placing = false;
  const status = el('p', 'dev-status', tx('Wybierz, kogo postawić, i kliknij „Stawiaj”, potem miejsce na mapie.', 'Choose who to place, click “Place”, then a spot on the map.'));
  status.setAttribute('aria-live', 'polite');

  /** Grupa przycisków: jeden wybrany */
  const pick = <T>(label: string, items: [T, string][], now: T, set: (v: T) => void): HTMLElement => {
    const row = el('div', 'dev-row');
    row.append(el('span', 'army-label', label));
    const seg = el('div', 'army-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', label);
    const btns = items.map(([v, text]) => {
      const b = el('button', 'army-btn', text);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(v === now));
      b.addEventListener('click', () => { set(v); btns.forEach((x, i) => x.setAttribute('aria-pressed', String(items[i]![0] === v))); refresh(); });
      seg.append(b);
      return b;
    });
    row.append(seg);
    return row;
  };
  const place = el('button', 'btn-main dev-place', tx('Stawiaj na mapie', 'Place on map'));
  place.type = 'button';
  place.setAttribute('aria-pressed', 'false');
  const refresh = (): void => {
    place.setAttribute('aria-pressed', String(placing));
    place.textContent = placing ? tx('Stawianie włączone — kliknij na mapie (Esc kończy)', 'Placing on — click the map (Esc stops)') : tx('Stawiaj na mapie', 'Place on map');
    ev.onPlace(placing ? { kind, foe, count } : null);
  };
  place.addEventListener('click', () => { placing = !placing; refresh(); });

  const act = (text: string, fn: () => void, title = ''): HTMLButtonElement => {
    const b = el('button', 'dev-act', text);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  const acts = el('div', 'dev-acts');
  acts.append(
    act(tx('Wygraj mecz', 'Win the match'), () => ev.onWin(), tx('Od razu ekran zwycięstwa z pokazem podsumowania PD (w trybie deweloperskim PD się nie zapisuje)', 'Straight to the victory screen with the XP summary shown (developer mode saves no XP)')),
    act(tx('Wróg pod moją wieżą', 'Enemy at my tower'), () => { ev.onFoeAtTower(); status.textContent = tx('Trzech wrogich włóczników 6 pól od Twojej wieży z łucznikami.', 'Three enemy spearmen 6 tiles from your archer tower.'); }, tx('Sprawdzenie, czy wieża strzela', 'Checks that the tower shoots')),
    act(tx('Wywołaj pożar', 'Start a fire'), () => ev.onFire(), tx('Podpala Twój budynek najbliżej studni', 'Sets fire to your building nearest a well')),
    act(tx('Przewiń do nocy', 'Skip to night'), () => ev.onSkip('night'), tx('Wilki wychodzą o zmierzchu', 'Wolves come out at dusk')),
    act(tx('Przewiń do rana', 'Skip to morning'), () => ev.onSkip('day')),
    act(tx('Kamera: moja twierdza', 'Camera: my keep'), () => ev.onCamera('mine')),
    act(tx('Kamera: twierdza wroga', 'Camera: enemy keep'), () => ev.onCamera('foe')),
    act(tx('Ulecz moich', 'Heal mine'), () => { ev.onHeal(); status.textContent = tx('Wszyscy Twoi żołnierze mają pełne zdrowie.', 'All your soldiers are at full health.'); }),
    act(tx('+1000 wszystkiego', '+1000 of everything'), () => { ev.onGive(); status.textContent = tx('Dodano po 1000 każdego zapasu.', 'Added 1000 of every good.'); }),
    act(tx('Usuń wrogie wojsko', 'Remove enemy army'), () => { ev.onKillFoes(); status.textContent = tx('Wrogie wojsko i wilki usunięte.', 'Enemy army and wolves removed.'); }),
  );

  // pora roku: gra przeskakuje do środka wybranej pory (temperatura, dym, opał, nastroje)
  const seasons = el('div', 'dev-acts');
  for (const [id, label] of [['spring', tx('Wiosna', 'Spring')], ['summer', tx('Lato', 'Summer')], ['autumn', tx('Jesień', 'Autumn')], ['winter', tx('Zima', 'Winter')]] as const)
    seasons.append(act(label, () => { status.textContent = ev.onSeason(id); }, tx(`Przeskocz do środka pory: ${label.toLowerCase()}`, `Jump to mid-${label.toLowerCase()}`)));
  box.append(
    head,
    pick<DevSpawn>(tx('Kto', 'Who'), [['spearman', t('u.spearman')], ['archer', t('u.archer')], ['wolf', tx('Wilk', 'Wolf')]], kind, (v) => { kind = v; }),
    pick<boolean>(tx('Czyj', 'Whose'), [[true, tx('Wróg', 'Enemy')], [false, tx('Mój', 'Mine')]], foe, (v) => { foe = v; }),
    pick<number>(tx('Ilu', 'How many'), [[1, '1'], [3, '3'], [6, '6'], [12, '12']], count, (v) => { count = v; }),
    place, el('p', 'dev-sub', tx('Szybkie scenki', 'Quick scenes')), acts,
    el('p', 'dev-sub', tx('Pora roku', 'Season')), seasons, status,
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

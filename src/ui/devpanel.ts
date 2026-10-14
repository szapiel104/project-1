/**
 * Panel dewelopera (F9): tylko w grze z botami w trybie deweloperskim albo testowym.
 * Stawianie jednostek kliknięciem na mapie (swoje albo wroga), wilki, szybkie scenki (wróg pod wieżą),
 * przewijanie czasu, kamera do twierdz. Działa wprost na stanie gry — w grze przez sieć jest wyłączony.
 */
export type DevSpawn = 'spearman' | 'archer' | 'wolf';
export interface DevEvents {
  /** Tryb stawiania: następne kliknięcie na mapie stawia `count` jednostek; null = wyłączony */
  onPlace(spawn: { kind: DevSpawn; foe: boolean; count: number } | null): void;
  onFoeAtTower(): void;
  onSkip(to: 'night' | 'day'): void;
  onFire(): void;
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
  box.setAttribute('aria-label', 'Panel dewelopera');
  const head = el('div', 'dev-head');
  const close = el('button', 'dev-x', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Zamknij panel dewelopera');
  head.append(el('p', 'info-name', 'Panel dewelopera'), close);

  let kind: DevSpawn = 'spearman', foe = true, count = 3, placing = false;
  const status = el('p', 'dev-status', 'Wybierz, kogo postawić, i kliknij „Stawiaj”, potem miejsce na mapie.');
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
  const place = el('button', 'btn-main dev-place', 'Stawiaj na mapie');
  place.type = 'button';
  place.setAttribute('aria-pressed', 'false');
  const refresh = (): void => {
    place.setAttribute('aria-pressed', String(placing));
    place.textContent = placing ? 'Stawianie włączone — kliknij na mapie (Esc kończy)' : 'Stawiaj na mapie';
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
    act('Wróg pod moją wieżą', () => { ev.onFoeAtTower(); status.textContent = 'Trzech wrogich włóczników 6 pól od Twojej wieży z łucznikami.'; }, 'Sprawdzenie, czy wieża strzela'),
    act('Wywołaj pożar', () => ev.onFire(), 'Podpala Twój budynek najbliżej studni'),
    act('Przewiń do nocy', () => ev.onSkip('night'), 'Wilki wychodzą o zmierzchu'),
    act('Przewiń do rana', () => ev.onSkip('day')),
    act('Kamera: moja twierdza', () => ev.onCamera('mine')),
    act('Kamera: twierdza wroga', () => ev.onCamera('foe')),
    act('Ulecz moich', () => { ev.onHeal(); status.textContent = 'Wszyscy Twoi żołnierze mają pełne zdrowie.'; }),
    act('+1000 wszystkiego', () => { ev.onGive(); status.textContent = 'Dodano po 1000 każdego zapasu.'; }),
    act('Usuń wrogie wojsko', () => { ev.onKillFoes(); status.textContent = 'Wrogie wojsko i wilki usunięte.'; }),
  );

  box.append(
    head,
    pick<DevSpawn>('Kto', [['spearman', 'Włócznik'], ['archer', 'Łucznik'], ['wolf', 'Wilk']], kind, (v) => { kind = v; }),
    pick<boolean>('Czyj', [[true, 'Wróg'], [false, 'Mój']], foe, (v) => { foe = v; }),
    pick<number>('Ilu', [[1, '1'], [3, '3'], [6, '6'], [12, '12']], count, (v) => { count = v; }),
    place, el('p', 'dev-sub', 'Szybkie scenki'), acts, status,
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
  };
}

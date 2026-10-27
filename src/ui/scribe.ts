import { tx } from '../i18n';

/**
 * Skryba w lewym górnym rogu (przebudowa 27.10.2026): krótka wiadomość z kwadratowym portretem wysuwa się, chwilę
 * wisi i znika, a wszystkie wiadomości trafiają do kroniki — przycisk „Kronika” nad nimi otwiera listę ostatnich
 * (z godziną gry i przyciskiem „Pokaż”), więc można wrócić do 20 ostatnich (starsze wypadają).
 * Skryba mówi tylko o ważnych sprawach (braki, zagrożenia, awanse) — bez „świta dzień” / „zapada noc” (27.10.2026).
 * Ta sama wiadomość (ten sam klucz) nie powtarza się częściej niż raz na 3 minuty (pilna — raz na minutę).
 */
/** Doradca wojenny: wąsy, kapalin, kolczuga, w tle sztandar */
const HERALD = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <defs><linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1d16"/><stop offset="1" stop-color="#2e0b08"/></linearGradient></defs>
  <rect width="48" height="48" fill="url(#hb)"/>
  <path d="M5 48c1-12 9-16 19-16s18 4 19 16z" fill="#7c8088" stroke="#1c120a"/>
  <path d="M14 48c1-8 4-11 10-11s9 3 10 11z" fill="#a32a22" stroke="#1c120a" stroke-width=".8"/>
  <circle cx="24" cy="22" r="8.5" fill="#d9a877" stroke="#1c120a"/>
  <path d="M17 26c2 2 5 1 7 0c2 1 5 2 7 0" stroke="#6b4a2b" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M14 19c1-8 19-8 20 0z" fill="#5a5e66" stroke="#1c120a"/>
  <path d="M11 19.5h26" stroke="#5a5e66" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="21" cy="21.5" r=".9"/><circle cx="27" cy="21.5" r=".9"/>
</svg>`;

/** Skryba: kaptur, gęsie pióro */
const FACE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <defs><linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a2a"/><stop offset="1" stop-color="#22150a"/></linearGradient></defs>
  <rect width="48" height="48" fill="url(#sb)"/>
  <path d="M6 48c1-11 8-15 18-15s17 4 18 15z" fill="#5a3d6b" stroke="#1c120a"/>
  <circle cx="24" cy="21" r="9" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M14 19c0-9 20-9 20 0c-3-4-17-4-20 0z" fill="#7a3a2a" stroke="#1c120a"/>
  <path d="M20 27c2 1.5 6 1.5 8 0" stroke="#7a4a2c" fill="none"/>
  <path d="M37 46l7-23c-4 3-7 12-7 23z" fill="#f6ecd0" stroke="#1c120a" stroke-width=".8"/>
</svg>`;

/** Ikona kroniki: otwarta księga */
const BOOK = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z" fill="#e9c766" stroke="#2a1a0c" stroke-width="1.2"/><path d="M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z" fill="#f6ecd0" stroke="#2a1a0c" stroke-width="1.2"/><path d="M5 9h5M5 12h5M14 9h5M14 12h5" stroke="#8a6a26" stroke-width="1"/></svg>`;

export type Speaker = 'scribe' | 'herald';
/** Przycisk przy wiadomości (np. „Pokaż” — przenosi kamerę tam, gdzie coś się dzieje) */
export interface ScribeAction { label: string; run: () => void }
export interface Scribe { say(key: string, text: string, urgent?: boolean, who?: Speaker, action?: ScribeAction): void }

const NAMES = (): Record<Speaker, string> => ({ scribe: tx('Skryba Bartłomiej', 'Bartholomew the Scribe'), herald: tx('Wojewoda Mieszko', 'Mieszko the Voivode') });
/** Ile wiadomości pamięta kronika: 20 ostatnich, przy kolejnej najstarsza wypada */
const LOG_MAX = 20;

interface Entry { text: string; who: Speaker; urgent: boolean; action?: ScribeAction; when: string }

/** Jedna wiadomość: portret, kto mówi i kiedy, treść i ewentualny przycisk — ten sam wygląd w dymku i w kronice */
function card(e: Entry, cls: string): HTMLElement {
  const c = document.createElement('div');
  c.className = `${cls} by-${e.who}${e.urgent ? ' urgent' : ''}`;
  c.innerHTML = `<span class="scribe-face">${e.who === 'herald' ? HERALD : FACE}</span><span class="scribe-body"><span class="scribe-name"></span><span class="scribe-text"></span></span>`;
  const name = c.querySelector('.scribe-name')!;
  name.textContent = NAMES()[e.who];
  if (e.when) { const w = document.createElement('span'); w.className = 'scribe-when'; w.textContent = ` · ${e.when}`; name.append(w); }
  c.querySelector('.scribe-text')!.textContent = e.text;
  if (e.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scribe-go';
    btn.textContent = `${e.action.label} ▸`;
    const run = e.action.run;
    btn.addEventListener('click', () => run());
    c.querySelector('.scribe-body')!.append(btn);
  }
  return c;
}

/** `clock` podaje godzinę gry do kroniki (np. „dzień 3, 14:20”) */
export function createScribe(onSpeak: () => void, clock: () => string = () => ''): Scribe {
  const box = document.createElement('div');
  box.className = 'scribe';
  // przycisk kroniki: zawsze w tym samym miejscu, nad dymkami
  const logBtn = document.createElement('button');
  logBtn.type = 'button';
  logBtn.className = 'scribe-log-btn';
  logBtn.setAttribute('aria-expanded', 'false');
  logBtn.setAttribute('aria-controls', 'scribe-log');
  logBtn.innerHTML = `${BOOK}<span class="scribe-log-label"></span><span class="scribe-log-new" hidden></span>`;
  logBtn.querySelector('.scribe-log-label')!.textContent = tx('Kronika', 'Chronicle');
  logBtn.title = tx('Wszystkie wiadomości skryby i wojewody', 'Every message from the scribe and the voivode');
  const badge = logBtn.querySelector('.scribe-log-new') as HTMLElement;
  const toasts = document.createElement('div');
  toasts.className = 'scribe-toasts';
  toasts.setAttribute('role', 'status');
  toasts.setAttribute('aria-live', 'polite');
  box.append(logBtn, toasts);
  // kronika: lista ostatnich wiadomości, najnowsza na górze
  const log = document.createElement('section');
  log.className = 'scribe-log panel';
  log.id = 'scribe-log';
  log.hidden = true;
  log.setAttribute('aria-label', tx('Kronika skryby', "The scribe's chronicle"));
  const head = document.createElement('div');
  head.className = 'scribe-log-head';
  const title = document.createElement('p');
  title.className = 'scribe-log-title';
  title.textContent = tx('Kronika skryby', "The scribe's chronicle");
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'scribe-log-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', tx('Zamknij kronikę', 'Close the chronicle'));
  head.append(title, close);
  const list = document.createElement('div');
  list.className = 'scribe-log-list';
  const empty = document.createElement('p');
  empty.className = 'scribe-log-empty';
  empty.textContent = tx('Skryba jeszcze nic nie zapisał.', 'The scribe has written nothing yet.');
  log.append(head, list, empty);
  document.body.append(box, log);

  const entries: Entry[] = [];
  let unread = 0;
  const setUnread = (n: number): void => { unread = n; badge.hidden = !n; badge.textContent = String(n); };
  const open = (on: boolean): void => {
    log.hidden = !on;
    box.classList.toggle('log-open', on);
    logBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      list.replaceChildren(...entries.map((e) => card(e, 'scribe-entry')));
      empty.hidden = entries.length > 0;
      setUnread(0);
      close.focus();
    }
  };
  logBtn.addEventListener('click', () => open(log.hidden === true));
  close.addEventListener('click', () => { open(false); logBtn.focus(); });
  log.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); open(false); logBtn.focus(); } });

  const last = new Map<string, number>();
  // nowa wiadomość pojawia się na górze, starsze zjeżdżają niżej, bledną i znikają
  const show = (e: Entry): void => {
    entries.unshift(e);
    if (entries.length > LOG_MAX) entries.length = LOG_MAX;
    if (log.hidden !== true) { list.prepend(card(e, 'scribe-entry')); while (list.children.length > LOG_MAX) list.lastElementChild!.remove(); empty.hidden = true; }
    else setUnread(unread + 1);
    const c = card(e, 'scribe-card');
    for (const old of Array.from(toasts.children) as HTMLElement[]) {
      old.classList.add('older');
      setTimeout(() => old.classList.add('out'), 2500);
      setTimeout(() => old.remove(), 3100);
    }
    toasts.prepend(c);
    while (toasts.children.length > 3) toasts.lastElementChild!.remove();
    onSpeak();
    // wiadomość z przyciskiem zostaje dłużej (12 s), żeby zdążyć kliknąć; w kronice zostaje na zawsze
    const stay = e.action ? 12000 : 6500;
    setTimeout(() => c.classList.add('out'), stay);
    setTimeout(() => c.remove(), stay + 600);
  };
  return {
    say(key, text, urgent = false, who: Speaker = 'scribe', action?: ScribeAction) {
      const now = performance.now();
      if ((last.get(key) ?? -1e9) > now - (urgent ? 60000 : 180000)) return;
      last.set(key, now);
      show({ text, who, urgent, action, when: clock() });
    },
  };
}

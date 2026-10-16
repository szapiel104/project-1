import type { Member, RoomLink } from '../net/supa';
import { avatarSvg } from './avatars';

/**
 * Czat meczu przez sieć: wiadomości w lewym dolnym rogu, gasną po chwili.
 * Enter otwiera pole wpisywania, Enter wysyła, Esc zamyka. W pokoju (lobby) używany jest ten sam format wiadomości.
 */
export interface ChatLine { who: Member; text: string }

const MAX = 200;
export const cleanChat = (t: string): string => t.replace(/\s+/g, ' ').trim().slice(0, MAX);

export function chatLine(line: ChatLine, mine: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = mine ? 'chat-line mine' : 'chat-line';
  const sh = document.createElement('span');
  sh.className = 'net-shield';
  sh.innerHTML = avatarSvg(line.who.avatar, 16);
  const who = document.createElement('strong');
  who.textContent = `${line.who.nick}:`;
  const txt = document.createElement('span');
  txt.textContent = ` ${line.text}`; // textContent — żadnego HTML od innych graczy
  row.append(sh, who, txt);
  return row;
}

export interface GameChat {
  attach(link: RoomLink, self: Member): void;
  detach(): void;
  /** Otwiera pole wpisywania (Enter w grze) */
  open(): void;
  /** Wpis od gracza bez wysyłania (np. znacznik sojusznika na mapie) */
  note(who: Member, text: string, mine: boolean): void;
  readonly active: boolean;
}

export function createGameChat(root: HTMLElement, onSound: () => void): GameChat {
  const box = document.createElement('div');
  box.className = 'game-chat';
  box.hidden = true;
  const log = document.createElement('div');
  log.className = 'chat-log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  const form = document.createElement('form');
  form.className = 'chat-form';
  form.hidden = true;
  const input = document.createElement('input');
  input.maxLength = MAX;
  input.placeholder = 'Wiadomość do wszystkich — Enter wysyła, Esc zamyka';
  input.setAttribute('aria-label', 'Wiadomość czatu');
  input.autocomplete = 'off';
  form.append(input);
  box.append(log, form);
  root.append(box);

  let link: RoomLink | null = null;
  let self: Member | null = null;
  let off: (() => void) | null = null;
  const add = (line: ChatLine, mine: boolean): void => {
    const row = chatLine(line, mine);
    log.append(row);
    while (log.children.length > 8) log.firstElementChild!.remove();
    // wiadomość gaśnie po 12 s, chyba że czat jest otwarty
    setTimeout(() => row.classList.add('old'), 12_000);
  };
  const close = (): void => { form.hidden = true; box.classList.remove('open'); input.value = ''; input.blur(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = cleanChat(input.value);
    if (text && link && self) { link.send({ k: 'chat', who: self, text }); add({ who: self, text }, true); }
    close();
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // klawisze czatu nie sterują grą (Esc nie otwiera menu)
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  return {
    attach(l, me) {
      this.detach();
      link = l; self = me; box.hidden = false;
      off = l.on((m) => { if (m.k === 'chat' && m.who && typeof m.text === 'string') { add({ who: m.who, text: cleanChat(m.text) }, false); onSound(); } });
    },
    detach() { off?.(); off = null; link = null; box.hidden = true; close(); log.replaceChildren(); },
    open() { if (!link) return; form.hidden = false; box.classList.add('open'); input.focus(); },
    note(who, text, mine) { box.hidden = false; add({ who, text }, mine); },
    get active() { return !!link; },
  };
}

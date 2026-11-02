import { befriend, dropNotice, markRead, noticesNow, onNotices, unfriend, unread, type Notice } from '../net/social';
import { ago } from './friendsView';
import { avatarSvg } from './avatars';
import { tx } from '../i18n';

/**
 * Dzwoneczek z powiadomieniami w menu (Michał 2.11.2026): zaproszenia do znajomych (przyjmij / odrzuć), przyjęte
 * zaproszenia, zaproszenia do gry (dołącz), nowe uwagi testerów (dla administratora — przejście do uwag)
 * i zrobione uwagi (dla testera). Licznik nieprzeczytanych na dzwoneczku, lista na żywo.
 */
export interface BellActions {
  friends(tab: number): void;
  join(roomId: string): void;
  adminNotes(id?: number): void;
  myNotes(id?: number): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (text: string, onClick: () => void, cls: string): HTMLButtonElement => {
  const b = el('button', cls, text); b.type = 'button';
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
};
const BELL = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0"/></svg>';

export function createBell(go: BellActions): HTMLElement {
  const wrap = el('div', 'bell');
  const open = el('button', 'bell-btn'); open.type = 'button';
  open.setAttribute('aria-haspopup', 'true'); open.setAttribute('aria-expanded', 'false');
  const badge = el('span', 'bell-badge');
  open.innerHTML = BELL; open.append(badge);
  const panel = el('div', 'bell-panel'); panel.hidden = true;
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', tx('Powiadomienia', 'Notifications'));
  wrap.append(open, panel);

  const close = (): void => { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); };
  const leave = (f: () => void) => (): void => { close(); f(); };
  const text = (n: Notice): string => {
    switch (n.kind) {
      case 'friend_request': return tx(`${n.from_nick} chce zostać Twoim znajomym`, `${n.from_nick} wants to be your friend`);
      case 'friend_accept': return tx(`${n.from_nick} przyjął zaproszenie — jesteście znajomymi`, `${n.from_nick} accepted — you are now friends`);
      case 'invite': return tx(`${n.from_nick} zaprasza Cię do gry „${n.payload?.name ?? ''}”`, `${n.from_nick} invites you to the game “${n.payload?.name ?? ''}”`);
      case 'note': return tx(`Nowa uwaga od ${n.from_nick}: „${n.payload?.text ?? ''}”`, `New note from ${n.from_nick}: “${n.payload?.text ?? ''}”`);
      case 'note_done': return tx(`Twoja uwaga jest zrobiona: „${n.payload?.text ?? ''}”`, `Your note is done: “${n.payload?.text ?? ''}”`);
    }
  };
  const acts = (n: Notice): HTMLElement[] => {
    const id = n.from_id ?? '';
    switch (n.kind) {
      case 'friend_request': return [
        btn(tx('Przyjmij', 'Accept'), () => void befriend(id).then(() => dropNotice(n.id)), 'menu-btn btn-ok bell-act'),
        btn(tx('Odrzuć', 'Decline'), () => void unfriend(id).then(() => dropNotice(n.id)), 'menu-btn btn-danger bell-act'),
      ];
      case 'friend_accept': return [btn(tx('Znajomi', 'Friends'), leave(() => go.friends(0)), 'menu-btn bell-act')];
      case 'invite': return n.payload?.room ? [btn(tx('Dołącz', 'Join'), leave(() => { void dropNotice(n.id); go.join(n.payload!.room!); }), 'menu-btn btn-ok bell-act')] : [];
      case 'note': return [btn(tx('Przejdź do uwag', 'Open notes'), leave(() => go.adminNotes(n.payload?.note)), 'menu-btn bell-act')];
      case 'note_done': return [btn(tx('Moje uwagi', 'My notes'), leave(() => go.myNotes(n.payload?.note)), 'menu-btn bell-act')];
    }
  };
  const paint = (): void => {
    const k = unread();
    badge.textContent = k > 9 ? '9+' : String(k);
    badge.hidden = !k;
    open.setAttribute('aria-label', k ? tx(`Powiadomienia: ${k} nowych`, `Notifications: ${k} new`) : tx('Powiadomienia', 'Notifications'));
    if (panel.hidden) return;
    const list = noticesNow();
    const head = el('div', 'bell-head');
    head.append(el('strong', '', tx('Powiadomienia', 'Notifications')), btn(tx('Znajomi', 'Friends'), leave(() => go.friends(0)), 'link-btn'));
    const ul = el('ul', 'bell-list');
    if (!list.length) ul.append(el('li', 'bell-empty', tx('Nic nowego.', 'Nothing new.')));
    for (const n of list) {
      const li = el('li', n.read ? 'bell-item' : 'bell-item new');
      const av = el('span', 'net-shield'); av.innerHTML = avatarSvg(n.from_avatar, 30);
      const body = el('div', 'bell-body');
      body.append(el('span', 'bell-text', text(n)), el('span', 'bell-when', ago(n.created_at)));
      const row = el('div', 'bell-acts'); row.append(...acts(n), btn('✕', () => void dropNotice(n.id), 'link-btn bell-x'));
      (row.lastChild as HTMLElement).setAttribute('aria-label', tx('Usuń powiadomienie', 'Remove notification'));
      body.append(row);
      li.append(av, body);
      ul.append(li);
    }
    panel.replaceChildren(head, ul);
  };
  open.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    open.setAttribute('aria-expanded', String(!panel.hidden));
    paint();
    if (!panel.hidden) setTimeout(() => void markRead(), 1500);
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target as Node)) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); open.focus(); } });
  onNotices(paint);
  paint();
  return wrap;
}

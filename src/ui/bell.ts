import { NOTICE_DAYS, befriend, dropNotice, markRead, noticesNow, onNotices, unfriend, unread, type Notice } from '../net/social';
import { ago } from './friendsView';
import { avatarSvg } from './avatars';
import { tx } from '../i18n';
import { noticeText } from './noticeText';

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
  /** Profil gracza (z aktywności znajomych) */
  profile(id: string): void;
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
  const text = noticeText;
  const acts = (n: Notice): HTMLElement[] => {
    const id = n.from_id ?? '';
    switch (n.kind) {
      case 'friend_request': return [
        btn(tx('Przyjmij', 'Accept'), () => void befriend(id).then(() => dropNotice(n.id)), 'menu-btn btn-ok bell-act'),
        btn(tx('Odrzuć', 'Decline'), () => void unfriend(id).then(() => dropNotice(n.id)), 'menu-btn btn-danger bell-act'),
      ];
      case 'friend_accept': return [btn(tx('Znajomi', 'Friends'), leave(() => go.friends(0)), 'menu-btn bell-act')];
      case 'invite': return n.payload?.room ? [btn(tx('Dołącz', 'Join'), leave(() => go.join(n.payload!.room!)), 'menu-btn btn-ok bell-act')] : [];
      case 'note': return [btn(tx('Przejdź do uwag', 'Open notes'), leave(() => go.adminNotes(n.payload?.note)), 'menu-btn bell-act')];
      case 'note_done': return [btn(tx('Moje uwagi', 'My notes'), leave(() => go.myNotes(n.payload?.note)), 'menu-btn bell-act')];
      case 'friend_match': case 'friend_level': case 'friend_badge': return n.from_id ? [btn(tx('Profil', 'Profile'), leave(() => go.profile(n.from_id!)), 'menu-btn bell-act')] : [];
    }
  };
  /** Nieprzeczytane w chwili otwarcia — zostają wyróżnione, dopóki okno jest otwarte (choć już oznaczone w bazie) */
  let fresh = new Set<number>();
  const item = (n: Notice, isNew: boolean): HTMLElement => {
    const li = el('li', isNew ? 'bell-item new' : 'bell-item');
    const av = el('span', 'net-shield'); av.innerHTML = avatarSvg(n.from_avatar, 30);
    const body = el('div', 'bell-body');
    const top = el('div', 'bell-top');
    if (isNew) { const dot = el('span', 'bell-dot'); dot.title = tx('Nowe', 'New'); top.append(dot); }
    top.append(el('span', 'bell-text', text(n)));
    body.append(top, el('span', 'bell-when', (isNew ? tx('nowe · ', 'new · ') : '') + ago(n.created_at)));
    const row = el('div', 'bell-acts'); row.append(...acts(n), btn('✕', () => void dropNotice(n.id), 'link-btn bell-x'));
    (row.lastChild as HTMLElement).setAttribute('aria-label', tx('Usuń powiadomienie', 'Remove notification'));
    body.append(row);
    li.append(av, body);
    return li;
  };
  const paint = (): void => {
    const k = unread();
    badge.textContent = k > 9 ? '9+' : String(k);
    badge.hidden = !k;
    open.setAttribute('aria-label', k ? tx(`Powiadomienia: ${k} nowych`, `Notifications: ${k} new`) : tx('Powiadomienia', 'Notifications'));
    if (panel.hidden) return;
    const list = noticesNow();
    const isNew = (n: Notice): boolean => !n.read || fresh.has(n.id);
    const news = list.filter(isNew);
    const old = list.filter((n) => !isNew(n));
    const head = el('div', 'bell-head');
    const ht = el('strong', '', tx('Powiadomienia', 'Notifications'));
    if (news.length) ht.append(el('span', 'bell-count', String(news.length)));
    head.append(ht, btn(tx('Znajomi', 'Friends'), leave(() => go.friends(0)), 'link-btn'));
    const box = el('div', 'bell-scroll');
    if (!list.length) box.append(el('p', 'bell-empty', tx(`Brak powiadomień z ostatnich ${NOTICE_DAYS} dni.`, `No notifications from the last ${NOTICE_DAYS} days.`)));
    const section = (title: string, rows: Notice[], nw: boolean): void => {
      if (!rows.length) return;
      box.append(el('h4', 'bell-sec', title));
      const ul = el('ul', 'bell-list');
      for (const n of rows) ul.append(item(n, nw));
      box.append(ul);
    };
    section(tx('Nowe', 'New'), news, true);
    section(tx(`Wcześniej · ostatnie ${NOTICE_DAYS} dni`, `Earlier · last ${NOTICE_DAYS} days`), old, false);
    panel.replaceChildren(head, box);
  };
  open.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    open.setAttribute('aria-expanded', String(!panel.hidden));
    fresh = new Set(noticesNow().filter((n) => !n.read).map((n) => n.id));
    paint();
    if (!panel.hidden) setTimeout(() => void markRead(), 1500);
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target as Node)) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); open.focus(); } });
  onNotices(paint);
  paint();
  return wrap;
}

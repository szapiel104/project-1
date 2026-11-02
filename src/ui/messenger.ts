import { conversation, conversations, markRead, onMessage, onMessages, sendMessage, unreadAll, unreadFrom, type Message } from '../net/messages';
import { friendLists, playerById, type Player } from '../net/social';
import { me, onlinePlayers, onPresence } from '../net/supa';
import { ago } from './friendsView';
import { avatarSvg } from './avatars';
import { lang, tx } from '../i18n';

/**
 * Wiadomości jak w Messengerze (Michał 2.11.2026): ikonka dymka na belce obok dzwoneczka z licznikiem nieprzeczytanych,
 * pod nią lista rozmów, a rozmowa otwiera się w okienku w prawym dolnym rogu — nad menu i nad grą, bez wychodzenia
 * z tego, co się robi. Do trzech okienek naraz; okienko można zwinąć do paska i zamknąć.
 */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (text: string, run: () => void, cls: string, label?: string): HTMLButtonElement => {
  const b = el('button', cls, text); b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => { e.stopPropagation(); run(); });
  return b;
};
const crest = (avatar: number, size: number): HTMLElement => { const s = el('span', 'net-shield'); s.innerHTML = avatarSvg(avatar, size); return s; };
const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.6 3.1 6.1L5.5 21l4-2.1c.8.2 1.6.3 2.5.3 5 0 9-3.6 9-8.1S17 3 12 3z"/><path d="M7.5 12.5l3-3 2.5 2.2 3.5-3.2"/></svg>';
const time = (iso: string): string => new Date(iso).toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string): string => new Date(iso).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------------- okienka rozmów w prawym dolnym rogu ----------------
const MAX_WIN = 3;
let dock: HTMLElement | null = null;
const wins = new Map<string, { node: HTMLElement; add(m: Message): void; min: boolean; setMin(v: boolean): void }>();
const dockEl = (): HTMLElement => {
  if (!dock) { dock = el('div', 'mx-dock'); dock.setAttribute('aria-label', tx('Rozmowy', 'Conversations')); document.body.append(dock); }
  return dock;
};
/** Czy rozmowa z tym graczem jest teraz otwarta i rozwinięta (wtedy bez okienka powiadomienia) */
export const chatOpenWith = (id: string): boolean => { const w = wins.get(id); return !!w && !w.min; };

export function openChat(id: string, known?: Player): void {
  const had = wins.get(id);
  if (had) { had.setMin(false); (had.node.querySelector('textarea') as HTMLTextAreaElement | null)?.focus(); return; }
  if (wins.size >= MAX_WIN) { const first = wins.keys().next().value as string; wins.get(first)?.node.remove(); wins.delete(first); }
  const node = el('section', 'mx-win');
  node.dataset.with = id;
  node.setAttribute('role', 'dialog');
  const head = el('header', 'mx-head');
  const who = el('div', 'mx-who');
  const nick = el('strong', 'mx-nick', known?.nick ?? '…');
  const state = el('span', 'mx-state');
  const av = el('span', 'mx-av');
  who.append(av, el('span', 'mx-names'));
  (who.lastChild as HTMLElement).append(nick, state);
  const paintWho = (p: Player | null): void => {
    const o = onlinePlayers().find((x) => x.id === id);
    av.replaceChildren(crest(o?.avatar ?? p?.avatar ?? 0, 30), el('span', `mx-dot ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`));
    nick.textContent = p?.nick ?? nick.textContent;
    state.textContent = o ? (o.where === 'menu' ? tx('dostępny', 'online') : tx('w grze', 'in game')) : p?.last_seen ? tx(`był ${ago(p.last_seen)}`, `seen ${ago(p.last_seen)}`) : tx('offline', 'offline');
    node.setAttribute('aria-label', tx(`Rozmowa z ${nick.textContent}`, `Chat with ${nick.textContent}`));
  };
  let player: Player | null = known ?? null;
  paintWho(player);
  if (!player) void playerById(id).then((p) => { player = p; paintWho(p); });
  const offP = onPresence(() => paintWho(player));
  const minB = btn('–', () => w.setMin(!w.min), 'mx-hbtn', tx('Zwiń', 'Minimise'));
  const closeB = btn('✕', () => close(), 'mx-hbtn', tx('Zamknij rozmowę', 'Close chat'));
  head.append(who, minB, closeB);
  head.addEventListener('click', () => { if (w.min) w.setMin(false); });
  const log = el('div', 'mx-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  const err = el('p', 'mx-err'); err.setAttribute('role', 'status');
  const form = el('form', 'mx-form');
  const input = el('textarea', 'mx-input'); input.rows = 1; input.maxLength = 1000;
  input.placeholder = tx('Aa', 'Aa');
  input.setAttribute('aria-label', tx('Wiadomość', 'Message'));
  const send = el('button', 'mx-send'); send.type = 'submit'; send.setAttribute('aria-label', tx('Wyślij', 'Send'));
  send.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M3 20l18-8L3 4l2 7 9 1-9 1z"/></svg>';
  form.append(input, send);
  node.append(head, log, err, form);
  const meId = me()?.id;
  let lastDay = '';
  let lastFrom = '';
  const add = (m: Message, pending = false): HTMLElement => {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { lastDay = day; lastFrom = ''; log.append(el('div', 'mx-day', dayOf(m.created_at))); }
    const mine = m.from_id === meId;
    const b = el('div', `mx-msg ${mine ? 'mine' : 'theirs'}${lastFrom === m.from_id ? ' cont' : ''}${pending ? ' pending' : ''}`);
    b.append(el('span', 'mx-body', m.body));
    b.title = time(m.created_at);
    b.append(el('span', 'mx-time', time(m.created_at)));
    lastFrom = m.from_id;
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return b;
  };
  const go = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; fit(); err.textContent = '';
    const b = add({ id: -Date.now(), from_id: meId ?? '', to_id: id, body: text, read: false, created_at: new Date().toISOString() }, true);
    const r = await sendMessage(id, text);
    if (typeof r === 'string') { b.classList.add('failed'); err.textContent = r; input.value = text; fit(); return; }
    b.classList.remove('pending');
  };
  const fit = (): void => { input.style.height = 'auto'; input.style.height = `${Math.min(120, input.scrollHeight)}px`; };
  input.addEventListener('input', fit);
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } if (e.key === 'Escape') { e.preventDefault(); w.setMin(true); } });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  form.addEventListener('submit', (e) => { e.preventDefault(); void go(); });
  const w = {
    node, min: false,
    add: (m: Message) => { add(m); if (!w.min) void markRead(id); else node.classList.add('unread'); },
    setMin: (v: boolean) => { w.min = v; node.classList.toggle('min', v); minB.textContent = v ? '▴' : '–'; if (!v) { node.classList.remove('unread'); void markRead(id); log.scrollTop = log.scrollHeight; input.focus(); } },
  };
  const close = (): void => { offP(); node.remove(); wins.delete(id); };
  wins.set(id, w);
  dockEl().append(node);
  log.append(el('p', 'mx-note', tx('Wczytuję…', 'Loading…')));
  void conversation(id).then((ms) => {
    log.replaceChildren();
    if (typeof ms === 'string') { log.append(el('p', 'mx-note', ms)); return; }
    if (!ms.length) log.append(el('p', 'mx-note', tx('Napisz pierwszą wiadomość 👋', 'Write the first message 👋')));
    for (const m of ms) add(m);
    void markRead(id);
  });
  setTimeout(() => input.focus(), 0);
}

// nowa wiadomość: dopisz do otwartego okienka (albo zaznacz zwinięte)
if (typeof window !== 'undefined') onMessage((m) => wins.get(m.from_id)?.add(m));

// ---------------- ikonka na belce i lista rozmów ----------------
export function createMessengerButton(openPanel: () => void): HTMLElement {
  const wrap = el('div', 'bell mx-top');
  const open = el('button', 'bell-btn'); open.type = 'button';
  open.setAttribute('aria-haspopup', 'true'); open.setAttribute('aria-expanded', 'false');
  open.innerHTML = ICON;
  const badge = el('span', 'bell-badge'); open.append(badge);
  const panel = el('div', 'bell-panel mx-panel'); panel.hidden = true;
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', tx('Wiadomości', 'Messages'));
  wrap.append(open, panel);
  const close = (): void => { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); };
  const paintBadge = (): void => {
    const n = unreadAll();
    badge.textContent = n > 9 ? '9+' : String(n); badge.hidden = !n;
    open.setAttribute('aria-label', n ? tx(`Wiadomości: ${n} nowych`, `Messages: ${n} new`) : tx('Wiadomości', 'Messages'));
  };
  let q = '';
  const paintList = async (): Promise<void> => {
    const head = el('div', 'bell-head');
    head.append(el('strong', '', tx('Wiadomości', 'Messages')), btn(tx('Znajomi', 'Friends'), () => { close(); openPanel(); }, 'link-btn'));
    const search = el('input', 'mx-search'); search.type = 'search'; search.placeholder = tx('Szukaj znajomego…', 'Search a friend…'); search.value = q;
    search.setAttribute('aria-label', tx('Szukaj znajomego', 'Search a friend'));
    const ul = el('ul', 'mx-list');
    panel.replaceChildren(head, search, ul);
    ul.append(el('li', 'bell-empty', tx('Wczytuję…', 'Loading…')));
    const [l, last] = await Promise.all([friendLists(), conversations()]);
    const meId = me()?.id;
    const draw = (): void => {
      const t = q.trim().toLowerCase();
      const ps = l.friends.filter((p) => !t || p.nick.toLowerCase().includes(t))
        .sort((a, b) => (last.get(b.id)?.created_at ?? '').localeCompare(last.get(a.id)?.created_at ?? '') || a.nick.localeCompare(b.nick, 'pl'));
      ul.replaceChildren();
      if (!l.friends.length) { ul.append(el('li', 'bell-empty', tx('Pisać można do znajomych — dodaj kogoś w panelu „Znajomi”.', 'You can message friends — add someone in the “Friends” panel.'))); return; }
      for (const p of ps) {
        const m = last.get(p.id), n = unreadFrom(p.id), o = onlinePlayers().find((x) => x.id === p.id);
        const li = el('li');
        const b = btn('', () => { close(); openChat(p.id, p); }, `mx-row${n ? ' hot' : ''}`);
        const av = el('span', 'mx-av'); av.append(crest(o?.avatar ?? p.avatar, 40), el('span', `mx-dot ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`));
        const txt = el('span', 'mx-row-txt');
        txt.append(el('strong', '', p.nick), el('span', 'mx-row-last', m ? `${m.from_id === meId ? tx('Ty: ', 'You: ') : ''}${m.body}` : tx('Napisz pierwszą wiadomość', 'Write the first message')));
        b.append(av, txt, el('span', 'mx-row-when', m ? ago(m.created_at) : ''));
        if (n) b.append(el('span', 'fr-conv-n', String(n)));
        li.append(b); ul.append(li);
      }
    };
    search.addEventListener('input', () => { q = search.value; draw(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    draw();
    search.focus();
  };
  open.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    open.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) void paintList();
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target as Node)) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); open.focus(); } });
  onMessages(() => { paintBadge(); if (!panel.hidden && !panel.contains(document.activeElement)) void paintList(); });
  paintBadge();
  return wrap;
}

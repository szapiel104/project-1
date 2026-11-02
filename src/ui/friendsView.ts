import { befriend, friendLists, noticesNow, onNotices, recentPlayers, searchPlayers, statsOf, unfriend, type FriendLists, type Notice, type Player, type Stats } from '../net/social';
import { conversation, conversations, markRead, onMessage, onMessages, sendMessage, unreadAll, unreadFrom, type Message } from '../net/messages';
import { profileCard } from './playerProfile';
import { me, onlinePlayers, type OnlinePlayer } from '../net/supa';
import { levelOf, titleOf } from '../data/progress';
import { noticeText } from './noticeText';
import { lang, tx } from '../i18n';

/**
 * Znajomi — duży panel jak na Steamie (Michał 2.11.2026: „ogromny panel do zarządzania znajomymi, kafelki, duży herb,
 * poziom, mecze, statystyki, aktywność znajomych, wszystko płynnie”).
 *
 * Zakładki: Znajomi (kafelki z filtrem, sortowaniem i stronami), Aktywność (wygrane, porażki i nowe poziomy znajomych),
 * Zaproszenia (przyjmij / odrzuć / cofnij), Szukaj graczy (po nicku i ostatnio aktywni). Profil gracza: herb, tytuł,
 * poziom, statystyki, odznaki i ostatnie mecze. Przyciski zmieniają się od razu (bez czekania na bazę); gdy baza
 * odmówi, wracają i pokazują powód.
 */
export interface FriendsDeps {
  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K];
  button(text: string, onClick: () => void, cls?: string): HTMLButtonElement;
  shield(avatar: number, size: number): HTMLElement;
  /** Dołącz do pokoju, w którym czeka znajomy */
  join(roomId: string): void;
  /** Załóż pokój i zaproś do niego znajomego */
  invite(p: Player): Promise<string | null>;
}

/** „5 min temu”, „2 godz. temu”, „3 dni temu” */
export function ago(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const en = lang() === 'en';
  if (s < 90) return en ? 'a moment ago' : 'przed chwilą';
  if (s < 3600) return en ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 60)} min temu`;
  if (s < 86400) return en ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 3600)} godz. temu`;
  const d = Math.round(s / 86400);
  return en ? `${d} day${d === 1 ? '' : 's'} ago` : d === 1 ? 'wczoraj' : `${d} dni temu`;
}

/** Gdzie jest gracz teraz albo kiedy był/grał ostatnio */
export function whereText(p: Player, o: OnlinePlayer | undefined): string {
  if (o) {
    if (o.where === 'room') return tx(`czeka w pokoju „${o.roomName ?? ''}”`, `waiting in room “${o.roomName ?? ''}”`);
    if (o.where === 'game') return tx('gra mecz przez sieć', 'playing an online match');
    if (o.where === 'solo') return tx('gra z botami', 'playing against bots');
    return tx('w menu — można zaprosić', 'in the menu — invite them');
  }
  const parts: string[] = [];
  if (p.last_seen) parts.push(tx(`był ${ago(p.last_seen)}`, `seen ${ago(p.last_seen)}`));
  if (p.last_played) parts.push(tx(`grał ${ago(p.last_played)}`, `played ${ago(p.last_played)}`));
  return parts.join(' · ') || tx('jeszcze nie grał', 'not played yet');
}

const PER_PAGE = 12;
const ACTIVITY = new Set<Notice['kind']>(['friend_match', 'friend_level', 'friend_accept', 'friend_badge']);

export function friendsView(d: FriendsDeps, startTab = 0, startProfile?: string, startChat?: string): { node: HTMLElement; redraw(): void; stop(): void } {
  const { el, button } = d;
  const wrap = el('div', 'net-friends friends-steam');
  const summary = el('div', 'fr-summary');
  const nav = el('div', 'menu-nav friends-tabs'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', tx('Znajomi', 'Friends'));
  const pane = el('div', 'friends-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = `friends-pane-${Math.random().toString(36).slice(2, 6)}`;
  const note = el('p', 'net-msg fr-note'); note.setAttribute('role', 'status');
  const say = (t: string, bad = false): void => { note.textContent = t; note.classList.toggle('bad', bad); };
  let tab = startTab;
  let profileOf: string | null = startProfile ?? null;
  let lists: FriendLists = { friends: [], incoming: [], outgoing: [] };
  let stats = new Map<string, Stats>();
  const tabBtns: HTMLButtonElement[] = [];
  const TABS = 5;
  // zakładki: 0 znajomi, 1 wiadomości, 2 aktywność, 3 zaproszenia, 4 szukaj
  let chatWith: string | null = startChat ?? null;
  if (startChat) tab = 1;
  for (let i = 0; i < TABS; i++) {
    const b = button('', () => { tab = i; profileOf = null; chatWith = null; page = 0; paint(true); }, 'menu-tab');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
    tabBtns.push(b); nav.append(b);
  }
  wrap.append(summary, nav, note, pane);

  // ---------- wspólne kawałki ----------
  const online = (id: string): OnlinePlayer | undefined => onlinePlayers().find((x) => x.id === id);
  const levelOfP = (id: string): number => stats.get(id)?.level ?? levelOf(stats.get(id)?.xp ?? 0).level;
  const relation = (id: string): 'friend' | 'out' | 'in' | 'none' => lists.friends.some((x) => x.id === id) ? 'friend' : lists.outgoing.some((x) => x.id === id) ? 'out' : lists.incoming.some((x) => x.id === id) ? 'in' : 'none';
  /** Przycisk z natychmiastową zmianą: od razu nowy napis, akcja w tle, przy błędzie powrót */
  const quick = (label: string, done: string, run: () => Promise<string | null | void>, cls: string, after?: () => void): HTMLButtonElement => {
    const b = button(label, () => {
      b.disabled = true; b.textContent = done; b.classList.add('fr-done');
      void run().then((e) => {
        if (e) { b.disabled = false; b.textContent = label; b.classList.remove('fr-done'); say(e, true); return; }
        after?.();
      });
    }, cls);
    return b;
  };
  /** Usuwanie z potwierdzeniem drugim kliknięciem */
  const confirmBtn = (label: string, sure: string, run: () => void, cls = 'menu-btn btn-danger fr-btn'): HTMLButtonElement => {
    let armed = false;
    const b = button(label, () => {
      if (!armed) { armed = true; b.textContent = sure; setTimeout(() => { armed = false; if (b.isConnected && !b.disabled) b.textContent = label; }, 3500); return; }
      b.disabled = true; run();
    }, cls);
    return b;
  };
  const move = (p: Player, to: 'friends' | 'outgoing' | 'none'): void => {
    lists = { friends: lists.friends.filter((x) => x.id !== p.id), incoming: lists.incoming.filter((x) => x.id !== p.id), outgoing: lists.outgoing.filter((x) => x.id !== p.id) };
    if (to !== 'none') lists[to] = [...lists[to], p];
    paintTabs();
  };
  const statusDot = (p: Player): HTMLElement => {
    const o = online(p.id);
    const s = el('span', `fr-status ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`);
    s.append(el('span', 'fr-dot'), el('span', '', o ? (o.where === 'menu' ? tx('dostępny', 'online') : tx('w grze', 'in game')) : tx('offline', 'offline')));
    return s;
  };

  /** Kafelek gracza: duży herb, nick, tytuł i poziom, gdzie jest, krótkie statystyki i działania */
  const tile = (p: Player, acts: HTMLElement[]): HTMLElement => {
    const o = online(p.id);
    const t = el('article', `fr-tile${o ? (o.where === 'menu' ? ' on' : ' busy') : ''}`);
    const crest = el('button', 'fr-crest');
    crest.type = 'button';
    crest.setAttribute('aria-label', tx(`Profil: ${p.nick}`, `Profile: ${p.nick}`));
    crest.append(d.shield(o?.avatar ?? p.avatar, 76));
    const lv = levelOfP(p.id);
    const badge = el('span', 'fr-lvl', String(lv)); badge.title = tx(`Poziom ${lv}`, `Level ${lv}`);
    crest.append(badge);
    crest.addEventListener('click', () => openProfile(p.id));
    const info = el('div', 'fr-info');
    const name = el('button', 'fr-name', p.nick); name.type = 'button'; name.addEventListener('click', () => openProfile(p.id));
    info.append(name, el('span', 'fr-title', `${titleOf(lv)} · ${tx('poziom', 'level')} ${lv}`), statusDot(p), el('span', 'fr-where', whereText(p, o)));
    const st = stats.get(p.id);
    if (st && st.matches) info.append(el('span', 'fr-mini', tx(`${st.wins} wygranych z ${st.matches} · ${st.kills} wrogów`, `${st.wins} wins of ${st.matches} · ${st.kills} foes`)));
    const row = el('div', 'fr-acts'); row.append(...acts);
    t.append(crest, info, row);
    return t;
  };
  const grid = (items: HTMLElement[], empty: string): HTMLElement[] => {
    if (!items.length) return [el('p', 'net-msg fr-empty', empty)];
    const g = el('div', 'fr-grid'); g.append(...items);
    return [g];
  };
  const pager = (total: number, redraw: () => void): HTMLElement | null => {
    const pages = Math.ceil(total / PER_PAGE);
    if (pages <= 1) return null;
    const nav2 = el('nav', 'notes-pager'); nav2.setAttribute('aria-label', tx('Strony', 'Pages'));
    const prev = button(tx('← Poprzednia', '← Previous'), () => { page--; redraw(); }, 'menu-btn fr-btn'); prev.disabled = page === 0;
    const next = button(tx('Następna →', 'Next →'), () => { page++; redraw(); }, 'menu-btn fr-btn'); next.disabled = page >= pages - 1;
    nav2.append(prev, el('span', 'notes-page', tx(`strona ${page + 1} z ${pages}`, `page ${page + 1} of ${pages}`)), next);
    return nav2;
  };
  const friendActs = (p: Player): HTMLElement[] => {
    const o = online(p.id);
    const acts: HTMLElement[] = [];
    if (o?.where === 'room' && o.roomId) acts.push(button(tx('Dołącz', 'Join'), () => d.join(o.roomId!), 'menu-btn btn-ok fr-btn'));
    if (!o || o.where !== 'game') acts.push(quick(tx('Zaproś do gry', 'Invite to a game'), tx('Zaproszono ✓', 'Invited ✓'), () => d.invite(p), 'menu-btn btn-ok fr-btn'));
    const n = unreadFrom(p.id);
    acts.push(button(n ? tx(`Napisz · ${n} nowe`, `Message · ${n} new`) : tx('Napisz', 'Message'), () => openChat(p.id), n ? 'menu-btn btn-ok fr-btn fr-hot' : 'menu-btn fr-btn'));
    acts.push(button(tx('Profil', 'Profile'), () => openProfile(p.id), 'menu-btn fr-btn'));
    acts.push(confirmBtn('✕', tx('Usunąć?', 'Remove?'), () => { move(p, 'none'); say(tx(`Usunięto ${p.nick} ze znajomych.`, `Removed ${p.nick} from friends.`)); paint(true); void unfriend(p.id); }, 'menu-btn btn-danger fr-btn fr-x'));
    (acts[acts.length - 1] as HTMLElement).setAttribute('aria-label', tx(`Usuń ${p.nick} ze znajomych`, `Remove ${p.nick} from friends`));
    return acts;
  };
  const relationActs = (p: Player): HTMLElement[] => {
    const r = relation(p.id);
    if (r === 'friend') return [el('span', 'net-tag', tx('znajomy', 'friend')), button(tx('Profil', 'Profile'), () => openProfile(p.id), 'menu-btn fr-btn')];
    if (r === 'out') return [el('span', 'net-tag off', tx('zaproszenie wysłane', 'request sent')), quick(tx('Cofnij', 'Withdraw'), tx('Cofnięto', 'Withdrawn'), async () => { await unfriend(p.id); move(p, 'none'); }, 'menu-btn btn-danger fr-btn')];
    if (r === 'in') return [quick(tx('Przyjmij', 'Accept'), tx('Znajomy ✓', 'Friend ✓'), async () => { const e = await befriend(p.id); if (!e) move(p, 'friends'); return e; }, 'menu-btn btn-ok fr-btn')];
    return [quick(tx('Dodaj do znajomych', 'Add friend'), tx('Wysłano ✓', 'Sent ✓'), async () => { const e = await befriend(p.id); if (!e) move(p, 'outgoing'); return e; }, 'menu-btn btn-ok fr-btn')];
  };

  // ---------- zakładki ----------
  let page = 0;
  let fShow: 'all' | 'on' | 'off' = 'all';
  let fSort: 'active' | 'level' | 'nick' = 'active';
  let fText = '';
  const friendsTab = (): Node[] => {
    const bar = el('div', 'fr-bar');
    const sid = `${pane.id}-f`;
    const sl = el('label', 'sr-only', tx('Filtruj znajomych', 'Filter friends')); sl.htmlFor = sid;
    const q = el('input'); q.id = sid; q.type = 'search'; q.placeholder = tx('Filtruj po nicku…', 'Filter by nickname…'); q.value = fText;
    const seg = el('div', 'notes-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', tx('Pokaż', 'Show'));
    for (const [k, pl, en] of [['all', 'Wszyscy', 'All'], ['on', 'W grze', 'Online'], ['off', 'Offline', 'Offline']] as const) {
      const b = button(tx(pl, en), () => { fShow = k; page = 0; paint(true); }, 'menu-btn fr-btn'); b.setAttribute('aria-pressed', String(fShow === k)); seg.append(b);
    }
    const sort = el('select'); sort.setAttribute('aria-label', tx('Sortuj', 'Sort'));
    for (const [k, pl, en] of [['active', 'Ostatnio aktywni', 'Recently active'], ['level', 'Najwyższy poziom', 'Highest level'], ['nick', 'Nick A–Z', 'Nickname A–Z']] as const) { const o = el('option', '', tx(pl, en)); o.value = k; sort.append(o); }
    sort.value = fSort;
    sort.addEventListener('change', () => { fSort = sort.value as typeof fSort; page = 0; paint(true); });
    bar.append(sl, q, seg, sort);
    const body = el('div', 'fr-body');
    const drawList = (): void => {
      const text = fText.trim().toLowerCase();
      const last = (p: Player): string => (online(p.id) ? '9' : '') + (p.last_seen ?? '');
      let ps = lists.friends.filter((p) => (!text || p.nick.toLowerCase().includes(text)) && (fShow === 'all' || (fShow === 'on') === !!online(p.id)));
      ps = ps.sort((a, b) => fSort === 'nick' ? a.nick.localeCompare(b.nick, 'pl') : fSort === 'level' ? levelOfP(b.id) - levelOfP(a.id) : last(b).localeCompare(last(a)));
      page = Math.min(page, Math.max(0, Math.ceil(ps.length / PER_PAGE) - 1));
      const shown = ps.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((p) => tile(p, friendActs(p)));
      const empty = lists.friends.length ? tx('Nikt nie pasuje do filtra.', 'Nobody matches the filter.') : tx('Nie masz jeszcze znajomych. Wejdź w „Szukaj graczy” i wyślij zaproszenie.', 'No friends yet. Open “Find players” and send a request.');
      const pg = pager(ps.length, drawList);
      body.replaceChildren(...grid(shown, empty), ...(pg ? [pg] : []));
    };
    q.addEventListener('input', () => { fText = q.value; page = 0; drawList(); });
    drawList();
    return [bar, body];
  };

  const activityTab = (): Node[] => {
    const items = noticesNow().filter((n) => ACTIVITY.has(n.kind));
    if (!items.length) return [el('p', 'net-msg fr-empty', tx('Tu zobaczysz, kto z Twoich znajomych wygrał albo przegrał bitwę i kto wszedł na nowy poziom.', 'Here you will see which friends won or lost a battle and who reached a new level.'))];
    const ul = el('ul', 'fr-feed');
    for (const n of items) {
      const li = el('li', `fr-feed-item ${n.kind === 'friend_match' ? (n.payload?.won ? 'won' : 'lost') : n.kind === 'friend_level' ? 'level' : ''}`);
      const who = el('button', 'fr-feed-crest'); who.type = 'button'; who.append(d.shield(n.from_avatar, 44));
      who.setAttribute('aria-label', tx(`Profil: ${n.from_nick}`, `Profile: ${n.from_nick}`));
      if (n.from_id) who.addEventListener('click', () => openProfile(n.from_id!));
      const body = el('div', 'fr-feed-body');
      body.append(el('span', 'fr-feed-text', noticeText(n)), el('span', 'fr-feed-when', ago(n.created_at)));
      li.append(who, body);
      ul.append(li);
    }
    return [ul];
  };

  const requestsTab = (): Node[] => {
    const inc = lists.incoming.map((p) => tile(p, [
      quick(tx('Przyjmij', 'Accept'), tx('Znajomy ✓', 'Friend ✓'), async () => { const e = await befriend(p.id); if (!e) { move(p, 'friends'); say(tx(`${p.nick} jest teraz Twoim znajomym.`, `${p.nick} is now your friend.`)); } return e; }, 'menu-btn btn-ok fr-btn'),
      quick(tx('Odrzuć', 'Decline'), tx('Odrzucono', 'Declined'), async () => { await unfriend(p.id); move(p, 'none'); }, 'menu-btn btn-danger fr-btn'),
    ]));
    const out = lists.outgoing.map((p) => tile(p, [quick(tx('Cofnij', 'Withdraw'), tx('Cofnięto', 'Withdrawn'), async () => { await unfriend(p.id); move(p, 'none'); }, 'menu-btn btn-danger fr-btn')]));
    return [
      el('h4', 'house-h', tx('Chcą być Twoimi znajomymi', 'Want to be your friends')), ...grid(inc, tx('Brak nowych zaproszeń.', 'No new requests.')),
      el('h4', 'house-h', tx('Wysłane — czekają na odpowiedź', 'Sent — waiting for a reply')), ...grid(out, tx('Nic nie czeka.', 'Nothing pending.')),
    ];
  };

  let query = '';
  const searchTab = (): Node[] => {
    const form = el('form', 'fr-bar');
    const id = `${pane.id}-q`;
    const lab = el('label', 'sr-only', tx('Nick gracza', 'Player nickname')); lab.htmlFor = id;
    const q = el('input'); q.id = id; q.type = 'search'; q.placeholder = tx('Wpisz nick gracza (min. 2 znaki)', 'Type a nickname (2+ letters)'); q.maxLength = 20; q.autocomplete = 'off'; q.value = query;
    const go = el('button', 'menu-btn fr-btn', tx('Szukaj', 'Search')); go.type = 'submit';
    form.append(lab, q, go);
    const head = el('h4', 'house-h');
    const res = el('div', 'fr-body');
    let timer = 0;
    const show = async (): Promise<void> => {
      query = q.value;
      const found = query.trim().length >= 2;
      head.textContent = found ? tx('Wyniki', 'Results') : tx('Ostatnio w grze — może ktoś do znajomych?', 'Recently online — anyone to befriend?');
      const ps = found ? await searchPlayers(query) : await recentPlayers(24);
      const more = await statsOf(ps.map((p) => p.id).filter((x) => !stats.has(x)));
      for (const [k, v] of more) stats.set(k, v);
      if (q.value !== query) return;
      res.replaceChildren(...grid(ps.map((p) => tile(p, relationActs(p))), tx('Nikogo nie znaleziono.', 'Nobody found.')));
    };
    // wyniki pojawiają się w trakcie pisania (bez klikania „Szukaj”)
    q.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => void show(), 280); });
    form.addEventListener('submit', (e) => { e.preventDefault(); void show(); });
    void show();
    setTimeout(() => q.focus(), 0);
    return [form, head, res];
  };

  // ---------- profil gracza ----------
  const openProfile = (id: string): void => { profileOf = id; paint(true); };
  // ---------- wiadomości ----------
  const openChat = (id: string): void => { chatWith = id; profileOf = null; tab = 1; paint(true); };
  let appendMsg: ((m: Message) => void) | null = null;
  const fmtTime = (iso: string): string => new Date(iso).toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const messagesTab = (): Node[] => {
    const box = el('div', 'fr-convs');
    box.append(el('p', 'net-msg', tx('Wczytuję rozmowy…', 'Loading conversations…')));
    void conversations().then((last) => {
      if (!box.isConnected) return;
      const meId = me()?.id;
      // najpierw rozmowy (od najnowszej), potem znajomi, z którymi jeszcze nie pisałeś
      const withMsg = lists.friends.filter((p) => last.has(p.id)).sort((a, b) => last.get(b.id)!.created_at.localeCompare(last.get(a.id)!.created_at));
      const rest = lists.friends.filter((p) => !last.has(p.id));
      if (!lists.friends.length) { box.replaceChildren(el('p', 'net-msg fr-empty', tx('Pisać można do znajomych — najpierw dodaj kogoś w „Szukaj graczy”.', 'You can message friends — add someone in “Find players” first.'))); return; }
      const ul = el('ul', 'fr-conv-list');
      for (const p of [...withMsg, ...rest]) {
        const m = last.get(p.id);
        const n = unreadFrom(p.id);
        const li = el('li');
        const b = button('', () => openChat(p.id), `fr-conv${n ? ' hot' : ''}`);
        const txt = el('span', 'fr-conv-txt');
        txt.append(el('strong', '', p.nick), el('span', 'fr-conv-last', m ? `${m.from_id === meId ? tx('Ty: ', 'You: ') : ''}${m.body}` : tx('Napisz pierwszą wiadomość', 'Write the first message')));
        b.append(d.shield(online(p.id)?.avatar ?? p.avatar, 40), txt, el('span', 'fr-conv-when', m ? ago(m.created_at) : ''));
        if (n) b.append(el('span', 'fr-conv-n', String(n)));
        li.append(b);
        ul.append(li);
      }
      box.replaceChildren(ul);
    });
    return [box];
  };
  const chatView = (id: string): Node[] => {
    const p = lists.friends.find((x) => x.id === id) ?? lists.incoming.find((x) => x.id === id) ?? lists.outgoing.find((x) => x.id === id);
    const head = el('div', 'fr-chat-head'); head.dataset.with = id;
    const back = button(tx('← Rozmowy', '← Conversations'), () => { chatWith = null; appendMsg = null; paint(true); }, 'menu-btn fr-btn');
    const who = el('button', 'fr-name', p?.nick ?? '…'); who.type = 'button'; who.addEventListener('click', () => openProfile(id));
    head.append(back, d.shield(online(id)?.avatar ?? p?.avatar ?? 0, 40), who);
    if (p) head.append(statusDot(p));
    const log = el('div', 'fr-chat-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
    const meId = me()?.id;
    let lastDay = '';
    const bubble = (m: Message): void => {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) { lastDay = day; log.append(el('div', 'fr-chat-day', new Date(m.created_at).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }))); }
      const mine = m.from_id === meId;
      const b = el('div', `fr-msg ${mine ? 'mine' : 'theirs'}`);
      b.append(el('span', 'fr-msg-body', m.body), el('span', 'fr-msg-when', fmtTime(m.created_at)));
      log.append(b);
      log.scrollTop = log.scrollHeight;
    };
    appendMsg = (m) => { bubble(m); void markRead(id); };
    const form = el('form', 'fr-chat-form');
    const iid = `${pane.id}-chat`;
    const lab = el('label', 'sr-only', tx('Wiadomość', 'Message')); lab.htmlFor = iid;
    const input = el('textarea', 'fr-chat-input'); input.id = iid; input.rows = 2; input.maxLength = 1000;
    input.placeholder = tx('Napisz wiadomość… (Enter — wyślij, Shift+Enter — nowa linia)', 'Write a message… (Enter — send, Shift+Enter — new line)');
    const send = el('button', 'menu-btn btn-ok fr-btn', tx('Wyślij', 'Send')); send.type = 'submit';
    const err = el('p', 'net-msg bad fr-chat-err'); err.setAttribute('role', 'status');
    form.append(lab, input, send);
    const go = async (): Promise<void> => {
      const text = input.value.trim();
      if (!text) return;
      input.value = ''; err.textContent = '';
      // od razu w rozmowie (szary dymek), po zapisie w bazie — prawdziwy
      const temp: Message = { id: -Date.now(), from_id: meId ?? '', to_id: id, body: text, read: false, created_at: new Date().toISOString() };
      bubble(temp);
      const pending = log.lastElementChild as HTMLElement; pending.classList.add('pending');
      const r = await sendMessage(id, text);
      if (typeof r === 'string') { pending.classList.add('failed'); err.textContent = r; input.value = text; return; }
      pending.classList.remove('pending');
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); void go(); });
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } });
    log.append(el('p', 'net-msg', tx('Wczytuję rozmowę…', 'Loading the conversation…')));
    void conversation(id).then((ms) => {
      log.replaceChildren();
      if (typeof ms === 'string') { log.append(el('p', 'net-msg', ms)); return; }
      if (!ms.length) log.append(el('p', 'net-msg fr-empty', tx('Jeszcze nic nie napisaliście. Zacznij rozmowę!', 'Nothing written yet. Start the conversation!')));
      for (const m of ms) bubble(m);
      void markRead(id);
    });
    setTimeout(() => input.focus(), 0);
    return [head, log, err, form];
  };

  const profileView = (id: string): Node[] => {
    const back = button(tx('← Wróć', '← Back'), () => { profileOf = null; paint(true); }, 'menu-btn fr-btn fr-back');
    const known = [...lists.friends, ...lists.incoming, ...lists.outgoing].find((x) => x.id === id);
    const card = profileCard(id, { el, button, shield: d.shield }, (p) => {
      const acts = relation(id) === 'friend' ? friendActs(p) : relationActs(p);
      return acts.filter((b) => b.textContent !== tx('Profil', 'Profile'));
    }, known);
    return [back, card];
  };
  // ---------- rysowanie ----------
  const paintTabs = (): void => {
    const on = lists.friends.filter((p) => online(p.id)).length;
    const act = noticesNow().filter((n) => ACTIVITY.has(n.kind) && !n.read).length;
    const names = [
      tx(`Znajomi · ${lists.friends.length}`, `Friends · ${lists.friends.length}`),
      unreadAll() ? tx(`Wiadomości · ${unreadAll()} nowe`, `Messages · ${unreadAll()} new`) : tx('Wiadomości', 'Messages'),
      act ? tx(`Aktywność · ${act} nowe`, `Activity · ${act} new`) : tx('Aktywność', 'Activity'),
      lists.incoming.length ? tx(`Zaproszenia · ${lists.incoming.length}`, `Requests · ${lists.incoming.length}`) : tx('Zaproszenia', 'Requests'),
      tx('Szukaj graczy', 'Find players'),
    ];
    names.forEach((n, i) => { tabBtns[i]!.textContent = n; tabBtns[i]!.setAttribute('aria-selected', String(i === tab && !profileOf)); tabBtns[i]!.classList.toggle('fr-tab-hot', i === 1 && unreadAll() > 0); tabBtns[i]!.tabIndex = i === tab ? 0 : -1; });
    summary.replaceChildren(
      el('span', 'fr-sum', tx(`W grze: ${on}`, `Online: ${on}`)),
      el('span', 'fr-sum', tx(`Znajomych: ${lists.friends.length}`, `Friends: ${lists.friends.length}`)),
      el('span', `fr-sum${lists.incoming.length ? ' hot' : ''}`, tx(`Zaproszenia: ${lists.incoming.length}`, `Requests: ${lists.incoming.length}`)),
    );
  };
  /** full: przebuduj zawartość; bez full tylko odśwież liczniki i kafelki znajomych (zmiana obecności) bez gubienia pisania */
  const paint = (full: boolean): void => {
    paintTabs();
    const typing = pane.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT';
    if (!full && (tab === 4 || typing || profileOf || chatWith)) return;
    pane.replaceChildren(...(profileOf ? profileView(profileOf) : chatWith ? chatView(chatWith) : tab === 0 ? friendsTab() : tab === 1 ? messagesTab() : tab === 2 ? activityTab() : tab === 3 ? requestsTab() : searchTab()));
  };
  let seq = 0;
  const load = async (full: boolean): Promise<void> => {
    const my = ++seq;
    const l = await friendLists();
    const st = await statsOf([...l.friends, ...l.incoming, ...l.outgoing].map((p) => p.id));
    if (my !== seq) return;
    lists = l; stats = st;
    paint(full);
  };
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    tab = (tab + (e.key === 'ArrowRight' ? 1 : TABS - 1)) % TABS; profileOf = null; chatWith = null; page = 0; paint(true); tabBtns[tab]!.focus();
  });
  const offN = onNotices(() => { if (tab === 2 && !profileOf && !chatWith) paint(true); else paintTabs(); });
  // nowa wiadomość: otwarta rozmowa dopisuje ją od razu, lista rozmów się odświeża, liczniki na zakładce i kafelkach też
  const offM = onMessage((msg) => { if (chatWith === msg.from_id) appendMsg?.(msg); else if (tab === 1 && !profileOf && !chatWith) paint(true); });
  const offU = onMessages(() => { paintTabs(); if (tab === 0 && !profileOf && !chatWith && !(pane.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT')) paint(true); });
  void load(true);
  return { node: wrap, redraw: () => void load(false), stop: () => { offN(); offM(); offU(); } };
}

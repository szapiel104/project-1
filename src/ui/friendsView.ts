import { befriend, friendLists, recentPlayers, searchPlayers, unfriend, type FriendLists, type Player } from '../net/social';
import { onlinePlayers, type OnlinePlayer } from '../net/supa';
import { lang, tx } from '../i18n';

/**
 * Okno „Znajomi” jak na Steamie (Michał 2.11.2026): trzy zakładki — znajomi (kto w grze, gdzie, kiedy grał ostatnio;
 * dołącz do pokoju albo zaproś do gry), zaproszenia (przyjmij / odrzuć, wysłane) i szukanie nowych graczy
 * (po nicku i lista ostatnio aktywnych).
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
  return parts.join(' · ') || tx('poza grą', 'offline');
}

export function friendsView(d: FriendsDeps, startTab = 0): { node: HTMLElement; redraw(): void } {
  const { el, button } = d;
  const wrap = el('div', 'net-friends friends-steam');
  const nav = el('div', 'menu-nav friends-tabs'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', tx('Znajomi', 'Friends'));
  const pane = el('div', 'friends-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = `friends-pane-${Math.random().toString(36).slice(2, 6)}`;
  const note = el('p', 'net-msg'); note.setAttribute('role', 'status');
  const say = (t: string, bad = false): void => { note.textContent = t; note.classList.toggle('bad', bad); };
  let tab = startTab;
  let lists: FriendLists = { friends: [], incoming: [], outgoing: [] };
  const tabBtns: HTMLButtonElement[] = [];
  const names = (): string[] => [
    tx(`Znajomi (${lists.friends.length})`, `Friends (${lists.friends.length})`),
    lists.incoming.length ? tx(`Zaproszenia · ${lists.incoming.length}`, `Requests · ${lists.incoming.length}`) : tx('Zaproszenia', 'Requests'),
    tx('Szukaj graczy', 'Find players'),
  ];
  for (let i = 0; i < 3; i++) {
    const b = button('', () => { tab = i; void draw(); }, 'menu-tab');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
    tabBtns.push(b); nav.append(b);
  }
  wrap.append(nav, note, pane);

  const card = (p: Player, acts: HTMLElement[]): HTMLElement => {
    const o = onlinePlayers().find((x) => x.id === p.id);
    const r = el('div', `net-room net-friend${o ? ' on' : ''}${o && o.where !== 'menu' ? ' busy' : ''}`);
    const info = el('div', 'net-room-info');
    info.append(el('strong', '', p.nick), el('span', '', whereText(p, o)));
    const tag = el('span', o ? 'net-tag' : 'net-tag off', o ? (o.where === 'menu' ? tx('dostępny', 'online') : tx('w grze', 'in game')) : tx('offline', 'offline'));
    r.append(d.shield(o?.avatar ?? p.avatar, 32), info, tag, ...acts);
    return r;
  };
  const act = async (f: () => Promise<string | null | void>, ok: string): Promise<void> => {
    const e = await f();
    if (e) { say(e, true); return; }
    say(ok);
    void draw();
  };

  const friendsTab = (): Node[] => {
    if (!lists.friends.length) return [el('p', 'net-msg', tx('Nie masz jeszcze znajomych. Wejdź w „Szukaj graczy” i wyślij zaproszenie.', 'No friends yet. Open “Find players” and send a request.'))];
    const on = onlinePlayers();
    // najpierw ci w grze, potem według tego, kiedy byli ostatnio
    const sorted = [...lists.friends].sort((a, b) => Number(!!on.find((x) => x.id === b.id)) - Number(!!on.find((x) => x.id === a.id)) || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''));
    return sorted.map((p) => {
      const o = on.find((x) => x.id === p.id);
      const acts: HTMLElement[] = [];
      if (o?.where === 'room' && o.roomId) acts.push(button(tx('Dołącz', 'Join'), () => d.join(o.roomId!), 'menu-btn net-join btn-ok'));
      if (o && o.where !== 'game') acts.push(button(tx('Zaproś do gry', 'Invite to a game'), () => void act(() => d.invite(p), tx(`Zaproszenie wysłane do ${p.nick}.`, `Invitation sent to ${p.nick}.`)), 'menu-btn net-join btn-ok'));
      acts.push(button(tx('Usuń', 'Remove'), () => void act(() => unfriend(p.id), tx(`Usunięto ${p.nick} ze znajomych.`, `Removed ${p.nick} from friends.`)), 'link-btn'));
      return card(p, acts);
    });
  };
  const requestsTab = (): Node[] => {
    const out: Node[] = [el('p', 'net-label', tx('Chcą być Twoimi znajomymi', 'Want to be your friends'))];
    if (lists.incoming.length) out.push(...lists.incoming.map((p) => card(p, [
      button(tx('Przyjmij', 'Accept'), () => void act(() => befriend(p.id), tx(`${p.nick} jest teraz Twoim znajomym.`, `${p.nick} is now your friend.`)), 'menu-btn net-join btn-ok'),
      button(tx('Odrzuć', 'Decline'), () => void act(() => unfriend(p.id), tx('Zaproszenie odrzucone.', 'Request declined.')), 'menu-btn net-join btn-danger'),
    ])));
    else out.push(el('p', 'net-msg', tx('Brak nowych zaproszeń.', 'No new requests.')));
    out.push(el('p', 'net-label', tx('Wysłane — czekają na odpowiedź', 'Sent — waiting for a reply')));
    if (lists.outgoing.length) out.push(...lists.outgoing.map((p) => card(p, [button(tx('Cofnij', 'Withdraw'), () => void act(() => unfriend(p.id), tx('Zaproszenie cofnięte.', 'Request withdrawn.')), 'menu-btn net-join btn-danger')])));
    else out.push(el('p', 'net-msg', tx('Nic nie czeka.', 'Nothing pending.')));
    return out;
  };
  const relation = (p: Player): HTMLElement[] => {
    if (lists.friends.some((x) => x.id === p.id)) return [el('span', 'net-tag', tx('znajomy', 'friend'))];
    if (lists.outgoing.some((x) => x.id === p.id)) return [el('span', 'net-tag off', tx('zaproszony', 'request sent'))];
    if (lists.incoming.some((x) => x.id === p.id)) return [button(tx('Przyjmij', 'Accept'), () => void act(() => befriend(p.id), tx(`${p.nick} jest teraz Twoim znajomym.`, `${p.nick} is now your friend.`)), 'menu-btn net-join btn-ok')];
    return [button(tx('Dodaj do znajomych', 'Add friend'), () => void act(() => befriend(p.id), tx(`Zaproszenie wysłane do ${p.nick}.`, `Request sent to ${p.nick}.`)), 'menu-btn net-join btn-ok')];
  };
  let query = '';
  const searchTab = (): Node[] => {
    const form = el('form', 'net-create');
    const id = `${pane.id}-q`;
    const lab = el('label', 'sr-only', tx('Nick gracza', 'Player nickname')); lab.htmlFor = id;
    const q = el('input'); q.id = id; q.type = 'search'; q.placeholder = tx('Wpisz nick gracza (min. 2 znaki)', 'Type a nickname (2+ letters)'); q.maxLength = 20; q.autocomplete = 'off'; q.value = query;
    const go = el('button', 'menu-btn', tx('Szukaj', 'Search')); go.type = 'submit';
    form.append(lab, q, go);
    const res = el('div', 'net-list');
    const label = el('p', 'net-label');
    const show = async (): Promise<void> => {
      query = q.value;
      const found = query.trim().length >= 2;
      label.textContent = found ? tx('Wyniki', 'Results') : tx('Ostatnio w grze — może ktoś do znajomych?', 'Recently online — anyone to befriend?');
      res.replaceChildren(el('p', 'net-msg', tx('Szukam…', 'Searching…')));
      const ps = found ? await searchPlayers(query) : await recentPlayers();
      res.replaceChildren(...(ps.length ? ps.map((p) => card(p, relation(p))) : [el('p', 'net-msg', tx('Nikogo nie znaleziono.', 'Nobody found.'))]));
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); void show(); });
    void show();
    setTimeout(() => q.focus(), 0);
    return [form, label, res];
  };

  let seq = 0;
  const draw = async (): Promise<void> => {
    const my = ++seq;
    lists = await friendLists();
    if (my !== seq) return;
    names().forEach((n, i) => { tabBtns[i]!.textContent = n; tabBtns[i]!.setAttribute('aria-selected', String(i === tab)); tabBtns[i]!.tabIndex = i === tab ? 0 : -1; });
    // szukanie nie odświeża się samo przy każdej zmianie obecności (gubiłoby wpisany tekst i fokus)
    if (tab === 2 && pane.dataset.tab === '2') return;
    pane.dataset.tab = String(tab);
    pane.replaceChildren(...(tab === 0 ? friendsTab() : tab === 1 ? requestsTab() : searchTab()));
  };
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    tab = (tab + (e.key === 'ArrowRight' ? 1 : 2)) % 3; void draw().then(() => tabBtns[tab]!.focus());
  });
  void draw();
  return { node: wrap, redraw: () => void draw() };
}

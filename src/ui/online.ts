import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { TEAM_COLORS } from '../data/teams';
import { Lockstep } from '../net/lockstep';
import {
  addFriend, closeMyStaleRooms, createRoom, listFriends, onInvite, onlinePlayers, onPresence, removeFriend, sendInvite, setStatus, deleteRoom, getRoom, listRooms, myRecord, myResults, ranking, me, restore, roomLink, setAvatar, setNick, setPassword, signIn, signOut, signUp, updateRoom, watchRooms,
  type Invite, type Member, type NetMsg, type OnlinePlayer, type Room, type RoomLink, type Slot,
} from '../net/supa';
import { AVATAR_COUNT, avatarSvg } from './avatars';
import { chatLine, cleanChat } from './chat';

/** Wszystko, czego potrzebuje gra, żeby wystartować mecz przez sieć */
export interface OnlineStart {
  room: Room;
  seed: string;
  preset: MapPresetId;
  level: number;
  slots: Slot[];
  /** Mój numer gracza */
  me: number;
  /** Numery graczy-ludzi */
  humans: number[];
  link: RoomLink;
  net: Lockstep;
}

interface Ui {
  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K];
  button(text: string, onClick: () => void, cls?: string): HTMLButtonElement;
  screen(heading: string, wide: boolean, ...nodes: Node[]): void;
  showMain(): void;
  onStart(s: OnlineStart): void;
  /** Otwiera menu i wchodzi do pokoju z zaproszenia */
  openForJoin(roomId: string): void;
  /** Czy trwa mecz przez sieć (wtedy zaproszenia nie przeszkadzają) */
  inMatch(): boolean;
  onInviteSound?(): void;
}

const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];
const MODES: [MapPresetId, string][] = [['1v1', '1 na 1'], ['2v2', '2 na 2'], ['4v4', '4 na 4']];
const LEVELS = ['Pokojowe', 'Łatwe', 'Średnie', 'Trudne'];
const seats = (preset: string): number => (MAP_PRESETS[preset as MapPresetId]?.starts.length ?? 1) * 2;
const modeName = (preset: string): string => MODES.find(([id]) => id === preset)?.[1] ?? preset;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function createOnline(ui: Ui): { showOnline(): void; showAccount(): void; showLogin(register?: boolean): void; join(id: string): void; leave(): void } {
  const { el, button, screen } = ui;
  const inMatch = (): boolean => ui.inMatch();
  let stopWatch: (() => void) | null = null;
  /** Wyjście z pokoju przy przejściu na inny ekran */
  let leaveRoom: (() => void) | null = null;
  const cleanup = (): void => { stopWatch?.(); stopWatch = null; leaveRoom?.(); leaveRoom = null; };

  const msg = (text: string, bad = false): HTMLElement => { const p = el('p', bad ? 'net-msg bad' : 'net-msg', text); p.setAttribute('role', 'status'); return p; };
  const back = (to: () => void = () => { cleanup(); ui.showMain(); }, text = 'Wróć'): HTMLButtonElement => button(text, to, 'menu-btn menu-back');
  const field = (label: string, type: string, auto: string): [HTMLElement, HTMLInputElement] => {
    const w = el('div', 'field');
    const id = `net-${label.replace(/\W+/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
    const l = el('label', '', label); l.htmlFor = id;
    const i = el('input'); i.type = type; i.id = id; i.setAttribute('autocomplete', auto);
    w.append(l, i); return [w, i];
  };
  const shield = (avatar: number, size = 40): HTMLElement => { const s = el('span', 'net-shield'); s.innerHTML = avatarSvg(avatar, size); return s; };

  // ---------------- konto ----------------
  function showLogin(register = false, info = '', then: () => void = ui.showMain): void {
    cleanup();
    const form = el('form', 'menu-form net-form');
    const [we, email] = field('E-mail', 'email', 'email');
    const [wp, pass] = field('Hasło (min. 6 znaków)', 'password', register ? 'new-password' : 'current-password');
    const [wn, nick] = field('Nick w grze (3–20 znaków)', 'text', 'nickname');
    email.required = pass.required = true;
    wn.hidden = !register; nick.required = register;
    const note = msg(info, !!info && !info.startsWith('Konto'));
    const go = el('button', 'menu-btn', register ? 'Załóż konto' : 'Zaloguj'); go.type = 'submit';
    const swap = button(register ? 'Mam już konto — zaloguj' : 'Nie mam konta — zarejestruj', () => showLogin(!register, '', then), 'link-btn net-swap');
    form.append(we, wp, wn, note, go, swap);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); go.disabled = true; note.textContent = 'Chwila…'; note.classList.remove('bad');
      const err = register ? await signUp(email.value.trim(), pass.value, nick.value) : await signIn(email.value.trim(), pass.value);
      go.disabled = false;
      if (err && register && err.startsWith('Konto')) { showLogin(false, err, then); return; }
      if (err) { note.textContent = err; note.classList.add('bad'); return; }
      then();
    });
    screen(register ? 'Nowe konto' : 'Logowanie', false, form, back());
  }

  function showAccount(): void {
    cleanup();
    const m = me();
    if (!m) { showLogin(false, '', showAccount); return; }
    const box = el('div', 'net-account');
    // wizytówka
    const card = el('div', 'net-card');
    const who = el('div', 'net-card-text');
    who.append(el('strong', '', m.nick), el('span', '', m.email));
    card.append(shield(m.avatar, 64), who);
    // herb
    const pick = el('div', 'net-avatars');
    pick.setAttribute('role', 'radiogroup');
    pick.setAttribute('aria-label', 'Herb');
    const note = msg('');
    for (let i = 0; i < AVATAR_COUNT; i++) {
      const b = el('button', 'net-avatar');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === m.avatar));
      b.setAttribute('aria-label', `Herb ${i + 1}`);
      b.innerHTML = avatarSvg(i, 34);
      b.addEventListener('click', async () => {
        pick.querySelectorAll('[aria-checked="true"]').forEach((x) => x.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
        const err = await setAvatar(i);
        if (err) { note.textContent = err; note.classList.add('bad'); return; }
        card.firstElementChild!.replaceWith(shield(i, 64));
      });
      pick.append(b);
    }
    // nick
    const nickForm = el('form', 'net-inline');
    const [wn, nick] = field('Nick', 'text', 'nickname');
    nick.value = m.nick; nick.maxLength = 20;
    const saveNick = el('button', 'menu-btn', 'Zapisz nick'); saveNick.type = 'submit';
    nickForm.append(wn, saveNick);
    nickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = await setNick(nick.value);
      note.textContent = err ?? 'Nick zapisany.'; note.classList.toggle('bad', !!err);
      if (!err) (who.firstElementChild as HTMLElement).textContent = me()!.nick;
    });
    // hasło
    const passForm = el('form', 'net-inline');
    const [wp, pass] = field('Nowe hasło', 'password', 'new-password');
    const [wp2, pass2] = field('Powtórz hasło', 'password', 'new-password');
    const savePass = el('button', 'menu-btn', 'Zmień hasło'); savePass.type = 'submit';
    passForm.append(wp, wp2, savePass);
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (pass.value !== pass2.value) { note.textContent = 'Hasła się różnią.'; note.classList.add('bad'); return; }
      const err = await setPassword(pass.value);
      note.textContent = err ?? 'Hasło zmienione.'; note.classList.toggle('bad', !!err);
      if (!err) { pass.value = ''; pass2.value = ''; }
    });
    const out = button('Wyloguj', async () => { await signOut(); ui.showMain(); }, 'menu-btn menu-back');
    const left = el('div', 'net-col');
    // bilans i ostatnie mecze przez sieć
    const record = el('p', 'net-record', 'Bilans: wczytuję…');
    const history = el('ol', 'net-history');
    history.setAttribute('aria-label', 'Ostatnie mecze');
    void Promise.all([myRecord(), myResults()]).then(([rec, list]) => {
      record.replaceChildren(el('strong', '', `${rec?.wins ?? 0}`), ' wygranych · ', el('strong', '', `${rec?.losses ?? 0}`), ' porażek');
      history.replaceChildren(...(list.length ? list.map((x) => {
        const li = el('li', x.won ? 'won' : 'lost');
        li.append(el('span', 'res', x.won ? 'Wygrana' : 'Porażka'), el('span', '', `${modeName(x.preset)} · ${x.minutes} min`), el('span', 'when', new Date(x.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })));
        return li;
      }) : [el('li', 'none', 'Jeszcze żadnego meczu przez sieć.')]));
    });
    left.append(card, record, history, el('p', 'net-label', 'Herb'), pick);
    const right = el('div', 'net-col');
    right.append(nickForm, passForm, note);
    const cols = el('div', 'net-cols');
    cols.append(left, right);
    box.append(cols);
    const foot = el('div', 'menu-foot');
    foot.append(out, back());
    screen('Twoje konto', true, box, foot);
  }

  // ---------------- lista gier ----------------
  let filter: MapPresetId | 'all' = 'all';
  async function showOnline(): Promise<void> {
    cleanup();
    screen('Gra przez sieć', true, msg('Łączenie…'));
    await restore();
    const m = me();
    if (!m) { showLogin(false, 'Zaloguj się, żeby grać przez sieć.', () => void showOnline()); return; }
    // wchodzę do listy, więc żaden mój pokój nie jest już aktywny
    await closeMyStaleRooms();
    const wrap = el('div', 'net-lobby');
    // pasek: kim jestem
    const bar = el('div', 'net-bar');
    const tabs = el('div', 'net-filters');
    tabs.setAttribute('role', 'tablist');
    const list = el('div', 'net-list');
    for (const [id, name] of [['all', 'Wszystkie'], ...MODES] as [MapPresetId | 'all', string][]) {
      const b = button(name, () => { filter = id; tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); void draw(); }, 'net-filter');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(filter === id));
      tabs.append(b);
    }
    const friendsBtn = button('Znajomi', () => void showFriends(), 'net-filter net-rank-btn');
    const paintFriendsBtn = async (): Promise<void> => {
      const { mine } = await listFriends();
      const on = onlinePlayers();
      const n = mine.filter((f) => on.some((o) => o.id === f.id)).length;
      friendsBtn.textContent = n ? `Znajomi · ${n} w grze` : 'Znajomi';
    };
    void paintFriendsBtn();
    tabs.append(friendsBtn, button('Ranking', () => void showRanking(), 'net-filter'));
    bar.append(tabs);
    // zakładanie gry
    const create = el('form', 'net-create');
    const name = el('input'); name.placeholder = 'Nazwa gry'; name.maxLength = 40; name.value = `Gra ${m.nick}`; name.setAttribute('aria-label', 'Nazwa gry');
    const mode = el('select'); mode.setAttribute('aria-label', 'Tryb');
    for (const [id, label] of MODES) { const o = el('option', '', label); o.value = id; mode.append(o); }
    if (filter !== 'all') mode.value = filter;
    const mk = el('button', 'menu-btn', 'Załóż grę'); mk.type = 'submit';
    create.append(name, mode, mk);
    create.addEventListener('submit', async (e) => {
      e.preventDefault(); mk.disabled = true;
      const seed = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
      const res = await createRoom(name.value.trim() || `Gra ${m.nick}`, mode.value, seed);
      mk.disabled = false;
      if (typeof res === 'string') { list.prepend(msg(res, true)); return; }
      enterRoom(res);
    });
    const draw = async (): Promise<void> => {
      const rooms = (await listRooms()).filter((r) => filter === 'all' || r.preset === filter);
      if (!rooms.length) {
        const empty = el('div', 'net-empty');
        empty.append(el('strong', '', filter === 'all' ? 'Nie ma jeszcze żadnych gier' : `Nie ma gier ${modeName(filter)}`),
          el('span', '', 'Załóż swoją — inni zobaczą ją tu od razu. Wolne miejsca możesz obsadzić botami i grać sam.'));
        list.replaceChildren(empty);
        return;
      }
      list.replaceChildren(...rooms.map((r) => {
        const row = el('div', 'net-room');
        const info = el('div', 'net-room-info');
        const playing = r.status === 'playing';
        info.append(el('strong', '', r.name), el('span', '', `${modeName(r.preset)} · gospodarz ${r.host_nick}${r.guest_nick ? ` · ${r.guest_nick}` : ''}`));
        const tag = el('span', playing ? 'net-tag busy' : 'net-tag', playing ? 'trwa mecz' : 'czeka');
        row.append(el('span', 'net-mode', modeName(r.preset)), info, tag);
        if (!playing) row.append(button(r.host === m.id ? 'Wróć do pokoju' : 'Dołącz', () => enterRoom(r), 'menu-btn net-join'));
        return row;
      }));
    };
    wrap.append(bar, create, list);
    screen('Gra przez sieć', true, wrap, back());
    await draw();
    stopWatch = watchRooms(() => void draw());
  }

  // ---------------- znajomi ----------------
  const where = (o: OnlinePlayer | undefined): string => {
    if (!o) return 'poza grą';
    if (o.where === 'room') return `w pokoju „${o.roomName ?? ''}”`;
    if (o.where === 'game') return 'w meczu przez sieć';
    if (o.where === 'solo') return 'gra z botami';
    return 'w menu';
  };
  async function showFriends(): Promise<void> {
    cleanup();
    const m = me();
    if (!m) { showLogin(false, '', () => void showFriends()); return; }
    const wrap = el('div', 'net-friends');
    const add = el('form', 'net-create');
    const nick = el('input'); nick.placeholder = 'Nick znajomego'; nick.maxLength = 20; nick.setAttribute('aria-label', 'Nick znajomego'); nick.autocomplete = 'off';
    const addBtn = el('button', 'menu-btn', 'Dodaj'); addBtn.type = 'submit';
    add.append(nick, addBtn);
    const note = msg('');
    const list = el('div', 'net-list');
    const draw = async (): Promise<void> => {
      const { mine, addedMe } = await listFriends();
      const on = onlinePlayers();
      const row = (p: { id: string; nick: string }, mineList: boolean): HTMLElement => {
        const o = on.find((x) => x.id === p.id);
        const r = el('div', `net-room net-friend${o ? ' on' : ''}`);
        const info = el('div', 'net-room-info');
        info.append(el('strong', '', p.nick), el('span', '', where(o)));
        r.append(shield(o?.avatar ?? 0, 30), info, el('span', o ? 'net-tag' : 'net-tag off', o ? 'w grze' : 'offline'));
        if (o?.where === 'room' && o.roomId) r.append(button('Dołącz', () => void join(o.roomId!), 'menu-btn net-join'));
        if (mineList) r.append(button('Usuń', async () => { await removeFriend(p.id); void draw(); }, 'link-btn'));
        else r.append(button('Dodaj też', async () => { await addFriend(p.nick); void draw(); }, 'menu-btn net-join'));
        return r;
      };
      const out: Node[] = [];
      out.push(el('p', 'net-label', `Twoi znajomi (${mine.length})`));
      if (mine.length) out.push(...mine.map((p) => row(p, true)));
      else out.push(msg('Nikogo jeszcze nie dodałeś. Wpisz nick znajomego powyżej.'));
      if (addedMe.length) { out.push(el('p', 'net-label', 'Dodali Cię do znajomych')); out.push(...addedMe.map((p) => row(p, false))); }
      list.replaceChildren(...out);
    };
    add.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nick.value.trim()) return;
      addBtn.disabled = true;
      const err = await addFriend(nick.value);
      addBtn.disabled = false;
      note.textContent = err ?? `Dodano: ${nick.value.trim()}.`; note.classList.toggle('bad', !!err);
      if (!err) nick.value = '';
      void draw();
    });
    wrap.append(add, note, list);
    screen('Znajomi', true, wrap, back(() => void showOnline(), 'Wróć do listy gier'));
    await draw();
    stopWatch = onPresence(() => void draw());
  }

  // zaproszenie od znajomego: okienko w rogu ekranu, w menu i w grze z botami (w meczu przez sieć nie przeszkadzamy)
  onInvite((i: Invite) => {
    if (inMatch()) return;
    document.querySelector('.invite-toast')?.remove();
    const t = el('div', 'invite-toast panel');
    t.setAttribute('role', 'alertdialog');
    t.setAttribute('aria-label', 'Zaproszenie do gry');
    const txt = el('div', 'invite-text');
    txt.append(el('strong', '', i.from.nick), ` zaprasza Cię do gry „${i.roomName}”`);
    const yes = button('Dołącz', () => { t.remove(); ui.openForJoin(i.roomId); }, 'menu-btn');
    const no = button('Nie teraz', () => t.remove(), 'link-btn');
    const acts = el('div', 'invite-acts');
    acts.append(yes, no);
    t.append(shield(i.from.avatar, 34), txt, acts);
    document.body.append(t);
    ui.onInviteSound?.();
    setTimeout(() => t.remove(), 30_000);
  });

  // ---------------- ranking ----------------
  async function showRanking(): Promise<void> {
    cleanup();
    screen('Ranking', true, msg('Wczytuję…'));
    const rows = await ranking();
    const m = me();
    const table = el('table', 'net-ranking');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['#', 'Gracz', 'Wygrane', 'Porażki', 'Mecze']) hr.append(el('th', '', h));
    thead.append(hr);
    const tbody = el('tbody');
    rows.forEach((x, i) => {
      const tr = el('tr', x.user_id === m?.id ? 'me' : '');
      const who = el('td', 'who');
      who.append(shield(x.avatar, 22), el('span', '', x.nick));
      tr.append(el('td', 'pos', String(i + 1)), who, el('td', '', String(x.wins)), el('td', '', String(x.losses)), el('td', '', String(x.games)));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    const body = rows.length ? table : msg('Ranking jest pusty — zagraj pierwszy mecz przez sieć.');
    const wrap = el('div', 'net-rankwrap');
    wrap.append(body);
    screen('Ranking', true, wrap, back(() => void showOnline(), 'Wróć do listy gier'));
  }

  // ---------------- pokój ----------------
  function enterRoom(room: Room): void {
    cleanup();
    const m = me()!;
    const host = room.host === m.id;
    const self: Member = { id: m.id, nick: m.nick, avatar: m.avatar };
    const link = roomLink(room.id, self);
    let preset = (room.preset in MAP_PRESETS ? room.preset : '1v1') as MapPresetId;
    let level = 2;
    let slots: Slot[] = [];
    let started = false;
    const fresh = (n: number, keep: Slot[] = []): Slot[] => {
      const out: Slot[] = Array.from({ length: n }, (_, i) => keep[i] ?? { kind: 'open' });
      // ludzie z obciętych miejsc przesiadają się na wolne
      for (const s of keep.slice(n)) if (s.kind === 'human') { const k = out.findIndex((x) => x.kind !== 'human'); if (k >= 0) out[k] = s; }
      return out;
    };
    slots = fresh(seats(preset));
    if (host) slots[0] = { kind: 'human', ...self };

    const box = el('div', 'net-roombox');
    const head = el('div', 'net-roomhead');
    const teams = el('div', 'net-teams');
    const note = msg(host ? 'Czekasz na graczy. Wolne miejsca możesz obsadzić botami albo zostawić — przy starcie zajmą je boty.' : 'Wybierz wolne miejsce. Mecz rozpocznie gospodarz.');
    const foot = el('div', 'menu-foot');
    const start = button('Rozpocznij mecz', () => doStart(), 'menu-btn');
    start.hidden = !host;
    const leave = button('Wyjdź z pokoju', () => { cleanup(); void showOnline(); }, 'menu-btn menu-back');
    foot.append(leave, start);
    // czat pokoju
    const chatBox = el('div', 'room-chat');
    const chatLog = el('div', 'room-chat-log');
    chatLog.setAttribute('role', 'log');
    chatLog.setAttribute('aria-live', 'polite');
    const chatForm = el('form', 'room-chat-form');
    const chatIn = el('input'); chatIn.maxLength = 200; chatIn.placeholder = 'Napisz do pokoju…'; chatIn.setAttribute('aria-label', 'Wiadomość czatu'); chatIn.autocomplete = 'off';
    const chatSend = el('button', 'menu-btn', 'Wyślij'); chatSend.type = 'submit';
    chatForm.append(chatIn, chatSend);
    chatBox.append(chatLog, chatForm);
    const addChat = (who: Member, text: string): void => {
      chatLog.append(chatLine({ who, text }, who.id === m.id));
      while (chatLog.children.length > 50) chatLog.firstElementChild!.remove();
      chatLog.scrollTop = chatLog.scrollHeight;
    };
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = cleanChat(chatIn.value);
      if (!text) return;
      link.send({ k: 'chat', who: self, text });
      addChat(self, text);
      chatIn.value = '';
    });
    // zaproszenie: link otwiera grę od razu w tym pokoju
    const invite = button('Kopiuj link zaproszenia', async () => {
      const url = `${location.origin}${location.pathname}?pokoj=${room.id}`;
      try { await navigator.clipboard.writeText(url); invite.textContent = 'Skopiowano — wyślij znajomemu'; }
      catch { prompt('Skopiuj link zaproszenia:', url); }
      setTimeout(() => { invite.textContent = 'Kopiuj link zaproszenia'; }, 2500);
    }, 'link-btn net-invite');
    // zaproszenia dla znajomych, którzy są teraz w grze
    const friendBox = el('div', 'room-friends');
    const paintFriends = async (): Promise<void> => {
      const { mine } = await listFriends();
      const on = onlinePlayers();
      const here = new Set(slots.filter((x) => x.kind === 'human').map((x) => (x as { id: string }).id));
      const avail = mine.map((f) => on.find((o) => o.id === f.id)).filter((o): o is OnlinePlayer => !!o && !here.has(o.id));
      friendBox.replaceChildren();
      if (!avail.length) { if (mine.length) friendBox.append(el('span', 'net-msg', 'Żaden z Twoich znajomych nie jest teraz w grze.')); return; }
      friendBox.append(el('span', 'net-label', 'Zaproś:'));
      for (const o of avail) {
        const b = button(o.nick, async () => { b.disabled = true; await sendInvite(o.id, room.id, room.name); b.textContent = `${o.nick} ✓`; }, 'net-filter');
        b.prepend(shield(o.avatar, 18));
        friendBox.append(b);
      }
    };
    void paintFriends();
    const offPresence = onPresence(() => void paintFriends());
    setStatus({ where: 'room', roomId: room.id, roomName: room.name });
    box.append(head, teams, note, invite, friendBox, chatBox);

    const publish = (): void => {
      if (!host) return;
      link.send({ k: 'lobby', preset, level, slots });
      const humans = slots.filter((s) => s.kind === 'human') as Extract<Slot, { kind: 'human' }>[];
      const guests = humans.filter((s) => s.id !== m.id).map((s) => s.nick);
      void updateRoom(room.id, { preset, guest_nick: `${humans.length}/${slots.length}${guests.length ? ` · ${guests.join(', ')}` : ''}` });
    };
    const paint = (): void => {
      head.replaceChildren();
      const title = el('div', 'net-roomtitle');
      title.append(el('strong', '', room.name), el('span', '', `mapa ${room.seed}`));
      head.append(title);
      if (host) {
        const ms = el('select'); ms.setAttribute('aria-label', 'Tryb');
        for (const [id, label] of MODES) { const o = el('option', '', label); o.value = id; ms.append(o); }
        ms.value = preset;
        ms.addEventListener('change', () => { preset = ms.value as MapPresetId; slots = fresh(seats(preset), slots); paint(); publish(); });
        const ls = el('select'); ls.setAttribute('aria-label', 'Poziom botów');
        LEVELS.forEach((n, i) => { const o = el('option', '', `Boty: ${n}`); o.value = String(i); ls.append(o); });
        ls.value = String(level);
        ls.addEventListener('change', () => { level = Number(ls.value); publish(); });
        head.append(ms, ls);
      } else head.append(el('span', 'net-chip', modeName(preset)), el('span', 'net-chip', `Boty: ${LEVELS[level]}`));
      teams.replaceChildren();
      for (const team of [0, 1]) {
        const col = el('div', 'net-team');
        const h = el('p', 'net-teamname', `Drużyna ${team + 1}`);
        h.style.setProperty('--team', hex(TEAM_COLORS[team] ?? 0x888888));
        col.append(h);
        slots.forEach((s, i) => {
          if (i % 2 !== team) return;
          const row = el('div', `net-slot ${s.kind}`);
          if (s.kind === 'human') row.append(shield(s.avatar, 30), el('strong', '', s.nick + (s.id === room.host ? ' (gospodarz)' : '') + (s.id === m.id ? ' — Ty' : '')));
          else if (s.kind === 'bot') row.append(el('span', 'net-bot', '⚙'), el('strong', '', `Bot (${LEVELS[level]})`));
          else row.append(el('span', 'net-open', '+'), el('span', '', 'Wolne miejsce'));
          const act = el('div', 'net-slot-act');
          if (host && s.kind === 'open') act.append(button('Dodaj bota', () => { slots[i] = { kind: 'bot' }; paint(); publish(); }, 'link-btn'));
          if (host && s.kind === 'bot') act.append(button('Usuń bota', () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'link-btn'));
          if (host && s.kind === 'human' && s.id !== m.id) act.append(button('Wyrzuć', () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'link-btn'));
          if (s.kind === 'open') {
            act.append(button('Usiądź tutaj', () => { if (host) { seat(m.id, i); } else link.send({ k: 'seat', id: m.id, slot: i }); }, 'link-btn'));
          }
          row.append(act);
          col.append(row);
        });
        teams.append(col);
      }
      start.disabled = !slots.some((s) => s.kind === 'human');
    };
    /** Gospodarz przesadza gracza na wolne miejsce */
    const seat = (id: string, i: number): void => {
      if (slots[i]?.kind !== 'open') return;
      const k = slots.findIndex((s) => s.kind === 'human' && s.id === id);
      const who = k >= 0 ? slots[k] : link.members().map((x) => ({ kind: 'human' as const, ...x })).find((x) => x.id === id);
      if (!who) return;
      if (k >= 0) slots[k] = { kind: 'open' };
      slots[i] = who;
      paint(); publish();
    };
    /** Gospodarz: przy zmianie obecności sadza nowych i zwalnia miejsca po tych, którzy wyszli */
    const sync = (): void => {
      if (!host || started) return;
      const here = link.members();
      let touched = false;
      slots.forEach((s, i) => { if (s.kind === 'human' && s.id !== m.id && !here.some((x) => x.id === s.id)) { slots[i] = { kind: 'open' }; touched = true; } });
      for (const x of here) {
        if (slots.some((s) => s.kind === 'human' && s.id === x.id)) continue;
        const k = slots.findIndex((s) => s.kind === 'open');
        if (k >= 0) { slots[k] = { kind: 'human', ...x }; touched = true; }
      }
      if (touched) paint();
      publish();
    };
    let hostSeen = host;
    const off = link.on((msgIn: NetMsg) => {
      if (msgIn.k === 'lobby' && !host) { preset = msgIn.preset as MapPresetId; level = msgIn.level; slots = msgIn.slots; hostSeen = true; paint(); }
      if (msgIn.k === 'hello' && host) sync();
      if (msgIn.k === 'seat' && host) seat(msgIn.id, msgIn.slot);
      if (msgIn.k === 'chat' && msgIn.who && typeof msgIn.text === 'string') addChat(msgIn.who, cleanChat(msgIn.text));
      if (msgIn.k === 'close' && !host) { cleanup(); void showOnline(); }
      if (msgIn.k === 'start' && !host) go(msgIn.preset as MapPresetId, msgIn.level, msgIn.seed, msgIn.slots);
    });
    const offMembers = link.onMembers(() => {
      if (host) { sync(); return; }
      // gospodarz zniknął z pokoju
      if (hostSeen && !link.members().some((x) => x.id === room.host)) { note.textContent = 'Gospodarz wyszedł z pokoju.'; note.classList.add('bad'); }
    });
    const go = (p: MapPresetId, lv: number, seed: string, final: Slot[]): void => {
      const meIdx = final.findIndex((s) => s.kind === 'human' && s.id === m.id);
      if (meIdx < 0) { note.textContent = 'Mecz ruszył bez Ciebie — nie było wolnego miejsca.'; note.classList.add('bad'); return; }
      started = true;
      const humans = final.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
      off(); offMembers(); offPresence(); leaveRoom = null;
      setStatus({ where: 'game' });
      const net = new Lockstep(link, meIdx, humans);
      ui.onStart({ room, seed, preset: p, level: lv, slots: final, me: meIdx, humans, link, net });
    };
    const doStart = (): void => {
      const final: Slot[] = slots.map((s) => (s.kind === 'open' ? { kind: 'bot' } : s));
      link.send({ k: 'start', preset, level, seed: room.seed, slots: final });
      void updateRoom(room.id, { status: 'playing' });
      go(preset, level, room.seed, final);
    };
    leaveRoom = () => {
      off(); offMembers(); offPresence();
      setStatus({ where: 'menu' });
      if (host) { link.send({ k: 'close' }); void deleteRoom(room.id); }
      link.close();
    };
    void link.ready.then(() => { if (!host) link.send({ k: 'hello', who: self }); else sync(); });
    // gość: gdy gospodarz nie odpowiada, pokój jest porzucony (zamknięta karta) — nie czekamy w nieskończoność
    if (!host) setTimeout(() => {
      if (hostSeen || started) return;
      note.textContent = 'Gospodarz nie odpowiada — ten pokój jest porzucony. Wróć do listy gier.';
      note.classList.add('bad');
    }, 6000);
    paint();
    screen('Pokój', true, box, foot);
  }

  /** Twarde wyjście (np. zamknięcie strony): zamyka pokój, jeśli w nim jesteśmy */
  const leave = (): void => cleanup();
  /** Wejście z linku zaproszenia (?pokoj=…): logowanie, jeśli trzeba, potem prosto do pokoju */
  async function join(id: string): Promise<void> {
    cleanup();
    screen('Zaproszenie', true, msg('Łączenie z pokojem…'));
    await restore();
    if (!me()) { showLogin(false, 'Zaloguj się, żeby dołączyć do gry znajomego.', () => void join(id)); return; }
    const room = await getRoom(id);
    if (typeof room === 'string' || room.status !== 'open') {
      screen('Zaproszenie', true, msg(typeof room === 'string' ? 'Tej gry już nie ma — gospodarz ją zamknął.' : 'Ten mecz już się zaczął.', true), back(() => void showOnline(), 'Przejdź do listy gier'));
      return;
    }
    enterRoom(room);
  }

  return { showOnline: () => void showOnline(), showAccount, showLogin: (register = false) => showLogin(register), join: (id) => void join(id), leave };
}

import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { TEAM_COLORS } from '../data/teams';
import { Lockstep } from '../net/lockstep';
import {
  closeMyStaleRooms, createRoom, onInvite, onlinePlayers, onPresence, setStatus, deleteRoom, getRoom, listRooms, myAwards, myRecord, myResults, ranking, me, progress, levelsOf, knownLevel, restore, roomLink, isAdmin, reloadMe, setAvatar, setNick, setPassword, sendReset, onPasswordRecovery, signIn, signOut, signUp, updateRoom, watchRooms,
  type Invite, type Member, type NetMsg, type Room, type RoomLink, type Slot,
} from '../net/supa';
import { avatarSvg, CHARGE_NAMES, CREST_CHARGES, crestPreview, decodeCrest, DIVISIONS, encodeCrest, TINCTURES, type Crest } from './avatars';
import { BADGES, levelOf, nextTitle, TITLES, titleOf, titleRank, xpUntil, type BadgeDef } from '../data/progress';
import { chatLine, cleanChat } from './chat';
import { adminPane } from './adminPanel';
import { adminNotesPane } from './testerNotes';
import { friendsView } from './friendsView';
import { openProfileModal } from './playerProfile';
import { openChat } from './messenger';
import { befriend, friendLists, inviteToGame, searchPlayers, type Player } from '../net/social';
import { whereText } from './friendsView';
import { lang, tx } from '../i18n';

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
  /** Kooperacja: wszyscy ludzie w drużynie 1 przeciw wzmocnionym botom */
  coop: boolean;
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
  /** Podgląd mapy za panelem pokoju (ta sama, którą wszyscy dostaną po starcie) */
  preview(seed: string, preset: MapPresetId): void;
  previewEnd(): void;
  /** Otwiera wybór nowej gry (przycisk „Do boju” w „Moim rodzie”) */
  play?(): void;
}

const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];
const MODES: [MapPresetId, string][] = [['1v1', tx('1 na 1', '1 vs 1')], ['2v2', tx('2 na 2', '2 vs 2')], ['4v4', tx('4 na 4', '4 vs 4')]];
const LEVELS = lang() === 'en' ? ['Peaceful', 'Easy', 'Medium', 'Hard'] : ['Pokojowe', 'Łatwe', 'Średnie', 'Trudne'];
const seats = (preset: string): number => (MAP_PRESETS[preset as MapPresetId]?.starts.length ?? 1) * 2;
const modeName = (preset: string): string => MODES.find(([id]) => id === preset)?.[1] ?? preset;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function createOnline(ui: Ui): { showOnline(): void; showAccount(): void; showHouse(tab?: number, note?: number): void; showFriends(tab?: number, profile?: string, chat?: string): void; showLogin(register?: boolean): void; join(id: string): void; leave(): void } {
  const { el, button, screen } = ui;
  const inMatch = (): boolean => ui.inMatch();
  let stopWatch: (() => void) | null = null;
  /** Wyjście z pokoju przy przejściu na inny ekran */
  let leaveRoom: (() => void) | null = null;
  /** Numer ostatniego otwarcia lobby: wynik spóźnionego zapytania nie maluje już ekranu, z którego gracz wyszedł */
  let lobbySeq = 0;
  const cleanup = (): void => { lobbySeq++; stopWatch?.(); stopWatch = null; leaveRoom?.(); leaveRoom = null; };

  const msg = (text: string, bad = false): HTMLElement => { const p = el('p', bad ? 'net-msg bad' : 'net-msg', text); p.setAttribute('role', 'status'); return p; };
  const back = (to: () => void = () => { cleanup(); ui.showMain(); }, text = tx('Wróć', 'Back')): HTMLButtonElement => button(text, to, 'menu-btn menu-back');
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
    const [wp, pass] = field(tx('Hasło (min. 6 znaków)', 'Password (min. 6 characters)'), 'password', register ? 'new-password' : 'current-password');
    const [wn, nick] = field(tx('Nick w grze (3–20 znaków)', 'In-game nickname (3–20 characters)'), 'text', 'nickname');
    email.required = pass.required = true;
    wn.hidden = !register; nick.required = register;
    const note = msg(info, !!info && !info.startsWith(tx('Konto', 'Account')));
    const go = el('button', 'menu-btn', register ? tx('Załóż konto', 'Create account') : tx('Zaloguj', 'Sign in')); go.type = 'submit';
    const swap = button(register ? tx('Mam już konto — zaloguj', 'I already have an account — sign in') : tx('Nie mam konta — zarejestruj', 'No account yet — register'), () => showLogin(!register, '', then), 'link-btn net-swap');
    const forgot = button(tx('Nie pamiętam hasła', 'I forgot my password'), () => showForgot(email.value.trim()), 'link-btn net-swap');
    forgot.hidden = register;
    form.append(we, wp, wn, note, go, swap, forgot);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); go.disabled = true; note.textContent = tx('Chwila…', 'One moment…'); note.classList.remove('bad');
      const err = register ? await signUp(email.value.trim(), pass.value, nick.value) : await signIn(email.value.trim(), pass.value);
      go.disabled = false;
      if (err && register && err.startsWith(tx('Konto', 'Account'))) { showLogin(false, err, then); return; }
      if (err) { note.textContent = err; note.classList.add('bad'); return; }
      then();
    });
    screen(register ? tx('Nowe konto', 'New account') : tx('Logowanie', 'Sign in'), false, form, back());
  }

  /** Nie pamiętam hasła: mail z linkiem do ustawienia nowego */
  function showForgot(prefill = ''): void {
    cleanup();
    const form = el('form', 'menu-form net-form');
    const [we, email] = field('E-mail', 'email', 'email');
    email.required = true; email.value = prefill;
    const note = msg(tx('Wyślemy link do ustawienia nowego hasła.', 'We will send you a link to set a new password.'));
    const go = el('button', 'menu-btn', tx('Wyślij link', 'Send link')); go.type = 'submit';
    form.append(we, note, go);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); go.disabled = true; note.textContent = tx('Chwila…', 'One moment…'); note.classList.remove('bad');
      const err = await sendReset(email.value.trim());
      go.disabled = false;
      if (err) { note.textContent = err; note.classList.add('bad'); return; }
      note.textContent = tx('Wysłane. Otwórz link z maila (sprawdź też spam) — wrócisz tu i ustawisz nowe hasło.', 'Sent. Open the link in the e-mail (check spam too) — you will come back here to set a new password.');
    });
    screen(tx('Nie pamiętam hasła', 'Forgotten password'), false, form, back(() => showLogin(false)));
  }
  /** Po kliknięciu linku z maila: nowe hasło */
  function showNewPassword(): void {
    cleanup();
    const form = el('form', 'menu-form net-form');
    const [wp, pass] = field(tx('Nowe hasło (min. 6 znaków)', 'New password (min. 6 characters)'), 'password', 'new-password');
    pass.required = true;
    const note = msg('');
    const go = el('button', 'menu-btn', tx('Ustaw hasło', 'Set password')); go.type = 'submit';
    form.append(wp, note, go);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); go.disabled = true;
      const err = await setPassword(pass.value);
      go.disabled = false;
      if (err) { note.textContent = err; note.classList.add('bad'); return; }
      await restore();
      note.textContent = tx('Hasło zmienione — jesteś zalogowany.', 'Password changed — you are signed in.');
      setTimeout(() => ui.showMain(), 1200);
    });
    screen(tx('Nowe hasło', 'New password'), false, form, back());
  }
  onPasswordRecovery(() => showNewPassword());

  // ---------------- „Mój ród”: pan na zamku — wizytówka, cel, przegląd, kronika meczów i herb ----------------
  /** Małe ikony odznak (rysowane, bez emoji) */
  const BADGE_ICONS: Record<BadgeDef['icon'], string> = {
    sword: '<path d="M16 3l3 3-9 9-2 0 0-2z M7 14l3 3 M5 16l3 3-2 2-3-3z"/>',
    swords: '<path d="M4 3l11 11 M14 14l2 4 4-4-4-2 M20 3L9 14 M10 14l-2 4-4-4 4-2"/>',
    banner: '<path d="M6 21V3 M6 4h12l-3 4 3 4H6"/>',
    tower: '<path d="M6 21V8h12v13z M6 8V4h2v2h2V4h4v2h2V4h2v4 M10 21v-5h4v5"/>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6v2h10v-2c0-2 2-3 2-6a7 7 0 0 0-7-7z M9 11h.01 M15 11h.01 M10 18v3 M14 18v3"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    hammer: '<path d="M14 4l6 6-3 3-6-6z M12 9L4 17l3 3 8-8"/>',
    fire: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-3-1-5 0-7z"/>',
    hourglass: '<path d="M6 3h12 M6 21h12 M7 3c0 5 10 6 10 9s-10 4-10 9 M17 3c0 5-10 6-10 9s10 4 10 9"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M12 7v10"/>',
  };
  const icon = (k: BadgeDef['icon']): string => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BADGE_ICONS[k]}</svg>`;
  const modeLabel = (mode: string): string => mode === 'online' ? tx('Przez sieć', 'Online') : mode === 'coop' ? tx('Razem przeciw botom', 'Co-op vs bots') : mode.startsWith('bots') ? `${tx('Z botami', 'Vs bots')} · ${LEVELS[Number(mode.slice(4))] ?? ''}` : mode;
  const when = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  function showHouse(tab = 0, noteFocus?: number): void {
    cleanup();
    const m = me();
    if (!m) { showLogin(false, '', () => showHouse(tab)); return; }
    const crest: Crest = decodeCrest(m.avatar);
    const pr = progress();
    const p = pr ?? { xp: 0, level: 1, matches: 0, wins: 0, kills: 0 };
    const lv = levelOf(p.xp);
    const box = el('div', 'house');

    // --- wizytówka: herb, imię, tytuł, poziom i pasek PD ---
    const hero = el('div', 'house-hero');
    const heroCrest = el('div', 'house-crest');
    const paintHero = (): void => { heroCrest.innerHTML = crestPreview(crest, 150); };
    const id = el('div', 'house-id');
    id.append(el('h3', 'house-name', m.nick), el('p', 'house-title', titleOf(lv.level)));
    const bar = el('div', 'house-xp');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(lv.need)); bar.setAttribute('aria-valuenow', String(lv.into));
    bar.setAttribute('aria-label', tx('Doświadczenie do następnego poziomu', 'Experience to the next level'));
    const fill = el('span', 'house-xp-fill'); fill.style.width = `${Math.round((lv.into / lv.need) * 100)}%`; bar.append(fill);
    const xpLine = el('p', 'house-xp-line');
    xpLine.append(el('strong', '', `${lv.into} / ${lv.need} ${tx('PD', 'XP')}`), el('span', '', tx(`do poziomu ${lv.level + 1}`, `to level ${lv.level + 1}`)));
    id.append(bar, xpLine);
    const medal = el('div', 'house-level');
    medal.setAttribute('aria-label', tx(`Poziom ${lv.level}`, `Level ${lv.level}`));
    medal.append(el('span', 'house-level-n', String(lv.level)), el('span', 'house-level-t', tx('poziom', 'level')));
    hero.append(heroCrest, id, medal);

    // --- najbliższy cel: kolejny tytuł i przycisk do gry ---
    const goal = el('div', 'house-goal');
    const nt = nextTitle(lv.level);
    const goalText = el('p', 'house-goal-text');
    if (nt) {
      const need = xpUntil(p.xp, nt.from);
      goalText.append(el('span', 'house-goal-k', tx('Następny tytuł', 'Next rank')), el('strong', '', tx(nt.pl, nt.en)),
        el('span', '', tx(`poziom ${nt.from} · brakuje ${need} PD`, `level ${nt.from} · ${need} XP to go`)));
    } else goalText.append(el('span', 'house-goal-k', tx('Najwyższy tytuł', 'Highest rank')), el('strong', '', titleOf(lv.level)), el('span', '', tx('Bij się o miejsce w rankingu.', 'Fight for your place in the ranking.')));
    goal.append(goalText);
    if (ui.play) goal.append(button(tx('Do boju', 'To battle'), () => ui.play!(), 'menu-btn house-play'));

    // --- zakładki ---
    const tabs = el('div', 'menu-tabs top house-tabs');
    const nav = el('div', 'menu-nav'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', tx('Mój ród', 'My house'));
    const pane = el('div', 'menu-pane house-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = 'house-pane';
    const tabBtns: HTMLButtonElement[] = [];

    const overview = (): Node[] => {
      const out: Node[] = [];
      // statystyki
      const stats = el('dl', 'house-stats');
      const rate = p.matches ? `${Math.round((p.wins / p.matches) * 100)}%` : '—';
      for (const [k, v] of [[tx('Bitwy', 'Battles'), String(p.matches)], [tx('Zwycięstwa', 'Victories'), String(p.wins)], [tx('Skuteczność', 'Win rate'), rate], [tx('Pokonani wrogowie', 'Foes slain'), String(p.kills)]] as const) {
        const d = el('div', 'house-stat'); d.append(el('dt', '', k), el('dd', '', v)); stats.append(d);
      }
      out.push(stats);
      // droga tytułów
      out.push(el('h4', 'house-h', tx('Droga do korony', 'The road to the crown')));
      const road = el('ol', 'house-road');
      const now = titleRank(lv.level);
      TITLES.forEach((t, i) => {
        const li = el('li', i < now ? 'done' : i === now ? 'now' : 'next');
        if (i === now) li.setAttribute('aria-current', 'step');
        const dot = el('span', 'house-road-dot'); dot.append(el('span', '', i < now ? '✓' : String(i + 1)));
        li.append(dot, el('strong', '', tx(t.pl, t.en)), el('span', '', tx(`poziom ${t.from}`, `level ${t.from}`)));
        road.append(li);
      });
      out.push(road);
      // odznaki
      const got = BADGES.filter((b) => b.of({ ...p, level: lv.level }) >= b.goal).length;
      out.push(el('h4', 'house-h', tx(`Odznaki · ${got} z ${BADGES.length}`, `Badges · ${got} of ${BADGES.length}`)));
      const badges = el('ul', 'house-badges');
      for (const b of BADGES) {
        const have = Math.min(b.goal, b.of({ ...p, level: lv.level }));
        const ok = have >= b.goal;
        const li = el('li', ok ? 'house-badge got' : 'house-badge');
        const ic = el('span', 'house-badge-ic'); ic.innerHTML = icon(b.icon);
        const txt = el('div', 'house-badge-txt');
        const [name, desc] = lang() === 'en' ? b.en : b.pl;
        const count = b.icon === 'hourglass' ? `${Math.floor(have / 60)}/${b.goal / 60} h` : `${have}/${b.goal}`;
        txt.append(el('strong', '', name), el('span', '', ok ? tx('zdobyta', 'earned') : `${desc} · ${count}`));
        if (!ok && b.goal > 1) { const pb = el('span', 'house-badge-bar'); const f = el('span', ''); f.style.width = `${Math.round((have / b.goal) * 100)}%`; pb.append(f); txt.append(pb); }
        li.append(ic, txt);
        badges.append(li);
      }
      out.push(badges);
      // skąd PD
      out.push(el('h4', 'house-h', tx('Skąd brać doświadczenie', 'How to earn experience')));
      const how = el('ul', 'house-how');
      for (const [a, b] of [
        [tx('Zwycięstwo', 'Victory'), '+100'], [tx('Porażka — też uczy', 'Defeat — still a lesson'), '+30'], [tx('Minuta bitwy (do 60)', 'Minute of battle (up to 60)'), '+2'],
        [tx('Pokonany wróg', 'Foe slain'), '+2'], [tx('Zburzony budynek wroga', 'Enemy building razed'), '+5'], [tx('Postawiony budynek', 'Building raised'), '+1'],
      ]) { const li = el('li'); li.append(el('span', '', a!), el('strong', '', b!)); how.append(li); }
      out.push(how, el('p', 'house-note', tx('Najwięcej daje gra przez sieć z ludźmi. Mecze z botami liczą się słabiej — im trudniejszy bot, tym więcej PD.', 'Online matches against people pay best. Matches against bots count for less — the harder the bot, the more XP.')));
      return out;
    };

    const chronicle = (): Node[] => {
      const wrapC = el('div', 'house-chron');
      wrapC.append(msg(tx('Wczytuję kronikę…', 'Loading the chronicle…')));
      void myAwards(25).then((rows) => {
        if (!wrapC.isConnected) return;
        if (rows === null) { wrapC.replaceChildren(msg(tx('Kronika jest chwilowo niedostępna.', 'The chronicle is unavailable right now.'), true)); return; }
        if (!rows.length) {
          const empty = el('div', 'house-empty');
          empty.append(el('p', '', tx('Kronika jest jeszcze pusta. Każdy rozegrany mecz trafi tutaj — z wynikiem, czasem i zdobytym doświadczeniem.', 'The chronicle is still empty. Every match you play lands here — with the result, time and experience earned.')));
          if (ui.play) empty.append(button(tx('Rozegraj pierwszą bitwę', 'Fight your first battle'), () => ui.play!(), 'menu-btn'));
          wrapC.replaceChildren(empty);
          return;
        }
        const table = el('table', 'house-table');
        const cap = el('caption', '', tx('Ostatnie bitwy', 'Recent battles')); table.append(cap);
        const head = el('tr');
        for (const h of [tx('Kiedy', 'When'), tx('Rodzaj', 'Type'), tx('Wynik', 'Result'), tx('Czas', 'Time'), tx('Wrogowie', 'Foes'), tx('PD', 'XP')]) { const th = el('th', '', h); th.scope = 'col'; head.append(th); }
        const thead = el('thead'); thead.append(head); table.append(thead);
        const tb = el('tbody');
        for (const r of rows) {
          const tr = el('tr');
          const res = el('td', r.won ? 'won' : 'lost', r.won ? tx('Zwycięstwo', 'Victory') : tx('Porażka', 'Defeat'));
          tr.append(el('td', '', when(r.created_at)), el('td', '', modeLabel(r.mode)), res, el('td', '', `${r.minutes} min`), el('td', '', String(r.kills)), el('td', 'xp', `+${r.xp}`));
          tb.append(tr);
        }
        table.append(tb);
        wrapC.replaceChildren(table);
      });
      return [wrapC];
    };

    const arms = (): Node[] => {
      const wrapA = el('div', 'house-arms');
      const prev = el('div', 'house-arms-prev');
      const paintPrev = (): void => { prev.innerHTML = crestPreview(crest, 150); paintHero(); };
      const note = msg('');
      const save = button(tx('Zapisz herb', 'Save the arms'), async () => {
        const code = encodeCrest(crest);
        save.disabled = true;
        const err = await setAvatar(code);
        save.disabled = false;
        if (err) { note.textContent = err; note.classList.add('bad'); return; }
        note.classList.remove('bad');
        note.textContent = tx('Herb zapisany — widać go w pokojach, na liście znajomych, w rankingu i w czacie.', 'Arms saved — they now show in rooms, your friends list, the ranking and the chat.');
      }, 'menu-btn');
      const left = el('div', 'house-arms-left'); left.append(prev, save, note);
      const right = el('div', 'house-arms-right');
      const group = (label: string, count: number, current: () => number, set: (i: number) => void, face: (i: number) => string, name: (i: number) => string, swatch: boolean): HTMLElement => {
        const w = el('div', 'house-group');
        const lab = el('h4', 'house-h', label);
        const row = el('div', swatch ? 'house-swatches' : 'house-pieces');
        row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', label);
        const btns: HTMLButtonElement[] = [];
        const mark = (): void => btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i === current())); b.tabIndex = i === current() ? 0 : -1; });
        const repaintFaces = (): void => { if (!swatch) btns.forEach((b, i) => { b.innerHTML = face(i); }); };
        for (let i = 0; i < count; i++) {
          const b = el('button', swatch ? 'house-swatch' : 'house-piece') as HTMLButtonElement;
          b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', name(i)); b.title = name(i);
          if (swatch) b.style.setProperty('--sw', face(i)); else b.innerHTML = face(i);
          b.addEventListener('click', () => { set(i); mark(); paintPrev(); refresh(); note.textContent = ''; });
          btns.push(b); row.append(b);
        }
        row.addEventListener('keydown', (e) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault();
          const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          const i = (current() + d + count) % count;
          set(i); mark(); paintPrev(); refresh(); btns[i]!.focus();
        });
        mark();
        refreshers.push(repaintFaces);
        w.append(lab, row);
        return w;
      };
      // podglądy podziałów i godeł odświeżają się po zmianie barw, żeby było widać, jak będzie wyglądał herb
      const refreshers: (() => void)[] = [];
      const refresh = (): void => refreshers.forEach((f) => f());
      const tName = (i: number): string => tx(TINCTURES[i]![1], TINCTURES[i]![2]);
      const T = TINCTURES.length;
      right.append(
        group(tx('Pole', 'Field'), T, () => crest.field, (i) => { crest.field = i; }, (i) => TINCTURES[i]![0], tName, true),
        group(tx('Podział tarczy', 'Division'), DIVISIONS.length, () => crest.division, (i) => { crest.division = i; }, (i) => crestPreview({ ...crest, division: i }, 34), (i) => tx(DIVISIONS[i]![0], DIVISIONS[i]![1]), false),
        group(tx('Drugie pole', 'Second field'), T, () => crest.field2, (i) => { crest.field2 = i; }, (i) => TINCTURES[i]![0], tName, true),
        group(tx('Godło', 'Charge'), CREST_CHARGES, () => crest.charge, (i) => { crest.charge = i; }, (i) => crestPreview({ ...crest, charge: i }, 34), (i) => tx(CHARGE_NAMES[i]![0], CHARGE_NAMES[i]![1]), false),
        group(tx('Barwa godła', 'Charge colour'), T, () => crest.tincture, (i) => { crest.tincture = i; }, (i) => TINCTURES[i]![0], tName, true),
      );
      paintPrev();
      wrapA.append(left, right);
      return [wrapA];
    };

    const TABS: [string, () => Node[]][] = [[tx('Przegląd', 'Overview'), overview], [tx('Kronika bitew', 'Battle chronicle'), chronicle], [tx('Herb', 'Coat of arms'), arms]];
    // panel kont tylko dla administratorów (prawa sprawdza i tak baza przy każdej zmianie)
    if (isAdmin()) {
      TABS.push([tx('Administracja', 'Administration'), () => adminPane(() => void reloadMe().then(() => showHouse(3)))]);
      TABS.push([tx('Uwagi testerów', 'Tester notes'), () => adminNotesPane(noteFocus)]);
    }
    const show = (i: number): void => {
      tabBtns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      pane.replaceChildren(...TABS[i]![1]());
    };
    TABS.forEach(([name], i) => {
      const b = button(name, () => show(i), 'menu-tab');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
      tabBtns.push(b); nav.append(b);
    });
    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      const i = tabBtns.indexOf(document.activeElement as HTMLButtonElement);
      const n = (Math.max(0, i) + (e.key === 'ArrowRight' ? 1 : tabBtns.length - 1)) % tabBtns.length;
      show(n); tabBtns[n]!.focus();
    });
    tabs.append(nav, pane);
    paintHero();
    show(Math.max(0, Math.min(TABS.length - 1, tab)));

    if (!pr) goalText.append(el('span', '', tx('Poziomy i statystyki ruszą po pierwszym meczu.', 'Levels and statistics start after your first match.')));
    hero.append(goal);
    box.append(hero, tabs);
    const foot = el('div', 'menu-foot');
    foot.append(button(tx('Konto i hasło', 'Account and password'), () => showAccount(), 'menu-btn menu-back'), back());
    screen(tx('Mój ród', 'My house'), true, box, foot);
    asBook(box, 'house-book');
    tabBtns[Math.max(0, Math.min(TABS.length - 1, tab))]?.focus();
  }

  /**
   * Mój ród i konto jak księga (Michał 28.10: „postać i konto mega czytelne”): okno na całą prawą część menu,
   * jak „Jak grać”, zamiast wąskiego panelu z drobnym pismem. `screen()` zdejmuje te klasy przy każdym innym oknie.
   */
  const asBook = (box: HTMLElement, cls: string): void => {
    const panel = box.closest('.menu-panel');
    panel?.classList.add('book', cls);
    panel?.closest('.menu')?.classList.add('book-open');
    const clear = (): void => { if (!box.isConnected) { panel?.classList.remove(cls); obs.disconnect(); } };
    const obs = new MutationObserver(clear);
    if (panel) obs.observe(panel, { childList: true, subtree: true });
  };

  /** Tytuł przy nicku (gdy znamy poziom gracza) */
  const titleChip = (id: string): HTMLElement | null => {
    const l = knownLevel(id);
    return l === undefined ? null : el('span', 'net-title', `${titleOf(l)} · ${l}`);
  };

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
    const note = msg('');
    // herb składa się na ekranie „Mój ród” (pole, podział, godło, barwy)
    const pick = button(tx('Herb i ród →', 'Arms and house →'), () => showHouse(), 'menu-btn');
    // nick
    const nickForm = el('form', 'net-inline');
    const [wn, nick] = field(tx('Nick', 'Nickname'), 'text', 'nickname');
    nick.value = m.nick; nick.maxLength = 20;
    const saveNick = el('button', 'menu-btn', tx('Zapisz nick', 'Save nickname')); saveNick.type = 'submit';
    nickForm.append(wn, saveNick);
    nickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = await setNick(nick.value);
      note.textContent = err ?? tx('Nick zapisany.', 'Nickname saved.'); note.classList.toggle('bad', !!err);
      if (!err) (who.firstElementChild as HTMLElement).textContent = me()!.nick;
    });
    // hasło
    const passForm = el('form', 'net-inline');
    const [wp, pass] = field(tx('Nowe hasło', 'New password'), 'password', 'new-password');
    const [wp2, pass2] = field(tx('Powtórz hasło', 'Repeat password'), 'password', 'new-password');
    const savePass = el('button', 'menu-btn', tx('Zmień hasło', 'Change password')); savePass.type = 'submit';
    passForm.append(wp, wp2, savePass);
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (pass.value !== pass2.value) { note.textContent = tx('Hasła się różnią.', 'Passwords do not match.'); note.classList.add('bad'); return; }
      const err = await setPassword(pass.value);
      note.textContent = err ?? tx('Hasło zmienione.', 'Password changed.'); note.classList.toggle('bad', !!err);
      if (!err) { pass.value = ''; pass2.value = ''; }
    });
    const out = button(tx('Wyloguj', 'Sign out'), async () => { await signOut(); ui.showMain(); }, 'menu-btn menu-back');
    const left = el('div', 'net-col');
    // bilans i ostatnie mecze przez sieć
    const record = el('p', 'net-record', tx('Bilans: wczytuję…', 'Record: loading…'));
    const history = el('ol', 'net-history');
    history.setAttribute('aria-label', tx('Ostatnie mecze', 'Recent matches'));
    void Promise.all([myRecord(), myResults()]).then(([rec, list]) => {
      record.replaceChildren(el('strong', '', `${rec?.wins ?? 0}`), tx(' wygranych · ', ' wins · '), el('strong', '', `${rec?.losses ?? 0}`), tx(' porażek', ' losses'));
      history.replaceChildren(...(list.length ? list.map((x) => {
        const li = el('li', x.won ? 'won' : 'lost');
        li.append(el('span', 'res', x.won ? tx('Wygrana', 'Victory') : tx('Porażka', 'Defeat')), el('span', '', `${modeName(x.preset)} · ${x.minutes} min`), el('span', 'when', new Date(x.created_at).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short' })));
        return li;
      }) : [el('li', 'none', tx('Jeszcze żadnego meczu przez sieć.', 'No online matches yet.'))]));
    });
    left.append(card, record, history, pick);
    const right = el('div', 'net-col');
    right.append(nickForm, passForm, note);
    const cols = el('div', 'net-cols');
    cols.append(left, right);
    box.append(cols);
    const foot = el('div', 'menu-foot');
    foot.append(out, back());
    screen(tx('Twoje konto', 'Your account'), true, box, foot);
    asBook(box, 'account-book');
  }

  // ---------------- lista gier ----------------
  let filter: MapPresetId | 'all' = 'all';
  async function showOnline(): Promise<void> {
    cleanup();
    const seq = ++lobbySeq;
    const title = tx('Gra przez sieć', 'Online play');
    // od razu pełny układ okna (bez skoku): zalogowany widzi lobby od pierwszej chwili, lista gier doczytuje się w miejscu
    let m = me();
    if (!m) {
      const wait = el('div', 'net-lobby net-wait');
      wait.append(msg(tx('Łączenie…', 'Connecting…')));
      screen(title, true, wait, back());
      await restore();
      if (seq !== lobbySeq) return;
      m = me();
      if (!m) { showLogin(false, tx('Zaloguj się, żeby grać przez sieć.', 'Sign in to play online.'), () => void showOnline()); return; }
    }
    // Lobby (Michał 3.11.2026: „rozbuduj, łatwiejsze — szukanie znajomych, zaproszenie do gry”): po lewej szybkie
    // działania i lista otwartych gier, po prawej znajomi w grze (zaproś, dołącz, napisz) i szukanie graczy
    const me0 = m;
    const wrap = el('div', 'lob');
    const main = el('div', 'lob-main');
    const side = el('aside', 'lob-side'); side.setAttribute('aria-label', tx('Znajomi', 'Friends'));
    const note = msg('');
    const newSeed = (): string => `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
    const makeRoom = async (preset: string, nm?: string): Promise<Room | null> => {
      const res = await createRoom(nm?.trim() || tx(`Gra ${me0.nick}`, `${me0.nick}'s game`), preset, newSeed());
      if (typeof res === 'string') { note.textContent = res; note.classList.add('bad'); return null; }
      return res;
    };

    // --- pasek startu (Michał 3.11.2026: „krzywo i staro”): jedna równa belka — duże „Graj teraz” i obok własna gra
    // w jednym wierszu (nazwa, tryb, „Załóż”); ranking jako przycisk przy nagłówku listy
    const quick = el('section', 'lob-hero');
    quick.setAttribute('aria-label', tx('Nowa gra przez sieć', 'New online game'));
    const fastBox = el('div', 'lob-fast');
    const fast = button('', async () => {
      fast.disabled = true; const r = await makeRoom('1v1'); fast.disabled = false;
      if (r) enterRoom(r);
    }, 'lob-play');
    fast.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';
    const playT = el('span', 'lob-play-t'); playT.append(el('strong', '', tx('Graj teraz', 'Play now')), el('span', '', tx('pokój 1 na 1 od ręki', 'a 1 vs 1 room right away')));
    fast.append(playT);
    fastBox.append(fast);
    const form = el('form', 'lob-form');
    const nid = `lob-name-${seq}`;
    const nl = el('label', 'lob-form-l', tx('Własna gra', 'Custom game')); nl.htmlFor = nid;
    const name = el('input'); name.id = nid; name.maxLength = 40; name.value = tx(`Gra ${me0.nick}`, `${me0.nick}'s game`);
    name.addEventListener('keydown', (e) => e.stopPropagation());
    let preset: MapPresetId = filter !== 'all' ? filter : '1v1';
    const seg = el('div', 'lob-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', tx('Tryb', 'Mode'));
    const segBtns: HTMLButtonElement[] = [];
    for (const [id, label] of MODES) {
      const b = button(label, () => { preset = id; segBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b))); }, 'lob-chip');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(id === preset));
      segBtns.push(b); seg.append(b);
    }
    const mk = el('button', 'lob-make', tx('Załóż grę', 'Create game')); mk.type = 'submit';
    const row = el('div', 'lob-form-row'); row.append(name, seg, mk);
    form.append(nl, row);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); mk.disabled = true;
      const r = await makeRoom(preset, name.value); mk.disabled = false;
      if (r) enterRoom(r);
    });
    quick.append(fastBox, form);
    // --- otwarte gry ---
    const head = el('div', 'lob-list-h');
    const tabs = el('div', 'lob-filters'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', tx('Tryb gier', 'Game mode'));
    for (const [id, nm] of [['all', tx('Wszystkie', 'All')], ...MODES] as [MapPresetId | 'all', string][]) {
      const b = button(nm, () => { filter = id; tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); void draw(); }, 'lob-chip');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(filter === id));
      tabs.append(b);
    }
    const count = el('span', 'lob-count');
    const rk = button(tx('Ranking', 'Ranking'), () => void showRanking(), 'lob-chip lob-rank');
    const ht = el('div', 'lob-list-t'); ht.append(el('h3', 'lob-h', tx('Otwarte gry', 'Open games')), count);
    head.append(ht, tabs, rk);
    const list = el('div', 'lob-rooms');
    const draw = async (): Promise<void> => {
      const all = await listRooms();
      const rooms = all.filter((r) => filter === 'all' || r.preset === filter);
      if (seq !== lobbySeq) return;
      count.textContent = tx(`${rooms.length} ${rooms.length === 1 ? 'gra' : 'gier'}`, `${rooms.length} game${rooms.length === 1 ? '' : 's'}`);
      if (!rooms.length) {
        const empty = el('div', 'lob-empty');
        empty.append(el('strong', '', filter === 'all' ? tx('Nikt jeszcze nie założył gry', 'Nobody has opened a game yet') : tx(`Nie ma gier ${modeName(filter)}`, `No ${modeName(filter)} games`)),
          el('span', '', tx('Kliknij „Graj teraz” albo zaproś znajomego z listy obok — wolne miejsca możesz obsadzić botami.', 'Click “Play now” or invite a friend from the list beside — you can fill empty seats with bots.')));
        list.replaceChildren(empty);
        return;
      }
      list.replaceChildren(...rooms.map((r) => {
        const playing = r.status === 'playing';
        const card = el('article', `lob-room${playing ? ' busy' : ''}`);
        const badge = el('span', 'lob-mode', modeName(r.preset));
        const info = el('div', 'lob-room-info');
        const seats = /^(\d+)\/(\d+)/.exec(r.guest_nick ?? '');
        info.append(el('strong', '', r.name), el('span', '', tx(`gospodarz ${r.host_nick}`, `host ${r.host_nick}`)));
        const meta = el('div', 'lob-room-meta');
        if (seats) meta.append(el('span', 'lob-seats', tx(`${seats[1]} z ${seats[2]} graczy`, `${seats[1]} of ${seats[2]} players`)));
        meta.append(el('span', playing ? 'net-tag busy' : 'net-tag', playing ? tx('trwa mecz', 'in progress') : tx('czeka', 'waiting')));
        card.append(badge, info, meta);
        if (!playing) card.append(button(r.host === me0.id ? tx('Wróć do pokoju', 'Back to room') : tx('Dołącz', 'Join'), () => enterRoom(r), 'menu-btn btn-ok lob-btn'));
        return card;
      }));
    };
    const loading = el('div', 'lob-empty'); loading.append(el('strong', '', tx('Wczytuję gry…', 'Loading games…')));
    list.replaceChildren(loading);
    main.append(quick, note, head, list);

    // --- znajomi: w grze, zaproś, dołącz, napisz; szukanie graczy ---
    const sideHead = el('div', 'lob-side-h');
    sideHead.append(el('h3', 'lob-h', tx('Znajomi', 'Friends')), button(tx('Wszyscy →', 'All →'), () => void showFriends(0), 'link-btn'));
    const sid = `lob-find-${seq}`;
    const sl = el('label', 'sr-only', tx('Znajdź gracza', 'Find a player')); sl.htmlFor = sid;
    const find = el('input'); find.id = sid; find.type = 'search'; find.placeholder = tx('Znajdź gracza po nicku…', 'Find a player by nickname…'); find.autocomplete = 'off';
    find.addEventListener('keydown', (e) => e.stopPropagation());
    const found = el('div', 'lob-found');
    const fl = el('div', 'lob-friends');
    side.append(sideHead, sl, find, found, fl);
    let friendsNow: Player[] = [];
    let outNow = new Set<string>();
    const person = (p: Player, acts: HTMLElement[]): HTMLElement => {
      const o = onlinePlayers().find((x) => x.id === p.id);
      const r = el('div', `lob-person${o ? (o.where === 'menu' ? ' on' : ' busy') : ''}`);
      const av = el('button', 'lob-av'); av.type = 'button'; av.setAttribute('aria-label', tx(`Profil: ${p.nick}`, `Profile: ${p.nick}`));
      av.append(shield(o?.avatar ?? p.avatar, 36), el('span', `mx-dot ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`));
      av.addEventListener('click', () => profileModal(p.id));
      const t = el('div', 'lob-person-t');
      t.append(el('strong', '', p.nick), el('span', '', whereText(p, o)));
      const a = el('div', 'lob-person-a'); a.append(...acts);
      r.append(av, t, a);
      return r;
    };
    const quickBtn = (label: string, done: string, run: () => Promise<string | null | void>, cls: string): HTMLButtonElement => {
      const b = button(label, () => { b.disabled = true; b.textContent = done; void run().then((e) => { if (e) { b.disabled = false; b.textContent = label; note.textContent = e; note.classList.add('bad'); } }); }, cls);
      return b;
    };
    const paintFriends = async (): Promise<void> => {
      const l = await friendLists();
      if (seq !== lobbySeq) return;
      friendsNow = l.friends; outNow = new Set(l.outgoing.map((p) => p.id));
      const on = onlinePlayers();
      const sorted = [...l.friends].sort((a, b) => Number(!!on.find((o) => o.id === b.id)) - Number(!!on.find((o) => o.id === a.id)) || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''));
      fl.replaceChildren();
      if (l.incoming.length) fl.append(button(tx(`Zaproszenia do znajomych: ${l.incoming.length}`, `Friend requests: ${l.incoming.length}`), () => void showFriends(3), 'lob-req'));
      if (!sorted.length) { fl.append(el('p', 'lob-hint', tx('Nie masz jeszcze znajomych — wpisz nick wyżej i dodaj kogoś.', 'No friends yet — type a nickname above and add someone.'))); return; }
      const nOn = sorted.filter((p) => on.some((o) => o.id === p.id)).length;
      fl.append(el('p', 'lob-sub', tx(`W grze: ${nOn} z ${sorted.length}`, `Online: ${nOn} of ${sorted.length}`)));
      for (const p of sorted) {
        const o = on.find((x) => x.id === p.id);
        const acts: HTMLElement[] = [];
        if (o?.where === 'room' && o.roomId) acts.push(button(tx('Dołącz', 'Join'), () => void join(o.roomId!), 'menu-btn btn-ok lob-mini'));
        else if (!o || o.where !== 'game') acts.push(quickBtn(tx('Zaproś', 'Invite'), tx('Zaproszono ✓', 'Invited ✓'), async () => {
          const r = await makeRoom('1v1'); if (!r) return tx('Nie udało się założyć pokoju.', 'Could not open a room.');
          const e = await inviteToGame(p.id, r.id, r.name); if (e) return e;
          enterRoom(r); return null;
        }, 'menu-btn btn-ok lob-mini'));
        const msgB = button('', () => openChat(p.id, p), 'lob-icon-btn'); msgB.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.6 3.1 6.1L5.5 21l4-2.1c.8.2 1.6.3 2.5.3 5 0 9-3.6 9-8.1S17 3 12 3z"/></svg>';
        msgB.setAttribute('aria-label', tx(`Napisz do ${p.nick}`, `Message ${p.nick}`)); msgB.title = tx('Napisz', 'Message');
        acts.push(msgB);
        fl.append(person(p, acts));
      }
    };
    let ft = 0;
    find.addEventListener('input', () => {
      clearTimeout(ft);
      ft = window.setTimeout(async () => {
        const q = find.value.trim();
        if (q.length < 2) { found.replaceChildren(); return; }
        const ps = await searchPlayers(q);
        if (find.value.trim() !== q) return;
        found.replaceChildren(...(ps.length ? ps.slice(0, 6).map((p) => {
          const friend = friendsNow.some((f) => f.id === p.id), sent = outNow.has(p.id);
          return person(p, friend ? [el('span', 'net-tag', tx('znajomy', 'friend'))] : sent ? [el('span', 'net-tag off', tx('wysłano', 'sent'))]
            : [quickBtn(tx('Dodaj', 'Add'), tx('Wysłano ✓', 'Sent ✓'), async () => { const e = await befriend(p.id); if (!e) outNow.add(p.id); return e; }, 'menu-btn btn-ok lob-mini')]);
        }) : [el('p', 'lob-hint', tx('Nikogo nie znaleziono.', 'Nobody found.'))]));
      }, 250);
    });
    wrap.append(main, side);
    screen(title, true, wrap, back());
    await restore();
    // wchodzę do listy, więc żaden mój pokój nie jest już aktywny
    await closeMyStaleRooms();
    if (seq !== lobbySeq) return;
    await draw();
    void paintFriends();
    if (seq !== lobbySeq) return;
    const offRooms = watchRooms(() => void draw());
    const offP = onPresence(() => void paintFriends());
    stopWatch = () => { offRooms(); offP(); };
  }

  // ---------------- znajomi ----------------
  /** Profil gracza w okienku nad rankingiem albo pokojem (bez wychodzenia z pokoju) */
  const profileModal = (id: string): void => openProfileModal(id, { el, button, shield }, (who) => openChat(who));
  async function showFriends(tab = 0, profile?: string, chat?: string): Promise<void> {
    cleanup();
    const m = me();
    if (!m) { showLogin(false, '', () => void showFriends(tab, profile, chat)); return; }
    const view = friendsView({
      el, button, shield,
      join: (id) => void join(id),
      // zaproszenie do gry: nowy pokój (1 na 1, do zmiany w pokoju) i zaproszenie do niego — na żywo i w dzwoneczku
      invite: async (p) => {
        const seed = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
        const name = tx(`Gra ${m.nick}`, `${m.nick}'s game`);
        const res = await createRoom(name, '1v1', seed);
        if (typeof res === 'string') return res;
        const err = await inviteToGame(p.id, res.id, res.name);
        if (err) return err;
        enterRoom(res);
        return null;
      },
    }, tab, profile, chat);
    screen(tx('Znajomi', 'Friends'), true, view.node, back());
    const offP = onPresence(() => view.redraw());
    stopWatch = () => { offP(); view.stop(); };
  }

  // zaproszenie od znajomego: okienko w rogu ekranu, w menu i w grze z botami (w meczu przez sieć nie przeszkadzamy)
  onInvite((i: Invite) => {
    if (inMatch()) return;
    document.querySelector('.invite-toast')?.remove();
    const t = el('div', 'invite-toast panel');
    t.setAttribute('role', 'alertdialog');
    t.setAttribute('aria-label', tx('Zaproszenie do gry', 'Game invitation'));
    const txt = el('div', 'invite-text');
    txt.append(el('strong', '', i.from.nick), tx(` zaprasza Cię do gry „${i.roomName}”`, ` invites you to the game “${i.roomName}”`));
    const yes = button(tx('Dołącz', 'Join'), () => { t.remove(); ui.openForJoin(i.roomId); }, 'menu-btn');
    const no = button(tx('Nie teraz', 'Not now'), () => t.remove(), 'link-btn');
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
    // po odpowiedzi z bazy rysujemy tylko, jeśli gracz dalej patrzy na ten ekran (napis „Wczytuję…” wciąż jest na stronie)
    const waiting = msg(tx('Wczytuję…', 'Loading…'));
    screen(tx('Ranking', 'Ranking'), true, waiting);
    const rows = await ranking();
    await levelsOf(rows.map((x) => x.user_id));
    if (!waiting.isConnected) return;
    const m = me();
    // Ranking, wersja 2 (Michał 3.11.2026: „ranking o wiele ładniejszy”): podium trzech najlepszych, Twoje miejsce
    // na wierzchu, pod spodem lista z paskiem skuteczności (procent wygranych)
    const rate = (x: { wins: number; games: number }): number => (x.games ? Math.round((x.wins / x.games) * 100) : 0);
    const wrap = el('div', 'rk');
    if (!rows.length) {
      const e = el('div', 'lob-empty');
      e.append(el('strong', '', tx('Ranking jest pusty', 'The ranking is empty')), el('span', '', tx('Zagraj pierwszy mecz przez sieć, a Twój herb stanie na podium.', 'Play the first online match and your arms will stand on the podium.')));
      wrap.append(e);
    } else {
      const podium = el('div', 'rk-podium');
      for (const i of [1, 0, 2]) {
        const x = rows[i];
        if (!x) continue;
        const c = el('button', `rk-step p${i + 1}${x.user_id === m?.id ? ' me' : ''}`); c.type = 'button';
        c.setAttribute('aria-label', tx(`Miejsce ${i + 1}: ${x.nick}, wygrane ${x.wins}. Otwórz profil`, `Place ${i + 1}: ${x.nick}, wins ${x.wins}. Open profile`));
        c.addEventListener('click', () => profileModal(x.user_id));
        const medal = el('span', 'rk-medal', String(i + 1));
        const tc = titleChip(x.user_id);
        c.append(medal, shield(x.avatar, i === 0 ? 76 : 60), el('strong', 'rk-nick', x.nick));
        if (tc) c.append(tc);
        c.append(el('span', 'rk-score', tx(`${x.wins} wygranych · ${rate(x)}%`, `${x.wins} wins · ${rate(x)}%`)));
        const base = el('span', 'rk-base', i === 0 ? tx('Mistrz', 'Champion') : i === 1 ? tx('Drugie', 'Second') : tx('Trzecie', 'Third'));
        c.append(base);
        podium.append(c);
      }
      wrap.append(podium);
      const myIdx = m ? rows.findIndex((x) => x.user_id === m.id) : -1;
      const mine = el('div', 'rk-me');
      if (myIdx >= 0) {
        const x = rows[myIdx]!;
        mine.append(el('span', 'rk-me-pos', `#${myIdx + 1}`), el('span', 'rk-me-t', tx(`Twoje miejsce · ${x.wins} wygranych, ${x.losses} porażek, skuteczność ${rate(x)}%`, `Your place · ${x.wins} wins, ${x.losses} losses, ${rate(x)}% win rate`)));
      } else mine.append(el('span', 'rk-me-t', m ? tx('Nie ma Cię jeszcze w rankingu — wygraj mecz przez sieć.', 'You are not ranked yet — win an online match.') : tx('Zaloguj się i zagraj przez sieć, żeby trafić do rankingu.', 'Sign in and play online to get ranked.')));
      wrap.append(mine);
      const table = el('table', 'rk-table');
      const thead = el('thead');
      const hr = el('tr');
      for (const [h, c] of [['#', 'pos'], [tx('Gracz', 'Player'), ''], [tx('Wygrane', 'Wins'), 'num'], [tx('Porażki', 'Losses'), 'num'], [tx('Mecze', 'Matches'), 'num'], [tx('Skuteczność', 'Win rate'), 'rate']] as const) hr.append(el('th', c, h));
      thead.append(hr);
      const tbody = el('tbody');
      rows.forEach((x, i) => {
        const tr = el('tr', `${x.user_id === m?.id ? 'me' : ''}${i < 3 ? ' top' : ''}`);
        const who = el('td', 'who');
        const nb = button(x.nick, () => profileModal(x.user_id), 'fr-name fr-name-sm');
        nb.title = tx(`Profil: ${x.nick}`, `Profile: ${x.nick}`);
        who.append(shield(x.avatar, 28), nb);
        const tc = titleChip(x.user_id); if (tc) who.append(tc);
        const rt = el('td', 'rate');
        const bar = el('span', 'rk-bar'); const fill = el('span', 'rk-fill'); fill.style.width = `${rate(x)}%`; bar.append(fill);
        rt.append(bar, el('span', 'rk-pct', `${rate(x)}%`));
        tr.append(el('td', `pos p${i + 1}`, String(i + 1)), who, el('td', 'num win', String(x.wins)), el('td', 'num', String(x.losses)), el('td', 'num', String(x.games)), rt);
        tbody.append(tr);
      });
      table.append(thead, tbody);
      const tw = el('div', 'rk-tablewrap'); tw.append(table);
      wrap.append(tw);
    }
    screen(tx('Ranking', 'Ranking'), true, wrap, back(() => void showOnline(), tx('Wróć do listy gier', 'Back to game list')));
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
    /** Kooperacja: ludzie siadają tylko w drużynie 1, drużyna 2 to wzmocnione boty */
    let coop = false;
    let slots: Slot[] = [];
    let started = false;
    /** Mapa meczu: losuje ją tylko gospodarz, goście widzą ten sam podgląd */
    let seed = room.seed;
    let shown = '';
    const showMap = (): void => { const key = `${seed}|${preset}`; if (key === shown) return; shown = key; ui.preview(seed, preset); };
    /** Miejsce dla człowieka? W kooperacji tylko drużyna 1 (parzyste miejsca) */
    const humanSeat = (i: number): boolean => !coop || i % 2 === 0;
    const fresh = (n: number, keep: Slot[] = []): Slot[] => {
      const out: Slot[] = Array.from({ length: n }, (_, i) => keep[i] ?? { kind: 'open' });
      // ludzie z obciętych miejsc (albo z drużyny botów w kooperacji) przesiadają się na wolne
      const moved: Slot[] = [...keep.slice(n).filter((s) => s.kind === 'human')];
      out.forEach((s, i) => { if (s.kind === 'human' && !humanSeat(i)) { moved.push(s); out[i] = { kind: 'bot' }; } });
      for (const s of moved) { const k = out.findIndex((x, i) => x.kind !== 'human' && humanSeat(i)); if (k >= 0) out[k] = s; }
      // w kooperacji drużyna 2 to zawsze boty
      if (coop) out.forEach((_s, i) => { if (!humanSeat(i)) out[i] = { kind: 'bot' }; });
      return out;
    };
    slots = fresh(seats(preset));
    if (host) slots[0] = { kind: 'human', ...self };

    // Pokój, wersja 2 (Michał 3.11.2026: „to mega popraw”, „zaproś znajomego i wygląd”): po lewej nagłówek, ustawienia
    // jako przełączniki i dwie drużyny; po prawej zapraszanie znajomych (jednym klikiem) i czat pokoju
    const box = el('div', 'rm');
    const mainCol = el('div', 'rm-main');
    const side = el('aside', 'rm-side');
    const head = el('div', 'rm-head');
    const settings = el('div', 'rm-set');
    const teams = el('div', 'rm-teams');
    const note = msg(host ? tx('Czekasz na graczy. Wolne miejsca możesz obsadzić botami albo zostawić — przy starcie zajmą je boty.', 'Waiting for players. Fill empty seats with bots or leave them — bots will take them when the match starts.') : tx('Wybierz wolne miejsce. Mecz rozpocznie gospodarz.', 'Pick an empty seat. The host will start the match.'));
    const foot = el('div', 'menu-foot');
    const start = button(tx('Rozpocznij mecz', 'Start match'), () => doStart(), 'menu-btn btn-ok rm-start');
    start.hidden = !host;
    const leave = button(tx('Wyjdź z pokoju', 'Leave room'), () => { cleanup(); void showOnline(); }, 'menu-btn menu-back btn-danger');
    foot.classList.add('rm-foot');
    foot.append(leave, start);
    // czat pokoju
    const chatBox = el('div', 'room-chat rm-chat');
    const chatLog = el('div', 'room-chat-log');
    chatLog.setAttribute('role', 'log');
    chatLog.setAttribute('aria-live', 'polite');
    const chatForm = el('form', 'room-chat-form');
    const chatIn = el('input'); chatIn.maxLength = 200; chatIn.placeholder = tx('Napisz do pokoju…', 'Message the room…'); chatIn.setAttribute('aria-label', tx('Wiadomość czatu', 'Chat message')); chatIn.autocomplete = 'off';
    const chatSend = el('button', 'menu-btn', tx('Wyślij', 'Send')); chatSend.type = 'submit';
    chatForm.append(chatIn, chatSend);
    chatLog.append(el('p', 'rm-chat-empty', tx('Tu pojawią się wiadomości graczy w pokoju.', 'Messages from players in the room will appear here.')));
    chatBox.append(el('h3', 'rm-h', tx('Czat pokoju', 'Room chat')), chatLog, chatForm);
    const addChat = (who: Member, text: string): void => {
      chatLog.querySelector('.rm-chat-empty')?.remove();
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
    const LINK_T = tx('Kopiuj link do pokoju', 'Copy room link');
    const invite = button(LINK_T, async () => {
      const url = `${location.origin}${location.pathname}?pokoj=${room.id}`;
      try { await navigator.clipboard.writeText(url); invite.textContent = tx('Skopiowano — wyślij znajomemu', 'Copied — send it to a friend'); }
      catch { prompt(tx('Skopiuj link zaproszenia:', 'Copy the invite link:'), url); }
      setTimeout(() => { invite.textContent = LINK_T; }, 2500);
    }, 'menu-btn rm-link');
    // zaproszenia dla znajomych: w grze na górze; zaproszenie trafia też do dzwoneczka, więc można zaprosić i nieobecnych
    const invited = new Set<string>();
    const friendBox = el('div', 'rm-friends');
    const inviteBox = el('section', 'rm-card rm-invite');
    const ih = el('div', 'rm-card-h');
    ih.append(el('h3', 'rm-h', tx('Zaproś znajomych', 'Invite friends')), button(tx('Znajomi →', 'Friends →'), () => void showFriends(0), 'link-btn'));
    inviteBox.append(ih, friendBox, invite);
    const paintFriends = async (): Promise<void> => {
      const { friends } = await friendLists();
      const on = onlinePlayers();
      const here = new Set(slots.filter((x) => x.kind === 'human').map((x) => (x as { id: string }).id));
      const avail = friends.filter((f) => !here.has(f.id)).sort((a, b) => Number(!!on.find((o) => o.id === b.id)) - Number(!!on.find((o) => o.id === a.id)) || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''));
      friendBox.replaceChildren();
      if (!avail.length) {
        friendBox.append(el('p', 'rm-empty', friends.length ? tx('Wszyscy Twoi znajomi są już w tym pokoju.', 'All your friends are already in this room.') : tx('Nie masz jeszcze znajomych — dodaj ich w „Znajomych” albo wyślij link do pokoju.', 'No friends yet — add some in “Friends” or send the room link.')));
        return;
      }
      for (const f of avail.slice(0, 8)) {
        const o = on.find((x) => x.id === f.id);
        const r = el('div', `rm-person${o ? '' : ' off'}`);
        const av = el('button', 'lob-av'); av.type = 'button'; av.setAttribute('aria-label', tx(`Profil: ${f.nick}`, `Profile: ${f.nick}`));
        av.append(shield(o?.avatar ?? f.avatar, 34), el('span', `mx-dot ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`));
        av.addEventListener('click', () => profileModal(f.id));
        const t = el('div', 'lob-person-t');
        t.append(el('strong', '', f.nick), el('span', '', whereText(f, o)));
        const done = invited.has(f.id);
        const b = button(done ? tx('Zaproszono ✓', 'Invited ✓') : tx('Zaproś', 'Invite'), async () => {
          b.disabled = true; b.textContent = tx('Zaproszono ✓', 'Invited ✓');
          const err = await inviteToGame(f.id, room.id, room.name);
          if (err) { b.disabled = false; b.textContent = tx('Zaproś', 'Invite'); note.textContent = err; note.classList.add('bad'); return; }
          invited.add(f.id);
        }, `menu-btn lob-mini ${done ? '' : 'btn-ok'}`);
        b.disabled = done;
        r.append(av, t, b);
        friendBox.append(r);
      }
      if (avail.length > 8) friendBox.append(el('p', 'rm-empty', tx(`…i jeszcze ${avail.length - 8} w „Znajomych”`, `…and ${avail.length - 8} more in “Friends”`)));
    };
    void paintFriends();
    const offPresence = onPresence(() => void paintFriends());
    setStatus({ where: 'room', roomId: room.id, roomName: room.name });
    mainCol.append(head, settings, teams, note);
    side.append(inviteBox, chatBox);
    box.append(mainCol, side);

    const publish = (): void => {
      if (!host) return;
      link.send({ k: 'lobby', preset, level, slots, seed, coop });
      const humans = slots.filter((s) => s.kind === 'human') as Extract<Slot, { kind: 'human' }>[];
      const guests = humans.filter((s) => s.id !== m.id).map((s) => s.nick);
      void updateRoom(room.id, { preset, seed, guest_nick: `${humans.length}/${slots.length}${guests.length ? ` · ${guests.join(', ')}` : ''}` });
    };
    /** Przełącznik z kilku opcji (gospodarz) — jak „Tryb” w lobby */
    let humansKey = '';
    const seg = (label: string, opts: [string, string][], value: string, change: (v: string) => void): HTMLElement => {
      const g = el('div', 'rm-field');
      const gid = `rm-${Math.random().toString(36).slice(2, 7)}`;
      const l = el('span', 'rm-label', label); l.id = gid;
      const row = el('div', 'rm-seg'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-labelledby', gid);
      for (const [v, text] of opts) {
        const b = button(text, () => change(v), 'lob-chip rm-chip');
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === value));
        row.append(b);
      }
      g.append(l, row);
      return g;
    };
    const paint = (): void => {
      head.replaceChildren();
      const humansIn = slots.filter((s) => s.kind === 'human').length;
      const free = slots.filter((s, i) => s.kind === 'open' && humanSeat(i)).length;
      const badge = el('span', 'rm-mode', modeName(preset));
      const title = el('div', 'rm-title');
      const sub = el('div', 'rm-sub');
      sub.append(el('span', '', `${tx('Mapa', 'Map')}: ${seed}`));
      // gospodarz losuje mapę; wszyscy w pokoju widzą ją za panelem
      if (host) sub.append(button(tx('↻ Losuj inną mapę', '↻ Roll another map'), () => {
        seed = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
        paint(); publish(); showMap();
      }, 'link-btn rm-reroll'));
      title.append(el('strong', '', room.name), sub);
      const stat = el('div', `rm-status${free ? '' : ' full'}`);
      stat.append(el('strong', '', `${humansIn}/${slots.length}`), el('span', '', free ? tx(`wolne: ${free}`, `free: ${free}`) : tx('komplet', 'full')));
      head.append(badge, title, stat);
      settings.replaceChildren();
      if (host) {
        settings.append(
          seg(tx('Tryb', 'Mode'), MODES.map(([id, l]) => [id, l]), preset, (v) => { preset = v as MapPresetId; slots = fresh(seats(preset), slots); paint(); publish(); showMap(); }),
          seg(tx('Rodzaj gry', 'Game type'), [['0', tx('Rywalizacja', 'Versus')], ['1', tx('Razem przeciw botom', 'Co-op vs bots')]], coop ? '1' : '0', (v) => { coop = v === '1'; slots = fresh(seats(preset), slots); paint(); publish(); }),
          seg(tx('Boty', 'Bots'), LEVELS.map((n, i) => [String(i), n]), String(level), (v) => { level = Number(v); paint(); publish(); }),
        );
      } else {
        for (const [k, v] of [[tx('Tryb', 'Mode'), modeName(preset)], [tx('Rodzaj gry', 'Game type'), coop ? tx('Razem przeciw botom', 'Co-op vs bots') : tx('Rywalizacja', 'Versus')], [tx('Boty', 'Bots'), LEVELS[level] ?? '']] as const) {
          const g = el('div', 'rm-field'); g.append(el('span', 'rm-label', k), el('span', 'rm-val', v)); settings.append(g);
        }
      }
      teams.replaceChildren();
      for (const team of [0, 1]) {
        const col = el('section', 'rm-team');
        col.style.setProperty('--team', hex(TEAM_COLORS[team] ?? 0x888888));
        const mine = slots.filter((_s, i) => i % 2 === team);
        const th = el('div', 'rm-team-h');
        th.append(el('span', 'rm-team-flag'), el('h3', '', coop ? (team === 0 ? tx('Drużyna graczy', 'Players') : tx('Wzmocnione boty', 'Reinforced bots')) : `${tx('Drużyna', 'Team')} ${team + 1}`),
          el('span', 'rm-team-n', `${mine.filter((x) => x.kind !== 'open').length}/${mine.length}`));
        col.append(th);
        slots.forEach((s, i) => {
          if (i % 2 !== team) return;
          const row = el('div', `rm-slot ${s.kind}${s.kind === 'human' && s.id === m.id ? ' me' : ''}`);
          const who = el('div', 'rm-who');
          if (s.kind === 'human') {
            const nb = button(s.nick, () => profileModal(s.id), 'fr-name rm-nick');
            nb.title = tx(`Profil: ${s.nick}`, `Profile: ${s.nick}`);
            const tags = el('div', 'rm-tags');
            if (s.id === room.host) tags.append(el('span', 'rm-tag host', tx('gospodarz', 'host')));
            if (s.id === m.id) tags.append(el('span', 'rm-tag you', tx('Ty', 'you')));
            const tc = titleChip(s.id);
            if (tc) tags.append(tc);
            else void levelsOf([s.id]).then((got) => { if (got.has(s.id)) paint(); }); // poziom dociągnięty z bazy: odśwież raz
            who.append(nb, tags);
            row.append(shield(s.avatar, 38), who);
          } else if (s.kind === 'bot') {
            who.append(el('strong', 'rm-botname', tx('Bot', 'Bot')), el('span', 'rm-botlv', coop && !humanSeat(i) ? `${LEVELS[level]} · ${tx('wzmocniony', 'reinforced')}` : LEVELS[level] ?? ''));
            row.append(el('span', 'rm-ico bot', '⚙'), who);
          } else {
            who.append(el('strong', '', tx('Wolne miejsce', 'Empty seat')), el('span', 'rm-botlv', host ? tx('przy starcie zajmie je bot', 'a bot takes it at the start') : tx('możesz tu usiąść', 'you can sit here')));
            row.append(el('span', 'rm-ico open', '+'), who);
          }
          const act = el('div', 'rm-act');
          if (s.kind === 'open' && humanSeat(i)) {
            act.append(button(tx('Usiądź', 'Sit here'), () => { if (host) { seat(m.id, i); } else link.send({ k: 'seat', id: m.id, slot: i }); }, 'menu-btn lob-mini'));
          }
          if (host && s.kind === 'open') act.append(button(tx('+ Bot', '+ Bot'), () => { slots[i] = { kind: 'bot' }; paint(); publish(); }, 'menu-btn lob-mini'));
          if (host && s.kind === 'bot' && humanSeat(i)) act.append(button(tx('Usuń bota', 'Remove bot'), () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'menu-btn lob-mini btn-danger'));
          if (host && s.kind === 'human' && s.id !== m.id) act.append(button(tx('Wyrzuć', 'Kick'), () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'menu-btn lob-mini btn-danger'));
          row.append(act);
          col.append(row);
        });
        teams.append(col);
      }
      // lista do zapraszania odświeża się, gdy ktoś wejdzie albo wyjdzie z pokoju
      const hk = slots.map((x) => (x.kind === 'human' ? x.id : '')).join(',');
      if (hk !== humansKey) { humansKey = hk; void paintFriends(); }
      start.disabled = !slots.some((s) => s.kind === 'human');
    };
    /** Gospodarz przesadza gracza na wolne miejsce */
    const seat = (id: string, i: number): void => {
      if (slots[i]?.kind !== 'open' || !humanSeat(i)) return;
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
        const k = slots.findIndex((s, i) => s.kind === 'open' && humanSeat(i));
        if (k >= 0) { slots[k] = { kind: 'human', ...x }; touched = true; }
      }
      if (touched) paint();
      publish();
    };
    let hostSeen = host;
    const off = link.on((msgIn: NetMsg) => {
      if (msgIn.k === 'lobby' && !host && Array.isArray(msgIn.slots) && (msgIn.preset as string) in MAP_PRESETS) { preset = msgIn.preset as MapPresetId; level = msgIn.level; slots = msgIn.slots; coop = msgIn.coop === true; if (typeof msgIn.seed === 'string' && msgIn.seed) seed = msgIn.seed.slice(0, 40); hostSeen = true; paint(); showMap(); }
      if (msgIn.k === 'hello' && host) sync();
      if (msgIn.k === 'seat' && host) seat(msgIn.id, msgIn.slot);
      if (msgIn.k === 'chat' && msgIn.who && typeof msgIn.text === 'string') addChat(msgIn.who, cleanChat(msgIn.text));
      if (msgIn.k === 'close' && !host) { cleanup(); void showOnline(); }
      if (msgIn.k === 'start' && !host && Array.isArray(msgIn.slots) && (msgIn.preset as string) in MAP_PRESETS) go(msgIn.preset as MapPresetId, msgIn.level, msgIn.seed, msgIn.slots, msgIn.coop === true);
    });
    const offMembers = link.onMembers(() => {
      if (host) { sync(); return; }
      // gospodarz zniknął z pokoju
      if (hostSeen && !link.members().some((x) => x.id === room.host)) { note.textContent = tx('Gospodarz wyszedł z pokoju.', 'The host has left the room.'); note.classList.add('bad'); }
    });
    const go = (p: MapPresetId, lv: number, seed: string, final: Slot[], co: boolean): void => {
      const meIdx = final.findIndex((s) => s.kind === 'human' && s.id === m.id);
      if (meIdx < 0) { note.textContent = tx('Mecz ruszył bez Ciebie — nie było wolnego miejsca.', 'The match started without you — there was no free seat.'); note.classList.add('bad'); return; }
      started = true;
      const humans = final.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
      off(); offMembers(); offPresence(); leaveRoom = null;
      setStatus({ where: 'game' });
      const net = new Lockstep(link, meIdx, humans);
      ui.onStart({ room, seed, preset: p, level: lv, slots: final, me: meIdx, humans, coop: co, link, net });
    };
    const doStart = (): void => {
      const final: Slot[] = slots.map((s) => (s.kind === 'open' ? { kind: 'bot' } : s));
      link.send({ k: 'start', preset, level, seed, slots: final, coop });
      void updateRoom(room.id, { status: 'playing' });
      go(preset, level, seed, final, coop);
    };
    leaveRoom = () => {
      off(); offMembers(); offPresence();
      ui.previewEnd();
      setStatus({ where: 'menu' });
      if (host) { link.send({ k: 'close' }); void deleteRoom(room.id); }
      link.close();
    };
    void link.ready.then(() => { if (!host) link.send({ k: 'hello', who: self }); else sync(); });
    // gość: gdy gospodarz nie odpowiada, pokój jest porzucony (zamknięta karta) — nie czekamy w nieskończoność
    if (!host) setTimeout(() => {
      if (hostSeen || started) return;
      note.textContent = tx('Gospodarz nie odpowiada — ten pokój jest porzucony. Wróć do listy gier.', 'The host is not responding — this room has been abandoned. Go back to the game list.');
      note.classList.add('bad');
    }, 6000);
    paint();
    // układ zależy od szerokości panelu (obok podglądu mapy bywa wąski), nie od okna — stąd osobna ramka z @container
    const outer = el('div', 'rm-wrap'); outer.append(box);
    screen(tx('Pokój', 'Room'), true, outer, foot);
    showMap();
  }

  /** Twarde wyjście (np. zamknięcie strony): zamyka pokój, jeśli w nim jesteśmy */
  const leave = (): void => cleanup();
  /** Wejście z linku zaproszenia (?pokoj=…): logowanie, jeśli trzeba, potem prosto do pokoju */
  async function join(id: string): Promise<void> {
    cleanup();
    const waiting = msg(tx('Łączenie z pokojem…', 'Connecting to the room…'));
    screen(tx('Zaproszenie', 'Invitation'), true, waiting);
    await restore();
    // gracz w międzyczasie wyszedł z tego ekranu (np. zaczął grę solo) — nie wchodzimy do pokoju za jego plecami
    if (!waiting.isConnected) return;
    if (!me()) { showLogin(false, tx('Zaloguj się, żeby dołączyć do gry znajomego.', "Sign in to join your friend's game."), () => void join(id)); return; }
    const room = await getRoom(id);
    if (!waiting.isConnected) return;
    if (typeof room === 'string' || room.status !== 'open') {
      screen(tx('Zaproszenie', 'Invitation'), true, msg(typeof room === 'string' ? tx('Tej gry już nie ma — gospodarz ją zamknął.', 'This game is gone — the host closed it.') : tx('Ten mecz już się zaczął.', 'This match has already started.'), true), back(() => void showOnline(), tx('Przejdź do listy gier', 'Go to game list')));
      return;
    }
    enterRoom(room);
  }

  return { showOnline: () => void showOnline(), showAccount, showHouse: (tab = 0, note?: number) => showHouse(tab, note), showFriends: (tab = 0, profile?: string, chat?: string) => void showFriends(tab, profile, chat), showLogin: (register = false) => showLogin(register), join: (id) => void join(id), leave };
}

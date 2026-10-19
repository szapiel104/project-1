import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { TEAM_COLORS } from '../data/teams';
import { Lockstep } from '../net/lockstep';
import {
  addFriend, closeMyStaleRooms, createRoom, listFriends, onInvite, onlinePlayers, onPresence, removeFriend, sendInvite, setStatus, deleteRoom, getRoom, listRooms, myAwards, myRecord, myResults, ranking, me, progress, levelsOf, knownLevel, restore, roomLink, setAvatar, setNick, setPassword, signIn, signOut, signUp, updateRoom, watchRooms,
  type Invite, type Member, type NetMsg, type OnlinePlayer, type Room, type RoomLink, type Slot,
} from '../net/supa';
import { avatarSvg, CHARGE_NAMES, CREST_CHARGES, crestPreview, decodeCrest, DIVISIONS, encodeCrest, TINCTURES, type Crest } from './avatars';
import { BADGES, levelOf, nextTitle, TITLES, titleOf, titleRank, xpUntil, type BadgeDef } from '../data/progress';
import { chatLine, cleanChat } from './chat';
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

export function createOnline(ui: Ui): { showOnline(): void; showAccount(): void; showHouse(tab?: number): void; showLogin(register?: boolean): void; join(id: string): void; leave(): void } {
  const { el, button, screen } = ui;
  const inMatch = (): boolean => ui.inMatch();
  let stopWatch: (() => void) | null = null;
  /** Wyjście z pokoju przy przejściu na inny ekran */
  let leaveRoom: (() => void) | null = null;
  const cleanup = (): void => { stopWatch?.(); stopWatch = null; leaveRoom?.(); leaveRoom = null; };

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
    form.append(we, wp, wn, note, go, swap);
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

  // ---------------- „Mój ród”: pan na zamku — wizytówka, cel, przegląd, kronika meczów i herb ----------------
  /** Małe ikony odznak (rysowane, bez emoji) */
  const BADGE_ICONS: Record<BadgeDef['icon'], string> = {
    sword: '<path d="M16 3l3 3-9 9-2 0 0-2z M7 14l3 3 M5 16l3 3-2 2-3-3z"/>',
    swords: '<path d="M4 3l11 11 M14 14l2 4 4-4-4-2 M20 3L9 14 M10 14l-2 4-4-4 4-2"/>',
    banner: '<path d="M6 21V3 M6 4h12l-3 4 3 4H6"/>',
    tower: '<path d="M6 21V8h12v13z M6 8V4h2v2h2V4h4v2h2V4h2v4 M10 21v-5h4v5"/>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6v2h10v-2c0-2 2-3 2-6a7 7 0 0 0-7-7z M9 11h.01 M15 11h.01 M10 18v3 M14 18v3"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  };
  const icon = (k: BadgeDef['icon']): string => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BADGE_ICONS[k]}</svg>`;
  const modeLabel = (mode: string): string => mode === 'online' ? tx('Przez sieć', 'Online') : mode === 'coop' ? tx('Razem przeciw botom', 'Co-op vs bots') : mode.startsWith('bots') ? `${tx('Z botami', 'Vs bots')} · ${LEVELS[Number(mode.slice(4))] ?? ''}` : mode;
  const when = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  function showHouse(tab = 0): void {
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
    const paintHero = (): void => { heroCrest.innerHTML = crestPreview(crest, 92); };
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
        txt.append(el('strong', '', name), el('span', '', ok ? tx('zdobyta', 'earned') : `${desc} · ${have}/${b.goal}`));
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
    tabBtns[Math.max(0, Math.min(TABS.length - 1, tab))]?.focus();
  }

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
  }

  // ---------------- lista gier ----------------
  let filter: MapPresetId | 'all' = 'all';
  async function showOnline(): Promise<void> {
    cleanup();
    screen(tx('Gra przez sieć', 'Online play'), true, msg(tx('Łączenie…', 'Connecting…')));
    await restore();
    const m = me();
    if (!m) { showLogin(false, tx('Zaloguj się, żeby grać przez sieć.', 'Sign in to play online.'), () => void showOnline()); return; }
    // wchodzę do listy, więc żaden mój pokój nie jest już aktywny
    await closeMyStaleRooms();
    const wrap = el('div', 'net-lobby');
    // pasek: kim jestem
    const bar = el('div', 'net-bar');
    const tabs = el('div', 'net-filters');
    tabs.setAttribute('role', 'tablist');
    const list = el('div', 'net-list');
    for (const [id, name] of [['all', tx('Wszystkie', 'All')], ...MODES] as [MapPresetId | 'all', string][]) {
      const b = button(name, () => { filter = id; tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); void draw(); }, 'net-filter');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(filter === id));
      tabs.append(b);
    }
    const friendsBtn = button(tx('Znajomi', 'Friends'), () => void showFriends(), 'net-filter net-rank-btn');
    const paintFriendsBtn = async (): Promise<void> => {
      const { mine } = await listFriends();
      const on = onlinePlayers();
      const n = mine.filter((f) => on.some((o) => o.id === f.id)).length;
      friendsBtn.textContent = n ? tx(`Znajomi · ${n} w grze`, `Friends · ${n} online`) : tx('Znajomi', 'Friends');
    };
    void paintFriendsBtn();
    tabs.append(friendsBtn, button(tx('Ranking', 'Ranking'), () => void showRanking(), 'net-filter'));
    bar.append(tabs);
    // zakładanie gry
    const create = el('form', 'net-create');
    const name = el('input'); name.placeholder = tx('Nazwa gry', 'Game name'); name.maxLength = 40; name.value = tx(`Gra ${m.nick}`, `${m.nick}'s game`); name.setAttribute('aria-label', tx('Nazwa gry', 'Game name'));
    const mode = el('select'); mode.setAttribute('aria-label', tx('Tryb', 'Mode'));
    for (const [id, label] of MODES) { const o = el('option', '', label); o.value = id; mode.append(o); }
    if (filter !== 'all') mode.value = filter;
    const mk = el('button', 'menu-btn', tx('Załóż grę', 'Create game')); mk.type = 'submit';
    create.append(name, mode, mk);
    create.addEventListener('submit', async (e) => {
      e.preventDefault(); mk.disabled = true;
      const seed = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
      const res = await createRoom(name.value.trim() || tx(`Gra ${m.nick}`, `${m.nick}'s game`), mode.value, seed);
      mk.disabled = false;
      if (typeof res === 'string') { list.prepend(msg(res, true)); return; }
      enterRoom(res);
    });
    const draw = async (): Promise<void> => {
      const rooms = (await listRooms()).filter((r) => filter === 'all' || r.preset === filter);
      if (!rooms.length) {
        const empty = el('div', 'net-empty');
        empty.append(el('strong', '', filter === 'all' ? tx('Nie ma jeszcze żadnych gier', 'No games yet') : tx(`Nie ma gier ${modeName(filter)}`, `No ${modeName(filter)} games`)),
          el('span', '', tx('Załóż swoją — inni zobaczą ją tu od razu. Wolne miejsca możesz obsadzić botami i grać sam.', 'Create your own — others will see it here straight away. You can fill empty seats with bots and play alone.')));
        list.replaceChildren(empty);
        return;
      }
      list.replaceChildren(...rooms.map((r) => {
        const row = el('div', 'net-room');
        const info = el('div', 'net-room-info');
        const playing = r.status === 'playing';
        info.append(el('strong', '', r.name), el('span', '', `${modeName(r.preset)} · ${tx('gospodarz', 'host')} ${r.host_nick}${r.guest_nick ? ` · ${r.guest_nick}` : ''}`));
        const tag = el('span', playing ? 'net-tag busy' : 'net-tag', playing ? tx('trwa mecz', 'in progress') : tx('czeka', 'waiting'));
        row.append(el('span', 'net-mode', modeName(r.preset)), info, tag);
        if (!playing) row.append(button(r.host === m.id ? tx('Wróć do pokoju', 'Back to room') : tx('Dołącz', 'Join'), () => enterRoom(r), 'menu-btn net-join'));
        return row;
      }));
    };
    wrap.append(bar, create, list);
    screen(tx('Gra przez sieć', 'Online play'), true, wrap, back());
    await draw();
    stopWatch = watchRooms(() => void draw());
  }

  // ---------------- znajomi ----------------
  const where = (o: OnlinePlayer | undefined): string => {
    if (!o) return tx('poza grą', 'offline');
    if (o.where === 'room') return tx(`w pokoju „${o.roomName ?? ''}”`, `in room “${o.roomName ?? ''}”`);
    if (o.where === 'game') return tx('w meczu przez sieć', 'in an online match');
    if (o.where === 'solo') return tx('gra z botami', 'playing against bots');
    return tx('w menu', 'in the menu');
  };
  async function showFriends(): Promise<void> {
    cleanup();
    const m = me();
    if (!m) { showLogin(false, '', () => void showFriends()); return; }
    const wrap = el('div', 'net-friends');
    const add = el('form', 'net-create');
    const nick = el('input'); nick.placeholder = tx('Nick znajomego', "Friend's nickname"); nick.maxLength = 20; nick.setAttribute('aria-label', tx('Nick znajomego', "Friend's nickname")); nick.autocomplete = 'off';
    const addBtn = el('button', 'menu-btn', tx('Dodaj', 'Add')); addBtn.type = 'submit';
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
        r.append(shield(o?.avatar ?? 0, 30), info, el('span', o ? 'net-tag' : 'net-tag off', o ? tx('w grze', 'online') : 'offline'));
        if (o?.where === 'room' && o.roomId) r.append(button(tx('Dołącz', 'Join'), () => void join(o.roomId!), 'menu-btn net-join'));
        if (mineList) r.append(button(tx('Usuń', 'Remove'), async () => { await removeFriend(p.id); void draw(); }, 'link-btn'));
        else r.append(button(tx('Dodaj też', 'Add back'), async () => { await addFriend(p.nick); void draw(); }, 'menu-btn net-join'));
        return r;
      };
      const out: Node[] = [];
      out.push(el('p', 'net-label', tx(`Twoi znajomi (${mine.length})`, `Your friends (${mine.length})`)));
      if (mine.length) out.push(...mine.map((p) => row(p, true)));
      else out.push(msg(tx('Nikogo jeszcze nie dodałeś. Wpisz nick znajomego powyżej.', "You haven't added anyone yet. Type a friend's nickname above.")));
      if (addedMe.length) { out.push(el('p', 'net-label', tx('Dodali Cię do znajomych', 'Added you as a friend'))); out.push(...addedMe.map((p) => row(p, false))); }
      list.replaceChildren(...out);
    };
    add.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nick.value.trim()) return;
      addBtn.disabled = true;
      const err = await addFriend(nick.value);
      addBtn.disabled = false;
      note.textContent = err ?? tx(`Dodano: ${nick.value.trim()}.`, `Added: ${nick.value.trim()}.`); note.classList.toggle('bad', !!err);
      if (!err) nick.value = '';
      void draw();
    });
    wrap.append(add, note, list);
    screen(tx('Znajomi', 'Friends'), true, wrap, back(() => void showOnline(), tx('Wróć do listy gier', 'Back to game list')));
    await draw();
    stopWatch = onPresence(() => void draw());
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
    screen(tx('Ranking', 'Ranking'), true, msg(tx('Wczytuję…', 'Loading…')));
    const rows = await ranking();
    await levelsOf(rows.map((x) => x.user_id));
    const m = me();
    const table = el('table', 'net-ranking');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['#', tx('Gracz', 'Player'), tx('Wygrane', 'Wins'), tx('Porażki', 'Losses'), tx('Mecze', 'Matches')]) hr.append(el('th', '', h));
    thead.append(hr);
    const tbody = el('tbody');
    rows.forEach((x, i) => {
      const tr = el('tr', x.user_id === m?.id ? 'me' : '');
      const who = el('td', 'who');
      who.append(shield(x.avatar, 22), el('span', '', x.nick));
      const tc = titleChip(x.user_id); if (tc) who.append(tc);
      tr.append(el('td', 'pos', String(i + 1)), who, el('td', '', String(x.wins)), el('td', '', String(x.losses)), el('td', '', String(x.games)));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    const body = rows.length ? table : msg(tx('Ranking jest pusty — zagraj pierwszy mecz przez sieć.', 'The ranking is empty — play the first online match.'));
    const wrap = el('div', 'net-rankwrap');
    wrap.append(body);
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

    const box = el('div', 'net-roombox');
    const head = el('div', 'net-roomhead');
    const teams = el('div', 'net-teams');
    const note = msg(host ? tx('Czekasz na graczy. Wolne miejsca możesz obsadzić botami albo zostawić — przy starcie zajmą je boty.', 'Waiting for players. Fill empty seats with bots or leave them — bots will take them when the match starts.') : tx('Wybierz wolne miejsce. Mecz rozpocznie gospodarz.', 'Pick an empty seat. The host will start the match.'));
    const foot = el('div', 'menu-foot');
    const start = button(tx('Rozpocznij mecz', 'Start match'), () => doStart(), 'menu-btn');
    start.hidden = !host;
    const leave = button(tx('Wyjdź z pokoju', 'Leave room'), () => { cleanup(); void showOnline(); }, 'menu-btn menu-back');
    foot.append(leave, start);
    // czat pokoju
    const chatBox = el('div', 'room-chat');
    const chatLog = el('div', 'room-chat-log');
    chatLog.setAttribute('role', 'log');
    chatLog.setAttribute('aria-live', 'polite');
    const chatForm = el('form', 'room-chat-form');
    const chatIn = el('input'); chatIn.maxLength = 200; chatIn.placeholder = tx('Napisz do pokoju…', 'Message the room…'); chatIn.setAttribute('aria-label', tx('Wiadomość czatu', 'Chat message')); chatIn.autocomplete = 'off';
    const chatSend = el('button', 'menu-btn', tx('Wyślij', 'Send')); chatSend.type = 'submit';
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
    const invite = button(tx('Kopiuj link zaproszenia', 'Copy invite link'), async () => {
      const url = `${location.origin}${location.pathname}?pokoj=${room.id}`;
      try { await navigator.clipboard.writeText(url); invite.textContent = tx('Skopiowano — wyślij znajomemu', 'Copied — send it to a friend'); }
      catch { prompt(tx('Skopiuj link zaproszenia:', 'Copy the invite link:'), url); }
      setTimeout(() => { invite.textContent = tx('Kopiuj link zaproszenia', 'Copy invite link'); }, 2500);
    }, 'link-btn net-invite');
    // zaproszenia dla znajomych, którzy są teraz w grze
    const friendBox = el('div', 'room-friends');
    const paintFriends = async (): Promise<void> => {
      const { mine } = await listFriends();
      const on = onlinePlayers();
      const here = new Set(slots.filter((x) => x.kind === 'human').map((x) => (x as { id: string }).id));
      const avail = mine.map((f) => on.find((o) => o.id === f.id)).filter((o): o is OnlinePlayer => !!o && !here.has(o.id));
      friendBox.replaceChildren();
      if (!avail.length) { if (mine.length) friendBox.append(el('span', 'net-msg', tx('Żaden z Twoich znajomych nie jest teraz w grze.', 'None of your friends are online right now.'))); return; }
      friendBox.append(el('span', 'net-label', tx('Zaproś:', 'Invite:')));
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
      link.send({ k: 'lobby', preset, level, slots, seed, coop });
      const humans = slots.filter((s) => s.kind === 'human') as Extract<Slot, { kind: 'human' }>[];
      const guests = humans.filter((s) => s.id !== m.id).map((s) => s.nick);
      void updateRoom(room.id, { preset, seed, guest_nick: `${humans.length}/${slots.length}${guests.length ? ` · ${guests.join(', ')}` : ''}` });
    };
    const paint = (): void => {
      head.replaceChildren();
      const title = el('div', 'net-roomtitle');
      title.append(el('strong', '', room.name), el('span', '', `${tx('mapa', 'map')} ${seed}`));
      head.append(title);
      // gospodarz losuje mapę; wszyscy w pokoju widzą ją za panelem
      if (host) head.append(button(tx('Losuj inną mapę', 'Roll another map'), () => {
        seed = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
        paint(); publish(); showMap();
      }, 'link-btn net-reroll'));
      if (host) {
        const ms = el('select'); ms.setAttribute('aria-label', tx('Tryb', 'Mode'));
        for (const [id, label] of MODES) { const o = el('option', '', label); o.value = id; ms.append(o); }
        ms.value = preset;
        ms.addEventListener('change', () => { preset = ms.value as MapPresetId; slots = fresh(seats(preset), slots); paint(); publish(); showMap(); });
        const ls = el('select'); ls.setAttribute('aria-label', tx('Poziom botów', 'Bot difficulty'));
        LEVELS.forEach((n, i) => { const o = el('option', '', `${tx('Boty', 'Bots')}: ${n}`); o.value = String(i); ls.append(o); });
        ls.value = String(level);
        ls.addEventListener('change', () => { level = Number(ls.value); publish(); });
        const cs = el('select'); cs.setAttribute('aria-label', tx('Rodzaj gry', 'Game type'));
        for (const [v, label] of [['0', tx('Rywalizacja', 'Versus')], ['1', tx('Razem przeciw botom', 'Co-op against bots')]] as const) { const o = el('option', '', label); o.value = v; cs.append(o); }
        cs.value = coop ? '1' : '0';
        cs.addEventListener('change', () => { coop = cs.value === '1'; slots = fresh(seats(preset), slots); paint(); publish(); });
        head.append(ms, cs, ls);
      } else head.append(el('span', 'net-chip', modeName(preset)), el('span', 'net-chip', coop ? tx('Razem przeciw botom', 'Co-op against bots') : tx('Rywalizacja', 'Versus')), el('span', 'net-chip', `${tx('Boty', 'Bots')}: ${LEVELS[level]}`));
      teams.replaceChildren();
      for (const team of [0, 1]) {
        const col = el('div', 'net-team');
        const h = el('p', 'net-teamname', coop ? (team === 0 ? tx('Drużyna graczy', 'Players') : tx('Wzmocnione boty', 'Reinforced bots')) : `${tx('Drużyna', 'Team')} ${team + 1}`);
        h.style.setProperty('--team', hex(TEAM_COLORS[team] ?? 0x888888));
        col.append(h);
        slots.forEach((s, i) => {
          if (i % 2 !== team) return;
          const row = el('div', `net-slot ${s.kind}`);
          if (s.kind === 'human') {
            row.append(shield(s.avatar, 30), el('strong', '', s.nick + (s.id === room.host ? tx(' (gospodarz)', ' (host)') : '') + (s.id === m.id ? tx(' — Ty', ' — you') : '')));
            const tc = titleChip(s.id);
            if (tc) row.append(tc);
            else void levelsOf([s.id]).then((got) => { if (got.has(s.id)) paint(); }); // poziom dociągnięty z bazy: odśwież raz
          }
          else if (s.kind === 'bot') row.append(el('span', 'net-bot', '⚙'), el('strong', '', coop && !humanSeat(i) ? `Bot (${LEVELS[level]}, ${tx('wzmocniony', 'reinforced')})` : `Bot (${LEVELS[level]})`));
          else row.append(el('span', 'net-open', '+'), el('span', '', tx('Wolne miejsce', 'Empty seat')));
          const act = el('div', 'net-slot-act');
          if (host && s.kind === 'open') act.append(button(tx('Dodaj bota', 'Add bot'), () => { slots[i] = { kind: 'bot' }; paint(); publish(); }, 'link-btn'));
          if (host && s.kind === 'bot' && humanSeat(i)) act.append(button(tx('Usuń bota', 'Remove bot'), () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'link-btn'));
          if (host && s.kind === 'human' && s.id !== m.id) act.append(button(tx('Wyrzuć', 'Kick'), () => { slots[i] = { kind: 'open' }; paint(); publish(); }, 'link-btn'));
          if (s.kind === 'open' && humanSeat(i)) {
            act.append(button(tx('Usiądź tutaj', 'Sit here'), () => { if (host) { seat(m.id, i); } else link.send({ k: 'seat', id: m.id, slot: i }); }, 'link-btn'));
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
      if (msgIn.k === 'lobby' && !host) { preset = msgIn.preset as MapPresetId; level = msgIn.level; slots = msgIn.slots; coop = msgIn.coop === true; if (typeof msgIn.seed === 'string' && msgIn.seed) seed = msgIn.seed.slice(0, 40); hostSeen = true; paint(); showMap(); }
      if (msgIn.k === 'hello' && host) sync();
      if (msgIn.k === 'seat' && host) seat(msgIn.id, msgIn.slot);
      if (msgIn.k === 'chat' && msgIn.who && typeof msgIn.text === 'string') addChat(msgIn.who, cleanChat(msgIn.text));
      if (msgIn.k === 'close' && !host) { cleanup(); void showOnline(); }
      if (msgIn.k === 'start' && !host) go(msgIn.preset as MapPresetId, msgIn.level, msgIn.seed, msgIn.slots, msgIn.coop === true);
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
    screen(tx('Pokój', 'Room'), true, box, foot);
    showMap();
  }

  /** Twarde wyjście (np. zamknięcie strony): zamyka pokój, jeśli w nim jesteśmy */
  const leave = (): void => cleanup();
  /** Wejście z linku zaproszenia (?pokoj=…): logowanie, jeśli trzeba, potem prosto do pokoju */
  async function join(id: string): Promise<void> {
    cleanup();
    screen(tx('Zaproszenie', 'Invitation'), true, msg(tx('Łączenie z pokojem…', 'Connecting to the room…')));
    await restore();
    if (!me()) { showLogin(false, tx('Zaloguj się, żeby dołączyć do gry znajomego.', "Sign in to join your friend's game."), () => void join(id)); return; }
    const room = await getRoom(id);
    if (typeof room === 'string' || room.status !== 'open') {
      screen(tx('Zaproszenie', 'Invitation'), true, msg(typeof room === 'string' ? tx('Tej gry już nie ma — gospodarz ją zamknął.', 'This game is gone — the host closed it.') : tx('Ten mecz już się zaczął.', 'This match has already started.'), true), back(() => void showOnline(), tx('Przejdź do listy gier', 'Go to game list')));
      return;
    }
    enterRoom(room);
  }

  return { showOnline: () => void showOnline(), showAccount, showHouse: (tab = 0) => showHouse(tab), showLogin: (register = false) => showLogin(register), join: (id) => void join(id), leave };
}

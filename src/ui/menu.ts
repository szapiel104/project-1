import { logoSvg } from './logo';
import { pickArt, slider as cardSlider } from './newgameArt';
import { menuIcon, type MenuIcon } from './menuIcons';
import { gameTagline, loadingScene } from './loadscreen';
import { isTester, me as netMe, onAccount, onlinePlayers, onPresence, progress, restore } from '../net/supa';
import { friendLists, noticesNow, onNotices } from '../net/social';
import { createMessengerButton, openChat } from './messenger';
import { levelOf, titleOf } from '../data/progress';
import { createOnline, type OnlineStart } from './online';
import { avatarSvg } from './avatars';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { BIOME, BIOMES, biomeOfSeed, type Biome } from '../data/biomes';
import { hash2, seedFromText } from '../sim/rng';
import { t, tx, lang, setLang, LANGS } from '../i18n';
import { HELP_CHAPTERS, type HelpBlock } from './helpText';
import { changesBook } from './changesBook';
import type { AaMode } from '../render/postfx';
import { TIERS } from '../render/autoquality';
import { hardReload, newerVersion } from './refresh';
import { SANDBOX as SANDBOX_MENU } from '../testmode';
import { testerNotesPane } from './testerNotes';
import { createBell } from './bell';
import { savesPanel } from './savesPanel';
import type { SaveMeta } from '../saves/store';
import { startSocialToasts } from './socialToasts';

/** Ustawienia zapamiętywane w przeglądarce */
export interface Settings {
  ao: 'off' | 'low' | 'medium' | 'high';
  shadows: number;
  scale: number;
  dayNight: boolean;
  camSpeed: number;
  edgeScroll: boolean;
  sfx: number;
  ui: number;
  amb: number;
  music: number;
  /** Gęsta trawa wokół kamery: 0 wyłączona, 0.6 bliżej, 1 pełna, 1.35 daleko (Ultra) */
  grass: number;
  /** Miękkie cienie (rozmyte krawędzie) */
  soft?: boolean;
  /** Dynamiczna rozdzielczość: obraz zmniejsza się, gdy karta graficzna nie wyrabia (domyślnie wyłączona) */
  dynRes?: boolean;
  /** Gra sama dobiera jakość do komputera (mierzy płynność); ręczna zmiana grafiki to wyłącza */
  auto: boolean;
  /** Ostatnio dobrany poziom automatycznej jakości (następna sesja zaczyna od niego) */
  autoTier?: number;
  /** Wielkość całego interfejsu i menu względem dobranej do ekranu (1 = 100%) */
  uiSize?: number;
  /** Paski zdrowia: zawsze, tylko w walce (ranni i zaznaczeni), tylko zaznaczeni, nigdy */
  hpBars?: 'always' | 'combat' | 'selected' | 'never';
  /** Licznik FPS w rogu ekranu */
  showFps?: boolean;
  /** Dymki z tym, co mówią ludzie po kliknięciu */
  bubbles?: boolean;
  /** Numery grup nad oddziałami na mapie */
  groupTags?: boolean;
  /** Podpowiedzi po najechaniu myszą: od razu, z opóźnieniem, wcale */
  tips?: 'now' | 'delay' | 'off';
  /** Tempo gry na starcie (0 = pauza) */
  startSpeed?: number;
  /** Pytać przed rozbiórką budynku */
  confirmDemolish?: boolean;
  /** Limit klatek na sekundę (0 = bez limitu) */
  fpsLimit?: number;
  /** Jasność obrazu (1 = 100%) */
  brightness?: number;
  /** Deszcz i mgła */
  rain?: boolean;
  fog?: boolean;
  /** Wygładzanie krawędzi (domyślnie MSAA 4×) */
  aa?: AaMode;
  /** Filtrowanie anizotropowe tekstur: 1 (wyłączone), 4, 8, 16 */
  aniso?: number;
  /** Odbicia otoczenia (mapa otoczenia na materiałach) */
  reflections?: boolean;
  /** Wyostrzenie obrazu: 0 wyłączone, 0.3 lekkie, 0.6 mocne */
  sharpen?: number;
}

export const DEFAULT_SETTINGS: Settings = { ao: 'medium', shadows: 4096, scale: 1, dayNight: true, camSpeed: 1, edgeScroll: true, sfx: 1, ui: 0.8, amb: 0.6, music: 0.45, auto: true, grass: 1, aa: 'msaa4', aniso: 16, reflections: true, sharpen: 0 };

export interface MenuEvents {
  onContinue(): void;
  /** „Plan na start od nowa” (przycisk w „Jak grać”) */
  onTutorialReset?(): void;
  onNewGame(seedText: string, preset: MapPresetId, level: number, dev: boolean, instant: boolean, walls: 'mix' | 'stone' | 'wood', biome?: Biome): void;
  onVolume(v: number): void;
  onMute(): boolean;
  onSettings(s: Settings): void;
  /** Gracz się poddaje (mecz kończy się porażką) */
  onSurrender(): void;
  /** Wyjście z gry do menu głównego (gra z botami zostaje zapisana; w sieci to opuszczenie meczu) */
  onQuitToTitle(): void;
  /** Czy to mecz przez sieć (inny opis poddania) */
  isOnline(): boolean;
  /** Podgląd mapy przy tworzeniu nowej gry: wygeneruj i pokaż z lotu ptaka */
  onPreviewMap(seedText: string, preset: MapPresetId, level: number, dev: boolean, walls?: 'mix' | 'stone' | 'wood', biome?: Biome): void;
  /** Koniec podglądu (powrót z ekranu nowej gry bez startu) */
  onPreviewEnd(): void;
  /** Mecz przez sieć się zaczyna: pokój, skład, mój numer gracza i kanał gry */
  onOnlineStart(s: OnlineStart): void;
  /** Zapisy gry (okno „Zapisz grę” / „Wczytaj grę”) */
  saves: { canSave(): boolean; save(name: string, replace?: string): Promise<SaveMeta | string>; load(id: string): Promise<string | null>; changed?(): void };
}

export interface Menu {
  open(inGame: boolean): void;
  /** Otwiera menu od razu na koncie (albo logowaniu, gdy nikt nie jest zalogowany) */
  account(inGame: boolean): void;
  /** „Mój ród” na zakładce kroniki (przycisk na końcu meczu) */
  house(inGame: boolean): void;
  /** Otwiera menu prosto w pokoju z linku zaproszenia */
  join(roomId: string): void;
  close(): void;
  isOpen(): boolean;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  /** `thumb` — miniatura ostatniego zapisu: staje się tłem menu (bez niej tło losuje się z kilku pejzaży) */
  setCanContinue(on: boolean, thumb?: string): void;
}

declare const __BUILD__: string;
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';

const SETTINGS_KEY = 'project1.settings';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> & { ao?: unknown };
    // starsze zapisy trzymały cieniowanie jako tak/nie
    if (typeof raw.ao === 'boolean') raw.ao = raw.ao ? 'medium' : 'off';
    // rozdzielczość 1,5× zdjęta z ustawień (30.10.2026): zapisane „Ostra” i dawne 1,5 → „Ostrzejsza” (1,25×)
    // Michał 7.11.2026: bez nadpróbkowania („niech będzie naturalnie”) — obraz w rozdzielczości ekranu, stare 1,25 → 1
    if (typeof raw.scale === 'number' && raw.scale > 1) raw.scale = 1;
    return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

/** Zapisuje ustawienia w przeglądarce (też automat jakości po zmianie poziomu) */
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* nic */ }
}

/**
 * Trzy kolory przycisków w całej grze (Michał 2.11.2026): zielony — zapisz / zatwierdź / zacznij, czerwony — usuń,
 * wyrzuć, poddaj się, a cała reszta neutralna. Kolor wynika z napisu, chyba że przycisk ma już klasę btn-ok / btn-danger.
 */
const OK = /^(zapisz|save|zaloguj|log in|sign in|załóż konto|create account|utwórz|create|rozpocznij|start|do boju|to battle|dołącz|join|dodaj|add|rozegraj|fight|zatwierdź|confirm|graj|play)/i;
const DANGER = /^(usuń|remove|delete|wyrzuć|kick|tak, poddaję|yes, i (yield|surrender)|wyjdź z pokoju|leave the room|wyzeruj|reset|odbierz|revoke)/i;
export function buttonTone(text: string, cls = ''): string {
  if (/\b(btn-ok|btn-danger|admin-btn|menu-link)\b/.test(cls)) return '';
  const tt = text.trim();
  return OK.test(tt) ? ' btn-ok' : DANGER.test(tt) ? ' btn-danger' : '';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];


/**
 * Menu główne w klimacie gry: pergaminowa tablica na tle osady, która powoli obraca się za nim.
 * Ekrany: główny, nowa gra, ustawienia (zakładki), jak grać (rozdziały). W trakcie gry otwiera je Esc.
 */
export function createMenu(root: HTMLElement, events: MenuEvents): Menu {
  const wrap = el('div', 'menu');
  wrap.hidden = true;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', t('menu.title'));
  // układ jak w starych gotykach: u góry herb i tytuł nad osadą, na dole na środku pasek z pozycjami menu
  // (pośrodku główna — nowa gra albo powrót do gry), a okna (nowa gra, ustawienia…) wyrastają nad paskiem
  const head = el('div', 'menu-head');
  const title = el('p', 'menu-title has-logo');
  title.innerHTML = logoSvg('lgm');
  const sub = el('p', 'menu-sub', t('menu.subtitle'));
  // herb nad nazwą: tarcza z wieżą i skrzyżowanymi włóczniami
  const crest = el('div', 'menu-crest');
  crest.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path d="M18 34 L102 86 M102 34 L18 86" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/>
    <path d="M14 30 l8 2 -2 8z M106 30 l-8 2 2 8z" fill="#b9b2a2"/>
    <path d="M60 12 L96 22 V56 C96 82 78 98 60 108 C42 98 24 82 24 56 V22 Z" fill="#8c1f18" stroke="#e9c145" stroke-width="4"/>
    <path d="M60 18 L90 26 V56 C90 78 75 92 60 101 Z" fill="#6e1711"/>
    <path d="M46 84 V52 h4 v-6 h5 v6 h10 v-6 h5 v6 h4 V84 Z" fill="#e9c145"/>
    <path d="M56 84 v-12 a4 4 0 0 1 8 0 v12z" fill="#6e1711"/>
  </svg>`;
  // w trakcie gry: napis, że to pauza (żeby nie mylić z menu głównym)
  const paused = el('p', 'menu-paused', tx('Gra wstrzymana', 'Game paused'));
  paused.setAttribute('role', 'status');
  const tagline = el('div');
  tagline.innerHTML = gameTagline();
  // w menu tylko logo (Michał 7.11.2026); podtytuł i opis gry są w Ustawienia → Interfejs
  void crest; void sub; void tagline;
  head.append(title, paused);
  // iskry z ognisk unoszące się z dołu ekranu (sama ozdoba)
  const embers = el('div', 'menu-embers');
  embers.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 18; i++) {
    const e = el('span');
    e.style.setProperty('--x', `${(i * 37) % 100}%`);
    e.style.setProperty('--d', `${(i * 0.83) % 9}s`);
    e.style.setProperty('--t', `${7 + ((i * 13) % 6)}s`);
    e.style.setProperty('--s', `${2 + (i % 3)}px`);
    embers.append(e);
  }
  const panel = el('div', 'panel menu-panel');
  panel.hidden = true;
  const body = el('div', 'menu-body');
  panel.append(body);
  const bar = el('nav', 'menu-bar');
  bar.setAttribute('aria-label', t('menu.title'));
  const foot = el('p', 'menu-fine', '');
  // pejzaż w tle jak na ekranie wczytywania (zamek o zmierzchu, rysowany raz, bez animacji); znika w pauzie w grze
  // i przy podglądzie mapy w „Nowej grze”, gdzie pod spodem widać świat
  const scene = el('div', 'menu-scene');
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = loadingScene();
  // tło menu (Michał 7.11.2026): ostatnia osada z zapisu (miniatura, rozmyta, jedna statyczna warstwa) albo jeden z trzech
  // pejzaży wylosowany przy wejściu na stronę (świt / zmierzch / noc — sam filtr barwy na tym samym obrazie, bez kosztu FPS)
  const shot = el('div', 'menu-shot'); shot.setAttribute('aria-hidden', 'true'); shot.dataset.cap = tx('Twoja ostatnia osada', 'Your last settlement');
  scene.append(shot);
  function backdrop(thumb?: string): void {
    shot.style.backgroundImage = thumb ? `url("${thumb}")` : '';
    scene.classList.toggle('has-shot', !!thumb);
  }
  wrap.append(scene, embers, head, panel, bar, foot);
  root.append(wrap);

  let inGame = false;
  let canContinue = false;
  let volume = 0.6;
  let muted = false;
  const settings = loadSettings();
  const save = (): void => { saveSettings(settings); events.onSettings(settings); };
  const manual = (): void => { settings.auto = false; save(); };

  const button = (text: string, onClick: () => void, cls = 'menu-btn'): HTMLButtonElement => {
    const b = el('button', cls + buttonTone(text, cls), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const back = (): HTMLButtonElement => button(t('menu.back'), showMain, 'menu-btn menu-back');
  /** Ekran z nagłówkiem; szeroki = dwie kolumny (zakładki po lewej, treść po prawej) */
  const screen = (heading: string, wide: boolean, ...nodes: Node[]): void => {
    panel.classList.toggle('wide', wide);
    panel.classList.remove('book', 'parch', 'ng-dock'); wrap.classList.remove('book-open');
    panel.hidden = false;
    wrap.classList.add('sub-open');
    markBar(heading);
    body.replaceChildren(el('p', 'menu-heading', heading), ...nodes);
    body.querySelector<HTMLElement>('button, input, select')?.focus();
  };

  // ---- gra przez sieć i konto ----
  const online = createOnline({
    el, button, screen,
    showMain: () => showMain(),
    onStart: (st) => events.onOnlineStart(st),
    openForJoin: (id) => { inGame = false; wrap.classList.remove('in-game'); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    inMatch: () => events.isOnline(),
    preview: (seedText, preset) => { wrap.classList.add('previewing'); events.onPreviewMap(seedText, preset, 2, false); },
    previewEnd: () => { if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); } },
    play: () => showNew(),
  });
  /** Tabliczka konta w lewym dolnym rogu: herb z poziomem, nick, tytuł i pasek PD; klik otwiera „Mój ród” */
  const account = el('div', 'menu-account');
  // dzwoneczek powiadomień przy karcie konta (znajomi, zaproszenia do gry, uwagi testerów)
  const bell = createBell({
    friends: (tab) => online.showFriends(tab),
    join: (id) => online.join(id),
    adminNotes: (id) => online.showHouse(4, id),
    myNotes: (id) => showNotes(id),
    profile: (id) => online.showFriends(0, id),
  });
  /** Okno menu otwarte z powiadomienia także w trakcie gry (gra z botami czeka pod menu jak po Esc) */
  const reveal = (f: () => void): void => {
    // menu schowane = trwa gra: otwieramy je jak po Esc (z „Wróć do gry”)
    if (wrap.hidden) { inGame = true; wrap.classList.add('in-game'); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); }
    f();
  };
  startSocialToasts({
    profile: (id) => reveal(() => online.showFriends(0, id)),
    friends: (tab) => reveal(() => online.showFriends(tab)),
    adminNotes: (id) => reveal(() => online.showHouse(4, id)),
    myNotes: (id) => reveal(() => showNotes(id)),
    chat: (id) => openChat(id),
    quiet: () => events.isOnline() && inGame,
  });
  const paintAccount = (): void => {
    const m = netMe();
    account.replaceChildren();
    if (m) {
      const pr = progress();
      const lv = levelOf(pr?.xp ?? 0);
      const who = el('button', 'acc-me');
      who.type = 'button';
      who.setAttribute('aria-label', tx(`Mój ród: ${m.nick}, ${titleOf(lv.level)}, poziom ${lv.level}, ${lv.into} z ${lv.need} PD`, `My house: ${m.nick}, ${titleOf(lv.level)}, level ${lv.level}, ${lv.into} of ${lv.need} XP`));
      const seal = el('span', 'acc-seal');
      const s = el('span', 'net-shield'); s.innerHTML = avatarSvg(m.avatar, 50);
      seal.append(s, el('span', 'acc-lvl', String(lv.level)));
      const txt = el('span', 'acc-text');
      const bar = el('span', 'acc-xp');
      const fill = el('span', 'acc-xp-fill'); fill.style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
      bar.append(fill);
      txt.append(el('strong', 'acc-nick', m.nick), el('span', 'acc-level', `${titleOf(lv.level)} · ${tx('poziom', 'level')} ${lv.level}`), bar,
        el('span', 'acc-pd', pr ? `${lv.into} / ${lv.need} ${tx('PD', 'XP')}` : tx('pierwszy mecz da pierwsze PD', 'your first match brings XP')));
      const go = el('span', 'acc-go'); go.setAttribute('aria-hidden', 'true'); go.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M9 5l7 7-7 7"/></svg>';
      who.append(seal, txt, go);
      who.addEventListener('click', () => online.showHouse());
      account.append(who);
    } else {
      const box = el('div', 'acc-guest');
      const gseal = el('span', 'acc-seal acc-seal-guest'); gseal.setAttribute('aria-hidden', 'true');
      gseal.innerHTML = '<svg viewBox="0 0 48 54"><path d="M24 2 L44 8 V26 C44 39 35 48 24 52 C13 48 4 39 4 26 V8 Z" fill="#3a1a12" stroke="#e9c766" stroke-width="2.5"/><path d="M24 9 L38 13 V26 C38 35 32 41 24 45 Z" fill="#561f15"/><path d="M24 17 a5 5 0 1 1 0 10 a5 5 0 0 1 0 -10 M14 38 c1.5 -7 6 -9 10 -9 s8.5 2 10 9" fill="none" stroke="#e9c766" stroke-width="2.4" stroke-linecap="round"/></svg>';
      const gtxt = el('span', 'acc-text');
      gtxt.append(el('strong', 'acc-nick', tx('Gość', 'Guest')), el('span', 'acc-level', tx('Zaloguj się, by zbierać poziomy i tytuły', 'Sign in to earn levels and ranks')));
      const row = el('span', 'acc-guest-row');
      row.append(button(tx('Zaloguj się', 'Sign in'), () => online.showLogin(false), 'acc-btn acc-btn-main'), button(tx('Załóż konto', 'Create account'), () => online.showLogin(true), 'acc-btn'));
      box.append(gseal, gtxt, row);
      account.append(box);
    }
  };
  // po zalogowaniu dochodzą pozycje zależne od roli (Uwagi testera) — pasek rysuje się od nowa, gdy okno jest zamknięte
  onAccount(() => { paintAccount(); if (panel.hidden) paintBar(); });
  void restore();
  wrap.append(account);
  // belka w prawym górnym rogu jak w panelach aplikacji (Michał 2.11.2026): wersja, znajomi z liczbą w grze, dzwoneczek
  const topbar = el('div', 'menu-topbar');
  const ver = el('span', 'tb-ver', tx(`wersja ${BUILD}`, `version ${BUILD}`));
  const friendsTb = button('', () => online.showFriends(0), 'tb-btn tb-friends');
  let friendIds = new Set<string>();
  const paintTop = (): void => {
    const m = netMe();
    topbar.hidden = !m;
    const on = onlinePlayers().filter((o) => friendIds.has(o.id)).length;
    const ico = el('span', 'tb-ico'); ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.7 0 4.7 1.6 5.5 4.6"/></svg>';
    friendsTb.replaceChildren(ico, el('span', '', tx('Znajomi', 'Friends')));
    if (on) friendsTb.append(el('span', 'tb-count', tx(`${on} w grze`, `${on} online`)));
    friendsTb.setAttribute('aria-label', on ? tx(`Znajomi — ${on} w grze`, `Friends — ${on} online`) : tx('Znajomi', 'Friends'));
  };
  const loadFriendIds = (): void => { void friendLists().then((l) => { friendIds = new Set(l.friends.map((p) => p.id)); paintTop(); }); };
  topbar.append(ver, friendsTb, createMessengerButton(() => online.showFriends(1)), bell);
  wrap.append(topbar);
  onPresence(paintTop);
  onAccount(loadFriendIds);
  onNotices(() => { if (noticesNow().some((n) => !n.read && (n.kind === 'friend_accept'))) loadFriendIds(); });
  loadFriendIds();
  paintAccount();

  /**
   * Menu po lewej, jak w grach (Michał 28.10.2026): pionowa lista pozycji pod herbem — pierwsza na górze („Kontynuuj”
   * albo „Wróć do gry”), główna wyróżniona czerwoną pieczęcią, na dole wyjście i poddanie. Najechanie albo przejście
   * klawiszem pokazuje pod listą, co kryje pozycja. Strzałki w górę/dół (i w lewo/prawo) chodzą po liście.
   */
  let barItems: HTMLButtonElement[] = [];
  const hint = el('p', 'menu-hint');
  hint.setAttribute('aria-hidden', 'true'); // opis i tak jest przy przycisku (aria-description) — czytnik nie czyta dwa razy
  const barBtn = (text: string, desc: string, onClick: () => void, cls = '', icon: MenuIcon = 'play'): HTMLButtonElement => {
    const b = button('', onClick, `bar-item ${cls}`.trim());
    b.dataset.label = text;
    b.dataset.desc = desc;
    b.setAttribute('aria-description', desc);
    const mark = el('span', 'mi-mark mi-icon'); mark.setAttribute('aria-hidden', 'true'); mark.innerHTML = menuIcon(icon);
    b.append(mark, el('span', 'mi-label', text));
    const show = (): void => { hint.textContent = desc; };
    b.addEventListener('pointerenter', show);
    b.addEventListener('focus', show);
    return b;
  };
  /** Uwagi testera (tylko rola tester albo administrator): co poprawić i dodać; stan „zrobione” wraca od administratora */
  function notesItem(): HTMLButtonElement {
    return barBtn(tx('Uwagi testera', 'Tester notes'), tx('Napisz, co poprawić albo dodać — administrator zobaczy i oznaczy zrobione', 'Write what to fix or add — the administrator sees it and marks it done'), () => showNotes(), '', 'notes');
  }
  function showSaves(mode: 'save' | 'load'): void {
    screen(mode === 'save' ? tx('Zapisz grę', 'Save game') : tx('Wczytaj grę', 'Load game'), true, savesPanel(mode, { ...events.saves, login: () => online.showLogin(false) }));
  }
  function showNotes(focus?: number): void {
    screen(tx('Uwagi testera', 'Tester notes'), true, testerNotesPane(inGame ? tx('w trakcie gry', 'during a game') : tx('menu', 'menu'), focus));
  }
  function paintBar(): void {
    const list: (HTMLButtonElement | 'gap')[] = [];
    if (inGame) {
      list.push(barBtn(t('menu.resume'), tx('Gra czeka tam, gdzie ją zostawiłeś', 'The game waits where you left it'), () => events.onContinue(), 'bar-main', 'resume'));
      list.push(barBtn(t('menu.newGame'), tx('Wybierz mapę, tryb i poziom trudności', 'Pick a map, a mode and the difficulty'), showNew, '', 'new'));
      if (!events.isOnline()) {
        list.push(barBtn(tx('Zapisz grę', 'Save game'), tx('Zapis z miniaturą: do 20 zapisów, w przeglądarce i w chmurze konta (Ctrl+S — szybki zapis)', 'A save with a thumbnail: up to 20, in the browser and your account’s cloud (Ctrl+S — quick save)'), () => showSaves('save'), '', 'save'));
        list.push(barBtn(tx('Wczytaj grę', 'Load game'), tx('Twoje zapisy i autozapisy z miniaturami', 'Your saves and autosaves with thumbnails'), () => showSaves('load'), '', 'load'));
      }
      list.push(barBtn(t('menu.settings'), tx('Grafika, dźwięk, interfejs i sterowanie', 'Graphics, sound, interface and controls'), showSettings, '', 'settings'));
      list.push(barBtn(t('menu.howTo'), tx('Poradnik: osada, gospodarka, wojsko', 'A guide: settlement, economy, warfare'), showHelp, '', 'help'));
      list.push(barBtn(tx('Co nowego', 'What’s new'), tx('Dziennik zmian: co weszło w kolejnych wersjach gry', 'Changelog: what each version of the game brought'), showChanges, '', 'news'));
      if (isTester()) list.push(notesItem());
      list.push('gap');
      list.push(barBtn(tx('Wyjdź do menu', 'Quit to menu'), tx('Zamknij mecz i wróć do menu głównego', 'Close the match and return to the main menu'), () => showQuit(), '', 'quit'));
      list.push(barBtn(tx('Poddaj się', 'Surrender'), tx('Koniec meczu porażką — tego nie da się cofnąć', 'End the match in defeat — there is no going back'), showSurrender, 'mi-danger', 'flag'));
    } else {
      if (canContinue) list.push(barBtn(t('menu.continue'), tx('Wróć do swojej osady z ostatniej gry', 'Return to your settlement from the last game'), () => events.onContinue(), '', 'resume'));
      list.push(barBtn(t('menu.newGame'), tx('Wybierz mapę, tryb i poziom trudności', 'Pick a map, a mode and the difficulty'), showNew, 'bar-main', 'new'));
      list.push(barBtn(tx('Wczytaj grę', 'Load game'), tx('Twoje zapisy i autozapisy z miniaturami', 'Your saves and autosaves with thumbnails'), () => showSaves('load'), '', 'load'));
      list.push(barBtn(tx('Gra przez sieć', 'Online play'), tx('Mecze z innymi graczami: pokoje, drużyny, ranking', 'Matches against other players: rooms, teams, ranking'), () => online.showOnline(), '', 'online'));
      if (netMe()) list.push(barBtn(tx('Znajomi', 'Friends'), tx('Kto jest w grze, zaproszenia, szukanie nowych graczy', 'Who is online, requests, finding new players'), () => online.showFriends(0), '', 'friends'));
      list.push(barBtn(t('menu.settings'), tx('Grafika, dźwięk, interfejs i sterowanie', 'Graphics, sound, interface and controls'), showSettings, '', 'settings'));
      list.push(barBtn(t('menu.howTo'), tx('Poradnik: osada, gospodarka, wojsko', 'A guide: settlement, economy, warfare'), showHelp, '', 'help'));
      list.push(barBtn(tx('Co nowego', 'What’s new'), tx('Dziennik zmian: co weszło w kolejnych wersjach gry', 'Changelog: what each version of the game brought'), showChanges, '', 'news'));
      if (isTester()) list.push(notesItem());
    }
    const ul = el('ul', 'menu-list');
    for (const it of list) {
      const li = el('li', it === 'gap' ? 'mi-gap' : '');
      if (it === 'gap') li.setAttribute('aria-hidden', 'true'); else li.append(it);
      ul.append(li);
    }
    bar.replaceChildren(ul, hint);
    barItems = [...bar.querySelectorAll<HTMLButtonElement>('.bar-item')];
    const main = bar.querySelector<HTMLButtonElement>('.bar-main');
    hint.textContent = main?.dataset.desc ?? '';
    bar.onpointerleave = (): void => { const f = barItems.find((x) => x === document.activeElement) ?? main; hint.textContent = f?.dataset.desc ?? ''; };
  }
  /** Podświetla pozycję paska, której okno jest otwarte */
  function markBar(heading: string): void {
    for (const b of barItems) {
      if (b.dataset.label === heading) { b.setAttribute('aria-current', 'page'); hint.textContent = b.dataset.desc ?? ''; } else b.removeAttribute('aria-current');
    }
  }
  bar.addEventListener('keydown', (e) => {
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight', prev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (!next && !prev) return;
    const i = barItems.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    barItems[(i + (next ? 1 : barItems.length - 1)) % barItems.length]!.focus();
  });
  // Esc w otwartym oknie wraca do paska (a nie zamyka całego menu)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || wrap.hidden || panel.hidden) return;
    // Esc należy do okienka nad menu (profil gracza, pytanie „na pewno?”, dzwoneczek, rozmowa, menu „⋯” zapisu) — samo się
    // zamyka; menu nie może wtedy wracać do paska (w pokoju gry wyjście do paska zamykało pokój, przegląd 4.11.2026)
    const t = e.target as Element | null;
    if (document.querySelector('.cd-back, .fr-modal') || t?.closest?.('.bell, .mx-dock, .mx-panel, .messenger, .sv-more') || document.querySelector('.sv-menu:not([hidden])')) return;
    e.preventDefault(); e.stopPropagation();
    showMain();
  }, true);

  function showMain(): void {
    online.leave();
    panel.classList.remove('wide', 'book'); wrap.classList.remove('book-open');
    if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); }
    panel.hidden = true;
    wrap.classList.remove('sub-open');
    body.replaceChildren();
    paintBar();
    if (inGame) foot.textContent = tx('Esc — wróć do gry · ↑ ↓ wybór', 'Esc — back to the game · ↑ ↓ select');
    else {
      // przycisk odświeżenia: czyści pamięć podręczną i wczytuje najnowszą wersję (zapis i konto zostają); gdy na serwerze
      // jest nowsza wersja, przycisk mówi o tym wprost
      const fresh = button(tx('Wyczyść pamięć i wczytaj grę od nowa', 'Clear cache and reload the game'), () => {
        fresh.disabled = true; fresh.textContent = tx('Wczytuję najnowszą wersję…', 'Loading the latest version…');
        void hardReload();
      }, 'menu-refresh');
      fresh.title = tx('Pobiera grę od nowa z serwera. Zapis gry, konto i ustawienia zostają.', 'Fetches the game afresh from the server. Your save, account and settings are kept.');
      // na co dzień schowany (Michał 2.11.2026: „wywal przycisk o pamięci”) — pokazuje się tylko, gdy na serwerze jest nowsza wersja
      fresh.hidden = true;
      foot.replaceChildren(el('span', '', tx(`wersja ${BUILD} · ↑ ↓ wybór · Enter zatwierdza`, `version ${BUILD} · ↑ ↓ select · Enter confirms`)), fresh);
      void newerVersion().then((v) => {
        if (!v || !fresh.isConnected || fresh.disabled) return;
        fresh.hidden = false;
        fresh.classList.add('newer');
        fresh.textContent = tx(`Jest nowa wersja ${v} — wczytaj`, `New version ${v} is out — load it`);
      });
    }
    bar.querySelector<HTMLButtonElement>('.bar-main')?.focus();
  }

  function showQuit(): void {
    if (!events.isOnline()) { events.onQuitToTitle(); return; }
    const box = el('div', 'menu-form');
    box.append(el('p', '', tx('Wyjście z meczu przez sieć oznacza poddanie się. Twój zamek zostanie bez gospodarza.', 'Leaving an online match means surrendering. Your castle will be left without a lord.')));
    const yes = button(tx('Tak, wychodzę', 'Yes, leave'), () => events.onQuitToTitle(), 'menu-btn');
    const no = button(tx('Nie, gram dalej', 'No, keep playing'), showMain, 'menu-btn menu-back');
    box.append(yes, no);
    screen(tx('Wyjść z meczu?', 'Leave the match?'), false, box);
    no.focus();
  }

  function showSurrender(): void {
    const box = el('div', 'menu-form');
    box.append(el('p', '', events.isOnline()
      ? tx('Mecz skończy się dla Ciebie porażką. Twój zamek zostanie na mapie bez gospodarza — jeśli to 1 na 1 albo nie masz w drużynie nikogo w grze, przeciwnicy od razu wygrają.', 'The match will end in defeat for you. Your castle stays on the map without a lord — in a 1 on 1, or if nobody else on your team is still playing, your opponents win at once.')
      : tx('Mecz skończy się porażką. Tej decyzji nie da się cofnąć.', 'The match will end in defeat. This cannot be undone.')));
    const yes = button(tx('Tak, poddaję się', 'Yes, I surrender'), () => { events.onSurrender(); }, 'menu-btn');
    const no = button(tx('Nie, gram dalej', 'No, keep playing'), showMain, 'menu-btn menu-back');
    box.append(yes, no);
    screen(tx('Poddać się?', 'Surrender?'), false, box);
    no.focus();
  }

  function showNew(): void {
    const form = el('form', 'menu-form newgame');
    /** Kafelek wyboru: duży napis, opis pod spodem, zaznaczony ma złotą ramkę i pieczęć */
    const tile = (group: string, checked: boolean, big: string, small: string, onPick: () => void, extra = ''): HTMLLabelElement => {
      const lab = el('label', `pick ${extra}`);
      const radio = el('input');
      radio.type = 'radio'; radio.name = group; radio.checked = checked;
      radio.addEventListener('change', onPick);
      const art = pickArt(extra);
      if (art) { const a = el('span', 'pick-art'); a.innerHTML = art; lab.append(radio, a); } else lab.append(radio);
      lab.append(el('strong', 'pick-big', big), el('span', 'pick-small', small));
      return lab;
    };
    const section = (name: string, ...kids: Node[]): HTMLElement => { const f = el('fieldset', 'pick-group'); f.append(el('legend', '', name), ...kids); return f; };

    let preset: MapPresetId = '1v1';
    const modeRow = el('div', 'pick-row');
    for (const id of Object.keys(MAP_PRESETS) as MapPresetId[]) {
      const p = MAP_PRESETS[id];
      const [a, b] = id.split('v');
      modeRow.append(tile('mode', id === preset, `${a} ${tx('na', 'vs')} ${b}`, `${t(`menu.mode.${id}`)} · ${tx('mapa', 'map')} ${p.width}×${p.height}`, () => { preset = id; preview(); }, `mode-${id}`));
    }
    let level = 1;
    const levelRow = el('div', 'pick-row four');
    for (const lv of [0, 1, 2, 3]) {
      const [name, desc] = t(`level.${lv}`).split(' — ');
      levelRow.append(tile('level', lv === level, name ?? '', desc ?? '', () => { level = lv; }, `lvl-${lv}`));
    }

    // kraina (docs/teren.md): losowa z nazwy mapy albo wybrana; wybrana idzie do zapisu gry
    let biome: Biome | undefined;
    const BIOME_DESC: Record<Biome, string> = {
      meadow: tx('łąki, lasy, jeziora', 'meadows, woods, lakes'), highland: tx('płaskowyże i urwiska', 'plateaus and cliffs'),
      steppe: tx('sucha trawa, cieplej', 'dry grass, warmer'), north: tx('tajga, zimno, śnieg', 'taiga, cold, snow'),
      desert: tx('piach, wydmy, oazy', 'sand, dunes, oases'),
    };
    const biomeRow = el('div', 'pick-row lands');
    biomeRow.append(tile('biome', true, tx('Losowa', 'Random'), tx('z nazwy mapy', 'from the map name'), () => { biome = undefined; preview(); }, 'biome-any'));
    for (const b of BIOMES) biomeRow.append(tile('biome', false, t(BIOME[b].name), BIOME_DESC[b], () => { biome = b; preview(); }, `biome-${b}`));

    const seedWrap = el('div', 'field');
    const seedLabel = el('label', '', t('menu.mapName'));
    seedLabel.htmlFor = 'menu-seed';
    const row = el('div', 'menu-row');
    const seed = el('input');
    seed.id = 'menu-seed'; seed.autocomplete = 'off'; seed.maxLength = 24; seed.spellcheck = false;
    // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
    const roll = (): void => { seed.value = `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`; };
    roll();
    // podgląd: po każdej zmianie mapa generuje się od nowa i widać ją z lotu ptaka za menu
    const status = el('p', 'preview-status', '');
    status.setAttribute('aria-live', 'polite');
    let timer = 0;
    const preview = (delay = 0): void => {
      clearTimeout(timer);
      status.textContent = tx('Generuję mapę…', 'Generating the map…');
      timer = window.setTimeout(() => requestAnimationFrame(() => setTimeout(() => {
        // gracz już wyszedł z „Nowej gry” (Wstecz w trakcie odliczania) — nie generujemy mapy za menu głównym
        if (!form.isConnected) return;
        events.onPreviewMap(seed.value.trim() || 'project-1', preset, level, dev, walls, biome);
        const name = seed.value.trim() || 'project-1', land = t(BIOME[biome ?? biomeOfSeed(seedFromText(name), hash2)].name);
        status.textContent = tx(`Mapa „${name}” (kraina: ${land}) — widok z lotu ptaka. Losuj, aż trafisz na swoją.`, `Map “${name}” (land: ${land}) — bird’s-eye view. Keep rolling until you find the one you like.`);
      }, 20)), delay);
    };
    seed.addEventListener('input', () => preview(700));
    const rollBtn = button(tx('Losuj inną mapę', 'Roll another map'), () => { roll(); preview(); }, 'btn-plain');
    row.append(seed, rollBtn);
    seedWrap.append(seedLabel, row);

    // tryb dla dewelopera: przełącznik w jednej linii
    let dev = false;
    const devLab = el('label', 'dev-switch');
    const devBox = el('input');
    devBox.type = 'checkbox'; devBox.setAttribute('role', 'switch');
    devBox.addEventListener('change', () => { dev = devBox.checked; instLab.hidden = !dev; wallLab.hidden = !dev; preview(); });
    // tylko testerzy i administratorzy (rola w bazie, Michał 2.11.2026); w trybie testowym ?test zawsze
    devLab.hidden = !isTester() && !SANDBOX_MENU;
    devLab.append(devBox, el('span', 'dev-knob'), el('span', 'dev-text', tx('Tryb deweloperski', 'Developer mode')), el('span', 'dev-hint', tx('miasto w murach, wojsko, pełne zapasy', 'walled town, army, full supplies')));
    // w trybie deweloperskim: budynki od razu gotowe albo zwykła budowa (robotnicy noszą materiał, rusztowania)
    let instant = true;
    const instLab = el('label', 'dev-switch');
    const instBox = el('input');
    instBox.type = 'checkbox'; instBox.setAttribute('role', 'switch'); instBox.checked = true;
    instBox.addEventListener('change', () => { instant = instBox.checked; });
    instLab.append(instBox, el('span', 'dev-knob'), el('span', 'dev-text', tx('Budowa od razu', 'Instant building')), el('span', 'dev-hint', tx('wyłączone: zwykła budowa z noszeniem materiału', 'off: normal building with materials carried in')));
    instLab.hidden = true;
    // w trybie deweloperskim: z czego są mury miasta
    let walls: 'mix' | 'stone' | 'wood' = 'mix';
    const wallLab = el('label', 'dev-switch dev-walls');
    const wallSel = el('select');
    for (const [v, txt] of [['mix', tx('mieszane (kamień i bale)', 'mixed (stone and logs)')], ['stone', tx('kamienne', 'stone')], ['wood', tx('drewniane (palisada)', 'wooden (palisade)')]] as const) {
      const o = el('option'); o.value = v; o.textContent = txt; wallSel.append(o);
    }
    wallSel.addEventListener('change', () => { walls = wallSel.value as typeof walls; preview(); });
    wallLab.append(el('span', 'dev-text', tx('Mury miasta', 'Town walls')), wallSel);
    wallLab.hidden = true;

    const warn = el('p', 'hint', canContinue || inGame ? t('menu.overwrite') : '');
    const start = el('button', 'menu-btn', t('menu.start'));
    start.type = 'submit';
    const foot = el('div', 'newgame-foot');
    foot.append(back(), start);
    // pasek na dole ekranu (Michał 3.11.2026: „zrób to na dole, wtedy więcej mapy”): trzy kolumny — tryb i poziom,
    // kraina i nazwa mapy, opcje dewelopera i przyciski; nad paskiem cała mapa z lotu ptaka
    const col = (cls: string, ...kids: Node[]): HTMLElement => { const c = el('div', `ng-col ${cls}`); c.append(...kids); return c; };
    form.append(
      col('ng-a', section(t('hud.mode'), cardSlider(modeRow, t('hud.mode')))),
      col('ng-a2', section(t('menu.level'), cardSlider(levelRow, t('menu.level')))),
      col('ng-b', section(tx('Kraina', 'Land'), cardSlider(biomeRow, tx('Kraina', 'Land')))),
      col('ng-c', seedWrap, status, devLab, instLab, wallLab, warn, foot),
    );
    form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); wrap.classList.remove('previewing'); events.onNewGame(seed.value.trim() || 'project-1', preset, level, dev, instant, walls, biome); });
    screen(t('menu.newGame'), true, form);
    panel.classList.add('parch', 'ng-dock'); // pergamin jak w księgach, pasek na dole ekranu (Michał 3.11.2026)
    wrap.classList.add('previewing');
    preview();
  }

  /** Suwak 0–100 % z wartością obok */
  const slider = (label: string, value: number, onInput: (v: number) => void, min = 0, max = 100, unit = '%'): HTMLElement => {
    const row = el('div', 'set-row');
    const lab = el('label', 'set-name', label);
    const id = `set-${label.replace(/\W+/g, '-')}`;
    lab.htmlFor = id;
    const input = el('input');
    input.id = id; input.type = 'range'; input.min = String(min); input.max = String(max); input.step = '5';
    input.value = String(Math.round(value));
    const out = el('output', 'set-val', `${input.value}${unit}`);
    input.addEventListener('input', () => { out.textContent = `${input.value}${unit}`; onInput(Number(input.value)); });
    row.classList.add('slide');
    row.append(lab, out, input);
    return row;
  };
  /** Wybór z kilku opcji: rząd przycisków, wybrany podświetlony (widać od razu wszystkie możliwości) */
  const choice = <T extends string | number>(label: string, value: T, options: [T, string][], onChange: (v: T) => void): HTMLElement => {
    const row = el('div', 'set-row');
    const lab = el('label', 'set-name', label);
    const id = `set-${label.replace(/\W+/g, '-')}`;
    lab.htmlFor = id;
    row.classList.add('seg-row');
    const name = el('span', 'set-name', label);
    name.id = id;
    const seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', id);
    const bs = options.map(([v, text]) => {
      const b = button(text, () => { bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onChange(v); }, 'seg-btn');
      b.setAttribute('aria-pressed', String(v === value));
      return b;
    });
    seg.append(...bs);
    row.append(name, seg);
    return row;
  };
  const check = (label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement => {
    const lab = el('label', 'set-toggle');
    const box = el('input');
    box.type = 'checkbox'; box.checked = value;
    box.addEventListener('change', () => onChange(box.checked));
    lab.append(el('span', 'set-name', label), box, el('span', 'dev-knob'));
    return lab;
  };

  /** Liczby rzymskie do numerów rozdziałów (1–39 wystarcza) */
  const roman = (n: number): string => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n % 10 === n ? n : 0] ?? (n >= 10 ? 'X'.repeat(Math.floor(n / 10)) + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n % 10] : String(n));
  /** Nagłówek strony księgi: mała linijka (rozdział / grupa), tytuł z ikoną i ozdobnik */
  const bookHead = (kicker: string, title: string, icon: MenuIcon): HTMLElement => {
    const h = el('header', 'bk-head');
    const ic = el('span', 'bk-head-ico'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = menuIcon(icon);
    const tt = el('div', 'bk-head-t');
    tt.append(el('span', 'bk-kicker', kicker), el('h2', 'help-title', title));
    h.append(ic, tt);
    return h;
  };
  /**
   * Ustawienia jak księga „Jak grać”: duże okno, spis po lewej, strona po prawej. Grafika rozbita na strony
   * (od najważniejszych dla wyglądu), a wszystko, co gra poświęca dla płynności, osobno na samym końcu.
   */
  function showSettings(startArg?: unknown): void {
    const start = typeof startArg === 'number' ? startArg : 0;
    const other: [string, () => Node[]][] = [
      [t('menu.sound'), () => {
        const mute = check(tx('Wycisz cały dźwięk', 'Mute all sound'), muted, (v) => { if (v !== muted) muted = events.onMute(); });
        return [
          mute,
          slider(t('set.master'), volume * 100, (v) => { volume = v / 100; events.onVolume(volume); }),
          slider(t('set.sfx'), settings.sfx * 100, (v) => { settings.sfx = v / 100; save(); }),
          slider(t('set.ui'), settings.ui * 100, (v) => { settings.ui = v / 100; save(); }),
          slider(t('set.amb'), settings.amb * 100, (v) => { settings.amb = v / 100; save(); }),
          slider(tx('Muzyka', 'Music'), (settings.music ?? 0.45) * 100, (v) => { settings.music = v / 100; save(); }),
          // autorzy nagrań (CC BY-SA wymaga podpisu w grze)
          el('p', 'hint', tx('Ptaki, odgłosy wsi, kury, róg, grzmot i deszcz, budowa, praca drwali i górników, łuki, strzały, miecze, tarcze, głosy i krzyki ludzi, zwierzęta, ogień, bramy i zawalenia: 0 A.D. © Wildfire Games (wildfiregames.com), licencja CC BY-SA 3.0. Świerszcze i dzwon: Freesound (rsn267, beambot, Nox_Sound), CC0. Wilki: wycie — U.S. Fish and Wildlife Service i Retron (Wikimedia Commons, domena publiczna), warczenie — bonebrah (CC0) i congusbongus („Dog growls”, CC BY 3.0). Muzyka (OpenGameArt): RandomMind, nihilocrat, Tozan, Umplix, NBJDLukasAbsolute, Spring Spring, Cethiel, Bobjt, Of Far Different Nature (J. Dowland), Eldritch Grim (CC0); Marcelo Fernandez — „Medieval Rondo”; Yubatake — „Wendale Abbey”, „Mannin Fair”, „Middel Weie”; Pyerye — „The Bard”; Otto Halmén — „Death Is Just Another Path”; Alexandr Zhelanov — „For the King”; Bobjt i TridentKeep — „War: Humans March”; jukeri12 — „Royal Strings” (CC BY 3.0/4.0). Efekty: Kenney (CC0/MIT).', 'Birds, village sounds, hens, horn, thunder and rain, building work, woodcutters and miners, bows, arrows, swords, shields, voices and cries, animals, fire, gates and collapsing buildings: 0 A.D. © Wildfire Games (wildfiregames.com), CC BY-SA 3.0 licence. Crickets and bell: Freesound (rsn267, beambot, Nox_Sound), CC0. Wolves: howls — U.S. Fish and Wildlife Service and Retron (Wikimedia Commons, public domain), growls — bonebrah (CC0) and congusbongus (“Dog growls”, CC BY 3.0). Music (OpenGameArt): RandomMind, nihilocrat, Tozan, Umplix, NBJDLukasAbsolute, Spring Spring, Cethiel, Bobjt, Of Far Different Nature (J. Dowland), Eldritch Grim (CC0); Marcelo Fernandez — “Medieval Rondo”; Yubatake — “Wendale Abbey”, “Mannin Fair”, “Middel Weie”; Pyerye — “The Bard”; Otto Halmén — “Death Is Just Another Path”; Alexandr Zhelanov — “For the King”; Bobjt & TridentKeep — “War: Humans March”; jukeri12 — “Royal Strings” (CC BY 3.0/4.0). Effects: Kenney (CC0/MIT).')),
        ];
      }],
      [tx('Interfejs', 'Interface'), () => [
        // etykieta w obu językach, żeby każdy znalazł przełącznik, nawet gdy nie zna obecnego języka
        (() => { const a = el('div', 'set-about'); a.append(el('strong', '', t('menu.subtitle')), el('span', '', t('menu.tagline')), el('span', 'set-about-dev', t('menu.taglineDev'))); return a; })(),
        choice('Język / Language', lang(), LANGS, (v) => setLang(v)),
        choice(tx('Wielkość interfejsu', 'Interface size'), settings.uiSize ?? 1, [[0.5, '50%'], [0.75, '75%'], [0.85, '85%'], [1, '100%'], [1.15, '115%'], [1.3, '130%'], [1.5, '150%']], (v) => { settings.uiSize = v; save(); }),
        choice(tx('Paski zdrowia', 'Health bars'), settings.hpBars ?? 'combat', [['always', tx('Zawsze', 'Always')], ['combat', tx('W walce', 'In combat')], ['selected', tx('Zaznaczeni', 'Selected')], ['never', tx('Nigdy', 'Never')]], (v) => { settings.hpBars = v; save(); }),
        check(tx('Licznik FPS w rogu ekranu', 'FPS counter in the screen corner'), settings.showFps ?? false, (v) => { settings.showFps = v; save(); }),
        check(tx('Dymki z tym, co mówią ludzie', 'Speech bubbles with what people say'), settings.bubbles ?? true, (v) => { settings.bubbles = v; save(); }),
        check(tx('Numery grup nad oddziałami', 'Company numbers above your troops'), settings.groupTags ?? true, (v) => { settings.groupTags = v; save(); }),
        choice(tx('Podpowiedzi po najechaniu', 'Tooltips on hover'), settings.tips ?? 'now', [['now', tx('Od razu', 'Instantly')], ['delay', tx('Z opóźnieniem', 'Delayed')], ['off', tx('Wcale', 'Off')]], (v) => { settings.tips = v; save(); }),
        el('p', 'hint', tx('„W walce” — paski tylko nad rannymi i zaznaczonymi. Pełne statystyki wydajności zawsze pod klawiszem F3.', '“In combat” — bars only over the wounded and the selected. Full performance stats are always under F3.')),
        el('p', 'hint', tx('Powiększa albo pomniejsza całe menu, paski, okna budynków i wojska. 100% to wielkość dobrana do ekranu; na dużym monitorze daj więcej, na małym laptopie mniej. Zmiana działa od razu.', 'Scales the whole menu, bars, building and army windows up or down. 100% is the size fitted to your screen; go higher on a big monitor, lower on a small laptop. Takes effect at once.')),
      ]],
      [tx('Rozgrywka', 'Gameplay'), () => [
        choice(tx('Tempo gry na starcie', 'Starting game speed'), settings.startSpeed ?? 1, [[0, t('hud.pause')], [1, '1×'], [2, '2×'], [3, '3×']], (v) => { settings.startSpeed = v; save(); }),
        check(tx('Pytaj przed rozbiórką budynku', 'Ask before demolishing a building'), settings.confirmDemolish ?? true, (v) => { settings.confirmDemolish = v; save(); }),
        el('p', 'hint', tx('Tempo na starcie działa od następnej gry (w grze przez sieć tempo jest zawsze 1×).', 'Starting speed applies from the next game (online games always run at 1×).')),
      ]],
      [t('set.controls'), () => [
        slider(t('set.camSpeed'), settings.camSpeed * 100, (v) => { settings.camSpeed = v / 100; save(); }, 50, 200),
        check(t('set.edge'), settings.edgeScroll, (v) => { settings.edgeScroll = v; save(); }),
        el('p', 'hint', t('set.controlsHint')),
      ]],
      [tx('Dla twórców', 'For creators'), () => {
        // stałe odnośniki do narzędzi: podgląd modeli i pusta scena testowa (otwierają się w nowej karcie)
        const link = (label: string, href: string, hint: string): HTMLElement => {
          const box = el('div', 'set-row');
          const a = document.createElement('a');
          a.className = 'menu-btn menu-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
          box.append(a, el('p', 'hint', hint));
          return box;
        };
        return [
          link(tx('Podgląd modeli', 'Model viewer'), 'modele.html', tx('Każdy model gry osobno, na podstawce, w pełnej jakości: obracasz go myszą z każdej strony.', 'Every game model on its own, on a plinth, in full quality: spin it with the mouse from every side.')),
          link(tx('Pusta scena testowa', 'Empty test scene'), '?test=1&pusta=1', tx('Płaska łąka z samą twierdzą, bez zapisu gry — do sprawdzania jednej rzeczy w grze.', 'A flat meadow with just the keep, no save — for checking one thing in the game.')),
        ];
      }],
      // autorzy grafiki z paczek (CC BY i CC BY-SA wymagają podpisu w grze; pełna lista w CREDITS.md)
      [tx('Autorzy', 'Credits'), () => [
        el('h3', 'help-h', tx('Twórcy gry', 'Made by')),
        el('p', 'help-p', tx(
          'Michał Szapiel — twórca gry i założyciel SuroCrave.',
          'Michał Szapiel — creator of the game and founder of SuroCrave.')),
        el('p', 'help-p', tx(
          'Mikołaj Szymczak — najlepszy tester i twórca nowych pomysłów.',
          'Mikołaj Szymczak — our finest tester and the man behind many new ideas.')),
        el('h3', 'help-h', tx('Grafika z zewnątrz', 'Third-party art')),
        el('p', 'help-p', tx(
          'Koń, pałka wodna i liście na stawie: 0 A.D. © Wildfire Games (wildfiregames.com), licencja CC BY-SA 3.0.',
          'Horse, cattails and pond leaves: 0 A.D. © Wildfire Games (wildfiregames.com), CC BY-SA 3.0 licence.')),
        el('p', 'help-p', tx(
          'Pochodnia: Secret Histories (Mooses2k), licencja CC BY-SA 4.0.',
          'Torch: Secret Histories (Mooses2k), CC BY-SA 4.0 licence.')),
        el('p', 'help-p', tx(
          'Kamień, snopek i sztaby żelaza w składzie (Sketchfab, licencja CC BY 4.0): matousekfoto („Granite block”), Korea Culture Information Service Agency („Sheaf of Rice”), Aparicio Silva 3D („Blacksmith Ingots”).',
          'Stone, sheaf and iron bars in the stockpile (Sketchfab, CC BY 4.0 licence): matousekfoto ("Granite block"), Korea Culture Information Service Agency ("Sheaf of Rice"), Aparicio Silva 3D ("Blacksmith Ingots").')),
        el('p', 'help-p', tx(
          'Na licencji CC0 (dziękujemy autorom): drzewa, trawa, krzaki, kosz, jabłko, chleb, beczka i strzecha — Poly Haven; tekstury — ambientCG; kruk — OpenGameArt; ryba — Khronos glTF Sample Assets (Microsoft); ciała postaci — MakeHuman / MPFB; ruch — CMU Graphics Lab Motion Capture Database.',
          'Under CC0 (with thanks to the authors): trees, grass, bushes, basket, apple, bread, barrel and thatch — Poly Haven; textures — ambientCG; raven — OpenGameArt; fish — Khronos glTF Sample Assets (Microsoft); character bodies — MakeHuman / MPFB; motion — CMU Graphics Lab Motion Capture Database.')),
        el('p', 'hint', tx('Dźwięki i muzyka: zakładka Dźwięk.', 'Sounds and music: see the Sound tab.')),
      ]],
    ];

    // ---- strony grafiki ----
    const tip = (text: string, warn = false): HTMLElement => {
      const p = el('p', warn ? 'help-tip set-warn' : 'help-tip');
      p.append(el('strong', '', warn ? tx('Uwaga', 'Note') : tx('Rada', 'Tip')), document.createTextNode(` ${text}`));
      return p;
    };
    const intro = (text: string): HTMLElement => el('p', 'help-p', text);
    let current = 0;
    const preset = (label: string, tier: number, desc = '', over?: Partial<typeof TIERS[number]>): HTMLButtonElement => {
      const q = { ...TIERS[tier]!, ...over };
      const b = button('', () => {
        Object.assign(settings, { scale: q.scale, shadows: q.shadows, ao: q.ao, grass: q.grass, soft: !!q.soft, aa: q.aa, reflections: q.reflections, aniso: 16, sharpen: q.aa === 'fxaa' || q.aa === 'smaa' ? 0.3 : 0, ...(over ? { dynRes: true } : {}) });
        manual(); showSettings(current);
      }, 'menu-btn set-preset');
      // obecny poziom podświetlony, żeby było widać, na czym gra stoi
      const on = settings.scale === q.scale && settings.shadows === q.shadows && settings.ao === q.ao && settings.aa === q.aa && settings.grass === q.grass;
      b.setAttribute('aria-pressed', String(on));
      const bars = el('span', 'set-preset-bars'); bars.setAttribute('aria-hidden', 'true');
      const lvl = [1, 2, 4, TIERS.length - 1].indexOf(tier);
      for (let k = 0; k < 4; k++) bars.append(el('span', k <= lvl ? 'on' : ''));
      b.append(bars, el('strong', '', label), el('span', 'set-preset-d', desc));
      return b;
    };
    const graphics: [string, () => Node[]][] = [
      [tx('Poziom grafiki', 'Graphics level'), () => {
        const presets = el('div', 'set-presets');
        presets.append(
          preset(tx('Niska', 'Low'), 1, tx('stary laptop', 'old laptop')),
          preset(tx('Średnia', 'Medium'), 2, tx('zwykły komputer', 'ordinary PC')),
          // tryb wydajny (Michał 7.11.2026): cienie 2048 bez AO, szybkie wygładzanie, rozdzielczość dopasowuje się sama
          preset(tx('Wydajna', 'Performance'), 3, tx('najwięcej klatek', 'most frames per second'), { shadows: 2048, ao: 'off', aa: 'fxaa', grass: 0.8 }),
          preset(tx('Wysoka', 'High'), 4, tx('dobra karta', 'good graphics card')),
          preset('Ultra', TIERS.length - 1, tx('mocna karta', 'strong graphics card')),
        );
        return [
          intro(tx('Gotowy poziom ustawia wszystkie opcje grafiki naraz. Potem na kolejnych stronach możesz poprawić pojedyncze rzeczy.', 'A preset sets every graphics option at once. You can fine-tune single things on the following pages.')),
          presets,
          tip(tx('Na dobrej karcie graficznej wybierz Ultra albo Wysoka. Automatyczna jakość i inne oszczędzanie są na ostatniej stronie, „Tylko dla słabych komputerów”.', 'On a good graphics card pick Ultra or High. Automatic quality and other savers are on the last page, “Weak computers only”.')),
        ];
      }],
      [tx('Ostrość i krawędzie', 'Sharpness and edges'), () => [
        intro(tx('Tu jest największa różnica w wyglądzie modeli: ostre krawędzie, gładkie liście i wyraźne tekstury.', 'This is where models gain the most: crisp edges, smooth leaves and clear textures.')),
        choice(tx('Wygładzanie krawędzi', 'Anti-aliasing'), settings.aa ?? 'msaa4', [['off', t('set.off')], ['fxaa', 'FXAA'], ['smaa', 'SMAA'], ['msaa2', 'MSAA 2×'], ['msaa4', 'MSAA 4×'], ['msaa8', 'MSAA 8×']], (v) => { settings.aa = v; manual(); }),
        choice(tx('Filtrowanie tekstur', 'Texture filtering'), settings.aniso ?? 16, [[1, tx('Zwykłe', 'Basic')], [4, '4×'], [8, '8×'], [16, '16×']], (v) => { settings.aniso = v; manual(); }),
        choice(tx('Wyostrzenie obrazu', 'Image sharpening'), settings.sharpen ?? 0, [[0, t('set.off')], [0.3, tx('Lekkie', 'Light')], [0.6, tx('Mocne', 'Strong')]], (v) => { settings.sharpen = v; manual(); }),
        tip(tx('Rozdzielczość kosztuje najwięcej: „Ostrzejsza” liczy obraz w 1,25× — na szerokim monitorze (ultrapanorama) lepiej „Normalna”. MSAA 4× to najlepszy wybór, 8× na mocną kartę. Filtrowanie 16× prawie nic nie kosztuje — zostaw. FXAA i SMAA są lżejsze, ale rozmywają; wyostrzenie ma sens tylko z nimi, przy MSAA jest zbędne.', 'Resolution costs the most: “Sharper” renders at 1.25× — on a wide (ultrawide) monitor “Normal” is the better pick. MSAA 4× is the best pick, 8× for a strong card. 16× filtering costs next to nothing — leave it. FXAA and SMAA are lighter but blur; sharpening only makes sense with them and is unnecessary with MSAA.')),
      ]],
      [tx('Światło i cienie', 'Light and shadows'), () => [
        intro(tx('Światło decyduje, czy modele wyglądają jak bryły, czy jak płaskie wycinanki.', 'Light decides whether models look solid or like flat cut-outs.')),
        check(tx('Odbicia otoczenia', 'Environment reflections'), settings.reflections ?? true, (v) => { settings.reflections = v; manual(); }),
        choice(t('set.shadows'), settings.shadows, [[0, t('set.off')], [1024, t('set.low')], [2048, t('set.medium')], [4096, t('set.high')]], (v) => { settings.shadows = v; manual(); }),
        check(tx('Miękkie cienie (po ponownym uruchomieniu gry)', 'Soft shadows (after restarting the game)'), settings.soft ?? false, (v) => { settings.soft = v; manual(); }),
        choice(t('set.ao'), settings.ao, [['off', t('set.off')], ['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')]], (v) => { settings.ao = v; manual(); }),
        slider(tx('Jasność (100% = jak zaprojektowano)', 'Brightness (100% = as designed)'), (settings.brightness ?? 1) * 100, (v) => { settings.brightness = v / 100; save(); }, 60, 200),
        tip(tx('Jasność to nie jakość — zostaw 100%, chyba że monitor jest ciemny; więcej rozjaśnia wszystko i spłaszcza obraz. Odbicia otoczenia są tanie, a modele przestają być płaskie po stronie cienia — zostaw włączone. Cienie i cieniowanie zagłębień kosztują najwięcej ze wszystkich opcji.', 'Brightness is not quality — keep it at 100% unless your monitor is dark; more washes everything out. Environment reflections are cheap and stop models looking flat on the shaded side — leave them on. Shadows and ambient occlusion cost the most of all options.')),
      ]],
      [tx('Świat', 'World'), () => [
        intro(tx('Szczegóły w oddali, pora dnia i pogoda — klimat wioski.', 'Distant detail, time of day and weather — the feel of the village.')),
        // trawa jest wyłączona (terrain.ts, GRASS); to ustawienie decyduje, z jak daleka budynki, krzaki i drzewa są w pełnej wersji
        choice(tx('Szczegóły w oddali', 'Distant detail'), settings.grass, [[0, tx('Niskie', 'Low')], [0.6, tx('Średnie', 'Medium')], [1, tx('Wysokie', 'High')], [1.35, tx('Ultra', 'Ultra')]], (v) => { settings.grass = v; manual(); }),
        check(t('set.dayNight'), settings.dayNight, (v) => { settings.dayNight = v; save(); }),
        check(tx('Deszcz', 'Rain'), settings.rain ?? true, (v) => { settings.rain = v; save(); }),
        check(tx('Mgła', 'Fog'), settings.fog ?? true, (v) => { settings.fog = v; save(); }),
        tip(tx('Pora dnia, deszcz i mgła to klimat, a nie wydajność — wyłączaj je tylko, gdy przeszkadzają w grze.', 'Time of day, rain and fog are atmosphere, not performance — switch them off only if they get in the way.')),
      ]],
      [tx('Tylko dla słabych komputerów', 'Weak computers only'), () => [
        intro(tx('Te opcje nie poprawiają wyglądu — robią odwrotnie: obniżają jakość obrazu, żeby gra chodziła płynniej na słabym sprzęcie.', 'These options do not improve the look — the opposite: they lower image quality so the game runs smoother on weak hardware.')),
        tip(tx('Na mocnym komputerze zostaw automatyczną jakość i dynamiczną rozdzielczość wyłączone. Automat przy każdym spadku płynności sam ścina grafikę (i nigdy nie wchodzi na Ultra), a dynamiczna rozdzielczość zmniejsza obraz — przez to gra potrafi wyglądać brzydziej.', 'On a strong computer leave automatic quality and dynamic resolution off. Auto cuts the graphics on every drop in smoothness (and never goes to Ultra), and dynamic resolution shrinks the image — that is why the game can look worse.'), true),
        check(tx('Automatyczna jakość (gra sama obniża grafikę, gdy przycina)', 'Automatic quality (the game lowers graphics itself when it stutters)'), settings.auto, (v) => { settings.auto = v; save(); }),
        check(tx('Dynamiczna rozdzielczość (mniejszy obraz, gdy karta nie wyrabia)', 'Dynamic resolution (smaller image when the card can’t keep up)'), settings.dynRes ?? true, (v) => { settings.dynRes = v; save(); }),
        choice(tx('Limit klatek', 'Frame limit'), settings.fpsLimit ?? 0, [[30, '30'], [60, '60'], [0, tx('Bez limitu', 'Unlimited')]], (v) => { settings.fpsLimit = v; save(); }),
        tip(tx('Limit klatek nie psuje obrazu: 60 klatek chłodzi kartę i laptop, 30 tylko na bardzo słabym sprzęcie. Gdy gra mimo wszystko przycina, zmniejszaj po kolei: cieniowanie zagłębień, cienie, trawę, rozdzielczość.', 'The frame limit does not spoil the image: 60 fps keeps the card and laptop cooler, 30 only on very weak hardware. If the game still stutters, lower in turn: ambient occlusion, shadows, grass, resolution.')),
      ]],
    ];

    // ---- księga: spis po lewej, strona po prawej ----
    const SET_ICONS: MenuIcon[] = ['eye', 'gem', 'sun', 'tree', 'gauge', 'speaker', 'layout', 'crown', 'mouse', 'hammer', 'scroll'];
    const pages: { title: string; group: number; icon: MenuIcon; make: () => Node[] }[] = [
      ...graphics.map(([title, make]) => ({ title, group: 0, icon: 'eye' as MenuIcon, make })),
      ...other.map(([title, make]) => ({ title, group: 1, icon: 'eye' as MenuIcon, make })),
    ];
    pages.forEach((p, i) => { p.icon = SET_ICONS[i] ?? 'scroll'; });
    const book = el('div', 'help-book set-book');
    const nav = el('nav', 'help-nav');
    nav.setAttribute('aria-label', t('menu.settings'));
    const list = el('div', 'help-toc'); list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical');
    const pane = el('div', 'help-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = 'set-pane'; pane.tabIndex = -1;
    const btns: HTMLButtonElement[] = [];
    const show = (i: number): void => {
      current = i;
      btns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      const pg = pages[i]!;
      const sheet = el('article', 'help-text set-sheet');
      const inGroup = pages.filter((x) => x.group === pg.group);
      sheet.append(bookHead(`${pg.group === 0 ? t('menu.graphics') : tx('Pozostałe', 'Other')} · ${inGroup.indexOf(pg) + 1} / ${inGroup.length}`, pg.title, pg.icon), ...pg.make());
      pane.replaceChildren(sheet);
      pane.scrollTop = 0;
    };
    let group = -1, n = 0;
    pages.forEach((pg, i) => {
      if (pg.group !== group) { group = pg.group; list.append(el('p', 'help-toc-group', group === 0 ? t('menu.graphics') : tx('Pozostałe', 'Other'))); n = 0; }
      n++;
      const b = button('', () => show(i), 'help-toc-item');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
      const ic = el('span', 'help-toc-n bk-ico'); ic.innerHTML = menuIcon(pg.icon);
      b.append(ic, el('span', 'help-toc-t', pg.title));
      btns.push(b); list.append(b);
    });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      const k = (Math.max(0, i) + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
      show(k); btns[k]!.focus();
    });
    nav.append(list);
    // zmiany zapisują się od razu; „Zapisz” potwierdza i wraca do menu
    const reset = button(t('set.reset'), () => { Object.assign(settings, DEFAULT_SETTINGS); save(); showSettings(current); }, 'btn-plain help-again');
    const ok = button(tx('Zapisz', 'Save'), () => { save(); showMain(); }, 'menu-btn menu-save set-save');
    nav.append(reset, ok, back());
    book.append(nav, pane);
    screen(t('menu.settings'), true, book);
    panel.classList.add('book'); wrap.classList.add('book-open');
    const first = Math.max(0, Math.min(pages.length - 1, start));
    show(first);
    btns[first]!.focus();
  }

  /** „Jak grać” jak księga: duże okno na prawie cały ekran, spis rozdziałów po lewej, treść po prawej (podgląd modeli jest osobno: Ustawienia → Dla twórców → Podgląd modeli) */
  function showHelp(startArg?: unknown): void {
    // wywoływane też prosto z kliknięcia (wtedy argumentem jest zdarzenie) — liczy się tylko liczba
    const start = typeof startArg === 'number' ? startArg : 0;
    const block = (b: HelpBlock): Node => {
      if (typeof b === 'string') return el('p', 'help-p', b);
      if ('h' in b) return el('h3', 'help-h', b.h);
      if ('tip' in b) { const p = el('p', 'help-tip'); p.append(el('strong', '', tx('Rada', 'Tip')), document.createTextNode(` ${b.tip}`)); return p; }
      const table = el('table', 'help-table');
      b.table.forEach((row, i) => {
        const tr = el('tr');
        for (const cell of row) tr.append(el(i === 0 ? 'th' : 'td', '', cell));
        table.append(tr);
      });
      return table;
    };
    // Księga „Jak grać” (Michał 3.11.2026: „nie czuć klimatu”): pergaminowa strona, nagłówek rozdziału z numerem,
    // inicjał, ikony w spisie i przejście do poprzedniego / następnego rozdziału na dole strony
    const HELP_ICONS: MenuIcon[] = ['flag', 'axe', 'wheat', 'friends', 'flask', 'hammer', 'moon', 'sword', 'shield', 'online', 'mouse'];
    const total = HELP_CHAPTERS.length;
    const pages: { title: string; group: number; icon: MenuIcon; make: () => Node[] }[] = [
      ...HELP_CHAPTERS.map((c, ci) => ({ title: c.title, group: 0, icon: HELP_ICONS[ci] ?? 'scroll', make: () => {
        const box = el('article', 'help-text bk-chapter');
        box.append(bookHead(tx(`Rozdział ${roman(ci + 1)} · ${ci + 1} z ${total}`, `Chapter ${roman(ci + 1)} · ${ci + 1} of ${total}`), c.title, HELP_ICONS[ci] ?? 'scroll'), ...c.blocks.map(block));
        const pager = el('nav', 'bk-pager'); pager.setAttribute('aria-label', tx('Rozdziały', 'Chapters'));
        const prev = HELP_CHAPTERS[ci - 1], next = HELP_CHAPTERS[ci + 1];
        if (prev) { const b = button('', () => { show(ci - 1); btns[ci - 1]!.focus(); }, 'bk-turn prev'); b.append(el('span', 'bk-turn-k', tx('← Poprzedni', '← Previous')), el('strong', '', prev.title)); pager.append(b); }
        else pager.append(el('span'));
        if (next) { const b = button('', () => { show(ci + 1); btns[ci + 1]!.focus(); }, 'bk-turn next'); b.append(el('span', 'bk-turn-k', tx('Następny →', 'Next →')), el('strong', '', next.title)); pager.append(b); }
        box.append(pager);
        return [box];
      } })),
    ];
    const book = el('div', 'help-book');
    const nav = el('nav', 'help-nav');
    nav.setAttribute('aria-label', tx('Rozdziały', 'Chapters'));
    const list = el('div', 'help-toc'); list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical');
    const pane = el('div', 'help-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = 'help-pane'; pane.tabIndex = -1;
    const btns: HTMLButtonElement[] = [];
    const show = (i: number): void => {
      btns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      pane.replaceChildren(...pages[i]!.make());
      pane.scrollTop = 0;
    };
    let group = -1, n = 0;
    pages.forEach((pg, i) => {
      if (pg.group !== group) { group = pg.group; list.append(el('p', 'help-toc-group', group === 0 ? tx('Nauka gry', 'Learning the game') : tx('Encyklopedia', 'Encyclopaedia'))); n = 0; }
      n++;
      const b = button('', () => show(i), 'help-toc-item');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
      const ic = el('span', 'help-toc-n bk-ico'); ic.innerHTML = menuIcon(pg.icon);
      b.append(ic, el('span', 'help-toc-t', pg.title));
      btns.push(b); list.append(b);
    });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      const k = (Math.max(0, i) + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
      show(k); btns[k]!.focus();
    });
    nav.append(list);
    if (events.onTutorialReset) {
      const again = button(tx('Plan na start od nowa', 'Restart the opening plan'), () => { events.onTutorialReset!(); again.textContent = tx('Plan włączony — zobaczysz go w grze', 'Plan on — you will see it in game'); }, 'btn-plain help-again');
      nav.append(again);
    }
    nav.append(back());
    book.append(nav, pane);
    screen(t('menu.howTo'), true, book);
    panel.classList.add('book'); wrap.classList.add('book-open');
    show(Math.max(0, Math.min(pages.length - 1, start)));
    btns[Math.max(0, Math.min(pages.length - 1, start))]!.focus();
  }

  /** „Co nowego”: dziennik zmian dla graczy (src/data/changelog.ts), dzień po dniu */
  function showChanges(): void {
    const { book, nav, focusFirst } = changesBook();
    nav.append(back());
    screen(tx('Co nowego', 'What’s new'), true, book);
    panel.classList.add('book'); wrap.classList.add('book-open');
    focusFirst();
  }

  return {
    open(game) { inGame = game; wrap.classList.toggle('in-game', game); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); },
    house(game) { inGame = game; wrap.classList.toggle('in-game', game); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.showHouse(1); },
    account(game) { inGame = game; wrap.classList.toggle('in-game', game); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); if (netMe()) online.showAccount(); else online.showLogin(false); },
    join(id) { inGame = false; wrap.classList.remove('in-game'); wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    close() { if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); } wrap.hidden = true; document.body.classList.remove('menu-open'); },
    isOpen: () => !wrap.hidden,
    setVolume(v) { volume = v; },
    setMuted(m) { muted = m; },
    setCanContinue(on, thumb) { canContinue = on; backdrop(on ? thumb : undefined); if (!wrap.hidden && panel.hidden) paintBar(); },
  };
}

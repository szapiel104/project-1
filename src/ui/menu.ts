import { me as netMe, onAccount, progress, restore } from '../net/supa';
import { levelOf, titleOf } from '../data/progress';
import { createOnline, type OnlineStart } from './online';
import { avatarSvg } from './avatars';
import { createGallery, GALLERY, type GalleryEntry } from '../render/gallery';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { t, tx, lang, setLang, LANGS } from '../i18n';
import { HELP_CHAPTERS, type HelpBlock } from './helpText';
import type { AaMode } from '../render/postfx';
import { TIERS } from '../render/autoquality';

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

export const DEFAULT_SETTINGS: Settings = { ao: 'medium', shadows: 4096, scale: 2, dayNight: true, camSpeed: 1, edgeScroll: true, sfx: 1, ui: 0.8, amb: 0.6, music: 0.45, auto: true, grass: 1, aa: 'msaa4', aniso: 16, reflections: true, sharpen: 0 };

export interface MenuEvents {
  onContinue(): void;
  /** „Plan na start od nowa” (przycisk w „Jak grać”) */
  onTutorialReset?(): void;
  onNewGame(seedText: string, preset: MapPresetId, level: number, dev: boolean, instant: boolean, walls: 'mix' | 'stone' | 'wood'): void;
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
  onPreviewMap(seedText: string, preset: MapPresetId, level: number, dev: boolean, walls?: 'mix' | 'stone' | 'wood'): void;
  /** Koniec podglądu (powrót z ekranu nowej gry bez startu) */
  onPreviewEnd(): void;
  /** Mecz przez sieć się zaczyna: pokój, skład, mój numer gracza i kanał gry */
  onOnlineStart(s: OnlineStart): void;
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
  setCanContinue(on: boolean): void;
}

declare const __BUILD__: string;
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';

const SETTINGS_KEY = 'project1.settings';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> & { ao?: unknown };
    // starsze zapisy trzymały cieniowanie jako tak/nie
    if (typeof raw.ao === 'boolean') raw.ao = raw.ao ? 'medium' : 'off';
    return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

/** Zapisuje ustawienia w przeglądarce (też automat jakości po zmianie poziomu) */
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* nic */ }
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
  const title = el('p', 'menu-title', 'Project‑1');
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
  head.append(crest, title, sub);
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
  wrap.append(embers, head, panel, bar, foot);
  root.append(wrap);

  let inGame = false;
  let canContinue = false;
  let volume = 0.6;
  let muted = false;
  const settings = loadSettings();
  const save = (): void => { saveSettings(settings); events.onSettings(settings); };
  const manual = (): void => { settings.auto = false; save(); };

  const button = (text: string, onClick: () => void, cls = 'menu-btn'): HTMLButtonElement => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const back = (): HTMLButtonElement => button(t('menu.back'), showMain, 'menu-btn menu-back');
  /** Ekran z nagłówkiem; szeroki = dwie kolumny (zakładki po lewej, treść po prawej) */
  const screen = (heading: string, wide: boolean, ...nodes: Node[]): void => {
    panel.classList.toggle('wide', wide);
    panel.classList.remove('book'); wrap.classList.remove('book-open');
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
    openForJoin: (id) => { inGame = false; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    inMatch: () => events.isOnline(),
    preview: (seedText, preset) => { wrap.classList.add('previewing'); events.onPreviewMap(seedText, preset, 2, false); },
    previewEnd: () => { if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); } },
    play: () => showNew(),
  });
  /** Tabliczka konta w lewym dolnym rogu: herb z poziomem, nick, tytuł i pasek PD; klik otwiera „Mój ród” */
  const account = el('div', 'menu-account');
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
      box.append(el('strong', 'acc-nick', tx('Gość', 'Guest')), el('span', 'acc-level', tx('Zaloguj się, by zbierać poziomy i tytuły', 'Sign in to earn levels and ranks')));
      const row = el('span', 'acc-guest-row');
      row.append(button(tx('Zaloguj się', 'Sign in'), () => online.showLogin(false), 'link-btn acc-link'), el('span', 'acc-sep', '·'), button(tx('Załóż konto', 'Create account'), () => online.showLogin(true), 'link-btn acc-link'));
      box.append(row);
      account.append(box);
    }
  };
  onAccount(paintAccount);
  void restore();
  wrap.append(account);
  paintAccount();

  /** Pasek na dole: [lewe pozycje] [główna pośrodku] [prawe pozycje]; strzałki w lewo/prawo przechodzą między pozycjami */
  let barItems: HTMLButtonElement[] = [];
  const barBtn = (text: string, onClick: () => void, main = false): HTMLButtonElement => {
    const b = button(text, onClick, main ? 'bar-item bar-main' : 'bar-item');
    b.dataset.label = text;
    return b;
  };
  function paintBar(): void {
    const left = el('div', 'bar-side left'), right = el('div', 'bar-side right');
    let main: HTMLButtonElement;
    if (inGame) {
      left.append(barBtn(t('menu.newGame'), showNew), barBtn(t('menu.settings'), showSettings), barBtn(t('menu.howTo'), showHelp));
      main = barBtn(t('menu.resume'), () => events.onContinue(), true);
      // w trakcie gry bez „Gry przez sieć” (jest w menu głównym po wyjściu): pasek mieści się też na wąskim ekranie
      right.append(barBtn(tx('Wyjdź do menu', 'Quit to menu'), () => showQuit()), barBtn(tx('Poddaj się', 'Surrender'), showSurrender));
    } else {
      if (canContinue) left.append(barBtn(t('menu.continue'), () => events.onContinue()));
      left.append(barBtn(tx('Gra przez sieć', 'Online play'), () => online.showOnline()));
      main = barBtn(t('menu.newGame'), showNew, true);
      right.append(barBtn(t('menu.settings'), showSettings), barBtn(t('menu.howTo'), showHelp));
    }
    // złote linie tylko w odstępach między napisami (osobne elementy), więc napisy nie potrzebują ciemnego tła, które by je zasłaniało
    const line = (cls: string): HTMLElement => { const s = el('span', cls); s.setAttribute('aria-hidden', 'true'); return s; };
    const lace = (side: HTMLElement, isLeft: boolean): void => {
      const items = [...side.children];
      side.replaceChildren();
      if (isLeft) side.append(line('bar-line'));
      items.forEach((it) => { if (!isLeft) side.append(line('bar-sep')); side.append(it); if (isLeft) side.append(line('bar-sep')); });
      if (!isLeft) side.append(line('bar-line'));
    };
    lace(left, true); lace(right, false);
    bar.replaceChildren(left, main, right);
    barItems = [...bar.querySelectorAll<HTMLButtonElement>('.bar-item')];
  }
  /** Podświetla pozycję paska, której okno jest otwarte */
  function markBar(heading: string): void {
    for (const b of barItems) {
      if (b.dataset.label === heading) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
  }
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = barItems.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    barItems[(i + (e.key === 'ArrowRight' ? 1 : barItems.length - 1)) % barItems.length]!.focus();
  });
  // Esc w otwartym oknie wraca do paska (a nie zamyka całego menu)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || wrap.hidden || panel.hidden) return;
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
    foot.textContent = inGame ? tx('Esc — wróć do gry · ← → wybór', 'Esc — back to the game · ← → select') : tx(`wersja ${BUILD} · ← → wybór · Enter zatwierdza`, `version ${BUILD} · ← → select · Enter confirms`);
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
      lab.append(radio, el('strong', 'pick-big', big), el('span', 'pick-small', small));
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
        events.onPreviewMap(seed.value.trim() || 'project-1', preset, level, dev, walls);
        status.textContent = tx(`Mapa „${seed.value.trim() || 'project-1'}” — widok z lotu ptaka. Losuj, aż trafisz na swoją.`, `Map “${seed.value.trim() || 'project-1'}” — bird’s-eye view. Keep rolling until you find the one you like.`);
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
    form.append(section(t('hud.mode'), modeRow), section(t('menu.level'), levelRow), seedWrap, status, devLab, instLab, wallLab, warn, foot);
    form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); wrap.classList.remove('previewing'); events.onNewGame(seed.value.trim() || 'project-1', preset, level, dev, instant, walls); });
    screen(t('menu.newGame'), true, form);
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
          el('p', 'hint', tx('Ptaki, odgłosy wsi, kury, róg i grzmot: 0 A.D. © Wildfire Games (wildfiregames.com), licencja CC BY-SA 3.0. Świerszcze i dzwon: Freesound (rsn267, beambot, Nox_Sound), CC0. Muzyka: RandomMind, nihilocrat, Tozan (OpenGameArt, CC0). Efekty: Kenney (CC0/MIT).', 'Birds, village sounds, hens, horn and thunder: 0 A.D. © Wildfire Games (wildfiregames.com), CC BY-SA 3.0 licence. Crickets and bell: Freesound (rsn267, beambot, Nox_Sound), CC0. Music: RandomMind, nihilocrat, Tozan (OpenGameArt, CC0). Effects: Kenney (CC0/MIT).')),
        ];
      }],
      [tx('Interfejs', 'Interface'), () => [
        // etykieta w obu językach, żeby każdy znalazł przełącznik, nawet gdy nie zna obecnego języka
        choice('Język / Language', lang(), LANGS, (v) => setLang(v)),
        choice(tx('Wielkość interfejsu', 'Interface size'), settings.uiSize ?? 1, [[0.5, '50%'], [0.75, '75%'], [0.85, '85%'], [1, '100%'], [1.15, '115%'], [1.3, '130%'], [1.5, '150%']], (v) => { settings.uiSize = v; save(); }),
        choice(tx('Paski zdrowia', 'Health bars'), settings.hpBars ?? 'combat', [['always', tx('Zawsze', 'Always')], ['combat', tx('W walce', 'In combat')], ['selected', tx('Zaznaczeni', 'Selected')], ['never', tx('Nigdy', 'Never')]], (v) => { settings.hpBars = v; save(); }),
        check(tx('Licznik FPS w rogu ekranu', 'FPS counter in the screen corner'), settings.showFps ?? false, (v) => { settings.showFps = v; save(); }),
        check(tx('Dymki z tym, co mówią ludzie', 'Speech bubbles with what people say'), settings.bubbles ?? true, (v) => { settings.bubbles = v; save(); }),
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
    ];

    // ---- strony grafiki ----
    const tip = (text: string, warn = false): HTMLElement => {
      const p = el('p', warn ? 'help-tip set-warn' : 'help-tip');
      p.append(el('strong', '', warn ? tx('Uwaga', 'Note') : tx('Rada', 'Tip')), document.createTextNode(` ${text}`));
      return p;
    };
    const intro = (text: string): HTMLElement => el('p', 'help-p', text);
    let current = 0;
    const preset = (label: string, tier: number): HTMLButtonElement => button(label, () => {
      const q = TIERS[tier]!;
      Object.assign(settings, { scale: q.scale, shadows: q.shadows, ao: q.ao, grass: q.grass, soft: !!q.soft, aa: q.aa, reflections: q.reflections, aniso: 16, sharpen: q.aa === 'fxaa' || q.aa === 'smaa' ? 0.3 : 0 });
      manual(); showSettings(current);
    }, 'menu-btn set-preset');
    const graphics: [string, () => Node[]][] = [
      [tx('Poziom grafiki', 'Graphics level'), () => {
        const presets = el('div', 'set-presets');
        presets.append(preset(tx('Niska', 'Low'), 1), preset(tx('Średnia', 'Medium'), 2), preset(tx('Wysoka', 'High'), 4), preset('Ultra', TIERS.length - 1));
        return [
          intro(tx('Gotowy poziom ustawia wszystkie opcje grafiki naraz. Potem na kolejnych stronach możesz poprawić pojedyncze rzeczy.', 'A preset sets every graphics option at once. You can fine-tune single things on the following pages.')),
          presets,
          tip(tx('Na dobrej karcie graficznej wybierz Ultra albo Wysoka. Automatyczna jakość i inne oszczędzanie są na ostatniej stronie, „Tylko dla słabych komputerów”.', 'On a good graphics card pick Ultra or High. Automatic quality and other savers are on the last page, “Weak computers only”.')),
        ];
      }],
      [tx('Ostrość i krawędzie', 'Sharpness and edges'), () => [
        intro(tx('Tu jest największa różnica w wyglądzie modeli: ostre krawędzie, gładkie liście i wyraźne tekstury.', 'This is where models gain the most: crisp edges, smooth leaves and clear textures.')),
        choice(t('set.scale'), settings.scale, [[0.75, t('set.scaleLow')], [1, t('set.scaleNormal')], [2, t('set.scaleSharp')]], (v) => { settings.scale = v; manual(); }),
        choice(tx('Wygładzanie krawędzi', 'Anti-aliasing'), settings.aa ?? 'msaa4', [['off', t('set.off')], ['fxaa', 'FXAA'], ['smaa', 'SMAA'], ['msaa2', 'MSAA 2×'], ['msaa4', 'MSAA 4×'], ['msaa8', 'MSAA 8×']], (v) => { settings.aa = v; manual(); }),
        choice(tx('Filtrowanie tekstur', 'Texture filtering'), settings.aniso ?? 16, [[1, tx('Zwykłe', 'Basic')], [4, '4×'], [8, '8×'], [16, '16×']], (v) => { settings.aniso = v; manual(); }),
        choice(tx('Wyostrzenie obrazu', 'Image sharpening'), settings.sharpen ?? 0, [[0, t('set.off')], [0.3, tx('Lekkie', 'Light')], [0.6, tx('Mocne', 'Strong')]], (v) => { settings.sharpen = v; manual(); }),
        tip(tx('MSAA 4× to najlepszy wybór, 8× na mocną kartę. Filtrowanie 16× prawie nic nie kosztuje — zostaw. FXAA i SMAA są lżejsze, ale rozmywają; wyostrzenie ma sens tylko z nimi, przy MSAA jest zbędne.', 'MSAA 4× is the best pick, 8× for a strong card. 16× filtering costs next to nothing — leave it. FXAA and SMAA are lighter but blur; sharpening only makes sense with them and is unnecessary with MSAA.')),
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
        intro(tx('Trawa, pora dnia i pogoda — klimat wioski.', 'Grass, time of day and weather — the feel of the village.')),
        choice(tx('Trawa', 'Grass'), settings.grass, [[0, t('set.off')], [0.6, tx('Bliżej kamery', 'Near the camera')], [1, tx('Pełna', 'Full')], [1.35, tx('Daleko (Ultra)', 'Far (Ultra)')]], (v) => { settings.grass = v; manual(); }),
        check(t('set.dayNight'), settings.dayNight, (v) => { settings.dayNight = v; save(); }),
        check(tx('Deszcz', 'Rain'), settings.rain ?? true, (v) => { settings.rain = v; save(); }),
        check(tx('Mgła', 'Fog'), settings.fog ?? true, (v) => { settings.fog = v; save(); }),
        tip(tx('Pora dnia, deszcz i mgła to klimat, a nie wydajność — wyłączaj je tylko, gdy przeszkadzają w grze.', 'Time of day, rain and fog are atmosphere, not performance — switch them off only if they get in the way.')),
      ]],
      [tx('Tylko dla słabych komputerów', 'Weak computers only'), () => [
        intro(tx('Te opcje nie poprawiają wyglądu — robią odwrotnie: obniżają jakość obrazu, żeby gra chodziła płynniej na słabym sprzęcie.', 'These options do not improve the look — the opposite: they lower image quality so the game runs smoother on weak hardware.')),
        tip(tx('Na mocnym komputerze zostaw automatyczną jakość i dynamiczną rozdzielczość wyłączone. Automat przy każdym spadku płynności sam ścina grafikę (i nigdy nie wchodzi na Ultra), a dynamiczna rozdzielczość zmniejsza obraz — przez to gra potrafi wyglądać brzydziej.', 'On a strong computer leave automatic quality and dynamic resolution off. Auto cuts the graphics on every drop in smoothness (and never goes to Ultra), and dynamic resolution shrinks the image — that is why the game can look worse.'), true),
        check(tx('Automatyczna jakość (gra sama obniża grafikę, gdy przycina)', 'Automatic quality (the game lowers graphics itself when it stutters)'), settings.auto, (v) => { settings.auto = v; save(); }),
        check(tx('Dynamiczna rozdzielczość (mniejszy obraz, gdy karta nie wyrabia)', 'Dynamic resolution (smaller image when the card can’t keep up)'), settings.dynRes ?? false, (v) => { settings.dynRes = v; save(); }),
        choice(tx('Limit klatek', 'Frame limit'), settings.fpsLimit ?? 0, [[30, '30'], [60, '60'], [0, tx('Bez limitu', 'Unlimited')]], (v) => { settings.fpsLimit = v; save(); }),
        tip(tx('Limit klatek nie psuje obrazu: 60 klatek chłodzi kartę i laptop, 30 tylko na bardzo słabym sprzęcie. Gdy gra mimo wszystko przycina, zmniejszaj po kolei: cieniowanie zagłębień, cienie, trawę, rozdzielczość.', 'The frame limit does not spoil the image: 60 fps keeps the card and laptop cooler, 30 only on very weak hardware. If the game still stutters, lower in turn: ambient occlusion, shadows, grass, resolution.')),
      ]],
    ];

    // ---- księga: spis po lewej, strona po prawej ----
    const pages: { title: string; group: number; make: () => Node[] }[] = [
      ...graphics.map(([title, make]) => ({ title, group: 0, make })),
      ...other.map(([title, make]) => ({ title, group: 1, make })),
    ];
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
      sheet.append(el('h2', 'help-title', pg.title), ...pg.make());
      pane.replaceChildren(sheet);
      pane.scrollTop = 0;
    };
    let group = -1, n = 0;
    pages.forEach((pg, i) => {
      if (pg.group !== group) { group = pg.group; list.append(el('p', 'help-toc-group', group === 0 ? t('menu.graphics') : tx('Pozostałe', 'Other'))); n = 0; }
      n++;
      const b = button('', () => show(i), 'help-toc-item');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
      b.append(el('span', 'help-toc-n', pg.group === 0 ? String(n) : '◆'), el('span', 'help-toc-t', pg.title));
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

  /** Zakładka z modelami: lista po lewej, obracający się model i opis po prawej */
  function galleryPane(entries: GalleryEntry[]): HTMLElement {
    const box = el('div', 'gallery');
    const list = el('div', 'gallery-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', tx('Postacie', 'Characters'));
    const view = el('div', 'gallery-view');
    const canvas = el('canvas', 'gallery-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const name = el('p', 'gallery-name');
    const text = el('p', 'gallery-text');
    view.append(canvas, name, text);
    box.append(list, view);
    let g: { show(id: string): void } | null = null;
    const pick = (e: GalleryEntry, b: HTMLButtonElement): void => {
      list.querySelectorAll('[aria-selected]').forEach((x) => x.setAttribute('aria-selected', 'false'));
      b.setAttribute('aria-selected', 'true');
      name.textContent = e.name; text.textContent = e.text;
      g?.show(e.id);
    };
    let group = '';
    const first: [GalleryEntry, HTMLButtonElement][] = [];
    for (const e of entries) {
      if (e.group !== group) { group = e.group; list.append(el('p', 'gallery-group', group)); }
      const b = button(e.name, () => pick(e, b), 'gallery-item');
      b.setAttribute('role', 'option');
      list.append(b);
      first.push([e, b]);
    }
    // renderer powstaje, gdy płótno jest już na stronie (zna swój rozmiar)
    requestAnimationFrame(() => { if (!canvas.isConnected) return; g = createGallery(canvas); pick(...first[0]!); });
    return box;
  }

  /** „Jak grać” jak księga: duże okno na prawie cały ekran, spis po lewej (nauka gry i encyklopedia), treść po prawej */
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
    const pages: { title: string; group: number; make: () => Node[] }[] = [
      ...HELP_CHAPTERS.map((c) => ({ title: c.title, group: 0, make: () => { const box = el('article', 'help-text'); box.append(el('h2', 'help-title', c.title), ...c.blocks.map(block)); return [box]; } })),
      { title: tx('Postacie i zwierzęta', 'People and animals'), group: 1, make: () => [galleryPane(GALLERY.people)] },
      { title: tx('Budynki', 'Buildings'), group: 1, make: () => [galleryPane(GALLERY.buildings)] },
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
      b.append(el('span', 'help-toc-n', pg.group === 0 ? String(n) : '◆'), el('span', 'help-toc-t', pg.title));
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

  return {
    open(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); },
    house(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.showHouse(1); },
    account(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); if (netMe()) online.showAccount(); else online.showLogin(false); },
    join(id) { inGame = false; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    close() { if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); } wrap.hidden = true; document.body.classList.remove('menu-open'); },
    isOpen: () => !wrap.hidden,
    setVolume(v) { volume = v; },
    setMuted(m) { muted = m; },
    setCanContinue(on) { canContinue = on; if (!wrap.hidden && panel.hidden) paintBar(); },
  };
}

import { me as netMe, onAccount, restore } from '../net/supa';
import { createOnline, type OnlineStart } from './online';
import { avatarSvg } from './avatars';
import { createGallery, GALLERY, type GalleryEntry } from '../render/gallery';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { t } from '../i18n';
import { HELP_CHAPTERS, type HelpBlock } from './helpText';

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
}

export const DEFAULT_SETTINGS: Settings = { ao: 'medium', shadows: 4096, scale: 2, dayNight: true, camSpeed: 1, edgeScroll: true, sfx: 1, ui: 0.8, amb: 0.6, music: 0.45, auto: true, grass: 1 };

export interface MenuEvents {
  onContinue(): void;
  onNewGame(seedText: string, preset: MapPresetId, level: number, dev: boolean, instant: boolean): void;
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
  onPreviewMap(seedText: string, preset: MapPresetId, level: number, dev: boolean): void;
  /** Koniec podglądu (powrót z ekranu nowej gry bez startu) */
  onPreviewEnd(): void;
  /** Mecz przez sieć się zaczyna: pokój, skład, mój numer gracza i kanał gry */
  onOnlineStart(s: OnlineStart): void;
}

export interface Menu {
  open(inGame: boolean): void;
  /** Otwiera menu od razu na koncie (albo logowaniu, gdy nikt nie jest zalogowany) */
  account(inGame: boolean): void;
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
    panel.hidden = false;
    wrap.classList.add('sub-open');
    markBar(heading);
    body.replaceChildren(el('p', 'menu-heading', heading), ...nodes);
    body.querySelector<HTMLElement>('button, input, select')?.focus();
  };
  /** Zakładki: lista przycisków po lewej, wybrana treść po prawej */
  const tabbed = (tabs: [string, () => Node[]][], top = false): HTMLElement => {
    const box = el('div', top ? 'menu-tabs top' : 'menu-tabs');
    const nav = el('div', 'menu-nav');
    nav.setAttribute('role', 'tablist');
    const pane = el('div', 'menu-pane');
    pane.setAttribute('role', 'tabpanel');
    const buttons: HTMLButtonElement[] = [];
    const show = (i: number): void => {
      buttons.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); });
      pane.replaceChildren(...tabs[i]![1]());
    };
    tabs.forEach(([name], i) => {
      const b = button(name, () => show(i), 'menu-tab');
      b.setAttribute('role', 'tab');
      buttons.push(b);
      nav.append(b);
    });
    box.append(nav, pane);
    show(0);
    return box;
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
  });
  /** Pasek konta nad menu: herb, nick i przycisk konta albo zaproszenie do logowania */
  const account = el('div', 'menu-account');
  const paintAccount = (): void => {
    const m = netMe();
    account.replaceChildren();
    if (m) {
      const who = el('button', 'acc-me');
      who.type = 'button';
      who.setAttribute('aria-label', `Konto: ${m.nick}`);
      const s = el('span', 'net-shield'); s.innerHTML = avatarSvg(m.avatar, 34);
      const txt = el('span', 'acc-text');
      txt.append(el('strong', '', m.nick), el('span', '', 'zalogowany · konto'));
      who.append(s, txt);
      who.addEventListener('click', () => online.showAccount());
      account.append(who);
    } else {
      account.append(button('Zaloguj się', () => online.showLogin(false), 'link-btn acc-link'), el('span', 'acc-sep', '·'), button('Załóż konto', () => online.showLogin(true), 'link-btn acc-link'));
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
      right.append(barBtn('Wyjdź do menu', () => showQuit()), barBtn('Poddaj się', showSurrender));
    } else {
      if (canContinue) left.append(barBtn(t('menu.continue'), () => events.onContinue()));
      left.append(barBtn('Gra przez sieć', () => online.showOnline()));
      main = barBtn(t('menu.newGame'), showNew, true);
      right.append(barBtn(t('menu.settings'), showSettings), barBtn(t('menu.howTo'), showHelp));
    }
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
    panel.classList.remove('wide');
    if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); }
    panel.hidden = true;
    wrap.classList.remove('sub-open');
    body.replaceChildren();
    paintBar();
    foot.textContent = inGame ? 'Esc — wróć do gry · ← → wybór' : `wersja ${BUILD} · ← → wybór · Enter zatwierdza`;
    bar.querySelector<HTMLButtonElement>('.bar-main')?.focus();
  }

  function showQuit(): void {
    if (!events.isOnline()) { events.onQuitToTitle(); return; }
    const box = el('div', 'menu-form');
    box.append(el('p', '', 'Wyjście z meczu przez sieć oznacza poddanie się. Twój zamek zostanie bez gospodarza.'));
    const yes = button('Tak, wychodzę', () => events.onQuitToTitle(), 'menu-btn');
    const no = button('Nie, gram dalej', showMain, 'menu-btn menu-back');
    box.append(yes, no);
    screen('Wyjść z meczu?', false, box);
    no.focus();
  }

  function showSurrender(): void {
    const box = el('div', 'menu-form');
    box.append(el('p', '', events.isOnline()
      ? 'Mecz skończy się dla Ciebie porażką. Twój zamek zostanie na mapie bez gospodarza — jeśli to 1 na 1 albo nie masz w drużynie nikogo w grze, przeciwnicy od razu wygrają.'
      : 'Mecz skończy się porażką. Tej decyzji nie da się cofnąć.'));
    const yes = button('Tak, poddaję się', () => { events.onSurrender(); }, 'menu-btn');
    const no = button('Nie, gram dalej', showMain, 'menu-btn menu-back');
    box.append(yes, no);
    screen('Poddać się?', false, box);
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
      modeRow.append(tile('mode', id === preset, `${a} na ${b}`, `${t(`menu.mode.${id}`)} · mapa ${p.width}×${p.height}`, () => { preset = id; preview(); }, `mode-${id}`));
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
      status.textContent = 'Generuję mapę…';
      timer = window.setTimeout(() => requestAnimationFrame(() => setTimeout(() => {
        events.onPreviewMap(seed.value.trim() || 'project-1', preset, level, dev);
        status.textContent = `Mapa „${seed.value.trim() || 'project-1'}” — widok z lotu ptaka. Losuj, aż trafisz na swoją.`;
      }, 20)), delay);
    };
    seed.addEventListener('input', () => preview(700));
    const rollBtn = button('Losuj inną mapę', () => { roll(); preview(); }, 'btn-plain');
    row.append(seed, rollBtn);
    seedWrap.append(seedLabel, row);

    // tryb dla dewelopera: przełącznik w jednej linii
    let dev = false;
    const devLab = el('label', 'dev-switch');
    const devBox = el('input');
    devBox.type = 'checkbox'; devBox.setAttribute('role', 'switch');
    devBox.addEventListener('change', () => { dev = devBox.checked; instLab.hidden = !dev; preview(); });
    devLab.append(devBox, el('span', 'dev-knob'), el('span', 'dev-text', 'Tryb deweloperski'), el('span', 'dev-hint', 'miasto w murach, wojsko, pełne zapasy'));
    // w trybie deweloperskim: budynki od razu gotowe albo zwykła budowa (robotnicy noszą materiał, rusztowania)
    let instant = true;
    const instLab = el('label', 'dev-switch');
    const instBox = el('input');
    instBox.type = 'checkbox'; instBox.setAttribute('role', 'switch'); instBox.checked = true;
    instBox.addEventListener('change', () => { instant = instBox.checked; });
    instLab.append(instBox, el('span', 'dev-knob'), el('span', 'dev-text', 'Budowa od razu'), el('span', 'dev-hint', 'wyłączone: zwykła budowa z noszeniem materiału'));
    instLab.hidden = true;

    const warn = el('p', 'hint', canContinue || inGame ? t('menu.overwrite') : '');
    const start = el('button', 'menu-btn', t('menu.start'));
    start.type = 'submit';
    const foot = el('div', 'newgame-foot');
    foot.append(back(), start);
    form.append(section(t('hud.mode'), modeRow), section(t('menu.level'), levelRow), seedWrap, status, devLab, instLab, warn, foot);
    form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); wrap.classList.remove('previewing'); events.onNewGame(seed.value.trim() || 'project-1', preset, level, dev, instant); });
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

  function showSettings(): void {
    const tabs = tabbed([
      [t('menu.sound'), () => {
        const mute = check('Wycisz cały dźwięk', muted, (v) => { if (v !== muted) muted = events.onMute(); });
        return [
          mute,
          slider(t('set.master'), volume * 100, (v) => { volume = v / 100; events.onVolume(volume); }),
          slider(t('set.sfx'), settings.sfx * 100, (v) => { settings.sfx = v / 100; save(); }),
          slider(t('set.ui'), settings.ui * 100, (v) => { settings.ui = v / 100; save(); }),
          slider(t('set.amb'), settings.amb * 100, (v) => { settings.amb = v / 100; save(); }),
          slider('Muzyka', (settings.music ?? 0.45) * 100, (v) => { settings.music = v / 100; save(); }),
        ];
      }],
      [t('menu.graphics'), () => [
        check('Automatyczna jakość (gra sama dobiera grafikę do komputera)', settings.auto, (v) => { settings.auto = v; save(); }),
        // ręczna zmiana wyłącza automat: gracz wie lepiej
        choice(t('set.shadows'), settings.shadows, [[0, t('set.off')], [1024, t('set.low')], [2048, t('set.medium')], [4096, t('set.high')]], (v) => { settings.shadows = v; manual(); }),
        choice(t('set.ao'), settings.ao, [['off', t('set.off')], ['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')]], (v) => { settings.ao = v; manual(); }),
        button('Ustaw wszystko na Ultra', () => { Object.assign(settings, { shadows: 4096, ao: 'high', grass: 1.35, scale: 2, soft: true }); manual(); showSettings(); }, 'menu-btn set-ultra'),
        choice('Trawa', settings.grass, [[0, t('set.off')], [0.6, 'Bliżej kamery'], [1, 'Pełna'], [1.35, 'Daleko (Ultra)']], (v) => { settings.grass = v; manual(); }),
        check('Dynamiczna rozdzielczość (mniejszy obraz, gdy karta nie wyrabia; może mignąć przy zmianie)', settings.dynRes ?? false, (v) => { settings.dynRes = v; save(); }),
        check('Miękkie cienie (po ponownym uruchomieniu gry)', settings.soft ?? false, (v) => { settings.soft = v; manual(); }),
        choice(t('set.scale'), settings.scale, [[0.75, t('set.scaleLow')], [1, t('set.scaleNormal')], [2, t('set.scaleSharp')]], (v) => { settings.scale = v; manual(); }),
        check(t('set.dayNight'), settings.dayNight, (v) => { settings.dayNight = v; save(); }),
        choice('Limit klatek', settings.fpsLimit ?? 0, [[30, '30'], [60, '60'], [0, 'Bez limitu']], (v) => { settings.fpsLimit = v; save(); }),
        slider('Jasność', (settings.brightness ?? 1) * 100, (v) => { settings.brightness = v / 100; save(); }, 60, 200),
        check('Deszcz', settings.rain ?? true, (v) => { settings.rain = v; save(); }),
        check('Mgła', settings.fog ?? true, (v) => { settings.fog = v; save(); }),
        el('p', 'hint', t('set.graphicsHint')),
      ]],
      ['Interfejs', () => [
        choice('Wielkość interfejsu', settings.uiSize ?? 1, [[0.5, '50%'], [0.75, '75%'], [0.85, '85%'], [1, '100%'], [1.15, '115%'], [1.3, '130%'], [1.5, '150%']], (v) => { settings.uiSize = v; save(); }),
        choice('Paski zdrowia', settings.hpBars ?? 'combat', [['always', 'Zawsze'], ['combat', 'W walce'], ['selected', 'Zaznaczeni'], ['never', 'Nigdy']], (v) => { settings.hpBars = v; save(); }),
        check('Licznik FPS w rogu ekranu', settings.showFps ?? false, (v) => { settings.showFps = v; save(); }),
        check('Dymki z tym, co mówią ludzie', settings.bubbles ?? true, (v) => { settings.bubbles = v; save(); }),
        choice('Podpowiedzi po najechaniu', settings.tips ?? 'now', [['now', 'Od razu'], ['delay', 'Z opóźnieniem'], ['off', 'Wcale']], (v) => { settings.tips = v; save(); }),
        el('p', 'hint', '„W walce” — paski tylko nad rannymi i zaznaczonymi. Pełne statystyki wydajności zawsze pod klawiszem F3.'),
        el('p', 'hint', 'Powiększa albo pomniejsza całe menu, paski, okna budynków i wojska. 100% to wielkość dobrana do ekranu; na dużym monitorze daj więcej, na małym laptopie mniej. Zmiana działa od razu.'),
      ]],
      ['Rozgrywka', () => [
        choice('Tempo gry na starcie', settings.startSpeed ?? 1, [[0, 'Pauza'], [1, '1×'], [2, '2×'], [3, '3×']], (v) => { settings.startSpeed = v; save(); }),
        check('Pytaj przed rozbiórką budynku', settings.confirmDemolish ?? true, (v) => { settings.confirmDemolish = v; save(); }),
        el('p', 'hint', 'Tempo na starcie działa od następnej gry (w grze przez sieć tempo jest zawsze 1×).'),
      ]],
      [t('set.controls'), () => [
        slider(t('set.camSpeed'), settings.camSpeed * 100, (v) => { settings.camSpeed = v / 100; save(); }, 50, 200),
        check(t('set.edge'), settings.edgeScroll, (v) => { settings.edgeScroll = v; save(); }),
        el('p', 'hint', t('set.controlsHint')),
      ]],
      ['Dla twórców', () => {
        // stałe odnośniki do narzędzi: podgląd modeli i pusta scena testowa (otwierają się w nowej karcie)
        const link = (label: string, href: string, hint: string): HTMLElement => {
          const box = el('div', 'set-row');
          const a = document.createElement('a');
          a.className = 'menu-btn menu-link'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
          box.append(a, el('p', 'hint', hint));
          return box;
        };
        return [
          link('Podgląd modeli', 'modele.html', 'Każdy model gry osobno, na podstawce, w pełnej jakości: obracasz go myszą z każdej strony.'),
          link('Pusta scena testowa', '?test=1&pusta=1', 'Płaska łąka z samą twierdzą, bez zapisu gry — do sprawdzania jednej rzeczy w grze.'),
        ];
      }],
    ], true);
    // zmiany zapisują się od razu; „Zapisz” potwierdza i wraca do menu
    const reset = button(t('set.reset'), () => { Object.assign(settings, DEFAULT_SETTINGS); save(); showSettings(); }, 'menu-btn menu-reset');
    const ok = button('Zapisz', () => { save(); showMain(); }, 'menu-btn menu-save');
    const foot = el('div', 'menu-foot set-foot');
    foot.append(back(), reset, ok);
    screen(t('menu.settings'), true, tabs, foot);
  }

  /** Zakładka z modelami: lista po lewej, obracający się model i opis po prawej */
  function galleryPane(entries: GalleryEntry[]): HTMLElement {
    const box = el('div', 'gallery');
    const list = el('div', 'gallery-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Postacie');
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

  function showHelp(): void {
    const block = (b: HelpBlock): Node => {
      if (typeof b === 'string') return el('p', 'help-p', b);
      if ('h' in b) return el('h3', 'help-h', b.h);
      if ('tip' in b) return el('p', 'help-tip', b.tip);
      const table = el('table', 'help-table');
      b.table.forEach((row, i) => {
        const tr = el('tr');
        for (const cell of row) tr.append(el(i === 0 ? 'th' : 'td', '', cell));
        table.append(tr);
      });
      return table;
    };
    const tabs = tabbed([
      ...HELP_CHAPTERS.map((c): [string, () => Node[]] => [c.title, () => { const box = el('div', 'help-text'); box.append(...c.blocks.map(block)); return [box]; }]),
      ['Postacie i zwierzęta', () => [galleryPane(GALLERY.people)]], ['Budynki', () => [galleryPane(GALLERY.buildings)]],
    ], true);
    const foot = el('div', 'menu-foot');
    foot.append(back());
    screen(t('menu.howTo'), true, tabs, foot);
  }

  return {
    open(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); },
    account(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); if (netMe()) online.showAccount(); else online.showLogin(false); },
    join(id) { inGame = false; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    close() { if (wrap.classList.contains('previewing')) { wrap.classList.remove('previewing'); events.onPreviewEnd(); } wrap.hidden = true; document.body.classList.remove('menu-open'); },
    isOpen: () => !wrap.hidden,
    setVolume(v) { volume = v; },
    setMuted(m) { muted = m; },
    setCanContinue(on) { canContinue = on; if (!wrap.hidden && panel.hidden) paintBar(); },
  };
}

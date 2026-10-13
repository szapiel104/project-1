import { me as netMe, onAccount, restore } from '../net/supa';
import { createOnline, type OnlineStart } from './online';
import { avatarSvg } from './avatars';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { t } from '../i18n';

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
}

export const DEFAULT_SETTINGS: Settings = { ao: 'medium', shadows: 4096, scale: 2, dayNight: true, camSpeed: 1, edgeScroll: true, sfx: 1, ui: 0.8, amb: 0.6, music: 0.45 };

export interface MenuEvents {
  onContinue(): void;
  onNewGame(seedText: string, preset: MapPresetId, level: number, dev: boolean): void;
  onVolume(v: number): void;
  onMute(): boolean;
  onSettings(s: Settings): void;
  /** Gracz się poddaje (mecz kończy się porażką) */
  onSurrender(): void;
  /** Czy to mecz przez sieć (inny opis poddania) */
  isOnline(): boolean;
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

const SETTINGS_KEY = 'project1.settings';

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> & { ao?: unknown };
    // starsze zapisy trzymały cieniowanie jako tak/nie
    if (typeof raw.ao === 'boolean') raw.ao = raw.ao ? 'medium' : 'off';
    return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];

/** Rozdziały „Jak grać”: tytuł i akapity (klucze tłumaczeń) */
const HELP: [string, string[]][] = [
  ['help.t.start', ['help.start1', 'help.start2', 'help.start3']],
  ['help.t.economy', ['help.eco1', 'help.eco2', 'help.eco3', 'help.eco4']],
  ['help.t.food', ['help.food1', 'help.food2', 'help.food3']],
  ['help.t.people', ['help.pop1', 'help.pop2', 'help.pop3', 'help.pop4']],
  ['help.t.build', ['help.bld1', 'help.bld2', 'help.bld3', 'help.bld4']],
  ['help.t.controls', ['help.move', 'help.select', 'help.rotate', 'help.zoom', 'help.build', 'help.speed', 'help.sound', 'help.menu']],
];

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
  const panel = el('div', 'panel menu-panel');
  const title = el('p', 'menu-title', 'Project‑1');
  const sub = el('p', 'menu-sub', t('menu.subtitle'));
  const body = el('div', 'menu-body');
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
  panel.append(crest, title, sub, body);
  wrap.append(panel);
  root.append(wrap);

  let inGame = false;
  let canContinue = false;
  let volume = 0.6;
  let muted = false;
  const settings = loadSettings();
  const save = (): void => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* nic */ } events.onSettings(settings); };

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
    body.replaceChildren(el('p', 'menu-heading', heading), ...nodes);
    body.querySelector<HTMLElement>('button, input, select')?.focus();
  };
  /** Zakładki: lista przycisków po lewej, wybrana treść po prawej */
  const tabbed = (tabs: [string, () => Node[]][]): HTMLElement => {
    const box = el('div', 'menu-tabs');
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
  panel.prepend(account);
  paintAccount();

  function showMain(): void {
    online.leave();
    panel.classList.remove('wide');
    const list = el('div', 'menu-list');
    if (inGame) list.append(button(t('menu.resume'), () => events.onContinue()));
    else if (canContinue) list.append(button(t('menu.continue'), () => events.onContinue()));
    if (inGame) list.append(button('Poddaj się', showSurrender, 'menu-btn menu-back'));
    list.append(button(t('menu.newGame'), showNew), button('Gra przez sieć', () => online.showOnline()), button(t('menu.settings'), showSettings), button(t('menu.howTo'), showHelp));
    body.replaceChildren(list);
    list.querySelector('button')?.focus();
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
      modeRow.append(tile('mode', id === preset, `${a} na ${b}`, `${t(`menu.mode.${id}`)} · mapa ${p.width}×${p.height}`, () => { preset = id; }, `mode-${id}`));
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
    row.append(seed, button(t('hud.newMap'), roll, 'btn-plain'));
    seedWrap.append(seedLabel, row);

    // tryb dla dewelopera: przełącznik w jednej linii
    let dev = false;
    const devLab = el('label', 'dev-switch');
    const devBox = el('input');
    devBox.type = 'checkbox'; devBox.setAttribute('role', 'switch');
    devBox.addEventListener('change', () => { dev = devBox.checked; });
    devLab.append(devBox, el('span', 'dev-knob'), el('span', 'dev-text', 'Tryb deweloperski'), el('span', 'dev-hint', 'miasto w murach, wojsko, pełne zapasy, budowa od razu'));

    const warn = el('p', 'hint', canContinue || inGame ? t('menu.overwrite') : '');
    const start = el('button', 'menu-btn', t('menu.start'));
    start.type = 'submit';
    const foot = el('div', 'newgame-foot');
    foot.append(back(), start);
    form.append(section(t('hud.mode'), modeRow), section(t('menu.level'), levelRow), seedWrap, devLab, warn, foot);
    form.addEventListener('submit', (e) => { e.preventDefault(); events.onNewGame(seed.value.trim() || 'project-1', preset, level, dev); });
    screen(t('menu.newGame'), true, form);
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
    row.append(lab, input, out);
    return row;
  };
  /** Lista wyboru z opisem */
  const choice = <T extends string | number>(label: string, value: T, options: [T, string][], onChange: (v: T) => void): HTMLElement => {
    const row = el('div', 'set-row');
    const lab = el('label', 'set-name', label);
    const id = `set-${label.replace(/\W+/g, '-')}`;
    lab.htmlFor = id;
    const sel = el('select');
    sel.id = id;
    for (const [v, name] of options) sel.append(new Option(name, String(v)));
    sel.value = String(value);
    sel.addEventListener('change', () => { const found = options.find(([v]) => String(v) === sel.value); if (found) onChange(found[0]); });
    row.append(lab, sel);
    return row;
  };
  const check = (label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement => {
    const lab = el('label', 'menu-check');
    const box = el('input');
    box.type = 'checkbox'; box.checked = value;
    box.addEventListener('change', () => onChange(box.checked));
    lab.append(box, el('span', '', label));
    return lab;
  };

  function showSettings(): void {
    const tabs = tabbed([
      [t('menu.sound'), () => {
        const mute = button(t(muted ? 'hud.unmute' : 'hud.mute'), () => { muted = events.onMute(); mute.textContent = t(muted ? 'hud.unmute' : 'hud.mute'); mute.setAttribute('aria-pressed', String(muted)); }, 'btn-plain');
        mute.setAttribute('aria-pressed', String(muted));
        return [
          slider(t('set.master'), volume * 100, (v) => { volume = v / 100; events.onVolume(volume); }),
          slider(t('set.sfx'), settings.sfx * 100, (v) => { settings.sfx = v / 100; save(); }),
          slider(t('set.ui'), settings.ui * 100, (v) => { settings.ui = v / 100; save(); }),
          slider(t('set.amb'), settings.amb * 100, (v) => { settings.amb = v / 100; save(); }),
          slider('Muzyka', (settings.music ?? 0.45) * 100, (v) => { settings.music = v / 100; save(); }),
          mute,
        ];
      }],
      [t('menu.graphics'), () => [
        choice(t('set.shadows'), settings.shadows, [[0, t('set.off')], [1024, t('set.low')], [2048, t('set.medium')], [4096, t('set.high')]], (v) => { settings.shadows = v; save(); }),
        choice(t('set.ao'), settings.ao, [['off', t('set.off')], ['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')]], (v) => { settings.ao = v; save(); }),
        choice(t('set.scale'), settings.scale, [[0.75, t('set.scaleLow')], [1, t('set.scaleNormal')], [2, t('set.scaleSharp')]], (v) => { settings.scale = v; save(); }),
        check(t('set.dayNight'), settings.dayNight, (v) => { settings.dayNight = v; save(); }),
        el('p', 'hint', t('set.graphicsHint')),
      ]],
      [t('set.controls'), () => [
        slider(t('set.camSpeed'), settings.camSpeed * 100, (v) => { settings.camSpeed = v / 100; save(); }, 50, 200),
        check(t('set.edge'), settings.edgeScroll, (v) => { settings.edgeScroll = v; save(); }),
        el('p', 'hint', t('set.controlsHint')),
      ]],
    ]);
    const reset = button(t('set.reset'), () => { Object.assign(settings, DEFAULT_SETTINGS); save(); showSettings(); }, 'btn-plain');
    const foot = el('div', 'menu-foot');
    foot.append(reset, back());
    screen(t('menu.settings'), true, tabs, foot);
  }

  function showHelp(): void {
    const tabs = tabbed(HELP.map(([name, lines]) => [t(name), () => {
      const list = el('ul', 'help-list');
      for (const k of lines) list.append(el('li', '', t(k)));
      return [list];
    }]));
    const foot = el('div', 'menu-foot');
    foot.append(back());
    screen(t('menu.howTo'), true, tabs, foot);
  }

  return {
    open(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); },
    account(game) { inGame = game; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); if (netMe()) online.showAccount(); else online.showLogin(false); },
    join(id) { inGame = false; wrap.hidden = false; document.body.classList.add('menu-open'); showMain(); online.join(id); },
    close() { wrap.hidden = true; document.body.classList.remove('menu-open'); },
    isOpen: () => !wrap.hidden,
    setVolume(v) { volume = v; },
    setMuted(m) { muted = m; },
    setCanContinue(on) { canContinue = on; },
  };
}

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
}

export const DEFAULT_SETTINGS: Settings = { ao: 'medium', shadows: 4096, scale: 2, dayNight: true, camSpeed: 1, edgeScroll: true, sfx: 1, ui: 0.8, amb: 0.6 };

export interface MenuEvents {
  onContinue(): void;
  onNewGame(seedText: string, preset: MapPresetId, level: number, dev: boolean): void;
  onVolume(v: number): void;
  onMute(): boolean;
  onSettings(s: Settings): void;
}

export interface Menu {
  open(inGame: boolean): void;
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
  panel.append(title, sub, body);
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

  function showMain(): void {
    panel.classList.remove('wide');
    const list = el('div', 'menu-list');
    if (inGame) list.append(button(t('menu.resume'), () => events.onContinue()));
    else if (canContinue) list.append(button(t('menu.continue'), () => events.onContinue()));
    list.append(button(t('menu.newGame'), showNew), button(t('menu.settings'), showSettings), button(t('menu.howTo'), showHelp));
    body.replaceChildren(list);
    list.querySelector('button')?.focus();
  }

  function showNew(): void {
    const form = el('form', 'menu-form');
    const modes = el('fieldset', 'menu-modes');
    modes.append(el('legend', '', t('hud.mode')));
    let preset: MapPresetId = '1v1';
    for (const id of Object.keys(MAP_PRESETS) as MapPresetId[]) {
      const lab = el('label', 'menu-mode');
      const radio = el('input');
      radio.type = 'radio'; radio.name = 'mode'; radio.value = id; radio.checked = id === preset;
      radio.addEventListener('change', () => { preset = id; });
      const p = MAP_PRESETS[id];
      lab.append(radio, el('strong', '', id), el('span', '', `${t(`menu.mode.${id}`)} · ${p.width} × ${p.height}`));
      modes.append(lab);
    }
    // poziom trudności: domyślnie łatwy
    let level = 1;
    const levels = el('fieldset', 'menu-modes');
    levels.append(el('legend', '', t('menu.level')));
    for (const lv of [0, 1, 2, 3]) {
      const lab = el('label', 'menu-mode menu-level');
      const radio = el('input');
      radio.type = 'radio'; radio.name = 'level'; radio.checked = lv === level;
      radio.addEventListener('change', () => { level = lv; });
      lab.append(radio, el('span', '', t(`level.${lv}`)));
      levels.append(lab);
    }
    // tryb dla dewelopera: wszystkie budynki gotowe, pełne zapasy, budowa bez czekania
    let dev = false;
    const devLab = el('label', 'menu-mode menu-dev');
    const devBox = el('input');
    devBox.type = 'checkbox';
    devBox.addEventListener('change', () => { dev = devBox.checked; });
    devLab.append(devBox, el('span', '', 'Tryb deweloperski — wszystko zbudowane, pełne zapasy, budowa od razu'));
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
    const warn = el('p', 'hint', canContinue || inGame ? t('menu.overwrite') : '');
    const start = el('button', 'menu-btn', t('menu.start'));
    start.type = 'submit';
    form.append(modes, levels, devLab, seedWrap, warn, start);
    form.addEventListener('submit', (e) => { e.preventDefault(); events.onNewGame(seed.value.trim() || 'project-1', preset, level, dev); });
    screen(t('menu.newGame'), false, form, back());
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
    close() { wrap.hidden = true; document.body.classList.remove('menu-open'); },
    isOpen: () => !wrap.hidden,
    setVolume(v) { volume = v; },
    setMuted(m) { muted = m; },
    setCanContinue(on) { canContinue = on; },
  };
}

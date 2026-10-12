import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { t } from '../i18n';

/** Ustawienia zapamiętywane w przeglądarce */
export interface Settings { ao: boolean; shadows: number }

export interface MenuEvents {
  onContinue(): void;
  onNewGame(seedText: string, preset: MapPresetId): void;
  onVolume(v: number): void;
  onMute(): boolean;
  onGraphics(s: Settings): void;
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
  const def: Settings = { ao: true, shadows: 4096 };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return def; }
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
 * Ekrany: główny, nowa gra, ustawienia, jak grać. To samo menu otwiera się w trakcie gry klawiszem Esc.
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

  const button = (text: string, onClick: () => void, cls = 'menu-btn'): HTMLButtonElement => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const back = (): HTMLButtonElement => button(t('menu.back'), showMain, 'menu-btn menu-back');
  const screen = (heading: string, ...nodes: Node[]): void => {
    body.replaceChildren(el('p', 'menu-heading', heading), ...nodes);
    body.querySelector<HTMLElement>('button, input, select')?.focus();
  };

  function showMain(): void {
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
    form.append(modes, seedWrap, warn, start);
    form.addEventListener('submit', (e) => { e.preventDefault(); events.onNewGame(seed.value.trim() || 'project-1', preset); });
    screen(t('menu.newGame'), form, back());
  }

  function showSettings(): void {
    const box = el('div', 'menu-form');
    // dźwięk
    const vWrap = el('div', 'field');
    const vLab = el('label', '', t('hud.volume'));
    vLab.htmlFor = 'menu-volume';
    const vol = el('input');
    vol.id = 'menu-volume'; vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '5'; vol.value = String(Math.round(volume * 100));
    vol.addEventListener('input', () => { volume = Number(vol.value) / 100; events.onVolume(volume); });
    const mute = button(t(muted ? 'hud.unmute' : 'hud.mute'), () => { muted = events.onMute(); mute.textContent = t(muted ? 'hud.unmute' : 'hud.mute'); mute.setAttribute('aria-pressed', String(muted)); }, 'btn-plain');
    mute.setAttribute('aria-pressed', String(muted));
    vWrap.append(vLab, vol, mute);
    // grafika
    const save = (): void => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* nic */ } events.onGraphics(settings); };
    const aoWrap = el('label', 'menu-check');
    const ao = el('input');
    ao.type = 'checkbox'; ao.checked = settings.ao;
    ao.addEventListener('change', () => { settings.ao = ao.checked; save(); });
    aoWrap.append(ao, el('span', '', t('menu.ao')));
    const shWrap = el('div', 'field');
    const shLab = el('label', '', t('menu.shadows'));
    shLab.htmlFor = 'menu-shadows';
    const sh = el('select');
    sh.id = 'menu-shadows';
    for (const [v, name] of [[2048, t('menu.medium')], [4096, t('menu.high')]] as const) sh.append(new Option(name, String(v)));
    sh.value = String(settings.shadows);
    sh.addEventListener('change', () => { settings.shadows = Number(sh.value); save(); });
    shWrap.append(shLab, sh);
    box.append(el('p', 'label', t('menu.sound')), vWrap, el('p', 'label', t('menu.graphics')), aoWrap, shWrap);
    screen(t('menu.settings'), box, back());
  }

  function showHelp(): void {
    const list = el('ul', 'help-list');
    for (const k of ['help.move', 'help.rotate', 'help.zoom', 'help.build', 'help.speed', 'help.sound', 'help.menu', 'help.economy', 'help.food', 'help.people']) list.append(el('li', '', t(k)));
    screen(t('menu.howTo'), list, back());
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

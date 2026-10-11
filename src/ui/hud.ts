import { t } from '../i18n';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';

export interface HudEvents {
  onGenerate(seedText: string, preset: MapPresetId): void;
  onRandom(preset: MapPresetId): void;
}

export interface Hud {
  setSeed(text: string): void;
  setHash(hash: number): void;
  setTile(text: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Interfejs etapu 1: wybór ziarna i trybu, pomoc, podgląd skrótu stanu. */
export function createHud(root: HTMLElement, events: HudEvents): Hud {
  const top = el('form', 'panel top');
  top.append(el('p', 'brand', t('app.title')), el('p', 'stage', t('app.subtitle')));

  const row = el('div', 'row');
  const seedWrap = el('div');
  const seedLabel = el('label', '', t('hud.seed'));
  seedLabel.htmlFor = 'seed';
  const seed = el('input');
  seed.id = 'seed'; seed.autocomplete = 'off'; seed.maxLength = 24; seed.spellcheck = false;
  seedWrap.append(seedLabel, seed);

  const modeWrap = el('div');
  const modeLabel = el('label', '', t('hud.mode'));
  modeLabel.htmlFor = 'mode';
  const mode = el('select');
  mode.id = 'mode';
  for (const id of Object.keys(MAP_PRESETS)) mode.append(new Option(id, id));
  modeWrap.append(modeLabel, mode);
  row.append(seedWrap, modeWrap);

  const actions = el('div', 'actions');
  const gen = el('button', 'btn-main', t('hud.generate'));
  gen.type = 'submit';
  const rnd = el('button', 'btn-plain', t('hud.newMap'));
  rnd.type = 'button';
  actions.append(gen, rnd);
  top.append(row, actions);

  const preset = (): MapPresetId => mode.value as MapPresetId;
  top.addEventListener('submit', (e) => { e.preventDefault(); events.onGenerate(seed.value.trim(), preset()); });
  rnd.addEventListener('click', () => events.onRandom(preset()));
  mode.addEventListener('change', () => events.onGenerate(seed.value.trim(), preset()));

  const help = el('div', 'panel help');
  const toggle = el('button', '', t('hud.help'));
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'help-list');
  const list = el('ul');
  list.id = 'help-list';
  list.hidden = true;
  for (const k of ['help.move', 'help.rotate', 'help.zoom'] as const) list.append(el('li', '', t(k)));
  toggle.addEventListener('click', () => {
    list.hidden = !list.hidden;
    toggle.setAttribute('aria-expanded', String(!list.hidden));
  });
  help.append(toggle, list);

  const status = el('div', 'panel status');
  status.setAttribute('aria-live', 'off');
  const hashLine = el('div');
  const tileLine = el('div');
  status.append(hashLine, tileLine);
  if (matchMedia('(pointer: coarse)').matches) status.classList.add('hidden-touch');

  root.append(top, help, status);

  return {
    setSeed(text) { seed.value = text; },
    setHash(hash) {
      hashLine.replaceChildren(el('b', '', `${t('hud.hash')}: `), hash.toString(16).padStart(8, '0'));
    },
    setTile(text) {
      tileLine.replaceChildren(el('b', '', `${t('hud.tile')}: `), text || '–');
    },
  };
}

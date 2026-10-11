import { BUILDINGS, type BuildingDef } from '../data/buildings';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { RESOURCES, RESOURCE_DEFS, type ResourceId } from '../data/resources';
import { RULES } from '../data/rules';
import { t } from '../i18n';

export interface HudEvents {
  onNewGame(seedText: string, preset: MapPresetId): void;
  onRandom(preset: MapPresetId): void;
  onPickBuilding(id: string | null): void;
  onRations(level: number): void;
  onTax(level: number): void;
  onSpeed(speed: number): void;
  onDemolish(id: number): void;
  onCloseInfo(): void;
}

export interface HudView {
  res: ArrayLike<number>;
  pop: number;
  housing: number;
  popularity: number;
  delta: number;
  fed: boolean;
  bribed: boolean;
  rations: number;
  tax: number;
  affordable: Set<string>;
}

export interface BuildingInfo { id: number; def: BuildingDef; hasWorker: boolean; own: boolean }

export interface Hud {
  setSeed(text: string, preset: MapPresetId): void;
  setHash(hash: number): void;
  update(v: HudView): void;
  setPicked(id: string | null): void;
  showInfo(info: BuildingInfo | null): void;
  toast(text: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function costText(def: BuildingDef): string {
  const parts = Object.entries(def.cost).map(([k, v]) => `${t(RESOURCE_DEFS[k as ResourceId].name)}: ${v}`);
  return parts.length ? parts.join(' · ') : t('hud.free');
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createHud(root: HTMLElement, events: HudEvents): Hud {
  root.replaceChildren();

  // ---- pasek zasobów ----
  const bar = el('div', 'panel bar');
  const resList = el('ul', 'res');
  resList.setAttribute('aria-label', 'Zasoby');
  const resVals: HTMLElement[] = [];
  for (const id of RESOURCES) {
    const li = el('li');
    const sw = el('span', 'swatch');
    sw.style.background = hex(RESOURCE_DEFS[id].color);
    const val = el('strong', '', '0');
    li.append(sw, el('span', 'name', t(RESOURCE_DEFS[id].name)), val);
    resVals.push(val);
    resList.append(li);
  }
  const people = el('div', 'people');
  const popVal = el('strong');
  const popularVal = el('strong');
  const deltaVal = el('span', 'delta');
  const popBox = el('div');
  popBox.append(el('span', 'name', t('hud.population')), popVal);
  const popularBox = el('div');
  popularBox.append(el('span', 'name', t('hud.popularity')), popularVal, deltaVal);
  people.append(popBox, popularBox);
  bar.append(resList, people);

  // ---- komunikaty ----
  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  let toastTimer = 0;

  // ---- panel wybranego budynku ----
  const info = el('div', 'panel info');
  info.hidden = true;
  const infoName = el('p', 'info-name');
  const infoDesc = el('p');
  const infoWorker = el('p');
  const infoActions = el('div', 'actions');
  const demolish = el('button', 'btn-main', t('hud.demolish'));
  demolish.type = 'button';
  const close = el('button', 'btn-plain', t('hud.close'));
  close.type = 'button';
  infoActions.append(demolish, close);
  info.append(infoName, infoDesc, infoWorker, infoActions);
  let infoId = 0;
  demolish.addEventListener('click', () => events.onDemolish(infoId));
  close.addEventListener('click', () => events.onCloseInfo());

  // ---- dolny dok z zakładkami ----
  const dock = el('div', 'dock');
  const drawer = el('div', 'panel drawer');
  drawer.hidden = true;
  const tabs = el('div', 'tabs');
  const sections: { button: HTMLButtonElement; body: HTMLElement }[] = [];
  const open = (index: number): void => {
    sections.forEach((s, i) => {
      const on = i === index;
      s.body.hidden = !on;
      s.button.setAttribute('aria-expanded', String(on));
    });
    drawer.hidden = index < 0;
  };
  const section = (title: string, id: string): HTMLElement => {
    const body = el('div', 'section');
    body.id = `sec-${id}`;
    body.hidden = true;
    const button = el('button', 'tab', title);
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', body.id);
    const index = sections.length;
    button.addEventListener('click', () => open(button.getAttribute('aria-expanded') === 'true' ? -1 : index));
    sections.push({ button, body });
    tabs.append(button);
    drawer.append(body);
    return body;
  };

  // Budowa
  const build = section(t('hud.build'), 'build');
  const buildGrid = el('div', 'build-grid');
  const buildButtons = new Map<string, HTMLButtonElement>();
  let picked: string | null = null;
  for (const def of BUILDINGS) {
    if (!def.buildable) continue;
    const b = el('button', 'build-btn');
    b.type = 'button';
    b.title = t(`d.${def.id}`);
    b.setAttribute('aria-pressed', 'false');
    b.append(el('span', 'build-name', t(def.name)), el('span', 'build-cost', costText(def)));
    b.addEventListener('click', () => events.onPickBuilding(picked === def.id ? null : def.id));
    buildButtons.set(def.id, b);
    buildGrid.append(b);
  }
  const buildHint = el('p', 'hint');
  const cancel = el('button', 'btn-plain', t('hud.cancel'));
  cancel.type = 'button';
  cancel.hidden = true;
  cancel.addEventListener('click', () => events.onPickBuilding(null));
  build.append(buildGrid, buildHint, cancel);

  // Dwór
  const court = section(t('hud.court'), 'court');
  const mkSelect = (id: string, label: string, options: readonly { name: string }[], onChange: (n: number) => void): HTMLSelectElement => {
    const wrap = el('div', 'field');
    const lab = el('label', '', label);
    lab.htmlFor = id;
    const sel = el('select');
    sel.id = id;
    options.forEach((o, i) => sel.append(new Option(t(o.name), String(i))));
    sel.addEventListener('change', () => onChange(Number(sel.value)));
    wrap.append(lab, sel);
    court.append(wrap);
    return sel;
  };
  const rationSel = mkSelect('rations', t('hud.rations'), RULES.rations, events.onRations);
  const taxSel = mkSelect('tax', t('hud.tax'), RULES.taxes, events.onTax);
  const forecast = el('p', 'hint');
  const speedWrap = el('div', 'field');
  speedWrap.append(el('span', 'label', t('hud.speed')));
  const speedRow = el('div', 'speed');
  const speedButtons: HTMLButtonElement[] = [];
  for (const [label, value] of [[t('hud.pause'), 0], ['1×', 1], ['3×', 3]] as const) {
    const b = el('button', 'btn-plain', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(value === 1));
    b.addEventListener('click', () => {
      speedButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      events.onSpeed(value);
    });
    speedButtons.push(b);
    speedRow.append(b);
  }
  speedWrap.append(speedRow);
  court.append(forecast, speedWrap);

  // Mapa
  const mapSec = section(t('hud.map'), 'map');
  const form = el('form', 'map-form');
  const seedWrap = el('div', 'field');
  const seedLabel = el('label', '', t('hud.seed'));
  seedLabel.htmlFor = 'seed';
  const seed = el('input');
  seed.id = 'seed'; seed.autocomplete = 'off'; seed.maxLength = 24; seed.spellcheck = false;
  seedWrap.append(seedLabel, seed);
  const modeWrap = el('div', 'field');
  const modeLabel = el('label', '', t('hud.mode'));
  modeLabel.htmlFor = 'mode';
  const mode = el('select');
  mode.id = 'mode';
  for (const id of Object.keys(MAP_PRESETS)) mode.append(new Option(id, id));
  modeWrap.append(modeLabel, mode);
  const formActions = el('div', 'actions');
  const gen = el('button', 'btn-main', t('hud.generate'));
  gen.type = 'submit';
  const rnd = el('button', 'btn-plain', t('hud.newMap'));
  rnd.type = 'button';
  formActions.append(gen, rnd);
  const hashLine = el('p', 'hint');
  form.append(seedWrap, modeWrap, formActions, hashLine);
  const preset = (): MapPresetId => mode.value as MapPresetId;
  form.addEventListener('submit', (e) => { e.preventDefault(); events.onNewGame(seed.value.trim(), preset()); });
  rnd.addEventListener('click', () => events.onRandom(preset()));
  mapSec.append(form);

  // Sterowanie
  const help = section(t('hud.help'), 'help');
  const list = el('ul', 'help-list');
  for (const k of ['help.move', 'help.rotate', 'help.zoom', 'help.build']) list.append(el('li', '', t(k)));
  help.append(list);

  dock.append(drawer, tabs);
  root.append(bar, toast, info, dock);
  if (!matchMedia('(max-width: 640px)').matches) open(0);

  return {
    setSeed(text, presetId) { seed.value = text; mode.value = presetId; },
    setHash(hash) { setText(hashLine, `${t('hud.hash')}: ${hash.toString(16).padStart(8, '0')}`); },
    update(v) {
      resVals.forEach((node, i) => setText(node, String(v.res[i] ?? 0)));
      setText(popVal, `${v.pop} / ${v.housing}`);
      setText(popularVal, String(v.popularity));
      setText(deltaVal, `${v.delta > 0 ? '+' : ''}${v.delta} ${t('hud.perMonth')}`);
      deltaVal.dataset.sign = v.delta < 0 ? 'neg' : 'pos';
      if (document.activeElement !== rationSel) rationSel.value = String(v.rations);
      if (document.activeElement !== taxSel) taxSel.value = String(v.tax);
      const warn = [v.fed ? '' : t('hud.hungry'), v.bribed ? '' : t('hud.noGold')].filter(Boolean).join('. ');
      setText(forecast, `${t('hud.popularity')}: ${v.delta > 0 ? '+' : ''}${v.delta} ${t('hud.perMonth')}${warn ? `. ${warn}.` : ''}`);
      for (const [id, b] of buildButtons) b.classList.toggle('poor', !v.affordable.has(id));
    },
    setPicked(id) {
      picked = id;
      for (const [bid, b] of buildButtons) b.setAttribute('aria-pressed', String(bid === id));
      cancel.hidden = id === null;
      setText(buildHint, id ? t('hud.placing') : '');
      // na telefonie menu zasłania mapę, więc po wyborze budynku chowa się samo
      if (id && matchMedia('(max-width: 640px)').matches) { open(-1); this.toast(t('hud.placing')); }
    },
    showInfo(i) {
      info.hidden = !i;
      if (!i) return;
      infoId = i.id;
      setText(infoName, t(i.def.name));
      setText(infoDesc, t(`d.${i.def.id}`));
      infoWorker.hidden = !i.def.production;
      setText(infoWorker, `${t('hud.worker')}: ${t(i.hasWorker ? 'hud.workerYes' : 'hud.workerNo')}`);
      demolish.hidden = !i.own || !i.def.buildable;
    },
    toast(text) {
      setText(toast, text);
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
    },
  };
}

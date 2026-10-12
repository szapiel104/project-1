import { BUILDINGS, CATEGORIES, type BuildingDef, type CategoryId } from '../data/buildings';
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
  onRotate(): void;
  onWreck(): void;
  onVolume(v: number): void;
  onMute(): void;
}

export interface HudView {
  res: ArrayLike<number>;
  pop: number;
  housing: number;
  popularity: number;
  day: number;
  hour: number;
  night: boolean;
  idle: number;
  idleSlots: number;
  stock: number;
  stockCap: number;
  food: number;
  foodCap: number;
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
  /** Karta mieszkańca: imię i kilka wierszy opisu */
  showPerson(person: { name: string; lines: string[] } | null): void;
  toast(text: string): void;
  /** Zmienia tempo gry o jeden stopień (-1 wolniej, +1 szybciej) */
  stepSpeed(dir: number): void;
  /** Zaznacza, że trwa tryb wyburzania */
  setWreck(on: boolean): void;
  setMuted(muted: boolean): void;
  setVolume(v: number): void;
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

/** Proste ikony surowców (SVG 20x20), rysowane ręcznie w jednym stylu. */
const ICONS: Record<string, string> = {
  wood: '<rect x="2" y="7" width="16" height="6" rx="3" fill="#8a5a2b" stroke="#2a1c10"/><circle cx="16" cy="10" r="2.6" fill="#d9b27a" stroke="#2a1c10"/><path d="M5 9h6M6 11.5h5" stroke="#5e4329"/>',
  stone: '<path d="M3 15l2-7 5-4 6 3 1 8z" fill="#b5b0a2" stroke="#2a1c10"/><path d="M5 8l5 2 6-3M10 10l-1 5" stroke="#6f6a5e" fill="none"/>',
  iron: '<path d="M3 14l2-5h10l2 5z" fill="#6a6570" stroke="#2a1c10"/><path d="M5 9l1-2h8l1 2" fill="#8f8a96" stroke="#2a1c10"/>',
  wheat: '<path d="M10 18V6" stroke="#8a6a1f" stroke-width="1.5"/><path d="M10 4l2.5 2.5L10 9 7.5 6.500zM10 8l3 2.5-3 2.5-3-2.500zM10 12l3 2.5-3 2.5-3-2.500z" fill="#e2bf4a" stroke="#2a1c10" stroke-width=".8"/>',
  flour: '<path d="M6 6c1-2 7-2 8 0l2 9c0 3-12 3-12 0z" fill="#f4eedc" stroke="#2a1c10"/><path d="M7 6c1 1.5 5 1.5 6 0" stroke="#2a1c10" fill="none"/><path d="M8 10h4M8 12.500h4" stroke="#b9ae90"/>',
  bread: '<path d="M2.5 13c0-5 3-7 7.5-7s7.5 2 7.5 7z" fill="#c9843d" stroke="#2a1c10"/><path d="M7 8.500l1.5 2M10.5 8l1.5 2M14 9l1 1.5" stroke="#7a4a1c"/>',
  apples: '<path d="M10 7c-4-2-7 1-6 5 1 4 4 5 6 4 2 1 5 0 6-4 1-4-2-7-6-5z" fill="#d0281f" stroke="#2a1c10"/><path d="M10 7c0-2 1-3 2-4" stroke="#2a1c10" fill="none"/><path d="M12 4c2-1 3 0 3 1-1 1-2 1-3-1z" fill="#5c9a3c" stroke="#2a1c10" stroke-width=".7"/>',
  fish: '<path d="M2 10c3-5 9-5 12 0-3 5-9 5-12 0z" fill="#9cc3d6" stroke="#2a1c10"/><path d="M14 10l4-3v6z" fill="#7aa6bd" stroke="#2a1c10"/><circle cx="5.5" cy="9" r=".9" fill="#2a1c10"/><path d="M8 7.500c1 1.500 1 3.500 0 5" stroke="#4f7f96" fill="none"/>',
  crown: '<path d="M3 15l1-9 4 4 2-6 2 6 4-4 1 9z" fill="#e9c145" stroke="#2a1c10"/><rect x="3" y="15" width="14" height="2.5" fill="#c9a23a" stroke="#2a1c10"/>',
  store: '<rect x="3" y="6" width="14" height="10" fill="#a8743a" stroke="#2a1c10"/><path d="M3 6l2-3h10l2 3M3 11h14M10 6v10" stroke="#2a1c10" fill="none"/>',
  granary: '<path d="M4 9l6-5 6 5v8H4z" fill="#c9a24a" stroke="#2a1c10"/><rect x="8" y="12" width="4" height="5" fill="#5e4329" stroke="#2a1c10"/>',
  pop: '<circle cx="10" cy="6" r="3" fill="#e2bd94" stroke="#2a1c10"/><path d="M4 18c0-5 3-8 6-8s6 3 6 8z" fill="#a8281f" stroke="#2a1c10"/>',
  idle: '<path d="M3 13h14M5 13v4M15 13v4M4 10h12" stroke="#c9a24a" stroke-width="2"/><path d="M12 3h4l-4 4h4" stroke="#f6ecd0" fill="none"/>',
  gold: '<circle cx="10" cy="10" r="7" fill="#e9c145" stroke="#2a1c10"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#9a7a1a"/><path d="M10 7v6M8 8.500h3.500a1.3 1.3 0 010 2.600H8" stroke="#7a5d10" fill="none"/>',
};

function icon(id: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 20 20" width="22" height="22">${ICONS[id] ?? ''}</svg>`;
  return span;
}

const SPEEDS = [0, 1, 2, 3, 5];

export function createHud(root: HTMLElement, events: HudEvents, thumbs: Map<string, string> = new Map()): Hud {
  root.replaceChildren();

  // ---- pasek zasobów ----
  // dolny pas stanu (jak w grach miejskich): zegar i tempo z lewej, surowce w środku, osada i dwór z prawej
  const bar = el('div', 'status');
  const resList = el('ul', 'res');
  resList.setAttribute('aria-label', 'Zasoby');
  const resVals: HTMLElement[] = [];
  for (const id of RESOURCES) {
    const li = el('li');
    const val = el('strong', '', '0');
    li.title = t(RESOURCE_DEFS[id].name);
    li.setAttribute('aria-label', t(RESOURCE_DEFS[id].name));
    li.append(icon(id), val);
    resVals.push(val);
    resList.append(li);
  }
  const people = el('div', 'people');
  const popVal = el('strong');
  const popularVal = el('strong');
  const deltaVal = el('span', 'delta');
  const popBox = el('div');
  popBox.title = t('hud.population');
  popBox.setAttribute('aria-label', t('hud.population'));
  popBox.append(icon('pop'), popVal);
  const popularBox = el('div');
  // pasek popularności ze znacznikiem progu, od którego przybywa ludzi
  const meter = el('span', 'meter');
  meter.setAttribute('aria-hidden', 'true');
  const meterFill = el('span', 'meter-fill');
  meter.append(meterFill, el('span', 'meter-mark'));
  popularBox.classList.add('popular');
  popularBox.title = t('hud.popularity');
  popularBox.append(icon('crown'), meter, popularVal, deltaVal);
  const stockVal = el('strong');
  const stockBox = el('div');
  stockBox.title = t('hud.stockpile');
  stockBox.setAttribute('aria-label', t('hud.stockpile'));
  stockBox.append(icon('store'), stockVal);
  const foodVal = el('strong');
  const foodBox = el('div');
  foodBox.title = t('hud.granary');
  foodBox.setAttribute('aria-label', t('hud.granary'));
  foodBox.append(icon('granary'), foodVal);
  const idleVal = el('strong');
  const idleBox = el('div');
  idleBox.title = t('hud.idle');
  idleBox.setAttribute('aria-label', t('hud.idle'));
  idleBox.append(icon('idle'), idleVal);
  // zegar: dzień gry, godzina i znak pory dnia
  const clockBox = el('div', 'clock');
  // tarcza analogowa: połowa jasna ze słońcem, połowa ciemna z księżycem; obraca się, a wskazówka u góry stoi
  const clockIcon = el('span', 'dial');
  clockIcon.setAttribute('aria-hidden', 'true');
  clockIcon.innerHTML = `<svg viewBox="-24 -24 48 48" width="46" height="46">
    <g class="dial-disc">
      <path d="M-20 0A20 20 0 0 1 20 0Z" fill="#f3d98a"/>
      <path d="M-20 0A20 20 0 0 0 20 0Z" fill="#1f2a50"/>
      <circle cx="0" cy="-11" r="4.5" fill="#f2a51f" stroke="#7a4a0c"/>
      <g stroke="#7a4a0c" stroke-width="1.2"><path d="M0-19v2.500M-7.500-15.500l1.800 1.800M7.500-15.500l-1.800 1.800M-9.500-9h2.500M9.500-9h-2.500"/></g>
      <path d="M3 8a5 5 0 1 1-6.500 6.500A6.500 6.500 0 0 0 3 8Z" fill="#f4f6ff" stroke="#0e1530" stroke-width=".6"/>
      <circle cx="-10" cy="6" r=".9" fill="#f4f6ff"/><circle cx="9" cy="5" r=".9" fill="#f4f6ff"/><circle cx="-5" cy="15" r=".7" fill="#f4f6ff"/><circle cx="11" cy="12" r=".7" fill="#f4f6ff"/>
      <path d="M-20 0h40" stroke="#2a1c10" stroke-width="1"/>
    </g>
    <circle r="21" fill="none" stroke="#2a1c10" stroke-width="2.500"/>
    <circle r="22.500" fill="none" stroke="#9a7a2a" stroke-width="1"/>
    <path d="M0-24l3.500 6h-7z" fill="#8c1f18" stroke="#2a1c10" stroke-width=".8"/>
  </svg>`.replace(/(\d)\.(\d)00/g, '$1.$2');
  const disc = clockIcon.querySelector<SVGGElement>('.dial-disc')!;
  const clockVal = el('strong');
  clockBox.append(clockIcon, clockVal);
  people.append(stockBox, foodBox, popBox, idleBox, popularBox);
  // szybkie sterowanie u góry: tempo gry, podatki i racje, każde z przyciskami minus i plus
  const controls = el('div', 'controls');
  const stepper = (label: string, onStep: (dir: number) => void): HTMLElement => {
    const wrap = el('div', 'stepper');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', label);
    const minus = el('button', 'step', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', `${label}: ${t('hud.less')}`);
    const plus = el('button', 'step', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', `${label}: ${t('hud.more')}`);
    const text = el('span', 'step-text');
    const value = el('strong');
    text.append(el('span', 'name', label), value);
    minus.addEventListener('click', () => onStep(-1));
    plus.addEventListener('click', () => onStep(1));
    wrap.append(minus, text, plus);
    controls.append(wrap);
    return value;
  };
  let speedIndex = 1;
  let rationsNow = 0, taxNow = 0;
  const stepSpeed = (dir: number): void => {
    speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, speedIndex + dir));
    showSpeed();
    events.onSpeed(SPEEDS[speedIndex]!);
  };
  const speedVal = stepper(t('hud.speed'), stepSpeed);
  const showSpeed = (): void => setText(speedVal, SPEEDS[speedIndex] === 0 ? t('hud.pause') : `${SPEEDS[speedIndex]}×`);
  showSpeed();
  const taxVal = stepper(t('hud.tax'), (dir) => {
    const next = Math.max(0, Math.min(RULES.taxes.length - 1, taxNow + dir));
    if (next !== taxNow) events.onTax(next);
  });
  const rationVal = stepper(t('hud.rations'), (dir) => {
    const next = Math.max(0, Math.min(RULES.rations.length - 1, rationsNow + dir));
    if (next !== rationsNow) events.onRations(next);
  });
  // jeden wąski pasek: zegar, surowce jako ikony z liczbą, stan osady, sterowanie
  bar.append(clockBox, resList, people);

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

  // ---- dół ekranu: wysuwane panele, a pod nimi pasek budowy ----
  const bottom = el('div', 'bottom');
  const floaters = el('div', 'floaters');
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

  // Pasek budowy: kategorie i karty budynków z obrazkami
  const buildbar = el('div', 'panel buildbar');
  const cats = el('div', 'cats');
  cats.setAttribute('role', 'group');
  cats.setAttribute('aria-label', t('hud.build'));
  const cards = el('div', 'cards');
  cards.id = 'build-cards';
  const catButtons = new Map<CategoryId, HTMLButtonElement>();
  const buildButtons = new Map<string, HTMLButtonElement>();
  let picked: string | null = null;
  let category: CategoryId | null = null;
  const showCategory = (id: CategoryId | null): void => {
    category = id;
    for (const [cid, b] of catButtons) b.setAttribute('aria-expanded', String(cid === id));
    for (const [bid, b] of buildButtons) b.hidden = BUILDINGS.find((d) => d.id === bid)?.category !== id;
    cards.hidden = id === null;
    syncPicker();
  };
  // panel z kartami wyskakuje nad paskiem narzędzi tylko wtedy, gdy jest co pokazać
  const syncPicker = (): void => { buildbar.hidden = cards.hidden && buildFoot.hidden; };
  const CAT_ICON: Record<string, string> = { settlement: 'house', food: 'farm', industry: 'woodcutter', roads: 'roadStone' };
  for (const id of CATEGORIES) {
    const b = el('button', 'cat');
    const src = thumbs.get(CAT_ICON[id] ?? '');
    if (src) { const img = el('img'); img.src = src; img.alt = ''; img.width = 34; img.height = 34; img.draggable = false; b.append(img); }
    b.append(el('span', 'cat-name', t(`cat.${id}`)));
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', cards.id);
    b.addEventListener('click', () => showCategory(category === id ? null : id));
    catButtons.set(id, b);
    cats.append(b);
  }
  for (const def of BUILDINGS) {
    if (!def.buildable) continue;
    const b = el('button', 'card');
    b.type = 'button';
    b.title = t(`d.${def.id}`);
    b.setAttribute('aria-pressed', 'false');
    const src = thumbs.get(def.id);
    if (src) {
      const img = el('img');
      img.src = src; img.alt = ''; img.width = 72; img.height = 72; img.draggable = false;
      b.append(img);
    }
    const text = el('span', 'card-text');
    text.append(el('span', 'build-name', t(def.name)), el('span', 'build-cost', costText(def)));
    b.append(text);
    b.addEventListener('click', () => events.onPickBuilding(picked === def.id ? null : def.id));
    buildButtons.set(def.id, b);
    cards.append(b);
  }
  const buildFoot = el('div', 'buildfoot');
  const buildHint = el('p', 'hint');
  const cancel = el('button', 'btn-main', t('hud.cancel'));
  cancel.type = 'button';
  cancel.hidden = true;
  cancel.addEventListener('click', () => events.onPickBuilding(null));
  const turn = el('button', 'btn-plain', t('hud.rotate'));
  turn.type = 'button';
  turn.addEventListener('click', () => events.onRotate());
  const footButtons = el('div', 'actions');
  footButtons.append(turn, cancel);
  buildFoot.append(buildHint, footButtons);
  // wyburzanie: osobny tryb, w którym klikanie usuwa budynki, a przeciąganie drogi
  const wreck = el('button', 'btn-main wreck', t('hud.wreck'));
  wreck.type = 'button';
  wreck.setAttribute('aria-pressed', 'false');
  wreck.addEventListener('click', () => events.onWreck());
  const toolbar = el('div', 'toolbar');
  const right = el('div', 'tools-right');
  right.append(controls, wreck);
  toolbar.append(tabs, cats, right);
  buildbar.append(cards, buildFoot);

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
  court.append(forecast);

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
  form.append(seedWrap, modeWrap, formActions, el('p', 'hint', t('hud.saved')), hashLine);
  const preset = (): MapPresetId => mode.value as MapPresetId;
  form.addEventListener('submit', (e) => { e.preventDefault(); events.onNewGame(seed.value.trim(), preset()); });
  rnd.addEventListener('click', () => events.onRandom(preset()));
  mapSec.append(form);

  // Sterowanie i dźwięk
  const help = section(t('hud.help'), 'help');
  const soundWrap = el('div', 'field');
  const volLabel = el('label', '', t('hud.volume'));
  volLabel.htmlFor = 'volume';
  const vol = el('input');
  vol.id = 'volume'; vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '5';
  vol.addEventListener('input', () => events.onVolume(Number(vol.value) / 100));
  const mute = el('button', 'btn-plain', t('hud.mute'));
  mute.type = 'button';
  mute.setAttribute('aria-pressed', 'false');
  mute.addEventListener('click', () => events.onMute());
  soundWrap.append(volLabel, vol, mute);
  help.append(soundWrap);
  const list = el('ul', 'help-list');
  for (const k of ['help.move', 'help.rotate', 'help.zoom', 'help.build', 'help.speed', 'help.sound']) list.append(el('li', '', t(k)));
  help.append(list);

  floaters.append(drawer, info);
  const dock = el('div', 'dock');
  dock.append(toolbar, bar);
  bottom.append(floaters, buildbar, dock);
  root.append(toast, bottom);
  showCategory(null);

  return {
    setSeed(text, presetId) { seed.value = text; mode.value = presetId; },
    setHash(hash) { setText(hashLine, `${t('hud.hash')}: ${hash.toString(16).padStart(8, '0')}`); },
    update(v) {
      resVals.forEach((node, i) => setText(node, String(v.res[i] ?? 0)));
      // godzina co kwadrans, stałej szerokości, żeby pasek nie skakał
      const hh = Math.floor(v.hour), mm = Math.floor(((v.hour - hh) * 60) / 15) * 15;
      setText(clockVal, `${t('hud.day')} ${v.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      // południe na górze o 12:00, północ o 24:00
      disc.setAttribute('transform', `rotate(${((v.hour - 12) / 24) * 360})`);
      setText(popVal, `${v.pop} / ${v.housing}`);
      setText(idleVal, `${v.idle} / ${v.idleSlots}`);
      idleBox.classList.toggle('full', v.idle >= v.idleSlots);
      setText(stockVal, `${v.stock} / ${v.stockCap}`);
      stockBox.classList.toggle('full', v.stock >= v.stockCap);
      setText(foodVal, `${v.food} / ${v.foodCap}`);
      foodBox.classList.toggle('full', v.food >= v.foodCap);
      setText(popularVal, `${v.popularity} / ${RULES.maxPopularity}`);
      meterFill.style.width = `${(v.popularity / RULES.maxPopularity) * 100}%`;
      meterFill.dataset.low = String(v.popularity < RULES.migrationThreshold);
      setText(deltaVal, `${v.delta > 0 ? '+' : ''}${v.delta}`);
      deltaVal.title = `${v.delta > 0 ? '+' : ''}${v.delta} ${t('hud.perMonth')}`;
      deltaVal.dataset.sign = v.delta < 0 ? 'neg' : 'pos';
      rationsNow = v.rations; taxNow = v.tax;
      setText(rationVal, t(RULES.rations[v.rations]?.name ?? ''));
      setText(taxVal, t(RULES.taxes[v.tax]?.name ?? ''));
      if (document.activeElement !== rationSel) rationSel.value = String(v.rations);
      if (document.activeElement !== taxSel) taxSel.value = String(v.tax);
      const warn = [v.fed ? '' : t('hud.hungry'), v.bribed ? '' : t('hud.noGold')].filter(Boolean).join('. ');
      setText(forecast, `${t('hud.popularity')}: ${v.delta > 0 ? '+' : ''}${v.delta} ${t('hud.perMonth')}${warn ? `. ${warn}.` : ''}`);
      for (const [id, b] of buildButtons) b.classList.toggle('poor', !v.affordable.has(id));
      if (wreck.getAttribute('aria-pressed') !== 'true') buildFoot.hidden = picked === null;
      syncPicker();
    },
    setPicked(id) {
      picked = id;
      for (const [bid, b] of buildButtons) b.setAttribute('aria-pressed', String(bid === id));
      cancel.hidden = id === null;
      setText(buildHint, id ? t('hud.placing') : '');
      // na telefonie menu zasłania mapę, więc po wyborze budynku chowa się samo
      buildFoot.hidden = id === null;
      if (id) open(-1);
      syncPicker();
    },
    showPerson(person) {
      info.hidden = !person;
      if (!person) return;
      infoId = 0;
      setText(infoName, person.name);
      setText(infoDesc, person.lines[0] ?? '');
      infoWorker.hidden = person.lines.length < 2;
      infoWorker.textContent = '';
      person.lines.slice(1).forEach((line, k) => { if (k) infoWorker.append(document.createElement('br')); infoWorker.append(line); });
      demolish.hidden = true;
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
    stepSpeed,
    setMuted(m) { mute.setAttribute('aria-pressed', String(m)); setText(mute, t(m ? 'hud.unmute' : 'hud.mute')); },
    setVolume(v) { vol.value = String(Math.round(v * 100)); },
    setWreck(on) {
      wreck.setAttribute('aria-pressed', String(on));
      if (on) { buildFoot.hidden = false; turn.hidden = true; cancel.hidden = true; setText(buildHint, t('hud.wrecking')); }
      else { turn.hidden = false; buildFoot.hidden = picked === null; }
      syncPicker();
    },
    toast(text) {
      setText(toast, text);
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 6000);
    },
  };
}

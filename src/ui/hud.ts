import { me, onAccount } from '../net/supa';
import { avatarSvg } from './avatars';
import { BUILDINGS, CATEGORIES, type BuildingDef, type CategoryId } from '../data/buildings';
import { MAP_PRESETS, type MapPresetId } from '../data/maps';
import { RESOURCES, RESOURCE_DEFS, type ResourceId } from '../data/resources';
import { RULES } from '../data/rules';
import { lang, t, tx } from '../i18n';

export interface HudEvents {
  /** Kliknięto typ jednostki w panelu wojska: zostaw tylko ten typ (Shift: odznacz ten typ) */
  onArmyKind(kind: string, shift: boolean): void;
  /** Formacja: 0 linia, 1 blok, 2 luźno */
  onArmyForm(form: number): void;
  /** Postawa: 0 atak, 1 obrona, 2 stój */
  onArmyStance(stance: number): void;
  /** Marsz: 0 zwykły (nie oglądają się na wroga), 1 z walką (biją każdego po drodze) */
  onArmyMarch(march: number): void;
  /** Patrol (P): włącza albo wyłącza wybieranie punktów obchodu */
  onArmyPatrol(): void;
  /** Portret żołnierza: odznacz go (Shift: zostaw tylko jego) */
  onArmyUnit(id: number, shift: boolean): void;
  /** Miejsce grupy na pasku wojska: klik = wybierz (puste: zapisz zaznaczonych), Shift = zapisz, prawy = wyczyść */
  onGroup(n: number, action: 'pick' | 'save' | 'clear'): void;
  onNewGame(seedText: string, preset: MapPresetId): void;
  onRandom(preset: MapPresetId): void;
  onPickBuilding(id: string | null): void;
  onRations(level: number): void;
  onTax(level: number): void;
  /** false = zmiana tempa niedozwolona (gra przez sieć), pasek wraca do poprzedniej wartości */
  onSpeed(speed: number): boolean | void;
  onDemolish(id: number): void;
  onCloseInfo(): void;
  onRotate(): void;
  onWreck(): void;
  onVolume(v: number): void;
  onMute(): void;
  onMenu(): void;
  /** Klik w herb na dolnym pasku: konto */
  onAccount(): void;
  onTrain(building: number, count: number, unit?: string): void;
  /** Punkt zbiórki koszar: unit = rodzaj (brak = wszyscy); clear = zdejmij flagę, inaczej następny klik na mapie ją stawia */
  onRally(building: number, unit: string | null, clear: boolean): void;
  onGate(building: number, open: boolean): void;
  /** Wyłącza/włącza budynek z pracownikiem */
  onPower(building: number, on: boolean): void;
  onDismount(building: number): void;
  onWalk(): void;
  /** Oko: spacer oczami losowego mieszkańca */
  onRandomWalk(): void;
  /** Pokaż / ukryj teren pracy budynku (zielony kwadrat) */
  onArea(building: number): void;
  /** Kopalnia: wejście do sztolni (spacer w osobnej lokacji) */
  onEnterMine(building: number): void;
  onSelectGarrison(building: number): void;
}

export interface HudView {
  /** Rozpiska popularności (składniki z plusem i minusem) i ludności (kto co robi) */
  report?: { popularity: { label: string; value: number; note?: string }[]; people: { label: string; value: number }[]; army: { label: string; value: number }[]; food: { label: string; value: string; note?: string; sign?: 'plus' | 'minus' }[]; foodHint: string };
  soldiers?: number;
  res: ArrayLike<number>;
  /** Zmiana zapasu każdego surowca w ciągu ostatniej minuty gry */
  trend: ArrayLike<number>;
  pop: number;
  housing: number;
  popularity: number;
  day: number;
  /** Pora roku i temperatura (°C) */
  weather?: { season: string; temp: number };
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
  /** Drzewko budowy: zablokowane karty (id budynku → czego brakuje; `building` = wymagany budynek jest w budowie) */
  locked: Map<string, { need: string; building: boolean }>;
}

/** Zapasy jednego rodzaju składu: ile mieści ten budynek, ile jest razem i co leży (z ikonami) */
export interface StockInfo { kind: string; here: number; used: number; max: number; items: { id: string; amount: number }[] }
export interface BuildingInfo { stock?: StockInfo[]; id: number; def: BuildingDef; hasWorker: boolean; own: boolean; canTrain?: boolean; hp?: number; maxHp?: number; gate?: { open: boolean; shut: boolean }; power?: { on: boolean; worker: boolean }; garrison?: number;
  /** Twierdza: straż miejska (ilu jest, ilu ma być, ile sekund do końca szkolenia rekruta, czy werbunek stoi i dlaczego) */
  watch?: { have: number; want: number; training: number; note?: string; label?: string }; recruit?: RecruitUnit[]; area?: boolean;
  /** Plac budowy: postęp, materiał na placu i w drodze, robotnicy, stan */
  site?: { pct: number; loads: number; delivered: number; carrying: number; fetching: number; builders: number; state: string };
  /** Ilu łuczników mieści wieża / mur */
  garrisonMax?: number;
  /** Warsztat: przepis, pracownik, stan i liczby */
  prod?: ProdInfo }
export interface ProdInfo {
  recipe?: { input?: { id: string; n: number; name: string }; output: { id: string; n: number; name: string }; secs: number; place: string };
  worker?: { name: string; doing: string; pct?: number };
  status: { text: string; level: 'ok' | 'warn' | 'bad' };
  /** Oddane do składu od postawienia, przepadłe przez pełny skład, tempo z ostatniej doby (brak = za krótko liczone) */
  made: number; lost: number; day?: number;
  /** Na stanie: gotowy towar i surowiec (ile pełnych cykli wystarczy) */
  stockOut?: number; stockIn?: number; cycles?: number;
}
export interface RecruitUnit { id: string; name: string; weapon: string; need?: number; have: number; gold: number; idle: number; max: number; cost: number; hp: number; attack: number; range?: number; rally?: boolean }

export interface Hud {
  setSeed(text: string, preset: MapPresetId): void;
  setHash(hash: number): void;
  update(v: HudView): void;
  setPicked(id: string | null): void;
  /** Chowa otwartą listę budynków (Esc); zwraca true, gdy była otwarta */
  closeBuild(): boolean;
  showInfo(info: BuildingInfo | null): void;
  /** Karta mieszkańca: imię i kilka wierszy opisu */
  showPerson(person: { name: string; lines: string[]; walk?: boolean } | null): void;
  /** Zaznaczone wojsko: portret każdego żołnierza z paskiem zdrowia */
  /** Pasek wojska nad dolnym menu: grupy 1–9 i 0 oraz portrety zaznaczonych */
  setArmyBar(v: { show: boolean; groups: { n: number; count: number; kind?: string }[]; active?: number; selected: { id: number; kind: string; hp: number; max: number; name: string }[] }): void;
  showArmy(army: { id?: number; name: string; hp: number; max: number; kind?: string }[], ctl?: { form: number; stance: number; march: number; group?: number; patrol?: number }): void;
  toast(text: string): void;
  /** Zmienia tempo gry o jeden stopień (-1 wolniej, +1 szybciej) */
  stepSpeed(dir: number): void;
  /** Ustawia pokazywane tempo (np. domyślne tempo z ustawień na starcie gry) */
  setSpeed(speed: number): void;
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

/** Napis na zablokowanej karcie: „Najpierw: Młyn” albo „Czeka na: Młyn (w budowie)” */
export function needText(lock: { need: string; building: boolean }): string {
  const def = BUILDINGS.find((d) => d.id === lock.need);
  return t(lock.building ? 'hud.needsBuilding' : 'hud.needs').replace('{b}', def ? t(def.name) : lock.need);
}

function costText(def: BuildingDef): string {
  const parts = Object.entries(def.cost).map(([k, v]) => `${t(RESOURCE_DEFS[k as ResourceId].name)}: ${v}`);
  return parts.length ? parts.join(' · ') : t('hud.free');
}

/** Proste ikony surowców (SVG 20x20), rysowane ręcznie w jednym stylu. */
const ICONS: Record<string, string> = {
  // jedzenie razem: wiklinowy kosz z bochenkiem i jabłkiem (inna ikona niż same jabłka)
  food: '<path d="M4.5 9.5c0-3 2.5-4.5 5.5-4.5s5.5 1.500 5.5 4.500z" fill="#c9843d" stroke="#2a1c10" stroke-width=".9"/><circle cx="13.5" cy="8.6" r="2.4" fill="#d0281f" stroke="#2a1c10" stroke-width=".8"/><path d="M2.5 9.5h15l-2 7.5h-11z" fill="#9a6a34" stroke="#2a1c10"/><path d="M4 12h12M4.6 14.5h10.8M7 9.5l.5 7.500M10 9.5v7.500M13 9.5l-.5 7.500" stroke="#5e3e1c" stroke-width=".8"/>',
  wood: '<rect x="2" y="7" width="16" height="6" rx="3" fill="#8a5a2b" stroke="#2a1c10"/><circle cx="16" cy="10" r="2.6" fill="#d9b27a" stroke="#2a1c10"/><path d="M5 9h6M6 11.5h5" stroke="#5e4329"/>',
  stone: '<path d="M3 15l2-7 5-4 6 3 1 8z" fill="#b5b0a2" stroke="#2a1c10"/><path d="M5 8l5 2 6-3M10 10l-1 5" stroke="#6f6a5e" fill="none"/>',
  iron: '<path d="M3 14l2-5h10l2 5z" fill="#6a6570" stroke="#2a1c10"/><path d="M5 9l1-2h8l1 2" fill="#8f8a96" stroke="#2a1c10"/>',
  wheat: '<path d="M10 18V6" stroke="#8a6a1f" stroke-width="1.5"/><path d="M10 4l2.5 2.5L10 9 7.5 6.500zM10 8l3 2.5-3 2.5-3-2.500zM10 12l3 2.5-3 2.5-3-2.500z" fill="#e2bf4a" stroke="#2a1c10" stroke-width=".8"/>',
  flour: '<path d="M6 6c1-2 7-2 8 0l2 9c0 3-12 3-12 0z" fill="#f4eedc" stroke="#2a1c10"/><path d="M7 6c1 1.5 5 1.5 6 0" stroke="#2a1c10" fill="none"/><path d="M8 10h4M8 12.500h4" stroke="#b9ae90"/>',
  bread: '<path d="M2.5 13c0-5 3-7 7.5-7s7.5 2 7.5 7z" fill="#c9843d" stroke="#2a1c10"/><path d="M7 8.500l1.5 2M10.5 8l1.5 2M14 9l1 1.5" stroke="#7a4a1c"/>',
  apples: '<path d="M10 7c-4-2-7 1-6 5 1 4 4 5 6 4 2 1 5 0 6-4 1-4-2-7-6-5z" fill="#d0281f" stroke="#2a1c10"/><path d="M10 7c0-2 1-3 2-4" stroke="#2a1c10" fill="none"/><path d="M12 4c2-1 3 0 3 1-1 1-2 1-3-1z" fill="#5c9a3c" stroke="#2a1c10" stroke-width=".7"/>',
  fish: '<path d="M2 10c3-5 9-5 12 0-3 5-9 5-12 0z" fill="#9cc3d6" stroke="#2a1c10"/><path d="M14 10l4-3v6z" fill="#7aa6bd" stroke="#2a1c10"/><circle cx="5.5" cy="9" r=".9" fill="#2a1c10"/><path d="M8 7.500c1 1.500 1 3.500 0 5" stroke="#4f7f96" fill="none"/>',
  bow: '<path d="M6 2c8 3 8 13 0 16" fill="none" stroke="#8a5a2b" stroke-width="2"/><path d="M6 2v16" stroke="#e8e0c8" stroke-width="1"/><path d="M4 10h12l-2-2m2 2-2 2" stroke="#2a1c10" fill="none"/>',
  ale: '<path d="M5 4h8v13H5z" fill="#c98a2a" stroke="#2a1c10"/><path d="M5 4c0-2 8-2 8 0" fill="#f4eedc" stroke="#2a1c10"/><path d="M13 7h2.5c1 0 1.500.7 1.500 1.500v3c0 .8-.5 1.500-1.500 1.500H13" fill="none" stroke="#2a1c10" stroke-width="1.4"/><path d="M7.500 7v8M10.500 7v8" stroke="#8a5a1c"/>',
  spear: '<path d="M3 17L15 5" stroke="#8a5a2b" stroke-width="2"/><path d="M14 3l4-1-1 4-3 1z" fill="#b9bec6" stroke="#2a1c10"/>',
  crown: '<path d="M3 15l1-9 4 4 2-6 2 6 4-4 1 9z" fill="#e9c145" stroke="#2a1c10"/><rect x="3" y="15" width="14" height="2.5" fill="#c9a23a" stroke="#2a1c10"/>',
  store: '<rect x="3" y="6" width="14" height="10" fill="#a8743a" stroke="#2a1c10"/><path d="M3 6l2-3h10l2 3M3 11h14M10 6v10" stroke="#2a1c10" fill="none"/>',
  granary: '<path d="M4 9l6-5 6 5v8H4z" fill="#c9a24a" stroke="#2a1c10"/><rect x="8" y="12" width="4" height="5" fill="#5e4329" stroke="#2a1c10"/>',
  pop: '<circle cx="10" cy="6" r="3" fill="#e2bd94" stroke="#2a1c10"/><path d="M4 18c0-5 3-8 6-8s6 3 6 8z" fill="#a8281f" stroke="#2a1c10"/>',
  idle: '<path d="M3 13h14M5 13v4M15 13v4M4 10h12" stroke="#c9a24a" stroke-width="2"/><path d="M12 3h4l-4 4h4" stroke="#f6ecd0" fill="none"/>',
  hammer: '<path d="M9 8l7 9" stroke="#7a5232" stroke-width="2.4" stroke-linecap="round"/><path d="M3 6l5-4 4 4-5 4z" fill="#8a8e96" stroke="#2a1c10"/>',
  // waluta: grudka rudy (jak w Gothicu) — ciemna bryła z jasnoniebieskimi, połyskującymi żyłami
  gold: '<path d="M3 13l2-6 5-3 5 2 2 6-3 4H6z" fill="#4a4e5c" stroke="#16141c"/><path d="M6 8l3 2 2-3M9 10l-1 4M11 7l3 3 1 4M12 12l-3 2" stroke="#8fd3ff" stroke-width="1.1" fill="none"/><circle cx="9" cy="10" r="1" fill="#d9f2ff"/><circle cx="14" cy="10" r=".8" fill="#d9f2ff"/>',
};

/** Krótki zapis dużych liczb, żeby pasek się nie rozjeżdżał: 14315 → 14,3k, 1000000 → 1 mln */
function short(n: number): string {
  const a = Math.abs(n);
  const dec = lang() === 'en' ? '.' : ',';
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.0', '').replace('.', dec)}${tx(' mln', 'M')}`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace('.0', '').replace('.', dec)}k`;
  return String(n);
}

/** Ikona surowca (ta sama co na pasku zasobów) — do innych okien */
export function resIcon(id: string): HTMLElement { return icon(id); }

function icon(id: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 20 20" width="22" height="22">${ICONS[id] ?? ''}</svg>`;
  return span;
}

const SPEEDS = [0, 1, 2, 3, 5];

/** Portret włócznika: twarz pod kapalinem, tunika w barwie drużyny, grot włóczni */
const PORTRAIT = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
  <rect width="32" height="32" fill="#3b2716"/>
  <path d="M6 32c0-7 4-10 10-10s10 3 10 10z" fill="#a32a22" stroke="#1c120a"/>
  <path d="M10 26h12" stroke="#7c8088" stroke-width="2"/>
  <circle cx="16" cy="15" r="6" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M8 13c1-6 15-6 16 0z" fill="#5a5e66" stroke="#1c120a"/>
  <path d="M5 13.5h22" stroke="#5a5e66" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M27 4v18" stroke="#8a6a42" stroke-width="1.6"/><path d="M27 1l2 4h-4z" fill="#b9bec6"/>
</svg>`;

const ARCHER_PORTRAIT = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
  <rect width="32" height="32" fill="#3b2716"/>
  <path d="M6 32c0-7 4-10 10-10s10 3 10 10z" fill="#3f6a2e" stroke="#1c120a"/>
  <circle cx="16" cy="16" r="5.5" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M8.5 18c0-9 15-9 15 0l-2-5c-2-3-9-3-11 0z" fill="#3f6a2e" stroke="#1c120a"/>
  <path d="M26 3c5 7 5 19 0 26" fill="none" stroke="#7a5232" stroke-width="1.8"/><path d="M26 3v26" stroke="#e8e0c8" stroke-width=".6"/>
</svg>`;

export function createHud(root: HTMLElement, events: HudEvents, thumbs: Map<string, string> = new Map()): Hud {
  root.replaceChildren();

  // ---- pasek zasobów ----
  // dolny pas stanu (jak w grach miejskich): zegar i tempo z lewej, surowce w środku, osada i dwór z prawej
  const bar = el('div', 'status');
  const resList = el('ul', 'res');
  resList.setAttribute('aria-label', tx('Zasoby', 'Supplies'));
  const resVals: HTMLElement[] = [];
  const resTrends: HTMLElement[] = [];
  const resItems: HTMLElement[] = [];
  // ważne zapasy widać zawsze; reszta (półprodukty, broń, poszczególne rodzaje jedzenia) chowa się pod przyciskiem
  const MAIN_RES: readonly ResourceId[] = ['wood', 'stone', 'gold'];
  const FOOD_RES: readonly ResourceId[] = ['apples', 'bread', 'fish'];
  // zbiorczo jedzenie (jabłka + chleb + ryby), gdy reszta jest zwinięta
  const foodSum = el('li', 'res-sum');
  const foodSumVal = el('strong', '', '0');
  foodSum.dataset.tip = tx('Jedzenie', 'Food');
  foodSum.setAttribute('aria-label', tx('Jedzenie razem', 'Total food'));
  const foodSumTrend = el('span', 'trend');
  foodSum.append(icon('food'), foodSumVal, foodSumTrend);
  let resOpen = false;
  try { resOpen = localStorage.getItem('project1.resOpen') === '1'; } catch { /* nic */ }
  const resToggle = el('button', 'res-toggle');
  resToggle.type = 'button';
  const paintRes = (): void => {
    resList.classList.toggle('open', resOpen);
    extra.hidden = !resOpen;
    resToggle.setAttribute('aria-expanded', String(resOpen));
    resToggle.textContent = resOpen ? '‹' : '…';
    resToggle.title = resOpen ? tx('Zwiń: tylko najważniejsze zapasy', 'Collapse: key supplies only') : tx('Pokaż wszystkie zapasy', 'Show all supplies');
    resToggle.setAttribute('aria-label', resToggle.title);
  };
  resToggle.addEventListener('click', () => { resOpen = !resOpen; try { localStorage.setItem('project1.resOpen', resOpen ? '1' : '0'); } catch { /* nic */ } paintRes(); });
  for (const id of RESOURCES) {
    const li = el('li');
    const val = el('strong', '', '0');
    const tr = el('span', 'trend');
    li.dataset.tip = t(RESOURCE_DEFS[id].name);
    li.setAttribute('aria-label', t(RESOURCE_DEFS[id].name));
    li.append(icon(id), val, tr);
    resVals.push(val);
    resTrends.push(tr);
    resItems.push(li);
    // dawna osobna ruda z kopalni (17.10) nie ma już kafelka — ruda to waluta (kafelek 'gold')
    if (id === 'ore') { li.hidden = true; continue; }
    resList.append(li);
  }
  // kolejność: drewno, kamień, ruda, jedzenie razem, potem tyle kolejnych zapasów, ile zmieści się w pasku,
  // a reszta w wysuwanej listwie nad paskiem (przycisk „…”)
  for (const id of MAIN_RES) resList.append(resItems[RESOURCES.indexOf(id)]!);
  resList.append(foodSum);
  const extra = el('ul', 'res res-extra');
  extra.setAttribute('aria-label', tx('Pozostałe zapasy', 'Other supplies'));
  const toggleLi = el('li', 'res-toggle-li');
  toggleLi.append(resToggle, extra);
  resList.append(toggleLi);
  /** Zapasy dokładane do paska w tej kolejności, póki jest miejsce (broń i piwo, potem składniki jedzenia) */
  const SECOND: readonly ResourceId[] = ['iron', 'ale', 'spear', 'bow', 'bread', 'apples', 'wheat', 'flour', 'fish'];
  const fitRes = (): void => {
    for (const id of SECOND) resList.insertBefore(resItems[RESOURCES.indexOf(id)]!, toggleLi);
    const over = (): boolean => {
      if (resList.scrollWidth > resList.clientWidth + 1 || bar.scrollWidth > bar.clientWidth + 1) return true;
      // ostatni kafelek nie może dochodzić do liczników osady po prawej (odstęp jak między kafelkami)
      const last = (toggleLi.hidden ? toggleLi.previousElementSibling : toggleLi) as HTMLElement | null;
      return !!last && people.isConnected && last.getBoundingClientRect().right + 10 > people.getBoundingClientRect().left;
    };
    toggleLi.hidden = true; // najpierw próba bez „…”: może zmieści się wszystko
    if (over()) toggleLi.hidden = false;
    let shown = SECOND.length;
    while (shown > 0 && !toggleLi.hidden && over()) shown--, extra.prepend(resItems[RESOURCES.indexOf(SECOND[shown]!)]!);
    // listwa w kolejności pierwszeństwa (to, co nie zmieściło się w pasku)
    toggleLi.hidden = shown === SECOND.length;
    if (toggleLi.hidden && resOpen) { resOpen = false; paintRes(); }
  };
  paintRes();
  const people = el('div', 'people');
  const popVal = el('strong');
  const popularVal = el('strong');
  const deltaVal = el('span', 'delta');
  const popBox = el('div');
  popBox.title = t('hud.population');
  popBox.setAttribute('aria-label', t('hud.population'));
  popBox.append(icon('pop'), popVal);
  const armyVal = el('strong');
  const armyBox = el('div');
  armyBox.title = t('cat.military');
  armyBox.setAttribute('aria-label', t('cat.military'));
  armyBox.append(icon('spear'), armyVal);
  const popularBox = el('div');
  // pasek popularności ze znacznikiem progu, od którego przybywa ludzi
  const meter = el('span', 'meter');
  meter.setAttribute('aria-hidden', 'true');
  const meterFill = el('span', 'meter-fill');
  meter.append(meterFill, el('span', 'meter-mark'));
  popularBox.classList.add('popular');
  popularBox.title = t('hud.popularity');
  popularBox.append(icon('crown'), meter, popularVal, deltaVal);
  // rozwijane rozpiski nad dolnym paskiem: klik w koronę = popularność, klik w ludzi = kto co robi
  const report = el('div', 'report panel');
  report.hidden = true;
  let reportKind: 'popularity' | 'people' | 'army' | 'food' | null = null;
  let lastReport: HudView['report'];
  const drawReport = (): void => {
    if (!reportKind || !lastReport) { report.hidden = true; return; }
    report.hidden = false;
    const rows = reportKind === 'popularity' ? lastReport.popularity : reportKind === 'army' ? lastReport.army : reportKind === 'food' ? [] : lastReport.people;
    const sum = reportKind === 'popularity' ? rows.reduce((n, r) => n + r.value, 0) : 0;
    report.innerHTML = `<button type="button" class="report-x" aria-label="${t('hud.close')}">×</button><p class="report-title">${reportKind === 'popularity' ? tx('Popularność — co miesiąc', 'Popularity — each month') : reportKind === 'army' ? t('cat.military') : reportKind === 'food' ? tx('Spichlerz — jedzenie', 'Granary — food') : tx('Mieszkańcy', 'Townsfolk')}</p>`;
    const list = el('dl', 'report-list');
    if (reportKind === 'food') for (const r of lastReport.food) {
      const dt = el('dt', '', r.label);
      if (r.note) dt.append(el('small', '', ` ${r.note}`));
      list.append(dt, el('dd', r.sign ?? '', r.value));
    }
    for (const r of rows) {
      const dt = el('dt', '', r.label);
      if ('note' in r && r.note) dt.append(el('small', '', ` ${r.note}`));
      const dd = el('dd', reportKind === 'popularity' ? (r.value > 0 ? 'plus' : r.value < 0 ? 'minus' : '') : '', reportKind === 'popularity' ? `${r.value > 0 ? '+' : ''}${r.value}` : String(r.value));
      list.append(dt, dd);
    }
    if (reportKind === 'popularity') { list.append(el('dt', 'report-sum', tx('Razem', 'Total')), el('dd', `report-sum ${sum > 0 ? 'plus' : sum < 0 ? 'minus' : ''}`, `${sum > 0 ? '+' : ''}${sum}`)); }
    report.append(list);
    // okienko wyskakuje tuż nad przyciskiem, który je otworzył
    const anchor = reportKind === 'popularity' ? popularBox : reportKind === 'army' ? armyBox : reportKind === 'food' ? foodBox : popBox;
    // okno ma powiększenie interfejsu (zoom: var(--ui)), więc jego left/bottom liczą się w pikselach powiększonych:
    // pozycję z ekranu dzielimy przez powiększenie, a szerokość okna mnożymy — inaczej wyjeżdża poza ekran
    const r = anchor.getBoundingClientRect();
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    const w = report.getBoundingClientRect().width || 340 * k;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    report.style.bottom = `${(window.innerHeight - r.top + 10) / k}px`;
    report.style.left = `${left / k}px`;
    report.style.right = 'auto';
    if (reportKind === 'food' && lastReport.foodHint) report.append(el('p', 'report-hint', lastReport.foodHint));
    if (reportKind === 'popularity') report.append(el('p', 'report-hint', tx('W górę: większe racje, niższe podatki albo rozdawanie rudy. W dół: małe racje, wysokie podatki, za mało miejsc w chatach. Od 50 przychodzą nowi ludzie, poniżej odchodzą.', 'Up: bigger rations, lower taxes or handing out ore. Down: small rations, high taxes, too few places in the cottages. From 50 new folk arrive; below it they leave.')));
  };
  const toggleReport = (k: 'popularity' | 'people' | 'army' | 'food'): void => { reportKind = reportKind === k ? null : k; drawReport(); };
  for (const [box, k] of [[popularBox, 'popularity'], [popBox, 'people'], [armyBox, 'army']] as const) {
    box.classList.add('clickable');
    box.tabIndex = 0;
    box.setAttribute('role', 'button');
    box.addEventListener('click', () => toggleReport(k));
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleReport(k); } });
  }
  // zamykanie przy wciśnięciu (pointerdown): zawartość odświeża się co chwilę, więc zwykły click potrafił się zgubić
  report.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('.report-x')) { e.preventDefault(); reportKind = null; drawReport(); } });
  report.addEventListener('keydown', (e) => { if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest('.report-x'))) { reportKind = null; drawReport(); } });
  document.body.append(report);
  const stockVal = el('strong');
  const stockBox = el('div');
  stockBox.title = t('hud.stockpile');
  stockBox.setAttribute('aria-label', t('hud.stockpile'));
  // obrazek budynku zamiast ogólnej ikonki: od razu widać, który to skład, a który spichlerz; obok bilans na minutę
  const pic = (id: string, fallback: string): HTMLElement => {
    const src = thumbs.get(id);
    if (!src) return icon(fallback);
    const img = el('img', 'store-pic'); img.src = src; img.alt = ''; return img;
  };
  const stockTrend = el('span', 'trend'), foodTrend = el('span', 'trend');
  stockBox.classList.add('store-box');
  stockBox.append(pic('stockpile', 'store'), stockVal, stockTrend);
  const foodVal = el('strong');
  const foodBox = el('div');
  foodBox.title = t('hud.granary');
  foodBox.setAttribute('aria-label', t('hud.granary'));
  foodBox.classList.add('store-box');
  foodBox.append(pic('granary', 'granary'), foodVal, foodTrend);
  // klik w spichlerz: ile jedzą na dobę i co miesiąc, na ile starczy, ilu ludzi wykarmią gospodarstwa
  foodBox.classList.add('clickable');
  foodBox.tabIndex = 0;
  foodBox.setAttribute('role', 'button');
  foodBox.addEventListener('click', () => toggleReport('food'));
  foodBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleReport('food'); } });
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
  // pora roku i temperatura pod zegarem; mróz na niebiesko, upał na czerwono
  const weatherVal = el('span', 'weather');
  const clockText = el('span', 'clock-text');
  clockText.append(clockVal, weatherVal);
  clockBox.append(clockIcon, clockText);
  people.append(stockBox, foodBox, popBox, armyBox, idleBox, popularBox);
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
    const was = speedIndex;
    speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, speedIndex + dir));
    if (events.onSpeed(SPEEDS[speedIndex]!) === false) speedIndex = was;
    showSpeed();
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
  fitRes();

  // ---- komunikaty ----
  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  let toastTimer = 0;

  // ---- panel wybranego budynku ----
  const info = el('div', 'panel info');
  // Okno budynku/wojska rośnie w górę od dołu ekranu: jego wysokość ogranicza miejsce między dolną belką
  // (z otwartą listą budynków też) a znacznikami w prawym górnym rogu (wersja, FPS, deweloper). Liczone z położenia
  // na ekranie, bo pasek budynków i belka mają różną wysokość zależnie od okna i powiększenia interfejsu.
  const fitInfo = (): void => {
    if (info.hidden || !info.isConnected) return;
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    const r = info.getBoundingClientRect();
    if (!r.height) return;
    const top = 136 * k; // pod przyciskiem „Deweloper” (top 92 + 34 px w skali interfejsu) z małym zapasem
    const want = `${Math.max(140, Math.floor((r.bottom - top) / k))}px`;
    if (info.style.maxHeight !== want) info.style.maxHeight = want;
  };
  setInterval(fitInfo, 300);
  window.addEventListener('resize', fitInfo);
  // zapasy w pasku: przelicz po zmianie okna i wielkości interfejsu (oraz raz po wczytaniu czcionek)
  let resW = 0;
  const refit = (): void => { const w = bar.clientWidth + Math.round(parseFloat(getComputedStyle(bar).zoom || '1') * 1000); if (w !== resW && bar.isConnected) { resW = w; fitRes(); } };
  setInterval(refit, 500);
  window.addEventListener('resize', refit);
  void document.fonts?.ready.then(() => { resW = 0; refit(); });
  info.hidden = true;
  const infoName = el('p', 'info-name');
  const infoDesc = el('p');
  const infoWorker = el('p');
  const infoActions = el('div', 'actions');
  const demolish = el('button', 'btn-main', t('hud.demolish'));
  demolish.type = 'button';
  const close = el('button', 'btn-plain', t('hud.close'));
  close.type = 'button';
  const trainBtn = el('button', 'btn-main', t('hud.train'));
  trainBtn.type = 'button';
  trainBtn.hidden = true;
  trainBtn.addEventListener('click', () => events.onTrain(infoId, 1));
  const trainNote = el('p', 'hint');
  // koszary: obok siebie karty jednostek z dużym portretem; na każdej przyciski +1, +5 i „+ wszystkie”
  const recruit = el('div', 'recruit');
  recruit.hidden = true;
  let lastRecruit: RecruitUnit[] = [];
  const unitCards = new Map<string, { card: HTMLElement; stats: HTMLElement; needs: HTMLElement; b1: HTMLButtonElement; b5: HTMLButtonElement; bAll: HTMLButtonElement; flag: HTMLButtonElement }>();
  // wspólny punkt zbiórki dla wszystkich nowych żołnierzy (pod kartami)
  const rallyRow = el('div', 'rally-row');
  const rallyAll = el('button', 'btn-main', tx('⚑ Punkt zbiórki dla wszystkich', '⚑ Rally point for all'));
  rallyAll.type = 'button';
  const rallyOff = el('button', '', tx('Zdejmij flagi', 'Remove flags'));
  rallyOff.type = 'button';
  rallyAll.addEventListener('click', () => events.onRally(infoId, null, false));
  rallyOff.addEventListener('click', () => events.onRally(infoId, null, true));
  rallyRow.append(rallyAll, rallyOff, el('p', 'hint', tx('Rekrut idzie z obozowiska do koszar, wychodzi w zbroi i staje na fladze (bez flagi — przed koszarami).', 'A recruit walks from the camp to the barracks, comes out armoured and stands at the flag (with no flag — outside the barracks).')));
  // taran: wóz z daszkiem i belką z kutą głowicą
  const RAM_PORTRAIT = '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M5 15l11-7 11 7z" fill="#8a6a44" stroke="#2a1c10"/><rect x="6" y="15" width="20" height="2" fill="#5e4329"/><path d="M8 17v7M24 17v7" stroke="#5e4329" stroke-width="2"/><rect x="3" y="18" width="24" height="3" rx="1.5" fill="#8a5a2b" stroke="#2a1c10"/><path d="M27 17.5l3 1.5v1.5l-3 1.5z" fill="#6a6e76" stroke="#2a1c10"/><circle cx="10" cy="26" r="3" fill="#6e4a2c" stroke="#2a1c10"/><circle cx="22" cy="26" r="3" fill="#6e4a2c" stroke="#2a1c10"/></svg>';
  const PORTRAITS: Record<string, string> = { spearman: PORTRAIT, archer: ARCHER_PORTRAIT, ram: RAM_PORTRAIT };
  const drawRecruit = (): void => {
    for (const r of lastRecruit) {
      let c = unitCards.get(r.id);
      if (!c) {
        const card = el('div', 'unit-card');
        const pic = el('span', 'unit-pic');
        // portret z modelu 3D (ten sam żołnierz co na mapie); bez niego rysunek
        const shot = thumbs.get(`u:${r.id}`);
        if (shot) { const img = el('img'); img.src = shot; img.alt = ''; pic.append(img); pic.classList.add('shot'); }
        else pic.innerHTML = PORTRAITS[r.id] ?? PORTRAIT;
        const name = el('strong', 'unit-name', r.name);
        const stats = el('span', 'unit-stats');
        const needs = el('div', 'unit-needs');
        const btns = el('div', 'unit-btns');
        const mk = (n: number, label: string): HTMLButtonElement => { const b = el('button', 'btn-main', label); b.type = 'button'; b.addEventListener('click', () => events.onTrain(infoId, n, r.id)); btns.append(b); return b; };
        const b1 = mk(1, '+1'), b5 = mk(5, '+5'), bAll = mk(999, tx('+ wszyscy', '+ all'));
        // flaga zbiórki tylko dla tego rodzaju: klik i wskazanie miejsca na mapie
        const flag = el('button', 'unit-flag', tx('⚑ Flaga zbiórki', '⚑ Rally flag'));
        flag.type = 'button';
        flag.title = tx(`Gdzie mają iść nowi (${r.name.toLowerCase()}): kliknij, potem wskaż miejsce na mapie. Prawy klik na przycisku zdejmuje flagę.`, `Where new recruits (${r.name.toLowerCase()}) should go: click, then pick a spot on the map. Right-click the button to remove the flag.`);
        flag.addEventListener('click', () => events.onRally(infoId, r.id, false));
        flag.addEventListener('contextmenu', (e) => { e.preventDefault(); events.onRally(infoId, r.id, true); });
        card.append(pic, name, stats, needs, btns, flag);
        if (!rallyRow.isConnected) recruit.append(rallyRow);
        recruit.insertBefore(card, rallyRow);
        c = { card, stats, needs, b1, b5, bAll, flag };
        unitCards.set(r.id, c);
      }
      setText(c.stats, `${t('hud.hp')} ${r.hp} · ${t('hud.attack')} ${r.attack}${r.range ? ` · ${tx('zasięg', 'range')} ${r.range}` : ''}`);
      const row = (icon: string, have: number, need: number): string => `<span class="need${have < need ? ' short' : ''}"><svg viewBox="0 0 20 20" width="22" height="22">${ICONS[icon] ?? ''}</svg><strong>${need}</strong><em>(${have})</em></span>`;
      c.needs.innerHTML = row(r.weapon, r.have, r.need ?? 1) + row('gold', r.gold, r.cost) + row('idle', r.idle, 1);
      c.b1.disabled = r.max < 1; c.b5.disabled = r.max < 5; c.bAll.disabled = r.max < 1;
      setText(c.bAll, tx(`+ wszyscy (${r.max})`, `+ all (${r.max})`));
      c.card.classList.toggle('cant', r.max < 1);
      c.flag.setAttribute('aria-pressed', String(!!r.rally));
      setText(c.flag, r.rally ? tx('⚑ Flaga ustawiona — zmień', '⚑ Flag set — change') : tx('⚑ Flaga zbiórki', '⚑ Rally flag'));
    }
  };

  const hpLine = el('div', 'hp-line');
  const hpBar = el('span', 'hp-bar');
  const hpFill = el('span');
  hpBar.append(hpFill);
  const hpText = el('span');
  hpLine.append(hpText, hpBar);
  const roster = el('div', 'roster');
  roster.hidden = true;
  let rosterKey = '';
  // panel wojska: typy jednostek (klik = tylko ten typ), formacja i postawa; budowany raz, potem tylko odświeżany
  const armyPanel = el('div', 'army-box');
  armyPanel.hidden = true;
  const kindsRow = el('div', 'army-kinds');
  const kindBtns = new Map<string, { b: HTMLButtonElement; n: HTMLElement }>();
  const seg = (label: string, items: [string, string][], pick: (i: number) => void): HTMLButtonElement[] => {
    const wrap = el('div', 'army-row');
    wrap.append(el('span', 'army-label', label));
    const group = el('div', 'army-seg');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const out = items.map(([text, tip], i) => {
      const b = el('button', 'army-btn', text);
      b.type = 'button';
      b.title = tip;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => pick(i));
      group.append(b);
      return b;
    });
    wrap.append(group);
    armyPanel.append(wrap);
    return out;
  };
  armyPanel.append(kindsRow);
  const formBtns = seg(tx('Szyk', 'Formation'), [[tx('Linia', 'Line'), tx('Szeroki front, 1–3 szeregi. Łucznicy z tyłu.', 'Wide front, 1–3 ranks. Archers at the rear.')], [tx('Blok', 'Block'), tx('Zwarty kwadrat: trudny do obejścia.', 'A tight square: hard to outflank.')], [tx('Luźno', 'Loose'), tx('Co drugie pole: mniej ofiar od strzał.', 'Every other tile: fewer losses to arrows.')], [tx('Ścisk', 'Packed'), tx('Ramię w ramię: zbity kwadrat, gdy oddział stoi.', 'Shoulder to shoulder: a dense square while the troop stands.')]], (i) => events.onArmyForm(i));
  const marchBtns = seg(tx('Marsz', 'March'), [[tx('Zwykły', 'Plain'), tx('Idą na miejsce, nie zatrzymując się na wroga.', 'They march to the spot without stopping for the enemy.')], [tx('Z walką', 'Fighting'), tx('Idą na miejsce, ale biją każdego wroga, którego spotkają. Ctrl + prawy klik odwraca wybór dla jednego rozkazu.', 'They march to the spot but strike any enemy they meet. Ctrl + right-click flips the choice for a single order.')]], (i) => events.onArmyMarch(i));
  const stanceBtns = seg(tx('Postawa', 'Stance'), [[tx('Atak', 'Attack'), tx('Goni każdego wroga, którego zobaczy.', 'Chases every enemy in sight.')], [tx('Obrona', 'Defend'), tx('Walczy w pobliżu swojego miejsca i do niego wraca.', 'Fights near its post and returns to it.')], [tx('Stój', 'Hold'), tx('Nie rusza się z miejsca. Bije tylko tych, których sięgnie.', 'Does not budge. Strikes only those within reach.')]], (i) => events.onArmyStance(i));
  const [patrolBtn] = seg(tx('Rozkazy', 'Orders'), [[tx('Patrol (P)', 'Patrol (P)'), tx('Kliknij, potem prawy klik na mapie: oddział chodzi tam i z powrotem i bije wrogów po drodze (Shift + prawy klik: więcej punktów). Kolejka marszu: Shift + prawy klik bez patrolu dopisuje kolejny punkt trasy.', 'Click, then right-click on the map: the troop walks there and back, striking foes on the way (Shift + right-click: more waypoints). Marching queue: Shift + right-click without patrol adds another stop to the route.')]], () => events.onArmyPatrol());
  // brama: jeden duży przycisk otwórz/zamknij i stan pod spodem
  const gateBox = el('div', 'gate-box');
  const gateBtn = el('button', 'btn-main gate-btn');
  gateBtn.type = 'button';
  const gateState = el('p', 'gate-state');
  let gateWant = true;
  gateBtn.addEventListener('click', () => events.onGate(infoId, !gateWant));
  gateBox.append(gateBtn, gateState);
  gateBox.hidden = true;
  // wyłączanie budynku: pracownik odchodzi do innej roboty (np. do sadu, gdy brakuje jedzenia)
  const powerBox = el('div', 'gate-box power-box');
  const powerBtn = el('button', 'btn-main gate-btn');
  powerBtn.type = 'button';
  const powerState = el('p', 'gate-state');
  let powerOn = true;
  powerBtn.addEventListener('click', () => events.onPower(infoId, !powerOn));
  powerBox.append(powerBtn, powerState);
  powerBox.hidden = true;
  // wieża: ilu łuczników stoi na pomoście, zaznacz ich albo każ zejść
  const towerBox = el('div', 'gate-box');
  const towerState = el('p', 'gate-state');
  const towerBtns = el('div', 'actions');
  const tSel = el('button', 'btn-main', tx('Zaznacz łuczników', 'Select archers')); tSel.type = 'button';
  const tDown = el('button', 'btn-main', tx('Zejdźcie z wieży', 'Come down from the tower')); tDown.type = 'button';
  tSel.addEventListener('click', () => events.onSelectGarrison(infoId));
  tDown.addEventListener('click', () => events.onDismount(infoId));
  towerBtns.append(tSel, tDown);
  towerBox.append(towerState, towerBtns);
  towerBox.hidden = true;
  // twierdza: straż miejska
  const watchState = el('p', 'gate-state');
  watchState.hidden = true;
  const walkBtn = el('button', 'btn-main walk-btn', tx('Przejdź się jego oczami (F)', 'Walk in his shoes (F)')); walkBtn.type = 'button'; walkBtn.hidden = true;
  walkBtn.addEventListener('click', () => events.onWalk());
  const areaBtn = el('button', 'btn-main', tx('Pokaż teren pracy', 'Show work area')); areaBtn.type = 'button'; areaBtn.hidden = true;
  // kopalnia: przejście do sztolni oczami chłopa (osobna lokacja pod ziemią)
  const mineBtn = el('button', 'btn-main walk-btn', tx('Wejdź do kopalni', 'Enter the mine')); mineBtn.type = 'button'; mineBtn.hidden = true;
  mineBtn.addEventListener('click', () => events.onEnterMine(infoId));
  areaBtn.addEventListener('click', () => events.onArea(infoId));
  infoActions.append(areaBtn, demolish, close);
  // plac budowy: pasek postępu, materiał (przyniesiony / potrzebny, w drodze), robotnicy i co się teraz dzieje
  // warsztat: przepis z ikonami, pracownik z postępem roboty, stan (co blokuje) i liczby
  const prodBox = el('div', 'info-prod');
  prodBox.hidden = true;
  const prodRecipe = el('div', 'prod-recipe');
  const prodWorker = el('div', 'prod-worker');
  const prodWho = el('p', 'prod-who');
  // pracownika widać na mapie po złotej szpilce nad głową (gra stawia ją sama, gdy okno budynku jest otwarte)
  const prodEye = el('span', 'prod-pin');
  prodEye.title = tx('Pracownika widać na mapie po złotej szpilce nad głową', 'The worker is marked on the map by a golden pin above his head');
  prodEye.setAttribute('aria-hidden', 'true');
  prodEye.innerHTML = '<svg viewBox="0 0 24 28" width="16" height="19"><path d="M12 27l-5-9a10 10 0 1 1 10 0z" fill="#e9c145" stroke="#140a05" stroke-width="1.6"/><circle cx="12" cy="7.5" r="2.6" fill="#2a1a0c"/><path d="M7 15.5c0-4 2.2-5.5 5-5.5s5 1.5 5 5.5z" fill="#2a1a0c"/></svg>';
  const prodHead = el('div', 'prod-head');
  prodHead.append(prodWho, prodEye);
  const prodBar = el('div', 'prod-bar');
  const prodFill = el('span');
  prodBar.append(prodFill);
  prodWorker.append(prodHead, prodBar);
  const prodStatus = el('p', 'prod-status');
  prodStatus.setAttribute('role', 'status');
  const prodRows = el('div', 'prod-rows');
  prodBox.append(prodRecipe, prodWorker, prodStatus, prodRows);
  const siteBox = el('div', 'info-site');
  siteBox.hidden = true;
  const siteHead = el('p', 'stock-head');
  const siteBar = el('div', 'stock-bar');
  const siteFill = el('span');
  siteBar.append(siteFill);
  const siteRows = el('div', 'site-rows');
  siteBox.append(siteHead, siteBar, siteRows);
  const storeBox = el('div', 'info-stock');
  storeBox.hidden = true;
  info.append(infoName, hpLine, gateBox, powerBox, towerBox, watchState, walkBtn, mineBtn, recruit, armyPanel, roster, siteBox, prodBox, storeBox, infoDesc, infoWorker, trainBtn, trainNote, infoActions);
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
  const CAT_ICON: Record<string, string> = { settlement: 'house', food: 'farm', industry: 'woodcutter', military: 'barracks', defense: 'watchtower', roads: 'roadStone' };
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
    if (!def.buildable || def.legacy) continue; // kamieniołom i kopalnia żelaza zastąpione kopalnią pod górami
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
    const need = el('span', 'build-need');
    need.hidden = true;
    text.append(el('span', 'build-name', t(def.name)), el('span', 'build-cost', costText(def)), need);
    b.append(text);
    b.addEventListener('click', () => events.onPickBuilding(picked === def.id ? null : def.id));
    buildButtons.set(def.id, b);
    cards.append(b);
  }
  // droga z dyli stoi na końcu listy budynków (zgodność zapisów), ale na pasku między piaskową a kamienną
  { const rw = buildButtons.get('roadWood'), rs = buildButtons.get('roadStone'); if (rw && rs) rs.before(rw); }

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
  const menuBtn = el('button', 'btn-plain', t('hud.menu'));
  menuBtn.type = 'button';
  menuBtn.addEventListener('click', () => events.onMenu());
  tabs.prepend(menuBtn);
  // oko: patrzymy oczami przypadkowego mieszkańca osady
  const eye = el('button', 'btn-plain hud-eye');
  eye.type = 'button';
  eye.title = tx('Spacer chłopem: kliknij oko, potem miejsce na mapie (F). Drugi raz oko: losowy mieszkaniec', 'Walk as a peasant: click the eye, then a spot on the map (F). Eye again: a random villager');
  eye.setAttribute('aria-label', eye.title);
  eye.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>';
  eye.addEventListener('click', () => events.onRandomWalk());
  tabs.append(eye);
  // konto na dolnym pasku: herb i nick (albo zaproszenie do logowania)
  const acc = el('button', 'hud-acc');
  acc.type = 'button';
  acc.addEventListener('click', () => events.onAccount());
  const paintAcc = (): void => {
    const m = me();
    acc.replaceChildren();
    const sh = el('span', 'net-shield');
    sh.innerHTML = avatarSvg(m ? m.avatar : 0, 22);
    if (!m) sh.classList.add('guest');
    acc.append(sh, el('span', 'hud-acc-nick', m ? m.nick : tx('Gość · zaloguj', 'Guest · sign in')));
    acc.setAttribute('aria-label', m ? tx(`Konto: ${m.nick}`, `Account: ${m.nick}`) : tx('Zaloguj się', 'Sign in'));
  };
  onAccount(paintAcc);
  paintAcc();
  tabs.prepend(acc);
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
  const mapSec = el('div'); // nowa gra przeniesiona do menu głównego
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
  const help = el('div'); // dźwięk i sterowanie przeniesione do menu głównego
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
  // ---- pasek wojska nad menu: grupy pod cyframi i portrety zaznaczonych ----
  const armyBar = el('div', 'armybar');
  armyBar.hidden = true;
  const slotsWrap = el('div', 'army-slots');
  slotsWrap.setAttribute('role', 'group');
  slotsWrap.setAttribute('aria-label', tx('Grupy wojska', 'Army groups'));
  const pickedBox = el('div', 'army-picked');
  pickedBox.setAttribute('role', 'group');
  pickedBox.setAttribute('aria-label', t('hud.soldiers'));
  armyBar.append(slotsWrap, pickedBox);
  const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => {
    const b = el('button', 'army-slot');
    b.type = 'button';
    const num = el('span', 'army-slot-n', String(n));
    const pic = el('span', 'army-slot-pic');
    const count = el('span', 'army-slot-count');
    b.append(num, pic, count);
    b.addEventListener('click', (e) => events.onGroup(n, e.shiftKey ? 'save' : 'pick'));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); events.onGroup(n, 'clear'); });
    slotsWrap.append(b);
    return { n, b, pic, count, kind: '' };
  });
  let pickedKey = '';
  bottom.append(floaters, buildbar, armyBar, dock);
  root.append(toast, bottom);
  showCategory(null);

  return {
    setArmyBar(v) {
      armyBar.hidden = !v.show;
      if (!v.show) return;
      for (const sl of slots) {
        const g = v.groups.find((x) => x.n === sl.n);
        const count = g?.count ?? 0;
        const kind = count ? g?.kind ?? 'spearman' : '';
        if (sl.kind !== kind) { sl.kind = kind; sl.pic.innerHTML = kind ? (kind === 'archer' ? ARCHER_PORTRAIT : PORTRAIT) : ''; }
        setText(sl.count, count ? String(count) : '');
        sl.b.classList.toggle('empty', !count);
        sl.b.setAttribute('aria-pressed', String(v.active === sl.n));
        const label = count ? tx(`Grupa ${sl.n}: ${count}. Klik: wybierz (dwa razy: kamera). Shift + klik: zapisz zaznaczonych. Prawy klik: wyczyść.`, `Group ${sl.n}: ${count}. Click: select (twice: camera). Shift + click: save selection. Right-click: clear.`) : tx(`Grupa ${sl.n} pusta. Klik albo Shift + ${sl.n}: zapisz zaznaczonych.`, `Group ${sl.n} empty. Click or Shift + ${sl.n}: save selection.`);
        if (sl.b.title !== label) { sl.b.title = label; sl.b.setAttribute('aria-label', label); }
      }
      const key = v.selected.slice(0, 30).map((u) => `${u.id}:${Math.round((u.hp / u.max) * 20)}`).join() + v.selected.length;
      if (key === pickedKey) return;
      pickedKey = key;
      pickedBox.replaceChildren(...v.selected.slice(0, 30).map((u) => {
        const card = el('button', 'roster-card');
        card.type = 'button';
        card.title = tx(`${u.name}. Klik: odznacz. Shift + klik: zostaw tylko jego.`, `${u.name}. Click: deselect. Shift + click: keep only him.`);
        card.setAttribute('aria-label', tx(`${u.name}, zdrowie ${Math.round((u.hp / u.max) * 100)}%. Odznacz.`, `${u.name}, health ${Math.round((u.hp / u.max) * 100)}%. Deselect.`));
        card.innerHTML = u.kind === 'archer' ? ARCHER_PORTRAIT : PORTRAIT;
        const bar = el('span', 'roster-hp');
        const fill = el('span');
        fill.style.width = `${Math.round((u.hp / u.max) * 100)}%`;
        bar.append(fill);
        card.append(bar);
        card.addEventListener('click', (e) => events.onArmyUnit(u.id, e.shiftKey));
        return card;
      }));
      if (v.selected.length > 30) pickedBox.append(el('span', 'roster-more', `+${v.selected.length - 30}`));
      pickedBox.hidden = !v.selected.length;
    },
    setSeed(text, presetId) { seed.value = text; mode.value = presetId; },
    setHash(hash) { setText(hashLine, `${t('hud.hash')}: ${hash.toString(16).padStart(8, '0')}`); },
    update(v) {
      if (v.report) { lastReport = v.report; if (reportKind) drawReport(); }
      setText(armyVal, String(v.soldiers ?? 0));
      resVals.forEach((node, i) => setText(node, short(v.res[i] ?? 0)));
      const fs = FOOD_RES.reduce((a, id) => a + (v.res[RESOURCES.indexOf(id)] ?? 0), 0);
      setText(foodSumVal, short(fs));
      foodSum.dataset.tip = `${tx('Jedzenie razem', 'Total food')}: ${fs} (${FOOD_RES.map((id) => `${t(RESOURCE_DEFS[id].name)} ${v.res[RESOURCES.indexOf(id)] ?? 0}`).join(', ')})`;
      // w pasku zmianę (+/−) pokazuje tylko jedzenie razem — to ono decyduje o głodzie; reszta zapasów ma zmianę w podpowiedzi
      const fd = FOOD_RES.reduce((a, id) => a + (v.trend[RESOURCES.indexOf(id)] ?? 0), 0);
      setText(foodSumTrend, fd ? `${fd > 0 ? '+' : '−'}${short(Math.abs(fd))}` : '');
      foodSumTrend.dataset.sign = fd > 0 ? 'pos' : fd < 0 ? 'neg' : '';
      // trend: ile przybyło albo ubyło w ostatniej minucie gry (zielone na plus, czerwone na minus)
      resTrends.forEach((node, i) => {
        const d = v.trend[i] ?? 0;
        setText(node, d ? `${d > 0 ? '+' : '−'}${short(Math.abs(d))}` : '');
        node.dataset.sign = d > 0 ? 'pos' : d < 0 ? 'neg' : '';
        resItems[i]!.dataset.tip = `${t(RESOURCE_DEFS[RESOURCES[i]!].name)}: ${v.res[i] ?? 0}${d ? ` (${d > 0 ? '+' : '−'}${Math.abs(d)} ${t('hud.perMinute')})` : ''}`;
      });
      // godzina co kwadrans, stałej szerokości, żeby pasek nie skakał
      const hh = Math.floor(v.hour), mm = Math.floor(((v.hour - hh) * 60) / 15) * 15;
      setText(clockVal, `${t('hud.day')} ${v.day}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      if (v.weather) {
        const tmp = Math.round(v.weather.temp);
        setText(weatherVal, `${v.weather.season} · ${tmp < 0 ? '−' : ''}${Math.abs(tmp)}°C`);
        weatherVal.dataset.t = tmp <= 0 ? 'frost' : tmp < 8 ? 'cold' : tmp > 25 ? 'hot' : '';
        clockBox.title = `${v.weather.season}, ${lang() === 'en' ? v.weather.temp.toFixed(1) : v.weather.temp.toFixed(1).replace('.', ',')}°C${tmp < 8 ? tx(' — ludzie palą w piecach', ' — folk are lighting their hearths') : ''}`;
      }
      // południe na górze o 12:00, północ o 24:00
      disc.setAttribute('transform', `rotate(${((v.hour - 12) / 24) * 360})`);
      setText(popVal, `${v.pop} / ${v.housing}`);
      setText(idleVal, `${v.idle} / ${v.idleSlots}`);
      idleBox.classList.toggle('full', v.idle >= v.idleSlots);
      setText(stockVal, `${short(v.stock)} / ${short(v.stockCap)}`);
      // bilans: suma zmian zapasów w składach (towary) i w spichlerzach (jedzenie) z ostatniej minuty gry
      let ds = 0, df = 0;
      RESOURCES.forEach((id, i) => { const d = v.trend[i] ?? 0; const st = RESOURCE_DEFS[id].store; if (st === 'stockpile') ds += d; else if (st === 'granary') df += d; });
      for (const [node, d, box, what] of [[stockTrend, ds, stockBox, tx('Skład (towary)', 'Stockpile (goods)')], [foodTrend, df, foodBox, tx('Spichlerz (jedzenie)', 'Granary (food)')]] as const) {
        setText(node, d ? `${d > 0 ? '+' : '−'}${short(Math.abs(d))}` : '±0');
        node.dataset.sign = d > 0 ? 'pos' : d < 0 ? 'neg' : '';
        box.title = `${what}: ${d > 0 ? tx('przybywa', 'rising') : d < 0 ? tx('ubywa', 'falling') : tx('bez zmian', 'steady')}${d ? ` (${d > 0 ? '+' : '−'}${Math.abs(d)} ${t('hud.perMinute')})` : ''}`;
      }
      stockBox.classList.toggle('full', v.stock >= v.stockCap);
      setText(foodVal, `${short(v.food)} / ${short(v.foodCap)}`);
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
      for (const [id, b] of buildButtons) {
        const lock = v.locked.get(id);
        b.classList.toggle('poor', !lock && !v.affordable.has(id));
        b.classList.toggle('locked', !!lock);
        const need = b.querySelector<HTMLElement>('.build-need')!;
        const msg = lock ? needText(lock) : '';
        setText(need, msg);
        need.hidden = !lock;
        const title = lock ? `${msg}. ${t(`d.${id}`)}` : t(`d.${id}`);
        if (b.title !== title) b.title = title;
      }
      if (wreck.getAttribute('aria-pressed') !== 'true') buildFoot.hidden = picked === null;
      syncPicker();
    },
    closeBuild() {
      if (category === null) return false;
      showCategory(null);
      return true;
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
      trainBtn.hidden = true;
      trainNote.hidden = true;
      roster.hidden = true; armyPanel.hidden = true;
      hpLine.hidden = true;
      recruit.hidden = true;
      towerBox.hidden = true;
      gateBox.hidden = true;
      powerBox.hidden = true;
      // resztki okna budynku (plac budowy, zapasy, zasięg strzału) nie mogą zostać na karcie człowieka
      siteBox.hidden = true; prodBox.hidden = true; storeBox.hidden = true; areaBtn.hidden = true; mineBtn.hidden = true; watchState.hidden = true; infoDesc.hidden = false;
      walkBtn.hidden = person.walk === false;
    },
    showArmy(army, ctl) {
      info.hidden = army.length === 0;
      if (!army.length) { rosterKey = ''; return; }
      infoId = 0;
      setText(infoName, `${t('hud.soldiers')}: ${army.length}`);
      // portrety jak w klasycznych strategiach: hełm na tarczy w barwie drużyny i pasek zdrowia pod spodem
      roster.hidden = false;
      armyPanel.hidden = false;
      hpLine.hidden = true;
      recruit.hidden = true;
      towerBox.hidden = true;
      gateBox.hidden = true;
      powerBox.hidden = true;
      siteBox.hidden = true; prodBox.hidden = true; storeBox.hidden = true; areaBtn.hidden = true; mineBtn.hidden = true; watchState.hidden = true;
      walkBtn.hidden = true;
      // typy jednostek: przycisk na każdy typ z liczbą zaznaczonych
      const byKind = new Map<string, { name: string; n: number }>();
      for (const u of army) { const k = u.kind ?? 'spearman'; const c = byKind.get(k) ?? { name: u.name, n: 0 }; c.n++; byKind.set(k, c); }
      for (const [k, v] of byKind) {
        let kb = kindBtns.get(k);
        if (!kb) {
          const b = el('button', 'army-kind');
          b.type = 'button';
          b.title = tx('Kliknij: zostaw zaznaczonych tylko tych. Shift + klik: odznacz ich.', 'Click: keep only these selected. Shift + click: deselect them.');
          const pic = el('span', 'army-kind-pic');
          pic.innerHTML = k === 'archer' ? ARCHER_PORTRAIT : PORTRAIT;
          const n = el('span', 'army-kind-n');
          b.append(pic, el('span', 'army-kind-name', v.name), n);
          b.addEventListener('click', (e) => events.onArmyKind(k, e.shiftKey));
          kindsRow.append(b);
          kb = { b, n };
          kindBtns.set(k, kb);
        }
        kb.b.hidden = false;
        setText(kb.n, String(v.n));
      }
      for (const [k, kb] of kindBtns) if (!byKind.has(k)) kb.b.hidden = true;
      formBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.form ?? 0))));
      stanceBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.stance ?? -1))));
      marchBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.march ?? 0))));
      patrolBtn!.setAttribute('aria-pressed', String((ctl?.patrol ?? 0) > 0));
      setText(patrolBtn!, ctl?.patrol === 2 ? tx('Wskaż punkt…', 'Mark a point…') : ctl?.patrol === 1 ? tx('Na patrolu', 'On patrol') : tx('Patrol (P)', 'Patrol (P)'));
      setText(infoName, `${t('hud.soldiers')}: ${army.length}${ctl?.group ? ` · ${tx('grupa', 'group')} ${ctl.group}` : ''}`);
      // portrety odświeżamy tylko, gdy coś się zmieniło (przebudowa co klatkę gubiła kliknięcia)
      const key = army.slice(0, 24).map((u) => `${u.id}:${Math.round((u.hp / u.max) * 20)}`).join() + army.length;
      if (key !== rosterKey) {
        rosterKey = key;
        roster.replaceChildren(...army.slice(0, 24).map((u) => {
          const card = el('button', 'roster-card');
          card.type = 'button';
          card.title = tx(`${u.name}. Klik: odznacz. Shift + klik: zostaw tylko jego.`, `${u.name}. Click: deselect. Shift + click: keep only him.`);
          card.setAttribute('aria-label', tx(`${u.name}, zdrowie ${Math.round((u.hp / u.max) * 100)}%`, `${u.name}, health ${Math.round((u.hp / u.max) * 100)}%`));
          if (u.id) { const id = u.id; card.addEventListener('click', (e) => events.onArmyUnit(id, e.shiftKey)); }
          card.innerHTML = u.kind === 'archer' ? ARCHER_PORTRAIT : PORTRAIT;
          const bar = el('span', 'roster-hp');
          const fill = el('span');
          fill.style.width = `${Math.round((u.hp / u.max) * 100)}%`;
          bar.append(fill);
          card.append(bar);
          return card;
        }));
        if (army.length > 24) roster.append(el('span', 'roster-more', `+${army.length - 24}`));
      }
      const counts = new Map<string, number>();
      for (const u of army) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
      setText(infoDesc, [...counts].map(([n, k]) => `${n} × ${k}`).join(', '));
      infoWorker.hidden = false;
      setText(infoWorker, t('hud.orderHint'));
      demolish.hidden = true;
      trainBtn.hidden = true;
      trainNote.hidden = true;
    },
    showInfo(i) {
      walkBtn.hidden = true;
      info.hidden = !i;
      if (!i) return;
      infoId = i.id;
      roster.hidden = true; armyPanel.hidden = true;
      setText(infoName, t(i.def.name));
      hpLine.hidden = i.hp === undefined;
      if (i.hp !== undefined && i.maxHp) { setText(hpText, `${t('hud.hp')}: ${i.hp} / ${i.maxHp}`); hpFill.style.width = `${Math.max(0, (i.hp / i.maxHp) * 100)}%`; hpFill.dataset.low = String(i.hp < i.maxHp * 0.35); }
      setText(infoDesc, t(`d.${i.def.id}`));
      infoWorker.hidden = !i.def.production || !!i.prod;
      prodBox.hidden = !i.prod;
      if (i.prod) {
        const pd = i.prod;
        // przepis: [surowiec] → [towar], czas roboty i miejsce
        const key = JSON.stringify(pd.recipe ?? null);
        if (prodRecipe.dataset.key !== key) {
          prodRecipe.dataset.key = key;
          prodRecipe.hidden = !pd.recipe;
          if (pd.recipe) {
            const r = pd.recipe;
            const chip = (id: string, n: number, name: string): HTMLElement => { const c = el('span', 'prod-chip'); c.title = name; c.append(icon(id), el('strong', '', `${n}`), el('span', '', name)); return c; };
            const line = el('div', 'prod-line');
            if (r.input) line.append(chip(r.input.id, r.input.n, r.input.name), el('span', 'prod-arrow', '→'));
            line.append(chip(r.output.id, r.output.n, r.output.name));
            prodRecipe.replaceChildren(line, el('p', 'prod-note', tx(`Robota: ${r.secs} s${r.place ? ` ${r.place}` : ''} (bez chodzenia po surowiec i do składu)`, `Work: ${r.secs} s${r.place ? ` ${r.place}` : ''} (not counting walks for materials and to the stockpile)`)));
          }
        }
        prodWorker.hidden = !pd.worker;
        if (pd.worker) {
          setText(prodWho, `${pd.worker.name || t('hud.worker')} — ${pd.worker.doing}${pd.worker.pct !== undefined ? ` (${pd.worker.pct}%)` : ''}`);
          prodBar.hidden = pd.worker.pct === undefined;
          prodFill.style.width = `${pd.worker.pct ?? 0}%`;
        }
        setText(prodStatus, pd.status.text);
        prodStatus.dataset.level = pd.status.level;
        const row = (label: string, value: string, warn = false): HTMLElement => { const r = el('p', 'site-row'); r.append(el('span', '', label), el('strong', warn ? 'warn' : '', value)); return r; };
        const out = pd.recipe?.output.name ?? tx('towaru', 'goods');
        const rows: HTMLElement[] = [];
        if (pd.recipe) {
          rows.push(row(tx('Zrobione od postawienia', 'Made since built'), `${pd.made}`));
          rows.push(row(tx('W ostatniej dobie', 'In the last day'), pd.day === undefined ? tx('liczy się…', 'counting…') : `${pd.day}`));
          if (pd.lost) rows.push(row(tx('Przepadło (pełny skład)', 'Lost (stockpile full)'), `${pd.lost}`, true));
          if (pd.stockOut !== undefined) rows.push(row(`${tx('Na stanie', 'In stock')}: ${out}`, `${pd.stockOut}`));
          if (pd.recipe.input && pd.stockIn !== undefined) rows.push(row(`${tx('Na stanie', 'In stock')}: ${pd.recipe.input.name}`, lang() === 'en' ? `${pd.stockIn} (for ${pd.cycles ?? 0} ${pd.cycles === 1 ? 'cycle' : 'cycles'})` : `${pd.stockIn} (na ${pd.cycles ?? 0} ${pd.cycles === 1 ? 'cykl' : 'cykli'})`, (pd.cycles ?? 0) === 0));
        }
        prodRows.replaceChildren(...rows);
      }
      // co produkuje, z czego i jak szybko (czas samej pracy, bez chodzenia po surowiec)
      const pr = i.prod ? undefined : i.def.production;
      if (pr) {
        const secs = Math.round(((pr.workTicks + (pr.processTicks ?? 0)) / 10));
        const from = pr.input ? ` ${t('hud.from')} ${pr.input.amount} × ${t(RESOURCE_DEFS[pr.input.res].name).toLowerCase()}` : '';
        infoWorker.textContent = '';
        infoWorker.append(`${t('hud.makes')}: ${pr.output.amount} × ${t(RESOURCE_DEFS[pr.output.res].name).toLowerCase()}${from}, ${t('hud.every')} ${secs} s`, document.createElement('br'), `${t('hud.worker')}: ${t(i.hasWorker ? 'hud.workerYes' : 'hud.workerNo')}`);
      }
      // skład, stodoła, spichlerz: co leży i ile (zapasy są wspólne dla wszystkich składów danego rodzaju)
      siteBox.hidden = !i.site;
      if (i.site) {
        const st = i.site;
        siteHead.replaceChildren(icon('hammer'), el('strong', '', `${tx('Budowa', 'Construction')}: ${st.pct}%`), el('span', '', ` · ${st.state}`));
        siteFill.style.width = `${st.pct}%`;
        const row = (label: string, value: string): HTMLElement => { const r = el('p', 'site-row'); r.append(el('span', '', label), el('strong', '', value)); return r; };
        siteRows.replaceChildren(
          ...(st.loads ? [row(tx('Materiał na placu', 'Materials on site'), tx(`${st.delivered} / ${st.loads} ładunków`, `${st.delivered} / ${st.loads} loads`)), row(tx('W drodze ze składu', 'On the way from the stockpile'), `${st.carrying + st.fetching}`)] : []),
          row(tx('Robotników przy budowie', 'Builders at work'), `${st.builders}`),
        );
        infoDesc.hidden = true;
        infoWorker.hidden = true;
      } else infoDesc.hidden = false;
      storeBox.hidden = !i.stock?.length;
      if (i.stock?.length) {
        const key = JSON.stringify(i.stock);
        if (storeBox.dataset.key !== key) {
          storeBox.dataset.key = key;
          storeBox.replaceChildren(...i.stock.flatMap((st) => {
            const head = el('p', 'stock-head');
            const label = st.kind === 'granary' ? t('cat.food') : tx('Towary', 'Goods');
            head.append(icon(st.kind === 'granary' ? 'granary' : 'store'), el('strong', '', `${label}: ${st.used} / ${st.max}`), el('span', '', tx(` · ten budynek mieści ${st.here}`, ` · this building holds ${st.here}`)));
            const bar = el('div', 'stock-bar');
            const fillEl = el('span');
            fillEl.style.width = `${Math.min(100, (st.used / Math.max(1, st.max)) * 100)}%`;
            bar.append(fillEl);
            const grid = el('div', 'stock-grid');
            if (!st.items.length) grid.append(el('span', 'stock-empty', tx('Pusto', 'Empty')));
            for (const it of st.items) {
              const cell = el('div', 'stock-item');
              cell.title = t(RESOURCE_DEFS[it.id as keyof typeof RESOURCE_DEFS].name);
              cell.append(icon(it.id), el('strong', '', String(it.amount)), el('span', '', t(RESOURCE_DEFS[it.id as keyof typeof RESOURCE_DEFS].name)));
              grid.append(cell);
            }
            return [head, bar, grid];
          }));
        }
      }
      watchState.hidden = !(i.own && i.watch);
      if (i.watch) {
        const w = i.watch;
        setText(watchState, `${w.label ?? tx('Straż miejska', 'Town watch')}: ${w.have} / ${w.want}` + (w.training ? tx(` · rekrut szkoli się jeszcze ${w.training} s`, ` · recruit in training for ${w.training} s more`) : '') + (w.note && (!w.training || w.label) ? ` · ${w.note}` : '') + tx(' · gdzie są: pinezki na mapie', ' · where they are: pins on the map'));
      }
      towerBox.hidden = !(i.own && i.garrison !== undefined);
      if (i.garrison !== undefined) {
        const wall = i.def.id === 'stoneWall';
        setText(towerState, i.garrison ? `${wall ? tx('Na murze', 'On the wall') : tx('Na wieży', 'On the tower')}: ${i.garrison} / ${i.garrisonMax ?? (wall ? 2 : 4)} ${tx('łuczników', 'archers')}` : wall ? tx('Nikogo na murze. Zaznacz łuczników i kliknij mur prawym przyciskiem — wejdą po drabinie.', 'No one on the wall. Select archers and right-click the wall — they will climb the ladder.') : tx('Wieża pusta. Zaznacz łuczników i kliknij wieżę prawym przyciskiem.', 'The tower is empty. Select archers and right-click the tower.'));
        tSel.disabled = tDown.disabled = !i.garrison;
      }
      powerBox.hidden = !(i.own && i.power);
      if (i.power) {
        powerOn = i.power.on;
        setText(powerBtn, i.power.on ? tx('Wyłącz budynek', 'Shut down building') : tx('Włącz budynek', 'Start up building'));
        setText(powerState, i.power.on ? tx('Działa — wyłącz, a pracownik pójdzie do innej roboty', 'Working — shut it down and the worker will find other work') : i.power.worker ? tx('Wyłączony', 'Shut down') : tx('Wyłączony — pracownik poszedł do innej roboty', 'Shut down — the worker has gone to other work'));
        powerState.dataset.shut = String(!i.power.on);
      }
      gateBox.hidden = !(i.own && i.gate);
      if (i.gate) {
        gateWant = i.gate.open;
        setText(gateBtn, i.gate.open ? tx('Zamknij bramę', 'Close the gate') : tx('Otwórz bramę', 'Open the gate'));
        setText(gateState, i.gate.shut ? (i.gate.open ? tx('Zamknięta — wróg w pobliżu, otworzy się sama', 'Shut — enemy nearby, it will reopen by itself') : tx('Zamknięta', 'Shut')) : tx('Otwarta — swoi przechodzą', 'Open — your people pass through'));
        gateState.dataset.shut = String(i.gate.shut);
      }
      demolish.hidden = !i.own || !i.def.buildable;
      areaBtn.hidden = i.area === undefined;
      mineBtn.hidden = !(i.own && i.def.id === 'oremine');
      const shot = i.def.id === 'watchtower' || i.def.id === 'stoneTower';
      setText(areaBtn, shot ? (i.area ? tx('Ukryj zasięg strzału', 'Hide firing range') : tx('Pokaż zasięg strzału', 'Show firing range')) : i.area ? tx('Ukryj teren pracy', 'Hide work area') : tx('Pokaż teren pracy', 'Show work area'));
      areaBtn.setAttribute('aria-pressed', String(!!i.area));
      trainBtn.hidden = true;
      trainNote.hidden = true;
      recruit.hidden = !(i.own && i.recruit);
      if (i.own && i.recruit) {
        lastRecruit = i.recruit;
        drawRecruit();
      }
    },
    stepSpeed,
    setSpeed: (sp: number) => { const i = SPEEDS.indexOf(sp); if (i >= 0) { speedIndex = i; showSpeed(); } },
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

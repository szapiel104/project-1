import { me, onAccount } from '../net/supa';
import { avatarSvg } from './avatars';
import { BUILD_GROUPS } from './buildGroups';
import { createArmyControls } from './armyControls';
import { createSpellBar, type SpellBar } from './spellBar';
import { renderLogistics, type StoreLogistics } from './storePanel';
import { BUILDINGS, CATEGORIES, isTower, type BuildingDef, type CategoryId } from '../data/buildings';
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
  /** Przenosiny budynku za rudę: następny klik na mapie wskazuje nowe miejsce */
  onRelocate(id: number): void;
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
  onQuarantine(building: number, on: boolean): void;
  onDismount(building: number): void;
  onWalk(): void;
  /** Oko: spacer oczami losowego mieszkańca */
  onRandomWalk(): void;
  /** Pokaż / ukryj teren pracy budynku (zielony kwadrat) */
  onArea(building: number): void;
  /** Kopalnia: wejście do sztolni (spacer w osobnej lokacji) */
  onEnterMine(building: number): void;
  /** Bunt głodowy (okno twierdzy): rozdaj chleb tłumowi albo każ straży rozpędzić go siłą */
  onDole(): void;
  onQuell(): void;
  onSelectGarrison(building: number): void;
  /** Skrót w dolnym pasku: kamera do koszar albo składu (kolejne kliknięcia przechodzą po kolejnych budynkach) */
  onJump(kind: JumpKind): void;
}

export interface HudView {
  /** Rozpiska popularności (składniki z plusem i minusem) i ludności (kto co robi) */
  report?: { popularity: { label: string; value: number; note?: string }[]; people: { label: string; value: number }[]; army: { label: string; value: number }[]; food: { label: string; value: string; note?: string; sign?: 'plus' | 'minus' }[]; foodHint: string };
  soldiers?: number;
  /** Ile własnych koszar i składów stoi na mapie (skróty w pasku; 0 = przycisk nieczynny) */
  jumps?: Record<JumpKind, number>;
  res: ArrayLike<number>;
  /** Zmiana zapasu każdego surowca w ciągu ostatniej minuty gry */
  trend: ArrayLike<number>;
  pop: number;
  housing: number;
  popularity: number;
  day: number;
  /** Pora roku i temperatura (°C) */
  weather?: { season: string; temp: number; /** burza albo susza (storms.ts) */ note?: string };
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
  locked: Map<string, { need: string; building: boolean; tier?: number }>;
  /** Cena następnego budynku każdego rodzaju (z dopłatą za kolejne takie same) */
  costs: Map<string, Partial<Record<ResourceId, number>>>;
}

/** Zapasy jednego rodzaju składu: ile mieści ten budynek, ile jest razem i co leży (z ikonami) */
/** Okno magazynu: `here` — pojemność tego budynku, `hereUsed` i `items` — co leży w nim samym; `used`/`max` — suma ze wszystkich `stores` magazynów tego rodzaju */
export interface StockInfo { kind: string; here: number; hereUsed: number; used: number; max: number; stores: number; items: { id: string; amount: number }[] }
/** Skróty na dolnym pasku: koszary, skład, spichlerz */
export type JumpKind = 'barracks' | 'stockpile' | 'granary';
export interface BuildingInfo { /** Czyj to budynek: imię gracza albo bota, wróg / sojusznik / twój, kolor drużyny */ owner?: { name: string; rel: 'own' | 'ally' | 'enemy'; color: number }; stock?: StockInfo[]; /** Magazyn: magazynierzy, towar pod drzwiami i czekające warsztaty (storePanel.ts) */ logistics?: StoreLogistics; id: number; def: BuildingDef; hasWorker: boolean; own: boolean; /** Ruina po zniszczeniu (rozbiórka = porzucenie, bez zwrotu) */ ruined?: boolean; /** Przenosiny za rudę: koszt i powód blokady (null = wolno) */ move?: { cost: number; why: string | null }; canTrain?: boolean; hp?: number; maxHp?: number; gate?: { open: boolean; shut: boolean }; power?: { on: boolean; worker: boolean }; /** Chata w czasie zarazy: zamknięta na kwarantannę i ilu chorych leży w środku */ quarantine?: { on: boolean; sick: number }; garrison?: number;
  /** Twierdza: straż miejska (ilu jest, ilu ma być, ile sekund do końca szkolenia rekruta, czy werbunek stoi i dlaczego) */
  watch?: { have: number; want: number; training: number; note?: string; label?: string }; recruit?: RecruitUnit[]; area?: boolean;
  /** Twierdza w czasie buntu: ilu stoi pod bramą, ile porcji kosztuje rozdanie chleba, czy jest z czego, czy straż już rozgania tłum */
  riot?: { count: number; cost: number; food: number; guards: number; quelling: boolean };
  /** Plac budowy: postęp, materiał na placu i w drodze, robotnicy, stan */
  site?: { pct: number; loads: number; delivered: number; carrying: number; fetching: number; builders: number; state: string };
  /** Ilu łuczników mieści wieża / mur */
  garrisonMax?: number;
  /** Warsztat: przepis, pracownik, stan i liczby */
  prod?: ProdInfo }
export interface ProdInfo {
  recipe?: { input?: { id: string; n: number; name: string }; output: { id: string; n: number; name: string }; alts?: { id: string; n: number; name: string; pct: number }[]; secs: number; place: string };
  worker?: { name: string; doing: string; pct?: number };
  status: { text: string; level: 'ok' | 'warn' | 'bad' };
  /** Oddane do składu od postawienia, przepadłe przez pełny skład, tempo z ostatniej doby (brak = za krótko liczone) */
  made: number; lost: number; day?: number;
  /** Na stanie: gotowy towar i surowiec (ile pełnych cykli wystarczy) */
  stockOut?: number; stockIn?: number; cycles?: number;
}
export interface RecruitUnit { id: string; name: string; weapon: string; need?: number; have: number; gear?: { res: string; have: number }; armor?: number; gold: number; idle: number; max: number; cost: number; hp: number; attack: number; range?: number; rally?: boolean; /** Mag bojowy: ilu już jest i ile wolno (limit na gracza) */ magic?: { have: number; cap: number } }

export interface Hud {
  /** Gotowa miniatura budynku (rysowana w tle po starcie): wstawia ją w karty budowy, kategorie i pola magazynów */
  setThumb(id: string, src: string): void;
  /** Pasek czarów zaznaczonych magów (main.ts podpina źródło: chwila gry i zaznaczeni) */
  spells: SpellBar;
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
  setArmyBar(v: { show: boolean; groups: { n: number; count: number; kind?: string }[]; active?: number; selected: { id: number; kind: string; hp: number; max: number; name: string; group?: number }[] }): void;
  showArmy(army: { id?: number; name: string; hp: number; max: number; kind?: string; group?: number }[], ctl?: { form: number; stance: number; march: number; group?: number; patrol?: number }): void;
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
export function needText(lock: { need: string; building: boolean; tier?: number }): string {
  if (lock.tier) return tierNeedText(lock.tier);
  const def = BUILDINGS.find((d) => d.id === lock.need);
  return t(lock.building ? 'hud.needsBuilding' : 'hud.needs').replace('{b}', def ? t(def.name) : lock.need);
}

/** Nazwy etapów osady (indeks = etap) */
export const TIER_NAMES = (): string[] => [tx('Wioska', 'Hamlet'), tx('Osada', 'Village'), tx('Gród', 'Town'), tx('Miasto', 'City')];
/** „Od etapu: Gród (40 ludzi)” — napis na zablokowanej karcie budynku */
export function tierNeedText(tier: number): string {
  return tx(`Od etapu: ${TIER_NAMES()[tier]} (${RULES.tiers[tier]} ludzi)`, `From stage: ${TIER_NAMES()[tier]} (${RULES.tiers[tier]} people)`);
}

function costText(def: BuildingDef, cost: Partial<Record<ResourceId, number>> = def.cost): string {
  const parts = Object.entries(cost).map(([k, v]) => `${t(RESOURCE_DEFS[k as ResourceId].name)}: ${v}`);
  return parts.length ? parts.join(' · ') : t('hud.free');
}

/** Koszt budynku jako rząd ikon z liczbami (krótko, zamiast „Drewno: 33 · Kamień: 44”); pełny opis w title/aria. */
function paintCost(box: HTMLElement, def: BuildingDef, cost: Partial<Record<ResourceId, number>> = def.cost): void {
  const key = JSON.stringify(cost);
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  const full = costText(def, cost);
  box.title = full;
  box.setAttribute('aria-label', full);
  const parts = Object.entries(cost);
  if (!parts.length) { box.replaceChildren(document.createTextNode(t('hud.free'))); return; }
  box.replaceChildren(...parts.map(([k, v]) => {
    const chip = document.createElement('span');
    chip.className = 'cost-chip';
    if (ICONS[k]) {
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.setAttribute('aria-hidden', 'true');
      ico.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16">${ICONS[k]}</svg>`;
      chip.append(ico);
    } else chip.append(document.createTextNode(`${t(RESOURCE_DEFS[k as ResourceId].name).slice(0, 4)}. `));
    chip.append(document.createTextNode(String(v)));
    return chip;
  }));
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
  // miecz: głownia ze zbroczem, jelec, rękojeść ze skórą
  sword: '<path d="M10 2l1.3 2v9h-2.6V4z" fill="#c4c9d0" stroke="#2a1c10" stroke-width=".8"/><path d="M10 4v9" stroke="#7d838c" stroke-width=".7"/><path d="M5.5 13h9v1.6h-9z" fill="#8f8a96" stroke="#2a1c10" stroke-width=".8"/><path d="M9 14.6h2v2.6H9z" fill="#6b4a2e" stroke="#2a1c10" stroke-width=".7"/><circle cx="10" cy="18.1" r="1.1" fill="#8f8a96" stroke="#2a1c10" stroke-width=".7"/>',
  // kolczuga: tułów z rękawami w rzędach kółek
  armor: '<path d="M6 3h8l4 4-2 2-2-1v9H6V8L4 9 2 7z" fill="#8f949c" stroke="#2a1c10" stroke-width=".9"/><path d="M6.3 10.5h7.4M6.3 13h7.4M6.3 15.5h7.4M7 5.5h6" stroke="#4a4d54" stroke-width=".8"/><path d="M8 3c.5 1.5 3.5 1.5 4 0" fill="#6b4a2e" stroke="#2a1c10" stroke-width=".7"/>',
  // mięso: szynka z kością
  meat: '<path d="M4 9c0-4 5-6 9-4 3 1 4 5 2 8-2 3-7 4-10 1-1-1-1-3-1-5z" fill="#a04a3a" stroke="#2a1c10" stroke-width=".9"/><path d="M14 12l3 3" stroke="#e6dcc2" stroke-width="2.2"/><circle cx="17.5" cy="15.5" r="1.4" fill="#e6dcc2" stroke="#2a1c10" stroke-width=".6"/><path d="M7 9c1-2 3-3 5-2" stroke="#d98a74" fill="none"/>',
  // drabina szturmowa: dwie żerdzie i szczeble
  ladder: '<path d="M6.5 2v16M13.5 2v16" stroke="#7a5232" stroke-width="2"/><path d="M6.5 5h7M6.5 9h7M6.5 13h7M6.5 17h7" stroke="#b08a58" stroke-width="1.6"/>',
  // ostrzeżenie: czerwony trójkąt z wykrzyknikiem (pełny magazyn)
  alert: '<path d="M10 2.5l8 14.5H2z" fill="#c23a2c" stroke="#2a1c10" stroke-width=".9"/><path d="M10 7.5v4.8" stroke="#fff3d6" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.8" r="1.1" fill="#fff3d6"/>',
  crown: '<path d="M3 15l1-9 4 4 2-6 2 6 4-4 1 9z" fill="#e9c145" stroke="#2a1c10"/><rect x="3" y="15" width="14" height="2.5" fill="#c9a23a" stroke="#2a1c10"/>',
  store: '<rect x="3" y="6" width="14" height="10" fill="#a8743a" stroke="#2a1c10"/><path d="M3 6l2-3h10l2 3M3 11h14M10 6v10" stroke="#2a1c10" fill="none"/>',
  granary: '<path d="M4 9l6-5 6 5v8H4z" fill="#c9a24a" stroke="#2a1c10"/><rect x="8" y="12" width="4" height="5" fill="#5e4329" stroke="#2a1c10"/>',
  pop: '<circle cx="10" cy="6" r="3" fill="#e2bd94" stroke="#2a1c10"/><path d="M4 18c0-5 3-8 6-8s6 3 6 8z" fill="#a8281f" stroke="#2a1c10"/>',
  // bez pracy: ognisko jak w Twierdzy — tam wolni chłopi czekają na robotę
  idle: '<path d="M3 17.5l14-3.5M3 14l14 3.5" stroke="#7a5232" stroke-width="2.2" stroke-linecap="round"/><path d="M10 2.5c1.5 2.5 4.5 4.5 4.5 8 0 2.5-2 4-4.5 4s-4.5-1.5-4.5-4c0-2 1-3 1.8-4 .2 1.2.8 2 1.5 2.3C8.5 6.5 9 4.5 10 2.5z" fill="#e0782a" stroke="#2a1c10" stroke-width=".9"/><path d="M10 8c1 1.5 2 2.5 2 4 0 1.2-.9 2-2 2s-2-.8-2-2c0-1.3.9-2.3 2-4z" fill="#f6d36a"/>',
  hammer: '<path d="M9 8l7 9" stroke="#7a5232" stroke-width="2.4" stroke-linecap="round"/><path d="M3 6l5-4 4 4-5 4z" fill="#8a8e96" stroke="#2a1c10"/>',
  // waluta: grudka rudy (jak w Gothicu) — ciemna bryła z jasnoniebieskimi, połyskującymi żyłami
  // kryształ magii: fioletowy, wieloboczny kryształ z jaśniejszym rdzeniem i drobnym odpryskiem obok
  crystal: '<path d="M10 2l4 5-1.5 10h-5L6 7z" fill="#7a52d6" stroke="#1c1430"/><path d="M10 2v15M6 7h8" stroke="#c9b4ff" stroke-width=".9" fill="none"/><path d="M14.5 11l2.5 2-1 4h-2z" fill="#9a7cf0" stroke="#1c1430" stroke-width=".8"/><circle cx="9" cy="8" r=".9" fill="#efe6ff"/>',
  gold: '<path d="M3 13l2-6 5-3 5 2 2 6-3 4H6z" fill="#4a4e5c" stroke="#16141c"/><path d="M6 8l3 2 2-3M9 10l-1 4M11 7l3 3 1 4M12 12l-3 2" stroke="#8fd3ff" stroke-width="1.1" fill="none"/><circle cx="9" cy="10" r="1" fill="#d9f2ff"/><circle cx="14" cy="10" r=".8" fill="#d9f2ff"/>',
};

/** Liczba z odstępami tysięcy (1 000 000), żeby duże pojemności dało się przeczytać */
function num(n: number): string { return n.toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL'); }

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

// najwyżej 3× (Michał 28.10.2026: 5× zdjęte)
const SPEEDS = [0, 1, 2, 3];

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

// zbrojny: hełm z nosalem, czepiec kolczy, wapenrok i ciężkie naramienniki, miecz przy boku
const MANATARMS_PORTRAIT = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
  <rect width="32" height="32" fill="#2a2420"/>
  <path d="M4 32c0-7 4-10 12-10s12 3 12 10z" fill="#7d828a" stroke="#1c120a"/>
  <path d="M11 32V24h10v8z" fill="#a32a22" stroke="#1c120a"/>
  <path d="M3 24c1-3 4-4 7-3l-1 5zM29 24c-1-3-4-4-7-3l1 5z" fill="#5a5f68" stroke="#1c120a"/>
  <path d="M9 22c0-4 2-6 7-6s7 2 7 6z" fill="#8c929c" stroke="#1c120a"/>
  <circle cx="16" cy="15" r="5.2" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M10 13c0-7 12-7 12 0z" fill="#9aa0a8" stroke="#1c120a"/><path d="M9.6 13h12.8" stroke="#5a5f68" stroke-width="1.6"/>
  <path d="M16 13v5" stroke="#5a5f68" stroke-width="1.4"/>
  <path d="M27 8v16" stroke="#c4c9d0" stroke-width="1.6"/><path d="M25 22h4" stroke="#5c5a60" stroke-width="1.4"/>
</svg>`;
// saper: skórzany kaptur i kaftan, kilof na ramieniu
const SAPPER_PORTRAIT = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
  <rect width="32" height="32" fill="#2f2419"/>
  <path d="M5 32c0-7 4-10 11-10s11 3 11 10z" fill="#6b4a2c" stroke="#1c120a"/>
  <path d="M10 25h12M16 22v10" stroke="#3e2a18" stroke-width="1.4"/>
  <circle cx="16" cy="15" r="5.5" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M9.5 17c-1-8 13-8 13 0l-1.5-4c-2-3-8-3-10 0z" fill="#5a3e24" stroke="#1c120a"/>
  <path d="M6 28L26 5" stroke="#7a5a36" stroke-width="2"/><path d="M21 3c3 0 6 2 7 5l-4-2-4 1z" fill="#8f949c" stroke="#1c120a" stroke-width=".8"/>
</svg>`;
/** Portret do karty jednostki: włócznik jako domyślny */
/** Numer grupy w rogu portretu (złota cyfra, jak nad oddziałem na mapie) */
const groupBadge = (card: HTMLElement, n: number | undefined): void => {
  if (!n) return;
  const b = document.createElement('span');
  b.className = 'roster-grp';
  b.textContent = String(n);
  card.append(b);
};
const portraitOf = (kind: string | undefined): string => (kind === 'archer' ? ARCHER_PORTRAIT : kind === 'manatarms' ? MANATARMS_PORTRAIT : kind === 'sapper' || kind === 'ladderman' ? SAPPER_PORTRAIT : PORTRAIT);

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
  const SECOND: readonly ResourceId[] = ['iron', 'ale', 'spear', 'bow', 'sword', 'armor', 'ladder', 'bread', 'apples', 'wheat', 'flour', 'fish', 'meat'];
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
    if (!src) { const i = icon(fallback); i.dataset.thumbFor = id; return i; }   // obrazek dojdzie później (setThumb)
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
  // skróty: obrazek koszar, składu i spichlerza; klik przenosi kamerę do budynku i otwiera jego okno
  const jumpBox = el('div', 'jumps');
  jumpBox.setAttribute('role', 'group');
  jumpBox.setAttribute('aria-label', tx('Skróty do budynków', 'Building shortcuts'));
  const jumpBtn = (kind: JumpKind, fallback: string): HTMLButtonElement => {
    const b = el('button', 'jump');
    b.type = 'button';
    b.append(pic(kind, fallback));
    b.addEventListener('click', () => events.onJump(kind));
    jumpBox.append(b);
    return b;
  };
  const jumpBarracks = jumpBtn('barracks', 'barracks');
  const jumpStock = jumpBtn('stockpile', 'store');
  const jumpGranary = jumpBtn('granary', 'granary');
  let jumpKey = '';
  const paintJumps = (j: Record<JumpKind, number>): void => {
    const key = `${j.barracks}:${j.stockpile}:${j.granary}`;
    if (key === jumpKey) return;
    jumpKey = key;
    const set = (b: HTMLButtonElement, n: number, name: string, none: string): void => {
      b.disabled = !n;
      const label = n ? (n > 1 ? tx(`${name} (${n}): pokaż. Kolejny klik — następny budynek.`, `${name} (${n}): show. Click again for the next one.`) : tx(`${name}: pokaż na mapie`, `${name}: show on the map`)) : none;
      b.title = label;
      b.setAttribute('aria-label', label);
    };
    set(jumpBarracks, j.barracks, tx('Koszary', 'Barracks'), tx('Nie masz jeszcze koszar', 'You have no barracks yet'));
    set(jumpStock, j.stockpile, tx('Skład', 'Stockpile'), tx('Nie masz jeszcze składu', 'You have no stockpile yet'));
    set(jumpGranary, j.granary, tx('Spichlerz', 'Granary'), tx('Nie masz jeszcze spichlerza', 'You have no granary yet'));
  };
  paintJumps({ barracks: 0, stockpile: 0, granary: 0 });
  people.append(jumpBox, stockBox, foodBox, popBox, armyBox, idleBox, popularBox);
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
    // okno stoi na dolnej belce (bez przerwy), także gdy w tym samym rzędzie jest pasek grup wojska
    const dockEl = root.querySelector<HTMLElement>('.dock');
    if (dockEl) {
      const mb = parseFloat(info.style.marginBottom || '0') || 0;
      const rowBottom = r.bottom + mb * k;
      const want = Math.round((rowBottom - (dockEl.getBoundingClientRect().top + 2 * k)) / k);
      if (Math.abs(want - mb) >= 1) { info.style.marginBottom = `${want}px`; requestAnimationFrame(fitInfo); return; }
    }
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
  // okno po prawej zasłaniało minimapę — gdy jest otwarte, minimapa się chowa (CSS: body.info-open)
  new MutationObserver(() => { document.body.classList.toggle('info-open', !info.hidden); if (!info.hidden) requestAnimationFrame(fitInfo); }).observe(info, { attributes: true, attributeFilter: ['hidden'] });
  const infoName = el('p', 'info-name');
  // kto jest właścicielem klikniętego budynku (zwłaszcza cudzej twierdzy): imię w kolorze drużyny i wróg / sojusznik
  const ownerLine = el('p', 'info-owner');
  ownerLine.hidden = true;
  const infoDesc = el('p', 'info-desc');
  const infoWorker = el('p');
  const infoActions = el('div', 'actions');
  const demolish = el('button', 'btn-danger', t('hud.demolish'));
  demolish.type = 'button';
  const close = el('button', 'btn-plain', t('hud.close'));
  close.type = 'button';
  const moveBtn = el('button', 'btn-plain', t('hud.relocate'));
  moveBtn.type = 'button'; moveBtn.hidden = true;
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
  const PORTRAITS: Record<string, string> = { spearman: PORTRAIT, archer: ARCHER_PORTRAIT, ram: RAM_PORTRAIT, manatarms: MANATARMS_PORTRAIT, sapper: SAPPER_PORTRAIT, ladderman: SAPPER_PORTRAIT, mageFire: ARCHER_PORTRAIT, mageWater: ARCHER_PORTRAIT };
  const drawRecruit = (): void => {
    // koszary i siedziby magów mają różne karty: widać tylko te, które szkoli otwarty budynek
    for (const [id, c] of unitCards) c.card.hidden = !lastRecruit.some((r) => r.id === id);
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
      setText(c.stats, `${t('hud.hp')} ${r.hp} · ${r.attack ? `${t('hud.attack')} ${r.attack}` : tx('nie walczy, rozbiera wrogie ruiny', 'does not fight, strips enemy ruins')}${r.range ? ` · ${tx('zasięg', 'range')} ${r.range}` : ''}${r.armor ? ` · ${tx('zbroja', 'armour')} ${r.armor}%` : ''}`);
      const row = (icon: string, have: number, need: number): string => `<span class="need${have < need ? ' short' : ''}"><svg viewBox="0 0 20 20" width="22" height="22">${ICONS[icon] ?? ''}</svg><strong>${need}</strong><em>(${have})</em></span>`;
      c.needs.innerHTML = r.magic
        ? row('gold', r.gold, r.cost) + (r.gear ? row(r.gear.res, r.gear.have, 1) : '') + row('idle', r.idle, 1) + `<span class="need${r.magic.have >= r.magic.cap ? ' short' : ''}">${tx(`magów ${r.magic.have} / ${r.magic.cap}`, `mages ${r.magic.have} / ${r.magic.cap}`)}</span>`
        : row(r.weapon, r.have, r.need ?? 1) + (r.gear ? row(r.gear.res, r.gear.have, 1) : '') + row('gold', r.gold, r.cost) + row('idle', r.idle, 1);
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
  // szyk, marsz, postawa i patrol jako ikony z dymkami; opis i skróty zwinięte pod spodem (armyControls.ts)
  const armyCtl = createArmyControls({ form: (i) => events.onArmyForm(i), march: (i) => events.onArmyMarch(i), stance: (i) => events.onArmyStance(i), patrol: () => events.onArmyPatrol() });
  // czary zaznaczonych magów: zwykły i wielki, z odnowieniem jak w grach RPG (spellBar.ts)
  const spellBar = createSpellBar();
  armyPanel.append(kindsRow, spellBar.root, armyCtl.root);
  armyCtl.help.hidden = true;
  /** Chowa okno wojska; opis i skróty zwijają się, żeby przy następnym zaznaczeniu znów zajmowały mało miejsca */
  const hideArmy = (): void => { armyPanel.hidden = true; armyCtl.help.hidden = true; armyCtl.collapse(); info.classList.remove('army-mode'); };
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
  // czytelnie: po lewej stan (zielona albo czerwona kropka i słowo), po prawej mały przełącznik, pod spodem co to zmienia
  const powerBox = el('div', 'power-row-box');
  const powerRow = el('div', 'power-row');
  const powerBadge = el('span', 'power-badge');
  powerBadge.setAttribute('role', 'status');
  const powerBtn = el('button', 'btn-plain power-btn');
  powerBtn.type = 'button';
  const powerState = el('p', 'power-note');
  let powerOn = true;
  powerBtn.addEventListener('click', () => events.onPower(infoId, !powerOn));
  powerRow.append(powerBadge, powerBtn);
  powerBox.append(powerRow, powerState);
  powerBox.hidden = true;
  // kwarantanna chaty w czasie zarazy: zdrowi śpią gdzie indziej, chorzy leżą tutaj, zaraza nie wychodzi za drzwi
  const quarBox = el('div', 'gate-box power-box');
  const quarBtn = el('button', 'btn-main gate-btn');
  quarBtn.type = 'button';
  const quarState = el('p', 'gate-state');
  let quarOn = false;
  quarBtn.addEventListener('click', () => events.onQuarantine(infoId, !quarOn));
  quarBox.append(quarBtn, quarState);
  quarBox.hidden = true;
  // wieża: ilu łuczników stoi na pomoście, zaznacz ich albo każ zejść
  const towerBox = el('div', 'gate-box');
  const towerState = el('p', 'gate-state');
  const towerBtns = el('div', 'actions');
  const tSel = el('button', 'btn-main', tx('Zaznacz stojących na wieży', 'Select the men on the tower')); tSel.type = 'button';
  const tDown = el('button', 'btn-main', tx('Zejdźcie z wieży', 'Come down from the tower')); tDown.type = 'button';
  tSel.addEventListener('click', () => events.onSelectGarrison(infoId));
  tDown.addEventListener('click', () => events.onDismount(infoId));
  towerBtns.append(tSel, tDown);
  towerBox.append(towerState, towerBtns);
  towerBox.hidden = true;
  // twierdza w czasie buntu: tłum pod bramą i dwa wyjścia — chleb albo pałki straży
  const riotBox = el('div', 'gate-box riot-box');
  const riotState = el('p', 'gate-state');
  const riotBtns = el('div', 'actions');
  const doleBtn = el('button', 'btn-main', ''); doleBtn.type = 'button';
  const quellBtn = el('button', 'btn-main', ''); quellBtn.type = 'button';
  doleBtn.addEventListener('click', () => events.onDole());
  quellBtn.addEventListener('click', () => events.onQuell());
  riotBtns.append(doleBtn, quellBtn);
  riotBox.append(riotState, riotBtns);
  riotBox.hidden = true;
  // twierdza: straż miejska
  const watchState = el('p', 'gate-state');
  watchState.hidden = true;
  const walkBtn = el('button', 'btn-main walk-btn', tx('Przejdź się jego oczami (F)', 'Walk in his shoes (F)')); walkBtn.type = 'button'; walkBtn.hidden = true;
  walkBtn.addEventListener('click', () => events.onWalk());
  const areaBtn = el('button', 'btn-plain area-btn', tx('Pokaż teren pracy', 'Show work area')); areaBtn.type = 'button'; areaBtn.hidden = true;
  // kopalnia: przejście do sztolni oczami chłopa (osobna lokacja pod ziemią)
  const mineBtn = el('button', 'btn-main walk-btn', tx('Wejdź do kopalni', 'Enter the mine')); mineBtn.type = 'button'; mineBtn.hidden = true;
  mineBtn.addEventListener('click', () => events.onEnterMine(infoId));
  areaBtn.addEventListener('click', () => events.onArea(infoId));
  infoActions.append(areaBtn, moveBtn, demolish, close);
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
  const logiBox = el('div', 'info-logi');
  logiBox.hidden = true;
  info.append(infoName, ownerLine, hpLine, riotBox, gateBox, powerBox, quarBox, towerBox, watchState, walkBtn, mineBtn, recruit, armyPanel, roster, armyCtl.help, siteBox, prodBox, storeBox, logiBox, infoDesc, infoWorker, trainBtn, trainNote, infoActions);
  let infoId = 0;
  demolish.addEventListener('click', () => events.onDemolish(infoId));
  moveBtn.addEventListener('click', () => events.onRelocate(infoId));
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
  // kółko myszy nad kartami przewija je w bok, gdy się nie mieszczą
  cards.addEventListener('wheel', (e) => {
    if (cards.scrollWidth <= cards.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    cards.scrollLeft += e.deltaY;
  }, { passive: false });
  const catButtons = new Map<CategoryId, HTMLButtonElement>();
  const buildButtons = new Map<string, HTMLButtonElement>();
  let picked: string | null = null;
  let category: CategoryId | null = null;
  const showCategory = (id: CategoryId | null): void => {
    category = id;
    for (const [cid, b] of catButtons) b.setAttribute('aria-expanded', String(cid === id));
    for (const [bid, b] of buildButtons) b.hidden = BUILDINGS.find((d) => d.id === bid)?.category !== id;
    for (const g of groupEls) g.el.hidden = g.cat !== id;
    cards.hidden = id === null;
    syncPicker();
  };
  // panel z kartami wyskakuje nad paskiem narzędzi tylko wtedy, gdy jest co pokazać
  // otwarty pasek budowy zajmuje całą szerokość: grupy wojska i minimapa chowają się (CSS: body.build-open), a po zamknięciu wracają w tym stanie, w jakim były
  const syncPicker = (): void => { buildbar.hidden = cards.hidden && buildFoot.hidden; document.body.classList.toggle('build-open', !cards.hidden); };
  const CAT_ICON: Record<string, string> = { settlement: 'house', food: 'farm', industry: 'woodcutter', military: 'barracks', defense: 'watchtower', roads: 'roadStone' };
  for (const id of CATEGORIES) {
    const b = el('button', 'cat');
    const src = thumbs.get(CAT_ICON[id] ?? '');
    // bez obrazka (miniatury jeszcze się rysują w tle) — puste miejsce, setThumb wstawi go później
    { const img = el('img'); if (src) img.src = src; else img.hidden = true; img.dataset.thumb = CAT_ICON[id] ?? ''; img.alt = ''; img.width = 34; img.height = 34; img.draggable = false; b.append(img); }
    b.append(el('span', 'cat-name', t(`cat.${id}`)));
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', cards.id);
    b.dataset.cat = id;
    b.addEventListener('click', () => showCategory(category === id ? null : id));
    catButtons.set(id, b);
    cats.append(b);
  }
  for (const def of BUILDINGS) {
    if (!def.buildable || def.legacy) continue; // kamieniołom i kopalnia żelaza zastąpione kopalnią pod górami
    const b = el('button', 'card');
    b.type = 'button';
    b.title = t(`d.${def.id}`);
    b.dataset.build = def.id;
    b.setAttribute('aria-pressed', 'false');
    const src = thumbs.get(def.id);
    {
      const img = el('img');
      if (src) img.src = src; else img.hidden = true;
      img.dataset.thumb = def.id;
      img.alt = ''; img.width = 72; img.height = 72; img.draggable = false;
      b.append(img);
    }
    const text = el('span', 'card-text');
    const need = el('span', 'build-need');
    need.hidden = true;
    const costBox = el('span', 'build-cost');
    paintCost(costBox, def);
    text.append(el('span', 'build-name', t(def.name)), costBox, need);
    b.append(text);
    b.addEventListener('click', () => events.onPickBuilding(picked === def.id ? null : def.id));
    buildButtons.set(def.id, b);
  }
  // karty ułożone w grupy po funkcji (buildGroups.ts), z podpisem nad każdą grupą; budynek bez grupy trafia do „Inne”
  const groupEls: { cat: CategoryId; el: HTMLElement }[] = [];
  const addGroup = (cat: CategoryId, label: string, ids: readonly string[]): void => {
    const list = ids.map((id) => buildButtons.get(id)).filter((b): b is HTMLButtonElement => !!b);
    if (!list.length) return;
    const box = el('div', 'card-group');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', label);
    const row = el('div', 'card-row');
    row.append(...list);
    box.append(el('span', 'card-group-name', label), row);
    cards.append(box);
    groupEls.push({ cat, el: box });
  };
  const grouped = new Set(BUILD_GROUPS.flatMap((g) => g.ids));
  for (const g of BUILD_GROUPS) addGroup(g.cat, tx(g.pl, g.en), g.ids);
  for (const cat of CATEGORIES) addGroup(cat, tx('Inne', 'Other'), [...buildButtons.keys()].filter((id) => !grouped.has(id) && BUILDINGS.find((d) => d.id === id)?.category === cat));

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
  // grupy 1–0 można zwinąć do jednego przycisku (stan zapamiętany w przeglądarce)
  const slotsToggle = el('button', 'army-toggle');
  slotsToggle.type = 'button';
  slotsToggle.setAttribute('aria-controls', 'army-slots');
  slotsWrap.id = 'army-slots';
  let slotsOpen = true;
  try { slotsOpen = localStorage.getItem('project1.armyOpen') !== '0'; } catch { /* bez pamięci przeglądarki */ }
  const paintSlotsToggle = (): void => {
    slotsWrap.hidden = !slotsOpen;
    slotsToggle.setAttribute('aria-expanded', String(slotsOpen));
    const label = slotsOpen ? tx('Zwiń grupy wojska', 'Fold army groups') : tx('Pokaż grupy wojska (1–0)', 'Show army groups (1–0)');
    slotsToggle.title = label;
    slotsToggle.setAttribute('aria-label', label);
    slotsToggle.innerHTML = slotsOpen
      ? '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12.5 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>'
      : `<span class="army-toggle-n">1–0</span><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
  };
  slotsToggle.addEventListener('click', () => { slotsOpen = !slotsOpen; try { localStorage.setItem('project1.armyOpen', slotsOpen ? '1' : '0'); } catch { /* jw. */ } paintSlotsToggle(); });
  paintSlotsToggle();
  const slotsBox = el('div', 'army-groups');
  slotsBox.append(slotsWrap, slotsToggle);
  armyBar.append(slotsBox, pickedBox);
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
    setThumb(id, src) {
      thumbs.set(id, src);
      root.querySelectorAll<HTMLImageElement>(`img[data-thumb="${id}"]`).forEach((img) => { img.src = src; img.hidden = false; });
      root.querySelectorAll<HTMLElement>(`[data-thumb-for="${id}"]`).forEach((old) => { const img = el('img', 'store-pic'); img.src = src; img.alt = ''; old.replaceWith(img); });
    },
    spells: spellBar,
    setArmyBar(v) {
      armyBar.hidden = !v.show;
      if (!v.show) return;
      for (const sl of slots) {
        const g = v.groups.find((x) => x.n === sl.n);
        const count = g?.count ?? 0;
        const kind = count ? g?.kind ?? 'spearman' : '';
        if (sl.kind !== kind) { sl.kind = kind; sl.pic.innerHTML = kind ? portraitOf(kind) : ''; }
        setText(sl.count, count ? String(count) : '');
        sl.b.classList.toggle('empty', !count);
        sl.b.setAttribute('aria-pressed', String(v.active === sl.n));
        const label = count ? tx(`Grupa ${sl.n}: ${count}. Klik: wybierz (dwa razy: kamera). Shift + klik: zapisz zaznaczonych. Prawy klik: wyczyść.`, `Group ${sl.n}: ${count}. Click: select (twice: camera). Shift + click: save selection. Right-click: clear.`) : tx(`Grupa ${sl.n} pusta. Klik albo Shift + ${sl.n}: zapisz zaznaczonych.`, `Group ${sl.n} empty. Click or Shift + ${sl.n}: save selection.`);
        if (sl.b.title !== label) { sl.b.title = label; sl.b.setAttribute('aria-label', label); }
      }
      const key = v.selected.slice(0, 30).map((u) => `${u.id}:${Math.round((u.hp / u.max) * 20)}:${u.group ?? 0}`).join() + v.selected.length;
      if (key === pickedKey) return;
      pickedKey = key;
      pickedBox.replaceChildren(...v.selected.slice(0, 30).map((u) => {
        const card = el('button', 'roster-card');
        card.type = 'button';
        card.title = tx(`${u.name}. Klik: odznacz. Shift + klik: zostaw tylko jego.`, `${u.name}. Click: deselect. Shift + click: keep only him.`);
        card.setAttribute('aria-label', tx(`${u.name}, zdrowie ${Math.round((u.hp / u.max) * 100)}%. Odznacz.`, `${u.name}, health ${Math.round((u.hp / u.max) * 100)}%. Deselect.`));
        card.innerHTML = portraitOf(u.kind);
        const bar = el('span', 'roster-hp');
        const fill = el('span');
        fill.style.width = `${Math.round((u.hp / u.max) * 100)}%`;
        bar.append(fill);
        card.append(bar);
        groupBadge(card, u.group);
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
      if (v.jumps) paintJumps(v.jumps);
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
        setText(weatherVal, `${v.weather.season} · ${tmp < 0 ? '−' : ''}${Math.abs(tmp)}°C${v.weather.note ? ` · ${v.weather.note}` : ''}`);
        weatherVal.dataset.t = tmp <= 0 ? 'frost' : tmp < 8 ? 'cold' : tmp > 25 ? 'hot' : '';
        clockBox.title = `${v.weather.season}, ${lang() === 'en' ? v.weather.temp.toFixed(1) : v.weather.temp.toFixed(1).replace('.', ',')}°C${tmp < 8 ? tx(' — ludzie palą w piecach', ' — folk are lighting their hearths') : ''}${v.weather.note === tx('burza', 'storm') ? tx(' — piorun może podpalić budynek', ' — lightning may set a building alight') : v.weather.note ? tx(' — sady i pola bez studni obok rodzą o połowę mniej', ' — orchards and fields without a well nearby yield half') : ''}`;
      }
      // południe na górze o 12:00, północ o 24:00
      disc.setAttribute('transform', `rotate(${((v.hour - 12) / 24) * 360})`);
      setText(popVal, `${v.pop} / ${v.housing}`);
      setText(idleVal, `${v.idle} / ${v.idleSlots}`);
      idleBox.classList.toggle('full', v.idle >= v.idleSlots);
      setText(stockVal, `${short(v.stock)} / ${short(v.stockCap)}`);
      // bilans: suma zmian zapasów w składach (towary) i w spichlerzach (jedzenie) z ostatniej minuty gry
      let ds = 0, df = 0;
      RESOURCES.forEach((id, i) => { const d = v.trend[i] ?? 0; const st = RESOURCE_DEFS[id].store; if (st === 'stockpile') ds += d; else if (RESOURCE_DEFS[id].food) df += d; });
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
        const def = BUILDINGS.find((d) => d.id === id);
        const costEl = b.querySelector<HTMLElement>('.build-cost');
        if (def && costEl) paintCost(costEl, def, v.costs.get(id));
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
      demolish.hidden = true; moveBtn.hidden = true;
      trainBtn.hidden = true;
      trainNote.hidden = true;
      roster.hidden = true; hideArmy();
      hpLine.hidden = true;
      recruit.hidden = true;
      towerBox.hidden = true;
      gateBox.hidden = true;
      powerBox.hidden = true;
      quarBox.hidden = true;
      // resztki okna budynku (plac budowy, zapasy, zasięg strzału) nie mogą zostać na karcie człowieka
      siteBox.hidden = true; prodBox.hidden = true; storeBox.hidden = true; logiBox.hidden = true; areaBtn.hidden = true; mineBtn.hidden = true; watchState.hidden = true; riotBox.hidden = true; infoDesc.hidden = false;
      walkBtn.hidden = person.walk === false;
    },
    showArmy(army, ctl) {
      info.hidden = army.length === 0;
      if (!army.length) { rosterKey = ''; hideArmy(); return; }
      infoId = 0;
      setText(infoName, `${t('hud.soldiers')}: ${army.length}`);
      // portrety jak w klasycznych strategiach: hełm na tarczy w barwie drużyny i pasek zdrowia pod spodem
      roster.hidden = false;
      // nowe zaznaczenie: opis i skróty zwinięte (rozwinięte zostają tylko do odznaczenia)
      if (armyPanel.hidden) armyCtl.collapse();
      armyPanel.hidden = false;
      armyCtl.help.hidden = false;
      info.classList.add('army-mode');
      hpLine.hidden = true;
      recruit.hidden = true;
      towerBox.hidden = true;
      gateBox.hidden = true;
      powerBox.hidden = true;
      quarBox.hidden = true;
      siteBox.hidden = true; prodBox.hidden = true; storeBox.hidden = true; logiBox.hidden = true; areaBtn.hidden = true; mineBtn.hidden = true; watchState.hidden = true; riotBox.hidden = true;
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
          pic.innerHTML = portraitOf(k);
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
      armyCtl.update(ctl);
      setText(infoName, `${t('hud.soldiers')}: ${army.length}${ctl?.group ? ` · ${tx('grupa', 'group')} ${ctl.group}` : ''}`);
      // portrety odświeżamy tylko, gdy coś się zmieniło (przebudowa co klatkę gubiła kliknięcia)
      const key = army.slice(0, 24).map((u) => `${u.id}:${Math.round((u.hp / u.max) * 20)}:${u.group ?? 0}`).join() + army.length;
      if (key !== rosterKey) {
        rosterKey = key;
        roster.replaceChildren(...army.slice(0, 24).map((u) => {
          const card = el('button', 'roster-card');
          card.type = 'button';
          card.title = tx(`${u.name}. Klik: odznacz. Shift + klik: zostaw tylko jego.`, `${u.name}. Click: deselect. Shift + click: keep only him.`);
          card.setAttribute('aria-label', tx(`${u.name}, zdrowie ${Math.round((u.hp / u.max) * 100)}%`, `${u.name}, health ${Math.round((u.hp / u.max) * 100)}%`));
          if (u.id) { const id = u.id; card.addEventListener('click', (e) => events.onArmyUnit(id, e.shiftKey)); }
          card.innerHTML = portraitOf(u.kind);
          const bar = el('span', 'roster-hp');
          const fill = el('span');
          fill.style.width = `${Math.round((u.hp / u.max) * 100)}%`;
          bar.append(fill);
          card.append(bar);
          groupBadge(card, u.group);
          return card;
        }));
        if (army.length > 24) roster.append(el('span', 'roster-more', `+${army.length - 24}`));
      }
      const counts = new Map<string, number>();
      for (const u of army) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
      // liczby i skróty siedzą w zwijanym opisie pod portretami, a nie w zawsze widocznych akapitach
      armyCtl.setHelp([...counts].map(([n, k]) => `${n} × ${k}`).join(', '), t('hud.orderHint'));
      infoDesc.hidden = true;
      infoWorker.hidden = true;
      demolish.hidden = true; moveBtn.hidden = true;
      trainBtn.hidden = true;
      trainNote.hidden = true;
    },
    showInfo(i) {
      walkBtn.hidden = true;
      info.hidden = !i;
      if (!i) return;
      infoId = i.id;
      roster.hidden = true; hideArmy();
      setText(infoName, t(i.def.name));
      ownerLine.hidden = !i.owner;
      if (i.owner) {
        const rel = i.owner.rel === 'enemy' ? tx('Wróg', 'Enemy') : i.owner.rel === 'ally' ? tx('Sojusznik', 'Ally') : tx('Twoje', 'Yours');
        ownerLine.dataset.rel = i.owner.rel;
        ownerLine.style.setProperty('--team', `#${i.owner.color.toString(16).padStart(6, '0')}`);
        ownerLine.replaceChildren(el('span', 'info-owner-rel', rel), el('span', 'info-owner-name', i.owner.name));
      }
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
            // kopalnia: jeden kurs daje jedno z kilku (kamień, żelazo, ruda, kryształ) — pokazujemy wszystkie z szansą
            if (r.alts?.length) {
              line.classList.add('prod-alts');
              r.alts.forEach((a, k) => {
                if (k) line.append(el('span', 'prod-or', tx('albo', 'or')));
                const c = chip(a.id, a.n, a.name);
                c.append(el('em', 'prod-pct', tx(`${a.pct}% kursów`, `${a.pct}% of runs`)));
                line.append(c);
              });
            } else line.append(chip(r.output.id, r.output.n, r.output.name));
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
            // nagłówek: po lewej rodzaj towaru, po prawej ile leży w TYM budynku i ile miejsca (czerwono, gdy ponad miejsce)
            const head = el('div', 'stock-head2');
            const label = st.kind === 'granary' ? t('cat.food') : st.kind === 'grain' ? tx('Zboże', 'Grain') : tx('Towary', 'Goods');
            const over = st.hereUsed > st.here;
            const title = el('span', 'stock-title');
            title.append(icon(st.kind === 'granary' ? 'granary' : st.kind === 'grain' ? 'wheat' : 'store'), el('strong', '', label));
            const fill = el('span', 'stock-fill', tx(`${num(st.hereUsed)} z ${num(st.here)} miejsc`, `${num(st.hereUsed)} of ${num(st.here)} spaces`));
            if (over) fill.dataset.over = 'true';
            head.append(title, fill);
            const bar = el('div', 'stock-bar');
            if (over) bar.dataset.over = 'true';
            const fillEl = el('span');
            fillEl.style.width = `${Math.min(100, (st.hereUsed / Math.max(1, st.here)) * 100)}%`;
            bar.append(fillEl);
            const grid = el('div', 'stock-grid');
            if (!st.items.length) grid.append(el('span', 'stock-empty', tx('Pusto', 'Empty')));
            for (const it of st.items) {
              const cell = el('div', 'stock-item');
              cell.title = t(RESOURCE_DEFS[it.id as keyof typeof RESOURCE_DEFS].name);
              cell.append(icon(it.id), el('strong', '', String(it.amount)), el('span', '', t(RESOURCE_DEFS[it.id as keyof typeof RESOURCE_DEFS].name)));
              grid.append(cell);
            }
            const extra: HTMLElement[] = [];
            const kv = (k: string, v: string, bad = false): HTMLElement => { const r = el('p', 'stock-total'); r.append(el('span', '', k), el('strong', '', v)); if (bad) r.dataset.over = 'true'; return r; };
            if (over) extra.push(kv(tx('Ponad miejsce w tym budynku', 'Beyond this building\'s room'), num(st.hereUsed - st.here), true));
            if (st.stores > 1) extra.push(kv(tx(`Razem we wszystkich (${st.stores})`, `Across all ${st.stores}`), `${num(Math.min(st.used, st.max))} / ${num(st.max)}`));
            // zapas większy niż pojemność (np. łup, tryb testowy): ta część nie leży w żadnym magazynie
            if (st.used > st.max) extra.push(kv(tx('Nie mieści się w żadnym magazynie', 'Fits in no store at all'), num(st.used - st.max), true));
            return [head, bar, grid, ...extra];
          }));
        }
      }
      logiBox.hidden = !i.logistics;
      if (i.logistics) {
        const key = JSON.stringify(i.logistics);
        if (logiBox.dataset.key !== key) { logiBox.dataset.key = key; logiBox.replaceChildren(...renderLogistics(i.logistics, icon)); }
      }
      riotBox.hidden = !(i.own && i.riot);
      if (i.riot) {
        const r = i.riot;
        setText(riotState, r.quelling
          ? tx(`Straż rozgania tłum spod bramy — zostało ${r.count}.`, `The watch is driving the mob from the gate — ${r.count} left.`)
          : tx(`Bunt! Pod bramą stoi ${r.count} głodnych i nikt z nich nie pracuje.`, `Riot! ${r.count} hungry folk crowd the gate and none of them will work.`));
        const short = r.food < r.cost;
        setText(doleBtn, tx(`Rozdaj chleb (${r.cost} porcji)`, `Hand out bread (${r.cost} portions)`));
        doleBtn.disabled = short || r.quelling;
        doleBtn.title = short ? tx(`W spichlerzach jest tylko ${r.food} porcji`, `Only ${r.food} portions in the granaries`) : tx(`Tłum od razu się rozejdzie, popularność +${RULES.dolePopularity}`, `The mob breaks up at once, popularity +${RULES.dolePopularity}`);
        setText(quellBtn, tx(`Rozpędź strażą (popularność ${RULES.quellPenalty})`, `Send in the watch (popularity ${RULES.quellPenalty})`));
        quellBtn.disabled = !r.guards || r.quelling;
        quellBtn.title = !r.guards ? tx('Nie masz straży miejskiej', 'You have no town watch') : tx('Głód nie minie — bez jedzenia tłum szybko wróci', 'The hunger remains — without food the mob soon returns');
        quellBtn.hidden = r.quelling;
        doleBtn.hidden = r.quelling;
      }
      watchState.hidden = !(i.own && i.watch);
      if (i.watch) {
        const w = i.watch;
        setText(watchState, `${w.label ?? tx('Straż miejska', 'Town watch')}: ${w.have} / ${w.want}` + (w.training ? tx(` · rekrut szkoli się jeszcze ${w.training} s`, ` · recruit in training for ${w.training} s more`) : '') + (w.note && (!w.training || w.label) ? ` · ${w.note}` : '') + tx(' · gdzie są: pinezki na mapie', ' · where they are: pins on the map'));
      }
      towerBox.hidden = !(i.own && i.garrison !== undefined);
      if (i.garrison !== undefined) {
        const wall = i.def.id === 'stoneWall';
        setText(towerState, i.garrison ? `${wall ? tx('Na murze', 'On the wall') : tx('Na wieży', 'On the tower')}: ${i.garrison} / ${i.garrisonMax ?? (wall ? 2 : 4)} ${wall ? tx('łuczników', 'archers') : tx('żołnierzy', 'men')}` : wall ? tx('Nikogo na murze. Zaznacz łuczników i kliknij mur prawym przyciskiem — wejdą po drabinie.', 'No one on the wall. Select archers and right-click the wall — they will climb the ladder.') : tx(`Pomost pusty (miejsca: ${i.garrisonMax ?? 4}). Zaznacz żołnierzy i kliknij wieżę prawym przyciskiem — wejdą od frontu albo z muru i staną na pomoście. Łucznicy strzelają stąd dalej.`, `The platform is empty (room for ${i.garrisonMax ?? 4}). Select men and right-click the tower — they go up at the front or from the wall and stand on the platform. Archers shoot further from up here.`));
        tSel.disabled = tDown.disabled = !i.garrison;
      }
      quarBox.hidden = !(i.own && i.quarantine);
      if (i.quarantine) {
        quarOn = i.quarantine.on;
        setText(quarBtn, i.quarantine.on ? tx('Otwórz chatę', 'Open the hovel') : tx('Zamknij chatę (kwarantanna)', 'Shut the hovel (quarantine)'));
        setText(quarState, i.quarantine.on
          ? tx(`Kwarantanna: leżą tu tylko chorzy (${i.quarantine.sick}), zdrowi śpią gdzie indziej, zaraza nie wychodzi za drzwi. Ludzie tego nie lubią. Po zarazie chata sama się otworzy.`, `Quarantine: only the sick lie here (${i.quarantine.sick}), the healthy sleep elsewhere and the plague does not get out the door. Folk dislike it. The hovel opens by itself once the plague is over.`)
          : tx(`Chorych w środku: ${i.quarantine.sick}. Zamknięcie chaty zatrzyma zarazę w środku — zdrowi domownicy pójdą spać gdzie indziej.`, `Sick inside: ${i.quarantine.sick}. Shutting the hovel keeps the plague within — the healthy will go to sleep elsewhere.`));
        quarState.dataset.shut = String(i.quarantine.on);
      }
      powerBox.hidden = !(i.own && i.power);
      if (i.power) {
        powerOn = i.power.on;
        setText(powerBadge, i.power.on ? tx('Budynek działa', 'Building at work') : tx('Budynek wyłączony', 'Building shut down'));
        powerBadge.dataset.shut = String(!i.power.on);
        setText(powerBtn, i.power.on ? tx('Wyłącz', 'Shut down') : tx('Włącz', 'Start up'));
        powerBtn.setAttribute('aria-label', i.power.on ? tx('Wyłącz budynek', 'Shut down the building') : tx('Włącz budynek', 'Start up the building'));
        setText(powerState, i.power.on ? tx('Po wyłączeniu pracownik pójdzie do innej roboty.', 'Shut it down and the worker will go to other work.') : i.power.worker ? tx('Pracownik czeka, aż znów włączysz budynek.', 'The worker waits for you to start it up again.') : tx('Pracownik poszedł do innej roboty. Po włączeniu wróci pierwszy wolny chłop.', 'The worker has gone to other work. Start it up and the first idle peasant will come back.'));
      }
      gateBox.hidden = !(i.own && i.gate);
      if (i.gate) {
        gateWant = i.gate.open;
        setText(gateBtn, i.gate.open ? tx('Zamknij bramę', 'Close the gate') : tx('Otwórz bramę', 'Open the gate'));
        setText(gateState, i.gate.shut ? (i.gate.open ? tx('Zamknięta — wróg w pobliżu, otworzy się sama', 'Shut — enemy nearby, it will reopen by itself') : tx('Zamknięta', 'Shut')) : tx('Otwarta — swoi przechodzą', 'Open — your people pass through'));
        gateState.dataset.shut = String(i.gate.shut);
      }
      demolish.hidden = !i.own || !i.def.buildable;
      moveBtn.hidden = !(i.own && i.move);
      if (i.move) {
        setText(moveBtn, `${t('hud.relocate')} (${i.move.cost} ${tx('rudy', 'ore')})`);
        moveBtn.disabled = !!i.move.why;
        moveBtn.title = i.move.why ?? t('hud.relocateTip');
      }
      setText(demolish, i.ruined ? tx('Porzuć ruinę', 'Abandon the ruins') : t('hud.demolish'));
      areaBtn.hidden = i.area === undefined;
      mineBtn.hidden = !(i.own && i.def.id === 'oremine');
      const shot = isTower(i.def.id);
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

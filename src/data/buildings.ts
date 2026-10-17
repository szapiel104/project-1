import { Terrain } from './terrain';
import type { ResourceId, StoreKind } from './resources';

export interface ProductionDef {
  /** Surowiec pobierany z magazynu przed pracą */
  input?: { res: ResourceId; amount: number };
  output: { res: ResourceId; amount: number };
  /** 'home' = praca w budynku, teren = chłop idzie do najbliższego pola tego typu */
  /** 'shore' = chłop idzie nad najbliższą wodę i pracuje na brzegu */
  site: 'home' | 'shore' | Terrain;
  /** Czas pracy w tickach */
  workTicks: number;
  /** Po pracy w terenie chłop wraca do budynku i tyle ticków przerabia surowiec (np. kłody na deski) */
  processTicks?: number;
  /** Ile partii towaru powstaje z jednej przyniesionej sztuki surowca (np. cztery partie desek z jednego pnia) */
  batches?: number;
}

/** Kategorie w menu budowy. Nowa kategoria = wpis tutaj i nazwa w i18n. */
export const CATEGORIES = ['settlement', 'food', 'industry', 'military', 'defense', 'roads'] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export interface BuildingDef {
  id: string;
  category?: CategoryId;
  name: string;
  w: number;
  h: number;
  cost: Partial<Record<ResourceId, number>>;
  /** Miejsca dla ludności */
  housing?: number;
  /** Jakie surowce można tu odnosić */
  stores?: StoreKind[];
  /** Ile surowców danego rodzaju mieści budynek */
  capacity?: Partial<Record<StoreKind, number>>;
  production?: ProductionDef;
  /** Budynek wymaga terenu danego typu w pobliżu */
  needsTerrain?: { terrain: Terrain; radius: number };
  /** Kopalnia: stoi tyłem do skały — pola gór muszą przylegać do tylnego boku działki (bok naprzeciw wejścia) */
  needsRock?: boolean;
  /** Załoga rośnie z wioską: jeden pracownik na `per` mieszkańców (zawsze co najmniej jeden), najwyżej `max` */
  crew?: { per: number; max: number };
  /** Stary budynek: zostaje w kodzie dla zapisów i już stojących egzemplarzy, ale nie ma go w menu i nie da się go postawić */
  legacy?: boolean;
  /** Droga zamiast budynku: 1 = piaskowa, 2 = kamienna. Nie blokuje przejścia, przyspiesza chodzenie */
  road?: 1 | 2 | 3;
  /** Budynek ma pracownika, choć nic nie produkuje (np. inżynier z cechu, który wynosi gruz) */
  staff?: boolean;
  /** Teren pracy: ile pól od krawędzi działki sięga praca (np. grabarz zbiera ciała tylko tutaj) */
  area?: number;
  /** Ilu chłopów bez pracy może tu czekać */
  idleSlots?: number;
  /** Jak pokazać pracującego: 'inside' = odsłonięte wnętrze budynku, 'field' = chodzi po polu */
  workView?: 'inside' | 'field';
  /** Wytrzymałość (domyślnie 40 na pole działki) */
  hp?: number;
  /** Umocnienie bez wejścia (palisada, wieża): nie potrzebuje drzwi */
  wall?: boolean;
  /** Brama: swoi przechodzą, wrogowie muszą ją rozbić */
  gate?: boolean;
  /** Stawiany przeciąganiem w linii, jak droga */
  line?: boolean;
  /** Czy gracz może go postawić (twierdza powstaje sama) */
  buildable: boolean;
}

/**
 * Lista budynków. Nowy budynek = nowy wpis tutaj (plus model w render/buildings.ts i nazwa w i18n).
 * KOLEJNOŚĆ MA ZNACZENIE: indeks trafia do stanu gry i skrótu, nowe wpisy dopisujemy na końcu.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'keep', name: 'b.keep', w: 11, h: 11, cost: {}, housing: 12, hp: 6000, buildable: false },
  { id: 'house', category: 'settlement', name: 'b.house', w: 2, h: 2, cost: { wood: 25 }, housing: 8, buildable: true },
  { id: 'stockpile', category: 'settlement', name: 'b.stockpile', w: 2, h: 2, cost: { wood: 15 }, stores: ['stockpile'], capacity: { stockpile: 200 }, buildable: true },
  { id: 'granary', category: 'food', name: 'b.granary', w: 2, h: 2, cost: { wood: 25 }, stores: ['granary'], capacity: { granary: 400 }, buildable: true },
  {
    id: 'woodcutter', category: 'industry', name: 'b.woodcutter', w: 2, h: 2, cost: { wood: 15 }, buildable: true,
    workView: 'inside',
    production: { output: { res: 'wood', amount: 3 }, site: Terrain.Forest, workTicks: 130, processTicks: 60, batches: 4 },
  },
  {
    id: 'quarry', category: 'industry', name: 'b.quarry', w: 2, h: 2, cost: { wood: 30 }, buildable: true, legacy: true,
    needsTerrain: { terrain: Terrain.Stone, radius: 6 },
    production: { output: { res: 'stone', amount: 6 }, site: Terrain.Stone, workTicks: 70 },
  },
  {
    id: 'mine', category: 'industry', name: 'b.mine', w: 2, h: 2, cost: { wood: 50, stone: 15 }, buildable: true, legacy: true,
    needsTerrain: { terrain: Terrain.Iron, radius: 6 },
    production: { output: { res: 'iron', amount: 4 }, site: Terrain.Iron, workTicks: 90 },
  },
  {
    id: 'orchard', category: 'food', name: 'b.orchard', w: 3, h: 3, cost: { wood: 20 }, buildable: true,
    workView: 'field',
    production: { output: { res: 'apples', amount: 18 }, site: 'home', workTicks: 80 },
  },
  {
    id: 'farm', category: 'food', name: 'b.farm', w: 3, h: 3, cost: { wood: 30 }, buildable: true,
    workView: 'field',
    production: { output: { res: 'wheat', amount: 16 }, site: 'home', workTicks: 110 },
  },
  {
    id: 'mill', category: 'food', name: 'b.mill', w: 2, h: 2, cost: { wood: 40, stone: 20 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wheat', amount: 16 }, output: { res: 'flour', amount: 16 }, site: 'home', workTicks: 90 },
  },
  {
    id: 'bakery', category: 'food', name: 'b.bakery', w: 2, h: 2, cost: { wood: 35, stone: 20 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'flour', amount: 4 }, output: { res: 'bread', amount: 10 }, site: 'home', workTicks: 110 },
  },
  // Obozowisko stoi od początku przy twierdzy: tu czekają chłopi bez pracy. Ma limit miejsc, więc bez wolnego miejsca nowi nie przyjdą
  { id: 'camp', category: 'settlement', name: 'b.camp', w: 2, h: 2, cost: { wood: 20 }, idleSlots: 6, buildable: true },
  // Stodoła stoi od początku obok twierdzy i mieści zapasy startowe; można ją rozebrać i postawić gdzie indziej
  { id: 'barn', category: 'settlement', name: 'b.barn', w: 3, h: 2, cost: { wood: 40 }, stores: ['stockpile'], capacity: { stockpile: 250 }, buildable: true },
  {
    id: 'fisher', category: 'food', name: 'b.fisher', w: 2, h: 2, cost: { wood: 50, gold: 20 }, buildable: true,
    needsTerrain: { terrain: Terrain.Water, radius: 7 },
    production: { output: { res: 'fish', amount: 8 }, site: 'shore', workTicks: 110 },
  },
  // Wolnostojąca pochodnia: gracz stawia ją, gdzie chce, żeby rozświetlić osadę nocą
  { id: 'torch', category: 'settlement', name: 'b.torch', w: 1, h: 1, cost: { wood: 3 }, buildable: true },
  // Drogi: maluje się je po polach. Ludzie chodzą po nich szybciej i chętniej je wybierają
  { id: 'roadSand', category: 'roads', name: 'b.roadSand', w: 1, h: 1, cost: {}, road: 1, buildable: true },
  { id: 'roadStone', category: 'roads', name: 'b.roadStone', w: 1, h: 1, cost: { stone: 1 }, road: 2, buildable: true },
  // Cech inżynierów: jego człowiek wynosi gruz po rozbiórkach, gdy brakuje chłopów bez pracy
  { id: 'engineers', category: 'settlement', name: 'b.engineers', w: 2, h: 2, cost: { wood: 50, stone: 30 }, staff: true, buildable: true },
  // Warsztat włóczniarza: z drewna ze składu struga drzewca i oprawia groty
  {
    id: 'poleturner', category: 'military', name: 'b.poleturner', w: 2, h: 2, cost: { wood: 35 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wood', amount: 2 }, output: { res: 'spear', amount: 1 }, site: 'home', workTicks: 120 },
  },
  // Koszary: tu wolny chłop dostaje broń ze składu i staje się żołnierzem
  { id: 'barracks', category: 'military', name: 'b.barracks', w: 3, h: 3, cost: { wood: 60, stone: 50, gold: 30 }, buildable: true },
  // Cmentarz: grabarz znosi tu ciała poległych z pola bitwy
  { id: 'cemetery', category: 'military', name: 'b.cemetery', w: 3, h: 3, cost: { wood: 20, stone: 15 }, staff: true, area: 14, buildable: true },
  // Warsztat łuczarza: z drewna ze składu wygina łuki i plecie cięciwy
  {
    id: 'fletcher', category: 'military', name: 'b.fletcher', w: 2, h: 2, cost: { wood: 40 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wood', amount: 2 }, output: { res: 'bow', amount: 1 }, site: 'home', workTicks: 140 },
  },
  // Karczma: karczmarz nalewa piwo ze składu (warzy je browar); wieczorem ludzie przychodzą posiedzieć, co podnosi popularność
  { id: 'tavern', category: 'settlement', name: 'b.tavern', w: 4, h: 3, cost: { wood: 60, stone: 20, gold: 40 }, staff: true, workView: 'inside', buildable: true },
  // Umocnienia z bali: częstokół stawiany przeciąganiem, brama dla swoich, drewniana wieża strażnicza
  { id: 'palisade', category: 'defense', name: 'b.palisade', w: 1, h: 1, cost: { wood: 1 }, hp: 260, wall: true, line: true, buildable: true },
  { id: 'gate', category: 'defense', name: 'b.gate', w: 1, h: 1, cost: { wood: 10 }, hp: 600, gate: true, buildable: true },
  { id: 'watchtower', category: 'defense', name: 'b.watchtower', w: 2, h: 2, cost: { wood: 25 }, hp: 700, wall: true, buildable: true },
  // Droga z dyli: drewniane bale ułożone w poprzek, między piaskową a brukowaną (na końcu listy, żeby stare zapisy dalej działały)
  { id: 'roadWood', category: 'roads', name: 'b.roadWood', w: 1, h: 1, cost: { wood: 1 }, road: 3, buildable: true },
  // Studnia: z niej ludzie czerpią wodę do gaszenia pożarów (cech inżynierów ma własną studnię na podwórzu)
  { id: 'well', category: 'settlement', name: 'b.well', w: 1, h: 1, cost: { wood: 15, stone: 10 }, hp: 300, wall: true, buildable: true },
  // Browar: piwowar warzy piwo z pszenicy ze składu, beczki idą do składu, a stamtąd do karczmy
  {
    id: 'brewery', category: 'food', name: 'b.brewery', w: 2, h: 2, cost: { wood: 45, stone: 20 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wheat', amount: 2 }, output: { res: 'ale', amount: 3 }, site: 'home', workTicks: 90 },
  },
  // Mur kamienny: stawiany przeciąganiem jak częstokół (także wprost na częstokole — zamienia bale na kamień), dużo mocniejszy
  { id: 'stoneWall', category: 'defense', name: 'b.stoneWall', w: 1, h: 1, cost: { stone: 3 }, hp: 1100, wall: true, line: true, buildable: true },
  // Drabina na mur kamienny: stawiasz ją na polu tuż przy murze; tędy Twoi ludzie wchodzą na mur i z niego schodzą
  { id: 'ladder', category: 'defense', name: 'b.ladder', w: 1, h: 1, cost: { wood: 3 }, hp: 120, wall: true, buildable: true },
  // Kamienna wieża: jak strażnica, ale z kamienia — wytrzymalsza, mieści sześciu łuczników, z wyższego pomostu strzelają dalej
  { id: 'stoneTower', category: 'defense', name: 'b.stoneTower', w: 2, h: 2, cost: { stone: 50, wood: 10 }, hp: 2400, wall: true, buildable: true },
  // Zbrojownia: tu włóczniarz i łuczarz odnoszą gotową broń, stąd biorą ją koszary i straż
  { id: 'armory', category: 'military', name: 'b.armory', w: 2, h: 2, cost: { wood: 40, stone: 30 }, stores: ['armory'], capacity: { armory: 60 }, buildable: true },
  // duży spichlerz: kamienna podmurówka, piętro z szachulca, dach z łupka — trzy razy więcej miejsca za kamień
  // (na końcu listy: typ budynku w zapisach gry to numer na tej liście, więc nowe budynki dopisujemy na końcu)
  { id: 'granaryBig', category: 'food', name: 'b.granaryBig', w: 3, h: 3, cost: { wood: 70, stone: 60 }, stores: ['granary'], capacity: { granary: 1200 }, buildable: true },
  // kamienna brama w murze: baszty z ciosów, łukowy przejazd, okute wrota; wytrzymalsza od drewnianej
  { id: 'stoneGate', category: 'defense', name: 'b.stoneGate', w: 1, h: 1, cost: { stone: 25, wood: 10 }, hp: 1600, gate: true, buildable: true },
  // Kopalnia (jak w Gothic): jedna sztolnia wbita w zbocze gór — stawiana tylko tyłem do skały. Z jednej kopalni idzie
  // kamień, żelazo i (rzadko) złoto; co wyjdzie z danego kursu, losuje symulacja (workers.ts, MINE_YIELDS).
  // Tania w budowie, ale załoga rośnie z wioską (1 górnik na 4 mieszkańców, do 8) — to ludzie są kosztem.
  // Wytrzymała, ale wróg może ją zburzyć; otocz ją murem i wieżami jak osobny obóz. Zastępuje kamieniołom i kopalnię żelaza.
  {
    id: 'oremine', category: 'industry', name: 'b.oremine', w: 3, h: 3, cost: { wood: 30 }, hp: 360, buildable: true,
    workView: 'inside', needsRock: true, crew: { per: 4, max: 8 },
    production: { output: { res: 'stone', amount: 6 }, site: 'home', workTicks: 90 },
  },
];

/** Budynki bez słupa z pochodnią przy wejściu: obozowisko świeci ogniskiem, sad, pole, cmentarz i studnia nie potrzebują światła */
export const NO_TORCH = new Set(['camp', 'orchard', 'farm', 'cemetery', 'well']);

export const buildingIndex = (id: string): number => BUILDINGS.findIndex((b) => b.id === id);
/** Wieże z łucznikami: drewniana strażnica i kamienna wieża */
export const isTower = (id: string): boolean => id === 'watchtower' || id === 'stoneTower';
/** O ile dalej strzela łucznik z danej wieży (ponad zwykłe +3 z wysokości): kamienna wieża jest wyższa */
export const towerBonus = (id: string): number => (id === 'stoneTower' ? 1 : 0);

/** Wymiary działki po obrocie: przy obrocie o 90° i 270° szerokość zamienia się z głębokością. */
export function footprint(def: BuildingDef, rot = 0): { w: number; h: number } {
  return rot % 2 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

/** Kwadrat terenu pracy budynku (pola od x0,y0 do x1,y1 włącznie) albo null, gdy budynek go nie ma */
export function workArea(b: { type: number; x: number; y: number; rot: number }): { x0: number; y0: number; x1: number; y1: number } | null {
  const def = BUILDINGS[b.type]!;
  if (!def.area) return null;
  const fp = footprint(def, b.rot);
  return { x0: b.x - def.area, y0: b.y - def.area, x1: b.x + fp.w - 1 + def.area, y1: b.y + fp.h - 1 + def.area };
}

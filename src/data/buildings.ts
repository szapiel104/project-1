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
  /** Barak przy kopalni: tyle miejsc do spania dla załogi pobliskiej kopalni (nie liczy się do mieszkań wioski) */
  beds?: number;
  /** Drzewko budowy: ten budynek da się postawić dopiero, gdy gracz ma gotowy (dokończony, nie zburzony) budynek o tym id */
  requires?: string;
  /** Etap osady potrzebny do postawienia (0 wioska — od razu, 1 osada, 2 gród, 3 miasto; progi ludności w RULES.tiers).
   *  Raz osiągnięty etap zostaje, nawet gdy ludzi ubędzie */
  tier?: number;
  /** Cena drugiego i każdego następnego takiego budynku (zamiast zwykłej dopłaty 10%), np. druga kopalnia */
  nextCost?: Partial<Record<ResourceId, number>>;
  /** Stary budynek: zostaje w kodzie dla zapisów i już stojących egzemplarzy, ale nie ma go w menu i nie da się go postawić */
  legacy?: boolean;
  /** Droga zamiast budynku: 1 = piaskowa, 2 = kamienna. Nie blokuje przejścia, przyspiesza chodzenie */
  road?: 1 | 2 | 3;
  /** Budynek ma pracownika, choć nic nie produkuje (np. inżynier z cechu, który wynosi gruz) */
  staff?: boolean;
  /** Magazyn: ilu magazynierów (mały 1, duży 2) — znoszą towar spod drzwi i gruz z rozbiórek (storage.ts) */
  keepers?: number;
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
  /** Dodatek stawiany na istniejącym murze albo wieży (koksownik): nie zajmuje pola, tylko wyposaża budynek pod spodem */
  addon?: boolean;
  /** Czy gracz może go postawić (twierdza powstaje sama) */
  buildable: boolean;
}

/**
 * Lista budynków. Nowy budynek = nowy wpis tutaj (plus model w render/buildings.ts i nazwa w i18n).
 * KOLEJNOŚĆ MA ZNACZENIE: indeks trafia do stanu gry i skrótu, nowe wpisy dopisujemy na końcu.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'keep', name: 'b.keep', w: 11, h: 11, cost: {}, housing: 12, hp: 15000, buildable: false },
  { id: 'house', category: 'settlement', name: 'b.house', w: 2, h: 2, cost: { wood: 25 }, housing: 8, buildable: true },
  { id: 'stockpile', category: 'settlement', name: 'b.stockpile', w: 2, h: 2, cost: { wood: 15 }, stores: ['stockpile'], capacity: { stockpile: 200 }, staff: true, keepers: 1, buildable: true },
  { id: 'granary', category: 'food', name: 'b.granary', w: 2, h: 2, cost: { wood: 25 }, stores: ['granary'], capacity: { granary: 400 }, staff: true, keepers: 1, buildable: true },
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
    id: 'mill', category: 'food', name: 'b.mill', w: 2, h: 2, tier: 1, cost: { wood: 55, stone: 30 }, buildable: true,
    workView: 'inside',
    // jeden młyn przerabia zboże z około pięciu pól (pole ok. 150 zboża na dobę, młyn ok. 6 kursów na dobę)
    production: { input: { res: 'wheat', amount: 128 }, output: { res: 'flour', amount: 128 }, site: 'home', workTicks: 90 },
  },
  {
    id: 'bakery', category: 'food', name: 'b.bakery', w: 2, h: 2, tier: 1, cost: { wood: 50, stone: 30 }, requires: 'mill', buildable: true,
    workView: 'inside',
    // jeden młyn starcza na około osiem piekarni; z pełnego łańcucha (pola, młyn, piekarnie) wychodzi więcej jedzenia na człowieka niż z sadu
    production: { input: { res: 'flour', amount: 16 }, output: { res: 'bread', amount: 40 }, site: 'home', workTicks: 110 },
  },
  // Obozowisko stoi od początku przy twierdzy: tu czekają chłopi bez pracy. Ma limit miejsc, więc bez wolnego miejsca nowi nie przyjdą
  { id: 'camp', category: 'settlement', name: 'b.camp', w: 2, h: 2, cost: { wood: 20 }, idleSlots: 6, buildable: true },
  // Stodoła stoi od początku obok twierdzy i mieści zapasy startowe; można ją rozebrać i postawić gdzie indziej
  { id: 'barn', category: 'settlement', name: 'b.barn', w: 3, h: 2, cost: { wood: 40 }, stores: ['stockpile', 'grain'], capacity: { stockpile: 250, grain: 200 }, staff: true, keepers: 2, buildable: true },
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
  { id: 'engineers', category: 'settlement', name: 'b.engineers', w: 2, h: 2, tier: 1, cost: { wood: 80, stone: 50 }, staff: true, crew: { per: 8, max: 4 }, buildable: true },
  // Warsztat włóczniarza: z drewna ze składu struga drzewca i oprawia groty
  {
    id: 'poleturner', category: 'military', name: 'b.poleturner', w: 2, h: 2, cost: { wood: 35 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wood', amount: 2 }, output: { res: 'spear', amount: 1 }, site: 'home', workTicks: 120 },
  },
  // Koszary: tu wolny chłop dostaje broń ze składu i staje się żołnierzem
  { id: 'barracks', category: 'military', name: 'b.barracks', w: 3, h: 3, cost: { wood: 70, stone: 60, gold: 40 }, requires: 'armory', buildable: true },
  // Cmentarz: grabarz znosi tu ciała poległych z pola bitwy
  { id: 'cemetery', category: 'military', name: 'b.cemetery', w: 3, h: 3, cost: { wood: 20, stone: 15 }, staff: true, area: 14, buildable: true },
  // Warsztat łuczarza: z drewna ze składu wygina łuki i plecie cięciwy
  {
    id: 'fletcher', category: 'military', name: 'b.fletcher', w: 2, h: 2, cost: { wood: 40 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wood', amount: 2 }, output: { res: 'bow', amount: 1 }, site: 'home', workTicks: 140 },
  },
  // Karczma: karczmarz nalewa piwo ze składu (warzy je browar); wieczorem ludzie przychodzą posiedzieć, co podnosi popularność
  { id: 'tavern', category: 'settlement', name: 'b.tavern', w: 4, h: 3, tier: 1, cost: { wood: 90, stone: 40, gold: 60 }, staff: true, workView: 'inside', requires: 'brewery', buildable: true },
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
    id: 'brewery', category: 'food', name: 'b.brewery', w: 2, h: 2, tier: 1, cost: { wood: 60, stone: 30 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'wheat', amount: 2 }, output: { res: 'ale', amount: 3 }, site: 'home', workTicks: 90 },
  },
  // Mur kamienny: stawiany przeciąganiem jak częstokół (także wprost na częstokole — zamienia bale na kamień), dużo mocniejszy
  { id: 'stoneWall', category: 'defense', name: 'b.stoneWall', w: 1, h: 1, tier: 1, cost: { stone: 3 }, hp: 1100, wall: true, line: true, buildable: true },
  // Drabina na mur kamienny: stawiasz ją na polu tuż przy murze; tędy Twoi ludzie wchodzą na mur i z niego schodzą
  { id: 'ladder', category: 'defense', name: 'b.ladder', w: 1, h: 1, cost: { wood: 3 }, hp: 120, wall: true, buildable: true },
  // Kamienna wieża: jak strażnica, ale z kamienia — wytrzymalsza, mieści sześciu łuczników, z wyższego pomostu strzelają dalej
  { id: 'stoneTower', category: 'defense', name: 'b.stoneTower', w: 2, h: 2, tier: 1, cost: { stone: 80, wood: 15 }, hp: 2400, wall: true, buildable: true },
  // Zbrojownia: tu włóczniarz i łuczarz odnoszą gotową broń, stąd biorą ją koszary i straż
  { id: 'armory', category: 'military', name: 'b.armory', w: 2, h: 2, cost: { wood: 45, stone: 30 }, stores: ['armory'], capacity: { armory: 60 }, staff: true, keepers: 1, buildable: true },
  // duży spichlerz: kamienna podmurówka, piętro z szachulca, dach z łupka — trzy razy więcej miejsca za kamień
  // (na końcu listy: typ budynku w zapisach gry to numer na tej liście, więc nowe budynki dopisujemy na końcu)
  { id: 'granaryBig', category: 'food', name: 'b.granaryBig', w: 3, h: 3, tier: 2, cost: { wood: 110, stone: 100 }, stores: ['granary'], capacity: { granary: 1200 }, staff: true, keepers: 2, buildable: true },
  // kamienna brama w murze: baszty z ciosów, łukowy przejazd, okute wrota; wytrzymalsza od drewnianej
  { id: 'stoneGate', category: 'defense', name: 'b.stoneGate', w: 1, h: 1, tier: 1, cost: { stone: 25, wood: 10 }, hp: 1600, gate: true, buildable: true },
  // Kopalnia (jak w Gothic): jedna sztolnia wbita w zbocze gór — stawiana tylko tyłem do skały. Z jednej kopalni idzie
  // kamień, żelazo i (rzadko) rudę — walutę; co wyjdzie z danego kursu, losuje symulacja (workers.ts, MINE_YIELDS).
  // Tania w budowie, ale załoga rośnie z wioską (1 górnik na 4 mieszkańców, do 8) — to ludzie są kosztem.
  // Wytrzymała, ale wróg może ją zburzyć; otocz ją murem i wieżami jak osobny obóz. Zastępuje kamieniołom i kopalnię żelaza.
  {
    id: 'oremine', category: 'industry', name: 'b.oremine', w: 3, h: 3, cost: { wood: 30 }, hp: 3000, buildable: true,
    // druga i każda następna kopalnia kosztuje fortunę (Michał 25.10): pierwsza tanio, żeby było z czego żyć
    nextCost: { wood: 300, stone: 300, iron: 60, gold: 400 },
    workView: 'inside', needsRock: true, crew: { per: 4, max: 8 },
    production: { output: { res: 'stone', amount: 10 }, site: 'home', workTicks: 150 },
  },
  // Barak górników: stawiany przy kopalni (do 10 pól). Załoga nocuje tu i siedzi wieczorem przy ognisku zamiast wracać
  // do wioski; urobek odkłada pod barakiem, a do zamku wozi go wóz pod eskortą dwóch strażników kopalni (minecamp.ts).
  { id: 'minecamp', category: 'industry', name: 'b.minecamp', w: 2, h: 2, cost: { wood: 40 }, hp: 320, beds: 8, requires: 'oremine', buildable: true },
  // Obóz zbójów na polanie w puszczy (generator map 5): stoi od początku gry, nie należy do żadnego gracza. Zbóje napadają
  // stąd na drwali i chłopów w lesie i znoszą łup; rozbity obóz oddaje łup temu, kto go rozbił (systems/bandits.ts).
  { id: 'banditCamp', name: 'b.banditCamp', w: 3, h: 3, cost: {}, hp: 900, buildable: false },
  // Chata leśniczego: leśniczy sadzi młode drzewka na wolnej łące w swoim terenie (najchętniej przy lesie i na
  // dawnych porębach). Drzewko rośnie dwa dni gry (zimą stoi), potem to zwykły las, który drwal może ściąć (forestry.ts).
  { id: 'forester', category: 'industry', name: 'b.forester', w: 2, h: 2, cost: { wood: 20 }, staff: true, area: 6, buildable: true },
  // Namiot polowy z medykiem: stawiany dowolnie, np. tuż za linią frontu. Ranni żołnierze idą do najbliższego miejsca
  // leczenia (twierdza albo namiot z medykiem) i tam szybciej wracają do zdrowia (army.ts, healSpot).
  { id: 'fieldTent', category: 'military', name: 'b.fieldTent', w: 3, h: 3, tier: 1, cost: { wood: 45, gold: 25 }, staff: true, hp: 320, buildable: true },
  // Kuźnia: kowal bierze ze składu dwie sztaby żelaza z kopalni i wykuwa miecz, który odnosi do zbrojowni.
  // Stawiana gdziekolwiek (bez wymagań). Miecze są dla zbrojnych (ciężka piechota).
  {
    id: 'smithy', category: 'military', name: 'b.smithy', w: 2, h: 2, tier: 2, cost: { wood: 70, stone: 60, gold: 30 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'iron', amount: 2 }, output: { res: 'sword', amount: 1 }, site: 'home', workTicks: 160 },
  },
  // Płatnerz: z trzech sztab żelaza ze składu plecie i nituje kolczugę, którą odnosi do zbrojowni (dla zbrojnych).
  // Stawiany gdziekolwiek, bez wymagań; wolniejszy od kowala, bo kolczuga to tysiące kółek.
  {
    id: 'armorer', category: 'military', name: 'b.armorer', w: 2, h: 2, tier: 2, cost: { wood: 70, stone: 60, gold: 30 }, buildable: true,
    workView: 'inside',
    production: { input: { res: 'iron', amount: 3 }, output: { res: 'armor', amount: 1 }, site: 'home', workTicks: 220 },
  },
  // Większe kamienne wieże: im większa baszta, tym więcej łuczników mieści i tym wyżej stoją (dalej strzelają).
  // Jak zwykła kamienna wieża stają na wolnym polu albo wprost na swoim murze.
  { id: 'stoneTowerBig', category: 'defense', name: 'b.stoneTowerBig', w: 3, h: 3, tier: 2, cost: { stone: 170, wood: 35 }, hp: 3800, wall: true, buildable: true },
  { id: 'stoneTowerGreat', category: 'defense', name: 'b.stoneTowerGreat', w: 4, h: 4, tier: 3, cost: { stone: 300, wood: 60, iron: 20 }, hp: 5600, wall: true, buildable: true },
  // Koksownik: żelazny kosz z żarem stawiany na murze kamiennym albo na kamiennej wieży (nie zajmuje pola).
  // Łucznicy na murze i wieżach do 2 pól od niego maczają strzały w ogniu — ognista strzała rani mocniej (army.ts, FIRE_BONUS).
  { id: 'brazier', category: 'defense', name: 'b.brazier', w: 1, h: 1, tier: 1, cost: { iron: 2, stone: 4 }, addon: true, buildable: true },
  // Kapliczka: kamienny posąg Ojca Płomienia w ostrołukowej niszy (tools/models/shrine.py). Wieczorem część ludzi
  // zamiast do karczmy albo do ogniska idzie tu się modlić (workers.ts), a sama kapliczka lekko podnosi popularność
  // (economy.ts: +1, przy dwóch i więcej +2). Bez pracownika, nic nie produkuje.
  { id: 'shrine', category: 'settlement', name: 'b.shrine', w: 2, h: 2, cost: { wood: 10, stone: 40 }, hp: 700, staff: true, buildable: true },
  // Magowie (tools/models/magefire.py, magewater.py): Wieża Płomienia i Sanktuarium Źródła. Mieszka w nich
  // do trzech magów (załoga rośnie z osadą), którzy leczą zarazę (src/sim/systems/plague.ts). Zakony nie przepadają za sobą, ale współpracują.
  // Siedziby z dziedzińcem, murem i skrzydłem z celami (5×5) — drogie: to cel na później, gdy osada urośnie
  { id: 'mageFire', category: 'settlement', name: 'b.mageFire', w: 5, h: 5, tier: 2, cost: { stone: 320, wood: 140, iron: 40, gold: 220, crystal: 4 }, hp: 3200, staff: true, crew: { per: 12, max: 3 }, buildable: true },
  { id: 'mageWater', category: 'settlement', name: 'b.mageWater', w: 5, h: 5, tier: 2, cost: { stone: 280, wood: 160, iron: 30, gold: 220, crystal: 4 }, hp: 2800, staff: true, crew: { per: 12, max: 3 }, buildable: true },
  // Chatka maga (tools/models/magehut.py): tani punkt dla jednego wędrownego maga — żeby choroby nie wybiły osady,
  // zanim stać ją na wieżę albo sanktuarium. Leczy słabiej i wolniej niż siedziby kręgów.
  { id: 'mageHut', category: 'settlement', name: 'b.mageHut', w: 2, h: 2, cost: { wood: 30, stone: 10 }, hp: 420, staff: true, buildable: true },
];

/** Budynki bez słupa z pochodnią przy wejściu: obozowisko świeci ogniskiem, sad, pole, cmentarz i studnia nie potrzebują światła */
export const NO_TORCH = new Set(['camp', 'orchard', 'farm', 'cemetery', 'well', 'banditCamp', 'fieldTent', 'mageFire', 'mageWater', 'mageHut']);

export const buildingIndex = (id: string): number => BUILDINGS.findIndex((b) => b.id === id);
/** Wieże z łucznikami: ilu łuczników mieści i o ile pól dalej z niej strzelają (ponad zwykłe +3 z wysokości) */
export const TOWERS: Readonly<Record<string, { room: number; bonus: number }>> = {
  watchtower: { room: 4, bonus: 0 },
  stoneTower: { room: 6, bonus: 1 },
  stoneTowerBig: { room: 10, bonus: 2 },
  // wielka wieża: najwyższa, strzela wyraźnie dalej niż duża (Michał 25.10)
  stoneTowerGreat: { room: 16, bonus: 6 },
};
export const isTower = (id: string): boolean => id in TOWERS;
/** Kamienne wieże (wszystkie rozmiary) */
export const isStoneTower = (id: string): boolean => isTower(id) && id !== 'watchtower';
/** O ile dalej strzela łucznik z danej wieży (ponad zwykłe +3 z wysokości): większa wieża jest wyższa */
export const towerBonus = (id: string): number => TOWERS[id]?.bonus ?? 0;
/** Na czym można postawić koksownik: mur kamienny i kamienne wieże (drewniana strażnica by się zajęła) */
export const brazierHost = (id: string): boolean => id === 'stoneWall' || isStoneTower(id);

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

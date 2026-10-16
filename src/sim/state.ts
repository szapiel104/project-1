import { KEEP_GATE, KEEP_SIZE } from '../data/keep';
import { BUILDINGS, buildingIndex } from '../data/buildings';
import type { MAP_PRESETS } from '../data/maps';
import { RESOURCES, RESOURCE_DEFS, resIndex, type ResourceId, type StoreKind } from '../data/resources';
import { RULES } from '../data/rules';
import { TERRAIN, Terrain } from '../data/terrain';
import { UNITS } from '../data/units';
const TERRAIN_BUILDABLE = (t: number): boolean => TERRAIN[t as Terrain].buildable;
const TERRAIN_WALK = (t: number): boolean => TERRAIN[t as Terrain].walkable;
const UNIT_HP = (): number => UNITS[0]?.hp ?? 60;
import { generateMap, type GameMap } from './map';
import { Rng } from './rng';
import { addBuilding } from './systems/placement';
import { spawnPeasant } from './systems/population';

/** Częstotliwość symulacji. Render interpoluje między tickami. */
export const TICKS_PER_SECOND = 10;
/** Stały przecinek pozycji jednostek: 256 = jedno pole */
export const FP = 256;

export interface PlayerState {
  id: number;
  team: number;
  /** Zasoby, indeksy jak w RESOURCES */
  res: Int32Array;
  popularity: number;
  /** Ostatnia miesięczna zmiana popularności (do interfejsu) */
  popDelta: number;
  rations: number;
  tax: number;
  /** Gracz sterowany przez bota w symulacji */
  bot: boolean;
  /** Twierdza zburzona: gracz odpadł z gry */
  defeated: boolean;
  /** Poziom trudności bota (0 pokojowy … 3 trudny) */
  level: number;
  /** Liczniki do podsumowania meczu */
  /** Ilu ludzi zagryzły wilki (do powiadomień) */
  wolfKills?: number;
  /** Gracz wyszedł z meczu przez sieć: jego zamek stoi bez gospodarza, trzeba go zburzyć */
  left?: boolean;
  /** Tryb deweloperski: wszystko postawione, pełne zapasy, budowa natychmiast */
  dev?: boolean;
  /** Tryb deweloperski: budynki stają od razu (false = zwykła budowa z noszeniem materiału) */
  instantBuild?: boolean;
  stats: { gathered: number; trained: number; kills: number; lost: number; built: number; razed: number };
  /** Ilu strażników miejskich ma zamek (brak = jeszcze nie wystawieni; na start 6, poległych zastępują chłopi) */
  guards?: number;
  /** Rekrut straży szkolony w twierdzy: tick, w którym będzie gotowy (0/brak = nikt się nie szkoli) */
  guardReady?: number;
  /** Ilu ludzi spało ostatniej nocy na słomie pod gołym niebem i ilu z nich zmokło w deszczu */
  rough?: number;
  /** Głód: przy ostatnim rozliczeniu zabrakło jedzenia na posiłek — głodni odchodzą, dopóki znów nie będzie co jeść */
  hungry?: boolean;
  cold?: number;
  /** Opał: ułamek drewna spalonego w piecach, którego jeszcze nie zdjęto ze składu (zima) */
  fuel?: number;
  /** Ostatni miesiąc zabrakło drewna na opał (ludzie marzną) */
  freezing?: boolean;
}

export interface Building {
  id: number;
  /** Pożar: ile ticków jeszcze płonie (0/brak = nie płonie); każde wiadro wody skraca go */
  fire?: number;
  /** Wytrzymałość z poprzedniego ticku (do wykrycia świeżego ciosu, od którego zajmuje się ogień) */
  hpWas?: number;
  /** Koszary: punkt zbiórki dla każdego rodzaju jednostki (pole albo -1 = przed koszarami) */
  rally?: number[];
  /** Koszary: rekruci w środku, którzy wyjdą w zbroi (rodzaj jednostki i tick wyjścia) */
  enlistQ?: { k: number; at: number }[];
  /** Indeks w BUILDINGS */
  type: number;
  owner: number;
  x: number;
  y: number;
  /** Obrót co 90°: 0 = wejście od dołu mapy, 1 = z prawej, 2 = od góry, 3 = z lewej */
  rot: number;
  /** Pole, z którego chłopi wchodzą do budynku */
  door: number;
  /** Id pracującego chłopa albo 0 */
  worker: number;
  /** Czy pochodnia przy budynku jest zapalona (zapalają ją ludzie o zmierzchu, gaśnie o świcie) */
  lit: boolean;
  /** Wytrzymałość; spada od ciosów wroga, naprawia ją inżynier */
  hp: number;
  /** Ile pracy zostało do końca budowy; 0 = budynek gotowy i działa */
  build: number;
  /** Budowa: ile ładunków materiału trzeba przynieść ze składu w sumie (0/brak = nie nosi się) */
  loads?: number;
  /** Budowa: ile ładunków już leży na placu */
  delivered?: number;
  /** Budowa: ile ładunków jeszcze nikt nie poszedł przynieść */
  haul?: number;
  /** Brama: gracz chce ją mieć otwartą (domyślnie tak) */
  gateOpen?: boolean;
  /** Wyłączony przez gracza: nie przyjmuje pracownika (dotychczasowy wraca do obozowiska i bierze inną robotę) */
  off?: boolean;
  /** Brama jest teraz zamknięta (na rozkaz albo bo wróg blisko) */
  shut?: boolean;
  /** Ruina po zniszczeniu: nie działa, a mur w tym miejscu da się przejść, dopóki go nie odbudują */
  ruined?: boolean;
  /** Warsztat: ile towaru jego pracownik oddał do składu od postawienia (do okna budynku) */
  made?: number;
  /** Warsztat: ile towaru przepadło, bo skład był pełny */
  lost?: number;
}

/** Gruz po rozebranym budynku. Leży na działce, dopóki ludzie nie wyniosą wszystkich ładunków. */
export interface Rubble {
  id: number;
  owner: number;
  /** Typ rozebranego budynku (dla wyglądu gruzu) */
  type: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pozostałe ładunki: [indeks surowca albo -1 dla bezwartościowego gruzu, ilość] */
  loads: [number, number][];
  /** Ile ładunków było na początku (żeby stos malał na oczach) */
  total: number;
}

export const enum Phase {
  Idle = 0,
  /** Wraca do swojego budynku, żeby zacząć cykl pracy */
  Returning = 1,
  ToInputStore = 2,
  ToHome = 3,
  Working = 4,
  ToSite = 5,
  WorkingSite = 6,
  ToStore = 7,
  /** Idzie odpocząć do chaty */
  ToRest = 8,
  Resting = 9,
  /** Idzie zapalić pochodnię przy budynku `target` */
  ToLight = 10,
  /** Idzie po ładunek gruzu z rozbiórki `target` */
  ToRubble = 11,
  /** Grabarz idzie po ciało poległego `target` */
  ToCorpse = 12,
  /** Inżynier idzie naprawić budynek `target` */
  ToRepair = 13,
  Repairing = 14,
  /** Budowniczy idzie do składu po deski / kamień na plac budowy `target` */
  ToFetch = 15,
  /** Idzie na pole zaplanowanej drogi (`target` = pole + 1) */
  ToPave = 16,
  /** Układa drogę na polu, na którym stoi */
  Paving = 17,
  /** Idzie do składu po drewno albo kamień na drogę (`target` = pole + 1, `timer` = surowiec + 1) */
  ToRoadFetch = 18,
  /** Wieczór: idzie do ogniska w obozowisku albo do karczmy (`target` = pole + 1) */
  ToEvening = 19,
  /** Siedzi wieczorem przy ogniu albo w karczmie */
  Evening = 20,
  /** Idzie spać: do chaty `home` albo na posłanie na polu `target` - 1 */
  ToSleep = 21,
  /** Śpi: w chacie (`home`) albo na słomie pod gołym niebem (`target` = pole + 1) */
  Sleeping = 22,
  /** Rekrut: wolny chłop idzie do koszar `job`, gdzie dostanie broń (`enlist` = rodzaj jednostki + 1) */
  ToEnlist = 23,
}

export interface Unit {
  id: number;
  owner: number;
  /** Gaszenie: 1 = idzie do studni (`target` = studnia), 2 = niesie wiadro do pożaru (`target` = płonący budynek) */
  bucket?: number;
  /** Płonący budynek, do którego niesie wodę (gdy idzie do studni) */
  fireAt?: number;
  /** Rekrut w drodze do koszar: rodzaj jednostki + 1 (0/brak = zwykły chłop) */
  enlist?: number;
  /** Pozycja w stałym przecinku (środek pola = pole * 256 + 128) */
  px: number;
  py: number;
  path: number[];
  /** Id budynku, w którym pracuje, albo 0 */
  job: number;
  phase: Phase;
  timer: number;
  /** Ile ticków czeka przed kolejną próbą znalezienia drogi */
  wait: number;
  /** Indeks niesionego surowca albo -1 */
  carryRes: number;
  carryAmt: number;
  /** Ile partii towaru zostało jeszcze do zrobienia z przyniesionego surowca */
  batches: number;
  /** Dostawy od ostatniego odpoczynku */
  trips: number;
  /** Id chaty, w której właśnie odpoczywa, albo 0 */
  home: number;
  /** Zdrowie chłopa (brak = pełne 30); wilki go ranią, a on się broni */
  hp?: number;
  /** Id budynku, przy którym ma zapalić pochodnię, albo 0 */
  target: number;
  /** Do kiedy (tick) ucieka przed wrogiem: nie szuka nowej drogi ucieczki co chwilę */
  /** Wrogi żołnierz, przed którym odważny chłop stanął (twarzą do niego, okłada go); 0 = nikt */
  foe?: number;
  /** Wrogi chłop, z którym ten się właśnie bije (wręcz, kilofem albo maczugą) */
  foeU?: number;
  fled?: number;
}

/** Żołnierz: osobno od chłopów, bo nie pracuje, nie mieszka i nie liczy się do ludności osady */
export interface Soldier {
  id: number;
  owner: number;
  /** Indeks w data/units.ts */
  kind: number;
  px: number;
  py: number;
  path: number[];
  hp: number;
  /** Pole, na które ma dojść, albo -1 */
  goal: number;
  wait: number;
  /** Id wroga, z którym walczy, albo 0 */
  target: number;
  /** Ticki do następnego ciosu */
  cd: number;
  /** Id wilka, na którego gracz go posłał */
  hunt?: number;
  /** Wieża strażnicza, na którą idzie albo na której stoi */
  post?: number;
  /** Stoi na wieży: strzela dalej, wręcz nikt go nie dosięgnie */
  up?: boolean;
  /** Kierunek, w który ma patrzeć po dojściu (0–7, co 45°; 0 = na +y) */
  face?: number;
  /** Postawa: 0/brak = atak (goni wroga), 1 = obrona (krótko i wraca), 2 = stój (nie rusza się z miejsca) */
  stance?: number;
  /** Pole, którego pilnuje w obronie i w postawie „stój” (-1 = brak) */
  hold?: number;
  /** Numer rozkazu: żołnierze z tego samego rozkazu stoją razem jako jeden oddział */
  grp?: number;
  /** Atak w marszu: idzie na miejsce, ale bije każdego wroga, którego spotka po drodze */
  amove?: boolean;
  /** Wspólne tempo oddziału w marszu (szybkość najwolniejszego), zamiast własnej */
  pace?: number;
  /** Rozbieg: rośnie, gdy idzie, maleje, gdy stoi; po długim rozbiegu pierwszy cios to szarża */
  run?: number;
  /** Wrogi chłop wskazany rozkazem ataku: goni go aż do skutku */
  prey?: number;
  /** Chłop, w którego właśnie bije (dla animacji ciosu i strzału) */
  hitting?: number;
  /** Strażnik miejski: numer punktu obchodu, do którego idzie */
  beat?: number;
  /** Miejsce w zwartym szyku w marszu: [w bok, w tył] w polach względem punktu prowadzącego oddział */
  slot?: [number, number];
  /** Szyk „ścisk”: po dojściu stoi ramię w ramię z kolegami (zbicie tylko w wyglądzie, pola w symulacji jak w bloku) */
  tight?: boolean;
  /** Ranny: 1 = cofa się za szyk, 2 = idzie do twierdzy i tam się leczy */
  wounded?: number;
  /** Wróg, do którego nie ma przejścia (za murem), i do kiedy go pomijać przy wyborze celu */
  skip?: number;
  skipUntil?: number;
  /** Ile ticków maruder jest daleko od swojego miejsca w zwartym marszu */
  lost?: number;
}

/** Oddział w zwartym marszu: punkt prowadzący idzie jedną drogą, każdy żołnierz trzyma swoje miejsce obok niego */
export interface March {
  /** Numer rozkazu (Soldier.grp) */
  grp: number;
  owner: number;
  /** Droga punktu prowadzącego (pola), aż do celu */
  path: number[];
  px: number;
  py: number;
  /** Kierunek szyku w marszu (0–7) */
  dir: number;
  /** Tempo najwolniejszego w oddziale */
  pace: number;
  /** Ile ticków czeka na maruderów bez poprawy */
  stall: number;
  /** Suma odległości maruderów od miejsc w szyku (do sprawdzania, czy się zbliżają) */
  lag: number;
  /** Oddział ruszył (po zbiórce na starcie już nie czeka na maruderów) */
  go?: boolean;
}

/** Ciało poległego: leży, aż zabierze je grabarz z cmentarza */
export interface Corpse {
  id: number;
  owner: number;
  kind: number;
  px: number;
  py: number;
  /** Tick śmierci (do rozkładu w wyglądzie) */
  at: number;
  /** Grabarz już po nie idzie */
  taken: boolean;
}

/** Chłop w drodze: przychodzi spoza mapy do twierdzy albo odchodzi za mapę. Żaden system go nie zatrudnia. */
export interface Traveler {
  id: number;
  owner: number;
  px: number;
  py: number;
  /** Cel w stałym przecinku */
  tx: number;
  ty: number;
  leaving: boolean;
  /** Pola do przejścia (ostatnie na końcu tablicy jest najbliższe) */
  path: number[];
}

/** Wilk z lasu: poluje nocą, o świcie wraca za mapę */
export interface Wolf {
  id: number;
  px: number;
  py: number;
  hp: number;
  path: number[];
  target: number;
  cd: number;
  leaving: boolean;
  /** Id palisady, którą przegryza, gdy ludzie są za murem */
  gnaw?: number;
}

export interface GameState {
  tick: number;
  /** Przesunięcie pory roku w dniach (menu dewelopera: „ustaw porę roku”) */
  seasonShift?: number;
  map: GameMap;
  rng: Rng;
  players: PlayerState[];
  buildings: Building[];
  units: Unit[];
  soldiers: Soldier[];
  corpses: Corpse[];
  travelers: Traveler[];
  wolves: Wolf[];
  /** Brama na polu: właściciel + 1 (0 = brak). Swoi przechodzą, obcy nie */
  gates: Uint8Array;
  /** Ściany między polami (w zamku): bity 1 = ku -y, 2 = ku +x, 4 = ku +y, 8 = ku -x; przez taką krawędź nie da się przejść */
  walls: Uint8Array;
  /** Id budynku na polu albo 0 */
  occupancy: Int32Array;
  /** Ile wejść do budynków leży na polu (takiego pola nie wolno zabudować) */
  reserved: Uint8Array;
  /** Pola lasu wycięte przez drwali, w kolejności wycinki (dla zapisu gry i renderera) */
  cut: number[];
  /** Ile razy wydobyto już surowiec z danego pola złoża */
  wear: Uint8Array;
  /** Drogi na polach: 0 brak, 1 piaskowa, 2 kamienna */
  roads: Uint8Array;
  /** Drogi zaplanowane, jeszcze nie ułożone (rodzaj na polu, 0 = brak): układają je wolni chłopi */
  roadPlan: Uint8Array;
  rubble: Rubble[];
  nextId: number;
  /** Oddziały w zwartym marszu */
  marches?: March[];
}

/** Poziom trudności botów: 0 pokojowy (tylko się bronią), 1 łatwy, 2 średni, 3 trudny */
/**
 * Nowa gra. `humans` = numery graczy-ludzi w meczu przez sieć: wszyscy zaczynają na równych zasadach,
 * reszta miejsc to boty. Bez `humans` człowiekiem jest gracz 0 i dostaje premię zależną od poziomu.
 */
export function createGame(seed: number, preset: keyof typeof MAP_PRESETS = '1v1', level = 2, dev = false, humans?: number[], instantBuild = true): GameState {
  const map = generateMap(seed, preset);
  const size = map.width * map.height;
  const g: GameState = {
    tick: 0, map, rng: new Rng(seed), players: [], buildings: [], units: [], soldiers: [], corpses: [], travelers: [], wolves: [],
    occupancy: new Int32Array(size), gates: new Uint8Array(size), walls: new Uint8Array(size), reserved: new Uint8Array(size), cut: [], wear: new Uint8Array(size), roads: new Uint8Array(size), roadPlan: new Uint8Array(size), rubble: [], nextId: 1,
  };
  const keep = buildingIndex('keep');
  const starts = [...map.starts].sort((a, b) => a.player - b.player);
  for (const s of starts) {
    const res = new Int32Array(RESOURCES.length);
    // gracz-człowiek dostaje na start tym więcej, im łatwiejszy poziom (pokojowy ×3, łatwy ×2, średni ×1, trudny ×0,75)
    const bonus = !humans && s.player === 0 ? [3, 2, 1, 0.75][level] ?? 1 : 1;
    for (const [k, v] of Object.entries(RULES.startResources)) res[resIndex(k as ResourceId)] = Math.round(v * bonus);
    g.players.push({
      id: s.player, team: s.team, res, popularity: RULES.startPopularity, popDelta: 0,
      rations: RULES.defaultRations, tax: RULES.defaultTax, bot: humans ? !humans.includes(s.player) : s.player !== 0, defeated: false, level, stats: { gathered: 0, trained: 0, kills: 0, lost: 0, built: 0, razed: 0 },
    });
    addBuilding(g, keep, s.player, s.x - (KEEP_SIZE >> 1), s.y - (KEEP_SIZE >> 1));
    paveForecourt(g, g.buildings[g.buildings.length - 1]!);
    // przed bramą zostaje wolny plac (stodoła trzyma tylko towary, jedzenie idzie do spichlerza)
    const L = s.x - FORECOURT.half - 2, R = s.x + FORECOURT.half + 2, Y = s.y + (KEEP_SIZE >> 1) + 2;
    const BARN = buildingIndex('barn'), GRAN = buildingIndex('granary');
    // spichlerz (jedzenie, najczęstsze kursy) po prawej albo po lewej stronie placu, stodoła po drugiej, obozowisko na końcu placu
    const granRight = placeAt(g, GRAN, s.player, R, Y);
    if (!granRight && !placeAt(g, GRAN, s.player, L - 1, Y)) placeNear(g, GRAN, s.player, s.x, s.y);
    if (!placeAt(g, BARN, s.player, granRight ? L - 2 : R, Y)) placeNear(g, BARN, s.player, s.x, s.y);
    placeAt(g, CAMP, s.player, s.x, s.y + (KEEP_SIZE >> 1) + FORECOURT.depth + 2) || placeAt(g, CAMP, s.player, s.x - 1, s.y + (KEEP_SIZE >> 1) + FORECOURT.depth + 2) || placeNear(g, CAMP, s.player, s.x, s.y);
    const extra = !humans && s.player === 0 ? [4, 2, 0, 0][level] ?? 0 : 0;
    for (let i = 0; i < RULES.startPeasants + extra; i++) spawnPeasant(g, s.player);
    if (dev && s.player === 0) {
      // do testów: każdy budynek gotowy przy twierdzy, dużo ludzi i zapasów
      const p = g.players[g.players.length - 1]!;
      p.dev = true;
      p.instantBuild = instantBuild;
      for (let i = 0; i < res.length; i++) res[i] = 2000;
      const skip = new Set(['keep', 'barn', 'camp', 'torch', 'palisade', 'gate', 'stoneGate']);
      for (const [i, d] of BUILDINGS.entries()) if (d.buildable && !d.road && !skip.has(d.id)) placeNear(g, i, s.player, s.x, s.y, 20);
      placeNear(g, buildingIndex('house'), s.player, s.x, s.y, 14);
      placeNear(g, buildingIndex('house'), s.player, s.x, s.y, 14);
      placeNear(g, CAMP, s.player, s.x, s.y, 14);
      for (let i = 0; i < 30; i++) spawnPeasant(g, s.player);
      devFortify(g, s.player);
    }
  }
  return g;
}

const CAMP = buildingIndex('camp');

/** Tryb deweloperski: miasto otoczone murem (tył i prawy bok kamienne, przód i lewy z bali) z bramami na każdym boku, wieże w narożnikach, drabiny na kamienny mur, oddział włóczników */
function devFortify(g: GameState, player: number): void {
  const { width: w, height: h } = g.map;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (const b of g.buildings) {
    if (b.owner !== player) continue;
    const d = BUILDINGS[b.type]!;
    const fw = b.rot % 2 ? d.h : d.w, fh = b.rot % 2 ? d.w : d.h;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + fw - 1); y1 = Math.max(y1, b.y + fh - 1);
  }
  x0 = Math.max(1, x0 - 3); y0 = Math.max(1, y0 - 3); x1 = Math.min(w - 2, x1 + 3); y1 = Math.min(h - 2, y1 + 3);
  const free = (x: number, y: number): boolean => {
    const t = y * w + x;
    return g.occupancy[t] === 0 && g.reserved[t] === 0 && TERRAIN_BUILDABLE(g.map.tiles[t]!);
  };
  const put = (id: string, x: number, y: number): boolean => {
    // mur idzie przez las i skały: pole zostaje wykarczowane (woda i góry zostają dziurą)
    const t = y * w + x, tile = g.map.tiles[t]!;
    if (g.occupancy[t] === 0 && g.reserved[t] === 0 && (tile === Terrain.Forest || tile === Terrain.Stone || tile === Terrain.Iron)) g.map.tiles[t] = Terrain.Grass;
    if (!free(x, y)) return false;
    addBuilding(g, buildingIndex(id), player, x, y);
    return true;
  };
  // boki: tył (północ) i prawy (wschód) z kamienia, przód i lewy z bali; brama na każdym boku (w kamiennym murze kamienna), z przodu na wprost bramy zamku
  const keepB = g.buildings.find((b) => b.owner === player && b.type === 0);
  const frontX = keepB ? Math.min(x1 - 1, Math.max(x0 + 1, keepB.x + KEEP_GATE[0])) : (x0 + x1) >> 1;
  const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
  const sides: { kind: string; tiles: [number, number][]; gate: number }[] = [
    { kind: 'stoneWall', tiles: Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y0] as [number, number]), gate: mx - x0 },
    { kind: 'palisade', tiles: Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y1] as [number, number]), gate: frontX - x0 },
    { kind: 'palisade', tiles: Array.from({ length: y1 - y0 - 1 }, (_, i) => [x0, y0 + 1 + i] as [number, number]), gate: my - y0 - 1 },
    { kind: 'stoneWall', tiles: Array.from({ length: y1 - y0 - 1 }, (_, i) => [x1, y0 + 1 + i] as [number, number]), gate: my - y0 - 1 },
  ];
  for (const side of sides) {
    // brama: na swoim miejscu, a gdy tam stoi budynek albo woda — na najbliższym wolnym polu tego boku
    let gate = -1;
    for (let d = 0; d < side.tiles.length && gate < 0; d++)
      for (const k of [side.gate + d, side.gate - d]) {
        const p = side.tiles[k];
        if (!p || k === 0 || k === side.tiles.length - 1) continue;
        if (put(side.kind === 'stoneWall' ? 'stoneGate' : 'gate', p[0], p[1])) { gate = k; break; }
      }
    side.tiles.forEach(([x, y], k) => { if (k !== gate) put(side.kind, x, y); });
  }
  // wieże tuż za narożnikami, w środku: przy kamiennym murze kamienne, w drewnianym rogu strażnica
  const stoneT = buildingIndex('stoneTower'), woodT = buildingIndex('watchtower');
  for (const [x, y, id] of [[x0 + 1, y0 + 1, stoneT], [x1 - 2, y0 + 1, stoneT], [x0 + 1, y1 - 2, woodT], [x1 - 2, y1 - 2, stoneT]] as const)
    if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) addBuilding(g, id, player, x, y);
  // drabiny na kamienne mury od środka osady (inaczej nikt nie wejdzie na koronę)
  for (const [x, y] of [[mx - 4, y0 + 1], [mx + 4, y0 + 1], [x1 - 1, my - 4], [x1 - 1, my + 4]] as const) if (free(x, y)) addBuilding(g, buildingIndex('ladder'), player, x, y);
  // po dwóch łuczników na każdej wieży
  const archer = UNITS.findIndex((u) => u.id === 'archer');
  for (const b of g.buildings) {
    if (b.owner !== player || (b.type !== stoneT && b.type !== woodT)) continue;
    for (let k = 0; k < (b.type === stoneT ? 3 : 2); k++) g.soldiers.push({ id: g.nextId++, owner: player, kind: archer, px: b.x * FP + FP, py: b.y * FP + FP, path: [], hp: UNITS[archer]!.hp, goal: -1, wait: 0, target: 0, cd: 0, post: b.id, up: true });
  }
  // dwudziestu włóczników przy twierdzy
  const keep = g.buildings.find((b) => b.owner === player && b.type === 0);
  if (!keep) return;
  let n = 0;
  for (let r = (KEEP_SIZE >> 1) + 2; r < 16 && n < 20; r++)
    for (let dy = -r; dy <= r && n < 20; dy++)
      for (let dx = -r; dx <= r && n < 20; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [kx, ky] = keepCenter(keep), x = kx + dx, y = ky + dy;
        if (x < 0 || y < 0 || x >= w || y >= h || g.occupancy[y * w + x] !== 0 || !TERRAIN_WALK(g.map.tiles[y * w + x]!)) continue;
        g.soldiers.push({ id: g.nextId++, owner: player, kind: 0, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNIT_HP(), goal: -1, wait: 0, target: 0, cd: 0 });
        n++;
      }
}

/** Wolne miejsce na budynek startowy z wolnym pasem dookoła (poza placem przed bramą) */
function startFree(g: GameState, def: { w: number; h: number }, x: number, y: number): boolean {
  const w = g.map.width;
  for (let ty = y - 1; ty <= y + def.h; ty++)
    for (let tx = x - 1; tx <= x + def.w; tx++) {
      const t = ty * w + tx;
      if (tx < 0 || ty < 0 || tx >= w || ty >= g.map.height || g.map.tiles[t] !== 0 || g.occupancy[t] !== 0 || g.reserved[t] !== 0 || inForecourt(g, tx, ty)) return false;
    }
  return true;
}
/** Stawia budynek startowy dokładnie tutaj, jeśli miejsce jest wolne */
function placeAt(g: GameState, type: number, player: number, x: number, y: number): boolean {
  if (!startFree(g, BUILDINGS[type]!, x, y)) return false;
  addBuilding(g, type, player, x, y);
  return true;
}

/** Stawia budynek startowy na pierwszym wolnym miejscu przy twierdzy (stała kolejność szukania). */
function placeNear(g: GameState, type: number, player: number, cx: number, cy: number, reach = 8): void {
  const def = BUILDINGS[type]!;
  for (let r = (KEEP_SIZE >> 1) + 2; r <= reach + (KEEP_SIZE >> 1); r++)
    // od frontu (strona bramy) do tyłu: stodoła, spichlerz i obozowisko stają blisko wejścia do zamku
    for (let dy = r; dy >= -r; dy--)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        // z wolnym pasem dookoła, żeby nic nie zatkało przejść
        if (startFree(g, def, x, y)) { addBuilding(g, type, player, x, y); return; }
      }
}

/** Miejsca dla bezrobotnych we wszystkich obozowiskach gracza. */
export function idleSlots(g: GameState, player: number): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === player && !b.build) n += BUILDINGS[b.type]!.idleSlots ?? 0;
  return n;
}

export function idleCount(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player && u.job === 0) n++;
  for (const t of g.travelers) if (t.owner === player && !t.leaving) n++; // idący do obozowiska już mają w nim miejsce
  return n;
}

/** Plac przed bramą zamku: tyle pól w głąb i w każdą stronę od osi bramy. Nie wolno tu budować (drogi tak). */
export const FORECOURT = { depth: 3, half: 3 };
/** Plac przed bramą wyłożony kamienną kostką (zwykła droga brukowana: szybciej się po nim chodzi) */
export function paveForecourt(g: GameState, k: { x: number; y: number }): void {
  const { width, height } = g.map, gx = k.x + KEEP_GATE[0], y0 = k.y + KEEP_SIZE;
  for (let d = 0; d < FORECOURT.depth; d++) for (let o = -FORECOURT.half; o <= FORECOURT.half; o++) {
    const x = gx + o, y = y0 + d, t = y * width + x;
    if (x >= 0 && y >= 0 && x < width && y < height && TERRAIN[g.map.tiles[t] as Terrain].walkable) g.roads[t] = 2;
  }
}
/** Czy pole leży na placu przed bramą któregoś zamku */
export function inForecourt(g: GameState, x: number, y: number): boolean {
  for (const k of g.buildings) {
    if (k.type !== 0) continue;
    const gx = k.x + KEEP_GATE[0], y0 = k.y + KEEP_SIZE;
    if (y >= y0 && y < y0 + FORECOURT.depth && Math.abs(x - gx) <= FORECOURT.half) return true;
  }
  return false;
}

/** Środek zamku (pole) */
export function keepCenter(k: { x: number; y: number }): [number, number] { return [k.x + (KEEP_SIZE >> 1), k.y + (KEEP_SIZE >> 1)]; }
/** Pole tuż przed bramą zamku (na zewnątrz) */
export function keepFront(k: { x: number; y: number }): [number, number] { return [k.x + KEEP_GATE[0], k.y + KEEP_GATE[1] + 1]; }

export function playerKeep(g: GameState, player: number): Building | undefined {
  return g.buildings.find((b) => b.owner === player && b.type === 0);
}

export function housing(g: GameState, player: number): number {
  let n = 0;
  for (const b of g.buildings) if (b.owner === player && !b.build) n += BUILDINGS[b.type]!.housing ?? 0;
  return n;
}

/** Łączna pojemność składów albo spichlerzy gracza. */
export function storeCapacity(g: GameState, player: number, kind: StoreKind): number {
  let n = 0;
  if (g.players[player]?.dev) return 1_000_000; // tryb deweloperski: składy bez limitu
  for (const b of g.buildings) if (b.owner === player && !b.build) n += BUILDINGS[b.type]!.capacity?.[kind] ?? 0;
  return n;
}

/** Ile surowców danego rodzaju gracz ma teraz w składach albo spichlerzach. */
export function storeUsed(p: PlayerState, kind: StoreKind): number {
  let n = 0;
  for (let i = 0; i < RESOURCES.length; i++) if (RESOURCE_DEFS[RESOURCES[i]!].store === kind) n += p.res[i]!;
  return n;
}

export function population(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player) n++;
  for (const t of g.travelers) if (t.owner === player && !t.leaving) n++; // idący do nas już się liczą
  return n;
}

/** Skrót całego stanu (FNV‑1a). Klienci porównują go, żeby wykryć rozjazd symulacji. */
export function stateHash(g: GameState): number {
  let h = 0x811c9dc5;
  const add = (v: number): void => {
    for (let i = 0; i < 4; i++) { h ^= (v >>> (i * 8)) & 255; h = Math.imul(h, 0x01000193); }
  };
  add(g.tick); add(g.rng.state); add(g.nextId); add(g.cut.length);
  for (let i = 0; i < g.map.tiles.length; i++) { h ^= g.map.tiles[i]!; h = Math.imul(h, 0x01000193); }
  for (let i = 0; i < g.wear.length; i++) if (g.wear[i]) { add(i); add(g.wear[i]!); }
  for (let i = 0; i < g.roads.length; i++) { if (g.roads[i]) { add(i); add(g.roads[i]! + 100); } if (g.roadPlan[i]) { add(i); add(g.roadPlan[i]! + 200); } }
  for (const r of g.rubble) { add(r.id); add(r.owner); add(r.x); add(r.y); add(r.loads.length); for (const [a, b] of r.loads) { add(a + 1); add(b); } }
  for (const p of g.players) {
    add(p.id); add(p.bot ? 1 : 0); add(p.defeated ? 1 : 0); add(p.left ? 1 : 0); add(p.level); for (const v of Object.values(p.stats)) add(v); add(p.popularity); add(p.popDelta); add(p.rations); add(p.tax); add(p.hungry ? 1 : 0);
    for (let i = 0; i < p.res.length; i++) add(p.res[i]!);
  }
  for (const b of g.buildings) { add(b.id); add(b.type); add(b.owner); add(b.x); add(b.y); add(b.door); add(b.worker); add(b.lit ? 1 : 0); add(b.rot); add(b.hp); add(b.build); add(b.shut ? 1 : 0); add(b.loads ?? 0); add(b.delivered ?? 0); add(b.haul ?? 0); add(b.enlistQ?.length ?? 0); add(b.fire ?? 0); add(b.off ? 1 : 0); for (const r of b.rally ?? []) add(r + 1); }
  for (const u of g.units) {
    add(u.id); add(u.owner); add(u.px); add(u.py); add(u.job); add(u.phase); add(u.timer); add(u.wait); add(u.fled ?? 0); add(u.foe ?? 0); add(u.foeU ?? 0); add(u.enlist ?? 0); add(u.bucket ?? 0); add(u.fireAt ?? 0);
    add(u.carryRes); add(u.carryAmt); add(u.trips); add(u.home); add(u.batches); add(u.target); add(u.path.length); add(u.hp ?? 30);
    for (const t of u.path) add(t);
  }
  for (const s of g.soldiers) { add(s.id); add(s.owner); add(s.kind); add(s.px); add(s.py); add(s.hp); add(s.goal + 1); add(s.wait); add(s.target); add(s.cd); add(s.face ?? 9); add(s.stance ?? 0); add((s.hold ?? -1) + 1); add(s.amove ? 1 : 0); add(s.pace ?? 0); add(s.run ?? 0); add(s.prey ?? 0); add(s.hitting ?? 0); add(s.slot ? s.slot[0] + 50 : 0); add(s.slot ? s.slot[1] + 50 : 0); add(s.wounded ?? 0); add(s.skip ?? 0); add(s.skipUntil ?? 0); add(s.lost ?? 0); add(s.path.length); for (const t of s.path) add(t); }
  for (const m of g.marches ?? []) { add(m.grp); add(m.px); add(m.py); add(m.dir); add(m.stall); add(m.go ? 1 : 0); add(m.path.length); }
  for (const w of g.wolves) { add(w.id); add(w.px); add(w.py); add(w.hp); }
  for (const t of g.travelers) { add(t.id); add(t.px); add(t.py); add(t.leaving ? 1 : 0); add(t.path.length); }
  for (const c of g.corpses) { add(c.id); add(c.px); add(c.py); add(c.at); add(c.taken ? 1 : 0); }
  return h >>> 0;
}

/**
 * Szybkie wyszukiwanie po id (zamiast przeglądać całą listę za każdym razem).
 * Indeks buduje się leniwie i jest ważny, dopóki lista jest ta sama (ta sama tablica i długość) w tym samym ticku.
 */
interface IdIndex<T> { list: readonly T[]; len: number; last: T | undefined; tick: number; map: Map<number, T> }
const bIdx = new WeakMap<GameState, IdIndex<Building>>();
const uIdx = new WeakMap<GameState, IdIndex<Unit>>();
function lookup<T extends { id: number }>(cache: WeakMap<GameState, IdIndex<T>>, g: GameState, list: readonly T[], id: number | undefined): T | undefined {
  let ix = cache.get(g);
  if (!ix || ix.list !== list || ix.len !== list.length || ix.last !== list[list.length - 1] || ix.tick !== g.tick) {
    const map = new Map<number, T>();
    for (const x of list) map.set(x.id, x);
    ix = { list, len: list.length, last: list[list.length - 1], tick: g.tick, map };
    cache.set(g, ix);
  }
  // (splice zmienia długość, splice + push — ostatni element, więc oba unieważniają indeks)
  return id === undefined ? undefined : ix.map.get(id);
}
export const buildingById = (g: GameState, id: number | undefined): Building | undefined => lookup(bIdx, g, g.buildings, id);
export const unitById = (g: GameState, id: number | undefined): Unit | undefined => lookup(uIdx, g, g.units, id);

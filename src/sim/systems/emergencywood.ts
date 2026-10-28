import { BUILDINGS, buildingIndex } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import { Terrain } from '../../data/terrain';
import { findPath } from '../path';
import { Phase, type Building, type GameState, type Pile, type Unit } from '../state';
import { dayPart } from './workers';
import { spareKeeper, storesOf } from './storage';

/**
 * Rąbanie z biedy (Michał 28.10.2026, opis w docs/magazyny.md → „Rąbanie z biedy”).
 *
 * Sytuacja kryzysowa: osada nie ma składu na drewno albo chaty drwala, a drewna brakuje nawet na to, czego brak
 * (skład 15, drwal 15). Bez tego osada stała na zawsze — nie było za co postawić składu ani drwala.
 * Wtedy JEDEN wolny chłop (a gdy przy ognisku nikogo nie ma — wolny magazynier) idzie do lasu, ścina drzewo
 * (`FELL_TICKS`), a potem na miejscu, przy pniu, ociosuje i tnie leżący pień (`PROCESS_TICKS`) — dużo wolniej niż drwal
 * w chacie i z mniejszym urobkiem.
 *
 * Deski z biedy leżą naprawdę: bez składu zostają przy pniu jako stos (`Pile.held`) i od razu liczą się do zapasów,
 * więc można za nie postawić skład. Budowniczowie noszą z tych stosów ładunki na plac budowy, a gdy stanie skład,
 * magazynier znosi resztę do niego. Gdy skład już stoi, rąbiący sam zanosi deski do składu.
 *
 * Gdy osada ma i skład, i chatę drwala (choćby w budowie, bo za nie już zapłacono), albo drewna starcza — nikt nie
 * rąbie z biedy, robotę robi drwal. Rąbanie czeka też, póki stoi zapłacony plac budowy: rąbiący jest często jedynymi
 * wolnymi rękami, więc najpierw idzie budować to, na co już narąbał.
 *
 * Wydajność: decyzja co `EVERY` ticków na gracza (jedno przejście po budynkach), krok rąbiącego to jeden licznik,
 * wyrównanie stosów tylko wtedy, gdy jakiś stos z biedy leży.
 */
const EVERY = 20;
/** Ścinanie drzewa (drwal: 13 s) */
export const FELL_TICKS = 150;
/** Ociosywanie i cięcie pnia przy pniaku (drwal tnie w chacie) */
export const PROCESS_TICKS = 150;
/** Ile drewna daje jedno drzewo ścięte z biedy */
export const CHOP_WOOD = 5;

const WOOD = resIndex('wood');
const STOCKPILE = buildingIndex('stockpile');
const WOODCUTTER = buildingIndex('woodcutter');

/** Ile drewna brakuje osadzie na skład i drwala, których nie ma (0 = nie ma kryzysu) */
export function woodCrisis(g: GameState, owner: number): number {
  let store = false, cutter = false;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.ruined) continue;
    const def = BUILDINGS[b.type]!;
    if (def.stores?.includes('stockpile')) store = true;
    if (b.type === WOODCUTTER) cutter = true;
    // zapłacony plac budowy: najpierw trzeba go postawić (rąbiący idzie na budowę), potem dalej rąbać
    if (b.build > 0 && !b.unpaid) return 0;
  }
  const need = (store ? 0 : BUILDINGS[STOCKPILE]!.cost.wood ?? 0) + (cutter ? 0 : BUILDINGS[WOODCUTTER]!.cost.wood ?? 0);
  const p = g.players[owner];
  if (!p || !need) return 0;
  return p.res[WOOD]! < need ? need : 0;
}

const tileOf = (g: GameState, u: Unit): number => (u.py >> 8) * g.map.width + (u.px >> 8);

function release(u: Unit): void {
  u.chop = undefined;
  if (u.phase === Phase.ToSite || u.phase === Phase.WorkingSite || u.phase === Phase.Working) { u.phase = Phase.Idle; u.path = []; u.timer = 0; }
}

/** Raz na kilkanaście ticków: kto ma rąbać z biedy (najwyżej jeden chłop na gracza) */
export function emergencyWoodSystem(g: GameState): void {
  if (g.tick % 5 === 0) heldSync(g);
  if (g.tick % EVERY !== 0) return;
  const work = dayPart(g.tick) === 'work';
  for (const p of g.players) {
    if (p.defeated) continue;
    const crisis = work && woodCrisis(g, p.id) > 0;
    let chopper: Unit | undefined;
    for (const u of g.units) {
      if (u.owner !== p.id || !u.chop) continue;
      // dostał prawdziwą pracę, poszedł do koszar albo kryzys minął: przestaje rąbać
      // (ociosywanego pnia nie rzuca w połowie, gdy kryzys minął — kończy go, chyba że dostał prawdziwą pracę)
      if (u.job || chopper || (!crisis && u.phase !== Phase.Working)) release(u); else chopper = u;
    }
    if (!crisis || chopper) continue;
    const u = g.units.find((x) => x.owner === p.id && x.job === 0 && x.phase === Phase.Idle && x.carryRes < 0 && x.target === 0
      && !x.riot && !x.enlist && !x.bucket && !x.sick) ?? spareKeeper(g, p.id); // przy ognisku nikogo: magazynier to rezerwa rąk (storage.ts)
    if (!u) continue;
    u.chop = 1; u.phase = Phase.ToSite; u.path = []; u.wait = 0; u.timer = 0;
  }
}

/**
 * Krok rąbiącego z biedy (woła go workerSystem zamiast zwykłej roboty). Zwraca false, gdy chłop już nie rąbie
 * (np. wieczór zmienił mu fazę) — wtedy prowadzi go dalej zwykła logika.
 */
export function chopStep(g: GameState, u: Unit): boolean {
  if (u.phase !== Phase.ToSite && u.phase !== Phase.WorkingSite && u.phase !== Phase.Working) { u.chop = undefined; return false; }
  if (u.phase === Phase.WorkingSite) {
    // ścina: pod koniec drzewo się wali (render/scene.ts → syncForest), potem leży pień do obróbki
    if (--u.timer > 0) return true;
    const tile = tileOf(g, u);
    if (g.map.tiles[tile] === Terrain.Forest) { g.map.tiles[tile] = Terrain.Grass; g.cut.push(tile); }
    u.phase = Phase.Working; u.timer = PROCESS_TICKS;
    return true;
  }
  if (u.phase === Phase.Working) {
    // ociosuje i tnie pień przy pniaku (render pokazuje leżący, coraz krótszy pień)
    if (--u.timer > 0) return true;
    const p = g.players[u.owner]!;
    p.stats.gathered += CHOP_WOOD;
    if (storesOf(g, u.owner, 'stockpile').length) {
      // skład już stoi: deski idą do niego (dalej prowadzi go zwykła logika noszenia), potem wraca do ogniska
      u.chop = undefined; u.carryRes = WOOD; u.carryAmt = CHOP_WOOD; u.phase = Phase.ToStore; u.path = [];
      return true;
    }
    // bez składu: deski zostają przy pniaku (prawdziwy stos) i od razu liczą się do zapasów
    p.res[WOOD]! += CHOP_WOOD;
    addHeld(g, u.owner, tileOf(g, u), CHOP_WOOD);
    u.phase = Phase.ToSite; u.timer = 0;
    return true;
  }
  if (u.path.length) return false; // idzie: krok robi zwykły move w workerSystem
  const here = tileOf(g, u);
  const isTree = (t: number): boolean => g.map.tiles[t] === Terrain.Forest && g.occupancy[t] === 0;
  if (isTree(here)) { u.phase = Phase.WorkingSite; u.timer = FELL_TICKS; return true; }
  const path = findPath(g, here, isTree, 900, u.owner, -1, 0, true);
  if (path && path.length) u.path = path;
  else { u.chop = undefined; u.phase = Phase.Idle; u.wait = 40; } // las nieosiągalny: wraca do ogniska
  return true;
}

// --- stosy desek z biedy (Pile.held): leżą poza składem, a już liczą się do zapasów gracza ---

const heldOf = (g: GameState): Pile[] => (g.piles ?? []).filter((p) => p.held);

function addHeld(g: GameState, owner: number, t: number, amt: number): void {
  const list = (g.piles ??= []);
  const same = list.find((p) => p.held && p.owner === owner && p.res === WOOD && p.t === t && !p.claim);
  if (same) { same.amt += amt; return; }
  list.push({ id: g.nextId++, owner, res: WOOD, amt, store: 0, t, claim: 0, at: g.tick, held: 1 });
}

/** Ile drewna z biedy leży u gracza poza składami (stock.ts odejmuje to od zapasów przy rozkładaniu po magazynach) */
export function heldAmount(g: GameState, owner: number, res: number): number {
  let n = 0;
  for (const p of g.piles ?? []) if (p.held && p.owner === owner && p.res === res) n += p.amt;
  return n;
}

/** Pola ze stosami z biedy danego surowca (budowniczy idzie tam po ładunek, gdy nie ma składu) */
export function heldTiles(g: GameState, owner: number, res: number): Set<number> {
  const out = new Set<number>();
  for (const p of g.piles ?? []) if (p.held && p.owner === owner && p.res === res && p.amt > 0) out.add(p.t);
  return out;
}

/** Ile drewna z jednego ładunku na ten plac budowy (koszt w drewnie rozłożony na wszystkie ładunki) */
const perLoad = (b: Building): number => Math.max(1, Math.ceil((BUILDINGS[b.type]!.cost.wood ?? 0) / Math.max(1, b.loads ?? 1)));

/** Budowniczy doszedł do stosu z biedy: zabiera z niego deski na jeden ładunek (zapłacone już przy stawianiu) */
export function takeHeld(g: GameState, owner: number, t: number, res: number, site: Building | undefined): void {
  const list = g.piles ?? [];
  const i = list.findIndex((p) => p.held && p.owner === owner && p.res === res && p.t === t);
  const p = list[i];
  if (!p) return;
  p.amt -= Math.min(p.amt, site ? perLoad(site) : 1);
  if (p.amt <= 0) list.splice(i, 1);
}

/**
 * Wyrównuje stosy z biedy z zapasami gracza: wydane drewno (zapłata za budynek) znika ze stosów, ale tylko to, czego
 * budowniczowie nie przyniosą jeszcze ze stosu na plac (te deski leżą, dopóki ktoś po nie nie przyjdzie).
 */
function heldSync(g: GameState): void {
  const held = heldOf(g);
  if (!held.length) return;
  const owners = new Set(held.map((p) => p.owner));
  for (const owner of owners) {
    const p = g.players[owner];
    if (!p) continue;
    const res = WOOD;
    const stores = storesOf(g, owner, 'stockpile');
    let inStores = 0;
    for (const b of stores) inStores += b.stock?.[res] ?? 0;
    // bez składu: deski na place budowy, które ktoś jeszcze ma przynieść ze stosu
    let reserve = 0;
    if (!stores.length) {
      for (const b of g.buildings) {
        if (b.owner !== owner || !(b.build > 0) || !b.loads || !(BUILDINGS[b.type]!.cost.wood ?? 0)) continue;
        let carrying = 0;
        for (const u of g.units) if (u.target === b.id && u.phase === Phase.ToRepair && u.carryRes >= 0) carrying++;
        reserve += perLoad(b) * Math.max(0, b.loads - (b.delivered ?? 0) - carrying);
      }
    }
    let over = heldAmount(g, owner, res) - Math.max(0, p.res[res]! - inStores) - reserve;
    if (over <= 0) continue;
    // najpierw z najmłodszych stosów (najstarsze leżą najdłużej i po nie idą budowniczowie)
    const mine = held.filter((x) => x.owner === owner && x.res === res && !x.claim).sort((a, b) => b.at - a.at || b.id - a.id);
    for (const x of mine) { if (over <= 0) break; const take = Math.min(over, x.amt); x.amt -= take; over -= take; }
    g.piles = (g.piles ?? []).filter((x) => x.amt > 0);
  }
}

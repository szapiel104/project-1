import { BUILDINGS, buildingIndex } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import { Terrain } from '../../data/terrain';
import { findPath } from '../path';
import { Phase, type GameState, type Unit } from '../state';
import { dayPart } from './workers';
import { spareKeeper, storesOf } from './storage';

/**
 * Rąbanie z biedy (Michał 28.10.2026, opis w docs/magazyny.md → „Rąbanie z biedy”).
 *
 * Sytuacja kryzysowa: osada nie ma składu na drewno albo chaty drwala, a drewna brakuje nawet na to, czego brak
 * (skład 15, drwal 15). Bez tego osada stała na zawsze — nie było za co postawić składu ani drwala.
 * Wtedy JEDEN wolny chłop (a gdy przy ognisku nikogo nie ma — wolny magazynier) idzie do lasu, sam ścina drzewo i obrabia pień na miejscu, przy drzewie — dużo wolniej
 * niż drwal w chacie i z mniejszym urobkiem. Bez składu drewno liczy się od razu do zapasów (leży przy pniu);
 * gdy skład już stoi, chłop zanosi deski do niego. Gdy osada ma i skład, i chatę drwala (choćby w budowie,
 * bo za nie już zapłacono), albo drewna starcza — nikt nie rąbie z biedy, robotę robi drwal.
 *
 * Wydajność: decyzja co `EVERY` ticków na gracza (jedno przejście po budynkach), krok rąbiącego to jeden licznik.
 */
const EVERY = 20;
/** Ścięcie i obróbka jednego drzewa przy pniu (drwal: 13 s ścinki + cięcie w chacie, 12 desek z drzewa) */
export const CHOP_TICKS = 300;
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
  }
  const need = (store ? 0 : BUILDINGS[STOCKPILE]!.cost.wood ?? 0) + (cutter ? 0 : BUILDINGS[WOODCUTTER]!.cost.wood ?? 0);
  const p = g.players[owner];
  if (!p || !need) return 0;
  return p.res[WOOD]! < need ? need : 0;
}

const tileOf = (g: GameState, u: Unit): number => (u.py >> 8) * g.map.width + (u.px >> 8);

function release(u: Unit): void {
  u.chop = undefined;
  if (u.phase === Phase.ToSite || u.phase === Phase.WorkingSite) { u.phase = Phase.Idle; u.path = []; u.timer = 0; }
}

/** Raz na kilkanaście ticków: kto ma rąbać z biedy (najwyżej jeden chłop na gracza) */
export function emergencyWoodSystem(g: GameState): void {
  if (g.tick % EVERY !== 0) return;
  const work = dayPart(g.tick) === 'work';
  for (const p of g.players) {
    if (p.defeated) continue;
    const crisis = work && woodCrisis(g, p.id) > 0;
    let chopper: Unit | undefined;
    for (const u of g.units) {
      if (u.owner !== p.id || !u.chop) continue;
      // dostał prawdziwą pracę, poszedł do koszar albo kryzys minął: przestaje rąbać
      if (!crisis || u.job || chopper) release(u); else chopper = u;
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
  if (u.phase !== Phase.ToSite && u.phase !== Phase.WorkingSite) { u.chop = undefined; return false; }
  if (u.phase === Phase.WorkingSite) {
    if (--u.timer > 0) return true;
    const tile = tileOf(g, u);
    if (g.map.tiles[tile] === Terrain.Forest) { g.map.tiles[tile] = Terrain.Grass; g.cut.push(tile); }
    const p = g.players[u.owner]!;
    p.stats.gathered += CHOP_WOOD;
    if (storesOf(g, u.owner, 'stockpile').length) {
      // skład już stoi: deski idą do niego (dalej prowadzi go zwykła logika noszenia), potem wraca do ogniska
      u.chop = undefined; u.carryRes = WOOD; u.carryAmt = CHOP_WOOD; u.phase = Phase.ToStore; u.path = [];
      return true;
    }
    // bez składu: drewno leży przy pniu i od razu liczy się do zapasów (nowy skład je przejmie, stock.ts)
    p.res[WOOD]! += CHOP_WOOD;
    u.phase = Phase.ToSite; u.timer = 0;
    return true;
  }
  if (u.path.length) return false; // idzie: krok robi zwykły move w workerSystem
  const here = tileOf(g, u);
  const isTree = (t: number): boolean => g.map.tiles[t] === Terrain.Forest && g.occupancy[t] === 0;
  if (isTree(here)) { u.phase = Phase.WorkingSite; u.timer = CHOP_TICKS; return true; }
  const path = findPath(g, here, isTree, 900, u.owner, -1, 0, true);
  if (path && path.length) u.path = path;
  else { u.chop = undefined; u.phase = Phase.Idle; u.wait = 40; } // las nieosiągalny: wraca do ogniska
  return true;
}

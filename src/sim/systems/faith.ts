import { BUILDINGS } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { clockAt } from '../clock';
import type { GameState } from '../state';

/**
 * Kaznodzieja i święto (wiara w Ojca Płomienia, kapliczka z tools/models/shrine.py).
 *
 * Kapliczka ma swojego pracownika — kaznodzieję. Za dnia stoi przy niej, wieczorem mówi kazanie: staje z boku posągu,
 * przodem do ludzi, wznosi ręce, a na modlitwę przychodzi dwa razy więcej ludzi niż bez niego (co drugi zamiast co
 * czwartego z tych, którzy nie idą do karczmy). Kazanie podnosi nastroje o 1 więcej niż sama kapliczka.
 * Co `RULES.faith.feastEvery` dni jest święto: wieczorem pod kapliczkę idą wszyscy (poza karczmarzem i górnikami
 * z baraku), a cały dzień święta ludzie są w lepszym nastroju (składnik popularności „Święto”).
 */
const SHRINE = BUILDINGS.findIndex((b) => b.id === 'shrine');

/** Czy gracz ma choć jedną gotową kapliczkę z kaznodzieją */
export function preached(g: GameState, owner: number): boolean {
  return g.buildings.some((b) => b.owner === owner && b.type === SHRINE && !b.build && !b.ruined && b.worker !== 0 && !b.off);
}

/** Dzień święta (co feastEvery dni, nie w pierwszym dniu gry) */
export function feastDay(g: GameState): boolean {
  const day = clockAt(g.tick).day;
  return day > 1 && day % RULES.faith.feastEvery === 0;
}

/** Czy ten chłop idzie wieczorem pod kapliczkę (a nie przy ognisko) — reszta wyboru w workers.ts */
export function goesToPray(g: GameState, u: { id: number; owner: number }): boolean {
  if (u.id % 4 === 1) return true;
  if (!preached(g, u.owner)) return false;
  return u.id % 4 === 3 || feastDay(g);
}

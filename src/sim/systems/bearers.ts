/**
 * Dwóch do jednego zmarłego (Michał 28.10.2026): ciało niesie się w trumnie na noszach we dwóch, nigdy w pojedynkę.
 * Kto idzie po ciało, idzie tylko z pomocnikiem: wolny chłop spod twierdzy bierze drugiego wolnego z okolicy
 * (`pickBearer`), a grabarz — drugiego grabarza z cmentarza (cmentarz ma dwóch), a gdy ten zajęty, wolnego chłopa.
 * Bez pomocnika nikt nie rusza po ciało (czeka, aż ktoś się zwolni). Pomocnik (faza Bearing, `target` = id niosącego) nie szuka własnej drogi: idzie za
 * niosącym w stałej odległości, jak na drągu — z tyłu trumny. Gdy niosący zaczyna kopać grób, pomocnik kopie razem
 * z nim; gdy ciało trafi na cmentarz albo niosący zniknie, pomocnik wraca do obozowiska jako wolny.
 * Wygląd (trumna z desek między nimi, ręce przy uchwytach) — render/graves.ts i scene.ts.
 */
import { RULES } from '../../data/rules';
import { FP, Phase, type GameState, type Unit } from '../state';
import { CORPSE } from './workers';

/** Odległość pomocnika za niosącym (w polach × FP): długość trumny z rękami przy uchwytach na obu końcach */
export const BEARER_GAP = Math.round(0.46 * FP);
/** Pomocnika szukamy tylko w takim promieniu (pola), żeby nie szedł przez pół osady na skróty */
const REACH = 6;

/** Wolny chłop w pobliżu `u`, który pomoże nieść trumnę (albo nikt) */
export function pickBearer(g: GameState, u: Unit): Unit | undefined {
  let best: Unit | undefined, bd = (REACH * FP) ** 2;
  for (const x of g.units) {
    if (x === u || x.owner !== u.owner || x.job !== 0 || x.phase !== Phase.Idle || x.path.length || x.carryRes >= 0 || x.riot || x.enlist || x.sick || x.bucket) continue;
    const d = (x.px - u.px) ** 2 + (x.py - u.py) ** 2;
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}

/** Przypisuje pomocnika do niosącego */
export function addBearer(h: Unit, u: Unit): void {
  h.phase = Phase.Bearing; h.target = u.id; h.path = []; h.timer = 0; h.wait = 0;
}

/** Niosący jeszcze potrzebuje pomocnika: idzie po ciało albo je niesie */
const stillCarrying = (c: Unit): boolean => c.phase === Phase.ToCorpse || c.carryRes === CORPSE;

export function bearerSystem(g: GameState): void {
  let byId: Map<number, Unit> | undefined;
  for (const h of g.units) {
    if (h.phase !== Phase.Bearing) continue;
    byId ??= new Map(g.units.map((x) => [x.id, x]));
    const c = byId.get(h.target);
    if (c && c.phase === Phase.Burying) { h.phase = Phase.Burying; h.timer = c.timer; h.target = -1; continue; } // -1: kopie razem z nim, grób robi niosący
    if (!c || !stillCarrying(c)) { h.phase = Phase.Idle; h.target = 0; h.path = []; continue; }
    // stoi w stałej odległości za niosącym, po linii łączącej ich obu (jak drugi koniec drąga)
    const dx = c.px - h.px, dy = c.py - h.py, d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const tx = c.px - (dx / d) * BEARER_GAP, ty = c.py - (dy / d) * BEARER_GAP;
    // dochodzi do niosącego trochę szybciej niż zwykły chód, potem idzie z nim krok w krok
    const speed = Math.round(RULES.unitSpeed * 1.5);
    const mx = tx - h.px, my = ty - h.py, md = Math.hypot(mx, my);
    if (md <= speed) { h.px = Math.round(tx); h.py = Math.round(ty); }
    else { h.px += Math.round((mx / md) * speed); h.py += Math.round((my / md) * speed); }
  }
}

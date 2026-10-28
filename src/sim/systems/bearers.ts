/**
 * Dwóch do jednego zmarłego (Michał 28.10.2026): ciało niesie się w trumnie na noszach we dwóch, nigdy w pojedynkę.
 * Po ciało idą zawsze dwaj (`sendPair`): grabarze z cmentarza w jego terenie, a wszędzie indziej na ziemi gracza
 * wolni chłopi, a gdy ich brak — robotnicy oderwani na chwilę od roboty (`collectCorpses`, Michał 28.10.2026:
 * ciała nie mogą leżeć i gnić). Przy ciele pierwszy czeka na drugiego (`liftCorpse`), potem podnoszą trumnę. Pomocnik (faza Bearing, `target` = id niosącego) nie szuka własnej drogi: idzie za
 * niosącym w stałej odległości, jak na drągu — z tyłu trumny. Gdy niosący zaczyna kopać grób, pomocnik kopie razem
 * z nim; gdy ciało trafi na cmentarz albo niosący zniknie, pomocnik wraca do swoich zajęć.
 * Wygląd (trumna z desek między nimi, ręce przy uchwytach) — render/graves.ts i scene.ts.
 */
import { RULES } from '../../data/rules';
import { BUILDINGS } from '../../data/buildings';
import { FP, Phase, buildingById, type Corpse, type GameState, type Unit } from '../state';
import { CORPSE } from './workers';

/** Odległość pomocnika za niosącym (w polach × FP): długość trumny z rękami przy uchwytach na obu końcach */
export const BEARER_GAP = Math.round(0.46 * FP);
/** Do ciała wysyłamy ludzi najwyżej z takiej odległości (pola) */
const REACH = 30;
/** Ciało leży na ziemi gracza: tyle pól od twierdzy albo tyle od któregoś jego budynku */
const LAND_KEEP = 40, LAND_NEAR = 10;
/** Najwyżej tyle dwójek naraz sprząta ciała u jednego gracza (poza grabarzami) */
const PAIRS = 2;
/** Dwójka, która przez tyle ticków nie podniosła ciała (zablokowana droga, ktoś ich odwołał), rozchodzi się */
const STUCK = 1500;
/** Zajęcia, od których można oderwać robotnika do pochówku (wraca potem do swojej roboty) */
const DROP = new Set<Phase>([Phase.Idle, Phase.Returning, Phase.ToSite, Phase.WorkingSite, Phase.Working, Phase.ToRest, Phase.Resting]);
const CEMETERY = BUILDINGS.findIndex((b) => b.id === 'cemetery');

/** Kto może iść po ciało i z jakim pierwszeństwem: 0 wolny przy ognisku, 1 inny wolny, 2 robotnik od roboty; -1 nikt */
function rank(g: GameState, x: Unit, owner: number): number {
  if (x.owner !== owner || x.carryRes >= 0 || x.riot || x.enlist || x.sick || x.bucket) return -1;
  if (x.job === 0) {
    if (x.phase === Phase.Idle && !x.path.length) return 0;
    return x.phase === Phase.Idle || x.phase === Phase.Returning ? 1 : -1;
  }
  if (!DROP.has(x.phase)) return -1;
  const b = buildingById(g, x.job);
  // grabarzy wysyła cmentarz, magów i kaznodzieję nie odrywamy od ich zajęć
  if (!b || b.type === CEMETERY || BUILDINGS[b.type]!.id === 'shrine' || /^mage/.test(BUILDINGS[b.type]!.id)) return -1;
  return 2;
}

/** Najlepsza para rąk do niesienia w pobliżu (px, py): najpierw wolni, potem robotnicy; najbliżsi */
export function handFor(g: GameState, owner: number, px: number, py: number, skip?: Unit): Unit | undefined {
  let best: Unit | undefined, br = 9, bd = (REACH * FP) ** 2;
  for (const x of g.units) {
    if (x === skip) continue;
    const r = rank(g, x, owner);
    if (r < 0 || r > br) continue;
    const d = (x.px - px) ** 2 + (x.py - py) ** 2;
    if (d > (REACH * FP) ** 2) continue;
    if (r < br || d < bd) { br = r; bd = d; best = x; }
  }
  return best;
}

/** Wysyła dwóch po ciało: `a` poniesie z przodu, `b` z tyłu */
export function sendPair(g: GameState, c: Corpse, a: Unit, b: Unit): void {
  c.taken = true; c.by = [a.id, b.id]; c.since = g.tick;
  for (const u of [a, b]) { u.phase = Phase.ToCorpse; u.target = c.id; u.path = []; u.wait = 0; u.timer = 0; }
}

/** Ciało wraca do puli (dwójka rozeszła się albo utknęła); kto jeszcze po nie szedł, wraca do swoich zajęć */
function release(g: GameState, c: Corpse): void {
  for (const u of g.units) if (u.phase === Phase.ToCorpse && u.target === c.id) { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; u.path = []; }
  c.taken = false; delete c.by; delete c.since;
}

/** Doszedł do ciała: gdy drugi już jest obok, przedni bierze trumnę, a tylny chwyta drągi; inaczej czeka */
export function liftCorpse(g: GameState, u: Unit): void {
  const c = g.corpses.find((x) => x.id === u.target);
  if (!c) { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; return; }
  const [ia, ib] = c.by ?? [u.id, 0];
  const other = g.units.find((x) => x.id === (u.id === ia ? ib : ia));
  // drugi jeszcze w drodze: czeka chwilę przy ciele
  if (other && other.phase === Phase.ToCorpse && other.target === c.id && ((other.px - u.px) ** 2 + (other.py - u.py) ** 2 > (1.6 * FP) ** 2 || other.path.length)) { u.wait = 5; return; }
  if (!other || other.phase !== Phase.ToCorpse || other.target !== c.id) { release(g, c); return; } // drugiego odwołano: ciało czeka na nową dwójkę
  const lead = u.id === ia ? u : other, help = lead === u ? other : u;
  g.corpses = g.corpses.filter((x) => x !== c);
  lead.target = 0; lead.carryRes = CORPSE; lead.carryAmt = 1; lead.phase = Phase.Returning; lead.path = []; lead.wait = 0;
  addBearer(help, lead);
}

/** Ciało leży na ziemi gracza (przy jego twierdzy albo przy którymś z jego budynków) */
function onLand(g: GameState, owner: number, c: Corpse): boolean {
  const x = c.px >> 8, y = c.py >> 8;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.ruined) continue;
    const lim = b.type === 0 ? LAND_KEEP : LAND_NEAR;
    if (Math.abs(b.x - x) + Math.abs(b.y - y) < lim) return true;
  }
  return false;
}

/**
 * Sprzątanie ciał poza zasięgiem grabarza: każde ciało na ziemi gracza ktoś w końcu zabierze. Najpierw idą wolni
 * chłopi, a gdy ich nie ma, gracz odrywa od roboty dwóch najbliższych robotników (po pochówku wracają do warsztatów).
 * Najstarsze ciała najpierw, żeby nie zgniły. Co 10 ticków (army.ts → graveSystem).
 */
export function collectCorpses(g: GameState): void {
  // dwójki, które utknęły albo się rozeszły, zwalniają ciało
  for (const c of g.corpses) {
    if (!c.taken || !c.by) continue;
    const going = g.units.filter((u) => u.phase === Phase.ToCorpse && u.target === c.id).length;
    if (going < 2 || g.tick - (c.since ?? g.tick) > STUCK) release(g, c);
  }
  if (!g.corpses.some((c) => !c.taken)) return;
  for (const p of g.players) {
    let pairs = 0;
    for (const u of g.units) if (u.owner === p.id && (u.phase === Phase.ToCorpse || (u.carryRes === CORPSE && u.phase !== Phase.Burying)) && !(u.job && buildingById(g, u.job)?.type === CEMETERY)) pairs++;
    pairs = Math.ceil(pairs / 2);
    while (pairs < PAIRS) {
      let c: Corpse | undefined;
      for (const x of g.corpses) if (!x.taken && (!c || x.at < c.at) && onLand(g, p.id, x)) c = x;
      if (!c) break;
      const a = handFor(g, p.id, c.px, c.py);
      const b = a && handFor(g, p.id, c.px, c.py, a);
      if (!a || !b) break;
      sendPair(g, c, a, b);
      pairs++;
    }
  }
}

/** Tylny chwyta drągi i idzie za przednim */
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
    if (!c || !stillCarrying(c)) { h.phase = h.job ? Phase.Returning : Phase.Idle; h.target = 0; h.path = []; continue; }
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

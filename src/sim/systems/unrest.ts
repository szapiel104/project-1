import { resIndex } from '../../data/resources';
import { GUARD } from '../../data/units';
import { RULES } from '../../data/rules';
import { findPath } from '../path';
import { Phase, playerKeep, population, type GameState, type PlayerState, type Unit } from '../state';
import { FOOD_VALUE, foodTotal } from './economy';

/**
 * Bunt głodowy.
 * Gdy w osadzie brakuje jedzenia przez kilka posiłków z rzędu (licznik `famine` liczy economySystem), część chłopów
 * rzuca robotę i staje tłumem pod bramą twierdzy. Ich warsztaty, pola i kopalnie stoją, a bunt psuje nastroje.
 * Bez straży miejskiej buntuje się połowa ludzi, ze strażą około jednej trzeciej (pilnuje porządku jak straż
 * Starego Obozu). Bunt mija, gdy ludzie znów się najedzą: większe racje i straż gaszą go szybciej.
 * Buntownicy nie odchodzą z osady jak zwykli głodni (migrationSystem) — zostają i domagają się chleba.
 * Buntownik zostaje przy swoim zajęciu (`job`), więc po buncie wraca prosto do roboty.
 */
const EVERY = 10;
/** Tłum staje w pierścieniu 1–3 pól od bramy twierdzy (każdy w swoim miejscu, żeby nie stali jeden na drugim) */
const RING = 3;

export function famineLimit(): number {
  return RULES.revoltMeals;
}

/** Ilu ludzi gracza stoi teraz w tłumie pod bramą */
export function rioters(g: GameState, player: number): number {
  let n = 0;
  for (const u of g.units) if (u.owner === player && u.riot) n++;
  return n;
}

/** Ile porcji jedzenia kosztuje „Rozdaj chleb” (po kilka na każdego buntownika) */
export function doleCost(g: GameState, player: number): number {
  return rioters(g, player) * RULES.dolePortions;
}

/** Kolejność rozdawania: najpierw chleb (o niego krzyczą), potem jabłka, ryby na końcu */
const DOLE_ORDER = (['bread', 'apples', 'fish'] as const).map((r) => ({ i: resIndex(r), v: FOOD_VALUE[r] ?? 1 }));

/** Bunt się kończy: wszyscy wracają do roboty, rozkaz dla straży znika */
function endRevolt(g: GameState, p: PlayerState): void {
  p.revolt = undefined;
  p.quell = undefined;
  for (const u of g.units) if (u.owner === p.id && u.riot) calmDown(u);
}

/**
 * „Rozdaj chleb” z okna twierdzy: jednorazowo ze spichlerzy idzie po kilka porcji na każdego buntownika
 * (chleb pierwszy). Tłum od razu się rozchodzi, głód z rzędu znika, a popularność trochę rośnie.
 * Gdy jedzenia nie starczy na wszystkich, nic się nie dzieje (przycisk jest wtedy wyszarzony).
 */
export function dole(g: GameState, player: number): boolean {
  const p = g.players[player];
  if (!p || !p.revolt) return false;
  let need = doleCost(g, player);
  if (!need || foodTotal(p) < need) return false;
  for (const { i, v } of DOLE_ORDER) {
    if (need <= 0) break;
    const take = Math.min(p.res[i]!, Math.ceil(need / v));
    p.res[i]! -= take;
    need -= take * v;
  }
  p.famine = undefined;
  p.popularity = Math.min(RULES.maxPopularity, p.popularity + RULES.dolePopularity);
  endRevolt(g, p);
  return true;
}

/**
 * „Rozpędź tłum”: straż miejska idzie pod bramę i rozgania buntowników po kolei (każdy strażnik co chwilę jednego).
 * Popularność spada od razu, a głód nie mija — gdy dalej nie ma jedzenia, tłum zbierze się znów po kilku posiłkach.
 * Bez straży rozkaz nic nie robi.
 */
export function quell(g: GameState, player: number): boolean {
  const p = g.players[player];
  if (!p || !p.revolt || p.quell || !guardsOf(g, player).length) return false;
  p.quell = true;
  p.popularity = Math.max(0, p.popularity + RULES.quellPenalty);
  p.famine = Math.min(p.famine ?? 0, famineLimit() - RULES.quellMargin) || undefined;
  return true;
}

/** Żywi strażnicy miejscy gracza (bez straży kopalni) */
function guardsOf(g: GameState, player: number): GameState['soldiers'] {
  return g.soldiers.filter((s) => s.owner === player && s.kind === GUARD && !s.camp && s.hp > 0);
}

/** Strażnik rozgania buntowników w tym promieniu (w polach) */
const QUELL_REACH = 2;

function calmDown(u: Unit): void {
  u.riot = undefined;
  u.path = []; u.timer = 0; u.target = 0; u.wait = 0;
  u.phase = u.job ? Phase.Returning : Phase.Idle;
}

/** Kto może dołączyć do buntu: nie niesie towaru, nie gasi pożaru, nie idzie do wojska i nie śpi */
function canJoin(u: Unit, player: number): boolean {
  return u.owner === player && !u.riot && !u.enlist && !u.bucket && u.carryRes < 0
    && u.phase !== Phase.Sleeping && u.phase !== Phase.ToSleep && u.phase !== Phase.ToCorpse;
}

export function unrestSystem(g: GameState): void {
  if (g.tick % EVERY !== 0) return;
  const w = g.map.width;
  for (const p of g.players) {
    if (!p.revolt && (p.famine ?? 0) >= famineLimit()) p.revolt = true;
    else if (p.revolt && !p.famine) endRevolt(g, p);
    if (!p.revolt) continue;
    // straż rozpędza tłum: każdy strażnik przy tłumie odsyła jednego buntownika obok siebie do roboty (z guzem: −5 zdrowia);
    // nikt nowy nie dołącza, a gdy pod bramą nikogo nie zostanie, bunt się kończy
    if (p.quell) {
      for (const s of guardsOf(g, p.id)) {
        const u = g.units.find((x) => x.owner === p.id && x.riot && Math.max(Math.abs((x.px >> 8) - (s.px >> 8)), Math.abs((x.py >> 8) - (s.py >> 8))) <= QUELL_REACH);
        if (!u) continue;
        u.hp = Math.max(5, (u.hp ?? 30) - 5);
        calmDown(u);
      }
      if (!rioters(g, p.id) || !guardsOf(g, p.id).length) endRevolt(g, p);
      continue;
    }
    const keep = playerKeep(g, p.id);
    if (!keep || keep.door < 0) continue;
    const dx0 = keep.door % w, dy0 = (keep.door - dx0) / w;
    const share = (p.guards ?? 0) > 0 ? RULES.revoltShareGuarded : RULES.revoltShare;
    const want = Math.ceil(population(g, p.id) * share);
    let have = 0;
    for (const u of g.units) if (u.owner === p.id && u.riot) have++;
    // najpierw dołączają ci, którzy pracują (pusty brzuch, pusty warsztat), potem bezrobotni
    const cands = g.units.filter((u) => canJoin(u, p.id)).sort((a, b) => (b.job ? 1 : 0) - (a.job ? 1 : 0) || a.id - b.id);
    for (const u of cands) {
      if (have >= want) break;
      u.riot = 1; u.phase = Phase.Riot; u.timer = 0; u.target = 0; u.wait = 0; u.path = [];
      have++;
    }
    // buntownicy bez miejsca w tłumie szukają drogi pod bramę
    for (const u of g.units) {
      if (u.owner !== p.id || !u.riot || u.path.length || u.wait > 0) continue;
      const here = (u.py >> 8) * w + (u.px >> 8);
      const spot = (t: number): boolean => {
        const x = t % w, y = (t - x) / w, d = Math.max(Math.abs(x - dx0), Math.abs(y - dy0));
        return d >= 1 && d <= RING && (t + u.id) % 3 === 0;
      };
      if (spot(here) || u.target === 1) { u.target = 1; continue; }
      const path = findPath(g, here, spot, 3000, p.id, -1, 0, true);
      if (path && path.length) { u.path = path; u.target = 1; }
      else { u.target = 1; u.wait = 60; } // nie dojdzie (np. za murem): stoi tam, gdzie stoi
    }
  }
}

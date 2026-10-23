import { RULES } from '../../data/rules';
import { findPath } from '../path';
import { Phase, playerKeep, population, type GameState, type Unit } from '../state';

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
    else if (p.revolt && !p.famine) {
      p.revolt = undefined;
      for (const u of g.units) if (u.owner === p.id && u.riot) calmDown(u);
    }
    if (!p.revolt) continue;
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

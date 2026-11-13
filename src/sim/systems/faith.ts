import { BUILDINGS } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { clockAt, hourStarts } from '../clock';
import { findPath } from '../path';
import { FP, Phase, playerKeep, type GameState, type Unit } from '../state';

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

/**
 * Procesja w dzień święta (Michał 13.11.2026). O 16:00 kaznodzieja wychodzi z kapliczki i prowadzi ludzi gęsiego
 * przez osadę: pod bramę twierdzy, obok chat na skraju i z powrotem pod kapliczkę. Idą za nim ci, którzy akurat
 * nie niosą towaru, nie są chorzy ani w buncie (najwyżej PROC_FOLLOW, najbliżsi kapliczki) — na ten czas rzucają robotę,
 * a po procesji wracają do swoich warsztatów. Procesja, która przeszła, dokłada do nastrojów w dzień święta
 * (economy.ts: 'procession'). Bot ma to samo (to ta sama kapliczka i ten sam kaznodzieja).
 */
const PROC_HOUR = 16;
const PROC_FOLLOW = 10;
/** Najdłużej tyle trwa procesja (ok. 2,5 godziny gry), potem ludzie rozchodzą się, gdziekolwiek są */
const PROC_TICKS = 750;

export function processionSystem(g: GameState): void {
  if (feastDay(g) && g.tick > 0 && hourStarts(g.tick, PROC_HOUR)) for (const p of g.players) startProcession(g, p.id);
  const list = g.processions;
  if (!list?.length) return;
  const w = g.map.width;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i]!;
    const members = pr.members.map((id) => g.units.find((u) => u.id === id)).filter((u): u is Unit => !!u && u.procession === pr.id);
    const lead = members[0];
    const done = !lead || pr.leg >= pr.route.length || g.tick > pr.until;
    if (done) {
      if (lead && pr.leg >= pr.route.length) { const p = g.players[pr.owner]; if (p) p.processionDay = clockAt(g.tick).day; }
      for (const u of members) { u.procession = undefined; u.path = []; u.phase = u.job ? Phase.Returning : Phase.Idle; u.wait = 0; }
      list.splice(i, 1);
      continue;
    }
    // kaznodzieja: od przystanku do przystanku (czeka chwilę, aż reszta dojdzie)
    if (!lead.path.length) {
      const goal = pr.route[pr.leg]!, gx = goal % w, gy = (goal - gx) / w;
      if (Math.max(Math.abs((lead.px >> 8) - gx), Math.abs((lead.py >> 8) - gy)) <= 1) {
        const last = members[members.length - 1]!;
        if ((last.px - lead.px) ** 2 + (last.py - lead.py) ** 2 < (4 * FP) ** 2 || (g.tick + pr.id) % 60 === 0) pr.leg++;
      } else if ((g.tick + pr.id) % 10 === 0) {
        lead.path = findPath(g, (lead.py >> 8) * w + (lead.px >> 8), (t) => Math.abs((t % w) - gx) <= 1 && Math.abs(Math.floor(t / w) - gy) <= 1, 3000, pr.owner) ?? [];
        if (!lead.path.length) pr.leg++; // przystanek nieosiągalny: idzie do następnego
      }
    }
    // reszta gęsiego: każdy za tym przed sobą, półtora pola z tyłu
    for (let k = 1; k < members.length; k++) {
      const u = members[k]!, ahead = members[k - 1]!;
      if ((g.tick + u.id) % 8 !== 0) continue;
      const d2 = (ahead.px - u.px) ** 2 + (ahead.py - u.py) ** 2;
      if (d2 <= (1.5 * FP) ** 2) { u.path = []; continue; }
      const ax = ahead.px >> 8, ay = ahead.py >> 8;
      u.path = findPath(g, (u.py >> 8) * w + (u.px >> 8), (t) => Math.abs((t % w) - ax) <= 1 && Math.abs(Math.floor(t / w) - ay) <= 1, 600, pr.owner) ?? [];
    }
  }
}

function startProcession(g: GameState, owner: number): void {
  if (g.processions?.some((x) => x.owner === owner)) return;
  const shrine = g.buildings.find((b) => b.owner === owner && b.type === SHRINE && !b.build && !b.ruined && b.worker !== 0 && !b.off && b.door >= 0);
  const preacher = shrine && g.units.find((u) => u.id === shrine.worker);
  if (!shrine || !preacher || preacher.riot || preacher.sick || preacher.procession) return;
  const w = g.map.width;
  const keep = playerKeep(g, owner);
  // przystanki: brama twierdzy i dwie chaty najdalej od niej (skraj osady), na koniec z powrotem pod kapliczkę
  const route: number[] = [];
  if (keep && keep.door >= 0) route.push(keep.door);
  const homes = g.buildings.filter((b) => b.owner === owner && !b.build && !b.ruined && b.door >= 0 && (BUILDINGS[b.type]!.housing ?? 0) > 0);
  if (keep) homes.sort((a, b) => ((b.x - keep.x) ** 2 + (b.y - keep.y) ** 2) - ((a.x - keep.x) ** 2 + (a.y - keep.y) ** 2) || a.id - b.id);
  for (const h of homes.slice(0, 2)) route.push(h.door);
  route.push(shrine.door);
  const sx = shrine.door % w, sy = (shrine.door - sx) / w;
  const busy = new Set([Phase.ToCorpse, Phase.Bearing, Phase.Burying, Phase.Sleeping, Phase.ToSleep, Phase.ToEnlist]);
  const followers = g.units
    .filter((u) => u.owner === owner && u !== preacher && !u.riot && !u.sick && !u.enlist && !u.bucket && !u.hunting && !u.procession && u.carryRes < 0 && !busy.has(u.phase))
    .map((u) => ({ u, d: ((u.px >> 8) - sx) ** 2 + ((u.py >> 8) - sy) ** 2 }))
    .sort((a, b) => a.d - b.d || a.u.id - b.u.id)
    .slice(0, PROC_FOLLOW)
    .map((x) => x.u);
  const id = g.nextId++;
  for (const u of [preacher, ...followers]) { u.procession = id; u.path = []; u.wait = 0; u.target = 0; }
  (g.processions ??= []).push({ id, owner, shrine: shrine.id, route, leg: 0, members: [preacher.id, ...followers.map((u) => u.id)], until: g.tick + PROC_TICKS });
}

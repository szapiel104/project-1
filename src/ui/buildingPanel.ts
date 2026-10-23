/**
 * Okno budynku — dane do panelu (bez rysowania): plac budowy, warsztat (przepis, pracownik, co blokuje, tempo),
 * cech inżynierów, straż miejska i straż kopalni. Wyniesione z main.ts (23.10.2026); stan gry dostaje parametrem.
 */
import { BUILDINGS } from '../data/buildings';
import { RESOURCE_DEFS, RESOURCES, resIndex, type ResourceId } from '../data/resources';
import { RULES } from '../data/rules';
import { Terrain } from '../data/terrain';
import { UNITS } from '../data/units';
import { lang, t, tx } from '../i18n';
import { Phase, TICKS_PER_SECOND, storeCapacity, storeRoom, type GameState } from '../sim/state';
import { engineerJob } from '../sim/systems/army';
import { GUARDS, GUARD_COST } from '../sim/systems/guards';
import { CAMP_GUARDS, campOf } from '../sim/systems/minecamp';
import { buildWork, maxHp, rebuildCost, rebuildShort } from '../sim/systems/placement';
import { crewWanted, MINE_YIELDS } from '../sim/systems/workers';
import type { BuildingInfo } from './hud';

/** Plac budowy w panelu: postęp, materiał, robotnicy i co się teraz dzieje */
export function siteInfo(game: GameState, b: GameState['buildings'][number]): NonNullable<BuildingInfo['site']> {
  const work = buildWork(b.type);
  const pct = Math.max(0, Math.min(99, Math.floor((1 - b.build / work) * 100)));
  let carrying = 0, fetching = 0, builders = 0, hammering = 0;
  for (const u of game.units) {
    if (u.target !== b.id) continue;
    if (u.phase === Phase.ToFetch) fetching++;
    else if (u.phase === Phase.ToRepair && u.carryRes >= 0) carrying++;
    if (u.phase === Phase.ToFetch || u.phase === Phase.ToRepair || u.phase === Phase.Repairing) builders++;
    if (u.phase === Phase.Repairing) hammering++;
  }
  const loads = b.loads ?? 0, delivered = b.delivered ?? 0;
  const starved = loads > 0 && (1 - b.build / work) * loads >= delivered - 0.001;
  // ruina przed zapłatą: pokazujemy, ile kosztuje odbudowa i czego brakuje
  const cost = (list: [ResourceId, number][]): string => list.map(([k, v]) => `${v} ${t(RESOURCE_DEFS[k].name).toLowerCase()}`).join(', ');
  const short = b.unpaid ? rebuildShort(game, b) : [];
  const state = b.unpaid ? (short.length
      ? tx(`ruina — odbudowa kosztuje ${cost(rebuildCost(b.type))}; brakuje: ${cost(short)}`, `in ruins — rebuilding costs ${cost(rebuildCost(b.type))}; still short of ${cost(short)}`)
      : tx(`ruina — odbudowa kosztuje ${cost(rebuildCost(b.type))}, zapłata za chwilę`, `in ruins — rebuilding costs ${cost(rebuildCost(b.type))}, payment in a moment`))
    : !builders ? tx('brak wolnych ludzi — czeka na robotników', 'no idle hands — waiting for labourers')
    : starved && (fetching || carrying) ? tx('robotnicy niosą materiał ze składu', 'labourers are hauling materials from the stockpile')
    : starved ? tx('czeka na materiał', 'waiting for materials')
    : hammering ? tx('trwa budowa', 'construction under way') : tx('robotnicy idą na plac', 'labourers are heading to the site');
  return { pct, loads, delivered, carrying, fetching, builders, state };
}

/**
 * Warsztat w oknie budynku: z czego i co robi, kto pracuje i co teraz robi (z postępem), czy coś go blokuje,
 * ile zrobił (od postawienia i w ostatniej dobie), ile przepadło przez pełny skład i ile surowca leży na stanie.
 */
const madeLog = new Map<number, [number, number][]>();
let madeAt = -1;
/** Co 1/24 doby zapisujemy liczniki warsztatów gracza: z nich liczy się tempo z ostatniej doby */
export function sampleMade(game: GameState, ME: number): void {
  if (madeAt >= 0 && game.tick - madeAt < RULES.dayTicks / 24 && game.tick >= madeAt) return;
  madeAt = game.tick;
  const alive = new Set<number>();
  for (const b of game.buildings) {
    if (b.owner !== ME || !BUILDINGS[b.type]!.production || b.build) continue;
    alive.add(b.id);
    let log = madeLog.get(b.id);
    if (!log) { log = []; madeLog.set(b.id, log); }
    log.push([game.tick, b.made ?? 0]);
    while (log.length > 1 && log[1]![0] <= game.tick - RULES.dayTicks) log.shift();
  }
  for (const id of madeLog.keys()) if (!alive.has(id)) madeLog.delete(id);
}
const SITE_NAME = (): Record<string, string> => ({ home: tx('w warsztacie', 'in the workshop'), shore: tx('na brzegu wody', 'on the water\'s edge') });
export function prodInfo(game: GameState, b: GameState['buildings'][number], nameOf: (unitId: number) => string): BuildingInfo['prod'] {
  const def = BUILDINGS[b.type]!, pr = def.production, p = game.players[b.owner]!;
  const u = b.worker ? game.units.find((x) => x.id === b.worker) : undefined;
  const resName = (r: string): string => t(RESOURCE_DEFS[r as ResourceId].name).toLowerCase();
  // przepis
  const place = !pr ? '' : typeof pr.site === 'string' ? SITE_NAME()[pr.site] ?? '' : pr.site === Terrain.Forest ? tx('w lesie', 'in the forest') : pr.site === Terrain.Stone ? tx('w skałach', 'among the rocks') : pr.site === Terrain.Iron ? tx('przy złożu rudy', 'at an ore deposit') : '';
  const recipe = pr ? {
    input: pr.input ? { id: pr.input.res, n: pr.input.amount, name: resName(pr.input.res) } : undefined,
    output: { id: pr.output.res, n: pr.output.amount, name: resName(pr.output.res) },
    secs: Math.round((pr.workTicks + (pr.processTicks ?? 0)) / TICKS_PER_SECOND),
    place,
  } : undefined;
  // pracownik: kto i co robi teraz; postęp roboty w warsztacie albo w terenie
  let worker: { name: string; doing: string; pct?: number } | undefined;
  if (u) {
    let pct: number | undefined;
    if (pr && u.phase === Phase.Working) { const total = (pr.input ? pr.workTicks : pr.processTicks) ?? pr.workTicks; pct = Math.round(100 * (1 - u.timer / Math.max(1, total))); }
    else if (pr && u.phase === Phase.WorkingSite) pct = Math.round(100 * (1 - u.timer / Math.max(1, pr.workTicks)));
    worker = { name: nameOf(u.id), doing: t(`phase.${u.phase}`), pct: pct === undefined ? undefined : Math.max(0, Math.min(100, pct)) };
  }
  // stan: co blokuje robotę (najważniejsze pierwsze)
  const outKind = pr ? RESOURCE_DEFS[pr.output.res].store : undefined;
  const outFull = !!outKind && !!pr && storeRoom(game, b.owner, resIndex(pr.output.res)) <= 0;
  const inHave = pr?.input ? p.res[resIndex(pr.input.res)]! : 0;
  const storeLabel = (k: string): string => (lang() === 'en' ? (k === 'granary' ? 'granary' : k === 'armory' ? 'armoury' : k === 'grain' ? 'barn' : 'stockpile') : k === 'granary' ? 'spichlerz' : k === 'armory' ? 'zbrojownia' : k === 'grain' ? 'stodoła' : 'skład');
  /** „postaw spichlerz / zbrojownię” — biernik po polsku, przedimek po angielsku */
  const buildStore = (k: string): string => (lang() === 'en' ? `build a${k === 'armory' ? 'n' : ''} ${storeLabel(k)}` : `postaw ${storeLabel(k).replace(/a$/, 'ę')}`);
  /** „Pełny skład / Pełna zbrojownia” */
  const fullStore = (k: string): string => (lang() === 'en' ? `The ${storeLabel(k)} is full` : `${k === 'armory' || k === 'grain' ? 'Pełna' : 'Pełny'} ${storeLabel(k)}`);
  let status: { text: string; level: 'ok' | 'warn' | 'bad' };
  if (!u) {
    const free = game.units.some((x) => x.owner === b.owner && x.job === 0 && !x.enlist);
    status = free ? { text: tx('Brak pracownika — wolny chłop zaraz przyjdzie.', 'No worker — an idle peasant is on his way.'), level: 'warn' }
      : { text: tx('Brak pracownika: nie ma wolnych chłopów. Postaw chaty, obniż podatki albo podnieś racje, żeby przyszli nowi.', 'No worker: there are no idle peasants. Build hovels, lower taxes or raise rations to draw newcomers.'), level: 'bad' };
  } else if (u.phase === Phase.Sleeping || u.phase === Phase.ToSleep) status = { text: tx('Noc — pracownik śpi, rano wraca do roboty.', 'Night — the worker sleeps and returns to work at dawn.'), level: 'ok' };
  else if (u.phase === Phase.Evening || u.phase === Phase.ToEvening) status = { text: tx('Wieczór — fajrant, rano wraca do roboty.', 'Evening — work is done for the day; back at it at dawn.'), level: 'ok' };
  else if (pr?.input && RESOURCE_DEFS[pr.input.res].store && !storeCapacity(game, b.owner, RESOURCE_DEFS[pr.input.res].store!)) status = { text: tx(`Nie ma skąd wziąć surowca (${resName(pr.input.res)}): `, `Nowhere to fetch materials from (${resName(pr.input.res)}): `) + `${buildStore(RESOURCE_DEFS[pr.input.res].store!)}.`, level: 'bad' };
  else if (outKind && !storeCapacity(game, b.owner, outKind)) status = { text: tx(`Nie ma gdzie odnieść towaru (${resName(pr!.output.res)}): `, `Nowhere to store the goods (${resName(pr!.output.res)}): `) + `${buildStore(outKind)}.`, level: 'bad' };
  else if (pr?.input && u.phase === Phase.ToInputStore && inHave < pr.input.amount) status = { text: tx(`Czeka na surowiec: ${resName(pr.input.res)} — na stanie ${inHave}, potrzeba ${pr.input.amount}.`, `Waiting for ${resName(pr.input.res)} — ${inHave} in store, ${pr.input.amount} needed.`), level: 'bad' };
  else if (u.phase === Phase.ToStore && u.carryAmt > 0 && u.timer > 0) status = { text: `${fullStore(outKind ?? '')} — ${tx('pracownik czeka z towarem, a nadmiar przepadnie. Postaw kolejny.', 'the worker stands waiting with his goods and the surplus will go to waste. Build another.')}`, level: 'bad' };
  else if (outFull) status = { text: `${fullStore(outKind ?? '')} — ${tx('nowy towar nie będzie miał gdzie leżeć.', 'new goods will have nowhere to go.')}`, level: 'warn' };
  else if (pr?.input && inHave < pr.input.amount) status = { text: tx(`Kończy się surowiec: ${resName(pr.input.res)} — na stanie ${inHave}, na jeden cykl trzeba ${pr.input.amount}.`, `Running low on ${resName(pr.input.res)} — ${inHave} in store, ${pr.input.amount} needed per cycle.`), level: 'warn' };
  else if (u.phase === Phase.Resting || u.phase === Phase.ToRest) status = { text: tx('Krótki odpoczynek w chacie, zaraz wraca.', 'A short rest in his hovel; he\'ll be back shortly.'), level: 'ok' };
  else status = { text: tx('Pracuje bez przeszkód.', 'Working without hindrance.'), level: 'ok' };
  // kopalnia: załoga rośnie z wioską, a z jednego kursu wychodzi kamień, żelazo albo rzadka ruda
  if (def.id === 'engineers') status = engineersStatus(game, b, status);
  else if (def.crew) {
    const pop = game.units.filter((x) => x.owner === b.owner).length;
    const have = (b.worker ? 1 : 0) + (b.crew?.length ?? 0), want = crewWanted(def, pop);
    const yields = MINE_YIELDS.map((y) => `${resName(y.res)} ${y.weight}%`).join(', ');
    status = { text: `${tx(`Załoga: ${have} z ${want} górników (1 na ${def.crew.per} mieszkańców, najwyżej ${def.crew.max}). Urobek: ${yields}.`, `Crew: ${have} of ${want} miners (1 per ${def.crew.per} inhabitants, at most ${def.crew.max}). Yield: ${yields}.`)} ${status.text}`, level: have < want && status.level === 'ok' ? 'warn' : status.level };
    if (recipe) recipe.place = tx('w sztolni', 'down the mine shaft');
  }
  // liczby
  let day: number | undefined;
  const log = madeLog.get(b.id);
  if (log && log.length > 1) {
    const span = game.tick - log[0]![0];
    if (span >= RULES.dayTicks / 4) day = Math.round((((b.made ?? 0) - log[0]![1]) * RULES.dayTicks) / span);
  }
  return {
    recipe, worker, status, made: b.made ?? 0, lost: b.lost ?? 0, day,
    stockOut: pr ? p.res[resIndex(pr.output.res)]! : undefined,
    stockIn: pr?.input ? inHave : undefined,
    cycles: pr?.input ? Math.floor(inHave / pr.input.amount) : undefined,
  };
}

/** Cech inżynierów: ilu ich jest, co który teraz robi (z postępem) i ile roboty czeka w zasięgu cechu */
function engineersStatus(game: GameState, b: GameState['buildings'][number], base: { text: string; level: 'ok' | 'warn' | 'bad' }): { text: string; level: 'ok' | 'warn' | 'bad' } {
  const def = BUILDINGS[b.type]!;
  const pop = game.units.filter((x) => x.owner === b.owner).length;
  const ids = [b.worker, ...(b.crew ?? [])].filter((id) => id);
  const want = crewWanted(def, pop);
  const name = (o: GameState['buildings'][number]): string => t(BUILDINGS[o.type]!.name);
  const doing: string[] = [];
  for (const id of ids) {
    const u = game.units.find((x) => x.id === id);
    const o = u?.target ? game.buildings.find((x) => x.id === u.target) : undefined;
    if (!u || !o || !(u.phase === Phase.ToRepair || u.phase === Phase.Repairing || u.phase === Phase.ToFetch)) continue;
    if (o.build) {
      const pct = Math.round(100 * (1 - o.build / Math.max(1, buildWork(o.type))));
      doing.push(o.ruined ? tx(`odbudowuje: ${name(o)} (${pct}%)`, `rebuilding the ${name(o).toLowerCase()} (${pct}%)`) : tx(`pomaga budować: ${name(o)} (${pct}%)`, `helping to raise the ${name(o).toLowerCase()} (${pct}%)`));
    } else {
      const pct = Math.round((100 * o.hp) / maxHp(o.type));
      doing.push(tx(`łata: ${name(o)} (${pct}%)`, `patching the ${name(o).toLowerCase()} (${pct}%)`));
    }
  }
  const busy = new Set(ids.map((id) => game.units.find((x) => x.id === id)?.target ?? 0));
  const waiting = game.buildings.filter((o) => !busy.has(o.id) && (o.ruined || !o.build) && engineerJob(game, b, o)).length;
  const head = tx(`Inżynierów: ${ids.length} z ${want} (1 na ${def.crew!.per} mieszkańców, najwyżej ${def.crew!.max}). Odbudowują ruiny, łatają uszkodzone budynki (najpierw mury, bramy i wieże), pomagają przy budowie i gaszą pożary.`,
    `Engineers: ${ids.length} of ${want} (1 per ${def.crew!.per} inhabitants, at most ${def.crew!.max}). They rebuild ruins, patch damaged buildings (walls, gates and towers first), lend a hand on building sites and fight fires.`);
  const now = doing.length ? tx(`Teraz: ${doing.join('; ')}.`, `Now: ${doing.join('; ')}.`) : '';
  const queue = waiting ? tx(`Czeka jeszcze: ${waiting}.`, `Still waiting: ${waiting}.`) : '';
  const level = ids.length < want && base.level === 'ok' ? 'warn' : base.level;
  return { text: [head, now, queue, doing.length ? '' : base.text].filter(Boolean).join(' '), level };
}

/** Straż miejska do panelu twierdzy: ilu jest, szkolenie rekruta i co blokuje werbunek */
export function watchInfo(game: GameState, owner: number): BuildingInfo['watch'] {
  const p = game.players[owner]!;
  const have = game.soldiers.filter((s) => s.owner === owner && UNITS[s.kind]!.guard && !s.camp).length;
  const want = p.guards ?? GUARDS;
  const training = p.guardReady ? Math.max(0, Math.ceil((p.guardReady - game.tick) / TICKS_PER_SECOND)) : 0;
  let note: string | undefined;
  if (!training && have < want) {
    const lack = Object.entries(GUARD_COST).filter(([r, n]) => p.res[resIndex(r as ResourceId)]! < n!).map(([r]) => t(`res.${r}`).toLowerCase());
    note = lack.length ? `${tx('na rekruta brakuje', 'a recruit still needs')}: ${lack.join(', ')}` : !game.units.some((u) => u.owner === owner && u.job === 0) ? tx('brak wolnego chłopa na rekruta', 'no idle peasant to recruit') : tx('werbunek ruszy za dnia, gdy pod zamkiem nie ma wroga', 'recruiting resumes by day, once no enemy stands before the keep');
  }
  return { have, want, training, note };
}

/** Barak górników: strażnicy kopalni (ilu żyje, szkolenie następcy, czego brakuje), urobek pod barakiem i wóz w drodze */
export function campWatch(game: GameState, b: GameState['buildings'][number]): BuildingInfo['watch'] {
  const p = game.players[b.owner]!;
  const have = game.soldiers.filter((s) => s.camp === b.id && s.hp > 0).length;
  const training = b.recruitAt ? Math.max(0, Math.ceil((b.recruitAt - game.tick) / TICKS_PER_SECOND)) : 0;
  const parts: string[] = [];
  if (!training && have < CAMP_GUARDS) {
    const lack = Object.entries(GUARD_COST).filter(([r, n]) => p.res[resIndex(r as ResourceId)]! < n!).map(([r]) => t(`res.${r}`).toLowerCase());
    parts.push(lack.length ? `${tx('na rekruta brakuje', 'a recruit still needs')}: ${lack.join(', ')}` : tx('czeka na wolnego chłopa z obozowiska', 'waiting for an idle peasant from the camp'));
  }
  const held = (b.hold ?? []).map((n, r) => [r, n] as const).filter(([, n]) => n > 0).map(([r, n]) => `${t(`res.${RESOURCES[r]}`).toLowerCase()} ${n}`);
  parts.push(held.length ? `${tx('pod barakiem', 'at the lodge')}: ${held.join(', ')}` : tx('pod barakiem pusto', 'nothing waiting at the lodge'));
  const cart = (game.caravans ?? []).find((c) => c.camp === b.id);
  if (cart) parts.push(tx(`wóz w drodze do zamku (eskorta: ${cart.escort?.length ?? 0})`, `cart on its way to the keep (escort: ${cart.escort?.length ?? 0})`));
  const mine = game.buildings.find((m) => BUILDINGS[m.type]!.id === 'oremine' && campOf(game, m)?.id === b.id);
  if (!mine) parts.push(tx('brak kopalni w zasięgu 10 pól — barak stoi pusty', 'no mine within 10 tiles — the lodge stands empty'));
  return { have, want: CAMP_GUARDS, training, note: parts.join(' · '), label: tx('Straż kopalni', 'Mine guard') };
}


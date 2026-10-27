import { BUILDINGS } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, type StoreKind } from '../../data/resources';
import { dropWorker, FP, Phase, storeRoom, type Building, type GameState, type Pile, type Unit } from '../state';

/**
 * Magazyny jako prawdziwa logistyka (Michał 27.10.2026, opis w docs/magazyny.md).
 *
 * - Gdy magazyn danego rodzaju jest pełny, robotnik odkłada ładunek POD magazynem (stos — leży naprawdę, widać go)
 *   i wraca do swojego warsztatu. Tam czeka (Phase.Stalled) i nie robi kolejnego towaru, dopóki nie zwolni się miejsce.
 * - Każdy magazyn ma magazynierów: mały (skład, spichlerz, zbrojownia) jednego, duży (stodoła, duży spichlerz) dwóch.
 *   Gdy w magazynach jest miejsce, magazynier idzie po stos spod drzwi i wnosi go do środka; w wolnej chwili wynosi też gruz.
 * - Magazyny są połączone: zapasy są wspólne dla gracza, a rozdzielanie roboty jest jedno — na każdy stos idzie
 *   dokładnie jeden człowiek (`Pile.claim`), najbliższy wolny magazynier (najpierw ten z magazynu, pod którym stos leży).
 * - Gdy wszyscy magazynierzy są zajęci albo żadnego nie ma, czekający robotnik sam wnosi swój towar.
 * - Nowy magazyn = nowe miejsce: towar spod pełnych magazynów trafia do niego tak samo.
 *
 * Wydajność: system działa co `EVERY` ticków i tylko wtedy, gdy jakiś stos leży; czekający robotnik sprawdza miejsce
 * co `STALL_CHECK` ticków. Bez stosów koszt to jedno sprawdzenie długości listy.
 */
const EVERY = 10;
/** Co ile ticków czekający w warsztacie robotnik sprawdza, czy zwolniło się miejsce */
export const STALL_CHECK = 20;
/** Najwięcej, ile magazynier wnosi za jednym razem (stos większy = kilka kursów) */
const CARRY_MAX = 128;

const kindOf = (res: number): StoreKind | undefined => RESOURCE_DEFS[RESOURCES[res]!]?.store ?? undefined;

/** Czy budynek jest magazynem z magazynierami */
export const isStore = (b: Building | undefined): boolean => !!b && !!BUILDINGS[b.type]!.keepers;

/** Magazyny gracza danego rodzaju, które przyjmują towar (gotowe, z wejściem) */
export function storesOf(g: GameState, owner: number, kind: StoreKind): Building[] {
  const out: Building[] = [];
  for (const b of g.buildings) if (b.owner === owner && b.door >= 0 && !b.build && !b.ruined && BUILDINGS[b.type]!.stores?.includes(kind)) out.push(b);
  return out;
}

/** Id magazynów (z magazynierami) gracza — jedno przejście po budynkach zamiast szukania przy każdym chłopie */
function storeIds(g: GameState, owner: number): Set<number> {
  const out = new Set<number>();
  for (const b of g.buildings) if (b.owner === owner && BUILDINGS[b.type]!.keepers) out.add(b.id);
  return out;
}

/** Stosy pod magazynami (tworzy listę w starym zapisie) */
export const pilesOf = (g: GameState): Pile[] => (g.piles ??= []);

/**
 * Wolne miejsce na surowiec `res` po odjęciu tego, co już jest w drodze do magazynów tego rodzaju
 * (stosy, po które ktoś idzie, i ładunki niesione do składu) — żeby nie wysłać trzech ludzi na jedno miejsce.
 */
export function roomLeft(g: GameState, owner: number, res: number): number {
  const kind = kindOf(res);
  const room = storeRoom(g, owner, res);
  if (!kind || room === Infinity) return room;
  let pending = 0;
  for (const p of pilesOf(g)) if (p.owner === owner && p.claim && kindOf(p.res) === kind) pending += p.amt;
  for (const u of g.units) if (u.owner === owner && u.phase === Phase.ToStore && u.carryRes >= 0 && u.carryAmt > 0 && kindOf(u.carryRes) === kind) pending += u.carryAmt;
  return Math.max(0, room - pending);
}

const tileOf = (g: GameState, u: { px: number; py: number }): number => (u.py >> 8) * g.map.width + (u.px >> 8);

/**
 * Odkłada ładunek pod magazynem (albo tam, gdzie chłop stoi, gdy magazynu tego rodzaju nie ma).
 * Ten sam towar pod tym samym magazynem trafia na jeden stos.
 */
export function dropPile(g: GameState, u: Unit, res: number, amt: number): Pile | undefined {
  if (amt <= 0 || res < 0) return undefined;
  const t = tileOf(g, u);
  const kind = kindOf(res);
  const store = kind ? g.buildings.find((b) => b.owner === u.owner && b.door === t && BUILDINGS[b.type]!.stores?.includes(kind)) : undefined;
  const list = pilesOf(g);
  const same = list.find((p) => p.owner === u.owner && p.res === res && p.t === t && !p.claim);
  if (same) { same.amt += amt; return same; }
  const p: Pile = { id: g.nextId++, owner: u.owner, res, amt, store: store?.id ?? 0, t, claim: 0, at: g.tick };
  list.push(p);
  return p;
}

/** Czy wolny magazynier gracza stoi i czeka na zajęcie */
export function freeKeeper(g: GameState, owner: number): boolean {
  let stores: Set<number> | undefined;
  for (const u of g.units) {
    if (u.owner !== owner || !u.job || u.phase !== Phase.Idle || u.path.length || u.carryRes >= 0 || u.target !== 0) continue;
    if ((stores ??= storeIds(g, owner)).has(u.job)) return true;
  }
  return false;
}

/**
 * Magazynier to rezerwa rąk do pracy: gdy warsztat, koszary, straż albo budowa potrzebują człowieka, a przy ognisku
 * nikogo nie ma, bierze się wolnego magazyniera (stoi pod magazynem bez zajęcia). Zwraca go już jako wolnego chłopa.
 */
export function spareKeeper(g: GameState, owner: number): Unit | undefined {
  let stores: Set<number> | undefined;
  for (const u of g.units) {
    if (u.owner !== owner || !u.job || u.phase !== Phase.Idle || u.path.length || u.carryRes >= 0 || u.target !== 0 || u.riot || u.enlist || u.sick) continue;
    if (!(stores ??= storeIds(g, owner)).has(u.job)) continue;
    dropWorker(g, u.id);
    u.job = 0; u.wait = 0;
    return u;
  }
  return undefined;
}

/** Najstarszy niezajęty stos danego surowca u gracza */
export function oldestPile(g: GameState, owner: number, res: number): Pile | undefined {
  let best: Pile | undefined;
  for (const p of pilesOf(g)) if (p.owner === owner && p.res === res && !p.claim && p.amt > 0 && (!best || p.at < best.at)) best = p;
  return best;
}

/**
 * Magazynier (albo robotnik) doszedł do stosu: bierze, ile uniesie, i niesie do magazynu.
 * Zwraca false, gdy stosu już nie ma albo ktoś inny go zabrał.
 */
export function takePile(g: GameState, u: Unit): boolean {
  const list = pilesOf(g);
  const i = list.findIndex((p) => p.id === u.target);
  const p = list[i];
  u.target = 0;
  if (!p || p.claim !== u.id) return false;
  const take = Math.min(p.amt, CARRY_MAX);
  u.carryRes = p.res; u.carryAmt = take;
  p.amt -= take; p.claim = 0;
  if (p.amt <= 0) list.splice(i, 1);
  u.phase = Phase.ToStore;
  return true;
}

/** Rozdziela stosy między wolnych magazynierów (jeden człowiek na stos) i sprząta po zniknięciu magazynów i tragarzy. */
export function storageSystem(g: GameState): void {
  const list = g.piles;
  if (!list?.length || g.tick % EVERY !== 0) return;
  // tragarz, który rzucił zadanie (wieczór, choroba, śmierć), zwalnia stos dla kogoś innego
  const carrying = new Map<number, number>();
  for (const u of g.units) if (u.phase === Phase.ToPile && u.target) carrying.set(u.id, u.target);
  const alive = new Set<number>();
  for (const b of g.buildings) if (!b.ruined) alive.add(b.id);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    if (p.amt <= 0) { list.splice(i, 1); continue; }
    if (p.claim && carrying.get(p.claim) !== p.id) p.claim = 0;
    if (p.store && !alive.has(p.store)) p.store = 0;
  }
  const owners = new Set<number>();
  for (const p of list) if (!p.claim) owners.add(p.owner);
  for (const owner of owners) {
    const keepers: Unit[] = [];
    const stores = storeIds(g, owner);
    for (const u of g.units) {
      if (u.owner !== owner || !u.job || u.phase !== Phase.Idle || u.path.length || u.carryRes >= 0 || u.target !== 0 || u.wait > 0) continue;
      if (stores.has(u.job)) keepers.push(u);
    }
    if (!keepers.length) continue;
    // najstarszy stos pierwszy; miejsce liczone z tym, co już jest w drodze
    const mine = list.filter((p) => p.owner === owner && !p.claim).sort((a, b) => a.at - b.at || a.id - b.id);
    const room = new Map<StoreKind, number>();
    for (const p of mine) {
      if (!keepers.length) break;
      const kind = kindOf(p.res);
      if (!kind) continue;
      let left = room.get(kind);
      if (left === undefined) left = roomLeft(g, owner, p.res);
      if (left <= 0) { room.set(kind, 0); continue; }
      const w = g.map.width, px = (p.t % w) * FP, py = Math.floor(p.t / w) * FP;
      let k = 0, kd = Infinity;
      for (let j = 0; j < keepers.length; j++) {
        const u = keepers[j]!;
        // najpierw magazynier z magazynu, pod którym stos leży, potem najbliższy
        const d = Math.abs(u.px - px) + Math.abs(u.py - py) - (u.job === p.store ? 1 << 24 : 0);
        if (d < kd) { kd = d; k = j; }
      }
      const u = keepers.splice(k, 1)[0]!;
      p.claim = u.id;
      u.target = p.id; u.phase = Phase.ToPile; u.path = []; u.wait = 0;
      room.set(kind, left - Math.min(p.amt, CARRY_MAX));
    }
  }
}

/**
 * Robotnik czeka w warsztacie na miejsce w magazynie. Gdy miejsce jest: najpierw jego towar spod magazynu
 * (sam go wnosi, jeśli nie ma wolnego magazyniera), potem wraca do zwykłej pracy.
 */
export function stalledStep(g: GameState, u: Unit, job: Building | undefined): void {
  const res = (job?.stall ?? 0) - 1;
  if (!job || res < 0) { u.phase = job ? Phase.Returning : Phase.Idle; return; }
  u.wait = STALL_CHECK;
  if (roomLeft(g, u.owner, res) <= 0) return;
  const pile = oldestPile(g, u.owner, res);
  if (pile) {
    // magazynier już po to idzie albo zaraz pójdzie: czekamy jeszcze chwilę
    if (freeKeeper(g, u.owner)) return;
    pile.claim = u.id;
    u.target = pile.id; u.phase = Phase.ToPile; u.path = []; u.wait = 0;
    job.stall = 0;
    return;
  }
  job.stall = 0;
  u.phase = Phase.Returning; u.wait = 0;
}

/** Ile towaru leży pod magazynami gracza (rodzaj → ilość), do okien i skryby */
export function pilesSummary(g: GameState, owner: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of g.piles ?? []) if (p.owner === owner) m.set(p.res, (m.get(p.res) ?? 0) + p.amt);
  return m;
}

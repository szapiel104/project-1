import { BUILDINGS, buildingIndex, footprint } from '../../data/buildings';
import { resIndex } from '../../data/resources';
import { RULES } from '../../data/rules';
import { BANDIT_KIND, BANDITS, UNITS } from '../../data/units';
import { clockAt } from '../clock';
import { walkable } from '../path';
import { hash2 } from '../rng';
import { buildingById, FP, unitById, type Building, type GameState, type Soldier, type Unit } from '../state';
import { addBuilding } from './placement';

/**
 * Zbóje z obozów w puszczy (jak bandyci w Gothicu). Obóz stoi na polanie od początku gry (generator map 5)
 * i nie należy do żadnego gracza — jego ludzie są wrogami wszystkich. Za dnia kilku zbójów wychodzi na napad:
 * wybiera chłopa pracującego w lesie (najchętniej drwala), goni go i bije; zabity zostawia ciało, a zbóje
 * zabierają jego panu trochę rudy i drewna do obozu. Kto ucieknie do osady, ten ocalał — za blisko zamku zbóje nie idą.
 * Obóz rozbity wojskiem oddaje cały łup temu, kto go rozbił; ocalali zbóje uciekają za mapę.
 *
 * Walkę i chodzenie robi system wojska (zbój to zwykły żołnierz bez pana); tu są tylko decyzje: kiedy napad, na kogo,
 * kiedy wracać, leczenie przy ognisku, nowi zbóje w obozie i łup.
 */
const CAMP = buildingIndex('banditCamp');
const WOODCUTTER = buildingIndex('woodcutter');
const GOLD = resIndex('gold'), WOOD = resIndex('wood'), IRON = resIndex('iron');

/** Ilu zbójów siedzi w obozie na start i do ilu obóz się odradza */
export const DEN_CREW = 4;
/** Co tyle ticków (półtorej doby) do obozu z mniejszą załogą dołącza nowy zbój */
const REINFORCE = Math.round(RULES.dayTicks * 1.5);
/** Jak daleko od obozu (pola) zbóje szukają ofiary i jak daleko za nią idą */
export const RAID_RANGE = 40;
/** Tyle pól od środka zamku chłop jest bezpieczny: gdy tam dobiegnie, zbóje zawracają (ofiarę wybierają dopiero 4 pola dalej) */
export const SAFE_RANGE = 10;
/** Raz na dzień, między tymi godzinami, zbóje wypatrują ofiary (co kilka sekund); wieczorem wracają do ogniska */
const RAID_FROM = 8.5, RAID_TO = 15, HOME_HOUR = 18.5;
/** Łup leżący w obozie od początku (ruda, drewno, żelazo) */
const START_LOOT: [number, number][] = [[GOLD, 35], [WOOD, 20], [IRON, 6]];
/** Ile zbój zabiera panu zabitego chłopa (ruda, drewno) — nie więcej, niż ten ma */
const ROB_GOLD = 4, ROB_WOOD = 5;

const isBandit = (s: Soldier): boolean => s.owner === BANDITS;
const tileOf = (g: GameState, s: { px: number; py: number }): number => (s.py >> 8) * g.map.width + (s.px >> 8);
const centre = (b: Building): [number, number] => [b.x + 1, b.y + 1];

/** Miejsca przy ognisku: przód obozu (pod +y, przy palenisku) i boki przedniego narożnika; poza działką, bo działka jest zajęta */
function spots(g: GameState, b: Building): number[] {
  const W = g.map.width, [cx, cy] = centre(b);
  const all: [number, number][] = [[cx, cy + 2], [cx - 1, cy + 2], [cx + 1, cy + 2], [cx - 2, cy + 1], [cx + 2, cy + 1], [cx - 2, cy + 2], [cx + 2, cy + 2], [cx, cy + 3]];
  return all.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < g.map.height && walkable(g, y * W + x, BANDITS)).map(([x, y]) => y * W + x);
}

function spawnBandit(g: GameState, b: Building, slot: number): void {
  const sp = spots(g, b);
  const t = sp[slot % Math.max(1, sp.length)] ?? (b.y + 3) * g.map.width + b.x + 1;
  const W = g.map.width, x = t % W, y = (t - x) / W;
  g.soldiers.push({
    id: g.nextId++, owner: BANDITS, kind: BANDIT_KIND, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNITS[BANDIT_KIND]!.hp,
    goal: -1, wait: 0, target: 0, cd: 0, stance: 1, hold: t, den: b.id,
  });
}

/** Obóz ze środkiem w polu (cx, cy), z łupem na start i pełną załogą; null, gdy działka zajęta */
export function placeDen(g: GameState, cx: number, cy: number): Building | null {
  if (CAMP < 0 || BANDIT_KIND < 0) return null;
  const W = g.map.width, fp = footprint(BUILDINGS[CAMP]!, 0);
  if (cx < 2 || cy < 2 || cx + 2 >= W || cy + 4 >= g.map.height) return null;
  for (let ty = cy - 1; ty < cy - 1 + fp.h; ty++) for (let tx = cx - 1; tx < cx - 1 + fp.w; tx++) if (g.occupancy[ty * W + tx]) return null;
  const b = addBuilding(g, CAMP, BANDITS, cx - 1, cy - 1, 0);
  b.hold = [];
  for (const [r, n] of START_LOOT) b.hold[r] = n;
  b.spawnAt = g.tick; // ostatni nowy zbój (do odradzania załogi)
  for (let i = 0; i < DEN_CREW; i++) spawnBandit(g, b, i);
  return b;
}

/** Nowa gra: obóz na każdej polanie z mapy. Wołane z createGame (gra pokojowa obozów nie ma). */
export function seedBandits(g: GameState): void {
  const W = g.map.width;
  for (const d of g.map.dens ?? []) placeDen(g, d % W, Math.floor(d / W));
}

/** Zbój zabił chłopa (wołane z systemu wojska): obóz zabiera jego panu trochę rudy i drewna, gracz dostaje wiadomość */
export function robbed(g: GameState, killer: Soldier, victim: Unit): void {
  if (!isBandit(killer) || !killer.den || killer.den < 0) return;
  const camp = buildingById(g, killer.den);
  const p = g.players[victim.owner];
  if (!camp || !p) return;
  const gold = Math.min(ROB_GOLD, Math.max(0, p.res[GOLD]!)), wood = Math.min(ROB_WOOD, Math.max(0, p.res[WOOD]!));
  p.res[GOLD] = p.res[GOLD]! - gold; p.res[WOOD] = p.res[WOOD]! - wood;
  camp.hold ??= [];
  camp.hold[GOLD] = (camp.hold[GOLD] ?? 0) + gold;
  camp.hold[WOOD] = (camp.hold[WOOD] ?? 0) + wood;
  const st = (p.bandit ??= { raids: 0, kills: 0, robbed: 0, razed: 0, loot: [] });
  st.kills++; st.robbed += gold + wood;
}

/** Ucieczka z rozbitego obozu: pole w puszczy ok. 16 pól od obozu, w stronę przeciwną do zwycięzców */
function fleeTile(g: GameState, s: Soldier, fx: number, fy: number): number {
  const { width: w, height: h } = g.map, x = s.px >> 8, y = s.py >> 8;
  const len = Math.hypot(x - fx, y - fy) || 1, ax = (x - fx) / len, ay = (y - fy) / len;
  for (let k = 16; k >= 6; k -= 2) for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
    const c = Math.cos(turn), sn = Math.sin(turn);
    const tx = Math.round(x + (ax * c - ay * sn) * k), ty = Math.round(y + (ax * sn + ay * c) * k);
    if (tx > 0 && ty > 0 && tx < w - 1 && ty < h - 1 && walkable(g, ty * w + tx, BANDITS)) return ty * w + tx;
  }
  return -1;
}
/** Czy w pobliżu (pola) jest ktoś z ludzi graczy: zbój w ucieczce znika w lesie dopiero bez świadków */
function watched(g: GameState, s: Soldier, r: number): boolean {
  const R = r * FP;
  return g.soldiers.some((o) => !isBandit(o) && Math.abs(o.px - s.px) < R && Math.abs(o.py - s.py) < R) || g.units.some((u) => Math.abs(u.px - s.px) < R && Math.abs(u.py - s.py) < R);
}

/** Ofiara napadu: chłop przy pracy z dala od zamku, przy którym w pobliżu nie ma zbrojnych, w zasięgu obozu; drwale są pierwsi */
function pickPrey(g: GameState, camp: Building, keeps: Map<number, [number, number]>): Unit | undefined {
  const [cx, cy] = centre(camp);
  let best: Unit | undefined, bd = Infinity;
  for (const u of g.units) {
    if (!u.job) continue;
    const x = u.px >> 8, y = u.py >> 8, d = Math.hypot(x - cx, y - cy);
    if (d > RAID_RANGE) continue;
    const k = keeps.get(u.owner);
    if (k && Math.hypot(x - k[0], y - k[1]) < SAFE_RANGE + 4) continue; // pod samym zamkiem — za blisko
    if (armedNear(g, u, 6) > 0) continue; // przy straży albo wojsku nikt nie napada
    const job = buildingById(g, u.job);
    const score = d - (job?.type === WOODCUTTER ? 15 : 0) + (hash2(u.id, camp.id, 0xbad5) & 3);
    if (score < bd) { bd = score; best = u; }
  }
  return best;
}

/** Ilu zbrojnych graczy (straż, wojsko) stoi w promieniu r pól */
function armedNear(g: GameState, at: { px: number; py: number }, r: number): number {
  const R = r * FP;
  let n = 0;
  for (const o of g.soldiers) if (!isBandit(o) && o.hp > 0 && Math.abs(o.px - at.px) < R && Math.abs(o.py - at.py) < R) n++;
  return n;
}

function goHome(g: GameState, s: Soldier, camp: Building, slot: number): void {
  const sp = spots(g, camp);
  const t = sp[slot % Math.max(1, sp.length)];
  s.raid = false; s.prey = 0; s.target = 0; s.amove = false; s.stance = 1; s.wounded = 0;
  s.hold = t ?? -1; s.goal = t ?? -1; s.path = [];
}

/** Rozbity obóz: łup trafia do tego, czyje wojsko stoi najbliżej; obóz znika, ocalali zbóje uciekają za mapę */
function razeCamp(g: GameState, camp: Building): void {
  const [cx, cy] = centre(camp);
  let winner = -1, bd = Infinity;
  for (const s of g.soldiers) {
    if (isBandit(s) || s.hp <= 0 || !g.players[s.owner]) continue;
    const d = Math.hypot((s.px >> 8) - cx, (s.py >> 8) - cy);
    if (d < bd) { bd = d; winner = s.owner; }
  }
  const p = bd <= 10 ? g.players[winner] : undefined;
  const near = p ? g.soldiers.filter((s) => s.owner === winner).sort((a, b) => Math.hypot((a.px >> 8) - cx, (a.py >> 8) - cy) - Math.hypot((b.px >> 8) - cx, (b.py >> 8) - cy))[0] : undefined;
  const [fx, fy] = near ? [near.px >> 8, near.py >> 8] : [cx, cy + 3];
  if (p) {
    const loot = camp.hold ?? [];
    for (let r = 0; r < loot.length; r++) if (loot[r]) p.res[r] = p.res[r]! + loot[r]!;
    const st = (p.bandit ??= { raids: 0, kills: 0, robbed: 0, razed: 0, loot: [] });
    st.razed++; st.loot = [...loot].map((n) => n ?? 0);
  }
  const W = g.map.width, fp = footprint(BUILDINGS[camp.type]!, camp.rot);
  for (let y = camp.y; y < camp.y + fp.h; y++) for (let x = camp.x; x < camp.x + fp.w; x++) g.occupancy[y * W + x] = 0;
  if (camp.door >= 0) g.reserved[camp.door] = Math.max(0, g.reserved[camp.door]! - 1);
  g.buildings = g.buildings.filter((b) => b !== camp);
  for (const s of g.soldiers) if (isBandit(s) && s.den === camp.id) {
    s.den = -1; s.raid = false; s.prey = 0; s.target = 0; s.stance = 0; s.hold = -1; s.amove = false; s.path = []; s.goal = fleeTile(g, s, fx, fy);
  }
}

export function banditSystem(g: GameState): void {
  if (CAMP < 0) return;
  const W = g.map.width;
  // ucieczka z rozbitego obozu: kto doszedł w głąb puszczy i nikt go nie widzi, znika w lesie (bez ciała)
  if (g.tick % 10 === 0 && g.soldiers.some((s) => isBandit(s) && s.den === -1)) {
    g.soldiers = g.soldiers.filter((s) => !(isBandit(s) && s.den === -1 && s.goal < 0 && !s.path.length && !s.target && !watched(g, s, 9)));
  }
  const camps = g.buildings.filter((b) => b.type === CAMP);
  if (!camps.length) return;
  for (const c of camps) if (c.ruined) razeCamp(g, c);
  const clock = clockAt(g.tick);
  const keeps = new Map<number, [number, number]>();
  for (const b of g.buildings) if (BUILDINGS[b.type]!.id === 'keep' && !b.ruined) keeps.set(b.owner, [b.x + 5, b.y + 5]);
  const raidTime = clock.day >= 2 && clock.hour >= RAID_FROM && clock.hour < RAID_TO && g.tick % 50 === 0;
  for (const camp of g.buildings) {
    if (camp.type !== CAMP || camp.ruined) continue;
    const crew = g.soldiers.filter((s) => s.den === camp.id && s.hp > 0).sort((a, b) => a.id - b.id);
    // nowi zbóje: obóz, który stracił ludzi, co półtorej doby zyskuje jednego (najwyżej do pełnej załogi)
    if (crew.length < DEN_CREW && g.tick - (camp.spawnAt ?? 0) >= REINFORCE) { camp.spawnAt = g.tick; spawnBandit(g, camp, crew.length); }
    const [cx, cy] = centre(camp);
    // napad: rano, gdy w obozie jest co najmniej dwóch zdrowych; od piątego dnia idzie ich trzech
    if (raidTime && camp.raidDay !== clock.day && !crew.some((s) => s.raid)) {
      const fit = crew.filter((s) => s.hp * 100 >= UNITS[s.kind]!.hp * 70);
      const prey = fit.length >= 2 ? pickPrey(g, camp, keeps) : undefined;
      if (prey) {
        const party = fit.slice(0, clock.day >= 5 ? 3 : 2);
        camp.raidDay = clock.day;
        for (const s of party) { s.raid = true; s.prey = prey.id; s.target = 0; s.stance = 0; s.hold = -1; s.amove = true; s.goal = -1; s.path = []; s.wait = 0; }
        const p = g.players[prey.owner];
        if (p) (p.bandit ??= { raids: 0, kills: 0, robbed: 0, razed: 0, loot: [] }).raids++;
      }
    }
    for (const [i, s] of crew.entries()) {
      if (s.raid) {
        if ((g.tick + s.id) % 10 !== 0) continue;
        const prey = s.prey ? unitById(g, s.prey) : undefined;
        const x = s.px >> 8, y = s.py >> 8;
        const far = Math.hypot(x - cx, y - cy) > RAID_RANGE + 8;
        const k = prey ? keeps.get(prey.owner) : undefined;
        const safe = !!prey && !!k && Math.hypot((prey.px >> 8) - k[0], (prey.py >> 8) - k[1]) < SAFE_RANGE;
        const hurt = s.hp * 100 < UNITS[s.kind]!.hp * 45;
        // zbóje biją samotnych: gdy naprzeciw stanie więcej zbrojnych niż ich (straż, wojsko), uciekają do lasu
        const raiders = crew.filter((o) => o.raid).length, armed = armedNear(g, s, 7);
        if (!prey || far || safe || hurt || armed > raiders || clock.hour >= HOME_HOUR || clock.hour < 6) { for (const [j, o] of crew.entries()) if (o.raid) goHome(g, o, camp, j); continue; }
        // pościg: idzie drogą tam, gdzie ofiara jest teraz (krok za krokiem robi system wojska, on też bije)
        const pt = tileOf(g, prey);
        if (Math.max(Math.abs((prey.px - s.px) / FP), Math.abs((prey.py - s.py) / FP)) > 2 && !s.target && (s.goal < 0 || Math.abs((s.goal % W) - (pt % W)) + Math.abs(Math.floor(s.goal / W) - Math.floor(pt / W)) > 3)) {
          s.goal = pt; s.path = [];
        }
        s.amove = true; // atak w marszu: bije ofiarę i każdego, kto stanie na drodze, ale nie bierze się za budynki
        continue;
      }
      // w obozie: pilnuje swojego miejsca przy ognisku, przy ogniu powoli się leczy
      if ((s.hold ?? -1) < 0 && !s.target) goHome(g, s, camp, i);
      if (g.tick % 30 === 0 && s.hp < UNITS[s.kind]!.hp && !s.target && Math.hypot((s.px >> 8) - cx, (s.py >> 8) - cy) <= 4) s.hp++;
    }
  }
}

/** Czy ten budynek to obóz zbójów (do wyglądu i okien) */
export const isDen = (b: Building): boolean => b.type === CAMP;

/** Gra bez zbójów (testy innych systemów, które liczą całe wojsko na mapie): usuwa obozy i ich ludzi */
export function clearBandits(g: GameState): GameState {
  for (const c of g.buildings.filter((b) => b.type === CAMP)) {
    const W = g.map.width, fp = footprint(BUILDINGS[c.type]!, c.rot);
    for (let y = c.y; y < c.y + fp.h; y++) for (let x = c.x; x < c.x + fp.w; x++) g.occupancy[y * W + x] = 0;
    if (c.door >= 0) g.reserved[c.door] = Math.max(0, g.reserved[c.door]! - 1);
  }
  g.buildings = g.buildings.filter((b) => b.type !== CAMP);
  g.soldiers = g.soldiers.filter((s) => !isBandit(s));
  return g;
}

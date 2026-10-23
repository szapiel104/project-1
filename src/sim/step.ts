import { buildingById, releaseCrew } from './state';
import { BUILDINGS } from '../data/buildings';
import { buildingIndex } from '../data/buildings';
import { RULES } from '../data/rules';
import type { GameState } from './state';
import { economySystem } from './systems/economy';
import { demolish, placeBuilding, removeRoad } from './systems/placement';
import { wolfSystem } from './systems/wolves';
import { guardSystem } from './systems/guards';
import { campSystem } from './systems/minecamp';
import { GUARD } from '../data/units';
const isGuard = (g: GameState, id: number): boolean => g.soldiers.some((s) => s.id === id && s.kind === GUARD);
import { gateSystem } from './systems/gates';
import { migrationSystem, travelSystem } from './systems/population';
import { caravanSystem, sendCaravan } from './systems/caravans';
import { rubbleSystem } from './systems/rubble';
import { torchSystem } from './systems/torches';
import { workerSystem } from './systems/workers';
import { unrestSystem } from './systems/unrest';
import { forestSystem } from './systems/forestry';
import { roadSystem } from './systems/roads';
import { fireSystem } from './systems/fire';
import { stoneWallSystem } from './systems/stonewalls';
import { armySystem, orderAttack, orderMove, orderPatrol, queueMove, clearOrders, QUEUE_MAX, orderStance, train , orderDismount, orderGarrison, enlistSystem, setRally } from './systems/army';
import { botSystem } from './systems/bot';
import { banditSystem } from './systems/bandits';

/** Komendy graczy. To jedyna droga, którą gracz (albo bot, albo sieć) wpływa na grę. */
export type Command =
  | { type: 'noop'; player: number }
  | { type: 'build'; player: number; building: string; x: number; y: number; rot?: number }
  | { type: 'demolish'; player: number; id: number }
  | { type: 'unroad'; player: number; x: number; y: number }
  | { type: 'setRations'; player: number; level: number }
  | { type: 'setTax'; player: number; level: number }
  | { type: 'train'; player: number; building: number; unit: string }
  /** Punkt zbiórki koszar: kind = rodzaj jednostki (-1 = wszystkie), tile = pole (-1 = usuń flagę) */
  | { type: 'rally'; player: number; building: number; kind: number; tile: number }
  /** face 0–7 (kierunek szyku), form 0–3 (linia, blok, luźno, ścisk), width = ilu w szeregu */
  | { type: 'move'; player: number; ids: number[]; x: number; y: number; face?: number; form?: number; width?: number; amove?: boolean; queue?: boolean }
  /** Patrol po punktach [x, y] i z powrotem tam, skąd oddział wyszedł */
  | { type: 'patrol'; player: number; ids: number[]; pts: [number, number][]; form?: number; amove?: boolean }
  /** 0 atak, 1 obrona, 2 stój */
  | { type: 'stance'; player: number; ids: number[]; stance: number }
  | { type: 'attack'; player: number; ids: number[]; target: number }
  | { type: 'gate'; player: number; id: number; open: boolean }
  /** Wyłącza albo włącza budynek z pracownikiem (wyłączony stoi pusty, pracownik idzie do innej roboty) */
  | { type: 'power'; player: number; id: number; on: boolean }
  | { type: 'garrison'; player: number; ids: number[]; tower: number }
  | { type: 'dismount'; player: number; tower: number }
  /** Wóz z surowcami dla sojusznika: res = indeks w RESOURCES, amount = ile sztuk (najwyżej 100) */
  | { type: 'send'; player: number; to: number; res: number; amount: number }
  /** Znacznik dla sojuszników (Alt + klik): boty z drużyny wysyłają wojsko (0 atak, 1 pomocy, 2 zbiórka) */
  | { type: 'signal'; player: number; kind: number; x: number; y: number }
  /** Gracz wyszedł z meczu przez sieć: przegrywa (wysyła ją lockstep, nie gracz) */
  | { type: 'surrender'; player: number };

function apply(g: GameState, c: Command): void {
  const p = g.players[c.player];
  if (!p) return;
  switch (c.type) {
    case 'surrender': {
      // wyszedł ostatni człowiek drużyny, która nie ma już nikogo w grze → drużyna przegrywa od razu (np. 1 na 1);
      // gdy zostają sojusznicy, opuszczony zamek stoi dalej i trzeba go zburzyć
      p.left = true;
      const mates = g.players.filter((o) => o.team === p.team && o.id !== p.id && !o.defeated && !o.left);
      if (!mates.length) p.defeated = true;
      break;
    }
    case 'build':
      if (Number.isInteger(c.x) && Number.isInteger(c.y)) placeBuilding(g, c.player, buildingIndex(c.building), c.x, c.y, Number.isInteger(c.rot) ? ((c.rot! % 4) + 4) % 4 : 0);
      break;
    case 'demolish':
      demolish(g, c.player, c.id);
      break;
    case 'unroad':
      if (Number.isInteger(c.x) && Number.isInteger(c.y)) removeRoad(g, c.player, c.x, c.y);
      break;
    case 'setRations':
      if (Number.isInteger(c.level) && c.level >= 0 && c.level < RULES.rations.length) p.rations = c.level;
      break;
    case 'setTax':
      if (Number.isInteger(c.level) && c.level >= 0 && c.level < RULES.taxes.length) p.tax = c.level;
      break;
    case 'train':
      if (Number.isInteger(c.building) && typeof c.unit === 'string') train(g, c.player, c.building, c.unit);
      break;
    case 'rally':
      if (Number.isInteger(c.building) && Number.isInteger(c.kind) && Number.isInteger(c.tile)) setRally(g, c.player, c.building, c.kind, c.tile);
      break;
    case 'move':
      if (Array.isArray(c.ids) && Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < g.map.width && c.y < g.map.height) {
        const ids = c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), tile = c.y * g.map.width + c.x;
        const opts = { face: c.face, form: c.form, width: c.width, amove: c.amove === true };
        if (c.queue === true) queueMove(g, c.player, ids, tile, opts);
        else { clearOrders(g, c.player, ids); orderMove(g, c.player, ids, tile, opts); }
      }
      break;
    case 'patrol':
      if (Array.isArray(c.ids) && Array.isArray(c.pts)) {
        const W = g.map.width, H = g.map.height;
        const pts = c.pts.slice(0, QUEUE_MAX).filter((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H).map(([x, y]) => y * W + x);
        orderPatrol(g, c.player, c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), pts, { form: c.form, amove: c.amove !== false });
      }
      break;
    case 'stance':
      if (Array.isArray(c.ids)) orderStance(g, c.player, c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), c.stance);
      break;
    case 'attack':
      if (Array.isArray(c.ids) && Number.isInteger(c.target)) { const ids = c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)); clearOrders(g, c.player, ids); orderAttack(g, c.player, ids, c.target); }
      break;
    case 'dismount':
      if (Number.isInteger(c.tower)) orderDismount(g, c.player, c.tower);
      break;
    case 'garrison':
      if (Array.isArray(c.ids) && Number.isInteger(c.tower)) { const ids = c.ids.filter((n) => Number.isInteger(n)); clearOrders(g, c.player, ids); orderGarrison(g, c.player, ids, c.tower); }
      break;
    case 'gate': {
      const b = buildingById(g, c.id);
      if (b && b.owner === c.player && BUILDINGS[b.type]!.gate) b.gateOpen = !!c.open;
      break;
    }
    case 'power': {
      const b = buildingById(g, c.id);
      if (!b || b.owner !== c.player) break;
      const def = BUILDINGS[b.type]!;
      if (!(def.production || def.staff) || def.id === 'keep') break;
      b.off = !c.on || undefined;
      // pracownik (w kopalni: cała załoga) odkłada robotę (ładunek w rękach przepada, jak przy zburzeniu) i jest wolny dla innego budynku
      if (b.off && b.worker) releaseCrew(g, b);
      break;
    }
    case 'signal':
      if (Number.isInteger(c.kind) && c.kind >= 0 && c.kind <= 2 && Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < g.map.width && c.y < g.map.height)
        for (const b of g.players) if (b.bot && b.team === p.team && b.id !== p.id && !b.defeated) b.call = { kind: c.kind, tile: c.y * g.map.width + c.x, tick: g.tick };
      break;
    case 'send':
      sendCaravan(g, c.player, c.to, c.res, c.amount);
      break;
    case 'noop':
      break;
  }
}

/** Gra z botami w pauzie: polecenia gracza (budowa, rozbiórka, drogi…) wchodzą od razu, bez upływu czasu —
 *  plac budowy widać od razu, więc kolejny budynek nie wejdzie na poprzedni. W grze przez sieć pauzy nie ma. */
export function applyCommands(g: GameState, commands: readonly Command[]): void {
  for (const c of commands) apply(g, c);
}

/**
 * Jeden krok symulacji. Te same komendy w tej samej kolejności dają zawsze ten sam stan.
 * Komendy są sprawdzane tutaj, bo w grze sieciowej nie wolno ufać klientowi.
 */
export function step(g: GameState, commands: readonly Command[]): void {
  for (const c of commands) apply(g, c);
  g.tick++;
  botSystem(g);
  torchSystem(g);
  rubbleSystem(g);
  roadSystem(g);
  workerSystem(g);
  forestSystem(g);
  enlistSystem(g);
  fireSystem(g);
  armySystem(g);
  banditSystem(g);
  migrationSystem(g);
  unrestSystem(g);
  travelSystem(g);
  caravanSystem(g);
  gateSystem(g);
  stoneWallSystem(g);
  wolfSystem(g);
  guardSystem(g);
  campSystem(g);
  economySystem(g);
}

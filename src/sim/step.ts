import { buildingById, Phase, unitById } from './state';
import { BUILDINGS } from '../data/buildings';
import { buildingIndex } from '../data/buildings';
import { RULES } from '../data/rules';
import type { GameState } from './state';
import { economySystem } from './systems/economy';
import { demolish, placeBuilding, removeRoad } from './systems/placement';
import { wolfSystem } from './systems/wolves';
import { guardSystem } from './systems/guards';
import { GUARD } from '../data/units';
const isGuard = (g: GameState, id: number): boolean => g.soldiers.some((s) => s.id === id && s.kind === GUARD);
import { gateSystem } from './systems/gates';
import { migrationSystem, travelSystem } from './systems/population';
import { rubbleSystem } from './systems/rubble';
import { torchSystem } from './systems/torches';
import { workerSystem } from './systems/workers';
import { roadSystem } from './systems/roads';
import { fireSystem } from './systems/fire';
import { stoneWallSystem } from './systems/stonewalls';
import { armySystem, orderAttack, orderMove, orderStance, train , orderDismount, orderGarrison, enlistSystem, setRally } from './systems/army';
import { botSystem } from './systems/bot';

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
  | { type: 'move'; player: number; ids: number[]; x: number; y: number; face?: number; form?: number; width?: number; amove?: boolean }
  /** 0 atak, 1 obrona, 2 stój */
  | { type: 'stance'; player: number; ids: number[]; stance: number }
  | { type: 'attack'; player: number; ids: number[]; target: number }
  | { type: 'gate'; player: number; id: number; open: boolean }
  /** Wyłącza albo włącza budynek z pracownikiem (wyłączony stoi pusty, pracownik idzie do innej roboty) */
  | { type: 'power'; player: number; id: number; on: boolean }
  | { type: 'garrison'; player: number; ids: number[]; tower: number }
  | { type: 'dismount'; player: number; tower: number }
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
      if (Array.isArray(c.ids) && Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < g.map.width && c.y < g.map.height)
        orderMove(g, c.player, c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), c.y * g.map.width + c.x, { face: c.face, form: c.form, width: c.width, amove: c.amove === true });
      break;
    case 'stance':
      if (Array.isArray(c.ids)) orderStance(g, c.player, c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), c.stance);
      break;
    case 'attack':
      if (Array.isArray(c.ids) && Number.isInteger(c.target)) orderAttack(g, c.player, c.ids.filter((n) => Number.isInteger(n) && !isGuard(g, n)), c.target);
      break;
    case 'dismount':
      if (Number.isInteger(c.tower)) orderDismount(g, c.player, c.tower);
      break;
    case 'garrison':
      if (Array.isArray(c.ids) && Number.isInteger(c.tower)) orderGarrison(g, c.player, c.ids.filter((n) => Number.isInteger(n)), c.tower);
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
      if (b.off && b.worker) {
        // pracownik odkłada robotę (ładunek w rękach przepada, jak przy zburzeniu) i jest wolny dla innego budynku
        const u = unitById(g, b.worker);
        if (u) { u.job = 0; u.phase = Phase.Idle; u.path = []; u.carryRes = -1; u.carryAmt = 0; u.timer = 0; u.target = 0; }
        b.worker = 0;
      }
      break;
    }
    case 'noop':
      break;
  }
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
  enlistSystem(g);
  fireSystem(g);
  armySystem(g);
  migrationSystem(g);
  travelSystem(g);
  gateSystem(g);
  stoneWallSystem(g);
  wolfSystem(g);
  guardSystem(g);
  economySystem(g);
}

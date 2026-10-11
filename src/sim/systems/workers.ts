import { BUILDINGS, type ProductionDef } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, resIndex, type StoreKind } from '../../data/resources';
import { RULES } from '../../data/rules';
import { findPath, walkable } from '../path';
import { FP, Phase, playerKeep, type Building, type GameState, type Unit } from '../state';

const RETRY_TICKS = 20;

function tileOf(g: GameState, u: Unit): number {
  return (u.py >> 8) * g.map.width + (u.px >> 8);
}

function storeDoors(g: GameState, owner: number, kind: StoreKind): Set<number> {
  const doors = new Set<number>();
  for (const b of g.buildings)
    if (b.owner === owner && b.door >= 0 && BUILDINGS[b.type]!.stores?.includes(kind)) doors.add(b.door);
  return doors;
}

/** Dokąd jednostka zmierza w obecnej fazie. null = nigdzie nie idzie. */
function goalFor(g: GameState, u: Unit, job: Building | undefined, prod: ProductionDef | undefined): ((t: number) => boolean) | null {
  switch (u.phase) {
    case Phase.Idle: {
      const keep = playerKeep(g, u.owner);
      return keep ? (t) => t === keep.door : null;
    }
    case Phase.Returning:
    case Phase.ToHome:
      return job ? (t) => t === job.door : null;
    case Phase.ToInputStore: {
      const kind = prod?.input ? RESOURCE_DEFS[prod.input.res].store : null;
      if (!kind) return null;
      const doors = storeDoors(g, u.owner, kind);
      return (t) => doors.has(t);
    }
    case Phase.ToStore: {
      const kind = u.carryRes >= 0 ? RESOURCE_DEFS[RESOURCES[u.carryRes]!].store : null;
      if (!kind) return null;
      const doors = storeDoors(g, u.owner, kind);
      return (t) => doors.has(t);
    }
    case Phase.ToSite: {
      const site = prod?.site;
      if (site === undefined || site === 'home') return null;
      return (t) => g.map.tiles[t] === site && g.occupancy[t] === 0;
    }
    default:
      return null;
  }
}

function beginCycle(u: Unit, prod: ProductionDef): void {
  if (prod.input) u.phase = Phase.ToInputStore;
  else if (prod.site !== 'home') u.phase = Phase.ToSite;
  else { u.phase = Phase.Working; u.timer = prod.workTicks; }
}

function arrive(g: GameState, u: Unit, prod: ProductionDef | undefined): void {
  const p = g.players[u.owner]!;
  switch (u.phase) {
    case Phase.Returning:
      if (prod) beginCycle(u, prod); else u.phase = Phase.Idle;
      break;
    case Phase.ToInputStore: {
      const inp = prod?.input;
      if (!inp) { u.phase = Phase.Returning; break; }
      const i = resIndex(inp.res);
      if (p.res[i]! >= inp.amount) {
        p.res[i]! -= inp.amount;
        u.carryRes = i; u.carryAmt = inp.amount; u.phase = Phase.ToHome;
      } else u.wait = RETRY_TICKS; // brak surowca: czeka przy magazynie
      break;
    }
    case Phase.ToHome:
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = Phase.Working; u.timer = prod?.workTicks ?? 0;
      break;
    case Phase.ToSite:
      u.phase = Phase.WorkingSite; u.timer = prod?.workTicks ?? 0;
      break;
    case Phase.ToStore:
      if (u.carryRes >= 0) p.res[u.carryRes]! += u.carryAmt;
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      break;
    default:
      break;
  }
}

function move(g: GameState, u: Unit): void {
  const next = u.path[0]!;
  if (!walkable(g, next)) { u.path = []; return; } // ktoś postawił budynek na drodze
  const w = g.map.width;
  const nx = next % w, ny = (next - nx) / w;
  const tx = nx * FP + FP / 2, ty = ny * FP + FP / 2;
  const dx = tx - u.px, dy = ty - u.py;
  const speed = dx !== 0 && dy !== 0 ? RULES.unitSpeedDiagonal : RULES.unitSpeed;
  u.px += Math.max(-speed, Math.min(speed, dx));
  u.py += Math.max(-speed, Math.min(speed, dy));
  if (u.px === tx && u.py === ty) u.path.shift();
}

/** Przydziela bezrobotnych do budynków bez pracownika i prowadzi chłopów przez cykl pracy. */
export function workerSystem(g: GameState): void {
  const byId = new Map<number, Building>();
  for (const b of g.buildings) byId.set(b.id, b);

  for (const b of g.buildings) {
    if (b.worker !== 0 || !BUILDINGS[b.type]!.production) continue;
    const u = g.units.find((x) => x.owner === b.owner && x.job === 0);
    if (!u) continue;
    u.job = b.id; u.phase = Phase.Returning; u.path = []; u.wait = 0;
    b.worker = u.id;
  }

  for (const u of g.units) {
    if (u.wait > 0) { u.wait--; continue; }
    const job = u.job ? byId.get(u.job) : undefined;
    const prod = job ? BUILDINGS[job.type]!.production : undefined;

    if (u.phase === Phase.Working || u.phase === Phase.WorkingSite) {
      if (--u.timer > 0 || !prod) continue;
      u.carryRes = resIndex(prod.output.res);
      u.carryAmt = prod.output.amount;
      u.phase = Phase.ToStore;
      continue;
    }
    if (u.path.length) { move(g, u); continue; }

    const goal = goalFor(g, u, job, prod);
    if (!goal) continue;
    const here = tileOf(g, u);
    if (goal(here)) { arrive(g, u, prod); continue; }
    const path = findPath(g, here, goal);
    if (path && path.length) u.path = path;
    else u.wait = RETRY_TICKS;
  }
}

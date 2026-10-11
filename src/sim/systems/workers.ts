import { BUILDINGS, type ProductionDef } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, resIndex, type StoreKind } from '../../data/resources';
import { RULES } from '../../data/rules';
import { Terrain } from '../../data/terrain';
import { findPath, walkable } from '../path';
import { FP, Phase, playerKeep, storeCapacity, storeUsed, type Building, type GameState, type Unit } from '../state';

const RETRY_TICKS = 20;
const HOUSE = BUILDINGS.findIndex((b) => b.id === 'house');

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
      // bezrobotni czekają w obozowisku przy ognisku, a gdy go nie ma, pod twierdzą
      const doors = new Set<number>();
      for (const b of g.buildings) if (b.owner === u.owner && b.door >= 0 && BUILDINGS[b.type]!.idleSlots) doors.add(b.door);
      if (doors.size) return (t) => doors.has(t);
      const keep = playerKeep(g, u.owner);
      return keep && keep.door >= 0 ? (t) => t === keep.door : null;
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
    case Phase.ToRest: {
      const doors = new Set<number>();
      for (const b of g.buildings) if (b.owner === u.owner && b.door >= 0 && b.type === HOUSE) doors.add(b.door);
      return doors.size ? (t) => doors.has(t) : null;
    }
    case Phase.ToSite: {
      const site = prod?.site;
      if (site === undefined || site === 'home') return null;
      if (site === 'shore') {
        // brzeg: wolne pole, które sąsiaduje z wodą
        const w = g.map.width, h = g.map.height;
        return (t) => {
          if (g.occupancy[t] !== 0) return false;
          const x = t % w, y = (t - x) / w;
          return (x > 0 && g.map.tiles[t - 1] === Terrain.Water) || (x < w - 1 && g.map.tiles[t + 1] === Terrain.Water) ||
            (y > 0 && g.map.tiles[t - w] === Terrain.Water) || (y < h - 1 && g.map.tiles[t + w] === Terrain.Water);
        };
      }
      return (t) => g.map.tiles[t] === site && g.occupancy[t] === 0;
    }
    default:
      return null;
  }
}

function beginCycle(u: Unit, prod: ProductionDef): void {
  // z przyniesionego pnia zostały jeszcze partie do pocięcia: najpierw one, potem następne drzewo
  if (u.batches > 0 && prod.processTicks) { u.phase = Phase.Working; u.timer = prod.processTicks; return; }
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
      u.phase = Phase.Working; u.timer = (prod?.input ? prod.workTicks : prod?.processTicks) ?? prod?.workTicks ?? 0;
      break;
    case Phase.ToSite:
      u.phase = Phase.WorkingSite; u.timer = prod?.workTicks ?? 0;
      break;
    case Phase.ToStore:
      if (u.carryRes >= 0) {
        // oddaje tyle, ile się zmieści; z resztą czeka przy składzie, aż zwolni się miejsce
        const kind = RESOURCE_DEFS[RESOURCES[u.carryRes]!].store;
        const free = kind ? storeCapacity(g, u.owner, kind) - storeUsed(p, kind) : u.carryAmt;
        const put = Math.max(0, Math.min(u.carryAmt, free));
        p.res[u.carryRes]! += put;
        u.carryAmt -= put;
        if (u.carryAmt > 0) { u.wait = RETRY_TICKS; break; }
      }
      u.carryRes = -1; u.carryAmt = 0;
      u.phase = u.job ? Phase.Returning : Phase.Idle;
      // co kilka dostaw idzie posiedzieć w chacie, o ile jakaś stoi
      if (++u.trips >= RULES.restEvery && g.buildings.some((b) => b.owner === u.owner && b.type === HOUSE)) { u.trips = 0; u.phase = Phase.ToRest; }
      break;
    case Phase.ToRest: {
      const here = tileOf(g, u);
      const house = g.buildings.find((b) => b.owner === u.owner && b.type === HOUSE && b.door === here);
      if (house) { u.home = house.id; u.phase = Phase.Resting; u.timer = RULES.restTicks; }
      else u.phase = u.job ? Phase.Returning : Phase.Idle;
      break;
    }
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

    if (u.phase === Phase.Resting) {
      if (--u.timer <= 0) { u.home = 0; u.phase = u.job ? Phase.Returning : Phase.Idle; }
      continue;
    }
    if (u.phase === Phase.Working || u.phase === Phase.WorkingSite) {
      if (--u.timer > 0 || !prod) continue;
      if (u.phase === Phase.WorkingSite && prod.site === Terrain.Forest) {
        // ścięte drzewo znika: pole lasu zamienia się w polanę, na której można budować
        const tile = tileOf(g, u);
        if (g.map.tiles[tile] === Terrain.Forest) { g.map.tiles[tile] = Terrain.Grass; g.cut.push(tile); }
      }
      u.carryRes = resIndex(prod.output.res);
      u.carryAmt = prod.output.amount;
      // z lasu drwal niesie kłodę najpierw do chaty, tam robi deski i dopiero je odnosi do składu
      if (u.phase === Phase.WorkingSite && prod.processTicks) { u.phase = Phase.ToHome; u.batches = prod.batches ?? 1; }
      else { u.phase = Phase.ToStore; if (u.batches > 0) u.batches--; }
      continue;
    }
    if (u.path.length) { move(g, u); continue; }

    const goal = goalFor(g, u, job, prod);
    if (!goal) { if (u.phase === Phase.ToRest) u.phase = u.job ? Phase.Returning : Phase.Idle; continue; }
    const here = tileOf(g, u);
    if (goal(here)) { arrive(g, u, prod); continue; }
    const path = findPath(g, here, goal);
    if (path && path.length) u.path = path;
    else u.wait = RETRY_TICKS;
  }
}

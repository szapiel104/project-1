import { RULES } from '../../data/rules';
import { FP, Phase, housing, idleCount, idleSlots, playerKeep, population, type GameState, type Unit } from '../state';

export function spawnPeasant(g: GameState, player: number): Unit | null {
  const keep = playerKeep(g, player);
  if (!keep || keep.door < 0) return null;
  const w = g.map.width;
  const x = keep.door % w, y = (keep.door - x) / w;
  const u: Unit = {
    id: g.nextId++, owner: player, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [],
    job: 0, phase: Phase.Idle, timer: 0, wait: 0, carryRes: -1, carryAmt: 0, trips: 0, home: 0, batches: 0, target: 0,
  };
  g.units.push(u);
  return u;
}

function removePeasant(g: GameState, player: number): void {
  // najpierw odchodzą bezrobotni, potem najmłodsi stażem
  let pick = -1;
  for (let i = g.units.length - 1; i >= 0; i--) {
    const u = g.units[i]!;
    if (u.owner !== player) continue;
    if (u.job === 0) { pick = i; break; }
    if (pick < 0) pick = i;
  }
  const u = g.units[pick];
  if (!u) return;
  if (u.job) { const b = g.buildings.find((x) => x.id === u.job); if (b) b.worker = 0; }
  g.units.splice(pick, 1);
}

/** Przy dobrej popularności przybywa chłopów (do liczby miejsc), przy złej odchodzą. */
export function migrationSystem(g: GameState): void {
  if (g.tick % RULES.migrationTicks !== 0) return;
  for (const p of g.players) {
    const pop = population(g, p.id);
    if (pop < RULES.minPeasants) spawnPeasant(g, p.id);
    else if (p.popularity >= RULES.migrationThreshold) {
      // nowi przychodzą tylko wtedy, gdy jest dla nich dach w chacie i wolne miejsce w obozowisku
      if (pop < housing(g, p.id) && idleCount(g, p.id) < idleSlots(g, p.id)) spawnPeasant(g, p.id);
    }
    else if (pop > RULES.minPeasants) removePeasant(g, p.id);
  }
}

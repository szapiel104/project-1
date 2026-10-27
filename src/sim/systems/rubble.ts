import { buildingById } from '../state';
import { BUILDINGS } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { Phase, type GameState, type Unit } from '../state';

/**
 * Wynoszenie gruzu. Do każdej rozbiórki idzie najpierw wolny magazynier (gruz to realny towar, który trafia do magazynu,
 * storage.ts), potem chłopi bez pracy, a gdy ich nie ma — inżynierowie z cechu, którzy akurat czekają na zajęcie.
 * Magazynier najwyżej jeden na rozbiórkę: pozostali zostają przy stosach pod magazynami.
 */
export function rubbleSystem(g: GameState): void {
  if (g.tick % 5 !== 0 || !g.rubble.length) return;
  const free = (owner: number, who: 'keeper' | 'idle' | 'staff'): Unit | undefined => g.units.find((u) => {
    if (u.owner !== owner || u.target !== 0 || u.phase !== Phase.Idle || u.carryRes >= 0) return false;
    if (who === 'idle') return u.job === 0;
    if (!u.job) return false;
    const def = BUILDINGS[buildingById(g, u.job)?.type ?? -1];
    return who === 'keeper' ? !!def?.keepers : !!def?.staff && !def.keepers;
  });
  for (const r of g.rubble) {
    let busy = 0, keeper = false;
    for (const u of g.units) {
      if (u.phase !== Phase.ToRubble || u.target !== r.id) continue;
      busy++;
      if (u.job && BUILDINGS[buildingById(g, u.job)?.type ?? -1]?.keepers) keeper = true;
    }
    while (busy < Math.min(RULES.rubbleHaulers, r.loads.length)) {
      const k = keeper ? undefined : free(r.owner, 'keeper');
      const u = k ?? free(r.owner, 'idle') ?? free(r.owner, 'staff');
      if (!u) break;
      if (k) keeper = true;
      u.target = r.id; u.phase = Phase.ToRubble; u.path = []; u.wait = 0;
      busy++;
    }
  }
}

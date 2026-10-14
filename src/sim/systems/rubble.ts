import { buildingById } from '../state';
import { BUILDINGS } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { Phase, type GameState } from '../state';

/**
 * Wynoszenie gruzu. Do każdej rozbiórki idą najpierw chłopi bez pracy,
 * a gdy ich nie ma, inżynierowie z cechu, którzy akurat czekają na zajęcie.
 */
export function rubbleSystem(g: GameState): void {
  if (g.tick % 5 !== 0 || !g.rubble.length) return;
  for (const r of g.rubble) {
    let busy = 0;
    for (const u of g.units) if (u.phase === Phase.ToRubble && u.target === r.id) busy++;
    while (busy < Math.min(RULES.rubbleHaulers, r.loads.length)) {
      const free = (staffOnly: boolean) => g.units.find((u) => u.owner === r.owner && u.target === 0 && u.phase === Phase.Idle && u.carryRes < 0 &&
        (staffOnly ? u.job !== 0 && !!BUILDINGS[buildingById(g, u.job)?.type ?? -1]?.staff : u.job === 0));
      const u = free(false) ?? free(true);
      if (!u) break;
      u.target = r.id; u.phase = Phase.ToRubble; u.path = []; u.wait = 0;
      busy++;
    }
  }
}

import { clockAt } from '../clock';
import { Phase, type GameState } from '../state';

/**
 * Pochodnie zapalają ludzie. O zmierzchu do każdej zgaszonej pochodni idzie chłop bez pracy,
 * a gdy takich brakuje, pracownik, który akurat wraca z pustymi rękami. O świcie pochodnie gasną same.
 */
export function torchSystem(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const { night } = clockAt(g.tick);
  if (!night) {
    for (const b of g.buildings) b.lit = false;
    for (const u of g.units) if (u.phase === Phase.ToLight) { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; u.path = []; }
    return;
  }
  const taken = new Set<number>();
  for (const u of g.units) if (u.target && u.phase === Phase.ToLight) taken.add(u.target);
  for (const b of g.buildings) {
    if (b.lit || b.door < 0 || taken.has(b.id)) continue;
    const u = g.units.find((x) => x.owner === b.owner && x.target === 0 && x.phase === Phase.Idle && x.job === 0)
      ?? g.units.find((x) => x.owner === b.owner && x.target === 0 && x.phase === Phase.Returning)
      // wieczorem ktoś wstaje od ogniska i zapala pochodnię, potem wraca do reszty
      ?? g.units.find((x) => x.owner === b.owner && x.phase === Phase.Evening && !x.path.length);
    if (!u) continue;
    u.target = b.id; u.phase = Phase.ToLight; u.path = []; u.wait = 0;
    taken.add(b.id);
  }
}

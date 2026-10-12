import { BUILDINGS } from '../../data/buildings';
import type { GameState } from '../state';

/** Ile pól od bramy musi być wróg albo wilk, żeby brama sama się zamknęła */
const ALARM = 8;

/**
 * Bramy: otwarta przepuszcza swoich, zamknięta nikogo. Gracz otwiera i zamyka ją ręcznie,
 * a gdy w pobliżu pojawi się wróg albo wilk, brama zamyka się sama i otwiera, gdy zagrożenie minie.
 */
export function gateSystem(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const w = g.map.width;
  const team = (p: number): number => g.players[p]?.team ?? -1;
  for (const b of g.buildings) {
    if (!BUILDINGS[b.type]!.gate || b.build) continue;
    let threat = false;
    for (const s of g.soldiers) {
      if (team(s.owner) === team(b.owner)) continue;
      if (Math.max(Math.abs((s.px >> 8) - b.x), Math.abs((s.py >> 8) - b.y)) <= ALARM) { threat = true; break; }
    }
    if (!threat) for (const v of g.wolves) if (Math.max(Math.abs((v.px >> 8) - b.x), Math.abs((v.py >> 8) - b.y)) <= ALARM) { threat = true; break; }
    const open = (b.gateOpen ?? true) && !threat;
    b.shut = !open;
    g.gates[b.y * w + b.x] = open ? b.owner + 1 : 0;
  }
}

import { BUILDINGS } from '../../data/buildings';
import { KEEP_GATE } from '../../data/keep';
import type { GameState } from '../state';

/** Ile pól od bramy musi być wrogie wojsko, żeby brama sama się zamknęła (bliżej niż kiedyś 8: własne oddziały
 * zdążą przejść, zanim wróg dojdzie) */
const ALARM = 5;
/** Krata zamku opada, gdy wróg jest bliżej bramy niż tyle pól */
const KEEP_ALARM = 10;

/**
 * Bramy: otwarta przepuszcza swoich, zamknięta nikogo. Gracz otwiera i zamyka ją ręcznie,
 * a gdy pod bramę podejdzie wrogie wojsko, zamyka się sama i otwiera, gdy zagrożenie minie. Wilki jej nie zamykają
 * (nocą krążą wokół osady — zamknięta brama więziła wojsko, które ma je przegonić).
 */
export function gateSystem(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const w = g.map.width;
  const team = (p: number): number => g.players[p]?.team ?? -1;
  for (const b of g.buildings) {
    // brama zamku: krata opada, gdy pod zamek podchodzi wrogie wojsko (wilki jej nie zamykają — ludzie wracają nocą spać)
    if (b.type === 0 && !b.ruined) {
      const gx = b.x + KEEP_GATE[0], gy = b.y + KEEP_GATE[1];
      let threat = false;
      for (const s of g.soldiers) {
        if (s.hp <= 0 || team(s.owner) === team(b.owner)) continue;
        if (Math.max(Math.abs((s.px >> 8) - gx), Math.abs((s.py >> 8) - gy)) <= KEEP_ALARM) { threat = true; break; }
      }
      b.shut = threat;
      g.gates[gy * w + gx] = threat ? 0 : b.owner + 1;
      continue;
    }
    if (!BUILDINGS[b.type]!.gate || b.build) continue;
    let threat = false;
    for (const s of g.soldiers) {
      if (s.hp <= 0 || team(s.owner) === team(b.owner)) continue;
      if (Math.max(Math.abs((s.px >> 8) - b.x), Math.abs((s.py >> 8) - b.y)) <= ALARM) { threat = true; break; }
    }
    const open = (b.gateOpen ?? true) && !threat;
    b.shut = !open;
    g.gates[b.y * w + b.x] = open ? b.owner + 1 : 0;
  }
}

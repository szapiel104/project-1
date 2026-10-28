import { RULES } from '../../data/rules';
import { Phase, type GameState } from '../state';
import { demolish } from './placement';

/** Co tyle ticków liczymy bezczynność (jak wynoszenie gruzu) */
const EVERY = 5;

/**
 * Rozpad porzuconych ruin i gruzu (Michał 28.10.2026): ruina, przy której przez 5 minut gry nikt nie pracuje
 * (nikt jej nie odbudowuje ani nie niesie na nią materiału), rozpada się i znika bez śladu — działka jest znowu wolna.
 * To samo ze stosem gruzu po rozbiórce: gdy nikt go nie wynosi przez 5 minut, reszta leżących w nim surowców przepada.
 * Każdy, kto zacznie przy nich pracę, liczy czas od zera.
 */
export function decaySystem(g: GameState): void {
  if (g.tick % EVERY !== 0) return;
  const limit = RULES.decayTicks;
  let crew: Set<number> | null = null;
  const busy = (): Set<number> => {
    if (crew) return crew;
    crew = new Set<number>();
    for (const u of g.units) if (u.target && (u.phase === Phase.ToRepair || u.phase === Phase.Repairing || u.phase === Phase.ToFetch || u.phase === Phase.ToRubble)) crew.add(u.target);
    // saperzy wroga, którzy idą rozbierać ruinę albo już ją rąbią, też się liczą — ruina nie zniknie im spod siekier
    for (const s of g.soldiers) if (s.target && s.hp > 0) crew.add(s.target);
    return crew;
  };
  const gone: number[] = [];
  for (const b of g.buildings) {
    if (!b.ruined || b.type === 0) continue;
    if (busy().has(b.id)) { b.idle = 0; continue; }
    b.idle = (b.idle ?? 0) + EVERY;
    if (b.idle >= limit) gone.push(b.id);
  }
  for (const id of gone) {
    const b = g.buildings.find((x) => x.id === id);
    if (b) demolish(g, b.owner, id, true, true);
  }
  for (let i = g.rubble.length - 1; i >= 0; i--) {
    const r = g.rubble[i]!;
    if (busy().has(r.id) || r.to) { r.idle = 0; continue; } // stos do przenosin czeka na plac (relocate.ts)
    r.idle = (r.idle ?? 0) + EVERY;
    if (r.idle < limit) continue;
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) g.reserved[ty * g.map.width + tx]!--;
    g.rubble.splice(i, 1);
  }
}

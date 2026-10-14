import { clockAt } from '../clock';
import { hash2 } from '../rng';
import { Phase, type GameState } from '../state';

/** O której (godzina gry, 20:00–21:00) zapala się pochodnia przy danym budynku — każda o innej porze */
export function torchHour(id: number): number {
  return 20 + (hash2(id, 0x70c, 7) % 100) / 100;
}

/**
 * Pochodnie przy budynkach zapalają kobiety i dzieci z pobliskich chat (widać je w wyglądzie, render/family.ts),
 * więc chłopi nie biegają wieczorem od pochodni do pochodni, tylko idą do ogniska i karczmy.
 * Każda pochodnia płonie od swojej godziny (20:00–21:00) do świtu.
 */
export function torchSystem(g: GameState): void {
  if (g.tick % 5 !== 0) return;
  const { hour } = clockAt(g.tick);
  // dawniej chłop szedł zapalić pochodnię: kto jeszcze był w drodze (stary zapis), wraca do swoich zajęć
  for (const u of g.units) if (u.phase === Phase.ToLight) { u.phase = u.job ? Phase.Returning : Phase.Idle; u.target = 0; u.path = []; }
  const dark = hour >= 20 || hour < 5.5;
  for (const b of g.buildings) {
    if (b.door < 0) { b.lit = false; continue; }
    b.lit = dark && (hour < 5.5 || hour >= torchHour(b.id));
  }
}

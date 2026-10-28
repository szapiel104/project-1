/// <reference lib="webworker" />
/**
 * Symulacja w osobnym wątku (Web Worker): logika gry, ekonomia, ścieżki i boty liczą się tutaj, a wątek główny
 * tylko rysuje i obsługuje interfejs. Dzięki temu długi tick (np. bot planujący zabudowę w 4v4) nie zatrzymuje obrazu.
 *
 * Protokół (wątek główny → tutaj):
 *   { type: 'set', gen, state }        — nowa gra albo wczytany zapis (pełny stan z mapą)
 *   { type: 'run', gen, ticks, cmds }  — policz `ticks` kroków; polecenia gracza trafiają do pierwszego
 * Odpowiedź: { type: 'state', gen, state (bez mapy — mapa zmienia się tylko przez wycinkę, patrz `cut`), ms, ticks }.
 * Używane w grze z botami, także w trybie dewelopera: akcje panelu dewelopera zmieniają stan w wątku głównym, po czym
 * main.ts (`resyncSim`) wysyła tu stan od nowa. Bez testów (`?test=1`, chyba że `&watek=1`) i bez meczu przez sieć.
 */
import { Rng } from './rng';
import type { GameState } from './state';
import { step, type Command } from './step';

let g: GameState | null = null;
let gen = 0;

self.onmessage = (e: MessageEvent): void => {
  const m = e.data as { type: 'set'; gen: number; state: GameState } | { type: 'run'; gen: number; ticks: number; cmds: Command[] };
  if (m.type === 'set') {
    g = m.state;
    Object.setPrototypeOf(g.rng, Rng.prototype);
    gen = m.gen;
    return;
  }
  if (m.type === 'run') {
    if (!g || m.gen !== gen) return;
    const t0 = performance.now();
    for (let i = 0; i < m.ticks; i++) step(g, i === 0 ? m.cmds : []);
    const ms = performance.now() - t0;
    // mapę zostawiamy u siebie: wątek główny ma własną kopię i nanosi wycinkę z `cut`
    (self as unknown as Worker).postMessage({ type: 'state', gen, state: { ...g, map: null }, ms, ticks: m.ticks });
  }
};

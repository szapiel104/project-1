import type { Command } from './step';

/**
 * Porcja kroków wysłana do wątku symulacji (simthread.ts). Gdy stan gry zmieni się w wątku głównym, zanim wynik
 * wróci (panel dewelopera), porcję odrzucamy: `cancel()` oddaje jej polecenia gracza i liczbę kroków, żeby policzyć
 * je jeszcze raz od nowego stanu. Używa main.ts (resyncSim).
 */
export class SimBatch {
  private cmds: Command[] = [];
  private ticks = 0;
  busy = false;

  /** Porcja wysłana do wątku */
  sent(cmds: Command[], ticks: number): void { this.cmds = cmds; this.ticks = ticks; this.busy = true; }

  /** Wynik porcji przyszedł */
  done(): void { this.cmds = []; this.ticks = 0; this.busy = false; }

  /** Porcja odrzucona: polecenia do ponownego wysłania (przed nowszymi) i kroki do policzenia jeszcze raz */
  cancel(): { cmds: Command[]; ticks: number } {
    const back = this.busy ? { cmds: this.cmds, ticks: this.ticks } : { cmds: [], ticks: 0 };
    this.done();
    return back;
  }
}

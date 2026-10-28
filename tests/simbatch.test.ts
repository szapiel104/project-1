// Akcja panelu dewelopera w czasie liczenia porcji w wątku: porcja odrzucona, polecenia i kroki wracają do powtórki
import { describe, expect, it } from 'vitest';
import { SimBatch } from '../src/sim/simbatch';
import type { Command } from '../src/sim/step';

describe('porcja kroków wątku symulacji', () => {
  it('odrzucona porcja oddaje polecenia i kroki', () => {
    const b = new SimBatch();
    const cmd = { type: 'demolish', player: 0, building: 7 } as unknown as Command;
    b.sent([cmd], 4);
    expect(b.busy).toBe(true);
    expect(b.cancel()).toEqual({ cmds: [cmd], ticks: 4 });
    expect(b.busy).toBe(false);
    expect(b.cancel()).toEqual({ cmds: [], ticks: 0 }); // drugi raz nic: polecenia nie wykonają się podwójnie
  });
  it('po wyniku nic nie wraca do powtórki', () => {
    const b = new SimBatch();
    b.sent([{ type: 'demolish', player: 0, building: 1 } as unknown as Command], 2);
    b.done();
    expect(b.cancel()).toEqual({ cmds: [], ticks: 0 });
  });
});

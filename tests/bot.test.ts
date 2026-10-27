import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { createGame, playerKeep, stateHash } from '../src/sim/state';
import { step } from '../src/sim/step';

describe('bot', () => {
  it('buduje osadę, szkoli wojsko i rusza na wroga; wszystko deterministycznie', () => {
    // ok. 7,5 doby: od 0.47 gospodarka jest wolniejsza (etapy osady, droższe kolejne budynki), od 0.52 część ludzi pracuje
    // jako magazynierzy, a sady przy pełnym spichlerzu czekają — koszary stają ok. 7 doby
    const play = (): ReturnType<typeof createGame> => { const g = createGame(11); for (let i = 0; i < 27000; i++) step(g, []); return g; };
    const g = play();
    const mine = g.buildings.filter((b) => b.owner === 1).map((b) => BUILDINGS[b.type]!.id);
    expect(mine).toContain('woodcutter');
    expect(mine).toContain('barracks');
    expect(g.soldiers.filter((s) => s.owner === 1).length + g.corpses.filter((c) => c.owner === 1).length).toBeGreaterThan(0);
    expect(stateHash(play())).toBe(stateHash(g));
    void playerKeep;
  }, 60000);
});

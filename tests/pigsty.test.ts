import { describe, expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { createGame, playerKeep } from '../src/sim/state';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { step } from '../src/sim/step';
import { monthlyForecast } from '../src/sim/systems/economy';

describe('chlew i różnorodne jedzenie', () => {
  it('świniopas odnosi mięso do spichlerza', () => {
    const g = createGame(9);
    emptyScene(g);
    for (const p of g.players) p.bot = false;
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W;
    expect(placeReady(g, 'pigsty', dx + 3, dy + 4)).toBeTruthy();
    placeReady(g, 'granary', dx - 4, dy + 4);
    // pusta scena daje pełne magazyny: spichlerz musi mieć miejsce na mięso
    for (const r of ['apples', 'bread', 'fish', 'meat'] as const) g.players[0]!.res[resIndex(r)] = 0;
    g.players[0]!.res[resIndex('bread')] = 60; // ludzie mają co jeść (głodni buntują się i nie pracują)
    const meat = resIndex('meat'), before = g.players[0]!.res[meat]!;
    for (let i = 0; i < 2500; i++) step(g, []);
    expect(g.players[0]!.res[meat]!).toBeGreaterThan(before);
  });

  it('każdy kolejny rodzaj jedzenia w spichlerzach to +1 do popularności', () => {
    const g = createGame(9);
    const p = g.players[0]!;
    for (const r of ['apples', 'bread', 'fish', 'meat'] as const) p.res[resIndex(r)] = 0;
    p.res[resIndex('apples')] = 400;
    const one = monthlyForecast(g, p).parts.find((x) => x.key === 'variety')!.value;
    p.res[resIndex('bread')] = 50; p.res[resIndex('fish')] = 50; p.res[resIndex('meat')] = 50;
    const four = monthlyForecast(g, p).parts.find((x) => x.key === 'variety')!.value;
    expect(one).toBe(0);
    expect(four).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { clockAt } from '../src/sim/clock';
import { createGame, keepCenter, Phase, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { monthlyForecast } from '../src/sim/systems/economy';
import { canPlace, placeBuilding } from '../src/sim/systems/placement';
import { spawnPeasant } from '../src/sim/systems/population';
import { shrineDoors } from '../src/sim/systems/workers';

/** Gotowa kapliczka przy twierdzy gracza 0 (bez budowy) */
function withShrine(g: GameState): GameState['buildings'][number] {
  const p = g.players[0]!;
  p.res[resIndex('wood')] = 500; p.res[resIndex('stone')] = 500; p.res[resIndex('bread')] = 400; // chleb dla 16 dodanych chłopów do wieczora
  const type = buildingIndex('shrine');
  const [kx, ky] = keepCenter(playerKeep(g, 0)!);
  for (let r = 6; r < RULES.buildRadius; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (canPlace(g, 0, type, kx + dx, ky + dy, false) === null && placeBuilding(g, 0, type, kx + dx, ky + dy)) {
          const b = g.buildings[g.buildings.length - 1]!;
          b.build = 0;
          return b;
        }
  throw new Error('brak miejsca na kapliczkę');
}

describe('kapliczka', () => {
  it('jest na liście budynków i ma nazwę', () => {
    const def = BUILDINGS.find((b) => b.id === 'shrine');
    expect(def?.buildable).toBe(true);
    expect(def?.w).toBe(2);
  });

  it('lekko podnosi popularność: +1 za jedną, +2 za dwie, więcej nie', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = false;
    const part = (): number => monthlyForecast(g, g.players[0]!).parts.find((x) => x.key === 'shrine')!.value;
    expect(part()).toBe(0);
    withShrine(g);
    expect(part()).toBe(1);
    withShrine(g);
    expect(part()).toBe(2);
    withShrine(g);
    expect(part()).toBe(2);
  });

  it('wieczorem część ludzi idzie pod kapliczkę się modlić', () => {
    const g = createGame(6);
    for (const p of g.players) p.bot = false;
    const shrine = withShrine(g);
    for (let i = 0; i < 16; i++) spawnPeasant(g, 0);
    expect(shrineDoors(g, 0).has(shrine.door)).toBe(true);
    // do późnego wieczoru (ok. 21:30 — dojście pod kapliczkę trochę trwa)
    let guard = 0;
    while (!(clockAt(g.tick).hour >= 21.5 && clockAt(g.tick).hour < 21.9) && guard++ < RULES.dayTicks * 2) step(g, []);
    const praying = g.units.filter((u) => u.owner === 0 && u.phase === Phase.Evening && (u.py >> 8) * g.map.width + (u.px >> 8) === shrine.door);
    expect(praying.length).toBeGreaterThan(0);
    // z kaznodzieją: co drugi z tych spoza karczmy (nieparzyści), sam kaznodzieja stoi przy swojej kapliczce
    expect(shrine.worker).toBeGreaterThan(0);
    expect(praying.filter((u) => u.id !== shrine.worker).every((u) => u.id % 2 === 1)).toBe(true);
    expect(praying.some((u) => u.id % 4 === 3)).toBe(true);
  });

  it('kaznodzieja: kazanie +1, w dzień święta +2 i wieczorem cała osada pod kapliczką', () => {
    const g = createGame(6);
    for (const p of g.players) p.bot = false;
    const shrine = withShrine(g);
    const part = (k: string): number => monthlyForecast(g, g.players[0]!).parts.find((x) => x.key === k)!.value;
    for (let i = 0; i < 60 && !shrine.worker; i++) step(g, []);
    expect(shrine.worker).toBeGreaterThan(0);
    expect(part('sermon')).toBe(RULES.faith.sermon);
    // do dnia święta
    while (clockAt(g.tick).day % RULES.faith.feastEvery !== 0) g.tick += 100;
    expect(part('feast')).toBe(RULES.faith.feast);
    shrine.off = true;
    expect(part('sermon')).toBe(0);
    expect(part('feast')).toBe(0);
  });
});

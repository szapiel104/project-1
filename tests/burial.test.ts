import { describe, expect, it } from 'vitest';
import { clearBandits } from '../src/sim/systems/bandits';
import { Terrain } from '../src/data/terrain';
import { FP, Phase, createGame as realGame, keepFront, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { RULES } from '../src/data/rules';
import { buildingIndex } from '../src/data/buildings';
import { addBuilding } from '../src/sim/systems/placement';
import { monthlyForecast } from '../src/sim/systems/economy';
import { deserialize, serialize } from '../src/sim/save';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } return g; };

/** Pole trawy z lasem obok (w czterech kierunkach) */
function underTrees(g: GameState, t: number): boolean {
  const w = g.map.width, tl = g.map.tiles;
  return tl[t] === Terrain.Grass && [t - 1, t + 1, t - w, t + w].some((n) => tl[n] === Terrain.Forest);
}

describe('pochówek bez cmentarza (Michał 28.10.2026)', () => {
  it('wolny chłop niesie ciało na skraj lasu i tam je zakopuje, a nie do obozowiska', () => {
    const g = clearBandits(createGame(7));
    g.wolves = [];
    const keep = playerKeep(g, 0)!;
    const [fx, fy] = keepFront(keep);
    g.corpses.push({ id: 999999, owner: 0, kind: -1, px: fx * FP + 128, py: (fy + 3) * FP + 128, at: g.tick, taken: false });
    let digger = -1, at = -1, done = false;
    for (let i = 0; i < 4000 && !done; i++) {
      step(g, []);
      const u = g.units.find((x) => x.phase === Phase.Burying);
      if (u && digger < 0) { digger = u.id; at = (u.py >> 8) * g.map.width + (u.px >> 8); }
      if (digger >= 0 && !g.units.some((x) => x.id === digger && x.phase === Phase.Burying)) done = true;
    }
    expect(digger).toBeGreaterThan(0);
    expect(underTrees(g, at)).toBe(true);
    expect(g.corpses.some((c) => c.id === 999999)).toBe(false);
    expect(g.units.find((x) => x.id === digger)!.carryRes).toBe(-1);
  });

  it('zostaje grób z krzyżem, który psuje nastroje i znika po kilku dniach', () => {
    const g = clearBandits(createGame(7));
    g.wolves = [];
    const keep = playerKeep(g, 0)!;
    const [fx, fy] = keepFront(keep);
    g.corpses.push({ id: 999999, owner: 0, kind: -1, px: fx * FP + 128, py: (fy + 3) * FP + 128, at: g.tick, taken: false });
    for (let i = 0; i < 4000 && !g.graves?.length; i++) step(g, []);
    expect(g.graves?.length).toBe(1);
    const gr = g.graves![0]!;
    expect(underTrees(g, gr.t)).toBe(true);
    expect(monthlyForecast(g, g.players[0]!).parts.find((x) => x.key === 'graves')!.value).toBe(-1);
    // zapis i wczytanie zachowują grób
    expect(deserialize(serialize(g, '1v1'))!.graves).toEqual(g.graves);
    // po kilku dniach zarasta
    g.tick = gr.at + RULES.graveDays * RULES.dayTicks + 5;
    while (g.tick % 10 !== 9) g.tick++;
    step(g, []);
    expect(g.graves?.length ?? 0).toBe(0);
    expect(monthlyForecast(g, g.players[0]!).parts.find((x) => x.key === 'graves')!.value).toBe(0);
  });

  it('budynek postawiony na grobie zabiera go od razu', () => {
    const g = clearBandits(createGame(7));
    g.wolves = [];
    // grób na wolnym polu przed twierdzą, potem na nim stawiamy studnię
    const keep = playerKeep(g, 0)!;
    const [fx, fy] = keepFront(keep);
    const x = fx + 4, y = fy + 4, t = y * g.map.width + x;
    g.graves = [{ t, owner: 0, at: g.tick }];
    addBuilding(g, buildingIndex('well'), 0, x, y);
    for (let i = 0; i < 12; i++) step(g, []);
    expect(g.graves.length).toBe(0);
  });
});

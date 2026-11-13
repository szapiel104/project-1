import { expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { unitIndex } from '../src/data/units';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { createGame, FP, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { clockAt } from '../src/sim/clock';

/** Przewija zegar (bez kroków symulacji) do danej godziny drugiej doby */
function night(g: GameState, hour: number): void {
  while (!(clockAt(g.tick).day === 2 && clockAt(g.tick).hour >= hour)) g.tick++;
}

function scene(): { g: GameState; store: number } {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W);
  const store = placeReady(g, 'stockpile', hx + 4, hy + 8)!;
  g.players[0]!.res.fill(200);
  g.players[0]!.level = 2;
  for (let i = 0; i < 3; i++) step(g, []);
  return { g, store };
}

it('przy niskiej popularności w nocy przychodzi złodziej, okrada magazyn i ucieka za skraj mapy', () => {
  const { g } = scene();
  night(g, 20.9);
  const p = g.players[0]!;
  const before = p.res.reduce((a, v) => a + v, 0);
  let seen = false;
  for (let i = 0; i < 3000; i++) { p.popularity = 0; step(g, []); if (g.thieves?.length) seen = true; if (seen && !g.thieves?.length) break; }
  expect(seen).toBe(true);
  expect(p.lastThief?.kind).toBe(0);
  expect(p.res.reduce((a, v) => a + v, 0)).toBeLessThan(before);
}, 60000);

it('straż przy magazynie łapie złodzieja, a łup wraca; wszystko deterministyczne', () => {
  const run = (): GameState => {
    const { g, store } = scene();
    const b = g.buildings.find((x) => x.id === store)!, W = g.map.width;
    night(g, 23.2);
    // strażnik stoi przy drzwiach magazynu
    const d = b.door, x = d % W, y = Math.floor(d / W);
    g.soldiers.push({ id: g.nextId++, owner: 0, kind: unitIndex('spearman'), px: (x + 1) * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, hold: (y * W + x + 1) });
    (g.thieves ??= []).push({ id: g.nextId++, owner: 0, px: (x - 12) * FP + FP / 2, py: y * FP + FP / 2, path: [], phase: 0, store, timer: 0 });
    for (let i = 0; i < 1500 && g.thieves!.length; i++) step(g, []);
    return g;
  };
  const g = run();
  expect(g.thieves!.length).toBe(0);
  expect(g.players[0]!.lastThief?.kind).toBe(1);
  expect(stateHash(run())).toBe(stateHash(g));
  void resIndex;
}, 60000);

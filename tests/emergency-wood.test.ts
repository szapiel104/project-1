import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { RESOURCES, resIndex } from '../src/data/resources';
import { Terrain } from '../src/data/terrain';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { CHOP_WOOD, woodCrisis } from '../src/sim/systems/emergencywood';

const WOOD = resIndex('wood');

/** Pusta łąka bez składu i drwala, zero drewna, kawałek lasu obok twierdzy */
function scene(peasants = 3): GameState {
  const g = createGame(7, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width;
  const hx = k.door % W, hy = Math.floor(k.door / W);
  for (let y = hy + 8; y < hy + 12; y++) for (let x = hx - 2; x < hx + 3; x++) g.map.tiles[y * W + x] = Terrain.Forest;
  const p = g.players[0]!;
  for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
  p.res[resIndex('bread')] = 500;
  addPeasants(g, peasants);
  setHour(g, 6);
  return g;
}
const run = (g: GameState, n: number): void => { for (let i = 0; i < n; i++) { g.players[0]!.popularity = 80; step(g, []); } };
const choppers = (g: GameState) => g.units.filter((u) => u.owner === 0 && u.chop);

describe('rąbanie z biedy', () => {
  it('bez składu i drwala, przy zerze drewna jeden wolny chłop ścina drzewa i drewno przybywa', () => {
    const g = scene();
    expect(woodCrisis(g, 0)).toBeGreaterThan(0);
    run(g, 40);
    expect(choppers(g).length).toBe(1);
    for (let i = 0; i < 3000 && g.players[0]!.res[WOOD]! < CHOP_WOOD; i++) run(g, 1);
    expect(g.players[0]!.res[WOOD]).toBeGreaterThanOrEqual(CHOP_WOOD);
    expect(choppers(g).length).toBe(1); // dalej tylko jeden
  });

  it('ze składem i chatą drwala nikt nie rąbie z biedy', () => {
    const g = scene();
    const k = g.buildings[0]!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    placeReady(g, 'stockpile', hx + 5, hy + 3);
    placeReady(g, 'woodcutter', hx - 6, hy + 3);
    expect(woodCrisis(g, 0)).toBe(0);
    run(g, 200);
    expect(choppers(g).length).toBe(0);
  });

  it('gdy drewna starcza na brakujący skład i drwala, rąbanie się kończy', () => {
    const g = scene();
    run(g, 40);
    expect(choppers(g).length).toBe(1);
    g.players[0]!.res[WOOD] = 30;
    run(g, 40);
    expect(choppers(g).length).toBe(0);
  });
});

describe('rąbanie z biedy — bot', () => {
  it('pobity bot bez składu i drewna: chłop narąbie, bot stawia skład, a potem chatę drwala', () => {
    const g = scene(0);
    const p = g.players[1]!;
    p.bot = true; // pusta scena wyłącza boty — tu włączamy jednego (poziom 0: nie atakuje)
    for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
    p.res[resIndex('bread')] = 500;
    const k = g.buildings.find((b) => b.owner === 1)!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    for (let y = hy + 8; y < hy + 14; y++) for (let x = hx - 4; x < hx + 5; x++) g.map.tiles[y * W + x] = Terrain.Forest;
    placeReady(g, 'orchard', hx + 6, hy + 4, 0, 1);
    placeReady(g, 'orchard', hx - 8, hy + 4, 0, 1);
    placeReady(g, 'granary', hx + 6, hy - 2, 0, 1);
    addPeasants(g, 4, 1);
    const has = (id: string) => g.buildings.some((b) => b.owner === 1 && BUILDINGS[b.type]!.id === id);
    let storeAt = -1, cutterAt = -1;
    for (let i = 0; i < 20000 && cutterAt < 0; i++) {
      g.players[1]!.popularity = 80; step(g, []);
      if (storeAt < 0 && has('stockpile')) storeAt = i;
      if (cutterAt < 0 && has('woodcutter')) cutterAt = i;
    }
    expect(storeAt).toBeGreaterThanOrEqual(0);
    expect(cutterAt).toBeGreaterThan(storeAt);
  });
});

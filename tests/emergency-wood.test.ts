import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { RESOURCES, resIndex } from '../src/data/resources';
import { Terrain } from '../src/data/terrain';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, Phase, type GameState } from '../src/sim/state';
import { placeBuilding } from '../src/sim/systems/placement';
import { step } from '../src/sim/step';
import { CHOP_WOOD, heldAmount, woodCrisis } from '../src/sim/systems/emergencywood';

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

describe('rąbanie z biedy — deski przy pniaku', () => {
  it('po ścięciu i obróbce deski leżą stosem przy pniaku i liczą się do zapasów', () => {
    const g = scene(1);
    for (let i = 0; i < 4000 && !(g.piles ?? []).some((p) => p.held); i++) run(g, 1);
    const pile = g.piles!.find((p) => p.held)!;
    expect(pile.amt).toBe(CHOP_WOOD);
    expect(pile.res).toBe(WOOD);
    expect(g.map.tiles[pile.t]).toBe(Terrain.Grass); // przy pniaku ściętego drzewa
    expect(g.players[0]!.res[WOOD]).toBe(CHOP_WOOD);
  });

  it('za deski z biedy staje skład: budowniczy nosi je ze stosu, stos znika, a skład rośnie', () => {
    const g = scene(1);
    const p = g.players[0]!;
    p.dev = false; // zwykła budowa z noszeniem materiału
    for (let i = 0; i < 12000 && p.res[WOOD]! < 15; i++) run(g, 1);
    expect(p.res[WOOD]).toBeGreaterThanOrEqual(15);
    const k = g.buildings[0]!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    expect(placeBuilding(g, 0, buildingIndex('stockpile'), hx + 5, hy + 3)).toBe(true);
    const site = g.buildings[g.buildings.length - 1]!;
    expect(site.build).toBeGreaterThan(0);
    const before = heldAmount(g, 0, WOOD);
    expect(before).toBeGreaterThanOrEqual(15); // zapłacone, ale deski jeszcze leżą — ktoś musi je przynieść
    let fetched = false;
    for (let i = 0; i < 6000 && site.build > 0; i++) { run(g, 1); if (g.units.some((u) => u.phase === Phase.ToRepair && u.carryRes === WOOD)) fetched = true; }
    expect(fetched).toBe(true);
    expect(site.build).toBe(0);
    expect(heldAmount(g, 0, WOOD)).toBeLessThan(before);
  });
});

import { expect, it } from 'vitest';
import { RULES } from '../src/data/rules';
import { Terrain } from '../src/data/terrain';
import { deserialize, serialize } from '../src/sim/save';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { applyCut, createGame, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';

function scene(): { g: GameState; id: number; hx: number; hy: number } {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width;
  const hx = k.door % W, hy = Math.floor(k.door / W);
  const id = placeReady(g, 'forester', hx - 1, hy + 8)!;
  addPeasants(g, 1);
  setHour(g, 7);
  return { g, id, hx, hy };
}

it('leśniczy sadzi drzewka w swoim terenie, a pola z drzewkami są zarezerwowane', () => {
  const { g, id } = scene();
  for (let i = 0; i < 1500; i++) step(g, []);
  const mine = (g.saplings ?? []).filter((s) => s.by === id);
  expect(mine.length).toBeGreaterThan(2);
  const b = g.buildings.find((x) => x.id === id)!, W = g.map.width;
  for (const s of mine) {
    const x = s.t % W, y = Math.floor(s.t / W);
    expect(Math.abs(x - b.x)).toBeLessThanOrEqual(7);
    expect(Math.abs(y - b.y)).toBeLessThanOrEqual(7);
    expect(g.reserved[s.t]).toBeGreaterThan(0);
    expect(g.map.tiles[s.t]).toBe(Terrain.Grass);
  }
  // drzewka nie stoją tuż przy chacie
  for (const s of mine) {
    const x = s.t % W, y = Math.floor(s.t / W);
    expect(x >= b.x - 1 && x <= b.x + 2 && y >= b.y - 1 && y <= b.y + 2).toBe(false);
  }
});

it('drzewko dorasta w las, a zapis gry pamięta sadzonki i odrośnięty las', () => {
  const { g, id } = scene();
  for (let i = 0; i < 1500; i++) step(g, []);
  const first = g.saplings!.find((s) => s.by === id)!;
  // zapis w trakcie wzrostu: sadzonki i rezerwacja pól wracają
  const mid = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
  expect(mid.saplings!.length).toBe(g.saplings!.length);
  expect(mid.reserved[first.t]).toBe(g.reserved[first.t]);
  for (let i = 0; i < RULES.saplingTicks + 200; i++) step(g, []);
  expect(g.map.tiles[first.t]).toBe(Terrain.Forest);
  expect(g.cut).toContain(~first.t);
  expect(g.reserved[first.t]).toBe(0);
  expect(g.saplings!.some((s) => s.t === first.t)).toBe(false);
  // po wczytaniu odrośnięty las stoi tam, gdzie stał
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
  expect(back.map.tiles[first.t]).toBe(Terrain.Forest);
  // limit rosnących drzewek na chatę
  expect(g.saplings!.filter((s) => s.by === id).length).toBeLessThanOrEqual(RULES.foresterSaplings);
});

it('dziennik lasu: wycięte pole to łąka, odrośnięte znowu las (kolejność się liczy)', () => {
  const tiles = new Uint8Array([Terrain.Forest]);
  for (const e of [0, ~0, 0]) applyCut(tiles, e);
  expect(tiles[0]).toBe(Terrain.Grass);
  applyCut(tiles, ~0);
  expect(tiles[0]).toBe(Terrain.Forest);
});

it('drwal ścina drzewo, które posadził leśniczy', () => {
  const { g, id, hx, hy } = scene();
  for (let i = 0; i < 1500 + RULES.saplingTicks + 400; i++) step(g, []);
  const grown = g.cut.filter((e) => e < 0).map((e) => ~e);
  expect(grown.length).toBeGreaterThan(0);
  expect(g.buildings.some((b) => b.id === id)).toBe(true);
  placeReady(g, 'woodcutter', hx + 4, hy + 8);
  placeReady(g, 'stockpile', hx + 4, hy + 4);
  addPeasants(g, 1);
  setHour(g, 7);
  const before = g.cut.length;
  for (let i = 0; i < 1200; i++) step(g, []);
  const cutNow = g.cut.slice(before).filter((e) => e >= 0);
  expect(cutNow.some((t) => grown.includes(t))).toBe(true);
});

it('zapis zwykłej mapy z sadzonką i odrośniętym lasem daje ten sam stan', () => {
  const g = createGame(5, '1v1');
  const W = g.map.width;
  const forest = g.map.tiles.findIndex((t, i) => t === Terrain.Forest && i > W * 10);
  const grass = g.map.tiles.findIndex((t, i) => t === Terrain.Grass && i > W * 10 && !g.occupancy[i] && !g.reserved[i]);
  // wycięte, odrośnięte i wycięte jeszcze raz, potem odrośnięte: liczy się ostatni wpis
  for (const e of [forest, ~forest, forest, ~forest]) { g.cut.push(e); applyCut(g.map.tiles, e); }
  g.cut.push(grass); applyCut(g.map.tiles, grass);
  g.saplings = [{ t: grass, owner: 0, by: 1, age: 123 }];
  g.reserved[grass]!++;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
  expect(back.map.tiles[forest]).toBe(Terrain.Forest);
  expect(back.reserved[grass]).toBe(g.reserved[grass]);
  expect(stateHash(back)).toBe(stateHash(g));
});

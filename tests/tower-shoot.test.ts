import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { unitIndex } from '../src/data/units';
import { FP, createGame, playerKeep, population, type Soldier } from '../src/sim/state';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { step } from '../src/sim/step';
import { towerOf } from '../src/sim/systems/army';
import { resIndex } from '../src/data/resources';

describe('wieża strażnicza', () => {
  it('łucznik na wieży strzela do wroga, który podejdzie na zasięg', () => {
    const g = createGame(3, '1v1', 2, true);
    for (const p of g.players) p.bot = false;
    const tower = g.buildings.find((b) => b.owner === 0 && b.type === buildingIndex('watchtower'))!;
    expect(tower).toBeTruthy();
    // łucznicy od startu stoją na polach pomostu (jak na terenie)
    step(g, []);
    expect(g.soldiers.some((s) => s.owner === 0 && towerOf(g, s) === tower.id)).toBe(true);
    // wróg staje 7 pól od wieży, w polu, i się nie rusza
    const W = g.map.width;
    let spot = -1;
    for (let d = 7; d <= 8 && spot < 0; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]] as const) {
      const t = (tower.y + 1 + dy) * W + tower.x + 1 + dx;
      if (!g.occupancy[t] && g.map.tiles[t] === 0) { spot = t; break; }
    }
    expect(spot).toBeGreaterThan(0);
    const foe: Soldier = { id: g.nextId++, owner: 1, kind: unitIndex('spearman'), px: (spot % W) * FP + FP / 2, py: Math.floor(spot / W) * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, stance: 2, hold: spot };
    g.soldiers.push(foe);
    for (let i = 0; i < 200; i++) step(g, []);
    expect(foe.hp).toBeLessThan(60);
  });
});

describe('polegli na wieży', () => {
  it('ciało zostaje na wieży, a chłop zabiera je spod wieży', () => {
    const g = createGame(9);
    emptyScene(g);
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W;
    const towerId = placeReady(g, 'watchtower', dx + 4, dy + 6)!;
    expect(towerId).toBeTruthy();
    const tower = g.buildings.find((b) => b.id === towerId)!;
    while (population(g, 0) < 12) spawnPeasant(g, 0);
    for (let i = 0; i < 50; i++) step(g, []);
    const a: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: (tower.x + 1) * FP, py: (tower.y + 1) * FP, path: [], hp: 0, goal: -1, wait: 0, target: 0, cd: 0, up: true, post: tower.id };
    g.soldiers.push(a);
    step(g, []);
    const body = g.corpses.find((c) => c.id === a.id)!;
    expect(body.post).toBe(tower.id);
    for (let i = 0; i < 3000 && g.corpses.some((c) => c.id === a.id); i++) step(g, []);
    expect(g.corpses.some((c) => c.id === a.id)).toBe(false);
  });
});

describe('szturm na wieżę (jak w Twierdzy)', () => {
  it('wróg wspina się drabiną na pomost i ścina łucznika', async () => {
    const { orderGarrison } = await import('../src/sim/systems/army');
    const g = createGame(9);
    emptyScene(g);
    for (const p of g.players) p.bot = false;
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W;
    const towerId = placeReady(g, 'watchtower', dx + 4, dy + 6)!;
    const tower = g.buildings.find((b) => b.id === towerId)!;
    const archer: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: (tower.x - 2) * FP + 128, py: tower.y * FP + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    g.soldiers.push(archer);
    orderGarrison(g, 0, [archer.id], tower.id);
    for (let i = 0; i < 300 && towerOf(g, archer) !== tower.id; i++) step(g, []);
    expect(towerOf(g, archer)).toBe(tower.id);
    // wróg z mieczem pod samą wieżą (łucznik ma go za blisko na strzał z góry)
    const foe: Soldier = { id: g.nextId++, owner: 1, kind: unitIndex('manatarms'), px: (tower.x + 3) * FP + 128, py: (tower.y + 3) * FP + 128, path: [], hp: 400, goal: -1, wait: 0, target: archer.id, cd: 0 };
    g.soldiers.push(foe);
    let climbed = false;
    for (let i = 0; i < 600 && archer.hp > 0; i++) { step(g, []); if (towerOf(g, foe) === tower.id) climbed = true; }
    expect(climbed).toBe(true);
    expect(g.soldiers.some((s) => s.id === archer.id)).toBe(false);
  });
});

describe('drabiny oblężnicze (jak w Twierdzy)', () => {
  it('drabiniarz przystawia drabinę do muru, zbrojny wchodzi po niej i ścina łucznika; drabiniarz biegnie po następną do namiotu', () => {
    const g = createGame(9);
    emptyScene(g);
    for (const p of g.players) p.bot = false;
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W;
    // odcinek muru kamiennego w poprzek, 8 pól przed bramą
    const y = dy + 8;
    for (let x = dx - 3; x <= dx + 3; x++) expect(placeReady(g, 'stoneWall', x, y)).toBeTruthy();
    // namiot polowy wroga niedaleko muru: tu drabiniarz bierze nową drabinę
    let tent: number | null = null;
    for (let o = 6; o < 14 && !tent; o++) tent = placeReady(g, 'fieldTent', dx + 2, y + o, 0, 1);
    expect(tent).toBeTruthy();
    step(g, []);
    const archer: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: dx * FP + 128, py: y * FP + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    g.soldiers.push(archer);
    // jedna drabina w zbrojowni wroga (zrobił ją cieśla) i drabiniarz, który niesie swoją
    g.players[1]!.res[resIndex('ladder')] = 1;
    const lad: Soldier = { id: g.nextId++, owner: 1, kind: unitIndex('ladderman'), px: (dx - 1) * FP + 128, py: (y + 3) * FP + 128, path: [], hp: 45, goal: -1, wait: 0, target: 0, cd: 0 };
    const foe: Soldier = { id: g.nextId++, owner: 1, kind: unitIndex('manatarms'), px: (dx + 1) * FP + 128, py: (y + 2) * FP + 128, path: [], hp: 400, goal: -1, wait: 0, target: archer.id, cd: 0 };
    g.soldiers.push(lad, foe);
    let planted = false;
    for (let i = 0; i < 900 && g.soldiers.some((s) => s.id === archer.id); i++) { step(g, []); if (g.siegeLadders?.length) planted = true; }
    expect(planted).toBe(true);
    expect(g.soldiers.some((s) => s.id === archer.id)).toBe(false);
    // drabiniarz wrócił do namiotu i wziął drabinę ze zbrojowni
    for (let i = 0; i < 600 && g.players[1]!.res[resIndex('ladder')]! > 0; i++) step(g, []);
    expect(g.players[1]!.res[resIndex('ladder')]).toBe(0);
    expect(g.soldiers.find((s) => s.id === lad.id)?.noLadder).toBeUndefined();
    // obrońca na koronie spycha drabinę, przy której nikt nie wchodzi
    g.soldiers = g.soldiers.filter((s) => s.owner === 0);
    const def: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('spearman'), px: (g.siegeLadders![0]!.wall % W) * FP + 128, py: Math.floor(g.siegeLadders![0]!.wall / W) * FP + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    g.soldiers.push(def);
    for (let i = 0; i < 200 && g.siegeLadders!.length; i++) step(g, []);
    expect(g.siegeLadders!.length).toBe(0);
  });
});

describe('drabiny stawia tylko drabiniarz', () => {
  it('zwykły żołnierz nie przystawi drabiny, choć leżą w zbrojowni', () => {
    const g = createGame(9);
    emptyScene(g);
    for (const p of g.players) p.bot = false;
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W, y = dy + 8;
    for (let x = dx - 3; x <= dx + 3; x++) placeReady(g, 'stoneWall', x, y);
    step(g, []);
    g.players[1]!.res[resIndex('ladder')] = 5;
    const archer: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('archer'), px: dx * FP + 128, py: y * FP + 128, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    const foe: Soldier = { id: g.nextId++, owner: 1, kind: unitIndex('manatarms'), px: (dx + 1) * FP + 128, py: (y + 2) * FP + 128, path: [], hp: 400, goal: -1, wait: 0, target: archer.id, cd: 0 };
    g.soldiers.push(archer, foe);
    for (let i = 0; i < 300; i++) step(g, []);
    expect(g.siegeLadders?.length ?? 0).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { unitIndex } from '../src/data/units';
import { FP, createGame, playerKeep, population, type Soldier } from '../src/sim/state';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { step } from '../src/sim/step';
import { towerOf } from '../src/sim/systems/army';

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

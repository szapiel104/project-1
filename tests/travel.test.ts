import { RULES } from '../src/data/rules';
import { describe, expect, it } from 'vitest';
import { createGame, Phase } from '../src/sim/state';
import { BUILDINGS } from '../src/data/buildings';
import { clockAt } from '../src/sim/clock';
import { step } from '../src/sim/step';
import { serialize, deserialize } from '../src/sim/save';

describe('wędrowcy', () => {
  it('nowi chłopi przychodzą spoza mapy i stają się mieszkańcami', () => {
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    g.units = g.units.filter((u) => u.owner !== 0); // pusta osada: muszą przyjść nowi
    const before = 0;
    let seen = false;
    for (let i = 0; i < 6000; i++) { step(g, []); if (g.travelers.some((t) => !t.leaving)) seen = true; }
    expect(seen).toBe(true);
    expect(g.units.filter((u) => u.owner === 0).length).toBeGreaterThan(before);
    const back = deserialize(serialize(g, '1v1'));
    expect(back?.travelers.length).toBe(g.travelers.length);
  });
});

describe('budowa', () => {
  it('nowy budynek najpierw stoi w budowie, robotnicy go kończą', async () => {
    const { placeBuilding } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let placed = false;
    for (let r = 4; r < 14 && !placed; r++) for (let d = -r; d <= r && !placed; d++) placed = placeBuilding(g, 0, buildingIndex('house'), keep.x + d, keep.y + r);
    const b = g.buildings[g.buildings.length - 1]!;
    expect(b.build).toBeGreaterThan(0);
    for (let i = 0; i < 2000 && b.build; i++) step(g, []);
    expect(b.build).toBe(0);
  });
});

describe('palisada i brama', () => {
  it('brama przepuszcza swoich, a obcych nie; palisada nie potrzebuje wejścia', async () => {
    const { placeBuilding } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { walkable } = await import('../src/sim/path');
    const g = createGame(5, '1v1', 2);
    const keep = g.buildings[0]!;
    let x = 0, y = 0;
    const { canPlace: cp } = await import('../src/sim/systems/placement');
    for (let r = 4; r < 15 && !x; r++) for (let d = -r; d <= r && !x; d++) if (cp(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r) === null && cp(g, 0, buildingIndex('gate'), keep.x + d, keep.y + r + 1) === null) { x = keep.x + d; y = keep.y + r; }
    const { canPlace } = await import('../src/sim/systems/placement');
    expect(canPlace(g, 0, buildingIndex('palisade'), x, y)).toBe(null);
    expect(placeBuilding(g, 0, buildingIndex('palisade'), x, y)).toBe(true);
    expect(canPlace(g, 0, buildingIndex('gate'), x, y + 1)).toBe(null);
    expect(placeBuilding(g, 0, buildingIndex('gate'), x, y + 1)).toBe(true);
    const w = g.map.width;
    expect(walkable(g, y * w + x, 0)).toBe(false);
    expect(walkable(g, (y + 1) * w + x, 0)).toBe(true);
    expect(walkable(g, (y + 1) * w + x, 1)).toBe(false);
    const back = deserialize(serialize(g, '1v1'))!;
    expect(walkable(back, (y + 1) * w + x, 0)).toBe(true);
  });
});

describe('wilki', () => {
  it('nocą przychodzi wataha, o świcie znika; gra pokojowa jest bez wilków', () => {
    const g = createGame(9, '1v1', 2);
    for (const p of g.players) p.bot = false;
    let most = 0;
    for (let i = 0; i < RULES.dayTicks * 3 + 400; i++) { step(g, []); most = Math.max(most, g.wolves.length); }
    expect(most).toBeGreaterThan(1);
    expect(g.wolves.length).toBe(0); // po świcie
    const calm = createGame(9, '1v1', 0);
    for (const p of calm.players) p.bot = false;
    for (let i = 0; i < RULES.dayTicks * 3; i++) step(calm, []);
    expect(calm.wolves.length + calm.players[0]!.stats.lost).toBe(0);
  });
});

describe('budowa palisady', () => {
  it('robotnicy stawiają też umocnienia bez wejścia', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const g = createGame(5, '1v1', 2);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let b = null as null | (typeof g.buildings)[number];
    for (let r = 4; r < 15 && !b; r++) for (let d = -r; d <= r && !b; d++) if (canPlace(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r) === null) { placeBuilding(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r); b = g.buildings[g.buildings.length - 1]!; }
    for (let i = 0; i < 1500 && b!.build; i++) step(g, []);
    expect(b!.build).toBe(0);
  });
});

describe('tryb deweloperski', () => {
  it('stawia budynki od razu gotowe i daje zapasy', () => {
    const g = createGame(5, '1v1', 1, true);
    expect(g.buildings.filter((b) => b.owner === 0).length).toBeGreaterThan(8);
    expect(g.buildings.every((b) => !b.build)).toBe(true);
    expect(g.players[0]!.dev).toBe(true);
  });
});

describe('brama', () => {
  it('zamknięta nie przepuszcza nikogo, otwarta swoich; zamyka się sama, gdy wilk blisko', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { walkable } = await import('../src/sim/path');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let gate = null as null | (typeof g.buildings)[number];
    for (let r = 4; r < 15 && !gate; r++) for (let d = -r; d <= r && !gate; d++) if (canPlace(g, 0, buildingIndex('gate'), keep.x + d, keep.y + r) === null) { placeBuilding(g, 0, buildingIndex('gate'), keep.x + d, keep.y + r); gate = g.buildings[g.buildings.length - 1]!; }
    gate!.build = 0;
    const t = gate!.y * g.map.width + gate!.x;
    step(g, [{ type: 'gate', player: 0, id: gate!.id, open: false }]);
    for (let i = 0; i < 5; i++) step(g, []);
    expect(walkable(g, t, 0)).toBe(false);
    step(g, [{ type: 'gate', player: 0, id: gate!.id, open: true }]);
    for (let i = 0; i < 5; i++) step(g, []);
    expect(walkable(g, t, 0)).toBe(true);
    g.wolves.push({ id: 99999, px: gate!.x * 256 + 128, py: (gate!.y + 3) * 256 + 128, hp: 45, path: [], target: 0, cd: 0, leaving: false });
    for (let i = 0; i < 5; i++) step(g, []);
    expect(gate!.shut).toBe(true);
  });
});

describe('wilki polują naprawdę', () => {
  it('dochodzą do człowieka daleko od miejsca, gdzie wyszły, i go zagryzają', () => {
    const g = createGame(9, '1v1', 2);
    for (const p of g.players) { p.bot = false; p.guards = 0; } // bez straży miejskiej, która wybiłaby watahę
    // noc, wataha na brzegu mapy; ludzie bez dachu nad głową śpią na słomie pod gołym niebem (w chacie wilk ich nie dosięgnie)
    while (!(clockAt(g.tick).hour >= 22.5 && clockAt(g.tick).hour < 23)) step(g, []);
    for (const u of g.units) { u.phase = Phase.Sleeping; u.home = 0; u.target = (u.py >> 8) * g.map.width + (u.px >> 8) + 1; u.path = []; }
    for (let i = 0; i < 3; i++) g.wolves.push({ id: 99001 + i, px: 2 * 256 + 128, py: (29 + i) * 256 + 128, hp: 45, path: [], target: 0, cd: 0, leaving: false });
    // nie ma dokąd uciec: twierdza bez izb (gdy jest dach, obudzeni chowają się pod nim)
    const keepDef = BUILDINGS[0] as { housing?: number };
    const saved = keepDef.housing;
    keepDef.housing = 0;
    let body = false;
    try {
      // ta wataha może nie zdążyć przed świtem; następna wychodzi o zmierzchu od strony osady
      for (let i = 0; i < RULES.dayTicks * 1.2; i++) { step(g, []); body ||= g.corpses.some((c) => c.kind === -1); }
    } finally { keepDef.housing = saved; }
    expect(g.players.reduce((n, p) => n + p.stats.lost, 0)).toBeGreaterThan(0);
    expect(body).toBe(true);
  });
});

describe('ruiny', () => {
  it('zniszczony mur zostaje ruiną z wyłomem, a robotnicy go odbudowują', async () => {
    const { placeBuilding, canPlace, ruin } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { walkable } = await import('../src/sim/path');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let b = null as null | (typeof g.buildings)[number];
    for (let r = 4; r < 15 && !b; r++) for (let d = -r; d <= r && !b; d++) if (canPlace(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r) === null) { placeBuilding(g, 0, buildingIndex('palisade'), keep.x + d, keep.y + r); b = g.buildings[g.buildings.length - 1]!; }
    b!.build = 0;
    const t = b!.y * g.map.width + b!.x;
    g.occupancy[t] = b!.id;
    ruin(g, b!);
    expect(g.buildings.includes(b!)).toBe(true);
    expect(walkable(g, t, 1)).toBe(true);
    for (let i = 0; i < 2000 && b!.ruined; i++) step(g, []);
    expect(b!.ruined).toBe(false);
    expect(walkable(g, t, 1)).toBe(false);
  });
});

describe('łucznicy', () => {
  it('strzelają z daleka i wchodzą na wieżę', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { unitIndex } = await import('../src/data/units');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let tower = null as null | (typeof g.buildings)[number];
    for (let r = 4; r < 15 && !tower; r++) for (let d = -r; d <= r && !tower; d++) if (canPlace(g, 0, buildingIndex('watchtower'), keep.x + d, keep.y + r) === null) { placeBuilding(g, 0, buildingIndex('watchtower'), keep.x + d, keep.y + r); tower = g.buildings[g.buildings.length - 1]!; }
    tower!.build = 0;
    const A = unitIndex('archer');
    const ax = (tower!.x - 2) * 256 + 128, ay = tower!.y * 256 + 128;
    g.soldiers.push({ id: 70001, owner: 0, kind: A, px: ax, py: ay, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 });
    step(g, [{ type: 'garrison', player: 0, ids: [70001], tower: tower!.id }]);
    for (let i = 0; i < 200; i++) step(g, []);
    const a = g.soldiers.find((s) => s.id === 70001)!;
    expect(a.up).toBe(true);
    // wróg 7 pól dalej: z wieży (zasięg 6+3) trafia, wręcz go nie dosięgną
    g.soldiers.push({ id: 70002, owner: 1, kind: 0, px: a.px + 7 * 256, py: a.py, path: [], hp: 60, goal: -1, wait: 999, target: 0, cd: 0 });
    for (let i = 0; i < 60; i++) step(g, []);
    const foe = g.soldiers.find((s) => s.id === 70002);
    expect(!foe || foe.hp < 60).toBe(true);
  });
});

describe('karczma i browar', () => {
  it('karczma z piwem w składzie podnosi popularność, sucha karczma ją obniża', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { monthlyForecast } = await import('../src/sim/systems/economy');
    const { resIndex } = await import('../src/data/resources');
    const g = createGame(5, '1v1', 0, true);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let done = false;
    for (let r = 4; r < 22 && !done; r++) for (let d = -r; d <= r && !done; d++) if (canPlace(g, 0, buildingIndex('tavern'), keep.x + d, keep.y + r) === null) done = placeBuilding(g, 0, buildingIndex('tavern'), keep.x + d, keep.y + r);
    for (let i = 0; i < 50; i++) step(g, []);
    const p0 = g.players[0]!, ALE = resIndex('ale');
    p0.res[ALE] = 10;
    expect(monthlyForecast(g, p0).parts.find((x) => x.key === 'tavern')!.value).toBeGreaterThan(0);
    p0.res[ALE] = 0;
    expect(monthlyForecast(g, p0).parts.find((x) => x.key === 'tavern')!.value).toBeLessThan(0);
  });
  it('browar warzy piwo z pszenicy ze składu', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { resIndex } = await import('../src/data/resources');
    const g = createGame(5, '1v1', 0, true);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    let done = false;
    for (let r = 4; r < 22 && !done; r++) for (let d = -r; d <= r && !done; d++) if (canPlace(g, 0, buildingIndex('brewery'), keep.x + d, keep.y + r) === null) done = placeBuilding(g, 0, buildingIndex('brewery'), keep.x + d, keep.y + r);
    expect(done).toBe(true);
    const p0 = g.players[0]!;
    // bez karczmy nikt piwa nie pije, więc przybywa go tylko z browaru
    for (const b of g.buildings) if (b.owner === 0 && b.type === buildingIndex('tavern')) b.worker = 0;
    p0.res[resIndex('wheat')] = 20; p0.res[resIndex('ale')] = 0;
    for (let i = 0; i < 2500 && !p0.res[resIndex('ale')]; i++) step(g, []);
    expect(p0.res[resIndex('ale')]).toBeGreaterThan(0);
  });
});

describe('wilki budzą śpiących', () => {
  it('śpiący na słomie zrywa się, gdy wilk podchodzi, i ucieka pod dach', () => {
    const g = createGame(9, '1v1', 2);
    for (const p of g.players) p.bot = false;
    while (!(clockAt(g.tick).hour >= 23 && clockAt(g.tick).hour < 23.5)) step(g, []);
    const u = g.units.find((x) => x.owner === 0)!;
    // śpi na słomie kilka pól od twierdzy
    u.px += 6 * 256; u.phase = Phase.Sleeping; u.home = 0; u.target = (u.py >> 8) * g.map.width + (u.px >> 8) + 1; u.path = [];
    g.wolves.push({ id: 99500, px: u.px + 5 * 256, py: u.py, hp: 45, path: [], target: 0, cd: 0, leaving: false });
    step(g, []); step(g, []);
    expect(u.phase).toBe(Phase.ToSleep);
    expect(u.home).toBeGreaterThan(0);
  });
});

describe('plac przed bramą', () => {
  it('przed bramą zamku nie da się budować, a startowe budynki stoją poza placem', async () => {
    const { canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex, BUILDINGS, footprint } = await import('../src/data/buildings');
    const { inForecourt, keepFront } = await import('../src/sim/state');
    const g = createGame(5, '1v1', 0, true);
    const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    const [fx, fy] = keepFront(keep);
    expect(canPlace(g, 0, buildingIndex('house'), fx - 1, fy + 1)).toBe('place.forecourt');
    for (const b of g.buildings) {
      if (b.type === 0) continue;
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) expect(inForecourt(g, x, y)).toBe(false);
    }
  });
});

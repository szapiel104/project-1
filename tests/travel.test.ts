import { RULES } from '../src/data/rules';
import { clearBandits } from '../src/sim/systems/bandits';
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
  it('zamknięta nie przepuszcza nikogo, otwarta swoich; wilk jej nie zamyka, wrogie wojsko pod bramą tak', async () => {
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
    expect(gate!.shut).toBe(false); // wilki nie więżą wojska za bramą
    g.soldiers.push({ id: 99998, owner: 1, kind: 0, px: gate!.x * 256 + 128, py: (gate!.y + 3) * 256 + 128, path: [], hp: 100, goal: -1, wait: 0, target: 0, cd: 0 });
    for (let i = 0; i < 5; i++) step(g, []);
    expect(gate!.shut).toBe(true);
  });
});

describe('wilki polują naprawdę', () => {
  it('dochodzą do człowieka daleko od miejsca, gdzie wyszły, i go zagryzają', () => {
    const g = clearBandits(createGame(9, '1v1', 2)); // wilki mają polować na chłopów, nie na zbójów z lasu
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

describe('zbrojownia', () => {
  it('włóczniarz odnosi włócznie do zbrojowni; bez niej czeka z bronią', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { buildingIndex } = await import('../src/data/buildings');
    const { resIndex } = await import('../src/data/resources');
    const { storeUsed } = await import('../src/sim/state');
    const g = createGame(5, '1v1', 0);   // bez trybu deweloperskiego: tam stoi już pokaz wszystkich budynków
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    const put = (id: string): boolean => {
      for (let r = 4; r < 24; r++) for (let d = -r; d <= r; d++) if (canPlace(g, 0, buildingIndex(id), keep.x + d, keep.y + r) === null) return placeBuilding(g, 0, buildingIndex(id), keep.x + d, keep.y + r);
      return false;
    };
    g.players[0]!.res[0] = 200;
    expect(put('poleturner')).toBe(true);
    const p0 = g.players[0]!, SPEAR = resIndex('spear');
    p0.res[resIndex('wood')] = 200; p0.res[resIndex('stone')] = 50; p0.res[SPEAR] = 0;
    const smith = (): (typeof g.units)[number] | undefined => g.units.find((u) => u.owner === 0 && u.carryRes === SPEAR);
    for (let i = 0; i < 3000 && !smith(); i++) step(g, []);
    expect(smith()).toBeTruthy();
    for (let i = 0; i < 300; i++) step(g, []);
    expect(p0.res[SPEAR]).toBe(0);            // nie ma gdzie odnieść
    expect(put('armory')).toBe(true);
    for (let i = 0; i < 1500 && !p0.res[SPEAR]; i++) step(g, []);
    expect(p0.res[SPEAR]).toBeGreaterThan(0);
    expect(storeUsed(p0, 'armory')).toBe(p0.res[SPEAR]! + p0.res[resIndex('bow')]!);
  });

  it('kowal bierze żelazo ze składu i odnosi miecze do zbrojowni', async () => {
    const { placeBuilding, canPlace } = await import('../src/sim/systems/placement');
    const { BUILDINGS, buildingIndex } = await import('../src/data/buildings');
    const { resIndex } = await import('../src/data/resources');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings[0]!;
    const put = (id: string): boolean => {
      for (let r = 4; r < 24; r++) for (let d = -r; d <= r; d++) if (canPlace(g, 0, buildingIndex(id), keep.x + d, keep.y + r) === null) return placeBuilding(g, 0, buildingIndex(id), keep.x + d, keep.y + r);
      return false;
    };
    // kuźnia normalnie wymaga kopalni pod górami; w teście zdejmujemy wymaganie na chwilę i dajemy żelazo do składu
    const def = BUILDINGS[buildingIndex('smithy')]! as { requires?: string };
    const req = def.requires; def.requires = undefined;
    const p0 = g.players[0]!, IRON = resIndex('iron'), SWORD = resIndex('sword');
    p0.res[resIndex('wood')] = 300; p0.res[resIndex('stone')] = 100; p0.res[IRON] = 20; p0.res[SWORD] = 0;
    try {
      expect(put('armory')).toBe(true);
      expect(put('smithy')).toBe(true);
    } finally { def.requires = req; }
    for (let i = 0; i < 4000 && !p0.res[SWORD]; i++) step(g, []);
    expect(p0.res[SWORD]).toBeGreaterThan(0);
    expect(p0.res[IRON]).toBeLessThan(20);
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

describe('chłop na chłopa', () => {
  it('odważny chłop okłada wrogiego chłopa stojącego obok', async () => {
    const { isBrave } = await import('../src/sim/systems/army');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const a = g.units.find((u) => u.owner === 0 && isBrave(u.id))!;
    const b = g.units.find((u) => u.owner === 1)!;
    // obaj na łące przed zamkiem gracza 0, tuż obok siebie
    b.px = a.px + 256; b.py = a.py; b.path = []; a.path = [];
    for (let i = 0; i < 120; i++) { step(g, []); b.px = a.px + 256; b.py = a.py; }
    const hurt = !g.units.includes(b) || (b.hp ?? 30) < 30;
    expect(hurt).toBe(true);
  });
});

describe('krata zamku', () => {
  it('wrogie wojsko pod bramą zamyka zamek, po odejściu brama znów się otwiera', async () => {
    const { KEEP_GATE } = await import('../src/data/keep');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings.find((b) => b.type === 0 && b.owner === 0)!;
    const gt = (keep.y + KEEP_GATE[1]) * g.map.width + keep.x + KEEP_GATE[0];
    step(g, []);
    for (let i = 0; i < 5; i++) step(g, []);
    expect(g.gates[gt]).toBe(1);
    const foe = g.soldiers.find((s) => s.owner === 1)!;
    foe.px = (keep.x + KEEP_GATE[0]) * 256 + 128; foe.py = (keep.y + KEEP_GATE[1] + 4) * 256 + 128; foe.path = []; foe.goal = -1;
    for (let i = 0; i < 5; i++) { step(g, []); foe.px = (keep.x + KEEP_GATE[0]) * 256 + 128; foe.py = (keep.y + KEEP_GATE[1] + 4) * 256 + 128; }
    expect(g.gates[gt]).toBe(0);
    expect(keep.shut).toBe(true);
    g.soldiers = g.soldiers.filter((s) => s !== foe);
    for (let i = 0; i < 6; i++) step(g, []);
    expect(g.gates[gt]).toBe(1);
  });
});

describe('taran', () => {
  it('taran podjeżdża pod wrogi zamek i bije w niego, a strzały prawie go nie ranią', async () => {
    const { unitIndex, UNITS } = await import('../src/data/units');
    const { hitDamage } = await import('../src/sim/systems/army');
    const g = createGame(5, '1v1', 0);
    for (const p of g.players) p.bot = false;
    const keep = g.buildings.find((b) => b.type === 0 && b.owner === 1)!;
    const R = unitIndex('ram');
    const ram = { id: g.nextId++, owner: 0, kind: R, px: (keep.x + 5) * 256 + 128, py: (keep.y + 15) * 256 + 128, path: [], hp: UNITS[R]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
    g.soldiers.push(ram);
    // obrońcy z dala, żeby nie rozbili tarana w teście
    g.soldiers = g.soldiers.filter((s) => s === ram || s.owner === 0);
    const hp0 = keep.hp;
    for (let i = 0; i < 1500 && keep.hp === hp0; i++) step(g, []);
    expect(keep.hp).toBeLessThan(hp0);
    const archer = { id: 1, owner: 1, kind: unitIndex('archer'), px: ram.px + 512, py: ram.py, path: [], hp: 40, goal: -1, wait: 0, target: 0, cd: 0 };
    const spear = { ...archer, kind: unitIndex('spearman') };
    expect(hitDamage(g, archer, ram, new Map(), true)).toBeLessThan(3);
    expect(hitDamage(g, spear, ram, new Map(), false)).toBeLessThan(UNITS[unitIndex('spearman')]!.attack);
  });
});

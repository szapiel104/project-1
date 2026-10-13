import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { deserialize, serialize } from '../src/sim/save';
import { FP, Phase, createGame as realGame, playerKeep, population, stateHash, type GameState, type Soldier } from '../src/sim/state';
import { arrowHits, hitDamage, planFormation } from '../src/sim/systems/army';
import { walkable } from '../src/sim/path';
import { unitIndex } from '../src/data/units';
import { step, type Command } from '../src/sim/step';
import { canPlace } from '../src/sim/systems/placement';

/** Testy gospodarki i wojska bez bota: drugi gracz stoi bezczynnie */
const createGame = (...a: Parameters<typeof realGame>): ReturnType<typeof realGame> => { const g = realGame(...a); for (const p of g.players) p.bot = false; return g; };

function spot(g: GameState, id: string): { x: number; y: number } {
  const keep = playerKeep(g, 0)!;
  const type = buildingIndex(id);
  for (let r = 3; r < RULES.buildRadius; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (canPlace(g, 0, type, keep.x + dx, keep.y + dy, false) === null) return { x: keep.x + dx, y: keep.y + dy };
  throw new Error('brak miejsca');
}

function withBarracks(): { g: GameState; id: number } {
  const g = createGame(7);
  const p = g.players[0]!;
  p.res[resIndex('wood')] = 500; p.res[resIndex('stone')] = 500; p.res[resIndex('spear')] = 5; p.res[resIndex('gold')] = 100;
  step(g, [{ type: 'build', player: 0, building: 'barracks', ...spot(g, 'barracks') }]);
  const b = g.buildings.find((x) => x.type === buildingIndex('barracks'))!;
  return { g, id: b.id };
}

describe('wojsko', () => {
  it('koszary zamieniają wolnego chłopa w żołnierza za włócznię i złoto', () => {
    const { g, id } = withBarracks();
    const pop = population(g, 0);
    const gold = g.players[0]!.res[resIndex('gold')]!;
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    expect(g.soldiers.length).toBe(1);
    expect(population(g, 0)).toBe(pop - 1);
    expect(g.players[0]!.res[resIndex('spear')]).toBe(4);
    expect(g.players[0]!.res[resIndex('gold')]).toBe(gold - 8);
  });

  it('bez włóczni nie ma szkolenia', () => {
    const { g, id } = withBarracks();
    g.players[0]!.res[resIndex('spear')] = 0;
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    expect(g.soldiers.length).toBe(0);
  });

  it('oddział idzie w szyku na wskazane miejsce i każdy staje na innym polu', () => {
    const { g, id } = withBarracks();
    const train: Command[] = [1, 2, 3].map(() => ({ type: 'train', player: 0, building: id, unit: 'spearman' }));
    step(g, train);
    const keep = playerKeep(g, 0)!;
    const tx = keep.x + 1, ty = keep.y + 8;
    step(g, [{ type: 'move', player: 0, ids: g.soldiers.map((s) => s.id), x: tx, y: ty }]);
    for (let i = 0; i < 800; i++) step(g, []);
    const tiles = g.soldiers.map((s) => (s.py >> 8) * g.map.width + (s.px >> 8));
    expect(new Set(tiles).size).toBe(tiles.length);
    for (const s of g.soldiers) expect(Math.abs((s.px >> 8) - tx) + Math.abs((s.py >> 8) - ty)).toBeLessThanOrEqual(3);
  });

  it('zapis pamięta żołnierzy', () => {
    const { g, id } = withBarracks();
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    const back = deserialize(serialize(g, '1v1'))!;
    expect(back.soldiers.length).toBe(1);
    expect(stateHash(back)).toBe(stateHash(g));
  });
});

describe('walka', () => {
  it('wrogowie stojący blisko walczą, aż jeden padnie', () => {
    const { g, id } = withBarracks();
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    for (let i = 0; i < 200; i++) step(g, []);
    const mine = g.soldiers[0]!;
    // wróg dostawiony dwa pola obok
    g.soldiers.push({ ...mine, id: g.nextId++, owner: 1, px: mine.px + 2 * 256, path: [], goal: -1, target: 0, cd: 0, hp: 30 });
    for (let i = 0; i < 400; i++) step(g, []);
    expect(g.soldiers.length).toBe(1);
    expect(g.soldiers[0]!.owner).toBe(0);
    expect(g.soldiers[0]!.hp).toBeLessThan(60);
  });
});

describe('oblężenie', () => {
  it('żołnierz burzy wrogi budynek, a zburzona twierdza wyklucza gracza', () => {
    const { g, id } = withBarracks();
    step(g, [{ type: 'train', player: 0, building: id, unit: 'spearman' }]);
    const enemyKeep = playerKeep(g, 1)!;
    enemyKeep.hp = 30;
    const s = g.soldiers[0]!;
    s.px = (enemyKeep.x + 1) * 256 + 128; s.py = (enemyKeep.y + 4) * 256 + 128; s.path = []; s.goal = -1;
    for (let i = 0; i < 400; i++) step(g, []);
    expect(playerKeep(g, 1)).toBeUndefined();
    expect(g.players[1]!.defeated).toBe(true);
  });

  it('inżynier naprawia uszkodzony budynek', () => {
    const { g } = withBarracks();
    step(g, [{ type: 'build', player: 0, building: 'engineers', ...spot(g, 'engineers') }]);
    const keep = playerKeep(g, 0)!;
    keep.hp = 1000;
    for (let i = 0; i < 3000; i++) step(g, []);
    expect(keep.hp).toBeGreaterThan(1000);
  });
});

describe('wydajność', () => {
  it('bitwa 200 na 200 liczy się szybko', () => {
    const { g } = withBarracks();
    const k = playerKeep(g, 0)!;
    for (let i = 0; i < 400; i++) {
      const owner = i < 200 ? 0 : 1;
      const x = k.x + 6 + (i % 20), y = k.y + 10 + Math.floor((i % 200) / 20) + (owner ? 14 : 0);
      g.soldiers.push({ id: g.nextId++, owner, kind: 0, px: x * 256 + 128, py: y * 256 + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 });
    }
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) step(g, []);
    const ms = (performance.now() - t0) / 300;
    expect(ms).toBeLessThan(20);
    expect(g.corpses.length).toBeGreaterThan(0);
  });
});

describe('szyk i postawy', () => {
  /** Otwarte pole 9×9 przy twierdzy, na którym można postawić oddział */
  function openField(g: GameState): number {
    const keep = playerKeep(g, 0)!, w = g.map.width;
    for (let r = 4; r < 40; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const cx = keep.x + dx, cy = keep.y + dy;
          let ok = true;
          for (let y = -4; y <= 4 && ok; y++) for (let x = -4; x <= 4 && ok; x++) ok = walkable(g, (cy + y) * w + cx + x);
          if (ok) return cy * w + cx;
        }
    throw new Error('brak pola');
  }
  function soldier(g: GameState, owner: number, kind: string, tile: number, extra: Partial<Soldier> = {}): Soldier {
    const w = g.map.width, x = tile % w, y = (tile - x) / w;
    const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 50, goal: -1, wait: 0, target: 0, cd: 0, ...extra };
    g.soldiers.push(s);
    return s;
  }

  it('linia: włócznicy w pierwszym szeregu, łucznicy za nimi, wszyscy na różnych polach', () => {
    const g = createGame(7);
    const c = openField(g), w = g.map.width;
    const spears = [0, 1, 2].map((i) => soldier(g, 0, 'spearman', c - 3 * w + i));
    const bows = [0, 1, 2].map((i) => soldier(g, 0, 'archer', c - 3 * w - 1 - i));
    const { spots, face } = planFormation(g, 0, [...spears, ...bows].map((s) => s.id), c, { face: 0, form: 0, width: 3 });
    expect(face).toBe(0);
    expect(new Set(spots.values()).size).toBe(6);
    const row = (s: Soldier): number => Math.floor(spots.get(s.id)! / w);
    // twarzą na +y: przód ma większe y
    for (const a of spears) for (const b of bows) expect(row(a)).toBeGreaterThan(row(b));
  });

  it('rozkaz marszu zapamiętuje kierunek i formację', () => {
    const g = createGame(7);
    const c = openField(g), w = g.map.width;
    const list = [0, 1, 2, 3].map((i) => soldier(g, 0, 'spearman', c - 2 * w + i - 2));
    step(g, [{ type: 'move', player: 0, ids: list.map((s) => s.id), x: c % w, y: Math.floor(c / w), face: 2, form: 1 }]);
    for (const s of g.soldiers) expect(s.face).toBe(2);
    for (let i = 0; i < 600; i++) step(g, []);
    const tiles = g.soldiers.map((s) => (s.py >> 8) * w + (s.px >> 8));
    expect(new Set(tiles).size).toBe(4);
  });

  it('postawa „stój”: nie idzie za wrogiem, którego nie sięgnie', () => {
    const g = createGame(7);
    const c = openField(g);
    const me = soldier(g, 0, 'spearman', c);
    soldier(g, 1, 'spearman', c + 4, { stance: 2 });
    step(g, [{ type: 'stance', player: 0, ids: [me.id], stance: 2 }]);
    for (let i = 0; i < 200; i++) step(g, []);
    expect((me.py >> 8) * g.map.width + (me.px >> 8)).toBe(c);
  });

  it('postawa „atak”: idzie na wroga w zasięgu wzroku', () => {
    const g = createGame(7);
    const c = openField(g);
    const me = soldier(g, 0, 'spearman', c);
    soldier(g, 1, 'spearman', c + 4, { stance: 2 });
    for (let i = 0; i < 200; i++) step(g, []);
    expect((me.px >> 8) - (c % g.map.width)).toBeGreaterThan(0);
  });

  it('atak w marszu: po drodze bije wroga, a potem idzie dalej na miejsce', () => {
    const g = createGame(7);
    const c = openField(g), w = g.map.width;
    const me = soldier(g, 0, 'spearman', c - 3);
    const foe = soldier(g, 1, 'spearman', c, { stance: 2, hp: 12 });
    step(g, [{ type: 'move', player: 0, ids: [me.id], x: (c % w) + 3, y: Math.floor(c / w), amove: true }]);
    for (let i = 0; i < 900; i++) step(g, []);
    expect(g.soldiers.some((s) => s.id === foe.id)).toBe(false);
    expect(me.amove).toBe(false);
    expect(Math.abs((me.px >> 8) - ((c % w) + 3))).toBeLessThanOrEqual(1);
  });

  it('oddział z łucznikami i włócznikami idzie wspólnym tempem', () => {
    const g = createGame(7);
    const c = openField(g), w = g.map.width;
    const a = soldier(g, 0, 'spearman', c - 2 * w), b = soldier(g, 0, 'archer', c - 2 * w + 1);
    step(g, [{ type: 'move', player: 0, ids: [a.id, b.id], x: c % w, y: Math.floor(c / w) + 3 }]);
    expect(a.pace).toBe(b.pace);
    expect(a.pace).toBeDefined();
  });
});

describe('drogi', () => {
  it('droga to najpierw plan: kosztuje od razu, a układa ją wolny chłop', () => {
    const g = createGame(7);
    const keep = playerKeep(g, 0)!, w = g.map.width;
    const p = g.players[0]!;
    p.res[resIndex('wood')] = 50;
    let x = keep.x + 4, y = keep.y + 5;
    for (let r = 4; r < 12 && !walkable(g, y * w + x); r++) { x = keep.x + r; y = keep.y + r; }
    const t = y * w + x;
    step(g, [{ type: 'build', player: 0, building: 'roadWood', x, y }]);
    expect(p.res[resIndex('wood')]).toBe(49);
    expect(g.roads[t]).toBe(0);
    expect(g.roadPlan[t]).toBe(3);
    // chłop najpierw idzie po drewno, potem niesie je na pole
    let carried = false;
    for (let i = 0; i < 3000 && !g.roads[t]; i++) { step(g, []); if (g.units.some((u) => u.phase === Phase.ToPave && u.carryRes === resIndex('wood'))) carried = true; }
    expect(carried).toBe(true);
    expect(g.roads[t]).toBe(3);
    expect(g.roadPlan[t]).toBe(0);
  });
});

describe('walka z charakterem', () => {
  const mk = (g: GameState, owner: number, kind: string, x: number, y: number, extra: Partial<Soldier> = {}): Soldier => {
    const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0, ...extra };
    g.soldiers.push(s);
    return s;
  };
  it('cios w plecy boli bardziej niż w twarz, z boku pośrodku', () => {
    const g = createGame(7);
    // obrońca patrzy na +y (face 0); atakujący z przodu (+y), z boku (+x) i z tyłu (−y)
    const foe = mk(g, 1, 'spearman', 50, 50, { face: 0 });
    const front = mk(g, 0, 'spearman', 50, 51), side = mk(g, 0, 'spearman', 51, 50), back = mk(g, 0, 'spearman', 50, 49);
    const byId = new Map(g.soldiers.map((x) => [x.id, x]));
    const f = hitDamage(g, front, foe, byId, false), sd = hitDamage(g, side, foe, byId, false), b = hitDamage(g, back, foe, byId, false);
    expect(sd).toBeGreaterThan(f);
    expect(b).toBeGreaterThan(sd);
  });
  it('tarcza łapie połowę strzały z przodu, z tyłu nie', () => {
    const g = createGame(7);
    const foe = mk(g, 1, 'spearman', 50, 50, { face: 0 });
    const fromFront = mk(g, 0, 'archer', 50, 54), fromBack = mk(g, 0, 'archer', 50, 46);
    const byId = new Map(g.soldiers.map((x) => [x.id, x]));
    expect(hitDamage(g, fromFront, foe, byId, true)).toBeLessThan(UNITS_ATTACK_ARCHER);
    expect(hitDamage(g, fromBack, foe, byId, true)).toBeGreaterThan(UNITS_ATTACK_ARCHER);
  });
  it('szarża po rozbiegu podwaja pierwszy cios włócznika', () => {
    const g = createGame(7);
    const foe = mk(g, 1, 'spearman', 50, 50, { face: 0 });
    const a = mk(g, 0, 'spearman', 50, 51), b = mk(g, 0, 'spearman', 50, 51, { run: 30 });
    const byId = new Map(g.soldiers.map((x) => [x.id, x]));
    expect(hitDamage(g, b, foe, byId, false)).toBe(hitDamage(g, a, foe, byId, false) * 2);
  });
  it('z daleka łucznik chybia częściej niż z bliska, z wieży trafia lepiej', () => {
    const g = createGame(7);
    const s = mk(g, 0, 'archer', 50, 50);
    const rate = (dist: number, up = false): number => { let n = 0; s.up = up; for (let t = 0; t < 2000; t++) { g.tick = t; if (arrowHits(g, s, dist * FP)) n++; } s.up = false; return n / 2000; };
    expect(rate(1)).toBeGreaterThan(rate(6));
    expect(rate(6, true)).toBeGreaterThan(rate(6));
  });
});
const UNITS_ATTACK_ARCHER = 7;

describe('wrodzy chłopi', () => {
  it('rozkaz ataku na chłopa: żołnierz go dopada, a chłop ucieka albo się słabo broni', () => {
    const g = createGame(7);
    for (const p of g.players) p.bot = false;
    const u = g.units.find((x) => x.owner === 1)!;
    const tx = u.px >> 8, ty = u.py >> 8;
    const s: Soldier = { id: g.nextId++, owner: 0, kind: unitIndex('spearman'), px: (tx + 12) * FP + 128, py: ty * FP + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 };
    g.soldiers.push(s);
    step(g, [{ type: 'attack', player: 0, ids: [s.id], target: u.id }]);
    expect(s.prey).toBe(u.id);
    let hurt = false;
    for (let i = 0; i < 2500 && g.units.some((x) => x.id === u.id); i++) { step(g, []); if ((g.units.find((x) => x.id === u.id)?.hp ?? 30) < 30) hurt = true; }
    expect(hurt || !g.units.some((x) => x.id === u.id)).toBe(true);
    // żołnierz przeżył: chłop bije słabo
    expect(s.hp).toBeGreaterThan(40);
  });
});

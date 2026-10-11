import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { Terrain } from '../src/data/terrain';
import { findPath, walkable } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { createGame, housing, playerKeep, population, stateHash, storeCapacity, storeUsed, type GameState } from '../src/sim/state';
import { step, type Command } from '../src/sim/step';
import { canPlace } from '../src/sim/systems/placement';

const run = (g: GameState, ticks: number, cmds: Command[] = []): void => {
  step(g, cmds);
  for (let i = 1; i < ticks; i++) step(g, []);
};

/** Pierwsze miejsce przy twierdzy, w którym da się postawić budynek. */
function spot(g: GameState, id: string, player = 0): { x: number; y: number } {
  const keep = playerKeep(g, player)!;
  const type = buildingIndex(id);
  for (let r = 3; r < RULES.buildRadius; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = keep.x + dx, y = keep.y + dy;
        if (canPlace(g, player, type, x, y, false) === null) return { x, y };
      }
  throw new Error(`brak miejsca na ${id}`);
}
const build = (g: GameState, id: string, player = 0): Command => ({ type: 'build', player, building: id, ...spot(g, id, player) });
const res = (g: GameState, id: Parameters<typeof resIndex>[0], player = 0): number => g.players[player]!.res[resIndex(id)]!;

describe('start gry', () => {
  it('każdy gracz ma twierdzę, chłopów i zasoby startowe', () => {
    const g = createGame(11, '2v2');
    expect(g.players.length).toBe(4);
    for (const p of g.players) {
      expect(playerKeep(g, p.id)).toBeDefined();
      expect(population(g, p.id)).toBe(RULES.startPeasants);
      expect(housing(g, p.id)).toBe(8);
      expect(res(g, 'wood', p.id)).toBe(RULES.startResources.wood);
    }
  });
});

describe('budowanie', () => {
  it('pobiera koszt i zajmuje pola', () => {
    const g = createGame(5);
    const c = build(g, 'house') as Extract<Command, { type: 'build' }>;
    step(g, [c]);
    expect(g.buildings.length).toBe(3);
    expect(res(g, 'wood')).toBe(RULES.startResources.wood! - 20);
    expect(g.occupancy[c.y * g.map.width + c.x]).toBeGreaterThan(0);
    expect(canPlace(g, 0, buildingIndex('house'), c.x, c.y)).toBe('place.occupied');
  });

  it('odrzuca budowę na cudzym terenie, na wodzie, bez surowców i cudzą twierdzę', () => {
    const g = createGame(5);
    const enemy = playerKeep(g, 1)!;
    const house = buildingIndex('house');
    expect(canPlace(g, 0, house, enemy.x + 4, enemy.y)).toBe('place.far');
    expect(canPlace(g, 0, house, 0, 0)).toBe('place.terrain'); // góry na krańcu mapy
    expect(canPlace(g, 0, buildingIndex('keep'), 20, 20)).toBe('place.unknown');
    g.players[0]!.res[resIndex('wood')] = 5;
    const s = spot(g, 'house');
    expect(canPlace(g, 0, house, s.x, s.y)).toBe('place.cost');
    const before = stateHash(g);
    step(g, [{ type: 'build', player: 0, building: 'house', ...s }, { type: 'build', player: 7, building: 'house', ...s }]);
    expect(g.buildings.length).toBe(2);
    expect(before).not.toBe(stateHash(g)); // tick poszedł dalej, ale nic nie zbudowano
  });

  it('rozbiórka zwraca połowę kosztu i zwalnia pracownika; cudzego budynku nie da się rozebrać', () => {
    const g = createGame(5);
    run(g, 5, [build(g, 'woodcutter')]);
    const b = g.buildings.find((x) => BUILDINGS[x.type]!.id === 'woodcutter')!;
    expect(b.worker).toBeGreaterThan(0);
    step(g, [{ type: 'demolish', player: 1, id: b.id }]);
    expect(g.buildings.includes(b)).toBe(true);
    const wood = res(g, 'wood');
    step(g, [{ type: 'demolish', player: 0, id: b.id }]);
    expect(g.buildings.includes(b)).toBe(false);
    expect(res(g, 'wood')).toBe(wood + 5);
    expect(g.units.every((u) => u.job === 0)).toBe(true);
    step(g, [{ type: 'demolish', player: 0, id: playerKeep(g, 0)!.id }]);
    expect(playerKeep(g, 0)).toBeDefined();
  });
});

describe('praca chłopów', () => {
  it('drwal przynosi drewno', () => {
    const g = createGame(5);
    run(g, 1, [build(g, 'woodcutter')]);
    const wood = res(g, 'wood');
    run(g, 1500);
    expect(res(g, 'wood')).toBeGreaterThan(wood);
  });

  it('łańcuch farma → młyn → piekarnia daje chleb', () => {
    const g = createGame(5);
    g.players[0]!.res[resIndex('apples')] = 110; // zapas, żeby głód nie przerwał testu (mieści się w spichlerzu twierdzy)
    step(g, [build(g, 'farm')]);
    step(g, [build(g, 'mill')]);
    step(g, [build(g, 'bakery')]);
    let baked = 0; // chleb jest od razu zjadany, więc patrzymy, czy w ogóle się pojawił
    for (let i = 0; i < 4000; i++) { step(g, []); baked = Math.max(baked, res(g, 'bread')); }
    expect(baked).toBeGreaterThan(0);
    expect(g.buildings.filter((b) => b.owner === 0 && b.worker).length).toBe(3);
  });

  it('chłopi nie wchodzą na wodę, góry ani w budynki', () => {
    const g = createGame(31);
    for (const id of ['woodcutter', 'orchard', 'house', 'stockpile']) step(g, [build(g, id)]);
    for (let i = 0; i < 1200; i++) {
      step(g, []);
      for (const u of g.units) {
        const tile = (u.py >> 8) * g.map.width + (u.px >> 8);
        const terrain = g.map.tiles[tile] as Terrain;
        expect(terrain === Terrain.Water || terrain === Terrain.Mountain).toBe(false);
        if (u.path.length) expect(walkable(g, u.path[u.path.length - 1]!)).toBe(true);
      }
    }
  });

  it('wyszukiwanie drogi omija budynki i zwraca null, gdy celu nie ma', () => {
    const g = createGame(5);
    const keep = playerKeep(g, 0)!;
    const w = g.map.width;
    const from = (keep.y + 1) * w + keep.x - 2, to = (keep.y + 1) * w + keep.x + 5;
    const path = findPath(g, from, (t) => t === to)!;
    expect(path.length).toBeGreaterThan(6);
    for (const t of path) expect(g.occupancy[t]).toBe(0);
    expect(findPath(g, from, () => false, 200)).toBeNull();
  });
});

describe('pojemność składów', () => {
  it('pełny skład nie przyjmuje surowców, a nowy skład zwiększa pojemność', () => {
    const g = createGame(5);
    const p = g.players[0]!;
    const cap = storeCapacity(g, 0, 'stockpile');
    expect(cap).toBe(250);
    step(g, [build(g, 'woodcutter')]);
    p.res[resIndex('wood')] = cap - storeUsed(p, 'stockpile') + p.res[resIndex('wood')]! - 3; // zostają 3 wolne miejsca
    run(g, 1500);
    expect(storeUsed(p, 'stockpile')).toBe(cap);
    expect(g.units.some((u) => u.carryAmt > 0)).toBe(true); // drwal czeka z resztą drewna
    run(g, 1500, [build(g, 'stockpile')]);
    expect(storeCapacity(g, 0, 'stockpile')).toBe(450);
    expect(storeUsed(p, 'stockpile')).toBeGreaterThan(cap);
  });

  it('spichlerz ma osobny limit na żywność', () => {
    const g = createGame(5);
    expect(storeCapacity(g, 0, 'granary')).toBe(120);
    step(g, [build(g, 'granary')]);
    expect(storeCapacity(g, 0, 'granary')).toBe(270);
  });
});

describe('ludność i popularność', () => {
  it('nowa chata przyciąga mieszkańców', () => {
    const g = createGame(5);
    run(g, 200);
    expect(population(g, 0)).toBe(8);
    run(g, 300, [build(g, 'house')]);
    expect(population(g, 0)).toBeGreaterThan(8);
    expect(population(g, 0)).toBeLessThanOrEqual(16);
  });

  it('racje zjadają żywność, a głód obniża popularność i wypędza ludzi', () => {
    const g = createGame(5);
    const apples = res(g, 'apples');
    run(g, RULES.monthTicks);
    expect(res(g, 'apples')).toBeLessThan(apples);
    g.players[0]!.res[resIndex('apples')] = 0;
    run(g, RULES.monthTicks * 6);
    expect(g.players[0]!.popularity).toBeLessThan(50);
    expect(population(g, 0)).toBeLessThan(6);
    run(g, RULES.monthTicks * 30);
    expect(population(g, 0)).toBe(RULES.minPeasants); // garstka zawsze zostaje
    g.units.length = 0; // nawet całkiem pusta osada (np. ze starego zapisu) sama się odradza
    run(g, RULES.migrationTicks * 6);
    expect(population(g, 0)).toBe(RULES.minPeasants);
  });

  it('podatki dają złoto kosztem popularności; błędne poziomy są ignorowane', () => {
    const g = createGame(5);
    const gold = res(g, 'gold');
    run(g, RULES.monthTicks, [{ type: 'setTax', player: 0, level: 4 }, { type: 'setRations', player: 0, level: 99 }]);
    expect(res(g, 'gold')).toBeGreaterThan(gold);
    expect(g.players[0]!.popDelta).toBeLessThan(0);
    expect(g.players[0]!.rations).toBe(RULES.defaultRations);
  });
});

describe('odpoczynek', () => {
  it('po kilku dostawach chłop idzie do chaty, siedzi tam i wraca do pracy', () => {
    const g = createGame(5);
    step(g, [build(g, 'orchard')]);
    step(g, [build(g, 'house')]);
    const house = g.buildings.find((b) => BUILDINGS[b.type]!.id === 'house')!;
    let rested = 0, backToWork = false;
    for (let i = 0; i < 4000; i++) {
      step(g, []);
      const resting = g.units.some((u) => u.home === house.id);
      if (resting) rested++;
      else if (rested && g.units.some((u) => u.job && u.phase === 4)) backToWork = true;
    }
    expect(rested).toBeGreaterThanOrEqual(RULES.restTicks);
    expect(backToWork).toBe(true);
  });

  it('bez chaty nikt nie odpoczywa, a rozbiórka chaty wygania odpoczywających', () => {
    const g = createGame(5);
    step(g, [build(g, 'orchard')]);
    run(g, 2500);
    expect(g.units.every((u) => u.home === 0 && u.phase !== 8 && u.phase !== 9)).toBe(true);
    step(g, [build(g, 'house')]);
    const house = g.buildings.find((b) => BUILDINGS[b.type]!.id === 'house')!;
    for (let i = 0; i < 4000 && !g.units.some((u) => u.home === house.id); i++) step(g, []);
    expect(g.units.some((u) => u.home === house.id)).toBe(true);
    step(g, [{ type: 'demolish', player: 0, id: house.id }]);
    expect(g.units.every((u) => u.home === 0)).toBe(true);
  });
});

describe('zapis gry', () => {
  it('wczytana gra ma ten sam skrót i dalej toczy się identycznie jak niezapisana', () => {
    const a = createGame(77);
    run(a, 3, [build(a, 'woodcutter')]);
    run(a, 700, [build(a, 'orchard')]);
    const b = deserialize(JSON.parse(JSON.stringify(serialize(a, '1v1'))))!;
    expect(stateHash(b)).toBe(stateHash(a));
    run(a, 2000); run(b, 2000);
    expect(stateHash(b)).toBe(stateHash(a));
    expect(canPlace(b, 0, buildingIndex('house'), playerKeep(b, 0)!.x, playerKeep(b, 0)!.y)).toBe('place.occupied');
  });

  it('zapis z innej wersji jest odrzucany', () => {
    const d = serialize(createGame(1), '1v1');
    expect(deserialize({ ...d, v: 0 })).toBeNull();
    expect(deserialize({ ...d, shape: 'x' })).toBeNull();
  });
});

describe('determinizm gospodarki', () => {
  it('ten sam scenariusz daje ten sam skrót stanu po 10 000 ticków', () => {
    const play = (): number => {
      const g = createGame(2026, '2v2');
      for (let i = 0; i < 10_000; i++) {
        const cmds: Command[] = [];
        if (i === 3) cmds.push(build(g, 'woodcutter', 0), build(g, 'orchard', 1));
        if (i === 40) cmds.push(build(g, 'house', 0), build(g, 'woodcutter', 2));
        if (i === 400) cmds.push(build(g, 'orchard', 0), { type: 'setTax', player: 1, level: 3 });
        if (i === 900) cmds.push(build(g, 'stockpile', 0), build(g, 'farm', 3), { type: 'setRations', player: 0, level: 3 });
        step(g, cmds);
      }
      return stateHash(g);
    };
    expect(play()).toBe(play());
  });
});

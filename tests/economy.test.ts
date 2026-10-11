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
    expect(g.buildings.filter((b) => b.owner === 0).length).toBe(4);
    expect(res(g, 'wood')).toBe(RULES.startResources.wood! - 20);
    expect(g.occupancy[c.y * g.map.width + c.x]).toBeGreaterThan(0);
    expect(canPlace(g, 0, buildingIndex('house'), c.x, c.y)).toBe('place.occupied');
  });

  it('odrzuca budowę na cudzym terenie, na wodzie, bez surowców i cudzą twierdzę', () => {
    const g = createGame(5);
    const enemy = playerKeep(g, 1)!;
    const house = buildingIndex('house');
    let far = false; // gdzieś przy wrogiej twierdzy jest wolna łąka, ale to za daleko od własnej
    for (let d = 4; d < 12 && !far; d++) far = canPlace(g, 0, house, enemy.x - d, enemy.y - d) === 'place.far';
    expect(far).toBe(true);
    expect(canPlace(g, 0, house, 0, 0)).toBe('place.terrain'); // góry na krańcu mapy
    expect(canPlace(g, 0, buildingIndex('keep'), 20, 20)).toBe('place.unknown');
    g.players[0]!.res[resIndex('wood')] = 5;
    const s = spot(g, 'house');
    expect(canPlace(g, 0, house, s.x, s.y)).toBe('place.cost');
    const before = stateHash(g);
    step(g, [{ type: 'build', player: 0, building: 'house', ...s }, { type: 'build', player: 7, building: 'house', ...s }]);
    expect(g.buildings.filter((b) => b.owner === 0).length).toBe(3);
    expect(before).not.toBe(stateHash(g)); // tick poszedł dalej, ale nic nie zbudowano
  });

  it('nie pozwala zamurować ludzi: budynek w jedynym przejściu jest odrzucany', () => {
    const g = createGame(5);
    const keep = playerKeep(g, 0)!;
    const w = g.map.width, cx = keep.x + 1, cy = keep.y + 1;
    // sztuczny mur dookoła twierdzy z jednym przejściem szerokości chaty
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 5 && !(dy === 5 && (dx === 0 || dx === 1))) g.occupancy[(cy + dy) * w + cx + dx] = 9999;
    const house = buildingIndex('house');
    expect(canPlace(g, 0, house, cx, cy + 5)).toBe('place.blocks'); // zatkałby przejście
    expect(canPlace(g, 0, house, cx - 4, cy + 2)).toBeNull(); // w środku jest miejsce i nic nie odcina
    step(g, [{ type: 'build', player: 0, building: 'house', x: cx, y: cy + 5 }]);
    expect(g.buildings.filter((b) => b.owner === 0).length).toBe(3); // komenda też została odrzucona
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

  it('ścięty las zamienia się w polanę, na której można budować, i zostaje w zapisie', () => {
    const g = createGame(5);
    const forestBefore = g.map.tiles.filter((t) => t === Terrain.Forest).length;
    run(g, 2500, [build(g, 'woodcutter')]);
    expect(g.cut.length).toBeGreaterThan(0);
    expect(g.map.tiles.filter((t) => t === Terrain.Forest).length).toBe(forestBefore - g.cut.length);
    for (const t of g.cut) expect(g.map.tiles[t]).toBe(Terrain.Grass);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(stateHash(loaded)).toBe(stateHash(g));
  });

  it('złoże kamienia wyczerpuje się po kilku wydobyciach', () => {
    const g = createGame(5);
    const stoneBefore = g.map.tiles.filter((t) => t === Terrain.Stone).length;
    expect(stoneBefore).toBeGreaterThan(0);
    run(g, 9000, [build(g, 'quarry')]);
    expect(res(g, 'stone')).toBeGreaterThan(RULES.startResources.stone!);
    expect(g.map.tiles.filter((t) => t === Terrain.Stone).length).toBeLessThan(stoneBefore);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(stateHash(loaded)).toBe(stateHash(g));
  });

  it('rybak łowi na brzegu i przynosi ryby', () => {
    // szukamy mapy, na której przy twierdzy jest woda
    for (let seed = 1; seed < 200; seed++) {
      const g = createGame(seed);
      const keep = playerKeep(g, 0)!;
      const type = buildingIndex('fisher');
      let spotFound: { x: number; y: number } | null = null;
      for (let r = 3; r < RULES.buildRadius && !spotFound; r++)
        for (let dy = -r; dy <= r && !spotFound; dy++)
          for (let dx = -r; dx <= r; dx++) if (canPlace(g, 0, type, keep.x + dx, keep.y + dy) === null) { spotFound = { x: keep.x + dx, y: keep.y + dy }; break; }
      if (!spotFound) continue;
      step(g, [{ type: 'build', player: 0, building: 'fisher', ...spotFound }]);
      let caught = 0;
      for (let i = 0; i < 3000; i++) {
        step(g, []);
        caught = Math.max(caught, res(g, 'fish'));
        for (const u of g.units) expect(g.map.tiles[(u.py >> 8) * g.map.width + (u.px >> 8)]).not.toBe(Terrain.Water);
      }
      expect(caught).toBeGreaterThan(0);
      return;
    }
    throw new Error('brak mapy z wodą przy twierdzy');
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
    // rozbiórka stodoły zabiera jej pojemność: zapasy trzeba mieć gdzie trzymać
    step(g, [{ type: 'demolish', player: 0, id: g.buildings.find((b) => b.owner === 0 && BUILDINGS[b.type]!.id === 'barn')!.id }]);
    expect(storeCapacity(g, 0, 'granary')).toBe(0);
    step(g, [build(g, 'barn')]);
    step(g, [build(g, 'granary')]);
    expect(storeCapacity(g, 0, 'granary')).toBe(270);
  });
});

describe('ludność i popularność', () => {
  it('ludzie przychodzą, gdy jest dach i wolne miejsce w obozowisku', () => {
    const g = createGame(5);
    run(g, 300);
    expect(population(g, 0)).toBe(6); // obozowisko pełne bezrobotnych: nikt nowy nie przyjdzie
    step(g, [build(g, 'woodcutter')]);
    run(g, 300, [build(g, 'orchard')]);
    expect(population(g, 0)).toBe(8); // dwóch dostało pracę, więc dwóch doszło (do limitu miejsc w twierdzy)
    step(g, [build(g, 'house')]);
    run(g, 400, [build(g, 'camp')]);
    expect(population(g, 0)).toBeGreaterThan(8); // nowa chata i drugie obozowisko
    expect(population(g, 0)).toBeLessThanOrEqual(16);
  });

  it('racje zjadają żywność, a głód obniża popularność i wypędza ludzi', () => {
    const g = createGame(5);
    const apples = res(g, 'apples');
    run(g, RULES.monthTicks);
    expect(res(g, 'apples')).toBeLessThan(apples);
    g.players[0]!.res[resIndex('apples')] = 0;
    run(g, RULES.monthTicks * 8);
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

describe('drogi', () => {
  it('droga kosztuje kamień, nie blokuje przejścia i znika pod budynkiem', () => {
    const g = createGame(5);
    const s = spot(g, 'house');
    const stone = res(g, 'stone');
    step(g, [{ type: 'build', player: 0, building: 'roadStone', x: s.x, y: s.y }, { type: 'build', player: 0, building: 'roadSand', x: s.x + 1, y: s.y }]);
    const w = g.map.width;
    expect(g.roads[s.y * w + s.x]).toBe(2);
    expect(g.roads[s.y * w + s.x + 1]).toBe(1);
    expect(res(g, 'stone')).toBe(stone - 1);
    expect(g.occupancy[s.y * w + s.x]).toBe(0);
    expect(walkable(g, s.y * w + s.x)).toBe(true);
    expect(canPlace(g, 0, buildingIndex('roadStone'), 0, 0)).toBe('place.terrain');
    step(g, [{ type: 'build', player: 0, building: 'house', ...s }]);
    expect(g.roads[s.y * w + s.x]).toBe(0);
  });

  it('po drodze idzie się szybciej, a zapis ją pamięta', () => {
    const walk = (road: boolean): number => {
      const g = createGame(5);
      const keep = playerKeep(g, 0)!;
      const w = g.map.width;
      const u = g.units[0]!;
      const y = keep.y + 5;
      if (road) for (let x = keep.x - 6; x <= keep.x + 8; x++) g.roads[y * w + x] = 2;
      u.px = (keep.x - 6) * 256 + 128; u.py = y * 256 + 128;
      u.path = []; for (let x = keep.x - 5; x <= keep.x + 8; x++) u.path.push(y * w + x);
      u.phase = 0;
      let n = 0;
      while (u.path.length && n < 2000) { step(g, []); n++; }
      if (road) expect(stateHash(deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!)).toBe(stateHash(g));
      return n;
    };
    expect(walk(true)).toBeLessThan(walk(false) * 0.75);
  });
});

describe('pochodnie', () => {
  it('o zmierzchu ludzie zapalają pochodnie przy budynkach, a o świcie gasną', () => {
    const g = createGame(5);
    expect(g.buildings.some((b) => b.lit)).toBe(false);
    run(g, 1700); // start o 8:00, noc zaczyna się 20:30, czyli po 1250 tickach
    const mine = g.buildings.filter((b) => b.owner === 0);
    expect(mine.every((b) => b.lit)).toBe(true);
    expect(g.units.every((u) => u.target === 0)).toBe(true);
    run(g, 900); // po świcie
    expect(g.buildings.some((b) => b.lit)).toBe(false);
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

describe('balans żywności', () => {
  it('dwa sady i chata utrzymują osadę bez głodu przez pół godziny gry', () => {
    const g = createGame(5);
    step(g, [build(g, 'orchard')]);
    step(g, [build(g, 'orchard')]);
    step(g, [build(g, 'woodcutter')]);
    step(g, [build(g, 'house')]);
    let hungryMonths = 0;
    for (let i = 0; i < 18_000; i++) {
      step(g, []);
      if (g.tick % RULES.monthTicks === 0 && g.players[0]!.popDelta < 0) hungryMonths++;
    }
    expect(hungryMonths).toBe(0);
    expect(population(g, 0)).toBe(9); // trzech pracujących i pełne obozowisko
  });

  it('gdy żywności jest za mało na wybrane racje, ludzie jedzą mniejsze zamiast głodować całkiem', () => {
    const g = createGame(5);
    g.players[0]!.res[resIndex('apples')] = 2; // starczy na połowę racji dla 6 osób
    run(g, RULES.monthTicks);
    expect(g.players[0]!.popDelta).toBe(RULES.rations[1].effect + RULES.taxes[RULES.defaultTax].effect);
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

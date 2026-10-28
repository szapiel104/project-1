import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { BANDITS, BANDIT_KIND, UNITS, unitIndex } from '../src/data/units';
import { clockAt } from '../src/sim/clock';
import { denAway, generateMap } from '../src/sim/map';
import { deserialize, serialize } from '../src/sim/save';
import { createGame, FP, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { DEN_CREW } from '../src/sim/systems/bandits';

const camps = (g: GameState) => g.buildings.filter((b) => BUILDINGS[b.type]!.id === 'banditCamp');
const bandits = (g: GameState) => g.soldiers.filter((s) => s.owner === BANDITS);
const until = (g: GameState, day: number, hour: number): void => { while (!(clockAt(g.tick).day >= day && clockAt(g.tick).hour >= hour)) step(g, []); };

describe('zbóje z obozów w puszczy', () => {
  it('nowa mapa ma polany pod obozy (symetrycznie), a gra stawia na nich obozy z załogą — w grze pokojowej nie', () => {
    const m = generateMap(7, '1v1');
    expect(m.dens?.length).toBe(2);
    expect(m.dens![1]).toBe(m.width * m.height - 1 - m.dens![0]!);
    expect(generateMap(7, '1v1', 4).dens).toBeUndefined(); // stare zapisy: ta sama mapa co przedtem
    const g = createGame(7, '1v1', 2);
    expect(camps(g).length).toBe(2);
    expect(bandits(g).length).toBe(2 * DEN_CREW);
    expect(bandits(g).every((s) => s.kind === BANDIT_KIND && camps(g).some((c) => c.id === s.den))).toBe(true);
    expect(camps(createGame(7, '1v1', 0)).length).toBe(0);
  });

  it('obozy stoją na uboczu mapy: przy krańcu, daleko od każdego zamku (generator 7)', () => {
    for (const p of ['1v1', '2v2', '4v4'] as const) for (const seed of [1, 7, 42, 99, 1234]) {
      const m = generateMap(seed, p);
      expect(m.dens?.length).toBeGreaterThan(0);
      for (const d of m.dens!) {
        const x = d % m.width, y = (d - x) / m.width;
        for (const s of m.starts) expect(Math.hypot(x - s.x, y - s.y)).toBeGreaterThanOrEqual(denAway(m.width, m.height));
        expect(Math.min(x, y, m.width - 1 - x, m.height - 1 - y)).toBeLessThanOrEqual(40);
      }
    }
  });

  it('napad: zbóje gonią samotnego chłopa w lesie, zabijają go i zabierają panu rudę i drewno do obozu', () => {
    const g = createGame(7, '1v1', 2);
    for (const p of g.players) { p.bot = false; p.guards = 0; }
    g.soldiers = g.soldiers.filter((s) => s.owner === BANDITS);
    until(g, 2, 8.6);
    const camp = camps(g).find((c) => c.x < 96)!;
    const u = g.units.find((x) => x.owner === 0)!;
    u.job = g.buildings.find((b) => b.owner === 0 && BUILDINGS[b.type]!.id === 'barn')!.id;
    // chłop stoi kilka pól przed obozem (jakby ścinał drzewa daleko od zamku)
    u.px = (camp.x + 1) * FP + FP / 2; u.py = (camp.y + 7) * FP + FP / 2; u.path = [];
    const p = g.players[0]!, gold = resIndex('gold'), gold0 = p.res[gold]!, hold0 = camp.hold![gold]!;
    let raided = false;
    for (let i = 0; i < 1500 && g.units.includes(u); i++) { step(g, []); raided ||= bandits(g).some((s) => s.raid); u.px = (camp.x + 1) * FP + FP / 2; u.py = (camp.y + 7) * FP + FP / 2; u.path = []; }
    expect(raided).toBe(true);
    expect(g.units.includes(u)).toBe(false);
    expect(p.bandit?.kills).toBe(1);
    expect(p.res[gold]).toBeLessThan(gold0);
    expect(camp.hold![gold]).toBeGreaterThan(hold0);
    // po napadzie wracają do ogniska
    for (let i = 0; i < 400; i++) step(g, []);
    expect(bandits(g).filter((s) => s.den === camp.id).every((s) => !s.raid)).toBe(true);
  });

  it('rozbity obóz oddaje łup temu, kto go rozbił; ocalali zbóje uciekają, obóz znika', () => {
    const g = createGame(7, '1v1', 2);
    for (const p of g.players) p.bot = false;
    const camp = camps(g).find((c) => c.x < 96)!;
    const spear = unitIndex('spearman'), W = g.map.width;
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) {
      const id = g.nextId++;
      ids.push(id);
      g.soldiers.push({ id, owner: 0, kind: spear, px: (camp.x - 1 + (i % 6)) * FP + FP / 2, py: (camp.y + 4 + Math.floor(i / 6)) * FP + FP / 2, path: [], hp: UNITS[spear]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
    }
    const p = g.players[0]!, gold = resIndex('gold'), before = p.res[gold]!;
    step(g, [{ type: 'attack', player: 0, ids, target: camp.id }]);
    for (let i = 0; i < 4000 && g.buildings.includes(camp); i++) step(g, []);
    expect(g.buildings.includes(camp)).toBe(false);
    expect(g.occupancy[(camp.y + 1) * W + camp.x + 1]).toBe(0);
    expect(p.bandit?.razed).toBe(1);
    expect(p.res[gold]! - before).toBeGreaterThanOrEqual(35);
    expect(bandits(g).some((s) => s.den === camp.id)).toBe(false);
  });

  it('zapis z obozami i zbójami wczytuje się bez zmian', () => {
    const g = createGame(7, '1v1', 2);
    for (let i = 0; i < 200; i++) step(g, []);
    const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(back).not.toBeNull();
    expect(stateHash(back)).toBe(stateHash(g));
    expect(camps(back).length).toBe(2);
  });
});

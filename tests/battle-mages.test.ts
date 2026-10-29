import { describe, expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { MAGE_CAP, UNITS, unitIndex } from '../src/data/units';
import { createGame, FP, playerKeep, population, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { spawnPeasant } from '../src/sim/systems/population';
import { battleMages, train } from '../src/sim/systems/army';

/** Pusta łąka: siedziby obu zakonów i koszary gracza 0, ludzie i ruda */
function field(): { g: GameState; fire: number; water: number; barracks: number; door: [number, number] } {
  const g = createGame(9);
  emptyScene(g);
  const k = playerKeep(g, 0)!, w = g.map.width, dx = k.door % w, dy = (k.door - dx) / w;
  const fire = placeReady(g, 'mageFire', dx - 8, dy + 6)!, water = placeReady(g, 'mageWater', dx + 2, dy + 6)!, barracks = placeReady(g, 'barracks', dx - 2, dy + 13)!;
  expect(fire && water && barracks).toBeTruthy();
  while (population(g, 0) < 40) spawnPeasant(g, 0);
  g.players[0]!.res[resIndex('gold')] = 5000;
  return { g, fire, water, barracks, door: [dx, dy] };
}
const soldier = (g: GameState, owner: number, kind: string, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNITS[unitIndex(kind)]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};

describe('magowie bojowi', () => {
  it('szkolą się tylko w siedzibie swojego zakonu, najwyżej 10 na gracza', () => {
    const { g, fire, water, barracks } = field();
    expect(train(g, 0, barracks, 'mageFire')).toBe(false);
    expect(train(g, 0, water, 'mageFire')).toBe(false);
    for (let i = 0; i < 6; i++) expect(train(g, 0, fire, 'mageFire')).toBe(true);
    for (let i = 0; i < 4; i++) expect(train(g, 0, water, 'mageWater')).toBe(true);
    expect(battleMages(g, 0)).toBe(MAGE_CAP);
    expect(train(g, 0, water, 'mageWater')).toBe(false);
    for (let i = 0; i < 1500 && g.soldiers.filter((s) => s.owner === 0 && UNITS[s.kind]!.magic).length < MAGE_CAP; i++) step(g, []);
    expect(g.soldiers.filter((s) => s.owner === 0 && UNITS[s.kind]!.magic).length).toBe(MAGE_CAP);
    expect(train(g, 0, fire, 'mageFire')).toBe(false);
    // rekruci nie zostali uzdrowicielami siedziby
    for (const b of g.buildings) if (b.id === fire || b.id === water) expect(b.worker).not.toBe(0);
  });

  it('kula ognia nie chybia i parzy też stojących obok celu', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageFire', x, y + 20);
    const a = soldier(g, 1, 'spearman', x, y + 26), b = soldier(g, 1, 'spearman', x + 1, y + 26);
    a.stance = 2; b.stance = 2; m.stance = 2;
    for (let i = 0; i < 45; i++) step(g, []);
    expect(Math.min(a.hp, b.hp)).toBeLessThan(UNITS[unitIndex('spearman')]!.hp);
    expect(a.hp < 60 && b.hp < 60).toBe(true);
  });

  it('czar wody spowalnia i odrzuca trafionego', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageWater', x, y + 20);
    const a = soldier(g, 1, 'manatarms', x, y + 25);
    m.stance = 2; a.stance = 2;
    const y0 = a.py;
    // mag chwilę mierzy, potem kula leci kilka ticków — skutek przychodzi, gdy doleci
    for (let i = 0; i < 16 && !(a.slow && a.slow > g.tick); i++) step(g, []);
    expect(a.slow ?? 0).toBeGreaterThan(g.tick);
    expect(a.py).toBeGreaterThan(y0);
  });

  it('mag Źródła gasi własny płonący budynek', () => {
    const { g, fire } = field();
    const b = g.buildings.find((o) => o.id === fire)!;
    const w = g.map.width, d = b.door;
    soldier(g, 0, 'mageWater', d % w, Math.floor(d / w) + 2);
    b.fire = 600;
    for (let i = 0; i < 40; i++) step(g, []);
    expect(b.fire ?? 0).toBeLessThan(600 - 40 - 100);
  });
});

describe('wielki czar magów', () => {
  const pack = (g: GameState, x: number, y: number): Soldier[] => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => { const s = soldier(g, 1, 'spearman', x + a!, y + b!); s.stance = 2; return s; });

  it('deszcz ognia: przy kupie wrogów rani i podpala wszystkich w kręgu, potem długie odliczanie', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageFire', x, y + 20); m.stance = 2;
    const foes = pack(g, x, y + 25);
    for (let i = 0; i < 25 && m.greatShot === undefined; i++) step(g, []);
    expect(m.greatShot).toBeDefined();
    expect((m.great ?? 0) - g.tick).toBeGreaterThan(200);
    for (let i = 0; i < 12; i++) step(g, []);
    for (const f of foes) expect(f.hp).toBeLessThan(UNITS[unitIndex('spearman')]!.hp);
    expect(foes.filter((f) => f.burn || f.hp <= 0).length).toBeGreaterThanOrEqual(3);
  });

  it('lodowy krąg: spowalnia wszystkich w kręgu; pojedynczego wroga mag bije zwykłym czarem', () => {
    const { g, door } = field();
    const [x, y] = door;
    const m = soldier(g, 0, 'mageWater', x, y + 20); m.stance = 2;
    const foes = pack(g, x, y + 25);
    for (let i = 0; i < 25 && m.greatShot === undefined; i++) step(g, []);
    for (let i = 0; i < 12; i++) step(g, []);
    expect(foes.filter((f) => (f.slow ?? 0) > g.tick + 80).length).toBeGreaterThanOrEqual(3);
    const { g: g2, door: d2 } = field();
    const m2 = soldier(g2, 0, 'mageWater', d2[0], d2[1] + 20); m2.stance = 2;
    const one = soldier(g2, 1, 'spearman', d2[0], d2[1] + 25); one.stance = 2;
    for (let i = 0; i < 40; i++) step(g2, []);
    expect(m2.greatShot).toBeUndefined();
    expect(one.hp).toBeLessThan(UNITS[unitIndex('spearman')]!.hp);
  });
});

describe('magowie bez rozkazu', () => {
  it('magowie wroga pod zamkiem, gdy nie ma już kogo bić, biorą się za budynki (nie stoją bezczynnie)', () => {
    const g = createGame(5);
    for (const p of g.players) p.bot = !!p.id;
    for (let i = 0; i < 100; i++) step(g, []);
    const k = playerKeep(g, 0)!, W = g.map.width, dx = k.door % W, dy = (k.door - dx) / W + 9;
    const mages: Soldier[] = [0, 1, 2].map((i) => {
      const kind = unitIndex(i % 2 ? 'mageFire' : 'mageWater');
      const s: Soldier = { id: g.nextId++, owner: 1, kind, px: (dx + i - 1) * FP + 128, py: dy * FP + 128, path: [], hp: UNITS[kind]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
      g.soldiers.push(s);
      return s;
    });
    let busy = 0;
    for (let t = 0; t < 900; t++) { step(g, []); if (t > 600) busy += mages.filter((m) => g.soldiers.includes(m) && m.target).length; }
    expect(busy).toBeGreaterThan(0);
  });
});

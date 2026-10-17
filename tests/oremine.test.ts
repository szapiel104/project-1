import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { Terrain } from '../src/data/terrain';
import { createGame as realGame, Phase, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { backTiles, canPlace, rockBehind } from '../src/sim/systems/placement';
import { crewWanted, MINE_YIELDS } from '../src/sim/systems/workers';
import { CAMP_T, campOf, holdTotal } from '../src/sim/systems/minecamp';
import { GUARD, UNITS } from '../src/data/units';
import { FP } from '../src/sim/state';
import { clockAt } from '../src/sim/clock';

/** Gra bez botów, z zapasem drewna na kopalnię i chaty */
const createGame = (seed: number, preset: '1v1' | '2v2' = '1v1'): GameState => {
  const g = realGame(seed, preset);
  for (const p of g.players) { p.bot = false; p.res[resIndex('wood')] = 120; p.res[resIndex('stone')] = 0; p.res[resIndex('apples')] = 300; }
  return g;
};
const run = (g: GameState, ticks: number): void => { for (let i = 0; i < ticks; i++) step(g, []); };
const MINE = buildingIndex('oremine');

/** Pierwsze miejsce pod kopalnię: przed skrajem gór, drzwiami od skały (jak szuka bot) */
function rockSpot(g: GameState, player = 0): { x: number; y: number; rot: number } {
  const { width, height, tiles } = g.map;
  const def = BUILDINGS[MINE]!;
  const keep = playerKeep(g, player)!;
  let best: { x: number; y: number; rot: number; d: number } | null = null;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (tiles[y * width + x] !== Terrain.Mountain) continue;
      const d = (x - keep.x) ** 2 + (y - keep.y) ** 2;
      if (best && d >= best.d) continue;
      for (const rot of [0, 2, 1, 3]) {
        const w = rot % 2 ? def.h : def.w, h = rot % 2 ? def.w : def.h;
        const bx = rot === 0 || rot === 2 ? x - 1 : rot === 1 ? x + 1 : x - w;
        const by = rot === 0 ? y + 1 : rot === 2 ? y - h : y - 1;
        if (canPlace(g, player, MINE, bx, by, false, rot) === null) { best = { x: bx, y: by, rot, d }; break; }
      }
    }
  if (!best) throw new Error('brak miejsca pod kopalnię');
  return best;
}

describe('kopalnia pod górami', () => {
  it('jest w menu zamiast kamieniołomu i kopalni żelaza, a starych nie da się już postawić', () => {
    expect(MINE).toBeGreaterThan(0);
    expect(BUILDINGS[buildingIndex('quarry')]!.legacy).toBe(true);
    expect(BUILDINGS[buildingIndex('mine')]!.legacy).toBe(true);
    const g = createGame(3);
    expect(canPlace(g, 0, buildingIndex('quarry'), 10, 10, false)).toBe('place.unknown');
  });

  it('stoi tylko tyłem do skały', () => {
    const g = createGame(3);
    const keep = playerKeep(g, 0)!;
    // łąka przed zamkiem: brak gór za budynkiem
    expect(canPlace(g, 0, MINE, keep.x + 2, keep.y + 14, false)).toBe('place.needRock');
    const at = rockSpot(g);
    expect(canPlace(g, 0, MINE, at.x, at.y, false, at.rot)).toBeNull();
    expect(rockBehind(g, at.x, at.y, at.rot % 2 ? 3 : 3, 3, at.rot)).toBe(true);
    // tył to pola naprzeciw wejścia: przy rot 0 (wejście od +y) leżą nad działką
    const back = backTiles(g, 5, 5, 3, 3, 0);
    expect(back).toEqual([4 * g.map.width + 5, 4 * g.map.width + 6, 4 * g.map.width + 7]);
  });

  it('załoga rośnie z wioską, kopie w środku i nosi kamień, żelazo i rudę do składu', () => {
    const g = createGame(3);
    const at = rockSpot(g);
    step(g, [{ type: 'build', player: 0, building: 'oremine', x: at.x, y: at.y, rot: at.rot }]);
    const mine = g.buildings.find((b) => b.type === MINE)!;
    expect(mine).toBeDefined();
    expect(mine.hp).toBe(360);
    // na starcie mało ludzi: tylko brygadzista albo dwóch
    const pop0 = g.units.filter((u) => u.owner === 0).length;
    run(g, 3000); // budowa: chłopi noszą materiał ze składu pod góry, potem budują
    const size = (): number => (mine.worker ? 1 : 0) + (mine.crew?.length ?? 0);
    expect(size()).toBeGreaterThanOrEqual(1);
    expect(size()).toBeLessThanOrEqual(crewWanted(BUILDINGS[MINE]!, pop0));
    // więcej mieszkańców = większa załoga (dokładamy ludzi wprost do stanu, jak przy migracji)
    const tpl = g.units.find((u) => u.owner === 0)!;
    for (let i = 0; i < 30; i++) g.units.push({ ...tpl, id: g.nextId++, job: 0, home: 0, phase: Phase.Idle, path: [], carryRes: -1, carryAmt: 0, target: 0, wait: 0, timer: 0, batches: 0, trips: 0 });
    run(g, 400);
    const want = crewWanted(BUILDINGS[MINE]!, g.units.filter((u) => u.owner === 0).length);
    expect(want).toBeGreaterThan(2);
    expect(size()).toBe(want);
    for (const id of [mine.worker, ...(mine.crew ?? [])]) expect(g.units.find((u) => u.id === id)!.job).toBe(mine.id);
    // po długiej pracy w składzie jest wszystko po trochu, a ruda najrzadziej
    const p = g.players[0]!;
    const before = ['stone', 'iron'].map((r) => p.res[resIndex(r as 'stone')]!);
    run(g, 6000);
    const got = ['stone', 'iron'].map((r, i) => p.res[resIndex(r as 'stone')]! - before[i]!);
    expect(got[0]).toBeGreaterThan(0);
    expect(got[1]).toBeGreaterThan(0);
    expect(mine.made).toBeGreaterThan(0);
  });

  it('wagi urobku sumują się do 100, a ruda (waluta) jest rzadka', () => {
    expect(MINE_YIELDS.reduce((a, y) => a + y.weight, 0)).toBe(100);
    expect(MINE_YIELDS.find((y) => y.res === 'gold')!.weight).toBeLessThan(15);
    expect(crewWanted({ crew: { per: 5, max: 8 } }, 0)).toBe(1);
    expect(crewWanted({ crew: { per: 5, max: 8 } }, 12)).toBe(3);
    expect(crewWanted(BUILDINGS[MINE]!, 8)).toBe(3);
    expect(crewWanted({ crew: { per: 5, max: 8 } }, 500)).toBe(8);
  });

  it('po zburzeniu cała załoga jest wolna, a śmierć brygadzisty awansuje następnego', async () => {
    const g = createGame(3);
    const at = rockSpot(g);
    step(g, [{ type: 'build', player: 0, building: 'oremine', x: at.x, y: at.y, rot: at.rot }]);
    const mine = g.buildings.find((b) => b.type === MINE)!;
    const tpl = g.units.find((u) => u.owner === 0)!;
    for (let i = 0; i < 20; i++) g.units.push({ ...tpl, id: g.nextId++, job: 0, home: 0, phase: Phase.Idle, path: [], carryRes: -1, carryAmt: 0, target: 0, wait: 0, timer: 0, batches: 0, trips: 0 });
    run(g, 3000);
    expect(mine.crew?.length ?? 0).toBeGreaterThan(0);
    // brygadzista ginie (jak od wilka): pierwszy z załogi przejmuje kopalnię
    const foreman = mine.worker, next = mine.crew![0]!;
    g.units.splice(g.units.findIndex((u) => u.id === foreman), 1);
    const { dropWorker } = await import('../src/sim/state');
    dropWorker(g, foreman);
    expect(mine.worker).toBe(next);
    // wyłączenie: wszyscy wolni
    step(g, [{ type: 'power', player: 0, id: mine.id, on: false }]);
    expect(mine.worker).toBe(0);
    expect(mine.crew).toBeUndefined();
    expect(g.units.every((u) => u.job !== mine.id)).toBe(true);
  });

  it('bot stawia kopalnię pod górami', () => {
    const g = realGame(7, '1v1');
    for (const p of g.players) { p.res[resIndex('wood')] = 400; p.res[resIndex('apples')] = 400; }
    run(g, 4000);
    const bots = g.players.filter((p) => p.bot).map((p) => p.id);
    expect(bots.length).toBeGreaterThan(0);
    const mines = g.buildings.filter((b) => b.type === MINE && bots.includes(b.owner));
    expect(mines.length).toBeGreaterThan(0);
    for (const m of mines) expect(rockBehind(g, m.x, m.y, m.rot % 2 ? 3 : 3, 3, m.rot)).toBe(true);
  });

  it('barak przy kopalni: stoi tylko przy kopalni, załoga w nim nocuje, urobek jedzie wozem pod eskortą dwóch strażników', () => {
    const g = createGame(3);
    const p = g.players[0]!;
    p.res[resIndex('spear')] = 4; p.res[resIndex('gold')] = 100; p.res[resIndex('wood')] = 110;
    const at = rockSpot(g);
    step(g, [{ type: 'build', player: 0, building: 'oremine', x: at.x, y: at.y, rot: at.rot }]);
    const mine = g.buildings.find((b) => b.type === MINE)!;
    // drzewko budowy: barak dopiero przy gotowej kopalni — na czas wyboru miejsca udajemy gotową, potem budowa trwa jak dotąd
    const work = mine.build;
    mine.build = 0;
    // barak: daleko od kopalni nie wolno, przy kopalni tak
    const keep = playerKeep(g, 0)!;
    expect(canPlace(g, 0, CAMP_T, keep.x + 3, keep.y + 14, false)).toBe('place.needMine');
    let spot: { x: number; y: number } | null = null;
    for (let r = 2; r <= 8 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r; dx++) {
      if (canPlace(g, 0, CAMP_T, mine.x + dx, mine.y + dy, false) === null) { spot = { x: mine.x + dx, y: mine.y + dy }; break; }
    }
    expect(spot).not.toBeNull();
    step(g, [{ type: 'build', player: 0, building: 'minecamp', x: spot!.x, y: spot!.y }]);
    mine.build = work;
    const camp = g.buildings.find((b) => b.type === CAMP_T)!;
    const tpl = g.units.find((u) => u.owner === 0)!;
    for (let i = 0; i < 16; i++) g.units.push({ ...tpl, id: g.nextId++, job: 0, home: 0, phase: Phase.Idle, path: [], carryRes: -1, carryAmt: 0, target: 0, wait: 0, timer: 0, batches: 0, trips: 0 });
    run(g, 3000); // obie budowy, załoga, rekruci straży
    expect(campOf(g, mine)?.id).toBe(camp.id);
    // dwóch strażników kopalni, osobno od straży miejskiej
    run(g, 1500);
    const guards = g.soldiers.filter((s) => s.camp === camp.id);
    expect(guards.length).toBe(2);
    // urobek trafia pod barak, a potem wozem do zamku: w składach przybywa kamienia, a wóz miał eskortę
    const before = p.res[resIndex('stone')]!;
    let sawCart = false, sawEscort = false, sawHold = false;
    for (let i = 0; i < 9000; i++) {
      step(g, []);
      if (holdTotal(camp) > 0) sawHold = true;
      const cart = (g.caravans ?? []).find((c) => c.camp === camp.id);
      if (cart) { sawCart = true; if ((cart.escort?.length ?? 0) === 2) sawEscort = true; }
    }
    expect(sawHold).toBe(true);
    expect(sawCart).toBe(true);
    expect(sawEscort).toBe(true);
    expect(p.res[resIndex('stone')]!).toBeGreaterThan(before);
    // nocą górnicy śpią w baraku
    let slept = false;
    for (let i = 0; i < 3000 && !slept; i++) {
      step(g, []);
      const h = clockAt(g.tick).hour;
      if (h >= 1 && h < 4) slept = [mine.worker, ...(mine.crew ?? [])].some((id) => { const u = g.units.find((x) => x.id === id); return !!u && u.home === camp.id; });
    }
    expect(slept).toBe(true);
  });

  it('wróg pod kopalnią: załoga ucieka do zamku i wraca do roboty, gdy wroga już nie ma', () => {
    const g = createGame(3);
    const at = rockSpot(g);
    step(g, [{ type: 'build', player: 0, building: 'oremine', x: at.x, y: at.y, rot: at.rot }]);
    const mine = g.buildings.find((b) => b.type === MINE)!;
    const tpl = g.units.find((u) => u.owner === 0)!;
    for (let i = 0; i < 12; i++) g.units.push({ ...tpl, id: g.nextId++, job: 0, home: 0, phase: Phase.Idle, path: [], carryRes: -1, carryAmt: 0, target: 0, wait: 0, timer: 0, batches: 0, trips: 0 });
    // do pierwszego kursu: ktoś kopie w sztolni
    let t = 0;
    while (t++ < 6000 && !g.units.some((u) => u.job === mine.id && u.phase === Phase.Working)) step(g, []);
    expect(g.units.some((u) => u.job === mine.id && u.phase === Phase.Working)).toBe(true);
    // żołnierz wroga (stoi w miejscu) tuż przy kopalni
    const w = g.map.width, d = mine.door;
    const foe = { id: g.nextId++, owner: 1, kind: GUARD, px: (d % w) * FP + FP / 2, py: Math.floor(d / w) * FP + FP / 2 + 2 * FP, path: [], hp: 9999, goal: -1, wait: 0, target: 0, cd: 0, stance: 2 };
    g.soldiers.push(foe);
    run(g, 20);
    expect(mine.threat ?? 0).toBeGreaterThan(g.tick);
    run(g, 200);
    expect(g.units.some((u) => u.job === mine.id && u.phase === Phase.Working)).toBe(false);
    // wróg odchodzi: po chwili alarm gaśnie i górnicy wracają do sztolni
    g.soldiers.splice(g.soldiers.indexOf(foe), 1);
    let back = false;
    for (let i = 0; i < 4000 && !back; i++) { step(g, []); back = !mine.threat && g.units.some((u) => u.job === mine.id && u.phase === Phase.Working); }
    expect(back).toBe(true);
    expect(UNITS[GUARD]).toBeDefined();
  });
});

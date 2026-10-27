import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { RESOURCES, resIndex } from '../src/data/resources';
import { deserialize, serialize } from '../src/sim/save';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, Phase, storeCapacity, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';

/** Pusta łąka: spichlerz i sad przy twierdzy, jedzenie dokładnie pod sufit spichlerza */
function scene(peasants: number, granaries = 1): { g: GameState; orchard: number; granary: number } {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width;
  const hx = k.door % W, hy = Math.floor(k.door / W);
  const p = g.players[0]!;
  for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
  const granary = placeReady(g, 'granary', hx + 4, hy + 4)!;
  if (granaries > 1) placeReady(g, 'granary', hx + 8, hy + 4);
  const orchard = placeReady(g, 'orchard', hx - 4, hy + 6)!;
  p.res[resIndex('bread')] = storeCapacity(g, 0, 'granary'); // pełno
  p.rations = 0; // nikt nie je, więc miejsce zwalnia się tylko wtedy, gdy test tak chce
  calm.add(g);
  addPeasants(g, peasants);
  setHour(g, 6);
  return { g, orchard, granary };
}
/** Gry, w których ludzie nie odchodzą mimo braku racji (popularność trzymana wysoko) */
const calm = new WeakSet<GameState>();
const tick = (g: GameState): void => { if (calm.has(g)) g.players[0]!.popularity = 80; step(g, []); };
const run = (g: GameState, n: number): void => { for (let i = 0; i < n; i++) tick(g); };
const byId = (g: GameState, id: number) => g.buildings.find((b) => b.id === id)!;

describe('magazyny', () => {
  it('pełny spichlerz: sadownik odkłada jabłka pod drzwiami i czeka w sadzie, nie robi kolejnych', () => {
    const { g, orchard, granary } = scene(1);
    for (let i = 0; i < 1500 && !g.piles?.length; i++) tick(g);
    const pile = g.piles![0]!;
    expect(pile.res).toBe(resIndex('apples'));
    expect(pile.store).toBe(granary);
    expect(pile.t).toBe(byId(g, granary).door);
    expect(byId(g, orchard).stall).toBe(resIndex('apples') + 1);
    const made = byId(g, orchard).made ?? 0;
    run(g, 600);
    const u = g.units.find((x) => x.job === orchard)!;
    expect(u.phase).toBe(Phase.Stalled);
    expect(u.carryRes).toBe(-1);
    expect(byId(g, orchard).made ?? 0).toBe(made); // nic nowego nie zrobił
    expect(g.piles!.length).toBe(1); // nie nosi kolejnych
    // zapis gry pamięta stos i czekanie (pusta scena ma inną mapę niż ziarno, więc porównujemy same dane)
    const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    expect(back.piles).toEqual(g.piles);
    expect(back.buildings.find((b) => b.id === orchard)!.stall).toBe(resIndex('apples') + 1);
  });

  it('gdy zwolni się miejsce, magazynier wnosi towar spod drzwi, a sadownik wraca do pracy', () => {
    const { g, orchard, granary } = scene(2);
    for (let i = 0; i < 1500 && !g.piles?.length; i++) tick(g);
    expect(byId(g, granary).worker).toBeGreaterThan(0); // magazynier jest
    const keeper = byId(g, granary).worker;
    const amt = g.piles![0]!.amt;
    const p = g.players[0]!;
    p.res[resIndex('bread')]! -= 100; // ludzie zjedli część zapasu
    const u = g.units.find((x) => x.job === orchard)!;
    let selfCarry = false, keeperWorked = false;
    // magazynier stoi w drzwiach, przy których leży stos: bierze go od ręki i wnosi do środka
    for (let i = 0; i < 800 && g.piles!.length; i++) { tick(g); if (u.phase === Phase.ToPile) selfCarry = true; const k = g.units.find((x) => x.id === keeper); if (k && k.phase !== Phase.Idle) keeperWorked = true; }
    expect(keeperWorked).toBe(true);
    expect(selfCarry).toBe(false);
    run(g, 30);
    expect(g.piles!.length).toBe(0);
    expect(p.res[resIndex('apples')]).toBeGreaterThanOrEqual(amt);
    run(g, 100);
    expect(byId(g, orchard).stall ?? 0).toBe(0);
    expect(g.units.find((x) => x.job === orchard)!.phase).not.toBe(Phase.Stalled);
  });

  it('bez wolnego magazyniera czekający robotnik sam wnosi swój towar', () => {
    const { g, orchard, granary } = scene(1);
    byId(g, granary).off = true; // spichlerz bez obsady
    for (let i = 0; i < 1500 && !g.piles?.length; i++) tick(g);
    g.players[0]!.res[resIndex('bread')]! -= 100;
    const u = g.units.find((x) => x.job === orchard)!;
    let carried = false;
    for (let i = 0; i < 800 && g.piles!.length; i++) { tick(g); if (u.phase === Phase.ToPile) carried = true; }
    expect(carried).toBe(true);
    expect(g.piles!.length).toBe(0);
  });

  it('na jeden stos idzie jeden człowiek, choć wolnych magazynierów jest więcej', () => {
    const { g } = scene(4, 2);
    for (let i = 0; i < 1500 && !g.piles?.length; i++) tick(g);
    const keepers = g.buildings.filter((b) => BUILDINGS[b.type]!.keepers && b.worker).length;
    expect(keepers).toBe(2);
    g.players[0]!.res[resIndex('bread')]! -= 300;
    const keeperIds = g.buildings.filter((b) => BUILDINGS[b.type]!.keepers).map((b) => b.worker);
    const worked = new Set<number>();
    for (let i = 0; i < 400; i++) { tick(g); for (const id of keeperIds) { const k = g.units.find((x) => x.id === id); if (k && k.phase !== Phase.Idle) worked.add(id); } }
    expect(g.piles!.length).toBe(0);
    expect(worked.size).toBe(1);
  });

  it('duży magazyn ma dwóch magazynierów, mały jednego; warsztat zabiera wolnego magazyniera, gdy brak ludzi', () => {
    const g = createGame(11, '1v1', 2, true);
    emptyScene(g);
    const k = g.buildings[0]!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    const barn = placeReady(g, 'barn', hx + 4, hy + 4)!;
    const stock = placeReady(g, 'stockpile', hx + 9, hy + 4)!;
    addPeasants(g, 3);
    setHour(g, 7);
    run(g, 300);
    const b = byId(g, barn), s = byId(g, stock);
    expect((b.worker ? 1 : 0) + (b.crew?.length ?? 0)).toBe(2);
    expect((s.worker ? 1 : 0) + (s.crew?.length ?? 0)).toBe(1);
    // nowy sad, a wolnych chłopów nie ma: idzie do niego magazynier
    const orchard = placeReady(g, 'orchard', hx - 4, hy + 6)!;
    run(g, 5);
    expect(byId(g, orchard).worker).toBeGreaterThan(0);
  });

  it('bez żadnego magazynu towar zostaje na ziemi, a nowy magazyn go przejmuje', () => {
    const g = createGame(11, '1v1', 2, true);
    emptyScene(g);
    const k = g.buildings[0]!, W = g.map.width;
    const hx = k.door % W, hy = Math.floor(k.door / W);
    const p = g.players[0]!;
    for (let i = 0; i < RESOURCES.length; i++) p.res[i] = 0;
    const orchard = placeReady(g, 'orchard', hx - 4, hy + 6)!;
    addPeasants(g, 2);
    setHour(g, 6);
    for (let i = 0; i < 1500 && !g.piles?.length; i++) tick(g);
    expect(g.piles!.length).toBe(1);
    expect(g.piles![0]!.store).toBe(0);
    expect(byId(g, orchard).stall).toBeGreaterThan(0);
    placeReady(g, 'granary', hx + 4, hy + 4);
    for (let i = 0; i < 1500 && g.piles!.length; i++) tick(g);
    expect(g.piles!.length).toBe(0);
    run(g, 300); // donosi do nowego spichlerza
    expect(p.res[resIndex('apples')]).toBeGreaterThan(0);
  });
});

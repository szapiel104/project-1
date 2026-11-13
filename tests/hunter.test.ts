import { expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { deserialize, serialize } from '../src/sim/save';
import { addPeasants, addWolf, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, FP, stateHash, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';

function scene(): { g: GameState; id: number } {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width;
  const hx = k.door % W, hy = Math.floor(k.door / W);
  const id = placeReady(g, 'hunter', hx - 1, hy + 8)!;
  placeReady(g, 'granary', hx + 4, hy + 4);
  placeReady(g, 'stockpile', hx + 4, hy + 8);
  // małe stado jeleni kilkanaście pól od chaty
  const x = hx + 12, y = hy + 16;
  for (let i = 0; i < 3; i++) g.beasts!.push({ id: g.nextId++, sp: 0, herd: 1, size: 3, px: (x + i) * FP, py: y * FP, hx: x * FP, hy: y * FP, tx: (x + i) * FP, ty: y * FP, state: 0, until: 0, hp: 1 });
  // pusta scena daje po 5000 wszystkiego (pełne magazyny); tu mało, żeby mięso miało gdzie trafić
  g.players[0]!.res.fill(50);
  addPeasants(g, 2);
  setHour(g, 7);
  return { g, id };
}

it('myśliwy poluje na jelenie i przynosi mięso; deterministycznie i z zapisem gry', () => {
  const run = (): GameState => { const { g } = scene(); for (let i = 0; i < 3000; i++) step(g, []); return g; };
  const { g } = scene();
  const meat0 = g.players[0]!.res[resIndex('meat')]!;
  for (let i = 0; i < 3000; i++) step(g, []);
  expect(g.players[0]!.res[resIndex('meat')]!).toBeGreaterThan(meat0);
  // z jeleni zostają skóry, odniesione do składu po ostatniej porcji mięsa
  expect(g.players[0]!.res[resIndex('hides')]!).toBeGreaterThan(50);
  expect(stateHash(run())).toBe(stateHash(g));
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
  expect(back.beasts!.length).toBe(g.beasts!.length);
}, 60000);

it('wybite stado odnawia się zwierzętami, które przychodzą z krańca mapy', () => {
  const { g } = scene();
  for (const b of g.beasts!) { b.hp = 0; b.dead = 0; }
  // truchła znikają, potem (REGROW_TICKS) pierwsza nowa sztuka staje na skraju mapy, a nie w miejscu stada
  for (let i = 0; i < 1801; i++) { step(g, []); if (g.tick % 1800 === 0) break; }
  const fresh = g.beasts!.filter((b) => b.hp > 0);
  expect(fresh.length).toBe(1);
  const b = fresh[0]!, W = g.map.width, H = g.map.height;
  const edge = Math.min(b.px / FP, b.py / FP, W - b.px / FP, H - b.py / FP);
  expect(Math.hypot(b.px - b.hx, b.py - b.hy) / FP).toBeGreaterThan(10);
  expect(edge).toBeLessThan(20);
});

it('myśliwy strzela do wilka w zasięgu chaty, a ubitego oskórowuje (skóra do składu)', () => {
  const { g } = scene();
  g.beasts!.length = 0;
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W);
  // świt drugiego dnia: wilk jeszcze krąży, myśliwy wstaje do pracy (setHour liczy godziny od początku gry)
  setHour(g, 29.9);
  for (let i = 0; i < 120; i++) step(g, []);
  addWolf(g, hx + 6, hy + 16);
  const hides0 = g.players[0]!.res[resIndex('hides')]!;
  let shot = false;
  for (let i = 0; i < 1500; i++) { step(g, []); if (g.wolves[0] && g.wolves[0].hp < 45) shot = true; }
  expect(shot).toBe(true);
  expect(g.players[0]!.res[resIndex('hides')]!).toBe(hides0 + 1);
}, 60000);

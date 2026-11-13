import { expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { unitIndex } from '../src/data/units';
import { addPeasants, emptyScene, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { hitDamage, train } from '../src/sim/systems/army';

it('kaletnik szyje kaftany ze skór, a łucznik szkolony przy kaftanie dostaje go i lżej obrywa', () => {
  const g = createGame(11, '1v1', 2, true);
  emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W);
  placeReady(g, 'tanner', hx - 1, hy + 7);
  placeReady(g, 'armory', hx + 4, hy + 5);
  placeReady(g, 'stockpile', hx + 4, hy + 9);
  const barracks = placeReady(g, 'barracks', hx - 6, hy + 4)!;
  const p = g.players[0]!;
  p.res.fill(40);
  const L = resIndex('leather');
  p.res[L] = 0;
  addPeasants(g, 4);
  setHour(g, 7);
  for (let i = 0; i < 2500; i++) step(g, []);
  expect(p.res[L]!).toBeGreaterThan(0);
  const before = p.res[L]!;
  expect(train(g, 0, barracks, 'archer')).toBe(true);
  expect(p.res[L]!).toBe(before - 1);
  for (let i = 0; i < 600 && !g.soldiers.some((s) => s.owner === 0 && s.leather); i++) step(g, []);
  const archer = g.soldiers.find((s) => s.owner === 0 && s.kind === unitIndex('archer'))!;
  expect(archer.leather).toBe(1);
  // ten sam strzał w łucznika bez kaftana boli bardziej
  const foe = { ...archer, id: 999999, owner: 1, px: archer.px + 256 * 4 };
  const bare = { ...archer, leather: undefined };
  const byId = new Map([[archer.id, archer], [foe.id, foe]]);
  expect(hitDamage(g, foe, archer, byId, true)).toBeLessThanOrEqual(hitDamage(g, foe, bare, byId, true));
  expect(hitDamage(g, foe, archer, byId, false) * 100).toBeLessThan(hitDamage(g, foe, bare, byId, false) * 100 + 1);
}, 60000);

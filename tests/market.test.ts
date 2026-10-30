import { expect, it } from 'vitest';
import { resIndex } from '../src/data/resources';
import { buyPrice, sellPrice } from '../src/data/market';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { createGame, storeRoom } from '../src/sim/state';
import { step } from '../src/sim/step';
import { botTrade, canTrade } from '../src/sim/systems/market';

it('rynek: sprzedaż i kupno od ręki za rudę, kupno droższe, limity (30.10.2026)', () => {
  const g = createGame(11, '1v1', 2, false); emptyScene(g);
  const k = g.buildings[0]!, W = g.map.width, hx = k.door % W, hy = Math.floor(k.door / W), p = g.players[0]!;
  const wood = resIndex('wood'), gold = resIndex('gold');
  p.res.fill(0); p.res[wood] = 100;
  expect(canTrade(g, 0, wood, -20)).toBe('trade.market'); // bez rynku nie handlujesz
  expect(placeReady(g, 'market', hx + 5, hy + 5)).not.toBeNull();
  placeReady(g, 'stockpile', hx - 5, hy + 5);
  step(g, [{ type: 'trade', player: 0, res: wood, amount: -20 }]);
  expect(p.res[wood]).toBe(80);
  expect(p.res[gold]).toBe(sellPrice('wood', 20));
  // kupno tego samego drożej: kółko zawsze traci
  expect(buyPrice('wood', 20)).toBeGreaterThan(sellPrice('wood', 20));
  expect(canTrade(g, 0, wood, 20)).toBe('trade.gold');
  p.res[gold] = 1000;
  const before = p.res[gold]!;
  expect(canTrade(g, 0, wood, 20)).toBeNull();
  step(g, [{ type: 'trade', player: 0, res: wood, amount: 20 }]);
  expect(p.res[wood]).toBe(100);
  expect(p.res[gold]).toBe(before - buyPrice('wood', 20));
  // nie sprzedasz więcej, niż masz; nie kupisz ponad miejsce w magazynach; ruda nie jest towarem
  expect(canTrade(g, 0, wood, -500)).toBe('trade.have');
  expect(canTrade(g, 0, wood, storeRoom(g, 0, wood) + 1)).toBe('trade.room');
  expect(canTrade(g, 0, gold, 5)).toBe('trade.goods');
  // bot sprzedaje nadwyżkę drewna
  p.res[wood] = 350; p.res[gold] = 0;
  botTrade(g, 0);
  expect(p.res[wood]).toBe(330);
  expect(p.res[gold]).toBeGreaterThan(0);
});

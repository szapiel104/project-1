import { expect, it } from 'vitest';
import { createGame } from '../src/sim/state';
import { deserialize, serialize } from '../src/sim/save';
import { weatherOf } from '../src/sim/weather';

it('pora roku ustawiona w menu dewelopera przetrwa zapis i wczytanie', () => {
  const g = createGame(2, '1v1', 1, false);
  g.seasonShift = 200;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
  expect(back.seasonShift).toBe(200);
  expect(weatherOf(back, 0).season).toBe(weatherOf(g, 0).season);
});

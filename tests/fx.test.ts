import { expect, it } from 'vitest';
import { buildingModel, isWindowMat } from '../src/render/buildings';
import { collectFx } from '../src/render/ambience';

it('chaty mają komin i świecące okna, obóz ma ognisko', () => {
  const house = collectFx(buildingModel('house', 0xa32a22), isWindowMat);
  expect(house.chimneys.length).toBeGreaterThan(0);
  expect(house.windows.length).toBeGreaterThanOrEqual(3);
  expect(collectFx(buildingModel('camp', 0xa32a22), isWindowMat).fires.length).toBe(1);
});

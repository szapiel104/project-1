import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { showsWear, wearMaterial, wearStage } from '../src/render/wear';

const T = (id: string): number => BUILDINGS.findIndex((d) => d.id === id);

describe('zużycie murów i wież', () => {
  it('stopień rośnie z ubytkiem wytrzymałości i wraca do zera po naprawie', () => {
    expect(wearStage(1000, 1000)).toBe(0);
    expect(wearStage(920, 1000)).toBe(0);
    expect(wearStage(850, 1000)).toBe(1);
    expect(wearStage(600, 1000)).toBe(2);
    expect(wearStage(200, 1000)).toBe(3);
    expect(wearStage(1, 1000)).toBe(3);
  });
  it('pęknięcia widać na murach, bramach, wieżach i twierdzy, ale nie na drabinie, studni i chatach', () => {
    for (const id of ['palisade', 'stoneWall', 'gate', 'stoneGate', 'watchtower', 'stoneTower', 'keep']) expect(showsWear(T(id))).toBe(true);
    for (const id of ['ladder', 'well', 'house']) expect(showsWear(T(id))).toBe(false);
  });
  it('drewno łupie się, kamień pęka', () => {
    expect(wearMaterial(T('palisade'))).toBe('wood');
    expect(wearMaterial(T('watchtower'))).toBe('wood');
    expect(wearMaterial(T('stoneTower'))).toBe('stone');
    expect(wearMaterial(T('keep'))).toBe('stone');
  });
});

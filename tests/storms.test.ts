import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { RULES } from '../src/data/rules';
import { rainAt } from '../src/sim/clock';
import { createGame, playerKeep, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { droughtAt, harvestPct, stormAt } from '../src/sim/systems/storms';
import { seasonAt, shiftToSeason } from '../src/sim/weather';

function meadow(): { g: GameState; x: number; y: number } {
  const g = createGame(3);
  emptyScene(g);
  const k = playerKeep(g, 0)!, w = g.map.width;
  return { g, x: k.door % w, y: Math.floor(k.door / w) };
}

describe('burze i susza', () => {
  it('w burzy piorun podpala drewniane budynki, a kamiennych nie rusza', () => {
    const { g, x, y } = meadow();
    const ids = [placeReady(g, 'house', x - 6, y + 5)!, placeReady(g, 'woodcutter', x - 2, y + 5)!, placeReady(g, 'stoneTower', x + 3, y + 5)!];
    expect(ids.every(Boolean)).toBe(true);
    // pora poza zimą i ulewa: przesuwamy czas do pierwszej burzy
    while (rainAt(g.tick) < RULES.storm.rain) g.tick++;
    g.seasonShift = shiftToSeason(g.tick, 'summer'); // pora po znalezieniu ulewy: pora roku trwa tylko 3 doby
    expect(stormAt(g)).toBe(true);
    let strikes = 0, last = -1;
    for (let i = 0; i < 3000; i++) {
      step(g, []);
      const s = g.players[0]!.lastStrike;
      if (s && s.tick !== last) { last = s.tick; strikes++; const b = g.buildings.find((o) => o.id === s.building)!; expect(BUILDINGS[b.type]!.id).not.toBe('stoneTower'); expect(b.fire).toBeGreaterThan(0); }
    }
    expect(strikes).toBeGreaterThan(0);
    // zimą nie grzmi
    while (rainAt(g.tick) < RULES.storm.rain) g.tick++;
    g.seasonShift = shiftToSeason(g.tick, 'winter');
    expect(seasonAt(g.tick, g.seasonShift)).toBe('winter');
    expect(stormAt(g)).toBe(false);
  });

  it('deszcz przygasza pożar szybciej niż w suchy dzień', () => {
    const { g, x, y } = meadow();
    const id = placeReady(g, 'house', x - 6, y + 5);
    const b = g.buildings.find((o) => o.id === id)!;
    while (rainAt(g.tick) > 0) g.tick++;
    b.fire = 400; for (let i = 0; i < 100; i++) step(g, []);
    const dry = 400 - b.fire!;
    while (rainAt(g.tick) < 0.9) g.tick++;
    b.fire = 400; for (let i = 0; i < 100; i++) step(g, []);
    expect(400 - (b.fire ?? 0)).toBeGreaterThan(dry * 2);
  });

  it('w suszy sad bez studni rodzi o połowę mniej, ze studnią obok prawie normalnie', () => {
    const { g, x, y } = meadow();
    const fid = placeReady(g, 'orchard', x - 14, y + 4), nid = placeReady(g, 'orchard', x + 6, y + 4);
    const far = g.buildings.find((o) => o.id === fid)!, near = g.buildings.find((o) => o.id === nid)!;
    expect(placeReady(g, 'well', x + 10, y + 5)).not.toBeNull();
    g.seasonShift = shiftToSeason(g.tick, 'summer');
    let found = false;
    for (let i = 0; i < RULES.dayTicks * 5 && !found; i += 25) { g.tick += 25; if (droughtAt(g)) found = true; }
    expect(found).toBe(true);
    expect(harvestPct(g, far)).toBe(RULES.drought.yield);
    expect(harvestPct(g, near)).toBe(RULES.drought.withWell);
    g.seasonShift = shiftToSeason(g.tick, 'autumn');
    expect(harvestPct(g, far)).toBe(100);
  });
});

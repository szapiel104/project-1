import { describe, expect, it } from 'vitest';
import { buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene, placeReady } from '../src/sim/emptyscene';
import { canPlace } from '../src/sim/systems/placement';
import { boulderAt, boulderTiles, canSmash, ROCK_COST } from '../src/sim/systems/boulders';

describe('głazy (30.10.2026)', () => {
  it('są na mapie, blokują budowę; cech inżynierów rozbija je za rudę, zostaje stos kamienia', () => {
    const g = createGame(9);
    const tiles = [...boulderTiles(g.map).keys()];
    expect(tiles.length).toBeGreaterThan(5);
    expect(boulderTiles(createGame(9).map)).toEqual(boulderTiles(g.map));   // te same u każdego gracza
    emptyScene(g);
    const w = g.map.width, t = tiles.find((x) => boulderAt(g, x))!;
    const x = t % w, y = (t - x) / w;
    expect(canPlace(g, 0, buildingIndex('roadSand'), x, y, false)).toBe('place.rock');
    expect(canSmash(g, 0, t)).toBe('rock.guild');
    const k = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
    expect(placeReady(g, 'engineers', k.x - 8, k.y + 8) || placeReady(g, 'engineers', k.x + 8, k.y + 10)).toBeTruthy();
    g.players[0]!.res[resIndex('gold')] = ROCK_COST - 1;
    expect(canSmash(g, 0, t)).toBe('rock.cost');
    g.players[0]!.res[resIndex('gold')] = ROCK_COST + 5;
    const n = g.rubble.length;
    step(g, [{ type: 'smashRock', player: 0, tile: t }]);
    expect(boulderAt(g, t)).toBe(false);
    expect(g.players[0]!.res[resIndex('gold')]).toBe(5);
    expect(g.rubble.length).toBe(n + 1);
    expect(canPlace(g, 0, buildingIndex('roadSand'), x, y, false)).not.toBe('place.rock');
  });
});

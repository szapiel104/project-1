import { afterAll, describe, expect, it } from 'vitest';
import { generateMap, tileAt } from '../src/sim/map';
import { BIOMES, forceBiome, CLIFF_STEP } from '../src/data/biomes';
import { Terrain } from '../src/data/terrain';
import { MAP_PRESETS, type MapPresetId } from '../src/data/maps';

/** Krainy, płaskowyże i skałki (generator 8, docs/teren.md) */
describe('krainy', () => {
  afterAll(() => forceBiome(null));
  const presets = Object.keys(MAP_PRESETS) as MapPresetId[];

  it.each(BIOMES)('%s: mapa symetryczna, zamki na równym, z każdego zamku dojście do każdego', (b) => {
    forceBiome(b);
    for (const p of presets) for (const seed of [3, 11]) {
      const m = generateMap(seed, p);
      expect(m.biome).toBe(b);
      const W = m.width, size = m.tiles.length;
      for (let i = 0; i < size; i++) {
        expect(m.tiles[i]).toBe(m.tiles[size - 1 - i]);
        expect(m.relief![i]).toBe(m.relief![size - 1 - i]);
      }
      for (const s of m.starts) {
        expect(tileAt(m, s.x, s.y)).toBe(Terrain.Grass);
        // plac pod zamek: bez rzeźby i bez skały
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
          const t = (s.y + dy) * W + s.x + dx;
          expect(m.relief![t]).toBe(0);
          expect(m.crag![t]).toBe(0);
        }
      }
      const seen = new Uint8Array(size), q = [m.starts[0]!.y * W + m.starts[0]!.x];
      seen[q[0]!] = 1;
      for (let k = 0; k < q.length; k++) {
        const t = q[k]!, x = t % W, y = (t - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy, n = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= m.height || seen[n]) continue;
          if (m.tiles[n] === Terrain.Water || m.tiles[n] === Terrain.Mountain) continue;
          seen[n] = 1; q.push(n);
        }
      }
      for (const st of m.starts) expect(seen[st.y * W + st.x]).toBe(1);
    }
  });

  it('wyżyna ma płaskowyże z urwiskami, a urwisko jest skałą (nie do przejścia)', () => {
    forceBiome('highland');
    const m = generateMap(5, '1v1');
    let cliffs = 0, high = 0;
    for (let i = 0; i < m.tiles.length; i++) {
      if (m.crag![i] === 1) { cliffs++; expect(m.tiles[i]).toBe(Terrain.Mountain); }
      if (m.relief![i]! > CLIFF_STEP) high++;
    }
    expect(cliffs).toBeGreaterThan(100);
    expect(high).toBeGreaterThan(m.tiles.length / 20);
  });

  it('kraina zmienia las: północ ma go więcej niż step', () => {
    const forest = (b: (typeof BIOMES)[number]): number => { forceBiome(b); return generateMap(9, '1v1').tiles.filter((t) => t === Terrain.Forest).length; };
    expect(forest('north')).toBeGreaterThan(forest('steppe') * 2);
  });

  it('dawne mapy (generator 7) bez krainy i bez rzeźby — zapis wczytuje tę samą mapę co przedtem', () => {
    forceBiome(null);
    const m = generateMap(42, '1v1', 7);
    expect(m.biome).toBeUndefined();
    expect(m.relief).toBeUndefined();
  });
});

describe('wybrana kraina', () => {
  it('kraina wybrana w „Nowej grze” wchodzi do mapy i wraca z zapisu', async () => {
    const { createGame } = await import('../src/sim/state');
    const { serialize, deserialize } = await import('../src/sim/save');
    forceBiome(null);
    const g = createGame(1234, '1v1', 2, false, undefined, true, 'mix', false, 'north');
    expect(g.map.biome).toBe('north');
    const back = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))));
    expect(back?.map.biome).toBe('north');
    expect(back?.map.tiles).toEqual(g.map.tiles);
  });
});

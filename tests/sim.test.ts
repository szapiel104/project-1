import { describe, expect, it } from 'vitest';
import { MAP_PRESETS, type MapPresetId } from '../src/data/maps';
import { Terrain } from '../src/data/terrain';
import { generateMap, tileAt } from '../src/sim/map';
import { Rng, seedFromText } from '../src/sim/rng';
import { createGame, stateHash, step } from '../src/sim/state';

describe('generator losowy', () => {
  it('to samo ziarno daje ten sam ciąg', () => {
    const a = new Rng(123), b = new Rng(123);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('ma ustaloną wartość wzorcową (wykrywa zmianę algorytmu)', () => {
    expect(new Rng(1).nextU32()).toBe(2693262067);
    expect(seedFromText('project-1')).toBe(seedFromText('project-1'));
    expect(seedFromText('a')).not.toBe(seedFromText('b'));
  });
});

describe('mapa', () => {
  const presets = Object.keys(MAP_PRESETS) as MapPresetId[];

  it.each(presets)('%s: to samo ziarno daje identyczną mapę', (p) => {
    const a = generateMap(42, p), b = generateMap(42, p);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.elevation).toEqual(b.elevation);
    expect(a.starts).toEqual(b.starts);
  });

  it('różne ziarna dają różne mapy', () => {
    expect(generateMap(1).tiles).not.toEqual(generateMap(2).tiles);
  });

  it.each(presets)('%s: mapa jest symetryczna środkowo, więc drużyny mają równe szanse', (p) => {
    for (const seed of [1, 7, 99, 2026]) {
      const m = generateMap(seed, p);
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++)
          expect(tileAt(m, x, y)).toBe(tileAt(m, m.width - 1 - x, m.height - 1 - y));
    }
  });

  it.each(presets)('%s: właściwa liczba graczy, każdy startuje na łące w granicach mapy', (p) => {
    const m = generateMap(5, p);
    expect(m.starts.length).toBe(MAP_PRESETS[p].starts.length * 2);
    expect(m.starts.filter((s) => s.team === 0).length).toBe(m.starts.length / 2);
    for (const s of m.starts) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(m.width);
      expect(tileAt(m, s.x, s.y)).toBe(Terrain.Grass);
    }
  });

  it('obie drużyny mają tyle samo każdego surowca', () => {
    const m = generateMap(314, '2v2');
    const count = (t: Terrain, half: 0 | 1): number => {
      let n = 0;
      const total = m.width * m.height;
      for (let i = 0; i < total; i++) if ((i < total / 2 ? 0 : 1) === half && m.tiles[i] === t) n++;
      return n;
    };
    for (const t of [Terrain.Forest, Terrain.Stone, Terrain.Iron]) {
      expect(count(t, 0)).toBe(count(t, 1));
      expect(count(t, 0)).toBeGreaterThan(0);
    }
  });
});

describe('determinizm symulacji', () => {
  it('te same komendy dają ten sam skrót stanu po 10 000 ticków', () => {
    const run = (): number => {
      const g = createGame(777, '1v1');
      for (let i = 0; i < 10_000; i++) step(g, i % 3 === 0 ? [{ type: 'noop', player: i % 2 }] : []);
      return stateHash(g);
    };
    expect(run()).toBe(run());
  });

  it('skrót zależy od ziarna i od numeru ticka', () => {
    const a = createGame(1), b = createGame(2);
    expect(stateHash(a)).not.toBe(stateHash(b));
    const before = stateHash(a);
    step(a, []);
    expect(stateHash(a)).not.toBe(before);
  });
});

import { describe, expect, it } from 'vitest';
import level from '../src/render/models/minelevel.json';
import { BUILDINGS } from '../src/data/buildings';
import { CLIMB_S, mineGate, mineRoutes, poseOnRoute, routeTime, type MineLevelData } from '../src/render/minepath';

const M = level as unknown as MineLevelData & { spots: [number, number, number][]; spots2: [number, number, number][]; low: number };
const spots: [number, number, number, number][] = [
  ...M.spots.map(([x, z, r]) => [x, 0, z, r] as [number, number, number, number]),
  ...M.spots2.map(([x, z, r]) => [x, M.low, z, r] as [number, number, number, number]),
];
const walkS = (BUILDINGS.find((b) => b.id === 'oremine')!.production!.walkTicks ?? 0) / 10;
const inRooms = (rooms: number[][], x: number, z: number): boolean => rooms.some((r) => x >= r[0]! - 0.01 && x <= r[1]! + 0.01 && z >= r[2]! - 0.01 && z <= r[3]! + 0.01);

describe('drogi kopaczy w sztolni', () => {
  const routes = mineRoutes(M, spots);
  it('każdy przodek ma drogę od wrót, a cała droga biegnie salami', () => {
    const gate = mineGate(M);
    routes.forEach((r, i) => {
      expect(r.top[0]).toEqual(gate);
      const end = (r.low ?? r.top).at(-1)!;
      expect(end[0]).toBeCloseTo(spots[i]![0]); expect(end[1]).toBeCloseTo(spots[i]![2]);
      expect(!!r.low).toBe(spots[i]![1] !== 0);
      for (const [x, z] of r.top) expect(inRooms(M.rooms, x, z), `${i} top ${x},${z}`).toBe(true);
      for (const [x, z] of r.low ?? []) expect(inRooms(M.rooms2!, x, z), `${i} low ${x},${z}`).toBe(true);
      // drogi nie skaczą przez ściany: odcinek pomiędzy punktami też leży w salach
      for (const [pts, rooms] of [[r.top, M.rooms], [r.low ?? [], M.rooms2!]] as const)
        for (let k = 1; k < pts.length; k++)
          for (let s = 0; s <= 10; s++) {
            const x = pts[k - 1]![0] + (pts[k]![0] - pts[k - 1]![0]) * s / 10, z = pts[k - 1]![1] + (pts[k]![1] - pts[k - 1]![1]) * s / 10;
            expect(inRooms(rooms as number[][], x, z), `${i} seg ${x},${z}`).toBe(true);
          }
    });
  });
  it('dojście mieści się w czasie z symulacji i kończy przy przodku', () => {
    expect(walkS).toBeGreaterThan(0);
    for (const r of routes) {
      const rt = routeTime(r, walkS);
      expect(rt.walk).toBeLessThanOrEqual(walkS + 0.01);
      const end = poseOnRoute(r, rt.speed, rt.walk, M.low, M.hole, false);
      expect(end.moving).toBe(false);
      if (r.low) {
        const mid = poseOnRoute(r, rt.speed, r.topLen / rt.speed + CLIMB_S / 2, M.low, M.hole, false);
        expect(mid.climbing).toBe(true);
      }
    }
  });
});

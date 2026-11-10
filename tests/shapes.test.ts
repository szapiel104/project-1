import { describe, expect, it } from 'vitest';
import { SHAPES, unitShape } from '../src/render/shapes';

// objętość ze znakiem (twierdzenie o dywergencji): dodatnia = trójkąty zwrócone na zewnątrz (gra nie rysuje tylnych ścian)
const volume = (P: number[]): number => {
  let v = 0;
  for (let t = 0; t < P.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = P.slice(t, t + 9) as number[] as [number, number, number, number, number, number, number, number, number];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
};

describe('bryły edytora modeli (shapes.ts)', () => {
  for (const s of SHAPES) {
    it(`${s}: zamknięta, zwrócona na zewnątrz, mieści się w sześcianie 1×1×1`, () => {
      const P = unitShape(s);
      expect(P.length % 9).toBe(0);
      expect(Math.max(...P.map(Math.abs))).toBeLessThanOrEqual(0.5 + 1e-6);
      const v = volume(P);
      expect(v).toBeGreaterThan(0.05);
      expect(v).toBeLessThanOrEqual(1.0001);
    });
  }
});

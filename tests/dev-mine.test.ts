import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { createGame } from '../src/sim/state';
import { rockBehind } from '../src/sim/systems/placement';
import { mineNear } from '../src/sim/systems/minecamp';

// Tryb deweloperski stawia przy twierdzy wszystkie budynki naraz; kopalnia ma przy tym stać tyłem do skały
// (jak w zwykłej grze), a nie na trawie w zamku. Barak górników stoi przy kopalni.
describe('kopalnia w trybie deweloperskim', () => {
  for (const seed of [1, 2, 3, 6]) {
    it(`ziarno ${seed}: kopalnia pod górą, barak obok niej`, () => {
      const g = createGame(seed, '1v1', 2, true);
      expect(g.buildings.some((b) => BUILDINGS[b.type]!.needsRock)).toBe(true);
      for (const b of g.buildings) {
        const d = BUILDINGS[b.type]!;
        if (!d.needsRock) continue;
        const rot = (b as { rot?: number }).rot ?? 0;
        const fw = rot % 2 ? d.h : d.w, fh = rot % 2 ? d.w : d.h;
        expect(rockBehind(g, b.x, b.y, fw, fh, rot)).toBe(true);
        for (const c of g.buildings.filter((o) => o.owner === b.owner && BUILDINGS[o.type]!.requires === d.id))
          expect(mineNear(g, c.owner, c.x, c.y, BUILDINGS[c.type]!.w, BUILDINGS[c.type]!.h)).toBe(true);
      }
    });
  }
});

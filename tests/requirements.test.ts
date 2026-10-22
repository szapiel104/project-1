import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingIndex } from '../src/data/buildings';
import { resIndex } from '../src/data/resources';
import { RULES } from '../src/data/rules';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { createGame as realGame, playerKeep, type GameState } from '../src/sim/state';
import { canPlace, missingRequirement, placeBuilding } from '../src/sim/systems/placement';

/** Drzewko budowy: piekarnia przy młynie, koszary przy zbrojowni, karczma przy browarze, barak przy kopalni */
const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } return g; };

function spot(g: GameState, id: string): { x: number; y: number } | null {
  const keep = playerKeep(g, 0)!;
  const type = buildingIndex(id);
  for (let r = 3; r < RULES.buildRadius; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (canPlace(g, 0, type, keep.x + dx, keep.y + dy, false) === null) return { x: keep.x + dx, y: keep.y + dy };
  return null;
}

describe('drzewko budowy', () => {
  it('wymagania wskazują istniejące budynki do postawienia', () => {
    const req = Object.fromEntries(BUILDINGS.filter((d) => d.requires).map((d) => [d.id, d.requires]));
    expect(req).toEqual({ bakery: 'mill', barracks: 'armory', tavern: 'brewery', minecamp: 'oremine', smithy: 'oremine' });
    for (const d of BUILDINGS) if (d.requires) {
      const need = BUILDINGS[buildingIndex(d.requires)]!;
      expect(need.buildable && !need.legacy).toBe(true);
    }
    for (const k of ['place.needs', 'hud.needs', 'hud.needsBuilding'] as const) {
      expect(pl[k]).toContain('{b}');
      expect(en[k]).toContain('{b}');
    }
  });

  it('piekarnia czeka na gotowy młyn; młyn w budowie albo zburzony się nie liczy', () => {
    const g = createGame(5);
    const p = g.players[0]!;
    p.res[resIndex('wood')] = 500; p.res[resIndex('stone')] = 500;
    const bakery = buildingIndex('bakery'), bdef = BUILDINGS[bakery]!;
    const keep = playerKeep(g, 0)!;
    expect(canPlace(g, 0, bakery, keep.x, keep.y + 14, false)).toBe('place.needs');
    expect(missingRequirement(g, 0, bdef)).toEqual({ need: 'mill', building: false });
    const at = spot(g, 'mill')!;
    expect(placeBuilding(g, 0, buildingIndex('mill'), at.x, at.y)).toBe(true);
    const mill = g.buildings.find((b) => b.type === buildingIndex('mill'))!;
    expect(missingRequirement(g, 0, bdef)).toEqual({ need: 'mill', building: true });
    expect(spot(g, 'bakery')).toBeNull();
    mill.build = 0;
    expect(missingRequirement(g, 0, bdef)).toBeNull();
    expect(spot(g, 'bakery')).not.toBeNull();
    // młyn wroga nie pomaga, zburzony własny też nie
    expect(missingRequirement(g, 1, bdef)).not.toBeNull();
    mill.ruined = true;
    expect(missingRequirement(g, 0, bdef)).toEqual({ need: 'mill', building: false });
  });

  it('budynki bez wymagań stawia się jak dotąd', () => {
    const g = createGame(7);
    for (const d of BUILDINGS) if (d.buildable && !d.legacy && !d.requires) expect(missingRequirement(g, 0, d)).toBeNull();
  });
});

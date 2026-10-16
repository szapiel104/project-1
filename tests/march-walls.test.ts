import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { createGame as realGame, playerKeep, type GameState } from '../src/sim/state';
import { walkable, wallBetween } from '../src/sim/path';
import { WALL_TOP } from '../src/data/keep';
import { step } from '../src/sim/step';

/** Mapa deweloperska: wojsko wokół twierdzy, mur z bramami dookoła miasta */
const createGame = (...a: Parameters<typeof realGame>): GameState => { const g = realGame(...a); for (const p of g.players) p.bot = false; return g; };

describe('marsz całego wojska spod twierdzy', () => {
  it('nikt nie przechodzi przez ściany zamku ani mur — wychodzą bramą', () => {
    for (const seed of [3, 11, 29]) {
      const g = createGame(seed, '1v1', 2, true);
      const W = g.map.width;
      const keep = playerKeep(g, 0)!;
      const ids = g.soldiers.filter((s) => s.owner === 0).map((s) => s.id); // całe wojsko, z łucznikami na wieżach
      expect(ids.length).toBeGreaterThan(10);
      // cel: daleko za murem miasta, na wolnym polu przed bramą zamku (droga prosto przez zamek kusi szyk)
      let target = -1;
      for (let r = 0; r < 20 && target < 0; r++) for (let dx = -r; dx <= r && target < 0; dx++) {
        const x = keep.x + 5 + dx, y = keep.y + 11 + 16 + r;
        if (x > 0 && y > 0 && walkable(g, y * W + x, 0) && !g.walls[y * W + x]) target = y * W + x;
      }
      expect(target, `seed ${seed}`).toBeGreaterThan(0);
      step(g, [{ type: 'move', player: 0, ids, x: target % W, y: Math.floor(target / W) }]);
      const last = new Map<number, number>();
      for (const s of g.soldiers) last.set(s.id, s.up ? -1 : (s.py >> 8) * W + (s.px >> 8));
      for (let t = 0; t < 900; t++) {
        step(g, []);
        for (const s of g.soldiers) {
          if (s.owner !== 0 || !ids.includes(s.id) || s.up) continue;
          const here = (s.py >> 8) * W + (s.px >> 8), was = last.get(s.id)!;
          last.set(s.id, here);
          if (here === was) continue;
          if (was < 0) { expect(g.walls[here]! & WALL_TOP, `seed ${seed}: łucznik ${s.id} zszedł z wieży na mur (tick ${t})`).toBe(0); continue; }
          const o = g.buildings.find((b) => b.x <= here % W && b.y <= Math.floor(here / W) && here % W < b.x + BUILDINGS[b.type]!.w && Math.floor(here / W) < b.y + BUILDINGS[b.type]!.h && b.type !== 0);
          expect(walkable(g, here, 0), `seed ${seed}: żołnierz ${s.id} wszedł na ${o ? BUILDINGS[o.type]!.id : 'nieprzechodnie pole'} (tick ${t})`).toBe(true);
          const dx = (here % W) - (was % W), dy = Math.floor(here / W) - Math.floor(was / W);
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) expect(wallBetween(g, was, dx, dy), `seed ${seed}: żołnierz ${s.id} przeszedł przez ścianę (tick ${t})`).toBe(false);
          else expect(g.walls[here]! & WALL_TOP, `seed ${seed}: żołnierz ${s.id} pojawił się na murze (tick ${t})`).toBe(0);
        }
      }
    }
  });
});

describe('rozkaz tuż za murem kamiennym', () => {
  it('szyk na ziemi nie dostaje miejsc na koronie muru', () => {
    for (const seed of [3, 11]) {
      const g = createGame(seed, '1v1', 2, true);
      const W = g.map.width;
      const ids = g.soldiers.filter((s) => s.owner === 0 && !s.up).map((s) => s.id);
      // pole na ziemi przylegające do korony muru kamiennego (z dowolnej strony)
      let target = -1;
      for (let t = W; t < g.map.tiles.length - W && target < 0; t++)
        if ((g.walls[t]! & WALL_TOP) && g.occupancy[t] && !(g.walls[t + W]! & WALL_TOP) && walkable(g, t + W, 0) && !g.occupancy[t + W]) target = t + W;
      expect(target).toBeGreaterThan(0);
      step(g, [{ type: 'move', player: 0, ids, x: target % W, y: Math.floor(target / W) }]);
      for (const s of g.soldiers) if (ids.includes(s.id)) expect(g.walls[s.goal]! & WALL_TOP, `seed ${seed}: żołnierz ${s.id} dostał miejsce na murze`).toBe(0);
    }
  });
});

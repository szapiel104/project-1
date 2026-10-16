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

describe('marsz w szyku wzdłuż muru kamiennego', () => {
  it('nikt nie wchodzi po drabinie na mur po drodze', () => {
    for (const seed of [3, 11, 29]) {
      const g = createGame(seed, '1v1', 2, true);
      const W = g.map.width;
      // drabina na murze (od środka miasta): oddział stawiamy obok niej i każemy iść wzdłuż muru
      const ladder = g.buildings.find((b) => b.owner === 0 && BUILDINGS[b.type]!.id === 'ladder')!;
      const along = (g.walls[ladder.y * W + ladder.x - 1]! & WALL_TOP) || (g.walls[ladder.y * W + ladder.x + 1]! & WALL_TOP) ? [0, 1] : [1, 0];
      const ids = g.soldiers.filter((s) => s.owner === 0 && !s.up).slice(0, 12).map((s) => s.id);
      // ustawiamy ich ciasno przy drabinie, po stronie miasta
      let k = 0;
      for (const s of g.soldiers) if (ids.includes(s.id)) {
        for (let r = 1; r < 8; r++) {
          let done = false;
          for (let d = -r; d <= r && !done; d++) {
            const x = ladder.x + along[0]! * d + along[1]! * ((k % 3) + 1) * 0, y = ladder.y + along[1]! * d;
            const t = y * W + x;
            if (walkable(g, t, 0) && !(g.walls[t]! & WALL_TOP) && !g.soldiers.some((o) => (o.py >> 8) * W + (o.px >> 8) === t)) { s.px = x * 256 + 128; s.py = y * 256 + 128; s.path = []; s.goal = -1; done = true; }
          }
          if (done) break;
        }
        k++;
      }
      for (const dir of [1, -1]) {
        let target = -1;
        for (let d = 10; d < 20 && target < 0; d++) { const t = (ladder.y + along[1]! * d * dir) * W + ladder.x + along[0]! * d * dir; if (walkable(g, t, 0) && !(g.walls[t]! & WALL_TOP) && !g.occupancy[t]) target = t; }
        if (target < 0) continue;
        step(g, [{ type: 'move', player: 0, ids, x: target % W, y: Math.floor(target / W) }]);
        for (let t = 0; t < 500; t++) {
          step(g, []);
          for (const s of g.soldiers) if (ids.includes(s.id) && !s.up) expect(g.walls[(s.py >> 8) * W + (s.px >> 8)]! & WALL_TOP, `seed ${seed}: żołnierz ${s.id} wszedł na mur (tick ${t})`).toBe(0);
        }
      }
    }
  });
});

describe('pościg za wilkiem za murem', () => {
  it('żołnierz nie wchodzi po drabinie na mur nad wilkiem, tylko obchodzi bramą', () => {
    let tried = 0;
    for (const seed of [3, 11, 29, 41]) {
      const g = createGame(seed, '1v1', 2, true);
      step(g, []); // korony murów i drabiny dostają bity ścian w pierwszym ticku
      const W = g.map.width;
      for (const ladder of g.buildings.filter((b) => b.owner === 0 && BUILDINGS[b.type]!.id === 'ladder')) {
        // mur obok drabiny i pole za nim (na zewnątrz)
        const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
        const side = sides.find(([dx, dy]) => (g.walls[(ladder.y + dy) * W + ladder.x + dx]! & WALL_TOP) !== 0);
        if (!side) continue;
        let out = -1;
        for (const lat of [0, 1, -1, 2, -2, 3, -3]) {
          const t = (ladder.y + side[1] * 2 + side[0] * lat) * W + ladder.x + side[0] * 2 + side[1] * lat;
          if (walkable(g, t, 0) && !g.occupancy[t] && !(g.walls[t]! & WALL_TOP)) { out = t; break; }
        }
        if (out < 0) continue;
        const inside = (ladder.y - side[1]) * W + ladder.x - side[0];
        if (!walkable(g, inside, 0)) continue;
        tried++;
        const s = g.soldiers.find((x) => x.owner === 0 && !x.up && !x.post)!;
        s.px = (inside % W) * 256 + 128; s.py = Math.floor(inside / W) * 256 + 128; s.path = []; s.goal = -1; s.target = 0;
        g.wolves.push({ id: 99000 + tried, px: (out % W) * 256 + 128, py: Math.floor(out / W) * 256 + 128, hp: 45, path: [], target: 0, cd: 0, leaving: false });
        for (let t = 0; t < 400; t++) {
          step(g, []);
          expect(g.walls[(s.py >> 8) * W + (s.px >> 8)]! & WALL_TOP, `seed ${seed}: żołnierz wszedł na mur, goniąc wilka (tick ${t})`).toBe(0);
        }
        break;
      }
    }
    expect(tried).toBeGreaterThan(0);
  });
});

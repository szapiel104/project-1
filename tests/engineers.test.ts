import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { walkable } from '../src/sim/path';
import { addPeasants, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame as realGame, Phase, playerKeep, type Building, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { engineerJob } from '../src/sim/systems/army';
import { maxHp, ruin } from '../src/sim/systems/placement';
import { crewOf, crewWanted } from '../src/sim/systems/workers';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; return g; };

/** Wolny prostokąt w × h co najmniej `min` pól od twierdzy gracza 0 */
function openArea(g: GameState, w: number, h: number, min: number): { x: number; y: number } {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = min; r < 60; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x0 = keep.x + dx, y0 = keep.y + dy;
        let ok = x0 > 1 && y0 > 1 && x0 + w < W - 1 && y0 + h < g.map.height - 1;
        for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, 0) || g.occupancy[y * W + x]) ok = false;
        if (ok) return { x: x0, y: y0 };
      }
  throw new Error('brak wolnego miejsca');
}

function setup(): { g: GameState; guild: Building; a: Building; b: Building } {
  const g = createGame(7);
  const p = openArea(g, 10, 6, 14);
  const put = (id: string, x: number): Building => { const n = placeReady(g, id, x, p.y); return g.buildings.find((o) => o.id === n)!; };
  const guild = put('engineers', p.x), a = put('house', p.x + 4), b = put('house', p.x + 7);
  expect(guild && a && b).toBeTruthy();
  addPeasants(g, 20); setHour(g, 8);
  return { g, guild, a, b };
}

describe('cech inżynierów', () => {
  it('załoga cechu rośnie z liczbą mieszkańców', () => {
    const { g, guild } = setup();
    const def = BUILDINGS[guild.type]!;
    for (let i = 0; i < 600; i++) step(g, []);
    const pop = g.units.filter((u) => u.owner === 0).length;
    expect(crewWanted(def, pop)).toBeGreaterThan(1);
    expect(crewOf(guild).length).toBe(crewWanted(def, pop));
  });

  it('kilku inżynierów łata różne budynki naraz', () => {
    const { g, guild, a, b } = setup();
    for (let i = 0; i < 600; i++) step(g, []);
    a.hp = 20; b.hp = 20;
    let both = false;
    for (let i = 0; i < 4000 && (a.hp < maxHp(a.type) || b.hp < maxHp(b.type)); i++) {
      step(g, []);
      const targets = crewOf(guild).map((id) => g.units.find((u) => u.id === id)?.target);
      if (targets.includes(a.id) && targets.includes(b.id)) both = true;
    }
    expect(both).toBe(true);
    expect(a.hp).toBe(maxHp(a.type));
    expect(b.hp).toBe(maxHp(b.type));
  });

  it('odbudowują ruinę w swoim zasięgu, a dalekich budynków nie ruszają', () => {
    const { g, guild, a } = setup();
    for (let i = 0; i < 600; i++) step(g, []);
    ruin(g, a);
    expect(a.ruined).toBe(true);
    expect(engineerJob(g, guild, a)).toBe(true);
    // ta sama chata daleko poza zasięgiem cechu
    expect(engineerJob(g, guild, { ...a, x: guild.x + 60 })).toBe(false);
    let engineerOnRuin = false;
    for (let i = 0; i < 6000 && a.ruined; i++) {
      step(g, []);
      if (crewOf(guild).some((id) => { const u = g.units.find((x) => x.id === id); return u?.target === a.id && (u.phase === Phase.Repairing || u.phase === Phase.ToRepair || u.phase === Phase.ToFetch); })) engineerOnRuin = true;
    }
    expect(engineerOnRuin).toBe(true);
    expect(a.ruined).toBeFalsy();
  });
});

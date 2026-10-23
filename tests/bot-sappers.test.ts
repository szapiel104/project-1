import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { RESOURCE_DEFS, resIndex } from '../src/data/resources';
import { SAPPER, unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { addPeasants, placeReady, setHour } from '../src/sim/emptyscene';
import { createGame, FP, playerKeep, storeUsed, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { ruin } from '../src/sim/systems/placement';

/** Wolny prostokąt w × h co najmniej `min` pól od twierdzy gracza `owner` */
function openArea(g: GameState, owner: number, w: number, h: number, min: number): { x: number; y: number } {
  const keep = playerKeep(g, owner)!, W = g.map.width;
  for (let r = min; r < 60; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x0 = keep.x + dx, y0 = keep.y + dy;
        let ok = x0 > 1 && y0 > 1 && x0 + w < W - 1 && y0 + h < g.map.height - 1;
        for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, owner) || g.occupancy[y * W + x]) ok = false;
        if (ok) return { x: x0, y: y0 };
      }
  throw new Error('brak wolnego miejsca');
}

const soldier = (g: GameState, owner: number, kind: number, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind, px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};

/** Gra: gracz 1 to bot (bez fal), obok jego twierdzy ruina chaty gracza 0 */
function setup(): { g: GameState; ruinId: number; at: { x: number; y: number } } {
  const g = createGame(7);
  for (const p of g.players) { p.guards = 0; p.level = 0; }
  g.soldiers = [];
  setHour(g, 9);
  const at = openArea(g, 1, 4, 4, 14);
  const id = placeReady(g, 'house', at.x, at.y, 0, 0)!;
  const house = g.buildings.find((b) => b.id === id)!;
  ruin(g, house);
  return { g, ruinId: id, at };
}

describe('bot i saperzy', () => {
  it('bot z wojskiem szkoli sapera, gdy ma żelazo i zapas rudy', () => {
    const { g } = setup();
    const keep = playerKeep(g, 1)!;
    const at = openArea(g, 1, 4, 4, 8);
    expect(placeReady(g, 'barracks', at.x, at.y, 0, 1)).toBeTruthy();
    for (let i = 0; i < 6; i++) soldier(g, 1, unitIndex('spearman'), keep.x + 5 + i, keep.y + 14);
    const p = g.players[1]!;
    p.res[resIndex('iron')] = 20; p.res[resIndex('gold')] = 200; p.res[resIndex('spear')] = 0; p.res[resIndex('bow')] = 0;
    addPeasants(g, 4, 1);
    let trained = false;
    for (let i = 0; i < 3000 && !trained; i++) { step(g, []); trained = g.soldiers.some((s) => s.owner === 1 && s.kind === SAPPER) || g.units.some((u) => u.owner === 1 && u.enlist === SAPPER + 1) || g.buildings.some((b) => b.owner === 1 && b.enlistQ?.some((q) => q.k === SAPPER)); }
    expect(trained).toBe(true);
  });

  it('wolny saper bota sam idzie rozebrać ruinę wroga', () => {
    const { g, ruinId } = setup();
    const keep = playerKeep(g, 1)!;
    const s = soldier(g, 1, SAPPER, keep.x + 5, keep.y + 13);
    let sent = false;
    for (let i = 0; i < 400 && !sent; i++) { step(g, []); sent = s.target === ruinId || !!s.loot; }
    expect(sent).toBe(true);
  });

  it('saper nie idzie do ruiny, przy której wróg ma przewagę', () => {
    const { g, ruinId, at } = setup();
    const keep = playerKeep(g, 1)!;
    const s = soldier(g, 1, SAPPER, keep.x + 5, keep.y + 13);
    // trzech włóczników gracza 0 pilnuje ruiny (stoją w miejscu)
    for (let i = 0; i < 3; i++) { const w = soldier(g, 0, unitIndex('spearman'), at.x + i, at.y + 5); w.hold = (at.y + 5) * g.map.width + at.x + i; }
    for (let i = 0; i < 400; i++) { step(g, []); for (const o of g.soldiers) if (o.owner === 0) { o.path = []; o.goal = -1; o.target = 0; } }
    expect(s.target).not.toBe(ruinId);
  });

  it('saperzy nie idą z falą ani na wypady (fala liczy tylko wojsko do walki)', () => {
    const { g } = setup();
    const keep = playerKeep(g, 1)!;
    const s = soldier(g, 1, SAPPER, keep.x + 5, keep.y + 13);
    g.buildings = g.buildings.filter((b) => !b.ruined); // bez ruin: saper nie ma roboty
    g.players[1]!.level = 3;
    g.tick = 12600 - 50; // tuż przed drugą falą na najtrudniejszym poziomie (9000 + 3600)
    for (let i = 0; i < 30; i++) soldier(g, 1, unitIndex('spearman'), keep.x + 3 + (i % 10), keep.y + 14 + Math.floor(i / 10));
    for (let i = 0; i < 120; i++) step(g, []);
    expect(g.soldiers.some((o) => o.owner === 1 && o.kind !== SAPPER && o.goal >= 0) || g.soldiers.some((o) => o.owner === 1 && o.kind !== SAPPER && o.path.length)).toBe(true);
    expect(s.goal).toBe(-1);
  });
});

describe('zboże w spichlerzu', () => {
  it('pszenica i mąka leżą w spichlerzu, ale nie są jedzeniem', () => {
    for (const r of ['wheat', 'flour'] as const) {
      expect(RESOURCE_DEFS[r].store).toBe('granary');
      expect(RESOURCE_DEFS[r].food).toBeFalsy();
    }
  });

  it('farma odnosi pszenicę do spichlerza, a młyn bierze ją stamtąd i mieli', () => {
    const g = createGame(7);
    for (const p of g.players) { p.bot = false; p.guards = 0; }
    g.soldiers = [];
    setHour(g, 7);
    const p = g.players[0]!;
    const a = openArea(g, 0, 7, 3, 12);
    expect(placeReady(g, 'farm', a.x, a.y)).toBeTruthy();
    expect(placeReady(g, 'mill', a.x + 4, a.y)).toBeTruthy();
    addPeasants(g, 6);
    const grainBefore = storeUsed(p, 'granary');
    const stockBefore = storeUsed(p, 'stockpile');
    for (let i = 0; i < 6000 && !p.res[resIndex('flour')]; i++) step(g, []);
    expect(p.res[resIndex('flour')]).toBeGreaterThan(0);
    // zboże liczy się do spichlerza, nie do składu
    expect(storeUsed(p, 'stockpile')).toBeLessThanOrEqual(stockBefore);
    expect(storeUsed(p, 'granary')).toBeGreaterThanOrEqual(grainBefore - 100);
    expect(BUILDINGS.find((b) => b.id === 'granary')!.stores).toContain('granary');
  });
});

import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/data/terrain';
import { BUILDINGS } from '../src/data/buildings';
import { createGame, playerKeep } from '../src/sim/state';
import { step } from '../src/sim/step';
import { addPeasants, emptyScene, placeReady } from '../src/sim/emptyscene';
import { maxHp } from '../src/sim/systems/placement';

describe('gaszenie (30.10.2026)', () => {
  it('pracownik płonącego warsztatu rzuca robotę i gasi', () => {
    const g = createGame(5); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, dx = k.door % w, dy = (k.door - dx) / w;
    expect(placeReady(g, 'well', dx + 3, dy + 4)).toBeTruthy();
    const shop = placeReady(g, 'woodcutter', dx - 4, dy + 5)!;
    addPeasants(g, 4);
    for (let i = 0; i < 300 && !g.buildings.find((b) => b.id === shop)!.worker; i++) step(g, []);
    const b = g.buildings.find((x) => x.id === shop)!;
    expect(b.worker).toBeGreaterThan(0);
    b.hp = Math.floor(maxHp(b.type) * 0.5); step(g, []);
    expect(b.fire ?? 0).toBeGreaterThan(0);
    let worked = false;
    for (let i = 0; i < 40 && !worked; i++) { step(g, []); worked = g.units.some((u) => u.id === b.worker && u.bucket && u.fireAt === b.id); }
    expect(worked).toBe(true);
  });

  it('bez studni czerpią wodę z jeziora', () => {
    const g = createGame(7, '1v1', 2, true);
    for (const p of g.players) p.bot = false;
    const w = g.map.width, h = g.map.height, k = playerKeep(g, 0)!, kx = k.door % w, ky = (k.door - kx) / w;
    // dom przy twierdzy (tam są ludzie), możliwie najbliżej wody
    const water: number[] = [];
    for (let t = 0; t < w * h; t++) if (g.map.tiles[t] === Terrain.Water) water.push(t);
    const toWater = (x: number, y: number): number => Math.min(...water.map((t) => Math.hypot((t % w) - x, Math.floor(t / w) - y)));
    let house = 0, best = Infinity, spot: [number, number] | null = null;
    for (let y = ky - 14; y <= ky + 14; y++) for (let x = kx - 14; x <= kx + 14; x++) { const d = toWater(x, y); if (d < best && Math.hypot(x - kx, y - ky) > 5) { best = d; spot = [x, y]; } }
    expect(best).toBeLessThan(35);
    for (let r = 0; r < 6 && !house; r++) for (let dy = -r; dy <= r && !house; dy++) for (let dx = -r; dx <= r && !house; dx++) house = placeReady(g, 'house', spot![0] + dx, spot![1] + dy) ?? 0;
    expect(house).toBeGreaterThan(0);
    const hb = g.buildings.find((x) => x.id === house)!;
    addPeasants(g, 6);
    // sześciu wolnych chłopów tuż przy domu
    for (const u of g.units.slice(-6)) { u.px = (hb.x + 3) * 256 + 128; u.py = (hb.y + 3) * 256 + 128; u.path = []; }
    for (const b of g.buildings) if (b.owner === 0 && b.id !== hb.id && b.type !== 0) b.off = true;   // warsztaty bez obsady: ludzie zostają wolni
    // bez studni i cechu inżynierów (też daje wodę): zostaje tylko jezioro
    g.buildings = g.buildings.filter((b) => !(b.owner === 0 && ['well', 'engineers'].includes(BUILDINGS[b.type]!.id)));
    for (let i = 0; i < 20; i++) step(g, []);
    hb.hp = Math.floor(maxHp(hb.type) * 0.5); hb.fire = 400; step(g, []);
    let fromLake = false;
    for (let i = 0; i < 400 && !fromLake; i++) { step(g, []); fromLake = g.units.some((u) => u.bucket && u.fireAt === hb.id && (u.waterAt ?? 0) > 0); }
    expect(fromLake).toBe(true);
  });
});

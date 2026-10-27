import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { addWolf } from '../src/sim/emptyscene';
import { createGame, FP, playerKeep } from '../src/sim/state';
import type { TerrainView } from '../src/render/terrain';
import { CrowLayer } from '../src/render/crows';
import { ForestEyes } from '../src/render/foresteyes';
import { PuddleLayer } from '../src/render/puddles';
import { SpawnFx } from '../src/render/spawnfx';
import { BUILDINGS } from '../src/data/buildings';
import { placeReady } from '../src/sim/emptyscene';

// atrapa płótna: iskry i „+1” rysuje się na <canvas>, a testy biegną bez przeglądarki
const noop = new Proxy({}, { get: () => () => ({ addColorStop: () => undefined }), set: () => true });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => noop }), createElementNS: () => ({ style: {}, addEventListener: () => undefined, removeEventListener: () => undefined }) };

const view = { heightAt: () => 0 } as unknown as TerrainView;
const instanced = (scene: THREE.Scene): THREE.InstancedMesh[] => scene.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh);

describe('części obrazu wyniesione z scene.ts', () => {
  it('kruki siadają na ciałach, a spłoszone krążą', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    for (let i = 0; i < 3; i++) g.corpses.push({ id: 500 + i, kind: 0, owner: 1, px: (k.x + 20 + i * 2) * FP, py: (k.y + 20) * FP, at: g.tick - 250 } as (typeof g.corpses)[number]);
    const scene = new THREE.Scene(), crows = new CrowLayer(scene);
    crows.sync(g, view, { time: 1, calm: false });
    const stand = instanced(scene)[0]!;
    expect(stand.count).toBeGreaterThan(0);
    // ktoś podchodzi do ciał: kruki się zrywają (siedzących ubywa)
    const before = stand.count;
    g.units[0]!.px = g.corpses[0]!.px; g.units[0]!.py = g.corpses[0]!.py;
    crows.sync(g, view, { time: 2, calm: false });
    expect(stand.count).toBeLessThan(before);
  });

  it('kruki po chwili odlatują: nad starym ciałem już ich nie ma', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    g.tick = 2000;
    g.corpses.push({ id: 600, kind: 0, owner: 1, px: (k.x + 20) * FP, py: (k.y + 20) * FP, at: g.tick - 1000 } as (typeof g.corpses)[number]);
    const scene = new THREE.Scene(), crows = new CrowLayer(scene);
    crows.sync(g, view, { time: 1, calm: false });
    expect(instanced(scene).reduce((n, m) => n + m.count, 0)).toBe(0);
  });

  it('oczy w puszczy świecą tylko nocą', () => {
    const g = createGame(7);
    addWolf(g, 5, 5);
    const scene = new THREE.Scene(), eyes = new ForestEyes(scene);
    eyes.sync(g, view, { time: 1, calm: false, night: 1 });
    const mesh = instanced(scene)[0]!;
    expect(mesh.visible).toBe(true);
    eyes.sync(g, view, { time: 2, calm: false, night: 0 });
    expect(mesh.visible).toBe(false);
  });

  it('kałuże na drogach gruntowych tylko gdy mokro', () => {
    const g = createGame(7);
    for (let t = 0; t < 60; t++) g.roads[1000 + t] = 1;
    const scene = new THREE.Scene(), puddles = new PuddleLayer(scene);
    puddles.sync(g, view, 0.5, 1);
    const mesh = scene.getObjectByName('kałuże')!;
    expect(mesh.visible).toBe(true);
    expect(puddles.count).toBeGreaterThan(0);
    puddles.sync(g, view, 0, 1);
    expect(mesh.visible).toBe(false);
    // na stromym zboczu woda spływa: kałuż nie ma
    const steep = { heightAt: (x: number) => x * 0.5 } as unknown as TerrainView;
    const scene2 = new THREE.Scene(), p2 = new PuddleLayer(scene2);
    p2.sync(g, steep, 0.5, 1);
    expect(p2.count).toBe(0);
  });

  it('nowy żołnierz przy drzwiach koszar sypie iskrami i pokazuje „+1”', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const id = placeReady(g, 'barracks', k.x + 14, k.y + 2);
    const barracks = g.buildings.find((b) => b.id === id && BUILDINGS[b.type]!.id === 'barracks')!;
    expect(barracks.door).toBeGreaterThanOrEqual(0);
    const scene = new THREE.Scene(), fx = new SpawnFx(scene), cam = new THREE.PerspectiveCamera();
    g.soldiers = [];
    fx.sync(g, view, cam, false); // pierwsza klatka: zapamiętuje, kto już stoi
    const W = g.map.width, door = barracks.door;
    g.soldiers.push({ id: g.nextId++, owner: 0, kind: 0, px: (door % W) * FP + FP / 2, py: Math.floor(door / W) * FP + FP / 2, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 });
    fx.sync(g, view, cam, false);
    expect(instanced(scene)[0]!.count).toBeGreaterThan(0); // iskry
    expect(scene.children.some((c) => (c as THREE.Sprite).isSprite)).toBe(true); // „+1”
    // po nowej grze nie sypie iskrami dla żołnierzy, którzy już stoją
    fx.reset();
    const n = scene.children.length;
    fx.sync(g, view, cam, false);
    expect(scene.children.length).toBeLessThanOrEqual(n);
  });
});

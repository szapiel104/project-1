import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { addWolf } from '../src/sim/emptyscene';
import { createGame, FP, playerKeep } from '../src/sim/state';
import type { TerrainView } from '../src/render/terrain';
import { WolfLayer } from '../src/render/wolves';

// atrapa płótna: znaczki nad wilkami rysuje się na <canvas>, a testy biegną bez przeglądarki
const noop = new Proxy({}, { get: () => () => undefined, set: () => true });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };

describe('wilki w obrazie (src/render/wolves.ts)', () => {
  it('rysuje żywe wilki ze znaczkami i zabitego na boku, a pozycje idą do pasków zdrowia', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    addWolf(g, k.x + 14, k.y + 14);
    addWolf(g, k.x + 16, k.y + 14);
    const w = g.wolves[0]!;
    g.corpses.push({ id: 9999, kind: -2, owner: -1, px: (k.x + 18) * FP, py: (k.y + 14) * FP, at: g.tick } as (typeof g.corpses)[number]);
    const scene = new THREE.Scene();
    const sounds: string[] = [];
    const layer = new WolfLayer(scene, (kind) => sounds.push(kind));
    const view = { heightAt: () => 0 } as unknown as TerrainView;
    w.target = g.units[0]!.id; // poluje — warczy i ma znaczek celu
    layer.sync(g, view, 1, { time: 1, calm: false, night: 0.5, prevPos: new Map() });
    const meshes = scene.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh);
    expect(meshes.length).toBe(5); // tułów, przednie łapy, tylne łapy, ogon, oczy
    expect(meshes[0]!.count).toBe(g.wolves.length + 1); // dwa żywe i jeden zabity
    expect(layer.wolfPos.size).toBe(g.wolves.length);
    expect(scene.children.some((c) => (c as THREE.Sprite).isSprite && c.visible)).toBe(true);
    expect(sounds).toContain('growl');
    // druga klatka bez wilków: wszystko chowa się bez błędów
    g.wolves = []; g.corpses = [];
    layer.sync(g, view, 1, { time: 2, calm: true, night: 0, prevPos: new Map() });
    expect(meshes[0]!.count).toBe(0);
  });
});

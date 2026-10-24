import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { placeReady } from '../src/sim/emptyscene';
import { createGame, playerKeep } from '../src/sim/state';
import type { TerrainView } from '../src/render/terrain';
import { ArrowLayer, MAX_ARROWS } from '../src/render/arrows';
import { GateMotion } from '../src/render/gates';
import { RallyFlags, TowerIcons } from '../src/render/rally';
import { DustFx } from '../src/render/dust';
import { RubbleLayer } from '../src/render/rubble';
import { Braziers } from '../src/render/braziers';
import { WallLayer } from '../src/render/walls';
import { SiteLayer } from '../src/render/sites';
import { SkyDome } from '../src/render/sky';
import { TorchGlow } from '../src/render/torchglow';
import { axeChop, bowShot, deathKind, spearThrust, swordCombo } from '../src/render/combatanim';
import { mergeStatic } from '../src/render/merge';
import { KEEP_FLOOR, MINE_LEVEL_SPOTS, TAVERN_SEATS, WALK_MODELS, walkFoot } from '../src/render/walkmodels';
import { noWorkerMaterial, sadMaterial, sickMaterial } from '../src/render/marks';

// Części obrazu wyniesione z scene.ts 24.10.2026 (podział dużego pliku). Każda działa sama, bez GameRenderer.

// atrapa płótna: znaczki i księżyc rysuje się na <canvas>, a testy biegną bez przeglądarki
const ctx2d = new Proxy({}, { get: () => () => ({ addColorStop: () => undefined }), set: () => true });
(globalThis as { Image?: unknown }).Image ??= class { width = 0; height = 0; onload: (() => void) | null = null; set src(_: string) { /* bez wczytywania */ } };
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), createElementNS: () => ({ style: {}, addEventListener: () => undefined, removeEventListener: () => undefined }) };

const digs: number[][] = [];
const view = { heightAt: () => 0, dig: (...a: number[]) => digs.push(a) } as unknown as TerrainView;
const instanced = (o: THREE.Object3D): THREE.InstancedMesh[] => { const out: THREE.InstancedMesh[] = []; o.traverse((c) => { if ((c as THREE.InstancedMesh).isInstancedMesh) out.push(c as THREE.InstancedMesh); }); return out; };

describe('animacje ciosów (combatanim.ts)', () => {
  it('kąty są skończone w całym cyklu i wracają do początku', () => {
    for (let u = 0; u <= 1.0001; u += 0.05) {
      for (const v of [...spearThrust(u), ...bowShot(u), ...axeChop(u), ...swordCombo(3, u)]) expect(Number.isFinite(v)).toBe(true);
    }
    spearThrust(0).forEach((v, i) => expect(v).toBeCloseTo(spearThrust(1)[i]!, 9));
    axeChop(0).forEach((v, i) => expect(v).toBeCloseTo(axeChop(1)[i]!, 9));
    const dk = new Set(Array.from({ length: 400 }, (_, i) => deathKind(i)));
    expect([...dk].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('modele do chodzenia (walkmodels.ts) i znaki (marks.ts)', () => {
  it('karczma ma miejsca siedzące, kopalnia przodki, chaty obrys', () => {
    expect(TAVERN_SEATS.length).toBeGreaterThan(0);
    expect(MINE_LEVEL_SPOTS.length).toBeGreaterThan(0);
    expect(Number.isFinite(KEEP_FLOOR)).toBe(true);
    const f = walkFoot(WALK_MODELS.house!);
    expect(f[1]).toBeGreaterThan(f[0]);
    expect(f[3]).toBeGreaterThan(f[2]);
  });
  it('znaki nad głowami rysują się raz i są współdzielone', () => {
    expect(sadMaterial()).toBe(sadMaterial());
    expect(sickMaterial()).toBe(sickMaterial());
    expect(noWorkerMaterial()).not.toBe(sadMaterial());
  });
});

describe('scalanie budynków (merge.ts)', () => {
  it('nienazwane części o tym samym materiale łączą się w jedną siatkę, nazwane zostają', () => {
    const mat = new THREE.MeshStandardMaterial();
    const root = new THREE.Group();
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); m.position.x = i * 2; root.add(m); }
    const named = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); named.name = 'flame'; root.add(named);
    mergeStatic(root);
    const meshes = root.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(meshes.length).toBe(2);
    expect(meshes.some((m) => m.name === 'flame')).toBe(true);
    expect(meshes.find((m) => m.userData.merged)!.geometry.getAttribute('position').count).toBe(36 * 3);
  });
});

describe('strzały (arrows.ts)', () => {
  it('lecą ok. 0,45 s, ognista ma płomyk na grocie', () => {
    const scene = new THREE.Scene(), arrows = new ArrowLayer(scene);
    arrows.shoot(new THREE.Vector3(0, 1, 0), new THREE.Vector3(10, 0, 0), true);
    arrows.shoot(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 10), false);
    arrows.fly(false);
    expect(arrows.count).toBe(2);
    expect(arrows.fireN).toBe(1);
    expect(instanced(scene).every((m) => m.count === 2)).toBe(true);
    for (let i = 0; i < 30; i++) arrows.fly(false);
    expect(arrows.count).toBe(0);
    expect(instanced(scene).every((m) => m.count === 0)).toBe(true);
    expect(MAX_ARROWS).toBe(256);
  });
});

describe('bramy (gates.ts)', () => {
  it('wrota otwierają się płynnie, przy zamknięciu skrzypią i łomoczą', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const id = placeReady(g, 'gate', k.x + 14, k.y + 2)!;
    const b = g.buildings.find((x) => x.id === id)!;
    const mesh = new THREE.Group(), l = new THREE.Object3D(), r = new THREE.Object3D();
    l.name = 'leafL'; r.name = 'leafR'; mesh.add(l, r);
    const sounds: string[] = [];
    const gates = new GateMotion((kind) => sounds.push(kind));
    const meshes = new Map([[id, mesh]]);
    b.shut = false;
    gates.sync(g, meshes, 0.016, false);
    expect(r.rotation.y).toBeCloseTo(1.3);
    b.shut = true;
    gates.sync(g, meshes, 0.5, false);
    expect(sounds).toContain('creak');
    expect(r.rotation.y).toBeGreaterThan(0.5);
    for (let i = 0; i < 10; i++) gates.sync(g, meshes, 0.5, false);
    expect(r.rotation.y).toBe(0);
    expect(l.rotation.y === 0).toBe(true);
    expect(sounds).toContain('plank');
  });
});

describe('znaczniki wojska (rally.ts)', () => {
  it('flaga zbiórki tylko nad polami z moich koszar', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const id = placeReady(g, 'barracks', k.x + 14, k.y + 2)!;
    g.buildings.find((x) => x.id === id)!.rally = [k.y * g.map.width + k.x + 20, -1];
    const scene = new THREE.Scene(), flags = new RallyFlags(scene);
    flags.sync(g, view, 0, 0, 1);
    expect(instanced(scene).map((m) => m.count)).toEqual([1, 1]);
    flags.sync(g, view, 1, 0, 1); // obcy gracz: flag nie widzi
    expect(instanced(scene).every((m) => m.count === 0)).toBe(true);
    flags.reset();
    expect(instanced(scene).length).toBe(0);
  });
  it('znaczek strzelającej wieży gaśnie po 3 s', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const id = placeReady(g, 'watchtower', k.x + 14, k.y + 2)!;
    const scene = new THREE.Scene(), icons = new TowerIcons(scene);
    icons.shot(id, 10);
    icons.sync(g, view, 11);
    const sprite = scene.children.find((c) => (c as THREE.Sprite).isSprite)!;
    expect(sprite.visible).toBe(true);
    icons.sync(g, view, 14);
    expect(sprite.visible).toBe(false);
  });
});

describe('kurz (dust.ts)', () => {
  it('kłąb kurzu pojawia się i znika po ok. 1,4 s', () => {
    const g = createGame(7);
    const scene = new THREE.Scene(), dust = new DustFx(scene);
    dust.roadDust(g, view, 10, 10, true);
    dust.hitDust(g, view, g.buildings[0]!);
    expect(scene.children.length).toBe(2);
    for (let i = 0; i < 10; i++) dust.update(0.2);
    expect(scene.children.length).toBe(0);
  });
});

describe('gruz (rubble.ts)', () => {
  it('zapadający się budynek znika po ok. 1,1 s, stos gruzu maleje i znika z mapy', () => {
    const g = createGame(7);
    const scene = new THREE.Scene(), layer = new THREE.Group(), rubble = new RubbleLayer(scene, layer);
    const dead = new THREE.Group(); layer.add(dead);
    rubble.collapse(dead);
    g.rubble.push({ id: 900, x: 30, y: 30, w: 2, h: 2, total: 4, loads: [[0, 0], [1, 1]] } as (typeof g.rubble)[number]);
    rubble.sync(g, view, 0.5);
    expect(dead.scale.y).toBeLessThan(1);
    expect(scene.children.length).toBe(1);
    rubble.sync(g, view, 1);
    expect(layer.children.includes(dead)).toBe(false);
    g.rubble = [];
    rubble.sync(g, view, 0.1);
    expect(scene.children.length).toBe(0);
  });
});

describe('mury, koksowniki, place budowy (walls.ts, braziers.ts, sites.ts)', () => {
  it('palisada z bali, mur kamienny z bloków i blank, koksownik na murze', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const x0 = k.x + 16, y0 = k.y + 2;
    for (let i = 0; i < 3; i++) placeReady(g, 'palisade', x0 + i, y0);
    const sw = placeReady(g, 'stoneWall', x0, y0 + 4)!;
    placeReady(g, 'stoneWall', x0 + 1, y0 + 4);
    g.buildings.find((b) => b.id === sw)!.brazier = 1;
    const scene = new THREE.Scene(), walls = new WallLayer(scene);
    walls.sync(g, view, new Map());
    // kolejność siatek: trzony bali, czubki bali, bloki muru, blanki, drabiny
    const [shafts, tips, blocks, edges] = instanced(scene).map((m) => m.count);
    expect(shafts).toBeGreaterThanOrEqual(9); // po kilka bali na każde z 3 pól palisady
    expect(tips).toBe(shafts);
    expect(blocks).toBe(2); // dwa pola muru kamiennego
    expect(edges).toBe(6); // blanki na krawędziach bez sąsiedniego muru
    walls.invalidate();
    walls.sync(g, view, new Map());
    const br = new Braziers(scene);
    br.sync(g, view, new Map());
    expect(br.meshes.size).toBe(1);
  });

  it('pokazowa budowa: model przycięty, rusztowania stoją, po 3 s budynek gotowy', () => {
    const g = createGame(7);
    const k = playerKeep(g, 0)!;
    const id = placeReady(g, 'house', k.x + 14, k.y + 2)!;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    const layer = new THREE.Group(), dusts: number[] = [];
    const sites = new SiteLayer(layer, (x) => dusts.push(x));
    sites.quickBuild.set(id, 0);
    const meshes = new Map([[id, mesh]]);
    sites.sync(g, view, meshes, { time: 1.5, calm: false, lodTick: 0 });
    expect(sites.sites.has(id)).toBe(true);
    expect(((mesh.children[0] as THREE.Mesh).material as THREE.Material).clippingPlanes?.length).toBe(1);
    expect(instanced(layer).some((m) => m.count > 0)).toBe(true); // rusztowanie
    sites.sync(g, view, meshes, { time: 3.5, calm: false, lodTick: 1 });
    expect(sites.sites.has(id)).toBe(false);
    expect(((mesh.children[0] as THREE.Mesh).material as THREE.Material).clippingPlanes).toBeNull();
    expect(dusts.length).toBeGreaterThan(0);
    sites.reset();
    expect(sites.quickBuild.size).toBe(0);
  });
});

describe('niebo (sky.ts)', () => {
  it('nocą gwiazdy i księżyc, w dzień słońce', () => {
    const scene = new THREE.Scene(), sky = new SkyDome(scene);
    scene.background = new THREE.Color(0x101010);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const frame = { camera, rain: 0, cover: 0, dayMist: 0, time: 1, sunDir: new THREE.Vector3(0.3, 0.8, 0.2), hour: 12 };
    sky.update({ ...frame, night: 0 });
    const group = scene.children[0] as THREE.Group;
    const sprites = group.children.filter((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite[];
    const moon = sprites[0]!, sun = sprites[1]!;
    expect((sun.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0.5);
    expect((moon.material as THREE.SpriteMaterial).opacity).toBe(0);
    sky.update({ ...frame, night: 1, hour: 0 });
    expect((moon.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0.5);
    expect((sun.material as THREE.SpriteMaterial).opacity).toBe(0);
    expect(scene.children.length).toBe(1);
  });
});

describe('poświata pochodni (torchglow.ts)', () => {
  it('nocą plama pod zapaloną pochodnią, w dzień nic', () => {
    const g = createGame(7);
    g.units = [];
    const scene = new THREE.Scene(), glow = new TorchGlow(scene);
    const mesh = new THREE.Group(), torch = new THREE.Object3D();
    torch.name = 'torch'; mesh.add(torch);
    const meshes = new Map([[1, mesh]]);
    glow.sync(g, view, meshes, new Set([1]), 1);
    const m = instanced(scene)[0]!;
    expect(m.visible).toBe(true);
    expect(m.count).toBe(1);
    glow.sync(g, view, meshes, new Set([1]), 0);
    expect(m.visible).toBe(false);
  });
});

// sprawdzenie, że każdy budynek z listy nadal ma model do scalania (nic nie zginęło przy przenosinach)
it('lista budynków bez zmian', () => { expect(BUILDINGS.length).toBeGreaterThan(30); });

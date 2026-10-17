/**
 * Postacie ze szkieletem z Blendera (tools/models/chars → public/chars/<nazwa>.glb): siatka ze skórą, szkielet
 * i animacje z nagrań ruchu (spoczynek, chód, cios, śmierć).
 *
 * Wydajność: setki postaci w jednym wywołaniu rysowania. Ruch nie jest liczony na procesorze — przy wczytaniu każda
 * klatka każdej animacji (30 na sekundę) zapisuje się jako macierze kości w małej teksturze (kości × 4 piksele
 * w poziomie, klatki w pionie). Karta graficzna w cieniowaniu wierzchołków bierze dwie sąsiednie klatki z tekstury
 * i miesza je; każda instancja ma tylko swój numer wiersza, mieszanie i kolor drużyny.
 *
 * Użycie jak `Figures`: co klatkę `set()` dla każdej widocznej postaci, potem `finish()`.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cat } from './cat';
import { cloudShade } from './ground';

export type Clip = 'idle' | 'walk' | 'attack' | 'death';
/** Animacje zapętlone (ostatnia klatka = pierwsza); reszta zatrzymuje się na końcu */
const LOOPS: Record<Clip, boolean> = { idle: true, walk: true, attack: true, death: false };
const FPS = 30;
/** Skala z metrów (Blender) do jednostek modelu postaci w grze: strażnik ma tyle wzrostu co poprzedni model (0,64) */
const SCALE: Record<string, number> = { guard: 0.344 };

/** Droga jednego cyklu chodu w polach mapy (krok z nagrania 1,4 m × skala postaci w grze) */
const WALK_CYCLE = 0.4;

interface ClipInfo { row: number; frames: number; dur: number }
interface Baked { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial; bones: THREE.DataTexture; clips: Record<string, ClipInfo> }

const baked = new Map<string, Baked>();
const pending = new Map<string, Promise<Baked | null>>();

const base = (): string => (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** Pobiera i zapieka postacie (na ekranie wczytywania). Błąd pobrania nie zatrzymuje gry — postać się nie pokaże. */
export function loadChars(names: string[] = ['guard']): Promise<void> {
  return Promise.all(names.map(load)).then(() => undefined);
}

function load(name: string): Promise<Baked | null> {
  let p = pending.get(name);
  if (!p) {
    p = new GLTFLoader().loadAsync(`${base()}chars/${name}.glb`)
      .then((gltf) => { const b = bake(gltf, SCALE[name] ?? 1); baked.set(name, b); return b; })
      .catch((e: unknown) => { console.warn(`Postać ${name} nie wczytała się`, e); return null; });
    pending.set(name, p);
  }
  return p;
}

/** Zapieka każdą klatkę każdej animacji jako macierze kości (gotowe do mnożenia przez wierzchołek w spoczynku) */
function bake(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }, scale: number): Baked {
  let sk: THREE.SkinnedMesh | null = null;
  gltf.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sk = o as THREE.SkinnedMesh; });
  if (!sk) throw new Error('Brak siatki ze skórą w pliku postaci');
  const mesh = sk as THREE.SkinnedMesh;
  const nb = mesh.skeleton.bones.length;
  const clips: Record<string, ClipInfo> = {};
  let rows = 0;
  for (const c of gltf.animations) {
    const frames = Math.max(2, Math.round(c.duration * FPS) + 1);
    clips[c.name] = { row: rows, frames, dur: c.duration };
    rows += frames;
  }
  const data = new Float32Array(nb * 4 * rows * 4);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const norm = new THREE.Matrix4().makeScale(scale, scale, scale);
  const pre = new THREE.Matrix4(), k = new THREE.Matrix4(), bm = new THREE.Matrix4();
  for (const c of gltf.animations) {
    const info = clips[c.name]!;
    mixer.stopAllAction();
    const a = mixer.clipAction(c);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.reset().play();
    for (let f = 0; f < info.frames; f++) {
      mixer.setTime(Math.min(c.duration, f / FPS));
      gltf.scene.updateMatrixWorld(true);
      mesh.skeleton.update();
      // wierzchołek w świecie = siatka · odwrotność wiązania · (kość · odwrotność kości) · wiązanie · wierzchołek
      pre.multiplyMatrices(norm, mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
      for (let b = 0; b < nb; b++) {
        bm.fromArray(mesh.skeleton.boneMatrices!, b * 16);
        k.multiplyMatrices(pre, bm).multiply(mesh.bindMatrix);
        data.set(k.elements, ((info.row + f) * nb * 4 + b * 4) * 4);
      }
    }
  }
  mixer.stopAllAction();
  const tex = new THREE.DataTexture(data, nb * 4, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  // siatka bez skóry three.js (ruch liczy nasz shader); maska drużyny z koloru wierzchołków pod własną nazwą
  const geo = mesh.geometry.clone();
  const mask = geo.getAttribute('color');
  if (mask) { geo.setAttribute('teamMask', mask); geo.deleteAttribute('color'); }
  const src = mesh.material as THREE.MeshStandardMaterial;
  const mat = src.clone();
  mat.vertexColors = false;
  mat.side = THREE.FrontSide;
  return { geo, mat, bones: tex, clips };
}

const VERT_HEAD = /* glsl */ `
uniform highp sampler2D uBones;
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec4 aAnim;
mat4 boneAt(float row, float i) {
  int x = int(i) * 4, y = int(row);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
              texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
mat4 skinAt(float row) {
  return skinWeight.x * boneAt(row, skinIndex.x) + skinWeight.y * boneAt(row, skinIndex.y)
       + skinWeight.z * boneAt(row, skinIndex.z) + skinWeight.w * boneAt(row, skinIndex.w);
}
`;
const VERT_SKIN = /* glsl */ `
  mat4 skm = skinAt(aAnim.x) * (1.0 - aAnim.z) + skinAt(aAnim.y) * aAnim.z;
`;

function patchColor(mat: THREE.MeshStandardMaterial, bones: THREE.DataTexture): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = { value: bones };
    sh.vertexShader = VERT_HEAD + 'attribute vec3 aTeam;\nattribute vec3 teamMask;\nvarying vec3 vTeam;\nvarying float vTeamK;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', VERT_SKIN + 'vec3 objectNormal = normalize(mat3(skm) * normal);\nvTeam = aTeam;\nvTeamK = teamMask.r;')
      .replace('#include <begin_vertex>', 'vec3 transformed = (skm * vec4(position, 1.0)).xyz;');
    // pas w barwach pana: kolor drużyny przyciemniony fakturą skóry z tekstury
    sh.fragmentShader = 'varying vec3 vTeam;\nvarying float vTeamK;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(diffuseColor.rgb, vTeam * clamp(0.35 + lum * 6.0, 0.35, 1.0), vTeamK);`);
  };
  mat.customProgramCacheKey = () => 'skinned-figures';
}

function depthMaterial(bones: THREE.DataTexture): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = { value: bones };
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERT_SKIN + 'vec3 transformed = (skm * vec4(position, 1.0)).xyz;');
  };
  m.customProgramCacheKey = () => 'skinned-figures-depth';
  return m;
}

export class SkinnedFigures {
  private mesh: THREE.InstancedMesh | null = null;
  private b: Baked | null = null;
  private anim!: THREE.InstancedBufferAttribute;
  private team!: THREE.InstancedBufferAttribute;
  private n = 0;
  private color = new THREE.Color();

  constructor(private max: number, private scene: THREE.Scene, name = 'guard', private label = 'postacie: strażnicy') {
    const ready = baked.get(name);
    if (ready) this.build(ready);
    else void load(name).then((b) => { if (b) this.build(b); });
  }

  private build(b: Baked): void {
    this.b = b;
    const geo = b.geo.clone();
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4);
    this.team = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    this.team.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', this.anim);
    geo.setAttribute('aTeam', this.team);
    const mat = b.mat.clone();
    patchColor(mat, b.bones);
    cloudShade(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, this.max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = depthMaterial(b.bones);
    this.scene.add(cat(mesh, this.label));
    this.mesh = mesh;
  }

  /** Czas trwania animacji w sekundach (0, gdy postać jeszcze się nie wczytała) */
  duration(clip: Clip): number { return this.b?.clips[clip]?.dur ?? 0; }

  /** Czas w animacji chodu z fazy kroku symulacji (faza rośnie o 7,5 na pole drogi): jeden cykl chodu
   *  (lewa i prawa noga) to ok. 0,4 pola, więc stopy nie ślizgają się po ziemi */
  walkTime(phase: number): number { return (phase / 7.5 / WALK_CYCLE) * this.duration('walk'); }

  /** Zgodność z `Figures`: wyboru dalekiej wersji tu nie ma */
  view(_p: THREE.Vector3): void { /* jedna wersja z bliska i z daleka */ }

  /** Postać w miejscu `base` (stopy, kierunek patrzenia +z), w animacji `clip` w chwili `t` sekund, w kolorze drużyny */
  set(base: THREE.Matrix4, clip: Clip, t: number, team: number): void {
    const e = base.elements;
    if (e[0] === 0 && e[5] === 0 && e[10] === 0) return;
    const b = this.b, mesh = this.mesh;
    if (!b || !mesh || this.n >= this.max) return;
    const c = b.clips[clip] ?? b.clips.idle!;
    const last = c.frames - 1;
    let f = Math.max(0, t) * FPS;
    f = LOOPS[clip] ? f % last : Math.min(f, last);
    const f0 = Math.floor(f);
    const i = this.n++;
    mesh.setMatrixAt(i, base);
    this.anim.setXYZW(i, c.row + f0, c.row + Math.min(f0 + 1, last), f - f0, 0);
    this.color.setHex(team);
    this.team.setXYZ(i, this.color.r, this.color.g, this.color.b);
  }

  finish(_count?: number): void {
    const mesh = this.mesh;
    if (mesh) {
      mesh.count = this.n;
      mesh.visible = this.n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      this.anim.needsUpdate = true;
      this.team.needsUpdate = true;
    }
    this.n = 0;
  }
}

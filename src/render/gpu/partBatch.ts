import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gpuMods } from './webgpu';

/**
 * Postacie z części jednym rysowaniem na materiał (Michał 7.11.2026: „gra jest drewnem”, plan w docs/webgpu.md, etap 1).
 *
 * Dotąd każda część postaci (tułów, głowa, ręce, nogi, czapka, narzędzie…) była osobną pulą instancji, czyli osobnym
 * rysowaniem — kilkanaście na rodzaj postaci, razy dwa z cieniem. Tu części o tym samym materiale są sklejone w jedną
 * siatkę z numerem części w wierzchołku (`aPart`), a macierze i kolory części wszystkich osób leżą w teksturach:
 * wiersz = osoba, kolumny = części. Shader (TSL) bierze macierz swojej części i swojej osoby. Wygląd i ruch bez zmian:
 * Figures liczy te same macierze co wcześniej, tylko zapisuje je przez `PartSlot` (udaje pulę instancji).
 */
export interface PartSpec { geo: THREE.BufferGeometry; base: THREE.Color }

/* eslint-disable @typescript-eslint/no-explicit-any */
export class PartGroup {
  readonly mesh: THREE.InstancedMesh;
  private cap: number;
  private mtx!: THREE.DataTexture;
  private col!: THREE.DataTexture;
  private mtxNode: any;
  private colNode: any;
  readonly slots: PartSlot[] = [];
  count = 0;

  constructor(specs: PartSpec[], src: THREE.MeshStandardMaterial, private max: number) {
    const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
    const geos = specs.map((s, k) => {
      const g = s.geo.index ? s.geo.toNonIndexed() : s.geo.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      if (!g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
      const nrm = g.getAttribute('normal');
      if (nrm && (nrm.array as ArrayLike<number>) instanceof Int8Array) {
        const f = new Float32Array(nrm.count * 3);
        for (let i = 0; i < nrm.count; i++) { f[i * 3] = nrm.getX(i); f[i * 3 + 1] = nrm.getY(i); f[i * 3 + 2] = nrm.getZ(i); }
        g.setAttribute('normal', new THREE.BufferAttribute(f, 3));
      }
      g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(k), 1));
      return g;
    });
    const geo = mergeGeometries(geos)!;
    geo.computeBoundingSphere();
    this.cap = 16;
    this.alloc(specs.length);
    const { Fn, attribute, textureLoad, ivec2, int, mat4, vec4, normalize, positionGeometry, normalGeometry, normalLocal, varying, materialColor, texture, instanceIndex } = T;
    this.mtxNode = texture(this.mtx);
    this.colNode = texture(this.col);
    const part = int(attribute('aPart', 'float'));
    const row = int(instanceIndex);
    const pos = Fn(() => {
      const x = part.mul(4);
      const M = mat4(textureLoad(this.mtxNode, ivec2(x, row)), textureLoad(this.mtxNode, ivec2(x.add(1), row)),
        textureLoad(this.mtxNode, ivec2(x.add(2), row)), textureLoad(this.mtxNode, ivec2(x.add(3), row)));
      normalLocal.assign(normalize(M.mul(vec4(normalGeometry, 0)).xyz));
      return M.mul(vec4(positionGeometry, 1)).xyz;
    })();
    const tint = varying(textureLoad(this.colNode, ivec2(part, row)).xyz);
    const m = new Wm.MeshStandardNodeMaterial({
      map: src.map, roughness: src.roughness, metalness: src.metalness, normalMap: src.normalMap, side: src.side, vertexColors: true,
    });
    if (src.normalScale) m.normalScale.copy(src.normalScale);
    m.positionNode = pos;
    m.colorNode = vec4(materialColor.rgb.mul(tint), materialColor.a);
    this.mesh = new THREE.InstancedMesh(geo, m, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    specs.forEach((s, k) => this.slots.push(new PartSlot(this, k, s.base, max)));
  }

  private alloc(parts: number): void {
    const old = this.mtx, oldC = this.col;
    this.mtx = new THREE.DataTexture(new Float32Array(parts * 4 * this.cap * 4), parts * 4, this.cap, THREE.RGBAFormat, THREE.FloatType);
    this.col = new THREE.DataTexture(new Float32Array(parts * this.cap * 4).fill(1), parts, this.cap, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [this.mtx, this.col]) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; }
    if (old) {
      (this.mtx.image.data as Float32Array).set(old.image.data as Float32Array);
      (this.col.image.data as Float32Array).set(oldC.image.data as Float32Array);
      this.mtxNode.value = this.mtx; this.colNode.value = this.col;
      old.dispose(); oldC.dispose();
    }
  }

  /** Miejsce dla osoby `i` (tekstury rosną dwukrotnie, gdy osób przybywa) */
  ensure(i: number): void {
    if (i < this.cap) return;
    while (this.cap <= i) this.cap *= 2;
    this.cap = Math.min(this.cap, Math.max(this.max, 16));
    this.alloc(this.slots.length);
  }
  get mtxData(): Float32Array { return this.mtx.image.data as Float32Array; }
  get colData(): Float32Array { return this.col.image.data as Float32Array; }
  get width(): number { return this.slots.length; }

  /** Po ustawieniu wszystkich osób w klatce */
  finish(): void {
    let n = 0;
    for (const s of this.slots) n = Math.max(n, s.count);
    this.count = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) { this.mtx.needsUpdate = true; this.col.needsUpdate = true; }
  }
}

/** Jedna część postaci w grupie: udaje pulę instancji (setMatrixAt, setColorAt, count, visible), pisze do tekstur grupy */
export class PartSlot {
  count = 0;
  visible = true;
  castShadow = true;
  readonly instanceMatrix: { count: number; needsUpdate: boolean };
  instanceColor: { count: number; needsUpdate: boolean; itemSize: number } | null;
  constructor(private g: PartGroup, private k: number, private base: THREE.Color, max: number) {
    this.instanceMatrix = { count: max, needsUpdate: false };
    this.instanceColor = { count: max, needsUpdate: false, itemSize: 3 };
  }
  setMatrixAt(i: number, m: THREE.Matrix4): void {
    this.g.ensure(i);
    const w = this.g.width, d = this.g.mtxData, o = (i * w * 4 + this.k * 4) * 4, e = m.elements;
    for (let j = 0; j < 16; j++) d[o + j] = e[j]!;
    const c = this.g.colData, oc = (i * w + this.k) * 4;
    c[oc] = this.base.r; c[oc + 1] = this.base.g; c[oc + 2] = this.base.b;
  }
  setColorAt(i: number, col: THREE.Color): void {
    this.g.ensure(i);
    const c = this.g.colData, oc = (i * this.g.width + this.k) * 4;
    c[oc] = col.r * this.base.r; c[oc + 1] = col.g * this.base.g; c[oc + 2] = col.b * this.base.b;
  }
}

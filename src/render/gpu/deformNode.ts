import type * as THREE from 'three';
import { gpuMods, instanceMatrixNode } from './webgpu';

/**
 * Ruch wierzchołków zwykłych materiałów na WebGPU (wiatr w koronach drzew, flagi i chorągwie): węzeł położenia
 * dopięty do materiału (three.js przenosi go przy zamianie na materiał węzłowy). Przesunięcie liczone w układzie
 * modelu, potem macierz instancji — tak jak w GLSL (`transformed` przed `instanceMatrix`).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Offset = (o: { pos: any; origin: any; time: any }) => any;

function attach(m: THREE.Material, key: string, time: { value: number }, offset: Offset): void {
  if (!gpuMods) return;
  const T = gpuMods.TSL as any;
  const { Fn, uniform, positionGeometry, vec4, modelWorldMatrix } = T;
  const tU = uniform(0).onFrameUpdate(() => time.value);
  (m as any).positionNode = Fn((_: unknown, b: any) => {
    const inst = b.object?.isInstancedMesh ? instanceMatrixNode(b.object.instanceMatrix) : null;
    const origin = inst ? modelWorldMatrix.mul(inst).element(3).xyz : modelWorldMatrix.element(3).xyz;
    const local = positionGeometry.add(offset({ pos: positionGeometry, origin, time: tU }));
    return inst ? inst.mul(vec4(local, 1)).xyz : local;
  })();
  m.userData.gpuKey = key;
}

/** Korona drzewa na wietrze: ruch rośnie z kwadratem wysokości nad `base` (jak windCrown w terrain.ts) */
export function windNode(m: THREE.Material, amp: number, base: number, key: string, time: { value: number }): void {
  attach(m, key, time, ({ pos, origin, time: t }) => {
    const T = gpuMods!.TSL as any;
    const lift = T.max(pos.y.sub(base), 0);
    const wave = T.sin(t.mul(0.9).add(origin.x.mul(0.11)).add(origin.z.mul(0.07))).mul(0.7)
      .add(T.sin(t.mul(2.3).add(origin.x.mul(0.6)).add(origin.z.mul(0.4))).mul(0.3));
    const k = wave.mul(lift).mul(lift);
    return T.vec3(k.mul(amp), 0, k.mul(amp * 0.5));
  });
}

/** Flaga na maszcie: fala biegnie od drzewca do końca (jak addWave w banners.ts) */
export function flagWaveNode(m: THREE.Material, len: number, time: { value: number }): void {
  attach(m, 'flagwave1', time, ({ pos, origin, time: t }) => {
    const T = gpuMods!.TSL as any;
    const fk = T.clamp(pos.x.div(len), 0, 1);
    const ph = t.mul(4).add(origin.x.mul(3.1)).add(origin.z.mul(1.7));
    const wa = fk.mul(0.026).mul(T.sin(ph.mul(0.37)).mul(0.25).add(0.75));
    const wArg = fk.mul(8.5).sub(ph).add(pos.y.mul(6));
    const dz = T.sin(wArg).mul(wa).add(T.sin(fk.mul(19).sub(ph.mul(1.7)).add(pos.y.mul(24))).mul(0.004).mul(fk));
    return T.vec3(T.abs(T.sin(wArg)).mul(wa).mul(-0.35), fk.mul(fk).mul(-0.01).mul(T.sin(ph.mul(0.5)).mul(0.4).add(0.6)), dz);
  });
}

/** Wisząca chorągiew: odstaje od ściany coraz bardziej ku dołowi (jak addHangWave w banners.ts) */
export function hangWaveNode(m: THREE.Material, time: { value: number }): void {
  attach(m, 'flaghang1', time, ({ pos, origin, time: t }) => {
    const T = gpuMods!.TSL as any;
    const fk = T.clamp(pos.y.negate(), 0, 1);
    const ph = t.mul(1.6).add(origin.x.mul(2.3)).add(origin.z.mul(1.3));
    const z = fk.mul(T.sin(fk.mul(3.5).sub(ph)).mul(0.5).add(0.5).mul(0.012).add(0.01)).add(T.sin(pos.x.mul(9).add(ph.mul(0.8))).mul(0.003).mul(fk));
    return T.vec3(T.sin(ph.mul(0.6)).mul(0.015).mul(fk).mul(fk), 0, z);
  });
}

import type * as THREE from 'three';
import { gpuMods, instanceMatrixNode } from './webgpu';

/**
 * Ogień na WebGPU (docs/webgpu.md, partia 5): płomienie pochodni i ognisk (flames.ts) i pożary budynków (blaze.ts)
 * jako bryły, przez które idzie promień z oka. Napisane od nowa pod WebGPU:
 * - szum 3D z gotowej tekstury (64³, zawija się) zamiast liczenia haszy w każdym kroku promienia — jedna próbka
 *   tekstury na oktawę zamiast ośmiu haszy, więc ogień jest kilka razy tańszy przy tym samym wyglądzie;
 * - pętla promienia w TSL (Loop/Break), oktawy rozwinięte już przy budowie shadera.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let noiseTex: THREE.Data3DTexture | null = null;
/** Szum wartości 3D (okres 16 oczek, 4 teksele na oczko, gładkie przejścia zapisane w teksturze) */
function noise3D(): THREE.Data3DTexture {
  if (noiseTex) return noiseTex;
  const Wm = gpuMods!.W as any;
  const C = 16, S = 4, N = C * S;
  const lat = new Float32Array(C * C * C);
  let s = 1234567;
  for (let i = 0; i < lat.length; i++) { s = (s * 16807) % 2147483647; lat[i] = s / 2147483647; }
  const L = (x: number, y: number, z: number): number => lat[((z % C) * C + (y % C)) * C + (x % C)]!;
  const data = new Uint8Array(N * N * N);
  const sm = (t: number): number => t * t * (3 - 2 * t);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / S, fy = y / S, fz = z / S;
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    const tx = sm(fx - ix), ty = sm(fy - iy), tz = sm(fz - iz);
    const m = (a: number, b: number, t: number): number => a + (b - a) * t;
    const v = m(
      m(m(L(ix, iy, iz), L(ix + 1, iy, iz), tx), m(L(ix, iy + 1, iz), L(ix + 1, iy + 1, iz), tx), ty),
      m(m(L(ix, iy, iz + 1), L(ix + 1, iy, iz + 1), tx), m(L(ix, iy + 1, iz + 1), L(ix + 1, iy + 1, iz + 1), tx), ty), tz);
    data[(z * N + y) * N + x] = Math.round(v * 255);
  }
  const t = new Wm.Data3DTexture(data, N, N, N);
  t.format = Wm.RedFormat; t.type = Wm.UnsignedByteType;
  t.minFilter = t.magFilter = Wm.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = Wm.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

/** Wspólne klocki ognia w TSL */
function kit(): any {
  const T = gpuMods!.TSL as any;
  const { texture3D, vec3, vec2, mix, smoothstep, min, max, float } = T;
  const tex = noise3D();
  // szum w jednostkach oczek (jak fNoise w GLSL: wartość w punkcie p, oczko = 1)
  const n = (p: any): any => texture3D(tex, p.div(16)).r;
  const fbm = (p0: any, oct: number): any => {
    let v: any = float(0), a = 0.5, p = p0;
    for (let k = 0; k < oct; k++) {
      v = v.add(n(p).mul(a));
      p = vec3(p.x.mul(1.6).add(p.z.mul(1.2)), p.y.mul(2.03), p.z.mul(1.6).sub(p.x.mul(1.2))).add(3.1);
      a *= 0.5;
    }
    return v;
  };
  const ramp = (t: any): any => {
    let c: any = mix(vec3(0.35, 0.02, 0), vec3(1, 0.22, 0.02), smoothstep(0.05, 0.35, t));
    c = mix(c, vec3(1, 0.58, 0.1), smoothstep(0.3, 0.6, t));
    c = mix(c, vec3(1, 0.8, 0.35), smoothstep(0.62, 0.9, t));
    c = mix(c, vec3(1, 0.93, 0.7), smoothstep(0.9, 1, t));
    return c.mul(t.mul(t).mul(0.7).add(0.55));
  };
  const box = (o: any, d: any, lo: any, hi: any): any => {
    const inv = vec3(1).div(d);
    const t0 = lo.sub(o).mul(inv), t1 = hi.sub(o).mul(inv);
    const mn = min(t0, t1), mx = max(t0, t1);
    return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
  };
  // drżenie startu promienia (zamiast prążków drobne ziarno)
  const jitter = (time: any): any => T.fract(T.sin(T.dot(T.screenCoordinate.xy.add(T.fract(time).mul(97)), vec2(12.9898, 78.233))).mul(43758.5453));
  return { T, n, fbm, ramp, box, jitter };
}

/**
 * Płomień (flames.ts): pula InstancedMesh albo pojedyncza siatka. Bryła 1×1×1 od podstawy w górę, bez obrotu
 * (macierz = przesunięcie + skala), w kolorze instancji: r = ziarno, g = jasność.
 */
export function flameNode(time: { value: number }, mesh?: THREE.InstancedMesh): THREE.Material {
  const { T, n: _n, fbm, ramp, box, jitter } = kit();
  const Wm = gpuMods!.W as any;
  const { Fn, Loop, Break, If, Discard, vec2, vec3, vec4, float, length, normalize, max, pow, smoothstep, exp, clamp,
    instancedBufferAttribute, varying, positionGeometry, cameraPosition, modelWorldMatrix, uniform } = T;
  void _n;
  const tU = uniform(0).onFrameUpdate(() => time.value);
  let M: any = modelWorldMatrix, seed: any = float(0.37), inten: any = float(1);
  if (mesh) {
    M = modelWorldMatrix.mul(instanceMatrixNode(mesh.instanceMatrix));
    const ic = instancedBufferAttribute(mesh.instanceColor!, 'vec3');
    seed = ic.x; inten = ic.y;
  }
  const S = vec3(length(M.element(0).xyz), length(M.element(1).xyz), length(M.element(2).xyz));
  // oko w przestrzeni bryły przez pełną odwrotność macierzy (jak inverse(M) w GLSL): pochodnia w ręce obraca się
  // z kamerą, a samo „przesunięcie i skala” przy obrocie liczyło promień z złego miejsca — przy ruchu myszą płomień
  // rozpadał się na płaskie kliny (Michał 6.11.2026)
  const vCam = varying(T.inverse(M).mul(vec4(cameraPosition, 1)).xyz);
  const vScale = varying(S), vSeed = varying(seed), vI = varying(inten);
  const color = Fn(() => {
    const o = vCam, d = normalize(positionGeometry.sub(vCam));
    const tt = box(o, d, vec3(-0.5, 0, -0.5), vec3(0.5, 1, 0.5));
    const t0 = max(tt.x, 0), t1 = tt.y;
    If(t1.lessThanEqual(t0), () => { Discard(); });
    const N = 22;
    const ds = t1.sub(t0).div(N);
    const t = t0.add(ds.mul(jitter(tU))).toVar();
    const wl = length(d.mul(vScale));
    const tm = tU.add(vSeed.mul(20));
    const sway = vec2(fbm(vec3(tm.mul(0.5), vSeed.mul(9), 0.5), 1).mul(2), fbm(vec3(4.5, tm.mul(0.5), vSeed.mul(7)), 1).mul(2)).sub(0.5);
    const col = vec3(0).toVar(), A = float(0).toVar();
    Loop(N, () => {
      const p = o.add(d.mul(t));
      const y = p.y;
      const xz = p.xz.sub(sway.mul(0.4).mul(y).mul(y));
      const nn = fbm(vec3(xz.mul(3.2), y.mul(2.4).sub(tm.mul(1.7))).add(vSeed.mul(13)), 3);
      const r = length(xz);
      const R = pow(max(float(1).sub(y), 0), 0.85).mul(0.46).mul(smoothstep(0, 0.14, y.add(0.03)));
      const dist = r.sub(R.mul(nn.add(0.45)));
      const dens = smoothstep(0.05, -0.1, dist).mul(smoothstep(1, 0.5, y.add(nn.sub(0.5).mul(0.7))));
      If(dens.greaterThan(0.002), () => {
        const temp = clamp(dens.mul(float(1.2).sub(y.mul(0.95))).mul(nn.mul(0.7).add(0.65)), 0, 1);
        const a = float(1).sub(exp(dens.mul(ds).mul(wl).mul(22).negate()));
        col.addAssign(float(1).sub(A).mul(a).mul(ramp(temp)));
        A.addAssign(float(1).sub(A).mul(a));
        If(A.greaterThan(0.97), () => { Break(); });
      });
      t.addAssign(ds);
    });
    const Af = A.mul(vI);
    If(Af.lessThan(0.01), () => { Discard(); });
    // przemnożona alfa: ogień świeci, tło za nim tylko lekko przygasa
    return vec4(col.mul(vI).mul(0.65), Af.mul(0.4));
  });
  // tylne ściany: kamera w środku bryły (spacer przy pochodni) nie ucina płomienia w płaskie kliny (jak w flames.ts)
  const m = new Wm.MeshBasicNodeMaterial({ side: Wm.BackSide, transparent: true, depthWrite: false, fog: false,
    blending: Wm.CustomBlending, blendSrc: Wm.OneFactor, blendDst: Wm.OneMinusSrcAlphaFactor });
  // outputNode, nie colorNode: three.js mnoży colorNode przez kolor instancji, a tu kolor instancji to ziarno
  // i jasność (r, g, 0) — płomień wychodził zielony (Michał 3.11.2026)
  m.outputNode = color();
  // pozycja bryły: ta sama macierz, której użyliśmy wyżej (bez automatycznych instancji three.js)
  m.vertexNode = T.cameraProjectionMatrix.mul(T.cameraViewMatrix).mul(M).mul(vec4(positionGeometry, 1));
  m.uniforms = { time: tU };
  return m;
}

/** Poświata wokół płomienia: okrągła plama zwrócona do kamery (pula InstancedMesh) */
export function flameGlowNode(time: { value: number }, mesh: THREE.InstancedMesh): THREE.Material {
  const T = gpuMods!.TSL as any, Wm = gpuMods!.W as any;
  const { uniform, instancedBufferAttribute, vec3, vec4, length, pow, max, sin, uv, positionGeometry, cameraWorldMatrix,
    cameraProjectionMatrix, cameraViewMatrix, modelWorldMatrix, varying } = T;
  const tU = uniform(0).onFrameUpdate(() => time.value);
  const IM = modelWorldMatrix.mul(instanceMatrixNode(mesh.instanceMatrix));
  const ic = instancedBufferAttribute(mesh.instanceColor!, 'vec3');
  const center = IM.element(3).xyz, sx = length(IM.element(0).xyz);
  const right = cameraWorldMatrix.element(0).xyz, up = cameraWorldMatrix.element(1).xyz;
  const p = center.add(right.mul(positionGeometry.x).add(up.mul(positionGeometry.y)).mul(sx));
  const vSeed = varying(ic.x), vI = varying(ic.y);
  const c = uv().mul(2).sub(1);
  const fl = sin(tU.mul(13).add(vSeed.mul(40))).mul(sin(tU.mul(7.3).add(vSeed.mul(11)))).mul(0.15).add(0.85);
  const a = pow(max(T.float(1).sub(length(c)), 0), 2.5).mul(vI).mul(fl).mul(0.42);
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, blending: Wm.AdditiveBlending });
  m.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(p, 1));
  m.outputNode = vec4(vec3(1, 0.55, 0.18).mul(a), 1); // jak płomień: bez mnożenia przez kolor instancji
  m.uniforms = { time: tU };
  return m;
}

/**
 * Pożar budynku (blaze.ts): niewidoczna bryła wokół budynku, promień zbiera ogień (cienka warstwa na ścianach i dachu,
 * języki nad kalenicą) i czarny dym nad nim. Pokrętła jak w GLSL: heat, seed, roof, tall, foot.
 */
export function blazeNode(time: { value: number }, init: { heat: number; seed: number; roof: number; tall: number; foot: THREE.Vector2 }): THREE.ShaderMaterial {
  const { T, n, fbm, ramp, box, jitter } = kit();
  const Wm = gpuMods!.W as any;
  const { Fn, Loop, Break, If, Discard, vec2, vec3, vec4, float, length, normalize, max, abs, min, smoothstep, exp, clamp, sin,
    step, mix, varying, positionGeometry, cameraPosition, modelWorldMatrix, uniform, dot } = T;
  const u = {
    time: uniform(0).onFrameUpdate(() => time.value), heat: uniform(init.heat), seed: uniform(init.seed),
    roof: uniform(init.roof), tall: uniform(init.tall), foot: uniform(init.foot),
  };
  const M = modelWorldMatrix;
  const S = vec3(length(M.element(0).xyz), length(M.element(1).xyz), length(M.element(2).xyz));
  const vCam = varying(cameraPosition.sub(M.element(3).xyz).div(S)), vScale = varying(S);
  const sdBox2 = (p: any, b: any): any => { const d = abs(p).sub(b); return length(max(d, 0)).add(min(max(d.x, d.y), 0)); };
  const color = Fn(() => {
    const o = vCam, d = normalize(positionGeometry.sub(vCam));
    const tt = box(o, d, vec3(-0.5, 0, -0.5), vec3(0.5, 1, 0.5));
    const t0 = max(tt.x, 0), t1 = tt.y;
    If(t1.lessThanEqual(t0), () => { Discard(); });
    const N = 44;
    const ds = t1.sub(t0).div(N);
    const t = t0.add(ds.mul(jitter(u.time))).toVar();
    const dsm = ds.mul(length(d.mul(vScale)));
    const tm = u.time.add(u.seed.mul(30));
    const col = vec3(0).toVar(), Tt = float(1).toVar(), fireSeen = float(0).toVar();
    Loop(N, () => {
      const pl = o.add(d.mul(t));
      // miękko do zera przy ścianach i stropie bryły: inaczej cienka sadza wypełniała całe pudło i nad pożarem było
      // widać ciemny prostokąt (Michał 3.11.2026: „dym robi ten kwadrat”)
      const edge = smoothstep(0, 0.14, float(0.5).sub(abs(pl.x))).mul(smoothstep(0, 0.14, float(0.5).sub(abs(pl.z))))
        .mul(smoothstep(0, 0.18, float(1).sub(pl.y)));
      const q = pl.mul(vScale);
      const hs = n(vec3(q.xz.mul(0.6), tm.mul(0.03)).add(u.seed.mul(7)));
      const cover = clamp(u.heat.mul(1.25).sub(0.45).add(hs.sub(0.5).mul(1.4)), 0, 1);
      const above = max(0, q.y.sub(u.roof));
      const xz = q.xz.sub(vec2(0.22, 0.08).mul(above).mul(sin(tm.mul(0.3).add(u.seed.mul(5))).mul(0.08).add(0.3)));
      const nn = fbm(vec3(xz.x.mul(2.8), q.y.mul(0.9).sub(tm.mul(1.25)), xz.y.mul(2.8)).add(u.seed.mul(11)), 4);
      const eave = u.roof.mul(0.55);
      const r = clamp(q.y.sub(eave).div(max(0.2, u.roof.sub(eave))), 0, 1);
      const footR = u.foot.mul(float(1).sub(r.mul(0.55)));
      const db = sdBox2(xz, footR);
      const onWall = smoothstep(-0.45, -0.1, db).mul(smoothstep(0.38, 0.05, db)).mul(float(1).sub(step(u.roof, q.y)));
      const tongues = smoothstep(0.15, -0.35, db.add(above.mul(0.4))).mul(step(u.roof.mul(0.85), q.y));
      const lat = max(onWall, tongues);
      const low = mix(smoothstep(0, eave, q.y).mul(0.6), 1, smoothstep(eave.mul(0.6), eave, q.y));
      const v = above.div(max(0.3, u.tall.mul(cover.mul(0.65).add(0.35))));
      const m = lat.mul(low).mul(cover).mul(float(1).sub(smoothstep(0.35, 1, v.add(nn.sub(0.5).mul(0.5)))));
      const dens = clamp(nn.add(m.mul(0.55)).sub(0.74).mul(6), 0, 1).mul(step(0.01, m));
      const ef = dens.mul(2).mul(edge);
      const sm = fbm(vec3(xz.mul(0.8), q.y.mul(0.6).sub(tm.mul(0.45))).add(u.seed.mul(3)), 3);
      const sootMask = smoothstep(0.6, -0.3, db.add(above.mul(0.08))).mul(smoothstep(0.25, 0.9, v)).mul(u.heat);
      const es = clamp(sm.sub(0.42).mul(2.4), 0, 1).mul(sootMask).mul(step(u.roof.mul(0.9), q.y)).mul(edge);
      If(ef.add(es).greaterThan(0.001), () => {
        const temp = clamp(dens.mul(float(0.95).sub(clamp(v, 0, 1).mul(0.55))).mul(nn.mul(0.8).add(0.35)), 0, 1);
        fireSeen.assign(max(fireSeen, temp));
        col.addAssign(Tt.mul(ramp(temp).mul(ef).mul(0.38).add(vec3(0.03, 0.026, 0.022).mul(es).mul(fireSeen.mul(1.5).add(0.4)))).mul(dsm));
        Tt.mulAssign(exp(ef.mul(0.35).add(es.mul(1.1)).mul(dsm).negate()));
        If(Tt.lessThan(0.03), () => { Break(); });
      });
      t.addAssign(ds);
    });
    const a = float(1).sub(Tt);
    If(a.lessThan(0.005).and(dot(col, col).lessThan(1e-5)), () => { Discard(); });
    return vec4(col, a);
  });
  const m = new Wm.MeshBasicNodeMaterial({ side: Wm.BackSide, transparent: true, depthWrite: false, fog: false,
    blending: Wm.CustomBlending, blendSrc: Wm.OneFactor, blendDst: Wm.OneMinusSrcAlphaFactor });
  m.colorNode = color();
  m.uniforms = u;
  return m;
}

/** Dym i para z czarów (spellsmoke.ts): kłęby jako bryły z marszem promienia, szum 3D z tekstury, samocień z góry */
export function spellSmokeNode(time: { value: number }, mesh: THREE.InstancedMesh): THREE.Material {
  const { T, fbm, box, jitter } = kit();
  const Wm = gpuMods!.W as any;
  const { Fn, Loop, Break, If, Discard, vec3, vec4, float, length, normalize, max, pow, smoothstep, exp, clamp, mix, cos, sin,
    attribute, varying, positionGeometry, cameraPosition, modelWorldMatrix, uniform, cameraProjectionMatrix, cameraViewMatrix } = T;
  const tU = uniform(0).onFrameUpdate(() => time.value);
  const M = modelWorldMatrix.mul(instanceMatrixNode(mesh.instanceMatrix));
  const puff = attribute('aPuff', 'vec4');
  const S = vec3(length(M.element(0).xyz), length(M.element(1).xyz), length(M.element(2).xyz));
  // odwrotność macierzy: przesunięcie, obrót wokół pionu o kąt z ziarna (jak w spellsmoke.ts), skala
  const a = puff.y.mul(6.283);
  const rel = cameraPosition.sub(M.element(3).xyz);
  const rx = rel.x.mul(cos(a)).sub(rel.z.mul(sin(a))), rz = rel.x.mul(sin(a)).add(rel.z.mul(cos(a)));
  const vCam = varying(vec3(rx, rel.y, rz).div(S)), vPuff = varying(puff), vSize = varying(S.x);
  const density = (q: any, age: any, seed: any, steam: any): any => {
    const w = q.mul(3.2).add(vec3(seed.mul(7.1), seed.mul(3.7).sub(tU.mul(0.55)), seed.mul(5.3)));
    const n = fbm(w, 4);
    const r = length(q.mul(vec3(1, 0.85, 1))).mul(2);
    const edge = float(1).sub(age).mul(0.3).add(0.62).sub(steam.mul(0.08));
    const d = float(1).sub(smoothstep(edge.sub(0.45), edge, r.add(n.sub(0.5).mul(age.mul(0.55).add(0.75)))));
    return d.mul(n.mul(1.15).add(0.35));
  };
  const color = Fn(() => {
    const age = vPuff.x, seed = vPuff.y, steam = vPuff.z, power = vPuff.w;
    const o = vCam, d = normalize(positionGeometry.sub(vCam));
    const tt = box(o, d, vec3(-0.5), vec3(0.5));
    const t0 = max(tt.x, 0), t1 = tt.y;
    If(t1.lessThanEqual(t0), () => { Discard(); });
    const N = 14;
    const ds = t1.sub(t0).div(N);
    const t = t0.add(ds.mul(jitter(tU))).toVar();
    const dsm = ds.mul(vSize);
    const isSteam = steam.greaterThan(0.5);
    const k = power.mul(T.select(isSteam, float(9), float(13))).mul(float(1).sub(age.mul(0.55))).div(max(0.06, vSize));
    const lit = T.select(isSteam, vec3(0.86, 0.91, 0.96), mix(vec3(0.16, 0.14, 0.12), vec3(0.38, 0.36, 0.34), age));
    const shade = T.select(isSteam, vec3(0.52, 0.6, 0.7), vec3(0.05, 0.045, 0.04));
    const ember = vec3(1, 0.36, 0.08).mul(float(1).sub(steam)).mul(pow(float(1).sub(age), 3)).mul(1.4);
    const col = vec3(0).toVar(), Tt = float(1).toVar();
    Loop(N, () => {
      const q = o.add(d.mul(t));
      const dn = density(q, age, seed, steam);
      If(dn.greaterThan(0.01), () => {
        const above = density(q.add(vec3(0, 0.16, 0)), age, seed, steam);
        const light = clamp(float(1).sub(above.mul(1.3)), 0, 1);
        const low = float(1).sub(smoothstep(-0.45, 0.1, q.y));
        const c = mix(shade, lit, light.mul(0.85).add(0.15)).add(ember.mul(low));
        const al = float(1).sub(exp(dn.mul(k).mul(dsm).negate()));
        col.addAssign(Tt.mul(c).mul(al));
        Tt.mulAssign(float(1).sub(al));
        If(Tt.lessThan(0.04), () => { Break(); });
      });
      t.addAssign(ds);
    });
    const alpha = float(1).sub(Tt);
    If(alpha.lessThan(0.01), () => { Discard(); });
    return vec4(col.div(max(alpha, 0.001)), alpha);
  });
  const m = new Wm.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: Wm.BackSide, toneMapped: false, fog: false });
  m.colorNode = color();
  m.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(M).mul(vec4(positionGeometry, 1));
  return m;
}

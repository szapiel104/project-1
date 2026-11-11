import type * as THREE from 'three';
import { gpuMods } from './webgpu';

/**
 * Woda na WebGPU (docs/webgpu.md, partia 4) — napisana od nowa pod WebGPU, nie przepisana z GLSL:
 * - grubość wody z prawdziwego bufora głębokości (to, co faktycznie leży pod taflą: dno, brodzący ludzie, kamienie),
 *   a nie z tekstury liczonej z siatki terenu — brzeg wygasa miękko tam, gdzie woda naprawdę się kończy;
 * - załamanie: dno i wszystko pod wodą widać z obrazu sceny przesuniętego falą (bez sortowania przezroczystości —
 *   tafla jest nieprzezroczysta i sama „prześwituje” obrazem spod siebie);
 * - pochłanianie światła (Beer–Lambert) po prawdziwej drodze promienia w wodzie: płycizna zielonkawa, głębia torfowa;
 * - lustrzane odbicie sceny liczone przez kartę (reflector, mniejsza rozdzielczość), zniekształcone falą, siła z Fresnela;
 * - trzy warstwy zmarszczek, w oddali gładsze; ostry odblask słońca; cień i światło sceny na toni.
 * Jedno wywołanie rysowania na całą wodę (plus odbicie sceny w małej rozdzielczości).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** Warstwa obiektów widocznych w odbiciu wody (markReflect) */
export const REFLECT_LAYER = 3;
/** Czy w kadrze jest woda (scene.ts co klatkę): bez wody w kadrze lustro się nie odświeża — to drugie rysowanie sceny */
export const reflectGate = { on: true };
/**
 * Co jakiś czas (nowe obiekty w scenie): wszystko na warstwę odbicia poza tym, czego w tafli i tak nie widać
 * albo co kosztuje bez efektu (lista jak w WebGL-owym waterReflect.ts, plus ślady i kałuże).
 */
/** Drobiazgi płaskie albo małe, których w odbiciu i tak nie widać — każdy to osobne składanie i rysowanie w lustrze */
// pnie, krzewy i podszyt: w falującym odbiciu z góry ich nie widać, a las to najdroższa geometria klatki (Michał 7.11.2026,
// pomiar na RTX 3050: las ok. 14 z 20 ms karty); korony zostają, więc las przy brzegu dalej się odbija
const NO_REFLECT = /^(ślady|kałuże|kruki|niesione|ryby|osmalenia|siatka budowy|uszkodzenia|graty|rodziny|postacie|wilki|tarany|wozy|drogi|śnieg|kamyki|kępy|kwiaty|zwierzęta|groby|poświata|budowy|naprawy|strzały|narzędzia|drzewa: pnie|drzewa leśniczych: pnie|krzewy|podszyt|trzcina|roślinność pustyni|puszcza za mapą: obrazki)/;
/** Drobiazgi w budynkach (wnętrza, zapasy, pochodnie, sufity): w falującym, połówkowym odbiciu ich nie widać (Michał 7.11.2026) */
const REFLECT_SMALL = new Set(['interior', 'life', 'foodfill', 'fill', 'grainfill', 'armsfill', 'yardlog', 'ceiling', 'torch', 'flagcloth', 'crop', 'noworker', 'fire', 'flame', 'smoke']);
export function markReflect(scene: THREE.Object3D, skip: Set<string>): void {
  const walk = (o: THREE.Object3D, small: boolean): void => {
    const c = o.userData.cat as string | undefined;
    const sm = small || REFLECT_SMALL.has(o.name);
    if (sm || (c && (skip.has(c) || NO_REFLECT.test(c) || c.endsWith(' (cień)'))) || o.userData.noReflect) o.layers.disable(REFLECT_LAYER);
    else o.layers.enable(REFLECT_LAYER);
    for (const ch of o.children) walk(ch, sm);
  };
  walk(scene, false);
}
export interface GpuWater {
  mat: THREE.MeshStandardMaterial;
  time: { value: number }; sky: { value: THREE.Color }; sunDir: { value: THREE.Vector3 }; sunCol: { value: THREE.Color };
  /** Obiekt, za którym idzie lustro — dodać jako dziecko tafli (płaszczyzna XY tafli) */
  target: THREE.Object3D;
}

/**
 * `clear`: przejrzysta woda oazy (pustynia) — turkusowa, dno widać głęboko; bez niego jezioro w lesie: zielonkawe,
 * mętniejsze, ale nie czarne (Michał 3.11.2026, zrzuty: woda wyglądała jak szare bagno, bez nieba w tafli).
 */
export function waterNodeMaterial(waves: THREE.Texture, waterY: number, clear = false): GpuWater {
  const { W, TSL } = gpuMods!;
  const T = TSL as any;
  const {
    uniform, texture, vec2, vec3, vec4, float, mix, smoothstep, clamp, max, min, pow, exp, dot, normalize, length, reflect, sin,
    positionWorld, positionView, cameraPosition, cameraViewMatrix, cameraWorldMatrix, cameraProjectionMatrixInverse,
    screenUV, viewportSharedTexture, viewportDepthTexture, getViewPosition, output, reflector, select,
  } = T;
  const Wm = W as any;
  const time = uniform(0), sky = uniform(new Wm.Color(0x8a9aa6));
  const sunDir = uniform(new Wm.Vector3(0, 1, 0)), sunCol = uniform(new Wm.Color(0));

  const wp = positionWorld;
  const camD = length(positionView);
  // zmarszczki: trzy warstwy płynące w różne strony; drobna gaśnie z odległością (bez migotania)
  const g1 = texture(waves, wp.xz.div(3.4).add(vec2(time.mul(0.019), time.mul(0.012)))).xy.mul(2).sub(1);
  const g2 = texture(waves, vec2(wp.z, wp.x.negate()).div(1.9).add(vec2(time.mul(-0.015), time.mul(0.021)))).xy.mul(2).sub(1);
  const g3 = texture(waves, wp.xz.div(0.75).add(vec2(time.mul(0.034), time.mul(-0.027)))).xy.mul(2).sub(1);
  const slope = g1.mul(0.55).add(g2.mul(0.45)).add(g3.mul(0.35).mul(float(1).sub(smoothstep(6, 30, camD))))
    .mul(mix(float(0.2), float(0.06), smoothstep(15, 120, camD)));
  const nW = normalize(vec3(slope.x, 1, slope.y.negate()));
  const nV = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);

  // co leży pod taflą: głębokość sceny w tym pikselu → położenie w świecie
  const sceneAt = (uv: any): any => {
    const vp = getViewPosition(uv, viewportDepthTexture(uv).r, cameraProjectionMatrixInverse);
    return cameraWorldMatrix.mul(vec4(vp, 1)).xyz;
  };
  const V = normalize(cameraPosition.sub(wp));
  const below0 = sceneAt(screenUV);
  const depth0 = max(float(waterY).sub(below0.y), 0);                 // pionowa grubość wody w tym miejscu
  // załamanie: przesunięcie obrazu falą, słabsze na płyciźnie; gdy przesunięty piksel leży nad wodą — bez przesunięcia
  const off = slope.mul(0.06).mul(smoothstep(0, 0.6, depth0));
  const uvR0 = screenUV.add(off);
  const okR = sceneAt(uvR0).y.lessThan(waterY);
  const uvR = select(okR, uvR0, screenUV);
  const below = sceneAt(uvR);
  const path = min(length(below.sub(wp)), 40);                        // droga promienia w wodzie
  // pochłanianie jak w prawdziwej wodzie: czerwień gaśnie najszybciej, błękit najwolniej (dawniej odwrotnie — toń
  // wychodziła brunatna i czarna już na metrze głębokości)
  const tr = exp((clear ? vec3(1.15, 0.38, 0.32) : vec3(1.7, 0.95, 0.9)).mul(path).negate()); // co przechodzi przez toń (na kanał)
  const bottom = viewportSharedTexture(uvR).rgb;

  // toń: kolor rozproszony w wodzie, oświetlony jak każda powierzchnia (słońce, cień, niebo) — z `output`
  const body = mix(output.rgb, bottom, tr);
  // odbicie sceny z lustra, zniekształcone falą
  const refl = reflector({ resolutionScale: 0.5 });
  // lustro rysuje tylko warstwę REFLECT_LAYER (markReflect zdejmuje z niej trawę, mgłę, dym, chmury…) i co drugą
  // klatkę (w poprzedniej zostaje gotowy obraz) — wcześniej cała scena rysowała się w każdej klatce drugi raz
  const base = refl._reflectorBaseNode;
  if (base) {
    const getCam = base.getVirtualCamera.bind(base);
    base.getVirtualCamera = (cam: THREE.Camera): THREE.Camera => { const v = getCam(cam); v.layers.set(REFLECT_LAYER); return v; };
    const upd = base.updateBefore.bind(base);
    let n = 0;
    base.updateBefore = (frame: unknown): unknown => (base.hasOutput && (!reflectGate.on || (n++ & 1)) ? undefined : upd(frame));
  }
  refl.uvNode = refl.uvNode.add(slope.mul(0.25));
  const F = float(0.06).add(float(0.94).mul(pow(float(1).sub(clamp(dot(nW, V), 0, 1)), 5)));
  const rDir = reflect(V.negate(), nW);
  const glint = pow(max(dot(normalize(rDir), sunDir), 0), 700);
  const spec = sunCol.mul(glint).mul(3);
  let col: any = refl.rgb.mul(F).add(body.mul(float(1).sub(F))).add(spec);
  // przy samym brzegu woda wygasa w obraz dna (bez kantu)
  col = mix(viewportSharedTexture(screenUV).rgb, col, smoothstep(0, 0.035, depth0));
  // piana przy brzegu (Michał 11.11.2026: „fale przy morzu, piana”): pasy piany biegną do brzegu i gasną na płyciźnie,
  // poszarpane szumem zmarszczek; najgęstsza tuż przy linii wody, dalej tylko grzbiety fal
  const shore = float(1).sub(smoothstep(0.0, 0.16, depth0));
  const fn = g1.x.mul(0.35).add(g3.y.mul(0.3)).add(0.5);
  const bands = pow(sin(depth0.mul(55).sub(time.mul(1.4)).add(g2.x.mul(1.6))).mul(0.5).add(0.5), 5);
  const foam = clamp(shore.mul(shore).mul(bands.mul(0.9).add(shore.mul(0.6))).mul(smoothstep(0.3, 0.7, fn.add(shore.mul(0.25)))), 0, 1)
    .mul(smoothstep(0.002, 0.012, depth0)).mul(float(1).sub(smoothstep(40, 140, camD)));
  const foamC = mix(vec3(0.62, 0.66, 0.66), vec3(0.95, 0.96, 0.94), clamp(sunCol.r.add(sunCol.g).mul(0.25).add(0.4), 0, 1));
  col = mix(col, foamC, foam.mul(0.85));
  // tafla od spodu (kamera pod wodą): świat nad wodą widać przez falującą powierzchnię, przyćmiony i zielonkawy;
  // pod ostrym kątem całkowite odbicie — tafla jak ciemne lustro toni (okno Snella)
  const under = cameraPosition.y.lessThan(waterY);
  const up = viewportSharedTexture(screenUV.add(slope.mul(0.05))).rgb;
  const snell = smoothstep(0.55, 0.75, clamp(dot(V, vec3(0, -1, 0)), 0, 1));
  const fromBelow = mix(vec3(0.02, 0.09, 0.1), up.mul(vec3(0.75, 0.95, 0.95)), snell);
  col = select(under, fromBelow, col);

  const m = new Wm.MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0 });
  m.colorNode = clear ? vec3(0.03, 0.19, 0.2) : vec3(0.045, 0.1, 0.085); // barwa rozproszona w toni
  m.normalNode = nV;
  m.outputNode = vec4(min(col, vec3(30)), 1);
  // rysowana po całej nieprzezroczystej scenie (obraz spod tafli), ale sama zapisuje głębię jak bryła
  m.transparent = true;
  m.depthWrite = true;
  m.side = Wm.DoubleSide; // od spodu też (pływanie pod wodą)
  void sky;
  return { mat: m, time, sky, sunDir, sunCol, target: refl.target };
}

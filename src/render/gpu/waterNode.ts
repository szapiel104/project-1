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
export interface GpuWater {
  mat: THREE.MeshStandardMaterial;
  time: { value: number }; sky: { value: THREE.Color }; sunDir: { value: THREE.Vector3 }; sunCol: { value: THREE.Color };
  /** Obiekt, za którym idzie lustro — dodać jako dziecko tafli (płaszczyzna XY tafli) */
  target: THREE.Object3D;
}

export function waterNodeMaterial(waves: THREE.Texture, waterY: number): GpuWater {
  const { W, TSL } = gpuMods!;
  const T = TSL as any;
  const {
    uniform, texture, vec2, vec3, vec4, float, mix, smoothstep, clamp, max, min, pow, exp, dot, normalize, length, reflect,
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
  const tr = exp(vec3(2.7, 2.1, 3.1).mul(path).negate());              // co przechodzi przez toń (na kanał)
  const bottom = viewportSharedTexture(uvR).rgb;

  // toń: kolor rozproszony w wodzie, oświetlony jak każda powierzchnia (słońce, cień, niebo) — z `output`
  const body = mix(output.rgb, bottom, tr);
  // odbicie sceny z lustra, zniekształcone falą
  const refl = reflector({ resolutionScale: 0.5 });
  refl.uvNode = refl.uvNode.add(slope.mul(0.25));
  const F = float(0.035).add(float(0.965).mul(pow(float(1).sub(clamp(dot(nW, V), 0, 1)), 5)));
  const rDir = reflect(V.negate(), nW);
  const glint = pow(max(dot(normalize(rDir), sunDir), 0), 700);
  const spec = sunCol.mul(glint).mul(3);
  let col: any = refl.rgb.mul(F).add(body.mul(float(1).sub(F))).add(spec);
  // przy samym brzegu woda wygasa w obraz dna (bez kantu)
  col = mix(viewportSharedTexture(screenUV).rgb, col, smoothstep(0, 0.035, depth0));

  const m = new Wm.MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0 });
  m.colorNode = vec3(0.055, 0.07, 0.038);
  m.normalNode = nV;
  m.outputNode = vec4(min(col, vec3(30)), 1);
  // rysowana po całej nieprzezroczystej scenie (obraz spod tafli), ale sama zapisuje głębię jak bryła
  m.transparent = true;
  m.depthWrite = true;
  void sky;
  return { mat: m, time, sky, sunDir, sunCol, target: refl.target };
}

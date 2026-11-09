import type * as THREE from 'three';
import { gpuMods } from './webgpu';
import { CLOUD_U, sharedNoise } from '../ground';
import { underwater } from './underwaterNode';

/**
 * Efekty obrazu na WebGPU (docs/webgpu.md, partia 1) — bliźniak łańcucha EffectComposer z `scene.ts`:
 * scena (MRT: kolor + normalne) → cieniowanie zagłębień (GTAO, ciepły brąz jak N8AO) → poświata (gdy włączona) →
 * przycięcie jasności → tone mapping + sRGB → gradacja barw (ta sama co `grade` w scene.ts) → FXAA/SMAA → wyostrzenie
 * (ta sama co `sharpenPass` w postfx.ts). Zmiana w GLSL gradacji albo wyostrzenia = ta sama zmiana tutaj.
 */
export interface GpuPostOptions { ao: 'off' | 'low' | 'medium' | 'high'; bloom: boolean; aa: string; sharpen: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export class GpuPost {
  private pipe: any;
  private u: Record<string, any> = {};
  private opts: GpuPostOptions = { ao: 'medium', bloom: false, aa: 'off', sharpen: 0 };
  private built = '';

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera) {
    const { W, TSL } = gpuMods!;
    const T = TSL as any;
    this.pipe = new (W as any).RenderPipeline(renderer);
    this.pipe.outputColorTransform = false; // tone mapping i sRGB robimy sami przed gradacją (jak OutputPass przed `grade`)
    this.u = {
      night: T.uniform(0), rain: T.uniform(0), golden: T.uniform(0), bright: T.uniform(1),
      sharpen: T.uniform(0), texel: T.uniform(new (W as any).Vector2(1, 1)), sun: T.uniform(new (W as any).Vector3(0, 1, 0)), aoK: T.uniform(0.7), indoor: T.uniform(0),
    };
  }

  /** Wartości gradacji z ShaderPassa `grade` (scene.ts ustawia je jak dotąd) */
  /** Pod dachem (sala, sztolnia w spacerze): bez cieni chmur i słabsze AO (w ciasnych wnętrzach zaciemniało wszystko) */
  setIndoor(k: number): void { this.u.indoor.value = k; this.u.aoK.value = 0.7 - 0.38 * k; }

  /** Kierunek do słońca (świat) — kaustyki i promienie pod wodą */
  setSun(d: THREE.Vector3): void { this.u.sun.value.copy(d).normalize(); }

  sync(grade: Record<string, { value: unknown }>, w: number, h: number): void {
    this.u.night.value = grade.night!.value; this.u.rain.value = grade.rain!.value;
    this.u.golden.value = grade.golden!.value; this.u.bright.value = grade.bright!.value;
    this.u.texel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
  }

  configure(o: Partial<GpuPostOptions>): void {
    Object.assign(this.opts, o);
    this.u.sharpen.value = this.opts.sharpen;
  }

  /** Klucz układu efektów: gdy się zmienia, scena.ts robi nowy GpuPost zamiast przebudowywać ten w miejscu */
  static keyOf(o: GpuPostOptions): string { return `${o.ao}|${o.bloom}|${o.aa}|${o.sharpen > 0}`; }
  dispose(): void { try { this.pipe?.dispose?.(); } catch { /* stary łańcuch i tak idzie do kosza */ } }

  render(): void {
    const key = GpuPost.keyOf(this.opts);
    if (key !== this.built) this.build(key);
    this.pipe.render();
  }

  private build(key: string): void {
    this.built = key;
    const { TSL } = gpuMods!;
    const T = TSL as any;
    const { pass, vec2, vec3, vec4, float, dot, mix,
      smoothstep, pow, max, min, clamp, sqrt, screenUV, renderOutput, convertToTexture } = T;
    const fx = gpuMods!.FX as any;
    const o = this.opts;
    const msaa = o.ao === 'off' && o.aa.startsWith('msaa') ? 4 : 0;
    const sp = pass(this.scene, this.camera, { samples: msaa });
    // AO z samego bufora głębi (normalne odtwarzane z głębi, bez osobnego bufora normalnych): przezroczyste bryły
    // (dym, płomienie, poświaty) nie piszą głębi, więc nie psują AO — wcześniej ich płaskie normalne w buforze
    // normalnych dawały ciemne prostokąty i romby wokół ognia i dymu (Michał 3.11.2026). Przy okazji przełączenie AO
    // nie zmienia już wyjść materiałów, więc nie składa wszystkiego od nowa.
    const col = sp.getTextureNode('output');
    let c: any = col.rgb;
    if (o.ao !== 'off') {
      const dep = sp.getTextureNode('depth');
      const aoN = fx.ao(dep, null, this.camera);
      // pół rozdzielczości zawsze (odszumianie i tak wygładza): pełna przy 4K kosztowała kartę więcej niż cała scena
      aoN.resolutionScale = 0.5;
      // siła i zasięg cienia w zagłębieniach (do strojenia: ?aor=promień&aop=wykładnik&aok=siła). Dawne 1,6 / 2,2 / pełna
      // siła zaciemniały całą scenę — trawa i mury wychodziły o połowę ciemniejsze niż w WebGL (Michał 3.11.2026: „zamek ciemny”)
      const qp = new URLSearchParams(location.search);
      const num = (k: string, d: number): number => { const v = parseFloat(qp.get(k) ?? ''); return Number.isFinite(v) ? v : d; };
      aoN.radius.value = num('aor', 0.9);
      aoN.distanceFallOff.value = 0.6;
      aoN.samples.value = o.ao === 'high' ? 16 : o.ao === 'low' ? 8 : 12;
      const aoT: any = aoN.getTextureNode();
      // odszumianie liczy się w miejscu (węzeł w tym samym przejściu), bez osobnej tekstury
      const raw = o.ao !== 'low' ? fx.denoise(aoT, dep, null, this.camera).r : aoT.sample(screenUV).r;
      const a = mix(float(1), pow(raw, num('aop', 1.2)), this.u.aoK.mul(num('aok', 1)));
      c = c.mul(mix(vec3(0.0103, 0.0060, 0.0030), vec3(1), a)); // ciepły brąz w zagłębieniach (0x1a120a w liniowym)
    }
    // cienie chmur sunące po ziemi: jedno przejście na cały obraz — położenie w świecie z bufora głębi, maska z szumu
    // (jak cloudShade w ground.ts dla WebGL), niebo bez zmian
    // UWAGA: w przejściu obrazu węzły cameraPosition / cameraWorldMatrix / cameraProjectionMatrixInverse dotyczą kamery
    // prostokąta na cały ekran, nie kamery sceny — macierze kamery sceny podajemy sami (0.94.12 liczyło z tego
    // „wodę” na pół ekranu, a cienie chmur leżały w złych miejscach; Michał 3.11.2026: „problem z cieniami”, 10 FPS)
    const cam = this.camera;
    const Wm = gpuMods!.W as any;
    const camPos = T.uniform(new Wm.Vector3()).onFrameUpdate(() => new Wm.Vector3().setFromMatrixPosition(cam.matrixWorld));
    const camWorld = T.uniform(new Wm.Matrix4()).onFrameUpdate(() => cam.matrixWorld);
    const camProjInv = T.uniform(new Wm.Matrix4()).onFrameUpdate(() => cam.projectionMatrixInverse);
    const sceneCam = { pos: camPos, world: camWorld, projInv: camProjInv };
    {
      const dep = sp.getTextureNode('depth');
      const dv = dep.sample(screenUV).r;
      const vp = T.getViewPosition(screenUV, dv, camProjInv);
      const wpos = camWorld.mul(T.vec4(vp, 1)).xyz;
      const cT = T.uniform(0).onFrameUpdate(() => CLOUD_U.cloudT.value), cK = T.uniform(0).onFrameUpdate(() => CLOUD_U.cloudK.value);
      const cuv = wpos.xz.div(70).add(vec2(0.006, 0.0035).mul(cT));
      const nz = T.texture(sharedNoise(), cuv).r.mul(0.65).add(T.texture(sharedNoise(), cuv.mul(2.3).add(0.37)).g.mul(0.35));
      const ccm = cK.mul(smoothstep(0.28, 0.78, nz)).mul(T.step(dv, 0.9999)).mul(float(1).sub(this.u.indoor));
      // łagodniej niż dawne 0,55 i z miękkim brzegiem (Michał 3.11.2026: ostre, ciemne plamy na pustyni)
      c = c.mul(float(1).sub(ccm.mul(0.3)));
    }
    // pod wodą: nurkowanie (gpu/underwaterNode.ts) — linia wody, załamanie, toń, kaustyki, promienie słońca
    c = underwater(T, { col, dep: sp.getTextureNode('depth'), c, night: this.u.night, sun: this.u.sun, cam: sceneCam, indoor: this.u.indoor });
    c = clamp(c, 0, 40);
    if (o.bloom) c = c.add(fx.bloom(vec4(c, 1), 0.18, 0.45, 1.6).rgb);
    // tone mapping i sRGB jawnie z renderera: bez tego węzeł brał je z kontekstu przejścia, a FXAA/SMAA liczą obraz
    // w osobnym przejściu bez tego kontekstu — wtedy wychodził obraz liniowy, bez sRGB, czyli dużo ciemniejszy
    // (Michał 3.11.2026: „zamek ciemny”; bez efektów albo w WebGL było jasno)
    c = renderOutput(vec4(c, 1), this.renderer.toneMapping, this.renderer.outputColorSpace).rgb;
    c = this.grade(T, c);
    let img: any = vec4(clamp(c, 0, 1), 1);
    // MSAA działa tu tylko bez AO (przejście z normalnymi do AO jest bez próbek): przy AO zamiast MSAA wygładza SMAA —
    // inaczej Ultra (AO + MSAA 8×) wychodziło bez żadnego wygładzania, z poszarpanymi krawędziami
    // (Michał 3.11.2026: „jakby w najgorszej grafice, a jest na ultra”)
    const aa = o.aa.startsWith('msaa') && !msaa ? 'smaa' : o.aa;
    if (aa === 'fxaa') img = fx.fxaa(img);
    else if (aa === 'smaa') img = fx.smaa(img);
    if (o.sharpen > 0) {
      const tex = convertToTexture(img);
      const tx = this.u.texel, amount = this.u.sharpen;
      const at = (dx: number, dy: number) => tex.sample(screenUV.add(vec2(tx.x.mul(dx), tx.y.mul(dy)))).rgb;
      const cc = tex.sample(screenUV).rgb, n = at(0, -1), s = at(0, 1), w = at(-1, 0), e = at(1, 0);
      const mn = min(cc, min(min(n, s), min(w, e))), mx = max(cc, max(max(n, s), max(w, e)));
      const amp = sqrt(clamp(min(mn, vec3(1).sub(mx)).div(max(mx, 1e-4)), 0, 1));
      const wgt = amp.negate().mul(mix(float(0.125), float(0.2), amount));
      img = vec4(clamp(cc.add(n.add(s).add(w).add(e).mul(wgt)).div(wgt.mul(4).add(1)), 0, 1), 1);
    }
    this.pipe.outputNode = img;
    this.pipe.needsUpdate = true;
    void dot; void smoothstep;
  }

  /** Gradacja barw — kopia fragmentShadera `grade` ze scene.ts */
  private grade(T: any, c0: any): any {
    const { vec3, float, dot, mix, smoothstep, pow, max, screenUV } = T;
    const { night, rain, golden, bright } = this.u;
    const ss = (a: number, b: number, x: any) => smoothstep(a, b, x);
    const l = dot(c0, vec3(0.299, 0.587, 0.114));
    const day = float(1).sub(night).mul(float(1).sub(rain));
    let c: any = mix(vec3(l), c0, day.mul(0.3).add(0.74).sub(rain.mul(0.15)).add(golden.mul(0.1))); // w dzień trochę żywsze barwy (Michał 7.11.2026: „ciemna, twarda”)
    c = mix(c, c.mul(vec3(1.05, 1.02, 0.94)), day.mul(ss(0.25, 0.8, l)));
    c = c.add(day.mul(0.05).mul(vec3(1).sub(c)).mul(ss(0.05, 0.45, l)));
    c = mix(c, c.mul(vec3(1.14, 1.0, 0.8)), golden.mul(ss(0.15, 0.75, l)));
    c = mix(c.mul(vec3(1.06, 0.98, 0.86)), c, ss(0.0, 0.6, l));
    c = c.sub(0.5).mul(1.03).add(0.5); // łagodniejszy kontrast (dawniej 1,08)
    c = c.add(day.mul(0.035).mul(float(1).sub(ss(0.0, 0.4, l)))); // cienie nie toną w czerni
    c = mix(c, c.mul(vec3(0.72, 0.8, 1.05)), night.mul(0.35));
    c = c.mul(float(1).sub(rain.mul(0.12)));
    c = pow(max(c, 0), vec3(float(1).div(pow(bright, 1.1)))).mul(mix(float(1), bright, 0.35));
    const d = screenUV.sub(0.5);
    c = c.mul(float(1).sub(dot(d, d).mul(night.mul(1.13).add(0.32)).div(bright))); // w dzień słabsza winieta, w nocy jak dawniej
    return c;
  }
}

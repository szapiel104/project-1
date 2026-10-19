import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Dodatkowa jakość obrazu z ustawień grafiki: wygładzanie krawędzi, filtrowanie tekstur, odbicia otoczenia, wyostrzenie.
 * Działa na wszystkie modele naraz, bez ruszania plików modeli.
 */

/** Wygładzanie krawędzi: wyłączone, FXAA (najtańsze), SMAA (ostre), MSAA 2×/4×/8× (najlepsze dla modeli i liści) */
export type AaMode = 'off' | 'fxaa' | 'smaa' | 'msaa2' | 'msaa4' | 'msaa8';

/** Ile próbek MSAA daje dany tryb (0 = bez MSAA) */
export function msaaSamples(mode: AaMode | undefined): number {
  return mode === 'msaa2' ? 2 : mode === 'msaa4' ? 4 : mode === 'msaa8' ? 8 : 0;
}

/**
 * Mapa otoczenia pod plener: łagodne niebo bez gorących punktów (chłodny zenit, jasny, mglisty widnokrąg, ciemna,
 * brunatna ziemia). Materiały PBR dostają z niej rozproszone światło i delikatne odbicia z każdej strony, więc nie są
 * płaskie po stronie cienia. Celowo nie RoomEnvironment z podglądu modeli: ma jaskrawe lampy pod sufitem, które
 * odbijały się w trawie i liściach skierowanych do góry (trawa „świeciła”).
 */
export function makeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 zenith = vec3(0.52, 0.6, 0.72), horizon = vec3(0.86, 0.84, 0.78), ground = vec3(0.2, 0.17, 0.12);
        vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon * 0.55, ground, pow(-y, 0.4));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat);
  scene.add(dome);
  const tex = pmrem.fromScene(scene, 0).texture;
  dome.geometry.dispose(); mat.dispose(); pmrem.dispose();
  return tex;
}

/**
 * Wyostrzenie adaptacyjne (w stylu AMD CAS): wzmacnia drobne szczegóły tekstur tam, gdzie kontrast jest mały,
 * a krawędzi o dużym kontraście prawie nie rusza (bez obwódek). Przydaje się przy FXAA/SMAA i niższej rozdzielczości.
 */
export function sharpenPass(): ShaderPass {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1, 1) }, amount: { value: 0.4 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 texel; uniform float amount; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
        vec3 w = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb;
        vec3 mn = min(c, min(min(n, s), min(w, e)));
        vec3 mx = max(c, max(max(n, s), max(w, e)));
        // im bliżej czerni albo bieli i im większy kontrast wokół, tym słabiej (brak obwódek na krawędziach)
        vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
        vec3 wgt = -amp * mix(0.125, 0.2, amount);
        vec3 outc = (c + (n + s + w + e) * wgt) / (1.0 + 4.0 * wgt);
        gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
      }`,
  });
  return pass;
}

const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'alphaMap', 'displacementMap', 'specularMap'] as const;

/**
 * Ustawia jakość materiałów w scenie: filtrowanie anizotropowe wszystkich tekstur (także tekstur terenu w shaderach)
 * i alpha to coverage dla liści, trawy i włosów przy MSAA (miękkie, pełne brzegi zamiast poszarpanych schodków).
 * Przechodzi tylko po nowych albo zmienionych materiałach, więc można to wołać co jakiś czas.
 */
export class MaterialQuality {
  private seen = new WeakMap<THREE.Material, string>();
  private texSeen = new WeakMap<THREE.Texture, number>();
  private key = '';
  aniso = 16;
  coverage = false;

  constructor(private maxAniso: number) {}

  set(aniso: number, coverage: boolean): void {
    this.aniso = Math.max(1, Math.min(this.maxAniso, aniso));
    this.coverage = coverage;
    this.key = `${this.aniso}|${coverage ? 1 : 0}`;
  }

  /** Przejście po scenie; zwraca liczbę zmienionych materiałów */
  sweep(root: THREE.Object3D): number {
    let changed = 0;
    root.traverse((o) => {
      const mats = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) if (m && this.seen.get(m) !== this.key) { this.material(m); changed++; }
    });
    return changed;
  }

  private material(m: THREE.Material): void {
    this.seen.set(m, this.key);
    const rec = m as unknown as Record<string, unknown>;
    for (const k of TEX_KEYS) this.texture(rec[k]);
    const sm = m as THREE.ShaderMaterial;
    if (sm.isShaderMaterial && sm.uniforms) {
      for (const u of Object.values(sm.uniforms)) {
        const v = u?.value as unknown;
        if (Array.isArray(v)) for (const x of v) this.texture(x); else this.texture(v);
      }
      return; // własne shadery: alpha to coverage tylko dla zwykłych materiałów (własny shader mógłby nie dawać alfy)
    }
    // przycinane przezroczystością (liście, igły, trawa, włosy) — przy MSAA brzeg wygładza karta graficzna
    if (m.alphaTest > 0 && !m.transparent) {
      // liście, trawa, igły: cienkie karty z normalnymi do góry — odbicie nieba robiło na nich połysk, więc tylko trochę
      const sm2 = m as THREE.MeshStandardMaterial;
      if (sm2.isMeshStandardMaterial && !(m.userData as { envKeep?: boolean }).envKeep && sm2.envMapIntensity === 1) sm2.envMapIntensity = 0.35;
      const want = this.coverage;
      const tag = m.userData as { a2c?: boolean };
      if (tag.a2c === undefined) tag.a2c = m.alphaToCoverage; // materiał, który miał to od początku (koń), zostawiamy
      const target = tag.a2c || want;
      if (m.alphaToCoverage !== target) { m.alphaToCoverage = target; m.needsUpdate = true; }
    }
  }

  private texture(v: unknown): void {
    const t = v as THREE.Texture | null;
    if (!t || !t.isTexture || (t as THREE.DataTexture).isDataTexture || (t as THREE.DepthTexture).isDepthTexture) return;
    if (this.texSeen.get(t) === this.aniso) return;
    this.texSeen.set(t, this.aniso);
    if (t.anisotropy === this.aniso) return;
    t.anisotropy = this.aniso;
    // już wysłana do karty: wyślij jeszcze raz z nowym filtrowaniem; jeszcze niewczytana dostanie je przy pierwszym wysłaniu
    if (t.version > 0 && (t.image || (t as THREE.CompressedTexture).mipmaps?.length)) t.needsUpdate = true;
  }
}

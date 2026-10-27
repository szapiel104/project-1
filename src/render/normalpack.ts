import * as THREE from 'three';

/**
 * Dwie mapy normalnych w jednej teksturze: RG = x, y pierwszej, BA = x, y drugiej (z liczy shader: sqrt(1 − x² − y²)).
 *
 * Po co: shader podłoża ma swoje 14 tekstur, a three.js dokłada mapę cieni, odbicia otoczenia (envMap, przy
 * włączonych odbiciach) i mapę śladów w śniegu — razem 17. Karty z ANGLE/D3D11 dają shaderowi 16, więc three.js
 * przy każdym rysowaniu ziemi sypał ostrzeżeniem (~60 na sekundę). Po spakowaniu par normalnych podłoże bierze
 * o dwie tekstury mniej (15 z odbiciami) i zostaje zapas na kolejne efekty.
 *
 * Pakowanie robi karta graficzna raz, gdy obie tekstury już doszły (KTX2 albo zapasowy JPG): jedno narysowanie
 * kwadratu do celu RGBA8 z mipmapami. Do tego czasu shader dostaje płaską normalną (1 × 1 piksel).
 */
export interface PackedNormals {
  /** Tekstura do shadera (najpierw płaska, po spakowaniu — wynik) */
  readonly uniform: { value: THREE.Texture };
  /** Pakuje, gdy obie tekstury są gotowe; potem nic nie robi. Wołać z rysowania (potrzebny renderer). */
  update(renderer: THREE.WebGLRenderer): void;
  dispose(): void;
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D tA, tB; varying vec2 vUv;
void main() {
  // poziom 0 wprost: cel ma ten sam rozmiar co źródło, mipmapy liczy potem three.js z wyniku
  vec2 a = texture2D(tA, vUv, -16.0).xy, b = texture2D(tB, vUv, -16.0).xy;
  gl_FragColor = vec4(a, b);
}`;

let flat: THREE.DataTexture | null = null;
/** Płaska normalna (x = y = 0,5 → wektor w górę) na czas wczytywania */
function flatNormal(): THREE.DataTexture {
  if (flat) return flat;
  flat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1, THREE.RGBAFormat);
  flat.wrapS = flat.wrapT = THREE.RepeatWrapping;
  flat.needsUpdate = true;
  return flat;
}

const loaded = (t: THREE.Texture): boolean => !!t.image && t.version > 0;

export function packNormals(a: THREE.Texture, b: THREE.Texture, size: number): PackedNormals {
  const uniform = { value: flatNormal() as THREE.Texture };
  let rt: THREE.WebGLRenderTarget | null = null;
  let done = false;
  return {
    uniform,
    update(renderer) {
      if (done || !loaded(a) || !loaded(b)) return;
      done = true;
      rt = new THREE.WebGLRenderTarget(size, size, {
        type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
        generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: Math.min(16, renderer.capabilities.getMaxAnisotropy()),
      });
      const mat = new THREE.ShaderMaterial({ uniforms: { tA: { value: a }, tB: { value: b } }, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      quad.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(quad);
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
      const prevAuto = renderer.autoClear;
      renderer.autoClear = true;
      try {
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
      } finally {
        renderer.setRenderTarget(prev, face, level);
        renderer.autoClear = prevAuto;
        quad.geometry.dispose(); mat.dispose();
      }
      uniform.value = rt.texture;
    },
    dispose() { rt?.dispose(); rt = null; },
  };
}

import * as THREE from 'three';

/** Część drzewa do sfotografowania: bryła, barwa i tekstura */
export interface ImpostorPart { geo: THREE.BufferGeometry; color: number; map?: THREE.Texture | null; vertexColors?: boolean; /** karty z przezroczystością (liście, igły) */ alpha?: boolean }

const FRAMES = 8;

/**
 * Daleki las jako płaskie obrazki: drzewo fotografujemy raz z 8 stron do jednej tekstury, a potem każde dalekie
 * drzewo to jeden prostokąt zwrócony do kamery (obrót tylko wokół pionu), z klatką z tej strony, z której patrzymy.
 * Dwa trójkąty zamiast kilkuset; światło, mgła i noc działają jak na zwykłych bryłach.
 */
export function treeImpostor(parts: ImpostorPart[], px = 96): { geometry: THREE.BufferGeometry; material: (inverse?: number) => THREE.MeshStandardMaterial } | null {
  const box = new THREE.Box3();
  for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!); }
  const r = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) * 1.04;
  const W = r * 2, H = box.max.y * 1.03;
  const fw = Math.max(16, Math.round((px * W) / H)), fh = px;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return null; }
  renderer.setSize(fw, fh, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // światło jak w pochmurny dzień z góry: bryła ma głębię, ale obrazek nie ma ostrych cieni (resztę robi światło sceny)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(0, 5, 2); scene.add(sun);
  for (const p of parts) scene.add(new THREE.Mesh(p.geo, new THREE.MeshLambertMaterial({ color: p.color, map: p.map ?? null, vertexColors: !!p.vertexColors, side: THREE.DoubleSide, alphaTest: p.alpha ? 0.5 : 0 })));
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H, 0, 0.1, 40);
  const canvas = document.createElement('canvas');
  canvas.width = fw * FRAMES; canvas.height = fh;
  const ctx = canvas.getContext('2d');
  if (!ctx) { renderer.dispose(); return null; }
  for (let k = 0; k < FRAMES; k++) {
    const a = (k / FRAMES) * Math.PI * 2;
    cam.position.set(Math.sin(a) * 10, 0, Math.cos(a) * 10);
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, k * fw, 0);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  for (const m of scene.children) if ((m as THREE.Mesh).isMesh) ((m as THREE.Mesh).material as THREE.Material).dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geometry = new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0);
  const material = (inverse?: number): THREE.MeshStandardMaterial => {
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    // kawałek lasu przełączany z bryły na obrazek ma w instancjach barwę korony: tu ją znosimy, zostaje sam odcień drzewa
    if (inverse !== undefined) { const c = new THREE.Color(inverse); m.color.setRGB(1 / Math.max(c.r, 0.02), 1 / Math.max(c.g, 0.02), 1 / Math.max(c.b, 0.02)); }
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = `#define FRAMES ${FRAMES}.0\n` + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec3 ipos = instanceMatrix[3].xyz;
          vec3 wpos = (modelMatrix * vec4(ipos, 1.0)).xyz;
          vec3 tc = cameraPosition - wpos; tc.y = 0.0; tc = normalize(tc + vec3(1e-4, 0.0, 0.0));
          float psi = atan(-instanceMatrix[0].z, instanceMatrix[0].x);
          float fr = mod(floor((atan(tc.x, tc.z) - psi) / 6.2831853 * FRAMES + 0.5), FRAMES);
          #ifdef USE_MAP
            vMapUv.x = (vMapUv.x + fr) / FRAMES;
          #endif`)
        .replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = normalMatrix * normalize(vec3(tc.x * 0.55, 0.83, tc.z * 0.55));')
        .replace('#include <begin_vertex>', `float bsx = length(instanceMatrix[0].xyz), bsy = length(instanceMatrix[1].xyz);
          vec3 transformed = ipos + vec3(tc.z, 0.0, -tc.x) * position.x * bsx + vec3(0.0, position.y * bsy, 0.0);`)
        .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\n gl_Position = projectionMatrix * mvPosition;')
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);');
    };
    m.customProgramCacheKey = () => 'tree-impostor';
    return m;
  };
  return { geometry, material };
}

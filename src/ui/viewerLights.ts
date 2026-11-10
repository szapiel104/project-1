/**
 * Światła nocą w podglądzie modeli (Michał 10.11.2026: „jak dodaję pochodnię, nocą nie świeci się w edytorze”).
 * Gra zapala ciepłe światło przy znacznikach z modeli (pochodnie 'lightSpot' / 'torchFlame', latarnie 'lampSpot',
 * ogniska 'campfire', kosze 'brazier'); podgląd robi to samo: stała pula świateł punktowych (bez przebudowy shaderów
 * przy każdej zmianie liczby świateł) ustawiana przy znacznikach najbliżej kamery, z lekkim migotaniem i poświatą.
 */
import * as THREE from 'three';

const NAMES = new Set(['lightSpot', 'torchFlame', 'lampSpot', 'campfire', 'brazier']);
const POOL = 8;

export function createNightLights(scene: THREE.Scene): { update: (root: THREE.Object3D | null, night: boolean, camera: THREE.Camera, span: number) => void } {
  const lights: THREE.PointLight[] = [];
  const glows: THREE.Sprite[] = [];
  // poświata: miękka plama światła w miejscu płomienia (sam płomień rysuje w grze system efektów)
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c2 = cv.getContext('2d')!, gr = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.25, 'rgba(255,150,50,.75)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // światła dokładamy dopiero przy pierwszej nocy: każde światło w scenie zmienia shadery wszystkich materiałów,
  // a w dzień nie są potrzebne (z nimi od startu pierwszy obraz w dzień długo był czarny)
  const ensure = (): void => {
    if (lights.length) return;
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xff9a40, 0, 1.6, 2);
      l.castShadow = false;
      scene.add(l); lights.push(l);
      const s = new THREE.Sprite(glowMat); s.visible = false; scene.add(s); glows.push(s);
    }
  };
  let spots: THREE.Object3D[] = [], lastScan = 0, lastRoot: THREE.Object3D | null = null;
  const w = new THREE.Vector3(), tmp: { o: THREE.Object3D; d: number; p: THREE.Vector3 }[] = [];
  return {
    update(root, night, camera, span) {
      const now = performance.now();
      if (!night || !root) { for (let i = 0; i < lights.length; i++) { lights[i]!.intensity = 0; glows[i]!.visible = false; } return; }
      ensure();
      // znaczniki zbieramy co pół sekundy (edytor dokłada i przesuwa pochodnie)
      if (root !== lastRoot || now - lastScan > 500) {
        spots = [];
        root.traverse((o) => { if (NAMES.has(o.name) && o.visible !== false) { let v = true; for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (!p.visible) { v = false; break; } if (v) spots.push(o); } });
        lastScan = now; lastRoot = root;
      }
      tmp.length = 0;
      for (const o of spots) { o.getWorldPosition(w); tmp.push({ o, d: w.distanceToSquared(camera.position), p: w.clone() }); }
      tmp.sort((a, b) => a.d - b.d);
      const t = now / 1000, unit = Math.max(0.6, Math.min(3, span));
      for (let i = 0; i < POOL; i++) {
        const l = lights[i]!, g = glows[i]!, s = tmp[i];
        if (!s) { l.intensity = 0; g.visible = false; continue; }
        const big = s.o.name === 'campfire' || s.o.name === 'brazier';
        const flick = 0.85 + 0.1 * Math.sin(t * 13 + i * 2.1) + 0.05 * Math.sin(t * 31 + i);
        l.position.copy(s.p);
        l.distance = (big ? 2.4 : 1.4) * unit * 0.6;
        l.intensity = (big ? 1.6 : 0.7) * flick;
        g.position.copy(s.p);
        g.scale.setScalar((big ? 0.22 : 0.1) * flick);
        g.visible = true;
      }
    },
  };
}

/**
 * Miniatury modeli na liście w podglądzie modeli (Michał 10.11.2026: „w postaci ikonek, małych zdjęć”).
 * Każdą rysuje ta sama karta w tej samej klatce co scenę, przed nią (płótno pokazuje tylko ostatni obraz klatki,
 * więc nic nie miga), po jednej na klatkę i tylko te, które widać na liście. Gotowe miniatury zostają w przeglądarce
 * (localStorage, klucz z numerem buildu — po nowej wersji gry rysują się od nowa).
 */
import * as THREE from 'three';

type Renderer = { render: (s: THREE.Object3D, c: THREE.Camera) => void; domElement: HTMLCanvasElement; compileAsync?: (o: THREE.Object3D, c: THREE.Camera, s?: THREE.Scene) => Promise<unknown> };

export function createThumbs(renderer: Renderer, scene: THREE.Scene, isolate: () => () => void, make: (id: string) => THREE.Object3D | null, build: string): {
  watch: (id: string, img: HTMLImageElement) => void;
  step: () => void;
} {
  const key = (id: string): string => `p1-thumb:${build}:${id}`;
  // stare miniatury z poprzednich buildów sprzątamy przy starcie
  try {
    for (let k = localStorage.length - 1; k >= 0; k--) { const n = localStorage.key(k); if (n?.startsWith('p1-thumb:') && !n.startsWith(`p1-thumb:${build}:`)) localStorage.removeItem(n); }
  } catch { /* bez pamięci */ }
  const want = new Map<HTMLImageElement, string>();
  const io = new IntersectionObserver((es) => {
    for (const e of es) { const img = e.target as HTMLImageElement; if (e.isIntersecting && img.dataset.id && !img.dataset.done) want.set(img, img.dataset.id); else want.delete(img); }
  });
  // rysujemy w scenie podglądu (te same światła i otoczenie — osobna scena z innymi światłami zmuszała kartę do
  // przebudowy shaderów w każdej klatce i wszystko robiło się czarne); reszta sceny na ten moment schowana
  const sc = scene;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  let last = 0, busy = false;
  let ready: { img: HTMLImageElement; id: string; obj: THREE.Object3D } | null = null;
  function frame(obj: THREE.Object3D): boolean {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return false;
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.5 || 0.5;
    const cv = renderer.domElement;
    cam.aspect = cv.width / Math.max(1, cv.height);
    cam.near = r * 0.05; cam.far = r * 20; cam.updateProjectionMatrix();
    cam.position.copy(c).add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(r * 2.9)); cam.lookAt(c);
    return true;
  }
  function shoot(job: { img: HTMLImageElement; id: string; obj: THREE.Object3D }): void {
    const { img, id, obj } = job;
    if (!frame(obj)) return;
    const restore = isolate();
    sc.add(obj);
    renderer.render(sc, cam);
    const cv = renderer.domElement;
    const out = document.createElement('canvas'); out.width = out.height = 112;
    const side = Math.min(cv.width, cv.height);
    out.getContext('2d')!.drawImage(cv, (cv.width - side) / 2, (cv.height - side) / 2, side, side, 0, 0, 112, 112);
    sc.remove(obj);
    restore();
    const url = out.toDataURL('image/jpeg', 0.8);
    img.src = url;
    try { localStorage.setItem(key(id), url); } catch { /* pełna pamięć — narysuje się następnym razem */ }
  }
  return {
    watch(id, img) {
      img.dataset.id = id;
      try { const v = localStorage.getItem(key(id)); if (v) { img.src = v; img.dataset.done = '1'; return; } } catch { /* bez pamięci */ }
      io.observe(img);
    },
    step() {
      // najpierw shadery modelu (compileAsync), dopiero w kolejnej klatce zdjęcie — inaczej pierwsza klatka bywa czarna
      if (busy) return;
      if (ready) { shoot(ready); ready = null; return; }
      const now = performance.now();
      if (!want.size || now - last < 40) return;
      last = now;
      const [img, id] = want.entries().next().value as [HTMLImageElement, string];
      want.delete(img); io.unobserve(img); img.dataset.done = '1';
      let obj: THREE.Object3D | null = null;
      try { obj = make(id); } catch { obj = null; }
      if (!obj) return;
      const job = { img, id, obj };
      if (!renderer.compileAsync) { ready = job; return; }
      busy = true;
      frame(obj);
      sc.add(obj);
      const restore = isolate();
      const p = renderer.compileAsync(sc, cam, sc);
      restore(); sc.remove(obj);
      void p.catch(() => undefined).then(() => { busy = false; ready = job; });
    },
  };
}

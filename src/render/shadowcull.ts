import type * as THREE from 'three';

/**
 * Cienie drobiazgów tylko z bliska (Michał 7.11.2026: „gra jest drewnem i zacina”). Mapa cieni to drugie rysowanie
 * wszystkiego, a hamuje liczba rysowań, nie karta: ludzie, zwierzęta, graty na podwórkach i niesione ładunki
 * z daleka rzucają cień na kilka pikseli, a kosztują po kilka rysowań na rodzaj. Budynki, drzewa, mury i teren
 * rzucają cień zawsze.
 */
const SMALL = ['postacie', 'zwierzęta i wieś', 'rodziny i podwórka', 'graty przy domach', 'niesione', 'wilki', 'kruki',
  'groby w lesie', 'wozy z surowcami', 'ryby', 'ślady', 'tarany', 'koksowniki',
  // drobna roślinność i kamyki (0.94.54): z daleka cień na kilka pikseli, a każdy rodzaj to osobne rysowanie w mapie cieni
  'kamyki', 'krzewy', 'podszyt', 'kępy trawy', 'kwiaty', 'trzcina'];

/**
 * Drobiazgi w budynkach (Michał 7.11.2026, pomiar w Chrome: z oddalenia 475 z ok. 500 rysowań w mapie cieni to „budynki”):
 * wnętrza, zapasy, pochodnie, kłody na podwórku, sufity i życie obejścia. Z daleka cień takiej rzeczy ma kilka pikseli
 * i leży wewnątrz cienia murów, więc rzucają go tylko z bliska. Mury, dachy i kominy (`shell`, `roof`, `chimney`) rzucają zawsze.
 */
const INNER = new Set(['interior', 'foodfill', 'fill', 'grainfill', 'yardlog', 'ceiling', 'life', 'torch', 'flagcloth', 'crop']);

const isSmall = (o: THREE.Object3D): boolean => {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) {
    if (q.name && INNER.has(q.name)) return true;
  }
  for (let q: THREE.Object3D | null = o; q; q = q.parent) {
    const c = q.userData.cat as string | undefined;
    if (c) return SMALL.some((p) => c.startsWith(p));
  }
  return false;
};

export class SmallShadows {
  private list: THREE.Mesh[] = [];
  private frame = 0;
  private far = false;
  /** NEAR/FAR: odległość kamery, poniżej której drobiazgi rzucają cień i powyżej której przestają (z histerezą) */
  constructor(private near = 30, private farAt = 34) {}

  update(scene: THREE.Scene, camDistance: number): void {
    const far = this.far ? camDistance > this.near : camDistance > this.farAt;
    // co 60 klatek nowy spis (pule i budynki przybywają w trakcie gry)
    if (this.frame++ % 60 === 0) {
      const l: THREE.Mesh[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (m.userData.castOrig === undefined) {
          if (!m.castShadow || !isSmall(m)) return;
          m.userData.castOrig = true;
        }
        l.push(m);
        m.castShadow = !far;
      });
      this.list = l;
    } else if (far !== this.far) for (const m of this.list) m.castShadow = !far;
    this.far = far;
  }
}

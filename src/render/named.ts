import type * as THREE from 'three';

/**
 * `getObjectByName` z pamięcią. Co klatkę szukaliśmy po nazwie kilkunastu części w każdym budynku (wnętrze, płomień,
 * pochodnia, krata…), a każde szukanie to przejście całego drzewa modelu (twierdza ma ich setki). Tu wynik jest
 * zapamiętany przy korzeniu: trafienie wraca od ręki, dopóki część wisi w scenie; brak jest sprawdzany ponownie co
 * ok. pół sekundy, bo niektóre części dochodzą później (ogień po trafieniu, znak „brak pracownika”).
 */
const cache = new WeakMap<THREE.Object3D, Map<string, { o: THREE.Object3D | null; at: number }>>();
let frame = 0;
const RECHECK = 30;

/** Wołać raz na klatkę (liczy czas do ponownego sprawdzenia braków) */
export function namedTick(): void { frame++; }

export function named(root: THREE.Object3D | undefined | null, name: string): THREE.Object3D | undefined {
  if (!root) return undefined;
  let m = cache.get(root);
  if (!m) { m = new Map(); cache.set(root, m); }
  const e = m.get(name);
  if (e) {
    if (e.o) { if (e.o.parent) return e.o; } else if (frame - e.at < RECHECK) return undefined;
  }
  const o = root.getObjectByName(name) ?? null;
  m.set(name, { o, at: frame });
  return o ?? undefined;
}

/** Część dodana ręcznie po chybionym szukaniu — zapisujemy ją od razu, żeby następna klatka jej nie dublowała */
export function remember(root: THREE.Object3D, name: string, o: THREE.Object3D): void {
  let m = cache.get(root);
  if (!m) { m = new Map(); cache.set(root, m); }
  m.set(name, { o, at: frame });
}

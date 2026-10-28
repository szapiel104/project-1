import type * as THREE from 'three';

/**
 * Kopia materiału bez przepuszczania `userData` przez JSON (dziennik Michała 28.10.2026, 0.59.3: ×204 ostrzeżeń
 * „THREE.Texture: Unable to serialize Texture” i spadek do 14 FPS). `Material.clone()` w three.js kopiuje `userData`
 * przez `JSON.stringify`, więc gdy w nim leży inny materiał albo tekstura (np. oryginał podświetlonego budynku),
 * three.js serializuje całe obrazki tekstur przy każdej kopii. Tu `userData` dostaje płytką kopię z tymi samymi
 * odwołaniami — bez serializacji i bez gubienia tekstur.
 */
export function cloneMaterial<T extends THREE.Material>(m: T): T {
  const ud = m.userData;
  m.userData = {};
  try {
    const c = m.clone() as T;
    c.userData = { ...ud };
    return c;
  } finally {
    m.userData = ud;
  }
}

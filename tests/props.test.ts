import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { propGeometry } from '../src/render/props';

// Gotowe modele z paczek (tools/models/props_import.py) mają trafić do gry bez przeróbek wersji z bliska.
// Gdyby ktoś je odchudził albo przeskalował, w grze znów wyjdą pocięte — ten test to wyłapie.
describe('modele z paczek: ryba i pochodnia', () => {
  const tris = (g: THREE.BufferGeometry): number => g.index!.count / 3;
  const box = (g: THREE.BufferGeometry): THREE.Box3 => { g.computeBoundingBox(); return g.boundingBox!; };

  it('ryba z bliska ma wszystkie trójkąty oryginału, długość 1 wzdłuż z i UV', () => {
    const g = propGeometry('fish');
    expect(tris(g)).toBe(3864);
    const b = box(g);
    expect(b.max.z - b.min.z).toBeCloseTo(1, 3);
    expect(b.max.y - b.min.y).toBeLessThan(0.6);
    expect(g.getAttribute('uv').count).toBe(g.getAttribute('position').count);
  });

  it('wersje z daleka są lżejsze, ale w tym samym miejscu', () => {
    for (const n of ['fish', 'torch'] as const) {
      const near = propGeometry(n), far = propGeometry(n, true);
      expect(tris(far)).toBeLessThan(tris(near));
      const a = box(near), b = box(far);
      expect(b.min.distanceTo(a.min)).toBeLessThan(0.02);
      expect(b.max.distanceTo(a.max)).toBeLessThan(0.02);
    }
  });

  it('pochodnia ma wszystkie trójkąty oryginału, głowica pod płomieniem gry (TORCH_TIP)', () => {
    const g = propGeometry('torch');
    expect(tris(g)).toBe(935);
    // najwyższy punkt pochodni w układzie ręki uniesionej o 0,55: tuż pod płomieniem (0,34 od dłoni wzdłuż osi)
    const tipY = -0.19 + Math.cos(0.55) * 0.34;
    expect(box(g).max.y).toBeGreaterThan(tipY - 0.06);
    expect(box(g).max.y).toBeLessThan(tipY + 0.02);
  });
});

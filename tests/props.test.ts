import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { propGeometry, type PropName } from '../src/render/props';

// Zasada Michała (19.10.2026): modele z paczek (tools/models/props_import.py) idą do gry bez odchudzania i docinania.
// Gdyby ktoś je odchudził albo przeskalował, w grze znów wyjdą pocięte — ten test to wyłapie.
describe('modele z paczek: oryginalne siatki', () => {
  const tris = (g: THREE.BufferGeometry): number => g.index!.count / 3;
  const box = (g: THREE.BufferGeometry): THREE.Box3 => { g.computeBoundingBox(); return g.boundingBox!; };
  // liczba trójkątów oryginału z paczki (kosz bez wieka); worek z tools/models/sack.py
  const ORIGINAL: Record<PropName, number> = { fish: 3864, torch: 935, basket: 11338, apple: 7012, bun1: 3888, bun2: 3950, bun3: 3750, barrel: 10820, sack: 4576 };

  it('każdy model ma wszystkie trójkąty oryginału, z bliska i z daleka', () => {
    for (const [n, t] of Object.entries(ORIGINAL) as [PropName, number][]) {
      expect(tris(propGeometry(n)), n).toBe(t);
      expect(tris(propGeometry(n, true)), `${n} z daleka`).toBe(t);
      expect(propGeometry(n).getAttribute('uv').count).toBe(propGeometry(n).getAttribute('position').count);
    }
  });

  it('ryba: długość 1 wzdłuż z, grzbiet w górę', () => {
    const b = box(propGeometry('fish'));
    expect(b.max.z - b.min.z).toBeCloseTo(1, 3);
    expect(b.max.y - b.min.y).toBeLessThan(0.6);
  });

  it('pochodnia: głowica pod płomieniem gry (TORCH_TIP)', () => {
    // najwyższy punkt pochodni w układzie ręki uniesionej o 0,55: tuż pod płomieniem (0,34 od dłoni wzdłuż osi)
    const tipY = -0.19 + Math.cos(0.55) * 0.34;
    expect(box(propGeometry('torch')).max.y).toBeGreaterThan(tipY - 0.06);
    expect(box(propGeometry('torch')).max.y).toBeLessThan(tipY + 0.02);
  });

  it('kosz, jabłko, chleb, beczka: dno w zerze; szerokość 1 (beczka: wysokość 1)', () => {
    for (const n of ['basket', 'apple', 'bun1', 'bun2', 'bun3', 'barrel'] as const) {
      const b = box(propGeometry(n));
      expect(b.min.y, n).toBeCloseTo(0, 2);
      if (n === 'barrel') expect(b.max.y).toBeCloseTo(1, 2);
      else expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z), n).toBeCloseTo(1, 2);
    }
  });
});

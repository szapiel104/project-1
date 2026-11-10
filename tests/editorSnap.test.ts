import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { snapBox } from '../src/ui/editorSnap';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.Box3 => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

describe('przyciąganie do krawędzi (editorSnap.ts)', () => {
  it('lewa krawędź dociąga się do prawej ściany sąsiada', () => {
    const { corr, hits } = snapBox(box(1.003, 0, 0, 1.2, 0.2, 0.2), [box(0, 0, 0, 1, 0.5, 0.5)], 0.01);
    expect(corr.x).toBeCloseTo(-0.003, 6);
    expect(hits.some((h) => h.axis === 'x' && Math.abs(h.value - 1) < 1e-9)).toBe(true);
  });
  it('za daleko — bez poprawki', () => {
    const { corr } = snapBox(box(1.2, 0.3, 0.3, 1.4, 0.45, 0.45), [box(0, 0, 0, 1, 0.5, 0.5)], 0.01);
    expect(corr.x).toBe(0);
  });
  it('spód siada na ziemi', () => {
    const { corr } = snapBox(box(0, 0.004, 0, 0.1, 0.1, 0.1), [], 0.01, 0);
    expect(corr.y).toBeCloseTo(-0.004, 6);
  });
});

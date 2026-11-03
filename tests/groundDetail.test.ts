import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GroundDetail } from '../src/render/groundDetail';

/** Plansza jak w terrain.ts: 6 wierzchołków na pole, narożniki (0,0) (0,1) (1,0) (1,0) (0,1) (1,1) */
function board(w: number, h: number, H: (x: number, y: number) => number): THREE.BufferGeometry {
  const pos = new Float32Array(w * h * 18), col = new Float32Array(w * h * 18), spl = new Float32Array(w * h * 24), snd = new Float32Array(w * h * 6);
  let p = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (const [qx, qy] of [[x, y], [x, y + 1], [x + 1, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) {
      pos[p * 3] = qx; pos[p * 3 + 1] = H(qx, qy); pos[p * 3 + 2] = qy;
      col[p * 3] = col[p * 3 + 1] = col[p * 3 + 2] = 0.5;
      spl[p * 4] = qx / w; snd[p] = qy / h;
      p++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  g.setAttribute('sand', new THREE.BufferAttribute(snd, 1));
  return g;
}
const lin = (H: (x: number, y: number) => number, fx: number, fy: number): number => {
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a = H(ix, iy), b = H(ix + 1, iy), c = H(ix, iy + 1), d = H(ix + 1, iy + 1);
  return tx + ty <= 1 ? a + (b - a) * tx + (c - a) * ty : d + (c - d) * (1 - tx) + (b - d) * (1 - ty);
};

describe('gęsta siatka terenu przy kamerze', () => {
  const W = 120, Hh = 100;
  const H = (x: number, y: number): number => Math.sin(x * 0.4) * 1.2 + Math.cos(y * 0.3) * 0.8;
  const geo = board(W, Hh, H);
  const rock = (tx: number, ty: number): boolean => tx >= 70 && tx < 74 && ty >= 40 && ty < 44;
  const d = new GroundDetail({ w: W, h: Hh, ox: 0, oz: 0, geo, rock }, new THREE.MeshBasicMaterial());
  d.update(60, 50, 0);

  it('łata wstaje i ma trójkąty, plansza pomija pola pod łatą', () => {
    expect(d.mesh.visible).toBe(true);
    expect(d.mesh.geometry.drawRange.count).toBeGreaterThan(0);
    expect(geo.drawRange.count).toBeLessThan(W * Hh * 6);
    expect(geo.drawRange.count % 6).toBe(0);
  });

  it('przechodzi przez narożniki planszy i nie ma NaN', () => {
    for (let y = 20; y <= 80; y += 3) for (let x = 30; x <= 90; x += 3) {
      const v = d.heightAt(x, y);
      if (v === null) continue;
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v - H(x, y))).toBeLessThan(1e-4);
    }
    const p = d.mesh.geometry.getAttribute('position').array as Float32Array;
    for (let i = 0; i < p.length; i++) expect(Number.isFinite(p[i]!)).toBe(true);
  });

  it('na brzegu łaty dokładnie zwykła plansza (bez szpar)', () => {
    // łata 64 pól wokół (60, 50): x 28..92, y 18..82
    for (let t = 0; t <= 64; t += 0.37) {
      for (const [fx, fy] of [[28 + t, 18], [28 + t, 82], [28, 18 + t], [92, 18 + t]] as const) {
        const v = d.heightAt(fx, fy);
        if (v === null) continue;
        expect(Math.abs(v - lin(H, fx, fy))).toBeLessThan(1e-4);
      }
    }
  });

  it('w środku gładziej niż plansza, ale bez wybrzuszeń ponad narożniki pola', () => {
    let diff = 0;
    for (let y = 40; y < 60; y += 0.29) for (let x = 45; x < 65; x += 0.31) {
      const v = d.heightAt(x, y)!;
      const ix = Math.floor(x), iy = Math.floor(y);
      const c = [H(ix, iy), H(ix + 1, iy), H(ix, iy + 1), H(ix + 1, iy + 1)];
      expect(v).toBeGreaterThanOrEqual(Math.min(...c) - 1e-5);
      expect(v).toBeLessThanOrEqual(Math.max(...c) + 1e-5);
      diff = Math.max(diff, Math.abs(v - lin(H, x, y)));
    }
    expect(diff).toBeGreaterThan(0.01);
  });

  it('skała: bez łaty na jej polach, przy niej zwykła plansza', () => {
    expect(d.heightAt(71.5, 41.5)).toBeNull();
    const v = d.heightAt(69.5, 41.3)!;
    expect(Math.abs(v - lin(H, 69.5, 41.3))).toBeLessThan(1e-4);
  });

  it('jedzie za kamerą', () => {
    d.update(20, 20, 1);
    expect(d.heightAt(5, 5)).not.toBeNull();
    expect(d.heightAt(90, 80)).toBeNull();
  });
});

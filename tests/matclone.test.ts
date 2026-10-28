import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cloneMaterial } from '../src/render/matclone';

describe('kopia materiału', () => {
  it('nie serializuje tekstur ani materiałów z userData i zostawia te same odwołania', () => {
    const tex = new THREE.Texture();
    const other = new THREE.MeshStandardMaterial({ map: tex });
    const m = new THREE.MeshStandardMaterial({ color: 0x884422 });
    m.userData = { orig: other, tex, flag: 1 };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = cloneMaterial(m);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(c).not.toBe(m);
    expect(c.color.getHex()).toBe(0x884422);
    expect(c.userData.orig).toBe(other);
    expect(c.userData.tex).toBe(tex);
    expect(c.userData).not.toBe(m.userData); // własna płytka kopia
    expect(m.userData.flag).toBe(1); // oryginał nietknięty
  });
});

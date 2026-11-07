import { describe, expect, it } from 'vitest';
import { isIntegrated } from '../src/ui/gpuHint';

describe('wskazówka o karcie graficznej', () => {
  it('rozpoznaje kartę wbudowaną w procesor', () => {
    expect(isIntegrated('ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isIntegrated('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isIntegrated('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
  });
  it('nie zaczepia mocnych kart', () => {
    expect(isIntegrated('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 6GB Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isIntegrated('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isIntegrated('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
  });
});

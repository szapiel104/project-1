import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skipDarkPointLights } from '../src/render/lightskip';

const MARK = 'if ( directLight.visible ) RE_Direct';

describe('lightskip', () => {
  it('po wczytaniu modułu pętla świateł punktowych pomija zgaszone (dokładnie raz, tylko tam)', () => {
    const src = (THREE.ShaderChunk as unknown as Record<string, string>).lights_fragment_begin!;
    expect(src.split(MARK).length - 1).toBe(1);
    const from = src.indexOf('i < NUM_POINT_LIGHTS');
    const loop = src.slice(from, src.indexOf('#pragma unroll_loop_end', from));
    expect(loop).toContain(MARK);
  });
  it('łatka działa na oryginalnym kawałku three.js', () => {
    const patched = (THREE.ShaderChunk as unknown as Record<string, string>).lights_fragment_begin!;
    const original = patched.replace('if ( directLight.visible ) ', '');
    expect(skipDarkPointLights(original)).toBe(patched);
  });
});

// Spakowane modele (.bin) muszą się rozpakować bajt w bajt do tego, co jest w src/render/models/*.json
import { describe, expect, it } from 'vitest';
// @ts-expect-error — narzędzie w czystym JS
import { packModel } from '../tools/models/pack.mjs';
import { unpackModel } from '../src/render/modelpack';
import { bytes } from '../src/render/modelstore';

const texts = import.meta.glob('../src/render/models/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Porównywalny zapis modelu: bajty strumieni jako base64 z oznaczeniem, -0 osobno (szybkie zamiast toEqual na milionach bajtów) */
const toB64 = (u: Uint8Array): string => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const flat = (o: unknown): string => JSON.stringify(o, (_k, v: unknown) => {
  if (v instanceof Uint8Array) return 'BIN:' + toB64(v);
  if (typeof v === 'string' && v.length >= 16 && v.length % 4 === 0 && B64.test(v)) return 'BIN:' + v;
  if (Object.is(v, -0)) return '-0';
  return v;
});

describe('pakowanie modeli', () => {
  const files = Object.keys(texts).map((k): [string] => [k.slice(k.lastIndexOf('/') + 1)]);
  it.each(files)('%s rozpakowuje się bez strat', async (f: string) => {
    const text = texts['../src/render/models/' + f]!;
    const bin = (await packModel(text)) as Uint8Array;
    const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
    const back = await unpackModel(ab);
    expect(flat(back) === flat(JSON.parse(text))).toBe(true);
  });
  it('bytes() daje świeżą kopię', () => {
    const u = new Uint8Array([1, 2, 3]), c = bytes(u);
    c[0] = 9;
    expect(u[0]).toBe(1);
    expect(Array.from(bytes('AQID'))).toEqual([1, 2, 3]);
  });
});

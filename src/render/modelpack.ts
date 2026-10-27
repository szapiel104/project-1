/**
 * Rozpakowanie modeli z plików .bin (spakowanych przy budowaniu przez tools/models/pack.mjs).
 *
 * Bezstratnie: wychodzi ten sam model co w src/render/models/<nazwa>.json, tylko strumienie siatek
 * (pos, nrm, col, uv, idx, ao) są od razu bajtami (Uint8Array) zamiast napisów base64 — moduły renderu
 * czytają je przez `bytes()` z modelstore, który przyjmuje obie postacie.
 * Opis formatu: komentarz na górze tools/models/pack.mjs.
 */
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MAGIC = 0x314d3150; // 'P1M1' (little endian)

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Plik .bin → model (ten sam kształt co JSON z Blendera) */
export async function unpackModel(buf: ArrayBuffer): Promise<unknown> {
  const all = new Uint8Array(buf);
  if (all.byteLength < 8 || new DataView(buf).getUint32(0, true) !== MAGIC) throw new Error('Plik modelu ma zły format (brak P1M1)');
  const data = await inflate(all.subarray(4));
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headLen = view.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + headLen))) as { s: [number, number, number, number][]; j: string };
  let at = 4 + headLen;
  at += (4 - (at % 4)) % 4;
  if (head.s.some(([mode]) => mode === 1)) await MeshoptDecoder.ready;
  const streams = head.s.map(([mode, stride, rawLen, encLen]) => {
    const src = data.subarray(at, at + encLen);
    at += encLen + ((4 - (encLen % 4)) % 4);
    if (mode === 0) return src.slice();
    const out = new Uint8Array(rawLen);
    MeshoptDecoder.decodeVertexBuffer(out, rawLen / stride, stride, src);
    return out;
  });
  return JSON.parse(head.j, (_k, v: unknown) => {
    if (typeof v !== 'string') return v;
    const c = v.charCodeAt(0);
    return c === 0 ? streams[+v.slice(1)] : c === 1 && v.length === 1 ? -0 : v;
  });
}

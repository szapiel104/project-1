// Pakowanie modeli z Blendera (src/render/models/*.json) do lekkich plików .bin dla gry.
//
// Same pliki JSON i skrypty w tools/models się NIE zmieniają — zmienia się tylko to, co jedzie przez sieć.
// Kompresja jest bezstratna: gra po rozpakowaniu dostaje bajt w bajt te same siatki (trójkąty, UV, normalne,
// kolory), więc modele wyglądają dokładnie jak w pliku. Każdy strumień jest po zakodowaniu od razu
// rozpakowany i porównany z oryginałem; gdy coś się nie zgadza, idzie bez kodeka.
//
// Co daje mniejszy plik:
//  - dane binarne zamiast base64 w JSON (base64 to +33% i gorzej się kompresuje),
//  - te same strumienie tylko raz (np. wersja z bliska i z daleka tego samego przedmiotu),
//  - kodek wierzchołków meshoptimizer (ten sam co w glTF EXT_meshopt_compression), krok dobierany na strumień,
//  - na końcu deflate na cały plik (gra rozpakowuje to wbudowanym w przeglądarkę DecompressionStream).
//
// Budowa pliku: 'P1M1' + deflate-raw( u32 długość nagłówka, nagłówek JSON, wyrównanie do 4, strumienie po kolei,
// każdy wyrównany do 4 ). Nagłówek: { s: [[tryb, krok, długość po rozpakowaniu, długość w pliku], ...], j: JSON modelu },
// gdzie w j każdy strumień jest zastąpiony napisem "\u0000<numer>", a liczba -0 napisem "\u0001". Tryb 0 = surowe bajty, 1 = kodek wierzchołków.
// Rozpakowanie w grze: src/render/modelpack.ts.
//
// Ręcznie: node tools/models/pack.mjs [plik.json ...] — wypisuje rozmiary przed i po (bez zapisu).
import { readFileSync, readdirSync } from 'node:fs';
import { deflateRawSync, gzipSync } from 'node:zlib';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const STRIDES = [4, 8, 12, 16, 24, 32];
const isStream = (v) => typeof v === 'string' && v.length >= 16 && v.length % 4 === 0 && B64.test(v);
const pad4 = (n) => (4 - (n % 4)) % 4;

/** Najmniejsze bezstratne kodowanie jednego strumienia: [tryb, krok, dane] */
function encodeStream(raw) {
  let best = [0, 0, raw, deflateRawSync(raw, { level: 9 }).length];
  const n = raw.length;
  for (const st of STRIDES) {
    if (n % st || n / st < 4) continue;
    let enc;
    try { enc = MeshoptEncoder.encodeVertexBuffer(raw, n / st, st); } catch { continue; }
    const z = deflateRawSync(enc, { level: 9 }).length;
    if (z >= best[3]) continue;
    const back = new Uint8Array(n);
    try { MeshoptDecoder.decodeVertexBuffer(back, n / st, st, enc); } catch { continue; }
    if (Buffer.compare(Buffer.from(back), Buffer.from(raw)) === 0) best = [1, st, enc, z];
  }
  return best;
}

/** Tekst JSON modelu → plik .bin (Buffer) */
export async function packModel(jsonText) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const index = new Map(), meta = [], blobs = [];
  const skeleton = JSON.stringify(JSON.parse(jsonText), (_k, v) => {
    if (Object.is(v, -0)) return '\u0001'; // JSON.stringify zapisałby -0 jako 0
    if (!isStream(v)) return v;
    let i = index.get(v);
    if (i === undefined) {
      const raw = new Uint8Array(Buffer.from(v, 'base64'));
      const [mode, stride, data] = encodeStream(raw);
      i = meta.length;
      index.set(v, i);
      meta.push([mode, stride, raw.length, data.length]);
      blobs.push(data);
    }
    return '\u0000' + i;
  });
  const head = Buffer.from(JSON.stringify({ s: meta, j: skeleton }), 'utf8');
  const parts = [Buffer.alloc(4), head, Buffer.alloc(pad4(4 + head.length))];
  parts[0].writeUInt32LE(head.length, 0);
  for (const b of blobs) parts.push(Buffer.from(b.buffer, b.byteOffset, b.byteLength), Buffer.alloc(pad4(b.byteLength)));
  return Buffer.concat([Buffer.from('P1M1', 'latin1'), deflateRawSync(Buffer.concat(parts), { level: 9 })]);
}

// uruchomienie ręczne: porównanie rozmiarów
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = 'src/render/models/';
  const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => dir + f);
  let a = 0, g = 0, b = 0;
  for (const f of files) {
    const t = readFileSync(f);
    const p = await packModel(t.toString('utf8'));
    a += t.length; g += gzipSync(t, { level: 6 }).length; b += p.length;
  }
  const mb = (x) => (x / 1e6).toFixed(2) + ' MB';
  console.log(`${files.length} modeli: JSON ${mb(a)} (przez sieć z gzip ok. ${mb(g)}) → .bin ${mb(b)} (${Math.round((1 - b / g) * 100)}% mniej do pobrania)`);
}

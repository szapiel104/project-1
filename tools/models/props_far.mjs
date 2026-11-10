// Lżejsze wersje z daleka modeli z paczek (props.json, klucze <nazwa>Far) — meshoptimizer, bez Blendera.
// Zasada Michała: z bliska oryginał; uprościć wolno tylko wersję z daleka i tylko przy widocznym spadku FPS.
// 10.11.2026: w sadzie 128 jabłek po 7012 trójkątów (900 tys. na sad) — przy spacerze w sadzie gra zwalniała.
// Wersja z daleka dzieli wierzchołki z oryginałem (te same UV, normalne, kolory), zmienia się tylko lista trójkątów.
// Uruchomienie: node tools/models/props_far.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const FILE = 'src/render/models/props.json';
/** nazwa → udział trójkątów w wersji z daleka */
const TARGET = { apple: 0.06, basket: 0.15 };
await MeshoptSimplifier.ready;
const d = JSON.parse(readFileSync(FILE, 'utf8'));
for (const [name, share] of Object.entries(TARGET)) {
  const m = d[name];
  const pos = new Float32Array(new Uint8Array(Buffer.from(m.pos, 'base64')).buffer.slice(0));
  const idx16 = new Uint16Array(new Uint8Array(Buffer.from(m.idx, 'base64')).buffer.slice(0));
  const idx = Uint32Array.from(idx16);
  const target = Math.max(60, Math.floor((idx.length / 3) * share)) * 3;
  const [out, err] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, ['LockBorder']);
  const far = Uint16Array.from(out);
  d[`${name}Far`] = { ...m, idx: Buffer.from(far.buffer).toString('base64') };
  console.log(`${name}: ${idx.length / 3} → ${far.length / 3} trójkątów (błąd ${err.toFixed(4)})`);
}
writeFileSync(FILE, JSON.stringify(d));

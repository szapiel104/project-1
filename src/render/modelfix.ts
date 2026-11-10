/**
 * Poprawki modeli z edytora w podglądzie modeli (Michał 10.11.2026: „przesuwać w podglądzie modeli niektóre rzeczy,
 * poprawiać model i zapisać”). Modele z Blendera są sklejone po materiale, więc część (belka, beczka, kłoda) to
 * „wyspa” — trójkąty połączone wspólnymi wierzchołkami w jednej siatce. Poprawka wskazuje wyspę po środku i liczbie
 * trójkątów i niesie macierz przekształcenia (w układzie modelu). Poprawki stosujemy przy wczytaniu modelu (modelstore),
 * więc działają w grze, w podglądzie i w dalekich wersjach; skrypt Blendera można dalej uruchamiać — poprawki zostają
 * (a te, które przestały pasować do nowej bryły, są pomijane).
 *
 * Plik: src/data/modelFixes.json — { "<model>": [ { g, i, c:[x,y,z], n, m:[16] }, ... ] }
 */
const bytes = (s: string | Uint8Array): Uint8Array => (typeof s === 'string' ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : s.slice());

export interface Fix {
  /** grupa w modelu (base, shell, interior, floor, ceiling) */
  g: string;
  /** numer siatki w grupie */
  i: number;
  /** środek wyspy (średnia wierzchołków) przed poprawką, w układzie modelu */
  c: [number, number, number];
  /** liczba trójkątów wyspy */
  n: number;
  /** macierz 4×4 (kolumnami, jak three.js) */
  m: number[];
}

export interface Island { tris: number[]; c: [number, number, number] }

/** Wyspy trójkątów połączonych wspólnymi wierzchołkami (siatka bez indeksów: 3 wierzchołki na trójkąt) */
export function islands(P: ArrayLike<number>): { of: Int32Array; list: Island[] } {
  const nv = P.length / 3, nt = nv / 3;
  const parent = new Int32Array(nt);
  for (let t = 0; t < nt; t++) parent[t] = t;
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  const seen = new Map<string, number>();
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(P[v * 3]! * 2000)},${Math.round(P[v * 3 + 1]! * 2000)},${Math.round(P[v * 3 + 2]! * 2000)}`;
    const t = (v / 3) | 0, o = seen.get(k);
    if (o === undefined) seen.set(k, t);
    else { const a = find(o), b = find(t); if (a !== b) parent[a] = b; }
  }
  const idx = new Map<number, number>(), list: Island[] = [], of = new Int32Array(nt);
  for (let t = 0; t < nt; t++) {
    const r = find(t);
    let k = idx.get(r);
    if (k === undefined) { k = list.length; idx.set(r, k); list.push({ tris: [], c: [0, 0, 0] }); }
    of[t] = k;
    list[k]!.tris.push(t);
  }
  for (const isl of list) {
    let x = 0, y = 0, z = 0;
    for (const t of isl.tris) for (let j = 0; j < 3; j++) { const v = t * 3 + j; x += P[v * 3]!; y += P[v * 3 + 1]!; z += P[v * 3 + 2]!; }
    const n = isl.tris.length * 3;
    isl.c = [x / n, y / n, z / n];
  }
  return { of, list };
}

/** Wyspa pasująca do poprawki (środek z dokładnością 3 mm i ta sama liczba trójkątów) */
export function findIsland(list: Island[], f: Fix): Island | null {
  let best: Island | null = null, bd = 0.003;
  for (const isl of list) {
    if (isl.tris.length !== f.n) continue;
    const d = Math.hypot(isl.c[0] - f.c[0], isl.c[1] - f.c[1], isl.c[2] - f.c[2]);
    if (d <= bd) { bd = d; best = isl; }
  }
  return best;
}

/** Przekształca wierzchołki wyspy macierzą (w miejscu) */
export function transformIsland(P: { [i: number]: number }, isl: Island, m: number[]): void {
  for (const t of isl.tris) for (let j = 0; j < 3; j++) {
    const v = (t * 3 + j) * 3, x = P[v]!, y = P[v + 1]!, z = P[v + 2]!;
    P[v] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    P[v + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    P[v + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }
}

/** Liczba poprawek, które nie trafiły w żadną wyspę (bryła zmieniona w Blenderze) — do podglądu modeli */
export const missedFixes = new Map<string, number>();

/**
 * Stosuje poprawki do surowych danych modelu (pozycje int16 / q). Kolejność ma znaczenie: każda poprawka wskazuje
 * wyspę w stanie po poprzednich.
 */
export function applyModelFixes(name: string, data: Record<string, unknown>, fixes: Fix[] | undefined): void {
  if (!fixes?.length) return;
  const q = data.q as number;
  const decoded = new Map<string, { P: Float32Array; list: Island[]; dirty: boolean }>();
  let miss = 0;
  for (const f of fixes) {
    const arr = data[f.g] as { pos: string | Uint8Array }[] | undefined;
    const entry = arr?.[f.i];
    if (!entry) { miss++; continue; }
    const key = `${f.g}:${f.i}`;
    let d = decoded.get(key);
    if (!d) {
      const raw = bytes(entry.pos), p16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
      const P = new Float32Array(p16.length);
      for (let k = 0; k < p16.length; k++) P[k] = p16[k]! / q;
      d = { P, list: islands(P).list, dirty: false };
      decoded.set(key, d);
    }
    const isl = findIsland(d.list, f);
    if (!isl) { miss++; continue; }
    transformIsland(d.P, isl, f.m);
    // nowy środek wyspy (następne poprawki tej samej części wskazują ją już po przesunięciu)
    let x = 0, y = 0, z = 0;
    for (const t of isl.tris) for (let j = 0; j < 3; j++) { const v = (t * 3 + j) * 3; x += d.P[v]!; y += d.P[v + 1]!; z += d.P[v + 2]!; }
    const nv = isl.tris.length * 3;
    isl.c = [x / nv, y / nv, z / nv];
    d.dirty = true;
  }
  for (const [key, d] of decoded) {
    if (!d.dirty) continue;
    const [g, i] = key.split(':') as [string, string];
    const p16 = new Int16Array(d.P.length);
    for (let k = 0; k < d.P.length; k++) p16[k] = Math.max(-32768, Math.min(32767, Math.round(d.P[k]! * q)));
    (data[g] as { pos: string | Uint8Array }[])[Number(i)]!.pos = new Uint8Array(p16.buffer);
  }
  if (miss) missedFixes.set(name, miss); else missedFixes.delete(name);
}

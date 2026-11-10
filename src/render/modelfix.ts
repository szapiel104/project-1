/**
 * Poprawki modeli z edytora w podglądzie modeli (Michał 10.11.2026: „przesuwać w podglądzie modeli niektóre rzeczy,
 * poprawiać model i zapisać”). Modele z Blendera są sklejone po materiale, więc część (belka, beczka, kłoda) to
 * „wyspa” — trójkąty połączone wspólnymi wierzchołkami w jednej siatce. Poprawka wskazuje wyspę po środku i liczbie
 * trójkątów i niesie macierz przekształcenia (w układzie modelu). Poprawki stosujemy przy wczytaniu modelu (modelstore),
 * więc działają w grze, w podglądzie i w dalekich wersjach; skrypt Blendera można dalej uruchamiać — poprawki zostają
 * (a te, które przestały pasować do nowej bryły, są pomijane).
 *
 * Plik: src/data/modelFixes.json — { "<model>": [ { g, i, c:[x,y,z], n, m:[16] }, ... ] }
 * Rodzaje (k): 'move' (domyślnie) — przekształca część; 'dup' — dokłada przekształconą kopię części; 'mat' — przenosi
 * część do siatki z innym materiałem (to), po drodze przekształcając ją macierzą; 'add' — nowa bryła (shape) z materiałem
 * (to) przekształcona macierzą z bryły jednostkowej.
 */
const bytes = (s: string | Uint8Array): Uint8Array => (typeof s === 'string' ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : s.slice());

export interface Fix {
  /** rodzaj: move (domyślnie), dup, mat, add */
  k?: 'move' | 'dup' | 'mat' | 'add';
  /** grupa w modelu (base, shell, interior, floor, ceiling) */
  g: string;
  /** numer siatki w grupie (nie dla 'add') */
  i?: number;
  /** środek wyspy (średnia wierzchołków) przed poprawką, w układzie modelu (nie dla 'add') */
  c?: [number, number, number];
  /** liczba trójkątów wyspy (nie dla 'add') */
  n?: number;
  /** materiał docelowy ('mat', 'add') */
  to?: string;
  /** bryła dla 'add' */
  shape?: 'box' | 'cyl' | 'wedge';
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
    if (!f.c || isl.tris.length !== f.n) continue;
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

/** Bryła jednostkowa (środek w zerze, bok 1) jako trójkąty bez indeksów: prostopadłościan, walec (12 boków), klin */
export function unitShape(shape: 'box' | 'cyl' | 'wedge'): number[] {
  const out: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]): void => { out.push(...a, ...b, ...c, ...a, ...c, ...d); };
  if (shape === 'cyl') {
    const n = 12, r = 0.5;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const p0 = [Math.cos(a0) * r, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
      quad([p0[0]!, -0.5, p0[1]!], [p0[0]!, 0.5, p0[1]!], [p1[0]!, 0.5, p1[1]!], [p1[0]!, -0.5, p1[1]!]);
      out.push(0, 0.5, 0, p1[0]!, 0.5, p1[1]!, p0[0]!, 0.5, p0[1]!);
      out.push(0, -0.5, 0, p0[0]!, -0.5, p0[1]!, p1[0]!, -0.5, p1[1]!);
    }
    return out;
  }
  const h = 0.5;
  if (shape === 'wedge') {
    // klin: spód pełny, skos od tylnej krawędzi u góry do przedniej na dole
    quad([-h, -h, h], [h, -h, h], [h, -h, -h], [-h, -h, -h]);
    quad([-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h]);
    quad([-h, h, -h], [h, h, -h], [h, -h, h], [-h, -h, h]);
    out.push(-h, -h, h, -h, -h, -h, -h, h, -h);
    out.push(h, -h, h, h, h, -h, h, -h, -h);
    return out;
  }
  quad([-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]);
  quad([h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]);
  quad([h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]);
  quad([-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]);
  quad([-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]);
  quad([-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]);
  return out;
}

const apply = (m: number[], P: number[] | Float32Array, from = 0, to = P.length): void => {
  for (let v = from; v < to; v += 3) {
    const x = P[v]!, y = P[v + 1]!, z = P[v + 2]!;
    P[v] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    P[v + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    P[v + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }
};

/**
 * Stosuje poprawki do surowych danych modelu (pozycje int16 / q, AO po bajcie na wierzchołek). Kolejność ma znaczenie:
 * każda poprawka wskazuje wyspę w stanie po poprzednich.
 */
export function applyModelFixes(name: string, data: Record<string, unknown>, fixes: Fix[] | undefined): void {
  if (!fixes?.length) return;
  const q = data.q as number;
  type Entry = { mat: string; pos: string | Uint8Array; ao: string | Uint8Array };
  type Dec = { P: number[]; A: number[]; list: Island[] | null; dirty: boolean };
  const dec = new Map<Entry, Dec>();
  const get = (e: Entry): Dec => {
    let d = dec.get(e);
    if (!d) {
      const raw = bytes(e.pos), p16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
      const P = Array.from(p16, (v) => v / q);
      const a = e.ao ? bytes(e.ao) : new Uint8Array(0);
      const A = Array.from({ length: P.length / 3 }, (_, k) => a[k] ?? 230);
      d = { P, A, list: null, dirty: false };
      dec.set(e, d);
    }
    return d;
  };
  const islandsOf = (d: Dec): Island[] => (d.list ??= islands(d.P).list);
  const target = (g: string, mat: string): Entry => {
    const arr = ((data[g] as Entry[] | undefined) ?? (data[g] = [] as Entry[])) as Entry[];
    let e = arr.find((x) => x.mat === mat);
    if (!e) { e = { mat, pos: new Uint8Array(0), ao: new Uint8Array(0) }; arr.push(e); }
    return e;
  };
  /** wierzchołki wyspy (kopie) */
  const cut = (d: Dec, isl: Island): { P: number[]; A: number[] } => {
    const P: number[] = [], A: number[] = [];
    for (const t of isl.tris) for (let j = 0; j < 3; j++) { const v = t * 3 + j; P.push(d.P[v * 3]!, d.P[v * 3 + 1]!, d.P[v * 3 + 2]!); A.push(d.A[v]!); }
    return { P, A };
  };
  let miss = 0;
  for (const f of fixes) {
    const kind = f.k ?? 'move';
    if (kind === 'add') {
      const d = get(target(f.g, f.to ?? 'wood'));
      const P = unitShape(f.shape ?? 'box');
      apply(f.m, P);
      d.P.push(...P); for (let k = 0; k < P.length / 3; k++) d.A.push(235);
      d.list = null; d.dirty = true;
      continue;
    }
    const entry = (data[f.g] as Entry[] | undefined)?.[f.i ?? -1];
    if (!entry) { miss++; continue; }
    const d = get(entry);
    const isl = findIsland(islandsOf(d), f);
    if (!isl) { miss++; continue; }
    if (kind === 'move') {
      transformIsland(d.P as unknown as { [i: number]: number }, isl, f.m);
      let x = 0, y = 0, z = 0;
      for (const t of isl.tris) for (let j = 0; j < 3; j++) { const v = (t * 3 + j) * 3; x += d.P[v]!; y += d.P[v + 1]!; z += d.P[v + 2]!; }
      const nv = isl.tris.length * 3;
      isl.c = [x / nv, y / nv, z / nv];
      d.dirty = true;
    } else if (kind === 'dup') {
      const c = cut(d, isl);
      apply(f.m, c.P);
      d.P.push(...c.P); d.A.push(...c.A);
      d.list = null; d.dirty = true;
    } else if (kind === 'mat') {
      const c = cut(d, isl);
      apply(f.m, c.P);
      // wycięcie trójkątów wyspy ze źródła
      const drop = new Set(isl.tris);
      const P: number[] = [], A: number[] = [];
      for (let t = 0; t < d.P.length / 9; t++) {
        if (drop.has(t)) continue;
        for (let j = 0; j < 3; j++) { const v = t * 3 + j; P.push(d.P[v * 3]!, d.P[v * 3 + 1]!, d.P[v * 3 + 2]!); A.push(d.A[v]!); }
      }
      d.P = P; d.A = A; d.list = null; d.dirty = true;
      const td = get(target(f.g, f.to ?? entry.mat));
      td.P.push(...c.P); td.A.push(...c.A); td.list = null; td.dirty = true;
    }
  }
  for (const [e, d] of dec) {
    if (!d.dirty) continue;
    const p16 = new Int16Array(d.P.length);
    for (let k = 0; k < d.P.length; k++) p16[k] = Math.max(-32768, Math.min(32767, Math.round(d.P[k]! * q)));
    e.pos = new Uint8Array(p16.buffer);
    e.ao = Uint8Array.from(d.A);
  }
  if (miss) missedFixes.set(name, miss); else missedFixes.delete(name);
}

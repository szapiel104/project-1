/**
 * Bryły jednostkowe dla edytora modeli (Michał 10.11.2026: „żebym mógł zbudować niesamowite rzeczy”).
 * Każda mieści się w sześcianie o boku 1 ze środkiem w zerze, jest zamknięta (gra nie rysuje tylnych ścian)
 * i ma trójkąty zwrócone na zewnątrz. Zwracane jako płaska lista wierzchołków trójkątów (bez indeksów).
 * Tekstura nakłada się sama w grze (materiały budynków liczą wzór z położenia), więc nie ma tu UV.
 */
export const SHAPES = [
  'box', 'bevel', 'cyl', 'hex', 'octa', 'cone', 'pyramid', 'sphere', 'tube', 'wedge', 'prism',
  'halfcyl', 'quarter', 'arch', 'frame', 'stairs', 'merlons', 'column',
] as const;
export type Shape = typeof SHAPES[number];

type V = [number, number, number];
type Ring = { y: number; pts: [number, number][] };

/** Pierścienie jeden nad drugim (punkty w kolejności rosnącego kąta, x = cos, z = sin), z denkami. */
function loft(out: number[], rings: Ring[], capBottom: boolean, capTop: boolean): void {
  const quad = (a: V, b: V, c: V, d: V): void => { out.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r]!, B = rings[r + 1]!, n = A.pts.length;
    for (let k = 0; k < n; k++) {
      const a0 = A.pts[k]!, a1 = A.pts[(k + 1) % n]!, b0 = B.pts[k]!, b1 = B.pts[(k + 1) % n]!;
      quad([a0[0], A.y, a0[1]], [b0[0], B.y, b0[1]], [b1[0], B.y, b1[1]], [a1[0], A.y, a1[1]]);
    }
  }
  const fan = (R: Ring, top: boolean): void => {
    const n = R.pts.length;
    let cx = 0, cz = 0;
    for (const p of R.pts) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    for (let k = 0; k < n; k++) {
      const p0 = R.pts[k]!, p1 = R.pts[(k + 1) % n]!;
      if (top) out.push(cx, R.y, cz, p1[0], R.y, p1[1], p0[0], R.y, p0[1]);
      else out.push(cx, R.y, cz, p0[0], R.y, p0[1], p1[0], R.y, p1[1]);
    }
  };
  if (capBottom) fan(rings[0]!, false);
  if (capTop) fan(rings[rings.length - 1]!, true);
}
const circle = (r: number, n: number, phase = 0): [number, number][] =>
  Array.from({ length: n }, (_, k) => { const a = phase + (k / n) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]; });
/** Bryła obrotowa: profil [promień, wysokość] od dołu do góry */
function lathe(out: number[], profile: [number, number][], n: number, phase = 0, closed = false): void {
  const rings = profile.map(([r, y]) => ({ y, pts: circle(Math.max(r, 1e-5), n, phase) }));
  if (closed) rings.push(rings[0]!);
  loft(out, rings, !closed && profile[0]![0] > 1e-4, !closed && profile[profile.length - 1]![0] > 1e-4);
}
/** Wielokąt wypukły w XY (przeciwnie do wskazówek zegara patrząc od +Z) wyciągnięty wzdłuż Z od z0 do z1 */
function extrude(out: number[], poly: [number, number][], z0 = -0.5, z1 = 0.5): void {
  const n = poly.length;
  for (let k = 1; k + 1 < n; k++) {
    const a = poly[0]!, b = poly[k]!, c = poly[k + 1]!;
    out.push(a[0], a[1], z1, b[0], b[1], z1, c[0], c[1], z1);
    out.push(a[0], a[1], z0, c[0], c[1], z0, b[0], b[1], z0);
  }
  for (let k = 0; k < n; k++) {
    const a = poly[k]!, b = poly[(k + 1) % n]!;
    out.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1);
  }
}
/** prostopadłościan od (x0,y0,z0) do (x1,y1,z1) */
const cuboid = (out: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void =>
  extrude(out, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1);
/** ośmiokąt: kwadrat o połowie boku s ze ściętymi rogami c */
const oct = (s: number, c: number): [number, number][] =>
  [[s, -(s - c)], [s, s - c], [s - c, s], [-(s - c), s], [-s, s - c], [-s, -(s - c)], [-(s - c), -s], [s - c, -s]];

export function unitShape(shape: Shape): number[] {
  const out: number[] = [];
  const h = 0.5;
  switch (shape) {
    case 'cyl': lathe(out, [[h, -h], [h, h]], 12); break;   // 12 boków jak w pierwszej wersji (zapisane poprawki liczą trójkąty)
    case 'hex': lathe(out, [[h, -h], [h, h]], 6); break;
    case 'octa': lathe(out, [[h, -h], [h, h]], 8, Math.PI / 8); break;
    case 'cone': lathe(out, [[h, -h], [0, h]], 16); break;
    case 'pyramid': lathe(out, [[h * Math.SQRT2, -h], [0, h]], 4, Math.PI / 4); break;
    case 'sphere': {
      const prof: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const t = -Math.PI / 2 + (i / 10) * Math.PI; prof.push([Math.cos(t) * h, Math.sin(t) * h]); }
      lathe(out, prof, 18);
      break;
    }
    case 'tube': lathe(out, [[h, -h], [h, h], [0.34, h], [0.34, -h]], 16, 0, true); break;
    case 'bevel': {
      const b = 0.07;
      loft(out, [{ y: -h, pts: oct(h - b, b) }, { y: -h + b, pts: oct(h, b) }, { y: h - b, pts: oct(h, b) }, { y: h, pts: oct(h - b, b) }], true, true);
      break;
    }
    case 'column': {
      // kolumna: kwadratowa stopa i głowica, ośmioboczny trzon
      cuboid(out, -h, -h, -h, h, -0.38, h);
      cuboid(out, -h, 0.38, -h, h, h, h);
      lathe(out, [[0.32, -0.375], [0.32, 0.375]], 8, Math.PI / 8);
      break;
    }
    case 'wedge': {         // klin jak w pierwszej wersji: spód pełny, skos od tylnej krawędzi u góry do przedniej na dole
      const quad = (a: V, b: V, c: V, d: V): void => { out.push(...a, ...b, ...c, ...a, ...c, ...d); };
      quad([-h, -h, h], [h, -h, h], [h, -h, -h], [-h, -h, -h]);
      quad([-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h]);
      quad([-h, h, -h], [h, h, -h], [h, -h, h], [-h, -h, h]);
      out.push(-h, -h, h, -h, -h, -h, -h, h, -h);
      out.push(h, -h, h, h, h, -h, h, -h, -h);
      // pierwsza wersja klina miała trójkąty odwrócone do środka (w grze widać go było od środka) — odwracamy je
      for (let t = 0; t < out.length; t += 9) for (let j = 0; j < 3; j++) { const v = out[t + 3 + j]!; out[t + 3 + j] = out[t + 6 + j]!; out[t + 6 + j] = v; }
      break;
    }
    case 'prism':           // szczyt dachu dwuspadowego (trójkąt wyciągnięty wzdłuż Z)
      extrude(out, [[-h, -h], [h, -h], [0, h]]);
      break;
    case 'halfcyl': {       // pół walca (sklepienie, łuk nad oknem): łuk w XY, długość wzdłuż Z
      const p: [number, number][] = [];
      for (let i = 0; i <= 12; i++) { const t = (i / 12) * Math.PI; p.push([Math.cos(t) * h, -h + Math.sin(t)]); }
      extrude(out, p);
      break;
    }
    case 'quarter': {       // ćwierć walca (gzyms, listwa)
      const p: [number, number][] = [[-h, -h]];
      for (let i = 0; i <= 8; i++) { const t = (i / 8) * Math.PI / 2; p.push([-h + Math.cos(t), -h + Math.sin(t)]); }
      extrude(out, p);
      break;
    }
    case 'arch': {
      // płyta z łukowym otworem (brama, okno): dwa filary i łuk z ośmiu klińców
      const r = 0.25, yc = 0;
      cuboid(out, -h, -h, -h, -r, yc, h);
      cuboid(out, r, -h, -h, h, yc, h);
      const edge = (t: number): [number, number] => {
        const dx = Math.cos(t), dy = Math.sin(t);
        const k = Math.min(Math.abs(dx) > 1e-6 ? h / Math.abs(dx) : 1e9, dy > 1e-6 ? (h - yc) / dy : 1e9);
        return [dx * k, yc + dy * k];
      };
      for (let i = 0; i < 8; i++) {
        const t0 = (i / 8) * Math.PI, t1 = ((i + 1) / 8) * Math.PI;
        extrude(out, [[Math.cos(t0) * r, yc + Math.sin(t0) * r], edge(t0), edge(t1), [Math.cos(t1) * r, yc + Math.sin(t1) * r]]);
      }
      break;
    }
    case 'frame': {         // rama z prostokątnym otworem (okno, drzwi)
      const r = 0.32;
      cuboid(out, -h, r, -h, h, h, h);
      cuboid(out, -h, -h, -h, h, -r, h);
      cuboid(out, -h, -r, -h, -r, r, h);
      cuboid(out, r, -r, -h, h, r, h);
      break;
    }
    case 'stairs': {        // pięć stopni, wejście od +Z
      for (let i = 0; i < 5; i++) cuboid(out, -h, -h, h - (i + 1) * 0.2, h, -h + (i + 1) * 0.2, h - i * 0.2);
      break;
    }
    case 'merlons': {       // kawałek muru z blankami
      cuboid(out, -h, -h, -h, h, 0, h);
      for (const x of [-h, -0.1, 0.3]) cuboid(out, x, 0, -h, x + 0.2, h, h);
      break;
    }
    default: cuboid(out, -h, -h, -h, h, h, h);
  }
  return out;
}

/** Nazwy brył do list w edytorze */
export function shapeLabel(s: Shape, tx: (pl: string, en: string) => string): string {
  const L: Record<Shape, [string, string]> = {
    box: ['prostopadłościan', 'box'], bevel: ['fazowany klocek', 'bevelled block'], cyl: ['walec', 'cylinder'],
    hex: ['graniastosłup 6', 'hexagonal prism'], octa: ['graniastosłup 8', 'octagonal prism'], cone: ['stożek', 'cone'],
    pyramid: ['ostrosłup (hełm wieży)', 'pyramid (spire)'], sphere: ['kula', 'sphere'], tube: ['rura / pierścień', 'tube / ring'],
    wedge: ['klin (skos)', 'wedge (slope)'], prism: ['szczyt dachu', 'gable'], halfcyl: ['pół walca (sklepienie)', 'half cylinder (vault)'],
    quarter: ['ćwierć walca (gzyms)', 'quarter round (cornice)'], arch: ['łuk (brama)', 'arch (gate)'], frame: ['rama okna', 'window frame'],
    stairs: ['schody', 'stairs'], merlons: ['blanki', 'battlements'], column: ['kolumna', 'column'],
  };
  const [pl, en] = L[s];
  return tx(pl, en);
}

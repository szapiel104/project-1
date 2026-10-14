import LAYOUT from './keep-layout.json';

/**
 * Plan zamku: które pola są murem, a które dziedzińcem albo salą, gdzie stoją ściany, drzwi i kraty.
 * Ten sam plan czyta model w Blenderze (tools/models/keep.py), więc ściany w grze i na ekranie się pokrywają.
 */
export const KEEP_SIZE: number = LAYOUT.size;
const T: string[] = LAYOUT.tiles;

/** Znak pola (dx, dy od lewego górnego rogu działki; bez obrotu) */
export const keepTile = (dx: number, dy: number): string => T[dy]?.[dx] ?? '#';
/** Pomieszczenie pola: brama należy do dziedzińca; mur i studnia nie są pomieszczeniem */
export const keepRoom = (dx: number, dy: number): string => { const c = keepTile(dx, dy); return c === 'G' ? '.' : c; };
/** Czy po polu się chodzi (mur i studnia zajmują całe pole) */
export const keepWalk = (dx: number, dy: number): boolean => { const c = keepTile(dx, dy); return c !== '#' && c !== 'o'; };

const key = (ax: number, ay: number, bx: number, by: number): string => (ay < by || (ay === by && ax < bx) ? `${ax},${ay},${bx},${by}` : `${bx},${by},${ax},${ay}`);
const DOORS = new Set(LAYOUT.doors.map(([a, b, c, d]) => key(a!, b!, c!, d!)));
const BARS = new Set(LAYOUT.bars.map(([a, b, c, d]) => key(a!, b!, c!, d!)));

/** Co stoi między dwoma sąsiednimi polami: nic, ściana, drzwi albo krata */
export function keepEdge(ax: number, ay: number, bx: number, by: number): 'open' | 'wall' | 'door' | 'bars' {
  if (!keepWalk(ax, ay) || !keepWalk(bx, by)) return 'open'; // mur albo studnia i tak zajmują całe pole
  const k = key(ax, ay, bx, by);
  if (BARS.has(k)) return 'bars';
  if (DOORS.has(k)) return 'door';
  return keepRoom(ax, ay) === keepRoom(bx, by) ? 'open' : 'wall';
}

/** Bit „na murach”: chodnik na koronie muru i w basztach (łucznik stamtąd strzela dalej, wręcz go nie dosięgną) */
export const WALL_TOP = 16;
/** Pola, po których się chodzi, i bity ścian każdego z nich: 1 = ku -y, 2 = ku +x, 4 = ku +y, 8 = ku -x, 16 = na murach */
export const KEEP_CELLS: { dx: number; dy: number; walls: number }[] = (() => {
  const out: { dx: number; dy: number; walls: number }[] = [];
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < KEEP_SIZE && y < KEEP_SIZE;
  // z zewnątrz do zamku tylko przez bramę: korona muru od strony pola jest zamknięta (nikt nie wskoczy na mur z ziemi)
  const shut = (ax: number, ay: number, bx: number, by: number): boolean => {
    if (!inside(bx, by)) return keepTile(ax, ay) !== 'G';
    const e = keepEdge(ax, ay, bx, by); return e === 'wall' || e === 'bars';
  };
  for (let dy = 0; dy < KEEP_SIZE; dy++)
    for (let dx = 0; dx < KEEP_SIZE; dx++) {
      if (!keepWalk(dx, dy)) continue;
      const walls = (shut(dx, dy, dx, dy - 1) ? 1 : 0) | (shut(dx, dy, dx + 1, dy) ? 2 : 0) | (shut(dx, dy, dx, dy + 1) ? 4 : 0) | (shut(dx, dy, dx - 1, dy) ? 8 : 0);
      out.push({ dx, dy, walls: walls | (keepTile(dx, dy) === '=' ? WALL_TOP : 0) });
    }
  return out;
})();

/** Pole koszar, do którego idą mieszkańcy zamku (tam śpią i tam chronią się w razie napadu) */
export const KEEP_BED: [number, number] = [LAYOUT.bed[0]!, LAYOUT.bed[1]!];
/** Brama: pole w murze od frontu */
export const KEEP_GATE: [number, number] = (() => { const y = KEEP_SIZE - 1; return [T[y]!.indexOf('G'), y]; })();

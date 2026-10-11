import { hash2 } from './rng';
import { Terrain } from '../data/terrain';
import { MAP_PRESETS, type MapPreset } from '../data/maps';

export interface StartPosition {
  /** Indeks gracza 0..n-1 */
  player: number;
  /** Drużyna 0 lub 1 */
  team: number;
  x: number;
  y: number;
}

export interface GameMap {
  seed: number;
  width: number;
  height: number;
  /** Teren pól, indeks = y * width + x */
  tiles: Uint8Array;
  /** Wysokość pól 0..255 (tylko do wyglądu i progów terenu) */
  elevation: Uint8Array;
  starts: StartPosition[];
}

const FP = 256; // stały przecinek: 8 bitów części ułamkowej

/** Szum wartościowy z interpolacją dwuliniową, w całości na liczbach całkowitych. Wynik 0..255. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = Math.floor(((x - gx * cell) * FP) / cell);
  const fy = Math.floor(((y - gy * cell) * FP) / cell);
  // wygładzenie 3t^2 - 2t^3 w stałym przecinku
  const sx = Math.floor((fx * fx * (3 * FP - 2 * fx)) / (FP * FP));
  const sy = Math.floor((fy * fy * (3 * FP - 2 * fy)) / (FP * FP));
  const a = hash2(gx, gy, seed) & 255;
  const b = hash2(gx + 1, gy, seed) & 255;
  const c = hash2(gx, gy + 1, seed) & 255;
  const d = hash2(gx + 1, gy + 1, seed) & 255;
  const top = a * (FP - sx) + b * sx;
  const bot = c * (FP - sx) + d * sx;
  return Math.floor((top * (FP - sy) + bot * sy) / (FP * FP));
}

function fractal(x: number, y: number, seed: number): number {
  const n =
    valueNoise(x, y, 24, seed) * 4 +
    valueNoise(x, y, 12, seed ^ 0x9e3779b9) * 2 +
    valueNoise(x, y, 6, seed ^ 0x7f4a7c15);
  return Math.floor(n / 7);
}

/**
 * Generuje mapę z ziarna. Mapa jest symetryczna środkowo (obrót o 180°),
 * więc obie drużyny mają identyczny teren i tyle samo surowców.
 */
export function generateMap(seed: number, presetId: keyof typeof MAP_PRESETS = '1v1'): GameMap {
  const preset: MapPreset = MAP_PRESETS[presetId];
  const { width, height } = preset;
  const tiles = new Uint8Array(width * height);
  const elevation = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const mi = (height - 1 - y) * width + (width - 1 - x);
      if (mi < i) {
        // druga połowa mapy = lustrzane odbicie pierwszej
        tiles[i] = tiles[mi]!;
        elevation[i] = elevation[mi]!;
        continue;
      }
      const h = fractal(x, y, seed);
      const forest = fractal(x, y, seed ^ 0x51ed270b);
      const ore = valueNoise(x, y, 7, seed ^ 0x2545f491);
      let t: Terrain = Terrain.Grass;
      let e = h;
      // pas gór na krańcach: nierówna krawędź z szumu, im bliżej brzegu, tym wyżej
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const rim = preset.rim + Math.floor((valueNoise(x, y, 9, seed ^ 0x3c6ef372) * 5) / 256) - 2;
      if (edge < rim) {
        t = Terrain.Mountain;
        e = Math.min(255, 170 + (rim - edge) * 9 + (hash2(x, y, seed) & 15));
      } else if (h < preset.waterLevel) t = Terrain.Water;
      // kamień i żelazo tylko u podnóża gór, w niedużych złożach; żelazo rzadsze i bliżej skał
      else if (edge < rim + 4 && ore > 178) t = Terrain.Iron;
      else if (edge < rim + 7 && valueNoise(x, y, 6, seed ^ 0x1b873593) > 158) t = Terrain.Stone;
      else if (forest > 146) t = Terrain.Forest;
      tiles[i] = t;
      elevation[i] = e;
    }
  }

  // Pozycje startowe: drużyna 0 z presetu, drużyna 1 jako odbicie środkowe.
  const starts: StartPosition[] = [];
  preset.starts.forEach((s, n) => {
    const x = Math.floor((s.x * width) / 100);
    const y = Math.floor((s.y * height) / 100);
    starts.push({ player: n * 2, team: 0, x, y });
    starts.push({ player: n * 2 + 1, team: 1, x: width - 1 - x, y: height - 1 - y });
  });

  // Wokół każdego startu czysta łąka pod zamek, a tuż obok gwarantowane surowce.
  for (const s of starts) {
    const dir = s.team === 0 ? 1 : -1;
    clearCircle(tiles, elevation, width, height, s.x, s.y, preset.startRadius, preset.waterLevel);
    stamp(tiles, width, height, s.x - dir * (preset.startRadius + 1), s.y + dir * 3, 3, Terrain.Forest);
    stamp(tiles, width, height, s.x + dir * 2, s.y - dir * (preset.startRadius + 2), 1, Terrain.Stone);
    stamp(tiles, width, height, s.x - dir * 5, s.y - dir * (preset.startRadius + 2), 0, Terrain.Iron);
  }

  return { seed, width, height, tiles, elevation, starts };
}

function clearCircle(
  tiles: Uint8Array, elevation: Uint8Array, w: number, h: number,
  cx: number, cy: number, r: number, waterLevel: number,
): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const i = y * w + x;
      tiles[i] = Terrain.Grass;
      const e = elevation[i]!;
      elevation[i] = e < waterLevel + 6 ? waterLevel + 6 : e > 140 ? 140 : e;
    }
  }
}

function stamp(tiles: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, t: Terrain): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      tiles[y * w + x] = t;
    }
  }
}

export function tileAt(map: GameMap, x: number, y: number): Terrain {
  return map.tiles[y * map.width + x] as Terrain;
}

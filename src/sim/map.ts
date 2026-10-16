import { hash2 } from './rng';
import { Terrain } from '../data/terrain';
import { LEGACY_PRESETS, MAP_GEN, MAP_PRESETS, type MapPreset } from '../data/maps';

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
  /** Wersja generatora (zapis ją pamięta) */
  gen: number;
  /** Leśne ścieżki wydeptane od zawsze: 1 = ścieżka. Chłopi wolą nimi chodzić, w lesie nie ma na nich drzew. */
  trails: Uint8Array;
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
export function generateMap(seed: number, presetId: keyof typeof MAP_PRESETS = '1v1', gen = MAP_GEN): GameMap {
  const preset: MapPreset = (gen < 2 ? LEGACY_PRESETS[presetId] : undefined) ?? MAP_PRESETS[presetId];
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
      // góry tylko w masywach przy krawędzi, a między nimi teren dochodzi do puszczy za mapą
      const massif = valueNoise(x, y, 13, seed ^ 0x6a09e667);
      if (edge < rim && massif > 150) {
        t = Terrain.Mountain;
        e = Math.min(255, 170 + Math.min(rim - edge, (massif - 150) >> 3) * 9 + (hash2(x, y, seed) & 15));
      } else if (h < preset.waterLevel) t = Terrain.Water;
      // kamień i żelazo tylko u podnóża gór, w niedużych złożach; żelazo rzadsze i bliżej skał
      else if (edge < rim + 3 && massif > 120 && ore > 208) t = Terrain.Iron;
      else if (edge < rim + 5 && massif > 105 && valueNoise(x, y, 6, seed ^ 0x1b873593) > 186) t = Terrain.Stone;
      else if (forest > 146) {
        // w głębi puszczy tu i ówdzie polana (generator 2), żeby las nie był jednolitą ścianą
        t = gen >= 2 && forest < 200 && valueNoise(x, y, 5, seed ^ 0x0badf00d) > 226 ? Terrain.Grass : Terrain.Forest;
      }
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
    // pod zamkiem równy plac: średnia wysokość, łagodnie wtopiona w otoczenie
    let sum = 0, n = 0;
    for (let y = s.y - 6; y <= s.y + 6; y++) for (let x = s.x - 6; x <= s.x + 6; x++) if (x >= 0 && y >= 0 && x < width && y < height) { sum += elevation[y * width + x]!; n++; }
    const flat = Math.round(sum / Math.max(1, n));
    for (let y = s.y - 9; y <= s.y + 9; y++)
      for (let x = s.x - 9; x <= s.x + 9; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const d = Math.max(Math.abs(x - s.x), Math.abs(y - s.y)), k = d <= 6 ? 1 : (9 - d) / 3;
        const i = y * width + x;
        elevation[i] = Math.round(elevation[i]! + (flat - elevation[i]!) * k);
      }
    stamp(tiles, width, height, s.x - dir * (preset.startRadius + 1), s.y + dir * 3, 3, Terrain.Forest);
    stamp(tiles, width, height, s.x + dir * 2, s.y - dir * (preset.startRadius + 2), 1, Terrain.Stone);
    stamp(tiles, width, height, s.x - dir * 5, s.y - dir * (preset.startRadius + 2), 0, Terrain.Iron);
  }

  const trails = new Uint8Array(width * height);
  if (gen >= 2) carveTrails(tiles, elevation, trails, width, height, starts, seed, preset.startRadius);
  return { seed, width, height, tiles, elevation, starts, gen, trails };
}

/**
 * Leśne ścieżki: od każdej twierdzy wydeptane dróżki do środka mapy (i dalej do wroga), do skraju świata,
 * do najbliższych złóż kamienia i żelaza, a między sojusznikami do siebie. Każda kolejna ścieżka chętnie
 * wchodzi na już wydeptaną, więc wychodzi sieć z rozwidleniami, a szum terenu i zbocza każą jej się wić.
 * Liczymy tylko połowę (drużyna 0) i odbijamy środkowo, więc mapa zostaje symetryczna. Same liczby całkowite.
 */
function carveTrails(
  tiles: Uint8Array, elev: Uint8Array, trails: Uint8Array, w: number, h: number,
  starts: StartPosition[], seed: number, startRadius: number,
): void {
  const size = w * h, mirror = (t: number): number => size - 1 - t;
  const wiggle = new Uint8Array(size);
  // dwa szumy: szeroki każe ścieżce omijać „niewygodne” połacie łagodnym łukiem, drobny daje drobne zakręty
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) wiggle[y * w + x] = ((valueNoise(x, y, 9, seed ^ 0x2f6b9a41) * 30) >> 8) + ((valueNoise(x, y, 4, seed ^ 0x5bd1e995) * 8) >> 8);
  const nearStart = (t: number, r: number): boolean => {
    const x = t % w, y = (t - x) / w;
    return starts.some((s) => (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < r * r);
  };
  const stepCost = (t: number): number => {
    const tt = tiles[t]!;
    if (tt === Terrain.Water || tt === Terrain.Mountain) return -1;
    if (trails[t]) return 4; // po wydeptanej idzie się chętniej: ścieżki się łączą
    return (tt === Terrain.Forest ? 11 : tt === Terrain.Grass ? 10 : 34) + wiggle[t]!; // las prawie jak łąka: ścieżki śmiało w niego wchodzą
  };
  const dist = new Int32Array(size), prev = new Int32Array(size);
  const K = 1 << 18;
  /** A* z pola a do pola b; zwraca listę pól (z końcami) albo null */
  const route = (a: number, b: number): number[] | null => {
    dist.fill(-1);
    const bx = b % w, by = (b - bx) / w;
    const est = (t: number): number => { const x = t % w, y = (t - x) / w, dx = Math.abs(x - bx), dy = Math.abs(y - by); return dx > dy ? 4 * dx + dy : 4 * dy + dx; };
    const heap: number[] = [];
    const push = (k: number): void => { let i = heap.length; heap.push(k); while (i > 0) { const q = (i - 1) >> 1; if (heap[q]! <= k) break; heap[i] = heap[q]!; i = q; } heap[i] = k; };
    const pop = (): number => {
      const top = heap[0]!, last = heap.pop()!, n = heap.length;
      if (n) { let i = 0; for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && heap[c + 1]! < heap[c]!) c++; if (heap[c]! >= last) break; heap[i] = heap[c]!; i = c; } heap[i] = last; }
      return top;
    };
    dist[a] = 0; prev[a] = -1; push(est(a) * K + a);
    while (heap.length) {
      const key = pop(), t = key % K, c = dist[t]!;
      if ((key - t) / K > c + est(t)) continue;
      if (t === b) { const out: number[] = []; for (let u = b; u !== -1; u = prev[u]!) out.push(u); return out.reverse(); }
      const x = t % w, y = (t - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) { if (!(nx >= 0 && ny >= 0 && nx < w && ny < h && ny * w + nx === b)) continue; }
        const nt = ny * w + nx;
        let sc = stepCost(nt);
        if (sc < 0) continue;
        if (dx && dy) { if (stepCost(y * w + nx) < 0 || stepCost(ny * w + x) < 0) continue; sc = (sc * 14) / 10 | 0; }
        sc += Math.min(12, Math.abs(elev[nt]! - elev[t]!) >> 1); // pod górę ścieżka woli zakos
        const nc = c + sc;
        if (dist[nt]! >= 0 && dist[nt]! <= nc) continue;
        dist[nt] = nc; prev[nt] = t; push((nc + est(nt)) * K + nt);
      }
    }
    return null;
  };
  const carve = (path: number[] | null): void => {
    if (!path) return;
    for (const t of path) {
      if (nearStart(t, startRadius - 3)) continue; // na placu przed zamkiem ścieżki się rozchodzą (wydepcze je życie)
      trails[t] = 1; trails[mirror(t)] = 1;
    }
  };
  const walk = (t: number): boolean => tiles[t] !== Terrain.Water && tiles[t] !== Terrain.Mountain;
  /** Najbliższe chodzące pole do (x, y) — szukanie po rosnących kwadratach */
  const near = (x: number, y: number): number => {
    for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && walk(ny * w + nx)) return ny * w + nx;
    }
    return -1;
  };
  /** Ścieżka nie biegnie jak od linijki: po drodze kilka punktów odsuniętych w bok po łagodnej fali, łączonych po kolei */
  let nRoute = 0;
  const wander = (a: number, b: number): number[] | null => {
    const ax = a % w, ay = (a - ax) / w, bx = b % w, by = (b - bx) / w;
    const L = Math.hypot(bx - ax, by - ay), n = Math.floor(L / 11);
    const salt = hash2(nRoute++, a ^ b, seed ^ 0x1d3f);
    if (n < 2) return route(a, b);
    const px = -(by - ay) / L, py = (bx - ax) / L, amp = Math.min(7, L / 9) * (0.5 + (salt & 255) / 510), waves = 1 + ((salt >> 8) & 1), ph = ((salt >> 9) & 255) / 255 * Math.PI;
    const out: number[] = [a];
    let from = a;
    for (let i = 1; i <= n; i++) {
      let to = b;
      if (i < n) {
        const f = i / n, off = amp * Math.sin(Math.PI * f * waves + ph) * Math.sin(Math.PI * f) * 1.4 + (((hash2(i, salt, seed) & 7) - 3.5) / 3.5);
        to = near(Math.round(ax + (bx - ax) * f + px * off), Math.round(ay + (by - ay) * f + py * off));
        if (to < 0 || nearStart(to, startRadius - 3) && i > 1 && i < n - 1) continue;
      }
      const leg = route(from, to);
      if (!leg) { if (to === b) return null; continue; }
      // punkt w bok za wodą: ścieżka poszłaby tam i z powrotem — taki ślepy wypust ucinamy (pętlę zamykamy w miejscu powrotu)
      for (const t of leg.slice(1)) {
        const j = out.lastIndexOf(t);
        if (j >= 0) out.length = j + 1; else out.push(t);
      }
      from = to;
    }
    return out;
  };
  const own = starts.filter((s) => s.team === 0);
  const sIdx = (s: StartPosition): number => s.y * w + s.x;
  const centre = near(w >> 1, h >> 1);
  // 1) od każdej twierdzy do środka mapy (odbicie dokańcza drogę do wroga)
  for (const s of own) if (centre >= 0) carve(wander(sIdx(s), centre));
  // 2) sojusznicy między sobą
  for (let i = 0; i + 1 < own.length; i++) carve(wander(sIdx(own[i]!), sIdx(own[i + 1]!)));
  // 3) do złóż: najbliższe kamień i żelazo poza placem pod zamkiem
  for (const s of own) {
    for (const kind of [Terrain.Stone, Terrain.Iron]) {
      let best = -1, bd = Infinity;
      for (let t = 0; t < size; t++) {
        if (tiles[t] !== kind) continue;
        const x = t % w, y = (t - x) / w, d = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
        if (d < (startRadius + 8) * (startRadius + 8) || d > 70 * 70) continue;
        if (d < bd) { bd = d; best = t; }
      }
      if (best < 0) continue;
      const p = wander(sIdx(s), best);
      if (p) carve(p.slice(0, -1)); // na samym złożu ścieżka się kończy
    }
  }
  // 4) dwie dróżki na skraj świata (tam, gdzie między górami las ciągnie się dalej) — tędy przychodzą wędrowcy
  for (const s of own) {
    const cand: number[] = [];
    for (let x = 1; x < w - 1; x++) for (const y of [1, h - 2]) cand.push(y * w + x);
    for (let y = 1; y < h - 1; y++) for (const x of [1, w - 2]) cand.push(y * w + x);
    const picked: number[] = [];
    const scored = cand.filter(walk).map((t) => {
      const x = t % w, y = (t - x) / w, d = Math.hypot(x - s.x, y - s.y);
      return { t, x, y, k: d + (hash2(x, y, seed ^ 0x44aa) & 31) };
    }).sort((a, b) => a.k - b.k || a.t - b.t);
    for (const c of scored) {
      if (picked.length >= 2) break;
      if (picked.some((p) => { const px = p % w, py = (p - px) / w; return Math.abs(px - c.x) + Math.abs(py - c.y) < 40; })) continue;
      picked.push(c.t);
    }
    for (const e of picked) carve(wander(sIdx(s), e));
  }
  // 5) w głąb lasów: do serca każdego większego lasu w pobliżu twierdzy (tędy chodzą drwale i zbieracze)
  const depth = new Int16Array(size).fill(-1), comp = new Int32Array(size).fill(-1);
  const q: number[] = [];
  for (let t = 0; t < size; t++) if (tiles[t] !== Terrain.Forest) { depth[t] = 0; q.push(t); }
  for (let qi = 0; qi < q.length; qi++) {
    const t = q[qi]!, x = t % w, y = (t - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nt = ny * w + nx;
      if (depth[nt]! < 0) { depth[nt] = depth[t]! + 1; q.push(nt); }
    }
  }
  const woods: { deep: number; size: number }[] = [];
  for (let t0 = 0; t0 < size; t0++) {
    if (tiles[t0] !== Terrain.Forest || comp[t0]! >= 0) continue;
    const id = woods.length, stack = [t0];
    let deep = t0, n = 0;
    comp[t0] = id;
    while (stack.length) {
      const t = stack.pop()!, x = t % w, y = (t - x) / w;
      n++;
      if (depth[t]! > depth[deep]! || (depth[t] === depth[deep] && t < deep)) deep = t;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nt = ny * w + nx;
        if (tiles[nt] === Terrain.Forest && comp[nt]! < 0) { comp[nt] = id; stack.push(nt); }
      }
    }
    if (n >= 40 && depth[deep]! >= 3) woods.push({ deep, size: n });
  }
  for (const s of own) {
    const close = woods.filter((wd) => { const x = wd.deep % w, y = (wd.deep - x) / w; return Math.hypot(x - s.x, y - s.y) < 72; })
      .sort((a, b) => b.size - a.size || a.deep - b.deep).slice(0, 5);
    for (const wd of close) carve(wander(sIdx(s), wd.deep));
  }
  // przez las ścieżka to przecinka: na niej nie ma drzew
  for (let t = 0; t < size; t++) if (trails[t] && tiles[t] === Terrain.Forest) tiles[t] = Terrain.Grass;
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

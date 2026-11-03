import { Terrain } from '../data/terrain';
import { BIOME, CLIFF_STEP, type Biome } from '../data/biomes';
import { hash2 } from './rng';
import { symNoise, valueNoise } from './noise';

/**
 * Rzeźba terenu (generator 8, docs/teren.md): płaskowyże z urwiskami i podjazdami oraz skałki.
 *
 * - `relief` (0..255, jednostka RELIEF_M = 4 cm): o ile pole leży wyżej niż zwykła łąka. Tarasy z szumu zawiniętego
 *   drugim szumem (domain warping), więc brzegi płaskowyży wiją się jak naturalne progi. Stromość brzegu też z szumu:
 *   tam, gdzie brzeg jest stromy, wychodzi urwisko, a gdzie łagodny — podjazd.
 * - `crag` (1 = urwisko, 2 = skałka): pola skały wewnątrz mapy, nie do przejścia (w symulacji to `Terrain.Mountain`,
 *   jak góry na krańcach, ale rysowane nisko — jako ściana progu albo kamienny garb).
 * - Przy wodzie i przy zamkach rzeźba schodzi do zera: jeziora i rzeka leżą w dolinach, zamek zawsze na równym.
 * - Na końcu sprawdzamy przejścia: każdy większy kawałek lądu, do którego nie da się dojść od zamków, dostaje podjazd
 *   wycięty przez najwęższe miejsce skały; małe zamknięte kawałki stają się skałą (nikt nie postawi tam domu bez drogi).
 * Wszystko na liczbach całkowitych i symetrycznie (obrót o 180°), tak jak reszta mapy.
 */
export function shapeRelief(
  tiles: Uint8Array, w: number, h: number, starts: { x: number; y: number }[], seed: number, biome: Biome, startRadius: number,
): { relief: Uint8Array; crag: Uint8Array } {
  const B = BIOME[biome];
  const size = w * h, mirror = (t: number): number => size - 1 - t;
  const relief = new Uint8Array(size), crag = new Uint8Array(size);
  const isWater = (t: number): boolean => tiles[t] === Terrain.Water || tiles[t] === Terrain.Ford;
  const rim = new Uint8Array(size);
  for (let t = 0; t < size; t++) if (tiles[t] === Terrain.Mountain) rim[t] = 1;

  // odległość od wody (4-sąsiedztwo, do 8 pól)
  const dW = new Uint8Array(size).fill(255);
  const q: number[] = [];
  for (let t = 0; t < size; t++) if (isWater(t)) { dW[t] = 0; q.push(t); }
  for (let i = 0; i < q.length; i++) {
    const t = q[i]!, x = t % w, y = (t - x) / w, d = dW[t]!;
    if (d >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dW[n]! > d + 1) { dW[n] = d + 1; q.push(n); }
    }
  }
  const distStart = (x: number, y: number): number => {
    let best = 1 << 30;
    for (const s of starts) best = Math.min(best, (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y));
    return Math.floor(Math.sqrt(best));
  };

  // 1) tarasy
  for (let t = 0; t < size; t++) {
    const m0 = mirror(t);
    if (m0 < t) continue;
    if (rim[t] || isWater(t)) continue;
    const x = t % w, y = (t - x) / w;
    // zawinięcie współrzędnych: przesunięcie nieparzyste względem środka (w odbitym punkcie przeciwne), więc szum
    // tarasów w punkcie zawiniętym zostaje symetryczny
    const mx = w - 1 - x, my = h - 1 - y;
    const wx = x + (((valueNoise(x, y, 15, seed ^ 0x7a11) - valueNoise(mx, my, 15, seed ^ 0x7a11)) * 7) >> 8);
    const wy = y + (((valueNoise(x, y, 15, seed ^ 0x3c09) - valueNoise(mx, my, 15, seed ^ 0x3c09)) * 7) >> 8);
    const m = (symNoise(wx, wy, w, h, (a, b) => valueNoise(a, b, 24, seed ^ 0x5e1f)) * 3 + symNoise(wx, wy, w, h, (a, b) => valueNoise(a, b, 10, seed ^ 0x6b2d))) >> 2;
    // stromość brzegu (w ósemkach): 8 = podjazd przez kilka pól, 64 = próg w jednym polu
    const rn = symNoise(x, y, w, h, (a, b) => valueNoise(a, b, 8, seed ^ 0x2a7e));
    const k = rn < 112 ? 8 : rn > 168 ? 64 : 8 + (((rn - 112) * 56) / 56 | 0);
    let r = Math.max(0, Math.min(B.step, ((m - B.plateau) * k) >> 3));
    if (B.plateau2 < 255) r += Math.max(0, Math.min(B.step, ((m - B.plateau2) * k) >> 3));
    r = Math.floor((r * Math.min(5, Math.max(0, dW[t]! - 1))) / 5);
    r = Math.floor((r * Math.min(10, Math.max(0, distStart(x, y) - (startRadius + 4)))) / 10);
    relief[t] = r; relief[m0] = r;
  }

  // 2) urwiska: górne pole progu, gdy sąsiad leży o więcej niż CLIFF_STEP niżej
  const markCliffs = (): void => {
    for (let t = 0; t < size; t++) {
      if (rim[t] || isWater(t) || crag[t]) continue;
      const x = t % w, y = (t - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (relief[t]! - relief[ny * w + nx]! > CLIFF_STEP) { crag[t] = 1; break; }
      }
    }
  };
  markCliffs();

  // 3) skałki: kamienne garby w niedużych skupiskach, z dala od wody i zamków
  for (let t = 0; t < size; t++) {
    const m0 = mirror(t);
    if (m0 < t || crag[t] || rim[t] || isWater(t) || dW[t]! < 3) continue;
    const x = t % w, y = (t - x) / w;
    if (symNoise(x, y, w, h, (a, b) => valueNoise(a, b, 5, seed ^ 0x0c4a6)) <= B.outcrop) continue;
    if (distStart(x, y) <= startRadius + 10) continue;
    const lift = 16 + (hash2(x, y, seed ^ 0x5ca1) & 15);
    for (const u of [t, m0]) { crag[u] = 2; relief[u] = Math.min(255, relief[u]! + lift); }
  }

  // 4) przejścia: od pierwszego zamku musi dać się dojść do każdego większego kawałka lądu
  const walk = (t: number): boolean => !rim[t] && !crag[t] && !isWater(t) || tiles[t] === Terrain.Ford;
  const comp = new Int32Array(size);
  const neighbours = (t: number, f: (n: number) => void): void => {
    const x = t % w, y = (t - x) / w;
    if (x > 0) f(t - 1);
    if (x < w - 1) f(t + 1);
    if (y > 0) f(t - w);
    if (y < h - 1) f(t + w);
  };
  const s0 = starts[0]!;
  const home = s0.y * w + s0.x;
  const skip = new Set<number>();
  for (let iter = 0; iter < 60; iter++) {
    // składowe: 1 = dostępna od zamku, dalej kolejne numery
    comp.fill(0);
    const sizes = [0, 0];
    const flood = (from: number, id: number): number[] => {
      const st = [from], all: number[] = []; comp[from] = id;
      while (st.length) { const t = st.pop()!; all.push(t); neighbours(t, (u) => { if (!comp[u] && walk(u)) { comp[u] = id; st.push(u); } }); }
      return all;
    };
    sizes[1] = flood(home, 1).length;
    let target = -1, targetSize = 0;
    for (let t = 0; t < size; t++) {
      if (comp[t] || !walk(t)) continue;
      const id = sizes.length;
      const members = flood(t, id), n = members.length;
      sizes.push(n);
      if (n < 25 || skip.has(t)) {
        // mały zamknięty kawałek: skała (bez drogi i tak nie da się tam nic postawić)
        if (n < 25) for (const u of members) if (tiles[u] !== Terrain.Ford) crag[u] = 2;
        continue;
      }
      if (target < 0 || n > targetSize) { target = id; targetSize = n; }
    }
    if (target < 0) break;
    // najkrótsze przejście przez skałę (tylko pola crag) od kawałka „target” do dostępnego lądu
    const prev = new Int32Array(size).fill(-2);
    const queue: number[] = [];
    for (let t = 0; t < size; t++) {
      if (!crag[t]) continue;
      let touches = false;
      neighbours(t, (u) => { if (comp[u] === target) touches = true; });
      if (touches) { prev[t] = -1; queue.push(t); }
    }
    let hit = -1;
    for (let i = 0; i < queue.length && hit < 0; i++) {
      const t = queue[i]!;
      let done = false;
      neighbours(t, (u) => { if (comp[u] === 1) done = true; });
      if (done) { hit = t; break; }
      neighbours(t, (u) => { if (crag[u] && prev[u] === -2) { prev[u] = t; queue.push(u); } });
    }
    if (hit < 0) {
      // nie da się przebić (np. odcięte wodą bez brodu): kawałek zostaje, nie szukamy go więcej
      for (let t = 0; t < size; t++) if (comp[t] === target) { skip.add(t); break; }
      continue;
    }
    const path: number[] = [];
    for (let t = hit; t >= 0; t = prev[t]!) path.push(t);
    carveRamp(path);
  }

  /** Podjazd: pola ścieżki i ich sąsiedzi przestają być skałą, a rzeźba wokół wygładza się w łagodny stok */
  function carveRamp(path: number[]): void {
    const snap = relief.slice();
    const area = new Set<number>();
    for (const t of path) {
      const x = t % w, y = (t - x) / w;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        area.add(ny * w + nx);
      }
    }
    const blur = (src: Uint8Array, t: number): number => {
      const x = t % w, y = (t - x) / w;
      let sum = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        sum += src[ny * w + nx]!; n++;
      }
      return Math.floor(sum / n);
    };
    const tmp = snap.slice();
    for (const t of area) { const v = blur(snap, t); tmp[t] = v; tmp[mirror(t)] = v; }
    for (const t of area) { const v = blur(tmp, t); relief[t] = v; relief[mirror(t)] = v; }
    for (const t of path) {
      const x = t % w, y = (t - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const u = ny * w + nx;
        if (crag[u] === 1 || u === t) { crag[u] = 0; crag[mirror(u)] = 0; }
      }
    }
  }

  for (let t = 0; t < size; t++) if (crag[t]) tiles[t] = Terrain.Mountain;
  return { relief, crag };
}

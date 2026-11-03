import { Terrain } from '../data/terrain';
import { symNoise, valueNoise } from './noise';

/**
 * Pustynia (generator 10, docs/teren.md): las rośnie tylko w oazach — przy jeziorach i rzece (do 3 pól od wody),
 * a wokół wody gaje gęstnieją. Dalej od wody piach (w symulacji zwykła łąka: da się budować i chodzić; piasek,
 * wydmy i barwę rysuje teren). Gaje przy zamkach dokłada generator mapy po tej funkcji.
 * Liczby całkowite, wszystko symetryczne (dane wejściowe są symetryczne, szum też).
 */
export function desertify(tiles: Uint8Array, w: number, h: number, seed: number): void {
  const size = w * h;
  const dW = new Uint8Array(size).fill(255);
  const q: number[] = [];
  for (let t = 0; t < size; t++) if (tiles[t] === Terrain.Water || tiles[t] === Terrain.Ford) { dW[t] = 0; q.push(t); }
  for (let i = 0; i < q.length; i++) {
    const t = q[i]!, x = t % w, y = (t - x) / w, d = dW[t]!;
    if (d >= 6) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dW[n]! > d + 1) { dW[n] = d + 1; q.push(n); }
    }
  }
  for (let t = 0; t < size; t++) {
    const tt = tiles[t];
    if (tt !== Terrain.Forest && tt !== Terrain.Grass) continue;
    const x = t % w, y = (t - x) / w, d = dW[t]!;
    if (d > 3) { if (tt === Terrain.Forest) tiles[t] = Terrain.Grass; continue; }
    // oaza: przy samej wodzie gęsto (z przerwami na dojście), dalej coraz rzadziej
    const n = symNoise(x, y, w, h, (a, b) => valueNoise(a, b, 4, seed ^ 0x0a515));
    if (n > [0, 60, 110, 165][d]!) tiles[t] = Terrain.Forest;
  }
}

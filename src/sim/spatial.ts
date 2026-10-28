/**
 * Kubełki na mapie: obiekty (chłopi, żołnierze) podzielone na kwadraty CELL×CELL pól, żeby „kto jest blisko”
 * sprawdzać tylko w sąsiednich kwadratach, a nie po całej liście. Przy 4 na 4 każdy żołnierz przeglądał w każdym
 * kroku wszystkich chłopów na mapie (i każdy chłop wszystkich żołnierzy) — to rosło z kwadratem liczby ludzi.
 *
 * Wynik ma być DOKŁADNIE taki sam jak przy przeglądaniu całej listy (symulacja jest deterministyczna i porównywana
 * między graczami), dlatego `near` podaje też numer obiektu na liście z chwili zbudowania kubełków: przy równej
 * odległości wygrywa ten, który na liście jest wcześniej — tak jak w pętli `for (const o of lista)` z warunkiem `d < best`.
 */
const FP = 256;

export class Buckets<T extends { px: number; py: number }> {
  private cells = new Map<number, number[]>();
  private readonly span: number;
  private readonly cw: number;

  /** `keep` = które obiekty w ogóle trafiają do kubełków (stałe w czasie jednego kroku, np. drużyna, rodzaj) */
  constructor(readonly items: readonly T[], mapWidth: number, cell = 8, keep?: (o: T) => boolean) {
    this.span = cell * FP;
    this.cw = Math.ceil(mapWidth / cell) + 1;
    for (let i = 0; i < items.length; i++) {
      const o = items[i]!;
      if (keep && !keep(o)) continue;
      const k = this.key(Math.floor(o.px / this.span), Math.floor(o.py / this.span));
      let list = this.cells.get(k);
      if (!list) { list = []; this.cells.set(k, list); }
      list.push(i);
    }
  }

  private key(cx: number, cy: number): number { return cy * this.cw + cx; }

  /**
   * Wywołuje `fn(obiekt, numer)` dla każdego obiektu, którego |dx| i |dy| od (px, py) nie przekraczają `r`
   * (w jednostkach pozycji, 256 na pole) — i ewentualnie kilku dalszych z tych samych kwadratów; dokładną odległość
   * liczy `fn`. Kolejność dowolna: o remisie rozstrzyga numer.
   */
  near(px: number, py: number, r: number, fn: (o: T, index: number) => void): void {
    // pozycje na mapie są nieujemne, a kwadratów w rzędzie jest cw: poza tym zakresem nic nie leży (i klucz by się zawinął)
    const x0 = Math.max(0, Math.floor((px - r) / this.span)), x1 = Math.min(this.cw - 1, Math.floor((px + r) / this.span));
    const y0 = Math.max(0, Math.floor((py - r) / this.span)), y1 = Math.floor((py + r) / this.span);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const list = this.cells.get(this.key(cx, cy));
      if (list) for (const i of list) fn(this.items[i]!, i);
    }
  }
}

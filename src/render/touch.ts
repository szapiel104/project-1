/** Bufor instancji (macierze albo kolory) — tyle, ile z niego używamy */
interface Attr { count: number; itemSize?: number; needsUpdate: boolean; clearUpdateRanges?(): void; addUpdateRange?(start: number, count: number): void }
/** Siatka instancji albo coś, co się tak zachowuje (pule narzędzi, roślinność) */
interface Inst { count: number; instanceMatrix: Attr; instanceColor?: Attr | null }

/**
 * Oznacza zmienione instancje siatki do wysłania na kartę — ale tylko te, które naprawdę rysujemy (0…count).
 *
 * Samo `instanceMatrix.needsUpdate = true` każe three.js przesłać CAŁY bufor (przy puli na 2048 postaci to 128 KB
 * macierzy + 24 KB kolorów na każdą część ciała, co klatkę, także gdy widać trzy osoby). Z zakresem przesyłamy
 * tylko używany początek bufora. Przy pustej siatce (count = 0) nie wysyłamy nic.
 *
 * Działa dla każdego miejsca, które zapisuje instancje od zera do `count` (tak robią wszystkie nasze pule).
 * Obiekt bez prawdziwych buforów (pula narzędzi) dostaje tylko dawne `needsUpdate = true`.
 */
export function touch(m: Inst): void {
  const n = m.count;
  const mark = (a: Attr, per: number): void => {
    if (!a.clearUpdateRanges || !a.addUpdateRange) { a.needsUpdate = true; return; }
    a.clearUpdateRanges();
    if (n < a.count) a.addUpdateRange(0, n * per);
    a.needsUpdate = true;
  };
  if (n <= 0 && m.instanceMatrix.clearUpdateRanges) return;
  mark(m.instanceMatrix, 16);
  if (m.instanceColor) mark(m.instanceColor, m.instanceColor.itemSize ?? 3);
}

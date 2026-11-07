/** Bufor instancji (macierze albo kolory) — tyle, ile z niego używamy */
interface Attr { count: number; itemSize?: number; needsUpdate: boolean; version?: number; fullVer?: number; clearUpdateRanges?(): void; addUpdateRange?(start: number, count: number): void }
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
    // cały bufor czeka na wysłanie: touchAt nie może go potem zawęzić do jednej sztuki
    a.fullVer = n < a.count ? undefined : a.version;
  };
  if (n <= 0 && m.instanceMatrix.clearUpdateRanges) return;
  mark(m.instanceMatrix, 16);
  if (m.instanceColor) mark(m.instanceColor, m.instanceColor.itemSize ?? 3);
}

/**
 * Oznacza do wysłania na kartę tylko jedną sztukę (instancję) siatki — np. ścinane drzewo w lesie z tysiącami drzew
 * (Michał 7.11.2026: „drzewo leci jak w 2 FPS-ach”: `touch` wysyłał co klatkę macierze całego lasu). Zakresy dopisują się
 * do tych z tej klatki; karta czyści je po wysłaniu.
 */
export function touchAt(m: Inst, index: number): void {
  const a = m.instanceMatrix;
  // brak zakresów albo w tej klatce już zlecono wysłanie całości (touch) — dopisanie jednej sztuki wysłałoby tylko ją,
  // a reszta zmian by przepadła (obiekty znikały i wracały); wtedy po prostu cały bufor
  if (!a.addUpdateRange || (a.fullVer !== undefined && a.fullVer === a.version)) { a.needsUpdate = true; return; }
  a.addUpdateRange(index * 16, 16);
  a.needsUpdate = true;
}

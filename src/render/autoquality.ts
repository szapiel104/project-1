/**
 * Automatyczna jakość grafiki: gra mierzy płynność i sama dobiera poziom do komputera gracza.
 * Poziomy od najlżejszego (0) do najładniejszego. Przy przycinaniu schodzi o poziom niżej (co kilka sekund,
 * aż będzie płynnie). W górę próbuje tylko raz na sesję i tylko gdy poprzednio było wyraźnie płynnie;
 * jeśli po próbie znów przycina, wraca i więcej nie próbuje (bez skakania tam i z powrotem).
 */
export interface QualityTier {
  /** Rozdzielczość obrazu względem ekranu (1 = normalna, 2 = ostra na gęstych ekranach) */
  scale: number;
  /** Rozmiar mapy cieni (0 = bez cieni) */
  shadows: number;
  ao: 'off' | 'low' | 'medium' | 'high';
  /** Zasięg gęstej trawy wokół kamery (1 = pełny, 0 = bez trawy: zostaje tekstura ziemi) */
  grass: number;
  /** Zasięg szczegółów (1 = pełny): drzewa jako bryły i drobiazgi (kępy, kamyki) do 30 pól, niżej odpowiednio bliżej */
  detail: number;
}

export const TIERS: readonly QualityTier[] = [
  { scale: 0.75, shadows: 0, ao: 'off', grass: 0, detail: 0.55 },
  { scale: 1, shadows: 1024, ao: 'off', grass: 0, detail: 0.65 },
  { scale: 1, shadows: 2048, ao: 'low', grass: 0.8, detail: 0.75 },
  { scale: 1.5, shadows: 2048, ao: 'medium', grass: 1, detail: 0.9 },
  { scale: 2, shadows: 4096, ao: 'medium', grass: 1, detail: 1 },
];
export const TOP_TIER = TIERS.length - 1;

/** Poniżej tylu klatek na sekundę obniżamy jakość */
const LOW_FPS = 45;
/** Tyle klatek na sekundę przez całe okno = jest zapas, można spróbować wyżej */
const SMOOTH_FPS = 57;
/** Po starcie i po każdej zmianie czekamy, aż się ułoży (wczytanie, kompilacja shaderów) */
const SETTLE_MS = 4000;
const WINDOW_MS = 3000;

export class AutoQuality {
  private settle = SETTLE_MS;
  private time = 0;
  private frames = 0;
  private smoothWindows = 0;
  private triedUp = false;
  private droppedAfterUp = false;

  constructor(public tier: number) {
    this.tier = Math.max(0, Math.min(TOP_TIER, Math.round(tier)));
  }

  /**
   * Kolejna klatka (czas od poprzedniej w ms). Zwraca nowy poziom, gdy trzeba go zmienić, inaczej null.
   * Przerwy dłuższe niż 250 ms (karta w tle, przełączenie okna, zapis) pomijamy — to nie wina grafiki.
   */
  frame(dtMs: number): number | null {
    if (dtMs <= 0 || dtMs > 250) return null;
    if (this.settle > 0) { this.settle -= dtMs; return null; }
    this.time += dtMs;
    this.frames++;
    if (this.time < WINDOW_MS) return null;
    const fps = (this.frames * 1000) / this.time;
    this.time = 0;
    this.frames = 0;
    if (fps < LOW_FPS && this.tier > 0) {
      if (this.triedUp) this.droppedAfterUp = true;
      this.smoothWindows = 0;
      return this.change(this.tier - 1);
    }
    this.smoothWindows = fps >= SMOOTH_FPS ? this.smoothWindows + 1 : 0;
    // ok. 15 s płynnie: jedna próba wyżej na sesję
    if (this.smoothWindows >= 5 && !this.triedUp && !this.droppedAfterUp && this.tier < TOP_TIER) {
      this.triedUp = true;
      this.smoothWindows = 0;
      return this.change(this.tier + 1);
    }
    return null;
  }

  private change(t: number): number {
    this.tier = t;
    this.settle = 2000;
    return t;
  }
}

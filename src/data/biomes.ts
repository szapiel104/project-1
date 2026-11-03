/**
 * Krainy (generator map 8, Michał 3.11.2026: „teren ma być różny — pustynia, góry, coś innego”).
 * Każda mapa dostaje jedną krainę z ziarna; kraina zmienia generator (las, woda, płaskowyże, skałki), wygląd ziemi
 * i klimat (temperatura). Zasady gry są te same — to nadal ten sam świat, tylko inny krajobraz.
 * Wszystkie liczby całkowite (mapa liczy się identycznie u każdego gracza).
 */
export type Biome = 'meadow' | 'highland' | 'steppe' | 'north';
export const BIOMES: Biome[] = ['meadow', 'highland', 'steppe', 'north'];

export interface BiomeDef {
  /** Klucz tłumaczenia nazwy */
  name: string;
  /** Przesunięcie progu wody (ujemne = mniej jezior) */
  water: number;
  /** Próg lasu na szumie 0..255 (wyżej = mniej lasu); dawne mapy: 146 */
  forest: number;
  /** Próg płaskowyżu na szumie 0..255 (wyżej = mniej płaskowyży); 255 = bez */
  plateau: number;
  /** Drugi, wyższy taras (tylko wyżyna); 255 = bez */
  plateau2: number;
  /** Wysokość jednego tarasu (jednostki rzeźby po 4 cm) */
  step: number;
  /** Próg skałek na drobnym szumie 0..255 (wyżej = mniej skałek) */
  outcrop: number;
  /** Co które pole łąki ma głaz (dawne mapy: 140) */
  boulder: number;
  /** Klimat: przesunięcie temperatury w °C */
  temp: number;
}

export const BIOME: Record<Biome, BiomeDef> = {
  // łęgi: łąki, lasy, jeziora, gdzieniegdzie niskie wzgórze z progiem skalnym
  meadow: { name: 'biome.meadow', water: 0, forest: 146, plateau: 178, plateau2: 255, step: 42, outcrop: 251, boulder: 140, temp: 0 },
  // wyżyna: dwa poziomy płaskowyży z urwiskami, dużo skałek i głazów, mniej wody
  highland: { name: 'biome.highland', water: -7, forest: 150, plateau: 140, plateau2: 186, step: 55, outcrop: 240, boulder: 70, temp: -2 },
  // step: suche trawy i piach, rzadkie gaje, oczka wodne, płaskie stoliwa
  steppe: { name: 'biome.steppe', water: -11, forest: 168, plateau: 160, plateau2: 255, step: 62, outcrop: 244, boulder: 90, temp: 4 },
  // północ: gęsta tajga, chłodno (śnieg leży dłużej), niskie progi skalne
  north: { name: 'biome.north', water: 2, forest: 134, plateau: 172, plateau2: 255, step: 40, outcrop: 247, boulder: 110, temp: -5 },
};

/** Jednostka rzeźby (relief) w metrach */
export const RELIEF_M = 0.04;
/** Różnica rzeźby między sąsiednimi polami, powyżej której jest urwisko (nie do przejścia) */
export const CLIFF_STEP = 20;

/** Pierwszy generator z krainami */
export const BIOME_GEN = 8;

/** Wymuszona kraina (tylko piaskownica testowa: ?test=1&kraina=step); null = z ziarna */
let forced: Biome | null = null;
export function forceBiome(b: Biome | null): void { forced = b; }

/** Kraina mapy z ziarna: łęgi 3 na 8, wyżyna i step po 2 na 8, północ 1 na 8 */
export function biomeOfSeed(seed: number, hash: (x: number, y: number, s: number) => number): Biome {
  if (forced) return forced;
  const r = hash(seed, 8, 0x0b10e) % 8;
  return r < 3 ? 'meadow' : r < 5 ? 'highland' : r < 7 ? 'steppe' : 'north';
}

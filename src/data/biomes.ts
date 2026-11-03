/**
 * Krainy (generator map 8, Michał 3.11.2026: „teren ma być różny — pustynia, góry, coś innego”).
 * Każda mapa dostaje jedną krainę z ziarna; kraina zmienia generator (las, woda, płaskowyże, skałki), wygląd ziemi
 * i klimat (temperatura). Zasady gry są te same — to nadal ten sam świat, tylko inny krajobraz.
 * Wszystkie liczby całkowite (mapa liczy się identycznie u każdego gracza).
 */
export type Biome = 'meadow' | 'highland' | 'steppe' | 'north' | 'desert';
export const BIOMES: Biome[] = ['meadow', 'highland', 'steppe', 'north', 'desert'];

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
  // pustynia (generator 10): piach i wydmy, stoliwa, oazy — woda i las tylko przy oazach (sim/desert.ts), gorąco
  desert: { name: 'biome.desert', water: -15, forest: 150, plateau: 168, plateau2: 255, step: 66, outcrop: 255, boulder: 100, temp: 7 },
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

/**
 * Kraina mapy z ziarna. Generator 8–9: łęgi 3 na 8, wyżyna i step po 2 na 8, północ 1 na 8 (bez zmian — stare zapisy
 * bez zapisanej krainy liczą ją stąd). Od generatora 10 dochodzi pustynia: łęgi 3, wyżyna 2, step 2, pustynia 2, północ 1 na 10.
 */
export function biomeOfSeed(seed: number, hash: (x: number, y: number, s: number) => number, gen = 99): Biome {
  if (forced) return forced;
  if (gen < 10) {
    const r = hash(seed, 8, 0x0b10e) % 8;
    return r < 3 ? 'meadow' : r < 5 ? 'highland' : r < 7 ? 'steppe' : 'north';
  }
  const r = hash(seed, 10, 0x0b10e) % 10;
  return r < 3 ? 'meadow' : r < 5 ? 'highland' : r < 7 ? 'steppe' : r < 9 ? 'desert' : 'north';
}

/** Woda na mapie (generator 10, Michał 3.11.2026: „woda nie zawsze musi iść środkiem”) */
export type RiverMode = 'mid' | 'twin' | 'none';
export function riverOfSeed(seed: number, biome: Biome, hash: (x: number, y: number, s: number) => number): RiverMode {
  const r = hash(seed, 10, 0x71e5) % 10;
  if (biome === 'desert') return r < 6 ? 'mid' : 'none'; // pustynia: rzeka przez środek (zielone brzegi) albo same oazy
  return r < 5 ? 'mid' : r < 8 ? 'twin' : 'none';
}

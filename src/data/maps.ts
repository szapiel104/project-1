export interface MapPreset {
  width: number;
  height: number;
  /** Próg wysokości, poniżej którego jest woda (0..255) */
  waterLevel: number;
  /** Promień czystej łąki wokół startu */
  startRadius: number;
  /** Szerokość pasa gór na krańcach mapy (w polach) */
  rim: number;
  /** Pozycje startowe drużyny 0 w procentach mapy; drużyna 1 dostaje odbicie środkowe */
  starts: { x: number; y: number }[];
}

/** Nowy tryb = nowy wpis tutaj. Silnik nie zna liczby graczy na sztywno. */
export const MAP_PRESETS = {
  // 1 na 1: większa mapa i twierdze dalej od siebie (było 160 pól i start na 36/40 % — ok. 55 pól między zamkami, teraz ok. 100)
  '1v1': { width: 192, height: 192, waterLevel: 62, startRadius: 12, rim: 10, starts: [{ x: 29, y: 34 }] },
  '2v2': { width: 208, height: 208, waterLevel: 62, startRadius: 12, rim: 11, starts: [{ x: 30, y: 50 }, { x: 52, y: 28 }] },
  '4v4': {
    width: 272, height: 272, waterLevel: 60, startRadius: 12, rim: 12,
    starts: [{ x: 22, y: 64 }, { x: 36, y: 42 }, { x: 54, y: 27 }, { x: 76, y: 18 }],
  },
} satisfies Record<string, MapPreset>;

export type MapPresetId = keyof typeof MAP_PRESETS;

/** Wersja generatora map. Zapis pamięta, z której wersji pochodzi mapa, bo mapę odtwarza się z ziarna. */
export const MAP_GEN = 2;
/** Stare ustawienia (generator 1), żeby dawne zapisy wczytywały się na tej samej mapie co przedtem */
export const LEGACY_PRESETS: Partial<Record<MapPresetId, MapPreset>> = {
  '1v1': { width: 160, height: 160, waterLevel: 62, startRadius: 12, rim: 10, starts: [{ x: 36, y: 40 }] },
};

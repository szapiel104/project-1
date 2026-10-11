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
  '1v1': { width: 112, height: 112, waterLevel: 62, startRadius: 7, rim: 9, starts: [{ x: 26, y: 28 }] },
  '2v2': { width: 144, height: 144, waterLevel: 62, startRadius: 7, rim: 10, starts: [{ x: 20, y: 34 }, { x: 36, y: 19 }] },
  '4v4': {
    width: 184, height: 184, waterLevel: 60, startRadius: 7, rim: 11,
    starts: [{ x: 14, y: 42 }, { x: 24, y: 28 }, { x: 36, y: 18 }, { x: 50, y: 12 }],
  },
} satisfies Record<string, MapPreset>;

export type MapPresetId = keyof typeof MAP_PRESETS;

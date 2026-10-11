export interface MapPreset {
  width: number;
  height: number;
  /** Próg wysokości, poniżej którego jest woda (0..255) */
  waterLevel: number;
  /** Promień czystej łąki wokół startu */
  startRadius: number;
  /** Pozycje startowe drużyny 0 w procentach mapy; drużyna 1 dostaje odbicie środkowe */
  starts: { x: number; y: number }[];
}

/** Nowy tryb = nowy wpis tutaj. Silnik nie zna liczby graczy na sztywno. */
export const MAP_PRESETS = {
  '1v1': { width: 72, height: 72, waterLevel: 70, startRadius: 6, starts: [{ x: 20, y: 22 }] },
  '2v2': { width: 96, height: 96, waterLevel: 70, startRadius: 6, starts: [{ x: 16, y: 30 }, { x: 34, y: 14 }] },
  '4v4': {
    width: 128, height: 128, waterLevel: 68, startRadius: 6,
    starts: [{ x: 10, y: 40 }, { x: 22, y: 26 }, { x: 34, y: 14 }, { x: 48, y: 8 }],
  },
} satisfies Record<string, MapPreset>;

export type MapPresetId = keyof typeof MAP_PRESETS;

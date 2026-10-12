import type { ResourceId } from './resources';

/** Jednostka wojskowa. Nowa jednostka = nowy wpis tutaj (plus wygląd w render i nazwa w i18n). Kolejność ma znaczenie. */
export interface UnitDef {
  id: string;
  name: string;
  /** Co zużywa szkolenie (broń ze składu i złoto); do tego zawsze jeden wolny chłop */
  cost: Partial<Record<ResourceId, number>>;
  hp: number;
  /** Szybkość marszu w procentach szybkości chłopa */
  speed: number;
  /** Obrażenia jednego ciosu */
  attack: number;
  /** Ticki między ciosami */
  cooldown: number;
  /** Z jakiej odległości (w polach) wypatruje wroga */
  sight: number;
}

export const UNITS: readonly UnitDef[] = [
  { id: 'spearman', name: 'u.spearman', cost: { spear: 1, gold: 8 }, hp: 60, speed: 110, attack: 9, cooldown: 12, sight: 6 },
];

export const unitIndex = (id: string): number => UNITS.findIndex((u) => u.id === id);

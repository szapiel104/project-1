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
  /** Strzelec: z ilu pól trafia (brak = walczy wręcz) */
  range?: number;
  /** Broń ze składu potrzebna do wyszkolenia (do wyświetlania) */
  weapon: ResourceId;
  /** Nosi tarczę: strzała z przodu zadaje mu połowę obrażeń */
  shield?: boolean;
  /** Szarża: pierwszy cios po rozbiegu (w procentach zwykłego ciosu) */
  charge?: number;
  /** Straż miejska: nie szkoli się jej w koszarach i nie słucha rozkazów, sama pilnuje osady */
  guard?: boolean;
}

export const UNITS: readonly UnitDef[] = [
  { id: 'spearman', name: 'u.spearman', cost: { spear: 1, gold: 8 }, hp: 60, speed: 110, attack: 9, cooldown: 12, sight: 6, weapon: 'spear', shield: true, charge: 200 },
  // Łucznik: słabszy w zwarciu, ale strzela z daleka; z wieży strażniczej widzi i trafia dalej
  { id: 'archer', name: 'u.archer', cost: { bow: 1, gold: 12 }, hp: 40, speed: 105, attack: 7, cooldown: 24, sight: 8, range: 6, weapon: 'bow' },
  // Strażnik miejski z zamku: włócznia, zbroja, nocą pochodnia; obchodzi osadę i stoi na posterunkach (na końcu listy dla starych zapisów)
  { id: 'guard', name: 'u.guard', cost: {}, hp: 70, speed: 100, attack: 8, cooldown: 12, sight: 7, weapon: 'spear', shield: true, guard: true },
];

/** Indeks strażnika miejskiego w UNITS */
export const GUARD = UNITS.findIndex((u) => u.guard);

export const unitIndex = (id: string): number => UNITS.findIndex((u) => u.id === id);

/** Zasięg strzału łucznika na wieży (zasięg łuku + 3 pola za wysokość), ten sam co w symulacji */
export const TOWER_RANGE = (UNITS.find((u) => u.id === 'archer')?.range ?? 6) + 3;

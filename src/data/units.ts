import type { ResourceId } from './resources';

/** Jednostka wojskowa. Nowa jednostka = nowy wpis tutaj (plus wygląd w render i nazwa w i18n). Kolejność ma znaczenie. */
export interface UnitDef {
  id: string;
  name: string;
  /** Co zużywa szkolenie (broń ze składu i ruda); do tego zawsze jeden wolny chłop */
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
  /** Taran: bije tylko w budynki (bramy, mury, zamek), na ludzi nie zwraca uwagi; strzały prawie go nie ranią */
  ram?: boolean;
  /** Zbój z obozu w lesie: nikogo nie słucha, nie szkoli się go, prowadzi go systems/bandits.ts */
  bandit?: boolean;
  /** Drugi sprzęt ze zbrojowni potrzebny do wyszkolenia (oprócz broni), np. kolczuga zbrojnego */
  gear?: ResourceId;
  /** Saper: nie walczy; rozbiera wrogie ruiny i znosi z nich surowce do własnej twierdzy (systems/army.ts) */
  sapper?: boolean;
  /** Zbroja: o tyle procent mniej boli cios wręcz; strzała półtora raza mniej (najwyżej 75%) */
  armor?: number;
  /** Mag bojowy (szkoli się w siedzibie swojego zakonu, nie w koszarach; najwyżej `MAGE_CAP` na gracza):
   *  'fire' — kula ognia nie chybia, parzy też stojących tuż obok celu i podpala budynki;
   *  'water' — czar wody odrzuca trafionego o pole i spowalnia go, a bez walki gasi własne płonące budynki */
  magic?: 'fire' | 'water';
}

export const UNITS: readonly UnitDef[] = [
  { id: 'spearman', name: 'u.spearman', cost: { spear: 1, gold: 8 }, hp: 60, speed: 110, attack: 9, cooldown: 12, sight: 6, weapon: 'spear', shield: true, charge: 200 },
  // Łucznik: słabszy w zwarciu, ale strzela z daleka; z wieży strażniczej widzi i trafia dalej
  { id: 'archer', name: 'u.archer', cost: { bow: 1, gold: 12 }, hp: 40, speed: 105, attack: 7, cooldown: 24, sight: 10, range: 8, weapon: 'bow' }, // z daleka: 8 pól (dawniej 6 — musieli podchodzić pod sam szyk)
  // Strażnik miejski z zamku: włócznia, zbroja, nocą pochodnia; obchodzi osadę i stoi na posterunkach (na końcu listy dla starych zapisów)
  { id: 'guard', name: 'u.guard', cost: {}, hp: 70, speed: 100, attack: 8, cooldown: 12, sight: 7, weapon: 'spear', shield: true, guard: true },
  // Taran: wóz z daszkiem i belką z kutą głowicą, pcha go chłop z koszar; wolny, ale rozbija bramy i mury (na końcu listy dla starych zapisów)
  { id: 'ram', name: 'u.ram', cost: { wood: 40, gold: 30 }, hp: 320, speed: 45, attack: 60, cooldown: 40, sight: 12, weapon: 'wood', ram: true },
  // Zbój z obozu w puszczy: włócznia, skóry, bez tarczy; szybki i zaczepny, ale słabszy od wyszkolonego włócznika
  { id: 'bandit', name: 'u.bandit', cost: {}, hp: 50, speed: 112, attack: 7, cooldown: 14, sight: 7, weapon: 'spear', bandit: true },
  // Zbrojny: ciężka piechota w klimacie Starego Obozu — miecz z kuźni, kolczuga od płatnerza, hełm. Wolniejszy, ale twardy:
  // zbroja zjada część każdego ciosu i większość strzał; bez szarży i bez tarczy (na końcu listy dla starych zapisów)
  { id: 'manatarms', name: 'u.manatarms', cost: { sword: 1, armor: 1, gold: 20 }, hp: 110, speed: 88, attack: 13, cooldown: 14, sight: 6, weapon: 'sword', gear: 'armor', armor: 35 },
  // Saper (inżynier wojskowy): kilof i łom z żelaza, skórzany kaftan; nie walczy, rozbiera wrogie ruiny do gołej ziemi
  // i znosi z nich drewno, kamień i żelazo do własnej twierdzy — wróg musi stawiać od nowa, za pełną cenę (na końcu listy dla starych zapisów)
  { id: 'sapper', name: 'u.sapper', cost: { iron: 2, gold: 10 }, hp: 45, speed: 100, attack: 0, cooldown: 14, sight: 10, weapon: 'iron', sapper: true },
  // Magowie bojowi (na końcu listy dla starych zapisów): mag Płomienia rzuca kulami ognia, mag Źródła czarem wody.
  // Kruche (mało zdrowia), ale biją z daleka i nigdy nie chybiają; drodzy w rudzie i jest ich najwyżej 10 na gracza
  { id: 'mageFire', name: 'u.mageFire', cost: { gold: 50, crystal: 1 }, hp: 55, speed: 95, attack: 26, cooldown: 32, sight: 9, range: 7, weapon: 'gold', magic: 'fire' },
  { id: 'mageWater', name: 'u.mageWater', cost: { gold: 45, crystal: 1 }, hp: 65, speed: 95, attack: 15, cooldown: 26, sight: 9, range: 6, weapon: 'gold', magic: 'water' },
];

/** Najwyżej tylu magów bojowych może mieć jeden gracz (razem obu zakonów, z tymi w drodze do siedziby) */
export const MAGE_CAP = 10;
/** Siedziba, w której szkoli się mag danego zakonu */
export const MAGE_HALL: Record<'fire' | 'water', string> = { fire: 'mageFire', water: 'mageWater' };

/** Indeks sapera w UNITS */
export const SAPPER = UNITS.findIndex((u) => u.sapper);

/** Indeks zbója w UNITS */
export const BANDIT_KIND = UNITS.findIndex((u) => u.bandit);
/** „Właściciel” zbójów i ich obozów: nie ma takiego gracza, więc dla każdego gracza to wróg (osobna drużyna) */
export const BANDITS = 200;

/** Indeks strażnika miejskiego w UNITS */
export const GUARD = UNITS.findIndex((u) => u.guard);

export const unitIndex = (id: string): number => UNITS.findIndex((u) => u.id === id);

/** Zasięg strzału łucznika na wieży (zasięg łuku + 3 pola za wysokość), ten sam co w symulacji */
export const TOWER_RANGE = (UNITS.find((u) => u.id === 'archer')?.range ?? 6) + 3;

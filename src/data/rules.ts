import type { ResourceId } from './resources';

/** Zasady gospodarki. Balans zmieniamy tutaj, nie w kodzie systemów. */
export const RULES = {
  /** Długość „miesiąca” w tickach: co tyle rozliczane są racje, podatki i popularność */
  monthTicks: 100,
  /** Długość doby w tickach (24 godziny gry). 2400 = 4 minuty przy tempie 1× */
  dayTicks: 2400,
  /** Godzina, o której zaczyna się gra */
  startHour: 8,
  /** Co ile ticków przybywa lub ubywa chłop */
  migrationTicks: 30,
  startPeasants: 6,
  /** Tylu chłopów zostaje przy twierdzy zawsze, nawet przy głodzie, żeby dało się odbudować osadę */
  minPeasants: 4,
  startPopularity: 75,
  maxPopularity: 100,
  /** Od tej popularności przybywa ludzi, poniżej odchodzą */
  migrationThreshold: 50,
  startResources: { wood: 150, stone: 40, apples: 100, gold: 100 } as Partial<Record<ResourceId, number>>,
  /** Jak daleko od własnej twierdzy wolno budować (w polach) */
  buildRadius: 24,
  /** Prędkość chłopa: 256 = jedno pole na tick */
  unitSpeed: 28,
  unitSpeedDiagonal: 20,
  /** O ile procent szybciej idzie się po drodze: [brak, piaskowa, kamienna] */
  roadSpeedBonus: [0, 25, 55],
  /** Koszt przejścia pola przy szukaniu drogi w procentach zwykłego: ludzie wolą iść drogą */
  roadPathCost: [100, 75, 55],
  /** Ile razy można wydobyć surowiec z jednego pola złoża, zanim się wyczerpie */
  depositYields: 5,
  /** Po tylu dostawach chłop idzie odpocząć do najbliższej chaty */
  restEvery: 3,
  /** Ile ticków siedzi w chacie */
  restTicks: 80,
  /** Ile surowca mieści jeden kurs z gruzem */
  rubbleLoad: 8,
  /** Ilu ludzi naraz wynosi gruz z jednej rozbiórki */
  rubbleHaulers: 2,
  /** Przy rozbiórce wraca tyle procent kosztu */
  refundPercent: 50,
  /** Kara do popularności za brak miejsc w domach */
  crowdingPenalty: -2,
  /** Racje: ile żywności miesięcznie na 8 chłopów i wpływ na popularność */
  rations: [
    { name: 'rations.none', foodPer8: 0, effect: -8 },
    { name: 'rations.half', foodPer8: 2, effect: -4 },
    { name: 'rations.full', foodPer8: 4, effect: 0 },
    { name: 'rations.extra', foodPer8: 6, effect: 4 },
    { name: 'rations.double', foodPer8: 8, effect: 8 },
  ],
  /** Podatki: złoto miesięcznie na 2 chłopów (ujemne = rozdawanie złota) i wpływ na popularność */
  taxes: [
    { name: 'tax.bribe', goldPer2: -2, effect: 4 },
    { name: 'tax.none', goldPer2: 0, effect: 1 },
    { name: 'tax.low', goldPer2: 1, effect: -2 },
    { name: 'tax.mid', goldPer2: 2, effect: -4 },
    { name: 'tax.high', goldPer2: 3, effect: -6 },
  ],
  defaultRations: 2,
  defaultTax: 1,
} as const;

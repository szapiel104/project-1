import type { ResourceId } from './resources';

/** Zasady gospodarki. Balans zmieniamy tutaj, nie w kodzie systemów. */
export const RULES = {
  /** Długość „miesiąca” w tickach: co tyle rozliczane są racje, podatki i popularność */
  monthTicks: 100,
  /** Co ile ticków przybywa lub ubywa chłop */
  migrationTicks: 30,
  startPeasants: 6,
  startPopularity: 75,
  maxPopularity: 100,
  /** Od tej popularności przybywa ludzi, poniżej odchodzą */
  migrationThreshold: 50,
  startResources: { wood: 150, stone: 40, apples: 80, gold: 100 } as Partial<Record<ResourceId, number>>,
  /** Jak daleko od własnej twierdzy wolno budować (w polach) */
  buildRadius: 24,
  /** Prędkość chłopa: 256 = jedno pole na tick */
  unitSpeed: 28,
  unitSpeedDiagonal: 20,
  /** Po tylu dostawach chłop idzie odpocząć do najbliższej chaty */
  restEvery: 3,
  /** Ile ticków siedzi w chacie */
  restTicks: 80,
  /** Przy rozbiórce wraca tyle procent kosztu */
  refundPercent: 50,
  /** Kara do popularności za brak miejsc w domach */
  crowdingPenalty: -2,
  /** Racje: ile żywności miesięcznie na 8 chłopów i wpływ na popularność */
  rations: [
    { name: 'rations.none', foodPer8: 0, effect: -8 },
    { name: 'rations.half', foodPer8: 3, effect: -4 },
    { name: 'rations.full', foodPer8: 6, effect: 0 },
    { name: 'rations.extra', foodPer8: 9, effect: 4 },
    { name: 'rations.double', foodPer8: 12, effect: 8 },
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

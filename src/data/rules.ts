import type { ResourceId } from './resources';

/** Zasady gospodarki. Balans zmieniamy tutaj, nie w kodzie systemów. */
export const RULES = {
  /** Długość „miesiąca” w tickach: co tyle rozliczane są racje, podatki i popularność */
  monthTicks: 100,
  /** Długość doby w tickach (24 godziny gry). 3600 = 6 minut przy tempie 1× (dzień pracy ok. 5 min, wieczór ok. 30 s, noc ok. 40 s) */
  dayTicks: 3600,
  /** Godzina, o której zaczyna się gra */
  startHour: 8,
  /** Co ile ticków przybywa lub ubywa chłop */
  migrationTicks: 30,
  startPeasants: 6,
  /** Tylu chłopów zostaje przy twierdzy zawsze, nawet przy głodzie, żeby dało się odbudować osadę */
  minPeasants: 4,
  /** Ile piwa wypija jedna karczma na miesiąc */
  alePerTavern: 1,
  /** Karczma z karczmarzem, ale bez piwa w składzie: ludzie się złoszczą */
  dryTavernPenalty: -2,
  startPopularity: 75,
  maxPopularity: 100,
  /** Od tej popularności przybywa ludzi, poniżej odchodzą */
  migrationThreshold: 50,
  /** Gdy jedzenia zabrakło (a nie gracz skąpi racji): łagodna kara popularności co miesiąc — głodni i tak odchodzą sami */
  hungerPenalty: -2,
  /** Bunt głodowy: po tylu pustych posiłkach z rzędu (rozliczenie co miesiąc gry, ok. 3,5 godziny gry) część chłopów
   *  rzuca robotę i staje pod bramą twierdzy — wcześniej niż głodni zdążą rozejść się z osady */
  revoltMeals: 5,
  /** Jaka część ludzi buntuje się bez straży miejskiej, a jaka, gdy straż pilnuje porządku */
  revoltShare: 0.5,
  revoltShareGuarded: 0.34,
  /** Bunt w osadzie psuje nastroje co miesiąc */
  revoltPenalty: -3,
  /** „Rozdaj chleb” w oknie twierdzy: tyle porcji na każdego buntownika pod bramą (chleb idzie pierwszy, potem jabłka i ryby);
   *  tłum od razu się rozchodzi, a ludzie cenią pana, który się z nimi podzielił */
  dolePortions: 4,
  dolePopularity: 2,
  /** „Rozpędź tłum” (straż siłą): od razu tyle popularności w dół — ludzie nie zapominają pałek */
  quellPenalty: -8,
  /** Po rozpędzeniu głód z rzędu spada do progu buntu minus tyle posiłków: bez jedzenia tłum wróci szybko */
  quellMargin: 2,
  /** Długi bunt: po tylu tickach od początku (6 rozliczeń, ok. minuta przy tempie 1×, 4 godziny gry) tłum rusza na pierwszy
   *  napad, potem co tyle ticków na kolejny. Na zmianę: napad na skład (rozkradają część towaru) i podpalenie spichlerza */
  riotRaidAfter: 600,
  riotRaidEvery: 400,
  /** Napad: tylu buntowników najwyżej idzie z tłumu i taka część towaru ze składu znika (rozkradziona) */
  riotRaiders: 6,
  riotLoot: 0.25,
  /** Podpalony spichlerz: taka część jedzenia idzie z dymem */
  riotBurn: 0.2,
  startResources: { wood: 80, stone: 0, apples: 100, bread: 300, gold: 60 } as Partial<Record<ResourceId, number>>,
  /** Jak daleko od własnej twierdzy wolno budować (w polach) */
  buildRadius: 30,
  /** Prędkość chłopa: 256 = jedno pole na tick */
  unitSpeed: 28,
  unitSpeedDiagonal: 20,
  /** O ile procent szybciej idzie się po drodze: [brak, piaskowa, kamienna, z dyli] — kamienna wyraźnie najszybsza */
  roadSpeedBonus: [0, 20, 80, 35],
  /** Koszt przejścia pola przy szukaniu drogi w procentach zwykłego: ludzie wolą iść drogą */
  roadPathCost: [100, 80, 45, 70],
  /** Koszt kroku (w %) bez drogi: po leśnej ścieżce taniej, przez gęsty las drożej — chłopi wybierają ścieżki */
  trailPathCost: 82,
  forestPathCost: 125,
  /** Leśniczy: ile ticków rośnie drzewko do pełnego lasu (dwa dni gry; zimą wzrost stoi) */
  saplingTicks: 7200,
  /** Leśniczy: ile ticków sadzi jedno drzewko */
  plantTicks: 60,
  /** Leśniczy: najwięcej rosnących naraz drzewek na jedną chatę (żeby nie zarósł całej łąki) */
  foresterSaplings: 14,
  /** Ile razy można wydobyć surowiec z jednego pola złoża, zanim się wyczerpie */
  depositYields: 5,
  /** Rytm dnia: od tej godziny ludzie kończą robotę i idą do ogniska albo do karczmy */
  eveningHour: 19.5,
  /** Od tej godziny idą spać: do chaty, a gdy nie ma wolnego miejsca, na słomiane posłanie pod gołym niebem */
  sleepHour: 22,
  /** O tej godzinie wstają i wracają do pracy */
  wakeHour: 5.5,
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
  /** Podatki: ruda miesięcznie na 6 chłopów (ujemne = rozdawanie rudy) i wpływ na popularność.
   *  Do 0.47 liczone na 2 chłopów — rudy było za dużo (przy 40 ludziach i niskim podatku ok. 500 na dobę, teraz ok. 170) */
  taxes: [
    { name: 'tax.bribe', goldPer6: -2, effect: 4 },
    { name: 'tax.none', goldPer6: 0, effect: 1 },
    { name: 'tax.low', goldPer6: 1, effect: -2 },
    { name: 'tax.mid', goldPer6: 2, effect: -4 },
    { name: 'tax.high', goldPer6: 3, effect: -6 },
  ],
  /** Burze (storms.ts): przy deszczu od `rain` (poza zimą, od `minTemp` °C) co `every` ticków każdy gracz ma `chance` %, że piorun
   *  podpali mu budynek (pożar na `burn` ticków); deszcz przygasza każdy pożar o `rainDouse` × siła deszczu na tick */
  storm: { rain: 0.75, minTemp: 4, every: 50, chance: 9, burn: 600, rainDouse: 2 },
  /** Susza (storms.ts): w gorące letnie dni bez deszczu (od `temp` °C) sad i pole dają `yield` % plonu, a ze studnią
   *  najwyżej `wellRange` pól od budynku — `withWell` % */
  drought: { temp: 20, yield: 50, withWell: 90, wellRange: 8 },
  /** Wiara (faith.ts): co tyle dni święto pod kapliczką z kaznodzieją; ile popularności daje kazanie i dzień święta */
  faith: { feastEvery: 7, sermon: 1, feast: 2 },
  /** Etapy osady: od tylu ludzi wioska staje się osadą, grodem i miastem; późniejsze budynki wymagają wyższego etapu (BuildingDef.tier) */
  tiers: [0, 20, 40, 70],
  /** Każdy następny budynek tego samego rodzaju drożeje o tyle procent ceny (najwyżej `costStepMax` procent więcej);
   *  drogi, palisada, mury, bramy, drabiny, pochodnie i kosze ognia zawsze po zwykłej cenie */
  costStep: 10,
  costStepMax: 100,
  defaultRations: 2,
  defaultTax: 1,
  /**
   * Zaraza (plague.ts). Szanse liczone co `every` ticków; wybuch losowany co miesiąc gry (na 100 000).
   * Bez magów umiera mniej więcej co trzeci chory, a stojące warsztaty i pola dokładają głód — osada słabnie bardzo,
   * ale nie wymiera: kto przechoruje, ma odporność, więc zaraza w końcu wygasa, a śmierć nie bierze ostatnich `minPeasants`.
   */
  plague: {
    every: 25,
    /** Pierwsze dni gry bez zarazy z niczego (gracz dopiero stawia osadę) */
    graceTicks: 3 * 3600,
    /** Po wygaśnięciu zarazy tyle ticków spokoju (2 doby), zanim nowa wybuchnie sama z siebie */
    calmTicks: 2 * 3600,
    /** Osada mniejsza niż tyle ludzi nie łapie zarazy z niczego */
    minPop: 10,
    /** Ryzyko wybuchu (na 100 000 co miesiąc): od każdego mieszkańca, od każdych niepochowanych zwłok w osadzie (najwyżej 12),
     *  od każdego pustego posiłku z rzędu, od ciasnoty i od każdego śpiącego pod gołym niebem */
    riskPerHead: 4,
    riskCorpse: 70,
    riskFamine: 120,
    riskCrowd: 90,
    riskRough: 15,
    /** Zwłoki zaczynają szkodzić po tylu tickach leżenia (grabarz zdąży, jeśli jest) */
    corpseAge: 400,
    /** Zima mnoży ryzyko (w %) */
    winterRisk: 150,
    /** Mnożnik ryzyka (w %) według poziomu trudności: pokojowy, łatwy, zwykły, trudny */
    levelRisk: [0, 60, 100, 130],
    /** Zapobieganie (mnożnik w %): siedziba Bractwa Źródła, Zakonu Płomienia, chatka maga, studnia */
    guardWater: 40,
    guardFire: 55,
    guardHut: 75,
    guardWell: 85,
    /** Na start zarazy choruje tylu ludzi: 1 + co dwudziesty mieszkaniec */
    firstPer: 20,
    /** Wylęganie: tyle ticków chory jeszcze pracuje i już zaraża (od–do) */
    incubate: [250, 550],
    /** Gorączka: tyle ticków leży (od–do), potem zdrowieje */
    fever: [1500, 2700],
    /** Zarażenie co `every` ticków (na 10 000): śpiący pod jednym dachem z gorączkującym, stojący tuż obok gorączkującego
     *  na dworze, obok chaty z chorym, obok wylęgającego */
    spreadHome: 300,
    spreadNear: 60,
    spreadDoor: 40,
    spreadCarrier: 15,
    /** Na dworze (tłum przy ognisku, przy robocie) najwyżej tyle na raz, choćby obok stało wielu chorych */
    spreadCrowdMax: 40,
    /** Śmierć gorączkującego co `every` ticków (na 10 000); głód, sen pod gołym niebem i zima mnożą (w %) */
    death: 52,
    deathHungry: 150,
    deathRough: 130,
    deathWinter: 120,
    /** Odporność po przechorowaniu (6 dób) */
    immuneTicks: 6 * 3600,
    /** Śmierć z zarazy psuje nastroje */
    deathPenalty: -1,
  },
  /** Magowie (plague.ts): czas czaru w tickach, opieka (o ile % mniej zgonów), o ile skraca gorączkę (najwyżej do tylu ticków) */
  mages: {
    /** Bractwo Źródła: leczy najlepiej i najszybciej */
    water: { cast: 70, care: 90, feverLeft: 500 },
    /** Chatka maga (jeden wędrowny mag, służy obu kręgom): wolniej i słabiej, ale lepiej niż nic */
    hut: { cast: 150, care: 70, feverLeft: 1100 },
    /** Zakon Płomienia: przede wszystkim pali zwłoki i wypala zarazę z chat; chorym zbija gorączkę słabiej */
    fire: { cast: 90, care: 50, feverLeft: 1400 },
    /** Wypalona chata: tyle ticków bez zarażania się w niej (doba) */
    cleanTicks: 3600,
    /** Oba zakony w osadzie: czary szybsze (w %) — współpracują, choć się nie lubią */
    together: 70,
    /** Siedziby obu zakonów bliżej niż tyle pól od siebie: kłótnie pod oknami psują nastroje */
    quarrelRange: 12,
    quarrelPenalty: -1,
    /** Mag idzie do chorego najdalej tyle pól */
    reach: 45,
  },
} as const;

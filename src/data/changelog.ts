import type { ChangeEntry } from './changelogTypes';
import { CHANGES_A } from './changelog_a';
import { CHANGES_B } from './changelog_b';
export type { ChangeEntry } from './changelogTypes';

/**
 * Dziennik zmian dla graczy (menu → „Co nowego”, Michał 30.10.2026). Najnowsze na górze.
 * KAŻDA nowa wersja dopisuje tu wpis na samej górze listy NEW (punkty po polsku i po angielsku, dla gracza, bez nazw plików)
 * — tak jak CHANGELOG.md dla nas. `tests/changelog.test.ts` pilnuje, że najnowszy wpis ma wersję z package.json.
 */
const NEW: ChangeEntry[] = [
  {
    v: '0.69.8', date: '2026-10-30',
    pl: [
      'Kula czaru maga z muru albo wieży (albo lecąca w obrońcę na murze) przelatuje łukiem nad dachami, zamiast przez ściany budynków.',
      'Stodoła pokazuje zboże: z prawej strony klepiska leżą snopki i worki mąki, z lewej towary składu.',
    ],
    en: [
      'A spell cast from a wall or tower (or at a defender on a wall) now arcs over the rooftops instead of flying through the walls of buildings.',
      'The barn shows its grain: sheaves and sacks of flour lie on the right of the threshing floor, stockpile goods on the left.',
    ],
  },
  {
    v: '0.69.7', date: '2026-10-30',
    pl: ['Skryba nie zasypuje już kroniki: o pełnym magazynie mówi najwyżej raz na 5 minut gry, a o tym, że znów jest miejsce — dopiero gdy magazyn przez półtorej minuty nie zapchał się ponownie.'],
    en: ['The scribe no longer floods the chronicle: he reports a full store at most once every 5 game minutes, and that there is room again only once it has stayed clear for a minute and a half.'],
  },
  {
    v: '0.69.6', date: '2026-10-30',
    pl: [
      'Płynniej podczas dużych bitew: gruz z rozbitych budynków rysuje się kilkoma kawałkami zamiast kilkudziesięciu na stos, a drobne kamyki na łąkach są prostsze i nie rzucają cienia.',
      'Okno rynku: część z pracownikami, przenoszeniem i rozbiórką nie nachodzi już na towary, a całe okno zaczyna się pod licznikami w prawym górnym rogu.',
      'Rynek pisze o swojej załodze „kupców”, a nie „górników”.',
    ],
    en: [
      'Smoother in big battles: rubble from wrecked buildings is drawn in a few pieces instead of dozens per heap, and the small pebbles in the meadows are simpler and cast no shadow.',
      'Market window: the part with workers, moving and dismantling no longer overlaps the goods, and the whole window starts below the counters in the top-right corner.',
      'The market now speaks of its crew as “merchants”, not “miners”.',
    ],
  },
  {
    v: '0.69.5', date: '2026-10-30',
    pl: [
      'Czary brzmią jak czary: kula ognia buchnięciem płomienia, kula wody świstem — bez szczęku miecza.',
      'Bot, który przedarł się za mury, nie rozbija kolejnych murów: idzie w głąb, najpierw na koszary, zbrojownie i warsztaty broni, potem na resztę osady, zamek prawie na końcu.',
      'Zburzony mur kamienny nie zostawia płaskiego chodnika z kamieni — leży tylko gruz.',
    ],
    en: [
      'Spells sound like spells: a fireball with a roar of flame, a water bolt with a hiss — no more clash of steel.',
      'A bot that has broken through your walls no longer batters the next wall: it pushes inward, first to the barracks, armoury and weapon workshops, then the rest of the settlement, the keep almost last.',
      'A razed stone wall no longer leaves a flat stone path behind — only rubble.',
    ],
  },
  {
    v: '0.69.4', date: '2026-10-30',
    pl: [
      'Rynek wysuwa się z prawej krawędzi ekranu i jest do niej przyklejony; okno budynku (pracownicy, przenieś, rozbierz) jest w nim na górze — jedno okno zamiast dwóch.',
      'Rynek w skali ludzi: lada na wysokości pasa, daszki tuż nad głową, mniejszy szyld.',
      'Gdy wróg ostrzeliwuje albo bije budynek, twoi bezczynni żołnierze i magowie w promieniu 10 pól ruszają na napastnika (tak samo u botów).',
      'Magia nie przelatuje już przez mury i budynki: kula, której cel zdążył schować się za przeszkodą, rozbija się na niej, a wielki czar nie sięga za ścianę.',
    ],
    en: [
      'The market now slides in from the right edge of the screen and stays docked there; the building window (workers, move, dismantle) sits at its top — one window instead of two.',
      'The market is in scale with folk: the counter at waist height, the awnings just above their heads, a smaller sign.',
      'When the enemy shoots at or strikes a building, your idle soldiers and mages within 10 tiles go for the attacker (bots do the same).',
      'Magic no longer passes through walls and buildings: a bolt whose target ducked behind cover shatters on it, and a great spell does not reach past a wall.',
    ],
  },
  {
    v: '0.69.3', date: '2026-10-30',
    pl: ['Na szyldzie rynku wisi teraz bryła rudy z niebieskimi żyłkami (zamiast złotej monety), przybita pionowo do deski.'],
    en: ['The market sign now bears a lump of blue-veined ore (instead of a gold coin), nailed upright to the board.'],
  },
  {
    v: '0.69.2', date: '2026-10-30',
    pl: [
      'Rynek ma kupców: za dnia jeden (w większej osadzie dwóch) stoi za ladą kramu i zachwala towar.',
      'Po sprzedaży i kupnie nad rynkiem wyskakuje „+N” albo „−N” rudy z ikonką, jak liczby obrażeń.',
      'Rynek bez dziwnego placu z ziemi — kramy stoją na trawie na kamiennych płytach; moneta na szyldzie wisi prosto.',
      'Ruda wyróżniona na dolnym pasku: pierwsza, w złotej ramce, z większą liczbą.',
      'Skrót do rynku obok skrótów koszar, składu i spichlerza; klik w licznik składu pokazuje, co w nim leży i ile miejsca zostało.',
      'Poprawka wydania: ta wersja za pierwszym razem nie weszła do gry.',
    ],
    en: [
      'The market has merchants: by day one (two in a larger settlement) stands behind a stall and cries his wares.',
      'After a sale or purchase, “+N” or “−N” ore with its icon pops up over the market, like damage numbers.',
      'No more odd earthen square under the market — the stalls stand on stone slabs on the grass, and the coin on the sign hangs true.',
      'Ore stands out on the bottom bar: first, in a gold frame, with a bigger number.',
      'A market shortcut sits beside those for the barracks, stockpile and granary; clicking the stockpile counter shows what lies in it and how much room is left.',
      'Fixed a stalled release: this version did not reach the game at first.',
    ],
  },
  {
    v: '0.69.1', date: '2026-10-30',
    pl: [
      'Okno rynku na nowo: duże, na środku ekranu, towary w kafelkach pogrupowanych (budulec, jedzenie, broń, skarby), duże liczby i przyciski; zamykasz je krzyżykiem albo Esc.',
    ],
    en: [
      'The market window, redone: large and centred, goods in tiles grouped by kind (materials, food, arms, treasures), with big numbers and buttons; close it with the cross or Esc.',
    ],
  },
  {
    v: '0.69.0', date: '2026-10-30',
    pl: [
      'Nowy budynek: Rynek (3×3, 60 drewna i 20 kamienia, od etapu Osada). Sprzedajesz i kupujesz od ręki każdy towar za rudę — drewno, kamień, żelazo, jedzenie, piwo, broń, drabiny i kryształy.',
      'Kupno kosztuje dwa razy tyle co sprzedaż, a kupiony towar od razu ląduje w magazynach, jeśli jest w nich miejsce.',
      'Boty też handlują: sprzedają nadwyżki i dokupują, czego im brakuje.',
      'Karty budowy jeszcze szersze, cały koszt w jednym rzędzie; „Od etapu…” wisi na karcie jako złota flaga.',
      'Zniknęła zakładka „Dwór” na dolnym pasku — racje i podatki ustawiasz w oknie popularności.',
    ],
    en: [
      'New building: the Market (3×3, 60 timber and 20 stone, from the Settlement stage). Sell and buy any goods for ore on the spot — timber, stone, iron, food, ale, arms, ladders and crystals.',
      'Buying costs twice what selling fetches, and bought goods go straight into your stores if there is room.',
      'Bots trade too: they sell their surplus and buy what they lack.',
      'Build cards are wider still, with the whole cost on one line; “From stage…” now hangs on the card as a golden pennant.',
      'The “Court” tab is gone from the bottom bar — set rations and taxes in the popularity window.',
    ],
  },
  {
    v: '0.68.8', date: '2026-10-30',
    pl: [
      'Szersze karty budynków w pasku budowy, a koszty na nich z oddechem: większe ikonki surowców i wyraźne liczby, dwie tabliczki obok siebie.',
    ],
    en: [
      'Wider building cards on the build bar, with roomier costs: bigger resource icons and clearer numbers, two plates side by side.',
    ],
  },
  {
    v: '0.68.7', date: '2026-10-30',
    pl: [
      'Kopalnia to przede wszystkim ruda: co czwarty kurs górnika przynosi 6 rudy, a kamienia i żelaza wychodzi mniej niż przed dniem.',
    ],
    en: [
      'The mine is first and foremost for ore now: about one run in four brings back 6 ore, with less stone and iron than before.',
    ],
  },
  {
    v: '0.68.6', date: '2026-10-30',
    pl: [
      'Nowa zakładka „Co nowego” w menu: dzień po dniu, co weszło w każdej wersji gry.',
      'Chłop niesie ten sam kamień i te same sztaby żelaza, które potem leżą w składzie.',
      'Zapasy jedzenia na start nie przepełniają już spichlerza (najwyżej 90% miejsca).',
    ],
    en: [
      'A new “What’s new” page in the menu: day by day, what each version of the game brought.',
      'Peasants now carry the very same stone blocks and iron bars that later lie in the store.',
      'Starting food no longer overfills the granary (at most 90% of its room).',
    ],
  },
];

export const CHANGES: ChangeEntry[] = [...NEW, ...CHANGES_A, ...CHANGES_B];

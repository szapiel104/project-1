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

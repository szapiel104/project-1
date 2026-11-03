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
    v: '0.84.2', date: '2026-11-03',
    pl: [
      'Iskry nad ogniskami i pożarami to teraz małe, ostre, rozżarzone punkty — z bliska nie rosną już w wielkie rozmyte pomarańczowe kule.',
      'Blask okien i pochodni nocą delikatniejszy i z bliska ograniczony, bez plam na pół ekranu.',
    ],
    en: [
      'Sparks above campfires and blazes are now small, sharp glowing points — up close they no longer swell into big blurry orange balls.',
      'Window and torch glow at night is softer and capped up close, with no blotches across half the screen.',
    ],
  },
  {
    v: '0.84.1', date: '2026-11-03',
    pl: [
      'Zamiast kopii jednego kamienia leżą trzy różne odmiany głazów, wrośnięte w zbocze; skała przy urwiskach jest ciemniejsza.',
      'Nowe mapy bez skałek na łąkach — wrócą z porządnymi modelami skał.',
      'Step: zamiast pomarańczowych plam piachu o ostrych brzegach płowa, sucha trawa i tylko miejscami miękkie łaty piachu.',
    ],
    en: [
      'Instead of copies of one stone there are three different boulders, sunk into the slope; rock by the cliffs is darker.',
      'New maps have no rocky knolls on the meadows for now — they will return with proper rock models.',
      'Steppe: pale dry grass with only the odd soft patch of sand instead of hard-edged orange sand blotches.',
    ],
  },
  {
    v: '0.84.0', date: '2026-11-03',
    pl: [
      'Krainy: każda nowa mapa ma swój krajobraz — Łęgi (łąki, lasy, jeziora), Wyżyna (płaskowyże ze skalnymi urwiskami), Step (suche trawy, piach, rzadkie gaje, cieplej i częściej susza) albo Północ (gęsta tajga, chłodno, śnieg leży dłużej). Nazwa krainy jest przy minimapie i przy podglądzie mapy w „Nowej grze”.',
      'Płaskowyże z urwiskami nie do przejścia i z łagodnymi podjazdami, skałki na łąkach i rumowiska pod skałą. Zamek zawsze stoi na równym, a z każdego zamku da się dojść do każdego.',
      'Koniec prostego „szwu” przez środek mapy: lasy, jeziora i wzgórza przechodzą płynnie przez połowę mapy.',
      'Śnieg pada: przy mrozie zamiast deszczu sypią płatki, a zimą przy zachmurzeniu przechodzą drobne śnieżyce.',
      'Nowy dym: kłęby z poszarpanymi brzegami, które powoli się obracają; nad pożarem gęsty słup podświetlony od dołu łuną ognia, z kominów jasny i miękki.',
      'Za dnia żywsze, cieplejsze barwy i lżejsza winieta — mniej szaro (noc i deszcz jak dotąd).',
    ],
    en: [
      'Lands: every new map has its own landscape — Lowland meadows (meadows, woods, lakes), Highlands (plateaus with rocky cliffs), Steppe (dry grass, sand, sparse groves, warmer with more droughts) or Northlands (dense taiga, cold, snow lingers). The land’s name sits by the minimap and under the map preview in “New game”.',
      'Plateaus with impassable cliffs and gentle ramps, rocky outcrops on the meadows and scree below the rock. Your keep always stands on level ground, and every keep can reach every other.',
      'No more straight “seam” across the middle of the map: woods, lakes and hills flow smoothly across both halves.',
      'Snow falls: in frost you get flakes instead of rain, and in winter light flurries drift by under cloudy skies.',
      'New smoke: billows with ragged edges that slowly turn; a fire sends up a thick column lit from below by the blaze, chimneys give off soft pale smoke.',
      'By day the colours are livelier and warmer with a lighter vignette — far less grey (night and rain as before).',
    ],
  },
  {
    v: '0.83.1', date: '2026-11-03',
    pl: [
      'Koszary: większe kafelki, postać na cały kafelek (włócznik już nie jest malutki), duża tabliczka „×4” z liczbą, ilu możesz wyszkolić.',
      'Karta po najechaniu większa i czytelniejsza: koszt jako tabelka „potrzeba / masz” z nazwami, siła w osobnych polach i dokładnie, czego brakuje.',
      'W koszarach karta szczegółów staje obok okna i nie zasłania innych jednostek.',
      'Karty budowy, kafelki koszar i opisy po najechaniu na pergaminie jak w „Jak grać” — czytelniej i w klimacie.',
      'Kronika i wiadomości doradców w lewym górnym rogu; liczba żołnierzy do wyszkolenia w lewym dolnym rogu kafelka.',
    ],
    en: [
      'Barracks: larger tiles, the soldier fills the tile (the spearman is no longer tiny), a big “×4” plate with how many you can train.',
      'The hover card is larger and clearer: cost as a “needed / you have” table with names, strength in separate boxes and exactly what is missing.',
      'In the barracks the details card sits beside the window and no longer covers other units.',
      'Build cards, barracks tiles and hover descriptions on parchment like in “How to play” — clearer and in keeping.',
      'The chronicle and advisers’ messages in the top-left corner; the number of soldiers you can train in the tile’s bottom-left corner.',
    ],
  },
  {
    v: '0.83.0', date: '2026-11-03',
    pl: [
      'Koszary jak w grach o zamkach: rząd wysokich kafelków z całą postacią żołnierza i liczbą, ilu możesz wyszkolić. Koszt, zapasy i siła — w karcie po najechaniu.',
      'W koszarach: klik szkoli jednego, Shift+klik pięciu, Ctrl+klik wszystkich; prawy klik stawia flagę zbiórki tego rodzaju (Shift+prawy zdejmuje).',
      'Karty budowy: duży obrazek budynku i nazwa; opis, koszt i warunek odblokowania pokazują się po najechaniu.',
    ],
    en: [
      'Barracks as in castle games: a row of tall tiles with the whole soldier and how many you can train. Cost, stock and strength show on a card when you hover.',
      'In the barracks: click trains one, Shift+click five, Ctrl+click all; right-click sets a rally flag for that kind (Shift+right-click removes it).',
      'Build cards: a large picture of the building and its name; description, cost and unlock condition appear on hover.',
    ],
  },
  {
    v: '0.82.0', date: '2026-11-03',
    pl: [
      '„Jak grać” jak prawdziwa księga: pergaminowe strony, czerwone nagłówki, inicjał na początku rozdziału, rady z pieczęcią i przejście do poprzedniego i następnego rozdziału.',
      'Ustawienia na tym samym pergaminie: czytelne przełączniki i suwaki, poziomy grafiki jako karty z paskami mocy i podświetlonym obecnym poziomem.',
      'Spis rozdziałów i stron z ikonami i wyraźną czcionką; „Co nowego” też na pergaminie.',
      'Strona księgi zawsze na całą wysokość okna, poziomy grafiki jako jasne karty.',
      'Ustawienia: każda opcja pod poprzednią, w jednej kolumnie — przełączniki nie są ściśnięte i nie wychodzą poza stronę.',
      'Zapisy w chmurze konta, jedna nagroda PD za mecz i usuwanie uwag testerów działają już na serwerze.',
    ],
    en: [
      '“How to play” as a real book: parchment pages, red headings, an initial letter at the start of each chapter, sealed tips and links to the previous and next chapter.',
      'Settings on the same parchment: clear toggles and sliders, graphics presets as cards with power bars and the current level highlighted.',
      'The contents list with icons and a clear font; “What’s new” on parchment too.',
      'Book pages always fill the window height; graphics presets as light cards.',
      'Settings: one option under another in a single column — toggles are no longer squeezed or spill off the page.',
      'Cloud saves on your account, one XP award per match and deleting tester notes now work on the server.',
    ],
  },
  {
    v: '0.81.0', date: '2026-11-03',
    pl: [
      'Nowy pokój gry: duży nagłówek z trybem, mapą i licznikiem miejsc, ustawienia jako przełączniki (tryb, rodzaj gry, boty), drużyny w kartach z kolorem.',
      'W pokoju lista znajomych z „Zaproś” jednym kliknięciem (kto w grze — na górze) i czat pokoju obok.',
      'Nowy ranking: podium trzech najlepszych, Twoje miejsce na wierzchu i pasek skuteczności przy każdym graczu.',
      'Menu po lewej czytelniejsze: wyraźna czcionka, ikona przy każdej pozycji, większe pola.',
      'Dzwoneczek pokazuje też przeczytane powiadomienia z ostatnich 7 dni; nowe są wyróżnione złotem i kropką.',
      'Znajomi: od razu zakładki z napisami i „Wczytuję…” zamiast pustych ramek.',
      'Pokój układa się według szerokości panelu: obok podglądu mapy drużyny i czat idą pod sobą, bez ściskania.',
    ],
    en: [
      'New game room: a large header with the mode, map and seat count, settings as toggles (mode, game type, bots), teams in coloured cards.',
      'The room lists your friends with a one-click “Invite” (those online on top) and the room chat beside it.',
      'New ranking: a podium for the top three, your place up front and a win-rate bar for every player.',
      'Clearer menu on the left: a plain readable font, an icon for every entry, larger targets.',
      'The bell also shows read notifications from the last 7 days; new ones stand out in gold with a dot.',
      'Friends: tabs with labels and “Loading…” right away instead of empty frames.',
      'The room lays itself out by the panel width: beside the map preview the teams and chat stack instead of squeezing.',
    ],
  },
  {
    v: '0.80.2', date: '2026-11-03',
    pl: ['Lobby: „Własna gra” w dwóch równych wierszach — nazwa na całą szerokość, pod nią tryb i „Załóż grę”; przycisk już się nie łamie.'],
    en: ['Lobby: “Custom game” in two even rows — the name across the full width, below it the mode and “Create game”; the button no longer wraps.'],
  },
  {
    v: '0.80.1', date: '2026-11-03',
    pl: ['Lobby gry przez sieć równiej i nowocześniej: jedna belka startu — duży zielony „Graj teraz” i obok w jednym wierszu własna gra (nazwa, tryb, „Załóż grę”), wszystko tej samej wysokości; nagłówek listy gier z licznikiem, filtrami i rankingiem w jednej linii; panel znajomych na całą wysokość.'],
    en: ['The online lobby is tidier and more modern: one start bar — a big green “Play now” and beside it, on one line, a custom game (name, mode, “Create game”), all the same height; the game list header with count, filters and ranking on one line; the friends panel full height.'],
  },
  {
    v: '0.80.0', date: '2026-11-03',
    pl: [
      'Nowe okno „Gra przez sieć”: na górze trzy szybkie działania — „Graj teraz” (pokój 1 na 1 od ręki), własna gra z nazwą i trybem do kliknięcia, ranking.',
      'Lista otwartych gier jako czytelne wiersze: duży znaczek trybu, nazwa, gospodarz, ilu graczy z ilu, stan i „Dołącz”; filtry trybów jako przełączniki.',
      'Z boku znajomi: kto jest w grze, „Zaproś” (od razu zakłada pokój i wysyła zaproszenie), „Dołącz”, gdy czeka w pokoju, dymek „Napisz”, zaproszenia do znajomych i szukanie graczy po nicku z „Dodaj”.',
    ],
    en: [
      'A new “Online play” window: three quick actions at the top — “Play now” (a 1 vs 1 room right away), a custom game with a name and clickable mode, the ranking.',
      'Open games as clear rows: a big mode badge, name, host, how many players of how many, status and “Join”; mode filters as toggles.',
      'Friends on the side: who is online, “Invite” (opens a room and sends the invitation at once), “Join” when they wait in a room, a “Message” bubble, friend requests and finding players by nickname with “Add”.',
    ],
  },
  {
    v: '0.79.7', date: '2026-11-03',
    pl: ['Nowe okienka z pytaniem: ikonka działania, czytelny tytuł, kadr z datą zapisu, liczby (dzień, ludzie, wojsko, budynki, złoto), ostrzeżenie na czerwonym tle przy nieodwracalnych działaniach i dwa równe, duże przyciski; krzyżyk w rogu.'],
    en: ['New confirmation dialogs: an action icon, a readable title, the picture with the save date, numbers (day, people, army, buildings, gold), a red warning for irreversible actions and two equal, large buttons; a close cross in the corner.'],
  },
  {
    v: '0.79.6', date: '2026-11-03',
    pl: ['Nowy wygląd kafelków zapisów: nazwa i data na kadrze z gry, tryb i boty w jednym wierszu, ludzie, wojsko, budynki, złoto i dzień jako liczby z ikonkami, jedno duże „Wczytaj” (albo klik w kadr), a rzadsze działania — nadpisz, zmień nazwę, pobierz plik, wyślij do chmury, usuń — w menu „⋯”.'],
    en: ['A new look for save tiles: name and date on the game picture, mode and bots on one line, people, army, buildings, gold and day as numbers with icons, one big “Load” (or click the picture), and the rarer actions — overwrite, rename, download, upload to cloud, delete — in a “⋯” menu.'],
  },
  {
    v: '0.79.5', date: '2026-11-03',
    pl: ['Okienka z pytaniem: przycisk działania po lewej, „Anuluj” po prawej (jak w Windowsie i Steamie); przy usuwaniu i nadpisywaniu wyróżniony jest „Anuluj”, więc przypadkowy Enter niczego nie skasuje.'],
    en: ['Confirmation dialogs: the action button on the left, “Cancel” on the right (as in Windows and Steam); when deleting or overwriting, “Cancel” is focused, so an accidental Enter deletes nothing.'],
  },
  {
    v: '0.79.4', date: '2026-11-03',
    pl: ['Uwagi testerów: administrator może usunąć uwagę na zawsze (z pytaniem w okienku) — znika z listy i z dzwoneczków.'],
    en: ['Tester notes: the administrator can delete a note for good (with a confirmation dialog) — it disappears from the list and from the bells.'],
  },
  {
    v: '0.79.3', date: '2026-11-03',
    pl: [
      'Zapisy: wczytanie, nadpisanie, usunięcie i nowy zapis pytają w okienku (z miniaturą zapisu); przy nowym zapisie od razu wpisujesz nazwę — koniec z przypadkowymi zapisami po każdym kliknięciu.',
      '„Kontynuuj” w menu wczytuje najnowszy zapis z listy i znika, gdy nie ma żadnego zapisu — usunięta gra już nie wraca.',
      'Większe, czytelniejsze opisy na kafelkach zapisów.',
    ],
    en: [
      'Saves: loading, overwriting, deleting and a new save now ask in a dialog (with the save’s thumbnail); for a new save you type the name right there — no more accidental saves on every click.',
      '“Continue” in the menu loads the newest save from the list and disappears when there are no saves — a deleted game no longer comes back.',
      'Larger, more readable details on the save tiles.',
    ],
  },
  {
    v: '0.79.2', date: '2026-11-03',
    pl: ['Cisza przy wczytywaniu: bełkot skryby (dźwięk „gadającej osoby”) nie odzywa się już pod ekranem ładowania ani w menu — tylko w trakcie gry.'],
    en: ['Quiet while loading: the scribe’s babble (the “talking person” sound) no longer plays under the loading screen or in the menu — only during play.'],
  },
  {
    v: '0.79.1', date: '2026-11-02',
    pl: [
      'Uczciwe poziomy: każdy mecz ma swój numer i doświadczenie dostaje się za niego tylko raz — wczytanie zapisu tuż przed zwycięstwem i ponowna wygrana nie dają już drugi raz PD.',
      'Doświadczenie nie przepada: gdy mecz skończy się bez internetu albo przy wygasłym logowaniu, nagroda czeka i dochodzi przy następnym zalogowaniu.',
      'Statystyki meczu liczą się od pierwszej minuty: budynki osady startowej (i miasta w trybie deweloperskim) nie wchodzą już do „postawionych budynków”, a zburzenie własnego albo sojuszniczego budynku nie liczy się do „zburzonych”.',
    ],
    en: [
      'Fair levels: every match has its own number and earns experience only once — loading a save just before victory and winning again no longer gives XP twice.',
      'Experience is not lost: when a match ends without internet or with an expired sign-in, the reward waits and is added at your next sign-in.',
      'Match statistics start from the first minute: the starting settlement’s buildings (and the developer-mode town) no longer count as “buildings raised”, and destroying your own or an ally’s building does not count as “razed”.',
    ],
  },
  {
    v: '0.79.0', date: '2026-11-02',
    pl: [
      'Zapisy gry z prawdziwego zdarzenia: „Zapisz grę” i „Wczytaj grę” w menu (w grze z botami) — do 20 zapisów z własną nazwą, 3 autozapisy co 3 minuty i szybki zapis Ctrl+S.',
      'Każdy zapis to kafelek z miniaturą miejsca, w którym grałeś, datą, mapą, poziomem botów, dniem gry, ludźmi, wojskiem, budynkami i złotem; wczytaj, nadpisz, zmień nazwę, pobierz plik, usuń. Filtr i strony.',
      'Po zalogowaniu zapisy są też w chmurze Twojego konta — wyczyszczenie przeglądarki ich nie kasuje, a na innym komputerze wystarczy się zalogować. Bez konta zapisy zostają w przeglądarce; można je pobrać jako plik .p1save i wczytać gdzie indziej.',
      'Adres strony bez „#1v1/…” — grę wznawia zapis, a nie link.',
    ],
    en: [
      'Proper save games: “Save game” and “Load game” in the menu (in games against bots) — up to 20 named saves, 3 autosaves every 3 minutes and a quick save with Ctrl+S.',
      'Each save is a tile with a thumbnail of where you were playing, the date, map, bot level, game day, people, soldiers, buildings and gold; load, overwrite, rename, download a file, delete. Filter and pages.',
      'When signed in, saves also live in your account’s cloud — clearing the browser does not erase them, and on another computer you just sign in. Without an account they stay in the browser; you can download them as a .p1save file and load them elsewhere.',
      'The page address no longer carries “#1v1/…” — a save resumes the game, not a link.',
    ],
  },
  {
    v: '0.78.2', date: '2026-11-02',
    pl: ['Przygotowanie nowych zapisów gry (20 zapisów z miniaturami, autozapisy, folder na dysku) — sam panel wejdzie w kolejnej wersji.'],
    en: ['Groundwork for the new save system (20 saves with thumbnails, autosaves, a folder on disk) — the panel itself comes in the next version.'],
  },
  {
    v: '0.78.1', date: '2026-11-02',
    pl: [
      'Wiadomości jak w Messengerze: ikonka dymka na belce obok dzwoneczka z licznikiem nowych wiadomości, pod nią lista rozmów z wyszukiwarką, kropką „dostępny” i ostatnią wiadomością.',
      'Rozmowa otwiera się w okienku w prawym dolnym rogu — nad menu i nad grą, bez wychodzenia z tego, co robisz. Do trzech okienek naraz, każde można zwinąć do paska (Esc) i zamknąć; okrągłe dymki, Enter wysyła, pole rośnie z tekstem.',
    ],
    en: [
      'Messages like Messenger: a chat icon on the bar next to the bell with a count of new messages, and under it a list of conversations with a search box, an “online” dot and the last message.',
      'A conversation opens in a small window in the bottom-right corner — over the menu and over the game, without leaving what you are doing. Up to three windows at once, each can be minimised (Esc) or closed; round bubbles, Enter sends, the box grows with the text.',
    ],
  },
  {
    v: '0.78.0', date: '2026-11-02',
    pl: [
      'Wiadomości do znajomych: nowa zakładka „Wiadomości” w panelu znajomych z listą rozmów (ostatnia wiadomość, kiedy, ile nowych), czat z dymkami, dniami i godzinami, Enter wysyła, Shift+Enter — nowa linia. Wiadomość pojawia się u znajomego od razu.',
      'Nowa wiadomość: okienko w rogu ekranu z treścią i przyciskiem „Odpowiedz” (w menu i w grze z botami), licznik na belce przy „Znajomi”, na zakładce i na kafelku znajomego („Napisz · 2 nowe”).',
      'Profil każdego gracza z rankingu i z pokoju gry: klik w nick otwiera okno z herbem, poziomem, statystykami, odznakami i bitwami — bez wychodzenia z pokoju; stamtąd też „Dodaj do znajomych” albo „Napisz”.',
    ],
    en: [
      'Messages to friends: a new “Messages” tab in the friends panel with a list of conversations (last message, when, how many new), a chat with bubbles, days and times, Enter sends, Shift+Enter adds a line. The message reaches your friend at once.',
      'New message: a pop-up in the corner with the text and a “Reply” button (in the menu and in games against bots), a counter on the bar next to “Friends”, on the tab and on the friend’s tile (“Message · 2 new”).',
      'Every player’s profile from the ranking and the game room: clicking a nickname opens a window with their coat of arms, level, statistics, badges and battles — without leaving the room; from there you can also “Add friend” or “Message”.',
    ],
  },
  {
    v: '0.77.4', date: '2026-11-02',
    pl: ['Znajomi: „był” i „grał” widać także u graczy, którzy nie wchodzili od aktualizacji (z ostatniego logowania i ostatniego meczu).', 'Nowa uwaga testera trafia do dzwoneczka każdego administratora, także gdy dodał ją sam; „zrobione” dostaje autor zawsze.'],
    en: ['Friends: “seen” and “played” now also show for players who have not logged in since the update (from their last sign-in and last match).', 'A new tester note reaches every administrator’s bell, even when they wrote it themselves; the author always gets “done”.'],
  },
  {
    v: '0.77.3', date: '2026-11-02',
    pl: ['Zakładki okien (Mój ród, Znajomi, ustawienia) zwykłą, czytelną czcionką zamiast drobnych wersalików.', 'Spokojniejszy nagłówek menu: tytuł, podtytuł, opis w równych wierszach i mała plakietka o rozwoju gry.'],
    en: ['Window tabs (My house, Friends, settings) in the plain, readable text font instead of small capitals.', 'A calmer menu header: title, subtitle, an evenly wrapped description and a small badge about ongoing development.'],
  },
  {
    v: '0.77.2', date: '2026-11-02',
    pl: ['Kafelki znajomych wyrównane: nick to zwykły napis (bez ramki przycisku), herb po lewej na całą wysokość, opis i przyciski w jednej kolumnie.', 'Znajomi, dzwoneczek, aktywność i historia meczów działają już w bazie.'],
    en: ['Friend tiles are aligned: the nickname is plain text (no button frame), the coat of arms fills the left side, details and buttons sit in one column.', 'Friends, the bell, activity and match history now work in the database.'],
  },
  {
    v: '0.77.1', date: '2026-11-02',
    pl: [
      'Belka w prawym górnym rogu menu, jak w panelach aplikacji: wersja gry, przycisk „Znajomi” z liczbą znajomych w grze i dzwoneczek — powiadomienia rozwijają się w dół, nie uciekają już pod ekran.',
      'Edytor uwag testera jak w Wordzie: pogrubienie, kursywa, podkreślenie i kolory widać od razu w polu (bez znaczników). Do tego przekreślenie, nagłówek, cytat, listy, pięć kolorów, zakreślacz, czyszczenie formatowania, cofnij i ponów, licznik znaków i wysyłanie Ctrl+Enter.',
    ],
    en: [
      'A bar in the top-right corner of the menu, like in app dashboards: the game version, a “Friends” button with how many friends are online, and the bell — notifications open downwards instead of slipping off the screen.',
      'The tester notes editor works like a word processor: bold, italic, underline and colours show straight away in the box (no markers). Plus strikethrough, heading, quote, lists, five colours, a highlighter, clear formatting, undo and redo, a character counter and sending with Ctrl+Enter.',
    ],
  },
  {
    v: '0.77.0', date: '2026-11-02',
    pl: [
      'Nowy, duży panel znajomych: kafelki z dużym herbem, poziomem i tytułem, kolorowa kropka (dostępny, w grze, offline), gdzie jest i kiedy grał ostatnio, krótkie statystyki; filtr po nicku, „W grze / Offline”, sortowanie i strony.',
      'Profil gracza: duży herb, tytuł, poziom z paskiem PD, osiem statystyk (bitwy, zwycięstwa, skuteczność, wygrane przez sieć, wrogowie, zburzone i postawione budynki, czas w bitwach), wszystkie odznaki i ostatnie bitwy znajomego.',
      'Zakładka „Aktywność”: kto z Twoich znajomych wygrał albo przegrał bitwę (z rodzajem meczu, czasem, wrogami i PD) i kto wszedł na nowy poziom.',
      'Powiadomienia od razu w rogu ekranu — w menu i w grze z botami: znajomy wygrał, przegrał, nowy poziom, zaproszenie do znajomych (z przyciskiem „Przyjmij”), nowa uwaga testera.',
      'Wszystko reaguje od razu: „Dodaj do znajomych” zmienia się w „Wysłano ✓”, „Przyjmij” w „Znajomy ✓”; usuwanie ze znajomych z potwierdzeniem; wyniki wyszukiwania pojawiają się w trakcie pisania.',
    ],
    en: [
      'A new, large friends panel: tiles with a big coat of arms, level and rank, a coloured dot (online, in game, offline), where they are and when they last played, short statistics; filter by nickname, “Online / Offline”, sorting and pages.',
      'Player profile: big coat of arms, rank, level with an XP bar, eight statistics (battles, victories, win rate, online wins, foes, buildings razed and raised, time in battle), all badges and a friend’s recent battles.',
      'An “Activity” tab: which of your friends won or lost a battle (with the match type, time, foes and XP) and who reached a new level.',
      'Notifications appear in the corner at once — in the menu and in games against bots: a friend won, lost, reached a level, a friend request (with an “Accept” button), a new tester note.',
      'Everything reacts at once: “Add friend” turns into “Sent ✓”, “Accept” into “Friend ✓”; removing a friend asks for confirmation; search results appear as you type.',
    ],
  },
  {
    v: '0.76.2', date: '2026-11-02',
    pl: ['Znajomi: po wysłaniu zaproszenia z wyszukiwarki przycisk od razu zmienia się na „zaproszony” (wcześniej zostawał „Dodaj do znajomych”, choć zaproszenie poszło).'],
    en: ['Friends: after sending a request from the search, the button turns into “request sent” straight away (it used to stay “Add friend” although the request went out).'],
  },
  {
    v: '0.76.1', date: '2026-11-02',
    pl: [
      'Edytor uwag testera: pogrubienie, kursywa, podkreślenie, nagłówek, listy punktowane i numerowane, cztery kolory tekstu, nowe linie Enterem i skróty Ctrl+B/I/U — z podglądem na żywo. Administrator widzi uwagi z tym samym formatowaniem.',
    ],
    en: [
      'Tester notes editor: bold, italic, underline, heading, bulleted and numbered lists, four text colours, new lines with Enter and Ctrl+B/I/U shortcuts — with a live preview. The administrator sees notes with the same formatting.',
    ],
  },
  {
    v: '0.76.0', date: '2026-11-02',
    pl: [
      'Znajomi jak na Steamie: zaproszenia do znajomych z przyjmowaniem i odrzucaniem, szukanie graczy po nicku i lista ostatnio aktywnych, przy każdym znajomym — czy jest w grze, gdzie (menu, pokój, mecz) i kiedy był albo grał ostatnio.',
      'Zaproś znajomego do gry jednym przyciskiem (powstaje pokój, a zaproszenie czeka na niego także, gdy go nie ma) albo dołącz do pokoju, w którym czeka.',
      'Dzwoneczek powiadomień przy karcie konta w menu: zaproszenia do znajomych i do gry, przyjęte zaproszenia, nowe uwagi testerów (dla administratora, z przejściem prosto do uwagi) i zrobione uwagi (dla testera).',
      'Okno uwag testera szersze, z filtrami (stan, autor, szukanie w treści) i stronami.',
    ],
    en: [
      'Friends like on Steam: friend requests you accept or decline, finding players by nickname and a list of recently active ones, and for each friend — whether they are online, where (menu, room, match) and when they were last online or last played.',
      'Invite a friend to a game with one button (a room is created and the invitation waits for them even when they are away) or join the room where they are waiting.',
      'A notification bell next to the account card in the menu: friend requests and game invitations, accepted requests, new tester notes (for the administrator, jumping straight to the note) and finished notes (for the tester).',
      'The tester notes window is wider, with filters (state, author, text search) and pages.',
    ],
  },
  {
    v: '0.75.0', date: '2026-11-02',
    pl: [
      'Trzy kolory przycisków w całej grze: zielony — zapisz, zatwierdź, zacznij; czerwony — usuń, wyrzuć, rozbierz, poddaj się; cała reszta spokojna, neutralna.',
      'Rola testera: tester (i administrator) widzi w menu tryb deweloperski i może otworzyć panel dewelopera (F9) w każdej grze solo.',
      'Uwagi testera: w menu (także w trakcie gry, przez Esc) tester pisze, co poprawić albo dodać; administrator widzi je w „Moim rodzie”, oznacza zrobione i może odpisać, a tester widzi, co już zrobione.',
      'Panel administratora: lista wszystkich graczy z rolami i przyciskami „+/− admin” i „+/− tester” w każdym wierszu, podpowiedź, od którego poziomu jest który tytuł, i ostrzeżenie o niezapisanych zmianach. Twórcy gry nie da się odebrać praw.',
    ],
    en: [
      'Three button colours throughout the game: green — save, confirm, start; red — remove, kick, dismantle, surrender; everything else calm and neutral.',
      'Tester role: testers (and administrators) see developer mode in the menu and can open the developer panel (F9) in any solo game.',
      'Tester notes: in the menu (also mid-game, via Esc) a tester writes what to fix or add; the administrator sees them in “My house”, marks them done and can reply, and the tester sees what is done.',
      'Admin panel: a list of all players with their roles and “+/− admin” and “+/− tester” buttons on every row, a hint at which level each rank begins, and a warning about unsaved changes. The game’s creator cannot lose his rights.',
    ],
  },
  {
    v: '0.74.0', date: '2026-11-02',
    pl: [
      'Ponad trzy razy więcej odznak w „Moim rodzie” (29 zamiast 8): za zwycięstwa przez sieć i z najtrudniejszym botem, zburzone i postawione budynki, godziny w bitwach, setki wrogów i każdy tytuł aż do króla.',
      'Nowe odznaki liczą się także z meczów rozegranych wcześniej.',
      'Administratorzy kont: w „Moim rodzie” zakładka „Administracja” — wyszukiwanie graczy, dodawanie i odbieranie poziomów, poprawianie liczników, zmiana nicku, nadawanie praw. Każdą zmianę sprawdza serwer i zapisuje w dzienniku.',
    ],
    en: [
      'More than three times as many badges in “My house” (29 instead of 8): for online victories and wins over the hardest bot, buildings razed and raised, hours in battle, hundreds of foes and every rank up to king.',
      'The new badges also count matches you played before.',
      'Account administrators: an “Administration” tab in “My house” — find players, grant and take away levels, correct counters, rename, grant rights. The server checks every change and writes it to a log.',
    ],
  },
  {
    v: '0.73.7', date: '2026-11-02',
    pl: [
      'Krawędzie murów i wież nie migają już ciemnym paskiem: części kamiennych ozdób schowane w murze (narożne ciosy, gzymsy) nie przebijają przez lico, gdy patrzysz na ścianę z boku.',
      'Głębia kamienia liczona dokładniej pod ostrym kątem — wzór nie pełznie po murze przy obracaniu kamery.',
    ],
    en: [
      'Wall and tower edges no longer flicker with a dark stripe: the parts of stone trim hidden inside the wall (corner quoins, cornices) no longer poke through the face when you look at it from the side.',
      'Stone depth is computed more finely at steep angles — the pattern no longer crawls across the wall as the camera turns.',
    ],
  },
  {
    v: '0.73.6', date: '2026-11-02',
    pl: [
      'Nowa strzecha na dachach: warstwy pęczków słomy ze strzępiastym, ocienionym brzegiem zamiast płaskiej, jednolitej słomy.',
      'Duże i wielkie wieże kamienne: ściany narożnych wykuszy mają teraz grubość — od strony pomostu nic już nie prześwituje.',
      'Stodoła wygląda tak samo jak w podglądzie budowy: nie zdejmuje strzechy, gdy pracują w niej ludzie (bez gołych ścian i bloków na klepisku).',
    ],
    en: [
      'New roof thatch: layered bundles of straw with a ragged, shaded edge instead of flat, uniform straw.',
      'Large and great stone towers: the corner turret walls now have thickness — nothing shows through from the walkway.',
      'The barn looks the same as in the build preview: it keeps its thatch while people work inside (no bare walls and blocks on the floor).',
    ],
  },
  {
    v: '0.73.5', date: '2026-11-02',
    pl: [
      'Nowy, miękki dźwięk klikania przycisków — ciche, drewniane „tuk” zamiast ostrego trzasku.',
      'Mur kamienny nie miga już pasem pod blankami: lico muru i chodnik na koronie nie nachodzą na siebie.',
      'Karta konta w menu ma równy odstęp z lewej i z prawej.',
    ],
    en: [
      'A new, soft button click — a quiet wooden “tock” instead of a sharp snap.',
      'The stone wall no longer flickers in a band under the battlements: the wall face and the walkway on top no longer overlap.',
      'The account card in the menu has an even margin left and right.',
    ],
  },
  {
    v: '0.73.4', date: '2026-11-02',
    pl: [
      'Okna menu (Ustawienia, Jak grać, Co nowego, Mój ród) zajmują całą prawą część ekranu, od góry do dołu — więcej się mieści i jest czytelniej.',
      'Pasek grup wojska (1–0) przeniesiony do prawego dolnego rogu, tuż na lewo od minimapy; kronika ma lewy dolny róg dla siebie.',
    ],
    en: [
      'Menu windows (Settings, How to play, What’s new, My house) fill the whole right side of the screen, top to bottom — more fits and it reads better.',
      'The army group bar (1–0) has moved to the bottom right, just left of the minimap; the chronicle has the bottom left to itself.',
    ],
  },
  {
    v: '0.73.3', date: '2026-11-02',
    pl: [
      'Ekran wczytywania spokojniejszy: pod herbem został sam tytuł, a na dole tylko rada, procent, pasek i jedna linijka, co się teraz wczytuje.',
    ],
    en: [
      'A calmer loading screen: only the title remains under the arms, and at the bottom just the tip, the percentage, the bar and a single line on what is loading now.',
    ],
  },
  {
    v: '0.73.2', date: '2026-11-02',
    pl: [
      'Epickie chmury na pejzażu: wielkie, kłębiaste cumulusy po bokach i mniejsze w głębi, z jasnym wierzchem i złoto-różowym spodem od zachodu, a nisko nad górami pomarańczowe smugi.',
      'Bardziej epicki napis „Project-1” na ekranie wczytywania: grubsze, fazowane złoto z ciemnym obrysem i ciepłą poświatą.',
      'Nowa karta konta w menu: płyta jak okna gry w złotej ramie z rombami, herb w złotym kręgu, poziom w złotym kamieniu i pasek doświadczenia jak w WoW.',
    ],
    en: [
      'Epic clouds in the landscape: great billowing cumulus at the sides and smaller ones beyond, bright on top and gold-pink underneath from the sunset, with orange streaks low over the mountains.',
      'A more epic “Project-1” title on the loading screen: thicker, bevelled gold with a dark outline and a warm glow.',
      'A new account card in the menu: a plate like the game windows in a gold frame with diamonds, the arms in a gold ring, the level in a gold stone and a WoW-style experience bar.',
    ],
  },
  {
    v: '0.73.1', date: '2026-11-02',
    pl: [
      'Zamek na pejzażu stoi naturalnie: mniejszy i dalej, na poszarpanej skale, z murem schodzącym po zboczu, wieżami wrośniętymi w grzbiet i rzędami kamieni na ścianach. Do tego mgła w dolinie, mocniejsze słońce i skała na pierwszym planie.',
      'Dolny pasek ekranu wczytywania wygląda jak okna w grze: ciepły brąz z fakturą, złota listwa i złote napisy.',
      'Lewy dół menu wyrównany (wersja i ramka konta w tej samej kolumnie co lista), a przycisk czyszczenia pamięci pojawia się tylko wtedy, gdy na serwerze jest nowsza wersja gry.',
    ],
    en: [
      'The castle in the landscape now sits naturally: smaller and further off, on a jagged crag, with the wall running down the slope, towers rooted in the ridge and courses of stone on the walls. Add mist in the valley, a stronger sun and a rock in the foreground.',
      'The bottom bar of the loading screen looks like the in-game windows: warm textured brown, a gold rail and gold lettering.',
      'The lower left of the menu is aligned (version and account box in the same column as the list), and the clear-cache button only appears when a newer version of the game is on the server.',
    ],
  },
  {
    v: '0.73.0', date: '2026-11-02',
    pl: [
      'Pejzaż na ekranie wczytywania i w menu znów ma niebo, góry i dolinę — wcześniej w części przeglądarek zostawał sam zamek na czarnym tle.',
      'Mury już nie mrugają i nie „pływają”: głębia kamienia jest łagodniejsza i gaśnie, gdy patrzysz na ścianę pod ostrym kątem.',
      'Głębię mają też strzechy, dachy i ściany z desek, bruk i cegła — nie tylko kamień zamku i łupek.',
    ],
    en: [
      'The landscape on the loading screen and in the menu has its sky, mountains and valley back — in some browsers only the castle remained, on black.',
      'Walls no longer flicker or “swim”: the stone depth is gentler and fades when you look at a wall at a steep angle.',
      'Thatch, plank roofs and walls, cobbles and brick have depth too — not just the castle stone and slate.',
    ],
  },
  {
    v: '0.72.9', date: '2026-11-02',
    pl: [
      'Ramka konta w menu („Gość · Zaloguj się · Załóż konto”) znów prosta: odnośniki nie dostają już ramki przycisku i stoją w jednej linii.',
    ],
    en: [
      'The account box in the menu (“Guest · Sign in · Create account”) is straight again: the links no longer get a button frame and sit on one line.',
    ],
  },
  {
    v: '0.72.8', date: '2026-11-02',
    pl: [
      'Menu i logowanie jaśniejsze: lewa kolumna i okna menu z ciepłego, średniego brązu z fakturą zamiast prawie czerni, jaśniejsze pola do wpisywania, a przyciski jak w grze — pomarańczowy główny i przygaszony „Wróć”.',
      'Wersje 0.72.4–0.72.7 nie trafiły wcześniej na stronę (zatrzymał je test) — teraz wchodzą wszystkie naraz: duchy częstokołu, głębia kamienia, nowe okno budynku, jasny pejzaż.',
    ],
    en: [
      'A brighter menu and sign-in: the left column and menu windows in a warm mid brown with texture instead of near-black, lighter input fields, and buttons as in the game — an orange main one and a muted “Back”.',
      'Versions 0.72.4–0.72.7 had not reached the site (a test held them back) — they all arrive now: palisade previews, stone depth, the new building window, the bright landscape.',
    ],
  },
  {
    v: '0.72.7', date: '2026-11-02',
    pl: [
      'Nowy, jasny pejzaż na ekranie wczytywania i w menu: złota godzina, niebo od błękitu do złota, podświetlone chmury, pasma ośnieżonych gór w mgiełce, dolina z rzeką, zamek na skale w słońcu, smugi światła i ptaki.',
    ],
    en: [
      'A new, bright landscape on the loading screen and in the menu: golden hour, a sky from blue to gold, sunlit clouds, ranges of snowy mountains in the haze, a valley with a river, the castle on its crag in the sun, shafts of light and birds.',
    ],
  },
  {
    v: '0.72.6', date: '2026-11-02',
    pl: [
      'Okno budynku, wojska i człowieka uporządkowane jak w WoW: ciemny pasek z tytułem, przyciskiem „i” (opis) i krzyżykiem do zamykania; każda część (stan, towary, ludzie, produkcja) w osobnym polu z jednym złotym tytułem; opis budynku schowany pod „i”, a na dole tylko przyciski działań.',
    ],
    en: [
      'The building, army and person window is tidied up WoW-style: a dark title bar with an “i” (description) button and a cross to close; each part (state, goods, people, production) in its own box with a single gold heading; the building description tucked under “i”, and only the action buttons along the bottom.',
    ],
  },
  {
    v: '0.72.5', date: '2026-11-02',
    pl: [
      'Kamień zamku i wież ma prawdziwą głębię: fugi są wpuszczone, a wypukłe lica ciosów zasłaniają je pod kątem jak w prawdziwym murze. Ciosy są przy tym większe, a łupek na dachach dostał tę samą głębię.',
    ],
    en: [
      'The stone of the keep and towers has real depth now: the joints are sunk, and the bulging faces of the blocks hide them at an angle as in a real wall. The blocks are also larger, and the roof slate has gained the same depth.',
    ],
  },
  {
    v: '0.72.4', date: '2026-11-02',
    pl: [
      'Podgląd zleconych budów obejmuje też częstokół: przy otwartym budowaniu niepostawione bale widać jako przezroczyste, pełnej wysokości.',
    ],
    en: [
      'The preview of ordered works now covers the palisade too: while the build list is open, logs not yet raised show as see-through, at full height.',
    ],
  },
  {
    v: '0.72.3', date: '2026-11-02',
    pl: [
      'Karty budynków w budowaniu są gładkie, bez tekstury: ciemna karta, większy i wyraźniejszy obrazek budynku na jaśniejszym tle, złota nazwa. Wybrana karta świeci na złoto, a te, których nie postawisz, są delikatnie czerwone.',
    ],
    en: [
      'Building cards in the build list are plain, with no texture: a dark card, a larger and sharper picture of the building on a lighter backdrop, and a gold name. The chosen card glows gold, and those you cannot raise are faintly red.',
    ],
  },
  {
    v: '0.72.2', date: '2026-11-02',
    pl: [
      'Okno budynku lub wojska nie wchodzi już na kronikę: przy otwartym oknie wiadomości kroniki się zwijają (zostaje przycisk „Kronika”), a okno kończy się nad nim.',
    ],
    en: [
      'The building or army window no longer runs into the chronicle: while it is open the chronicle messages fold away (the “Chronicle” button stays), and the window ends above it.',
    ],
  },
  {
    v: '0.72.1', date: '2026-11-02',
    pl: [
      'Okno budynku i wojska stoi teraz w lewym górnym rogu i nie wchodzi na plan na start. Można je przeciągnąć za tytuł w dowolne miejsce — gra zapamięta je po odświeżeniu.',
      'Kronika stoi nad paskiem grup wojska i nie zasłania już jego cyfr.',
      'Wszystkie przyciski (Rozwiń, Zwiń, Zamknij, rozkazy wojska i inne) mają jeden wygląd: brązowa oprawa i płytka, a wciśnięty świeci na pomarańczowo.',
      'Ekran wczytywania wrócił do rysowanego pejzażu (zdjęcie z gry się nie sprawdziło).',
    ],
    en: [
      'The building and army window now sits in the top left corner and no longer covers the opening plan. You can drag it by its title anywhere — the game remembers the spot after a refresh.',
      'The chronicle sits above the army group bar and no longer hides its numbers.',
      'Every button (Expand, Collapse, Close, army orders and the rest) shares one look: a bronze frame and plate, glowing orange when pressed.',
      'The loading screen is back to the painted landscape (the in-game picture did not work out).',
    ],
  },
  {
    v: '0.72.0', date: '2026-11-02',
    pl: [
      'Nowy kamień murów zamku: nieregularne ciosy różnej wielkości z wypukłym, chropowatym licem, każdy innej barwy, i głębokie, ciemne fugi — mur ma wreszcie rzeźbę, a nie płaski, jasny wzór.',
      'Nowy łupek na dachach wież: rzędy zachodzących na siebie płytek z nierównym dolnym brzegiem i cieniem pod spodem, zamiast rozmytych łusek.',
    ],
    en: [
      'New stone for the castle walls: irregular blocks of different sizes with a bulging, rough face, each a slightly different shade, set with deep dark joints — at last the wall has real relief instead of a flat, pale pattern.',
      'New slate on the tower roofs: rows of overlapping tiles with uneven lower edges and a shadow beneath, instead of blurry scales.',
    ],
  },
  {
    v: '0.71.7', date: '2026-11-02',
    pl: [
      'Nowy ekran wczytywania: zamiast rysowanego pejzażu prawdziwy obraz twierdzy z gry o zachodzie słońca, z górami i lasem w tle, podkręcony filtrami.',
    ],
    en: [
      'A new loading screen: instead of a drawn landscape, a real picture of the keep from the game at sunset, with mountains and forest behind, enhanced with filters.',
    ],
  },
  {
    v: '0.71.6', date: '2026-11-02',
    pl: [
      'Kamera do ujęć z trybu testowego (przygotowanie nowego ekranu wczytywania z obrazem zamku z gry).',
    ],
    en: [
      'A camera for set-up shots in test mode (groundwork for a new loading screen showing the castle from the game).',
    ],
  },
  {
    v: '0.71.5', date: '2026-11-02',
    pl: [
      'Nowe przyciski: w ciemnej, brązowej oprawie, ze świecącą płytką w środku — pomarańczowe dla głównych działań, przygaszone dla zwykłych, zielone dla sprzedaży na rynku. Po najechaniu rozjarzają się.',
    ],
    en: [
      'New buttons: set in a dark bronze frame with a glowing plate inside — orange for the main actions, muted for the ordinary ones, green for selling at the market. They flare up when you point at them.',
    ],
  },
  {
    v: '0.71.4', date: '2026-11-02',
    pl: [
      'Okna budynków i wojska stoją teraz w prawym górnym rogu, a kronika w lewym dolnym, nad dolną belką. Przy otwartym budowaniu kronika się chowa.',
      'Pauza znów ma ciemny panel po lewej, a okna nie pokazują już poziomego suwaka.',
      'Kamienna droga ma bok: nie wisi nad trawą jak płyta, tylko schodzi kamieniem do ziemi.',
      'Nowi chłopi idący przez dziedziniec zamku nie brną już po pas w bruku.',
    ],
    en: [
      'Building and army windows now sit in the top right corner, and the chronicle in the bottom left, above the bottom bar. While you build, the chronicle steps aside.',
      'The pause screen has its dark left panel again, and windows no longer show a sideways scroll bar.',
      'The stone road has a side: it no longer hovers over the grass like a slab, but runs down into the ground in stone.',
      'Newcomers crossing the castle courtyard no longer wade waist-deep through the cobbles.',
    ],
  },
  {
    v: '0.71.3', date: '2026-11-02',
    pl: [
      'Interfejs z teksturami jak w World of Warcraft: okna z ciemnego, ciepłego kamienia w złotej ramie z rombami w rogach, dolna belka i kategorie budowy z drewna, sloty zapasów i przyciski z kutego metalu.',
      'Napisy czytelniejsze: nazwy budynków i kategorii większe, złote, pełnymi literami, z ostrym cieniem.',
      'Ekran wczytywania wrócił do dawnego wyglądu.',
    ],
    en: [
      'A textured interface as in World of Warcraft: windows of dark, warm stone in a gold frame with diamonds at the corners, the bottom bar and build categories of wood, stock slots and buttons of wrought metal.',
      'Clearer lettering: building and category names are larger, gold, in full letters with a crisp shadow.',
      'The loading screen is back to its former look.',
    ],
  },
  {
    v: '0.71.2', date: '2026-11-02',
    pl: [
      'W budowaniu czerwone są już tylko budynki, których teraz nie postawisz (brakuje surowców albo wymaganego budynku) — i to delikatnie. Reszta kafelków i kategorie są neutralne.',
    ],
    en: [
      'In the build list only the buildings you cannot raise just now (short of materials or a required building) are red — and only faintly. The other tiles and the categories are neutral.',
    ],
  },
  {
    v: '0.71.1', date: '2026-11-02',
    pl: [
      'Okna jaśniejsze i pełne, bez prześwitywania: ciepły, ciemny brąz z metalową ramą, jak w World of Warcraft. Kafelki budynków, kategorie budowy i przyciski to szaro-brązowe gniazda, wybrane świecą na złoto — bez jaskrawej czerwieni.',
      'Okna menu (Ustawienia, Jak grać, Co nowego, Nowa gra) mają ten sam wygląd co okna w grze.',
      'Ekran wczytywania jak w WoW: u góry i u dołu pasy jasnego pergaminu, pośrodku obraz; rada i pasek postępu na dolnym pasie.',
    ],
    en: [
      'Brighter, solid windows with no see-through: warm dark brown with a metal frame, as in World of Warcraft. Building tiles, build categories and buttons are grey-brown slots, and chosen ones glow gold — no more glaring red.',
      'The menu windows (Settings, How to play, What’s new, New game) share the look of the in-game windows.',
      'A WoW-style loading screen: bands of light parchment above and below, the picture in between; the tip and progress bar sit on the lower band.',
    ],
  },
  {
    v: '0.71.0', date: '2026-11-02',
    pl: [
      'Nowy wygląd okien w grze, lżejszy, w duchu World of Warcraft: prawie czarne, lekko przejrzyste tło, cienka metalowa rama, złotożółte tytuły, biały tekst i mniejsze, gęstsze pismo.',
      'Przyciski w oknach są czerwone z żółtym napisem, podpowiedzi granatowe ze srebrną ramką, a dolny pasek i zapasy wyglądają jak sloty paska akcji. Wybrany budynek świeci na złoto.',
    ],
    en: [
      'A new, lighter look for the in-game windows, in the spirit of World of Warcraft: a near-black, slightly see-through background, a thin metal frame, gold-yellow titles, white text and smaller, tighter lettering.',
      'Window buttons are red with yellow lettering, tooltips navy with a silver edge, and the bottom bar and stocks look like action-bar slots. The chosen building glows gold.',
    ],
  },
  {
    v: '0.70.12', date: '2026-11-02',
    pl: [
      'Menu główne czytelniejsze: lewa kolumna to pełny, ciemny panel, więc napisy nie zlewają się już z pejzażem. Tytuł nie dochodzi do krawędzi, herb, lista, wersja i konto mają jeden równy odstęp od lewej, a pozycje menu są mniejsze i gęstsze, jak w grach MMO.',
    ],
    en: [
      'A clearer main menu: the left column is now a solid dark panel, so the lettering no longer melts into the landscape. The title keeps clear of the edge, the crest, list, version and account share one even left margin, and the menu entries are smaller and tighter, as in MMO games.',
    ],
  },
  {
    v: '0.70.11', date: '2026-11-02',
    pl: [
      'Liście grzybieni na stawach jesienią już nie robią się rudo-pomarańczowymi kwadratami: płowieją miękko, w łatach, jak trawa na brzegu.',
    ],
    en: [
      'Water-lily leaves on the ponds no longer turn into rust and orange squares in autumn: they fade softly, in patches, like the grass on the bank.',
    ],
  },
  {
    v: '0.70.10', date: '2026-11-02',
    pl: [
      'Podgląd zleconego muru kamiennego stoi już tak jak prawdziwy mur: pełna, przezroczysta bryła na swoim polu, łącząca się z sąsiednimi odcinkami (wcześniej odcinki wisiały krzywo obok).',
    ],
    en: [
      'The preview of an ordered stone wall now stands just like the real wall: a full see-through block on its own tile, joining the neighbouring stretches (before, the pieces hung askew beside it).',
    ],
  },
  {
    v: '0.70.9', date: '2026-11-02',
    pl: [
      'Chłop z kilofem pada szybciej: 30 zdrowia (było 40, na chwilę 50). To tania, słaba jednostka — liczy się masa.',
    ],
    en: [
      'The levied peasant falls more quickly: 30 health (was 40, briefly 50). He is a cheap, weak soldier — it is numbers that count.',
    ],
  },
  {
    v: '0.70.8', date: '2026-11-02',
    pl: [
      'Skład nie krzyczy już „Pełno”, gdy jest w nim miejsce: warsztat, którego robotnik poszedł spać, przestaje czekać na miejsce od razu, a nie dopiero rano. Towar spod drzwi okno pokazuje spokojnie jako „zaraz trafi do środka”.',
    ],
    en: [
      'The stockpile no longer cries “Full” when there is room in it: a workshop whose worker has gone to bed stops waiting for room at once, not only in the morning. Goods at the door are shown calmly as “on their way inside”.',
    ],
  },
  {
    v: '0.70.7', date: '2026-11-02',
    pl: [
      'Podgląd zleconych budów: gdy masz otwartą listę budowy albo stawiasz budynek, każdy zlecony, jeszcze niezbudowany mur, wieża czy budynek pokazuje się jako półprzezroczysty gotowy model. Łatwo dociągnąć do nich następne odcinki. Po zamknięciu budowy podgląd znika.',
      'Chłop z kilofem jest odrobinę wytrzymalszy: 50 zdrowia zamiast 40, więc strażnicy nie kładą go tak szybko.',
    ],
    en: [
      'A preview of ordered works: while the build list is open or you are placing a building, every ordered but unfinished wall, tower or building shows as a see-through finished model, so it is easy to carry the next stretch on from it. Close the build list and the preview is gone.',
      'The levied peasant is a touch hardier: 50 health instead of 40, so guards do not cut him down quite so quickly.',
    ],
  },
  {
    v: '0.70.6', date: '2026-11-02',
    pl: [
      'Wczytanie zapisanej gry nie bije już na alarm bez powodu: gra myliła budynki z poprzedniej rozgrywki z twoimi i brała to za atak.',
    ],
    en: [
      'Loading a saved game no longer sounds the alarm for no reason: the game mistook buildings from the previous match for yours and took it for an attack.',
    ],
  },
  {
    v: '0.70.5', date: '2026-11-02',
    pl: [
      'Wolno mieć tylko jedną kopalnię. Drugiej nie postawisz, dopóki pierwsza stoi (albo się buduje); gdy wróg ją zburzy, możesz od razu postawić nową. Boty i sojusznicy mają tę samą zasadę.',
    ],
    en: [
      'Only one mine is allowed. You cannot sink a second while the first stands (or is being built); should the enemy destroy it, you may raise a new one at once. Bots and allies follow the same rule.',
    ],
  },
  {
    v: '0.70.4', date: '2026-11-02',
    pl: [
      'Kopalnia z barakiem górników daje mniej kamienia i żelaza na kurs (6 kamienia, 5 żelaza zamiast 10 i 8): górnicy nie chodzą wtedy do wioski, więc kursów jest dużo więcej i urobku było aż za dużo. Ruda bez zmian.',
    ],
    en: [
      'A mine with a miners’ barracks now brings less stone and iron per trip (6 stone, 5 iron instead of 10 and 8): the miners no longer walk to the village, so they make far more trips and the haul was simply too great. Ore is unchanged.',
    ],
  },
  {
    v: '0.70.3', date: '2026-11-02',
    pl: [
      'Kopalnia daje dwa razy więcej: górnik wynosi naraz 10 kamienia (było 5) albo 8 żelaza (było 4). Ruda wypada jak dotąd. Bez baraku górników to ok. 160 kamienia i 65 żelaza na 20 minut, z barakiem ponad dwa razy tyle — warto dostawić skład.',
      'Boty i sojusznicy kopią na tych samych zasadach.',
    ],
    en: [
      'The mine yields twice as much: a miner brings out 10 stone at a time (was 5) or 8 iron (was 4). Ore turns up as before. Without a miners’ barracks that is about 160 stone and 65 iron every 20 minutes, with one more than twice that — worth building another stockpile.',
      'Bots and allies dig by the very same rules.',
    ],
  },
  {
    v: '0.70.2', date: '2026-11-02',
    pl: [
      'Więcej jedzenia: sadownik zbiera naraz 30 jabłek (było 18), a świniopas odnosi 6 porcji mięsa (było 3). Sady leżące dalej od spichlerza wreszcie wyżywią wioskę — wcześniej większość czasu schodziła na chodzenie.',
      'Większe magazyny: spichlerz mieści 600 jedzenia (było 400), skład 300 towarów (było 200), a stodoła 400 (było 250) — kamień i żelazo z kopalni nie zapychają ich już po kilku minutach.',
    ],
    en: [
      'More food: the orchard keeper now picks 30 apples at a time (was 18), and the swineherd brings in 6 portions of meat (was 3). Orchards set further from the granary can at last feed the village — before, most of the day went on walking.',
      'Bigger stores: a granary holds 600 food (was 400), a stockpile 300 goods (was 200), and the barn 400 (was 250) — stone and iron from the mine no longer choke them within minutes.',
    ],
  },
  {
    v: '0.70.1', date: '2026-11-02',
    pl: [
      'Kamienne wieże, baszty i kamienna brama kosztują teraz sam kamień — bez drewna (i bez żelaza przy wielkiej baszcie), jak kamienny mur.',
    ],
    en: [
      'Stone towers, keeps and the stone gate now cost stone alone — no timber (and no iron for the great tower), just like the stone wall.',
    ],
  },
  {
    v: '0.70.0', date: '2026-11-02',
    pl: [
      'Nowa jednostka w koszarach: chłop z kilofem. Kosztuje tylko 5 rudy (bez broni ze zbrojowni), bije kilofem, jest słaby i bez tarczy, ale można go wystawić od ręki.',
      'Bot też sięga po chłopów z kilofami, gdy brakuje mu włóczni, łuków i mieczy, a ma rudę.',
    ],
    en: [
      'A new unit in the barracks: the levied peasant with a pick. He costs only 5 ore (no arms from the armoury), fights with his pick, and is weak and shieldless, but can be raised on the spot.',
      'Bots also raise levied peasants when they lack spears, bows and swords but have ore.',
    ],
  },
  {
    v: '0.69.11', date: '2026-11-02',
    pl: [
      'Górnicy w baraku śpią na pryczach, a nie na podłodze między nimi.',
      'Mgła w dolinach znika nad wyrównanym placem pod budynek — bez ostrej, kanciastej krawędzi, przez którą przebijała ziemia.',
      'Kopalnia daje mniej kamienia i żelaza (z kursu 5 kamienia albo 4 żelaza), a załoga rośnie wolniej: górnik na każde 5 osób, najwyżej 6. Ruda bez zmian.',
      'Drzewko leśniczego dorasta w jeden dzień gry zamiast dwóch — drwale szybciej dostają je pod topór.',
      'Pierwszy rynek jest za darmo; każdy kolejny kosztuje 60 drewna i 20 kamienia.',
    ],
    en: [
      'Miners in the barracks now sleep on their bunks, not on the floor between them.',
      'Valley mist now clears over levelled building plots — no more hard, jagged edge with the ground poking through.',
      'The mine yields less stone and iron (5 stone or 4 iron per run), and its crew grows slower: one miner per 5 folk, at most 6. Ore unchanged.',
      'A forester’s sapling now grows in one game day instead of two — the woodcutters get to it sooner.',
      'Your first market is free; each further one costs 60 timber and 20 stone.',
    ],
  },
  {
    v: '0.69.10', date: '2026-11-02',
    pl: [
      'Licznik „jedzenie razem” na dolnym pasku liczy całe jedzenie, także mięso (wcześniej tylko jabłka, chleb i ryby).',
      'Pasek ostrzeżeń „wróg ma teraz…” liczy tylko jego wojsko — bez strażników miejskich, strażników kopalni i poległych.',
      'Ognisko dymi cienką, przejrzystą smużką zamiast wielkiej białej kuli.',
      'Po deszczu kałuże stoją nie tylko na drogach gruntowych, ale i na płaskich kawałkach łąki (rzadziej i mniejsze).',
    ],
    en: [
      'The “total food” counter on the bottom bar now counts all food, meat included (before, only apples, bread and fish).',
      'The warning bar’s “the enemy now has…” counts only his fighting men — not town guards, mine guards or the fallen.',
      'A campfire now gives off a thin, light wisp of smoke instead of a great white ball.',
      'After rain, puddles lie not only on dirt roads but also on flat patches of meadow (fewer and smaller).',
    ],
  },
  {
    v: '0.69.9', date: '2026-10-30',
    pl: [
      'Przy popularności poniżej 50 ludzie odchodzą stopniowo — tym szybciej, im niższa popularność. Dawniej po jednym słabszym miesiącu osada z 26 ludźmi pustoszała w minutę.',
      'Bot pilnuje jedzenia: gdy zapas topnieje, stawia kolejne sady, przy resztkach przechodzi na pół racji, a z rynkiem dokupuje chleb.',
    ],
    en: [
      'With popularity below 50, folk now drift away gradually — the lower it falls, the faster they go. Before, a single lean month could empty a settlement of 26 in a minute.',
      'Bots watch their food: when stores dwindle they plant more orchards, go on half rations when nearly out, and buy bread at the market if they have one.',
    ],
  },
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

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

import type { ChangeEntry } from './changelogTypes';
export const CHANGES_B: ChangeEntry[] = [
  {
    v: '0.64.1', date: '2026-10-28',
    pl: [
      'Na pomost wieży wchodzi się jak na mur: drabiną, drzwiami albo z przyległego muru kamiennego — tylko swoi.',
      'Prawy klik na wieży wysyła tam dowolnych żołnierzy: czatownia mieści 1, strażnica i baszta 4, duża baszta 9, wielka 16.',
      'Z pomostu strzela się jak z muru (+3 pola) plus premia wieży, a wręcz z ziemi nikt takiego żołnierza nie dosięgnie.',
      'Z wieży schodzi się zwykłym rozkazem marszu albo przyciskiem „Zejdźcie z wieży”.',
    ],
    en: [
      'Tower platforms now work like wall walks: climb up by ladder, through the door or from an adjoining stone wall — friends only.',
      'Right-click a tower to send any soldiers up: a lookout holds 1, a watchtower or turret 4, a large turret 9, a great one 16.',
      'Men on a platform shoot as from a wall (+3 tiles) plus the tower’s bonus, and no melee fighter on the ground can reach them.',
      'Bring them down with an ordinary move order or the “Come down from the tower” button.',
    ],
  },
  {
    v: '0.64.0', date: '2026-10-28',
    pl: [
      'Gotowy budynek można przenieść w inne miejsce przyciskiem „Przenieś” w jego oknie.',
      'Robotnicy rozbierają go na stos przy starej działce i ładunek po ładunku stawiają na nowym miejscu.',
      'Płacisz tylko rudą za robotę: 10 + 15% kosztu budynku. Twierdzy, murów, wież, magazynów i kopalni rudy nie przeniesiesz.',
    ],
    en: [
      'Finished buildings can now be moved with the “Move” button in their window.',
      'Workers pull it down into a pile on the old plot and carry it, load by load, to the new site to raise it again.',
      'You pay only ore for the labour: 10 + 15% of the building’s cost. The keep, walls, towers, stores and ore mines cannot be moved.',
    ],
  },
  {
    v: '0.63.8', date: '2026-10-28',
    pl: [
      'Drwal wlokący pień zostawia w śniegu szeroką bruzdę, a wozy z surowcami — dwie koleiny.',
      'Bruzdy i koleiny bledną jak ślady butów, szybciej w zamieci.',
    ],
    en: [
      'A woodcutter dragging a trunk leaves a broad furrow in the snow, and supply carts leave twin wheel ruts.',
      'Furrows and ruts fade just like footprints, and quicker in a blizzard.',
    ],
  },
  {
    v: '0.63.7', date: '2026-10-28',
    pl: [
      'Okno „Mój ród” wygląda jak księga: duża karta postaci z herbem, poziomem i paskiem doświadczenia, obok zakładki ze statystykami.',
      'Okno konta też w dwóch kolumnach, z dużymi liczbami bilansu i czytelnymi formularzami nicku i hasła.',
      'Karta postaci na dole menu jest większa i wyraźniejsza na każdym ekranie.',
    ],
    en: [
      '“My House” now reads like a ledger: a large character card with arms, level and experience bar, with tabbed statistics beside it.',
      'The account window is laid out in two columns, with big record figures and clear name and password forms.',
      'The character card at the foot of the menu is larger and easier to read on any screen.',
    ],
  },
  {
    v: '0.63.6', date: '2026-10-28',
    pl: [
      'Okna „Nowa gra” i „Gra przez sieć” dostały ten sam ciemno-złoty styl co nowe menu.',
      'Z „Jak grać” zniknęła encyklopedia modeli — jest osobny podgląd modeli w Ustawieniach.',
      'W spacerze z pierwszej osoby też zostawiasz ślady butów na śniegu.',
    ],
    en: [
      'The New Game and Multiplayer windows now share the dark-and-gold look of the new menu.',
      'The model encyclopaedia has left “How to Play” — there is a separate model viewer under Settings.',
      'Walking in first person now leaves your own footprints in the snow too.',
    ],
  },
  {
    v: '0.63.5', date: '2026-10-28',
    pl: [
      'Ustawienia, „Jak grać” i „Mój ród” w stylu nowego menu: półprzezroczyste okna nad pejzażem, spis rozdziałów z rombami.',
      'Poprawka: tekst w „Jak grać” i Ustawieniach nie urywa się już w połowie okna.',
    ],
    en: [
      'Settings, How to Play and My House match the new menu: translucent panels over the landscape and a diamond-marked contents list.',
      'Fixed: text in How to Play and Settings no longer stops halfway down the window.',
    ],
  },
  {
    v: '0.63.4', date: '2026-10-28',
    pl: [
      'Każdy idący zostawia na śniegu własne ślady — trzech obok siebie nie zlewa się już w jedną ścieżkę.',
      'Ślady nie wiszą w powietrzu i spokojnie bledną po ok. 25 s, zamiast znikać od razu.',
    ],
    en: [
      'Everyone now leaves their own tracks in the snow — three men walking abreast no longer share one trail.',
      'Footprints no longer float above the ground and fade gently after about 25 s instead of vanishing at once.',
    ],
  },
  {
    v: '0.63.3', date: '2026-10-28',
    pl: [
      'Kliknięcie wieży zdejmuje dach, więc widać pomost i łuczników.',
      'Kamienne baszty dostały łupkowe dachy na słupach; pod nimi kosze strzał, beczki z wodą i kamienie do zrzucania.',
      'Nowa czatownia: licha wieżyczka z żerdzi za 8 drewna, na jednego łucznika, strzela pole bliżej niż strażnica.',
    ],
    en: [
      'Clicking a tower lifts its roof, so you can see the platform and the archers on it.',
      'Stone turrets now have slate roofs on posts, sheltering arrow baskets, water barrels and stones for dropping.',
      'New lookout: a rickety pole tower for 8 wood that holds one archer and shoots a tile shorter than a watchtower.',
    ],
  },
  {
    v: '0.63.2', date: '2026-10-28',
    pl: [
      'W stopce menu jest przycisk, który czyści pamięć gry i wczytuje ją od nowa — bez szukania Ctrl+F5. Zapis zostaje.',
      'Gdy na serwerze jest nowsza wersja, przycisk robi się złoty i o tym mówi.',
    ],
    en: [
      'A button in the menu footer clears the game’s cache and reloads it fresh — no need for Ctrl+F5. Your save is kept.',
      'When a newer version is out, the button turns gold and tells you so.',
    ],
  },
  {
    v: '0.63.1', date: '2026-10-28',
    pl: [
      'Ślady butów na śniegu nie są już odwrócone — palce wskazują kierunek marszu.',
    ],
    en: [
      'Footprints in the snow are no longer back to front — the toes now point the way the walker went.',
    ],
  },
  {
    v: '0.63.0', date: '2026-10-28',
    pl: [
      'Magowie rzucają wielki czar, gdy co najmniej trzech wrogów stoi w kupie; potem 25 s odnowienia.',
      'Mag Płomienia sprowadza deszcz pięciu ognistych kul, które ranią i podpalają wrogów w kręgu.',
      'Mag Źródła wznosi krąg lodowych kolców: wrogowie przez 16 s idą o połowę wolniej, a płonący sojusznicy gasną.',
    ],
    en: [
      'Mages now cast a great spell when three or more foes are bunched together, then need 25 s to recover.',
      'The Flame Mage calls down a rain of five fireballs that wound and set alight every foe in the circle.',
      'The Spring Mage raises a ring of ice spikes: foes move at half speed for 16 s and burning allies are put out.',
    ],
  },
  {
    v: '0.62.0', date: '2026-10-28',
    pl: [
      'Menu główne w lewej kolumnie, jak w grach: herb, tytuł i pionowa lista pozycji z podpowiedzią pod spodem.',
      'Po liście chodzi się strzałkami, Enter wybiera, Esc wraca; okna otwierają się po prawej, na tle pejzażu.',
    ],
    en: [
      'The main menu now sits in a left-hand column, as in proper games: arms, title and a vertical list with hints below.',
      'Arrow keys move through the list, Enter selects and Esc goes back; windows open on the right, over the landscape.',
    ],
  },
  {
    v: '0.61.11', date: '2026-10-28',
    pl: [
      'Pora roku ustawiona w menu dewelopera zostaje po wczytaniu zapisu.',
    ],
    en: [
      'The season set in the developer menu now survives saving and loading.',
    ],
  },
  {
    v: '0.61.10', date: '2026-10-28',
    pl: [
      'Nowa rudera narożna w kształcie litery L: 17 drewna, 6 łóżek — coś między ruderą a chatą.',
      'Do środka wchodzi się w spacerze z małego podwórca przez otwór zasłonięty skórą.',
    ],
    en: [
      'New L-shaped corner hovel: 17 wood, 6 beds — a step between the hovel and the cottage.',
      'In first person you can walk in from its little yard through a hide-curtained doorway.',
    ],
  },
  {
    v: '0.61.9', date: '2026-10-28',
    pl: [
      'Dym po czarach magów to prawdziwe, postrzępione kłęby 3D zamiast szarych kulek.',
      'Kula ognia bucha ciemną sadzą, a czar wody — chłodną, białą parą.',
    ],
    en: [
      'Smoke from mages’ spells is now ragged 3D billows rather than flat grey balls.',
      'Fireballs burst into dark soot, while water spells release a cool white steam.',
    ],
  },
  {
    v: '0.61.8', date: '2026-10-28',
    pl: [
      'Zimą chłopi i żołnierze zostawiają na śniegu odciski butów, które po chwili bledną.',
    ],
    en: [
      'In winter, peasants and soldiers leave bootprints in the snow that slowly fade away.',
    ],
  },
  {
    v: '0.61.7', date: '2026-10-28',
    pl: [
      'Menu główne stoi na pejzażu o zmierzchu z ekranu wczytywania, z zamkiem i borem.',
      'Pod tytułem krótki opis gry i informacja, że gra jest cały czas rozwijana.',
    ],
    en: [
      'The main menu now sits on the twilight landscape from the loading screen, castle and forest included.',
      'A short description of the game sits beneath the title, with a note that it is still growing.',
    ],
  },
  {
    v: '0.61.6', date: '2026-10-28',
    pl: [
      'Chorągwie powiewają tylko nad ważnymi budynkami — koniec lasu flag nad chatami.',
      'Do rudery i namiotu da się wejść w spacerze; przy ruderze mała pochodnia przy drzwiach.',
    ],
    en: [
      'Banners now fly only over important buildings — no more forest of flags above the cottages.',
      'You can step inside hovels and tents in first person; hovels get a small torch by the door.',
    ],
  },
  {
    v: '0.61.5', date: '2026-10-28',
    pl: [
      'Drogi mają właściciela: zdejmujesz tylko swoje, a na cudzej nie położysz własnej.',
      'Zaznaczone wojsko rozkopie wrogą drogę prawym klikiem; piaskowa schodzi najszybciej, brukowana najwolniej.',
      'Wróg, także bot, może tak samo rozkopywać twoje drogi.',
    ],
    en: [
      'Roads now have owners: you can only remove your own and cannot lay yours over someone else’s.',
      'Right-click an enemy road with soldiers selected to dig it up; sand roads go quickest, cobbles slowest.',
      'Enemies, bots included, can tear up your roads in just the same way.',
    ],
  },
  {
    v: '0.61.4', date: '2026-10-28',
    pl: [
      'Numer wersji i godzina wydania widać od razu w rogu ekranu wczytywania.',
    ],
    en: [
      'The version number and build time now show in the corner of the loading screen from the very start.',
    ],
  },
  {
    v: '0.61.3', date: '2026-10-28',
    pl: [
      'Dwa tańsze mieszkania: rudera (10 drewna, 4 łóżka) i namiot (3 drewna, 2 łóżka, łatwo go zniszczyć).',
      'Gospodynie, dzieci, kury i świnie nie łażą już po wodzie ani po zalanym brzegu.',
      'Przy chacie chowa się najwyżej jeden rodzaj zwierząt, więc 20 chat nie robi już stada.',
    ],
    en: [
      'Two cheaper dwellings: the hovel (10 wood, 4 beds) and the tent (3 wood, 2 beds, easily destroyed).',
      'Goodwives, children, hens and pigs no longer wander into water or onto flooded banks.',
      'Each cottage keeps at most one kind of animal, so twenty cottages no longer make a whole herd.',
    ],
  },
  {
    v: '0.61.2', date: '2026-10-28',
    pl: [
      'Po kliknięciu własnej twierdzy znika górne piętro, więc widać z góry komnatę królowej.',
      'Drzwi komnaty stoją szeroko otwarte i nie zasłaniają wejścia.',
    ],
    en: [
      'Clicking your own keep lifts the upper floor away, revealing the queen’s chamber from above.',
      'The chamber door now stands wide open instead of blocking the way in.',
    ],
  },
  {
    v: '0.61.1', date: '2026-10-28',
    pl: [
      'Naprawione zamarzanie gry na starcie (0 FPS) przez błąd w dźwięku deszczu.',
    ],
    en: [
      'Fixed the game freezing at start-up (0 FPS) because of a fault in the rain sound.',
    ],
  },
  {
    v: '0.61.0', date: '2026-10-28',
    pl: [
      'Nowy ekran wczytywania: pejzaż o zmierzchu z zamkiem na wzgórzu, mgłą w dolinie i ciemnym borem.',
      'Na dole okuta listwa z radą, dużym procentem i płynnym, złotym paskiem.',
    ],
    en: [
      'New loading screen: a twilight landscape with a hilltop castle, mist in the valley and a dark forest.',
      'Along the bottom, an iron-bound bar with a tip, a large percentage and a flowing golden progress bar.',
    ],
  },
  {
    v: '0.60.6', date: '2026-10-28',
    pl: [
      'W oknie budynku widać, czyj jest: „Wróg”, „Sojusznik” albo „Twoje”, z imieniem i kolorem drużyny.',
      'Pasek wczytywania dostał pionowe złote okucia.',
    ],
    en: [
      'Building windows now show the owner — Enemy, Ally or Yours — with their name and team colour.',
      'The loading bar now has upright gold fittings at its ends.',
    ],
  },
  {
    v: '0.60.5', date: '2026-10-28',
    pl: [
      'Najwyższe tempo gry to teraz 3× — przyspieszenie 5× zniknęło.',
      'Jedna i ta sama deska wszędzie: na ramieniu chłopa, w magazynie, na budowie i w gruzie.',
      'Grubszy pasek i większe, czytelniejsze napisy na ekranie wczytywania.',
    ],
    en: [
      'Game speed now tops out at 3× — the 5× setting is gone.',
      'One plank everywhere: on a peasant’s shoulder, in the store, on the building site and in the rubble.',
      'A thicker bar and larger, clearer text on the loading screen.',
    ],
  },
  {
    v: '0.60.4', date: '2026-10-28',
    pl: [
      'Gra uruchamia się także wtedy, gdy przeglądarka odmawia grafiki przy pełnych ustawieniach — próbuje lżejszych.',
      'Gdy grafiki nie ma wcale, zamiast wiecznego wczytywania pojawia się podpowiedź, co włączyć w przeglądarce.',
    ],
    en: [
      'The game now starts even when the browser refuses full graphics settings — it falls back to lighter ones.',
      'If no graphics are available at all, you get advice on what to switch on instead of an endless loading screen.',
    ],
  },
  {
    v: '0.60.3', date: '2026-10-28',
    pl: [
      'Ciała poległych przy osadzie zawsze ktoś zabiera — gdy brak wolnych chłopów, na chwilę odchodzą najbliżsi robotnicy.',
      'Niosący idą do ciała własną drogą, przez bramę, a nie na skróty przez mury.',
    ],
    en: [
      'Bodies near your settlement are always collected now — if no peasants are idle, the nearest workers step away briefly.',
      'Bearers walk to the body by proper paths and through gates rather than straight through walls.',
    ],
  },
  {
    v: '0.60.2', date: '2026-10-28',
    pl: [
      'Wyraźnie wyższy FPS: odbicie w wodzie liczy się tylko, gdy woda jest w kadrze, a karta nie dostaje pustej roboty.',
    ],
    en: [
      'Noticeably higher FPS: water reflections are only drawn when water is in view, and the graphics card skips empty work.',
    ],
  },
  {
    v: '0.60.1', date: '2026-10-28',
    pl: [
      'Usunięte spadki FPS przy podświetlaniu budynków i placach budowy.',
      'Naprawiony błąd, który przy zmianie pory roku potrafił wywrócić klatkę.',
    ],
    en: [
      'Removed FPS drops when highlighting buildings and around building sites.',
      'Fixed a fault that could break a frame when the season changed.',
    ],
  },
  {
    v: '0.60.0', date: '2026-10-28',
    pl: [
      'Okno wojska jest węższe: szyk, marsz, postawa i patrol to ikony z opisem w dymku po najechaniu.',
      'Opis zaznaczonych i skróty są zwinięte pod przyciskiem „Skróty i opis”.',
    ],
    en: [
      'The army window is narrower: formation, march, stance and patrol are icons with a tooltip on hover.',
      'The selection summary and shortcuts are tucked away under a “Shortcuts and info” button.',
    ],
  },
  {
    v: '0.59.3', date: '2026-10-28',
    pl: [
      'Oddział po nowym rozkazie nie wraca już gonić chłopa, którego kazałeś wcześniej zaatakować.',
    ],
    en: [
      'Troops given a fresh order no longer wander back to chase a peasant you told them to attack earlier.',
    ],
  },
  {
    v: '0.59.2', date: '2026-10-28',
    pl: [
      'Zmarłych niosą dwaj chłopi w trumnie na noszach, zamiast jednego z workiem w powietrzu.',
      'Nikt nie niesie ciała w pojedynkę; cmentarz ma teraz dwóch grabarzy.',
    ],
    en: [
      'The dead are now borne by two men in a coffin on poles, not by one man with a floating sack.',
      'No one carries a body alone any more, and graveyards now have two gravediggers.',
    ],
  },
  {
    v: '0.59.1', date: '2026-10-28',
    pl: [
      'Zawalony budynek rozpada się naprawdę: kamienie, belki i deski spadają, odbijają się i leżą, gdzie upadły.',
      'Każde zawalenie wygląda inaczej, a na zboczu gruz zsuwa się po terenie.',
    ],
    en: [
      'Collapsing buildings now truly fall apart: stones, beams and planks tumble, bounce and lie where they land.',
      'No two collapses look alike, and on a slope the rubble slides downhill.',
    ],
  },
  {
    v: '0.59.0', date: '2026-10-28',
    pl: [
      'Rąbanie z biedy widać: chłop obrabia leżący pień, a deski układa w stos przy pniaku.',
      'Stos desek liczy się do zapasów; budowniczy nosi z niego ładunki na plac budowy.',
      'Drzewa padają płynnie, a numery grup i dymki nad głowami nie skaczą.',
    ],
    en: [
      'Makeshift woodcutting is now visible: the peasant trims the fallen trunk and stacks planks beside the stump.',
      'The plank stack counts towards your stores, and builders carry loads from it to the site.',
      'Trees fall smoothly, and group numbers and speech bubbles no longer jerk about.',
    ],
  },
  {
    v: '0.58.7', date: '2026-10-28',
    pl: [
      'Wilki nie przegryzają już palisady — podrapią mur najwyżej raz i wracają do lasu.',
      'Najechanie na wilka z zaznaczonym wojskiem pokazuje miecz, a prawy klik wysyła atak.',
    ],
    en: [
      'Wolves can no longer gnaw through palisades — at most they scratch the wall once and slink back to the woods.',
      'Hovering over a wolf with troops selected now shows the sword, and a right-click sends them to attack.',
    ],
  },
  {
    v: '0.58.6', date: '2026-10-28',
    pl: [
      'Gruz ruin nie lewituje — leży na ziemi, także na zboczach.',
    ],
    en: [
      'Ruin rubble no longer floats — it lies on the ground, slopes included.',
    ],
  },
  {
    v: '0.58.5', date: '2026-10-28',
    pl: [
      'Ogień nie razi w oczy: pochodnie, kosze i pożary są żółtopomarańczowe zamiast białych plam.',
      'Świeczki w izbach i latarnie nocą świecą słabiej, więc stół nie wygląda jak płonący.',
    ],
    en: [
      'Fire no longer dazzles: torches, braziers and blazes glow yellow-orange rather than as white blots.',
      'Candles indoors and lamps at night are softer, so a table no longer looks as if it’s ablaze.',
    ],
  },
  {
    v: '0.58.4', date: '2026-10-28',
    pl: [
      'Łucznicy strzelają z 8 pól zamiast 6 i widzą na 10 pól.',
      'Pochodnia łucznika przy strzelaniu w budynek to prawdziwa pochodnia wbita w ziemię; nocą łucznicy nie trzymają już pochodni.',
    ],
    en: [
      'Archers now shoot from 8 tiles instead of 6 and see 10 tiles out.',
      'The archer’s torch for fire arrows is now a proper torch planted in the ground, and archers no longer carry one at night.',
    ],
  },
  {
    v: '0.58.3', date: '2026-10-28',
    pl: [
      'Po pochówku w lesie zostaje kopczyk z krzyżem z kijów; znika po 3 dniach albo pod nowym budynkiem.',
      'Groby w lesie psują nastrój: -1 popularności na miesiąc, a przy 5 i więcej -2. Cmentarz tego oszczędza.',
    ],
    en: [
      'Woodland burials leave a mound with a stick cross; it vanishes after 3 days or under a new building.',
      'Forest graves sour the mood: -1 popularity a month, -2 with five or more. A graveyard spares you this.',
    ],
  },
  {
    v: '0.58.2', date: '2026-10-28',
    pl: [
      'Skróty do koszar, składu i spichlerza od pierwszego kliknięcia pokazują budynek obok okna, a nie pod nim.',
    ],
    en: [
      'Shortcuts to the barracks, stockpile and granary now show the building beside its window from the first click.',
    ],
  },
  {
    v: '0.58.1', date: '2026-10-28',
    pl: [
      'Kursor z mieczem łapie całą sylwetkę wroga, a cel ataku świeci na czerwono.',
      'Liczby obrażeń nad paskiem zdrowia są dwa razy większe i dłużej widoczne.',
      'Łucznicy i magowie strzelają do każdego wilka w zasięgu, a strzała naprawdę musi dolecieć.',
      'Cios wręcz sięga tylko sąsiada (1,25 pola zamiast 1,5), więc nikt nie bije przez puste pole.',
    ],
    en: [
      'The sword cursor now catches an enemy’s whole figure, and your attack target glows red.',
      'Damage numbers above health bars are twice the size and linger longer.',
      'Archers and mages loose at any wolf in range, and the arrow must actually reach it.',
      'Melee blows reach only the next man (1.25 tiles instead of 1.5), so no more striking across an empty tile.',
    ],
  },
  {
    v: '0.58.0', date: '2026-10-28',
    pl: [
      'Osada bez składu i drwala nie staje: wolny chłop sam ścina drzewo i obrabia je przy pniu (5 drewna na 30 s).',
      'Rąbanie z biedy kończy się samo, gdy stanie skład i chata drwala; pobity bot też potrafi się tak podnieść.',
    ],
    en: [
      'A settlement without a stockpile or woodcutter no longer stalls: an idle peasant fells and trims a tree himself (5 wood per 30 s).',
      'This makeshift chopping stops once a stockpile and woodcutter’s hut stand; a beaten bot can now recover the same way.',
    ],
  },
  {
    v: '0.57.5', date: '2026-10-28',
    pl: [
      'Wycie wilków z prawdziwych nagrań zamiast sztucznej syntezy — z daleka ciche, jak zza lasu, i rzadsze.',
      'Warczenie przy ataku też z nagrań, ciszej i rzadziej.',
    ],
    en: [
      'Wolf howls now come from real recordings rather than synthesis — quiet and distant, as if beyond the trees, and less frequent.',
      'Growls during attacks are recorded too, softer and less often.',
    ],
  },
  {
    v: '0.57.4', date: '2026-10-28',
    pl: [
      'Gruz po rozbiórce i ruiny układają się jak po zawaleniu — nic nie wisi w powietrzu ani nie wchodzi w ziemię.',
    ],
    en: [
      'Rubble and ruins now settle as if truly collapsed — nothing hangs in mid-air or sinks into the ground.',
    ],
  },
  {
    v: '0.57.3', date: '2026-10-28',
    pl: [
      'Bez cmentarza chłopi chowają zmarłych na skraju lasu: kopią dół łopatą i wracają do obozowiska.',
    ],
    en: [
      'Without a graveyard, peasants bury the dead at the forest’s edge, digging a grave before returning to camp.',
    ],
  },
  {
    v: '0.57.2', date: '2026-10-28',
    pl: [
      'Poprawki wewnętrzne — dokładniejszy dziennik błędów.',
    ],
    en: [
      'Behind-the-scenes work — a more detailed error log.',
    ],
  },
  {
    v: '0.57.1', date: '2026-10-28',
    pl: [
      'Nad gruzem zburzonego budynku nie świeci już pochodnia w powietrzu.',
    ],
    en: [
      'No more torch burning in mid-air above the rubble of a destroyed building.',
    ],
  },
  {
    v: '0.57.0', date: '2026-10-28',
    pl: [
      'Ogień trzyma się budynku: liże ściany i dach, rozpala się stopniowo przez ok. 15 s i nie razi w dzień.',
      'Płonący budynek czernieje od sadzy; osmalenie schodzi dopiero z naprawą.',
      'Ludzie, którzy nie gaszą, odsuwają się od pożaru i wracają do roboty po chwili.',
    ],
    en: [
      'Fire now clings to the building, licking walls and roof, building up over about 15 s and no longer glaring by day.',
      'Burning buildings blacken with soot, and the scorching only fades with repairs.',
      'Anyone not fighting the fire steps back from the blaze and returns to work after a while.',
    ],
  },
  {
    v: '0.56.2', date: '2026-10-28',
    pl: [
      'Obozy zbójów stoją w lesie na skraju mapy, daleko od zamków, ale napady na drwali i chłopów zostają.',
    ],
    en: [
      'Bandit camps now lie in the woods at the map’s edge, far from any keep — though they still raid woodcutters and peasants.',
    ],
  },
  {
    v: '0.56.1', date: '2026-10-28',
    pl: [
      'Łucznicy strzelający w budynek odpalają ogniste strzały od wbitej w ziemię pochodni — drewniane chaty zaczynają płonąć.',
      'Kamień nie płonie, a drewniane mury i bramy dostają tylko obrażenia.',
    ],
    en: [
      'Archers shooting at buildings light fire arrows from a torch planted in the ground — wooden cottages catch alight.',
      'Stone won’t burn, and wooden walls and gates only take damage.',
    ],
  },
  {
    v: '0.56.0', date: '2026-10-28',
    pl: [
      'Pożary budynków to prawdziwy ogień 3D: bucha z dachu, liże ściany, przechyla się z wiatrem, nad nim gęsty dym.',
      'Pochodnie, ogniska, ogniste strzały i kule magów też są bryłami ognia, a nie płaskimi płomykami.',
    ],
    en: [
      'Burning buildings now show true 3D fire: it roars from the roof, licks the walls, bends in the wind and trails thick smoke.',
      'Torches, campfires, fire arrows and mages’ fireballs are solid flames now, not flat cut-outs.',
    ],
  },
  {
    v: '0.55.4', date: '2026-10-28',
    pl: [
      'Strzały i czary lecą w postać na murze czy wieży, a nie w mur pod nią.',
      'Prawy klik na wrogiego chłopa naprawdę wysyła na niego żołnierzy.',
      'Jaśniejszy komunikat, gdy wóz z surowcami nie dojedzie do sojusznika.',
    ],
    en: [
      'Arrows and spells now fly at the man on the wall or tower, not into the stonework below him.',
      'Right-clicking an enemy peasant now really sends your soldiers after him.',
      'Clearer message when a supply cart cannot reach an ally.',
    ],
  },
  {
    v: '0.55.3', date: '2026-10-28',
    pl: [
      'Muzyka: 33 średniowieczne utwory zamiast 6 — osobno na dzień, noc i bitwę.',
      'Wygrana i porażka mają własną muzykę.',
      'Zniknęło piskliwe skrzypienie młyna i stały szum w tle.',
    ],
    en: [
      'Music: 33 medieval pieces instead of 6, with separate tunes for day, night and battle.',
      'Victory and defeat now have their own music.',
      'Gone are the squeaky mill creak and the constant background hiss.',
    ],
  },
  {
    v: '0.55.2', date: '2026-10-28',
    pl: [
      'Naprawione stawanie gry (0 FPS) po błędzie grafiki.',
    ],
    en: [
      'Fixed the game grinding to a halt (0 FPS) after a graphics error.',
    ],
  },
  {
    v: '0.55.1', date: '2026-10-28',
    pl: [
      'Porzucone gruzowiska już nie dymią — kurz unosi się tylko przy pracy.',
      'Ruina i gruz, przy których nikt nie pracuje, znikają po 5 minutach gry, a działka jest wolna.',
    ],
    en: [
      'Abandoned rubble no longer smokes — dust rises only while someone is working there.',
      'Ruins and rubble left untouched vanish after 5 minutes of play, freeing the plot.',
    ],
  },
  {
    v: '0.55.0', date: '2026-10-28',
    pl: [
      'Budowanie świata przy wczytywaniu nie zamraża już strony na 2 s — pasek idzie płynnie.',
      'Pierwsza wieża, brama czy plac budowy nie przycinają już obrazu.',
    ],
    en: [
      'Building the world while loading no longer freezes the page for 2 s — the bar moves smoothly.',
      'Your first tower, gate or building site no longer causes a stutter.',
    ],
  },
  {
    v: '0.54.10', date: '2026-10-28',
    pl: [
      'Kamienna brama jest dwa razy większa: szerszy przejazd, wyższy łuk i baszty.',
      'Wejście budynku jest zawsze na środku frontu; gdy jest zastawione, nie postawisz go tam.',
      'Budynek staje tam, gdzie stoi podgląd, a stawianie i budowa mniej przycinają.',
    ],
    en: [
      'The stone gatehouse is twice the size: a wider passage, a taller arch and towers.',
      'A building’s entrance is always at the centre of its front; if that spot is blocked, you can’t place it there.',
      'Buildings go exactly where the preview stands, and placing and building cause fewer stutters.',
    ],
  },
  {
    v: '0.54.9', date: '2026-10-28',
    pl: [
      'Naprawiony błąd przy przeciąganiu kamery i minimapy.',
      'Skopiowany dziennik błędów zawiera wszystko, czego trzeba do naprawy.',
    ],
    en: [
      'Fixed an error when dragging the camera or minimap.',
      'The copied error log now holds everything needed to fix a problem.',
    ],
  },
  {
    v: '0.54.8', date: '2026-10-28',
    pl: [
      'Menu pauzy pod Esc pokazuje wstrzymaną osadę w złotej ramce i napis „Gra wstrzymana”.',
      'W Ustawieniach → Autorzy nowa sekcja „Twórcy gry”.',
    ],
    en: [
      'The Esc pause menu now shows your paused settlement in a gold frame with “Game paused”.',
      'Settings → Credits has a new “Game creators” section.',
    ],
  },
  {
    v: '0.54.7', date: '2026-10-28',
    pl: [
      'Symulacja w dużych grach liczy się o ok. 30–37% szybciej, także w meczach przez sieć.',
    ],
    en: [
      'The simulation runs about 30–37% faster in large games, online matches included.',
    ],
  },
  {
    v: '0.54.6', date: '2026-10-28',
    pl: [
      'Tryb deweloperski liczy symulację w osobnym wątku, więc duża bitwa nie zabiera klatek.',
      'Pierwsze wczytanie jest szybsze — tekstury rysuje kilka rdzeni procesora naraz.',
    ],
    en: [
      'Developer mode now runs the simulation on a separate thread, so a big battle no longer eats frames.',
      'First load is quicker — textures are painted on several processor cores at once.',
    ],
  },
  {
    v: '0.54.5', date: '2026-10-28',
    pl: [
      'W laptopach z dwiema kartami graficznymi gra prosi o mocniejszą.',
      'F3 pokazuje nazwę karty graficznej i liczbę rdzeni procesora.',
    ],
    en: [
      'On laptops with two graphics cards, the game now asks for the more powerful one.',
      'F3 shows the name of your graphics card and the number of processor cores.',
    ],
  },
  {
    v: '0.54.4', date: '2026-10-28',
    pl: [
      'Szybsze wczytywanie: modele, kod gry i tekstury pobierają się równolegle, a nie po kolei.',
      'Najwięcej zyskuje pierwsze wejście i wejście po aktualizacji gry.',
    ],
    en: [
      'Faster loading: models, game code and textures now download side by side rather than one after another.',
      'The first visit and the first visit after an update gain the most.',
    ],
  },
];

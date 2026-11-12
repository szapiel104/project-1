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
  { v: '0.95.7', date: '2026-11-12', pl: [
    'Nowy budynek: chata myśliwego. Myśliwy podchodzi zwierzynę, sięga do kołczanu, naciąga łuk i strzela; ubite zwierzę patroszy na miejscu, tuszę niesie do chaty, oprawia ją i porcjami odnosi mięso do spichlerza.',
    'Nowy surowiec: skóry. Z jelenia i dzika myśliwy zanosi wyprawione skóry do składu, a rynek dobrze za nie płaci.',
    'Jelenie, dziki i zające żyją teraz w grze naprawdę: pasą się stadami, uciekają przed ludźmi, a wybite stado odnawia się zwierzętami, które przychodzą z krańców mapy. Przy trafieniu leje się krew, a ubite zwierzę leży na boku.',
    'Przeciwnik też stawia chatę myśliwego, gdy w okolicy jego zamku pasie się zwierzyna.',
    'Nowy wilk i płynniejsze ruchy wszystkich zwierząt; dzik ma wreszcie zamknięty pysk.',
    'Kliknięcie w zwierzę (dzikie, w osadzie, kruki) mówi, co to za stworzenie.',
    'Krótsze wczytywanie: modele zwierząt doczytują się w tle już po wejściu do gry.',
  ], en: [
    'A new building: the hunter\'s lodge. The hunter stalks game, reaches for his quiver, draws his bow and looses; he dresses the kill where it fell, carries the carcass home, butchers it and takes the meat to the granary a portion at a time.',
    'A new good: hides. From deer and boar the hunter brings cured hides to the stockpile, and the market pays handsomely for them.',
    'Deer, boar and hares now truly live in the realm: they graze in herds, flee from people, and a hunted-out herd recovers as new beasts wander in from the edges of the map. A struck beast bleeds, and the slain lie on their side.',
    'Your rivals raise hunter\'s lodges too, whenever game roams near their castle.',
    'A new wolf and smoother movement for every animal; the boar finally keeps its jaw shut.',
    'Clicking an animal (wild, in the village, or a crow) tells you what manner of creature it is.',
    'Shorter loading: animal models finish loading in the background once you are in the game.',
  ] },
  { v: '0.95.6', date: '2026-11-11', pl: [
    'W ogniskach i paleniskach obozu zbójców, chaty maga i kuźni leży prawdziwy żar: węgiel i rozżarzone grudki zamiast płaskich krążków.',
  ], en: [
    'The fire pits and hearths of the brigands\' camp, the mage\'s hut and the smithy hold real embers: coal and glowing lumps instead of flat discs.',
  ] },
  { v: '0.95.5', date: '2026-11-11', pl: [
    'Nowy wilk: prawdziwa sierść, chód, postój i skok do ataku; zabity leży na boku.',
    'Wieża Płomienia: w misach i koszach żar z popiołu i węgla, a ogień płonie nad nim; łupkowy daszek drewutni.',
    'Woda w sadzawkach, fontannach i studniach faluje i odbija niebo.',
    'Szybsza gra przy dużych osadach i bitwach (stawianie budynków przez boty, szukanie dróg, przydział pracy).',
  ], en: [
    'A new wolf: a proper coat, walking, standing and a leap to attack; a slain wolf lies on its side.',
    'Tower of Flame: the bowls and baskets hold embers of ash and coal with fire above them; a slate roof on the woodshed.',
    'Water in pools, fountains and wells ripples and mirrors the sky.',
    'Smoother play in large settlements and battles (bot building checks, pathfinding, job assignment).',
  ] },
  { v: '0.95.4', date: '2026-11-11', pl: [
    'Nowa zwierzyna: dziki chodzą watahami, lisy i zające na łąkach, w lasach i na stepie — uciekają przed ludźmi.',
    'Nowe, realistyczne modele jelenia, wielbłąda z derką i świni; pies, lis i zając z poprawioną sierścią.',
    'Zwierzęta poruszają się płynnie: bez przeskoków łba, cofania co krok i szalonego kicania.',
    'Ludzie ruszają z rozpędem, hamują miękko i skręcają łukiem; ręce i nogi przechodzą płynnie między chodem, pracą i niesieniem.',
    'Kamera: miękkie zbliżanie, płynny dolot do miejsc z kroniki i alarmu, wstrząs przy walącym się budynku i uderzeniu taranu.',
    'Ukończony budynek osiada z kurzem, a oddawany towar trafia do budynku zamiast znikać.',
    'Drobiazgi przy budynkach nie wyskakują przy oddalaniu kamery.',
    'Ekran wczytywania od razu ze zdjęciem; mniej starych murków na mapie; bez czerwonych oczu w lesie nocą.',
  ], en: [
    'New game: wild boar roam in packs, foxes and hares live in meadows, woods and steppe — all flee from people.',
    'New lifelike models for the stag, the blanketed camel and the pig; the dog, fox and hare have their proper coats.',
    'Beasts move smoothly: no more snapping heads, backward lurches or frantic hopping.',
    'Folk set off with momentum, slow down gently and turn in arcs; arms and legs flow between walking, working and carrying.',
    'Camera: gentle zoom, a smooth glide to places from the chronicle and alarms, and a shake when a building falls or a ram strikes.',
    'A finished building settles in a puff of dust, and delivered goods go into the building instead of vanishing.',
    'Small items around buildings no longer pop in and out as the camera pulls back.',
    'The loading screen opens straight on a picture; fewer old field walls on maps; no more red eyes in the woods at night.',
  ] },
  { v: '0.95.3', date: '2026-11-11', pl: [
    'Zwierzęta w osadzie — kury, świnie i pies — mają nowe, ładne modele: kury dziobią, świnie ryją, pies siada i chodzi za chłopami.',
    'Konie znów skubią trawę i machają ogonem.',
    'Dzikie zwierzęta poruszają się płynnie, na postoju ruszają łbem i ogonem, wielbłądy i jelenie wydają odgłosy.',
    'Mgła jak w nowych grach: miękko gęstnieje z odległością i przy ziemi, dalekie góry i palmy wyłaniają się sylwetką.',
    'Edytor modeli: kocioł z pokrywą i kabłąkiem (i inne rzeczy złożone z drobnych części) zaznacza się jednym kliknięciem.',
  ], en: [
    'Village animals — hens, pigs and the dog — have fine new models: hens peck, pigs root about, the dog sits and trots after the peasants.',
    'Horses graze and swish their tails again.',
    'Wild beasts move smoothly, turn their heads and flick their tails at rest, and camels and deer call out.',
    'Fog as in modern games: it thickens softly with distance and near the ground, far hills and palms loom as silhouettes.',
    'Model editor: a cauldron with its lid and handle (and other things made of small pieces) is selected with a single click.',
  ] },
  { v: '0.95.2', date: '2026-11-11', pl: [
    'Dzikie zwierzęta: wielbłądy na pustyni, jelenie na zielonych krainach — pasą się stadami i uciekają przed ludźmi.',
    'Pustynia: jasny, czysty piach, przeważnie płasko, wydmy tylko miejscami; zielona trawa tylko w oazach.',
    'Woda: piana i fale biegnące do brzegu, turkusowe oazy.',
    'Płynniejsza gra: lżejsze wersje przedmiotów i towarów z daleka, wnętrza pod dachem rysują się tylko z bliska.',
    'Ludzie i żołnierze obracają się płynnie, żołnierze ruszają szybciej po rozkazie i unoszą broń na znak, że go przyjęli.',
    'Chłopi pracują prawdziwymi narzędziami: łopatą, kilofem, toporkiem i młotkiem.',
    'Mur przechodzi wprost w dach koszar i zbrojowni.',
    'Rynek w oknie na środku ekranu.',
    'Nowe, bardziej klimatyczne zdjęcia na ekranie wczytywania i w menu.',
  ], en: [
    'Wild animals: camels in the desert, deer in the green lands — they graze in herds and flee from people.',
    'Desert: clean, pale sand, mostly flat with dunes only here and there; green grass only in the oases.',
    'Water: foam and waves rolling to the shore, turquoise oases.',
    'Smoother play: lighter versions of items and goods at a distance, interiors under a roof drawn only up close.',
    'Folk and soldiers turn smoothly; soldiers set off sooner after an order and raise their weapons to acknowledge it.',
    'Peasants work with real tools: spade, pickaxe, hatchet and hammer.',
    'Walls now run straight onto the roofs of the barracks and armoury.',
    'The market opens in a window in the middle of the screen.',
    'New, moodier pictures on the loading screen and in the menu.',
  ] },
  { v: '0.95.1', date: '2026-11-11', pl: [
    'Płynniejsza gra w dużych osadach: przedmioty dodane do budynków rysują się razem, z daleka znikają, a drobne nie rzucają cienia.',
    'Mur kamienny łączy się z koszarami i zbrojownią tak jak z wieżą.',
    'W zbrojowni łuki leżą na kozłach i nic już nie przebija dachu.',
    'Ekran wczytywania i menu: zdjęcia z gry w tle, przy wczytywaniu zmieniają się same.',
    'Edytor modeli: 24 nowe przedmioty — broń, narzędzia, latarnia, stoły, beczka wina, wrota, krata, palenisko, działo.',
    'Ulepszenia budynków z edytora twórcy.',
  ], en: [
    'Smoother play in large settlements: items added to buildings are drawn together, vanish at a distance, and small ones cast no shadow.',
    'Stone walls now join the barracks and armoury just as they join a tower.',
    'In the armoury the bows lie on their racks and nothing pokes through the roof any more.',
    'Loading screen and menu: pictures from the game in the background, changing while it loads.',
    'Model editor: 24 new items — weapons, tools, a lantern, tables, a wine cask, castle doors, a portcullis, a fire pit, a cannon.',
    'Building improvements from the creator’s editor.',
  ] },
  { v: '0.95.0', date: '2026-11-11', pl: [
    'Podgląd modeli: konto w górnej belce — logowanie, zmiana nazwy i hasła, wylogowanie.',
    'Edytor modeli: barwa, zagłębienia, matowość, metal i świecenie każdej części.',
    'Edytor modeli: ta sama wersja budynków na każdym komputerze.',
    'Ulepszenia budynków z edytora twórcy.',
  ], en: [
    'Model viewer: account in the top bar — sign in, change name and password, sign out.',
    'Model editor: tint, crevices, roughness, metalness and glow for every part.',
    'Model editor: the same version of buildings on every computer.',
    'Building improvements from the creator’s editor.',
  ] },
  { v: '0.94.99', date: '2026-11-11', pl: [
    'Kolejne gotowe przedmioty z Poly Haven (CC0): krzesła, stoły, komody, regały, wazy, kociołek, piła, szabla, topory, lichtarze, butelki, paproć, trawa i kamienie.',
    'Nowe tekstury: bruki, mury kamienne, cegła zamkowa, piaskowiec, dachówki, łupek, trzcina, deski, tynki, ściółka i rdzawy metal.',
    'Ulepszenia budynków z edytora twórcy.',
  ], en: [
    'More ready-made objects from Poly Haven (CC0): chairs, tables, chests of drawers, shelves, vases, a cauldron, a saw, a sabre, axes, candleholders, bottles, a fern, grass and stones.',
    'New textures: cobbles, stone walls, castle brick, sandstone, roof tiles, slates, reed, planks, plaster, forest litter and rusty metal.',
    'Building improvements from the creator’s editor.',
  ] },
  { v: '0.94.98', date: '2026-11-11', pl: [
    'Naprawa: gra nie wyłącza się już przy stawianiu koszar.',
    'Ulepszenia budynków z edytora twórcy widać w grze od razu po odświeżeniu.',
    'Edytor modeli: skala tekstury, jasność i głębia wzoru dla każdej części.',
    'Nazwa strony ustawień „Słabsze komputery” mieści się w jednej linii.',
  ], en: [
    'Fix: the game no longer crashes when placing barracks.',
    'Building improvements from the creator’s editor show up in the game right after a refresh.',
    'Model editor: texture scale, brightness and pattern depth for every part.',
    'The “Weaker computers” settings page name fits on one line.',
  ] },
  { v: '0.94.97', date: '2026-11-10', pl: [
    'Edytor modeli: zapis łączy poprawki z różnych komputerów i przeglądarek zamiast nadpisywać wcześniejsze.',
    'Naprawa błędów cieni przy budynkach, w których wszystkie części jednego materiału dostały inną teksturę.',
    'Koniec z setkami błędów grafiki przy wczytywaniu gry (WebGPU).',
  ], en: [
    'Model editor: saving merges fixes made on different computers and browsers instead of overwriting earlier ones.',
    'Fixed shadow errors on buildings where every part of one material was given another texture.',
    'No more hundreds of graphics errors while the game loads (WebGPU).',
  ] },
  { v: '0.94.96', date: '2026-11-10', pl: [
    'Edytor modeli: przeciąganie tekstur i przedmiotów działa pewnie, z podglądem w miejscu upuszczenia i zielonym podświetleniem części, która dostanie teksturę.',
    'Edytor modeli: edycja nie wyłącza się sama w trakcie pracy, wyszukiwarka tekstur filtruje, przyciąganie z Shiftem nie „przykleja” przedmiotów.',
    'Nowe poprawki budynków z edytora twórcy.',
  ], en: [
    'Model editor: dragging textures and objects works reliably, with a preview where you drop and a green highlight on the part that will get the texture.',
    'Model editor: editing no longer switches itself off mid-work, the texture search filters, and Shift snapping no longer makes objects stick.',
    'New building improvements from the creator’s editor.',
  ] },
  { v: '0.94.95', date: '2026-11-10', pl: [
    'Zapis gry: w oknie „Zapisz grę” każdy zapis da się nadpisać — także autozapis (staje się wtedy zwykłym zapisem).',
    'Ulepszenia budynków zrobione w edytorze twórcy trafiają do gry: przestawione i dodane sprzęty, beczki, kosze, jedzenie i pochodnie (świecą nocą).',
    'Podgląd modeli (Ustawienia → Dla twórców): lista modeli z miniaturami i wyszukiwarką, wnętrze kopalni, światła nocą, mocniejsze przybliżenie, menu i pasek ikon jak w programach graficznych.',
    'Nowe gotowe przedmioty i tekstury z Poly Haven (CC0): skrzynie, beczki, wiadra, stołki, stoły, ławy, regały, miski, dzbany, latarnie, narzędzia, kołowrotek, tarcza, pnie i kamienie; mury, bruki, dachy, deski i tynki.',
  ], en: [
    'Saving: in the “Save game” window every save can be overwritten — autosaves too (they then become a regular save).',
    'Building improvements made in the creator’s editor now reach the game: moved and added furnishings, barrels, baskets, food and torches (lit at night).',
    'Model viewer (Settings → For creators): model list with thumbnails and search, the mine interior, night lights, closer zoom, and a menu and icon bar like in graphics programs.',
    'New ready-made objects and textures from Poly Haven (CC0): crates, barrels, buckets, stools, tables, benches, shelves, bowls, jugs, lanterns, tools, a spinning wheel, a shield, stumps and stones; walls, cobbles, roofs, planks and plaster.',
  ] },
  { v: '0.94.94', date: '2026-11-10', pl: [
    'Logowanie: „Nie pamiętam hasła” — link na e-mail i ustawienie nowego hasła po powrocie do gry.',
  ], en: [
    'Sign in: “I forgot my password” — an e-mailed link lets you set a new password when you return to the game.',
  ] },
  { v: '0.94.93', date: '2026-11-10', pl: [
    'Nowa zbrojownia i koszary: kamienne jak mury obronne, z blankami i narożnymi wypustami na dachu, schodami na dach, łukowym wejściem z pochodniami i porządnym kominem; w środku stojaki z bronią, tarcze, prycze, stół i kominek.',
    'Szybsza gra w dużej osadzie: budynki rysują się mniejszą liczbą materiałów (te same tekstury w różnych barwach są jednym materiałem), wnętrza nie rzucają już cienia ani odbicia w wodzie.',
    'Pustynia: krzewy, trawy, patyki i kamienie gęsto tylko przy oazach, na gołym piachu z rzadka; mniej głazów.',
    'Bez brył ognia w zamku, kaplicy, karczmie i browarze: w paleniskach żar z popiołem, płomienie i płomyki świec rysuje gra.',
    'Chata: skrzynka z kwiatami z desek, ziemi, liści i płatków.',
    'Spacer: wnętrza budynków widać zawsze (także z zewnątrz przez drzwi), dach zostaje na miejscu, światła palą się, zanim wejdziesz; w sadzie nie przycina, do ogniska da się podejść.',
    'Podgląd mapy w Nowej grze nie zacina interfejsu.',
    'Podgląd modeli: wnętrza widoczne, latanie kamerą WASD, zwijana lista modeli.',
  ], en: [
    'A new armoury and barracks: built of stone like the curtain walls, with crenellations and corner turrets on the roof, stairs up to the roof, an arched doorway lit by torches and a proper chimney; inside, weapon racks, shields, bunks, a table and a hearth.',
    'Smoother play in a large settlement: buildings are drawn with far fewer materials (one texture in different shades is now a single material), and interiors no longer cast sun shadows or show in water reflections.',
    'Desert: shrubs, grass, dead branches and pebbles grow thickly only around oases, sparse on open sand; fewer boulders.',
    'No more solid flames in the keep, chapel, tavern and brewery: hearths hold glowing embers and ash, and the game draws the flames and candle lights.',
    'Cottage: a window box of planks, soil, leaves and petals.',
    'Walking: building interiors are always there (also seen from outside through the door), the roof stays on, lights are lit before you step in; no stutter in the orchard, and you can walk up to the campfire.',
    'The map preview in New Game no longer freezes the interface.',
    'Model viewer: interiors shown, WASD camera flight, a foldable model list.',
  ] },
  { v: '0.94.92', date: '2026-11-09', pl: [
    'Płynniejsza kamera: lot myszą i klawiaturą nie zjada już klatek (podświetlenie pod kursorem liczone raz na klatkę), budynki poza ekranem i poza cieniami nie są rysowane, odbicie wody liczy się tylko z wodą w kadrze.',
    'Kamera leci prosto na stałej wysokości, bez podskakiwania na pagórkach.',
    'Zmiana ustawień grafiki nie psuje już cieni.',
    'Okno „Zapisz grę”: zapis można nadpisać jednym przyciskiem „Nadpisz”.',
    'Kopalnia: zbocze za kratą wchodzi w górę, wnętrze sztolni bez szachownicy, równe okno z urobkami.',
  ], en: [
    'A smoother camera: flying with mouse and keyboard no longer eats frames (the highlight under the cursor is worked out once per frame), buildings off screen and outside the shadows are not drawn, and water reflections are worked out only when water is in view.',
    'The camera flies straight at a steady height, without bobbing over the hills.',
    'Changing the graphics settings no longer breaks the shadows.',
    'The "Save game" window: a save can be overwritten with a single "Overwrite" button.',
    'The mine: the slope behind the grate runs into the mountain, the gallery inside has no chequerboard, and the yields window is laid out neatly.',
  ] },
  { v: '0.94.91', date: '2026-11-09', pl: [
    'Wydajność: pełna osada chodzi płynniej (u nas z ok. 30 do ok. 55–60 klatek): drogi nie są sprawdzane w każdej klatce, położenie budynków liczy się raz na klatkę, mapa cieni odświeża się co drugą klatkę, mniej osobnych rysowań palm, zapasów, drzwi i drabin.',
    'Zawalenie budynku nie zatrzymuje już gry; kamera nie oddala się tak daleko, a z daleka nie kładzie się nad horyzontem.',
    'Kopalnia to teraz wejście w skałę: drewniany portal z żelazną kratą w zboczu góry, przed nim tor z wózkiem urobku. W środku kopalni latarnie znów świecą ciepło, a nie na niebiesko.',
    'Wrodzy łucznicy i magowie strzelają do obrońców na wieżach i murach także zza blanków (część strzał rozbija się na kamieniu).',
    'Menu w klimacie klasztoru: kute przyciski z dębu i żelaza, tablica z logo, światło świec; „Jak grać” w Ustawieniach; pełne napisy końcowe z autorami grafiki i muzyki.',
    'Śpiew mnichów: osiem nagrań chorału gregoriańskiego w menu, nocą i za dnia.',
    'Rozkazy oddziału na dolnym pasku zamiast osobnego okna; po wczytaniu zapisu gra zawsze rusza w zwykłym tempie.',
    'Dachy z daleka pozostają pełne, okno kopalni pokazuje równo wszystkie urobki, w oknie budynku nie ma już zbędnego oka.',
  ], en: [
    'Performance: a full settlement runs much more smoothly (for us from about 30 to about 55–60 frames): roads are no longer checked every frame, building positions are worked out once per frame, the shadow map refreshes every other frame, and palms, stores, doors and ladders are drawn in fewer batches.',
    'A collapsing building no longer stalls the game; the camera no longer pulls back so far, nor lies flat over the horizon from afar.',
    'The mine is now an entrance cut into the rock: a timber portal with an iron grate set in the mountainside, with a track and an ore cart before it. Inside the mine the lanterns glow warm again rather than blue.',
    'Enemy archers and mages now shoot at defenders on towers and walls even over the battlements (some arrows break on the stone).',
    'A menu in the spirit of a monastery: forged oak-and-iron buttons, a carved name board, candlelight; "How to play" moved to Settings; full credits for the art and music.',
    'Monks\' chant: eight recordings of Gregorian chant in the menu, by night and by day.',
    'Squad orders sit on the bottom bar instead of a separate window; loading a save always resumes at normal speed.',
    'Roofs stay whole from afar, the mine window lists all its yields neatly, and the building window no longer shows a needless eye.',
  ] },
  { v: '0.94.90', date: '2026-11-09', pl: [
    'Rynek: duże okno z suwakami „sprzedaj” (do tego, co masz) i „kup” (na ile starczy rudy i miejsca), ilość można też wpisać; trzy towary w rzędzie, pracownicy pod listą.',
    'Rynek ma szyld na środku i przejście między kramami, a wolni chłopi czasem przychodzą coś kupić.',
    'Budowa postawiona nocą: trzech chłopów wstaje i buduje (także u przeciwników).',
    'Rozbiórka nieukończonej budowy zwraca od razu wszystko, czego jeszcze nie doniesiono; budowlańcy biorą materiał z pobliskiego gruzu.',
    'Namiot polowy wygląda jak pawilon z turnieju: pasy lnu i czerwonego sukna, lamówka, maszty z gałkami.',
    'Dymki w stylu gry, grubsze nagłówki kart, ruda pierwsza na górnym pasku, surowiec „Drabiny”, okno postaci bez zbędnego „i”.',
    'Wydajność: ciężkie modele w budynkach (np. jabłka w sadach) poza ekranem nie obciążają już karty graficznej.',
  ], en: [
    'Market: a large window with sliders to sell (up to what you hold) and buy (as far as your ore and storage allow); you can also type the amount; three goods per row, workers below the list.',
    'The market has its sign in the middle and a walkway between the stalls, and idle peasants now and then come to buy something.',
    'A building site placed at night: three peasants get up and build (for opponents too).',
    'Pulling down an unfinished site returns everything not yet carried there straight away; builders take materials from nearby rubble.',
    'The field tent now looks like a tournament pavilion: stripes of linen and red cloth, a scalloped valance, poles with finials.',
    'Game-styled tooltips, bolder card headings, ore first on the top bar, the resource is now simply "Ladders", no needless "i" on a person\'s window.',
    'Performance: heavy models inside buildings (such as the apples in orchards) no longer burden the graphics card when off screen.',
  ] },
  { v: '0.94.89', date: '2026-11-09', pl: [
    'Nowe okna budynków w stylu gry RPG: pergamin w oprawie jak księga, portret budynku w nagłówku, sekcje jako karty, a na dole wytrzymałość i przyciski-ikony (włącz/wyłącz, targ, zasięg, przenieś, rozbierz z potwierdzeniem).',
    'Załoga w każdym budynku: głowy pracowników, magazynierów i żołnierzy na wieży, wolne miejsca w ramce. Klik w głowę pokazuje tę osobę albo zaznacza żołnierza.',
    'Twierdza pokazuje straż miejską z paskami zdrowia, a po śmierci strażnika odlicza, kiedy przyjdzie nowy.',
    'Magazyny jak ekwipunek: towary w slotach z liczbą w rogu, receptury warsztatów jako sloty ze strzałką.',
    'Okna postaci, oddziału i rynku w tym samym stylu; „Przejdź się oczami” to ikona oka w nagłówku.',
    'Zasoby, dzień i stan osady na pasku u góry ekranu; na dole zostaje budowanie. Grupy wojska 1–0 w kolumnie w lewym dolnym rogu.',
    'Menu budowy: same obrazki budynków w grubszej ramie, nazwa i koszt w karcie po najechaniu. Bez przycisku „Wyburzanie” — budynek rozbiera się koszem w jego oknie.',
    'Nowe ikony zboża, chleba, jabłek, ryb, mięsa i mąki. Leśniczy na pustyni sadzi palmy.',
    'Cienie z daleka bez pasków na płaskim terenie.',
  ], en: [
    'New RPG-style building windows: parchment in a book-like binding, a portrait of the building in the header, sections as cards, and at the bottom the building\'s health and icon buttons (start/stop, market, range, move, demolish with a confirmation).',
    'Every building shows its crew: the heads of workers, storekeepers and men on a tower, with free posts framed. Click a head to see that person or select the soldier.',
    'The keep shows the town watch with health bars and, when a guard falls, counts down until a new one arrives.',
    'Stores look like an inventory: goods in slots with the count in the corner; workshop recipes as slots with an arrow.',
    'The person, company and market windows share the same look; "Walk in his shoes" is an eye icon in the header.',
    'Supplies, the day and the state of the settlement now sit in a bar along the top of the screen; building stays at the bottom. Army groups 1–0 stack in a column in the lower left corner.',
    'Build menu: just the building pictures in a heavier frame, with name and cost in the card on hover. No more "Demolish" button — pull a building down with the bin in its window.',
    'New icons for grain, bread, apples, fish, meat and flour. Foresters in the desert plant palms.',
    'Distant shadows no longer show stripes on flat ground.',
  ] },
  { v: '0.94.88', date: '2026-11-09', pl: ['Naprawione: kopalnia (i inne budynki) daleko od zamku nie stały już bez końca w budowie — chłopi z materiałem znajdują drogę także na drugi koniec mapy.'], en: ['Fixed: a mine (or any building) far from the castle no longer stays under construction forever — villagers carrying materials now find their way even to the far end of the map.'] },
  { v: '0.94.87', date: '2026-11-08', pl: ['Zamek: kamienie łuku nad bramą układają się w równy łuk, zamiast sterczeć na boki.'], en: ['Castle: the stones of the arch above the gate now form a neat arch instead of sticking out sideways.'] },
  { v: '0.94.86', date: '2026-11-08', pl: ['Budynki znów rysują się razem po materiale (płynniejsza duża osada) — z naprawionym błędem, przez który części jednych budynków pojawiały się w innych.'], en: ['Buildings are drawn together by material again (smoother large settlements) — with the bug fixed that made parts of one building show up in another.'] },
  { v: '0.94.85', date: '2026-11-08', pl: ['Naprawione: części budynków (np. skrzydła wiatraka) nie pojawiają się już w innych budynkach.'], en: ['Fixed: parts of buildings (such as windmill sails) no longer show up inside other buildings.'] },
  { v: '0.94.84', date: '2026-11-07', pl: ['Duża osada płynniej: budynki z tymi samymi materiałami rysują się razem, więc przy wielu rodzajach budynków karta graficzna dostaje o jedną trzecią mniej poleceń.', 'Stawianie pierwszego budynku danego rodzaju nie zacina już gry — wszystkie budynki przygotowują się na ekranie wczytywania (wczytywanie trwa przez to kilka sekund dłużej).', 'Plac przed bramą zamku nie jest już wyłożony kamieniem — to zwykła ziemia, wydeptywana przez mieszkańców; leśniczy nie sadzi na nim drzew.'], en: ['Large settlements run smoother: buildings sharing the same materials are drawn together, so with many kinds of buildings the graphics card gets about a third fewer commands.', 'Placing the first building of a kind no longer makes the game stutter — every building is prepared on the loading screen (loading takes a few seconds longer).', 'The square before the castle gate is no longer paved with stone — it is plain earth, worn down by the villagers; foresters do not plant trees on it.'] },
  { v: '0.94.83', date: '2026-11-07', pl: ['Kolejne przyspieszenie: dane drzew i postaci idą do karty graficznej raz zamiast kilka razy na klatkę.', 'Ślady stóp na śniegu nie spowalniają już gry przy chodzeniu wielu ludzi.', 'Grupy wojska 1–0 przeniesione do lewego dolnego rogu.'], en: ['Another speed-up: tree and character data now goes to the graphics card once instead of several times per frame.', 'Footprints in the snow no longer slow the game down when many people walk about.', 'Army groups 1–0 moved to the bottom-left corner.'] },
  { v: '0.94.82', date: '2026-11-07', pl: ['Duże przyspieszenie grafiki: gra wysyłała co klatkę te same dane lasu i postaci do karty graficznej po kilkanaście razy. Teraz tylko wtedy, gdy coś się zmieni — na laptopie z RTX 3050 z ok. 40 do ok. 85 klatek na sekundę, wygląd bez zmian.'], en: ['A big graphics speed-up: every frame the game sent the same forest and character data to the graphics card a dozen times over. Now it is only sent when something changes — on a laptop with an RTX 3050 from about 40 to about 85 frames per second, with no change in looks.'] },
  { v: '0.94.81', date: '2026-11-07', pl: ['Las rysuje się dużo lżej: pełne korony drzew tylko blisko kamery, dalej obrazki drzew — wyraźnie więcej klatek na sekundę, zwłaszcza na laptopach.', 'Automatyczna grafika nie psuje już obrazu co kilka sekund: obniża jakość dopiero przy wyraźnym przycinaniu i nigdy poniżej średniego poziomu (cienie i drzewa zostają).', 'Gdy przeglądarka liczy grę na słabszej karcie wbudowanej w procesor, menu raz podpowie, jak przełączyć ją na mocniejszą kartę graficzną.', 'Górny pasek: ikony zamiast napisów przy tempie, podatkach i racjach, mniejsze przyciski.', 'Menu w trakcie gry: napis „Gra wstrzymana” równo z przyciskami.', 'Woda odbija mniej drobiazgów, a ryby rysują się tylko w pobliżu widoku.'], en: ['The forest is far lighter to draw: full tree crowns only near the camera, painted tree images further away — clearly more frames per second, especially on laptops.', 'Automatic graphics no longer degrade the picture every few seconds: quality drops only on clear stutter and never below medium (shadows and trees stay).', 'When the browser runs the game on the weaker graphics built into the processor, the menu explains once how to switch it to the stronger card.', 'Top bar: icons instead of words for speed, taxes and rations, with smaller buttons.', 'In-game menu: the “Game paused” banner lines up with the buttons.', 'Water reflects fewer small things and fish are only drawn near the view.'] },
  { v: '0.94.80', date: '2026-11-07', pl: ['Klimat krain: na Północy zima trwa cały rok (śnieg, mróz, opał potrzebny zawsze), a Step i Pustynia nie znają zimy — ich rok to wiosna, lato i jesień.', 'Na Pustyni i Stepie szczyty gór nie mają już śniegu.', 'Na Północy leśnicy sadzą drzewa mimo zimy, więc tajga odrasta.', 'Jaśniejszy, miększy obraz w dzień: mocniejsze światło nieba, łagodniejsze cienie i kontrast, żywsze barwy, słabiej przyciemnione rogi ekranu.', 'Ludzie ruszają i zatrzymują się płynnie, biodra skręcają za krokiem, a na stojąco widać lekki oddech.'], en: ['Land climates: in the North winter lasts all year (snow, frost and firewood always needed), while the Steppe and the Desert never see winter — their year is spring, summer and autumn.', 'Mountain peaks in the Desert and on the Steppe no longer carry snow.', 'In the North foresters plant even in winter, so the taiga grows back.', 'A brighter, softer picture by day: stronger skylight, gentler shadows and contrast, livelier colours and lighter screen corners.', 'Folk start and stop walking smoothly, their hips turn with each step, and you can see them breathe while standing.'] },
  { v: '0.94.79', date: '2026-11-07', pl: ['Nowa gra w nowym wyglądzie: wybór trybu, poziomu i krainy w panelu po lewej (z przewijaniem), a po prawej cała wygenerowana mapa.', 'Krainy mają duże, malowane pejzaże: Łęgi, Wyżyna, Step, Północ, Pustynia i mapa z kośćmi dla losowej.', 'Sekcje da się zwijać kliknięciem w nagłówek; opcje dla twórców schowane w „Zaawansowane”.', 'Napis „Generuję mapę…” stoi na środku widocznej mapy.', 'Menu główne: przyciski równo z kartą gracza z lewej i prawej.', 'Górny pasek (Tempo, Podatki, Racje) nie wychodzi już poza ekran.'], en: ['A fresh New Game screen: mode, difficulty and land are chosen in a scrollable panel on the left, with the whole generated map shown on the right.', 'Lands now have large painted landscapes: Floodplains, Highlands, Steppe, North, Desert, and a map with dice for a random land.', 'Sections fold away with a click on their heading; creator options live under “Advanced”.', '“Generating the map…” now sits in the middle of the visible map.', 'Main menu: buttons line up with the player card on both sides.', 'The top bar (Speed, Taxes, Rations) no longer runs off the screen.'] },
  { v: '0.94.78', date: '2026-11-07', pl: ['Nowy poziom grafiki „Wydajna” w Ustawieniach: cienie 2048 bez AO, szybkie wygładzanie, rozdzielczość dopasowuje się sama. Najwięcej klatek na sekundę.', 'Ścinane drzewo przewraca się płynnie, bez zacinania (do karty trafia tylko to jedno drzewo, a nie cały las).', 'Ekran wczytywania rozgrzewa grafikę z kilku stron i odległości, żeby pierwsze okrążenie kamery mniej szarpało.', 'Odbicie w wodzie pomija wnętrza i drobiazgi budynków, więc woda kosztuje mniej.', 'Obraz odrobinę jaśniejszy, a drobne napisy w menu i księgach mają co najmniej 14 px.'], en: ['A new “Performance” graphics level in Settings: 2048 shadows without AO, fast anti-aliasing, resolution that adjusts itself. The most frames per second.', 'A felled tree now topples smoothly, without stutter (only that one tree is sent to the graphics card, not the whole forest).', 'The loading screen now warms up the graphics from several sides and distances, so the first camera lap stutters less.', 'Water reflections skip building interiors and small props, so water costs less.', 'The picture is a little brighter, and small texts in the menu and books are at least 14 px.'] },
  { v: '0.94.77', date: '2026-11-07', pl: ['Menu główne: pozycje są teraz prawdziwymi przyciskami z ikonami w ramce, równo ułożonymi po lewej. Lista nie wchodzi już pod kartę konta, także w pauzie w grze.', 'U góry menu zostało samo, większe logo; podtytuł i opis gry są w Ustawienia → Interfejs.', 'Karta „Gość” na dole menu jest ładniejsza: tarcza, dwa równe przyciski „Zaloguj się” i „Załóż konto”.', 'Tło menu i ekranu wczytywania losuje się: świt, zmierzch albo noc. Gdy masz zapis, w rogu menu pokazuje się „Twoja ostatnia osada”.', 'Zapis gry robi miniaturę z góry na całą osadę, więc widać na niej budynki.'], en: ['Main menu: the entries are now proper buttons with framed icons, neatly aligned on the left. The list no longer slides under the account card, also in the in-game pause menu.', 'The top of the menu now shows just a bigger logo; the subtitle and game description moved to Settings → Interface.', 'The “Guest” card at the bottom of the menu looks better: a shield and two equal “Sign in” and “Create account” buttons.', 'The menu and loading screen backgrounds are random: dawn, dusk or night. If you have a save, “Your last settlement” shows in the corner of the menu.', 'Saving takes a thumbnail from above, showing your whole settlement with its buildings.'] },
  { v: '0.94.76', date: '2026-11-07', pl: ['Nowe logo „Project-1”: złoty napis w średniowiecznym kroju z czerwoną tarczą i cyfrą 1, na ekranie wczytywania i w menu głównym.'], en: ['New “Project-1” logo: a golden wordmark in a medieval typeface with a red shield bearing the numeral 1, on the loading screen and in the main menu.'] },
  { v: '0.94.75', date: '2026-11-07', pl: ['Wydajność: z oddalenia drobiazgi w budynkach (wnętrza, zapasy, pochodnie, sufity) nie rzucają cieni, więc mapa cieni rysuje się szybciej.', 'Dynamiczna rozdzielczość jest domyślnie włączona: gdy karta nie wyrabia, obraz chwilowo jest mniejszy, a potem wraca do pełnej ostrości (do wyłączenia w Ustawieniach).'], en: ['Performance: from a distance, small things inside buildings (interiors, stores, torches, ceilings) no longer cast shadows, so the shadow map draws faster.', 'Dynamic resolution is now on by default: when your graphics card cannot keep up the picture is briefly smaller and then returns to full sharpness (can be switched off in Settings).'] },
  { v: '0.94.74', date: '2026-11-07', pl: ['Kamera w grze nie zbliża się już tak bardzo (najmniejsza odległość 9 zamiast 4).', 'Spacer: pochodnia w ręce cofa się przy ścianie i nie wchodzi w budynek.'], en: ['The in-game camera no longer zooms in so far (minimum distance 9 instead of 4).', 'Walk mode: the hand torch pulls back near a wall and no longer pokes through the building.'] },
  { v: '0.94.73', date: '2026-11-07', pl: ['Ekran wczytywania: rady zmieniają się same co 5 sekund, a strzałkami ‹ › albo klawiszami ← → przewijasz je jak w suwaku.'], en: ['Loading screen: tips rotate by themselves every 5 seconds, and you can flick through them with the ‹ › arrows or the ← → keys like a slider.'] },
  { v: '0.94.72', date: '2026-11-07', pl: ['Menu: „Kontynuuj” wczytuje zawsze najnowszy zapis (pomija tylko zakończone mecze online).', 'Ekran wczytywania: rada nie zmienia się w trakcie wczytywania.'], en: ['Menu: “Continue” always loads your newest save (it only skips finished online matches).', 'Loading screen: the tip no longer changes while the game loads.'] },
  { v: '0.94.71', date: '2026-11-07', pl: ['Menu budowy: miniatury budynków nie rysują się już od nowa po każdej nowej wersji gry, więc karty nie świecą pustką. Rysują się raz, a potem tylko gdy zmieni się wygląd budynków.'], en: ['Build menu: building thumbnails are no longer redrawn after every new game version, so the cards no longer sit empty. They are drawn once and again only when the buildings actually change.'] },
  { v: '0.94.70', date: '2026-11-07', pl: ['Jedna, lżejsza i czytelniejsza czcionka w całej grze (Inter) zamiast mieszanki dekoracyjnych krojów i ciężkich pogrubień.'], en: ['One lighter, more readable typeface throughout the game (Inter) instead of a mix of decorative fonts and heavy bold weights.'] },
  { v: '0.94.69', date: '2026-11-07', pl: ['Dolny pasek pokazuje tylko najważniejsze zapasy: rudę, drewno, kamień i jedzenie razem. Przycisk „…” otwiera na środku okno ze spisem wszystkich surowców, ich ilością i zmianą na minutę.'], en: ['The bottom bar now shows only the key supplies: ore, wood, stone and total food. The “…” button opens a window in the middle of the screen listing every resource with its amount and change per minute.'] },
  { v: '0.94.68', date: '2026-11-07', pl: ['Dolny pasek: zapasy nie nachodzą już na siebie. Pasek sam przelicza, ile kafelków się mieści, gdy liczby rosną, a reszta chowa się pod przyciskiem „…”.'], en: ['Bottom bar: supplies no longer overlap. The bar re-fits itself as the numbers grow, and whatever does not fit tucks away under the “…” button.'] },
  { v: '0.94.67', date: '2026-11-07', pl: ['Ekran wczytywania: większy procent na pasku.'], en: ['Loading screen: a bigger percentage on the bar.'] },
  { v: '0.94.66', date: '2026-11-07', pl: ['Grafika: zmiana AO, wygładzania albo poświaty w trakcie gry nie wywala już błędu „efekty obrazu wyłączone”; efekty przebudowują się od razu.'], en: ['Graphics: changing AO, anti-aliasing or bloom while playing no longer throws the “image effects disabled” error; the effects rebuild straight away.'] },
  { v: '0.94.65', date: '2026-11-07', pl: ['Numer wersji gry jest większy i ładniejszy: złota ramka, jasne litery, widoczny na ekranie wczytywania i w menu.'], en: ['The game version number is bigger and nicer: a gold frame and bright lettering, visible on the loading screen and in the menu.'] },
  { v: '0.94.64', date: '2026-11-07', pl: ['Ekran wczytywania: rada zajmuje całą szerokość, równo z paskiem, a procent jest na samym pasku.', 'Menu: wysokie okna (np. Wczytaj grę) nie nachodzą już na przyciski Znajomi i dzwonek.'], en: ['Loading screen: the tip now spans the full width, flush with the bar, and the percentage sits on the bar itself.', 'Menu: tall windows such as Load Game no longer overlap the Friends and bell buttons.'] },
  { v: '0.94.63', date: '2026-11-07', pl: ['Zapisy: usunięty zapis z chmury znika na dobre i nie wraca już na listę po kilku sekundach.'], en: ['Saves: a save deleted from the cloud is gone for good and no longer creeps back onto the list a few seconds later.'] },
  { v: '0.94.62', date: '2026-11-07', pl: ['Zbóje w obozie nie stoją już w miejscu. Obchodzą obóz, przystają przy palisadzie, wracają do ogniska i znów ruszają.'], en: ['Brigands no longer stand idle in their camp. They prowl around it, linger by the palisade, drift back to the fire and set off again.'] },
  { v: '0.94.61', date: '2026-11-07', pl: ['Wczytywanie: na dużej osadzie gra nie startuje już z samymi cieniami budynków. Ekran wczytywania czeka, aż karta graficzna przygotuje wszystkie budynki.'], en: ['Loading: a large settlement no longer starts with only the shadows of its buildings. The loading screen waits until your graphics card has every building ready.'] },
  { v: '0.94.60', date: '2026-11-07', pl: ['Grafika: zniknęło ustawienie „Skala”. Obraz liczy się teraz w naturalnej rozdzielczości ekranu, bez ciężkiego nadpróbkowania 1,25×, więc jest wyraźnie więcej klatek na sekundę.'], en: ['Graphics: the “Scale” setting is gone. The picture now renders at your screen’s natural resolution, without the heavy 1.25× supersampling, so you get noticeably more frames per second.'] },
  { v: '0.94.59', date: '2026-11-07', pl: ['Tester wydajności: w spacerze postać naprawdę idzie i skacze, a budowa idzie w zwykłym tempie gry.'], en: ['Performance tester: on the walk your character now truly strides and leaps, and building runs at the usual pace of the game.'] },
  {
    v: '0.94.58', date: '2026-11-07',
    pl: ['Dla twórców: automatyczny test gry (budowa osady w dzień, przeloty kamery, przybliżanie, spacer) z raportem płynności.'],
    en: ['For developers: an automated game run (building a settlement by day, camera flights, zooming, a walk) with a smoothness report.'],
  },
  {
    v: '0.94.57', date: '2026-11-07',
    pl: ['Płynniej z daleka: najdalsze wersje budynków rysują się jedną bryłą zamiast kilku, a zboże w spichlerzach i uprawy na polach razem dla wszystkich budynków.'],
    en: ['Smoother from afar: the most distant building versions are drawn as a single mesh instead of several, and granary grain and field crops are drawn together for all buildings.'],
  },
  {
    v: '0.94.56', date: '2026-11-07',
    pl: ['Płynniej w dużej osadzie: zapasy w składach i drobiazgi na podwórkach rysują się razem dla wszystkich budynków, a nie osobno.'],
    en: ['Smoother in a big settlement: stock piles and yard clutter are drawn together for all buildings instead of one by one.'],
  },
  {
    v: '0.94.55', date: '2026-11-07',
    pl: ['Płynniej: kamyki na łąkach z 8 kształtów zamiast 23 (dalej różnie obrócone i w różnej wielkości), mniej osobnych rysowań.'],
    en: ['Smoother: meadow pebbles use 8 shapes instead of 23 (still varied in rotation and size), fewer separate draws.'],
  },
  {
    v: '0.94.54', date: '2026-11-07',
    pl: ['Płynniej z daleka: kamyki, krzewy, podszyt, kępy trawy, kwiaty i trzcina rzucają cień tylko przy bliższej kamerze.'],
    en: ['Smoother from afar: pebbles, shrubs, undergrowth, grass tufts, flowers and reeds cast shadows only when the camera is closer.'],
  },
  {
    v: '0.94.53', date: '2026-11-07',
    pl: ['Szybsze rysowanie postaci włączone dla wszystkich (po staremu: ?nopb=1 w adresie).'],
    en: ['Faster character drawing is now on for everyone (the old way: add ?nopb=1 to the address).'],
  },
  {
    v: '0.94.52', date: '2026-11-07',
    pl: ['Szybsze rysowanie postaci do wypróbowania (dopisek ?pb=1 w adresie gry); domyślnie po staremu, dopóki nie sprawdzimy wyglądu.'],
    en: ['Faster character drawing available to try (add ?pb=1 to the game address); off by default until the look is confirmed.'],
  },
  {
    v: '0.94.51', date: '2026-11-07',
    pl: ['Naprawione wczytywanie gry: cofnięte łączenie części postaci z 0.94.50, przez które gra nie startowała.'],
    en: ['Fixed game loading: rolled back the character part merging from 0.94.50 that stopped the game from starting.'],
  },
  {
    v: '0.94.50', date: '2026-11-07',
    pl: ['Szybciej: postacie rysują się w kilku kawałkach zamiast kilkunastu (części ubrania tego samego rodzaju razem), z tym samym wyglądem i ruchem.'],
    en: ['Faster: characters are drawn in a few pieces instead of a dozen or more (matching clothing parts together), with the same look and movement.'],
  },
  {
    v: '0.94.49', date: '2026-11-07',
    pl: [
      'Naprawiony zastygły obraz po kilku minutach gry (kamera się ruszała, a obraz stał): po zniknięciu wozu albo znacznika gra niszczyła dane, z których dalej korzystali ludzie i budynki.',
      'Autozapis co 5 minut zamiast co 3.',
    ],
    en: [
      'Fixed the picture freezing after a few minutes of play (the camera moved but the image stood still): when a cart or marker vanished, the game destroyed data still used by people and buildings.',
      'Autosave every 5 minutes instead of 3.',
    ],
  },
  {
    v: '0.94.48', date: '2026-11-07',
    pl: [
      'Płynniej: szybki zapis co minutę i w wolnej chwili przeglądarki zamiast co 15 sekund w środku gry.',
      'Płynniej z daleka: ludzie, zwierzęta i drobiazgi na podwórkach rzucają cień tylko przy bliższej kamerze. Budynki, drzewa i mury rzucają go zawsze.',
    ],
    en: [
      'Smoother: the quick save runs once a minute when the browser is idle, instead of every 15 seconds mid-game.',
      'Smoother from afar: people, animals and yard clutter cast shadows only when the camera is closer. Buildings, trees and walls always cast them.',
    ],
  },
  {
    v: '0.94.47', date: '2026-11-06',
    pl: [
      'Cienie nie mrugają przy przesuwaniu widoku: dalekie budynki też rzucają cień, a nie gubią go na granicy odległości.',
      'Cienie nie przeskakują przy przybliżaniu: zamiast kilkunastu stopni dokładności są dwa, blisko i daleko.',
    ],
    en: [
      'Shadows no longer flicker when panning: distant buildings cast shadows too instead of losing them at a distance threshold.',
      'Shadows no longer jump while zooming: two quality steps, near and far, instead of a dozen.',
    ],
  },
  {
    v: '0.94.46', date: '2026-11-06',
    pl: [
      'Wczytywanie czeka, aż przygotują się wszystkie budynki w kadrze: gra nie startuje już z samymi cieniami zamiast budynków.',
      'Cienie liczą się raz na klatkę zamiast dwa razy przy wodzie w kadrze: płynniejszy ruch kamery.',
    ],
    en: [
      'Loading now waits until every building in view is ready: the game no longer starts with shadows but no buildings.',
      'Shadows are computed once per frame instead of twice with water in view: smoother camera movement.',
    ],
  },
  {
    v: '0.94.45', date: '2026-11-06',
    pl: [
      'Spacer: prawdziwy skok i spadanie. Wskoczysz na dach, przejdziesz po nim, przeskoczysz na sąsiedni i zeskoczysz; z urwiska czy skały da się zejść albo spaść, pod górę dalej się nie wespniesz.',
      'Kosze ogniowe w zamku: zamiast pomarańczowych stożków żar z węgli i szczap, a po zmroku płonie w nich żywy ogień.',
    ],
    en: [
      'Walking: real jumping and falling. Leap onto a roof, cross it, jump to the next one and drop down; you can step or fall off cliffs and crags, though you still cannot climb up them.',
      'Castle braziers: glowing coals and kindling instead of orange cones, with live fire after dark.',
    ],
  },
  {
    v: '0.94.44', date: '2026-11-06',
    pl: ['Pochodnia w ręce: płomień nie rozpada się już na płaskie kliny, gdy obracasz się albo ruszasz pochodnią.'],
    en: ['Torch in hand: the flame no longer breaks into flat wedges when you turn or swing the torch.'],
  },
  {
    v: '0.94.43', date: '2026-11-06',
    pl: ['Gra działa już tylko na nowym silniku grafiki WebGPU; stary WebGL usunięty.'],
    en: ['The game now runs only on the new WebGPU graphics engine; the old WebGL renderer has been removed.'],
  },
  {
    v: '0.94.42', date: '2026-11-06',
    pl: ['Koniec czarnych kresek na górach przy krawędzi mapy: skała na górnym i lewym brzegu mapy ma znów poprawne światło.'],
    en: ['No more black streaks on the mountains along the map edge: rock on the top and left borders is lit properly again.'],
  },
  {
    v: '0.94.41', date: '2026-11-06',
    pl: ['Ogień pochodni, ognisk i pożarów z bliska (np. w spacerze) jest pełnym płomieniem zamiast płaskich, ostro uciętych klinów.'],
    en: ['Torch, campfire and blaze flames seen up close (e.g. on foot) are now full flames instead of flat, sharply clipped wedges.'],
  },
  {
    v: '0.94.40', date: '2026-11-06',
    pl: [
      'Nowy kamień murów zamku: zdjęciowa tekstura w wysokiej rozdzielczości, kamienie w prawdziwej wielkości obok ludzi, bez czarnych fug i białych plam.',
      'Od strony morza góry łagodnie schodzą do wydm zamiast urywać się nad plażą.',
      'Stodoła: stosy desek i kamienia nie wchodzą już jeden w drugi.',
    ],
    en: [
      'New castle wall stone: a high-resolution photo texture, stones at true size next to people, without black joints and white blotches.',
      'On the seaward side the mountains now slope gently down to the dunes instead of breaking off above the beach.',
      'Barn: piles of planks and stone no longer sink into one another.',
    ],
  },
  {
    v: '0.94.39', date: '2026-11-06',
    pl: ['Obóz zbójów: nad ogniskiem piecze się prosiak na rożnie zamiast chleba.'],
    en: ['Bandit camp: a piglet now roasts on the spit over the fire instead of bread.'],
  },
  {
    v: '0.94.38', date: '2026-11-06',
    pl: ['Obóz zbójów: bochenki są nadziane na rożen nad ogniskiem, zamiast wisieć w powietrzu obok niego.'],
    en: ['Bandit camp: the loaves are skewered on the spit over the fire instead of floating in the air next to it.'],
  },
  {
    v: '0.94.37', date: '2026-11-06',
    pl: ['Kamienie w murach większe i wyraźniejsze — z daleka nie zlewają się w szum.'],
    en: ['Stones in the walls are bigger and clearer — they no longer blur into noise from afar.'],
  },
  {
    v: '0.94.36', date: '2026-11-06',
    pl: ['Menu główne: nazwa gry obok herbu zawsze mieści się w lewym panelu, także na szerokich i niskich ekranach.'],
    en: ['Main menu: the game title next to the crest always fits in the left panel, also on wide and short screens.'],
  },
  {
    v: '0.94.35', date: '2026-11-06',
    pl: ['Nowe tekstury ze zdjęć: kamień murów zamku i baszt (nieregularne, ciosane bloki) oraz strzecha dachów z prawdziwej trzciny.'],
    en: ['New photo textures: the stone of castle walls and towers (rough, hand-cut blocks) and thatched roofs made from real reed.'],
  },
  {
    v: '0.94.34', date: '2026-11-06',
    pl: ['Wczytanie dużego zapisu: ekran wczytywania czeka, aż karta graficzna przygotuje budynki z widoku startowego — koniec z samymi cieniami bez budynków przez pierwsze chwile.'],
    en: ['Loading a large save: the loading screen waits until the GPU has prepared the buildings in the starting view — no more shadows without buildings for the first moments.'],
  },
  {
    v: '0.94.33', date: '2026-11-05',
    pl: ['Szybciej przy dużej osadzie: cienie budynków widocznych z daleka liczą się jedną bryłą na rodzaj budynku zamiast kilku na każdy budynek.'],
    en: ['Faster in a large settlement: shadows of buildings seen from afar are computed as one shape per building type instead of several per building.'],
  },
  {
    v: '0.94.32', date: '2026-11-05',
    pl: ['Z powrotem nowy silnik grafiki WebGPU (już bez pustego ekranu i błędów obrazu); stary zostaje pod ?webgl=1.'],
    en: ['Back to the new WebGPU graphics engine (now without the blank screen and picture errors); the old one stays under ?webgl=1.'],
  },
  {
    v: '0.94.31', date: '2026-11-05',
    pl: ['Gra wraca na sprawdzony silnik grafiki (WebGL): koniec z pustym ekranem, znikającymi i nachodzącymi na siebie budynkami. Nowy silnik WebGPU tylko na próbę.', 'Szyby w oknach budynku rysują się razem — mniej pracy przy dużej osadzie; najdalsze wersje budynków nie rzucają już cienia.'],
    en: ['The game is back on the proven graphics engine (WebGL): no more blank screen or buildings vanishing and overlapping. The new WebGPU engine is only for testing.', 'Window panes of a building are drawn together — less work in a large settlement; the most distant versions of buildings no longer cast shadows.'],
  },
  {
    v: '0.94.30', date: '2026-11-05',
    pl: ['Narzędzie do szukania spadków płynności: spis tego, co rysuje się w jednej klatce, dostępny także w zwykłej grze (dla twórców).'],
    en: ['A tool for hunting frame-rate drops: a breakdown of what gets drawn in one frame, now available in a normal game too (for developers).'],
  },
  {
    v: '0.94.29', date: '2026-11-05',
    pl: ['WebGPU: znowu wspólne shadery dla budynków, kamieni i innych zwykłych obiektów — mniej przycinania i znikania budynków przy przybliżaniu kamery, bez błędu, który psuł obraz (drzewa na wietrze na razie osobno).'],
    en: ['WebGPU: shared shaders are back for buildings, rocks and other plain objects — less stutter and fewer buildings vanishing while zooming in, without the bug that broke the picture (trees swaying in the wind stay separate for now).'],
  },
  {
    v: '0.94.28', date: '2026-11-05',
    pl: ['Zabezpieczenie grafiki WebGPU: grupa obiektów z uszkodzonym buforem znika na chwilę zamiast wyłączać cały obraz, a dziennik błędów zapisuje, która to była.'],
    en: ['WebGPU graphics safeguard: a group of objects with a broken buffer disappears briefly instead of blanking the whole picture, and the error log records which group it was.'],
  },
  {
    v: '0.94.27', date: '2026-11-05',
    pl: ['Naprawiony pusty ekran po wczytaniu gry na WebGPU: obraz pokazuje się od razu, a budynki i drzewa dochodzą w tle, zamiast czekać, aż karta graficzna przygotuje całą grafikę.'],
    en: ['Fixed the blank screen after loading a game on WebGPU: the picture shows up right away and buildings and trees fill in in the background, instead of waiting until the GPU has prepared all the graphics.'],
  },
  {
    v: '0.94.26', date: '2026-11-05',
    pl: ['Mniej czerwonych błędów w konsoli przeglądarki: częściowo pobrane pliki (np. dźwięki) nie trafiają już do pamięci podręcznej gry.'],
    en: ['Fewer red errors in the browser console: partially downloaded files (such as sounds) no longer go into the game cache.'],
  },
  {
    v: '0.94.25', date: '2026-11-04',
    pl: ['Pusty ekran na WebGPU naprawiony inaczej: wyłączone wspólne shadery dla pul obiektów, przez które karta odrzucała klatki. Pierwsze sekundy w nowym miejscu mapy mogą chwilę dłużej doczytywać grafikę.'],
    en: ['Blank screen on WebGPU fixed another way: shared shaders for object pools, which made the GPU reject frames, are turned off. The first seconds in a new part of the map may take a little longer to load graphics.'],
  },
  {
    v: '0.94.24', date: '2026-11-04',
    pl: ['Naprawiony pusty ekran (samo tło) na WebGPU po chwili gry: jedna z pul obiektów rysowała się ze złym buforem i karta odrzucała całą klatkę.'],
    en: ['Fixed a blank screen (background only) on WebGPU after a while in game: one object pool was drawn with the wrong buffer and the GPU rejected the whole frame.'],
  },
  {
    v: '0.94.23', date: '2026-11-04',
    pl: [
      'Przegląd kodu i poprawki błędów: wczytany zapis z rozbitym murem albo bramą ma wyłom tam, gdzie był (wcześniej mur „odrastał” po wczytaniu).',
      'Po wygranej albo przegranej grze online „Kontynuuj” nie wraca już do skończonej bitwy, a doświadczenie liczy się z właściwego trybu gry.',
      'Łucznicy na wysokich basztach widzą i strzelają na pełny zasięg (wcześniej nie zauważali wrogów dalej niż ok. 8 pól).',
      'Esc w okienkach (powiadomienia, wiadomości, znajomi) zamyka tylko okienko, a nie całe menu.',
      'Gra online: po chwilowym zerwaniu sieci powrót do meczu proponuje ponowną próbę zamiast zapominać o meczu; spóźnione albo podwójne paczki ruchów nie psują już tury.',
      'Zapisy: chmura i zapis w przeglądarce nie zawieszają się przy błędzie sieci albo zablokowanej bazie, a uszkodzony spis zapisów w chmurze nie wywraca listy.',
      'Grafika: drzewa z daleka przełączają się na lżejszą wersję, mniej pracy przy wielu stojących żołnierzach, gruzowiskach i pożarach, a stare dane nie przechodzą na nową mapę (fałszywe pożary i wstrząsy po wczytaniu).',
      'Brakujące opisy zajęć chłopów (grzebanie zmarłych, niesienie trumny) w obu językach.',
    ],
    en: [
      'Code review and bug fixes: a loaded save with a broken wall or gate keeps its breach (walls used to "grow back" after loading).',
      'After winning or losing an online game, "Continue" no longer takes you back to the finished battle, and experience is counted for the right game mode.',
      'Archers on tall towers now see and shoot at their full range (they used to miss foes further than about 8 tiles away).',
      'Esc in pop-ups (notifications, messages, friends) closes just the pop-up, not the whole menu.',
      'Online play: after a brief network drop, rejoining offers a retry instead of forgetting the match; late or duplicate move packets no longer spoil a turn.',
      'Saves: cloud and browser saves no longer hang on network errors or a blocked database, and a damaged cloud save index no longer breaks the list.',
      'Graphics: distant trees switch to their lighter version, less work with many idle soldiers, rubble and fires, and stale data no longer carries over to a new map (phantom fires and shakes after loading).',
      'Missing descriptions of peasant tasks (burying the dead, carrying a coffin) in both languages.',
    ],
  },
  {
    v: '0.94.22', date: '2026-11-03',
    pl: ['Drzewa, palmy i krzaki na wietrze też korzystają ze wspólnych shaderów — mniej doczytywania przy przelocie nad lasem.'],
    en: ['Trees, palms and bushes swaying in the wind share shaders too — less streaming when flying over forests.'],
  },
  {
    v: '0.94.21', date: '2026-11-03',
    pl: ['Stodoła otwiera dach jak inne budynki, gdy ktoś w niej pracuje — widać zapasy na klepisku.'],
    en: ['The barn opens its roof like other buildings while someone works inside — you can see the stores on the floor.'],
  },
  {
    v: '0.94.20', date: '2026-11-03',
    pl: [
      'Szybsze doczytywanie przy przelocie kamerą: kawałki lasu, kamienie i budynki tego samego rodzaju korzystają ze wspólnych shaderów, więc obiekty i ich cienie nie „doładowują się” po kolei.',
      'Cienie chmur na ziemi miękkie i lżejsze (bez ostrych, ciemnych plam).',
      'Kłęby mgły przy szczytach gór jaśniejsze i z miękkim brzegiem.',
    ],
    en: [
      'Faster streaming when the camera flies around: chunks of forest, rocks and buildings of one kind share shaders, so objects and their shadows no longer pop in one by one.',
      'Cloud shadows on the ground are soft and lighter (no sharp dark patches).',
      'Mist puffs around mountain peaks are lighter with soft edges.',
    ],
  },
  {
    v: '0.94.19', date: '2026-11-03',
    pl: ['Koniec z ciemnymi rombami i prostokątami na ziemi wokół dymu i pożarów: cieniowanie zagłębień liczy się teraz tylko z prawdziwych brył, a przełączenie go w ustawieniach nie przeładowuje już całej grafiki.'],
    en: ['No more dark diamonds and rectangles on the ground around smoke and fires: ambient occlusion now comes from solid geometry only, and toggling it in the settings no longer reloads all the graphics.'],
  },
  {
    v: '0.94.18', date: '2026-11-03',
    pl: ['Na najwyższej jakości (z cieniowaniem zagłębień) krawędzie znów są wygładzone — wcześniej na nowym silniku nie było wtedy żadnego wygładzania.'],
    en: ['At the highest quality (with ambient occlusion) edges are smooth again — previously the new engine applied no anti-aliasing at all in that case.'],
  },
  {
    v: '0.94.17', date: '2026-11-03',
    pl: [
      'Ogniska i pochodnie znów mają pomarańczowy płomień (był zielony).',
      'Bez prostokątów wokół ognia, dymu i pożarów — ani ciemnych, ani jaśniejszych.',
      'Cienie chmur łagodniejsze, a w salach i w kopalni ich nie ma; we wnętrzach jaśniej.',
    ],
    en: [
      'Campfires and torches have an orange flame again (it was green).',
      'No more rectangles around fire, smoke and burning buildings — neither dark nor bright.',
      'Cloud shadows are softer and absent inside halls and mines; interiors are brighter.',
    ],
  },
  {
    v: '0.94.16', date: '2026-11-03',
    pl: ['Wczytywanie gry na nowym silniku nie zatrzymuje już filmu ani innych kart: karta graficzna kompiluje najwyżej kilka shaderów naraz zamiast kilkudziesięciu.'],
    en: ['Loading the game on the new engine no longer freezes a video or other tabs: the graphics card compiles at most a few shaders at once instead of dozens.'],
  },
  {
    v: '0.94.15', date: '2026-11-03',
    pl: ['Gęstsza siatka terenu przy kamerze wyłączona do poprawki: jej kwadrat był jaśniejszy od reszty ziemi i mrugał przy pożarach.'],
    en: ['The denser terrain mesh near the camera is switched off until fixed: its square was brighter than the rest of the ground and flickered during fires.'],
  },
  {
    v: '0.94.14', date: '2026-11-03',
    pl: [
      'Naprawiony błąd z 0.94.12: dolna połowa ekranu wyglądała jak pod wodą, a gra mocno zwalniała. Widok spod wody włącza się już tylko pod wodą.',
      'Cienie chmur na nowym silniku leżą tam, gdzie trzeba.',
      'Po zmianie ustawień grafiki budynki wracają po chwili, a nie po długim czasie.',
    ],
    en: [
      'Fixed a 0.94.12 bug: the lower half of the screen looked as if under water and the game slowed down badly. The underwater view now only appears under water.',
      'Cloud shadows on the new engine fall where they should.',
      'After changing graphics settings, buildings come back after a moment rather than after a long wait.',
    ],
  },
  {
    v: '0.94.13', date: '2026-11-03',
    pl: ['Gładszy teren przy kamerze: wokół widoku ziemia ma trzy razy gęstszą siatkę i łagodnie zaokrąglone pagórki zamiast płaskich, kanciastych trójkątów — najbardziej widać to w spacerze i na zboczach. Ludzie i zwierzęta chodzą po tym, co widać.'],
    en: ['Smoother ground near the camera: around the view the terrain has a mesh three times denser and gently rounded hills instead of flat, angular triangles — most visible in walking view and on slopes. People and animals walk on what you see.'],
  },
  {
    v: '0.94.12', date: '2026-11-03',
    pl: ['Na nowym silniku place budowy nie przycinają już gry: rosnący budynek nie składa za każdym razem od nowa wszystkich swoich shaderów (wcześniej kilkaset składań na 10 sekund i spadek do ok. 28 FPS, gdy w osadzie trwały budowy).'],
    en: ['On the new engine, construction sites no longer stutter the game: a rising building does not rebuild all its shaders every time (previously several hundred rebuilds per 10 seconds and a drop to about 28 FPS while building was going on).'],
  },
  {
    v: '0.94.11', date: '2026-11-03',
    pl: ['Na nowym silniku place budowy nie przycinają już gry: rosnący budynek nie składa za każdym razem od nowa wszystkich swoich shaderów (wcześniej kilkaset składań na 10 sekund i spadek do ok. 28 FPS, gdy w osadzie trwały budowy).'],
    en: ['On the new engine, construction sites no longer stutter the game: a rising building does not rebuild all its shaders every time (previously several hundred rebuilds per 10 seconds and a drop to about 28 FPS while building was going on).'],
  },
  {
    v: '0.94.10', date: '2026-11-03',
    pl: ['Naprawiony błąd z 0.94.9, przez który gra się nie wczytywała.', 'Na nowym silniku obraz jest jaśniejszy: cień w zagłębieniach (AO) przyciemniał całą scenę — mury, trawę i dachy — a teraz zostaje tylko w kątach i szczelinach.'],
    en: ['Fixed the 0.94.9 bug that stopped the game from loading.', 'The picture is brighter on the new engine: ambient occlusion used to darken the whole scene — walls, grass and roofs — and now stays in corners and crevices only.'],
  },
  {
    v: '0.94.9', date: '2026-11-03',
    pl: ['Na nowym silniku wraca głębia kamienia: fugi w murach, łupek, strzecha, bruk i cegła mają prawdziwą wypukłość, a nie tylko namalowany wzór.'],
    en: ['Stone depth is back on the new engine: joints in walls, slate, thatch, cobbles and brick have real relief rather than a painted pattern.'],
  },
  {
    v: '0.94.8', date: '2026-11-03',
    pl: [
      'Cienie już nie mrugają: na nowym silniku cienie ludzi, kamieni i kęp znikały co drugą klatkę.',
      'Niebo w spacerze jest całe — bez okrągłej dziury pośrodku.',
      'Koniec z mlecznym ekranem po kilku minutach gry na nowym silniku.',
      'Stodoła i budynki po niej znów mają podgląd w menu budowy.',
    ],
    en: [
      'Shadows no longer flicker: on the new engine the shadows of people, rocks and tufts vanished every other frame.',
      'The sky in walking view is whole again — no round hole in the middle.',
      'No more milky screen after a few minutes of play on the new engine.',
      'The barn and the buildings after it have their previews in the build menu again.',
    ],
  },
  {
    v: '0.94.7', date: '2026-11-03',
    pl: ['Na nowym silniku obraz z wygładzaniem krawędzi znów ma właściwą jasność — zamek, trawa i woda nie są już ciemne jak o zmierzchu.'],
    en: ['On the new engine, the anti-aliased picture has its proper brightness again — the castle, grass and water no longer look as dark as at dusk.'],
  },
  {
    v: '0.94.6', date: '2026-11-03',
    pl: [
      'Gra nie zostaje już na ekranie wczytywania tuż po wydaniu nowej wersji: gdy przeglądarka trzyma starą stronę, sama wczytuje ją od nowa.',
      'Gdy przeglądarka zwalnia klatki (zasłonięte okno, zajęta karta graficzna), budynki i drzewa i tak dochodzą szybko, a nie po jednym na sekundę.',
    ],
    en: [
      'The game no longer hangs on the loading screen right after a new release: if the browser holds on to the old page, it reloads it by itself.',
      'When the browser slows down frames (covered window, busy graphics card), buildings and trees still appear quickly rather than one per second.',
    ],
  },
  {
    v: '0.94.5', date: '2026-11-03',
    pl: [
      'Gra na nowym silniku wczytuje się szybciej: drzewa, kamienie i budynki tego samego rodzaju dzielą jeden program karty graficznej zamiast kilkuset osobnych.',
      'Woda w oazie jest przejrzysta i turkusowa, a jeziora zielonkawe i jaśniejsze — już nie szare bagno; w tafli widać więcej nieba.',
      'Na skałkach pustyni nie stoją już samotne, ociosane słupy z kamienia — zamiast nich głazy z Sahary.',
    ],
    en: [
      'The game loads faster on the new engine: trees, rocks and buildings of one kind share a single graphics program instead of hundreds of separate ones.',
      'Oasis water is clear and turquoise, and lakes are greener and brighter rather than a grey bog; more of the sky shows on the surface.',
      'Desert crags no longer carry lone hewn stone pillars — Saharan boulders sit there instead.',
    ],
  },
  {
    v: '0.94.4', date: '2026-11-03',
    pl: ['Na nowym silniku wraca odbicie nieba w metalu, szybach, kałużach i mokrych kamieniach.'],
    en: ['On the new engine, metal, windows, puddles and wet stone reflect the sky again.'],
  },
  {
    v: '0.94.3', date: '2026-11-03',
    pl: ['Płynniejsza gra na nowym silniku: odbicie w wodzie pomija drobiazgi, których w tafli i tak nie widać, a cieniowanie zagłębień liczy się w połowie rozdzielczości.'],
    en: ['Smoother play on the new engine: water reflections skip small things you could not see in them anyway, and ambient occlusion is computed at half resolution.'],
  },
  {
    v: '0.94.2', date: '2026-11-03',
    pl: ['Świat nie kończy się kwadratem: za krawędzią mapy ciągną się dalej te same góry, lasy, łąki, jeziora i rzeki co na mapie (a nie równy pas puszczy dookoła), pustynia za mapą to dalej pustynia.'],
    en: ['The world no longer ends in a square: past the map edge the same mountains, forests, meadows, lakes and rivers carry on (instead of an even band of woodland all around), and a desert stays a desert beyond the map.'],
  },
  {
    v: '0.94.1', date: '2026-11-03',
    pl: ['Znacznie szybsze doczytywanie i mniej przycięć na nowym silniku grafiki (tańsze oświetlenie od pochodni i ognisk).', 'Większa mapa 1 na 1: 240 pól zamiast 192, zamki dalej od siebie (dotyczy nowych gier; zapisane gry zostają na swojej mapie).'],
    en: ['Much faster loading and less stutter on the new graphics engine (cheaper lighting from torches and fires).', 'A bigger 1v1 map: 240 tiles instead of 192, keeps further apart (new games only; saved games keep their map).'],
  },
  {
    v: '0.94.0', date: '2026-11-03',
    pl: ['Pustynia ożywa: w oazach rosną palmy daktylowe (można je ścinać na drewno jak las), między wydmami stoją uschnięte palmy i suche krzewy, a piach porastają kępy wysuszonej trawy. Palmy i krzaki kołyszą się na wietrze.', 'Mniej przycięć, gdy na mapie przybywa budynków.'],
    en: ['The desert comes alive: date palms grow in the oases (you can fell them for wood like a forest), dead palms and dry shrubs stand among the dunes, and tufts of parched grass cover the sand. Palms and shrubs sway in the wind.', 'Less stutter as more buildings appear on the map.'],
  },
  {
    v: '0.93.8', date: '2026-11-03',
    pl: ['Wracają cienie chmur sunące po ziemi, dachach i drzewach (liczone jednym przejściem na cały obraz).'],
    en: ['Cloud shadows drifting over the ground, roofs and trees are back (computed in a single pass over the whole image).'],
  },
  {
    v: '0.93.7', date: '2026-11-03',
    pl: ['Naprawiony pusty, beżowy ekran po wczytaniu (niektóre postacie wywracały efekty obrazu, a niebo — całą klatkę).', 'Szybszy start gry: grafika, której nie zdążono przygotować przy wczytywaniu, dochodzi płynnie w pierwszych sekundach gry.', 'Odbicie w wodzie jest tańsze: rysuje tylko to, co widać w tafli, i odświeża się co drugą klatkę.'],
    en: ['Fixed the blank beige screen after loading (some characters broke the image effects, and the sky broke the whole frame).', 'Faster game start: any graphics not ready during loading are added smoothly in the first seconds of play.', 'Water reflections are cheaper: they draw only what shows in the water and refresh every other frame.'],
  },
  {
    v: '0.93.6', date: '2026-11-03',
    pl: ['Wraca dym i para z czarów magów (kłęby z samocieniem, młody dym żarzy się od spodu).'],
    en: ['Smoke and steam from mages’ spells are back (self-shadowed puffs, young smoke glowing from below).'],
  },
  {
    v: '0.93.5', date: '2026-11-03',
    pl: ['Wracają kałuże w deszczu (z kręgami od kropel, wysychają od brzegów) i ślady stóp na śniegu, które z czasem zasypuje.'],
    en: ['Rain puddles are back (with ripples from raindrops, drying from the edges), along with footprints in the snow that slowly fill in.'],
  },
  {
    v: '0.93.4', date: '2026-11-03',
    pl: ['Wracają pory roku na nowym silniku: śnieg na dachach, ziemi i trawie zimą, szron, wiosenna zieleń, rude korony jesienią i gołe drzewa zimą.'],
    en: ['Seasons are back on the new engine: snow on roofs, ground and grass in winter, frost, fresh spring green, russet treetops in autumn and bare trees in winter.'],
  },
  {
    v: '0.93.3', date: '2026-11-03',
    pl: ['Dziennik błędów (F3) pokazuje czasy poszczególnych etapów wczytywania.'],
    en: ['The error log (F3) now shows how long each loading stage took.'],
  },
  {
    v: '0.93.2', date: '2026-11-03',
    pl: ['Krótsze „Przygotowanie grafiki” na nowym silniku (liczy się tylko faktyczna praca, bez czekania).'],
    en: ['Shorter "Preparing the graphics" on the new engine (only real work counts, no idle waiting).'],
  },
  {
    v: '0.93.1', date: '2026-11-03',
    pl: ['Naprawione znikanie ziemi na nowym silniku (gra prosi kartę graficzną o jej pełne możliwości).', 'Wraca wiatr w koronach drzew i falowanie flag oraz chorągwi.'],
    en: ['Fixed the ground disappearing on the new engine (the game now asks the graphics card for its full capabilities).', 'Wind in the treetops and waving flags and banners are back.'],
  },
  {
    v: '0.93.0', date: '2026-11-03',
    pl: ['Nowe oświetlenie od pochodni, ognisk i okien: liczone na karcie graficznej, więc świateł może być bardzo dużo bez spadku płynności, a zapalanie pochodni o zmroku nie przycina gry.'],
    en: ['New lighting from torches, campfires and windows: computed on the graphics card, so there can be very many lights without losing smoothness, and lighting torches at dusk no longer makes the game stutter.'],
  },
  {
    v: '0.92.9', date: '2026-11-03',
    pl: ['Naprawione błędy cieni na nowym silniku przy oddalaniu i przybliżaniu kamery.'],
    en: ['Fixed shadow errors on the new engine when zooming the camera in and out.'],
  },
  {
    v: '0.92.8', date: '2026-11-03',
    pl: ['Naprawiony płomień ogniska i pochodni rozciągnięty w długi, ciemny pas (to samo poprawione w chmurach, postaciach i dalekich drzewach).'],
    en: ['Fixed campfire and torch flames stretching into a long dark streak (the same fix applies to clouds, characters and distant trees).'],
  },
  {
    v: '0.92.7', date: '2026-11-03',
    pl: ['Szybsze wczytywanie: gra startuje, gdy najważniejsza grafika jest gotowa, a resztę dokłada w kolejnych klatkach, po kawałku, bez przycięć.', 'Wracają chmury na niebie (miękko gasną przy górach) i padający śnieg.'],
    en: ['Faster loading: the game starts once the essential graphics are ready and adds the rest bit by bit over the next frames, without stutter.', 'Clouds are back in the sky (fading softly against the mountains), and so is falling snow.'],
  },
  {
    v: '0.92.6', date: '2026-11-03',
    pl: ['Naprawione zawieszanie całej przeglądarki przy wczytywaniu (95%): grafika kompiluje się w tle, a gra i inne karty działają w tym czasie normalnie.'],
    en: ['Fixed the whole browser freezing while loading (95%): graphics now compile in the background, and the game and other tabs keep running meanwhile.'],
  },
  {
    v: '0.92.5', date: '2026-11-03',
    pl: ['Wracają drzewa z daleka: dalekie lasy obracają się do patrzącego jak dawniej, liściaste zimą stoją bez liści.', 'Wodospady na razie usunięte z mapy.'],
    en: ['Distant trees are back: far forests turn to face the viewer as before, and broadleaf trees stand bare in winter.', 'Waterfalls are removed from the map for now.'],
  },
  {
    v: '0.92.4', date: '2026-11-03',
    pl: ['Szybsze „Przygotowanie grafiki” na nowym silniku.', 'Wraca trawa: kępy kołyszą się na wietrze, gęstnieją przy wodzie, rzedną na zboczach i żółkną jesienią.'],
    en: ['Faster "Preparing the graphics" on the new engine.', 'Grass is back: tufts sway in the wind, grow thicker by the water, thinner on slopes and turn yellow in autumn.'],
  },
  {
    v: '0.92.3', date: '2026-11-03',
    pl: ['Wczytywanie nie zamraża już przeglądarki: grafika przygotowuje się porcjami, pasek się rusza, a inne karty działają normalnie. Mniej wariantów do przygotowania, więc trwa to krócej.', 'Ludzie i żołnierze znowu się ruszają (chodzą, walczą, padają) i noszą barwy swojego pana.'],
    en: ['Loading no longer freezes the browser: graphics are prepared in small portions, the bar keeps moving and other tabs keep working. Fewer variants to prepare, so it is quicker too.', 'People and soldiers move again (walk, fight, fall) and wear their lord’s colours.'],
  },
  {
    v: '0.92.2', date: '2026-11-03',
    pl: ['Wraca dym z kominów, iskry nad ogniskami i blask okien nocą.', 'Wraca ogień: płomienie pochodni i ognisk oraz pożary budynków — liczone kilka razy taniej niż wcześniej.', 'Za dnia na niebie nie widać już czarnych kropek.'],
    en: ['Chimney smoke, sparks over campfires and glowing windows at night are back.', 'Fire is back: torch and campfire flames and burning buildings — now several times cheaper to draw.', 'No more black dots in the daytime sky.'],
  },
  {
    v: '0.92.1', date: '2026-11-03',
    pl: ['Wraca mgła w dolinach, poranny opar i chmury przy szczytach — teraz miękko gasną wszędzie, gdzie dotykają zboczy, drzew i murów (bez ostrych linii).', 'Naprawione gwiazdy na nocnym niebie.'],
    en: ['Valley mist, morning haze and clouds around the peaks are back — now they fade softly wherever they touch slopes, trees and walls (no hard lines).', 'Fixed the stars in the night sky.'],
  },
  {
    v: '0.92.0', date: '2026-11-03',
    pl: ['Nowa woda: widać prawdziwą głębokość (płycizna zielonkawa, głębia ciemna), dno i brodzących ludzi przez falującą taflę, w wodzie odbija się cały świat, a słońce błyska na zmarszczkach.', 'Wraca niebo z gwiazdami, księżycem i łuną o świcie i zmierzchu.'],
    en: ['New water: real depth (greenish shallows, dark deeps), the riverbed and wading people seen through the rippling surface, the whole world reflected in it and the sun glinting on the ripples.', 'The sky is back, with stars, the moon and the glow at dawn and dusk.'],
  },
  {
    v: '0.91.3', date: '2026-11-03',
    pl: ['Szybsze wczytywanie na nowym silniku grafiki: „Przygotowanie grafiki” trwa sekundę zamiast kilku.'],
    en: ['Faster loading on the new graphics engine: "Preparing the graphics" takes a second instead of several.'],
  },
  {
    v: '0.91.2', date: '2026-11-03',
    pl: ['Naprawione: wczytywanie nie staje już na 95% („Przygotowanie grafiki”).', 'Wracają efekty obrazu na nowym silniku: cieniowanie zagłębień, ciepłe barwy dnia i chłodna noc, winieta, wygładzanie krawędzi i wyostrzenie.'],
    en: ['Fixed: loading no longer gets stuck at 95% ("Preparing the graphics").', 'Image effects are back on the new engine: ambient occlusion, warm daylight colours and a cool night, vignette, edge smoothing and sharpening.'],
  },
  {
    v: '0.91.1', date: '2026-11-03',
    pl: ['Naprawione: wczytywanie nie staje już na 95% („Przygotowanie grafiki”).', 'Wracają efekty obrazu na nowym silniku: cieniowanie zagłębień, ciepłe barwy dnia i chłodna noc, winieta, wygładzanie krawędzi i wyostrzenie.'],
    en: ['Fixed: loading no longer gets stuck at 95% ("Preparing the graphics").', 'Image effects are back on the new engine: ambient occlusion, warm daylight colours and a cool night, vignette, edge smoothing and sharpening.'],
  },
  {
    v: '0.91.0', date: '2026-11-03',
    pl: ['Gra rysuje się teraz nowym silnikiem grafiki WebGPU — szybszym i z większymi możliwościami. Przez najbliższe wersje część efektów (woda, niebo, dym, cienie chmur) wraca po kolei.'],
    en: ['The game now runs on the new WebGPU graphics engine — faster and far more capable. Over the next versions some effects (water, sky, smoke, cloud shadows) will return one by one.'],
  },
  {
    v: '0.90.1', date: '2026-11-03',
    pl: ['Nowy silnik grafiki WebGPU (dla testerów): ziemia ma już pełne tekstury — trawa, łąki, ściółka, żwir, skały, piach, śnieg w górach i dno pod wodą jak w zwykłej grze.'],
    en: ['New WebGPU graphics engine (for testers): the ground now has its full textures — grass, meadows, forest floor, gravel, rock, sand, mountain snow and riverbeds, just like the normal game.'],
  },
  {
    v: '0.90.0', date: '2026-11-03',
    pl: ['Początek przejścia na nowy silnik grafiki WebGPU (na razie tylko dla testerów, z dopiskiem w adresie) — zwykła gra bez zmian.'],
    en: ['The first step towards the new WebGPU graphics engine (testers only for now, via the address) — the normal game is unchanged.'],
  },
  {
    v: '0.89.6', date: '2026-11-03',
    pl: ['Urwiska: przy krawędzi skały światło przechodzi płynnie w sąsiedni teren — bez prostej, ostrej granicy skały i piachu.'],
    en: ['Cliffs: at the edge of the rock the lighting blends smoothly into the ground next to it — no straight, hard line between rock and sand.'],
  },
  {
    v: '0.89.5', date: '2026-11-03',
    pl: [
      'Po wygranej albo przegranej „Kontynuuj” nie wraca już do skończonego meczu — bierze najnowszy zapis innej, niedokończonej gry (zapisy skończonego meczu zostają w „Wczytaj grę”).',
      'Okno budynku: imiona i zajęcia magazynierów i robotników oraz „Pusto” czytelne na pergaminie.',
    ],
    en: [
      'After a win or a defeat “Continue” no longer returns to the finished match — it takes the newest save of another, unfinished game (the finished match’s saves stay in “Load game”).',
      'Building window: the names and tasks of storekeepers and workers, and “Empty”, are readable on the parchment.',
    ],
  },
  {
    v: '0.89.4', date: '2026-11-03',
    pl: ['Tryb testowy: pustynię można wymusić dopiskiem „kraina=pustynia” w adresie (dla testerów).'],
    en: ['Test mode: the desert can be forced with “kraina=pustynia” in the address (for testers).'],
  },
  {
    v: '0.89.3', date: '2026-11-03',
    pl: [
      'Zamek i mury z jasnego, ciosanego kamienia zamiast prawie czarnego; łupek na dachach jaśniejszy.',
      'Urwiska bez schodkowych granic skały i piachu: skała tylko tam, gdzie ściana jest stroma, płaskie półki zostają piachem albo trawą.',
      'Na pustyni i stepie skała urwisk ma ciepły, piaskowy odcień zamiast szarego.',
    ],
    en: [
      'The keep and walls are built of light dressed stone instead of near-black; the slate on the roofs is lighter too.',
      'Cliffs without stair-stepped edges between rock and sand: rock shows only where the face is steep, flat ledges stay sand or grass.',
      'In the desert and on the steppe the cliff rock has a warm, sandy tone instead of grey.',
    ],
  },
  {
    v: '0.89.2', date: '2026-11-03',
    pl: [
      '„Nowa gra”: karty trybu, poziomu i krainy z rysunkami (tarcze stron, miecze, pejzaże krain) w przewijanych rzędach — przeciągasz myszą, kręcisz kółkiem albo klikasz strzałki po bokach.',
      'Wybrana karta unosi się jak pieczęć, a rysunek ożywa po najechaniu.',
    ],
    en: [
      '“New game”: mode, difficulty and land cards with pictures (the sides’ shields, swords, landscapes) in scrolling rows — drag with the mouse, use the wheel or click the side arrows.',
      'The chosen card lifts like a seal, and its picture comes alive on hover.',
    ],
  },
  {
    v: '0.89.1', date: '2026-11-03',
    pl: ['Okno budynku: wyraźna plakietka „Twoje” (zielona), „Wróg” (czerwona) albo „Sojusznik” (niebieska); przyciski na dole równej szerokości; widoczna strzałka w przepisie warsztatu; bez przycisku „Zaznacz stojących na wieży”.'],
    en: ['Building window: a clear “Yours” (green), “Enemy” (red) or “Ally” (blue) badge; even-width buttons at the bottom; a visible arrow in the workshop recipe; no “Select the men on the tower” button.'],
  },
  {
    v: '0.89.0', date: '2026-11-03',
    pl: [
      'Nowe kamienie i głazy z gry 0 A.D.: 23 różne kształty (duże i średnie bloki granitu, małe kamienie, okrągłe głazy) ze zdjęciową skałą i prawdziwą fakturą — zamiast trzech gładkich brył.',
      'Na pustyni skała ma piaskowy odcień, a na stoliwach i przy skałach stoją wysokie, bruzdowane skały.',
    ],
    en: [
      'New stones and boulders from 0 A.D.: 23 different shapes (large and medium granite blocks, small stones, round boulders) with photographic rock and real surface detail — instead of three smooth lumps.',
      'In the desert the rock turns sandy, and tall furrowed rocks stand on the mesas and by the cliffs.',
    ],
  },
  {
    v: '0.88.2', date: '2026-11-03',
    pl: ['„Nowa gra” jako pergaminowy pasek na dole ekranu: tryb i poziom, kraina i nazwa mapy, opcje i przyciski w trzech kolumnach — nad nim widać całą mapę z lotu ptaka.'],
    en: ['“New game” as a parchment bar along the bottom of the screen: mode and difficulty, land and map name, options and buttons in three columns — the whole map is visible from above.'],
  },
  {
    v: '0.88.1', date: '2026-11-03',
    pl: ['Mur i zamek: kamienie z jednej partii — tylko lekkie różnice jasności zamiast szachownicy jasnych i ciemnych bloków, jaśniejsza zaprawa, spokojniejsza faktura.'],
    en: ['Walls and castle: stones from one quarry — only slight differences in shade instead of a chequerboard of light and dark blocks, lighter mortar, calmer texture.'],
  },
  {
    v: '0.88.0', date: '2026-11-03',
    pl: [
      'Nowa kraina: Pustynia — piach i łagodne wydmy, stoliwa z urwiskami, zielone oazy przy jeziorkach i rzece (tylko tam rośnie las), po dwa gaje przy każdym zamku. Gorąco: susza latem, śnieg prawie nigdy.',
      'Woda nie zawsze środkiem: na nowych mapach płynie jedna rzeka przez środek, dwie rzeki po bokach (każda z brodami) albo nie ma rzeki — same jeziora.',
      'Pustynię i pozostałe krainy wybierasz w „Nowej grze”.',
    ],
    en: [
      'A new land: Desert — sand and gentle dunes, mesas with cliffs, green oases by the pools and the river (the only place woods grow), and two groves by every keep. Hot: droughts in summer, hardly ever snow.',
      'The water is not always in the middle: new maps have one river through the middle, two rivers on the flanks (each with fords) or no river at all — just lakes.',
      'Pick the Desert or any other land in “New game”.',
    ],
  },
  {
    v: '0.87.4', date: '2026-11-03',
    pl: [
      'Menu główne: herb i nazwa gry w jednej linii, bez opisów pod listą pozycji.',
      'Ekran wczytywania: rada jako czytelna karta ze złotą etykietą „Rada” — zwykłe pismo, bez kursywy, pogrubienia i cienia; spokojniejszy napis postępu.',
    ],
    en: [
      'Main menu: the crest and the game’s name on one line, no descriptions under the menu entries.',
      'Loading screen: the tip as a clear card with a gold “Tip” label — plain lettering, no italics, bold or shadow; a calmer progress line.',
    ],
  },
  {
    v: '0.87.3', date: '2026-11-03',
    pl: [
      'Nowe kamienie murów i zamku: prostokątne ciosy różnej wielkości z obtłuczonymi krawędziami, wypukłe lica z fakturą, wgłębione fugi z zaprawy zamiast czarnych falujących kresek.',
      'Nowy łupek na dachach: prostokątne płytki różnej szerokości na zakładkę, z cieniem pod dolnym brzegiem — bez powtarzających się „łusek”.',
      '„Nowa gra” ma znowu pergaminowe tło pod kafelkami (było ciemne i wszystko się zlewało).',
    ],
    en: [
      'New stone for walls and the castle: rectangular blocks of different sizes with chipped edges, bulging textured faces and recessed mortar joints instead of black wavy lines.',
      'New roof slate: rectangular tiles of varied width in overlapping rows, shadowed under the lower edge — no repeating “scales”.',
      '“New game” has its parchment background under the tiles again (it was dark and everything blurred together).',
    ],
  },
  {
    v: '0.87.2', date: '2026-11-03',
    pl: ['Mur kamienny nie miga na narożnikach: krawędzie z blankami nie zachodzą już na siebie w rogu, a cokół i gzyms domyka osobny kawałek narożnika.'],
    en: ['The stone wall no longer flickers at its corners: the crenellated edges no longer overlap in the corner, and a separate corner piece closes the plinth and cornice.'],
  },
  {
    v: '0.87.1', date: '2026-11-03',
    pl: ['Jaśniej: mocniejsze słońce i światło nieba za dnia, wyższa ekspozycja, noce mniej czarne (świt i zmierzch dalej ciepłe). Suwak Jasność w Ustawieniach działa jak dotąd.'],
    en: ['Brighter: stronger sun and skylight by day, higher exposure, nights less pitch-black (dawn and dusk still warm). The Brightness slider in Settings works as before.'],
  },
  {
    v: '0.87.0', date: '2026-11-03',
    pl: [
      '„Nowa gra” na pergaminie, jak księgi w menu: czerwone nagłówki, jasne kafelki, zaznaczony wybór jak pieczęć.',
      'Wybór krainy w „Nowej grze”: Losowa (z nazwy mapy), Łęgi, Wyżyna, Step albo Północ — podgląd mapy od razu pokazuje wybraną krainę, a zapis gry ją pamięta.',
    ],
    en: [
      '“New game” on parchment, like the books in the menu: red headings, light tiles, the chosen option sealed like a stamp.',
      'Pick the land in “New game”: Random (from the map name), Lowland meadows, Highlands, Steppe or Northlands — the map preview shows it at once and the save remembers it.',
    ],
  },
  {
    v: '0.86.0', date: '2026-11-03',
    pl: [
      'Nowy wygląd skał w górach i na urwiskach: poszarpana, szarobrązowa skała zamiast białych i „słoistych” płatów, z prawdziwą rzeźbą światła (nowa mapa nierówności) i bez rozmytych podwójnych wzorów na zboczach.',
      'Na wielkich ścianach skalnych nie widać powtórek wzoru, a na skale nie ma już ciemnych plam przeniesionych z łąki.',
    ],
    en: [
      'New look for mountain and cliff rock: jagged grey-brown stone instead of white, wood-grained patches, with real relief in the lighting (a new bump map) and no blurry double patterns on the slopes.',
      'Large rock faces no longer show repeating patterns, and the rock is free of the dark blotches carried over from the meadows.',
    ],
  },
  {
    v: '0.85.3', date: '2026-11-03',
    pl: [
      'Okno budynku na pergaminie: ciemny atrament, czerwone nagłówki sekcji, jasny tytuł na belce; braki na ciemnoczerwono, „Budynek działa” na zielono — wszystko czytelne.',
      'Kronika stoi tuż obok otwartego okna budynku, a nie daleko po prawej; okno koszar nie zwija się już do paska.',
      'Budynki na kartach budowy trochę jaśniejsze.',
      'Kominek w komnacie twierdzy i palenisko w kuchni to prawdziwe wnęki z węgarami, sadzą, polanami, żarem i ogniem (wcześniej płaska czarna płachta).',
    ],
    en: [
      'The building window on parchment: dark ink, red section headings, a light title on the bar; shortages in dark red, “Building working” in green — all easy to read.',
      'The chronicle sits right next to an open building window rather than far to the right; the barracks window no longer shrinks to a strip.',
      'Buildings on the build cards are a little brighter.',
      'The fireplace in the keep’s chamber and the kitchen hearth are real recesses with jambs, soot, logs, embers and flames (before: a flat black sheet).',
    ],
  },
  {
    v: '0.85.2', date: '2026-11-03',
    pl: ['Mgła przy granicy mapy nie urywa się już prostą linią: opar nad planszą łagodnie wygasa przy brzegu, a mgła w dolinach za mapą narasta płynnie.'],
    en: ['Mist at the map border no longer ends in a straight line: the haze over the board fades gently at the edge and the valley fog beyond builds up smoothly.'],
  },
  {
    v: '0.85.1', date: '2026-11-03',
    pl: ['Skała gór bez podłużnych smug „jak kora”: spokojniejsza faktura, duży wzór pod spodem, żeby na wielkich ścianach nie było widać powtórek.'],
    en: ['Mountain rock without the long bark-like streaks: a calmer texture with a large-scale pattern beneath, so big rock faces show no repeats.'],
  },
  {
    v: '0.85.0', date: '2026-11-03',
    pl: [
      'Góry rosną od podnóża stopniowo i tworzą zbocza i pasma — koniec samotnych skalnych iglic wysokich na kilkanaście metrów.',
      'Skała gór i urwisk jest wyrzeźbiona: żebra, żleby i półki w gęstej siatce, więc tekstura skały nie rozciąga się już po zboczach.',
    ],
    en: [
      'Mountains now rise gradually from their foot into slopes and ranges — no more lone rock spires tens of feet tall.',
      'Mountain and cliff rock is sculpted: ribs, gullies and ledges in a fine mesh, so the rock texture no longer stretches across the slopes.',
    ],
  },
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

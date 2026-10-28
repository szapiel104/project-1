# Dziennik zmian

## 0.54.5 — gra prosi o mocniejszą kartę graficzną (2026-10-28)

- **Mocniejsza karta w laptopach z dwiema kartami:** wszystkie okna 3D gry (świat, podgląd modeli, miniatury budynków, dalekie drzewa) proszą przeglądarkę o kartę „wysokiej wydajności” (`powerPreference: 'high-performance'`). W laptopie z kartą wbudowaną w procesor i osobną (np. Intel + NVIDIA) przeglądarka dotąd często zostawała na słabszej, wbudowanej
- **F3 pokazuje, na czym gra działa:** nazwę karty graficznej, na której rysuje przeglądarka, i liczbę rdzeni procesora
- Bot: bez zmian (sama grafika)
## 0.54.4 — szybsze wczytywanie: pobieranie równolegle zamiast po kolei (2026-10-28)

- **Wszystko pobiera się od razu, a nie po kolei:** dotąd ekran wczytywania szedł łańcuchem — najpierw tekstury rysowane w przeglądarce, dopiero potem pobieranie modeli, potem kod gry, a duże tekstury KTX2 (teren ok. 10 MB, zdjęciowe tekstury budynków ok. 9 MB) dopiero, gdy gra już powstała. Teraz:
  - **modele** (ok. 6 MB) zaczynają się pobierać na samym początku, w czasie rysowania tekstur,
  - **kod gry** (ok. 2 MB JavaScriptu z biblioteką 3D) pobiera się od otwarcia strony (`<link rel="modulepreload">` dopisywany do index.html przez `tools/build/preload-main.mjs`); uruchamia się jak dotąd, po modelach,
  - **tekstury KTX2 i ich dekoder** pobierają się w tle z niższym priorytetem (`src/render/prefetch.ts`), więc gdy gra o nie prosi, są już w pamięci przeglądarki
- **Tekstury zapamiętane z poprzedniej wizyty** wczytują się wszystkie naraz, a nie po jednej
- Najwięcej zyska pierwsze wejście i wejście po aktualizacji gry. Przy kolejnych wejściach pliki i tak bierze Service Worker z dysku, więc wcześniejsze pobieranie tekstur się wtedy wyłącza (nie dubluje zapytań)
- Wygląd, kolejność budowania świata i sam kod wczytywania tekstur bez zmian. Numer wersji tekstur terenu jest teraz w jednym miejscu (`TERRAIN_V` w `prefetch.ts`); test `tests/prefetch.test.ts` pilnuje, żeby lista pobieranych zawczasu tekstur zgadzała się z tym, czego używa teren
- Bot: bez zmian (samo wczytywanie)
## 0.54.3 — menu nie staje przy losowaniu mapy, szybszy start nowej gry (2026-10-27)

- **„Losuj inną mapę” bez zacięcia:** nowa mapa do podglądu (teren, lasy, złoża, twierdze, ok. 150–300 ms liczenia, przy 4 na 4 najdłużej) liczy się teraz w osobnym wątku (`sim/mapworker.ts`, `sim/mapthread.ts`). Menu, kręciołek i przyciski działają w tym czasie normalnie. Szybkie klikanie „Losuj” kilka razy z rzędu nie układa kolejki: pokazuje się tylko ostatnio wylosowana mapa
- **Szybszy start:** „Graj” z tymi samymi ustawieniami co podgląd (ziarno, tryb, poziom, tryb dewelopera, mury) bierze gotową mapę z podglądu zamiast liczyć ją drugi raz. Gdy ustawienia się różnią albo wyłączone jest „budowanie od razu”, mapa liczy się jak dotąd
- Gdy przeglądarka nie obsługuje wątków albo wątek padnie, mapa liczy się po staremu w wątku głównym
- Wynik z wątku to ta sama gra co policzona na miejscu (generator z ziarnem); test `tests/mapthread.test.ts`
- Bot: bez zmian (samo liczenie mapy)
## 0.54.2 — szybsze wczytywanie: modele spakowane bez strat (2026-10-27)

- **Modele jadą do gry spakowane:** zamiast 71 plików JSON (ok. 10,8 MB przez sieć po gzip) gra pobiera pliki `.bin` o łącznej wadze ok. 6 MB, czyli **o ok. 44% mniej do pobrania** przy pierwszym wejściu i po każdej aktualizacji modeli. Liczby siatek nie są już zapisane w base64, te same strumienie (np. wersja z bliska i z daleka tego samego przedmiotu) lecą raz, a dane przechodzą przez kodek wierzchołków meshoptimizer (ten sam co w glTF) i deflate
- **Bez strat i bez zmiany wyglądu:** po rozpakowaniu gra dostaje bajt w bajt te same trójkąty, UV, normalne i kolory co w `src/render/models/*.json` (zasada „nie odchudzać modeli” zostaje). Każdy strumień jest przy pakowaniu od razu rozpakowany i porównany z oryginałem; test `tests/modelpack.test.ts` sprawdza wszystkie 71 modeli
- Mniej pamięci: strumienie siatek trzymane są jako bajty, a nie długie napisy base64
- Pakowanie robi się samo przy `npm run build` (wtyczka `tools/models/vite-plugin.mjs`, kodek `tools/models/pack.mjs`); `npx vite` pakuje na żądanie. Skrypty Blendera i pliki JSON bez zmian. Porównanie rozmiarów: `node tools/models/pack.mjs`
- Pamięć podręczna (Service Worker) usuwa stare wersje plików `.bin` po aktualizacji
- Bot: bez zmian (samo dostarczanie modeli)
## 0.54.1 — komnata królowej w donżonie, poprawki sprzętów w zamku (2026-10-27)

- Donżon przebudowany: szerszy (trzy pola tylnego muru), z cokołem, gzymsami między piętrami, oknami z okiennicami od pola, oknem nad salą tronową, machikułami, blankami, czterema narożnymi wieżyczkami na kroksztynach ze stożkowymi dachami, dachem dwuspadowym z łupka, kominem i masztem z chorągwią
- Komnata królowej (nowe pomieszczenie, w planie zamku pola Q): na wysokości chodnika muru. Wchodzi się po schodach z dziedzińca na mury i tylnym murem przez drzwi w boku donżonu. W środku łoże z półbaldachimem, kominek, toaletka z lustrem i stołkiem, kołowrotek, ława pod oknem, skrzynia z wianem, gobelin, dywan i dwie pochodnie. W spacerze chodzi się po niej jak po murze; obcy nie wejdą (plan zamku jest wspólny dla gry i modelu)
- Poprawki po zgłoszeniu: poduszki w komnacie pana z lnu (z teksturą) i wypchane zamiast białych klocków; nóż w kuchni z cienkim, stalowym ostrzem i drewnianą rękojeścią (nowy materiał `steel`, jasna stal z połyskiem), groty włóczni i topór też ze stali; pergamin i karty księgi z płótna; skrzynia z jaśniejszego drewna (nie zlewa się w ciemności)
- Opis zamku w obu językach wspomina komnatę królowej
- Bot: bez zmian (zamek stoi od początku gry, nikt go nie buduje)

## 0.54.0 — prawdziwe dźwięki i silnik dźwięku przestrzennego (2026-10-27)

- **Nowe nagrania zamiast „drewnianych” dźwięków** (gra 0 A.D., CC BY-SA 3.0, ok. 480 plików w `public/sounds/0ad/`): młotek, piła i dłuto na budowie, siekiera, kilof, uderzenia kowala, puszczenie cięciwy, świst strzały mijającej kamerę, trafienia strzał (w ziemię, drewno, kamień, zbroję i ciało), zamach mieczem i włócznią, szczęk ostrzy, uderzenia w tarczę, krzyk umierającego, głosy i okrzyki ludzi (zamiast syntezowanego bełkotu), pies, świnia, deszcz, trzask płonącego budynku i ogniska, gwar osady, zawalenie budynku. Każdy dźwięk ma kilkanaście–kilkadziesiąt wariantów, a ten sam plik nie leci dwa razy z rzędu
- **Silnik dźwięku przestrzennego** (`audio/engine.ts`, ustawienia każdego rodzaju w `audio/bank.ts`): słuchacz stoi tam, gdzie patrzy kamera, a oddalenie kamery dokłada „wysokość ucha” — z bliska słychać każdy krok i rozmowę, przy zwykłym widoku kroki i gadanie milkną, a z drugiego końca mapy nic nie krzyczy do ucha (wcześniej głośność liczyła się od samej kamery: przy oddaleniu cisza, przy zbliżeniu nagle za głośno). Z daleka dźwięk jest głuchszy (filtr wysokich tonów) i ma więcej pogłosu, z boku ekranu słychać go z boku. Każdy rodzaj ma własną krzywą odległości: zawalenie i walkę słychać daleko, kroki tylko z bliska
- **Porządek w miksie:** limit głosów na rodzaj i na cały świat (w tłoku cichszy, dalszy dźwięk ustępuje bliższemu), ten sam dźwięk w tym samym miejscu nie startuje dwa razy naraz, głośność wszystkich nagrań wyrównana przy wczytaniu, łagodny kompresor i limiter na wyjściu. Walka, śmierć i zawalenia ściszają na chwilę muzykę i tło
- **Strzały:** dźwięk puszczenia z łucznika (także z wieży), świst w połowie lotu, trafienie dopiero, gdy strzała doleci — w miejscu celu i z dźwiękiem podłoża
- **Ciągłe źródła:** płonący budynek i ogniska trzaskają ze swojego miejsca i cichną, gdy ogień zgaśnie; przy środku ekranu, gdzie krząta się sporo ludzi, cichy gwar
- **Śmierć:** zamiast zdjętego w 0.53.14 krzyku (brzmiał jak dmuchanie) cichy jęk albo krzyk umierającego z prawdziwych nagrań, nie przy każdym poległym (w bitwie co trzeci milczy)
- Zawalenie budynku gra z jego miejsca (wcześniej zawsze na pełny głos, nawet z drugiego końca mapy)
- Wszystkie nagrania wczytują się w tle po kolei (najpierw praca i walka), więc pierwsze uderzenie nie milczy
- F3: liczba grających głosów, pętli i wczytanych plików; w trybie testowym `window.__audio` (`stats`, `ear`, `play`)
- Testy: `tests/audio.test.ts` (krzywa odległości, panorama, czy wszystkie pliki z banku istnieją)
- Bot: bez zmian (sam dźwięk)
## 0.53.15 — bez migania kamienia, prawdziwe sprzęty w zamku, odbudowa nie zabiera wszystkich ludzi (2026-10-27)

- Miganie kamiennych ścian: w zamku lico muru przy bramie leżało w jednej płaszczyźnie z licem wież bramy (mur wchodził w wieże) — teraz kończy się przy nich; posadzki izb w basztach są 6 mm nad płytami chodnika, szczyty dachów sal 6 mm od muru, złoty brzeg chodnika w sali tronowej nad suknem. Wieże kamienne (zwykła, duża i wielka): ciemna listwa na koronie przedpiersia leżała wierzchem równo z kamieniem i migała z góry — podniesiona o 5 mm, bez zakładek w narożnikach. Sprawdzone skryptem, który szuka nachodzących na siebie ścian w modelu
- Kuchnia w zamku: zamiast kostek w kolorze chleba i jabłek leżą bochenki, jabłka i worek mąki ze skanów; stół na nogach z deską i nożem, otwarty regał z półkami (chleb, jabłka, dzbany, kosz), beczki z obręczami, nad paleniskiem belka, półka z garnkami, okap i haki z chochlą i patelnią
- Komnata pana: łoże na nogach z siennikiem, dwiema poduszkami, pierzyną, baldachimem z lambrekinem i zasłonami; skrzynia z wiekiem, okuciami, zamkiem, pucharem i monetami; stół do pisania na nogach z krzesłem, księgą, kałamarzem i piórem; szafa z drzwiami, płycinami i uchwytami; skóra przy łożu
- Odbudowa: dotąd każdy plac budowy mógł oderwać od pracy dwóch ludzi, więc po wielkim zniszczeniu kilkanaście ruin zabierało wszystkich z lasu, pól i warsztatów i nikt nie wytwarzał surowców. Teraz na całą osadę naraz pomaga przy budowach najwyżej co piąty pracownik (co najmniej dwóch); bezrobotni chłopi i inżynierowie z cechu chodzą jak dotąd (`borrowLimit` w `sim/systems/army.ts`, test w `tests/ruins.test.ts`)
- Bot: korzysta z tej samej reguły (wspólny system)
## 0.53.14 — polegli leżą na wieży i murze, kruki odlatują, bez krzyku śmierci (2026-10-27)

- **Ciało zostaje tam, gdzie żołnierz zginął:** łucznik poległy na wieży leży na jej pomoście, na murze kamiennym — na chodniku muru, na murach twierdzy — na koronie muru (wcześniej spadał od razu na ziemię pod wieżę). Gdy wieżę zburzą, ciało spada na ziemię
- **Grabarz i wolni chłopi zabierają poległych z wież i murów:** podchodzą pod wieżę albo do stóp muru i znoszą ciało (wcześniej nie mieli jak do niego dojść i leżało tam do rozkładu)
- **Kruki tylko na chwilę:** przylatują z daleka kilkanaście sekund po śmierci, posiedzą i podziobią ok. pół minuty, potem odlatują w siną dal (wcześniej siedziały nad ciałem, aż je zabrano). Na ciała na wieżach i murach nie siadają
- **Bez krzyku przy śmierci:** dźwięk przy padającym ciele (brzmiał jak dmuchanie albo zjawa) usunięty
- Bot: bez osobnych zmian (grabarze i chłopi bota korzystają z tych samych zasad)
- Test: `tests/tower-shoot.test.ts` — ciało na wieży zostaje na górze i zostaje zabrane

## 0.53.13 — gruz wygląda jak kamień (2026-10-27)

- Odłamki i gruz to nieregularne kamienie z teksturą i mapą wypukłości zamiast kanciastych, białych brył; mniejsze, ciemniejsze i w różnych odcieniach, mniej ich wokół ruin
- Ruina muru bez rusztowania, dopóki nikt jej nie odbudowuje (wcześniej pomost z desek stał na gruzie od razu po zniszczeniu)
## 0.53.12 — linia strzału: strzały nie lecą przez mury i budynki (2026-10-27)

- **Strzała i czar potrzebują czystej linii strzału:** łucznik albo mag na ziemi strzela tylko wtedy, gdy między nim a wrogiem nie stoi mur (częstokół, mur kamienny), zamknięta brama, chata ani inny budynek, a po drodze nie ma ściany twierdzy. Inaczej podchodzi, aż znajdzie miejsce, z którego widzi wroga, albo bierze innego, widocznego wroga. Niskie rzeczy (pochodnia, kosz ognia, studnia, cmentarz, drabina, ruiny, place budowy) nie zasłaniają (`sim/systems/sight.ts`)
- **Z muru i wieży strzela się ponad przeszkodami:** kto stoi wysoko, widzi wroga przed sobą. Obrońcę na koronie muru albo na wieży da się trafić z ziemi (wystaje nad blanki), wroga ukrytego za murem — nie
- **Wręcz tylko na tym samym poziomie:** żołnierz na murze nie bije już stojącego pod murem, a z ziemi nie dosięgnie nikogo na murze ani na wieży
- Bot: korzysta z tych samych zasad (wspólny system walki), bez osobnych zmian
- Testy: `tests/line-of-sight.test.ts`

## 0.53.11 — panel dewelopera z ikonami, bez szumu wiatru, strzały bez skrętu, skrót do spichlerza (2026-10-27)

- **Panel dewelopera (F9) od nowa:** każdy przycisk ma ikonę i krótki podpis. Kolejność jak przy użyciu: kogo postawić (kafelki z całym wojskiem — włócznik, łucznik, strażnik, zbój, zbrojny, saper, **mag Płomienia, mag Źródła** — i wilk), czyj (Wróg / Mój), ilu (×1, ×3, ×6, ×12), „Stawiaj na mapie”; potem Czas (Rano, Noc, cztery pory roku), Szybko (wróg pod wieżą, pożar, ulecz, +1000, usuń wrogów, wygraj) i Kamera (moja / wroga twierdza). Wcześniej nie dało się postawić magów
- **Bez szumu wiatru:** syntetyczny szum (słychać go było zwłaszcza w ciszy po walce, gdy przylatują kruki) usunięty; zostaje tło dźwiękowe z nagrań, deszcz, ptaki i wilki (`audio/sfx.ts`)
- **Strzały nie skręcają nagle o 90°:** kierunek strzały liczony wprost z toru lotu; wcześniej pod sam koniec lotu punkt „chwilę dalej” zbiegał się z celem i strzała obracała się w bok tuż przed trafieniem (`render/arrows.ts`)
- **Skrót do spichlerza** na dolnym pasku obok koszar i składu: klik pokazuje spichlerz i otwiera jego okno, kolejny klik — następny (mały i duży). Skrót do składu obejmuje teraz też duży skład (stodołę)
- Bot: bez zmian (poprawki interfejsu, dźwięku i wyglądu)
## 0.53.10 — daszek karczmy w dobrą stronę, detale na zamku (2026-10-27)

- Karczma: daszek nad gankiem opadał do środka (wyżej na zewnątrz) — teraz spada od ściany na zewnątrz, wysoko przy ścianie pod belkami piętra i niżej nad belką na słupach; doszły krokwie pod deskami i deska czołowa na okapie (`tools/models/tavern.py`)
- Zamek, dachy: gąsiory na kalenicach sali tronowej, komnaty, kuchni i koszar, kute iglice na końcach kalenic, sygnaturka z dzwonkiem na środku dachu sali tronowej, wywietrznik dymu nad koszarami
- Zamek, płaski strop lochów: kamienny krawężnik, dwa świetliki z żelazną kratą i rzygacze od strony dziedzińca
- Donżon: wsporniki (machikuły) pod koroną z tyłu i z boków oraz lukarna z oknem w dachu
- Dziedziniec: pieniek z wbitym toporem i szczapami przy stosie drewna, stojak z włóczniami i tarczą pod koszarami, koryto z wodą przy studni (przeszkody dla spacerowicza dopisane)
- Bot: bez zmian — to tylko wygląd istniejących budynków

## 0.53.9 — bale spadają na ziemię, gruz po rozbitym murze (2026-10-27)

- **Częstokół:** złamany bal zrzuca odłamany kawał z czubkiem — leży pod murem w poprzek, dopóki inżynier nie naprawi muru. Przy mocno rozbitym częstokole część bali jest wyrwana w całości i leży obok, a reszta przechyla się mocniej
- **Mur kamienny:** od drugiego stopnia zniszczeń pod murem leżą strącone ciosy i blanki, przy trzecim prawie przy każdym boku
- **Ruina muru:** zamiast gładkiej „posadzki” zostaje poszarpany kikut — korona z wyłamanych kamieni, wyrwy na bokach, bez przedpiersia i blanek (wracają pod koniec odbudowy). Wokół ciosy i kamienie; po częstokole kikuty bali, połamane bale, drzazgi i szczapy. Gruzu ubywa w miarę odbudowy. Tak samo gruz wokół ruin bram i wież
- **Pęknięcia przyklejone do ściany:** naklejka 3 mm przed licem zamiast 12 mm (wcześniej było widać odstęp od muru), na wieżach mniejsze, żeby nie odstawały od zaokrągleń
- „Jak grać” → Cech inżynierów: dopisane, że odłamane bale i gruz leżą do naprawy


## 0.53.8 — płonący i przymrożeni wyglądają naturalnie (2026-10-27)

- Płonący żołnierz: zamiast twardych stożków i pomarańczowego „jaja” wokół postaci — 9 miękkich języków ognia (rozmyta kropla zwrócona do kamery), które wyrastają z ubrania, rosną, unoszą się i gasną, każdy w swoim rytmie; u dołu jasnożółte, wyżej pomarańczowe i czerwone. Pod nimi delikatna ciepła poświata, w górę żar i smużki dymu (`render/spells.ts`)
- Przymrożony: bez niebieskiej powłoki — drobne kryształki lodu u stóp, opadający szron i lekka chłodna poświata
- Ogień w barwach głębokiej pomarańczy (nie bieli), języki większe i na całej sylwetce
- Wydajność: dalej dwie wspólne siatki instancji, tekstury rysowane raz (64 px)

## 0.53.7 — wyraźniejsze pęknięcia, mniej drzazg (2026-10-27)

- Pęknięcia na murze kamiennym większe i grubsze, widać je też z dalszej kamery
- Pod rozbitym częstokołem mniej i mniejszych drzazg, w kolorze kory zamiast jasnych desek (wcześniej wyglądały jak rozsypane zapałki)

## 0.53.6 — magia mocniejsza, ogień i lód widać, strzały prosto i w rytm łuku (2026-10-27)

- **Magowie mocniejsi:** mag Płomienia 26 obrażeń co 3,2 s (było 15 co 4 s) i podpala trafionego, mag Źródła 15 co 2,6 s (było 8 co 3 s)
- **Przymrożenie czarem wody:** trafiony przez 6 s chodzi o połowę wolniej i wolniej zadaje ciosy; widać lodowe kryształki wokół stóp i chłodną poświatę, a jego pasek zdrowia świeci na niebiesko
- **Płonący** (ognista strzała, kula ognia): zamiast dwóch świeczek nad głową — języki ognia na ubraniu, ciepła poświata, żar i smużka dymu; pasek zdrowia świeci na pomarańczowo, zdrowie schodzi po 1
- **Paski zdrowia:** każdy cios widać — pasek schodzi płynnie, za nim przez chwilę zostaje jasny ślad utraconego zdrowia, nad paskiem wyskakuje „−N” (miecz, strzała, czar, ogień). Pasek jest przypisany do żołnierza, więc nie przeskakuje między ludźmi (`ui/hpBars.ts`, wydzielone z main.ts)
- **Strzały lecą prawie prosto** (część zupełnie płasko, reszta lekkim łukiem) zamiast paraboli
- **Strzała wylatuje dokładnie, gdy ręka puszcza cięciwę:** symulacja zapisuje chwilę strzału, a obraz już nie zgaduje po odliczaniu (przy mierzeniu do nowego celu wylatywała strzała „z powietrza”); animacja łuku liczy się od prawdziwego strzału
- **Magowie bez kilofa i maczugi:** magowie (i kaznodzieja) mieli kilof na plecach — pula narzędzi tylko dokłada instancje, więc późniejsze „zdjęcie” go nie chowało. Teraz narzędzie w ogóle nie jest im wstawiane
- Mniejszy błysk przy trafieniu czarem, gęstszy i drobniejszy ogon iskier i kropel

## 0.53.5 — mur nie płonie od miecza (2026-10-27)

- Cios mieczem albo włócznią już nie podpala murów, bram ani wież — pękają (0.53.2), ale nie płoną. Drewniany częstokół, bramę i wieżę strażniczą podpali tylko prawdziwy ogień (ognista strzała, piorun); kamień (mur, kamienne bramy i wieże, twierdza) nie płonie wcale. Chaty i warsztaty dalej zajmują się ogniem po mocnych ciosach (`sim/systems/fire.ts`)

## 0.53.4 — ziemia mieści się w limicie tekstur karty (2026-10-27)

- **Koniec ostrzeżenia „Trying to use 17 texture units while this GPU supports only 16”:** shader ziemi brał 17 tekstur (14 własnych + mapa cieni + odbicia otoczenia + ślady w śniegu), a wiele kart (ANGLE/D3D11) daje 16. Three.js sypał ostrzeżeniem przy każdym rysowaniu ziemi (~60 na sekundę, ponad 2600 wpisów w dzienniku na minutę gry), co samo w sobie zjadało czas klatki przy otwartej konsoli. Cztery mapy normalnych ziemi są teraz spakowane w dwie tekstury (para x/y na teksturę, z liczy shader; pakuje karta graficzna raz po wczytaniu — `src/render/normalpack.ts`). Ziemia bierze 15 tekstur, więc jest zapas na kolejne efekty. Wygląd bez zmian (różnica w odtworzonej składowej z jest niewidoczna)
- Bot: bez zmian (poprawka tylko w rysowaniu)

## 0.53.3 — Esc zamyka panel dewelopera (2026-10-27)

- Esc przy otwartym panelu dewelopera najpierw go zamyka (dopiero kolejny Esc odznacza albo otwiera menu), a w menu gry panel się nie pokazuje — nie wisi już nad ustawieniami

## 0.53.2 — pękające mury i rusztowania przy naprawie (2026-10-27)

- **Uszkodzenia widać na budowlach:** mury kamienne, częstokół, bramy, wieże i twierdza pokazują, ile już przyjęły. Przy ubytku 10% wytrzymałości pojawiają się rysy, od 35% pęknięcia z odpryskami i okruchy pod ścianą, od 65% długie pęknięcia, wyrwy po wybitych kamieniach i kupki gruzu u stóp. Drewno łupie się: jasne drzazgi w korze, odłamki pod ścianą, a bale częstokołu przekrzywiają się i łamią (ścięty czubek, krótszy kikut)
- **Rusztowanie przy naprawie:** gdy inżynier z cechu zaczyna łatać, przy ścianie wyrasta rusztowanie — najpierw słupy, potem poprzeczki, na końcu pomost z desek i zastrzał. Przy odcinku muru stoi po stronie inżyniera, wokół wież, bram i budynków dookoła, a przy twierdzy na trzech polach przy łatanej ścianie. Stoi, dopóki ekipa ma tam robotę (także gdy poszła po kamień), a po naprawie jest rozbierane. Pęknięcia znikają w tym czasie jedno po drugim, bo idą za wytrzymałością
- Sama grafika, bez zmian w symulacji: bot naprawia tak samo jak dotąd (jego mury też pękają i dostają rusztowania). Kod: `src/render/damage.ts`, `src/render/repairs.ts`, progi w `src/render/wear.ts`, opis w `docs/uszkodzenia.md`
- „Jak grać” → Cech inżynierów: akapit o pękających murach i rusztowaniach
## 0.53.1 — czytelniejsze okno budynku (2026-10-27)

- Okno budynku ma większe litery i odstępy między częściami, opis budynku jest na dole, oddzielony kreską i spokojniejszym kolorem, żeby nie mieszał się z ustawieniami
- Zamiast wielkiego czerwonego „Wyłącz budynek” jest stan: zielona kropka „Budynek działa” albo czerwona „Budynek wyłączony”, obok mały przycisk Wyłącz/Włącz, a pod spodem jednym zdaniem, co to zmienia
- Magazyn: przy każdym rodzaju towaru po prawej „8 942 z 250 miejsc” (na czerwono, z czerwonym paskiem, gdy leży więcej, niż się mieści), pod spodem osobne wiersze „Ponad miejsce w tym budynku” i „Razem we wszystkich (4)”; duże liczby z odstępami tysięcy
- Przyciski na dole: pomocniczy („Pokaż teren pracy”, „Pokaż zasięg strzału”) na całą szerokość, pod nim Rozbierz z czerwonym obrysem (już nie wygląda jak zwykła akcja) i Zamknij
- Okno stoi na dolnej belce bez przerwy, także gdy po lewej jest pasek grup wojska

## 0.53.0 — strzały trafiają, gdy dolecą; ogień płonie; czary lecą prosto (2026-10-27)

- **Strzały i czary trafiają w chwili dolecenia**, a nie w chwili strzału: cel pada, gdy strzała albo kula go dosięgnie (strzała leci 0,4 s, czar 0,2–0,6 s — tyle samo w symulacji i na ekranie). Pociski w locie są w zapisie gry
- **Ognista strzała podpala:** przy trafieniu zwykłe obrażenia, a premia za ogień (+50%) schodzi z celu płomieniem — po 1 zdrowia co 0,4 s, a na trafionym widać ogień, dopóki nie zgaśnie
- **Łucznicy nie strzelają jak na komendę:** każdy chwilę mierzy do nowego celu i naciąga łuk w swoim rytmie; strzały wylatują z różnych miejsc i lecą różnym łukiem, więc kilka naraz nie leci jedną kreską
- **Czary magów lecą prosto w cel** (bez łuku góra–dół). Kula ognia: jasne jądro, płomień, smuga w kierunku lotu, ogon iskier i żaru z dymem; przy celu błysk, fala po ziemi, snop iskier i kłąb dymu. Kula wody: jasne jądro, błękitna otoczka, ogon kropel; przy celu rozprysk kropel i krąg wody. Błysk w dłoni przy rzucie
- **Magazynierzy:** drugi magazynier w stodole i dużym spichlerzu stoi obok pierwszego przy drzwiach, a nie na nim

## 0.52.6 — dłuższa doba, spokojniejsza muzyka nocą, zwięzła kronika (2026-10-27)

- **Doba dwa razy dłuższa:** 12 minut zamiast 6 przy tempie 1× — dzień pracy ok. 9,5 min, wieczór ok. 1 min, noc ok. 1,5 min (wieczór i noc dostały też trochę większy kawałek doby). Pora roku trwa teraz 3 doby zamiast 5, więc rok w czasie rzeczywistym jest podobny (ok. 2,4 h). Chata pali na dobę 2 drewna zamiast 1 — zużycie opału na minutę bez zmian. Jedzenie, podatki i nastroje liczą się jak dotąd co „miesiąc” (100 ticków), więc gospodarka w czasie rzeczywistym się nie zmienia; wilki i napady zbójów (raz na dobę) zdarzają się rzadziej
- **Muzyka nie nakłada się wieczorem:** generowany bordun już nie gra pod utworami z plików, lutnia spod karczmy milknie, gdy leci muzyka, a karczemny utwór „Old Tower Inn” gra tylko w menu (nocą w grze zostaje spokojny utwór nocny)
- **Wilki rzadko i cicho:** nocą wycie raz na kilka minut (i nie za każdym razem), jeden–dwa głosy, ciszej, bez warczenia z daleka; gdy wataha jest na mapie, słychać ją co pół minuty–minutę zamiast co kilka sekund
- **Kronika tylko o ważnym:** bez „Świta. Nowy dzień” / „Zapada zmrok” i bez „lud raduje się drużyną”; ta sama zwykła wiadomość wraca najwcześniej po 3 minutach (pilna po minucie). Kronika trzyma 20 ostatnich wiadomości — przy kolejnej najstarsza wypada
- Poprawka: wilk stojący po skosie obok człowieka teraz gryzie (wcześniej nie znajdował drogi i wracał do lasu)
## 0.52.5 — większe karty budynków, szersze okno budynku (2026-10-27)

- Pasek budowy zajmuje teraz całą szerokość, więc karty są szersze (132 zamiast 104 px) i z większym podglądem budynku (112 zamiast 84 px). Gdy wszystkie się nie mieszczą, przewijają się w bok: widoczny pasek przewijania pod kartami, a kółko myszy nad kartami też przewija w lewo i prawo
- Okno budynku, wojska i postaci po prawej jest szersze (440 zamiast 340 px), a gdy jest otwarte, minimapa się chowa i nie nachodzi na nie; po zamknięciu okna wraca

## 0.52.4 — kałuże po deszczu bez migania (2026-10-27)

- Kałuże nie migają, nie znikają przy przybliżaniu i oddalaniu i nie są pocięte: każda leży na terenie (idzie za nierównościami drogi), a w obrazie jest odsuwana o kilka cm ku kamerze, więc zawsze leży nad nawierzchnią drogi. Wcześniej były płaskimi dyskami, których brzeg wchodził pod drogę
- Nowy wygląd: nieregularny, miękki brzeg, ciemna obwódka mokrego błota, gładka woda odbijająca niebo, drobna fala od wiatru i kręgi od kropel w deszczu
- Rosną, gdy pada, i kurczą się od brzegów przy schnięciu (małe znikają pierwsze), zamiast całe blaknąć. Tylko na płaskich kawałkach drogi i wydłużone wzdłuż drogi, jak w koleinach (`src/render/puddles.ts`)

## 0.52.3 — zboże na polu z teksturą (2026-10-27)

- Pszenica na zagonach farmy nie jest już gołymi stożkami w jednym kolorze: każda kępa to skrzyżowane karty z teksturą (źdźbła z kolankami, liście, kłosy z ziarnami w dwóch rzędach i długimi ośćmi), w czterech odmianach kęp, u dołu łanu ciemniej. Cień rzuca tylko to, co widać na teksturze, nie cała karta. Kod wydzielony do `src/render/wheat.ts`; łan dalej faluje i rośnie jak wcześniej

## 0.52.2 — pasek budowy na całą szerokość (2026-10-27)

- Po otwarciu kategorii (Osada, Żywność, Przemysł…) pasek z budynkami rozciąga się od lewej do prawej krawędzi ekranu, więc mieści się więcej kart. Grupy wojska 1–0 i minimapa w tym czasie chowają się płynnie, a po zamknięciu wracają dokładnie tak, jak były (zwinięta minimapa zostaje zwinięta)
- Koszt budynku na karcie to krótki rząd ikon z liczbami zamiast „Drewno: 99 · Kamień: 44 · Ruda: 66” w kilku linijkach — karty są niższe i równe; pełny opis kosztu w podpowiedzi
- Grupy wojska 1–0 można zwinąć strzałką obok (zostaje mały przycisk „1–0”); stan zapamiętuje przeglądarka. Skróty klawiszowe grup działają też po zwinięciu

## 0.52.1 — każdy magazyn ma swoją zawartość (2026-10-27)

- Okno składu, stodoły, spichlerza i zbrojowni pokazuje dokładnie to, co leży w tym jednym budynku, i ile sztuk (pasek też liczy tylko ten budynek); pod spodem suma ze wszystkich magazynów tego rodzaju, gdy jest ich więcej
- Zawartość jest prawdziwa: robotnik wnosi towar do magazynu, w którym jest miejsce, a po surowiec idzie tam, gdzie on leży. Zjedzone racje, zapłata za budynki i łup zmieniają zawartość magazynów (najpierw ubywa tam, gdzie leży najwięcej). Stosy w modelach magazynów pokazują ich własną zawartość (`sim/systems/stock.ts`, opis w `docs/magazyny.md`)

## 0.52.0 — magazyny jako prawdziwa logistyka, nowy skryba z kroniką (2026-10-27)

- **Pełny magazyn:** nadmiar już nie przepada. Robotnik kładzie ładunek pod drzwiami magazynu (stos leży naprawdę, jest w zapisie gry) i wraca do warsztatu, gdzie czeka i nie robi kolejnego towaru, dopóki nie zwolni się miejsce. Potem warsztat rusza sam. Bez żadnego magazynu danego rodzaju towar zostaje na ziemi, a nowy magazyn go przejmuje
- **Magazynierzy:** skład, spichlerz i zbrojownia mają po jednym, stodoła i duży spichlerz po dwóch. Gdy jest miejsce, wnoszą towar spod drzwi, w wolnej chwili wynoszą gruz z rozbiórek (jeden na rozbiórkę). Magazyny są połączone: jedna lista stosów, na każdy stos idzie dokładnie jeden człowiek (najbliższy, najpierw z tego magazynu). Bez wolnego magazyniera czekający robotnik sam wnosi swój towar
- Magazynier to rezerwa: warsztat, koszary, straż i budowa biorą go, gdy przy ognisku nikogo nie ma; liczy się do miejsc przy ognisku i odchodzi z osady jak bezrobotny (magazyny nie ściągają ludzi za darmo)
- **Na mapie:** stosy ładnie ułożone wzdłuż ściany po obu stronach wejścia — worki, kosze i beczki na palecie, deski w sztaplu z przekładkami — i znak nad pełnym magazynem (tarcza ze skrzynią i wykrzyknikiem). Czekający robotnik siedzi w warsztacie albo stoi na skraju pola. Magazyn bez magazyniera nie dostaje znaku „brak pracownika”
- **Okno magazynu:** magazynierzy i co robią, towar pod drzwiami (i pod innymi magazynami), które warsztaty czekają i co z tym zrobić. Okno warsztatu mówi wprost, że towar leży pod magazynem, a pracownik czeka
- **Skryba:** jedna wiadomość przy każdym zapełnieniu (kto stoi, co leży, co postawić, przycisk „Pokaż”) i jedna, gdy magazyn znowu ma miejsce
- **Skryba — nowy wygląd:** dymki w stylu paneli gry, kwadratowy portret w złotej ramce, imię tym samym krojem co treść. **Kronika:** przycisk „Kronika” w rogu otwiera listę ostatnich 60 wiadomości z dniem i godziną gry (z przyciskami „Pokaż”), z licznikiem nieprzeczytanych; Esc zamyka
- **Bot** stawia kolejny skład, stodołę albo zbrojownię, gdy jego warsztaty czekają na miejsce (spichlerza nie — pełny spichlerz to dużo jedzenia), a pierwszego drwala stawia przed wszystkim innym
- Opisy składu, stodoły, spichlerzy i zbrojowni poprawione (stodoła trzyma zboże, skład piwo, zbrojownia także miecze i kolczugi), „Jak grać”: rozdziały „Pełny magazyn” i „Magazynierzy”
- Logika opisana w `docs/magazyny.md`, uwagi o wydajności dopisane do `docs/pomysly.md`

## 0.51.14 — mniejsze karty budynków, pogrupowane po funkcji (2026-10-27)

- Karty w pasku budowy mniejsze (104 px zamiast 150 px, obrazek 84 px zamiast 134 px) — mniej zasłaniają mapę. Skalowanie interfejsu z ustawień działa jak dotąd
- W każdej kategorii karty ułożone w grupy z podpisem i kreską między nimi, np. Osada: Mieszkania · Życie osady (obozowisko, karczma, kapliczka, studnia, pochodnia) · Składy · Rzemiosło i magia; Jedzenie: Z natury · Chleb · Piwo · Spichlerze; Obrona: Mury i bramy · Wieże i ogień. Lista grup w `src/ui/buildGroups.ts` — nowy budynek dopisz do grupy, bez wpisu trafi do „Inne”

## 0.51.13 — chleb się opłaca, opis studni, leśniczy na ilu drwali (2026-10-27)

- **Chleb:** młyn mieli naraz do 128 zboża (wcześniej 16), więc przerobi zbiory z ok. 5 pól; piekarnia bierze 16 mąki i piecze 40 chlebów (wcześniej 4 → 10), czyli jeden młyn wystarcza na ok. 8 piekarni. Zmierzone w symulacji na dobę: pole ok. 150 zboża, młyn ok. 770 mąki, piekarnia ok. 240 chlebów (480 porcji). Pełny łańcuch daje teraz więcej jedzenia na pracownika niż sady (wcześniej mniej niż połowę, stąd wrażenie, że piekarnia nic nie daje)
- Młyn i piekarnia przy pustawej stodole biorą, co jest (byle ćwierć wsadu), i robią odpowiednio mniej — przy jednym polu młyn nie stoi pół dnia
- Prognoza w oknie spichlerza liczy piekarnie po tym, ile starcza im mąki i zboża (młyn ok. 8 piekarni, pole ok. 1,5), a nie „po jednej na młyn i pole”
- Bot stawia drugie pole i drugą piekarnię w dalszej części rozbudowy
- **Studnia** ma wreszcie opis: gaszenie pożarów (bez studni nikt nie gasi), susza przy sadach i polach do 8 pól, mniejsze ryzyko zarazy
- **Chata leśniczego:** w opisie, ile trwa sadzenie i ścinanie — leśniczy ok. 7 dorosłych drzew na dobę (limit 14 sadzonek, 2 dni wzrostu), drwal 2–3 drzewa na dobę, więc jeden leśniczy na 2–3 drwali (na zimę lepiej jeden na dwóch)
- Opisy pola, młyna i piekarni oraz „Jak grać” z nowymi liczbami (PL i EN)

## 0.51.12 — pory roku bez drugiej kompilacji, „Nowa gra” bez zatrzymania (2026-10-26)

- **Pory roku:** łatki śniegu, jesieni i szronu dokładały się do materiałów skanem co 3 s, więc każdy nowy budynek, plac budowy czy kępa trawy kilka sekund po pojawieniu się kompilował shadery drugi raz, już na żywo (krótka zwiecha). Rozgrzewka przy starcie też kompilowała wersje bez łatek. Teraz łatka trafia na nowe obiekty od razu, przed kompilacją w tle, a rozgrzewka kompiluje budynki i mapę już z nią
- **„Nowa gra” i „Wstecz”:** teren podglądu mapy budowany etapami (podłoże, woda, góry, las, trawa, drogi…) z przerwą na klatkę między nimi, zamiast ok. 0,7 s zatrzymania strony; najdłuższy etap (mapa głębokości wody, ok. 0,3 s) podzielony na kawałki. Czasy etapów w konsoli (`[teren]`)
- **Poprawka do 0.51.11:** po wczytaniu mapy kompilacja w tle dostawała naraz tysiące obiektów i przeglądała je w każdej klatce od nowa (nawet 0,4–0,5 s na klatkę przez kilka sekund po wejściu). Teraz materiały obiektu zbierane są raz, a po pełnej rozgrzewce lista startuje pusta
- Lista pozostałych rzeczy od płynności: `docs/pomysly.md` → „Płynność wczytywania i gry”

## 0.51.11 — stawianie wieży i bramy bez zwiechy (2026-10-26)

- **Poprawka:** pierwsza wieża, brama, plac budowy czy podgląd stawiania potrzebowały nowych shaderów, a karta kompilowała je w chwili pierwszego rysowania — gra stawała na 0,1–1 s przy każdym (pierwsza wieża: 11 shaderów). Teraz każdy nowy obiekt w trakcie gry kompiluje się w tle i pokazuje dopiero, gdy jest gotowy (zwykle po kilku klatkach, najdłużej 1,5 s). Obiekty z gotowymi shaderami pokazują się od razu (`src/render/precompile.ts`)

## 0.51.10 — płynne wejście do gry (2026-10-26)

- **Poprawka:** po „Kontynuuj” i „Rozpocznij” pętla gry rysowała nową mapę, zanim jej shadery zdążyły się skompilować w tle — każda taka klatka blokowała stronę na 1–3 s. Teraz od zbudowania mapy do końca kompilacji gra nic nie rysuje (pasek chodzi dalej)
- Obchód kamerą przy wczytywaniu: z każdego kierunku najpierw powstaje to, co widać (kępy trawy, paprocie, trzciny, dalekie wersje modeli) i kompiluje się w tle, dopiero potem rysujemy — bez przycięć po 1–2 s. To samo przy podglądzie mapy w „Nowej grze”

## 0.51.9 — wczytywanie bez zamarzania (2026-10-26)

- **Poprawka:** krok „Przygotowanie grafiki” zatrzymywał stronę na 12 s przy pierwszym wejściu (ok. 5 s przy kolejnych) — przeglądarka stała, pasek ani drgnął, a Chrome potrafił pytać, czy zamknąć kartę. Kompilacja shaderów wszystkich budynków idzie teraz w tle na karcie graficznej (`compileAsync`, równoległa kompilacja), a modele próbne budują się partiami z przerwą na klatkę — pasek pokazuje „budynki n / 49”. Plac budowy do rozgrzewki to kopia gotowego modelu (wcześniej każdy budynek budował się dwa razy od zera). Na czas kompilacji gra nie rysuje klatek (rysowanie i tak czekałoby na kartę). To samo przy wejściu do gry i przy podglądzie nowej mapy

## 0.51.8 — pomosty wież nie ciemnieją z daleka (2026-10-26)

- **Poprawka:** to samo co przy posadzce zamku, tylko na wieżach kamiennych (zwykłej i wielkiej baszcie): po oddaleniu kamery deski pomostu łuczników robiły się ciemne i plamiste. Pod deskami leżał wierzch ciemnej płyty chodnika, który gra rysuje „o włos bliżej” kamery, więc z daleka przebijał przez deski. Płyta ma teraz tylko boki i spód, a pod deskami leży zwykły kamień 3 cm niżej

## 0.51.7 — posadzka zamku nie ciemnieje z daleka (2026-10-25)

- **Poprawka:** po oddaleniu kamery dziedziniec i sale zamku robiły się ciemne i plamiste, jakby leżał na nich dziwny cień. To nie był cień: 1,2 cm pod płytami posadzki leżał wierzch podmurówki, a gra rysuje drobne detale „o włos bliżej” kamery (żeby nie migały na murach) — z daleka ten zapas rósł i ciemna podmurówka przebijała przez posadzkę. Podmurówka jest teraz 8 cm niżej, a płyty posadzki sięgają do niej, więc z każdej odległości widać bruk i deski

## 0.51.6 — ognisko jako znak „bez pracy” (2026-10-25)

- Licznik wolnych chłopów w pasku ma ikonkę ogniska (jak w Twierdzy, gdzie wolni ludzie czekają przy ognisku) zamiast chłopa z przekreślonym młotkiem

## 0.51.5 — powrót do meczu z samymi botami (2026-10-25)

- **Mecz przez sieć, w którym jesteś jedynym człowiekiem** (reszta to boty): „Wróć do meczu” wczytuje stan od razu z tej przeglądarki (z pamięci karty po zerwanym połączeniu albo z zapisu po odświeżeniu) i gra dalej przez sieć, z rankingiem jak wcześniej. Wcześniej gra czekała 45 s, aż „grający” wpuszczą z powrotem — a boty nie mają jak odpowiedzieć

## 0.51.4 — nowa ikonka „bez pracy” (2026-10-25)

- Pasek u góry: licznik wolnych chłopów ma nową ikonkę — chłop i przekreślony młotek zamiast łóżka z „z”, które myliło się ze snem

## 0.51.3 — siedziby magów nie tracą dachów (2026-10-25)

- **Poprawka:** gdy w Wieży Płomienia, Sanktuarium Źródła (chatka maga ma już własne wnętrze, więc u niej dach dalej się zdejmuje) ktoś był w środku, gra zdejmowała dach i ściany jak przy budynkach z wnętrzem — a te modele wnętrza nie mają, więc zostawały same dziurawe mury. Teraz budynek bez wnętrza zawsze stoi w całości

## 0.51.2 — poprawki po graniu: wieże, koksowniki, łóżka, upadki, magowie, chatka maga (2026-10-25)

- **Wielka baszta** strzela o 6 pól dalej (było 3) — najdalej ze wszystkich wież; **koksowniki** mniejsze (na wieżach 60%, na murach 50% dawnej wielkości), płomień razem z nimi
- **Śpiący w chacie:** po trzy posłania pod każdą ścianą z odstępem (wcześniej czterech leżało na sobie, a nogi wchodziły na ławę i stół), koc przykrywa nogi i brzuch; kto się nie mieści, śpi niewidoczny
- **Upadek poległych płynnie:** przewrót liczony z ułamkiem ticku (wcześniej szedł skokami, 10 razy na sekundę); to samo u zabitych wilków
- **Magowie:** nie noszą już kilofa, maczugi ani pochodni; rekrut w drodze do siedziby na szkolenie wygląda jak chłop (wcześniej już jak mag, więc magowie się „dublowali”); uzdrowiciele bez roboty czekają w siedzibie, a nie przed nią (wyglądali jak drugi mag bojowy); w obronie mag z chatki i z siedziby razi wroga czarem z 5 pól (ogień albo woda ze spowolnieniem), zamiast walić pałką
- **Chatka maga ma wnętrze:** mur pusty w środku, a w izbie posłanie na ramie, stół z księgą, moździerzem i świecą, półka z dzbanami i ziołami, palenisko z żarem i kociołek (po zdjęciu dachu było widać płaską pokrywę)

## 0.51.1 — trawa rzadsza, ciemniejsza i lżejsza (2026-10-25)

- **Trawa:** kępy co 0,26 pola zamiast co 0,19, przy tym samym zasięgu wokół kamery — ok. połowa mniej kęp do narysowania (szybciej na karcie graficznej)
- Łąka stoi płatami z gołą ziemią między nimi, zamiast równego dywanu; kępy nieco mniejsze
- Barwa ciemniejsza i przygaszona (oliwkowa, nie jaskrawa), żeby pasowała do surowego klimatu gry

## 0.51.0 — kryształy magii z kopalni, droga druga kopalnia, twardsza kopalnia i zamek (2026-10-25)

- **Kryształ magii:** nowy, rzadki urobek z głębokiej galerii kopalni (ok. 3% kursów, po 1 sztuce), trafia do skarbca w zamku jak ruda; kafelek w pasku zapasów, fioletowy kryształ w koszu u niosącego. Mag bojowy kosztuje teraz też 1 kryształ, a siedziba zakonu 4
- **Druga kopalnia kosztuje fortunę:** pierwsza jak dotąd (30 drewna), druga i każda następna 300 drewna, 300 kamienia, 60 żelaza i 400 rudy (karta pokazuje cenę)
- **Twardsze cele:** kopalnia 3000 wytrzymałości (było 360), zamek 15 000 (było 6000)
- **Boty:** drugą kopalnię stawiają dopiero na samym końcu listy budowy; magów szkolą i siedziby stawiają, gdy mają kryształy (ta sama cena co u gracza)
- „Jak grać”: kopalnia (kryształy, cena drugiej, wytrzymałość) i magowie bojowi (koszt w kryształach), PL/EN

## 0.50.0 — kaznodzieja przy kapliczce i święto (2026-10-25)

- **Kaznodzieja:** kapliczka ma teraz pracownika. Nowa postać z Blendera (`tools/models/mage.py preacher`): wełniana szata, płaszcz z ciemnego sukna, żelazny znak Ojca Płomienia, ogolona głowa i siwa broda. Za dnia stoi przy kapliczce, o zmierzchu dzwoni dzwonek i mówi kazanie: staje z boku posągu przodem do ludzi, co kilka sekund wznosi ręce, słychać go z bliska
- Z kaznodzieją na modlitwę przychodzi dwa razy więcej ludzi (co drugi spoza karczmy), a kazanie daje +1 do popularności ponad samą kapliczkę
- **Święto co 7 dni** (z kaznodzieją): skryba ogłasza je rano, przez cały dzień +2 do popularności, a wieczorem pod kapliczkę idzie cała osada; dzwon bije dłużej
- Odzywki kaznodziei (PL/EN), cech „kaznodziejów” na karcie, opis kapliczki i tabela popularności w „Jak grać”, kaznodzieja w podglądzie modeli (zwykły i w kazaniu)
- **Boty:** stawiają kapliczkę jak dotąd, kaznodzieja przychodzi do niej sam, więc kazania i święta mają tak jak gracz

## 0.49.0 — kwarantanna w czasie zarazy (2026-10-25)

- **Kwarantanna:** w czasie zarazy okno chaty ma przycisk „Zamknij chatę (kwarantanna)”. W zamkniętej chacie leżą tylko chorzy (inni chorzy idą tam najpierw), zdrowi domownicy wychodzą i śpią gdzie indziej (i nie odpoczywają w niej po robocie), a zaraza nie wychodzi za drzwi. Ludzie tego nie lubią: −1 do popularności, póki jakaś chata jest zamknięta. Po zarazie chaty same się otwierają. Magowie dalej wchodzą i leczą
- Zaraza szerzy się teraz głównie pod wspólnym dachem; na dworze (tłum przy ognisku, przy robocie) dużo wolniej i z górnym limitem — wcześniej tłum bezrobotnych przy ognisku zarażał się prawie cały w pół dnia
- **Boty** zamykają chaty, w których ktoś leży w gorączce
- Skryba przy wybuchu zarazy podpowiada kwarantannę; „Jak grać” → Zaraza i magowie: kwarantanna (PL/EN)

## 0.48.0 — burze i susza (2026-10-24)

- **Burza:** przy mocnym deszczu poza zimą piorun od czasu do czasu trafia w budynek i go podpala (ok. 1–2 uderzenia na burzę na gracza). Gaszą ludzie z wiadrami i magowie Źródła, a deszcz sam przygasza każdy pożar. Kamienne budowle (mury, wieże, twierdza, studnia, kapliczka, siedziby magów) się nie palą. W scenie poszarpany kanał pioruna z odnogami do dachu, błysk i trzask grzmotu; skryba z przyciskiem do pożaru (src/sim/systems/storms.ts, src/render/bolts.ts)
- **Susza:** w gorące letnie dni bez deszczu sady i pola rodzą o połowę mniej; studnia najwyżej 8 pól obok ratuje 90% plonu. Skryba ostrzega, pod zegarem napis „burza” albo „susza” z podpowiedzią
- **Boty:** stawiają studnię przy polach (po farmie); pożary od piorunów gaszą jak każde inne
- „Jak grać” → Dzień i noc: burze i susza (PL/EN). Balans w `RULES.storm` i `RULES.drought`. Tryb testowy: `__test.strike(id?)` — piorun od ręki

## 0.47.2 — podział scene.ts na mniejsze pliki, bez zmiany obrazu (2026-10-24)

- Z `src/render/scene.ts` (6241 linii) wyszło do osobnych plików ok. 1160 linii — samodzielne części obrazu, każda w swoim module: animacje ciosów i strzałów (`combatanim.ts`), znaki nad głowami (`marks.ts`), scalanie budynków (`merge.ts`), modele do chodzenia — zamek, karczma, kopalnia (`walkmodels.ts`), strzały w locie (`arrows.ts`), flagi zbiórki i znaczki strzelających wież (`rally.ts`), wrota bram (`gates.ts`), niebo — kopuła, gwiazdy, księżyc, słońce (`sky.ts`), kurz i odpryski (`dust.ts`), koksowniki (`braziers.ts`), gruz i zapadające się budynki (`rubble.ts`), częstokół i mury kamienne (`walls.ts`), place budowy z rusztowaniami (`sites.ts`), poświata pochodni (`torchglow.ts`)
- W grze nic się nie zmienia. Sprawdzone nowym spisem sceny 3D (`tools/check/census.mjs`, `__test.census()` w trybie testowym): mapa 2 na 2 z osadą, wojskiem i bitwą — w dzień, nocą, z bliska i na spacerze — przed i po podziale ma te same obiekty, siatki, materiały i liczby kopii; różnią się tylko rzeczy losowe (krople deszczu, gwiazdy, dym) i klatki ruchu ludzi, tak samo jak przy dwóch uruchomieniach starej wersji
- Testy każdej wyniesionej części bez przeglądarki (`tests/scene-split.test.ts`): strzały lecą i znikają, wrota skrzypią i się domykają, flagi tylko nad moimi koszarami, mury z bali i bloków, pokazowa budowa z rusztowaniem, gruz maleje, niebo nocą z księżycem
- Dalsza kolejka podziału w `docs/pomysly.md`; sposób sprawdzania opisany w CLAUDE.md (Testy, punkt 5)
## 0.47.1 — mniej rudy z podatków (2026-10-24)

- Podatek liczy się teraz na 6 ludzi, nie na 2: niski 1 ruda na 6 osób miesięcznie, średni 2, wysoki 3; rozdawanie 2 rudy na 6 osób. Przy 40 ludziach i niskim podatku ok. 170 rudy na dobę zamiast ok. 500. Popularność od podatków bez zmian. Boty płacą i zarabiają tak samo jak gracz
- „Jak grać”: nowe stawki podatku (PL/EN)

## 0.47.0 — wolniejsze tempo gry: etapy osady i droższe kolejne budynki (2026-10-24)

- **Etapy osady:** wioska na start, osada od 20 ludzi, gród od 40, miasto od 70. Późniejsze budynki dopiero na wyższym etapie (osada: młyn, piekarnia, browar, karczma, cech, mury i brama z kamienia, kamienna wieża, namiot medyka, kosz z ogniem; gród: kuźnia, płatnerz, duży spichlerz, duża wieża, siedziby magów; miasto: wielka wieża). Raz osiągnięty etap zostaje. Zablokowana karta pisze „Od etapu: Gród (40 ludzi)”, skryba ogłasza nowy etap i to, co się odblokowało, rozpiska ludności pokazuje etap i próg następnego
- **Każdy kolejny taki sam budynek +10% ceny** (najwyżej 2× pierwszego); karta pokazuje cenę następnego. Drogi, palisada, mury, bramy, drabiny, pochodnie, kosze z ogniem i studnie zawsze po zwykłej cenie. Zwrot przy wyburzeniu i odbudowa ruin liczą się od zwykłej ceny
- **Droższe późne budynki:** kuźnia i płatnerz 70 drewna, 60 kamienia, 30 rudy; kamienne wieże 80/170/300 kamienia; duży spichlerz 110 drewna, 100 kamienia; karczma 90 drewna, 40 kamienia, 60 rudy; cech 80/50; browar, młyn, piekarnia, namiot medyka i koszary też trochę drożej
- **Boty** podlegają tym samym etapom i cenom. Żeby rosły jak gracz: najpierw sad, gdy jedzenia zaczyna brakować (sad karmi ok. 6 ludzi), i drwal, gdy wolni ludzie czekają na drewno; drugie obozowisko (bez wolnego miejsca przy ognisku nikt nie przychodził — boty stały na 17 ludziach); koszary przed obozowiskami; palisada nie zjada drewna, gdy brakuje jedzenia
- „Jak grać” → Budowa i drogi: etapy osady (tabela) i rosnące ceny; poprawione stare koszty w pomocy (koszary, cech, brama, wieże)

## 0.46.1 — ucieczka z meczu przez sieć to porażka w rankingu (2026-10-24)

- Na starcie meczu przez sieć każdy gracz dostaje w wynikach wpis „w toku”. Kto dogra mecz do końca (także po powrocie po zerwanym połączeniu), dostaje prawdziwy wynik; kto uciekł i nie wrócił, zostaje z porażką. Ranking liczy taki wpis dopiero po 3 godzinach, więc trwający mecz nie psuje nikomu bilansu. Kooperacja przeciw botom dalej nie liczy się do rankingu
- Wymaga wykonania w Supabase migracji `supabase/migrations/20261024_results_pending.sql` (SQL Editor). Do tego czasu gra zapisuje wyniki jak dotąd
- „Jak grać”: zdanie o porażce za ucieczkę (PL/EN)

## 0.46.0 — magowie bojowi (2026-10-24)

- **Magowie do walki** szkolą się w siedzibie swojego zakonu (okno Wieży Płomienia / Sanktuarium Źródła, karty jak w koszarach): mag Płomienia za 50 rudy, mag Źródła za 45, do tego wolny chłop. **Najwyżej 10 na gracza**, razem obu zakonów (licznik na karcie). Uzdrowiciele w siedzibie zostają osobno
- **Mag Płomienia:** kula ognia (nigdy nie chybia), parzy też wrogów tuż przy celu, podpala budynki. **Mag Źródła:** czar wody — odrzuca trafionego o pole i spowalnia go o połowę na chwilę; bez walki gasi własne płonące budynki w zasięgu
- Wygląd: postacie zakonów z Blendera (te same co uzdrowiciele), przy czarze ręce w górze z kulą w dłoni; kula ognia z płomieniem i rozbłyskiem, błękitna kula wody z rozpryskiem; ciała magów w ich szatach; portrety z modelu
- **Boty:** w osadzie od 30 ludzi stawiają siedzibę zakonu (parzyste Źródła, nieparzyste Płomienia) i szkolą magów — do 6, na trudnym do 10
- Nowa zasada projektu w CLAUDE.md: każdy nowy budynek, jednostka i mechanika od razu trafia też do bota
- „Jak grać” → Wojsko: magowie bojowi (tabela, porada)

## 0.45.0 — powrót do meczu przez sieć, bot przejmuje zamek po rozłączeniu (2026-10-24)

- **Zerwane połączenie to już nie poddanie.** Gdy ktoś zamknie albo odświeży kartę lub zgubi sieć, jego zamkiem rządzi bot (buduje, szkoli wojsko, broni się), a mecz toczy się dalej. Poddanie zostaje porażką tylko wtedy, gdy gracz sam się podda albo wyjdzie z meczu przez menu
- **Powrót do meczu:** przeglądarka pamięta trwający mecz. Po ponownym wejściu do gry (na tym samym koncie) pojawia się okienko „Wróć do meczu”. Jeden z grających przesyła wtedy stan gry (skompresowany, w kawałkach), bot oddaje zamek i gra rusza od tego miejsca u wszystkich tak samo. Inni widzą komunikat, kto stracił połączenie i kto wrócił
- Gracz, którego inni odcięli za długie milczenie (słabe łącze), dowiaduje się o tym i sam wraca do meczu tą samą drogą
- Spóźnione polecenia gracza, który już wyszedł, nie wchodzą do gry (u jednych by doszły, u innych nie)
- Gospodarz, który odświeży stronę, nie kasuje już pokoju — mecz trwa, a on może do niego wrócić
- Pamięć bota o braku skały pod kopalnię jest teraz w stanie gry (wcześniej wspólna dla wszystkich gier na stronie), więc gra wczytana w trakcie liczy się dalej identycznie
- „Jak grać”: rozdział o grze przez sieć mówi o powrocie do meczu i o wymaganym logowaniu (PL/EN)
- Testy: zapis w środku meczu 2 na 2 liczy się dalej krok w krok z oryginałem; trzech graczy, jeden odświeża stronę, wraca i dalej wszyscy mają ten sam stan

## 0.44.0 — zaraza i magowie przy pracy (2026-10-24)

- **Zaraza.** Bierze się z niepochowanych ciał (po bitwie, po wilkach), głodu, ciasnoty w chatach, spania pod gołym niebem i zimy, trochę z samej liczby ludzi; pierwsze trzy doby gry są spokojne, poziom pokojowy bez zarazy z niczego. Chory najpierw pracuje i już zaraża (przy robocie, przy ognisku), potem leży w gorączce w chacie albo na słomie — jego warsztat, pole czy kopalnia stoją. Leżący zaraża śpiących pod tym samym dachem
- Bez magów umiera mniej więcej co trzeci chory (głodni i śpiący pod gołym niebem częściej), a stojące warsztaty dokładają głód. Osada nie wymiera: kto przechoruje, ma odporność na 6 dób, więc zaraza sama wygasa, a śmierć oszczędza ostatnich czterech ludzi. Po zarazie 2 doby spokoju
- **Magowie przy pracy:** chatka maga ma jednego maga, siedziby zakonów do trzech (1 na 12 mieszkańców). Magowie sami chodzą do chorych, nie śpią i nie chorują; przy czarze mają ręce w górze z kulą w dłoni:
  - Bractwo Źródła leczy najlepiej (prawie każdy przeżyje i szybciej wstaje), z dłoni leci struga wody;
  - wędrowny mag z chatki leczy wolniej i słabiej, ale dużo ratuje;
  - Zakon Płomienia pali niepochowane ciała i wypala zarazę z chat (dobę nikt się w nich nie zaraża), ogień w dłoniach i dym u celu;
  - oba zakony razem czarują szybciej, ale siedziby bliżej niż 12 pól od siebie kłócą się (−1 popularności)
- Siedziby magów, chatka i studnia zmniejszają szansę wybuchu zarazy. Popularność: zaraza −2 co miesiąc, każdy zgon −1, magowie w osadzie +1
- Skryba ogłasza wybuch zarazy (z przyciskiem do chorego), ostrzega, gdy nikt nie leczy, i podaje liczbę ofiar po końcu. Nad chatami z chorymi i nad chorymi na słomie znak zarazy; leżący kaszlą. Okno siedziby magów: ilu magów, co robią, ilu chorych. Karta chłopa: wylęga się / w gorączce / pod opieką maga / odporny. Rozpiska ludności: leżący w gorączce
- Odzywki chorych, ludzi w czasie zarazy i magów (PL/EN), nowy rozdział „Zaraza i magowie” w „Jak grać”, nazwy faz pracy 23–29
- Bot stawia chatkę maga po cmentarzu. Tryb testowy: `__test.plague(n, gorączka?)`

## 0.43.0 — własne nazwy zakonów magów, autorzy w grze (2026-10-24)

- Magowie dostali własne zakony zamiast nazw z innych gier: **Wieża Płomienia** (Zakon Płomienia) i **Sanktuarium Źródła** (Bractwo Źródła); w podglądzie modeli Mag Płomienia i Mag Źródła. Kapliczka zostaje przy Ojcu Płomienia, więc zakon i wiara są spójne. Opisy po polsku i angielsku
- Z opisów w grze zniknęły odwołania do innych gier (pomoc o rudzie, opisy strażnika i zbrojnego w podglądzie modeli). Ruda zostaje rudą
- Nowa zakładka **Ustawienia → Autorzy**: autorzy grafiki na licencjach CC BY i CC BY-SA (0 A.D., Secret Histories, autorzy modeli ze Sketchfab) oraz podziękowania dla źródeł CC0. CREDITS.md uzupełniony o kruka, efekty Kenneya i głosy

## 0.42.0 — siedziby magów 5×5 z dziedzińcem, chatka maga (2026-10-24)

- **Siedziba magów ognia** i **siedziba magów wody** urosły do 5×5 pól. Dawna wieża i sala zostały jak były, a przed nimi dobudowany dziedziniec za niskim murem z bramą (tools/models/mageyard.py):
  - ogień: plac z płyt, brama na filarach z koszami ognia i czerwonymi płachtami, skrzydło z celami magów pod dachówką (z kominem), krąg ćwiczeń z osmaloną ziemią i opalonymi słupami-celami, drewutnia z węglem
  - woda: jasny plac z płyt, długi staw z liliami i małą kaskadą na osi od bramy do portyku, kanał z sadzawki z fontanną, kolumnada pod łupkiem wzdłuż muru, grządki z ziołami, ławy przy stawie, skrzydło z celami, brama z latarniami i granatowymi płachtami
- Siedziby są drogie (ogień: 320 kamienia, 140 drewna, 40 żelaza, 220 rudy; woda: 280 kamienia, 160 drewna, 30 żelaza, 220 rudy) — to cel na czas, gdy osada urośnie
- Nowy, tani budynek: **chatka maga** (2×2, 30 drewna i 10 kamienia; tools/models/magehut.py) — okrągła chata z polnego kamienia pod strzechą, zioła pod okapem, misa z żarem i koryto z wodą przy drzwiach. Jeden wędrowny mag będzie w niej leczył słabiej niż siedziby, ale osada nie wymrze, zanim zbierzesz na wieżę albo sanktuarium
- Opisy po polsku i angielsku. W trybie deweloperskim przy twierdzy staje tylko chatka maga (siedziby 5×5 z murem zatkałyby osadę)

## 0.41.0 — budynki magów: wieża magów ognia i sanktuarium magów wody (2026-10-24)

- Dwa nowe budynki z Blendera w zakładce Osada (3×3 pola):
  - **Wieża magów ognia** (80 kamienia, 30 drewna, 40 rudy; tools/models/magefire.py): ośmioboczna baszta z ciosów na cokole, wąskie ostrołukowe okna w trzech kondygnacjach, okute drzwi pod ostrołukiem na schodkach, dach ośmiospadowy z czerwonej dachówki z lukarną i grotem z tarczą słońca; z boku pracownia z kominem; przed wejściem brukowany krąg z wielkim zniczem z brązu (płonie cały czas) i żelazne kosze z żarem przy drzwiach; czerwone płachty, ława, stos polan, kosz z węglem
  - **Sanktuarium magów wody** (70 kamienia, 30 drewna, 40 rudy; tools/models/magewater.py): jasna sala z ciosanego kamienia pod łupkiem, portyk na dwóch kolumnach z trójkątnym szczytem, okrągła rozeta nad drzwiami, smukłe okna i granatowe płachty; sadzawka z fontanną w kamiennej cembrowinie, trzciny i ława; z tyłu okrągła cysterna, z przodu dzbany na wodę i latarnie
- Na razie same budynki — magowie (modele są już gotowe), choroba i leczenie dojdą w kolejnych partiach. Opisy po polsku i angielsku
- Nowe materiały budynków: czerwona dachówka, płachty w barwach obu kręgów; podgląd Cycles (render_building.py) chowa tylne strony ścian jak gra

## 0.40.5 — naturalniejsze dłonie posągu w kapliczce (2026-10-24)

- Palce posągu nie sterczą już wzdłuż czary jak patyki: są krótsze i grubsze, ułożone jeden nad drugim i lekko podkurczone, obejmują czarę od boku ku przodowi (wskazujący najwyżej, mały najniżej). Kciuk leży na brzegu czary i wskazuje do przodu

## 0.40.4 — poprawiony klęcznik w kapliczce (2026-10-24)

- Deska i słupki klęcznika stoją na posadzce kapliczki (wcześniej deska tkwiła w płycie i z góry było widać czarny prostokąt)

## 0.40.3 — magowie: łokcie i kula czaru w dłoni (2026-10-24)

- Magowie mają łokcie (rękaw podzielony na ramię i przedramię z szerokim mankietem, kula łokcia w kolorze szaty). W marszu ręce lekko zgięte, przy czarowaniu obie uniesione przed pierś ze zgiętymi łokciami
- Przy czarowaniu w prawej dłoni świeci kula: u maga ognia pomarańczowa, u maga wody niebieska (świeci własnym światłem, z poświatą)
- Podgląd modeli: „Mag ognia — czar” i „Mag wody — czar” (modele.html?id=mageFire-cast, ?id=mageWater-cast)

## 0.40.2 — magowie ognia i wody: modele (2026-10-24)

- Dwa nowe modele z Blendera (tools/models/mage.py fire|water), na razie tylko w podglądzie modeli (modele.html?id=mageFire, ?id=mageWater) — w grze pojawią się razem z budynkami magów i chorobą w kolejnych partiach
- Mag ognia: szata w kolorze zaschniętej krwi z obrąbkiem w kolorze żaru, płaszcz z opuszczonym kapturem, ogolona głowa i krótka siwa broda, mosiężna tarcza słońca na łańcuszku. Mag wody: granatowa szata ze srebrzystoniebieskim obrąbkiem, płaszcz w odcieniu nocnego jeziora, włosy i broda, srebrny pierścień z niebieskim kamieniem. Obaj z pasem z plecionego sznura w barwach pana
- Bez kostura — magię rzucają z dłoni. Dłonie z osobnymi palcami i kciukiem, wysunięte spod szerokich rękawów; twarze rzeźbione mocniej niż u chłopów (łuk brwiowy, oczodoły z białkiem i tęczówką, powieki, nos ze skrzydełkami, kości policzkowe, wargi, zmarszczki)

## 0.40.1 — dłonie posągu w kapliczce (2026-10-24)

- Posąg w kapliczce trzyma czarę prawdziwymi dłońmi: dłoń podpiera czarę od spodu, cztery palce w trzech członach leżą wzdłuż ścianki, a kciuk zahacza o brzeg od góry (wcześniej ręce kończyły się kikutami przy czarze)
- W arkuszu modelu (`inspect.sh shrine`) dwa nowe widoki z bliska: dłonie z czarą od przodu i z boku

## 0.40.0 — kapliczka (2026-10-24)

- Nowy budynek w osadzie: kapliczka (2×2, 10 drewna i 40 kamienia). Model z Blendera (`tools/models/shrine.py`): kamienny posąg Ojca Płomienia — brodaty starzec w kapturze z czarą wiecznego ognia — w ostrołukowej niszy ze złotym słońcem pod kluczem łuku; dwustopniowy cokół, żelazne świeczniki z grubymi świecami, małe świece z zaciekami wosku, złota misa z ofiarną rudą i klęcznik z desek. Ogień w czarze płonie zawsze, świece świecą nocą
- Wieczorem część ludzi (co czwarty) zamiast do karczmy albo do ogniska idzie pod kapliczkę: trzech klęczy przy klęczniku, reszta stoi za nimi ze spuszczonymi głowami
- Kapliczka lekko podnosi popularność: +1, przy dwóch i więcej +2 (osobny wiersz w rozpisce popularności)
- Bot stawia jedną kapliczkę; „Jak grać” (popularność, rytm dnia) po polsku i angielsku; testy w `tests/shrine.test.ts`

## 0.39.0 — długi bunt: napady na skład i spichlerz, rozpędzeni uciekają w popłochu (2026-10-24)

- Gdy bunt trwa dłużej (600 ticków, ok. minuta przy tempie 1×), część tłumu (najwyżej połowa, do 6 ludzi) idzie z pochodniami na napad, potem co 400 ticków na kolejny. Reszta zostaje pod bramą
- Napady na zmianę: najpierw skład albo stodoła (znika ćwierć drewna, kamienia, towarów i zboża), potem spichlerz — podpalony, 20% jedzenia w dym, gaszą go ludzie z wiadrami jak zwykły pożar. Gdy jednego z celów nie ma, idą na drugi. Po robocie wracają pod bramę
- Skryba ogłasza każdy napad z przyciskiem „Pokaż” do budynku; ostrzeżenie na początku buntu mówi o przyciskach w oknie twierdzy i o tym, że przeciągający się bunt skończy się plądrowaniem (PL i EN)
- Rozpędzeni przez straż uciekają w popłochu (szybszy krok, ręce nad głową), zanim wrócą do roboty
- „Rozdaj chleb” i rozpędzenie strażą zatrzymują też napady
- „Jak grać” i testy w `tests/unrest.test.ts`

## 0.38.1 — łucznik: prawdziwy naciąg do policzka (2026-10-24)

- Ręka cięciwy obraca się teraz w barku we wszystkich kierunkach, nie tylko w przód: przy pełnym naciągu łokieć idzie w bok na wysokości barku, a dłoń z cięciwą dochodzi do policzka (wcześniej przedramię składało się na samo ramię i dłoń lądowała przy barku). Kąty policzone tak, żeby dłoń trafiała w swoje miejsca: za ucho przy wypuszczeniu, nad prawy bark przy kołczanie, przy łuku przy nakładaniu strzały
- Podgląd z Blendera: łuk trzymany w dłoni za majdan, końce ramion ku łucznikowi (wcześniej podgląd rysował łuk przesunięty przed dłoń); obrót ręki w trzech osiach (`ARMYZ="y,z"`)

## 0.38.0 — bunt: chleb albo pałki, tłum z widłami i pochodniami (2026-10-24)

- W oknie twierdzy w czasie buntu pojawia się osobny blok z liczbą ludzi pod bramą i dwoma przyciskami
- „Rozdaj chleb”: po 4 porcje na każdego buntownika ze spichlerzy (chleb pierwszy, potem jabłka i ryby). Tłum rozchodzi się od razu, głód z rzędu znika, popularność +2. Gdy jedzenia nie starczy, przycisk jest wyszarzony i podpowiada, ile porcji leży w spichlerzach
- „Rozpędź strażą”: popularność −8 od razu, straż miejska idzie pod bramę i rozgania buntowników po kolei (z guzem: −5 zdrowia). Nikt nowy nie dołącza, a gdy pod bramą zrobi się pusto, bunt się kończy. Głód zostaje tuż pod progiem, więc bez jedzenia tłum wraca po dwóch pustych posiłkach. Bez straży przycisk jest wyszarzony
- Buntownicy stoją twarzą do bramy: co trzeci z płonącą pochodnią (także za dnia) i pięścią w górze, reszta wymachuje widłami nad głową. Widły z Blendera (`tools/models/tools.py`, kuta tuleja i trzy zęby), są w podglądzie modeli (Narzędzia i W pracy)
- Bot rozdaje chleb, gdy ma z czego, a bez jedzenia każe straży rozpędzić tłum
- `__test.riot()` w trybie testowym od razu wywołuje bunt
- Rozdział w „Jak grać” (Jedzenie), testy w `tests/unrest.test.ts`

## 0.37.1 — łucznik z łokciami (2026-10-24)

- Łucznik ma łokcie (tools/models/soldier.py: ramię i przedramię osobno, kula łokcia zakrywa styk przy zgięciu). Prawa ręka zgina się naturalnie: przy pełnym naciągu ramię jest poziomo, a dłoń z cięciwą przy twarzy; przy wypuszczeniu dłoń odskakuje za ucho, przy sięganiu do kołczanu ręka idzie przez bark ze zgiętym łokciem. Lewa ręka zostaje prosta — trzyma łuk. W marszu prawa ręka lekko zgięta
- Podgląd z Blendera rysuje przedramię i zgięcie łokcia (`ELBOW=kąt`)

## 0.37.0 — bunt głodowy (2026-10-23)

- Gdy jedzenia brakuje przez 5 posiłków z rzędu (kilka godzin gry), część ludzi rzuca robotę i staje tłumem pod bramą twierdzy: bez straży miejskiej połowa osady, ze strażą mniej więcej co trzeci. Najpierw dołączają ci, którzy pracują, więc warsztaty, pola i kopalnie stają
- Buntownicy nie odchodzą z osady jak reszta głodnych — zostają i czekają na chleb. Zostają też przy swoim zajęciu, więc po buncie wracają prosto do roboty
- Bunt co miesiąc zbija popularność (−3, osobny wiersz w rozpisce popularności), a w rozpisce jedzenia widać, ilu ludzi stoi pod bramą
- Tłum rozchodzi się, gdy ludzie się najedzą. Szybciej przy racjach większych niż zwykłe i gdy jest straż miejska
- Skryba ostrzega na początku buntu (przycisk „Pokaż” do bramy) i daje znać, gdy tłum się rozejdzie. Buntownicy mają własne okrzyki, a straż własne odzywki do tłumu (PL i EN)
- Rozdział w „Jak grać” (Jedzenie), testy w `tests/unrest.test.ts`
## 0.36.0 — łucznik naciąga i sięga do kołczanu, różne upadki poległych, numery grup nad oddziałami (2026-10-23)

- Łucznik w walce strzela fazami zamiast skoku do pozy: wypuszczenie (dłoń odskakuje od cięciwy), sięgnięcie przez bark do kołczanu, wyciągnięcie strzały, nałożenie jej na łuk i pełny naciąg bokiem do celu. Łuk zostaje pionowo w dłoni przez cały ruch; strzała leci w chwili wypuszczenia
- Polegli padają na cztery sposoby: na plecy, na twarz, na bok albo osuwają się (siadają, a potem przewracają się na plecy, nogi kładą się płasko). Dotyczy wszystkich: chłopów, wojska, strażników, zbrojnych, saperów i zbójów
- Numer grupy wisi nad oddziałem na mapie (złota cyfra na ciemnej tarczy, jaśniejsza, gdy grupa jest zaznaczona) i widnieje w rogu portretów zaznaczonych żołnierzy. Wyłącznik: Ustawienia → Interfejs → „Numery grup nad oddziałami”
- „Jak grać”: numery grup opisane po polsku i angielsku
- Podgląd z Blendera: łuk łucznika (`LARM`), pozy poległych (`BODY`, `LEGS`) i kamera z góry (`CAMDOWN`)

## 0.35.7 — poprawiony kosz koksownika (2026-10-23)

- Pręty kosza koksownika rozchylają się teraz na zewnątrz i kończą w górnej obręczy (wcześniej szły do środka, a obręcz wisiała nad żarem jak samotne kółko)

## 0.35.6 — kombinacja mieczem z obrotem, większy grot włóczni (2026-10-23)

- Strażnik miejski i zbrojny walczą kombinacją czterech ciosów po kolei: cięcie z góry (zamach za głowę), cięcie poziome z lewej na prawą, z prawej na lewą (ciało skręca się w poprzek ciosu, klinga idzie poziomo) i cięcie z pełnym obrotem z wyciągniętym mieczem. Między ciosami wraca do gardy; trafienie wypada na końcu każdego cięcia
- Grot włóczni większy i lepiej widoczny z wysokości kamery

## 0.35.5 — cięcie mieczem u strażników i zbrojnych, włócznia w dłoni (2026-10-23)

- Strażnik miejski i zbrojny nie podnoszą już miecza skokiem przy każdym ciosie. Cios idzie fazami jak u zbója: garda (sztych skośnie w górę przed sobą), zamach z mieczem za głową, cięcie w dół i trafienie na końcu cięcia; lewa ręka w walce przed sobą
- Włócznik w walce trzyma włócznię w dłoni (wcześniej wisiała przy boku na stałej osi i ręka jej nie dotykała): garda na wysokości pasa, cofnięcie ręki, pchnięcie z wyprostowaną ręką. Tarcza stale uniesiona
- Podgląd z Blendera rysuje też włócznię włócznika (`SPEAR="kąt,wysunięcie" POSE="ręka,0" render_preview.py spearman …`)

## 0.35.4 — włócznicy pchają włócznią zamiast skakać (2026-10-23)

- Włócznik w walce nie przeskakuje już co cios z włócznią pionowo / poziomo. Przez całą walkę trzyma włócznię opuszczoną poziomo na wroga, a tarczę uniesioną przed sobą. Cios idzie fazami w rytmie jego ciosów: garda, cofnięcie ręki z włócznią, szybki wypad w przód (włócznia wysuwa się wzdłuż drzewca, grot w przeciwniku) i wycofanie. Ruch płynny między klatkami symulacji
- Dotyczy też włóczników bota; strażnicy miejscy, zbrojni i łucznicy bez zmian

## 0.35.3 — prawdziwy cios toporem u zbója (2026-10-23)

- Zbój nie trzyma już topora sztywno w górze przez całą walkę. Cios idzie fazami w rytmie jego ciosów: po trafieniu dociąga cięcie, wraca do gardy (topór skośnie przed piersią), bierze zamach i odchyla topór za głowę, a potem tnie szybko w dół — trafienie wypada na końcu cięcia. Ruch jest płynny między klatkami symulacji
- Druga ręka w walce wysunięta do przodu dla równowagi
- Podgląd z Blendera przyjmuje dowolną fazę ciosu (`POSE="ręka,broń" render_preview.py bandit …`)

## 0.35.2 — zbój: broda, brudna twarz, wilczy łeb (2026-10-23)

- Zbój ma gęstą, skołtunioną brodę z wąsem i brodą opadającą pod szczękę (wcześniej chował ją kaptur), ogorzałą i brudną twarz z cieniem pod oczami oraz brudne dłonie
- Wilczy łeb na lewym barku jest większy i czytelny z wysokości kamery: długi pysk z czarnym nosem, opadnięta dolna szczęka z kłami, sterczące uszy, ciemne oczodoły
- Szerszy otwór kaptura, żeby z przodu było widać brodę

## 0.35.1 — zbój z puszczy z własnym modelem i odzywkami (2026-10-23)

- Zbóje z obozów w lesie mają własny model z Blendera (tools/models/bandit.py) zamiast przyciemnionego włócznika z tarczą: brudna, połatana lniana koszula z podwiniętymi rękawami, kamizela z owczej skóry, na barkach wyliniała wilcza skóra z łbem przewieszonym przez ramię, wełniany kaptur z postrzępionym kołnierzem, gęsta broda, portki z łatą na kolanie, onuce przewiązane rzemieniem, niskie ciżmy, pas ze sznurem, sakwa i nóż w pochwie, skórzany karwasz
- W prawej dłoni topór z brodą (drzewce owinięte rzemieniem w chwycie, klin w oku obucha), bez tarczy; w walce zamach znad głowy. Poległy zbój leży w swoich skórach
- Odzywki zbójów jak w Gothicu, po polsku i angielsku: zaczepki przy napadzie na drwala, groźby w walce z wojskiem, drwiny przy obozie za dnia, straszenie nocą i ucieczka po spaleniu obozu. Zbój blisko kamery odzywa się sam, a kliknięty od razu
- Zbój w podglądzie modeli (modele.html?id=bandit); podgląd z Blendera pokazuje teraz także broń w dłoni (`STRIKE=1` — zamach)

## 0.35.0 — większe kamienne wieże i koksownik z ognistymi strzałami (2026-10-23)

- Dwie nowe kamienne wieże w umocnieniach: **Duża baszta** (3×3 pola, 10 łuczników, strzelają o 2 pola dalej, wykusze z blankami na rogach) i **Wielka baszta** (4×4, 16 łuczników, o 3 pola dalej, skarpowany cokół, wykusze pod łupkowymi daszkami). Jak zwykła kamienna wieża stają na wolnym polu albo wprost na murze. Modele z Blendera (`tools/models/stonetower_big.py`)
- **Koksownik**: żelazny kosz z żarem stawiany na gotowym murze kamiennym albo kamiennej wieży (nie zajmuje pola, koszt 2 żelaza i 4 kamienia). Łucznicy na murach i wieżach do 2 pól od niego strzelają ognistymi strzałami: rana o połowę mocniejsza, a strzała leci z płomykiem na grocie i pomarańczową smugą. Koksownik płonie dniem i nocą, spada razem ze zburzonym murem (`tools/models/brazier.py`)
- Łucznicy na dużych basztach rozchodzą się po całym pomoście, a w walce stają przy barierce od strony wroga w dwóch szeregach
- Nazwy i opisy po polsku i angielsku

## 0.34.2 — pierwsza fala każdego bota, „Porzuć ruinę” (2026-10-23)

- Poprawka: boty gracza 1 i dalszych pomijały pierwszą falę i atakowały dopiero przy drugiej (myślą co 40 ticków z przesunięciem o numer gracza, a warunek „po terminie pierwszej fali” wypadał im akurat po terminie). Teraz każdy bot rusza z pierwszą falą o czasie — gra z botem robi się wcześniej gorąca
- Okno własnej ruiny ma przycisk **„Porzuć ruinę”** zamiast „Rozbierz”: ruina znika bez zwrotu surowców, zostaje sam gruz, a po jego wyniesieniu miejsce jest wolne pod nowy budynek. Wcześniej rozbiórka ruiny zwracała połowę ceny budynku, co dawało darmowe surowce z każdej zburzonej chaty
- „Jak grać”: porzucanie ruin opisane po polsku i angielsku

## 0.34.1 — zboże w stodole, spichlerz tylko na jedzenie (2026-10-23)

- Pszenica i mąka leżą teraz wyłącznie w stodole, na osobnym miejscu na zboże (200 na stodołę, obok 250 towarów). Spichlerz trzyma tylko jedzenie, więc zboże go nie zapycha (zamiast „najwyżej połowa spichlerza” z 0.34.0)
- Okno stodoły pokazuje osobno towary i zboże; farma i młyn bez stodoły piszą „postaw stodołę”
- „Jak grać”: magazyny i chleb opisane na nowo, po polsku i angielsku

## 0.34.0 — bot z saperami, zboże w spichlerzu (2026-10-23)

- Komputer też szkoli saperów: przy co najmniej 6 żołnierzach i zapasie rudy trzyma dwóch (trzech, gdy u gracza leżą ruiny). Wolni saperzy sami idą rozbierać ruiny gracza — najbliższe twierdzy bota, i tylko te, przy których gracz nie ma przewagi w wojsku; do dalekich ruin idzie z nimi eskorta z trzech żołnierzy. Saperzy nie idą już z falą ani na wypady (fala liczy tylko wojsko do walki)
- Bot buduje młyn i piekarnię po farmie (wcześniej stawiał samą farmę, a pszenica leżała bez użytku)
- Pszenica i mąka leżą w spichlerzu, nie w składzie (uwaga Mikołaja). Zboże może zająć najwyżej połowę spichlerzy — reszta zawsze zostaje na jedzenie, więc farma bez młyna nie zagłodzi osady; okno farmy i młyna mówi, gdy zboże dobiło do połowy. Licznik jedzenia i ostrzeżenia skryby liczą samo jedzenie, bez zboża
- „Jak grać”: magazyny, chleb i saperzy komputera opisane na nowo, po polsku i angielsku

## 0.33.4 — porządki: kruki, oczy w puszczy, kałuże i iskry w osobnych plikach (2026-10-23)

- Bez zmian w grze. Ze `scene.ts` wyniesione: kruki na ciałach (`src/render/crows.ts`), czerwone oczy nocą w puszczy (`foresteyes.ts`), kałuże na drogach (`puddles.ts`) i iskry z „+1” przy nowym żołnierzu z koszar (`spawnfx.ts`) — `scene.ts` krótszy o ok. 190 linii
- Nowe testy rysują te części bez przeglądarki

## 0.33.3 — porządki: wilki w osobnym pliku (2026-10-23)

- Bez zmian w grze. Rysowanie wilków (żywe, zabite, znaczki polowania i linia do celu) wyniesione z `scene.ts` do `src/render/wolves.ts` — `scene.ts` krótszy o ok. 170 linii
- Nowy test rysuje wilki bez przeglądarki, więc błąd w tej części wyjdzie przed wdrożeniem

## 0.33.2 — porządki w kodzie (2026-10-23)

- Bez zmian w grze. Okno budynku (plac budowy, warsztat, cech inżynierów, straż miejska i straż kopalni) wyniesione z `main.ts` do `src/ui/buildingPanel.ts` — `main.ts` krótszy o ok. 200 linii, mniej konfliktów między czatami
- Akcje GitHub podbite do wersji na Node 24 (checkout, setup-node, upload-pages-artifact, deploy-pages v5) — koniec ostrzeżenia o Node 20
- Wersja w `package.json` zgodna z grą

## 0.33.1 — saper z własnym modelem (2026-10-23)

- Saper ma własny model z Blendera (tools/models/sapper.py): przeszywany skórzany kaftan nabijany ćwiekami i sznurowany z przodu, rękawy i kołnierz koszuli w barwach pana, skórzany kaptur z postrzępioną pelerynką, karwasze i grube rękawice, skórzany fartuch, portki z nakolannikami, wysokie buty z wywiniętą cholewą; u pasa młotek, przecinak i sakwa, przy boku żelazny łom, przez bark zwój liny
- Kilof (w dłoni przy ruinie, na plecach w drodze) i niesiony łup jak dotąd; poległy saper leży w swoim stroju
- Saper w podglądzie modeli (modele.html?id=sapper)

## 0.33.0 — odbudowa ruin kosztuje, saperzy rozbierają wrogie ruiny (2026-10-23)

- Odbudowa własnej ruiny nie jest już za darmo: kosztuje połowę ceny budynku (drewno, kamień, żelazo, ruda). Zapłata schodzi sama, gdy starcza surowców — najpierw za mury, bramy i wieże — i dopiero wtedy robotnicy i inżynierowie biorą się do roboty. Okno ruiny pokazuje koszt i czego brakuje
- Nowa jednostka z koszar: **saper** (2 żelaza + 10 rudy). Nie walczy; prawy klik na wrogą ruinę — rozbiera ją, a połowę drewna, kamienia i żelaza, z których była postawiona, znosi ładunek po ładunku do twierdzy (co się nie mieści w składzie, przepada). Rozebrana ruina znika z mapy, zostaje tylko gruz: wróg musi postawić budynek od nowa za pełną cenę. Sam przechodzi do kolejnej wrogiej ruiny w pobliżu
- Póki saperzy stoją przy ruinie, wróg nie może jej odbudować; saperzy są bezbronni, więc warto dać im eskortę
- Na razie saper wygląda jak chłop w barwach pana z kilofem (przy ruinie kuje oburącz, łup niesie przed sobą); własny model z Blendera w kolejnej partii
- Karta sapera w koszarach, okrzyki po polsku i angielsku, rozdziały „Saperzy” i „Rozbiórka i ruiny” w „Jak grać”
- Poprawka: polegli chłopi, strażnicy i zbrojni nie leżą już dodatkowo jako ciało włócznika, a poległy chorąży znów zostawia swoje ciało obok proporca

## 0.32.1 — cech inżynierów bez zasięgu (2026-10-23)

- Inżynierowie znowu działają w całej osadzie, bez granicy 24 pól; przy równym priorytecie biorą najpierw roboty bliżej cechu

## 0.32.0 — cech inżynierów: ekipa naprawcza z zasięgiem (2026-10-23)

- Załoga cechu rośnie z wioską: jeden inżynier i jeden więcej na każde 8 mieszkańców, najwyżej czterech
- Inżynierowie pracują w zasięgu 24 pól od cechu (przycisk zasięgu w oknie budynku), każdy przy innej robocie: najpierw ruiny po ataku, potem rozbite mury, bramy, wieże i twierdza, potem reszta (najbardziej zniszczone pierwsze), a gdy nie ma czego łatać — pomagają przy nowej budowie
- Inżynier buduje i odbudowuje dwa razy szybciej niż chłop; pod okiem wroga nikt nie łata — wracają do cechu i czekają
- Okno cechu pokazuje, ilu jest inżynierów, co który robi (z postępem) i ile roboty czeka w zasięgu
- Nowy opis cechu, rozdział „Cech inżynierów” w „Jak grać” i nowe odzywki — po polsku i angielsku

## 0.30.28 — drwal ciągnie to samo drzewo, które ściął (2026-10-19)

- Ścięte drzewo ciągnięte do chaty drwala to teraz ta sama odmiana z Poly Haven, która stała w lesie (jodła, sosna albo liściaste), w pełnej jakości — zamiast starego świerka z kodu
- Korona leżącego drzewa szura po ziemi, ale się w nią nie zapada (szersze korony liściastych są mocniej uniesione); cień korony z kształtu liści, nie z prostokątów kart

## 0.30.27 — cienie drzew w kształcie drzew, drzewa stoją w ziemi (2026-10-19)

- Korony drzew, młode jodły i krzaki rzucają cień swoimi prawdziwymi liśćmi i igłami (ta sama maska co w obrazie) zamiast prostej bryły — koniec z trójkątnymi klinami na ziemi
- Wysokość terenu liczona dokładnie tak jak narysowana ziemia (dwa trójkąty na pole), więc drzewa, ludzie i graty nie wiszą nad zboczami ani się w nie nie zapadają
- Drzewa i krzaki na zboczach lekko wkopane od dolnej strony — pień nie odstaje od stoku, także w puszczy za mapą

## 0.30.26 — nowe ustawienia grafiki i porządek w zakładce Grafika (2026-10-19)

- Wygładzanie krawędzi naprawdę działa: wcześniej obraz szedł przez składanie efektów i zwykłe wygładzanie przeglądarki się wyłączało. Do wyboru FXAA, SMAA, MSAA 2×/4×/8× (domyślnie MSAA 4×)
- Przy MSAA liście, igły, trawa i włosy dostają miękkie brzegi (alpha to coverage) zamiast poszarpanych schodków
- Odbicia otoczenia: ta sama mapa otoczenia co w podglądzie modeli — modele nie są płaskie po stronie cienia; słabnie nocą, w deszczu i w sztolni
- Filtrowanie tekstur 1×/4×/8×/16× dla wszystkich tekstur, także terenu (domyślnie 16×)
- Wyostrzenie obrazu (lekkie / mocne) — do FXAA i SMAA
- Zakładka Grafika w sekcjach: Poziom grafiki (automat + gotowe poziomy Niska/Średnia/Wysoka/Ultra), Ostrość i krawędzie, Światło i cienie, Świat, Płynność; przy każdej sekcji krótko, co kosztuje dużo, co mało, a co jest zbędne
## 0.30.25 — „Jak grać” na cały ekran, pasek w grze w jednej linii (2026-10-19)

- „Jak grać” jako duża księga na prawie cały ekran: spis po lewej (Nauka gry 1–10, Encyklopedia: postacie i budynki), treść szeroko po prawej — duży tytuł rozdziału, większy tekst, rady w wyróżnionych ramkach, czytelne tabele, w encyklopedii duży podgląd modelu
- W spisie przycisk „Plan na start od nowa” (włącza przewodnik w grze jeszcze raz); strzałki góra/dół przechodzą między rozdziałami
- Menu w trakcie gry: pasek znów w jednej linii (trzy pozycje po lewej się nie zawijają; krótsze kreski i ciaśniejsze napisy)

## 0.30.24 — worki z płótna i modele z paczek w oryginale (2026-10-19)

- Worek mąki i ziarna to model z Blendera z symulacją tkaniny: pełny worek siada pod własnym ciężarem, płótno marszczy się w fałdy zbiegające do sznura, nad sznurem zebrany kołnierz; tekstura juty powtarzana na płótnie, cień w fałdach. Gotowego worka z płótna na wolnej licencji w sieci nie ma (tylko papierowe i plastikowe albo bez licencji)
- Worek jest wszędzie: niesiony przez chłopa, w stosach w składzie, w piekarni, browarze, chacie chłopa, leśniczówce, obu spichlerzach, młynie i obozie bandytów
- Zgodnie z zasadą Michała ryba, pochodnia, kosz, jabłko, chleb i beczka wchodzą do gry w oryginale (wszystkie trójkąty, tekstury w rozdzielczości paczki jako zwykły JPG, bez KTX2), a nie w wersjach odchudzonych

## 0.31.3 — liście na stawach nie migają (2026-10-19)

- Kożuch liści na wodzie leży 2,5 cm nad taflą z przesunięciem głębi: przy ruchu kamery nie miga już i nie „sypie się” (wcześniej walczył z taflą wody, która sięga po horyzont)
- Przyciemniony i matowy, w barwie mętnej wody wokół, zamiast jasnego zdjęcia w pełnym słońcu; wygładzone brzegi liści

## 0.31.2 — prawdziwa pałka wodna i liście na stawach (2026-10-19)

- Trzciny przy wodzie to gotowe kępy pałki wodnej z gry 0 A.D. (dwie odmiany): wygięte liście, brązowe kolby, korzenie przy ziemi — zamiast prostych, malowanych w kodzie źdźbeł
- Zielone „kółka” na wodzie zastąpione zdjęciem kożucha liści roślin pływających (też z 0 A.D.): nieregularne płaty z prześwitami wody
- Siatki i tekstury wchodzą do gry bez odchudzania i przeróbek (oryginalne trójkąty, UV i rozdzielczość); w podglądzie modeli: Roślinność → pałka wodna 1 / 2, liście na stawie

## 0.31.1 — „Plan na start”: przewodnik w grze (2026-10-19)

- Karta zadania po prawej (jak lista zadań w Cities: Skylines): jeden krok naraz — co zrobić, po co i gdzie, licznik postępu („Chata 1 / 3”) liczony ze stanu gry, kropki 9 kroków; po wykonaniu kroku dźwięk i od razu następny
- Kroki: drwal → jedzenie (sad albo rybak) → 3 chaty → spichlerz → kopalnia pod górami → farma, młyn, piekarnia → warsztat włóczniarza, zbrojownia, koszary → 5 żołnierzy → palisada z bramą
- Złota pulsująca obwódka na tym, co trzeba kliknąć: najpierw kategoria na pasku budowy, potem karta budynku; przy stawianiu podpowiedź „kliknij miejsce na mapie”
- Kartę można zwinąć do paska z kropkami (zapamiętane); po ostatnim kroku „Zamknij plan”. Tylko w zwykłej grze solo (bez trybu deweloperskiego, testowego i gry przez sieć); do sprawdzania wyglądu: `?test=1&plan=1`

## 0.31.0 — namiot polowy z medykiem (2026-10-19)

- Nowy budynek w zakładce Wojsko: namiot polowy (3×3, 30 drewna i 10 rudy). Pracuje w nim medyk, a ranni żołnierze idą do najbliższego miejsca leczenia — twierdzy albo namiotu z medykiem — zamiast biec zawsze do zamku
- W namiocie rany goją się dwa razy szybciej niż pod twierdzą; namiot wyłączony albo bez medyka nikogo nie leczy, a ranny, który stoi z dala od leczenia (np. namiot zburzono), sam idzie do następnego najbliższego
- Model z Blendera: płócienny namiot na dwóch masztach z proporcem, podwinięte wejście, w środku posłania ze słomy, stół medyka z misą, bandażami i ziołami, skrzynia; przed namiotem ognisko z kociołkiem, beczka z wodą i sznur z bandażami
- Nazwa, opis i odzywki medyka po polsku i angielsku
## 0.30.23 — menu na środku, „Wygraj mecz” w panelu dewelopera (2026-10-19)

- Menu ma na sztywno jedną kolumnę: tytuł, pasek i okna są zawsze na środku ekranu, także z tabliczką gracza w lewym dolnym rogu
- Pasek menu bez czarnej poświaty za napisami: złote linie są tylko w odstępach między pozycjami, więc napisy nie potrzebują ciemnego tła
- Panel dewelopera: przycisk „Wygraj mecz” — od razu ekran zwycięstwa z pokazem podsumowania PD (pasek liczy od obecnego stanu konta, nic nie trafia do bazy, pod spodem napis, że to pokaz)

## 0.30.22 — żołnierz przy zamku odpowiada na atak (2026-10-19)

- Żołnierz, który bije w zamek albo inny budynek (z rozkazu lub sam), na widok wrogiego żołnierza przerywa oblężenie i walczy z nim; po walce sam wraca do tego samego budynku
- Wyjątek: wroga na murze lub wieży, którego wręcz nie dosięgnie, pomija i dalej bije w budynek (łucznik strzela do niego normalnie)
- Nowy rozkaz (ruch, atak, wieża) kasuje zapamiętane oblężenie; test w `tests/army.test.ts`

## 0.30.21 — jabłka i chleb ze skanów także w budynkach (2026-10-19)

- W koszach przy spichlerzach, w sadzie (na drzewach, w trawie, w skrzynkach i koszach), w piekarni (na blacie, półce i ławie), na stołach w twierdzy, karczmie i chacie oraz przy ognisku bandytów leżą jabłka i bochenki ze skanów zamiast graniastosłupów
- Skrypty budynków zapisują tylko miejsca (`b.apple`, `b.bun`), modele stawia gra
- Jabłka i chleb w niesionych koszach zsunięte do środka, nie przebijają ścianek

## 0.30.20 — prawdziwy koń przy koszarach (2026-10-19)

- Koń z gładkich brył zastąpiony modelem zrobionym przez grafików z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0): gniady, z czarnymi nogami, grzywą i ogonem, z prawdziwą anatomią i teksturą sierści
- Żyje: na zmianę skubie trawę z łbem przy ziemi i podnosi łeb, czasem się czujnie rozgląda, ogonem odgania muchy — każdy koń w swoim rytmie (pozy liczone na karcie graficznej, dalej dwa wywołania rysowania na wszystkie konie)
- Grzywa i ogon: bez szarego połysku jak blacha (oświetlone jak sierść pod spodem), obie strony płata, miękkie brzegi pasm, tekstura włosia 2× ostrzejsza; przy skubaniu grzywa opada i przylega do szyi zamiast odstawać
- Naprawione dziury: przy wgrywaniu model był odbity lustrzanie, więc gra rysowała go „od środka”; sierść ostrzejsza (2× większa tekstura, bez kompresji robiącej kwadraty)
- Bez odchudzania: 2074 trójkąty, oryginalne UV i tekstury; skala dopasowana do ludzi (kłąb trochę poniżej barku człowieka). W podglądzie modeli: Zwierzęta → koń / koń skubie trawę / koń czujny

## 0.30.19 — podsumowanie doświadczenia jak w grach sieciowych (2026-10-19)

- Na końcu meczu każda pozycja PD (czas, wynik, pokonani, zburzone, postawione) wpada po kolei i nabija liczbę, potem duża świecąca suma, a pasek poziomu ładuje się od starego stanu do nowego; przy awansie romb z poziomem błyska, gra fanfara i pojawia się „Awans! Poziom X — nowy tytuł”
- Gdy PD nie ma, okno mówi dlaczego zamiast znikać: tryb deweloperski, tryb testowy, brak konta (z przyciskiem logowania), mecz krótszy niż 3 minuty, limit dzienny albo brak połączenia z bazą
- Na końcu meczu przycisk „Mój ród” (otwiera kronikę bitew); kod w `src/ui/xpReport.ts`

## 0.30.18 — jabłka, chleb i beczka piwa ze skanów (2026-10-19)

- Jabłka, chleb i beczka piwa to gotowe modele z Poly Haven (CC0, skany prawdziwych przedmiotów): jabłka w koszu niesionym przez chłopa i w koszach w składzie i spichlerzu, trzy różne bochenki w koszach chleba, dębowa beczka z obręczami i czopem niesiona przez chłopa i w stosach beczek w składzie
- Beczka w ręce chłopa jest pełna (10,8 tys. trójkątów); w stosach, gdzie może ich stać kilkadziesiąt, prosta bryła (560) z wypalonym w Blenderze wyglądem pełnej — na porównaniu nie do odróżnienia
- Ryby i ruda w niesionym koszu leżą w środku, a nie nad brzegiem

## 0.30.17 — nowy „Mój ród” i tabliczka gracza w lewym dolnym rogu (2026-10-19)

- Tabliczka konta przeniesiona z lewego górnego rogu na dół, w lewy róg: herb z numerem poziomu, nick, tytuł, pasek PD z liczbami; cała jest przyciskiem do „Mojego rodu”, z wyraźnym podświetleniem po najechaniu
- „Mój ród” od nowa: wizytówka (duży herb, imię, tytuł, gruby pasek PD, poziom w czerwonym rombie), pod nią najbliższy cel — kolejny tytuł i ile PD brakuje — z przyciskiem „Do boju” (otwiera nową grę)
- Zakładki: **Przegląd** (bitwy, zwycięstwa, skuteczność, pokonani; droga tytułów od giermka do króla; 8 odznak z postępem; skąd brać PD), **Kronika bitew** (ostatnie 25 meczów z tabeli `xp_awards`: kiedy, rodzaj, wynik, czas, wrogowie, +PD), **Herb** (kreator z dużym podglądem; podglądy podziałów i godeł zmieniają barwy razem z herbem)
- Bez zmian w bazie: kronika czyta istniejącą tabelę `xp_awards`, odznaki liczą się z liczników `player_progress`; test `tests/house.test.ts`

## 0.30.16 — prawdziwe kosze z wikliny wszędzie (2026-10-19)

- Wszystkie kosze w grze to jeden gotowy model z Poly Haven (Wicker Basket 02, CC0, bez wieka): niesione przez chłopów (jabłka, chleb, ryby, ruda), w składzie i spichlerzu, przy piekarni, rybaku, spichlerzach, w sadzie, u łuczarza, włóczniarza i inżynierów, na wieży strażniczej, w kopalni i obozie górników (dawne „kosze z urobkiem” z worków), a także kosz z praniem przy chatach
- Splot jest w teksturze, więc kosz odchudzony do 1700 / 906 trójkątów wygląda jak oryginał (porównanie przed wgraniem). Drugi kosz z Poly Haven (Wicker Basket 01) odrzucony: jest spleciony z prętów z geometrii, które rozpadają się przy każdym odchudzeniu, a w pełnej wersji ma 22 tys. trójkątów
- Skrypty budynków nie robią już brył koszy: `building.py` zapisuje miejsca (`baskets`), a kosz stawia gra

## 0.30.15 — prawdziwe krzaki z Poly Haven (2026-10-19)

- Krzaki z kul zastąpione prawdziwymi krzewami zrobionymi przez grafików (Searsia lucida z Poly Haven, CC0): trzy odmiany gęstych kęp (kopulasta, niska rozłożysta, wyższa), z liśćmi i gałązkami, w soczystej leśnej zieleni
- Każda kępa to zdjęcia prawdziwego krzewu na kilkunastu kartach (ok. 56 trójkątów zamiast ok. 220), z daleka obrazek z 8 stron, cień z prostej bryły — krzaków jest kilka tysięcy, więc dalej lekko
- Dalej drżą na wietrze, jesienią rudzieją, zimą tracą liście; w podglądzie modeli: Roślinność → krzak a / b / c

## 0.30.14 — prawdziwa ryba i pochodnia z paczek (2026-10-19)

- Ryby wszędzie, gdzie występują, to jeden gotowy model zrobiony przez grafika (Barramundi, CC0): pływające i wyskakujące w wodzie, w koszu niesionym przez rybaka, w skrzynce w składzie i spichlerzu, na suszarni i w koszu przy chacie rybaka, na stole w kuchni twierdzy
- Pochodnia wyciągana w spacerze (F) to gotowy model (Secret Histories, CC-BY-SA 4.0): trzonek i szmaty ze smołą owinięte sznurem; pochodnie noszone nocą przez chłopów bez zmian
- Wersje z bliska trafiają do gry bez odchudzania (oryginalne trójkąty, UV, normalne i tekstura), płetwy rysowane z obu stron; przed wgraniem arkusz porównania z oryginałem (`tools/models/props_check.py`), test `tests/props.test.ts`
- Podgląd modeli: nowa grupa „Z paczek”

## 0.30.13 — nic nie wystaje spod ekranu wczytywania (2026-10-19)

- Przycisk „Mapa” (minimapa) i inne elementy interfejsu nie pokazują się już na ekranie wczytywania zapisu ani nowej gry

## 0.30.12 — szczegóły pod paskiem wczytywania (2026-10-19)

- Pod paskiem (przy uruchomieniu gry, „Kontynuuj”, „Nowej grze” i meczu) widać, co dokładnie się teraz wczytuje i ile już trwa ten krok (np. która tekstura, ile modeli pobrano, który kierunek obchodu kamerą, ile równych klatek), a niżej listę skończonych kroków z czasami
- Przy krokach liczonych w jednym kawałku (budowa świata, kompilacja shaderów) opis mówi wprost, że licznik może na chwilę stanąć

## 0.30.11 — dokładniejsze wczytywanie przy wejściu do gry (2026-10-19)

- Pod zasłoną kamera robi obchód: osiem kierunków z bliska i dwa z daleka, po kilka klatek każdy, więc drzewa, trawa, budynki, ich dalekie wersje i cienie dookoła osady trafiają do karty graficznej przed wejściem, a nie przy pierwszym obrocie kamery
- Panel na dole rysuje się pierwszy raz jeszcze pod zasłoną
- Zasłona schodzi dopiero po 30 równych klatkach z rzędu (porównywanych z typową klatką danego komputera), najdłużej po 12 s; nowy krok na pasku: „Ostatnie przygotowania…”

## 0.30.10 — ekran wczytywania przy wejściu do gry (2026-10-19)

- „Kontynuuj”, „Nowa gra” i mecz przez sieć wchodzą do gry przez ekran wczytywania z paskiem i procentami: przygotowanie świata, kompilacja grafiki, wgranie wszystkich tekstur do karty graficznej i rozgrzanie świata (kilkanaście klatek rysowanych pod zasłoną z widoku gracza). Zasłona schodzi dopiero, gdy klatki są równe, więc po wejściu gra nie przycina
- Automat jakości grafiki nie liczy już pustych klatek menu: wcześniej szybkie menu podbijało jakość i po wejściu do gry obraz się ciął, aż automat zszedł niżej
- Powrót z pauzy (Esc → „Wróć do gry”) dalej jest od razu, bez wczytywania

## 0.30.9 — herb na chorągwiach idzie za kontem (2026-10-19)

- Gra startowała, zanim wczytało się konto, więc na chorągwiach był herb zastępczy (niebieska tarcza z mieczami), także po resecie. Teraz flagi na mapie podmieniają się same, gdy tylko konto się wczyta
- Zmiana herbu w „Mój ród” w trakcie gry od razu zmienia chorągwie na wszystkich Twoich budynkach i flagi zbiórki, bez nowej gry

## 0.30.9 — płynne wczytywanie i menu bez podglądu mapy (2026-10-19)

- Ekran wczytywania to sam herb, tytuł, rada i pasek postępu: bez unoszących się iskier i przesuwającego się blasku na pasku, które przycinały się, gdy gra się wczytywała
- Menu ma pełne, ciemne tło jak ekran wczytywania; osada i mapa nie są już rysowane pod spodem, więc menu nie przycina
- Podgląd mapy z lotu ptaka przy „Nowej grze” i w pokoju przez sieć zostaje jak był (świat rysuje się tylko wtedy)

## 0.30.8 — herb gracza także na chorągwiach zamku, bram i wież (2026-10-18)

- Chorągwie z modeli Blendera (baszty i donżon twierdzy, kamienna brama, kamienna wieża, strażnica, sztandar koszar) dostały tę samą płachtę z herbem właściciela co reszta budynków; w modelach zostało tylko miejsce zawieszenia, płachtę rysuje gra
- Nowe wiszące chorągwie na wieżach bramy zamku i przy koszarach: pionowe, na żelaznym drążku, z rękawem u góry, złotym obszyciem i jaskółczym ogonem u dołu, lekko odstają od muru na wietrze
- Tarcza nad drzwiami zbrojowni pokazuje herb pana zamiast gładkiej barwy

## 0.30.7 — chorągwie z herbem gracza (2026-10-18)

- Flagi na budynkach i flagi zbiórki koszar noszą herb właściciela: ten złożony w „Mój ród” (w meczu przez sieć — herb każdego gracza z jego konta), boty i gracze bez herbu dostają stały herb z numeru gracza
- Nowa płachta: płótno w barwie drużyny z nierówno farbowaną wełną, złotym obszyciem, ciemnym rękawem na drzewce i jaskółczym ogonem; splot widać w świetle
- Płachta faluje jak materiał (fala biegnie od drzewca do końca, każda flaga w innym rytmie), a nie obraca się sztywno jak deska
- Drzewce z żelazną obręczą, złotą gałką i grotem

## 0.30.6 — ziemia w obozie zbójów bez równego koła (2026-10-18)

- Obóz zbójów nie stoi już na płaskim, okrągłym placku ziemi z modelu: wydeptaną ziemię maluje teren — nierówna plama z falującym brzegiem, która miękko przechodzi w trawę, najmocniej wydeptana przy ognisku, z kępami niezdeptanej trawy i dwiema–trzema krótkimi dróżkami od ogniska w las
## 0.30.5 — pauza wycisza odgłosy świata (2026-10-18)

- Pauza (tempo 0 albo menu otwarte w trakcie gry) płynnie wycisza wszystkie odgłosy świata: ludzi, rozmowy, zwierzęta, walkę, róg i dzwon alarmu, wiatr, deszcz, ptaki, świerszcze i tło kopalni — także te, które już grały. Po wznowieniu wracają łagodnie
- Kliknięcia, dźwięki stawiania i burzenia budynków (można planować w pauzie) oraz muzyka grają dalej; na ekranie tytułowym i w meczu przez sieć nic się nie zmienia

## 0.30.4 — cienie nie migają przy przelocie kamery (2026-10-18)

- Przy szybkim przesuwaniu kamery cienie skakały co klatkę: mapa cieni liczyła się co drugą klatkę, a słońce przesuwało się w każdej, więc stara mapa była czytana w nowym miejscu. Teraz słońce idzie za kamerą tylko w klatkach, w których mapa się liczy
- Przyciąganie obszaru cienia do pikseli mapy liczone w układzie słońca (świeci pod kątem), a nie w osiach X/Z świata — krawędzie cieni nie pełzają przy przesuwaniu
- Obszar cienia rośnie przy oddalaniu skokami co ok. 12% zamiast płynnie, więc przy przybliżaniu i oddalaniu cienie nie drgają

## 0.30.3 — mgła bez kanciastych płyt (2026-10-18)

- Ławice mgły przy ziemi nie są już widoczne jako płaskie, kanciaste prostokąty: obraz mgły zanika do zera przy brzegach, ławica siada nad najwyższym punktem terenu pod sobą i znika na stromiźnie (skraj gór, urwiska), zamiast wchodzić w zbocze prostą krawędzią
- Pasek oparu przy skraju lasu i skał jest wyraźniejszy

## 0.30.2 — obozy zbójów widać (2026-10-18)

- Na początku nowej gry wojewoda mówi, w którą stronę od zamku w puszczy obozują zbóje, z przyciskiem „Pokaż ▸”, który przenosi tam kamerę. Ten sam przycisk mają wiadomości o napadzie (pokazuje ofiarę) i o zabitym człowieku (pokazuje obóz); wiadomość z przyciskiem wisi dłużej (12 s)
- Szersza polana pod obóz (generator map 6: promień 6,6 pola zamiast 4,3) — obóz widać z góry spod koron drzew, nie chowa się w lesie; na każdej mapie z 117 sprawdzonych (1 na 1, 2 na 2, 4 na 4) obozy się mieszczą
- Na minimapie obóz to ciemne koło z jasną obwódką i czerwonym krzyżem zamiast małego brązowego kwadratu
- Obozy są tylko w nowej grze (zapis sprzed 0.29.0 wczytuje się na dawnej mapie bez nich)
## 0.30.1 — leśniczy z łopatą (2026-10-18)

- Leśniczy kopie łopatą (nowe narzędzie z Blendera w `tools/models/tools.py`: trzonek z poprzeczką, drewniane pióro okute żelazem): stoi pochylony, wbija pióro w ziemię, podważa i odrzuca ziemię; zamiast klęczenia z młotkiem
- Chata leśniczego: kalenica z grubego wałka słomy związanego powrósłami zamiast płaskiego zielonego pasa darni

## 0.30.1 — poprawki wieży, studni, cechu i okiennic (2026-10-18)

- Wieża strażnicza: wejście jak w prawdziwej strażnicy — drabina oparta o krawędź pomostu, przerwa w przedpiersiu między dwoma wyższymi słupkami (bez klapy, przez którą drabina szła przez belki); przedpiersie na słupkach, poręcz leży na deskach, pod każdą krawędzią pomostu belka obrzeża; róg wisi na kołku wbitym w słup
- Studnia: lina nawinięta na wał jednym zwojem po spirali (zamiast pięciu krążków) i schodzi pionowo do pałąka wiadra; koryto puste w środku, woda poniżej brzegu — koniec z mruganiem tafli
- Lina we wszystkich budynkach dostała teksturę splotu
- Cech inżynierów: wiadra z pałąkami, stojak obok okna, a nie przed nim; beczkowóz z osią przytwierdzoną do ramy i hołoblami opartymi o ziemię (dyszel nie wisi już w powietrzu)
- Okiennice we wszystkich domach z szachulca (chata, piekarnia, koszary, farma, warsztaty, cech) otwierają się na zawiasach przy krawędzi okna, z okuciami; wcześniej obracały się wokół środka i w stronę ściany, przez co wyglądały na krzywe

## 0.30.0 — leśniczy: las odrasta (2026-10-18)

- Nowy budynek w kategorii Przemysł: **chata leśniczego** (2×2, 20 drewna). Leśniczy sadzi młode drzewka na wolnej łące w swoim terenie (6 pól wokół chaty, widać go po kliknięciu), najchętniej przy skraju lasu i na porębach; omija drogi, leśne ścieżki, wodę i miejsca tuż przy budynkach
- Drzewko rośnie na oczach od sadzonki po kolana do pełnego drzewa przez dwa dni gry (zimą wzrost stoi, a leśniczy nie sadzi), potem to zwykły las, który drwal może ściąć. Najwyżej 14 rosnących drzewek naraz na chatę
- Na polu z sadzonką nie da się budować; droga położona na sadzonce ją niszczy. Sadzonki i odrośnięty las są w zapisie gry
- Model z Blendera (`tools/models/forester.py`): chata z bali pod strzechą, szkółka drzewek za płotem z wikliny, kopczyk z łopatą, sadzonki w płótnie, poroże przy drzwiach; w izbie stół z siewkami i prycza
- Leśniczy klęczy i kopie dołek przy sadzeniu; własne odzywki po polsku i angielsku; bot stawia chatę leśniczego przy drwalach
- Teksty w obu językach, poprawiona pomoc („Złoża się kończą”) i opis chaty drwala
## 0.29.0 — zbóje z puszczy (2026-10-18)

- Nowe mapy (generator 5) mają w puszczy polany z obozami zbójów: po jednym przy każdym zamku (w 4 na 4 dwa na drużynę), 26–40 pól od zamku, z wydeptaną dróżką do najbliższej ścieżki. Obie drużyny mają obóz w tym samym miejscu (odbicie). Na poziomie pokojowym i w starych zapisach obozów nie ma
- Obóz z Blendera (`tools/models/banditcamp.py`): szałas z gałęzi i słomy pod skórami, namiot ze skór na żerdziach, barłogi, zasieka z zaostrzonych pali z tyłu i po bokach, ognisko z rożnem (płonie zawsze), kłody, stojak z włóczniami i toporem, skrzynie z łupem (jedna otwarta, z rudą), worki, beczka i słup ze skórą. Podgląd: `modele.html?id=banditCamp`
- W obozie siedzi czterech zbójów (włócznie, skóry w brudnym brązie zamiast barw drużyny; własny model zbója w kolejnej partii). Stracone załogi odrastają co półtorej doby
- Napady: od drugiego dnia raz na dzień (między 8:30 a 15:00) dwóch, od piątego dnia trzech zbójów wychodzi z obozu na chłopa przy pracy daleko od zamku i bez straży w pobliżu — najchętniej na drwala — i go goni. Kto dobiegnie pod zamek, ocalał; gdy naprzeciw stanie więcej zbrojnych niż ich, zbóje uciekają do lasu, a wieczorem i tak wracają do ogniska. Ciężko ranni wracają leczyć się przy ogniu
- Za każdego zabitego chłopa zbóje zabierają jego panu do 4 rudy i 5 drewna do obozu; wóz z urobkiem bez eskorty łupią do obozu (wiadomość „Zbóje z lasu złupili Twój wóz”)
- Rozbicie obozu: rozkaz ataku wojska na obóz (900 wytrzymałości). Cały łup — zapas na start (35 rudy, 20 drewna, 6 żelaza) i wszystko, co zrabowali — trafia do gracza, którego wojsko stoi najbliżej; ocalali zbóje uciekają w puszczę i znikają, obóz znika z mapy
- Skryba mówi o napadzie, o zabitym człowieku (z sumą zrabowanego) i o rozbitym obozie z łupem; na mapie obóz i zbóje w brązie z jasną obwódką; okno zbója: przydomek, co robi, zdrowie. Pasek „nadciąga wojsko” i licznik wojska wroga nie liczą zbójów
- „Jak grać” (PL/EN): rozdział „Zbóje z puszczy”. Tryb testowy: `__test.den(x, y)` stawia obóz z załogą (np. na pustej scenie)
- Logika: `src/sim/systems/bandits.ts` (zbój to żołnierz bez pana — walczy i chodzi system wojska), testy w `tests/bandits.test.ts`

## 0.28.0 — wieża strażnicza, studnia i cech inżynierów z Blendera (2026-10-18)

- **Wieża strażnicza** od nowa (`tools/models/watchtower.py`): okorowane bale na kamiennych podkładach, lekko zbiegające się ku górze, zastrzały na krzyż w dwóch kondygnacjach z oplotami z liny, pomost z desek wysunięty poza nogi z przedpiersiem i klapą nad drabiną, ławka, kosz strzał, beczka z wodą i róg alarmowy; dach czterospadowy ze strzechy z proporcem. Łucznicy stoją na wysokości pomostu zapisanej w modelu
- **Studnia** od nowa (`tools/models/well.py`): cembrowina z ciosów układanych na mijankę z kamienną koroną, woda głęboko w szybie, wał z nawiniętą liną i korbą, wiadra okute żelazem, daszek z desek, koryto dla zwierząt
- **Cech inżynierów** od nowa (`tools/models/engineers.py`): warsztat z szachulca ze strzechą i kominem; w izbie stół kreślarski z planem i cyrklem, model trebusza na półce, skrzynia narzędzi; na obejściu dźwig z ciosanym blokiem nad taczką kamieni, a obok sprzęt do gaszenia pożarów: beczkowóz z wodą, stojak z wiadrami, bosak i drabina
- Usunięte stare modele tych trzech budynków składane w kodzie (razem z nieużywaną już chatą z brył)

## 0.27.2 — poranny opar przy skraju lasu (2026-10-18)

- Mgła poranna na planszy nie leży już płachtą aż pod same drzewa i urwiska (ucinała się o korony prostą, twardą krawędzią): wygasa kilka pól przed lasem i skałami, a wzdłuż skraju zostaje cienki, poszarpany pasek oparu
- Mgła w dolinach za mapą zaczyna się łagodniej przy brzegu planszy (szersze przejście)

## 0.27.1 — kopacze chodzą po sztolni (2026-10-17)

- Gdy spacerujesz po sztolni, kopacz nie pojawia się już od razu przy skale: wchodzi wrotami i idzie korytarzem do swojego przodka (na dolny poziom schodzi po drabinie w szybie), a po robocie wraca do wrót i dopiero tam wychodzi na powierzchnię — nikt nie znika w środku
- Drogi liczą się same z sal i przeszkód modelu sztolni (`src/render/minepath.ts`), omijają stemple, wózki i skrzynie; wszyscy idą zwykłym krokiem
- Kopanie (15 s, jak dotąd) zaczyna się dopiero, gdy kopacz dojdzie do skały; droga sztolnią w obie strony dochodzi osobno i zależy od tego, jak daleko jest jego przodek (7–16 s w jedną stronę, tabela w `src/data/minewalk.ts`)

## 0.27.0 — drzewko budowy (2026-10-17)

- Część budynków stawia się dopiero przy innym, gotowym budynku: piekarnię przy młynie, koszary przy zbrojowni, karczmę przy browarze, a barak górników przy kopalni. Budynek w budowie albo zburzony się nie liczy
- Zablokowana karta na dolnym pasku jest szara, z kłódką i złotym napisem „Najpierw: Młyn” (gdy wymagany budynek już się stawia: „Czeka na: Młyn (w budowie)”); kliknięcie albo skrót nie wybiera jej, tylko podpowiada, czego brakuje. Po angielsku „Requires: Mill” / „Waiting on: Mill (being built)”
- Bot trzyma się tych samych zasad: browar stawia przed karczmą, a gdy wymaganego budynku jeszcze nie ma, buduje dalej według listy i wraca później
- Opis w „Jak grać” (PL/EN)

## 0.26.2 — podnóże gór bez placków złóż (2026-10-17)

- Nowe mapy (generator 4) nie mają już placków kamienia i rudy żelaza także u podnóża gór (przy zamku zniknęły w generatorze 3) — kamień, żelazo i rudę daje kopalnia stawiana pod górą
- U stóp gór leży teraz naturalne rumowisko na trawie: przy samej skale gęściej i większe głazy, dalej coraz rzadziej i drobniej, w nieregularnych skupiskach, między nimi krzaki
- Stare zapisy wczytują się na swojej dawnej mapie bez zmian

## 0.26.1 — dziennik błędów gry i grafiki (2026-10-17)

- Gra prowadzi dziennik błędów: wyjątki, błędy shaderów i WebGL, utrata kontekstu karty graficznej, brakujące tekstury i pliki, zatrzymany obraz; po zawieszeniu karty dziennik z poprzedniego wejścia zostaje
- F3 pokazuje ostatnie wpisy z przyciskiem „Kopiuj dziennik błędów”, a przy liczniku FPS pojawia się ⚠ z liczbą błędów (PL/EN)
- `npm run check:console` otwiera grę w przeglądarce bez okna i wypisuje dziennik; w konsoli `__errors()`
- Poprawki z przeglądu konsoli: miękkie cienie przez PCF z promieniem (stary tryb PCFSoft zniknął z three.js i sypał ostrzeżeniem), wyciszone powtarzane ostrzeżenie biblioteki przy wycinaniu okien

## 0.26.0 — kolejka rozkazów i patrol (2026-10-17)

- Shift + prawy klik (także z przeciąganiem linii frontu) dopisuje kolejny punkt trasy: oddział idzie dalej, gdy cały dojdzie do poprzedniego (najwyżej 12 punktów)
- Patrol: klawisz P albo przycisk „Patrol” w oknie wojska, potem prawy klik — oddział chodzi tam i z powrotem i bije wrogów po drodze; Shift + prawy klik dodaje kolejne punkty obchodu, Esc anuluje; przycisk pokazuje „Na patrolu”
- Zwykły rozkaz, atak albo wejście na wieżę kończy kolejkę i patrol; ranni idą się leczyć i nie wstrzymują oddziału
- Kolejki są częścią stanu gry (zapis, gra przez sieć, skrót stanu); opis w „Jak grać” i w podpowiedzi okna wojska po polsku i angielsku

## 0.25.2 — ruda zamiast złota (2026-10-17)

- Waluta po polsku nazywa się wszędzie „ruda”: poprawiony rozdział o waluce w „Jak grać” (z dopiskiem, że rudę daje podatek i kopalnia) i opis strażnika w galerii; po angielsku dalej „ore”

## 0.25.1 — cała gra po angielsku (2026-10-17)

- Po wybraniu English po angielsku są teraz: ekran wczytywania (rady, kroki paska), okna ludzi i budynków („Walk through his eyes”), dolny pasek, sojusznicy, mapa, znaczniki i czat, raporty popularności i wojska, alarmy i powiadomienia, konto i logowanie („Your account”, „New password”, historia meczów z angielskimi datami), pokoje i gra przez sieć, całe „Jak grać”, podgląd modeli, rangi graczy i pory roku
- Ludzie w dymkach mówią po angielsku własnymi, krótkimi kwestiami (nie tłumaczenie słowo w słowo); imiona zostają polskie, przydomki po angielsku („Zbyszko of the Forest”)
- Po polsku zostaje tylko okno wydajności F3 (narzędzie twórcy)

## 0.25.0 — polski i angielski (2026-10-17)

- Gra ma dwa języki: polski i angielski. Wybór w Ustawienia → Interfejs („Język / Language”); zmiana od razu przeładowuje grę, postęp zapisuje się sam. Za pierwszym razem gra bierze język przeglądarki (polska przeglądarka → polski, każda inna → angielski)
- Po angielsku są już: nazwy i opisy wszystkich budynków, jednostki, surowce, kategorie, dolny pasek, racje i podatki, komunikaty przy stawianiu, podsumowanie meczu, skrócona pomoc oraz całe menu (start, ustawienia, wyjście, poddanie się). Reszta okien przechodzi na angielski w kolejnych partiach
- Nowe budynki i teksty muszą mieć od razu obie wersje: brak angielskiego tłumaczenia zatrzymuje kompilację, a test sprawdza nazwy wszystkich budynków

## 0.24.3 — bez psa (2026-10-16)

- Pies na razie nie pojawia się w osadzie ani nie szczeka; model i zachowanie zostają w kodzie (przełącznik `DOGS_ON` w `src/render/village.ts`), żeby łatwo go przywrócić

## 0.24.2 — obozowisko i ładunki (2026-10-16)

- Obozowisko: stos drewna przy ognisku mniejszy (pięć krótszych polan w dwóch warstwach zamiast dziewięciu w trzech); w spacerze nie da się już wejść w stos, krąg kamieni, stołki ani kłodę
- Niesione ładunki (kosz jabłek, chleb, ryby, worki, kłody, deski) w marszu trzymają się dłoni i patrzą tam, gdzie idzie chłop; wcześniej kosz trafiał z boku i był obrócony

## 0.24.1 — tarcza u łuczarza (2026-10-16)

- Tarcza ze słomy przed warsztatem łuczarza stoi pionowo na sztaludze, lekko odchylona do tyłu (wcześniej leżała płasko jak taca); namalowane koła nie migają już w czerwoną plamę, a dwie strzały tkwią grotem w licu zamiast przebijać tarczę na wylot

## 0.24.0 — gra drużynowa (2026-10-16)

- Minimapa w prawym dolnym rogu, tuż nad dolną belką (sama dopasowuje się do jej wysokości i do otwartej listy budynków), z paskiem „Mapa” i przyciskiem „Sojusznicy”: cała mapa z góry (teren cieniowany wysokością, las, woda, drogi i ścieżki), budynki i wojsko w barwach drużyn (twoje jaśniej, zamki w ramce), wilki, wozy z surowcami, pulsujące znaczniki sojuszników i obrys tego, co widać na ekranie. Klik albo przeciąganie przenosi kamerę (bez zmiany przybliżenia), prawy klik wysyła zaznaczone wojsko, Alt + klik stawia znacznik; N albo „–” chowa (pamięta wybór). Okno sojuszników otwiera się obok minimapy
- Znaczniki dla drużyny: Alt + klik w mapę → „Atakuj tutaj”, „Pomocy!”, „Zbiórka” (albo 1/2/3). Sojusznicy widzą pulsujący krąg ze słupem światła, strzałkę przy krawędzi ekranu (kliknięcie przenosi kamerę), wpis na czacie i słyszą krótki sygnał; Spacja skacze do ostatniego znacznika. Boty z drużyny słuchają: na atak i zbiórkę wysyłają całe wolne wojsko, na pomoc połowę
- Wysyłanie surowców sojusznikowi: przycisk „Sojusznicy” → komu, co, ile (10–100). Z bramy wyjeżdża chłop z dwukółką (nowy model z Blendera: skrzynia z desek, koła ze szprychami, worki i skrzynka) i jedzie pod zamek sojusznika; wrogi żołnierz, który go dopadnie, zabiera towar. Powiadomienia o dostawach i przechwyceniach
- Razem przeciw botom (kooperacja): w pokoju gry przez sieć rodzaj „Razem przeciw botom” — wszyscy ludzie w jednej drużynie, druga to wzmocnione boty (zapasy i ludzie ×1,5, +0,25 za każdego kolejnego gracza, dostawy broni i złota co ok. 2 minuty), fale rozkładają się na wszystkich graczy; wynik nie liczy się do rankingu

## 0.23.7 — las we wspólnych pulach (2026-10-16)

- Roślinność (korony, pnie, krzewy, kamyki, kwiaty, kępy trawy, trzcina, skały, puszcza za mapą) rysowana jedną siatką na rodzaj zamiast osobno dla każdego kawałka mapy 40×40 i jeszcze raz w cieniu. Do puli trafiają tylko kawałki w kadrze, a do puli cienia te w zasięgu mapy cieni; przepisywane tylko wtedy, gdy coś się zmieni (ruch kamery przez granicę kawałka, ścięte drzewo, zmiana LOD). Logika lasu bez zmian: ścinanie, pniaki, obrazki z daleka, pory roku, wiatr i zastępcze cienie działają jak wcześniej

## 0.23.6 — skompresowane tekstury i teren 2K (2026-10-16)

- Wszystkie zdjęciowe tekstury (teren, mury, deski, strzechy, ubrania, żelazo) wczytywane jako KTX2 (Basis Universal): karta graficzna trzyma je skompresowane (BC1/BC7) — ok. 6–8× mniej pamięci karty niż JPG rozpakowany do pikseli, a przeglądarka nie dekoduje dużych obrazków w trakcie gry (mniej zacięć, gdy nowa tekstura wchodzi w kadr). Pliki do pobrania mniejsze: 17 MB zamiast 24 MB. Gdy KTX2 się nie wczyta, gra bierze zwykły JPG
- Teren w 2K (2048 px zamiast 1024): obie trawy, ściółka leśna, wydeptana ziemia, skała na zboczach i turnie — z prawdziwymi mapami normalnych ze skanów (wcześniej liczonymi z jasności zdjęcia)
- Narzędzie `tools/textures/ktx2.mjs` (ktx2-encoder): `node tools/textures/ktx2.mjs [pliki.jpg]` — po dodaniu albo podmianie tekstury trzeba je uruchomić, żeby powstał plik .ktx2 obok .jpg

## 0.23.5 — tekstury postaci (2026-10-16)

- Postacie z bliska w prawdziwych teksturach ze zdjęć (ambientCG, CC0) z mapami normalnych w 1024 px: filcowana wełna na koszulach, portkach i kaftanach, kolczuga z widocznymi ogniwami (pierś i poły strażnika, rękawy, kaptur i pelerynka włócznika), kute żelazo z rdzą na naramiennikach, płytach, mieczach i narzędziach
- Wyprawiona skóra (pasy, buty, sakwy, pelerynka) dostała własną teksturę z ziarnem i rysami zamiast płótna; skóra ludzi delikatne pory
- Nowy miecz strażnika z Blendera (tools/models/sword.py): rękojeść owinięta rzemieniem, tarczowa głowica z nitem, kuty jelec z opuszczonymi końcami, klinga ze zbroczem i jaśniejszymi, naostrzonymi krawędziami (z bliska i z daleka)
- Z daleka postacie zostają przy lżejszych teksturach (bez zmian w wydajności)
- Postacie od dołu i od środka bez dziur: otwarte powłoki z metalu, kolczugi i skóry ciała (naramienniki, płyty na biodrach, kolczuga pod połami, kaptur kolczy) dostają w Blenderze grubość i obrzeże (`thicken` w body.py) — wcześniej znikały, gdy patrzyło się od spodu
- Chłop: dekolt koszuli przycięty w równe V z obszytym brzegiem (wcześniej poszarpane schodki z wyciętych ścian siatki)

## 0.23.4 — niesienie od nowa (2026-10-15)

- Poza niesienia: ręce zgięte w przód, ładunek leży na dłoniach tuż przed piersią (wcześniej wisiał w powietrzu przed wyciągniętymi rękami); deski na prawym ramieniu, prawa ręka przytrzymuje wiązkę
- Nowe ładunki: worek mąki jak w spichlerzu (płótno z fałdami, sznurek pod szyjką, pył mąki), sztaby żelaza jak w składzie, ciosany blok kamienia; mniejsze, w proporcji do chłopa
- Podgląd modeli: grupa „Niosą” — chłop z każdym ładunkiem w tej samej pozie co w grze
- Wejście w spacer chłopem bez kilkusekundowego zamrożenia: światło sal stoi w scenie od startu (nowe światło przebudowywało shadery wszystkich materiałów), drzewa kolizji liczone tylko dla ścian tuż obok
- Kopacz bardziej szczegółowy: rozdarty dekolt koszuli z nagą piersią pod spodem, postrzępione zęby na dole koszuli i na rękawach, przetarta dziura, mocniejsze przedramiona, pas z rzędem ćwieków, oliwkowe portki z poziomymi przeszyciami, opaska pod kolanem obszyta łańcuszkiem, owijacze przewiązane na krzyż, ciężkie buty z szarymi paskami, dokładniejsza głowa
- Nowy strażnik jak strażnik Starego Obozu z Gothica, dużo detalu z bliska: ogolona głowa z bródką, ciemna skórzana pelerynka na barkach i czerwona chusta, czerwony kaftan z kolczugą na piersi sznurowaną rzemieniem, trzy warstwy naramienników z ciemnej stali z nitami, płyty na ramionach, karwasze nabijane ćwiekami, szeroki pas z mosiężną klamrą i sakwą, kolczuga pod połami, płyty na biodrach i udach, nakolanniki, nagolenniki z rzemieniami, ciężkie buty; szarfa w barwach pana zostaje (z daleka wersja uproszczona)
- Nowy wygląd chłopa w stylu kopacza z Gothica: krótka, postrzępiona koszula z wycięciem pod szyją i krótkimi rękawami, gołe przedramiona, szeroki skórzany pas z klamrą i sakiewką, workowate portki do pół łydki z ciemnymi pasami, owijacze ze skóry i ciężkie buty; koszula w brudnym brązie, przez który tylko przebija barwa pana
- Kilof i siekiera trzymane oburącz: przy kopaniu i rąbaniu obie dłonie schodzą się na stylisku; stylisko kończy się w oku grotu (nie przebija żelaza)
- Włócznik: włócznia ok. półtora raza wyższa od człowieka (była dwa razy), tarcza tuż przy przedramieniu
- Narzędzia poprawione: kute żelazo z fakturą i połyskiem (nie gładki szary klocek), mniejsze obuchy młotka i siekiery, kilof jak w Gothicu (długie cienkie stylisko, wąski grot-półksiężyc o zaostrzonych końcach), pochodnia z głowicą ze szmat nasączonych smołą owiniętą drutem, rybak trzyma wędkę w obu dłoniach wyciągniętych w przód
- Nowa pochodnia na słupie z Blendera (tools/models/torch.py) — wolnostojąca i przy wejściach budynków: ociosany słup z żelaznymi opaskami, kopczyk ziemi obłożony kamieniami, kuty kosz ogniowy ze szczapami
- Narzędzia chłopów z Blendera (tools/models/tools.py), każde w wersji z bliska i z daleka: siekiera, młotek, kilof, maczuga, pochodnia, wiadro z wodą, wędka. Gra rysuje tylko te, które ktoś naprawdę trzyma (wcześniej każde narzędzie przy każdym człowieku, schowane), z daleka lżejsze, bardzo daleko wcale. Pochodnię chłop trzyma teraz w uniesionej dłoni (płomień nad jej końcem), a wiadro wisi z opuszczonej ręki
- Krzaki i głazy z Blendera (tools/models/plants.py) w wersji z bliska i z daleka: krzak z kęp liści z gałązkami (ok. 220 trójkątów zamiast 320), głaz o płaskich ścianach osadzony w ziemi; cień w zagłębieniach. W widoku osady krzaki ok. 410 tys. → 307 tys. trójkątów, ich cień 148 tys. → 111 tys.
- Podgląd modeli: grupy „W pracy” (chłop z młotkiem, siekierą, kilofem, maczugą, pochodnią, wiadrem, wędką), „Narzędzia” i „Roślinność i kamienie” (z bliska | z daleka obok siebie)
- Siatka budowy: przy wybranym budynku albo drodze pola wokół kursora są lekko podświetlone — zielone, gdzie wolno budować, czerwone, gdzie nie (zajęte, także świeżo postawione place budowy, zły teren, plac przed bramą, za daleko)
- Pauza: stawianie budynków, dróg i rozbiórka działają od razu, więc plac budowy widać i kolejny budynek nie wejdzie na poprzedni
- Start z jedzeniem na ok. tydzień dla sześciu osób: 300 chlebów i 100 jabłek (ok. 700 porcji)
- Zapasy w spichlerzach mniejsze (kosze, worki, beczki o prawie połowę); mały spichlerz ma 12 miejsc, duży 30, więc w dużym widać, że mieści więcej
- Nowy balans budowania (gra ma iść etapami, a nie „wszystko od razu”): start 80 drewna, 0 kamienia, 120 jabłek, 60 złota. Etap 1 (samo drewno, tanio): drwal 15, sad 20, chata 25, obozowisko 20, skład 15, spichlerz 25. Etap 2: kamieniołom 30, pole 30, łuczarz 40, tokarz 35, wieża 25, studnia 15+10 kamienia, cmentarz 20+15 kamienia, rybak 50+20 złota. Etap 3 (kamień i złoto): młyn 40+20, piekarnia 35+20, kopalnia 50+15, browar 45+20, zbrojownia 40+30, cech inżynierów 50+30, koszary 60 drewna+50 kamienia+30 złota, karczma 60+20 kamienia+40 złota, duży spichlerz 70+60, kamienna wieża 50 kamienia+10. Jeden drwal daje ok. 42 drewna na dobę, więc na start stać na drwala, sad i chatę, a potem rośnie się z tego, co się zbierze. Bot buduje kamieniołom, zanim sięgnie po budynki z kamienia
- Nowy budynek: duży spichlerz (3×3, 40 drewna i 30 kamienia, mieści 1200 żywności) z Blendera — kamienna podmurówka z wywietrznikami, piętro z szachulca, dach z łupka z lukarną i bloczkiem do worków, dwuskrzydłowe wrota i kamienne schody; zapasy widać w środku
- Jedzenie syci różnie: jabłko 1 porcja (zjadane najpierw, schodzi najszybciej), chleb 2 porcje, ryba 3 porcje (zjadana na końcu). Piekarnia piecze 10 chlebów z 4 mąki (było 16), więc pole z młynem i piekarnią wykarmi ok. 15 osób, sad ok. 9, rybak ok. 12
- Wydajniejsze gospodarstwa: sad daje 18 jabłek na zbiór (było 12), pole 16 zboża (było 8), młyn miele po 16 (było 8). Zmierzone w symulacji 6 sadów + 3 pola, 3 młyny i piekarnie przy 46 mieszkańcach: ok. 1400 porcji na dobę przy zużyciu ok. 720 (wcześniej ok. 850 przy 640 — wiecznie na granicy). Wąskim gardłem chleba było pole i młyn, nie piekarnie
- Głód: gdy zabraknie jedzenia, ludzie odchodzą od razu (bez względu na popularność) i przestają, gdy tylko jedzenie wróci; popularność spada wtedy tylko trochę (−2), bo to nie pan skąpi racji — koniec z długim odpływem ludzi po krótkim braku
- Spichlerz mieści 400 (było 150); ryba syci za dwie porcje (rybak wykarmi ok. 8 osób), ale rybak kosztuje 40 drewna i 20 złota
- Klik w spichlerz na dolnym pasku: ilu je, ile zjadają co miesiąc i na dobę, na ile starczy zapas, ile dają gospodarstwa i ilu ludzi wykarmią, bilans z ostatnich godzin oraz podpowiedź, ile sadów brakuje
- Wyłączanie budynku (przycisk w oknie budynku): wyłączony stoi pusty, a pracownik idzie do innej roboty — np. do sadu, gdy brakuje jedzenia; po włączeniu znów ktoś przychodzi
- Kopacze bez fachu: przy ognisku obozowiska siedzi najwyżej tylu, ile ma miejsc; nadmiarowi czekają pod chatami, a skryba podpowiada kolejne obozowisko
- Dolny pasek czytelniej: duże ikony i liczby w jednej linii, bez skaczących +/− przy każdym zapasie (zmiana w podpowiedzi), własna ikona „jedzenie razem” (kosz) i tylko przy niej bilans; skład i spichlerz pokazują samą liczbę o stałej szerokości
- Dolny pasek: zapasy zaraz za zegarem i tyle, ile mieści się na ekranie (drewno, kamień, złoto, jedzenie, potem żelazo, piwo, włócznie, łuki, chleb…); pod „…” zostaje tylko reszta, a gdy wszystko się mieści, przycisk znika
- Nocą światło pochodni widać w całym kadrze: pod każdą zapaloną pochodnią (przy budynkach i w rękach idących) ciepła poświata na ziemi, prawdziwych świateł w puli 24 zamiast 18
- Nocne światła pochodni przy przesuwaniu kamery nie zapalają się i nie gasną skokowo: lampy rozjaśniają się i wygasają płynnie, a najdalsze z puli świecą słabiej
- Wydajność bez zmiany wyglądu: pniaki rysowane dopiero po ścięciu drzewa (wcześniej ok. 300 tys. niewidocznych trójkątów), cienie krzaków, koron liściastych i pni liczone z prostszych brył tego samego kształtu (cień w widoku osady ok. 1,3 mln → 0,7 mln trójkątów), lżejsze kwiaty, niesione ładunki rysowane tylko u niosących
- Trafiony budynek już się nie trzęsie — z miejsca uderzenia sypie się delikatny obłoczek kurzu i kilka okruchów spada pod ścianę
- Budynki pełne z każdej strony: daszek ganku karczmy, okiennice, belki i inne części nad ziemią mają spód, połacie dachów mają boki, szczyty są widoczne też od środka (wszystkie budynki z Blendera przebudowane)
- Obręcze wiadra i balii to pełne pierścienie z grubością — nie znikają już od tyłu ani od środka
- Stos polan: polana leżą poziomo w równych rzędach (każde w dołku między dwoma niżej) między palikami; tara stoi na ziemi i opiera się o brzeg balii; mokra koszula leży na brzegu zamiast przechodzić przez klepki
- Włócznie niesione wiązką na ramieniu (groty w przód, przewiązane sznurem), deski węższą wiązką na barku między głową a ręką (dłoń już w nie nie wchodzi), żelazo z metalicznym połyskiem i rdzawymi zaciekami

## 0.23.3 — ładunek w rękach (2026-10-15)

- Chłop niosący ładunek trzyma go oburącz przed sobą przez cały czas: stojąc nie drapie się, nie macha i nie rozkłada rąk (wcześniej ręce opadały, a kosz czy blok wisiał sam w powietrzu)
- Ładunek rośnie i maleje razem z postacią (ludzie są różnego wzrostu), więc trafia w dłonie i u niskiego, i u wysokiego
- Kosze, worek z mąką i blok kamienia węższe: dłonie obejmują je z boków zamiast wchodzić w środek
- Niesione zboże to snop jak w stodole (pęk źdźbeł z powrósłem i kłosami), a nie trzy żółte stożki

## 0.23.2 — nowy kruk (2026-10-15)

- Kruk z gotowego modelu CC0 („Raven”, OpenGameArt): prawdziwa sylwetka, pióra z teksturą (krucza czerń z połyskiem), ciemne nogi z palcami
- Spłoszone kruki nie znikają: zrywają się i krążą nad ciałem, machając skrzydłami (8 klatek animacji lotu z modelu), a gdy ludzie odejdą, wracają dziobać
- W podglądzie modeli: „Kruk” i „Kruk w locie”

## 0.23.1 — przegląd modeli z Blendera (2026-10-15)

- Obejrzane w podglądzie z trzech stron: ludzie, zwierzęta, rzeczy z podwórka i budynki z Blendera
- Poprawione: fartuchy chłopa i gospodyni nie są już szare jak kamień (len jasny mimo cienia w fałdach); tara przy balii oparta z zewnątrz zamiast wbitej w środek wody
- Podgląd modeli: rzeczy wiszące w dół (pranie) stają na podstawce zamiast chować się pod nią

## 0.23.0 — symulacja w osobnym wątku (2026-10-15)

- W grze z botami logika gry (ekonomia, ścieżki, wojsko, boty) liczy się w osobnym wątku przeglądarki (Web Worker); wątek główny tylko rysuje i obsługuje interfejs, więc długi tick (np. bot planujący zabudowę w 4v4) nie przycina obrazu
- Gra przez sieć, tryb deweloperski i testowy liczą jak dotąd w wątku głównym (tam stan zmieniają też narzędzia); gdy wątek się nie wczyta albo nie odpowiada 3 s, gra sama wraca do liczenia w wątku głównym
- F3 / `__perf()` pokazuje „wątek symulacji: tak/nie”; `?bezwatku` wyłącza wątek, `?test=1&watek=1` włącza go w testach

## 0.22.2 — szczegóły wg jakości grafiki (2026-10-15)

- Zasięg szczegółów zależy od poziomu grafiki: na najwyższym bez zmian (drzewa jako bryły i kępy, kamyki do ok. 30 pól), na niższych drzewa wcześniej przechodzą w obrazki, a drobiazgi wcześniej znikają (do ok. 55% zasięgu na najniższym); automat jakości obniża to sam przy spadku FPS

## 0.22.1 — mniej wywołań rysowania (2026-10-15)

- Ściany, dachy i kominy budynków sklejone z setek drobnych brył w kilka siatek (ten sam materiał = jedna siatka; wygląd bez zmian): w wiosce testowej ok. 600 wywołań rysowania mniej na klatkę razem z cieniami
- Skrzydła wiatraków i maszty flag też sklejone; daleka puszcza za mapą (obrazki drzew) w dużych kawałkach — razem z budynkami z ok. 1600 do ok. 1140 rysowanych części w widoku wioski
- Naprawa: chmury wywracały klatkę błędem przy przejaśnianiu się pogody

## 0.22.0 — więcej ustawień (2026-10-14)

- Interfejs: paski zdrowia (zawsze / w walce / tylko zaznaczeni / nigdy), licznik FPS w rogu (domyślnie ukryty, F3 dalej pokazuje statystyki), dymki z tym, co mówią ludzie, podpowiedzi po najechaniu (od razu / z opóźnieniem / wcale)
- Nowa zakładka Rozgrywka: tempo gry na starcie (pauza, 1×, 2×, 3×), pytanie przed rozbiórką (można wyłączyć)
- Grafika: limit klatek (30 / 60 / bez limitu), jasność (60–160%), deszcz i mgła do wyłączenia
- Reszta pomysłów do ustawień zapisana w docs/pomysly.md

## 0.21.9 — wielkość interfejsu w ustawieniach (2026-10-14)

- Ustawienia → Interfejs → „Wielkość interfejsu”: 50–150% względem wielkości dobranej do ekranu; powiększa całe menu (okna i dolny pasek), belkę gry, okna budynków i wojska, raporty i czat; działa od razu i zapisuje się w przeglądarce

## 0.21.8 — okno budynku mieści się na ekranie (2026-10-14)

- Okno koszar (i każdego budynku czy oddziału) kończy się pod znacznikami wersji, FPS i przyciskiem „Deweloper” na każdym ekranie, także 24″ z otwartą listą budynków; resztę się przewija
- `__test.select('barracks')` otwiera okno budynku w testach

## 0.21.7 — tekstury na ludziach (2026-10-14)

- Wszyscy ludzie (gospodynie, dzieci, chłopi, strażnicy, włócznicy, łucznicy) mają splot płótna na ubraniach, ziarno skóry na butach i pasach i słoje na drzewcach, łukach i tarczach; splot jest szary, więc barwy ubrań zostają
- Pranie na sznurach też z szarym splotem (bez brązowego zabarwienia), jaśniejszy fartuch gospodyni

## 0.21.6 — gospodyni i dziecko z Blendera (2026-10-14)

- Gospodyni to własny model: suknia do ziemi z fałdami i ciemniejszym obrąbkiem, sznurowany gorset, biały dekolt koszuli, lniany fartuch z troczkami, mankiety; na głowie chusta zawiązana na karku albo włosy w kok z warkoczem (zamiast chłopa z doklejonym stożkiem)
- Dziecko ma proporcje dziecka: duża głowa, krótkie ręce i nogi, koszula do kolan przewiązana sznurkiem, bose nogi albo owijacze, rozczochrane włosy albo czapeczka
- Ustawienia → zakładka „Dla twórców”: stałe odnośniki do podglądu modeli i pustej sceny testowej

## 0.21.5 — podgląd modeli (2026-10-14)

- `modele.html?id=tavern`: każdy model gry osobno (budynki, ludzie, zwierzęta, podwórko, graty) na kamiennej podstawce, w powietrzu albo na trawie, w zwykłym świetle i pełnej jakości; oblatywanie myszą, noc, widok bez dachu, siatka, liczba trójkątów i wymiary
- Zasady dla wszystkich czatów (CLAUDE.md, „Modele”): modele robimy w Blenderze, z teksturami, najpierw sprawdzamy w podglądzie, potem na pustej scenie
- Drobniejszy splot płótna na sukni gospodyni

## 0.21.5 — podgląd modeli (2026-10-14)

- Nowa strona `modele.html`: każdy model gry (budynki, ludzie, zwierzęta, podwórko, graty) osobno na kamiennej podstawce, w powietrzu albo na trawie, w pełnej jakości; obrót myszą, noc, bez dachu, siatka, liczba trójkątów i wymiary
- Suknia gospodyni z drobnym splotem płótna zamiast grubej kraty

## 0.21.4 — scena do sprawdzania modeli (2026-10-14)

- `?test=1&pusta=1&model=tavern`: gotowy model budynku na pustej łące, w południe, kamera od frontu; `__test.view(...)` obchodzi go dookoła, z góry, z bliska i z ziemi oczami chłopa, `__test.model(...)` wymienia model bez przeładowania
- Na pustej scenie budynki stoją od razu gotowe (bez kilkusekundowego pokazu budowy, przez który wyglądały jak rusztowania)

## 0.21.3 — każda chata ma swoje podwórko (2026-10-14)

- Nowe modele z Blendera z teksturami desek, płótna i ziemi: balia z klepek i obręczy z mydlinami i tarą, krzywe słupki ze sznurem, który zwisa między nimi, pranie (koszula, prześcieradło, chusta, portki), stos polan z pniakiem i siekierą, ława z dzbankiem, kosz z praniem, wiadro, grządka z kapustą w plecionym płotku
- Każda chata losuje 2–4 z tych rzeczy i stawia je tuż przy swoich ścianach, w innych miejscach niż sąsiedzi i nie na gratach; pranie też co chata inne (ile sztuk, jakie, w jakich kolorach)
- Gospodyni robi to, do czego ma rzeczy: pierze w balii, wiesza pranie, pieli grządkę, nosi polana, siada na ławie, a do tego zamiata przed drzwiami i sypie ziarno kurom

## 0.21.2 — pusta scena do testów (2026-10-14)

- `?test=1&pusta=1`: płaska łąka z samymi twierdzami, bez lasów, wody, botów i wilków, a w `__test` pomocniki `home`, `place`, `hour`, `peasants`, `wolf` — szybkie zrzuty jednej rzeczy dla wszystkich czatów

## 0.21.1 — widać życie w chacie (2026-10-14)

- Gospodyni w długiej sukni, a przy chacie balia i sznur z praniem, które kołysze się na wietrze za dnia
- Co kilkanaście sekund inna praca, wyraźnie widoczna: zamiatanie miotłą przed drzwiami (z kurzem spod miotły), pranie pochylona nad balią, wieszanie prania z rękami w górze, sypanie ziarna kurom, odpoczynek
- Dzieci o połowę mniejsze: biegają, gonią się, podskakują, czasem biegną z rękami w górze

## 0.21.0 — rodziny przy chatach, pochodnie bez biegania (2026-10-14)

- Przy każdej chacie żona i 0–2 dzieci: za dnia kobieta krząta się przy domu (zamiata, coś robi rękami), dzieci biegają i bawią się w berka; nocą wszyscy w chacie, a na widok wilka albo wrogiego żołnierza uciekają do domu (tylko wygląd, gra przez sieć zgodna)
- Pochodnie zapalają kobiety z pobliskich chat: wieczorem obchodzą pochodnie przy swojej chacie i budynkach w pobliżu, każda pochodnia płonie od swojej godziny (20:00–21:00) do świtu
- Chłopi nie biegają już wieczorem od pochodni do pochodni — od razu idą do ogniska i karczmy
- Pochodnie na słupach tylko przy budynkach z wejściem: bez pochodni przy każdym odcinku palisady, bramie i zamku

## 0.20.5 — kolumna nie staje przez jednego (2026-10-14)

- Zwarty marsz: oddział czeka tylko na zbiórkę na starcie (najwyżej ok. 4 s); w drodze nie staje, gdy ktoś się przesunie albo utknie — czoło lekko zwalnia, maruder przyspiesza, żeby dogonić, a kto przez 3 s jest daleko (las, tłok, mur), idzie sam swoją drogą na miejsce
- Cały oddział staje tylko przy ataku w marszu, dopóki trwa walka

## 0.20.4 — więcej klatek na sekundę (2026-10-14)

- Drzewa przechodzą w obrazki od ok. 30 pól od środka widoku (było 42), kępy, kwiaty i kamyki znikają wcześniej — z bliska nic się nie zmienia
- Krzaki dalej niż 30 pól to jedna prosta bryła (40 trójkątów zamiast 320) — krzaków są tysiące, było to ponad 700 tys. trójkątów w klatce
- Góry za mapą nie rzucają cienia (100 tys. trójkątów mniej w każdej klatce cienia)
- Zwierzęta w osadzie dalej niż ~40 pól od kamery nie są liczone ani rysowane; lżejsze kury
- Pomiar w Chrome (pełna grafika, widok osady): ok. 34 → 50–55 FPS

## 0.20.3 — płynność przy wielu graczach (2026-10-14)

- Boty myślą każdy w innym ticku (przy 4 na 4 osiem botów naraz zacinało grę co 20 s), palisadę bota sprawdzają po kawałku (najwyżej ~40 odcinków na raz)
- Żołnierz albo strażnik, którego cel zabudowano (np. punkt obchodu pod nowym sadem), idzie na najbliższe wolne pole obok — wcześniej szukanie drogi przeszukiwało całą mapę co półtorej sekundy
- Żołnierze stojący na działce nowego budynku schodzą z niej, zamiast stać w ścianach
- Zwarty marsz: maruder kręcący się przy przeszkodzie nie zatrzymuje już oddziału na minutę — po kilku sekundach bez wyraźnego postępu idzie sam
- Wynik w 2-godzinnej grze 4 na 4: średnio 1,2 ms na tick (było 2,1), najdłuższy tick 95 ms (było 330); w 1 na 1 najdłuższy tick ok. 35 ms

## 0.20.2 — przegląd długiej gry (2026-10-14)

- Nowe narzędzie: długie gry bot kontra bot bez przeglądarki (`npx vitest run --config tools/soak/vitest.config.ts`, zmienne SOAK_SEEDS, SOAK_HOURS) — wypisuje zawieszonych chłopów i żołnierzy, stojące budowy, pat w walce, rozjazd zapisu i najwolniejsze ticki
- Naprawa: żołnierz, który nie mógł dojść do wroga (np. strażnik za murem zamku), stał pod murem bez końca; teraz szuka drogi, a gdy jej nie ma, bierze inny cel albo rozbija mur
- Naprawa: odważny chłop stawał jak wryty, gdy wróg stał 2–3 pola od niego (np. pod murem) — przestawał pracować na długo; teraz staje tylko tuż przy wrogu i wtedy się bije
- Płynność: bot szukający miejsca na budynek albo palisadę potrafił zatrzymać grę na 0,2–0,35 s; sprawdzanie, czy budynek nie zablokuje przejścia, jest 3–4 razy szybsze (najdłuższy tick w 3-godzinnej grze: 76–130 ms zamiast 200–340 ms)

## 0.20.1 — gdzie jest straż (2026-10-14)

- Po kliknięciu twierdzy każdy strażnik miejski ma czerwone kółko pod stopami i czerwoną tarczę z krzyżem nad głową (tej samej wielkości przy każdym zbliżeniu); po odznaczeniu znaczniki znikają

## 0.20.0 — wilki i straż (2026-10-14)

- Strażnik miejski, który zobaczy wilka (12 pól), rzuca obchód i biegnie go ubić — wyraźnie szybciej niż zwykle; goni też uciekającego (do granicy osady)
- Wilki słabsze: gryzą rzadziej i lżej (chłop wytrzymuje cztery ugryzienia), wataha 2–3 wilki zamiast 2–4, po zabiciu wilk długo pożera ofiarę; ciężko ranny wilk ucieka do lasu, chłopi biją go mocniej
- Zabity wilk zostaje na ziemi (leży na boku), obsiadają go kruki, zabiera go grabarz albo zgnije; wilk, który uciekł do lasu, nie zostawia ciała
- Nad każdym wilkiem pasek zdrowia
- Karta strażnika (i wojska) nie pokazuje już resztek okna budynku (plac budowy, materiał, zasięg strzału)
- Rozpiska popularności nie wyjeżdża poza ekran przy powiększonym interfejsie

## 0.19.3 — paski zdrowia pod menu (2026-10-14)

- Pasek zdrowia żołnierza nie przechodzi już przez dolne menu, okno budynku ani pasek wojska — chowa się pod nimi

## 0.19.2 — ludzie chodzą po drodze, nie w niej (2026-10-14)

- Ludzie, żołnierze i zwierzęta stoją na wierzchu nawierzchni (ścieżka, bruk, bale drogi z dyli), zamiast przenikać przez nią po kostki; na drogę wchodzą krótkim krokiem w górę przy brzegu pola
- Droga z dyli wygląda jak przedtem (cofnięte wpuszczenie bali w ziemię, które zasłaniało deski)

## 0.19.1 — zwierzęta z Blendera (2026-10-14)

- Kury (białe, rude, czarne), świnia, koń i pies zrobione w Blenderze jak reszta postaci (tools/models/animals.py → src/render/models/animals.json): gładkie bryły, pióra i sierść w kolorach wierzchołków, cień w zagłębieniach; pies to teraz płowy kundel z klapniętymi uszami, a nie przemalowany wilk

## 0.19.0 — życie osady, poprawka muzyki (2026-10-14)

- Rozmowy: stojący bez zajęcia blisko siebie (ten sam pan) dobierają się w pary, zwracają się do siebie i gadają na zmianę — mówiący gestykuluje, słuchający kiwa głową, co kilkanaście sekund chwila ciszy; z bliska słychać cichy bełkot rozmowy
- Pozdrowienie w przejściu: mijając swojego, chłop czasem macha ręką
- Kury przy chatach: grzebią, dziobią, przed przechodniem uciekają z trzepotem, gdaczą; nocą w kurniku
- Świnie: przy co trzeciej chacie i przy polach, ryją w ziemi, chrząkają, nocą leżą na boku
- Koń przy koszarach: skubie trawę, macha ogonem
- Pies: jeden przy każdej twierdzy, chodzi za kimś z mieszkańców, siada, gdy pan stoi, merda ogonem; nocą biegnie pod wilka i go obszczekuje, szczeka też na obcych żołnierzy
- Wszystko to tylko wygląd: symulacja się nie zmienia, gra przez sieć zostaje zgodna
- Muzyka: nigdy dwa utwory naraz — zmiana nastroju (dzień, noc, menu, walka) przełącza utwór dopiero, gdy się utrzyma (migający alarm nie przełącza), nowy utwór zaczyna się, gdy stary całkiem ucichnie, a stary utwór nie może już „zgubić” bieżącego
- Podgląd: podglad-zwierzeta.html?osada=1

## 0.18.1 — spokojniejsze kroki (2026-10-14)

- Spacer oczami chłopa: kroki w ludzkim tempie (idąc ok. 1,8 na sekundę, biegiem ok. 2,7) zamiast serii jak z karabinu; kołysanie kamery w tym samym rytmie
- Nagrania kroków łagodniejsze (bez ostrego trzasku na początku, przycięte wysokie tony) i cichsze; kroki innych postaci najwyżej 5 na sekundę

## 0.18.0 — ludzie nie chodzą jak drewno (2026-10-14)

- Płynne chodzenie: chłopi i żołnierze skręcają łukiem zamiast załamywać się na rogach pól, patrzą tam, dokąd naprawdę idą, a po dojściu wsuwają się na miejsce zamiast przeskakiwać
- Mijający się omijają się w bok (każdy w swoją prawą stronę), zamiast przez siebie przenikać
- Zachowanie w miejscu: stojący chłop co kilka sekund się rozgląda, przestępuje z nogi na nogę, drapie się w głowę, przeciąga, ociera czoło, a cały czas przenosi ciężar i oddycha; żołnierz rozgląda się, przestępuje i opiera o włócznię
- Chód: biodra kołyszą się z krokiem, tułów lekko pochylony (uciekający mocniej); włócznik trzyma tarczę przed sobą zamiast nią wymachiwać
- Kroki zależne od podłoża: bruk (i dziedziniec zamku), deski, żwir na piaskowej drodze i skałach, ziemia z trawą, błoto po deszczu; słychać je tylko z bliska (najwyżej 8 na sekundę) i w spacerze oczami chłopa (nagrania CC0, Kenney)
- Wszystko to tylko wygląd: symulacja się nie zmienia, gra przez sieć zostaje zgodna

## 0.17.2 — dźwięk pochodni (2026-10-14)

- Zapalenie pochodni w ręce (F w spacerze oczami chłopa) brzmi jak buchnięcie płomienia zamiast skrzypnięcia drzwi (nagranie CC0)

## 0.17.1 — karta strażnika, poprawka cechów (2026-10-14)

- Karta mieszkańca: łuczarz i karczmarz mają nazwę cechu („Cech łuczarzy”, „Cech karczmarzy”) zamiast surowego klucza; kto pracuje w budynku bez cechu, ma „Pracuje: …”
- Kliknięty strażnik miejski poza odzywką pokazuje kartę: imię, wiek, stopień (lekki albo ciężki strażnik miejski), co robi (posterunek przy bramie, obchód, walka, pogoń za wilkiem) i zdrowie

## 0.17.0 — zwarty szyk i ranni (2026-10-13)

- Marsz w zwartym szyku: oddział (dwóch i więcej, dalej niż 4 pola) idzie jedną drogą za wspólnym punktem prowadzącym, każdy trzyma swoje miejsce obok niego; na starcie oddział się zbiera, po drodze czeka na maruderów, a przeszkody (drzewo, woda) omija, przechodząc za punktem prowadzącym; utknięty maruder po chwili idzie sam
- Na miejscu każdy dochodzi na swoje pole i obraca się we wskazanym kierunku; atak w marszu zatrzymuje cały oddział, dopóki trwa walka
- Odwrót rannych: żołnierz z 30% zdrowia albo mniej ustępuje z walki 4 pola za szyk (od wroga), nie walczy; gdy wroga już nie widać, idzie do twierdzy; gdy wróg podchodzi, cofa się dalej
- Przy własnej twierdzy (do 3 pól) każdy żołnierz odzyskuje 1 punkt zdrowia co 1,5 s; wyleczony do 90% ranny wraca na swoje miejsce w szyku
- Postawa „Stój”, łucznicy na wieżach i straż miejska się nie wycofują; nowy rozkaz gracza zdejmuje rannemu odwrót

## 0.16.6 — nowy wilk i kruk (2026-10-13)

- Wilk od nowa: głęboka klatka, wcięty brzuch, kudłaty kark, długi pysk z jasną żuchwą i policzkami, stojące uszy, futro z ciemnym siodłem na grzbiecie i jasnym brzuchem; przednie i tylne łapy różne (tylne z mocnym udem i skokiem), puszysta kita z ciemnym końcem
- Kruk od nowa: pierś, łeb z grubym, lekko zakrzywionym dziobem, nastroszone pióra na gardle, złożone skrzydła z lotkami, klinowy ogon, nogi z palcami, granatowy połysk na grzbiecie
- Podgląd: podglad-zwierzeta.html

## 0.16.5 — kilof na plecach (2026-10-13)

- Kilof na plecach przypięty płasko: stylisko lekko skośnie, grot w poprzek pleców przy barku; nie przebija już rąk i nie sterczy w bok

## 0.16.4 — chłopi z bronią (2026-10-13)

- Więcej chłopów staje do obrony: sześciu na dziesięciu (reszta ucieka)
- Każdy chłop ma swoją broń: kilof przewieszony skośnie przez plecy albo drewnianą maczugę u pasa (widać ją na co dzień)
- W walce wyciąga ją do ręki: kilof oburącz z zamachem znad głowy, maczuga jedną ręką, cios z pochyleniem i stuk; kilof boli trochę bardziej (3), maczuga mniej (2), wciąż rzadko
- Podgląd: podglad-wojsko.html?bron=1

## 0.16.3 — chłopi reagują na wroga, krzyki (2026-10-13)

- Chłopi się rozglądają: na widok wrogiego żołnierza w promieniu 5 pól tchórz (dwóch na trzech) od razu ucieka biegiem w przeciwną stronę, a odważny (co trzeci, zawsze ten sam) staje twarzą do wroga i z bliska okłada go kijem — rzadko i słabo; śpiący pod dachem nic nie widzą
- Dźwięki (CC0, Freesound przez C-Dogs SDL): krzyk uciekającego chłopa, zaskoczone „hę?!” odważnego na widok wroga, krzyk przy śmierci żołnierza i chłopa; najwyżej trzy krzyki na sekundę, z miejsca, gdzie się dzieją (z daleka cicho)

## 0.16.2 — atak na wrogich chłopów (2026-10-13)

- Prawy klik na wrogim chłopie przy zaznaczonym wojsku = atak (kursor miecza): żołnierze gonią go, aż padnie
- Chłop pod ciosem jak kopacz w Gothicu, zawsze tak samo dla danej osoby: co trzeci staje i oddaje (znikome obrażenia), reszta rzuca robotę i ładunek i ucieka pod swój zamek albo do obozowiska, a potem wraca do pracy
- Uciekający chłop biegnie co sił (ok. 1,7 raza szybciej) najpierw w przeciwną stronę niż napastnik, z rękami machającymi nad głową, potem wraca do swoich zajęć
- Żołnierz bijący chłopa zwraca się do niego i dźga włócznią, łucznik strzela (wcześniej stał bez ruchu)
- Żołnierze dalej sami biją wrogich chłopów, których zobaczą (każdy zabity obniża popularność ich pana)

## 0.16.1 — skrzynie i drewniane graty (2026-10-13)

- Skrzynie przy domach zamiast gładkich pudełek: narożne słupki, poziome klepki ze szparami, żelazne okucia na rogach, wieko z desek z listwą; na wierzchu otwarta skrzynka z rzepą i jabłkami
- Drewniane graty (skrzynie, beczki, taczki, polana, wiadra) mają teksturę słojów drewna zamiast jednolitego koloru
- Podgląd gratów z bliska: podglad-wojsko.html?graty=1

## 0.16.0 — walka z charakterem (2026-10-13)

- Kierunek ciosu ma znaczenie: z boku o 30% mocniej, w plecy o 60% (liczy się, w którą stronę żołnierz patrzy: na przeciwnika, w stronę marszu albo w kierunek szyku)
- Tarcza włócznika łapie połowę strzały z przodu; z boku i z tyłu nie chroni
- Szarża: włócznik po rozbiegu (ok. 1,5 s marszu albo pościgu) zadaje pierwszy cios podwójnie
- Łucznicy chybiają: z bliska prawie zawsze trafiają, z daleka mniej więcej co drugi raz, z wieży celniej; chybiona strzała może zranić swojego, który stoi tuż przy celu
- Trafiony żołnierz odchyla się i lekko cofa; poległy przewraca się do tyłu zamiast od razu leżeć

## 0.15.3 — daleki las jako obrazki (2026-10-13)

- Dalekie drzewa (za ok. 40 pól od kamery i cała puszcza za mapą) to obrazki prawdziwego świerka i drzewa liściastego sfotografowane z 8 stron przy starcie: dwa trójkąty na drzewo, z każdej strony właściwy widok, światło, noc i mgła działają jak na bryłach
- Zamiast stożków i kul z daleka widać sylwetki prawdziwych drzew
- Puszcza za mapą mniej więcej dwa razy gęstsza przy tym samym koszcie rysowania
- Pień znika razem z przełączeniem korony na obrazek; obrazki nie rzucają cieni

## 0.15.2 — szybszy drugi start (2026-10-13)

- Pliki gry (kod, tekstury zdjęciowe, dźwięki, czcionki) zostają w przeglądarce (Service Worker): kolejne wejście nie pobiera ich z sieci; nowa wersja gry ładuje się zawsze (strona najpierw z sieci), a tekstury i dźwięki odświeżają się w tle; stare wersje kodu są sprzątane
- Miniatury budynków w menu zapamiętane między wizytami (do następnego wdrożenia): zamiast ok. 5–6 s rysowania od razu
- Tryb testowy i serwer deweloperski działają bez pamięci podręcznej

## 0.15.1 — praca z narzędziami, kopacze (2026-10-13)

- Drwal rąbie siekierą trzymaną oburącz: zamach nad ramię, cios w drzewo z pochyleniem, stuk w chwili trafienia; stoi twarzą do drzewa
- Kopacze w kamieniołomie i kopalni biją kilofem: wysoki zamach nad głowę, mocny cios w dół w skałę
- Rzemieślnicy w warsztatach (piekarz, włóczniarz, łuczarz…) pochyleni nad stołem, ręce na zmianę wyrabiają albo strugają
- Pracownicy kamieniołomu i kopalni nazywają się jak w Gothicu: kopacze (karta osoby, opisy, nowe odzywki)
- Karta osoby opisuje też noszenie materiału i układanie dróg
- Tryb testowy: `__test.at(x, y, odległość)` ustawia kamerę nad polem

## 0.15.0 — drogi się buduje, droga z dyli, bliższa kamera (2026-10-13)

- Nowa droga z dyli: drewniane bale, 1 drewno za pole, ludzie chodzą po niej o 40% szybciej (piaskowa 25%, kamienna 55%)
- Drogi się buduje: postawiona droga to półprzezroczysty plan w barwie nawierzchni; wolny chłop z obozowiska podchodzi, pochyla się i układa pole młotkiem (do 4 naraz na gracza); gdy nikt nie siedzi w obozowisku, jeden pracownik odrywa się od roboty i potem wraca; koszt płaci się przy stawianiu
- Na drogę z dyli chłop najpierw idzie do składu po drewno, na kamienną po kamień, i niesie je na pole; piaskowej nie trzeba nic nosić (bez składu na dany surowiec idzie prosto na pole)
- Plan drogi da się zdjąć wyburzaniem, a budynek postawiony na planie go kasuje; w trybie deweloperskim drogi powstają od razu
- Stare zapisy dalej się wczytują (nowy rodzaj dopisany na końcu listy)
- Kamera podjeżdża do 4 (dawniej 12), z bliska kładzie się niżej

## 0.14.2 — zapis ustawień (2026-10-13)

- Do zapisu gry trafiają też grupy wojska, wybrany szyk, tryb marszu, tempo gry i kamera; po odświeżeniu strony wszystko wraca
- Gra zapisuje się przy zamknięciu lub odświeżeniu strony, przy przełączeniu karty i co 15 s (wcześniej tylko co 50 kroków symulacji, więc ostatnie chwile i zmiany na pauzie ginęły)
- Zapis grupy (Shift + cyfra) od razu trafia do pamięci; nowa mapa zaczyna bez starych grup

## 0.14.1 — pasek wojska (2026-10-13)

- Nad dolnym menu pasek wojska: 10 miejsc na grupy (1–9 i 0) z portretem i liczbą żołnierzy; klik = wybierz grupę (dwa razy = kamera), klik w puste miejsce albo Shift + klik = zapisz zaznaczonych, prawy klik = wyczyść
- Obok grup portrety zaznaczonych żołnierzy ze zdrowiem: klik = odznacz, Shift + klik = zostaw tylko jego
- Klawisz 0 to dziesiąta grupa; mniejsze, równe kółka zaznaczenia (nie nachodzą na siebie w szyku)

## 0.14.0 — atak w marszu, grupy, okrzyki (2026-10-13)

- Tryb marszu w panelu wojska: zwykły albo z walką (biją każdego wroga po drodze, potem idą dalej na miejsce); Ctrl + prawy klik odwraca tryb dla jednego rozkazu
- Oddział idzie wspólnym tempem najwolniejszego, więc łucznicy i włócznicy się nie rozjeżdżają
- Grupy: Shift + cyfra zapisuje zaznaczonych, cyfra ich wybiera, dwa szybkie naciśnięcia = kamera nad grupą; numer grupy w nagłówku panelu
- Okrzyki: przy zaznaczeniu, marszu i ataku jeden z żołnierzy odpowiada (dymek i szorstki głos), osobne kwestie dla włóczników i łuczników

## 0.13.1 — nowy wygląd żołnierzy (2026-10-13)

- Włócznik: kolczuga z czepcem, waffenrock w barwach pana z krzyżem, kapalin albo hełm z nosalem, wypukła tarcza z okuciem i guzem, włócznia z liściastym grotem
- Łucznik: pikowana przeszywanica, kaptur z pelerynką i ogonem, duży kołczan z pasem przez pierś i wystającymi strzałami, karwasz, kord u pasa, długi łuk trzymany zawsze pionowo
- Sylwetki toczone zamiast pudełek, dłuższe nogi i mniejsza głowa; cieniowanie fałd, obrębków i pikowania; metal lekko połyskuje
- Podgląd samego wojska: podglad-wojsko.html (serwer deweloperski), sami chłopi: ?chlopi=1
- Nowi chłopi: wełniana tunika w wyblakłych barwach pana z fałdami i wytartym dołem, sznurek z sakiewką, lniane owijacze, buty; słomkowy kapelusz, kaptur z pelerynką, filcowa czapka, lniana chusta albo goła głowa z czupryną; broda, fartuch

## 0.13.0 — sterowanie wojskiem (2026-10-13)

- Prawy klik nie gubi już rozkazów (wcześniej najmniejszy ruch myszy liczył się jako obrót kamery)
- Prawy przycisk przeciągnięty rysuje linię frontu: szerokość szyku i kierunek, w który staną; podgląd miejsc w trakcie
- Formacje: linia, blok, luźno; wręcz z przodu, łucznicy z tyłu; po dojściu żołnierze obracają się w kierunek szyku i stoją zwartym oddziałem
- Postawy: atak (goni wroga), obrona (walczy przy swoim miejscu i wraca), stój (nie rusza się)
- Panel wojska: przyciski typów jednostek (klik = tylko ci, Shift + klik = bez nich), szyk i postawa; panel nie gubi kliknięć
- Pewniejsze zaznaczanie kliknięciem (cała sylwetka), podwójny klik = wszyscy tego rodzaju na ekranie
- Przy zaznaczonym wojsku kamerę obracają Q/E (albo Ctrl + lewy)

## 0.12.0 — poziomy trudności, skryba, podsumowanie (2026-10-12)

- Nowa gra: poziom trudności — pokojowy (wróg tylko się broni), łatwy (domyślny), średni, trudny
- Pasek u góry odlicza czas do ataku wroga i alarmuje, gdy fala nadciąga
- Skryba w lewym górnym rogu: okrągły portret, wiadomość i „mowa” (brak i koniec żywności, pełny skład, zmrok i świt, ucieczka ludzi, nadciągający wróg)
- Nad budynkiem bez pracownika kołysze się znak przekreślonego człowieka
- Koniec gry zatrzymuje grę i pokazuje podsumowanie: czas, zebrane surowce, budynki, wyszkoleni, zabici, polegli, zburzone budynki wroga
- Zapis w nowej wersji

## 0.11.0 — oblężenie i koniec gry (2026-10-12)

- Budynki mają wytrzymałość (twierdza 1500); widać ją w oknie budynku z paskiem
- Żołnierze bez wroga w pobliżu biją najbliższy wrogi budynek; zburzona twierdza = gracz odpada; ekran Zwycięstwo / Porażka
- Inżynier z cechu naprawia uszkodzone budynki
- Z zaznaczonym wojskiem kursor nad wrogiem zmienia się w miecz, prawy przycisk = atak na tego żołnierza albo budynek
- Paski zdrowia nad rannymi, zaznaczonymi i wskazanymi żołnierzami
- Zapis w nowej wersji

## 0.10.0 — bot przeciwnik (2026-10-12)

- Drugi zamek gra sam: buduje osadę według planu (drwale, sady, chaty, skład, warsztat włóczniarza, koszary, kamieniołom, spichlerz, cmentarz), pobiera podatek, szkoli włóczników
- Pierwsza fala ataku po ok. 12 minutach gry, kolejne co ok. 6 minut i coraz większe
- Bot działa w symulacji: te same rozkazy dają zawsze ten sam przebieg (gotowe pod grę przez sieć)
- Obozowisko: po kliknięciu widać posłania pod wiatą; płaski teren

## 0.9.2 — ciała, cmentarz, pchnięcia (2026-10-12)

- Polegli zostają na polu: ciało w barwach drużyny z ciemną plamą, z czasem ciemnieje i zapada się; po ok. 10 minutach gry rozkłada się do końca
- Cmentarz (Wojsko): grabarz chodzi po ciała, niesie je owinięte w płótno i chowa
- Pchnięcie włócznią widać: ręka wychodzi do przodu, włócznia kładzie się poziomo grotem we wroga
- Żołnierze nie stoją na jednym polu: w walce zajmują wolne pola wokół wroga, a stojący na zajętym polu odsuwają się
- Zapis w nowej wersji

## 0.9.1 — walka (2026-10-12)

- Żołnierze mają zdrowie i atak: stojący wypatrują wroga w promieniu 6 pól, podchodzą i biją; polegli znikają
- Marsz na rozkaz ma pierwszeństwo przed walką (można wycofać oddział)
- Złota fala w miejscu rozkazu, migające kropki celu, portrety zaznaczonych z paskami zdrowia

## 0.9.0 — pierwsze wojsko (2026-10-12)

- Nowa kategoria Wojsko: warsztat włóczniarza (z drewna robi włócznie do składu) i koszary (wolny chłop + włócznia + 8 złota = włócznik)
- Włócznik: kolczuga, tunika w barwach drużyny, kapalin, tarcza i długa włócznia; żołnierze nie liczą się do ludności osady
- Zaznaczanie: lewy przycisk przeciągnięty = ramka, kliknięcie = jeden żołnierz, Shift dodaje; prawy przycisk na mapie = marsz w szyku; Esc odznacza
- Mapa przesuwa się środkowym przyciskiem, klawiszami i kursorem przy krawędzi (lewy przycisk służy teraz do zaznaczania)
- Zapis w nowej wersji (stare zapisy się nie wczytają)

## 0.8.1 — rozbudowane ustawienia i poradnik (2026-10-12)

- Ustawienia w zakładkach: Dźwięk (głośność ogólna, budowa i praca, interfejs, otoczenie, wyciszenie), Grafika (cienie od wyłączonych do wysokich, cieniowanie zagłębień w czterech poziomach, rozdzielczość obrazu, cykl dnia i nocy), Sterowanie (szybkość kamery, przesuwanie mapy kursorem przy krawędzi ekranu); przycisk przywracania domyślnych
- Jak grać w sześciu rozdziałach: pierwsze kroki, surowce, jedzenie, ludzie i popularność, budowa i burzenie, sterowanie
- Menu i belka budowy bez pasków przewijania

## 0.8.0 — menu główne (2026-10-12)

- Po wczytaniu menu główne na tle osady, nad którą powoli krąży kamera; gra stoi, dopóki menu jest otwarte
- Kontynuuj (gdy jest zapis), Nowa gra (tryb 1v1/2v2/4v4, nazwa mapy z losowaniem, ostrzeżenie o zastąpieniu osady), Ustawienia (głośność, wyciszenie, cieniowanie zagłębień, jakość cieni — zapamiętywane), Jak grać
- W trakcie gry Esc albo przycisk Menu otwiera to samo menu z opcją Wróć do gry; zakładki Mapa i Sterowanie zniknęły z belki

## 0.7.3 — ekran wczytywania (2026-10-12)

- Zamiast pustego beżowego ekranu: ekran wczytywania z paskiem i licznikiem zasobów (silnik, każda tekstura po kolei, modele, budowa świata)

## 0.7.2 — nowa chata (2026-10-12)

- Chata z szachulcem: podmurówka z polnych kamieni, bielone ściany z ręcznie ciosanymi belkami, wycięte otwory drzwi i okien z szybkami, parapetami i okiennicami, gruba nierówna strzecha z kalenicą, kamienny komin, skrzynka z kwiatami, beczka i stos drewna; każda chata trochę inna (strona komina i drewna, odcienie belek)
- Narzędzia rzemieślnicze w kodzie (src/render/craft.ts): belki, podmurówki, strzecha, ściany z otworami — do kolejnych budynków

## 0.7.1 — powrót do naszych modeli, cieniowanie zagłębień (2026-10-12)

- Wycofane modele KayKit (zbyt bajkowe); wszystkie budynki znów z kodu
- Cieniowanie zagłębień (AO): ciemniejsze kąty, styki ścian z ziemią, szczeliny między budynkami i pod drzewami
- Nowe narzędzia do budowy modeli: wycinanie otworów w bryłach i szum do naturalnych nierówności

## 0.7.0 — gotowe modele: próba (2026-10-12)

- Pierwsze budynki z gotowej paczki KayKit Medieval Hexagon (CC0): chata (dwa warianty), chata drwala, kopalnia, młyn; wariant kolorystyczny według barwy drużyny
- Nasze wnętrza, kłoda przy tartaku i animacje zostają; skrzydła wiatraka kręcą się przy pracy
- Modele wczytują się przed startem gry; gdy plik się nie wczyta, zostaje model z kodu

## 0.6.7 — rów bez nakładek (2026-10-12)

- Rów liczony od strony trawy: na wewnętrznych rogach pasy schodzą się na ukos, na zewnętrznych skręcają łukiem; nic się nie nakłada, także wokół pojedynczego pola otoczonego brukiem

## 0.6.6 — ostrzejsze tekstury (2026-10-12)

- Tekstury w wyższej rozdzielczości: bruk, mur twierdzy i trawa 2048 px, reszta 1024 px (wcześniej 512); dodatkowa drobna warstwa ziarna, filtrowanie anizotropowe 16×
- Mapa cieni 4096 px: ostrzejsze cienie budynków i ludzi
- Rów w dwa razy większej rozdzielczości; narożniki rowu jako łuk, płynnie łączący oba odcinki

## 0.6.5 — rów jak wykopany szpadlem (2026-10-12)

- Rów przy bruku: płytki pas wilgotnej ziemi, od strony trawy nierówna krawędź z kolejnych wbić szpadla, która miękko znika w trawie; grudki, kamyczki i źdźbła zwisające z brzegu, bez wody i bez prostej listwy

## 0.6.4 — tylko komputer (2026-10-12)

- Na telefonie i tablecie gra się nie uruchamia, pokazuje tablicę „Tylko na komputerze”
- Usunięte uproszczenia pod telefony: zawsze pełna rozdzielczość bruku, pełna mapa cieni, 12 świateł pochodni, pełna puszcza; usunięty układ interfejsu na telefon

## 0.6.3 — kamera i bruk (2026-10-12)

- Kamera: kąt patrzenia od prawie poziomego do pionowego (prawy przycisk w górę/dół albo T i G); nie wchodzi pod ziemię ani w pagórki
- Nowy bruk: drobne, jasne kamienie w rysunkowym stylu, z ciemnymi spoinami i mchem
- Dźwięk przy kliknięciu w budynek lub mieszkańca
- Na węższych ekranach belka narzędzi w dwóch rzędach

## 0.6.2 — prawdziwe dźwięki (2026-10-12)

- Nagrania Kenneya zamiast syntezy: stawianie budynku i drogi (4 warianty), wyburzanie (4 warianty), zawalenie, obrót, kliknięcie; wysokość lekko losowana przy każdym odtworzeniu
- Cichy szum otoczenia w pętli
- Źródła i licencja w docs/dzwieki.md; gdy plik się nie wczyta, gra wraca do dźwięku syntezowanego

## 0.6.1 — deski na ramieniu (2026-10-12)

- Drwal niesie wiązkę cienkich desek z przewiązkami i usłojeniem zamiast jednego klocka

## 0.6.0 — interfejs na dole (2026-10-12)

- Cały interfejs na dole ekranu, jak w grach miejskich: belka z zakładkami Dwór/Mapa/Sterowanie, kategoriami budowy z obrazkami, tempem, podatkami, racjami i wyburzaniem, a pod nią pas stanu z zegarem, surowcami i osadą
- Karty budynków wyskakują nad belką na środku ekranu po wybraniu kategorii; góra ekranu jest wolna
- Stan osady z ikonami (skład, spichlerz, ludność, bezrobotni, popularność), opisy w podpowiedziach

## 0.5.14 — kamienie (2026-10-12)

- Luźne głazy, kamyki i złoża mają nieregularną bryłę i teksturę skały (plamy, pęknięcia, porost); ta sama skała w kopalni i kamieniołomie
- Cech inżynierów: na dźwigu ciosany blok w linowym oplocie z krążkiem, nowa taczka z kamieniami

## 0.5.13 — piekarnia (2026-10-12)

- Wnętrze piekarni: podłoga z desek, kopulasty piec z żarem w łukowym otworze, łopata, stół z prawdziwymi bochenkami z nacięciem, dzieża z ciastem i worek mąki

## 0.5.12 — wnętrza i pole (2026-10-12)

- Pole: zamiast żółtych belek rosnące zboże — gęste źdźbła z kłosami na usypanych grzędach, falujące na wietrze
- Wnętrze młyna dopasowane do wieży: ten sam tynk ucięty nisko, żarna z lejem i obracającym się kamieniem, worki i skrzynia ziarna; skrzydła chowają się, gdy zaglądamy do środka
- Wnętrze twierdzy mieści się w obrysie donżonu, z tymi samymi ścianami i oknami co z zewnątrz; dziedziniec zostaje bez zmian

## 0.5.11 — jedna plansza (2026-10-12)

- Teren za krawędzią to ta sama siatka i tekstura co plansza: góry łagodnie opadają na zewnątrz, łąka przechodzi w ciemniejsze runo puszczy, bez szczeliny i niebieskiego paska

## 0.5.10 — kamieniołom (2026-10-12)

- Nowy model kamieniołomu: skalna ściana ze świeżo wyciętymi stopniami, żuraw z blokiem na linie i kołowrotem, ławka kamieniarza z młotkiem i dłutem, stos ciosów na podkładach, odłamki i pył

## 0.5.9 — puszcza za mapą (2026-10-12)

- Zamiast pasma gór za krawędzią mapy rośnie ogromny las: im dalej, tym drzewa większe i ciemniejsze, a w końcu znikają we mgle. Robotnicy go nie wytną, kamera tam nie wyjedzie
- Góry na planszy tylko w kilku masywach przy krawędzi, a kamień i żelazo przy nich; między masywami łąka i las dochodzą do puszczy
- Zapis gry w nowej wersji (stare zapisy nie wczytają się, bo zmieniła się mapa)

## 0.5.8 — zapasy w składzie (2026-10-12)

- Stosy w składzie i stodole z teksturami: deski z usłojeniem na przekładkach, ciosane bloki kamienia, sztaby żelaza, snopki zboża z przewiązką i kłosami, płócienne worki mąki, kosze bochenków i jabłek, skrzynka ryb

## 0.5.7 — rów przy drodze (2026-10-12)

- Wzdłuż drogi kamiennej płytki rów tuż przy krawędzi bruku: brudny piasek przy brzegach, wilgotne zbocza i lśniąca strużka wody na dnie; rów skręca razem z drogą
- Kostka kryje dokładnie swoje pole i równo dochodzi do rowu

## 0.5.6 — dźwięki i góry (2026-10-12)

- Dźwięki syntezowane w przeglądarce: budowa (deski i młotek), układanie drogi, burzenie (kilof), zawalenie budynku (łoskot i sypiący się gruz), kliknięcia przycisków, sygnał błędu
- Głośność i wyciszanie w zakładce Sterowanie, klawisz M wycisza
- Obrót kamery także lewym przyciskiem myszy z wciśniętym Ctrl
- Góry poprawione: gładkie zbocza, ciemniejsza skała, śnieg tylko na wierzchołkach, szczyty stoją wyłącznie za krawędzią mapy

## 0.5.5 — naturalniejszy bruk (2026-10-11)

- Droga kamienna bez równych krawędzi i krawężnika: kamienie nierówno wchodzą w trawę, pola są lekko przesunięte
- Każde pole bruku ma trochę inny odcień, co piąte jest omszałe
- Poprawka gór: szerokie masywy zamiast cienkich igieł, pierwszy rząd zachodzi na krawędź mapy (znika szczelina), niższa ściana gór na samej mapie

## 0.5.4 — góry, krok, bruk (2026-10-11)

- Góry dookoła mapy: rzeźbione szczyty z graniami, żlebami, warstwami skały i czapami śniegu o nierównej linii; dalsze pasma wyższe
- Góry na krańcach mapy wyższe, z warstwami skały i śniegiem na wierzchołkach
- Nogi chłopów chodzą w tempie marszu (krok zależy od przebytej drogi, także przy przyspieszonej grze)
- Bruk w 2048 px z ziarnem, plamami i rysami na każdym kamieniu
- Ramka pola pod kursorem widoczna tylko przy malowaniu dróg i wyburzaniu

## 0.5.3 — wiata (2026-10-11)

- Obozowisko przebudowane: ciesielska altana z zastrzałami i dwuspadową strzechą, pleciona ściana od wiatru, ławy, beczka, stos drewna, trójnóg z kociołkiem nad ogniem

## 0.5.2 — bogatszy teren (2026-10-11)

- Las w różnym wieku: młode drzewka, zwykłe drzewa i z rzadka stare olbrzymy; w lesie i na łąkach krzewy
- Łąki: gęstsze kępy trawy, polne kwiaty w pięciu kolorach, kamyki i pojedyncze głazy
- Droga kamienna ma lekki, jaśniejszy krawężnik wszędzie tam, gdzie graniczy z trawą
- Trawa, krzewy i kamyki znikają pod budynkami i drogami

## 0.5.1 — mieszkańcy (2026-10-11)

- Chłopi różnią się wyglądem: buty, pas, dłonie, kolor włosów i skóry, odcień tuniki, broda, fartuch, wzrost oraz nakrycie głowy (słomkowy kapelusz, kaptur, czapka, chustka albo goła głowa)
- Kliknięcie w chłopa pokazuje jego kartę: imię z przydomkiem, wiek, cech i to, co właśnie robi

## 0.5.0 — wyburzanie i gruz (2026-10-11)

- Tryb „Wyburzanie”: kliknięcie usuwa budynek, przeciągnięcie usuwa drogę
- Rozebrany budynek zapada się, a na działce zostaje gruz; dopóki leży, nie da się tam budować
- Gruz wynoszą do składu chłopi bez pracy, po dwóch naraz; połowa kosztu budynku wraca ładunek po ładunku
- Cech inżynierów (Osada): gdy brakuje bezrobotnych, gruz wynosi inżynier

## 0.4.7 — obracanie budynków (2026-10-11)

- Podczas budowy klawisz R albo przycisk „Obróć” obraca budynek co 90°; wejście przenosi się razem z frontem

## 0.4.6 — kopalnia i spichlerz (2026-10-11)

- Kopalnia żelaza: skalny garb z żyłami rudy, sztolnia w drewnianej obudowie, tory z wózkiem pełnym rudy, kołowrót, hałda urobku, latarnia
- Spichlerz: na kamiennych grzybkach, ściany szachulcowe z zastrzałami, dach jak na stodole, luk z żurawikiem, drabinka i worki

## 0.4.5 — dachy, kostka, bez cokołów (2026-10-11)

- Droga kamienna jako rzymska kostka: drobne, obłe kamienie w falujących rzędach
- Dachy chat, tartaku, piekarni i chaty rybaka zrobione jak na stodole: ciemny okap, gruba warstwa, kalenica
- Pod budynkami nie ma już żadnego podniesienia: budynek jest lekko wtopiony w teren

## 0.4.4 — łagodniejsze światło (2026-10-11)

- Dzień: słabsze, mniej żółte słońce i więcej rozproszonego światła nieba, więc cienie są miększe i nic się nie przepala
- Noc: pochodnie świecą ponad dwa razy słabiej i na krótszy dystans, cieplejszym, mniej pomarańczowym kolorem; trochę jaśniejsze tło nocy

## 0.4.3 — podłoże budynków (2026-10-11)

- Koniec kwadratowego podniesienia pod budynkami: fundament chowa się w ziemi i widać go tylko na zboczu
- Wokół budynku delikatna, półprzezroczysta plama wydeptanej trawy; drogi zawsze leżą nad nią

## 0.4.2 — życie na murach (2026-10-11)

- Twierdza żyje cały czas: trzech strażników obchodzi mury, wartownik z włócznią stoi w bramie, czatownik rozgląda się ze szczytu, przy wejściu płoną kosze z ogniem
- We wnętrzu więcej ludzi: czwarty biesiadnik, druga służąca, skryba przy pulpicie
- Bruk 1024 px z łamanego kamienia: plamy, żyłki, fazowane krawędzie, wąska fuga
- Usunięta wydeptana plama pod budynkami (psuła drogi)
- Tempo, podatki i racje w jednym rzędzie z resztą tabliczek

## 0.4.1 — życie w twierdzy, lekki pasek (2026-10-11)

- Twierdza po kliknięciu pokazuje komnaty: salę lorda z tronem i kominkiem, jadalnię z długim stołem, komnatę z łożem; w środku lord na tronie, biesiadnicy przy stole, krążący służący i strażnik
- Górny pasek jak w strategiach: rząd osobnych drewnianych tabliczek (zegar, surowce jako ikona z liczbą, stan osady, sterowanie), bez wielkiego panelu
- Blanki twierdzy z tego samego kamienia co mur, na basztach ustawione po okręgu; słabszy blask okien
- Droga kamienna z płyt o krzywych, dopasowanych bokach i wąskiej fudze zamiast okrągłych kamyków
- Droga piaskowa wygląda jak wydeptana ścieżka o miękkich, nierównych brzegach; kamienna zostaje równym brukiem
- Przy stodole okrągłe bele siana z powrósłami i kopka z widłami

## 0.4.0 — drogi (2026-10-11)

- Nowa kategoria Drogi: piaskowa (za darmo, +25% do chodzenia) i kamienna (1 kamień za pole, +55%)
- Drogę wytycza się przeciągając myszą po mapie; na telefonie dotykając kolejnych pól
- Ludzie chętniej wybierają trasę po drodze; budynek postawiony na drodze ją zastępuje
- Znacznik wersji z godziną zbudowania w prawym dolnym rogu

## 0.3.19 — latarnicy, zegar i dach stodoły (2026-10-11)

- Pochodnie zapalają ludzie: o zmierzchu chłopi bez pracy obchodzą budynki i pochodnie na słupach, a gdy ich brakuje, robią to wracający pracownicy; o świcie pochodnie gasną
- Zegar: tarcza obraca się we właściwą stronę, godzina co kwadrans, a liczby na pasku mają stałą szerokość i nie przesuwają sąsiadów
- Stodoła: gruba strzecha z ciemnym okapem, kalenica z żerdzi, wiatrownice i daszek nad wrotami
- Jaśniejszy mur twierdzy
- Ognisko z kręgiem polnych kamieni, popiołem, polanami w stożek i kilkoma językami ognia
- Stawiana pochodnia to sam słup, bez wydeptanego placu

## 0.3.18 — kamień w prawdziwej skali (2026-10-11)

- Tekstury układają się według prawdziwych wymiarów ścian: ciosy muru, deski i gonty mają tę samą wielkość na małej i dużej powierzchni, nic się nie rozciąga
- Mur twierdzy: większe, wyraźniejsze ciosy, mocniejsza wypukłość, cokół i gzyms na donżonie, gładsze baszty

## 0.3.17 — światło i pochodnie (2026-10-11)

- Pochodnie przy budynkach: słup stoi cały czas, płomień zapala się o zmierzchu i gaśnie o świcie
- Nowy obiekt „Pochodnia” (Osada, 2 drewna): stawiasz ją, gdzie chcesz
- Ręczna pochodnia chłopa świeci dużo słabiej; południe mniej prześwietlone
- Poprawki tartaku: siekiera wbita w pieniek, gałęzie i igliwie przy pniu zamiast sterczących stożków

## 0.3.16 — mur twierdzy (2026-10-11)

- Mur twierdzy z osobną teksturą 1024 px: ciosy różnej długości, głęboka fuga, wypukłość każdego kamienia, wyszczerbienia, rysy i zacieki

## 0.3.15 — złoża w górach (2026-10-11)

- Kamień i żelazo leżą teraz u podnóża gór w niedużych złożach, żelazo rzadziej i bliżej skał; przy twierdzy zostaje mała odkrywka na start
- Złoża się wyczerpują: po pięciu wydobyciach pole jest puste i skała znika

## 0.3.14 — tartak (2026-10-11)

- Chata drwala przebudowana na tartak: chata naprzeciw wejścia, obok wiata z kozłem i piłą, stos desek, trociny, pieniek z siekierą
- Pochodnie przy budynkach stoją i płoną także w dzień
- Woda: gładka tafla z miękkim falowaniem zamiast rysowanych kresek
- Przyciągnięte drzewo ma gałęzie i resztki igliwia i leży z boku, więc drwal nie chodzi po deskach

## 0.3.13 — woda, ryby i rybak (2026-10-11)

- Woda z falami, połyskiem słońca i jaśniejszą płycizną
- W wodzie pływają ryby, co jakiś czas któraś wyskakuje
- Chata rybaka (kategoria Żywność, blisko wody): rybak staje na brzegu z wędką i odnosi ryby do spichlerza
- Ryby jako nowa żywność w racjach

## 0.3.12 — noc z pochodniami (2026-10-11)

- Noc jest naprawdę ciemna: słabe, chłodne światło księżyca
- Przy każdym budynku stoi pochodnia, okna świecą, a idący ludzie niosą pochodnie
- Pochodnie rzucają migoczące, ciepłe światło na ziemię, ściany i ludzi (12 świateł na komputerze, 5 na telefonie, przydzielane najbliższym środka ekranu)

## 0.3.11 — twierdza i lżejszy interfejs (2026-10-11)

- Twierdza w ciepłym piaskowcu, z drewnianą hurdycją, gontowymi hełmami, oknami i daszkiem nad bramą, żeby pasowała do reszty osady
- Interfejs mniej klockowaty: niższy górny pasek, mniejsze przyciski, a karty budynków z dużym obrazkiem
- Jaśniejsza noc
- Pod budynkami wydeptana trawa o nierównych brzegach zamiast prostokąta gołej ziemi
- Drwal ciągnie całe drzewo z gałęziami i koroną; pień leży potem przed chatą i skraca się z każdą partią desek

## 0.3.10 — dzień i noc (2026-10-11)

- Doba gry trwa 4 minuty przy tempie 1×: świt, dzień, zachód słońca i noc z chłodnym światłem księżyca
- Słońce wędruje po niebie, więc cienie obracają się i wydłużają
- Zegar na górnym pasku: obracająca się tarcza z jasną połową ze słońcem i ciemną z księżycem, obok dzień gry i godzina

## 0.3.9 — materiały i tartak (2026-10-11)

- Materiały fizyczne zamiast płaskich: tekstury 512 px z ziarnem, wypukłość fug, desek i strzechy, filmowe odwzorowanie tonów, chłodniejsze niebo i cieplejsze słońce
- Drwal rąbie dłużej, drzewo przewraca się wolniej, potem ciągnie cały pień do chaty
- Jeden pień daje cztery partie desek: drwal tnie, odnosi, wraca i tnie dalej, a po następne drzewo idzie dopiero po ostatniej partii

## 0.3.8 — ładunki (2026-10-11)

- Chłopi niosą przed sobą to, co faktycznie niosą: kosz jabłek, kosz z bochenkami, snop zboża, worek mąki, blok kamienia, sztaby żelaza

## 0.3.7 — wycinka lasu i sala tronowa (2026-10-11)

- Drwal rąbie drzewo, które przewraca się i znika; zostaje pniak i polana, na której można budować
- Z drzewa drwal niesie dwie kłody do chaty i tam tnie je na deski
- Twierdza po kliknięciu odsłania salę tronową
- Poprawka: gra zawieszała się po kliknięciu w stodołę

## 0.3.6 — zaglądanie do budynków (2026-10-11)

- Kliknięcie w budynek odsłania jego wnętrze
- Teren bez szachownicy: kolory i światło przechodzą płynnie między polami, a wzór trawy nie powtarza się co pole
- Poprawka: podłoże pod młynem i innymi budynkami przestało migotać
- Stodoła i spichlerz mają wnętrza, w których widać zapasy: surowce na stosach, kosze jabłek, bochenki; przybywa ich w miarę zapełniania

## 0.3.5 — średniowieczny interfejs (2026-10-11)

- Panele jak pergamin w okutej drewnianej ramie ze złotą żyłką i ćwiekami
- Kroje pisma: Cinzel w nagłówkach i przyciskach, Alegreya w tekście i liczbach (oba z polskimi znakami)
- Ikony surowców zamiast kolorowych kwadratów, pasek popularności ze znacznikiem progu 50
- Przyciski jak deski i lak, z wyraźnym najechaniem, wciśnięciem i fokusem klawiatury

## 0.3.4 — nowa twierdza i stodoła (2026-10-11)

- Twierdza: mur z blankami, wysoki donżon ze strzelnicami, baszty z hełmami, przedbramie z kratą, sztandar i chorągwie
- Stodoła obok twierdzy trzyma zapasy startowe (250 surowców, 120 żywności); można ją rozebrać i postawić gdzie indziej albo dobudować kolejne
- Twierdza sama nie przechowuje już surowców
- Obozowisko ma 6 miejsc dla bezrobotnych: gdy są zajęte, nowi ludzie nie przychodzą. Można je rozebrać, przenieść i dobudować kolejne
- Kamień jako ciosane bloki z fugą i cieniem, dachy z zaokrąglonych gontów

## 0.3.3 — obozowisko (2026-10-11)

- Okna z szybą i ramą zamiast czerwonych kwadratów; barwę drużyny pokazuje chorągiewka
- Przy twierdzy stoi wiata z ławami i ogniskiem; chłopi bez pracy siadają wokół ognia zamiast stać pod bramą

## 0.3.2 — trawa, drzewa i sady (2026-10-11)

- Trawa: bogatsza tekstura z plamami darni i źdźbłami oraz kępki trawy na łąkach
- Las mieszany: piętrowe świerki z korą i igłami oraz drzewa liściaste, każde w nieco innym odcieniu
- Sad: jabłonie z rozłożystą koroną i jabłkami na gałęziach, płotek, kosz z jabłkami

## 0.3.1 — postacie i tekstury (2026-10-11)

- Chłopi to teraz postacie: nogi, tunika w barwach drużyny, ręce, głowa, słomkowy kapelusz
- Chodzą, wymachując rękami i nogami, obracają się w stronę marszu, unoszą ręce z ładunkiem
- Tekstury rysowane kodem: cegły na kamieniu, deski, strzecha, tynk, dachówki, trawa

## 0.3.0 — cienie i światło (2026-10-11)

- Budynki, drzewa, skały, góry i ludzie rzucają miękkie cienie
- Cieplejsze słońce i mocniejszy kontrast światła
- Na telefonach cienie w niższej rozdzielczości, żeby gra chodziła płynnie
- Poprawka: fundamenty budynków robiły się czerwone po czerwonym podglądzie budowy

## 0.2.11 — osada nie wymiera (2026-10-11)

- Przy twierdzy zawsze zostaje czterech chłopów, a pusta osada sama się odradza
- Ostrzeżenie, gdy kończy się żywność i gdy ludzie zaczynają odchodzić
- Nie da się postawić budynku, który odciąłby ludziom drogę do twierdzy albo do innego budynku
- Balans żywności: pełne racje to 4 jednostki na 8 chłopów, sad daje 10 jabłek, piekarnia 16 chlebów, na start 100 jabłek
- Gdy żywności jest za mało na wybrane racje, ludzie jedzą mniejsze racje zamiast głodować całkiem, więc osada nie wpada w pętlę przychodzenia i odchodzenia

## 0.2.10 — stosy w składzie (2026-10-11)

- Każdy surowiec leży w składzie na własnym stosie i wygląda inaczej: deski, bloki kamienia, sztaby żelaza, snopy zboża, worki mąki

## 0.2.9 — chaty i dłuższa praca (2026-10-11)

- Co trzy dostawy chłop idzie do najbliższej chaty odpocząć; chata odsłania wtedy izbę ze stołem i łóżkiem
- Cięcie desek, mielenie i pieczenie trwają dłużej, żeby było je widać
- Tempo gry pod klawiszami + i −

## 0.2.8 — wnętrze młyna (2026-10-11)

- Gdy młynarz miele, młyn odsłania wnętrze: kamienie młyńskie i worki z mąką, skrzydła kręcą się dalej

## 0.2.7 — zapis gry (2026-10-11)

- Gra zapisuje się sama w przeglądarce co 5 sekund i przy zamykaniu karty; po odświeżeniu wraca stan sprzed odświeżenia
- „Nowa gra” w zakładce Mapa zaczyna od zera
- Zapis z niezgodnej wersji gry jest pomijany

## 0.2.6 — sterowanie na górnym pasku (2026-10-11)

- Przyciski minus i plus na górze: tempo gry (pauza, 1×, 2×, 3×, 5×), podatki i racje żywności

## 0.2.5 — widać, kto pracuje (2026-10-11)

- Drwal niesie kłodę z lasu do chaty, tam tnie ją na deski i dopiero deski odnosi do składu
- Rolnik i sadownik chodzą po polu i schylają się przy pracy
- Gdy piekarz albo drwal pracuje w środku, budynek odsłania wnętrze: piec z żarem, stół z bochenkami, kozioł z kłodą
- Pasek budowy zajmuje jeden niski rząd

## 0.2.4 — życie w osadzie (2026-10-11)

- Skrzydła młyna kręcą się, a z komina piekarni leci dym, gdy ktoś tam pracuje
- Drwal niesie kłodę na ramieniu zamiast klocka
- Skład zapełnia się przed twierdzą, więc każda dostawa jest od razu widoczna

## 0.2.3 — dolne menu budowy (2026-10-11)

- Pasek budowy na dole ekranu z kategoriami: Osada, Żywność, Przemysł
- Karty budynków z obrazkiem renderowanym z tego samego modelu, który staje na mapie
- Dwór, Mapa i Sterowanie jako wysuwane panele nad paskiem

## 0.2.2 — pojemność składów (2026-10-11)

- Składy i spichlerze mają limit: twierdza 250 surowców i 120 żywności, skład +200, spichlerz +150
- Gdy brakuje miejsca, chłopi czekają z towarem przy składzie, więc trzeba dobudowywać
- W składzie widać skrzynie, których przybywa w miarę zapełniania, w kolorach surowców
- Pasek u góry pokazuje zapełnienie składu i spichlerza

## 0.2.1 — poprawki po etapie 2 (2026-10-11)

- Podgląd budowli przy wybieraniu miejsca (półprzezroczysty model nad działką, czerwony gdy nie da się budować)
- Popularność pokazywana ze skalą, np. 75 / 100
- Balans żywności: pełne racje to 6 jednostek na 8 chłopów miesięcznie, sad daje 8 jabłek
- Plik `docs/pomysly.md` na nowe pomysły i braki do zrobienia później

## 0.2.0 — etap 2: gospodarka (2026-10-11)

- Budowanie na siatce: 10 budynków do postawienia (chata, skład, spichlerz, drwal, kamieniołom, kopalnia, sad, farma, młyn, piekarnia), rozbiórka ze zwrotem połowy kosztu
- Chłopi z wyszukiwaniem drogi: sami biorą pracę, chodzą do lasu i złóż, noszą surowce do składu
- Łańcuch zboże → mąka → chleb, jabłka jako prosta żywność
- Ludność, racje żywności, podatki i popularność rozliczane co miesiąc gry
- Większe mapy z pasmem gór na krańcach, mgłą i blokadą kamery
- Mapa w adresie strony (`#tryb/ziarno`), tempo gry: pauza, 1×, 3×

## 0.1.0 — etap 1: fundament (2026-10-11)

- Projekt Vite + TypeScript (strict) + Three.js, podział na warstwy `sim` / `data` / `render` / `ui`
- Deterministyczny generator map z ziarna, symetryczny dla drużyn, tryby 1v1, 2v2 i 4v4
- Scena 3D low‑poly: teren, woda, lasy, kamień, żelazo, twierdze startowe
- Kamera strategiczna: klawiatura, mysz i dotyk
- Testy symulacji (w tym determinizm po 10 000 ticków)
- Automatyczne testy, build i wdrożenie na GitHub Pages

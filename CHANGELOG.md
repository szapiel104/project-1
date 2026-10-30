# Dziennik zmian

## 0.68.8 — 30.10.2026
- Karty budowy szersze (132 → 176 px), tabliczki kosztu z luzem: ikonka 26 px na ciemnym kwadracie, liczba 24 px, odstęp 6 px (Michał: „ciasno, nie mają oddechu, ikonka za mała”).

## 0.68.7 — 30.10.2026
- **Ruda głównym celem kopalni** (Michał): wagi kursów kamień 45 × 8, żelazo 25 × 5, ruda 27 × 6, kryształ 3 × 1. Średnio z kursu: kamień 3,6 (dawniej 5,6), żelazo 1,25 (2,3), ruda 1,6 (0,5). Bot korzysta z tej samej kopalni. Test w `oremine.test.ts`: waga rudy co najmniej 20.

## 0.68.6 — 30.10.2026
- **Zakładka „Co nowego” w menu** (Michał): dziennik zmian dla graczy, dzień po dniu, wersja po wersji, punkty po polsku i po angielsku (`src/data/changelog.ts`, okno `src/ui/changesBook.ts`). Wpisano wszystko od 0.54.4 (28.10). Od teraz każda wersja dopisuje tam wpis (zasada w CLAUDE.md, pilnuje `tests/changelog.test.ts`).
- Niesiony kamień i żelazo to te same modele co na stosach w składzie (blok granitu ze skanu, kute sztaby), a nie szary dwudziestościan i sztaby z kodu.
- Zapasy startowe: limit 90% pojemności (zamiast 3/4) i tylko przy gotowym magazynie; test kapliczki dostał chleb dla 16 dodanych chłopów.

## 0.68.5 — 30.10.2026
- **Spichlerz „pełny” od startu** (Michał): na łatwym gra dawała 800 jedzenia (600 chleba + 200 jabłek) przy spichlerzu na 400, na średnim równo 400. Spichlerz był pełny od pierwszej minuty, a nowy zapełniała od razu ta nadwyżka, więc robotnicy stali. Zapasy startowe mieszczą się teraz w magazynach z zapasem miejsca (najwyżej 90% pojemności, także u botów). Test w `tests/storage-second.test.ts`.
- Kopalnia daje mniej z jednego kursu: kamień 10 → 7, żelazo 7 → 5, ruda 6 → 4 (kryształ bez zmian). Test barak/wóz w `oremine.test.ts` liczy teraz to, co dowieziono, bo w tym czasie kamień schodzi też na naprawy.
- Koksownik: przy stawianiu na wieży dach wieży znika na czas podglądu, żeby było widać kosz na pomoście.

## 0.68.4 — 30.10.2026
- **Po materiał na budowę i drogę robotnicy idą do składu, w którym ten surowiec leży**, a nie do bliższego, pustego (Michał). Gdy zapłata z góry wyczyściła wszystkie składy, idą do tego, z którego zapłata zdjęła towar (`Building.gave`, zapis gry). Test: `tests/fetch-store.test.ts`.
- Plan muru i palisady: okienko pod kursorem podaje powód czerwonych pól (np. „Ten odcinek zamknąłby ludzi lub budynki — zostaw przerwę albo postaw tu bramę”, głaz, wróg), a nie samo „poza zasięgiem / zajęte”.
- Drewniana wieża wbudowana w mur kamienny: znika jej własna drabina do ziemi (wbijała się krzywo w mur) i druga drabina z boku; wchodzi się z korony muru. Drabina w modelach `watchtower`/`lookout` w osobnej grupie `ladder`.
- Spichlerz i skład: każdy towar dostaje na stosach choć jedno miejsce. Mięso (ostatnie na liście) nie mieściło się, gdy chleb i jabłka zajęły wszystkie miejsca, więc było go nie widać.
- Koksownik: podgląd przy stawianiu to prawdziwy kosz na pomoście wieży albo na chodniku muru, zielony lub czerwony, zamiast wielkiego kwadratu ze strzałką na ziemi.
- Karty budowy: surowce obok siebie w rzędzie, liczby 24 px; pod spód schodzi dopiero trzecia tabliczka albo długa liczba.

## 0.68.3 — 30.10.2026
- Drewniana wieża postawiona obok muru (na jego końcu) nie stoi już na kamiennym bloku muru. Blok albo bale pod wieżą tylko wtedy, gdy mur przechodzi przez wieżę (dochodzi z dwóch przeciwnych stron).

## 0.68.2 — 30.10.2026
- **Pracownik płonącego budynku rzuca robotę i gasi** (Michał). Jest pierwszy w ekipie z wiadrami; po zgaszeniu wraca do pracy.
- **Bez studni wodę noszą z jeziora albo rzeki.** Ekipa biegnie na najbliższy brzeg (do 40 pól od pożaru, jak studnia), nabiera wiadro i wraca. Studnia, gdy jest, ma pierwszeństwo. Działa tak samo u bota. Testy: `tests/fire-crew.test.ts`.
- Mur w budowie bez brązowych kul: każde pole muru dostawało hałdę ziemi z wykopu wielkości prawie całego pola. Mury, bramy i budowle 1×1 hałdy nie mają.
- Karty budowy: każdy surowiec kosztu na własnej tabliczce (ciemne pole, cienka złota ramka, liczba 20 px, większa ikonka); czerwona, gdy nie stać.

## 0.68.1 — 30.10.2026
- Nocą w grupie pochodnię niesie jeden chłop: kto ma towarzysza z pochodnią do ok. 1,6 pola, idzie przy jego świetle (Michał: czterech idących obok siebie nie potrzebuje czterech pochodni). Mniej płomieni do rysowania. Buntownicy z pochodniami bez zmian.

## 0.68.0 — 30.10.2026
- **Głazy są fizyczne** (Michał). Duże głazy na łąkach zna teraz symulacja (`src/sim/systems/boulders.ts`, położenie z ziarna mapy — te same u każdego gracza): nie da się na nich postawić budynku ani położyć drogi („Tu leży głaz — najpierw każ go rozbić”), a w spacerze mają kolizję. Kliknięcie głazu otwiera okienko z przyciskiem **Rozbij — 10 rudy** (potrzebny gotowy cech inżynierów): głaz znika, na polu zostaje stos kamienia (8 szt.), który wynoszą magazynierzy, wolni chłopi albo inżynierowie z cechu; potem pole jest wolne. Rozbite głazy w zapisie gry (`rocksGone`). Dawne losowe duże i średnie kamienie z łąki zniknęły (zamiast nich te z symulacji); drobne kamyki w trawie zostają jako ozdoba. Bot głazów nie rozbija — omija je przy stawianiu.
- **Chłopi najpierw zajmują wolne chaty**, dopiero potem śpią w zamku. Chory jak dawniej idzie pod najbliższy dach (sam w pustej chacie byłby w kwarantannie i zaraza gasła — test zarazy to wychwycił).
- Karty budowy: koszt w surowcach dużo większy i jaśniejszy (19 px, pogrubiony, większe ikonki).
- Chlew: po kliknięciu znika dach (strzecha była w grupie `base`, teraz `roof`).
- Świnia: ogonek przy zadzie (wisiał 4 cm za tułowiem — tułów po wygładzeniu jest krótszy, niż liczył skrypt).
- Test: nowy spichlerz przejmuje stosy spod pełnego (w zwykłej grze działa; w trybie deweloperskim magazyny mają stałą pojemność milion, więc drugi spichlerz niczego nie zmienia).

## 0.67.17 — 30.10.2026
- **Strażnik miejski trzyma pochodnię w dłoni** (Michał). Nocą niesie ten sam model pochodni co chłopi, w uniesionej lewej ręce (prawa trzyma miecz), z płomieniem nad głowicą. Wcześniej stara pochodnia wisiała obok niego w powietrzu. Pozostałe wojsko nie nosi pochodni (ręce zajęte bronią i tarczą — stara też wisiała obok).
- **Spacer: pochodnia nie wchodzi w ziemię.** Przy patrzeniu w dół podnosi się i przechyla z powrotem do pionu, jak trzymana przy piersi, zamiast obracać się razem z widokiem.

## 0.67.16 — 30.10.2026
Mur kamienny (Michał):
- **Łącznik muru z wieżą nie jest rozmazany.** Był to jeden blok 1×1 rozciągany do długości szczeliny — kamień rozciągał się razem z nim. Teraz łącznik ma prawdziwą długość (co 5 cm), z kafelkami tekstury w tej samej skali co reszta muru, a jego wierzch leży o włos niżej od korony (bez migotania).
- **Pochylnie zamiast schodków.** Każde pole muru stało na wysokości terenu pod sobą, więc na spadku sąsiednie pola różniły się o kilka centymetrów i robiły się progi. Teraz pole pochyla się wzdłuż biegu muru: krawędź między dwoma polami leży w połowie ich wysokości, korona i chodnik schodzą płynnie, ściany i blanki zostają pionowe.
- **Jedna drabina w narożniku.** Drabina postawiona w rogu dotykała dwóch pól muru i każde rysowało swoją — teraz tylko jedno (wejście działa z obu).

## 0.67.15 — 30.10.2026
- Mag Płomienia trzyma w dłoni ogień zamiast świecącej kuli: płomień (pomarańczowy z jasnym środkiem), który migocze — każdy mag w swoim rytmie. Widać go przy rzucaniu czarów, leczeniu i paleniu ciał. Mag Źródła zostaje z kulą wody.

## 0.67.14 — 30.10.2026
- **Liczby obrażeń i leczenia pojawiają się na miejscu, nad głową**, i idą tylko w górę. Przyczyna „nadlatywania z boku”: animacja wyskoku powiększa liczbę (`scale`), a położenie było w `transform: translate`, więc przeglądarka powiększała też przesunięcie po ekranie — liczba startowała o 25% dalej od rogu ekranu i dopiero potem wracała. Teraz położenie przez właściwość `translate` (zmierzone: „+2” pojawia się nad paskiem leczonego i idzie prosto w górę).
- **Kulki leczenia:** wokół leczonego przez maga krążą dwie małe świetliste kulki na różnych wysokościach (mag wody — jasnozielono-błękitne, mag ognia — złociste).
- Bez rogu wojennego przy „wróg nadciąga” (nagranie brzmiało jak podmuch wiatru, także przy stawianiu wroga w panelu dewelopera); pasek ostrzeżenia i skryba zostają.

## 0.67.13 — 30.10.2026
- **Rozdzielczość 1,5× zdjęta z ustawień** (Michał). Na monitorze 3440 px „Ostra” liczyła obraz ok. 5160 px szerokości — ponad dwa razy więcej pikseli niż 1× — i to karta graficzna była wąskim gardłem (ok. 26 ms na klatkę przy 189 budynkach). Teraz najwyżej „Ostrzejsza” (1,25×); domyślnie „Normalna”. Zapisane „Ostra” zamienia się na „Ostrzejszą”. Automat jakości też nie wchodzi wyżej niż 1,25×.

## 0.67.12 — 30.10.2026
- **Jednego leczy najwyżej jeden mag** (Michał: pięciu magów leczyło szóstego naraz, za szybko). Mag, który leczy siebie, nie dostaje pomocy od innych; pozostali biorą kolejnych rannych.
- Plusy leczenia pojawiają się prosto nad głową leczonego i idą tylko w górę (wcześniej przesunięte w bok, jakby nadlatywały).
- **Zabity czarem wody leży zamrożony** (lodowo-biały), nie spalony; zwłoki mają znacznik `frozen`.
- Palenie ciał: bez lecących kul i kręgów — mag stoi z ogniem w uniesionych dłoniach, a ciało samo zajmuje się płomieniem.
- Wczytywanie: budynki osady, mury i place budowy powstają już w rozgrzewce (klatka bez rysowania), więc ich shadery kompilują się w tle. Wcześniej na mapie z 189 budynkami pierwsza klatka gry tworzyła je 1,3 s, a karta kompilowała ich shadery na żywo jeszcze ok. 1,2 s.

## 0.67.11 — 30.10.2026
- **Magowie leczą bez walki** (Michał). Mag Płomienia albo Źródła, który od 6 s nie rzucał czaru i nie widzi wroga, powoli leczy sojuszników do 4 pól obok — po jednym: najbardziej rannego (siebie też), po 2 zdrowia na sekundę, aż wyleczy, potem następnego. Mag stoi zwrócony do leczonego z rękami w górze, nad leczonym idą zielone „+2”. Przy wrogu w pobliżu nie leczy. Działa tak samo u bota. Moduł `src/sim/systems/mageheal.ts`.
- **Palenie ciał lepiej wygląda.** Mag stoi zwrócony do ciała z rękami w górze i co chwilę ciska w nie ogniem, aż się spali; ciało płonie całe (ogień w trzech miejscach), czernieje i pod koniec zapada się w popiół, zamiast się zmniejszać. Palenie trwa 6 s.
- Pomiar przycięć w grze: klatki dłuższe niż 200 ms zapisują się z rozbiciem na etapy w `window.__slowFrames`.

## 0.67.10 — 30.10.2026
- **Stawianie budynku bez przycięcia** (Michał: „czasem przycina na sekundę albo dwie”). Sklejanie nieruchomych części budynku (`mergeStatic`) kopiowało i przeliczało geometrię wszystkich części przy każdym postawionym budynku, a dopiero potem brało gotową wspólną bryłę z pamięci (sad: ok. 0,6 s za każdym razem). Teraz klucz liczy się z samych liczb części i wierzchołków; geometria liczy się tylko raz na rodzaj budynku.

## 0.67.9 — 30.10.2026
- Miniatury budynków (rysowane w tle po nowej wersji gry): shadery każdego budynku kompiluje karta w tle przed rysowaniem miniatury — wcześniej kompilowały się naraz i gra przycinała przy każdym nowym rodzaju.
- Pomiar przycięć przy stawianiu: czas każdego kroku przygotowania budynków w tle w `window.__prewarmSteps`.
- Podgląd stawiania nie wywraca się na nieznanej nazwie budynku (błąd „reading 'road'” w dzienniku przy pomiarach).

## 0.67.8 — 30.10.2026
- **Mag Płomienia pali ciała** (Michał). W pasku czarów maga ognia nowy przełącznik „Palenie ciał”: włączony — mag bez wroga w pobliżu sam idzie do najbliższego ciała (do 12 pól, swojego i wrogiego, ludzi i wilków), z 4 pól rzuca ogień, ciało płonie, kurczy się i po 4 s znika. Wróg ma pierwszeństwo; ciał, po które idą grabarze albo leżących na wieży, nie rusza; kilku magów nie idzie do jednego ciała. Wyłączony — nie pali. Rozkaz `cremate` przez symulację (gra sieciowa), moduł `src/sim/systems/cremation.ts`. Bot ma palenie włączone u swoich magów ognia.
- Ustawienia → Grafika: „Trawa” przemianowana na „Szczegóły w oddali” (Niskie / Średnie / Wysokie / Ultra). Trawa jest wyłączona od 0.64.7, a to ustawienie decyduje tylko, z jak daleka budynki, krzaki i drzewa są w pełnej wersji.

## 0.67.7 — 30.10.2026
- **Trafiony strzałą albo czarem rusza na strzelca.** Łucznik strzela z 8 pól, a włócznik widzi na 6, więc ostrzeliwany wróg stał i ginął (Michał). Teraz trafiony, który z nikim nie walczy, biegnie na strzelca razem z bezczynnymi towarzyszami do 3 pól obok. Nie ruszają się: postawa „stój”, ranni w odwrocie, maszerujący na rozkaz, taran, saper, drabiniarz. Działa tak samo u bota. Test: `tests/provoked.test.ts`.
- **Spalone ciała.** Kto zginie od kuli ognia, odprysku, deszczu ognia, ognistej strzały albo dopalając się, leży zwęglony (cała postać prawie czarna). Zwłoki mają znacznik `burnt`.
- Polegli magowie: każdy leży osobno (wcześniej wszystkie ciała magów rysowały się w jednym miejscu puli — widać było tylko jedno).
- Panel wojska: przy jednym rodzaju jednostek nagłówek to jego nazwa z liczbą, np. „Mag Płomienia (1)”; „Zaznaczeni żołnierze: N” tylko przy kilku rodzajach.

## 0.67.6 — 30.10.2026
- **Miniatury budynków w tle.** Po każdej nowej wersji gry pierwsze wejście rysowało od zera obrazki wszystkich budynków do menu budowy — naraz, w środku wczytywania (ok. 2,5 s zamrożonej strony), a po dojściu tekstur zdjęciowych drugi raz, już w grze. Teraz gra startuje bez nich, a obrazki rysują się raz, po starcie, po jednym na wolną chwilę przeglądarki, od razu z teksturami zdjęciowymi; gotowy wskakuje do kart budowy, kategorii i pól magazynów (`hud.setThumb`). Potem jak dawniej z pamięci przeglądarki.
- Głazy: z powrotem płaskie cieniowanie — gładkie dawało czarne trójkąty na zawiniętych ścianach bryły. Dokładniejsza bryła z bliska zostaje.

## 0.67.5 — 30.10.2026
Szybsze wczytywanie, przeglądarka nie zamarza (Michał: „gra przy wczytywaniu zawiesza przeglądarkę, nawet z jednym obiektem”). Pomiar w Chrome na RTX 5070, pusta scena: 16,7 s wczytywania, w tym 9,8 s zamrożonej strony.
- **Bez rysowania w trakcie wczytywania.** Pętla gry rysowała klatki, zanim skończyła się rozgrzewka — każda kompilowała shadery „na żywo” i strona stała 5–7 s. Teraz pierwszy obraz dopiero po `warmup()` (jak przy nowej grze z menu).
- **Budynki przygotowują się w tle, już w grze.** Wcześniej przed startem gra składała po egzemplarzu każdego budynku (ok. 3,5 s nawet na pustej mapie). Teraz po jednym na wolną chwilę po starcie, poza sceną; budynek postawiony wcześniej i tak czeka w ukryciu na swoje shadery (`precompile.ts`). Czas całości: `window.__prewarmMs`.
- **Shadery cieni i efektów obrazu przed pierwszą klatką, w tle.** Najpierw klatka bez obiektów (powstaje mapa cieni), potem shadery cienia całej sceny zleca się karcie i czeka na nie z przerwami na klatkę.
- Pomiar: `?test=1&pusta=1&hd=1&etapy=1` buduje świat etapami jak zwykła gra; czasy w `window.__loadTimes`, `__worldTimes`, `__warmTimes`.

## 0.67.4 — 30.10.2026
- Głazy na łąkach nie wiszą już nad ziemią: model podnosił bryłę o 0,7 promienia, spód był ok. 8 cm nad trawą. Teraz stoją na ziemi, wkopane 3 cm (`tools/models/plants.py`).
- Głazy mniej kanciaste: gładkie cieniowanie (płaskie ściany zostają na skałach złóż i murkach) i dokładniejsza bryła z bliska (320 trójkątów zamiast 80; z daleka bez zmian).

## 0.67.3 — 30.10.2026
- Liczby obrażeń („−N”) przypięte do trafionego w świecie gry: przy ruchu kamery zostają nad nim, zamiast płynąć razem z ekranem. Idą za żołnierzem albo wilkiem, gdy się rusza; gdy padnie albo wyjdzie z kadru, liczba zostaje nad ostatnim miejscem, w którym stał (za kamerą znika).

## 0.67.2 — 30.10.2026
- Pasek czarów magów: wszystkie ikony tej samej wielkości (wielki czar wyróżnia podwójna złota ramka zamiast większego pola) i narysowane od nowa — zwykły czar to pocisk z ogonem (kometa ognia albo wody), Deszcz ognia to spadające kule nad płomieniem, Lodowy krąg to lodowa gwiazda nad zamarzniętym kręgiem (było: kula z kreskami bez sensu).

## 0.67.1 — 30.10.2026
- **Pasek czarów magów jak w grach RPG.** Po zaznaczeniu maga w panelu wojska są dwie ikony: zwykły czar (Kula ognia / Pocisk wody) i wielki czar (Deszcz ognia / Lodowy krąg). Ładujący się czar zasłania ciemna nakładka schodząca jak wskazówka zegara, z licznikiem sekund; gotowy świeci złotą ramką (wielki — łuną ognia albo lodu), w chwili rzutu ikona błyska. Przy kilku magach jednego rodzaju w rogu widać, ilu ma czar gotowy (np. 1/3). Po najechaniu albo Tab — dymek z obrażeniami i czasem odnowienia, po polsku i angielsku. Nowy moduł `src/ui/spellBar.ts`, odświeżany co klatkę.

## 0.67.0 — 30.10.2026
Balans walki (Michał: „włócznik za mocny, łucznicy i magowie nawalają w niego bez końca”). Mierzone starciami grupa na grupę na pustej łące.
- **Tarcza nie zatrzymuje czarów.** Wcześniej ścinała o połowę także kulę ognia i czar wody — mag bił włócznika za 13 zamiast 26. Strzały z przodu tarcza osłabia teraz o 1/3 (było o połowę).
- **Łucznik:** cios 7 → 9, strzał co 2 s (było 2,4 s), celniej z daleka: z pełnego zasięgu trafia ok. 6 na 10 strzał (było ok. 1 na 3). Dwóch łuczników wygrywa z nadbiegającym włócznikiem; 10 łuczników rozbija 5 włóczników prawie bez strat.
- **Mag ognia:** kula 26 → 36 (co 3,6 s), plus parzenie i odprysk na sąsiadów — zabija łucznika jednym trafieniem, z trzema włócznikami wygrywa sam. **Mag wody:** 15 → 26. Wielki czar bije tyle co dotąd (mnożnik przeliczony).
- **Zbroja przeciw czarom** łagodzi tylko połowę swojej wartości.
- **Zbrojny:** zdrowie 110 → 120, cios 13 → 15, zbroja 35% → 30%. Wygrywa z dwoma włócznikami, z łucznikami w polu; przegrywa z magami.
- **Walka wręcz nie goni bez końca uciekającego rannego**, gdy obok stoi wróg, który walczy — zbrojny gonił szybszego rannego włócznika, a drugi bił go w plecy. Sam jeden uciekający — dalej goniony.

## 0.66.1 — 29.10.2026
- Chlew słabszy: daje 3 mięsa co 180 ticków (było 8 co 150). Zmierzone w symulacji: wcześniej jeden chlew karmił ok. 13 ludzi (sad ok. 3), teraz ok. 4–5 — więcej niż sad, bo mięso to 3 porcje, ale nie zastępuje już całej gospodarki jedzeniowej. Bot bez zmian (chlew po piekarni).

## 0.66.0 — chlew i mięso, popularność za różnorodne jedzenie (2026-10-29)

- **Chlew** (3×2, 35 drewna, w menu przy sadzie i rybaku; `tools/models/pigsty.py`): szopa świniopasa z desek pod strzechą, otwarta od zagrody, pod okapem wędzona szynka i pęto kiełbas; zagroda z plecionki na palach z uchyloną furtką, koryto z kłody z pomyjami, nieregularne kałuże błota, słoma, wiadro, worek żołędzi, widły. Świniopas tuczy świnie i odnosi do spichlerza **mięso** (nowe jedzenie, 8 sztuk co ok. 15 s; syci jak ryba — 3 porcje)
- **Mięso** z Blendera (`tools/models/meat.py`): na desce szynka z kością, boczek ze słoniną i pęto kiełbasy — tak leży w spichlerzu (warstwami) i tak niesie je chłop; ikona na pasku zapasów
- **Świnie podrasowane** (`tools/models/animals.py`): pękaty tułów, masywna głowa z podgardlem, ryj z talerzem i nozdrzami, duże uszy opadające na oczy, łaty na grzbiecie, ogonek w sprężynkę. W chlewie cztery chodzą po zagrodzie (od koryta do błota), ryją, chrząkają, nocą leżą (`render/village.ts`)
- **Różnorodne jedzenie podnosi popularność** (Michał): każdy kolejny rodzaj jedzenia w spichlerzach (jabłka, chleb, ryby, mięso) to +1, najwyżej +3 — o ile ludzie dostają racje. Nowa pozycja w rozpisce popularności, pomoc po polsku i angielsku
- **Wdrożenie stało od 0.65.21:** test dalekich wersji budynków nie przechodził przez namiot polowy (śledzie odciągów daleko od namiotu) — śledzie bliżej, test zielony
- Bot: stawia chlew po piekarni i liczy go do żywicieli osady

## 0.65.28 — rannych widać po ubraniu, krew na ostrzu (2026-10-29)

- **Plamy krwi na ubraniu:** żołnierz poniżej ok. 60% zdrowia ma ciemną plamę krwi na piersi, poniżej ok. 38% drugą na brzuchu, a ciężko ranny (poniżej 20%) także na plecach. U chłopów to samo, gdy ranią ich wilki albo wróg. Plamy znikają, gdy rany się zagoją (`render/peasants.ts`, `Figures.marks`)
- **Krew na ostrzu:** po ciosie wręcz klinga miecza (strażnik miejski, zbrojny) i grot włóczni są przez ok. 40 s przyciemnione na czerwono na końcu ostrza
- Rysowane tylko z bliska i tylko w klatkach, w których ktoś jest ranny albo ma zakrwawioną broń — bez dodatkowych wywołań rysowania w spokoju. Tylko wygląd; bot bez zmian

## 0.65.27 — łucznik w leśnym kapturze (2026-10-29)

- **Zgłoszenie:** łucznik był od stóp po czubek głowy w barwie pana — kaptur, pelerynka i przeszywanica zlewały się w jeden czerwony worek z małym okienkiem na twarz. Teraz kaptur, pelerynka i ogon kaptura są z zielonkawej, leśnej wełny (ciemniejszej u dołu), otwór na twarz jest szerszy (widać twarz i brodę), a barwy pana zostają na pikowanej przeszywanicy — łucznika w drużynie dalej poznać po barwie tułowia (`tools/models/soldier.py archer`)

## 0.65.26 — deszcz ognia bez białej plamy, krąg nie wchodzi pod ziemię (2026-10-29)

- **Zgłoszenie (wygląd wielkiego czaru):** siedem spadających kul z prześwietlonym, białym błyskiem i dużymi łunami zlewało się w jedną białą plamę z płaskimi pomarańczowymi owalami. Teraz poświata kul rośnie wolniej niż same kule, błysk przy uderzeniu wielkiego czaru jest mniejszy i pomarańczowy zamiast białego, a łuna ognia czarów mała — widać pojedyncze kule, iskry i dym (`render/spells.ts`, `scene.ts`)
- **Zgłoszenie (krąg za mapą):** fala po ziemi po uderzeniu czaru leżała płasko na wysokości celu i na zboczu wchodziła pod teren. Teraz kładzie się tuż nad najwyższym punktem gruntu pod swoim obwodem
- Tylko wygląd. Bot: bez zmian

## 0.65.25 — trzy odmiany głazów polnych (2026-10-29)

- **Zgłoszenie:** zamiast jednego jasnego, świecącego głazu — trzy odmiany z Blendera (`tools/models/plants.py`, boulder0–2): obły otoczak (bardziej szczegółowy), kanciasty pęknięty blok i duży kamień z mniejszym opartym o bok. Ciemniejsza, matowa skała z ziemistym, wilgotnym spodem i plamami porostów na wierzchu; każdy kamień na mapie dostaje swoją odmianę z miejsca. Z daleka lżejsze wersje jak dotąd. W podglądzie modeli jako „głaz polny 1–3”

## 0.65.24 — wielki czar magów mocniejszy, przerwa po nim minuta (2026-10-29)

- **Zgłoszenie:** wielki czar maga Płomienia i maga Źródła bije teraz w krąg o promieniu dwóch pól (było półtora), w środku 2,2 raza mocniej od zwykłej kuli (ogień; lód połowę tego — wcześniej lód tylko połowę zwykłej kuli). Deszcz ognia pali dwa razy dłużej, lodowy krąg spowalnia ok. 26 s zamiast 16 s. Po czarze mag odpoczywa minutę (było 25 s). Siedem kul ognia zamiast pięciu i szerszy krąg lodu na obrazie (`sim/systems/greatspell.ts`, `render/spells.ts`); pomoc po polsku i angielsku
- Bot: jego magowie mają ten sam czar

## 0.65.23 — zapasy w magazynach leżą jedne na drugich, namiot polowy poprawiony (2026-10-29)

- **Zgłoszenie (magazyny i spichlerze):** warstwy towaru (sztaby, kamień, deski, worki…) stały co stałe 0,31, więc niskie porcje wisiały nad sobą z przerwą. Teraz każda warstwa leży wprost na niższej — co wysokość tej porcji (`setStockFill` w `render/buildings.ts`)
- **Zgłoszenie (namiot polowy):** bez prostokąta ubitej ziemi przed wejściem (zostaje tylko pod namiotem); płótno drobniej tkane zamiast dużych kratek jak wiklina (dotyczy całego płótna: namioty, worki, liny); w spacerze kolizje z modelu — da się wejść do namiotu wejściem, obejść ognisko, beczkę i sznur z bandażami, a nie cała działka jest ścianą (`tools/models/fieldtent.py`, `walkmodels.ts`)
- Bot: bez zmian (sam wygląd)

## 0.65.22 — baraki górników nie dają darmowej armii (2026-10-29)

- **Zgłoszenie:** każdy barak górników werbował dwóch strażników kopalni, więc kilka baraków obok siebie dawało całą darmową armię. Teraz straż (dwóch) ma tylko barak, który naprawdę obsługuje kopalnię — najbliższy jej gotowy barak. Pozostałe baraki nie werbują; ich dotychczasowi strażnicy (gdy nie walczą i nie eskortują wozu) wracają do wioski jako chłopi, a przerwane szkolenie oddaje chłopa (`sim/systems/minecamp.ts`)
- Okno baraku pokazuje, ilu strażników mu przysługuje, i pisze, gdy barak nie obsługuje żadnej kopalni
- Bot: ta sama zasada

## 0.65.21 — nowe, mniejsze strzały (2026-10-29)

- **Zgłoszenie:** strzały były długie jak człowiek i zrobione z trzech brył w kodzie. Nowa strzała z Blendera (`tools/models/arrow.py`): cienkie drzewce, czworoboczny żelazny grot z tulejką, trzy lotki z piór co 120° (jedna czerwona), ciemna nasadka; długość ok. połowy dawnej — do pasa chłopa. Ta sama w locie, wbita w ziemię, w ścianę i w poległych (głębokość wbicia dopasowana); dalej jedna siatka i jedno wywołanie rysowania (`render/arrows.ts`)
- **Kołczan łucznika:** zamiast kulek z przodu kołczana wystają drzewca z nasadkami i po trzy cienkie lotki (białe i czerwone na zmianę) (`tools/models/soldier.py archer`)
- Bot: bez zmian (sam wygląd)

## 0.65.20 — drzewa leśniczych stoją w ziemi (2026-10-29)

- **Zgłoszenie:** drzewa posadzone przez leśniczego stały na ziemi, a nie w niej — korzenie u podstawy pnia leżały nad trawą jak ciemny talerz. Teraz, jak drzewa lasu z mapy, są wpuszczone w ziemię o 4 cm, a na zboczu głębiej (`render/terrain.ts`)

## 0.65.19 — czytelniejsza czcionka (2026-10-29)

- **Zgłoszenie:** tekst w grze (okna, podpowiedzi, skryba, menu) w **Alegreya Sans** zamiast Alegreya — ta sama rodzina liter, ale bez szeryfów i bez przechylenia, wyraźna przy małych rozmiarach i z polskimi znakami. Drobne napisy wersalikami (etykiety, przyciski, nazwy grup, do 16 px) w **Alegreya Sans SC** zamiast Cinzel, który przy małych literach się zlewał. Cinzel zostaje na duże tytuły i nagłówki — klimat RPG zostaje tam, gdzie litery są duże (`src/ui/style.css`, `index.html`)

## 0.65.18 — rudery bez ubitej ziemi na zewnątrz, okrągłe słomiane kukły (2026-10-29)

- **Zgłoszenie (rudery):** rudera i rudera narożna miały wokół siebie i przed wejściem prostokąt ubitej ziemi (w narożnej także cały podwórzec) — na trawie wyglądało to jak wycięty płat. Klepisko zostaje tylko w środku, pod ścianami (`tools/models/shack.py`, `shackl.py`)
- **Zgłoszenie (kukły):** kukły do ćwiczeń na dziedzińcu zamku były z dwóch kanciastych worków. Teraz w zamku i przy koszarach stoi okrągła słomiana kukła: pękaty snop przewiązany dwa razy sznurem, źdźbła wystające spod spodu, ramiona owinięte słomą, okrągła głowa związana pod szyją z czubkiem źdźbeł (`tools/models/strawdummy.py`)
- Bot: bez zmian (sam wygląd)

## 0.65.17 — pochodnie w kopalni, kamienna brama bez migania (2026-10-29)

- **Zgłoszenie (kopalnia):** w głębi kopalni płomienie wisiały w powietrzu. Teraz pod każdym jest pochodnia: drewniany trzonek, głowica ze szmat w smole owinięta sznurem; przy ścianach w żelaznym uchwycie wbitym w skałę, na słupkach w żelaznej tulei, przy szybie przywiązana do słupka barierki (`tools/models/minelevel.py`)
- **Zgłoszenie (kamienna brama):** boczne ściany przejazdu migały, bo lico baszty leżało w tej samej płaszczyźnie co koniec bloku sąsiedniego muru. Baszty stoją teraz 6 mm bliżej przejazdu i zasłaniają koniec muru (`tools/models/stonegate.py`)
- Bot: bez zmian (sam wygląd)

## 0.65.16 — pochodnia w spacerze płonie całą głowicą (2026-10-29)

- **Zgłoszenie:** pochodnia wyciągnięta w spacerze (F) paliła się tylko wąskim płomykiem na czubku. Teraz główny płomień zaczyna się w połowie szmat i obejmuje całą głowicę (szerszy i wyższy), a trzy mniejsze języki liżą jej boki
- Tylko wygląd

## 0.65.15 — pasek wczytywania gry nie skacze 80 ↔ 81 (2026-10-29)

- **Zgłoszenie:** na końcu wczytywania meczu („Ostatnie przygotowania…”) gra czeka na równe klatki. Liczyła je tylko z rzędu, więc każde pojedyncze szarpnięcie zerowało licznik i pasek skakał 80 → 81 → 80, a wejście ciągnęło się do 12 s. Teraz wystarczy 27 równych z ostatnich 30 klatek, a pasek idzie tylko do przodu (z równych klatek albo z upływu czasu)

## 0.65.14 — ekran wczytywania bez „trawy” (2026-10-29)

- Krok wczytywania „Drzewa, trawa i postacie” nazywa się teraz „Drzewa i postacie” — kępy trawy są wyłączone od 0.64.7 i nic z nich się nie wczytuje. (Tekstura trawy na ziemi zostaje: to zwykła łąka pod nogami.) „Przygotowanie grafiki” to kompilacja shaderów i próbne modele wszystkich budynków, nie trawa

## 0.65.13 — ludzie nie wchodzą jeden w drugiego (2026-10-29)

- **Zgłoszenie:** gdy kilku chłopów (albo żołnierzy) szło tą samą drogą, symulacja prowadziła ich przez te same punkty i na ekranie szli jeden w drugim. Teraz w wyglądzie każdy, kto jest bliżej niż 0,2 pola od drugiego, odsuwa się od niego (najwyżej o ok. 0,2 pola); dwóch w dokładnie tym samym miejscu rozchodzi się każdy w swoją stronę. Bez sąsiadów odsunięcie powoli wraca do zera (`render/motion.ts`)
- Tylko wygląd: symulacja bez zmian, gra przez sieć zgodna. Bot: bez zmian

## 0.65.12 — mniejsze krawężniki bruku, ognisko bez „koła” (2026-10-29)

- **Zgłoszenie (bruk):** krawężniki kamiennej drogi o połowę niższe i węższe, cztery drobniejsze kamienie na bok pola zamiast trzech dużych, bliżej brzegu (`render/terrain.ts`; także ikona drogi w menu budowy)
- **Zgłoszenie (ognisko w obozowisku):** zamiast równej, okrągłej tarczy popiołu i żaru — nierówna kupka popiołu z kilku płaskich grudek, zwęglone kawałki drewna i żarzące się węgle między polanami (`tools/models/camp.py`)
- Bot: bez zmian (sam wygląd)

## 0.65.11 — magowie nie stoją bezczynnie, wejście na wieżę z klatki schodowej (2026-10-29)

- **Zgłoszenie (magowie):** magowie bez rozkazu (np. postawieni w trybie deweloperskim jako wróg) bili tylko żołnierzy i chłopów w zasięgu wzroku; gdy takich zabrakło, stali bezczynnie choćby pod cudzym zamkiem. Teraz, jak włócznicy, biorą się za najbliższy wrogi budynek (ogniem albo wodą). Łucznicy dalej strzelają w budynki tylko na rozkaz. Postawionych magów wroga nie da się zaznaczyć — to jednostki wroga
- **Zgłoszenie (wejście na wieżę):** po wejściu drzwiami żołnierz przez jeden krok symulacji był już na wysokości pomostu, ale jeszcze obok wieży, i dopiero wsuwał się na nią. Teraz przy przejściu na mur albo pomost nie ma przejścia między polami, a w kamiennej wieży wychodzi na pomost z klatki schodowej w środku i stamtąd idzie na swoje miejsce
- Bot: jego magowie po fali też biją w budynki, gdy nie mają kogo bić

## 0.65.10 — ślady wilków na śniegu (2026-10-29)

- Wilki zostawiają na śniegu odciski łap: poduszka, cztery palce i ślady pazurów, prawie w jednej linii jak w kłusie, krok krótszy niż człowieka. Blakną i znikają jak ślady butów, w zamieci szybciej, a gdy śnieg stopnieje — wszystkie (`render/footprints.ts`, trzecia siatka obok butów i bruzd)
- Tylko wygląd. Bot: bez zmian

## 0.65.9 — para z ust zimą, rybak pod lodem, krew chłopów i wilków (2026-10-29)

- **Para z ust:** przy temperaturze poniżej ok. 2°C ludzie i żołnierze co kilka sekund wypuszczają przed siebie mały obłoczek pary; przy mrozie większy, w walce i w biegu częściej. Tylko blisko kamery, jedna wspólna siatka (`render/breath.ts`)
- **Rybak zimą łowi o połowę mniej:** przy brzegu lód, połów trwa dwa razy dłużej (`siteTicks` w `workers.ts`, okno budynku pokazuje prawdziwy czas). Skryba w zapowiedzi zimy ostrzega o tym, gdy masz rybaka; opis rybaka po polsku i angielsku
- **Krew u chłopów i wilków:** chłop raniony przez wilka albo wroga i trafiony wilk pryskają kroplami jak żołnierze, ciężko ranni gubią krople, idąc (`render/bloodfx.ts`)
- Bot: rybak bota też łowi zimą wolniej (ta sama zasada); reszta to sam wygląd

## 0.65.8 — strażnicy miejscy goją się poza walką (2026-10-29)

- **Zgłoszenie:** strażnik miejski, który nie walczy (bez celu, bez świeżego ciosu, bez wroga ani wilka w promieniu 6 pól), odzyskuje 1 punkt zdrowia co 2 s — od ledwo żywego do pełna w ok. 2 minuty. Nie musi iść do twierdzy, goi się na swoim posterunku i obchodzie
- Wcześniej strażnicy nie leczyli się wcale (byli wyłączeni z leczenia przy twierdzy i w namiocie polowym)
- Bot: to samo (jego straż też się goi)

## 0.65.7 — krew w trakcie walki (2026-10-29)

- **Prysk przy trafieniu:** każdy cios i trafiona strzała wyrzucają kilka kropli z wysokości tułowia, w tył i na boki od trafionego; im mocniejszy cios, tym więcej kropli. Spadają łukiem i zostają na ziemi jako drobne plamki (`render/bloodfx.ts`)
- **Krople za rannym:** żołnierz poniżej połowy zdrowia, idąc, gubi co kawałek kroplę — im słabszy, tym gęściej. Na murze i pomoście nie (krople nie lecą przez kamień)
- Plamki są małe, kładą się na zboczu jak plama pod poległym, ciemnieją i po ok. minucie znikają; naraz najwyżej 700 plamek i 240 kropli w powietrzu. Taran nie krwawi
- Tylko wygląd: symulacja o tym nie wie, gra przez sieć bez zmian. Bot: bez zmian

## 0.65.6 — nowe wejścia do kamiennych wież z prawdziwymi drzwiami (2026-10-29)

- **Zgłoszenie:** tam, gdzie powstaje nowe wejście do kamiennej wieży (z korony muru albo przy ziemi, gdy przed frontem coś stoi), stoją teraz takie same drzwi jak od frontu: kamienne obramienie z nadprożem, okute skrzydło z desek z teksturą, kołatka; przy ziemi także kamienne schodki. Wcześniej był tam czarny prostokąt. Model w Blenderze: `tools/models/towerdoor.py`, w podglądzie modeli w grupie „Części budynków”
- Z korony muru drzwi są o 15% mniejsze (nad nimi zaczynają się wsporniki chodnika)
- Bot: bez zmian (sam wygląd)

## 0.65.5 — wejścia z muru do wieży, wspinaczka bez doskoku, ognisko w obozowisku (2026-10-29)

- **Zgłoszenie (mur ↔ kamienna wieża):** łącznik muru z wieżą i nadproże wejścia były czarne (bryły bez kolorów wierzchołków przy materiale z cieniem w zagłębieniach) — teraz z kamienia i z teksturą jak reszta muru (`stoneWallKit` → `bridge`, `lintel`). Wejście jest jedno na każdy bok wieży, na środku odcinka, którym dochodzi do niej mur (gruby mur dawał dwa wejścia obok siebie)
- **Zgłoszenie (wejście do wieży):** po wejściu drzwiami albo po drabinie żołnierz pojawiał się już na wysokości pomostu, ale jeszcze poza wieżą, i dopiero potem „doskakiwał” na swoje miejsce. Przy przejściu ziemia ↔ mur ↔ pomost obraz staje teraz od razu tam, gdzie stoi w symulacji (`scene.ts`, `levelOf`)
- **Zgłoszenie (ognisko w obozowisku):** trójnóg z okrągłych żerdzi z korą, skrzyżowanych i przewiązanych liną nad ogniem, łańcuch z hakiem, kociołek z kabłąkiem i wodą — wisi wyżej, więc płomień nie przechodzi już przez kociołek (`tools/models/camp.py`)
- Bot: bez zmian (sam wygląd)

## 0.65.4 — drabiniarz (2026-10-28)

- **Nowa jednostka: drabiniarz** (z koszar, drabina szturmowa + 6 rudy). Nie walczy — niesie drabinę. Prawy klik na wrogim murze kamiennym: podbiega i przystawia ją; z rozkazem „atak w marszu” albo stojąc blisko wrogiego muru robi to sam. Po drabinie wchodzi na koronę każde wojsko
- **Po przystawieniu biegnie po następną** do zamku albo do namiotu polowego (który bliżej) i bierze ją ze zbrojowni; gdy drabin nie ma, czeka. Namiot polowy postawiony przy oblężeniu = krótka droga po drabiny
- Zwykli żołnierze już sami drabin nie przystawiają (tylko wchodzą po stojących). Wygląd: postać sapera z drabiną niesioną oburącz; portret sapera
- Nazwa, opisy (cieśla, namiot polowy) i pomoc po polsku i angielsku
- Bot: szkoli do dwóch drabiniarzy, gdy wróg ma mur kamienny, a w zbrojowni leży drabina; idą z falami ataku i sami przystawiają drabiny

## 0.65.3 — o 43% mniej trójkątów w klatce: pnie i bale (2026-10-28)

- **Pnie drzew z daleka (Michał):** lżejsza wersja pnia (160–360 zamiast 1400–3000 trójkątów) działała, ale włączała się dopiero 18 pól od brzegu kawałka lasu, czyli w praktyce pełne pnie sięgały 30–40 pól. Teraz w zwykłym widoku pełny pień zostaje tylko blisko środka widoku (próg 6). W spacerze, oczami chłopa, zostaje 18 jak dotąd. Pełny model się nie zmienił, upraszczamy tylko z daleka (`render/terrain.ts`)
- **Niesione i leżące bale:** każda z 8 odmian drzewa liczyła wszystkich chłopów, a tym bez bala dawała bryłę ściśniętą do zera. Karta przeliczała ok. 400 tys. pustych trójkątów na klatkę. Teraz pula ma tylko prawdziwe bale (`render/scene.ts`)
- Pomiar (osada, kamera 30, `node tools/check/drawcalls.mjs`): **3,0 → 1,7 mln trójkątów** (pnie 1,69 → 0,80 mln), wywołania rysowania 259 → 244. Narzędzie liczy teraz też trójkąty według kategorii (`--cam=` odległość kamery, `--chrome=` własna przeglądarka)
- Bot: bez zmian (sam wygląd)

## 0.65.2 — strzały w ścianach znikają z budynkiem (2026-10-28)

- **Zgłoszenie:** gdy budynek zostanie zniszczony (ruina) albo rozebrany, strzały wbite w jego ściany znikają razem z nim, a nie wiszą w powietrzu (`render/arrows.ts`: strzała pamięta id budynku)
- Bot: bez zmian (sam wygląd)

## 0.65.1 — drabiny szturmowe robi cieśla (2026-10-28)

- **Warsztat cieśli** (2×2, 40 drewna, `tools/models/carpenter.py`): cieśla zbija z 3 drewna ze składu drabinę szturmową i odnosi ją do zbrojowni (nowy towar „Drabiny szturmowe”, na pasku przy broni). W izbie drabina w robocie na dwóch kozłach, piła, świder, zapas szczebli; przed warsztatem gotowe drabiny oparte o stojak i żerdzie pod daszkiem. Nazwa i opis po polsku i angielsku
- **Drabina oblężnicza kosztuje drabinę ze zbrojowni:** żołnierz idzie pod wrogi mur tylko wtedy, gdy jego pan ma w zbrojowni drabinę, i zużywa ją, gdy ją przystawi. Bez drabin wojsko nie wejdzie na mur (dalej może wejść przez wieżę albo rozbić mur)
- Bot: stawia warsztat cieśli w środku swojej listy budowy (po cechu inżynierów), więc jego wojsko ma drabiny na mury gracza
- Wdrożenia znów działają: test lecących strzał nie liczył osobnej siatki strzał wbitych w ziemię (zmiana z innego czatu, 0.64.11) i blokował wdrożenie 0.64.11 i 0.65.0

## 0.65.0 — drabiny oblężnicze, drugie wejście na wieże, mur ze strażnicą (2026-10-28)

- **Drabiny oblężnicze jak w Twierdzy** (`sim/systems/siegeladders.ts`): żołnierz, który chce dosięgnąć obrońcy na koronie muru kamiennego, a nie ma tam przejścia, podchodzi pod mur, przez 3 sekundy przystawia drabinę i wchodzi po niej na górę. Drabina otwiera ten bok muru dla każdego. Obrońcy stojący na koronie przy drabinie spychają ją (ok. 6 s jeden obrońca, kilku szybciej), ale nie wtedy, gdy ktoś po niej wchodzi albo wróg stoi u jej stóp; po 10 minutach sama się przewraca, pada też z murem. Drabiny widać przy murze i zapisują się w zapisie gry
- **Drugie wejście na wieżę:** gdy przed frontem wieży stanie mur albo budynek i wejście przechodzi na inny bok, po tej stronie stoi teraz druga drabina (strażnica, czatownia), a w kamiennej wieży ciemne drzwi z nadprożem w trzonie
- **Mur kamienny ze strażnicą i czatownią:** z korony muru prowadzi krótka drabina na pomost drewnianej wieży (bez blanek w poprzek przejścia); żołnierz wspina się po niej z muru na pomost
- Bot: jego wojsko samo przystawia drabiny do murów gracza, gdy obrońca stoi na koronie, a przejścia nie ma (to samo zachowanie co u gracza)

## 0.64.11 — strzały zostają po bitwie, kruki na krzyżach (2026-10-28)

- **Strzały wbite po bitwie (Michał):** chybiona strzała wbija się skośnie w ziemię za celem, a strzała w budynek zostaje w jego ścianie: celuje w lico bryły, a nie w środek działki. Po 90 s chowa się grotem naprzód i znika, najwyżej 600 naraz (`render/arrows.ts`)
- **Strzały w poległych:** każda celna strzała w żołnierza albo chłopa zostaje w nim (najwyżej 3 na ciało). Po śmierci sterczą skośnie z tułowia leżącego i znikają razem z ciałem
- **Kruki na krzyżach leśnych grobów:** co jakiś czas przylatuje kruk, siada na krzyżu i rozgląda się. Gdy ktoś podejdzie albo posiedzi swoje, zrywa się i odlatuje. Najwyżej 6 naraz na mapę (`render/crows.ts`). Krakania na razie nie ma (brak nagrania, wpisane w `docs/pomysly.md`)
- Reszta propozycji z 28.10 (krew w trakcie walki, las w paczkach, drogi) dopisana do `docs/pomysly.md`
- Bot: bez zmian (sam wygląd)

## 0.64.10 — krew kładzie się na terenie, ślady butów tylko na śniegu (2026-10-28)

- **Krew na zboczu:** plama pod poległym przechyla się razem z terenem (nachylenie liczone z wysokości wokół ciała) i leży 2 cm nad ziemią — wcześniej leżała płasko, więc na pochyłości połowa chowała się w ziemi i plama miała prosto ucięte brzegi. Na pomoście wieży i koronie muru leży płasko
- **Ślady butów wiosną:** odciski i bruzdy powstają i są widoczne tylko na prawdziwym śniegu (od ok. połowy pokrycia, `footprints.ts`); przy cienkich łatach śniegu, gdy ziemia jest już zielona, nie ma niebieskich śladów na trawie
- Bot: bez zmian

## 0.64.9 — mniej krwi pod poległymi (2026-10-28)

- **Zgłoszenie: „aż za dużo krwi”.** Plama pod poległym rozlewa się najwyżej do ok. pół pola (wcześniej ponad całe pole), ma trzy krótkie smugi zamiast sześciu długich i kilkanaście drobnych kropel blisko plamy zamiast czterdziestu rozrzuconych daleko; świeża jest ciemniejsza, mniej jaskrawa (`render/blood.ts`)
- Bot: bez zmian

## 0.64.8 — mur łączy się z kamienną wieżą, w ścianie wieży wejście (2026-10-28)

- **Mur dochodzi do wieży:** korona muru kamiennego przy kamiennej wieży (każdej wielkości) ciągnie się aż do ściany trzonu — bez szpary i bez przedpiersia z blankami w poprzek przejścia (`render/walls.ts`)
- **Ciemne wejście w ścianie wieży** na wysokości korony muru, z kamiennym nadprożem: tędy żołnierze z muru wchodzą do wieży
- **Z muru na pomost:** przejście z korony muru na pomost wieży (wyżej) trwa chwilę jak wspinaczka — żołnierz znika w wejściu, idzie schodami w środku i wychodzi na pomost (z pomostu na mur tak samo, w dół)
- Bot: bez zmian (korzysta z tych samych przejść)

## 0.64.7 — trawa wyłączona, lobby gry przez sieć bez skakania (2026-10-28)

- **Trawa wyłączona na razie** (prośba Michała): dywan kęp trawy z pobranych zdjęć (`render/grass.ts`) nie jest tworzony (`GRASS = false` w `render/terrain.ts`); łąka zostaje z teksturą ziemi. Kod i atlas zostają — trawa wraca po zmianie flagi
- **Gra przez sieć bez skakania:** zalogowany widzi od razu całe okno lobby (zakładki, zakładanie gry, lista), a lista gier doczytuje się w miejscu z napisem „Wczytuję gry…” — wcześniej najpierw był mały napis „Łączenie…”, potem całe okno, potem lista, i wszystko podskakiwało. Lista ma stałą wysokość, a spóźniona odpowiedź serwera nie maluje już ekranu, z którego się wyszło
- **Większy napis, gdy nie ma gier:** „Nie ma jeszcze żadnych gier” większą czcionką, z większym opisem, na całej wysokości listy
- Wdrożenia od 0.64.2 nie wchodziły na stronę, bo w testach padał test bota (koszary): po zmianach z innych czatów bot stawia koszary ok. 8,8 doby, a test czekał 7,5 — test dostał dłuższy czas i wdrożenia znów działają
- Bot: bez zmian

## 0.64.6 — wspinaczka po drabinach, schody w kamiennych wieżach, szturm na wieże, łatwiejsze klikanie (2026-10-28)

- **Wchodzenie po drabinie** (`step` w `sim/systems/army.ts`, `CLIMB_TICKS`): przejście z ziemi na pomost wieży albo koronę muru (i z powrotem) trwa chwilę — żołnierz staje przy drabinie i powoli się po niej wspina (schodzi), potem staje od razu na górze. W kamiennej wieży idzie schodami w środku: znika w drzwiach i wychodzi z klatki schodowej na pomoście
- **Wnętrze kamiennych wież** (`tools/models/towerroof.py`): w pomoście baszt jest otwór klatki schodowej z obramieniem, odchyloną klapą obok, szybem z ciosów i stromymi drewnianymi schodami w głąb wieży, na dole podłoga i latarnia. Widać je po kliknięciu wieży (dach znika)
- **Wejście nie w mur:** stawiana wieża sama obraca się drabiną albo drzwiami na pierwszy wolny bok, gdy front wypada na mur albo budynek; narożne wieże na starcie gry patrzą wejściem do osady
- **Szturm jak w Twierdzy:** na pomost wejdzie każdy, kto dojdzie do wejścia — wróg, który wedrze się do osady, wspina się po wieży i ścina łuczników wręcz. Z ziemi wręcz dalej ich nie dosięgnie, musi wejść na górę
- **Łatwiej trafić w wieżę i mur:** kursor nad budynkiem wskazuje ten budynek (promień po bryłach, co 40 ms), a nie ziemię za nim — prawy klik na wysoką wieżę albo koronę muru wysyła tam wojsko
- Bot: korzysta z tego samego (jego wojsko też wspina się na wieże gracza)
- Uwaga: test bota „buduje koszary w 7,5 doby” nie przechodzi już na main przed tą zmianą (zmiana z innego czatu), ta wersja tego nie rusza

## 0.64.5 — krew jako plama, która się rozlewa (2026-10-28)

- **Zgłoszenie (krew okrągła, na śniegu ucięta jak kawałek tortu):** zamiast szarego koła pod poległym jest teraz nieregularna plama z kleksami, smugami w bok i drobnymi bryzgami dookoła. Każda jest inaczej obrócona i rozciągnięta (`src/render/blood.ts`)
- **Krew dynamiczna:** wypływa dopiero po upadku i rozlewa się przez ok. 20 s, najpierw szybko, potem coraz wolniej. Świeża jest czerwona i mokro błyszczy, a z rozkładem ciała ciemnieje do brązu
- Plama leży na wierzchu terenu (przesunięcie głębi), więc śnieg ani zbocze już jej nie ucinają
- Bot: bez zmian (sam wygląd)

## 0.64.4 — im większa wieża, tym większy zasięg (2026-10-28)

- **Zasięg łucznika z wieży rośnie z jej wielkością** (`TOWERS` w `data/buildings.ts`): z ziemi 8 pól, z czatowni 10, ze strażnicy 11, z baszty 13 (dawniej 12), z dużej baszty 15 (dawniej 13), z wielkiej 17. Koło zasięgu przy zaznaczonej wieży pokazuje nowe wartości
- **Z wieży widać tak daleko, jak z niej się strzela:** dawniej łucznik na wielkiej baszcie widział tylko 13 pól, więc dalszego zasięgu nie używał; teraz wzrok na pomoście rośnie razem z premią wieży
- Opisy baszt i „Jak grać” po polsku i angielsku podają nowe zasięgi
- Bot: bez zmian (korzysta z tych samych wież)

## 0.64.3 — poduszki w komnacie pana, ciała nie leżą bez końca (2026-10-28)

- **Zgłoszenie (poduszki u pana):** u królowej leżały dobrze, a u pana były pochylone w złą stronę: licem do wezgłowia, a dolnym brzegiem wbite w siennik. Teraz są oparte o wezgłowie i zwrócone w stronę śpiącego, tak jak u królowej (`tools/models/keep.py`)
- **Zgłoszenie (ciała leżały po 20 minut):** ciało, do którego dwójka nie mogła dojść, wracało do puli i od razu dostawało kolejną dwójkę. Przez to cały czas było „zajęte” i nigdy się nie rozkładało. Teraz po nieudanej próbie czeka minutę na nową dwójkę (`rest` w `bearers.ts`), a po ok. 10 minutach rozkłada się i znika, nawet jeśli ktoś akurat po nie szedł (`army.ts`)
- Bot: bez zmian (te same zasady pochówku dla wszystkich)

## 0.64.2 — rudery: wejście, szpary i kalenica; ognisko przy namiocie (2026-10-28)

- **Zgłoszenie (rudera i rudera narożna):** dziwne wejście — pas skóry z boku otworu wyglądał jak deska w kratkę, a jasny sznur jak luźna listwa. Teraz skóra jest zwinięta w rulon pod belką nad wejściem, przewiązana dwoma sznurami do belki, z krótkim fartuchem spod rulonu; przejście wolne (`tools/models/shackparts.py`)
- **Przez szpary prześwitywało niebo:** od środka ścian obu ruder idzie ciemne deskowanie tuż za licem desek (z otworem na wejście), więc w szparach i w miejscach po brakującej desce widać ciemne drewno
- **Deska nad dachem latała w powietrzu:** płaską deskę kalenicy zastąpiła czapa z dwóch desek leżących na połaciach, wzdłuż całej kalenicy (rudera, oba dachy rudery narożnej)
- **Ognisko przed namiotem:** zamiast ciemnej płyty i dwóch kanciastych kloców — płaska kupka popiołu z węgielkami i trzy okrągłe polana z korą ułożone w gwiazdę, ze zwęglonymi końcami w środku
- Bot: bez zmian

## 0.64.1 — na wieże wchodzi się jak na teren, jak w Twierdzy 2 (2026-10-28)

- **Pomost wieży to teren, tylko wysoko** (`sim/systems/stonewalls.ts`): każde pole gotowej wieży (czatownia, strażnica, wszystkie baszty) ma bit `WALL_TOP`, tak jak korona muru kamiennego. Wchodzi się drabiną albo drzwiami od frontu, z przyległego muru kamiennego albo po drabinie gracza przystawionej z boku. Gdy przed frontem stoi mur albo budynek (np. wieża w narożniku palisady), wejście przechodzi na pierwszy wolny bok. Na pomost wchodzą tylko swoi (jak przez bramę), wróg z muru do wieży nie przejdzie
- **Bez przypisywania łuczników:** prawy klik na wieży wysyła zaznaczonych żołnierzy dowolnego rodzaju (poza taranem) na wolne pola pomostu. Każdy staje na swoim polu, więc im mniejsza wieża, tym mniej się zmieści: czatownia 1, strażnica i baszta 4, duża baszta 9, wielka 16. Kto się nie zmieści, staje przy wieży. Stojący na wieży dalej należą do oddziału i grup 1–0, zaznacza się ich ramką jak innych, a schodzą zwykłym rozkazem marszu albo przyciskiem „Zejdźcie z wieży”
- **Zasięg z wysokości:** stojący na pomoście strzela jak z muru (+3 pola) plus premia wieży (czatownia −1, kamienne +1/+2/+6), widzi dalej, wręcz z ziemi go nie dosięgną; nie schodzi sam za wrogiem, nie cofa się ranny i nie idzie sam na budynki
- **Wygląd:** człowiek na pomoście stoi na wysokości pomostu tej wieży, a przed drabiną albo drzwiami wspina się na nią (jak przy drabinie na mur); na drewnianej strażnicy stoi trochę bliżej środka, między nogami z bali. Polegli na pomoście leżą na górze, grabarz znosi ich spod wieży
- Zapisy sprzed tej wersji: łucznicy przypisani do wieży stają na wolnych polach jej pomostu; na starcie gry z murami łucznicy stoją od razu na pomostach
- Okno wieży, „Jak grać” i opisy wież po polsku i angielsku mówią o wchodzeniu i miejscach na pomoście
- Bot: dalej wysyła po dwóch łuczników na każdą wieżę (na czatownię jednego), liczy stojących na pomoście, a nie przypisanych; tych z wieży nie bierze do ataku

## 0.64.0 — przenoszenie budynków za rudę (2026-10-28)

- **Przycisk „Przenieś (N rudy)” w oknie gotowego budynku** (`src/sim/systems/relocate.ts`, rozkaz `relocate`): po kliknięciu podgląd budynku idzie za kursorem jak przy stawianiu (R obraca, zielony = wolno), klik wskazuje nowe miejsce, Esc anuluje
- **Robotnicy naprawdę go przenoszą:** stary budynek od razu rozbierają na stos materiału na starej działce, na nowym miejscu staje plac budowy, a robotnicy biorą ze stosu ładunek po ładunku (nie ze składu), niosą na plac i stawiają budynek od nowa. Stos maleje na oczach, a gdy zniknie, stara działka jest wolna
- **Koszt:** tylko ruda za robotę — 10 + 15% sumy kosztu budynku (`RULES.moveBase`, `RULES.movePercent`); materiału nie płaci się drugi raz. Wyłączony budynek zostaje wyłączony po przenosinach
- Nie przenosi się: twierdzy, dróg, murów, bram, wież, pochodni, dodatków, magazynów (towar w środku) ani kopalni rudy. Nie da się przenieść budowy, ruiny, budynku w ogniu ani pod okiem wroga
- Gdy plac w nowym miejscu zniknie (np. zniszczy go wróg), resztka stosu zamienia się w zwykły, bezwartościowy gruz do wyniesienia; stos do przenosin nie rozpada się sam, póki plac czeka
- Opis w „Jak grać” (Rozbiórka i ruiny → Przenoszenie budynku), teksty po polsku i angielsku; test `tests/relocate.test.ts`
- Bot: świadomie nie używa (stawia od razu tam, gdzie chce; komentarz przy `ORDER`)

## 0.63.8 — bruzdy w śniegu po ciągniętych pniach i koleiny wozów (2026-10-28)

- **Ciągnięty pień zostawia bruzdę:** drwal, który wlecze ścięte drzewo do chaty, zostawia za sobą szeroką, ciągłą bruzdę tam, gdzie koniec pnia szoruje po śniegu (za jego plecami)
- **Wóz zostawia koleiny:** dwukółka z surowcami (także wóz z urobkiem z kopalni) ciągnie za sobą dwie wąskie koleiny po kołach, a chłop, który ją ciągnie, odciski butów
- Bruzdy i koleiny bledną tak samo jak odciski butów (po ok. 25 s, przez 15 s), szybciej w zamieci, i znikają razem ze śniegiem. Druga siatka instancji (jedno wywołanie rysowania), tekstura miękkiego pasa z podłużnymi rysami, odcinki co 6 cm zlewają się w jedną linię (`render/footprints.ts` → `TrackLayer`)
- Bot: bez zmian (wygląd)

## 0.63.7 — Mój ród, konto i karta postaci: duże i czytelne (2026-10-28)

- **Mój ród jak księga** (`ui/house.css`, `online.ts → asBook`): okno na całą prawą część menu, jak „Jak grać”, zamiast wąskiego panelu z drobnym pismem. Po lewej karta postaci: duży herb, romb poziomu, imię (do 44 px) i tytuł, gruby pasek doświadczenia z liczbami, następny tytuł i ile PD brakuje, „Do boju” na całą szerokość. Po prawej zakładki (Przegląd, Kronika bitew, Herb): cztery duże tablice statystyk (liczby do 54 px), droga do korony z większymi rombami, odznaki z dużymi ikonami, opisem i paskiem postępu, tabela „Skąd brać doświadczenie”, kronika bitew i herb z większymi próbkami
- **Twoje konto jak księga:** dwie kolumny — wizytówka (herb, nick do 38 px, e-mail), bilans dużymi liczbami, ostatnie mecze z wyraźnym wynikiem; po prawej formularze nicku i hasła z dużymi etykietami i polami (48 px)
- **Karta postaci na dole menu:** większa (do 420 px), czerwono-złoty pas po lewej, nick w Cinzel, tytuł i poziom złotem, gruby pasek PD z liczbami; bez ciężkiej ramki
- Rozmiary od wysokości okna, więc tak samo czytelnie na laptopie i dużym monitorze; przy wąskim oknie karta postaci wskakuje nad zakładki, konto w jednej kolumnie. Kontrast policzony (tekst 15,6:1, opisy 10,8:1, liczby 17,7:1), fokus klawiatury widoczny
- Bot: bez zmian (interfejs)

## 0.63.6 — Nowa gra i Gra przez sieć w stylu nowego menu, bez encyklopedii modeli w „Jak grać”, ślady w spacerze (2026-10-28)

- **Nowa gra** (`ui/menu-windows.css`, także w układzie z podglądem mapy): kafelki trybu i trudności jak pozycje menu — ciemne, półprzezroczyste, z cienką złotą ramką; wybrany na czerwonym pasie ze złotą krawędzią i złotym rombem zamiast okrągłego „✓”; nazwy w Cinzel, opisy zwykłym pismem; przełącznik trybu deweloperskiego i pole nazwy mapy w tym samym stylu; „Rozpocznij” jak pieczęć z menu
- **Gra przez sieć:** filtry (Wszystkie, 1 na 1…, Znajomi, Ranking) jako płaskie przyciski w Cinzel, wybrany na czerwonym pasie z złotym podkreśleniem; pusta lista bez jasnego pergaminu — ciemna, z przerywaną złotą ramką; karty pokoi, pole nazwy i lista wyboru ciemne, w tym samym stylu
- **„Jak grać” bez encyklopedii** (Postacie i zwierzęta, Budynki z podglądem modeli): na to jest osobna strona — Ustawienia → Dla twórców → Podgląd modeli (`modele.html`)
- **Ślady butów w spacerze:** kto chodzi z pierwszej osoby, też zostawia odciski na śniegu (w skoku nie)
- Dostępność: fokus klawiatury na kafelkach, filtrach i polach (złota obwódka), kontrast napisów co najmniej 7:1, bez animacji przy `prefers-reduced-motion`
- Bot: bez zmian (interfejs)

## 0.63.5 — Ustawienia, Jak grać i Mój ród w stylu nowego menu (2026-10-28)

- **Okna w prawej części menu** (`src/ui/menu-windows.css`, osobny plik, żeby nie wchodzić w `style.css` czatu od menu): bez ciężkiej ramki z narożnikami — półprzezroczysta ciemna płyta nad pejzażem (lekkie rozmycie), cienka złota linia po lewej; nagłówek okna jak w menu (Cinzel, wersaliki, złota kreska gasnąca w prawo)
- **Spis rozdziałów** w Ustawieniach i „Jak grać” jak lista w menu: romb przy pozycji zamiast numerowanego kwadratu, wybrana i wskazana pozycja na czerwonym pasie ze złotą krawędzią, nagłówki grup w tej samej czcionce; spis szerszy, żeby nazwy się nie zawijały
- **Przyciski:** główny (Zapisz, Do boju, Graj) jak czerwona pieczęć z menu, pozostałe (Wstecz, Przywróć domyślne, Plan na start, Konto i hasło) płaskie, z cienką złotą ramką, w tej samej czcionce
- **Mój ród (postać):** zakładki jako napisy z podkreśleniem zamiast kafli, karta postaci z czerwono-złotym pasem po lewej, imię i tytuł w Cinzel; Nowa gra i Gra przez sieć dostały to samo tło i przyciski
- **Poprawka:** w „Jak grać” i Ustawieniach tekst rozdziału kończył się w połowie okna (stary limit wysokości 520 px z własnym przewijaniem), a niżej było pusto — strona wypełnia teraz całe okno i przewija się w całości
- Dostępność: kontrast policzony (napisy 11,4:1, wybrana pozycja 10,9:1, przycisk wtórny 13,2:1, ramka 4,7:1), widoczny fokus klawiatury na każdej pozycji i przycisku, bez animacji przy `prefers-reduced-motion`
- Bot: bez zmian (interfejs)

## 0.63.4 — ślady butów: każdy swoje, na ziemi, bledną zamiast znikać (2026-10-28)

- **Trzech obok siebie = jedne ślady:** odciski liczyły się z położenia w symulacji, a na ekranie gra rozsuwa ludzi idących jednym torem. Teraz biorą miejsce stóp postaci dokładnie tak, jak stoi na ekranie (scena zapisuje je przy rysowaniu chłopów i żołnierzy), więc każdy zostawia swój ślad
- **Ślady w powietrzu:** wysokość brała się z innego wyliczenia niż ta, na której stoją nogi (np. przy drogach i na zboczach). Teraz to ta sama wysokość stóp co u postaci
- **Znikały od razu zamiast blednąć:** przy kilkudziesięciu idących pierścień 4096 odcisków zapełniał się w kilka sekund i najstarsze (jeszcze widoczne) były wycinane. Pierścień większy (24 576), a pełny — nowy odcisk czeka, zamiast wycinać widoczny; każdy ślad zawsze spokojnie blednie (po ok. 25 s, przez 15 s). Promień wokół kamery 30 pól
- Bot: bez zmian (wygląd)
## 0.63.3 — dachy na wieżach zdejmowane kliknięciem, czatownia na jednego łucznika (2026-10-28)

- **Zgłoszenie:** po kliknięciu drewnianej wieży strażniczej dach nie schodził. Gra zdejmowała dach tylko budynkom z wnętrzem, a wieża ma pod dachem sam pomost. Modele wież mają teraz znacznik `openTop` (`blenderModel` → `userData.openTop`, `animateBuilding`), więc po kliknięciu dach, iglica i proporzec znikają i widać pomost z łucznikami
- **Kamienne wieże z dachem:** baszta, duża i wielka baszta dostały dach czterospadowy z łupka na czterech dębowych słupach z mieczami i oczepami, z krokwiami widocznymi od spodu, kalenicami z kamienia i iglicą z gałką (`tools/models/towerroof.py`). Na małej baszcie dach przykrywa cały pomost, a proporzec przeszedł na iglicę; na dużych dach stoi nad środkiem, między wykuszami. Po kliknięciu dach znika i widać pomost: klapę zejścia, kosze strzał, beczki z wodą i kupki kamieni do zrzucania
- **Czatownia** (1×1, 8 drewna, 240 PŻ, `tools/models/lookout.py`): najtańsza, licha wieżyczka z czterech krzywych żerdzi na kamieniach, z zastrzałami przywiązanymi łykiem, ciasnym pomostem z nierównych desek, przedpiersiem z wikliny, drabiną z żerdzi i daszkiem ze strzechy (też zdejmowanym kliknięciem). Mieści jednego łucznika, który stoi pośrodku i się rozgląda; niska, więc strzela pole bliżej niż strażnica. Da się ją postawić na murze jak inne wieże. Nazwa i opis po polsku i angielsku
- Arkusz `inspect.sh`: dach (`roof`), komin, wiatrak i żerdź liczą się teraz razem z `shell`, więc widok „przekrój bez dachów” pokazuje budynek tak, jak gra po kliknięciu
- Bot: gdy mur i narożne wieże stoją, stawia czatownię przy każdej bramie, od środka

## 0.63.2 — przycisk „Wyczyść pamięć i wczytaj grę od nowa” w menu (2026-10-28)

- **Odświeżenie gry jednym kliknięciem** (`ui/refresh.ts`): w stopce menu głównego, obok numeru wersji, przycisk wyrejestrowuje pamięć podręczną gry (service worker i jego pliki) i wczytuje stronę od nowa z serwera — bez szukania Ctrl+F5. Zapis gry, konto i ustawienia zostają
- **Menu samo sprawdza, czy jest nowsza wersja:** build zapisuje `version.json`, menu porównuje go ze swoją wersją; gdy na serwerze jest nowsza, przycisk robi się złoty i pisze „Jest nowa wersja … — wczytaj” (pulsuje lekko, bez ruchu przy `prefers-reduced-motion`). `sw.js` nie trzyma `version.json` w pamięci
- W trakcie meczu (pauza) przycisku nie ma, żeby nie przerwać gry
- Dostępność: prawdziwy przycisk, widoczny fokus klawiatury, wysokość 32 px; kontrast tekstu 13,6:1 (zwykły), 11,1:1 (nowa wersja), 14,5:1 (po najechaniu), ramka 3,8:1
- Bot: bez zmian (interfejs)
## 0.63.1 — ślady butów w dobrą stronę (2026-10-28)

- **Odciski na śniegu były obrócone o 180°** (obcas z przodu): przód podeszwy leży w teksturze u góry, czyli w −z płaszczyzny, a obrót kierował w stronę marszu +z. Teraz palce wskazują kierunek, w którym ktoś szedł (`render/footprints.ts`)
- Bot: bez zmian (wygląd)

## 0.63.0 — wielki czar magów: deszcz ognia i lodowy krąg (2026-10-28)

- **Wielki czar** (`sim/systems/greatspell.ts`): gdy co najmniej trzech wrogów stoi w kupie (w kręgu ok. 1,5 pola wokół celu), mag sam rzuca wielki czar zamiast zwykłej kuli; potem 25 s odliczania. Rzucany z ziemi w ziemię — wrogów na wieżach i murach nie sięga
- **Mag Płomienia — deszcz ognia:** mag wyrzuca w górę snop ognia, z nieba spada pięć dużych ognistych kul (jedna w środek, reszta wokół). Każdy wróg w kręgu traci zdrowie (pełny cios w środku, połowa na brzegu) i zaczyna płonąć
- **Mag Źródła — lodowy krąg:** duża kula wody rozbija się w środku skupiska, z ziemi wyrastają pierścieniem kolce lodu, stoją chwilę i topnieją z parą. Wrogowie w kręgu idą przez 16 s o połowę wolniej i tracą trochę zdrowia; płonący sojusznicy w kręgu gasną
- Pomoc („Jak grać” → Magowie bojowi) opisuje wielki czar po polsku i po angielsku
- Bot: jego magowie rzucają wielki czar na tych samych zasadach (sami, bez rozkazu)
- Testy: `tests/battle-mages.test.ts` — deszcz ognia rani i podpala kupę wrogów, lodowy krąg spowalnia wszystkich w kręgu, na pojedynczego wroga mag rzuca zwykły czar

## 0.62.0 — menu główne po lewej, jak w grach (2026-10-28)

- **Lewa kolumna** zamiast paska na dole: herb, tytuł i opis gry, pod nimi pionowa lista pozycji — na górze „Kontynuuj” (albo „Wróć do gry” w pauzie), główna „Nowa gra” w czerwonej pieczęci ze złotą krawędzią, dalej gra przez sieć, ustawienia i „Jak grać”; w pauzie na dole po odstępie „Wyjdź do menu” i „Poddaj się” (czerwonawy)
- **Interakcja:** najechanie albo przejście klawiszem wysuwa pozycję w prawo, zapala romb i czerwony pas ze złotą krawędzią; pod listą podpowiedź, co kryje wskazana pozycja; otwarte okno ma swoją pozycję podświetloną. Strzałki w górę i w dół (oraz w lewo/prawo) chodzą po liście, Enter wybiera, Esc wraca
- **Okna** (nowa gra, ustawienia, sieć, jak grać) otwierają się w prawej części ekranu, obok listy — herb i menu zostają na miejscu, za oknem widać pejzaż z zamkiem
- **Różne ekrany:** szerokość kolumny i wielkość napisów liczone od okna (od 1366×768 po 2560×1440), na niskich ekranach chowa się dłuższy opis; bez przewijania w bok
- Dostępność: pozycje to przyciski z opisem dla czytnika (`aria-description`), widoczny fokus, cele min. 46 px; kontrast pozycji 11,5:1, podpowiedzi 10,4:1, głównej na czerwieni 7:1, „Poddaj się” 9,8:1
- Bot: bez zmian

## 0.61.11 — pora roku z menu dewelopera zostaje po wczytaniu (2026-10-28)

- **Zgłoszenie:** po wyjściu z gry z zimą i wczytaniu zapisu zimy nie było. Pora roku ustawiona w menu dewelopera (`seasonShift`) nie trafiała do zapisu, więc po wczytaniu gra wracała do pory z kalendarza. Teraz jest zapisywana i wczytywana (`sim/save.ts`); stare zapisy bez niej działają jak dotąd
- Bot: bez zmian

## 0.61.10 — rudera narożna w kształcie L, 6 łóżek (2026-10-28)

- **Rudera narożna** (2×2, 17 drewna, 6 łóżek — między ruderą a chatą, `tools/models/shackl.py`): buda z krzywych desek w kształcie litery L — długie skrzydło pod tyłem działki i krótsze z lewej, na przód; w kącie między nimi mały udeptany podwórzec, z niego wejście zasłonięte skórą. Dwa płaskie dachy z desek, kamienie na deskach, szczyty z desek. W środku ciemne klepisko, skrzynka, pieniek, garnek, słoma
- Sześć posłań w miejscach zapisanych w modelu (`beds`): trzy pod tylną ścianą długiego skrzydła, trzy pod lewą krótkiego (`bedSpot` w `scene.ts` czyta je, gdy model je ma)
- Spacer: wchodzi się z podwórca przez otwór ze skórą do obu skrzydeł; mała pochodnia przy wejściu, bez chorągwi; gospodyni z najwyżej jednym dzieckiem, przy budzie kury albo (rzadko) świnia
- **Bot:** gdy brakuje łóżek, a na chatę nie ma drewna, najpierw stawia ruderę narożną (najwyżej 2), potem zwykłą ruderę i namiot

## 0.61.9 — trójwymiarowy dym i para z czarów magów (2026-10-28)

- **Dym z czarów jest prawdziwym kłębem 3D** (`render/spellsmoke.ts`): zamiast szarych, twardych kulek w jednym kolorze każdy kłąb to bryła z trójwymiarowego szumu — postrzępiony, rozwiewający się brzeg, gęstszy środek, wierzch jaśniejszy od spodu (światło z góry), z każdej strony ten sam kształt, nic nie obraca się za kamerą
- **Kula ognia:** przy trafieniu buchają na boki i w górę kłęby ciemnej sadzy, u młodego kłębu podświetlone od spodu żarem; z wiekiem szarzeją, rosną i rzedną. Dym za lecącą kulą i nad płonącym żołnierzem w tej samej technice
- **Czar wody:** przy trafieniu bucha jasna, chłodnobiała para (dotąd po czarze wody nie było nic poza kroplami), za lecącą kulą delikatna mgiełka
- Kłąb wyrasta płynnie (bez wyskakiwania) i na końcu blednie
- Wydajność: jedna siatka instancji (jedno wywołanie rysowania), najwyżej 260 kłębów, krótki marsz promienia (kłęby są małe na ekranie); bez czarów nic się nie rysuje
- Bot: bez zmian (wygląd)

## 0.61.8 — ślady butów na śniegu (2026-10-28)

- **Odciski butów** (`render/footprints.ts`): zimą, gdy leży śnieg, każdy idący chłop i żołnierz zostawia za sobą pojedyncze odciski podeszew — na zmianę lewa i prawa, wzdłuż kierunku marszu, z przodem stopy i obcasem. Odcisk to chłodny cień we wgłębieniu śniegu (nocą ciemnieje razem z resztą). Po ok. 25 s zaczyna blednąć i po ok. 40 s znika; w zamieci szybciej. Gdy śnieg topnieje, znikają razem z nim. Rozmyte wydeptane ścieżki (mapa śladów) zostają jak były — odciski widać dodatkowo z bliska
- Wydajność: jedna siatka instancji (jedno wywołanie rysowania), najwyżej 4096 odcisków w pierścieniu (nowy zastępuje najstarszy), tylko w promieniu ok. 40 pól od kamery; blednięcie liczy shader, więc co klatkę zmienia się tylko jeden mundur
- Bot: bez zmian (wygląd)

## 0.61.7 — menu główne na pejzażu z ekranu wczytywania, opis gry pod tytułem (2026-10-28)

- **Opis gry pod podtytułem** (menu i wczytywanie): „Symulator średniowiecznej osady i jej ludzi, w duchu dawnych gier RPG” i złotą linijką „Gra jest cały czas rozwijana — bez limitu” (po angielsku też)

- **Menu główne w tym samym stylu co wczytywanie:** pod herbem i tytułem pejzaż o zmierzchu (góry, słońce za przełęczą, zamek z zapalonymi oknami i chorągwią, bór), na dole ciemna listwa pod paskiem menu, iskry zostają
- Pejzaż rysuje się raz (SVG, bez animacji i bez wpływu na FPS); w pauzie w trakcie gry i przy podglądzie mapy w „Nowej grze” znika, bo pod spodem widać świat
- Kontrast: podtytuł 10,7:1, stopka z wersją 5:1
- Bot: bez zmian
## 0.61.6 — chorągwie tylko na ważnych budynkach, rudera i namiot do spaceru (2026-10-28)

- **Chorągwie:** zostają tylko na zamku, koszarach, zbrojowni, karczmie, wieżach i bramach, siedzibach magów, kapliczce, kopalni z barakiem, stodole i cechu inżynierów (`FLAG_ON` w `render/buildings.ts`). Chaty, rudery, namioty, warsztaty, magazyny, pola i sady są bez flagi — przy kilkunastu chatach las chorągwi wyglądał dziwnie
- **Rudera:** w spacerze da się wejść do środka przez otwór ze skórą (dotąd budynek był pełną bryłą); w środku ciemna, ubita ziemia zamiast jasnego pyłu; zamiast dużej pochodni na słupie przy narożniku niski kij z pochodnią przy drzwiach (`SMALL_TORCH` w `scene.ts`)
- **Namiot:** w spacerze wchodzi się od przodu, połacie i tył zatrzymują; palenisko przed wejściem zostaje zimne (bez ognia)
- Bot: bez zmian (wygląd)

## 0.61.5 — wrogie drogi da się rozkopać (2026-10-28)

- **Drogi mają właściciela** (`roadOwner` w stanie gry i zapisie; stare zapisy — drogi niczyje). Narzędziem rozbiórki zdejmujesz tylko swoje; na cudzej drodze nie położysz swojej
- **Rozkopywanie** (`sim/systems/roadwreck.ts`): zaznaczone wojsko + prawy klik na wrogiej drodze (pole bez budynku) → żołnierze idą tam i rozkopują ją. Piaskowa 30 ticków pracy jednego żołnierza (3 s), z dyli 60, brukowana 90; praca kilku żołnierzy się sumuje. W trakcie bronią się i biją wrogów w zasięgu, potem wracają do kopania. Nowy rozkaz (marsz, atak, patrol, wieża) zdejmuje kopanie. Taran nie kopie. Wróg może tak samo rozkopać twoje drogi
- **Bot:** co ok. minutę gry, gdy ma co najmniej trzech wolnych żołnierzy, wysyła dwóch na najbliższą wrogą drogę w promieniu 30 pól od swojego zamku
- Jak grać → Budowa i drogi: nowy akapit (PL/EN)
## 0.61.4 — wersja gry widoczna od razu na ekranie wczytywania (2026-10-28)

- **W prawym górnym rogu ekranu wczytywania** numer wersji i godzina buildu (np. „v0.61.4 · 28.10, 16:20”). Widać je od pierwszej chwili, jeszcze zanim wczyta się kod gry (wpisane w sam `index.html` przy buildzie), i na ekranie wejścia do meczu. Od razu wiadomo, czy przeglądarka ma najnowszą wersję, czy trzeba Ctrl+F5
- Bot: bez zmian (interfejs)

## 0.61.3 — rudera i namiot, rodziny i zwierzęta nie łażą po wodzie, jedno zwierzę na chatę (2026-10-28)

- **Dwa nowe, tańsze mieszkania** (Mieszkania w menu budowy, przed chatą): **Rudera** (2×1, 10 drewna, 4 łóżka) — buda z krzywych, poszarzałych desek na słupach jak szałasy Starego Obozu, ze szparami, przez które prześwituje, płaskim dachem z desek i skórą zamiast drzwi (`tools/models/shack.py`); **Namiot** (1×1, 3 drewna, 2 łóżka, łatwo go zniszczyć) — płachta na żerdzi i dwóch rozwidlonych kijach, kołki i odciągi, słoma w środku, palenisko przed wejściem (`tools/models/tent.py`). Chata zostaje bez zmian (8 łóżek). Chłopi odpoczywają i śpią w każdym z trzech (`DWELLINGS`), kwarantanna działa tak samo, namiot pali połowę opału chaty. Przy ruderze mieszka gospodyni z najwyżej jednym dzieckiem i ma 1–2 rzeczy na podwórku; w namiocie nie ma rodziny ani pochodni. W namiocie dwa posłania wzdłuż, obok siebie
- **Woda:** gospodyni, dzieci, kury i świnie chodzą tylko po suchej ziemi (`render/dryland.ts`): nie wchodzą do wody, na bród ani na zalany brzeg stawu (trawa przy samej wodzie jest wygładzona w dół i bywała już pod taflą). Balia, grządka i reszta podwórka też nie stają w wodzie. Gdy cel jest za wodą, staje i wybiera inny, zamiast iść przez staw
- **Zwierzęta przy chatach:** każda chata chowa jeden rodzaj (`render/yardanimals.ts`) — mniej więcej 4 na 10 chat ma kury (1–2), 3 na 10 jedną świnię, reszta nic; rudera najwyżej kury, namiot nic. Dotąd przy każdej chacie 2–3 kury plus świnia przy co trzeciej, więc 20 chat dawało stado. Gospodyni sypie ziarno tylko tam, gdzie coś jest
- Tryb deweloperski: rudera i namiot nie stoją same przy twierdzy (chaty już tam są, a nowe budy przesuwały układ osady testowej)
- **Bot:** stawia ruderę (najwyżej 3), gdy brakuje łóżek, a na chatę nie ma drewna, a w biedzie namiot (najwyżej 2); zwykłe chaty dalej z listy `ORDER`
## 0.61.2 — komnata królowej: widać ją z góry, drzwi otwarte (2026-10-28)

- **Po kliknięciu własnej twierdzy** całe piętro donżonu nad komnatą królowej (izba straży, korona z blankami, wieżyczki, dach, komin, chorągiew) znika jak zwykły dach (`shell` w `tools/models/keep.py`), więc widać komnatę z góry. Dotąd było w `base` i zostawało
- **Drzwi komnaty otwarte szeroko do środka** — skrzydło było uchylone o ok. 20° i zasłaniało wejście
- Bot: bez zmian (wygląd)
## 0.61.1 — gra nie staje przez błąd dźwięku (2026-10-28)

- **Zgłoszenie:** co jakiś czas gra zamarzała na starcie (FPS 0) z błędem `setTargetAtTime … non-finite`. Do szumu deszczu trafiała zepsuta liczba (NaN), przeglądarka rzucała wyjątek w środku pętli klatki i następna klatka już się nie zaczynała
- **Bezpiecznik dźwięku** (`audio/guard.ts`): wywołanie parametru dźwięku z NaN albo nieskończonością jest pomijane w jednym miejscu dla całego dźwięku, zamiast zatrzymywać grę; do dziennika błędów idzie ostrzeżenie `[dźwięk]` ze stosem
- **Pogoda:** zepsuta długość klatki (NaN, ujemna) nie zatruwa już deszczu, zachmurzenia i mgły; gdyby deszcz jednak wyszedł NaN, wraca do pogody z zegara i do dziennika idzie `[pogoda] deszcz NaN`
- Głośność z ustawień przeglądarki sprawdzana przy wczytaniu (śmieciowy zapis dawał NaN)
- Bot: bez zmian (dźwięk)
## 0.61.0 — nowy ekran wczytywania (2026-10-28)

- **Pejzaż o zmierzchu** na całym ekranie (`src/ui/loadscreen.ts`, rysowany wektorowo, bez plików do pobrania): góry z zachodzącym za przełęczą słońcem, na wzgórzu zamek z zapalonymi oknami i chorągwią, mgła w dolinie, z przodu ciemny bór
- **U góry** herb, złoty tytuł i podtytuł; **na dole okuta listwa** z radą, dużym procentem, paskiem i krokami wczytywania
- **Nowy pasek:** prosta okuta rama ze złotą żyłką (bez rombów i skosów na końcach), ciemny rowek z karbami co 10%, w środku płynne złoto przechodzące w żar, z połyskiem i jasną żarzącą się główką na czubku
- Ten sam ekran przy starcie strony i przy wejściu do meczu; pasek ma `role="progressbar"` z wartością dla czytnika ekranu
- Bez animowanych ozdób (wątek główny wczytuje grę) — rusza się tylko pasek; `?wczytywanie=1` zostawia ekran na wierzchu do oglądania
- Kontrast na listwie: rada 11,6:1, etykieta 13,1:1, procent 12,3:1, kroki 7,6:1; podtytuł na niebie 7,3:1
- Bot: bez zmian

## 0.60.6 — kto to jest: właściciel w oknie budynku, pionowe okucia paska wczytywania (2026-10-28)

- **Cudza twierdza i cudze budynki:** w oknie po prawej pod nazwą jest teraz linijka z właścicielem — „Wróg”, „Sojusznik” albo „Twoje” i imię (gracz z sieci, „Bot 3”, „Gracz 2”), z paskiem w kolorze drużyny. Dotąd po kliknięciu twierdzy wroga nie było widać, czyja jest
- **Pasek wczytywania:** zamiast rombów na końcach pionowe złote okucia
- Bot: bez zmian (interfejs)
## 0.60.5 — tempo gry najwyżej 3× (2026-10-28)

- **Zdjęte tempo 5×:** przyciski + i − przechodzą tylko przez pauzę, 1×, 2× i 3×; tempo na starcie z ustawień też najwyżej 3×
- Bot: bez zmian

## 0.60.5 — jedna deska budulca wszędzie, większy pasek wczytywania (2026-10-28)

- **Jedna deska budulca** (Michał: „taka sama deska, którą nosi wieśniak, leży w magazynie, leci na budowę”): `render/plank.ts` — 0,5 × 0,07, grubość 0,025. Ta sama w wiązce na ramieniu (teraz trzy deski jedna na drugiej), w stosie w magazynie, w stosach pod magazynami, na placu budowy i odbudowy oraz w gruzie (dotąd w gruzie i przy budowie były grube, szerokie deski). Deski, z których zbudowane są same budynki, zostają bez zmian
- **Ekran wczytywania:** grubszy pasek (26 px zamiast 14), większe romby na końcach, większe i wyraźniejsze napisy pod paskiem (krok, liczniki, szczegóły i lista skończonych kroków), szersza karta
- Bot: bez zmian (wygląd)
## 0.60.4 — gra wstaje także, gdy przeglądarka odmawia grafiki przy pełnych ustawieniach (2026-10-28)

- **Zgłoszenie:** u znajomego (karta RTX 3090, Chrome) gra w ogóle się nie wczytywała — „WebGL creation failed … FEATURE_FAILURE_EGL_NO_CONFIG, Exhausted GL driver options”. Gra prosiła tylko o jeden zestaw ustawień grafiki (mocniejsza karta, wygładzanie krawędzi), a gdy przeglądarka go nie dała, zostawał wieczny ekran wczytywania
- **Zapasowe próby** (`render/glcontext.ts`, wszystkie okna 3D: gra, podgląd modeli, miniatury, dalekie drzewa): po kolei bez prośby o mocniejszą kartę, bez wygładzania krawędzi, na końcu tryb awaryjny. Które ustawienia się udały, widać w dzienniku błędów („WebGL”)
- **Gdy przeglądarka nie da grafiki wcale:** zamiast wiecznego wczytywania komunikat po polsku i angielsku, co zrobić — włączyć „Używaj akceleracji grafiki” w ustawieniach Chrome i uruchomić przeglądarkę ponownie, sprawdzić `chrome://gpu`, zaktualizować sterownik albo spróbować innej przeglądarki
- Bot: bez zmian
## 0.60.3 — ciała nie leżą: zbiera je każdy, kto jest pod ręką (2026-10-28)

- **Błąd:** od 0.59.2 po ciało szło się tylko we dwóch, ale szukaliśmy wyłącznie wolnych chłopów przy ognisku. W rozbudowanej osadzie wszyscy pracują, więc nikt nie przychodził, a ciało leżało, aż zgniło (w długiej grze z botami 29 z 32 ciał gniło nieruszone). Do tego tylny niosący szedł do przedniego na skróty, po linii prostej, nawet przez mury
- **Teraz każde ciało na ziemi gracza ktoś zabiera** (`collectCorpses` w `sim/systems/bearers.ts`): przy twierdzy (40 pól) i przy każdym jego budynku (10 pól), najstarsze najpierw. Najpierw idą wolni chłopi, a gdy ich brak — dwaj najbliżsi robotnicy odchodzą na chwilę od roboty (drwal, rolnik, rzemieślnik…; nie grabarze, magowie ani kaznodzieja) i po pochówku wracają do swoich warsztatów. Najwyżej dwie takie dwójki naraz na gracza
- **Obaj idą do ciała swoją drogą** (omijają mury, wchodzą bramą), przy ciele pierwszy czeka na drugiego i dopiero wtedy podnoszą trumnę. Dwójka, która utknęła (zamknięta droga, ktoś ją odwołał), po chwili się rozchodzi, a ciało wraca do kolejki. Grabarz bez drugiego grabarza bierze do pomocy kogoś z okolicy, też robotnika
- W długiej grze z botami: 17 ciał zebranych, 6 zgniło (te leżały na polach bitwy daleko od osad)
- Pomoc „Jak grać” → Polegli: dopisane w obu językach
- Bot: dostaje to samo (jego ludzie zbierają ciała tak samo)

## 0.60.2 — mniej wywołań rysowania: odbicie wody tylko z wodą w kadrze, puste pule pomijane, budynki z daleka razem (2026-10-28)

- **Odbicie w wodzie liczy się tylko, gdy w kadrze jest woda.** Dotąd w każdej klatce gra rysowała całą scenę drugi raz do tekstury odbicia (na scenie testowej ok. 490 wywołań rysowania, tyle co sam obraz), nawet gdy w kadrze nie było ani kawałka wody. Teraz sprawdza, czy któryś kwadrat 8×8 pól z wodą (z zapasem 2 pól na płyciznę) jest w kadrze; na mapach z morzem przy krawędzi odbicie zostaje zawsze. Obraz wody bez zmian
- **Puste pule nie idą do karty:** postacie, ładunki, narzędzia, zbóje, tarany, wilki itd. rysowane są jako pule instancji; gdy pula ma zero sztuk, three.js i tak wysyłał polecenie rysowania. Na scenie testowej ok. 1/5 wszystkich wywołań klatki (w obrazie i w odbiciu). Teraz takie pule są na czas klatki chowane (`hideEmptyPools` w `scene.ts`)
- **Dalekie wersje budynków i pochodnie przy budynkach** rysują się razem dla budynków tego samego rodzaju (jak reszta brył budynku), a nie osobno dla każdego
- Modele, tekstury i wygląd bez zmian. Zasada „rysowania razem” dla nowych budynków dopisana do `CLAUDE.md`; narzędzie `tools/check/drawcalls.mjs` liczy wywołania jednej klatki według kategorii i przejść
- Do sprawdzenia w F3: „wywołania rysowania” (przed zmianą u Michała ok. 1040) i FPS
- Bot: bez zmian (sama grafika)
## 0.60.1 — poprawka: tekstury kopiowane przez JSON (spadki FPS) i błąd pór roku (2026-10-28)

- **Koniec ostrzeżeń „THREE.Texture: Unable to serialize Texture”** (u Michała ×204 w 3 minuty, przy 14 FPS): `Material.clone()` w three.js kopiuje `userData` przez JSON, a w `userData` leżały materiały — oryginał podświetlonego na czerwono budynku (cel ataku) i materiał źródłowy placu budowy. Przy każdej kopii (np. bliźniak do wnętrz w porach roku) three.js zamieniał ich tekstury na obrazki. Oryginały trzymamy teraz poza `userData`, a materiały kopiuje `cloneMaterial` (`src/render/matclone.ts`) — bez JSON, z tymi samymi teksturami
- **Błąd „Cannot read properties of undefined (reading 'noSeason')”** w porach roku: pusty slot w tablicy materiałów albo materiał bez `userData` wywracał całą klatkę — teraz jest pomijany
- Test: kopia materiału nie serializuje tekstur i zostawia te same odwołania
- Bot: bez zmian

## 0.60.0 — okno wojska w ikonach, mniej zasłania ekran (2026-10-28)

- **Szyk, marsz, postawa i patrol jako ikony** w dwóch krótkich rzędach zamiast wierszy z napisami; okno wojska jest węższe (300 px) i niższe
- **Dymek po najechaniu** (albo przejściu klawiszem Tab): nazwa grupy i opcji pogrubiona, pod nią opis, jak dotąd w napisach
- **Opis zaznaczonych i skróty (prawy klik, Shift, cyfry…) zwinięte** pod przyciskiem „Skróty i opis”; można je rozwinąć, a przy każdym nowym zaznaczeniu wojska zwijają się z powrotem
- Dostępność: przyciski z `aria-pressed` i opisem dla czytnika, rozwijanie jako przycisk z `aria-expanded`, widoczny fokus; kontrast ikon 13,8:1, wciśniętych 9:1, dymka 13,2:1
- Bot: bez zmian (tylko interfejs gracza)
## 0.59.3 — oddział nie wraca gonić chłopa po nowym rozkazie (2026-10-28)

- **Naprawione „zakodowane” wracanie pod zamek:** rozkaz „bij tego chłopa” zapisywał żołnierzom cel do gonienia aż do skutku, a zwykły rozkaz ruchu go nie kasował. Po dojściu na miejsce oddział (np. łucznicy) wracał więc gonić tego chłopa — zwykle pod wrogi zamek, gdzie chłop się schował — i tam czekał. Teraz każdy nowy rozkaz (ruch, kolejka i patrol, atak na żołnierza, budynek albo wilka, wejście na wieżę) kasuje wcześniejszy cel; atak na chłopa kasuje z kolei pogoń za wilkiem
- Test `tests/prey-order.test.ts`: łucznicy po rozkazie ataku na chłopa i potem ruchu na drugi koniec mapy stoją tam, gdzie ich wysłano
- Bot: ta sama poprawka działa dla jego oddziałów (wydaje te same rozkazy)

## 0.59.2 — zmarłego niosą dwaj, w trumnie na noszach (2026-10-28)

- **Koniec z workiem w powietrzu:** ciało nie jest już rysowane jako biały worek przed chłopem. Niosą je dwaj w prostej trumnie z desek z wiekiem, postawionej na dwóch drągach z poprzeczkami (model z Blendera, `coffin` w `tools/models/grave.py`). Obaj trzymają końce drągów opuszczonymi rękami przy biodrach — przedni z dłońmi za sobą, tylny przed sobą — a trumna wisi między nimi
- **Nikt nie niesie w pojedynkę:** po ciało idzie się tylko we dwóch. Wolny chłop spod twierdzy bierze drugiego wolnego z okolicy; bez drugiego nikt nie rusza i ciało czeka. Pomocnik (`sim/systems/bearers.ts`, faza Bearing) idzie krok w krok za niosącym, a przy pochówku w lesie kopie razem z nim (grób zostaje jeden)
- **Cmentarz ma dwóch grabarzy:** drugi grabarz pomaga pierwszemu nieść trumnę; gdy jest zajęty, pomaga wolny chłop
- Opis cmentarza i pomoc „Jak grać” → Polegli: dopisane w obu językach; trumna w podglądzie modeli (grupa „Pochówek”)
- Bot: bez zmian w decyzjach; jego cmentarze też dostają dwóch grabarzy
- Testy: pomocnik idzie tuż za niosącym, kopie z nim i wraca wolny; jeden wolny chłop nie niesie ciała sam

## 0.59.1 — fizyka gruzu: zawalony budynek rozpada się z grawitacją (2026-10-28)

- **Gruz spada naprawdę:** gdy budynek runie (ruina po ataku, pożarze, wilkach) albo zostanie rozebrany, kamienie, belki i deski spadają z wysokości budynku z grawitacją, odbijają się od siebie i od ziemi, przewracają się i leżą tam, gdzie upadły — każde zawalenie wygląda inaczej. Na zboczu gruz zsuwa się po terenie (ziemia w fizyce ma kształt mapy)
- Silnik fizyki: cannon-es (MIT, wpisany do `CREDITS.md`), wczytywany dopiero przy pierwszym zawaleniu, więc nie wydłuża startu gry. Zawalenie liczy się kilka sekund; gdy wszystko znieruchomieje, świat fizyki znika i leżący gruz nic już nie kosztuje. Naraz najwyżej 6 zawaleń (przy większej bitwie kolejne kładą gruz od razu)
- Tylko obraz: symulacja nie wie, gdzie leży który kamień, więc mecz przez sieć się nie rozjeżdża. Gruz i ruiny z wczytanego zapisu leżą od razu (bez spadania)
- Test `tests/rubblefall.test.ts`: po zawaleniu (płasko i na zboczu) żaden kawałek nie wisi w powietrzu, nie wchodzi w ziemię i nie odlatuje poza działkę; w trybie testowym `__test.raze(id)` zawala wybrany budynek
- Bot: bez zmian (sam wygląd)

## 0.59.0 — rąbanie z biedy: pień przy pniaku, deski stosem, płynne padanie drzew i numery grup (2026-10-28)

- **Obróbkę widać:** po ścięciu drzewa chłop ociosuje i tnie leżący przed nim pień (niżej, z pochyleniem nad pniem), a pień w trakcie się skraca
- **Deski leżą przy pniaku:** bez składu zostają tam prawdziwym stosem i liczą się do zapasów (wcześniej drewno dopisywało się „z powietrza”). Budowniczy przychodzi po nie i nosi ładunki na plac budowy, stos przy tym maleje; gdy stanie skład, magazynier znosi resztę
- **Budowa przed rąbaniem:** póki stoi zapłacony plac budowy, rąbiący idzie go budować (bywał jedynymi wolnymi rękami i plac stał bez budowniczych)
- **Drzewo pada płynnie:** przechył liczony z ułamkiem ticku — dotąd drzewo waliło się skokami, 10 razy na sekundę
- **Numery grup nad oddziałami i dymki nad głowami** idą płynnie za ludźmi (pozycja tak, jak są narysowani, a nie skokami co tick symulacji)
- Bot: korzysta z tego samego (jego budowniczowie też noszą deski ze stosów)
- Testy: stos desek przy pniaku; skład stawiany za deski z biedy — budowniczy nosi je ze stosu, stos maleje
## 0.58.7 — wilki nie przegryzają murów, mag i łucznik celują w wilka (2026-10-28)

- **Wilk muru nie przegryzie.** Gdy wszyscy są za palisadą, wilk podchodzi pod mur albo bramę, raz go podrapie (najwyżej 1 HP na wilka przez całą noc, nigdy nie zniszczy) i wraca do lasu. Dawniej gryzł co chwilę po 6 HP i potrafił przegryźć palisadę
- **Kursor ataku na wilku:** z zaznaczonym magiem ognia, magiem wody, łucznikiem czy piechotą najechanie na wilka daje miecz, a prawy klik wysyła na niego atak. Dawniej gra łapała tylko jeden punkt metr nad wilkiem w promieniu 26 px, więc przy zbliżeniu kursor na samym wilku nic nie pokazywał. Teraz liczy się cała sylwetka, a promień rośnie z przybliżeniem
- Opis wilka w „Jak grać” i w galerii poprawiony (PL i EN)
- Bot: bez zmian (wilki są wspólne, bot nie wydaje rozkazów myszą)

## 0.58.6 — gruzowisko leży na ziemi naprawdę: także ruiny i zbocza (2026-10-28)

- **Ruina nie lewituje:** gruz ruiny był rozciągany w pionie 1,6 raza (kamienie wysokie, belki odklejone od siebie i wiszące), a teren pod nim opadał jak przy wykopie pod budowę — stos wisiał nad dołem. Teraz ruina dostaje ten sam stos co gruz po rozbiórce, bez rozciągania i bez wykopu; w miarę odbudowy robotnicy zbierają go od góry
- **Stos leży na prawdziwym terenie:** mapa wysokości pod gruzem zaczyna się od kształtu ziemi, więc na pochyłości kawałki leżą na zboczu, a nie na płaskiej podstawce
- Sprawdzone testem (płasko i na spadku 25% i 40%): żaden kawałek nie wisi i żaden nie wchodzi w ziemię głębiej niż 3,5 cm
- Bot: bez zmian (sam wygląd)

## 0.58.5 — ogień nie razi w oczy (2026-10-28)

- **Płomienie bez przepalenia:** najgorętszy rdzeń ognia świecił prawie trzy razy ponad biel ekranu, więc pochodnie, kosze i pożary wychodziły jako białe, rażące plamy. Teraz rdzeń jest żółtopomarańczowy i tylko lekko ponad biel (wspólny shader `fireGlsl.ts`); małe płomienie dodatkowo o 20% ciemniejsze
- Poświata wokół płomieni o 40% słabsza, a nad płonącym budynkiem dużo słabsza w dzień
- Światło płonącego budynku nocą o połowę słabsze (nie oblewa już całej okolicy)
- Do tego: małe płomienie (pochodnie, kosze, ogniska) jeszcze ok. 20% ciemniejsze i z mniejszą, ciaśniejszą łuną, wszystkie lampy nocą o ok. 25% słabsze, łuna nad pożarem mniejsza, sam pożar trochę ciemniejszy
- **Świeczki i latarnie w izbach** (np. na stole w chatce) nie wyglądają już jak płonący stół: mniejszy płomyk, łuna o 2/3 mniejsza i słabsza, w dzień prawie niewidoczna; latarnie w sztolni i pochodnie w bryłach budynków też z mniejszą łuną
- Bot: bez zmian (czysto wizualne)
## 0.58.4 — prawdziwa pochodnia łucznika, łucznicy strzelają z dalej (2026-10-28)

- **Pochodnia łucznika przy strzelaniu w budynek** to teraz ta sama pochodnia z Blendera co w rękach chłopów: drewniany trzonek z teksturą i owinięta głowica, wbita pionowo w ziemię, wielkości pochodni w ręce (ok. 0,3 pola), z mniejszym płomieniem. Wcześniej był to gładki kij bez tekstury, wyższy niż trzeba
- **Łucznicy nocą nie trzymają pochodni** w ręce z łukiem (płaski kij przy łuku wyglądał jak druga, dziwna pochodnia). Nocną pochodnię niosą dalej strażnicy i co piąty żołnierz walczący wręcz
- **Łucznik strzela z dalej:** zasięg 8 pól zamiast 6, wzrok 10 pól zamiast 8 (z wieży dalej o 3 pola, jak dotąd). Nie musi podchodzić pod sam szyk wroga. Opis w „Jak grać” poprawiony
- Bot: korzysta tak samo (jego łucznicy też strzelają z 8 pól)

## 0.58.3 — groby w lesie: kopczyk z krzyżem i gorszy nastrój (2026-10-28)

- **Po pochówku w lesie zostaje grób:** kopczyk świeżej ziemi z grudami i krzyż z dwóch nieokorowanych kijów związanych łykiem, wbity w głowach (nowy model z Blendera `tools/models/grave.py` → `grave.json`, tekstury ziemi i kory; w podglądzie modeli: grupa „Pochówek”). Każdy grób leży trochę inaczej obrócony. Na jednym polu jeden grób, kolejne chłopi kopią obok
- **Grób znika:** sam po 3 dniach gry (pod koniec kopczyk osiada w ziemię) albo od razu, gdy na tym polu stanie budynek (wystarczy plac budowy) albo droga. Groby nie blokują stawiania
- **Nastrój:** póki gracz ma groby w lesie, popularność co miesiąc -1, a przy 5 i więcej -2 (nowy składnik „Zmarli pochowani w lesie (brak cmentarza)” w rozpisce popularności). Cmentarz z grabarzem tego oszczędza
- Stan gry: lista `graves` (zapis, wczytanie i skrót stanu dla gry sieciowej), system `sim/systems/graves.ts`, rysowanie instancjami w `src/render/graves.ts`
- Pomoc „Jak grać” → Polegli: dopisane w obu językach
- Bot: bez zmian w decyzjach (cmentarz ma już w kolejce budowy); jego groby psują mu nastrój tak samo
- Testy: grób powstaje pod drzewami, obniża popularność, przechodzi przez zapis, zarasta po 3 dniach i znika pod nowym budynkiem

## 0.58.2 — skrót do koszar przenosi kamerę od pierwszego kliknięcia (2026-10-28)

- **Skróty na dolnym pasku (koszary, skład, spichlerz):** po jednym kliknięciu kamera staje tak, że budynek widać obok otwartego okna, a nie pod nim. Kamera przesuwała się już przy pierwszym kliknięciu, ale budynek trafiał na środek ekranu, który zasłania okno budynku, więc wyglądało, jakby nic się nie stało (drugie kliknięcie dawało inne ujęcie i dopiero wtedy było go widać)
- Bot: bez zmian (dotyczy interfejsu gracza)

## 0.58.1 — cel ataku na czerwono, większe obrażenia, wilki pod ostrzałem, krótszy cios włócznią (2026-10-28)

- **Miecz nad wrogiem:** kursor z mieczem pojawia się nad całą sylwetką wroga — chłopa, strażnika miejskiego, łucznika, maga — od stóp po głowę, przy każdym zbliżeniu. Dawniej liczył się jeden punkt (u żołnierzy przy pasku nad głową, u chłopów metr nad ziemią), więc kursor na postaci często nie łapał celu
- **Cel ataku na czerwono:** wrogi budynek pod kursorem świeci głęboką czerwienią zamiast pomarańczu, a pod wrogą postacią (żołnierz, chłop, wilk) pulsuje czerwony krąg
- **Większe liczby obrażeń** („−4”, „−1”) nad paskiem zdrowia: ok. dwa razy większe, grubsze, z obrysem, dłużej widoczne
- **Łucznicy i magowie strzelają do każdego wilka w zasięgu** — gdziekolwiek wilk napada (u nas, u wroga, na wojsko). Strzała leci jak do ludzi, wilk dostaje dopiero, gdy doleci. Dawniej rana wchodziła od razu, bez strzału w obrazie. Strzelanie do wrogich żołnierzy i chłopów ma pierwszeństwo. Test w `tests/archer-wolf.test.ts`
- **Krótszy zasięg ciosu wręcz:** włócznik (i każdy walczący wręcz) sięga tylko sąsiada — 1,25 pola zamiast 1,5, więc nie bije już przez puste miejsce. Gdy stoi obok, a wróg jest w pół kroku, czeka albo dochodzi na środek swojego pola, zamiast odpuszczać wroga
- **Pochodnia łucznika** przy strzelaniu w budynek stoi wbita w ziemię w jednym miejscu (pół kroku przed nim, z boku) i jest wielkości pochodni, a nie człowieka. Wcześniej była „przyspawana” do łucznika: obracała się z nim przy naciągu i unosiła w powietrzu
- **Ognista strzała z daleka** nie wygląda już na większą od człowieka: mniejszy, przygaszony płomyk i zwykła szerokość smugi (różni się tylko kolorem)
- **Kursor z mieczem nad wrogim chłopem:** przy zaznaczonym wojsku najechanie na wrogiego chłopa pokazuje miecz i prawy klik wysyła żołnierzy na niego. Gra szukała chłopa w jednym punkcie metr nad ziemią (nad jego głową), więc przy zbliżeniu kursor na samej postaci nie łapał celu. Teraz trafia w całą sylwetkę, od stóp po głowę, tak samo jak zwykłe klikanie w chłopa, przy każdym zbliżeniu kamery
- Bot: kursor i podświetlenie dotyczą tylko gracza; łucznicy bota tak samo strzelają do wilków, a krótszy cios wręcz dotyczy wszystkich
## 0.58.0 — rąbanie z biedy: osada bez składu i drwala nie staje (2026-10-28)

- **Sytuacja kryzysowa:** gdy osada nie ma składu na drewno albo chaty drwala, a drewna brakuje nawet na nie (skład 15, drwal 15), jeden wolny chłop sam idzie do lasu, ścina drzewo i obrabia je przy pniu — wolno (30 s na drzewo, 5 drewna). Bez składu drewno od razu liczy się do zapasów, ze składem chłop zanosi je do niego. Gdy przy ognisku nikogo nie ma, rąbie wolny magazynier
- Rąbanie kończy się samo, gdy stoi skład i chata drwala (także w budowie) albo drewna starcza; dalej robotę robi drwal. Rąbiący macha siekierą jak drwal
- **Bot:** bez żadnego składu najpierw stawia skład, potem drwala — pobity bot z samymi sadami, spichlerzem i zamkiem znowu się podnosi
- Opis w `docs/magazyny.md` („Rąbanie z biedy”), testy w `tests/emergency-wood.test.ts`
## 0.57.5 — wilki z prawdziwych nagrań, lżej i rzadziej (2026-10-28)

- **Wycie wilków z nagrań zamiast syntezy.** Dawne wycie, „jipy” i warczenie były składane z tonów i szumu — brzmiały sztucznie. Teraz: trzy frazy prawdziwego wycia (U.S. Fish and Wildlife Service, domena publiczna) i zbiórka watahy europejskich wilków (Retron, Wikimedia Commons, domena publiczna), oczyszczone z szumu i wyrównane
- **Lżej:** z daleka wycie jest ciche, przytłumione jak zza lasu i z delikatnym pogłosem; gdy wataha jest na mapie — trochę bliżej i wyraźniej, rzadziej niż dotąd (co 40–80 s zamiast 30–60 s, z szansą na ciszę). Każde odtworzenie ma lekko inną wysokość i stronę
- **Warczenie przy ataku** z prawdziwych nagrań psów, lekko obniżonych (7 wariantów, bonebrah CC0 i congusbongus CC BY 3.0) zamiast starego, przepuszczonego przez pogłos warknięcia; rzadziej (co ok. 4,5–7,5 s na wilka zamiast 2,6–4,6 s) i ciszej
- Autorzy: Ustawienia → Dźwięk, `CREDITS.md`, `docs/zasoby.md`
- Bot: bez zmian (sam dźwięk)
## 0.57.4 — gruzowisko leży na ziemi (2026-10-28)

- **Gruz układa się jak po zawaleniu:** kamienie, belki i deski spadają po kolei na ziemię albo na to, co już leży (mapa wysokości pod stosem). Kamień siada na najwyższym punkcie pod sobą, a belka opiera się o dwa najwyższe punkty po obu stronach środka i przechyla się między nimi. Każdy kawałek stacza się w najniższe z kilku miejsc, więc stos nie rośnie w wieżę. Nic nie wisi w powietrzu i nic nie wchodzi w ziemię. Na spodzie leżą kamienie, na wierzchu deski — wynoszony gruz znika od góry
- Dotyczy gruzu po rozbiórce i ruin czekających na odbudowę (ten sam model)
- Bot: bez zmian (sam wygląd)

## 0.57.3 — pochówek w lesie, gdy nie ma cmentarza (2026-10-28)

- **Bez cmentarza chłopi chowają zmarłych w lesie:** wolny chłop, który zabrał ciało spod twierdzy, nie niesie go już do obozowiska (ani w okolice gruzowiska), tylko na najbliższy skraj lasu — wolne pole trawy tuż pod drzewami, poza drogami. Tam odkłada ciało, kopie dół łopatą (ten sam ruch co leśniczy przy sadzeniu, ok. 6 s) i wraca do obozowiska. Gdy las jest za daleko albo za wodą, zakopuje ciało tam, gdzie stoi, zamiast krążyć z nim po osadzie. Z cmentarzem wszystko po staremu: ciała trafiają na cmentarz
- Zakopujący liczy się do limitu dwóch chłopów sprzątających ciała i nie dołącza w tym czasie do buntu
- Pomoc „Jak grać” → Polegli: dopisane w obu językach
- Bot: bez zmian w decyzjach; jego chłopi chowają ciała w lesie tak samo jak gracza
- Test: ciało spod twierdzy bez cmentarza ląduje w dole na skraju lasu
- Dalej (osobna partia): mały kopczyk ziemi z krzyżem z dwóch kijów w miejscu pochówku, znikający po kilku dniach

## 0.57.2 — dziennik błędów: stos także przy ostrzeżeniach (2026-10-28)

- Ostrzeżenia w dzienniku (np. `THREE.Texture: Unable to serialize Texture`, które u Michała pojawia się co ok. 2 s) mają teraz stos wywołań, więc po skopiowaniu dziennika wiadomo, który kod je woła. To ostrzeżenie znaczy, że coś zamienia materiał albo teksturę na JSON — przy teksturach rysowanych na płótnie to kosztowne (kodowanie obrazka do PNG), więc warto znaleźć źródło
- Bot: bez zmian

## 0.57.1 — poprawka: pochodnia nie świeci nad gruzem (2026-10-28)

- **Zburzony budynek nie ma już pochodni w powietrzu:** gruz i plac budowy nie zapalają pochodni (`torches.ts`), a rysowanie płomieni i pula świateł pomijają zburzone budynki. Znaczniki pochodni i latarni zapamiętane z dawnego modelu są sprawdzane, czy jeszcze do niego należą i są widoczne — po przebudowie modelu szukamy ich od nowa, zamiast świecić w miejscu odpiętej części
- Test: gruz po zburzonym budynku nocą nie ma zapalonej pochodni
- Bot: bez zmian

## 0.57.0 — ogień na budynku, osmalenie, ludzie odsuwają się od pożaru (2026-10-28)

- **Ogień siedzi na budynku:** obrys pożaru liczony z działki (pól), a nie z modelu ze snopkami i gratami dookoła; płomienie liżą ściany i połacie dachu (zwężają się ku kalenicy), nad dachem tylko krótkie języki. Dużo słabsza jasność i więcej pomarańczu — w dzień nie ma już bladej, prześwietlonej plamy wylewającej się na podwórko
- **Wolniej:** płomienie unoszą się spokojniej (pożary, pochodnie, ogniska), gorące miejsca wędrują po dachu wolniej, a pożar rozpala się stopniowo — ok. 15 s od pierwszych języków do pełnego ognia
- **Osmalenie** (`src/render/scorch.ts`, stan `scorch` w symulacji): póki budynek płonie, na ścianach i dachu przybywa czarnych plam sadzy z zaciekami w górę (pełne po ok. 100 s palenia). Po ugaszeniu zostaje i schodzi dopiero z naprawą — w miarę, jak inżynier łata budynek; przy pełnej wytrzymałości znika. Zapisuje się w stanie gry, więc wszyscy gracze widzą to samo
- **Ludzie odsuwają się od ognia:** kto nie gasi, a stoi w odległości 2 pól od płonącego budynku, odchodzi kilka pól dalej (w stronę od ognia) i chwilę tam czeka, zanim wróci do roboty. Gaszący z wiadrami podchodzą normalnie, przechodzący drogą idą dalej
- Bot: bez zmian w decyzjach; jego ludzie odsuwają się od ognia tak samo jak gracza
- Testy: osmalenie rośnie przy pożarze, zostaje bez naprawy i schodzi z naprawą; człowiek przy płonącej ścianie odchodzi


## 0.56.2 — obozy zbójów na uboczu mapy (2026-10-28)

- **Obozy zbójów nie stoją już przy zamkach:** nowa wersja generatora map (7) stawia polanę z obozem w lesie przy krańcu mapy, tuż przed górami, co najmniej jedną trzecią mapy od każdego zamku (na 1 na 1 zwykle 70–100 pól), a z możliwych miejsc wybiera najdalsze od zamków. Dotąd obóz stał 26–40 pól od własnego zamku. Mapa dalej jest symetryczna (obie drużyny mają tak samo daleko)
- Zbóje z dalekiego obozu sięgają na napad do skraju najbliższej osady (odległość do zamku + 12 pól), więc napady na drwali i chłopów w lesie zostają; pod sam zamek dalej nie idą
- Stare zapisy grają na swojej dawnej mapie (generator 6) bez zmian
- Bot: bez zmian (obozy są neutralne, bot ich nie stawia). Test w `tests/bandits.test.ts`

## 0.56.1 — ogniste strzały w budynki, pochodnia łucznika (2026-10-28)

- **Widać lot strzały w budynek:** łucznik strzelający w budynek (na rozkaz, prawy klik na wrogi budynek) wypuszcza widoczną strzałę, a obrażenia liczą się dopiero, gdy doleci — tak jak przy strzałach w ludzi. Strzały rozkładają się po ścianach i dachu, a nie wbijają w jeden punkt. To samo dla czarów magów w budynki (kula leci, ogień podpala po trafieniu)
- **Strzały w budynki są ogniste:** gdy łucznicy biorą na cel budynek, jeden z nich (także w dzień) wbija obok siebie w ziemię zapaloną pochodnię i od niej odpala strzały cały oddział. Pięciu łuczników = jedna pochodnia, pięć ognistych strzał; samotny łucznik ma swoją. Każda trafiona drewniana chata zaczyna się palić (gaszą ją ludzie z wiadrami). Kamień (mury kamienne, kamienne wieże, twierdza) nie płonie; drewniane mury i bramy też nie zapalają się od strzał (dostają tylko obrażenia)
- Bot: korzysta tak samo (jego łucznicy też strzelają w budynki ogniście). Test w `tests/army.test.ts`

## 0.56.0 — prawdziwy ogień: pożary budynków i płomienie jako bryły 3D (2026-10-28)

- **Pożar budynku to teraz prawdziwy ogień w trzech wymiarach** (`src/render/blaze.ts`): zamiast kilku płaskich płomyków, które obracały się z kamerą, wokół płonącego budynku stoi niewidoczna bryła, przez którą promień z oka zbiera ogień z unoszącego się w górę szumu. Ogień bucha z całego dachu i wychodzi nad nim w języki, liże ściany od zewnątrz, przechyla się z wiatrem, a gorące miejsca wędrują po budynku (część dachu pali się mocniej). Nad płomieniami gęsty, czarny dym. Przy gaszeniu ogień płynnie przygasa razem z siłą pożaru. Z każdej strony i wysokości wygląda tak samo — nic się nie obraca
- **Pochodnie, ogniska, kosze, koksowniki, ogniste strzały i kule magów** też są bryłami ognia (ten sam shader, `src/render/fireGlsl.ts`), a nie kartkami zwróconymi do kamery; poświata zostaje okrągła
- Płonący budynek nocą oświetla otoczenie (pierwszeństwo w puli świateł), iskry i dym idą z jego wierzchu, a nie z wysokości 1,1 nad środkiem
- Kamera w środku pożaru (spacer): ogień rysuje się od środka, nie znika
- Bot: bez zmian (czysto wizualne)

## 0.55.4 — strzała leci w człowieka na murze, rozkaz ataku na chłopa (2026-10-28)

- **Strzały i czary celują w narysowaną postać:** do wroga na koronie muru, na murach zamku albo na wieży strzała leci w pierś postaci (pozycja z obrazka), a nie w ziemię i mur pod nią. Dotąd cel liczył się tylko dla ziemi i wieży, więc do wroga na murze strzała wbijała się w lico muru, choć trafienie i obrażenia liczyły się poprawnie. To samo dla celowania w chłopów (wysokość jak ich postać)
- **Ręczny atak na wrogich chłopów działa:** prawy klik na wrogiego chłopa przy zaznaczonym wojsku — żołnierze go gonią i biją, zamiast od razu odwracać się do najbliższego wrogiego wojaka (rozkaz przegrywał z samym szukaniem celu, więc chłopów dało się bić tylko odruchowo). Test w `tests/army.test.ts`
- **Jaśniejszy komunikat o wozie z surowcami:** zamiast „Sojusznik odpadł — wóz wrócił do zamku (60 × kamień)” jest „Wóz nie dojechał do: [gracz] — ten gracz przegrał albo wyszedł z gry, więc nie miał kto go odebrać. Ładunek wrócił do Twoich zapasów (kamień: 60)”. We wszystkich komunikatach o wozach ładunek zapisany jako „kamień: 60” (po angielsku tak samo)
- Bot: bez zmian (bot nie wydaje rozkazów na konkretnych chłopów; poprawka grafiki strzał dotyczy też jego łuczników)
## 0.55.3 — dużo więcej muzyki średniowiecznej, bez starych skrzypnięć (2026-10-28)

- **Muzyka: 33 utwory zamiast 6.** Doszło 27 darmowych utworów z OpenGameArt (CC0 i CC BY): 16 na dzień (flety, lutnie, piszczałki, rondo, targ, żniwa), 8 na noc (lamenty, chorał mnichów, smyczki, lutniowa pieśń Johna Dowlanda z 1597 r.), 5 na bitwę, kilka do menu. Gra nie powtarza ostatnio granych utworów, dopóki w danym nastroju są inne
- **Koniec meczu ma własną muzykę:** przy wygranej gra raz utwór zwycięstwa, przy porażce — porażki, potem cisza do menu albo nowej gry (`musicEnd` w `audio/sfx.ts`)
- Wszystkie pliki przekonwertowane do OGG i wyrównane głośnościowo; chorał „Wendale Abbey” celowo ciszej, jak chciał autor
- Autorzy: Ustawienia → Dźwięk (po polsku i po angielsku), `CREDITS.md` i `docs/zasoby.md` z odnośnikami i licencjami — autorzy utworów na CC BY są podpisani, jak wymaga licencja
- **Usunięte stare dźwięki:** piskliwe skrzypnięcie drzwi grane przy młynie co 3,5 s (brzmiało jak skrzypiące wiadro w wiosce) — młyn jest teraz cichy; skrzypienie wrót, kraty i włazu do kopalni gra ciężkie drewno z 0 A.D. zamiast starego nagrania Kenneya; wyłączona stała pętla szumu Kenneya (`ambience`), która grała pod ptakami i świerszczami od początku gry. Skasowane nieużywane pliki: ambience, break, walking, chop, coins, creak-1…3, mine-0…2, smith-0…2, swing-0…2
- Bot: bez zmian (sama muzyka i dźwięk)
## 0.55.2 — poprawka: gra stawała (0 FPS) po błędzie WebGL (2026-10-28)

- Wprowadzone w 0.54.9 samoczynne namierzanie błędów WebGL po pierwszym błędzie sprawdzało błąd po **każdym** wywołaniu karty graficznej przez 30 s. Każde takie sprawdzenie czeka, aż karta skończy pracę, więc obraz praktycznie stawał (0 FPS). Wycofane: dokładne miejsce błędu WebGL tylko na życzenie, z `?gldebug=1` (jak przed 0.54.9). Reszta rozbudowanego dziennika zostaje
- Bot: bez zmian
## 0.55.1 — gruzowiska bez dymu, porzucone ruiny i gruz znikają po 5 minutach (2026-10-28)

- **Gruzowisko po prostu leży:** kurz nad ruiną i placem budowy unosi się tylko wtedy, gdy ktoś przy nich pracuje (odbudowa albo pokazowa budowa) — wcześniej porzucona ruina dymiła w kółko
- **Rozpad po 5 minutach gry:** ruina, której nikt nie odbudowuje (ani nie niesie na nią materiału, ani nie rozbierają jej saperzy wroga), rozpada się i znika bez gruzu, a działka jest znowu wolna. Stos gruzu po rozbiórce, którego nikt nie wynosi, też znika po 5 minutach — z resztą leżących w nim surowców. Każdy, kto zacznie przy nich pracę, liczy czas od zera (`sim/systems/decay.ts`, `RULES.decayTicks`, test `tests/decay.test.ts`)
- Bot: ta sama zasada dla jego ruin i gruzu (bez zmian w kolejności budowy)

## 0.55.0 — wczytywanie bez zastoju przy budowie świata, cienie nowych budynków bez przycięcia (2026-10-28)

- **„Budowanie świata i osady” etapami:** przy wejściu na stronę teren pierwszego świata (z zapisu albo nowy) buduje się w ok. 20–25 krokach z przerwą na klatkę, a nie jednym ciągiem (dotąd strona stała ok. 2 s, a pasek ani licznik się nie ruszały). Pod paskiem widać numer etapu terenu. Najdłuższy etap to ok. 0,25 s (pomiar w przeglądarce bez karty graficznej). Kamera z zapisu ustawia się po zbudowaniu terenu, jak dawniej. Tryb testowy `?test=1` buduje świat od razu, jak dotąd (pomocniki `__test` zakładają gotowy świat)
- **Cień nowego rodzaju obiektu bez przycięcia:** gdy w grze pojawia się coś nowego (pierwsza wieża, brama, plac budowy), gra kompilowała zawczasu tylko zwykłe shadery; shader cienia three.js kompilował przy pierwszym rzucie cienia, w środku rysowania, i obraz stawał na chwilę. Teraz `precompile.ts` zleca karcie także shadery cienia (na „bliźniakach” materiałów cienia ustawionych dokładnie jak w three.js) i obiekt czeka w ukryciu, aż będą gotowe. Sprawdzone w przeglądarce bez okna: przy pierwszym rysowaniu cienia nie dochodzi już żaden nowy program (zwykły materiał, z przezroczystością i przycinany płaszczyzną)
- Bot: bez zmian
## 0.54.10 — większa kamienna brama, sztywne wejście budynku, stawianie bez przycinek (2026-10-28)

- **Kamienna brama dwa razy większa:** przejazd na całą szerokość pola (1,0 zamiast 0,56) i dwa razy wyższy łuk, wyższa korona i baszty (smuklejsze, stoją na skraju sąsiednich przęseł muru), więcej klińców w łuku, wrota z trzema ryglami. Pole w symulacji bez zmian (dalej 1 pole w murze)
- **Strzałka wejścia nie przeskakuje:** wejście jest zawsze na środku frontu, przed drzwiami modelu (strona wg obrotu). Gdy to pole jest zajęte, budynku tam nie postawisz (czerwony podgląd, komunikat „Wejście zastawione”) — dawniej wejście uciekało na inny bok. Stare zapisy i osada startowa zachowują dawne szukanie po bokach
- **Stawianie tam, gdzie stoi podgląd:** klik przy budowaniu bierze pole pod podglądem, a nie mur czy dach, w który akurat celował kursor (wcześniej celowanie w mur odrzucało budowę, mimo że podgląd stał na wolnych polach)
- **Mniej przycinek przy stawianiu i budowie:** wykop i wyrównanie terenu wysyłają na kartę tylko zmienione wiersze pól, nie cały teren (kilka MB za każdym razem); przycięte materiały placów budowy wracają do puli zamiast być zwalniane (shader nie kompiluje się od nowa przy każdej budowie), a ich shadery zlecane są w tle już w fazie wykopu
- Bot: bez zmian w kolejności budowy; korzysta z tego samego sztywnego wejścia co gracz
## 0.54.9 — dziennik błędów gotowy do wklejenia, poprawka przeciągania (2026-10-28)

- **Błąd `setPointerCapture` (InvalidStateError) naprawiony:** kamera i minimapa przechwytują wskaźnik przy przeciąganiu; gdy przycisk był już puszczony w chwili kliknięcia (kliknięcie wysłane programowo, np. przez rozszerzenie, albo przełączenie okna), przeglądarka rzucała wyjątek. Teraz przeciąganie działa wtedy bez przechwycenia, bez błędu
- **„Kopiuj dziennik błędów” daje wszystko do naprawy bez dopytywania:** numer wersji i build, adres, przeglądarka i system, ekran i okno, rdzenie, karta graficzna, stan gry (ekran, tryb, mapa, tick, liczba ludzi/wojska/budynków, wątek symulacji, jakość grafiki, FPS, spacer/kopalnia) oraz **pełny stos wywołań** każdego błędu (dotąd tylko 3 linijki)
- **Mapy źródeł przy każdym wdrożeniu**, ale nie na stronie: build je robi, a wdrożenie odkłada jako artefakt „sourcemaps” w GitHub Actions (30 dni). `node tools/check/stack.mjs dziennik.txt` zamienia pozycje typu `main-XXXX.js:203:50373` na plik i linię w `src/` (np. `src/render/camera.ts:232`), mapy bierze z `dist/` albo ściąga przez `gh`
- **Błędy WebGL namierzają się same:** po pierwszym błędzie WebGL gra przez 30 s sprawdza każde wywołanie karty graficznej (potem tylko granice przejść rysowania), więc gdy błąd się powtórzy, dziennik pokaże dokładne wywołanie z argumentami i stos — bez ponownego wchodzenia z `?gldebug=1`
- Zgłoszony błąd `INVALID_VALUE` nie dał się odtworzyć w przeglądarce bez karty graficznej (uboga grafika, `?gldebug=1`: 0 błędów) — prawdopodobnie zależy od pełnej grafiki albo karty; przy następnym wystąpieniu dziennik już pokaże miejsce
- Bot: bez zmian
## 0.54.8 — menu pauzy z podglądem gry, twórcy w zakładce Autorzy (2026-10-28)

- **Menu pod Esc w trakcie gry wyraźnie różni się od menu głównego:** pod spodem widać wstrzymaną osadę (rysowaną na żywo — woda, ogień i niebo się ruszają, symulacja stoi), tło jest tylko lekko przyciemnione, bez iskier i herbu, wokół ekranu złota ramka, a pod nazwą gry napis „Gra wstrzymana” / „Game paused”. Menu główne (start, po wyjściu z gry) bez zmian — zasłania świat jak dotąd. W meczu przez sieć bez zmian (czas leci dalej)
- Ustawienia → Autorzy: nowa sekcja „Twórcy gry” na górze — Michał Szapiel (twórca gry i założyciel SuroCrave) i Mikołaj Szymczak (najlepszy tester i twórca nowych pomysłów), po polsku i po angielsku. To samo na początku `CREDITS.md`
- Bot: bez zmian (sam wygląd menu)

## 0.54.7 — symulacja szybsza o ok. 30–37% w dużych grach (2026-10-28)

- **Żołnierze i chłopi nie przeglądają już całej mapy w każdym kroku.** Zmierzone profilem na długiej grze 4 na 4: najwięcej czasu symulacji zjadało szukanie wrogiego chłopa przez każdego żołnierza (w każdym kroku po wszystkich chłopach na mapie) i rozglądanie się chłopów (każdy chłop po wszystkich żołnierzach, odważni dodatkowo po wszystkich chłopach). Teraz patrzą tylko na sąsiednie kwadraty mapy (`sim/spatial.ts`, kubełki 8×8 pól — jak już przy szukaniu wrogich żołnierzy)
- **Wynik gry dokładnie ten sam:** przy remisie odległości wygrywa ten sam chłop albo żołnierz co dawniej (wcześniejszy na liście). Sprawdzone narzędziem `tools/check/simprint.mjs` — cztery długie gry z botami (1v1, 2v2, dwie 4 na 4, po 12–15 tys. kroków) dają identyczny zapis stanu przed i po zmianie
- Czas tych gier: 4 na 4 10,1 s → 7,2 s i 6,1 s → 3,8 s, 2 na 2 3,2 s → 2,3 s, 1 na 1 1,07 s → 0,88 s. Zysk rośnie z liczbą ludzi i żołnierzy na mapie
- Ten sam kod liczy u wszystkich graczy w meczu przez sieć, więc mecz online też zyskuje (bez rozjazdu stanu)
- Najwięcej czasu symulacji bierze teraz szukanie dróg (ok. 1/4, głównie armia, praca chłopów i sprawdzanie, czy budynek nie zamknie przejścia) — to już sam algorytm, dalsze przyspieszanie w osobnej partii
- Bot: bez zmian (ta sama logika, szybciej liczona)
## 0.54.6 — więcej rdzeni procesora: tryb deweloperski w osobnym wątku, tekstury rysowane naraz (2026-10-28)

- **Tryb deweloperski liczy symulację w osobnym wątku**, tak jak zwykła gra z botami. Dotąd w trybie deweloperskim ekonomia, ścieżki, walka i boty liczyły się na tym samym rdzeniu co rysowanie, więc duża bitwa zabierała klatki. Akcje panelu dewelopera (surowce, przewiń do nocy/dnia, pora roku, postaw jednostki, wróg pod wieżą, pożar, leczenie, usuń wrogów, wygrana) zmieniają stan w wątku głównym i od razu wysyłają go do wątku symulacji (`resyncSim` w `main.ts`). Porcja kroków, która właśnie się liczyła, jest odrzucana i liczona jeszcze raz od nowego stanu, z tymi samymi poleceniami gracza — nic nie ginie (`sim/simbatch.ts`, test `tests/simbatch.test.ts`). Gdy wątek padnie, jego polecenia przejmuje wątek główny (dotąd mogły przepaść)
- **Pierwsze wejście: tekstury z kodu rysuje kilka wątków naraz**, każdy na innym rdzeniu (`render/texworker.ts`, OffscreenCanvas). Rysunek wychodzi piksel w piksel taki sam jak w wątku głównym (sprawdzone dla wszystkich wzorów; jedyny wyjątek to łupek z drobną różnicą wygładzania krawędzi, ale w zwykłej grze łupek jest ze zdjęcia, rysowany jest tylko w uboższej grafice `?test=1`). Kod wzorów przeniesiony bez zmian do `render/texpaint.ts` (bez three.js), więc wątki są lekkie. Po pierwszym wejściu tekstury i tak są z pamięci przeglądarki
- Wczytywanie: zdjęciowe tekstury (z plików) nie czekają już każda na klatkę przerwy przy pasku — kilkanaście klatek mniej na ekranie wczytywania
- Bez zmian: mecz przez sieć nadal liczy w wątku głównym (osobna partia), tryb testowy `?test=1` też (jak dotąd, `&watek=1` wymusza wątek)
- Bot: bez zmian (ta sama symulacja, tylko w innym wątku)
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

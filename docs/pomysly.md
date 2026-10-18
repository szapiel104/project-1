# Pomysły i rzeczy na później

Tu trafia wszystko nowe, co nie należy do bieżącej partii. Do planu etapów (`plan.md`) przenosimy stąd, gdy przychodzi na to kolej.

## Zgłoszone przez Michała

- **Progresja gracza (16.10.2026):** postać pana na zamku z poziomami i doświadczeniem (także za przegrane), drzewko umiejętności, tytuły, herb, nagrody na start, ranking, wyzwania, sezony, później świat/rody (MMO). Cały plan i partie: `docs/progresja.md`.

- Menu główne w klimacie Twierdzy z ekranem ładowania, ustawieniami i wszystkimi funkcjami gry (w planie jako etap 3)
- Poziomy graczy, konta, ulepszenia postaci, zamków i budowli (w planie: etapy 5 i 8)
- Zarabianie: mikropłatności i reklamy (po wersji, która trzyma graczy)
- Docelowa nazwa gry zamiast „Project‑1”

## Braki zauważone przy pracy

- Balans gospodarki wymaga strojenia na prawdziwych rozgrywkach
- Test dotyku na prawdziwym telefonie i tablecie (dotąd tylko emulacja)
- Budynki nie mają paska stanu ani informacji, co produkują i jak szybko
- Przy dużych bitwach wyszukiwanie drogi trzeba będzie przerobić na wspólne ścieżki dla grup
- Akcje GitHub używają wersji z ostrzeżeniem o Node 20, do podbicia

## Ulepszanie budynków (12.10.2026)
- Budynki będą miały poziomy ulepszeń; każdy poziom musi być widać na modelu: dochodzą detale (płot, skrzynie, beczki, flagi, dobudówki, lepszy dach, kamienna podmurówka).
- Model bazowy z paczki KayKit + detale z tej samej paczki (crate, barrel, fence, flag) i z kodu; poziom zapisany w stanie budynku, model składany z części zależnie od poziomu.

## Pory roku — dalej (16.10.2026)
Zrobione 16.10: pory roku i temperatura pod zegarem, dym z kominów zależny od zimna i pracy, opał zimą, zimno i brak opału obniżają popularność, przyciski pór roku w menu dewelopera. Wygląd pór roku: śnieg na ziemi i dachach, szron o świcie, rude liście jesienią, gołe drzewa zimą, ślady ludzi i wilków na śniegu (znikają po 1–2 min).

Zrobione 16.10 wieczorem: skryba przed zimą — zapowiedź na początku jesieni, ok. 1,5 dnia przed zimą rachunek drewna na opał i jedzenia (z ostrzeżeniem, gdy brakuje), krótka wiadomość, gdy zima przychodzi.

Czeka:
- Zboże i sad: zimą nie rosną (farma i sad stoją), wiosną siew, latem zbiory
- Rybak zimą łowi mniej (lód przy brzegu)
- Ludzie zimą chodzą w grubszych ubraniach, para z ust

## Lista na kolejne partie (12.10.2026) — Claude podpowiada z niej, gdy Michał pyta „co dalej”
Kierunek: klimat Gothic 1/2 — surowo, brudno, mroczno, żywy świat.

Zrobione 12.10: palisada, brama (otwieranie, sama się zamyka), wieża, wilki (polują, przegryzają mur), ruiny do odbudowy, odzywki ludzi, błoto i kałuże, kruki na ciałach, alarmy ataku, tryb deweloperski.

Czeka:
- Kości przy cmentarzu, więcej brudu (śmieci, gnój przy chlewie)
- **Zbóje z puszczy (18.10, partia 1 zrobiona — 0.28.0):** obozy na polanach (generator map 5), napady na drwali i chłopów z dala od zamku, rabunek rudy i drewna, łupienie wozów bez eskorty, rozbicie obozu wojskiem = łup dla gracza. Dalej:
  - Partia 2: własny model zbója z Blendera (skóry, kaptur, topór/maczuga, bez tarczy) zamiast przyciemnionego włócznika; odzywki zbójów jak w Gothicu
  - Partia 3: obóz rośnie, gdy nikt go nie rusza (więcej zbójów, mocniejsza zasieka), napady na wozy sojuszników i na kopalnię; bot rozbija obozy
  - Do decyzji: obozy wroga (drugi gracz) zamiast samych fal; czy zbójów można przekupić rudą
- **Kopalnia jak w Gothic (17.10, partia 1 zrobiona — mechanika):** jedna „Kopalnia” 3×3 stawiana tyłem do skały (pola gór za budynkiem), zastępuje kamieniołom i kopalnię żelaza (stare zostały tylko dla zapisów). Załoga 1 + 1 na 4 mieszkańców (do 8), kopią w środku, z kursu wychodzi kamień 58% / żelazo 34% / ruda 8% (nowy surowiec „ruda” do składu), wszystko noszą do wioski. 360 hp, wróg poluje na górników. Bot stawia ją pod górami.
  - Partia 2 (17.10, pierwsza wersja wdrożona — do oceny Michała): sztolnia z Blendera (tools/models/mine.py) — portal w zboczu, skalny garb w polach gór, korytarz z przodkami, stemplami, wózkiem i lampami; miejsca pracy w modelu (klucz `spots`), górnicy kopią przy ścianach; wejście w spacerze z kolizjami; teren pod górą nie spłaszczany (`view.level`), pola gór w obrysie sztolni dostępne w spacerze; wnętrze rysowane tylko z bliska (LOD).
  - Partia 4 (17.10, zrobiona): wnętrze kopalni jako osobna lokacja (tools/models/minelevel.py, pod mapą na y −80): korytarz z obudową, hala z wózkami, filarem i rusztowaniem, dwa chodniki z przodkami; wejście z portalu albo przyciskiem „Wejdź do kopalni”, wyjście wrotami na końcu korytarza albo Esc; górnicy kopią w środku przy przodkach. Partia 5 (17.10, zrobiona): niższy poziom — wnęka z szybem i kołowrotem w hali, drabina (wspinaczka w spacerze), komora pod szybem i głęboka galeria z wielkimi złożami, kryształową iglicą i podziemnym jeziorkiem; załoga kopie na zmianę na obu poziomach, dłuższe kursy (15 s, większy urobek), więc w środku widać więcej ludzi; w sztolni kapanie wody z echem i stuk kilofów zamiast łąki; wróg w promieniu 7 pól od kopalni = alarm: górnicy uciekają pod barak (bez baraku do zamku) i czekają, aż wróg odejdzie; spacerowicz w sztolni dostaje ostrzeżenie, a gdy kopalnia padnie, wychodzi na powierzchnię. Dalej: wróg wchodzący do sztolni i walka w środku, więcej poziomów, winda na kołowrocie.
  - Partia 3 (17.10, zrobiona): barak górników (minecamp: nocleg 8 pryczy, ognisko wieczorem, urobek do 60 szt. pod barakiem, wóz do zamku z 2 strażnikami kopalni, którzy chronią go przed przechwyceniem); ruda zastąpiła złoto jako waluta (jak w Gothicu, w kodzie dalej 'gold'). Pierwotny opis: — załoga nocuje w obozowisku/baraku obok zamiast wracać do wioski (bez noclegu wraca); eskorta: dwóch strażników odprowadza górników z urobkiem do wioski; co zrobić z rudą (huta → złoto?).
- Dźwięki: zrobione 16.10 z nagrań — ptaki, świerszcze, odgłosy wsi, kury, dzwon w południe, róg alarmu, grzmot (docs/zasoby.md). Czeka: kogut o świcie i prawdziwy puszczyk (brak nagrania na wolnej licencji pod ręką), trzask ognisk, gwar, wiwaty
- Wojsko: zbrojny (łucznik, łuczarz, taran, kamienne mury, drabiny i kamienna wieża już są)
- Wnętrza pozostałych budynków w stylu nowej chaty
- ~~Leśniczy~~ — zrobione 18.10.2026 (chata leśniczego, sadzonki rosną dwa dni w las). Dalej: ulepszenie chaty (większy teren, więcej sadzonek), wybór miejsca sadzenia przez gracza
- Bot dalej: kamienne mury, taran, lepszy wybór celów, poziomy trudności dopracowane (zrobione: palisada, wieże, łucznicy na wieżach, karczma, atak z dwóch stron, wypady)
- Ulepszanie budynków (wyżej)

## Klimat i poprawki (12.10, popołudnie)
Zrobione: muzyka w tle (dzień/noc/bębny przy ataku), księżyc, gwiazdy i chmury w deszczu, wnętrza drwala/włóczniarza/łuczarza/piekarni/inżynierów w stylu chaty, karczma, spacer oczami chłopa, okno wydajności (F3).

Zrobione wieczorem: mgła przy ziemi, dym z kominów (nocą podświetlony), iskry nad ogniskami i pożarami, świecące okna, wydeptana ziemia przy domach i ścieżki chłopów; konta, lobby gier 1v1/2v2/4v4 z botami, mecz przez sieć.

Czeka — klimat:
- Śmieci, beczki, worki i siano przy domach (sama wydeptana ziemia już jest)

Zrobione 13.10: czat w pokoju i w meczu (Enter), ranking i historia meczów (tabela results), link zaproszenia, znajomi (dodawanie po nicku, kto jest w grze, zaproszenia), gracz bez połączenia uznany za wychodzącego po 15 s (milczący po 45 s).

Zrobione 16.10: znaczniki dla drużyny (Alt + klik, boty-sojusznicy też słuchają), wóz z surowcami dla sojusznika (do przechwycenia), kooperacja „Razem przeciw botom”.

Czeka — gra przez sieć:
- Gracz, który wyszedł z meczu, oddaje miasto botowi
- Powrót do meczu po zerwaniu połączenia (odświeżenie strony)
- Szybka gra (dobór przeciwnika o podobnym rankingu, po 30 s bot), sezony i ligi, powtórki i oglądanie na żywo (lockstep: powtórka = lista poleceń)
- Eskorta wozu: zaznaczone wojsko idzie za wozem

Czeka — poprawki:
- Czytelność nocy: pochodnie o większym zasięgu jako opcja
- Wszystkie panele w grze (dolna belka, okna budynków, skryba, alarm) w stylu nowego menu: ciemna skóra, złote żyłki, napisy Cinzel (menu i wczytywanie zrobione 13.10)
- Pełny magazyn: dziś robotnik po chwili wyrzuca nadmiar (przepada) — do decyzji, czy ma czekać

## Wydajność — do zrobienia (13.10.2026, gra dla wielu graczy w przeglądarce)
Zrobione 13.10 wieczorem: daleki las jako obrazki z 8 stron, Service Worker z pamięcią plików gry, zapamiętane miniatury budynków.

Zrobione 13.10: kawałki roślinności 40×40 z odrzucaniem poza ekranem, poziomy szczegółów (drobiazgi znikają daleko, świerki i liściaste przełączają się na proste modele), rzadsza puszcza daleko, kępy trawy bez cieni, siatka gór za mapą indeksowana i rzadsza w oddali, tekstury terenu z numerem wersji.

Zrobione 13.10 wieczorem: automatyczna jakość (5 poziomów: cienie, AO, rozdzielczość, zasięg trawy; schodzi przy < 45 FPS, raz na sesję próbuje wyżej, poziom zapamiętany; wyłącza się po ręcznej zmianie grafiki).

Zrobione 14.10: przegląd długiej gry (tools/soak), boty myślą w różnych tickach, szybsze sprawdzanie blokowania przejść, krzaki i drzewa z daleka lżejsze, góry za mapą bez cienia (karta graficzna ok. 10 → 7,5 ms na klatkę w widoku osady).

Zrobione 16.10: mapa 1 na 1 192 pola (zamki ok. 100 pól od siebie), leśne ścieżki z generatora (sieć do środka, złóż, lasów i skraju świata; chłopi wolą nimi chodzić), polany w puszczy, wiatr w krzakach, budynki rysowane razem. Mapy (generator 2): rzeki z brodami między drużynami, łagodne wzgórza i leśne ścieżki są już na wszystkich trybach (sprawdzone 17.10).

Zrobione 15.10: daleka wersja budynków (LOD, 3 poziomy, próg zależny od jakości), okno F3 z czasem karty na przejście (cienie, scena, AO, poświata) i listą najcięższych rzeczy.

Dalej (zmierzone 14.10 w Chrome, widok osady: ok. 2,7 mln trójkątów w scenie, 4 mln z cieniem, ok. 1180 wywołań rysowania):
- Kępy trawy (28 trójkątów) i korony liściastych (200) to razem ok. 750 tys. trójkątów — rzadsze z daleka albo obrazki
- Ok. 1180 wywołań rysowania: kawałki lasu po kilkanaście rodzajów na kawałek, w cieniu drugi raz — BatchedMesh albo większe kawałki

- Zrobione 16.10: pniaki tylko po ścięciu, zastępcze bryły cienia roślinności (warstwa „tylko cień”, src/render/shadowlayer.ts), lżejsze kwiaty, ładunki tylko u niosących.
- Zrobione 17.10: AO w połowie rozdzielczości (do „Wysokiej” zawsze, na „Wysokiej” przy obrazie > 3,2 mln pikseli), AO bez osobnego rysowania przezroczystych rzeczy (n8ao samo je włączało: 4 przejścia po scenie i 2 dodatkowe rysowania na klatkę), pula świateł punktowych 24 → 12. Symulacja na 4v4 to ok. 0,6 ms na tick (zmierzone), a wątek symulacji już jest (src/sim/simthread.ts) — wąskim gardłem zostaje karta graficzna.

Większe rzeczy na później:
- Wspólny bufor instancji dla wszystkich kawałków jednego rodzaju (BatchedMesh) — mniej wywołań rysowania
- Cienie kaskadowe albo cień tylko z budynków i drzew blisko kamery; statyczna mapa cieni dla gór i puszczy
- Zrobione 16.10: tekstury KTX2/Basis (src/render/ktx.ts, tools/textures/ktx2.mjs) i teren w 2K. Dalej: tablica tekstur zamiast 11 osobnych próbek w shaderze terenu; łąka, żwir i piasek w 2K (brak w paczkach)
- Symulacja w Web Workerze (rysowanie nie czeka na logikę), szczególnie przy grze 4 na 4

## Wygląd — do zrobienia (13.10.2026, poprawione 17.10)
Zrobione wcześniej (16.10): drzewa z Blendera z kartami igliwia i liści, wiatr w koronach, kępy trawy z teksturą źdźbeł.
Zrobione 17.10 wieczorem: mgła w dolinach za mapą (3 warstwy wlewające się w doliny wg mapy wysokości, gęsta o świcie, w mgliste dni i w deszczu; słabsza grafika = 1 warstwa — src/render/highmist.ts), chmury zahaczające o najwyższe szczyty (kłęby blakną przy zboczu i przy kamerze, więcej przy zachmurzeniu i deszczu), strumienie i wodospady z gór przy brzegu planszy (spływają do stóp gór albo do jeziora/rzeki, na stromiźnie biała piana, u dołu pył wodny; znikają, gdy na ich drodze stanie budynek — src/render/streams.ts), odbicie brzegu w wodzie (ciemny, falujący pas lądu w tafli przy brzegach).
Zrobione 17.10 późnym wieczorem: wodospad z Blendera (tools/models/waterfall.py): skalny próg z rynną, kaskada w dwóch stopniach, mokre i omszone głazy w misie; gra stawia go tam, gdzie woda na planszy dochodzi do skalnej ściany (próg na półce pod wyższym masywem), skaluje do wysokości progu, piana i pył wodny w misie; zwykłe strumienie po zboczach wyłączone. Podgląd: modele.html?id=waterfall.
Dalej:
- Szum wodospadu i strumienia (dźwięk przy kamerze/spacerze)
- Strumienie także z dalekich masywów za mapą do dolin
- Odbicia budynków i drzew w wodzie (prawdziwe, tylko na wysokim poziomie grafiki)

## Rytm dnia (13.10.2026)
Zrobione: 19:30 ognisko i karczma, 22:00 sen w chacie/twierdzy, bez łóżka słomiane posłanie przy ognisku, 5:30 do pracy; noc w tickach krótsza (ok. 11% doby), wieczór 8%, dzień pracy 81%; wilki nie dosięgną śpiących pod dachem.

Dalej:
- Straż miejska (zrobione 13.10: 6 strażników, posterunki i obchód, zastępstwo przez chłopów; 15.10 odzywki jak w Gothicu; 16.10 wygląd strażnika ze Starego Obozu). Dalej: zmiana warty, koszary straży
- Dzieci i rodziny: osada rośnie sama (rodziny przy chatach już są — 14.10)

## Wojsko i piechota — do zrobienia (13.10.2026)
Zrobione 14.10: płynne chodzenie (łuki, omijanie się), zachowanie w miejscu, kołysanie w chodzie, tarcza trzymana w marszu, kroki zależne od podłoża.

Zrobione 13.10 późnym wieczorem: marsz w zwartym szyku, odwrót rannych i leczenie przy twierdzy.

Zrobione 13.10 wieczorem: kierunek ciosu (bok/plecy), tarcza na strzały, szarża, chybienia i trafianie swoich, odrzut przy trafieniu, padanie poległych.

Zrobione 13.10: niegubione rozkazy, szyk przeciąganiem z kierunkiem, formacje (linia/blok/luźno), postawy (atak/obrona/stój), panel typów jednostek, atak w marszu, wspólne tempo oddziału, grupy pod cyframi, okrzyki na rozkaz, nowy wygląd włóczników, łuczników i chłopów.

Sterowanie:
- ~~Kolejka rozkazów: Shift + prawy klik dodaje kolejny punkt trasy~~ (zrobione 17.10)
- Patrol między dwoma punktami (np. wzdłuż palisady)
- Numer grupy widoczny nad oddziałem / na portretach

Walka:

Wygląd i ruch:
- Chorąży z proporcem w barwach pana w każdym oddziale
- Ulepszenia widoczne na modelu (za monety z bitew): płytowe naramienniki, hełm z przyłbicą itd.
- Prawdziwy głos okrzyków (np. syntezator mowy po polsku) zamiast bełkotu

## Życie osady (14.10.2026)
Zrobione 14.10: rozmowy stojących (para zwraca się do siebie, gestykuluje, kiwa głową, bełkot z bliska), pozdrowienie ręką w przejściu, kury przy chatach, świnie przy chatach i polach, koń przy koszarach, pies chodzący za mieszkańcami i obszczekujący wilki.

Czeka:
- Dzieci i rodziny: osada rośnie sama z dzieci (wygląd rodzin przy chatach już jest — 14.10)
- Zrobione 14.10: browar z Blendera, piwo jako towar (skład), karczma pije 1 beczkę na miesiąc, sucha karczma −2 do popularności, wieczorem gwar i lutnia tylko przy piwie, pijacy wracają chwiejnym krokiem. Dalej: karczmarz widocznie nosi beczki ze składu, grajek z lutnią jako osobna postać, bot pilnuje zapasu piwa
- Poranek i wieczór: koguty o świcie, kobieta wylewa wiadro, wieczorem świece w oknach i zamykanie okiennic
- Targ co kilka dni: kramy na placu, przyjezdny kupiec z wozem, gwar; tanio kupić albo sprzedać zapasy
- Brud i graty: śmieci, gnój przy chlewie, worki i siano przy domach, kości przy cmentarzu, wrony na płotach
- Odzywki jak w Gothicu zależne od sytuacji (deszcz, wilki w nocy, podatki, głód) u chłopów i strażników
- Chlew i stajnia jako budynki (zwierzęta z Blendera już są)

## Gospodarka i grywalność (16.10.2026)
Zrobione 16.10: koszty budynków etapami (start 80 drewna, kamień i złoto na później), jedzenie na tydzień na start, głodni odchodzą tylko z głodu, jedzenie syci różnie (jabłko 1, chleb 2, ryba 3), duży spichlerz, okno spichlerza z prognozą, wyłączanie budynków, limit kopaczy przy ognisku, siatka budowy, budowanie w pauzie.

Czeka:
- ~~Wymagania budynków (drzewko)~~ — zrobione 17.10 (0.27.0): piekarnia przy młynie, koszary przy zbrojowni, karczma przy browarze, barak przy kopalni; zablokowane karty z kłódką i „Najpierw: …”. Dalej do decyzji: młyn dopiero przy polu, browar przy polu, łuczarz/włóczniarz przy drwalu
- Cele na początek gry (skryba prowadzi): postaw drwala → sad → chatę → kamieniołom; mała nagroda za każdy krok, żeby nowy gracz wiedział, co dalej
- Jabłka się psują (część zapasu ubywa co dzień, chleb wolniej, ryby wędzone najdłużej) — powód, żeby mieć różne jedzenie
- Targ: sprzedaż nadmiaru (np. zboża, drewna) za złoto i kupno tego, czego brakuje
- Sprawdzić na żywo pacing pierwszych 30 minut (narzędzie tools/soak + zwykła gra Michała) i dostroić koszty

## Kolejka — następne partie (ustalone z Michałem 14.10)
Zrobione 15.10: karczma z browarem, oblężenie (taran z koszar, krata opada i zamek się zamyka, gdy wróg podchodzi), pan zamku w koronie.
1. Obrona zamku: wrzątek i kamienie z machikuł nad bramą na taran
2. Prawdziwi jeńcy z bitew w lochach, zmiana warty w bramie

## Zamek (14.10.2026)
Zrobione 14.10: zamek 11×11 z Blendera według wspólnego planu (src/data/keep-layout.json): mury z blankami, baszty z izbami i strzelnicami, wieże bramy z izbami, brama z kratą i mostem, donżon; dziedziniec, sala tronowa z tronem pod baldachimem, kuchnia, komnata pana, koszary, lochy z celami; wejście tylko bramą, ściany i drzwi w symulacji, schody i chodnik na murach (łucznik na murze strzela dalej); spacer chłopem z kolizjami; 6000 HP; obchód modeli bez przeglądarki (tools/models/inspect.sh).

Czeka:
- Zrobione 15.10: życie w zamku (ozdoba, poza symulacją): pan na tronie i obchód sali, kucharz, dwoje służby z jedzeniem, więźniowie w celach, wartownicy na bocznych murach z pochodniami nocą. Dalej: prawdziwi jeńcy z bitew w lochach, zmiana warty w bramie, pan wychodzi na dziedziniec
- Zrobione 15.10: taran (koszary, bot też go buduje) i krata opadająca przy wrogu. Dalej: wrzątek/kamienie z machikuł
- Zrobione z Blendera: chata i stodoła (14.10), spichlerz i zbrojownia (15.10), piekarnia, młyn i koszary (16.10). Zrobione 18.10: drewniana wieża strażnicza, studnia i cech inżynierów. W kodzie zostały jeszcze tylko segmenty murów: palisada, mur kamienny i drabina (łączenia, narożniki). Zrobione 14.10: karczma (szachulec, strzecha, ganek, szynkwas, palenisko, stoły, wejście drzwiami z kolizjami)
- Zrobione 14.10: karczma 4×3 (trzy stoły, dłuższy szynkwas, wyższy strop, ganek z dwoma stołami)
- Ulepszanie zamku (poziomy widać na modelu: drewniane hurdycje, druga linia murów, fosa)

## Do poprawy — kolejka po przeglądzie 14.10.2026 (Claude podpowiada stąd przy „co dalej”)
Wydajność (więcej FPS):
- Trawa i drzewa liściaste z daleka uproszczone albo jako obrazki (dziś ok. 750 tys. trójkątów w widoku osady)
- Domy z Blendera (ok. 19 tys. trójkątów każdy): prostsza wersja z daleka
- Zrobione 16.10: roślinność we wspólnych pulach na rodzaj (widok osady 522 → 409 wywołań rysowania, karta 7,5 → 5,4 ms). Dalej: budynki we wspólnym rysowaniu (ok. 160 siatek w kadrze)
Wojsko — wygoda dowodzenia:
- Zrobione 17.10: kolejka rozkazów (Shift + prawy klik) i patrol tam i z powrotem (P)
- Dalej: kreski trasy z kolejki i patrolu widoczne na mapie przy zaznaczonym oddziale
- Numer grupy widoczny nad oddziałem i na portretach
Balans:
- Gry bot kontra bot kończą się po ok. godzinie i zwykle przegrywa ten sam typ osady: ceny, tempo produkcji i siła fal do wyrównania (narzędzie: tools/soak)

## Ustawienia — do zrobienia (14.10.2026)
- Pauza, gdy gracz przełączy się na inną kartę albo okno (tylko gra z botami).
- Autozapis co 1 / 5 / 10 minut (teraz co 50 ticków, bez wyboru).
- Zmiana klawiszy (WASD, Q/E, skróty budynków i oddziałów) i lista wszystkich skrótów w jednym miejscu.
- Odwrócenie kółka przy przybliżaniu i odwrócenie obrotu kamery.
- Dostępność: kolory drużyn dla daltonistów; „mniej ruchu” (bez trzęsienia kamery i błysków).
- Tytuł „Project-1” i linki logowania na ekranie menu też rosnące z „Wielkością interfejsu”.

## Droga do „mega gry” — grafika na poziomie, FPS bez spadków (14.10.2026)
Zasada: każda poprawka wyglądu z budżetem wydajności. Mierzymy przed i po (`window.__perf()`, F3); cel ≥ 60 FPS na średnim laptopie przy 4v4 i dużej bitwie. Co nie mieści się w budżecie, dostaje wersję „z daleka” albo trafia do wyższego poziomu grafiki.

**Kolejność (od największego efektu za najmniejszy koszt):**
1. **Światło i kolory** — cieplejsze słońce, mocniejsze, dłuższe cienie, światło odbite w zakamarkach, lekka mgła w oddali, korekcja barw, delikatna winieta; przełącznik stary/nowy wygląd do porównania. Koszt: prawie zero (to te same światła i jedno przejście obrazu).
2. **Teren** — błoto i ziemia wokół zabudowy, wydeptane ścieżki, plamy innej trawy, kamyki, kwiaty, przejścia łąka–las. Koszt: mieszanie tekstur w shaderze terenu i instancjonowane drobiazgi z odległością znikania.
3. **Chata od nowa** (najczęstszy budynek) w 2–3 wariantach, potem kolejne budynki od najczęściej stawianych.
4. **Ludzie czytelniejsi z wysokości kamery** — wyraźniejszy ruch, lepsze odcinanie od tła (obrys/kontrast), animacje pracy.

**Skąd modele (moje modele składane skryptem z brył to za mało na ładną grę):**
- Gotowe paczki średniowieczne w stylu realistycznym/mrocznym (nie bajkowym jak KayKit) — chaty, warsztaty, mury, postacie z animacjami. Przy każdej sprawdzić licencję: gra w przeglądarce (pliki da się wyciągnąć), sprzedaż, modyfikacje.
- Generatory 3D z obrazka (budynki, rekwizyty) — potem uproszczenie siatki i dopasowanie stylu.
- Grafik 3D na zlecenie do kluczowych rzeczy (zamek, chata, główne postacie) — spójny, własny styl.
- Claude zajmuje się wpinaniem: uproszczenie pod przeglądarkę, wersje z daleka, wspólne światło i paleta, animacje, podgląd w `modele.html`, pilnowanie wydajności.
- Pierwszy krok: rozpoznanie 3–5 paczek (styl Gothica, licencja, cena) i jedna darmowa chata/postać obok naszej w podglądzie modeli do porównania.

**Budżet wydajności (żeby FPS nie spadły przy ładniejszej grafice):**
- Każdy model z wersją z daleka (Decimate do ok. 20–25%) i odległością przełączania; drobiazgi znikają dalej niż kilkadziesiąt pól.
- Te same modele = jedno wywołanie rysowania (instancjonowanie; BatchedMesh dla różnych budynków); limit wywołań rysowania na klatkę (dziś ok. 1180 — schodzić w dół).
- Tekstury: wspólne atlasy, rozdzielczość wg poziomu grafiki, kompresja (KTX2/Basis), mipmapy; normal mapy zamiast gęstej siatki.
- Trójkąty: chata z bliska do kilku tysięcy, z daleka kilkaset; postać z bliska ok. 5–6 tys., z daleka ok. 1–1,5 tys.; trawa i korony drzew (dziś ~750 tys. trójkątów) — pierwsze do odchudzenia.
- Cienie tylko z bliskich obiektów, mapa cieni wg poziomu grafiki; drogie efekty (światło odbite, mgła objętościowa) tylko na wysokim poziomie.
- Automatyczna jakość (już jest) przełącza poziomy, gdy FPS spada; nowe efekty muszą mieć wpis w poziomach automatu.
- Po każdej partii pomiar w Chrome (`__perf()`), duża bitwa i 4v4; spadek >10% = poprawka przed wdrożeniem.

## Technika: wydajniej i ładniej (14.10.2026, wieczór) — uzupełnia „Drogę do mega gry” wyżej
**Wydajność**
- Symulacja w osobnym wątku (Web Worker): logika gry i boty poza wątkiem rysowania; grafika dostaje cały czas klatki, koniec przycinania w 4v4 i dużych bitwach. Największy pojedynczy zysk. (Lockstep i zapis bez zmian — worker liczy step(), wątek główny dostaje stan do rysowania.)
- Skompresowane tekstury KTX2/Basis z mipmapami: 4–6× mniej pamięci karty, szybsze wczytywanie, można dać ostrzejsze tekstury.
- BatchedMesh dla budynków + mapa rysowana kawałkami (chunki z odcinaniem poza kamerą): mniej wywołań rysowania (dziś ~1180).
- Drzewa z daleka jako impostory (płaski obrazek zwrócony do kamery, 2 trójkąty) i trawa liczona na karcie graficznej — dziś ~750 tys. trójkątów, najwięcej w scenie.
- Cienie statyczne liczone raz (budynki, drzewa, mury) i odświeżane tylko po zmianie; co klatkę cień tylko ruchomych (ludzie, zwierzęta).
- Dynamiczna rozdzielczość: przy spadku FPS w bitwie obraz na chwilę o 10–20% mniejszy, klatki równe.

**Ładność**
- Wiatr w shaderze: trawa, korony drzew, flagi, pranie, strzechy kołyszą się (prawie za darmo).
- Cienie chmur przesuwające się po terenie (jedna ruchoma tekstura w shaderze terenu).
- Poświata ognia (bloom: pochodnie, ogniska, okna nocą) i promienie światła przez mgłę o świcie.
- Prawdziwe niebo: słońce i księżyc po łuku, chmury, oświetlenie od nieba (mapa otoczenia) zamiast płaskiego tła.
- Cząsteczki na karcie graficznej: dym z kominów, kurz spod nóg, iskry, świetliki nocą.
- Naklejki na teren: błoto przy drzwiach, wydeptane ścieżki tam, gdzie ludzie chodzą najczęściej, krew po bitwie.
- Woda z odbiciem nieba i pianą przy brzegu.
- Ludzie ze szkieletem i animacjami z gotowych paczek (chód, praca, walka, śmierć), wpięci z instancjonowaniem (animacje wypalone w teksturę), żeby setki postaci dalej szły kilkoma wywołaniami rysowania.

**Na później:** Three.js w trybie WebGPU (WebGPURenderer + TSL) — obliczenia na karcie (cząsteczki, trawa, tłum), więcej klatek na nowszych komputerach; wymaga częściowego przepisania shaderów.

**Proponowana kolejność startu:** 1) wiatr + cienie chmur, 2) symulacja w Web Workerze, 3) tekstury KTX2.

## Tłumaczenie na angielski (od 17.10.2026)
Zrobione 17.10: przełącznik języka (Ustawienia → Interfejs), angielski dla wszystkich tekstów z `src/i18n/pl.ts` (budynki, opisy, surowce, pasek, racje, podatki, komunikaty budowy, poradnik w skrócie) i całe menu ustawień / ekran startowy / wyjście i poddanie (`menu.ts`).
Zrobione 17.10 (0.25.1): cała reszta interfejsu, pomoc, konto, gra przez sieć, dymki i przydomki. Po polsku zostaje tylko okno F3 (narzędzie twórcy).

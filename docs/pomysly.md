# Pomysły i rzeczy na później

Tu trafia wszystko nowe, co nie należy do bieżącej partii. Do planu etapów (`plan.md`) przenosimy stąd, gdy przychodzi na to kolej.

## Zgłoszone przez Michała

- Menu główne w klimacie Twierdzy z ekranem ładowania, ustawieniami i wszystkimi funkcjami gry (w planie jako etap 3)
- Poziomy graczy, konta, ulepszenia postaci, zamków i budowli (w planie: etapy 5 i 8)
- Zarabianie: mikropłatności i reklamy (po wersji, która trzyma graczy)
- Docelowa nazwa gry zamiast „Project‑1”

## Braki zauważone przy pracy

- Lasy i złoża się nie wyczerpują
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

Czeka:
- Zboże i sad: zimą nie rosną (farma i sad stoją), wiosną siew, latem zbiory
- Rybak zimą łowi mniej (lód przy brzegu)
- Ludzie zimą chodzą w grubszych ubraniach, para z ust

## Lista na kolejne partie (12.10.2026) — Claude podpowiada z niej, gdy Michał pyta „co dalej”
Kierunek: klimat Gothic 1/2 — surowo, brudno, mroczno, żywy świat.

Zrobione 12.10: palisada, brama (otwieranie, sama się zamyka), wieża, wilki (polują, przegryzają mur), ruiny do odbudowy, odzywki ludzi, błoto i kałuże, kruki na ciałach, alarmy ataku, tryb deweloperski.

Czeka:
- Kości przy cmentarzu, więcej brudu (śmieci, gnój przy chlewie)
- Bandyci z obozów w lesie napadający drwali; obozy wroga zamiast samych fal
- Kopalnia rudy z prawdziwego zdarzenia (szyb, wózki)
- Dźwięki: ptaki o świcie, koguty, świerszcze, puszczyk, grzmot, dzwon w południe, róg wojenny i dzwon alarmu, trzask ognisk, gwar, wiwaty, kowal
- Wojsko: zbrojny (łucznik, łuczarz, taran, kamienne mury, drabiny i kamienna wieża już są)
- Wnętrza pozostałych budynków w stylu nowej chaty
- Leśniczy (sadzi drzewa; lasy się nie odnawiają)
- Bot dalej: kamienne mury, taran, lepszy wybór celów, poziomy trudności dopracowane (zrobione: palisada, wieże, łucznicy na wieżach, karczma, atak z dwóch stron, wypady)
- Ulepszanie budynków (wyżej)

## Klimat i poprawki (12.10, popołudnie)
Zrobione: muzyka w tle (dzień/noc/bębny przy ataku), księżyc, gwiazdy i chmury w deszczu, wnętrza drwala/włóczniarza/łuczarza/piekarni/inżynierów w stylu chaty, karczma, spacer oczami chłopa, okno wydajności (F3).

Zrobione wieczorem: mgła przy ziemi, dym z kominów (nocą podświetlony), iskry nad ogniskami i pożarami, świecące okna, wydeptana ziemia przy domach i ścieżki chłopów; konta, lobby gier 1v1/2v2/4v4 z botami, mecz przez sieć.

Czeka — klimat:
- Śmieci, beczki, worki i siano przy domach (sama wydeptana ziemia już jest)

Zrobione 13.10: czat w pokoju i w meczu (Enter), ranking i historia meczów (tabela results), link zaproszenia, znajomi (dodawanie po nicku, kto jest w grze, zaproszenia), gracz bez połączenia uznany za wychodzącego po 15 s (milczący po 45 s).

Czeka — gra przez sieć:
- Gracz, który wyszedł z meczu, oddaje miasto botowi

Czeka — poprawki:
- Czytelność nocy: pochodnie o większym zasięgu jako opcja
- Wszystkie panele w grze (dolna belka, okna budynków, skryba, alarm) w stylu nowego menu: ciemna skóra, złote żyłki, napisy Cinzel (menu i wczytywanie zrobione 13.10)
- Pełny magazyn: dziś robotnik po chwili wyrzuca nadmiar (przepada) — do decyzji, czy ma czekać

## Wydajność — do zrobienia (13.10.2026, gra dla wielu graczy w przeglądarce)
Zrobione 13.10 wieczorem: daleki las jako obrazki z 8 stron, Service Worker z pamięcią plików gry, zapamiętane miniatury budynków.

Zrobione 13.10: kawałki roślinności 40×40 z odrzucaniem poza ekranem, poziomy szczegółów (drobiazgi znikają daleko, świerki i liściaste przełączają się na proste modele), rzadsza puszcza daleko, kępy trawy bez cieni, siatka gór za mapą indeksowana i rzadsza w oddali, tekstury terenu z numerem wersji.

Zrobione 13.10 wieczorem: automatyczna jakość (5 poziomów: cienie, AO, rozdzielczość, zasięg trawy; schodzi przy < 45 FPS, raz na sesję próbuje wyżej, poziom zapamiętany; wyłącza się po ręcznej zmianie grafiki).

Zrobione 14.10: przegląd długiej gry (tools/soak), boty myślą w różnych tickach, szybsze sprawdzanie blokowania przejść, krzaki i drzewa z daleka lżejsze, góry za mapą bez cienia (karta graficzna ok. 10 → 7,5 ms na klatkę w widoku osady).

Zrobione 15.10: daleka wersja budynków (LOD, 3 poziomy, próg zależny od jakości), okno F3 z czasem karty na przejście (cienie, scena, AO, poświata) i listą najcięższych rzeczy.

Dalej (zmierzone 14.10 w Chrome, widok osady: ok. 2,7 mln trójkątów w scenie, 4 mln z cieniem, ok. 1180 wywołań rysowania):
- Kępy trawy (28 trójkątów) i korony liściastych (200) to razem ok. 750 tys. trójkątów — rzadsze z daleka albo obrazki
- Ok. 1180 wywołań rysowania: kawałki lasu po kilkanaście rodzajów na kawałek, w cieniu drugi raz — BatchedMesh albo większe kawałki

- Zrobione 16.10: pniaki tylko po ścięciu, zastępcze bryły cienia roślinności (warstwa „tylko cień”, src/render/shadowlayer.ts), lżejsze kwiaty, ładunki tylko u niosących. Dalej: narzędzia w rękach (siekiery, kilofy, pochodnie, wiadra) też mają instancję na każdego człowieka z zerową skalą
- AO w połowie rozdzielczości na jakościach do „Wysokiej”

Większe rzeczy na później:
- Wspólny bufor instancji dla wszystkich kawałków jednego rodzaju (BatchedMesh) — mniej wywołań rysowania
- Cienie kaskadowe albo cień tylko z budynków i drzew blisko kamery; statyczna mapa cieni dla gór i puszczy
- Tekstury w formacie KTX2/Basis (kompresja na karcie graficznej: 4–6× mniej pamięci, szybsze wczytanie) i tablica tekstur zamiast 11 osobnych próbek w shaderze terenu
- Prawdziwy 2K/4K dla terenu: paczka ambientCG w 2K/4K (pobrać ręcznie albo wgrać do repo przez Michała — z kontenera serwisy z teksturami są zablokowane)
- Symulacja w Web Workerze (rysowanie nie czeka na logikę), szczególnie przy grze 4 na 4

## Wygląd — do zrobienia (13.10.2026)
- Nowe modele drzew z teksturą liści/igieł na kartach (alfa) — prawdziwe gałęzie z bliska, impostory z daleka
- Trawa z teksturą źdźbeł (karty z alfą) zamiast pojedynczych pasków
- Mgła wysokościowa w dolinach i chmury zahaczające o szczyty
- Wodospady i strumienie z gór, odbicia brzegu w wodzie

## Rytm dnia (13.10.2026)
Zrobione: 19:30 ognisko i karczma, 22:00 sen w chacie/twierdzy, bez łóżka słomiane posłanie przy ognisku, 5:30 do pracy; noc w tickach krótsza (ok. 11% doby), wieczór 8%, dzień pracy 81%; wilki nie dosięgną śpiących pod dachem.

Dalej:
- Straż miejska (zrobione 13.10: 6 strażników, posterunki i obchód, zastępstwo przez chłopów). Dalej: własny wygląd w barwach straży (zbroja, halabarda), odzywki jak w Gothicu, zmiana warty, koszary straży
- Dzieci i rodziny: osada rośnie sama (rodziny przy chatach już są — 14.10)

## Wojsko i piechota — do zrobienia (13.10.2026)
Zrobione 14.10: płynne chodzenie (łuki, omijanie się), zachowanie w miejscu, kołysanie w chodzie, tarcza trzymana w marszu, kroki zależne od podłoża.

Zrobione 13.10 późnym wieczorem: marsz w zwartym szyku, odwrót rannych i leczenie przy twierdzy.

Zrobione 13.10 wieczorem: kierunek ciosu (bok/plecy), tarcza na strzały, szarża, chybienia i trafianie swoich, odrzut przy trafieniu, padanie poległych.

Zrobione 13.10: niegubione rozkazy, szyk przeciąganiem z kierunkiem, formacje (linia/blok/luźno), postawy (atak/obrona/stój), panel typów jednostek, atak w marszu, wspólne tempo oddziału, grupy pod cyframi, okrzyki na rozkaz, nowy wygląd włóczników, łuczników i chłopów.

Sterowanie:
- Kolejka rozkazów: Shift + prawy klik dodaje kolejny punkt trasy
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

## Kolejka — następne partie (ustalone z Michałem 14.10)
Zrobione 15.10: karczma z browarem, oblężenie (taran z koszar, krata opada i zamek się zamyka, gdy wróg podchodzi), pan zamku w koronie.
1. Obrona zamku: wrzątek i kamienie z machikuł nad bramą na taran
2. Prawdziwi jeńcy z bitew w lochach, zmiana warty w bramie

## Zamek (14.10.2026)
Zrobione 14.10: zamek 11×11 z Blendera według wspólnego planu (src/data/keep-layout.json): mury z blankami, baszty z izbami i strzelnicami, wieże bramy z izbami, brama z kratą i mostem, donżon; dziedziniec, sala tronowa z tronem pod baldachimem, kuchnia, komnata pana, koszary, lochy z celami; wejście tylko bramą, ściany i drzwi w symulacji, schody i chodnik na murach (łucznik na murze strzela dalej); spacer chłopem z kolizjami; 6000 HP; obchód modeli bez przeglądarki (tools/models/inspect.sh).

Czeka:
- Zrobione 15.10: życie w zamku (ozdoba, poza symulacją): pan na tronie i obchód sali, kucharz, dwoje służby z jedzeniem, więźniowie w celach, wartownicy na bocznych murach z pochodniami nocą. Dalej: prawdziwi jeńcy z bitew w lochach, zmiana warty w bramie, pan wychodzi na dziedziniec
- Zrobione 15.10: taran (koszary, bot też go buduje) i krata opadająca przy wrogu. Dalej: wrzątek/kamienie z machikuł
- Zrobione z Blendera: chata i stodoła (14.10), spichlerz i zbrojownia (15.10), piekarnia, młyn i koszary (16.10). Dalej w tym samym potoku: warsztaty (drwal, włóczniarz, łuczarz), kamieniołom, kopalnia, rybak, cech inżynierów, cmentarz, z obchodem inspect.sh i kolizjami w spacerze. Zrobione 14.10: karczma (szachulec, strzecha, ganek, szynkwas, palenisko, stoły, wejście drzwiami z kolizjami)
- Zrobione 14.10: karczma 4×3 (trzy stoły, dłuższy szynkwas, wyższy strop, ganek z dwoma stołami)
- Ulepszanie zamku (poziomy widać na modelu: drewniane hurdycje, druga linia murów, fosa)

## Do poprawy — kolejka po przeglądzie 14.10.2026 (Claude podpowiada stąd przy „co dalej”)
Wydajność (więcej FPS):
- Trawa i drzewa liściaste z daleka uproszczone albo jako obrazki (dziś ok. 750 tys. trójkątów w widoku osady)
- Domy z Blendera (ok. 19 tys. trójkątów każdy): prostsza wersja z daleka
- Las rysowany w setkach małych kawałków (ok. 1180 wywołań rysowania na klatkę): łączenie w większe paczki (BatchedMesh)
Wojsko — wygoda dowodzenia:
- Kolejka rozkazów: Shift + prawy klik dodaje kolejne punkty marszu
- Patrol tam i z powrotem (np. wzdłuż palisady)
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

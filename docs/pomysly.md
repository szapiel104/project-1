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

## Lista na kolejne partie (12.10.2026) — Claude podpowiada z niej, gdy Michał pyta „co dalej”
Kierunek: klimat Gothic 1/2 — surowo, brudno, mroczno, żywy świat.

Zrobione 12.10: palisada, brama (otwieranie, sama się zamyka), wieża, wilki (polują, przegryzają mur), ruiny do odbudowy, odzywki ludzi, błoto i kałuże, kruki na ciałach, alarmy ataku, tryb deweloperski.

Czeka:
- Kości przy cmentarzu, więcej brudu (śmieci, gnój przy chlewie)
- Bandyci z obozów w lesie napadający drwali; obozy wroga zamiast samych fal
- Kopalnia rudy z prawdziwego zdarzenia (szyb, wózki)
- Dźwięki: ptaki o świcie, koguty, świerszcze, puszczyk, grzmot, dzwon w południe, róg wojenny i dzwon alarmu, trzask ognisk, gwar, wiwaty, kowal
- Wojsko: łucznik + wytwórca łuków (strzelanie z murów/wież), zbrojny, taran; kamienne mury i wieże później
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

Dalej (zmierzone 14.10 w Chrome, widok osady: ok. 2,7 mln trójkątów w scenie, 4 mln z cieniem, ok. 1180 wywołań rysowania):
- Kępy trawy (28 trójkątów) i korony liściastych (200) to razem ok. 750 tys. trójkątów — rzadsze z daleka albo obrazki
- Domy z Blendera mają po ok. 19 tys. trójkątów — wersja z daleka (LOD) dla budynków
- Ok. 1180 wywołań rysowania: kawałki lasu po kilkanaście rodzajów na kawałek, w cieniu drugi raz — BatchedMesh albo większe kawałki

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
Po działającej karczmie, w tej kolejności:
1. Życie w zamku (niżej w sekcji Zamek)
2. Oblężenie zamku: taran, drabiny, krata przy wrogu

## Zamek (14.10.2026)
Zrobione 14.10: zamek 11×11 z Blendera według wspólnego planu (src/data/keep-layout.json): mury z blankami, baszty z izbami i strzelnicami, wieże bramy z izbami, brama z kratą i mostem, donżon; dziedziniec, sala tronowa z tronem pod baldachimem, kuchnia, komnata pana, koszary, lochy z celami; wejście tylko bramą, ściany i drzwi w symulacji, schody i chodnik na murach (łucznik na murze strzela dalej); spacer chłopem z kolizjami; 6000 HP; obchód modeli bez przeglądarki (tools/models/inspect.sh).

Czeka:
- Życie w zamku: pan na tronie, kucharz przy palenisku, straż zmienia wartę w bramie i chodzi po murach, więźniowie w lochach (np. pojmani wrogowie), służba nosi jedzenie z kuchni do sali
- Oblężenie zamku: taran pod bramą, drabiny na mury, wrzątek/kamienie z machikuł; brama zamyka się przy wrogu
- Pozostałe budynki z Blendera w tym samym potoku (piekarnia, koszary, młyn; zrobione 14.10: chata i stodoła), z obchodem inspect.sh i kolizjami w spacerze. Zrobione 14.10: karczma (szachulec, strzecha, ganek, szynkwas, palenisko, stoły, wejście drzwiami z kolizjami)
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

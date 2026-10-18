# Dziennik zmian

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

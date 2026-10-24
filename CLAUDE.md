# Project‑1 — zasady pracy

- Rozmowa i teksty po polsku. Michał wdraża i ocenia wygląd sam; pracujemy małymi partiami, push na main = wdrożenie (GitHub Pages).
- Gra tylko na komputery (telefony zablokowane w src/boot.ts).

## Git — obowiązkowo dla każdego czatu (Michał, 23.10.2026)
Nad grą pracuje kilka czatów naraz, więc:
1. **Przed rozpoczęciem każdej roboty** (także kolejnej w tym samym czacie): `git pull --rebase origin main` — praca zawsze na najnowszym stanie.
2. **Przed każdym pushem:** `git fetch origin main && git rebase origin/main`, a po rebase **pełne sprawdzenie od nowa:** `npx tsc --noEmit && npx vitest run && npm run build`. Push dopiero, gdy wszystko przejdzie (zmiany innego czatu mogą logicznie gryźć się z naszymi, nawet bez konfliktu w git).
3. Konflikt przy rebase rozwiązujemy ręcznie, zachowując zmiany obu czatów — nigdy `--force` ani nadpisywanie cudzych zmian.

## Podział kodu na pliki (Michał, 24.10.2026, dla wszystkich czatów)
- Dobre praktyki: jeden plik = jedna odpowiedzialność. Nie dopisujemy kolejnych setek linii do plików, które już mają po kilka tysięcy (np. ~6000 linii).
- Nowa funkcja gry (system, okno, budynek z logiką) trafia do osobnego modułu; gdy ruszasz duży plik, wydziel przy okazji spójny kawałek (np. jedno okno UI, jeden system) do własnego pliku z importem.
- Dzielimy małymi partiami (jeden plik na raz), bez zmiany zachowania gry; po każdym podziale `tsc` + `vitest` + `build`. Uwaga na równoległe czaty: przed podziałem dużego pliku `git pull --rebase`, żeby nie rozjechać cudzych zmian.

## Dwa języki: polski i angielski (obowiązkowo dla każdego czatu, od 17.10.2026)
- Każdy nowy budynek, jednostka, surowiec, okno, przycisk, komunikat i podpowiedź dostaje od razu **obie wersje**. Bez angielskiej wersji zmiana nie jest skończona.
- Stałe teksty (nazwy i opisy budynków, jednostek, surowców): klucz w `src/i18n/pl.ts` **i** ta sama linijka w `src/i18n/en.ts`, w kodzie `t('klucz')`. `en.ts` jest typowany kluczami z `pl.ts`, więc brakujące tłumaczenie wywala `tsc`; `tests/i18n.test.ts` sprawdza dodatkowo, że każdy budynek z `BUILDINGS` ma nazwę w obu językach.
- Krótkie napisy w miejscu (etykieta jednego przycisku, dymek): `tx('Po polsku', 'In English')` z `src/i18n`.
- Angielski pisany naturalnie, w klimacie średniowiecznym (keep, armoury, my lord), nie słowo w słowo z polskiego.
- Język wybiera się w Ustawienia → Interfejs (zmiana przeładowuje grę, zapis robi się sam). Za pierwszym razem gra bierze język przeglądarki.
- Starsze napisy wciąż wpisane na sztywno po polsku przenosimy partiami (lista w `docs/pomysly.md`, „Tłumaczenie na angielski”).

## Migracje Supabase (Michał 24.10.2026)
- Michał wykonuje je ręcznie w SQL Editorze, gdy ma dostęp. Każda nowa migracja trafia do `supabase/migrations/` **i** na listę „Czekają” w `supabase/migrations/DO_WYKONANIA.md`. Kod gry musi działać także przed jej wykonaniem (jak `saveResult` → zwykły zapis, gdy funkcji w bazie jeszcze nie ma).
- Gdy Michał pyta o stan bazy albo wraca do pracy przy Supabase, przypomnij mu listę z `DO_WYKONANIA.md`.

## Boty dostają to samo co gracz (obowiązkowo dla każdego czatu, Michał 24.10.2026)
- Każdy nowy budynek, jednostka i mechanika, z której korzysta gracz, od razu trafia też do bota (`src/sim/systems/bot.ts`): bot ją stawia, szkoli albo używa w sensownym momencie (np. kolejność w `ORDER`, warunki na wielkość osady i zapasy, te same limity co gracz). Bez tego zmiana nie jest skończona — tak jak bez angielskiej wersji.
- Jeśli bot czegoś świadomie nie używa (np. czysto ozdobny budynek), napisz to w komentarzu przy `ORDER` i w wpisie w CHANGELOG.

## Modele — gdzie robić i jak sprawdzać (obowiązkowo dla każdego czatu)
- **Zasada Michała (19.10.2026, na zawsze, dla wszystkich modeli: koń, jabłka, kosze, drzewa, krzaki…): NIE odchudzać i nie docinać gotowych modeli z paczek.** Mamy dobrą kartę graficzną i ustawienia; oryginały były ładniejsze, a po Decimate i przeróbkach w grze wychodziły gorzej. Wersja z bliska = oryginalne trójkąty, UV, normalne i tekstury w pełnej rozdzielczości paczki. Upraszczać wolno tylko wersję z daleka, i to tylko gdy naprawdę widać spadek FPS.
- **Robimy je w Blenderze** skryptem w Pythonie w `tools/models/` (bpy jako moduł, opis w `tools/models/README.md`): `/tmp/bpyenv/bin/python tools/models/<model>.py` → `src/render/models/<model>.json`. Kod gry tylko wczytuje gotowe siatki; nie składamy nowych modeli z prostopadłościanów w TypeScripcie.
- **Tekstury są obowiązkowe:** drewno, płótno, kamień i ziemia dostają zdjęciowe tekstury z `src/render/textures.ts` (`pattern('planks' | 'burlap' | 'ashlar' | 'soil' | ...)` + `normal(...)`). Gładki kolor zostaje tylko na żelazie, wodzie i liściach. Kolor z wierzchołków to barwa i cień w zagłębieniach (`bake_ao`), a nie zamiennik tekstury.
- **Bryły muszą być pełne i zamknięte:** gra nie rysuje tylnych stron ścian, więc otwarta powierzchnia (stożek bez denek `cap_ends=False`, sama płaszczyzna, rurka bez grubości) od tyłu lub od środka po prostu znika. Obręcze, rury, deski i blachy robimy z grubością: wszystkie ściany wokół (np. `ring()` w `yard.py` dla obręczy, `box`, zamknięty `cyl`). Płótno i kartki mają dwie warstwy (jak `cloth()` w `yard.py`). W podglądzie obejrzyj model też od tyłu i od środka.
- **Bez dwóch powierzchni w jednym miejscu:** bryły nie mogą leżeć licem w lico (belka na tynku, cios na murze, gzyms na koronie, wierzch na wierzchu) — to miga przy ruchu kamery. Detal wystaje co najmniej 5 mm (0,005) albo jest wpuszczony. Gra ratuje to częściowo (`withAo` w `buildings.ts` rysuje detale o włos bliżej), ale dwie płaszczyzny tego samego materiału dalej walczą.
- Odnośniki do podglądu modeli i pustej sceny są też w grze: Ustawienia → zakładka „Dla twórców”.
- **Najpierw sprawdzasz w podglądzie modeli, nie w grze:** `https://szapiel104.github.io/project-1/modele.html?id=<id>` (lokalnie `npx vite` → `/modele.html?id=<id>`). Model stoi sam na kamiennej podstawce (albo `&tlo=powietrze` / `&tlo=trawa`), w zwykłym świetle i pełnej jakości. Myszą oblatujesz go z każdej strony; przyciski: Noc, Bez dachu, Siatka, Obrót. Na dole liczba trójkątów i wymiary w polach.
  - Nowy model dopisz do listy w `src/viewer.ts` (grupy: Budynki — same z `BUILDINGS`; Ludzie, Zwierzęta, Podwórko, Graty), żeby dało się go tam obejrzeć.
  - Do zrzutu w Chrome lub Playwright: `window.__view('<id>', obrótStopnie, nachylenieStopnie)`.
  - Obejrzyj model z czterech stron, z góry i nisko z ziemi. Sprawdź, czy nic nie prześwituje i czy tekstury nie są rozciągnięte ani za grube. Dopiero potem wpinaj go do gry.
- **Potem w grze, na pustej scenie** (`?test=1&pusta=1&model=<id>`, opis niżej): czy skala pasuje do ludzi i budynków obok i czy stoi tam, gdzie trzeba.
- Budynki dodatkowo przechodzą arkusz `inspect.sh` (punkt 3 niżej).

## Testy — zawsze w tej kolejności, możliwie tanio
- **Zasada Michała (18.10.2026, na zawsze, dla wszystkich czatów): grę i modele w przeglądarce testujemy ZAWSZE w pełnej grafice — `?test=1&hd=1` (w podglądzie modeli pełna jakość jest domyślnie). Bez względu na to, co sprawdzasz, nigdy w słabej grafice: tam inaczej wyglądają tekstury, cienie i przezroczystość, więc błędy umykają.**
- **Zasada Michała (16.10.2026, dla wszystkich czatów tej gry): przeglądarkę (Chrome, Playwright, zrzuty) odpalamy tylko przy GRUBYCH zmianach.** Mniejszych zmian nie sprawdzamy w oknie — to zjada czas; Michał testuje sam. Nowe albo zmienione obiekty sprawdzamy w Blenderze (arkusz `inspect.sh`, podgląd modeli), a wszystko inne tylko `tsc` + `vitest` + `build`. W razie wątpliwości: nie odpalać przeglądarki, napisać Michałowi, co sprawdzić.
1. `npx tsc --noEmit`, `npx vitest run`, `npm run build` — logikę gry sprawdzamy testami bez przeglądarki (tests/*.test.ts).
2. Przeglądarka tylko gdy trzeba zobaczyć wygląd albo klikanie:
   - Chrome Michała przez rozszerzenie Claude in Chrome (prawdziwa karta graficzna, zrzuty w sekundy): otwórz `https://szapiel104.github.io/project-1/?test=1` w nowej karcie (`&hd=1` = pełna grafika, nadal bez ruszania zapisu), steruj przez `window.__test` (`give`, `build`, `train`, `run`, `look`, `at`, `state`). Zrzuty w skali 0.5–0.6. Tryb testowy nie rusza zapisu gracza.
   - **Pusta scena: `?test=1&pusta=1`** — płaska łąka bez lasów, wody, botów, wilków i napadów, tylko twierdze. Stawiasz tylko to, co testujesz, i kamera nie wpada w drzewa ani mury. Pomocniki w `window.__test`:
     - `home()` — pole przed bramą twierdzy (punkt odniesienia);
     - `place('house', x, y, rot?)` — gotowy budynek od ręki (null, gdy zajęte);
     - `hour(20.5)` — godzina na zegarze;
     - `peasants(n)` — chłopi;
     - `wolf(x, y)` — wilk;
     - `at(x, y, dist)` — kamera;
     - `run(ticks)` — przewinięcie symulacji.
     Przykład: `const h=__test.home(); __test.place('house',h.x-1,h.y+6); __test.hour(10); __test.at(h.x,h.y+8,7)`.
   - **Nowy albo zmieniony model budynku sprawdzaj na pustej scenie, nie w zwykłej grze:** `?test=1&pusta=1&model=tavern` (opcjonalnie `&rot=1`, `&widok=ground-front`) od razu stawia gotowy, zbudowany model na łące przed twierdzą, w południe, z kamerą od frontu (strona z drzwiami). Obchód: `__test.view(nazwa)` — `front`, `right`, `back`, `left`, `top`, `near`, `door`, `ground-front`, `ground-right`, `ground-back`, `ground-left` (z ziemi, oczami chłopa). Inny model bez przeładowania: `__test.model('house', rot?, widok?)` (poprzedni znika). Na pustej scenie budynki stoją od razu, bez pokazu budowy.
   - Bez Chrome: Playwright + `?test=1` (start ~1,5 s), najlepiej z `&pusta=1`. Pełna grafika w Playwright jest bardzo wolna — unikać.
   - Pojedynczy model: `modele.html?id=house` (podgląd modeli, wdrożony razem z grą; patrz „Modele” wyżej).
3. Modele z Blendera (tools/models): po każdej zmianie budynku `sh tools/models/inspect.sh keep /tmp/keep.png` — arkusz ok. 25 zdjęć (dookoła, z lotu ptaka, od dołu, z ziemi oczami chłopa, przekrój, z oczu człowieka w salach i na murach), z ukrytymi tylnymi ścianami jak w grze, więc odwrócone dachy i dziury widać od razu. Obejrzeć arkusz przed wdrożeniem; widoki z oczu człowieka dopisuje się w skrypcie budynku (klucz `views`).
   - Zawsze sprawdzić budynek też z oczu chłopa (spacer): z ziemi dookoła, od dołu pod okapem i z boku — dach, szczyty i ściany nie mogą znikać ani prześwitywać, także gdy ktoś pracuje w środku (gra zdejmuje wtedy dach w widoku z góry, w spacerze dach ma zostać). Arkusz z inspect.sh ma do tego widoki „z ziemi” i „przy szczycie”. Połacie dachów robić `gable()`/`slope()` z building.py — mają spód, więc okap widać też od dołu.
4. **Dziennik błędów gry i grafiki** (`src/debug/errlog.ts`, od 17.10.2026): łapie wyjątki JS, odrzucone obietnice, `console.error/warn` (także three.js), nieudane wczytanie plików i tekstur, błędy shaderów, utratę kontekstu WebGL, `gl.getError()`, stojący obraz i kamerę z NaN. Każdy czat po większej zmianie sprawdza go:
   - bez przeglądarki Michała: `npm run build && npm run check:console` (Chromium bez okna; kod wyjścia 1 przy błędach; `--url=https://szapiel104.github.io/project-1/` sprawdza wdrożoną wersję, `--pages=...`, `--hd`);
   - w Chrome Michała: `window.__errors()` (lista wpisów, `previous` = dziennik z poprzedniego wejścia, gdy karta się zawiesiła), `__errors.text()` do wklejenia, `__errors.clear()`;
   - w grze: F3 → sekcja „Dziennik błędów” z przyciskiem kopiowania, a przy FPS pojawia się ⚠ z liczbą błędów.
   Znane nieszkodliwe ostrzeżenie biblioteki wyciszamy w miejscu (jak `maxLeafSize` w `cutBox`), nie globalnie.
5. **Przebudowa kodu rysowania bez zmiany obrazu** (np. dzielenie `scene.ts`): spis sceny 3D przed i po — `node tools/check/census.mjs --dist=<build sprzed> --out=a.json`, to samo dla nowego buildu, potem `--compare=a.json,b.json --struct` (budowa sceny) i bez `--struct` (z położeniami). Budowa ma wyjść taka sama poza losowymi rzeczami (krople deszczu, gwiazdy, dym); położenia ludzi i zwierząt różnią się też między dwoma uruchomieniami tego samego buildu, więc porównuj z takim szumem. Build sprzed zrób z czystego `git worktree` (z dodanym tym samym `src/debug/census.ts`). Ok. 5 min na przebieg (Chromium bez karty graficznej).
6. Wydajność: w grze F3 pokazuje okno wydajności; w Chrome `window.__perf()` zwraca FPS, czasy symulacji/rysowania i liczniki.
7. Nie robić serii zrzutów „na wszelki wypadek”; jeden zrzut na zmianę wyglądu wystarczy.
8. **Po skończonym teście zamknij karty, które otworzyłeś w Chrome Michała** (`tabs_close_mcp` na swoje karty; nie ruszaj kart, których nie otworzyłeś). W Playwright zamykaj przeglądarkę (`browser.close()`), a serwer `npx vite` zostaw tylko, jeśli jeszcze go potrzebujesz.

## Modele — gdzie robić i jak sprawdzać (obowiązkowo dla każdego czatu)
1. **Robienie:** modele z Blendera w `tools/models/*.py` (bpy bez okna, `/tmp/bpyenv/bin/python tools/models/X.py`), wynik do `src/render/models/*.json`. Opis narzędzi: `tools/models/README.md`. Budynki przez `building.py` (grupy `base`/`shell`/`interior`…), postacie przez `body.py`, drobne rzeczy jak `yard.py`/`animals.py`.
2. **Sprawdzanie wyglądu — zawsze najpierw w podglądzie modeli, nie w grze:** `https://szapiel104.github.io/project-1/modele.html?id=tavern` (lokalnie `npx vite` → `/modele.html?id=…`). Jeden model na kamiennej podstawce, w powietrzu (`&tlo=powietrze`) albo na trawie (`&tlo=trawa`), w zwykłym świetle i pełnej jakości (zdjęciowe tekstury, cienie, odbicia); myszą obrót, przesuw i przybliżenie; przyciski Noc, Bez dachu, Siatka, Obrót. Na dole liczba trójkątów i siatek oraz wymiary w polach mapy.
   - Nowy model musi trafić na listę w `src/viewer.ts` (`GROUPS`): budynki z `data/buildings.ts` są tam same, resztę (postać, zwierzę, przedmiot) dopisz jedną linijką.
   - Do zrzutów z Chrome/Playwright: `window.__view('tavern', obrótStopnie, nachylenieStopnie)`.
   - **Daleka wersja (LOD) budynków liczy się sama** (`src/render/lod.ts`): mury i dach w grupach `base`/`shell`/`roof`/`chimney`, ruchome i chowane części w osobnych nazwanych grupach (zostają pełne). Nowy budynek sprawdź też przyciskiem „Z daleka” w podglądzie modeli. Szczegóły w `tools/models/README.md`.
3. **Budynki dodatkowo** arkusz `sh tools/models/inspect.sh <id> /tmp/x.png` (dziury, odwrócone dachy, widoki z ziemi i ze środka) — punkt 3 w Testach.
4. **Dopiero na końcu w grze**, na pustej scenie: `?test=1&pusta=1&model=<id>` (gotowy budynek na łące, `__test.view('ground-front')` itd.) — czy pasuje skalą do ludzi, terenu i sąsiadów. Nie sprawdzać nowych modeli w zwykłej rozgrywce ani w trybie deweloperskim.

## Tekstury — po każdej zmianie obowiązkowo KTX2
- Gra wczytuje tekstury ze zdjęć jako `.ktx2` (skompresowane dla karty graficznej, `src/render/ktx.ts`); `.jpg` obok to tylko zapas. Dotyczy `public/textures/terrain/` i `public/textures/cc0/`.
- **Po dodaniu albo podmianie każdego `.jpg` (także mapy normalnych `*_n.jpg`) uruchom:** `node tools/textures/ktx2.mjs public/textures/<folder>/<plik>.jpg` (kilka plików naraz można podać po spacji; bez argumentów przerabia wszystkie, ok. 15 min). Ok. 25 s na teksturę 2K. Bez tego gra pokaże stary `.ktx2` albo weźmie `.jpg`. Wynikowy `.ktx2` commitujemy razem z `.jpg`.
- Wyjątek: małe tekstury z paczek (np. koń `horse_coat*.jpg`, 1024 px) idą jako zwykły JPG przez `THREE.TextureLoader` — ETC1S robiło na nich widoczne kwadraty.
- Import modeli z paczek: przekształcenie osi musi mieć wyznacznik +1 (bez lustra). Lustro odwraca kolejność wierzchołków i gra (bez tylnych ścian) pokazuje model „od środka”, z dziurami — w Blenderze tego nie widać, bo tam rysuje obie strony.
- Nowa tekstura terenu: podbij numer wersji `?v=` w `tex()` w `src/render/ground.ts`.
- Mapy normalnych w konwencji OpenGL (Y w górę); z paczek z DirectX (np. s&box, `cc0-texture-pack`) odwróć kanał zielony.
- Kopie tekstury (`.clone()` dla innej skali) działają, bo `ktx.ts` dopisuje im dane po wczytaniu; nie rysować tekstur z `pattern()` na płótnie (KTX2 nie ma obrazka) — szare wersje robi `grayPattern()` z `.jpg`.
- Źródła: paczki od Michała w Pobranych (`ambientcg_1024.sh3t` — 1K, sam kolor; `cc0-texture-pack-main.zip` — 2K kolor + normalne w formacie `.vtex_c`, dekoder: DXT1/BC7 + LZ4). Strony z teksturami (ambientCG, Poly Haven) są z czatu zablokowane. Każdą nową teksturę wpisz do `CREDITS.md`.

## Pomysły
- **Progresja gracza (poziomy, doświadczenie, rozwój postaci, ranking — kierunek RPG/MMO):** plan i kolejność partii w `docs/progresja.md`. Gdy Michał prosi o coś z tego obszaru, bierz następną nieoznaczoną partię i oznacz ją datą po wdrożeniu.
- Lista kolejnych partii jest w `docs/pomysly.md`. Gdy Michał pyta „co dalej”, podpowiadaj z niej (i dopisuj tam nowe pomysły, zdejmuj zrobione).

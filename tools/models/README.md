# Modele postaci z Blendera (bez okna, sterowane kodem)

**Sprawdzanie:** każdy model najpierw w podglądzie `modele.html?id=<id>` (podstawka, pełna jakość, oblatywanie myszą,
lista modeli w `src/viewer.ts`), potem w grze na pustej scenie `?test=1&pusta=1&model=<id>`. Drewno, płótno, kamień
i ziemia muszą mieć tekstury (`pattern`/`normal` z `src/render/textures.ts`; przykład w `src/render/family.ts` → `yardModel`).
Zasady dla wszystkich czatów są w `CLAUDE.md`, w sekcji „Modele”.

**Sprawdzanie wyglądu:** każdy model najpierw w podglądzie `modele.html?id=<id>` (podstawka / w powietrzu / trawa,
pełna jakość, obrót myszą, liczba trójkątów), potem budynki arkuszem `inspect.sh`, a na końcu w grze na pustej scenie
`?test=1&pusta=1&model=<id>`. Nowy model dopisz do listy `GROUPS` w `src/viewer.ts`. Szczegóły: CLAUDE.md, „Modele”.

Postacie rzeźbi skrypt w Pythonie z Blenderem jako modułem (`bpy`): gładkie bryły (Skin + Subdivision), twarz z
przesunięć kuli, włosy i broda jako powłoki chowające się pod skórę, cień w zagłębieniach liczony promieniami
i zapisany w kolorach wierzchołków. Wynik trafia do `src/render/models/*.json` i gra wczytuje go do `Figures`
(instancjonowane części: tułów stoi, nogi i ręce się obracają) — setki postaci nadal idą kilkoma wywołaniami rysowania.

Przygotowanie (raz):

    uv venv -p 3.11 /tmp/bpyenv && uv pip install -p /tmp/bpyenv/bin/python bpy

Budowa modelu i podgląd (Cycles na procesorze, kilka sekund):

    /tmp/bpyenv/bin/python tools/models/guard.py
    /tmp/bpyenv/bin/python tools/models/render_preview.py guard /tmp/guard.png 0.4      # cała postać
    /tmp/bpyenv/bin/python tools/models/render_preview.py guard /tmp/face.png 0.3 0.62 0.55  # głowa z bliska

Układ współrzędnych: jak w grze (x w prawo, y w górę, twarz w +z). Środki obrotu: biodro `hip`, bark `shoulder`,
dłoń `hand` (w układzie ręki).

Zwierzęta w osadzie (kury, świnia, pies): `/tmp/bpyenv/bin/python tools/models/animals.py` → `src/render/models/animals.json`, podgląd `podglad-zwierzeta.html?osada=1`.

Koń: gotowy model z gry 0 A.D. (CC BY-SA 3.0), `tools/models/horse_0ad.py <0ad>/binaries/data/mods/public/art [--preview /tmp/kon.png]`
→ `src/render/models/horse.json` + `public/textures/cc0/horse_*.jpg` (potem KTX2 dla `horse_coat*.jpg`). Pliki z repozytorium
`0ad/0ad` (sparse checkout: `art/meshes/skeletal/horse_breed.dae`, `art/meshes/props/horse/hair_*_01_breed.dae`,
`art/animation/quadraped/horse_breed_idle_0*.dae`, `art/textures/skins/skeletal/horse_*.png`, `art/textures/skins/props/horse/hair_*.png`).
COLLADA czyta i skóruje sam skrypt (numpy), bez Blendera; pozy (stoi, w pół drogi, skubie, czujny, ogon w bok) idą do gry jako
morph targets, mieszane osobno dla każdego konia w `src/render/horse.ts`. Zgięcie szyi do skubania: słownik `GRAZE` w skrypcie.
Podgląd wszystkich póz w Blenderze: `tools/models/horse_preview.py` (ujęcia side / front / high / back), w grze `modele.html?id=horse`, `?id=horse-graze`, `?id=horse-look`.

## Budynki i obchód

Budynki (np. `keep.py`) korzystają z `building.py`: grupy `base` / `shell` (dachy, znikają przy podglądzie wnętrza) /
`interior` / `floor` (podłoga sypialni) / `ceiling` (sufit, tylko przy spacerze w środku). Plan zamku jest w
`src/data/keep-layout.json` — ten sam czyta symulacja, więc ściany w grze i na modelu się pokrywają.

Po każdej zmianie obchód bez przeglądarki (ok. 2 min, Workbench z ukrytymi tylnymi ścianami jak w grze):

    sh tools/models/inspect.sh keep /tmp/keep.png

Arkusz: 8 widoków dookoła, z lotu ptaka, przekrój bez dachów, od dołu, a także widoki z oczu człowieka zapisane przez
skrypt budynku w kluczu `views` (podpis, oko, cel, grupy, ogniskowa). Nowy budynek (np. lepsza stodoła) dopisuje
swoje `views` i od razu ma ten sam obchód.

### Daleka wersja (LOD) — liczy się sama

Gra sama robi uproszczone wersje każdego budynku (`src/render/lod.ts`, meshoptimizer w osobnym wątku, 3 poziomy
z błędem ok. 0,006 / 0,02 / 0,05 pola). Przy nowym modelu nic nie trzeba dopisywać, wystarczy trzymać się zasad:
- bryły zewnętrzne (mury, dach, komin) w grupach `base` / `shell` / `roof` / `chimney` — tylko je gra upraszcza;
- wszystko, co się rusza albo chowa (wnętrze, sufit, wrota `leafL`/`leafR`, krata, wiatrak `spin`, flagi, ludzie, zapasy,
  ogień, szyby), w osobnej nazwanej grupie — zostaje w pełnej wersji;
- nowa nazwa grupy na zwykłe mury (np. `tower`) też zostanie w pełnej wersji; żeby ją upraszczać, dopisz ją do `LIDS`
  w `src/render/lod.ts` (grupy wieka znikają przy podglądzie wnętrza) albo wrzuć bryły do `base`;
- budynki poniżej ~800 trójkątów brył zewnętrznych nie dostają dalekiej wersji (nie ma czego oszczędzać).

Sprawdzenie: `modele.html?id=<id>` → przycisk „Z daleka” (pełny → 1 → 2 → 3; na dole trójkąty i błąd poziomu),
do zrzutów `window.__view('<id>', obrót, nachylenie, poziom)`, adres `&daleko=1..3`. W grze okno F3, wiersz
„budynki z daleka”; `?lod=0` wyłącza daleką wersję (do porównań). Odległość przełączenia zależy od jakości grafiki
(minimum blisko, Ultra bardzo daleko), test w `tests/lod.test.ts` pilnuje, że obrys się nie kurczy.

Podwórko przy chatach (balia, sznur i pranie, stos polan, ława, kosz, wiadro, grządka): `/tmp/bpyenv/bin/python tools/models/yard.py` → `src/render/models/yard.json`; podgląd w Blenderze `tools/models/yard_preview.py /tmp/yard.png`, w przeglądarce `modele.html?id=yard-tub`. Każda siatka ma pole `mat` (wood / cloth / soil / plain), a gra dobiera do niego teksturę.

Gospodyni i dziecko (rodziny przy chatach): `tools/models/woman.py` → `woman.json`, `tools/models/child.py` → `child.json`; w grze `Figures('woman')` / `Figures('child')`, podgląd `modele.html?id=woman`, `?id=child`.

## Bryły zamknięte
gra nie rysuje tylnych stron ścian, więc otwarta powierzchnia (stożek bez denek `cap_ends=False`, sama płaszczyzna, rurka bez grubości) od tyłu lub od środka po prostu znika. Obręcze, rury, deski i blachy robimy z grubością: wszystkie ściany wokół (np. `ring()` w `yard.py` dla obręczy, `box`, zamknięty `cyl`). Płótno i kartki mają dwie warstwy (jak `cloth()` w `yard.py`). W podglądzie obejrzyj model też od tyłu i od środka.

Kamienna wieża (`stoneTower`, 2×2): `tools/models/stonetower.py` → `stonetower.json`; pomost łuczników na wysokości `deck` (gra: `STONE_TOWER_TOP`). Podgląd `modele.html?id=stoneTower`, w grze `?test=1&pusta=1&model=stoneTower`.

## Las z Poly Haven (drzewa robione przez grafików)

`tools/models/forest_polyhaven.py` przerabia gotowe drzewa z Poly Haven (paczki glTF 1K, rozpakowane do katalogu
po jednym podkatalogu na id) na wersję do gry: pień zostaje bryłą (Decimate), koronę Blender fotografuje plastrami
(pionowe z trzech stron i poziome od góry) i składa z nich kilkadziesiąt kart z prawdziwymi igłami i liśćmi; do tego
obrazek z daleka z 8 stron. Wynik: `src/render/models/forest.json`, tekstury `public/textures/cc0/pv_*.jpg` (maski `_a.jpg`
idą do kanału alfa `.ktx2`, więc po przebiegu: `node tools/textures/ktx2.mjs public/textures/cc0/pv_*.jpg`).
W grze: `src/render/forest.ts` (odmiany według ról conifer / leaf / sapling), generator lasu w `terrain.ts`.

    /tmp/bpyenv/bin/python tools/models/forest_polyhaven.py /ścieżka/do/paczek [id ...]

## Trawa z Poly Haven (kępy robione przez grafików)

`tools/models/grass_polyhaven.py` fotografuje gotowe kępy z Poly Haven (paczki glTF 1K + osobne maski `_alpha_1k.jpg`
i suche kolory `_dry_diff_1k.jpg`, bo JPG w paczce glTF nie ma przezroczystości) w atlas 4×2 pól po 0,42 m:

    /tmp/bpyenv/bin/python tools/models/grass_polyhaven.py /ścieżka/do/paczek

Wynik: `public/textures/cc0/pv_grass.jpg`, `pv_grass_a.jpg` (maska), `pv_grass_dry.jpg`. Kolejność pól zna `src/render/grass.ts`
(`TILE_WEIGHTS`), więc po zmianie listy `TILES` popraw też wagi. Tekstury idą przez płótno z maską (`maskedTex`), bez KTX2.

## Gotowe modele z paczek (ryba, pochodnia wyciągana w spacerze, kosz z wikliny)

`tools/models/props_import.py <katalog>` przerabia paczki glTF (BarramundiFish.glb, torch.glb — źródła w `CREDITS.md`)
na `src/render/models/props.json` i tekstury `public/textures/cc0/prop_*.jpg` (potem `node tools/textures/ktx2.mjs
public/textures/cc0/prop_*.jpg`). **Wersja z bliska idzie do gry bez przeróbek**: oryginalne trójkąty, UV i normalne,
pozycje w float32. Właśnie odchudzanie, własne UV i zaokrąglanie pozycji psuły wcześniej gotowe modele w grze („pocięte”).
Otwarte części (płetwy) rysuje gra z obu stron (materiał dwustronny w `src/render/props.ts`).

Przed wgraniem zawsze: `tools/models/props_check.py <katalog> /tmp/props.png` — arkusz: oryginał | gra z bliska | gra
z daleka, z dwóch stron, złożony z tych samych buforów co w przeglądarce. Test `tests/props.test.ts` pilnuje liczby
trójkątów i wymiarów. Ryby w budynkach (suszarnia i kosz u rybaka, stół w kuchni twierdzy) zapisują skrypty budynków
tylko jako miejsca (`fishSpots`), a rybę z paczki wstawia gra (`buildingFish` w `src/render/buildings.ts`).

Kosze: w skryptach budynków nadal piszemy `b.prism(grupa, 'basket', r0, r1, h, x, y, z)`, ale `building.py` nie robi
z tego brył — zapisuje miejsce i wymiary w kluczu `baskets`, a gra (`blenderModel` w `src/render/buildings.ts`) stawia
tam kosz z paczki (`basketAt` w `src/render/props.ts`). Tak samo kosz niesiony (`loads.ts`), w składzie (`inBasket`)
i z praniem przy chacie (`family.ts`). Odchudzać wolno tylko modele, które mają szczegóły w teksturze, nie w geometrii
— najpierw próba z oryginałem obok (jak przy koszach: wicker_basket_01 z prętów się rozpadał, 02 nie).

Jabłka i chleb w budynkach: `b.apple(grupa, x, y, z, w, rot)` i `b.bun(grupa, x, y, z, w, rot)` z `building.py` zapisują
miejsca (klucz `foods`), a jabłka (najlżejsza wersja, `appleLow`) i bochenki (trzy skany na zmianę) stawia gra
(`foodGeos` w `src/render/buildings.ts`). Nie robić jabłek ani chleba z brył (`'apple'`, `'bread'`) — to wyglądało jak
graniastosłupy. Bryły z tymi materiałami zostały tylko tam, gdzie nie są jedzeniem z koszyka: szyld z obwarzankiem
(piekarnia), zacier w kadzi (browar), kwiaty w skrzynce na oknie (chata), wiszące pęki pod belkami (chata, karczma).

## Krzaki z Poly Haven (krzewy robione przez grafików)

`tools/models/bushes_polyhaven.py` składa kilka krzewów Searsia lucida (paczka glTF 1K + maska `_alpha_1k.jpg`) w gęste
kępy (odmiany w `BUSHES`), barwi liście na leśną zieleń i fotografuje je jak korony drzew: pionowe plastry z 4 stron
i poziome od góry → karty (ok. 56 trójkątów), obrazek z daleka z 8 stron, bryła cienia:

    /tmp/bpyenv/bin/python tools/models/bushes_polyhaven.py /ścieżka/do/paczek
    COMPARE=1 ... → /tmp/bush_cmp_pv_bush_<odmiana>.png (oryginał nad kartami; Cycles cieniuje karty inaczej niż gra,
                    więc to tylko kontrola obrysu i gęstości — wygląd sprawdza się w modele.html)

Wynik: `src/render/models/bushes.json`, `public/textures/cc0/pv_bush_<odmiana>_{cards,far}.jpg` (+ `_a` maska, przez płótno,
bez KTX2). W grze `bushKinds()` w `src/render/forest.ts`, rozkład w `terrain.ts`; podgląd `modele.html?id=bush-a`.
**Zawsze porównaj wersję do gry z pobranym modelem** (podgląd modeli w pełnej jakości obok renderu oryginału) — ma wyglądać tak samo, nie gorzej.

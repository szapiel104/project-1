# Zasoby z zewnątrz

## Tekstury (CC0)
Zdjęciowe tekstury bruku, desek i tynku (`public/textures/cc0/`) pochodzą z [ambientCG](https://ambientcg.com) — licencja CC0 1.0 (domena publiczna):
- Paving Stones 138 → `cobble.jpg`, `cobble_n.jpg`
- Planks 039 → `planks.jpg`, `planks_n.jpg`
- Plaster 007 → `plaster.jpg`, `plaster_n.jpg`

Dalsze tekstury ambientCG (CC0), z paczki ambientcg_1024 dostarczonej przez Michała:
- Roofing Tiles 005 → `slate.jpg` (łupek na wieżach zamku)
- Bricks 091 → `ashlar.jpg` (mury zamku)
- Bricks 076 A → `bricks.jpg` (kamienne podmurówki)
- Fabric 011 → `burlap.jpg` (płótno worków i flag)
- Grass 004 → `grass.jpg` (trawa)
- Ground 072 → `soil.jpg` (ziemia, pola, ścieżki)
- Rock 022 → `rock.jpg` (głazy, kamieniołom)
- Bark 001 → `bark.jpg` (kora drzew, bale palisady, pniaki)
- Fabric 043 → `wool.jpg` (filcowana wełna ubrań postaci z bliska)
- Metal 021 → `iron.jpg` (kute żelazo z rdzą: pancerze, miecze, narzędzia)
- Chainmail 004 → `mail.jpg` (kolczugi strażników i włóczników)

Las: drzewa z [Poly Haven](https://polyhaven.com) (CC0) — [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), [Island Tree 01](https://polyhaven.com/a/island_tree_01), [Island Tree 02](https://polyhaven.com/a/island_tree_02), [Fir Sapling Medium](https://polyhaven.com/a/fir_sapling_medium). Przerobione w Blenderze skryptem `tools/models/forest_polyhaven.py` (pień odchudzony, korona sfotografowana warstwami na karty, obrazek z daleka z 8 stron) → `src/render/models/forest.json` i `public/textures/cc0/pv_*.jpg` (kora z paczek zmniejszona do 512 px).
Trawa: kępy z [Poly Haven](https://polyhaven.com) (CC0) — [Grass Medium 01](https://polyhaven.com/a/grass_medium_01), [Grass Medium 02](https://polyhaven.com/a/grass_medium_02), [Grass Bermuda 01](https://polyhaven.com/a/grass_bermuda_01), [Dandelion 01](https://polyhaven.com/a/dandelion_01). Sfotografowane w Blenderze skryptem `tools/models/grass_polyhaven.py` w atlas 4×2 → `public/textures/cc0/pv_grass.jpg` (+ `_a` maska) i `pv_grass_dry.jpg` (sucha wersja z paczek, jesień).

Krzaki: [Searsia Lucida](https://polyhaven.com/a/searsia_lucida) z [Poly Haven](https://polyhaven.com) (CC0) — kilka krzewów zsuniętych w kępę, liście przyciemnione do zieleni, sfotografowane w Blenderze skryptem `tools/models/bushes_polyhaven.py` na karty i obrazek z daleka → `src/render/models/bushes.json` i `public/textures/cc0/pv_bush_*.jpg`.

Strzecha: [Thatch Roof Angled](https://polyhaven.com/a/thatch_roof_angled) z Poly Haven (CC0) → `thatch.jpg`; mapa normalnych liczona z mapy przemieszczeń.
Dla tekstur bez mapy normalnych mapa jest liczona z jasności obrazu.

Pierwsze trzy pobrane przez repozytorium [null3d-engine/sample-assets](https://github.com/null3d-engine/sample-assets). Zmiany: kolor zamieniony na odcienie szarości i rozjaśniony (barwę nadaje materiał w grze).

## Podłoże i teren (ambientCG, CC0) — `public/textures/terrain/`
- Grass 001 → `grass1.jpg`, Grass 004 → `grass2.jpg` (trawa w dwóch odmianach)
- Ground 003 → `meadow.jpg` (łąka z prześwitami ziemi i kamykami)
- Ground 015 → `forest.jpg` (ściółka leśna: igliwie, patyki)
- Ground 062 S → `pebble.jpg` (żwir, złoża kamienia)
- Ground 044 → `dirt.jpg` (wydeptana ziemia)
- Rock 022 → `rock.jpg` (skała na zboczach)
- Mapy normalnych `*_n.jpg` policzone z jasności zdjęć.
- Rock 026 → `cliff.jpg` (poszarpane turnie w górach)
- Ground 079 S → `sand.jpg` (plaże nad jeziorami i morzem)
- W 2K (od 16.10.2026): Grass 001, Grass 004, Ground 015, Ground 044, Rock 022, Rock 026 wraz z mapami normalnych — z paczki cc0-texture-pack (te same tekstury ambientCG przekonwertowane do s&box) dostarczonej przez Michała, zdekodowane z powrotem do JPG; łąka, żwir i piasek dalej w 1K

## Muzyka (CC0)
RandomMind — „Medieval: King's Feast”, „Minstrel Dance”, „The Old Tower Inn”, „Medieval Battle”; nihilocrat — „Peasant Theme”; Tozan — „Medievals 5”. Wszystkie z OpenGameArt na licencji CC0 (szczegóły w docs/zasoby.md). Dziękujemy autorom.

## Rośliny wodne
Pałka wodna (`cattails.dae`, `cattails_1.png`, `cattails_2.png`) i kożuch liści na stawie (`pond_lillies_large.dae`, `water_plants_lg.dds`): gra **0 A.D.** © Wildfire Games (https://www.wildfiregames.com/), licencja CC BY-SA 3.0 (http://creativecommons.org/licenses/by-sa/3.0/). Przeniesione bez zmian rysunku skryptem `tools/models/water_plants_0ad.py` (obrót osi, skala do pól, kolor rozlany pod przezroczystymi pikselami) → `src/render/models/waterplants.json`, `public/textures/cc0/oad_*.jpg`; te pliki udostępniamy na tej samej licencji CC BY-SA 3.0.

## Dźwięki natury
Śpiew ptaków, odgłosy wsi, kury, róg alarmu i grzmot: gra **0 A.D.** © Wildfire Games (https://www.wildfiregames.com/), licencja CC BY-SA 3.0 (http://creativecommons.org/licenses/by-sa/3.0/). Świerszcze i dzwon: Freesound (rsn267, beambot, Nox_Sound), CC0. Szczegóły w docs/zasoby.md.

## Koń
Koń przy koszarach: model `horse_breed` z grą **0 A.D.** © Wildfire Games (https://play0ad.com, kod i grafika w repozytorium https://github.com/0ad/0ad) — siatka ciała, grzywa i ogon (`hair_*_01_breed`), szkielet, ruch spoczynkowy (`horse_breed_idle_01/02`) i tekstury (`horse_bay_01`, `horse_norm`, `hair_black`), licencja [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/). Przerobione skryptem `tools/models/horse_0ad.py` (pozy wypieczone ze szkieletu, wygładzone normalne, skala do naszej gry) → `src/render/models/horse.json`, `public/textures/cc0/horse_*.jpg`/`.ktx2`; nasza wersja jest na tej samej licencji.

## Postacie ze szkieletem
- Ciało i szkielet: MPFB / MakeHuman Community (https://static.makehumancommunity.org), wynik na licencji CC0.
- Ruch: Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu), konwersja BVH B. Hahne (cgspeed). Dane wolne do użytku, także w grach.

Ryba: [Barramundi Fish](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) z KhronosGroup glTF-Sample-Assets, © 2017 Microsoft, CC0. Pochodnia wyciągana w spacerze: model `torch.glb` z gry [Secret Histories](https://github.com/Mooses2k/SecretHistories) (Mooses2k), licencja grafiki [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — nasza wersja (`src/render/models/props.json` w części `torch`, `public/textures/cc0/prop_torch*.jpg`) jest na tej samej licencji. Przerobione w Blenderze skryptem `tools/models/props_import.py` bez odchudzania (tylko skala i ustawienie, tekstury w rozdzielczości paczki); porównanie z oryginałem: `tools/models/props_check.py`.

Kosz z wikliny: [Wicker Basket 02](https://polyhaven.com/a/wicker_basket_02) z Poly Haven (CC0), bez wieka — wszystkie kosze w grze (niesione przez chłopów, w składzie i spichlerzu, w budynkach, przy chatach). Skrypt `tools/models/props_import.py` (oryginał, bez odchudzania) → `props.json` (`basket`), `public/textures/cc0/prop_basket*.jpg`. [Wicker Basket 01](https://polyhaven.com/a/wicker_basket_01) pobrany i odrzucony: pręty z geometrii rozpadają się przy każdym odchudzeniu, a w pełnej wersji ma 22 tys. trójkątów.

Jabłko, chleb i beczka piwa z Poly Haven (CC0, skany): [Food Apple 01](https://polyhaven.com/a/food_apple_01), [Hamburger Buns](https://polyhaven.com/a/hamburger_buns) (trzy bochenki), [Wine Barrel 01](https://polyhaven.com/a/wine_barrel_01). Skrypt `tools/models/props_import.py` (oryginały, bez odchudzania) → `props.json`, `public/textures/cc0/prop_{apple,bread,barrel}*.jpg`.

Skład (kamień, zboże, żelazo) — modele z [Sketchfab](https://sketchfab.com), licencja [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), przerobione skryptem `tools/models/stock_import.py` bez odchudzania (tylko skala i ustawienie, tekstury w rozdzielczości paczki) → `props.json` (`granite1–3`, `sheaf`, `ingots`), `public/textures/cc0/prop_{granite1,granite2,granite3,sheaf,ingots}*.jpg`:
- [Granite block](https://sketchfab.com/3d-models/granite-block-ffb822afb855487885addfa7dfe13ac2) — autor [matousekfoto](https://sketchfab.com/matousekfoto) (skan fotogrametryczny),
- [KCISA-볏단 (Sheaf of Rice)](https://sketchfab.com/3d-models/kcisa-sheafofrice-f89a4abb08b94a70956d9d038208c6ff) — autor [Korea Culture Information Service Agency](https://sketchfab.com/kcisameta),
- [Blacksmith Ingots (game ready asset)](https://sketchfab.com/3d-models/blacksmith-ingots-game-ready-asset-6ea0ab1141de40d68db5bcdccdb91d68) — autor [Aparicio Silva 3D](https://sketchfab.com/apariciosilva3D) (w grze tylko trzy żelazne sztaby).

Worek z płótna: własny model z Blendera (`tools/models/sack.py`, symulacja tkaniny), tekstura juty `burlap.jpg` (ambientCG Fabric 011, CC0, wyżej).

## Kruk
„Raven” z [OpenGameArt](https://opengameart.org/content/raven-0), CC0 — przeróbka `tools/models/crow_import.py` → `public/textures/crow.png` (szczegóły w docs/zasoby.md).

## Efekty dźwiękowe i głosy
- Kenney — [Starter Kit City Builder](https://github.com/KenneyNL/starter-kit-city-builder) i [Starter Kit 3D Platformer](https://github.com/KenneyNL/starter-kit-3d-platformer) (MIT, © Kenney; licencja wymaga zachowania tej informacji), „RPG Audio” i „Impact Sounds” (CC0).
- „RPG Sound Pack”, artisticdude, OpenGameArt (CC0).
- Krzyki, okrzyki i buchnięcie pochodni: Freesound przez [C-Dogs SDL](https://github.com/cxong/cdogs-sdl) — JohnsonBrandEditing, davdud101, Adam_N, Julien Matthey (CC0).
Pełna lista plików w docs/zasoby.md.

## Podpis w grze
Autorzy grafiki na licencjach CC BY i CC BY-SA są wymienieni w grze: Ustawienia → Autorzy; dźwięki i muzyka: Ustawienia → Dźwięk.

## Nazwy i świat gry
Zakony, bóstwa, miejsca i postacie w grze są nasze (np. Zakon Płomienia, Bractwo Źródła, Ojciec Płomienia). Gra nie używa nazw, postaci ani grafiki z innych gier.

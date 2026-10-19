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

## Dźwięki natury
Śpiew ptaków, odgłosy wsi, kury, róg alarmu i grzmot: gra **0 A.D.** © Wildfire Games (https://www.wildfiregames.com/), licencja CC BY-SA 3.0 (http://creativecommons.org/licenses/by-sa/3.0/). Świerszcze i dzwon: Freesound (rsn267, beambot, Nox_Sound), CC0. Szczegóły w docs/zasoby.md.

## Postacie ze szkieletem
- Ciało i szkielet: MPFB / MakeHuman Community (https://static.makehumancommunity.org), wynik na licencji CC0.
- Ruch: Carnegie Mellon University Graphics Lab Motion Capture Database (http://mocap.cs.cmu.edu), konwersja BVH B. Hahne (cgspeed). Dane wolne do użytku, także w grach.

Ryba: [Barramundi Fish](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) z KhronosGroup glTF-Sample-Assets, © 2017 Microsoft, CC0. Pochodnia wyciągana w spacerze: model `torch.glb` z gry [Secret Histories](https://github.com/Mooses2k/SecretHistories) (Mooses2k), licencja grafiki [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — nasza wersja (`src/render/models/props.json` w części `torch`, `public/textures/cc0/prop_torch*.jpg`/`.ktx2`) jest na tej samej licencji. Przerobione w Blenderze skryptem `tools/models/props_import.py` bez odchudzania wersji z bliska (tylko skala, ustawienie i tekstury 1024 px); wersje z daleka odchudzone, porównanie z oryginałem: `tools/models/props_check.py`.

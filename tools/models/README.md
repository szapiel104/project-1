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

Zwierzęta w osadzie (kury, świnia, koń, pies): `/tmp/bpyenv/bin/python tools/models/animals.py` → `src/render/models/animals.json`, podgląd `podglad-zwierzeta.html?osada=1`.

## Budynki i obchód

Budynki (np. `keep.py`) korzystają z `building.py`: grupy `base` / `shell` (dachy, znikają przy podglądzie wnętrza) /
`interior` / `floor` (podłoga sypialni) / `ceiling` (sufit, tylko przy spacerze w środku). Plan zamku jest w
`src/data/keep-layout.json` — ten sam czyta symulacja, więc ściany w grze i na modelu się pokrywają.

Po każdej zmianie obchód bez przeglądarki (ok. 2 min, Workbench z ukrytymi tylnymi ścianami jak w grze):

    sh tools/models/inspect.sh keep /tmp/keep.png

Arkusz: 8 widoków dookoła, z lotu ptaka, przekrój bez dachów, od dołu, a także widoki z oczu człowieka zapisane przez
skrypt budynku w kluczu `views` (podpis, oko, cel, grupy, ogniskowa). Nowy budynek (np. lepsza stodoła) dopisuje
swoje `views` i od razu ma ten sam obchód.

Podwórko przy chatach (balia, sznur i pranie, stos polan, ława, kosz, wiadro, grządka): `/tmp/bpyenv/bin/python tools/models/yard.py` → `src/render/models/yard.json`; podgląd w Blenderze `tools/models/yard_preview.py /tmp/yard.png`, w przeglądarce `modele.html?id=yard-tub`. Każda siatka ma pole `mat` (wood / cloth / soil / plain), a gra dobiera do niego teksturę.

Gospodyni i dziecko (rodziny przy chatach): `tools/models/woman.py` → `woman.json`, `tools/models/child.py` → `child.json`; w grze `Figures('woman')` / `Figures('child')`, podgląd `modele.html?id=woman`, `?id=child`.

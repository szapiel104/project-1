# Modele postaci z Blendera (bez okna, sterowane kodem)

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

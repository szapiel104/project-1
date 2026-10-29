"""Drzwi kamiennej wieży jako osobna część (jak drzwi od frontu w stonetower.py): kamienne obramienie z nadprożem,
ciemna wnęka, okute skrzydło z desek i kołatka. Gra stawia je tam, gdzie powstaje nowe wejście do wieży:
na wysokości korony muru, gdy mur dochodzi do wieży (bez schodków — podłogą jest korona), i przy ziemi, gdy wejście
przeszło na inny bok (wtedy ze schodkami z grupy 'steps').

Układ: lico ściany wieży w z = 0, drzwi patrzą w +z (na zewnątrz), próg w y = 0, schodki schodzą do y = -0.28.
Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/towerdoor.py  →  src/render/models/towerdoor.json
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
Y = -0.28        # jak w stonetower.py: tam próg leży 0,28 nad ziemią

# obramienie i nadproże z ciemniejszych ciosów, wnęka, cztery deski skrzydła, dwa okucia i kołatka
b.box('base', 'castleDark', 0.5, 0.82, 0.06, 0, 0.28 + Y, 0.02)
b.box('base', 'castleDark', 0.56, 0.08, 0.08, 0, 1.08 + Y, 0.03)
b.box('base', 'dark', 0.38, 0.72, 0.03, 0, 0.28 + Y, 0.045)
for i in range(4):
    b.box('base', 'woodDark', 0.085, 0.68, 0.035, -0.135 + i * 0.09, 0.28 + Y, 0.06)
for y in (0.42, 0.78):
    b.box('base', 'iron', 0.36, 0.035, 0.012, 0, y + Y, 0.08)
b.prism('base', 'iron', 0.025, 0.025, 0.01, 0.1, 0.6 + Y, 0.085, seg=8, top=True)

# schodki pod drzwi (tylko przy ziemi)
b.box('steps', 'stoneDark', 0.6, 0.1, 0.22, 0, 0.0 + Y, 0.2, bottom=False)
b.box('steps', 'stoneDark', 0.56, 0.09, 0.14, 0, 0.1 + Y, 0.14)
b.box('steps', 'stoneDark', 0.52, 0.09, 0.08, 0, 0.19 + Y, 0.12)

VIEWS = [['drzwi', [0.4, 0.3, 1.6], [0, 0.2, 0], ['base', 'steps'], 22]]
b.save('towerdoor', maxe=0.2, rays=12, reach=0.2, extra={'views': VIEWS})

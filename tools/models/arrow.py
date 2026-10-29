"""Strzała (Michał 29.10.2026: „strzały za duże, popraw ich obiekt”): cienkie drzewce, żelazny grot (czworoboczny, jak
bełt do przebijania kolczugi) z tulejką, trzy lotki z piór i nasadka na cięciwę. W skali ludzi w grze (chłop ok. 0,5):
cała strzała 0,24, czyli mniej więcej do pasa — wcześniej była długa jak człowiek.

Leży pionowo: grot w górę (+y), nasadka w y = 0; gra obraca ją grotem w kierunku lotu. Te same bryły rysuje gra dla
strzał w locie, wbitych w ziemię, ściany i poległych (src/render/arrows.ts — jedna siatka, kolory z materiałów).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/arrow.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
L = 0.24          # długość drzewca z nasadką
R = 0.0032        # promień drzewca

b.prism('base', 'woodDark', 0.0042, 0.0042, 0.008, 0, 0.0, 0, seg=6)                 # nasadka (ciemniejsza)
b.prism('base', 'wood', R, R, L - 0.03, 0, 0.006, 0, seg=6)                          # drzewce
b.prism('base', 'iron', 0.0045, 0.0045, 0.01, 0, L - 0.028, 0, seg=6)                # tulejka grotu
b.prism('base', 'iron', 0.007, 0.0, 0.034, 0, L - 0.019, 0, seg=4, phase=0.785)      # grot: czworoboczny szpic
# lotki: trzy pióra co 120°, skośnie ścięte z przodu, tuż za nasadką
for k in range(3):
    a = k * 2 * math.pi / 3
    cx, cz = math.sin(a) * (R + 0.0045), math.cos(a) * (R + 0.0045)
    b.box('base', 'white' if k else 'red', 0.0012, 0.05, 0.009, cx, 0.014, cz, rot=a)

b.save('arrow', maxe=0.2, rays=6, reach=0.02, extra={'views': [['strzała', [0.15, 0.15, 0.35], [0, 0.12, 0], ['base'], 20]]})

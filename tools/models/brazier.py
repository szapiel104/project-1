"""Koksownik na mur i wieżę: kuty żelazny kosz z prętów na trzech wygiętych nogach, w nim żar (węgiel i szczapy),
pod spodem kamienna płyta, żeby żar nie przepalił desek pomostu. Obok wiadro z piaskiem i pęk strzał owiniętych
pakułami — tu łucznicy maczają groty.

Płomień rysuje gra (system ognia, punkt 'flame' z pliku); kosz płonie dniem i nocą.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/brazier.py  →  src/render/models/brazier.json
Układ: środek kosza w (0, 0), stoi na y = 0; całość mieści się w ok. 0,5 × 0,5 pola, wysokość kosza ok. 0,45.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()

# kamienna płyta pod koksownikiem (gruba, z fazą)
b.box('base', 'castleDark', 0.38, 0.035, 0.38, 0, 0.0, 0, bottom=False)
b.box('base', 'stoneDark', 0.34, 0.02, 0.34, 0, 0.035, 0)
Y0 = 0.055

# trzy nogi: proste pręty od łapy skośnie do spodu kosza (zbiegają się ku środkowi), z płaską łapą na dole
YB = Y0 + 0.3
for k in range(3):
    a = 2 * math.pi * k / 3 + 0.3
    sa, ca = math.sin(a), math.cos(a)
    lean = math.atan2(0.17 - 0.09, YB - Y0)
    b.box('base', 'iron', 0.022, math.hypot(0.08, YB - Y0) + 0.02, 0.022, sa * 0.17, Y0, ca * 0.17, rot=a, tilt=-lean)
    b.box('base', 'iron', 0.05, 0.015, 0.075, sa * 0.175, Y0, ca * 0.175, rot=a)
    # wolute pod koszem: krótki pręt łączący nogę z obręczą dna
    b.box('base', 'iron', 0.02, 0.02, 0.06, sa * 0.1, YB - 0.01, ca * 0.1, rot=a)

# kosz: dno (misa) i pręty wygięte w kielich, dwie obręcze
b.prism('base', 'iron', 0.07, 0.13, 0.05, 0, YB, 0, seg=12)           # misa (ma dno, wierzch przykryje żar)
# pręty rozchylone na zewnątrz (kielich): od brzegu misy (r 0,125) do górnej obręczy (r 0,175), końcami w obręczy
FLARE = math.atan2(0.05, 0.16)
for k in range(12):
    a = 2 * math.pi * (k + 0.5) / 12
    sa, ca = math.sin(a), math.cos(a)
    b.box('base', 'iron', 0.016, 0.175, 0.016, sa * 0.125, YB + 0.03, ca * 0.125, rot=a, tilt=FLARE)
TOP = YB + 0.03 + 0.16
# obręcze z grubością (zamknięte pierścienie z pudełek), obie na prętach: dolna przy misie, górna przy końcach prętów
for (yy, r) in ((YB + 0.045, 0.13), (TOP - 0.012, 0.176)):
    n = 16
    for k in range(n):
        a = 2 * math.pi * k / n
        b.box('base', 'iron', 2 * r * math.sin(math.pi / n) + 0.006, 0.022, 0.02, math.sin(a) * r, yy, math.cos(a) * r, rot=a)

# żar: kopczyk węgla i kilka szczap
b.prism('base', 'ash', 0.125, 0.11, 0.03, 0, YB + 0.05, 0, seg=12)
for k in range(9):
    a = k * 2.399
    r = 0.025 + 0.075 * ((k * 0.618) % 1)
    b.crystal('base', 'ember', math.sin(a) * r, YB + 0.085, math.cos(a) * r, 0.035, seed=k * 1.7, sy=0.7)
for k, (a, tilt) in enumerate(((0.4, 0.5), (2.3, -0.45), (4.1, 0.55))):
    b.box('base', 'woodDark', 0.03, 0.14, 0.03, math.sin(a) * 0.05, YB + 0.07, math.cos(a) * 0.05, rot=a, tilt=tilt)

# wiadro z piaskiem (do gaszenia) i pęk strzał z pakułami obok płyty
b.prism('base', 'woodDark', 0.055, 0.065, 0.11, 0.28, 0.0, 0.13, seg=10, top=False)
b.prism('base', 'soil', 0.058, 0.058, 0.01, 0.28, 0.095, 0.13, seg=10)
for yy in (0.02, 0.08):
    b.prism('base', 'iron', 0.061 + yy * 0.08, 0.062 + yy * 0.08, 0.012, 0.28, yy, 0.13, seg=10, top=False)
# kołczan z deski (skrzynka) i strzały z pakułami na grotach
b.box('base', 'woodDark', 0.1, 0.16, 0.08, 0.25, 0.0, -0.16, bottom=False)
for k in range(5):
    ox, oz = (k % 3 - 1) * 0.025, (k // 3 - 0.5) * 0.025
    b.box('base', 'wood', 0.012, 0.3, 0.012, 0.25 + ox, 0.05, -0.16 + oz)
    b.prism('base', 'rope', 0.016, 0.01, 0.045, 0.25 + ox, 0.34, -0.16 + oz, seg=6)

b.save('brazier', maxe=0.08, rays=16, reach=0.12, grime=False, extra={'flame': [0, round(YB + 0.12, 3), 0]})

"""Skład (2×2 pola): ubity plac wyłożony deskami na legarach, ogrodzony z trzech stron płotem z żerdzi na słupkach
(przód otwarty), z przodu tablica z karbami do liczenia zapasów i taczka. Na środku wolna podłoga 3×3 miejsc: tam gra układa towary według stanu składu.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/stockpile.py
Układ: środek działki = (0, 0), działka ±1, przód = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
F = 0.06          # wierzch podłogi (na niej gra kładzie towary)
E = 0.95          # płot

# ---------------- podłoga: legary i deski z przerwami ----------------
b.box('base', 'soil', 1.96, 0.02, 1.96, 0, 0, 0)
for z in (-0.7, 0.0, 0.7):
    b.box('base', 'woodDark', 1.8, 0.03, 0.08, 0, 0.02, z)
n = 13
for k in range(n):
    x = -0.86 + k * (1.72 / (n - 1))
    w = 1.72 / (n - 1) - 0.012
    b.box('base', 'plank', w, 0.01, 1.78 - (0.04 if k % 3 == 1 else 0.0), x, F - 0.01, 0.0)

# ---------------- płot z żerdzi: tył i boki, przód otwarty ----------------
def rail_x(x0, x1, y, z, r=0.022):
    seg = 6
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        b.poly('base', 'bark', [(x0, y + math.cos(a0) * r, z + math.sin(a0) * r), (x1, y + math.cos(a0) * r, z + math.sin(a0) * r),
                                 (x1, y + math.cos(a1) * r, z + math.sin(a1) * r), (x0, y + math.cos(a1) * r, z + math.sin(a1) * r)], away=((x0 + x1) / 2, y, z))
    for xx, s in ((x0, -1), (x1, 1)):
        b.poly('base', 'wood', [(xx, y + math.cos(2 * math.pi * k / seg) * r, z + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)], away=(xx - s, y, z))


def rail_z(z0, z1, y, x, r=0.022):
    seg = 6
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        b.poly('base', 'bark', [(x + math.sin(a0) * r, y + math.cos(a0) * r, z0), (x + math.sin(a0) * r, y + math.cos(a0) * r, z1),
                                 (x + math.sin(a1) * r, y + math.cos(a1) * r, z1), (x + math.sin(a1) * r, y + math.cos(a1) * r, z0)], away=(x, y, (z0 + z1) / 2))
    for zz, s in ((z0, -1), (z1, 1)):
        b.poly('base', 'wood', [(x + math.sin(2 * math.pi * k / seg) * r, y + math.cos(2 * math.pi * k / seg) * r, zz) for k in range(seg)], away=(x, y, zz - s))


posts = [(-E, -E), (-E / 3, -E), (E / 3, -E), (E, -E), (-E, -E / 3), (-E, E / 3), (-E, E), (E, -E / 3), (E, E / 3), (E, E)]
for x, z in posts:
    b.prism('base', 'bark', 0.035, 0.03, 0.5, x, 0.0, z, seg=6)
    b.prism('base', 'wood', 0.03, 0.0, 0.05, x, 0.5, z, seg=6)
for y in (0.2, 0.4):
    rail_x(-E - 0.03, E + 0.03, y, -E - 0.035)
    rail_z(-E - 0.03, E + 0.03, y, -E - 0.035)
    rail_z(-E - 0.03, E + 0.03, y, E + 0.035)

# ---------------- tablica z karbami przy prawym słupku z przodu ----------------
b.box('base', 'woodDark', 0.04, 0.62, 0.04, E + 0.08, 0.0, E - 0.02)
b.box('base', 'wood', 0.03, 0.24, 0.3, E + 0.11, 0.38, E - 0.02)
for k in range(7):
    b.box('base', 'dark', 0.012, 0.1 if k % 5 != 4 else 0.16, 0.012, E + 0.13, 0.45, E - 0.14 + k * 0.035, rot=0.0 if k % 5 != 4 else 0.9)

# ---------------- taczka przy lewym przednim rogu (na zewnątrz płotu) ----------------
TX, TZ = -E + 0.12, E + 0.2
b.box('base', 'wood', 0.22, 0.03, 0.3, TX, 0.13, TZ)                    # dno skrzyni
for s in (-1, 1):
    b.box('base', 'woodDark', 0.02, 0.1, 0.3, TX + s * 0.11, 0.13, TZ)    # burty
b.box('base', 'woodDark', 0.22, 0.1, 0.02, TX, 0.13, TZ - 0.15)
for s in (-1, 1):
    b.box('base', 'woodDark', 0.025, 0.025, 0.42, TX + s * 0.09, 0.12, TZ + 0.12, tilt=0.25)   # rączki
    b.box('base', 'woodDark', 0.025, 0.12, 0.025, TX + s * 0.09, 0.0, TZ + 0.12)              # nóżki
rail_x(TX - 0.018, TX + 0.018, 0.07, TZ - 0.2, r=0.07)                       # koło (krążek z grubością)
b.box('base', 'iron', 0.07, 0.015, 0.015, TX, 0.063, TZ - 0.2)                 # oś

VIEWS = [
    ['skład z przodu', [0.3, 0.6, 2.4], [0, 0.2, 0], ['base'], 22],
]
b.save('stockpile', maxe=0.22, rays=16, reach=0.3, extra={'floorY': F, 'views': VIEWS})

"""Cmentarz (3×3 pola): kamienna kapliczka z łupkowym dachem, sygnaturką z dzwonkiem i krzyżem w lewym tylnym
rogu, rzędy mogił (kopczyki ziemi z darnią) z drewnianymi krzyżami, kilka kamiennych nagrobków, świeżo wykopany
dół z łopatą i kopcem ziemi, płot z żerdzi na słupkach z bramką z przodu, ławka i stara latarnia na słupie.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/cemetery.py
Układ: środek działki = (0, 0), działka ±1,5, przód (bramka) = +z.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
rnd = random.Random(1311)
solid = []
E = 1.42          # płot

# ---------------- ziemia cmentarza ----------------
b.box('base', 'soil', 2.9, 0.012, 2.9, 0, 0, 0)


# ---------------- płot z żerdzi, bramka z przodu ----------------
def rail(x0, z0, x1, z1, y, r=0.02):
    L = math.hypot(x1 - x0, z1 - z0)
    rot = -math.atan2(z1 - z0, x1 - x0)
    b.box('base', 'bark', L, r * 2, r * 2, (x0 + x1) / 2, y - r, (z0 + z1) / 2, rot=rot)


GATE = 0.32
posts = []
for k in range(9):
    f = -E + k * (2 * E / 8)
    posts += [(f, -E), (-E, f), (E, f)]
    if abs(f) > GATE:
        posts.append((f, E))
posts += [(-GATE, E), (GATE, E)]
for x, z in set((round(x, 3), round(z, 3)) for x, z in posts):
    b.prism('base', 'woodDark', 0.03, 0.026, 0.42, x, 0.0, z, seg=6)
    b.prism('base', 'woodDark', 0.026, 0.0, 0.05, x, 0.42, z, seg=6)
for y in (0.16, 0.34):
    rail(-E - 0.02, -E - 0.03, E + 0.02, -E - 0.03, y)
    rail(-E - 0.03, -E, -E - 0.03, E, y)
    rail(E + 0.03, -E, E + 0.03, E, y)
    rail(-E - 0.02, E + 0.03, -GATE, E + 0.03, y)
    rail(GATE, E + 0.03, E + 0.02, E + 0.03, y)
# bramka: dwa wyższe słupy z daszkiem i krzyżykiem
for s in (-1, 1):
    b.box('base', 'woodDark', 0.06, 0.72, 0.06, s * GATE, 0.0, E)
b.box('base', 'woodDark', 2 * GATE + 0.12, 0.05, 0.08, 0, 0.72, E)
b.gable('base', 'wood', -GATE - 0.1, GATE + 0.1, E - 0.1, E + 0.1, 0.77, 0.12, along_x=True, over=0.03)
b.box('base', 'woodDark', 0.025, 0.16, 0.025, 0, 0.88, E)
b.box('base', 'woodDark', 0.1, 0.025, 0.025, 0, 0.98, E)
# skrzydło bramki uchylone do środka
b.box('base', 'wood', 0.3, 0.32, 0.025, -GATE + 0.15 * math.cos(0.9), 0.04, E - 0.15 * math.sin(0.9), rot=0.9)

# ---------------- kapliczka (lewy tył) ----------------
CX, CZ = -0.9, -0.9
CW, CD, CH = 0.5, 0.62, 0.62
b.box('base', 'stoneDark', CW + 0.08, 0.06, CD + 0.08, CX, 0, CZ)
b.box('base', 'stone', CW, CH, CD, CX, 0.06, CZ, top=False)
# narożne ciosy
for sx in (-1, 1):
    for sz in (-1, 1):
        for k in range(3):
            y = 0.08 + k * 0.2
            b.box('base', 'stoneDark', 0.1 if k % 2 else 0.06, 0.16, 0.06 if k % 2 else 0.1, CX + sx * (CW / 2 - 0.03), y, CZ + sz * (CD / 2 - 0.03))
# drzwi z łukiem (prostokąt + kamienne nadproże), okienko-rozeta z tyłu
DZ = CZ + CD / 2
b.box('base', 'stoneDark', 0.24, 0.44, 0.02, CX, 0.06, DZ + 0.008)
b.box('base', 'woodDark', 0.18, 0.38, 0.02, CX, 0.06, DZ + 0.015)
b.box('base', 'iron', 0.16, 0.02, 0.01, CX, 0.16, DZ + 0.027)
b.box('base', 'iron', 0.16, 0.02, 0.01, CX, 0.36, DZ + 0.027)
b.box('base', 'stoneDark', 0.3, 0.06, 0.04, CX, 0.5, DZ + 0.01)
for sx in (-1, 1):
    b.box('base', 'dark', 0.012, 0.18, 0.06, CX + sx * (CW / 2 + 0.002), 0.32, CZ)
# dach z łupka, szczyty z kamienia
b.gable('base', 'slate', CX - CW / 2, CX + CW / 2, CZ - CD / 2, CZ + CD / 2, 0.06 + CH, 0.36, along_x=False, over=0.08)
for z, s in ((CZ - CD / 2, -1), (CZ + CD / 2, 1)):
    b.poly('base', 'stone', [(CX - CW / 2, 0.06 + CH, z), (CX + CW / 2, 0.06 + CH, z), (CX, 0.06 + CH + 0.36, z)], away=(CX, 0.8, z - s))
# sygnaturka z dzwonkiem nad wejściem i krzyż
SY = 0.06 + CH + 0.2
SZ = CZ + CD / 2 - 0.1
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('base', 'woodDark', 0.03, 0.26, 0.03, CX + sx * 0.08, SY, SZ + sz * 0.08)
b.box('base', 'woodDark', 0.22, 0.03, 0.22, CX, SY + 0.26, SZ)
b.pyramid('base', 'slate', 0.26, 0.26, 0.2, CX, SY + 0.29, SZ)
b.prism('base', 'iron', 0.05, 0.035, 0.08, CX, SY + 0.12, SZ, seg=10, top=True)       # dzwonek
b.box('base', 'iron', 0.008, 0.06, 0.008, CX, SY + 0.2, SZ)
b.box('base', 'iron', 0.02, 0.16, 0.02, CX, SY + 0.49, SZ)
b.box('base', 'iron', 0.1, 0.02, 0.02, CX, SY + 0.6, SZ)
solid.append([CX - CW / 2 - 0.04, CX + CW / 2 + 0.04, CZ - CD / 2 - 0.04, CZ + CD / 2 + 0.04])


# ---------------- mogiły: kopczyki z darnią, drewniane krzyże, kilka kamiennych nagrobków ----------------
def mound(x, z, fresh=False):
    """Kopczyk: spłaszczony, wydłużony (wzdłuż z), z darnią na wierzchu (stare) albo gołą ziemią (świeże)"""
    n = 8
    pts = [(x + math.cos(2 * math.pi * k / n) * 0.13, z + math.sin(2 * math.pi * k / n) * 0.22) for k in range(n)]
    top = 0.07
    mat = 'soil' if fresh else 'turf'
    for k in range(n):
        a, c = pts[k], pts[(k + 1) % n]
        b.poly('base', mat, [(a[0], 0.012, a[1]), (c[0], 0.012, c[1]), (x + (c[0] - x) * 0.4, top, z + (c[1] - z) * 0.4), (x + (a[0] - x) * 0.4, top, z + (a[1] - z) * 0.4)], away=(x, -1, z))
    b.poly('base', mat, [(x + (p[0] - x) * 0.4, top, z + (p[1] - z) * 0.4) for p in pts], away=(x, -1, z))


def cross(x, z, h=0.36, lean=0.0):
    b.box('base', 'wood', 0.035, h, 0.035, x, 0.0, z, roll=lean)
    b.box('base', 'wood', 0.17, 0.035, 0.035, x - math.sin(lean) * h * 0.68, h * 0.68 * math.cos(lean), z, roll=lean)


def tombstone(x, z):
    b.box('base', 'stoneDark', 0.22, 0.04, 0.1, x, 0.0, z)
    b.box('base', 'stone', 0.18, 0.26, 0.06, x, 0.04, z)
    b.prism('base', 'stone', 0.09, 0.09, 0.06, x, 0.3, z - 0.03, seg=10)     # zaokrąglony wierzch (półwalec przybliżony walcem)
    b.box('base', 'dark', 0.08, 0.012, 0.004, x, 0.2, z + 0.031)


k = 0
for row, z in enumerate((-0.75, -0.05, 0.6)):
    for col in range(5):
        x = -1.1 + col * 0.5
        if x < -0.6 and z < -0.4:
            continue    # kapliczka
        k += 1
        if (row, col) == (2, 4):
            continue    # świeży dół w prawym przednim rogu
        mound(x, z, fresh=(row, col) == (1, 4))
        if k % 4 == 2:
            tombstone(x, z - 0.27)
        else:
            cross(x, z - 0.26, h=0.32 + (k % 3) * 0.04, lean=(rnd.random() - 0.5) * 0.18)
        solid.append([x - 0.14, x + 0.14, z - 0.32, z + 0.23])
# świeży dół, kopiec ziemi i łopata
HX, HZ = 0.9, 0.6
b.box('base', 'dark', 0.24, 0.004, 0.4, HX, 0.014, HZ)
for s in (-1, 1):
    b.box('base', 'soil', 0.03, 0.05, 0.42, HX + s * 0.13, 0.0, HZ)
b.box('base', 'soil', 0.27, 0.05, 0.03, HX, 0.0, HZ - 0.21)
b.box('base', 'soil', 0.27, 0.05, 0.03, HX, 0.0, HZ + 0.21)
b.prism('base', 'soil', 0.17, 0.06, 0.13, HX + 0.3, 0.0, HZ - 0.05, seg=8)
b.box('base', 'woodDark', 0.025, 0.5, 0.025, HX + 0.32, 0.12, HZ - 0.05, roll=0.3)
b.box('base', 'iron', 0.1, 0.12, 0.012, HX + 0.36, 0.06, HZ - 0.05, roll=0.3)
solid.append([HX - 0.15, HX + 0.45, HZ - 0.24, HZ + 0.24])

# ---------------- ławka i latarnia przy bramce ----------------
b.box('base', 'wood', 0.42, 0.03, 0.12, 0.75, 0.18, 1.12)
for x in (0.58, 0.92):
    b.box('base', 'woodDark', 0.05, 0.18, 0.1, x, 0.0, 1.12)
b.box('base', 'woodDark', 0.04, 0.85, 0.04, -0.55, 0.0, 1.15)
b.box('base', 'woodDark', 0.16, 0.03, 0.03, -0.49, 0.8, 1.15)
b.box('base', 'iron', 0.08, 0.1, 0.08, -0.43, 0.68, 1.15)
b.box('base', 'ember', 0.05, 0.06, 0.05, -0.43, 0.7, 1.15)
b.pyramid('base', 'iron', 0.1, 0.1, 0.05, -0.43, 0.78, 1.15)

VIEWS = [
    ['cmentarz od bramki', [0.3, 0.6, 3.2], [0, 0.2, 0], ['base'], 24],
    ['kapliczka', [-0.3, 0.45, 0.2], [-0.9, 0.5, -0.9], ['base'], 18],
]
b.save('cemetery', maxe=0.25, rays=16, reach=0.3, extra={'solid': solid, 'views': VIEWS})

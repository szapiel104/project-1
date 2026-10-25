"""Chatka maga (2×2 pola): tani punkt dla jednego wędrownego maga — zanim osadę stać na wieżę albo sanktuarium.
Okrągła chata z polnego kamienia pod stożkową strzechą z wywiniętym okapem, niskie drzwi z desek, małe okienko
z okiennicą. Pod okapem pęki suszonych ziół na sznurze; przy drzwiach niska kamienna misa z żarem i drewniane
koryto z wodą (mag służy obu kręgom), ława z bala, kamień z wyrytym znakiem, kopczyk drew i kosz z ziołami.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/magehut.py  →  src/render/models/magehut.json
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402

b = Building()
flames, lights, windows, chimneys = [], [], [], []

CX, CZ, R, H = 0.0, -0.2, 0.55, 0.62
SEG = 12

# ---------------- chata: kamienny cokół, mur z polnych kamieni (dwa odcienie na mijankę) ----------------
# mur jest pusty w środku (pierścień z pełnych ciosów), żeby po zdjęciu dachu było widać izbę maga
WALL = 0.07
b.prism('base', 'stoneDark', R + 0.05, R + 0.04, 0.08, CX, 0.0, CZ, seg=SEG)
rows = 6
for i in range(rows):
    y0 = 0.08 + i * (H - 0.08) / rows
    hh = (H - 0.08) / rows + 0.002
    off = (i % 2) * math.pi / SEG
    for k in range(SEG):
        a = off + 2 * math.pi * (k + 0.5) / SEG
        rm = R - WALL / 2
        chord = 2 * R * math.sin(math.pi / SEG) + 0.012
        mat = 'stone' if (i + k) % 2 == 0 else 'stoneDark'
        b.box('base', mat, chord, hh - 0.004, WALL, CX + math.sin(a) * rm, y0, CZ + math.cos(a) * rm, rot=a)

# kilka wystających kamieni w murze (z lica o 1–2 cm), żeby mur nie był gładki
for k in range(14):
    a = k * 2.399
    y = 0.15 + (k * 0.37) % (H - 0.2)
    b.crystal('base', 'rock', CX + math.sin(a) * (R + 0.01), y, CZ + math.cos(a) * (R + 0.01), 0.04, seed=k * 1.3, sy=0.7)

# ---------------- izba maga (widać ją po zdjęciu dachu) ----------------
IN = R - WALL
b.prism('floor', 'plank', IN + 0.004, IN + 0.004, 0.012, CX, 0.08, CZ, seg=SEG)
F = 0.092
# posłanie ze słomy na drewnianej ramie pod ścianą (lewy tył)
b.box('interior', 'woodDark', 0.44, 0.06, 0.2, CX - 0.2, F, CZ - 0.24, rot=0.5)
b.box('interior', 'thatch', 0.4, 0.035, 0.17, CX - 0.2, F + 0.06, CZ - 0.24, rot=0.5)
b.box('interior', 'sack', 0.14, 0.03, 0.15, CX - 0.36, F + 0.09, CZ - 0.15, rot=0.5)
# stół z ksiegą, moździerzem i świecą (prawy bok)
TX0, TZ0 = CX + 0.2, CZ + 0.05
b.box('interior', 'wood', 0.26, 0.025, 0.16, TX0, F + 0.17, TZ0, rot=-0.3)
for dx, dz in ((-0.1, -0.05), (0.1, -0.05), (-0.1, 0.05), (0.1, 0.05)):
    c, sn = math.cos(-0.3), math.sin(-0.3)
    b.box('interior', 'woodDark', 0.025, 0.17, 0.025, TX0 + dx * c + dz * sn, F, TZ0 - dx * sn + dz * c)
b.box('interior', 'sack', 0.09, 0.025, 0.07, TX0 - 0.05, F + 0.195, TZ0, rot=-0.1)
b.box('interior', 'dark', 0.085, 0.006, 0.065, TX0 - 0.05, F + 0.221, TZ0, rot=-0.1)
b.prism('interior', 'stoneDark', 0.03, 0.025, 0.04, TX0 + 0.06, F + 0.195, TZ0 - 0.02, seg=8)
b.prism('interior', 'white', 0.009, 0.009, 0.05, TX0 + 0.08, F + 0.195, TZ0 + 0.04, seg=6)
lights.append([TX0 + 0.08, F + 0.29, TZ0 + 0.04])
# półka na ścianie z dzbanami i pękami ziół (tył po prawej)
SA = -2.4
sx, sz = CX + math.sin(SA) * (IN - 0.05), CZ + math.cos(SA) * (IN - 0.05)
b.box('interior', 'wood', 0.3, 0.02, 0.07, sx, 0.36, sz, rot=SA)
for k, d in enumerate((-0.1, 0.0, 0.1)):
    jx, jz = sx + math.cos(SA) * d, sz - math.sin(SA) * d
    b.prism('interior', 'stoneDark' if k % 2 else 'hide', 0.022, 0.018, 0.06, jx, 0.38, jz, seg=8)
b.crystal('interior', 'leaf', sx, 0.31, sz, 0.035, seed=2.2, sy=1.5)
# palenisko z kamieni pod dymnikiem, z żarem
HX, HZ = CX - 0.2, CZ - 0.12 + 0.18
b.prism('interior', 'stoneDark', 0.1, 0.11, 0.04, HX, F, HZ, seg=10)
b.prism('interior', 'ember', 0.075, 0.075, 0.004, HX, F + 0.04, HZ, seg=10)
flames.append([HX, F + 0.04, HZ])
# mały kociołek na trójnogu przy palenisku
b.prism('interior', 'iron', 0.045, 0.035, 0.05, HX + 0.14, F + 0.03, HZ + 0.02, seg=10)

# ---------------- strzecha: stożek z wywiniętym okapem i wiązką na szczycie ----------------
b.prism('shell', 'thatch', R + 0.2, R + 0.12, 0.06, CX, H - 0.02, CZ, seg=SEG)
b.prism('shell', 'thatch', R + 0.12, 0.0, 0.62, CX, H + 0.04, CZ, seg=SEG)
b.prism('shell', 'thatchDark', R + 0.2, R + 0.2, 0.012, CX, H - 0.032, CZ, seg=SEG, top=False)  # spód okapu
log(b, 'shell', 'thatchDark', (CX, H + 0.6, CZ), (CX, H + 0.74, CZ), r=0.035, r1=0.012, seg=6)
# dymnik: krótki gliniany komin z boku stożka
b.prism('shell', 'stoneDark', 0.05, 0.045, 0.24, CX - 0.2, H + 0.25, CZ - 0.12, seg=6)
chimneys.append([CX - 0.2, H + 0.5, CZ - 0.12])

# ---------------- drzwi i okienko ----------------
DZ = CZ + R
b.box('base', 'woodDark', 0.24, 0.44, 0.04, CX, 0.08, DZ + 0.005)
for y in (0.17, 0.4):
    b.box('base', 'iron', 0.25, 0.02, 0.05, CX, y, DZ + 0.006)
b.box('base', 'wood', 0.32, 0.05, 0.07, CX, 0.52, DZ + 0.01)
for s in (-1, 1):
    b.box('base', 'wood', 0.04, 0.46, 0.06, CX + s * 0.14, 0.06, DZ + 0.008)
a = 0.9
wx, wz = CX + math.sin(a) * (R + 0.006), CZ + math.cos(a) * (R + 0.006)
b.box('base', 'dark', 0.13, 0.12, 0.02, wx, 0.32, wz, rot=a)
b.box('base', 'wood', 0.17, 0.03, 0.04, wx, 0.29, wz, rot=a)
b.box('base', 'woodDark', 0.07, 0.13, 0.015, wx + math.cos(a) * 0.11, 0.31, wz - math.sin(a) * 0.11, rot=a + 0.3)
windows.append([round(wx + math.sin(a) * 0.015, 4), 0.44, round(wz + math.cos(a) * 0.015, 4), round(math.sin(a), 3), round(math.cos(a), 3), 0.11, 0.1, 'base'])

# ---------------- zioła suszone pod okapem na sznurze ----------------
for k, a in enumerate((-1.2, -0.85, -0.5, 0.45, 0.75, 1.05)):
    x, z = CX + math.sin(a) * (R + 0.1), CZ + math.cos(a) * (R + 0.1)
    log(b, 'base', 'rope', (x, H - 0.03, z), (x, H - 0.1, z), r=0.004, seg=4)
    b.crystal('base', 'leaf' if k % 2 else 'leafLight', x, H - 0.2, z, 0.04, seed=k * 3.1, sy=1.6)

# ---------------- przy drzwiach: misa z żarem i koryto z wodą ----------------
FX, FZ = CX - 0.42, DZ + 0.32
b.crystal('base', 'rockDark', FX, 0.0, FZ, 0.1, seed=4.0, sy=0.5)
b.prism('base', 'stoneDark', 0.1, 0.14, 0.09, FX, 0.04, FZ, seg=10, top=False)
b.prism('base', 'ember', 0.12, 0.12, 0.004, FX, 0.12, FZ, seg=10)
flames.append([FX, 0.12, FZ])
lights.append([FX, 0.3, FZ])
TX, TZ = CX + 0.44, DZ + 0.3
# koryto z desek: dno i cztery ściany z grubością (otwarte od góry, widać wodę)
b.box('base', 'woodDark', 0.36, 0.03, 0.18, TX, 0.0, TZ)
for dz in (-0.075, 0.075):
    b.box('base', 'woodDark', 0.36, 0.12, 0.03, TX, 0.0, TZ + dz)
for dx in (-0.165, 0.165):
    b.box('base', 'woodDark', 0.03, 0.12, 0.12, TX + dx, 0.0, TZ)
b.box('base', 'water', 0.3, 0.005, 0.12, TX, 0.095, TZ)
for s in (-1, 1):
    b.box('base', 'woodDark', 0.05, 0.05, 0.2, TX + s * 0.15, 0.0, TZ)

# ---------------- ława z bala, kamień ze znakiem, drwa, kosz z ziołami ----------------
log(b, 'base', 'bark', (CX - 0.6, 0.1, CZ + 0.1), (CX - 0.6, 0.1, CZ - 0.38), r=0.06, seg=8, ends='wood')
for z in (CZ + 0.02, CZ - 0.3):
    b.box('base', 'woodDark', 0.1, 0.06, 0.06, CX - 0.6, 0.0, z)
b.box('base', 'stoneDark', 0.16, 0.36, 0.1, CX + 0.72, 0.0, CZ - 0.25, rot=0.3)
b.box('base', 'ember', 0.05, 0.12, 0.004, CX + 0.71, 0.14, CZ - 0.2 + 0.0, rot=0.3)
for k in range(2):
    for j in range(3 - k):
        z = CZ - 0.55 + 0.11 * j + 0.055 * k
        log(b, 'base', 'bark', (CX + 0.45, 0.05 + k * 0.09, z), (CX + 0.75, 0.05 + k * 0.09, z), r=0.045, seg=7, ends='wood')
b.prism('base', 'basket', 0.08, 0.1, 0.13, CX - 0.62, 0.0, DZ + 0.12)

VIEWS = [
    ['chatka z przodu (oczy chłopa)', [0.0, 0.45, 2.0], [0.0, 0.5, CZ], ['base', 'shell'], 34],
    ['drzwi, żar i koryto', [0.5, 0.4, 1.2], [0.0, 0.25, DZ], ['base', 'shell'], 34],
    ['spod okapu', [0.55, 0.25, 0.55], [CX, H, CZ], ['base', 'shell'], 40],
]
b.save('magehut', maxe=0.16, rays=16, reach=0.25, extra={'views': VIEWS, 'flames': flames, 'lights': lights, 'windows': windows, 'chimneys': chimneys})

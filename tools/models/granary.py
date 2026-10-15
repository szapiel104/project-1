"""Spichlerz (2×2 pola): szachulcowy, podniesiony na kamiennych grzybkach (gryzonie nie wejdą do ziarna),
gruba strzecha z wywietrznikiem, drzwi na piętrze podłogi ze schodkami z bali, nad drzwiami belka z bloczkiem.
W środku pusta podłoga z desek: zapasy żywności (chleb, jabłka, ryby) układa na niej gra według stanu spichlerza.
Przed nim worki i kosz z jabłkami. Dach i szczyty (grupa 'shell') znikają przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/granary.py  →  src/render/models/granary.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu
(działka parzystej szerokości), więc drzwi są pół pola w prawo od środka (jak w chacie).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.07)
T = t.T

LEG = 0.26                       # wysokość grzybków
P = LEG + 0.06                   # podłoga spichlerza (na belkach)
X0, X1, Z0, Z1 = -0.74, 0.74, -0.6, 0.56
H1 = P + 0.72                    # okap
RISE = 0.62
DOOR = (0.28, 0.6, 0.56)
DM = (DOOR[0] + DOOR[1]) / 2

# ---------------- kamienne grzybki: słupek z ciosu i płaska czapa (o nią potykają się szczury) ----------------
for x in (X0 + 0.08, 0.0, X1 - 0.08):
    for z in (Z0 + 0.08, Z1 - 0.08):
        b.prism('base', 'stone', 0.075, 0.06, LEG - 0.06, x, 0.0, z, seg=8)
        b.prism('base', 'stoneDark', 0.13, 0.12, 0.05, x, LEG - 0.06, z, seg=10)
        b.box('base', 'stoneDark', 0.18, 0.02, 0.18, x, 0.0, z)
        t.block(x - 0.1, x + 0.1, z - 0.1, z + 0.1, 0, LEG)
# legary i podłoga z desek na grzybkach
for z in (Z0 + 0.08, Z1 - 0.08):
    b.box('base', 'woodDark', X1 - X0 + 0.06, 0.07, 0.09, 0, LEG - 0.01, z, bottom=True)
for x in (X0 + 0.08, -0.37, 0.0, 0.37, X1 - 0.08):
    b.box('base', 'woodDark', 0.07, 0.05, Z1 - Z0 + 0.04, x, LEG + 0.01, (Z0 + Z1) / 2, bottom=True)
b.box('base', 'plank', X1 - X0 + 0.04, 0.03, Z1 - Z0 + 0.04, 0, P - 0.03, (Z0 + Z1) / 2, bottom=True)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.008, Z1 - Z0 - 2 * T, 0, P, (Z0 + Z1) / 2)

# ---------------- ściany szachulcowe: drzwi z przodu, wąskie okienka-wywietrzniki po bokach ----------------
VENT = 0.12
t.wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2])])
t.wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [])
t.wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-VENT / 2, VENT / 2, P + 0.42, P + 0.56)])
t.wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-VENT / 2, VENT / 2, P + 0.42, P + 0.56)])
for sx in (-1, 1):  # wywietrzniki z drewnianymi prętami (bez szyby)
    x = sx * (X1 - T / 2)
    for k in range(3):
        b.box('base', 'woodDark', 0.03, 0.14, 0.016, x, P + 0.42, -VENT / 2 + (k + 0.5) * VENT / 3)
    b.box('base', 'woodDark', 0.05, 0.03, VENT + 0.06, x + sx * 0.01, P + 0.39, 0)
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, -0.38, 0.0, DOOR[0] - 0.03, DOOR[1] + 0.03, X1 - 0.03], braces=False)
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.25, 0.25, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.12, 0.12, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.12, 0.12, Z1 - 0.03])
for x, r in ((-0.55, -0.62), (-0.2, 0.62)):   # zastrzały na froncie
    b.box('base', 'woodDark', 0.04, 0.5, 0.022, x, P + 0.05, Z1 + 0.012, roll=r)
# nadproże, drzwi z desek otwarte do środka (oparte o ścianę boczną izby), okucia
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, P + DOOR[2], Z1 - T / 2)
DW = DOOR[1] - DOOR[0] - 0.02
b.box('base', 'wood', DW, DOOR[2] - 0.03, 0.03, DOOR[1] - 0.02, P + 0.01, Z1 - T - DW / 2 - 0.01, math.pi / 2)
for yy in (P + 0.08, P + DOOR[2] - 0.14):
    b.box('base', 'iron', DW - 0.04, 0.03, 0.012, DOOR[1] - 0.04, yy, Z1 - T - DW / 2 - 0.01, math.pi / 2)
# schodki z bali pod drzwiami (z ziemi na podłogę)
for k in range(3):
    y = P - (k + 1) * P / 3
    b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.06, P / 3, 0.12, DM, y, Z1 + 0.07 + k * 0.11, bottom=True)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.035, 0.035, 0.42, DM + sx * ((DOOR[1] - DOOR[0]) / 2 + 0.05), 0.02, Z1 + 0.2, tilt=0.7, bottom=True)
t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- strzecha (dwie warstwy), szczyty z desek, kalenica z wywietrznikiem, belka z bloczkiem ----------------
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.17)
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.2)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plank', x, Z0, Z1, H1, RISE, out=sx)
ZM = (Z0 + Z1) / 2
b.box('shell', 'thatchDark', X1 - X0 + 0.42, 0.07, 0.14, 0, H1 + RISE - 0.04, ZM)
# daszek wywietrznika na kalenicy
b.box('shell', 'plank', 0.2, 0.1, 0.16, 0, H1 + RISE + 0.01, ZM)
b.gable('shell', 'roadWood', -0.13, 0.13, ZM - 0.11, ZM + 0.11, H1 + RISE + 0.11, 0.07, along_x=True, over=0.02, end_mat='plank')
# belka z bloczkiem nad drzwiami (wciąganie worków)
b.box('shell', 'woodDark', 0.06, 0.06, 0.34, DM, H1 + 0.1, Z1 + 0.1)
b.box('shell', 'iron', 0.012, 0.32, 0.012, DM, H1 - 0.2, Z1 + 0.24)
b.prism('shell', 'woodDark', 0.03, 0.03, 0.04, DM, H1 + 0.06, Z1 + 0.24, seg=8)

# ---------------- wnętrze: pusta podłoga — zapasy żywności układa gra (dynamicznie, według stanu) ----------------
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- przed spichlerzem: worki z ziarnem, kosz z jabłkami, drabina pod okapem ----------------
def sack(x, z, s=1.0, lean=0.0):
    b.prism('base', 'sack', 0.08 * s, 0.09 * s, 0.1 * s, x, 0.0, z, seg=9)
    b.prism('base', 'sack', 0.09 * s, 0.06 * s, 0.07 * s, x, 0.1 * s, z, seg=9)
    b.prism('base', 'rope', 0.035 * s, 0.03 * s, 0.03 * s, x, 0.17 * s, z, seg=7)
sack(-0.55, Z1 + 0.18)
sack(-0.36, Z1 + 0.2, 0.9)
sack(-0.46, Z1 + 0.36, 0.85)
# kosz z jabłkami
b.prism('base', 'basket', 0.08, 0.1, 0.1, 0.85, 0.0, 0.25, seg=10)
for k in range(6):
    a = 2 * math.pi * k / 6
    b.prism('base', 'apple', 0.025, 0.02, 0.03, 0.85 + math.cos(a) * 0.045, 0.1, 0.25 + math.sin(a) * 0.045, seg=6)

E = P + 0.46
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor', 'ceiling']
VIEWS = [
    ['spichlerz z przodu', [0.4, 0.5, 2.6], [0, 0.6, 0], OUT, 22],
    ['przez drzwi', [DM, E, 1.3], [-0.1, P + 0.1, -0.4], ['base', 'shell', 'interior', 'floor'], 18],
    ['pod podłogą (grzybki)', [-1.6, 0.12, 1.2], [0, 0.2, 0], OUT, 22],
]
b.save('granary', maxe=0.26, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': [], 'flames': [],
    'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.08, 3), round(ZM, 3)], 'views': VIEWS})

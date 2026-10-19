"""Duży spichlerz (3×3 pola): bogatszy brat zwykłego spichlerza. Kamienna podmurówka z wywietrznikami (ziarno
nie gnije, szczury nie wejdą), na niej piętro z szachulca, wysoki dach z łupka z lukarną i belką z bloczkiem do
wciągania worków, dwuskrzydłowe wrota na środku przodu, kamienne schody. W środku pusta podłoga z desek:
zapasy żywności układa gra według stanu spichlerza. Przed nim worki, beczka i kosze. Dach (grupa 'shell') znika
przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/granary_big.py  →  src/render/models/granary_big.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (wrota) = +z. Wejście: pole przed środkiem przodu
(działka nieparzystej szerokości, więc wrota są dokładnie na środku).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.08)
T = t.T

X0, X1, Z0, Z1 = -1.18, 1.18, -1.05, 0.92
P = 0.38                         # podłoga spichlerza (na kamiennej podmurówce)
H1 = P + 0.95                    # okap
RISE = 0.95
DOOR = (-0.26, 0.26, 0.66)       # wrota: od x do x, wysokość
ZM = (Z0 + Z1) / 2

# ---------------- kamienna podmurówka z wywietrznikami (grube ciosy, cokół lekko szerszy) ----------------
b.box('base', 'castleDark', X1 - X0 + 0.1, 0.08, Z1 - Z0 + 0.1, 0, 0.0, ZM)
for x0, x1, z0, z1 in ((X0, X1, Z1 - T, Z1), (X0, X1, Z0, Z0 + T), (X0, X0 + T, Z0 + T, Z1 - T), (X1 - T, X1, Z0 + T, Z1 - T)):
    b.box('base', 'castle', x1 - x0, P - 0.08, z1 - z0, (x0 + x1) / 2, 0.08, (z0 + z1) / 2)
# wywietrzniki: ciemne szczeliny w podmurówce (na bokach i z tyłu), z kamiennym nadprożem
for sx in (-1, 1):
    for z in (-0.6, 0.15):
        b.box('base', 'dark', 0.012, 0.09, 0.16, sx * (X1 + 0.006), 0.17, z)
        b.box('base', 'cutDark', 0.03, 0.035, 0.24, sx * (X1 + 0.01), 0.27, z)
for x in (-0.7, 0.0, 0.7):
    b.box('base', 'dark', 0.16, 0.09, 0.012, x, 0.17, Z0 - 0.006)
    b.box('base', 'cutDark', 0.24, 0.035, 0.03, x, 0.27, Z0 - 0.01)
# gzyms na koronie podmurówki (wystaje poza lico, żeby nie leżał licem w lico)
b.box('base', 'cutDark', X1 - X0 + 0.08, 0.04, Z1 - Z0 + 0.08, 0, P - 0.04, ZM, bottom=True)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, ZM)
t.block(X0, X1, Z0, Z1, 0, P)

# ---------------- piętro z szachulca: wrota z przodu, okienka-wywietrzniki z kratą po bokach i z tyłu ----------------
VW, VH = 0.14, 0.16
VY = P + 0.5
t.wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2])])
t.wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [(-0.6 - VW / 2, -0.6 + VW / 2, VY, VY + VH), (0.6 - VW / 2, 0.6 + VW / 2, VY, VY + VH)])
t.wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(ZM - VW / 2, ZM + VW / 2, VY, VY + VH)])
t.wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(ZM - VW / 2, ZM + VW / 2, VY, VY + VH)])


def vent_x(x, z, out):
    """Okienko wywietrznika w ścianie wzdłuż x: trzy pręty i parapet (bez szyby — ziarno ma oddychać)"""
    for k in range(3):
        b.box('base', 'woodDark', 0.018, VH, 0.03, x - VW / 2 + (k + 0.5) * VW / 3, VY, z)
    b.box('base', 'woodDark', VW + 0.06, 0.03, 0.06, x, VY - 0.03, z + out * 0.01)


def vent_z(x, z, out):
    for k in range(3):
        b.box('base', 'woodDark', 0.03, VH, 0.018, x, VY, z - VW / 2 + (k + 0.5) * VW / 3)
    b.box('base', 'woodDark', 0.06, 0.03, VW + 0.06, x + out * 0.01, VY - 0.03, z)


vent_x(-0.6, Z0 + T / 2, -1); vent_x(0.6, Z0 + T / 2, -1)
vent_z(X0 + T / 2, ZM, -1); vent_z(X1 - T / 2, ZM, 1)
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, -0.75, DOOR[0] - 0.04, DOOR[1] + 0.04, 0.75, X1 - 0.03], doors=[DOOR[:2]])
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.75, -0.25, 0.25, 0.75, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.45, 0.32, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.45, 0.32, Z1 - 0.03])
# wrota: nadproże, dwa skrzydła otwarte do środka (oparte o ściany izby), okucia
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.1, 0.06, T + 0.04, 0, P + DOOR[2], Z1 - T / 2)
LW = (DOOR[1] - DOOR[0]) / 2 - 0.01
for sx in (-1, 1):
    hx = sx * (DOOR[1] - 0.01)
    b.box('base', 'wood', LW, DOOR[2] - 0.03, 0.03, hx, P + 0.01, Z1 - T - LW / 2 - 0.01, math.pi / 2)
    for yy in (P + 0.1, P + DOOR[2] - 0.16):
        b.box('base', 'iron', LW - 0.04, 0.03, 0.012, hx - sx * 0.02, yy, Z1 - T - LW / 2 - 0.01, math.pi / 2)
t.block(X0, DOOR[0], Z1 - T, Z1, P, 9); t.block(DOOR[1], X1, Z1 - T, Z1, P, 9)
t.block(X0, X1, Z0, Z0 + T, P, 9); t.block(X0, X0 + T, Z0, Z1, P, 9); t.block(X1 - T, X1, Z0, Z1, P, 9)
# kamienne schody pod wrota (trzy stopnie z ciosów) i murki po bokach
for k in range(3):
    y = P - (k + 1) * P / 3
    b.box('base', 'cut', DOOR[1] - DOOR[0] + 0.14 + k * 0.04, P / 3, 0.13, 0, y, Z1 + 0.07 + k * 0.12, bottom=True)
for sx in (-1, 1):
    b.box('base', 'castle', 0.08, P * 0.6, 0.38, sx * ((DOOR[1] - DOOR[0]) / 2 + 0.12), 0, Z1 + 0.19)

# ---------------- dach z łupka (dwie warstwy), szczyty z desek, lukarna z bloczkiem nad wrotami ----------------
b.gable('shell', 'slate', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.14)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plank', x, Z0, Z1, H1, RISE, out=sx)
b.box('shell', 'castleDark', X1 - X0 + 0.34, 0.07, 0.12, 0, H1 + RISE - 0.03, ZM)  # kalenica z kamiennych gąsiorów
# lukarna od frontu: mała ściana z drzwiczkami do wciągania worków, własny daszek, belka z bloczkiem
LX0, LX1 = -0.24, 0.24
LZ = Z1 - 0.08                   # lico lukarny, cofnięte za okap
LY0, LY1 = H1 + 0.02, H1 + 0.42
b.box('shell', 'plaster', LX1 - LX0, LY1 - LY0, 0.36, 0, LY0, LZ - 0.18, bottom=True)
b.box('shell', 'woodDark', 0.24, 0.26, 0.02, 0, LY0 + 0.05, LZ + 0.005)        # drzwiczki
b.box('shell', 'woodDark', LX1 - LX0 + 0.04, 0.04, 0.03, 0, LY1 - 0.04, LZ + 0.01)
b.gable('shell', 'slate', LX0 - 0.02, LX1 + 0.02, LZ - 0.42, LZ + 0.04, LY1, 0.2, along_x=False, over=0.05, end_mat='plank')
b.box('shell', 'woodDark', 0.06, 0.06, 0.4, 0, LY1 - 0.02, LZ + 0.18)
b.box('shell', 'iron', 0.012, 0.36, 0.012, 0, LY1 - 0.38, LZ + 0.34)
b.prism('shell', 'woodDark', 0.035, 0.035, 0.05, 0, LY1 - 0.08, LZ + 0.34, seg=8)

# ---------------- wnętrze: pusta podłoga — zapasy żywności układa gra; kilka słupów nośnych ----------------
for x in (-0.64, 0.64):  # między miejscami na zapasy (siatka 6 × 5, co 0,32 pola), żeby kosze nie wchodziły w słupy
    b.box('interior', 'woodDark', 0.08, H1 - P, 0.08, x, P, -0.24)
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])


# ---------------- przed spichlerzem: worki, beczka, kosze z jabłkami ----------------
def sack(x, z, s=1.0):
    b.sack('base', x, 0.0, z, w=0.18 * s, rot=x * 7 + z)   # worek z płótna (tools/models/sack.py)


sack(-0.75, Z1 + 0.2); sack(-0.56, Z1 + 0.22, 0.9); sack(-0.66, Z1 + 0.38, 0.85); sack(-0.95, Z1 + 0.3, 0.95)
b.prism('base', 'wood', 0.1, 0.11, 0.26, 0.72, 0.0, Z1 + 0.22, seg=12)
b.prism('base', 'iron', 0.112, 0.112, 0.015, 0.72, 0.05, Z1 + 0.22, seg=12)
b.prism('base', 'iron', 0.112, 0.112, 0.015, 0.72, 0.2, Z1 + 0.22, seg=12)
for bx, bz in ((0.98, Z1 + 0.25), (0.88, Z1 + 0.45)):
    b.prism('base', 'basket', 0.08, 0.1, 0.1, bx, 0.0, bz, seg=10)
    for k in range(6):
        a = 2 * math.pi * k / 6
        b.apple('base', bx + math.cos(a) * 0.045, 0.06, bz + math.sin(a) * 0.045, rot=a * 2.3)   # w koszu, wierzch nad brzegiem

E = P + 0.46
OUT = ['base', 'shell']
VIEWS = [
    ['duży spichlerz z przodu', [0.6, 0.6, 3.4], [0, 0.8, 0], OUT, 22],
    ['przez wrota', [0, E, 1.6], [0, P + 0.1, -0.6], ['base', 'shell', 'interior', 'floor'], 18],
    ['z oczu chłopa przy schodach', [0.45, 0.42, 1.9], [0, 1.0, 0.6], OUT, 20],
]
b.save('granary_big', maxe=0.26, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': [], 'flames': [],
    'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.1, 3), round(ZM, 3)], 'views': VIEWS})

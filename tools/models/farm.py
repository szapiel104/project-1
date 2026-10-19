"""Farma zboża (3×3 pola): pole z ziemi ogrodzone płotem z plecionki, sześć usypanych zagonów (zboże na nich rośnie
i faluje — rzędy kłosów dokłada gra w miejscach z listy 'rows'), w tylnym lewym rogu chałupa rolnika z gliny
na plecionce pod strzechą, przed nią trzy snopki ustawione w kopki, strach na wróble na polu, radło oparte
o ścianę, beczka z wodą. W chałupie: worki ziarna, skrzynia na zboże, cep, sierpy na ścianie, kosa, snopek.

Do farmy wchodzi się spacerem: cała działka jest do chodzenia, przeszkody to płot, ściany chałupy, kopki i sprzęty.
Wszystko stoi na tej samej wysokości (FLOOR), więc wejście do chałupy nie skacze. Dach chałupy (grupa 'shell')
znika przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/farm.py  →  src/render/models/farm.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (wejście) = +z. Wejście: pole przed środkiem przodu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.06)
T = t.T

FLOOR = 0.05
E = 1.44
GATE = 0.34

# ---------------- ziemia i zagony ----------------
b.box('base', 'soil', 2.96, FLOOR, 2.96, 0, 0, 0)
ROWS = []
for i in range(6):
    z = -1.1 + i * 0.44
    x0 = -0.42 if z < -0.45 else -1.3     # przy chałupie zagony krótsze
    x1 = 1.32
    cx, ln = (x0 + x1) / 2, x1 - x0
    # grzęda: usypany wał (trapez w przekroju) — wyżej niż ziemia, więc nic nie leży licem w lico
    pts = [(x0, FLOOR, z - 0.15), (x1, FLOOR, z - 0.15), (x1, FLOOR + 0.045, z - 0.08), (x0, FLOOR + 0.045, z - 0.08)]
    b.poly('base', 'soil', pts, away=(cx, FLOOR - 1, z))
    b.poly('base', 'soil', [(x0, FLOOR + 0.045, z - 0.08), (x1, FLOOR + 0.045, z - 0.08), (x1, FLOOR + 0.045, z + 0.08), (x0, FLOOR + 0.045, z + 0.08)], away=(cx, FLOOR - 1, z))
    b.poly('base', 'soil', [(x0, FLOOR + 0.045, z + 0.08), (x1, FLOOR + 0.045, z + 0.08), (x1, FLOOR, z + 0.15), (x0, FLOOR, z + 0.15)], away=(cx, FLOOR - 1, z))
    for x in (x0, x1):
        b.poly('base', 'soil', [(x, FLOOR, z - 0.15), (x, FLOOR + 0.045, z - 0.08), (x, FLOOR + 0.045, z + 0.08), (x, FLOOR, z + 0.15)], away=(cx, FLOOR, z))
    ROWS.append([round(cx, 3), round(FLOOR + 0.045, 3), round(z, 3), round(ln, 3)])

# ---------------- płot z plecionki na palikach, wejście od frontu ----------------
def fence(x0, z0, x1, z1):
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(1, round(L / 0.48))
    rot = -math.atan2(z1 - z0, x1 - x0)
    for i in range(n + 1):
        f = i / n
        x, z = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        b.box('base', 'bark', 0.07, 0.46, 0.07, x, FLOOR, z, rot)
        b.prism('base', 'woodDark', 0.035, 0.0, 0.06, x, FLOOR + 0.46, z, seg=6)
    for i in range(n):
        f = (i + 0.5) / n
        x, z = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        b.box('base', 'wattle', L / n - 0.075, 0.26, 0.035, x, FLOOR + 0.06, z, rot)
        b.box('base', 'woodDark', L / n - 0.075, 0.025, 0.045, x, FLOOR + 0.32, z, rot)
    w = 0.05
    if abs(z1 - z0) < 1e-6:
        t.block(min(x0, x1) - 0.04, max(x0, x1) + 0.04, z0 - w, z0 + w)
    else:
        t.block(x0 - w, x0 + w, min(z0, z1) - 0.04, max(z0, z1) + 0.04)
fence(-E, -E, E, -E)
fence(-E, -E, -E, E)
fence(E, -E, E, E)
fence(-E, E, -GATE, E)
fence(GATE, E, E, E)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.09, 0.6, 0.09, sx * GATE, FLOOR, E)

# ---------------- chałupa rolnika (tylny lewy róg) ----------------
HX0, HX1, HZ0, HZ1 = -1.38, -0.52, -1.38, -0.56
HP = FLOOR                         # klepisko na wysokości ziemi (bez stopnia)
H1 = HP + 0.62
RISE = 0.5
DOOR = (-1.1, -0.8, 0.5)
DM = (DOOR[0] + DOOR[1]) / 2
HZM = (HZ0 + HZ1) / 2
b.box('base', 'stoneDark', HX1 - HX0 + 0.06, 0.06, HZ1 - HZ0 + 0.06, (HX0 + HX1) / 2, FLOOR - 0.04, HZM)   # niska podwalina z kamieni
b.box('floor', 'soil', HX1 - HX0 - 2 * T, 0.008, HZ1 - HZ0 - 2 * T, (HX0 + HX1) / 2, HP + 0.02, HZM)       # klepisko
t.wall_x('base', 'plaster', HZ1 - T / 2, HX0, HX1, HP + 0.02, H1, [(DOOR[0], DOOR[1], HP + 0.02, HP + DOOR[2])])
t.wall_x('base', 'plaster', HZ0 + T / 2, HX0, HX1, HP + 0.02, H1, [])
t.wall_z('base', 'plaster', HX0 + T / 2, HZ0 + T, HZ1 - T, HP + 0.02, H1, [])
t.wall_z('base', 'plaster', HX1 - T / 2, HZ0 + T, HZ1 - T, HP + 0.02, H1, [(HZM - 0.1, HZM + 0.1, HP + 0.3, HP + 0.48)])
t.window('base', HX1 - T / 2, HP + 0.3, HP + 0.48, HZM, 0.2, 1, 0)
t.frame_x('base', HZ1 - T / 2, HX0, HX1, HP + 0.02, H1, [HX0 + 0.03, DOOR[0] - 0.03, DOOR[1] + 0.03, HX1 - 0.03], braces=False)
t.frame_x('base', HZ0 + T / 2, HX0, HX1, HP + 0.02, H1, [HX0 + 0.03, (HX0 + HX1) / 2, HX1 - 0.03], out=-1)
t.frame_z('base', HX0 + T / 2, HZ0, HZ1, HP + 0.02, H1, [HZ0 + 0.03, HZM, HZ1 - 0.03], out=-1)
t.frame_z('base', HX1 - T / 2, HZ0, HZ1, HP + 0.02, H1, [HZ0 + 0.03, HZM - 0.13, HZM + 0.13, HZ1 - 0.03])
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, HP + DOOR[2], HZ1 - T / 2)
# drzwi z desek otwarte do środka (oparte o ścianę)
DW = DOOR[1] - DOOR[0] - 0.02
b.box('interior', 'wood', DW, DOOR[2] - 0.04, 0.025, DOOR[0] + 0.02, HP + 0.03, HZ1 - T - DW / 2 - 0.01, math.pi / 2)
t.block(HX0, DOOR[0], HZ1 - T, HZ1); t.block(DOOR[1], HX1, HZ1 - T, HZ1)
t.block(HX0, HX1, HZ0, HZ0 + T); t.block(HX0, HX0 + T, HZ0, HZ1); t.block(HX1 - T, HX1, HZ0, HZ1)
# strzecha, szczyty z gliny, kalenica
b.gable('shell', 'thatch', HX0 - 0.02, HX1 + 0.02, HZ0 - 0.02, HZ1 + 0.02, H1, RISE, along_x=True, over=0.15)
b.gable('shell', 'thatchDark', HX0 - 0.02, HX1 + 0.02, HZ0 - 0.02, HZ1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.18)
for sx, x in ((-1, HX0), (1, HX1)):
    t.gable_end('shell', 'plaster', x, HZ0, HZ1, H1, RISE, out=sx)
b.box('shell', 'thatchDark', HX1 - HX0 + 0.36, 0.07, 0.13, (HX0 + HX1) / 2, H1 + RISE - 0.04, HZM)

# ---------------- w chałupie: worki ziarna, skrzynia na zboże, cep, sierpy, kosa, snopek ----------------
def sack(x, z, s=1.0, group='interior'):
    b.sack(group, x, HP + 0.02, z, w=0.15 * s, rot=x * 7 + z)   # worek z płótna (tools/models/sack.py)
for x, z, s in ((HX0 + T + 0.1, HZ0 + T + 0.1, 1.0), (HX0 + T + 0.26, HZ0 + T + 0.1, 0.9), (HX0 + T + 0.1, HZ0 + T + 0.26, 0.85)):
    sack(x, z, s)
t.block(HX0 + T, HX0 + T + 0.36, HZ0 + T, HZ0 + T + 0.36, 0, HP + 0.22)
# skrzynia na zboże (sąsiek) pod tylną ścianą, pełna ziarna
BX = HX1 - T - 0.18
t.boxs('interior', 'woodDark', 0.32, 0.24, 0.22, BX, HP + 0.02, HZ0 + T + 0.12)
b.box('interior', 'wheat', 0.28, 0.01, 0.18, BX, HP + 0.26, HZ0 + T + 0.12)
# cep oparty o ścianę: dzierżak i bijak na rzemieniu
b.box('interior', 'wood', 0.025, 0.5, 0.025, HX1 - T - 0.05, HP + 0.02, HZM + 0.12, roll=0.18)
b.box('interior', 'woodDark', 0.03, 0.22, 0.03, HX1 - T - 0.1, HP + 0.02, HZM + 0.2, roll=-0.3)
# sierpy na kołkach na lewej ścianie
for z in (HZM - 0.12, HZM + 0.06):
    b.box('interior', 'woodDark', 0.03, 0.03, 0.03, HX0 + T + 0.015, HP + 0.48, z)
    for k in range(6):
        a0, a1 = math.pi * (0.1 + k * 0.15), math.pi * (0.1 + (k + 1) * 0.15)
        r = 0.08
        b.box('interior', 'iron', 0.012, 0.012, r * 0.55, HX0 + T + 0.02, HP + 0.4 + math.sin((a0 + a1) / 2) * r, z + math.cos((a0 + a1) / 2) * r, math.pi / 2 - (a0 + a1) / 2)
    b.box('interior', 'wood', 0.018, 0.08, 0.018, HX0 + T + 0.02, HP + 0.32, z - 0.08)
# snopek pod ścianą
b.prism('interior', 'hay', 0.06, 0.04, 0.32, HX0 + T + 0.12, HP + 0.02, HZ1 - T - 0.15, seg=9)
b.prism('interior', 'rope', 0.05, 0.05, 0.02, HX0 + T + 0.12, HP + 0.14, HZ1 - T - 0.15, seg=9)
b.prism('interior', 'hay', 0.04, 0.09, 0.08, HX0 + T + 0.12, HP + 0.34, HZ1 - T - 0.15, seg=9)
t.open.append([-1.5, 1.5, -1.5, 1.5])

# ---------------- przed chałupą: kopki snopków, radło, beczka z wodą ----------------
def stook(x, z):
    """Kopka: kilka snopków opartych o siebie, z jednym na wierzchu jak daszek"""
    for k in range(6):
        a = k * math.pi / 3
        sx, sz = x + math.sin(a) * 0.07, z + math.cos(a) * 0.07
        b.prism('base', 'hay', 0.045, 0.03, 0.3, sx, FLOOR, sz, seg=7)
        b.prism('base', 'rope', 0.04, 0.04, 0.015, sx, FLOOR + 0.13, sz, seg=7)
        b.prism('base', 'hay', 0.03, 0.055, 0.07, sx, FLOOR + 0.3, sz, seg=7)
    b.prism('base', 'hay', 0.14, 0.0, 0.14, x, FLOOR + 0.34, z, seg=8)
    t.block(x - 0.14, x + 0.14, z - 0.14, z + 0.14, 0, 0.5)
stook(-1.1, -0.1)
stook(-0.75, 0.25)
stook(-1.12, 0.62)
# radło oparte o ścianę chałupy z boku
b.box('base', 'woodDark', 0.04, 0.7, 0.04, HX1 + 0.08, FLOOR, HZM - 0.15, tilt=0.35, bottom=True)
b.box('base', 'iron', 0.05, 0.12, 0.03, HX1 + 0.08, FLOOR, HZM - 0.12)
b.box('base', 'woodDark', 0.25, 0.04, 0.04, HX1 + 0.08, FLOOR + 0.1, HZM - 0.05, math.pi / 2)
t.block(HX1 + 0.03, HX1 + 0.13, HZM - 0.3, HZM + 0.1, 0, 0.6)
# beczka z wodą przy drzwiach
b.prism('base', 'wood', 0.09, 0.095, 0.24, -0.62, FLOOR, HZ1 + 0.14, seg=10)
for y in (0.04, 0.19):
    b.prism('base', 'iron', 0.099, 0.099, 0.015, -0.62, FLOOR + y, HZ1 + 0.14, seg=10)
b.prism('base', 'dark', 0.085, 0.085, 0.004, -0.62, FLOOR + 0.236, HZ1 + 0.14, seg=10)
t.block(-0.72, -0.52, HZ1 + 0.04, HZ1 + 0.24, 0, 0.3)

# ---------------- strach na wróble na polu (między zagonami) ----------------
CX, CZ = 0.85, 0.0
b.box('base', 'woodDark', 0.04, 0.8, 0.04, CX, FLOOR, CZ)
b.box('base', 'woodDark', 0.5, 0.035, 0.035, CX, FLOOR + 0.55, CZ)
b.prism('base', 'sack', 0.09, 0.11, 0.3, CX, FLOOR + 0.3, CZ, seg=8)              # kaftan z worka
b.prism('base', 'rope', 0.1, 0.1, 0.02, CX, FLOOR + 0.42, CZ, seg=8)
for sx in (-1, 1):                                                                 # rękawy na poprzeczce i słoma z rękawów
    b.prism('base', 'sack', 0.035, 0.035, 0.18, CX + sx * 0.08, FLOOR + 0.52, CZ, seg=6)
    b.box('base', 'sack', 0.16, 0.06, 0.06, CX + sx * 0.16, FLOOR + 0.53, CZ)
    b.box('base', 'hay', 0.05, 0.04, 0.04, CX + sx * 0.265, FLOOR + 0.54, CZ)
b.prism('base', 'sack', 0.07, 0.07, 0.12, CX, FLOOR + 0.6, CZ, seg=8)             # głowa z worka
b.prism('base', 'hay', 0.13, 0.05, 0.03, CX, FLOOR + 0.72, CZ, seg=10)             # słomkowy kapelusz
b.prism('base', 'hay', 0.05, 0.0, 0.06, CX, FLOOR + 0.75, CZ, seg=10)
t.block(CX - 0.1, CX + 0.1, CZ - 0.1, CZ + 0.1, 0, 0.9)

OUT = ['base', 'shell']
VIEWS = [
    ['farma od wejścia', [0.3, 1.0, 3.5], [0, 0.3, 0], OUT, 26],
    ['chałupa i kopki', [-0.3, 0.6, 0.9], [-0.95, 0.35, -0.9], OUT, 22],
    ['w chałupie', [DM, HP + 0.46, HZ1 - 0.08], [-0.95, 0.2, -1.2], ['base', 'interior', 'floor'], 16],
]
b.save('farm', maxe=0.3, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': FLOOR, 'windows': t.windows, 'chimneys': [], 'flames': [], 'rows': ROWS, 'views': VIEWS})
